import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../../constants/theme';
import type { FoodItem, FoodItemStatus } from '../../types/models';
import type { StatusAction } from '../../utils/foodItemRules';
import { discountPercent, formatClock, formatTimeLeft, formatWon } from '../../utils/format';

const STATUS_BADGE: Record<FoodItemStatus, { label: string; fg: string; bg: string }> = {
  selling: { label: '판매중', fg: colors.primary, bg: colors.primarySoft },
  paused: { label: '판매중지', fg: '#b45309', bg: '#fef3c7' },
  sold_out: { label: '품절', fg: colors.accent, bg: colors.accentSoft },
};

interface Props {
  item: FoodItem;
  nowMs: number;
  onStock: (delta: number) => void;
  onStatus: (action: StatusAction) => void;
}

export const SellerItemRow = memo(function SellerItemRow({ item, nowMs, onStock, onStatus }: Props) {
  const endMs = item.pickupEndTime.toMillis();
  const expired = endMs <= nowMs;
  const badge = expired
    ? { label: '마감됨', fg: colors.textMuted, bg: colors.background }
    : STATUS_BADGE[item.status];

  return (
    <View style={[styles.card, (expired || item.status !== 'selling') && styles.dim]}>
      <View style={styles.top}>
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={[styles.badge, { color: badge.fg, backgroundColor: badge.bg }]}>{badge.label}</Text>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          </View>
          <Text style={styles.meta}>
            <Text style={styles.percent}>{discountPercent(item.originalPrice, item.discountPrice)}% </Text>
            {formatWon(item.discountPrice)} · {formatClock(endMs)}까지
            {!expired && ` (${formatTimeLeft(endMs, nowMs)})`}
          </Text>
        </View>

        <View style={styles.stepper}>
          <Pressable
            onPress={() => onStock(-1)}
            disabled={item.stock === 0}
            style={[styles.stepBtn, item.stock === 0 && styles.stepDisabled]}
            hitSlop={4}
            accessibilityLabel={`${item.title} 재고 1 감소`}
          >
            <Text style={styles.stepText}>−1</Text>
          </Pressable>
          <Text style={[styles.stock, item.stock === 0 && { color: colors.accent }]}>{item.stock}</Text>
          <Pressable
            onPress={() => onStock(1)}
            style={styles.stepBtn}
            hitSlop={4}
            accessibilityLabel={`${item.title} 재고 1 증가`}
          >
            <Text style={styles.stepText}>+1</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.actions}>
        {item.status === 'paused' ? (
          <Action label="판매 재개" onPress={() => onStatus('resume')} primary />
        ) : item.status === 'selling' ? (
          <Action label="판매중지" onPress={() => onStatus('pause')} />
        ) : (
          <Text style={styles.hint}>+1 로 재고를 추가하면 판매가 재개돼요</Text>
        )}
        {item.status !== 'sold_out' && <Action label="품절 처리" onPress={() => onStatus('sold_out')} danger />}
      </View>
    </View>
  );
});

function Action({ label, onPress, primary, danger }: { label: string; onPress: () => void; primary?: boolean; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        primary && styles.actionPrimary,
        danger && styles.actionDanger,
        pressed && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.actionText, primary && { color: '#fff' }, danger && { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, gap: 10 },
  dim: { backgroundColor: '#fafafa' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  info: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted },
  percent: { color: colors.accent, fontWeight: '800' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDisabled: { opacity: 0.35 },
  stepText: { fontSize: 15, fontWeight: '800', color: colors.text },
  stock: { minWidth: 32, textAlign: 'center', fontSize: 20, fontWeight: '800', color: colors.text },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  action: {
    flex: 1, paddingVertical: 9, borderRadius: radius.pill, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  actionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionDanger: { borderColor: colors.accentSoft, backgroundColor: colors.accentSoft },
  actionText: { fontSize: 13, fontWeight: '700', color: colors.text },
  hint: { flex: 1, fontSize: 12, color: colors.textMuted },
});
