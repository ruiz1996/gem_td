import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  prefersTouch,
  boardGeometry,
  focusPan,
  nudgeCell,
  touchZoom,
} from '../lib/game/interaction';
import { attachBoardInput } from '../lib/game/board-input';

void test('phone detection survives rotation and respects explicit desktop preference', () => {
  assert.equal(prefersTouch('auto', 390, 844, true), true);
  assert.equal(prefersTouch('auto', 844, 390, true), true);
  assert.equal(prefersTouch('auto', 1271, 920, true), false);
  assert.equal(prefersTouch('auto', 1000, 500, false), false);
  assert.equal(prefersTouch('desktop', 390, 844, true), false);
  assert.equal(prefersTouch('touch', 1600, 900, false), true);
});
void test('phone camera keeps editable cells at 30 pixels and centers selected cells', () => {
  for (const [width, height] of [
    [390, 414],
    [524, 266],
    [320, 288],
    [320, 140],
  ]) {
    const z = touchZoom(width, height),
      g = boardGeometry(width, height, z, { x: 0, y: 0 });
    assert.ok(Math.abs(g.cell - 30) < 1e-9);
    for (const point of [
      { x: 0, y: 0 },
      { x: 18, y: 18 },
      { x: 36, y: 36 },
    ]) {
      const pan = focusPan(point, g.cell),
        focused = boardGeometry(width, height, z, pan);
      assert.ok(
        Math.abs(focused.left + (point.x + 0.5) * focused.cell - width / 2) <
          1e-9,
      );
      assert.ok(
        Math.abs(focused.top + (point.y + 0.5) * focused.cell - height / 2) <
          1e-9,
      );
    }
  }
});
void test('direction controls move exactly one cell and stay on the board', () => {
  assert.deepEqual(nudgeCell({ x: 18, y: 18 }, -1, 0), { x: 17, y: 18 });
  assert.deepEqual(nudgeCell({ x: 0, y: 0 }, -1, -1), { x: 0, y: 0 });
  assert.deepEqual(nudgeCell({ x: 36, y: 36 }, 1, 1), { x: 36, y: 36 });
});
function inputFixture() {
  const captures = new Set<number>(),
    target = new EventTarget();
  const parent = Object.assign(target, {
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    setPointerCapture: (id: number) => captures.add(id),
    hasPointerCapture: (id: number) => captures.has(id),
    releasePointerCapture: (id: number) => captures.delete(id),
  }) as unknown as HTMLElement;
  const camera = { zoom: 3, panX: 0, panY: 0, touchMode: true },
    cells: number[][] = [];
  const geometry = () =>
    boardGeometry(390, 400, camera.zoom, { x: camera.panX, y: camera.panY });
  const detach = attachBoardInput(
    parent,
    () => camera,
    geometry,
    () => {},
    (x, y) => cells.push([x, y]),
    () => {},
  );
  function send(
    type: string,
    id: number,
    x: number,
    y: number,
    pointerType = 'touch',
  ) {
    parent.dispatchEvent(
      Object.assign(new Event(type), {
        pointerId: id,
        clientX: x,
        clientY: y,
        pointerType,
        button: 0,
      }),
    );
  }
  return { camera, cells, send, detach, geometry };
}
void test('a touch tap with finger jitter selects once; dragging pans without selecting', () => {
  const f = inputFixture();
  f.send('pointerdown', 1, 195, 200);
  f.send('pointermove', 1, 201, 203);
  f.send('pointerup', 1, 201, 203);
  f.send('pointerup', 1, 201, 203);
  assert.deepEqual(f.cells, [[18, 18]]);
  f.send('pointerdown', 2, 195, 200);
  f.send('pointermove', 2, 225, 220);
  f.send('pointerup', 2, 225, 220);
  assert.equal(f.cells.length, 1);
  assert.equal(f.camera.panX, 30);
  assert.equal(f.camera.panY, 20);
  f.detach();
});
void test('cancelled or lost pointer capture cannot place a gem on release', () => {
  for (const cancel of ['pointercancel', 'lostpointercapture']) {
    const f = inputFixture();
    f.send('pointerdown', 1, 195, 200);
    f.send(cancel, 1, 195, 200);
    f.send('pointerup', 1, 195, 200);
    assert.equal(f.cells.length, 0);
    f.detach();
  }
});
void test('pinch keeps the point under the fingers fixed and never ends as a tap', () => {
  const f = inputFixture(),
    before = f.geometry();
  const anchor = {
    x: (150 - before.left) / before.cell,
    y: (100 - before.top) / before.cell,
  };
  f.send('pointerdown', 1, 100, 100);
  f.send('pointerdown', 2, 200, 100);
  f.send('pointermove', 2, 300, 100);
  const after = f.geometry();
  assert.equal(f.camera.zoom, 6);
  assert.ok(Math.abs((200 - after.left) / after.cell - anchor.x) < 1e-9);
  assert.ok(Math.abs((100 - after.top) / after.cell - anchor.y) < 1e-9);
  f.send('pointerup', 2, 300, 100);
  f.send('pointermove', 1, 120, 120);
  f.send('pointerup', 1, 120, 120);
  assert.equal(f.cells.length, 0);
  f.send('pointerdown', 3, 195, 200);
  f.send('pointerup', 3, 195, 200);
  assert.equal(f.cells.length, 1);
  f.detach();
});
void test('destroying the board removes native input listeners', () => {
  const f = inputFixture();
  f.detach();
  f.send('pointerdown', 1, 195, 200);
  f.send('pointerup', 1, 195, 200);
  assert.equal(f.cells.length, 0);
});
