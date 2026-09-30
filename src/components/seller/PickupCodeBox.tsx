import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from '../../constants/theme';
import { confirmPickupByCode } from '../../services/orders';
import { toUserMessage } from '../../services/types';
import { formatWon } from '../../utils/format';
import { orderSummary } from '../../utils/orderRules';

/** 고객이 보여준 6자리 코드 입력 → 6번째 숫자에서 자동 확인 (3초 픽업) */
export function PickupCodeBox({ ownerId }: { ownerId: string }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const onChange = async (text: string) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length < 6) {
      if (digits.length > 0) setResult(null);
      return;
    }
    setBusy(true);
    try {
      const o = await confirmPickupByCode(ownerId, digits);
      setResult({ ok: true, text: `✅ ${o.customerName}님 · ${orderSummary(o)} · ${formatWon(o.totalPrice)} 픽업 완료` });
      setCode('');
    } catch (e) {
      setResult({ ok: false, text: toUserMessage(e, '확인에 실패했어요.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <Text style={styles.title}>픽업 확인</Text>
        <Pressable onPress={() => router.push('/scan')} style={styles.scanBtn} accessibilityRole="button">
          <Text style={styles.scanText}>📷 QR 스캔</Text>
        </Pressable>
      </View>
      <Text style={styles.sub}>손님 QR 을 스캔하거나 6자리 코드를 입력하면 바로 픽업 완료돼요</Text>
      <View style={styles.inputRow}>
        <TextInput
          value={code}
          onChangeText={onChange}
          placeholder="000000"
          placeholderTextColor={colors.border}
          keyboardType="number-pad"
          maxLength={6}
          editable={!busy}
          style={styles.input}
          accessibilityLabel="픽업 코드 입력"
        />
        {busy && <ActivityIndicator color={colors.primary} />}
      </View>
      {result && <Text style={[styles.result, !result.ok && styles.fail]}>{result.text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  scanBtn: { backgroundColor: colors.text, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  scanText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  sub: { fontSize: 12, color: colors.textMuted },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1, flexBasis: 0, minWidth: 0, borderWidth: 2, borderColor: colors.text, borderRadius: radius.md,
    paddingVertical: 10, textAlign: 'center', fontSize: 28, fontWeight: '800', letterSpacing: 10,
    color: colors.text, fontVariant: ['tabular-nums'],
  },
  result: { fontSize: 13, fontWeight: '700', color: colors.primary },
  fail: { color: colors.accent },
});
