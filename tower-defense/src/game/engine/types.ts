import type { EnemyKind } from './enemies';
import type { Grade, ShotKind, UnitId } from './units';

export interface Unit {
  uid: number;
  id: UnitId;
  /** 다음 공격까지 남은 시간 */
  cd: number;
  /** 주기 효과(시간 정지 등)까지 남은 시간 */
  pulse: number;
  /** 마지막 공격 시각 / 조준 방향 — 공격 모션용 */
  shotAt: number;
  aim: number;
  born: number;
}

export interface Slot {
  units: Unit[];
}

export interface Enemy {
  uid: number;
  kind: EnemyKind;
  boss: boolean;
  elite: boolean;
  /** 소환된 웨이브 */
  wave: number;
  hp: number;
  maxHp: number;
  /** 이미 날아가고 있는 투사체가 줄 예정 피해(과잉 사격 방지) */
  incoming: number;
  /** 지금까지 달린 총 거리(바퀴 수 포함) */
  dist: number;
  speed: number;
  weight: number;
  gold: number;
  gems: number;
  size: number;
  slow: number;
  slowUntil: number;
  stunUntil: number;
  freezeUntil: number;
  poisonDps: number;
  poisonUntil: number;
  x: number;
  y: number;
  angle: number;
  hitAt: number;
  born: number;
  alive: boolean;
}

export interface Projectile {
  uid: number;
  unitId: UnitId;
  shot: ShotKind;
  sx: number;
  sy: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  targetUid: number;
  age: number;
  dur: number;
  dmg: number;
  crit: boolean;
  reserve: number;
}

export type GameEvent =
  | { t: 'summon'; slot: number; id: UnitId; grade: Grade; forced: boolean }
  | { t: 'merge'; slot: number; from: UnitId; to: UnitId; jackpot: boolean }
  | { t: 'craft'; slot: number; id: UnitId }
  | { t: 'move'; from: number; to: number; swap: boolean }
  | { t: 'sell'; slot: number; id: UnitId; gold: number }
  | { t: 'shoot'; slot: number; index: number; id: UnitId; shot: ShotKind }
  | { t: 'hit'; uid: number; x: number; y: number; dmg: number; crit: boolean; shot: ShotKind | null }
  | { t: 'chain'; shot: ShotKind; pts: number[] }
  | { t: 'blast'; x: number; y: number; r: number; shot: ShotKind }
  | { t: 'kill'; uid: number; kind: EnemyKind; x: number; y: number; angle: number; size: number; boss: boolean; elite: boolean; gold: number }
  | { t: 'gold'; x: number; y: number; amount: number }
  | { t: 'wave'; wave: number; boss: boolean; elite: boolean }
  | { t: 'freeze'; dur: number }
  | { t: 'power'; dur: number }
  | { t: 'bomb' }
  | { t: 'ticket' }
  | { t: 'luck'; level: number }
  | { t: 'upgrade'; grade: Grade; level: number }
  | { t: 'warn'; on: boolean }
  | { t: 'over'; won: boolean };

export type Fail =
  | 'over'
  | 'gold'
  | 'gems'
  | 'full'
  | 'need3'
  | 'max'
  | 'missing'
  | 'empty'
  | 'busy'
  | 'none';

export type Res<T = object> = ({ ok: true } & T) | { ok: false; reason: Fail };
