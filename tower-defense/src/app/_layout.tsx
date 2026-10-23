import { Jua_400Regular } from '@expo-google-fonts/jua';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { loadSkiaTypeface } from '@/game/render/fonts';
import { installFeedback } from '@/game/ui/audio';
import { loadSave } from '@/storage/save';
import { C } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
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
      <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: C.bg } }} />
    </SafeAreaProvider>
  );
}
