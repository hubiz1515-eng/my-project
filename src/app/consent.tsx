import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { AuthScreen } from '../components/auth/AuthScreen';
import { allConsented, ConsentChecklist, EMPTY_CONSENT } from '../components/auth/ConsentChecklist';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../constants/theme';
import { LEGAL_DOCS } from '../content/legal/documents';
import { useAuth } from '../contexts/AuthContext';
import { authErrorMessage, signOut } from '../services/auth';
import { acceptCurrentAgreements, outdatedDocs } from '../services/consent';

/**
 * 재동의: 동의 기록이 없는 기존 회원(동의 기능 이전 가입) 또는 약관 개정 후 처음 접속한 회원.
 * 동의해야 서비스를 계속 이용할 수 있다 (루트 레이아웃의 가드).
 */
export default function ConsentScreen() {
  const { state } = useAuth();
  const [consent, setConsent] = useState(EMPTY_CONSENT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.status !== 'ready') return null;
  const changed = outdatedDocs(state.profile);
  const isUpdate = !!state.profile.agreements;

  const submit = async () => {
    if (!allConsented(consent)) return setError('필수 항목에 모두 동의해 주세요.');
    setBusy(true);
    setError(null);
    try {
      await acceptCurrentAgreements(state.user.uid);
      // 동의 기록이 반영되면 가드가 홈으로 보낸다
    } catch (e) {
      setError(authErrorMessage(e));
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      title={isUpdate ? '약관이 변경되었어요' : '약관 동의가 필요해요'}
      subtitle={
        isUpdate
          ? `변경된 문서: ${changed.map((k) => LEGAL_DOCS[k].title).join(', ')} — 내용을 확인하고 다시 동의해 주세요.`
          : '서비스를 계속 이용하려면 아래 필수 항목에 동의해 주세요.'
      }
    >
      <ConsentChecklist value={consent} onChange={(c) => { setConsent(c); setError(null); }} />
      {error && <Text style={styles.error}>{error}</Text>}
      <PrimaryButton label="동의하고 계속하기" onPress={submit} busy={busy} disabled={!allConsented(consent)} />
      <Pressable onPress={() => signOut()} style={styles.linkBtn} accessibilityRole="button">
        <Text style={styles.link}>동의하지 않고 로그아웃</Text>
      </Pressable>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.accent, fontSize: 13 },
  linkBtn: { alignItems: 'center', padding: 8 },
  link: { color: colors.textMuted, fontSize: 14 },
});
