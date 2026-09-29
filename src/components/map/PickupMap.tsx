import { Platform } from 'react-native';
import type { PickupMapProps } from '../../types/map';
import { KakaoMap } from './KakaoMap';
import { MockMap } from './MockMap';

const KAKAO_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_JS_KEY;

/** 카카오 JS 키가 있고 네이티브(WebView 지원)면 실제 지도, 아니면 Mock 지도 */
export function PickupMap(props: PickupMapProps) {
  if (KAKAO_JS_KEY && Platform.OS !== 'web') return <KakaoMap jsKey={KAKAO_JS_KEY} {...props} />;
  return <MockMap {...props} />;
}
