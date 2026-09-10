import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RECIPES, basicId, type Recipe } from '../lib/game/data';
import {
  freshGame,
  keepAndStartWave,
  combine,
  type GameState,
  type Gem,
} from '../lib/game/engine';
import {
  recipeProgress,
  relatedRecipeProgress,
} from '../lib/game/recipe-progress';

function add(s: GameState, type: string, candidate = false) {
  const gem: Gem = {
    id: s.nextId++,
    type,
    x: (s.gems.length % 12) + 5,
    y: 12,
    candidate,
    order: s.nextId,
    cooldown: 0,
    burnClock: 0,
    damage: 0,
    waveDamage: 0,
    waveScore: 0,
    mvpLevel: 0,
    kills: 0,
  };
  s.gems.push(gem);
  return gem;
}
const silver = RECIPES.find((r) => r.result === 'gemtd_baiyin')!;

void test('retention forecast becomes a legal combat combination after keeping the selected gem', () => {
  const s = freshGame(42);
  const anchor = add(s, silver.materials[0], true);
  silver.materials.slice(1).forEach((type) => add(s, type));
  for (let i = 0; i < 4; i++) add(s, basicId('E', 1), true);
  s.placed = 5;
  const before = JSON.stringify(s);
  const progress = recipeProgress(s, silver, anchor.id)!;
  assert.equal(progress.afterKeep, true);
  assert.equal(progress.missing, 0);
  assert.equal(
    progress.ids,
    null,
    'candidate and retained pools cannot combine directly',
  );
  assert.equal(
    JSON.stringify(s),
    before,
    'planning must not alter the game or RNG',
  );
  keepAndStartWave(s, anchor.id);
  assert.equal(s.phase, 'combat');
  const kept = recipeProgress(s, silver, anchor.id)!;
  assert.ok(kept.ids);
  combine(s, silver.id, anchor.id, kept.ids);
  assert.equal(anchor.type, silver.result);
});

void test('other candidates enable direct combination but are never promised as retained materials', () => {
  const s = freshGame(42);
  const anchor = add(s, silver.materials[0], true);
  silver.materials.slice(1).forEach((type) => add(s, type, true));
  s.placed = 5;
  const progress = recipeProgress(s, silver, anchor.id)!;
  assert.ok(progress.ids);
  assert.equal(progress.afterKeep, false);
  assert.equal(progress.missing, 2);
  assert.equal(progress.materials[1].retained.length, 0);
  assert.equal(progress.materials[1].candidates.length, 1);
});

void test('forecast is available before the fifth build without enabling combination early', () => {
  const s = freshGame(42);
  const anchor = add(s, silver.materials[0], true);
  silver.materials.slice(1).forEach((type) => add(s, type));
  s.placed = 1;
  const progress = recipeProgress(s, silver, anchor.id)!;
  assert.equal(progress.afterKeep, true);
  assert.equal(progress.ids, null);
});

void test('hidden recipes only count current candidates and cannot be planned across waves', () => {
  const recipe = RECIPES.find((r) => r.candidateOnly)!;
  const s = freshGame(42);
  const anchor = add(s, recipe.materials[0], true);
  recipe.materials.slice(1).forEach((type) => add(s, type));
  s.placed = 5;
  let progress = recipeProgress(s, recipe, anchor.id)!;
  assert.equal(progress.afterKeep, false);
  assert.equal(progress.missing, recipe.materials.length - 1);
  assert.equal(progress.ids, null);
  recipe.materials.slice(1).forEach((type) => add(s, type, true));
  progress = recipeProgress(s, recipe, anchor.id)!;
  assert.equal(progress.missing, 0);
  assert.ok(progress.ids);
  anchor.candidate = false;
  assert.equal(recipeProgress(s, recipe, anchor.id)!.ids, null);
  assert.equal(recipeProgress(s, recipe, anchor.id)!.afterKeep, false);
});

void test('duplicate requirements consume distinct gems; surplus gems and wrong quality do not fill missing types', () => {
  const s = freshGame(42);
  const recipe: Recipe = {
    ...silver,
    materials: [basicId('B', 1), basicId('B', 1), basicId('Y', 1)],
  };
  const anchor = add(s, basicId('B', 1));
  add(s, basicId('B', 2));
  add(s, basicId('B', 1), true);
  let progress = recipeProgress(s, recipe, anchor.id)!;
  assert.equal(progress.materials[0].required, 2);
  assert.equal(progress.materials[0].missing, 1);
  assert.equal(progress.missing, 2);
  add(s, basicId('B', 1));
  add(s, basicId('B', 1));
  progress = recipeProgress(s, recipe, anchor.id)!;
  assert.equal(progress.materials[0].retained.length, 2);
  assert.equal(progress.materials[0].missing, 0);
  assert.equal(progress.missing, 1);
});

void test('unrelated and stone selections have no hints; actionable recipes sort first', () => {
  const s = freshGame(42);
  const anchor = add(s, silver.materials[0]);
  silver.materials.slice(1).forEach((type) => add(s, type));
  assert.equal(relatedRecipeProgress(s, anchor.id)[0].recipe.id, silver.id);
  assert.equal(recipeProgress(s, silver, add(s, basicId('G', 1)).id), null);
  assert.deepEqual(relatedRecipeProgress(s, add(s, 'stone').id), []);
  assert.deepEqual(relatedRecipeProgress(s, -1), []);
});
