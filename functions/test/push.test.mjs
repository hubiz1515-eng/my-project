/**
 * 주문 상태 변화 → 푸시 알림 (onOrderWritten 트리거) 통합 테스트.
 * 실행: 저장소 루트에서 `npm run test:functions`
 */
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { startFakePush } from './fakePush.mjs';

const PROJECT = 'demo-pickupdeal';
const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: PROJECT }));
let push;
const SELLER = 'push_seller', ALICE = 'push_alice';
const T = { seller: 'ExponentPushToken[seller-phone]', alice: 'ExponentPushToken[alice-phone]', aliceOld: 'ExponentPushToken[dead-alice-old]' };

/** 트리거는 비동기 — 조건이 맞을 때까지 대기 */
async function waitFor(fn, ms = 15000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('timeout waiting for push');
    await new Promise((r) => setTimeout(r, 200));
  }
}
const pushesTo = (token) => push.received.filter((m) => m.to === token);

const order = (o = {}) => ({
  orderId: 'po1', customerId: ALICE, customerName: '앨리스', storeId: SELLER, storeOwnerId: SELLER, storeName: '골목 베이커리',
  itemId: 'bread', itemTitle: '빵 랜덤박스', unitPrice: 5900, quantity: 2, addOns: [], quantities: { bread: 2 },
  totalPrice: 11800, pickupCode: '123456', status: 'paid', paymentId: 'po1', paymentMethod: 'card',
  pickupEndTime: Timestamp.fromMillis(Date.now() + 3600_000), ...o,
});

before(async () => {
  push = await startFakePush(Number(new URL(process.env.PUSH_API_URL).port));
});
after(async () => push?.close());
beforeEach(async () => {
  for (const c of ['orders', 'push_events']) {
    const s = await db.collection(c).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
  await db.doc(`users/${SELLER}`).set({ uid: SELLER, role: 'seller', name: '사장', pushTokens: [T.seller] });
  await db.doc(`users/${ALICE}`).set({ uid: ALICE, role: 'customer', name: '앨리스', pushTokens: [T.alice, T.aliceOld] });
  await new Promise((r) => setTimeout(r, 800)); // 이전 테스트의 삭제 트리거가 끝나도록
  push.received.length = 0;
});

describe('onOrderWritten → 푸시', () => {
  test('새 주문 → 사장님에게 알림 (주문 내용·금액, 주문 탭 링크)', async () => {
    await db.doc('orders/po1').set(order());
    const [m] = await waitFor(() => pushesTo(T.seller).length && pushesTo(T.seller));
    assert.equal(m.title, '🔔 새 픽업 주문');
    assert.match(m.body, /앨리스님 · 빵 랜덤박스 ×2 · 11,800원/);
    assert.equal(m.data.url, '/seller?tab=orders');
    assert.equal(m.channelId, 'orders');
    assert.equal(pushesTo(T.alice).length, 0, '고객에게는 보내지 않음');
  });

  test('수락 → 고객의 모든 기기로, 만료된 토큰은 프로필에서 제거', async () => {
    await db.doc('orders/po1').set(order());
    await waitFor(() => pushesTo(T.seller).length);
    await db.doc('orders/po1').update({ status: 'accepted' });
    const [m] = await waitFor(() => pushesTo(T.alice).length && pushesTo(T.alice));
    assert.equal(m.title, '✅ 주문이 수락됐어요');
    assert.equal(m.data.url, '/order/po1');
    await waitFor(() => pushesTo(T.aliceOld).length);
    let left;
    for (let i = 0; i < 50; i++) {
      left = (await db.doc(`users/${ALICE}`).get()).get('pushTokens');
      if (left.length === 1) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.deepEqual(left, [T.alice]);
  });

  test('픽업 완료 → 고객 / 매장 거절 → 고객(환불 안내) / 고객 취소 → 사장님', async () => {
    await db.doc('orders/po1').set(order({ status: 'accepted' }));
    await db.doc('orders/po2').set(order({ orderId: 'po2', status: 'paid' }));
    await db.doc('orders/po3').set(order({ orderId: 'po3', status: 'paid' }));
    await new Promise((r) => setTimeout(r, 1500));
    push.received.length = 0;
    await db.doc('orders/po1').update({ status: 'picked_up' });
    await db.doc('orders/po2').update({ status: 'canceled', canceledBy: 'seller' });
    await db.doc('orders/po3').update({ status: 'canceled', canceledBy: 'customer' });
    await waitFor(() => pushesTo(T.alice).length >= 2 && pushesTo(T.seller).length >= 1);
    const titles = new Set(pushesTo(T.alice).map((m) => m.title));
    assert.deepEqual(titles, new Set(['🎉 픽업 완료', '주문이 취소됐어요']));
    assert.match(pushesTo(T.alice).find((m) => m.title === '주문이 취소됐어요').body, /11,800원 환불/);
    assert.match(pushesTo(T.seller)[0].body, /앨리스님이 빵 랜덤박스 ×2 주문을 취소했어요/);
  });

  test('상태가 그대로인 변경(환불 상태 갱신 등)은 알림 없음', async () => {
    await db.doc('orders/po1').set(order({ status: 'canceled', canceledBy: 'seller', refundStatus: 'pending' }));
    await new Promise((r) => setTimeout(r, 1500));
    push.received.length = 0;
    await db.doc('orders/po1').update({ refundStatus: 'done' });
    await new Promise((r) => setTimeout(r, 2500));
    assert.equal(push.received.length, 0);
  });

  test('토큰이 없는 사용자는 발송 호출 없음', async () => {
    await db.doc(`users/${SELLER}`).update({ pushTokens: [] });
    await db.doc('orders/po1').set(order());
    await new Promise((r) => setTimeout(r, 2500));
    assert.equal(push.received.length, 0);
  });
});
