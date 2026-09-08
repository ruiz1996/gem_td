'use client';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { TOWERS } from '@/lib/game/data';
import { crushOptions, getGem, type GameState } from '@/lib/game/engine';

export function CrushAction({
  state,
  gemId,
  ready = true,
  onCrush,
}: {
  state: GameState;
  gemId: number;
  ready?: boolean;
  onCrush: () => void;
}) {
  const descriptionId = useId();
  const options = crushOptions(state, gemId);
  const gem = getGem(state, gemId);
  return (
    <div className="full mt">
      <Button
        variant="outline"
        className="full"
        disabled={!ready || !options.length}
        aria-describedby={descriptionId}
        onClick={onCrush}
      >
        敲碎并保留
      </Button>
      <p className="muted" id={descriptionId}>
        {options.length
          ? `降至${options.map((o) => `${o.quality}级 ${o.chance}%`).join(' · ')}。种类不变，其余候选变石，保留后开波。`
          : gem && TOWERS[gem.type]?.quality === 1
            ? '1级宝石无法继续降级。'
            : '建满五颗后，可随机降级保留并开波。'}
      </p>
    </div>
  );
}
