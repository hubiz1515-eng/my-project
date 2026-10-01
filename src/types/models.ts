import type { Timestamp } from 'firebase/firestore';
import type { FoodItemStatus, OrderLine, OrderStatus, PaymentMethod, RefundStatus, Won } from '../../shared/types';

export type { FoodItemStatus, OrderLine, OrderStatus, PaymentMethod, RefundStatus, Won };

// ── users/{uid} ──────────────────────────────────────────────
export type UserRole = 'customer' | 'seller';

export interface User {
  uid: string;
  role: UserRole;
  name: string;
  phone: string;
  /** FCM/Expo 푸시 토큰 (기기별). 주문·마감임박 알림 전송에 사용. */
  pushTokens: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── stores/{storeId} ─────────────────────────────────────────
// storeId == ownerId (사장님 uid). 사장님 계정당 매장 1개.
export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface DayHours {
  closed: boolean;
  /** 'HH:mm' 24시간제 (매장 현지시간, KST) */
  open: string;
  close: string;
}

export type BusinessHours = Record<DayKey, DayHours>;

export interface Store {
  storeId: string;
  ownerId: string;
  storeName: string;
  address: string;
  latitude: number;
  longitude: number;
  /** 근처 검색용 geohash (precision 9). latitude/longitude 로 계산해 저장. */
  geohash: string;
  businessHours: BusinessHours;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── food_items/{itemId} ──────────────────────────────────────

export interface FoodItem {
  itemId: string;
  storeId: string;
  title: string;
  originalPrice: Won;
  discountPrice: Won;
  /** 남은 수량. 0 이 되면 서버(트랜잭션)가 status 를 'sold_out' 으로 변경. */
  stock: number;
  pickupEndTime: Timestamp;
  status: FoodItemStatus;

  // ── 비정규화 필드: 지도/카드 리스트를 stores 조인 없이 1회 쿼리로 그리기 위함 ──
  /** 보안 규칙에서 get(stores) 없이 소유권 검증하기 위한 사본. */
  ownerId: string;
  storeName: string;
  latitude: number;
  longitude: number;
  geohash: string;

  /** 메인 화면 카드에 표시하는 "추가 메뉴(cross-sell)" 여부. true 면 결제 시 함께 담기 후보. */
  isAddOn: boolean;
  imageUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── orders/{orderId} ─────────────────────────────────────────
export interface Order {
  orderId: string;
  customerId: string;
  storeId: string;
  /** 대표(메인) 상품. 요청 스펙 유지. */
  itemId: string;
  quantity: number;
  /** 메인 + addOns 합계 (실제 결제 금액). 서버가 계산/검증. */
  totalPrice: Won;
  /** 결제 시 함께 구매한 매장 추가 메뉴(Cross-selling). 없으면 빈 배열. */
  addOns: OrderLine[];
  /** itemId → 수량 (대표 + 추가 메뉴) */
  quantities: Record<string, number>;
  /**
   * 6자리 숫자 핀코드. QR 페이로드는 utils/pickupQr.ts 참고.
   * 구매자와 해당 매장 사장님만 읽을 수 있다(firestore.rules).
   */
  pickupCode: string;
  status: OrderStatus;

  // ── 조회 편의/권한용 비정규화 ──
  storeOwnerId: string;
  storeName: string;
  itemTitle: string;
  /** 대표 상품 주문 시점 단가 */
  unitPrice: Won;
  customerName: string;

  // ── 결제 (PortOne) — 문서 ID == paymentId == checkout ID ──
  paymentId: string;
  paymentMethod: PaymentMethod;
  paidAt: Timestamp;
  pickupEndTime: Timestamp;
  acceptedAt?: Timestamp;
  pickedUpAt?: Timestamp;
  canceledAt?: Timestamp;
  canceledBy?: 'customer' | 'seller';
  /** 취소된 주문의 환불 진행 상태 (Cloud Function 이 PortOne 취소 API 호출 후 갱신) */
  refundStatus?: RefundStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── checkouts/{paymentId} ── (Cloud Functions 만 쓰기, 구매자만 읽기)
/**
 * 결제 전에 서버가 확정한 장바구니·금액. PortOne 결제 금액을 이 값과 대조한다.
 * pending → completed(주문 생성) | failed(검증 실패/재고 부족 → 환불)
 */
export interface Checkout {
  paymentId: string;
  customerId: string;
  customerName: string;
  storeId: string;
  storeOwnerId: string;
  storeName: string;
  lines: OrderLine[];
  totalPrice: Won;
  orderName: string;
  paymentMethod: PaymentMethod;
  status: 'pending' | 'completed' | 'failed';
  failureReason?: string;
  refundStatus?: RefundStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
