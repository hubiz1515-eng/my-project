import { usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../constants/theme';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { subscribeAllOrders } from '../services/orders';
import { useSellerStore } from '../services/session';
import type { Order } from '../types/models';
import { resetTo } from '../utils/nav';

/** 테스트용 소비자 ↔ 사장님 모드 전환 (로그인/역할 연동 전 임시) */
export function ModeSwitch() {
  const pathname = usePathname();
  const mode = pathname.startsWith('/seller') ? 'seller' : 'customer';
  const store = useSellerStore();
  const { data: orders } = useLiveQuery<Order[]>((cb) => subscribeAllOrders(cb), [], []);
  // 현재 테스트 매장의 수락 대기 주문 수
  const pending = orders.filter((o) => o.storeId === store.storeId && o.status === 'paid').length;

  const go = (next: 'customer' | 'seller') => {
    if (next === mode) return;
    if (next === 'customer') resetTo('/');
    else resetTo(pending > 0 ? '/seller?tab=orders' : '/seller');
  };

  return (
    <View style={styles.bar}>
      <Text style={styles.label}>테스트 모드</Text>
      <View style={styles.track} accessibilityRole="tablist">
        {(['customer', 'seller'] as const).map((m) => {
          const active = m === mode;
          return (
            <Pressable
              key={m}
              onPress={() => go(m)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.seg, active && (m === 'seller' ? styles.segSeller : styles.segCustomer)]}
            >
              <Text style={[styles.segText, active && styles.segTextActive]}>
                {m === 'customer' ? '🛍️ 소비자' : '🏪 사장님'}
              </Text>
              {m === 'seller' && pending > 0 && <Text style={styles.badge}>{pending}</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 6, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  label: { fontSize: 11, color: colors.textMuted },
  track: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: radius.pill, padding: 3 },
  seg: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill },
  badge: {
    minWidth: 18, textAlign: 'center', fontSize: 11, fontWeight: '800', color: '#fff',
    backgroundColor: colors.accent, borderRadius: 9, overflow: 'hidden', paddingHorizontal: 5,
  },
  segCustomer: { backgroundColor: colors.primary },
  segSeller: { backgroundColor: colors.text },
  segText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  segTextActive: { color: '#fff' },
});
