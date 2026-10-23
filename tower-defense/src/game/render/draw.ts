import { BlendMode, PaintStyle, Skia, StrokeCap, StrokeJoin, TileMode, type SkCanvas, type SkPath, type SkPathBuilder, type SkPicture, type SkRect } from '@shopify/react-native-skia';
import { col, shade } from './palette';

export interface LinGrad {
  kind: 'lin';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  stops: string[];
  pos?: number[];
}

export interface RadGrad {
  kind: 'rad';
  cx: number;
  cy: number;
  r: number;
  stops: string[];
  pos?: number[];
}

export type Fill = string | LinGrad | RadGrad;

export const lin = (x0: number, y0: number, x1: number, y1: number, ...stops: string[]): LinGrad => ({ kind: 'lin', x0, y0, x1, y1, stops });
export const rad = (cx: number, cy: number, r: number, ...stops: string[]): RadGrad => ({ kind: 'rad', cx, cy, r, stops });

export interface ShapeOpts {
  /** 외곽선 색 (null 이면 없음, 기본: 채우기 색보다 어둡게) */
  stroke?: string | null;
  /** 외곽선 굵기 (스프라이트 단위) */
  sw?: number;
  alpha?: number;
  blend?: BlendMode;
}

export const OUTLINE = 0.02;

function baseColor(f: Fill): string {
  return typeof f === 'string' ? f : f.stops[Math.floor(f.stops.length / 2)];
}

/** 스프라이트/배경을 한 번 그려 SkPicture 로 굽는다 */
export function record(width: number, height: number, ox: number, oy: number, fn: (pen: Pen) => void): SkPicture {
  const rec = Skia.PictureRecorder();
  const canvas = rec.beginRecording(Skia.XYWHRect(ox, oy, width, height));
  fn(new Pen(canvas));
  return rec.finishRecordingAsPicture();
}

export function recordUnitBox(fn: (pen: Pen) => void, half = 1): SkPicture {
  return record(half * 2, half * 2, -half, -half, fn);
}

/** 도형을 간단히 그리는 도우미 (채우기 + 어두운 외곽선) */
export class Pen {
  readonly paint = Skia.Paint();

  constructor(readonly c: SkCanvas) {
    this.paint.setAntiAlias(true);
  }

  private prep(fill: Fill, o: ShapeOpts) {
    const p = this.paint;
    p.reset();
    p.setAntiAlias(true);
    p.setStyle(PaintStyle.Fill);
    if (typeof fill === 'string') {
      p.setColor(col(fill));
    } else if (fill.kind === 'lin') {
      p.setShader(
        Skia.Shader.MakeLinearGradient(
          { x: fill.x0, y: fill.y0 },
          { x: fill.x1, y: fill.y1 },
          fill.stops.map((s) => col(s)),
          fill.pos ?? null,
          TileMode.Clamp,
        ),
      );
    } else {
      p.setShader(
        Skia.Shader.MakeRadialGradient(
          { x: fill.cx, y: fill.cy },
          fill.r,
          fill.stops.map((s) => col(s)),
          fill.pos ?? null,
          TileMode.Clamp,
        ),
      );
    }
    if (o.alpha !== undefined) p.setAlphaf(o.alpha);
    if (o.blend !== undefined) p.setBlendMode(o.blend);
  }

  private line(o: ShapeOpts, fill: Fill) {
    if (o.stroke === null) return;
    const p = this.paint;
    p.setShader(null);
    p.setStyle(PaintStyle.Stroke);
    p.setStrokeWidth(o.sw ?? OUTLINE);
    p.setStrokeJoin(StrokeJoin.Round);
    p.setStrokeCap(StrokeCap.Round);
    p.setColor(col(o.stroke ?? shade(baseColor(fill), -0.5)));
    if (o.alpha !== undefined) p.setAlphaf(o.alpha);
  }

  circle(x: number, y: number, r: number, fill: Fill, o: ShapeOpts = {}) {
    this.prep(fill, o);
    this.c.drawCircle(x, y, r, this.paint);
    if (o.stroke !== null) {
      this.line(o, fill);
      this.c.drawCircle(x, y, r, this.paint);
    }
  }

