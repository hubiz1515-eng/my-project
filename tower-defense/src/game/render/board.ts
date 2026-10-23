import { BlendMode, BlurStyle, Skia, type SkPicture } from '@shopify/react-native-skia';
import { BOARD_H, BOARD_W, COLS, ROWS } from '../engine/config';
import { LOOP_LENGTH, pointAt, PATH_RECT } from '../engine/path';
import { Rng } from '../engine/rng';
import { lin, newPath, Pen, polyPath, rad, record, starPath } from './draw';
import { col, shade } from './palette';

/** 보드 공간(칸 단위)에서 그려진 정적 배경. 판은 (0,0)~(BOARD_W,BOARD_H), 바깥 풍경은 그 둘레 3칸까지. */
export const BOARD_MARGIN = 3;

const PLATFORM = { x: -0.3, y: -0.3, w: BOARD_W + 0.6, h: BOARD_H + 0.6, r: 0.6 };

function treeAt(p: Pen, x: number, y: number, s: number, hue: number) {
  const leaf = [
    ['#7ee26a', '#3fa84a'],
    ['#5fd08a', '#2f9a62'],
    ['#9ae05a', '#52a83a'],
    ['#6ad6b0', '#2a9a86'],
  ][hue % 4];
  p.oval(x, y + 0.42 * s, 0.34 * s, 0.1 * s, '#000000', { stroke: null, alpha: 0.22 });
  p.rrect(x - 0.06 * s, y + 0.1 * s, 0.12 * s, 0.36 * s, 0.03 * s, lin(x - 0.06 * s, 0, x + 0.06 * s, 0, '#9a6a3a', '#6a4220'), { stroke: '#3a2412', sw: 0.018 * s });
  p.circle(x - 0.2 * s, y + 0.02 * s, 0.24 * s, rad(x - 0.26 * s, y - 0.06 * s, 0.34 * s, leaf[0], leaf[1]), { stroke: shade(leaf[1], -0.5), sw: 0.02 * s });
  p.circle(x + 0.2 * s, y + 0.02 * s, 0.24 * s, rad(x + 0.14 * s, y - 0.06 * s, 0.34 * s, leaf[0], leaf[1]), { stroke: shade(leaf[1], -0.5), sw: 0.02 * s });
  p.circle(x, y - 0.17 * s, 0.3 * s, rad(x - 0.08 * s, y - 0.28 * s, 0.4 * s, shade(leaf[0], 0.25), leaf[0], leaf[1]), { stroke: shade(leaf[1], -0.5), sw: 0.02 * s });
  p.circle(x - 0.08 * s, y - 0.25 * s, 0.05 * s, '#ffffff', { stroke: null, alpha: 0.3 });
}

function bushAt(p: Pen, x: number, y: number, s: number) {
  p.oval(x, y + 0.14 * s, 0.26 * s, 0.07 * s, '#000000', { stroke: null, alpha: 0.2 });
  for (const [dx, dy, r] of [
    [-0.13, 0.02, 0.15],
    [0.13, 0.03, 0.14],
    [0, -0.06, 0.18],
  ] as const) {
    p.circle(x + dx * s, y + dy * s, r * s, rad(x + (dx - 0.05) * s, y + (dy - 0.06) * s, r * 1.4 * s, '#9ae878', '#4ab04a'), { stroke: '#1f5a2a', sw: 0.016 * s });
  }
  for (const [dx, dy] of [
    [-0.06, -0.05],
    [0.1, 0.0],
  ] as const) p.circle(x + dx * s, y + dy * s, 0.022 * s, '#ff6a8a', { stroke: null });
}

function rockAt(p: Pen, x: number, y: number, s: number) {
  p.oval(x, y + 0.13 * s, 0.24 * s, 0.065 * s, '#000000', { stroke: null, alpha: 0.2 });
  const r = newPath();
  r.moveTo(x - 0.22 * s, y + 0.12 * s);
  r.quadTo(x - 0.26 * s, y - 0.08 * s, x - 0.08 * s, y - 0.14 * s);
  r.quadTo(x + 0.1 * s, y - 0.2 * s, x + 0.22 * s, y - 0.02 * s);
  r.quadTo(x + 0.26 * s, y + 0.1 * s, x + 0.2 * s, y + 0.12 * s);
  r.close();
  p.path(r, lin(x - 0.2 * s, y - 0.2 * s, x + 0.2 * s, y + 0.12 * s, '#d6d8e4', '#9a9eb4', '#6a6e86'), { stroke: '#3a3e56', sw: 0.018 * s });
  p.path(polyPath([x - 0.1 * s, y - 0.08 * s, x - 0.02 * s, y - 0.12 * s, x - 0.04 * s, y - 0.04 * s]), '#ffffff', { stroke: null, alpha: 0.35 });
}

