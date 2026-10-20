# 귀신 천마리 — 전체 순위 서버

픽업딜 앱과 **완전히 별개**의 서비스입니다 (Firebase 프로젝트·규칙·함수에 손대지 않습니다).
Cloudflare Worker + D1(SQLite)로 동작하고, 무료 요금제로 시작할 수 있습니다.

- `GET  /leaderboard?diff=0..3&limit=50&pid=<내 pid>` — 난이도별 TOP (+ 내 순위)
- `POST /score` — 난이도마다 플레이어 1명당 **최고 기록 1개**만 남깁니다 (더 낮은 기록은 무시)

## 배포 (한 번만)

```bash
cd game-server
npx wrangler login                      # Cloudflare 계정(무료)으로 로그인
npx wrangler d1 create tangtang         # 출력된 database_id 를 wrangler.toml 에 붙여넣기
npx wrangler d1 execute tangtang --remote --file=schema.sql
npx wrangler deploy                     # → https://tangtang-leaderboard.<계정>.workers.dev
```

## 게임에 연결

```bash
TANGTANG_API=https://tangtang-leaderboard.<계정>.workers.dev node scripts/build-game-web.mjs
# → game-web/tangtang.html, game-web/ad.html 에 서버 주소가 들어간다
```

주소를 넣지 않고 빌드하면 순위 기능은 꺼지고 "내 기록"(브라우저 저장)만 동작합니다.

## 로컬 테스트

```bash
node --test game-server/test/worker.test.mjs        # 서버 로직 테스트 (Node 22+)
node game-server/dev-server.mjs                     # 로컬 서버 http://127.0.0.1:8787
TANGTANG_API=http://127.0.0.1:8787 node scripts/build-game-web.mjs
```

## 알아둘 점

- **기록 위조:** 점수는 브라우저가 보내는 값이라 완벽히 막을 수 없습니다. 서버는 불가능한 값
  (초당 45킬 초과, 콤보>처치, 7200초 초과 등)만 거르고, 다른 사람의 기록은 등록 때 만든 비밀키(secret)가 없으면 고칠 수 없게 합니다.
  개발자도구로 "그럴듯한" 기록을 만드는 사람까지 막으려면 서버가 게임을 다시 계산해 검증해야 합니다.
- **개인정보:** 닉네임·기록만 저장합니다. 닉네임은 1~12자로 정리되고 화면에는 HTML 이스케이프되어 표시됩니다.
- **부적절한 닉네임/위조 기록 삭제:**
  `npx wrangler d1 execute tangtang --remote --command "DELETE FROM scores WHERE name='문제닉네임'"`
- **연속 제출 제한:** 같은 플레이어는 5초에 한 번만 제출할 수 있습니다.
