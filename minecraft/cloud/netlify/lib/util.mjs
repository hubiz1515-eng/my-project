// 공용 유틸: 응답 만들기, 닉네임 정규화, 저장 데이터 검증
import { Buffer } from 'node:buffer';

export const NICK_MAX = 16;
export const MAX_SAVE_BYTES = 5_000_000;          // 저장 데이터(문자열) 최대 크기
export const MAX_EDIT_NUMBERS = 1_200_000;          // 고친 블록 목록(e/ee)의 최대 숫자 개수 (블록당 4개)
export const QUEST_COUNT = 8;                     // 게임의 목표 단계 수 (요약 표시용)

export function env(name) {
  const v = globalThis.Netlify?.env?.get?.(name) ?? process.env[name];
  return typeof v === 'string' && v.length > 0 ? v : '';
}

export function json(status, body, extra) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...extra,
    },
  });
}

/**
 * 닉네임 정규화. 같은 닉네임(대소문자·공백·전각/반각 차이 무시)이면 같은 키가 된다.
 * 허용: 한글/영문/숫자/_ - . 공백, 1~16자. 키는 소문자 UTF-8 의 hex 라서 URL 인코딩 문제가 없다.
 */
export function normalizeNick(raw) {
  if (typeof raw !== 'string') return null;
  const nick = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();   // NFKC: 전각/반각, 한글 호환 자모 등도 같은 닉네임으로 (클라이언트 normNick 과 같은 규칙)
  const len = [...nick].length;
  if (len < 1 || len > NICK_MAX) return null;
  if (!/^[\p{L}\p{N}_\-. ]+$/u.test(nick)) return null;
  return { nick, key: 'p/' + Buffer.from(nick.toLowerCase(), 'utf8').toString('hex') };
}

const isInt = Number.isInteger;
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, isInt(v) ? v : lo));

/**
 * 게임이 보낸 저장 데이터(문자열)를 검사한다. 통과하면 관리자 목록에 보여줄 요약을 함께 돌려준다.
 * 게임 버전이 올라가도 깨지지 않도록 모르는 필드는 허용하고, 구조가 확실히 잘못된 것만 막는다.
 */
export function validateSave(data) {
  const fail = (reason) => ({ ok: false, reason });
  if (typeof data !== 'string') return fail('data_type');
  const bytes = Buffer.byteLength(data, 'utf8');
  if (bytes > MAX_SAVE_BYTES) return fail('too_large');
  let o;
  try { o = JSON.parse(data); } catch { return fail('bad_json'); }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return fail('bad_shape');
  if (o.v !== 1) return fail('bad_version');
  if (!Number.isFinite(o.seed)) return fail('bad_seed');
  if (!Array.isArray(o.p) || o.p.length < 6 || !o.p.slice(0, 6).every(Number.isFinite)) return fail('bad_position');
  let edits = 0;
  for (const k of ['e', 'ee']) {
    if (o[k] === undefined) continue;
    const a = o[k];
    if (!Array.isArray(a) || a.length % 4 !== 0 || a.length > MAX_EDIT_NUMBERS || !a.every(isInt)) return fail('bad_edits');
    edits += a.length / 4;
  }
  if (o.hb !== undefined && (!Array.isArray(o.hb) || o.hb.length !== 9 || !o.hb.every(isInt))) return fail('bad_hotbar');
  if (o.iv !== undefined && (!Array.isArray(o.iv) || o.iv.length > 200 || !o.iv.every((p) => Array.isArray(p) && p.length === 2 && p.every(isInt)))) return fail('bad_items');
  if (o.s !== undefined && (!Array.isArray(o.s) || o.s.length > 16)) return fail('bad_settings');
  const qf = Array.isArray(o.qf) ? o.qf : [];
  return {
    ok: true,
    bytes,
    summary: {
      q: clampInt(o.q, 0, QUEST_COUNT),       // 달성한 목표 단계 (0~8)
      d: o.d === 1 ? 1 : 0,                    // 저장 당시 차원 (1 = 엔드)
      pa: qf[0] === 1 ? 1 : 0,                 // 포털을 열었는지
      ve: qf[1] === 1 ? 1 : 0,                 // 엔드에 가 봤는지
      dd: qf[3] === 1 ? 1 : 0,                 // 드래곤을 처치했는지
      ec: edits,                               // 고친 블록 수
    },
  };
}

/** 요청 본문(JSON)을 크기 제한을 두고 읽는다. 실패하면 { error, status } 를 돌려준다. */
export async function readJsonBody(req, limit = MAX_SAVE_BYTES + 4096) {
  const ct = req.headers.get('content-type') || '';
  if (!ct.toLowerCase().startsWith('application/json')) return { error: 'content_type', status: 415 };
  const len = Number(req.headers.get('content-length'));
  if (Number.isFinite(len) && len > limit) return { error: 'too_large', status: 413 };
  let text;
  try { text = await req.text(); } catch { return { error: 'bad_body', status: 400 }; }
  if (text.length > limit) return { error: 'too_large', status: 413 };
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'bad_json', status: 400 };
    return { body };
  } catch { return { error: 'bad_json', status: 400 }; }
}

/** 다른 사이트에서 몰래 보내는 쓰기 요청을 막는다 (브라우저가 보내는 Sec-Fetch-Site / Origin 확인). */
export function isSameOrigin(req, url) {
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = req.headers.get('origin');
  if (origin) {
    try { if (new URL(origin).host !== url.host) return false; } catch { return false; }
  }
  return true;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
