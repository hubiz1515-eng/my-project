import { BlendMode, PaintStyle, Skia, StrokeCap, StrokeJoin, TileMode, type SkCanvas, type SkFont, type SkPaint, type SkShader } from '@shopify/react-native-skia';
import { col } from './palette';

export type ParticleKind = 'glow' | 'spark' | 'ring' | 'puff' | 'star' | 'coin' | 'confetti' | 'shard' | 'ember';

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 중력(+y 아래) */
  g: number;
  drag: number;
  life: number;
  max: number;
  s0: number;
  s1: number;
  color: string;
  rot: number;
  vr: number;
  alpha: number;
  add: boolean;
}

export interface FloatText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  size: number;
  life: number;
  max: number;
  crit: boolean;
}

export interface Bolt {
  pts: number[];
  life: number;
  max: number;
  color: string;
  width: number;
}

const MAX_PARTICLES = 420;
const TEXT_REF = 30;

const glowShaders = new Map<string, SkShader>();

function glowShader(color: string): SkShader {
  let s = glowShaders.get(color);
  if (!s) {
    s = Skia.Shader.MakeRadialGradient({ x: 0, y: 0 }, 1, [col(color, 1), col(color, 0)], null, TileMode.Clamp);
    glowShaders.set(color, s);
  }
  return s;
}

const puffShaders = new Map<string, SkShader>();

function puffShader(color: string): SkShader {
  let s = puffShaders.get(color);
  if (!s) {
    s = Skia.Shader.MakeRadialGradient({ x: 0, y: 0 }, 1, [col(color, 0.85), col(color, 0.5), col(color, 0)], [0, 0.55, 1], TileMode.Clamp);
    puffShaders.set(color, s);
  }
  return s;
}

const CONFETTI = ['#ff5a7a', '#ffd24d', '#7be0ff', '#7dff9b', '#c88aff', '#ffffff'];

export function fmtNum(n: number): string {
  if (n < 1000) return String(Math.max(1, Math.round(n)));
  const units = ['K', 'M', 'B', 'T'];
  let v = n;
  let u = -1;
  while (v >= 1000 && u < units.length - 1) {
    v /= 1000;
    u++;
  }
  return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)).replace(/\.?0+$/, '') + units[u];
}

export class Fx {
  particles: Particle[] = [];
  texts: FloatText[] = [];
  bolts: Bolt[] = [];
  /** 화면 흔들림 세기(칸 단위) */
  shake = 0;
  /** 전체 화면 번쩍임 */
  flashColor = '#ffffff';
  flashAlpha = 0;

  private pool: Particle[] = [];
  private paint: SkPaint;
  private strokePaint: SkPaint;
  private textFill: SkPaint;
  private textLine: SkPaint;

  constructor(private font: SkFont | null) {
    this.paint = Skia.Paint();
    this.paint.setAntiAlias(true);
    this.strokePaint = Skia.Paint();
    this.strokePaint.setAntiAlias(true);
    this.strokePaint.setStyle(PaintStyle.Stroke);
    this.strokePaint.setStrokeCap(StrokeCap.Round);
    this.strokePaint.setStrokeJoin(StrokeJoin.Round);
    this.textFill = Skia.Paint();
    this.textFill.setAntiAlias(true);
    this.textLine = Skia.Paint();
    this.textLine.setAntiAlias(true);
    this.textLine.setStyle(PaintStyle.Stroke);
    this.textLine.setStrokeJoin(StrokeJoin.Round);
    this.textLine.setColor(col('#1b1530'));
  }

  clear() {
    this.particles.length = 0;
    this.texts.length = 0;
    this.bolts.length = 0;
    this.shake = 0;
    this.flashAlpha = 0;
  }

  get count() {
    return this.particles.length;
  }

