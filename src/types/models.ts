import type { Timestamp } from 'firebase/firestore';

/** 금액은 모두 KRW 정수(원 단위). 소수/문자열 금지. */
export type Won = number;

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
export type FoodItemStatus = 'selling' | 'sold_out' | 'paused';

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
export type OrderStatus = 'paid' | 'picked_up' | 'canceled';

/** 주문 시점 스냅샷. 이후 사장님이 가격/이름을 바꿔도 주문 내역은 변하지 않는다. */
export interface OrderLine {
  itemId: string;
  title: string;
  unitPrice: Won;
  quantity: number;
}

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
  /** 6자리 숫자 핀코드. QR 에는 `orderId.pickupCode` 형태로 인코딩. */
  pickupCode: string;
  status: OrderStatus;

  // ── 조회 편의/권한용 비정규화 ──
  storeOwnerId: string;
  storeName: string;
  itemTitle: string;

  // ── 결제 (PortOne) ──
  paymentId: string;
  paidAt: Timestamp;
  pickupEndTime: Timestamp;
  pickedUpAt?: Timestamp;
  canceledAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
