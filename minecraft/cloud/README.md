# 블록크래프트 클라우드 (Netlify 배포용)

게임에 **닉네임 접속 + 서버 저장**과 **숨겨진 관리자 화면**을 붙이는 Netlify 설정입니다.

- 처음 접속하면 **닉네임**을 묻습니다. **같은 닉네임으로 접속하면 서버에 저장된 월드가 이어집니다.** (폰 → PC 이어하기 가능)
- 게임 화면 **왼쪽 아래의 흐린 "관리자" 버튼**(메뉴 맨 아래에도 흐린 링크)을 누르면 비밀번호 입력 화면이 나옵니다. 비밀번호는 **Netlify 환경 변수 `ADMIN_PASSWORD`** 입니다 (코드에는 비밀번호가 없어요).
- 관리자 화면에서 할 수 있는 일: 저장된 플레이어 목록(진행도·크기·마지막 저장 시각), 저장 데이터 **JSON 내려받기**, **삭제**, JSON 파일을 닉네임에 **올리기(복원/이전)**.
- 서버가 없는 곳(파일로 열기, 앱, 일반 호스팅)에서는 지금까지처럼 이 기기에만 저장되고 닉네임 화면도 나오지 않습니다. 같은 `game/index.html` 하나로 모두 동작해요.

## 배포 방법 A — GitHub 연결 (추천)

1. 이 저장소를 GitHub 에 올려 둡니다 (이미 `hubiz1515-eng/my-project` 에 있어요).
2. Netlify → **Add new site → Import an existing project** → GitHub → 저장소 선택. 배포할 브랜치를 고르세요.
3. 빌드 설정에서 **Base directory** 를 `minecraft/cloud` 로 지정합니다. 나머지(빌드 명령 `node build.mjs`, Publish `public`, Functions `netlify/functions`, Node 22)는 `netlify.toml` 이 알려 주니 비워 두면 됩니다.
4. **Site configuration → Environment variables → Add a variable**
   - Key: `ADMIN_PASSWORD`
   - Value: 원하는 관리자 비밀번호 (길고 추측하기 어렵게)
   - Scopes: **Functions** 가 포함되게 (기본값 "All scopes" 면 OK). 비밀번호라서 *Contains secret values* 를 켜 두는 걸 권장합니다.
5. **Deploys → Trigger deploy → Clear cache and deploy site** (환경 변수는 새로 배포해야 적용됩니다).
6. 배포된 주소를 열면 닉네임 화면이 나옵니다. 관리자 비밀번호를 바꾸고 싶으면 환경 변수를 고치고 다시 배포하세요 (이전에 로그인한 관리자 토큰은 자동으로 무효가 됩니다).

## 배포 방법 B — Netlify CLI

```bash
cd minecraft/cloud
npm install
npx netlify-cli login
npx netlify-cli sites:create          # 또는 sites:link 로 기존 사이트 연결
npx netlify-cli env:set ADMIN_PASSWORD '원하는비밀번호'
npx netlify-cli deploy --build --prod
```

## 배포 방법 C — 폴더 끌어다 놓기 (Git 없이)

```bash
cd minecraft/cloud && npm install && npm run bundle     # → cloud/drop/ 폴더가 생김
```

`drop/` 폴더(= `index.html` + 서버 함수 `netlify/functions/api.mjs` + `_redirects`)를 Netlify 사이트의 **Deploys** 화면에 통째로 끌어다 놓으면 됩니다. 함수는 라이브러리까지 한 파일로 묶어 두어서 설치/빌드가 필요 없어요. **환경 변수 `ADMIN_PASSWORD` 를 먼저 넣고** 올리세요 (환경 변수를 바꾸면 다시 올려야 적용됩니다). 게임을 고칠 때마다 `npm run bundle` 후 다시 올리면 됩니다.

> 이 방법에서 Netlify 가 함수를 인식하는지는 제가 Netlify 쪽에서 직접 확인하지 못했습니다. 올린 뒤 `사이트주소/api/ping` 을 열어 `{"ok":true,"cloud":true,...}` 가 보이면 성공이고, 안 보이면 방법 A(GitHub 연결)로 배포하세요.

