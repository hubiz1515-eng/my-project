import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmButton } from '../../components/ConfirmButton';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { OrderStatusBadge } from '../../components/order/OrderStatusBadge';
import { colors, radius } from '../../constants/theme';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { useNow } from '../../hooks/useNow';
import { cancelMyOrder, subscribeOrder } from '../../services/orders';
import { paymentLabel } from '../../services/payments';
import { toUserMessage } from '../../services/types';
import type { Order, OrderStatus } from '../../types/models';
import { formatClock, formatTimeLeft, formatWon } from '../../utils/format';
import { resetTo } from '../../utils/nav';
import { orderLines } from '../../utils/orderRules';
import { buildPickupQr } from '../../utils/pickupQr';
import { noShowNotice } from '../../../shared/policy';

const HERO: Record<OrderStatus, { emoji: string; title: string; desc: string }> = {
  paid: { emoji: '⏳', title: '사장님 수락을 기다리고 있어요', desc: '수락되면 알림으로 알려드려요. 수락 전에는 취소할 수 있어요.' },
  accepted: { emoji: '✅', title: '주문 수락! 픽업하러 오세요', desc: '매장에서 아래 QR 또는 픽업 코드를 보여주세요.' },
  picked_up: { emoji: '🎉', title: '픽업 완료', desc: '음식을 구해주셔서 고마워요. 맛있게 드세요!' },
  canceled: { emoji: '↩️', title: '취소된 주문이에요', desc: '' },
  no_show: { emoji: '⌛', title: '픽업 시간이 지났어요', desc: '' },
};

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'paid', label: '결제 완료' },
  { status: 'accepted', label: '사장님 수락' },
  { status: 'picked_up', label: '픽업 완료' },
];

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const now = useNow(15_000);
  const { data: order, loading, error: loadError } = useLiveQuery<Order | null>((cb, err) => subscribeOrder(id, cb, err), [id], null);
  const [error, setError] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);

  if (!order) {
    return (
      <View style={styles.center}>
        {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.muted}>{loadError ?? '주문을 찾을 수 없어요.'}</Text>}
        {!loading && (
          <Pressable onPress={() => resetTo('/')}>
            <Text style={styles.link}>홈으로</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const hero = HERO[order.status];
  const endMs = order.pickupEndTime.toMillis();
  const active = order.status === 'paid' || order.status === 'accepted';
  const stepIndex = STEPS.findIndex((s) => s.status === order.status);
  const refundText =
    order.refundStatus === 'done'
      ? `${formatWon(order.totalPrice)} 환불이 완료됐어요. (카드사에 따라 반영까지 며칠 걸릴 수 있어요)`
      : order.refundStatus === 'failed'
        ? `환불이 지연되고 있어요. 매장 또는 고객센터에서 확인 후 처리해 드릴게요.`
        : `${formatWon(order.totalPrice)} 환불을 처리하고 있어요.`;
  const cancelDesc = `${
    order.canceledBy === 'seller' ? '매장 사정으로 취소되었어요. ' : order.canceledBy === 'system' ? '매장이 픽업 시간까지 주문을 수락하지 않아 자동으로 취소되었어요. ' : ''
  }${refundText}`;
  const noShowDesc = order.refundAmount
    ? `픽업 마감 시간까지 방문하지 않아 노쇼로 처리되었어요. 노쇼 정책에 따라 ${formatWon(order.refundAmount)} 환불돼요.`
    : '픽업 마감 시간까지 방문하지 않아 노쇼로 처리되었어요. 노쇼 정책에 따라 환불되지 않아요.';
  const heroDesc = order.status === 'canceled' ? cancelDesc : order.status === 'no_show' ? noShowDesc : hero.desc;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => resetTo('/')} hitSlop={10}>
          <Text style={styles.link}>‹ 홈</Text>
        </Pressable>
        <Text style={styles.topTitle}>주문 상세</Text>
        <Pressable onPress={() => router.push('/orders')} hitSlop={10}>
          <Text style={styles.link}>내 주문</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}>
        <View style={styles.card}>
          <Text style={styles.heroEmoji}>{hero.emoji}</Text>
          <Text style={styles.heroTitle}>{hero.title}</Text>
          <Text style={styles.muted}>{heroDesc}</Text>

          {order.status !== 'canceled' && order.status !== 'no_show' && (
            <View style={styles.steps}>
              {STEPS.map((s, i) => (
                <View key={s.status} style={styles.step}>
                  <View style={[styles.dot, i <= stepIndex && styles.dotOn]} />
                  <Text style={[styles.stepText, i <= stepIndex && styles.stepTextOn]}>{s.label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {active && (
          <View style={[styles.card, styles.codeCard]}>
            <Text style={styles.codeLabel}>매장에서 QR 을 보여주세요</Text>
            <View style={styles.qr} accessibilityLabel="픽업 QR 코드">
              <ErrorBoundary fallback={<Text style={styles.muted}>QR 을 표시할 수 없어요. 아래 코드를 보여주세요.</Text>}>
                <QRCode value={buildPickupQr(order.orderId, order.pickupCode)} size={200} backgroundColor="#fff" color={colors.text} />
              </ErrorBoundary>
            </View>
            <Text style={styles.codeLabel}>또는 픽업 코드</Text>
            <Text style={styles.code} accessibilityLabel={`픽업 코드 ${order.pickupCode.split('').join(' ')}`}>
              {order.pickupCode.slice(0, 3)} {order.pickupCode.slice(3)}
            </Text>
            <Text style={styles.codeHint}>
              {formatClock(endMs)}까지 방문 · {formatTimeLeft(endMs, now) ?? '픽업 시간이 지났어요'}
            </Text>
            <Text style={styles.codeHint}>{noShowNotice()}</Text>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.storeName}>{order.storeName}</Text>
            <OrderStatusBadge status={order.status} />
          </View>
          {orderLines(order).map((l) => (
            <View key={l.itemId} style={styles.rowBetween}>
              <Text style={styles.line}>{l.title} × {l.quantity}</Text>
              <Text style={styles.line}>{formatWon(l.unitPrice * l.quantity)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.rowBetween}>
            <Text style={styles.totalLabel}>결제금액</Text>
            <Text style={styles.total}>{formatWon(order.totalPrice)}</Text>
          </View>
          <Text style={styles.muted}>
            {paymentLabel(order.paymentMethod)} · {formatClock(order.paidAt.toMillis())} 결제
          </Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        {order.status === 'paid' && (
          canceling ? (
            <Text style={styles.muted}>취소·환불 처리 중…</Text>
          ) : (
            <ConfirmButton
              label="주문 취소"
              confirmLabel="한 번 더 누르면 취소 · 환불"
              onConfirm={() => {
                setError(null);
                setCanceling(true);
                cancelMyOrder(order.orderId)
                  .catch((e: unknown) => setError(toUserMessage(e, '취소하지 못했어요.')))
                  .finally(() => setCanceling(false));
              }}
            />
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface,
  },
  topTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 8 },
  heroEmoji: { fontSize: 36 },
  heroTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  steps: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  step: { alignItems: 'center', gap: 4, flex: 1 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.primary },
  stepText: { fontSize: 12, color: colors.textMuted },
  stepTextOn: { color: colors.text, fontWeight: '700' },
  codeCard: { alignItems: 'center', borderWidth: 2, borderColor: colors.primary },
  qr: { padding: 12, backgroundColor: '#fff', borderRadius: radius.md, marginVertical: 4 },
  codeLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '700' },
  code: { fontSize: 44, fontWeight: '800', letterSpacing: 6, color: colors.text, fontVariant: ['tabular-nums'] },
  codeHint: { fontSize: 13, color: colors.textMuted },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  storeName: { fontSize: 16, fontWeight: '800', color: colors.text },
  line: { fontSize: 14, color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  totalLabel: { fontSize: 14, color: colors.textMuted },
  total: { fontSize: 18, fontWeight: '800', color: colors.text },
  error: { color: colors.accent, fontSize: 13 },
});
