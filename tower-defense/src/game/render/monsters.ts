import { Skia, type SkPicture } from '@shopify/react-native-skia';
import type { EnemyKind } from '../engine/enemies';
import { lin, newPath, Pen, polyPath, rad, record, starPath } from './draw';

/** 몬스터 스프라이트: 원점 = 몸 중심, 크기 1 ≈ 한 칸. 오른쪽을 보고 있다. */
export interface MonsterSprite {
  body: SkPicture;
  /** 펄럭이는 날개 (어깨 기준, 오른쪽 기준으로 그려져 있고 왼쪽은 반전) */
  wing: SkPicture | null;
  wingPivot: readonly [number, number];
  /** 꼬리/무기 등 흔들리는 부속 */
  extra: SkPicture | null;
  extraPivot: readonly [number, number];
  /** 떠다님 (그림자가 작아지고 위아래로 흔들림) */
  float: number;
  /** 발끝 y (그림자 위치) */
  feet: number;
  /** 눈 위치(상태 효과 표시용 머리 위 높이) */
  top: number;
  /** 몸 반지름 (피격 연출/체력바 기준) */
  radius: number;
}

const OW = 0.018;

interface EyeOpts {
  color?: string;
  pupil?: string;
  angry?: boolean;
  size?: number;
  glow?: boolean;
}

function eyes(p: Pen, cx: number, cy: number, gap: number, o: EyeOpts = {}) {
  const s = o.size ?? 1;
  for (const k of [-1, 1]) {
    const ex = cx + k * gap;
    if (o.glow) p.glow(ex, cy, 0.09 * s, o.color ?? '#ff4040', 0.9);
    p.oval(ex, cy, 0.045 * s, 0.058 * s, o.color ?? '#ffffff', { stroke: '#1b1530', sw: 0.012 });
    p.oval(ex + 0.006 * s, cy + 0.006 * s, 0.024 * s, 0.034 * s, o.pupil ?? '#1b1530', { stroke: null });
    p.circle(ex + 0.016 * s, cy - 0.012 * s, 0.011 * s, '#ffffff', { stroke: null });
  }
  if (o.angry) {
    for (const k of [-1, 1]) {
      p.seg(cx + k * gap + k * 0.055 * s, cy - 0.075 * s, cx + k * gap - k * 0.045 * s, cy - 0.04 * s, '#1b1530', 0.026);
    }
  }
}

function mouthSmile(p: Pen, cx: number, cy: number, w = 0.05, color = '#6a2a2a') {
  const m = newPath();
  m.moveTo(cx - w, cy);
  m.quadTo(cx, cy + w * 0.9, cx + w, cy);
  p.stroke(m, color, 0.014);
}

function fangs(p: Pen, cx: number, cy: number, gap = 0.04) {
  for (const k of [-1, 1]) {
    p.path(polyPath([cx + k * gap - 0.014, cy, cx + k * gap + 0.014, cy, cx + k * gap, cy + 0.035]), '#ffffff', { stroke: '#4a2a30', sw: 0.008 });
  }
}

// ───────────────────────────── 종류별 ─────────────────────────────

function slime(): MonsterSprite {
  const body = record(1.2, 1.2, -0.6, -0.6, (p) => {
    const b = newPath();
    b.moveTo(-0.3, 0.26);
    b.cubicTo(-0.36, -0.02, -0.16, -0.31, 0, -0.31);
    b.cubicTo(0.16, -0.31, 0.36, -0.02, 0.3, 0.26);
    b.quadTo(0, 0.33, -0.3, 0.26);
    b.close();
    p.path(b, lin(0, -0.3, 0, 0.3, '#b6ff9a', '#5fdc66', '#2fa84a'), { stroke: '#1d6a34', sw: OW });
    p.oval(-0.1, -0.15, 0.09, 0.05, '#ffffff', { stroke: null, alpha: 0.55 });
    p.circle(0.12, -0.2, 0.02, '#ffffff', { stroke: null, alpha: 0.6 });
    p.circle(0.17, 0.12, 0.03, '#ffffff', { stroke: null, alpha: 0.25 });
    p.circle(-0.2, 0.15, 0.022, '#ffffff', { stroke: null, alpha: 0.25 });
    eyes(p, 0, 0.0, 0.085, { size: 1.15 });
    mouthSmile(p, 0, 0.1, 0.04);
  });
  return { body, wing: null, wingPivot: [0, 0], extra: null, extraPivot: [0, 0], float: 0, feet: 0.28, top: -0.32, radius: 0.3 };
}

