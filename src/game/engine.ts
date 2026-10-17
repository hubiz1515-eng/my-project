// 탕탕 특공대 스타일 서바이버 슈터의 순수 게임 로직 (React 에 의존하지 않음)

export const WORLD = 2400;

export type EnemyKind = 'grunt' | 'fast' | 'tank' | 'boss';

export type Enemy = {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  r: number;
  speed: number;
  dmg: number;
  xp: number;
  flash: number;
  orbitCd: number;
};

export type Bullet = { id: number; x: number; y: number; vx: number; vy: number; dmg: number; life: number; pierce: number; hit: Set<number> };
export type Gem = { id: number; x: number; y: number; v: number };
export type Pickup = { id: number; x: number; y: number; type: 'coin' | 'heal' };
/** 떠오르는 데미지 숫자. kind 0=총알/방망이, 1=도깨비불 */
export type Floater = { x: number; y: number; text: number; life: number; kind: number };
/** 렌더러가 소리·파티클을 붙이기 위한 일회성 이벤트 */
export type GameEvent = { t: string; x: number; y: number; k?: string };
export type Burst = { x: number; y: number; r: number; life: number; maxLife: number };

export type UpgradeId = 'damage' | 'rate' | 'multi' | 'pierce' | 'speed' | 'hp' | 'magnet' | 'regen' | 'blade' | 'range' | 'fire' | 'thunder';

export type Upgrade = { id: UpgradeId; name: string; desc: string; emoji: string; max: number };

export const UPGRADES: Upgrade[] = [
  { id: 'damage', name: '공격력 강화', desc: '총알 피해 +25%', emoji: '💥', max: 8 },
  { id: 'rate', name: '연사 속도', desc: '발사 간격 -15%', emoji: '⚡', max: 8 },
  { id: 'multi', name: '다중 사격', desc: '한 번에 발사하는 총알 +1', emoji: '🔫', max: 5 },
  { id: 'pierce', name: '관통탄', desc: '총알이 적 1명 더 관통', emoji: '🎯', max: 4 },
  { id: 'range', name: '사거리 증가', desc: '조준 사거리 +20%', emoji: '🔭', max: 4 },
  { id: 'speed', name: '이동 속도', desc: '이동 속도 +12%', emoji: '👟', max: 5 },
  { id: 'hp', name: '최대 체력', desc: '최대 체력 +25, 체력 회복', emoji: '❤️', max: 8 },
  { id: 'regen', name: '체력 재생', desc: '초당 체력 +1 회복', emoji: '🩹', max: 5 },
  { id: 'magnet', name: '자석', desc: '경험치 획득 범위 +50%', emoji: '🧲', max: 5 },
  { id: 'blade', name: '도깨비 방망이', desc: '몸 주위를 도는 방망이 +1', emoji: '🏏', max: 6 },
  { id: 'thunder', name: '도깨비 번개', desc: '주기적으로 적에게 번개를 내리침', emoji: '⚡', max: 6 },
  { id: 'fire', name: '도깨비불', desc: '주기적으로 주변에 불꽃을 터뜨림', emoji: '🔥', max: 6 },
];

export type Game = {
  time: number;
  kills: number;
  over: boolean;
  pendingLevel: number;
  nextId: number;
  spawnT: number;
  bossesSpawned: number;
  fireT: number;
  angle: number;
  orbitAngle: number;
  iframe: number;
  view: { w: number; h: number };
  coins: number;
  combo: number;
  comboT: number;
  bestCombo: number;
  burstT: number;
  hordeAt: number;
  hurt: number;
  thunderT: number;
  thunders: { x: number; y: number; life: number }[];
  events: GameEvent[];
  player: { x: number; y: number; hp: number; maxHp: number; level: number; xp: number; xpNext: number; r: number };
  stats: { damage: number; fireInterval: number; bullets: number; pierce: number; range: number; speed: number; magnet: number; regen: number; blades: number };
  upgrades: Record<UpgradeId, number>;
  enemies: Enemy[];
  bullets: Bullet[];
  gems: Gem[];
  pickups: Pickup[];
  floaters: Floater[];
  bursts: Burst[];
};

