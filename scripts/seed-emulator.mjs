/**
 * 로컬 에뮬레이터 전용 테스트 데이터: 서울 주요 상권 8곳에 [테스트] 매장 + 마감 상품.
 * 실서버 보호: FIRESTORE_EMULATOR_HOST 가 없으면 실행하지 않는다.
 *   npm run emulators   (다른 터미널)
 *   npm run seed:emulator
 */
import { createRequire } from 'node:module';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const { geohashForLocation } = createRequire(import.meta.url)('geofire-common');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('FIRESTORE_EMULATOR_HOST 가 없습니다. 실서버 보호를 위해 에뮬레이터에서만 실행합니다.');
  process.exit(1);
}
const db = getFirestore(initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-pickupdeal' }));

const AREAS = [
  ['gangnam', '[테스트] 강남역 베이커리', '서울 강남구 강남대로 396 일대', 37.4979, 127.0276, [['오늘의 빵 랜덤박스', 15000, 5900, 4], ['소금빵 2개', 7000, 3500, 6]]],
  ['hongdae', '[테스트] 홍대 샌드위치', '서울 마포구 양화로 160 일대', 37.5572, 126.9245, [['클럽 샌드위치', 8500, 4200, 3], ['아이스 아메리카노', 4500, 2000, 8]]],
  ['seongsu', '[테스트] 성수 디저트랩', '서울 성동구 아차산로 100 일대', 37.5446, 127.0559, [['조각 케이크 2종', 13000, 5500, 2]]],
  ['jongno', '[테스트] 광화문 도시락', '서울 종로구 세종대로 172 일대', 37.5714, 126.9768, [['제육 도시락', 9000, 4500, 5], ['참치김밥', 4000, 2000, 7]]],
  ['yeouido', '[테스트] 여의도 샐러드', '서울 영등포구 국제금융로 10 일대', 37.5216, 126.9243, [['닭가슴살 샐러드', 8900, 3900, 6]]],
  ['jamsil', '[테스트] 잠실 반찬가게', '서울 송파구 올림픽로 240 일대', 37.5133, 127.1001, [['반찬 3종 세트', 12000, 6000, 4]]],
  ['itaewon', '[테스트] 이태원 피자', '서울 용산구 이태원로 177 일대', 37.5345, 126.9946, [['조각 피자 2개', 9000, 4000, 5]]],
  ['konkuk', '[테스트] 건대 초밥', '서울 광진구 능동로 120 일대', 37.5404, 127.0692, [['모듬초밥 10pcs', 18000, 8900, 3]]],
];

const now = Date.now();
const batch = db.batch();
for (const [key, storeName, address, lat, lng, items] of AREAS) {
  const ownerId = `test_owner_${key}`;
  const geohash = geohashForLocation([lat, lng]);
  batch.set(db.doc(`users/${ownerId}`), { uid: ownerId, role: 'seller', name: `${storeName} 사장님`, phone: '010-0000-0000', pushTokens: [] });
  batch.set(db.doc(`stores/${ownerId}`), {
    storeId: ownerId, ownerId, storeName, address, latitude: lat, longitude: lng, geohash,
    businessHours: {}, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  items.forEach(([title, originalPrice, discountPrice, stock], i) => {
    const itemId = `test_${key}_${i}`;
    batch.set(db.doc(`food_items/${itemId}`), {
      itemId, storeId: ownerId, ownerId, storeName, latitude: lat, longitude: lng, geohash,
      title, originalPrice, discountPrice, stock, status: 'selling', isAddOn: false,
      pickupEndTime: Timestamp.fromMillis(now + (6 * 60 + i * 30) * 60_000), // 6시간 뒤부터
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
  });
}
await batch.commit();
console.log(`seeded ${AREAS.length} test stores in Seoul (emulator)`);
process.exit(0);
