# PickupDeal

100% 동네 오프라인 픽업 기반 마감 할인 거래 플랫폼 (Expo · TypeScript · Firebase).

## 시작하기
```bash
npm install
cp .env.example .env      # Firebase 웹 앱 설정값 입력
npx expo start
npm run typecheck         # 타입 검사
```

### Firebase 준비 (최초 1회, 로컬 PC 에서)
1. 콘솔 > Authentication > 로그인 방법 > **이메일/비밀번호** 사용 설정
2. 보안 규칙·색인 배포 — 이것 없이는 모든 읽기/쓰기가 거부되거나 색인 오류가 납니다.
   ```bash
   npx firebase-tools login
   npx firebase-tools deploy --only firestore --project lastorder-ec049
   ```
   색인 생성에는 몇 분 걸릴 수 있습니다.

> ⚠️ `.env` 나 `EXPO_PUBLIC_*` 값을 바꾼 뒤에는 **캐시를 지우고** 시작하세요: `npx expo start -c` (빌드는 `npx expo export --clear`).
> Metro 캐시가 이전 값을 그대로 번들에 넣어 에뮬레이터/실서버가 섞일 수 있습니다.

### 로컬 에뮬레이터로 개발/테스트 (실데이터와 분리)
```bash
npx firebase-tools emulators:start --project demo-pickupdeal    # 또는 npm run emulators (firebase-tools 설치 시)
EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo-pickupdeal npx expo start
```
보안 규칙 테스트 (Java 필요): `npx firebase-tools emulators:exec --only firestore --project demo-pickupdeal "node --test tests/firestore.rules.test.mjs"` (= `npm run test:rules`)

## 기능 요약
- **로그인/가입** (`/login`, `/signup`): 이메일 + 역할(소비자/사장님) 선택. 역할은 가입 후 변경 불가. 프로필이 없는 계정은 `/profile-setup`.
- **소비자** (`/`): 반경 3km 판매 중 상품 지도 + 카드 리스트 → 상세(`/item/[id]`)에서 수량·같은 매장 메뉴 함께 담기 → 테스트 결제 → 주문 상세(`/order/[id]`)에서 **픽업 QR + 6자리 코드**, 실시간 진행 상태, 수락 전 취소. `내 주문`(`/orders`).
- **사장님** (`/seller`): 첫 진입 시 매장 등록(계정당 1개) → `상품 관리`(3초 등록, 재고 ±1, 판매중지/품절) / `주문 관리`(수락·거절, 코드 입력 또는 **QR 스캔**(`/scan`)으로 즉시 픽업 완료). 상단 스위치로 소비자 화면도 둘러볼 수 있습니다.
- **QR 스캔 폴백** (`/scan`): 카메라를 쓸 수 없으면(카메라 모듈 없는 빌드, 웹 HTTP 접속, 카메라 없음, 권한 거부, 카메라 시작 실패, 웹 QR 인식 모듈 로드 실패) 이유를 안내하고 **6자리 코드 직접 입력**으로 대체합니다. 카메라가 켜져도 12초간 인식이 없으면 코드 입력을 권합니다.
- **실시간**: 모든 목록은 Firestore `onSnapshot` 구독. 새 주문/수락/픽업/취소 시 인앱 알림(추후 FCM 푸시).
- **카카오맵**: `EXPO_PUBLIC_KAKAO_JS_KEY` 가 비어 있으면 Mock 지도. 키를 넣으면 WebView 로 실제 지도(카카오 콘솔 > 플랫폼 > Web 에 `https://localhost` 등록). REST 키를 넣으면 매장 등록 시 '주소로 찾기' 사용 가능.
- **결제**: 아직 Mock(`src/services/payments.ts`, `MockPaymentSheet`). PortOne 연동 지점에 TODO.

## 구조
- `src/app/` — 화면(Expo Router). `_layout.tsx` 에서 로그인 상태·역할별 접근 제어(`Stack.Protected`)
- `src/contexts/AuthContext.tsx` — 로그인 상태 + `users/{uid}` 프로필
- `src/services/` — Firestore/Auth 접근 (`auth`, `stores`, `foodItems`, `orders`, `payments`)
- `src/utils/` — 순수 규칙 (`orderRules`, `foodItemRules`, `pickupQr`, `pickupTime`)
- `src/config/firebaseConfig.ts` — Firebase 초기화 (+ 에뮬레이터 연결)
- `firestore.rules`, `firestore.indexes.json`, `tests/firestore.rules.test.mjs` — 보안 규칙 / 색인 / 규칙 테스트
- `docs/firestore-schema.md` — 데이터 구조 설계 문서
