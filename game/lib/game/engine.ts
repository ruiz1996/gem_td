import { isProtected, isWaypoint } from './map';
import { findPath } from './pathfinding';
export { findPath } from './pathfinding';
import {
  BOARD,
  DATA_VERSION,
  MOBILE_RULES,
  RECIPES,
  STEP,
  TOWERS,
  WAVES,
  basicId,
  type Aura,
  type Recipe,
  type Wave,
} from './data';
export type Point = { x: number; y: number };
export type Gem = Point & {
  id: number;
  type: string;
  candidate: boolean;
  order: number;
  cooldown: number;
  burnClock: number;
  damage: number;
  kills: number;
};
export type Enemy = Point & {
  id: number;
  hp: number;
  maxHp: number;
  progress: number;
  routeIndex: number;
  slow: number;
  slowUntil: number;
  poisons: {
    owner: number;
    damage: number;
    nextTick: number;
    remaining: number;
  }[];
  pierce: number;
  pierceUntil: number;
  stunUntil: number;
  armor: number;
  resist: number;
  speed: number;
  flying: boolean;
  invisible: boolean;
  evasion: number;
  physicalImmune: boolean;
  magicImmune: boolean;
  ancient: boolean;
  leak: number;
};
export type Shot = {
  from: Point;
  to: Point;
  color: string;
  life: number;
  kind: 'hit' | 'burn' | 'kill';
};
export type GameState = {
  version: string;
  seed: number;
  rng: number;
  phase: 'prepare' | 'combat' | 'won' | 'lost';
  wave: number;
  life: number;
  gold: number;
  quality: number;
  xp: number;
  normalCount: number;
  combatCount: number;
  winStreak: number;
  waveStartedAt: number;
  placed: number;
  resolved: boolean;
  gems: Gem[];
  enemies: Enemy[];
  time: number;
  spawnClock: number;
  spawned: number;
  nextId: number;
  paused: boolean;
  speed: 1 | 2;
  kills: number;
  leaks: number;
  history: { wave: number; kills: number; leaks: number; life: number }[];
  waveKills: number;
  waveLeaks: number;
  path: Point[];
  shots: Shot[];
};
const pointKey = (x: number, y: number) => `${x},${y}`;
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export function freshGame(seed = Date.now() >>> 0): GameState {
  const gems: Gem[] = BOARD.initialStones.map((p, i) => ({
    ...p,
    id: i + 1,
    type: 'stone',
    candidate: false,
    order: i + 1,
    cooldown: 0,
    burnClock: 0,
    damage: 0,
    kills: 0,
  }));
  return {
    version: DATA_VERSION,
    seed: seed >>> 0,
    rng: seed >>> 0 || 1,
    phase: 'prepare',
    wave: 1,
    life: MOBILE_RULES.initialLife,
    gold: MOBILE_RULES.initialGold,
    quality: 0,
    xp: 0,
    normalCount: MOBILE_RULES.normalCount,
    combatCount: MOBILE_RULES.normalCount,
    winStreak: 0,
    waveStartedAt: 0,
    placed: 0,
    resolved: false,
    gems,
    enemies: [],
    time: 0,
    spawnClock: 0,
    spawned: 0,
    nextId: gems.length + 1,
    paused: false,
    speed: 1,
    kills: 0,
    leaks: 0,
    history: [],
    waveKills: 0,
    waveLeaks: 0,
    path: findPath(gems)!,
    shots: [],
  };
}
export function random(s: GameState) {
  let x = s.rng;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.rng = x >>> 0;
  return s.rng / 4294967296;
}
export function waveInfo(s: GameState): Wave {
  const w = WAVES[s.wave - 1];
  return {
    ...w,
    count: w.boss ? 1 : s.phase === 'combat' ? s.combatCount : s.normalCount,
  };
}
export function getGem(s: GameState, id: number | null | undefined) {
  return s.gems.find((g) => g.id === id);
}
export function canPlace(s: GameState, x: number, y: number): string | null {
  if (s.phase !== 'prepare') return '战斗中不能建造';
  if (s.resolved || s.placed >= 5) return '本轮放置已完成';
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= BOARD.width ||
    y >= BOARD.height
  )
    return '请选择棋盘内的格子';
  if (s.gems.some((g) => g.x === x && g.y === y))
    return '这个格子已有宝石或石头';
  if (isProtected(x, y)) return '出生区和终点区不能建造';
  if (isWaypoint(x, y)) return '不能占用路标';
  if (!findPath([...s.gems, { x, y }])) return '这里会堵死道路，请换个位置';
  return null;
}
export function place(s: GameState, x: number, y: number): Gem {
  const error = canPlace(s, x, y);
  if (error) throw new Error(error);
  const family = ['B', 'D', 'E', 'G', 'P', 'Q', 'R', 'Y'][
    Math.floor(random(s) * 8)
  ];
  let q = 1,
    r = random(s) * 100;
  const weights = MOBILE_RULES.qualityWeights[s.quality];
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) {
      q = i + 1;
      break;
    }
  }
  const gem: Gem = {
    id: s.nextId++,
    x,
    y,
    type: basicId(family, q),
    candidate: true,
    order: s.nextId,
    cooldown: 0,
    burnClock: 0,
    damage: 0,
    kills: 0,
  };
  s.gems.push(gem);
  s.placed++;
  s.path = findPath(s.gems)!;
  return gem;
}
function stone(g: Gem) {
  g.type = 'stone';
  g.candidate = false;
  g.cooldown = 0;
  g.burnClock = 0;
}
export function keep(s: GameState, id: number) {
  if (s.phase !== 'prepare' || s.placed !== 5 || s.resolved)
    throw new Error('先放置完 5 颗宝石');
  const g = getGem(s, id);
  if (!g?.candidate) throw new Error('请选择本轮宝石');
  for (const other of s.gems)
    if (other.candidate && other.id !== id) stone(other);
  g.candidate = false;
  s.resolved = true;
}
export function fuseOptions(s: GameState, id: number) {
  const g = getGem(s, id),
    t = g && TOWERS[g.type];
  if (!g?.candidate || !t?.quality || s.placed !== 5 || s.resolved) return [];
  const n = s.gems.filter((x) => x.candidate && x.type === g.type).length;
  return [2, 4].filter(
    (count) => n >= count && t.quality + (count === 4 ? 2 : 1) <= 6,
  );
}
export function fuse(s: GameState, id: number, count: number) {
  if (s.phase !== 'prepare' || !fuseOptions(s, id).includes(count))
    throw new Error('同品质材料不足或已达品质上限');
  const g = getGem(s, id)!,
    t = TOWERS[g.type];
  const result = basicId(t.family, t.quality + (count === 4 ? 2 : 1));
  keep(s, id);
  g.type = result;
}
export function removeStone(s: GameState, id: number) {
  if (s.phase !== 'prepare') throw new Error('战斗中不能拆石');
  const g = getGem(s, id);
  if (!g || g.type !== 'stone') throw new Error('只能拆除石头');
  s.gems = s.gems.filter((x) => x.id !== id);
  s.path = findPath(s.gems)!;
}
export function materialPool(s: GameState, anchor: Gem) {
  return s.gems
    .filter((g) => g.type !== 'stone' && g.candidate === anchor.candidate)
    .sort((a, b) => a.order - b.order || a.id - b.id);
}
export function recommend(
  s: GameState,
  recipe: Recipe,
  anchorId: number,
): number[] | null {
  const anchor = getGem(s, anchorId);
  if (!anchor || !recipe.materials.includes(anchor.type)) return null;
  if (
    anchor.candidate &&
    (s.phase !== 'prepare' || s.placed !== 5 || s.resolved)
  )
    return null;
  const pool = materialPool(s, anchor),
    used = new Set<number>();
  let anchored = false;
  const ids = recipe.materials.map((type) => {
    const g =
      !anchored && type === anchor.type
        ? anchor
        : pool.find(
            (g) => g.type === type && !used.has(g.id) && g.id !== anchorId,
          );
    if (!g) return 0;
    used.add(g.id);
    if (g.id === anchorId) anchored = true;
    return g.id;
  });
  return ids.every(Boolean) ? ids : null;
}
export function recipesFor(s: GameState, id: number) {
  const gem = getGem(s, id);
  return gem
    ? RECIPES.filter((r) => r.materials.includes(gem.type)).map((recipe) => ({
        recipe,
        ids: recommend(s, recipe, id),
      }))
    : [];
}
export function combine(
  s: GameState,
  recipeId: string,
  anchorId: number,
  ids: number[],
) {
  if (!['prepare', 'combat'].includes(s.phase)) throw new Error('本局已结束');
  const r = RECIPES.find((r) => r.id === recipeId),
    anchor = getGem(s, anchorId);
  if (
    !r ||
    !anchor ||
    ids.length !== r.materials.length ||
    new Set(ids).size !== ids.length ||
    !ids.includes(anchorId)
  )
    throw new Error('合成材料无效');
  if (
    anchor.candidate &&
    (s.phase !== 'prepare' || s.placed !== 5 || s.resolved)
  )
    throw new Error('本轮宝石尚未放置完毕');
  const materials = ids.map((id) => getGem(s, id));
  if (
    materials.some(
      (g, i) =>
        !g || g.type !== r.materials[i] || g.candidate !== anchor.candidate,
    )
  )
    throw new Error('材料已改变，请重新选择');
  const wasCandidate = anchor.candidate;
  // Preserve cooldown so repeatedly upgrading cannot manufacture instant attacks.
  for (const g of materials) if (g!.id !== anchorId) stone(g!);
  if (wasCandidate) {
    for (const g of s.gems) if (g.candidate && g.id !== anchorId) stone(g);
    s.resolved = true;
  }
  anchor.type = r.result;
  anchor.candidate = false;
  anchor.burnClock = 0;
}
export function startWave(s: GameState) {
  if (s.phase !== 'prepare' || !s.resolved) throw new Error('请先完成本轮留石');
  const path = findPath(s.gems);
  if (!path) throw new Error('道路不通');
  s.path = path;
  s.phase = 'combat';
  s.paused = false;
  s.spawnClock = 0;
  s.spawned = 0;
  s.waveKills = 0;
  s.waveLeaks = 0;
  s.combatCount = WAVES[s.wave - 1].boss ? 1 : s.normalCount;
  s.waveStartedAt = s.time;
}
export function physicalMultiplier(armor: number) {
  return 1 - (0.06 * armor) / (1 + 0.06 * Math.abs(armor));
}
function auraAt(s: GameState, p: Point): Aura[] {
  const out = new Map<string, Aura>();
  for (const g of s.gems) {
    if (g.candidate || g.type === 'stone') continue;
    for (const aura of TOWERS[g.type].auras)
      if (
        distance(g, p) <= aura.range &&
        !(aura.nonAncientOnly && 'ancient' in p && p.ancient)
      )
        out.set(aura.id, aura);
  }
  return [...out.values()];
}
function seen(s: GameState, e: Enemy) {
  return !e.invisible || auraAt(s, e).some((a) => a.trueSight);
}
function hit(
  s: GameState,
  g: Gem | undefined,
  e: Enemy,
  amount: number,
  kind: 'physical' | 'magic' | 'pure' = 'physical',
) {
  if (e.hp <= 0 || amount <= 0) return;
  const auras = auraAt(s, e);
  let value = 0;
  if (kind === 'pure') value = amount;
  else if (kind === 'magic') {
    if (!e.magicImmune)
      value =
        amount *
        Math.max(
          0,
          1 - (e.resist - auras.reduce((n, a) => n + (a.resist ?? 0), 0)) / 100,
        );
  } else if (!e.physicalImmune) {
    const armor =
      e.armor -
      (e.pierceUntil > s.time ? e.pierce : 0) -
      auras.reduce((n, a) => n + (a.armor ?? 0), 0);
    value = amount * physicalMultiplier(armor);
  }
  value = Math.min(e.hp, value);
  e.hp -= value;
  if (g) g.damage += value;
  if (e.hp <= 0) {
    s.kills++;
    s.waveKills++;
    const w = WAVES[s.wave - 1];
    s.gold += w.gold;
    s.xp += w.xp;
    while (s.quality < 4 && s.xp >= MOBILE_RULES.qualityXP[s.quality + 1])
      s.quality++;
    if (g) g.kills++;
    s.shots.push({ from: e, to: e, color: '#a7f4d1', life: 0.3, kind: 'kill' });
  }
}
function spawn(s: GameState, w: Wave) {
  if (w.variants.length)
    w = { ...w, ...w.variants[Math.floor(random(s) * w.variants.length)] };
  const p = s.path[0];
  s.enemies.push({
    id: s.nextId++,
    x: p.x,
    y: p.y,
    hp: w.hp,
    maxHp: w.hp,
    progress: 0,
    routeIndex: 1,
    slow: 0,
    slowUntil: 0,
    poisons: [],
    pierce: 0,
    pierceUntil: 0,
    stunUntil: 0,
    armor: w.armor,
    resist: w.resist,
    speed: w.speed,
    flying: w.flying,
    invisible: w.invisible,
    evasion: w.evasion,
    physicalImmune: w.physicalImmune,
    magicImmune: w.magicImmune,
    ancient: w.ancient,
    leak: w.boss ? w.leak : 1 + Math.floor(random(s) * w.leak),
  });
  s.spawned++;
}
export function tick(s: GameState, dt = STEP) {
  if (s.phase !== 'combat' || s.paused) return;
  s.time += dt;
  s.shots = s.shots.filter((x) => (x.life -= dt) > 0);
  const w = waveInfo(s);
  s.spawnClock -= dt;
  while (s.spawned < w.count && s.spawnClock <= 0) {
    spawn(s, w);
    s.spawnClock += w.spawnEvery;
  }
  const active = s.gems.filter((g) => g.type !== 'stone' && !g.candidate);
  for (const g of active) {
    const t = TOWERS[g.type];
    const buffs = auraAt(s, g),
      reach = t.range + Math.max(0, ...buffs.map((a) => a.reach ?? 0));
    if (t.effects.burn) {
      g.burnClock -= dt;
      if (g.burnClock <= 0) {
        g.burnClock += t.effects.burnInterval;
        for (const e of s.enemies)
          if (e.hp > 0 && distance(g, e) <= t.effects.burnRange)
            hit(s, g, e, t.effects.burn * t.effects.burnInterval, 'magic');
      }
    }
    g.cooldown -= dt;
    if (t.damage <= 0) {
      g.cooldown = 0;
      continue;
    }
    if (g.cooldown > 1e-9) continue;
    while (g.cooldown <= 1e-9) {
      const targets = s.enemies
        .filter((e) => e.hp > 0 && distance(g, e) <= reach && seen(s, e))
        .sort((a, b) => b.progress - a.progress || a.id - b.id)
        .slice(0, t.effects.targets);
      if (!targets.length) {
        g.cooldown = 0;
        break;
      }
      g.cooldown +=
        t.interval /
        (1 +
          (t.bonusSpeed + buffs.reduce((n, a) => n + (a.speed ?? 0), 0)) / 100);
      for (const e of targets) {
        if (e.hp <= 0) continue;
        if (
          e.evasion &&
          !buffs.some((a) => a.cannotMiss) &&
          random(s) < e.evasion
        )
          continue;
        const damage =
          t.damage *
          (1 + Math.max(0, ...buffs.map((a) => a.damage ?? 0))) *
          (t.effects.crit && random(s) < t.effects.crit ? 5 : 1);
        hit(s, g, e, damage);
        s.shots.push({
          from: { x: g.x, y: g.y },
          to: { x: e.x, y: e.y },
          color: t.color,
          life: 0.16,
          kind: 'hit',
        });
        if (t.effects.splash)
          for (const other of s.enemies)
            if (other.hp > 0 && distance(other, e) <= t.effects.splashRange)
              hit(s, g, other, damage * t.effects.splash, 'pure');
        if (t.effects.lightning && random(s) < t.effects.lightning)
          for (const other of s.enemies
            .filter((x) => x.hp > 0 && distance(x, e) <= 1000 / 128)
            .slice(0, 5))
            hit(s, g, other, 200, 'magic');
        if (t.effects.fork && random(s) < t.effects.fork)
          for (const other of s.enemies
            .filter((x) => x.hp > 0 && distance(x, e) <= 10)
            .slice(0, 5))
            hit(s, g, other, 2500, 'magic');
        if (t.effects.heal && random(s) < t.effects.heal)
          s.life = Math.min(MOBILE_RULES.initialLife, s.life + 1);
        if (e.hp <= 0) continue;
        if (t.effects.pierce) {
          e.pierce = Math.max(
            e.pierceUntil > s.time ? e.pierce : 0,
            t.effects.pierce,
          );
          e.pierceUntil = s.time + t.effects.pierceDuration;
        }
        if (!e.magicImmune) {
          if (t.effects.slow) {
            e.slow = Math.max(
              e.slowUntil > s.time ? e.slow : 0,
              t.effects.slow,
            );
            e.slowUntil = s.time + t.effects.slowDuration;
          }
          if (t.effects.poison)
            e.poisons.push({
              owner: g.id,
              damage: t.effects.poison,
              nextTick: s.time + 1,
              remaining: 5,
            });
          if (t.effects.stun && random(s) < t.effects.stun)
            e.stunUntil = s.time + 2;
        }
      }
    }
  }
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    for (const poison of e.poisons) {
      if (poison.remaining > 0 && poison.nextTick <= s.time + 1e-9) {
        poison.nextTick += 1;
        poison.remaining--;
        hit(s, getGem(s, poison.owner), e, poison.damage, 'magic');
      }
    }
    e.poisons = e.poisons.filter((p) => p.remaining > 0);
    if (e.hp <= 0) continue;
    const auras = e.magicImmune ? [] : auraAt(s, e);
    const slow =
      (e.slowUntil > s.time ? e.slow : 0) +
      Math.max(0, ...auras.map((a) => a.slow ?? 0));
    const pct = Math.max(0, ...auras.map((a) => a.slowPct ?? 0));
    let movement =
      e.stunUntil > s.time
        ? 0
        : Math.max(
            MOBILE_RULES.minimumSpeed,
            (e.speed - slow / 128) * (1 - pct),
          ) * dt;
    const route = e.flying
      ? BOARD.checkpoints.map((p) => ({ x: p[0], y: p[1] }))
      : s.path;
    while (movement > 0 && e.routeIndex < route.length) {
      const target = route[e.routeIndex],
        dist = distance(e, target);
      if (dist <= movement) {
        e.x = target.x;
        e.y = target.y;
        e.progress += dist;
        movement -= dist;
        e.routeIndex++;
      } else {
        e.x += ((target.x - e.x) / dist) * movement;
        e.y += ((target.y - e.y) / dist) * movement;
        e.progress += movement;
        movement = 0;
      }
    }
    if (e.routeIndex >= route.length) {
      const damage = w.boss ? bossLeakDamage(e.hp, e.maxHp, e.leak) : e.leak;
      e.hp = -1;
      s.life = Math.max(0, s.life - damage);
      s.leaks++;
      s.waveLeaks++;
      s.normalCount = Math.max(MOBILE_RULES.normalCount, s.normalCount - 1);
      s.winStreak = 0;
    }
  }
  s.enemies = s.enemies.filter((e) => e.hp > 0);
  if (s.life <= 0) {
    s.phase = 'lost';
    s.paused = false;
    return;
  }
  if (s.spawned === w.count && !s.enemies.length) {
    s.history.push({
      wave: s.wave,
      kills: s.waveKills,
      leaks: s.waveLeaks,
      life: s.life,
    });
    if (
      s.waveLeaks === 0 &&
      s.time - s.waveStartedAt < MOBILE_RULES.perfectTime
    ) {
      if (++s.winStreak >= 3) {
        s.normalCount++;
        s.winStreak = 0;
      }
    } else s.winStreak = 0;
    s.shots = [];
    if (s.wave === WAVES.length) {
      s.phase = 'won';
      return;
    }
    s.wave++;
    s.phase = 'prepare';
    s.placed = 0;
    s.resolved = false;
  }
}
export function bossLeakDamage(hp: number, maxHp: number, baseDamage = 80) {
  const damagedPercent = Math.floor(((maxHp - hp) / maxHp) * 100);
  return Math.floor((baseDamage * (100 - damagedPercent)) / 100) + 10;
}
export function saveGame(s: GameState) {
  return JSON.stringify({ ...s, shots: [] });
}
export function loadGame(text: string): GameState {
  let s: GameState;
  try {
    s = JSON.parse(text);
  } catch {
    throw new Error('存档无法读取');
  }
  const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
  if (!s || s.version !== DATA_VERSION)
    throw new Error('存档版本不兼容，已保留旧存档，请另开新局');
  if (
    !['prepare', 'combat', 'won', 'lost'].includes(s.phase) ||
    !Number.isInteger(s.wave) ||
    s.wave < 1 ||
    s.wave > 50 ||
    ![
      s.seed,
      s.rng,
      s.life,
      s.gold,
      s.time,
      s.spawnClock,
      s.nextId,
      s.spawned,
      s.kills,
      s.leaks,
      s.waveKills,
      s.waveLeaks,
      s.xp,
      s.normalCount,
      s.combatCount,
      s.winStreak,
      s.waveStartedAt,
    ].every(finite) ||
    s.life < 0 ||
    s.life > 100 ||
    s.gold < 0 ||
    s.xp < 0 ||
    s.normalCount < 5 ||
    s.combatCount < 1 ||
    !Number.isInteger(s.quality) ||
    s.quality < 0 ||
    s.quality > 4 ||
    !Number.isInteger(s.placed) ||
    s.placed < 0 ||
    s.placed > 5 ||
    ![1, 2].includes(s.speed) ||
    typeof s.resolved !== 'boolean' ||
    !Array.isArray(s.gems) ||
    !Array.isArray(s.enemies) ||
    !Array.isArray(s.history) ||
    s.gems.length > BOARD.width * BOARD.height ||
    s.enemies.length > 100
  )
    throw new Error('存档数据不完整');
  const cells = new Set<string>(),
    ids = new Set<number>();
  for (const g of s.gems) {
    if (
      !g ||
      !Number.isInteger(g.id) ||
      ids.has(g.id) ||
      !Number.isInteger(g.x) ||
      !Number.isInteger(g.y) ||
      g.x < 0 ||
      g.x >= BOARD.width ||
      g.y < 0 ||
      g.y >= BOARD.height ||
      isProtected(g.x, g.y) ||
      isWaypoint(g.x, g.y) ||
      cells.has(pointKey(g.x, g.y)) ||
      (!TOWERS[g.type] && g.type !== 'stone') ||
      typeof g.candidate !== 'boolean' ||
      ![g.order, g.cooldown, g.burnClock, g.damage, g.kills].every(finite)
    )
      throw new Error('存档中的宝石数据异常');
    cells.add(pointKey(g.x, g.y));
    ids.add(g.id);
  }
  const route = findPath(s.gems);
  if (!route) throw new Error('存档道路无效');
  s.path = route;
  for (const e of s.enemies) {
    if (
      !e ||
      ids.has(e.id) ||
      ![
        e.id,
        e.x,
        e.y,
        e.hp,
        e.maxHp,
        e.progress,
        e.routeIndex,
        e.slow,
        e.slowUntil,
        e.pierce,
        e.pierceUntil,
        e.stunUntil,
        e.armor,
        e.resist,
        e.speed,
        e.evasion,
        e.leak,
      ].every(finite) ||
      e.hp <= 0 ||
      e.hp > e.maxHp ||
      e.speed <= 0 ||
      !Array.isArray(e.poisons) ||
      e.poisons.some(
        (p) =>
          ![p.owner, p.damage, p.nextTick, p.remaining].every(finite) ||
          p.remaining < 1 ||
          p.remaining > 5,
      ) ||
      !Number.isInteger(e.routeIndex) ||
      e.routeIndex < 1 ||
      e.routeIndex >= (e.flying ? BOARD.checkpoints.length : route.length)
    )
      throw new Error('存档中的敌人数据异常');
    ids.add(e.id);
  }
  if (ids.size && s.nextId <= Math.max(...ids))
    throw new Error('存档实例编号无效');
  s.paused = true;
  s.shots = [];
  return s;
}
export function describe(type: string) {
  const t = TOWERS[type];
  if (!t) return '阻挡道路，准备阶段可拆除';
  const parts: string[] = [];
  if (t.effects.slow) parts.push(`减速 ${t.effects.slow} · 2秒`);
  if (t.effects.poison) parts.push(`毒伤 ${t.effects.poison}/秒 · 5秒可叠加`);
  if (t.effects.pierce) parts.push(`减甲 ${t.effects.pierce} · 2秒`);
  if (t.effects.targets > 1) parts.push(`${t.effects.targets}目标`);
  if (t.effects.splash)
    parts.push(`${Math.round(t.effects.splash * 100)}%纯粹溅射`);
  if (t.effects.burn) parts.push(`灼烧 ${t.effects.burn}/秒`);
  if (t.effects.crit) parts.push('10%五倍暴击');
  if (t.effects.lightning || t.effects.fork) parts.push('闪电');
  if (t.effects.stun) parts.push('概率眩晕');
  if (t.auras.some((a) => a.speed)) parts.push('攻速光环');
  if (t.auras.some((a) => a.trueSight)) parts.push('显隐');
  if (t.auras.some((a) => a.armor)) parts.push('减甲光环');
  if (t.auras.some((a) => a.slow || a.slowPct)) parts.push('减速光环');
  if (t.auras.some((a) => a.damage)) parts.push('增伤光环');
  return parts.join(' · ') || '单体物理攻击';
}
