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

## 구조
- `src/config/firebaseConfig.ts` — Firebase 초기화 (`app`, `auth`, `db`)
- `src/config/collections.ts` — 타입이 적용된 컬렉션/문서 참조
- `src/types/models.ts` — Firestore 문서 타입
- `firestore.rules`, `firestore.indexes.json` — 보안 규칙 / 인덱스
- `docs/firestore-schema.md` — 데이터 구조 설계 문서
