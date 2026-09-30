import { Timestamp } from 'firebase/firestore';
import { DEFAULT_LOCATION } from '../constants/theme';
import { buildMockFoodItems, MOCK_MY_STORE } from '../mocks/foodItems';
import type { Coords } from '../types/map';
import type { FoodItem, FoodItemStatus } from '../types/models';
import {
  applyStatusAction,
  applyStockDelta,
  type NewItemInput,
  type StatusAction,
} from '../utils/foodItemRules';

/**
 * food_items 데이터 계층 (현재: 메모리 Mock, 구독 기반).
 * 소비자/사장님 화면이 같은 저장소를 구독하므로 한쪽의 변경이 다른 쪽에 즉시 반영된다.
 *
 * TODO(Firebase 연동): 아래 함수들의 구현만 교체하면 된다.
 *   - subscribe*  → onSnapshot(query(foodItemsCol, ...))
 *   - create/changeStock/setStatus → addDoc / runTransaction(applyStockDelta) / updateDoc
 */

export type Unsubscribe = () => void;
type Listener = (items: FoodItem[]) => void;

let items: FoodItem[] | null = null;
let base: Coords = DEFAULT_LOCATION;
const listeners = new Set<Listener>();
let seq = 0;

/** 첫 호출 시 기준 위치 주변으로 Mock 데이터를 채운다. 이후 호출은 무시. */
function ensureSeeded(center?: Coords) {
  if (items) return;
  base = center ?? DEFAULT_LOCATION;
  items = buildMockFoodItems(base);
}

function emit() {
  const snapshot = [...(items ?? [])];
  listeners.forEach((l) => l(snapshot));
}

function subscribe(listener: Listener, center?: Coords): Unsubscribe {
  ensureSeeded(center);
  listeners.add(listener);
  // Firestore onSnapshot 처럼 비동기로 첫 스냅샷 전달
  const id = setTimeout(() => listener([...(items ?? [])]), 300);
  return () => {
    clearTimeout(id);
    listeners.delete(listener);
  };
}

function update(itemId: string, patch: Partial<FoodItem>) {
  items = (items ?? []).map((i) =>
    i.itemId === itemId ? { ...i, ...patch, updatedAt: Timestamp.now() } : i,
  );
  emit();
}

function find(itemId: string): FoodItem {
  const item = items?.find((i) => i.itemId === itemId);
  if (!item) throw new Error('상품을 찾을 수 없어요.');
  return item;
}

/** 소비자: 내 주변 상품 (필터링은 화면에서 수행) */
export function subscribeNearbyFoodItems(center: Coords, onChange: Listener): Unsubscribe {
  return subscribe(onChange, center);
}

/** 사장님: 내 매장 상품 */
export function subscribeStoreFoodItems(storeId: string, onChange: Listener): Unsubscribe {
  return subscribe((all) => onChange(all.filter((i) => i.storeId === storeId)));
}

/** 사장님이 현재 관리하는 매장 (인증 연동 전 Mock) */
export function getMyStore() {
  return MOCK_MY_STORE;
}

export async function createFoodItem(input: NewItemInput): Promise<FoodItem> {
  ensureSeeded();
  const now = Timestamp.now();
  const store = MOCK_MY_STORE;
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
  items = [item, ...(items ?? [])];
  emit();
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
