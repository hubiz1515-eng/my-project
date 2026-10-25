// 단일 HTML 빌드(EXPO_PUBLIC_SINGLE=1)에서 'expo-router' 대신 쓰는 아주 작은 대체품.
// file:// 에서는 경로 기반 라우팅이 안 되므로 주소의 해시(#/game?seed=3)를 화면 경로로 쓴다.
// 앱 코드가 쓰는 API(router.push/replace/back, useLocalSearchParams)만 흉내 낸다. (metro.config.js 참고)
import { useMemo, useSyncExternalStore } from 'react';

export type Params = Record<string, string>;

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

const getHash = () => window.location.hash;
const getServerHash = () => '';

/** '#/game?seed=5' → { path: '/game', params: { seed: '5' } }  (주소의 ?query 도 params 에 합친다) */
export function parseLocation(hash: string, search: string) {
  const raw = hash.replace(/^#/, '') || '/';
  const q = raw.indexOf('?');
  const path = (q < 0 ? raw : raw.slice(0, q)) || '/';
  const params: Params = {};
  for (const [k, v] of new URLSearchParams(search)) params[k] = v;
  if (q >= 0) for (const [k, v] of new URLSearchParams(raw.slice(q + 1))) params[k] = v;
  return { path: path.startsWith('/') ? path : `/${path}`, params };
}

export function useLocation() {
  const hash = useSyncExternalStore(subscribe, getHash, getServerHash);
  return useMemo(() => parseLocation(hash, window.location.search), [hash]);
}

export function useLocalSearchParams<T extends Params = Params>(): Partial<T> {
  return useLocation().params as Partial<T>;
}

// push 한 적이 있을 때만 브라우저 뒤로가기를 쓰고, 아니면 타이틀로 돌아간다.
let pushed = false;

export const router = {
  push(href: string) {
    pushed = true;
    window.location.hash = href;
  },
  replace(href: string) {
    pushed = false;
    window.location.replace(`#${href}`);
  },
  back() {
    if (pushed) {
      pushed = false;
      window.history.back();
    } else {
      router.replace('/');
    }
  },
};
