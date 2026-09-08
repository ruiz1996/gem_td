'use client';
import { MVP_RULES, TOWERS } from '@/lib/game/data';
import {
  getGem,
  inheritedMvp,
  mvpBonus,
  type GameState,
  type Gem,
  type MvpAward,
} from '@/lib/game/engine';

export function MvpStats({ state: s, gem }: { state: GameState; gem: Gem }) {
  if (gem.candidate || gem.type === 'stone') return null;
  const bonus = mvpBonus(s, gem);
  return (
    <section className="mvp-stats" aria-label="MVP与伤害统计">
      <strong>
        {gem.mvpLevel === MVP_RULES.maxLevel
          ? 'MVP光环 · Lv.10（已退出评选）'
          : `MVP Lv.${gem.mvpLevel}/10`}
      </strong>
      <p>
        攻击伤害 +{bonus.total}%：自身 +{bonus.own}% · 光环 +{bonus.aura}%（
        {bonus.auraCount}座）
      </p>
      {gem.mvpLevel === MVP_RULES.maxLevel && (
        <p>2.27格圆形范围内友塔攻击伤害 +100%，多个光环叠加。</p>
      )}
      {gem.mvpLevel > 0 && (
        <p>
          6.25格内敌人减魔抗光环：{gem.mvpLevel * MVP_RULES.resistPerLevel}
          。固定法术伤害通过减抗受益。
        </p>
      )}
      <p>
        {s.phase === 'prepare' ? '上波' : '本波'}伤害{' '}
        {gem.waveDamage.toLocaleString('zh-CN', { maximumFractionDigits: 1 })} ·
        计分 {gem.waveScore.toLocaleString()} · 累计{' '}
        {Math.round(gem.damage).toLocaleString()} · 击杀 {gem.kills}
      </p>
    </section>
  );
}
export function MvpInheritance({
  state: s,
  ids,
}: {
  state: GameState;
  ids: number[];
}) {
  const level = inheritedMvp(s, ids);
  return (
    <p className="muted">
      继承MVP：{ids.map((id) => getGem(s, id)?.mvpLevel ?? 0).join(' + ')} → Lv.
      {level}
      {level === MVP_RULES.maxLevel
        ? '（获得光环，10级封顶）'
        : `（自身攻击伤害 +${level * MVP_RULES.damagePerLevel}%）`}
      。成品本波伤害从零计分。
    </p>
  );
}
export function mvpResultText(award: MvpAward | null | undefined) {
  return award
    ? `${TOWERS[award.type].name}（${award.x + 1}列${award.y + 1}行） · MVP Lv.${award.level}${award.level === MVP_RULES.maxLevel ? ' · 获得光环' : ''}`
    : '本波未授予MVP';
}
