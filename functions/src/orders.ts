import { FieldValue, type DocumentReference } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { restoreStock } from '../shared/foodItemRules';
import { nextOrderStatus, orderLines, type OrderAction } from '../shared/orderRules';
import type { CanceledBy } from '../shared/types';
import { paymentVerifier } from './config';
import { col, db } from './db';
import { refundPayment } from './payments';
import type { FoodItemDoc, OrderDoc } from './types';

const REFUND_REASON: Record<CanceledBy, string> = {
  customer: '고객 주문 취소',
  seller: '매장 사정으로 주문 거절',
  system: '픽업 마감까지 매장 미수락 — 자동 취소',
};

/**
 * 취소 + 환불 + 재고 복구 (고객 취소·사장님 거절·시스템 자동 취소 공통).
 * 1) 트랜잭션: decide 가 취소 주체를 정하면 상태 canceled + 재고 수량 복구(상태 유지 — 자동 재판매 금지) + refundStatus=pending
 * 2) PortOne 결제 취소 → refundStatus=done|failed (failed 는 수동 환불 대상으로 로그)
 * decide 가 null 을 돌려주면 아무것도 하지 않는다 (자동 처리에서 그새 상태가 바뀐 경우).
 */
async function cancelWithRefund(ref: DocumentReference, decide: (o: OrderDoc) => CanceledBy | null) {
  const order = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', '주문을 찾을 수 없어요.');
    const o = snap.data() as OrderDoc;
    const canceledBy = decide(o);
    if (!canceledBy) return null;

    const lines = orderLines(o);
    const itemSnaps = await tx.getAll(...lines.map((l) => col.foodItems().doc(l.itemId)));
    itemSnaps.forEach((s, i) => {
      if (!s.exists) return;
      tx.update(s.ref, { ...restoreStock(s.data() as FoodItemDoc, lines[i].quantity), updatedAt: FieldValue.serverTimestamp() });
    });
    tx.update(ref, {
      status: 'canceled',
      canceledBy,
      canceledAt: FieldValue.serverTimestamp(),
      refundStatus: 'pending',
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { ...o, canceledBy } as OrderDoc;
  });
  if (!order) return null;

  const refunded = await refundPayment(paymentVerifier(), order.paymentId, REFUND_REASON[order.canceledBy!]);
  const refundStatus = refunded ? 'done' : 'failed';
  await ref.update({ refundStatus, updatedAt: FieldValue.serverTimestamp() });
  return { orderId: order.orderId, refundStatus } as const;
}

/** 주문 취소(고객, 수락 전) / 거절(사장님, 픽업 전) */
export async function cancelOrder(uid: string, orderId: unknown) {
  if (typeof orderId !== 'string' || !orderId) throw new HttpsError('invalid-argument', 'orderId 가 필요해요.');
  const result = await cancelWithRefund(col.orders().doc(orderId), (o) => {
    let action: OrderAction;
    if (o.customerId === uid) action = 'customer_cancel';
    else if (o.storeOwnerId === uid) action = 'reject';
    else throw new HttpsError('permission-denied', '이 주문을 취소할 권한이 없어요.');
    const next = nextOrderStatus(o.status, action);
    if (typeof next !== 'string') throw new HttpsError('failed-precondition', next.error);
    return action === 'customer_cancel' ? 'customer' : 'seller';
  });
  return result!;
}

/** 시스템 자동 취소 (expiry.ts). shouldCancel 이 트랜잭션 안에서 최신 상태로 다시 판단한다. */
export function autoCancelOrder(orderId: string, shouldCancel: (o: OrderDoc) => boolean) {
  return cancelWithRefund(col.orders().doc(orderId), (o) => (shouldCancel(o) ? 'system' : null));
}
