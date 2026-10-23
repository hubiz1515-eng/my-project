import { Game } from '../src/game/engine/game';
import { STEP } from '../src/game/engine/config';
import { Bot, type Strategy } from './bot';

/** 웨이브별 평균 필드 가중치(= 화면에 얼마나 몬스터가 몰려 있는지)를 측정한다. */
const strategy = (process.argv[2] ?? 'smart') as Strategy;
const runs = Number(process.argv[3] ?? 10);
const buckets: Record<number, number[]> = {};
const ends: number[] = [];
for (let k = 0; k < runs; k++) {
  const g = new Game(1000 + k * 7919);
  const bot = new Bot(g, strategy);
  let step = 0;
  let acc = 0;
  let n = 0;
  while (g.status === 'playing' && g.time < 3500) {
    g.update(STEP);
    g.events.length = 0;
    if (++step % 12 === 0) bot.act();
    acc += g.fieldWeight;
    n++;
    if (g.wave > 0 && (g.waveDuration - g.waveClock) > g.waveDuration - STEP * 1.5) {
      // 웨이브 시작 직후: 직전 웨이브 평균을 기록
    }
    if (step % 60 === 0 && g.wave > 0) (buckets[g.wave] ??= []).push(g.fieldWeight);
  }
  ends.push(g.wave);
  void acc;
  void n;
}
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const row = Object.keys(buckets)
  .map(Number)
  .filter((w) => w % 5 === 0 || w === 1 || w === 3)
  .map((w) => `w${w}:${mean(buckets[w]).toFixed(0)}`)
  .join(' ');
console.log(`${strategy} end avg=${mean(ends).toFixed(1)} | field weight ${row}`);
