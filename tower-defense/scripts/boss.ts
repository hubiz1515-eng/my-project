import { Game } from '../src/game/engine/game';
import { STEP } from '../src/game/engine/config';
import { Bot, type Strategy } from './bot';

const strategy = (process.argv[2] ?? 'smart') as Strategy;
const seeds = Number(process.argv[3] ?? 8);
const rows: Record<number, number[]> = {};
for (let k = 0; k < seeds; k++) {
  const g = new Game(1000 + k * 7919);
  const bot = new Bot(g, strategy);
  const born = new Map<number, number>();
  let step = 0;
  while (g.status === 'playing' && g.time < 3500) {
    g.update(STEP);
    for (const e of g.enemies) if (e.boss && !born.has(e.uid)) born.set(e.uid, g.time);
    for (const ev of g.events) if (ev.t === 'kill' && ev.boss) {
      const w = Math.round(g.wave);
      (rows[w] ??= []).push(+(g.time - (born.get(ev.uid) ?? g.time)).toFixed(0));
    }
    g.events.length = 0;
    if (++step % 12 === 0) bot.act();
  }
  const bossAlive = g.enemies.find((e) => e.boss);
  if (bossAlive) (rows[-g.wave] ??= []).push(-1);
}
for (const [w, arr] of Object.entries(rows)) console.log('boss killed during wave', w, 'ttk(s):', arr.join(','));
