/**
 * 픽업 QR 페이로드: `pickupdeal:v1:{orderId}:{pickupCode}`
 * 사장님 앱이 스캔 → orderId 로 주문을 찾고 코드가 일치하면 픽업 완료.
 */
const PREFIX = 'pickupdeal:v1:';
const PATTERN = /^pickupdeal:v1:([A-Za-z0-9_-]{6,64}):(\d{6})$/;

export function buildPickupQr(orderId: string, pickupCode: string): string {
  return `${PREFIX}${orderId}:${pickupCode}`;
}

export function parsePickupQr(data: string): { orderId: string; pickupCode: string } | null {
  const m = PATTERN.exec(data.trim());
  return m ? { orderId: m[1], pickupCode: m[2] } : null;
}
