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
import { sampleItems } from '../components/seller/sampleItems';
import { SellerItemRow } from '../components/seller/SellerItemRow';
import { StoreSetupForm } from '../components/seller/StoreSetupForm';
import { colors, radius } from '../constants/theme';
import { useProfile } from '../contexts/AuthContext';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { useNow } from '../hooks/useNow';
import { changeStock, createFoodItem, setItemStatus, subscribeStoreFoodItems } from '../services/foodItems';
import { subscribeStoreOrders } from '../services/orders';
import { subscribeStore } from '../services/stores';
import { toUserMessage } from '../services/types';
import type { FoodItem, Order, Store } from '../types/models';
import type { NewItemInput, StatusAction } from '../utils/foodItemRules';

type Tab = 'orders' | 'products';
const STATUS_ORDER: Record<FoodItem['status'], number> = { selling: 0, paused: 1, sold_out: 2 };

export default function SellerScreen() {
  const insets = useSafeAreaInsets();
  const profile = useProfile();
  const { data: store, loading, error } = useLiveQuery<Store | null>(
    (cb, err) => subscribeStore(profile.uid, cb, err),
    [profile.uid],
    null,
  );

  if (!store) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <StoreSetupForm ownerId={profile.uid} />
        )}
      </ScrollView>
    );
  }
  return <StoreManager store={store} />;
}

function StoreManager({ store }: { store: Store }) {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { data: items, loading } = useLiveQuery<FoodItem[]>(
    (cb, err) => subscribeStoreFoodItems(store.storeId, cb, err),
    [store.storeId],
    [],
  );
  const { data: orders, error: ordersError } = useLiveQuery<Order[]>(
    (cb, err) => subscribeStoreOrders(store.ownerId, cb, err),
    [store.ownerId],
    [],
  );
  const now = useNow();
  const [tab, setTab] = useState<Tab>(params.tab === 'orders' ? 'orders' : 'products');
  const [itemError, setItemError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

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

  const create = useCallback(
    async (input: NewItemInput) => {
      try {
        await createFoodItem(store, input);
      } catch (e) {
        throw new Error(toUserMessage(e, '등록에 실패했어요.'));
      }
    },
    [store],
  );

  const run = useCallback((fn: () => Promise<unknown>) => {
    setItemError(null);
    fn().catch((e: unknown) => setItemError(toUserMessage(e)));
  }, []);

  const seed = async () => {
    setSeeding(true);
    setItemError(null);
    try {
      for (const input of sampleItems(Date.now())) await createFoodItem(store, input);
    } catch (e) {
      setItemError(toUserMessage(e));
    } finally {
      setSeeding(false);
    }
  };

  const header = (
    <View style={styles.headerWrap}>
      <View>
        <Text style={styles.title}>{store.storeName}</Text>
        <Text style={styles.sub} numberOfLines={1}>{store.address}</Text>
        <Text style={styles.sub}>
          판매중 {selling.length}개 상품 · 남은 수량 {sellingStock}개 · 진행 중 주문 {activeCount}건
        </Text>
      </View>
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
          {ordersError && <Text style={styles.error}>{ordersError}</Text>}
          <OrdersPanel ownerId={store.ownerId} orders={orders} nowMs={now} />
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
            {loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Text style={styles.muted}>아직 등록된 상품이 없어요.</Text>
                <Pressable onPress={seed} disabled={seeding} style={styles.seedBtn}>
                  <Text style={styles.seedText}>{seeding ? '등록 중…' : '🧪 샘플 상품 3개 등록 (테스트용)'}</Text>
                </Pressable>
              </>
            )}
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
  center: { paddingVertical: 40, alignItems: 'center', gap: 12 },
  muted: { color: colors.textMuted },
  seedBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  seedText: { color: colors.primary, fontWeight: '700' },
});
