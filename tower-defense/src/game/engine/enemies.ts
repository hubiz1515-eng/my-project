export type EnemyKind =
  | 'slime'
  | 'goblin'
  | 'bat'
  | 'mushroom'
  | 'skeleton'
  | 'wolf'
  | 'orc'
  | 'ghost'
  | 'imp'
  | 'golem'
  | 'dragon'
  | 'lich'
  | 'demon'
  | 'abyss';

export interface EnemyDef {
  id: EnemyKind;
  name: string;
  boss: boolean;
  /** 화면에 그릴 크기 배율(칸 기준) */
  size: number;
  /** 날아다니는 몬스터는 그림자가 떨어져 보인다 */
  flying?: boolean;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  slime: { id: 'slime', name: '슬라임', boss: false, size: 0.62 },
  goblin: { id: 'goblin', name: '고블린', boss: false, size: 0.62 },
  bat: { id: 'bat', name: '박쥐', boss: false, size: 0.56, flying: true },
  mushroom: { id: 'mushroom', name: '독버섯', boss: false, size: 0.66 },
  skeleton: { id: 'skeleton', name: '해골병', boss: false, size: 0.66 },
  wolf: { id: 'wolf', name: '늑대', boss: false, size: 0.68 },
  orc: { id: 'orc', name: '오크', boss: false, size: 0.78 },
  ghost: { id: 'ghost', name: '유령', boss: false, size: 0.64, flying: true },
  imp: { id: 'imp', name: '꼬마 악마', boss: false, size: 0.62, flying: true },
  golem: { id: 'golem', name: '바위 골렘', boss: true, size: 1.15 },
  dragon: { id: 'dragon', name: '새끼 용', boss: true, size: 1.2, flying: true },
  lich: { id: 'lich', name: '리치 왕', boss: true, size: 1.15 },
  demon: { id: 'demon', name: '악마 군주', boss: true, size: 1.25 },
  abyss: { id: 'abyss', name: '심연의 군주', boss: true, size: 1.35, flying: true },
};

export const BOSS_BY_STAGE: EnemyKind[] = ['golem', 'dragon', 'lich', 'demon', 'abyss'];
