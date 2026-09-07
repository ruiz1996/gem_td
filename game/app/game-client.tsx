'use client';
/* oxlint-disable react/react-compiler -- This imperative Phaser bridge intentionally samples a mutable fixed-step engine at 8 Hz. It opts out of memoization; rendering is explicitly refreshed after commands and simulation updates. */
import { useEffect, useRef, useState, useReducer } from 'react';
import {
  Diamond,
  Heart,
  Coins,
  Play,
  Pause,
  FastForward,
  BookOpen,
  HelpCircle,
  RotateCcw,
  Route,
  Plus,
  Minus,
  Maximize2,
  ChevronRight,
  Check,
  Layers,
  X,
  Flag,
  ArrowUpRight,
  Save,
  Shield,
  Wind,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  BOARD,
  FAMILIES,
  MOBILE_RULES,
  STEP,
  TOWERS,
  WAVES,
  type Recipe,
} from '@/lib/game/data';
import {
  canPlace,
  combine,
  describe,
  freshGame,
  fuse,
  fuseOptions,
  getGem,
  keep,
  loadGame,
  materialPool,
  place,
  recipesFor,
  removeStone,
  saveGame,
  startWave,
  tick,
  waveInfo,
  type GameState,
} from '@/lib/game/engine';
import { createBoard, type BoardView } from '@/lib/game/board';
const SAVE_KEY = 'gemtd-mobile-save-v1';
type Preview = {
  recipe: Recipe;
  ids: number[];
  anchor: number;
  slot: number;
  wasPaused: boolean;
};
export default function GemGame() {
  'use no memo'; // The fixed-step game engine is mutable; this bridge samples it explicitly.
  const [initialState] = useState(() => freshGame(20260907));
  const state = useRef<GameState>(initialState);
  const board = useRef<HTMLDivElement>(null);
  const [, refresh] = useReducer((x) => x + 1, 0);
  const view = useRef<BoardView>({
    state: state.current,
    selected: null,
    pending: null,
    materials: [],
    anchor: null,
    candidateIds: [],
    showPath: true,
    zoom: 1,
    panX: 0,
    panY: 0,
  });
  const [ready, setReady] = useState(false),
    [boardError, setBoardError] = useState(''),
    [notice, setNotice] = useState('点选空格，开始布置宝石'),
    [modal, setModal] = useState<'help' | 'library' | 'waves' | null>(null),
    [restart, setRestart] = useState(false),
    [saved, setSaved] = useState<string | null>(null),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [zoom, setZoom] = useState(1),
    [saveStatus, setSaveStatus] = useState('自动存档'),
    [preview, setPreview] = useState<Preview | null>(null);
  const previewRef = useRef<Preview | null>(null),
    modalPause = useRef(false),
    restartPause = useRef(false),
    readyRef = useRef(false),
    noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    callbacks = useRef<(x: number, y: number) => void>(() => {});
  const s = state.current,
    v = view.current,
    selected = getGem(s, v.selected),
    selectedTower = selected && TOWERS[selected.type],
    w = waveInfo(s);
  function notify(message: string) {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 5000);
  }
  function persist() {
    if (!readyRef.current) return;
    try {
      localStorage.setItem(SAVE_KEY, saveGame(state.current));
      setSaveStatus('已自动保存');
    } catch {
      setSaveStatus('保存失败');
    }
  }
  function act(fn: () => void) {
    try {
      fn();
      refresh();
      persist();
    } catch (error) {
      notify(error instanceof Error ? error.message : '操作未完成');
    }
  }
  function closePreview() {
    const p = previewRef.current;
    if (p) state.current.paused = document.hidden ? true : p.wasPaused;
    previewRef.current = null;
    setPreview(null);
    view.current.materials = [];
    view.current.candidateIds = [];
    view.current.anchor = null;
    refresh();
  }
  function updatePreview(p: Preview) {
    previewRef.current = p;
    setPreview({ ...p });
    view.current.materials = p.ids;
    view.current.anchor = p.anchor;
    const anchor = getGem(state.current, p.anchor)!;
    view.current.candidateIds = materialPool(state.current, anchor)
      .filter(
        (g) =>
          g.type === p.recipe.materials[p.slot] &&
          (!p.ids.includes(g.id) || p.ids[p.slot] === g.id),
      )
      .map((g) => g.id);
    refresh();
  }
  function openPreview(recipe: Recipe, ids: number[]) {
    const anchor = view.current.selected!;
    const slot = ids.findIndex((id) => id !== anchor);
    const p = {
      recipe,
      ids: [...ids],
      anchor,
      slot: Math.max(0, slot),
      wasPaused: state.current.paused,
    };
    state.current.paused = true;
    view.current.pending = null;
    updatePreview(p);
  }
  function openModal(value: 'help' | 'library' | 'waves') {
    if (previewRef.current) return;
    modalPause.current = state.current.paused;
    state.current.paused = true;
    setModal(value);
    refresh();
  }
  function closeModal() {
    state.current.paused = document.hidden ? true : modalPause.current;
    setModal(null);
    refresh();
  }
  callbacks.current = (x, y) => {
    if (
      x < 0 ||
      x >= BOARD.width ||
      y < 0 ||
      y >= BOARD.height ||
      !readyRef.current
    )
      return;
    const current = state.current,
      gem = current.gems.find((g) => g.x === x && g.y === y),
      p = previewRef.current;
    if (p) {
      if (!gem) return;
      if (p.ids[p.slot] === p.anchor) {
        notify('成品位置固定；可取消后选另一颗材料发起合成');
        return;
      }
      if (
        gem.type !== p.recipe.materials[p.slot] ||
        gem.candidate !== getGem(current, p.anchor)?.candidate
      ) {
        notify('请选择高亮的同种、同品质材料');
        return;
      }
      if (p.ids.includes(gem.id) && p.ids[p.slot] !== gem.id) {
        notify('这颗宝石已用于另一材料槽');
        return;
      }
      const ids = [...p.ids];
      ids[p.slot] = gem.id;
      updatePreview({ ...p, ids });
      return;
    }
    if (gem) {
      view.current.selected = gem.id;
      view.current.pending = null;
      refresh();
      return;
    }
    const error = canPlace(current, x, y);
    if (error) {
      notify(error);
      view.current.selected = null;
      view.current.pending = null;
      refresh();
      return;
    }
    view.current.pending = { x, y };
    view.current.selected = null;
    refresh();
  };
  useEffect(() => {
    let disposed = false,
      destroy: (() => void) | undefined;
    createBoard(
      board.current!,
      () => view.current,
      (x, y) => callbacks.current(x, y),
      setZoom,
    )
      .then((fn) => {
        if (disposed) fn();
        else destroy = fn;
      })
      .catch((e) => setBoardError('棋盘初始化失败：' + e.message));
    try {
      const data = localStorage.getItem(SAVE_KEY);
      if (data) setSaved(data);
      else {
        state.current = freshGame(
          crypto.getRandomValues(new Uint32Array(1))[0],
        );
        view.current.state = state.current;
        readyRef.current = true;
        setReady(true);
        if (!localStorage.getItem('gemtd-mobile-help-v1')) {
          state.current.paused = true;
          setModal('help');
          localStorage.setItem('gemtd-mobile-help-v1', '1');
        }
      }
    } catch {
      readyRef.current = true;
      setReady(true);
      setSaveStatus('存档不可用');
    }
    let raf = 0,
      last = 0,
      acc = 0,
      ui = 0,
      saveClock = 0;
    const frame = (now: number) => {
      if (disposed) return;
      const delta = last ? Math.min(0.2, (now - last) / 1000) : 0;
      last = now;
      const cur = state.current;
      if (
        readyRef.current &&
        !document.hidden &&
        cur.phase === 'combat' &&
        !cur.paused
      ) {
        acc += delta * cur.speed;
        while (acc >= STEP) {
          tick(cur);
          acc -= STEP;
          if ((cur as GameState).phase !== 'combat') {
            acc = 0;
            persist();
            refresh();
            if ((cur as GameState).phase === 'prepare')
              notify(
                '第 ' +
                  (cur.wave - 1) +
                  ' 波结束 · 击杀 ' +
                  cur.waveKills +
                  ' · 漏怪 ' +
                  cur.waveLeaks,
              );
            break;
          }
        }
      } else acc = 0;
      ui += delta;
      saveClock += delta;
      if (ui > 0.12) {
        ui = 0;
        refresh();
      }
      if (saveClock > 5) {
        saveClock = 0;
        if (readyRef.current && cur.phase === 'combat') persist();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const hide = () => {
      if (document.hidden) {
        state.current.paused = true;
        persist();
        refresh();
      }
    };
    const exit = () => persist();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewRef.current) closePreview();
    };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', exit);
    window.addEventListener('keydown', key);
    return () => {
      disposed = true;
      destroy?.();
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', exit);
      window.removeEventListener('keydown', key);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);
  function newRun() {
    closePreview();
    state.current = freshGame(crypto.getRandomValues(new Uint32Array(1))[0]);
    Object.assign(view.current, {
      state: state.current,
      selected: null,
      pending: null,
      materials: [],
      candidateIds: [],
      anchor: null,
      zoom: 1,
      panX: 0,
      panY: 0,
    });
    setZoom(1);
    setSaved(null);
    setRestart(false);
    readyRef.current = true;
    setReady(true);
    persist();
    notify('新的一局已开始');
    refresh();
  }
  function resume() {
    try {
      state.current = loadGame(saved!);
      view.current.state = state.current;
      setSaved(null);
      readyRef.current = true;
      setReady(true);
      refresh();
      notify(
        state.current.phase === 'combat'
          ? '存档已恢复；战斗处于暂停状态'
          : '存档已恢复',
      );
    } catch (e) {
      notify((e as Error).message);
    }
  }
  const combinations = selected ? recipesFor(s, selected.id) : [];
  const list = Object.values(TOWERS).filter(
    (t) =>
      (filter === 'all' ||
        (filter === 'base' && !!t.quality) ||
        (filter === 'special' && !t.quality)) &&
      (!search ||
        (t.name + ' ' + t.english + ' ' + t.family + t.quality)
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  const complete = s.phase === 'won' || s.phase === 'lost';
  function adjustZoom(amount: number) {
    v.zoom = Math.max(1, Math.min(3, v.zoom + amount));
    if (v.zoom === 1) {
      v.panX = 0;
      v.panY = 0;
    }
    setZoom(v.zoom);
  }
  return (
    <main className="game-shell">
      <header className="topbar">
        <div className="brand">
          <Diamond size={27} />
          <strong>宝石 TD</strong>
          <span>迷宫实验室</span>
          <b className="alpha-tag">试玩</b>
        </div>
        <div className="resources">
          <span>
            <Heart size={16} />
            <strong>{Math.ceil(s.life)}</strong>
            <small>/ 100</small>
          </span>
          <span>
            <Coins size={16} />
            <strong>{s.gold}</strong>
          </span>
          <span className="wave-number">
            波次 <strong>{String(s.wave).padStart(2, '0')}</strong>
            <small>/ 50</small>
          </span>
        </div>
        <div className="header-actions">
          <Button
            variant="ghost"
            title="玩法说明"
            aria-label="玩法说明"
            onClick={() => openModal('help')}
            disabled={!!preview}
          >
            <HelpCircle />
          </Button>
          <Button
            variant="ghost"
            title="重新开始"
            aria-label="重新开始"
            onClick={() => {
              restartPause.current = s.paused;
              s.paused = true;
              setRestart(true);
            }}
            disabled={!!preview || !ready}
          >
            <RotateCcw />
          </Button>
        </div>
      </header>
      <div className="workspace">
        <section className="board-wrap">
          <div className="board-heading">
            <span>
              <i />
              经典单人地图 <small>1P</small>
            </span>
            <span className="phase-label">
              {complete
                ? '本局结算'
                : s.phase === 'combat'
                  ? s.paused
                    ? '战斗已暂停'
                    : '防守进行中'
                  : '准备阶段'}
            </span>
            <span className="map-size">
              {BOARD.width} × {BOARD.height}
            </span>
          </div>
          <div className="board-stage">
            <div
              ref={board}
              className="phaser-host"
              aria-label="宝石棋盘：点选空格后确认建造，点选宝石查看详情，双指缩放地图"
            />
            {boardError && (
              <div className="board-message" role="alert">
                {boardError}
                <Button onClick={() => location.reload()}>重新加载</Button>
              </div>
            )}
            {!ready && saved && (
              <div className="board-message">
                <Save size={26} />
                <h2>继续上次的迷宫</h2>
                <p>新版存档可继续。规则版本不兼容时，请开始新局。</p>
                <Button className="primary-action" onClick={resume}>
                  继续游戏 <Play size={16} />
                </Button>
                <Button variant="ghost" onClick={() => setRestart(true)}>
                  开始新局
                </Button>
              </div>
            )}
            {complete && (
              <div className="board-message">
                <Flag size={30} />
                <small>
                  {s.phase === 'won'
                    ? '50 波防线守住了'
                    : '每一次布局，都是新的可能'}
                </small>
                <h2>{s.phase === 'won' ? '防守成功' : '防线失守'}</h2>
                <p>
                  抵达第 {s.wave} 波 · 击杀 {s.kills} · 漏怪 {s.leaks}
                </p>
                <Button
                  className="primary-action"
                  onClick={() => {
                    restartPause.current = s.paused;
                    setRestart(true);
                  }}
                >
                  再开一局 <RotateCcw size={16} />
                </Button>
              </div>
            )}
            {preview && (
              <div className="preview-banner">
                <Layers size={16} />
                合成预览 · 战斗暂停 · 点击高亮宝石替换材料
              </div>
            )}
            {s.phase === 'combat' && s.paused && !preview && !modal && (
              <div className="pause-banner">
                <Pause size={16} />
                已暂停
                <Button
                  variant="ghost"
                  onClick={() =>
                    act(() => {
                      s.paused = false;
                    })
                  }
                >
                  继续
                </Button>
              </div>
            )}
          </div>
          <div className="board-toolbar">
            <div className="legend">
              <span>
                <i className="legend-path" />
                怪物路线
              </span>
              <span className="legend-new">
                <i />
                本轮候选
              </span>
              <span className="legend-terrain">金色禁建 · 绿地可造</span>
            </div>
            <div className="map-controls">
              <Button
                variant="ghost"
                aria-label={v.showPath ? '隐藏路径' : '显示路径'}
                onClick={() => {
                  v.showPath = !v.showPath;
                  refresh();
                }}
                className={v.showPath ? 'active' : ''}
              >
                <Route />
              </Button>
              <Button
                variant="ghost"
                aria-label="缩小棋盘"
                onClick={() => adjustZoom(-0.25)}
                disabled={zoom <= 1}
              >
                <Minus />
              </Button>
              <span>{Math.round(zoom * 100)}%</span>
              <Button
                variant="ghost"
                aria-label="放大棋盘"
                onClick={() => adjustZoom(0.25)}
                disabled={zoom >= 3}
              >
                <Plus />
              </Button>
              <Button
                variant="ghost"
                aria-label="棋盘居中"
                onClick={() => {
                  v.zoom = 1;
                  v.panX = 0;
                  v.panY = 0;
                  setZoom(1);
                }}
              >
                <Maximize2 />
              </Button>
            </div>
          </div>
        </section>
        <aside className="inspector">
          <div className="wave-card">
            <div className="eyebrow">
              {s.phase === 'combat' ? '当前敌人' : '下一波'}
              <Button
                variant="ghost"
                onClick={() => openModal('waves')}
                disabled={!!preview}
              >
                波次表 <ArrowUpRight size={13} />
              </Button>
            </div>
            <h2>
              {w.name} {w.boss && <b className="boss-badge">BOSS</b>}
            </h2>
            <div className="enemy-info">
              <span>
                {w.flying ? <Wind size={13} /> : <Shield size={13} />}{' '}
                {w.flying ? '飞行' : '地面'}
              </span>
              <span>生命 {w.hp.toLocaleString()}</span>
              <span>护甲 {w.armor}</span>
            </div>
            {(w.invisible || w.variants.some((v) => v.invisible)) && (
              <p className="wave-warning">
                <Eye size={14} />
                隐形单位，需要蛋白石等显隐光环
              </p>
            )}
            {(w.physicalImmune || w.variants.some((v) => v.physicalImmune)) && (
              <p className="wave-warning">
                有物理免疫敌人，可用毒伤、灼烧或红宝石溅射
              </p>
            )}
            {(w.magicImmune || w.variants.some((v) => v.magicImmune)) && (
              <p className="wave-warning">有魔法免疫敌人，准备物理或纯粹伤害</p>
            )}
            {w.variants.length > 1 && (
              <p className="wave-warning">混合波：两种敌人随机出现</p>
            )}
            {s.phase === 'combat' && (
              <div className="wave-progress">
                <span style={{ width: (s.spawned / w.count) * 100 + '%' }} />
                <small>
                  已出怪 {s.spawned}/{w.count} · 场上 {s.enemies.length}
                </small>
              </div>
            )}
          </div>
          <div className="selection-content">
            {preview ? (
              <>
                <div className="section-title">
                  <span>合成预览</span>
                  <Button
                    variant="ghost"
                    onClick={closePreview}
                    aria-label="取消合成"
                  >
                    <X />
                  </Button>
                </div>
                <div className="gem-title">
                  <Diamond
                    style={{ color: TOWERS[preview.recipe.result].color }}
                    size={32}
                  />
                  <div>
                    <h2>{TOWERS[preview.recipe.result].name}</h2>
                    <p>
                      成品位置：{getGem(s, preview.anchor)!.x + 1},{' '}
                      {getGem(s, preview.anchor)!.y + 1}
                    </p>
                  </div>
                </div>
                <p className="muted">
                  选中材料槽，再点击棋盘高亮的宝石进行替换。
                </p>
                <div className="material-slots">
                  {preview.ids.map((id, i) => {
                    const g = getGem(s, id)!,
                      t = TOWERS[g.type];
                    return (
                      <Button
                        key={i}
                        variant="outline"
                        className={
                          'material-slot ' +
                          (preview.slot === i ? 'chosen' : '')
                        }
                        onClick={() => updatePreview({ ...preview, slot: i })}
                      >
                        <Diamond size={17} style={{ color: t.color }} />
                        <span>
                          {t.name}
                          <small>
                            {id === preview.anchor
                              ? '成品位置'
                              : '材料 ' + (i + 1)}{' '}
                            · {g.x + 1}, {g.y + 1}
                          </small>
                        </span>
                        {preview.slot === i && <Check size={14} />}
                      </Button>
                    );
                  })}
                </div>
                <p className="muted">其余材料原地变成石头，道路保持不变。</p>
                <Button
                  className="primary-action full"
                  onClick={() =>
                    act(() => {
                      combine(
                        s,
                        preview.recipe.id,
                        preview.anchor,
                        preview.ids,
                      );
                      closePreview();
                      notify('合成完成');
                    })
                  }
                >
                  确认合成 <Layers size={16} />
                </Button>
                <Button variant="ghost" className="full" onClick={closePreview}>
                  取消
                </Button>
              </>
            ) : v.pending ? (
              <>
                <div className="section-title">
                  放置宝石 <span>{s.placed}/5</span>
                </div>
                <div className="placement-mark">
                  <Plus size={34} />
                </div>
                <h2>在这里放置</h2>
                <p className="muted">
                  格子 {v.pending.x + 1}, {v.pending.y + 1}
                  <br />
                  确认后揭晓宝石种类与品质。
                </p>
                <Button
                  className="primary-action full"
                  onClick={() =>
                    act(() => {
                      const p = v.pending!;
                      const g = place(s, p.x, p.y);
                      v.selected = g.id;
                      v.pending = null;
                      notify(
                        TOWERS[g.type].name + ' · 已放置 ' + s.placed + '/5',
                      );
                    })
                  }
                >
                  确认放置 <Plus size={16} />
                </Button>
                <Button
                  variant="ghost"
                  className="full"
                  onClick={() => {
                    v.pending = null;
                    refresh();
                  }}
                >
                  取消
                </Button>
              </>
            ) : selected ? (
              <>
                <div className="section-title">
                  <span>
                    {selected.type === 'stone'
                      ? '迷宫石头'
                      : selected.candidate
                        ? '本轮候选'
                        : '已保留宝石'}
                  </span>
                  <span>
                    {selected.x + 1}, {selected.y + 1}
                  </span>
                </div>
                <div className="gem-title">
                  <Diamond
                    size={35}
                    style={{ color: selectedTower?.color ?? '#768694' }}
                  />
                  <div>
                    <h2>{selectedTower?.name ?? '石头'}</h2>
                    <p>
                      {selectedTower?.quality
                        ? selectedTower.family +
                          selectedTower.quality +
                          ' · ' +
                          FAMILIES[selectedTower.family].role
                        : (selectedTower?.english ?? '构筑你的防线')}
                    </p>
                  </div>
                </div>
                <p className="ability-text">{describe(selected.type)}</p>
                {selectedTower && (
                  <>
                    <div className="stat-grid">
                      <div>
                        <strong>{selectedTower.damage}</strong>
                        <small>攻击</small>
                      </div>
                      <div>
                        <strong>
                          {(
                            selectedTower.interval /
                            (1 + selectedTower.bonusSpeed / 100)
                          ).toFixed(2)}
                          <em>s</em>
                        </strong>
                        <small>基础间隔</small>
                      </div>
                      <div>
                        <strong>{selectedTower.range.toFixed(1)}</strong>
                        <small>射程 / 格</small>
                      </div>
                    </div>
                    {!selected.candidate && (
                      <p className="damage-stats">
                        本塔累计伤害{' '}
                        {Math.round(selected.damage).toLocaleString()} · 击杀{' '}
                        {selected.kills}
                      </p>
                    )}
                  </>
                )}
                {selected.type === 'stone' ? (
                  <Button
                    variant="outline"
                    className="full"
                    disabled={s.phase !== 'prepare'}
                    onClick={() =>
                      act(() => {
                        removeStone(s, selected.id);
                        v.selected = null;
                      })
                    }
                  >
                    拆除石头
                  </Button>
                ) : selected.candidate ? (
                  <>
                    <Button
                      className="primary-action full"
                      disabled={s.placed !== 5 || s.resolved}
                      onClick={() =>
                        act(() => {
                          keep(s, selected.id);
                          notify('已保留，其余候选变成石头');
                        })
                      }
                    >
                      {s.placed < 5
                        ? '还需放置 ' + (5 - s.placed) + ' 颗'
                        : '保留这颗宝石'}
                      <Check size={16} />
                    </Button>
                    {fuseOptions(s, selected.id).map((count) => (
                      <Button
                        key={count}
                        variant="outline"
                        className="full mt"
                        onClick={() =>
                          act(() => {
                            fuse(s, selected.id, count);
                            notify('同品质融合完成');
                          })
                        }
                      >
                        {count} 颗同级融合 → 品质 +{count === 4 ? 2 : 1}
                      </Button>
                    ))}
                  </>
                ) : null}
                {combinations.length > 0 && (
                  <div className="recipe-section">
                    <div className="section-title">
                      相关合成{' '}
                      <span>
                        {combinations.filter((x) => x.ids).length} 可合成
                      </span>
                    </div>
                    {combinations.map(({ recipe, ids }) => (
                      <Button
                        key={recipe.id}
                        variant="ghost"
                        className="recipe-option"
                        disabled={!ids || complete}
                        onClick={() => openPreview(recipe, ids!)}
                      >
                        <div>
                          <strong>{TOWERS[recipe.result].name}</strong>
                          <small>
                            {recipe.materials
                              .map((id) =>
                                TOWERS[id].quality
                                  ? TOWERS[id].family + TOWERS[id].quality
                                  : TOWERS[id].name,
                              )
                              .join(' + ')}
                          </small>
                        </div>
                        {ids ? (
                          <ChevronRight size={15} />
                        ) : (
                          <span className="missing">未凑齐</span>
                        )}
                      </Button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="section-title">
                  {s.resolved ? '布局已就绪' : '本轮建造'}{' '}
                  <span>{s.placed}/5</span>
                </div>
                <div className="build-steps">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className={i < s.placed ? 'filled' : ''}>
                      <Diamond size={19} />
                    </span>
                  ))}
                </div>
                <h2>
                  {s.phase === 'combat'
                    ? '防守正在进行'
                    : s.resolved
                      ? '准备迎接下一波'
                      : s.placed === 5
                        ? '选择一颗，留下它'
                        : '构筑你的迷宫'}
                </h2>
                <p className="muted">
                  {s.phase === 'combat'
                    ? '点击宝石查看输出与配方。战斗中可以合成，但不能建造或拆石。'
                    : s.resolved
                      ? '可以拆除石头调整路线，或查看宝石配方。准备好后开始防守。'
                      : s.placed === 5
                        ? '点击本轮任意一颗宝石，选择保留、同级融合或配方合成。'
                        : '点选空格，再确认放置。每轮揭晓 5 颗宝石，最终保留一颗，其余变成迷宫石头。'}
                </p>
                <div className="tip-block">
                  <Route size={19} />
                  <p>
                    让怪物绕得更远，
                    <br />
                    让宝石打得更久。
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="inspector-bottom">
            {!preview && s.phase === 'prepare' && (
              <div className="quality-row">
                <div>
                  <small>
                    宝石品质 <strong>Lv.{s.quality + 1}</strong>
                  </small>
                  <p>
                    当前：
                    {MOBILE_RULES.qualityWeights[s.quality]
                      .map((n, i) => (n ? i + 1 + '级 ' + n + '%' : null))
                      .filter(Boolean)
                      .join(' / ')}
                  </p>
                </div>
                <small title="击杀获得经验，自动提高后续出石品质">
                  {s.quality >= 4
                    ? '品质已满级'
                    : `经验 ${s.xp} / ${MOBILE_RULES.qualityXP[s.quality + 1]}`}
                </small>
              </div>
            )}
            <div className="combat-controls">
              <Button
                className="primary-action"
                disabled={
                  !ready ||
                  !!preview ||
                  complete ||
                  (s.phase === 'prepare' && !s.resolved)
                }
                onClick={() =>
                  act(() => {
                    if (s.phase === 'prepare') startWave(s);
                    else s.paused = !s.paused;
                  })
                }
              >
                {s.phase === 'combat' ? (
                  s.paused ? (
                    <>
                      <Play size={17} />
                      继续防守
                    </>
                  ) : (
                    <>
                      <Pause size={17} />
                      暂停
                    </>
                  )
                ) : (
                  <>
                    <Play size={17} />
                    开始第 {s.wave} 波
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="speed-button"
                onClick={() =>
                  act(() => {
                    s.speed = s.speed === 1 ? 2 : 1;
                  })
                }
                disabled={!!preview || !ready}
              >
                <FastForward size={16} />
                {s.speed}×
              </Button>
            </div>
            <Button
              variant="ghost"
              className="full codex-button"
              onClick={() => openModal('library')}
              disabled={!!preview}
            >
              <BookOpen size={16} />
              宝石图鉴与合成配方<span>{Object.keys(TOWERS).length}</span>
            </Button>
          </div>
        </aside>
      </div>
      <footer className="statusbar">
        <output className="status-notice" aria-live="polite">
          {notice || '双指缩放 · 放大后拖动棋盘 · 点击宝石查看配方'}
        </output>
        <span className="save-status">
          <i />
          {saveStatus}
        </span>
        <span className="version-label">历史数据试玩 · 参数校准中</span>
      </footer>
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
      >
        <DialogContent
          className={
            'game-dialog ' + (modal === 'library' ? 'wide-dialog' : '')
          }
        >
          <DialogTitle>
            {modal === 'library'
              ? '宝石图鉴'
              : modal === 'waves'
                ? '波次情报'
                : '欢迎来到宝石 TD'}
          </DialogTitle>
          <DialogDescription>
            {modal === 'library'
              ? '查看宝石属性与配方，规划你的下一次合成。'
              : modal === 'waves'
                ? '根据下一波的飞行、隐形与免疫能力安排防线。'
                : '随机选石、合成强塔，用迷宫守住每一波。'}
          </DialogDescription>
          {modal === 'help' && (
            <div className="help-content">
              <ol>
                <li>
                  <strong>放置 5 颗</strong>
                  <p>点选空格，确认建造后揭晓宝石。不能堵死路标之间的道路。</p>
                </li>
                <li>
                  <strong>留下一颗</strong>
                  <p>
                    选择保留、同品质融合，或者用本轮材料直接合成；其余候选变成石头。
                  </p>
                </li>
                <li>
                  <strong>守住路线</strong>
                  <p>
                    准备完成后开始下一波。飞行怪无视石头，隐形怪需要显隐光环。
                  </p>
                </li>
                <li>
                  <strong>合成由你决定</strong>
                  <p>
                    点选材料宝石发起合成，选择其他材料。预览时暂停，其他材料原地变石，战斗道路不变。
                  </p>
                </li>
              </ol>
              <p className="muted">
                支持 1× / 2×、本机自动存档。切换后台会暂停；横屏游玩更舒适。
              </p>
              <details>
                <summary>试玩数据说明</summary>
                <p>
                  宝石、配方和怪物基础属性来自 2018
                  年历史资料。地图采用交叉核对的 37×37 单人布局：入 → 1 → 2 → 3
                  → 4 → 5 → 终；金色出生区与终点区禁建，绿色参考道路可建造，32
                  块预置石头仅在准备阶段可拆。品质通过击杀经验自动提升；普通波从5只开始，连续三次90秒内无漏怪过关后增加1只，漏怪会减少后续数量，最低5只。Boss漏怪扣血随剩余生命变化。石板与部分特殊技能尚未实现。
                </p>
                <a
                  href="https://clementbera.github.io/Website/"
                  target="_blank"
                  rel="noreferrer"
                >
                  查看历史资料来源 ↗
                </a>
              </details>
              <Button className="primary-action full" onClick={closeModal}>
                开始布置 <ChevronRight size={16} />
              </Button>
            </div>
          )}
          {modal === 'library' && (
            <>
              <div className="library-controls">
                <input
                  aria-label="搜索宝石"
                  placeholder="搜索名称或代号，如 白银 / B1"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="filters">
                  {[
                    ['all', '全部'],
                    ['base', '基础宝石'],
                    ['special', '合成宝石'],
                  ].map(([key, label]) => (
                    <Button
                      key={key}
                      variant={filter === key ? 'default' : 'ghost'}
                      onClick={() => setFilter(key)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="library-list">
                {list.map((t) => (
                  <article key={t.id} className="library-gem">
                    <div className="library-gem-heading">
                      <Diamond size={23} style={{ color: t.color }} />
                      <div>
                        <h3>{t.name}</h3>
                        <small>
                          {t.quality ? t.family + t.quality : t.english}
                        </small>
                      </div>
                    </div>
                    <p>{describe(t.id)}</p>
                    <small>
                      攻击 {t.damage} · 基础间隔{' '}
                      {(t.interval / (1 + t.bonusSpeed / 100)).toFixed(2)}s ·
                      射程 {t.range.toFixed(1)} 格
                    </small>
                    {t.recipes.map((r, i) => (
                      <div key={i} className="formula">
                        {r.map((id) => TOWERS[id].name).join(' + ')}
                      </div>
                    ))}
                    {t.notes.length > 0 && (
                      <details>
                        <summary>存在待还原效果</summary>
                        <p>{t.notes.join('；')}</p>
                      </details>
                    )}
                    {!t.quality && !t.recipes.length && (
                      <small className="wave-warning">获得条件尚未还原</small>
                    )}
                  </article>
                ))}
                {!list.length && <p>没有找到匹配的宝石。</p>}
              </div>
            </>
          )}
          {modal === 'waves' && (
            <div className="waves-list">
              {WAVES.map((w) => (
                <div
                  key={w.index}
                  className={w.index === s.wave ? 'current' : ''}
                >
                  <strong>{String(w.index).padStart(2, '0')}</strong>
                  <span>
                    {w.name}
                    <small>
                      {[
                        w.flying ? '飞行' : '地面',
                        w.boss ? 'Boss' : '',
                        w.invisible ? '隐形' : '',
                        w.physicalImmune ? '物免' : '',
                        w.magicImmune ? '魔免' : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  </span>
                  <small>
                    生命 {w.hp.toLocaleString()}
                    <br />
                    护甲 {w.armor} · 魔抗 {w.resist}%
                  </small>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={restart}
        onOpenChange={(open) => {
          if (!open) {
            s.paused = restartPause.current;
            setRestart(false);
          }
        }}
      >
        <AlertDialogContent className="game-dialog">
          <AlertDialogTitle>开始新的一局？</AlertDialogTitle>
          <AlertDialogDescription>
            当前进度会被新局替代，本机只能保留一个存档。
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>返回游戏</AlertDialogCancel>
            <AlertDialogAction onClick={newRun}>开始新局</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
