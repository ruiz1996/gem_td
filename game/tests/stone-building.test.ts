import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canPlace,
  freshGame,
  keep,
  loadGame,
  place,
  removeStone,
  saveGame,
  startWave,
} from '../lib/game/engine';

void test('building over a preset rock matches removing and building, including the random roll and placement cost', () => {
  const direct = freshGame(42),
    separate = freshGame(42);
  const rock = direct.gems[0];
  const route = structuredClone(direct.path);
  const occupied = direct.gems.map((g) => `${g.x},${g.y}`).sort();
  assert.equal(canPlace(direct, rock.x, rock.y), null);
  const built = place(direct, rock.x, rock.y);
  removeStone(separate, rock.id);
  const expected = place(separate, rock.x, rock.y);
  assert.deepEqual(built, expected);
  assert.equal(saveGame(direct), saveGame(separate));
  assert.deepEqual(direct.path, route);
  assert.deepEqual(direct.gems.map((g) => `${g.x},${g.y}`).sort(), occupied);
  assert.equal(direct.placed, 1);
  assert.equal(
    direct.gems.some((g) => g.id === rock.id),
    false,
  );
  assert.equal(built.candidate, true);
  assert.equal(built.mvpLevel, 0);
  const restored = loadGame(saveGame(direct));
  assert.deepEqual(restored.gems, direct.gems);
  assert.equal(restored.placed, 1);
});

void test('replacement counts toward the five candidates and cannot overwrite a revealed gem or resolved round', () => {
  const s = freshGame(24),
    rocks = s.gems.slice(0, 6);
  const candidates = rocks.slice(0, 5).map((r) => place(s, r.x, r.y));
  assert.equal(s.placed, 5);
  let before = saveGame(s);
  assert.throws(() => place(s, rocks[5].x, rocks[5].y), /本轮放置已完成/);
  assert.equal(saveGame(s), before);
  keep(s, candidates[0].id);
  before = saveGame(s);
  assert.throws(() => place(s, candidates[1].x, candidates[1].y));
  assert.equal(saveGame(s), before);

  const fresh = freshGame(24),
    rock = fresh.gems[0];
  const candidate = place(fresh, rock.x, rock.y);
  before = saveGame(fresh);
  assert.throws(() => place(fresh, candidate.x, candidate.y), /已有宝石/);
  assert.equal(
    saveGame(fresh),
    before,
    'repeat clicks cannot reroll a revealed gem',
  );
});

void test('combat forbids rock replacement even while paused without consuming stone, rolls or placement count', () => {
  const s = freshGame(42),
    rocks = s.gems.slice(0, 6);
  const candidates = rocks.slice(0, 5).map((r) => place(s, r.x, r.y));
  keep(s, candidates[0].id);
  startWave(s);
  s.paused = true;
  const before = saveGame(s);
  assert.throws(() => place(s, rocks[5].x, rocks[5].y), /战斗中不能建造/);
  assert.equal(saveGame(s), before);
});

void test('stones left by a prior round can be built over as a fresh candidate', () => {
  const s = freshGame(42),
    rocks = s.gems.slice(0, 5);
  const candidates = rocks.map((r) => place(s, r.x, r.y));
  keep(s, candidates[0].id);
  // Isolate the next preparation without simulating unrelated enemy movement.
  s.wave = 2;
  s.placed = 0;
  s.resolved = false;
  const discarded = candidates[1];
  assert.equal(discarded.type, 'stone');
  const route = structuredClone(s.path);
  const built = place(s, discarded.x, discarded.y);
  assert.equal(s.placed, 1);
  assert.notEqual(built.id, discarded.id);
  assert.equal(built.candidate, true);
  assert.deepEqual(s.path, route);
});
