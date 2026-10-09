/**
 * 픽업 마감 후 자동 처리(노쇼·미수락 자동 취소) 통합 테스트.
 * 스케줄러는 에뮬레이터에서 자동 실행되지 않으므로, 같은 처리 함수(processExpiredOrders)를
 * 에뮬레이터 Firestore + 가짜 PortOne 에 연결해 직접 호출한다.
 * 실행: 저장소 루트에서 `npm run test:functions`
 */
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { startFakePortone } from './fakePortone.mjs';

const PROJECT = 'demo-pickupdeal';
const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: PROJECT }));
const MIN = 60_000;
let portone, processExpiredOrders, policy;

before(async () => {
  portone = await startFakePortone(Number(new URL(process.env.PORTONE_API_BASE).port), process.env.PORTONE_API_SECRET);
  // 가짜 PortOne 주소(PORTONE_API_BASE)는 에뮬레이터 환경에서만 쓰이도록 되어 있다 (config.ts)
  process.env.FUNCTIONS_EMULATOR = 'true';
  ({ processExpiredOrders } = await import('../lib/src/expiry.js'));
  policy = await import('../lib/shared/policy.js');
});
after(async () => portone?.close());

const SELLER = 'exp_seller', ALICE = 'exp_alice';
const order = (id, status, endOffsetMin, o = {}) => ({
  orderId: id, customerId: ALICE, customerName: '앨리스', storeId: SELLER, storeOwnerId: SELLER, storeName: '골목 베이커리',
  itemId: `${id}_item`, itemTitle: '빵', unitPrice: 5000, quantity: 2, addOns: [], quantities: { [`${id}_item`]: 2 },
  totalPrice: 10000, pickupCode: '123456', status, paymentId: id, paymentMethod: 'card',
  pickupEndTime: Timestamp.fromMillis(Date.now() + endOffsetMin * MIN), ...o,
});
const seed = async (id, status, endOffsetMin) => {
  await db.doc(`food_items/${id}_item`).set({ itemId: `${id}_item`, storeId: SELLER, ownerId: SELLER, stock: 1, status: 'sold_out' });
  await db.doc(`orders/${id}`).set(order(id, status, endOffsetMin));
  portone.setPayment(id, { total: 10000 });
};
const get = async (path) => (await db.doc(path).get()).data();

describe('정책 판정 (shared/policy)', () => {
  test('유예 30분, 환불 없음', () => {
    assert.equal(policy.NO_SHOW_POLICY.graceMinutes, 30);
    assert.equal(policy.NO_SHOW_POLICY.refund, 'none');
    const end = (min) => ({ toMillis: () => Date.now() + min * MIN });
    assert.equal(policy.expiryActionFor({ status: 'accepted', pickupEndTime: end(-29) }, Date.now()), null);
    assert.equal(policy.expiryActionFor({ status: 'accepted', pickupEndTime: end(-31) }, Date.now()), 'no_show');
    assert.equal(policy.expiryActionFor({ status: 'paid', pickupEndTime: end(-31) }, Date.now()), 'auto_cancel');
    assert.equal(policy.expiryActionFor({ status: 'picked_up', pickupEndTime: end(-300) }, Date.now()), null);
    assert.equal(policy.noShowRefundAmount(14300), 0);
  });
});

describe('processExpiredOrders', () => {
  const ids = {};
  beforeEach(async () => {
    const t = Date.now();
    Object.assign(ids, {
      noShow: `ns_${t}`, // 수락 후 마감 40분 지남 → 노쇼
      graceAccepted: `ga_${t}`, // 수락 후 마감 10분 지남(유예 중) → 그대로
      unaccepted: `ua_${t}`, // 미수락, 마감 45분 지남 → 자동 취소·환불
      gracePaid: `gp_${t}`, // 미수락, 마감 20분 지남 → 그대로
      future: `fu_${t}`, // 마감 전 → 그대로
      done: `dn_${t}`, // 이미 픽업 완료 → 그대로
    });
    await seed(ids.noShow, 'accepted', -40);
    await seed(ids.graceAccepted, 'accepted', -10);
    await seed(ids.unaccepted, 'paid', -45);
    await seed(ids.gracePaid, 'paid', -20);
    await seed(ids.future, 'accepted', 60);
    await seed(ids.done, 'picked_up', -120);
    portone.cancels.length = 0;
  });

  test('수락된 주문은 노쇼(환불 없음·재고 유지), 미수락 주문은 자동 취소(전액 환불·재고 복구), 나머지는 그대로', async () => {
    const r = await processExpiredOrders(Date.now());
    assert.ok(r.noShows >= 1 && r.canceled >= 1, JSON.stringify(r));
    assert.equal(r.refundFailures, 0);

    const ns = await get(`orders/${ids.noShow}`);
    assert.equal(ns.status, 'no_show');
    assert.ok(ns.noShowAt);
    assert.equal(ns.refundStatus, undefined, '환불 없음 정책 — 환불 상태 없음');
    assert.equal((await get(`food_items/${ids.noShow}_item`)).stock, 1, '노쇼는 재고 복구 안 함');

    const ua = await get(`orders/${ids.unaccepted}`);
    assert.equal(ua.status, 'canceled');
    assert.equal(ua.canceledBy, 'system');
    assert.equal(ua.refundStatus, 'done');
    const item = await get(`food_items/${ids.unaccepted}_item`);
    assert.equal(item.stock, 3, '재고 수량 복구');
    assert.equal(item.status, 'sold_out', '상태는 그대로 — 자동 재판매 금지');

    // 환불은 미수락 주문만, 전액
    assert.deepEqual(portone.cancels.map((c) => c.paymentId), [ids.unaccepted]);
    assert.equal(portone.cancels[0].amount, undefined, '금액 미지정 = 전액 취소');

    for (const [id, status] of [[ids.graceAccepted, 'accepted'], [ids.gracePaid, 'paid'], [ids.future, 'accepted'], [ids.done, 'picked_up']]) {
      assert.equal((await get(`orders/${id}`)).status, status, id);
    }
  });

  test('다시 실행해도 중복 처리·중복 환불 없음', async () => {
    await processExpiredOrders(Date.now());
    const cancelsAfterFirst = portone.cancels.length;
    await processExpiredOrders(Date.now());
    assert.equal(portone.cancels.length, cancelsAfterFirst);
    assert.equal((await get(`orders/${ids.noShow}`)).status, 'no_show');
  });

  test('그사이 픽업된 주문은 건드리지 않음 (트랜잭션에서 최신 상태로 재확인)', async () => {
    await db.doc(`orders/${ids.noShow}`).update({ status: 'picked_up' });
    await processExpiredOrders(Date.now());
    assert.equal((await get(`orders/${ids.noShow}`)).status, 'picked_up');
  });
});