function shroomAt(p: Pen, x: number, y: number, s: number) {
  p.rrect(x - 0.035 * s, y - 0.02 * s, 0.07 * s, 0.14 * s, 0.03 * s, '#f6ecd2', { stroke: '#8a7a50', sw: 0.012 * s });
  const cap = newPath();
  cap.moveTo(x - 0.15 * s, y);
  cap.cubicTo(x - 0.16 * s, y - 0.2 * s, x + 0.16 * s, y - 0.2 * s, x + 0.15 * s, y);
  cap.close();
  p.path(cap, lin(0, y - 0.18 * s, 0, y, '#ff7a8a', '#d02a4a'), { stroke: '#5a1020', sw: 0.014 * s });
  p.circle(x - 0.05 * s, y - 0.08 * s, 0.025 * s, '#ffffff', { stroke: null });
  p.circle(x + 0.06 * s, y - 0.1 * s, 0.02 * s, '#ffffff', { stroke: null });
}

function scenery(p: Pen) {
  const rng = new Rng(77);
  const items: { x: number; y: number; k: number; s: number; h: number }[] = [];
  const inside = (x: number, y: number) => x > PLATFORM.x - 0.5 && x < PLATFORM.x + PLATFORM.w + 0.5 && y > PLATFORM.y - 0.5 && y < PLATFORM.y + PLATFORM.h + 0.5;
  for (let i = 0; i < 140; i++) {
    const x = rng.range(-BOARD_MARGIN - 0.5, BOARD_W + BOARD_MARGIN + 0.5);
    const y = rng.range(-BOARD_MARGIN - 0.5, BOARD_H + BOARD_MARGIN + 0.5);
    if (inside(x, y)) continue;
    const near = Math.max(Math.abs(x - BOARD_W / 2) - BOARD_W / 2, Math.abs(y - BOARD_H / 2) - BOARD_H / 2);
    const k = rng.weighted([near > 1.6 ? 6 : 3, 4, 2, 1]);
    items.push({ x, y, k, s: rng.range(0.8, 1.25) * (near > 2 ? 1.15 : 1), h: rng.int(4) });
  }
  items.sort((a, b) => a.y - b.y);
  // 겹침 완화
  const kept: typeof items = [];
  for (const it of items) {
    if (kept.every((o) => (o.x - it.x) ** 2 + (o.y - it.y) ** 2 > 0.55)) kept.push(it);
  }
  for (const it of kept) {
    if (it.k === 0) treeAt(p, it.x, it.y, it.s, it.h);
    else if (it.k === 1) bushAt(p, it.x, it.y, it.s);
    else if (it.k === 2) rockAt(p, it.x, it.y, it.s);
    else shroomAt(p, it.x, it.y, it.s);
  }
}

