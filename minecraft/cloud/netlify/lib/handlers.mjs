// API 라우트 구현. 모든 응답은 JSON, 오류는 { ok:false, error:'코드' }.
import { adminEnabled, bearer, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS, makeToken, passwordMatches, verifyToken } from './auth.mjs';
import { clearSlot, takeSlot } from './limit.mjs';
import { savesStore, tombStore } from './store.mjs';
import { env, isSameOrigin, json, normalizeNick, readJsonBody, sleep, validateSave } from './util.mjs';

const PLAYER_PREFIX = 'p/';
const CID_RE = /^[A-Za-z0-9_-]{8,40}$/;
const CREATE_WINDOW_MS = 60 * 60 * 1000;
const createMax = () => Math.max(1, Number(env('CREATE_LIMIT')) || 10);   // 한 IP 가 한 시간에 새로 만들 수 있는 닉네임 수
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);   // 밀리초 시각은 32비트(|0)로 자르면 깨진다
const maxPlayers = () => Math.max(1, Number(env('MAX_PLAYERS')) || 500);   // 닉네임을 무한정 만들어 저장소를 채우는 것을 막는 상한

const badNick = () => json(400, { ok: false, error: 'bad_nick', message: '닉네임은 한글·영문·숫자·_ - . 공백으로 1~16자예요.' });
const metaOut = (m) => ({ nick: m.nick, rev: m.rev | 0, savedAt: num(m.savedAt), size: m.size | 0, q: m.q | 0, d: m.d | 0, pa: m.pa | 0, ve: m.ve | 0, dd: m.dd | 0, ec: m.ec | 0 });
let warnedNoEtag = false;

/** 현재 버전. 기록이 있으면 그 rev, 삭제된 닉네임이면 삭제 때 남긴 값(번호가 되돌아가지 않게), 처음이면 0 */
async function readState(key) {
  const cur = await savesStore().getMetadata(key);
  if (cur) return { cur, rev: cur.metadata?.rev | 0 };
  const t = await tombStore().get(key);
  return { cur: null, rev: Number(t) | 0 };
}

/**
 * 저장 데이터를 기록한다.
 *  - baseRev(클라이언트가 마지막으로 본 버전)가 서버의 현재 버전과 다르면 다른 기기가 먼저 저장한 것 → 409.
 *    단, 마지막으로 쓴 쪽이 같은 접속(cid)이면 다른 기기가 끼어들지 않은 것이므로 허용한다 (응답이 유실돼 baseRev 가 낡은 경우).
 *  - 같은 접속의 seq 가 이미 반영된 것보다 작거나 같으면 늦게 도착한 옛 요청이라 무시한다 (더 새로운 저장을 되돌리지 않게).
 *  - force 면 버전 검사를 건너뛴다.
 */
