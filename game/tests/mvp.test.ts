import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DATA_VERSION,
  CUSTOM_MVP_DATA_VERSION,
  LEGACY_DATA_VERSION,
  RECIPES,
  TOWERS,
  basicId,
} from '../lib/game/data';
import {
  combine,
  freshGame,
  fuse,
  inheritedMvp,
  loadGame,
  mvpBonus,
  mvpMagicMultiplier,
  saveGame,
  startWave,
  tick,
  type GameState,
  type Gem,
} from '../lib/game/engine';

function tower(
  s: GameState,
  type = basicId('D', 1),
  x = 17,
  y = 18,
  mvpLevel = 0,
  candidate = false,
) {
  const id = s.nextId++;
  const g: Gem = {
    id,
    type,
    x,
    y,
    mvpLevel,
    candidate,
    order: id,
    cooldown: 0,
    burnClock: 0,
    damage: 0,
    waveDamage: 0,
    waveScore: 0,
    kills: 0,
  };
  s.gems.push(g);
  return g;
}
function begin(s: GameState) {
  s.resolved = true;
  startWave(s);
}
function finish(s: GameState) {
  s.spawned = s.combatCount;
  s.enemies = [];
  tick(s);
}
function arena(type = basicId('D', 1), level = 0) {
  const s = freshGame(42),
    g = tower(s, type, 17, 18, level);
  begin(s);
  tick(s);
  s.spawned = s.combatCount;
  const e = s.enemies[0];
  Object.assign(e, {
    x: 18,
    y: 18,
    hp: 1e9,
    maxHp: 1e9,
    armor: 0,
    resist: 0,
    speed: 0.001,
    stunUntil: 10000,
  });
  g.burnClock = 0;
  g.cooldown = 0;
  return { s, g, e };
}
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 0.0001, `${actual} != ${expected}`);

