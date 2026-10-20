import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDevServer } from '../dev-server.mjs';
import { makeToken, verifyToken } from '../netlify/lib/auth.mjs';
import { normalizeNick, validateSave } from '../netlify/lib/util.mjs';

const PW = 'test-pass-123';
let srv, dir, base;

const save = (extra = {}) => JSON.stringify({ v: 1, seed: 12345, e: [1, 2, 3, 4], ee: [], d: 0, qf: [0, 0, 0, 0], q: 2, p: [0.5, 20, 0.5, 0, 0, 0], hb: [1, 2, 3, 4, 5, 6, 7, 8, 9], sel: 0, t: 0.2, iv: [[100, 3]], s: [1, 0, 4, 1, 1], ...extra });
const call = async (path, { method = 'GET', body, token, headers = {} } = {}) => {
  const h = { ...headers };
  if (body !== undefined) h['content-type'] = h['content-type'] ?? 'application/json';
  if (token) h.authorization = 'Bearer ' + token;
  const res = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
  let j = null; try { j = await res.json(); } catch { /* 본문 없음 */ }
  return { status: res.status, headers: res.headers, j };
};
const put = (nick, data, extra = {}) => call('/api/save', { method: 'PUT', body: { nick, data, ...extra } });
const login = async (pw = PW) => (await call('/api/admin/login', { method: 'POST', body: { password: pw } }));

before(async () => {
  process.env.ADMIN_PASSWORD = PW;
  delete process.env.MAX_PLAYERS;
  dir = mkdtempSync(join(tmpdir(), 'bc-test-'));
  srv = await startDevServer({ blobsDir: dir, quiet: true });
  base = srv.url;
});
after(async () => { await srv.close(); rmSync(dir, { recursive: true, force: true }); });

describe('닉네임 정규화', () => {
  test('같은 닉네임은 대소문자·공백이 달라도 같은 키', () => {
    assert.equal(normalizeNick('  Jae  Yu ').key, normalizeNick('jae yu').key);
    assert.equal(normalizeNick('재유').nick, '재유');
  });
  test('NFC/NFD 한글도 같은 닉네임', () => {
    assert.equal(normalizeNick('재유'.normalize('NFD')).key, normalizeNick('재유'.normalize('NFC')).key);
  });
  test('잘못된 닉네임 거부', () => {
    for (const bad of ['', '   ', 'a'.repeat(17), '<script>', 'a/b', '😀', null, 5, undefined]) assert.equal(normalizeNick(bad), null, String(bad));
    assert.ok(normalizeNick('a'.repeat(16)));
    assert.ok(normalizeNick('한'.repeat(16)));
    assert.ok(normalizeNick('플레이어_1-a.b'));
    assert.equal(normalizeNick('x\ny').nick, 'x y', '줄바꿈은 공백 하나로');
  });
});

describe('저장 데이터 검증', () => {
  test('정상', () => { const r = validateSave(save()); assert.equal(r.ok, true); assert.equal(r.summary.q, 2); assert.equal(r.summary.ec, 1); });
  test('잘못된 것들', () => {
    for (const [name, v] of [['문자열 아님', 5], ['JSON 아님', '{bad'], ['배열', '[]'], ['버전', save({ v: 2 })], ['seed', save({ seed: 'x' })], ['위치', save({ p: [1, 2] })],
      ['편집 길이', save({ e: [1, 2, 3] })], ['편집 소수', save({ e: [1.5, 2, 3, 4] })], ['핫바', save({ hb: [1, 2] })], ['아이템', save({ iv: [[1]] })]]) {
      assert.equal(validateSave(v).ok, false, name);
    }
  });
  test('너무 큼', () => assert.equal(validateSave(save({ pad: 'x'.repeat(5_100_000) })).reason, 'too_large'));
  test('요약은 범위를 벗어난 값을 정리', () => { const r = validateSave(save({ q: 99, qf: [1, 1, 1, 1], d: 1 })); assert.deepEqual([r.summary.q, r.summary.pa, r.summary.ve, r.summary.dd, r.summary.d], [8, 1, 1, 1, 1]); });
});

