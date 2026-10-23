import { Skia, SkiaPictureView, type SkPicture } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  const origin = useRef({ x: 0, y: 0 });

  useEffect(() => {
    session.attach(skiaFont(30), setPic);
    // 스크린샷/자동 테스트용: ?manual 이면 루프를 돌리지 않고 session.advance() 로 직접 진행한다
    const manual = typeof window !== 'undefined' && window.location?.search?.includes('manual');
    if (!manual) session.start();
    else session.renderOnce();
    return () => session.stop();
  }, [session]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          origin.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
          session.pointerDown(origin.current.x, origin.current.y);
        },
        onPanResponderMove: (_e, g) => session.pointerMove(origin.current.x + g.dx, origin.current.y + g.dy),
        onPanResponderRelease: (_e, g) => session.pointerUp(origin.current.x + g.dx, origin.current.y + g.dy),
        onPanResponderTerminate: () => session.pointerCancel(),
      }),
    [session],
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
