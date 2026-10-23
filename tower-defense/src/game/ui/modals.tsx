import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { FINAL_WAVE } from '../engine/config';
import { UNITS } from '../engine/units';
import { unitIcon } from '../render/icons';
import { setSetting, useSave, type Settings } from '@/storage/save';
import { GText } from '@/ui/bits';
import { GButton } from '@/ui/GButton';
import { Icon, type IconName } from '@/ui/Icon';
import { C } from '@/ui/theme';
import type { GameSession, Hud } from './session';

function Overlay({ children, dim = 0.82 }: { children: React.ReactNode; dim?: number }) {
  return <View style={[styles.overlay, { backgroundColor: `rgba(5,8,25,${dim})` }]}>{children}</View>;
}

function Stat({ label, value, color = '#fff' }: { label: string; value: string | number; color?: string }) {
  return (
    <View style={styles.stat}>
      <GText size={13} color={C.sub}>
        {label}
      </GText>
      <GText size={20} color={color}>
        {value}
      </GText>
    </View>
  );
}

// ───────────────────────────── 결과 ─────────────────────────────

interface ResultProps {
  session: GameSession;
  hud: Hud;
  prevBest: number;
  onRetry: () => void;
  onHome: () => void;
}

export function ResultModal({ session, hud, prevBest, onRetry, onHome }: ResultProps) {
  const g = session.game;
  const won = hud.status === 'won';
  const newBest = hud.wave > prevBest;
  const best = [...g.discovered].filter((id) => UNITS[id].grade >= 4).slice(-4);
  return (
    <Overlay>
      <View style={[styles.card, { borderColor: won ? C.gold : C.danger }]}>
        <GText size={36} color={won ? C.gold : C.danger} style={styles.bigTitle}>
          {won ? '승리!' : '패배...'}
        </GText>
        <GText size={15} color={C.sub} style={{ textAlign: 'center' }}>
          {won ? `${FINAL_WAVE}웨이브를 모두 막아냈어요!` : '몬스터가 너무 많아졌어요'}
        </GText>
        {newBest ? (
          <View style={styles.newBest}>
            <Icon name="crown" size={18} />
            <GText size={16} color="#4a2e00">
              최고 기록 갱신!
            </GText>
          </View>
        ) : null}
        <View style={styles.statGrid}>
          <Stat label="도달 웨이브" value={hud.wave} color={C.gold} />
          <Stat label="처치한 몬스터" value={g.stats.kills.toLocaleString()} />
          <Stat label="합성 횟수" value={g.stats.merges} />
          <Stat label="신화 조합" value={g.stats.crafts} color={C.violet} />
          <Stat label="소환 횟수" value={g.stats.summons} />
          <Stat label="대박 합성" value={g.stats.jackpots} color={C.gold} />
        </View>
        {best.length > 0 ? (
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <GText size={12} color={C.dim}>
              이번에 만난 높은 등급
            </GText>
            {best.map((id) => (
              <Image key={id} source={{ uri: unitIcon(id, 64) }} style={{ width: 30, height: 30 }} />
            ))}
          </View>
        ) : null}
        <View style={{ gap: 10, alignSelf: 'stretch', marginTop: 6 }}>
          {won && !hud.endless ? <GButton label="무한 모드로 계속" variant="violet" height={50} onPress={() => session.continueEndless()} /> : null}
          <GButton label="다시 도전" icon={<Icon name="refresh" size={22} color="#06280f" />} variant="primary" height={52} onPress={onRetry} />
          <GButton label="메인으로" icon={<Icon name="home" size={20} />} variant="dark" height={44} onPress={onHome} />
        </View>
      </View>
    </Overlay>
  );
}

// ───────────────────────────── 일시정지 ─────────────────────────────

function Toggle({ icon, label, on, onPress }: { icon: IconName; label: string; on: boolean; onPress: () => void }) {
  return (
    <GButton variant={on ? 'blue' : 'dark'} height={44} onPress={onPress} style={{ flex: 1 }}>
      <View style={{ alignItems: 'center', gap: 1 }}>
        <Icon name={icon} size={20} />
        <GText size={12} color={on ? '#04203f' : '#9aa6d8'}>
          {label} {on ? 'ON' : 'OFF'}
        </GText>
      </View>
    </GButton>
  );
}

export function SettingsToggles() {
  const { settings } = useSave();
  const flip = (k: keyof Settings) => setSetting(k, !settings[k]);
  return (
    <View style={{ gap: 8, alignSelf: 'stretch' }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Toggle icon={settings.sound ? 'volume' : 'mute'} label="효과음" on={settings.sound} onPress={() => flip('sound')} />
        <Toggle icon="volume" label="배경음" on={settings.music} onPress={() => flip('music')} />
        <Toggle icon="vibrate" label="진동" on={settings.haptics} onPress={() => flip('haptics')} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Toggle icon="sword" label="데미지 숫자" on={settings.numbers} onPress={() => flip('numbers')} />
        <Toggle icon="star" label="화면 흔들림" on={settings.shake} onPress={() => flip('shake')} />
      </View>
    </View>
  );
}

export function PauseModal({ onResume, onRetry, onHome }: { onResume: () => void; onRetry: () => void; onHome: () => void }) {
  return (
    <Overlay>
      <View style={styles.card}>
        <GText size={30} color="#fff" style={styles.bigTitle}>
          일시정지
        </GText>
        <SettingsToggles />
        <View style={{ gap: 10, alignSelf: 'stretch', marginTop: 6 }}>
          <GButton label="계속하기" icon={<Icon name="play" size={20} color="#06280f" />} variant="primary" height={52} onPress={onResume} />
          <GButton label="다시 시작" icon={<Icon name="refresh" size={20} />} variant="dark" height={44} onPress={onRetry} />
          <GButton label="메인으로" icon={<Icon name="home" size={20} />} variant="dark" height={44} onPress={onHome} />
        </View>
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: 10,
    padding: 18,
    borderRadius: 26,
    backgroundColor: C.panel,
    borderWidth: 3,
    borderColor: C.edge,
  },
  bigTitle: { textShadowColor: '#000', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 6 },
  newBest: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.gold, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  stat: { width: '31%', alignItems: 'center', paddingVertical: 6, borderRadius: 12, backgroundColor: C.panelLo },
});

export { ScrollView };
