import { DEFAULT_LOCATION } from '../constants/theme';
import { buildMockFoodItems } from '../mocks/foodItems';
import type { Coords } from '../types/map';
import type { FoodItem, Order } from '../types/models';

/**
 * 메모리 Mock DB. Firestore onSnapshot 과 비슷하게 동작한다:
 * 구독 시 비동기로 첫 스냅샷, 이후 변경마다 전체 스냅샷을 전달.
 * Firebase 연동 시 이 파일은 삭제하고 services/* 구현만 Firestore 로 교체한다.
 */

export type Unsubscribe = () => void;
type Listener<T> = (docs: T[]) => void;

const FIRST_SNAPSHOT_DELAY_MS = 300;

export class MockCollection<T> {
  private docs: T[] = [];
  private listeners = new Set<Listener<T>>();

  constructor(private readonly idOf: (doc: T) => string) {}

  get all(): readonly T[] {
    return this.docs;
  }

  get(id: string): T | undefined {
    return this.docs.find((d) => this.idOf(d) === id);
  }

  set(docs: T[]) {
    this.docs = docs;
    const snapshot = [...docs];
    this.listeners.forEach((l) => l(snapshot));
  }

  insert(doc: T) {
    this.set([doc, ...this.docs]);
  }

  patch(id: string, patch: Partial<T>) {
    this.set(this.docs.map((d) => (this.idOf(d) === id ? { ...d, ...patch } : d)));
  }

  subscribe(listener: Listener<T>): Unsubscribe {
    this.listeners.add(listener);
    const timer = setTimeout(() => listener([...this.docs]), FIRST_SNAPSHOT_DELAY_MS);
    return () => {
      clearTimeout(timer);
      this.listeners.delete(listener);
    };
  }
}

export const mockDb = {
  foodItems: new MockCollection<FoodItem>((d) => d.itemId),
  orders: new MockCollection<Order>((d) => d.orderId),
};

let seeded = false;
let base: Coords = DEFAULT_LOCATION;

/** 첫 호출 시 기준 위치 주변으로 Mock 상품을 채운다. 이후 호출은 무시. */
export function ensureSeeded(center?: Coords) {
  if (seeded) return;
  seeded = true;
  base = center ?? DEFAULT_LOCATION;
  mockDb.foodItems.set(buildMockFoodItems(base));
}

/** Mock 좌표 계산 기준점 */
export function mockBase(): Coords {
  return base;
}

export const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
