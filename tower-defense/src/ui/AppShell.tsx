import { Jua_400Regular } from '@expo-google-fonts/jua';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { loadSkiaTypeface } from '@/game/render/fonts';
import { installFeedback } from '@/game/ui/audio';
import { loadSave } from '@/storage/save';
import { C } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** 앱 공통 준비(폰트·저장 데이터·효과음)가 끝난 뒤에 화면을 보여 준다. 라우터 레이아웃과 단일 HTML 빌드가 함께 쓴다. */
export function AppShell({ children }: { children: ReactNode }) {
  const [fontsLoaded] = useFonts({ Jua: Jua_400Regular });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([loadSkiaTypeface(), loadSave()]).finally(() => {
      installFeedback();
      setReady(true);
    });
  }, []);

  const ok = fontsLoaded && ready;
  useEffect(() => {
    if (ok) SplashScreen.hideAsync().catch(() => {});
  }, [ok]);

  if (!ok) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {children}
    </SafeAreaProvider>
  );
}
