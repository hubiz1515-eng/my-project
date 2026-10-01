import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { HttpsError } from 'firebase-functions/v2/https';
import { applyStockDelta } from '../shared/foodItemRules';
import { checkStockForLines, generatePickupCode, orderNameFor, priceCart, type CartLine } from '../shared/orderRules';
import type { PaymentMethod } from '../shared/types';
import { paymentVerifier } from './config';
import { col, db } from './db';
import { refundPayment, verifyPayment } from './payments';
import type { CheckoutDoc, FoodItemDoc, OrderDoc } from './types';

const PAYMENT_METHODS: PaymentMethod[] = ['card', 'kakaopay'];

function parseLine(v: unknown): CartLine {
  const l = v as Partial<CartLine>;
  if (typeof l?.itemId !== 'string' || !l.itemId || typeof l.quantity !== 'number') {
    throw new HttpsError('invalid-argument', '장바구니 형식이 올바르지 않아요.');
  }
  return { itemId: l.itemId, quantity: l.quantity };
}

/**
 * 1단계: 결제 준비. 서버가 최신 가격·재고로 금액을 계산해 checkouts/{paymentId} 에 확정하고
 * 결제창에 넘길 paymentId·금액을 돌려준다. (클라이언트가 보낸 금액은 신뢰하지 않음)
 */
