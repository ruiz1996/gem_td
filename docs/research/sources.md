# 资料来源索引

整理日期：2026-09-07。摘要用于后续检索，非网站全文存档。

“正文查阅”表示通过网页工具打开并获取正文；“搜索摘要”表示只取得搜索结果。2026-09-07补充：已取得S02仓库保存的固定版本Lua/NPC配置，并对部分核心规则完成逐项核对；尚非当前工作坊版本的完整验证。

## DOTA 2 资料

### S01 — 原版工作坊

- 链接：[Steam Workshop — GemTD](https://steamcommunity.com/sharedfiles/filedetails/?id=474619917)
- 归属：DOTA 2，工作坊物品 ID 474619917，页面标明 Drodo Studio／巨鸟多多工作室。
- 访问：2026-09-07，正文查阅。
- 摘要：地图介绍强调迷宫、挑战难度与重复游玩；作者介绍列出 Bocchi、ss.waiting、烧焦的鼠标、NAT。先前中文搜索摘要列出单人、合作与竞速模式。
- 用途：识别目标地图及后续更新记录入口。
- 限制：介绍页不提供完整数值表；页面显示的更新日期不足以锁定数据版本。网页模板与留言中的不可用信息，不能独立证明游戏当前可用或不可用。

### S02 — Dota 2 Gem TD Unofficial Website

- 链接：[Advanced Towers](https://clementbera.github.io/Website/advancedTowers.html)
- 归属：自称 DOTA 2 非官方资料站。
- 访问：2026-09-07，正文查阅。
- 摘要：提供合成塔配方、内部代码、攻击属性及技能描述；存在基础塔、怪物等关联页面入口。
- 已观察样本：白银的代码为 gemtd_baiyin，配方为 B1 + Y1 + D1；页面字段列出攻击 30、Attack Rate 1、射程 600。孔雀石配方为 E1 + Q1 + G1；星彩红宝石配方为 R2 + R1 + P1。
- 用途：后续原版配方和数值核实线索。
- 后续核查：资料站主页说明字段来自 VPK 提取；GitHub gh-pages 的末次提交为 [f424bb2](https://github.com/clementbera/Website/commit/f424bb2abbe9355f7cfa9a539e4e61512f027750)，日期 2018-06-10。已以该提交固定资料快照，并提取基础塔、进阶塔、怪物和石板的事实字段到 `game/data/historical.json`。
- 补充页面：[基础塔](https://clementbera.github.io/Website/baseTowers.html)、[怪物](https://clementbera.github.io/Website/creeps.html)、[石板](https://clementbera.github.io/Website/pedals.html)。完整地址与各页 SHA-256 在提取结果中。
- 限制：资料快照版本不等于精确地图版本。Attack Rate、脚本效果及当前版本差异仍需确认；不是当前地图的完整数值核实。
- 新增脚本证据：master提交[712f6a2](https://github.com/clementbera/Website/commit/712f6a2d0f68ea4049e8923917311f8d1a44dfc8)保存了用于生成页面的`GemTD-Generation/scripts/`。已下载检查Lua和NPC配置，锁定散列，整理200条单位事实及91条技能数值。具体来源、行号、前后对照与限制见[原版规则核对](../../game/docs/original-rules-audit.md)。

### S03 — Gem TD Helper

- 链接：[Gem TD Helper](https://gemtd.top/)
- 访问：2026-09-07，正文查阅。
- 摘要：展示基础合成、进阶宝石与石板材料辅助表，可以标记已获得材料。
- 用途：配方对照及交互参考。
- 限制：尚未明确版本归属，不能直接作为 DOTA 2 数值来源。

### S04 — DOTA 2 阵型分析

- 链接：[17173 — 阵型分析篇](https://dota2.17173.com/news/09282015/101627448_all.shtml)
- 日期：2015-09-28；访问：2026-09-07，搜索摘要。
- 摘要：面向已有基础的玩家，讨论阵型和成型顺序。
- 用途：历史迷宫策略线索；需继续打开正文和图示研究。
- 限制：老版本攻略，不代表当前地图参数。

### S05 — DOTA 2 造塔思路

- 链接：[17173 — 造塔思路攻略心得](https://dota2.17173.com/news/09302015/095812380.shtml)
- 日期：2015-09-30；访问：2026-09-07，搜索摘要。
- 摘要：讨论基础塔辅助价值、减速、光环和中国玉等合成塔的作用。
- 用途：历史配塔策略参考。
- 限制：尚未完整核对正文，与原版数据表的版本关系未知。

### S06 — 新手演示视频

- 链接：[B 站 — 单人新人上手小鹿开局保姆级通关攻略](https://www.bilibili.com/video/BV1wG4y1V7fm/)
- 访问：2026-09-07，搜索摘要；尚未观看视频。
- 摘要：标题与分类表明是 DOTA 2 宝石 TD 的小鹿开局教程。
- 用途：后续核实操作流程和界面。
- 限制：涉及英雄；首版不包含英雄技能。未观看部分不能作为已核实机制。

## 其他版本，仅作旁证

| ID | 来源链接 | 摘要及用途 | 版本限制／访问深度 |
| --- | --- | --- | --- |
| X01 | [Gem Tower Defense](https://gemtd.net/) | 网页玩法说明：每轮放 5 颗随机宝石，保留一颗，其余成石，怪物经过路标；可合成特殊宝石和石板 | 网页版，不能替代 DOTA 2 数值；搜索摘要及打开页面 |
| X02 | [KK 平台宝石 TD 攻略社区](https://www.kkdzpt.com/fab/5152/strategy) | 通关、迷宫及拆石折返攻略 | 魔兽地图相关；战斗拆石不适用本项目；搜索摘要 |
| X03 | [TapTap 宝石 TD](https://www.taptap.cn/app/38670) | 四七工作室手游，包含英雄、宝物、进阶宝石 | 独立手游；搜索摘要 |
| X04 | [TapTap 新手小贴士](https://www.taptap.cn/moment/15225032791820403) | 放置、保留、融合及配方操作提示；页面标注 2023-04-11 修改 | 手游规则与道具不能混入基线；搜索摘要 |
| X05 | [GemTDdotcomInsights](https://github.com/carlHR/GemTDdotcomInsights) | 作者整理网页游戏的塔、配方与计算观察 | 非 DOTA 2 数据；搜索摘要，未审查代码 |
| X06 | [Gem Tower Defense Plus](https://github.com/nvs/gem/blob/master/README.md) | README 明确该项目为 Warcraft III 的 Gem TD+，提供开发与版本入口 | 魔兽版本；不能因有源码就当作 DOTA 2 原版；搜索摘要 |
| X07 | [Gem Maze TD](https://gemmazetd.com/) | 开发者称其为面向 iPhone/iPad 的重新实现，并有图鉴入口 | 手机衍生作品；可参考体验，不作原版数值依据；搜索摘要 |

上表查阅日期均为 2026-09-07。尚未安装、试玩、下载或验证这些游戏。

## 技术资料

| ID | 来源 | 已获得信息 | 使用限制 |
| --- | --- | --- | --- |
| T01 | [Phaser 官方文档](https://docs.phaser.io/) | 支持桌面与手机浏览器，提供 WebGL/Canvas 渲染 | 官方搜索摘要，2026-09-07；尚未选择版本或进行本项目性能测试 |
| T02 | [Capacitor 官方文档](https://capacitorjs.com/docs) | 提供从 Web 技术构建 Android/iOS 应用的运行时与原生 API 接口 | 官方搜索摘要，2026-09-07；仅后续打包候选 |

## 新资料记录模板

- ID／标题：
- 完整链接：
- 查阅日期：
- 发布或更新日期：未知时明确标注。
- 游戏版本／模式：
- 来源类型及访问深度：官方、作者代码、社区整理、攻略、视频；正文、摘要或实测。
- 简要事实摘要：
- 能支持哪些字段或规则：
- 不确定性及冲突：
- 关联数据记录／决策：

## 地图修正补充（2026-09-07）

新增两个直接读取公开配置的来源：Maze designer solo 模式和 GemTD Fansite 1p 模式。37×37、七个路点与32块初始石头经脚本逐项交叉验证。详见[地图考据](original-map.md)，配置含脚本 URL 与 SHA-256。
