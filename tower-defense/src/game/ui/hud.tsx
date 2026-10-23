import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ENEMY_LIMIT, ENEMY_WARN, FINAL_WAVE, PITY_MAX } from '../engine/config';
import { ENEMIES } from '../engine/enemies';
import { GRADES, UNITS } from '../engine/units';
import type { WaveRole } from '../engine/waves';
import { enemyIcon, unitIcon } from '../render/icons';
import { Bar, GradeChip, GText, Pill } from '@/ui/bits';
import { GButton } from '@/ui/GButton';
import { Icon } from '@/ui/Icon';
import { C, FONT } from '@/ui/theme';
import type { GameSession, Hud, ToastKind } from './session';

export function useHud(session: GameSession): Hud {
  return useSyncExternalStore(session.subscribe, session.getHud, session.getHud);
}

export const ROLE_LABEL: Record<WaveRole, string> = {
  standard: '일반',
  swarm: '떼거리',
  fast: '질주',
  tank: '중장갑',
  elite: '정예',
  boss: '보스',
};

// ───────────────────────────── 상단 ─────────────────────────────

function SmoothBar({ value, color, height = 10 }: { value: number; color: string; height?: number }) {
  const v = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: value, duration: value < 0.02 ? 0 : 950, easing: Easing.linear, useNativeDriver: false }).start();
  }, [value, v]);
  const width = v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'], extrapolate: 'clamp' });
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: 'rgba(0,0,0,0.5)', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
      <Animated.View style={{ width, height: '100%', backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

export function RoundButton({ icon, onPress, size = 42, label }: { icon: 'pause' | 'play' | 'gear' | 'back' | 'close' | 'book'; onPress: () => void; size?: number; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.round, { width: size, height: size, borderRadius: size / 2, transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
      <Icon name={icon} size={size * 0.5} />
    </Pressable>
  );
}

export function TopBar({ session, hud, onPause }: { session: GameSession; hud: Hud; onPause: () => void }) {
  const left = hud.waveDuration > 0 ? 1 - hud.waveClock / hud.waveDuration : 0;
  const danger = hud.fieldWeight >= ENEMY_WARN;
  const meter = Math.min(1, hud.fieldWeight / ENEMY_LIMIT);
  const wobble = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!danger) {
      wobble.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.sequence([Animated.timing(wobble, { toValue: 1, duration: 220, useNativeDriver: false }), Animated.timing(wobble, { toValue: 0, duration: 220, useNativeDriver: false })]));
    loop.start();
    return () => loop.stop();
  }, [danger, wobble]);
  const bg = wobble.interpolate({ inputRange: [0, 1], outputRange: ['rgba(8,12,34,0.72)', 'rgba(150,20,50,0.9)'] });
  const waveLabel = hud.wave === 0 ? '준비!' : hud.endless ? `WAVE ${hud.wave}` : `WAVE ${hud.wave}`;
  const sub = hud.wave === 0 ? `${hud.waveClock}초 뒤 시작` : `${ROLE_LABEL[hud.waveRole]} 웨이브 · ${hud.waveClock}초`;

  return (
    <View style={styles.top}>
      <View style={styles.topRow}>
        <RoundButton icon="pause" onPress={onPause} label="일시정지" />
        <View style={styles.waveBox}>
          <View style={styles.waveTitleRow}>
            <GText size={26} color="#fff" style={styles.outlined}>
              {waveLabel}
            </GText>
            {!hud.endless && hud.wave > 0 ? (
              <GText size={14} color={C.sub} style={{ marginBottom: 3 }}>
                {' '}
                / {FINAL_WAVE}
              </GText>
            ) : null}
          </View>
          <SmoothBar value={hud.wave === 0 ? 0 : left} color={hud.waveRole === 'boss' ? C.danger : C.gold} height={9} />
          <GText size={12} color={C.sub} style={{ textAlign: 'center', marginTop: 2 }}>
            {sub}
          </GText>
        </View>
        <Pressable onPress={() => session.cycleSpeed()} accessibilityRole="button" accessibilityLabel="배속" style={({ pressed }) => [styles.round, styles.speed, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
          <Icon name="fast" size={18} color={hud.speed > 1 ? C.gold : '#fff'} />
          <Text style={[styles.speedText, { color: hud.speed > 1 ? C.gold : '#fff' }]}>x{hud.speed}</Text>
        </Pressable>
      </View>
      <View style={styles.pillRow}>
        <Pill icon="coin" value={hud.gold} color={C.gold} minWidth={86} />
        <Pill icon="gem" value={hud.gems} color={C.gem} minWidth={60} />
        {hud.buffSeconds > 0 ? <Pill icon="up" value={`${hud.buffSeconds}s`} color={C.good} minWidth={58} /> : null}
        <View style={{ flex: 1 }} />
        <Animated.View style={[styles.meter, { backgroundColor: bg }]}>
          <Icon name="skull" size={18} color={danger ? '#ffd0d8' : '#fff'} />
          <View style={{ flex: 1 }}>
            <Bar value={meter} height={8} color={meter > 0.85 ? C.danger : meter > 0.6 ? C.gold : C.good} />
          </View>
          <Text style={[styles.meterText, { color: danger ? '#ffd0d8' : '#fff' }]}>
            {hud.fieldWeight}/{ENEMY_LIMIT}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

export function BossBar({ hud }: { hud: Hud }) {
  const b = hud.boss;
  if (!b) return null;
  return (
    <View style={styles.bossBar}>
      <Image source={{ uri: enemyIcon(b.kind, 64) }} style={{ width: 34, height: 34 }} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <GText size={14} color={C.gold}>
            {b.name}
          </GText>
          <GText size={13} color="#fff">
            {Math.round(b.ratio * 100)}%
          </GText>
        </View>
        <Bar value={b.ratio} color={C.danger} height={10} />
      </View>
    </View>
  );
}

// ───────────────────────────── 배너 / 토스트 ─────────────────────────────

export function WaveBanner({ session }: { session: GameSession }) {
  const [data, setData] = useState<{ wave: number; boss: boolean; elite: boolean; key: number } | null>(null);
  const a = useRef(new Animated.Value(0)).current;
  useEffect(
    () =>
      session.onUi((e) => {
        if (e.type !== 'banner' && e.type !== 'jackpot') return;
        if (e.type === 'jackpot') return;
        setData({ wave: e.wave, boss: e.boss, elite: e.elite, key: Date.now() });
        a.setValue(0);
        Animated.sequence([Animated.timing(a, { toValue: 1, duration: 320, easing: Easing.out(Easing.back(1.8)), useNativeDriver: false }), Animated.delay(e.boss ? 1100 : 600), Animated.timing(a, { toValue: 2, duration: 320, useNativeDriver: false })]).start();
      }),
    [session, a],
  );
  if (!data) return null;
  const scale = a.interpolate({ inputRange: [0, 1, 2], outputRange: [0.4, 1, 1.15] });
  const opacity = a.interpolate({ inputRange: [0, 0.4, 1, 1.6, 2], outputRange: [0, 1, 1, 1, 0] });
  const color = data.boss ? C.danger : data.elite ? C.gold : '#fff';
  return (
    <Animated.View pointerEvents="none" style={[styles.banner, { opacity, transform: [{ scale }] }]}>
      <GText size={data.boss ? 40 : 34} color={color} style={styles.bannerText}>
        {data.boss ? '보스 등장!' : data.elite ? '정예 몬스터!' : `WAVE ${data.wave}`}
      </GText>
      {data.boss || data.elite ? (
        <GText size={18} color="#fff" style={styles.bannerSub}>
          WAVE {data.wave}
        </GText>
      ) : null}
    </Animated.View>
  );
}

interface ToastItem {
  id: number;
  text: string;
  kind: ToastKind;
}

const TOAST_COLOR: Record<ToastKind, string> = { info: '#2a3a7a', good: '#1f7a46', bad: '#a02040', gold: '#8a5a10' };

export function Toasts({ session }: { session: GameSession }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(1);
  useEffect(
    () =>
      session.onUi((e) => {
        if (e.type !== 'toast') return;
        const id = idRef.current++;
        setItems((l) => [...l.slice(-2), { id, text: e.text, kind: e.kind }]);
        setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 1900);
      }),
    [session],
  );
  return (
    <View pointerEvents="none" style={styles.toasts}>
      {items.map((t) => (
        <View key={t.id} style={[styles.toast, { backgroundColor: TOAST_COLOR[t.kind] }]}>
          <GText size={15} color="#fff">
            {t.text}
          </GText>
        </View>
      ))}
    </View>
  );
}

// ───────────────────────────── 하단 ─────────────────────────────

function InfoStrip({ session, hud }: { session: GameSession; hud: Hud }) {
  const id = hud.selectedId;
  if (id) {
    const def = UNITS[id];
    const gi = GRADES[def.grade];
    const sell = session.game.sellValue(id);
    const dps = Math.round((def.dmg * session.game.gradeMul(def.grade)) / def.cd);
    return (
      <View style={styles.info}>
        <View style={[styles.infoIcon, { borderColor: gi.color }]}>
          <Image source={{ uri: unitIcon(id, 96) }} style={{ width: 46, height: 46 }} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <GText size={16} color="#fff" numberOfLines={1}>
              {def.name}
            </GText>
            <GradeChip grade={def.grade} small />
            <GText size={12} color={C.sub}>
              {def.role} ×{hud.selectedCount}
            </GText>
          </View>
          <GText size={12} color={C.sub} numberOfLines={2}>
            {def.desc}
          </GText>
          <GText size={11} color={C.dim}>
            공격 {dps.toLocaleString()}/초 (기본)
          </GText>
        </View>
        <View style={{ gap: 6, alignItems: 'stretch' }}>
          {hud.selectedMergeable ? <GButton label="합성" variant="gold" height={32} fontSize={15} style={{ width: 70 }} glow onPress={() => session.mergeSelected()} /> : null}
          <GButton label={`판매 ${sell}`} variant="dark" height={30} fontSize={13} style={{ width: 70 }} onPress={() => session.sellSelected()} />
        </View>
      </View>
    );
  }
  let text: string;
  let sub: string | null = null;
  let icon: 'play' | 'merge' | 'crown' | 'book' | 'skull' = 'skull';
  if (hud.unitCount === 0) {
    text = '소환 버튼을 눌러 첫 유닛을 뽑아보세요!';
    icon = 'play';
  } else if (hud.craftable.length > 0) {
    text = `${UNITS[hud.craftable[0]].name} 조합 가능! '조합'을 눌러보세요`;
    icon = 'crown';
  } else if (hud.mergeable > 0) {
    text = '같은 유닛 3기 모였어요! 선택해서 합성하세요';
    icon = 'merge';
  } else if (hud.hasPair) {
    text = '같은 유닛을 한 기만 더 모으면 합성할 수 있어요';
    icon = 'merge';
  } else {
    const k = hud.nextKind;
    text = `다음 웨이브: ${ROLE_LABEL[hud.nextRole]} · ${ENEMIES[k].name}`;
    sub = hud.nextBoss ? '보스 웨이브! 단단히 준비하세요' : hud.nextRole === 'elite' ? '정예 몬스터가 섞여 나와요' : null;
  }
  return (
    <View style={styles.info}>
      <View style={[styles.infoIcon, { borderColor: C.edge }]}>
        {icon === 'skull' ? <Image source={{ uri: enemyIcon(hud.nextKind, 96) }} style={{ width: 46, height: 46 }} /> : <Icon name={icon} size={28} color={C.gold} />}
      </View>
      <View style={{ flex: 1 }}>
        <GText size={15} color="#fff" numberOfLines={2}>
          {text}
        </GText>
        {sub ? (
          <GText size={12} color={C.gold}>
            {sub}
          </GText>
        ) : null}
      </View>
    </View>
  );
}

interface BottomProps {
  session: GameSession;
  hud: Hud;
  onRecipes: () => void;
  onUpgrades: () => void;
  onRoulette: () => void;
  bottomInset: number;
}

export function BottomBar({ session, hud, onRecipes, onUpgrades, onRoulette, bottomInset }: BottomProps) {
  const pity = hud.pity / PITY_MAX;
  return (
    <View style={[styles.bottom, { paddingBottom: Math.max(10, bottomInset + 4) }]}>
      <InfoStrip session={session} hud={hud} />
      <View style={styles.controls}>
        <View style={styles.side}>
          <GButton vertical icon={<Icon name="book" size={22} />} label="조합" variant="violet" height={54} fontSize={13} badge={hud.craftable.length || undefined} glow={hud.craftable.length > 0} onPress={onRecipes} />
        </View>
        <View style={styles.side}>
          <GButton vertical icon={<Icon name="hammer" size={22} />} label="강화" variant="blue" height={54} fontSize={13} badge={hud.affordableUpgrade ? '!' : undefined} onPress={onUpgrades} />
        </View>
        <View style={styles.center}>
          <GButton
            variant={hud.canAffordSummon && !hud.boardFull ? 'primary' : 'dark'}
            accessibilityLabel="소환"
            height={58}
            glow={hud.canAffordSummon && !hud.boardFull}
            onPress={() => session.summon()}
          >
            <View style={{ alignItems: 'center' }}>
              <GText size={24} color={hud.canAffordSummon && !hud.boardFull ? '#06280f' : '#c8d2ff'}>
                {hud.boardFull ? '자리 없음' : '소환'}
              </GText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -2 }}>
                <Icon name="coin" size={15} />
                <GText size={15} color={hud.canAffordSummon ? '#06280f' : C.danger}>
                  {hud.summonCost}
                </GText>
              </View>
            </View>
          </GButton>
          <View style={styles.luckRow}>
            <Icon name="clover" size={13} color={C.good} />
            <View style={{ flex: 1 }}>
              <Bar value={pity} color={pity >= 1 ? C.gold : C.good} height={7} />
            </View>
            <GText size={11} color={pity >= 1 ? C.gold : C.sub}>
              {pity >= 1 ? '다음은 영웅+!' : `행운 ${hud.pity}/${PITY_MAX}`}
            </GText>
          </View>
        </View>
        <View style={styles.side}>
          <GButton vertical icon={<Icon name="ticket" size={22} />} label="룰렛" variant="gold" height={54} fontSize={13} badge={hud.tickets || undefined} glow={hud.tickets > 0} onPress={onRoulette} />
        </View>
        <View style={styles.side}>
          <GButton vertical icon={<Icon name="merge" size={22} color="#fff" />} label="모두합성" variant={hud.mergeable > 0 ? 'gold' : 'dark'} height={54} fontSize={12} badge={hud.mergeable || undefined} onPress={() => session.mergeAll()} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 10, paddingBottom: 4, gap: 6 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  waveBox: { flex: 1, gap: 2 },
  waveTitleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  outlined: { textShadowColor: '#10152e', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  round: {
    backgroundColor: 'rgba(8,12,34,0.72)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speed: { width: 54, height: 42, borderRadius: 21, flexDirection: 'row', gap: 2 },
  speedText: { fontFamily: FONT, fontSize: 15 },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    width: 160,
    paddingHorizontal: 9,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  meterText: { fontFamily: FONT, fontSize: 14, minWidth: 48, textAlign: 'right' },
  bossBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 10,
    padding: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(70,10,30,0.82)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,120,150,0.6)',
  },
  banner: { position: 'absolute', left: 0, right: 0, top: '28%', alignItems: 'center' },
  bannerText: { textShadowColor: '#10152e', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 8 },
  bannerSub: { textShadowColor: '#10152e', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  toasts: { position: 'absolute', top: 8, left: 0, right: 0, alignItems: 'center', gap: 6 },
  toast: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)' },
  bottom: { backgroundColor: C.bg2, borderTopWidth: 2, borderTopColor: C.edge, paddingHorizontal: 8, paddingTop: 8, gap: 8 },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 64,
    padding: 7,
    borderRadius: 16,
    backgroundColor: C.panelLo,
    borderWidth: 1.5,
    borderColor: C.edge,
  },
  infoIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: C.panelHi, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  controls: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  side: { width: 56, paddingTop: 2 },
  center: { flex: 1, gap: 3 },
  luckRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 2 },
});
