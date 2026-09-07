# 宝石 TD 手机试玩版

单人 2D 棋盘塔防。当前为 Alpha：可以建造、留石、融合、合成、防守、结算和续玩；不应视为已完成 DOTA 2 原版还原或后期平衡验收。

## 本地运行

需要 Node.js 22.13 或更高版本，使用 npm。

```sh
npm ci
npm run dev -- --host 0.0.0.0
```

打开终端打印的本地地址。同一局域网的安卓手机可尝试通过电脑局域网 IP 与该端口访问；需网络和防火墙允许。正式试玩以部署地址为准。

```sh
npm run typecheck
npm test
npm run balance:check
npm run build
```

## 文件位置

| 文件 | 用途 |
| --- | --- |
| `lib/game/engine.ts` | 独立规则层：阶段、合成、战斗和存档 |
| `lib/game/map.ts` / `pathfinding.ts` | 37×37 单人地图地形与八方向 A* 寻路 |
| `data/solo-map.json` | 单人地图坐标、禁建区、预置石头、来源散列 |
| `docs/solo-map-research.md` | 地图考据、依据与验证范围 |
| `lib/game/data.ts` | 将历史字段转成运行配置，并明确放置手机试玩参数 |
| `lib/game/board.ts` | Phaser 棋盘绘制、点选、拖动及双指缩放 |
| `app/game-client.tsx` | 手机界面、合成选材、图鉴、存档恢复 |
| `data/historical.json` | 固定历史快照中提取的事实字段，含来源 URL 与 SHA-256 |
| `scripts/extract-data.mjs` | 从固定提交重新提取数据：`npm run data:extract` |
| `tests/engine.test.ts` | 核心规则回归测试 |
| `scripts/balance-check.ts` | 多随机种子的简单自动策略，非最优解或通关证明 |
| `reports/balance-smoke.json` | 自动策略的波次、漏怪和伤害记录 |

需求、调研与项目决策位于上级目录的 [文档入口](../README.md)。

## 存档与界面

存档仅在当前浏览器本地保存，不跨设备同步。每次有效操作、波次切换和战斗约 5 秒间隔保存；恢复后暂停。不同配置版本的存档会被拒绝，不能直接覆盖解释为新版本。

React 界面以低频显式刷新读取可变模拟状态，Phaser 独立绘制。该桥接组件明确退出 React Compiler 自动记忆化；规则层保持不依赖 React。未来可将桥接进一步拆成 external store，但不可直接给可变状态套用自动记忆化。

## 已知边界

- 数据基于 2018 年非官方提取快照，并非当前地图版本。
- 部分脚本技能、石板和特殊获得条件尚未还原；图鉴保留名称与缺项说明。
- 历史配方的替代路径暂按可替代材料理解；目标版本的特殊触发条件仍需核实。
- 地图已按两套社区工具恢复单人布局；128距离单位/格仍待原文件核实。品质概率、出怪数量、经济与若干效果叠加属于试玩规则。
- 尚未完成安卓真机交互和性能验收，未制作 APK。
- 后期难度尚未证明合理；不要将自动测试中用于检查胜利状态的超高伤害夹具当作正常通关结果。

## GitHub Pages

运行 `npm run build:pages` 生成纯静态版本；`npm run preview:pages` 在本地预览 `/gem_td/`。GitHub Actions 配置位于仓库根目录的 `.github/workflows/pages.yml`，推送 main 后自动发布。详细设置见 [发布文档](../docs/github-pages.md)。