  add(p: Partial<Particle> & { kind: ParticleKind; x: number; y: number; color: string; max: number }) {
    if (this.particles.length >= MAX_PARTICLES) return;
    const o = this.pool.pop() ?? ({} as Particle);
    o.kind = p.kind;
    o.x = p.x;
    o.y = p.y;
    o.vx = p.vx ?? 0;
    o.vy = p.vy ?? 0;
    o.g = p.g ?? 0;
    o.drag = p.drag ?? 0;
    o.life = 0;
    o.max = p.max;
    o.s0 = p.s0 ?? 0.1;
    o.s1 = p.s1 ?? p.s0 ?? 0.1;
    o.color = p.color;
    o.rot = p.rot ?? 0;
    o.vr = p.vr ?? 0;
    o.alpha = p.alpha ?? 1;
    o.add = p.add ?? (p.kind !== 'puff' && p.kind !== 'coin' && p.kind !== 'confetti');
    this.particles.push(o);
  }

  text(x: number, y: number, text: string, color: string, size = 0.2, crit = false, max = 0.8) {
    if (this.texts.length > 60) this.texts.shift();
    this.texts.push({ x, y, vy: -0.55, text, color, size, life: 0, max, crit });
  }

  bolt(pts: number[], color: string, width = 0.05, max = 0.22) {
    this.bolts.push({ pts, life: 0, max, color, width });
  }

  kick(amount: number) {
    this.shake = Math.min(0.35, Math.max(this.shake, amount));
  }

  flash(color: string, alpha: number) {
    if (alpha >= this.flashAlpha) {
      this.flashColor = color;
      this.flashAlpha = alpha;
    }
  }

  // ───────────────────── 합성 이펙트 묶음 ─────────────────────

