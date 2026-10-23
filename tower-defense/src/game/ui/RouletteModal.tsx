import { BlendMode, PaintStyle, Skia, SkiaPictureView, StrokeCap, type SkPicture } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ROULETTE_SLICES, type RouletteId } from '../engine/game';
import { skiaFont } from '../render/fonts';
import { col } from '../render/palette';
import { GText } from '@/ui/bits';
import { GButton } from '@/ui/GButton';
import { C } from '@/ui/theme';
import { haptic, sfx } from './feedback';
import type { GameSession } from './session';

const SIZE = 300;
const R = 128;
const CX = SIZE / 2;
const CY = SIZE / 2 + 6;
const N = ROULETTE_SLICES.length;
const STEP = 360 / N;

const COLORS: Record<RouletteId, [string, string]> = {
  gold: ['#ffd24d', '#c8901a'],
  power: ['#ff9a4a', '#c0501a'],
  free3: ['#7dff9b', '#2a9a50'],
  bomb: ['#ff7a7a', '#b02a3a'],
  gems: ['#7be0ff', '#2a8ac8'],
  freeze: ['#b8e8ff', '#5a9ad0'],
  legend: ['#ffc060', '#d07a10'],
  jackpot: ['#ff7ac0', '#a02a8a'],
};

const SHORT: Record<RouletteId, string> = {
  gold: '골드',
  power: '공격↑',
  free3: '소환×3',
  bomb: '폭탄',
  gems: '보석+3',
  freeze: '시간정지',
  legend: '전설!',
  jackpot: '신화!!',
};

const REWARD_TEXT: Record<RouletteId, string> = {
  gold: '골드 보너스!',
  power: '30초간 공격력 +40%',
  free3: '유닛 3기 무료 소환',
  bomb: '모든 몬스터에 폭탄!',
  gems: '보석 3개 획득',
  freeze: '몬스터 5초 정지',
  legend: '전설 유닛 획득!',
  jackpot: '신화 유닛 획득!!!',
};

let highlightIndex = -1;

interface Confetti {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  c: string;
  life: number;
}

function drawWheel(rotation: number, t: number, glow: number, confetti: Confetti[], pointerKick: number): SkPicture {
  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(Skia.XYWHRect(0, 0, SIZE, SIZE + 16));
  const p = Skia.Paint();
  p.setAntiAlias(true);

  // 바깥 테두리 + 전구
  p.setColor(col('#2a2f66'));
  c.drawCircle(CX, CY, R + 20, p);
  p.setColor(col('#ffd24d'));
  c.drawCircle(CX, CY, R + 15, p);
  p.setColor(col('#8a5a10'));
  c.drawCircle(CX, CY, R + 9, p);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const on = (Math.floor(t * 8) + i) % 2 === 0 || glow > 0;
    p.setColor(col(on ? '#fff6c0' : '#a07a30'));
    c.drawCircle(CX + Math.cos(a) * (R + 14), CY + Math.sin(a) * (R + 14), 3.2, p);
  }

  // 칸
  const font = skiaFont(30);
  for (let i = 0; i < N; i++) {
    const s = ROULETTE_SLICES[i];
    const [c0, c1] = COLORS[s.id];
    const start = -90 + i * STEP + rotation;
    p.reset();
    p.setAntiAlias(true);
    p.setShader(Skia.Shader.MakeRadialGradient({ x: CX, y: CY }, R, [col(c0), col(c1)], null, 0));
    c.drawArc(Skia.XYWHRect(CX - R, CY - R, R * 2, R * 2), start, STEP, true, p);
    p.setShader(null);
    p.setStyle(PaintStyle.Stroke);
    p.setStrokeWidth(2.5);
    p.setColor(col('#ffffff'));
    p.setAlphaf(0.9);
    c.drawArc(Skia.XYWHRect(CX - R, CY - R, R * 2, R * 2), start, STEP, true, p);
    // 당첨 칸 번쩍
    if (glow > 0 && i === highlightIndex) {
      p.reset();
      p.setAntiAlias(true);
      p.setColor(col('#ffffff'));
      p.setAlphaf(0.35 * (0.5 + 0.5 * Math.sin(t * 14)));
      p.setBlendMode(BlendMode.Plus);
      c.drawArc(Skia.XYWHRect(CX - R, CY - R, R * 2, R * 2), start, STEP, true, p);
    }
    if (font) {
      c.save();
      c.translate(CX, CY);
      c.rotate(start + STEP / 2, 0, 0);
      const label = SHORT[s.id];
      const w = font.getTextWidth(label);
      const tp = Skia.Paint();
      tp.setAntiAlias(true);
      tp.setStyle(PaintStyle.Stroke);
      tp.setStrokeWidth(5);
      tp.setColor(col('#10152e'));
      c.drawText(label, R - w - 14, 9, tp, font);
      tp.setStyle(PaintStyle.Fill);
      tp.setColor(col('#ffffff'));
      c.drawText(label, R - w - 14, 9, tp, font);
      c.restore();
    }
  }

  // 중앙 허브
  p.reset();
  p.setAntiAlias(true);
  p.setColor(col('#2a2f66'));
  c.drawCircle(CX, CY, 30, p);
  p.setColor(col('#ffd24d'));
  c.drawCircle(CX, CY, 25, p);
  p.setColor(col('#fff6c0'));
  c.drawCircle(CX, CY - 3, 13, p);

  // 포인터
  c.save();
  c.translate(CX, CY - R - 14);
  c.rotate(-pointerKick * 18, 0, -6);
  const tri = Skia.PathBuilder.Make().moveTo(-15, -14).lineTo(15, -14).lineTo(0, 24).close().build();
  p.reset();
  p.setAntiAlias(true);
  p.setColor(col('#ff4d6d'));
  c.drawPath(tri, p);
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeWidth(3);
  p.setStrokeCap(StrokeCap.Round);
  p.setColor(col('#ffffff'));
  c.drawPath(tri, p);
  c.restore();

  // 종이꽃가루
  for (const k of confetti) {
    p.reset();
    p.setAntiAlias(true);
    p.setColor(col(k.c));
    p.setAlphaf(Math.min(1, k.life));
    c.drawRect(Skia.XYWHRect(k.x, k.y, k.r, k.r * 0.6), p);
  }
  return rec.finishRecordingAsPicture();
}

