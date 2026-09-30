import { useEffect, useState } from 'react';
import { subscribeStoreFoodItems } from '../services/foodItems';
import type { FoodItem } from '../types/models';

export function useStoreFoodItems(storeId: string) {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    return subscribeStoreFoodItems(storeId, (next) => {
      setItems(next);
      setLoading(false);
    });
  }, [storeId]);

  return { items, loading };
}
