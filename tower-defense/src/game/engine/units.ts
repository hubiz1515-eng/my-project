export type Grade = 1 | 2 | 3 | 4 | 5 | 6;

export interface GradeInfo {
  name: string;
  color: string;
  glow: string;
  /** 판매 시 얻는 골드 */
  sell: number;
}

export const GRADES: Record<Grade, GradeInfo> = {
  1: { name: '일반', color: '#c3ccd6', glow: '#ffffff', sell: 2 },
  2: { name: '희귀', color: '#4fa8ff', glow: '#8cc8ff', sell: 7 },
  3: { name: '영웅', color: '#b46cff', glow: '#d6a8ff', sell: 24 },
  4: { name: '전설', color: '#ffb02e', glow: '#ffd88a', sell: 90 },
  5: { name: '신화', color: '#ff4d6d', glow: '#ff9bb0', sell: 320 },
  6: { name: '초월', color: '#4df0e0', glow: '#b8fff6', sell: 1000 },
};

export const GRADE_LIST: readonly Grade[] = [1, 2, 3, 4, 5, 6];

export type ShotKind =
  | 'slash'
  | 'arrow'
  | 'orb'
  | 'coin'
  | 'ice'
  | 'dart'
  | 'bomb'
  | 'bolt'
  | 'card'
  | 'holy'
  | 'dagger'
  | 'fire'
  | 'time'
  | 'snipe'
  | 'arcane'
  | 'dragon'
  | 'fate'
  | 'shadow'
  | 'meteor'
  | 'eternal';

export type TargetMode = 'first' | 'last' | 'strong' | 'weak' | 'random';

export type HatKind =
  | 'none'
  | 'helmet'
  | 'hood'
  | 'wizard'
  | 'crown'
  | 'headband'
  | 'horns'
  | 'halo'
  | 'cap'
  | 'mitre'
  | 'tophat'
  | 'dragonhelm'
  | 'beret'
  | 'witch';

export type WeaponKind =
  | 'sword'
  | 'bow'
  | 'staff'
  | 'dagger'
  | 'bomb'
  | 'book'
  | 'cards'
  | 'rifle'
  | 'coin'
  | 'shield'
  | 'lance'
  | 'orb'
  | 'wand'
  | 'scythe'
  | 'hourglass'
  | 'twinblade'
  | 'greatsword';

export interface UnitLook {
  skin: string;
  hair: string;
  outfit: string;
  trim: string;
  hat: HatKind;
  weapon: WeaponKind;
  cape?: string;
  wings?: string;
  /** 눈동자 색 */
  eye?: string;
  /** 몸집 배율 */
  scale?: number;
}

export type UnitId =
  | 'squire'
  | 'hunter'
  | 'apprentice'
  | 'peddler'
  | 'knight'
  | 'frostmage'
  | 'poisoner'
  | 'bomber'
  | 'stormcaller'
  | 'gambler'
  | 'cleric'
  | 'assassin'
  | 'dragoon'
  | 'chrono'
  | 'merchant'
  | 'sniper'
  | 'dragonlord'
  | 'timelord'
  | 'fateweaver'
  | 'shadowlord'
  | 'worldbreaker'
  | 'eternity';

export interface UnitDef {
  id: UnitId;
  name: string;
  grade: Grade;
  role: string;
  desc: string;
  dmg: number;
  /** 공격 간격(초) */
  cd: number;
  shot: ShotKind;
  target: TargetMode;
  /** 폭발 반경(칸) */
  splash?: number;
  /** 연쇄 번개 횟수와 감쇠 */
  chain?: number;
  chainFalloff?: number;
  /** 동시에 추가로 노리는 대상 수 */
  multi?: number;
  slow?: { pct: number; dur: number };
  stun?: { chance: number; dur: number };
  /** dps: 한 번 맞을 때 피해량 대비 초당 지속 피해 비율 */
  poison?: { dps: number; dur: number };
  crit?: { chance: number; mult: number };
  /** [배율, 가중치] 표에서 매 공격마다 피해 배율을 뽑는다 */
  gamble?: readonly (readonly [number, number])[];
  goldOnHit?: { chance: number; amount: number };
  goldPerSec?: number;
  /** 보드에 있는 동안 모든 유닛의 피해량 +x (유닛 1기당) */
  auraDmg?: number;
  /** 보드에 있는 동안 모든 유닛의 공격 속도 +x (유닛 1기당) */
  auraSpeed?: number;
  bossMul?: number;
  /** 주기적으로 필드 전체를 얼린다 */
  pulse?: { every: number; freeze: number; bossSlow: number };
  recipe?: readonly UnitId[];
  look: UnitLook;
}

