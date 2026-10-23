import { BOARD_H, BOARD_W, PATH_RADIUS } from './config';

export interface PathPoint {
  x: number;
  y: number;
  /** 진행 방향(라디안, 화면 좌표계: +x 오른쪽, +y 아래) */
  angle: number;
}

interface Seg {
  /** 시작 거리 */
  at: number;
  len: number;
  kind: 'line' | 'arc';
  // line
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  // arc
  cx: number;
  cy: number;
  a0: number;
}

const X0 = 0.5;
const Y0 = 0.5;
const X1 = BOARD_W - 0.5;
const Y1 = BOARD_H - 0.5;
const R = PATH_RADIUS;

function buildSegments(): { segs: Seg[]; length: number } {
  const segs: Seg[] = [];
  let at = 0;
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    segs.push({ at, len, kind: 'line', x0, y0, dx: (x1 - x0) / len, dy: (y1 - y0) / len, cx: 0, cy: 0, a0: 0 });
    at += len;
  };
  const arc = (cx: number, cy: number, a0: number) => {
    const len = (Math.PI / 2) * R;
    segs.push({ at, len, kind: 'arc', x0: 0, y0: 0, dx: 0, dy: 0, cx, cy, a0 });
    at += len;
  };
  // 시계 방향, 왼쪽 위에서 출발
  line(X0 + R, Y0, X1 - R, Y0);
  arc(X1 - R, Y0 + R, -Math.PI / 2);
  line(X1, Y0 + R, X1, Y1 - R);
  arc(X1 - R, Y1 - R, 0);
  line(X1 - R, Y1, X0 + R, Y1);
  arc(X0 + R, Y1 - R, Math.PI / 2);
  line(X0, Y1 - R, X0, Y0 + R);
  arc(X0 + R, Y0 + R, Math.PI);
  return { segs, length: at };
}

const { segs: SEGS, length: LOOP_LENGTH_VALUE } = buildSegments();

export const LOOP_LENGTH = LOOP_LENGTH_VALUE;

/** 길 위 거리 d(자동으로 한 바퀴 순환)의 좌표와 진행 방향 */
export function pointAt(d: number, out: PathPoint = { x: 0, y: 0, angle: 0 }): PathPoint {
  let t = d % LOOP_LENGTH;
  if (t < 0) t += LOOP_LENGTH;
  let seg = SEGS[SEGS.length - 1];
  for (let i = 0; i < SEGS.length; i++) {
    if (t < SEGS[i].at + SEGS[i].len) {
      seg = SEGS[i];
      break;
    }
  }
  const local = t - seg.at;
  if (seg.kind === 'line') {
    out.x = seg.x0 + seg.dx * local;
    out.y = seg.y0 + seg.dy * local;
    out.angle = Math.atan2(seg.dy, seg.dx);
  } else {
    const a = seg.a0 + local / R;
    out.x = seg.cx + Math.cos(a) * R;
    out.y = seg.cy + Math.sin(a) * R;
    out.angle = a + Math.PI / 2;
  }
  return out;
}

/** 길 사각형(중심선) 정보 — 렌더러가 길을 그릴 때 사용 */
export const PATH_RECT = { x0: X0, y0: Y0, x1: X1, y1: Y1, r: R } as const;
