# 블록크래프트 (Blockcraft)

마인크래프트 스타일의 3D 블록 샌드박스 게임입니다. 푸드 클럽 앱과는 **완전히 별개인 독립 Expo 앱**이고(`minecraft/` 폴더 안에서만 동작), 게임 엔진은 외부 라이브러리·이미지·사운드 파일 없이 WebGL로 직접 구현했습니다. 모든 텍스처와 효과음은 코드로 생성합니다.

> 마인크래프트(Minecraft)는 Mojang/Microsoft의 상표이며, 이 프로젝트는 그들과 무관한 팬 스타일 구현입니다. 에셋은 하나도 가져오지 않았습니다.

## 실행

```bash
cd minecraft
npm install
npx expo start          # 터미널에서 w = 웹, a = 안드로이드, i = iOS, 또는 Expo Go 로 QR 스캔
```

- **웹**: `npm run web` → 브라우저에서 바로 플레이 (키보드 + 마우스)
- **폰**: Expo Go 로 QR 스캔. 게임은 WebView 안의 WebGL 로 실행됩니다.
- **엔진만 보고 싶다면** `game/index.html` 을 브라우저로 직접 열어도 됩니다 (저장은 브라우저 localStorage).

## 조작법

| | 터치 | 키보드 · 마우스 |
|---|---|---|
| 이동 | 왼쪽 조이스틱 | WASD / 방향키 |
| 시점 | 화면 드래그 | 마우스 (클릭하면 마우스 잠금) |
| 블록 부수기 | 화면 **길게 누르기** | 좌클릭 (누르고 있기) |
| 블록 놓기 | 화면 **짧게 탭** | 우클릭 |
| 점프 | ▲ 버튼 | Space |
| 비행 | ▲ 두 번 연속 / 🕊 | Space 두 번 / F |
| 몬스터 공격 | 몬스터를 **탭** (길게 누르면 연타) | 좌클릭 |
| 블록 선택 | 핫바 탭 (선택된 칸을 다시 탭하면 블록 목록) | 숫자 1~9 / 휠 / E (목록) / 휠클릭 (복사) |
| 메뉴 | ☰ (안드로이드 뒤로가기도 메뉴) | Esc |

## 기능

- 시드 기반 **무한 지형**: 산·평원·사막·설산, 바다/호수, 해변, 동굴, 광석(석탄·철), 나무
- 블록 13종 + 기반암/물, 정점 AO·면 컬링·간이 하늘빛(동굴/숲 그늘), 하루 8분의 **낮·노을·밤**(해, 달, 별)
- 물 속 헤엄·시야 효과, 자동 점프, 비행 모드, 채굴 균열 애니메이션, 파편 파티클, 효과음
- **몬스터 3종**: 좀비(쫓아와서 때림, 낮에 햇빛에 탐), 크리퍼(다가오면 점화 후 **폭발**해서 블록이 파임), 스켈레톤(거리를 두고 옆으로 돌며 **화살** 발사). 밤과 동굴·숲 그늘처럼 어두운 곳에서 나타납니다.
- **체력(♥ 10칸)**: 피격 넉백, 사망 화면과 다시 시작, 잠시 맞지 않으면 자연 회복. 메뉴에서 몬스터를 끄면 평화 모드(창작 전용)가 됩니다.
- 월드 **자동 저장** (고친 블록만 기록하는 방식이라 작음) — 앱은 AsyncStorage, 웹은 localStorage
- 시야 거리 4단계, 즉시 채굴, 소리, 낮/밤 전환, 새 월드 (메뉴)
- 세로/가로 화면 모두 지원. 앱은 가로 화면으로 고정합니다(`src/app/index.tsx`, 세로로 쓰려면 그 effect 를 삭제).

## 구조

```
game/index.html          게임 전체(엔진 + UI). 단독으로도 실행됨 ← 게임 수정은 여기서
scripts/build-game-html.mjs   game/index.html → src/game/gameHtml.ts (문자열 모듈) 변환
src/game/gameHtml.ts     ⚠ 생성 파일. game/index.html 을 고친 뒤 `npm run build:game`
src/game/                buildHtml(저장 데이터 주입) · messages(게임→앱 메시지) · saveStore(AsyncStorage)
src/components/GameView.tsx       네이티브: react-native-webview
src/components/GameView.web.tsx   웹: iframe(srcDoc) + postMessage
src/app/                 Expo Router 화면 (index = 게임)
```

앱과 게임은 `postMessage` 로 통신합니다. 게임은 `{type:'save', data}` 를 보내고, 앱이 저장소에 기록합니다. 시작할 때는 앱이 저장된 월드를 HTML 에 `window.__BLOCKCRAFT_SAVE__` 로 심어 줍니다(저장이 없으면 `null`).

## 개발 명령

```bash
npm run build:game   # game/index.html 수정 후 실행
npm run typecheck    # gameHtml.ts 최신 여부 확인 + tsc
npm run lint         # expo lint (eslint 9 + eslint-config-expo)
```

## 알려진 한계 / 다음에 해볼 만한 것

- 몬스터는 단순한 AI입니다(직선 추적 + 1칸 턱 뛰어넘기 + 막히면 옆으로 돌아 보기, 본격적인 길 찾기는 없음). 동물, 아이템 드롭, 배고픔, 제작(크래프팅), 인벤토리 수량은 없고 블록은 무한입니다.
- 물은 흐르지 않는 정적 블록입니다(블록을 부수면 옆에 물이 있을 때 그 자리가 물로 채워지는 정도).
- 청크 생성/메시 생성은 메인 스레드에서 프레임당 예산을 나눠 처리합니다. 저사양 기기에서는 시야 거리를 줄이세요.
- `app.json` 의 `bundleIdentifier` / `package` (`com.blockcraft.game`)는 임시 값입니다. 스토어에 올리기 전에 바꾸세요.
