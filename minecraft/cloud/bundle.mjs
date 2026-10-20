// 드래그&드롭 배포용 묶음 만들기: npm run bundle  →  cloud/drop/ 폴더
//   drop/index.html                      게임 (../game/index.html)
//   drop/netlify/functions/api.mjs       서버 함수 (@netlify/blobs 까지 한 파일로 묶음 — 빌드/설치 없이 올릴 수 있게)
//   drop/_redirects                      /api/* → 함수 (config.path 를 못 읽는 경우의 보험)
// 이 drop 폴더를 Netlify 의 Deploys 화면에 통째로 끌어다 놓으면 된다.
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'drop');
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'netlify', 'functions'), { recursive: true });

copyFileSync(join(here, '..', 'game', 'index.html'), join(out, 'index.html'));
await build({
  entryPoints: [join(here, 'netlify', 'functions', 'api.mjs')],
  outfile: join(out, 'netlify', 'functions', 'api.mjs'),
  bundle: true, platform: 'node', format: 'esm', target: 'node22', legalComments: 'none',
  // 묶은 CommonJS 코드가 require 를 쓰는 경우를 위해
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});
// Netlify 가 소스에서 `export const config = {...}` 형태를 찾을 수 있게 esbuild 의 `var config` + `export { config }` 를 되돌린다
const fn = join(out, 'netlify', 'functions', 'api.mjs');
let code = readFileSync(fn, 'utf8');
const m = code.match(/\nvar config = (\{[^}]*\});\n/);
if (!m || !/export \{\s*config,\s*api_default as default\s*\};?\s*$/.test(code)) throw new Error('번들 형태가 예상과 달라요 (config export 를 찾지 못함)');
code = code.replace(m[0], '\n').replace(/export \{\s*config,\s*api_default as default\s*\};?\s*$/, `export const config = ${m[1]};\nexport { api_default as default };\n`);
writeFileSync(fn, code);
writeFileSync(join(out, '_redirects'), '/api/*  /.netlify/functions/api/:splat  200\n');
const kb = (f) => (statSync(join(out, f)).size / 1024).toFixed(0) + ' KB';
console.log(`drop/ 완성: index.html ${kb('index.html')}, netlify/functions/api.mjs ${kb('netlify/functions/api.mjs')}`);
