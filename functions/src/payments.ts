import * as logger from 'firebase-functions/logger';
import type { PaymentVerifier } from './config';

export type PaymentCheck =
  | { ok: true }
  /** 아직 결제가 끝나지 않음 (사용자가 결제창을 닫음 등) — 환불 불필요 */
  | { ok: false; refund: false; reason: string }
  /** 결제는 됐지만 금액/상점 불일치 — 환불 필요 */
  | { ok: false; refund: true; reason: string };

/** PortOne 서버에서 결제를 조회해 금액·상태·상점을 검증 */
export async function verifyPayment(v: PaymentVerifier, paymentId: string, expectedAmount: number): Promise<PaymentCheck> {
  if (v.mode === 'mock') return { ok: true };
  let payment;
  try {
    payment = await v.client.getPayment({ paymentId });
  } catch (e) {
    logger.warn('getPayment failed', { paymentId, error: String(e) });
    return { ok: false, refund: false, reason: '결제 정보를 찾을 수 없어요.' };
  }
  if (payment.status !== 'PAID') {
    return { ok: false, refund: false, reason: '결제가 완료되지 않았어요.' };
  }
  if (v.storeId && payment.storeId !== v.storeId) {
    logger.error('store mismatch', { paymentId, storeId: payment.storeId });
    return { ok: false, refund: true, reason: '결제 정보가 올바르지 않아요.' };
  }
  if (payment.currency !== 'KRW' || payment.amount.total !== expectedAmount) {
    logger.error('amount mismatch', { paymentId, paid: payment.amount.total, expected: expectedAmount, currency: payment.currency });
    return { ok: false, refund: true, reason: '결제 금액이 주문 금액과 달라요. 자동으로 환불됩니다.' };
  }
  return { ok: true };
}

/** 결제 취소(환불). 실패해도 throw 하지 않고 false — 호출 측이 refundStatus 로 기록 */
export async function refundPayment(v: PaymentVerifier, paymentId: string, reason: string): Promise<boolean> {
  if (v.mode === 'mock') {
    logger.info('[mock] refund', { paymentId, reason });
    return true;
  }
  try {
    await v.client.cancelPayment({ paymentId, reason });
    return true;
  } catch (e) {
    // 이미 취소된 결제면 성공으로 간주
    if (String((e as { data?: { type?: string } })?.data?.type ?? e).includes('ALREADY_CANCELLED')) return true;
    logger.error('refund failed — 수동 환불 필요', { paymentId, reason, error: String(e) });
    return false;
  }
}
