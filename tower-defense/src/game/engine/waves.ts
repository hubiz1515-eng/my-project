import { BOSS_WAVE_TIME, ENEMY_BASE_SPEED, WAVE_TIME } from './config';
import { BOSS_BY_STAGE, type EnemyKind } from './enemies';

export type WaveRole = 'standard' | 'swarm' | 'fast' | 'tank' | 'elite' | 'boss';

export interface WavePlan {
  wave: number;
  stage: number;
  role: WaveRole;
  duration: number;
  /** 일반 몬스터 종류와 수 */
  kind: EnemyKind;
  count: number;
  /** 무리 단위로 몰려 나온다: 무리 크기 / 무리 사이 간격 / 무리 안 간격(초) */
  packSize: number;
  packGap: number;
  spacing: number;
  hp: number;
  speed: number;
  weight: number;
  gold: number;
  /** 엘리트/보스 */
  special?: {
    kind: EnemyKind;
    hp: number;
    speed: number;
    weight: number;
    gold: number;
    gems: number;
    boss: boolean;
  };
}

interface StageKinds {
  standard: EnemyKind;
  swarm: EnemyKind;
  fast: EnemyKind;
  tank: EnemyKind;
}

const STAGE_KINDS: StageKinds[] = [
  { standard: 'slime', swarm: 'goblin', fast: 'bat', tank: 'mushroom' },
  { standard: 'goblin', swarm: 'skeleton', fast: 'wolf', tank: 'orc' },
  { standard: 'skeleton', swarm: 'ghost', fast: 'bat', tank: 'orc' },
  { standard: 'ghost', swarm: 'imp', fast: 'wolf', tank: 'orc' },
  { standard: 'imp', swarm: 'skeleton', fast: 'wolf', tank: 'orc' },
];

/** 한 스테이지(10웨이브) 안에서의 역할 순서 */
const ROLE_CYCLE: WaveRole[] = ['standard', 'swarm', 'standard', 'fast', 'elite', 'tank', 'swarm', 'fast', 'tank', 'boss'];

export const HP_GROWTH = 1.158;
export const BASE_HP = 60;
/** 일반 몬스터 체력 보정 (엘리트/보스는 baseHp 그대로) */
export const MOB_HP_SCALE = 1.55;

/** 웨이브 w 의 "기준 체력" */
export function baseHp(w: number): number {
  return BASE_HP * Math.pow(HP_GROWTH, w - 1) * (1 + w * 0.02);
}

export function stageOf(w: number): number {
  return Math.min(STAGE_KINDS.length - 1, Math.floor((w - 1) / 10));
}

export function isBossWave(w: number): boolean {
  return w % 10 === 0;
}

export function isEliteWave(w: number): boolean {
  return w % 10 === 5;
}

export function planWave(w: number): WavePlan {
  const stage = stageOf(w);
  const role = ROLE_CYCLE[(w - 1) % 10];
  const kinds = STAGE_KINDS[stage];
  const hp0 = baseHp(w);
  const n0 = 22 + w * 0.55;
  const gold = 1 + Math.floor(w / 9);
  const duration = role === 'boss' ? BOSS_WAVE_TIME : WAVE_TIME;

  let kind: EnemyKind = kinds.standard;
  let count = n0;
  let hp = hp0 * MOB_HP_SCALE;
  let speed = ENEMY_BASE_SPEED;
  let special: WavePlan['special'];

  switch (role) {
    case 'swarm':
      kind = kinds.swarm;
      count = n0 * 1.7;
      hp = hp0 * MOB_HP_SCALE * 0.5;
      speed *= 1.05;
      break;
    case 'fast':
      kind = kinds.fast;
      count = n0 * 0.9;
      hp = hp0 * MOB_HP_SCALE * 0.7;
      speed *= 1.55;
      break;
    case 'tank':
      kind = kinds.tank;
      count = n0 * 0.55;
      hp = hp0 * MOB_HP_SCALE * 2.3;
      speed *= 0.72;
      break;
    case 'elite':
      count = n0 * 0.7;
      special = {
        kind: kinds.tank,
        hp: hp0 * 16,
        speed: speed * 0.8,
        weight: 4,
        gold: gold * 12,
        gems: 2,
        boss: false,
      };
      break;
    case 'boss':
      count = n0 * 0.5;
      special = {
        kind: BOSS_BY_STAGE[Math.min(BOSS_BY_STAGE.length - 1, Math.floor(w / 10) - 1)],
        hp: hp0 * Math.max(26, 80 - (w - 10) * 1.15),
        speed: speed * 0.62,
        weight: 10,
        gold: gold * 40,
        gems: 5 + Math.floor(w / 10) * 2,
        boss: true,
      };
      break;
    default:
      break;
  }

  const c = Math.max(6, Math.round(count));
  const spacing = 0.3;
  const packSize = Math.max(4, Math.min(12, Math.round(c / 7)));
  const packs = Math.ceil(c / packSize);
  const window = duration * 0.78;
  const packGap = packs > 1 ? Math.max(spacing * packSize, (window - (packSize - 1) * spacing) / (packs - 1)) : 0;
  return {
    wave: w,
    stage,
    role,
    duration,
    kind,
    count: c,
    packSize,
    packGap,
    spacing,
    hp,
    speed,
    weight: 1,
    gold,
    special,
  };
}
