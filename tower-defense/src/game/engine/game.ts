import {
  ENEMY_LIMIT,
  ENEMY_WARN,
  FINAL_WAVE,
  GRADE_LEVEL_BONUS,
  JACKPOT_CHANCE,
  LUCK_COSTS,
  MAX_GRADE_LEVEL,
  MAX_LUCK_LEVEL,
  MAX_STACK,
  PITY_MAX,
  PREP_TIME,
  SLOT_COUNT,
  START_GOLD,
  SUMMON_BASE_COST,
  SUMMON_COST_STEP,
  SUMMON_ODDS,
} from './config';
import { ENEMIES, type EnemyKind } from './enemies';
import { slotCenter, unitOffset } from './layout';
import { pointAt, type PathPoint } from './path';
import { Rng } from './rng';
import type { Enemy, Fail, GameEvent, Projectile, Res, Slot, Unit } from './types';
import { RECIPE_UNITS, SUMMONABLE, UNITS, type Grade, type ShotKind, type TargetMode, type UnitDef, type UnitId } from './units';
import { planWave, type WavePlan } from './waves';

export type RouletteId = 'gold' | 'gems' | 'free3' | 'legend' | 'power' | 'freeze' | 'bomb' | 'jackpot';

export interface RouletteSlice {
  id: RouletteId;
  label: string;
  /** 당첨 가중치 (칸 크기와는 무관하게 휠은 균등 분할) */
  weight: number;
}

/** 휠 위 시계 방향 순서 */
export const ROULETTE_SLICES: readonly RouletteSlice[] = [
  { id: 'gold', label: '골드 보너스', weight: 26 },
  { id: 'power', label: '공격력 +40%', weight: 15 },
  { id: 'free3', label: '무료 소환 ×3', weight: 12 },
  { id: 'bomb', label: '폭탄 투하', weight: 13 },
  { id: 'gems', label: '보석 +3', weight: 16 },
  { id: 'freeze', label: '시간 정지', weight: 13 },
  { id: 'legend', label: '전설 유닛', weight: 4 },
  { id: 'jackpot', label: '신화 유닛!', weight: 1 },
];

export const POWER_BUFF_PCT = 0.4;
export const POWER_BUFF_TIME = 30;
export const ROULETTE_FREEZE_TIME = 5;

/** 투사체 속도(칸/초). 0 이면 즉발 모션(고정 시간). */
const SHOT_SPEED: Record<ShotKind, number> = {
  slash: 0,
  arrow: 17,
  orb: 11,
  coin: 12,
  ice: 12,
  dart: 15,
  bomb: 8,
  bolt: 0,
  card: 14,
  holy: 12,
  dagger: 0,
  fire: 9,
  time: 12,
  snipe: 0,
  arcane: 0,
  dragon: 8,
  fate: 13,
  shadow: 0,
  meteor: 0,
  eternal: 0,
};

const SHOT_FIXED_TIME: Partial<Record<ShotKind, number>> = {
  slash: 0.09,
  dagger: 0.08,
  shadow: 0.07,
  snipe: 0.07,
  bolt: 0.05,
  arcane: 0.05,
  eternal: 0.05,
  meteor: 0.6,
};

const CHAIN_RANGE = 2.2;
const SPLASH_FALLOFF = 0.6;

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export interface GameStats {
  kills: number;
  bossKills: number;
  summons: number;
  merges: number;
  crafts: number;
  goldEarned: number;
  bestHit: number;
  jackpots: number;
}

export class Game {
  readonly rng: Rng;
  readonly seed: number;

  time = 0;
  status: 'playing' | 'won' | 'lost' = 'playing';
  paused = false;
  endless = false;

  // 웨이브
  wave = 0;
  waveClock = PREP_TIME;
  waveDuration = PREP_TIME;
  plan: WavePlan | null = null;
  private spawned = 0;
  private specialDone = true;
  private waveStart = 0;
  private finalBossDown = false;

  // 자원
  gold = START_GOLD;
  gems = 0;
  tickets = 0;
  summonCount = 0;
  pity = 0;
  luck = 0;
  /** 등급별 강화 레벨(인덱스 = 등급) */
  gradeLevel: number[] = [0, 0, 0, 0, 0, 0, 0];

