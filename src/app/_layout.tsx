import { router, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountBar } from '../components/AccountBar';
import { OrderToast } from '../components/order/OrderToast';
import { colors } from '../constants/theme';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { usePushNotifications } from '../hooks/usePushNotifications';

/** AccountBar 높이 (토스트를 바로 아래에 띄우기 위함) */
const ACCOUNT_BAR_HEIGHT = 46;
const AUTH_ROUTES = ['/intro', '/login', '/signup', '/forgot-password', '/profile-setup'];

function Shell() {
  const insets = useSafeAreaInsets();
  const { state } = useAuth();
  const ready = state.status === 'ready';
  const isSeller = ready && state.profile.role === 'seller';
  const uid = ready ? state.user.uid : null;
  usePushNotifications(uid);

  // 사장님은 로그인 직후(홈에 도착했을 때만) 매장 관리 화면에서 시작.
  // 새로고침·딥링크로 다른 화면(/scan, /order/..)에 들어온 경우는 그대로 둔다.
  const pathname = usePathname();
  const landedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isSeller || !uid || landedFor.current === uid) return;
    // 인증 가드가 로그인/가입 화면에서 빠져나갈 때까지 기다렸다가 판단
    if (AUTH_ROUTES.includes(pathname)) return;
    landedFor.current = uid;
    if (pathname === '/') requestAnimationFrame(() => router.replace('/seller'));
  }, [isSeller, uid, pathname]);

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
          {/* 첫 번째 화면 = 로그아웃 상태의 시작 화면. 인트로를 이미 봤으면 intro 가 /login 으로 넘긴다 */}
          <Stack.Screen name="intro" />
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="forgot-password" />
        </Stack.Protected>
        <Stack.Protected guard={state.status === 'needsProfile'}>
          <Stack.Screen name="profile-setup" />
        </Stack.Protected>
        <Stack.Protected guard={ready}>
          <Stack.Screen name="index" />
          <Stack.Screen name="item/[id]" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="order/[id]" options={{ animation: 'fade' }} />
          <Stack.Screen name="orders" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="account" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="payment-complete" />
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
