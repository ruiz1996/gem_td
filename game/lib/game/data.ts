import historical from '../../data/historical.json';

export const DATA_VERSION = '2018-snapshot-mobile-alpha-2-solo37';
export const CELL_UNITS = 128;
export const STEP = 1 / 30;
export { BOARD } from './map';
export type Aura = {
  id: string;
  range: number;
  speed?: number;
  damage?: number;
  reach?: number;
  armor?: number;
  slow?: number;
  slowPct?: number;
  resist?: number;
  trueSight?: boolean;
  cannotMiss?: boolean;
  immunity?: boolean;
};
export type TowerDef = {
  id: string;
  name: string;
  english: string;
  family: string;
  quality: number;
  color: string;
  damage: number;
  interval: number;
  range: number;
  bonusSpeed: number;
  recipes: string[][];
  effects: {
    slow: number;
    poison: number;
    pierce: number;
    splash: number;
    splashRange: number;
    targets: number;
    crit: number;
    burn: number;
    burnRange: number;
    burnInterval: number;
    stun: number;
    lightning: number;
    fork: number;
    heal: number;
  };
  auras: Aura[];
  notes: string[];
  source: string;
};
type RecordRow = { title: string; fields: { [key: string]: string[] } };
export const FAMILIES: Record<
  string,
  { name: string; color: string; role: string }
> = {
  B: { name: '蓝宝石', color: '#63a8ff', role: '减速' },
  D: { name: '钻石', color: '#e0eafa', role: '物理输出' },
  E: { name: '蛋白石', color: '#ffc99b', role: '攻速 · 显隐' },
  G: { name: '翡翠', color: '#48db96', role: '持续毒伤' },
  P: { name: '紫晶', color: '#bc93ff', role: '削减护甲' },
  Q: { name: '海蓝宝石', color: '#65dfec', role: '快速攻击' },
  R: { name: '红宝石', color: '#ff778f', role: '范围溅射' },
  Y: { name: '黄玉', color: '#ebce6b', role: '多重攻击' },
};
export const QUALITY = ['', '碎裂', '瑕疵', '普通', '无暇', '完美', '巨大'];
const chinese = [
  '白银',
  '白银骑士',
  '粉红钻石',
  '巨型粉红钻石',
  '光明之山',
  '孔雀石',
  '鲜艳的孔雀石',
  '铀238',
  '铀235',
  '衰变凯帕铀',
  '星彩红宝石',
  '血红火山',
  '鸡血石',
  '古代鸡血石',
  '黑王子皇冠红宝石',
  '玉',
  '芙蓉石',
  '海洋青玉',
  '花果山仙丹',
  '金刚石库利南',
  '吉祥的中国玉',
  '迷人的青金石',
  '护国神异石',
  '金',
  '埃及金',
  '黑暗翡翠',
  '翡翠魔像',
  '帕拉伊巴碧玺',
  '精雕帕拉伊巴碧玺',
  '斯里兰卡之星',
  '深海珍珠',
  '黑色猫眼石',
  '红珊瑚',
  '天然祖母绿',
  '一家之石',
  '黄彩蓝宝石',
  '海豹',
  '星光蓝宝石',
  '黑曜石',
  '玛瑙',
  '虾美石',
  '歌鸾石',
  '燃烧之石',
  '镇家之石',
];
const rows = [
  ...historical.pages.baseTowers.records,
  ...historical.pages.advancedTowers.records,
] as RecordRow[];
const names = new Map<string, string>();
for (const r of rows)
  names.set(r.fields.English[0].split(' / ')[0], r.fields.Code[0]);
for (const r of historical.pages.baseTowers.records)
  names.set(r.fields.English[0].split(' / ')[1], r.fields.Code[0]);
const number = (text: string | undefined) =>
  Number.parseFloat(text ?? '0') || 0;
