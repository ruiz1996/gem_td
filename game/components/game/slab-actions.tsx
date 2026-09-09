'use client';
import { Button } from '@/components/ui/button';
import { TOWERS } from '@/lib/game/data';
import {
  canBuildSlab,
  slabDescription,
  slabOptions,
  slabType,
  type GameState,
  type Point,
} from '@/lib/game/engine';
export function SlabActions({
  state: s,
  point,
  onBuild,
}: {
  state: GameState;
  point: Point | null;
  onBuild: (type: string) => void;
}) {
  const slab = point && s.slabs.find((p) => p.x === point.x && p.y === point.y);
  const options = slabOptions(s);
  if (slab)
    return (
      <div className="tip-block">
        <div>
          <strong>{TOWERS[slabType(slab)].name}</strong>
          <p>{slabDescription(slab.type, slab.tier)}</p>
          <p>三块同级同类石板排成相邻直线，自动在中间升级。</p>
        </div>
      </div>
    );
  if (!options.length) return null;
  const error = point
    ? canBuildSlab(s, point.x, point.y)
    : '请先选择地图上的空格';
  return (
    <div className="touch-recipes slab-actions">
      <strong>本轮可合成石板</strong>
      <p className="muted">
        用本轮材料换取一块石板，五颗候选全部变石，随后开波。石板不挡路。
      </p>
      {error && <p className="muted">{error}</p>}
      {options.map((r) => (
        <Button
          key={r.result}
          variant="outline"
          className="recipe-option"
          disabled={!!error}
          onClick={() => onBuild(r.result)}
        >
          <span>
            <strong>建造{TOWERS[r.result].name}</strong>
            <small>
              {r.materials.map((id) => TOWERS[id].name).join(' + ')}
            </small>
          </span>
        </Button>
      ))}
    </div>
  );
}
