// node --test game-server/test  (Node 22+, node:sqlite 를 D1 대역으로 사용)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handle, validate, cleanName } from '../worker.js';

function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  return {
    prepare(sql) {
      const st = db.prepare(sql);
      return { bind: (...a) => ({ first: async () => st.get(...a) ?? null, all: async () => ({ results: st.all(...a) }), run: async () => { st.run(...a); } }) };
    },
  };
}
const base = { diff: 2, pid: 'pid_aaaaaaaaaaaaaaaaaaaa', secret: 'sec_aaaaaaaaaaaaaaaaaaaaaaaaaaaa', name: '도깨비1', t: 120.46, kills: 300, lvl: 12, combo: 80 };
const post = (env, body, now) => handle(new Request('http://x/score', { method: 'POST', body: JSON.stringify(body) }), env, now);
const get = (env, q) => handle(new Request('http://x/leaderboard?' + q), env);

test('validate: 정상/불가능 기록 구분', () => {
  assert.equal(validate(base), null);
  assert.equal(validate({ ...base, diff: 4 }), 'diff');
  assert.equal(validate({ ...base, t: 5 }), 'time');
  assert.equal(validate({ ...base, t: 99999 }), 'time');
  assert.equal(validate({ ...base, kills: 99999 }), 'kills');
  assert.equal(validate({ ...base, combo: 301 }), 'combo');
  assert.equal(validate({ ...base, lvl: 500 }), 'stats');
  assert.equal(validate({ ...base, name: '   ' }), 'name');
  assert.equal(validate({ ...base, pid: 'short' }), 'pid');
  assert.equal(validate(null), 'body');
});

test('cleanName: 태그·제어문자 제거, 12자 제한', () => {
  assert.equal(cleanName('<b>철수</b>'), 'b철수/b');
  assert.equal(cleanName('a\u0000b'), 'ab');
  assert.equal(cleanName('가'.repeat(13)), null);
  assert.equal(cleanName('가'.repeat(12)), '가'.repeat(12));
});

test('등록 → 순위 → 더 낮은 기록은 무시 → 더 높은 기록은 갱신', async () => {
  const env = { DB: d1() };
  let r = await (await post(env, base, 1000)).json();
  assert.equal(r.ok, true); assert.equal(r.rank, 1); assert.equal(r.newBest, true); assert.equal(r.best.t, 120.5);
  r = await (await post(env, { ...base, t: 60, kills: 100 }, 20000)).json();
  assert.equal(r.best.t, 120.5); assert.equal(r.newBest, false);
  r = await (await post(env, { ...base, t: 200, kills: 500, combo: 150 }, 40000)).json();
  assert.equal(r.best.t, 200); assert.equal(r.newBest, true);
});

test('다른 사람의 기록은 secret 없이 덮어쓸 수 없다 / 연속 제출 제한', async () => {
  const env = { DB: d1() };
  await post(env, base, 1000);
  let res = await post(env, { ...base, secret: 'sec_bbbbbbbbbbbbbbbbbbbbbbbbbbbb', t: 500, kills: 900 }, 20000);
  assert.equal(res.status, 403);
  res = await post(env, base, 2000);
  assert.equal(res.status, 429);
});

test('난이도별 분리 + 정렬(생존 시간 → 처치 수) + me/mine 표시', async () => {
  const env = { DB: d1() };
  const mk = (n, diff, t, kills) => ({ ...base, diff, pid: `pid_${n}`.padEnd(20, 'x'), secret: `sec_${n}`.padEnd(20, 'x'), name: `P${n}`, t, kills, combo: 1 });
  await post(env, mk('a', 2, 100, 200), 1000);
  await post(env, mk('b', 2, 150, 100), 1000);
  await post(env, mk('c', 2, 100, 250), 1000);
  await post(env, mk('d', 0, 999, 900), 1000);
  const j = await (await get(env, 'diff=2&limit=2&pid=' + `pid_a`.padEnd(20, 'x'))).json();
  assert.deepEqual(j.rows.map((r) => r.name), ['Pb', 'Pc']);
  assert.equal(j.total, 3);
  assert.equal(j.mine.rank, 3); assert.equal(j.mine.name, 'Pa');
  const j0 = await (await get(env, 'diff=0')).json();
  assert.equal(j0.rows.length, 1);
  assert.equal(j0.rows[0].me, false);
  assert.ok(!('pid' in j0.rows[0]), 'pid 는 응답에 노출되지 않는다');
  assert.equal((await get(env, 'diff=9')).status, 400);
});

test('CORS 프리플라이트와 404', async () => {
  const env = { DB: d1() };
  const o = await handle(new Request('http://x/score', { method: 'OPTIONS' }), env);
  assert.equal(o.status, 204); assert.equal(o.headers.get('access-control-allow-origin'), '*');
  assert.equal((await handle(new Request('http://x/nope'), env)).status, 404);
});
