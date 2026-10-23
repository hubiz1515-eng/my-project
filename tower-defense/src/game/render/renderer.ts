import { BlendMode, PaintStyle, Skia, StrokeCap, StrokeJoin, TileMode, type SkCanvas, type SkFont, type SkPaint, type SkPicture, type SkShader } from '@shopify/react-native-skia';
import { BOARD_H, BOARD_W, COLS, ENEMY_LIMIT, ENEMY_WARN, MAX_STACK, ROWS, SLOT_COUNT } from '../engine/config';
import { ENEMIES, type EnemyKind } from '../engine/enemies';
import type { Game } from '../engine/game';
import { slotCenter } from '../engine/layout';
import { pointAt } from '../engine/path';
import type { Enemy, Unit } from '../engine/types';
import { GRADES, UNITS } from '../engine/units';
import { bakeBackdrop, bakeBoard } from './board';
import { Fx, fmtNum } from './fx';
import { col } from './palette';
import { drawProjectile, SHOT_COLOR } from './projectiles';
import { monsterSprite } from './monsters';
import { unitSprite } from './units';

// ───────────────────────────── 레이아웃 ─────────────────────────────

export interface Layout {
  w: number;
  h: number;
  /** 한 칸의 픽셀 크기 */
  cell: number;
  /** 보드 원점(픽셀) */
  ox: number;
  oy: number;
}

export function computeLayout(w: number, h: number): Layout {
  // 판 둘레 테두리(0.45칸)까지 화면에 들어오도록
  const cell = Math.max(10, Math.min(w / (BOARD_W + 0.95), h / (BOARD_H + 0.95)));
  return { w, h, cell, ox: (w - BOARD_W * cell) / 2, oy: (h - BOARD_H * cell) / 2 };
}

/** 화면 픽셀 → 보드 칸 좌표 */
export function toBoard(l: Layout, px: number, py: number): { x: number; y: number } {
  return { x: (px - l.ox) / l.cell, y: (py - l.oy) / l.cell };
}

/** 화면 픽셀 → 슬롯 인덱스 (없으면 -1). 패드 사이 틈도 가까운 슬롯으로 잡아준다. */
export function slotAt(l: Layout, px: number, py: number): number {
  const b = toBoard(l, px, py);
  const cx = b.x - 1;
  const cy = b.y - 1;
  if (cx < -0.08 || cy < -0.08 || cx >= COLS + 0.08 || cy >= ROWS + 0.08) return -1;
  const c = Math.min(COLS - 1, Math.max(0, Math.floor(cx)));
  const r = Math.min(ROWS - 1, Math.max(0, Math.floor(cy)));
  return r * COLS + c;
}

export interface RenderView {
  layout: Layout;
  selected: number;
  /** 드래그 중인 슬롯과 손가락 위치(픽셀) */
  drag: { from: number; x: number; y: number } | null;
  hover: number;
  /** 깜빡이며 강조할 슬롯 (조합 재료 등) */
  pulse: readonly number[];
  showNumbers: boolean;
  shake: boolean;
}

// ───────────────────────────── 렌더러 ─────────────────────────────

const RAD = 180 / Math.PI;
/** 몬스터 그림 크기 보정 */
const ENEMY_SCALE = 1.32;

interface Death {
  kind: EnemyKind;
  x: number;
  y: number;
  size: number;
  face: number;
  t0: number;
  boss: boolean;
}

interface Item {
  y: number;
  kind: 0 | 1;
  unit?: Unit;
  slot: number;
  index: number;
  count: number;
  enemy?: Enemy;
}

const ease = {
  outBack: (x: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  },
  out: (x: number) => 1 - (1 - x) * (1 - x),
};

export class Renderer {
  readonly fx: Fx;
  /** 렌더 시계 (일시정지 중에도 흐르는 것은 없음: 시뮬레이션과 같이 간다) */
  t = 0;

  private board: SkPicture;
  private backdrops = new Map<string, SkPicture>();
  private vignette = new Map<string, SkShader>();
  private paint = Skia.Paint();
  private line = Skia.Paint();
  private flashPaint = Skia.Paint();
  private alphaPaint = Skia.Paint();
  private faces = new Map<number, number>();
  private lastText = new Map<number, number>();
  private deaths: Death[] = [];
  private items: Item[] = [];
  private flies: { x: number; y: number; ph: number; sp: number }[] = [];
  private slotFlash: { t0: number; color: string }[] = Array.from({ length: SLOT_COUNT }, () => ({ t0: -10, color: '#ffffff' }));
  private warn = false;
  private emit = 0;

  constructor(
    readonly game: Game,
    private font: SkFont | null,
  ) {
    this.fx = new Fx(font);
    this.board = bakeBoard();
    this.paint.setAntiAlias(true);
    this.line.setAntiAlias(true);
    this.line.setStyle(PaintStyle.Stroke);
    this.line.setStrokeCap(StrokeCap.Round);
    this.line.setStrokeJoin(StrokeJoin.Round);
    this.flashPaint.setColorFilter(Skia.ColorFilter.MakeBlend(col('#ffffff'), BlendMode.SrcIn));
    this.flashPaint.setAlphaf(0.7);
    for (let i = 0; i < 18; i++) this.flies.push({ x: Math.random() * (BOARD_W + 2) - 1, y: Math.random() * (BOARD_H + 2) - 1, ph: Math.random() * 6, sp: 0.15 + Math.random() * 0.2 });
    // 첫 소환 전에도 유닛이 풀어지는 모습을 보여주기 위해 이벤트는 비워 둔다
  }

