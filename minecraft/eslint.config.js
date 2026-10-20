const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  // dist: 웹 빌드 결과, gameHtml.ts: game/index.html 에서 생성되는 파일, cloud: Netlify 서버(순수 Node ESM, 자체 테스트가 있음)
  { ignores: ['dist/*', 'src/game/gameHtml.ts', 'cloud/**'] },
]);
