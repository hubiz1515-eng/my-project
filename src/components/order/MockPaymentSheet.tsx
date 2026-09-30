import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../../constants/theme';
import { approveMockPayment, PAYMENT_METHODS } from '../../services/payments';
import type { PaymentMethod } from '../../types/models';
import { formatWon } from '../../utils/format';

type Phase = 'confirm' | 'approving' | 'ordering';

interface Props {
  visible: boolean;
  amount: number;
  method: PaymentMethod;
  orderName: string;
  onClose: () => void;
  /** 결제 승인 후 호출. 여기서 주문을 생성하고, 실패 시 throw → 시트가 닫힌다. */
  onPaid: (paymentId: string) => Promise<void>;
}

/** PortOne 결제창 자리를 대신하는 테스트 결제 시트 */
export function MockPaymentSheet({ visible, amount, method, orderName, onClose, onPaid }: Props) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('confirm');
  const pm = PAYMENT_METHODS.find((p) => p.key === method)!;
  const busy = phase !== 'confirm';

  const approve = async () => {
    setPhase('approving');
    try {
      const { paymentId } = await approveMockPayment({ amount, method, orderName });
      setPhase('ordering');
      await onPaid(paymentId);
    } catch {
      // 오류 메시지는 호출한 화면이 표시
      onClose();
    } finally {
      setPhase('confirm');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !busy && onClose()}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.brand, { backgroundColor: pm.color }]}>
            <Text style={[styles.brandText, { color: pm.fg }]}>{pm.label}</Text>
            <Text style={[styles.test, { color: pm.fg }]}>TEST</Text>
          </View>
          <Text style={styles.orderName} numberOfLines={2}>{orderName}</Text>
          <Text style={styles.amount}>{formatWon(amount)}</Text>
          <Text style={styles.note}>테스트 결제입니다. 실제로 돈이 빠져나가지 않아요.</Text>

          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.busyText}>{phase === 'approving' ? '결제 승인 중…' : '주문 접수 중…'}</Text>
            </View>
          ) : (
            <View style={styles.actions}>
              <Pressable onPress={onClose} style={[styles.btn, styles.cancel]}>
                <Text style={styles.cancelText}>취소</Text>
              </Pressable>
              <Pressable onPress={approve} style={[styles.btn, { backgroundColor: pm.color, flex: 2 }]}>
                <Text style={[styles.payText, { color: pm.fg }]}>{formatWon(amount)} 결제하기</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, gap: 10, width: '100%', maxWidth: 560, alignSelf: 'center',
  },
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10 },
  brandText: { fontSize: 16, fontWeight: '800' },
  test: { fontSize: 11, fontWeight: '800', opacity: 0.8 },
  orderName: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  amount: { fontSize: 28, fontWeight: '800', color: colors.text },
  note: { fontSize: 12, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  btn: { flex: 1, paddingVertical: 15, borderRadius: radius.md, alignItems: 'center' },
  cancel: { backgroundColor: colors.background },
  cancelText: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  payText: { fontSize: 15, fontWeight: '800' },
  busy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18 },
  busyText: { fontSize: 14, color: colors.text },
});
