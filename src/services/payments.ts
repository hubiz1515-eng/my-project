import type { PaymentMethod, Won } from '../types/models';
import { delay } from './types';

/**
 * 결제 계층 (현재: Mock).
 *
 * TODO(PortOne 연동):
 *  1) `@portone/react-native-sdk` 의 결제 화면(WebView)을 MockPaymentSheet 자리에 띄운다.
 *     storeId / channelKey 는 .env 의 EXPO_PUBLIC_PORTONE_* 사용.
 *  2) 결제 완료 콜백의 paymentId 를 createOrder Cloud Function 에 넘긴다.
 *  3) Function 이 PortOne REST API(API Secret)로 금액·상태를 검증한 뒤 주문 생성.
 *     재고 부족 등으로 실패하면 Function 이 결제 취소 API 를 호출한다.
 */

export const PAYMENT_METHODS: { key: PaymentMethod; label: string; color: string; fg: string }[] = [
  { key: 'tosspay', label: '토스페이', color: '#0064FF', fg: '#fff' },
  { key: 'kakaopay', label: '카카오페이', color: '#FEE500', fg: '#191919' },
];

export const paymentLabel = (m: PaymentMethod) => PAYMENT_METHODS.find((p) => p.key === m)?.label ?? m;

export interface PaymentRequest {
  amount: Won;
  method: PaymentMethod;
  orderName: string;
}

/** 테스트 결제 승인. 실제 돈은 오가지 않는다. */
export async function approveMockPayment(req: PaymentRequest): Promise<{ paymentId: string }> {
  await delay(900);
  if (!(req.amount > 0)) throw new Error('결제 금액이 올바르지 않아요.');
  return { paymentId: `mock_${req.method}_${Date.now()}` };
}

/** 결제 취소(환불). 운영에서는 서버(Cloud Function)만 호출한다. */
export async function cancelPayment(paymentId: string, reason: string): Promise<void> {
  await delay(100);
  if (__DEV__) console.log(`[mock payment] canceled ${paymentId}: ${reason}`);
}