void test('MVP uses this wave damage, skips every capped tower and awards only once', () => {
  const s = freshGame();
  const a = tower(s, basicId('D', 1), 12, 12, 10),
    b = tower(s, basicId('D', 1), 13, 12, 10),
    winner = tower(s, basicId('D', 1), 14, 12, 4),
    other = tower(s, basicId('D', 1), 15, 12, 2);
  begin(s);
  [a.waveScore, b.waveScore, winner.waveScore, other.waveScore] = [
    1000, 900, 80, 70,
  ];
  other.damage = 1e8;
  finish(s);
  assert.deepEqual(s.history[0].mvp, {
    id: winner.id,
    type: winner.type,
    x: 14,
    y: 12,
    level: 5,
    damage: 80,
  });
  assert.deepEqual(
    [a.mvpLevel, b.mvpLevel, winner.mvpLevel, other.mvpLevel],
    [10, 10, 5, 2],
  );
  tick(s);
  assert.equal(winner.mvpLevel, 5);
  begin(s);
  assert.ok(s.gems.every((g) => g.waveDamage === 0));
  assert.equal(other.damage, 1e8);
});
void test('MVP requires positive scores; positive ties use build order then ID', () => {
  const s = freshGame();
  const a = tower(s, basicId('D', 1), 12, 12),
    b = tower(s, basicId('D', 1), 13, 12);
  a.order = b.order = 100;
  s.gems.reverse();
  begin(s);
  finish(s);
  assert.equal(s.history[0].mvp, null);
  begin(s);
  a.waveScore = b.waveScore = 10;
  finish(s);
  assert.equal(s.history[1].mvp?.id, a.id);
  begin(s);
  b.order = 1;
  a.waveScore = b.waveScore = 10;
  finish(s);
  assert.equal(s.history[2].mvp?.id, b.id);
});
void test('no eligible tower means no MVP; final completed wave awards, defeat does not', () => {
  for (const capped of [false, true]) {
    const s = freshGame();
    if (capped) tower(s, basicId('D', 1), 12, 12, 10);
    begin(s);
    finish(s);
    assert.equal(s.history[0].mvp, null);
  }
  const s = freshGame(),
    g = tower(s);
  s.wave = 50;
  begin(s);
  g.waveScore = 55;
  finish(s);
  assert.equal(s.phase, 'won');
  assert.equal(g.mvpLevel, 1);
  const lost = freshGame(),
    losing = tower(lost);
  begin(lost);
  losing.waveScore = 100;
  lost.life = 0;
  finish(lost);
  assert.equal(lost.phase, 'lost');
  assert.equal(losing.mvpLevel, 0);
  assert.equal(lost.history.length, 0);
});
void test('level 9 promotes to a circular 290-unit aura covering twenty cells and retains own bonus', () => {
  const s = freshGame(),
    source = tower(s, basicId('D', 1), 17, 15, 9);
  begin(s);
  source.waveScore = 100;
  finish(s);
  assert.equal(source.mvpLevel, 10);
  assert.deepEqual(mvpBonus(s, source), {
    own: 100,
    aura: 0,
    auraCount: 0,
    total: 100,
  });
  let covered = 0;
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++) {
      if (!dx && !dy) continue;
      const expected = dx * dx + dy * dy <= 5 ? 100 : 0;
      assert.equal(
        mvpBonus(s, tower(s, basicId('D', 1), 17 + dx, 15 + dy)).total,
        expected,
      );
      if (expected) covered++;
    }
  assert.equal(covered, 20);
});
void test('multiple MVP auras and personal levels stack additively, including between full-level towers', () => {
  const s = freshGame(),
    recipient = tower(s, basicId('D', 1), 17, 15, 3);
  const a = tower(s, basicId('D', 1), 16, 15, 10),
    b = tower(s, basicId('D', 1), 16, 16, 10);
  tower(s, 'stone', 18, 16, 10);
  tower(s, basicId('D', 1), 18, 15, 10, true);
  tower(s, basicId('D', 1), 20, 15, 10);
  assert.deepEqual(mvpBonus(s, recipient), {
    own: 30,
    aura: 200,
    auraCount: 2,
    total: 230,
  });
  assert.equal(mvpBonus(s, a).total, 200);
  assert.equal(mvpBonus(s, b).total, 200);
});
void test('MVP increases mitigated physical damage once and statistics exclude overkill and immunity', () => {
  const { s, g, e } = arena(basicId('D', 1), 3);
  e.armor = 10;
  tick(s);
  close(g.waveDamage, (TOWERS[g.type].damage * 1.3) / 1.6);
  close(g.damage, g.waveDamage);
  const before = g.damage;
  e.physicalImmune = true;
  g.cooldown = 0;
  tick(s);
  assert.equal(g.damage, before);
  e.physicalImmune = false;
  e.hp = 0.5;
  g.cooldown = 0;
  tick(s);
  close(g.damage - before, 0.5);
});
void test('MVP affects pure splash once, including when the primary target is physically immune', () => {
  const { s, g, e } = arena(basicId('R', 1), 5);
  e.physicalImmune = true;
  e.magicImmune = true;
  tick(s);
  close(g.damage, TOWERS[g.type].damage * TOWERS[g.type].effects.splash * 1.5);
});
void test('stacked aura bonuses reach actual damage settlement as one additive MVP multiplier', () => {
  const { s, g } = arena(basicId('D', 1), 3);
  tower(s, basicId('D', 1), 16, 18, 10).cooldown = 999;
  tower(s, basicId('D', 1), 17, 17, 10).cooldown = 999;
  tick(s);
  close(g.waveDamage, TOWERS[g.type].damage * 3.3);
});
void test('MVP affects poison ticks and preserves magic immunity', () => {
  const { s, g, e } = arena(basicId('G', 1), 5);
  tick(s);
  assert.ok(e.poisons.length > 0);
  g.cooldown = 999;
  const poison = e.poisons[0];
  poison.nextTick = s.time;
  const before = g.damage;
  tick(s);
  close(g.damage - before, poison.damage * 1.35);
  e.magicImmune = true;
  poison.nextTick = s.time;
  const immuneBefore = g.damage;
  tick(s);
  assert.equal(g.damage, immuneBefore);
});
void test('fixed burn, lightning and fork gain magic reduction rather than the attack multiplier', () => {
  for (const effect of ['burn', 'lightning', 'fork'] as const) {
    const def = Object.values(TOWERS).find((t) => t.effects[effect] > 0)!;
    assert.ok(def);
    const original = def.effects[effect];
    if (effect !== 'burn') def.effects[effect] = 1;
    try {
      const plain = arena(def.id),
        boosted = arena(def.id, 3);
      tick(plain.s);
      tick(boosted.s);
      assert.ok(plain.g.damage > 0);
      if (effect !== 'burn')
        assert.ok(plain.g.damage >= (effect === 'lightning' ? 200 : 2500));
      const baseline = plain.s.damageReport!.rows.find(
        (r) => r.id === plain.g.id,
      )!;
      const enhanced = boosted.s.damageReport!.rows.find(
        (r) => r.id === boosted.g.id,
      )!;
      close(enhanced.physical, baseline.physical * 1.3);
      close(enhanced.magic, baseline.magic * 1.21);
    } finally {
      def.effects[effect] = original;
    }
  }
});
void test('MVP applies to every multishot target and records their combined actual damage', () => {
  const { s, g, e } = arena(basicId('Y', 1), 2);
  s.enemies.push(
    { ...structuredClone(e), id: s.nextId++, x: 18.1 },
    { ...structuredClone(e), id: s.nextId++, x: 18.2 },
  );
  tick(s);
  const expected = TOWERS[g.type].damage * 1.2;
  for (const enemy of s.enemies) close(1e9 - enemy.hp, expected);
  close(g.waveDamage, expected * 3);
});
void test('combat combination inherits chosen MVP levels but starts a new score and retains material report rows', () => {
  const { s, g: b, e } = arena(basicId('B', 1), 4);
  const y = tower(s, basicId('Y', 1), 16, 18, 4),
    d = tower(s, basicId('D', 1), 15, 18, 3),
    spare = tower(s, basicId('D', 1), 14, 18, 8);
  [b.waveDamage, y.waveDamage, d.waveDamage] = [20, 30, 40];
  [b.damage, y.damage, d.damage] = [100, 200, 300];
  [b.kills, y.kills, d.kills] = [1, 2, 3];
  b.cooldown = 0.7;
  e.poisons.push({ owner: d.id, damage: 2, nextTick: s.time, remaining: 2 });
  const path = s.path,
    cells = s.gems.map((g) => [g.x, g.y]);
  const clocks = [s.time, s.spawnClock, s.spawned];
  const recipe = RECIPES.find((r) => r.result === 'gemtd_baiyin')!;
  combine(s, recipe.id, b.id, [b.id, y.id, d.id]);
  assert.equal(b.mvpLevel, 10);
  assert.equal(b.waveDamage, 0);
  assert.equal(b.waveScore, 0);
  assert.equal(b.damage, 600);
  assert.equal(b.kills, 6);
  assert.equal(b.cooldown, 0.7);
  assert.equal(spare.mvpLevel, 8);
  assert.ok(
    [y, d].every(
      (g) =>
        g.type === 'stone' &&
        g.mvpLevel === 0 &&
        g.waveDamage === 0 &&
        g.damage === 0,
    ),
  );
  assert.equal(e.poisons[0].owner, d.id);
  assert.equal(e.poisons[0].sourceType, basicId('D', 1));
  assert.equal(s.path, path);
  assert.deepEqual(
    s.gems.map((g) => [g.x, g.y]),
    cells,
  );
  assert.deepEqual([s.time, s.spawnClock, s.spawned], clocks);
  tick(s);
  close(b.waveDamage, 0);
  close(s.damageReport!.rows.find((r) => r.id === d.id)!.magic, 2 * 1.7 * 1.56);
  assert.ok(
    s.damageReport!.rows.some(
      (r) => r.id === b.id && r.type === basicId('B', 1) && r.retired,
    ),
  );
  spare.waveScore = 1;
  finish(s);
  assert.equal(s.history[0].mvp?.id, spare.id);
  assert.equal(spare.mvpLevel, 9);
});
void test('invalid combinations do not transfer MVP; ordinary fusion inherits only consumed copies', () => {
  const s = freshGame();
  const a = tower(s, basicId('D', 1), 13, 12, 2, true),
    b = tower(s, basicId('D', 1), 14, 12, 3, true);
  tower(s, basicId('D', 1), 15, 12, 9, true);
  tower(s, basicId('B', 1), 16, 12, 1, true);
  tower(s, basicId('Y', 1), 17, 12, 1, true);
  s.placed = 5;
  const before = saveGame(s);
  assert.throws(() =>
    combine(s, RECIPES.find((r) => r.result === 'gemtd_baiyin')!.id, a.id, [
      a.id,
      b.id,
      b.id,
    ]),
  );
  assert.equal(saveGame(s), before);
  assert.equal(inheritedMvp(s, [a.id, b.id, b.id]), 5);
  fuse(s, a.id, 2);
  assert.equal(a.mvpLevel, 5);
  assert.ok(s.gems.filter((g) => g.id !== a.id).every((g) => g.mvpLevel === 0));
});
void test('MVP state, current-wave damage and next award survive a combat reload', () => {
  const { s, g } = arena(basicId('D', 1), 4);
  tick(s);
  const restored = loadGame(saveGame(s));
  restored.paused = false;
  assert.equal(
    restored.gems.find((x) => x.id === g.id)!.waveDamage,
    g.waveDamage,
  );
  for (let i = 0; i < 40; i++) {
    tick(s);
    tick(restored);
  }
  finish(s);
  finish(restored);
  assert.equal(saveGame(s), saveGame(restored));
  assert.equal(loadGame(saveGame(s)).history[0].mvp?.level, 5);
});
void test('legacy saves migrate explicitly; partial old combat waits until the next wave for MVP', () => {
  for (const combat of [false, true]) {
    const { s, g } = arena();
    if (!combat) {
      s.phase = 'prepare';
      s.enemies = [];
    }
    const old = JSON.parse(saveGame(s));
    old.version = LEGACY_DATA_VERSION;
    delete old.mvpStartWave;
    for (const gem of old.gems) {
      delete gem.mvpLevel;
      delete gem.waveDamage;
    }
    const migrated = loadGame(JSON.stringify(old));
    assert.equal(migrated.version, DATA_VERSION);
    assert.ok(
      migrated.gems.every((x) => x.mvpLevel === 0 && x.waveDamage === 0),
    );
    assert.equal(migrated.mvpStartWave, combat ? 2 : 1);
    migrated.paused = false;
    if (!combat) begin(migrated);
    migrated.gems.find((x) => x.id === g.id)!.waveScore = 10;
    finish(migrated);
    assert.equal(migrated.history[0].mvp?.id ?? null, combat ? null : g.id);
    if (combat) {
      begin(migrated);
      migrated.gems.find((x) => x.id === g.id)!.waveScore = 10;
      finish(migrated);
      assert.equal(migrated.history[1].mvp?.id, g.id);
    }
  }
});
void test('new saves reject invalid or missing MVP fields and forged award records', () => {
  const { s, g } = arena();
  for (const level of [-1, 11, 1.5, null, undefined]) {
    const bad = JSON.parse(saveGame(s));
    bad.gems.find((x: Gem) => x.id === g.id).mvpLevel = level;
    assert.throws(() => loadGame(JSON.stringify(bad)));
  }
  const bad = JSON.parse(saveGame(s));
  bad.gems.find((x: Gem) => x.id === g.id).waveDamage = -1;
  assert.throws(() => loadGame(JSON.stringify(bad)));
  g.waveScore = 1;
  finish(s);
  const badHistory = JSON.parse(saveGame(s));
  badHistory.history[0].mvp.level = 11;
  assert.throws(() => loadGame(JSON.stringify(badHistory)));
});
void test('legacy poison on consumed rocks does not create an invalid MVP save', () => {
  const { s, g, e } = arena(basicId('G', 1));
  g.type = 'stone';
  e.poisons.push({ owner: g.id, damage: 2, nextTick: s.time, remaining: 2 });
  const old = JSON.parse(saveGame(s));
  old.version = LEGACY_DATA_VERSION;
  delete old.mvpStartWave;
  for (const gem of old.gems) {
    delete gem.mvpLevel;
    delete gem.waveDamage;
  }
  const migrated = loadGame(JSON.stringify(old));
  migrated.paused = false;
  tick(migrated);
  assert.equal(migrated.gems.find((x) => x.id === g.id)!.waveDamage, 0);
  assert.doesNotThrow(() => loadGame(saveGame(migrated)));
});