> ⚠ `index.html` 파일 하나만 드래그&드롭하면 **서버 함수가 없어서** 닉네임 저장과 관리자 화면이 동작하지 않습니다 (게임은 이 기기에만 저장하는 모드로 열려요). 위의 A 또는 B 로 배포하세요.

## 내 컴퓨터에서 먼저 해 보기

```bash
cd minecraft/cloud
npm install
ADMIN_PASSWORD=test1234 npm run dev     # → http://localhost:8888
npm test                                # API 테스트 (로컬 Blobs 서버 사용)
```

`npm run dev` 는 Netlify 없이 게임과 `/api` 를 함께 띄우는 가벼운 서버이고, 저장 데이터는 `cloud/.blobs/` 에 쌓입니다. `ADMIN_PASSWORD` 를 안 주면 관리자 기능만 꺼진 채로 동작해요.

## 동작 방식

| 구분 | 내용 |
|---|---|
| 저장소 | Netlify Blobs (`blockcraft-saves`). 닉네임(소문자·공백 정리) → 키. 값은 게임 저장 JSON, 메타데이터에 닉네임/버전/시각/요약 |
| 닉네임 규칙 | 한글·영문·숫자·`_` `-` `.` 공백, 1~16자. 대소문자·앞뒤 공백은 같은 닉네임으로 봅니다 |
| 저장 시점 | 블록을 고치면 15초마다, 메뉴를 열 때, 탭을 닫거나 숨길 때 |
| 저장 겹침 방지 | 저장마다 서버의 *버전(rev)* 을 함께 보내고, 다른 기기/창이 먼저 저장했으면 덮어쓰지 않고 **선택창**("최신 데이터 불러오기" / "이 화면으로 덮어쓰기")을 띄웁니다 |
| 인터넷이 끊기면 | 게임은 계속 되고 상태줄에 ⚠ 오프라인이 뜹니다. 못 보낸 저장은 이 기기에도 백업해 두었다가 다음 저장 때 올리고, 탭을 닫았다 다시 접속해도 이어서 올립니다 |
| 관리자 로그인 | `ADMIN_PASSWORD` 와 비교(일정 시간 비교) → 2시간짜리 서명 토큰(서버에 세션 저장 없음, 브라우저 메모리에만 보관). IP 당 15분에 5번 틀리면 잠깁니다 |
| 제한 | 저장 하나 최대 5MB, 플레이어 최대 500명 (`MAX_PLAYERS` 환경 변수로 조절) |

### API

| 요청 | 설명 |
|---|---|
| `GET /api/ping` | 서버 확인 `{ cloud:true, admin:true/false }` |
| `GET /api/save?nick=` | 저장 불러오기 `{ rev, savedAt, data }` (없으면 `data:null`) |
| `PUT /api/save` | `{ nick, baseRev, data, force? }` 저장. 버전이 다르면 `409` |
| `POST /api/admin/login` | `{ password }` → `{ token, expiresAt }` |
| `GET /api/admin/players` | 목록 (Bearer 토큰 필요) |
| `GET / DELETE /api/admin/player?nick=` | 한 명 조회 / 삭제 (Bearer) |
| `PUT /api/admin/player` | `{ nick, data }` 올리기(복원) (Bearer) |

## 알아 둘 점

- **닉네임이 곧 열쇠**입니다 (게임 쪽에 비밀번호는 없어요). 같은 닉네임을 아는 사람은 그 월드를 불러오고 저장할 수 있으니, 남이 짐작하기 어려운 닉네임을 쓰세요. 서버는 다른 사이트에서 몰래 보내는 쓰기 요청을 막고, 저장 데이터의 모양·크기를 검사합니다.
- 관리자 비밀번호는 코드/저장소 어디에도 없고, 환경 변수가 없으면 관리자 API 는 전부 `503` 으로 꺼집니다.
- 저장소 이름(`blockcraft-saves`)을 바꾸면 기존 저장이 보이지 않게 되니 바꾸지 마세요.
- 서버 코드는 `netlify/functions/api.mjs`(진입점)와 `netlify/lib/*` 에 있습니다. 게임 파일(`../game/index.html`)은 배포할 때마다 `build.mjs` 가 `public/` 으로 복사하므로 따로 관리할 게 없어요.