const U = (d: UnitDef): UnitDef => d;

export const UNITS: Record<UnitId, UnitDef> = {
  // ───── 일반 ─────
  squire: U({
    id: 'squire',
    name: '견습 검사',
    grade: 1,
    role: '근접',
    desc: '빠르게 베어 넘기는 기본 전투원.',
    dmg: 9,
    cd: 0.7,
    shot: 'slash',
    target: 'first',
    look: { skin: '#ffd6b0', hair: '#7a4a2a', outfit: '#5b86d9', trim: '#e8eefc', hat: 'headband', weapon: 'sword' },
  }),
  hunter: U({
    id: 'hunter',
    name: '사냥꾼',
    grade: 1,
    role: '원거리',
    desc: '화살로 가장 앞선 적을 쏜다.',
    dmg: 12,
    cd: 0.95,
    shot: 'arrow',
    target: 'first',
    look: { skin: '#f6caa0', hair: '#3a5a2a', outfit: '#4f9a4f', trim: '#c9e8b0', hat: 'hood', weapon: 'bow' },
  }),
  apprentice: U({
    id: 'apprentice',
    name: '견습 마법사',
    grade: 1,
    role: '마법',
    desc: '작은 폭발로 주변 적에게도 피해를 준다.',
    dmg: 10,
    cd: 1.05,
    shot: 'orb',
    target: 'first',
    splash: 0.55,
    look: { skin: '#ffe0c4', hair: '#a35fd0', outfit: '#7e57c2', trim: '#e1d4ff', hat: 'wizard', weapon: 'wand' },
  }),
  peddler: U({
    id: 'peddler',
    name: '행상인',
    grade: 1,
    role: '경제',
    desc: '공격할 때 일정 확률로 골드를 줍는다.',
    dmg: 6,
    cd: 0.8,
    shot: 'coin',
    target: 'first',
    goldOnHit: { chance: 0.14, amount: 2 },
    look: { skin: '#f2c49a', hair: '#8a5a2b', outfit: '#d9a441', trim: '#fff0c2', hat: 'cap', weapon: 'coin' },
  }),
  // ───── 희귀 ─────
  knight: U({
    id: 'knight',
    name: '방패 기사',
    grade: 2,
    role: '근접',
    desc: '묵직한 일격. 가끔 적을 기절시킨다.',
    dmg: 38,
    cd: 0.95,
    shot: 'slash',
    target: 'first',
    stun: { chance: 0.12, dur: 0.9 },
    look: { skin: '#f5cfa8', hair: '#5a4630', outfit: '#8d9bb0', trim: '#e9eef7', hat: 'helmet', weapon: 'shield', cape: '#c0392b' },
  }),
  frostmage: U({
    id: 'frostmage',
    name: '냉기 술사',
    grade: 2,
    role: '마법',
    desc: '맞은 적을 얼려 느리게 만든다.',
    dmg: 30,
    cd: 0.95,
    shot: 'ice',
    target: 'first',
    splash: 0.5,
    slow: { pct: 0.35, dur: 2.2 },
    look: { skin: '#e6f2ff', hair: '#9fd8ff', outfit: '#3f8fd9', trim: '#dff3ff', hat: 'witch', weapon: 'staff', eye: '#3aa0ff' },
  }),
  poisoner: U({
    id: 'poisoner',
    name: '독 궁수',
    grade: 2,
    role: '원거리',
    desc: '독 화살이 오래 지속되는 피해를 준다.',
    dmg: 20,
    cd: 0.8,
    shot: 'dart',
    target: 'first',
    poison: { dps: 0.8, dur: 4 },
    look: { skin: '#cfe8b4', hair: '#2f6a3a', outfit: '#3a7d4f', trim: '#a6e06b', hat: 'hood', weapon: 'bow', cape: '#2a5a3a' },
  }),
  bomber: U({
    id: 'bomber',
    name: '폭탄병',
    grade: 2,
    role: '폭발',
    desc: '넓은 범위를 한꺼번에 폭파한다.',
    dmg: 55,
    cd: 1.5,
    shot: 'bomb',
    target: 'first',
    splash: 1.0,
    look: { skin: '#f0c090', hair: '#2b2b2b', outfit: '#c0762a', trim: '#ffd9a0', hat: 'cap', weapon: 'bomb' },
  }),
  // ───── 영웅 ─────
  stormcaller: U({
    id: 'stormcaller',
    name: '번개 술사',
    grade: 3,
    role: '마법',
    desc: '번개가 여러 적에게 연쇄된다.',
    dmg: 80,
    cd: 1.0,
    shot: 'bolt',
    target: 'first',
    chain: 3,
    chainFalloff: 0.75,
    look: { skin: '#ffe3c8', hair: '#ffe14d', outfit: '#3b3f9e', trim: '#ffe14d', hat: 'wizard', weapon: 'staff', cape: '#2a2d73', eye: '#ffe14d' },
  }),
  gambler: U({
    id: 'gambler',
    name: '도박사',
    grade: 3,
    role: '운빨',
    desc: '피해량이 매번 랜덤! 가끔 대박이 터진다.',
    dmg: 62,
    cd: 0.85,
    shot: 'card',
    target: 'first',
    gamble: [
      [0.2, 24],
      [0.8, 34],
      [2, 26],
      [5, 13],
      [14, 3],
    ],
    look: { skin: '#fbd5b5', hair: '#1f1f2e', outfit: '#8e1f4d', trim: '#ffd23f', hat: 'tophat', weapon: 'cards', cape: '#4a1030' },
  }),
  cleric: U({
    id: 'cleric',
    name: '성직자',
    grade: 3,
    role: '지원',
    desc: '보드에 있는 모든 유닛의 공격력을 올려준다.',
    dmg: 55,
    cd: 1.1,
    shot: 'holy',
    target: 'first',
    auraDmg: 0.05,
    look: { skin: '#ffe6d0', hair: '#fff4c2', outfit: '#f4f1e8', trim: '#ffd86b', hat: 'mitre', weapon: 'staff' },
  }),
  assassin: U({
    id: 'assassin',
    name: '암살자',
    grade: 3,
    role: '근접',
    desc: '번개 같은 연타와 높은 치명타 확률.',
    dmg: 45,
    cd: 0.5,
    shot: 'dagger',
    target: 'first',
    crit: { chance: 0.25, mult: 3 },
    look: { skin: '#e8c8a8', hair: '#d8d8e8', outfit: '#2c2c3c', trim: '#ff4d6d', hat: 'hood', weapon: 'dagger', cape: '#1a1a26', eye: '#ff4d6d' },
  }),
  // ───── 전설 ─────
  dragoon: U({
    id: 'dragoon',
    name: '용기사',
    grade: 4,
    role: '폭발',
    desc: '불 숨결로 넓은 범위를 태운다.',
    dmg: 330,
    cd: 1.15,
    shot: 'fire',
    target: 'first',
    splash: 1.2,
    look: { skin: '#f2c8a0', hair: '#c0392b', outfit: '#b8332a', trim: '#ffcc5c', hat: 'dragonhelm', weapon: 'lance', cape: '#7a1f1a', wings: '#e45a3a' },
  }),
  chrono: U({
    id: 'chrono',
    name: '시간술사',
    grade: 4,
    role: '제어',
    desc: '적을 크게 둔화시키고, 주기적으로 시간을 멈춘다.',
    dmg: 200,
    cd: 0.9,
    shot: 'time',
    target: 'first',
    slow: { pct: 0.45, dur: 2.4 },
    pulse: { every: 10, freeze: 1.3, bossSlow: 0.35 },
    look: { skin: '#f0e0d0', hair: '#b8e6ff', outfit: '#2c6e8f', trim: '#7ff0ff', hat: 'witch', weapon: 'hourglass', cape: '#1b4a63', eye: '#7ff0ff' },
  }),
  merchant: U({
    id: 'merchant',
    name: '황금 상인',
    grade: 4,
    role: '경제',
    desc: '매 초 골드를 벌고, 공격할 때도 골드를 줍는다.',
    dmg: 220,
    cd: 1.0,
    shot: 'coin',
    target: 'first',
    goldPerSec: 1.0,
    goldOnHit: { chance: 0.2, amount: 3 },
    look: { skin: '#f6c89c', hair: '#4a3020', outfit: '#e0a820', trim: '#fff2a8', hat: 'tophat', weapon: 'coin', cape: '#9a6a10' },
  }),
  sniper: U({
    id: 'sniper',
    name: '저격수',
    grade: 4,
    role: '원거리',
    desc: '가장 강한 적에게 막대한 피해. 보스에게 특히 강하다.',
    dmg: 1150,
    cd: 2.8,
    shot: 'snipe',
    target: 'strong',
    bossMul: 1.5,
    look: { skin: '#e9c9a6', hair: '#3a3a3a', outfit: '#4a5d3a', trim: '#b8d070', hat: 'beret', weapon: 'rifle' },
  }),
  // ───── 신화 (레시피 조합) ─────
  dragonlord: U({
    id: 'dragonlord',
    name: '용왕 바하무트',
    grade: 5,
    role: '폭발',
    desc: '화염 폭풍이 필드를 휩쓴다. 불타는 적은 계속 피해를 입는다.',
    dmg: 1650,
    cd: 1.0,
    shot: 'dragon',
    target: 'first',
    splash: 1.7,
    poison: { dps: 0.5, dur: 3 },
    recipe: ['dragoon', 'cleric', 'knight'],
    look: { skin: '#f0c090', hair: '#ff7a3a', outfit: '#8f1f1f', trim: '#ffd24d', hat: 'dragonhelm', weapon: 'greatsword', cape: '#4a0f0f', wings: '#ff5a2a', eye: '#ffd24d', scale: 1.12 },
  }),
  timelord: U({
    id: 'timelord',
    name: '시공의 지배자',
    grade: 5,
    role: '제어',
    desc: '시간을 멈추고 번개로 처단한다. 모든 유닛이 더 빨라진다.',
    dmg: 900,
    cd: 0.7,
    shot: 'arcane',
    target: 'first',
    chain: 4,
    chainFalloff: 0.8,
    slow: { pct: 0.5, dur: 2.5 },
    auraSpeed: 0.1,
    pulse: { every: 7, freeze: 1.8, bossSlow: 0.45 },
    recipe: ['chrono', 'stormcaller', 'frostmage'],
    look: { skin: '#e8e0f5', hair: '#7fe8ff', outfit: '#233a8f', trim: '#7fe8ff', hat: 'witch', weapon: 'hourglass', cape: '#121f5a', wings: '#7fe8ff', eye: '#7fe8ff', scale: 1.12 },
  }),
  fateweaver: U({
    id: 'fateweaver',
    name: '운명의 여신',
    grade: 5,
    role: '운빨',
    desc: '운명을 비튼다. 막대한 랜덤 피해, 모두의 공격력과 골드 수입.',
    dmg: 380,
    cd: 0.65,
    shot: 'fate',
    target: 'first',
    gamble: [
      [0.5, 20],
      [1.5, 35],
      [3, 25],
      [7, 15],
      [20, 5],
    ],
    auraDmg: 0.12,
    goldPerSec: 2,
    recipe: ['merchant', 'gambler', 'peddler'],
    look: { skin: '#ffe8d8', hair: '#ffd24d', outfit: '#f5a8d0', trim: '#fff2a8', hat: 'crown', weapon: 'cards', cape: '#d070b0', wings: '#fff2a8', eye: '#ff7ac0', scale: 1.12 },
  }),
  shadowlord: U({
    id: 'shadowlord',
    name: '그림자 군주',
    grade: 5,
    role: '근접',
    desc: '그림자처럼 베고 또 벤다. 치명타와 독이 쌓인다.',
    dmg: 260,
    cd: 0.3,
    shot: 'shadow',
    target: 'strong',
    crit: { chance: 0.4, mult: 4 },
    poison: { dps: 0.6, dur: 3 },
    bossMul: 1.3,
    recipe: ['sniper', 'assassin', 'poisoner'],
    look: { skin: '#cfc4e0', hair: '#7a3fff', outfit: '#1a1230', trim: '#a56bff', hat: 'horns', weapon: 'twinblade', cape: '#0c0818', eye: '#d6b0ff', scale: 1.12 },
  }),
  // ───── 초월 (신화 2기 조합) ─────
  worldbreaker: U({
    id: 'worldbreaker',
    name: '파멸의 군주',
    grade: 6,
    role: '폭발',
    desc: '운석이 하늘에서 쏟아져 모든 것을 부순다.',
    dmg: 9000,
    cd: 0.9,
    shot: 'meteor',
    target: 'first',
    splash: 2.4,
    poison: { dps: 0.4, dur: 4 },
    recipe: ['dragonlord', 'shadowlord'],
    look: { skin: '#d8b8a0', hair: '#ff3a1a', outfit: '#2a0a0a', trim: '#ff6a2a', hat: 'horns', weapon: 'scythe', cape: '#120404', wings: '#ff3a1a', eye: '#ffd24d', scale: 1.25 },
  }),
  eternity: U({
    id: 'eternity',
    name: '영원의 수호자',
    grade: 6,
    role: '제어',
    desc: '영원의 빛이 시간을 지배한다. 필드를 얼리고, 모두를 강하게 한다.',
    dmg: 2800,
    cd: 0.5,
    shot: 'eternal',
    target: 'first',
    chain: 6,
    chainFalloff: 0.85,
    slow: { pct: 0.6, dur: 3 },
    auraDmg: 0.2,
    auraSpeed: 0.15,
    goldPerSec: 4,
    pulse: { every: 5, freeze: 2.5, bossSlow: 0.5 },
    recipe: ['timelord', 'fateweaver'],
    look: { skin: '#fff4e8', hair: '#ffffff', outfit: '#f4f8ff', trim: '#6af7e8', hat: 'halo', weapon: 'orb', cape: '#bfe8ff', wings: '#bff9f2', eye: '#6af7e8', scale: 1.25 },
  }),
};

export const UNIT_IDS = Object.keys(UNITS) as UnitId[];

/** 소환/합성으로 나올 수 있는 유닛 (등급별) */
export const SUMMONABLE: Record<number, UnitId[]> = {
  1: UNIT_IDS.filter((id) => UNITS[id].grade === 1),
  2: UNIT_IDS.filter((id) => UNITS[id].grade === 2),
  3: UNIT_IDS.filter((id) => UNITS[id].grade === 3),
  4: UNIT_IDS.filter((id) => UNITS[id].grade === 4),
};

/** 조합으로만 얻는 유닛 */
export const RECIPE_UNITS: UnitId[] = UNIT_IDS.filter((id) => UNITS[id].recipe);

export function gradeOf(id: UnitId): Grade {
  return UNITS[id].grade;
}
