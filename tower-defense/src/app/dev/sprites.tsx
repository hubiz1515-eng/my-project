import { Skia, SkiaPictureView } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';
import { UNIT_IDS } from '@/game/engine/units';
import { ENEMIES, type EnemyKind } from '@/game/engine/enemies';
import { monsterSprite } from '@/game/render/monsters';
import { drawUnitStatic } from '@/game/render/units';
import { col } from '@/game/render/palette';

const kinds = Object.keys(ENEMIES) as EnemyKind[];

export default function SpriteSheet() {
  const { width } = useWindowDimensions();
  const cols = 4;
  const cell = width / cols;
  const rows = Math.ceil(UNIT_IDS.length / cols) + Math.ceil(kinds.length / cols);
  const height = rows * cell;
  const picture = useMemo(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
    const bg = Skia.Paint();
    bg.setColor(col('#2a3a4a'));
    c.drawPaint(bg);
    const line = Skia.Paint();
    line.setColor(col('#3a4a5a'));
    UNIT_IDS.forEach((id, i) => {
      const x = (i % cols) * cell + cell / 2;
      const y = Math.floor(i / cols) * cell + cell / 2;
      c.drawCircle(x, y + cell * 0.25, cell * 0.2, line);
      drawUnitStatic(c, id, x, y, cell * 1.1);
    });
    const base = Math.ceil(UNIT_IDS.length / cols);
    kinds.forEach((k, i) => {
      const x = (i % cols) * cell + cell / 2;
      const y = (base + Math.floor(i / cols)) * cell + cell / 2;
      const m = monsterSprite(k);
      c.drawCircle(x, y + cell * 0.3, cell * 0.2, line);
      c.save();
      c.translate(x, y);
      const sc = cell * 1.25 * ENEMIES[k].size * 0.8;
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
          c.drawPicture(m.wing);
          c.restore();
        }
      }
      c.drawPicture(m.body);
      c.restore();
    });
    return rec.finishRecordingAsPicture();
  }, [width, height, cell]);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#2a3a4a' }}>
      <SkiaPictureView style={{ width, height }} picture={picture} />
    </ScrollView>
  );
}
