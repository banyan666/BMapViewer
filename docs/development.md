# 开发与构建

## 仓库职责

- `src/sdk/`：可发布 SDK 源码，不能引用仓库外资源。
- `src/sdk/base-map/`：独立 BaseMaps 模块，包含底图管理器、Provider、投影与切片方案。
- `src/sdk/weather/`：WeatherEffects 后处理天气效果与生命周期管理器。
- `packages/cloud-ultra/`：`@b-map-viewer/cloud-ultra` 独立 npm 包，包含 Ultra 源码、着色器和资源。
- `examples/`：示例组件，开发服务器入口由 `src/App.vue` 提供。
- `docs/`：Markdown 文档。
- `docs/.vitepress/`：技术文档站点配置与主题。
- `BMapViewer/`：库模式构建产物，包含 ES Module、UMD 和样式文件。
- `demo-dist/`：示例站点构建产物，已加入 `.gitignore`。

## 常用命令

```bash
npm run dev
npm run build:lib
npm run build:cloud-ultra
npm run build:demo
npm run build
npm run preview
npm run docs:dev
npm run docs:build
npm run docs:preview
```

## 构建边界

库构建将 `vue` 与 `cesium` 外置，避免在应用中出现多个 Vue 或 Cesium 实例；`@turf/turf` 与 `uuid` 会随 SDK 打包，减少接入时的依赖配置。

Cesium 的 Workers 等运行时资源由应用侧的 `vite-plugin-cesium` 负责处理。

`vite.lib.config.ts` 仅构建主包到 `BMapViewer/`，不包含 Ultra。`vite.cloud-ultra.config.ts` 独立构建 Ultra 到 `packages/cloud-ultra/dist/`，仅将 `cesium` 外置；天气基类在构建时复用仓库源码并打入独立包，不形成主包运行时依赖。`cloudUltraAssets` 仅用于本仓库构建，接入方无需配置此插件。

示例通过源码别名解析 `@b-map-viewer/cloud-ultra`，仅进入 Ultra 案例时动态导入；发布包通过自身 `exports` 解析构建产物。在仓库根目录执行 `npm install` / `npm ci` 会统一安装 workspace 的开发依赖。

技术文档包含较多 GIF 演示资源，因此不会打入 npm SDK 包；它们随 Git 仓库和 VitePress 文档站点维护。

Cesium 1.118 的 KML 模块仍使用 `@zip.js/zip.js/lib/zip-no-worker.js` 子路径，因此项目固定 `@zip.js/zip.js@2.7.73`，避免新版移除该导出后导致 Vite 开发服务器预打包失败。

