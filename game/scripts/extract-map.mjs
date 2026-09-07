import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const designerUrl = 'https://gem-td.digli.se/assets/index.5ae53414.js';
const fansiteUrl = 'https://gem-td.com/_nuxt/BtJupG5E.js';
const [designer, fansite] = await Promise.all(
  [designerUrl, fansiteUrl].map(async (url) => {
    const response = await fetch(url);
    if (!response.ok)
      throw new Error('Cannot read map source: ' + response.status);
    return response.text();
  }),
);
// Read literal factual configuration only; never execute remote JavaScript.
const solo = designer.match(/,__=\x60([\s\S]*?)\x60,t_=/)?.[1];
if (!solo) throw new Error('Designer solo format changed');
const rows = solo
  .replaceAll('\\r', '')
  .replaceAll('\\n', '\n')
  .split(/\r?\n/)
  .map((r) => r.trim().split(' ').join(''));
if (rows.length !== 37 || rows.some((r) => r.length !== 37))
  throw new Error('Unexpected dimensions');
const checkpoints = 'S12345E'.split('').map((mark) => {
  const y = rows.findIndex((row) => row.includes(mark));
  return [rows[y].indexOf(mark), y];
});
const stones = rows.flatMap((r, y) =>
  r.split('').flatMap((c, x) => (c === 'X' || c === 'O' ? [[x, y]] : [])),
);
const fanPoints = JSON.parse(
  fansite.match(/const l=(\[\[.*?\]\]),H=/)?.[1] ?? 'null',
).map(([y, x]) => [x, y]);
const fanStones = JSON.parse(
  fansite.match(/"1p":(\[\[.*?\]\]),"2p"/)?.[1] ?? 'null',
).map(([y, x]) => [x - 1, y - 1]);
const normalized = (a) =>
  JSON.stringify([...a].sort((a, b) => a[1] - b[1] || a[0] - b[0]));
if (
  JSON.stringify(checkpoints) !== JSON.stringify(fanPoints) ||
  normalized(stones) !== normalized(fanStones)
)
  throw new Error('Independent map sources disagree');
const result = {
  id: 'dota2-solo-37-v1',
  name: '经典单人地图',
  width: 37,
  height: 37,
  checkpoints,
  protectedZones: [
    { x: 0, y: 0, width: 9, height: 9 },
    { x: 28, y: 28, width: 9, height: 9 },
  ],
  initialStones: stones,
  referenceRows: rows,
  sources: [designerUrl, fansiteUrl].map((url, i) => ({
    url,
    sha256: createHash('sha256').update([designer, fansite][i]).digest('hex'),
  })),
  retrieved: '2026-09-07',
  evidence:
    'Two independent community planners agree on solo layout; not a direct Valve navigation mesh export.',
};
writeFileSync(
  new URL('../data/solo-map.json', import.meta.url),
  JSON.stringify(result, null, 2) + '\n',
);
console.log(
  'Verified 37×37, seven route points, ' +
    stones.length +
    ' initial stones against both sources.',
);
