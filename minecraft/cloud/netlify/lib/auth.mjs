// 관리자 인증: 비밀번호는 Netlify 환경 변수 ADMIN_PASSWORD. 로그인하면 2시간짜리 서명 토큰을 준다 (서버에 세션을 저장하지 않음).
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { env, sleep } from './util.mjs';
import { throttleStore } from './store.mjs';

export const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_FAILS = 5, FAIL_WINDOW_MS = 15 * 60 * 1000;

export const adminPassword = () => env('ADMIN_PASSWORD');
export const adminEnabled = () => adminPassword().length > 0;

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest();
export function passwordMatches(input) {
  const pw = adminPassword();
  if (!pw || typeof input !== 'string') return false;
  return timingSafeEqual(sha256(input), sha256(pw));   // 같은 길이의 해시끼리 비교 → 길이/내용 노출 없음
}

const tokenKey = () => createHmac('sha256', adminPassword()).update('blockcraft-admin-token-v1').digest();   // 비밀번호를 바꾸면 기존 토큰은 모두 무효
const sign = (exp) => createHmac('sha256', tokenKey()).update(String(exp)).digest('base64url');

export function makeToken(now = Date.now()) {
  const exp = now + TOKEN_TTL_MS;
  return { token: `${exp}.${sign(exp)}`, expiresAt: exp };
}

export function verifyToken(token, now = Date.now()) {
  if (!adminEnabled() || typeof token !== 'string') return false;
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const exp = Number(token.slice(0, dot));
  if (!Number.isSafeInteger(exp) || exp <= now || exp > now + TOKEN_TTL_MS + 1000) return false;
  const given = Buffer.from(token.slice(dot + 1), 'utf8'), want = Buffer.from(sign(exp), 'utf8');
  return given.length === want.length && timingSafeEqual(given, want);
}

export function bearer(req) {
  const h = req.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

/* ---- 로그인 무차별 대입 방지: IP 별로 15분에 5번 실패하면 잠근다 ---- */
const ipKey = (ip) => 'ip/' + Buffer.from(String(ip || 'unknown'), 'utf8').toString('hex').slice(0, 120);

export async function loginLocked(ip, now = Date.now()) {
  try {
    const rec = await throttleStore().get(ipKey(ip), { type: 'json' });
    if (rec && rec.n >= MAX_FAILS && now - rec.t0 < FAIL_WINDOW_MS) return Math.ceil((rec.t0 + FAIL_WINDOW_MS - now) / 1000);
  } catch { /* 저장소 오류로 로그인 자체를 막지는 않는다 */ }
  return 0;
}

export async function recordLoginFailure(ip, now = Date.now()) {
  try {
    const st = throttleStore(), key = ipKey(ip), rec = await st.get(key, { type: 'json' });
    const fresh = !rec || now - rec.t0 >= FAIL_WINDOW_MS;
    await st.setJSON(key, { n: fresh ? 1 : rec.n + 1, t0: fresh ? now : rec.t0 });
  } catch { /* 위와 같음 */ }
  await sleep(300);   // 실패 응답을 조금 늦춰서 연타를 어렵게
}

export async function clearLoginFailures(ip) {
  try { await throttleStore().delete(ipKey(ip)); } catch { /* 무시 */ }
}
