import { Skia, type SkCanvas } from '@shopify/react-native-skia';
import type { EnemyKind } from '../engine/enemies';
import { ENEMIES } from '../engine/enemies';
import type { UnitId } from '../engine/units';
import { monsterSprite } from './monsters';
import { drawUnitStatic } from './units';

/**
 * 리스트/카드에서 쓸 아이콘을 Skia 로 한 번 구워 PNG data URI 로 만든다.
 * (화면마다 Skia 뷰를 여러 개 만들면 웹에서 WebGL 컨텍스트 한도에 걸리므로 이미지로 쓴다.)
 */
const cache = new Map<string, string>();

function bake(key: string, size: number, draw: (c: SkCanvas) => void): string {
  const hit = cache.get(key);
  if (hit) return hit;
  let uri = '';
  try {
    const surface = Skia.Surface.Make(size, size);
    if (surface) {
      const canvas = surface.getCanvas();
      canvas.clear(Float32Array.of(0, 0, 0, 0));
      draw(canvas);
      surface.flush();
      const img = surface.makeImageSnapshot();
      uri = `data:image/png;base64,${img.encodeToBase64()}`;
    }
  } catch (e) {
    console.warn('아이콘 생성 실패', key, e);
  }
  cache.set(key, uri);
  return uri;
}

export function unitIcon(id: UnitId, size = 96): string {
  return bake(`u:${id}:${size}`, size, (c) => drawUnitStatic(c, id, size * 0.5, size * 0.6, size * 0.82));
}

export function enemyIcon(kind: EnemyKind, size = 96): string {
  return bake(`e:${kind}:${size}`, size, (c) => {
    const m = monsterSprite(kind);
    const sc = size * 0.9 * (ENEMIES[kind].boss ? 0.62 : 0.85);
    c.save();
    c.translate(size / 2, size * 0.55);
    c.scale(sc, sc);
    if (m.extra) {
      c.save();
      c.translate(m.extraPivot[0], m.extraPivot[1]);
      c.drawPicture(m.extra);
      c.restore();
    }
    if (m.wing) {
      for (const sx of [-1, 1]) {
        c.save();
        c.translate(m.wingPivot[0] * sx, m.wingPivot[1]);
        c.scale(sx, 1);
        c.rotate(-10, 0, 0);
        c.drawPicture(m.wing);
        c.restore();
      }
    }
    c.drawPicture(m.body);
    c.restore();
  });
}
