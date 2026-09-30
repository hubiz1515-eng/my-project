import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, type TextInput } from 'react-native';
import { AuthScreen } from '../components/auth/AuthScreen';
import { Field } from '../components/auth/Field';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../constants/theme';
import { authErrorMessage, signIn } from '../services/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pwRef = useRef<TextInput>(null);

  const submit = async () => {
    if (!email.trim() || !password) return setError('이메일과 비밀번호를 입력해 주세요.');
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      // 이동은 루트 레이아웃의 인증 가드가 처리
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen title="로그인">
      <Field
        label="이메일"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        returnKeyType="next"
        onSubmitEditing={() => pwRef.current?.focus()}
      />
      <Field
        ref={pwRef}
        label="비밀번호"
        value={password}
        onChangeText={setPassword}
        placeholder="6자 이상"
        secureTextEntry
        autoComplete="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <PrimaryButton label="로그인" onPress={submit} busy={busy} />
      <Link href="/signup" replace style={styles.link}>
        처음이신가요? <Text style={styles.linkStrong}>회원가입</Text>
      </Link>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.accent, fontSize: 13 },
  link: { textAlign: 'center', color: colors.textMuted, fontSize: 14, paddingVertical: 8 },
  linkStrong: { color: colors.primary, fontWeight: '800' },
});
