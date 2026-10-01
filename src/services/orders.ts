import {
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Transaction,
} from 'firebase/firestore';
import { orderDoc, ordersCol } from '../config/collections';
import { db } from '../config/firebaseConfig';
import type { Order } from '../types/models';
import { nextOrderStatus } from '../utils/orderRules';
import { parsePickupQr } from '../utils/pickupQr';
import { cancelOrder } from './checkout';
import type { ErrorHandler, Unsubscribe } from './types';

/**
 * orders 데이터 계층.
 * - 조회: Firestore 실시간 구독
 * - 생성·취소·환불: Cloud Functions (services/checkout.ts) — 보안 규칙상 클라이언트 쓰기 불가
 * - 수락·픽업 완료: 사장님 클라이언트 트랜잭션 (규칙이 허용하는 전이만)
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
  return onSnapshot(
    orderDoc(orderId),
    (snap) => onChange(snap.exists() ? snap.data() : null),
    (e) => {
      // 없는 주문·남의 주문은 보안 규칙상 permission-denied 로 온다 → '찾을 수 없음'으로 처리
      if ((e as { code?: string }).code === 'permission-denied') onChange(null);
      else onError?.(e);
    },
  );
}

/**
 * 사장님의 수락·픽업 완료 (돈이 오가지 않는 상태 변경 — 보안 규칙이 허용하는 클라이언트 쓰기).
 * 취소·거절은 환불이 필요하므로 Cloud Function(cancelOrder)으로만.
 */
async function transition(orderId: string, action: 'accept' | 'pickup', expectedCode?: string): Promise<Order> {
  return runTransaction(db, async (tx: Transaction) => {
    const snap = await tx.get(orderDoc(orderId));
    if (!snap.exists()) throw new Error('주문을 찾을 수 없어요.');
    const order = snap.data();
    if (expectedCode !== undefined && order.pickupCode !== expectedCode) {
      throw new Error('픽업 코드가 일치하지 않아요.');
    }
    const next = nextOrderStatus(order.status, action);
    if (typeof next !== 'string') throw new Error(next.error);
    const patch: Record<string, unknown> = { status: next, updatedAt: serverTimestamp() };
    if (next === 'accepted') patch.acceptedAt = serverTimestamp();
    if (next === 'picked_up') patch.pickedUpAt = serverTimestamp();
    tx.update(snap.ref, patch);
    return { ...order, status: next };
  });
}

export const acceptOrder = (orderId: string) => transition(orderId, 'accept');
/** 사장님 거절 → 서버가 환불 + 재고 복구 */
export const rejectOrder = (orderId: string) => cancelOrder(orderId);
/** 고객 취소(수락 전) → 서버가 환불 + 재고 복구 */
export const cancelMyOrder = (orderId: string) => cancelOrder(orderId);

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
