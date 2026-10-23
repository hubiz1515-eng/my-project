# 럭키 가디언즈 (Lucky Guardians)

**운빨 합성 디펜스** — 유닛을 랜덤으로 소환하고, 같은 유닛을 합성해서, 가장자리 길을 끝없이 도는 몬스터를 막아내는 모바일 게임입니다.
푸드 클럽 앱(저장소 루트)과는 **완전히 별개인 독립 Expo 프로젝트**입니다.

- Expo SDK 57 · React Native 0.86 · Expo Router
- 렌더링: `@shopify/react-native-skia` (iOS / Android / Web 동일 코드)
- 그래픽·사운드 에셋은 전부 코드로 만들었습니다 (절차적 벡터 스프라이트, 합성한 효과음/배경음)

## 게임 규칙

| 요소 | 설명 |
| --- | --- |
| **소환** | 골드로 유닛을 랜덤 소환합니다. 소환할 때마다 비용이 +2씩 올라요. 같은 유닛은 한 칸에 최대 3기까지 쌓입니다. |
| **합성** | 같은 유닛 3기 → 한 단계 위 등급의 랜덤 유닛. 7% 확률로 두 단계가 오르는 **대박**! (일반→희귀→영웅→전설) |
| **조합** | 신화·초월 유닛은 레시피 조합으로만 얻어요. 예) 용기사 + 성직자 + 방패 기사 → 용왕 바하무트. 재료는 각각 1기씩 소모됩니다. |
| **행운 게이지** | 소환할 때마다 차올라서 가득 차면 다음 소환은 **영웅 이상 확정**. 보석으로 행운 레벨을 올리면 높은 등급이 더 잘 나와요. |
| **룰렛** | 5웨이브마다, 그리고 보스를 잡을 때마다 티켓을 얻어요. 골드·보석·무료 소환·전설/신화 유닛·전체 공격력 UP·시간 정지·폭탄이 걸려 있어요. |
| **강화** | 보스·룰렛에서 얻는 보석으로 등급별 공격력(+18%/레벨)과 행운을 올립니다. |
| **몬스터** | 가장자리 길을 계속 돌아요. **필드의 몬스터(보스는 10, 정예는 4)가 100을 넘으면 패배.** 10·20·30… 웨이브에는 보스, 5·15·25… 웨이브에는 정예 몬스터가 나옵니다. |
| **승리** | 50웨이브의 최종 보스(심연의 군주)를 쓰러뜨리면 승리. 이후 무한 모드로 이어갈 수 있어요. |

조작: 슬롯을 **탭**하면 선택(합성/판매), **끌어서** 다른 칸으로 옮기거나 서로 바꿉니다. 배속(x1~x3), 일시정지, 설정(소리/진동/데미지 숫자/화면 흔들림)이 있어요.

### 유닛 22종

| 등급 | 유닛 |
| --- | --- |
| 일반 | 견습 검사 · 사냥꾼 · 견습 마법사 · 행상인 |
| 희귀 | 방패 기사 · 냉기 술사 · 독 궁수 · 폭탄병 |
| 영웅 | 번개 술사 · 도박사 · 성직자 · 암살자 |
| 전설 | 용기사 · 시간술사 · 황금 상인 · 저격수 |
| 신화 | 용왕 바하무트 · 시공의 지배자 · 운명의 여신 · 그림자 군주 |
| 초월 | 파멸의 군주(용왕+그림자 군주) · 영원의 수호자(시공의 지배자+운명의 여신) |

몬스터는 14종(슬라임·고블린·박쥐·독버섯·해골병·늑대·오크·유령·꼬마 악마 + 보스 5종)입니다. 게임 안 **도감**에서 모두 볼 수 있어요.

## 실행하기

```bash
cd tower-defense
npm install          # postinstall 이 Skia 웹용 canvaskit.wasm 을 public/ 으로 복사합니다
npx expo start       # 폰의 Expo Go(SDK 57)로 QR 스캔, 또는 w 를 눌러 웹으로 실행
```

- 웹: `npx expo start --web` (데스크톱에서도 폰 비율로 가운데 정렬됩니다)
- 정적 웹 빌드: `npx expo export -p web` → `dist/`
- 네이티브 빌드(EAS)를 하려면 `app.json` 에 `ios.bundleIdentifier` / `android.package` 를 정해서 넣어 주세요. (아직 비워 둠)

## 개발 명령

| 명령 | 설명 |
| --- | --- |
| `npm run typecheck` | TypeScript 검사 |
| `npm run lint` | ESLint (eslint-config-expo, React Compiler 규칙 포함) |
| `npm test` | 엔진 단위 테스트 (node:test + tsx) |
| `npm run sim -- smart 30` | 봇 30판 시뮬레이션으로 난이도 확인 (`smart` / `lazy` / `random`, 끝에 `-v` 를 붙이면 판마다 결과를 보여줍니다) |
| `npm run sfx` | `assets/audio/*.wav` 효과음·배경음 다시 합성 |

밸런스 숫자는 모두 데이터로 분리돼 있어요: `src/game/engine/config.ts`(경제·확률), `units.ts`(유닛 능력), `waves.ts`(체력 곡선·보스),
그리고 `scripts/capacity.ts`, `scripts/pressure.ts`, `scripts/boss.ts` 로 웨이브별 화력 대비 체력·필드 압박·보스 처치 시간을 볼 수 있습니다.
현재 값(봇 기준): 잘하는 봇은 평균 약 40웨이브, 승리율 약 40~45%, 가만히 합성만 하는 봇은 약 27웨이브에서 무너집니다.