export function createGame(): Game {
  return {
    time: 0,
    kills: 0,
    over: false,
    pendingLevel: 0,
    nextId: 1,
    spawnT: 0.5,
    bossesSpawned: 0,
    fireT: 0,
    angle: -Math.PI / 2,
    orbitAngle: 0,
    iframe: 0,
    view: { w: 400, h: 400 },
    coins: 0,
    combo: 0,
    comboT: 0,
    bestCombo: 0,
    burstT: 2,
    hordeAt: 75,
    hurt: 0,
    thunderT: 2.5,
    thunders: [],
    events: [],
    player: { x: WORLD / 2, y: WORLD / 2, hp: 100, maxHp: 100, level: 1, xp: 0, xpNext: 5, r: 14 },
    stats: { damage: 10, fireInterval: 0.45, bullets: 1, pierce: 1, range: 320, speed: 150, magnet: 70, regen: 0.4, blades: 0 },
    upgrades: { damage: 0, rate: 0, multi: 0, pierce: 0, speed: 0, hp: 0, magnet: 0, regen: 0, blade: 0, range: 0, fire: 0, thunder: 0 },
    enemies: [],
    bullets: [],
    gems: [],
    pickups: [],
    floaters: [],
    bursts: [],
  };
}

const BULLET_SPEED = 520;

function emit(g: Game, t: string, x: number, y: number, k?: string) {
  if (g.events.length < 80) g.events.push({ t, x, y, k });
}
const MAX_ENEMIES = 260;
const BLADE_RADIUS = 72;
const BLADE_HIT_R = 16;

export function bladePositions(g: Game): { x: number; y: number }[] {
  const n = g.stats.blades;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = g.orbitAngle + (i * Math.PI * 2) / n;
    out.push({ x: g.player.x + Math.cos(a) * BLADE_RADIUS, y: g.player.y + Math.sin(a) * BLADE_RADIUS });
  }
  return out;
}