  burst(x: number, y: number, color: string, n = 12, speed = 1.6, size = 0.05) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.add({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2.5, max: 0.35 + Math.random() * 0.25, s0: size, s1: 0, color });
    }
  }

  ringAt(x: number, y: number, color: string, r0 = 0.05, r1 = 0.6, max = 0.4, width = 0.04) {
    this.add({ kind: 'ring', x, y, max, s0: r0, s1: r1, color, vr: width });
  }

  explosion(x: number, y: number, r: number, color: string, hot = '#fff2a8') {
    this.add({ kind: 'glow', x, y, max: 0.3, s0: r * 0.8, s1: r * 1.6, color: hot, alpha: 0.9 });
    this.add({ kind: 'glow', x, y, max: 0.45, s0: r * 0.6, s1: r * 1.3, color, alpha: 0.8 });
    this.ringAt(x, y, color, r * 0.25, r * 1.15, 0.38, 0.05);
    this.burst(x, y, hot, 10, 2.4, 0.05);
    this.burst(x, y, color, 8, 1.8, 0.06);
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      this.add({ kind: 'puff', x: x + Math.cos(a) * r * 0.3, y: y + Math.sin(a) * r * 0.3, vx: Math.cos(a) * 0.3, vy: Math.sin(a) * 0.3 - 0.2, drag: 1.5, max: 0.7, s0: r * 0.3, s1: r * 0.8, color: '#6a6070', alpha: 0.55 });
    }
  }

  coins(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
      const v = 1.2 + Math.random() * 1.2;
      this.add({ kind: 'coin', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 5, max: 0.8 + Math.random() * 0.2, s0: 0.055, s1: 0.055, color: '#ffd24d', rot: Math.random() * 6, vr: 10 });
    }
  }

  confetti(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
      const v = 1.5 + Math.random() * 2.6;
      this.add({
        kind: 'confetti',
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        g: 3.2,
        drag: 0.8,
        max: 1.2 + Math.random() * 0.8,
        s0: 0.04 + Math.random() * 0.03,
        s1: 0.04,
        color: CONFETTI[i % CONFETTI.length],
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 18,
      });
    }
  }

  // ───────────────────── 갱신 / 그리기 ─────────────────────

  update(dt: number) {
    const ps = this.particles;
    let w = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.life += dt;
      if (p.life >= p.max) {
        this.pool.push(p);
        continue;
      }
      if (p.drag) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      ps[w++] = p;
    }
    ps.length = w;

    let tw = 0;
    for (let i = 0; i < this.texts.length; i++) {
      const t = this.texts[i];
      t.life += dt;
      if (t.life >= t.max) continue;
      t.y += t.vy * dt;
      t.vy *= Math.max(0, 1 - 2.2 * dt);
      this.texts[tw++] = t;
    }
    this.texts.length = tw;

    let bw = 0;
    for (let i = 0; i < this.bolts.length; i++) {
      const b = this.bolts[i];
      b.life += dt;
      if (b.life < b.max) this.bolts[bw++] = b;
    }
    this.bolts.length = bw;

    this.shake = Math.max(0, this.shake - dt * 1.4);
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 1.8);
  }

  draw(c: SkCanvas) {
    this.drawBolts(c);
    const p = this.paint;
    for (const q of this.particles) {
      const k = q.life / q.max;
      const size = q.s0 + (q.s1 - q.s0) * k;
      let a = q.alpha * (1 - k * k);
      p.reset();
      p.setAntiAlias(true);
      if (q.add) p.setBlendMode(BlendMode.Plus);
      switch (q.kind) {
        case 'glow': {
          p.setShader(glowShader(q.color));
          p.setAlphaf(a);
          c.save();
          c.translate(q.x, q.y);
          c.scale(size, size);
          c.drawCircle(0, 0, 1, p);
          c.restore();
          break;
        }
        case 'puff': {
          p.setShader(puffShader(q.color));
          p.setAlphaf(a);
          c.save();
          c.translate(q.x, q.y);
          c.scale(size, size);
          c.drawCircle(0, 0, 1, p);
          c.restore();
          break;
        }
        case 'ember': {
          p.setShader(glowShader(q.color));
          p.setAlphaf(a);
          c.save();
          c.translate(q.x, q.y);
          c.scale(size * 2.2, size * 2.2);
          c.drawCircle(0, 0, 1, p);
          c.restore();
          p.setShader(null);
          p.setColor(col('#ffffff'));
          p.setAlphaf(a);
          c.drawCircle(q.x, q.y, size * 0.5, p);
          break;
        }
        case 'spark': {
          const sp = this.strokePaint;
          sp.reset();
          sp.setAntiAlias(true);
          sp.setStyle(PaintStyle.Stroke);
          sp.setStrokeCap(StrokeCap.Round);
          sp.setBlendMode(BlendMode.Plus);
          sp.setColor(col(q.color));
          sp.setAlphaf(Math.min(1, a * 1.3));
          sp.setStrokeWidth(Math.max(0.004, size * (1 - k)));
          c.drawLine(q.x, q.y, q.x - q.vx * 0.045, q.y - q.vy * 0.045, sp);
          break;
        }
        case 'ring': {
          const sp = this.strokePaint;
          sp.reset();
          sp.setAntiAlias(true);
          sp.setStyle(PaintStyle.Stroke);
          sp.setBlendMode(BlendMode.Plus);
          sp.setColor(col(q.color));
          sp.setAlphaf(a);
          sp.setStrokeWidth(Math.max(0.004, q.vr * (1 - k)));
          c.drawCircle(q.x, q.y, size, sp);
          break;
        }
        case 'star': {
          p.setColor(col(q.color));
          p.setAlphaf(a);
          c.save();
          c.translate(q.x, q.y);
          c.rotate((q.rot * 180) / Math.PI, 0, 0);
          c.scale(size, size);
          c.drawPath(STAR, p);
          c.restore();
          break;
        }
        case 'shard': {
          p.setColor(col(q.color));
          p.setAlphaf(a);
          c.save();
          c.translate(q.x, q.y);
          c.rotate((q.rot * 180) / Math.PI, 0, 0);
          c.scale(size, size * 1.6);
          c.drawPath(DIAMOND, p);
          c.restore();
          break;
        }
        case 'coin': {
          a = Math.min(1, (1 - k) * 2.2);
          const sx = Math.abs(Math.cos(q.rot));
          p.setColor(col('#c88a10'));
          p.setAlphaf(a);
          c.drawOval(Skia.XYWHRect(q.x - size * sx, q.y - size, size * 2 * sx + 0.002, size * 2), p);
          p.setColor(col(q.color));
          p.setAlphaf(a);
          c.drawOval(Skia.XYWHRect(q.x - size * sx * 0.8, q.y - size * 0.82, size * 1.6 * sx + 0.002, size * 1.64), p);
          break;
        }
        case 'confetti': {
          a = Math.min(1, (1 - k) * 2);
          p.setColor(col(q.color));
          p.setAlphaf(a);
          c.save();
          c.translate(q.x, q.y);
          c.rotate((q.rot * 180) / Math.PI, 0, 0);
          c.scale(1, Math.abs(Math.cos(q.rot * 0.7)) * 0.9 + 0.1);
          c.drawRect(Skia.XYWHRect(-size, -size * 0.55, size * 2, size * 1.1), p);
          c.restore();
          break;
        }
      }
    }
    this.drawTexts(c);
  }

  private drawBolts(c: SkCanvas) {
    const sp = this.strokePaint;
    for (const b of this.bolts) {
      const k = b.life / b.max;
      const a = 1 - k;
      // 지그재그 경로
      const path = Skia.PathBuilder.Make();
      path.moveTo(b.pts[0], b.pts[1]);
      for (let i = 2; i < b.pts.length; i += 2) {
        const x0 = b.pts[i - 2];
        const y0 = b.pts[i - 1];
        const x1 = b.pts[i];
        const y1 = b.pts[i + 1];
        const dx = x1 - x0;
        const dy = y1 - y0;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const segs = Math.max(2, Math.round(len / 0.28));
        for (let s = 1; s < segs; s++) {
          const t = s / segs;
          const j = (Math.random() - 0.5) * 0.18;
          path.lineTo(x0 + dx * t + nx * j, y0 + dy * t + ny * j);
        }
        path.lineTo(x1, y1);
      }
      const built = path.build();
      sp.reset();
      sp.setAntiAlias(true);
      sp.setStyle(PaintStyle.Stroke);
      sp.setStrokeCap(StrokeCap.Round);
      sp.setStrokeJoin(StrokeJoin.Round);
      sp.setBlendMode(BlendMode.Plus);
      sp.setColor(col(b.color));
      sp.setStrokeWidth(b.width * 3);
      sp.setAlphaf(0.28 * a);
      c.drawPath(built, sp);
      sp.setStrokeWidth(b.width);
      sp.setColor(col('#ffffff'));
      sp.setAlphaf(0.95 * a);
      c.drawPath(built, sp);
    }
  }

  private drawTexts(c: SkCanvas) {
    const font = this.font;
    if (!font) return;
    for (const t of this.texts) {
      const k = t.life / t.max;
      const pop = k < 0.16 ? 1 + 0.5 * (1 - k / 0.16) : 1;
      const a = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      const sc = (t.size / TEXT_REF) * pop * (t.crit ? 1.25 : 1);
      const w = font.getTextWidth(t.text);
      c.save();
      c.translate(t.x, t.y);
      c.scale(sc, sc);
      this.textLine.setStrokeWidth(5);
      this.textLine.setAlphaf(a);
      c.drawText(t.text, -w / 2, 0, this.textLine, font);
      this.textFill.setColor(col(t.color));
      this.textFill.setAlphaf(a);
      c.drawText(t.text, -w / 2, 0, this.textFill, font);
      c.restore();
    }
  }
}

const STAR = (() => {
  const p = Skia.PathBuilder.Make();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? 1 : 0.28;
    const a = -Math.PI / 2 + (i * Math.PI) / 4;
    if (i === 0) p.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else p.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  p.close();
  return p.build();
})();

const DIAMOND = (() => {
  const p = Skia.PathBuilder.Make();
  p.moveTo(0, -1);
  p.lineTo(0.5, 0);
  p.lineTo(0, 1);
  p.lineTo(-0.5, 0);
  p.close();
  return p.build();
})();

export const FX_TEXT_REF = TEXT_REF;
