import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AuthScreen } from '../components/auth/AuthScreen';
import { Field } from '../components/auth/Field';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../constants/theme';
import { authErrorMessage, sendPasswordReset } from '../services/auth';

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim()) return setError('가입한 이메일을 입력해 주세요.');
    setBusy(true);
    setError(null);
    try {
      await sendPasswordReset(email);
      setSentTo(email.trim());
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen title="비밀번호 찾기" subtitle="가입한 이메일로 비밀번호 재설정 링크를 보내드려요.">
      <Field
        label="이메일"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        returnKeyType="send"
        onSubmitEditing={submit}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      {sentTo && (
        // 가입 여부를 노출하지 않도록 항상 같은 안내
        <Text style={styles.done}>
          {sentTo} 로 가입된 계정이 있다면 재설정 메일을 보냈어요. 메일함(스팸함 포함)을 확인해 주세요.
        </Text>
      )}
      <PrimaryButton label={sentTo ? '다시 보내기' : '재설정 메일 보내기'} onPress={submit} busy={busy} />
      <Link href="/login" replace style={styles.link}>
        <Text style={styles.linkStrong}>로그인으로 돌아가기</Text>
      </Link>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.accent, fontSize: 13 },
  done: { color: colors.primary, fontSize: 13, lineHeight: 19 },
  link: { textAlign: 'center', color: colors.textMuted, fontSize: 14, paddingVertical: 8 },
  linkStrong: { color: colors.primary, fontWeight: '800' },
});
