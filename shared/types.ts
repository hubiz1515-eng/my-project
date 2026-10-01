/**
 * 앱(src/)과 Cloud Functions(functions/)가 함께 쓰는 순수 타입.
 * 외부 패키지를 import 하지 않는다 (functions 빌드 시 이 폴더가 그대로 복사됨).
 */

/** 금액은 모두 KRW 정수(원 단위). */
export type Won = number;

/** 클라이언트 Timestamp 와 Admin SDK Timestamp 모두 만족 */
export interface TimestampLike {
  toMillis(): number;
}

export type FoodItemStatus = 'selling' | 'sold_out' | 'paused';

/**
 * paid      : 결제 완료(서버 검증), 사장님 수락 대기
 * accepted  : 사장님 수락, 고객 방문 대기
 * picked_up : 핀코드/QR 확인 후 픽업 완료
 * canceled  : 고객 취소(수락 전) 또는 사장님 거절 → 환불
 */
export type OrderStatus = 'paid' | 'accepted' | 'picked_up' | 'canceled';

/** 결제 수단 (PortOne 채널) */
export type PaymentMethod = 'card' | 'kakaopay';

/** 환불 진행 상태 (취소된 주문) */
export type RefundStatus = 'pending' | 'done' | 'failed';

/** 주문 시점 스냅샷. 이후 사장님이 가격/이름을 바꿔도 주문 내역은 변하지 않는다. */
export interface OrderLine {
  itemId: string;
  title: string;
  unitPrice: Won;
  quantity: number;
}

/** 장바구니 가격 계산에 필요한 상품 필드 */
export interface CartItem {
  itemId: string;
  storeId: string;
  title: string;
  discountPrice: Won;
  stock: number;
  status: FoodItemStatus;
  pickupEndTime: TimestampLike;
}
