import { getSave } from '@/storage/save';

export type Sfx =
  | 'summon'
  | 'summonRare'
  | 'merge'
  | 'jackpot'
  | 'craft'
  | 'sell'
  | 'coin'
  | 'click'
  | 'error'
  | 'wave'
  | 'boss'
  | 'win'
  | 'lose'
  | 'freeze'
  | 'bomb'
  | 'tick'
  | 'spin'
  | 'hit';

export type Haptic = 'light' | 'medium' | 'heavy' | 'success' | 'warning';

type Handler = {
  sfx?: (name: Sfx, volume?: number) => void;
  haptic?: (kind: Haptic) => void;
};

let handler: Handler = {};

/** 오디오/햅틱 구현을 꽂아 넣는다 (실패해도 게임은 계속 진행) */
export function setFeedbackHandler(h: Handler) {
  handler = h;
}

export function sfx(name: Sfx, volume = 1) {
  if (!getSave().settings.sound) return;
  try {
    handler.sfx?.(name, volume);
  } catch {
    /* 소리는 없어도 게임은 계속된다 */
  }
}

export function haptic(kind: Haptic) {
  if (!getSave().settings.haptics) return;
  try {
    handler.haptic?.(kind);
  } catch {
    /* 무시 */
  }
}
