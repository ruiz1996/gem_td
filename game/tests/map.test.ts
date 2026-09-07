import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD, isProtected } from '../lib/game/map';
import { DATA_VERSION } from '../lib/game/data';
import {
  freshGame,
  canPlace,
  place,
  removeStone,
  findPath,
  saveGame,
  loadGame,
  startWave,
  tick,
  distance,
} from '../lib/game/engine';

void test('solo layout and starting stones match independently verified source coordinates', () => {
  assert.deepEqual([BOARD.width, BOARD.height], [37, 37]);
  assert.deepEqual(BOARD.checkpoints, [
    [4, 4],
    [4, 18],
    [32, 18],
    [32, 4],
    [18, 4],
    [18, 32],
    [32, 32],
  ]);
  const s = freshGame(42);
  assert.equal(s.gems.length, 32);
  assert.equal(s.placed, 0);
  assert.equal(s.nextId, 33);
  assert.ok(s.gems.every((g) => g.type === 'stone' && !g.candidate));
  assert.equal(new Set(s.gems.map((g) => g.x + ',' + g.y)).size, 32);
  assert.equal(s.gems.filter((g) => g.x === 18).length, 16);
  assert.equal(s.gems.filter((g) => g.y === 18).length, 16);
  assert.deepEqual(s.path, findPath(s.gems));
});

void test('blank solo path has the six source lengths, with diagonal distance preserved', () => {
  const { path } = freshGame(42);
  let offset = 0;
  const lengths: number[] = [];
  for (const [x, y] of BOARD.checkpoints.slice(1)) {
    const end = path.findIndex((p, i) => i > offset && p.x === x && p.y === y);
    assert.ok(end > offset);
    let length = 0;
    for (let i = offset + 1; i <= end; i++)
      length += distance(path[i - 1], path[i]);
    lengths.push(length);
    offset = end;
  }
  const expected = [14, 26 + 2 * Math.SQRT2, 14, 14, 26 + 2 * Math.SQRT2, 14];
  lengths.forEach((l, i) => assert.ok(Math.abs(l - expected[i]) < 1e-8));
  assert.deepEqual(lengths.map(Math.round), [14, 29, 14, 14, 29, 14]);
});

void test('both 9x9 zones and all checkpoints reject placement without consuming a candidate', () => {
  const s = freshGame(42),
    before = saveGame(s);
  let protectedCount = 0;
  for (let y = 0; y < 37; y++)
    for (let x = 0; x < 37; x++)
      if (isProtected(x, y)) {
        protectedCount++;
        assert.throws(() => place(s, x, y), /出生区和终点区/);
      }
  assert.equal(protectedCount, 162);
  for (const [x, y] of BOARD.checkpoints) assert.ok(canPlace(s, x, y));
  assert.equal(saveGame(s), before);
  assert.equal(canPlace(s, 18, 18), null, 'central green road is buildable');
  place(s, 18, 18);
  assert.ok(s.path.length);
});

void test('preset stones can be removed only in preparation and remain removed after reload', () => {
  const s = freshGame(42),
    rock = s.gems.find((g) => g.x === 18 && g.y === 5)!;
  removeStone(s, rock.id);
  assert.equal(canPlace(s, 18, 5), null);
  assert.equal(s.placed, 0);
  const restored = loadGame(saveGame(s));
  assert.equal(restored.gems.length, 31);
  assert.ok(!restored.gems.some((g) => g.id === rock.id));
  s.resolved = true;
  startWave(s);
  s.paused = true;
  const before = saveGame(s);
  assert.throws(() => removeStone(s, s.gems[0].id));
  assert.equal(saveGame(s), before);
});

void test('diagonal movement slides past one stone but cannot squeeze between two stones', () => {
  // Cardinal neighbours surround waypoint 1: diagonals must not escape through their corners.
  assert.equal(
    findPath([
      { x: 3, y: 18 },
      { x: 5, y: 18 },
      { x: 4, y: 17 },
      { x: 4, y: 19 },
    ]),
    null,
  );
  const s = freshGame(42),
    occupied = new Set(s.gems.map((g) => g.x + ',' + g.y));
  let diagonalCount = 0;
  for (let i = 1; i < s.path.length; i++) {
    const a = s.path[i - 1],
      b = s.path[i];
    const dx = Math.abs(a.x - b.x),
      dy = Math.abs(a.y - b.y);
    assert.ok(dx <= 1 && dy <= 1 && dx + dy > 0);
    assert.ok(!occupied.has(b.x + ',' + b.y));
    if (dx && dy) {
      diagonalCount++;
      assert.ok(
        !(occupied.has(a.x + ',' + b.y) && occupied.has(b.x + ',' + a.y)),
      );
    }
  }
  assert.ok(diagonalCount > 0);
});

void test('new-map combat resumes deterministically and old map saves are rejected', () => {
  const a = freshGame(17);
  a.resolved = true;
  startWave(a);
  for (let i = 0; i < 75; i++) tick(a);
  const b = loadGame(saveGame(a));
  b.paused = false;
  for (let i = 0; i < 150; i++) {
    tick(a);
    tick(b);
  }
  assert.equal(saveGame(a), saveGame(b));
  assert.equal(a.version, DATA_VERSION);
  assert.throws(
    () =>
      loadGame(
        JSON.stringify({ ...a, version: '2018-snapshot-mobile-alpha-1' }),
      ),
    /版本不兼容/,
  );
  const invalid = freshGame(1);
  invalid.gems[0].x = 0;
  invalid.gems[0].y = 0;
  assert.throws(() => loadGame(saveGame(invalid)), /宝石数据异常/);
});
