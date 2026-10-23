import { BlendMode, Skia, SkiaPictureView, TileMode, type SkCanvas, type SkPicture } from '@shopify/react-native-skia';
import { useState } from 'react';
import { View } from 'react-native';
import { starPath } from '@/game/render/draw';
import { col } from '@/game/render/palette';
import { unitSprite } from '@/game/render/units';

type Kind = 'icon' | 'foreground' | 'splash';

function emblem(c: SkCanvas, S: number, scale: number) {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  const cx = S / 2;
  const cy = S * 0.52;
  // 후광
  p.setShader(Skia.Shader.MakeRadialGradient({ x: cx, y: cy }, S * 0.42 * scale, [col('#fff2a8', 0.95), col('#ffb02e', 0.5), col('#ffb02e', 0)], [0, 0.45, 1], TileMode.Clamp));
  c.drawCircle(cx, cy, S * 0.42 * scale, p);
  p.setShader(null);
  // 영웅
  const spr = unitSprite('fateweaver');
  const s = S * 0.92 * scale;
  c.save();
  c.translate(cx, cy + s * 0.06);
  c.scale(s, s);
  if (spr.back) c.drawPicture(spr.back);
  for (const [sp, dx, rot] of [
    [spr.wingL, -0.1, -14],
    [spr.wingR, 0.1, 14],
  ] as const) {
    if (!sp) continue;
    c.save();
    c.translate(dx, 0.06);
    c.rotate(rot, 0, 0);
    c.drawPicture(sp);
    c.restore();
  }
  c.drawPicture(spr.body);
  c.save();
  c.translate(spr.grip[0], spr.grip[1]);
  c.drawPicture(spr.weapon);
  c.restore();
  c.restore();
  // 반짝이
  p.setBlendMode(BlendMode.Plus);
  for (const [dx, dy, r, a] of [
    [-0.34, -0.3, 0.05, 0.95],
    [0.36, -0.22, 0.04, 0.85],
    [0.3, 0.3, 0.035, 0.8],
    [-0.32, 0.26, 0.03, 0.7],
  ] as const) {
    p.setColor(col('#fff6c8'));
    p.setAlphaf(a);
    c.drawPath(starPath(cx + dx * S * scale, cy + dy * S * scale, r * S * scale * 1.6, r * S * scale * 0.5, 4), p);
  }
}

function draw(kind: Kind, S: number): SkPicture {
  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(Skia.XYWHRect(0, 0, S, S));
  const p = Skia.Paint();
  p.setAntiAlias(true);
  if (kind === 'icon') {
    p.setShader(Skia.Shader.MakeLinearGradient({ x: 0, y: 0 }, { x: S, y: S }, [col('#8a4ae0'), col('#3a2aa0'), col('#161c68')], [0, 0.55, 1], TileMode.Clamp));
    c.drawPaint(p);
    p.setShader(null);
    // 햇살
    c.save();
    c.translate(S / 2, S * 0.52);
    for (let i = 0; i < 16; i++) {
      c.rotate(360 / 16, 0, 0);
      p.setColor(col('#ffe9a0'));
      p.setAlphaf(0.09);
      c.drawPath(Skia.PathBuilder.Make().moveTo(0, 0).lineTo(-S * 0.06, -S * 0.9).lineTo(S * 0.06, -S * 0.9).close().build(), p);
    }
    c.restore();
    // 아래쪽 어둡게
    p.setShader(Skia.Shader.MakeRadialGradient({ x: S / 2, y: S / 2 }, S * 0.78, [col('#000000', 0), col('#000000', 0.45)], [0.6, 1], TileMode.Clamp));
    p.setAlphaf(1);
    c.drawPaint(p);
    emblem(c, S, 1.0);
  } else if (kind === 'foreground') {
    emblem(c, S, 0.66);
  } else {
    emblem(c, S, 0.9);
  }
  return rec.finishRecordingAsPicture();
}

/** 개발용: 앱 아이콘/스플래시 이미지를 그린다 (?kind=icon|foreground|splash&size=1024) */
export default function IconDev() {
  const [{ pic, size, bg }] = useState(() => {
    const q = new URLSearchParams(location.search);
    const n = Number(q.get('size') ?? 1024);
    // 투명 PNG 는 검정/흰색 배경에서 각각 캡처해 차이로 알파를 복원한다 (?bg=#000000 / #ffffff)
    return { pic: draw((q.get('kind') ?? 'icon') as Kind, n), size: n, bg: q.get('bg') ?? 'transparent' };
  });
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <SkiaPictureView style={{ width: size, height: size }} picture={pic} />
    </View>
  );
}
