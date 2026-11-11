# Obsidian 安卓图片控制更新包

发布日期：2026-11-12。6 插件合集，本次将 Image Layouts Enhanced 更新至 0.1.8。

[下载全套安装包](https://github.com/WZXsea/obsidian-android-plugins/releases/download/android-20261112-images/obsidian-android-plugins-20261112-images.zip) · [查看单插件下载](https://github.com/WZXsea/obsidian-android-plugins/releases/tag/android-20261112-images)

## 图片功能

1. 独立正文图片由插件居中，图注与说明文字沿用原有排版。
2. 电脑悬停图片、手机和平板长按约 450ms 后，可拖动图片旁的局部手柄等比调整宽度。电脑手柄为 24px，触屏为 44px。
3. 尺寸保存在当前设备的插件 data.json，设备标识保存在本机存储。电脑和平板分别调整，同链接的重复引用也分别保存，既有画廊设置继续沿用。
4. 调整尺寸保持笔记原文和图床 URL。恢复尺寸时采用笔记原有尺寸。插件统一提供拖动入口，停用或卸载后恢复原生手柄与显示样式。

## 插件版本

| 功能 | 插件目录 | 版本 |
| --- | --- | --- |
| 浮动搜索 | `float-search` | 4.4.4 |
| 图片查看与导航 | `obsidian-image-toolkit` | 1.4.18 |
| 图片布局与正文图片控制 | `image-layouts-enhanced` | 0.1.8 |
| 表格调整 | `table-column-resize` | 1.0.4 |
| 引用徽标 | `citation-badges` | 0.3.5 |
| 透明大纲 | `transparent-outline` | 0.3.4 |

其余 5 个插件的安装文件与 `android-20261112` 发布包逐字节一致。

## 平板更新

1. 单独更新图片功能时，下载 `image-layouts-enhanced-0.1.8-android.zip`；全套更新下载 `obsidian-android-plugins-20261112-images.zip`。
2. 关闭平板 Obsidian，将插件文件夹合并复制到知识库的 `.obsidian/plugins/`，替换同名安装文件。全套包的插件目录在 `obsidian-android-plugins-20261112-images/plugins/`。
3. 保留原有 data.json，沿用画廊与其他设置。
4. 启动 Obsidian，在“设置 → 外观 → CSS 代码片段”中停用原 `obsidian-image-center` 片段，使用插件内置居中。电脑端已备份并停用该片段。
5. 确认图片插件版本为 0.1.8，再长按正文图片并拖动手柄。全套最低 Obsidian 版本为 1.8.7。

## 核心检查与包内容

本次采用 10 项核心检查，逐项结果和构建状态见 verification.json。打包时核对图片插件与本机安装文件一致、其余 5 插件与上一包一致，并生成 ZIP CRC 与 SHA-256 校验值。

`plugins/` 为安装文件，`source/` 包含各插件源码、原构建目录、共享 tsconfig 与工具链。versions.json 记录版本及安装文件 SHA-256，SHA256SUMS.txt 校验包内容。Release 提供全套与 6 个单插件 ZIP。

各插件沿用各自许可。Floating Search 为 GPL-3.0，其单插件包另附源码；Image Toolkit、图片布局及表格上游的 MIT 许可与署名随包保留。
