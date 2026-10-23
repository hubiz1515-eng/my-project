import { Game } from '../src/game/engine/game';
import { STEP } from '../src/game/engine/config';
import { UNITS } from '../src/game/engine/units';
import { Bot, type Strategy } from './bot';

const strategy = (process.argv[2] ?? 'lazy') as Strategy;
const seed = Number(process.argv[3] ?? 1000);
const g = new Game(seed);
const bot = new Bot(g, strategy);
let step = 0;
let lastWave = 0;
const dps = () => {
  let d = 0;
  for (const s of g.slots) for (const u of s.units) {
    const def = UNITS[u.id];
    let mean = def.dmg * g.gradeMul(def.grade) * g.dmgMul();
    if (def.gamble) { let tw = 0, tm = 0; for (const [m, w] of def.gamble) { tw += w; tm += m * w; } mean *= tm / tw; }
    if (def.crit) mean *= 1 + def.crit.chance * (def.crit.mult - 1);
    d += mean / (def.cd / g.speedMul());
  }
  return d;
};
while (g.status === 'playing' && g.time < 3500) {
  g.update(STEP);
  g.events.length = 0;
  if (++step % 12 === 0) bot.act();
  if (g.wave !== lastWave) {
    lastWave = g.wave;
    const boss = g.enemies.find((e) => e.boss);
    console.log(`w${g.wave} t=${g.time.toFixed(0)} weight=${g.fieldWeight} units=${g.slots.reduce((a, s) => a + s.units.length, 0)} dps=${dps().toFixed(0)} gold=${g.gold.toFixed(0)} gems=${g.gems} sum=${g.stats.summons} boss=${boss ? Math.round(boss.hp) + '/' + Math.round(boss.maxHp) : '-'}`);
  }
}
console.log('END', g.status, 'wave', g.wave);
