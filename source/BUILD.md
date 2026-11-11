# 源码构建

各插件目录保留本次安装产物对应的源码、构建配置和已有测试。此处的 package.json 和 package-lock.json 沿用共享开发工具链，先在 source/ 执行 `npm ci`。

| 插件 | 构建命令（在对应子目录执行） |
| --- | --- |
| float-search | `pnpm install --frozen-lockfile`，随后 `pnpm build` |
| image-toolkit-upgraded | `npm run build` |
| image-layouts-enhanced | `npm run build` |
| table-column-resize-custom | `python3 build.py` |
| citation-badges | `npm run build` |
| transparent-outline | `npm run build` |

Floating Search 按 GPL-3.0 分发，其他上游组件的许可与版权见各目录 LICENSE 或 THIRD-PARTY-NOTICES.md。
