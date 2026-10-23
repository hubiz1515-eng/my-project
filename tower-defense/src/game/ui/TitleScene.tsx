import { BlendMode, Skia, SkiaPictureView, TileMode, type SkCanvas, type SkPicture } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import type { UnitId } from '../engine/units';
import { col } from '../render/palette';
import { unitSprite } from '../render/units';

const EMPTY: SkPicture = (() => {
  const rec = Skia.PictureRecorder();
  rec.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
  return rec.finishRecordingAsPicture();
})();

interface Star {
  x: number;
  y: number;
  r: number;
  ph: number;
}

interface Mote {
  x: number;
  y: number;
  vy: number;
  ph: number;
  c: string;
}

/** dx: 무대 위 가로 위치(칸 폭 단위), dy: 앞뒤(클수록 앞), s: 크기 */
const HEROES: { id: UnitId; dx: number; dy: number; s: number }[] = [
  { id: 'eternity', dx: 0, dy: -0.22, s: 1.25 },
  { id: 'shadowlord', dx: -2, dy: 0.02, s: 0.95 },
  { id: 'timelord', dx: 2, dy: 0.02, s: 0.95 },
  { id: 'dragonlord', dx: -1, dy: 0.1, s: 1.0 },
  { id: 'fateweaver', dx: 1, dy: 0.1, s: 1.0 },
];

function hills(c: SkCanvas, w: number, h: number, base: number, amp: number, color: string, phase: number, alpha = 1) {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(col(color));
  p.setAlphaf(alpha);
  const path = Skia.PathBuilder.Make();
  path.moveTo(0, h);
  path.lineTo(0, base);
  const n = 6;
  for (let i = 1; i <= n; i++) {
    const x = (w / n) * i;
    const y = base + Math.sin(phase + i * 1.3) * amp;
    path.quadTo(x - w / n / 2, base + Math.sin(phase + i * 1.3 - 0.8) * amp * 1.4, x, y);
  }
  path.lineTo(w, h);
  path.close();
  c.drawPath(path.build(), p);
}

