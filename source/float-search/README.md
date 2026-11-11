# Obsidian Float Search

You can use search view in modal now.

![float-search.png](media/img.png)

- Set hotkey for open float search quickly.


## 使用说明 | Usage

1. **Three main commands**:
    - `Search Obsidian Globally`: Searches all global content, and the characters entered will be cleared automatically after each search;
    - `Search Obsidian Globally (With Last State)`: Searches all global content, and the characters entered will be cleared 30 seconds after each search;
    - `Search In Current File`: Searches the content of the current file;
2. **When the cursor is focused on the search input box**:
    - Use the up and down arrow keys to switch between search results;
    - When a search result is selected, hold the Shift key and press the up or down arrow keys to expand the results upwards or downwards; when focused on a file name, you can collapse the search results under the current file name;
    - When a search result is selected,
        - Press Enter to open the file in the background;
        - Press Ctrl+Enter to open a new page in the background and open the file;
        - Press Alt+Enter to open the file and close the popup;
        - Press Ctrl+Shift+Alt+Enter to open the file in a new window and close the popup;
    - When a search result is selected, press Tab to preview the corresponding file in the current popup's right side, and Shift+Tab to close the preview;
    - When a search result is focused, press Ctrl+Shift+C to copy the selected search result content;
    - When a file is being previewed, press Ctrl+E to toggle the file's reading mode;
    - When a file is being previewed, press Ctrl+G to jump from the input box to the content of the previewed file, or from the previewed file content back to the input box;
    - When a file is being previewed, press Tab twice to jump into the content of the previewed file, or use Ctrl+Tab to switch back to the input box from the previewed file.
3. **Mouse click behavior**:
    - When a file is being previewed:
        - Clicking a new search result with the mouse will not automatically close the popup, but instead switch the file in the preview window;
        - Use Alt+mouse click to open the file and close the popup;
    - When no file is being previewed:
        - Clicking a search result with the mouse will automatically close the popup and navigate to the file, and other behavior is the same as Obsidian's default behavior;
4. **The right-click context menu can quickly search the selected text**;
5. **There is a default `obsidian://fs?query=xxxxxx` URI command, which you can use to invoke Float search from external sources**;
6. **When you click to navigate within the previewed file page, the current previewed file page will be automatically replaced**.

---

1. **三个主要命令**：
    - `Search Obsidian Globally`：用于搜索全局的所有内容，每次搜索后的字符都会自动清空；
    - `Search Obsidian Globally (With Last State)`：用于搜索全局的所有内容，每次搜索后的字符都会在三十秒后清空；
    - `Search In Current File`：用于搜索当前文件的内容；
2. **当光标聚焦在搜索输入框的时候**：
    - 按上下方向键来切换选择结果；
    - 当有一个搜索结果被选择时，按住 Shift 键再按上下方向键来向上展开或者向下展开结果；当聚焦在文件名上的时候，可以折叠当前文件名下的搜索结果；
    - 当有一个搜索结果被选择时，
        - 按 Enter 来在背景中打开文件；
        - 按 Ctrl+Enter 则是在背景中打开新页面且打开文件；
        - 按 Alt+Enter 则是打开该文件且关闭弹窗；
        - 按 Ctrl+Shift+Alt+Enter 则是用新窗口打开该文件，且关闭弹窗；
    - 当有一个搜索结果被选择时，按 Tab 来在当前弹窗的右侧预览对应的文件，Shift+Tab 则是关闭预览；
    - 当有一个搜索结果被聚焦时，按 Ctrl+Shift+C 来复制选中的搜索结果内容；
    - 当有一个文件正在被预览时，按 Ctrl+E 来切换文件的阅读模式；
    - 当有一个文件正在被预览时，按 Ctrl+G 来从输入框跳转到预览文件的内容中，或从预览文件内容中跳转回输入框；
    - 当有一个文件正在被预览时，按两次 Tab 来跳转到预览文件的内容中，或用 Ctrl+Tab 从预览文件中跳转回输入框；
3. **鼠标点击的行为**：
    - 当存在文件在预览中时：
        - 用鼠标点击新的搜索结果不会再自动关闭弹窗，而是在切换预览文件窗口的文件；
        - 用 Alt+鼠标来打开文件且关闭弹窗；
    - 当不存在文件在预览中时：
        - 用鼠标点击搜索结果自动关闭弹窗且跳转文件夹，其它与 Obsidian 的默认行为一样；
4. **右键菜单可以快速搜索选中的文本**；
5. **有一个默认的 `obsidian://fs?query=xxxxxx` 的 URI 命令，你可以用这个命令来从外部唤起 Float search**
6. **当你在预览文件页面中点击跳转时，会自动覆盖当前的预览文件页面**。

---

## Development

This project uses pnpm. Install dependencies with:

```bash
pnpm install --frozen-lockfile
```

Useful checks:

```bash
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run test:mobile-ux
pnpm run test:mobile-collapse
pnpm run test:mobile-density
pnpm run test:mobile-preview
pnpm run test:mobile-motion
pnpm run test:desktop-preview
pnpm run test:desktop-motion
pnpm run test:desktop-main
pnpm run test:fold-motion
pnpm run build
```

## Compatibility

The customized 4.4.4 build supports desktop and mobile. Mobile quick search uses Obsidian's public Modal and vault APIs with its own touch result list. Desktop retains floating search, embedded previews, and its existing RAG preference.

