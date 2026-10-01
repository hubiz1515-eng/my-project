import { useEffect, useRef } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/theme';
import type { PortOnePaymentProps } from './PortOnePayment';

/**
 * 웹: PortOne 브라우저 SDK. 데스크톱은 팝업/iframe 으로 결과가 바로 오고,
 * 모바일 웹은 PG 페이지로 이동했다가 redirectUrl(/payment-complete)로 돌아온다.
 */
export function PortOnePayment({ request, onPaid, onFailed, onClose, confirming }: PortOnePaymentProps) {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const { requestPayment } = await import('@portone/browser-sdk/v2');
        const res = await requestPayment(request);
        if (!res) return; // 리디렉션 방식 → /payment-complete 에서 이어서 처리
        if (res.code != null) onFailed(res.message || '결제가 취소됐어요.');
        else onPaid(res.paymentId);
      } catch (e) {
        onFailed(e instanceof Error ? e.message : '결제창을 열지 못했어요.');
      }
    })();
  }, [request, onPaid, onFailed]);

  return (
    <Modal visible transparent onRequestClose={() => !confirming && onClose()}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.text}>{confirming ? '결제 확인 중…' : '결제창에서 결제를 진행해 주세요'}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  box: { backgroundColor: colors.surface, borderRadius: 16, padding: 24, gap: 12, alignItems: 'center' },
  text: { fontSize: 15, color: colors.text },
});
