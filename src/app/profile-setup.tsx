import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { AuthScreen } from '../components/auth/AuthScreen';
import { allConsented, ConsentChecklist, EMPTY_CONSENT } from '../components/auth/ConsentChecklist';
import { Field } from '../components/auth/Field';
import { RolePicker } from '../components/auth/RolePicker';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { authErrorMessage, createProfile, signOut, validateProfile } from '../services/auth';
import type { UserRole } from '../types/models';

/** 계정은 있지만 프로필(users/{uid})이 없을 때 — 가입 도중 앱이 종료된 경우 등 */
export default function ProfileSetupScreen() {
  const { state } = useAuth();
  const [role, setRole] = useState<UserRole>('customer');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(EMPTY_CONSENT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.status !== 'needsProfile') return null;

  const submit = async () => {
    const problem = validateProfile({ name, phone, role }) || (!allConsented(consent) && '필수 약관에 모두 동의해 주세요.');
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await createProfile(state.user.uid, { name, phone, role });
    } catch (e) {
      setError(authErrorMessage(e));
      setBusy(false);
    }
  };

  return (
    <AuthScreen title="프로필을 완성해 주세요" subtitle={state.user.email ?? undefined}>
      <RolePicker value={role} onChange={setRole} />
      <Field label="이름(닉네임)" value={name} onChangeText={setName} placeholder="홍길동" maxLength={20} />
      <Field label="휴대폰 번호" value={phone} onChangeText={setPhone} placeholder="010-1234-5678" keyboardType="phone-pad" maxLength={13} />
      <ConsentChecklist value={consent} onChange={(c) => { setConsent(c); setError(null); }} />
      {error && <Text style={styles.error}>{error}</Text>}
      <PrimaryButton label="시작하기" onPress={submit} busy={busy} />
      <Pressable onPress={() => signOut()} style={styles.linkBtn}>
        <Text style={styles.link}>다른 계정으로 로그인</Text>
      </Pressable>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.accent, fontSize: 13 },
  linkBtn: { alignItems: 'center', padding: 8 },
  link: { color: colors.textMuted, fontSize: 14 },
});
