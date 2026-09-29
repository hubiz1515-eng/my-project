import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { colors } from '../../constants/theme';
import type { PickupMapProps } from '../../types/map';
import { buildKakaoMapHtml, KAKAO_BASE_URL } from './kakaoMapHtml';

export function KakaoMap({ jsKey, center, user, pins, selectedId, onSelectPin }: PickupMapProps & { jsKey: string }) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const html = useMemo(() => buildKakaoMapHtml(jsKey), [jsKey]);

  useEffect(() => {
    if (!ready) return;
    const state = JSON.stringify({ center, user, pins, selectedId });
    webRef.current?.injectJavaScript(`window.setState(${state}); true;`);
  }, [ready, center, user, pins, selectedId]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type: string; id?: string };
      if (msg.type === 'ready') setReady(true);
      else if (msg.type === 'select' && msg.id) onSelectPin(msg.id);
      else if (msg.type === 'error') setError(true);
    } catch {
      // 알 수 없는 메시지는 무시
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html, baseUrl: KAKAO_BASE_URL }}
        onMessage={onMessage}
        onError={() => setError(true)}
        javaScriptEnabled
        style={styles.web}
      />
      {error && (
        <View style={styles.error}>
          <Text style={styles.errorText}>지도를 불러오지 못했어요. 키/도메인 설정을 확인해 주세요.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.mapBg },
  web: { flex: 1, backgroundColor: 'transparent' },
  error: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mapBg },
  errorText: { color: colors.textMuted, fontSize: 13 },
});
