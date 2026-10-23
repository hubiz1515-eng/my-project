import { Skia, type SkCanvas, type SkPicture } from '@shopify/react-native-skia';
import { UNITS, type HatKind, type UnitId, type UnitLook, type WeaponKind } from '../engine/units';
import { lin, newPath, Pen, polyPath, rad, record, starPath } from './draw';
import { mix, shade } from './palette';

/** 스프라이트 좌표계: 원점 = 몸통 중심, 1 = 한 칸. 발끝은 +0.31, 머리 꼭대기는 약 -0.33 */
export interface UnitSprite {
  /** 망토 등 (몸 뒤) */
  back: SkPicture | null;
  /** 날개 (어깨 기준 좌/우, 펄럭임용) */
  wingL: SkPicture | null;
  wingR: SkPicture | null;
  body: SkPicture;
  /** 손잡이가 원점인 무기 + 오른손 */
  weapon: SkPicture;
  /** 오른손(무기 잡는 곳) 위치 */
  grip: readonly [number, number];
  /** true 면 휘두르기, false 면 반동(원거리) */
  swing: boolean;
  /** 무기 끝(발사 위치), grip 기준 */
  tip: readonly [number, number];
  /** 머리 위 장식 높이(아우라 파티클 기준) */
  top: number;
}

const HEAD_Y = -0.13;
const HEAD_R = 0.185;
const OW = 0.016;

const ROBE_HATS: HatKind[] = ['wizard', 'witch', 'mitre'];
const MELEE: WeaponKind[] = ['sword', 'greatsword', 'twinblade', 'dagger', 'lance', 'scythe', 'shield'];

function silver(): [string, string] {
  return ['#f2f6ff', '#9aa6c0'];
}

// ───────────────────────────── 무기 ─────────────────────────────

