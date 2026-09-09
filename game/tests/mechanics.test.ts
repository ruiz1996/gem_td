import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  basicId,
  TOWERS,
  RECIPES,
  SLAB_RECIPES,
  PREVIOUS_DATA_VERSION,
  mechanics,
} from '../lib/game/data';
import {
  freshGame,
  startWave,
  tick,
  recommend,
  combine,
  fuse,
  fuseOptions,
  towerDefinition,
  saveGame,
  loadGame,
  applyDebuff,
  buildSlab,
  slabOptions,
  upgradeSlabs,
  continueEndless,
  random,
  prdConstant,
  type GameState,
  type Gem,
} from '../lib/game/engine';
function add(
  s: GameState,
  type: string,
  x = 17,
  y = 18,
  candidate = false,
): Gem {
  const g: Gem = {
    id: s.nextId++,
    type,
    x,
    y,
    candidate,
    order: s.nextId,
    cooldown: 0,
    burnClock: 0,
    damage: 0,
    waveDamage: 0,
    waveScore: 0,
    mvpLevel: 0,
    kills: 0,
  };
  s.gems.push(g);
  return g;
}
function arena(type = basicId('D', 1), wave = 1) {
  const s = freshGame(42);
  s.wave = wave;
  s.resolved = true;
  startWave(s);
  tick(s);
  s.spawned = s.combatCount;
  const e = s.enemies[0];
  Object.assign(e, {
    x: 17.1,
    y: 18,
    hp: 100000,
    maxHp: 100000,
    armor: 0,
    resist: 0,
    speed: 1,
    stunUntil: 100000,
    physicalImmune: false,
    magicImmune: false,
    invisible: false,
    evasion: 0,
    ancient: false,
    abilities: [],
  });
  const g = add(s, type);
  return { s, e, g };
}
function advance(s: GameState, seconds: number) {
  for (let i = 0; i < Math.round(seconds * 30); i++) tick(s);
}
function near(a: number, b: number) {
  assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
}
function seedFor(predicate: (rolls: number[]) => boolean) {
  const s = freshGame(1);
  for (let seed = 1; seed < 100000; seed++) {
    s.rng = seed;
    const rolls = [random(s), random(s)];
    if (predicate(rolls)) return seed;
  }
  throw Error('No test seed');
}
void test('all 13 hidden recipes reject retained materials before mutation and accept current candidates', () => {
  for (const recipe of RECIPES.filter((r) => r.candidateOnly)) {
    const s = freshGame(42),
      gems = recipe.materials.map((id, i) => add(s, id, 12 + i, 12));
    s.resolved = true;
    startWave(s);
    const before = saveGame(s);
    assert.equal(recommend(s, recipe, gems[0].id), null);
    assert.throws(
      () =>
        combine(
          s,
          recipe.id,
          gems[0].id,
          gems.map((g) => g.id),
        ),
      /隐藏/,
    );
    assert.equal(saveGame(s), before);
    const p = freshGame(42),
      candidates = recipe.materials.map((id, i) =>
        add(p, id, 12 + i, 12, true),
      );
    while (p.gems.filter((g) => g.candidate).length < 5)
      add(
        p,
        basicId('B', 1),
        12 + p.gems.filter((g) => g.candidate).length,
        12,
        true,
      );
    p.placed = 5;
    const ids = recommend(p, recipe, candidates[0].id);
    assert.ok(ids);
    combine(p, recipe.id, candidates[0].id, ids);
    assert.equal(candidates[0].type, recipe.result);
    assert.equal(p.gems.filter((g) => g.candidate).length, 0);
  }
});
void test('four identical grade-five candidates produce Great Stone with capped inherited MVP', () => {
  const s = freshGame(42),
    gems = Array.from({ length: 4 }, (_, i) =>
      add(s, basicId('D', 5), 12 + i, 12, true),
    );
  add(s, basicId('B', 1), 16, 12, true);
  s.placed = 5;
  gems.forEach((g, i) => (g.mvpLevel = i + 1));
  assert.deepEqual(fuseOptions(s, gems[0].id), [2, 4]);
  fuse(s, gems[0].id, 4);
  assert.equal(gems[0].type, 'gemtd_zhenjiazhishi');
  assert.equal(gems[0].mvpLevel, 10);
  assert.equal(s.gems.filter((g) => g.type !== 'stone').length, 1);
});
void test('Golden Jubilee rolls per instance, applies ranjin and survives reload without rerolling', () => {
  for (const candidate of [false, true]) {
    const s = freshGame(42),
      r = RECIPES.find((r) => r.result === 'gemtd_huguoshenyishi')!;
    const gems = r.materials.map((id, i) => add(s, id, 12 + i, 12, candidate));
    if (candidate) {
      while (s.gems.filter((g) => g.candidate).length < 5)
        add(
          s,
          basicId('B', 1),
          12 + s.gems.filter((g) => g.candidate).length,
          12,
          true,
        );
      s.placed = 5;
    }
    combine(
      s,
      r.id,
      gems[0].id,
      gems.map((g) => g.id),
    );
    assert.ok(
      gems[0].attack! >= (candidate ? 1 : 30) && gems[0].attack! <= 1024,
    );
    const loaded = loadGame(saveGame(s));
    assert.equal(loaded.rng, s.rng);
    assert.equal(
      towerDefinition(loaded.gems.find((g) => g.id === gems[0].id)!).damage,
      gems[0].attack,
    );
  }
  const { s, g, e } = arena('gemtd_huguoshenyishi');
  e.ancient = true;
  g.attack = 300;
  tick(s);
  const row = s.damageReport!.rows.find((r) => r.id === g.id)!;
  near(row.physical, 300);
  assert.ok(row.magic >= 300);
});
void test('Natural Zumurud copies only nearby eligible distinct abilities and preserves them through saves', () => {
  const s = freshGame(42),
    r = RECIPES.find((r) => r.result === 'gemtd_tianranzumulv')!;
  const gems = r.materials.map((id, i) =>
    add(s, id, i === 0 ? 18 : 12 + i, i === 0 ? 18 : 12),
  );
  const donors = [
    add(s, basicId('B', 6), 18, 17),
    add(s, basicId('D', 6), 17, 18),
    add(s, basicId('E', 6), 19, 18),
  ];
  add(s, basicId('G', 6), 30, 20);
  combine(
    s,
    r.id,
    gems[0].id,
    gems.map((g) => g.id),
  );
  const copied = gems[0].copiedAbilities!;
  assert.equal(copied.length, 3);
  assert.equal(new Set(copied).size, 3);
  assert.ok(
    copied.every((a) =>
      donors.some((g) => TOWERS[g.type].abilities.includes(a)),
    ),
  );
  assert.ok(!copied.includes('tower_du6'));
  assert.deepEqual(
    loadGame(saveGame(s)).gems.find((g) => g.id === gems[0].id)!
      .copiedAbilities,
    copied,
  );
});
void test('weak slow and armor hits cannot renew a stronger source modifier', () => {
  for (const family of ['B', 'P']) {
    const { s, e, g } = arena(basicId(family, 6));
    tick(s);
    g.cooldown = 999;
    const strong = e.debuffs![0],
      expiry = strong.until;
    advance(s, 1.4);
    const weak = add(s, basicId(family, 1), 17, 17);
    tick(s);
    weak.cooldown = 999;
    advance(s, 0.8);
    assert.ok(s.time > expiry);
    assert.ok(!e.debuffs?.some((d) => d.id === strong.id));
    assert.equal(e.debuffs?.length, 1);
    assert.equal(
      family === 'B' ? e.debuffs![0].slow : e.debuffs![0].armor,
      family === 'B' ? 60 : 2,
    );
  }
});
void test('burn has a per-target clock, lingers after leaving and overlapping copies do not double it', () => {
  const { s, e, g } = arena('gemtd_xingcaihongbaoshi');
  add(s, g.type, 17, 17);
  tick(s);
  assert.equal(e.hp, 100000);
  advance(s, 0.5);
  near(100000 - e.hp, 30);
  e.x = 30;
  const before = e.hp;
  advance(s, 1.1);
  near(before - e.hp, 30);
  const after = e.hp;
  advance(s, 1);
  near(e.hp, after);
});
void test('lightning follows nearest successive jumps outside the initial circle', () => {
  const def = Object.values(TOWERS).find((t) => t.effects.lightning)!;
  const chance = def.effects.lightning;
  def.effects.lightning = 1;
  try {
    const { s, e, g } = arena(def.id);
    const b = { ...structuredClone(e), id: s.nextId++, x: 24.8 },
      c = { ...structuredClone(e), id: s.nextId++, x: 32.5 };
    s.enemies.push(b, c);
    tick(s);
    g.cooldown = 999;
    near(100000 - b.hp, 0);
    advance(s, 0.21);
    near(100000 - b.hp, 200);
    near(100000 - c.hp, 0);
    advance(s, 0.21);
    near(100000 - c.hp, 200);
  } finally {
    def.effects.lightning = chance;
  }
});
void test('fork guarantees the primary plus four extras and excludes enemies beyond 1000 units', () => {
  const def = Object.values(TOWERS).find((t) => t.effects.fork)!;
  const chance = def.effects.fork;
  def.effects.fork = 1;
  try {
    const { s, e, g } = arena(def.id);
    e.progress = 100;
    s.enemies = [
      ...Array.from({ length: 5 }, (_, i) => ({
        ...structuredClone(e),
        id: s.nextId++,
        x: 17.12 + i * 0.01,
        progress: 0,
      })),
      e,
      { ...structuredClone(e), id: s.nextId++, x: 25.1, progress: 0 },
    ];
    tick(s);
    g.cooldown = 999;
    assert.ok(100000 - e.hp >= 2500);
    assert.equal(s.enemies.slice(0, 5).filter((x) => x.hp < 100000).length, 4);
    near(s.enemies[6].hp, 100000);
  } finally {
    def.effects.fork = chance;
  }
});
void test('multi-arrow extras use script damage without repeating primary evasion or attack procs', () => {
  const { s, e, g } = arena(basicId('Y', 1));
  e.evasion = 1;
  const b = { ...structuredClone(e), id: s.nextId++, x: 17.11 },
    c = { ...structuredClone(e), id: s.nextId++, x: 17.12 };
  s.enemies.push(b, c);
  tick(s);
  near(e.hp, 100000);
  near(100000 - b.hp, TOWERS[g.type].damage);
  near(100000 - c.hp, TOWERS[g.type].damage);
});
void test('projectiles take time, track targets and resume identically after saving in flight', () => {
  const { s, e, g } = arena();
  e.x = 20;
  tick(s);
  assert.equal(g.damage, 0);
  assert.ok(s.events.length > 0);
  const loaded = loadGame(saveGame(s));
  loaded.paused = false;
  advance(s, 0.5);
  advance(loaded, 0.5);
  assert.ok(g.damage > 0);
  assert.equal(saveGame(loaded), saveGame(s));
});
void test('basic Bixi excludes magic immunity and upgraded Bixi can reduce its armor', () => {
  function damage(type?: string) {
    const { s, e, g } = arena();
    e.magicImmune = true;
    e.armor = 30;
    if (type) add(s, type, 16, 18).cooldown = 999;
    tick(s);
    return g.damage;
  }
  near(damage(), damage('gemtd_palayibabixi'));
  assert.ok(damage('gemtd_jingxindiaozhuodepalayibabixi') > damage());
});
void test('friendly immunity prevents enemy disarm and upgraded fold-wing still slows magic immune enemies', () => {
  const { s, e, g } = arena();
  e.abilities = ['guai_jiaoxieguanghuan'];
  tick(s);
  assert.equal(g.damage, 0);
  add(s, 'gemtd_shenhaizhenzhu', 16, 18).cooldown = 999;
  advance(s, 1.1);
  assert.ok(g.damage > 0);
  const fold = Object.values(TOWERS).find((t) =>
    t.auras.some((a) => a.id === 'tower_zheyi2'),
  )!;
  const a = arena(fold.id);
  a.g.cooldown = 999;
  a.e.magicImmune = true;
  a.e.stunUntil = 0;
  a.e.speed = 10;
  const p = a.e.progress;
  tick(a.s);
  near((a.e.progress - p) * 30, 10 - 250 / 128);
});
void test('recharge and reactive armor regeneration respect extreme cold healing prevention', () => {
  const { s, e, g } = arena();
  g.cooldown = 999;
  e.abilities = ['enemy_recharge'];
  e.hp = 1000;
  advance(s, 1);
  near(e.hp, 1400);
  applyDebuff(e, { id: 'extremeCold', noHeal: true, until: s.time + 3 });
  advance(s, 1);
  near(e.hp, 1400);
  e.abilities = ['shredder_reactive_armor'];
  e.debuffs = [];
  for (let i = 0; i < 6; i++) {
    g.cooldown = 0;
    tick(s);
  }
  assert.equal(e.reactive!.length, 5);
  g.cooldown = 999;
  advance(s, 10.1);
  assert.equal(e.reactive!.length, 0);
});
void test('refraction restores nonlethal event damage and Kraken cleanses at the solo threshold', () => {
  const { s, e, g } = arena();
  e.refraction = 6;
  e.refractionUntil = s.time + 60;
  tick(s);
  near(e.hp, 100000);
  assert.equal(e.refraction, 5);
  assert.ok(g.damage > 0);
  e.refraction = 0;
  e.abilities = ['tidehunter_kraken_shell'];
  e.cleanseDamage = 39999;
  e.lastDamageAt = s.time;
  applyDebuff(e, { id: 'test', slow: 100, until: s.time + 5 });
  e.poisons.push({
    owner: g.id,
    damage: 2,
    nextTick: s.time + 2,
    remaining: 5,
  });
  g.cooldown = 0;
  tick(s);
  assert.equal(e.cleanseDamage, 0);
  assert.equal(e.debuffs!.length, 0);
  assert.equal(e.poisons.length, 0);
});
void test('path-node abilities trigger refraction, blink and sprint with their source cooldowns', () => {
  for (const ability of ['enemy_zheguang', 'enemy_shanshuo', 'runrunrun']) {
    const { s, e, g } = arena();
    g.cooldown = 999;
    e.abilities = [ability];
    e.stunUntil = 0;
    e.routeIndex = 2;
    Object.assign(e, s.path[2]);
    s.rng = 1;
    tick(s);
    if (ability === 'enemy_zheguang') {
      assert.equal(e.refraction, 6);
      near(e.refractionReady! - s.time, 5);
    }
    if (ability === 'enemy_shanshuo') {
      assert.ok(e.routeIndex > 3);
      near(e.blinkReady! - s.time, 12);
    }
    if (ability === 'runrunrun') near(e.sprintUntil! - s.time, 20);
  }
});
void test('elite, boss overrides and 180-second frenzy follow deterministic source branches', () => {
  const s = freshGame(1);
  s.resolved = true;
  startWave(s);
  tick(s);
  assert.equal(s.enemies[0].elite, true);
  near(s.enemies[0].maxHp, 3 * 8);
  assert.equal(s.enemies[0].xp, 50);
  assert.equal(s.enemies[0].gold, 50);
  const boss = freshGame(seedFor((r) => r[0] >= 0.8 && r[1] >= 0.9));
  boss.wave = 50;
  boss.resolved = true;
  startWave(boss);
  assert.equal(boss.bossType, 'gemtd_roushan_boss_fly_bojin');
  const a = arena('gemtd_xingcaihongbaoshi');
  a.s.time = a.s.waveStartedAt + 181;
  tick(a.s);
  assert.equal(a.s.frenzy, true);
  advance(a.s, 1);
  assert.equal(a.g.damage, 0);
});
void test('slabs use current candidates, occupy a passable cell and auto-upgrade three in a line', () => {
  const s = freshGame(42),
    r = SLAB_RECIPES[0];
  r.materials.forEach((id, i) => add(s, id, 12 + i, 12, true));
  for (let i = 2; i < 5; i++) add(s, basicId('B', 1), 12 + i, 12, true);
  s.placed = 5;
  const path = JSON.stringify(s.path);
  assert.ok(slabOptions(s).some((x) => x.result === r.result));
  const slab = buildSlab(s, r.result, 18, 18);
  assert.equal(s.phase, 'combat');
  assert.ok(s.gems.every((g) => g.type === 'stone'));
  assert.ok(!s.gems.some((g) => g.x === slab.x && g.y === slab.y));
  assert.equal(
    s.path.some((p) => p.x === 18 && p.y === 18),
    JSON.parse(path).some(
      (p: { x: number; y: number }) => p.x === 18 && p.y === 18,
    ),
  );
  s.slabs.push(
    { id: s.nextId++, type: r.result, tier: 1, x: 17, y: 18, readyAt: s.time },
    { id: s.nextId++, type: r.result, tier: 1, x: 19, y: 18, readyAt: s.time },
  );
  upgradeSlabs(s);
  assert.equal(s.slabs.length, 1);
  assert.equal(s.slabs[0].tier, 2);
  assert.equal(s.slabs[0].x, 18);
  assert.doesNotThrow(() => loadGame(saveGame(s)));
});
void test('endless waves preserve rolled boss variants and stop awarding MVP after wave 50', () => {
  const a = arena();
  a.s.wave = 51;
  a.e.hp = 1;
  tick(a.s);
  assert.equal(a.s.wave, 52);
  assert.equal(a.g.mvpLevel, 0);
  assert.equal(a.s.history.at(-1)!.mvp, null);
  const b = freshGame(42);
  b.wave = 70;
  b.bossVariants = { 20: 'gemtd_yuediyang_boss' };
  b.resolved = true;
  startWave(b);
  assert.equal(b.bossType, 'gemtd_yuediyang_boss');
  assert.equal(loadGame(saveGame(b)).bossVariants?.[20], b.bossType);
  const c = arena(basicId('D', 1), 20);
  c.s.bossType = 'gemtd_yuediyang_boss';
  c.e.hp = 1;
  tick(c.s);
  assert.equal(c.s.wave, 21);
  assert.equal(c.s.bossType, undefined);
});
void test('all eight slab families execute their control, field or damage effects', () => {
  for (const r of SLAB_RECIPES) {
    const { s, e, g } = arena();
    g.cooldown = 999;
    s.slabs.push({
      id: s.nextId++,
      type: r.result,
      tier: 1,
      x: 18,
      y: 18,
      readyAt: 0,
    });
    tick(s);
    advance(s, 2);
    const name = r.result;
    assert.ok(s.slabs[0].readyAt > s.time);
    if (name.includes('you bu'.replace(' ', '')))
      assert.ok(e.debuffs?.some((d) => d.root));
    if (name.includes('zhangqi'))
      assert.ok(e.debuffs?.some((d) => d.id === 'gale'));
    if (name.includes('hongliu'))
      assert.ok(e.stunUntil > s.time && e.hp < 100000);
    if (name.includes('haojiao')) assert.ok(g.howlUntil! > s.time);
    if (name.includes('suanwu'))
      assert.ok(e.debuffs?.some((d) => d.armor === 14));
    if (name.includes('mabi')) assert.ok(e.stunUntil > 0);
    if (name.includes('konghe'))
      assert.ok(e.debuffs?.some((d) => d.incoming === 0.5));
    if (name.includes('xuwu'))
      assert.ok(e.debuffs?.some((d) => d.magicTaken === 0.3));
  }
});
void test('a slab trigger can launch Sea Sapphire chain frost with damage credited to its tower', () => {
  const sea = Object.values(TOWERS).find((t) => t.effects.chainFrost)!;
  const { s, e, g } = arena(sea.id);
  g.cooldown = 999;
  s.slabs.push({
    id: s.nextId++,
    type: SLAB_RECIPES[0].result,
    tier: 1,
    x: 18,
    y: 18,
    readyAt: 0,
  });
  s.rng = 1;
  tick(s);
  advance(s, 0.5);
  near(100000 - e.hp, 8000);
  near(s.damageReport!.rows.find((r) => r.id === g.id)!.magic, 8000);
});
void test('PRD coefficients reproduce nominal mean rates and guarantee an eventual trigger', () => {
  for (const p of [0.03, 0.1, 0.5]) {
    const c = prdConstant(p);
    let survive = 1,
      mean = 0;
    for (let n = 1; survive > 1e-12; n++) {
      mean += survive;
      survive *= 1 - Math.min(1, n * c);
    }
    near(1 / mean, p);
    assert.ok(c > 0 && c < p);
  }
});
void test('copied splash abilities each deal damage and copied multishot abilities each launch arrows', () => {
  const { s, e, g } = arena('gemtd_tianranzumulv');
  g.copiedAbilities = ['tower_jianshe1', 'tower_jianshe2'];
  tick(s);
  near(s.damageReport!.rows.find((r) => r.id === g.id)!.pure, 80 * (0.3 + 0.4));
  const b = arena('gemtd_tianranzumulv');
  b.g.copiedAbilities = ['tower_fenliejian', 'tower_fenliejian_xianyan'];
  b.e.x = 20;
  b.s.enemies.push({ ...structuredClone(b.e), id: b.s.nextId++, x: 20.1 });
  tick(b.s);
  assert.equal(b.s.events.filter((event) => event.kind === 'arrow').length, 2);
  assert.ok(e.hp < e.maxHp);
});
void test('additional arrows read attack buffs on arrival without applying ordinary attack procs', () => {
  const { s, e, g } = arena('gemtd_kongqueshi');
  e.x = 20;
  const other = { ...structuredClone(e), id: s.nextId++, x: 20.1 };
  s.enemies.push(other);
  tick(s);
  g.cooldown = 999;
  g.howlDamage = 100;
  g.howlUntil = s.time + 10;
  advance(s, 1);
  near(e.maxHp - e.hp, TOWERS[g.type].damage);
  near(other.maxHp - other.hp, TOWERS[g.type].damage * 2);
});
void test('self-disarm prevents a shot and greed pays tenfold gold only on a successful kill roll', () => {
  const self = Object.values(TOWERS).find((t) => t.effects.selfDisarm)!;
  const a = arena(self.id);
  a.g.prd = { selfDisarm: 10000 };
  tick(a.s);
  assert.ok(a.g.disarmedUntil! > a.s.time + 4.9);
  near(a.e.hp, a.e.maxHp);
  assert.equal(a.s.events.length, 0);
  const b = arena();
  const greed = Object.values(TOWERS).find((t) =>
    t.auras.some((a) => a.greed),
  )!;
  add(b.s, greed.id, 17, 19).cooldown = 999;
  b.s.rng = 1;
  b.e.hp = 1;
  tick(b.s);
  assert.ok(b.g.greedMarked);
  assert.equal(b.s.gold, 50);
});
void test('stone gaze requires two seconds facing its source before petrifying', () => {
  const { s, e, g } = arena();
  g.cooldown = 999;
  e.stunUntil = 0;
  e.routeIndex = 1;
  s.path = [
    { x: 17.1, y: 18 },
    { x: 30, y: 18 },
  ];
  s.gazes.push({
    x: 20,
    y: 18,
    owner: g.id,
    start: 0,
    until: 10,
    facing: {},
    petrified: [],
  });
  advance(s, 1.5);
  assert.ok(!e.debuffs?.some((d) => d.id === 'petrified'));
  advance(s, 0.6);
  assert.ok(
    e.debuffs?.some((d) => d.id === 'petrified' && d.physicalTaken === 0.5),
  );
  assert.ok(e.stunUntil > s.time);
  const away = arena();
  away.g.cooldown = 999;
  away.s.path = [
    { x: 17.1, y: 18 },
    { x: 10, y: 18 },
  ];
  away.e.routeIndex = 1;
  away.s.gazes.push({
    x: 20,
    y: 18,
    owner: away.g.id,
    start: 0,
    until: 10,
    facing: {},
    petrified: [],
  });
  advance(away.s, 3);
  assert.ok(!away.e.debuffs?.some((d) => d.id === 'petrified'));
});
void test('fear applies its area modifier when its tracking projectile arrives', () => {
  const { s, e, g } = arena();
  g.cooldown = 999;
  s.slabs.push({
    id: s.nextId++,
    type: 'gemtd_kongheshiban',
    tier: 1,
    x: 18,
    y: 18,
    readyAt: 0,
  });
  tick(s);
  assert.equal(s.events.filter((event) => event.kind === 'fear').length, 1);
  assert.ok(!e.debuffs?.some((d) => d.id === 'fear'));
  advance(s, 0.2);
  assert.ok(e.debuffs?.some((d) => d.id === 'fear' && d.incoming === 0.5));
});
void test('alpha-5 saves migrate dynamic tower instances once and reject malformed new effect state', () => {
  const a = arena('gemtd_huguoshenyishi');
  const old = JSON.parse(saveGame(a.s));
  old.version = PREVIOUS_DATA_VERSION;
  delete old.events;
  delete old.slabs;
  delete old.fields;
  delete old.gazes;
  delete old.frenzy;
  const migrated = loadGame(JSON.stringify(old));
  const attack = migrated.gems.find((g) => g.id === a.g.id)!.attack;
  assert.ok(attack! >= 30);
  assert.equal(
    loadGame(saveGame(migrated)).gems.find((g) => g.id === a.g.id)!.attack,
    attack,
  );
  const { s, e } = arena();
  e.x = 20;
  tick(s);
  for (const mutate of [
    (b: GameState) => {
      b.events[0].amount = -1;
    },
    (b: GameState) => {
      b.enemies[0].debuffs = [{ id: 'bad', until: NaN }];
    },
    (b: GameState) => {
      b.slabs = [
        {
          id: b.nextId++,
          type: SLAB_RECIPES[0].result,
          x: 18,
          y: 18,
          tier: 4,
          readyAt: 0,
        },
      ];
    },
  ]) {
    const bad = JSON.parse(saveGame(s));
    mutate(bad);
    assert.throws(() => loadGame(JSON.stringify(bad)));
  }
});
void test('50-wave victory can continue through the archived 51–100 challenge without losing the board', () => {
  const s = freshGame(42);
  s.wave = 50;
  s.phase = 'won';
  const gems = s.gems;
  continueEndless(s);
  assert.equal(s.wave, 51);
  assert.equal(s.gems, gems);
  s.resolved = true;
  startWave(s);
  tick(s);
  assert.ok(s.enemies[0].maxHp > 10000);
  assert.ok(
    s.enemies[0].abilities!.some((a) => mechanics.endlessAbilities.includes(a)),
  );
  assert.doesNotThrow(() => loadGame(saveGame(s)));
});
