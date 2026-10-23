// 효과음/배경음을 코드로 합성해서 assets/audio/*.wav 로 저장한다.
//   node scripts/generate-sfx.mjs
// 외부 음원 없이 동작하며, 결과는 항상 동일하다(난수 시드 고정).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 22050;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'audio');
fs.mkdirSync(OUT, { recursive: true });

// 재현 가능한 난수
let seed = 12345;
const rnd = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};

const hz = (note) => 440 * Math.pow(2, (note - 69) / 12);
const N = { C3: 48, D3: 50, E3: 52, F3: 53, G3: 55, A3: 57, B3: 59, C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, B4: 71, C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81, B5: 83, C6: 84, E6: 88, G6: 91 };

const buf = (sec) => new Float32Array(Math.max(1, Math.round(sec * SR)));

/** 파형 하나. f0→f1 로 지수적으로 변하는 주파수 + 어택/디케이 */
function osc({ f0, f1 = f0, dur, type = 'sine', attack = 0.004, decay = 3, vol = 1, vibrato = 0, vibRate = 6, duty = 0.5, curve = 'exp' }) {
  const out = buf(dur);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const k = t / dur;
    let f = curve === 'exp' ? f0 * Math.pow(f1 / f0, k) : f0 + (f1 - f0) * k;
    if (vibrato) f *= 1 + vibrato * Math.sin(2 * Math.PI * vibRate * t);
    phase += (2 * Math.PI * f) / SR;
    const p = phase % (2 * Math.PI);
    let s;
    switch (type) {
      case 'square':
        s = p < 2 * Math.PI * duty ? 1 : -1;
        break;
      case 'saw':
        s = p / Math.PI - 1;
        break;
      case 'tri':
        s = 2 * Math.abs(p / Math.PI - 1) - 1;
        break;
      default:
        s = Math.sin(p);
    }
    const env = Math.min(1, t / attack) * Math.exp(-decay * t / Math.max(0.001, dur) * 3);
    out[i] = s * env * vol;
  }
  return out;
}

/** 필터를 거친 잡음 */
function noise({ dur, lp = 8000, hp = 0, attack = 0.002, decay = 4, vol = 1, sweep = 0 }) {
  const out = buf(dur);
  let lo = 0;
  let hi = 0;
  let prev = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const k = t / dur;
    const cutoff = lp * (sweep ? Math.pow(1 + sweep, k) : 1);
    const a = Math.min(1, (2 * Math.PI * cutoff) / SR);
    const x = rnd() * 2 - 1;
    lo += a * (x - lo);
    const ha = hp ? Math.min(1, (2 * Math.PI * hp) / SR) : 0;
    hi += ha * (lo - hi);
    const y = hp ? lo - hi : lo;
    prev = y;
    const env = Math.min(1, t / attack) * Math.exp(-decay * k * 3);
    out[i] = y * env * vol;
  }
  void prev;
  return out;
}

function mixInto(dst, src, at = 0, gain = 1) {
  const o = Math.round(at * SR);
  for (let i = 0; i < src.length && o + i < dst.length; i++) dst[o + i] += src[i] * gain;
}

function compose(dur, parts) {
  const out = buf(dur);
  for (const [at, s, g = 1] of parts) mixInto(out, s, at, g);
  return out;
}

