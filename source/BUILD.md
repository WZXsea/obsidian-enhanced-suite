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

本次图片功能采用 10 项核心检查，结果见总包 verification.json。各上游许可和署名见对应目录 LICENSE 或 THIRD-PARTY-NOTICES.md。
