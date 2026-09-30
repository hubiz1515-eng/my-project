import type { BarcodeScanningResult, CameraMountError } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/PrimaryButton';
import { PickupCodeBox } from '../components/seller/PickupCodeBox';
import { colors, radius } from '../constants/theme';
import { useProfile } from '../contexts/AuthContext';
import {
  CAMERA_UNAVAILABLE_MESSAGE,
  checkCameraAvailability,
  loadCameraModule,
  type CameraUnavailableReason,
} from '../services/camera';
import { confirmPickupByQr } from '../services/orders';
import { toUserMessage } from '../services/types';
import { formatWon } from '../utils/format';
import { goBack } from '../utils/nav';
import { orderSummary } from '../utils/orderRules';

/** 카메라가 켜지지 않을 때 폴백을 보여주기까지 기다리는 시간 */
const CAMERA_START_TIMEOUT_MS = 8000;
/** 카메라는 켜졌지만 인식이 안 될 때 코드 입력을 권하기까지 */
const SCAN_HINT_MS = 12000;

type Result = { ok: boolean; title: string; body: string };

/**
 * 사장님: 손님 픽업 QR 스캔 → 즉시 픽업 완료.
 * 카메라를 쓸 수 없는 모든 경우(모듈 없음·HTTPS 아님·장치 없음·권한 거부·시작 실패)에
 * 6자리 코드 직접 입력으로 대체한다.
 */
export default function ScanScreen() {
  const profile = useProfile();
  const [unavailable, setUnavailable] = useState<CameraUnavailableReason | null | undefined>(undefined);
  const [manualOpen, setManualOpen] = useState(false);
  const openManual = useCallback(() => setManualOpen(true), []);

  useEffect(() => {
    let alive = true;
    checkCameraAvailability().then((r) => alive && setUnavailable(r));
    return () => {
      alive = false;
    };
  }, []);

  const cameraBlocked = unavailable !== undefined && unavailable !== null;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => goBack('/seller?tab=orders')} hitSlop={10} accessibilityRole="button">
          <Text style={styles.close}>✕ 닫기</Text>
        </Pressable>
        <Text style={styles.topTitle}>픽업 확인</Text>
        <View style={{ width: 56 }} />
      </View>

      {unavailable === undefined ? (
        <View style={styles.center}><ActivityIndicator color="#fff" /></View>
      ) : cameraBlocked ? (
        <Notice title="카메라를 사용할 수 없어요" body={`${CAMERA_UNAVAILABLE_MESSAGE[unavailable]}\n아래에서 손님의 6자리 코드를 입력해 주세요.`} />
      ) : (
        <CameraScanner ownerId={profile.uid} onNeedManual={openManual} />
      )}

      <ManualPanel ownerId={profile.uid} open={cameraBlocked || manualOpen} onToggle={() => setManualOpen((v) => !v)} canCollapse={!cameraBlocked} />
    </View>
  );
}

