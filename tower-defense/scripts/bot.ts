import { Game } from '../src/game/engine/game';
import { STEP } from '../src/game/engine/config';
import { UNITS, type Grade, type UnitId } from '../src/game/engine/units';

export type Strategy = 'smart' | 'lazy' | 'random';

/** 밸런스 확인용 자동 플레이어. 실제 플레이어가 하는 행동만 공개 API로 수행한다. */
export class Bot {
  constructor(
    private g: Game,
    private strategy: Strategy = 'smart',
  ) {}

  act() {
    const g = this.g;
    if (g.status !== 'playing') return;

    if (this.strategy === 'smart') {
      // 신화/초월 조합 (높은 등급 우선)
      for (let guard = 0; guard < 4; guard++) {
        const list = g.craftableUnits().sort((a, b) => UNITS[b].grade - UNITS[a].grade);
        if (list.length === 0 || !g.craft(list[0]).ok) break;
      }
    }
    if (this.strategy !== 'random') g.mergeAll();
    else if (g.rng.chance(0.5)) g.mergeAll();

    // 룰렛
    while (g.tickets > 0 && !g.pendingRoulette) {
      if (!g.startRoulette().ok) break;
      g.claimRoulette();
    }

    // 보석 사용
    if (this.strategy === 'smart') this.spendGems();

    // 소환 (자리가 없으면 낮은 등급 낱개를 팔아 자리를 만든다)
    for (let guard = 0; guard < 6; guard++) {
      if (g.gold < g.summonCost()) break;
      if (g.emptySlot() < 0) {
        if (this.strategy === 'smart') this.makeRoom();
        if (g.emptySlot() < 0) break;
      }
      const r = g.summon();
      if (!r.ok) break;
      if (this.strategy !== 'random') g.mergeAll();
    }
  }

  private spendGems() {
    const g = this.g;
    if (g.luck < 2 && g.luckCost() !== null && g.gems >= (g.luckCost() as number)) g.upgradeLuck();
    // 보드에 있는 가장 높은 등급 위주로 강화
    const present = new Set<Grade>();
    for (const s of g.slots) if (s.units[0]) present.add(UNITS[s.units[0].id].grade);
    const order = [...present].sort((a, b) => b - a);
    for (const grade of order) {
      const c = g.gradeUpgradeCost(grade);
      if (c !== null && g.gems >= c) g.upgradeGrade(grade);
    }
  }

  private makeRoom() {
    const g = this.g;
    let best = -1;
    let bestScore = Infinity;
    for (let i = 0; i < g.slots.length; i++) {
      const us = g.slots[i].units;
      if (us.length === 0) continue;
      const grade = UNITS[us[0].id].grade;
      if (grade > 2) continue;
      const score = grade * 10 + us.length;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best >= 0) {
      const n = g.slots[best].units.length;
      for (let k = 0; k < n; k++) g.sell(best);
    }
  }
}

export interface RunResult {
  seed: number;
  status: Game['status'];
  wave: number;
  time: number;
  kills: number;
  summons: number;
  merges: number;
  crafts: number;
  board: Partial<Record<UnitId, number>>;
  gold: number;
}

export function simulate(seed: number, strategy: Strategy, maxWave = 50): RunResult {
  const g = new Game(seed);
  const bot = new Bot(g, strategy);
  let step = 0;
  while (g.status === 'playing') {
    g.update(STEP);
    g.events.length = 0;
    if (++step % 12 === 0) bot.act();
    if (g.time > 3500) break;
  }
  const board: Partial<Record<UnitId, number>> = {};
  for (const s of g.slots) for (const u of s.units) board[u.id] = (board[u.id] ?? 0) + 1;
  return {
    seed,
    status: g.status,
    wave: g.wave,
    time: Math.round(g.time),
    kills: g.stats.kills,
    summons: g.stats.summons,
    merges: g.stats.merges,
    crafts: g.stats.crafts,
    board,
    gold: Math.round(g.gold),
  };
}
