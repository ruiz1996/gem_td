import { BOARD } from './data';
import { MAX_TOUCH_ZOOM } from './interaction';
type Camera = { zoom: number; panX: number; panY: number; touchMode: boolean };
type Geometry = {
  w: number;
  h: number;
  cell: number;
  left: number;
  top: number;
};
// A single native Pointer Events owner handles mouse, pen and touch alike.
export function attachBoardInput(
  parent: HTMLElement,
  getCamera: () => Camera,
  geometry: () => Geometry,
  clampPan: () => void,
  onCell: (x: number, y: number) => void,
  onZoom: (zoom: number) => void,
) {
  const pointers = new Map<number, { x: number; y: number }>();
  let start = { x: 0, y: 0, panX: 0, panY: 0 };
  let dragged = false,
    pinching = false,
    pinchDistance = 1,
    pinchZoom = 1;
  let pinchAnchor = { x: 0, y: 0 };
  function anchorAt(clientX: number, clientY: number) {
    const rect = parent.getBoundingClientRect(),
      g = geometry();
    return {
      x: (clientX - rect.left - g.left) / g.cell,
      y: (clientY - rect.top - g.top) / g.cell,
    };
  }
  function zoomAt(
    zoom: number,
    clientX: number,
    clientY: number,
    anchor: { x: number; y: number },
  ) {
    const v = getCamera(),
      rect = parent.getBoundingClientRect();
    v.zoom = Math.max(1, Math.min(v.touchMode ? MAX_TOUCH_ZOOM : 3, zoom));
    const g = geometry();
    v.panX =
      clientX - rect.left - g.w / 2 - (anchor.x - BOARD.width / 2) * g.cell;
    v.panY =
      clientY - rect.top - g.h / 2 - (anchor.y - BOARD.height / 2) * g.cell;
    clampPan();
    onZoom(v.zoom);
  }
  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const v = getCamera();
    parent.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      start = { x: e.clientX, y: e.clientY, panX: v.panX, panY: v.panY };
      dragged = false;
      pinching = false;
    }
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      pinchDistance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      pinchZoom = v.zoom;
      pinchAnchor = anchorAt((a.x + b.x) / 2, (a.y + b.y) / 2);
      pinching = true;
      dragged = true;
    }
  };
  const move = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      zoomAt(
        (pinchZoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinchDistance,
        (a.x + b.x) / 2,
        (a.y + b.y) / 2,
        pinchAnchor,
      );
      return;
    }
    const dx = e.clientX - start.x,
      dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) > (e.pointerType === 'mouse' ? 6 : 12))
      dragged = true;
    const v = getCamera();
    if (dragged && !pinching && v.zoom > 1) {
      v.panX = start.panX + dx;
      v.panY = start.panY + dy;
      clampPan();
    }
  };
  const up = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (!dragged && !pinching) {
      const p = anchorAt(e.clientX, e.clientY);
      onCell(Math.floor(p.x), Math.floor(p.y));
    }
    if (parent.hasPointerCapture(e.pointerId))
      parent.releasePointerCapture(e.pointerId);
    if (!pointers.size) pinching = false;
  };
  const cancel = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    dragged = true;
    if (!pointers.size) pinching = false;
  };
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    zoomAt(
      getCamera().zoom + (e.deltaY > 0 ? -0.15 : 0.15),
      e.clientX,
      e.clientY,
      anchorAt(e.clientX, e.clientY),
    );
  };
  parent.addEventListener('pointerdown', down);
  parent.addEventListener('pointermove', move);
  parent.addEventListener('pointerup', up);
  parent.addEventListener('pointercancel', cancel);
  parent.addEventListener('lostpointercapture', cancel);
  parent.addEventListener('wheel', wheel, { passive: false });
  return () => {
    parent.removeEventListener('pointerdown', down);
    parent.removeEventListener('pointermove', move);
    parent.removeEventListener('pointerup', up);
    parent.removeEventListener('pointercancel', cancel);
    parent.removeEventListener('lostpointercapture', cancel);
    parent.removeEventListener('wheel', wheel);
    pointers.clear();
  };
}