function goblin(): MonsterSprite {
  const body = record(1.2, 1.2, -0.6, -0.6, (p) => {
    for (const k of [-1, 1]) p.rrect(k * 0.07 - 0.04, 0.2, 0.08, 0.09, 0.03, '#2f5a2a');
    // 몸통
    const t = newPath();
    t.moveTo(-0.13, 0.04);
    t.quadTo(0, 0.0, 0.13, 0.04);
    t.quadTo(0.15, 0.17, 0.12, 0.26);
    t.quadTo(0, 0.3, -0.12, 0.26);
    t.quadTo(-0.15, 0.17, -0.13, 0.04);
    t.close();
    p.path(t, lin(0, 0, 0, 0.3, '#b27a3a', '#7a4e24'));
    p.rrect(-0.13, 0.16, 0.26, 0.035, 0.01, '#3a2414');
    // 귀
    for (const k of [-1, 1]) {
      p.path(polyPath([k * 0.15, -0.14, k * 0.34, -0.2, k * 0.17, -0.04]), '#7cc65a', { stroke: '#2f5a2a', sw: OW });
      p.path(polyPath([k * 0.18, -0.14, k * 0.29, -0.18, k * 0.19, -0.08]), '#f0a0a0', { stroke: null, alpha: 0.6 });
    }
    p.circle(0, -0.1, 0.2, rad(-0.05, -0.17, 0.26, '#b6f08a', '#7cc65a', '#4a9a3a'), { stroke: '#2f5a2a', sw: OW });
    eyes(p, 0, -0.1, 0.075, { color: '#ffe85a', angry: true, size: 0.95 });
    p.path(polyPath([-0.02, -0.065, 0.02, -0.065, 0, -0.03]), '#5aa23a', { stroke: null });
    mouthSmile(p, 0, -0.01, 0.06, '#3a1a1a');
    fangs(p, 0, -0.012, 0.045);
    p.circle(-0.185, 0.12, 0.04, '#7cc65a', { stroke: '#2f5a2a', sw: 0.012 });
  });
  const extra = record(1, 1, -0.5, -0.5, (p) => {
    // 몽둥이 (손잡이가 원점)
    p.rrect(-0.018, -0.2, 0.036, 0.3, 0.012, '#8a5a30');
    p.oval(0, -0.24, 0.055, 0.08, lin(-0.05, 0, 0.05, 0, '#b8844a', '#6a4220'), { stroke: '#3a2414' });
    p.circle(0, 0.02, 0.04, '#7cc65a', { stroke: '#2f5a2a', sw: 0.012 });
  });
  return { body, wing: null, wingPivot: [0, 0], extra, extraPivot: [0.19, 0.12], float: 0, feet: 0.3, top: -0.32, radius: 0.24 };
}

function bat(): MonsterSprite {
  const body = record(1.2, 1.2, -0.6, -0.6, (p) => {
    for (const k of [-1, 1]) p.path(polyPath([k * 0.06, -0.12, k * 0.16, -0.32, k * 0.15, -0.08]), '#6a4a9a', { stroke: '#2a1a4a', sw: OW });
    p.circle(0, 0, 0.2, rad(-0.06, -0.08, 0.28, '#b494e8', '#7a56c0', '#4a3282'), { stroke: '#2a1a4a', sw: OW });
    p.oval(0, 0.07, 0.11, 0.09, '#d8c4f4', { stroke: null, alpha: 0.55 });
    eyes(p, 0, -0.03, 0.07, { color: '#ffe85a', angry: true, size: 0.95 });
    mouthSmile(p, 0, 0.06, 0.045, '#2a1030');
    fangs(p, 0, 0.065, 0.035);
    for (const k of [-1, 1]) p.rrect(k * 0.06 - 0.02, 0.17, 0.04, 0.06, 0.015, '#3a2a5a');
  });
  const wing = record(1.2, 1.2, -0.6, -0.6, (p) => {
    const w = newPath();
    w.moveTo(0, 0);
    w.quadTo(0.2, -0.28, 0.46, -0.2);
    w.quadTo(0.38, -0.12, 0.42, -0.04);
    w.quadTo(0.3, -0.04, 0.3, 0.06);
    w.quadTo(0.18, 0.0, 0.14, 0.1);
    w.quadTo(0.06, 0.06, 0, 0.1);
    w.close();
    p.path(w, lin(0, -0.2, 0.4, 0.1, '#8a64d0', '#4a2a88'), { stroke: '#1f1038', sw: OW });
    p.seg(0, 0, 0.42, -0.18, '#2a1a4a', 0.012);
    p.seg(0, 0.02, 0.3, 0.04, '#2a1a4a', 0.01);
  });
  return { body, wing, wingPivot: [0.1, -0.02], extra: null, extraPivot: [0, 0], float: 1, feet: 0.24, top: -0.34, radius: 0.22 };
}

function mushroom(): MonsterSprite {
  const body = record(1.2, 1.2, -0.6, -0.6, (p) => {
    for (const k of [-1, 1]) p.rrect(k * 0.09 - 0.05, 0.2, 0.1, 0.09, 0.035, '#c8b088');
    p.rrect(-0.15, -0.03, 0.3, 0.27, 0.1, lin(-0.15, 0, 0.15, 0, '#fff0d0', '#d8c098'), { stroke: '#6a5030', sw: OW });
    const cap = newPath();
    cap.moveTo(-0.34, 0.0);
    cap.cubicTo(-0.36, -0.3, 0.36, -0.3, 0.34, 0.0);
    cap.quadTo(0, 0.07, -0.34, 0.0);
    cap.close();
    p.path(cap, lin(0, -0.3, 0, 0.05, '#ff6a6a', '#d02a3a'), { stroke: '#5a1020', sw: OW });
    for (const [x, y, r] of [
      [-0.16, -0.14, 0.05],
      [0.06, -0.2, 0.06],
      [0.2, -0.08, 0.04],
      [-0.03, -0.07, 0.03],
    ] as const) {
      p.circle(x, y, r, '#fff6f0', { stroke: '#a05060', sw: 0.01 });
    }
    eyes(p, 0, 0.08, 0.06, { angry: true, size: 0.85 });
    mouthSmile(p, 0, 0.17, 0.035, '#5a2a2a');
    p.oval(-0.18, 0.15, 0.025, 0.014, '#ff8aa0', { stroke: null, alpha: 0.5 });
    p.oval(0.18, 0.15, 0.025, 0.014, '#ff8aa0', { stroke: null, alpha: 0.5 });
    // 독 거품
    p.circle(-0.28, -0.2, 0.025, '#b6ff6a', { stroke: '#4a8a20', sw: 0.008, alpha: 0.8 });
    p.circle(0.3, -0.18, 0.018, '#b6ff6a', { stroke: '#4a8a20', sw: 0.008, alpha: 0.8 });
  });
  return { body, wing: null, wingPivot: [0, 0], extra: null, extraPivot: [0, 0], float: 0, feet: 0.29, top: -0.34, radius: 0.28 };
}

