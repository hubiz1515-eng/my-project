import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, Vibration } from 'react-native';
import { colors, radius } from '../../constants/theme';
import { subscribeAllOrders } from '../../services/orders';
import { MOCK_CUSTOMER, setSellerStore } from '../../services/session';
import type { Order, OrderStatus } from '../../types/models';
import { formatWon } from '../../utils/format';
import { resetTo } from '../../utils/nav';
import { orderSummary } from '../../utils/orderRules';

interface Toast {
  key: string;
  who: 'seller' | 'customer';
  title: string;
  body: string;
  onPress: () => void;
}

const SHOW_MS = 4500;

/**
 * 인앱 주문 알림 (FCM 푸시 연동 전 대체).
 * 한 기기에서 양쪽 모드를 테스트하므로 사장님/고객 알림을 모두 띄우고 태그로 구분한다.
 */
export function OrderToast({ top }: { top: number }) {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const [queue, setQueue] = useState<Toast[]>([]);
  const prev = useRef<Map<string, OrderStatus> | null>(null);

  useEffect(() => {
    return subscribeAllOrders((orders) => {
      const before = prev.current;
      prev.current = new Map(orders.map((o) => [o.orderId, o.status]));
      if (!before) return; // 첫 스냅샷은 기준점만 저장
      const toasts: Toast[] = [];
      for (const o of orders) {
        const was = before.get(o.orderId);
        if (was === o.status) continue;
        const t = toToast(o, was, () => pathRef.current);
        if (t) toasts.push(t);
      }
      if (toasts.length) {
        if (Platform.OS !== 'web' && toasts.some((t) => t.who === 'seller')) Vibration.vibrate(300);
        setQueue((q) => [...q, ...toasts]);
      }
    });
  }, []);

  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    const id = setTimeout(() => setQueue((q) => q.slice(1)), SHOW_MS);
    return () => clearTimeout(id);
  }, [current]);

  if (!current) return null;
  const seller = current.who === 'seller';
  return (
    <Pressable
      key={current.key}
      onPress={() => {
        setQueue((q) => q.slice(1));
        current.onPress();
      }}
      style={[styles.toast, { top }, seller ? styles.seller : styles.customer]}
      accessibilityRole="alert"
    >
      <Text style={styles.tag}>{seller ? '🏪 사장님 알림' : '🛍️ 고객 알림'}</Text>
      <Text style={styles.title}>{current.title}</Text>
      <Text style={styles.body} numberOfLines={2}>{current.body}</Text>
    </Pressable>
  );
}

function toToast(o: Order, was: OrderStatus | undefined, getPath: () => string): Toast | null {
  const key = `${o.orderId}:${o.status}`;
  const openOrder = () => router.push(`/order/${o.orderId}`);
  if (was === undefined && o.status === 'paid') {
    return {
      key,
      who: 'seller',
      title: `🔔 ${o.storeName} · 새 픽업 주문`,
      body: `${o.customerName}님 · ${orderSummary(o)} · ${formatWon(o.totalPrice)}`,
      onPress: () => {
        setSellerStore(o.storeId);
        if (getPath().startsWith('/seller')) router.setParams({ tab: 'orders' });
        else resetTo('/seller?tab=orders');
      },
    };
  }
  if (o.customerId !== MOCK_CUSTOMER.uid) return null;
  if (o.status === 'accepted') {
    return { key, who: 'customer', title: '✅ 주문이 수락됐어요', body: `${o.storeName}에 방문해 픽업 코드 ${o.pickupCode}를 보여주세요.`, onPress: openOrder };
  }
  if (o.status === 'picked_up') {
    return { key, who: 'customer', title: '🎉 픽업 완료', body: `${o.storeName} · ${orderSummary(o)} 맛있게 드세요!`, onPress: openOrder };
  }
  if (o.status === 'canceled' && o.canceledBy === 'seller') {
    return { key, who: 'customer', title: '주문이 취소됐어요', body: `${o.storeName} 사정으로 취소되어 ${formatWon(o.totalPrice)} 환불됩니다.`, onPress: openOrder };
  }
  return null;
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', left: 12, right: 12, zIndex: 100,
    borderRadius: radius.lg, padding: 14, gap: 2,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  seller: { backgroundColor: colors.text },
  customer: { backgroundColor: colors.primary },
  tag: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '700' },
  title: { fontSize: 15, color: '#fff', fontWeight: '800' },
  body: { fontSize: 13, color: 'rgba(255,255,255,0.9)' },
});
