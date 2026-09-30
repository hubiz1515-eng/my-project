/**
 * Firestore 보안 규칙 테스트.
 * 실행: npm run test:rules  (Firestore 에뮬레이터를 띄워 node:test 로 실행)
 */
import { after, before, beforeEach, describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, writeBatch, Timestamp } from 'firebase/firestore';

const SELLER = 'seller1';
const SELLER2 = 'seller2';
const ALICE = 'alice';
const BOB = 'bob';
const ITEM = 'item1';
const ADDON = 'item2';

let env;
const db = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const later = Timestamp.fromMillis(Date.now() + 3600_000);

const item = (overrides = {}) => ({
  itemId: ITEM, storeId: SELLER, ownerId: SELLER, storeName: '골목 베이커리',
  title: '빵 랜덤박스', originalPrice: 15000, discountPrice: 5900, stock: 3,
  pickupEndTime: later, status: 'selling', latitude: 37.5, longitude: 127.0, geohash: 'wydm',
  isAddOn: false, ...overrides,
});

const order = (overrides = {}) => ({
  orderId: 'o1', customerId: ALICE, customerName: '앨리스', storeId: SELLER, storeOwnerId: SELLER,
  storeName: '골목 베이커리', itemId: ITEM, itemTitle: '빵 랜덤박스', unitPrice: 5900, quantity: 2,
  addOns: [], quantities: { [ITEM]: 2 }, totalPrice: 11800, pickupCode: '123456', status: 'paid',
  paymentId: 'mock', paymentMethod: 'tosspay', paidAt: Timestamp.now(), pickupEndTime: later, ...overrides,
});

async function seed(fn) {
  await env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-pickupdeal',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await seed(async (f) => {
    await setDoc(doc(f, 'users', SELLER), { uid: SELLER, role: 'seller', name: '사장' });
    await setDoc(doc(f, 'users', SELLER2), { uid: SELLER2, role: 'seller', name: '사장2' });
    await setDoc(doc(f, 'users', ALICE), { uid: ALICE, role: 'customer', name: '앨리스' });
    await setDoc(doc(f, 'users', BOB), { uid: BOB, role: 'customer', name: '밥' });
    await setDoc(doc(f, 'stores', SELLER), { storeId: SELLER, ownerId: SELLER, storeName: '골목 베이커리' });
    await setDoc(doc(f, 'food_items', ITEM), item());
    await setDoc(doc(f, 'food_items', ADDON), item({ itemId: ADDON, title: '식빵', discountPrice: 2500, originalPrice: 5000, stock: 5 }));
  });
});

/** 고객 주문 생성 배치 (재고 차감 + 주문 생성) */
function orderBatch(f, { orderId = 'o1', mainDelta = 2, data = {}, withAddOn = false } = {}) {
  const b = writeBatch(f);
  b.update(doc(f, 'food_items', ITEM), { stock: 3 - mainDelta, status: 3 - mainDelta === 0 ? 'sold_out' : 'selling', lastOrderId: orderId });
  if (withAddOn) b.update(doc(f, 'food_items', ADDON), { stock: 4, lastOrderId: orderId });
  b.set(doc(f, 'orders', orderId), order({
    orderId,
    ...(withAddOn ? { addOns: [{ itemId: ADDON, title: '식빵', unitPrice: 2500, quantity: 1 }], quantities: { [ITEM]: 2, [ADDON]: 1 }, totalPrice: 14300 } : {}),
    ...data,
  }));
  return b;
}

describe('users', () => {
  test('본인 프로필 생성/조회 가능, 남의 것은 불가', async () => {
    await assertSucceeds(setDoc(doc(db('carol'), 'users/carol'), { uid: 'carol', role: 'customer', name: '캐롤' }));
    await assertFails(setDoc(doc(db('carol'), 'users/dave'), { uid: 'dave', role: 'customer', name: '데이브' }));
    await assertFails(getDoc(doc(db(ALICE), 'users', BOB)));
  });
  test('역할 변경 불가', async () => {
    await assertFails(updateDoc(doc(db(ALICE), 'users', ALICE), { role: 'seller' }));
    await assertSucceeds(updateDoc(doc(db(ALICE), 'users', ALICE), { name: '앨리스2' }));
  });
});

describe('stores', () => {
  test('사장님만 자기 uid 로 매장 생성', async () => {
    await assertSucceeds(setDoc(doc(db(SELLER2), 'stores', SELLER2), { storeId: SELLER2, ownerId: SELLER2, storeName: 'B' }));
    await assertFails(setDoc(doc(db(ALICE), 'stores', ALICE), { storeId: ALICE, ownerId: ALICE, storeName: 'A' }));
    await assertFails(setDoc(doc(db(SELLER2), 'stores', 'other'), { storeId: 'other', ownerId: SELLER2, storeName: 'X' }));
  });
  test('누구나 조회', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'stores', SELLER)));
  });
});

describe('food_items', () => {
  test('사장님이 자기 매장 상품 등록, 가격 규칙 위반은 거부', async () => {
    const f = db(SELLER);
    await assertSucceeds(setDoc(doc(f, 'food_items', 'n1'), item({ itemId: 'n1' })));
    await assertFails(setDoc(doc(f, 'food_items', 'n2'), item({ itemId: 'n2', discountPrice: 20000 })));
    await assertFails(setDoc(doc(db(SELLER2), 'food_items', 'n3'), item({ itemId: 'n3' })));
  });
  test('다른 사장님/고객은 임의로 재고·가격 수정 불가', async () => {
    await assertFails(updateDoc(doc(db(SELLER2), 'food_items', ITEM), { stock: 99 }));
    await assertFails(updateDoc(doc(db(ALICE), 'food_items', ITEM), { stock: 0, status: 'sold_out' }));
    await assertFails(updateDoc(doc(db(ALICE), 'food_items', ITEM), { discountPrice: 100 }));
  });
  test('사장님은 재고·상태 수정 가능', async () => {
    await assertSucceeds(updateDoc(doc(db(SELLER), 'food_items', ITEM), { stock: 10, status: 'paused' }));
  });
});

