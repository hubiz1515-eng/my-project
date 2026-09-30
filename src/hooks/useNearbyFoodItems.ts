import { subscribeNearbyFoodItems } from '../services/foodItems';
import type { Coords } from '../types/map';
import type { FoodItem } from '../types/models';
import { useLiveQuery } from './useLiveQuery';

/** 내 주변 판매 중 상품 실시간 구독 */
export function useNearbyFoodItems(center: Coords, enabled: boolean) {
  const { latitude, longitude } = center;
  const { data, loading, error } = useLiveQuery<FoodItem[]>(
    enabled ? (cb, onError) => subscribeNearbyFoodItems({ latitude, longitude }, cb, onError) : null,
    [enabled, latitude, longitude],
    [],
  );
  return { items: data, loading, error };
}
