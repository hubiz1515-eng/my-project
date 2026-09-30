import {
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  type Transaction,
} from 'firebase/firestore';
import { foodItemDoc, orderDoc, ordersCol } from '../config/collections';
import { db } from '../config/firebaseConfig';
import type { FoodItem, Order, PaymentMethod, User, Won } from '../types/models';
import { applyStockDelta, restoreStock } from '../utils/foodItemRules';
import {
  generatePickupCode,
  nextOrderStatus,
  orderLines,
  priceCart,
  type CartLine,
  type OrderAction,
} from '../utils/orderRules';
import { parsePickupQr } from '../utils/pickupQr';
import { cancelPayment } from './payments';
import type { ErrorHandler, Unsubscribe } from './types';

/**
 * orders 데이터 계층 (Firestore, 클라이언트 트랜잭션).
 * 보안 규칙이 상태 전이·재고 증감량을 검증한다 (firestore.rules).
 * TODO(PortOne 실결제): createOrder / 취소류를 Callable Cloud Function 으로 이전.
 */

const RECENT_LIMIT = 50;
const ACTIVE = ['paid', 'accepted'] as const;

export function subscribeMyOrders(customerId: string, onChange: (orders: Order[]) => void, onError?: ErrorHandler): Unsubscribe {
  return onSnapshot(
    query(ordersCol, where('customerId', '==', customerId), orderBy('createdAt', 'desc'), limit(RECENT_LIMIT)),
    (snap) => onChange(snap.docs.map((d) => d.data())),
    onError,
  );
}

/** 사장님: 내 매장 주문 (storeOwnerId 로 조회해야 보안 규칙과 일치) */
export function subscribeStoreOrders(ownerId: string, onChange: (orders: Order[]) => void, onError?: ErrorHandler): Unsubscribe {
  return onSnapshot(
    query(ordersCol, where('storeOwnerId', '==', ownerId), orderBy('createdAt', 'desc'), limit(RECENT_LIMIT)),
    (snap) => onChange(snap.docs.map((d) => d.data())),
    onError,
  );
}

export function subscribeOrder(orderId: string, onChange: (order: Order | null) => void, onError?: ErrorHandler): Unsubscribe {
  return onSnapshot(orderDoc(orderId), (snap) => onChange(snap.exists() ? snap.data() : null), onError);
}

export interface CreateOrderInput {
  customer: Pick<User, 'uid' | 'name'>;
  main: CartLine;
  addOns: CartLine[];
  paymentId: string;
  paymentMethod: PaymentMethod;
  /** 클라이언트가 결제한 금액. 트랜잭션 안에서 다시 계산한 금액과 다르면 주문 거부(→ 결제 취소). */
  paidAmount: Won;
}