  slots: Slot[] = Array.from({ length: SLOT_COUNT }, () => ({ units: [] }));
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  events: GameEvent[] = [];
  discovered = new Set<UnitId>();
  stats: GameStats = { kills: 0, bossKills: 0, summons: 0, merges: 0, crafts: 0, goldEarned: 0, bestHit: 0, jackpots: 0 };

  /** 룰렛으로 얻은 공격력 버프 */
  buffUntil = 0;
  pendingRoulette: { index: number; id: RouletteId } | null = null;

  // 파생 값
  fieldWeight = 0;
  auraDmg = 0;
  auraSpeed = 0;
  goldPerSec = 0;
  private goldFrac = 0;
  private warned = false;

  private nextUid = 1;
  private enemyMap = new Map<number, Enemy>();
  private tmp: PathPoint = { x: 0, y: 0, angle: 0 };
  private gambleWeights = new Map<UnitId, number[]>();

  constructor(seed = (Math.random() * 0x7fffffff) | 0) {
    this.seed = seed;
    this.rng = new Rng(seed);
    for (const id of Object.keys(UNITS) as UnitId[]) {
      const g = UNITS[id].gamble;
      if (g) this.gambleWeights.set(id, g.map((x) => x[1]));
    }
  }

  // ─────────────────────────── 조회 ───────────────────────────

  get power(): number {
    return this.time < this.buffUntil ? POWER_BUFF_PCT : 0;
  }

  summonCost(): number {
    return SUMMON_BASE_COST + SUMMON_COST_STEP * this.summonCount;
  }

  gradeMul(grade: Grade): number {
    return 1 + GRADE_LEVEL_BONUS * this.gradeLevel[grade];
  }

  /** 모든 유닛에 곱해지는 피해 배율 (성직자·여신 오라, 룰렛 버프) */
  dmgMul(): number {
    return 1 + this.auraDmg + this.power;
  }

  speedMul(): number {
    return 1 + this.auraSpeed;
  }

  luckCost(): number | null {
    return this.luck >= MAX_LUCK_LEVEL ? null : LUCK_COSTS[this.luck];
  }

  gradeUpgradeCost(grade: Grade): number | null {
    const lvl = this.gradeLevel[grade];
    if (lvl >= MAX_GRADE_LEVEL) return null;
    const base = [0, 1, 2, 3, 5, 8, 12][grade];
    return Math.ceil(base * (1 + lvl * 0.6));
  }

  unitPos(slot: number, index: number): { x: number; y: number } {
    const c = slotCenter(slot);
    const n = this.slots[slot].units.length;
    const [ox, oy] = unitOffset(n, index);
    return { x: c.x + ox, y: c.y + oy };
  }

  emptySlot(): number {
    for (let i = 0; i < SLOT_COUNT; i++) if (this.slots[i].units.length === 0) return i;
    return -1;
  }

  slotGrade(slot: number): Grade | 0 {
    const u = this.slots[slot].units[0];
    return u ? UNITS[u.id].grade : 0;
  }

  canMerge(slot: number): boolean {
    const s = this.slots[slot];
    return s.units.length === MAX_STACK && UNITS[s.units[0].id].grade <= 3;
  }

  /** 레시피 재료가 보드에 모두 있으면 재료가 있는 슬롯 목록을 돌려준다 */
  findIngredients(target: UnitId): number[] | null {
    const recipe = UNITS[target].recipe;
    if (!recipe) return null;
    const used: number[] = [];
    for (const need of recipe) {
      let best = -1;
      let bestCount = 99;
      for (let i = 0; i < SLOT_COUNT; i++) {
        const us = this.slots[i].units;
        if (us.length > 0 && us[0].id === need && us.length < bestCount && !used.includes(i)) {
          best = i;
          bestCount = us.length;
        }
      }
      if (best < 0) return null;
      used.push(best);
    }
    return used;
  }

  /** 레시피별 보유 여부(UI 표시용) */
  ingredientStatus(target: UnitId): boolean[] {
    const recipe = UNITS[target].recipe ?? [];
    return recipe.map((id) => this.slots.some((s) => s.units.length > 0 && s.units[0].id === id));
  }