  oval(cx: number, cy: number, rx: number, ry: number, fill: Fill, o: ShapeOpts = {}) {
    const rect = Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2);
    this.prep(fill, o);
    this.c.drawOval(rect, this.paint);
    if (o.stroke !== null) {
      this.line(o, fill);
      this.c.drawOval(rect, this.paint);
    }
  }

  /** 좌상단 기준 둥근 사각형 */
  rrect(x: number, y: number, w: number, h: number, r: number, fill: Fill, o: ShapeOpts = {}) {
    const rr = { rect: Skia.XYWHRect(x, y, w, h), rx: r, ry: r };
    this.prep(fill, o);
    this.c.drawRRect(rr, this.paint);
    if (o.stroke !== null) {
      this.line(o, fill);
      this.c.drawRRect(rr, this.paint);
    }
  }

  rect(x: number, y: number, w: number, h: number, fill: Fill, o: ShapeOpts = {}) {
    const rect: SkRect = Skia.XYWHRect(x, y, w, h);
    this.prep(fill, o);
    this.c.drawRect(rect, this.paint);
    if (o.stroke !== null) {
      this.line(o, fill);
      this.c.drawRect(rect, this.paint);
    }
  }

  path(pathLike: PathLike, fill: Fill, o: ShapeOpts = {}) {
    const path = built(pathLike);
    this.prep(fill, o);
    this.c.drawPath(path, this.paint);
    if (o.stroke !== null) {
      this.line(o, fill);
      this.c.drawPath(path, this.paint);
    }
  }

  /** 채우기 없이 선만 */
  stroke(pathLike: PathLike, color: string, width: number, o: { alpha?: number; cap?: StrokeCap; blend?: BlendMode } = {}) {
    const p = this.paint;
    p.reset();
    p.setAntiAlias(true);
    p.setStyle(PaintStyle.Stroke);
    p.setStrokeWidth(width);
    p.setStrokeJoin(StrokeJoin.Round);
    p.setStrokeCap(o.cap ?? StrokeCap.Round);
    p.setColor(col(color));
    if (o.alpha !== undefined) p.setAlphaf(o.alpha);
    if (o.blend !== undefined) p.setBlendMode(o.blend);
    this.c.drawPath(built(pathLike), p);
  }

  seg(x0: number, y0: number, x1: number, y1: number, color: string, width: number, alpha?: number) {
    const p = this.paint;
    p.reset();
    p.setAntiAlias(true);
    p.setStyle(PaintStyle.Stroke);
    p.setStrokeWidth(width);
    p.setStrokeCap(StrokeCap.Round);
    p.setColor(col(color));
    if (alpha !== undefined) p.setAlphaf(alpha);
    this.c.drawLine(x0, y0, x1, y1, p);
  }

  /** 부드러운 빛 번짐 (방사형, 기본은 가산 합성) */
  glow(x: number, y: number, r: number, color: string, alpha = 1, blend: BlendMode = BlendMode.Plus) {
    const p = this.paint;
    p.reset();
    p.setAntiAlias(true);
    p.setStyle(PaintStyle.Fill);
    p.setShader(Skia.Shader.MakeRadialGradient({ x, y }, r, [col(color, 1), col(color, 0)], null, TileMode.Clamp));
    p.setAlphaf(alpha);
    p.setBlendMode(blend);
    this.c.drawCircle(x, y, r, p);
  }
}

export type PathLike = SkPath | SkPathBuilder;

/** 빌더면 build() 해서 SkPath 로 */
export function built(p: PathLike): SkPath {
  return 'build' in p ? p.build() : p;
}

/** 새 경로 (체이닝 가능한 PathBuilder) */
export function newPath(): SkPathBuilder {
  return Skia.PathBuilder.Make();
}

export function polyPath(pts: number[], close = true): SkPath {
  const p = Skia.PathBuilder.Make();
  p.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]);
  if (close) p.close();
  return p.build();
}

/** 별 모양 (n 꼭짓점) */
export function starPath(cx: number, cy: number, outer: number, inner: number, points = 4, rot = -Math.PI / 2): SkPath {
  const p = Skia.PathBuilder.Make();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.close();
  return p.build();
}
