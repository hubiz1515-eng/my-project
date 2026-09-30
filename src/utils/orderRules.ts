import type { FoodItem, Order, OrderLine, OrderStatus, Won } from '../types/models';

/**
 * 주문 규칙 (순수 함수). Mock 에서는 클라이언트가 실행하지만,
 * 운영에서는 Cloud Function(createOrder / updateOrderStatus / confirmPickup)이 같은 규칙으로 실행한다.
 */

export interface CartLine {
  itemId: string;
  quantity: number;
}

export interface PricedCart {
  storeId: string;
  main: OrderLine;
  addOns: OrderLine[];
  total: Won;
  pickupEndMs: number;
}

export const isOrderable = (i: FoodItem, nowMs: number) =>
  i.status === 'selling' && i.stock > 0 && i.pickupEndTime.toMillis() > nowMs;

/** 장바구니 검증 + 서버 기준 금액 계산 */
export function priceCart(
  items: readonly FoodItem[],
  main: CartLine,
  addOns: CartLine[],
  nowMs: number,
): PricedCart | { error: string } {
  const lines = [main, ...addOns.filter((l) => l.quantity > 0)];
  const priced: OrderLine[] = [];
  let storeId: string | null = null;
  let pickupEndMs = Infinity;

  for (const line of lines) {
    const item = items.find((i) => i.itemId === line.itemId);
    if (!item) return { error: '상품을 찾을 수 없어요.' };
    if (!Number.isInteger(line.quantity) || line.quantity < 1) return { error: '수량을 확인해 주세요.' };
    if (!isOrderable(item, nowMs)) return { error: `'${item.title}' 은(는) 지금 주문할 수 없어요.` };
    if (item.stock < line.quantity) return { error: `'${item.title}' 재고가 ${item.stock}개 남았어요.` };
    if (storeId && item.storeId !== storeId) return { error: '한 매장의 상품만 함께 주문할 수 있어요.' };
    if (priced.some((p) => p.itemId === item.itemId)) return { error: '같은 상품이 중복됐어요.' };
    storeId = item.storeId;
    pickupEndMs = Math.min(pickupEndMs, item.pickupEndTime.toMillis());
    priced.push({ itemId: item.itemId, title: item.title, unitPrice: item.discountPrice, quantity: line.quantity });
  }

  const total = priced.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  return { storeId: storeId!, main: priced[0], addOns: priced.slice(1), total, pickupEndMs };
}

export type OrderAction = 'accept' | 'reject' | 'customer_cancel' | 'pickup';

const ALLOWED_FROM: Record<OrderAction, OrderStatus[]> = {
  accept: ['paid'],
  reject: ['paid', 'accepted'],
  customer_cancel: ['paid'], // 사장님이 수락한 뒤에는 고객이 임의 취소 불가
  pickup: ['paid', 'accepted'], // 수락 전에 손님이 먼저 와도 코드가 맞으면 바로 픽업 처리
};

const RESULT: Record<OrderAction, OrderStatus> = {
  accept: 'accepted',
  reject: 'canceled',
  customer_cancel: 'canceled',
  pickup: 'picked_up',
};

export function nextOrderStatus(current: OrderStatus, action: OrderAction): OrderStatus | { error: string } {
  if (!ALLOWED_FROM[action].includes(current)) {
    return { error: current === 'canceled' ? '이미 취소된 주문이에요.' : current === 'picked_up' ? '이미 픽업 완료된 주문이에요.' : '지금 상태에서는 할 수 없어요.' };
  }
  return RESULT[action];
}

export const isActiveOrder = (o: Pick<Order, 'status'>) => o.status === 'paid' || o.status === 'accepted';

/** 활성 주문과 겹치지 않는 6자리 픽업 코드 */
export function generatePickupCode(taken: Set<string>): string {
  for (;;) {
    const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
    if (!taken.has(code)) return code;
  }
}

/** 대표 상품 + 추가 메뉴를 한 목록으로 */
export function orderLines(o: Order): OrderLine[] {
  return [{ itemId: o.itemId, title: o.itemTitle, unitPrice: o.unitPrice, quantity: o.quantity }, ...o.addOns];
}

export function orderSummary(o: Order): string {
  const extra = o.addOns.length;
  return `${o.itemTitle} ×${o.quantity}${extra > 0 ? ` 외 ${extra}건` : ''}`;
}
