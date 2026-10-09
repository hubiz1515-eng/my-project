/**
 * Functions 통합 테스트 실행기: 테스트 전용 비밀값을 환경변수로 주입하고
 * Auth/Firestore/Functions 에뮬레이터를 띄운 뒤 node:test 를 실행한다.
 * (개발자의 functions/.secret.local 은 건드리지 않음)
 */
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

// 에뮬레이터는 functions/.env 값을 환경변수보다 우선하므로, 그 Store ID 를 테스트(가짜 PortOne)에도 그대로 사용
const dotenv = existsSync('functions/.env') ? readFileSync('functions/.env', 'utf8') : '';
const storeId = /^PORTONE_STORE_ID=(.+)$/m.exec(dotenv)?.[1]?.trim() || 'store-test';

const env = {
  ...process.env,
  PORTONE_API_SECRET: 'test_api_secret',
  PORTONE_WEBHOOK_SECRET: 'whsec_' + crypto.randomBytes(24).toString('base64'),
  PORTONE_API_BASE: 'http://127.0.0.1:9911',
  PORTONE_STORE_ID: storeId,
  PUSH_API_URL: 'http://127.0.0.1:9912/push',
};
execSync('npm --prefix functions run build', { stdio: 'inherit' });
execSync(
  'npx --yes firebase-tools emulators:exec --only auth,firestore,functions --project demo-pickupdeal "node --test --test-concurrency=1 functions/test/checkout.test.mjs functions/test/push.test.mjs functions/test/account.test.mjs functions/test/expiry.test.mjs"',
  { stdio: 'inherit', env },
);
