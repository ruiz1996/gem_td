import { BOARD } from './map';
export type GridPoint = { x: number; y: number };

// Eight neighbours, with one open side required at a diagonal corner.
// Distances use 1 / sqrt(2); A*'s octile heuristic is admissible.
export function findPath(blocks: GridPoint[]): GridPoint[] | null {
  const width = BOARD.width,
    size = width * BOARD.height;
  const blocked = new Uint8Array(size);
  for (const p of blocks) blocked[p.y * width + p.x] = 1;
  const result: GridPoint[] = [];
  const directions = [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  for (let part = 0; part < BOARD.checkpoints.length - 1; part++) {
    const [sx, sy] = BOARD.checkpoints[part],
      [ex, ey] = BOARD.checkpoints[part + 1];
    const start = sy * width + sx,
      end = ey * width + ex;
    if (blocked[start] || blocked[end]) return null;
    const costs = new Float64Array(size).fill(Infinity);
    const prev = new Int32Array(size).fill(-1);
    const closed = new Uint8Array(size);
    const heap: { id: number; priority: number; serial: number }[] = [];
    let serial = 0;
    const less = (a: (typeof heap)[number], b: (typeof heap)[number]) =>
      a.priority < b.priority ||
      (a.priority === b.priority && a.serial < b.serial);
    const push = (id: number, cost: number) => {
      const dx = Math.abs((id % width) - ex),
        dy = Math.abs(Math.floor(id / width) - ey);
      const entry = {
        id,
        priority: cost + Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy),
        serial: serial++,
      };
      let i = heap.length;
      heap.push(entry);
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (!less(entry, heap[parent])) break;
        heap[i] = heap[parent];
        i = parent;
      }
      heap[i] = entry;
    };
    const pop = () => {
      const first = heap[0],
        last = heap.pop()!;
      if (heap.length) {
        let i = 0;
        while (i * 2 + 1 < heap.length) {
          let child = i * 2 + 1;
          if (child + 1 < heap.length && less(heap[child + 1], heap[child]))
            child++;
          if (!less(heap[child], last)) break;
          heap[i] = heap[child];
          i = child;
        }
        heap[i] = last;
      }
      return first.id;
    };
    costs[start] = 0;
    push(start, 0);
    while (heap.length) {
      const id = pop();
      if (closed[id]) continue;
      if (id === end) break;
      closed[id] = 1;
      const x = id % width,
        y = Math.floor(id / width);
      for (const [dx, dy] of directions) {
        const nx = x + dx,
          ny = y + dy,
          next = ny * width + nx;
        if (
          nx < 0 ||
          nx >= width ||
          ny < 0 ||
          ny >= BOARD.height ||
          blocked[next] ||
          closed[next]
        )
          continue;
        if (dx && dy && blocked[y * width + nx] && blocked[ny * width + x])
          continue;
        const cost = costs[id] + (dx && dy ? Math.SQRT2 : 1);
        if (cost >= costs[next] - 1e-10) continue;
        costs[next] = cost;
        prev[next] = id;
        push(next, cost);
      }
    }
    if (!Number.isFinite(costs[end])) return null;
    const segment: GridPoint[] = [];
    for (let id = end; id !== -1; id = prev[id])
      segment.push({ x: id % width, y: Math.floor(id / width) });
    segment.reverse();
    result.push(...(part ? segment.slice(1) : segment));
  }
  return result;
}
