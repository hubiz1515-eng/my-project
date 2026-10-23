import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SettingsToggles } from '@/game/ui/modals';
import { TitleScene } from '@/game/ui/TitleScene';
import { resetProgress, useSave } from '@/storage/save';
import { GText } from '@/ui/bits';
import { GButton } from '@/ui/GButton';
import { Icon } from '@/ui/Icon';
import { Popup } from '@/ui/Modal';
import { C } from '@/ui/theme';

export default function Title() {
  const insets = useSafeAreaInsets();
  const save = useSave();
  const [settings, setSettings] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <View style={styles.root}>
      <TitleScene />
      <View style={[styles.logoBox, { paddingTop: insets.top + 28 }]} pointerEvents="none">
        <GText size={20} color="#ffe9a0" style={styles.sub}>
          운빨 합성 디펜스
        </GText>
        <GText size={54} color="#ffd24d" style={styles.logo}>
          럭키
        </GText>
        <GText size={54} color="#ffffff" style={[styles.logo, { marginTop: -14 }]}>
          가디언즈
        </GText>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
        <View style={styles.record}>
          <Icon name="crown" size={20} />
          <GText size={15} color={C.gold}>
            최고 WAVE {save.bestWave}
          </GText>
          <GText size={13} color={C.sub}>
            · {save.plays}판 · 승리 {save.wins}
          </GText>
        </View>
        <GButton label="게임 시작" icon={<Icon name="play" size={24} color="#06280f" />} variant="primary" height={64} fontSize={26} glow onPress={() => router.push('/game')} style={{ alignSelf: 'stretch' }} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <GButton label="도감" icon={<Icon name="book" size={20} />} variant="violet" height={48} style={{ flex: 1 }} onPress={() => router.push('/almanac')} />
          <GButton label="설정" icon={<Icon name="gear" size={20} />} variant="dark" height={48} style={{ flex: 1 }} onPress={() => setSettings(true)} />
        </View>
      </View>

      <Popup visible={settings} title="설정" onClose={() => { setSettings(false); setConfirmReset(false); }}>
        <SettingsToggles />
        <GButton
          label={confirmReset ? '정말 초기화할까요? (한 번 더 누르기)' : '기록 초기화'}
          variant={confirmReset ? 'red' : 'dark'}
          height={42}
          fontSize={15}
          onPress={() => {
            if (confirmReset) {
              resetProgress();
              setConfirmReset(false);
              setSettings(false);
            } else {
              setConfirmReset(true);
            }
          }}
        />
        <GText size={11} color={C.dim} style={{ textAlign: 'center' }}>
          럭키 가디언즈 · 유닛을 소환하고 합성해 몬스터를 막아내세요
        </GText>
      </Popup>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  logoBox: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  logo: { textShadowColor: '#2a0f5a', textShadowOffset: { width: 0, height: 6 }, textShadowRadius: 0, letterSpacing: 2 },
  sub: { textShadowColor: '#10152e', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4, letterSpacing: 3 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 22, gap: 12 },
  record: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 16, backgroundColor: 'rgba(8,12,34,0.7)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)' },
});
