// 엔트리: 웹에서는 Skia 의 CanvasKit(WASM)을 먼저 로드한 뒤에 앱(라우트 포함)을 불러온다.
// (Skia 모듈은 import 시점에 global.CanvasKit 이 필요하다. 네이티브는 바로 시작한다.)
import { Platform } from 'react-native';

if (Platform.OS === 'web') {
  const { LoadSkiaWeb } = require('@shopify/react-native-skia/lib/module/web');
  LoadSkiaWeb({ locateFile: (file) => `/${file}` }).then(() => require('expo-router/entry'));
} else {
  require('expo-router/entry');
}
