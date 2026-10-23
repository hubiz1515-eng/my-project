import type { TargetMode, UnitDef } from '../engine/units';

const TARGET_LABEL: Record<TargetMode, string> = {
  first: '가장 앞선 적',
  last: '가장 뒤처진 적',
  strong: '체력이 가장 많은 적',
  weak: '체력이 가장 적은 적',
  random: '무작위 적',
};

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** 도감/정보창에 보여줄 능력 설명 목록 */
export function unitSpecLines(d: UnitDef): string[] {
  const out: string[] = [];
  out.push(`공격 대상: ${TARGET_LABEL[d.target]}`);
  if (d.splash) out.push(`폭발 범위 ${d.splash}칸 (주변 적에게 60% 피해)`);
  if (d.chain) out.push(`번개 연쇄 ${d.chain}회 (단계마다 약해짐)`);
  if (d.slow) out.push(`둔화 ${pct(d.slow.pct)} · ${d.slow.dur}초 (보스는 최대 40%)`);
  if (d.stun) out.push(`${pct(d.stun.chance)} 확률로 ${d.stun.dur}초 기절 (보스 제외)`);
  if (d.poison) out.push(`지속 피해: 초당 피해의 ${pct(d.poison.dps)} · ${d.poison.dur}초`);
  if (d.crit) out.push(`치명타 ${pct(d.crit.chance)} (×${d.crit.mult})`);
  if (d.gamble) {
    const ms = d.gamble.map((g) => g[0]);
    out.push(`랜덤 피해 ×${Math.min(...ms)} ~ ×${Math.max(...ms)}`);
  }
  if (d.goldOnHit) out.push(`공격할 때 ${pct(d.goldOnHit.chance)} 확률로 ${d.goldOnHit.amount}골드`);
  if (d.goldPerSec) out.push(`매 초 ${d.goldPerSec}골드 획득`);
  if (d.auraDmg) out.push(`모든 유닛 공격력 +${pct(d.auraDmg)} (1기당)`);
  if (d.auraSpeed) out.push(`모든 유닛 공격 속도 +${pct(d.auraSpeed)} (1기당)`);
  if (d.bossMul) out.push(`보스에게 ×${d.bossMul} 피해`);
  if (d.pulse) out.push(`${d.pulse.every}초마다 시간 정지 ${d.pulse.freeze}초 (보스는 둔화)`);
  return out;
}

export const MONSTER_DESC: Record<string, string> = {
  slime: '말랑말랑한 기본 몬스터. 느긋하게 길을 돈다.',
  goblin: '떼로 몰려다니는 약골 도적.',
  bat: '재빠르게 날아다니는 박쥐.',
  mushroom: '맷집이 좋은 독버섯. 느리지만 단단하다.',
  skeleton: '녹슨 투구를 쓴 해골 병사.',
  wolf: '아주 빠른 늑대 무리.',
  orc: '느리지만 엄청나게 단단한 오크.',
  ghost: '둥실둥실 떠다니는 유령.',
  imp: '불장난을 좋아하는 꼬마 악마.',
  golem: '[보스] 바위로 된 거인. 10웨이브마다 나타나는 첫 번째 보스.',
  dragon: '[보스] 날개 달린 새끼 용. 20웨이브의 보스.',
  lich: '[보스] 해골 왕. 30웨이브의 보스.',
  demon: '[보스] 불꽃 머리의 악마 군주. 40웨이브의 보스.',
  abyss: '[보스] 심연에서 온 거대한 눈. 50웨이브의 최종 보스.',
};
