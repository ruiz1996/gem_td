import { BOARD, TOWERS, MVP_RULES } from './data';
import { isProtected, isReferenceRoad } from './map';
import type { GameState, Point } from './engine';
import { boardGeometry, focusPan, touchZoom } from './interaction';
import { attachBoardInput } from './board-input';
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
  touchMode: boolean;
  cursor: Point | null;
  focus: Point | null;
};
export async function createBoard(
  parent: HTMLElement,
  getView: () => BoardView,
  onCell: (x: number, y: number) => void,
  onZoom: (z: number) => void,
) {
  const Phaser = (await import('phaser')).default;
  let dead = false;
  const geometry = () => {
    const v = getView(),
      w = parent.clientWidth,
      h = parent.clientHeight,
      pan = { x: v.panX, y: v.panY };
    return boardGeometry(w, h, v.zoom, pan);
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
      if (
        x + size < 0 ||
        x - size > parent.clientWidth ||
        y + size < 0 ||
        y - size > parent.clientHeight
      )
        return;
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
      const camera = getView();
      if (camera.focus) {
        const pan = focusPan(camera.focus, geometry().cell);
        camera.panX = pan.x;
        camera.panY = pan.y;
        camera.focus = null;
      }
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
      // Zoomed phone views only need to paint the visible part of the grid.
      const minX = Math.max(0, Math.floor(-left / cell)),
        minY = Math.max(0, Math.floor(-top / cell)),
        maxX = Math.min(BOARD.width, Math.ceil((w - left) / cell)),
        maxY = Math.min(BOARD.height, Math.ceil((h - top) / cell));
      for (let y = minY; y < maxY; y++)
        for (let x = minX; x < maxX; x++) {
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
        if (!selected.candidate && selected.mvpLevel === MVP_RULES.maxLevel) {
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const x = selected.x + dx,
                y = selected.y + dy;
              if (
                (!dx && !dy) ||
                x < 0 ||
                y < 0 ||
                x >= BOARD.width ||
                y >= BOARD.height
              )
                continue;
              g.fillStyle(0xf7cf73, 0.22);
              g.fillRect(
                left + x * cell + 1,
                top + y * cell + 1,
                cell - 2,
                cell - 2,
              );
              g.lineStyle(1, 0xf7cf73, 0.65);
              g.strokeRect(
                left + x * cell + 1,
                top + y * cell + 1,
                cell - 2,
                cell - 2,
              );
            }
        }
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
          if (!gem.candidate && gem.mvpLevel > 0) {
            g.lineStyle(
              gem.mvpLevel === MVP_RULES.maxLevel ? 2 : 1,
              0xf7cf73,
              0.9,
            );
            g.strokeCircle(p.x, p.y, cell * 0.43);
            if (cell >= 22)
              this.label(
                'mvp' + gem.id,
                gem.mvpLevel === MVP_RULES.maxLevel
                  ? 'MVP★'
                  : `M${gem.mvpLevel}`,
                p.x,
                p.y - cell * 0.55,
                Math.max(9, cell * 0.25),
                '#f7cf73',
              );
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
      if (
        v.pending ||
        (v.touchMode && v.cursor && s.phase === 'prepare' && !s.resolved)
      ) {
        const p = xy(v.pending ?? v.cursor!);
        g.fillStyle(0x8ed6b8, 0.15);
        g.fillRect(
          p.x - cell * 0.48,
          p.y - cell * 0.48,
          cell * 0.96,
          cell * 0.96,
        );
        g.lineStyle(2, v.pending ? 0x9ff1cb : 0xf0b779);
        g.strokeRect(
          p.x - cell * 0.48,
          p.y - cell * 0.48,
          cell * 0.96,
          cell * 0.96,
        );
        this.label(
          'pending',
          v.pending ? '＋' : '·',
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
    // React and native Pointer Events own input; avoid a second touch-event consumer.
    input: { mouse: false, touch: false, keyboard: false },
    fps: { target: 60 },
    render: { roundPixels: false },
  });
  const observer = new ResizeObserver(() => {
    game.scale.resize(parent.clientWidth, parent.clientHeight);
    const v = getView();
    if (v.touchMode && v.zoom > 1) {
      v.zoom = touchZoom(parent.clientWidth, parent.clientHeight);
      v.focus = v.cursor ?? sSelected(v) ?? { x: 18, y: 18 };
      onZoom(v.zoom);
    }
    clampPan();
  });
  const sSelected = (v: BoardView) =>
    v.state.gems.find((g) => g.id === v.selected);
  observer.observe(parent);
  const detachInput = attachBoardInput(
    parent,
    getView,
    geometry,
    clampPan,
    onCell,
    onZoom,
  );
  return () => {
    dead = true;
    observer.disconnect();
    detachInput();
    game.destroy(true);
  };
}
