// 탕탕 특공대 엔진(src/game/engine.ts)을 단일 HTML 파일(game-web/tangtang.html)로 묶는다.
// 사용: node scripts/build-game-web.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = mkdtempSync(join(tmpdir(), 'tangtang-'));
execFileSync('npx', ['tsc', '--ignoreConfig', 'src/game/engine.ts', '--outDir', out, '--target', 'es2020', '--module', 'es2020', '--skipLibCheck'], { stdio: 'inherit' });
const engine = readFileSync(join(out, 'engine.js'), 'utf8').replace(/^export /gm, '');
const html = readFileSync('scripts/game-web.html', 'utf8').replace('/*__ENGINE__*/', () => engine);
writeFileSync('game-web/tangtang.html', html);
console.log('wrote game-web/tangtang.html', (html.length / 1024).toFixed(1) + 'KB');
