// Deterministic documentation figure: coordinates and paths use the real game map.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import sharpModule from 'sharp';
import { BOARD, isProtected, isWaypoint } from '../lib/game/map';
import { findPath, type GridPoint } from '../lib/game/pathfinding';

type Wall = GridPoint & { group: 'A' | 'B' | 'C' };
const walls: Wall[] = [];
for (let x = 0; x <= 16; x++) walls.push({ x, y: 17, group: 'A' });
for (let y = 19; y <= 36; y++) walls.push({ x: 19, y, group: 'B' });
for (let y = 0; y <= 16; y++) walls.push({ x: 20, y, group: 'C' });
for (let x = 22; x <= 36; x++) walls.push({ x, y: 16, group: 'C' });
const towers = [
  { x: 19, y: 18, text: '星', role: '星彩 / 火山', color: '#bd486b' },
  { x: 20, y: 18, text: '银', role: '白银 / 骑士', color: '#4b7895' },
  { x: 18, y: 17, text: '辅', role: '蛋白石 / 猫眼', color: '#917035' },
  { x: 18, y: 19, text: '减', role: '减甲 / 控制', color: '#775b9b' },
];
const blocks = [...BOARD.initialStones, ...walls, ...towers];
assert.equal(new Set(blocks.map((p) => `${p.x},${p.y}`)).size, blocks.length);
for (const p of [...walls, ...towers]) {
  assert.ok(!isProtected(p.x, p.y) && !isWaypoint(p.x, p.y));
}
const route =
  findPath(blocks) ?? assert.fail('All checkpoints must remain reachable');
const labels = ['S', '1', '2', '3', '4', '5', 'E'];
let start = 0;
const legs = BOARD.checkpoints.slice(1).map(([x, y], i) => {
  const end = route.findIndex((p, j) => j > start && p.x === x && p.y === y);
  assert.ok(end > start);
  const path = route.slice(start, end + 1);
  start = end;
  let length = 0,
    burnContactLength = 0;
  for (let j = 1; j < path.length; j++) {
    const p = path[j - 1],
      q = path[j],
      d = Math.hypot(q.x - p.x, q.y - p.y);
    length += d;
    for (let k = 0; k < 1000; k++) {
      const t = (k + 0.5) / 1000;
      if (
        Math.hypot(
          p.x + (q.x - p.x) * t - towers[0].x,
          p.y + (q.y - p.y) * t - towers[0].y,
        ) <=
        400 / 128
      )
        burnContactLength += d / 1000;
    }
  }
  assert.ok(
    burnContactLength > 0,
    `Leg ${i + 1} must enter Asteriated Ruby range`,
  );
  return { from: labels[i], to: labels[i + 1], length, burnContactLength };
});
const stages = ['A', 'AB', 'ABC'].map((groups) => {
  const stageWalls = walls.filter((w) => groups.includes(w.group));
  const path = findPath([...BOARD.initialStones, ...stageWalls, ...towers]);
  assert.ok(path);
  let first = 0;
  const contactedLegs: number[] = [];
  BOARD.checkpoints.slice(1).forEach(([x, y], i) => {
    const last = path.findIndex((p, j) => j > first && p.x === x && p.y === y);
    assert.ok(last > first);
    if (
      path
        .slice(first, last + 1)
        .some((p) => Math.hypot(p.x - 19, p.y - 18) <= 400 / 128)
    )
      contactedLegs.push(i + 1);
    first = last;
  });
  assert.equal(
    contactedLegs.length,
    groups === 'A' ? 3 : groups === 'AB' ? 4 : 6,
  );
  return {
    groups,
    newOccupancy: stageWalls.length + towers.length,
    minimumBuildRounds: Math.ceil((stageWalls.length + towers.length) / 5),
    contactedLegs,
  };
});
const dir = 'docs/images';
fs.mkdirSync(dir, { recursive: true });
const width = 1800,
  height = 1560,
  cell = 28,
  gx = 72,
  gy = 174;
const colors = { A: '#2c917c', B: '#5076b5', C: '#bd872e' };
const esc = (v: string) => v.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const out = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><pattern id="hatch" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M-3 3L3-3M0 12L12 0M9 15L15 9" stroke="#d1b676" stroke-width="1"/></pattern></defs>
<rect width="100%" height="100%" fill="#f6f5ef"/>
<g font-family="Microsoft YaHei, sans-serif" fill="#193348">`,
];
function text(
  x: number,
  y: number,
  value: string,
  size = 22,
  weight = 400,
  fill = '#193348',
  anchor = 'start',
) {
  out.push(
    `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(value)}</text>`,
  );
}
function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke = 'none',
  r = 0,
) {
  out.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`,
  );
}
text(72, 78, '单人迷宫建造图', 52, 700);
text(525, 76, '三进三出 · 基础完成版', 31, 600, '#43745e');
text(
  72,
  122,
  '当前网页版 37 × 37 地图  /  行列号从 1 开始  /  实际寻路已验证',
  23,
  400,
  '#586d79',
);
text(1154, 76, 'S → 1 → 2 → 3 → 4 → 5 → E', 26, 600);

