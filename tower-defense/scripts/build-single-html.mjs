// 게임 전체를 HTML 파일 하나로 만든다:  npm run build:html  →  dist-single/lucky-guardians.html
//
// 1) EXPO_PUBLIC_SINGLE=1 로 웹 빌드를 내보낸다 (metro.config.js 가 expo-router 를 주소 해시 라우터로 바꿔 줌)
// 2) JS 번들 · canvaskit.wasm · 폰트 · 효과음을 gzip + base64 로 HTML 안에 넣는다
// 3) 번들 안의 "/assets/..." 문자열(웹에서 에셋은 그냥 URL 문자열)을 __TD("...") 로 바꿔서,
//    실행할 때 풀어 둔 blob: 주소가 들어가게 한다 → 서버 없이 file:// 로 열어도 된다
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'dist-single');
const exportDir = join(outDir, '.export');
const target = join(outDir, 'lucky-guardians.html');

const MIME = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.js': 'text/javascript',
};

const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

console.log('› 웹 빌드 내보내기 (expo export)…');
execFileSync('npx', ['expo', 'export', '-p', 'web', '--clear', '--output-dir', exportDir], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, EXPO_PUBLIC_SINGLE: '1', CI: '1' },
});

// ── 번들 찾기
const jsDir = join(exportDir, '_expo', 'static', 'js', 'web');
const bundles = readdirSync(jsDir).filter((f) => f.endsWith('.js'));
if (bundles.length !== 1) throw new Error(`JS 번들이 1개여야 합니다: ${bundles.join(', ') || '(없음)'}`);
let code = readFileSync(join(jsDir, bundles[0]), 'utf8');
code = code.replace(/\n?\/\/# sourceMappingURL=.*$/gm, '');

// ── 에셋: "/assets/..." 문자열 → __TD("...")
const assets = new Map(); // key → 파일 경로
const ASSET_RE = /"\/assets\/([^"\\]+\.(?:wav|mp3|ogg|m4a|ttf|otf|png|jpe?g|gif|webp|svg))"/g;
code = code.replace(ASSET_RE, (whole, key) => {
  const file = join(exportDir, 'assets', decodeURIComponent(key));
  if (!existsSync(file)) {
    console.warn(`  ! 파일이 없어 그대로 둠: ${key}`);
    return whole;
  }
  assets.set(key, file);
  return `__TD(${JSON.stringify(key)})`;
});

// Skia 가 요청하는 wasm
const wasm = join(exportDir, 'canvaskit.wasm');
if (!existsSync(wasm)) throw new Error('canvaskit.wasm 이 없습니다 (npm install 의 postinstall 이 public/ 에 복사합니다)');
assets.set('canvaskit.wasm', wasm);

const leftovers = [...code.matchAll(/"\/(?:assets|_expo)\/[^"]+"/g)].map((m) => m[0]);
if (leftovers.length) console.warn(`  ! 처리되지 않은 경로 ${leftovers.length}개:`, [...new Set(leftovers)].slice(0, 5));

// ── 압축 + base64
const b64 = (buf) => gzipSync(buf, { level: 9 }).toString('base64');
const blobs = []; // { id, key, mime, b64 }
let rawTotal = 0;
for (const [key, file] of assets) {
  const buf = readFileSync(file);
  rawTotal += buf.length;
  blobs.push({ id: `td${blobs.length}`, key, mime: MIME[extname(file)] ?? 'application/octet-stream', b64: b64(buf) });
  console.log(`  · ${key.split('/').pop().slice(0, 40).padEnd(40)} ${mb(buf.length)}`);
}
const bundleBuf = Buffer.from(code, 'utf8');
rawTotal += bundleBuf.length;
const bundleB64 = b64(bundleBuf);
console.log(`  · ${'JS 번들'.padEnd(40)} ${mb(bundleBuf.length)}`);

// ── HTML 조각: 내보낸 index.html 의 <style> 과 favicon
const exported = readFileSync(join(exportDir, 'index.html'), 'utf8');
const resetStyle = /<style id="expo-reset">[\s\S]*?<\/style>/.exec(exported)?.[0] ?? '';
const title = /<title>([\s\S]*?)<\/title>/.exec(exported)?.[1] ?? '럭키 가디언즈';
const iconFile = join(root, 'assets', 'favicon.png');
const favicon = existsSync(iconFile) && statSync(iconFile).size < 64 * 1024
  ? `<link rel="icon" href="data:image/png;base64,${readFileSync(iconFile).toString('base64')}">`
  : '';

const manifest = blobs.map(({ id, key, mime }) => ({ id, key, mime }));

const boot = String.raw`
(function () {
  var root = document.getElementById('root');
  function fail(text) {
    root.innerHTML = '<div class="td-load"><b>럭키 가디언즈</b><span>' + text + '</span></div>';
  }
  if (typeof DecompressionStream === 'undefined' || !window.WebAssembly) {
    fail('이 브라우저에서는 실행할 수 없어요. 최신 Chrome · Safari · Edge · Firefox 로 열어 주세요.');
    return;
  }
  function bytes(b64) {
    if (Uint8Array.fromBase64) return Uint8Array.fromBase64(b64);
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function take(id) {
    var el = document.getElementById(id), text = el.textContent;
    el.remove();
    return new Response(new Blob([bytes(text)]).stream().pipeThrough(new DecompressionStream('gzip')));
  }
  var urls = {};
  window.__TD = function (key) {
    if (!urls[key]) console.warn('[td] 내장 에셋이 없어요:', key);
    return urls[key] || '';
  };
  var list = JSON.parse(document.getElementById('td-manifest').textContent);
  (async function () {
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      var blob = await take(a.id).blob();
      urls[a.key] = URL.createObjectURL(new Blob([blob], { type: a.mime }));
    }
    var code = await take('td-bundle').text();
    var s = document.createElement('script');
    s.textContent = code;
    document.body.appendChild(s);
  })().catch(function (e) {
    console.error(e);
    fail('불러오는 중 문제가 생겼어요. 페이지를 새로고침 해 주세요.');
  });
})();
`;

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
<meta name="theme-color" content="#0d1224">
<title>${title}</title>
${favicon}
${resetStyle}
<style>
  html, body { margin: 0; background: #0d1224; overscroll-behavior: none; -webkit-tap-highlight-color: transparent; }
  .td-load { margin: auto; display: flex; flex-direction: column; align-items: center; gap: 10px; color: #cfd6ff; font: 15px system-ui, sans-serif; text-align: center; padding: 24px; }
  .td-load b { font-size: 26px; color: #ffd34e; }
</style>
</head>
<body>
<noscript>자바스크립트를 켜야 실행할 수 있어요.</noscript>
<div id="root"><div class="td-load"><b>럭키 가디언즈</b><span>불러오는 중…</span></div></div>
<script type="application/json" id="td-manifest">${JSON.stringify(manifest)}</script>
${blobs.map((b) => `<script type="text/plain" id="${b.id}">${b.b64}</script>`).join('\n')}
<script type="text/plain" id="td-bundle">${bundleB64}</script>
<script>${boot}</script>
</body>
</html>
`;

writeFileSync(target, html);
rmSync(exportDir, { recursive: true, force: true });
console.log(`\n✔ ${target}\n  원본 ${mb(rawTotal)} → HTML ${mb(statSync(target).size)} (에셋 ${assets.size}개 포함)`);
