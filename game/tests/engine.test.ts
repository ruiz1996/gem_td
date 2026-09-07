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
  findPath,
  freshGame as originalFreshGame,
  fuse,
  fuseOptions,
  keep,
  loadGame,
  physicalMultiplier,
  place,
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