function drawWeapon(p: Pen, w: WeaponKind, look: UnitLook) {
  const [s0, s1] = silver();
  const accent = look.trim;
  switch (w) {
    case 'sword':
    case 'shield': {
      const blade = newPath();
      blade.moveTo(-0.03, -0.05);
      blade.lineTo(-0.024, -0.38);
      blade.quadTo(0, -0.47, 0.024, -0.38);
      blade.lineTo(0.03, -0.05);
      blade.close();
      p.path(blade, lin(-0.03, 0, 0.03, 0, s0, s1), { stroke: '#56627c', sw: OW });
      p.seg(0, -0.07, 0, -0.38, '#ffffff', 0.008, 0.7);
      p.rrect(-0.09, -0.07, 0.18, 0.04, 0.015, '#e8b84a');
      p.rrect(-0.018, -0.03, 0.036, 0.1, 0.012, '#7a4a2a');
      p.circle(0, 0.08, 0.025, '#e8b84a');
      break;
    }
    case 'greatsword': {
      p.glow(0, -0.3, 0.3, accent, 0.5);
      const blade = newPath();
      blade.moveTo(-0.055, -0.06);
      blade.lineTo(-0.045, -0.5);
      blade.quadTo(0, -0.66, 0.045, -0.5);
      blade.lineTo(0.055, -0.06);
      blade.close();
      p.path(blade, lin(-0.05, 0, 0.05, 0, '#ffffff', mix(accent, '#8890a8', 0.5)), { stroke: shade(accent, -0.6), sw: OW });
      p.seg(0, -0.1, 0, -0.52, accent, 0.012, 0.8);
      p.rrect(-0.13, -0.08, 0.26, 0.05, 0.02, '#d9a43a');
      p.rrect(-0.02, -0.04, 0.04, 0.13, 0.012, '#5a2f1f');
      p.circle(0, 0.11, 0.03, '#d9a43a');
      break;
    }
    case 'twinblade': {
      for (const a of [-0.38, 0.38]) {
        p.c.save();
        p.c.rotate((a * 180) / Math.PI, 0, 0);
        const blade = newPath();
        blade.moveTo(-0.025, -0.04);
        blade.lineTo(-0.02, -0.3);
        blade.quadTo(0, -0.38, 0.02, -0.3);
        blade.lineTo(0.025, -0.04);
        blade.close();
        p.path(blade, lin(-0.03, 0, 0.03, 0, '#e8dcff', '#8a64e8'), { stroke: '#2a1450', sw: OW });
        p.rrect(-0.06, -0.06, 0.12, 0.03, 0.012, '#6a3fd0');
        p.rrect(-0.014, -0.03, 0.028, 0.09, 0.01, '#241238');
        p.c.restore();
      }
      break;
    }
    case 'dagger': {
      const blade = newPath();
      blade.moveTo(-0.022, -0.03);
      blade.lineTo(-0.018, -0.22);
      blade.quadTo(0, -0.3, 0.018, -0.22);
      blade.lineTo(0.022, -0.03);
      blade.close();
      p.path(blade, lin(-0.03, 0, 0.03, 0, s0, s1), { stroke: '#4a5470', sw: OW });
      p.rrect(-0.06, -0.05, 0.12, 0.03, 0.01, '#c04058');
      p.rrect(-0.014, -0.02, 0.028, 0.08, 0.01, '#2a2030');
      break;
    }
    case 'lance': {
      p.rrect(-0.014, -0.55, 0.028, 0.7, 0.01, '#8a5a30');
      const head = newPath();
      head.moveTo(-0.045, -0.5);
      head.lineTo(0, -0.7);
      head.lineTo(0.045, -0.5);
      head.quadTo(0, -0.46, -0.045, -0.5);
      head.close();
      p.path(head, lin(-0.04, 0, 0.04, 0, s0, s1), { stroke: '#56627c', sw: OW });
      const flag = newPath();
      flag.moveTo(0.012, -0.47);
      flag.quadTo(0.1, -0.5, 0.15, -0.42);
      flag.quadTo(0.1, -0.4, 0.15, -0.34);
      flag.quadTo(0.08, -0.38, 0.012, -0.36);
      flag.close();
      p.path(flag, look.outfit);
      break;
    }
    case 'scythe': {
      p.rrect(-0.016, -0.58, 0.032, 0.78, 0.012, '#3a2418');
      const blade = newPath();
      blade.moveTo(0.0, -0.58);
      blade.quadTo(0.28, -0.7, 0.34, -0.42);
      blade.quadTo(0.22, -0.56, 0.0, -0.5);
      blade.close();
      p.glow(0.18, -0.55, 0.22, accent, 0.5);
      p.path(blade, lin(0, -0.7, 0.3, -0.45, '#ffffff', mix(accent, '#6a6a88', 0.4)), { stroke: shade(accent, -0.7), sw: OW });
      break;
    }
    case 'bow': {
      const arc = newPath();
      arc.moveTo(0.0, -0.3);
      arc.quadTo(0.24, 0, 0, 0.3);
      p.stroke(arc, '#5a3a1f', 0.058);
      p.stroke(arc, '#c08850', 0.034);
      p.seg(0, -0.3, 0, 0.3, '#ffffff', 0.008, 0.9);
      // 화살
      p.seg(-0.02, 0, 0.3, 0, '#d8c8a0', 0.014);
      const head = polyPath([0.3, -0.03, 0.38, 0, 0.3, 0.03]);
      p.path(head, '#cfd6e6', { stroke: '#4a5470', sw: 0.01 });
      break;
    }
    case 'staff': {
      p.rrect(-0.018, -0.42, 0.036, 0.62, 0.014, '#7a4a2a');
      p.rrect(-0.026, -0.05, 0.052, 0.025, 0.01, accent);
      p.glow(0, -0.5, 0.2, accent, 0.9);
      p.circle(0, -0.5, 0.07, rad(-0.02, -0.52, 0.08, '#ffffff', accent), { stroke: shade(accent, -0.6), sw: OW });
      const ring = newPath();
      ring.addCircle(0, -0.5, 0.095);
      p.stroke(ring, accent, 0.012, { alpha: 0.8 });
      break;
    }
    case 'wand': {
      p.rrect(-0.014, -0.26, 0.028, 0.42, 0.012, '#6a4a8a');
      p.glow(0, -0.3, 0.17, '#ffe8ff', 0.9);
      p.path(starPath(0, -0.3, 0.075, 0.032, 5), '#fff2a8', { stroke: '#a06a20', sw: 0.012 });
      break;
    }
    case 'bomb': {
      p.circle(0, -0.12, 0.1, rad(-0.03, -0.16, 0.14, '#6a6a80', '#14141c'), { stroke: '#0a0a10' });
      p.circle(-0.035, -0.15, 0.025, '#ffffff', { alpha: 0.5, stroke: null });
      p.rrect(-0.025, -0.25, 0.05, 0.05, 0.01, '#8a8a9a');
      const fuse = newPath();
      fuse.moveTo(0, -0.25);
      fuse.quadTo(0.05, -0.3, 0.1, -0.28);
      p.stroke(fuse, '#d8c8a0', 0.018);
      p.glow(0.1, -0.28, 0.1, '#ffb040', 0.95);
      p.circle(0.1, -0.28, 0.025, '#fff2a8', { stroke: null });
      break;
    }
    case 'cards': {
      const suits = ['#e04060', '#222233', '#e04060'];
      [-0.3, 0, 0.3].forEach((a, i) => {
        p.c.save();
        p.c.translate(0, 0.02);
        p.c.rotate((a * 180) / Math.PI, 0, 0);
        p.rrect(-0.06, -0.3, 0.12, 0.17, 0.015, '#fffdf4', { stroke: '#8a7a50', sw: 0.012 });
        p.circle(0, -0.215, 0.028, suits[i], { stroke: null });
        p.circle(-0.035, -0.27, 0.011, suits[i], { stroke: null });
        p.c.restore();
      });
      break;
    }
    case 'rifle': {
      p.c.save();
      p.c.rotate(90, 0, 0);
      p.rrect(-0.025, -0.44, 0.05, 0.54, 0.012, '#4a4e58');
      p.rrect(-0.035, -0.02, 0.07, 0.2, 0.02, '#7a4a2a');
      p.rrect(-0.04, -0.36, 0.08, 0.05, 0.012, '#2a2e38');
      p.rrect(-0.018, -0.3, 0.036, 0.08, 0.01, '#8a8e98');
      p.glow(0, -0.44, 0.06, '#ff5050', 0.8);
      p.c.restore();
      break;
    }
    case 'coin': {
      p.glow(0, -0.1, 0.2, '#ffd24d', 0.8);
      p.circle(0, -0.1, 0.1, rad(-0.03, -0.14, 0.14, '#fff7b0', '#e0a020'), { stroke: '#8a5a10' });
      const ring = newPath();
      ring.addCircle(0, -0.1, 0.068);
      p.stroke(ring, '#b07818', 0.012);
      p.seg(-0.02, -0.12, 0.02, -0.12, '#b07818', 0.014);
      p.seg(0, -0.15, 0, -0.05, '#b07818', 0.014);
      break;
    }
    case 'orb': {
      p.glow(0, -0.2, 0.34, accent, 0.9);
      p.circle(0, -0.2, 0.12, rad(-0.04, -0.25, 0.16, '#ffffff', accent), { stroke: shade(accent, -0.5) });
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3;
        p.circle(Math.cos(a) * 0.17, -0.2 + Math.sin(a) * 0.06, 0.02, '#ffffff', { stroke: null });
      }
      break;
    }
    case 'hourglass': {
      p.glow(0, -0.2, 0.28, accent, 0.7);
      p.rrect(-0.09, -0.34, 0.18, 0.03, 0.01, '#c9a24a');
      p.rrect(-0.09, -0.07, 0.18, 0.03, 0.01, '#c9a24a');
      const top = polyPath([-0.075, -0.31, 0.075, -0.31, 0.012, -0.2, -0.012, -0.2]);
      const bot = polyPath([-0.012, -0.2, 0.012, -0.2, 0.075, -0.07, -0.075, -0.07]);
      p.path(top, '#d8f6ff', { stroke: '#5a7a8a', sw: 0.012, alpha: 0.85 });
      p.path(bot, '#d8f6ff', { stroke: '#5a7a8a', sw: 0.012, alpha: 0.85 });
      p.path(polyPath([-0.05, -0.1, 0.05, -0.1, 0.07, -0.075, -0.07, -0.075]), accent, { stroke: null });
      p.seg(0, -0.2, 0, -0.1, accent, 0.01);
      break;
    }
    case 'book':
      break;
  }
}

