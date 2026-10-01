import * as logger from 'firebase-functions/logger';
import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import * as Webhook from '@portone/server-sdk/webhook';
import { PORTONE_WEBHOOK_SECRET } from './config';
import { completeCheckout } from './checkout';

/**
 * PortOne 웹훅. 앱이 결제 직후 종료돼 completeCheckout 을 못 부른 경우에도 주문이 생성되도록 한다.
 * - 서명 검증 실패: 401
 * - 비즈니스 실패(재고 부족 등, 이미 환불 처리됨): 200 (재시도 불필요)
 * - 일시적 오류: 500 (PortOne 이 재시도)
 */
export async function handlePortoneWebhook(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  let event: Awaited<ReturnType<typeof Webhook.verify>>;
  try {
    const raw = req.rawBody?.toString('utf8') ?? '';
    event = await Webhook.verify(PORTONE_WEBHOOK_SECRET.value(), raw, req.headers as Record<string, string>);
  } catch (e) {
    logger.warn('webhook verification failed', { error: String(e) });
    res.status(401).send('invalid signature');
    return;
  }

  if (event.type === 'Transaction.Paid') {
    const paymentId = event.data.paymentId;
    try {
      const { orderId } = await completeCheckout(paymentId, null);
      logger.info('webhook completed', { paymentId, orderId });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'failed-precondition' || code === 'not-found') {
        logger.warn('webhook: not completed (handled)', { paymentId, error: String(e) });
      } else {
        logger.error('webhook: transient failure', { paymentId, error: String(e) });
        res.status(500).send('retry');
        return;
      }
    }
  } else {
    logger.info('webhook ignored', { type: event.type });
  }
  res.status(200).send('ok');
}
