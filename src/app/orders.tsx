import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OrderStatusBadge } from '../components/order/OrderStatusBadge';
import { colors, radius } from '../constants/theme';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { subscribeMyOrders } from '../services/orders';
import { MOCK_CUSTOMER } from '../services/session';
import type { Order } from '../types/models';
import { formatClock, formatWon } from '../utils/format';
import { goBack } from '../utils/nav';
import { orderSummary } from '../utils/orderRules';

export default function MyOrdersScreen() {
  const insets = useSafeAreaInsets();
  const { data: orders, loading } = useLiveQuery<Order[]>((cb) => subscribeMyOrders(MOCK_CUSTOMER.uid, cb), [], []);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => goBack()} hitSlop={10}>
          <Text style={styles.link}>‹ 뒤로</Text>
        </Pressable>
        <Text style={styles.topTitle}>내 주문</Text>
        <View style={{ width: 40 }} />
      </View>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.orderId}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}
        ListEmptyComponent={
          <View style={styles.center}>
            {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.muted}>아직 주문이 없어요.</Text>}
          </View>
        }
        renderItem={({ item: o }) => (
          <Pressable onPress={() => router.push(`/order/${o.orderId}`)} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.store}>{o.storeName}</Text>
              <OrderStatusBadge status={o.status} />
            </View>
            <Text style={styles.summary} numberOfLines={1}>{orderSummary(o)}</Text>
            <View style={styles.row}>
              <Text style={styles.muted}>
                {formatClock(o.paidAt.toMillis())} 주문 · {formatClock(o.pickupEndTime.toMillis())}까지 픽업
              </Text>
              <Text style={styles.total}>{formatWon(o.totalPrice)}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface,
  },
  topTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  link: { color: colors.primary, fontWeight: '700' },
  center: { paddingVertical: 40, alignItems: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  store: { fontSize: 13, color: colors.textMuted },
  summary: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 12, color: colors.textMuted },
  total: { fontSize: 15, fontWeight: '800', color: colors.text },
});