function skeleton(): MonsterSprite {
  const body = record(1.2, 1.2, -0.6, -0.6, (p) => {
    for (const k of [-1, 1]) p.rrect(k * 0.07 - 0.03, 0.2, 0.06, 0.1, 0.02, '#e8e2d0');
    // 갈비뼈
    p.rrect(-0.11, 0.03, 0.22, 0.2, 0.05, '#efe9d6', { stroke: '#6a6450', sw: OW });
    for (let i = 0; i < 3; i++) p.seg(-0.09, 0.08 + i * 0.05, 0.09, 0.08 + i * 0.05, '#6a6450', 0.012);
    p.seg(0, 0.04, 0, 0.22, '#6a6450', 0.012);
    // 머리뼈
    p.circle(0, -0.12, 0.19, rad(-0.05, -0.2, 0.26, '#ffffff', '#e8e2cc', '#b8b098'), { stroke: '#5a5440', sw: OW });
    p.rrect(-0.08, -0.01, 0.16, 0.07, 0.025, '#e2dcc6', { stroke: '#5a5440', sw: 0.014 });
    for (let i = -1; i <= 1; i++) p.seg(i * 0.04, 0.0, i * 0.04, 0.055, '#5a5440', 0.01);
    for (const k of [-1, 1]) {
      p.glow(k * 0.075, -0.12, 0.09, '#ff3030', 0.8);
      p.oval(k * 0.075, -0.12, 0.05, 0.058, '#2a1020', { stroke: '#120610', sw: 0.01 });
      p.circle(k * 0.075, -0.115, 0.016, '#ff5050', { stroke: null });
    }
    p.path(polyPath([-0.015, -0.07, 0.015, -0.07, 0, -0.035]), '#2a1020', { stroke: null });
    // 녹슨 투구
    const h = newPath();
    h.addArc(Skia.XYWHRect(-0.2, -0.32, 0.4, 0.4), 195, 150);
    h.close();
    p.path(h, lin(0, -0.32, 0, -0.1, '#9a8a78', '#5a4a40'), { stroke: '#2a2020', sw: OW });
    p.circle(-0.185, 0.1, 0.035, '#efe9d6', { stroke: '#6a6450', sw: 0.01 });
  });
  const extra = record(1, 1, -0.5, -0.5, (p) => {
    const blade = newPath();
    blade.moveTo(-0.02, -0.02);
    blade.lineTo(-0.016, -0.26);
    blade.lineTo(0.0, -0.3);
    blade.lineTo(0.016, -0.26);
    blade.lineTo(0.02, -0.02);
    blade.close();
    p.path(blade, lin(-0.03, 0, 0.03, 0, '#c8c8d0', '#7a7a88'), { stroke: '#3a3a44', sw: 0.012 });
    p.rrect(-0.06, -0.04, 0.12, 0.025, 0.008, '#6a4a2a');
    p.rrect(-0.012, -0.02, 0.024, 0.08, 0.008, '#4a3020');
    p.circle(0, 0.03, 0.032, '#efe9d6', { stroke: '#6a6450', sw: 0.01 });
  });
  return { body, wing: null, wingPivot: [0, 0], extra, extraPivot: [0.19, 0.12], float: 0, feet: 0.3, top: -0.34, radius: 0.24 };
}

function wolf(): MonsterSprite {
  const body = record(1.4, 1.2, -0.7, -0.6, (p) => {
    for (const x of [-0.19, -0.1, 0.12, 0.2]) p.rrect(x - 0.035, 0.12, 0.07, 0.17, 0.03, '#5a6070');
    // 몸통
    p.oval(-0.03, 0.04, 0.3, 0.17, lin(0, -0.1, 0, 0.2, '#b4bccb', '#7a8296'), { stroke: '#2e3442', sw: OW });
    p.oval(-0.03, 0.12, 0.22, 0.08, '#e8ecf4', { stroke: null, alpha: 0.7 });
    // 머리
    p.path(polyPath([0.18, -0.14, 0.26, -0.3, 0.3, -0.12]), '#8a92a4', { stroke: '#2e3442', sw: OW });
    p.path(polyPath([0.06, -0.14, 0.1, -0.3, 0.18, -0.13]), '#8a92a4', { stroke: '#2e3442', sw: OW });
    p.circle(0.2, -0.04, 0.17, rad(0.16, -0.1, 0.22, '#d8deea', '#9aa2b6', '#6a7288'), { stroke: '#2e3442', sw: OW });
    p.oval(0.34, 0.0, 0.1, 0.075, '#e6eaf2', { stroke: '#2e3442', sw: OW });
    p.circle(0.43, -0.015, 0.025, '#1b1530', { stroke: null });
    mouthSmile(p, 0.34, 0.03, 0.05, '#3a1a1a');
    fangs(p, 0.34, 0.032, 0.035);
    eyes(p, 0.2, -0.08, 0.05, { color: '#ffd84a', angry: true, size: 0.8 });
  });
  const extra = record(1, 1, -0.5, -0.5, (p) => {
    const t = newPath();
    t.moveTo(0, 0);
    t.quadTo(-0.14, -0.04, -0.22, -0.16);
    t.quadTo(-0.12, -0.02, 0, 0.06);
    t.close();
    p.path(t, lin(0, 0, -0.2, -0.1, '#a0a8bc', '#e8ecf4'), { stroke: '#2e3442', sw: OW });
  });
  return { body, wing: null, wingPivot: [0, 0], extra, extraPivot: [-0.3, 0.0], float: 0, feet: 0.29, top: -0.32, radius: 0.28 };
}

