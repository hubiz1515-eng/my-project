/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { simulate } from '../scripts/bot';
import { ENEMY_LIMIT, FINAL_WAVE, MAX_STACK, SLOT_COUNT, STEP, SUMMON_BASE_COST, SUMMON_COST_STEP } from '../src/game/engine/config';
import { Game } from '../src/game/engine/game';
import { LOOP_LENGTH, pointAt } from '../src/game/engine/path';
import { planWave } from '../src/game/engine/waves';
import { RECIPE_UNITS, SUMMONABLE, UNITS, type UnitId } from '../src/game/engine/units';

const run = (g: Game, seconds: number) => {
  for (let i = 0; i < seconds / STEP; i++) g.update(STEP);
};

const count = (g: Game) => g.slots.reduce((n, s) => n + s.units.length, 0);

describe('데이터 정합성', () => {
  it('모든 등급(1~4)에 소환 가능한 유닛이 있다', () => {
    for (const g of [1, 2, 3, 4]) assert.ok(SUMMONABLE[g].length >= 3, `grade ${g}`);
  });

  it('레시피 재료는 실제 유닛이고 서로 다르며 결과보다 낮은 등급이다', () => {
    for (const id of RECIPE_UNITS) {
      const d = UNITS[id];
      const mats = d.recipe!;
      assert.equal(new Set(mats).size, mats.length, `${id} 재료 중복`);
      for (const m of mats) assert.ok(UNITS[m], `${id} 재료 ${m}`);
      assert.ok(Math.max(...mats.map((m) => UNITS[m].grade)) < d.grade, `${id} 등급`);
    }
  });

  it('길은 닫힌 루프이고 시작/끝이 이어진다', () => {
    const a = pointAt(0);
    const b = pointAt(LOOP_LENGTH);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1e-6);
    const c = pointAt(LOOP_LENGTH * 0.37);
    const d = pointAt(LOOP_LENGTH * 0.37 + 1e-4);
    assert.ok(Math.hypot(c.x - d.x, c.y - d.y) < 2e-4);
  });

  it('웨이브 10의 배수는 보스, 5의 배수(홀수 10단위)는 엘리트', () => {
    assert.equal(planWave(10).role, 'boss');
    assert.ok(planWave(10).special?.boss);
    assert.equal(planWave(5).role, 'elite');
    assert.ok(!planWave(5).special?.boss);
    assert.equal(planWave(50).special?.kind, 'abyss');
  });
});

describe('소환', () => {
  it('골드를 쓰고 유닛을 놓으며 비용이 오른다', () => {
    const g = new Game(1);
    g.gold = 1000;
    const r = g.summon();
    assert.ok(r.ok);
    assert.equal(count(g), 1);
    assert.equal(g.gold, 1000 - SUMMON_BASE_COST);
    assert.equal(g.summonCost(), SUMMON_BASE_COST + SUMMON_COST_STEP);
  });

  it('골드가 모자라면 실패하고 아무것도 바뀌지 않는다', () => {
    const g = new Game(1);
    g.gold = SUMMON_BASE_COST - 1;
    const r = g.summon();
    assert.deepEqual(r, { ok: false, reason: 'gold' });
    assert.equal(count(g), 0);
    assert.equal(g.gold, SUMMON_BASE_COST - 1);
  });

  it('같은 유닛은 같은 슬롯에 쌓이고 최대 3기', () => {
    const g = new Game(1);
    for (let i = 0; i < 4; i++) g.grant('squire');
    assert.equal(g.slots[0].units.length, MAX_STACK);
    assert.equal(g.slots[1].units.length, 1);
    assert.ok(g.slots[0].units.every((u) => u.id === 'squire'));
  });

  it('빈 슬롯이 없으면 소환할 수 없다', () => {
    const g = new Game(2);
    g.gold = 99999;
    const ids = Object.keys(UNITS) as UnitId[];
    for (let i = 0; i < SLOT_COUNT; i++) g.grant(ids[i]); // 서로 다른 22종 중 20종으로 채운다
    assert.equal(g.emptySlot(), -1);
    assert.deepEqual(g.summon(), { ok: false, reason: 'full' });
  });

  it('행운 게이지가 차면 영웅 이상이 보장된다', () => {
    const g = new Game(7);
    g.gold = 1e9;
    g.pity = 24;
    const r = g.summon();
    assert.ok(r.ok && r.grade >= 3);
    assert.equal(g.pity, 0);
  });
});