describe('저장/불러오기', () => {
  test('ping', async () => {
    const r = await call('/api/ping');
    assert.equal(r.status, 200); assert.deepEqual([r.j.cloud, r.j.admin], [true, true]);
    assert.equal(r.headers.get('cache-control'), 'no-store');
  });
  test('리다이렉트 경로(/.netlify/functions/api/*)로 들어와도 같은 API', async () => {
    const r = await call('/.netlify/functions/api/ping');
    assert.equal(r.status, 200); assert.equal(r.j.cloud, true);
    assert.equal((await call('/.netlify/functions/api/save?nick=' + encodeURIComponent('새닉네임'))).j.rev, 0);
  });
  test('없는 닉네임은 data:null, rev 0', async () => {
    const r = await call('/api/save?nick=' + encodeURIComponent('새닉네임'));
    assert.equal(r.status, 200); assert.equal(r.j.data, null); assert.equal(r.j.rev, 0);
  });
  test('저장 → 불러오기 (대소문자 무시, 원래 표기 유지)', async () => {
    const d = save();
    const w = await put('Jae Yu', d, { baseRev: 0 });
    assert.equal(w.status, 200); assert.equal(w.j.rev, 1);
    const r = await call('/api/save?nick=' + encodeURIComponent('jae  yu'));
    assert.equal(r.j.data, d); assert.equal(r.j.rev, 1); assert.equal(r.j.nick, 'Jae Yu');
    assert.ok(Math.abs(r.j.savedAt - Date.now()) < 60_000, 'savedAt 은 밀리초 시각 그대로 (' + r.j.savedAt + ')');
    assert.equal(w.j.savedAt, r.j.savedAt);
  });
  test('rev 가 저장할 때마다 1씩 증가', async () => {
    let rev = (await put('rev-test', save(), { baseRev: 0 })).j.rev;
    for (let i = 0; i < 3; i++) { const w = await put('rev-test', save({ t: 0.3 + i / 10 }), { baseRev: rev }); assert.equal(w.status, 200); assert.equal(w.j.rev, rev + 1); rev = w.j.rev; }
    assert.equal(rev, 4);
  });
  test('낡은 baseRev 로 저장하면 409 (다른 기기가 먼저 저장)', async () => {
    await put('conf', save(), { baseRev: 0 });
    await put('conf', save({ t: 0.5 }), { baseRev: 1 });
    const w = await put('conf', save({ t: 0.9 }), { baseRev: 1 });
    assert.equal(w.status, 409); assert.equal(w.j.error, 'conflict'); assert.equal(w.j.rev, 2);
    const r = await call('/api/save?nick=conf');
    assert.equal(JSON.parse(r.j.data).t, 0.5, '충돌한 저장은 반영되지 않음');
  });
  test('force 는 덮어쓴다', async () => {
    const w = await put('conf', save({ t: 0.9 }), { baseRev: 1, force: true });
    assert.equal(w.status, 200); assert.equal(w.j.rev, 3);
    assert.equal(JSON.parse((await call('/api/save?nick=conf')).j.data).t, 0.9);
  });
  test('baseRev 없이 새 닉네임은 0 으로 취급, 기존 닉네임엔 409', async () => {
    assert.equal((await put('nobase', save())).status, 200);
    assert.equal((await put('nobase', save())).status, 409);
  });
  test('동시에 같은 rev 로 저장하면 하나만 성공', async () => {
    await put('race', save(), { baseRev: 0 });
    const rs = await Promise.all(Array.from({ length: 8 }, (_, i) => put('race', save({ t: i / 10 }), { baseRev: 1 })));
    const okCount = rs.filter((r) => r.status === 200).length;
    assert.equal(okCount, 1, rs.map((r) => r.status).join(','));
    assert.ok(rs.every((r) => r.status === 200 || r.status === 409));
    assert.equal((await call('/api/save?nick=race')).j.rev, 2);
  });
  test('잘못된 요청', async () => {
    assert.equal((await put('bad<nick>', save())).status, 400);
    assert.equal((await put('ok-nick', '{"v":1}')).status, 400);
    assert.equal((await call('/api/save?nick=')).status, 400);
    assert.equal((await call('/api/save', { method: 'PUT', body: 'not json' })).status, 400);
    assert.equal((await call('/api/save', { method: 'PUT', body: '{"nick":"a"}', headers: { 'content-type': 'text/plain' } })).status, 415);
    assert.equal((await call('/api/save', { method: 'PUT', body: '[]' })).status, 400);
    assert.equal((await call('/api/nope')).status, 404);
    assert.equal((await call('/api/save', { method: 'DELETE' })).status, 404);
  });
  test('큰 저장(약 1MB)도 왕복', async () => {
    const e = []; for (let i = 0; i < 90000; i++) e.push(i % 500, i % 70, i % 300, i % 20);
    const d = save({ e });
    assert.ok(d.length > 800_000);
    const w = await put('big', d, { baseRev: 0 });
    assert.equal(w.status, 200);
    assert.equal((await call('/api/save?nick=big')).j.data, d);
  });
  test('5MB 초과는 거부', async () => {
    const w = await put('toobig', save({ pad: 'x'.repeat(5_300_000) }), { baseRev: 0 });
    assert.ok(w.status === 400 || w.status === 413, String(w.status));
    assert.equal((await call('/api/save?nick=toobig')).j.data, null);
  });
  test('다른 사이트에서 온 쓰기 요청은 403', async () => {
    const w = await call('/api/save', { method: 'PUT', body: { nick: 'evil', data: save(), baseRev: 0 }, headers: { origin: 'https://evil.example' } });
    assert.equal(w.status, 403);
    const w2 = await call('/api/save', { method: 'PUT', body: { nick: 'evil', data: save(), baseRev: 0 }, headers: { 'sec-fetch-site': 'cross-site' } });
    assert.equal(w2.status, 403);
    assert.equal((await call('/api/save?nick=evil')).j.data, null);
    const ok = await call('/api/save', { method: 'PUT', body: { nick: 'evil', data: save(), baseRev: 0 }, headers: { origin: base, 'sec-fetch-site': 'same-origin' } });
    assert.equal(ok.status, 200);
  });
  test('CORS 헤더를 주지 않는다', async () => {
    const r = await call('/api/ping', { headers: { origin: 'https://evil.example' } });
    assert.equal(r.headers.get('access-control-allow-origin'), null);
  });
});

