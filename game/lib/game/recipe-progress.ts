import { RECIPES, type Recipe } from './data';
import { getGem, recommend, type GameState, type Gem } from './engine';

export type MaterialProgress = {
  type: string;
  required: number;
  selected: boolean;
  retained: Gem[];
  candidates: Gem[];
  missing: number;
};
export type RecipeProgress = {
  recipe: Recipe;
  ids: number[] | null;
  materials: MaterialProgress[];
  missing: number;
  afterKeep: boolean;
};

// Planning is deliberately separate from recommend(): keeping one candidate
// turns the others to stone, while direct combination uses one material pool.
export function recipeProgress(
  s: GameState,
  recipe: Recipe,
  anchorId: number,
): RecipeProgress | null {
  const anchor = getGem(s, anchorId);
  if (!anchor || !recipe.materials.includes(anchor.type)) return null;
  const materials = [...new Set(recipe.materials)].map((type) => {
    const matches = s.gems
      .filter((g) => g.type === type && g.id !== anchorId)
      .sort((a, b) => a.order - b.order || a.id - b.id);
    const retained = matches.filter((g) => !g.candidate);
    const candidates = matches.filter((g) => g.candidate);
    const required = recipe.materials.filter((id) => id === type).length;
    const selected =
      type === anchor.type && (!recipe.candidateOnly || anchor.candidate);
    const usable =
      Number(selected) +
      (recipe.candidateOnly ? candidates.length : retained.length);
    return {
      type,
      required,
      selected,
      retained,
      candidates,
      missing: Math.max(0, required - usable),
    };
  });
  const missing = materials.reduce(
    (sum, material) => sum + material.missing,
    0,
  );
  return {
    recipe,
    ids: recommend(s, recipe, anchorId),
    materials,
    missing,
    afterKeep: anchor.candidate && !recipe.candidateOnly && missing === 0,
  };
}

export function relatedRecipeProgress(s: GameState, anchorId: number) {
  return RECIPES.map((recipe) => recipeProgress(s, recipe, anchorId))
    .filter((progress): progress is RecipeProgress => progress !== null)
    .sort(
      (a, b) =>
        Number(!!b.ids) - Number(!!a.ids) ||
        Number(b.afterKeep) - Number(a.afterKeep) ||
        Number(a.recipe.candidateOnly) - Number(b.recipe.candidateOnly) ||
        a.missing - b.missing,
    );
}
