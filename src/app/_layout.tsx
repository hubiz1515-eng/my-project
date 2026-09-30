import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountBar } from '../components/AccountBar';
import { OrderToast } from '../components/order/OrderToast';
import { colors } from '../constants/theme';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

/** AccountBar 높이 (토스트를 바로 아래에 띄우기 위함) */
const ACCOUNT_BAR_HEIGHT = 46;

function Shell() {
  const insets = useSafeAreaInsets();
  const { state } = useAuth();
  const ready = state.status === 'ready';
  const isSeller = ready && state.profile.role === 'seller';
  const uid = ready ? state.user.uid : null;

  // 사장님은 로그인 직후 매장 관리 화면에서 시작
  const landedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isSeller || !uid || landedFor.current === uid) return;
    landedFor.current = uid;
    requestAnimationFrame(() => router.replace('/seller'));
  }, [isSeller, uid]);

  if (state.status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, paddingTop: ready ? insets.top : 0, backgroundColor: colors.surface }}>
      {ready && <AccountBar />}
      <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
        <Stack.Protected guard={state.status === 'signedOut'}>
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
        </Stack.Protected>
        <Stack.Protected guard={state.status === 'needsProfile'}>
          <Stack.Screen name="profile-setup" />
        </Stack.Protected>
        <Stack.Protected guard={ready}>
          <Stack.Screen name="index" />
          <Stack.Screen name="item/[id]" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="order/[id]" options={{ animation: 'fade' }} />
          <Stack.Screen name="orders" options={{ animation: 'slide_from_right' }} />
          <Stack.Protected guard={isSeller}>
            <Stack.Screen name="seller" />
            <Stack.Screen name="scan" options={{ animation: 'slide_from_bottom' }} />
          </Stack.Protected>
        </Stack.Protected>
      </Stack>
      {ready && <OrderToast top={insets.top + ACCOUNT_BAR_HEIGHT + 6} />}
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Shell />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
