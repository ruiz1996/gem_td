import { RECIPES, TOWERS, basicId, type Recipe } from './data';
import {
  fuseOptions,
  getGem,
  recommend,
  type GameState,
  type Gem,
} from './engine';

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

export type MaterialSlot = {
  type: string;
  status: 'current' | 'retained' | 'missing';
  gem?: Gem;
};

// Each requirement gets its own color, so one selected gem cannot fill two slots.
export function recipeMaterialSlots(
  progress: RecipeProgress,
  anchor: Gem,
): MaterialSlot[] {
  const used = new Map<string, number>();
  return progress.recipe.materials.map((type) => {
    const index = used.get(type) ?? 0;
    used.set(type, index + 1);
    const material = progress.materials.find((m) => m.type === type)!;
    if (material.selected && index === 0)
      return { type, status: 'current', gem: anchor };
    const pool = progress.recipe.candidateOnly
      ? material.candidates
      : material.retained;
    const gem = pool[index - Number(material.selected)];
    return {
      type,
      status: gem
        ? progress.recipe.candidateOnly
          ? 'current'
          : 'retained'
        : 'missing',
      gem,
    };
  });
}

export function plusOneRecipeProgress(s: GameState, anchorId: number) {
  if (s.phase !== 'prepare' || !fuseOptions(s, anchorId).includes(2))
    return null;
  const anchor = getGem(s, anchorId)!;
  const tower = TOWERS[anchor.type];
  const gem = {
    ...anchor,
    type: basicId(tower.family, tower.quality + 1),
    candidate: false,
  };
  // Only project the inventory effects of fuse(): all other candidates turn to
  // stone. Do not run combat initialization or consume the player's random seed.
  const projected = {
    ...s,
    resolved: true,
    gems: s.gems.map((g) =>
      g.id === anchorId
        ? gem
        : g.candidate
          ? { ...g, type: 'stone', candidate: false }
          : g,
    ),
  };
  const recipes = relatedRecipeProgress(projected, anchorId)
    .filter((item) => !item.recipe.candidateOnly)
    // Forecast materials must never become clickable before the actual fusion.
    .map((item) => ({ ...item, ids: null }));
  return { gem, recipes };
}
