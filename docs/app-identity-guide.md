# 앱 이름 · 패키지명 · 노쇼 정책 설정 가이드

출시 전에 정해야 하는 세 가지와, 정한 뒤 코드에서 바꿀 곳을 정리했다.

## 1. 앱 이름

| 바꿀 곳 | 의미 |
|---|---|
| `app.json` → `expo.name` | 설치 후 홈 화면 아이콘 아래 이름 (네이티브 빌드에 들어감) |
| `src/constants/brand.ts` → `APP_NAME`, `APP_LOGO`, `APP_TAGLINE` | 앱 화면(로그인·가입·인트로)과 약관·처리방침 문구 |

- 두 곳을 같은 이름으로 맞춘다. 스토어 등록명은 각 스토어 콘솔에서 따로 입력한다.
- **`expo.slug`(`pickup-deal`)는 바꾸지 않는다.** EAS 프로젝트(projectId)가 slug 에 묶여 있어, 바꾸면 `eas init` 을 다시 해야 한다.
- 바꾼 뒤 약관 웹페이지도 다시 배포한다: `npm run deploy:hosting -- --project lastorder-ec049`

## 2. 패키지명 (Android `package` / iOS `bundleIdentifier`)

**규칙**
- 소유한 도메인을 거꾸로 쓴 형식: `com.회사도메인.앱이름` (예: 도메인이 `lastorder.co.kr` 이면 `kr.co.lastorder.app`)
- 영문 소문자·숫자·점만 사용 (하이픈·대문자 금지). 각 마디는 영문자로 시작.
- 두 플랫폼에 같은 값을 쓰는 것을 권장.
- ⚠️ **Play 스토어에 한 번 올리면 Android 패키지명은 영원히 못 바꾼다.** iOS 도 App Store Connect 에 등록한 뒤에는 사실상 고정.

**바꿀 곳**: `app.json` → `expo.ios.bundleIdentifier`, `expo.android.package` (두 곳)

**바꾼 뒤 해야 할 일** (이 값에 묶인 것들)
1. Apple Developer → Identifiers 에 Bundle ID 등록 (EAS 첫 iOS 빌드 때 자동 등록도 가능)
2. Firebase 콘솔 → 프로젝트 설정 → **Android 앱 추가**(새 패키지명) → `google-services.json` 다운로드 → 프로젝트 루트에 두고 `app.json` 에 `"android": { "googleServicesFile": "./google-services.json" }` — Android 푸시(FCM) 수신에 필요
3. EAS 푸시 자격증명: `npx eas-cli@latest credentials` → Android: FCM V1 서비스 계정 키 / iOS: APNs 키
4. Google Cloud 콘솔 → 지도 API 키 제한: Android 앱 제한에 **새 패키지명 + 서명 인증서 SHA-1**(EAS credentials 에서 확인) 추가
5. PortOne 결제 앱 연동은 config plugin 이 처리하므로 추가 작업 없음 (개발 빌드에서 결제창 → 카카오페이·토스 앱 전환 확인)
6. 개발 빌드: `npx eas-cli@latest build --profile development --platform all`

**바꾸지 않는 것**: URL scheme(`expo.scheme`: `pickupdeal`), 픽업 QR 접두사(`pickupdeal:v1:`), 저장소 키 등 내부 식별자는 사용자에게 보이지 않으므로 그대로 둔다.

## 3. 노쇼 환불 정책 — 확정 (2026-10-09: 환불 없음, 유예 30분)

노쇼 = 사장님이 수락했지만 픽업 마감 시간까지 고객이 오지 않은 주문.

**설정 위치**: `shared/policy.ts` → `NO_SHOW_POLICY` (`refund: 'none'`, `graceMinutes: 30`)

| refund | 약관 제6조 ④ 문구 (graceMinutes 30 기준) |
|---|---|
| `none` (현재) | 픽업 마감 시간이 지나고 30분이 지나도록 픽업하지 않으면 노쇼로 처리되며, 판매자가 이미 상품을 준비했으므로 환불되지 않습니다. |
| `partial` (50) | … 상품 준비 비용을 고려해 결제 금액의 50%가 환불됩니다. |
| `full` | … 결제 금액 전액이 환불됩니다. |

**동작** (`expireOrders` 스케줄러, 10분마다 — `functions/src/expiry.ts`)
- 수락된 주문이 마감 + 30분까지 픽업되지 않으면 → 노쇼 (환불 없음, 재고 복구 안 함, 고객에게 푸시)
- 수락되지 않은 주문이 마감 + 30분이 지나면 → 자동 취소 + 전액 환불 + 재고 수량 복구 (고객에게 푸시)
- 고객에게는 결제 전(상품 상세)과 주문 화면에 노쇼 안내 문구가 표시된다.

**정책을 다시 바꿀 때**
1. `NO_SHOW_POLICY` 값 변경 → 약관 문구·앱 안내 문구가 자동으로 바뀜
2. `src/content/legal/documents.ts` 의 `terms.version` 을 오늘 날짜로 올림 → 기존 회원 재동의
3. 배포: `npm run deploy:functions -- --project lastorder-ec049` (자동 처리), `npm run deploy:hosting -- --project lastorder-ec049` (약관 웹페이지)
