// 엔트리: 웹에서는 Skia 의 CanvasKit(WASM)을 먼저 로드한 뒤에 앱(라우트 포함)을 불러온다.
// (Skia 모듈은 import 시점에 global.CanvasKit 이 필요하다. 네이티브는 바로 시작한다.)
import { Platform } from 'react-native';

if (Platform.OS === 'web') {
  const { LoadSkiaWeb } = require('@shopify/react-native-skia/lib/module/web');
  // 단일 HTML 빌드는 wasm 을 파일 안에 담아 두고 window.__TD(이름) 으로 blob 주소를 돌려준다.
  const locate = (file) => (globalThis.__TD ? globalThis.__TD(file) : `/${file}`);
  LoadSkiaWeb({ locateFile: locate }).then(() => require('expo-router/entry'));
} else {
  require('expo-router/entry');
}
