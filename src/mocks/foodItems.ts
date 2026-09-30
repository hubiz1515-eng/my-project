import { Timestamp } from 'firebase/firestore';
import type { FoodItem } from '../types/models';
import type { Coords } from '../types/map';

export interface MockStore {
  storeId: string;
  ownerId: string;
  storeName: string;
  /** 기준 위치로부터의 오프셋 (도). 0.001° ≈ 100m */
  dLat: number;
  dLng: number;
}

const store = (key: string, storeName: string, dLat: number, dLng: number): MockStore => ({
  storeId: `store_${key}`,
  ownerId: `owner_${key}`,
  storeName,
  dLat,
  dLng,
});

/** 사장님 모드에서 전환 가능한 Mock 매장들 (첫 번째가 기본) */
export const MOCK_STORES: MockStore[] = [
  store('bakery', '골목 베이커리', 0.0018, 0.0012),
  store('sushi', '초밥명가', -0.0021, 0.0026),
  store('cafe', '카페 온도', 0.0006, -0.0022),
  store('salad', '샐러드공방', -0.0035, -0.0011),
  store('banchan', '엄마손 반찬', 0.0031, -0.003),
  store('chicken', '동네 치킨', -0.0009, 0.0041),
];

interface MockDef {
  id: string;
  store: MockStore;
  title: string;
  originalPrice: number;
  discountPrice: number;
  stock: number;
  /** 지금부터 픽업 마감까지 (분) */
  endInMin: number;
  status?: FoodItem['status'];
}

const [bakery, sushi, cafe, salad, banchan, chicken] = MOCK_STORES;
const dosirak = store('dosirak', '품절 도시락', 0.002, 0.004);
const cake = store('cake', '마감 지난 빵집', -0.002, -0.004);

const DEFS: MockDef[] = [
  { id: 'm1', store: bakery, title: '오늘의 빵 랜덤박스', originalPrice: 15000, discountPrice: 5900, stock: 3, endInMin: 45 },
  { id: 'm1b', store: bakery, title: '소금빵 2개', originalPrice: 7000, discountPrice: 3500, stock: 4, endInMin: 90, status: 'paused' },
  { id: 'm1c', store: bakery, title: '생크림 케이크 조각', originalPrice: 6500, discountPrice: 3000, stock: 0, endInMin: 60, status: 'sold_out' },
  { id: 'm1d', store: bakery, title: '우유 식빵', originalPrice: 5000, discountPrice: 2500, stock: 5, endInMin: 120 },
  { id: 'm2', store: sushi, title: '모듬초밥 10pcs', originalPrice: 18000, discountPrice: 9900, stock: 5, endInMin: 95 },
  { id: 'm2b', store: sushi, title: '미소된장국', originalPrice: 3000, discountPrice: 1000, stock: 10, endInMin: 95 },
  { id: 'm3', store: cafe, title: '크로플 + 아메리카노 세트', originalPrice: 9800, discountPrice: 4900, stock: 1, endInMin: 25 },
  { id: 'm4', store: salad, title: '닭가슴살 샐러드', originalPrice: 8900, discountPrice: 4500, stock: 8, endInMin: 180 },
  { id: 'm5', store: banchan, title: '반찬 3종 세트', originalPrice: 12000, discountPrice: 6000, stock: 4, endInMin: 130 },
  { id: 'm6', store: chicken, title: '양념반 후라이드반', originalPrice: 21000, discountPrice: 12900, stock: 2, endInMin: 60 },
  // 소비자 화면에 노출되면 안 되는 항목들 (필터 동작 확인용)
  { id: 'm7', store: dosirak, title: '품절된 도시락', originalPrice: 7000, discountPrice: 3500, stock: 0, endInMin: 60, status: 'sold_out' },
  { id: 'm8', store: cake, title: '마감 지난 케이크', originalPrice: 30000, discountPrice: 15000, stock: 2, endInMin: -10 },
];

/** 기준 위치 주변에 배치된 Mock 마감 할인 상품 목록 */
export function buildMockFoodItems(center: Coords, nowMs = Date.now()): FoodItem[] {
  const now = Timestamp.fromMillis(nowMs);
  return DEFS.map((d) => ({
    itemId: d.id,
    storeId: d.store.storeId,
    ownerId: d.store.ownerId,
    storeName: d.store.storeName,
    title: d.title,
    originalPrice: d.originalPrice,
    discountPrice: d.discountPrice,
    stock: d.stock,
    pickupEndTime: Timestamp.fromMillis(nowMs + d.endInMin * 60_000),
    status: d.status ?? 'selling',
    latitude: center.latitude + d.store.dLat,
    longitude: center.longitude + d.store.dLng,
    geohash: '',
    isAddOn: false,
    createdAt: now,
    updatedAt: now,
  }));
}
