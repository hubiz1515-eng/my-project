import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OrdersPanel } from '../components/seller/OrdersPanel';
import { QuickAddForm } from '../components/seller/QuickAddForm';
import { SellerItemRow } from '../components/seller/SellerItemRow';
import { colors, radius } from '../constants/theme';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { useNow } from '../hooks/useNow';
import { useStoreFoodItems } from '../hooks/useStoreFoodItems';
import { MOCK_STORES } from '../mocks/foodItems';
import { changeStock, createFoodItem, setItemStatus } from '../services/foodItems';
import { subscribeStoreOrders } from '../services/orders';
import { setSellerStore, useSellerStore } from '../services/session';
import type { FoodItem, Order } from '../types/models';
import type { NewItemInput, StatusAction } from '../utils/foodItemRules';

type Tab = 'orders' | 'products';
const STATUS_ORDER: Record<FoodItem['status'], number> = { selling: 0, paused: 1, sold_out: 2 };

export default function SellerScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const store = useSellerStore();
  const { items, loading } = useStoreFoodItems(store.storeId);
  const { data: orders } = useLiveQuery<Order[]>((cb) => subscribeStoreOrders(store.storeId, cb), [store.storeId], []);
  const now = useNow();
  const [tab, setTab] = useState<Tab>(params.tab === 'orders' ? 'orders' : 'products');
  const [itemError, setItemError] = useState<string | null>(null);

  // 알림 탭/모드 전환으로 ?tab=orders 가 들어오면 주문 탭으로
  useEffect(() => {
    if (params.tab === 'orders' || params.tab === 'products') setTab(params.tab);
  }, [params.tab]);

  const pendingCount = orders.filter((o) => o.status === 'paid').length;
  const activeCount = orders.filter((o) => o.status === 'paid' || o.status === 'accepted').length;

  // 판매중 → 판매중지 → 품절 → 마감됨 순, 같은 그룹은 마감 임박순
  const sorted = useMemo(() => {
    const rank = (i: FoodItem) => (i.pickupEndTime.toMillis() <= now ? 3 : STATUS_ORDER[i.status]);
    return [...items].sort(
      (a, b) => rank(a) - rank(b) || a.pickupEndTime.toMillis() - b.pickupEndTime.toMillis(),
    );
  }, [items, now]);

  const selling = items.filter((i) => i.status === 'selling' && i.pickupEndTime.toMillis() > now);
  const sellingStock = selling.reduce((sum, i) => sum + i.stock, 0);

  const recent = useMemo(() => {
    const seen = new Set<string>();
    return [...items]
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
      .filter((i) => (seen.has(i.title) ? false : (seen.add(i.title), true)))
      .slice(0, 3)
      .map(({ title, originalPrice, discountPrice }) => ({ title, originalPrice, discountPrice }));
  }, [items]);

  const create = useCallback(async (input: NewItemInput) => {
    await createFoodItem(input);
  }, []);

  const run = useCallback((fn: () => Promise<unknown>) => {
    setItemError(null);
    fn().catch((e: Error) => setItemError(e.message));
  }, []);

  const header = (
    <View style={styles.headerWrap}>
      <View>
        <Text style={styles.title}>{store.storeName}</Text>
        <Text style={styles.sub}>
          판매중 {selling.length}개 상품 · 남은 수량 {sellingStock}개 · 진행 중 주문 {activeCount}건
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stores}>
        <Text style={styles.storesLabel}>테스트 매장</Text>
        {MOCK_STORES.map((s) => (
          <Pressable
            key={s.storeId}
            onPress={() => setSellerStore(s.storeId)}
            style={[styles.storeChip, s.storeId === store.storeId && styles.storeChipOn]}
          >
            <Text style={[styles.storeChipText, s.storeId === store.storeId && styles.storeChipTextOn]}>{s.storeName}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.tabs}>
        {(['orders', 'products'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
              {t === 'orders' ? '주문 관리' : '상품 관리'}
            </Text>
            {t === 'orders' && pendingCount > 0 && <Text style={styles.tabBadge}>{pendingCount}</Text>}
          </Pressable>
        ))}
      </View>
    </View>
  );

  if (tab === 'orders') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        >
          {header}
          <OrdersPanel storeId={store.storeId} orders={orders} nowMs={now} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={sorted}
        keyExtractor={(i) => i.itemId}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            {header}
            <QuickAddForm recent={recent} onSubmit={create} />
            <Text style={styles.section}>등록된 상품 {items.length}</Text>
            {itemError && <Text style={styles.error}>{itemError}</Text>}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.center}>
            {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.muted}>아직 등록된 상품이 없어요.</Text>}
          </View>
        }
        renderItem={({ item }) => (
          <SellerItemRow
            item={item}
            nowMs={now}
            onStock={(delta) => run(() => changeStock(item.itemId, delta))}
            onStatus={(action: StatusAction) => run(() => setItemStatus(item.itemId, action))}
          />
        )}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16 },
  headerWrap: { gap: 12, marginBottom: 10 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  stores: { gap: 6, alignItems: 'center' },
  storesLabel: { fontSize: 11, color: colors.textMuted, marginRight: 2 },
  storeChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  storeChipOn: { backgroundColor: colors.text, borderColor: colors.text },
  storeChipText: { fontSize: 12, color: colors.text },
  storeChipTextOn: { color: '#fff', fontWeight: '700' },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 4 },
  tab: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: radius.sm },
  tabOn: { backgroundColor: colors.text },
  tabText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  tabTextOn: { color: '#fff' },
  tabBadge: {
    minWidth: 20, textAlign: 'center', fontSize: 12, fontWeight: '800', color: '#fff',
    backgroundColor: colors.accent, borderRadius: 10, overflow: 'hidden', paddingHorizontal: 5,
  },
  section: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 4 },
  error: { color: colors.accent, fontSize: 13 },
  center: { paddingVertical: 40, alignItems: 'center' },
  muted: { color: colors.textMuted },
});
