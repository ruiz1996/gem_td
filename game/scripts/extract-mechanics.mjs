// Extract identifiers and numeric facts; never execute third-party Lua.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const facts = JSON.parse(fs.readFileSync('data/original-facts.json', 'utf8'));
const read = (file, key) => {
  const text = fs.readFileSync(`outputs/original/${file}`, 'utf8');
  assert.equal(
    crypto.createHash('sha256').update(text).digest('hex'),
    facts.hashes[key],
  );
  return text;
};
function parse(text) {
  const tokens = text
    .match(/\/\/[^\n]*|"(?:\\.|[^"\\])*"|[{}]|[^\s{}"]+/g)
    .filter((t) => !t.startsWith('//'));
  let i = 0;
  const value = (t) => (t.startsWith('"') ? t.slice(1, -1) : t);
  function object() {
    const out = {};
    while (i < tokens.length && tokens[i] !== '}') {
      const key = value(tokens[i++]);
      if (tokens[i] === '{') {
        i++;
        out[key] = object();
        i++;
      } else out[key] = value(tokens[i++]);
    }
    return out;
  }
  return object();
}
const lua = read('addon_game_mode.lua', 'rules');
const units = parse(read('npc_units_custom.txt', 'units')).DOTAUnits;
const abilities = parse(
  read('npc_abilities_custom.txt', 'abilities'),
).DOTAAbilities;
function table(name) {
  const start = lua.indexOf(`().${name} = {`);
  assert(start >= 0, name);
  return lua.slice(lua.indexOf('{', start) + 1, lua.indexOf('\n\t}', start));
}
const ids = (text) => [...text.matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]);
const recipes = (name) =>
  [...table(name).matchAll(/(gemtd_\w+)\s*=\s*\{([^}]+)\}/g)].map((m) => ({
    result: m[1],
    materials: ids(m[2]),
  }));
const numeric = {};
for (const [id, a] of Object.entries(abilities)) {
  if (
    !/^(tower_|new_|enemy_|guai_|runrunrun|chain_frost|templar_|antimage_|naga_|medusa_|shredder_|tidehunter_)/.test(
      id,
    )
  )
    continue;
  const fields = {};
  function walk(o, prefix = '') {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'object') walk(v, `${prefix}${k}.`);
      else if (/^-?\d+(\.\d+)?( +-?\d+(\.\d+)?)*$/.test(v))
        fields[prefix + k] = v.split(/ +/).map(Number);
    }
  }
  walk(a);
  numeric[id] = fields;
}
const projectileSpeeds = Object.fromEntries(
  Object.entries(units)
    .filter(([, u]) => u.ProjectileSpeed)
    .map(([id, u]) => [id, Number(u.ProjectileSpeed)]),
);
const waveAbilities = Object.fromEntries(
  [...table('guai_ability').matchAll(/\[(\d+)\]\s*=\s*\{([^}]+)\}/g)].map(
    (m) => [m[1], ids(m[2])],
  ),
);
const nativeText = fs.readFileSync(
  'outputs/original/native-abilities-20180610.txt',
  'utf8',
);
assert.equal(
  crypto.createHash('sha256').update(nativeText).digest('hex'),
  'c361cfbf5ea31cdc4fb0493a02eb18dcf4d2c200495e023cfce23157042453e1',
);
const native = parse(nativeText).DOTAAbilities;
const nativeFacts = Object.fromEntries(
  ['medusa_stone_gaze', 'shredder_reactive_armor', 'naga_siren_ensnare'].map(
    (id) => [
      id,
      Object.fromEntries(
        Object.values(native[id].AbilitySpecial).flatMap((v) =>
          Object.entries(v)
            .filter(([k]) => !['var_type', 'LinkedSpecialBonus'].includes(k))
            .map(([k, v]) => [k, v.split(/ +/).map(Number)]),
        ),
      ),
    ],
  ),
);
const result = {
  commit: facts.commit,
  hashes: facts.hashes,
  nativeSource: {
    commit: 'b2448af51cc6fe490d124683aa9b976be0649ac7',
    date: '2018-06-10',
    sha256: crypto.createHash('sha256').update(nativeText).digest('hex'),
  },
  native: nativeFacts,
  waveAbilities,
  secretRecipes: recipes('gemtd_merge_secret'),
  slabRecipes: recipes('gemtd_merge_shiban'),
  stealable: ids(table('stealable_ability_pool')),
  endlessAbilities: ids(table('guai_50_ability')),
  projectileSpeeds,
  abilities: numeric,
};
assert.equal(result.secretRecipes.length, 13);
assert.equal(result.slabRecipes.length, 8);
fs.writeFileSync('data/mechanics.json', JSON.stringify(result, null, 2) + '\n');
console.log(
  'Extracted 13 hidden recipes, 8 slab recipes and archived mechanic facts.',
);
