# PickupDeal

100% 동네 오프라인 픽업 기반 마감 할인 거래 플랫폼 (Expo · TypeScript · Firebase).

## 시작하기
```bash
npm install
cp .env.example .env      # Firebase 웹 앱 설정값 입력
npx expo start
npx tsc --noEmit          # 타입 검사
```
Firebase 규칙/인덱스 배포: `npx firebase-tools deploy --only firestore`

## 소비자 메인 화면 (2단계)
- 상단 지도 + 하단 마감 할인 카드 리스트, 정렬(가까운순/할인율순/마감임박순), 핀↔카드 연동
- 판매 중 · 재고 있음 · 마감 전 상품만 노출 (`src/app/index.tsx`)
- 현재는 Mock 데이터(`src/mocks/foodItems.ts`)이며 `src/services/foodItems.ts` 만 Firestore 쿼리로 교체하면 됩니다.
- **카카오맵**: `.env` 의 `EXPO_PUBLIC_KAKAO_JS_KEY` 가 비어 있으면 Mock 지도를, 채우면 WebView 로 실제 카카오맵을 표시합니다.
  카카오 개발자 콘솔 > 플랫폼 > Web 에 `https://localhost` 를 등록해야 합니다.
- 위치 권한 거부/무응답(6초) 시 기본 위치(강남역)로 대체됩니다.

## 사장님 관리 화면 (3단계)
- 상단 **테스트 모드 스위치**(🛍️ 소비자 ↔ 🏪 사장님)로 전환 — 로그인/역할 연동 전 임시 (`src/components/ModeSwitch.tsx`)
- **3초 등록 폼**: 상품명·원가·할인가·마감시간·수량. 할인율 칩(30/50/70%), 마감 칩(30분/1시간/2시간 후), 최근 상품 재등록 칩
- **즉시 제어**: 재고 −1/+1, 판매중지/재개, 품절 처리 (`src/app/seller.tsx`)
- 재고·상태 규칙은 `src/utils/foodItemRules.ts` (재고 0 → 품절, 사장님이 +1 하면 판매 재개, 자동 재판매 없음)
- 두 화면은 같은 Mock 저장소(`src/services/foodItems.ts`)를 구독하므로 사장님의 변경이 소비자 화면에 즉시 반영됩니다.

## 구조
- `src/config/firebaseConfig.ts` — Firebase 초기화 (`app`, `auth`, `db`)
- `src/config/collections.ts` — 타입이 적용된 컬렉션/문서 참조
- `src/types/models.ts` — Firestore 문서 타입
- `firestore.rules`, `firestore.indexes.json` — 보안 규칙 / 인덱스
- `docs/firestore-schema.md` — 데이터 구조 설계 문서
