import { useSyncExternalStore } from 'react';
import { MOCK_STORES, type MockStore } from '../mocks/foodItems';

/**
 * 로그인 연동 전 테스트용 세션.
 * TODO(Auth 연동): Firebase Auth uid + users/{uid}, stores where ownerId == uid 로 교체.
 */
export const MOCK_CUSTOMER = { uid: 'customer_me', name: '김픽업' } as const;

let sellerStoreId = MOCK_STORES[0].storeId;
const listeners = new Set<() => void>();

export function getSellerStore(): MockStore {
  return MOCK_STORES.find((s) => s.storeId === sellerStoreId) ?? MOCK_STORES[0];
}

/** 테스트용: 사장님 모드에서 관리할 매장 전환 */
export function setSellerStore(storeId: string) {
  if (storeId === sellerStoreId) return;
  sellerStoreId = storeId;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useSellerStore(): MockStore {
  return useSyncExternalStore(subscribe, getSellerStore, getSellerStore);
}
