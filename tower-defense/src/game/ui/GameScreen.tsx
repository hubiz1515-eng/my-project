import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RouletteId } from '../engine/game';
import { getSave } from '@/storage/save';
import { C } from '@/ui/theme';
import { BoardCanvas } from './BoardCanvas';
import { BossBar, BottomBar, TopBar, Toasts, useHud, WaveBanner } from './hud';
import { PauseModal, ResultModal } from './modals';
import { RouletteModal } from './RouletteModal';
import { GameSession } from './session';
import { RecipeSheet, UpgradeSheet } from './sheets';

type SheetKind = 'recipes' | 'upgrades' | null;

export function GameScreen({ seed }: { seed?: number }) {
  const insets = useSafeAreaInsets();
  const [run, setRun] = useState(0);
  const prevBest = useRef(getSave().bestWave);
  const session = useMemo(() => {
    prevBest.current = getSave().bestWave;
    return new GameSession(seed !== undefined ? seed + run : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, seed]);
  const hud = useHud(session);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [roulette, setRoulette] = useState<{ index: number; id: RouletteId } | null>(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    activateKeepAwakeAsync('game').catch(() => {});
    return () => {
      deactivateKeepAwake('game').catch(() => {});
    };
  }, []);

  useEffect(() => {
    // 디버그/스크린샷용: ?debug 가 있으면 세션을 window 에 노출
    if (typeof window !== 'undefined' && window.location?.search?.includes('debug')) {
      (window as unknown as { __td: GameSession }).__td = session;
    }
    return () => session.leave();
  }, [session]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') session.setPaused(true);
    });
    return () => sub.remove();
  }, [session]);

  const home = useCallback(() => {
    session.leave();
    router.replace('/');
  }, [session]);

  const retry = useCallback(() => {
    session.leave();
    setShowResult(false);
    setSheet(null);
    setRoulette(null);
    setRun((r) => r + 1);
  }, [session]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (roulette) return true;
      if (sheet) {
        session.highlightRecipe(null);
        setSheet(null);
        return true;
      }
      session.setPaused(!session.paused);
      return true;
    });
    return () => sub.remove();
  }, [session, sheet, roulette]);

  useEffect(() => {
    if (hud.status === 'playing') {
      setShowResult(false);
      return;
    }
    const t = setTimeout(() => setShowResult(true), 1400);
    return () => clearTimeout(t);
  }, [hud.status, hud.endless]);

  const openRoulette = () => {
    const r = session.startRoulette();
    if (!r.ok) {
      session.toast(r.reason === 'none' ? '룰렛 티켓이 없어요 (5웨이브마다·보스 처치 시 획득)' : '이미 진행 중이에요', 'info');
      return;
    }
    setSheet(null);
    setRoulette({ index: r.index, id: r.id });
  };

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top + 4 }}>
        <TopBar session={session} hud={hud} onPause={() => session.setPaused(true)} />
        <BossBar hud={hud} />
      </View>
      <View style={styles.board}>
        <BoardCanvas session={session} />
        <WaveBanner session={session} />
        <Toasts session={session} />
      </View>
      <BottomBar
        session={session}
        hud={hud}
        bottomInset={insets.bottom}
        onRecipes={() => setSheet('recipes')}
        onUpgrades={() => setSheet('upgrades')}
        onRoulette={openRoulette}
      />
      <RecipeSheet session={session} hud={hud} visible={sheet === 'recipes'} onClose={() => setSheet(null)} bottomInset={insets.bottom} />
      <UpgradeSheet session={session} hud={hud} visible={sheet === 'upgrades'} onClose={() => setSheet(null)} bottomInset={insets.bottom} />
      <RouletteModal
        session={session}
        start={roulette}
        onClose={() => {
          setRoulette(null);
        }}
      />
      {hud.paused && hud.status === 'playing' ? <PauseModal onResume={() => session.setPaused(false)} onRetry={retry} onHome={home} /> : null}
      {showResult && hud.status !== 'playing' ? <ResultModal session={session} hud={hud} prevBest={prevBest.current} onRetry={retry} onHome={home} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  board: { flex: 1, overflow: 'hidden' },
});