async function writeSave({ nick, key, data, baseRev, force, cid, seq, ip, admin }) {
  const check = validateSave(data);
  if (!check.ok) return json(400, { ok: false, error: check.reason === 'too_large' ? 'too_large' : 'bad_save', reason: check.reason });
  const st = savesStore();
  let slotTaken = false;
  for (let attempt = 0; attempt < (force ? 6 : 3); attempt++) {
    const { cur, rev: curRev } = await readState(key);
    const lastCid = cur?.metadata?.cid || '', lastSq = cur?.metadata?.sq | 0;
    const sameSession = !!cid && lastCid === cid;
    if (!force) {
      if (sameSession && seq > 0 && seq <= lastSq) return json(200, { ok: true, nick, rev: curRev, savedAt: num(cur.metadata?.savedAt), ignored: true });
      if (!sameSession && (baseRev | 0) !== curRev) return json(409, { ok: false, error: 'conflict', rev: curRev, savedAt: num(cur?.metadata?.savedAt) });
    }
    if (!cur && !slotTaken) {   // 새 닉네임 만들기: 상한과 IP 별 횟수 제한 (관리자 업로드는 제외)
      if (!admin) {
        if ((await st.list({ prefix: PLAYER_PREFIX })).blobs.length >= maxPlayers()) return json(507, { ok: false, error: 'full', message: '서버 저장 공간이 가득 찼어요.' });
        const slot = await takeSlot('create', ip, createMax(), CREATE_WINDOW_MS);
        if (!slot.ok) return json(429, { ok: false, error: 'rate_limited', retryAfter: slot.retryAfter, message: '새 닉네임을 너무 많이 만들었어요. 잠시 뒤에 다시 해 보세요.' }, { 'retry-after': String(slot.retryAfter) });
      }
      slotTaken = true;
    }
    const meta = { nick, rev: curRev + 1, savedAt: Date.now(), size: check.bytes, ...check.summary, cid: cid || '', sq: seq || 0 };
    let res, conditional = true;
    if (!cur) res = await st.set(key, data, { metadata: meta, onlyIfNew: true });
    else if (cur.etag) res = await st.set(key, data, { metadata: meta, onlyIfMatch: cur.etag });
    else {   // 이 저장소가 etag 를 주지 않으면 원자적 비교를 할 수 없다 (rev 비교만으로 동작)
      if (!warnedNoEtag) { warnedNoEtag = true; console.warn('[blockcraft api] Blobs 가 etag 를 주지 않아 조건부 쓰기를 쓸 수 없어요'); }
      conditional = false;
      res = await st.set(key, data, { metadata: meta });
    }
    if (res.modified === false) continue;   // 읽은 직후 다른 요청이 먼저 기록함 → 다시 읽고 판단
    let landed = res.modified === true && (!conditional || !!res.etag);
    if (!landed && res.modified === true) {   // etag 없는 '성공' — 실제로 반영됐는지 확인 (412 외의 오류도 modified:true 로 올 수 있다)
      const chk = await st.getMetadata(key);
      landed = !!chk && chk.metadata?.rev === meta.rev && chk.metadata?.savedAt === meta.savedAt && (chk.metadata?.cid || '') === meta.cid;
    }
    if (!landed) throw new Error('blobs write was not confirmed');
    return json(200, { ok: true, nick, rev: meta.rev, savedAt: meta.savedAt });
  }
  const now = await readState(key);
  return json(409, { ok: false, error: 'conflict', rev: now.rev, savedAt: num(now.cur?.metadata?.savedAt) });
}

const clientIp = (req, ctx) => ctx?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';

