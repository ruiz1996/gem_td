import solo from '../../data/solo-map.json';

export const BOARD = {
  ...solo,
  checkpoints: solo.checkpoints as [number, number][],
  initialStones: solo.initialStones.map(([x, y]) => ({ x, y })),
};

export function isProtected(x: number, y: number) {
  return BOARD.protectedZones.some(
    (z) => x >= z.x && x < z.x + z.width && y >= z.y && y < z.y + z.height,
  );
}

export function isWaypoint(x: number, y: number) {
  return BOARD.checkpoints.some((p) => p[0] === x && p[1] === y);
}

// Painted reference road is buildable. It is separate from the live creep path.
export function isReferenceRoad(x: number, y: number) {
  return 'pO12345'.includes(BOARD.referenceRows[y]?.[x] ?? ' ');
}