function platform(p: Pen) {
  const { x, y, w, h, r } = PLATFORM;
  // 그림자
  const sh = Skia.Paint();
  sh.setColor(col('#000000'));
  sh.setAlphaf(0.4);
  sh.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 0.25, true));
  p.c.drawRRect({ rect: Skia.XYWHRect(x + 0.05, y + 0.28, w, h), rx: r, ry: r }, sh);
  // 테두리(돌)
  p.rrect(x - 0.12, y - 0.12, w + 0.24, h + 0.24, r + 0.1, lin(0, y, 0, y + h, '#7a7ea0', '#4a4e70', '#2a2c48'), { stroke: '#14162a', sw: 0.03 });
  p.rrect(x - 0.04, y - 0.04, w + 0.08, h + 0.08, r + 0.03, '#2d3050', { stroke: null });
  // 풀밭
  p.rrect(x, y, w, h, r, lin(x, y, x + w, y + h, '#86dc62', '#62b850', '#4a9c46'), { stroke: '#2a6a34', sw: 0.025 });

  const rng = new Rng(2024);
  const c = p.c;
  c.save();
  c.clipRRect({ rect: Skia.XYWHRect(x, y, w, h), rx: r, ry: r }, 1, true);
  // 큰 얼룩
  for (let i = 0; i < 46; i++) {
    const px = rng.range(x, x + w);
    const py = rng.range(y, y + h);
    const light = rng.chance(0.5);
    p.oval(px, py, rng.range(0.3, 1.0), rng.range(0.2, 0.6), light ? '#b0f080' : '#2f8a3a', { stroke: null, alpha: rng.range(0.07, 0.15) });
  }
  // 풀잎
  for (let i = 0; i < 260; i++) {
    const px = rng.range(x + 0.1, x + w - 0.1);
    const py = rng.range(y + 0.1, y + h - 0.1);
    const g = rng.chance(0.5) ? '#3a9a46' : '#9ee070';
    const hgt = rng.range(0.05, 0.1);
    p.seg(px, py, px - 0.025, py - hgt, g, 0.016, 0.7);
    p.seg(px, py, px + 0.02, py - hgt * 1.1, g, 0.016, 0.7);
    p.seg(px, py, px, py - hgt * 1.3, g, 0.016, 0.7);
  }
  // 꽃
  const roadDist = (px: number, py: number) => {
    const dx = Math.max(Math.abs(px - BOARD_W / 2) - (PATH_RECT.x1 - PATH_RECT.x0) / 2, 0);
    const dy = Math.max(Math.abs(py - BOARD_H / 2) - (PATH_RECT.y1 - PATH_RECT.y0) / 2, 0);
    return Math.hypot(dx, dy);
  };
  for (let i = 0; i < 70; i++) {
    const px = rng.range(x + 0.2, x + w - 0.2);
    const py = rng.range(y + 0.2, y + h - 0.2);
    const onRoad = Math.abs(px - 0.5) < 0.55 || Math.abs(px - (BOARD_W - 0.5)) < 0.55 || Math.abs(py - 0.5) < 0.55 || Math.abs(py - (BOARD_H - 0.5)) < 0.55;
    if ((px > 0.4 && px < BOARD_W - 0.4 && py > 0.4 && py < BOARD_H - 0.4 && roadDist(px, py) === 0 && !onRoad) || onRoad) continue;
    const colr = rng.pick(['#ffffff', '#ffe27a', '#ff9ac0', '#c8a0ff']);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      p.circle(px + Math.cos(a) * 0.028, py + Math.sin(a) * 0.028, 0.022, colr, { stroke: null, alpha: 0.95 });
    }
    p.circle(px, py, 0.016, '#e0a020', { stroke: null });
  }
  c.restore();
}

function road(p: Pen) {
  const r = PATH_RECT;
  const ring = (w: number, color: string, dy = 0, alpha = 1) => {
    const path = newPath();
    path.addRRect({ rect: Skia.XYWHRect(r.x0, r.y0 + dy, r.x1 - r.x0, r.y1 - r.y0), rx: r.r, ry: r.r });
    p.stroke(path, color, w, { alpha });
  };
  ring(1.06, '#1a3a1a', 0.07, 0.35);
  ring(0.98, '#6b4a2e');
  ring(0.9, '#c9a26b');
  ring(0.64, '#dcbd8a', 0, 0.55);

  // 도로 위 돌멩이
  const rng = new Rng(913);
  for (let d = 0; d < LOOP_LENGTH; d += 0.28) {
    const pt = pointAt(d);
    const nx = -Math.sin(pt.angle);
    const ny = Math.cos(pt.angle);
    for (const off of [-0.31, 0, 0.31]) {
      const j = rng.range(-0.05, 0.05);
      const jx = rng.range(-0.06, 0.06);
      const sx = pt.x + nx * (off + j) + Math.cos(pt.angle) * jx;
      const sy = pt.y + ny * (off + j) + Math.sin(pt.angle) * jx;
      const sz = rng.range(0.05, 0.085);
      const tone = rng.pick(['#e6c894', '#d8b680', '#caa070', '#ebd2a4']);
      p.rrect(sx - sz, sy - sz * 0.75, sz * 2, sz * 1.5, sz * 0.5, tone, { stroke: shade(tone, -0.38), sw: 0.012, alpha: 0.9 });
    }
  }
  // 가장자리 잔돌
  for (let d = 0; d < LOOP_LENGTH; d += 0.2) {
    const pt = pointAt(d);
    for (const side of [-1, 1]) {
      if (!rng.chance(0.55)) continue;
      const off = side * rng.range(0.44, 0.52);
      const sx = pt.x - Math.sin(pt.angle) * off;
      const sy = pt.y + Math.cos(pt.angle) * off;
      p.circle(sx, sy, rng.range(0.02, 0.045), rng.pick(['#8a6a48', '#a08460', '#756048']), { stroke: '#3a2a18', sw: 0.008 });
    }
  }
}

