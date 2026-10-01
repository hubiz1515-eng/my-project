import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../constants/theme';
import { completeCheckout } from '../services/checkout';
import { toUserMessage } from '../services/types';
import { resetTo } from '../utils/nav';

/**
 * 웹(특히 모바일 웹) 결제 후 PortOne 이 돌려보내는 주소: /payment-complete?paymentId=..&code=..&message=..
 * code 가 있으면 실패(사용자 취소 포함), 없으면 서버에 결제 확정을 요청한다.
 */
export default function PaymentCompleteScreen() {
  const { paymentId, code, message } = useLocalSearchParams<{ paymentId?: string; code?: string; message?: string }>();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (code) {
      setError(message || '결제가 취소됐어요.');
      return;
    }
    if (!paymentId) {
      setError('결제 정보가 없어요.');
      return;
    }
    completeCheckout(paymentId)
      .then(({ orderId }) => resetTo(`/order/${orderId}`))
      .catch((e) => setError(toUserMessage(e, '결제 확인에 실패했어요. 결제된 금액은 자동으로 환불됩니다.')));
  }, [paymentId, code, message]);

  return (
    <View style={styles.container}>
      {error ? (
        <>
          <Text style={styles.title}>결제를 완료하지 못했어요</Text>
          <Text style={styles.sub}>{error}</Text>
          <Pressable onPress={() => resetTo('/')} style={styles.btn} accessibilityRole="button">
            <Text style={styles.btnText}>홈으로</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.sub}>결제를 확인하고 있어요…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, backgroundColor: colors.background },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  sub: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  btn: { marginTop: 12, backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 24, paddingVertical: 12 },
  btnText: { color: '#fff', fontWeight: '800' },
});
