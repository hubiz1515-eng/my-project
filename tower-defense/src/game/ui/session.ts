import type { SkFont, SkPicture } from '@shopify/react-native-skia';
import { PITY_MAX, STEP } from '../engine/config';
import type { EnemyKind } from '../engine/enemies';
import { ENEMIES } from '../engine/enemies';
import { Game, type RouletteId } from '../engine/game';
import type { Fail, GameEvent } from '../engine/types';
import { GRADES, UNITS, type Grade, type UnitId } from '../engine/units';
import { planWave, type WaveRole } from '../engine/waves';
import { computeLayout, Renderer, slotAt, type Layout, type RenderView } from '../render/renderer';
import { discover, getSave, recordRun } from '@/storage/save';
import { haptic, sfx } from './feedback';

export type ToastKind = 'info' | 'good' | 'bad' | 'gold';

export type UiEvent =
  | { type: 'toast'; text: string; kind: ToastKind }
  | { type: 'banner'; wave: number; boss: boolean; elite: boolean }
  | { type: 'jackpot' };

export interface BossInfo {
  kind: EnemyKind;
  name: string;
  ratio: number;
}

/** 화면 UI 가 구독하는 요약 상태 (바뀔 때만 새 객체) */
export interface Hud {
  status: 'playing' | 'won' | 'lost';
  ended: boolean;
  paused: boolean;
  speed: number;
  wave: number;
  waveClock: number;
  waveDuration: number;
  waveRole: WaveRole;
  nextKind: EnemyKind;
  nextRole: WaveRole;
  nextBoss: boolean;
  gold: number;
  gems: number;
  tickets: number;
  summonCost: number;
  luck: number;
  luckCost: number | null;
  pity: number;
  fieldWeight: number;
  boss: BossInfo | null;
  canAffordSummon: boolean;
  boardFull: boolean;
  mergeable: number;
  craftable: UnitId[];
  selected: number;
  selectedId: UnitId | null;
  selectedCount: number;
  selectedMergeable: boolean;
  gradeLevels: number[];
  gradeCosts: (number | null)[];
  affordableUpgrade: boolean;
  buffSeconds: number;
  endless: boolean;
  /** 보드에 있는 유닛 수 / 서로 다른 같은 유닛 쌍(2기) 여부 (힌트용) */
  unitCount: number;
  hasPair: boolean;
  goldPerSec: number;
  summons: number;
}

export class GameSession {
  readonly game: Game;
  hud!: Hud;
  speed = 1;
  paused = false;
  selected = -1;
  layout: Layout | null = null;
  /** 조합 재료 강조 */
  pulse: number[] = [];

  renderer: Renderer | null = null;
  private holds = 0;
  private acc = 0;
  private drag: { from: number; x: number; y: number } | null = null;
  private hover = -1;
  private press: { slot: number; x: number; y: number; moved: boolean } | null = null;
  private listeners = new Set<() => void>();
  private uiListeners = new Set<(e: UiEvent) => void>();
  private raf = 0;
  private last = 0;
  private recorded = false;
  private nextToast = 1;
  private frames = 0;
  private discoveredCount = 0;
  private hudKey = '';

  constructor(
    seed?: number,
    private onPicture?: (pic: SkPicture) => void,
  ) {
    this.game = new Game(seed);
    this.hud = this.buildHud();
  }

  // ───────────────────────────── 구독 ─────────────────────────────

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  getHud = () => this.hud;

  onUi(l: (e: UiEvent) => void) {
    this.uiListeners.add(l);
    return () => {
      this.uiListeners.delete(l);
    };
  }

  private ui(e: UiEvent) {
    this.uiListeners.forEach((l) => l(e));
  }

  toast(text: string, kind: ToastKind = 'info') {
    this.ui({ type: 'toast', text, kind });
  }

  // ───────────────────────────── 준비 / 루프 ─────────────────────────────

  attach(font: SkFont | null, onPicture: (pic: SkPicture) => void) {
    this.onPicture = onPicture;
    this.renderer = new Renderer(this.game, font);
  }

  setLayout(w: number, h: number) {
    if (w < 20 || h < 20) return;
    this.layout = computeLayout(w, h);
    this.renderOnce();
  }

