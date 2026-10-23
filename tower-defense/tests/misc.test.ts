/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { STEP } from '../src/game/engine/config';
import { fmtNum } from '../src/game/engine/format';
import { Game, ROULETTE_SLICES } from '../src/game/engine/game';
import { ENEMIES } from '../src/game/engine/enemies';
import { UNITS, UNIT_IDS } from '../src/game/engine/units';
import { baseHp, planWave } from '../src/game/engine/waves';
import { MONSTER_DESC, unitSpecLines } from '../src/game/ui/unitInfo';

describe('숫자 표기', () => {
  it('큰 수를 K/M/B 로 줄인다', () => {
    assert.equal(fmtNum(0.2), '1');
    assert.equal(fmtNum(999), '999');
    assert.equal(fmtNum(1000), '1K');
    assert.equal(fmtNum(1490), '1.49K');
    assert.equal(fmtNum(15_300), '15.3K');
    assert.equal(fmtNum(2_500_000), '2.5M');
    assert.equal(fmtNum(3_200_000_000), '3.2B');
  });
});

describe('웨이브 스폰', () => {
  it('무리 단위로 모두 나오고 웨이브 시간 안에 끝난다', () => {
    for (const w of [1, 5, 10, 23, 40, 50]) {
      const plan = planWave(w);
      const last = Math.floor((plan.count - 1) / plan.packSize) * plan.packGap + ((plan.count - 1) % plan.packSize) * plan.spacing + 0.4;
      assert.ok(last < plan.duration, `wave ${w}: 마지막 스폰 ${last.toFixed(1)}s >= ${plan.duration}s`);
      assert.ok(plan.packSize >= 4 && plan.packSize <= 12);
    }
  });

  it('웨이브가 진행되면 계획한 수만큼 몬스터가 스폰된다', () => {
    const g = new Game(5);
    const plan = planWave(1);
    let seen = 0;
    const known = new Set<number>();
    for (let i = 0; i < (6 + plan.duration) / STEP; i++) {
      g.update(STEP);
      for (const e of g.enemies) {
        if (!known.has(e.uid)) {
          known.add(e.uid);
          seen++;
        }
      }
    }
    // 1웨이브 몬스터(plan.count) 외에 2웨이브가 막 시작해 섞였을 수 있다
    assert.ok(seen >= plan.count, `seen ${seen} < ${plan.count}`);
  });

  it('체력 곡선은 단조 증가한다', () => {
    let prev = 0;
    for (let w = 1; w <= 60; w++) {
      const h = baseHp(w);
      assert.ok(h > prev);
      prev = h;
    }
  });

  it('보스는 10웨이브 단위로 종류가 바뀌고 최종 보스는 심연의 군주', () => {
    const kinds = [10, 20, 30, 40, 50].map((w) => planWave(w).special?.kind);
    assert.deepEqual(kinds, ['golem', 'dragon', 'lich', 'demon', 'abyss']);
    for (const k of kinds) assert.ok(k && ENEMIES[k].boss);
  });
});

describe('룰렛 · 도감 데이터', () => {
  it('룰렛 칸은 8개이고 id 가 겹치지 않으며 가중치가 양수', () => {
    assert.equal(ROULETTE_SLICES.length, 8);
    assert.equal(new Set(ROULETTE_SLICES.map((s) => s.id)).size, 8);
    assert.ok(ROULETTE_SLICES.every((s) => s.weight > 0));
  });

  it('시드가 같으면 룰렛 결과 순서도 같다', () => {
    const roll = (seed: number) => {
      const g = new Game(seed);
      g.tickets = 5;
      const out: string[] = [];
      for (let i = 0; i < 5; i++) {
        const r = g.startRoulette();
        assert.ok(r.ok);
        if (r.ok) out.push(r.id);
        g.claimRoulette();
      }
      return out;
    };
    assert.deepEqual(roll(42), roll(42));
  });

  it('모든 유닛에 능력 설명이 있고 몬스터마다 설명이 있다', () => {
    for (const id of UNIT_IDS) assert.ok(unitSpecLines(UNITS[id]).length >= 1, id);
    for (const k of Object.keys(ENEMIES)) assert.ok(MONSTER_DESC[k], k);
  });

  it('룰렛 보상은 자리가 가득 차도 골드로 대체되어 사라지지 않는다', () => {
    const g = new Game(9);
    // 전설 4종은 3기씩(가득 찬 스택), 나머지 16칸은 서로 다른 유닛으로 채운다
    for (const id of UNIT_IDS.filter((u) => UNITS[u].grade === 4)) for (let i = 0; i < 3; i++) g.grant(id);
    for (const id of UNIT_IDS.filter((u) => UNITS[u].grade !== 4).slice(0, 16)) g.grant(id);
    assert.equal(g.emptySlot(), -1);
    g.pendingRoulette = { index: 6, id: 'legend' };
    const gold = g.gold;
    g.claimRoulette();
    assert.ok(g.gold > gold);
  });
});
