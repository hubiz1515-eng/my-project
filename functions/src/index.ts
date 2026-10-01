import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import * as checkout from './checkout';
import { PORTONE_API_SECRET, PORTONE_WEBHOOK_SECRET } from './config';
import * as orders from './orders';
import { handlePortoneWebhook } from './webhook';

// 서울 리전. 앱의 getFunctions(app, 'asia-northeast3') 와 일치해야 한다.
setGlobalOptions({ region: 'asia-northeast3', maxInstances: 10 });

function requireUid(auth: { uid: string } | undefined): string {
  if (!auth) throw new HttpsError('unauthenticated', '로그인이 필요해요.');
  return auth.uid;
}

/** 결제 준비: 서버 금액 확정 → { paymentId, totalAmount, orderName } */
export const prepareCheckout = onCall({ secrets: [PORTONE_API_SECRET] }, (req) =>
  checkout.prepareCheckout(requireUid(req.auth), req.data),
);

/** 결제 확정: PortOne 검증 → 재고 차감 + 주문 생성 → { orderId } */
export const completeCheckout = onCall({ secrets: [PORTONE_API_SECRET] }, (req) =>
  checkout.completeCheckout((req.data as { paymentId?: string })?.paymentId ?? '', requireUid(req.auth)),
);

/** 주문 취소(고객)/거절(사장님) + 환불 + 재고 복구 */
export const cancelOrder = onCall({ secrets: [PORTONE_API_SECRET] }, (req) =>
  orders.cancelOrder(requireUid(req.auth), (req.data as { orderId?: string })?.orderId),
);

/** PortOne 웹훅 (콘솔에 https://asia-northeast3-<프로젝트>.cloudfunctions.net/portoneWebhook 등록) */
export const portoneWebhook = onRequest({ secrets: [PORTONE_API_SECRET, PORTONE_WEBHOOK_SECRET] }, handlePortoneWebhook);

