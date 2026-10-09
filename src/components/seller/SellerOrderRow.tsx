import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../../constants/theme';
import type { Order } from '../../types/models';
import { formatClock, formatTimeLeft, formatWon } from '../../utils/format';
import { orderLines } from '../../utils/orderRules';
import { ConfirmButton } from '../ConfirmButton';
import { OrderStatusBadge } from '../order/OrderStatusBadge';

const CANCELED_BY = { customer: '고객 취소', seller: '매장 거절', system: '미수락 자동 취소' } as const;

interface Props {
  order: Order;
  nowMs: number;
  onAccept: () => void;
  onReject: () => void;
}

export const SellerOrderRow = memo(function SellerOrderRow({ order: o, nowMs, onAccept, onReject }: Props) {
  const endMs = o.pickupEndTime.toMillis();
  const isNew = o.status === 'paid';
  const late = (o.status === 'paid' || o.status === 'accepted') && endMs <= nowMs;

  return (
    <View style={[styles.card, isNew && styles.newCard]}>
      <View style={styles.row}>
        <View style={styles.headLeft}>
          <OrderStatusBadge status={o.status} />
          <Text style={styles.customer}>{o.customerName}님</Text>
        </View>
        <Text style={styles.time}>{formatClock(o.paidAt.toMillis())} 주문</Text>
      </View>

      {orderLines(o).map((l) => (
        <Text key={l.itemId} style={styles.line}>
          {l.title} <Text style={styles.qty}>×{l.quantity}</Text>
        </Text>
      ))}

      <View style={styles.row}>
        <Text style={[styles.pickup, late && { color: colors.accent }]}>
          {o.status === 'picked_up' && o.pickedUpAt
            ? `${formatClock(o.pickedUpAt.toMillis())} 픽업 완료`
            : o.status === 'canceled'
              ? `${CANCELED_BY[o.canceledBy ?? 'customer']} · ${o.refundStatus === 'done' ? '환불 완료' : o.refundStatus === 'failed' ? '환불 실패(확인 필요)' : '환불 처리 중'}`
              : o.status === 'no_show'
                ? `노쇼 · 미방문 (${o.refundAmount ? `${formatWon(o.refundAmount)} 환불` : '환불 없음'})`
              : late
                ? `픽업 시간 지남 (${formatClock(endMs)})`
                : `${formatClock(endMs)}까지 픽업 · ${formatTimeLeft(endMs, nowMs)}`}
        </Text>
        <Text style={styles.total}>{formatWon(o.totalPrice)}</Text>
      </View>

      {o.status === 'paid' && (
        <View style={styles.actions}>
          <ConfirmButton label="거절" confirmLabel="거절·환불 확인" onConfirm={onReject} style={{ flex: 1 }} />
          <Pressable onPress={onAccept} style={({ pressed }) => [styles.accept, pressed && { opacity: 0.7 }]}>
            <Text style={styles.acceptText}>주문 수락</Text>
          </Pressable>
        </View>
      )}
      {o.status === 'accepted' && (
        <View style={styles.actions}>
          <Text style={styles.waiting}>손님 방문 시 픽업 코드를 입력해 주세요</Text>
          <ConfirmButton label="주문 취소" confirmLabel="취소·환불 확인" onConfirm={onReject} />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 6 },
  newCard: { borderWidth: 2, borderColor: '#f59e0b' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  customer: { fontSize: 14, fontWeight: '700', color: colors.text },
  time: { fontSize: 12, color: colors.textMuted },
  line: { fontSize: 16, fontWeight: '700', color: colors.text },
  qty: { color: colors.accent },
  pickup: { flex: 1, fontSize: 12, color: colors.textMuted },
  total: { fontSize: 15, fontWeight: '800', color: colors.text },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  accept: { flex: 2, backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 11, alignItems: 'center' },
  acceptText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  waiting: { flex: 1, fontSize: 12, color: '#1d4ed8' },
});
