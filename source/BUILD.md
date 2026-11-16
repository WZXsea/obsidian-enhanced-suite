# 源码构建

各插件保留原目录名、源码与构建输入。先在 source/ 执行 `npm ci` 安装共享工具链。

| 插件 | 构建命令（在对应子目录执行） |
| --- | --- |
| float-search | `pnpm install --frozen-lockfile`，随后 `pnpm build` |
| image-toolkit-upgraded | `npm run build` |
| image-layouts-enhanced | `npm run build` |
| table-column-resize-custom | `python3 build.py` |
| citation-badges | `npm run build` |
| transparent-outline | `npm run build` |

本次 Image Toolkit 1.4.19 通过 54 项自动测试与 TypeScript 构建；在 image-toolkit-upgraded/ 执行 `npm test` 可运行回归。macOS 实机复制结果及先前组件的验收记录见总包 verification.json。各上游许可和署名见对应目录 LICENSE 或 THIRD-PARTY-NOTICES.md。

本轮 Table Column Resize 1.0.5 通过 36 项测试，可在 table-column-resize-custom/ 执行 `node --test tests/*.test.cjs` 运行。实机覆盖实时预览与阅读视图的同文字合并、单格文字扩展空格、拖动选区、首尾点击及取消恢复。

Table Column Resize 1.0.6 的菜单定位修复通过 39 项自动回归、构建及 macOS 滚动跟随核验。

Image Layouts Enhanced 0.1.10：`npm run test:gallery-height` 执行 12 项图库高度回归；`npm test` 保留 10 项图片功能检查；`npm run build` 完成 TypeScript 检查及打包。