  boardCount(id: UnitId): number {
    let n = 0;
    for (const s of this.slots) if (s.units.length > 0 && s.units[0].id === id) n += s.units.length;
    return n;
  }

  craftableUnits(): UnitId[] {
    return RECIPE_UNITS.filter((id) => this.findIngredients(id) !== null);
  }

  mergeableSlots(): number[] {
    const out: number[] = [];
    for (let i = 0; i < SLOT_COUNT; i++) if (this.canMerge(i)) out.push(i);
    return out;
  }

  enemyByUid(uid: number): Enemy | undefined {
    const e = this.enemyMap.get(uid);
    return e && e.alive ? e : undefined;
  }

  // ─────────────────────────── 명령 ───────────────────────────

  private fail(reason: Fail): { ok: false; reason: Fail } {
    return { ok: false, reason };
  }

  private newUnit(id: UnitId): Unit {
    const def = UNITS[id];
    this.discovered.add(id);
    return {
      uid: this.nextUid++,
      id,
      cd: this.rng.range(0.1, def.cd),
      pulse: def.pulse ? def.pulse.every * 0.6 : 0,
      shotAt: -10,
      aim: -Math.PI / 2,
      born: this.time,
    };
  }

  /** 같은 유닛이 있는 (빈자리 있는) 슬롯에 우선 쌓고, 없으면 빈 슬롯에 둔다. 실패 시 -1 */
  private place(id: UnitId): number {
    let target = -1;
    let bestCount = 0;
    for (let i = 0; i < SLOT_COUNT; i++) {
      const us = this.slots[i].units;
      if (us.length > 0 && us.length < MAX_STACK && us[0].id === id && us.length > bestCount) {
        target = i;
        bestCount = us.length;
      }
    }
    if (target < 0) target = this.emptySlot();
    if (target < 0) return -1;
    this.slots[target].units.push(this.newUnit(id));
    return target;
  }

  private rollSummon(): { id: UnitId; grade: Grade; forced: boolean } {
    const odds = SUMMON_ODDS[this.luck];
    let forced = false;
    let grade: Grade;
    if (this.pity >= PITY_MAX) {
      forced = true;
      grade = this.rng.chance(0.85) ? 3 : 4;
    } else {
      grade = (this.rng.weighted(odds) + 1) as Grade;
    }
    this.pity = grade >= 3 ? 0 : this.pity + 1;
    return { id: this.rng.pick(SUMMONABLE[grade]), grade, forced };
  }

  summon(): Res<{ slot: number; id: UnitId; grade: Grade }> {
    if (this.status !== 'playing') return this.fail('over');
    const cost = this.summonCost();
    if (this.gold < cost) return this.fail('gold');
    if (this.emptySlot() < 0) return this.fail('full');
    const { id, grade, forced } = this.rollSummon();
    const slot = this.place(id);
    this.gold -= cost;
    this.summonCount++;
    this.stats.summons++;
    this.recompute();
    this.events.push({ t: 'summon', slot, id, grade, forced });
    return { ok: true, slot, id, grade };
  }

  /** 같은 유닛 3기를 합쳐 한 단계 위 랜덤 유닛으로 */
  merge(slot: number): Res<{ id: UnitId; jackpot: boolean }> {
    if (this.status !== 'playing') return this.fail('over');
    const s = this.slots[slot];
    if (!s || s.units.length < MAX_STACK) return this.fail('need3');
    const from = s.units[0].id;
    const g = UNITS[from].grade;
    if (g > 3) return this.fail('max');
    let nextGrade = g + 1;
    let jackpot = false;
    if (nextGrade < 4 && this.rng.chance(JACKPOT_CHANCE)) {
      nextGrade++;
      jackpot = true;
      this.stats.jackpots++;
    }
    const id = this.rng.pick(SUMMONABLE[nextGrade]);
    s.units = [this.newUnit(id)];
    this.stats.merges++;
    this.recompute();
    this.events.push({ t: 'merge', slot, from, to: id, jackpot });
    return { ok: true, id, jackpot };
  }

