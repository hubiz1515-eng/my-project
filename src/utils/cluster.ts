import type { Coords } from '../types/map';

/**
 * 지도 마커 클러스터링 (외부 의존성 없음 — 매장 수십~수백 개 규모에 충분).
 * 현재 줌에서 화면상 거리(px)가 가까운 핀끼리 묶는다. 웹·네이티브 공용.
 */

const TILE = 256;

/** 위경도 → 해당 줌의 Web Mercator 월드 픽셀 좌표 */
export function toWorldPx(p: Coords, zoom: number): { x: number; y: number } {
  const scale = TILE * 2 ** zoom;
  const sin = Math.min(Math.max(Math.sin((p.latitude * Math.PI) / 180), -0.9999), 0.9999);
  return {
    x: ((p.longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

/** 네이티브 지도의 경도 범위(longitudeDelta)와 화면 폭(px)으로 줌 추정 */
export function zoomFromLongitudeDelta(longitudeDelta: number, widthPx: number): number {
  return Math.log2((360 * widthPx) / (TILE * Math.max(longitudeDelta, 1e-6)));
}

export interface Cluster<T> extends Coords {
  /** 단일 핀이면 그 핀 id, 묶음이면 'cluster:' + 구성원 id 들 */
  id: string;
  members: T[];
}

/** 이 거리(px) 안의 핀은 하나로 묶는다 — 할인율 핀 폭(약 60px) 기준 */
export const CLUSTER_RADIUS_PX = 56;

export function clusterPins<T extends Coords & { id: string }>(
  pins: T[],
  zoom: number,
  radiusPx: number = CLUSTER_RADIUS_PX,
): Cluster<T>[] {
  const pts = pins.map((p) => ({ pin: p, ...toWorldPx(p, zoom) }));
  const used = new Set<number>();
  const out: Cluster<T>[] = [];
  for (let i = 0; i < pts.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    const group = [pts[i]];
    for (let j = i + 1; j < pts.length; j++) {
      if (used.has(j)) continue;
      // 묶음의 현재 중심과의 거리로 판단해 사슬처럼 길게 이어지는 것을 막는다
      const cx = group.reduce((s, g) => s + g.x, 0) / group.length;
      const cy = group.reduce((s, g) => s + g.y, 0) / group.length;
      if (Math.hypot(pts[j].x - cx, pts[j].y - cy) <= radiusPx) {
        used.add(j);
        group.push(pts[j]);
      }
    }
    const members = group.map((g) => g.pin);
    out.push({
      id: members.length === 1 ? members[0].id : `cluster:${members.map((m) => m.id).sort().join(',')}`,
      latitude: members.reduce((s, m) => s + m.latitude, 0) / members.length,
      longitude: members.reduce((s, m) => s + m.longitude, 0) / members.length,
      members,
    });
  }
  return out;
}