function weaponGeometry(w: WeaponKind): { tip: readonly [number, number] } {
  switch (w) {
    case 'sword':
    case 'shield':
      return { tip: [0, -0.45] };
    case 'greatsword':
      return { tip: [0, -0.62] };
    case 'twinblade':
    case 'dagger':
      return { tip: [0, -0.3] };
    case 'lance':
      return { tip: [0, -0.7] };
    case 'scythe':
      return { tip: [0.3, -0.5] };
    case 'bow':
      return { tip: [0.36, 0] };
    case 'staff':
      return { tip: [0, -0.5] };
    case 'wand':
      return { tip: [0, -0.3] };
    case 'bomb':
      return { tip: [0.05, -0.2] };
    case 'cards':
      return { tip: [0, -0.3] };
    case 'rifle':
      return { tip: [0.44, 0] };
    case 'coin':
      return { tip: [0, -0.15] };
    case 'orb':
      return { tip: [0, -0.2] };
    case 'hourglass':
      return { tip: [0, -0.25] };
    default:
      return { tip: [0, -0.3] };
  }
}

// ───────────────────────────── 모자 ─────────────────────────────

function hatBack(p: Pen, hat: HatKind, look: UnitLook) {
  if (hat === 'hood') {
    p.circle(0, HEAD_Y + 0.01, HEAD_R + 0.035, look.outfit, { stroke: shade(look.outfit, -0.55), sw: OW });
  }
}

