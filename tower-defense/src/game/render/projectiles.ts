import { BlendMode, PaintStyle, Skia, StrokeCap, StrokeJoin, type SkCanvas, type SkPaint, type SkPath } from '@shopify/react-native-skia';
import type { Projectile } from '../engine/types';
import type { ShotKind } from '../engine/units';
import { col } from './palette';
import { starPath } from './draw';

export const SHOT_COLOR: Record<ShotKind, string> = {
  slash: '#ffffff',
  arrow: '#f0e4c4',
  orb: '#c8a0ff',
  coin: '#ffd24d',
  ice: '#8ae0ff',
  dart: '#9aff6a',
  bomb: '#ffb040',
  bolt: '#ffe85a',
  card: '#ff7a9a',
  holy: '#fff2a8',
  dagger: '#ff7a9a',
  fire: '#ff8a30',
  time: '#7ff0ff',
  snipe: '#ffffff',
  arcane: '#9ad0ff',
  dragon: '#ff6a2a',
  fate: '#ff9ad8',
  shadow: '#b080ff',
  meteor: '#ff6a2a',
  eternal: '#6af7e8',
};

const ARROW_HEAD: SkPath = Skia.PathBuilder.Make().moveTo(0.06, -0.032).lineTo(0.125, 0).lineTo(0.06, 0.032).close().build();
const DIAMOND: SkPath = Skia.PathBuilder.Make().moveTo(0, -0.1).lineTo(0.055, 0).lineTo(0, 0.1).lineTo(-0.055, 0).close().build();
const STAR4: SkPath = starPath(0, 0, 0.1, 0.035, 4);
const STAR5: SkPath = starPath(0, 0, 0.1, 0.045, 5);

const RAD = 180 / Math.PI;

function fill(p: SkPaint, color: string, alpha = 1, blend?: BlendMode) {
  p.reset();
  p.setAntiAlias(true);
  p.setStyle(PaintStyle.Fill);
  p.setColor(col(color));
  p.setAlphaf(alpha);
  if (blend !== undefined) p.setBlendMode(blend);
}

function stroke(p: SkPaint, color: string, width: number, alpha = 1, blend?: BlendMode) {
  p.reset();
  p.setAntiAlias(true);
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeCap(StrokeCap.Round);
  p.setStrokeJoin(StrokeJoin.Round);
  p.setStrokeWidth(width);
  p.setColor(col(color));
  p.setAlphaf(alpha);
  if (blend !== undefined) p.setBlendMode(blend);
}

/** 반짝이는 점 (가산 합성) */
function bloom(c: SkCanvas, p: SkPaint, x: number, y: number, r: number, color: string, alpha: number) {
  fill(p, color, alpha * 0.35, BlendMode.Plus);
  c.drawCircle(x, y, r * 1.9, p);
  fill(p, color, alpha * 0.8, BlendMode.Plus);
  c.drawCircle(x, y, r, p);
  fill(p, '#ffffff', alpha, BlendMode.Plus);
  c.drawCircle(x, y, r * 0.45, p);
}

