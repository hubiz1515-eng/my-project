import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FoodCard } from '../components/FoodCard';
import { PickupMap } from '../components/map/PickupMap';
import { SortChips, type SortKey } from '../components/SortChips';
import { colors } from '../constants/theme';
import { useProfile } from '../contexts/AuthContext';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { useNearbyFoodItems } from '../hooks/useNearbyFoodItems';
import { useNow } from '../hooks/useNow';
import { useUserLocation } from '../hooks/useUserLocation';
import { subscribeMyOrders } from '../services/orders';
import type { MapPin } from '../types/map';
import type { FoodItem, Order } from '../types/models';
import { discountPercent } from '../utils/format';
import { distanceMeters } from '../utils/geo';
import { NEARBY_RADIUS_M, SEOUL_CENTER, SEOUL_RADIUS_M } from '../services/foodItems';
import { isActiveOrder } from '../utils/orderRules';

interface Row {
  item: FoodItem;
  distanceM: number;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { coords: user, source } = useUserLocation();
  const profile = useProfile();
  const [scope, setScope] = useState<'near' | 'seoul'>('near');
  const queryCenter = scope === 'seoul' ? SEOUL_CENTER : user;
  const { items, loading, error } = useNearbyFoodItems(
    queryCenter,
    source !== 'loading',
    scope === 'seoul' ? SEOUL_RADIUS_M : NEARBY_RADIUS_M,
  );
  const now = useNow();
  const [sort, setSort] = useState<SortKey>('distance');
  /** 지도 핀은 매장 단위이므로 선택도 매장 단위 */
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const listRef = useRef<FlatList<Row>>(null);
  const { data: myOrders } = useLiveQuery<Order[]>((cb, err) => subscribeMyOrders(profile.uid, cb, err), [profile.uid], []);
  const activeOrders = myOrders.filter(isActiveOrder).length;

  // 판매 중 · 재고 있음 · 마감 전 상품만 노출하고 정렬
  const rows = useMemo<Row[]>(() => {
    const visible = items
      .filter((i) => i.status === 'selling' && i.stock > 0 && i.pickupEndTime.toMillis() > now && !i.isAddOn)
      .map((item) => ({ item, distanceM: distanceMeters(user, item) }));
    const by: Record<SortKey, (a: Row, b: Row) => number> = {
      distance: (a, b) => a.distanceM - b.distanceM,
      discount: (a, b) =>
        discountPercent(b.item.originalPrice, b.item.discountPrice) -
        discountPercent(a.item.originalPrice, a.item.discountPrice),
      deadline: (a, b) => a.item.pickupEndTime.toMillis() - b.item.pickupEndTime.toMillis(),
    };
    return visible.sort(by[sort]);
  }, [items, now, user, sort]);

  // 매장별로 핀 1개: 최대 할인율 + 상품 수 (한 매장에 상품이 여러 개여도 핀이 겹치지 않게)
  const pins = useMemo<MapPin[]>(() => {
    const byStore = new Map<string, { item: FoodItem; maxPercent: number; count: number }>();
    for (const { item } of rows) {
      const percent = discountPercent(item.originalPrice, item.discountPrice);
      const g = byStore.get(item.storeId);
      if (g) {
        g.count += 1;
        g.maxPercent = Math.max(g.maxPercent, percent);
      } else {
        byStore.set(item.storeId, { item, maxPercent: percent, count: 1 });
      }
    }
    return [...byStore.values()].map(({ item, maxPercent, count }) => ({
      id: item.storeId,
      latitude: item.latitude,
      longitude: item.longitude,
      label: count > 1 ? `-${maxPercent}% · ${count}` : `-${maxPercent}%`,
      title: item.storeName,
    }));
  }, [rows]);


  const select = useCallback(
    (storeId: string) => {
      setSelectedStoreId(storeId);
      const index = rows.findIndex((r) => r.item.storeId === storeId);
      if (index >= 0) listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
    },
    [rows],
  );

  const openItem = useCallback((item: FoodItem) => router.push(`/item/${item.itemId}`), []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>우리 동네 마감 할인</Text>
          <Text style={styles.sub}>
            {scope === 'seoul' ? '서울 전체' : source === 'default' ? '기본 위치(강남역) 기준' : '내 주변'} · 배달비 0원 · 100% 픽업
          </Text>
        </View>
        <Pressable onPress={() => router.push('/orders')} style={styles.ordersBtn} accessibilityLabel="내 주문">
          <Text style={styles.ordersText}>내 주문</Text>
          {activeOrders > 0 && <Text style={styles.ordersBadge}>{activeOrders}</Text>}
        </Pressable>
      </View>

      <View style={styles.map}>
        <PickupMap user={user} pins={pins} selectedId={selectedStoreId} onSelectPin={select} />
        <View style={styles.scope} accessibilityRole="tablist">
          {(['near', 'seoul'] as const).map((k) => (
            <Pressable
              key={k}
              onPress={() => { setScope(k); setSelectedStoreId(null); }}
              accessibilityRole="tab"
              accessibilityState={{ selected: scope === k }}
              style={[styles.scopeBtn, scope === k && styles.scopeOn]}
            >
              <Text style={[styles.scopeText, scope === k && styles.scopeTextOn]}>{k === 'near' ? '내 주변 3km' : '서울 전체'}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.count}>지금 픽업 가능 {rows.length}건</Text>
        <SortChips value={sort} onChange={setSort} />
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{error}</Text>
        </View>
      ) : loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={(r) => r.item.itemId}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          onScrollToIndexFailed={({ index }) => setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true }), 200)}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>{scope === 'seoul' ? '서울에 지금 픽업 가능한 마감 할인이 없어요.' : '반경 3km 안에 지금 픽업 가능한 마감 할인이 없어요.'}</Text>
              {scope === 'near' && (
                <Pressable onPress={() => setScope('seoul')} style={styles.scopeLink}>
                  <Text style={styles.scopeLinkText}>서울 전체 보기</Text>
                </Pressable>
              )}
            </View>
          }
          renderItem={({ item: r }) => (
            <FoodCard
              item={r.item}
              distanceM={r.distanceM}
              nowMs={now}
              selected={r.item.storeId === selectedStoreId}
              onPress={() => openItem(r.item)}
              onReserve={() => openItem(r.item)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.surface },
  ordersBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1, borderColor: colors.border,
  },
  ordersText: { fontSize: 13, fontWeight: '700', color: colors.text },
  ordersBadge: {
    minWidth: 18, textAlign: 'center', fontSize: 11, fontWeight: '800', color: '#fff',
    backgroundColor: colors.accent, borderRadius: 9, overflow: 'hidden', paddingHorizontal: 5,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  map: { height: 260 },
  scope: {
    position: 'absolute', top: 10, left: 10, flexDirection: 'row', padding: 3, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
  },
  scopeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  scopeOn: { backgroundColor: colors.text },
  scopeText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  scopeTextOn: { color: '#fff' },
  scopeLink: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.primarySoft },
  scopeLinkText: { color: colors.primary, fontWeight: '700' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexWrap: 'wrap' },
  count: { fontSize: 14, fontWeight: '700', color: colors.text },
  list: { paddingHorizontal: 16 },
  center: { paddingVertical: 40, alignItems: 'center' },
  muted: { color: colors.textMuted },
});