function drawHat(p: Pen, hat: HatKind, look: UnitLook) {
  const out = look.outfit;
  const trim = look.trim;
  const top = HEAD_Y - HEAD_R;
  switch (hat) {
    case 'none':
      break;
    case 'hood': {
      const rim = newPath();
      rim.addArc(Skia.XYWHRect(-HEAD_R - 0.01, HEAD_Y - HEAD_R - 0.01, (HEAD_R + 0.01) * 2, (HEAD_R + 0.01) * 2), 195, 150);
      p.stroke(rim, shade(out, -0.35), 0.06);
      p.stroke(rim, out, 0.04);
      break;
    }
    case 'wizard':
    case 'witch': {
      const witch = hat === 'witch';
      p.oval(0, top + 0.03, witch ? 0.3 : 0.27, 0.06, shade(out, -0.1));
      const cone = newPath();
      cone.moveTo(-0.17, top + 0.02);
      if (witch) {
        cone.quadTo(-0.08, top - 0.22, 0.1, top - 0.33);
        cone.quadTo(0.06, top - 0.22, 0.17, top + 0.02);
      } else {
        cone.quadTo(-0.05, top - 0.2, 0.02, top - 0.36);
        cone.quadTo(0.1, top - 0.2, 0.17, top + 0.02);
      }
      cone.close();
      p.path(cone, lin(-0.17, 0, 0.17, 0, shade(out, 0.15), shade(out, -0.2)));
      p.rrect(-0.17, top - 0.04, 0.34, 0.045, 0.012, trim, { stroke: shade(trim, -0.5), sw: 0.01 });
      p.path(starPath(0.02, top - 0.14, 0.035, 0.015, 5), '#fff2a8', { stroke: null });
      break;
    }
    case 'crown': {
      const crown = polyPath([-0.15, top + 0.04, -0.15, top - 0.1, -0.075, top - 0.03, 0, top - 0.14, 0.075, top - 0.03, 0.15, top - 0.1, 0.15, top + 0.04]);
      p.path(crown, lin(0, top - 0.14, 0, top + 0.04, '#fff2a8', '#e0a020'), { stroke: '#8a5a10', sw: OW });
      for (const [x, y, c] of [
        [-0.15, top - 0.1, '#ff5a7a'],
        [0, top - 0.14, '#7be0ff'],
        [0.15, top - 0.1, '#ff5a7a'],
      ] as const) {
        p.circle(x, y, 0.022, c, { stroke: '#5a2a40', sw: 0.008 });
      }
      break;
    }
    case 'headband': {
      p.rrect(-HEAD_R + 0.005, HEAD_Y - 0.085, HEAD_R * 2 - 0.01, 0.045, 0.012, trim, { stroke: shade(trim, -0.5), sw: 0.01 });
      p.path(polyPath([HEAD_R - 0.01, HEAD_Y - 0.075, HEAD_R + 0.1, HEAD_Y - 0.03, HEAD_R + 0.02, HEAD_Y - 0.06]), trim, { stroke: shade(trim, -0.5), sw: 0.008 });
      p.path(polyPath([HEAD_R - 0.01, HEAD_Y - 0.06, HEAD_R + 0.08, HEAD_Y - 0.11, HEAD_R + 0.02, HEAD_Y - 0.08]), trim, { stroke: shade(trim, -0.5), sw: 0.008 });
      break;
    }
    case 'horns': {
      for (const s of [-1, 1]) {
        const horn = newPath();
        horn.moveTo(s * 0.1, top + 0.04);
        horn.quadTo(s * 0.17, top - 0.12, s * 0.27, top - 0.14);
        horn.quadTo(s * 0.2, top - 0.02, s * 0.15, top + 0.06);
        horn.close();
        p.path(horn, lin(0, top - 0.14, 0, top + 0.06, '#f4eed8', mix(look.trim, '#8a7a60', 0.4)), { stroke: '#3a2a40', sw: OW });
      }
      break;
    }
    case 'halo': {
      p.glow(0, top - 0.08, 0.22, '#ffe98a', 0.9);
      const ring = newPath();
      ring.addOval(Skia.XYWHRect(-0.14, top - 0.12, 0.28, 0.08));
      p.stroke(ring, '#fff2a8', 0.03);
      p.stroke(ring, '#ffffff', 0.012, { alpha: 0.9 });
      break;
    }
    case 'cap': {
      const dome = newPath();
      dome.addArc(Skia.XYWHRect(-HEAD_R - 0.005, HEAD_Y - HEAD_R - 0.005, (HEAD_R + 0.005) * 2, (HEAD_R + 0.005) * 2), 180, 180);
      dome.close();
      p.path(dome, lin(0, top, 0, HEAD_Y, shade(out, 0.2), shade(out, -0.15)));
      p.rrect(-0.02, HEAD_Y - 0.075, 0.24, 0.035, 0.015, shade(out, -0.2));
      p.circle(0, top - 0.005, 0.02, trim, { stroke: null });
      break;
    }
    case 'mitre': {
      const m = polyPath([-0.15, top + 0.04, -0.11, top - 0.26, 0, top - 0.32, 0.11, top - 0.26, 0.15, top + 0.04]);
      p.path(m, lin(0, top - 0.3, 0, top + 0.04, '#ffffff', '#e8e2cc'), { stroke: '#8a7a50', sw: OW });
      p.rrect(-0.15, top - 0.03, 0.3, 0.05, 0.012, trim, { stroke: shade(trim, -0.5), sw: 0.01 });
      p.rrect(-0.012, top - 0.2, 0.024, 0.14, 0.006, trim, { stroke: null });
      p.rrect(-0.04, top - 0.15, 0.08, 0.024, 0.006, trim, { stroke: null });
      break;
    }
    case 'tophat': {
      p.rrect(-0.12, top - 0.2, 0.24, 0.22, 0.02, lin(-0.12, 0, 0.12, 0, shade(out, 0.1), shade(out, -0.4)));
      p.oval(0, top + 0.02, 0.2, 0.045, shade(out, -0.3));
      p.rrect(-0.12, top - 0.04, 0.24, 0.05, 0.01, trim, { stroke: shade(trim, -0.5), sw: 0.01 });
      break;
    }
    case 'helmet': {
      const dome = newPath();
      dome.addArc(Skia.XYWHRect(-HEAD_R - 0.015, HEAD_Y - HEAD_R - 0.015, (HEAD_R + 0.015) * 2, (HEAD_R + 0.015) * 2), 180, 180);
      dome.close();
      p.path(dome, lin(0, top, 0, HEAD_Y, '#f2f6ff', '#8a96b0'), { stroke: '#3a4468', sw: OW });
      p.rrect(-HEAD_R - 0.01, HEAD_Y - 0.095, (HEAD_R + 0.01) * 2, 0.045, 0.015, lin(0, 0, 0, 0.05, '#c8d2e8', '#7a86a4'), { stroke: '#3a4468', sw: 0.012 });
      for (const k of [-1, 1]) p.rrect(k * HEAD_R - 0.02, HEAD_Y - 0.06, 0.04, 0.12, 0.015, '#9aa6c0', { stroke: '#3a4468', sw: 0.01 });
      const plume = newPath();
      plume.moveTo(0, top - 0.01);
      plume.quadTo(0.04, top - 0.14, 0.18, top - 0.1);
      plume.quadTo(0.1, top - 0.08, 0.06, top + 0.01);
      plume.close();
      p.path(plume, '#d83a4a', { stroke: '#5a1020', sw: 0.012 });
      break;
    }
    case 'dragonhelm': {
      const dome = newPath();
      dome.addArc(Skia.XYWHRect(-HEAD_R - 0.015, HEAD_Y - HEAD_R - 0.015, (HEAD_R + 0.015) * 2, (HEAD_R + 0.015) * 2), 180, 180);
      dome.close();
      p.path(dome, lin(0, top, 0, HEAD_Y, '#e8ecf8', '#8a92a8'));
      for (const s of [-1, 1]) {
        const wing = newPath();
        wing.moveTo(s * 0.15, top + 0.05);
        wing.quadTo(s * 0.3, top - 0.06, s * 0.3, top - 0.2);
        wing.quadTo(s * 0.2, top - 0.1, s * 0.1, top - 0.02);
        wing.close();
        p.path(wing, out, { stroke: shade(out, -0.6), sw: OW });
      }
      p.path(polyPath([-0.03, top - 0.02, 0, top - 0.17, 0.03, top - 0.02]), trim, { stroke: shade(trim, -0.6), sw: 0.01 });
      p.rrect(-0.02, HEAD_Y - 0.1, 0.04, 0.07, 0.01, '#8a92a8', { stroke: '#4a5068', sw: 0.008 });
      break;
    }
    case 'beret': {
      p.oval(-0.02, top + 0.0, 0.2, 0.07, out, { stroke: shade(out, -0.55) });
      p.circle(-0.1, top - 0.065, 0.02, shade(out, -0.2), { stroke: null });
      p.rrect(0.05, top - 0.02, 0.07, 0.03, 0.01, trim, { stroke: null });
      break;
    }
  }
}

