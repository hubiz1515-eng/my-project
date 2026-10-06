# PickupDeal

100% 동네 오프라인 픽업 기반 마감 할인 거래 플랫폼 (Expo · TypeScript · Firebase).

## 시작하기
```bash
npm install
cp .env.example .env      # Firebase 웹 앱 설정값 입력
npx expo start
npm run typecheck         # 타입 검사
```

### 배포 (최초 1회, 로컬 PC 에서)
1. **Firebase 요금제를 Blaze(종량제)로 변경** — Cloud Functions 배포에 필요 (소규모 사용은 무료 한도 내).
2. 콘솔 > Authentication > 로그인 방법 > **이메일/비밀번호** 사용 설정 (✅ 확인됨)
3. **보안 규칙·색인 배포** — 지금 DB 가 테스트 모드(누구나 읽기·쓰기)라면 가장 먼저:
   ```bash
   npx firebase-tools login
   npm run deploy:rules -- --project lastorder-ec049
   ```
4. **PortOne 콘솔 설정** (admin.portone.io, V2)
   - 결제연동 > 채널 관리: **토스페이먼츠**(카드) / **카카오페이** 채널 추가 (처음엔 *테스트* 채널)
   - 연동 정보: Store ID, V2 API Secret 확인
   - 웹훅: URL `https://asia-northeast3-lastorder-ec049.cloudfunctions.net/portoneWebhook`, 웹훅 시크릿 확인
5. **Functions 비밀값·설정 후 배포**
   ```bash
   cp functions/.env.example functions/.env          # PORTONE_STORE_ID 입력
   npx firebase-tools functions:secrets:set PORTONE_API_SECRET --project lastorder-ec049
   npx firebase-tools functions:secrets:set PORTONE_WEBHOOK_SECRET --project lastorder-ec049
   npm run deploy:functions -- --project lastorder-ec049
   ```
