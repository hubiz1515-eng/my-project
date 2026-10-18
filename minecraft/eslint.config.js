const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  // dist: 웹 빌드 결과, gameHtml.ts: game/index.html 에서 생성되는 파일
  { ignores: ['dist/*', 'src/game/gameHtml.ts'] },
]);
