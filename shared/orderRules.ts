import type { CartItem, OrderLine, OrderStatus, Won } from './types';

/**
 * 주문 규칙 (순수 함수). 금액 계산·상태 전이는 Cloud Functions 가 이 규칙으로 최종 판단하고,
 * 앱은 같은 규칙으로 화면에 미리 보여준다.
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

export const MAX_LINE_QUANTITY = 99;
export const MAX_CART_LINES = 20;

export const isOrderable = (i: CartItem, nowMs: number) =>
  i.status === 'selling' && i.stock > 0 && i.pickupEndTime.toMillis() > nowMs;

/** 장바구니 검증 + 금액 계산 (서버가 최종 계산) */
export function priceCart(
  items: readonly CartItem[],
  main: CartLine,
  addOns: CartLine[],
  nowMs: number,
): PricedCart | { error: string } {
  const lines = [main, ...addOns.filter((l) => l.quantity > 0)];
  if (lines.length > MAX_CART_LINES) return { error: '한 번에 담을 수 있는 상품 수를 넘었어요.' };
  const priced: OrderLine[] = [];
  let storeId: string | null = null;
  let pickupEndMs = Infinity;

  for (const line of lines) {
    const item = items.find((i) => i.itemId === line.itemId);
    if (!item) return { error: '상품을 찾을 수 없어요.' };
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_LINE_QUANTITY) {
      return { error: '수량을 확인해 주세요.' };
    }
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

/** 결제 확정 시점 재고 확인 (가격은 결제 시점 스냅샷을 존중) */
export function checkStockForLines(items: readonly CartItem[], lines: OrderLine[], storeId: string, nowMs: number): string | null {
  for (const line of lines) {
    const item = items.find((i) => i.itemId === line.itemId);
    if (!item || item.storeId !== storeId) return '상품을 찾을 수 없어요.';
    if (!isOrderable(item, nowMs)) return `'${line.title}' 판매가 종료됐어요.`;
    if (item.stock < line.quantity) return `'${line.title}' 재고가 부족해요.`;
  }
  return null;
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
    return {
      error:
        current === 'canceled'
          ? '이미 취소된 주문이에요.'
          : current === 'picked_up'
            ? '이미 픽업 완료된 주문이에요.'
            : action === 'customer_cancel'
              ? '사장님이 이미 수락한 주문이라 취소할 수 없어요. 매장에 문의해 주세요.'
              : '지금 상태에서는 할 수 없어요.',
    };
  }
  return RESULT[action];
}

export const isActiveOrder = (o: { status: OrderStatus }) => o.status === 'paid' || o.status === 'accepted';

/** 6자리 픽업 코드 (taken 에 있는 코드는 피함) */
export function generatePickupCode(taken: Set<string>, random: () => number = Math.random): string {
  for (;;) {
    const code = String(Math.floor(random() * 1_000_000)).padStart(6, '0');
    if (!taken.has(code)) return code;
  }
}

interface OrderLike {
  itemId: string;
  itemTitle: string;
  unitPrice: Won;
  quantity: number;
  addOns: OrderLine[];
}

/** 대표 상품 + 추가 메뉴를 한 목록으로 */
export function orderLines(o: OrderLike): OrderLine[] {
  return [{ itemId: o.itemId, title: o.itemTitle, unitPrice: o.unitPrice, quantity: o.quantity }, ...o.addOns];
}

export function orderSummary(o: OrderLike): string {
  const extra = o.addOns.length;
  return `${o.itemTitle} ×${o.quantity}${extra > 0 ? ` 외 ${extra}건` : ''}`;
}

/** 결제창에 표시할 주문명 */
export function orderNameFor(main: OrderLine, addOnCount: number): string {
  return `${main.title}${addOnCount > 0 ? ` 외 ${addOnCount}건` : ''}`;
}