/**
 * 결제 완료 후 주문 생성 (트랜잭션):
 * 최신 재고·가격으로 재계산 → 금액 검증 → 재고 차감 → 픽업코드 발급 → 주문 생성.
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const lines = [input.main, ...input.addOns.filter((l) => l.quantity > 0)];
  const orderRef = doc(ordersCol);

  return runTransaction(db, async (tx) => {
    const snaps = await Promise.all(lines.map((l) => tx.get(foodItemDoc(l.itemId))));
    const items = snaps.filter((s) => s.exists()).map((s) => s.data()!);
    const nowMs = Date.now();
    const priced = priceCart(items, input.main, input.addOns, nowMs);
    if ('error' in priced) throw new Error(priced.error);
    if (priced.total !== input.paidAmount) throw new Error('결제 중 상품 가격이 바뀌었어요. 다시 확인해 주세요.');

    const all = [priced.main, ...priced.addOns];
    for (const line of all) {
      const item = items.find((i) => i.itemId === line.itemId)!;
      tx.update(foodItemDoc(line.itemId), {
        ...applyStockDelta(item, -line.quantity),
        lastOrderId: orderRef.id,
        updatedAt: serverTimestamp(),
      });
    }

    const mainItem = items.find((i) => i.itemId === priced.main.itemId)!;
    const now = Timestamp.fromMillis(nowMs);
    const order: Order = {
      orderId: orderRef.id,
      customerId: input.customer.uid,
      customerName: input.customer.name,
      storeId: priced.storeId,
      storeOwnerId: mainItem.ownerId,
      storeName: mainItem.storeName,
      itemId: priced.main.itemId,
      itemTitle: priced.main.title,
      unitPrice: priced.main.unitPrice,
      quantity: priced.main.quantity,
      addOns: priced.addOns,
      quantities: Object.fromEntries(all.map((l) => [l.itemId, l.quantity])),
      totalPrice: priced.total,
      // 고객은 다른 주문을 읽을 수 없어 중복 검사는 생략 (100만 분의 1). 중복 시 사장님 쪽에서 QR 로 구분.
      pickupCode: generatePickupCode(new Set()),
      status: 'paid',
      paymentId: input.paymentId,
      paymentMethod: input.paymentMethod,
      paidAt: now,
      pickupEndTime: Timestamp.fromMillis(priced.pickupEndMs),
      createdAt: now,
      updatedAt: now,
    };
    tx.set(orderRef, { ...order, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return order;
  });
}

/** 상태 전이 + (취소 시) 재고 복구를 한 트랜잭션으로 */
async function transition(orderId: string, action: OrderAction, expectedCode?: string): Promise<Order> {
  const result = await runTransaction(db, async (tx: Transaction) => {
    const snap = await tx.get(orderDoc(orderId));
    if (!snap.exists()) throw new Error('주문을 찾을 수 없어요.');
    const order = snap.data();
    if (expectedCode !== undefined && order.pickupCode !== expectedCode) {
      throw new Error('픽업 코드가 일치하지 않아요.');
    }
    const next = nextOrderStatus(order.status, action);
    if (typeof next !== 'string') throw new Error(next.error);

    // 트랜잭션 규칙: 모든 읽기를 쓰기보다 먼저
    const lines = next === 'canceled' ? orderLines(order) : [];
    const itemSnaps = await Promise.all(lines.map((l) => tx.get(foodItemDoc(l.itemId))));

    const canceledBy: Order['canceledBy'] =
      next === 'canceled' ? (action === 'customer_cancel' ? 'customer' : 'seller') : undefined;
    const patch: Record<string, unknown> = { status: next, updatedAt: serverTimestamp() };
    if (next === 'accepted') patch.acceptedAt = serverTimestamp();
    if (next === 'picked_up') patch.pickedUpAt = serverTimestamp();
    if (next === 'canceled') {
      patch.canceledAt = serverTimestamp();
      patch.canceledBy = canceledBy;
      itemSnaps.forEach((s, i) => {
        if (!s.exists()) return;
        const item: FoodItem = s.data();
        tx.update(s.ref, {
          ...restoreStock(item, lines[i].quantity), // 수량만 복구 (자동 재판매 금지)
          lastOrderId: orderId,
          updatedAt: serverTimestamp(),
        });
      });
    }
    tx.update(snap.ref, patch);
    return { ...order, status: next, canceledBy };
  });
  if (result.status === 'canceled') {
    void cancelPayment(result.paymentId, result.canceledBy === 'customer' ? '고객 취소' : '매장 거절');
  }
  return result;
}

export const acceptOrder = (orderId: string) => transition(orderId, 'accept');
export const rejectOrder = (orderId: string) => transition(orderId, 'reject');
export const cancelMyOrder = (orderId: string) => transition(orderId, 'customer_cancel');

/** 사장님이 6자리 코드 입력 → 내 매장의 활성 주문을 찾아 픽업 완료 */
export async function confirmPickupByCode(ownerId: string, code: string): Promise<Order> {
  const snap = await getDocs(
    query(
      ordersCol,
      where('storeOwnerId', '==', ownerId),
      where('pickupCode', '==', code.trim()),
      where('status', 'in', [...ACTIVE]),
    ),
  );
  if (snap.empty) throw new Error('일치하는 픽업 대기 주문이 없어요. 코드를 다시 확인해 주세요.');
  if (snap.size > 1) throw new Error('같은 코드의 주문이 여러 건이에요. 손님의 QR 코드를 스캔해 주세요.');
  return transition(snap.docs[0].id, 'pickup', code.trim());
}

/** 사장님이 손님 QR 스캔 → 주문 ID + 코드 검증 후 픽업 완료 */
export async function confirmPickupByQr(ownerId: string, data: string): Promise<Order> {
  const parsed = parsePickupQr(data);
  if (!parsed) throw new Error('픽업 QR 코드가 아니에요.');
  let order: Order | undefined;
  try {
    order = (await getDoc(orderDoc(parsed.orderId))).data();
  } catch (e) {
    // 보안 규칙상 다른 매장의 주문은 읽을 수 없음
    if ((e as { code?: string }).code === 'permission-denied') throw new Error('우리 매장의 주문이 아니에요.');
    throw e;
  }
  if (!order) throw new Error('주문을 찾을 수 없어요.');
  if (order.storeOwnerId !== ownerId) throw new Error('우리 매장의 주문이 아니에요.');
  return transition(parsed.orderId, 'pickup', parsed.pickupCode);
}
