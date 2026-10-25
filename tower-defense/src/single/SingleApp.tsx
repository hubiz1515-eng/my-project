import type { ComponentType } from 'react';
import { View } from 'react-native';
import Almanac from '@/app/almanac';
import GameRoute from '@/app/game';
import Title from '@/app/index';
import { AppShell } from '@/ui/AppShell';
import { C } from '@/ui/theme';
import { useLocation } from './expo-router-shim';

const ROUTES: Record<string, ComponentType> = {
  '/': Title,
  '/game': GameRoute,
  '/almanac': Almanac,
};

/** 단일 HTML 빌드의 루트: 파일 기반 라우터 없이 세 화면을 주소 해시로 전환한다. */
export function SingleApp() {
  const { path } = useLocation();
  const Screen = ROUTES[path] ?? Title;
  return (
    <AppShell>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Screen key={path} />
      </View>
    </AppShell>
  );
}
