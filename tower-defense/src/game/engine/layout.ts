import { COLS } from './config';

/** 슬롯 인덱스 → 칸 좌표(중심). 슬롯 판은 길 안쪽(1칸 안)에서 시작한다. */
export function slotCol(slot: number): number {
  return slot % COLS;
}

export function slotRow(slot: number): number {
  return Math.floor(slot / COLS);
}

export function slotCenter(slot: number): { x: number; y: number } {
  return { x: 1 + slotCol(slot) + 0.5, y: 1 + slotRow(slot) + 0.5 };
}

/** 같은 슬롯에 쌓인 유닛의 배치 오프셋(칸 단위). count 마리 중 index 번째 */
const FORMATIONS: readonly (readonly (readonly [number, number])[])[] = [
  [],
  [[0, 0.06]],
  [
    [-0.2, 0.08],
    [0.2, 0.08],
  ],
  [
    [-0.24, 0.14],
    [0.24, 0.14],
    [0, -0.1],
  ],
];

export function unitOffset(count: number, index: number): readonly [number, number] {
  return FORMATIONS[Math.min(3, Math.max(1, count))][index] ?? [0, 0];
}
