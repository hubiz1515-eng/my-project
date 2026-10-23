import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  // 한 판 = 세션 하나. '다시 도전'은 새 세션(+ 판 시작 시점의 최고 기록)으로 교체한다.
  const [round, setRound] = useState(() => ({ n: 0, prevBest: getSave().bestWave }));
  const session = useMemo(() => new GameSession(seed !== undefined ? seed + round.n : undefined), [round, seed]);
  const hud = useHud(session);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [roulette, setRoulette] = useState<{ index: number; id: RouletteId; n: number } | null>(null);
  const [resultReady, setResultReady] = useState(false);

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
    setResultReady(false);
    setSheet(null);
    setRoulette(null);
    setRound((r) => ({ n: r.n + 1, prevBest: getSave().bestWave }));
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

  // 게임이 끝나면 잠깐 여운을 두고 결과창을 연다 (무한 모드로 이어가면 다시 닫힌다)
  const over = hud.status !== 'playing';
  useEffect(() => {
    if (!over) return;
    const t = setTimeout(() => setResultReady(true), 1400);
    return () => {
      clearTimeout(t);
      setResultReady(false);
    };
  }, [over, hud.endless]);

  const openRoulette = () => {
    const r = session.startRoulette();
    if (!r.ok) {
      session.toast(r.reason === 'none' ? '룰렛 티켓이 없어요 (5웨이브마다·보스 처치 시 획득)' : '이미 진행 중이에요', 'info');
      return;
    }
    setSheet(null);
    setRoulette({ index: r.index, id: r.id, n: Date.now() });
  };

  return (
    <View style={styles.outer}>
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top + 4 }}>
        <TopBar session={session} hud={hud} onPause={() => session.setPaused(true)} />
        <BossBar hud={hud} />
      </View>
      <View style={styles.board}>
        <BoardCanvas key={round.n} session={session} />
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
      {roulette ? <RouletteModal key={roulette.n} session={session} start={roulette} onClose={() => setRoulette(null)} /> : null}
      {hud.paused && hud.status === 'playing' ? <PauseModal onResume={() => session.setPaused(false)} onRetry={retry} onHome={home} /> : null}
      {resultReady && over ? <ResultModal session={session} hud={hud} prevBest={round.prevBest} onRetry={retry} onHome={home} /> : null}
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#05081a', alignItems: 'center' },
  root: { flex: 1, width: '100%', maxWidth: 560, backgroundColor: C.bg, overflow: 'hidden' },
  board: { flex: 1, overflow: 'hidden' },
});
