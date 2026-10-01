import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebaseConfig';
import type { PaymentMethod, RefundStatus } from '../types/models';
import type { CartLine } from '../utils/orderRules';

/**
 * 결제·주문 서버 API (Cloud Functions, functions/src). 금액 계산·결제 검증·재고 차감·환불은 모두 서버에서.
 *  1) prepareCheckout  : 서버가 최신 가격으로 금액 확정 → paymentId 발급
 *  2) (PortOne 결제창)  : 앱이 paymentId·금액으로 결제
 *  3) completeCheckout : 서버가 PortOne 에 결제를 조회·검증 → 재고 차감 + 주문 생성 (실패 시 자동 환불)
 */

export interface CheckoutResult {
  paymentId: string;
  totalAmount: number;
  orderName: string;
}

const prepareFn = httpsCallable<{ main: CartLine; addOns: CartLine[]; paymentMethod: PaymentMethod }, CheckoutResult>(
  functions,
  'prepareCheckout',
);
const completeFn = httpsCallable<{ paymentId: string }, { orderId: string }>(functions, 'completeCheckout');
const cancelFn = httpsCallable<{ orderId: string }, { orderId: string; refundStatus: RefundStatus }>(functions, 'cancelOrder');

export async function prepareCheckout(input: { main: CartLine; addOns: CartLine[]; paymentMethod: PaymentMethod }) {
  return (await prepareFn(input)).data;
}

export async function completeCheckout(paymentId: string) {
  return (await completeFn({ paymentId })).data;
}

/** 고객 취소(수락 전) / 사장님 거절 — 서버가 환불 + 재고 복구 */
export async function cancelOrder(orderId: string) {
  return (await cancelFn({ orderId })).data;
}
