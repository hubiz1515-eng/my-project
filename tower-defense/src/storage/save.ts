import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { UnitId } from '@/game/engine/units';

export interface Settings {
  sound: boolean;
  /** 배경음 */
  music: boolean;
  haptics: boolean;
  /** 데미지 숫자 표시 */
  numbers: boolean;
  /** 화면 흔들림 */
  shake: boolean;
}

export interface SaveData {
  bestWave: number;
  plays: number;
  wins: number;
  kills: number;
  bestHit: number;
  discovered: UnitId[];
  /** '게임 방법' 안내를 이미 봤는지 */
  seenHowTo: boolean;
  settings: Settings;
}

const KEY = 'luckyguardians:save:v1';

const DEFAULTS: SaveData = {
  bestWave: 0,
  plays: 0,
  wins: 0,
  kills: 0,
  bestHit: 0,
  discovered: ['squire', 'hunter', 'apprentice', 'peddler'],
  seenHowTo: false,
  settings: { sound: true, music: true, haptics: true, numbers: true, shake: true },
};

let data: SaveData = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** 저장된 데이터를 한 번 읽어 메모리에 올린다 (실패해도 기본값으로 계속) */
export async function loadSave(): Promise<SaveData> {
  if (loaded) return data;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      data = {
        ...DEFAULTS,
        ...parsed,
        settings: { ...DEFAULTS.settings, ...(parsed.settings ?? {}) },
        discovered: Array.from(new Set([...DEFAULTS.discovered, ...(parsed.discovered ?? [])])),
      };
    }
  } catch (e) {
    console.warn('저장 데이터를 읽지 못했습니다', e);
  }
  loaded = true;
  emit();
  return data;
}

export function getSave(): SaveData {
  return data;
}

export function updateSave(fn: (d: SaveData) => SaveData) {
  data = fn(data);
  emit();
  AsyncStorage.setItem(KEY, JSON.stringify(data)).catch((e) => console.warn('저장 실패', e));
}

export function subscribeSave(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useSave(): SaveData {
  return useSyncExternalStore(subscribeSave, getSave, getSave);
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  updateSave((d) => ({ ...d, settings: { ...d.settings, [key]: value } }));
}

/** 한 판이 끝났을 때 기록 갱신 */
export function recordRun(r: { wave: number; won: boolean; kills: number; bestHit: number; discovered: Iterable<UnitId> }) {
  updateSave((d) => ({
    ...d,
    bestWave: Math.max(d.bestWave, r.wave),
    plays: d.plays + 1,
    wins: d.wins + (r.won ? 1 : 0),
    kills: d.kills + r.kills,
    bestHit: Math.max(d.bestHit, Math.round(r.bestHit)),
    discovered: Array.from(new Set([...d.discovered, ...r.discovered])),
  }));
}

/** 판 도중에 새 유닛을 발견했을 때 즉시 저장 */
export function discover(ids: Iterable<UnitId>) {
  const add = Array.from(ids).filter((id) => !data.discovered.includes(id));
  if (add.length === 0) return;
  updateSave((d) => ({ ...d, discovered: [...d.discovered, ...add] }));
}

/** 기록 초기화 (설정은 유지) */
export function resetProgress() {
  updateSave((d) => ({ ...DEFAULTS, seenHowTo: true, settings: d.settings }));
}
