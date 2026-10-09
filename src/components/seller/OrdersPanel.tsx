import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/theme';
import { acceptOrder, rejectOrder } from '../../services/orders';
import { toUserMessage } from '../../services/types';
import type { Order } from '../../types/models';
import { PickupCodeBox } from './PickupCodeBox';
import { SellerOrderRow } from './SellerOrderRow';

const DONE_LIMIT = 10;

export function OrdersPanel({ ownerId, orders, nowMs }: { ownerId: string; orders: Order[]; nowMs: number }) {
  const [error, setError] = useState<string | null>(null);
  const pending = orders.filter((o) => o.status === 'paid');
  const accepted = orders.filter((o) => o.status === 'accepted');
  const done = orders.filter((o) => o.status === 'picked_up' || o.status === 'canceled' || o.status === 'no_show').slice(0, DONE_LIMIT);

  const run = (fn: () => Promise<unknown>) => {
    setError(null);
    fn().catch((e: unknown) => setError(toUserMessage(e)));
  };

  const section = (title: string, list: Order[], empty: string) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {title} <Text style={styles.count}>{list.length}</Text>
      </Text>
      {list.length === 0 ? (
        <Text style={styles.empty}>{empty}</Text>
      ) : (
        list.map((o) => (
          <SellerOrderRow
            key={o.orderId}
            order={o}
            nowMs={nowMs}
            onAccept={() => run(() => acceptOrder(o.orderId))}
            onReject={() => run(() => rejectOrder(o.orderId))}
          />
        ))
      )}
    </View>
  );

  return (
    <View style={styles.wrap}>
      <PickupCodeBox ownerId={ownerId} />
      {error && <Text style={styles.error}>{error}</Text>}
      {section('🔔 수락 대기', pending, '새 주문이 들어오면 여기에 표시돼요.')}
      {section('픽업 대기', accepted, '수락한 주문이 없어요.')}
      {done.length > 0 && section('최근 완료·취소', done, '')}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  count: { color: colors.accent },
  empty: { fontSize: 13, color: colors.textMuted, paddingVertical: 8 },
  error: { color: colors.accent, fontSize: 13 },
});
