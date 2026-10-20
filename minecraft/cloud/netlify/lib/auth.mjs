// 관리자 인증: 비밀번호는 Netlify 환경 변수 ADMIN_PASSWORD. 로그인하면 2시간짜리 서명 토큰을 준다 (서버에 세션을 저장하지 않음).
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { env } from './util.mjs';

export const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
export const LOGIN_MAX_ATTEMPTS = 5, LOGIN_WINDOW_MS = 15 * 60 * 1000;   // IP 당 15분에 5번까지 (맞든 틀리든 시도 횟수로 센다)

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