describe('orders: 생성', () => {
  test('재고 차감 + 주문 생성 (추가 메뉴 포함)', async () => {
    await assertSucceeds(orderBatch(db(ALICE), { withAddOn: true }).commit());
  });
  test('마지막 재고 구매 시 sold_out 으로', async () => {
    await assertSucceeds(orderBatch(db(ALICE), { mainDelta: 3, data: { quantity: 3, quantities: { [ITEM]: 3 } } }).commit());
  });
  test('주문 수량과 재고 차감량이 다르면 거부', async () => {
    await assertFails(orderBatch(db(ALICE), { mainDelta: 1 }).commit());
  });
  test('재고 차감 없이 주문만 만들면 거부', async () => {
    await assertFails(setDoc(doc(db(ALICE), 'orders', 'o1'), order()));
  });
  test('남의 이름으로 주문 생성 불가', async () => {
    await assertFails(orderBatch(db(BOB)).commit());
  });
  test('판매중지 상품은 주문 불가', async () => {
    await seed((f) => updateDoc(doc(f, 'food_items', ITEM), { status: 'paused' }));
    await assertFails(orderBatch(db(ALICE)).commit());
  });
  test('이미 있는 주문 ID 로 재고를 또 차감할 수 없음', async () => {
    await assertSucceeds(orderBatch(db(ALICE), { mainDelta: 1, data: { quantity: 1, quantities: { [ITEM]: 1 } } }).commit());
    await assertFails(updateDoc(doc(db(ALICE), 'food_items', ITEM), { stock: 1, lastOrderId: 'o1' }));
  });
});

describe('orders: 조회·상태 변경', () => {
  beforeEach(async () => {
    await seed(async (f) => {
      await setDoc(doc(f, 'food_items', ITEM), item({ stock: 1, lastOrderId: 'o1' }));
      await setDoc(doc(f, 'orders', 'o1'), order());
    });
  });

  test('구매자와 해당 매장 사장님만 조회', async () => {
    await assertSucceeds(getDoc(doc(db(ALICE), 'orders/o1')));
    await assertSucceeds(getDoc(doc(db(SELLER), 'orders/o1')));
    await assertFails(getDoc(doc(db(BOB), 'orders/o1')));
    await assertFails(getDoc(doc(db(SELLER2), 'orders/o1')));
  });

  test('고객: 수락 전 취소 + 재고 복구', async () => {
    const f = db(ALICE);
    const b = writeBatch(f);
    b.update(doc(f, 'orders/o1'), { status: 'canceled', canceledBy: 'customer' });
    b.update(doc(f, 'food_items', ITEM), { stock: 3, lastOrderId: 'o1' });
    await assertSucceeds(b.commit());
  });

  test('고객: 취소 없이 재고만 늘리기 불가', async () => {
    await assertFails(updateDoc(doc(db(ALICE), 'food_items', ITEM), { stock: 3, lastOrderId: 'o1' }));
  });

  test('고객: 재고 복구하면서 품절→판매중 전환 불가 (자동 재판매 금지)', async () => {
    await seed((f) => updateDoc(doc(f, 'food_items', ITEM), { stock: 0, status: 'sold_out' }));
    const f = db(ALICE);
    const b = writeBatch(f);
    b.update(doc(f, 'orders/o1'), { status: 'canceled', canceledBy: 'customer' });
    b.update(doc(f, 'food_items', ITEM), { stock: 2, status: 'selling', lastOrderId: 'o1' });
    await assertFails(b.commit());
  });

  test('고객: 수락 후에는 취소 불가, 스스로 수락/픽업 처리 불가', async () => {
    await assertFails(updateDoc(doc(db(ALICE), 'orders/o1'), { status: 'accepted' }));
    await assertFails(updateDoc(doc(db(ALICE), 'orders/o1'), { status: 'picked_up' }));
    await seed((f) => updateDoc(doc(f, 'orders/o1'), { status: 'accepted' }));
    await assertFails(updateDoc(doc(db(ALICE), 'orders/o1'), { status: 'canceled', canceledBy: 'customer' }));
  });

  test('주문 금액·코드 등 다른 필드 수정 불가', async () => {
    await assertFails(updateDoc(doc(db(ALICE), 'orders/o1'), { status: 'canceled', canceledBy: 'customer', totalPrice: 1 }));
    await assertFails(updateDoc(doc(db(SELLER), 'orders/o1'), { status: 'accepted', pickupCode: '000000' }));
  });

  test('사장님: 수락 → 픽업 완료, 다른 매장 사장님은 불가', async () => {
    await assertFails(updateDoc(doc(db(SELLER2), 'orders/o1'), { status: 'accepted' }));
    await assertSucceeds(updateDoc(doc(db(SELLER), 'orders/o1'), { status: 'accepted' }));
    await assertSucceeds(updateDoc(doc(db(SELLER), 'orders/o1'), { status: 'picked_up' }));
    await assertFails(updateDoc(doc(db(SELLER), 'orders/o1'), { status: 'paid' }));
  });

  test('사장님: 거절(취소)', async () => {
    await assertSucceeds(updateDoc(doc(db(SELLER), 'orders/o1'), { status: 'canceled', canceledBy: 'seller' }));
  });
});
