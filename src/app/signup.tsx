import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AuthScreen } from '../components/auth/AuthScreen';
import { Field } from '../components/auth/Field';
import { RolePicker } from '../components/auth/RolePicker';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { authErrorMessage, validateProfile } from '../services/auth';
import type { UserRole } from '../types/models';

export default function SignupScreen() {
  const { signUpWithProfile } = useAuth();
  const [role, setRole] = useState<UserRole>('customer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const problem =
      (!/^\S+@\S+\.\S+$/.test(email.trim()) && '이메일 형식이 올바르지 않아요.') ||
      (password.length < 6 && '비밀번호는 6자 이상이어야 해요.') ||
      validateProfile({ name, phone, role });
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await signUpWithProfile(email, password, { name, phone, role });
    } catch (e) {
      setError(authErrorMessage(e));
      setBusy(false);
    }
  };

  return (
    <AuthScreen title="회원가입" subtitle="가입 후에는 역할을 바꿀 수 없어요.">
      <RolePicker value={role} onChange={setRole} />
      <Field label="이메일" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field label="비밀번호" value={password} onChangeText={setPassword} placeholder="6자 이상" secureTextEntry autoComplete="new-password" />
      <Field label={role === 'seller' ? '대표자 이름' : '이름(닉네임)'} value={name} onChangeText={setName} placeholder="홍길동" maxLength={20} />
      <Field label="휴대폰 번호" value={phone} onChangeText={setPhone} placeholder="010-1234-5678" keyboardType="phone-pad" autoComplete="tel" maxLength={13} />
      {error && <Text style={styles.error}>{error}</Text>}
      <PrimaryButton label={role === 'seller' ? '사장님으로 가입하기' : '가입하기'} onPress={submit} busy={busy} />
      <Link href="/login" replace style={styles.link}>
        이미 계정이 있나요? <Text style={styles.linkStrong}>로그인</Text>
      </Link>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.accent, fontSize: 13 },
  link: { textAlign: 'center', color: colors.textMuted, fontSize: 14, paddingVertical: 8 },
  linkStrong: { color: colors.primary, fontWeight: '800' },
});
