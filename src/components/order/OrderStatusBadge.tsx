import { StyleSheet, Text } from 'react-native';
import { colors } from '../../constants/theme';
import type { OrderStatus } from '../../types/models';

export const ORDER_STATUS: Record<OrderStatus, { label: string; fg: string; bg: string }> = {
  paid: { label: '수락 대기', fg: '#b45309', bg: '#fef3c7' },
  accepted: { label: '픽업 대기', fg: '#1d4ed8', bg: '#dbeafe' },
  picked_up: { label: '픽업 완료', fg: colors.primary, bg: colors.primarySoft },
  canceled: { label: '취소됨', fg: colors.textMuted, bg: colors.background },
  no_show: { label: '노쇼', fg: '#b91c1c', bg: colors.accentSoft },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const s = ORDER_STATUS[status];
  return <Text style={[styles.badge, { color: s.fg, backgroundColor: s.bg }]}>{s.label}</Text>;
}

const styles = StyleSheet.create({
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', alignSelf: 'flex-start' },
});
