import { isProtected, isWaypoint } from './map';
import { findPath } from './pathfinding';
export { findPath } from './pathfinding';
import {
  BOARD,
  DATA_VERSION,
  PREVIOUS_DATA_VERSION,
  CUSTOM_MVP_DATA_VERSION,
  FIRST_BOSS_BALANCE,
  LEGACY_DATA_VERSION,
  MOBILE_RULES,
  MVP_RULES,
  RECIPES,
  STEP,
  TOWERS,
  WAVES,
  basicId,
  applyTowerAbility,
  mechanics,
  sourceEnemyProfile,
  SLAB_RECIPES,
  type TowerDef,
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
  waveDamage: number;
  waveScore: number;
  mvpLevel: number;
  kills: number;
  attack?: number;
  copiedAbilities?: string[];
  disarmedUntil?: number;
  greedMarked?: boolean;
  prd?: Record<string, number>;
  targetId?: number;
  howlDamage?: number;
  howlUntil?: number;
};
export type MvpAward = Point & {
  id: number;
  type: string;
  level: number;
  damage: number;
};
export type WaveDamageRow = Point & {
  id: number;
  type: string;
  mvpLevel: number;
  retired: boolean;
  physical: number;
  magic: number;
  pure: number;
  unclassified: number;
  total: number;
  score: number;
  kills: number;
};
export type WaveDamageReport = {
  wave: number;
  complete: boolean;
  outcome: 'combat' | 'cleared' | 'lost';
  elapsed: number;
  rows: WaveDamageRow[];
  mvp: MvpAward | null;
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
    sourceType?: string;
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
  abilities?: string[];
  debuffs?: Debuff[];
  burns?: Burn[];
  elite?: boolean;
  xp?: number;
  gold?: number;
  refraction?: number;
  refractionUntil?: number;
  refractionReady?: number;
  blinkReady?: number;
  sprintUntil?: number;
  reactive?: number[];
  cleanseDamage?: number;
  lastDamageAt?: number;
  prd?: Record<string, number>;
};
export type Debuff = {
  id: string;
  until: number;
  slow?: number;
  slowPct?: number;
  armor?: number;
  noHeal?: boolean;
  root?: boolean;
  incoming?: number;
  magicTaken?: number;
  physicalTaken?: number;
  started?: number;
  duration?: number;
};
type Burn = {
  id: string;
  owner: number;
  sourceType: string;
  amount: number;
  interval: number;
  nextTick: number;
  until: number;
};
export type CombatEvent = {
  kind:
    | 'attack'
    | 'arrow'
    | 'chain'
    | 'frost'
    | 'cask'
    | 'torrent'
    | 'root'
    | 'fear'
    | 'magic';
  at: number;
  owner: number;
  sourceType: string;
  target: number;
  from: Point;
  amount: number;
  remaining: number;
  visited: number[];
  duration?: number;
  tier?: number;
  projectileSpeed?: number;
  copiedAbilities?: string[];
};
export type Slab = Point & {
  id: number;
  type: string;
  tier: number;
  readyAt: number;
};
export type Field = Point & {
  id: number;
  owner: number;
  sourceType: string;
  kind: 'acid' | 'howl' | 'gale';
  tier: number;
  until: number;
  dx?: number;
  dy?: number;
  travelled?: number;
  hit?: number[];
};
type Gaze = Point & {
  owner: number;
  start: number;
  until: number;
  facing: Record<number, number>;
  petrified: number[];
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
  history: {
    wave: number;
    kills: number;
    leaks: number;
    life: number;
    mvp: MvpAward | null;
    damageReport: WaveDamageReport | null;
  }[];
  damageReport: WaveDamageReport | null;
  mvpStartWave: number;
  waveKills: number;
  waveLeaks: number;
  path: Point[];
  shots: Shot[];
  events: CombatEvent[];
  slabs: Slab[];
  fields: Field[];
  gazes: Gaze[];
  bossType?: string;
  bossVariants?: Record<number, string>;
  frenzy: boolean;
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
    waveDamage: 0,
    waveScore: 0,
    mvpLevel: 0,
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
    damageReport: null,
    mvpStartWave: 1,
    waveKills: 0,
    waveLeaks: 0,
    path: findPath(gems)!,
    shots: [],
    events: [],
    slabs: [],
    fields: [],
    gazes: [],
    frenzy: false,
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
  const w = WAVES[(s.wave - 1) % 50];
  const variant = s.bossType ? sourceEnemyProfile(s.bossType) : null;
  const bossNames: Record<string, string> = {
    gemtd_yuediyang_boss: '月帝羊',
    gemtd_zard_boss_fly: 'Zard',
    gemtd_gugubiao_boss_fly: '咕咕标',
    gemtd_roushan_boss_fly_jin: '黄金肉山宝宝',
    gemtd_roushan_boss_fly_bojin: '铂金肉山宝宝',
  };
  return {
    ...w,
    ...variant,
    index: s.wave,
    name: s.bossType
      ? bossNames[s.bossType]
      : s.wave > 50
        ? `无尽 · ${w.name}`
        : w.name,
    abilities: [
      ...new Set([
        ...(variant?.abilities ?? w.abilities),
        ...((mechanics.waveAbilities as Record<string, string[]>)[
          ((s.wave - 1) % 50) + 1
        ] ?? []),
      ]),
    ],
    count: w.boss ? 1 : s.phase === 'combat' ? s.combatCount : s.normalCount,
  };
}
export function getGem(s: GameState, id: number | null | undefined) {
  return s.gems.find((g) => g.id === id);
}
const definitionCache = new WeakMap<Gem, { key: string; value: TowerDef }>();
export function towerDefinition(g: Gem): TowerDef {
  const base = TOWERS[g.type];
  if (!g.copiedAbilities?.length && g.attack === undefined) return base;
  const key = `${g.type}:${g.attack}:${g.copiedAbilities?.join(',')}`;
  const cached = definitionCache.get(g);
  if (cached?.key === key) return cached.value;
  const t = structuredClone(base);
  if (g.attack !== undefined) t.damage = g.attack;
  for (const ability of g.copiedAbilities ?? []) {
    t.abilities.push(ability);
    if (/^tower_attack[1-7]$/.test(ability))
      t.damage += 10 * 2 ** Number(ability.at(-1));
    else applyTowerAbility(t, ability);
  }
  definitionCache.set(g, { key, value: t });
  return t;
}
function initializeTower(s: GameState, g: Gem, candidateMerge: boolean) {
  delete g.attack;
  delete g.copiedAbilities;
  delete g.targetId;
  g.prd = {};
  g.disarmedUntil = 0;
  delete g.greedMarked;
  delete g.howlDamage;
  delete g.howlUntil;
  if (g.type === 'gemtd_huguoshenyishi') {
    const min = candidateMerge ? 1 : 30;
    g.attack = min + Math.floor(random(s) * (1025 - min));
  }
  if (g.type === 'gemtd_tianranzumulv') {
    const pool = s.gems
      .filter(
        (other) =>
          activeTower(other) &&
          other.type !== g.type &&
          distance(g, other) <= 220 / 128,
      )
      .flatMap((other) =>
        towerDefinition(other).abilities.filter((a) =>
          mechanics.stealable.includes(a),
        ),
      );
    const copied = new Set<string>();
    for (let tries = 0; tries < 100 && copied.size < 3 && pool.length; tries++)
      copied.add(pool[Math.floor(random(s) * pool.length)]);
    g.copiedAbilities = [...copied];
  }
}
// Pseudo-random distribution: solve C so E[waiting time] = 1 / probability.
const prdConstants = new Map<number, number>();
export function prdConstant(probability: number) {
  if (probability >= 1) return 1;
  const cached = prdConstants.get(probability);
  if (cached !== undefined) return cached;
  let lo = 0,
    hi = probability;
  for (let j = 0; j < 48; j++) {
    const c = (lo + hi) / 2;
    let survival = 1,
      mean = 0;
    for (let n = 1; survival > 1e-12; n++) {
      mean += survival;
      survival *= 1 - Math.min(1, n * c);
    }
    if (1 / mean > probability) hi = c;
    else lo = c;
  }
  const c = (lo + hi) / 2;
  prdConstants.set(probability, c);
  return c;
}
function proc(
  s: GameState,
  owner: { prd?: Record<string, number> },
  key: string,
  probability: number,
) {
  if (!probability) return false;
  const counts = (owner.prd ??= {});
  const attempts = (counts[key] ?? 0) + 1;
  const success = random(s) < Math.min(1, prdConstant(probability) * attempts);
  counts[key] = success ? 0 : attempts;
  return success;
}
export function applyDebuff(e: Enemy, value: Debuff) {
  const list = (e.debuffs ??= []);
  const old = list.findIndex((d) => d.id === value.id);
  if (old < 0) list.push(value);
  else list[old] = value;
}
function debuffs(s: GameState, e: Enemy) {
  return (e.debuffs ?? []).filter((d) => d.until > s.time);
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
  const occupied = s.gems.find((g) => g.x === x && g.y === y);
  if (occupied && occupied.type !== 'stone') return '这个格子已有宝石';
  if (s.slabs.some((p) => p.x === x && p.y === y)) return '这个格子已有石板';
  if (isProtected(x, y)) return '出生区和终点区不能建造';
  if (isWaypoint(x, y)) return '不能占用路标';
  if (!findPath([...s.gems, { x, y }])) return '这里会堵死道路，请换个位置';
  return null;
}
export function place(s: GameState, x: number, y: number): Gem {
  const error = canPlace(s, x, y);
  if (error) throw new Error(error);
  const rockIndex = s.gems.findIndex(
    (g) => g.x === x && g.y === y && g.type === 'stone',
  );
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
    waveDamage: 0,
    waveScore: 0,
    mvpLevel: 0,
    kills: 0,
  };
  // Replace only after validation and generation, without opening the route in between.
  if (rockIndex !== -1) s.gems.splice(rockIndex, 1);
  s.gems.push(gem);
  s.placed++;
  s.path = findPath(s.gems)!;
  return gem;
}
function stone(g: Gem) {
  delete g.howlDamage;
  delete g.howlUntil;
  delete g.attack;
  delete g.copiedAbilities;
  delete g.disarmedUntil;
  delete g.prd;
  delete g.targetId;
  delete g.greedMarked;
  g.type = 'stone';
  g.candidate = false;
  g.cooldown = 0;
  g.burnClock = 0;
  g.mvpLevel = 0;
  g.waveDamage = 0;
  g.waveScore = 0;
  g.damage = 0;
  g.kills = 0;
}
const activeTower = (g: Gem) => !g.candidate && g.type !== 'stone';
export function mvpBonus(s: GameState, g: Gem) {
  const own = activeTower(g) ? g.mvpLevel * MVP_RULES.damagePerLevel : 0;
  const auraCount = activeTower(g)
    ? s.gems.filter(
        (source) =>
          activeTower(source) &&
          source.mvpLevel === MVP_RULES.maxLevel &&
          source.id !== g.id &&
          distance(source, g) <= MVP_RULES.attackAuraRange,
      ).length
    : 0;
  const aura = auraCount * MVP_RULES.auraDamage;
  return { own, aura, auraCount, total: own + aura };
}
// Distinct low-level modifiers coexist; equal levels do not have MULTIPLE.
// Level 10 explicitly permits one debuff instance per source tower.
export function mvpMagicMultiplier(s: GameState, e: Enemy) {
  if (e.magicImmune) return 1;
  const levels = new Set<number>();
  let multiplier = 1;
  for (const g of s.gems) {
    if (
      !activeTower(g) ||
      !g.mvpLevel ||
      distance(g, e) > MVP_RULES.resistAuraRange
    )
      continue;
    if (g.mvpLevel < MVP_RULES.maxLevel && levels.has(g.mvpLevel)) continue;
    levels.add(g.mvpLevel);
    multiplier *= 1 + (g.mvpLevel * MVP_RULES.resistPerLevel) / 100;
  }
  return multiplier;
}
function reportRow(
  report: WaveDamageReport,
  g: Pick<Gem, 'id' | 'type' | 'x' | 'y' | 'mvpLevel'>,
): WaveDamageRow {
  let row = report.rows.find(
    (r) => r.id === g.id && r.type === g.type && !r.retired,
  );
  if (!row) {
    row = {
      id: g.id,
      type: g.type,
      x: g.x,
      y: g.y,
      mvpLevel: g.mvpLevel,
      retired: false,
      physical: 0,
      magic: 0,
      pure: 0,
      unclassified: 0,
      total: 0,
      score: 0,
      kills: 0,
    };
    report.rows.push(row);
  }
  return row;
}
function createDamageReport(s: GameState, complete = true): WaveDamageReport {
  const report: WaveDamageReport = {
    wave: s.wave,
    complete,
    outcome: s.phase === 'lost' ? 'lost' : 'combat',
    elapsed: Math.max(0, s.time - s.waveStartedAt),
    rows: [],
    mvp: null,
  };
  for (const g of s.gems.filter(activeTower)) {
    const row = reportRow(report, g);
    if (!complete) row.total = row.unclassified = g.waveDamage;
  }
  return report;
}
export function inheritedMvp(s: GameState, ids: number[]) {
  return Math.min(
    MVP_RULES.maxLevel,
    [...new Set(ids)].reduce(
      (sum, id) => sum + (getGem(s, id)?.mvpLevel ?? 0),
      0,
    ),
  );
}
function inheritMaterials(s: GameState, anchor: Gem, materials: Gem[]) {
  const consumed = new Set(
    materials.filter((g) => g.id !== anchor.id).map((g) => g.id),
  );
  anchor.mvpLevel = inheritedMvp(
    s,
    materials.map((g) => g.id),
  );
  // The original creates a new entity: material scores do not enter its MVP race.
  if (s.phase === 'combat' && s.damageReport)
    for (const g of materials) reportRow(s.damageReport, g).retired = true;
  anchor.waveDamage = 0;
  anchor.waveScore = 0;
  anchor.damage = materials.reduce((sum, g) => sum + g.damage, 0);
  anchor.kills = materials.reduce((sum, g) => sum + g.kills, 0);
  // Preserve the caster generation: old poison must not enter the new tower's MVP score.
  for (const e of s.enemies)
    for (const poison of e.poisons)
      if (
        (consumed.has(poison.owner) || poison.owner === anchor.id) &&
        !poison.sourceType
      )
        poison.sourceType = getGem(s, poison.owner)?.type;
}
function awardMvp(s: GameState): MvpAward | null {
  if (s.wave < s.mvpStartWave || s.wave > 50) return null;
  const winner = s.gems
    .filter(
      (g) =>
        activeTower(g) && g.mvpLevel < MVP_RULES.maxLevel && g.waveScore > 0,
    )
    .sort(
      (a, b) => b.waveScore - a.waveScore || a.order - b.order || a.id - b.id,
    )[0];
  if (!winner) return null;
  winner.mvpLevel++;
  return {
    id: winner.id,
    type: winner.type,
    x: winner.x,
    y: winner.y,
    level: winner.mvpLevel,
    damage: winner.waveScore,
  };
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
export function keepAndStartWave(s: GameState, id: number) {
  // Validate the route before consuming candidates. Keeping never changes occupancy.
  if (!findPath(s.gems)) throw new Error('道路不通');
  keep(s, id);
  startWave(s);
}
export function crushOptions(s: GameState, id: number) {
  const g = getGem(s, id),
    t = g && TOWERS[g.type];
  if (
    s.phase !== 'prepare' ||
    s.placed !== 5 ||
    s.resolved ||
    !g?.candidate ||
    !t?.quality
  )
    return [];
  return (MOBILE_RULES.crushWeights[t.quality] ?? []).map((chance, i) => ({
    quality: t.quality - i - 1,
    chance,
  }));
}
export function crushAndStartWave(s: GameState, id: number) {
  const options = crushOptions(s, id);
  if (!options.length)
    throw new Error('建满5颗后，可敲碎本轮2级及以上的基础宝石');
  // Reject before drawing randomness or consuming any candidates.
  if (!findPath(s.gems)) throw new Error('道路不通');
  const g = getGem(s, id)!,
    t = TOWERS[g.type];
  let roll = random(s) * 100,
    quality = options[options.length - 1].quality;
  for (const option of options) {
    roll -= option.chance;
    if (roll < 0) {
      quality = option.quality;
      break;
    }
  }
  keep(s, id);
  g.type = basicId(t.family, quality);
  startWave(s);
  return g;
}
export function fuseOptions(s: GameState, id: number) {
  const g = getGem(s, id),
    t = g && TOWERS[g.type];
  if (!g?.candidate || !t?.quality || s.placed !== 5 || s.resolved) return [];
  const n = s.gems.filter((x) => x.candidate && x.type === g.type).length;
  return [2, 4].filter(
    (count) =>
      n >= count &&
      (t.quality + (count === 4 ? 2 : 1) <= 6 ||
        (count === 4 && t.quality === 5)),
  );
}
export function fuse(s: GameState, id: number, count: number) {
  if (s.phase !== 'prepare' || !fuseOptions(s, id).includes(count))
    throw new Error('同品质材料不足或已达品质上限');
  const g = getGem(s, id)!,
    t = TOWERS[g.type];
  const result =
    count === 4 && t.quality === 5
      ? 'gemtd_zhenjiazhishi'
      : basicId(t.family, t.quality + (count === 4 ? 2 : 1));
  const materials = [
    g,
    ...s.gems
      .filter(
        (other) => other.id !== id && other.candidate && other.type === g.type,
      )
      .sort((a, b) => a.order - b.order || a.id - b.id)
      .slice(0, count - 1),
  ];
  inheritMaterials(s, g, materials);
  keep(s, id);
  g.type = result;
  initializeTower(s, g, true);
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
  if (recipe.candidateOnly && !anchor.candidate) return null;
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
  if (r.candidateOnly && !anchor.candidate)
    throw new Error('隐藏配方只能使用本轮五颗候选宝石');
  if (
    materials.some(
      (g, i) =>
        !g || g.type !== r.materials[i] || g.candidate !== anchor.candidate,
    )
  )
    throw new Error('材料已改变，请重新选择');
  const wasCandidate = anchor.candidate;
  inheritMaterials(s, anchor, materials as Gem[]);
  // Preserve cooldown so repeatedly upgrading cannot manufacture instant attacks.
  for (const g of materials) if (g!.id !== anchorId) stone(g!);
  if (wasCandidate) {
    for (const g of s.gems) if (g.candidate && g.id !== anchorId) stone(g);
    s.resolved = true;
  }
  anchor.type = r.result;
  anchor.candidate = false;
  anchor.burnClock = 0;
  initializeTower(s, anchor, wasCandidate);
  if (s.phase === 'combat' && s.damageReport) reportRow(s.damageReport, anchor);
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
  s.combatCount = waveInfo(s).boss ? 1 : s.normalCount;
  s.bossType = undefined;
  if (s.wave === 20 && random(s) >= 0.9) s.bossType = 'gemtd_yuediyang_boss';
  if (s.wave === 30 && random(s) >= 0.9) s.bossType = 'gemtd_zard_boss_fly';
  if (s.wave === 40 && random(s) >= 0.9) s.bossType = 'gemtd_gugubiao_boss_fly';
  if (s.wave === 50) {
    if (random(s) >= 0.8) s.bossType = 'gemtd_roushan_boss_fly_jin';
    if (random(s) >= 0.9) s.bossType = 'gemtd_roushan_boss_fly_bojin';
  }
  if (s.wave <= 50 && s.bossType) (s.bossVariants ??= {})[s.wave] = s.bossType;
  if (s.wave > 50) s.bossType = s.bossVariants?.[s.wave - 50];
  s.frenzy = false;
  s.events = [];
  s.fields = [];
  s.gazes = [];
  s.waveStartedAt = s.time;
  for (const g of s.gems) g.waveDamage = g.waveScore = 0;
  s.damageReport = createDamageReport(s);
}
export function physicalMultiplier(armor: number) {
  return 1 - (0.06 * armor) / (1 + 0.06 * Math.abs(armor));
}
function auraAt(s: GameState, p: Point): Aura[] {
  const out = new Map<string, Aura>();
  for (const g of s.gems) {
    if (g.candidate || g.type === 'stone') continue;
    for (const aura of towerDefinition(g).auras)
      if (
        distance(g, p) <= aura.range &&
        !(aura.nonAncientOnly && 'ancient' in p && p.ancient) &&
        !(
          'magicImmune' in p &&
          (p.magicImmune || s.frenzy) &&
          (aura.armor || aura.slow || aura.slowPct || aura.resist) &&
          !aura.affectsMagicImmune
        )
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
  source?: { id: number; type: string },
) {
  if (e.hp <= 0 || amount <= 0) return 0;
  const auras = auraAt(s, e);
  const statuses = debuffs(s, e);
  let value = 0;
  if (kind === 'pure') value = amount;
  else if (kind === 'magic') {
    if (!e.magicImmune && !s.frenzy)
      value =
        amount *
        mvpMagicMultiplier(s, e) *
        Math.max(
          0,
          1 - (e.resist - auras.reduce((n, a) => n + (a.resist ?? 0), 0)) / 100,
        ) *
        (1 + Math.max(0, ...statuses.map((d) => d.magicTaken ?? 0)));
  } else if (!e.physicalImmune) {
    const armor =
      e.armor -
      (e.pierceUntil > s.time ? e.pierce : 0) -
      Math.max(
        0,
        ...statuses
          .filter((d) => d.id.startsWith('pierce:'))
          .map((d) => d.armor ?? 0),
      ) -
      Math.max(
        0,
        ...statuses.filter((d) => d.id === 'acid').map((d) => d.armor ?? 0),
      ) +
      (e.reactive ?? []).filter((until) => until > s.time).length * 5 -
      auras.reduce((n, a) => n + (a.armor ?? 0), 0);
    value =
      amount *
      physicalMultiplier(armor) *
      (1 + Math.max(0, ...statuses.map((d) => d.physicalTaken ?? 0)));
  }
  value *= 1 + Math.max(0, ...statuses.map((d) => d.incoming ?? 0));
  value = Math.min(e.hp, value);
  e.hp -= value;
  // The archived refraction script heals back OnTakeDamage, so damage still enters the report.
  if (
    (e.refraction ?? 0) > 0 &&
    (e.refractionUntil ?? 0) > s.time &&
    value > 0 &&
    e.hp > 0
  ) {
    e.hp = Math.min(e.maxHp, e.hp + value);
    e.refraction!--;
  }
  if (value > 0 && e.abilities?.includes('tidehunter_kraken_shell')) {
    if (s.time - (e.lastDamageAt ?? -Infinity) > 10) e.cleanseDamage = 0;
    e.lastDamageAt = s.time;
    e.cleanseDamage = (e.cleanseDamage ?? 0) + value;
    if (e.cleanseDamage >= 40000) {
      e.debuffs = [];
      e.poisons = [];
      e.slowUntil = e.pierceUntil = e.stunUntil = 0;
      e.cleanseDamage = 0;
    }
  }
  if (g) {
    g.damage += value;
    // Legacy saves can contain poison whose old owner has already become a rock.
    if (activeTower(g)) {
      g.waveDamage += value;
      g.waveScore += Math.floor(value);
    }
  }
  const row =
    s.damageReport &&
    (g && activeTower(g)
      ? reportRow(s.damageReport, g)
      : source &&
        s.damageReport.rows.find(
          (r) => r.id === source.id && r.type === source.type,
        ));
  if (!row && s.damageReport && source && TOWERS[source.type]?.family === 'L') {
    const slab = s.slabs.find((p) => p.id === source.id);
    if (slab) {
      const slabRow = reportRow(s.damageReport, {
        ...slab,
        type: source.type,
        mvpLevel: 0,
      });
      slabRow[kind] += value;
      slabRow.total += value;
      slabRow.score += Math.floor(value);
      if (e.hp <= 0) slabRow.kills++;
    }
  }
  if (row) {
    row[kind] += value;
    row.total += value;
    row.score += Math.floor(value);
    if (e.hp <= 0) row.kills++;
  }
  if (e.hp <= 0) {
    s.kills++;
    s.waveKills++;
    const w = waveInfo(s);
    const greed = g?.greedMarked && random(s) < 0.05;
    s.gold += (e.gold ?? w.gold) * (greed ? 10 : 1);
    s.xp += e.xp ?? w.xp;
    while (s.quality < 4 && s.xp >= MOBILE_RULES.qualityXP[s.quality + 1])
      s.quality++;
    if (g) g.kills++;
    s.shots.push({ from: e, to: e, color: '#a7f4d1', life: 0.3, kind: 'kill' });
  }
  return value;
}
function spawn(s: GameState, w: Wave) {
  const shared =
    (mechanics.waveAbilities as Record<string, string[]>)[
      ((s.wave - 1) % 50) + 1
    ] ?? [];
  if (w.variants.length)
    w = { ...w, ...w.variants[Math.floor(random(s) * w.variants.length)] };
  if (s.bossType) w = { ...w, ...sourceEnemyProfile(s.bossType) };
  const abilities = [...new Set([...w.abilities, ...shared])];
  const elite = !w.boss && random(s) < 1 / 400;
  const baseHp = s.wave === 60 ? sourceEnemyProfile(w.id).hp : w.hp;
  let hp = baseHp * (elite ? ((51 - Math.min(s.wave, 50)) / 50) * 6 + 2 : 1);
  if (s.wave > 50) {
    if (w.flying) hp *= 0.4;
    for (let i = 0; i < 2; i++) {
      const ability =
        mechanics.endlessAbilities[
          Math.floor(random(s) * mechanics.endlessAbilities.length)
        ];
      if (ability === 'enemy_momian') hp /= 3;
      if (ability === 'enemy_wumian') hp /= 2;
      if (!abilities.includes(ability)) abilities.push(ability);
    }
    hp = hp > 12000 ? 999999999 : hp * 80000;
  }
  const p = s.path[0];
  s.enemies.push({
    id: s.nextId++,
    x: p.x,
    y: p.y,
    hp,
    maxHp: hp,
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
    speed: w.speed * (s.wave > 50 ? 2 : 1),
    flying: w.flying,
    invisible: w.invisible,
    evasion: abilities.includes('guai_shanbi') ? 0.5 : w.evasion,
    physicalImmune: abilities.includes('enemy_wumian') || w.physicalImmune,
    magicImmune: abilities.includes('enemy_momian') || w.magicImmune,
    ancient: w.ancient,
    leak: w.boss ? w.leak : 1 + Math.floor(random(s) * w.leak),
    abilities,
    elite,
    xp: (s.wave > 50 ? 5 : w.xp) * (elite ? 10 : 1),
    gold: (() => {
      const xp = (s.wave > 50 ? 5 : w.xp) * (elite ? 10 : 1);
      return xp >= 100 ? xp / 2 : xp;
    })(),
    debuffs: [],
    burns: [],
    reactive: [],
  });
  s.spawned++;
}
function queueProjectile(
  s: GameState,
  g: Gem,
  e: Enemy,
  kind: 'attack' | 'arrow',
  amount: number,
  speed: number,
) {
  s.events.push({
    kind,
    at: s.time,
    owner: g.id,
    sourceType: g.type,
    target: e.id,
    from: { x: g.x, y: g.y },
    amount,
    remaining: 0,
    visited: [],
    projectileSpeed: speed / 128,
    copiedAbilities: g.copiedAbilities,
  });
}
function eventOwner(
  s: GameState,
  event: { owner: number; sourceType: string },
) {
  const g = getGem(s, event.owner);
  return g && activeTower(g) && g.type === event.sourceType ? g : undefined;
}
function maintainBurns(s: GameState, g: Gem, t: TowerDef) {
  const burnAbilities = t.abilities.filter((a) => a.startsWith('tower_huiyao'));
  for (const id of burnAbilities) {
    const level = Number(id.at(-1)) || 1;
    const interval = level === 3 ? 2 : 0.5,
      amount = [0, 30, 160, 5000][level],
      range = [0, 400, 500, 800][level] / 128;
    for (const e of s.enemies) {
      if (e.hp <= 0 || e.magicImmune || s.frenzy || distance(g, e) > range)
        continue;
      const burns = (e.burns ??= []);
      const old = burns.find((b) => b.id === id);
      // Same aura modifier does not stack; its own clock survives overlapping sources.
      if (old) {
        old.until = s.time + 1;
        if (!eventOwner(s, old)) {
          old.owner = g.id;
          old.sourceType = g.type;
        }
      } else
        burns.push({
          id,
          owner: g.id,
          sourceType: g.type,
          amount,
          interval,
          nextTick: s.time + interval,
          until: s.time + 1,
        });
    }
  }
}
function attackLanded(s: GameState, event: CombatEvent, e: Enemy) {
  const owner = eventOwner(s, event),
    source = { id: event.owner, type: event.sourceType };
  const t = owner
    ? towerDefinition(owner)
    : towerDefinition({
        type: event.sourceType,
        copiedAbilities: event.copiedAbilities,
      } as Gem);
  if (event.kind === 'arrow') {
    // Lua reads average true attack damage when the additional arrow arrives.
    hit(
      s,
      owner,
      e,
      owner ? attackDamage(s, owner) : event.amount,
      'physical',
      source,
    );
    return;
  }
  const protectedTower = owner && auraAt(s, owner).some((a) => a.immunity);
  if (
    owner &&
    !protectedTower &&
    e.abilities?.includes('enemy_bukeqinfan') &&
    proc(s, e, 'untouchable', 0.5)
  )
    owner.disarmedUntil = s.time + 1;
  if (e.abilities?.includes('shredder_reactive_armor')) {
    const stacks = (e.reactive ?? []).filter((until) => until > s.time);
    if (stacks.length >= 5) stacks.shift();
    stacks.push(s.time + 10);
    e.reactive = stacks;
  }
  if (
    e.evasion &&
    !(owner && auraAt(s, owner).some((a) => a.cannotMiss)) &&
    random(s) < e.evasion
  )
    return;
  const dealt = hit(s, owner, e, event.amount, 'physical', source);
  s.shots.push({
    from: event.from,
    to: { x: e.x, y: e.y },
    color: t.color,
    life: 0.16,
    kind: 'hit',
  });
  if (t.effects.ranjin) hit(s, owner, e, dealt, 'magic', source);
  for (const ability of t.abilities.filter((a) =>
    /^tower_jianshe\d$/.test(a),
  )) {
    const level = Number(ability.at(-1));
    for (const other of s.enemies)
      if (
        other.hp > 0 &&
        distance(other, e) <= [0, 300, 350, 400, 450, 500, 700][level] / 128
      )
        hit(
          s,
          owner,
          other,
          event.amount * [0, 0.3, 0.4, 0.5, 0.6, 0.7, 1][level],
          'pure',
          source,
        );
  }
  if (t.effects.lightning && random(s) < t.effects.lightning && e.hp > 0) {
    hit(s, owner, e, 200, 'magic', source);
    s.events.push({
      ...event,
      kind: 'chain',
      at: s.time + 0.2,
      projectileSpeed: undefined,
      from: { x: e.x, y: e.y },
      amount: 200,
      visited: [e.id],
      remaining: 4,
    });
  }
  if (t.effects.fork && random(s) < t.effects.fork) {
    hit(s, owner, e, 2500, 'magic', source);
    for (const other of s.enemies
      .filter(
        (x) =>
          x.hp > 0 &&
          !x.magicImmune &&
          x.id !== e.id &&
          distance(x, e) <= 1000 / 128,
      )
      .sort((a, b) => distance(b, e) - distance(a, e) || a.id - b.id)
      .slice(0, 4))
      hit(s, owner, other, 2500, 'magic', source);
  }
  if (t.effects.heal && random(s) < t.effects.heal)
    s.life = Math.min(MOBILE_RULES.initialLife, s.life + 1);
  if (t.effects.petrify && owner && random(s) < t.effects.petrify)
    s.gazes.push({
      x: owner.x,
      y: owner.y,
      owner: owner.id,
      start: s.time + 0.5,
      until: s.time + 5.5,
      facing: {},
      petrified: [],
    });
  if (e.hp <= 0) return;
  const effects = t.abilities.filter((a) =>
    /^tower_(slow|du|jianjia)\d|^tower_jin2?$/.test(a),
  );
  for (const id of effects) {
    const level = Number(id.at(-1)) || 1;
    if (
      id.startsWith('tower_jianjia') ||
      id === 'tower_jin' ||
      id === 'tower_jin2'
    )
      applyDebuff(e, {
        id: `pierce:${id}`,
        armor: id === 'tower_jin' ? 32 : id === 'tower_jin2' ? 48 : 2 ** level,
        until: s.time + 2,
      });
    if (e.magicImmune || s.frenzy) continue;
    if (id.startsWith('tower_slow'))
      applyDebuff(e, {
        id: `slow:${id}`,
        slow: [0, 60, 90, 120, 150, 180, 480][level],
        until: s.time + 2,
      });
    if (id.startsWith('tower_du'))
      e.poisons.push({
        owner: event.owner,
        sourceType: event.sourceType,
        damage: [0, 2, 4, 8, 16, 32, 128][level],
        nextTick: s.time + 1,
        remaining: 5,
      });
  }
  if (!e.magicImmune && !s.frenzy) {
    if (t.effects.stun && random(s) < t.effects.stun)
      e.stunUntil = Math.max(e.stunUntil, s.time + 2);
    if (t.effects.cold)
      for (const other of s.enemies)
        if (
          other.hp > 0 &&
          !other.magicImmune &&
          distance(e, other) <= 300 / 128
        )
          applyDebuff(other, {
            id: 'extremeCold',
            slowPct: 0.5,
            noHeal: true,
            until: s.time + 3,
          });
  }
}
function processEvents(s: GameState, dt: number) {
  const pending = s.events;
  s.events = [];
  for (const event of pending) {
    if (event.at > s.time + 1e-9) {
      s.events.push(event);
      continue;
    }
    let e = s.enemies.find((e) => e.id === event.target && e.hp > 0);
    if (event.kind === 'chain') {
      const previous = s.enemies.find((x) => x.id === event.target && x.hp > 0);
      if (!previous) continue;
      event.from = { x: previous.x, y: previous.y };
      e = s.enemies
        .filter(
          (e) =>
            e.hp > 0 &&
            !e.magicImmune &&
            !event.visited.includes(e.id) &&
            distance(e, event.from) <= 1000 / 128,
        )
        .sort(
          (a, b) =>
            distance(a, event.from) - distance(b, event.from) || a.id - b.id,
        )[0];
      if (e) {
        hit(s, eventOwner(s, event), e, event.amount, 'magic', {
          id: event.owner,
          type: event.sourceType,
        });
        if (event.remaining > 1)
          s.events.push({
            ...event,
            at: s.time + 0.2,
            from: { x: e.x, y: e.y },
            target: e.id,
            remaining: event.remaining - 1,
            visited: [...event.visited, e.id],
          });
      }
      continue;
    }
    if (event.kind === 'torrent') {
      resolveSlabEvent(s, event);
      continue;
    }
    if (!e) continue;
    if (event.projectileSpeed) {
      const length = distance(event.from, e),
        travel = event.projectileSpeed * dt;
      if (length > travel) {
        event.from.x += ((e.x - event.from.x) * travel) / length;
        event.from.y += ((e.y - event.from.y) * travel) / length;
        s.events.push(event);
        continue;
      }
    }
    if (event.kind === 'attack' || event.kind === 'arrow')
      attackLanded(s, event, e);
    else if (event.kind === 'magic')
      hit(s, eventOwner(s, event), e, event.amount, 'magic', {
        id: event.owner,
        type: event.sourceType,
      });
    else if (event.kind === 'fear') {
      const tier = event.tier ?? 1;
      for (const other of s.enemies)
        if (
          other.hp > 0 &&
          distance(other, e) <= [0, 256, 512, 1024][tier] / 128
        )
          applyDebuff(other, {
            id: 'fear',
            incoming: [0, 0.5, 1, 2][tier],
            until: s.time + 12,
          });
    } else if (event.kind === 'root')
      applyDebuff(e, {
        id: 'ensnare',
        root: true,
        until: s.time + (event.duration ?? 5),
      });
    else {
      const frost = event.kind === 'frost';
      if (frost) {
        hit(s, eventOwner(s, event), e, event.amount, 'magic', {
          id: event.owner,
          type: event.sourceType,
        });
        applyDebuff(e, { id: 'chainFrost', slowPct: 0.5, until: s.time + 5 });
      } else
        e.stunUntil = Math.max(e.stunUntil, s.time + (event.duration ?? 1));
      if (event.remaining > 0) {
        const next = s.enemies
          .filter(
            (other) =>
              other.hp > 0 &&
              other.id !== e.id &&
              (frost || !other.magicImmune) &&
              distance(other, e) <= 1000 / 128,
          )
          .sort((a, b) => distance(a, e) - distance(b, e) || a.id - b.id)[0];
        if (next)
          s.events.push({
            ...event,
            target: next.id,
            from: { x: e.x, y: e.y },
            at: s.time + 0.2,
            remaining: event.remaining - 1,
          });
      }
    }
  }
}
function updateGazes(s: GameState, dt: number) {
  s.gazes = s.gazes.filter((g) => g.until > s.time);
  for (const gaze of s.gazes) {
    if (gaze.start > s.time) continue;
    for (const e of s.enemies) {
      if (
        e.hp <= 0 ||
        distance(e, gaze) > 1000 / 128 ||
        gaze.petrified.includes(e.id)
      )
        continue;
      const route = e.flying
        ? BOARD.checkpoints.map(([x, y]) => ({ x, y }))
        : s.path;
      const target = route[e.routeIndex];
      if (!target) continue;
      const length = distance(e, target) * distance(e, gaze);
      const facing =
        length === 0 ||
        ((target.x - e.x) * (gaze.x - e.x) +
          (target.y - e.y) * (gaze.y - e.y)) /
          length >=
          0.08715;
      if (facing) {
        applyDebuff(e, { id: 'gazeSlow', slowPct: 0.35, until: s.time + 0.1 });
        gaze.facing[e.id] = (gaze.facing[e.id] ?? 0) + dt;
        if (gaze.facing[e.id] >= 2) {
          e.stunUntil = Math.max(e.stunUntil, s.time + 3);
          applyDebuff(e, {
            id: 'petrified',
            physicalTaken: 0.5,
            until: s.time + 3,
          });
          gaze.petrified.push(e.id);
        }
      }
    }
  }
}
export function slabOptions(s: GameState) {
  if (s.phase !== 'prepare' || s.placed !== 5 || s.resolved) return [];
  const candidates = s.gems.filter((g) => g.candidate);
  return SLAB_RECIPES.filter((r) =>
    r.materials.every((type) => candidates.some((g) => g.type === type)),
  );
}
export function canBuildSlab(
  s: GameState,
  x: number,
  y: number,
): string | null {
  if (s.phase !== 'prepare' || s.placed !== 5 || s.resolved)
    return '石板需要本轮建满五颗，且尚未留石';
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= BOARD.width ||
    y >= BOARD.height ||
    isProtected(x, y) ||
    isWaypoint(x, y)
  )
    return '请选择可建造区域的空格';
  if (
    s.gems.some((g) => g.x === x && g.y === y) ||
    s.slabs.some((g) => g.x === x && g.y === y)
  )
    return '石板需要空格';
  return null;
}
export function buildSlab(s: GameState, type: string, x: number, y: number) {
  const error = canBuildSlab(s, x, y);
  if (error) throw new Error(error);
  if (!slabOptions(s).some((r) => r.result === type))
    throw new Error('本轮石板材料不足');
  for (const g of s.gems) if (g.candidate) stone(g);
  const slab: Slab = { id: s.nextId++, type, tier: 1, x, y, readyAt: s.time };
  s.slabs.push(slab);
  s.resolved = true;
  upgradeSlabs(s);
  startWave(s);
  return slab;
}
export function upgradeSlabs(s: GameState) {
  let merged = true;
  while (merged) {
    merged = false;
    for (const center of s.slabs) {
      if (center.tier >= 3) continue;
      for (const [dx, dy] of [
        [1, 1],
        [1, 0],
        [0, 1],
        [-1, 1],
      ]) {
        const sides = [-1, 1].map((sign) =>
          s.slabs.find(
            (p) =>
              p.type === center.type &&
              p.tier === center.tier &&
              p.x === center.x + sign * dx &&
              p.y === center.y + sign * dy,
          ),
        );
        if (sides.every(Boolean)) {
          s.slabs = s.slabs.filter((p) => !sides.includes(p));
          center.tier++;
          center.readyAt = s.time;
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
  }
}
export function slabType(slab: Slab) {
  return slab.type + (slab.tier === 1 ? '' : slab.tier === 2 ? '_yin' : '_jin');
}
function attackDamage(s: GameState, g: Gem) {
  const bonus =
    mvpBonus(s, g).total +
    Math.max(0, ...auraAt(s, g).map((a) => (a.damage ?? 0) * 100)) +
    howlBonus(s, g);
  return towerDefinition(g).damage * (1 + bonus / 100);
}
function howlBonus(s: GameState, g: Gem) {
  return (g.howlUntil ?? 0) > s.time ? (g.howlDamage ?? 0) : 0;
}
function updateFields(s: GameState, dt: number) {
  s.fields = s.fields.filter((f) => f.until > s.time);
  for (const f of s.fields) {
    if (f.kind === 'acid')
      for (const e of s.enemies)
        if (e.hp > 0 && distance(e, f) <= 625 / 128)
          applyDebuff(e, {
            id: 'acid',
            armor: [0, 14, 28, 56][f.tier],
            until: s.time + 0.5,
          });
    if (f.kind === 'gale') {
      const speed = [0, 600, 400, 200][f.tier] / 128,
        old = { x: f.x, y: f.y };
      f.x += (f.dx ?? 0) * speed * dt;
      f.y += (f.dy ?? 0) * speed * dt;
      f.travelled = (f.travelled ?? 0) + speed * dt;
      for (const e of s.enemies) {
        if (e.hp <= 0 || e.magicImmune || s.frenzy) continue;
        const ax = e.x - old.x,
          ay = e.y - old.y,
          bx = f.x - old.x,
          by = f.y - old.y;
        const ratio = Math.max(
          0,
          Math.min(1, (ax * bx + ay * by) / (bx * bx + by * by || 1)),
        );
        if (
          distance(e, { x: old.x + bx * ratio, y: old.y + by * ratio }) <=
            125 / 128 &&
          !(f.hit ?? []).includes(e.id)
        ) {
          (f.hit ??= []).push(e.id);
          const duration = [0, 11, 13, 17][f.tier];
          applyDebuff(e, {
            id: 'gale',
            slowPct: [0, 0.5, 0.7, 0.9][f.tier],
            until: s.time + duration,
            started: s.time,
            duration,
          });
        }
      }
    }
  }
}
function resolveSlabEvent(s: GameState, event: CombatEvent) {
  const tier = event.tier ?? 1;
  const duration = [0, 2, 4, 8][tier];
  for (const e of s.enemies)
    if (
      e.hp > 0 &&
      !e.magicImmune &&
      !s.frenzy &&
      distance(e, event.from) <= 2
    ) {
      e.stunUntil = Math.max(e.stunUntil, s.time + duration);
      applyDebuff(e, {
        id: 'torrent',
        slowPct: [0, 0.4, 0.6, 0.8][tier],
        until: s.time + [0, 14, 14, 18][tier],
      });
      // OnSpellStart uses AbilityDamage / 2; the unused thinker is configured for zero damage.
      hit(s, undefined, e, 150, 'magic', {
        id: event.owner,
        type: event.sourceType,
      });
    }
}
function tickSlabs(s: GameState) {
  for (const slab of s.slabs) {
    if (slab.readyAt > s.time) continue;
    const target = s.enemies.find((e) => e.hp > 0 && distance(e, slab) <= 1);
    if (!target) continue;
    slab.readyAt = s.time + 10;
    const tier = slab.tier,
      type = slabType(slab);
    const event: CombatEvent = {
      kind: 'root',
      at: s.time,
      owner: slab.id,
      sourceType: type,
      target: target.id,
      from: { x: slab.x, y: slab.y },
      amount: 0,
      remaining: 0,
      visited: [],
      tier,
    };
    if (slab.type === 'gemtd_youbushiban') {
      const targets =
        tier === 1
          ? [target]
          : s.enemies
              .filter(
                (e) =>
                  e.hp > 0 &&
                  distance(e, target) <= (tier === 2 ? 512 : 1024) / 128,
              )
              .slice(0, tier === 2 ? 4 : 20);
      for (const e of targets)
        s.events.push({
          ...event,
          target: e.id,
          projectileSpeed: 1500 / 128,
          duration: 5,
          at: s.time + 0.6 + (tier === 1 ? 0 : 0.01 + random(s) * 0.49),
        });
    } else if (slab.type === 'gemtd_mabishiban') {
      const targets =
        tier === 1
          ? [target]
          : s.enemies
              .filter(
                (e) =>
                  e.hp > 0 &&
                  distance(e, target) <= (tier === 2 ? 512 : 1024) / 128,
              )
              .slice(0, tier === 2 ? 3 : 9);
      for (const e of targets)
        s.events.push({
          ...event,
          kind: 'cask',
          target: e.id,
          projectileSpeed: 1800 / 128,
          duration: [0, 1, 1.5, 2][tier],
          remaining: 12,
          at: s.time + (tier === 1 ? 0 : 0.01 + random(s) * 0.49),
        });
    } else if (slab.type === 'gemtd_hongliushiban')
      s.events.push({
        ...event,
        kind: 'torrent',
        at: s.time + 1.6,
        from: { x: target.x, y: target.y },
      });
    else if (slab.type === 'gemtd_haojiaoshiban') {
      for (const g of s.gems)
        if (
          activeTower(g) &&
          distance(g, slab) <= [0, 256, 384, 512][tier] / 128
        ) {
          g.howlDamage = [0, 50, 100, 200][tier];
          g.howlUntil = s.time + 10;
        }
    } else if (slab.type === 'gemtd_suanwushiban')
      s.fields.push({
        id: s.nextId++,
        owner: slab.id,
        sourceType: type,
        x: target.x,
        y: target.y,
        kind: 'acid',
        tier,
        until: s.time + [0, 10, 15, 20][tier],
      });
    else if (slab.type === 'gemtd_zhangqishiban') {
      const len = distance(slab, target) || 1;
      s.fields.push({
        id: s.nextId++,
        owner: slab.id,
        sourceType: type,
        x: slab.x,
        y: slab.y,
        kind: 'gale',
        tier,
        until: s.time + [0, 800 / 600, 1200 / 400, 1600 / 200][tier],
        dx: (target.x - slab.x) / len,
        dy: (target.y - slab.y) / len,
        travelled: 0,
      });
    } else if (slab.type === 'gemtd_kongheshiban') {
      s.events.push({
        kind: 'fear',
        at: s.time,
        owner: slab.id,
        sourceType: type,
        target: target.id,
        from: { x: slab.x, y: slab.y },
        amount: 0,
        remaining: 0,
        visited: [],
        tier,
        projectileSpeed: 1500 / 128,
      });
    } else {
      const range = [0, 256, 384, 512][tier] / 128;
      if (!target.magicImmune && !s.frenzy)
        for (const e of s.enemies)
          if (e.hp > 0 && !e.magicImmune && distance(e, target) <= range)
            applyDebuff(e, {
              id: 'ethereal',
              magicTaken: [0, 0.3, 0.6, 0.9][tier],
              slowPct: [0, 0.5, 0.7, 0.9][tier],
              until: s.time + [0, 8, 9, 10][tier],
            });
    }
    if (random(s) < 0.24)
      for (const g of s.gems)
        if (
          activeTower(g) &&
          towerDefinition(g).effects.chainFrost &&
          distance(g, target) <= 500 / 128
        ) {
          target.stunUntil = Math.max(target.stunUntil, s.time + 0.1);
          s.events.push({
            ...event,
            kind: 'frost',
            owner: g.id,
            sourceType: g.type,
            from: { x: g.x, y: g.y },
            amount: 8000,
            remaining: 10,
            projectileSpeed: 2000 / 128,
            at: s.time + 0.05,
          });
        }
  }
}
function atPathNode(s: GameState, e: Enemy, route: Point[]) {
  const abilities = e.abilities ?? [];
  if (
    abilities.includes('enemy_zheguang') &&
    ((e.refraction ?? 0) === 0 || (e.refractionUntil ?? 0) <= s.time) &&
    (e.refractionReady ?? 0) <= s.time &&
    random(s) < 0.2
  ) {
    e.refraction = 6;
    e.refractionUntil = s.time + 60;
    e.refractionReady = s.time + 5;
  } else if (
    abilities.includes('enemy_shanshuo') &&
    (e.blinkReady ?? 0) <= s.time &&
    !debuffs(s, e).some((d) => d.root) &&
    random(s) < 0.1
  ) {
    const next = Math.min(
      route.length - 1,
      e.routeIndex + Math.ceil(route.length / 25),
    );
    for (let i = e.routeIndex; i <= next; i++)
      e.progress += distance(i === e.routeIndex ? e : route[i - 1], route[i]);
    e.x = route[next].x;
    e.y = route[next].y;
    e.routeIndex = next + 1;
    e.blinkReady = s.time + 12;
  } else if (
    abilities.includes('runrunrun') &&
    (e.sprintUntil ?? 0) <= s.time &&
    random(s) < 0.2
  )
    e.sprintUntil = s.time + 20;
}
export function tick(s: GameState, dt = STEP) {
  if (s.phase !== 'combat' || s.paused) return;
  s.time += dt;
  if (s.damageReport) s.damageReport.elapsed = s.time - s.waveStartedAt;
  s.shots = s.shots.filter((x) => (x.life -= dt) > 0);
  const w = waveInfo(s);
  s.spawnClock -= dt;
  while (s.spawned < w.count && s.spawnClock <= 0) {
    spawn(s, w);
    s.spawnClock += w.spawnEvery;
  }
  const active = s.gems.filter((g) => g.type !== 'stone' && !g.candidate);
  s.frenzy = s.time - s.waveStartedAt > 180;
  updateFields(s, dt);
  updateGazes(s, dt);
  for (const g of active) {
    const t = towerDefinition(g),
      buffs = auraAt(s, g);
    if (buffs.some((a) => a.greed)) g.greedMarked = true;
    const immune = buffs.some((a) => a.immunity);
    if (
      !immune &&
      s.enemies.some(
        (e) =>
          e.hp > 0 &&
          e.abilities?.includes('guai_jiaoxieguanghuan') &&
          distance(g, e) <= 130 / 128,
      )
    )
      g.disarmedUntil = s.time + 1;
    maintainBurns(s, g, t);
    g.cooldown -= dt;
    if (t.damage <= 0 || (g.disarmedUntil ?? 0) > s.time) {
      g.cooldown = Math.max(0, g.cooldown);
      continue;
    }
    const reach = t.range + Math.max(0, ...buffs.map((a) => a.reach ?? 0));
    while (g.cooldown <= 1e-9) {
      const available = s.enemies.filter(
        (e) => e.hp > 0 && distance(g, e) <= reach && seen(s, e),
      );
      const primary =
        available.find((e) => e.id === g.targetId) ??
        available.sort((a, b) => b.progress - a.progress || a.id - b.id)[0];
      if (!primary) {
        g.cooldown = 0;
        delete g.targetId;
        break;
      }
      g.targetId = primary.id;
      if (
        t.effects.selfDisarm &&
        proc(s, g, 'selfDisarm', t.effects.selfDisarm)
      ) {
        g.disarmedUntil = s.time + 5;
        g.cooldown = 0;
        break;
      }
      const speed = Math.max(
        1,
        100 + t.bonusSpeed + buffs.reduce((n, a) => n + (a.speed ?? 0), 0),
      );
      g.cooldown += t.interval / (speed / 100);
      const damage = attackDamage(s, g);
      const crit = proc(s, g, 'crit', t.effects.crit) ? 5 : 1;
      queueProjectile(
        s,
        g,
        primary,
        'attack',
        damage * crit,
        t.projectileSpeed,
      );
      const additionalTargets = available
        .filter((e) => e.id !== primary.id)
        .sort((a, b) => distance(g, a) - distance(g, b) || a.id - b.id);
      for (const ability of t.abilities.filter((a) =>
        a.startsWith('tower_fenliejian'),
      )) {
        const count = ability.endsWith('_you')
          ? 10
          : ability.endsWith('_xianyan')
            ? 4
            : 2;
        for (const e of additionalTargets.slice(0, count))
          queueProjectile(s, g, e, 'arrow', damage, t.projectileSpeed);
      }
    }
  }
  processEvents(s, dt);
  tickSlabs(s);
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    e.debuffs = debuffs(s, e);
    e.reactive = (e.reactive ?? []).filter((until) => until > s.time);
    for (const burn of e.burns ?? []) {
      if (burn.until > s.time && burn.nextTick <= s.time + 1e-9) {
        burn.nextTick += burn.interval;
        hit(s, eventOwner(s, burn), e, burn.amount, 'magic', {
          id: burn.owner,
          type: burn.sourceType,
        });
      }
    }
    e.burns = (e.burns ?? []).filter((b) => b.until > s.time);
    for (const poison of e.poisons) {
      if (poison.remaining > 0 && poison.nextTick <= s.time + 1e-9) {
        poison.nextTick += 1;
        poison.remaining--;
        const owner = getGem(s, poison.owner);
        const sameTower =
          !poison.sourceType || owner?.type === poison.sourceType;
        hit(
          s,
          sameTower ? owner : undefined,
          e,
          poison.damage,
          'magic',
          poison.sourceType
            ? { id: poison.owner, type: poison.sourceType }
            : undefined,
        );
      }
    }
    e.poisons = e.poisons.filter((p) => p.remaining > 0);
    if (e.hp <= 0) continue;
    const statuses = debuffs(s, e);
    if (!statuses.some((d) => d.noHeal))
      e.hp = Math.min(
        e.maxHp,
        e.hp +
          ((e.abilities?.includes('enemy_recharge') ? 400 : 0) +
            (e.reactive ?? []).length) *
            dt,
      );
    const auras = auraAt(s, e);
    const slow =
      (e.slowUntil > s.time ? e.slow : 0) +
      Math.max(0, ...statuses.map((d) => d.slow ?? 0)) +
      Math.max(0, ...auras.map((a) => a.slow ?? 0));
    const pct = Math.max(
      0,
      ...auras.map((a) => a.slowPct ?? 0),
      ...statuses.map((d) =>
        d.id === 'gale'
          ? (d.slowPct ?? 0) *
            Math.max(0, (d.until - s.time) / (d.duration ?? 1))
          : (d.slowPct ?? 0),
      ),
    );
    const cooperation = e.magicImmune
      ? 0
      : (s.enemies.filter(
          (other) =>
            other.hp > 0 &&
            other.abilities?.includes('guai_xietong') &&
            distance(e, other) <= 9999 / 128,
        ).length *
          150) /
        128;
    const haste = (e.sprintUntil ?? 0) > s.time ? 0.5 : 0;
    const fear = statuses.some((d) => d.id === 'fear') ? 0.3 : 0;
    let movement =
      e.stunUntil > s.time || statuses.some((d) => d.root)
        ? 0
        : Math.max(
            MOBILE_RULES.minimumSpeed,
            (e.speed - slow / 128 - cooperation) *
              Math.max(0, 1 - pct + haste + fear + (s.frenzy ? 1 : 0)),
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
        if (e.routeIndex < route.length) atPathNode(s, e, route);
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
    if (s.damageReport) s.damageReport.outcome = 'lost';
    s.paused = false;
    return;
  }
  if (s.spawned === w.count && !s.enemies.length) {
    const mvp = awardMvp(s);
    if (s.damageReport) {
      s.damageReport.outcome = 'cleared';
      s.damageReport.mvp = mvp;
    }
    s.history.push({
      wave: s.wave,
      kills: s.waveKills,
      leaks: s.waveLeaks,
      life: s.life,
      mvp,
      damageReport: s.damageReport,
    });
    s.damageReport = null;
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
    s.events = [];
    s.fields = [];
    s.gazes = [];
    if (s.wave === 50 || s.wave === 100) {
      s.phase = 'won';
      return;
    }
    s.wave++;
    s.bossType = undefined;
    s.phase = 'prepare';
    s.placed = 0;
    s.resolved = false;
  }
}
export function continueEndless(s: GameState) {
  if (s.phase !== 'won' || s.wave !== 50)
    throw new Error('通关50波后可以继续无尽挑战');
  s.wave = 51;
  s.bossType = undefined;
  s.phase = 'prepare';
  s.placed = 0;
  s.resolved = false;
  s.frenzy = false;
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
  const legacy = s?.version === LEGACY_DATA_VERSION;
  const oldMvp = s?.version === CUSTOM_MVP_DATA_VERSION;
  const oldMechanics = legacy || oldMvp || s?.version === PREVIOUS_DATA_VERSION;
  const migrating = legacy || oldMvp;
  if (!s || (!oldMechanics && s.version !== DATA_VERSION))
    throw new Error('存档版本不兼容，已保留旧存档，请另开新局');
  if (migrating) s.mvpStartWave = s.wave + (s.phase === 'combat' ? 1 : 0);
  if (
    !['prepare', 'combat', 'won', 'lost'].includes(s.phase) ||
    !Number.isInteger(s.wave) ||
    s.wave < 1 ||
    s.wave > 100 ||
    !Number.isInteger(s.mvpStartWave) ||
    s.mvpStartWave < 1 ||
    s.mvpStartWave > 101 ||
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
  if (oldMechanics) {
    s.events = [];
    s.slabs = [];
    s.fields = [];
    s.gazes = [];
    s.frenzy = s.phase === 'combat' && s.time - s.waveStartedAt > 180;
  }
  if (
    ![s.events, s.slabs, s.fields, s.gazes].every(Array.isArray) ||
    s.events.length > 50000 ||
    s.slabs.length > BOARD.width * BOARD.height ||
    s.fields.length > 10000 ||
    s.gazes.length > 10000 ||
    typeof s.frenzy !== 'boolean' ||
    (s.bossType !== undefined &&
      ![
        'gemtd_yuediyang_boss',
        'gemtd_zard_boss_fly',
        'gemtd_gugubiao_boss_fly',
        'gemtd_roushan_boss_fly_jin',
        'gemtd_roushan_boss_fly_bojin',
      ].includes(s.bossType))
  )
    throw new Error('存档技能状态不完整');
  const numericOptional = (values: unknown[]) =>
    values.every((n) => n === undefined || finite(n));
  if (
    s.bossVariants !== undefined &&
    (!s.bossVariants ||
      typeof s.bossVariants !== 'object' ||
      Array.isArray(s.bossVariants) ||
      Object.entries(s.bossVariants).some(
        ([wave, id]) =>
          !(
            {
              20: ['gemtd_yuediyang_boss'],
              30: ['gemtd_zard_boss_fly'],
              40: ['gemtd_gugubiao_boss_fly'],
              50: [
                'gemtd_roushan_boss_fly_jin',
                'gemtd_roushan_boss_fly_bojin',
              ],
            } as Record<string, string[]>
          )[wave]?.includes(id),
      ))
  )
    throw new Error('存档Boss替代记录无效');
  const validPrd = (prd: Record<string, number> | undefined) =>
    prd === undefined ||
    (!!prd &&
      typeof prd === 'object' &&
      !Array.isArray(prd) &&
      Object.keys(prd).length < 32 &&
      Object.values(prd).every(
        (n) => Number.isInteger(n) && n >= 0 && n <= 10000,
      ));
  const cells = new Set<string>(),
    ids = new Set<number>();
  for (const g of s.gems) {
    if (oldMechanics && g && TOWERS[g.type]) initializeTower(s, g, false);
    if (migrating && g) g.waveScore = 0;
    if (legacy && g) {
      g.mvpLevel = 0;
      g.waveDamage = 0;
    }
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
      TOWERS[g.type]?.family === 'L' ||
      !numericOptional([
        g.disarmedUntil,
        g.targetId,
        g.howlDamage,
        g.howlUntil,
      ]) ||
      !validPrd(g.prd) ||
      (g.greedMarked !== undefined && typeof g.greedMarked !== 'boolean') ||
      (g.attack !== undefined &&
        (g.type !== 'gemtd_huguoshenyishi' ||
          !Number.isInteger(g.attack) ||
          g.attack < 1 ||
          g.attack > 1024)) ||
      (g.copiedAbilities !== undefined &&
        (g.type !== 'gemtd_tianranzumulv' ||
          !Array.isArray(g.copiedAbilities) ||
          g.copiedAbilities.length > 3 ||
          new Set(g.copiedAbilities).size !== g.copiedAbilities.length ||
          g.copiedAbilities.some((a) => !mechanics.stealable.includes(a)))) ||
      typeof g.candidate !== 'boolean' ||
      ![
        g.order,
        g.cooldown,
        g.burnClock,
        g.damage,
        g.kills,
        g.waveDamage,
      ].every(finite) ||
      g.waveDamage < 0 ||
      !Number.isInteger(g.waveScore) ||
      g.waveScore < 0 ||
      !Number.isInteger(g.mvpLevel) ||
      g.mvpLevel < 0 ||
      g.mvpLevel > MVP_RULES.maxLevel ||
      (g.type === 'stone' &&
        (g.mvpLevel !== 0 || g.waveDamage !== 0 || g.waveScore !== 0))
    )
      throw new Error('存档中的宝石数据异常');
    cells.add(pointKey(g.x, g.y));
    ids.add(g.id);
  }
  for (const entry of s.history) {
    if (
      !entry ||
      !Number.isInteger(entry.wave) ||
      entry.wave < 1 ||
      entry.wave > 100
    )
      throw new Error('存档波次记录异常');
    if (legacy) entry.mvp = null;
    if (migrating) entry.damageReport = null;
    const m = entry.mvp;
    if (
      m !== null &&
      (!m ||
        !TOWERS[m.type] ||
        !Number.isInteger(m.id) ||
        m.id < 1 ||
        !Number.isInteger(m.level) ||
        m.level < 1 ||
        m.level > MVP_RULES.maxLevel ||
        !finite(m.damage) ||
        m.damage < 0 ||
        !Number.isInteger(m.x) ||
        !Number.isInteger(m.y) ||
        m.x < 0 ||
        m.x >= BOARD.width ||
        m.y < 0 ||
        m.y >= BOARD.height)
    )
      throw new Error('存档MVP记录异常');
  }
  if (migrating)
    s.damageReport = ['combat', 'lost'].includes(s.phase)
      ? createDamageReport(s, false)
      : null;
  if (
    s.phase === 'combat' || s.phase === 'lost'
      ? !s.damageReport ||
        s.damageReport.wave !== s.wave ||
        s.damageReport.outcome !== s.phase
      : s.damageReport !== null
  )
    throw new Error('存档当前波次统计不匹配');
  if (
    s.history.some(
      (h) =>
        h.damageReport &&
        (h.damageReport.wave !== h.wave ||
          h.damageReport.outcome !== 'cleared'),
    )
  )
    throw new Error('存档历史波次统计不匹配');
  for (const report of [
    s.damageReport,
    ...s.history.map((h) => h.damageReport),
  ]) {
    if (report === null) continue;
    if (
      !report ||
      !Number.isInteger(report.wave) ||
      report.wave < 1 ||
      report.wave > 100 ||
      typeof report.complete !== 'boolean' ||
      !['combat', 'cleared', 'lost'].includes(report.outcome) ||
      !finite(report.elapsed) ||
      report.elapsed < 0 ||
      !Array.isArray(report.rows) ||
      report.rows.length > 2000 ||
      report.rows.some(
        (r) =>
          !r ||
          !TOWERS[r.type] ||
          !Number.isInteger(r.id) ||
          r.id < 1 ||
          !Number.isInteger(r.mvpLevel) ||
          r.mvpLevel < 0 ||
          r.mvpLevel > 10 ||
          typeof r.retired !== 'boolean' ||
          !Number.isInteger(r.x) ||
          !Number.isInteger(r.y) ||
          r.x < 0 ||
          r.x >= BOARD.width ||
          r.y < 0 ||
          r.y >= BOARD.height ||
          ![
            r.physical,
            r.magic,
            r.pure,
            r.unclassified,
            r.total,
            r.score,
            r.kills,
          ].every((n) => finite(n) && n >= 0) ||
          !Number.isInteger(r.score) ||
          !Number.isInteger(r.kills) ||
          Math.abs(r.total - r.physical - r.magic - r.pure - r.unclassified) >
            Math.max(0.001, r.total * 1e-9),
      )
    )
      throw new Error('存档伤害统计异常');
    const m = report.mvp;
    if (
      m !== null &&
      (!m ||
        !TOWERS[m.type] ||
        !Number.isInteger(m.level) ||
        m.level < 1 ||
        m.level > 10 ||
        !Number.isInteger(m.damage) ||
        m.damage <= 0 ||
        !report.rows.some(
          (r) =>
            r.id === m.id &&
            r.type === m.type &&
            !r.retired &&
            r.x === m.x &&
            r.y === m.y &&
            r.score === m.damage &&
            r.mvpLevel + 1 === m.level,
        ))
    )
      throw new Error('存档伤害统计MVP异常');
  }
  if (
    s.history.some(
      (h) =>
        h.damageReport &&
        JSON.stringify(h.mvp) !== JSON.stringify(h.damageReport.mvp),
    )
  )
    throw new Error('存档MVP与统计结算不一致');
  const route = findPath(s.gems);
  if (!route) throw new Error('存档道路无效');
  s.path = route;
  for (const e of s.enemies) {
    if (oldMechanics && e) {
      const w = waveInfo(s),
        variant = w.variants.find(
          (v) =>
            v.magicImmune === e.magicImmune &&
            v.physicalImmune === e.physicalImmune,
        );
      e.abilities = [
        ...new Set([
          ...(variant?.abilities ?? w.abilities),
          ...((mechanics.waveAbilities as Record<string, string[]>)[
            ((s.wave - 1) % 50) + 1
          ] ?? []),
        ]),
      ];
      e.debuffs = [];
      e.burns = [];
      e.reactive = [];
    }
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
      !numericOptional([
        e.xp,
        e.gold,
        e.refraction,
        e.refractionUntil,
        e.refractionReady,
        e.blinkReady,
        e.sprintUntil,
        e.cleanseDamage,
        e.lastDamageAt,
      ]) ||
      !validPrd(e.prd) ||
      (e.abilities !== undefined &&
        (!Array.isArray(e.abilities) ||
          e.abilities.length > 32 ||
          e.abilities.some((a) => typeof a !== 'string' || a.length > 100))) ||
      (e.debuffs !== undefined &&
        (!Array.isArray(e.debuffs) ||
          e.debuffs.length > 100 ||
          e.debuffs.some(
            (d) =>
              !d ||
              typeof d.id !== 'string' ||
              d.id.length > 100 ||
              !finite(d.until) ||
              !numericOptional([
                d.slow,
                d.slowPct,
                d.armor,
                d.incoming,
                d.magicTaken,
                d.physicalTaken,
                d.duration,
                d.started,
              ]) ||
              [d.noHeal, d.root].some(
                (v) => v !== undefined && typeof v !== 'boolean',
              ),
          ))) ||
      (e.burns !== undefined &&
        (!Array.isArray(e.burns) ||
          e.burns.length > 3 ||
          e.burns.some(
            (b) =>
              !b ||
              !TOWERS[b.sourceType] ||
              ![b.owner, b.amount, b.interval, b.nextTick, b.until].every(
                finite,
              ) ||
              b.interval <= 0 ||
              b.amount < 0,
          ))) ||
      (e.reactive !== undefined &&
        (!Array.isArray(e.reactive) ||
          e.reactive.length > 5 ||
          !e.reactive.every(finite))) ||
      !Array.isArray(e.poisons) ||
      e.poisons.some(
        (p) =>
          ![p.owner, p.damage, p.nextTick, p.remaining].every(finite) ||
          (p.sourceType !== undefined && !TOWERS[p.sourceType]) ||
          p.remaining < 1 ||
          p.remaining > 5,
      ) ||
      !Number.isInteger(e.routeIndex) ||
      e.routeIndex < 1 ||
      e.routeIndex >= (e.flying ? BOARD.checkpoints.length : route.length)
    )
      throw new Error('存档中的敌人数据异常');
    // Apply the balance change once to an already-spawned first Boss, preserving its health ratio.
    if (
      s.phase === 'combat' &&
      s.wave === FIRST_BOSS_BALANCE.wave &&
      e.maxHp === FIRST_BOSS_BALANCE.previousHp
    ) {
      e.hp = (e.hp / e.maxHp) * FIRST_BOSS_BALANCE.hp;
      e.maxHp = FIRST_BOSS_BALANCE.hp;
    }
    ids.add(e.id);
  }
  for (const slab of s.slabs) {
    if (
      !slab ||
      !Number.isInteger(slab.id) ||
      slab.id < 1 ||
      ids.has(slab.id) ||
      !SLAB_RECIPES.some((r) => r.result === slab.type) ||
      ![1, 2, 3].includes(slab.tier) ||
      !finite(slab.readyAt) ||
      !Number.isInteger(slab.x) ||
      !Number.isInteger(slab.y) ||
      slab.x < 0 ||
      slab.y < 0 ||
      slab.x >= BOARD.width ||
      slab.y >= BOARD.height ||
      isProtected(slab.x, slab.y) ||
      isWaypoint(slab.x, slab.y) ||
      cells.has(pointKey(slab.x, slab.y))
    )
      throw new Error('存档石板数据异常');
    cells.add(pointKey(slab.x, slab.y));
    ids.add(slab.id);
  }
  for (const event of s.events) {
    if (
      !event ||
      ![
        'attack',
        'arrow',
        'chain',
        'frost',
        'cask',
        'torrent',
        'root',
        'fear',
        'magic',
      ].includes(event.kind) ||
      !TOWERS[event.sourceType] ||
      ![
        event.at,
        event.owner,
        event.target,
        event.from?.x,
        event.from?.y,
        event.amount,
        event.remaining,
      ].every(finite) ||
      event.amount < 0 ||
      !Number.isInteger(event.remaining) ||
      event.remaining < 0 ||
      event.remaining > 12 ||
      !Array.isArray(event.visited) ||
      event.visited.length > 100 ||
      !event.visited.every(Number.isInteger) ||
      !numericOptional([event.duration, event.tier, event.projectileSpeed]) ||
      (event.projectileSpeed !== undefined && event.projectileSpeed <= 0) ||
      (event.copiedAbilities !== undefined &&
        (!Array.isArray(event.copiedAbilities) ||
          event.copiedAbilities.length > 3 ||
          event.copiedAbilities.some((a) => !mechanics.stealable.includes(a))))
    )
      throw new Error('存档弹道数据异常');
  }
  for (const field of s.fields) {
    if (
      !field ||
      !Number.isInteger(field.id) ||
      ids.has(field.id) ||
      !TOWERS[field.sourceType] ||
      !['acid', 'howl', 'gale'].includes(field.kind) ||
      ![1, 2, 3].includes(field.tier) ||
      ![field.x, field.y, field.owner, field.until].every(finite) ||
      !numericOptional([field.dx, field.dy, field.travelled]) ||
      (field.hit !== undefined &&
        (!Array.isArray(field.hit) ||
          field.hit.length > 100 ||
          !field.hit.every(Number.isInteger)))
    )
      throw new Error('存档区域技能异常');
    ids.add(field.id);
  }
  for (const gaze of s.gazes)
    if (
      !gaze ||
      ![gaze.x, gaze.y, gaze.owner, gaze.start, gaze.until].every(finite) ||
      !gaze.facing ||
      typeof gaze.facing !== 'object' ||
      Object.keys(gaze.facing).length > 100 ||
      !Object.values(gaze.facing).every(finite) ||
      !Array.isArray(gaze.petrified) ||
      gaze.petrified.length > 100 ||
      !gaze.petrified.every(Number.isInteger)
    )
      throw new Error('存档石化状态异常');
  if (ids.size && s.nextId <= Math.max(...ids))
    throw new Error('存档实例编号无效');
  s.paused = true;
  s.shots = [];
  s.version = DATA_VERSION;
  return s;
}
export function describe(value: string | Gem) {
  const t = typeof value === 'string' ? TOWERS[value] : towerDefinition(value);
  if (!t) return '阻挡道路，准备阶段可拆除；有建造次数时可直接替换建造宝石';
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
  if (t.effects.ranjin) parts.push('燃尽：命中附加魔法伤害');
  if (t.effects.cold) parts.push('极寒：范围减速50%并禁止治疗3秒');
  if (t.effects.petrify) parts.push('1%触发石化凝视');
  if (t.effects.selfDisarm) parts.push('3%自我缴械5秒');
  if (t.effects.chainFrost) parts.push('附近石板触发时可施放连环霜冻');
  if (t.auras.some((a) => a.immunity)) parts.push('友方魔免光环');
  if (t.auras.some((a) => a.greed)) parts.push('贪婪：击杀5%十倍金币');
  if (t.id === 'gemtd_tianranzumulv' && typeof value === 'string')
    parts.push('合成时复制附近最多3种技能');
  if (t.family === 'L')
    return slabDescription(
      t.id.replace(/_(yin|jin)$/, ''),
      t.id.endsWith('_jin') ? 3 : t.id.endsWith('_yin') ? 2 : 1,
    );
  if (t.auras.some((a) => a.speed)) parts.push('攻速光环');
  if (t.auras.some((a) => a.trueSight)) parts.push('显隐');
  if (t.auras.some((a) => a.armor)) parts.push('减甲光环');
  if (t.auras.some((a) => a.slow || a.slowPct)) parts.push('减速光环');
  if (t.auras.some((a) => a.damage)) parts.push('增伤光环');
  return parts.join(' · ') || '单体物理攻击';
}
export function slabDescription(type: string, tier = 1) {
  const details: Record<string, string> = {
    gemtd_youbushiban: `诱捕${[0, 1, 4, 20][tier]}个目标5秒`,
    gemtd_zhangqishiban: `直线瘴气，初始减速${[0, 50, 70, 90][tier]}%，逐渐恢复`,
    gemtd_hongliushiban: `延迟1.6秒洪流，击飞${[0, 2, 4, 8][tier]}秒并减速`,
    gemtd_haojiaoshiban: `附近友塔攻击伤害+${[0, 50, 100, 200][tier]}%，持续10秒`,
    gemtd_suanwushiban: `酸雾减甲${[0, 14, 28, 56][tier]}，持续${[0, 10, 15, 20][tier]}秒`,
    gemtd_mabishiban: `弹跳麻痹，每次眩晕${[0, 1, 1.5, 2][tier]}秒`,
    gemtd_kongheshiban: `范围目标承伤+${[0, 50, 100, 200][tier]}%、移速+30%，持续12秒`,
    gemtd_xuwushiban: `范围目标魔法承伤+${[0, 30, 60, 90][tier]}%，并减速`,
  };
  return `${details[type] ?? '石板'} · 怪物靠近1格触发 · 冷却10秒 · 不阻挡道路`;
}
