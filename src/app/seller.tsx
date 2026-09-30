import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QuickAddForm } from '../components/seller/QuickAddForm';
import { SellerItemRow } from '../components/seller/SellerItemRow';
import { colors } from '../constants/theme';
import { useNow } from '../hooks/useNow';
import { useStoreFoodItems } from '../hooks/useStoreFoodItems';
import { changeStock, createFoodItem, getMyStore, setItemStatus } from '../services/foodItems';
import type { FoodItem } from '../types/models';
import type { NewItemInput, StatusAction } from '../utils/foodItemRules';

const STATUS_ORDER: Record<FoodItem['status'], number> = { selling: 0, paused: 1, sold_out: 2 };

export default function SellerScreen() {
  const insets = useSafeAreaInsets();
  const store = getMyStore();
  const { items, loading } = useStoreFoodItems(store.storeId);
  const now = useNow();

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

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      Alert.alert('알림', e instanceof Error ? e.message : '처리하지 못했어요.');
    }
  }, []);

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
            <View>
              <Text style={styles.title}>{store.storeName}</Text>
              <Text style={styles.sub}>
                지금 판매중 {selling.length}개 상품 · 남은 수량 {sellingStock}개
              </Text>
            </View>
            <QuickAddForm recent={recent} onSubmit={create} />
            <Text style={styles.section}>등록된 상품 {items.length}</Text>
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
  section: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 4 },
  center: { paddingVertical: 40, alignItems: 'center' },
  muted: { color: colors.textMuted },
});