  start() {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.tick(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** 모달 등이 열려 있는 동안 시뮬레이션을 멈춘다 */
  hold(on: boolean) {
    this.holds = Math.max(0, this.holds + (on ? 1 : -1));
  }

  get frozen(): boolean {
    return this.paused || this.holds > 0;
  }

  private tick(realDt: number) {
    const g = this.game;
    let simDt = 0;
    if (!this.frozen && g.status === 'playing') {
      this.acc += realDt * this.speed;
      let steps = 0;
      while (this.acc >= STEP && steps < 14) {
        g.update(STEP);
        this.acc -= STEP;
        simDt += STEP;
        steps++;
      }
      if (steps === 14) this.acc = 0;
    } else if (g.status !== 'playing') {
      simDt = realDt;
    }
    this.afterSim(simDt);
  }

  /** 시뮬레이션 직후: 이벤트 → UI/피드백, HUD 갱신, 그리기 */
  private afterSim(simDt: number) {
    const g = this.game;
    this.dispatch(g.events);
    if (this.selected >= 0 && g.slots[this.selected].units.length === 0) this.selected = -1;
    this.frames++;
    this.refreshHud();
    if (g.status !== 'playing' && !this.recorded) this.finish();
    this.drawFrame(simDt);
  }

  private drawFrame(simDt: number) {
    if (!this.renderer || !this.layout || !this.onPicture) return;
    const s = getSave().settings;
    const view: RenderView = {
      layout: this.layout,
      selected: this.selected,
      drag: this.drag,
      hover: this.hover,
      pulse: this.pulse,
      showNumbers: s.numbers,
      shake: s.shake,
    };
    this.onPicture(this.renderer.frame(simDt, view));
  }

  /** 정지 상태에서 한 프레임만 그린다 */
  renderOnce() {
    this.drawFrame(0);
  }

  /** (디버그/스크린샷용) 지정한 초만큼 진행하고 한 프레임을 그린다 */
  advance(seconds: number) {
    const g = this.game;
    const n = Math.round(seconds / STEP);
    for (let i = 0; i < n && g.status === 'playing'; i++) {
      g.update(STEP);
      if (i % 3 === 0 && this.renderer && this.layout) {
        this.dispatch(g.events);
        this.drawFrame(STEP * 3);
      }
    }
    this.afterSim(0);
  }

  // ───────────────────────────── 이벤트 → UI/피드백 ─────────────────────────────

  private dispatch(events: GameEvent[]) {
    let hits = 0;
    let kills = 0;
    for (const ev of events) {
      switch (ev.t) {
        case 'summon': {
          if (ev.grade >= 4) {
            sfx('summonRare');
            haptic('heavy');
          } else {
            sfx('summon', 0.7 + ev.grade * 0.1);
            haptic(ev.grade >= 3 ? 'medium' : 'light');
          }
          break;
        }
        case 'merge':
          sfx(ev.jackpot ? 'jackpot' : 'merge');
          haptic(ev.jackpot ? 'success' : 'medium');
          if (ev.jackpot) this.ui({ type: 'jackpot' });
          break;
        case 'craft':
          sfx('craft');
          haptic('success');
          break;
        case 'sell':
          sfx('sell');
          haptic('light');
          break;
        case 'move':
          sfx('click', 0.5);
          haptic('light');
          break;
        case 'hit':
          hits++;
          break;
        case 'kill':
          kills++;
          if (ev.boss) {
            sfx('boss');
            haptic('heavy');
          }
          break;
        case 'wave':
          sfx(ev.boss ? 'boss' : 'wave');
          haptic(ev.boss ? 'warning' : 'light');
          this.ui({ type: 'banner', wave: ev.wave, boss: ev.boss, elite: ev.elite });
          break;
        case 'freeze':
          sfx('freeze');
          break;
        case 'bomb':
          sfx('bomb');
          haptic('heavy');
          break;
        case 'over':
          sfx(ev.won ? 'win' : 'lose');
          haptic(ev.won ? 'success' : 'warning');
          break;
        case 'warn':
          if (ev.on) {
            this.toast('몬스터가 너무 많아요!', 'bad');
            haptic('warning');
          }
          break;
        default:
          break;
      }
    }
    if (hits > 0) sfx('hit', Math.min(1, 0.35 + hits * 0.08));
    if (kills > 0) sfx('coin', Math.min(1, 0.4 + kills * 0.1));
  }

  // ───────────────────────────── HUD ─────────────────────────────

  private buildHud(): Hud {
    const g = this.game;
    const sel = this.selected;
    const selUnits = sel >= 0 ? g.slots[sel].units : [];
    const next = planWave(Math.min(g.wave + 1, 80));
    let boss: BossInfo | null = null;
    for (const e of g.enemies) {
      if (e.boss) {
        boss = { kind: e.kind, name: ENEMIES[e.kind].name, ratio: Math.max(0, Math.min(1, Math.round((e.hp / e.maxHp) * 100) / 100)) };
        break;
      }
    }
    const gradeLevels = g.gradeLevel.slice();
    const gradeCosts = ([1, 2, 3, 4, 5, 6] as Grade[]).map((gr) => g.gradeUpgradeCost(gr));
    const gradesOnBoard = new Set<number>();
    let unitCount = 0;
    let hasPair = false;
    for (const s of g.slots) {
      unitCount += s.units.length;
      if (s.units.length > 0) gradesOnBoard.add(UNITS[s.units[0].id].grade);
      if (s.units.length === 2) hasPair = true;
    }
    const affordableUpgrade =
      gradeCosts.some((c, i) => c !== null && g.gems >= c && gradesOnBoard.has(i + 1)) || (g.luckCost() !== null && g.gems >= (g.luckCost() as number));
    return {
      status: g.status,
      ended: this.recorded,
      paused: this.paused,
      speed: this.speed,
      wave: g.wave,
      waveClock: Math.max(0, Math.ceil(g.waveClock)),
      waveDuration: g.waveDuration,
      waveRole: g.plan?.role ?? 'standard',
      nextKind: next.special?.boss ? next.special.kind : next.kind,
      nextRole: next.role,
      nextBoss: next.role === 'boss',
      gold: Math.floor(g.gold),
      gems: g.gems,
      tickets: g.tickets,
      summonCost: g.summonCost(),
      luck: g.luck,
      luckCost: g.luckCost(),
      pity: Math.min(PITY_MAX, g.pity),
      fieldWeight: g.fieldWeight,
      boss,
      canAffordSummon: g.gold >= g.summonCost(),
      boardFull: g.emptySlot() < 0,
      mergeable: g.mergeableSlots().length,
      craftable: g.craftableUnits(),
      selected: sel,
      selectedId: selUnits[0]?.id ?? null,
      selectedCount: selUnits.length,
      selectedMergeable: sel >= 0 && g.canMerge(sel),
      gradeLevels,
      gradeCosts,
      affordableUpgrade,
      buffSeconds: Math.max(0, Math.ceil(g.buffUntil - g.time)),
      endless: g.endless,
      unitCount,
      hasPair,
      goldPerSec: g.goldPerSec,
      summons: g.stats.summons,
    };
  }

  private refreshHud() {
    const h = this.buildHud();
    const key = JSON.stringify(h);
    if (key === this.hudKey) return;
    this.hudKey = key;
    this.hud = h;
    // 새로 발견한 유닛은 바로 저장
    if (this.game.discovered.size !== this.discoveredCount) {
      this.discoveredCount = this.game.discovered.size;
      discover(this.game.discovered);
    }
    this.listeners.forEach((l) => l());
  }

  /** UI 에서 상태를 바꾼 직후 즉시 반영 */
  private poke() {
    this.refreshHud();
    this.renderOnceIfFrozen();
  }

  private renderOnceIfFrozen() {
    if (this.frozen || this.game.status !== 'playing') this.drawFrame(0);
  }

  private finish() {
    this.recorded = true;
    const g = this.game;
    recordRun({ wave: g.wave, won: g.status === 'won', kills: g.stats.kills, bestHit: g.stats.bestHit, discovered: g.discovered });
    this.refreshHud();
  }

  /** 게임을 떠날 때 진행 중이던 판의 기록도 남긴다 */
  leave() {
    this.stop();
    if (!this.recorded && this.game.stats.summons > 0) {
      this.recorded = true;
      const g = this.game;
      recordRun({ wave: g.wave, won: false, kills: g.stats.kills, bestHit: g.stats.bestHit, discovered: g.discovered });
    }
  }

  // ───────────────────────────── 명령 ─────────────────────────────

  private failMessage(reason: Fail): string {
    switch (reason) {
      case 'gold':
        return '골드가 부족해요';
      case 'gems':
        return '보석이 부족해요';
      case 'full':
        return '자리가 없어요! 합성하거나 판매하세요';
      case 'need3':
        return '같은 유닛 3기가 필요해요';
      case 'max':
        return '더 이상 올릴 수 없어요';
      case 'missing':
        return '재료가 부족해요';
      default:
        return '지금은 할 수 없어요';
    }
  }

  private fail(reason: Fail) {
    sfx('error');
    haptic('warning');
    this.toast(this.failMessage(reason), 'bad');
    this.poke();
  }

  summon() {
    if (this.frozen) return;
    const r = this.game.summon();
    if (!r.ok) return this.fail(r.reason);
    this.selected = r.slot;
    this.poke();
  }

  mergeSelected() {
    if (this.selected < 0) return;
    const r = this.game.merge(this.selected);
    if (!r.ok) return this.fail(r.reason);
    this.poke();
  }

  mergeAll() {
    const n = this.game.mergeAll();
    if (n === 0) {
      this.toast('합성할 수 있는 유닛이 없어요 (같은 유닛 3기)', 'info');
      sfx('error', 0.5);
      return;
    }
    this.poke();
  }

  sellSelected() {
    if (this.selected < 0) return;
    const r = this.game.sell(this.selected);
    if (!r.ok) return this.fail(r.reason);
    this.toast(`+${r.gold} 골드`, 'gold');
    this.poke();
  }

  craft(id: UnitId) {
    const r = this.game.craft(id);
    if (!r.ok) return this.fail(r.reason);
    this.selected = r.slot;
    this.pulse = [];
    this.toast(`${UNITS[id].name} 조합 성공!`, 'good');
    this.poke();
  }

  upgradeGrade(grade: Grade) {
    const r = this.game.upgradeGrade(grade);
    if (!r.ok) return this.fail(r.reason);
    sfx('craft', 0.6);
    haptic('medium');
    this.toast(`${GRADES[grade].name} 등급 강화 Lv.${r.level} (+${Math.round(r.level * 18)}%)`, 'good');
    this.poke();
  }

  upgradeLuck() {
    const r = this.game.upgradeLuck();
    if (!r.ok) return this.fail(r.reason);
    sfx('craft', 0.6);
    haptic('medium');
    this.toast(`행운 Lv.${r.level} — 높은 등급이 더 잘 나와요`, 'good');
    this.poke();
  }

  startRoulette() {
    return this.game.startRoulette();
  }

  claimRoulette(): RouletteId | null {
    const id = this.game.claimRoulette();
    this.poke();
    return id;
  }

  setSpeed(s: number) {
    this.speed = s;
    this.poke();
  }

  cycleSpeed() {
    this.setSpeed(this.speed >= 3 ? 1 : this.speed + 1);
    sfx('click', 0.5);
  }

  setPaused(p: boolean) {
    this.paused = p;
    this.poke();
  }

  continueEndless() {
    this.game.continueEndless();
    this.recorded = false;
    this.poke();
  }

  select(slot: number) {
    this.selected = slot;
    this.poke();
  }

  /** 조합 시트에서 재료가 있는 슬롯을 깜빡이게 */
  highlightRecipe(id: UnitId | null) {
    if (!id) {
      this.pulse = [];
    } else {
      const slots = this.game.findIngredients(id);
      this.pulse = slots ?? this.game.slots.map((s, i) => (s.units.length > 0 && (UNITS[id].recipe ?? []).includes(s.units[0].id) ? i : -1)).filter((i) => i >= 0);
    }
    this.renderOnceIfFrozen();
  }

  // ───────────────────────────── 입력 ─────────────────────────────

  pointerDown(x: number, y: number) {
    if (!this.layout || this.holds > 0) return;
    const slot = slotAt(this.layout, x, y);
    if (slot >= 0 && this.game.slots[slot].units.length > 0) {
      this.press = { slot, x, y, moved: false };
      this.selected = slot;
      sfx('click', 0.4);
      haptic('light');
    } else {
      this.press = null;
      this.selected = -1;
    }
    this.poke();
  }

  pointerMove(x: number, y: number) {
    const p = this.press;
    if (!p || !this.layout) return;
    if (!p.moved && Math.hypot(x - p.x, y - p.y) > 9) {
      p.moved = true;
      haptic('light');
    }
    if (p.moved) {
      this.drag = { from: p.slot, x, y };
      this.hover = slotAt(this.layout, x, y);
      this.renderOnceIfFrozen();
    }
  }

  pointerUp(x: number, y: number) {
    const p = this.press;
    this.press = null;
    if (p && p.moved && this.layout) {
      const to = slotAt(this.layout, x, y);
      this.drag = null;
      this.hover = -1;
      if (to >= 0 && to !== p.slot) {
        const r = this.game.move(p.slot, to);
        if (r.ok) this.selected = to;
      }
    } else {
      this.drag = null;
      this.hover = -1;
    }
    this.poke();
  }

  pointerCancel() {
    this.press = null;
    this.drag = null;
    this.hover = -1;
    this.poke();
  }
}
