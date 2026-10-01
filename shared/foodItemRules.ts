import type { FoodItemStatus } from './types';

/**
 * 상품 재고/상태 규칙 (순수 함수). 앱과 Cloud Functions 가 같은 규칙을 쓴다.
 *
 * - 재고가 0 이 되면 'sold_out'.
 * - 'sold_out' 상품에 사장님이 직접 재고를 추가하면 'selling' 으로 복귀 (사장님의 명시적 조작).
 * - 'paused' 는 재고를 바꿔도 사장님이 재개하기 전까지 유지.
 * - 시스템이 스스로 판매를 재개/재등록하는 경로는 없음 (자동 재판매 금지).
 */
type StockState = { stock: number; status: FoodItemStatus };

export function applyStockDelta(item: StockState, delta: number): StockState {
  const stock = Math.max(0, item.stock + delta);
  let status: FoodItemStatus = item.status;
  if (stock === 0 && status === 'selling') status = 'sold_out';
  else if (stock > 0 && status === 'sold_out' && delta > 0) status = 'selling';
  return { stock, status };
}

/**
 * 주문 취소/거절로 재고를 되돌릴 때. 수량만 복구하고 상태는 그대로 둔다.
 * (품절 상태였다면 사장님이 직접 '판매 재개'를 눌러야 다시 노출 — 자동 재판매 금지)
 */
export function restoreStock(item: StockState, quantity: number): StockState {
  return { stock: item.stock + quantity, status: item.status };
}

export type StatusAction = 'pause' | 'resume' | 'sold_out';

export function applyStatusAction(item: StockState, action: StatusAction): StockState | { error: string } {
  switch (action) {
    case 'pause':
      return { stock: item.stock, status: 'paused' };
    case 'sold_out':
      // 품절 처리 = 남은 재고 0 (규칙: sold_out ⇔ stock 0)
      return { stock: 0, status: 'sold_out' };
    case 'resume':
      if (item.stock <= 0) return { error: '재고를 먼저 1개 이상 추가해 주세요.' };
      return { stock: item.stock, status: 'selling' };
  }
}

export interface NewItemInput {
  title: string;
  originalPrice: number;
  discountPrice: number;
  stock: number;
  pickupEndMs: number;
}

/** 등록 폼 검증. 문제가 없으면 null */
export function validateNewItem(input: NewItemInput, nowMs: number): string | null {
  if (!input.title.trim()) return '상품명을 입력해 주세요.';
  if (!Number.isInteger(input.originalPrice) || input.originalPrice <= 0) return '원가를 입력해 주세요.';
  if (!Number.isInteger(input.discountPrice) || input.discountPrice <= 0) return '할인가를 입력해 주세요.';
  if (input.discountPrice > input.originalPrice) return '할인가는 원가보다 클 수 없어요.';
  if (!Number.isInteger(input.stock) || input.stock < 1) return '수량은 1개 이상이어야 해요.';
  if (!Number.isFinite(input.pickupEndMs) || input.pickupEndMs <= nowMs) return '픽업 마감 시간을 확인해 주세요.';
  return null;
}
