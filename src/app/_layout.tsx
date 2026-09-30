import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModeSwitch } from '../components/ModeSwitch';
import { OrderToast } from '../components/order/OrderToast';
import { colors } from '../constants/theme';

/** ModeSwitch 바 높이 (토스트를 바로 아래에 띄우기 위함) */
const MODE_BAR_HEIGHT = 46;

function Shell() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surface }}>
      <ModeSwitch />
      <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
        <Stack.Screen name="item/[id]" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="order/[id]" options={{ animation: 'fade' }} />
        <Stack.Screen name="orders" options={{ animation: 'slide_from_right' }} />
      </Stack>
      <OrderToast top={insets.top + MODE_BAR_HEIGHT + 6} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Shell />
    </SafeAreaProvider>
  );
}