describe('관리자', () => {
  let token;
  test('토큰 없이 접근 불가', async () => {
    for (const [m, p] of [['GET', '/api/admin/players'], ['GET', '/api/admin/player?nick=a'], ['DELETE', '/api/admin/player?nick=a']]) assert.equal((await call(p, { method: m })).status, 401, p);
    assert.equal((await call('/api/admin/player', { method: 'PUT', body: { nick: 'a', data: save() } })).status, 401);
    assert.equal((await call('/api/admin/players', { token: 'garbage' })).status, 401);
  });
  test('틀린 비밀번호는 401', async () => {
    const r = await login('wrong'); assert.equal(r.status, 401); assert.equal(r.j.error, 'bad_password');
    assert.equal((await call('/api/admin/login', { method: 'POST', body: {} })).status, 401);
    assert.equal((await call('/api/admin/login', { method: 'POST', body: { password: ['x'] } })).status, 401);
  });
  test('로그인 → 토큰', async () => {
    const r = await login(); assert.equal(r.status, 200); assert.ok(r.j.token.includes('.')); assert.ok(r.j.expiresAt > Date.now());
    token = r.j.token;
  });
  test('플레이어 목록 (최신 저장 순, 요약 포함)', async () => {
    await put('요약테스트', save({ q: 5, qf: [1, 1, 0, 0] }), { baseRev: 0 });
    const r = await call('/api/admin/players', { token });
    assert.equal(r.status, 200); assert.ok(r.j.count >= 5);
    assert.equal(r.j.players[0].nick, '요약테스트');
    assert.deepEqual([r.j.players[0].q, r.j.players[0].pa, r.j.players[0].ve, r.j.players[0].dd], [5, 1, 1, 0]);
    assert.ok(r.j.players[0].size > 100);
    assert.ok(Math.abs(r.j.players[0].savedAt - Date.now()) < 60_000, '목록의 savedAt 도 밀리초 시각');
    const times = r.j.players.map((p) => p.savedAt); assert.deepEqual(times, [...times].sort((a, b) => b - a));
  });
  test('개별 조회 / 없는 닉네임 404', async () => {
    const r = await call('/api/admin/player?nick=' + encodeURIComponent('요약테스트'), { token });
    assert.equal(r.status, 200); assert.equal(JSON.parse(r.j.data).q, 5);
    assert.equal((await call('/api/admin/player?nick=nobody-here', { token })).status, 404);
    assert.equal((await call('/api/admin/player?nick=%3Cbad%3E', { token })).status, 400);
  });
  test('올리기(복원) → 게임에서 불러짐, 삭제', async () => {
    const d = save({ q: 7 });
    const up = await call('/api/admin/player', { method: 'PUT', token, body: { nick: 'Restored', data: d } });
    assert.equal(up.status, 200);
    assert.equal((await call('/api/save?nick=restored')).j.data, d);
    const del = await call('/api/admin/player?nick=Restored', { method: 'DELETE', token });
    assert.equal(del.status, 200);
    assert.equal((await call('/api/save?nick=restored')).j.data, null);
    assert.equal((await call('/api/admin/player?nick=Restored', { method: 'DELETE', token })).status, 404);
  });
  test('올리기는 잘못된 데이터를 거부', async () => {
    assert.equal((await call('/api/admin/player', { method: 'PUT', token, body: { nick: 'x', data: '{"v":3}' } })).status, 400);
  });
  test('관리자 쓰기도 cross-origin 이면 403', async () => {
    assert.equal((await call('/api/admin/login', { method: 'POST', body: { password: PW }, headers: { origin: 'https://evil.example' } })).status, 403);
  });
  test('토큰: 변조/만료/비밀번호 변경 시 무효', () => {
    const { token: t } = makeToken(Date.now());
    assert.equal(verifyToken(t), true);
    assert.equal(verifyToken(t.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'))), false);
    const [exp, sig] = t.split('.'); assert.equal(verifyToken(`${Number(exp) + 1000}.${sig}`), false);
    assert.equal(verifyToken(makeToken(Date.now() - 3 * 3600 * 1000).token), false, '만료');
    assert.equal(verifyToken(makeToken(Date.now() + 10 * 3600 * 1000).token), false, '너무 먼 미래');
    assert.equal(verifyToken(''), false); assert.equal(verifyToken(undefined), false); assert.equal(verifyToken('.abc'), false); assert.equal(verifyToken('abc'), false);
    process.env.ADMIN_PASSWORD = 'changed'; try { assert.equal(verifyToken(t), false); } finally { process.env.ADMIN_PASSWORD = PW; }
  });
  test('로그인 5번 실패하면 잠금 (맞는 비밀번호도 거부), 429 + retry-after', async () => {
    const d2 = mkdtempSync(join(tmpdir(), 'bc-test-lock-'));
    const s2 = await startDevServer({ blobsDir: d2, quiet: true });
    const b0 = base; base = s2.url;
    try {
      for (let i = 0; i < 5; i++) assert.equal((await login('nope' + i)).status, 401);
      const locked = await login(PW);
      assert.equal(locked.status, 429); assert.equal(locked.j.error, 'locked'); assert.ok(locked.j.retryAfter > 800);
      assert.ok(Number(locked.headers.get('retry-after')) > 800);
    } finally { base = b0; await s2.close(); rmSync(d2, { recursive: true, force: true }); }
  });
  test('성공하면 실패 횟수 초기화', async () => {
    const d2 = mkdtempSync(join(tmpdir(), 'bc-test-reset-'));
    const s2 = await startDevServer({ blobsDir: d2, quiet: true });
    const b0 = base; base = s2.url;
    try {
      for (let i = 0; i < 4; i++) await login('nope');
      assert.equal((await login()).status, 200);
      for (let i = 0; i < 4; i++) assert.equal((await login('nope')).status, 401);
      assert.equal((await login()).status, 200);
    } finally { base = b0; await s2.close(); rmSync(d2, { recursive: true, force: true }); }
  });
});

describe('설정', () => {
  test('ADMIN_PASSWORD 가 없으면 관리자 API 전체 503, ping 에 admin:false', async () => {
    const saved = process.env.ADMIN_PASSWORD; delete process.env.ADMIN_PASSWORD;
    try {
      assert.equal((await call('/api/ping')).j.admin, false);
      assert.equal((await call('/api/admin/login', { method: 'POST', body: { password: '' } })).status, 503);
      assert.equal((await call('/api/admin/players')).status, 503);
      const t = makeToken(); assert.equal(verifyToken(t.token), false);
    } finally { process.env.ADMIN_PASSWORD = saved; }
  });
  test('빈 문자열 비밀번호는 비활성으로 취급', async () => {
    const saved = process.env.ADMIN_PASSWORD; process.env.ADMIN_PASSWORD = '';
    try { assert.equal((await call('/api/admin/login', { method: 'POST', body: { password: '' } })).status, 503); } finally { process.env.ADMIN_PASSWORD = saved; }
  });
  test('MAX_PLAYERS 상한: 새 닉네임만 막고 기존 닉네임은 계속 저장', async () => {
    const d2 = mkdtempSync(join(tmpdir(), 'bc-test-cap-'));
    const s2 = await startDevServer({ blobsDir: d2, quiet: true });
    const b0 = base; base = s2.url; process.env.MAX_PLAYERS = '2';
    try {
      assert.equal((await put('a1', save(), { baseRev: 0 })).status, 200);
      assert.equal((await put('a2', save(), { baseRev: 0 })).status, 200);
      const full = await put('a3', save(), { baseRev: 0 });
      assert.equal(full.status, 507); assert.equal(full.j.error, 'full');
      assert.equal((await put('a1', save({ t: 0.7 }), { baseRev: 1 })).status, 200);
    } finally { delete process.env.MAX_PLAYERS; base = b0; await s2.close(); rmSync(d2, { recursive: true, force: true }); }
  });
});
