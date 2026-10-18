import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { buildGameHtml } from '../game/buildHtml';
import { handleGameMessage } from '../game/messages';
import { loadSave } from '../game/saveStore';

/** 네이티브: WebView 안에서 WebGL 게임 실행. 월드 저장은 AsyncStorage 로 처리 */
export function GameView() {
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const [html, setHtml] = useState<string | null>(null);

  // 저장된 월드를 먼저 읽고, HTML 에 심어서 한 번에 시작한다
  useEffect(() => {
    let alive = true;
    loadSave().then((save) => {
      if (alive) setHtml(buildGameHtml(save));
    });
    return () => {
      alive = false;
    };
  }, []);

  // 안드로이드 뒤로가기: 앱을 끝내지 않고 게임 메뉴를 열고 닫는다
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      webRef.current?.injectJavaScript('window.blockcraft&&window.blockcraft.toggleMenu();true;');
      return true;
    });
    return () => sub.remove();
  }, []);

  const onMessage = useCallback((e: WebViewMessageEvent) => handleGameMessage(e.nativeEvent.data), []);
  const reload = useCallback(() => webRef.current?.reload(), []);

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right },
      ]}
    >
      {html === null ? (
        <ActivityIndicator color="#7be07b" style={styles.spinner} />
      ) : (
        <WebView
          ref={webRef}
          style={styles.web}
          source={{ html }}
          originWhitelist={['*']}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsLinkPreview={false}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          setSupportMultipleWindows={false}
          androidLayerType="hardware"
          textZoom={100}
          // 메모리 부족 등으로 웹 프로세스가 죽으면 저장된 월드로 다시 시작
          onContentProcessDidTerminate={reload}
          onRenderProcessGone={reload}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  web: { flex: 1, backgroundColor: '#000' },
  spinner: { flex: 1 },
});
