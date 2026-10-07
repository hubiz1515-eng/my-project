/**
 * 회원 탈퇴(deleteAccount) 통합 테스트.
 * 실행: 저장소 루트에서 `npm run test:functions`
 */
import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const PROJECT = 'demo-pickupdeal';
const FN = `http://127.0.0.1:5001/${PROJECT}/asia-northeast3`;
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: PROJECT }));

async function signUp(name) {
  const email = `${name}-${Date.now()}@test.dev`;
  const r = await fetch(`${AUTH}/accounts:signUp?key=fake`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'secret123', returnSecureToken: true }),
  });
  const j = await r.json();
  return { uid: j.localId, token: j.idToken, email };
}

async function canSignIn(user) {
  const r = await fetch(`${AUTH}/accounts:signInWithPassword?key=fake`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: 'secret123', returnSecureToken: true }),
  });
  return r.ok;
}

async function deleteAccount(user) {
  const r = await fetch(`${FN}/deleteAccount`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(user ? { authorization: `Bearer ${user.token}` } : {}) },
    body: JSON.stringify({ data: {} }),
  });
  const j = await r.json();
  if (j.error) { const e = new Error(j.error.message); e.status = j.error.status; throw e; }
  return j.result;
}

const exists = async (path) => (await db.doc(path).get()).exists;

const order = (o) => ({
  customerName: '손님', storeName: '골목 베이커리', itemId: 'x', itemTitle: '빵', unitPrice: 1000, quantity: 1,
  addOns: [], quantities: { x: 1 }, totalPrice: 1000, pickupCode: '123456', paymentMethod: 'card',
  pickupEndTime: Timestamp.fromMillis(Date.now() + 3600_000), ...o,
});

describe('deleteAccount', () => {
  let seller, customer;
  beforeEach(async () => {
    seller = await signUp('del-seller');
    customer = await signUp('del-customer');
    await Promise.all([
      db.doc(`users/${seller.uid}`).set({ uid: seller.uid, role: 'seller', name: '사장님', pushTokens: ['ExponentPushToken[s]'] }),
      db.doc(`users/${customer.uid}`).set({ uid: customer.uid, role: 'customer', name: '손님', pushTokens: [] }),
      db.doc(`stores/${seller.uid}`).set({ storeId: seller.uid, ownerId: seller.uid, name: '골목 베이커리' }),
      db.doc(`food_items/${seller.uid}_a`).set({ itemId: `${seller.uid}_a`, ownerId: seller.uid, storeId: seller.uid, stock: 2 }),
      db.doc(`food_items/${seller.uid}_b`).set({ itemId: `${seller.uid}_b`, ownerId: seller.uid, storeId: seller.uid, stock: 0 }),
    ]);
  });

  test('로그인하지 않으면 거부', async () => {
    await assert.rejects(deleteAccount(null), { status: 'UNAUTHENTICATED' });
  });

  test('사장님: 매장·상품·프로필·계정 삭제, 지난 주문 내역은 보존', async () => {
    const oid = `done_${seller.uid}`;
    await db.doc(`orders/${oid}`).set(order({
      orderId: oid, customerId: customer.uid, storeId: seller.uid, storeOwnerId: seller.uid, status: 'picked_up', paymentId: oid,
    }));
    assert.deepEqual(await deleteAccount(seller), { deleted: true });

    assert.equal(await exists(`stores/${seller.uid}`), false);
    assert.equal(await exists(`food_items/${seller.uid}_a`), false);
    assert.equal(await exists(`food_items/${seller.uid}_b`), false);
    assert.equal(await exists(`users/${seller.uid}`), false);
    assert.equal(await canSignIn(seller), false);
    assert.equal(await exists(`orders/${oid}`), true, '거래 기록은 남아야 함');
    // 탈퇴 기록: 개인정보 없이 uid·역할·건수·시각만
    const rec = (await db.doc(`account_deletions/${seller.uid}`).get()).data();
    assert.deepEqual(Object.keys(rec).sort(), ['deletedAt', 'deletedItemCount', 'hadStore', 'role', 'uid']);
    assert.equal(rec.uid, seller.uid);
    assert.equal(rec.role, 'seller');
    assert.equal(rec.deletedItemCount, 2);
    assert.equal(rec.hadStore, true);
    assert.ok(Math.abs(rec.deletedAt.toMillis() - Date.now()) < 60_000);
    // 다른 사용자는 영향 없음
    assert.equal(await exists(`users/${customer.uid}`), true);
    assert.equal(await canSignIn(customer), true);
  });

  test('고객: 진행 중인 주문이 있으면 거부, 아무것도 지우지 않음', async () => {
    const oid = `active_${customer.uid}`;
    await db.doc(`orders/${oid}`).set(order({
      orderId: oid, customerId: customer.uid, storeId: seller.uid, storeOwnerId: seller.uid, status: 'accepted', paymentId: oid,
    }));
    await assert.rejects(deleteAccount(customer), { status: 'FAILED_PRECONDITION', message: /진행 중인 주문/ });
    assert.equal(await exists(`users/${customer.uid}`), true);
    assert.equal(await exists(`account_deletions/${customer.uid}`), false, '거부되면 기록도 없음');
    assert.equal(await canSignIn(customer), true);

    // 픽업 완료 후에는 탈퇴 가능
    await db.doc(`orders/${oid}`).update({ status: 'picked_up' });
    await deleteAccount(customer);
    assert.equal(await exists(`users/${customer.uid}`), false);
    const rec = (await db.doc(`account_deletions/${customer.uid}`).get()).data();
    assert.equal(rec.role, 'customer');
    assert.equal(rec.hadStore, false);
    assert.equal(rec.deletedItemCount, 0);
    assert.equal(await canSignIn(customer), false);
  });

  test('사장님: 수락 대기 주문이 있으면 거부, 매장 유지', async () => {
    const oid = `pending_${seller.uid}`;
    await db.doc(`orders/${oid}`).set(order({
      orderId: oid, customerId: customer.uid, storeId: seller.uid, storeOwnerId: seller.uid, status: 'paid', paymentId: oid,
    }));
    await assert.rejects(deleteAccount(seller), { status: 'FAILED_PRECONDITION', message: /손님 주문/ });
    assert.equal(await exists(`stores/${seller.uid}`), true);
    assert.equal(await exists(`food_items/${seller.uid}_a`), true);
  });
});
