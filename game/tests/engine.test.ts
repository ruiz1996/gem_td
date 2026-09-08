import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD,
  MOBILE_RULES,
  RECIPES,
  TOWERS,
  WAVES,
  basicId,
} from '../lib/game/data';
import {
  combine,
  crushAndStartWave,
  crushOptions,
  findPath,
  freshGame as originalFreshGame,
  fuse,
  fuseOptions,
  keep,
  keepAndStartWave,
  loadGame,
  physicalMultiplier,
  place,
  random,
  recipesFor,
  recommend,
  removeStone,
  saveGame,
  startWave,
  tick,
  type GameState,
  type Gem,
} from '../lib/game/engine';
// These rule fixtures remove the preset stones during preparation.
function freshGame(seed?: number) {
  const s = originalFreshGame(seed);
  for (const rock of s.gems) removeStone(s, rock.id);
  return s;
}
function add(
  s: GameState,
  type: string,
  x: number,
  y: number,
  candidate = false,
): Gem {
  const g = {
    id: s.nextId++,
    type,
    x,
    y: y + 6,
    candidate,
    order: s.nextId,
    cooldown: 0,
    burnClock: 0,
    damage: 0,
    kills: 0,
  };
  s.gems.push(g);
  return g;
}
function run(s: GameState, limit = 30000) {
  for (let i = 0; i < limit && s.phase === 'combat'; i++) tick(s);
  assert.notEqual(s.phase, 'combat', 'wave should eventually terminate');
}
void test('historical catalog is internally consistent', () => {
  assert.equal(Object.values(TOWERS).filter((x) => x.quality).length, 48);
  assert.equal(WAVES.length, 50);
  for (const t of Object.values(TOWERS)) {
    assert.ok(Number.isFinite(t.damage) && t.damage >= 0);
    assert.ok(t.interval > 0 && t.range > 0);
    for (const recipe of t.recipes)
      for (const id of recipe) assert.ok(TOWERS[id]);
  }
  for (const w of WAVES) {
    assert.ok(w.hp > 0 && w.speed > 0);
  }
  for (const weights of MOBILE_RULES.qualityWeights)
    assert.equal(
      weights.reduce((a, b) => a + b, 0),
      100,
    );
});
void test('the route visits all waypoints in order and rejects a sealed segment', () => {
  const path = findPath([])!;
  let offset = 0;
  for (const [x, y] of BOARD.checkpoints) {
    const at = path.findIndex((p, i) => i >= offset && p.x === x && p.y === y);
    assert.ok(at >= offset);
    offset = at;
  }
  assert.equal(
    findPath(Array.from({ length: BOARD.height }, (_, y) => ({ x: 12, y }))),
    null,
  );
});
void test('illegal placement cannot reveal gems or advance random state', () => {
  const s = freshGame(41),
    before = saveGame(s);
  assert.throws(() => place(s, 0, 2));
  assert.equal(saveGame(s), before);
  assert.throws(() => place(s, NaN, 2));
  assert.equal(saveGame(s), before);
});
void test('five candidates resolve to exactly one active tower and four rocks', () => {
  const s = freshGame(4);
  for (let x = 4; x < 9; x++) place(s, x, 11);
  assert.throws(() => place(s, 9, 11));
  keep(s, s.gems[2].id);
  assert.equal(s.gems.filter((g) => g.type === 'stone').length, 4);
  assert.ok(s.gems.every((g) => !g.candidate));
  assert.throws(() => keep(s, s.gems[2].id));
  assert.throws(() => place(s, 10, 5));
});
void test('combat prohibits building/removal even when paused', () => {
  const s = freshGame();
  for (let x = 4; x < 9; x++) place(s, x, 11);
  keep(s, s.gems[0].id);
  startWave(s);
  s.paused = true;
  assert.throws(() => place(s, 10, 5));
  assert.throws(() => removeStone(s, s.gems[1].id));
  const before = s.time;
  tick(s);
  assert.equal(s.time, before);
});
void test('keeping starts the current wave once, including after restoring a paused preparation', () => {
  const s = freshGame(7);
  for (let x = 4; x < 9; x++) place(s, x, 11);
  s.wave = 4;
  s.paused = true;
  const selected = s.gems[2],
    beforePath = findPath(s.gems);
  keepAndStartWave(s, selected.id);
  assert.equal(s.phase, 'combat');
  assert.equal(s.wave, 4, 'start this prepared wave, never skip to wave 5');
  assert.equal(s.paused, false);
  assert.equal(s.gems.filter((g) => g.type !== 'stone').length, 1);
  assert.ok(s.gems.every((g) => !g.candidate));
  assert.deepEqual(s.path, beforePath);
  tick(s);
  assert.ok(s.enemies.length > 0, 'spawning begins without a second command');
  const started = saveGame(s);
  assert.throws(() => keepAndStartWave(s, selected.id));
  assert.equal(saveGame(s), started, 'double taps cannot restart combat');
  assert.throws(() => removeStone(s, s.gems[0].id));
});
void test('invalid keep-and-start requests leave the preparation unchanged', () => {
  const s = freshGame(8);
  place(s, 4, 11);
  let before = saveGame(s);
  assert.throws(() => keepAndStartWave(s, s.gems[0].id));
  assert.equal(saveGame(s), before);
  for (let x = 5; x < 9; x++) place(s, x, 11);
  before = saveGame(s);
  assert.throws(() => keepAndStartWave(s, -1));
  assert.equal(saveGame(s), before);
  for (let y = 0; y < BOARD.height; y++) add(s, 'stone', 12, y - 6);
  before = saveGame(s);
  assert.throws(() => keepAndStartWave(s, s.gems[0].id), /道路不通/);
  assert.equal(
    saveGame(s),
    before,
    'failed route validation must not consume candidates',
  );
});
function crushFixture() {
  const s = originalFreshGame(24);
  for (let x = 4; x < 9; x++) place(s, x, 11);
  const selected = s.gems.find((g) => g.candidate)!;
  selected.type = basicId('B', 5);
  add(s, basicId('Y', 2), 15, 9);
  s.wave = 12;
  s.paused = true;
  s.speed = 2;
  return { s, id: selected.id };
}
void test('crushing probabilities follow the source and favor closer lower grades', () => {
  assert.deepEqual(MOBILE_RULES.crushWeights.slice(2, 6), [
    [100],
    [66, 34],
    [50, 30, 20],
    [50, 25, 15, 10],
  ]);
  const { s, id } = crushFixture();
  const gem = s.gems.find((g) => g.id === id)!;
  for (let quality = 2; quality <= 6; quality++) {
    gem.type = basicId('B', quality);
    const before = saveGame(s);
    const options = crushOptions(s, id);
    assert.equal(
      saveGame(s),
      before,
      'viewing probabilities must not roll the result',
    );
    assert.deepEqual(
      options.map((o) => o.quality),
      Array.from({ length: quality - 1 }, (_, i) => quality - i - 1),
    );
    assert.equal(
      options.reduce((sum, o) => sum + o.chance, 0),
      100,
    );
    assert.ok(
      options.every(
        (o, i) => o.chance > 0 && (!i || options[i - 1].chance > o.chance),
      ),
    );
  }
});
void test('actual crushing draws honor each percentage interval for grades 2 through 6', () => {
  const { s: base, id } = crushFixture();
  const probes = new Map<number, number>();
  const probe = structuredClone(base);
  for (let seed = 1; probes.size < 100 && seed < 100000; seed++) {
    probe.rng = seed;
    probes.set(Math.floor(random(probe) * 100), seed);
  }
  assert.equal(
    probes.size,
    100,
    'sample every percentage interval of the real saved RNG',
  );
  for (let quality = 2; quality <= 6; quality++) {
    const counts = Array(quality - 1).fill(0) as number[];
    for (const seed of probes.values()) {
      const s = structuredClone(base);
      s.rng = seed;
      s.gems.find((g) => g.id === id)!.type = basicId('B', quality);
      const result = crushAndStartWave(s, id);
      counts[quality - TOWERS[result.type].quality - 1]++;
    }
    assert.deepEqual(counts, MOBILE_RULES.crushWeights[quality]);
  }
});
void test('crushing retains one lower gem in place and starts this wave exactly once', () => {
  const { s: base, id } = crushFixture();
  for (const family of ['B', 'D', 'E', 'G', 'P', 'Q', 'R', 'Y']) {
    const s = structuredClone(base);
    const selected = s.gems.find((g) => g.id === id)!;
    selected.type = basicId(family, 5);
    const position = {
      id,
      x: selected.x,
      y: selected.y,
      order: selected.order,
    };
    const occupied = s.gems.map((g) => [g.x, g.y]);
    const candidates = s.gems
      .filter((g) => g.candidate && g.id !== id)
      .map((g) => g.id);
    const retained = structuredClone(s.gems.filter((g) => !g.candidate));
    const route = findPath(s.gems);
    crushAndStartWave(s, id);
    assert.equal(TOWERS[selected.type].family, family);
    assert.ok(
      TOWERS[selected.type].quality >= 1 && TOWERS[selected.type].quality < 5,
    );
    assert.deepEqual(
      { id: selected.id, x: selected.x, y: selected.y, order: selected.order },
      position,
    );
    assert.ok(s.gems.every((g) => !g.candidate));
    assert.ok(
      candidates.every(
        (otherId) => s.gems.find((g) => g.id === otherId)!.type === 'stone',
      ),
    );
    assert.deepEqual(
      s.gems.filter((g) => retained.some((r) => r.id === g.id)),
      retained,
    );
    assert.deepEqual(
      s.gems.map((g) => [g.x, g.y]),
      occupied,
    );
    assert.deepEqual(s.path, route);
    assert.deepEqual(
      [s.phase, s.wave, s.paused, s.speed, s.xp, s.quality],
      ['combat', 12, false, 2, base.xp, base.quality],
    );
    const started = saveGame(s);
    assert.throws(() => crushAndStartWave(s, id));
    assert.equal(
      saveGame(s),
      started,
      'repeat input cannot reroll or restart combat',
    );
    tick(s);
    assert.ok(s.enemies.length > 0);
  }
});
void test('invalid crushing never consumes gems or advances RNG', () => {
  const { s: base, id } = crushFixture();
  for (const change of [
    (s: GameState) => {
      s.placed = 4;
    },
    (s: GameState) => {
      s.resolved = true;
    },
    (s: GameState) => {
      s.phase = 'combat';
      s.paused = true;
    },
    (s: GameState) => {
      s.phase = 'won';
    },
    (s: GameState) => {
      s.phase = 'lost';
    },
    (s: GameState) => {
      s.gems.find((g) => g.id === id)!.candidate = false;
    },
    ...['stone', basicId('B', 1), 'gemtd_baiyin'].map(
      (type) => (s: GameState) => {
        s.gems.find((g) => g.id === id)!.type = type;
      },
    ),
    (s: GameState) => {
      s.gems = s.gems.filter((g) => g.id !== id);
    },
    (s: GameState) => {
      for (let y = 0; y < BOARD.height; y++) add(s, 'stone', 12, y - 6);
    },
  ]) {
    const s = structuredClone(base);
    change(s);
    const before = saveGame(s);
    assert.throws(() => crushAndStartWave(s, id));
    assert.equal(saveGame(s), before);
  }
});
void test('crushing is deterministic after reloading a preparation save', () => {
  const { s, id } = crushFixture();
  const restored = loadGame(saveGame(s));
  crushAndStartWave(s, id);
  crushAndStartWave(restored, id);
  assert.equal(saveGame(restored), saveGame(s));
  assert.equal(
    loadGame(saveGame(s)).gems.find((g) => g.id === id)!.type,
    s.gems.find((g) => g.id === id)!.type,
  );
});
void test('combat recipes work while running or paused without changing enemies, route or wave clocks', () => {
  for (const paused of [false, true]) {
    const s = freshGame(12);
    const b = add(s, basicId('B', 1), 4, 4),
      y1 = add(s, basicId('Y', 1), 5, 4),
      d = add(s, basicId('D', 1), 6, 4),
      y2 = add(s, basicId('Y', 1), 7, 4);
    s.resolved = true;
    startWave(s);
    for (let i = 0; i < 35; i++) tick(s);
    s.paused = paused;
    b.cooldown = 0.37;
    const recipe = recipesFor(s, b.id).find(
      (r) => r.recipe.result === 'gemtd_baiyin',
    )!;
    assert.deepEqual(recipe.ids, [b.id, y1.id, d.id]);
    const enemies = structuredClone(s.enemies),
      path = s.path,
      occupied = s.gems.map((g) => [g.x, g.y]),
      clocks = [
        s.time,
        s.spawnClock,
        s.spawned,
        s.waveStartedAt,
        s.combatCount,
      ];
    assert.ok(enemies.length > 0);
    combine(s, recipe.recipe.id, b.id, [b.id, y2.id, d.id]);
    assert.equal(s.phase, 'combat');
    assert.equal(s.paused, paused);
    assert.equal(b.type, 'gemtd_baiyin');
    assert.equal(b.cooldown, 0.37);
    assert.equal(y1.type, basicId('Y', 1));
    assert.equal(y2.type, 'stone');
    assert.equal(d.type, 'stone');
    assert.equal(s.path, path);
    assert.deepEqual(
      s.gems.map((g) => [g.x, g.y]),
      occupied,
    );
    assert.deepEqual(s.enemies, enemies);
    assert.deepEqual(
      [s.time, s.spawnClock, s.spawned, s.waveStartedAt, s.combatCount],
      clocks,
    );
    tick(s);
    assert.equal(s.time > clocks[0], !paused);
  }
});
void test('fusion consumes this round only and honors the quality cap', () => {
  const s = freshGame();
  const one = add(s, basicId('D', 1), 3, 5, true);
  add(s, basicId('D', 1), 4, 5, true);
  add(s, basicId('D', 1), 5, 5, true);
  add(s, basicId('D', 1), 6, 5, true);
  add(s, basicId('Q', 1), 7, 5, true);
  s.placed = 5;
  assert.deepEqual(fuseOptions(s, one.id), [2, 4]);
  fuse(s, one.id, 4);
  assert.equal(one.type, basicId('D', 3));
  assert.equal(s.gems.filter((g) => g.type === 'stone').length, 4);
});
void test('manual recipe selection preserves unselected duplicates and occupied cells', () => {
  const s = freshGame();
  const b = add(s, basicId('B', 1), 4, 4),
    y1 = add(s, basicId('Y', 1), 5, 4),
    d = add(s, basicId('D', 1), 6, 4),
    y2 = add(s, basicId('Y', 1), 7, 4);
  const recipe = RECIPES.find((r) => r.result === 'gemtd_baiyin')!;
  assert.deepEqual(recommend(s, recipe, b.id), [b.id, y1.id, d.id]);
  s.phase = 'combat';
  s.paused = true;
  const before = findPath(s.gems);
  combine(s, recipe.id, b.id, [b.id, y2.id, d.id]);
  assert.equal(b.type, 'gemtd_baiyin');
  assert.equal(y1.type, basicId('Y', 1));
  assert.equal(y2.type, 'stone');
  assert.equal(d.type, 'stone');
  assert.deepEqual(findPath(s.gems), before);
});
void test('invalid or reused material IDs reject the entire transaction', () => {
  const s = freshGame();
  const b = add(s, basicId('B', 1), 4, 4),
    y = add(s, basicId('Y', 1), 5, 4);
  const recipe = RECIPES.find((r) => r.result === 'gemtd_baiyin')!;
  const before = saveGame(s);
  assert.throws(() => combine(s, recipe.id, b.id, [b.id, y.id, y.id]));
  assert.equal(saveGame(s), before);
  assert.throws(() => combine(s, recipe.id, b.id, [b.id, y.id, 999]));
  assert.equal(saveGame(s), before);
});
void test('cannot mix candidate and retained gems to bypass the one-keep rule', () => {
  const s = freshGame();
  const b = add(s, basicId('B', 1), 4, 4, true),
    y = add(s, basicId('Y', 1), 5, 4),
    d = add(s, basicId('D', 1), 6, 4, true);
  s.placed = 5;
  const recipe = RECIPES.find((r) => r.result === 'gemtd_baiyin')!;
  assert.equal(recommend(s, recipe, b.id), null);
  assert.throws(() => combine(s, recipe.id, b.id, [b.id, y.id, d.id]));
});
void test('crafting a candidate recipe resolves all five candidate slots', () => {
  const s = freshGame();
  const b = add(s, basicId('B', 1), 4, 4, true),
    y = add(s, basicId('Y', 1), 5, 4, true),
    d = add(s, basicId('D', 1), 6, 4, true);
  add(s, basicId('E', 1), 7, 4, true);
  add(s, basicId('Q', 1), 8, 4, true);
  s.placed = 5;
  combine(s, RECIPES.find((r) => r.result === 'gemtd_baiyin')!.id, b.id, [
    b.id,
    y.id,
    d.id,
  ]);
  assert.ok(s.resolved);
  assert.equal(s.gems.filter((g) => g.type !== 'stone').length, 1);
});
void test('armor supports positive and negative values with no singularity', () => {
  assert.equal(physicalMultiplier(0), 1);
  assert.ok(physicalMultiplier(20) < 1);
  assert.ok(physicalMultiplier(-20) > 1);
  assert.ok(physicalMultiplier(-1000) < 2);
});
void test('combat save/resume is deterministic including RNG and effects', () => {
  const a = freshGame(12);
  add(a, basicId('G', 3), 8, 3);
  add(a, basicId('P', 2), 10, 3);
  a.wave = 7;
  a.resolved = true;
  startWave(a);
  for (let i = 0; i < 70; i++) tick(a);
  const b = loadGame(saveGame(a));
  b.paused = false;
  for (let i = 0; i < 400; i++) {
    tick(a);
    tick(b);
  }
  assert.equal(saveGame(a), saveGame(b));
});
void test('render-independent stepping produces identical results', () => {
  const a = freshGame(11);
  add(a, 'gemtd_fenhongzuanshi', 7, 3);
  a.wave = 10;
  a.resolved = true;
  startWave(a);
  const b = loadGame(saveGame(a));
  b.paused = false;
  for (let i = 0; i < 240; i++) tick(a);
  for (let i = 0; i < 120; i++) {
    tick(b);
    tick(b);
  }
  assert.equal(saveGame(a), saveGame(b));
});
void test('damaged and incompatible saves are rejected', () => {
  assert.throws(() => loadGame('{'));
  assert.throws(() => loadGame(JSON.stringify({ version: 'old' })));
  const s = freshGame();
  add(s, basicId('D', 1), 2, 2);
  s.gems[0].type = 'missing';
  assert.throws(() => loadGame(saveGame(s)));
  const b = freshGame();
  b.life = Infinity;
  assert.throws(() => loadGame(saveGame(b)));
});
void test('an empty defense eventually loses', () => {
  const s = freshGame();
  s.resolved = true;
  s.life = 1;
  startWave(s);
  run(s);
  assert.equal(s.phase, 'lost');
  assert.equal(s.life, 0);
});
void test('wave clear enters next preparation and awards resources', () => {
  const s = freshGame();
  add(s, basicId('Y', 6), 12, 8);
  s.resolved = true;
  startWave(s);
  run(s);
  assert.equal(s.phase, 'prepare');
  assert.equal(s.wave, 2);
  assert.equal(s.placed, 0);
  assert.equal(s.resolved, false);
  assert.equal(s.kills, 5);
  assert.equal(s.gold, 25);
  assert.equal(s.xp, 25);
});
void test('all 50 waves can terminate and final wave leads to victory', () => {
  const s = freshGame();
  // Deliberately overwhelming fixture tests wave transitions, not game balance.
  const tower = add(s, basicId('R', 6), 12, 8);
  add(s, basicId('E', 1), 12, 9);
  const def = TOWERS[tower.type],
    sight = TOWERS[basicId('E', 1)].auras.find((a) => a.trueSight)!;
  const original = { damage: def.damage, range: def.range, sight: sight.range };
  def.damage = 1e12;
  def.range = 100;
  sight.range = 100;
  try {
    for (let n = 1; n <= 50; n++) {
      s.resolved = true;
      startWave(s);
      run(s);
    }
    assert.equal(s.phase, 'won');
    assert.equal(s.history.length, 50);
  } finally {
    def.damage = original.damage;
    def.range = original.range;
    sight.range = original.sight;
  }
});
void test('invisible enemies are detected by nearby opal', () => {
  const s = freshGame();
  const tower = add(s, basicId('D', 6), 5, 3);
  s.wave = 8;
  s.resolved = true;
  startWave(s);
  for (let i = 0; i < 70; i++) tick(s);
  assert.equal(tower.damage, 0);
  add(s, basicId('E', 1), 5, 4);
  for (let i = 0; i < 130; i++) tick(s);
  assert.ok(tower.damage > 0);
});
