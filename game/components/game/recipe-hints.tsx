import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TOWERS, type Recipe } from '@/lib/game/data';
import { type GameState, type Gem } from '@/lib/game/engine';
import {
  relatedRecipeProgress,
  type MaterialProgress,
  type RecipeProgress,
} from '@/lib/game/recipe-progress';

const positions = (gems: Gem[]) =>
  gems.map((g) => `${g.x + 1}列${g.y + 1}行`).join('、');

function materialStatus(material: MaterialProgress, hidden: boolean) {
  const parts: string[] = [];
  if (material.selected) parts.push('本颗');
  const count = hidden ? material.candidates.length : material.retained.length;
  if (count) parts.push(`${hidden ? '本轮另有' : '已留'} ${count}`);
  if (material.missing) parts.push(`缺 ${material.missing}`);
  return parts.join(' · ');
}

function progressLabel(progress: RecipeProgress, candidate: boolean) {
  if (candidate && !progress.recipe.candidateOnly)
    return progress.afterKeep
      ? '保留后可合成'
      : `保留后还缺 ${progress.missing} 颗`;
  if (progress.ids) return candidate ? '本轮可直接合成' : '可合成';
  if (progress.recipe.candidateOnly && !candidate) return '仅限本轮候选';
  if (progress.missing) return `还缺 ${progress.missing} 颗`;
  return '建满五颗可合成';
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
  const retained = state.gems.filter(
    (g) => g.type === gem.type && !g.candidate,
  );
  return (
    <section className="recipe-hints" aria-label="合成材料预留">
      <div className="recipe-hints-heading">
        <strong>合成材料预留</strong>
        <span>同类已保留 {retained.length} 颗</span>
      </div>
      {gem.candidate ? (
        <p className="recipe-hints-note">
          普通配方按原品质保留本颗后计算；其他候选会变石，不计入预留。
        </p>
      ) : state.phase === 'combat' ? (
        <p className="recipe-hints-note">战斗中可合成，其他材料原地变石。</p>
      ) : null}
      {retained.length > 0 && (
        <details className="recipe-locations">
          <summary>同类宝石位置{!gem.candidate ? '（含本颗）' : ''}</summary>
          <p>{positions(retained)}</p>
        </details>
      )}
      {progress.length === 0 && (
        <p className="recipe-hints-note">这颗宝石没有后续配方。</p>
      )}
      {progress.map((item) => {
        const { recipe, ids, materials } = item;
        return (
          <article className="recipe-progress" key={recipe.id}>
            <div className="recipe-progress-heading">
              <strong>{TOWERS[recipe.result].name}</strong>
              <span
                className={
                  item.afterKeep ||
                  (ids && (!gem.candidate || recipe.candidateOnly))
                    ? 'recipe-status ready'
                    : 'recipe-status'
                }
              >
                {progressLabel(item, gem.candidate)}
              </span>
            </div>
            {recipe.candidateOnly && (
              <p className="recipe-hints-note">
                隐藏配方 · 只用本轮五颗候选，已保留宝石不适用。
              </p>
            )}
            <ul
              className="recipe-materials"
              aria-label={`${TOWERS[recipe.result].name}材料`}
            >
              {materials.map((material) => {
                const tower = TOWERS[material.type];
                return (
                  <li
                    key={material.type}
                    data-missing={material.missing > 0}
                    title={tower.name}
                  >
                    <strong>
                      {tower.quality
                        ? `${tower.family}${tower.quality}`
                        : tower.name}
                      {material.required > 1 ? ` ×${material.required}` : ''}
                    </strong>
                    <span>
                      {materialStatus(material, recipe.candidateOnly)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <details className="recipe-locations">
              <summary>材料位置与本轮候选</summary>
              <ul>
                {materials.map((material) => (
                  <li key={material.type}>
                    <strong>
                      {TOWERS[material.type].name} ×{material.required}
                    </strong>
                    {material.selected && <span>本颗：{positions([gem])}</span>}
                    <span>
                      已保留{recipe.candidateOnly ? '（此配方不可用）' : ''}：
                      {positions(
                        !material.selected &&
                          !gem.candidate &&
                          material.type === gem.type
                          ? [gem, ...material.retained]
                          : material.retained,
                      ) || '无'}
                    </span>
                    {material.candidates.length > 0 && (
                      <span>
                        本轮其他候选
                        {recipe.candidateOnly ? '' : '（不计入预留）'}：
                        {positions(material.candidates)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </details>
            {ids && (
              <Button
                className="recipe-combine"
                variant="outline"
                aria-label={`选择材料合成${TOWERS[recipe.result].name}`}
                disabled={!ready}
                onClick={() => onRecipe(recipe, ids)}
              >
                {gem.candidate ? '本轮可直接合成 · 选材料' : '选择材料并合成'}
                <ChevronRight size={16} />
              </Button>
            )}
            {!ids && item.afterKeep && (
              <p className="recipe-hints-note recipe-after-keep">
                保留后开波，再选中本颗即可合成。
              </p>
            )}
          </article>
        );
      })}
    </section>
  );
}
