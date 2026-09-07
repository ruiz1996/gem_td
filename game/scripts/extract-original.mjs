// Extract factual configuration only; never execute the archived game scripts.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const commit = '712f6a2d0f68ea4049e8923917311f8d1a44dfc8';
const base = `https://raw.githubusercontent.com/clementbera/Website/${commit}/GemTD-Generation/scripts/`;
const files = {
  units: 'npc/npc_units_custom.txt',
  abilities: 'npc/npc_abilities_custom.txt',
  rules: 'vscripts/addon_game_mode.lua',
};
const expected = {
  units: '5859cd8ece129f3260a8f93a0496e4f2f29f1d5c8193abf1d98f843780fc3f89',
  abilities: 'f4fb21e311c6b6f2aa9a65541e9d2ab9fdca9c4f1d995ff1b151e29cf96ed6a8',
  rules: '6b99219b02c6d8b62f3725604451c8f82b23ed7da7e059158cfd2df625a13434',
};
const source = {},
  hashes = {};
mkdirSync('outputs/original', { recursive: true });
for (const [key, path] of Object.entries(files)) {
  const local = `outputs/original/${path.split('/').at(-1)}`;
  let text;
  try {
    text = readFileSync(local, 'utf8');
  } catch {
    const response = await fetch(base + path);
    if (!response.ok) throw new Error(`${response.status}: ${path}`);
    text = await response.text();
    writeFileSync(local, text);
  }
  source[key] = text;
  hashes[key] = createHash('sha256').update(text).digest('hex');
  if (hashes[key] !== expected[key])
    throw new Error(`Source hash mismatch: ${path}`);
}
function parseKV(text) {
  const tokens = text
    .match(/\/\/[^\n]*|"(?:\\.|[^"\\])*"|[{}]|[^\s{}"]+/g)
    .filter((t) => !t.startsWith('//'));
  let i = 0;
  const value = (t) => (t.startsWith('"') ? t.slice(1, -1) : t);
  function object(nested = false) {
    const out = {};
    while (i < tokens.length && tokens[i] !== '}') {
      const key = value(tokens[i++]);
      out[key] = tokens[i] === '{' ? (i++, object(true)) : value(tokens[i++]);
    }
    if (nested && tokens[i++] !== '}') throw new Error('Unbalanced KV');
    return out;
  }
  return object();
}
const units = parseKV(source.units).DOTAUnits;
const abilities = parseKV(source.abilities).DOTAAbilities;
const historical = JSON.parse(readFileSync('data/historical.json', 'utf8'));
const rows = Object.values(historical.pages).flatMap((p) => p.records);
const ids = [
  ...new Set(rows.map((r) => r.fields.Code?.[0]).filter((id) => units[id])),
];
for (const level of [35, 36, 38]) {
  const id =
    historical.pages.creeps.records.find((r) =>
      r.title.startsWith(`Level ${level} `),
    ).fields.Code[0] + '1';
  if (!units[id]) throw new Error(`Missing alternate unit: ${id}`);
  if (!ids.includes(id)) ids.push(id);
}
const stats = {};
for (const id of ids) {
  const u = units[id];
  stats[id] = {
    damage: (Number(u.AttackDamageMin) + Number(u.AttackDamageMax)) / 2,
    interval: Number(u.AttackRate || 1),
    range: Number(u.AttackRange || 0),
    hp: Number(u.StatusHealth),
    speed: Number(u.MovementSpeed),
    armor: Number(u.ArmorPhysical),
    resist: Number(u.MagicalResistance),
    ancient: u.IsAncient === '1',
    abilities: Object.entries(u)
      .filter(([k, v]) => /^Ability\d+$/.test(k) && v)
      .map(([, v]) => v),
  };
}
const numericAbilities = {};
for (const id of new Set(Object.values(stats).flatMap((s) => s.abilities))) {
  if (!abilities[id]) continue;
  const values = {};
  function walk(o, prefix = '') {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'object') walk(v, `${prefix}${k}.`);
      else if (/^-?\d+(\.\d+)?( +-?\d+(\.\d+)?)*$/.test(v))
        values[prefix + k] = v;
    }
  }
  walk(abilities[id]);
  numericAbilities[id] = values;
}
writeFileSync(
  'data/original-facts.json',
  JSON.stringify(
    {
      commit,
      date: '2018-06-10',
      base,
      hashes,
      units: stats,
      numericAbilities,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Extracted ${ids.length} unit records and ${Object.keys(numericAbilities).length} ability fact records.`,
);
