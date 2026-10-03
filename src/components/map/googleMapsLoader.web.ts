/// <reference types="google.maps" />

/** 키 오류(API 미사용 설정·리퍼러 제한·잘못된 키) — Google 은 로드 후 gm_authFailure 로 알린다 */
export const AUTH_FAILURE_EVENT = 'pickupdeal:gmaps-auth-failure';
let authFailed = false;
export const hasGoogleMapsAuthFailed = () => authFailed;

/** Google Maps JavaScript API 를 한 번만 로드 */
let loading: Promise<typeof google.maps> | null = null;

export function loadGoogleMaps(apiKey: string): Promise<typeof google.maps> {
  if (typeof window !== 'undefined' && window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const cb = '__pickupdealGoogleMapsReady';
    (window as unknown as Record<string, unknown>)[cb] = () => resolve(window.google.maps);
    // 키 오류(미사용 설정·리퍼러 제한 등)는 이 전역 콜백으로 통보된다
    (window as unknown as Record<string, unknown>).gm_authFailure = () => {
      authFailed = true;
      window.dispatchEvent(new Event(AUTH_FAILURE_EVENT));
      reject(new Error('auth'));
    };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&language=ko&region=KR&loading=async&callback=${cb}`;
    s.async = true;
    s.onerror = () => {
      loading = null;
      reject(new Error('network'));
    };
    document.head.appendChild(s);
  });
  return loading;
}