export async function route(req, ctx) {
  const url = new URL(req.url);
  // /api/* 로 들어오든, 리다이렉트로 /.netlify/functions/api/* 로 들어오든 같은 경로로 본다
  const path = url.pathname.replace(/^\/\.netlify\/functions\/api(?=\/|$)/, '/api').replace(/\/+$/, '') || '/';
  const m = req.method;
  const write = m !== 'GET' && m !== 'HEAD';

  if (write && !isSameOrigin(req, url)) return json(403, { ok: false, error: 'cross_origin' });

  /* ---------- 공개 API ---------- */
  if (m === 'GET' && path === '/api/ping') return json(200, { ok: true, cloud: true, admin: adminEnabled() });

  if (m === 'GET' && path === '/api/save') {
    const n = normalizeNick(url.searchParams.get('nick'));
    if (!n) return badNick();
    const rec = await savesStore().getWithMetadata(n.key, { type: 'text' });
    if (!rec) return json(200, { ok: true, nick: n.nick, rev: (await readState(n.key)).rev, savedAt: 0, cid: '', data: null });
    return json(200, { ok: true, nick: rec.metadata?.nick || n.nick, rev: rec.metadata?.rev | 0, savedAt: num(rec.metadata?.savedAt), cid: rec.metadata?.cid || '', data: rec.data });
  }

  if (m === 'PUT' && path === '/api/save') {
    const r = await readJsonBody(req);
    if (r.error) return json(r.status, { ok: false, error: r.error });
    const n = normalizeNick(r.body.nick);
    if (!n) return badNick();
    const b = r.body;
    return writeSave({
      nick: n.nick, key: n.key, data: b.data, baseRev: b.baseRev, force: b.force === true,
      cid: typeof b.cid === 'string' && CID_RE.test(b.cid) ? b.cid : '', seq: Number.isSafeInteger(b.seq) && b.seq > 0 ? b.seq : 0, ip: clientIp(req, ctx),
    });
  }

  /* ---------- 관리자 API ---------- */
  if (path.startsWith('/api/admin/')) {
    if (!adminEnabled()) return json(503, { ok: false, error: 'admin_disabled', message: 'Netlify 환경 변수 ADMIN_PASSWORD 가 설정되어 있지 않아요.' });

    if (m === 'POST' && path === '/api/admin/login') {
      const ip = clientIp(req, ctx);
      const slot = await takeSlot('login', ip, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS);   // 시도할 때마다 먼저 횟수를 센다 (동시에 여러 번 시도해도 5번 넘게 비교하지 못함)
      if (!slot.ok) return json(429, { ok: false, error: 'locked', retryAfter: slot.retryAfter, message: `로그인 시도가 너무 많아요. ${Math.ceil(slot.retryAfter / 60)}분 뒤에 다시 해 보세요.` }, { 'retry-after': String(slot.retryAfter) });
      const r = await readJsonBody(req, 4096);
      if (r.error) return json(r.status, { ok: false, error: r.error });
      if (!passwordMatches(r.body.password)) {
        await sleep(300);   // 실패 응답을 조금 늦춰서 연타를 어렵게
        return json(401, { ok: false, error: 'bad_password', message: '비밀번호가 맞지 않아요.' });
      }
      await clearSlot('login', ip);
      return json(200, { ok: true, ...makeToken() });
    }

    if (!verifyToken(bearer(req))) return json(401, { ok: false, error: 'unauthorized' });

    if (m === 'GET' && path === '/api/admin/players') {
      const st = savesStore();
      const { blobs } = await st.list({ prefix: PLAYER_PREFIX });
      const rows = [];
      for (let i = 0; i < blobs.length; i += 20) {
        const part = await Promise.all(blobs.slice(i, i + 20).map(async (b) => {
          const meta = await st.getMetadata(b.key);
          return meta ? metaOut(meta.metadata || {}) : null;
        }));
        rows.push(...part.filter(Boolean));
      }
      rows.sort((a, b) => b.savedAt - a.savedAt);
      return json(200, { ok: true, count: rows.length, max: maxPlayers(), players: rows });
    }

    if (path === '/api/admin/player') {
      if (m === 'PUT') {   // 저장 데이터 올리기(복원/이전)
        const r = await readJsonBody(req);
        if (r.error) return json(r.status, { ok: false, error: r.error });
        const n = normalizeNick(r.body.nick);
        if (!n) return badNick();
        return writeSave({ nick: n.nick, key: n.key, data: r.body.data, force: true, cid: 'admin', admin: true });
      }
      const n = normalizeNick(url.searchParams.get('nick'));
      if (!n) return badNick();
      if (m === 'GET') {
        const rec = await savesStore().getWithMetadata(n.key, { type: 'text' });
        if (!rec) return json(404, { ok: false, error: 'not_found' });
        return json(200, { ok: true, nick: rec.metadata?.nick || n.nick, rev: rec.metadata?.rev | 0, savedAt: num(rec.metadata?.savedAt), data: rec.data });
      }
      if (m === 'DELETE') {
        const st = savesStore(), cur = await st.getMetadata(n.key);
        if (!cur) return json(404, { ok: false, error: 'not_found' });
        // 삭제해도 버전 번호는 이어가야 한다: 열려 있던 낡은 화면이 새 월드를 같은 번호로 덮어쓰지 못하게 (먼저 묘비를 쓰고 지운다)
        await tombStore().set(n.key, String((cur.metadata?.rev | 0) + 1));
        await st.delete(n.key);
        return json(200, { ok: true });
      }
    }
  }

  return json(404, { ok: false, error: 'not_found' });
}
