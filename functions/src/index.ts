import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import * as account from './account';
import * as checkout from './checkout';
import { PORTONE_API_SECRET, PORTONE_WEBHOOK_SECRET } from './config';
import * as orders from './orders';
import { handleOrderWrite } from './orderNotifications';
import type { OrderDoc } from './types';
import { handlePortoneWebhook } from './webhook';

// Firestore DB 위치(asia-northeast3, 서울 — 콘솔/CLI 로 확인)와 같은 리전 — Firestore 트리거는 DB 와 같은 리전이어야 하고,
// 함수↔DB 왕복 지연도 줄어든다. 앱의 FUNCTIONS_REGION(src/config/firebaseConfig.ts)과 일치해야 한다.
const REGION = 'asia-northeast3';
setGlobalOptions({ region: REGION, maxInstances: 10 });

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

/** 회원 탈퇴: 진행 중 주문 확인 → 매장·상품·프로필·Auth 계정 삭제 (거래 기록은 보존) */
export const deleteAccount = onCall((req) => account.deleteAccount(requireUid(req.auth)));

/** PortOne 웹훅 (콘솔에 https://asia-northeast3-<프로젝트>.cloudfunctions.net/portoneWebhook 등록) */
export const portoneWebhook = onRequest({ secrets: [PORTONE_API_SECRET, PORTONE_WEBHOOK_SECRET] }, handlePortoneWebhook);


/**
 * 주문 상태 변화 → 푸시 알림 (사장님: 새 주문·고객 취소 / 고객: 수락·픽업 완료·매장 취소).
 * ⚠️ Firestore 트리거는 데이터베이스 위치와 같은 리전에 배포돼야 한다 (이 프로젝트: asia-northeast3).
 */
export const onOrderWritten = onDocumentWritten('orders/{orderId}', (event) =>
  handleOrderWrite(
    event.id,
    event.data?.before.exists ? (event.data.before.data() as OrderDoc) : undefined,
    event.data?.after.exists ? (event.data.after.data() as OrderDoc) : undefined,
  ),
);