function orc(): MonsterSprite {
  const body = record(1.4, 1.4, -0.7, -0.7, (p) => {
    for (const k of [-1, 1]) p.rrect(k * 0.11 - 0.06, 0.2, 0.12, 0.11, 0.04, '#3a4a2a');
    const t = newPath();
    t.moveTo(-0.2, 0.0);
    t.quadTo(0, -0.04, 0.2, 0.0);
    t.quadTo(0.26, 0.15, 0.2, 0.26);
    t.quadTo(0, 0.32, -0.2, 0.26);
    t.quadTo(-0.26, 0.15, -0.2, 0.0);
    t.close();
    p.path(t, lin(0, 0, 0, 0.3, '#7da05a', '#4a6a34'), { stroke: '#2a3a1c', sw: OW });
    p.rrect(-0.2, 0.16, 0.4, 0.05, 0.015, '#5a3a20');
    p.rrect(-0.04, 0.15, 0.08, 0.07, 0.01, '#d9a43a', { stroke: '#6a4a10', sw: 0.01 });
    // 어깨 가시
    for (const k of [-1, 1]) {
      p.circle(k * 0.22, 0.02, 0.07, '#6a6a78', { stroke: '#2a2a34', sw: OW });
      p.path(polyPath([k * 0.2, -0.02, k * 0.24, -0.14, k * 0.26, 0.0]), '#c8c8d4', { stroke: '#2a2a34', sw: 0.012 });
    }
    // 머리
    p.circle(0, -0.14, 0.19, rad(-0.05, -0.22, 0.26, '#a4c97a', '#7da05a', '#52723a'), { stroke: '#2a3a1c', sw: OW });
    for (const k of [-1, 1]) p.path(polyPath([k * 0.17, -0.2, k * 0.27, -0.26, k * 0.2, -0.1]), '#7da05a', { stroke: '#2a3a1c', sw: OW });
    eyes(p, 0, -0.15, 0.07, { color: '#fff0a0', angry: true, size: 0.9 });
    p.rrect(-0.1, -0.06, 0.2, 0.07, 0.03, '#52723a', { stroke: '#2a3a1c', sw: 0.012 });
    for (const k of [-1, 1]) p.path(polyPath([k * 0.07 - 0.02, -0.04, k * 0.07 + 0.02, -0.04, k * 0.07 + 0.01, -0.13]), '#fff6d8', { stroke: '#6a5a30', sw: 0.01 });
    p.circle(-0.26, 0.14, 0.055, '#7da05a', { stroke: '#2a3a1c', sw: 0.012 });
  });
  const extra = record(1, 1, -0.5, -0.5, (p) => {
    p.rrect(-0.025, -0.32, 0.05, 0.42, 0.015, '#6a4220');
    p.oval(0, -0.36, 0.1, 0.12, lin(-0.1, 0, 0.1, 0, '#8a5a30', '#4a2c14'), { stroke: '#2a1a0c' });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      p.circle(Math.cos(a) * 0.08, -0.36 + Math.sin(a) * 0.1, 0.014, '#c8c8d4', { stroke: null });
    }
    p.circle(0, 0.05, 0.05, '#7da05a', { stroke: '#2a3a1c', sw: 0.012 });
  });
  return { body, wing: null, wingPivot: [0, 0], extra, extraPivot: [0.27, 0.14], float: 0, feet: 0.31, top: -0.36, radius: 0.3 };
}

function ghost(): MonsterSprite {
  const body = record(1.2, 1.4, -0.6, -0.7, (p) => {
    p.glow(0, -0.02, 0.5, '#9ad8ff', 0.5);
    const b = newPath();
    b.moveTo(-0.24, 0.26);
    b.cubicTo(-0.3, -0.1, -0.2, -0.3, 0, -0.3);
    b.cubicTo(0.2, -0.3, 0.3, -0.1, 0.24, 0.26);
    b.quadTo(0.17, 0.2, 0.12, 0.3);
    b.quadTo(0.06, 0.2, 0, 0.3);
    b.quadTo(-0.06, 0.2, -0.12, 0.3);
    b.quadTo(-0.17, 0.2, -0.24, 0.26);
    b.close();
    p.path(b, lin(0, -0.3, 0, 0.3, '#ffffff', '#cfe6ff', '#8ab4e8'), { stroke: '#4a6a9a', sw: OW });
    for (const k of [-1, 1]) {
      p.oval(k * 0.075, -0.07, 0.045, 0.068, '#1b2040', { stroke: '#0a0c20', sw: 0.01 });
      p.circle(k * 0.075 + 0.01, -0.09, 0.012, '#9ad8ff', { stroke: null });
    }
    p.oval(0, 0.06, 0.03, 0.04, '#1b2040', { stroke: '#0a0c20', sw: 0.01 });
    p.oval(-0.15, 0.0, 0.035, 0.02, '#ff9ab8', { stroke: null, alpha: 0.4 });
    p.oval(0.15, 0.0, 0.035, 0.02, '#ff9ab8', { stroke: null, alpha: 0.4 });
    for (const k of [-1, 1]) {
      const arm = newPath();
      arm.moveTo(k * 0.22, 0.04);
      arm.quadTo(k * 0.34, 0.08, k * 0.34, 0.18);
      p.stroke(arm, '#cfe6ff', 0.07);
      p.stroke(arm, '#ffffff', 0.04, { alpha: 0.8 });
    }
  });
  return { body, wing: null, wingPivot: [0, 0], extra: null, extraPivot: [0, 0], float: 1, feet: 0.3, top: -0.34, radius: 0.26 };
}

