/**
 * 운영 정책 설정 — 앱(약관 문구)과 Cloud Functions(자동 처리)가 함께 쓴다.
 * 외부 패키지를 import 하지 않는다 (functions 빌드 시 이 폴더가 그대로 복사됨).
 *
 * 노쇼 정책 (2026-10-09 확정: 환불 없음, 유예 30분).
 * 값을 바꾸면:
 *   1) 이용약관 제6조 문구가 자동으로 바뀐다 → 약관 버전(src/content/legal/documents.ts 의 terms.version)을 올려 재동의.
 *   2) 자동 처리(functions/src/expiry.ts, 10분마다)가 새 값으로 동작한다 → functions 재배포.
 */
import type { OrderStatus } from './types';

/**
 * 노쇼(사장님이 수락했지만 픽업 마감 시간까지 고객이 오지 않음) 시 환불 방식
 * - none    : 환불 없음 (음식이 이미 준비·폐기되므로. 마감 할인 앱에서 흔한 방식)
 * - partial : 일부 환불 (partialRefundPercent %)
 * - full    : 전액 환불
 */
export type NoShowRefund = 'none' | 'partial' | 'full';

export const NO_SHOW_POLICY = {
  /** 정책을 확정했는지. false 면 약관에 '[정해지지 않음]' 자리표시자가 남는다. */
  decided: true as boolean,
  refund: 'none' as NoShowRefund,
  /** refund === 'partial' 일 때 환불 비율 (1~99) */
  partialRefundPercent: 50,
  /** 픽업 마감 시간 이후 이만큼(분) 지나면 노쇼로 확정 (사장님이 늦은 픽업을 처리할 여유) */
  graceMinutes: 30,
};

/** 이용약관에 들어갈 노쇼 문구 (정책 값에서 생성) */
export function noShowPolicyText(p = NO_SHOW_POLICY): string {
  if (!p.decided) return '[노쇼(픽업 마감 시간까지 미방문) 시 환불 정책]';
  const after = `픽업 마감 시간이 지나고 ${p.graceMinutes}분이 지나도록 픽업하지 않으면 노쇼로 처리되며,`;
  switch (p.refund) {
    case 'full':
      return `${after} 결제 금액 전액이 환불됩니다.`;
    case 'partial':
      return `${after} 상품 준비 비용을 고려해 결제 금액의 ${p.partialRefundPercent}%가 환불됩니다.`;
    case 'none':
      return `${after} 판매자가 이미 상품을 준비했으므로 환불되지 않습니다.`;
  }
}

/** 미수락 주문 자동 취소 문구 (이용약관) */
export function unacceptedPolicyText(p = NO_SHOW_POLICY): string {
  return `판매자가 픽업 마감 시간이 지나고 ${p.graceMinutes}분이 지나도록 주문을 수락하지 않으면 주문은 자동으로 취소되고 결제 금액 전액이 환불됩니다.`;
}

/** 주문 화면·결제 전 안내용 짧은 문구 */
export function noShowNotice(p = NO_SHOW_POLICY): string {
  const refund = p.refund === 'full' ? '전액 환불돼요' : p.refund === 'partial' ? `${p.partialRefundPercent}%만 환불돼요` : '환불되지 않아요';
  return `픽업 마감 후 ${p.graceMinutes}분까지 방문하지 않으면 노쇼로 처리되며 ${refund}.`;
}

/**
 * 자동 처리 대상 판정 (픽업 마감 + 유예 시간이 지났는가)
 * - accepted → no_show (노쇼 정책)
 * - paid     → canceled by system (전액 환불)
 */
export function expiryActionFor(
  o: { status: OrderStatus; pickupEndTime: { toMillis(): number } },
  nowMs: number,
  p = NO_SHOW_POLICY,
): 'no_show' | 'auto_cancel' | null {
  if (nowMs < o.pickupEndTime.toMillis() + p.graceMinutes * 60_000) return null;
  if (o.status === 'accepted') return 'no_show';
  if (o.status === 'paid') return 'auto_cancel';
  return null;
}

/** 노쇼 시 환불할 금액 (원) */
export function noShowRefundAmount(totalPrice: number, p = NO_SHOW_POLICY): number {
  if (p.refund === 'full') return totalPrice;
  if (p.refund === 'partial') return Math.floor((totalPrice * p.partialRefundPercent) / 100);
  return 0;
}
