import { usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../constants/theme';
import { useProfile } from '../contexts/AuthContext';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { signOut } from '../services/auth';
import { subscribeStoreOrders } from '../services/orders';
import type { Order } from '../types/models';
import { resetTo } from '../utils/nav';

/**
 * 상단 계정 바. 사장님은 소비자 화면도 볼 수 있도록 모드 전환 제공
 * (사장님도 다른 가게에서 살 수 있음). 소비자는 사장님 화면 접근 불가.
 */
export function AccountBar() {
  const profile = useProfile();
  const seller = profile.role === 'seller';

  return (
    <View style={styles.bar}>
      <View style={styles.who}>
        <Text style={styles.name} numberOfLines={1}>{profile.name}님</Text>
        <Text style={[styles.role, seller && styles.roleSeller]}>{seller ? '사장님' : '소비자'}</Text>
      </View>
      {seller && <SellerModeSwitch uid={profile.uid} />}
      <Pressable onPress={() => signOut()} hitSlop={8} accessibilityRole="button">
        <Text style={styles.logout}>로그아웃</Text>
      </Pressable>
    </View>
  );
}

function SellerModeSwitch({ uid }: { uid: string }) {
  const pathname = usePathname();
  const mode = pathname.startsWith('/seller') || pathname.startsWith('/scan') ? 'seller' : 'customer';
  const { data: orders } = useLiveQuery<Order[]>((cb, err) => subscribeStoreOrders(uid, cb, err), [uid], []);
  const pending = orders.filter((o) => o.status === 'paid').length;

  const go = (next: 'customer' | 'seller') => {
    if (next === mode) return;
    if (next === 'customer') resetTo('/');
    else resetTo(pending > 0 ? '/seller?tab=orders' : '/seller');
  };

  return (
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
              {m === 'customer' ? '🛍️ 둘러보기' : '🏪 내 매장'}
            </Text>
            {m === 'seller' && pending > 0 && <Text style={styles.badge}>{pending}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    paddingHorizontal: 16, paddingVertical: 6, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border, minHeight: 46,
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  name: { fontSize: 13, fontWeight: '700', color: colors.text, flexShrink: 1 },
  role: {
    fontSize: 10, fontWeight: '800', color: colors.primary, backgroundColor: colors.primarySoft,
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: 'hidden', flexShrink: 0,
  },
  roleSeller: { color: '#fff', backgroundColor: colors.text },
  logout: { fontSize: 12, color: colors.textMuted, flexShrink: 0 },
  track: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: radius.pill, padding: 3 },
  seg: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  segCustomer: { backgroundColor: colors.primary },
  segSeller: { backgroundColor: colors.text },
  segText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  segTextActive: { color: '#fff' },
  badge: {
    minWidth: 18, textAlign: 'center', fontSize: 11, fontWeight: '800', color: '#fff',
    backgroundColor: colors.accent, borderRadius: 9, overflow: 'hidden', paddingHorizontal: 5,
  },
});