function imp(): MonsterSprite {
  const body = record(1.2, 1.2, -0.6, -0.6, (p) => {
    for (const k of [-1, 1]) p.rrect(k * 0.07 - 0.035, 0.2, 0.07, 0.09, 0.025, '#8a1a2a');
    const t = newPath();
    t.moveTo(-0.11, 0.04);
    t.quadTo(0, 0.0, 0.11, 0.04);
    t.quadTo(0.14, 0.16, 0.11, 0.25);
    t.quadTo(0, 0.29, -0.11, 0.25);
    t.quadTo(-0.14, 0.16, -0.11, 0.04);
    t.close();
    p.path(t, lin(0, 0, 0, 0.3, '#ff6a6a', '#c02a3a'), { stroke: '#5a1020', sw: OW });
    p.oval(0, 0.15, 0.06, 0.08, '#ffb0a0', { stroke: null, alpha: 0.7 });
    for (const k of [-1, 1]) {
      const horn = newPath();
      horn.moveTo(k * 0.08, -0.26);
      horn.quadTo(k * 0.14, -0.38, k * 0.2, -0.4);
      horn.quadTo(k * 0.18, -0.3, k * 0.13, -0.2);
      horn.close();
      p.path(horn, '#fff0c0', { stroke: '#5a3a20', sw: OW });
      p.path(polyPath([k * 0.16, -0.12, k * 0.3, -0.12, k * 0.17, -0.02]), '#ff6a6a', { stroke: '#5a1020', sw: OW });
    }
    p.circle(0, -0.1, 0.19, rad(-0.05, -0.18, 0.25, '#ff9a8a', '#ff5a5a', '#c02a3a'), { stroke: '#5a1020', sw: OW });
    eyes(p, 0, -0.11, 0.07, { color: '#ffe85a', angry: true, size: 0.95 });
    p.path(polyPath([-0.07, -0.01, 0.07, -0.01, 0.0, 0.03]), '#fff6f0', { stroke: '#5a1020', sw: 0.01 });
    mouthSmile(p, 0, -0.025, 0.07, '#3a0a14');
    fangs(p, 0, -0.02, 0.05);
  });
  const wing = record(1, 1, -0.5, -0.5, (p) => {
    const w = newPath();
    w.moveTo(0, 0);
    w.quadTo(0.14, -0.22, 0.32, -0.16);
    w.quadTo(0.26, -0.08, 0.28, 0.0);
    w.quadTo(0.14, -0.02, 0.08, 0.06);
    w.quadTo(0.04, 0.02, 0, 0.04);
    w.close();
    p.path(w, lin(0, -0.2, 0.3, 0.05, '#8a2a4a', '#3a0a24'), { stroke: '#1a0410', sw: OW });
  });
  const extra = record(1, 1, -0.5, -0.5, (p) => {
    const t = newPath();
    t.moveTo(0, 0);
    t.quadTo(-0.16, 0.0, -0.2, -0.14);
    p.stroke(t, '#5a1020', 0.04);
    p.stroke(t, '#c02a3a', 0.025);
    p.path(polyPath([-0.2, -0.14, -0.28, -0.12, -0.22, -0.22]), '#c02a3a', { stroke: '#5a1020', sw: 0.01 });
  });
  return { body, wing, wingPivot: [0.1, 0.02], extra, extraPivot: [-0.08, 0.24], float: 1, feet: 0.28, top: -0.42, radius: 0.22 };
}

function golem(): MonsterSprite {
  const body = record(1.6, 1.6, -0.8, -0.8, (p) => {
    for (const k of [-1, 1]) p.rrect(k * 0.14 - 0.08, 0.2, 0.16, 0.12, 0.04, '#5a5a66', { stroke: '#2a2a32' });
    // 몸통
    const t = newPath();
    t.moveTo(-0.26, -0.02);
    t.quadTo(0, -0.1, 0.26, -0.02);
    t.quadTo(0.34, 0.15, 0.26, 0.27);
    t.quadTo(0, 0.34, -0.26, 0.27);
    t.quadTo(-0.34, 0.15, -0.26, -0.02);
    t.close();
    p.path(t, lin(-0.3, -0.1, 0.3, 0.3, '#b8b8c8', '#8a8a9c', '#5a5a6a'), { stroke: '#2a2a32', sw: 0.022 });
    // 이끼
    p.oval(-0.12, -0.04, 0.1, 0.035, '#5aa04a', { stroke: null, alpha: 0.8 });
    p.oval(0.16, 0.22, 0.08, 0.03, '#5aa04a', { stroke: null, alpha: 0.7 });
    // 룬 균열
    const crack = newPath();
    crack.moveTo(-0.12, 0.05);
    crack.lineTo(-0.04, 0.12);
    crack.lineTo(-0.1, 0.2);
    crack.moveTo(0.12, 0.04);
    crack.lineTo(0.05, 0.14);
    crack.lineTo(0.12, 0.22);
    p.stroke(crack, '#ffb040', 0.026);
    p.stroke(crack, '#fff0a0', 0.01);
    p.glow(0, 0.14, 0.2, '#ff9a30', 0.55);
    p.path(starPath(0, 0.14, 0.05, 0.022, 4), '#fff0a0', { stroke: '#ff9a30', sw: 0.01 });
    // 머리
    p.rrect(-0.13, -0.3, 0.26, 0.24, 0.07, lin(0, -0.3, 0, -0.06, '#c8c8d8', '#8a8a9c'), { stroke: '#2a2a32', sw: 0.022 });
    for (const k of [-1, 1]) {
      p.glow(k * 0.06, -0.18, 0.1, '#ff9a30', 0.9);
      p.rrect(k * 0.06 - 0.035, -0.205, 0.07, 0.04, 0.012, '#ffd070', { stroke: '#8a3a10', sw: 0.01 });
    }
    p.rrect(-0.06, -0.12, 0.12, 0.03, 0.01, '#3a3a44', { stroke: null });
    // 팔 (주먹)
    for (const k of [-1, 1]) {
      p.circle(k * 0.36, 0.12, 0.1, rad(k * 0.34, 0.08, 0.14, '#c8c8d8', '#7a7a8c'), { stroke: '#2a2a32', sw: 0.022 });
      p.seg(k * 0.34, 0.2, k * 0.34, 0.18, '#2a2a32', 0.01);
    }
  });
  return { body, wing: null, wingPivot: [0, 0], extra: null, extraPivot: [0, 0], float: 0, feet: 0.32, top: -0.34, radius: 0.4 };
}