const routeKeys = new Set(route.map((p) => `${p.x},${p.y}`));
function board(
  ox: number,
  oy: number,
  size: number,
  xmin: number,
  ymin: number,
  count: number,
  inset = false,
) {
  rect(ox, oy, count * size, count * size, '#fffefa', '#aebfc1');
  for (let y = ymin; y < ymin + count; y++)
    for (let x = xmin; x < xmin + count; x++) {
      const px = ox + (x - xmin) * size,
        py = oy + (y - ymin) * size;
      if (isProtected(x, y)) {
        rect(px, py, size, size, '#f1e8cb');
        rect(px, py, size, size, 'url(#hatch)');
      } else if (inset && routeKeys.has(`${x},${y}`))
        rect(px, py, size, size, '#d8f0ef');
      const original = BOARD.initialStones.some((p) => p.x === x && p.y === y);
      const wall = walls.find((p) => p.x === x && p.y === y);
      if (original || wall)
        rect(
          px + 2,
          py + 2,
          size - 4,
          size - 4,
          wall ? colors[wall.group] : '#79838c',
          'none',
          2,
        );
    }
  for (let n = 0; n <= count; n++) {
    out.push(
      `<path d="M${ox + n * size},${oy}v${count * size}M${ox},${oy + n * size}h${count * size}" fill="none" stroke="#c7d1d1" stroke-width="0.7"/>`,
    );
    if (n < count) {
      text(
        ox + (n + 0.5) * size,
        oy - 12,
        String(xmin + n + 1),
        inset ? 16 : 13,
        500,
        '#546977',
        'middle',
      );
      text(
        ox - 13,
        oy + (n + 0.5) * size + 5,
        String(ymin + n + 1),
        inset ? 16 : 13,
        500,
        '#546977',
        'end',
      );
    }
  }
  out.push(
    `<clipPath id="${inset ? 'detailClip' : 'mapClip'}"><rect x="${ox}" y="${oy}" width="${count * size}" height="${count * size}"/></clipPath><g clip-path="url(#${inset ? 'detailClip' : 'mapClip'})">`,
  );
  const px = (x: number) => ox + (x - xmin + 0.5) * size,
    py = (y: number) => oy + (y - ymin + 0.5) * size;
  out.push(
    `<path d="${route.map((p, i) => `${i ? 'L' : 'M'}${px(p.x)},${py(p.y)}`).join(' ')}" fill="none" stroke="#299bbb" stroke-width="${inset ? 4 : 2.4}" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>`,
  );
  if (!inset)
    out.push(
      `<circle cx="${px(19)}" cy="${py(18)}" r="${(size * 400) / 128}" fill="none" stroke="#bd486b" stroke-width="2" stroke-dasharray="7 5"/>`,
    );
  for (const t of towers) {
    const cx = px(t.x),
      cy = py(t.y),
      r = size * 0.43;
    out.push(
      `<path d="M${cx},${cy - r}L${cx + r},${cy}L${cx},${cy + r}L${cx - r},${cy}Z" fill="${t.color}" stroke="#fff" stroke-width="1.5"/>`,
    );
    text(
      cx,
      cy + (inset ? 8 : 5),
      t.text,
      inset ? 23 : 14,
      700,
      'white',
      'middle',
    );
  }
  if (inset) {
    const cx = px(21),
      cy = py(16);
    out.push(
      `<rect x="${cx - size / 2 + 3}" y="${cy - size / 2 + 3}" width="${size - 6}" height="${size - 6}" fill="none" stroke="#176557" stroke-width="3"/>`,
    );
    text(cx, cy + 7, '空', 22, 700, '#176557', 'middle');
  } else
    for (let i = 0; i < BOARD.checkpoints.length; i++) {
      const [x, y] = BOARD.checkpoints[i],
        cx = px(x),
        cy = py(y);
      out.push(
        `<circle cx="${cx}" cy="${cy}" r="14" fill="#163c53" stroke="white" stroke-width="2"/>`,
      );
      text(cx, cy + 6, labels[i], 17, 700, 'white', 'middle');
    }
  out.push('</g>');
}
board(gx, gy, cell, 0, 0, 37);
text(
  gx + 4.5 * cell,
  gy + 1.15 * cell,
  '出生禁建区',
  18,
  600,
  '#8d773f',
  'middle',
);
text(
  gx + 32.5 * cell,
  gy + 36 * cell,
  '终点禁建区',
  18,
  600,
  '#8d773f',
  'middle',
);
out.push(
  `<rect x="${gx + 16 * cell}" y="${gy + 14 * cell}" width="${8 * cell}" height="${8 * cell}" fill="none" stroke="#163c53" stroke-width="2" stroke-dasharray="6 5"/>`,
);
text(1154, 177, '核心区放大', 28, 700);
text(1154, 213, '蓝色通道留空，尤其是 22列 · 17行。', 20, 500, '#41677d');
board(1194, 255, 48, 16, 14, 8, true);
text(1154, 687, '示例塔位（占位相同，可按抽石替换）', 23, 600);
towers.forEach((t, i) => {
  rect(1154, 711 + i * 39, 27, 27, t.color, 'none', 5);
  text(1167.5, 732 + i * 39, t.text, 18, 700, 'white', 'middle');
  text(1195, 731 + i * 39, `${t.x + 1}列 ${t.y + 1}行  ·  ${t.role}`, 21);
});
text(1154, 917, '建造顺序与准确坐标', 28, 700);
function step(
  y: number,
  label: 'A' | 'B' | 'C',
  line1: string,
  line2: string,
  line3?: string,
) {
  rect(1154, y - 24, 40, 36, colors[label], 'none', 6);
  text(1174, y + 2, label, 24, 700, 'white', 'middle');
  text(1211, y, line1, 23, 600);
  text(1211, y + 34, line2, 21, 400, '#526977');
  if (line3) text(1211, y + 67, line3, 21, 600, '#8b6727');
}
step(971, 'A', '横墙：18行，1–17列', '共17格；先让出生怪绕向中心。');
step(1065, 'B', '竖墙：20列，20–37行', '共18格；A+B 形成四段核心接触。');
step(
  1161,
  'C',
  '竖墙：21列，1–17行',
  '横墙：17行，23–37列',
  '22列17行必须留空！共32格。',
);
text(1154, 1296, '原有32块灰石全部保留，不需要拆石。', 22, 600);
text(1154, 1336, '墙格可以是石头，也可以是保留的宝石。', 21);
text(1154, 1374, '先A、再B、最后C，不要求一波建成。', 21);
text(72, 1270, '读图', 25, 700);
const legend = [
  ['#79838c', '原有石头'],
  [colors.A, '新增A墙'],
  [colors.B, '新增B墙'],
  [colors.C, '新增C墙'],
  ['#299bbb', '地面路线（往返重合）'],
];
legend.forEach(([color, label], i) => {
  const x = 72 + (i % 3) * 352,
    y = 1300 + Math.floor(i / 3) * 47;
  rect(x, y, 24, 24, color, 'none', 3);
  text(x + 36, y + 20, label, 21);
});
text(72, 1432, '6段路线均进入星彩范围', 30, 700, '#43745e');
text(
  72,
  1472,
  '粉色虚线 = 星位星彩的灼烧范围；进入6次，不代表每次都横穿整个范围。',
  20,
  400,
  '#526977',
);
text(1154, 1430, '67个墙格 + 4个核心占位', 27, 700);
text(1154, 1471, '至少15轮建造；A+B与核心至少8轮。', 21);
out.push('<path d="M72 1500H1728" stroke="#c7d1d1"/>');
text(
  72,
  1533,
  '用于当前网页版的成型参考；不保证随机出石即可通关。飞行怪无视墙体。',
  20,
  400,
  '#526977',
);
text(1728, 1533, '2026-09-09  ·  GEM TD / SOLO', 17, 500, '#637986', 'end');
out.push('</g></svg>');
const svg = out.join('\n');
fs.writeFileSync(`${dir}/solo-maze-plan.svg`, svg);
// Keep the renderer interface limited to this offline drawing tool's two methods.
const sharp = sharpModule as (input: Buffer) => {
  png(): { toFile(path: string): Promise<unknown> };
};
await sharp(Buffer.from(svg)).png().toFile(`${dir}/solo-maze-plan.png`);
fs.writeFileSync(
  'docs/solo-maze-plan.json',
  JSON.stringify(
    {
      map: BOARD.id,
      coordinateBase: 0,
      initialStonesKept: BOARD.initialStones,
      walls,
      towers,
      newOccupancy: walls.length + towers.length,
      totalOccupancy: blocks.length,
      stages,
      legs,
      totalPathLength: legs.reduce((n, l) => n + l.length, 0),
      range: {
        tower: [19, 18],
        radius: 400 / 128,
        kind: 'Asteriated Ruby burn',
      },
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify(
    {
      image: `${dir}/solo-maze-plan.png`,
      newOccupancy: walls.length + towers.length,
      legs,
      stages,
    },
    null,
    2,
  ),
);
