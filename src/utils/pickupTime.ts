/** 'HH:mm' → 다음에 오는 해당 시각(ms). 이미 지난 시각이면 내일로 넘긴다(자정 넘어 영업 대응). */
export function nextOccurrenceMs(hhmm: string, nowMs: number): number | null {
  const m = /^([01]?\d|2[0-3]):?([0-5]\d)$/.exec(hhmm.trim());
  if (!m) return null;
  const d = new Date(nowMs);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (d.getTime() <= nowMs) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function isTomorrow(ms: number, nowMs: number): boolean {
  return new Date(ms).toDateString() !== new Date(nowMs).toDateString();
}

/** 지금부터 minutes 뒤를 10분 단위로 올림한 'HH:mm' */
export function hhmmAfter(minutes: number, nowMs: number): string {
  const step = 10 * 60_000;
  const d = new Date(Math.ceil((nowMs + minutes * 60_000) / step) * step);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