## 구조

```
src/
  app/                 Expo Router 화면 (index=타이틀, game, almanac, dev/*=개발 전용)
  game/
    engine/            순수 TypeScript 게임 로직 (RN/Skia import 금지, 시드 고정으로 재현 가능)
      game.ts          Game 클래스: 소환·합성·조합·웨이브·전투·룰렛·이벤트 큐
      units.ts / enemies.ts / waves.ts / config.ts / path.ts / layout.ts / rng.ts
    render/            Skia 렌더러 (스프라이트 baking, 보드, 이펙트, 투사체)
      units.ts monsters.ts   파츠 조합형 치비 캐릭터 / 몬스터 SkPicture 생성
      board.ts renderer.ts fx.ts projectiles.ts icons.ts fonts.ts
    ui/                게임 화면 (session=루프·입력·HUD 요약, hud, sheets, RouletteModal, 오디오 …)
  ui/                  공통 UI (버튼, 아이콘, 시트, 팝업, 테마)
  storage/save.ts      AsyncStorage 저장 (최고 기록, 도감 발견, 설정)
scripts/               봇/시뮬레이션/밸런스 분석, 효과음 합성
tests/                 엔진 단위 테스트
```

핵심 설계: **엔진 ↔ 렌더러 분리.** 엔진은 고정 1/60초 스텝으로 상태를 갱신하고 이벤트(`game.events`)만 내보냅니다.
렌더러가 이벤트를 받아 이펙트를 만들고 매 프레임 `SkPicture` 한 장을 기록하며, UI(React)는 `GameSession` 이 만든 HUD 요약만 구독합니다.
스프라이트는 시작할 때 한 번 `SkPicture` 로 구워 두고 변환만 바꿔 그리기 때문에 프레임당 비용이 작습니다.

### 웹(Skia) 주의점

- `index.js` 가 웹에서는 CanvasKit(WASM)을 먼저 로드한 뒤 `expo-router/entry` 를 불러옵니다. Skia 모듈은 import 시점에 CanvasKit 이 필요하기 때문입니다.
- 웹의 `SkiaPictureView` 는 **첫 렌더에 `picture` 가 없으면 멈춥니다** → 항상 빈 Picture 로 시작합니다. (`BoardCanvas`)
- Skia 의 `useFont` 훅은 웹에서 멈추는 문제가 있어 `expo-asset` + `Skia.Data.fromURI` 로 직접 읽습니다. (`render/fonts.ts`)
- 아이콘/카드용 이미지는 화면마다 Skia 뷰를 만들지 않고 `icons.ts` 에서 PNG data URI 로 구워 `<Image>` 로 씁니다 (WebGL 컨텍스트 한도 회피).

### 개발용 화면과 디버그

- `/dev/sprites` 스프라이트 시트, `/dev/board?t=120&seed=7` 봇이 플레이한 보드, `/dev/icons`, `/dev/icon?kind=icon` (앱 아이콘 렌더). 배포 빌드에서는 접근하면 타이틀로 돌려보냅니다.
- 웹에서 `/game?debug&manual&seed=5` 로 열면 `window.__td`(GameSession)가 노출되고 자동 루프가 꺼집니다.
  `__td.advance(초)` 로 시간을 진행하고 한 프레임을 그려서, 소프트웨어 WebGL 환경에서도 스크린샷 테스트가 가능합니다.

## 에셋 다시 만들기

- 앱 아이콘/스플래시: `/dev/icon?kind=icon|foreground|splash` 를 1024×1024 로 캡처한 것입니다 (투명 PNG 는 검은/흰 배경 캡처 차이로 알파를 복원).
- 사운드: `npm run sfx` (결정적 합성 — 같은 결과가 나옵니다).

## 확인된 것과 아직 아닌 것

- ✅ 엔진 단위 테스트 33개, 봇 시뮬레이션, `tsc`/`eslint` 통과, 웹 프로덕션 빌드(`expo export -p web`)와 Chromium 에서의 화면·조작(소환, 드래그 이동, 합성, 조합, 룰렛, 일시정지, 결과, 재시작) 확인
- ⚠️ **실제 iOS/Android 기기·Expo Go 에서는 아직 실행해 보지 못했습니다.** Skia·오디오·햅틱은 동일한 API 로 작성했지만 기기에서의 성능(60fps)과 터치 감각은 직접 확인이 필요해요.
  프레임이 무거우면 `render/fx.ts` 의 입자 상한(`MAX_PARTICLES`)이나 `renderer.ts` 의 자동 품질 단계를 조절하세요.
- ⚠️ 효과음/배경음은 합성한 소리라 취향에 맞게 `scripts/generate-sfx.mjs` 를 다듬거나 실제 음원으로 `assets/audio/` 를 바꿔도 됩니다 (파일 이름만 유지).
- 밸런스는 봇 시뮬레이션으로만 맞췄습니다. 실제 플레이 감각에 따라 `waves.ts` 의 `HP_GROWTH`, `MOB_HP_SCALE`, 보스 배율과 `config.ts` 의 소환 비용을 조절해 주세요.
