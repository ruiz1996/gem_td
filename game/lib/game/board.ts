import { BOARD, TOWERS } from './data';
import { isProtected, isReferenceRoad } from './map';
import type { GameState, Point } from './engine';
export type BoardView = {
  state: GameState;
  selected: number | null;
  pending: Point | null;
  materials: number[];
  anchor: number | null;
  candidateIds: number[];
  showPath: boolean;
  zoom: number;
  panX: number;
  panY: number;
};
export async function createBoard(
  parent: HTMLElement,
  getView: () => BoardView,
  onCell: (x: number, y: number) => void,
  onZoom: (z: number) => void,
) {
  const Phaser = (await import('phaser')).default;
  let dead = false;
  const pointers = new Map<number, { x: number; y: number }>();
  let start = { x: 0, y: 0, panX: 0, panY: 0 };
  let dragged = false;
  let pinching = false;
  let pinchDistance = 0;
  let pinchZoom = 1;
  const geometry = () => {
    const v = getView(),
      w = parent.clientWidth,
      h = parent.clientHeight,
      base = Math.min((w - 40) / BOARD.width, (h - 40) / BOARD.height),
      cell = base * v.zoom;
    return {
      w,
      h,
      cell,
      left: (w - cell * BOARD.width) / 2 + v.panX,
      top: (h - cell * BOARD.height) / 2 + v.panY,
    };
  };
  const clampPan = () => {
    const v = getView(),
      g = geometry(),
      maxX = Math.max(0, (g.cell * BOARD.width - g.w) / 2 + 50),
      maxY = Math.max(0, (g.cell * BOARD.height - g.h) / 2 + 50);
    v.panX = Math.max(-maxX, Math.min(maxX, v.panX));
    v.panY = Math.max(-maxY, Math.min(maxY, v.panY));
  };
  class BoardScene extends Phaser.Scene {
    graphics!: InstanceType<typeof Phaser.GameObjects.Graphics>;
    labels = new Map<string, InstanceType<typeof Phaser.GameObjects.Text>>();
    create() {
      this.graphics = this.add.graphics();
    }
    label(
      key: string,
      value: string,
      x: number,
      y: number,
      size: number,
      color: string,
    ) {
      let text = this.labels.get(key);
      if (!text) {
        text = this.add.text(x, y, value, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: size,
          color,
        });
        text.setOrigin(0.5);
        this.labels.set(key, text);
      }
      text
        .setVisible(true)
        .setPosition(x, y)
        .setText(value)
        .setFontSize(size)
        .setColor(color);
    }
    update() {
      if (dead) return;
      const v = getView(),
        s = v.state,
        g = this.graphics,
        { w, h, cell, left, top } = geometry();
      g.clear();
      for (const t of this.labels.values()) t.setVisible(false);
      const xy = (p: Point) => ({
        x: left + (p.x + 0.5) * cell,
        y: top + (p.y + 0.5) * cell,
      });
      g.fillStyle(0x0d1723);
      g.fillRect(0, 0, w, h);
      for (let y = 0; y < BOARD.height; y++)
        for (let x = 0; x < BOARD.width; x++) {
          g.fillStyle(
            isProtected(x, y)
              ? 0x3d3927
              : isReferenceRoad(x, y)
                ? 0x305045
                : (x + y) % 2
                  ? 0x242b28
                  : 0x28312c,
          );
          g.fillRect(
            left + x * cell + 1,
            top + y * cell + 1,
            cell - 2,
            cell - 2,
          );
        }
      // Reference terrain stays visible when the live route is hidden.
      for (const zone of BOARD.protectedZones) {
        g.lineStyle(1, 0xbba66a, 0.65);
        g.strokeRect(
          left + zone.x * cell,
          top + zone.y * cell,
          zone.width * cell,
          zone.height * cell,
        );
      }
      for (let n = 0; n < BOARD.width; n += 4) {
        this.label(
          'axis-x' + n,
          String(n + 1),
          left + (n + 0.5) * cell,
          top - 10,
          9,
          '#77877c',
        );
        this.label(
          'axis-y' + n,
          String(n + 1),
          left - 12,
          top + (n + 0.5) * cell,
          9,
          '#77877c',
        );
      }
      const selected = s.gems.find((x) => x.id === v.selected),
        tower = selected && TOWERS[selected.type];
      if (selected && tower) {
        const p = xy(selected);
        g.fillStyle(parseInt(tower.color.slice(1), 16), 0.035);
        g.fillCircle(p.x, p.y, tower.range * cell);
        g.lineStyle(1, parseInt(tower.color.slice(1), 16), 0.3);
        g.strokeCircle(p.x, p.y, tower.range * cell);
      }
      if (v.showPath && s.path.length) {
        g.lineStyle(Math.max(1, cell * 0.06), 0x6aa29b, 0.5);
        g.beginPath();
        s.path.forEach((p, i) => {
          const z = xy(p);
          if (i === 0) g.moveTo(z.x, z.y);
          else g.lineTo(z.x, z.y);
        });
        g.strokePath();
        for (let i = 3; i < s.path.length; i += 5) {
          const p = xy(s.path[i]);
          const prev = xy(s.path[i - 1]);
          const angle = Math.atan2(p.y - prev.y, p.x - prev.x),
            radius = Math.max(2, cell * 0.16);
          g.fillStyle(0x90cbbd, 0.65);
          g.fillTriangle(
            p.x + Math.cos(angle) * radius,
            p.y + Math.sin(angle) * radius,
            p.x + Math.cos(angle + 2.5) * radius,
            p.y + Math.sin(angle + 2.5) * radius,
            p.x + Math.cos(angle - 2.5) * radius,
            p.y + Math.sin(angle - 2.5) * radius,
          );
        }
      }
      BOARD.checkpoints.forEach((p, i) => {
        const z = xy({ x: p[0], y: p[1] });
        g.fillStyle(i === BOARD.checkpoints.length - 1 ? 0x715d36 : 0x254d4b);
        g.fillRoundedRect(
          z.x - cell * 0.44,
          z.y - cell * 0.44,
          cell * 0.88,
          cell * 0.88,
          cell * 0.15,
        );
        g.lineStyle(
          1,
          i === BOARD.checkpoints.length - 1 ? 0xd1b677 : 0x7ccfb0,
          0.8,
        );
        g.strokeRoundedRect(
          z.x - cell * 0.44,
          z.y - cell * 0.44,
          cell * 0.88,
          cell * 0.88,
          cell * 0.15,
        );
        this.label(
          'cp' + i,
          i === 0
            ? '入'
            : i === BOARD.checkpoints.length - 1
              ? '终'
              : String(i),
          z.x,
          z.y,
          Math.max(12, cell * 0.42),
          '#b9dccb',
        );
      });
      for (const gem of s.gems) {
        const p = xy(gem),
          t = TOWERS[gem.type],
          size = cell * 0.32;
        const selected = gem.id === v.selected,
          material = v.materials.indexOf(gem.id),
          candidate = v.candidateIds.includes(gem.id);
        if (selected || material >= 0 || candidate) {
          g.lineStyle(
            material >= 0 ? 2 : 1,
            gem.id === v.anchor
              ? 0xf4d28f
              : material >= 0
                ? 0xf4afc3
                : 0x89e1c2,
            candidate ? 0.6 : 1,
          );
          g.strokeRoundedRect(
            p.x - cell * 0.46,
            p.y - cell * 0.46,
            cell * 0.92,
            cell * 0.92,
            3,
          );
        }
        if (!t) {
          g.fillStyle(0x354350);
          g.fillRoundedRect(
            p.x - size,
            p.y - size,
            size * 2,
            size * 2,
            cell * 0.12,
          );
          g.lineStyle(1, 0x5b6b78, 0.5);
          g.strokeRoundedRect(
            p.x - size,
            p.y - size,
            size * 2,
            size * 2,
            cell * 0.12,
          );
        } else {
          const col = parseInt(t.color.slice(1), 16);
          g.fillStyle(col, 0.08);
          g.fillCircle(p.x, p.y, size * 1.5);
          g.fillStyle(col, 0.85);
          g.fillTriangle(p.x, p.y - size, p.x - size, p.y, p.x, p.y + size);
          g.fillStyle(col, 0.55);
          g.fillTriangle(p.x, p.y - size, p.x + size, p.y, p.x, p.y + size);
          g.lineStyle(1, col, 1);
          g.strokePoints(
            [
              { x: p.x, y: p.y - size },
              { x: p.x + size, y: p.y },
              { x: p.x, y: p.y + size },
              { x: p.x - size, y: p.y },
            ],
            true,
          );
          const label = t.quality
            ? `${t.family}${t.quality}`
            : t.name.slice(0, 2);
          this.label(
            'gem' + gem.id,
            label,
            p.x,
            p.y + cell * 0.33,
            Math.max(11, cell * 0.29),
            '#eaf1fa',
          );
          if (gem.candidate) {
            g.fillStyle(0xf9d990);
            g.fillCircle(p.x + size, p.y - size, Math.max(2, cell * 0.07));
          }
        }
        if (material >= 0)
          this.label(
            'mat' + gem.id,
            gem.id === v.anchor ? '成品' : String(material + 1),
            p.x,
            p.y - cell * 0.5,
            Math.max(12, cell * 0.31),
            '#ffe6b7',
          );
      }
      if (v.pending) {
        const p = xy(v.pending);
        g.fillStyle(0x8ed6b8, 0.15);
        g.fillRect(
          p.x - cell * 0.48,
          p.y - cell * 0.48,
          cell * 0.96,
          cell * 0.96,
        );
        g.lineStyle(2, 0x9ff1cb);
        g.strokeRect(
          p.x - cell * 0.48,
          p.y - cell * 0.48,
          cell * 0.96,
          cell * 0.96,
        );
        this.label(
          'pending',
          '＋',
          p.x,
          p.y,
          Math.max(16, cell * 0.7),
          '#c8ffe3',
        );
      }
      for (const e of s.enemies) {
        const p = xy(e),
          r = cell * (e.maxHp > 1000 ? 0.27 : 0.21),
          color = e.flying ? 0xf0b779 : e.invisible ? 0xbea1ed : 0xe78b8f;
        g.fillStyle(color, e.invisible ? 0.55 : 1);
        if (e.flying) {
          g.fillTriangle(
            p.x + r * 1.3,
            p.y,
            p.x - r,
            p.y - r,
            p.x - r,
            p.y + r,
          );
        } else g.fillCircle(p.x, p.y, r);
        g.fillStyle(0x060d15);
        g.fillRect(p.x - cell * 0.3, p.y - r - 6, cell * 0.6, 3);
        g.fillStyle(0x9fe2b6);
        g.fillRect(
          p.x - cell * 0.3,
          p.y - r - 6,
          (cell * 0.6 * e.hp) / e.maxHp,
          3,
        );
      }
      for (const shot of s.shots) {
        const a = xy(shot.from),
          b = xy(shot.to),
          c = parseInt(shot.color.slice(1), 16);
        if (shot.kind === 'kill') {
          g.lineStyle(1, c, shot.life / 0.3);
          g.strokeCircle(b.x, b.y, cell * (0.6 - shot.life));
        } else {
          g.lineStyle(Math.max(1, cell * 0.035), c, shot.life / 0.16);
          g.lineBetween(a.x, a.y, b.x, b.y);
        }
      }
      g.lineStyle(1, 0x3a5363, 0.6);
      g.strokeRect(left, top, cell * BOARD.width, cell * BOARD.height);
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: parent.clientWidth,
    height: parent.clientHeight,
    backgroundColor: '#0d1723',
    antialias: true,
    scene: BoardScene,
    banner: false,
    audio: { noAudio: true },
    fps: { target: 60 },
    render: { roundPixels: false },
  });
  const observer = new ResizeObserver(() => {
    game.scale.resize(parent.clientWidth, parent.clientHeight);
    clampPan();
  });
  observer.observe(parent);
  const down = (e: PointerEvent) => {
    const v = getView();
    parent.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      start = { x: e.clientX, y: e.clientY, panX: v.panX, panY: v.panY };
      dragged = false;
      pinching = false;
    }
    if (pointers.size === 2) {
      const p = [...pointers.values()];
      pinchDistance = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      pinchZoom = v.zoom;
      pinching = true;
      dragged = true;
    }
  };
  const move = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const v = getView();
    if (pointers.size === 2) {
      const p = [...pointers.values()];
      v.zoom = Math.max(
        1,
        Math.min(
          3,
          (pinchZoom * Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)) /
            Math.max(1, pinchDistance),
        ),
      );
      onZoom(v.zoom);
      clampPan();
      return;
    }
    const dx = e.clientX - start.x,
      dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) > 8) dragged = true;
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
      const rect = parent.getBoundingClientRect(),
        g = geometry();
      onCell(
        Math.floor((e.clientX - rect.left - g.left) / g.cell),
        Math.floor((e.clientY - rect.top - g.top) / g.cell),
      );
    }
    if (!pointers.size) pinching = false;
  };
  const cancel = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    dragged = true;
  };
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    const v = getView();
    v.zoom = Math.max(1, Math.min(3, v.zoom + (e.deltaY > 0 ? -0.15 : 0.15)));
    onZoom(v.zoom);
    clampPan();
  };
  parent.addEventListener('pointerdown', down);
  parent.addEventListener('pointermove', move);
  parent.addEventListener('pointerup', up);
  parent.addEventListener('pointercancel', cancel);
  parent.addEventListener('wheel', wheel, { passive: false });
  return () => {
    dead = true;
    observer.disconnect();
    parent.removeEventListener('pointerdown', down);
    parent.removeEventListener('pointermove', move);
    parent.removeEventListener('pointerup', up);
    parent.removeEventListener('pointercancel', cancel);
    parent.removeEventListener('wheel', wheel);
    game.destroy(true);
  };
}
