// Netlify 빌드 단계: 게임 HTML(../game/index.html)을 publish 폴더로 복사한다.
import { copyFileSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'game', 'index.html');
const outDir = join(here, 'public');

const html = readFileSync(src, 'utf8');
if (!html.includes('<canvas id="gl">') || !html.includes('window.blockcraft')) {
  console.error('game/index.html 이 블록크래프트 게임 파일이 아닌 것 같아요:', src);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
copyFileSync(src, join(outDir, 'index.html'));
console.log(`게임 복사 완료: public/index.html (${(statSync(join(outDir, 'index.html')).size / 1024).toFixed(0)} KB)`);
