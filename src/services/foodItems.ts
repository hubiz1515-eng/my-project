import type { Coords } from '../types/map';
import type { FoodItem } from '../types/models';
import { buildMockFoodItems } from '../mocks/foodItems';

/**
 * 내 주변 마감 할인 상품 조회.
 * TODO(Firebase 연동): food_items where status=='selling' + geohash 범위 쿼리로 교체.
 *   화면 코드는 이 함수의 시그니처만 의존하므로 구현만 바꾸면 된다.
 */
export async function fetchNearbyFoodItems(center: Coords): Promise<FoodItem[]> {
  await new Promise((r) => setTimeout(r, 400)); // 네트워크 지연 흉내
  return buildMockFoodItems(center);
}