describe('합성 · 이동 · 판매 · 조합', () => {
  it('같은 유닛 3기를 합성하면 한 단계 위 유닛 1기가 된다', () => {
    const g = new Game(3);
    for (let i = 0; i < 3; i++) g.grant('squire');
    assert.ok(g.canMerge(0));
    const r = g.merge(0);
    assert.ok(r.ok);
    assert.equal(g.slots[0].units.length, 1);
    assert.ok(UNITS[g.slots[0].units[0].id].grade >= 2);
  });

  it('3기 미만이거나 전설이면 합성할 수 없다', () => {
    const g = new Game(3);
    g.grant('squire');
    assert.deepEqual(g.merge(0), { ok: false, reason: 'need3' });
    for (let i = 0; i < 3; i++) g.grant('dragoon');
    assert.deepEqual(g.merge(1), { ok: false, reason: 'max' });
  });

  it('이동: 빈 칸으로 / 같은 유닛 합치기 / 다른 유닛 교환', () => {
    const g = new Game(4);
    g.grant('squire'); // slot0
    g.grant('hunter'); // slot1
    g.grant('squire'); // slot0 에 쌓임 (squire x2)
    assert.ok(g.move(0, 5).ok);
    assert.equal(g.slots[0].units.length, 0);
    assert.equal(g.slots[5].units.length, 2);
    const r = g.move(5, 1);
    assert.ok(r.ok && r.swap);
    assert.equal(g.slots[1].units[0].id, 'squire');
    assert.equal(g.slots[5].units[0].id, 'hunter');
    g.grant('squire'); // squire x2 가 있는 slot1 에 쌓임
    assert.equal(g.slots[1].units.length, 3);
    g.grant('squire'); // 새 슬롯
    const free = g.slots.findIndex((s, i) => i !== 1 && s.units[0]?.id === 'squire');
    const r2 = g.move(free, 1); // 가득 찬 같은 유닛 → 교환
    assert.ok(r2.ok);
    assert.equal(count(g), 1 + 3 + 1);
  });

  it('판매하면 한 기씩 줄고 등급별 골드를 준다', () => {
    const g = new Game(5);
    g.grant('knight');
    g.grant('knight');
    const before = g.gold;
    const r = g.sell(0);
    assert.ok(r.ok && r.gold === 7);
    assert.equal(g.gold, before + 7);
    assert.equal(g.slots[0].units.length, 1);
  });

  it('레시피 재료가 있으면 신화를 조합하고 재료는 한 기씩 소모된다', () => {
    const g = new Game(6);
    for (const id of UNITS.dragonlord.recipe!) g.grant(id);
    g.grant('knight'); // 재료 1개는 2기 보유
    assert.equal(g.craft('timelord').ok, false);
    assert.deepEqual(g.craftableUnits(), ['dragonlord']);
    const r = g.craft('dragonlord');
    assert.ok(r.ok);
    assert.equal(g.boardCount('dragonlord'), 1);
    assert.equal(g.boardCount('knight'), 1);
    assert.equal(g.boardCount('dragoon'), 0);
    assert.equal(g.boardCount('cleric'), 0);
  });

  it('초월 조합은 신화 2기가 필요하다', () => {
    const g = new Game(6);
    g.grant('dragonlord');
    assert.equal(g.craft('worldbreaker').ok, false);
    g.grant('shadowlord');
    assert.ok(g.craft('worldbreaker').ok);
    assert.equal(count(g), 1);
  });
});

