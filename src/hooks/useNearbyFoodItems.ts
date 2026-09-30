import { useEffect, useState } from 'react';
import { subscribeNearbyFoodItems } from '../services/foodItems';
import type { Coords } from '../types/map';
import type { FoodItem } from '../types/models';

/** 내 주변 상품 실시간 구독. 사장님 화면의 변경이 즉시 반영된다. */
export function useNearbyFoodItems(center: Coords, enabled: boolean) {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { latitude, longitude } = center;

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    return subscribeNearbyFoodItems({ latitude, longitude }, (next) => {
      setItems(next);
      setLoading(false);
    });
  }, [enabled, latitude, longitude]);

  return { items, loading };
}
