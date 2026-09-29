# Firestore 데이터 구조 설계 (1단계)

> 원칙: **읽기는 싸게(비정규화), 쓰기는 안전하게(서버 트랜잭션)**. 지도/카드 리스트는 1회 쿼리로 그리고,
> 돈·재고·픽업 확정처럼 신뢰가 필요한 쓰기는 Cloud Functions(Admin SDK)에서만 수행합니다.

## 컬렉션 관계

```
users/{uid} ─(1:N)→ stores/{storeId} ─(1:N)→ food_items/{itemId}
     └────────(1:N)→ orders/{orderId} ←──(N:1)── stores / food_items
```

문서 ID = 각 문서의 `uid`/`storeId`/`itemId`/`orderId` 필드 값 (동일하게 저장해 쿼리 결과에서 ID를 바로 사용).
금액은 전부 KRW **정수**. 시각은 Firestore `Timestamp`. 타입 정의: `src/types/models.ts`.

## 1. `users/{uid}`
| 필드 | 타입 | 설명 |
|---|---|---|
| uid | string | Firebase Auth uid |
| role | `'customer' \| 'seller'` | 가입 시 1회 결정, 이후 변경 불가(규칙) |
| name, phone | string | |
| pushTokens | string[] | FCM/Expo 푸시 토큰(기기별) *(추가)* |
| createdAt, updatedAt | Timestamp | *(추가)* |

## 2. `stores/{storeId}`
| 필드 | 타입 | 설명 |
|---|---|---|
| storeId, ownerId | string | ownerId = 사장님 uid |
| storeName, address | string | |
| latitude, longitude | number | 카카오 주소→좌표 변환 결과 |
| geohash | string | 근처 검색용 *(추가)* |
| businessHours | map | `{ mon: {closed, open:'09:00', close:'22:00'}, … sun }` |
| createdAt, updatedAt | Timestamp | *(추가)* |

## 3. `food_items/{itemId}`
| 필드 | 타입 | 설명 |
|---|---|---|
| itemId, storeId | string | |
| title | string | |
| originalPrice, discountPrice | number | 규칙: `0 < discountPrice ≤ originalPrice` |
| stock | number | ≥ 0. 결제 트랜잭션에서 차감, 0이면 `sold_out` |
| pickupEndTime | Timestamp | 이 시각 이후 소비자 리스트에서 제외 |
| status | `'selling' \| 'sold_out' \| 'paused'` | |
| ownerId, storeName, latitude, longitude, geohash | | **비정규화**: 지도 카드용 무조인 조회 + 규칙에서 소유권 검증 *(추가)* |
| isAddOn | boolean | 결제 시 함께 담는 "추가 메뉴(cross-sell)" 후보 여부 *(추가)* |
| imageUrl?, createdAt, updatedAt | | *(추가)* |

**사장님 완전 통제권**: 자동 재판매/자동 재등록 필드·로직 없음. `sold_out`/`paused` → `selling` 전환은
사장님이 직접 할 때만 발생합니다. 마감시간 경과 항목은 서버 변경 없이 쿼리 조건(`pickupEndTime > now`)으로 숨깁니다.

## 4. `orders/{orderId}`
| 필드 | 타입 | 설명 |
|---|---|---|
| orderId, customerId, storeId, itemId | string | itemId = 대표 상품 |
| quantity | number | 대표 상품 수량 |
| totalPrice | number | 대표 + addOns 합계 = 실제 결제액 (서버가 계산·검증) |
| pickupCode | string | 6자리 핀코드. QR 페이로드는 `orderId.pickupCode` |
| status | `'paid' \| 'picked_up' \| 'canceled'` | |
| addOns | `{itemId,title,unitPrice,quantity}[]` | Cross-selling 구매 내역 스냅샷 *(추가)* |
| storeOwnerId, storeName, itemTitle | string | 조회·권한용 비정규화 *(추가)* |
| paymentId | string | PortOne 결제 ID(멱등성 키) *(추가)* |
| paidAt, pickupEndTime, pickedUpAt?, canceledAt?, createdAt, updatedAt | Timestamp | *(추가)* |

## 주요 쿼리 & 인덱스 (`firestore.indexes.json`)
| 화면 | 쿼리 |
|---|---|
| 소비자 지도/리스트 | `food_items` where `status=='selling'` and `geohash` 범위(내 위치 주변 cell들) → 클라이언트에서 `pickupEndTime>now`, `stock>0`, 거리순 정렬 |
| 사장님 상품 관리 | `food_items` where `storeId==X` (+status, pickupEndTime 정렬) |
| 내 주문 | `orders` where `customerId==me` orderBy `createdAt desc` |
| 픽업 대기 목록 | `orders` where `storeId==X` and `status=='paid'` |

Firestore는 서로 다른 필드의 범위 조건을 하나의 쿼리에 못 쓰므로(geohash 범위 + pickupEndTime 범위), geohash만 서버 필터로 쓰고 나머지는 클라이언트에서 거릅니다.

## 보안 규칙 요약 (`firestore.rules`)
- `users`: 본인만 읽기/쓰기, `role` 변경 불가
- `stores`, `food_items`: 전체 공개 읽기, 소유 사장님만 쓰기(재고 ≥ 0, 가격 검증)
- `orders`: 구매자/해당 사장님만 읽기, **클라이언트 쓰기 전면 금지**

## 4단계(결제·픽업)를 위한 서버 책임 — 미리 정해두는 결정 사항
1. `createOrder` (Callable Function): PortOne `paymentId` 서버 검증 → 트랜잭션으로 재고 차감 + 주문 생성 + 핀코드 발급. 재고 부족 시 자동 결제 취소. `paymentId`로 멱등 처리.
2. `confirmPickup` (Callable Function): 사장님이 QR/핀코드 제출 → `paid → picked_up`.
3. Cloud Functions는 Firebase **Blaze(종량제)** 요금제가 필요합니다.

## 알아둘 점
- **FCM**: Firebase JS SDK는 React Native에서 `messaging`을 지원하지 않습니다. 푸시는 `expo-notifications`(FCM 자격증명 연동) 또는 `@react-native-firebase/messaging`(Dev Build 필요) 중 선택해야 하며, 토큰을 `users.pushTokens`에 저장합니다. 3단계 이전에 결정하면 됩니다.
- **카카오맵**: RN 전용 SDK가 없어 2단계에서 `react-native-webview` + Kakao JS SDK로 구현하는 방식을 제안합니다.
- **비밀키**: PortOne API Secret 등은 `EXPO_PUBLIC_*`(앱 번들에 노출)에 넣지 말고 Functions의 Secret Manager로.