  // ───────────────────────────── 프레임 ─────────────────────────────

  frame(dt: number, view: RenderView): SkPicture {
    const g = this.game;
    const L = view.layout;
    this.t += dt;
    this.consume(view);
    this.fx.update(dt);
    this.updateAmbient(dt);
    this.statusFx(dt);

    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, L.w, L.h));

    c.drawPicture(this.backdropFor(L.w, L.h));

    const sh = view.shake ? this.fx.shake : 0;
    c.save();
    c.translate(L.ox + (Math.random() - 0.5) * sh * L.cell * 0.5, L.oy + (Math.random() - 0.5) * sh * L.cell * 0.5);
    c.scale(L.cell, L.cell);

    c.drawPicture(this.board);
    this.drawCornerGlow(c);
    this.drawPortal(c);
    this.drawSlotMarks(c, view);
    this.drawActors(c, view);
    this.drawProjectiles(c);
    this.drawBars(c);
    this.fx.draw(c);
    this.drawFlies(c);
    this.drawDrag(c, view);
    if (view.showNumbers === false) this.fx.texts.length = 0;
    c.restore();

    this.drawOverlays(c, L);
    return rec.finishRecordingAsPicture();
  }

  private backdropFor(w: number, h: number): SkPicture {
    const key = `${Math.round(w)}x${Math.round(h)}`;
    let b = this.backdrops.get(key);
    if (!b) {
      if (this.backdrops.size > 4) this.backdrops.clear();
      b = bakeBackdrop(w, h);
      this.backdrops.set(key, b);
    }
    return b;
  }

  // ───────────────────────────── 이벤트 → 이펙트 ─────────────────────────────

  private consume(view: RenderView) {
    const g = this.game;
    const fx = this.fx;
    const evs = g.events;
    for (let i = 0; i < evs.length; i++) {
      const ev = evs[i];
      switch (ev.t) {
        case 'summon': {
          const { x, y } = slotCenter(ev.slot);
          const gi = GRADES[ev.grade];
          this.slotFlash[ev.slot] = { t0: this.t, color: gi.color };
          fx.ringAt(x, y + 0.1, gi.color, 0.1, 0.65 + ev.grade * 0.05, 0.45, 0.06);
          fx.add({ kind: 'glow', x, y, max: 0.5, s0: 0.2, s1: 0.8 + ev.grade * 0.1, color: gi.glow, alpha: 0.8 });
          fx.burst(x, y, gi.glow, 8 + ev.grade * 4, 1.6 + ev.grade * 0.3, 0.05);
          for (let k = 0; k < ev.grade * 2; k++) {
            const a = Math.random() * Math.PI * 2;
            fx.add({ kind: 'star', x: x + Math.cos(a) * 0.3, y: y + Math.sin(a) * 0.3, vy: -0.6 - Math.random() * 0.6, max: 0.7, s0: 0.06 + Math.random() * 0.04, s1: 0, color: gi.glow, rot: Math.random() * 3, vr: 4 });
          }
          if (ev.grade >= 3) fx.flash(gi.glow, 0.18 + ev.grade * 0.05);
          if (ev.grade >= 4) fx.kick(0.12 + ev.grade * 0.03);
          if (ev.forced || ev.grade >= 4) fx.text(x, y - 0.5, ev.grade >= 4 ? `${gi.name}!` : '행운!', gi.color, 0.26, true, 1.0);
          break;
        }
        case 'merge': {
          const { x, y } = slotCenter(ev.slot);
          const gi = GRADES[UNITS[ev.to].grade];
          this.slotFlash[ev.slot] = { t0: this.t, color: gi.color };
          fx.ringAt(x, y, gi.color, 0.9, 0.1, 0.35, 0.07);
          fx.ringAt(x, y, '#ffffff', 0.1, 0.9, 0.5, 0.05);
          fx.add({ kind: 'glow', x, y, max: 0.55, s0: 0.3, s1: 1.1, color: gi.glow, alpha: 0.9 });
          fx.burst(x, y, gi.glow, 18, 2.4, 0.06);
          fx.text(x, y - 0.5, ev.jackpot ? '대박!' : '합성!', ev.jackpot ? '#ffd24d' : '#ffffff', 0.27, true, 1.1);
          if (ev.jackpot) {
            fx.confetti(x, y, 36);
            fx.flash('#ffe27a', 0.45);
            fx.kick(0.22);
          } else if (UNITS[ev.to].grade >= 3) {
            fx.flash(gi.glow, 0.2);
          }
          break;
        }
        case 'craft': {
          const { x, y } = slotCenter(ev.slot);
          const gi = GRADES[UNITS[ev.id].grade];
          this.slotFlash[ev.slot] = { t0: this.t, color: gi.color };
          for (let k = 0; k < 3; k++) fx.ringAt(x, y, k === 1 ? '#ffffff' : gi.color, 0.1 + k * 0.1, 1.4 + k * 0.4, 0.55 + k * 0.1, 0.07);
          fx.add({ kind: 'glow', x, y, max: 0.8, s0: 0.5, s1: 2.2, color: gi.glow, alpha: 1 });
          fx.burst(x, y, gi.glow, 30, 3.4, 0.07);
          fx.confetti(x, y, 28);
          fx.flash(gi.glow, 0.6);
          fx.kick(0.3);
          fx.text(x, y - 0.55, `${gi.name} 조합!`, gi.color, 0.3, true, 1.4);
          break;
        }
        case 'move': {
          for (const s of [ev.from, ev.to]) {
            const { x, y } = slotCenter(s);
            fx.add({ kind: 'puff', x, y: y + 0.25, vy: -0.2, max: 0.4, s0: 0.12, s1: 0.3, color: '#e8f0ff', alpha: 0.5 });
          }
          break;
        }
        case 'sell': {
          const { x, y } = slotCenter(ev.slot);
          fx.coins(x, y, Math.min(10, 2 + ev.gold / 8));
          fx.text(x, y - 0.35, `+${fmtNum(ev.gold)}`, '#ffd24d', 0.22);
          break;
        }
        case 'shoot': {
          break;
        }
        case 'hit': {
          const color = ev.shot ? SHOT_COLOR[ev.shot] : '#ffffff';
          fx.burst(ev.x, ev.y, color, ev.crit ? 7 : 3, ev.crit ? 2.4 : 1.4, 0.04);
          if (ev.crit) fx.add({ kind: 'star', x: ev.x, y: ev.y - 0.05, max: 0.35, s0: 0.17, s1: 0.02, color: '#ffe27a', rot: Math.random() * 3, vr: 8 });
          if (view.showNumbers) {
            const last = this.lastText.get(ev.uid) ?? -1;
            if (ev.crit || this.t - last > 0.24) {
              this.lastText.set(ev.uid, this.t);
              fx.text(ev.x + (Math.random() - 0.5) * 0.25, ev.y - 0.3, fmtNum(ev.dmg), ev.crit ? '#ffd24d' : '#ffffff', ev.crit ? 0.2 : 0.15, ev.crit, 0.7);
            }
          }
          break;
        }
        case 'blast':
          fx.explosion(ev.x, ev.y, Math.max(0.3, ev.r), SHOT_COLOR[ev.shot]);
          if (ev.r >= 1.2) fx.kick(0.08 + ev.r * 0.04);
          break;
        case 'chain': {
          fx.bolt(ev.pts, SHOT_COLOR[ev.shot]);
          for (let k = 2; k < ev.pts.length; k += 2) fx.add({ kind: 'glow', x: ev.pts[k], y: ev.pts[k + 1], max: 0.25, s0: 0.1, s1: 0.32, color: SHOT_COLOR[ev.shot], alpha: 0.9 });
          break;
        }
        case 'kill': {
          this.lastText.delete(ev.uid);
          this.deaths.push({ kind: ev.kind, x: ev.x, y: ev.y, size: ev.size, face: this.faces.get(ev.uid) ?? 1, t0: this.t, boss: ev.boss });
          this.faces.delete(ev.uid);
          fx.add({ kind: 'puff', x: ev.x, y: ev.y, vy: -0.3, max: 0.5, s0: 0.12 * ev.size * 2, s1: 0.36 * ev.size * 2, color: '#d8d0e8', alpha: 0.6 });
          fx.burst(ev.x, ev.y, '#ffffff', 5, 1.4, 0.04);
          if (ev.boss) {
            fx.explosion(ev.x, ev.y, 1.2, '#ffb040');
            fx.coins(ev.x, ev.y, 24);
            fx.confetti(ev.x, ev.y, 30);
            fx.flash('#ffffff', 0.5);
            fx.kick(0.3);
            fx.text(ev.x, ev.y - 0.6, `+${fmtNum(ev.gold)}`, '#ffd24d', 0.3, true, 1.2);
          } else if (ev.elite) {
            fx.coins(ev.x, ev.y, 10);
            fx.ringAt(ev.x, ev.y, '#ffd24d', 0.1, 0.8, 0.5, 0.05);
            fx.text(ev.x, ev.y - 0.4, `+${fmtNum(ev.gold)}`, '#ffd24d', 0.24, true, 1.0);
          } else if (Math.random() < 0.5) {
            fx.coins(ev.x, ev.y, 1);
          }
          break;
        }
        case 'gold':
          fx.coins(ev.x, ev.y, 2);
          fx.text(ev.x, ev.y - 0.25, `+${ev.amount}`, '#ffd24d', 0.17);
          break;
        case 'freeze': {
          fx.flash('#9ad8ff', 0.5);
          for (let k = 0; k < 34; k++) {
            fx.add({ kind: 'shard', x: Math.random() * BOARD_W, y: Math.random() * BOARD_H - 0.5, vy: 0.5 + Math.random() * 0.9, max: 1.0 + Math.random() * 0.6, s0: 0.07, s1: 0.03, color: '#bff0ff', rot: Math.random() * 3, vr: 3 });
          }
          fx.text(BOARD_W / 2, BOARD_H / 2, '시간 정지!', '#9ad8ff', 0.45, true, 1.3);
          break;
        }
        case 'power':
          fx.flash('#ffd86a', 0.4);
          fx.text(BOARD_W / 2, BOARD_H / 2, '공격력 UP!', '#ffd24d', 0.42, true, 1.3);
          break;
        case 'bomb':
          fx.flash('#ffb060', 0.65);
          fx.kick(0.35);
          for (const e of g.enemies) fx.explosion(e.x, e.y, 0.5, '#ff8a30');
          break;
        case 'upgrade':
        case 'luck':
          fx.flash('#fff2a8', 0.14);
          break;
        case 'warn':
          this.warn = ev.on;
          break;
        case 'over':
          fx.kick(0.35);
          fx.flash(ev.won ? '#ffe27a' : '#ff4d6d', 0.5);
          break;
        default:
          break;
      }
    }
    evs.length = 0;
    // 사라진 몬스터의 꼬리표 정리
    if (this.lastText.size > 300) this.lastText.clear();
    if (this.faces.size > 300) {
      const live = new Set(g.enemies.map((e) => e.uid));
      for (const k of this.faces.keys()) if (!live.has(k)) this.faces.delete(k);
    }
  }

  /** 상태이상/조준 등 매 프레임 이어지는 연출 */
  private statusFx(dt: number) {
    const g = this.game;
    const fx = this.fx;
    this.emit += dt;
    const tick = this.emit > 0.16;
    if (tick) this.emit = 0;
    for (const p of g.projectiles) {
      if (p.shot === 'meteor' || p.shot === 'snipe') continue;
      if (Math.random() < dt * 28) fx.add({ kind: 'glow', x: p.x, y: p.y, max: 0.28, s0: 0.07, s1: 0.0, color: SHOT_COLOR[p.shot], alpha: 0.7 });
    }
    if (!tick) return;
    const T = g.time;
    for (const e of g.enemies) {
      if (T < e.freezeUntil) continue;
      if (T < e.slowUntil && e.slow > 0 && Math.random() < 0.6) {
        fx.add({ kind: 'shard', x: e.x + (Math.random() - 0.5) * 0.3, y: e.y + 0.1, vy: -0.4, max: 0.6, s0: 0.04, s1: 0.01, color: '#bff0ff', rot: Math.random() * 3, vr: 2 });
      }
      if (T < e.poisonUntil && Math.random() < 0.7) {
        fx.add({ kind: 'ember', x: e.x + (Math.random() - 0.5) * 0.3, y: e.y, vy: -0.5, max: 0.7, s0: 0.05, s1: 0.02, color: '#9aff6a', alpha: 0.9 });
      }
    }
    // 고등급 유닛의 오라 입자
    for (let s = 0; s < SLOT_COUNT; s++) {
      const us = g.slots[s].units;
      if (us.length === 0) continue;
      const grade = UNITS[us[0].id].grade;
      if (grade < 4 || Math.random() > 0.35) continue;
      const c = slotCenter(s);
      const gi = GRADES[grade];
      fx.add({ kind: 'ember', x: c.x + (Math.random() - 0.5) * 0.7, y: c.y + 0.2, vy: -0.45 - Math.random() * 0.3, max: 0.9, s0: 0.05, s1: 0.0, color: gi.glow, alpha: 0.8 });
    }
  }

  private updateAmbient(dt: number) {
    for (const f of this.flies) {
      f.ph += dt * f.sp * 2;
      f.x += Math.cos(f.ph * 1.3) * dt * 0.12;
      f.y += Math.sin(f.ph) * dt * 0.1;
      if (f.x < -1.2) f.x = BOARD_W + 1.2;
      if (f.x > BOARD_W + 1.2) f.x = -1.2;
      if (f.y < -1.2) f.y = BOARD_H + 1.2;
      if (f.y > BOARD_H + 1.2) f.y = -1.2;
    }
  }

  // ───────────────────────────── 그리기 ─────────────────────────────

  private drawCornerGlow(c: SkCanvas) {
    const p = this.paint;
    const t = this.t;
    for (const [x, y, k] of [
      [-0.02, -0.16, 0],
      [BOARD_W + 0.02, -0.16, 1],
      [-0.02, BOARD_H - 0.16, 2],
      [BOARD_W + 0.02, BOARD_H - 0.16, 3],
    ] as const) {
      const a = 0.45 + 0.2 * Math.sin(t * 2.4 + k);
      p.reset();
      p.setAntiAlias(true);
      p.setBlendMode(BlendMode.Plus);
      p.setShader(Skia.Shader.MakeRadialGradient({ x, y }, 0.5, [col('#7be0ff', 1), col('#7be0ff', 0)], null, TileMode.Clamp));
      p.setAlphaf(a);
      c.drawCircle(x, y, 0.5, p);
    }
  }

  private drawPortal(c: SkCanvas) {
    const pt = pointAt(0);
    const t = this.t;
    const p = this.paint;
    const x = pt.x;
    const y = pt.y;
    p.reset();
    p.setAntiAlias(true);
    p.setBlendMode(BlendMode.Plus);
    p.setShader(Skia.Shader.MakeRadialGradient({ x, y }, 0.7, [col('#b070ff', 1), col('#b070ff', 0)], null, TileMode.Clamp));
    p.setAlphaf(0.55 + 0.15 * Math.sin(t * 3));
    c.drawCircle(x, y, 0.7, p);
    const l = this.line;
    for (let i = 0; i < 3; i++) {
      l.reset();
      l.setAntiAlias(true);
      l.setStyle(PaintStyle.Stroke);
      l.setStrokeCap(StrokeCap.Round);
      l.setStrokeWidth(0.045);
      l.setColor(col(i === 1 ? '#ffffff' : '#c890ff'));
      l.setAlphaf(0.75);
      l.setBlendMode(BlendMode.Plus);
      const r = 0.2 + i * 0.1;
      const start = (t * (140 + i * 60) * (i % 2 ? -1 : 1)) % 360;
      c.drawArc(Skia.XYWHRect(x - r, y - r * 0.9, r * 2, r * 1.8), start, 200 - i * 40, false, l);
    }
    p.reset();
    p.setAntiAlias(true);
    p.setColor(col('#1a0a30'));
    p.setAlphaf(0.85);
    c.drawOval(Skia.XYWHRect(x - 0.14, y - 0.12, 0.28, 0.24), p);
  }

  private drawSlotMarks(c: SkCanvas, view: RenderView) {
    const g = this.game;
    const t = this.t;
    const p = this.paint;
    const l = this.line;
    for (let s = 0; s < SLOT_COUNT; s++) {
      const x = 1 + (s % COLS);
      const y = 1 + Math.floor(s / COLS);
      const rr = (inset: number) => ({ rect: Skia.XYWHRect(x + inset, y + inset, 1 - inset * 2, 1 - inset * 2), rx: 0.15, ry: 0.15 });
      // 소환/합성 직후 번쩍
      const sf = this.slotFlash[s];
      const fa = 1 - (this.t - sf.t0) / 0.6;
      if (fa > 0) {
        p.reset();
        p.setAntiAlias(true);
        p.setColor(col(sf.color));
        p.setAlphaf(fa * 0.55);
        p.setBlendMode(BlendMode.Plus);
        c.drawRRect(rr(0.04), p);
      }
      const units = g.slots[s].units;
      // 합성 가능: 황금빛 맥박 + 화살표 배지
      if (units.length === MAX_STACK && g.canMerge(s)) {
        const k = 0.5 + 0.5 * Math.sin(t * 5);
        p.reset();
        p.setAntiAlias(true);
        p.setColor(col('#ffd24d'));
        p.setAlphaf(0.18 + 0.18 * k);
        p.setBlendMode(BlendMode.Plus);
        c.drawRRect(rr(0.04), p);
        const bx = x + 0.82;
        const by = y + 0.2 - Math.abs(Math.sin(t * 4)) * 0.04;
        p.reset();
        p.setAntiAlias(true);
        p.setColor(col('#ffd24d'));
        c.drawCircle(bx, by, 0.12, p);
        l.reset();
        l.setAntiAlias(true);
        l.setStyle(PaintStyle.Stroke);
        l.setStrokeCap(StrokeCap.Round);
        l.setStrokeJoin(StrokeJoin.Round);
        l.setStrokeWidth(0.03);
        l.setColor(col('#8a5a10'));
        c.drawCircle(bx, by, 0.12, l);
        l.setColor(col('#ffffff'));
        l.setStrokeWidth(0.034);
        const ar = Skia.PathBuilder.Make().moveTo(bx - 0.055, by + 0.02).lineTo(bx, by - 0.035).lineTo(bx + 0.055, by + 0.02).moveTo(bx - 0.055, by + 0.07).lineTo(bx, by + 0.015).lineTo(bx + 0.055, by + 0.07).build();
        c.drawPath(ar, l);
      }
      // 레시피 재료 강조
      if (view.pulse.includes(s)) {
        const k = 0.5 + 0.5 * Math.sin(t * 7);
        l.reset();
        l.setAntiAlias(true);
        l.setStyle(PaintStyle.Stroke);
        l.setStrokeWidth(0.05);
        l.setColor(col('#ffe27a'));
        l.setAlphaf(0.5 + 0.5 * k);
        l.setBlendMode(BlendMode.Plus);
        c.drawRRect(rr(0.05), l);
      }
      // 선택 / 드롭 대상
      if (view.selected === s || (view.drag && view.hover === s && view.drag.from !== s)) {
        const sel = view.selected === s;
        const k = 0.5 + 0.5 * Math.sin(t * 6);
        l.reset();
        l.setAntiAlias(true);
        l.setStyle(PaintStyle.Stroke);
        l.setStrokeWidth(sel ? 0.06 : 0.07);
        l.setColor(col(sel ? '#ffffff' : '#7dff9b'));
        l.setAlphaf(sel ? 0.7 + 0.3 * k : 0.95);
        l.setBlendMode(BlendMode.Plus);
        c.drawRRect(rr(0.03), l);
      }
    }
  }

  private drawActors(c: SkCanvas, view: RenderView) {
    const g = this.game;
    const items = this.items;
    items.length = 0;
    for (let s = 0; s < SLOT_COUNT; s++) {
      const units = g.slots[s].units;
      for (let i = 0; i < units.length; i++) {
        const pos = g.unitPos(s, i);
        items.push({ y: pos.y, kind: 0, unit: units[i], slot: s, index: i, count: units.length });
      }
    }
    for (const e of g.enemies) items.push({ y: e.y + 0.05, kind: 1, enemy: e, slot: -1, index: 0, count: 0 });
    items.sort((a, b) => a.y - b.y);
    const T = g.time;
    // 죽는 중인 몬스터 (가장 뒤)
    this.drawDeaths(c);
    for (const it of items) {
      if (it.kind === 0) {
        const faded = view.drag && view.drag.from === it.slot;
        this.drawUnit(c, it.unit!, it.slot, it.index, it.count, T, faded ? 0.3 : 1);
      } else {
        this.drawEnemy(c, it.enemy!, T);
      }
    }
  }

  private drawUnit(c: SkCanvas, u: Unit, slot: number, index: number, count: number, T: number, alpha: number, at?: { x: number; y: number }, lift = 0) {
    const def = UNITS[u.id];
    const spr = unitSprite(u.id);
    const gi = GRADES[def.grade];
    const base = count === 1 ? 1.3 : count === 2 ? 1.14 : 1.04;
    const sc = base * (def.look.scale ?? 1);
    const pos = at ?? this.game.unitPos(slot, index);
    const ph = u.uid * 1.7;
    const bob = Math.sin(T * 3 + ph) * 0.012;
    const since = T - u.shotAt;
    let face = this.faces.get(u.uid) ?? (index === 1 ? -1 : 1);
    if (since < 0.6 && Math.abs(Math.cos(u.aim)) > 0.25) {
      face = Math.cos(u.aim) >= 0 ? 1 : -1;
      this.faces.set(u.uid, face);
    }
    // 소환 직후 튀어나오는 연출
    const age = T - u.born;
    const pop = age < 0.35 ? ease.outBack(Math.max(0, age) / 0.35) : 1;
    // 공격 모션
    let lunge = 0;
    let swing = 0;
    let kick = 0;
    if (since >= 0 && since < 0.5) {
      const a = since / 0.28;
      if (a < 1) {
        lunge = Math.sin(a * Math.PI) * 0.07;
        kick = Math.sin(a * Math.PI);
        swing = a < 0.3 ? (-55 * a) / 0.3 : -55 + 120 * ease.out((a - 0.3) / 0.7);
      } else {
        const r = Math.min(1, (since - 0.28) / 0.22);
        swing = 65 * (1 - r);
      }
    }
    const p = this.paint;
    const needsLayer = alpha < 1;
    if (needsLayer) {
      this.alphaPaint.setAlphaf(alpha);
      c.saveLayer(this.alphaPaint);
    }
    // 그림자 + 등급 오라
    const px = pos.x;
    const py = pos.y;
    p.reset();
    p.setAntiAlias(true);
    p.setColor(col('#000000'));
    p.setAlphaf(0.28 * alpha);
    c.drawOval(Skia.XYWHRect(px - 0.17 * sc, py + 0.3 * sc - lift * 0, 0.34 * sc, 0.09 * sc), p);
    if (def.grade >= 2) {
      const k = 0.55 + 0.25 * Math.sin(T * 3 + ph);
      p.reset();
      p.setAntiAlias(true);
      p.setBlendMode(BlendMode.Plus);
      p.setShader(Skia.Shader.MakeRadialGradient({ x: px, y: py + 0.29 * sc }, 0.34 * sc, [col(gi.color, 1), col(gi.color, 0)], null, TileMode.Clamp));
      p.setAlphaf(Math.min(0.9, (0.18 + def.grade * 0.08) * k) * alpha);
      c.drawOval(Skia.XYWHRect(px - 0.34 * sc, py + 0.29 * sc - 0.12 * sc, 0.68 * sc, 0.24 * sc), p);
    }
    if (def.grade >= 5) {
      // 날개/후광 연출용 빛기둥
      p.reset();
      p.setAntiAlias(true);
      p.setBlendMode(BlendMode.Plus);
      p.setShader(Skia.Shader.MakeRadialGradient({ x: px, y: py }, 0.55 * sc, [col(gi.glow, 1), col(gi.glow, 0)], null, TileMode.Clamp));
      p.setAlphaf(0.28 * alpha);
      c.drawCircle(px, py, 0.55 * sc, p);
    }

    c.save();
    c.translate(px + Math.cos(u.aim) * lunge * face * 0 + lunge * face * 0.4, py + bob - lift);
    c.scale(face * sc * pop, sc * pop * (1 + Math.sin(T * 3 + ph) * 0.012));
    if (spr.back) c.drawPicture(spr.back);
    const flap = Math.sin(T * 7 + ph) * 12;
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
    if (spr.swing) {
      c.rotate(swing, 0, 0);
    } else {
      c.translate(-kick * 0.03, 0);
      const s = 1 + kick * 0.16;
      c.scale(s, s);
    }
    c.drawPicture(spr.weapon);
    c.restore();
    c.restore();
    if (needsLayer) c.restore();
  }

  private drawEnemy(c: SkCanvas, e: Enemy, T: number) {
    const spr = monsterSprite(e.kind);
    const def = ENEMIES[e.kind];
    const age = T - e.born;
    const spawn = age < 0.3 ? ease.outBack(Math.max(0, age) / 0.3) : 1;
    const sc = e.size * ENEMY_SCALE * spawn;
    let face = this.faces.get(e.uid) ?? 1;
    const cx = Math.cos(e.angle);
    if (cx > 0.35) face = 1;
    else if (cx < -0.35) face = -1;
    this.faces.set(e.uid, face);
    const frozen = T < e.freezeUntil;
    const stunned = T < e.stunUntil;
    const phase = e.dist * (def.boss ? 3.2 : 6.5) + e.uid;
    const walk = frozen || stunned ? 0 : Math.abs(Math.sin(phase));
    const floatY = spr.float ? -0.1 + Math.sin(T * 3 + e.uid) * 0.035 : 0;
    const hop = -walk * 0.045 * sc;
    const squash = 1 + (walk - 0.5) * 0.08;
    const p = this.paint;

    // 그림자
    p.reset();
    p.setAntiAlias(true);
    p.setColor(col('#000000'));
    p.setAlphaf(0.3);
    const sw = 0.5 * sc * (spr.float ? 0.75 : 1);
    c.drawOval(Skia.XYWHRect(e.x - sw / 2, e.y + spr.feet * sc - 0.03, sw, sw * 0.28), p);

    // 보스/엘리트 오라
    if (e.boss || e.elite) {
      const k = 0.6 + 0.3 * Math.sin(T * 4);
      const col2 = e.boss ? '#ff4d6d' : '#ffd24d';
      p.reset();
      p.setAntiAlias(true);
      p.setBlendMode(BlendMode.Plus);
      p.setShader(Skia.Shader.MakeRadialGradient({ x: e.x, y: e.y + 0.1 }, 0.7 * sc, [col(col2, 1), col(col2, 0)], null, TileMode.Clamp));
      p.setAlphaf(0.45 * k);
      c.drawCircle(e.x, e.y + 0.1, 0.7 * sc, p);
    }

    c.save();
    c.translate(e.x, e.y + floatY + hop);
    c.scale(face * sc, sc * squash);
    if (spr.extra) {
      c.save();
      c.translate(spr.extraPivot[0], spr.extraPivot[1]);
      c.rotate(Math.sin(phase * 2) * 18 - 8, 0, 0);
      c.drawPicture(spr.extra);
      c.restore();
    }
    if (spr.wing) {
      const flap = Math.sin(T * (e.kind === 'bat' ? 16 : 8) + e.uid) * 22;
      for (const sx of [-1, 1]) {
        c.save();
        c.translate(spr.wingPivot[0] * sx, spr.wingPivot[1]);
        c.scale(sx, 1);
        c.rotate(-flap - 10, 0, 0);
        c.drawPicture(spr.wing);
        c.restore();
      }
    }
    c.drawPicture(spr.body);
    // 피격 번쩍
    if (T - e.hitAt < 0.09) {
      c.saveLayer(this.flashPaint);
      c.drawPicture(spr.body);
      c.restore();
    }
    c.restore();

    // 상태이상 표시
    if (frozen) {
      const r = spr.radius * sc * 1.15;
      p.reset();
      p.setAntiAlias(true);
      p.setColor(col('#bff0ff'));
      p.setAlphaf(0.55);
      c.drawRRect({ rect: Skia.XYWHRect(e.x - r, e.y + floatY - r * 1.1, r * 2, r * 2.3), rx: r * 0.35, ry: r * 0.35 }, p);
      const l = this.line;
      l.reset();
      l.setAntiAlias(true);
      l.setStyle(PaintStyle.Stroke);
      l.setStrokeWidth(0.03);
      l.setColor(col('#ffffff'));
      l.setAlphaf(0.85);
      c.drawRRect({ rect: Skia.XYWHRect(e.x - r, e.y + floatY - r * 1.1, r * 2, r * 2.3), rx: r * 0.35, ry: r * 0.35 }, l);
      l.setStrokeWidth(0.02);
      l.setAlphaf(0.7);
      c.drawLine(e.x - r * 0.6, e.y + floatY - r * 0.7, e.x - r * 0.2, e.y + floatY - r * 0.95, l);
    } else if (stunned) {
      for (let i = 0; i < 3; i++) {
        const a = T * 6 + (i * Math.PI * 2) / 3;
        const sx = e.x + Math.cos(a) * 0.17 * sc;
        const sy = e.y + floatY + spr.top * sc - 0.02 + Math.sin(a) * 0.05;
        p.reset();
        p.setAntiAlias(true);
        p.setColor(col('#ffe85a'));
        c.drawCircle(sx, sy, 0.035, p);
        p.setColor(col('#ffffff'));
        p.setAlphaf(0.8);
        c.drawCircle(sx - 0.01, sy - 0.01, 0.012, p);
      }
    }
  }

  private drawDeaths(c: SkCanvas) {
    const list = this.deaths;
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      const k = (this.t - d.t0) / 0.38;
      if (k >= 1) continue;
      list[w++] = d;
      const spr = monsterSprite(d.kind);
      const sc = d.size * ENEMY_SCALE * (1 + k * 0.25);
      this.alphaPaint.setAlphaf(1 - k);
      c.saveLayer(this.alphaPaint);
      c.save();
      c.translate(d.x, d.y - k * 0.15);
      c.scale(d.face * sc * (1 + k * 0.2), sc * (1 - k * 0.5));
      c.drawPicture(spr.body);
      c.restore();
      c.restore();
    }
    list.length = w;
  }

  private drawProjectiles(c: SkCanvas) {
    const g = this.game;
    for (const p of g.projectiles) drawProjectile(c, p, this.t, this.paint);
  }

  private drawBars(c: SkCanvas) {
    const g = this.game;
    const p = this.paint;
    for (const e of g.enemies) {
      const big = e.boss || e.elite;
      if (e.hp >= e.maxHp && !big) continue;
      const spr = monsterSprite(e.kind);
      const sc = e.size * ENEMY_SCALE;
      const w = big ? 0.9 : 0.46;
      const h = big ? 0.1 : 0.06;
      const x = e.x - w / 2;
      const y = e.y + spr.top * sc - (big ? 0.14 : 0.1) + (spr.float ? -0.1 : 0);
      const ratio = Math.max(0, Math.min(1, e.hp / e.maxHp));
      p.reset();
      p.setAntiAlias(true);
      p.setColor(col('#10122a'));
      p.setAlphaf(0.85);
      c.drawRRect({ rect: Skia.XYWHRect(x - 0.02, y - 0.02, w + 0.04, h + 0.04), rx: (h + 0.04) / 2, ry: (h + 0.04) / 2 }, p);
      p.reset();
      p.setAntiAlias(true);
      p.setShader(Skia.Shader.MakeLinearGradient({ x, y }, { x, y: y + h }, [col(ratio > 0.5 ? '#9aff7a' : ratio > 0.25 ? '#ffd24d' : '#ff6a6a'), col(ratio > 0.5 ? '#3fbf4a' : ratio > 0.25 ? '#e09a20' : '#c0303a')], null, TileMode.Clamp));
      c.drawRRect({ rect: Skia.XYWHRect(x, y, Math.max(h, w * ratio), h), rx: h / 2, ry: h / 2 }, p);
      if (big) {
        const l = this.line;
        l.reset();
        l.setAntiAlias(true);
        l.setStyle(PaintStyle.Stroke);
        l.setStrokeWidth(0.016);
        l.setColor(col(e.boss ? '#ffd24d' : '#ffffff'));
        c.drawRRect({ rect: Skia.XYWHRect(x - 0.02, y - 0.02, w + 0.04, h + 0.04), rx: (h + 0.04) / 2, ry: (h + 0.04) / 2 }, l);
      }
    }
  }

  private drawFlies(c: SkCanvas) {
    const p = this.paint;
    for (const f of this.flies) {
      const a = 0.35 + 0.35 * Math.sin(f.ph * 3);
      p.reset();
      p.setAntiAlias(true);
      p.setBlendMode(BlendMode.Plus);
      p.setShader(Skia.Shader.MakeRadialGradient({ x: f.x, y: f.y }, 0.1, [col('#e8ff9a', 1), col('#e8ff9a', 0)], null, TileMode.Clamp));
      p.setAlphaf(a);
      c.drawCircle(f.x, f.y, 0.1, p);
    }
  }

  private drawDrag(c: SkCanvas, view: RenderView) {
    const d = view.drag;
    if (!d) return;
    const units = this.game.slots[d.from].units;
    if (units.length === 0) return;
    const b = toBoard(view.layout, d.x, d.y);
    const T = this.game.time;
    // 손가락 위에 들어 올린 모습
    const n = units.length;
    for (let i = 0; i < n; i++) {
      const offs = [
        [[0, 0]],
        [
          [-0.2, 0],
          [0.2, 0],
        ],
        [
          [-0.24, 0.06],
          [0.24, 0.06],
          [0, -0.16],
        ],
      ][n - 1][i];
      this.drawUnit(c, units[i], d.from, i, n, T, 1, { x: b.x + offs[0], y: b.y - 0.45 + offs[1] }, 0.0);
    }
  }

  private drawOverlays(c: SkCanvas, L: Layout) {
    const g = this.game;
    const p = this.paint;
    const danger = Math.max(0, Math.min(1, (g.fieldWeight - ENEMY_WARN) / (ENEMY_LIMIT - ENEMY_WARN)));
    if (danger > 0 || this.warn) {
      const key = `${Math.round(L.w)}x${Math.round(L.h)}`;
      let sh = this.vignette.get(key);
      if (!sh) {
        sh = Skia.Shader.MakeRadialGradient({ x: L.w / 2, y: L.h / 2 }, Math.hypot(L.w, L.h) * 0.55, [col('#ff2040', 0), col('#ff2040', 0), col('#ff2040', 1)], [0, 0.5, 1], TileMode.Clamp);
        this.vignette.set(key, sh);
      }
      p.reset();
      p.setShader(sh);
      p.setAlphaf((0.25 + danger * 0.55) * (0.6 + 0.4 * Math.sin(this.t * (5 + danger * 5))));
      c.drawRect(Skia.XYWHRect(0, 0, L.w, L.h), p);
    }
    if (this.fx.flashAlpha > 0.01) {
      p.reset();
      p.setColor(col(this.fx.flashColor));
      p.setAlphaf(Math.min(1, this.fx.flashAlpha));
      c.drawRect(Skia.XYWHRect(0, 0, L.w, L.h), p);
    }
  }
}
