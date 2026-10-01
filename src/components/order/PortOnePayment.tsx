import type { PaymentRequest } from '@portone/browser-sdk/v2';
import { Payment } from '@portone/react-native-sdk';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/theme';

export interface PortOnePaymentProps {
  request: PaymentRequest;
  /** 결제창 완료(성공). 서버 검증이 끝날 때까지 로딩 표시 */
  onPaid: (paymentId: string) => void;
  onFailed: (message: string) => void;
  onClose: () => void;
  confirming: boolean;
}

/** 네이티브: PortOne React Native SDK(WebView)로 결제창 표시 */
export function PortOnePayment({ request, onPaid, onFailed, onClose, confirming }: PortOnePaymentProps) {
  return (
    <Modal visible animationType="slide" onRequestClose={() => !confirming && onClose()}>
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} disabled={confirming} hitSlop={10} accessibilityRole="button">
            <Text style={styles.close}>✕ 닫기</Text>
          </Pressable>
          <Text style={styles.title}>결제</Text>
          <View style={{ width: 56 }} />
        </View>
        <Payment
          request={request}
          onComplete={(res) => {
            // V2: code 가 있으면 실패(사용자 취소 포함)
            if (res.code != null) onFailed(res.message || '결제가 취소됐어요.');
            else onPaid(res.paymentId);
          }}
          onError={(e) => onFailed(e.message || '결제창을 열지 못했어요.')}
        />
        {confirming && (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.overlayText}>결제 확인 중…</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  close: { fontSize: 14, fontWeight: '700', color: colors.text },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.92)' },
  overlayText: { fontSize: 15, color: colors.text },
});
