import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../constants/theme';
import { usingEmulator } from '../../config/firebaseConfig';
import { APP_LOGO, APP_TAGLINE } from '../../constants/brand';

/** 로그인/가입 화면 공통 틀 */
export function AuthScreen({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
      >
        <View style={styles.brand}>
          <Text style={styles.logo}>{APP_LOGO}</Text>
          <Text style={styles.tagline}>{APP_TAGLINE}</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        <View style={styles.form}>{children}</View>
        {usingEmulator && <Text style={styles.emu}>⚙️ Firebase 에뮬레이터에 연결됨</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, gap: 8, width: '100%', maxWidth: 480, alignSelf: 'center' },
  brand: { alignItems: 'center', marginBottom: 24, gap: 4 },
  logo: { fontSize: 28, fontWeight: '800', color: colors.text },
  tagline: { fontSize: 13, color: colors.textMuted },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted },
  form: { gap: 12, marginTop: 12 },
  emu: { textAlign: 'center', fontSize: 11, color: colors.textMuted, marginTop: 16 },
});
