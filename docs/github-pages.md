# GitHub Pages 发布

仓库：https://github.com/ruiz1996/gem_td

发布目标：https://ruiz1996.github.io/gem_td/ （以 Actions 成功部署为准）。

## 默认发布约定

用户于2026-09-07授权本项目后续每轮修改完成后直接推送GitHub，无需再次确认。完成相关检查后提交并推送main，确认现有Actions发布结果，再交付试玩入口。若用户某次明确要求仅本地修改或暂不发布，则按该次要求处理。此约定也记录于根目录[AGENTS.md](../AGENTS.md)。

仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。首次启用需要仓库管理员操作。此后推送 main 会自动进行类型检查、规则测试、静态构建和发布，也可在 Actions 手动运行 Publish Gem TD to GitHub Pages。

## 本地检查

在 game 目录运行：

```sh
npm ci
npm run typecheck
npm test
npm run build:pages
npm run preview:pages
```

打开终端地址的 `/gem_td/` 路径。产物在 `game/dist-pages/`，仅含静态 HTML、CSS、JavaScript，不需要服务器或登录。Sites 构建仍使用 `npm run build`；两个入口共享同一套界面和游戏逻辑。

本地与 GitHub Actions 使用 Node.js 22。GitHub Pages 子路径在 `game/vite.pages.config.ts` 中配置；更改仓库名时同步修改 base。

Pages 网页是公开试玩地址。存档仅保存在当前浏览器的当前网站下，不上传 GitHub；原 Sites 地址的存档不会自动迁移。手机自动启用触屏模式，支持横竖屏；若识别不符，可在右上角操作设置切换。可添加到浏览器主屏幕；当前未实现离线缓存。

部署失败时先看仓库 Actions：构建失败查看 build 日志；Pages 配置或权限错误检查 Settings → Pages。首次启用后，可重跑失败的任务。

参考：[Vite 部署指南](https://vite.dev/guide/static-deploy.html#github-pages)、[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
