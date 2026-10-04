/// <reference types="google.maps" />
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../constants/theme';
import { GOOGLE_MAPS_API_KEY, type MapPin, type PickupMapProps } from '../../types/map';
import { AUTH_FAILURE_EVENT, hasGoogleMapsAuthFailed, loadGoogleMaps } from './googleMapsLoader.web';
import { MapUnavailable } from './MapUnavailable';

/** 핀에 맞춰 확대할 때의 최대 줌 (15 ≈ 반경 1km 정도가 보이는 동네 단위) */
const MAX_FIT_ZOOM = 15;

const AUTH_ERROR = '지도를 표시할 수 없어요. Google Cloud 에서 Maps JavaScript API 사용 설정과 API 키 제한을 확인해 주세요.';

const PIN_CSS = `
.pd-pin{position:absolute;transform:translate(-50%,-100%);padding:4px 9px;border-radius:999px;background:#fff;
  border:2px solid ${colors.accent};color:${colors.accent};font:800 12px system-ui,sans-serif;white-space:nowrap;cursor:pointer;
  box-shadow:0 1px 4px rgba(0,0,0,.18)}
.pd-pin.on{background:${colors.accent};color:#fff;z-index:2}
.pd-pin:hover{z-index:3}
.pd-me{position:absolute;width:14px;height:14px;border-radius:50%;background:#2563eb;border:3px solid #fff;
  box-shadow:0 0 0 1px rgba(0,0,0,.2);transform:translate(-50%,-50%)}`;

/** 지도 위 HTML 오버레이 (Map ID 없이 커스텀 핀) */
function createHtmlOverlay(g: typeof google.maps, position: google.maps.LatLngLiteral, el: HTMLElement) {
  class HtmlOverlay extends g.OverlayView {
    onAdd() {
      this.getPanes()!.overlayMouseTarget.appendChild(el);
    }
    draw() {
      const p = this.getProjection().fromLatLngToDivPixel(new g.LatLng(position));
      if (p) {
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y}px`;
      }
    }
    onRemove() {
      el.remove();
    }
  }
  return new HtmlOverlay();
}

/** 웹 지도: Google Maps JavaScript API */
export function PickupMap({ user, pins, selectedId, onSelectPin }: PickupMapProps) {
  const containerRef = useRef<View>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const gRef = useRef<typeof google.maps | null>(null);
  const overlaysRef = useRef<google.maps.OverlayView[]>([]);
  const onSelectRef = useRef(onSelectPin);
  onSelectRef.current = onSelectPin;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(GOOGLE_MAPS_API_KEY ? null : '지도 API 키가 설정되지 않았어요');

  // 키 오류 시 Google 의 기본 오류 화면 대신 안내 표시 (목록은 계속 사용 가능)
  useEffect(() => {
    if (hasGoogleMapsAuthFailed()) setError(AUTH_ERROR);
    const onFail = () => setError(AUTH_ERROR);
    window.addEventListener(AUTH_FAILURE_EVENT, onFail);
    return () => window.removeEventListener(AUTH_FAILURE_EVENT, onFail);
  }, []);

  // 지도 생성
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return;
    let alive = true;
    loadGoogleMaps(GOOGLE_MAPS_API_KEY)
      .then((g) => {
        if (!alive || !containerRef.current) return;
        if (!document.getElementById('pd-pin-css')) {
          const style = document.createElement('style');
          style.id = 'pd-pin-css';
          style.textContent = PIN_CSS;
          document.head.appendChild(style);
        }
        gRef.current = g;
        mapRef.current = new g.Map(containerRef.current as unknown as HTMLElement, {
          center: { lat: user.latitude, lng: user.longitude },
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
        });
        setReady(true);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message === 'auth' ? AUTH_ERROR : '지도를 불러오지 못했어요. 네트워크를 확인해 주세요.');
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 핀 그리기 + 전체 보기
  const pinKey = pins.map((p) => `${p.id}:${p.label}`).join(',');
  useEffect(() => {
    const g = gRef.current;
    const map = mapRef.current;
    if (!ready || !g || !map) return;
    overlaysRef.current.forEach((o) => o.setMap(null));
    const me = document.createElement('div');
    me.className = 'pd-me';
    const overlays = [createHtmlOverlay(g, { lat: user.latitude, lng: user.longitude }, me)];
    pins.forEach((pin: MapPin) => {
      const el = document.createElement('div');
      el.className = 'pd-pin' + (pin.id === selectedId ? ' on' : '');
      el.textContent = pin.label;
      el.title = pin.title ?? '';
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `${pin.title ?? '매장'} ${pin.label}`);
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onSelectRef.current(pin.id);
      });
      overlays.push(createHtmlOverlay(g, { lat: pin.latitude, lng: pin.longitude }, el));
    });
    overlays.forEach((o) => o.setMap(map));
    overlaysRef.current = overlays;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pinKey, selectedId, user.latitude, user.longitude]);

  useEffect(() => {
    const g = gRef.current;
    const map = mapRef.current;
    if (!ready || !g || !map) return;
    if (pins.length === 0) {
      map.setCenter({ lat: user.latitude, lng: user.longitude });
      map.setZoom(14);
      return;
    }
    const b = new g.LatLngBounds();
    b.extend({ lat: user.latitude, lng: user.longitude });
    pins.forEach((p) => b.extend({ lat: p.latitude, lng: p.longitude }));
    // 위쪽은 '내 주변 / 서울 전체' 버튼, 오른쪽은 확대/축소 버튼만큼 더 비운다
    map.fitBounds(b, { top: 70, right: 70, bottom: 30, left: 40 });
    // 매장이 내 위치와 아주 가까우면 최대로 확대돼 동네가 안 보이므로 상한을 둔다
    g.event.addListenerOnce(map, 'idle', () => {
      if ((map.getZoom() ?? 0) > MAX_FIT_ZOOM) map.setZoom(MAX_FIT_ZOOM);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pins.map((p) => p.id).join(',')]);

  // 매장 선택 시 그 위치로
  const selected = pins.find((p) => p.id === selectedId);
  useEffect(() => {
    if (ready && selected) mapRef.current?.panTo({ lat: selected.latitude, lng: selected.longitude });
  }, [ready, selected]);

  if (error) return <MapUnavailable message={error} />;
  return <View ref={containerRef} style={styles.map} accessibilityLabel="구글 지도" />;
}

const styles = StyleSheet.create({
  map: { flex: 1, backgroundColor: colors.mapBg },
});
