/** 큰 숫자를 K/M/B/T 로 줄여 쓴다 (데미지 숫자, 골드 등) */
export function fmtNum(n: number): string {
  if (n < 1000) return String(Math.max(1, Math.round(n)));
  const units = ['K', 'M', 'B', 'T'];
  let v = n;
  let u = -1;
  while (v >= 1000 && u < units.length - 1) {
    v /= 1000;
    u++;
  }
  return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)).replace(/\.?0+$/, '') + units[u];
}
