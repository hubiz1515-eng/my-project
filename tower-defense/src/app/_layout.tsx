import { Stack } from 'expo-router';
import { AppShell } from '@/ui/AppShell';
import { C } from '@/ui/theme';

export default function RootLayout() {
  return (
    <AppShell>
      <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: C.bg } }} />
    </AppShell>
  );
}
