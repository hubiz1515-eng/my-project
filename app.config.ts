import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json 을 기반으로, 비밀이 아닌 빌드 설정을 환경변수에서 주입한다.
 * - Android 지도: Google Maps SDK 키 (react-native-maps 플러그인 → AndroidManifest)
 * - iOS 지도: 기본 Apple 지도 사용 (키 불필요)
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [
    ...(config.plugins ?? []),
    ['react-native-maps', { androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '' }],
  ],
});
