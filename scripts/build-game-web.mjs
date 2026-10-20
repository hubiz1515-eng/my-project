// 탕탕 특공대 엔진(src/game/engine.ts)을 단일 HTML 파일(game-web/tangtang.html)로 묶는다.
// 사용: node scripts/build-game-web.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = mkdtempSync(join(tmpdir(), 'tangtang-'));
execFileSync('npx', ['tsc', '--ignoreConfig', 'src/game/engine.ts', '--outDir', out, '--target', 'es2020', '--module', 'es2020', '--skipLibCheck'], { stdio: 'inherit' });
const engine = readFileSync(join(out, 'engine.js'), 'utf8').replace(/^export /gm, '');
// 전체 순위 서버 주소: TANGTANG_API=https://tangtang-leaderboard.<계정>.workers.dev node scripts/build-game-web.mjs
const api = (process.env.TANGTANG_API || '').replace(/\/+$/, '');
const outDir = process.env.TANGTANG_OUT || 'game-web';
const html = readFileSync('scripts/game-web.html', 'utf8').replace('/*__ENGINE__*/', () => engine).replace("/*__API__*/''", () => JSON.stringify(api));
writeFileSync(`${outDir}/tangtang.html`, html);
// 광고(트레일러) 버전: 같은 코드에 AD 플래그만 켠다. 마지막 버튼이 같은 페이지에서 게임을 시작한다.
const ad = html.replace('/*__AD__*/false', 'true').replace('<title>탕탕 특공대 - 귀신 천마리</title>', '<title>탕탕 특공대 - 귀신 천마리 (광고)</title>');
writeFileSync(`${outDir}/ad.html`, ad);
console.log(`wrote ${outDir}/tangtang.html + ad.html`, (html.length / 1024).toFixed(1) + 'KB', api ? `(순위 서버: ${api})` : '(순위 서버 미설정)');
