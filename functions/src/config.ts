import { defineSecret, defineString } from 'firebase-functions/params';
import { PaymentClient } from '@portone/server-sdk/payment';

/** PortOne V2 API Secret (콘솔 > 결제연동 > 연동 정보 > V2 API). `firebase functions:secrets:set PORTONE_API_SECRET` */
export const PORTONE_API_SECRET = defineSecret('PORTONE_API_SECRET');
/** PortOne 웹훅 시크릿 (콘솔 > 결제연동 > 웹훅). `firebase functions:secrets:set PORTONE_WEBHOOK_SECRET` */
export const PORTONE_WEBHOOK_SECRET = defineSecret('PORTONE_WEBHOOK_SECRET');
/** PortOne 상점 ID (store-...). functions/.env 에 PORTONE_STORE_ID=... */
export const PORTONE_STORE_ID = defineString('PORTONE_STORE_ID', { default: '' });

const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

/** 테스트에서 가짜 PortOne 서버를 가리킬 때만 사용 (에뮬레이터 전용) */
function apiBaseUrl(): string | undefined {
  const override = process.env.PORTONE_API_BASE;
  return isEmulator && override ? override : undefined;
}

export type PaymentVerifier =
  | { mode: 'portone'; client: ReturnType<typeof PaymentClient>; storeId: string | undefined }
  | { mode: 'mock' };

/**
 * 결제 검증 방식 결정.
 * - API Secret 이 있으면 항상 PortOne 서버에 결제를 조회해 검증한다.
 * - Secret 이 없으면 **에뮬레이터에서만** Mock 결제를 허용한다 (운영 배포에서는 거부).
 */
export function paymentVerifier(): PaymentVerifier {
  let secret = '';
  try {
    secret = PORTONE_API_SECRET.value();
  } catch {
    secret = '';
  }
  if (secret) {
    const storeId = PORTONE_STORE_ID.value() || undefined;
    return { mode: 'portone', client: PaymentClient({ secret, baseUrl: apiBaseUrl(), storeId }), storeId };
  }
  if (isEmulator) return { mode: 'mock' };
  throw new Error('PORTONE_API_SECRET 이 설정되지 않았습니다.');
}