BaseMaps 中的地图 Provider、坐标转换、投影与自定义切片方案基于 Apache-2.0 许可的 [`@dvgis/cesium-map`](https://github.com/dvgis/cesium-map) 适配，已统一改用 BMapViewer 的 `cesium` peer dependency、ES Module 路径和生命周期规范。发布包会携带根目录 `NOTICE`。

## 发布前检查

1. 执行 `npm ci`。
2. 执行 `npm run build`。
3. 运行 `npm run dev`，检查初始化、底图切换、点击拾取、图层示例和天气切换。
4. 检查 `git status`，确认只包含本次发布需要的文件。

## GitHub Pages 自动部署

`.github/workflows/deploy-pages.yml` 会在代码推送到 `main` 分支后自动构建并发布，也可以在 GitHub Actions 页面手动执行。

Pages 产物由案例站与文档站组合而成：

- [在线预览](https://banyan666.github.io/BMapViewer/)：Vue 3 + Cesium 在线示例。
- [在线文档](https://banyan666.github.io/BMapViewer/docs/)：VitePress 技术文档。

工作流读取 GitHub Pages 返回的 `base_path` 动态生成部署子路径，因此同时兼容项目 Pages 和自定义域名。示例构建时通过 `VITE_DOCS_BASE_URL` 指向线上文档，文档构建时通过 `VITEPRESS_BASE` 设置 VitePress 的部署路径。

首次使用前，需要在 GitHub 仓库的 `Settings → Pages → Build and deployment → Source` 中选择 `GitHub Actions`。之后每次推送到 `main` 都会自动更新案例和文档。

## npm 发布

发布包名为 [`b-map-viewer`](https://www.npmjs.com/package/b-map-viewer)，公开安装命令如下：

```bash
npm install b-map-viewer cesium vue
```

首次发布需要在本机完成 npm 身份验证与 2FA。登录时显式指定 npm 官方 Registry，避免本机配置的 npmmirror 等下载镜像拦截账号认证：

```bash
npm login --registry=https://registry.npmjs.org/ --auth-type=web
npm whoami --registry=https://registry.npmjs.org/
npm run build:lib
npm run pack:check
npm publish
```

`prepublishOnly` 会在正式发布前再次构建 SDK，发布内容由 `package.json` 的 `files` 字段限制为 SDK 产物、README、LICENSE 和包元数据。

首次发布成功后，可在 npm 包设置中添加 GitHub Actions Trusted Publisher：

| 配置项 | 值 |
| --- | --- |
| GitHub 用户 | `banyan666` |
| Repository | `BMapViewer` |
| Workflow | `publish-npm.yml` |
| Allowed action | `npm publish` |

`.github/workflows/publish-npm.yml` 监听 `v*` 标签并使用 OIDC 发布，不需要在仓库中保存长期 `NPM_TOKEN`。后续版本发布流程：

```bash
npm version patch
git push --follow-tags
```

也可以根据语义化版本规则使用 `npm version minor` 或 `npm version major`。

## Ultra 独立包发布

`@b-map-viewer/cloud-ultra` 与 `b-map-viewer` 独立安装、独立版本、独立发布。主包不把 Ultra 声明为依赖或可选依赖，因此只安装主包不会下载 Ultra 资源。

首次发布前，需要在 npm 创建或拥有 `b-map-viewer` 作用域，并确保登录账号有该作用域的包发布权限。公开包已设置 `publishConfig.access: public`。

在仓库根目录执行：

```bash
npm login --registry=https://registry.npmjs.org/ --auth-type=web
npm whoami --registry=https://registry.npmjs.org/
npm run build:cloud-ultra
npm run pack:cloud-ultra
npm publish --workspace=@b-map-viewer/cloud-ultra --access public
```

`prepack` 会在打包或发布 Ultra 前重新构建，发布内容为 `dist`、README、LICENSE 与包元数据。第三方资源许可完整收录于 `dist/NOTICE`，不单独输出 `.txt`。`npm publish` 在根目录执行且不带 `--workspace` 时仍只发布主包。

后续更新 Ultra 版本：

```bash
npm version patch --workspace=@b-map-viewer/cloud-ultra --no-git-tag-version
npm run pack:cloud-ultra
npm publish --workspace=@b-map-viewer/cloud-ultra --access public
```

提交独立包的 `package.json` 和根目录 `package-lock.json`，保持版本记录一致。已经发布的版本不能覆盖；主包同样需要升级版本后再发布拆分结果，原来已发布的包不会自动变小。

自动发布使用 `.github/workflows/publish-cloud-ultra.yml`，标签格式为 `cloud-ultra-v1.0.0`（版本需匹配独立包）。首次手动发布后，在此包的 npm Trusted Publisher 中关联 `banyan666/BMapViewer` 和 `publish-cloud-ultra.yml`，再通过标签触发后续发布。主包的 `v*` 标签工作流不受影响。

## 社区 Fork 同步

`banyan666/BMapViewer` 是项目唯一的主仓库，代码提交、npm 发布和 GitHub Pages 部署都在主仓库完成。社区 Organization 中的 Fork 仅用于同步展示，不应直接维护发布版本。

社区 Fork 启用 GitHub Actions 后，`.github/workflows/sync-community-fork.yml` 会每 6 小时尝试将 `main` 分支快进到个人主仓库的最新提交，也可以在 Actions 页面手动运行。同步不会强制覆盖社区 Fork 的独立提交；如果分支已经产生冲突，任务会失败并保留现状，需要先处理差异。

Pages 和 npm 工作流都限制为只在 `banyan666/BMapViewer` 中运行，因此社区 Fork 不会重复部署站点或发布 npm 包。
