import {
  doc,
  endAt,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAt,
  Timestamp,
  where,
} from 'firebase/firestore';
import { distanceBetween, geohashQueryBounds } from 'geofire-common';
import { foodItemDoc, foodItemsCol } from '../config/collections';
import { db } from '../config/firebaseConfig';
import type { Coords } from '../types/map';
import type { FoodItem, FoodItemStatus, Store } from '../types/models';
import {
  applyStatusAction,
  applyStockDelta,
  type NewItemInput,
  type StatusAction,
} from '../utils/foodItemRules';
import type { ErrorHandler, Unsubscribe } from './types';

/** 소비자 화면 범위: 내 동네(기본) / 서울 전체 */
export const NEARBY_RADIUS_M = 3000;
export const SEOUL_CENTER = { latitude: 37.5665, longitude: 126.978 } as const; // 서울시청
export const SEOUL_RADIUS_M = 22000; // 서울시 전역을 덮는 반경

/**
 * 소비자: 반경 내 판매 중 상품 실시간 구독 (기본 3km, 서울 전체 보기는 SEOUL_RADIUS_M).
 * geohash 범위 쿼리 여러 개를 합친 뒤 실제 거리로 한 번 더 거른다.
 * (마감 시간·재고 필터는 화면에서 — Firestore 는 서로 다른 필드 범위 조건을 함께 못 씀)
 */
export function subscribeNearbyFoodItems(
  center: Coords,
  onChange: (items: FoodItem[]) => void,
  onError?: ErrorHandler,
  radiusM: number = NEARBY_RADIUS_M,
): Unsubscribe {
  const origin: [number, number] = [center.latitude, center.longitude];
  const bounds = geohashQueryBounds(origin, radiusM);
  const parts = new Map<number, FoodItem[]>();

  const emit = () => {
    if (parts.size < bounds.length) return; // 모든 범위의 첫 결과가 올 때까지 대기
    const byId = new Map<string, FoodItem>();
    parts.forEach((list) => list.forEach((i) => byId.set(i.itemId, i)));
    onChange(
      [...byId.values()].filter((i) => distanceBetween([i.latitude, i.longitude], origin) * 1000 <= radiusM),
    );
  };

  const unsubs = bounds.map(([start, end], idx) =>
    onSnapshot(
      query(foodItemsCol, where('status', '==', 'selling'), orderBy('geohash'), startAt(start), endAt(end)),
      (snap) => {
        parts.set(idx, snap.docs.map((d) => d.data()));
        emit();
      },
      onError,
    ),
  );
  return () => unsubs.forEach((u) => u());
}

/** 상품 1개 (상태와 무관) */
export function subscribeFoodItem(itemId: string, onChange: (item: FoodItem | null) => void, onError?: ErrorHandler): Unsubscribe {
  return onSnapshot(foodItemDoc(itemId), (snap) => onChange(snap.exists() ? snap.data() : null), onError);
}

/** 매장의 전체 상품 (사장님 관리 화면, 소비자 '함께 담기' 후보) */
export function subscribeStoreFoodItems(storeId: string, onChange: (items: FoodItem[]) => void, onError?: ErrorHandler): Unsubscribe {
  return onSnapshot(
    query(foodItemsCol, where('storeId', '==', storeId)),
    (snap) => onChange(snap.docs.map((d) => d.data())),
    onError,
  );
}

export async function createFoodItem(store: Store, input: NewItemInput): Promise<string> {
  const ref = doc(foodItemsCol);
  await setDoc(ref, {
    itemId: ref.id,
    storeId: store.storeId,
    ownerId: store.ownerId,
    storeName: store.storeName,
    latitude: store.latitude,
    longitude: store.longitude,
    geohash: store.geohash,
    title: input.title.trim(),
    originalPrice: input.originalPrice,
    discountPrice: input.discountPrice,
    stock: input.stock,
    pickupEndTime: Timestamp.fromMillis(input.pickupEndMs),
    status: 'selling',
    isAddOn: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** 재고 ±N — 동시에 주문이 들어와도 안전하도록 트랜잭션 */
export async function changeStock(itemId: string, delta: number): Promise<void> {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(foodItemDoc(itemId));
    if (!snap.exists()) throw new Error('상품을 찾을 수 없어요.');
    tx.update(snap.ref, { ...applyStockDelta(snap.data(), delta), updatedAt: serverTimestamp() });
  });
}

export async function setItemStatus(itemId: string, action: StatusAction): Promise<FoodItemStatus> {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(foodItemDoc(itemId));
    if (!snap.exists()) throw new Error('상품을 찾을 수 없어요.');
    const result = applyStatusAction(snap.data(), action);
    if ('error' in result) throw new Error(result.error);
    tx.update(snap.ref, { ...result, updatedAt: serverTimestamp() });
    return result.status;
  });
}
