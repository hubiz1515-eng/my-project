import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { MAX_GRADE_LEVEL, GRADE_LEVEL_BONUS, LUCK_COSTS, MAX_LUCK_LEVEL, SUMMON_ODDS } from '../engine/config';
import { GRADES, GRADE_LIST, RECIPE_UNITS, UNITS, type Grade, type UnitId } from '../engine/units';
import { unitIcon } from '../render/icons';
import { Bar, GradeChip, GText } from '@/ui/bits';
import { GButton } from '@/ui/GButton';
import { Icon } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';
import { C } from '@/ui/theme';
import type { GameSession, Hud } from './session';

interface SheetProps {
  session: GameSession;
  hud: Hud;
  visible: boolean;
  onClose: () => void;
  bottomInset: number;
}

// ───────────────────────────── 조합 ─────────────────────────────

export function RecipeSheet({ session, hud, visible, onClose, bottomInset }: SheetProps) {
  const g = session.game;
  return (
    <Sheet visible={visible} title="신화 · 초월 조합" onClose={() => { session.highlightRecipe(null); onClose(); }} bottomInset={bottomInset} heightPct={0.58}>
      <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
        <GText size={13} color={C.sub}>
          재료 유닛을 보드에 모으면 조합할 수 있어요. 재료는 각각 1기씩 사라집니다. 카드를 눌러 재료 위치를 확인하세요.
        </GText>
        {RECIPE_UNITS.map((id) => {
          const def = UNITS[id];
          const gi = GRADES[def.grade];
          const have = g.ingredientStatus(id);
          const ok = hud.craftable.includes(id);
          return (
            <View key={id} style={[styles.card, { borderColor: ok ? C.gold : C.edge }]}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[styles.bigIcon, { borderColor: gi.color }]}>
                  <Image source={{ uri: unitIcon(id, 96) }} style={{ width: 58, height: 58 }} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <GText size={17} numberOfLines={1}>
                      {def.name}
                    </GText>
                    <GradeChip grade={def.grade} small />
                  </View>
                  <GText size={12} color={C.sub} numberOfLines={2}>
                    {def.desc}
                  </GText>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                {(def.recipe ?? []).map((m, i) => (
                  <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {i > 0 ? <GText size={18} color={C.dim}>+</GText> : null}
                    <View style={[styles.mat, { borderColor: have[i] ? C.good : C.edge, opacity: have[i] ? 1 : 0.55 }]}>
                      <Image source={{ uri: unitIcon(m, 64) }} style={{ width: 40, height: 40 }} />
                      <View style={[styles.matMark, { backgroundColor: have[i] ? C.goodDeep : C.dangerDeep }]}>
                        <Icon name={have[i] ? 'check' : 'close'} size={9} />
                      </View>
                    </View>
                  </View>
                ))}
                <View style={{ flex: 1 }} />
                <GButton label="조합" variant={ok ? 'gold' : 'dark'} height={38} fontSize={16} style={{ width: 78 }} glow={ok} onPress={() => (ok ? session.craft(id) : session.highlightRecipe(id))} />
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

// ───────────────────────────── 강화 ─────────────────────────────

export function UpgradeSheet({ session, hud, visible, onClose, bottomInset }: SheetProps) {
  const g = session.game;
  const odds = SUMMON_ODDS[hud.luck];
  const nextOdds = SUMMON_ODDS[Math.min(MAX_LUCK_LEVEL, hud.luck + 1)];
  const present = new Set<number>();
  for (const s of g.slots) if (s.units[0]) present.add(UNITS[s.units[0].id].grade);
  return (
    <Sheet visible={visible} title="강화" onClose={onClose} bottomInset={bottomInset} heightPct={0.6}>
      <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="gem" size={20} />
          <GText size={18} color={C.gem}>
            보석 {hud.gems}
          </GText>
          <GText size={12} color={C.sub} style={{ flex: 1, textAlign: 'right' }}>
            보스를 잡거나 룰렛에서 얻어요
          </GText>
        </View>

        <View style={[styles.card, { borderColor: C.good }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="clover" size={26} color={C.good} />
            <View style={{ flex: 1 }}>
              <GText size={16}>행운 Lv.{hud.luck}{hud.luck >= MAX_LUCK_LEVEL ? ' (최대)' : ''}</GText>
              <GText size={12} color={C.sub}>
                소환할 때 높은 등급이 더 잘 나와요
              </GText>
            </View>
            <GButton
              variant={hud.luckCost !== null && hud.gems >= hud.luckCost ? 'primary' : 'dark'}
              height={38}
              style={{ width: 86 }}
              onPress={() => session.upgradeLuck()}
              disabled={hud.luckCost === null}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="gem" size={16} />
                <GText size={16} color={hud.luckCost !== null && hud.gems >= hud.luckCost ? '#06280f' : '#c8d2ff'}>
                  {hud.luckCost ?? 'MAX'}
                </GText>
              </View>
            </GButton>
          </View>
          <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                <Bar value={odds[i]} color={GRADES[(i + 1) as Grade].color} height={8} />
                <GText size={11} color={GRADES[(i + 1) as Grade].color}>
                  {GRADES[(i + 1) as Grade].name} {(odds[i] * 100).toFixed(odds[i] < 0.1 ? 1 : 0)}%
                  {hud.luck < MAX_LUCK_LEVEL ? ` →${(nextOdds[i] * 100).toFixed(nextOdds[i] < 0.1 ? 1 : 0)}` : ''}
                </GText>
              </View>
            ))}
          </View>
        </View>

        {GRADE_LIST.map((gr) => {
          const gi = GRADES[gr];
          const lvl = hud.gradeLevels[gr];
          const cost = hud.gradeCosts[gr - 1];
          const can = cost !== null && hud.gems >= cost;
          return (
            <View key={gr} style={[styles.card, { borderColor: present.has(gr) ? gi.color : C.edge, opacity: present.has(gr) || lvl > 0 ? 1 : 0.7 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.gradeDot, { backgroundColor: gi.color }]} />
                <View style={{ flex: 1 }}>
                  <GText size={16} color={gi.color}>
                    {gi.name} 등급 Lv.{lvl}
                    {lvl >= MAX_GRADE_LEVEL ? ' (최대)' : ''}
                  </GText>
                  <GText size={12} color={C.sub}>
                    모든 {gi.name} 유닛 공격력 +{Math.round(lvl * GRADE_LEVEL_BONUS * 100)}%
                    {cost !== null ? ` → +${Math.round((lvl + 1) * GRADE_LEVEL_BONUS * 100)}%` : ''}
                  </GText>
                </View>
                <GButton variant={can ? 'blue' : 'dark'} height={38} style={{ width: 86 }} disabled={cost === null} onPress={() => session.upgradeGrade(gr)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Icon name="gem" size={16} />
                    <GText size={16} color={can ? '#04203f' : '#c8d2ff'}>
                      {cost ?? 'MAX'}
                    </GText>
                  </View>
                </GButton>
              </View>
            </View>
          );
        })}
        <View style={{ height: 4 }} />
        <GText size={11} color={C.dim} style={{ textAlign: 'center' }}>
          행운 강화 비용: {LUCK_COSTS.join(' → ')} 보석
        </GText>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.panelLo, borderRadius: 16, borderWidth: 2, padding: 10 },
  bigIcon: { width: 66, height: 66, borderRadius: 16, borderWidth: 2.5, backgroundColor: C.panelHi, alignItems: 'center', justifyContent: 'center' },
  mat: { width: 48, height: 48, borderRadius: 12, borderWidth: 2, backgroundColor: C.panelHi, alignItems: 'center', justifyContent: 'center' },
  matMark: { position: 'absolute', right: -4, bottom: -4, width: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff' },
  gradeDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
});

export type { UnitId };
