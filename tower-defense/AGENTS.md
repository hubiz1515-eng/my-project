# 럭키 가디언즈 — 작업 규칙

저장소 루트의 푸드 클럽 앱과는 **별개의 Expo 프로젝트**입니다. 루트 앱의 코드·설정은 건드리지 않습니다
(루트 `tsconfig.json` 이 `tower-defense` 를 exclude 하는 것만 예외).

## 명령

```bash
npm run typecheck && npm run lint && npm test   # 작업을 끝내기 전에 모두 통과해야 함
npm run sim -- smart 30                          # 밸런스 변경 시: 봇 시뮬레이션으로 난이도 곡선 확인
npx expo install <pkg>                           # 의존성은 SDK 호환 버전으로 (네트워크가 막혀 있으면 expo/bundledNativeModules.json 의 버전으로 npm install)
```

## 구조 규칙

- `src/game/engine/**` 는 **순수 TypeScript** 입니다. `react`, `react-native`, `@shopify/react-native-skia` 를 import 하지 마세요.
  엔진은 시드 고정(`Rng`)으로 결정적이어야 하고(테스트가 이를 검사), 시각 효과용 난수는 렌더러에서 `Math.random` 을 씁니다.
- 엔진은 상태만 바꾸고 `game.events` 로 사건을 알립니다. 렌더러/사운드/햅틱/토스트는 이벤트를 소비할 뿐 엔진을 되짚지 않습니다.
- 화면 갱신은 `GameSession.hud` 요약(바뀔 때만 새 객체) + `useSyncExternalStore` 로 합니다. 매 프레임 React state 를 쓰는 곳은 `BoardCanvas` 의 Picture 하나뿐입니다.
- 새 유닛/몬스터는 `units.ts`(능력+`look`)·`enemies.ts` 데이터를 추가하면 도감·아이콘이 자동으로 따라옵니다.
  몬스터는 `render/monsters.ts` 에 그리기 함수도 추가하세요. 효과 종류를 새로 만들면 `Game.hitEnemy` 와 `unitInfo.ts` 설명도 함께.
- 한 칸 = 1.0 단위의 "칸 좌표계"를 엔진/렌더러가 공유합니다 (`config.ts` 의 `COLS`, `ROWS`, `BOARD_W/H`).

## 웹(Skia) 함정 — 건드릴 때 꼭 확인

- Skia 모듈은 import 시점에 `global.CanvasKit` 이 필요합니다 → 엔트리는 `index.js` (웹에서 `LoadSkiaWeb` 후 `expo-router/entry`).
- `SkiaPictureView` 는 웹에서 **첫 렌더에 `picture` 가 없으면 멈춥니다**. 항상 빈 Picture 로 시작하세요.
- `useFont` 훅은 웹에서 멈춥니다 → `render/fonts.ts` 의 직접 로더를 쓰세요.
- 화면마다 Skia 뷰를 여러 개 만들지 마세요 (웹 WebGL 컨텍스트 16개 제한). 목록/카드는 `render/icons.ts` 의 PNG data URI.
- `useAnimatedValue` 는 react-native-web 에 없습니다 → `src/ui/useAnimatedValue.ts`.
- Skia 의 `SkPath` 변경 메서드는 deprecated 입니다 → `Skia.PathBuilder.Make()` (`render/draw.ts` 의 `newPath`).
- 매 프레임 만든 Picture 는 `BoardCanvas` 에서 지연 `dispose()` 합니다. 새 per-frame 객체를 만들면 같은 식으로 정리하세요.

## 화면 확인 방법 (소프트웨어 WebGL 환경)

연속 렌더링 중에는 헤드리스 Chromium 이 스크린샷에서 멈춥니다. `/game?debug&manual&seed=N` 으로 열어 `window.__td.advance(초)` 로
진행한 뒤 캡처하세요 (`README.md` 의 "개발용 화면과 디버그" 참고).

## 문서 사이트 접근

이 개발 환경에서는 `docs.expo.dev` 가 네트워크 정책으로 막혀 있을 수 있습니다. 그럴 땐 설치된 패키지의 `build/*.d.ts` 와 소스를 기준으로 API 를 확인합니다.
