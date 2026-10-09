import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { expiryActionFor, NO_SHOW_POLICY, noShowRefundAmount } from '../shared/policy';
import { paymentVerifier } from './config';
import { col, db } from './db';
import { autoCancelOrder } from './orders';
import { refundPayment } from './payments';
import type { OrderDoc } from './types';

/** 한 번에 처리할 최대 건수 (상태별). 남으면 다음 실행에서 이어서 처리 */
const BATCH = 200;

/**
 * 픽업 마감 + 유예 시간(NO_SHOW_POLICY.graceMinutes)이 지난 주문 자동 처리 (스케줄러가 주기적으로 호출).
 * - accepted → no_show : 노쇼 정책에 따라 환불(현재 정책: 환불 없음). 재고는 복구하지 않는다(이미 준비된 상품).
 * - paid     → canceled(system) : 매장이 수락하지 않음 → 전액 환불 + 재고 수량 복구.
 * 각 주문은 트랜잭션 안에서 최신 상태로 다시 판단하므로, 그 사이 픽업·취소된 주문은 건드리지 않는다.
 */
export async function processExpiredOrders(nowMs: number) {
  const cutoff = Timestamp.fromMillis(nowMs - NO_SHOW_POLICY.graceMinutes * 60_000);
  const due = (status: 'accepted' | 'paid') =>
    col.orders().where('status', '==', status).where('pickupEndTime', '<=', cutoff).orderBy('pickupEndTime').limit(BATCH).get();
  const [accepted, paid] = await Promise.all([due('accepted'), due('paid')]);

  let noShows = 0;
  let canceled = 0;
  let refundFailures = 0;

  for (const d of accepted.docs) {
    const marked = await db.runTransaction(async (tx) => {
      const snap = await tx.get(d.ref);
      const o = snap.data() as OrderDoc | undefined;
      if (!o || expiryActionFor(o, nowMs) !== 'no_show') return null;
      const refund = noShowRefundAmount(o.totalPrice);
      tx.update(d.ref, {
        status: 'no_show',
        noShowAt: FieldValue.serverTimestamp(),
        ...(refund > 0 ? { refundStatus: 'pending', refundAmount: refund } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { o, refund };
    });
    if (!marked) continue;
    noShows++;
    if (marked.refund > 0) {
      const ok = await refundPayment(paymentVerifier(), marked.o.paymentId, '노쇼 정책에 따른 부분/전액 환불', marked.refund);
      if (!ok) refundFailures++;
      await d.ref.update({ refundStatus: ok ? 'done' : 'failed', updatedAt: FieldValue.serverTimestamp() });
    }
  }

  for (const d of paid.docs) {
    const r = await autoCancelOrder(d.id, (o) => expiryActionFor(o, nowMs) === 'auto_cancel');
    if (!r) continue;
    canceled++;
    if (r.refundStatus === 'failed') refundFailures++;
  }

  const summary = { noShows, canceled, refundFailures, more: accepted.size === BATCH || paid.size === BATCH };
  if (noShows || canceled) logger.info('expired orders processed', summary);
  if (refundFailures) logger.error('자동 처리 중 환불 실패 — 수동 환불 필요', summary);
  return summary;
}
