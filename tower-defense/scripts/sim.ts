import { simulate, type Strategy } from './bot';

const args = process.argv.slice(2);
const strategy = (args[0] ?? 'smart') as Strategy;
const runs = Number(args[1] ?? 10);
const verbose = args.includes('-v');

const waves: number[] = [];
let wins = 0;
const t0 = Date.now();
for (let i = 0; i < runs; i++) {
  const r = simulate(1000 + i * 7919, strategy);
  waves.push(r.wave);
  if (r.status === 'won') wins++;
  if (verbose) console.log(r.seed, r.status, 'wave', r.wave, 'summons', r.summons, 'merges', r.merges, 'crafts', r.crafts, JSON.stringify(r.board));
}
waves.sort((a, b) => a - b);
const avg = waves.reduce((a, b) => a + b, 0) / waves.length;
console.log(
  `${strategy}: runs=${runs} wins=${wins} avgWave=${avg.toFixed(1)} min=${waves[0]} median=${waves[Math.floor(waves.length / 2)]} max=${waves[waves.length - 1]} (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
);
