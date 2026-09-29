/**
 * WebView 안에서 카카오맵 JS SDK 를 띄우는 HTML.
 * RN → WebView : window.setState({ center, user, pins, selectedId })
 * WebView → RN : postMessage({ type: 'ready' | 'select', id? })
 * ⚠️ 카카오 개발자 콘솔 > 플랫폼 > Web 에 `KAKAO_BASE_URL` 도메인을 등록해야 지도가 뜬다.
 */
export const KAKAO_BASE_URL = 'https://localhost';

export function buildKakaoMapHtml(jsKey: string): string {
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; }
  .pin { transform: translate(-50%, -100%); padding: 4px 8px; border-radius: 999px; background: #fff;
    border: 2px solid #ef4444; color: #ef4444; font: 800 12px sans-serif; white-space: nowrap; }
  .pin.sel { background: #ef4444; color: #fff; }
  .me { width: 16px; height: 16px; border-radius: 50%; background: #2563eb; border: 3px solid #fff;
    box-shadow: 0 0 0 1px rgba(0,0,0,.2); transform: translate(-50%, -50%); }
</style>
</head><body>
<div id="map"></div>
<script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(jsKey)}&autoload=false"></script>
<script>
  var post = function (m) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  var map, overlays = [], meOverlay = null, lastCenterKey = '';
  if (!window.kakao) { post({ type: 'error', message: 'sdk-load-failed' }); }
  else kakao.maps.load(function () {
    map = new kakao.maps.Map(document.getElementById('map'), { center: new kakao.maps.LatLng(37.4979, 127.0276), level: 4 });
    window.setState = function (s) {
      overlays.forEach(function (o) { o.setMap(null); }); overlays = [];
      if (meOverlay) meOverlay.setMap(null);
      meOverlay = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(s.user.latitude, s.user.longitude), content: '<div class="me"></div>', zIndex: 1 });
      meOverlay.setMap(map);
      s.pins.forEach(function (p) {
        var el = document.createElement('div');
        el.className = 'pin' + (p.id === s.selectedId ? ' sel' : '');
        el.textContent = p.label;
        el.onclick = function () { post({ type: 'select', id: p.id }); };
        var o = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(p.latitude, p.longitude), content: el, zIndex: p.id === s.selectedId ? 3 : 2 });
        o.setMap(map); overlays.push(o);
      });
      var key = s.center.latitude + ',' + s.center.longitude;
      if (key !== lastCenterKey) { lastCenterKey = key; map.panTo(new kakao.maps.LatLng(s.center.latitude, s.center.longitude)); }
    };
    post({ type: 'ready' });
  });
</script>
</body></html>`;
}
