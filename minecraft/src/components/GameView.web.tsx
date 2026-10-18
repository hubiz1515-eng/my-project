import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { buildGameHtml } from '../game/buildHtml';
import { handleGameMessage } from '../game/messages';
import { loadSave } from '../game/saveStore';

/** 웹: iframe(srcDoc) 안에서 게임 실행. 월드 저장은 postMessage → AsyncStorage(localStorage) */
export function GameView() {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadSave().then((save) => {
      if (alive) setHtml(buildGameHtml(save));
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // 우리 iframe 이 보낸 메시지만 처리
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      handleGameMessage(e.data);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <View style={styles.root}>
      {html === null ? (
        <ActivityIndicator color="#7be07b" style={styles.spinner} />
      ) : (
        <iframe
          ref={frame}
          srcDoc={html}
          title="블록크래프트"
          allow="autoplay; fullscreen"
          style={iframeStyle}
          // 키보드 입력이 바로 게임으로 가도록 포커스
          onLoad={() => frame.current?.focus()}
        />
      )}
    </View>
  );
}

const iframeStyle = { border: 0, width: '100%', height: '100%', display: 'block', background: '#000' } as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  spinner: { flex: 1 },
});
