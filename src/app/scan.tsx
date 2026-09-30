import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radius } from '../constants/theme';
import { useProfile } from '../contexts/AuthContext';
import { confirmPickupByQr } from '../services/orders';
import { toUserMessage } from '../services/types';
import { formatWon } from '../utils/format';
import { goBack } from '../utils/nav';
import { orderSummary } from '../utils/orderRules';

type Result = { ok: boolean; title: string; body: string };

/** 사장님: 손님 픽업 QR 스캔 → 즉시 픽업 완료 */
export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const profile = useProfile();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const lastData = useRef<string | null>(null);

  const onScanned = async ({ data }: BarcodeScanningResult) => {
    // 같은 QR 이 연속으로 잡히거나 처리 중이면 무시
    if (busy || result || data === lastData.current) return;
    lastData.current = data;
    setBusy(true);
    try {
      const o = await confirmPickupByQr(profile.uid, data);
      setResult({ ok: true, title: '✅ 픽업 완료', body: `${o.customerName}님 · ${orderSummary(o)} · ${formatWon(o.totalPrice)}` });
    } catch (e) {
      setResult({ ok: false, title: '확인 실패', body: toUserMessage(e, '픽업 처리에 실패했어요.') });
    } finally {
      setBusy(false);
    }
  };

  const again = () => {
    lastData.current = null;
    setResult(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => goBack('/seller?tab=orders')} hitSlop={10}>
          <Text style={styles.close}>✕ 닫기</Text>
        </Pressable>
        <Text style={styles.topTitle}>픽업 QR 스캔</Text>
        <View style={{ width: 56 }} />
      </View>

      {!permission ? (
        <View style={styles.center}><ActivityIndicator color="#fff" /></View>
      ) : !permission.granted ? (
        <View style={styles.center}>
          <Text style={styles.msg}>QR 을 스캔하려면 카메라 권한이 필요해요.</Text>
          {permission.canAskAgain ? (
            <PrimaryButton label="카메라 권한 허용" onPress={requestPermission} />
          ) : (
            <Text style={styles.msgSub}>설정에서 카메라 권한을 켜 주세요. 또는 6자리 코드를 직접 입력할 수 있어요.</Text>
          )}
        </View>
      ) : (
        <View style={styles.cameraWrap}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={result ? undefined : onScanned}
          />
          <View style={styles.frame} pointerEvents="none" />
          <Text style={styles.guide}>손님의 픽업 QR 을 네모 안에 맞춰 주세요</Text>
        </View>
      )}

      {(busy || result) && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          {busy ? (
            <View style={styles.row}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.sheetBody}>주문 확인 중…</Text>
            </View>
          ) : result ? (
            <>
              <Text style={[styles.sheetTitle, !result.ok && { color: colors.accent }]}>{result.title}</Text>
              <Text style={styles.sheetBody}>{result.body}</Text>
              <View style={styles.row}>
                <Pressable onPress={() => goBack('/seller?tab=orders')} style={[styles.btn, styles.btnGhost]}>
                  <Text style={styles.btnGhostText}>주문 목록</Text>
                </Pressable>
                <Pressable onPress={again} style={[styles.btn, styles.btnMain]}>
                  <Text style={styles.btnMainText}>다음 손님 스캔</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#000' },
  close: { color: '#fff', fontSize: 14, fontWeight: '700' },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  msg: { color: '#fff', fontSize: 16, textAlign: 'center' },
  msgSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center' },
  cameraWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 240, height: 240, borderWidth: 3, borderColor: '#fff', borderRadius: 20 },
  guide: { position: 'absolute', bottom: 40, color: '#fff', fontSize: 14, fontWeight: '600' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  sheetBody: { fontSize: 14, color: colors.text },
  btn: { flex: 1, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center' },
  btnGhost: { backgroundColor: colors.background },
  btnGhostText: { fontWeight: '700', color: colors.text },
  btnMain: { backgroundColor: colors.primary },
  btnMainText: { fontWeight: '800', color: '#fff' },
});