  mergeAll(): number {
    let n = 0;
    for (let i = 0; i < SLOT_COUNT; i++) {
      while (this.canMerge(i)) {
        if (!this.merge(i).ok) break;
        n++;
      }
    }
    return n;
  }

  /** 슬롯 이동: 빈 곳이면 이동, 같은 유닛이면 합치기(최대 3), 다르면 서로 교환 */
  move(from: number, to: number): Res<{ swap: boolean }> {
    if (this.status !== 'playing') return this.fail('over');
    if (from === to) return this.fail('none');
    const a = this.slots[from];
    const b = this.slots[to];
    if (!a || !b || a.units.length === 0) return this.fail('empty');
    let swap = false;
    if (b.units.length === 0) {
      b.units = a.units;
      a.units = [];
    } else if (b.units[0].id === a.units[0].id) {
      const room = MAX_STACK - b.units.length;
      if (room <= 0) {
        swap = true;
        [a.units, b.units] = [b.units, a.units];
      } else {
        const moved = a.units.splice(0, room);
        b.units.push(...moved);
      }
    } else {
      swap = true;
      [a.units, b.units] = [b.units, a.units];
    }
    this.events.push({ t: 'move', from, to, swap });
    return { ok: true, swap };
  }

  sell(slot: number): Res<{ gold: number }> {
    if (this.status !== 'playing') return this.fail('over');
    const s = this.slots[slot];
    if (!s || s.units.length === 0) return this.fail('empty');
    const u = s.units.pop()!;
    const gold = this.sellValue(u.id);
    this.gold += gold;
    this.recompute();
    this.events.push({ t: 'sell', slot, id: u.id, gold });
    return { ok: true, gold };
  }

  sellValue(id: UnitId): number {
    const g = UNITS[id].grade;
    return [0, 2, 7, 24, 90, 320, 1000][g];
  }

  craft(target: UnitId): Res<{ slot: number }> {
    if (this.status !== 'playing') return this.fail('over');
    const mats = this.findIngredients(target);
    if (!mats) return this.fail('missing');
    const willEmpty = mats.filter((i) => this.slots[i].units.length === 1);
    let dest = willEmpty.length > 0 ? willEmpty[0] : this.emptySlot();
    if (dest < 0) return this.fail('full');
    const used = mats.map((i) => ({ slot: i, id: this.slots[i].units[0].id }));
    for (const i of mats) this.slots[i].units.pop();
    if (this.slots[dest].units.length > 0) dest = this.emptySlot();
    this.slots[dest].units.push(this.newUnit(target));
    this.stats.crafts++;
    this.recompute();
    this.events.push({ t: 'craft', slot: dest, id: target, mats: used });
    return { ok: true, slot: dest };
  }

  upgradeGrade(grade: Grade): Res<{ level: number }> {
    if (this.status !== 'playing') return this.fail('over');
    const cost = this.gradeUpgradeCost(grade);
    if (cost === null) return this.fail('max');
    if (this.gems < cost) return this.fail('gems');
    this.gems -= cost;
    this.gradeLevel[grade]++;
    this.events.push({ t: 'upgrade', grade, level: this.gradeLevel[grade] });
    return { ok: true, level: this.gradeLevel[grade] };
  }

  upgradeLuck(): Res<{ level: number }> {
    if (this.status !== 'playing') return this.fail('over');
    const cost = this.luckCost();
    if (cost === null) return this.fail('max');
    if (this.gems < cost) return this.fail('gems');
    this.gems -= cost;
    this.luck++;
    this.events.push({ t: 'luck', level: this.luck });
    return { ok: true, level: this.luck };
  }

  /** 룰렛 티켓 1장을 쓰고 결과를 정한다 (보상은 claimRoulette 에서 지급) */
  startRoulette(): Res<{ index: number; id: RouletteId }> {
    if (this.status !== 'playing') return this.fail('over');
    if (this.pendingRoulette) return this.fail('busy');
    if (this.tickets <= 0) return this.fail('none');
    this.tickets--;
    const index = this.rng.weighted(ROULETTE_SLICES.map((s) => s.weight));
    const id = ROULETTE_SLICES[index].id;
    this.pendingRoulette = { index, id };
    return { ok: true, index, id };
  }