export async function prepareCheckout(uid: string, data: unknown) {
  const input = data as { main?: unknown; addOns?: unknown; paymentMethod?: unknown };
  const main = parseLine(input?.main);
  const addOns = Array.isArray(input?.addOns) ? input.addOns.map(parseLine) : [];
  const paymentMethod = input?.paymentMethod as PaymentMethod;
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw new HttpsError('invalid-argument', '결제 수단을 확인해 주세요.');

  const ids = [...new Set([main, ...addOns].map((l) => l.itemId))];
  const [userSnap, ...itemSnaps] = await Promise.all([
    col.users().doc(uid).get(),
    ...ids.map((id) => col.foodItems().doc(id).get()),
  ]);
  if (!userSnap.exists) throw new HttpsError('failed-precondition', '프로필을 먼저 완성해 주세요.');
  const items = itemSnaps.filter((s) => s.exists).map((s) => s.data() as FoodItemDoc);

  const priced = priceCart(items, main, addOns, Date.now());
  if ('error' in priced) throw new HttpsError('failed-precondition', priced.error);

  const mainItem = items.find((i) => i.itemId === priced.main.itemId)!;
  if (mainItem.ownerId === uid) throw new HttpsError('failed-precondition', '내 매장 상품은 주문할 수 없어요.');

  const ref = col.checkouts().doc();
  const lines = [priced.main, ...priced.addOns];
  const checkout: CheckoutDoc = {
    paymentId: ref.id,
    customerId: uid,
    customerName: String(userSnap.get('name') ?? ''),
    storeId: priced.storeId,
    storeOwnerId: mainItem.ownerId,
    storeName: mainItem.storeName,
    lines,
    totalPrice: priced.total,
    orderName: orderNameFor(priced.main, priced.addOns.length),
    paymentMethod,
    status: 'pending',
  };
  await ref.set({ ...checkout, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  return { paymentId: ref.id, totalAmount: priced.total, orderName: checkout.orderName };
}

type CompleteResult =
  | { kind: 'created' | 'already'; orderId: string }
  | { kind: 'unavailable'; reason: string };

/**
 * 2단계: 결제 확정 (앱 호출 + PortOne 웹훅 양쪽에서 호출, 멱등).
 * PortOne 결제 검증 → 트랜잭션(재고 확인·차감 + 주문 생성) → 실패 시 환불.
 * @param uid 앱 호출이면 호출자 uid (본인 checkout 인지 확인), 웹훅이면 null
 */
export async function completeCheckout(paymentId: string, uid: string | null): Promise<{ orderId: string }> {
  if (typeof paymentId !== 'string' || !paymentId) throw new HttpsError('invalid-argument', 'paymentId 가 필요해요.');
  const ref = col.checkouts().doc(paymentId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', '결제 정보를 찾을 수 없어요.');
  const checkout = snap.data() as CheckoutDoc;
  if (uid !== null && checkout.customerId !== uid) throw new HttpsError('permission-denied', '본인의 결제만 확정할 수 있어요.');
  if (checkout.status === 'completed') return { orderId: paymentId };
  if (checkout.status === 'failed') throw new HttpsError('failed-precondition', checkout.failureReason ?? '처리할 수 없는 결제예요.');

  const verifier = paymentVerifier();
  const check = await verifyPayment(verifier, paymentId, checkout.totalPrice);
  if (!check.ok) {
    if (check.refund) await failCheckout(paymentId, check.reason, verifier);
    throw new HttpsError('failed-precondition', check.reason);
  }

  const result = await db.runTransaction<CompleteResult>(async (tx) => {
    const fresh = await tx.get(ref);
    const c = fresh.data() as CheckoutDoc;
    if (c.status === 'completed') return { kind: 'already', orderId: paymentId };
    if (c.status === 'failed') return { kind: 'unavailable', reason: c.failureReason ?? '처리할 수 없는 결제예요.' };

    const itemRefs = c.lines.map((l) => col.foodItems().doc(l.itemId));
    const itemSnaps = await tx.getAll(...itemRefs);
    const items = itemSnaps.filter((s) => s.exists).map((s) => s.data() as FoodItemDoc);
    const nowMs = Date.now();
    const problem = checkStockForLines(items, c.lines, c.storeId, nowMs);
    if (problem) return { kind: 'unavailable', reason: problem };

    for (const line of c.lines) {
      const item = items.find((i) => i.itemId === line.itemId)!;
      tx.update(col.foodItems().doc(line.itemId), { ...applyStockDelta(item, -line.quantity), updatedAt: FieldValue.serverTimestamp() });
    }
    const [main, ...addOns] = c.lines;
    const pickupEndMs = Math.min(...c.lines.map((l) => items.find((i) => i.itemId === l.itemId)!.pickupEndTime.toMillis()));
    const order: OrderDoc = {
      orderId: paymentId,
      customerId: c.customerId,
      customerName: c.customerName,
      storeId: c.storeId,
      storeOwnerId: c.storeOwnerId,
      storeName: c.storeName,
      itemId: main.itemId,
      itemTitle: main.title,
      unitPrice: main.unitPrice,
      quantity: main.quantity,
      addOns,
      quantities: Object.fromEntries(c.lines.map((l) => [l.itemId, l.quantity])),
      totalPrice: c.totalPrice,
      pickupCode: await uniquePickupCode(c.storeOwnerId),
      status: 'paid',
      paymentId,
      paymentMethod: c.paymentMethod,
      pickupEndTime: Timestamp.fromMillis(pickupEndMs),
    };
    const now = FieldValue.serverTimestamp();
    tx.create(col.orders().doc(paymentId), { ...order, paidAt: now, createdAt: now, updatedAt: now });
    tx.update(ref, { status: 'completed', updatedAt: now });
    return { kind: 'created', orderId: paymentId };
  });

  if (result.kind === 'unavailable') {
    await failCheckout(paymentId, `${result.reason} 결제는 자동으로 환불됩니다.`, verifier);
    throw new HttpsError('failed-precondition', `${result.reason} 결제는 자동으로 환불됩니다.`);
  }
  if (result.kind === 'created') logger.info('order created', { orderId: result.orderId, source: uid ? 'app' : 'webhook' });
  return { orderId: result.orderId };
}

/** 같은 매장의 진행 중 주문과 겹치지 않는 픽업 코드 (서버는 모든 주문을 볼 수 있음) */
async function uniquePickupCode(storeOwnerId: string): Promise<string> {
  const active = await col
    .orders()
    .where('storeOwnerId', '==', storeOwnerId)
    .where('status', 'in', ['paid', 'accepted'])
    .select('pickupCode')
    .get();
  return generatePickupCode(new Set(active.docs.map((d) => String(d.get('pickupCode')))));
}

/** checkout 을 실패 처리하고 환불. 환불 결과를 refundStatus 로 남긴다. */
async function failCheckout(paymentId: string, reason: string, verifier: ReturnType<typeof paymentVerifier>) {
  const ref = col.checkouts().doc(paymentId);
  const marked = await db.runTransaction(async (tx) => {
    const c = (await tx.get(ref)).data() as CheckoutDoc;
    if (c.status !== 'pending') return false; // 이미 처리됨 (중복 환불 방지)
    tx.update(ref, { status: 'failed', failureReason: reason, refundStatus: 'pending', updatedAt: FieldValue.serverTimestamp() });
    return true;
  });
  if (!marked) return;
  const refunded = await refundPayment(verifier, paymentId, reason);
  await ref.update({ refundStatus: refunded ? 'done' : 'failed', updatedAt: FieldValue.serverTimestamp() });
}
