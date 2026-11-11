# Obsidian 安卓插件更新包

发布日期：2026-11-12。供安卓手机和平板手动更新的 6 插件合集。

[下载本次全套安装包](https://github.com/WZXsea/obsidian-android-plugins/releases/download/android-20261112/obsidian-android-plugins-20261112.zip) · [查看全部单插件下载](https://github.com/WZXsea/obsidian-android-plugins/releases/tag/android-20261112)

## 本次修复

Transparent Outline 从 0.3.3 更新至 0.3.4。移动端收起目录后，目录原覆盖区域会将触摸交给正文，正文上下滑恢复正常。目录边缘按钮仍可点按，展开后的标题列表保持独立滚动。桌面悬停与键盘操作继续沿用原有交互。

此次修复针对安卓目录闭合状态与桌面 hover/focus 样式的优先级冲突。其余 5 个插件的安装文件与 2026-11-11 发布包逐字节一致。

## 插件版本

| 功能 | 插件目录 | 版本 |
| --- | --- | --- |
| 浮动搜索 | `float-search` | 4.4.4 |
| 图片查看与导航 | `obsidian-image-toolkit` | 1.4.18 |
| 图片布局 | `image-layouts-enhanced` | 0.1.7 |
| 表格调整 | `table-column-resize` | 1.0.4 |
| 引用徽标 | `citation-badges` | 0.3.5 |
| 透明大纲 | `transparent-outline` | 0.3.4 |

## 平板更新

1. 本次仅更新目录时，下载 `transparent-outline-0.3.4-android.zip`。全套更新可下载 `obsidian-android-plugins-20261112.zip`。
2. 关闭平板 Obsidian，将解压后的插件文件夹合并复制到知识库的 `.obsidian/plugins/`，替换同名安装文件。全套包的插件文件夹位于 `obsidian-android-plugins-20261112/plugins/`。
3. 保留各插件目录原有的 `data.json`，以沿用平板个人设置。安装包携带代码、样式、说明与许可。
4. 启动 Obsidian，在“设置 → 第三方插件”确认透明大纲为 0.3.4，并在正文右侧上下滑核对滚动。全套最低 Obsidian 版本为 1.8.7。

## 验证范围

2026-11-11 已完成全套 6 插件构建与 466 项自动测试，作为本次发布的既有基线。

2026-11-12 定向完成透明大纲 TypeScript 检查与构建、6 项纯函数测试、32 项浏览器命中与滚动回归。实际 Obsidian 移动模拟覆盖 412×915 手机与 1024×768 平板，在源码/实时预览（source）与阅读（preview）两种视图下共 4 组场景：收起目录后命中正文，上下滑改变正文滚动位置，原生命令面板保持关闭，最后恢复原应用状态。

本轮证据来自 Chromium 触摸流程与本机 Obsidian 移动模拟。Android 真机 WebView、系统返回键、实际中文输入法与后台恢复由设备端运行结果确认。`verification.json` 分别记录此前全量基线与本轮定向验证。

## 包内容与许可

`plugins/` 为安装文件，`source/` 为对应源码及构建输入，`versions.json` 记录版本与安装文件 SHA-256，`SHA256SUMS.txt` 校验完整包内容。GitHub Release 同时提供全套、6 个单插件 ZIP 和下载文件校验值。Floating Search 单包附 `source/float-search/` 对应 GPL 源码。

各插件沿用各自许可；Floating Search 为 GPL-3.0，Image Toolkit、图片布局与表格上游的 MIT 许可和署名随包附带。