/** 카메라 권한 확인 + 미리보기 + 스캔 결과. loadCameraModule() 이 성공한 경우에만 렌더링 */
function CameraScanner({ ownerId, onNeedManual }: { ownerId: string; onNeedManual: () => void }) {
  const cam = loadCameraModule()!;
  const [permission, requestPermission] = cam.useCameraPermissions();
  const [asked, setAsked] = useState(false);
  const [ready, setReady] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const lastData = useRef<string | null>(null);
  const granted = !!permission?.granted;

  // 카메라가 제때 켜지지 않거나, 켜졌는데 인식이 안 되면 코드 입력을 권한다
  useEffect(() => {
    if (!granted || mountError || result) return;
    const id = setTimeout(() => {
      setSlow(true);
      if (!ready) onNeedManual();
    }, ready ? SCAN_HINT_MS : CAMERA_START_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [granted, ready, mountError, result, onNeedManual]);

  const ask = async () => {
    setAsked(true);
    try {
      const res = await requestPermission();
      if (!res.granted) onNeedManual();
    } catch {
      onNeedManual();
    }
  };

  const onScanned = async ({ data }: BarcodeScanningResult) => {
    // 같은 QR 이 연속으로 잡히거나 처리 중이면 무시
    if (busy || result || data === lastData.current) return;
    lastData.current = data;
    setBusy(true);
    try {
      const o = await confirmPickupByQr(ownerId, data);
      setResult({ ok: true, title: '✅ 픽업 완료', body: `${o.customerName}님 · ${orderSummary(o)} · ${formatWon(o.totalPrice)}` });
    } catch (e) {
      setResult({ ok: false, title: '확인 실패', body: toUserMessage(e, '픽업 처리에 실패했어요.') });
    } finally {
      setBusy(false);
    }
  };

  const onMountError = (e: CameraMountError) => {
    setMountError(e.message || '카메라를 시작하지 못했어요.');
    onNeedManual();
  };

  if (!permission) return <View style={styles.center}><ActivityIndicator color="#fff" /></View>;

  if (!granted) {
    const denied = asked || !permission.canAskAgain;
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>{denied ? '카메라 권한이 거부됐어요.' : 'QR 을 스캔하려면 카메라 권한이 필요해요.'}</Text>
        {permission.canAskAgain ? (
          <PrimaryButton label={denied ? '다시 요청하기' : '카메라 권한 허용'} onPress={ask} />
        ) : (
          <Text style={styles.msgSub}>설정에서 카메라 권한을 켜 주세요.</Text>
        )}
        {denied && <Text style={styles.msgSub}>아래에서 6자리 코드를 입력해도 돼요.</Text>}
      </View>
    );
  }

  if (mountError) return <Notice title="카메라를 시작하지 못했어요" body={`${mountError}\n아래에서 6자리 코드를 입력해 주세요.`} />;

  return (
    <View style={styles.cameraWrap}>
      <cam.CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onCameraReady={() => setReady(true)}
        onMountError={onMountError}
        onBarcodeScanned={result ? undefined : onScanned}
      />
      <View style={[styles.frame, { pointerEvents: 'none' }]} />
      <Text style={styles.guide}>
        {!ready && slow ? '카메라가 켜지지 않나요? 아래에서 코드를 입력하세요' : slow ? 'QR 인식이 안 되면 아래에서 코드를 입력하세요' : '손님의 픽업 QR 을 네모 안에 맞춰 주세요'}
      </Text>

      {(busy || result) && (
        <View style={styles.resultCard}>
          {busy ? (
            <View style={styles.row}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.resultBody}>주문 확인 중…</Text>
            </View>
          ) : result ? (
            <>
              <Text style={[styles.resultTitle, !result.ok && { color: colors.accent }]}>{result.title}</Text>
              <Text style={styles.resultBody}>{result.body}</Text>
              <View style={styles.row}>
                <Pressable onPress={() => goBack('/seller?tab=orders')} style={[styles.btn, styles.btnGhost]}>
                  <Text style={styles.btnGhostText}>주문 목록</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    lastData.current = null;
                    setResult(null);
                  }}
                  style={[styles.btn, styles.btnMain]}
                >
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

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.noticeEmoji}>📷</Text>
      <Text style={styles.msg}>{title}</Text>
      <Text style={styles.msgSub}>{body}</Text>
    </View>
  );
}

/** 하단 코드 직접 입력 패널. 카메라를 못 쓰면 항상 펼쳐짐 */
function ManualPanel({ ownerId, open, onToggle, canCollapse }: { ownerId: string; open: boolean; onToggle: () => void; canCollapse: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.panel, { paddingBottom: insets.bottom + 12 }]}>
        {canCollapse && (
          <Pressable onPress={onToggle} style={styles.panelToggle} accessibilityRole="button">
            <Text style={styles.panelToggleText}>{open ? '▾ 코드 입력 닫기' : '⌨️ QR 대신 코드 직접 입력'}</Text>
          </Pressable>
        )}
        {open && (
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 320 }}>
            <PickupCodeBox ownerId={ownerId} showScanButton={false} autoFocus={canCollapse} />
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#000' },
  close: { color: '#fff', fontSize: 14, fontWeight: '700' },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  noticeEmoji: { fontSize: 36 },
  msg: { color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  msgSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  cameraWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  frame: { width: 240, height: 240, borderWidth: 3, borderColor: '#fff', borderRadius: 20 },
  guide: { position: 'absolute', bottom: 24, left: 16, right: 16, textAlign: 'center', color: '#fff', fontSize: 14, fontWeight: '600' },
  resultCard: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  resultBody: { fontSize: 14, color: colors.text },
  btn: { flex: 1, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center' },
  btnGhost: { backgroundColor: colors.background },
  btnGhostText: { fontWeight: '700', color: colors.text },
  btnMain: { backgroundColor: colors.primary },
  btnMainText: { fontWeight: '800', color: '#fff' },
  panel: { backgroundColor: colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  panelToggle: { alignItems: 'center', paddingVertical: 10 },
  panelToggleText: { fontSize: 14, fontWeight: '700', color: colors.text },
});
