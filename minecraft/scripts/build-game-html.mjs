// game/index.html 을 앱에서 불러올 수 있는 문자열 모듈(src/game/gameHtml.ts)로 변환한다.
//   node scripts/build-game-html.mjs          # 생성
//   node scripts/build-game-html.mjs --check  # 최신 상태인지만 검사 (typecheck 에서 사용)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'game', 'index.html');
const out = path.join(root, 'src', 'game', 'gameHtml.ts');
const SAVE_MARKER = '<!--BLOCKCRAFT_SAVE-->';

const html = readFileSync(src, 'utf8');
if (html.split(SAVE_MARKER).length !== 2) {
  console.error(`game/index.html 에 ${SAVE_MARKER} 가 정확히 한 번 있어야 합니다.`);
  process.exit(1);
}

// JSON 문자열 리터럴로 만들면 따옴표·역슬래시·백틱 이스케이프 문제가 없다.
// (U+2028/2029 는 구버전 JS 엔진에서 문자열 리터럴을 깨뜨릴 수 있어 따로 이스케이프)
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
const literal = JSON.stringify(html).split(LS).join('\\u2028').split(PS).join('\\u2029');
const content =
  '// 자동 생성 파일 — 직접 수정하지 마세요.\n' +
  '// game/index.html 을 고친 뒤 `npm run build:game` 을 실행하세요.\n' +
  `export const GAME_HTML: string = ${literal};\n`;

if (process.argv.includes('--check')) {
  if (!existsSync(out) || readFileSync(out, 'utf8') !== content) {
    console.error('src/game/gameHtml.ts 가 game/index.html 과 다릅니다. `npm run build:game` 을 실행하세요.');
    process.exit(1);
  }
  console.log('gameHtml.ts 최신 상태');
} else {
  writeFileSync(out, content);
  console.log(`생성: ${path.relative(root, out)} (${(content.length / 1024).toFixed(1)} KB)`);
}
