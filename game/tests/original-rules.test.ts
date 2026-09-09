import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basicId, MOBILE_RULES, TOWERS, WAVES } from '../lib/game/data';
import {
  bossLeakDamage,
  freshGame,
  tick,
  startWave,
  waveInfo,
  type Gem,
  type GameState,
} from '../lib/game/engine';

// A stationary, high-health target isolates numerical combat rules from maze layout.
function arena(family: string, quality = 1) {
  const s = freshGame(42);
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
    speed: 0.001,
    armor: 0,
    resist: 0,
    stunUntil: 10000,
  });
  const g: Gem = {
    id: s.nextId++,
    type: basicId(family, quality),
    x: 17,
    y: 18,
    candidate: false,
    order: 100,
    cooldown: 0,
    burnClock: 0,
    damage: 0,
    waveDamage: 0,
    waveScore: 0,
    mvpLevel: 0,
    kills: 0,
  };
  s.gems.push(g);
  return { s, e, g };
}
function advance(s: GameState, seconds: number, step = 1 / 30) {
  for (let i = 0; i < Math.round(seconds / step); i++) tick(s, step);
}
void test('solo source scaling retains fractional movement instead of rounded HTML text', () => {
  assert.equal(WAVES[0].hp, 3);
  assert.equal(WAVES[0].speed * 128, 446.25);
  assert.equal(WAVES[1].speed * 128, 510);
  assert.deepEqual(
    WAVES[34].variants
      .map((v) => v.magicImmune)
      .sort((a, b) => Number(a) - Number(b)),
    [false, true],
  );
});
void test('source quality probabilities and experience thresholds', () => {
  assert.deepEqual(MOBILE_RULES.qualityXP, [0, 200, 550, 1050, 1700]);
  assert.deepEqual(MOBILE_RULES.qualityWeights[1], [80, 20, 0, 0, 0]);
  assert.deepEqual(MOBILE_RULES.qualityWeights[4], [10, 30, 30, 20, 10]);
  const { s, e } = arena('D');
  s.xp = 195;
  e.hp = 0.1;
  tick(s);
  assert.equal(s.xp, 200);
  assert.equal(s.quality, 1);
  assert.equal(s.gold, 5);
});
void test('boss damage depends on remaining health; ordinary leak ranges scale by decade', () => {
  assert.equal(bossLeakDamage(100, 100), 90);
  assert.equal(bossLeakDamage(50, 100), 50);
  assert.equal(bossLeakDamage(1, 100), 10);
  assert.deepEqual(
    [0, 10, 20, 30, 40].map((i) => WAVES[i].leak),
    [3, 7, 11, 15, 19],
  );
  const s = freshGame(17);
  s.wave = 10;
  s.resolved = true;
  startWave(s);
  tick(s);
  const e = s.enemies[0];
  e.hp = e.maxHp / 2;
  e.routeIndex = s.path.length;
  tick(s);
  assert.equal(s.life, 50);
});
void test('three fast perfect clears increase the next wave; leaks do not cancel remaining spawns', () => {
  const s = freshGame(12);
  for (let n = 0; n < 3; n++) {
    s.resolved = true;
    startWave(s);
    s.spawned = s.combatCount;
    tick(s);
  }
  assert.equal(s.normalCount, 6);
  assert.equal(waveInfo(s).count, 6);
  s.resolved = true;
  startWave(s);
  tick(s);
  s.enemies[0].routeIndex = s.path.length;
  tick(s);
  assert.equal(s.normalCount, 5);
  assert.equal(waveInfo(s).count, 6);
  advance(s, 6);
  assert.equal(s.spawned, 6);
});
void test('ruby splash is pure damage and also reaches the primary target', () => {
  const { s, e } = arena('R');
  e.physicalImmune = true;
  e.magicImmune = true;
  e.armor = 100;
  e.resist = 100;
  const other = { ...e, id: s.nextId++, x: 18.1, poisons: [] };
  s.enemies.push(other);
  tick(s);
  assert.ok(Math.abs(e.hp - (100000 - 1.2)) < 1e-8);
  assert.ok(Math.abs(other.hp - (100000 - 1.2)) < 1e-8);
});
void test('each emerald hit creates five poison ticks, including the final tick after the tower changes', () => {
  const { s, e, g } = arena('G');
  tick(s);
  advance(s, TOWERS[g.type].interval);
  assert.equal(e.poisons.length, 2);
  const remainingDamage = e.poisons.reduce(
    (n, p) => n + p.remaining * p.damage,
    0,
  );
  g.type = 'stone';
  const hp = e.hp;
  advance(s, 6);
  assert.ok(Math.abs(hp - e.hp - remainingDamage) < 1e-7);
  assert.equal(e.poisons.length, 0);
});
void test('slow and armor reduction last two seconds', () => {
  for (const family of ['B', 'P']) {
    const { s, e, g } = arena(family);
    tick(s);
    const status = e.debuffs?.find((d) => (family === 'B' ? d.slow : d.armor));
    assert.ok(status);
    assert.ok(Math.abs(status.until - s.time - 2) < 1e-8);
    g.type = 'stone';
    advance(s, 2.1);
    assert.equal(e.debuffs?.length, 0);
  }
});
void test('fast attacks preserve fractional cooldown at 30 and 60 simulation steps', () => {
  function damage(step: number) {
    const { s, g } = arena('Q', 6);
    advance(s, 10, step);
    return g.damage;
  }
  assert.equal(damage(1 / 30), damage(1 / 60));
});

void test('non-attacking burn towers do not bank attacks before a combination', () => {
  const { s, g } = arena('R');
  g.type = Object.values(TOWERS).find(
    (t) => t.effects.burn && t.damage === 0,
  )!.id;
  advance(s, 6);
  g.type = basicId('R', 1);
  tick(s);
  const attack = s.damageReport!.rows.find(
    (r) => r.id === g.id && r.type === g.type,
  )!;
  assert.ok(Math.abs(attack.physical + attack.pure - 5.2) < 1e-7);
  assert.ok(g.cooldown > 0);
});
