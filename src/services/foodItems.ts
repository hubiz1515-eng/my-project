import { Timestamp } from 'firebase/firestore';
import type { Coords } from '../types/map';
import type { FoodItem, FoodItemStatus } from '../types/models';
import {
  applyStatusAction,
  applyStockDelta,
  type NewItemInput,
  type StatusAction,
} from '../utils/foodItemRules';
import { ensureSeeded, mockBase, mockDb, type Unsubscribe } from './mockDb';
import { getSellerStore } from './session';

/**
 * food_items 데이터 계층 (현재: 메모리 Mock, 구독 기반).
 * 소비자/사장님 화면이 같은 저장소를 구독하므로 한쪽의 변경이 다른 쪽에 즉시 반영된다.
 *
 * TODO(Firebase 연동): 아래 함수들의 구현만 교체하면 된다.
 *   - subscribe*  → onSnapshot(query(foodItemsCol, ...))
 *   - create/changeStock/setStatus → addDoc / runTransaction(applyStockDelta) / updateDoc
 */
export type { Unsubscribe };
type Listener = (items: FoodItem[]) => void;

let seq = 0;

function find(itemId: string): FoodItem {
  const item = mockDb.foodItems.get(itemId);
  if (!item) throw new Error('상품을 찾을 수 없어요.');
  return item;
}

function update(itemId: string, patch: Partial<FoodItem>) {
  mockDb.foodItems.patch(itemId, { ...patch, updatedAt: Timestamp.now() });
}

/** 소비자: 내 주변 상품 (필터링은 화면에서 수행) */
export function subscribeNearbyFoodItems(center: Coords, onChange: Listener): Unsubscribe {
  ensureSeeded(center);
  return mockDb.foodItems.subscribe(onChange);
}

/** 사장님: 내 매장 상품 */
export function subscribeStoreFoodItems(storeId: string, onChange: Listener): Unsubscribe {
  ensureSeeded();
  return mockDb.foodItems.subscribe((all) => onChange(all.filter((i) => i.storeId === storeId)));
}

export async function createFoodItem(input: NewItemInput): Promise<FoodItem> {
  ensureSeeded();
  const now = Timestamp.now();
  const store = getSellerStore();
  const base = mockBase();
  const item: FoodItem = {
    itemId: `new_${Date.now()}_${seq++}`,
    storeId: store.storeId,
    ownerId: store.ownerId,
    storeName: store.storeName,
    title: input.title.trim(),
    originalPrice: input.originalPrice,
    discountPrice: input.discountPrice,
    stock: input.stock,
    pickupEndTime: Timestamp.fromMillis(input.pickupEndMs),
    status: 'selling',
    latitude: base.latitude + store.dLat,
    longitude: base.longitude + store.dLng,
    geohash: '',
    isAddOn: false,
    createdAt: now,
    updatedAt: now,
  };
  mockDb.foodItems.insert(item);
  return item;
}

export async function changeStock(itemId: string, delta: number): Promise<void> {
  update(itemId, applyStockDelta(find(itemId), delta));
}

export async function setItemStatus(itemId: string, action: StatusAction): Promise<FoodItemStatus> {
  const result = applyStatusAction(find(itemId), action);
  if ('error' in result) throw new Error(result.error);
  update(itemId, result);
  return result.status;
}