  claimRoulette(): RouletteId | null {
    const p = this.pendingRoulette;
    if (!p) return null;
    this.pendingRoulette = null;
    switch (p.id) {
      case 'gold': {
        const g = Math.max(60, this.summonCost() * 3);
        this.gold += g;
        this.stats.goldEarned += g;
        break;
      }
      case 'gems':
        this.gems += 3;
        break;
      case 'free3':
        for (let i = 0; i < 3; i++) this.giveUnit(this.rollSummon().id);
        break;
      case 'legend':
        this.giveUnit(this.rng.pick(SUMMONABLE[4]), 90);
        break;
      case 'jackpot':
        this.giveUnit(this.rng.pick(RECIPE_UNITS.filter((id) => UNITS[id].grade === 5)), 320);
        break;
      case 'power':
        this.buffUntil = this.time + POWER_BUFF_TIME;
        this.events.push({ t: 'power', dur: POWER_BUFF_TIME });
        break;
      case 'freeze':
        this.freezeAll(ROULETTE_FREEZE_TIME, 0.5);
        break;
      case 'bomb':
        this.bombAll(0.3, 0.06);
        break;
    }
    return p.id;
  }

  /** 비용 없이 유닛을 보드에 올린다 (룰렛·테스트용). 자리가 없으면 -1 */
  grant(id: UnitId): number {
    const slot = this.place(id);
    if (slot >= 0) this.recompute();
    return slot;
  }

  /** 자리가 없으면 대신 골드로 지급 */
  private giveUnit(id: UnitId, fallbackGold = 20) {
    const slot = this.grant(id);
    if (slot < 0) {
      this.gold += fallbackGold;
      return;
    }
    this.events.push({ t: 'summon', slot, id, grade: UNITS[id].grade, forced: true });
  }

