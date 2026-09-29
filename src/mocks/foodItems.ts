import { Timestamp } from 'firebase/firestore';
import type { FoodItem } from '../types/models';
import type { Coords } from '../types/map';

interface MockDef {
  id: string;
  storeName: string;
  title: string;
  originalPrice: number;
  discountPrice: number;
  stock: number;
  /** 지금부터 픽업 마감까지 (분) */
  endInMin: number;
  /** 기준 위치로부터의 오프셋 (도). 0.001° ≈ 100m */
  dLat: number;
  dLng: number;
  status?: FoodItem['status'];
}

const DEFS: MockDef[] = [
  { id: 'm1', storeName: '골목 베이커리', title: '오늘의 빵 랜덤박스', originalPrice: 15000, discountPrice: 5900, stock: 3, endInMin: 45, dLat: 0.0018, dLng: 0.0012 },
  { id: 'm2', storeName: '초밥명가', title: '모듬초밥 10pcs', originalPrice: 18000, discountPrice: 9900, stock: 5, endInMin: 95, dLat: -0.0021, dLng: 0.0026 },
  { id: 'm3', storeName: '카페 온도', title: '크로플 + 아메리카노 세트', originalPrice: 9800, discountPrice: 4900, stock: 1, endInMin: 25, dLat: 0.0006, dLng: -0.0022 },
  { id: 'm4', storeName: '샐러드공방', title: '닭가슴살 샐러드', originalPrice: 8900, discountPrice: 4500, stock: 8, endInMin: 180, dLat: -0.0035, dLng: -0.0011 },
  { id: 'm5', storeName: '엄마손 반찬', title: '반찬 3종 세트', originalPrice: 12000, discountPrice: 6000, stock: 4, endInMin: 130, dLat: 0.0031, dLng: -0.003 },
  { id: 'm6', storeName: '동네 치킨', title: '양념반 후라이드반', originalPrice: 21000, discountPrice: 12900, stock: 2, endInMin: 60, dLat: -0.0009, dLng: 0.0041 },
  // 화면에 노출되면 안 되는 항목들 (필터 동작 확인용)
  { id: 'm7', storeName: '품절 도시락', title: '품절된 도시락', originalPrice: 7000, discountPrice: 3500, stock: 0, endInMin: 60, dLat: 0.002, dLng: 0.004, status: 'sold_out' },
  { id: 'm8', storeName: '마감 지난 빵집', title: '마감 지난 케이크', originalPrice: 30000, discountPrice: 15000, stock: 2, endInMin: -10, dLat: -0.002, dLng: -0.004 },
];

/** 기준 위치 주변에 배치된 Mock 마감 할인 상품 목록 */
export function buildMockFoodItems(center: Coords, nowMs = Date.now()): FoodItem[] {
  const now = Timestamp.fromMillis(nowMs);
  return DEFS.map((d) => ({
    itemId: d.id,
    storeId: `store_${d.id}`,
    ownerId: `owner_${d.id}`,
    storeName: d.storeName,
    title: d.title,
    originalPrice: d.originalPrice,
    discountPrice: d.discountPrice,
    stock: d.stock,
    pickupEndTime: Timestamp.fromMillis(nowMs + d.endInMin * 60_000),
    status: d.status ?? 'selling',
    latitude: center.latitude + d.dLat,
    longitude: center.longitude + d.dLng,
    geohash: '',
    isAddOn: false,
    createdAt: now,
    updatedAt: now,
  }));
}
