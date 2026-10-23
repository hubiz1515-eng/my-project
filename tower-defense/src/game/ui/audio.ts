import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { AppState, Platform } from 'react-native';
import { getSave, subscribeSave } from '@/storage/save';
import { setFeedbackHandler, type Haptic, type Sfx } from './feedback';

/* 효과음/배경음은 scripts/generate-sfx.mjs 로 합성한 파일이다 */
const SOURCES: Record<Sfx | 'bgm', number> = {
  summon: require('../../../assets/audio/summon.wav'),
  summonRare: require('../../../assets/audio/summonRare.wav'),
  merge: require('../../../assets/audio/merge.wav'),
  jackpot: require('../../../assets/audio/jackpot.wav'),
  craft: require('../../../assets/audio/craft.wav'),
  sell: require('../../../assets/audio/sell.wav'),
  coin: require('../../../assets/audio/coin.wav'),
  click: require('../../../assets/audio/click.wav'),
  error: require('../../../assets/audio/error.wav'),
  wave: require('../../../assets/audio/wave.wav'),
  boss: require('../../../assets/audio/boss.wav'),
  win: require('../../../assets/audio/win.wav'),
  lose: require('../../../assets/audio/lose.wav'),
  freeze: require('../../../assets/audio/freeze.wav'),
  bomb: require('../../../assets/audio/bomb.wav'),
  tick: require('../../../assets/audio/tick.wav'),
  spin: require('../../../assets/audio/tick.wav'),
  hit: require('../../../assets/audio/hit.wav'),
  bgm: require('../../../assets/audio/bgm.wav'),
};

/** 동시에 겹쳐 울릴 수 있는 개수 (플레이어를 미리 많이 만들지 않고 필요할 때만 늘린다) */
const POOL: Partial<Record<Sfx, number>> = { hit: 3, coin: 3, click: 2, tick: 2, summon: 2 };
/** 너무 자주 울리지 않도록 최소 간격(ms) */
const GAP: Partial<Record<Sfx, number>> = { hit: 90, coin: 110, click: 40, tick: 30, summon: 60 };
const MUSIC_VOLUME = 0.32;

const pools = new Map<Sfx, { players: AudioPlayer[]; next: number }>();
const last = new Map<Sfx, number>();
let music: AudioPlayer | null = null;
let installed = false;
/** 웹은 첫 터치 전에는 소리를 낼 수 없다 */
let unlocked = Platform.OS !== 'web';

function safe(fn: () => void) {
  try {
    fn();
  } catch {
    /* 소리/진동은 없어도 게임은 계속된다 */
  }
}

function playSfx(name: Sfx, volume = 1) {
  const now = Date.now();
  if (now - (last.get(name) ?? 0) < (GAP[name] ?? 0)) return;
  last.set(name, now);
  safe(() => {
    let pool = pools.get(name);
    if (!pool) {
      pool = { players: [], next: 0 };
      pools.set(name, pool);
    }
    const max = POOL[name] ?? 1;
    let p = pool.players.find((x) => !x.playing);
    if (!p && pool.players.length < max) {
      p = createAudioPlayer(SOURCES[name]);
      pool.players.push(p);
    }
    if (!p) p = pool.players[pool.next++ % pool.players.length];
    p.volume = Math.max(0, Math.min(1, volume));
    p.seekTo(0).catch(() => {});
    p.play();
  });
}

function haptic(kind: Haptic) {
  if (Platform.OS === 'web') return;
  safe(() => {
    switch (kind) {
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        break;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        break;
      case 'heavy':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        break;
      case 'success':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        break;
      case 'warning':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        break;
    }
  });
}

function syncMusic() {
  if (!unlocked) return;
  const on = getSave().settings.music && AppState.currentState === 'active';
  safe(() => {
    if (on) {
      if (!music) {
        music = createAudioPlayer(SOURCES.bgm);
        music.loop = true;
        music.volume = MUSIC_VOLUME;
      }
      if (!music.playing) music.play();
    } else if (music && music.playing) {
      music.pause();
    }
  });
}

/** 앱 시작 시 한 번: 오디오 모드, 효과음/햅틱 연결, 배경음 시작 */
export function installFeedback() {
  if (installed) return;
  installed = true;
  safe(() => {
    setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(() => {});
  });
  setFeedbackHandler({ sfx: playSfx, haptic });
  syncMusic();
  subscribeSave(syncMusic);
  AppState.addEventListener('change', syncMusic);
  // 웹은 사용자 입력이 있어야 소리를 낼 수 있다
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const unlock = () => {
      unlocked = true;
      syncMusic();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
  }
}
