import { Timestamp } from 'firebase/firestore';
import type { Order, PaymentMethod, Won } from '../types/models';
import { restoreStock, applyStockDelta } from '../utils/foodItemRules';
import {
  generatePickupCode,
  isActiveOrder,
  nextOrderStatus,
  orderLines,
  priceCart,
  type CartLine,
  type OrderAction,
} from '../utils/orderRules';
import { delay, ensureSeeded, mockDb, type Unsubscribe } from './mockDb';
import { cancelPayment } from './payments';

/**
 * orders 데이터 계층 (현재: 메모리 Mock).
 * TODO(Firebase 연동): 쓰기 함수는 전부 Callable Cloud Function 호출로 교체
 *   (firestore.rules 에서 orders 클라이언트 쓰기는 금지되어 있음). 구독은 onSnapshot.
 */

const newestFirst = (a: Order, b: Order) => b.createdAt.toMillis() - a.createdAt.toMillis();

export function subscribeAllOrders(onChange: (orders: Order[]) => void): Unsubscribe {
  return mockDb.orders.subscribe((all) => onChange([...all].sort(newestFirst)));
}

export function subscribeStoreOrders(storeId: string, onChange: (orders: Order[]) => void): Unsubscribe {
  return subscribeAllOrders((all) => onChange(all.filter((o) => o.storeId === storeId)));
}

export function subscribeMyOrders(customerId: string, onChange: (orders: Order[]) => void): Unsubscribe {
  return subscribeAllOrders((all) => onChange(all.filter((o) => o.customerId === customerId)));
}

export function subscribeOrder(orderId: string, onChange: (order: Order | null) => void): Unsubscribe {
  return mockDb.orders.subscribe((all) => onChange(all.find((o) => o.orderId === orderId) ?? null));
}

export interface CreateOrderInput {
  customerId: string;
  customerName: string;
  main: CartLine;
  addOns: CartLine[];
  paymentId: string;
  paymentMethod: PaymentMethod;
  /** 클라이언트가 결제한 금액. 서버 계산 금액과 다르면 주문 거부(→ 결제 취소). */
  paidAmount: Won;
}

/**
 * 결제 완료 후 주문 생성 = 서버 트랜잭션 흉내:
 * 금액 재계산·검증 → 재고 차감 → 픽업코드 발급 → 주문 생성.
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  ensureSeeded();
  await delay(400);
  const nowMs = Date.now();
  const priced = priceCart(mockDb.foodItems.all, input.main, input.addOns, nowMs);
  if ('error' in priced) throw new Error(priced.error);
  if (priced.total !== input.paidAmount) {
    throw new Error('결제 중 상품 가격이 바뀌었어요. 다시 확인해 주세요.');
  }

  const mainItem = mockDb.foodItems.get(priced.main.itemId)!;
  const now = Timestamp.fromMillis(nowMs);

  // 재고 차감 (운영: runTransaction 안에서 수행)
  for (const line of [priced.main, ...priced.addOns]) {
    const item = mockDb.foodItems.get(line.itemId)!;
    mockDb.foodItems.patch(line.itemId, { ...applyStockDelta(item, -line.quantity), updatedAt: now });
  }

  const taken = new Set(
    mockDb.orders.all.filter((o) => o.storeId === priced.storeId && isActiveOrder(o)).map((o) => o.pickupCode),
  );
  const order: Order = {
    orderId: `order_${nowMs}_${Math.floor(Math.random() * 1000)}`,
    customerId: input.customerId,
    customerName: input.customerName,
    storeId: priced.storeId,
    storeOwnerId: mainItem.ownerId,
    storeName: mainItem.storeName,
    itemId: priced.main.itemId,
    itemTitle: priced.main.title,
    unitPrice: priced.main.unitPrice,
    quantity: priced.main.quantity,
    addOns: priced.addOns,
    totalPrice: priced.total,
    pickupCode: generatePickupCode(taken),
    status: 'paid',
    paymentId: input.paymentId,
    paymentMethod: input.paymentMethod,
    paidAt: now,
    pickupEndTime: Timestamp.fromMillis(priced.pickupEndMs),
    createdAt: now,
    updatedAt: now,
  };
  mockDb.orders.insert(order);
  return order;
}

function transition(orderId: string, action: OrderAction): Order {
  const order = mockDb.orders.get(orderId);
  if (!order) throw new Error('주문을 찾을 수 없어요.');
  const next = nextOrderStatus(order.status, action);
  if (typeof next !== 'string') throw new Error(next.error);

  const now = Timestamp.now();
  const patch: Partial<Order> = { status: next, updatedAt: now };
  if (next === 'accepted') patch.acceptedAt = now;
  if (next === 'picked_up') patch.pickedUpAt = now;
  if (next === 'canceled') {
    patch.canceledAt = now;
    patch.canceledBy = action === 'customer_cancel' ? 'customer' : 'seller';
    // 재고 복구 (상태는 유지 — 자동 재판매 금지)
    for (const line of orderLines(order)) {
      const item = mockDb.foodItems.get(line.itemId);
      if (item) mockDb.foodItems.patch(line.itemId, { ...restoreStock(item, line.quantity), updatedAt: now });
    }
    void cancelPayment(order.paymentId, patch.canceledBy === 'customer' ? '고객 취소' : '매장 거절');
  }
  mockDb.orders.patch(orderId, patch);
  return { ...order, ...patch };
}

export async function acceptOrder(orderId: string) {
  return transition(orderId, 'accept');
}

export async function rejectOrder(orderId: string) {
  return transition(orderId, 'reject');
}

export async function cancelMyOrder(orderId: string) {
  return transition(orderId, 'customer_cancel');
}

/** 사장님이 고객의 6자리 코드를 입력 → 해당 매장의 활성 주문을 찾아 픽업 완료 */
export async function confirmPickupByCode(storeId: string, code: string): Promise<Order> {
  const order = mockDb.orders.all.find(
    (o) => o.storeId === storeId && isActiveOrder(o) && o.pickupCode === code.trim(),
  );
  if (!order) throw new Error('일치하는 픽업 대기 주문이 없어요. 코드를 다시 확인해 주세요.');
  return transition(order.orderId, 'pickup');
}