function hatKeepsHair(hat: HatKind): boolean {
  return hat === 'none' || hat === 'headband' || hat === 'horns' || hat === 'halo' || hat === 'crown' || hat === 'beret';
}

// ───────────────────────────── 몸 ─────────────────────────────

function drawFace(p: Pen, look: UnitLook) {
  const eye = look.eye;
  for (const s of [-1, 1]) {
    const ex = s * 0.065;
    if (eye) {
      p.oval(ex, HEAD_Y + 0.015, 0.04, 0.053, eye, { stroke: '#1b1530', sw: 0.01 });
      p.oval(ex, HEAD_Y + 0.02, 0.022, 0.034, '#1b1530', { stroke: null });
    } else {
      p.oval(ex, HEAD_Y + 0.015, 0.035, 0.05, '#2a1f3d', { stroke: '#120c20', sw: 0.008 });
    }
    p.circle(ex + 0.012, HEAD_Y - 0.008, 0.013, '#ffffff', { stroke: null });
    p.circle(ex - 0.01, HEAD_Y + 0.03, 0.006, '#ffffff', { stroke: null, alpha: 0.8 });
    p.oval(s * 0.115, HEAD_Y + 0.07, 0.03, 0.016, '#ff8aa0', { stroke: null, alpha: 0.45 });
  }
  const mouth = newPath();
  mouth.moveTo(-0.022, HEAD_Y + 0.085);
  mouth.quadTo(0, HEAD_Y + 0.108, 0.022, HEAD_Y + 0.085);
  p.stroke(mouth, '#6a2a2a', 0.012);
}

