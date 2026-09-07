'use client';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TOWERS, type Recipe } from '@/lib/game/data';
import {
  canPlace,
  describe,
  fuseOptions,
  getGem,
  materialPool,
  recipesFor,
  type GameState,
} from '@/lib/game/engine';
import type { BoardView } from '@/lib/game/board';

type TouchPreview = {
  recipe: Recipe;
  ids: number[];
  anchor: number;
  slot: number;
};
export type TouchActions = {
  nudge: (dx: number, dy: number) => void;
  place: () => void;
  keep: () => void;
  fuse: (count: number) => void;
  remove: () => void;
  recipe: (recipe: Recipe, ids: number[]) => void;
  slot: (index: number) => void;
  material: (id: number) => void;
  combine: () => void;
};
// This content is only mounted inside the context dialog, never beside the map.
export function TouchControls({
  state: s,
  view: v,
  ready,
  preview,
  actions: a,
  notice,
}: {
  state: GameState;
  view: BoardView;
  ready: boolean;
  preview: TouchPreview | null;
  actions: TouchActions;
  notice: string;
}) {
  const selected = getGem(s, v.selected),
    tower = selected && TOWERS[selected.type];
  const building = s.phase === 'prepare' && !s.resolved && s.placed < 5;
  const point = v.pending ?? v.cursor;
  const options = selected ? fuseOptions(s, selected.id) : [];
  const combinations = selected ? recipesFor(s, selected.id) : [];
  const available = preview
    ? materialPool(s, getGem(s, preview.anchor)!).filter(
        (g) =>
          g.type === preview.recipe.materials[preview.slot] &&
          (!preview.ids.includes(g.id) || preview.ids[preview.slot] === g.id),
      )
    : [];
  return (
    <div className="touch-context-content">
      {preview ? (
        <>
          <label className="touch-field">
            材料槽
            <select
              aria-label="选择合成材料槽"
              value={preview.slot}
              onChange={(e) => a.slot(Number(e.target.value))}
            >
              {preview.ids.map((id, i) => (
                <option key={i} value={i}>
                  {i + 1}. {TOWERS[getGem(s, id)!.type].name}
                  {id === preview.anchor ? '（成品位置）' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="touch-field">
            选择宝石
            <select
              aria-label="替换合成材料"
              value={preview.ids[preview.slot]}
              disabled={preview.ids[preview.slot] === preview.anchor}
              onChange={(e) => a.material(Number(e.target.value))}
            >
              {available.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.x + 1}列 · {g.y + 1}行（#{g.id}）
                </option>
              ))}
            </select>
          </label>
          <p className="touch-hint">
            成品留在所选宝石的位置，其他材料原地变成石头。
          </p>
          <Button className="primary-action" onClick={a.combine}>
            <Layers size={18} />
            确认合成
          </Button>
        </>
      ) : (
        <>
          {tower && (
            <>
              <p className="ability-text">{describe(selected!.type)}</p>
              <div className="stat-grid">
                <div>
                  <strong>{tower.damage}</strong>
                  <small>攻击</small>
                </div>
                <div>
                  <strong>
                    {tower.interval.toFixed(2)}
                    <em>s</em>
                  </strong>
                  <small>基础间隔</small>
                </div>
                <div>
                  <strong>{tower.range.toFixed(1)}</strong>
                  <small>射程 / 格</small>
                </div>
              </div>
            </>
          )}
          {building && (!selected || selected.type === 'stone') && (
            <>
              <div className="touch-nudge" aria-label="逐格移动选择">
                <span>
                  {point ? `${point.x + 1}列 ${point.y + 1}行` : '选择位置'}
                </span>
                {[
                  [ArrowLeft, -1, 0, '向左一格'],
                  [ArrowUp, 0, -1, '向上一格'],
                  [ArrowDown, 0, 1, '向下一格'],
                  [ArrowRight, 1, 0, '向右一格'],
                ].map(([Icon, dx, dy, label]) => {
                  const Glyph = Icon as typeof ArrowLeft;
                  return (
                    <Button
                      key={String(label)}
                      variant="outline"
                      aria-label={String(label)}
                      disabled={!ready}
                      onClick={() => a.nudge(Number(dx), Number(dy))}
                    >
                      <Glyph size={18} />
                    </Button>
                  );
                })}
              </div>
              {!selected && (
                <>
                  <p className="muted">
                    {v.pending
                      ? '确认后随机揭晓宝石。'
                      : point
                        ? canPlace(s, point.x, point.y)
                        : '请先在地图选择位置。'}
                  </p>
                  <Button
                    className="primary-action"
                    disabled={!ready || !v.pending}
                    onClick={a.place}
                  >
                    确认建造 · {s.placed + 1}/5
                  </Button>
                </>
              )}
            </>
          )}
          {selected?.type === 'stone' &&
            (s.phase === 'prepare' ? (
              <Button variant="outline" disabled={!ready} onClick={a.remove}>
                拆除石头
              </Button>
            ) : (
              <p className="touch-hint">
                战斗中不能拆除石头，波次结束后可操作。
              </p>
            ))}
          {selected?.candidate && (
            <>
              {s.placed < 5 && (
                <p className="touch-hint">
                  本轮已建造 {s.placed}/5
                  颗。建满五颗后，选择保留、融合或配方合成。
                </p>
              )}
              <div className="touch-main-actions">
                <Button
                  className="primary-action"
                  disabled={!ready || s.placed !== 5}
                  onClick={a.keep}
                >
                  保留并开始本波
                </Button>
                {options.map((count) => (
                  <Button
                    key={count}
                    variant="outline"
                    onClick={() => a.fuse(count)}
                  >
                    {count}颗融合 +{count === 4 ? 2 : 1}
                  </Button>
                ))}
              </div>
            </>
          )}
          {!!tower && (
            <div className="touch-recipes">
              <strong>配方合成</strong>
              {s.phase === 'combat' && (
                <p className="muted">战斗中可合成，其他材料原地变石。</p>
              )}
              {combinations.length ? (
                combinations.map(({ recipe, ids }) => (
                  <Button
                    key={recipe.id}
                    variant="ghost"
                    className="recipe-option"
                    disabled={!ready || !ids}
                    onClick={() => ids && a.recipe(recipe, ids)}
                  >
                    <span>
                      <strong>{TOWERS[recipe.result].name}</strong>
                      <small>
                        {recipe.materials
                          .map((id) =>
                            TOWERS[id].quality
                              ? `${TOWERS[id].family}${TOWERS[id].quality}`
                              : TOWERS[id].name,
                          )
                          .join(' + ')}
                      </small>
                    </span>
                    {ids ? (
                      <ChevronRight size={18} />
                    ) : (
                      <span className="missing">未凑齐</span>
                    )}
                  </Button>
                ))
              ) : (
                <p className="muted">这颗宝石没有后续配方。</p>
              )}
            </div>
          )}
        </>
      )}
      {!!notice && (
        <output className="touch-notice" aria-live="polite">
          {notice}
        </output>
      )}
    </div>
  );
}