const EMPTY: SkPicture = (() => {
  const rec = Skia.PictureRecorder();
  rec.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
  return rec.finishRecordingAsPicture();
})();

interface Props {
  session: GameSession;
  /** 티켓을 쓰고 이미 결정된 결과 (열 때마다 새로 마운트된다) */
  start: { index: number; id: RouletteId };
  onClose: () => void;
}

/** 행운 룰렛: 티켓 1장으로 돌린다. 결과는 휠이 멈춘 뒤 받는다. */
export function RouletteModal({ session, start, onClose }: Props) {
  const [pic, setPic] = useState<SkPicture>(EMPTY);
  const [phase, setPhase] = useState<'spin' | 'done'>('spin');
  const [result, setResult] = useState<RouletteId | null>(null);
  useEffect(() => {
    session.hold(true);
    let raf = 0;
    highlightIndex = -1;
    const target = start.index;
    // 칸 i 의 가운데가 포인터(위)에 오도록: rot ≡ -(i+0.5)*STEP
    const jitter = (Math.random() - 0.5) * STEP * 0.7;
    const finalRot = -((target + 0.5) * STEP) + jitter - 360 * (5 + Math.floor(Math.random() * 2));
    const t0 = performance.now();
    const dur = 4300;
    let lastSlice = -1;
    const confetti: Confetti[] = [];
    let doneAt = 0;
    const loop = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3.4);
      const rot = finalRot * e;
      const slice = Math.floor((((-rot % 360) + 360) % 360) / STEP);
      let kick = 0;
      if (slice !== lastSlice && k < 1) {
        lastSlice = slice;
        sfx('tick', 0.6);
        haptic('light');
        kick = 1;
      }
      if (k >= 1 && !doneAt) {
        doneAt = now;
        highlightIndex = target;
        setResult(start.id);
        setPhase('done');
        sfx(start.id === 'jackpot' || start.id === 'legend' ? 'jackpot' : 'merge');
        haptic('success');
        for (let i = 0; i < 70; i++) {
          confetti.push({ x: CX, y: CY, vx: (Math.random() - 0.5) * 8, vy: -Math.random() * 8 - 2, r: 4 + Math.random() * 5, c: ['#ff5a7a', '#ffd24d', '#7be0ff', '#7dff9b', '#c88aff'][i % 5], life: 1.4 });
        }
      }
      for (const c of confetti) {
        c.x += c.vx;
        c.y += c.vy;
        c.vy += 0.22;
        c.life -= 0.012;
      }
      const alive = confetti.filter((c) => c.life > 0);
      confetti.length = 0;
      confetti.push(...alive);
      setPic(drawWheel(rot, now / 1000, doneAt ? 1 : 0, confetti, kick));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      session.hold(false);
      // 어떤 경로로 닫혀도 이미 뽑은 보상은 잃지 않는다
      if (session.game.pendingRoulette) session.claimRoulette();
    };
  }, [start, session]);

  const close = () => {
    if (phase === 'done') session.claimRoulette();
    onClose();
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <GText size={26} color={C.gold} style={styles.title}>
          행운 룰렛
        </GText>
        <View style={{ width: SIZE, height: SIZE + 16 }}>
          <SkiaPictureView style={{ width: SIZE, height: SIZE + 16 }} picture={pic} />
        </View>
        <View style={{ height: 52, alignItems: 'center', justifyContent: 'center' }}>
          {phase === 'spin' ? (
            <GText size={18} color={C.sub}>
              두근두근...
            </GText>
          ) : phase === 'done' && result ? (
            <GText size={22} color={result === 'jackpot' || result === 'legend' ? C.gold : '#fff'}>
              {REWARD_TEXT[result]}
            </GText>
          ) : null}
        </View>
        <GButton label={phase === 'done' ? '받기' : '돌리는 중'} variant={phase === 'done' ? 'gold' : 'dark'} height={50} style={{ width: 180 }} disabled={phase === 'spin'} glow={phase === 'done'} onPress={close} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,8,25,0.82)', alignItems: 'center', justifyContent: 'center' },
  card: { alignItems: 'center', gap: 4 },
  title: { textShadowColor: '#10152e', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 6, marginBottom: 2 },
});
