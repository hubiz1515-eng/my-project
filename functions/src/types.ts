import type { Timestamp } from 'firebase-admin/firestore';
import type { CanceledBy, FoodItemStatus, OrderLine, OrderStatus, PaymentMethod, RefundStatus } from '../shared/types';

/** Firestore 문서 중 Functions 가 읽고 쓰는 필드 (앱 src/types/models.ts 와 동일한 스키마) */
export interface FoodItemDoc {
  itemId: string;
  storeId: string;
  ownerId: string;
  storeName: string;
  title: string;
  discountPrice: number;
  stock: number;
  status: FoodItemStatus;
  pickupEndTime: Timestamp;
}

export interface CheckoutDoc {
  paymentId: string;
  customerId: string;
  customerName: string;
  storeId: string;
  storeOwnerId: string;
  storeName: string;
  lines: OrderLine[];
  totalPrice: number;
  orderName: string;
  paymentMethod: PaymentMethod;
  status: 'pending' | 'completed' | 'failed';
  failureReason?: string;
  refundStatus?: RefundStatus;
}

export interface OrderDoc {
  orderId: string;
  customerId: string;
  customerName: string;
  storeId: string;
  storeOwnerId: string;
  storeName: string;
  itemId: string;
  itemTitle: string;
  unitPrice: number;
  quantity: number;
  addOns: OrderLine[];
  quantities: Record<string, number>;
  totalPrice: number;
  pickupCode: string;
  status: OrderStatus;
  paymentId: string;
  paymentMethod: PaymentMethod;
  pickupEndTime: Timestamp;
  canceledBy?: CanceledBy;
  refundStatus?: RefundStatus;
  /** 노쇼 부분/전액 환불 금액 (정책이 환불 없음이면 없음) */
  refundAmount?: number;
}
