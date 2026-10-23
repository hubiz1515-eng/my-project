import { Skia, SkiaPictureView, type SkPicture } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { skiaFont } from '../render/fonts';
import type { GameSession } from './session';

// 웹의 SkiaPictureView 는 첫 렌더에 picture 가 없으면 멈추므로 빈 그림으로 시작한다.
const EMPTY: SkPicture = (() => {
  const rec = Skia.PictureRecorder();
  rec.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
  return rec.finishRecordingAsPicture();
})();

/** 게임 보드: Skia 그림 + 터치(탭/드래그) 입력 */
export function BoardCanvas({ session }: { session: GameSession }) {
  const [pic, setPic] = useState<SkPicture>(EMPTY);
  // 터치 시작 지점 (PanResponder 콜백 안에서만 읽고 쓴다)
  const [origin] = useState(() => ({ x: 0, y: 0 }));

  useEffect(() => {
    /** 매 프레임 새 Picture 를 만들므로, 화면에서 내려간 것은 몇 프레임 뒤에 해제해 네이티브 메모리를 돌려준다 */
    const trash: SkPicture[] = [];
    let prev: SkPicture | null = null;
    session.attach(skiaFont(30), (next) => {
      if (prev && prev !== EMPTY) {
        trash.push(prev);
        if (trash.length > 3) {
          try {
            trash.shift()?.dispose();
          } catch {
            /* 이미 해제된 경우 무시 */
          }
        }
      }
      prev = next;
      setPic(next);
    });
    // 스크린샷/자동 테스트용: ?manual 이면 루프를 돌리지 않고 session.advance() 로 직접 진행한다
    const manual = typeof window !== 'undefined' && window.location?.search?.includes('manual');
    if (!manual) session.start();
    else session.renderOnce();
    return () => {
      session.stop();
      for (const t of trash.splice(0)) {
        try {
          t.dispose();
        } catch {
          /* 무시 */
        }
      }
    };
  }, [session]);

  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        origin.x = e.nativeEvent.locationX;
        origin.y = e.nativeEvent.locationY;
        session.pointerDown(origin.x, origin.y);
      },
      onPanResponderMove: (_e, g) => session.pointerMove(origin.x + g.dx, origin.y + g.dy),
      onPanResponderRelease: (_e, g) => session.pointerUp(origin.x + g.dx, origin.y + g.dy),
      onPanResponderTerminate: () => session.pointerCancel(),
    }),
  );

  const onLayout = (e: LayoutChangeEvent) => session.setLayout(e.nativeEvent.layout.width, e.nativeEvent.layout.height);

  return (
    <View style={styles.fill} onLayout={onLayout}>
      <SkiaPictureView style={StyleSheet.absoluteFill} picture={pic} />
      <View style={StyleSheet.absoluteFill} {...pan.panHandlers} />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
