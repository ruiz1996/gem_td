import { BOARD } from './data';
import type { Point } from './engine';

export type InteractionPreference = 'auto' | 'touch' | 'desktop';
export const MAX_TOUCH_ZOOM = 12;
export function prefersTouch(
  preference: InteractionPreference,
  width: number,
  height: number,
  coarse: boolean,
) {
  if (preference !== 'auto') return preference === 'touch';
  return width <= 600 || (coarse && Math.min(width, height) <= 600);
}
export function boardGeometry(
  width: number,
  height: number,
  zoom: number,
  pan: Point,
) {
  const base = Math.max(
    1,
    Math.min((width - 40) / BOARD.width, (height - 40) / BOARD.height),
  );
  const cell = base * zoom;
  return {
    w: width,
    h: height,
    cell,
    left: (width - cell * BOARD.width) / 2 + pan.x,
    top: (height - cell * BOARD.height) / 2 + pan.y,
  };
}
export function touchZoom(width: number, height: number) {
  const { cell } = boardGeometry(width, height, 1, { x: 0, y: 0 });
  return Math.max(1, Math.min(MAX_TOUCH_ZOOM, 30 / cell));
}
export function focusPan(point: Point, cell: number) {
  return {
    x: (BOARD.width / 2 - point.x - 0.5) * cell,
    y: (BOARD.height / 2 - point.y - 0.5) * cell,
  };
}
export function nudgeCell(point: Point, dx: number, dy: number) {
  return {
    x: Math.max(0, Math.min(BOARD.width - 1, point.x + dx)),
    y: Math.max(0, Math.min(BOARD.height - 1, point.y + dy)),
  };
}
