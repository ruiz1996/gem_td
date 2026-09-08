import { test } from 'node:test';
import assert from 'node:assert/strict';
import original from '../data/original-facts.json';
import { basicId, WAVES } from '../lib/game/data';
import {
  freshGame,
  loadGame,
  saveGame,
  startWave,
  tick,
} from '../lib/game/engine';

void test('only the first Boss health differs from the archived solo base; spawn and rewards use the adjusted wave', () => {
  const units = original.units as Record<string, { hp: number }>;
  for (const wave of WAVES)
    assert.equal(wave.hp, wave.index === 10 ? 800 : units[wave.id].hp * 0.6);

  const s = freshGame(42);
  s.wave = 10;
  s.resolved = true;
  s.normalCount = 20;
  startWave(s);
  tick(s);
  assert.equal(s.combatCount, 1);
  const e = s.enemies[0];
  assert.deepEqual(
    [e.hp, e.maxHp, e.speed * 128, e.armor, e.resist, e.flying],
    [800, 800, 637.5, 0, 10, false],
  );
  Object.assign(e, { x: 18, y: 18, hp: 1, stunUntil: 100 });
  s.gems.push({
    id: s.nextId++,
    type: basicId('D', 1),
    x: 17,
    y: 18,
    candidate: false,
    order: s.nextId,
    cooldown: 0,
    burnClock: 0,
    damage: 0,
    waveDamage: 0,
    waveScore: 0,
    mvpLevel: 0,
    kills: 0,
  });
  tick(s);
  assert.equal(s.waveKills, 1);
  assert.equal(s.xp, 300);
  assert.equal(s.gold, 150);
});

void test('an old first Boss combat save preserves health percentage, damage records and leak damage after one conversion', () => {
  const s = freshGame(42);
  s.wave = 10;
  s.resolved = true;
  startWave(s);
  tick(s);
  Object.assign(s.enemies[0], { hp: 630, maxHp: 1260 });
  const before = structuredClone(s);
  const resumed = loadGame(saveGame(s));
  assert.deepEqual(resumed.enemies[0], {
    ...before.enemies[0],
    hp: 400,
    maxHp: 800,
  });
  assert.deepEqual(resumed.gems, before.gems);
  assert.deepEqual(resumed.history, before.history);
  assert.equal(resumed.rng, before.rng);
  assert.equal(resumed.time, before.time);
  const twice = loadGame(saveGame(resumed));
  assert.equal(twice.enemies[0].hp, 400);
  assert.equal(twice.enemies[0].maxHp, 800);

  twice.enemies[0].routeIndex = twice.path.length;
  twice.paused = false;
  tick(twice);
  assert.equal(twice.life, 50);
});

void test('new first Boss saves and later Boss health are not rescaled', () => {
  for (const [wave, hp, maxHp] of [
    [10, 200, 800],
    [20, 630, 1260],
  ]) {
    const s = freshGame(42);
    s.wave = wave;
    s.resolved = true;
    startWave(s);
    tick(s);
    Object.assign(s.enemies[0], { hp, maxHp });
    const resumed = loadGame(saveGame(s));
    assert.equal(resumed.enemies[0].hp, hp);
    assert.equal(resumed.enemies[0].maxHp, maxHp);
  }
});
