import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FoodCard } from '../components/FoodCard';
import { PickupMap } from '../components/map/PickupMap';
import { SortChips, type SortKey } from '../components/SortChips';
import { colors } from '../constants/theme';
import { useNearbyFoodItems } from '../hooks/useNearbyFoodItems';
import { useNow } from '../hooks/useNow';
import { useUserLocation } from '../hooks/useUserLocation';
import type { MapPin } from '../types/map';
import type { FoodItem } from '../types/models';
import { discountPercent } from '../utils/format';
import { distanceMeters } from '../utils/geo';

interface Row {
  item: FoodItem;
  distanceM: number;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { coords: user, source } = useUserLocation();
  const { items, loading } = useNearbyFoodItems(user, source !== 'loading');
  const now = useNow();
  const [sort, setSort] = useState<SortKey>('distance');
  /** 지도 핀은 매장 단위이므로 선택도 매장 단위 */
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const listRef = useRef<FlatList<Row>>(null);

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
    }));
  }, [rows]);

  const selected = rows.find((r) => r.item.storeId === selectedStoreId)?.item;
  const center = selected ? { latitude: selected.latitude, longitude: selected.longitude } : user;

  const select = useCallback(
    (storeId: string) => {
      setSelectedStoreId(storeId);
      const index = rows.findIndex((r) => r.item.storeId === storeId);
      if (index >= 0) listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
    },
    [rows],
  );

  const reserve = useCallback((item: FoodItem) => {
    Alert.alert('픽업 예약', `${item.title}\n결제와 QR 픽업은 4단계에서 연결됩니다.`);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>우리 동네 마감 할인</Text>
          <Text style={styles.sub}>
            {source === 'default' ? '기본 위치(강남역) 기준' : '내 주변'} · 배달비 0원 · 100% 픽업
          </Text>
        </View>
      </View>

      <View style={styles.map}>
        <PickupMap center={center} user={user} pins={pins} selectedId={selectedStoreId} onSelectPin={select} />
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.count}>지금 픽업 가능 {rows.length}건</Text>
        <SortChips value={sort} onChange={setSort} />
      </View>

      {loading && items.length === 0 ? (
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
              <Text style={styles.muted}>지금 픽업 가능한 마감 할인이 없어요.</Text>
            </View>
          }
          renderItem={({ item: r }) => (
            <FoodCard
              item={r.item}
              distanceM={r.distanceM}
              nowMs={now}
              selected={r.item.storeId === selectedStoreId}
              onPress={() => select(r.item.storeId)}
              onReserve={() => reserve(r.item)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.surface },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  map: { height: 240 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexWrap: 'wrap' },
  count: { fontSize: 14, fontWeight: '700', color: colors.text },
  list: { paddingHorizontal: 16 },
  center: { paddingVertical: 40, alignItems: 'center' },
  muted: { color: colors.textMuted },
});
