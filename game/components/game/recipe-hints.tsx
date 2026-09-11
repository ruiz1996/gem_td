import { Button } from '@/components/ui/button';
import { TOWERS, type Recipe } from '@/lib/game/data';
import type { GameState, Gem } from '@/lib/game/engine';
import {
  plusOneRecipeProgress,
  recipeMaterialSlots,
  relatedRecipeProgress,
  type MaterialSlot,
  type RecipeProgress,
} from '@/lib/game/recipe-progress';

const shortName = (type: string) => {
  const tower = TOWERS[type];
  return tower.quality ? `${tower.family}${tower.quality}` : tower.name;
};
function materialLabel(slot: MaterialSlot, hidden: boolean) {
  const status =
    slot.status === 'missing'
      ? '缺失'
      : slot.status === 'retained'
        ? '已保留'
        : hidden
          ? '本轮候选'
          : '当前宝石';
  return `${TOWERS[slot.type].name} · ${status}${
    slot.gem ? ` · ${slot.gem.x + 1}列${slot.gem.y + 1}行` : ''
  }`;
}

function RecipeList({
  items,
  gem,
  ready,
  onRecipe,
}: {
  items: RecipeProgress[];
  gem: Gem;
  ready: boolean;
  onRecipe: (recipe: Recipe, ids: number[]) => void;
}) {
  return items.length ? (
    items.map((item) => (
      <article className="recipe-progress" key={item.recipe.id}>
        <div className="recipe-progress-heading">
          <strong>{TOWERS[item.recipe.result].name}</strong>
          {item.recipe.candidateOnly && (
            <span
              className="recipe-hidden"
              title="仅限本轮五颗候选，蓝色包含本轮其他候选"
            >
              隐藏 · 本轮
            </span>
          )}
          {item.ids && (
            <Button
              variant="outline"
              className="recipe-combine"
              disabled={!ready}
              aria-label={`选择材料合成${TOWERS[item.recipe.result].name}`}
              onClick={() => onRecipe(item.recipe, item.ids!)}
            >
              {gem.candidate ? '本轮合成' : '合成'}
            </Button>
          )}
        </div>
        <ul
          className="recipe-materials"
          aria-label={`${TOWERS[item.recipe.result].name}材料`}
        >
          {recipeMaterialSlots(item, gem).map((slot, index) => (
            <li
              key={`${slot.type}:${index}`}
              data-status={slot.status}
              title={materialLabel(slot, item.recipe.candidateOnly)}
              aria-label={materialLabel(slot, item.recipe.candidateOnly)}
            >
              {shortName(slot.type)}
            </li>
          ))}
        </ul>
      </article>
    ))
  ) : (
    <p className="recipe-empty">无后续配方</p>
  );
}

export function RecipeHints({
  state,
  gem,
  ready,
  onRecipe,
}: {
  state: GameState;
  gem: Gem;
  ready: boolean;
  onRecipe: (recipe: Recipe, ids: number[]) => void;
}) {
  const progress = relatedRecipeProgress(state, gem.id);
  const upgraded = plusOneRecipeProgress(state, gem.id);
  return (
    <section className="recipe-hints" aria-label="合成材料预留">
      <div className="recipe-hints-heading">
        <strong>相关配方</strong>
        <div className="recipe-legend" aria-label="材料颜色说明">
          <span data-status="retained">已留</span>
          <span
            data-status="current"
            title="普通配方为当前这颗；隐藏配方为本轮候选"
          >
            当前
          </span>
          <span data-status="missing">缺失</span>
        </div>
      </div>
      <RecipeList
        items={progress}
        gem={gem}
        ready={ready}
        onRecipe={onRecipe}
      />
      {upgraded && (
        <section className="recipe-upgrade" aria-label="+1融合后相关配方">
          <div className="recipe-hints-heading">
            <strong>+1 融合后 · {shortName(upgraded.gem.type)}</strong>
          </div>
          <RecipeList
            items={upgraded.recipes}
            gem={upgraded.gem}
            ready={false}
            onRecipe={onRecipe}
          />
        </section>
      )}
    </section>
  );
}