function dragon(): MonsterSprite {
  const body = record(1.8, 1.6, -0.9, -0.8, (p) => {
    // 꼬리
    const tail = newPath();
    tail.moveTo(-0.16, 0.08);
    tail.quadTo(-0.4, 0.2, -0.46, -0.04);
    p.stroke(tail, '#1d6a5a', 0.14);
    p.stroke(tail, '#3fc6a0', 0.1);
    p.path(polyPath([-0.46, -0.04, -0.56, -0.12, -0.5, 0.04]), '#ff6a4a', { stroke: '#5a1a10', sw: OW });
    // 등 가시
    for (let i = 0; i < 4; i++) p.path(polyPath([-0.12 + i * 0.07, -0.16, -0.09 + i * 0.07, -0.26, -0.06 + i * 0.07, -0.16]), '#ff6a4a', { stroke: '#5a1a10', sw: 0.012 });
    // 몸
    p.oval(0, 0.06, 0.26, 0.2, lin(0, -0.14, 0, 0.26, '#6af0c0', '#2fb08a', '#1d6a5a'), { stroke: '#0f3a30', sw: 0.022 });
    p.oval(0.02, 0.14, 0.17, 0.11, lin(0, 0, 0, 0.25, '#fff0b0', '#f0c860'), { stroke: '#8a6a20', sw: 0.012 });
    for (let i = 0; i < 4; i++) p.seg(-0.1, 0.07 + i * 0.045, 0.14, 0.07 + i * 0.045, '#c89a30', 0.008);
    for (const k of [-1, 1]) p.rrect(k * 0.1 - 0.04, 0.22, 0.08, 0.08, 0.03, '#1d8a6a', { stroke: '#0f3a30', sw: 0.014 });
    // 머리
    p.circle(0.2, -0.16, 0.17, rad(0.15, -0.24, 0.24, '#9affd8', '#3fc6a0', '#1d8a6a'), { stroke: '#0f3a30', sw: 0.022 });
    p.oval(0.33, -0.12, 0.1, 0.08, lin(0, -0.2, 0, -0.04, '#6af0c0', '#2fb08a'), { stroke: '#0f3a30', sw: 0.018 });
    p.circle(0.4, -0.15, 0.015, '#0f3a30', { stroke: null });
    p.glow(0.4, -0.1, 0.1, '#ffa040', 0.7);
    for (const k of [0, 1]) {
      const horn = newPath();
      horn.moveTo(0.12 + k * 0.1, -0.3);
      horn.quadTo(0.04 + k * 0.1, -0.42, -0.02 + k * 0.1, -0.4);
      horn.quadTo(0.07 + k * 0.1, -0.34, 0.16 + k * 0.1, -0.28);
      horn.close();
      p.path(horn, '#fff0b0', { stroke: '#8a6a20', sw: OW });
    }
    eyes(p, 0.22, -0.2, 0.0, { color: '#ffe85a', angry: true, size: 1.1 });
    mouthSmile(p, 0.33, -0.08, 0.05, '#3a0a10');
    fangs(p, 0.33, -0.078, 0.03);
  });
  const wing = record(1.4, 1.4, -0.7, -0.7, (p) => {
    const w = newPath();
    w.moveTo(0, 0);
    w.quadTo(0.1, -0.4, 0.5, -0.46);
    w.quadTo(0.4, -0.28, 0.5, -0.18);
    w.quadTo(0.36, -0.14, 0.38, 0.0);
    w.quadTo(0.22, -0.02, 0.18, 0.1);
    w.quadTo(0.1, 0.04, 0, 0.1);
    w.close();
    p.path(w, lin(0, -0.4, 0.5, 0.1, '#ff9a6a', '#c0402a'), { stroke: '#4a1408', sw: 0.022 });
    p.seg(0, 0, 0.5, -0.44, '#4a1408', 0.016);
    p.seg(0.02, 0.02, 0.38, -0.08, '#4a1408', 0.012);
  });
  return { body, wing, wingPivot: [-0.02, -0.08], extra: null, extraPivot: [0, 0], float: 1, feet: 0.3, top: -0.46, radius: 0.4 };
}