export const TOWERS: Record<string, TowerDef> = {};
rows.forEach((r, index) => {
  const f = r.fields,
    id = f.Code[0],
    short = f.English[0].split(' / ')[1] ?? '',
    family = index < 48 ? short[0] : 'S',
    quality = index < 48 ? Number(short[1]) : 0;
  const damageRaw = f['Attack Damage']?.[0] ?? '0';
  const t: TowerDef = {
    id,
    name:
      index < 48
        ? `${QUALITY[quality]}${FAMILIES[family].name}`
        : chinese[index - 48],
    english: f.English[0].split(' / ')[0],
    family,
    quality,
    color:
      FAMILIES[family]?.color ??
      ['#d5dee9', '#e6cd79', '#f29dca', '#77e2bc'][index % 4],
    damage: number(damageRaw) + number(damageRaw.match(/\[\+(\d+)/)?.[1]),
    interval: number(f['Attack Rate']?.[0]) || 1,
    range: number(f['Attack Range']?.[0]) / CELL_UNITS,
    bonusSpeed: 0,
    recipes: [],
    effects: {
      slow: 0,
      poison: 0,
      pierce: 0,
      splash: 0,
      splashRange: 0,
      targets: 1,
      crit: 0,
      burn: 0,
      burnRange: 0,
      burnInterval: 0.5,
      stun: 0,
      lightning: 0,
      fork: 0,
      heal: 0,
    },
    auras: [],
    notes: [],
    source: index < 48 ? 'S02-base' : 'S02-advanced',
  };
  for (const a of f.Ability ?? []) {
    const level = number(a.match(/(\d+)$/)?.[1]) || 1;
    if (/^tower_slow\d/.test(a))
      t.effects.slow = [0, 60, 90, 120, 150, 180, 480][level];
    else if (/^tower_du\d/.test(a))
      t.effects.poison = [0, 2, 4, 8, 16, 32, 128][level];
    else if (/^tower_jianjia\d/.test(a)) t.effects.pierce = 2 ** level;
    else if (/^tower_jianshe\d/.test(a)) {
      t.effects.splash = [0, 0.3, 0.4, 0.5, 0.6, 0.7, 1][level];
      t.effects.splashRange =
        [0, 300, 350, 400, 450, 500, 700][level] / CELL_UNITS;
    } else if (a.startsWith('tower_fenliejian'))
      t.effects.targets = a.endsWith('_you')
        ? 10
        : a.endsWith('_xianyan')
          ? 5
          : 3;
    else if (a.startsWith('tower_baoji')) t.effects.crit = 0.1;
    else if (a === 'tower_speed1' || a === 'tower_speed2')
      t.bonusSpeed = a === 'tower_speed1' ? 200 : 500;
    else if (a.startsWith('tower_speed_aura'))
      t.auras.push({
        id: a,
        range: (a.endsWith('guichu') ? 200 : 664) / CELL_UNITS,
        speed: a.endsWith('guichu') ? 200 : [0, 20, 30, 40, 50, 60, 70][level],
      });
    else if (a === 'tower_true_sight')
      t.auras.push({ id: a, range: 600 / CELL_UNITS, trueSight: true });
    else if (a.startsWith('tower_huiyao')) {
      t.effects.burn = [0, 60, 320, 2500][level];
      t.effects.burnRange = [0, 400, 500, 800][level] / CELL_UNITS;
      t.effects.burnInterval = level === 3 ? 2 : 0.5;
    } else if (a.startsWith('tower_zheyi'))
      t.auras.push({
        id: a,
        range: 600 / CELL_UNITS,
        armor: level === 3 ? 64 : 10,
        slow: level === 3 ? 480 : 250,
        resist: level === 1 ? 0 : level === 2 ? 50 : 100,
      });
    else if (a === 'tower_jin' || a === 'tower_jin2')
      t.effects.pierce = a === 'tower_jin' ? 32 : 48;
    else if (a === 'tower_shechengguanghuan')
      t.auras.push({ id: a, range: 290 / CELL_UNITS, reach: 300 / CELL_UNITS });
    else if (a === 'tower_jingzhun')
      t.auras.push({ id: a, range: 300 / CELL_UNITS, cannotMiss: true });
    else if (a === 'tower_maoyan')
      t.auras.push({ id: a, range: 500 / CELL_UNITS, damage: 0.5 });
    else if (a.startsWith('tower_bixi'))
      t.auras.push({
        id: a,
        range: (level === 1 ? 800 : 1200) / CELL_UNITS,
        armor: level === 1 ? 15 : 30,
      });
    else if (a.startsWith('tower_lanbaoshi'))
      t.auras.push({
        id: a,
        range: (level === 1 ? 300 : 556) / CELL_UNITS,
        slowPct: level === 1 ? 0.7 : 0.75,
      });
    else if (a === 'tower_chenmoguanghuan')
      t.auras.push({ id: a, range: 600 / CELL_UNITS, immunity: true });
    else if (a === 'tower_10jiyun') t.effects.stun = 0.1;
    else if (a === 'tower_shandianlian') t.effects.lightning = 0.3;
    else if (a === 'tower_chazhuangshandian') t.effects.fork = 0.25;
    else if (a === 'tower_zhongguoyu') {
      t.effects.heal = 0.01;
      t.notes.push('回血触发量暂按1点，待原脚本核实');
    } else if (!a.startsWith('tower_attack'))
      t.notes.push(`${a}：脚本效果未还原`);
  }
  for (const formula of (f.Combination ?? []).flatMap((x) => x.split(' | '))) {
    const recipe = formula.split(' + ').map((x) => names.get(x.trim()) ?? '');
    if (recipe.every(Boolean)) t.recipes.push(recipe);
    else t.notes.push(`配方待核实：${formula}`);
  }
  TOWERS[id] = t;
});
export const BASIC_IDS = Object.values(TOWERS)
  .filter((t) => t.quality > 0)
  .map((t) => t.id);
export function basicId(family: string, quality: number) {
  return `gemtd_${family.toLowerCase()}${'1'.repeat(quality)}`;
}
export const RECIPES = Object.values(TOWERS).flatMap((t) =>
  t.recipes.map((materials, i) => ({
    id: `${t.id}:${i}`,
    result: t.id,
    materials,
  })),
);
export type Recipe = (typeof RECIPES)[number];
export type Wave = {
  index: number;
  name: string;
  id: string;
  hp: number;
  speed: number;
  armor: number;
  resist: number;
  flying: boolean;
  boss: boolean;
  invisible: boolean;
  evasion: number;
  physicalImmune: boolean;
  magicImmune: boolean;
  count: number;
  spawnEvery: number;
  leak: number;
  notes: string[];
};
const waveRows = historical.pages.creeps.records as RecordRow[];
const waveNames = [
  '狂暴野猪',
  '迅捷青蛙',
  '高山牦牛',
  '机械助手',
  '飞行小熊猫',
  '自然树墩',
  '巨蜥',
  '隐形蜘蛛',
  '闪避小狗',
  '不屈战犬',
  '绒毛羊',
  '羊驼',
  '粉豚公主',
  '斗牛犬',
  '飞行天猫',
  '迅捷魔童',
  '勇敢小鸡',
  '小八戒',
  '疾跑神兔',
  '虎啸桃',
  '死亡撕裂者',
  '重甲咬人箱',
  '物免大嘴箱',
  '机械战驴',
  '飞行火星车',
  '滑板火烈鸟',
  '金鱼',
  '幼龙',
  '飞狐',
  '魔法飞毯',
  '魔典小龙',
  '充能鲨鱼',
  '飞僵小宝',
  '血魔宝宝',
  '金银狐灵',
  '翠花',
  '小白虎',
  '小星月',
  '两栖鱼孩',
  '鬼笑邪灵',
  '翠玉小龙',
  '扫蝶库普',
  '毛毛鱼',
  '小蘑菇',
  '啾啾',
  '死亡信徒',
  '迅捷毛驴',
  '小飞侠',
  '巨鸟多多',
  '肉山宝宝',
];
export const WAVES: Wave[] = Array.from({ length: 50 }, (_, i) => {
  const r = waveRows.find((r) => r.title.startsWith(`Level ${i + 1} `));
  if (!r) throw new Error(`Missing wave ${i + 1}`);
  const f = r.fields,
    a = f.Ability ?? [],
    boss = (i + 1) % 10 === 0;
  return {
    index: i + 1,
    name: waveNames[i],
    id: f.Code[0],
    hp: number(f['HP (1-4 players) [Base]']?.[0]),
    speed: number(f['Movement (1-4 players) [Base]']?.[0]) / CELL_UNITS,
    armor: number(f.Armor?.[0]) + (a.includes('enemy_high_armor') ? 20 : 0),
    resist: number(f['Magic resistance']?.[0]),
    flying: f.Code[0].includes('_fly'),
    boss,
    invisible: a.includes('riki_permanent_invisibility'),
    evasion: a.includes('guai_shanbi') ? 0.5 : 0,
    physicalImmune: a.includes('enemy_wumian'),
    magicImmune: a.includes('enemy_momian'),
    count: boss ? 1 : 12,
    spawnEvery: boss ? 1 : 0.8,
    leak: boss ? 10 : 1,
    notes: a.filter(
      (x) =>
        ![
          'gemtd_guai_base',
          'riki_permanent_invisibility',
          'guai_shanbi',
          'enemy_wumian',
          'enemy_momian',
          'enemy_high_armor',
        ].includes(x),
    ),
  };
});
// Explicit prototype parameters, NOT extracted historical values.
export const MOBILE_RULES = {
  initialLife: 100,
  initialGold: 0,
  waveReward: 20,
  killGold: 1,
  qualityCosts: [30, 50, 80, 120],
  qualityWeights: [
    [100, 0, 0, 0, 0],
    [70, 25, 5, 0, 0],
    [40, 35, 20, 5, 0],
    [20, 30, 30, 18, 2],
    [10, 20, 30, 30, 10],
  ],
  minimumSpeed: 0.35,
  normalCount: 12,
};