/** 투사체 한 개를 그린다. 좌표는 칸 단위. */
export function drawProjectile(c: SkCanvas, pr: Projectile, t: number, p: SkPaint) {
  const k = Math.min(1, pr.age / pr.dur);
  const dx = pr.tx - pr.sx;
  const dy = pr.ty - pr.sy;
  const ang = Math.atan2(dy, dx);
  const color = SHOT_COLOR[pr.shot];
  const x = pr.x;
  const y = pr.y;
  switch (pr.shot) {
    case 'arrow':
    case 'dart': {
      c.save();
      c.translate(x, y);
      c.rotate(ang * RAD, 0, 0);
      stroke(p, pr.shot === 'dart' ? '#3a7a2a' : '#8a6a40', 0.026);
      c.drawLine(-0.15, 0, 0.07, 0, p);
      stroke(p, pr.shot === 'dart' ? color : '#fff6dc', 0.012);
      c.drawLine(-0.15, 0, 0.07, 0, p);
      fill(p, pr.shot === 'dart' ? '#7aff4a' : '#dfe6f4');
      c.drawPath(ARROW_HEAD, p);
      stroke(p, '#e8e8f0', 0.014);
      c.drawLine(-0.15, 0, -0.19, -0.035, p);
      c.drawLine(-0.15, 0, -0.19, 0.035, p);
      c.restore();
      break;
    }
    case 'orb': {
      bloom(c, p, x, y, 0.07, color, 1);
      break;
    }
    case 'ice': {
      bloom(c, p, x, y, 0.07, color, 0.9);
      c.save();
      c.translate(x, y);
      c.rotate(ang * RAD + 90, 0, 0);
      fill(p, '#e8fbff');
      c.drawPath(DIAMOND, p);
      c.restore();
      break;
    }
    case 'coin': {
      const sx = Math.abs(Math.cos(t * 18 + pr.uid));
      fill(p, '#c88a10');
      c.drawOval(Skia.XYWHRect(x - 0.06 * sx, y - 0.06, 0.12 * sx + 0.002, 0.12), p);
      fill(p, '#ffe27a');
      c.drawOval(Skia.XYWHRect(x - 0.048 * sx, y - 0.048, 0.096 * sx + 0.002, 0.096), p);
      break;
    }
    case 'bomb': {
      const arc = Math.sin(k * Math.PI) * 0.55;
      fill(p, '#000000', 0.25);
      c.drawOval(Skia.XYWHRect(x - 0.07, y - 0.025, 0.14, 0.05), p);
      c.save();
      c.translate(x, y - arc);
      c.rotate(t * 500, 0, 0);
      fill(p, '#23232e');
      c.drawCircle(0, 0, 0.075, p);
      fill(p, '#ffffff', 0.4);
      c.drawCircle(-0.025, -0.03, 0.02, p);
      bloom(c, p, 0.0, -0.095, 0.03, '#ffb040', 1);
      c.restore();
      break;
    }
    case 'card': {
      c.save();
      c.translate(x, y);
      c.rotate(t * 900 + pr.uid * 40, 0, 0);
      fill(p, '#fffdf4');
      c.drawRRect({ rect: Skia.XYWHRect(-0.045, -0.065, 0.09, 0.13), rx: 0.012, ry: 0.012 }, p);
      fill(p, '#e04060');
      c.drawCircle(0, 0, 0.022, p);
      c.restore();
      break;
    }
    case 'holy': {
      bloom(c, p, x, y, 0.07, color, 1);
      c.save();
      c.translate(x, y);
      c.rotate(t * 200, 0, 0);
      fill(p, '#ffffff', 0.9, BlendMode.Plus);
      c.drawPath(STAR4, p);
      c.restore();
      break;
    }
    case 'fire':
    case 'dragon': {
      const r = pr.shot === 'dragon' ? 0.14 : 0.095;
      bloom(c, p, x, y, r, color, 1);
      fill(p, '#fff2a8', 0.9, BlendMode.Plus);
      c.drawCircle(x, y, r * 0.55, p);
      break;
    }
    case 'time': {
      bloom(c, p, x, y, 0.06, color, 0.9);
      stroke(p, '#ffffff', 0.016, 0.9, BlendMode.Plus);
      c.drawCircle(x, y, 0.085, p);
      c.save();
      c.translate(x, y);
      c.rotate(t * 600, 0, 0);
      c.drawLine(0, 0, 0, -0.065, p);
      c.restore();
      break;
    }
    case 'fate': {
      bloom(c, p, x, y, 0.07, color, 1);
      c.save();
      c.translate(x, y);
      c.rotate(t * 300, 0, 0);
      fill(p, '#fff2a8', 1, BlendMode.Plus);
      c.drawPath(STAR5, p);
      c.restore();
      break;
    }
    case 'snipe': {
      const a = 1 - k;
      stroke(p, '#ff6a6a', 0.12, 0.3 * a, BlendMode.Plus);
      c.drawLine(pr.sx, pr.sy, pr.tx, pr.ty, p);
      stroke(p, '#ffffff', 0.035, 0.95 * a, BlendMode.Plus);
      c.drawLine(pr.sx, pr.sy, pr.tx, pr.ty, p);
      bloom(c, p, pr.sx, pr.sy, 0.09, '#ffd8a0', a);
      break;
    }
    case 'slash':
    case 'dagger':
    case 'shadow': {
      // 대상 위치에서 호를 그리며 베기
      const sweep = Math.min(1, k * 1.6);
      const base = ang + Math.PI;
      const n = pr.shot === 'shadow' ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const off = i === 0 ? 0 : 0.9;
        const r = 0.2 + i * 0.07;
        const a0 = (base - 1.0 + off) * RAD;
        const arc = Skia.PathBuilder.Make().addArc(Skia.XYWHRect(pr.tx - r, pr.ty - r, r * 2, r * 2), a0, 2.0 * sweep * RAD * (i === 0 ? 1 : -1) * 0.9).build();
        stroke(p, color, 0.07 * (1 - k * 0.6), 0.35 * (1 - k), BlendMode.Plus);
        c.drawPath(arc, p);
        stroke(p, '#ffffff', 0.028 * (1 - k * 0.6), 0.95 * (1 - k * 0.5), BlendMode.Plus);
        c.drawPath(arc, p);
      }
      break;
    }
    case 'meteor': {
      const ex = pr.tx;
      const ey = pr.ty;
      const f = k * k;
      const mx = ex + 1.4 * (1 - f);
      const my = ey - 3.4 * (1 - f);
      fill(p, '#000000', 0.35 * k);
      c.drawOval(Skia.XYWHRect(ex - 0.5 * k, ey - 0.18 * k, 1.0 * k, 0.36 * k), p);
      // 꼬리
      stroke(p, '#ff6a2a', 0.3, 0.35, BlendMode.Plus);
      c.drawLine(mx, my, mx + 0.9, my - 2.2, p);
      stroke(p, '#ffd070', 0.14, 0.7, BlendMode.Plus);
      c.drawLine(mx, my, mx + 0.45, my - 1.1, p);
      bloom(c, p, mx, my, 0.26, '#ff8a30', 1);
      fill(p, '#3a2418');
      c.drawCircle(mx, my, 0.17, p);
      fill(p, '#ffb060', 0.9, BlendMode.Plus);
      c.drawCircle(mx - 0.03, my - 0.03, 0.12, p);
      break;
    }
    default:
      bloom(c, p, x, y, 0.06, color, 1);
  }
}