describe('웨이브 · 전투', () => {
  it('준비 시간 뒤 웨이브 1 이 시작되고 몬스터가 나온다', () => {
    const g = new Game(1);
    run(g, 8);
    assert.equal(g.wave, 1);
    assert.ok(g.enemies.length > 0);
  });

  it('유닛은 몬스터를 처치하고 골드를 번다', () => {
    const g = new Game(1);
    for (let i = 0; i < 3; i++) g.grant('hunter');
    run(g, 30);
    assert.ok(g.stats.kills > 0);
    assert.ok(g.gold > 80);
  });

  it('유닛이 없으면 몬스터가 쌓여 패배한다', () => {
    const g = new Game(1);
    run(g, 400);
    assert.equal(g.status, 'lost');
    assert.ok(g.fieldWeight >= ENEMY_LIMIT);
  });

  it('냉기는 이동을 느리게, 독은 지속 피해를 준다', () => {
    const a = new Game(1);
    const b = new Game(1);
    a.grant('frostmage');
    run(a, 12);
    run(b, 12);
    // 같은 시간 동안 냉기 술사가 있는 쪽의 몬스터가 더 적게 이동(또는 처치)
    const far = (g: Game) => g.enemies.reduce((m, e) => Math.max(m, e.dist), 0);
    assert.ok(far(a) <= far(b));
    const c = new Game(1);
    c.grant('poisoner');
    run(c, 10);
    assert.ok(c.enemies.some((e) => e.poisonUntil > c.time || e.hp < e.maxHp) || c.stats.kills > 0);
  });

  it('성직자 오라는 모든 유닛의 피해 배율을 올린다', () => {
    const g = new Game(1);
    assert.equal(g.dmgMul(), 1);
    g.grant('cleric');
    g.grant('cleric');
    assert.ok(Math.abs(g.dmgMul() - 1.1) < 1e-9);
  });
});

describe('룰렛 · 강화', () => {
  it('티켓이 있어야 돌릴 수 있고 보상은 claim 에서 지급된다', () => {
    const g = new Game(11);
    assert.deepEqual(g.startRoulette(), { ok: false, reason: 'none' });
    g.tickets = 1;
    const r = g.startRoulette();
    assert.ok(r.ok);
    assert.equal(g.tickets, 0);
    assert.ok(g.pendingRoulette);
    assert.deepEqual(g.startRoulette(), { ok: false, reason: 'busy' });
    assert.ok(g.claimRoulette());
    assert.equal(g.pendingRoulette, null);
  });

  it('보석으로 등급 강화와 행운 강화를 한다', () => {
    const g = new Game(1);
    assert.deepEqual(g.upgradeGrade(2), { ok: false, reason: 'gems' });
    g.gems = 50;
    const m0 = g.gradeMul(2);
    assert.ok(g.upgradeGrade(2).ok);
    assert.ok(g.gradeMul(2) > m0);
    assert.ok(g.upgradeLuck().ok);
    assert.equal(g.luck, 1);
    assert.ok(g.gems < 50);
  });
});

describe('결정성 · 밸런스 가드', () => {
  it('같은 시드와 같은 행동이면 결과가 같다', () => {
    const a = simulate(123, 'smart');
    const b = simulate(123, 'smart');
    assert.deepEqual(a, b);
  });

  it('잘 하는 봇은 중반을 넘기고, 아무것도 안 하면 일찍 진다', () => {
    const good = simulate(1000, 'smart');
    assert.ok(good.wave >= 30, `smart wave ${good.wave}`);
    const g = new Game(1);
    run(g, 600);
    assert.equal(g.status, 'lost');
    assert.ok(g.wave < 15);
    assert.ok(FINAL_WAVE === 50);
  });
});