function finish(samples, peak = 0.85) {
  let m = 0;
  for (const v of samples) m = Math.max(m, Math.abs(v));
  const g = m > 0 ? peak / m : 1;
  const fade = Math.round(0.008 * SR);
  for (let i = 0; i < samples.length; i++) {
    let v = samples[i] * g;
    if (i > samples.length - fade) v *= (samples.length - i) / fade;
    if (i < 12) v *= i / 12;
    samples[i] = v;
  }
  return samples;
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVE', 8);
  head.write('fmt ', 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(SR, 24);
  head.writeUInt32LE(SR * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

const files = {};
const save = (name, samples, peak) => {
  files[name] = wav(finish(samples, peak));
};

const bell = (note, dur = 0.35, vol = 1) => compose(dur, [[0, osc({ f0: hz(note), dur, decay: 2.2, vol })], [0, osc({ f0: hz(note) * 2.01, dur, decay: 3.2, vol: 0.35 * vol })], [0, osc({ f0: hz(note) * 3.02, dur, decay: 4.5, vol: 0.15 * vol })]]);

// ───── 효과음 ─────
save('summon', compose(0.42, [
  [0, bell(N.C5, 0.3, 0.8)],
  [0.06, bell(N.E5, 0.3, 0.8)],
  [0.12, bell(N.G5, 0.34, 0.9)],
  [0.0, noise({ dur: 0.3, lp: 9000, hp: 3000, decay: 5, vol: 0.25 })],
]));

save('summonRare', compose(1.0, [
  [0, osc({ f0: 90, f1: 45, dur: 0.5, decay: 2.5, vol: 0.9 })],
  [0, bell(N.C5, 0.8, 0.8)],
  [0.07, bell(N.E5, 0.8, 0.8)],
  [0.14, bell(N.G5, 0.8, 0.85)],
  [0.21, bell(N.C6, 0.8, 0.9)],
  [0.28, bell(N.E6, 0.7, 0.7)],
  [0.0, noise({ dur: 0.9, lp: 12000, hp: 4000, decay: 2.5, vol: 0.3, sweep: -0.3 })],
]));

save('merge', compose(0.55, [
  [0, noise({ dur: 0.22, lp: 600, hp: 200, decay: 1.5, vol: 0.9, sweep: 5 })],
  [0.16, bell(N.E5, 0.4, 0.9)],
  [0.2, bell(N.B5, 0.35, 0.7)],
]));

save('jackpot', compose(1.5, [
  [0, osc({ f0: hz(N.C5), dur: 0.12, type: 'square', duty: 0.25, decay: 1.2, vol: 0.5 })],
  [0.1, osc({ f0: hz(N.E5), dur: 0.12, type: 'square', duty: 0.25, decay: 1.2, vol: 0.5 })],
  [0.2, osc({ f0: hz(N.G5), dur: 0.12, type: 'square', duty: 0.25, decay: 1.2, vol: 0.5 })],
  [0.3, osc({ f0: hz(N.C6), dur: 0.9, type: 'square', duty: 0.25, decay: 1.4, vol: 0.45, vibrato: 0.01 })],
  [0.3, osc({ f0: hz(N.E5), dur: 0.9, type: 'tri', decay: 1.4, vol: 0.5 })],
  [0.3, osc({ f0: hz(N.G5), dur: 0.9, type: 'tri', decay: 1.4, vol: 0.5 })],
  [0.3, noise({ dur: 1.0, lp: 12000, hp: 5000, decay: 1.6, vol: 0.28 })],
  ...[0.35, 0.5, 0.62, 0.78, 0.9].map((t, i) => [t, bell(N.G5 + (i % 3) * 3, 0.25, 0.5)]),
]));

save('craft', compose(1.5, [
  [0, osc({ f0: 70, f1: 38, dur: 0.9, decay: 1.6, vol: 1 })],
  [0.05, noise({ dur: 0.5, lp: 500, decay: 2, vol: 0.8 })],
  [0.25, bell(N.C5, 1.1, 0.7)],
  [0.35, bell(N.G5, 1.0, 0.7)],
  [0.45, bell(N.C6, 0.9, 0.8)],
  [0.55, bell(N.E6, 0.9, 0.6)],
  [0.4, noise({ dur: 1.0, lp: 12000, hp: 5000, decay: 2, vol: 0.3 })],
]));

save('sell', compose(0.35, [
  [0, osc({ f0: 1760, dur: 0.18, decay: 2.5, vol: 0.8 })],
  [0.07, osc({ f0: 2349, dur: 0.26, decay: 2.5, vol: 0.8 })],
]));

save('coin', compose(0.2, [
  [0, osc({ f0: 1976, dur: 0.16, decay: 2.6, vol: 0.9 })],
  [0, osc({ f0: 2637, dur: 0.16, decay: 3.4, vol: 0.5 })],
]));

save('click', compose(0.06, [[0, osc({ f0: 1300, f1: 900, dur: 0.045, decay: 3, vol: 0.8 })]]));
save('tick', compose(0.04, [[0, osc({ f0: 2200, f1: 1800, dur: 0.025, decay: 3, vol: 0.7 }), 1]]));
save('error', compose(0.3, [
  [0, osc({ f0: 190, dur: 0.1, type: 'square', decay: 1.5, vol: 0.6 })],
  [0.12, osc({ f0: 150, dur: 0.14, type: 'square', decay: 1.5, vol: 0.6 })],
]));

save('wave', compose(0.7, [
  [0, osc({ f0: hz(N.G3), dur: 0.28, type: 'saw', decay: 1.2, vol: 0.5 })],
  [0.26, osc({ f0: hz(N.C4), dur: 0.4, type: 'saw', decay: 1.6, vol: 0.55, vibrato: 0.006 })],
  [0.26, osc({ f0: hz(N.E4), dur: 0.4, type: 'tri', decay: 1.6, vol: 0.4 })],
]));

save('boss', compose(1.6, [
  [0, osc({ f0: 55, dur: 1.5, type: 'saw', decay: 1.2, vol: 0.6 })],
  [0, osc({ f0: 58.5, dur: 1.5, type: 'saw', decay: 1.2, vol: 0.5 })],
  [0, noise({ dur: 0.7, lp: 300, decay: 2, vol: 0.9 })],
  [0.5, noise({ dur: 0.9, lp: 1200, hp: 200, decay: 1.2, vol: 0.7, sweep: 3 })],
  [0.9, osc({ f0: 110, f1: 40, dur: 0.6, decay: 2.2, vol: 1 })],
]));

save('win', compose(2.2, [
  ...[N.C5, N.E5, N.G5, N.C6].map((n, i) => [i * 0.14, osc({ f0: hz(n), dur: 0.2, type: 'square', duty: 0.25, decay: 1.4, vol: 0.5 })]),
  [0.6, osc({ f0: hz(N.C6), dur: 1.4, type: 'square', duty: 0.25, decay: 1.3, vol: 0.4, vibrato: 0.008 })],
  [0.6, osc({ f0: hz(N.G5), dur: 1.4, type: 'tri', decay: 1.3, vol: 0.5 })],
  [0.6, osc({ f0: hz(N.E5), dur: 1.4, type: 'tri', decay: 1.3, vol: 0.5 })],
  ...[0.7, 0.85, 1.0, 1.15, 1.3].map((t, i) => [t, bell(N.C6 + (i % 2) * 4, 0.4, 0.5)]),
]));

save('lose', compose(1.9, [
  ...[N.A4, N.F4, N.D4, N.A3].map((n, i) => [i * 0.32, osc({ f0: hz(n), dur: 0.7, type: 'tri', decay: 1.6, vol: 0.8 })]),
  [0.96, osc({ f0: hz(N.A3) / 2, dur: 0.9, type: 'sine', decay: 1.4, vol: 0.8 })],
]));

save('freeze', compose(0.9, [
  [0, osc({ f0: 3200, f1: 900, dur: 0.6, decay: 2, vol: 0.5 })],
  [0.04, osc({ f0: 4100, f1: 1400, dur: 0.6, decay: 2.4, vol: 0.4 })],
  [0, noise({ dur: 0.8, lp: 12000, hp: 6000, decay: 1.5, vol: 0.5 })],
  [0.1, bell(N.E6, 0.6, 0.5)],
]));

save('bomb', compose(1.0, [
  [0, noise({ dur: 0.9, lp: 3000, decay: 1.6, vol: 1, sweep: -0.7 })],
  [0, osc({ f0: 120, f1: 40, dur: 0.5, decay: 2, vol: 1 })],
]));

save('hit', compose(0.08, [
  [0, osc({ f0: 520, f1: 190, dur: 0.06, decay: 3, vol: 0.9 })],
  [0, noise({ dur: 0.04, lp: 4000, decay: 3, vol: 0.4 })],
]), 0.5);

// ───── 배경음 (8마디 루프) ─────
{
  const BPM = 104;
  const beat = 60 / BPM;
  const bars = 8;
  const total = bars * 4 * beat;
  const out = buf(total + 1.5);
  const chords = [
    [N.C4, N.E4, N.G4],
    [N.A3, N.C4, N.E4],
    [N.F3, N.A3, N.C4],
    [N.G3, N.B3, N.D4],
    [N.C4, N.E4, N.G4],
    [N.A3, N.C4, N.E4],
    [N.F3, N.A3, N.C4],
    [N.G3, N.B3, N.D4],
  ];
  const roots = [48, 45, 41, 43, 48, 45, 41, 43];
  for (let b = 0; b < bars; b++) {
    const chord = chords[b];
    const t0 = b * 4 * beat;
    // 패드
    for (const n of chord) mixInto(out, osc({ f0: hz(n), dur: 4 * beat + 0.3, type: 'tri', attack: 0.15, decay: 0.5, vol: 0.14 }), t0, 1);
    // 베이스
    for (const bt of [0, 1.5, 2, 3.5]) mixInto(out, osc({ f0: hz(roots[b]), dur: beat * 0.9, type: 'tri', decay: 1.8, vol: 0.5 }), t0 + bt * beat, 1);
    // 아르페지오 (한 마디 8분음표 8개)
    const seq = [chord[0] + 12, chord[1] + 12, chord[2] + 12, chord[1] + 12, chord[0] + 24, chord[2] + 12, chord[1] + 12, chord[2] + 12];
    for (let i = 0; i < 8; i++) {
      const accent = i % 4 === 0 ? 1 : 0.7;
      mixInto(out, osc({ f0: hz(seq[i]), dur: beat * 0.5, type: 'square', duty: 0.25, decay: 2.6, vol: 0.13 * accent }), t0 + i * beat * 0.5, 1);
    }
    // 가끔 한 옥타브 위 장식음
    if (b % 2 === 1) mixInto(out, bell(chord[2] + 24, 0.5, 0.18), t0 + 3 * beat, 1);
    // 킥 / 하이햇
    for (const kb of [0, 2]) mixInto(out, osc({ f0: 130, f1: 45, dur: 0.18, decay: 2.5, vol: 0.6 }), t0 + kb * beat, 1);
    for (let i = 0; i < 8; i++) if (i % 2 === 1) mixInto(out, noise({ dur: 0.05, lp: 12000, hp: 7000, decay: 3, vol: 0.18 }), t0 + i * beat * 0.5, 1);
  }
  // 꼬리를 앞으로 접어 이음새 없이 반복되게
  const loopLen = Math.round(total * SR);
  const looped = out.slice(0, loopLen);
  for (let i = loopLen; i < out.length; i++) looped[i - loopLen] += out[i];
  files.bgm = wav(finish(looped, 0.7));
}

for (const [name, data] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUT, `${name}.wav`), data);
}
const total = Object.values(files).reduce((a, b) => a + b.length, 0);
console.log(`생성 완료: ${Object.keys(files).length}개 (${(total / 1024).toFixed(0)} KB) → ${OUT}`);