function lich(): MonsterSprite {
  const body = record(1.6, 1.8, -0.8, -0.9, (p) => {
    p.glow(0, 0, 0.6, '#7affb0', 0.35);
    // 로브
    const r = newPath();
    r.moveTo(-0.14, -0.02);
    r.quadTo(0, -0.06, 0.14, -0.02);
    r.quadTo(0.26, 0.16, 0.32, 0.34);
    r.quadTo(0.16, 0.3, 0.1, 0.4);
    r.quadTo(0, 0.3, -0.1, 0.4);
    r.quadTo(-0.16, 0.3, -0.32, 0.34);
    r.quadTo(-0.26, 0.16, -0.14, -0.02);
    r.close();
    p.path(r, lin(0, -0.05, 0, 0.4, '#6a3aa8', '#3a1a68', '#1a0a38'), { stroke: '#0c0420', sw: 0.022 });
    p.path(polyPath([-0.04, 0.0, 0.04, 0.0, 0.0, 0.3]), '#ffd24d', { stroke: '#6a4a10', sw: 0.01, alpha: 0.9 });
    // 해골 얼굴
    p.circle(0, -0.18, 0.18, rad(-0.05, -0.26, 0.26, '#ffffff', '#e0e8d8', '#9aaa98'), { stroke: '#2a3a2a', sw: 0.022 });
    for (const k of [-1, 1]) {
      p.glow(k * 0.07, -0.18, 0.1, '#7affb0', 0.95);
      p.oval(k * 0.07, -0.18, 0.045, 0.055, '#0a2a1a', { stroke: '#04140a', sw: 0.01 });
      p.circle(k * 0.07, -0.17, 0.016, '#9affc8', { stroke: null });
    }
    p.path(polyPath([-0.015, -0.12, 0.015, -0.12, 0, -0.085]), '#2a3a2a', { stroke: null });
    for (let i = -2; i <= 2; i++) p.rrect(i * 0.03 - 0.012, -0.065, 0.024, 0.04, 0.008, '#f4f8ec', { stroke: '#4a5a4a', sw: 0.008 });
    // 왕관
    const crown = polyPath([-0.15, -0.3, -0.15, -0.46, -0.075, -0.37, 0, -0.5, 0.075, -0.37, 0.15, -0.46, 0.15, -0.3]);
    p.path(crown, lin(0, -0.5, 0, -0.3, '#fff2a8', '#c89020'), { stroke: '#6a4a10', sw: OW });
    for (const [x, c] of [
      [-0.15, '#7affb0'],
      [0, '#ff5a7a'],
      [0.15, '#7affb0'],
    ] as const) p.circle(x, x === 0 ? -0.5 : -0.46, 0.022, c, { stroke: '#2a3a2a', sw: 0.008 });
    // 손 + 불꽃
    for (const k of [-1, 1]) {
      p.glow(k * 0.3, 0.12, 0.14, '#7affb0', 0.9);
      p.circle(k * 0.3, 0.12, 0.05, '#e0f0d8', { stroke: '#2a3a2a', sw: 0.012 });
      p.path(polyPath([k * 0.3 - 0.03, 0.08, k * 0.3, -0.04, k * 0.3 + 0.03, 0.08]), '#9affc8', { stroke: '#2f8a58', sw: 0.01, alpha: 0.9 });
    }
  });
  return { body, wing: null, wingPivot: [0, 0], extra: null, extraPivot: [0, 0], float: 1, feet: 0.4, top: -0.56, radius: 0.36 };
}

