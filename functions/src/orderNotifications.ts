import { FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { orderSummary } from '../shared/orderRules';
import type { OrderStatus } from '../shared/types';
import { col } from './db';
import { sendPushToUser, type PushMessage } from './push';
import type { OrderDoc } from './types';

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

/** 주문 상태 변화 → (받는 사람, 메시지). 알림이 필요 없는 변화면 null */
export function notificationFor(
  before: Pick<OrderDoc, 'status'> | undefined,
  after: OrderDoc,
): { to: string; msg: PushMessage } | null {
  const was: OrderStatus | undefined = before?.status;
  if (was === after.status) return null; // 환불 상태 갱신 등
  const summary = orderSummary(after);

  if (was === undefined && after.status === 'paid') {
    return {
      to: after.storeOwnerId,
      msg: { title: '🔔 새 픽업 주문', body: `${after.customerName}님 · ${summary} · ${won(after.totalPrice)}`, url: '/seller?tab=orders' },
    };
  }
  const orderUrl = `/order/${after.orderId}`;
  switch (after.status) {
    case 'accepted':
      return { to: after.customerId, msg: { title: '✅ 주문이 수락됐어요', body: `${after.storeName}에 방문해 QR 또는 픽업 코드를 보여주세요.`, url: orderUrl } };
    case 'picked_up':
      return { to: after.customerId, msg: { title: '🎉 픽업 완료', body: `${after.storeName} · ${summary} 맛있게 드세요!`, url: orderUrl } };
    case 'canceled':
      if (after.canceledBy === 'customer') {
        return { to: after.storeOwnerId, msg: { title: '주문이 취소됐어요', body: `${after.customerName}님이 ${summary} 주문을 취소했어요. 재고는 자동으로 복구됐어요.`, url: '/seller?tab=orders' } };
      }
      if (after.canceledBy === 'system') {
        return { to: after.customerId, msg: { title: '주문이 자동 취소됐어요', body: `${after.storeName}이(가) 픽업 시간까지 주문을 수락하지 않아 ${won(after.totalPrice)} 환불됩니다.`, url: orderUrl } };
      }
      return { to: after.customerId, msg: { title: '주문이 취소됐어요', body: `${after.storeName} 사정으로 취소되어 ${won(after.totalPrice)} 환불됩니다.`, url: orderUrl } };
    case 'no_show':
      return {
        to: after.customerId,
        msg: {
          title: '픽업 시간이 지났어요',
          body: `${after.storeName} · ${summary} 주문이 노쇼로 처리됐어요.${after.refundAmount ? ` ${won(after.refundAmount)} 환불됩니다.` : ' 노쇼 정책에 따라 환불되지 않아요.'}`,
          url: orderUrl,
        },
      };
    default:
      return null;
  }
}

/**
 * Firestore 트리거는 같은 이벤트를 두 번 이상 전달할 수 있으므로 eventId 로 한 번만 발송.
 * (push_events 는 보안 규칙상 클라이언트 접근 불가)
 */
export async function handleOrderWrite(
  eventId: string,
  before: OrderDoc | undefined,
  after: OrderDoc | undefined,
): Promise<void> {
  if (!after) return; // 삭제
  const n = notificationFor(before, after);
  if (!n) return;
  const marker = col.pushEvents().doc(eventId);
  try {
    await marker.create({ orderId: after.orderId, to: n.to, status: after.status, createdAt: FieldValue.serverTimestamp() });
  } catch (e) {
    if ((e as { code?: number }).code === 6) return; // ALREADY_EXISTS: 이미 처리한 이벤트
    throw e;
  }
  try {
    const sent = await sendPushToUser(n.to, n.msg);
    logger.info('order push', { orderId: after.orderId, status: after.status, to: n.to, sent });
  } catch (e) {
    // 재시도 시 다시 보낼 수 있도록 표시 제거
    await marker.delete().catch(() => undefined);
    throw e;
  }
}
