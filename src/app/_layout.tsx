import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModeSwitch } from '../components/ModeSwitch';
import { colors } from '../constants/theme';

function Shell() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surface }}>
      <ModeSwitch />
      <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
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
