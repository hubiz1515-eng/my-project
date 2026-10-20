// 귀신 천마리 전체 순위 서버 (Cloudflare Worker + D1). 픽업딜 앱과는 완전히 별개의 서비스입니다.
//
//   GET  /leaderboard?diff=0..3&limit=50&pid=<내 pid>   → 난이도별 TOP 목록 (+ 내 순위)
//   POST /score  { diff, pid, secret, name, t, kills, lvl, combo }  → 최고 기록 갱신
//
// 한 명(pid)당 난이도마다 최고 기록 1개만 남는다. 기록 수정은 처음 등록할 때 정한 secret 을 아는 사람만 가능하다
// (서버에는 secret 의 SHA-256 해시만 저장). 점수는 클라이언트가 보내는 값이라, 서버는 불가능한 값만 걸러낸다
// (화면 조작이 아닌 "그럴듯한 위조"까지는 막을 수 없다 — README 참고).

const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
};
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });

export async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** 닉네임 정리: 제어문자·꺾쇠 제거, 공백 정리, 1~12자. 쓸 수 없으면 null */
export function cleanName(n) {
  if (typeof n !== 'string') return null;
  const s = n.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
  const len = [...s].length;
  return len >= 1 && len <= 12 ? s : null;
}

/** 불가능한 기록을 걸러낸다. 문제가 있으면 이유 문자열, 괜찮으면 null */
export function validate(b) {
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!b || typeof b !== 'object') return 'body';
  if (!int(b.diff, 0, 3)) return 'diff';
  if (typeof b.pid !== 'string' || !/^[\w-]{16,40}$/.test(b.pid)) return 'pid';
  if (typeof b.secret !== 'string' || !/^[\w-]{16,64}$/.test(b.secret)) return 'secret';
  if (!cleanName(b.name)) return 'name';
  if (typeof b.t !== 'number' || !(b.t >= 10 && b.t <= 7200)) return 'time';
  if (!int(b.kills, 0, 100000) || !int(b.lvl, 1, 100) || !int(b.combo, 0, 100000)) return 'stats';
  if (b.combo > b.kills) return 'combo';
  if (b.kills > b.t * 45 + 30) return 'kills'; // 필살기(한 번에 100마리+)까지 감안해도 초당 45킬은 불가능
  if (b.lvl > b.kills + 1) return 'level';
  return null;
}

const MIN_INTERVAL_MS = 5000; // 같은 pid 의 연속 제출 간격

export async function handle(req, env, now = Date.now()) {
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });

  if (req.method === 'GET' && url.pathname === '/leaderboard') {
    const diff = Number(url.searchParams.get('diff'));
    if (!Number.isInteger(diff) || diff < 0 || diff > 3) return json({ error: 'diff' }, 400);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50));
    const pid = url.searchParams.get('pid') || '';
    const { results } = await env.DB.prepare('SELECT pid,name,t,kills,lvl,combo FROM scores WHERE diff=? ORDER BY t DESC, kills DESC, updated ASC LIMIT ?').bind(diff, limit).all();
    const rows = results.map((r, i) => ({ rank: i + 1, name: r.name, t: r.t, kills: r.kills, lvl: r.lvl, combo: r.combo, me: r.pid === pid }));
    const total = (await env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE diff=?').bind(diff).first()).n;
    let mine = null;
    if (pid && !rows.some((r) => r.me)) {
      const m = await env.DB.prepare('SELECT name,t,kills,lvl,combo FROM scores WHERE diff=? AND pid=?').bind(diff, pid).first();
      if (m) mine = { rank: await rankOf(env, diff, m.t, m.kills), name: m.name, t: m.t, kills: m.kills, lvl: m.lvl, combo: m.combo, me: true };
    }
    return json({ diff, total, rows, mine }, 200, { 'cache-control': 'no-store' });
  }

  if (req.method === 'POST' && url.pathname === '/score') {
    let b;
    try { b = await req.json(); } catch { return json({ error: 'json' }, 400); }
    const bad = validate(b);
    if (bad) return json({ error: bad }, 400);
    const name = cleanName(b.name);
    const t = Math.round(b.t * 10) / 10;
    const hash = await sha256(b.secret);
    const row = await env.DB.prepare('SELECT secret_hash,t,kills,updated FROM scores WHERE diff=? AND pid=?').bind(b.diff, b.pid).first();
    if (row) {
      if (row.secret_hash !== hash) return json({ error: 'forbidden' }, 403);
      if (now - row.updated < MIN_INTERVAL_MS) return json({ error: 'too_fast' }, 429);
      if (t > row.t || (t === row.t && b.kills > row.kills)) {
        await env.DB.prepare('UPDATE scores SET name=?,t=?,kills=?,lvl=?,combo=?,updated=? WHERE diff=? AND pid=?').bind(name, t, b.kills, b.lvl, b.combo, now, b.diff, b.pid).run();
      } else {
        await env.DB.prepare('UPDATE scores SET name=?,updated=? WHERE diff=? AND pid=?').bind(name, now, b.diff, b.pid).run(); // 기록은 그대로, 닉네임만 갱신
      }
    } else {
      await env.DB.prepare('INSERT INTO scores (diff,pid,name,t,kills,lvl,combo,updated,secret_hash) VALUES (?,?,?,?,?,?,?,?,?)').bind(b.diff, b.pid, name, t, b.kills, b.lvl, b.combo, now, hash).run();
    }
    const best = await env.DB.prepare('SELECT t,kills,lvl,combo FROM scores WHERE diff=? AND pid=?').bind(b.diff, b.pid).first();
    const total = (await env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE diff=?').bind(b.diff).first()).n;
    return json({ ok: true, rank: await rankOf(env, b.diff, best.t, best.kills), total, best, newBest: !row || t > row.t });
  }

  return json({ error: 'not_found' }, 404);
}

async function rankOf(env, diff, t, kills) {
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE diff=? AND (t>? OR (t=? AND kills>?))').bind(diff, t, t, kills).first();
  return r.n + 1;
}

export default { fetch: (req, env) => handle(req, env).catch((e) => json({ error: 'server', detail: String(e?.message || e) }, 500)) };