function drawHair(p: Pen, look: UnitLook, hat: HatKind) {
  const hair = look.hair;
  if (hat === 'hood') return;
  p.oval(0, HEAD_Y - 0.01, HEAD_R + 0.012, HEAD_R, hair, { stroke: shade(hair, -0.55) });
}

function drawFringe(p: Pen, look: UnitLook, hat: HatKind) {
  if (hat === 'hood' || hat === 'helmet' || hat === 'dragonhelm' || hat === 'cap') return;
  const hair = look.hair;
  const y0 = HEAD_Y - 0.02;
  const f = newPath();
  f.moveTo(-HEAD_R, y0);
  f.cubicTo(-HEAD_R - 0.01, HEAD_Y - HEAD_R - 0.04, HEAD_R + 0.01, HEAD_Y - HEAD_R - 0.04, HEAD_R, y0);
  f.quadTo(0.12, HEAD_Y - 0.1, 0.06, HEAD_Y - 0.07);
  f.quadTo(0.02, HEAD_Y - 0.12, -0.03, HEAD_Y - 0.075);
  f.quadTo(-0.08, HEAD_Y - 0.11, -0.12, HEAD_Y - 0.06);
  f.quadTo(-HEAD_R + 0.01, HEAD_Y - 0.06, -HEAD_R, y0);
  f.close();
  p.path(f, lin(0, HEAD_Y - HEAD_R, 0, y0, shade(hair, 0.18), hair), { stroke: shade(hair, -0.55), sw: 0.012 });
}

