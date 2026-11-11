# 源码构建

各插件目录保留对应源码、构建配置和已有测试，原目录名用于保留共享工具链与跨插件相对导入。先在 source/ 执行 `npm ci`，安装共享开发依赖。

| 插件 | 构建命令（在对应子目录执行） |
| --- | --- |
| float-search | `pnpm install --frozen-lockfile`，随后 `pnpm build` |
| image-toolkit-upgraded | `npm run build` |
| image-layouts-enhanced | `npm run build` |
| table-column-resize-custom | `python3 build.py` |
| citation-badges | `npm run build` |
| transparent-outline | `npm run build` |

Transparent Outline 本轮定向验证命令为 `npm test` 和 `node tests/mobile-hit-area.mjs`。后者使用本机 Playwright 与 Chromium；浏览器可执行文件路径按运行环境调整。2026-11-12 的实际 Obsidian 验收结果已提炼到总包 verification.json。

Floating Search 按 GPL-3.0 分发，其他上游组件的许可与版权见各目录 LICENSE 或 THIRD-PARTY-NOTICES.md。
