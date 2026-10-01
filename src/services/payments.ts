import type { PaymentRequest } from '@portone/browser-sdk/v2';
import type { PaymentMethod } from '../types/models';
import type { CheckoutResult } from './checkout';
import { delay } from './types';

/**
 * PortOne V2 결제 설정. 결제 검증·환불은 서버(functions)가 하고, 앱은 결제창만 띄운다.
 * Store ID 와 해당 결제수단의 채널 키가 모두 있으면 실결제(테스트 채널이면 테스트 결제),
 * 없으면 Mock 결제 시트 — Mock 결제는 에뮬레이터의 Functions 에서만 승인된다(운영 서버는 거부).
 */
export const PORTONE_STORE_ID = process.env.EXPO_PUBLIC_PORTONE_STORE_ID || '';

export const PAYMENT_METHODS: {
  key: PaymentMethod;
  label: string;
  sub?: string;
  color: string;
  fg: string;
  channelKey: string;
}[] = [
  { key: 'kakaopay', label: '카카오페이', color: '#FEE500', fg: '#191919', channelKey: process.env.EXPO_PUBLIC_PORTONE_CHANNEL_KEY_KAKAOPAY || '' },
  { key: 'card', label: '카드 결제', sub: '토스페이먼츠', color: '#0064FF', fg: '#fff', channelKey: process.env.EXPO_PUBLIC_PORTONE_CHANNEL_KEY_TOSS || '' },
];

export const paymentLabel = (m: PaymentMethod | string) => PAYMENT_METHODS.find((p) => p.key === m)?.label ?? m;

/** 이 결제수단으로 PortOne 실결제가 가능한지 (아니면 Mock) */
export function isPortOneEnabled(method: PaymentMethod): boolean {
  return !!PORTONE_STORE_ID && !!PAYMENT_METHODS.find((p) => p.key === method)?.channelKey;
}

export interface PaymentCustomer {
  uid: string;
  name: string;
  phone: string;
  email?: string | null;
}

/** PortOne 결제 요청 객체 (금액·paymentId 는 서버가 확정한 checkout 값) */
export function buildPortOneRequest(
  checkout: CheckoutResult,
  method: PaymentMethod,
  customer: PaymentCustomer,
  redirectUrl?: string,
): PaymentRequest {
  const channelKey = PAYMENT_METHODS.find((p) => p.key === method)!.channelKey;
  const base = {
    storeId: PORTONE_STORE_ID,
    channelKey,
    paymentId: checkout.paymentId,
    orderName: checkout.orderName,
    totalAmount: checkout.totalAmount,
    currency: 'KRW' as const,
    customer: {
      customerId: customer.uid,
      fullName: customer.name,
      phoneNumber: customer.phone.replace(/[^0-9]/g, ''),
      ...(customer.email ? { email: customer.email } : {}),
    },
    ...(redirectUrl ? { redirectUrl } : {}),
  };
  return method === 'kakaopay'
    ? { ...base, payMethod: 'EASY_PAY', easyPay: { easyPayProvider: 'KAKAOPAY' } }
    : { ...base, payMethod: 'CARD' };
}

/** Mock 결제 승인 (실제 돈 이동 없음). 서버 검증은 에뮬레이터에서만 통과한다. */
export async function approveMockPayment(paymentId: string): Promise<{ paymentId: string }> {
  await delay(700);
  return { paymentId };
}
