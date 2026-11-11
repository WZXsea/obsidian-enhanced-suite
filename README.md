# Obsidian 安卓插件更新包

发布日期：2026-11-11。供安卓手机和平板手动更新的 6 插件合集。

[下载本次全套安装包](https://github.com/WZXsea/obsidian-android-plugins/releases/download/android-20261111/obsidian-android-plugins-20261111.zip) · [查看全部单插件下载](https://github.com/WZXsea/obsidian-android-plugins/releases/tag/android-20261111)

## 插件版本

| 功能 | 插件目录 | 版本 |
| --- | --- | --- |
| 浮动搜索 | `float-search` | 4.4.4 |
| 图片查看与导航 | `obsidian-image-toolkit` | 1.4.18 |
| 图片布局 | `image-layouts-enhanced` | 0.1.7 |
| 表格调整 | `table-column-resize` | 1.0.4 |
| 引用徽标 | `citation-badges` | 0.3.5 |
| 透明大纲 | `transparent-outline` | 0.3.3 |

Image Toolkit 从上次总包的 1.4.17 更新至 1.4.18，其余 5 个插件与 2026-10-29 已适配版本一致。本次重新执行构建与移动回归，保留实际版本号。

## 平板更新

1. 下载全套 ZIP，解压后打开 `obsidian-android-plugins-20261111/plugins/`。文件管理器中开启“显示隐藏文件”。
2. 关闭平板 Obsidian，将上述 6 个插件文件夹合并复制到知识库的 `.obsidian/plugins/`，选择替换同名安装文件。
3. 保留各插件目录原有的 `data.json`，沿用平板的个人设置。安装包仅携带代码、样式、说明与许可。
4. 启动 Obsidian，在“设置 → 第三方插件”中确认插件已启用。全套最低版本为 Obsidian 1.8.7。

单插件 ZIP 的顶层文件夹就是插件目录，将其合并到 `.obsidian/plugins/` 即可。Floating Search 单插件包另附 `source/float-search/`，用于取得对应 GPL 源码。

## 安卓功能

1. Floating Search 提供手机入口、平板双栏只读预览、别名检索、结果折叠与连续展开动效。移动端使用普通检索，RAG 在桌面端按设置启用。
2. Image Toolkit 提供可点按的图片导航、原生 Modal 查看器、双指缩放、单指平移、旋转和切图，并与图片布局联动。1.4.18 的框选复制与起始位置放大动画适用于桌面查看器。
3. 图片布局支持触摸操作和画廊桥接，表格支持触摸调整列宽、按内容紧凑排版、整体宽度和字号调节。
4. 引用徽标支持移动编辑与 callout 引用，透明大纲提供点按入口、阅读快捷条和标题定位。

## 验证范围

本轮完成 6 个插件的构建、466 项自动测试、搜索手机和平板浏览器回归、引用移动编辑浏览器流程，以及实际发布 bundle 的移动模块隔离检查。Image Toolkit 另在当前 Obsidian 移动模拟中复核 412×915 手机和 1024×768 平板视口的查看器、原生触摸缩放与状态清理。

安卓设备端验收重点为实际 WebView、系统返回键、中文输入法与后台恢复。已记录证据来自本机 Obsidian 移动模拟和 Chromium 触摸流程。

## 包内容与许可

`plugins/` 为安装文件，`source/` 为对应源码及构建输入，`versions.json` 记录版本与安装文件 SHA-256，`SHA256SUMS.txt` 用于校验完整包内容。GitHub Release 同时提供全套、6 个单插件 ZIP 和下载文件校验值。

各插件沿用各自许可；Floating Search 为 GPL-3.0，Image Toolkit 与图片布局、表格上游的 MIT 许可和署名随包附带。仓库用于分发本地定制版本。