function drawLegs(p: Pen, look: UnitLook) {
  const boot = shade(look.outfit, -0.55);
  for (const s of [-1, 1]) {
    p.rrect(s * 0.075 - 0.045, 0.22, 0.09, 0.09, 0.03, boot);
  }
}

function drawTorso(p: Pen, look: UnitLook, robe: boolean) {
  const out = look.outfit;
  const trim = look.trim;
  const t = newPath();
  if (robe) {
    t.moveTo(-0.115, 0.02);
    t.quadTo(0, -0.01, 0.115, 0.02);
    t.quadTo(0.17, 0.15, 0.21, 0.28);
    t.quadTo(0, 0.33, -0.21, 0.28);
    t.quadTo(-0.17, 0.15, -0.115, 0.02);
  } else {
    t.moveTo(-0.12, 0.02);
    t.quadTo(0, -0.01, 0.12, 0.02);
    t.quadTo(0.15, 0.14, 0.15, 0.26);
    t.quadTo(0, 0.3, -0.15, 0.26);
    t.quadTo(-0.15, 0.14, -0.12, 0.02);
  }
  t.close();
  p.path(t, lin(-0.15, 0, 0.15, 0.3, shade(out, 0.22), out, shade(out, -0.28)));
  // 허리띠
  p.rrect(-0.15, 0.16, 0.3, 0.036, 0.012, shade(trim, -0.15), { stroke: shade(trim, -0.6), sw: 0.008 });
  p.rrect(-0.025, 0.152, 0.05, 0.05, 0.01, trim, { stroke: shade(trim, -0.6), sw: 0.008 });
  // 목깃
  const collar = newPath();
  collar.moveTo(-0.08, 0.025);
  collar.quadTo(0, 0.085, 0.08, 0.025);
  p.stroke(collar, trim, 0.032);
}

function drawShield(p: Pen, look: UnitLook) {
  const sh = newPath();
  sh.moveTo(-0.24, 0.0);
  sh.lineTo(-0.08, 0.0);
  sh.lineTo(-0.08, 0.14);
  sh.quadTo(-0.16, 0.26, -0.24, 0.14);
  sh.close();
  p.path(sh, lin(-0.24, 0, -0.08, 0.2, '#f2f6ff', '#8a96b8'), { stroke: '#3a4468', sw: OW });
  p.path(starPath(-0.16, 0.09, 0.04, 0.02, 4), look.outfit, { stroke: null });
}

function drawWings(wings: string, side: -1 | 1): SkPicture {
  return record(1.2, 1.2, -0.6, -0.6, (p) => {
    // 원점 = 어깨, side 방향으로 펼쳐진 깃털 날개
    const c = p.c;
    c.save();
    c.scale(side, 1);
    for (let i = 0; i < 4; i++) {
      const a = -0.9 + i * 0.32;
      const len = 0.36 - i * 0.03;
      const f = newPath();
      f.moveTo(0, 0);
      f.quadTo(Math.cos(a) * len * 0.6 + 0.02, Math.sin(a) * len * 0.6 - 0.08, Math.cos(a) * len + 0.08, Math.sin(a) * len - 0.12);
      f.quadTo(Math.cos(a) * len * 0.5 + 0.06, Math.sin(a) * len * 0.5 + 0.04, 0.02, 0.05);
      f.close();
      p.path(f, lin(0, 0, Math.cos(a) * len, Math.sin(a) * len, shade(wings, 0.5), wings), { stroke: shade(wings, -0.55), sw: 0.012 });
    }
    c.restore();
  });
}

