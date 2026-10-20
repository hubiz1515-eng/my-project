// API 라우트 구현. 모든 응답은 JSON, 오류는 { ok:false, error:'코드' }.
import { adminEnabled, bearer, clearLoginFailures, loginLocked, makeToken, passwordMatches, recordLoginFailure, verifyToken } from './auth.mjs';
import { savesStore } from './store.mjs';
import { env, isSameOrigin, json, normalizeNick, readJsonBody, validateSave } from './util.mjs';

const PLAYER_PREFIX = 'p/';
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);   // 밀리초 시각은 32비트(|0)로 자르면 깨진다
const maxPlayers = () => Math.max(1, Number(env('MAX_PLAYERS')) || 500);   // 닉네임을 무한정 만들어 저장소를 채우는 것을 막는 상한

const badNick = () => json(400, { ok: false, error: 'bad_nick', message: '닉네임은 한글·영문·숫자·_ - . 공백으로 1~16자예요.' });
const metaOut = (key, m) => ({ nick: m.nick, rev: m.rev | 0, savedAt: num(m.savedAt), size: m.size | 0, q: m.q | 0, d: m.d | 0, pa: m.pa | 0, ve: m.ve | 0, dd: m.dd | 0, ec: m.ec | 0 });

function metadataFor(nick, rev, check) {
  return { nick, rev, savedAt: Date.now(), size: check.bytes, ...check.summary };
}

/** 저장 데이터를 기록한다. baseRev 가 서버의 현재 버전과 다르면(다른 기기가 먼저 저장) 409. force 면 무시하고 덮어쓴다. */
async function writeSave({ nick, key, data, baseRev, force }) {
  const check = validateSave(data);
  if (!check.ok) return json(400, { ok: false, error: check.reason === 'too_large' ? 'too_large' : 'bad_save', reason: check.reason });
  const st = savesStore();
  for (let attempt = 0; attempt < 3; attempt++) {
    const cur = await st.getMetadata(key);
    const curRev = cur ? (cur.metadata?.rev | 0) : 0;
    if (!force && (baseRev | 0) !== curRev) return json(409, { ok: false, error: 'conflict', rev: curRev, savedAt: num(cur?.metadata?.savedAt) });
    const meta = metadataFor(nick, curRev + 1, check);
    let res;
    if (!cur) {
      if ((await st.list({ prefix: PLAYER_PREFIX })).blobs.length >= maxPlayers()) return json(507, { ok: false, error: 'full', message: '저장 공간이 가득 찼어요.' });
      res = await st.set(key, data, { metadata: meta, onlyIfNew: true });
    } else if (cur.etag) {
      res = await st.set(key, data, { metadata: meta, onlyIfMatch: cur.etag });
    } else {
      res = await st.set(key, data, { metadata: meta });
    }
    if (res.modified !== false) return json(200, { ok: true, nick, rev: meta.rev, savedAt: meta.savedAt });
    // 읽은 직후 다른 요청이 먼저 기록함 → 다시 읽고 판단 (force 는 그대로 재시도)
  }
  const now = await st.getMetadata(key);
  return json(409, { ok: false, error: 'conflict', rev: now?.metadata?.rev | 0, savedAt: num(now?.metadata?.savedAt) });
}

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
    if (!rec) return json(200, { ok: true, nick: n.nick, rev: 0, savedAt: 0, data: null });
    return json(200, { ok: true, nick: rec.metadata?.nick || n.nick, rev: rec.metadata?.rev | 0, savedAt: num(rec.metadata?.savedAt), data: rec.data });
  }

  if (m === 'PUT' && path === '/api/save') {
    const r = await readJsonBody(req);
    if (r.error) return json(r.status, { ok: false, error: r.error });
    const n = normalizeNick(r.body.nick);
    if (!n) return badNick();
    return writeSave({ nick: n.nick, key: n.key, data: r.body.data, baseRev: r.body.baseRev, force: r.body.force === true });
  }

  /* ---------- 관리자 API ---------- */
  if (path.startsWith('/api/admin/')) {
    if (!adminEnabled()) return json(503, { ok: false, error: 'admin_disabled', message: 'Netlify 환경 변수 ADMIN_PASSWORD 가 설정되어 있지 않아요.' });

    if (m === 'POST' && path === '/api/admin/login') {
      const ip = ctx?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';
      const wait = await loginLocked(ip);
      if (wait > 0) return json(429, { ok: false, error: 'locked', retryAfter: wait, message: `로그인 시도가 너무 많아요. ${Math.ceil(wait / 60)}분 뒤에 다시 해 보세요.` }, { 'retry-after': String(wait) });
      const r = await readJsonBody(req, 4096);
      if (r.error) return json(r.status, { ok: false, error: r.error });
      if (!passwordMatches(r.body.password)) {
        await recordLoginFailure(ip);
        return json(401, { ok: false, error: 'bad_password', message: '비밀번호가 맞지 않아요.' });
      }
      await clearLoginFailures(ip);
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
          return meta ? metaOut(b.key, meta.metadata || {}) : null;
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
        return writeSave({ nick: n.nick, key: n.key, data: r.body.data, force: true });
      }
      const n = normalizeNick(url.searchParams.get('nick'));
      if (!n) return badNick();
      if (m === 'GET') {
        const rec = await savesStore().getWithMetadata(n.key, { type: 'text' });
        if (!rec) return json(404, { ok: false, error: 'not_found' });
        return json(200, { ok: true, nick: rec.metadata?.nick || n.nick, rev: rec.metadata?.rev | 0, savedAt: num(rec.metadata?.savedAt), data: rec.data });
      }
      if (m === 'DELETE') {
        const st = savesStore();
        if (!(await st.getMetadata(n.key))) return json(404, { ok: false, error: 'not_found' });
        await st.delete(n.key);
        return json(200, { ok: true });
      }
    }
  }

  return json(404, { ok: false, error: 'not_found' });
}
