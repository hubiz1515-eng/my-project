import { router, type Href } from 'expo-router';

/** 뒤로 갈 곳이 없으면(웹 새로고침·딥링크) fallback 으로 이동 */
export function goBack(fallback: Href = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

/** 스택을 비우고 이동 (모드 전환·홈 복귀 시 같은 화면이 스택에 중복으로 쌓이지 않게) */
export function resetTo(href: Href) {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}
