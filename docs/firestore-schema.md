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
| agreements | map | 약관 동의 기록: `termsVersion`, `privacyVersion`, `locationVersion`(동의한 문서 버전), `over14`(true), `agreedAt`(서버 시각). 생성 시 필수, 형식은 규칙이 검증. 버전이 현재보다 낮으면 앱이 재동의를 받음 *(추가)* |
| createdAt, updatedAt | Timestamp | *(추가)* |

## 2. `stores/{storeId}`
> **문서 ID = 사장님 uid** (계정당 매장 1개). `storeId == ownerId`.
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
| pickupCode | string | 6자리 핀코드. QR 페이로드는 `pickupdeal:v1:{orderId}:{pickupCode}` (`src/utils/pickupQr.ts`) |
| status | `'paid' \| 'accepted' \| 'picked_up' \| 'canceled' \| 'no_show'` | `accepted` *(4단계 추가)*: 사장님 수락. `no_show`: 수락 후 픽업 마감 + 유예 시간까지 미방문 *(추가)* |
| addOns | `{itemId,title,unitPrice,quantity}[]` | Cross-selling 구매 내역 스냅샷 *(추가)* |
| quantities | `map<itemId, number>` | 대표+추가 메뉴 수량 |
| refundStatus? | `'pending' \| 'done' \| 'failed'` | 취소된 주문의 환불 진행 상태 (failed = 수동 환불 필요) *(6단계 추가)* |
| storeOwnerId, storeName, itemTitle, customerName | string | 조회·권한용 비정규화 *(추가)* |
| unitPrice | number | 대표 상품 주문 시점 단가 *(추가)* |
| paymentId | string | PortOne 결제 ID. **주문 문서 ID == paymentId == checkout ID** (멱등성 키) |
| paymentMethod | `'card' \| 'kakaopay'` | 카드(토스페이먼츠 채널) / 카카오페이 채널 |
| canceledBy? | `'customer' \| 'seller' \| 'system'` | system = 미수락 자동 취소 *(추가)* |
| noShowAt? | Timestamp | 노쇼 처리 시각 *(추가)* |
| refundAmount? | number | 노쇼 부분·전액 환불 금액 (현재 정책은 환불 없음이라 없음) *(추가)* |
| paidAt, pickupEndTime, acceptedAt?, pickedUpAt?, canceledAt?, createdAt, updatedAt | Timestamp | pickupEndTime = 담은 상품 중 가장 이른 마감 *(추가)* |

### 주문 상태 전이 (`src/utils/orderRules.ts`)
```
paid ──accept──▶ accepted ──pickup(코드 일치)──▶ picked_up
 │  └─pickup(수락 전 방문도 허용)─────────────────▲
 ├─customer_cancel (수락 전만) ─▶ canceled        accepted ──(마감+30분, 자동)──▶ no_show
 ├─reject (paid·accepted) ──────▶ canceled
 └─(마감+30분 미수락, 자동) ────▶ canceled (system)
```
- 취소/거절 시 결제 취소(환불) + **재고 수량만 복구, 상품 상태는 유지**. 품절됐던 상품은 사장님이 '판매 재개'를 눌러야 다시 노출됩니다(자동 재판매 금지).
- **자동 처리** (`expireOrders` 스케줄러, 10분마다 · `functions/src/expiry.ts`): 픽업 마감 + 유예 시간(`shared/policy.ts`, 30분)이 지나면
  - `accepted` → `no_show`: 노쇼 정책에 따라 처리 (현재: **환불 없음**, 재고 복구 안 함 — 이미 준비된 상품)
  - `paid`(미수락) → `canceled`(`canceledBy: 'system'`): 전액 환불 + 재고 수량 복구
  - 유예 시간 안에는 사장님이 늦게 온 손님을 픽업 완료 처리할 수 있다. 색인: `orders (status, pickupEndTime)`.

## 5. `checkouts/{paymentId}` *(6단계 추가)*
결제 전에 서버(`prepareCheckout`)가 확정한 장바구니·금액. PortOne 결제 금액을 이 값과 대조한다. **Functions 만 쓰기, 구매자만 읽기.**
| 필드 | 타입 | 설명 |
|---|---|---|
| paymentId | string | PortOne paymentId (= 문서 ID = 생성될 주문 ID) |
| customerId, customerName, storeId, storeOwnerId, storeName | string | |
| lines | `OrderLine[]` | 대표 상품 + 추가 메뉴 (결제 시점 가격 스냅샷) |
| totalPrice | number | 서버가 계산한 결제 금액 |
| orderName, paymentMethod | string | |
| status | `'pending' \| 'completed' \| 'failed'` | completed = 주문 생성됨, failed = 검증 실패/재고 부족(→ 환불) |
| failureReason?, refundStatus? | | |

## 6. `account_deletions/{uid}` *(회원 탈퇴)*
`deleteAccount` 함수가 탈퇴 처리 직전에 남기는 기록 (운영·분쟁 대응용). 개인정보(이메일·이름·전화)는 즉시 파기 원칙에 따라 **저장하지 않는다**. **Functions 만 쓰기, 클라이언트 읽기·쓰기 불가.**
| 필드 | 타입 | 설명 |
|---|---|---|
| uid | string | 탈퇴한 계정 uid (= 문서 ID, 재시도 시 덮어씀) |
| role | `'customer' \| 'seller' \| 'unknown'` | 탈퇴 시점 역할 (프로필이 없던 계정은 unknown) |
| deletedItemCount | number | 함께 삭제한 상품 수 (사장님) |
| hadStore | boolean | 매장을 함께 삭제했는지 |
| deletedAt | Timestamp | 서버 시각 |