export function pickUpgrades(g: Game, count = 3): Upgrade[] {
  const pool = UPGRADES.filter((u) => g.upgrades[u.id] < u.max);
  const out: Upgrade[] = [];
  while (out.length < count && pool.length) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

export function applyUpgrade(g: Game, id: UpgradeId) {
  g.upgrades[id]++;
  const s = g.stats;
  switch (id) {
    case 'damage': s.damage *= 1.25; break;
    case 'rate': s.fireInterval *= 0.85; break;
    case 'multi': s.bullets += 1; break;
    case 'pierce': s.pierce += 1; break;
    case 'range': s.range *= 1.2; break;
    case 'speed': s.speed *= 1.12; break;
    case 'hp': g.player.maxHp += 25; g.player.hp = Math.min(g.player.maxHp, g.player.hp + 40); break;
    case 'regen': s.regen += 1; break;
    case 'magnet': s.magnet *= 1.5; break;
    case 'blade': s.blades += 1; break;
    case 'fire': case 'thunder': break;
  }
  g.pendingLevel = Math.max(0, g.pendingLevel - 1);
}

function spawnEnemy(g: Game, kind: EnemyKind, angle?: number) {
  const minutes = g.time / 60;
  const scale = 1 + minutes * 0.35;
  const a = angle ?? Math.random() * Math.PI * 2;
  const d = Math.hypot(g.view.w, g.view.h) / 2 + 30;
  const x = Math.min(WORLD - 20, Math.max(20, g.player.x + Math.cos(a) * d));
  const y = Math.min(WORLD - 20, Math.max(20, g.player.y + Math.sin(a) * d));
  let e: Omit<Enemy, 'id' | 'x' | 'y' | 'flash' | 'orbitCd' | 'maxHp'> & { hp: number };
  switch (kind) {
    case 'fast': e = { kind, hp: 12 * scale, r: 11, speed: 115, dmg: 4, xp: 1 }; break;
    case 'tank': e = { kind, hp: 70 * scale, r: 18, speed: 48, dmg: 9, xp: 4 }; break;
    case 'boss': e = { kind, hp: 500 * (1 + g.bossesSpawned * 0.8) * (1 + minutes * 0.2), r: 36, speed: 58, dmg: 20, xp: 40 }; break;
    default: e = { kind: 'grunt', hp: 22 * scale, r: 13, speed: 70, dmg: 5, xp: 1 };
  }
  g.enemies.push({ ...e, id: g.nextId++, x, y, maxHp: e.hp, flash: 0, orbitCd: 0 });
  if (kind === 'boss') emit(g, 'boss', x, y);
}

function damageEnemy(g: Game, e: Enemy, dmg: number, kind = 0) {
  e.hp -= dmg;
  e.flash = 0.08;
  emit(g, 'hit', e.x, e.y, String(kind));
  if (g.floaters.length < 50) {
    g.floaters.push({ x: e.x + (Math.random() - 0.5) * 14, y: e.y - e.r, text: Math.round(dmg), life: 0.6, kind });
  }
  if (e.hp <= 0 && e.xp > 0) {
    const boss = e.kind === 'boss';
    emit(g, 'kill', e.x, e.y, e.kind);
    g.kills++;
    g.combo++;
    g.comboT = 2.2;
    g.bestCombo = Math.max(g.bestCombo, g.combo);
    g.gems.push({ id: g.nextId++, x: e.x, y: e.y, v: e.xp });
    const coins = boss ? 8 : Math.random() < 0.22 ? 1 : 0;
    for (let i = 0; i < coins; i++) {
      g.pickups.push({ id: g.nextId++, x: e.x + (Math.random() - 0.5) * 30, y: e.y + (Math.random() - 0.5) * 30, type: 'coin' });
    }
    if (boss || Math.random() < 0.012) g.pickups.push({ id: g.nextId++, x: e.x, y: e.y, type: 'heal' });
    e.xp = 0; // 중복 처리 방지 (hp<=0 로 이후 제거)
  }
}

export function step(g: Game, dt: number, mx: number, my: number) {
  if (g.over) return;
  const p = g.player;
  const s = g.stats;
  g.time += dt;

  // 이동
  const ml = Math.hypot(mx, my);
  if (ml > 0.05) {
    const k = Math.min(1, ml) / ml;
    p.x = Math.min(WORLD - p.r, Math.max(p.r, p.x + mx * k * s.speed * dt));
    p.y = Math.min(WORLD - p.r, Math.max(p.r, p.y + my * k * s.speed * dt));
  }
  if (s.regen > 0) p.hp = Math.min(p.maxHp, p.hp + s.regen * dt);
  g.iframe = Math.max(0, g.iframe - dt);
  g.orbitAngle += dt * 3;
  g.hurt = Math.max(0, g.hurt - dt);
  if (g.combo > 0 && (g.comboT -= dt) <= 0) g.combo = 0;
  for (const f of g.floaters) { f.y -= 32 * dt; f.life -= dt; }
  g.floaters = g.floaters.filter((f) => f.life > 0);
  for (const b of g.bursts) b.life -= dt;
  g.bursts = g.bursts.filter((b) => b.life > 0);

  // 도깨비 번개: 화면 안의 무작위 적에게 낙뢰
  for (const th of g.thunders) th.life -= dt;
  g.thunders = g.thunders.filter((th) => th.life > 0);
  const tl = g.upgrades.thunder;
  if (tl > 0 && (g.thunderT -= dt) <= 0) {
    g.thunderT = Math.max(1, 3.4 - 0.4 * tl);
    const near = g.enemies.filter((e) => e.hp > 0 && Math.abs(e.x - p.x) < g.view.w / 2 && Math.abs(e.y - p.y) < g.view.h / 2);
    for (let i = 0; i < 1 + Math.floor(tl / 2) && near.length; i++) {
      const t = near.splice(Math.floor(Math.random() * near.length), 1)[0];
      g.thunders.push({ x: t.x, y: t.y, life: 0.3 });
      emit(g, 'thunder', t.x, t.y);
      for (const e of g.enemies) {
        if (e.hp > 0 && (e.x - t.x) ** 2 + (e.y - t.y) ** 2 < (46 + e.r) ** 2) damageEnemy(g, e, s.damage * 3, 2);
      }
    }
  }

  // 도깨비불: 주기적으로 주변에 폭발
  const fl = g.upgrades.fire;
  if (fl > 0 && (g.burstT -= dt) <= 0) {
    g.burstT = Math.max(1.2, 4.2 - 0.45 * fl);
    const R = 90 + 16 * fl;
    g.bursts.push({ x: p.x, y: p.y, r: R, life: 0.45, maxLife: 0.45 });
    emit(g, 'burst', p.x, p.y);
    for (const e of g.enemies) {
      if (e.hp > 0 && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < (R + e.r) ** 2) damageEnemy(g, e, s.damage * (1.5 + 0.4 * fl), 1);
    }
  }

  // 적 스폰
  g.spawnT -= dt;
  if (g.spawnT <= 0) {
    const t = g.time;
    g.spawnT = Math.max(0.08, 0.7 - t * 0.006);
    const batch = 1 + Math.floor(t / 25);
    for (let i = 0; i < batch && g.enemies.length < MAX_ENEMIES; i++) {
      const r = Math.random();
      let kind: EnemyKind = 'grunt';
      if (t > 15 && r < 0.2) kind = 'fast';
      else if (t > 35 && r < 0.33) kind = 'tank';
      spawnEnemy(g, kind);
    }
  }
  // 귀신 떼: 일정 간격으로 플레이어를 둘러싸는 포위 웨이브
  if (g.time >= g.hordeAt) {
    g.hordeAt += 75;
    emit(g, 'horde', p.x, p.y);
    for (let i = 0; i < 40 && g.enemies.length < MAX_ENEMIES; i++) spawnEnemy(g, 'grunt', (i / 40) * Math.PI * 2);
  }
  if (g.time >= (g.bossesSpawned + 1) * 60) {
    spawnEnemy(g, 'boss');
    g.bossesSpawned++;
  }

  // 자동 조준 + 발사
  let target: Enemy | null = null;
  let best = s.range * s.range;
  for (const e of g.enemies) {
    if (e.hp <= 0) continue;
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d < best) { best = d; target = e; }
  }
  if (target) g.angle = Math.atan2(target.y - p.y, target.x - p.x);
  g.fireT -= dt;
  if (target && g.fireT <= 0) {
    g.fireT = s.fireInterval;
    emit(g, 'shoot', p.x, p.y);
    const n = s.bullets;
    for (let i = 0; i < n; i++) {
      const a = g.angle + (i - (n - 1) / 2) * 0.16;
      g.bullets.push({ id: g.nextId++, x: p.x, y: p.y, vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED, dmg: s.damage, life: s.range / BULLET_SPEED + 0.25, pierce: s.pierce, hit: new Set() });
    }
  }

  // 총알
  for (const b of g.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    for (const e of g.enemies) {
      if (e.hp <= 0 || b.hit.has(e.id)) continue;
      const rr = e.r + 4;
      if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < rr * rr) {
        b.hit.add(e.id);
        const crit = Math.random() < 0.1;
        damageEnemy(g, e, b.dmg * (crit ? 2 : 1), crit ? 3 : 0);
        const kb = e.kind === 'boss' ? 0.5 : 4 / BULLET_SPEED;
        e.x += b.vx * kb;
        e.y += b.vy * kb;
        if (b.pierce-- <= 0) { b.life = 0; break; }
      }
    }
  }
  g.bullets = g.bullets.filter((b) => b.life > 0 && b.x > 0 && b.y > 0 && b.x < WORLD && b.y < WORLD);

  // 회전 칼날
  const blades = s.blades ? bladePositions(g) : [];

  // 적 이동 / 접촉
  for (const e of g.enemies) {
    e.flash = Math.max(0, e.flash - dt);
    e.orbitCd = Math.max(0, e.orbitCd - dt);
    if (e.hp <= 0) continue;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const wob = Math.sin(g.time * 3 + e.id) * 0.35;
    e.x += ((dx - dy * wob) / d) * e.speed * dt;
    e.y += ((dy + dx * wob) / d) * e.speed * dt;
    if (e.orbitCd <= 0) {
      for (const bl of blades) {
        const rr = e.r + BLADE_HIT_R;
        if ((e.x - bl.x) ** 2 + (e.y - bl.y) ** 2 < rr * rr) {
          damageEnemy(g, e, s.damage * 0.8);
          e.orbitCd = 0.4;
          break;
        }
      }
    }
    if (e.hp > 0 && g.iframe <= 0 && d < e.r + p.r) {
      p.hp -= e.dmg;
      g.iframe = 0.6;
      g.hurt = 0.2;
      emit(g, 'hurt', p.x, p.y);
    }
  }
  g.enemies = g.enemies.filter((e) => e.hp > 0);

  // 경험치 젬
  for (const gem of g.gems) {
    const dx = p.x - gem.x;
    const dy = p.y - gem.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < s.magnet) {
      gem.x += (dx / d) * 420 * dt;
      gem.y += (dy / d) * 420 * dt;
    }
    if (d < p.r + 6) {
      emit(g, 'gem', gem.x, gem.y);
      p.xp += gem.v;
      gem.v = 0;
    }
  }
  g.gems = g.gems.filter((gem) => gem.v > 0);
  for (const k of g.pickups) {
    const dx = p.x - k.x;
    const dy = p.y - k.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < s.magnet) {
      k.x += (dx / d) * 420 * dt;
      k.y += (dy / d) * 420 * dt;
    }
    if (d < p.r + 8) {
      emit(g, k.type, k.x, k.y);
      if (k.type === 'coin') g.coins++;
      else p.hp = Math.min(p.maxHp, p.hp + 25);
      k.id = -1;
    }
  }
  g.pickups = g.pickups.filter((k) => k.id >= 0);
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level++;
    emit(g, 'level', p.x, p.y);
    p.xpNext = Math.round(p.xpNext * 1.22 + 2);
    g.pendingLevel++;
  }

  if (p.hp <= 0) { p.hp = 0; g.over = true; }
}
