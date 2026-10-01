/**
 * Functions 통합 테스트 실행기: 테스트 전용 비밀값을 환경변수로 주입하고
 * Auth/Firestore/Functions 에뮬레이터를 띄운 뒤 node:test 를 실행한다.
 * (개발자의 functions/.secret.local 은 건드리지 않음)
 */
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

const env = {
  ...process.env,
  PORTONE_API_SECRET: 'test_api_secret',
  PORTONE_WEBHOOK_SECRET: 'whsec_' + crypto.randomBytes(24).toString('base64'),
  PORTONE_API_BASE: 'http://127.0.0.1:9911',
  PORTONE_STORE_ID: 'store-test',
};
execSync('npm --prefix functions run build', { stdio: 'inherit' });
execSync(
  'npx --yes firebase-tools emulators:exec --only auth,firestore,functions --project demo-pickupdeal "node --test functions/test/checkout.test.mjs"',
  { stdio: 'inherit', env },
);