탈퇴 시 삭제: `users/{uid}`, `stores/{uid}`, 해당 `food_items`, Auth 계정. 보존: `orders`, `checkouts` (전자상거래법 거래 기록 5년).

## 주요 쿼리 & 색인 (`firestore.indexes.json`)
| 화면 | 쿼리 |
|---|---|
| 소비자 지도/리스트 | `food_items` where `status=='selling'` orderBy `geohash` startAt/endAt (내 주변 3km 또는 서울 전체 22km 를 덮는 geohash 범위 여러 개, `geofire-common`) → 실제 거리·마감시간·재고는 클라이언트에서 필터 |
| 상품 상세 '함께 담기' / 사장님 상품 관리 | `food_items` where `storeId==X` |
| 내 주문 | `orders` where `customerId==me` orderBy `createdAt desc` |
| 사장님 주문 관리 | `orders` where `storeOwnerId==me` orderBy `createdAt desc` (규칙이 `storeOwnerId` 로 권한을 판단하므로 쿼리도 같은 필드 사용) |
| 픽업 코드 확인 | `orders` where `storeOwnerId==me` and `pickupCode==X` and `status in [paid, accepted]` |

## 보안 규칙 요약 (`firestore.rules`, 테스트: `tests/firestore.rules.test.mjs`)
- `users`: 본인만 읽기/쓰기, `role` 변경 불가, 생성 시 약관 동의 기록(`agreements`) 필수·형식 검증
- `stores`: 전체 공개 읽기, 사장님(role=seller)이 자기 uid 문서로만 생성
- `food_items`: 전체 공개 읽기, **소유 사장님만** 쓰기(가격·재고 검증). 주문에 따른 재고 증감은 Functions 만.
- `orders`: 구매자/해당 사장님만 읽기. **생성·취소 불가(Functions 전용)**. 사장님은 수락(`paid→accepted`)·픽업 완료(`→picked_up`)만.
- `checkouts`: 구매자만 읽기, 쓰기 불가.
- `account_deletions`, `push_events`: 클라이언트 접근 불가 (Functions 전용).

## 결제 흐름 (PortOne V2 + Cloud Functions, `functions/src`)
```
앱                         Cloud Functions                         PortOne
 │ prepareCheckout(장바구니) ─▶ 최신 가격·재고로 금액 계산
 │                            checkouts/{paymentId} 생성 (pending)
 │ ◀─ { paymentId, totalAmount, orderName }
 │ 결제창(paymentId, 금액) ─────────────────────────────────────────▶ 결제
 │ completeCheckout(paymentId) ─▶ getPayment: PAID? 금액·통화·상점 일치? ◀─▶
 │                            트랜잭션: 재고 확인·차감 + orders/{paymentId} 생성
 │                            (재고 부족·금액 불일치 → checkout failed + cancelPayment 환불)
 │ ◀─ { orderId }
 │                            portoneWebhook(Transaction.Paid) ◀───────── 웹훅 (서명 검증)
 │                            → 같은 completeCheckout (멱등: 이미 처리됐으면 그대로)
 │ cancelOrder(orderId) ──────▶ 권한·상태 확인 → canceled + 재고 복구 → cancelPayment → refundStatus
```
- **멱등성**: 주문 ID = paymentId, 트랜잭션에서 checkout 상태로 중복 생성·중복 차감·중복 환불을 막는다.
- **가격 변경**: 결제 준비 후 사장님이 가격을 바꿔도 고객이 동의한 결제 시점 금액으로 주문한다.
- **재고 예약 없음**: 결제 준비 시 재고를 잡지 않는다(버려진 결제창이 재고를 묶지 않도록). 결제 사이에 품절되면 자동 환불.
- **Mock 결제**: API Secret 이 없을 때 **에뮬레이터에서만** 승인. 배포 환경에서는 Secret 이 없으면 결제 확정을 거부.
- **환불 실패**: 주문은 취소 상태로 두고 `refundStatus: 'failed'` + 에러 로그 → 콘솔에서 수동 환불.
- 미처리: 노쇼(픽업 시간 경과 미수령) 정책, PortOne 콘솔에서 직접 취소한 결제의 웹훅(`Transaction.Cancelled`) 반영.

## 알아둘 점
- **FCM**: Firebase JS SDK는 React Native에서 `messaging`을 지원하지 않습니다. 푸시는 `expo-notifications`(FCM 자격증명 연동) 또는 `@react-native-firebase/messaging`(Dev Build 필요) 중 선택해야 하며, 토큰을 `users.pushTokens`에 저장합니다.
- **QR 스캔**: 네이티브는 `expo-camera`(Expo Go 포함). 웹은 브라우저 `BarcodeDetector` 가 없으면 ZXing wasm 폴리필을 jsdelivr CDN 에서 내려받습니다.
- **카카오맵**: RN 전용 SDK가 없어 2단계에서 `react-native-webview` + Kakao JS SDK로 구현하는 방식을 제안합니다.
- **비밀키**: PortOne API Secret 등은 `EXPO_PUBLIC_*`(앱 번들에 노출)에 넣지 말고 Functions의 Secret Manager로.
