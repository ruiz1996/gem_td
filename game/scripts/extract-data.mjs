import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const revision = 'f424bb2abbe9355f7cfa9a539e4e61512f027750';
const clean = (s) =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const output = {
  revision,
  snapshotDate: '2018-06-10',
  retrieved: '2026-09-07',
  status: 'historical-extraction-not-current-map',
  pages: {},
};
for (const file of ['baseTowers', 'advancedTowers', 'creeps', 'pedals']) {
  const url = `https://raw.githubusercontent.com/clementbera/Website/${revision}/${file}.html`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  const html = await response.text();
  let title = '';
  const records = [];
  let record = null;
  for (const match of html.matchAll(
    /<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>|<tr\b[^>]*>[\s\S]*?<\/tr>/gi,
  )) {
    if (/^<h/i.test(match[0])) {
      title = clean(match[0]);
      continue;
    }
    const cells = [
      ...match[0].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi),
    ].map((x) => clean(x[1]));
    if (cells[0] === 'Code') {
      record = { title, fields: {} };
      records.push(record);
    }
    if (!record || cells.length < 2) continue;
    if (
      [
        'Code',
        'English',
        'Lvl',
        'Attack Damage',
        'Attack Rate',
        'Attack Range',
        'Combination',
        'HP (1-4 players) [Base]',
        'Movement (1-4 players) [Base]',
        'Armor',
        'Magic resistance',
        'Ability',
        'Raw',
        'Raw: Special',
        'Pierce Spell Immunity',
      ].includes(cells[0])
    ) {
      (record.fields[cells[0]] ??= []).push(cells.slice(1).join(' | '));
    }
  }
  if (!records.length) throw new Error(`No records parsed: ${file}`);
  output.pages[file] = {
    url,
    sha256: createHash('sha256').update(html).digest('hex'),
    records,
  };
  console.log(file, records.length);
}
await mkdir('data', { recursive: true });
await writeFile('data/historical.json', JSON.stringify(output, null, 2) + '\n');