function demon(): MonsterSprite {
  const body = record(1.8, 1.8, -0.9, -0.9, (p) => {
    p.glow(0, 0.1, 0.6, '#ff6a2a', 0.35);
    for (const k of [-1, 1]) p.rrect(k * 0.15 - 0.08, 0.22, 0.16, 0.12, 0.05, '#4a0a14', { stroke: '#1a0408' });
    const t = newPath();
    t.moveTo(-0.28, -0.02);
    t.quadTo(0, -0.1, 0.28, -0.02);
    t.quadTo(0.34, 0.16, 0.24, 0.3);
    t.quadTo(0, 0.37, -0.24, 0.3);
    t.quadTo(-0.34, 0.16, -0.28, -0.02);
    t.close();
    p.path(t, lin(0, -0.1, 0, 0.36, '#ff7a6a', '#d02a3a', '#7a0a1a'), { stroke: '#2a0408', sw: 0.022 });
    for (let i = 0; i < 3; i++) p.oval(0, 0.04 + i * 0.07, 0.12 - i * 0.015, 0.025, '#ff9a8a', { stroke: null, alpha: 0.35 });
    p.rrect(-0.28, 0.2, 0.56, 0.06, 0.02, '#3a1a1a');
    p.path(starPath(0, 0.23, 0.045, 0.02, 5), '#ffd24d', { stroke: '#6a3a10', sw: 0.008 });
    // 뿔
    for (const k of [-1, 1]) {
      const horn = newPath();
      horn.moveTo(k * 0.1, -0.3);
      horn.quadTo(k * 0.2, -0.46, k * 0.34, -0.46);
      horn.quadTo(k * 0.26, -0.34, k * 0.18, -0.2);
      horn.close();
      p.path(horn, lin(0, -0.46, 0, -0.2, '#fff0c0', '#8a6a40'), { stroke: '#3a1a10', sw: OW });
    }
    // 머리
    p.circle(0, -0.18, 0.2, rad(-0.05, -0.26, 0.28, '#ff9a8a', '#e04a4a', '#9a1a2a'), { stroke: '#2a0408', sw: 0.022 });
    for (const k of [-1, 1]) p.path(polyPath([k * 0.18, -0.2, k * 0.34, -0.14, k * 0.2, -0.08]), '#e04a4a', { stroke: '#2a0408', sw: OW });
    eyes(p, 0, -0.2, 0.08, { color: '#ffe040', angry: true, glow: true, size: 1.05 });
    p.path(polyPath([-0.1, -0.1, 0.1, -0.1, 0.0, -0.02]), '#fff6f0', { stroke: '#2a0408', sw: 0.012 });
    mouthSmile(p, 0, -0.095, 0.1, '#2a0408');
    fangs(p, 0, -0.092, 0.06);
    // 불꽃 머리카락
    for (let i = -2; i <= 2; i++) {
      p.path(polyPath([i * 0.06 - 0.03, -0.34, i * 0.06, -0.46 - (2 - Math.abs(i)) * 0.03, i * 0.06 + 0.03, -0.34]), '#ffb040', { stroke: '#c02a10', sw: 0.01, alpha: 0.9 });
    }
    // 주먹
    for (const k of [-1, 1]) p.circle(k * 0.38, 0.14, 0.1, rad(k * 0.36, 0.1, 0.14, '#ff9a8a', '#c02a3a'), { stroke: '#2a0408', sw: 0.022 });
  });
  const wing = record(1.6, 1.6, -0.8, -0.8, (p) => {
    const w = newPath();
    w.moveTo(0, 0);
    w.quadTo(0.12, -0.48, 0.58, -0.5);
    w.quadTo(0.46, -0.34, 0.54, -0.22);
    w.quadTo(0.4, -0.2, 0.42, -0.06);
    w.quadTo(0.26, -0.08, 0.2, 0.06);
    w.quadTo(0.1, 0.0, 0, 0.1);
    w.close();
    p.path(w, lin(0, -0.5, 0.5, 0.1, '#7a1a3a', '#2a0418'), { stroke: '#10020a', sw: 0.022 });
    p.seg(0, 0, 0.58, -0.48, '#10020a', 0.018);
    p.seg(0.02, 0.0, 0.42, -0.1, '#10020a', 0.012);
  });
  return { body, wing, wingPivot: [0.14, 0.0], extra: null, extraPivot: [0, 0], float: 0, feet: 0.34, top: -0.5, radius: 0.4 };
}

function abyss(): MonsterSprite {
  const body = record(1.9, 1.9, -0.95, -0.95, (p) => {
    p.glow(0, 0, 0.8, '#a050ff', 0.5);
    // 촉수
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * (0.15 + (i * 0.7) / 5);
      const x0 = Math.cos(a) * 0.22;
      const y0 = Math.sin(a) * 0.2 + 0.08;
      const t = newPath();
      t.moveTo(x0, y0);
      t.quadTo(Math.cos(a) * 0.42 + (i % 2 ? 0.08 : -0.08), y0 + 0.14, Math.cos(a) * 0.5, y0 + 0.3);
      p.stroke(t, '#1a0a38', 0.09);
      p.stroke(t, '#5a2aa0', 0.06);
      p.circle(Math.cos(a) * 0.5, y0 + 0.3, 0.03, '#d0a0ff', { stroke: null });
    }
    p.circle(0, 0, 0.3, rad(-0.1, -0.12, 0.42, '#b070ff', '#6a2ac0', '#2a0a58'), { stroke: '#10042a', sw: 0.026 });
    // 거대한 눈
    p.oval(0, -0.02, 0.2, 0.15, lin(0, -0.17, 0, 0.13, '#ffffff', '#e0d0ff'), { stroke: '#10042a', sw: 0.02 });
    p.glow(0, -0.02, 0.2, '#ff4080', 0.7);
    p.circle(0, -0.02, 0.1, rad(0, -0.02, 0.1, '#ff80b0', '#ff2060', '#800030'), { stroke: '#2a0010', sw: 0.014 });
    p.oval(0, -0.02, 0.028, 0.075, '#10020a', { stroke: null });
    p.circle(0.03, -0.06, 0.018, '#ffffff', { stroke: null });
    // 핏줄
    for (const k of [-1, 1]) {
      const v = newPath();
      v.moveTo(k * 0.19, -0.02);
      v.quadTo(k * 0.14, -0.04, k * 0.11, -0.03);
      p.stroke(v, '#ff4080', 0.008, { alpha: 0.7 });
    }
    // 이마의 뿔 + 왕관 가시
    for (let i = -2; i <= 2; i++) {
      p.path(polyPath([i * 0.09 - 0.03, -0.27, i * 0.09, -0.4 + Math.abs(i) * 0.03, i * 0.09 + 0.03, -0.27]), '#d0a0ff', { stroke: '#10042a', sw: 0.012 });
    }
  });
  return { body, wing: null, wingPivot: [0, 0], extra: null, extraPivot: [0, 0], float: 1, feet: 0.5, top: -0.44, radius: 0.42 };
}

const makers: Record<EnemyKind, () => MonsterSprite> = {
  slime,
  goblin,
  bat,
  mushroom,
  skeleton,
  wolf,
  orc,
  ghost,
  imp,
  golem,
  dragon,
  lich,
  demon,
  abyss,
};

const cache = new Map<EnemyKind, MonsterSprite>();

export function monsterSprite(kind: EnemyKind): MonsterSprite {
  let s = cache.get(kind);
  if (!s) {
    s = makers[kind]();
    cache.set(kind, s);
  }
  return s;
}

