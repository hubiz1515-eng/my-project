export const formatWon = (n: number) => `${n.toLocaleString('ko-KR')}원`;

export const discountPercent = (original: number, discounted: number) =>
  original > 0 ? Math.round((1 - discounted / original) * 100) : 0;

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/** 픽업 마감까지 남은 시간 문구. 이미 지났으면 null */
export function formatTimeLeft(endMs: number, nowMs: number): string | null {
  const diffMin = Math.floor((endMs - nowMs) / 60_000);
  if (diffMin < 0) return null;
  if (diffMin < 1) return '곧 마감';
  if (diffMin < 60) return `${diffMin}분 남음`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m === 0 ? `${h}시간 남음` : `${h}시간 ${m}분 남음`;
}

export function formatClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 썸네일용 첫 글자 — "[테스트] 강남 베이커리" 처럼 기호로 시작해도 글자를 고른다 */
export function initialOf(name: string): string {
  const cleaned = name.replace(/^\s*[\[(【][^\])】]*[\])】]\s*/, '');
  return Array.from(cleaned.match(/[\p{L}\p{N}]/u)?.[0] ?? cleaned.trim()[0] ?? '?')[0];
}
