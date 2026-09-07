'use client';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Layers,
  Plus,
  Play,
  Pause,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TOWERS, type Recipe } from '@/lib/game/data';
import {
  describe,
  fuseOptions,
  getGem,
  materialPool,
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
  selectGem: (id: number) => void;
  nudge: (dx: number, dy: number) => void;
  place: () => void;
  keep: () => void;
  fuse: (count: number) => void;
  remove: () => void;
  fight: () => void;
  speed: () => void;
  details: () => void;
  library: () => void;
  towers: () => void;
  slot: (index: number) => void;
  material: (id: number) => void;
  combine: () => void;
  cancel: () => void;
};
export function TouchControls({
  state: s,
  view: v,
  ready,
  preview,
  actions: a,
  notice,
  saveStatus,
}: {
  state: GameState;
  view: BoardView;
  ready: boolean;
  preview: TouchPreview | null;
  actions: TouchActions;
  notice: string;
  saveStatus: string;
}) {
  const selected = getGem(s, v.selected),
    tower = selected && TOWERS[selected.type];
  const candidates = s.gems.filter((g) => g.candidate);
  const complete = s.phase === 'won' || s.phase === 'lost';
  const building = s.phase === 'prepare' && !s.resolved && s.placed < 5;
  const point = v.pending ?? v.cursor ?? selected;
  const options = selected ? fuseOptions(s, selected.id) : [];
  const available = preview
    ? materialPool(s, getGem(s, preview.anchor)!).filter(
        (g) =>
          g.type === preview.recipe.materials[preview.slot] &&
          (!preview.ids.includes(g.id) || preview.ids[preview.slot] === g.id),
      )
    : [];
  return (
    <section className="touch-dock" aria-label="触屏操作区">
      {preview ? (
        <>
          <div className="touch-selection">
            <strong>合成 {TOWERS[preview.recipe.result].name}</strong>
            <Button variant="ghost" onClick={a.cancel}>
              取消
            </Button>
          </div>
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
            其他材料原地变石。可从列表换材料，也可点棋盘高亮宝石。
          </p>
          <Button className="primary-action" onClick={a.combine}>
            <Layers size={18} />
            确认合成
          </Button>
        </>
      ) : (
        <>
          <div className="touch-selection">
            <div>
              <strong>
                {v.pending
                  ? `放置在 ${v.pending.x + 1}列 · ${v.pending.y + 1}行`
                  : (tower?.name ??
                    (selected
                      ? '迷宫石头'
                      : `第 ${s.wave} 波 · ${s.phase === 'combat' ? '防守中' : '准备建造'}`))}
              </strong>
              <small>
                {v.pending
                  ? '确认后揭晓宝石；箭头可以逐格微调'
                  : selected
                    ? `${selected.x + 1}列 · ${selected.y + 1}行　${tower ? describe(selected.type) : '仅在波间允许拆除'}`
                    : '拖动移图 · 点选格子 · 双指缩放'}
              </small>
            </div>
          </div>
          {s.phase === 'prepare' && !s.resolved && (
            <div className="touch-candidates" aria-label="本轮候选宝石">
              {[0, 1, 2, 3, 4].map((i) => {
                const g = candidates[i],
                  t = g && TOWERS[g.type];
                return (
                  <Button
                    key={i}
                    variant="outline"
                    disabled={!g || !ready}
                    aria-label={g ? `候选${i + 1} ${t.name}` : `待建造${i + 1}`}
                    aria-pressed={!!g && selected?.id === g.id}
                    onClick={() => g && a.selectGem(g.id)}
                  >
                    {t ? (
                      <span style={{ color: t.color }}>
                        {t.family}
                        {t.quality}
                      </span>
                    ) : (
                      <Plus size={16} />
                    )}
                    <small>{i + 1}</small>
                  </Button>
                );
              })}
            </div>
          )}
          {building && (
            <div className="touch-nudge" aria-label="逐格移动选择">
              <span>
                {point ? `${point.x + 1}列 ${point.y + 1}行` : '选取位置'}
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
          )}
          <div className="touch-main-actions">
            {selected?.type === 'stone' && s.phase === 'prepare' ? (
              <Button variant="outline" disabled={!ready} onClick={a.remove}>
                拆除石头
              </Button>
            ) : building ? (
              <Button
                className="primary-action"
                disabled={!ready || !v.pending}
                onClick={a.place}
              >
                {v.pending ? `确认放置 · ${s.placed + 1}/5` : '点选空格建造'}
              </Button>
            ) : selected?.candidate ? (
              <>
                <Button
                  className="primary-action"
                  disabled={!ready || s.placed !== 5}
                  onClick={a.keep}
                >
                  保留这颗
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
              </>
            ) : (
              <Button
                className="primary-action"
                disabled={
                  !ready || complete || (s.phase === 'prepare' && !s.resolved)
                }
                onClick={a.fight}
              >
                {s.phase === 'combat' ? (
                  s.paused ? (
                    <>
                      <Play size={18} />
                      继续防守
                    </>
                  ) : (
                    <>
                      <Pause size={18} />
                      暂停
                    </>
                  )
                ) : (
                  `开始第 ${s.wave} 波`
                )}
              </Button>
            )}
          </div>
          <div className="touch-tools">
            <Button variant="outline" onClick={a.towers} disabled={!ready}>
              宝石列表
            </Button>
            <Button variant="outline" onClick={a.details} disabled={!ready}>
              详情 / 合成
            </Button>
            <Button variant="ghost" onClick={a.library}>
              图鉴
            </Button>
            <Button variant="ghost" onClick={a.speed} disabled={!ready}>
              {s.speed}×
            </Button>
          </div>
        </>
      )}
      <output className="touch-notice" aria-live="polite">
        {notice ||
          (preview
            ? '预览期间战斗暂停，确认或取消后恢复。'
            : `品质 Lv.${s.quality + 1} · 经验 ${s.xp} · ${saveStatus}`)}
      </output>
    </section>
  );
}
