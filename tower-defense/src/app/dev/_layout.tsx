import { Redirect, Slot } from 'expo-router';

/** 개발 전용 화면(스프라이트 시트, 보드 미리보기 등) — 배포 빌드에서는 접근할 수 없다 */
export default function DevLayout() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Slot />;
}
