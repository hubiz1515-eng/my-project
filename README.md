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

## 구조
- `src/config/firebaseConfig.ts` — Firebase 초기화 (`app`, `auth`, `db`)
- `src/config/collections.ts` — 타입이 적용된 컬렉션/문서 참조
- `src/types/models.ts` — Firestore 문서 타입
- `firestore.rules`, `firestore.indexes.json` — 보안 규칙 / 인덱스
- `docs/firestore-schema.md` — 데이터 구조 설계 문서
