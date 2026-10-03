import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PaymentSheet } from '../../components/order/PaymentSheet';
import { QtyStepper } from '../../components/QtyStepper';
import { colors, radius } from '../../constants/theme';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { useNow } from '../../hooks/useNow';
import { useAuth, useProfile } from '../../contexts/AuthContext';
import { useUserLocation } from '../../hooks/useUserLocation';
import { subscribeFoodItem, subscribeStoreFoodItems } from '../../services/foodItems';
import { completeCheckout, prepareCheckout, type CheckoutResult } from '../../services/checkout';
import { AVAILABLE_PAYMENT_METHODS, type PaymentCustomer } from '../../services/payments';
import { toUserMessage } from '../../services/types';
import type { FoodItem, PaymentMethod } from '../../types/models';
import { discountPercent, initialOf, formatClock, formatDistance, formatTimeLeft, formatWon } from '../../utils/format';
import { distanceMeters } from '../../utils/geo';
import { goBack } from '../../utils/nav';
import { isOrderable } from '../../utils/orderRules';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const now = useNow(15_000);
  const { coords: user } = useUserLocation();
  const profile = useProfile();
  const { data: item, loading } = useLiveQuery<FoodItem | null>((cb, err) => subscribeFoodItem(id, cb, err), [id], null);
  const storeId = item?.storeId;
  // 같은 매장 상품 (함께 담기 후보) — 실시간 재고 반영
  const { data: storeItems } = useLiveQuery<FoodItem[]>(
    storeId ? (cb, err) => subscribeStoreFoodItems(storeId, cb, err) : null,
    [storeId],
    [],
  );

  const [qty, setQty] = useState(1);
  const [addOnQty, setAddOnQty] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<PaymentMethod>(AVAILABLE_PAYMENT_METHODS[0]?.key ?? 'card');
  const [preparing, setPreparing] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { state: authState } = useAuth();
  const email = authState.status === 'ready' ? authState.user.email : null;
  const customer = useMemo<PaymentCustomer>(
    () => ({ uid: profile.uid, name: profile.name, phone: profile.phone, email }),
    [profile.uid, profile.name, profile.phone, email],
  );

  const available = !!item && isOrderable(item, now);

  // 같은 매장에서 지금 살 수 있는 다른 메뉴 = 함께 담기(Cross-selling) 후보
  const addOnCandidates = useMemo(
    () => (item ? storeItems.filter((i) => i.itemId !== item.itemId && isOrderable(i, now)) : []),
    [storeItems, item, now],
  );

  // 재고가 실시간으로 줄어도 선택 수량이 재고를 넘지 않도록 보정
  const mainQty = item ? Math.max(1, Math.min(qty, item.stock)) : qty;
  const addOns = addOnCandidates
    .map((i) => ({ item: i, quantity: Math.min(addOnQty[i.itemId] ?? 0, i.stock) }))
    .filter((a) => a.quantity > 0);

  const total = item ? item.discountPrice * mainQty + addOns.reduce((s, a) => s + a.item.discountPrice * a.quantity, 0) : 0;
  const originalTotal = item ? item.originalPrice * mainQty + addOns.reduce((s, a) => s + a.item.originalPrice * a.quantity, 0) : 0;
  /** 1) 서버가 금액을 확정 → 결제창 열기 */
  const startPayment = async () => {
    if (!item) return;
    setError(null);
    setNotice(null);
    setPreparing(true);
    try {
      const c = await prepareCheckout({
        main: { itemId: item.itemId, quantity: mainQty },
        addOns: addOns.map((a) => ({ itemId: a.item.itemId, quantity: a.quantity })),
        paymentMethod: method,
      });
      if (c.totalAmount !== total) setNotice(`가격이 바뀌어 최신 금액 ${formatWon(c.totalAmount)}으로 결제해요.`);
      setCheckout(c);
    } catch (e) {
      setError(toUserMessage(e, '결제를 준비하지 못했어요.'));
    } finally {
      setPreparing(false);
    }
  };

  /** 2) 결제창 성공 → 서버가 PortOne 결제를 검증하고 주문 생성 (실패 시 서버가 자동 환불) */
  const onPaid = useCallback(async (paymentId: string) => {
    try {
      const { orderId } = await completeCheckout(paymentId);
      setCheckout(null);
      router.replace(`/order/${orderId}`);
    } catch (e) {
      setCheckout(null);
      setError(toUserMessage(e, '결제 확인에 실패했어요. 결제된 금액은 자동으로 환불됩니다.'));
    }
  }, []);

  const onPayFailed = useCallback((message: string) => {
    setCheckout(null);
    setError(message);
  }, []);

  if (loading && !item) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!item) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>상품을 찾을 수 없어요.</Text>
        <Pressable onPress={() => goBack()} style={styles.linkBtn}>
          <Text style={styles.link}>돌아가기</Text>
        </Pressable>
      </View>
    );
  }

  const endMs = item.pickupEndTime.toMillis();
  const percent = discountPercent(item.originalPrice, item.discountPrice);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => goBack()} hitSlop={10} accessibilityLabel="닫기">
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>{item.storeName}</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}>
        <View style={styles.hero}>
          <Text style={styles.heroLetter}>{initialOf(item.storeName)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.store}>
            {item.storeName} · {formatDistance(distanceMeters(user, item))}
          </Text>
          <Text style={styles.title}>{item.title}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.percent}>{percent}%</Text>
            <Text style={styles.price}>{formatWon(item.discountPrice)}</Text>
            <Text style={styles.original}>{formatWon(item.originalPrice)}</Text>
          </View>
          <View style={styles.infoBox}>
            <Info label="픽업 마감" value={`${formatClock(endMs)}까지 (${formatTimeLeft(endMs, now) ?? '마감'})`} />
            <Info label="남은 수량" value={`${item.stock}개`} danger={item.stock <= 2} />
            <Info label="수령 방법" value="매장 방문 픽업 · 배달비 0원" />
          </View>
          {!available && <Text style={styles.soldOut}>방금 판매가 종료됐어요. 다른 상품을 확인해 주세요.</Text>}
        </View>

        {available && (
          <>
            <View style={[styles.section, styles.rowBetween]}>
              <Text style={styles.sectionTitle}>수량</Text>
              <QtyStepper value={mainQty} min={1} max={item.stock} onChange={setQty} label={item.title} />
            </View>

            {addOnCandidates.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🥐 같이 픽업하면 좋은 메뉴</Text>
                <Text style={styles.muted}>같은 매장이라 한 번에 받아가요</Text>
                {addOnCandidates.map((a) => {
                  const q = Math.min(addOnQty[a.itemId] ?? 0, a.stock);
                  return (
                    <View key={a.itemId} style={[styles.addOn, q > 0 && styles.addOnOn]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.addOnTitle} numberOfLines={1}>{a.title}</Text>
                        <Text style={styles.addOnPrice}>
                          <Text style={styles.percent}>{discountPercent(a.originalPrice, a.discountPrice)}% </Text>
                          {formatWon(a.discountPrice)} · {a.stock}개 남음
                        </Text>
                      </View>
                      {q === 0 ? (
                        <Pressable
                          onPress={() => setAddOnQty((s) => ({ ...s, [a.itemId]: 1 }))}
                          style={styles.addBtn}
                          accessibilityLabel={`${a.title} 담기`}
                        >
                          <Text style={styles.addBtnText}>+ 담기</Text>
                        </Pressable>
                      ) : (
                        <QtyStepper
                          value={q}
                          min={0}
                          max={a.stock}
                          onChange={(v) => setAddOnQty((s) => ({ ...s, [a.itemId]: v }))}
                          label={a.title}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>결제 수단</Text>
              <View style={styles.methods}>
                {AVAILABLE_PAYMENT_METHODS.map((m) => {
                  const active = m.key === method;
                  return (
                    <Pressable
                      key={m.key}
                      onPress={() => setMethod(m.key)}
                      style={[styles.method, active && { borderColor: m.color, backgroundColor: m.color }]}
                    >
                      <Text style={[styles.methodText, active && { color: m.fg }]}>{m.label}</Text>
                      {m.sub && <Text style={[styles.methodSub, active && { color: m.fg }]}>{m.sub}</Text>}
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.muted}>픽업 마감({formatClock(endMs)}) 전까지 매장에 방문해 주세요. 수락 전에는 취소할 수 있어요.</Text>
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        {notice && <Text style={styles.notice}>{notice}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.totalLabel}>총 결제금액</Text>
            {originalTotal > total && <Text style={styles.saving}>{formatWon(originalTotal - total)} 절약</Text>}
          </View>
          <Text style={styles.total}>{formatWon(total)}</Text>
        </View>
        <Pressable
          onPress={startPayment}
          disabled={!available || preparing}
          style={[styles.payBtn, (!available || preparing) && { backgroundColor: colors.border }]}
        >
          <Text style={styles.payText}>
            {!available ? '판매 종료' : preparing ? '결제 준비 중…' : `${formatWon(total)} 결제하고 픽업 예약`}
          </Text>
        </Pressable>
      </View>

      <PaymentSheet
        checkout={checkout}
        method={method}
        customer={customer}
        onPaid={onPaid}
        onFailed={onPayFailed}
        onClose={() => setCheckout(null)}
      />
    </View>
  );
}

function Info({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, danger && { color: colors.accent }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface,
  },
  close: { fontSize: 20, color: colors.text },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.text },
  hero: { height: 140, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  heroLetter: { fontSize: 56, fontWeight: '800', color: colors.primary },
  section: { backgroundColor: colors.surface, padding: 16, marginTop: 8, gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  store: { fontSize: 13, color: colors.textMuted },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  percent: { fontSize: 18, fontWeight: '800', color: colors.accent },
  price: { fontSize: 20, fontWeight: '800', color: colors.text },
  original: { fontSize: 14, color: colors.textMuted, textDecorationLine: 'line-through' },
  infoBox: { backgroundColor: colors.background, borderRadius: radius.md, padding: 12, gap: 6, marginTop: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  infoLabel: { fontSize: 13, color: colors.textMuted },
  infoValue: { fontSize: 13, fontWeight: '600', color: colors.text, flexShrink: 1, textAlign: 'right' },
  soldOut: { color: colors.accent, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  muted: { fontSize: 12, color: colors.textMuted },
  addOn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  addOnOn: { borderColor: colors.primary, backgroundColor: '#f0fdf4' },
  addOnTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  addOnPrice: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  addBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  addBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  methods: { flexDirection: 'row', gap: 8 },
  method: {
    flex: 1, paddingVertical: 12, borderRadius: radius.md, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
  },
  methodText: { fontSize: 14, fontWeight: '700', color: colors.text },
  bottom: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface,
    paddingHorizontal: 16, paddingTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  totalLabel: { fontSize: 13, color: colors.textMuted },
  saving: { fontSize: 12, color: colors.accent, fontWeight: '700' },
  total: { fontSize: 22, fontWeight: '800', color: colors.text },
  payBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center' },
  payText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  error: { color: colors.accent, fontSize: 13 },
  notice: { color: '#1d4ed8', fontSize: 13 },
  methodSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  linkBtn: { padding: 8 },
  link: { color: colors.primary, fontWeight: '700' },
});
