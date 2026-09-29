import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../constants/theme';
import type { FoodItem } from '../types/models';
import { discountPercent, formatClock, formatDistance, formatTimeLeft, formatWon } from '../utils/format';

interface Props {
  item: FoodItem;
  distanceM: number;
  nowMs: number;
  selected: boolean;
  onPress: () => void;
  onReserve: () => void;
}

export const FoodCard = memo(function FoodCard({ item, distanceM, nowMs, selected, onPress, onReserve }: Props) {
  const endMs = item.pickupEndTime.toMillis();
  const timeLeft = formatTimeLeft(endMs, nowMs);
  const percent = discountPercent(item.originalPrice, item.discountPrice);
  const lowStock = item.stock <= 2;
  const urgent = endMs - nowMs < 30 * 60_000;

  return (
    <Pressable onPress={onPress} style={[styles.card, selected && styles.cardSelected]}>
      <View style={styles.thumb}>
        <Text style={styles.thumbText}>{item.storeName.slice(0, 1)}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.store} numberOfLines={1}>{item.storeName}</Text>
          <Text style={styles.distance}>{formatDistance(distanceM)}</Text>
        </View>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.percent}>{percent}%</Text>
          <Text style={styles.price}>{formatWon(item.discountPrice)}</Text>
          <Text style={styles.original}>{formatWon(item.originalPrice)}</Text>
        </View>
        <View style={styles.row}>
          <View style={styles.meta}>
            <Text style={[styles.tag, lowStock && styles.tagDanger]}>{item.stock}개 남음</Text>
            <Text style={[styles.tag, urgent && styles.tagDanger]}>
              {formatClock(endMs)}까지 · {timeLeft}
            </Text>
          </View>
          <Pressable onPress={onReserve} style={styles.button} hitSlop={6}>
            <Text style={styles.buttonText}>픽업 예약</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', gap: 12, padding: 12, backgroundColor: colors.surface,
    borderRadius: radius.lg, borderWidth: 2, borderColor: 'transparent',
  },
  cardSelected: { borderColor: colors.primary },
  thumb: {
    width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  thumbText: { fontSize: 28, fontWeight: '800', color: colors.primary },
  body: { flex: 1, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  store: { flex: 1, fontSize: 12, color: colors.textMuted },
  distance: { fontSize: 12, color: colors.textMuted },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  percent: { fontSize: 16, fontWeight: '800', color: colors.accent },
  price: { fontSize: 16, fontWeight: '800', color: colors.text },
  original: { fontSize: 12, color: colors.textMuted, textDecorationLine: 'line-through' },
  meta: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag: {
    fontSize: 11, color: colors.textMuted, backgroundColor: colors.background,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden',
  },
  tagDanger: { color: colors.accent, backgroundColor: colors.accentSoft },
  button: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
