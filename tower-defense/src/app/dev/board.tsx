import { Skia, SkiaPictureView, type SkPicture } from '@shopify/react-native-skia';
import { useEffect, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Bot } from '../../../scripts/bot';
import { STEP } from '@/game/engine/config';
import { Game } from '@/game/engine/game';
import { loadSkiaTypeface, skiaFont } from '@/game/render/fonts';
import { computeLayout, Renderer } from '@/game/render/renderer';

const EMPTY: SkPicture = (() => {
  const rec = Skia.PictureRecorder();
  rec.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
  return rec.finishRecordingAsPicture();
})();

/** 개발용: 봇이 플레이하는 보드. ?t=초 로 시뮬레이션을 앞당기고 한 프레임만 그린다(스크린샷용). */
export default function DevBoard() {
  const { width } = useWindowDimensions();
  const params = new URLSearchParams(location.search);
  const seed = Number(params.get('seed') ?? 7);
  const target = Number(params.get('t') ?? 0);
  const live = params.get('live') === '1';
  const height = Math.round((width / 7) * 6 + 8);
  const [pic, setPic] = useState<SkPicture>(EMPTY);
  const ref = useRef<{ game: Game; renderer: Renderer } | null>(null);

  useEffect(() => {
    let raf = 0;
    let dead = false;
    (async () => {
      await loadSkiaTypeface();
      if (dead) return;
      const game = new Game(seed);
      const bot = new Bot(game, 'smart');
      const renderer = new Renderer(game, skiaFont(30));
      ref.current = { game, renderer };
      const layout = computeLayout(width, height);
      const view = { layout, selected: -1, drag: null, hover: -1, pulse: [], showNumbers: true, shake: false } as const;
      // 목표 시각까지 빠르게 진행 (이벤트는 마지막 몇 초만 렌더러가 처리)
      let step = 0;
      while (game.time < target - 2.5 && game.status === 'playing') {
        game.update(STEP);
        game.events.length = 0;
        if (++step % 12 === 0) bot.act();
      }
      // 마지막 몇 초는 렌더러를 돌리며 이펙트가 쌓이게
      let acc = 0;
      while (game.time < target && game.status === 'playing') {
        game.update(STEP);
        if (++step % 12 === 0) bot.act();
        acc += STEP;
        if (acc >= 1 / 30) {
          renderer.frame(acc, view);
          acc = 0;
        }
      }
      setPic(renderer.frame(0.016, view));
      console.log('DBG', JSON.stringify({ time: Math.round(game.time), wave: game.wave, enemies: game.enemies.length, weight: game.fieldWeight, status: game.status, kills: game.stats.kills, units: game.slots.reduce((n, s2) => n + s2.units.length, 0), gold: Math.round(game.gold) }));
      (window as unknown as { __ready: boolean }).__ready = true;
      if (live) {
        let last = performance.now();
        const loop = (now: number) => {
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          for (let a = dt; a > 0; a -= STEP) game.update(STEP);
          if (++step % 4 === 0) bot.act();
          setPic(renderer.frame(dt, view));
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      }
    })();
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
    };
  }, [width, height, seed, target, live]);

  return (
    <View style={{ flex: 1, backgroundColor: '#10283a' }}>
      <SkiaPictureView style={{ width, height }} picture={pic} />
    </View>
  );
}
