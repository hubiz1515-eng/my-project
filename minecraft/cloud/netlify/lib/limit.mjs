// 요청 횟수 제한 (IP 별, 시간 창 안에서 N 번). 횟수는 조건부 쓰기(etag)로 원자적으로 올린다 → 동시에 여러 요청을 보내도 한 번씩만 센다.
// 저장소 오류가 나면 예외를 그대로 던진다 (제한을 못 확인하는데 통과시키지 않음).
import { Buffer } from 'node:buffer';
import { throttleStore, writeLanded } from './store.mjs';

const keyOf = (scope, ip) => `${scope}/` + Buffer.from(String(ip || 'unknown'), 'utf8').toString('hex').slice(0, 120);

/** 한 번 쓸 자리를 가져온다. { ok:true } 또는 { ok:false, retryAfter(초) } */
export async function takeSlot(scope, ip, max, windowMs, now = Date.now()) {
  const st = throttleStore(), key = keyOf(scope, ip);
  for (let i = 0; i < 8; i++) {
    const cur = await st.getWithMetadata(key, { type: 'json' });
    const rec = cur && cur.data && typeof cur.data.n === 'number' && now - cur.data.t0 < windowMs ? cur.data : null;
    if (rec && rec.n >= max) return { ok: false, retryAfter: Math.max(1, Math.ceil((rec.t0 + windowMs - now) / 1000)) };
    const next = { n: (rec ? rec.n : 0) + 1, t0: rec ? rec.t0 : now };
    const res = cur ? (cur.etag ? await st.setJSON(key, next, { onlyIfMatch: cur.etag }) : await st.setJSON(key, next)) : await st.setJSON(key, next, { onlyIfNew: true });
    if (cur && !cur.etag ? res.modified === true : writeLanded(res)) return { ok: true };
    // modified:false(다른 요청이 먼저 올림) 이거나 확인 불가 → 다시 읽고 시도
  }
  return { ok: false, retryAfter: 1 };   // 경합이 계속되면 거부 (안전한 쪽)
}

export async function clearSlot(scope, ip) {
  try { await throttleStore().delete(keyOf(scope, ip)); } catch { /* 지우지 못해도 시간이 지나면 풀린다 */ }
}
