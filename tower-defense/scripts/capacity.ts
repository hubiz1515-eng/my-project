import { Game } from '../src/game/engine/game';
import { STEP } from '../src/game/engine/config';
import { UNITS } from '../src/game/engine/units';
import { planWave } from '../src/game/engine/waves';
import { Bot, type Strategy } from './bot';

/** 웨이브 시작 시점의 보드 DPS 와, 그 웨이브 총 체력 대비 비율(R)을 출력한다. */
const strategy = (process.argv[2] ?? 'smart') as Strategy;
const runs = Number(process.argv[3] ?? 12);
const dpsAt: Record<number, number[]> = {};

function boardDps(g: Game): number {
  let d = 0;
  for (const s of g.slots)
    for (const u of s.units) {
      const def = UNITS[u.id];
      let mean = def.dmg * g.gradeMul(def.grade) * g.dmgMul();
      if (def.gamble) {
        let tw = 0;
        let tm = 0;
        for (const [m, w] of def.gamble) {
          tw += w;
          tm += m * w;
        }
        mean *= tm / tw;
      }
      if (def.crit) mean *= 1 + def.crit.chance * (def.crit.mult - 1);
      d += mean / (def.cd / g.speedMul());
    }
  return d;
}

for (let k = 0; k < runs; k++) {
  const g = new Game(1000 + k * 7919);
  const bot = new Bot(g, strategy);
  let step = 0;
  let last = 0;
  while (g.status === 'playing' && g.time < 3500) {
    g.update(STEP);
    g.events.length = 0;
    if (++step % 12 === 0) bot.act();
    if (g.wave !== last) {
      // 웨이브 중반의 DPS 를 기록 (소환이 반영된 뒤)
      last = g.wave;
    }
    if (g.wave > 0 && step % 300 === 0 && g.waveDuration - g.waveClock > g.waveDuration * 0.5 && g.waveDuration - g.waveClock < g.waveDuration * 0.5 + 5) {
      (dpsAt[g.wave] ??= []).push(boardDps(g));
    }
  }
}
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const lines: string[] = [];
for (const w of [1, 3, 5, 8, 10, 12, 15, 18, 20, 25, 30, 35, 40, 45, 50]) {
  if (!dpsAt[w]) continue;
  const plan = planWave(w);
  const total = plan.count * plan.hp + (plan.special ? plan.special.hp : 0);
  const dps = mean(dpsAt[w]);
  lines.push(`w${String(w).padStart(2)} dps=${dps.toFixed(0).padStart(6)} waveHP=${total.toFixed(0).padStart(8)} R=${(total / (dps * plan.duration)).toFixed(2)} (n=${dpsAt[w].length})`);
}
console.log(`${strategy}\n` + lines.join('\n'));
