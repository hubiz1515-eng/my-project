/** 게임 전역 상수. 길이 단위는 모두 "칸(cell)" 이며 렌더러가 화면 픽셀로 환산한다. */

export const COLS = 4;
export const ROWS = 5;
export const SLOT_COUNT = COLS * ROWS;
export const MAX_STACK = 3;

/** 몬스터가 도는 테두리 길을 포함한 전체 판 크기 (슬롯 판 둘레에 1칸 두께의 길) */
export const BOARD_W = COLS + 2;
export const BOARD_H = ROWS + 2;

/** 고정 시뮬레이션 간격 */
export const STEP = 1 / 60;

export const FINAL_WAVE = 50;
export const PREP_TIME = 6;
export const WAVE_TIME = 42;
export const BOSS_WAVE_TIME = 62;

/** 필드 몬스터 가중치 합이 이 값에 닿으면 패배 */
export const ENEMY_LIMIT = 100;
export const ENEMY_WARN = 70;

export const START_GOLD = 80;
export const SUMMON_BASE_COST = 20;
export const SUMMON_COST_STEP = 2;
/** 행운 게이지가 이만큼 차면 다음 소환은 영웅 등급 이상이 보장된다 */
export const PITY_MAX = 24;

export const MAX_GRADE_LEVEL = 10;
export const GRADE_LEVEL_BONUS = 0.18;
export const MAX_LUCK_LEVEL = 5;
export const LUCK_COSTS = [2, 4, 7, 11, 16];

/** 행운 레벨별 소환 확률 [일반, 희귀, 영웅, 전설] */
export const SUMMON_ODDS: readonly (readonly number[])[] = [
  [0.7, 0.245, 0.05, 0.005],
  [0.62, 0.3, 0.07, 0.01],
  [0.54, 0.34, 0.1, 0.02],
  [0.46, 0.37, 0.14, 0.03],
  [0.38, 0.4, 0.18, 0.04],
  [0.3, 0.42, 0.23, 0.05],
];

/** 합성 시 한 등급 더 오르는 "대박" 확률 */
export const JACKPOT_CHANCE = 0.07;

/** 칸 단위 좌표에서 길(중심선) 사각형과 모서리 반경 */
export const PATH_RADIUS = 0.34;
export const ENEMY_BASE_SPEED = 1.35;
