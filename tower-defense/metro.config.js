// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// 단일 HTML 빌드(`npm run build:html`)에서만: 파일 기반 라우터 대신 src/single 의 작은 대체품을 쓴다.
// (file:// 로 열어도 화면 전환이 되도록 주소 해시를 쓰고, 번들에서 expo-router 자체를 뺀다)
if (process.env.EXPO_PUBLIC_SINGLE === '1') {
  const alias = {
    'expo-router': path.resolve(__dirname, 'src/single/expo-router-shim.ts'),
    'expo-router/entry': path.resolve(__dirname, 'src/single/entry.tsx'),
  };
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (alias[moduleName]) return { type: 'sourceFile', filePath: alias[moduleName] };
    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