function pads(p: Pen) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = 1 + c;
      const y = 1 + r;
      const odd = (c + r) % 2 === 1;
      p.rrect(x + 0.06, y + 0.09, 0.9, 0.9, 0.15, '#000000', { stroke: null, alpha: 0.28 });
      p.rrect(x + 0.04, y + 0.04, 0.92, 0.92, 0.15, lin(x, y, x + 1, y + 1, odd ? '#c4cde6' : '#b6c1de', odd ? '#9aa8ca' : '#8c9abe'), { stroke: '#434e74', sw: 0.022 });
      const inner = newPath();
      inner.addRRect({ rect: Skia.XYWHRect(x + 0.1, y + 0.1, 0.8, 0.8), rx: 0.11, ry: 0.11 });
      p.stroke(inner, '#ffffff', 0.014, { alpha: 0.35 });
      // 룬 문양
      const ring = newPath();
      ring.addCircle(x + 0.5, y + 0.52, 0.3);
      p.stroke(ring, '#5a6a9a', 0.016, { alpha: 0.35 });
      p.path(starPath(x + 0.5, y + 0.52, 0.2, 0.07, 4), '#5a6a9a', { stroke: null, alpha: 0.22 });
    }
  }
}

function corners(p: Pen) {
  // 판 모서리의 수정 기둥
  for (const [x, y] of [
    [-0.02, -0.02],
    [BOARD_W + 0.02, -0.02],
    [-0.02, BOARD_H + 0.02],
    [BOARD_W + 0.02, BOARD_H + 0.02],
  ] as const) {
    p.oval(x, y + 0.18, 0.2, 0.06, '#000000', { stroke: null, alpha: 0.3 });
    p.rrect(x - 0.13, y - 0.02, 0.26, 0.2, 0.05, lin(x, y, x, y + 0.2, '#9a9ec0', '#4a4e70'), { stroke: '#14162a', sw: 0.02 });
    const gem = polyPath([x, y - 0.3, x + 0.1, y - 0.12, x, y - 0.0, x - 0.1, y - 0.12]);
    p.glow(x, y - 0.14, 0.3, '#7be0ff', 0.55);
    p.path(gem, lin(x - 0.1, y - 0.3, x + 0.1, y, '#e8ffff', '#5ac8ff', '#2a78d0'), { stroke: '#143a6a', sw: 0.016 });
    p.path(polyPath([x - 0.02, y - 0.24, x + 0.03, y - 0.14, x - 0.03, y - 0.12]), '#ffffff', { stroke: null, alpha: 0.6 });
  }
}

/** 한 번만 굽는 정적 보드 그림 */
export function bakeBoard(): SkPicture {
  const m = BOARD_MARGIN;
  return record(BOARD_W + m * 2, BOARD_H + m * 2, -m, -m, (p) => {
    scenery(p);
    platform(p);
    road(p);
    pads(p);
    corners(p);
  });
}

/** 화면 전체 배경 (보드 뒤) — 크기에 맞춰 그라디언트를 만든다 */
export function bakeBackdrop(w: number, h: number): SkPicture {
  return record(w, h, 0, 0, (p) => {
    p.rect(0, 0, w, h, lin(0, 0, 0, h, '#2c6a5a', '#1d4a52', '#10283a'), { stroke: null });
    p.glow(w / 2, h * 0.45, Math.max(w, h) * 0.7, '#7affc0', 0.1, BlendMode.SrcOver);
    p.rect(0, 0, w, h, rad(w / 2, h / 2, Math.hypot(w, h) * 0.55, '#000000@0', '#000000@0.6'), { stroke: null });
  });
}
