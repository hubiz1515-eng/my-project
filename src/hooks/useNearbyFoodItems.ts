import { useCallback, useEffect, useState } from 'react';
import { fetchNearbyFoodItems } from '../services/foodItems';
import type { Coords } from '../types/map';
import type { FoodItem } from '../types/models';

export function useNearbyFoodItems(center: Coords, enabled: boolean) {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { latitude, longitude } = center;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchNearbyFoodItems({ latitude, longitude }));
    } catch {
      setError('마감 할인 정보를 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude]);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  return { items, loading, error, refetch: load };
}
