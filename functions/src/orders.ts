import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { restoreStock } from '../shared/foodItemRules';
import { nextOrderStatus, orderLines, type OrderAction } from '../shared/orderRules';
import { paymentVerifier } from './config';
import { col, db } from './db';
import { refundPayment } from './payments';
import type { FoodItemDoc, OrderDoc } from './types';

/**
 * 주문 취소(고객, 수락 전) / 거절(사장님, 픽업 전) + 환불 + 재고 복구.
 * 1) 트랜잭션: 상태 canceled + 재고 수량 복구(상태 유지 — 자동 재판매 금지) + refundStatus=pending
 * 2) PortOne 결제 취소 → refundStatus=done|failed (failed 는 수동 환불 대상으로 로그)
 */
export async function cancelOrder(uid: string, orderId: unknown) {
  if (typeof orderId !== 'string' || !orderId) throw new HttpsError('invalid-argument', 'orderId 가 필요해요.');
  const ref = col.orders().doc(orderId);

  const order = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', '주문을 찾을 수 없어요.');
    const o = snap.data() as OrderDoc;
    let action: OrderAction;
    if (o.customerId === uid) action = 'customer_cancel';
    else if (o.storeOwnerId === uid) action = 'reject';
    else throw new HttpsError('permission-denied', '이 주문을 취소할 권한이 없어요.');

    const next = nextOrderStatus(o.status, action);
    if (typeof next !== 'string') throw new HttpsError('failed-precondition', next.error);

    const lines = orderLines(o);
    const itemSnaps = await tx.getAll(...lines.map((l) => col.foodItems().doc(l.itemId)));
    itemSnaps.forEach((s, i) => {
      if (!s.exists) return;
      tx.update(s.ref, { ...restoreStock(s.data() as FoodItemDoc, lines[i].quantity), updatedAt: FieldValue.serverTimestamp() });
    });
    const canceledBy = action === 'customer_cancel' ? 'customer' : 'seller';
    tx.update(ref, {
      status: 'canceled',
      canceledBy,
      canceledAt: FieldValue.serverTimestamp(),
      refundStatus: 'pending',
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { ...o, canceledBy } as OrderDoc;
  });

  const refunded = await refundPayment(
    paymentVerifier(),
    order.paymentId,
    order.canceledBy === 'customer' ? '고객 주문 취소' : '매장 사정으로 주문 거절',
  );
  await ref.update({ refundStatus: refunded ? 'done' : 'failed', updatedAt: FieldValue.serverTimestamp() });
  return { orderId, refundStatus: refunded ? 'done' : 'failed' };
}