function drawScene(w: number, h: number, t: number, stars: Star[], motes: Mote[]): SkPicture {
  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(Skia.XYWHRect(0, 0, w, h));
  const p = Skia.Paint();
  p.setAntiAlias(true);

  // 하늘
  p.setShader(Skia.Shader.MakeLinearGradient({ x: 0, y: 0 }, { x: 0, y: h }, [col('#0c1240'), col('#27227a'), col('#7a3fa8'), col('#ff8a7a')], [0, 0.45, 0.78, 1], TileMode.Clamp));
  c.drawPaint(p);
  p.setShader(null);

  // 별
  for (const s of stars) {
    p.setColor(col('#ffffff'));
    p.setAlphaf(0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2 + s.ph)));
    c.drawCircle(s.x * w, s.y * h, s.r, p);
  }

  // 달
  p.setShader(Skia.Shader.MakeRadialGradient({ x: w * 0.82, y: h * 0.16 }, w * 0.28, [col('#fff6c8', 0.9), col('#fff6c8', 0)], null, TileMode.Clamp));
  p.setAlphaf(1);
  c.drawCircle(w * 0.82, h * 0.16, w * 0.28, p);
  p.setShader(null);
  p.setColor(col('#fff8d8'));
  c.drawCircle(w * 0.82, h * 0.16, w * 0.07, p);
  p.setColor(col('#f0e4b0'));
  c.drawCircle(w * 0.8, h * 0.15, w * 0.012, p);
  c.drawCircle(w * 0.84, h * 0.175, w * 0.009, p);

  // 구름
  for (let i = 0; i < 5; i++) {
    const cx = ((t * (8 + i * 3) + i * 140) % (w + 240)) - 120;
    const cy = h * (0.12 + i * 0.07);
    p.setColor(col('#ffffff'));
    p.setAlphaf(0.1);
    for (const [dx, dy, r] of [
      [-30, 6, 22],
      [0, 0, 30],
      [34, 8, 22],
      [14, 12, 24],
    ] as const) c.drawCircle(cx + dx, cy + dy, r, p);
  }

  // 언덕
  hills(c, w, h, h * 0.66, 10, '#1a2a6a', 0.5, 0.9);
  hills(c, w, h, h * 0.72, 12, '#16344f', 2.0);
  hills(c, w, h, h * 0.8, 10, '#0f2a3a', 4.0);

  // 무대
  const sx = w / 2;
  const sy = h * 0.6;
  const sw = Math.min(w * 0.42, 190);
  p.setAlphaf(1);
  p.setShader(Skia.Shader.MakeRadialGradient({ x: sx, y: sy }, sw * 1.5, [col('#ffe9a0', 0.55), col('#ffe9a0', 0)], null, TileMode.Clamp));
  p.setBlendMode(BlendMode.Plus);
  c.drawOval(Skia.XYWHRect(sx - sw * 1.5, sy - sw * 0.9, sw * 3, sw * 1.8), p);
  p.setBlendMode(BlendMode.SrcOver);
  p.setShader(null);
  p.setColor(col('#1b2150'));
  c.drawOval(Skia.XYWHRect(sx - sw * 1.0, sy + sw * 0.16, sw * 2, sw * 0.62), p);
  p.setColor(col('#59639e'));
  c.drawOval(Skia.XYWHRect(sx - sw * 0.97, sy + sw * 0.1, sw * 1.94, sw * 0.6), p);
  p.setShader(Skia.Shader.MakeLinearGradient({ x: sx, y: sy + sw * 0.1 }, { x: sx, y: sy + sw * 0.7 }, [col('#b6c2f0'), col('#7482c4')], null, TileMode.Clamp));
  c.drawOval(Skia.XYWHRect(sx - sw * 0.92, sy + sw * 0.08, sw * 1.84, sw * 0.5), p);
  p.setShader(null);
  p.setColor(col('#ffffff'));
  p.setAlphaf(0.35);
  c.drawOval(Skia.XYWHRect(sx - sw * 0.7, sy + sw * 0.17, sw * 1.4, sw * 0.3), p);
  p.setAlphaf(1);

  // 영웅들
  const unit = Math.min(w * 0.32, 135);
  const gap = Math.min(w * 0.185, 78);
  for (const hd of HEROES) {
    const spr = unitSprite(hd.id);
    const x = sx + hd.dx * gap;
    const y = sy + sw * 0.34 + hd.dy * sw * 1.6;
    const bob = Math.sin(t * 2.4 + hd.dx * 1.7) * 0.012;
    const s = unit * hd.s;
    // 그림자 + 오라
    p.setColor(col('#000000'));
    p.setAlphaf(0.3);
    c.drawOval(Skia.XYWHRect(x - s * 0.2, y - s * 0.04, s * 0.4, s * 0.1), p);
    p.setAlphaf(1);
    c.save();
    c.translate(x, y - s * 0.3 + bob * s);
    c.scale(s, s);
    if (spr.back) c.drawPicture(spr.back);
    const flap = Math.sin(t * 5 + hd.dx * 2) * 10;
    if (spr.wingL) {
      c.save();
      c.translate(-0.1, 0.06);
      c.rotate(-flap - 6, 0, 0);
      c.drawPicture(spr.wingL);
      c.restore();
    }
    if (spr.wingR) {
      c.save();
      c.translate(0.1, 0.06);
      c.rotate(flap + 6, 0, 0);
      c.drawPicture(spr.wingR);
      c.restore();
    }
    c.drawPicture(spr.body);
    c.save();
    c.translate(spr.grip[0], spr.grip[1]);
    c.drawPicture(spr.weapon);
    c.restore();
    c.restore();
  }

  // 반딧불/불씨
  for (const m of motes) {
    const y = ((m.y - t * m.vy) % 1 + 1) % 1;
    const x = m.x + Math.sin(t * 0.8 + m.ph) * 0.03;
    p.setShader(Skia.Shader.MakeRadialGradient({ x: x * w, y: y * h }, 9, [col(m.c, 1), col(m.c, 0)], null, TileMode.Clamp));
    p.setBlendMode(BlendMode.Plus);
    p.setAlphaf(0.5 + 0.5 * Math.sin(t * 3 + m.ph));
    c.drawCircle(x * w, y * h, 9, p);
  }
  p.setShader(null);
  p.setBlendMode(BlendMode.SrcOver);
  return rec.finishRecordingAsPicture();
}

/** 타이틀 배경: 별이 반짝이는 밤하늘 위에서 영웅들이 무대에 서 있다 */
export function TitleScene() {
  const [pic, setPic] = useState<SkPicture>(EMPTY);
  const size = useRef({ w: 0, h: 0 });
  const stars = useMemo<Star[]>(() => Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random() * 0.5, r: 0.6 + Math.random() * 1.3, ph: Math.random() * 6 })), []);
  const motes = useMemo<Mote[]>(() => Array.from({ length: 26 }, (_, i) => ({ x: Math.random(), y: Math.random(), vy: 0.015 + Math.random() * 0.03, ph: Math.random() * 6, c: i % 3 === 0 ? '#ffe27a' : i % 3 === 1 ? '#9affd8' : '#ffb0e0' })), []);
  const raf = useRef(0);
  const manual = typeof window !== 'undefined' && window.location?.search?.includes('manual');

  const draw = (t: number) => {
    const { w, h } = size.current;
    if (w > 0) setPic(drawScene(w, h, t, stars, motes));
  };

  useEffect(() => {
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
    cancelAnimationFrame(raf.current);
    draw(2.5);
    if (manual) return;
    const t0 = performance.now();
    const loop = (now: number) => {
      draw(2.5 + (now - t0) / 1000);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout}>
      <SkiaPictureView style={StyleSheet.absoluteFill} picture={pic} />
    </View>
  );
}