### 4.4.4 别名标题检索

快速搜索将笔记属性 `aliases` 纳入“标题”检索，支持单个别名与别名列表、模糊匹配、可选容错及高亮。别名条目显示“别名 / ALIAS”，与正文标题一起按文件分组，可使用“标题”按钮、`type:heading` 和 `in:heading` 筛选。单字符查询同样支持别名。

选择或收藏别名条目后打开所属笔记，元数据更新后同步更新别名索引。精确别名命中时沿用已有笔记，快速新建提示按已有匹配处理。

### 4.4.4 连贯展开与收起

文件组采用约 220 毫秒的流内高度和裁剪过渡，收起时下方条目随内容区域连续上移。长列表将主要过渡时间留给可见范围，快速反向操作及连续点击不同组时从各组当前高度续接。动画期间保持结果语义和按钮响应，自动续页在过渡结束后恢复，系统“减少动态效果”设置继续生效。预览和导航动效保持约 160 毫秒。

### 4.4.3 同条目悬停稳定性修复

桌面预览按文件版本、实际定位位置和查询识别目标。同一结果行内移动鼠标时复用加载中的任务或已就绪预览，保留阅读位置和焦点。切换到其他位置、文件或更新后的笔记时继续定位并执行过渡，隐藏预览及筛选状态变更后可重新打开原目标。

### 4.4.2 桌面预览与动效同步

桌面快速搜索先显示匹配位置附近的只读内容，原生整篇预览在随后加载并自动接管。短片段与原文缓存复用移动端实现，原生预览继续支持完整笔记阅读、编辑、键盘选择和宽度调整。同一文件与版本复用已打开的原生视图，连续切换保留最新等待目标，原生初始化仍由已有生命周期管理器串行关闭。

桌面选择响应等待从 200 毫秒调整为 40 毫秒。展开、收起、预览交接、同文件定位及打开笔记统一使用约 160 毫秒动效，遵循“减少动态效果”设置。搜索输入默认保持焦点，用户点击预览或调整分隔线后保留其操作焦点。

### 4.4.1 手机结果列表与预览优化

手机和平板的文件组默认完全折叠，点击箭头展开后显示匹配条目，再次点击箭头收起全部条目。移动端的单条、两条和三条匹配同样支持折叠，展开后的长列表继续分批显示。桌面的初始三条匹配保持原有行为。

窄屏采用固定触摸区、可收缩文字和紧凑辅助信息三列布局。文件名、路径与匹配摘要按可用宽度省略，行距与分组留白同步收紧，数量、类型和图钉保持同一行。选中条目和预览命中内容采用淡色背景高亮。手机快捷入口和阅读时的输入焦点控制继续使用现有流程。

预览先显示匹配位置附近的内容，随后完成 Markdown 排版。长笔记通过前后阅读入口连续查看，同一搜索窗口内重复打开时复用预览，文件修改后刷新缓存。图片与 Markdown 后处理的等待阶段继续显示可阅读的首屏。

展开、收起、预览跳转、返回及前后阅读采用约 160 毫秒过渡。系统启用“减少动态效果”时直接显示最终状态。

### 安卓操作

1. 点按搜索图标，或执行 `打开快速搜索（手机）` / `Open quick search (CMDK)` 命令，打开浮动快速搜索。插件设置页也提供“打开快速搜索”按钮。
2. 快速搜索支持文件、标题、正文、标签、路径筛选和结果排序。点按结果进入只读预览，明确点击“打开笔记”后再进入笔记。手机采用完整阅读预览，平板宽屏同时显示结果和预览。
3. 全局搜索、保留状态搜索、当前文件搜索及手机搜索图标统一进入快速搜索浮窗。`line:`、`block:` 等原生运算符仍进入安卓原生搜索侧栏。
4. 安卓采用普通检索运行方式，隐藏 RAG 按钮与设置。同步得到的桌面 RAG 开关仍保存在原设置中，桌面运行时继续使用该设置。
5. 搜索窗口避让系统安全区域并按软键盘上方的可见区域调整尺寸。选择结果、预览、筛选和排序时收起键盘，点按输入框可继续编辑。桌面浮窗与并排预览沿用原有行为。

移动端验证覆盖发布文件的模块加载、插件启动和 Obsidian 移动模拟。Android 真机的 WebView、输入法与返回键保留为设备验收项。

## Release

Release builds should use the committed `pnpm-lock.yaml`:

```bash
pnpm install --frozen-lockfile
pnpm run build
```

The release assets are `main.js`, `manifest.json`, `styles.css`, and the generated plugin zip.

## Support

If you are enjoying this plugin then please support my work and enthusiasm by buying me a coffee
on [https://www.buymeacoffee.com/boninall](https://www.buymeacoffee.com/boninall).

<a href="https://www.buymeacoffee.com/boninall"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=boninall&button_colour=6495ED&font_colour=ffffff&font_family=Lato&outline_colour=000000&coffee_colour=FFDD00"></a>

### 4.3.2 手机入口修复

移动环境缺少桌面 HoverPopover 时，模块定义采用安全基类。手机搜索改用公开 Modal 与独立触摸结果列表，普通入口统一打开同一浮窗，命令所需状态在插件启动时初始化。严格启动回归让缺失 API 保持缺失，并同时验证当前源码与发布 main.js。
