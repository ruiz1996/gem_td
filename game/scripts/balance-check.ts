import { writeFileSync, mkdirSync } from 'node:fs';
import {
  BOARD,
  MOBILE_RULES,
  RECIPES,
  TOWERS,
  basicId,
} from '../lib/game/data';
import {
  canPlace,
  combine,
  freshGame,
  fuse,
  fuseOptions,
  keep,
  place,
  recommend,
  removeStone,
  startWave,
  tick,
  upgradeQuality,
  type GameState,
} from '../lib/game/engine';
// Deliberately simple reproducible policy. It is a smoke test, not a claim of optimal play.
function score(id: string) {
  const t = TOWERS[id];
  return (
    (t.damage / t.interval) *
      (1 + t.bonusSpeed / 100) *
      Math.sqrt(t.effects.targets) +
    t.effects.burn * 2 +
    t.effects.poison * 2 +
    t.effects.pierce * 4 +
    t.auras.reduce(
      (n, a) => n + (a.speed ?? 0) * 0.2 + (a.trueSight ? 25 : 0),
      0,
    )
  );
}
const results = [];
for (const seed of [7, 19, 42, 2026, 9001]) {
  const s = freshGame(seed);
  let rounds = 0;
  while (s.phase === 'prepare' && rounds++ < 50) {
    while (s.quality < 4 && s.gold >= MOBILE_RULES.qualityCosts[s.quality])
      upgradeQuality(s);
    // Concentrate around the central crossing of the researched solo map.
    for (let n = 0; n < 5; n++) {
      const positions = [];
      for (let y = 1; y < BOARD.height - 1; y++)
        for (let x = 1; x < BOARD.width - 1; x++) {
          const cx = Math.floor(BOARD.width / 2),
            cy = Math.floor(BOARD.height / 2);
          const proximity = Math.min(Math.abs(x - cx), Math.abs(y - cy));
          positions.push({
            x,
            y,
            value: proximity * 20 + Math.abs(x - cx) + Math.abs(y - cy),
          });
        }
      positions.sort((a, b) => a.value - b.value || a.y - b.y || a.x - b.x);
      let p = positions.find((p) => canPlace(s, p.x, p.y) === null);
      if (!p) {
        const rock = s.gems.find((g) => g.type === 'stone');
        if (rock) removeStone(s, rock.id);
        p = positions.find((p) => canPlace(s, p.x, p.y) === null);
      }
      if (!p) throw new Error('No legal cell');
      place(s, p.x, p.y);
    }
    let crafted = false;
    for (const g of s.gems.filter((g) => g.candidate)) {
      for (const r of RECIPES) {
        const ids = recommend(s, r, g.id);
        if (ids) {
          combine(s, r.id, g.id, ids);
          crafted = true;
          break;
        }
      }
      if (crafted) break;
    }
    if (!crafted) {
      const choices = s.gems
        .filter((g) => g.candidate)
        .map((g) => {
          const options = fuseOptions(s, g.id);
          const count = options.at(-1);
          const t = TOWERS[g.type];
          return {
            g,
            count,
            value: score(
              count
                ? basicId(t.family, t.quality + (count === 4 ? 2 : 1))
                : g.type,
            ),
          };
        })
        .sort((a, b) => b.value - a.value);
      const c = choices[0];
      if (c.count) fuse(s, c.g.id, c.count);
      else keep(s, c.g.id);
    }
    // Only craft upgrades if the result's approximate offensive value exceeds the anchor.
    for (let pass = 0; pass < 4; pass++) {
      let done = false;
      for (const g of s.gems.filter((g) => g.type !== 'stone')) {
        for (const r of RECIPES) {
          if (score(r.result) < score(g.type)) continue;
          const ids = recommend(s, r, g.id);
          if (ids) {
            combine(s, r.id, g.id, ids);
            done = true;
            break;
          }
        }
        if (done) break;
      }
      if (!done) break;
    }
    startWave(s);
    for (let i = 0; i < 30000 && (s as GameState).phase === 'combat'; i++)
      tick(s);
    if ((s as GameState).phase === 'combat')
      throw new Error('Wave did not finish');
  }
  results.push({
    seed,
    phase: s.phase,
    reachedWave: s.wave,
    life: s.life,
    kills: s.kills,
    leaks: s.leaks,
    seconds: Math.round(s.time),
    history: s.history,
    towers: s.gems
      .filter((g) => g.type !== 'stone')
      .map((g) => ({
        name: TOWERS[g.type].name,
        damage: Math.round(g.damage),
      })),
  });
  console.log(
    JSON.stringify({
      seed,
      phase: s.phase,
      wave: s.wave,
      life: s.life,
      kills: s.kills,
    }),
  );
}
mkdirSync('reports', { recursive: true });
writeFileSync(
  'reports/balance-smoke.json',
  JSON.stringify(
    {
      policy:
        'simple greedy placement and DPS heuristic; no strategic recipe planning',
      date: '2026-09-07',
      map: BOARD.id,
      results,
    },
    null,
    2,
  ),
);
