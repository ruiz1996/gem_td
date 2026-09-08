'use client';
import { useState } from 'react';
import { TOWERS, WAVES } from '@/lib/game/data';
import type { GameState } from '@/lib/game/engine';
import { mvpResultText } from './mvp-stats';

const number = (value: number) =>
  value > 0 && value < 0.001
    ? '<0.001'
    : value.toLocaleString('zh-CN', { maximumFractionDigits: 3 });

export function DamageReport({ state: s }: { state: GameState }) {
  const entries = [
    ...s.history.map((h) => ({ wave: h.wave, report: h.damageReport })),
    ...(s.damageReport
      ? [{ wave: s.damageReport.wave, report: s.damageReport }]
      : []),
  ].sort((a, b) => b.wave - a.wave);
  const [wave, setWave] = useState(entries[0]?.wave ?? s.wave);
  const [sort, setSort] = useState<'total' | 'score'>('total');
  const report = entries.find((entry) => entry.wave === wave)?.report;
  if (!entries.length)
    return (
      <p className="muted">
        开始第一波后，这里会记录每座塔的伤害。战斗中可随时打开查看，结束后可以切换波次。
      </p>
    );
  const rows = [...(report?.rows ?? [])].sort(
    (a, b) => b[sort] - a[sort] || a.id - b.id,
  );
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const maximum = Math.max(1, ...rows.map((row) => row.total));
  const definition = WAVES[wave - 1];
  return (
    <div className="wave-damage">
      <div className="wave-damage-controls">
        <label>
          查看波次
          <select
            value={wave}
            onChange={(event) => setWave(Number(event.target.value))}
          >
            {entries.map((entry) => (
              <option key={entry.wave} value={entry.wave}>
                第{entry.wave}波 · {WAVES[entry.wave - 1].name}
                {entry.report?.outcome === 'combat'
                  ? ' · 进行中'
                  : entry.report?.outcome === 'lost'
                    ? ' · 失败'
                    : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          排序
          <select
            value={sort}
            onChange={(event) =>
              setSort(event.target.value as 'total' | 'score')
            }
          >
            <option value="total">实际伤害</option>
            <option value="score">MVP计分</option>
          </select>
        </label>
      </div>
      {!report ? (
        <p className="muted">
          此波完成于旧版本，没有保存逐塔伤害明细。后续波次会自动记录。
        </p>
      ) : (
        <>
          <div className="wave-damage-summary">
            <span>
              总伤害<strong>{number(total)}</strong>
            </span>
            <span>
              战斗时间
              <strong>
                {report.elapsed.toFixed(1)}
                <small> 秒</small>
              </strong>
            </span>
            <span>
              状态
              <strong>
                {report.outcome === 'combat'
                  ? '进行中'
                  : report.outcome === 'lost'
                    ? '失败'
                    : '已完成'}
              </strong>
            </span>
          </div>
          <p className="muted">
            {definition.physicalImmune ? '物理免疫 · ' : ''}
            {definition.magicImmune ? '魔法免疫 · ' : ''}
            {definition.variants.length ? '本波含混合怪物 · ' : ''}
            {report.outcome === 'cleared'
              ? mvpResultText(report.mvp)
              : report.outcome === 'lost'
                ? '失败波次不授予MVP'
                : '本波结束后评选MVP'}
          </p>
          {!report.complete && (
            <p className="wave-warning">
              本波从旧存档继续：更新前的伤害列为“未分类”，此前材料明细无法恢复。本波不评选MVP，下一波开始完整统计。
            </p>
          )}
          <ol className="wave-damage-list">
            {rows.map((row, index) => {
              const awarded =
                report.mvp?.id === row.id &&
                report.mvp.type === row.type &&
                !row.retired;
              return (
                <li
                  key={`${row.id}:${row.type}`}
                  className={awarded ? 'awarded' : ''}
                >
                  <div className="wave-damage-heading">
                    <span className="wave-damage-rank">{index + 1}</span>
                    <div className="wave-damage-name">
                      <strong>{TOWERS[row.type].name}</strong>
                      <small>
                        {row.x + 1}列 {row.y + 1}行 · #{row.id} · MVP{' '}
                        {row.mvpLevel}级
                      </small>
                    </div>
                    <div className="wave-damage-value">
                      <strong>{number(row.total)}</strong>
                      <small>
                        {total ? ((row.total / total) * 100).toFixed(1) : '0.0'}
                        %
                      </small>
                    </div>
                  </div>
                  <div className="wave-damage-bar" aria-hidden="true">
                    <span
                      style={{
                        width: `${(row.total / maximum) * 100}%`,
                        backgroundColor: TOWERS[row.type].color,
                      }}
                    />
                  </div>
                  <dl className="wave-damage-types">
                    <div>
                      <dt>物理</dt>
                      <dd>{number(row.physical)}</dd>
                    </div>
                    <div>
                      <dt>魔法</dt>
                      <dd>{number(row.magic)}</dd>
                    </div>
                    <div>
                      <dt>纯粹</dt>
                      <dd>{number(row.pure)}</dd>
                    </div>
                    {row.unclassified > 0 && (
                      <div>
                        <dt>未分类</dt>
                        <dd>{number(row.unclassified)}</dd>
                      </div>
                    )}
                  </dl>
                  <p className="wave-damage-note">
                    计分 {number(row.score)} · 击杀 {row.kills}
                    {row.retired
                      ? ' · 已合成，不参与评选'
                      : awarded
                        ? ` · 本波MVP → ${report.mvp!.level}级`
                        : row.mvpLevel === 10
                          ? ' · 满级，不参与评选'
                          : row.score === 0
                            ? ' · 无有效计分'
                            : ''}
                  </p>
                </li>
              );
            })}
          </ol>
          {!rows.length && <p className="muted">本波没有参与战斗的宝石。</p>}
        </>
      )}
      <p className="muted wave-damage-explanation">
        实际伤害统计敌人扣除的生命，包含小数，不含溢出伤害。MVP按每次伤害向下取整后累计；满级塔和已合成材料不参与评选。材料伤害保留在原行，成品从零计分。打开面板会暂停战斗。
      </p>
    </div>
  );
}