  private freezeAll(dur: number, bossSlow: number) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.boss) {
        e.slow = Math.max(e.slow, bossSlow);
        e.slowUntil = Math.max(e.slowUntil, this.time + dur);
      } else {
        e.freezeUntil = Math.max(e.freezeUntil, this.time + dur);
      }
    }
    this.events.push({ t: 'freeze', dur });
  }

  private bombAll(frac: number, bossFrac: number) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      this.damage(e, e.maxHp * (e.boss ? bossFrac : frac), false, null);
    }
    this.events.push({ t: 'bomb' });
  }

  continueEndless() {
    if (this.status !== 'won') return;
    this.endless = true;
    this.status = 'playing';
    this.finalBossDown = false;
  }

  // ─────────────────────────── 시뮬레이션 ───────────────────────────

  /** 보드가 바뀔 때마다 오라/수입 합계를 다시 계산 */
  recompute() {
    let aura = 0;
    let spd = 0;
    let gps = 0;
    for (const s of this.slots) {
      for (const u of s.units) {
        const d = UNITS[u.id];
        if (d.auraDmg) aura += d.auraDmg;
        if (d.auraSpeed) spd += d.auraSpeed;
        if (d.goldPerSec) gps += d.goldPerSec;
      }
    }
    this.auraDmg = aura;
    this.auraSpeed = spd;
    this.goldPerSec = gps;
  }

  update(dt: number) {
    if (this.status !== 'playing' || this.paused) return;
    this.time += dt;
    this.updateWave(dt);
    this.updateEnemies(dt);
    this.updateUnits(dt);
    this.updateProjectiles(dt);
    if (this.goldPerSec > 0) {
      this.goldFrac += this.goldPerSec * dt;
      if (this.goldFrac >= 1) {
        const g = Math.floor(this.goldFrac);
        this.goldFrac -= g;
        this.gold += g;
        this.stats.goldEarned += g;
      }
    }
    this.cleanup();
    this.checkEnd();
  }

  private updateWave(dt: number) {
    const plan = this.plan;
    if (plan) {
      // 무리(pack) 단위로 스폰: 무리 안에서는 촘촘하게, 무리 사이에는 쉬는 시간
      while (this.spawned < plan.count) {
        const i = this.spawned;
        const at = Math.floor(i / plan.packSize) * plan.packGap + (i % plan.packSize) * plan.spacing + 0.4;
        if (this.time - this.waveStart < at) break;
        this.spawned++;
        this.spawn(plan.kind, plan.hp, plan.speed, plan.weight, plan.gold, 0, false, false);
      }
      if (!this.specialDone && plan.special && this.time - this.waveStart >= 1.2) {
        this.specialDone = true;
        const sp = plan.special;
        this.spawn(sp.kind, sp.hp, sp.speed, sp.weight, sp.gold, sp.gems, sp.boss, !sp.boss);
      }
    }
    this.waveClock -= dt;
    if (this.waveClock <= 0) {
      if (this.wave < FINAL_WAVE || this.endless) this.startWave(this.wave + 1);
      else this.waveClock = 0;
    }
  }

  private startWave(n: number) {
    this.wave = n;
    const plan = planWave(n);
    this.plan = plan;
    this.waveClock = this.waveDuration = plan.duration;
    this.spawned = 0;
    this.specialDone = !plan.special;
    this.waveStart = this.time;
    if (n % 5 === 0) {
      this.tickets++;
      this.events.push({ t: 'ticket' });
    }
    this.events.push({ t: 'wave', wave: n, boss: plan.role === 'boss', elite: plan.role === 'elite' });
  }

  private spawn(kind: EnemyKind, hp: number, speed: number, weight: number, gold: number, gems: number, boss: boolean, elite: boolean) {
    const def = ENEMIES[kind];
    const e: Enemy = {
      uid: this.nextUid++,
      kind,
      boss,
      elite,
      wave: this.wave,
      hp,
      maxHp: hp,
      incoming: 0,
      dist: 0,
      speed,
      weight,
      gold,
      gems,
      size: def.size * (elite ? 1.35 : 1),
      slow: 0,
      slowUntil: 0,
      stunUntil: 0,
      freezeUntil: 0,
      poisonDps: 0,
      poisonUntil: 0,
      x: 0,
      y: 0,
      angle: 0,
      hitAt: -10,
      born: this.time,
      alive: true,
    };
    pointAt(0, this.tmp);
    e.x = this.tmp.x;
    e.y = this.tmp.y;
    e.angle = this.tmp.angle;
    this.enemies.push(e);
    this.enemyMap.set(e.uid, e);
    this.fieldWeight += weight;
  }

  private updateEnemies(dt: number) {
    const t = this.time;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      let m = 1;
      if (t < e.stunUntil || t < e.freezeUntil) m = 0;
      else if (t < e.slowUntil) m = 1 - e.slow;
      e.dist += e.speed * m * dt;
      pointAt(e.dist, this.tmp);
      e.x = this.tmp.x;
      e.y = this.tmp.y;
      e.angle = this.tmp.angle;
      if (e.poisonUntil > t) this.damage(e, e.poisonDps * dt, false, null, true);
    }
  }

  private updateUnits(dt: number) {
    const sp = dt * this.speedMul();
    for (let s = 0; s < SLOT_COUNT; s++) {
      const units = this.slots[s].units;
      for (let i = 0; i < units.length; i++) {
        const u = units[i];
        const def = UNITS[u.id];
        u.cd -= sp;
        if (u.cd <= 0) {
          if (this.fire(s, i, u, def)) {
            u.cd += def.cd;
            if (u.cd < 0) u.cd = 0;
          } else {
            u.cd = 0;
          }
        }
        if (def.pulse) {
          u.pulse -= dt;
          if (u.pulse <= 0) {
            u.pulse += def.pulse.every;
            this.freezeAll(def.pulse.freeze, def.pulse.bossSlow);
          }
        }
      }
    }
  }

  private pickTarget(mode: TargetMode, exclude?: Enemy[]): Enemy | null {
    let best: Enemy | null = null;
    let bestScore = -Infinity;
    let fallback: Enemy | null = null;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (exclude && exclude.includes(e)) continue;
      if (e.hp - e.incoming <= 0) {
        if (!fallback) fallback = e;
        continue;
      }
      let score: number;
      switch (mode) {
        case 'first':
          score = e.dist;
          break;
        case 'last':
          score = -e.dist;
          break;
        case 'strong':
          score = e.hp;
          break;
        case 'weak':
          score = -e.hp;
          break;
        default:
          score = this.rng.next();
      }
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best ?? fallback;
  }

  private rollDamage(def: UnitDef): { dmg: number; crit: boolean } {
    let mult = 1;
    const gw = this.gambleWeights.get(def.id);
    if (gw && def.gamble) mult = def.gamble[this.rng.weighted(gw)][0];
    let crit = false;
    if (def.crit && this.rng.chance(def.crit.chance)) {
      crit = true;
      mult *= def.crit.mult;
    }
    return { dmg: def.dmg * this.gradeMul(def.grade) * this.dmgMul() * mult, crit };
  }

  private fire(slotIdx: number, index: number, u: Unit, def: UnitDef): boolean {
    const first = this.pickTarget(def.target);
    if (!first) return false;
    const pos = this.unitPos(slotIdx, index);
    u.aim = Math.atan2(first.y - pos.y, first.x - pos.x);
    u.shotAt = this.time;
    const targets: Enemy[] = [first];
    for (let k = 0; k < (def.multi ?? 0); k++) {
      const t = this.pickTarget(def.target, targets);
      if (t) targets.push(t);
    }
    for (const t of targets) {
      const { dmg, crit } = this.rollDamage(def);
      if (def.chain) this.chainStrike(pos.x, pos.y, t, dmg, crit, def);
      else this.launch(pos.x, pos.y, t, dmg, crit, def);
    }
    this.events.push({ t: 'shoot', slot: slotIdx, index, id: def.id, shot: def.shot });
    return true;
  }

  private launch(sx: number, sy: number, target: Enemy, dmg: number, crit: boolean, def: UnitDef) {
    const speed = SHOT_SPEED[def.shot];
    const d = Math.sqrt(dist2(sx, sy, target.x, target.y));
    const dur = speed > 0 ? Math.max(0.1, d / speed) : (SHOT_FIXED_TIME[def.shot] ?? 0.08);
    const reserve = dmg * (target.boss && def.bossMul ? def.bossMul : 1);
    target.incoming += reserve;
    this.projectiles.push({
      uid: this.nextUid++,
      unitId: def.id,
      shot: def.shot,
      sx,
      sy,
      x: sx,
      y: sy,
      tx: target.x,
      ty: target.y,
      targetUid: target.uid,
      age: 0,
      dur,
      dmg,
      crit,
      reserve,
    });
  }

  private chainStrike(sx: number, sy: number, first: Enemy, dmg: number, crit: boolean, def: UnitDef) {
    const hit: Enemy[] = [first];
    const pts: number[] = [sx, sy, first.x, first.y];
    let cur = first;
    const jumps = def.chain ?? 1;
    for (let j = 0; j < jumps; j++) {
      let next: Enemy | null = null;
      let nd = CHAIN_RANGE * CHAIN_RANGE;
      for (const e of this.enemies) {
        if (!e.alive || hit.includes(e)) continue;
        const d = dist2(cur.x, cur.y, e.x, e.y);
        if (d < nd) {
          nd = d;
          next = e;
        }
      }
      if (!next) break;
      hit.push(next);
      pts.push(next.x, next.y);
      cur = next;
    }
    this.events.push({ t: 'chain', shot: def.shot, pts });
    const falloff = def.chainFalloff ?? 0.8;
    let m = 1;
    for (const e of hit) {
      this.hitEnemy(e, dmg * m, crit, def, e === first);
      m *= falloff;
    }
  }

  private updateProjectiles(dt: number) {
    const list = this.projectiles;
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.age += dt;
      const target = this.enemyMap.get(p.targetUid);
      if (target && target.alive) {
        p.tx = target.x;
        p.ty = target.y;
      }
      const k = Math.min(1, p.age / p.dur);
      p.x = p.sx + (p.tx - p.sx) * k;
      p.y = p.sy + (p.ty - p.sy) * k;
      if (p.age >= p.dur) {
        this.resolve(p, target && target.alive ? target : undefined);
      } else {
        list[w++] = p;
      }
    }
    list.length = w;
  }

  private resolve(p: Projectile, target: Enemy | undefined) {
    const def = UNITS[p.unitId];
    if (target) target.incoming = Math.max(0, target.incoming - p.reserve);
    const ix = target ? target.x : p.tx;
    const iy = target ? target.y : p.ty;
    if (target) this.hitEnemy(target, p.dmg, p.crit, def, true);
    if (def.splash) {
      const r2 = def.splash * def.splash;
      for (const e of this.enemies) {
        if (!e.alive || e === target) continue;
        if (dist2(ix, iy, e.x, e.y) <= r2) this.hitEnemy(e, p.dmg * SPLASH_FALLOFF, false, def, false);
      }
      this.events.push({ t: 'blast', x: ix, y: iy, r: def.splash, shot: def.shot });
    }
  }

  /** 맞은 적에게 피해 + 부가 효과 */
  private hitEnemy(e: Enemy, dmg: number, crit: boolean, def: UnitDef, primary: boolean) {
    if (!e.alive) return;
    if (e.boss && def.bossMul) dmg *= def.bossMul;
    const t = this.time;
    if (def.slow) {
      const pct = e.boss ? Math.min(def.slow.pct, 0.4) : def.slow.pct;
      if (t >= e.slowUntil || pct >= e.slow) e.slow = pct;
      e.slowUntil = Math.max(e.slowUntil, t + def.slow.dur);
    }
    if (def.stun && !e.boss && this.rng.chance(def.stun.chance)) {
      e.stunUntil = Math.max(e.stunUntil, t + def.stun.dur);
    }
    if (def.poison) {
      const dps = dmg * def.poison.dps;
      if (t >= e.poisonUntil || dps >= e.poisonDps) e.poisonDps = dps;
      e.poisonUntil = Math.max(e.poisonUntil, t + def.poison.dur);
    }
    if (primary && def.goldOnHit && this.rng.chance(def.goldOnHit.chance)) {
      this.gold += def.goldOnHit.amount;
      this.stats.goldEarned += def.goldOnHit.amount;
      this.events.push({ t: 'gold', x: e.x, y: e.y, amount: def.goldOnHit.amount });
    }
    this.damage(e, dmg, crit, def.shot);
  }

  private damage(e: Enemy, amount: number, crit: boolean, shot: ShotKind | null, silent = false) {
    if (!e.alive) return;
    e.hp -= amount;
    if (!silent) {
      e.hitAt = this.time;
      if (amount > this.stats.bestHit) this.stats.bestHit = amount;
      this.events.push({ t: 'hit', uid: e.uid, x: e.x, y: e.y, dmg: amount, crit, shot });
    }
    if (e.hp <= 0) this.kill(e);
  }

  private kill(e: Enemy) {
    if (!e.alive) return;
    e.alive = false;
    this.gold += e.gold;
    this.gems += e.gems;
    this.stats.goldEarned += e.gold;
    this.stats.kills++;
    if (e.boss) {
      this.stats.bossKills++;
      this.tickets++;
      this.events.push({ t: 'ticket' });
      if (e.wave === FINAL_WAVE) this.finalBossDown = true;
    }
    this.events.push({ t: 'kill', uid: e.uid, kind: e.kind, x: e.x, y: e.y, angle: e.angle, size: e.size, boss: e.boss, elite: e.elite, gold: e.gold });
  }

  private cleanup() {
    let w = 0;
    let weight = 0;
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.alive) {
        list[w++] = e;
        weight += e.weight;
      } else {
        this.enemyMap.delete(e.uid);
      }
    }
    list.length = w;
    this.fieldWeight = weight;
    const warn = weight >= ENEMY_WARN;
    if (warn !== this.warned) {
      this.warned = warn;
      this.events.push({ t: 'warn', on: warn });
    }
  }

  private checkEnd() {
    if (this.fieldWeight >= ENEMY_LIMIT) {
      this.status = 'lost';
      this.events.push({ t: 'over', won: false });
    } else if (this.finalBossDown && !this.endless) {
      this.status = 'won';
      this.events.push({ t: 'over', won: true });
    }
  }
}
