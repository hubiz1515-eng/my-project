/**
 * Cloud Functions 통합 테스트 (Auth/Firestore/Functions 에뮬레이터 + 가짜 PortOne 서버).
 * 실행: 저장소 루트에서 `npm run test:functions`
 */
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { startFakePortone } from './fakePortone.mjs';

const PROJECT = 'demo-pickupdeal';
const FN = `http://127.0.0.1:5001/${PROJECT}/asia-northeast3`;
const AUTH = 'http://127.0.0.1:9099';
const SECRET = process.env.PORTONE_API_SECRET;
const WEBHOOK_SECRET = process.env.PORTONE_WEBHOOK_SECRET;
const FAKE_PORT = Number(new URL(process.env.PORTONE_API_BASE).port);

const db = getFirestore(initializeApp({ projectId: PROJECT }));
let portone;
const users = {};

async function signUp(name) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `${name}-${Date.now()}@test.dev`, password: 'secret123', returnSecureToken: true }),
  });
  const j = await r.json();
  return { uid: j.localId, token: j.idToken };
}

async function call(name, data, user) {
  const r = await fetch(`${FN}/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(user ? { authorization: `Bearer ${user.token}` } : {}) },
    body: JSON.stringify({ data }),
  });
  const j = await r.json();
  if (j.error) { const e = new Error(j.error.message); e.status = j.error.status; throw e; }
  return j.result;
}

const item = (o) => ({
  storeId: users.seller.uid, ownerId: users.seller.uid, storeName: '골목 베이커리',
  originalPrice: 15000, discountPrice: 5900, stock: 3, status: 'selling', isAddOn: false,
  pickupEndTime: Timestamp.fromMillis(Date.now() + 3600_000), latitude: 37.5, longitude: 127, geohash: 'wydm', ...o,
});
const getItem = async (id) => (await db.collection('food_items').doc(id).get()).data();

function signWebhook(body) {
  const id = 'msg_' + crypto.randomUUID();
  const ts = Math.floor(Date.now() / 1000).toString();
  const key = Buffer.from(WEBHOOK_SECRET.replace(/^whsec_/, ''), 'base64');
  const sig = crypto.createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
  return { 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': `v1,${sig}` };
}
async function webhook(event, headers) {
  const body = JSON.stringify(event);
  return fetch(`${FN}/portoneWebhook`, { method: 'POST', headers: { 'content-type': 'application/json', ...(headers ?? signWebhook(body)) }, body });
}

before(async () => {
  portone = await startFakePortone(FAKE_PORT, SECRET);
  users.seller = await signUp('seller');
  users.alice = await signUp('alice');
  users.bob = await signUp('bob');
  await db.doc(`users/${users.seller.uid}`).set({ uid: users.seller.uid, role: 'seller', name: '사장' });
  await db.doc(`users/${users.alice.uid}`).set({ uid: users.alice.uid, role: 'customer', name: '앨리스' });
  await db.doc(`users/${users.bob.uid}`).set({ uid: users.bob.uid, role: 'customer', name: '밥' });
});
after(async () => portone?.close());
beforeEach(async () => {
  for (const c of ['food_items', 'orders', 'checkouts']) {
    const snap = await db.collection(c).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  await db.doc('food_items/bread').set(item({ itemId: 'bread', title: '빵 랜덤박스' }));
  await db.doc('food_items/milk').set(item({ itemId: 'milk', title: '우유 식빵', discountPrice: 2500, originalPrice: 5000, stock: 5 }));
  portone.cancels.length = 0;
});

const cart = { main: { itemId: 'bread', quantity: 2 }, addOns: [{ itemId: 'milk', quantity: 1 }], paymentMethod: 'kakaopay' };

describe('prepareCheckout', () => {
  test('서버가 금액을 계산해 checkout 을 만든다', async () => {
    const r = await call('prepareCheckout', cart, users.alice);
    assert.equal(r.totalAmount, 5900 * 2 + 2500);
    assert.equal(r.orderName, '빵 랜덤박스 외 1건');
    const c = (await db.doc(`checkouts/${r.paymentId}`).get()).data();
    assert.equal(c.status, 'pending');
    assert.equal(c.customerId, users.alice.uid);
  });
  test('로그인 필요 / 재고 초과 / 판매중지 거부', async () => {
    await assert.rejects(call('prepareCheckout', cart), /로그인/);
    await assert.rejects(call('prepareCheckout', { ...cart, main: { itemId: 'bread', quantity: 4 } }, users.alice), /재고가 3개/);
    await db.doc('food_items/bread').update({ status: 'paused' });
    await assert.rejects(call('prepareCheckout', cart, users.alice), /주문할 수 없어요/);
  });
  test('내 매장 상품은 주문 불가', async () => {
    await db.doc(`users/${users.seller.uid}`).update({ name: '사장' });
    await assert.rejects(call('prepareCheckout', cart, users.seller), /내 매장/);
  });
});

describe('completeCheckout (PortOne 검증)', () => {
  test('결제 금액 일치 → 주문 생성 + 재고 차감, 재호출해도 중복 없음(멱등)', async () => {
    const { paymentId, totalAmount } = await call('prepareCheckout', cart, users.alice);
    portone.setPayment(paymentId, { total: totalAmount });
    const r1 = await call('completeCheckout', { paymentId }, users.alice);
    assert.equal(r1.orderId, paymentId);
    const order = (await db.doc(`orders/${paymentId}`).get()).data();
    assert.equal(order.status, 'paid');
    assert.equal(order.totalPrice, 14300);
    assert.match(order.pickupCode, /^\d{6}$/);
    assert.deepEqual(order.quantities, { bread: 2, milk: 1 });
    assert.equal((await getItem('bread')).stock, 1);
    assert.equal((await getItem('milk')).stock, 4);
    const r2 = await call('completeCheckout', { paymentId }, users.alice);
    assert.equal(r2.orderId, paymentId);
    assert.equal((await getItem('bread')).stock, 1, '두 번 차감되면 안 됨');
  });

  test('결제하지 않은 paymentId → 거부, 주문 없음, 환불 호출 없음', async () => {
    const { paymentId } = await call('prepareCheckout', cart, users.alice);
    await assert.rejects(call('completeCheckout', { paymentId }, users.alice), /결제 정보를 찾을 수 없어요/);
    assert.equal((await db.doc(`orders/${paymentId}`).get()).exists, false);
    assert.equal(portone.cancels.length, 0);
  });

  test('결제 대기(READY) → 거부, 환불 없음', async () => {
    const { paymentId, totalAmount } = await call('prepareCheckout', cart, users.alice);
    portone.setPayment(paymentId, { status: 'READY', total: totalAmount });
    await assert.rejects(call('completeCheckout', { paymentId }, users.alice), /결제가 완료되지 않았어요/);
    assert.equal(portone.cancels.length, 0);
  });

  test('결제 금액 조작(적게 결제) → 거부 + 자동 환불 + 재고 그대로', async () => {
    const { paymentId } = await call('prepareCheckout', cart, users.alice);
    portone.setPayment(paymentId, { total: 100 });
    await assert.rejects(call('completeCheckout', { paymentId }, users.alice), /금액이 주문 금액과 달라요/);
    assert.equal(portone.cancels.length, 1);
    const c = (await db.doc(`checkouts/${paymentId}`).get()).data();
    assert.equal(c.status, 'failed');
    assert.equal(c.refundStatus, 'done');
    assert.equal((await getItem('bread')).stock, 3);
    assert.equal((await db.doc(`orders/${paymentId}`).get()).exists, false);
  });

  test('결제 사이에 품절 → 자동 환불', async () => {
    const { paymentId, totalAmount } = await call('prepareCheckout', cart, users.alice);
    portone.setPayment(paymentId, { total: totalAmount });
    await db.doc('food_items/bread').update({ stock: 1 });
    await assert.rejects(call('completeCheckout', { paymentId }, users.alice), /재고가 부족해요.*자동으로 환불/);
    assert.equal(portone.cancels.length, 1);
    assert.equal((await getItem('bread')).stock, 1);
  });

  test('다른 사람의 결제를 확정할 수 없음', async () => {
    const { paymentId, totalAmount } = await call('prepareCheckout', cart, users.alice);
    portone.setPayment(paymentId, { total: totalAmount });
    await assert.rejects(call('completeCheckout', { paymentId }, users.bob), /본인의 결제/);
  });

  test('결제 사이에 가격이 올라도 결제 시점 금액으로 주문', async () => {
    const { paymentId, totalAmount } = await call('prepareCheckout', cart, users.alice);
    await db.doc('food_items/bread').update({ discountPrice: 9000 });
    portone.setPayment(paymentId, { total: totalAmount });
    await call('completeCheckout', { paymentId }, users.alice);
    assert.equal((await db.doc(`orders/${paymentId}`).get()).data().totalPrice, totalAmount);
  });
});

describe('portoneWebhook', () => {
  test('서명 검증 실패 → 401, 주문 없음', async () => {
    const { paymentId, totalAmount } = await call('prepareCheckout', cart, users.alice);
    portone.setPayment(paymentId, { total: totalAmount });
    const r = await webhook({ type: 'Transaction.Paid', timestamp: new Date().toISOString(), data: { paymentId, storeId: 'store-test', transactionId: 't' } },
      { 'webhook-id': 'x', 'webhook-timestamp': String(Math.floor(Date.now() / 1000)), 'webhook-signature': 'v1,AAAA' });
    assert.equal(r.status, 401);
    assert.equal((await db.doc(`orders/${paymentId}`).get()).exists, false);
  });

  test('Transaction.Paid → 앱이 종료돼도 주문 생성, 이후 앱 호출은 같은 주문', async () => {
    const { paymentId, totalAmount } = await call('prepareCheckout', cart, users.alice);
    portone.setPayment(paymentId, { total: totalAmount });
    const r = await webhook({ type: 'Transaction.Paid', timestamp: new Date().toISOString(), data: { paymentId, storeId: 'store-test', transactionId: 't' } });
    assert.equal(r.status, 200);
    assert.equal((await db.doc(`orders/${paymentId}`).get()).data().status, 'paid');
    assert.equal((await call('completeCheckout', { paymentId }, users.alice)).orderId, paymentId);
    assert.equal((await getItem('bread')).stock, 1);
  });

  test('위조된 금액의 결제 웹훅 → 200(처리됨) + 환불, 주문 없음', async () => {
    const { paymentId } = await call('prepareCheckout', cart, users.alice);
    portone.setPayment(paymentId, { total: 1 });
    const r = await webhook({ type: 'Transaction.Paid', timestamp: new Date().toISOString(), data: { paymentId, storeId: 'store-test', transactionId: 't' } });
    assert.equal(r.status, 200);
    assert.equal(portone.cancels.length, 1);
    assert.equal((await db.doc(`orders/${paymentId}`).get()).exists, false);
  });
});

describe('cancelOrder (환불 + 재고 복구)', () => {
  async function paidOrder() {
    const { paymentId, totalAmount } = await call('prepareCheckout', cart, users.alice);
    portone.setPayment(paymentId, { total: totalAmount });
    await call('completeCheckout', { paymentId }, users.alice);
    return paymentId;
  }

  test('고객 취소(수락 전) → PortOne 환불 + 재고 복구', async () => {
    const id = await paidOrder();
    const r = await call('cancelOrder', { orderId: id }, users.alice);
    assert.equal(r.refundStatus, 'done');
    const o = (await db.doc(`orders/${id}`).get()).data();
    assert.equal(o.status, 'canceled');
    assert.equal(o.canceledBy, 'customer');
    assert.equal(portone.cancels[0].paymentId, id);
    assert.equal((await getItem('bread')).stock, 3);
    assert.equal((await getItem('milk')).stock, 5);
  });

  test('품절됐던 상품은 재고만 돌아오고 품절 유지 (자동 재판매 금지)', async () => {
    const { paymentId, totalAmount } = await call('prepareCheckout', { ...cart, main: { itemId: 'bread', quantity: 3 } }, users.alice);
    portone.setPayment(paymentId, { total: totalAmount });
    await call('completeCheckout', { paymentId }, users.alice);
    assert.equal((await getItem('bread')).status, 'sold_out');
    await call('cancelOrder', { orderId: paymentId }, users.alice);
    const bread = await getItem('bread');
    assert.equal(bread.stock, 3);
    assert.equal(bread.status, 'sold_out');
  });

  test('수락 후 고객 취소 불가, 사장님 거절은 가능', async () => {
    const id = await paidOrder();
    await db.doc(`orders/${id}`).update({ status: 'accepted' });
    await assert.rejects(call('cancelOrder', { orderId: id }, users.alice), /이미 수락한 주문/);
    const r = await call('cancelOrder', { orderId: id }, users.seller);
    assert.equal(r.refundStatus, 'done');
    assert.equal((await db.doc(`orders/${id}`).get()).data().canceledBy, 'seller');
  });

  test('제3자 취소 불가, 중복 취소 불가', async () => {
    const id = await paidOrder();
    await assert.rejects(call('cancelOrder', { orderId: id }, users.bob), /권한이 없어요/);
    await call('cancelOrder', { orderId: id }, users.alice);
    await assert.rejects(call('cancelOrder', { orderId: id }, users.alice), /이미 취소된/);
    assert.equal(portone.cancels.length, 1, '환불은 한 번만');
  });
});