6. 앱 `.env` 에 `EXPO_PUBLIC_PORTONE_STORE_ID`, `EXPO_PUBLIC_PORTONE_CHANNEL_KEY_TOSS`, `EXPO_PUBLIC_PORTONE_CHANNEL_KEY_KAKAOPAY` 입력 후 `npx expo start -c`
7. 카카오페이·토스 앱으로 넘어가는 결제는 **개발 빌드**에서 확인하세요 (`npx eas-cli@latest build --profile development`). Expo Go 는 결제 앱 연동 설정(config plugin)을 적용하지 못합니다.
8. **EAS 프로젝트 연결** (최초 1회) — `eas.json`(development / preview / production 프로필)은 이미 들어 있습니다.
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init        # Expo 계정에 프로젝트 생성 → app.json 의 expo.extra.eas.projectId 자동 기록
   git add app.json && git commit -m "Link EAS project"
   ```
   ⚠️ `ios.bundleIdentifier` / `android.package` (현재 임시값 `com.example.pickupdeal`)는 첫 빌드·자격증명 등록 **전에** 확정하세요. 푸시(FCM/APNs)·지도 키가 이 값에 묶입니다.

> **리전**: Firestore DB 위치는 `asia-northeast3`(서울)이고 (`npx firebase-tools firestore:databases:get "(default)"` 로 확인), Functions 도 같은 리전에 배포합니다 (`functions/src/index.ts` 의 `setGlobalOptions`, 앱의 `FUNCTIONS_REGION`). Firestore 트리거(`onOrderWritten`)는 DB 와 다른 리전에 배포할 수 없으니 세 곳을 함께 바꾸세요.

> ⚠️ `.env` 나 `EXPO_PUBLIC_*` 값을 바꾼 뒤에는 **캐시를 지우고** 시작하세요: `npx expo start -c` (빌드는 `npx expo export --clear`).
> Metro 캐시가 이전 값을 그대로 번들에 넣어 에뮬레이터/실서버가 섞일 수 있습니다.

### 로컬 에뮬레이터로 개발/테스트 (실데이터와 분리)
```bash
(cd functions && npm install)       # 최초 1회
npm run emulators                   # Auth + Firestore + Functions (Java 필요)
EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo-pickupdeal npx expo start -c
```
- PortOne 키가 없으면 앱은 Mock 결제 시트를 띄우고, **에뮬레이터의 Functions 만** Mock 결제를 승인합니다 (배포된 서버는 거부).
- 테스트 데이터: `npm run seed:emulator` — 서울 주요 상권 8곳에 `[테스트]` 매장·상품 생성 (에뮬레이터 전용, 실서버에서는 실행 거부)
- 테스트: `npm run test:rules` (보안 규칙 19개), `npm run test:functions` (결제·환불·푸시·회원 탈퇴 통합 27개, 가짜 PortOne·푸시 서버 사용)

## 기능 요약
- **인트로** (`/intro`): 첫 실행 시 앱 소개 4장(마감 할인 · 매장 픽업 · QR 픽업 · 사장님). 한 번 보면 이후엔 바로 로그인.
- **로그인/가입** (`/login`, `/signup`): 이메일 + 역할(소비자/사장님) 선택. 역할은 가입 후 변경 불가. 프로필이 없는 계정은 `/profile-setup`.
- **비밀번호 찾기** (`/forgot-password`): Firebase 재설정 메일(한국어). 가입 여부는 노출하지 않고 항상 같은 안내.
- **내 계정** (`/account`, 상단 이름 탭): 계정 정보, 비밀번호 변경 메일, 로그아웃, **회원 탈퇴**(앱스토어·플레이스토어 필수).
  - 탈퇴: 비밀번호 재확인 → `deleteAccount` 함수가 진행 중 주문(수락 대기·픽업 대기)이 있으면 거부, 없으면 매장·상품·프로필·Auth 계정 삭제. 주문·결제 기록은 전자상거래법(5년 보존)에 따라 남김.
- **소비자** (`/`): 반경 3km 판매 중 상품 지도 + 카드 리스트 → 상세(`/item/[id]`)에서 수량·같은 매장 메뉴 함께 담기 → 테스트 결제 → 주문 상세(`/order/[id]`)에서 **픽업 QR + 6자리 코드**, 실시간 진행 상태, 수락 전 취소. `내 주문`(`/orders`).
- **사장님** (`/seller`): 첫 진입 시 매장 등록(계정당 1개) → `상품 관리`(3초 등록, 재고 ±1, 판매중지/품절) / `주문 관리`(수락·거절, 코드 입력 또는 **QR 스캔**(`/scan`)으로 즉시 픽업 완료). 상단 스위치로 소비자 화면도 둘러볼 수 있습니다.
- **QR 스캔 폴백** (`/scan`): 카메라를 쓸 수 없으면(카메라 모듈 없는 빌드, 웹 HTTP 접속, 카메라 없음, 권한 거부, 카메라 시작 실패, 웹 QR 인식 모듈 로드 실패) 이유를 안내하고 **6자리 코드 직접 입력**으로 대체합니다. 카메라가 켜져도 12초간 인식이 없으면 코드 입력을 권합니다.
- **실시간**: 모든 목록은 Firestore `onSnapshot` 구독. 앱이 켜져 있으면 화면 안 알림(OrderToast).
- **푸시 알림**: 주문 상태가 바뀌면 `onOrderWritten` 트리거가 Expo 푸시 서비스(→ FCM/APNs)로 발송 — 사장님: 새 주문·고객 취소 / 고객: 수락·픽업 완료·매장 취소. 알림을 누르면 해당 화면으로 이동. 로그인 시 기기 토큰을 `users.pushTokens` 에 등록, 로그아웃 시 제거, 만료 토큰은 서버가 정리. 웹은 미지원.
  - 필요: 실기기 개발 빌드 + EAS 프로젝트(`npx eas-cli@latest init` → `app.json` 의 `extra.eas.projectId`) + EAS 에 FCM V1 서비스 계정 키·APNs 키 등록 (`npx eas-cli@latest credentials`). 없으면 등록을 조용히 건너뜁니다.
- **지도 (Google Maps)**: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` — 웹은 Maps JavaScript API, Android 는 Maps SDK for Android(`app.config.ts` 가 키 주입, 개발 빌드 필요), iOS 는 Apple 지도. 키가 없거나 API 가 꺼져 있으면 지도 자리에 원인 안내가 뜨고 목록은 그대로 동작합니다. Google Cloud 에서 두 API 를 사용 설정하고 키 제한(HTTP 리퍼러·Android 패키지)을 걸어 두세요.
- **마커 클러스터링**: 축소 화면에서 가까운 매장 핀은 숫자 원으로 묶이고, 누르면 모두 따로 보일 때까지 확대됩니다 (`src/utils/cluster.ts`, 웹·네이티브 공용).
- **범위**: 홈 지도 왼쪽 위 `내 주변 3km` / `서울 전체`(서울시청 반경 22km) 전환. 데이터는 Firestore `stores`·`food_items` 실시간 구독.
- **결제 (PortOne V2 + Cloud Functions)**: 앱은 결제창만 띄우고, 금액 확정·결제 검증·재고 차감·주문 생성·환불은 서버(`functions/`)가 합니다.
  `prepareCheckout`(서버가 금액 확정) → PortOne 결제창(네이티브 SDK / 웹 SDK) → `completeCheckout`(PortOne 조회로 금액·상태 검증 → 주문 생성, 실패 시 자동 환불) · `cancelOrder`(취소·거절 + 환불 + 재고 복구) · `portoneWebhook`(앱이 꺼져도 주문 생성).

## 구조
- `src/app/` — 화면(Expo Router). `_layout.tsx` 에서 로그인 상태·역할별 접근 제어(`Stack.Protected`)
- `src/contexts/AuthContext.tsx` — 로그인 상태 + `users/{uid}` 프로필
- `src/services/` — Firestore/Auth/Functions 접근 (`auth`, `stores`, `foodItems`, `orders`, `checkout`, `payments`)
- `functions/` — Cloud Functions (결제 검증·주문·환불·웹훅), `functions/test/` 통합 테스트
- `shared/` — 앱과 Functions 가 함께 쓰는 순수 규칙 (가격 계산·재고·주문 상태 전이)
- `src/utils/` — `pickupQr`, `pickupTime` 등 (`orderRules`/`foodItemRules` 는 `shared/` 재노출)
- `src/config/firebaseConfig.ts` — Firebase 초기화 (+ 에뮬레이터 연결)
- `firestore.rules`, `firestore.indexes.json`, `tests/firestore.rules.test.mjs` — 보안 규칙 / 색인 / 규칙 테스트
- `docs/firestore-schema.md` — 데이터 구조 설계 문서
