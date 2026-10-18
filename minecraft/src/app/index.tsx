import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { GameView } from '../components/GameView';

export default function GameScreen() {
  useEffect(() => {
    // 3D 게임은 가로 화면이 훨씬 편하다. 웹처럼 지원하지 않는 환경에서는 조용히 무시한다.
    // (세로로 두고 싶다면 이 effect 를 지우면 된다 — 세로 화면 UI 도 지원)
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
    };
  }, []);

  return <GameView />;
}
