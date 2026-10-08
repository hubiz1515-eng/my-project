import { useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../../constants/theme';
import { hasPlaceholders, LEGAL_DOCS, type LegalDocKey } from '../../content/legal/documents';
import { useAuth } from '../../contexts/AuthContext';
import { outdatedDocs } from '../../services/consent';
import { goBack } from '../../utils/nav';

/** 약관·개인정보처리방침·위치기반서비스 이용약관 전문. 로그인 여부와 관계없이 열람 가능. */
export default function LegalDocScreen() {
  const insets = useSafeAreaInsets();
  const { doc: key } = useLocalSearchParams<{ doc: string }>();
  const doc = Object.hasOwn(LEGAL_DOCS, key) ? LEGAL_DOCS[key as LegalDocKey] : undefined;
  // 로그인·동의 완료 상태에서는 루트 레이아웃(계정 바)이 상단 안전 영역을 이미 차지한다
  const { state } = useAuth();
  const shellPadsTop = state.status === 'ready' && outdatedDocs(state.profile).length === 0;

  return (
    <View style={[styles.container, { paddingTop: shellPadsTop ? 0 : insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => goBack()} hitSlop={10} accessibilityRole="button">
          <Text style={styles.link}>‹ 뒤로</Text>
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>{doc?.title ?? '문서'}</Text>
        <View style={{ width: 40 }} />
      </View>
      {!doc ? (
        <Text style={styles.missing}>문서를 찾을 수 없어요.</Text>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
          {hasPlaceholders(doc) && (
            <View style={styles.draft}>
              <Text style={styles.draftText}>⚠️ 초안입니다 — 대괄호([…]) 항목은 출시 전에 실제 정보로 채워야 해요.</Text>
            </View>
          )}
          <Text style={styles.title}>{doc.title}</Text>
          <Text style={styles.meta}>시행일 {doc.version}</Text>
          {doc.sections.map((s) => (
            <View key={s.heading} style={styles.section}>
              <Text style={styles.heading}>{s.heading}</Text>
              <Text style={styles.body}>{s.body}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  link: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  topTitle: { fontSize: 16, fontWeight: '800', color: colors.text, flexShrink: 1 },
  content: { padding: 20, gap: 16, width: '100%', maxWidth: 720, alignSelf: 'center' },
  draft: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: 12 },
  draftText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: -10 },
  section: { gap: 6 },
  heading: { fontSize: 15, fontWeight: '800', color: colors.text },
  body: { fontSize: 14, lineHeight: 22, color: colors.text },
  missing: { padding: 24, textAlign: 'center', color: colors.textMuted },
});
