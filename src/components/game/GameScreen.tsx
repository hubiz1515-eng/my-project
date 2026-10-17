import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { applyUpgrade, bladePositions, createGame, pickUpgrades, step, WORLD, type EnemyKind, type Game, type Upgrade } from '../../game/engine';

const BEST_KEY = 'tangtang:bestTime';
const STICK_MAX = 48;
const ENEMY_EMOJI: Record<EnemyKind, string> = { grunt: '👻', fast: '🦊', tank: '🧟', boss: '💀' };

const Grid = memo(function Grid() {
  const lines = [];
  for (let i = 0; i <= WORLD; i += 100) {
    lines.push(<View key={`v${i}`} style={[styles.gridV, { left: i }]} />);
    lines.push(<View key={`h${i}`} style={[styles.gridH, { top: i }]} />);
  }
  return <>{lines}</>;
});

const fmt = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function GameScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<'ready' | 'playing' | 'over'>('ready');
  const [choices, setChoices] = useState<Upgrade[]>([]);
  const [best, setBest] = useState(0);
  const [, tick] = useReducer((n: number) => n + 1, 0);

  const game = useRef<Game>(createGame());
  const move = useRef({ x: 0, y: 0 });
  const stick = useRef<{ ox: number; oy: number; dx: number; dy: number } | null>(null);
  const keys = useRef(new Set<string>());
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const choosing = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(BEST_KEY).then((v) => v && setBest(Number(v) || 0)).catch(() => {});
  }, []);

  // 웹 키보드 (WASD / 방향키)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const down = (e: KeyboardEvent) => keys.current.add(e.key.toLowerCase());
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // 게임 루프
  useEffect(() => {
    let raf = 0;
    let last = Date.now();
    const loop = () => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = game.current;
      if (phaseRef.current === 'playing' && !choosing.current) {
        let mx = move.current.x;
        let my = move.current.y;
        const k = keys.current;
        if (k.size) {
          mx += (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
          my += (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
        }
        step(g, dt, mx, my);
        if (g.over) {
          setPhase('over');
          AsyncStorage.getItem(BEST_KEY)
            .then((v) => { if (g.time > (Number(v) || 0)) { setBest(g.time); return AsyncStorage.setItem(BEST_KEY, String(g.time)); } })
            .catch(() => {});
        } else if (g.pendingLevel > 0) {
          choosing.current = true;
          stick.current = null;
          move.current = { x: 0, y: 0 };
          setChoices(pickUpgrades(g));
        }
        tick();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          stick.current = { ox: e.nativeEvent.pageX, oy: e.nativeEvent.pageY, dx: 0, dy: 0 };
        },
        onPanResponderMove: (_e, gs) => {
          const s = stick.current;
          if (!s) return;
          const len = Math.hypot(gs.dx, gs.dy) || 1;
          const c = Math.min(len, STICK_MAX);
          s.dx = (gs.dx / len) * c;
          s.dy = (gs.dy / len) * c;
          move.current = { x: s.dx / STICK_MAX, y: s.dy / STICK_MAX };
        },
        onPanResponderRelease: () => { stick.current = null; move.current = { x: 0, y: 0 }; },
        onPanResponderTerminate: () => { stick.current = null; move.current = { x: 0, y: 0 }; },
      }),
    [],
  );

  const start = useCallback(() => {
    game.current = createGame();
    choosing.current = false;
    move.current = { x: 0, y: 0 };
    setChoices([]);
    setPhase('playing');
  }, []);

  const choose = (u: Upgrade) => {
    applyUpgrade(game.current, u.id);
    choosing.current = false;
    setChoices([]);
  };

  const g = game.current;
  const p = g.player;
  const camX = Math.min(Math.max(p.x - width / 2, 0), Math.max(0, WORLD - width));
  const camY = Math.min(Math.max(p.y - height / 2, 0), Math.max(0, WORLD - height));
  const vis = (x: number, y: number, m = 50) => x > camX - m && x < camX + width + m && y > camY - m && y < camY + height + m;
  const st = stick.current;

  return (
    <View style={styles.root} {...pan.panHandlers}>
      <View style={[styles.world, { transform: [{ translateX: -camX }, { translateY: -camY }] }]} pointerEvents="none">
        <Grid />
        {g.gems.map((gem) => vis(gem.x, gem.y) && (
          <View key={gem.id} style={[styles.gem, { transform: [{ translateX: gem.x - 5 }, { translateY: gem.y - 5 }] }]} />
        ))}
        {g.enemies.map((e) => vis(e.x, e.y, 60) && (
          <View key={e.id} style={[styles.ent, { width: e.r * 2, height: e.r * 2, opacity: e.flash > 0 ? 0.4 : 1, transform: [{ translateX: e.x - e.r }, { translateY: e.y - e.r }] }]}>
            <Text style={{ fontSize: e.r * 1.7 }}>{ENEMY_EMOJI[e.kind]}</Text>
            {e.kind === 'boss' && (
              <View style={styles.bossBar}><View style={[styles.bossFill, { width: `${Math.max(0, (e.hp / e.maxHp) * 100)}%` }]} /></View>
            )}
          </View>
        ))}
        {g.bullets.map((b) => vis(b.x, b.y) && (
          <View key={b.id} style={[styles.bullet, { transform: [{ translateX: b.x - 4 }, { translateY: b.y - 4 }] }]} />
        ))}
        {bladePositions(g).map((bl, i) => (
          <Text key={i} style={[styles.blade, { transform: [{ translateX: bl.x - 12 }, { translateY: bl.y - 14 }] }]}>🌀</Text>
        ))}
        <View style={[styles.player, { opacity: g.iframe > 0 && Math.floor(g.time * 20) % 2 ? 0.4 : 1, transform: [{ translateX: p.x - p.r }, { translateY: p.y - p.r }] }]}>
          <View style={[styles.gun, { transform: [{ rotate: `${g.angle}rad` }, { translateX: 12 }] }]} />
        </View>
        <View style={styles.border} />
      </View>

      {phase === 'playing' && st && (
        <View pointerEvents="none" style={[styles.stickBase, { left: st.ox - 50, top: st.oy - 50 }]}>
          <View style={[styles.stickKnob, { transform: [{ translateX: st.dx }, { translateY: st.dy }] }]} />
        </View>
      )}

      {/* HUD */}
      <View pointerEvents="box-none" style={[styles.hud, { paddingTop: insets.top + 8 }]}>
        <View style={styles.hudRow}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.exit}><Text style={styles.exitTxt}>✕</Text></Pressable>
          <View style={styles.hudBars}>
            <View style={styles.barHp}><View style={[styles.fillHp, { width: `${(p.hp / p.maxHp) * 100}%` }]} /><Text style={styles.barTxt}>{Math.ceil(p.hp)} / {p.maxHp}</Text></View>
            <View style={styles.barXp}><View style={[styles.fillXp, { width: `${(p.xp / p.xpNext) * 100}%` }]} /></View>
          </View>
          <View style={styles.hudInfo}>
            <Text style={styles.hudTxt}>{fmt(g.time)}</Text>
            <Text style={styles.hudSub}>Lv.{p.level} · {g.kills}킬</Text>
          </View>
        </View>
      </View>

      {phase === 'ready' && (
        <View style={styles.overlay}>
          <Text style={styles.title}>탕탕 특공대</Text>
          <Text style={styles.desc}>화면을 드래그해서 이동하세요.{'\n'}총은 가장 가까운 적을 자동으로 조준합니다.{'\n'}레벨업 때마다 강화를 골라 최대한 오래 버티세요!</Text>
          {best > 0 && <Text style={styles.best}>최고 기록 {fmt(best)}</Text>}
          <Pressable style={styles.btn} onPress={start}><Text style={styles.btnTxt}>게임 시작</Text></Pressable>
          <Pressable onPress={() => router.back()}><Text style={styles.link}>돌아가기</Text></Pressable>
        </View>
      )}

      {phase === 'playing' && choices.length > 0 && (
        <View style={styles.overlay}>
          <Text style={styles.title}>레벨 업! Lv.{p.level}</Text>
          {choices.map((u) => (
            <Pressable key={u.id} style={styles.card} onPress={() => choose(u)}>
              <Text style={styles.cardEmoji}>{u.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{u.name} <Text style={styles.cardLv}>Lv.{g.upgrades[u.id] + 1}</Text></Text>
                <Text style={styles.cardDesc}>{u.desc}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {phase === 'over' && (
        <View style={styles.overlay}>
          <Text style={styles.title}>작전 실패</Text>
          <Text style={styles.desc}>생존 시간 {fmt(g.time)}{'\n'}처치 {g.kills} · 레벨 {p.level}</Text>
          <Text style={styles.best}>최고 기록 {fmt(Math.max(best, g.time))}</Text>
          <Pressable style={styles.btn} onPress={start}><Text style={styles.btnTxt}>다시 도전</Text></Pressable>
          <Pressable onPress={() => router.back()}><Text style={styles.link}>나가기</Text></Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1f2a24', overflow: 'hidden' },
  world: { position: 'absolute', left: 0, top: 0, width: WORLD, height: WORLD, backgroundColor: '#2d3b32' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  border: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderWidth: 4, borderColor: '#ef4444' },
  ent: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
  bossBar: { position: 'absolute', top: -10, width: 70, height: 6, backgroundColor: '#111', borderRadius: 3, overflow: 'hidden' },
  bossFill: { height: 6, backgroundColor: '#ef4444' },
  bullet: { position: 'absolute', left: 0, top: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: '#fde047' },
  gem: { position: 'absolute', left: 0, top: 0, width: 10, height: 10, borderRadius: 3, backgroundColor: '#38bdf8', transform: [{ rotate: '45deg' }] },
  blade: { position: 'absolute', left: 0, top: 0, fontSize: 24 },
  player: { position: 'absolute', left: 0, top: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: '#3b82f6', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  gun: { position: 'absolute', width: 16, height: 5, borderRadius: 2, backgroundColor: '#e5e7eb' },
  stickBase: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  stickKnob: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.5)' },
  hud: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 12 },
  hudRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exit: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  exitTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  hudBars: { flex: 1, gap: 4 },
  barHp: { height: 16, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.5)', overflow: 'hidden', justifyContent: 'center' },
  fillHp: { ...StyleSheet.absoluteFill as object, backgroundColor: '#ef4444' },
  barTxt: { color: '#fff', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  barXp: { height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.5)', overflow: 'hidden' },
  fillXp: { height: 6, backgroundColor: '#38bdf8' },
  hudInfo: { alignItems: 'flex-end' },
  hudTxt: { color: '#fff', fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  hudSub: { color: '#d1d5db', fontSize: 11 },
  overlay: { ...StyleSheet.absoluteFill as object, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  title: { color: '#fff', fontSize: 30, fontWeight: '900' },
  desc: { color: '#e5e7eb', fontSize: 15, lineHeight: 23, textAlign: 'center' },
  best: { color: '#fde047', fontSize: 15, fontWeight: '700' },
  btn: { backgroundColor: '#16a34a', paddingHorizontal: 36, paddingVertical: 14, borderRadius: 14, marginTop: 6 },
  btnTxt: { color: '#fff', fontSize: 18, fontWeight: '800' },
  link: { color: '#9ca3af', fontSize: 14, padding: 8 },
  card: { width: '100%', maxWidth: 380, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#374151', borderRadius: 14, padding: 14, borderWidth: 2, borderColor: '#4b5563' },
  cardEmoji: { fontSize: 30 },
  cardName: { color: '#fff', fontSize: 16, fontWeight: '800' },
  cardLv: { color: '#fde047', fontSize: 12 },
  cardDesc: { color: '#d1d5db', fontSize: 13, marginTop: 2 },
});
