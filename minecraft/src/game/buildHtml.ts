import { GAME_HTML } from './gameHtml';

const SAVE_MARKER = '<!--BLOCKCRAFT_SAVE-->';

/**
 * 저장된 월드(문자열 또는 null)를 게임 HTML 안에 심어서 돌려준다.
 * 게임은 시작할 때 `window.__BLOCKCRAFT_SAVE__` 를 읽어 월드를 복원한다.
 */
export function buildGameHtml(save: string | null): string {
  // 저장이 없어도 null 을 심는다 — 게임이 "앱이 저장을 관리한다"는 걸 알 수 있게 (브라우저 localStorage 로 새지 않게)
  // `</script>` 로 태그가 끊기지 않도록 `<` 를 이스케이프
  const literal = save === null ? 'null' : JSON.stringify(save).replace(/</g, '\\u003c');
  // 함수형 치환: 저장 데이터 안의 `$&` 같은 패턴이 치환 문법으로 해석되지 않게
  return GAME_HTML.replace(SAVE_MARKER, () => `<script>window.__BLOCKCRAFT_SAVE__=${literal};</script>`);
}
