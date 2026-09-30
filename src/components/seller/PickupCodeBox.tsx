import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from '../../constants/theme';
import { confirmPickupByCode } from '../../services/orders';
import { formatWon } from '../../utils/format';
import { orderSummary } from '../../utils/orderRules';

/** 고객이 보여준 6자리 코드 입력 → 6번째 숫자에서 자동 확인 (3초 픽업) */
export function PickupCodeBox({ storeId }: { storeId: string }) {
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
      const o = await confirmPickupByCode(storeId, digits);
      setResult({ ok: true, text: `✅ ${o.customerName}님 · ${orderSummary(o)} · ${formatWon(o.totalPrice)} 픽업 완료` });
      setCode('');
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : '확인에 실패했어요.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>픽업 코드 확인</Text>
      <Text style={styles.sub}>손님이 보여주는 6자리 숫자를 입력하면 바로 픽업 완료돼요</Text>
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
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
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
