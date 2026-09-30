import { onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { geohashForLocation } from 'geofire-common';
import { storeDoc } from '../config/collections';
import type { Coords } from '../types/map';
import type { BusinessHours, Store } from '../types/models';
import type { ErrorHandler, Unsubscribe } from './types';

const day = { closed: false, open: '09:00', close: '22:00' };
export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  mon: day, tue: day, wed: day, thu: day, fri: day, sat: day, sun: day,
};

/** 매장 구독. 매장 문서 ID == 사장님 uid. 아직 없으면 null */
export function subscribeStore(ownerId: string, onChange: (s: Store | null) => void, onError?: ErrorHandler): Unsubscribe {
  return onSnapshot(storeDoc(ownerId), (snap) => onChange(snap.exists() ? snap.data() : null), onError);
}

export interface StoreInput extends Coords {
  storeName: string;
  address: string;
}

export function validateStore(s: StoreInput): string | null {
  if (!s.storeName.trim()) return '매장 이름을 입력해 주세요.';
  if (!s.address.trim()) return '매장 주소를 입력해 주세요.';
  if (!Number.isFinite(s.latitude) || !Number.isFinite(s.longitude)) return '매장 위치를 설정해 주세요.';
  return null;
}

export async function createStore(ownerId: string, s: StoreInput) {
  await setDoc(storeDoc(ownerId), {
    storeId: ownerId,
    ownerId,
    storeName: s.storeName.trim(),
    address: s.address.trim(),
    latitude: s.latitude,
    longitude: s.longitude,
    geohash: geohashForLocation([s.latitude, s.longitude]),
    businessHours: DEFAULT_BUSINESS_HOURS,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

const KAKAO_REST_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_KEY;
export const canGeocode = !!KAKAO_REST_KEY;

/** 카카오 로컬 API 로 주소 → 좌표. REST 키가 없으면 사용 불가 */
export async function geocodeAddress(query: string): Promise<(Coords & { address: string }) | null> {
  if (!KAKAO_REST_KEY) throw new Error('카카오 REST 키가 설정되지 않았어요.');
  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`,
    { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } },
  );
  if (!res.ok) throw new Error('주소 검색에 실패했어요.');
  const json = (await res.json()) as { documents: { x: string; y: string; address_name: string }[] };
  const first = json.documents[0];
  if (!first) return null;
  return { latitude: Number(first.y), longitude: Number(first.x), address: first.address_name };
}