void test('MVP magic auras deduplicate equal low levels, combine different levels and stack every level ten', () => {
  const { s, e } = arena(basicId('D', 1), 3);
  tower(s, basicId('D', 1), 18, 17, 3);
  tower(s, basicId('D', 1), 17, 19, 5);
  tower(s, basicId('D', 1), 18, 19, 5);
  tower(s, basicId('D', 1), 19, 17, 10);
  tower(s, basicId('D', 1), 19, 19, 10);
  tower(s, basicId('D', 1), 18, 20, 10, true);
  close(mvpMagicMultiplier(s, e), 1.21 * 1.35 * 1.7 * 1.7);
  e.magicImmune = true;
  assert.equal(mvpMagicMultiplier(s, e), 1);
  const boundary = arena(basicId('D', 1), 10);
  boundary.e.x = boundary.g.x + 6.25;
  close(mvpMagicMultiplier(boundary.s, boundary.e), 1.7);
  boundary.e.x += 0.001;
  assert.equal(mvpMagicMultiplier(boundary.s, boundary.e), 1);
});
void test('a fixed poison outside the MVP debuff range has no personal attack amplification', () => {
  const { s, g, e } = arena(basicId('G', 1), 10);
  g.x = 3;
  g.cooldown = 999;
  e.poisons.push({
    owner: g.id,
    sourceType: g.type,
    damage: 2,
    nextTick: s.time,
    remaining: 1,
  });
  tick(s);
  close(g.waveDamage, 2);
  close(s.damageReport!.rows[0].magic, 2);
});
void test('damage reports preserve fractional hits while original MVP scoring floors each hit separately', () => {
  const { s, g, e } = arena();
  e.armor = (TOWERS[g.type].damage / 0.9 - 1) / 0.06;
  tick(s);
  g.cooldown = 0;
  tick(s);
  close(g.waveDamage, 1.8);
  assert.equal(g.waveScore, 0);
  const report = s.damageReport!;
  close(report.rows[0].physical, 1.8);
  close(report.rows[0].total, 1.8);
  assert.equal(report.rows[0].score, 0);
  e.physicalImmune = true;
  g.cooldown = 0;
  tick(s);
  close(report.rows[0].total, 1.8);
  finish(s);
  assert.equal(s.history[0].mvp, null);
  const snapshot = JSON.stringify(s.history[0].damageReport);
  begin(s);
  tick(s);
  assert.equal(JSON.stringify(s.history[0].damageReport), snapshot);
  assert.notEqual(s.damageReport, report);
  assert.equal(s.damageReport!.rows[0].total, 0);
  assert.doesNotThrow(() => loadGame(saveGame(s)));
});
void test('fatal leaks preserve the current damage report without awarding MVP', () => {
  const { s, g, e } = arena();
  tick(s);
  assert.ok(g.waveDamage > 0);
  s.life = 1;
  e.routeIndex = s.path.length;
  tick(s);
  assert.equal(s.phase, 'lost');
  assert.equal(s.damageReport!.outcome, 'lost');
  assert.equal(s.damageReport!.mvp, null);
  assert.ok(loadGame(saveGame(s)).damageReport!.rows[0].total > 0);
});
void test('custom MVP saves retain levels, mark old damage unclassified and start original scoring next full wave', () => {
  const { s, g } = arena(basicId('D', 1), 6);
  tick(s);
  const old = JSON.parse(saveGame(s));
  old.version = CUSTOM_MVP_DATA_VERSION;
  delete old.damageReport;
  for (const gem of old.gems) delete gem.waveScore;
  const migrated = loadGame(JSON.stringify(old));
  const tower = migrated.gems.find((x) => x.id === g.id)!;
  assert.equal(tower.mvpLevel, 6);
  assert.equal(tower.waveScore, 0);
  assert.equal(migrated.damageReport!.complete, false);
  assert.equal(migrated.damageReport!.rows[0].unclassified, g.waveDamage);
  assert.equal(migrated.mvpStartWave, 2);
  migrated.paused = false;
  finish(migrated);
  assert.equal(migrated.history[0].mvp, null);
  begin(migrated);
  assert.equal(migrated.damageReport!.complete, true);
  assert.equal(migrated.damageReport!.rows[0].unclassified, 0);
  assert.doesNotThrow(() => loadGame(saveGame(migrated)));
});
void test('reports reject mismatched waves, missing combat reports, malformed numbers and forged MVP links', () => {
  const { s } = arena();
  tick(s);
  for (const edit of [
    (state: GameState) => {
      state.damageReport = null;
    },
    (state: GameState) => {
      state.damageReport!.wave = 2;
    },
    (state: GameState) => {
      state.phase = 'prepare';
    },
    (state: GameState) => {
      state.damageReport!.rows[0].magic = -1;
    },
    (state: GameState) => {
      state.damageReport!.rows[0].total += 1;
    },
  ]) {
    const bad = JSON.parse(saveGame(s));
    edit(bad);
    assert.throws(() => loadGame(JSON.stringify(bad)));
  }
  finish(s);
  assert.doesNotThrow(() => loadGame(saveGame(s)));
  const wrongWave = JSON.parse(saveGame(s));
  wrongWave.history[0].damageReport.wave = 2;
  assert.throws(() => loadGame(JSON.stringify(wrongWave)));
  const wrongAward = JSON.parse(saveGame(s));
  wrongAward.history[0].damageReport.mvp.damage += 1;
  assert.throws(() => loadGame(JSON.stringify(wrongAward)));
});