// ───────────────────────────── 조립 ─────────────────────────────

const cache = new Map<UnitId, UnitSprite>();

export function unitSprite(id: UnitId): UnitSprite {
  let s = cache.get(id);
  if (!s) {
    s = bakeUnit(id);
    cache.set(id, s);
  }
  return s;
}

function bakeUnit(id: UnitId): UnitSprite {
  const def = UNITS[id];
  const look = def.look;
  const robe = ROBE_HATS.includes(look.hat);
  const melee = MELEE.includes(look.weapon);
  const grip: readonly [number, number] = [0.19, 0.1];
  const geo = weaponGeometry(look.weapon);

  const back = look.cape
    ? record(1, 1, -0.5, -0.5, (p) => {
        const cape = newPath();
        cape.moveTo(-0.12, 0.0);
        cape.quadTo(0, -0.03, 0.12, 0.0);
        cape.quadTo(0.26, 0.15, 0.24, 0.32);
        cape.quadTo(0, 0.36, -0.24, 0.32);
        cape.quadTo(-0.26, 0.15, -0.12, 0.0);
        cape.close();
        p.path(cape, lin(0, 0, 0, 0.34, shade(look.cape!, 0.15), shade(look.cape!, -0.35)), { stroke: shade(look.cape!, -0.65), sw: OW });
      })
    : null;

  const wingL = look.wings ? drawWings(look.wings, -1) : null;
  const wingR = look.wings ? drawWings(look.wings, 1) : null;

  const body = record(1.4, 1.4, -0.7, -0.7, (p) => {
    drawLegs(p, look);
    if (look.weapon === 'shield') drawShield(p, look);
    drawTorso(p, look, robe);
    hatBack(p, look.hat, look);
    if (hatKeepsHair(look.hat) || look.hat === 'wizard' || look.hat === 'witch' || look.hat === 'tophat' || look.hat === 'mitre') drawHair(p, look, look.hat);
    p.circle(0, HEAD_Y, HEAD_R, rad(-0.05, HEAD_Y - 0.06, HEAD_R * 1.25, shade(look.skin, 0.25), look.skin, shade(look.skin, -0.22)), {
      stroke: shade(look.skin, -0.6),
      sw: OW,
    });
    drawFringe(p, look, look.hat);
    drawFace(p, look);
    drawHat(p, look.hat, look);
    // 왼손
    p.circle(-0.185, 0.115, 0.042, look.skin, { stroke: shade(look.skin, -0.6), sw: 0.012 });
  });

  const weapon = record(1.6, 1.6, -0.8, -0.8, (p) => {
    drawWeapon(p, look.weapon, look);
    // 오른손 (손잡이를 감싸는 위치)
    p.circle(0, 0.005, 0.044, look.skin, { stroke: shade(look.skin, -0.6), sw: 0.012 });
  });

  return {
    back,
    wingL,
    wingR,
    body,
    weapon,
    grip,
    swing: melee,
    tip: geo.tip,
    top: HEAD_Y - HEAD_R - (look.hat === 'wizard' || look.hat === 'witch' || look.hat === 'mitre' ? 0.3 : look.hat === 'tophat' ? 0.2 : 0.08),
  };
}

/** 도감/카드 아이콘용: 한 장면에 유닛을 그린다 (정적) */
export function drawUnitStatic(c: SkCanvas, id: UnitId, x: number, y: number, size: number) {
  const s = unitSprite(id);
  c.save();
  c.translate(x, y);
  c.scale(size, size);
  if (s.back) c.drawPicture(s.back);
  if (s.wingL) {
    c.save();
    c.translate(-0.1, 0.06);
    c.drawPicture(s.wingL);
    c.restore();
  }
  if (s.wingR) {
    c.save();
    c.translate(0.1, 0.06);
    c.drawPicture(s.wingR);
    c.restore();
  }
  c.drawPicture(s.body);
  c.save();
  c.translate(s.grip[0], s.grip[1]);
  c.drawPicture(s.weapon);
  c.restore();
  c.restore();
}

