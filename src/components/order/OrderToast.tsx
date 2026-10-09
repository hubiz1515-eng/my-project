import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, Vibration } from 'react-native';
import { colors, radius } from '../../constants/theme';
import { useProfile } from '../../contexts/AuthContext';
import { subscribeMyOrders, subscribeStoreOrders } from '../../services/orders';
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
 * 인앱 주문 알림 (FCM 푸시 연동 전 대체). 앱이 켜져 있을 때만 동작.
 * - 고객: 내 주문의 수락 / 픽업 완료 / 매장 취소
 * - 사장님: 내 매장의 새 주문
 */
export function OrderToast({ top }: { top: number }) {
  const profile = useProfile();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const [queue, setQueue] = useState<Toast[]>([]);

  const push = (toasts: Toast[]) => {
    if (!toasts.length) return;
    if (Platform.OS !== 'web' && toasts.some((t) => t.who === 'seller')) Vibration.vibrate(300);
    setQueue((q) => [...q, ...toasts]);
  };

  useEffect(() => watchChanges((cb) => subscribeMyOrders(profile.uid, cb), customerToast, push), [profile.uid]);
  useEffect(() => {
    if (profile.role !== 'seller') return;
    return watchChanges(
      (cb) => subscribeStoreOrders(profile.uid, cb),
      (o, was) => sellerToast(o, was, () => pathRef.current),
      push,
    );
  }, [profile.uid, profile.role]);

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
      <Text style={styles.tag}>{seller ? '🏪 매장 알림' : '🛍️ 주문 알림'}</Text>
      <Text style={styles.title}>{current.title}</Text>
      <Text style={styles.body} numberOfLines={2}>{current.body}</Text>
    </Pressable>
  );
}

/** 구독 스냅샷을 이전 상태와 비교해 바뀐 주문만 알림으로. 첫 스냅샷은 기준점. */
function watchChanges(
  subscribe: (cb: (orders: Order[]) => void) => () => void,
  toToast: (o: Order, was: OrderStatus | undefined) => Toast | null,
  push: (t: Toast[]) => void,
) {
  let prev: Map<string, OrderStatus> | null = null;
  return subscribe((orders) => {
    const before = prev;
    prev = new Map(orders.map((o) => [o.orderId, o.status]));
    if (!before) return;
    push(orders.filter((o) => before.get(o.orderId) !== o.status).map((o) => toToast(o, before.get(o.orderId))).filter((t): t is Toast => !!t));
  });
}

function sellerToast(o: Order, was: OrderStatus | undefined, getPath: () => string): Toast | null {
  if (was !== undefined || o.status !== 'paid') return null;
  return {
    key: `${o.orderId}:new`,
    who: 'seller',
    title: '🔔 새 픽업 주문',
    body: `${o.customerName}님 · ${orderSummary(o)} · ${formatWon(o.totalPrice)}`,
    onPress: () => {
      if (getPath().startsWith('/seller')) router.setParams({ tab: 'orders' });
      else resetTo('/seller?tab=orders');
    },
  };
}

function customerToast(o: Order, was: OrderStatus | undefined): Toast | null {
  if (was === undefined) return null; // 내가 방금 만든 주문
  const key = `${o.orderId}:${o.status}`;
  const onPress = () => router.push(`/order/${o.orderId}`);
  if (o.status === 'accepted') {
    return { key, who: 'customer', title: '✅ 주문이 수락됐어요', body: `${o.storeName}에 방문해 QR 또는 픽업 코드를 보여주세요.`, onPress };
  }
  if (o.status === 'picked_up') {
    return { key, who: 'customer', title: '🎉 픽업 완료', body: `${o.storeName} · ${orderSummary(o)} 맛있게 드세요!`, onPress };
  }
  if (o.status === 'canceled' && o.canceledBy === 'seller') {
    return { key, who: 'customer', title: '주문이 취소됐어요', body: `${o.storeName} 사정으로 취소되어 ${formatWon(o.totalPrice)} 환불됩니다.`, onPress };
  }
  if (o.status === 'canceled' && o.canceledBy === 'system') {
    return { key, who: 'customer', title: '주문이 자동 취소됐어요', body: `${o.storeName}이(가) 픽업 시간까지 수락하지 않아 ${formatWon(o.totalPrice)} 환불됩니다.`, onPress };
  }
  if (o.status === 'no_show') {
    return { key, who: 'customer', title: '픽업 시간이 지났어요', body: `${o.storeName} 주문이 노쇼로 처리됐어요.`, onPress };
  }
  return null;
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', left: 12, right: 12, zIndex: 100,
    borderRadius: radius.lg, padding: 14, gap: 2,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
  },
  seller: { backgroundColor: colors.text },
  customer: { backgroundColor: colors.primary },
  tag: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '700' },
  title: { fontSize: 15, color: '#fff', fontWeight: '800' },
  body: { fontSize: 13, color: 'rgba(255,255,255,0.9)' },
});
