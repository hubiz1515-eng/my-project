import type { NewItemInput } from '../../utils/foodItemRules';

/** 빈 매장에서 테스트용으로 한 번에 등록하는 샘플 상품 */
export function sampleItems(nowMs: number): NewItemInput[] {
  const at = (min: number) => nowMs + min * 60_000;
  return [
    { title: '오늘의 빵 랜덤박스', originalPrice: 15000, discountPrice: 5900, stock: 3, pickupEndMs: at(90) },
    { title: '우유 식빵', originalPrice: 5000, discountPrice: 2500, stock: 5, pickupEndMs: at(120) },
    { title: '소금빵 2개', originalPrice: 7000, discountPrice: 3500, stock: 4, pickupEndMs: at(150) },
  ];
}
