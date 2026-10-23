import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ENEMIES, type EnemyKind } from '@/game/engine/enemies';
import { GRADE_LIST, GRADES, UNIT_IDS, UNITS, type UnitId } from '@/game/engine/units';
import { enemyIcon, unitIcon } from '@/game/render/icons';
import { MONSTER_DESC, unitSpecLines } from '@/game/ui/unitInfo';
import { useSave } from '@/storage/save';
import { Bar, GradeChip, GText } from '@/ui/bits';
import { Popup } from '@/ui/Modal';
import { RoundButton } from '@/game/ui/hud';
import { C } from '@/ui/theme';

type Tab = 'units' | 'monsters';

export default function Almanac() {
  const insets = useSafeAreaInsets();
  const save = useSave();
  const [tab, setTab] = useState<Tab>('units');
  const [unit, setUnit] = useState<UnitId | null>(null);
  const [mon, setMon] = useState<EnemyKind | null>(null);
  const found = UNIT_IDS.filter((id) => save.discovered.includes(id)).length;
  const kinds = Object.keys(ENEMIES) as EnemyKind[];

  return (
    <View style={styles.outer}>
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={styles.header}>
        <RoundButton icon="back" label="뒤로" onPress={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <GText size={26}>도감</GText>
          <GText size={13} color={C.sub}>
            유닛 {found}/{UNIT_IDS.length} 발견
          </GText>
        </View>
        <View style={{ width: 42 }} />
      </View>

      <View style={styles.tabs}>
        {(['units', 'monsters'] as Tab[]).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]} accessibilityRole="button">
            <GText size={17} color={tab === t ? '#06280f' : C.sub}>
              {t === 'units' ? '유닛' : '몬스터'}
            </GText>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 24, gap: 14 }}>
        {tab === 'units'
          ? GRADE_LIST.map((g) => {
              const ids = UNIT_IDS.filter((id) => UNITS[id].grade === g);
              if (ids.length === 0) return null;
              return (
                <View key={g} style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <GradeChip grade={g} />
                    <GText size={13} color={C.sub}>
                      {g <= 4 ? '소환·합성으로 등장' : '레시피 조합으로만 얻을 수 있어요'}
                    </GText>
                  </View>
                  <View style={styles.grid}>
                    {ids.map((id) => {
                      const known = save.discovered.includes(id);
                      return (
                        <Pressable key={id} onPress={() => setUnit(id)} style={[styles.card, { borderColor: known ? GRADES[g].color : C.edge }]} accessibilityRole="button" accessibilityLabel={known ? UNITS[id].name : '미발견 유닛'}>
                          <Image source={{ uri: unitIcon(id, 96) }} style={[styles.icon, !known && { tintColor: '#05071a', opacity: 0.75 }]} />
                          <GText size={12} color={known ? '#fff' : C.dim} numberOfLines={1}>
                            {known ? UNITS[id].name : '???'}
                          </GText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })
          : (
            <View style={styles.grid}>
              {kinds.map((k) => (
                <Pressable key={k} onPress={() => setMon(k)} style={[styles.card, { borderColor: ENEMIES[k].boss ? C.danger : C.edge }]} accessibilityRole="button">
                  <Image source={{ uri: enemyIcon(k, 96) }} style={styles.icon} />
                  <GText size={12} numberOfLines={1}>
                    {ENEMIES[k].name}
                  </GText>
                </Pressable>
              ))}
            </View>
          )}
      </ScrollView>

      <Popup visible={unit !== null} title={unit && save.discovered.includes(unit) ? UNITS[unit].name : '???'} onClose={() => setUnit(null)}>
        {unit ? <UnitDetail id={unit} known={save.discovered.includes(unit)} onPick={setUnit} /> : null}
      </Popup>
      <Popup visible={mon !== null} title={mon ? ENEMIES[mon].name : ''} onClose={() => setMon(null)}>
        {mon ? (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Image source={{ uri: enemyIcon(mon, 192) }} style={{ width: 120, height: 120 }} />
            <GText size={15} color={C.sub} style={{ textAlign: 'center' }}>
              {MONSTER_DESC[mon]}
            </GText>
            <Bar value={ENEMIES[mon].boss ? 1 : 0.4} color={ENEMIES[mon].boss ? C.danger : C.good} height={8} style={{ alignSelf: 'stretch' }} />
            <GText size={12} color={C.dim}>
              {ENEMIES[mon].boss ? '필드 가중치 10 — 놔두면 금방 위험해져요' : '필드 가중치 1'}
            </GText>
          </View>
        ) : null}
      </Popup>
    </View>
    </View>
  );
}

function UnitDetail({ id, known, onPick }: { id: UnitId; known: boolean; onPick: (id: UnitId) => void }) {
  const d = UNITS[id];
  const gi = GRADES[d.grade];
  if (!known) {
    return (
      <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
        <Image source={{ uri: unitIcon(id, 192) }} style={{ width: 120, height: 120, tintColor: '#05071a', opacity: 0.75 }} />
        <GText size={15} color={C.sub} style={{ textAlign: 'center' }}>
          아직 만나지 못한 유닛이에요.{'\n'}
          {d.grade <= 4 ? '소환이나 합성으로 만나보세요!' : '레시피를 모아 조합해 보세요!'}
        </GText>
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View style={[styles.big, { borderColor: gi.color }]}>
          <Image source={{ uri: unitIcon(id, 192) }} style={{ width: 104, height: 104 }} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <GradeChip grade={d.grade} />
            <GText size={14} color={C.sub}>
              {d.role}
            </GText>
          </View>
          <GText size={14} color="#fff">
            {d.desc}
          </GText>
          <GText size={13} color={C.gold}>
            공격력 {d.dmg.toLocaleString()} · {d.cd}초마다
          </GText>
        </View>
      </View>
      <View style={styles.specs}>
        {unitSpecLines(d).map((l) => (
          <GText key={l} size={13} color={C.sub}>
            • {l}
          </GText>
        ))}
      </View>
      {d.recipe ? (
        <View style={{ gap: 4 }}>
          <GText size={13} color={C.violet}>
            조합 재료
          </GText>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {d.recipe.map((m, i) => (
              <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {i > 0 ? <GText size={18} color={C.dim}>+</GText> : null}
                <Pressable onPress={() => onPick(m)} style={[styles.mat, { borderColor: GRADES[UNITS[m].grade].color }]} accessibilityRole="button">
                  <Image source={{ uri: unitIcon(m, 64) }} style={{ width: 44, height: 44 }} />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#05081a', alignItems: 'center' },
  root: { flex: 1, width: '100%', maxWidth: 560, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  tab: { flex: 1, height: 40, borderRadius: 14, backgroundColor: C.panel, borderWidth: 2, borderColor: C.edge, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: '#4ee08a', borderColor: '#1e8a4a' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { width: '23%', minWidth: 74, flexGrow: 1, maxWidth: 120, alignItems: 'center', gap: 2, paddingVertical: 6, borderRadius: 14, backgroundColor: C.panel, borderWidth: 2 },
  icon: { width: 62, height: 62 },
  big: { width: 118, height: 118, borderRadius: 20, borderWidth: 3, backgroundColor: C.panelHi, alignItems: 'center', justifyContent: 'center' },
  specs: { gap: 3, padding: 10, borderRadius: 14, backgroundColor: C.panelLo },
  mat: { width: 54, height: 54, borderRadius: 14, borderWidth: 2.5, backgroundColor: C.panelHi, alignItems: 'center', justifyContent: 'center' },
});

