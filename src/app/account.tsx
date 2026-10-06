import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field } from '../components/auth/Field';
import { ConfirmButton } from '../components/ConfirmButton';
import { colors, radius } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { authErrorMessage, deleteMyAccount, sendPasswordReset, signOut } from '../services/auth';
import { goBack } from '../utils/nav';

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { state } = useAuth();
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // 탈퇴 직후 프로필이 사라지면 인증 가드가 이 화면을 내린다 — 그 사이엔 아무것도 그리지 않음
  if (state.status !== 'ready') return null;
  const { profile, user } = state;
  const seller = profile.role === 'seller';

  const sendReset = async () => {
    if (!user.email) return;
    setResetMsg(null);
    try {
      await sendPasswordReset(user.email);
      setResetMsg(`${user.email} 로 비밀번호 재설정 메일을 보냈어요.`);
    } catch (e) {
      setResetMsg(authErrorMessage(e));
    }
  };

  const remove = async () => {
    if (!password) return setDeleteError('비밀번호를 입력해 주세요.');
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteMyAccount(password);
      // 이동은 인증 가드가 처리 (로그아웃 상태 → 로그인 화면)
    } catch (e) {
      setDeleteError(authErrorMessage(e));
      setDeleting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <Pressable onPress={() => goBack()} hitSlop={10}>
          <Text style={styles.link}>‹ 뒤로</Text>
        </Pressable>
        <Text style={styles.topTitle}>내 계정</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
        <View style={styles.card}>
          <Row label="이름" value={profile.name} />
          <Row label="이메일" value={user.email ?? '-'} />
          <Row label="휴대폰" value={profile.phone} />
          <Row label="회원 유형" value={seller ? '사장님' : '소비자'} />
        </View>

        <View style={styles.card}>
          <Pressable onPress={sendReset} style={styles.action} accessibilityRole="button">
            <Text style={styles.actionText}>비밀번호 변경 메일 받기</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          {resetMsg && <Text style={styles.note}>{resetMsg}</Text>}
          <View style={styles.divider} />
          <Pressable onPress={() => signOut()} style={styles.action} accessibilityRole="button">
            <Text style={styles.actionText}>로그아웃</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        <View style={[styles.card, styles.danger]}>
          <Text style={styles.dangerTitle}>회원 탈퇴</Text>
          <Text style={styles.body}>
            • 계정과 프로필 정보가 삭제되며 되돌릴 수 없어요.{'\n'}
            {seller && '• 매장과 등록한 상품이 모두 삭제되어 지도·목록에서 사라져요.\n'}
            • 진행 중인 주문(수락 대기·픽업 대기)이 있으면 먼저 {seller ? '픽업 완료 또는 거절' : '픽업하거나 취소'}해 주세요.{'\n'}
            • 결제·주문 기록은 전자상거래법에 따라 5년간 보관 후 파기돼요.
          </Text>
          <Field
            label="비밀번호 확인"
            value={password}
            onChangeText={setPassword}
            placeholder="현재 비밀번호"
            secureTextEntry
            autoComplete="password"
            editable={!deleting}
          />
          {deleteError && <Text style={styles.error}>{deleteError}</Text>}
          {deleting ? (
            <ActivityIndicator color={colors.accent} style={{ paddingVertical: 10 }} />
          ) : (
            <ConfirmButton label="회원 탈퇴" confirmLabel="한 번 더 누르면 탈퇴돼요" onConfirm={remove} />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  link: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  topTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  content: { padding: 16, gap: 12, width: '100%', maxWidth: 560, alignSelf: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontSize: 14, color: colors.textMuted },
  rowValue: { fontSize: 14, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  action: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  actionText: { fontSize: 15, color: colors.text, fontWeight: '600' },
  chevron: { fontSize: 20, color: colors.textMuted },
  divider: { height: 1, backgroundColor: colors.border },
  note: { fontSize: 13, color: colors.primary },
  danger: { borderWidth: 1, borderColor: colors.accentSoft },
  dangerTitle: { fontSize: 16, fontWeight: '800', color: colors.accent },
  body: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },
  error: { color: colors.accent, fontSize: 13 },
});
