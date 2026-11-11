'use strict';

var obsidian = require('obsidian');
var crypto = {randomUUID: () => globalThis.crypto?.randomUUID?.() ?? ('oit-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2))};

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

// English
var en = {
    // >>>Common Settings:
    VIEW_MODE_NAME: 'Choose a mode to view images',
    VIEW_MODE_NORMAL: '🖼 Normal',
    VIEW_MODE_PIN: '📌 Pin',
    RESET: 'reset to default',
    // >>>View Trigger Settings:
    VIEW_TRIGGER_SETTINGS: 'View trigger',
    VIEW_IMAGE_GLOBAL_NAME: 'Click and view an image globally',
    VIEW_IMAGE_GLOBAL_DESC: 'You can zoom, rotate, drag, and invert it on the popup layer when clicking an image.',
    VIEW_IMAGE_IN_EDITOR_NAME: 'Click and view an image in the Editor Area',
    VIEW_IMAGE_IN_EDITOR_DESC: 'Turn on this option if you want to click and view an image in the Editor Area.',
    // CPB = COMMUNITY_PLUGINS_BROWSER
    VIEW_IMAGE_IN_CPB_NAME: 'Click and view an image in the Community Plugins browser',
    VIEW_IMAGE_IN_CPB_DESC: 'Turn on this option if you want to click and view an image in the Community Plugins browser.',
    VIEW_IMAGE_WITH_A_LINK_NAME: 'Click and view an image with a link',
    VIEW_IMAGE_WITH_A_LINK_DESC: 'Turn on this option if you want to click and view an image with a link. (NOTE: The browser will be opened for you to visit the link and the image will be popped up for being viewed at the same time when you click the image.)',
    VIEW_IMAGE_OTHER_NAME: 'Click and view in the other areas except the above',
    VIEW_IMAGE_OTHER_DESC: 'Except for the above mentioned, it also supports other areas, like some modal user interface components.',
    // >>> PIN_MODE_SETTINGS
    PIN_MODE_SETTINGS: "Pin mode",
    PIN_MODE_NAME: "📌 Pin an image",
    PIN_MODE_DESC: "You can pin an image onto the top of the screen. And have more options by right click. (press Esc to close the image where your mouse cursor is hovering)",
    PIN_MAXIMUM_NAME: "The maximum images you can pin",
    PIN_COVER_NAME: "Cover mode",
    PIN_COVER_DESC: "After those pinned images reach maximum, you can cover the earliest pinned image when you click an image once again.",
    PIN_MAXIMUM_NOTICE: "Exceeded maximum images you can pin (non cover mode)",
    // >>>View Detail Settings:
    VIEW_DETAILS_SETTINGS: 'View details',
    IMAGE_MOVE_SPEED_NAME: 'Set the moving speed of the image',
    IMAGE_MOVE_SPEED_DESC: 'When you move an image on the popup layer by keyboard (up, down, left, right), the moving speed of the image can be set here.',
    IMAGE_TIP_TOGGLE_NAME: "Display the image's zoom number",
    IMAGE_TIP_TOGGLE_DESC: "Turn on this option if you want to display the zoom number when you zoom the image.",
    IMG_FULL_SCREEN_MODE_NAME: 'Full-screen preview mode',
    // preview mode options:
    FIT: 'Fit',
    FILL: 'Fill',
    STRETCH: 'Stretch',
    IMG_VIEW_BACKGROUND_COLOR_NAME: "Background color of the previewed image (Only support the image with transparent background)",
    // >>>Image Border Settings:
    IMAGE_BORDER_SETTINGS: 'Image border',
    IMAGE_BORDER_TOGGLE_NAME: "Display the image's border",
    IMAGE_BORDER_TOGGLE_DESC: "The clicked image's border can be displayed after you exit previewing and close the popup layer.",
    IMAGE_BORDER_WIDTH_NAME: "Image border width",
    IMAGE_BORDER_STYLE_NAME: "Image border style",
    IMAGE_BORDER_COLOR_NAME: "Image border color",
    // IMG_BORDER_WIDTH options:
    THIN: 'thin',
    MEDIUM: 'medium',
    THICK: 'thick',
    // IMG_BORDER_STYLE options:
    //HIDDEN: 'hidden',
    DOTTED: 'dotted',
    DASHED: 'dashed',
    SOLID: 'solid',
    DOUBLE: 'double',
    GROOVE: 'groove',
    RIDGE: 'ridge',
    INSET: 'inset',
    OUTSET: 'outset',
    // IMAGE_BORDER_COLOR_NAME options:
    BLACK: 'black',
    BLUE: 'blue',
    DARK_GREEN: 'dark green',
    GREEN: 'green',
    LIME: 'lime',
    STEEL_BLUE: 'steel blue',
    INDIGO: 'indigo',
    PURPLE: 'purple',
    GRAY: 'gray',
    DARK_RED: 'dark red',
    LIGHT_GREEN: 'light green',
    BROWN: 'brown',
    LIGHT_BLUE: 'light blue',
    SILVER: 'silver',
    RED: 'red',
    PINK: 'pink',
    ORANGE: 'orange',
    GOLD: 'gold',
    YELLOW: 'yellow',
    // >>>Gallery Navbar Settings:
    GALLERY_NAVBAR_SETTINGS: 'Gallery navbar (experimental)',
    GALLERY_NAVBAR_TOGGLE_NAME: "Display gallery navbar",
    GALLERY_NAVBAR_TOGGLE_DESC: "All of the images in the current pane view can be displayed at the bottom of the popup layer.",
    GALLERY_NAVBAR_DEFAULT_COLOR_NAME: "Background color of the gallery navbar (default state)",
    GALLERY_NAVBAR_HOVER_COLOR_NAME: "Background color of the gallery navbar (hovering state)",
    GALLERY_IMG_BORDER_TOGGLE_NAME: "Display the selected image on the gallery navbar",
    GALLERY_IMG_BORDER_TOGGLE_DESC: "When you select an image, the image's border will be displayed, so you can know which image is currently active.",
    GALLERY_IMG_BORDER_ACTIVE_COLOR_NAME: 'Border color of the selected image',
    // >>>HOTKEYS_SETTINGS:
    HOTKEY_SETTINGS: "Hotkeys",
    HOTKEY_SETTINGS_DESC: "📢 You cannot set the same hotkey for 'Move the image' and 'Switch the image' at the same time. (NOT SUPPORT in Pin Mode)",
    MOVE_THE_IMAGE_NAME: "Hotkey for moving the image",
    MOVE_THE_IMAGE_DESC: "You can move the image on the popup layer by hotkey.",
    SWITCH_THE_IMAGE_NAME: "Hotkey for switching the image",
    SWITCH_THE_IMAGE_DESC: "You can switch to the previous/next image on the gallery navbar by hotkey. (NOTE: You need to turn on 'Display gallery navbar' first, if you wanna use this hotkey.)",
    DOUBLE_CLICK_TOOLBAR_NAME: "Double click",
    VIEW_TRIGGER_HOTKEY_NAME: "Hotkey for triggering viewing an image",
    VIEW_TRIGGER_HOTKEY_DESC: "When you set 'None', you can directly click and preview an image without holding any modifier keys; otherwise, you must hold the configured modifier keys to click and preview an image.",
    // MODIFIER_HOTKEYS
    NONE: "None",
    CTRL: "Ctrl",
    ALT: "Alt",
    SHIFT: "Shift",
    CTRL_ALT: "Ctrl+Alt",
    CTRL_SHIFT: "Ctrl+Shift",
    SHIFT_ALT: "Shift+Alt",
    CTRL_SHIFT_ALT: "Ctrl+Shift+Alt",
    // toolbar icon title
    ZOOM_TO_100: "zoom to 100%",
    ZOOM_IN: "zoom in",
    ZOOM_OUT: "zoom out",
    FULL_SCREEN: 'full screen',
    REFRESH: "refresh",
    ROTATE_LEFT: "rotate left",
    ROTATE_RIGHT: "rotate right",
    SCALE_X: 'flip along x-axis',
    SCALE_Y: 'flip along y-axis',
    INVERT_COLOR: 'invert color',
    COPY: 'copy',
    CLOSE: 'close',
    // tip:
    COPY_IMAGE_SUCCESS: 'Copy the image successfully!',
    COPY_IMAGE_ERROR: 'Fail to copy the image!'
};

// 简体中文
var zhCN = {
    VIEW_MODE_NAME: '选择查看模式',
    VIEW_MODE_NORMAL: '🖼 普通',
    VIEW_MODE_PIN: '📌 贴图',
    // >>> 预览触发配置：
    VIEW_TRIGGER_SETTINGS: '预览触发配置',
    VIEW_IMAGE_GLOBAL_NAME: '支持全局预览图片',
    VIEW_IMAGE_GLOBAL_DESC: '开启后，在任何地方点击图片都可以弹出预览界面，可对图片进行缩放、旋转、拖动、和反色等。',
    VIEW_IMAGE_IN_EDITOR_NAME: '支持在编辑区域预览图片',
    VIEW_IMAGE_IN_EDITOR_DESC: '开启后，支持在编辑区域，点击图片预览。',
    // CPB = COMMUNITY_PLUGINS_BROWSER
    VIEW_IMAGE_IN_CPB_NAME: '支持在社区插件页面预览图片',
    VIEW_IMAGE_IN_CPB_DESC: '开启后，支持在社区插件页面，点击图片预览。',
    VIEW_IMAGE_WITH_A_LINK_NAME: '支持预览带链接的图片',
    VIEW_IMAGE_WITH_A_LINK_DESC: '开启后，支持点击带链接的图片（注意：点击该图片，会同时打开浏览器访问指定地址和弹出预览图片）',
    VIEW_IMAGE_OTHER_NAME: '支持除上述其他地方来预览图片',
    VIEW_IMAGE_OTHER_DESC: '除上述支持范围外，还支持一些其他区域，如Modal用户界面组件。',
    // >>> PIN_MODE_SETTINGS
    PIN_MODE_SETTINGS: "贴图模式设置",
    PIN_MODE_NAME: "📌 将所点击的图片贴到屏幕上",
    PIN_MODE_DESC: "你可以将当前所点击的图片贴到屏幕上，并且可以通过右击图片选择更多操作（按 Esc 关闭已贴图片的展示）",
    PIN_MAXIMUM_NAME: "最大贴图数量",
    PIN_COVER_NAME: "覆盖模式",
    PIN_COVER_DESC: "当贴图数量达到最大值后，此时再次点击图片，该图片会覆盖最早弹出的那个贴图。",
    PIN_MAXIMUM_NOTICE: "超过最大Pin图设置（非覆盖模式）",
    // >>>查看细节设置：
    VIEW_DETAILS_SETTINGS: '查看细节设置',
    IMAGE_MOVE_SPEED_NAME: '图片移动速度设置',
    IMAGE_MOVE_SPEED_DESC: '当使用键盘（上、下、左、右）移动图片时，可对图片移动速度进行设置。',
    IMAGE_TIP_TOGGLE_NAME: "展示缩放比例提示",
    IMAGE_TIP_TOGGLE_DESC: "开启后，当你缩放图片时会展示当前缩放的比例。",
    IMG_FULL_SCREEN_MODE_NAME: '全屏预览模式',
    // 全屏预览模式 下拉：
    FIT: '自适应',
    FILL: '填充',
    STRETCH: '拉伸',
    IMG_VIEW_BACKGROUND_COLOR_NAME: "设置预览图片的背景色（仅对透明背景的图片生效）",
    // >>>图片边框设置：
    IMAGE_BORDER_SETTINGS: '图片边框设置',
    IMAGE_BORDER_TOGGLE_NAME: "展示被点击图片的边框",
    IMAGE_BORDER_TOGGLE_DESC: "当离开图片预览和关闭弹出层后，突出展示被点击图片的边框。",
    IMAGE_BORDER_WIDTH_NAME: "设置图片边框宽度",
    IMAGE_BORDER_STYLE_NAME: "设置图片边框样式",
    IMAGE_BORDER_COLOR_NAME: "设置图片边框颜色",
    // IMG_BORDER_WIDTH 下拉：
    THIN: '较细',
    MEDIUM: '正常',
    THICK: '较粗',
    // IMG_BORDER_STYLE  下拉：
    //HIDDEN: '隐藏',
    DOTTED: '点状',
    DASHED: '虚线',
    SOLID: '实线',
    DOUBLE: '双线',
    GROOVE: '凹槽',
    RIDGE: ' 垄状',
    INSET: '凹边',
    OUTSET: '凸边',
    // IMAGE_BORDER_COLOR_NAME  下拉：
    BLACK: '黑色',
    BLUE: '蓝色',
    DARK_GREEN: '深绿色',
    GREEN: '绿色',
    LIME: '淡黄绿色',
    STEEL_BLUE: '钢青色',
    INDIGO: '靛蓝色',
    PURPLE: '紫色',
    GRAY: '灰色',
    DARK_RED: '深红色',
    LIGHT_GREEN: '浅绿色',
    BROWN: '棕色',
    LIGHT_BLUE: '浅蓝色',
    SILVER: '银色',
    RED: '红色',
    PINK: '粉红色',
    ORANGE: '橘黄色',
    GOLD: '金色',
    YELLOW: '黄色',
    // >>>Gallery Navbar Settings:
    GALLERY_NAVBAR_SETTINGS: '图片导航设置 (体验版)',
    GALLERY_NAVBAR_TOGGLE_NAME: "展示图片导航",
    GALLERY_NAVBAR_TOGGLE_DESC: "当前文档的所有图片会展示在弹出层的底部，可随意切换展示不同图片。",
    GALLERY_NAVBAR_DEFAULT_COLOR_NAME: "设置图片导航底栏背景色（默认展示）",
    GALLERY_NAVBAR_HOVER_COLOR_NAME: "设置图片导航底栏背景色（鼠标悬浮时）",
    GALLERY_IMG_BORDER_TOGGLE_NAME: "展示图片导航上被选中的图片",
    GALLERY_IMG_BORDER_TOGGLE_DESC: "当你选中正查看某一图片，对应图片导航底栏上将突出显示该缩略图片的边框。",
    GALLERY_IMG_BORDER_ACTIVE_COLOR_NAME: '设置被选中图片的边框色',
    // >>>HOTKEYS_SETTINGS:
    HOTKEY_SETTINGS: "快捷键设置",
    HOTKEY_SETTINGS_DESC: "📢  你无法为'移动图片'和'切换图片'设置相同的快捷键。（不支持贴图模式）",
    MOVE_THE_IMAGE_NAME: "为移动图片设置快捷键",
    MOVE_THE_IMAGE_DESC: "你可以利用快捷键来移动弹出层上的图片。",
    SWITCH_THE_IMAGE_NAME: "为切换图片设置快捷键",
    SWITCH_THE_IMAGE_DESC: "你可以利用快捷键来切换在图片导航栏上的图片至上一张/下一张。(注意: 仅当开启“展示图片导航”后，才能使用该快捷键来控制切换图片。)",
    DOUBLE_CLICK_TOOLBAR_NAME: "双击",
    VIEW_TRIGGER_HOTKEY_NAME: "为触发弹出查看图片设置快捷键",
    VIEW_TRIGGER_HOTKEY_DESC: "当你设置为“无”，你可以直接点击预览图片；否则，须按住已配置的修改键（Ctrl、Alt、Shift）才能点击查看某个图片。",
    // MODIFIER_HOTKEYS
    NONE: "无",
    // toolbar icon title
    ZOOM_TO_100: "缩放至100%",
    ZOOM_IN: "放大",
    ZOOM_OUT: "缩小",
    FULL_SCREEN: "全屏",
    REFRESH: "刷新",
    ROTATE_LEFT: "左旋",
    ROTATE_RIGHT: "右旋",
    SCALE_X: 'x轴翻转',
    SCALE_Y: 'y轴翻转',
    INVERT_COLOR: '反色',
    COPY: '复制',
    CLOSE: '关闭',
    // tip:
    COPY_IMAGE_SUCCESS: '拷贝图片成功！',
    COPY_IMAGE_ERROR: '拷贝图片失败！'
};

// 繁體中文
var zhTW = {
    // toolbar icon title
    ZOOM_IN: "放大",
    ZOOM_OUT: "縮小",
    FULL_SCREEN: '全螢幕',
    REFRESH: "重整",
    ROTATE_LEFT: "向左旋轉",
    ROTATE_RIGHT: "向右旋轉",
    SCALE_X: 'x 軸縮放',
    SCALE_Y: 'y 軸縮放',
    INVERT_COLOR: '色彩反轉',
    COPY: '複製',
    COPY_IMAGE_SUCCESS: '成功複製圖片！'
};

const localeMap = {
    en,
    "zh-cn": zhCN,
    "zh-tw": zhTW,
};
const locale = localeMap[obsidian.moment.locale()];
function t(str) {
    if (!locale) {
        console.error("[oit] Image toolkit locale not found", obsidian.moment.locale());
    }
    return (locale && locale[str]) || en[str];
}

var ViewMode;
(function (ViewMode) {
    ViewMode["Normal"] = "Normal";
    ViewMode["Pin"] = "Pin";
})(ViewMode || (ViewMode = {}));
const DEFAULT_VIEW_MODE = ViewMode.Normal;
const OIT_CLASS = {
    CONTAINER_ROOT: 'oit',
    CONTAINER_NORMAL: 'oit-normal',
    CONTAINER_PIN: 'oit-pin',
    // the place for storing images
    IMG_CONTAINER: 'oit-img-container',
    IMG_VIEW: 'oit-img-view',
    IMG_TTP: 'oit-img-tip',
    IMG_FOOTER: 'oit-img-footer',
    IMG_TITLE: 'oit-img-title',
    IMG_TITLE_NAME: 'oit-img-title-name',
    IMG_TITLE_INDEX: 'oit-img-title-index',
    IMG_TOOLBAR: 'oit-img-toolbar',
    IMG_PLAYER: 'img-player',
    IMG_FULLSCREEN: 'img-fullscreen',
};
const ZOOM_FACTOR = 0.8;
const IMG_VIEW_MIN = 30;
const ICONS = [{
        id: 'zoom-to-100',
        svg: `<g> <path id="svg_1" d="m42,6c-18.8,0 -34,15.2 -34,34s15.2,34 34,34c7.4,0 14.3,-2.4 19.9,-6.4l26.3,26.3l5.6,-5.6l-26,-26.1c5.1,-6 8.2,-13.7 8.2,-22.1c0,-18.9 -15.2,-34.1 -34,-34.1zm0,4c16.6,0 30,13.4 30,30s-13.4,30 -30,30s-30,-13.4 -30,-30s13.4,-30 30,-30z" stroke-width="2" stroke="currentColor" fill="currentColor"/> <text font-weight="bold" xml:space="preserve" text-anchor="start" font-family="Noto Sans JP" font-size="24" id="svg_2" y="48.5" x="24" stroke-width="0" stroke="#000" fill="#000000">1:1</text> </g>`
    }];
const SEPARATOR_SYMBOL = "---";
const TOOLBAR_CONF = [{
        title: "ZOOM_TO_100",
        class: 'toolbar_zoom_to_100',
        icon: 'zoom-to-100',
        enableToolbarIcon: true,
        enableMenu: true,
        enableHotKey: true
    }, {
        title: "ZOOM_IN",
        class: 'toolbar_zoom_in',
        icon: 'zoom-in',
        enableToolbarIcon: true,
        enableMenu: false,
        enableHotKey: true
    }, {
        title: "ZOOM_OUT",
        class: 'toolbar_zoom_out',
        icon: 'zoom-out',
        enableToolbarIcon: true,
        enableMenu: false,
        enableHotKey: true
    }, {
        title: "FULL_SCREEN",
        class: 'toolbar_full_screen',
        icon: 'expand',
        enableToolbarIcon: true,
        enableMenu: true,
        enableHotKey: true
    }, {
        title: "REFRESH",
        class: 'toolbar_refresh',
        icon: 'refresh-ccw',
        enableToolbarIcon: true,
        enableMenu: true,
        enableHotKey: true
    }, {
        title: "ROTATE_LEFT",
        class: 'toolbar_rotate_left',
        icon: 'rotate-ccw',
        enableToolbarIcon: true,
        enableMenu: true,
        enableHotKey: true
    }, {
        title: "ROTATE_RIGHT",
        class: 'toolbar_rotate_right',
        icon: 'rotate-cw',
        enableToolbarIcon: true,
        enableMenu: true,
        enableHotKey: true
    }, {
        title: "SCALE_X",
        class: 'toolbar_scale_x',
        icon: 'move-horizontal',
        enableToolbarIcon: true,
        enableMenu: true,
        enableHotKey: true
    }, {
        title: "SCALE_Y",
        class: 'toolbar_scale_y',
        icon: 'move-vertical',
        enableToolbarIcon: true,
        enableMenu: true,
        enableHotKey: true
    }, {
        title: "INVERT_COLOR",
        class: 'toolbar_invert_color',
        icon: 'droplet',
        enableToolbarIcon: true,
        enableMenu: true,
        enableHotKey: true
    }, {
        title: "COPY",
        class: 'toolbar_copy',
        icon: 'copy',
        enableToolbarIcon: true,
        enableMenu: true,
        enableHotKey: true
    }, {
        title: SEPARATOR_SYMBOL,
        enableToolbarIcon: false,
        enableMenu: true,
        enableHotKey: false
    }, {
        title: "CLOSE",
        class: 'toolbar_close',
        icon: 'trash',
        enableToolbarIcon: false,
        enableMenu: true,
        enableHotKey: true
    }];
const IMG_FULL_SCREEN_MODE = {
    FIT: 'FIT',
    FILL: 'FILL',
    STRETCH: 'STRETCH'
};
const VIEW_IMG_SELECTOR = {
    EDITOR_AREAS: `.workspace-leaf-content[data-type='markdown'] img,.workspace-leaf-content[data-type='image'] img`,
    EDITOR_AREAS_NO_LINK: `.workspace-leaf-content[data-type='markdown'] img:not(a img),.workspace-leaf-content[data-type='image'] img:not(a img)`,
    CPB: `.community-modal-details img`,
    CPB_NO_LINK: `.community-modal-details img:not(a img)`,
    OTHER: `.modal-content img`,
    OTHER_NO_LINK: `.modal-content img:not(a img)`,
};
const IMG_BORDER_WIDTH = {
    THIN: 'thin',
    MEDIUM: 'medium',
    THICK: 'thick'
};
const IMG_BORDER_STYLE = {
    // HIDDEN: 'hidden',
    DOTTED: 'dotted',
    DASHED: 'dashed',
    SOLID: 'solid',
    DOUBLE: 'double',
    GROOVE: 'groove',
    RIDGE: 'ridge',
    INSET: 'inset',
    OUTSET: 'outset'
};
// https://www.runoob.com/cssref/css-colorsfull.html
const IMG_BORDER_COLOR = {
    BLACK: 'black',
    BLUE: 'blue',
    DARK_GREEN: 'darkgreen',
    GREEN: 'green',
    LIME: 'lime',
    STEEL_BLUE: 'steelblue',
    INDIGO: 'indigo',
    PURPLE: 'purple',
    GRAY: 'gray',
    DARK_RED: 'darkred',
    LIGHT_GREEN: 'lightgreen',
    BROWN: 'brown',
    LIGHT_BLUE: 'lightblue',
    SILVER: 'silver',
    RED: 'red',
    PINK: 'pink',
    ORANGE: 'orange',
    GOLD: 'gold',
    YELLOW: 'yellow'
};
const GALLERY_NAVBAR_DEFAULT_COLOR = '#0000001A'; // rgba(0, 0, 0, 0.1)
const GALLERY_NAVBAR_HOVER_COLOR = '#0000004D'; // rgba(0, 0, 0, 0.3)
const GALLERY_IMG_BORDER_ACTIVE_COLOR = '#FF0000'; // red
const MODIFIER_HOTKEYS = {
    NONE: "NONE",
    CTRL: "CTRL",
    ALT: "ALT",
    SHIFT: "SHIFT",
    CTRL_ALT: "CTRL_ALT",
    CTRL_SHIFT: "CTRL_SHIFT",
    SHIFT_ALT: "SHIFT_ALT",
    CTRL_SHIFT_ALT: "CTRL_SHIFT_ALT"
};
const MOVE_THE_IMAGE = {
    CODE: "MOVE_THE_IMAGE",
    DEFAULT_HOTKEY: MODIFIER_HOTKEYS.NONE,
    SVG: `<svg width="56" height="37" xmlns="http://www.w3.org/2000/svg" class="icon"><path fill="none" d="M-1 -1H57V38H-1z"/><g><path stroke="null" fill="#707070" d="M19.001 16.067V1.928C19.001.864 19.865 0 20.93 0h14.142c1.064 0 1.928.864 1.928 1.928v14.14a1.929 1.929 0 01-1.928 1.927H20.929a1.929 1.929 0 01-1.928-1.928zm4.805-5.909l2.908-3.032v7.334c0 .535.43.964.965.964h.642c.535 0 .965-.43.965-.964V7.126l2.908 3.032a.965.965 0 001.378.017l.438-.442a.96.96 0 000-1.362l-5.327-5.33a.96.96 0 00-1.362 0l-5.335 5.33a.96.96 0 000 1.362l.438.441a.97.97 0 001.382-.016zM36.999 20.933v14.139A1.929 1.929 0 0135.07 37H20.929a1.929 1.929 0 01-1.928-1.928v-14.14c0-1.064.864-1.927 1.928-1.927h14.142c1.064 0 1.928.863 1.928 1.928zm-4.805 5.909l-2.908 3.032V22.54a.962.962 0 00-.965-.964h-.642a.962.962 0 00-.965.964v7.334l-2.908-3.032a.965.965 0 00-1.378-.016l-.438.441a.96.96 0 000 1.362l5.327 5.33a.96.96 0 001.362 0l5.335-5.33a.96.96 0 000-1.362l-.438-.441a.97.97 0 00-1.382.016zM16.068 37.001H1.93a1.929 1.929 0 01-1.928-1.928V20.932c0-1.065.864-1.928 1.928-1.928h14.14c1.064 0 1.927.863 1.927 1.928v14.14a1.929 1.929 0 01-1.928 1.93zm-5.908-4.804l-3.033-2.909h7.335c.534 0 .964-.43.964-.964v-.643a.962.962 0 00-.964-.964H7.127l3.033-2.909a.965.965 0 00.016-1.378l-.442-.438a.96.96 0 00-1.362 0l-5.33 5.327a.96.96 0 000 1.362l5.33 5.335a.96.96 0 001.362 0l.442-.438a.97.97 0 00-.016-1.381zM39.932 19.004H54.07c1.064 0 1.928.863 1.928 1.928v14.14a1.929 1.929 0 01-1.928 1.93H39.93a1.929 1.929 0 01-1.927-1.93v-14.14c0-1.065.863-1.928 1.928-1.928zm5.908 4.804l3.033 2.909h-7.335a.962.962 0 00-.964.964v.643c0 .534.43.964.964.964h7.335l-3.033 2.909a.965.965 0 00-.016 1.377l.442.438a.96.96 0 001.362 0l5.33-5.327a.96.96 0 000-1.362l-5.33-5.335a.96.96 0 00-1.362 0l-.442.438a.97.97 0 00.016 1.382z"/></g></svg>`
};
const SWITCH_THE_IMAGE = {
    CODE: "SWITCH_THE_IMAGE",
    DEFAULT_HOTKEY: MODIFIER_HOTKEYS.CTRL,
    SVG: `<svg width="37" height="18" xmlns="http://www.w3.org/2000/svg" class="icon"><path fill="none" d="M-1 -1H38V19H-1z"/><g><path stroke="null" fill="#707070" d="M16.068 17.999H1.93A1.929 1.929 0 01.001 16.07V1.929C.001.865.865.001 1.93.001h14.14c1.064 0 1.927.864 1.927 1.928v14.142a1.929 1.929 0 01-1.928 1.928zm-5.908-4.805l-3.033-2.908h7.335c.534 0 .964-.43.964-.965V8.68a.962.962 0 00-.964-.965H7.127l3.033-2.908a.965.965 0 00.016-1.378l-.442-.438a.96.96 0 00-1.362 0l-5.33 5.327a.96.96 0 000 1.362l5.33 5.335a.96.96 0 001.362 0l.442-.438a.97.97 0 00-.016-1.382zM20.932.001H35.07c1.064 0 1.928.864 1.928 1.928v14.142a1.929 1.929 0 01-1.928 1.928H20.93a1.929 1.929 0 01-1.927-1.928V1.929c0-1.064.863-1.928 1.928-1.928zm5.908 4.805l3.033 2.908h-7.335a.962.962 0 00-.964.965v.642c0 .535.43.965.964.965h7.335l-3.033 2.908a.965.965 0 00-.016 1.378l.442.438a.96.96 0 001.362 0l5.33-5.327a.96.96 0 000-1.362l-5.33-5.335a.96.96 0 00-1.362 0l-.442.438a.97.97 0 00.016 1.382z"/></g></svg>`
};
const IMG_DEFAULT_BACKGROUND_COLOR = '#00000000';

const DEFAULT_SETTINGS = {
    viewMode: ViewMode.Normal,
    viewImageInEditor: true,
    viewImageInCPB: true,
    viewImageWithLink: true,
    viewImageOther: true,
    // pinMode: false,
    pinMaximum: 3,
    pinCoverMode: true,
    imageMoveSpeed: 10,
    imgTipToggle: true,
    imgFullScreenMode: IMG_FULL_SCREEN_MODE.FIT,
    imgViewBackgroundColor: IMG_DEFAULT_BACKGROUND_COLOR,
    imageBorderToggle: false,
    imageBorderWidth: IMG_BORDER_WIDTH.MEDIUM,
    imageBorderStyle: IMG_BORDER_STYLE.SOLID,
    imageBorderColor: IMG_BORDER_COLOR.RED,
    galleryNavbarToggle: true,
    galleryNavbarDefaultColor: GALLERY_NAVBAR_DEFAULT_COLOR,
    galleryNavbarHoverColor: GALLERY_NAVBAR_HOVER_COLOR,
    galleryImgBorderActive: true,
    galleryImgBorderActiveColor: GALLERY_IMG_BORDER_ACTIVE_COLOR,
    // hotkeys conf
    moveTheImageHotkey: MOVE_THE_IMAGE.DEFAULT_HOTKEY,
    switchTheImageHotkey: SWITCH_THE_IMAGE.DEFAULT_HOTKEY,
    doubleClickToolbar: TOOLBAR_CONF[3].class,
    viewTriggerHotkey: MODIFIER_HOTKEYS.NONE
};
class ImageToolkitSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        let { containerEl } = this;
        containerEl.empty();
        // Common Settings:
        this.displayCommonSettings(containerEl);
        // View Trigger Settings:
        this.displayViewTriggerSettings(containerEl);
        // Pin Mode Settings:
        this.displayPinModeSettings(containerEl);
        //region >>> VIEW_DETAILS_SETTINGS
        new obsidian.Setting(containerEl).setName(t("VIEW_DETAILS_SETTINGS")).setHeading();
        let imgMoveSpeedScaleText;
        new obsidian.Setting(containerEl)
            .setName(t("IMAGE_MOVE_SPEED_NAME"))
            .setDesc(t("IMAGE_MOVE_SPEED_DESC"))
            .addSlider(slider => slider
            .setLimits(1, 30, 1)
            .setValue(this.plugin.settings.imageMoveSpeed)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            imgMoveSpeedScaleText.innerText = " " + value.toString();
            this.plugin.settings.imageMoveSpeed = value;
            this.plugin.saveSettings();
        })))
            .settingEl.createDiv('', (el) => {
            imgMoveSpeedScaleText = el;
            el.style.minWidth = "2.3em";
            el.style.textAlign = "right";
            el.innerText = " " + this.plugin.settings.imageMoveSpeed.toString();
        });
        new obsidian.Setting(containerEl)
            .setName(t("IMAGE_TIP_TOGGLE_NAME"))
            .setDesc(t("IMAGE_TIP_TOGGLE_DESC"))
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.imgTipToggle)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.imgTipToggle = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName(t("IMG_FULL_SCREEN_MODE_NAME"))
            .addDropdown((dropdown) => __awaiter(this, void 0, void 0, function* () {
            for (const key in IMG_FULL_SCREEN_MODE) {
                // @ts-ignore
                dropdown.addOption(key, t(key));
            }
            dropdown.setValue(this.plugin.settings.imgFullScreenMode);
            dropdown.onChange((option) => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.imgFullScreenMode = option;
                yield this.plugin.saveSettings();
            }));
        }));
        new obsidian.Setting(containerEl)
            .setName(t("IMG_VIEW_BACKGROUND_COLOR_NAME"))
            .addColorPicker(picker => {
            picker
                .setValue(this.plugin.settings.imgViewBackgroundColor || DEFAULT_SETTINGS.imgViewBackgroundColor)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.imgViewBackgroundColor = value;
                yield this.plugin.saveSettings();
            }));
        })
            .addExtraButton(button => {
            button.setIcon('rotate-ccw')
                .setTooltip(t('RESET'))
                .onClick(() => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.imgViewBackgroundColor = DEFAULT_SETTINGS.imgViewBackgroundColor;
                yield this.plugin.saveSettings();
                this.display();
            }));
        });
        //endregion
        //region >>> IMAGE_BORDER_SETTINGS
        new obsidian.Setting(containerEl).setName(t("IMAGE_BORDER_SETTINGS")).setHeading();
        new obsidian.Setting(containerEl)
            .setName(t("IMAGE_BORDER_TOGGLE_NAME"))
            .setDesc(t("IMAGE_BORDER_TOGGLE_DESC"))
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.imageBorderToggle)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.imageBorderToggle = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName(t("IMAGE_BORDER_WIDTH_NAME"))
            .addDropdown((dropdown) => __awaiter(this, void 0, void 0, function* () {
            for (const key in IMG_BORDER_WIDTH) {
                // @ts-ignore
                dropdown.addOption(IMG_BORDER_WIDTH[key], t(key));
            }
            dropdown.setValue(this.plugin.settings.imageBorderWidth);
            dropdown.onChange((option) => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.imageBorderWidth = option;
                yield this.plugin.saveSettings();
            }));
        }));
        new obsidian.Setting(containerEl)
            .setName(t("IMAGE_BORDER_STYLE_NAME"))
            .addDropdown((dropdown) => __awaiter(this, void 0, void 0, function* () {
            for (const key in IMG_BORDER_STYLE) {
                // @ts-ignore
                dropdown.addOption(IMG_BORDER_STYLE[key], t(key));
            }
            dropdown.setValue(this.plugin.settings.imageBorderStyle);
            dropdown.onChange((option) => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.imageBorderStyle = option;
                yield this.plugin.saveSettings();
            }));
        }));
        new obsidian.Setting(containerEl)
            .setName(t("IMAGE_BORDER_COLOR_NAME"))
            .addDropdown((dropdown) => __awaiter(this, void 0, void 0, function* () {
            for (const key in IMG_BORDER_COLOR) {
                // @ts-ignore
                dropdown.addOption(IMG_BORDER_COLOR[key], t(key));
            }
            dropdown.setValue(this.plugin.settings.imageBorderColor);
            dropdown.onChange((option) => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.imageBorderColor = option;
                yield this.plugin.saveSettings();
            }));
        }));
        //endregion
        //region >>> GALLERY_NAVBAR_SETTINGS
        //let galleryNavbarDefaultColorSetting: Setting, galleryNavbarHoverColorSetting: Setting,
        // galleryImgBorderToggleSetting: Setting, galleryImgBorderActiveColorSetting: Setting;
        new obsidian.Setting(containerEl).setName(t("GALLERY_NAVBAR_SETTINGS")).setHeading();
        new obsidian.Setting(containerEl)
            .setName(t("GALLERY_NAVBAR_TOGGLE_NAME"))
            .setDesc(t("GALLERY_NAVBAR_TOGGLE_DESC"))
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.galleryNavbarToggle)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.galleryNavbarToggle = value;
            this.switchSettingsDisabled(!value, galleryNavbarDefaultColorSetting, galleryNavbarHoverColorSetting, galleryImgBorderToggleSetting, galleryImgBorderActiveColorSetting);
            yield this.plugin.saveSettings();
        })));
        const galleryNavbarDefaultColorSetting = new obsidian.Setting(containerEl)
            .setName(t("GALLERY_NAVBAR_DEFAULT_COLOR_NAME"))
            .addColorPicker(picker => {
            picker
                .setValue(this.plugin.settings.galleryNavbarDefaultColor || DEFAULT_SETTINGS.galleryNavbarDefaultColor)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.galleryNavbarDefaultColor = value;
                yield this.plugin.saveSettings();
            }));
        })
            .addExtraButton(button => {
            button.setIcon('rotate-ccw')
                .setTooltip(t('RESET'))
                .onClick(() => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.galleryNavbarDefaultColor = DEFAULT_SETTINGS.galleryNavbarDefaultColor;
                yield this.plugin.saveSettings();
                this.display();
            }));
        });
        const galleryNavbarHoverColorSetting = new obsidian.Setting(containerEl)
            .setName(t("GALLERY_NAVBAR_HOVER_COLOR_NAME"))
            .addColorPicker(picker => {
            picker
                .setValue(this.plugin.settings.galleryNavbarHoverColor || DEFAULT_SETTINGS.galleryNavbarHoverColor)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.galleryNavbarHoverColor = value;
                yield this.plugin.saveSettings();
            }));
        })
            .addExtraButton(button => {
            button.setIcon('rotate-ccw')
                .setTooltip(t('RESET'))
                .onClick(() => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.galleryNavbarHoverColor = DEFAULT_SETTINGS.galleryNavbarHoverColor;
                yield this.plugin.saveSettings();
                this.display();
            }));
        });
        const galleryImgBorderToggleSetting = new obsidian.Setting(containerEl)
            .setName(t("GALLERY_IMG_BORDER_TOGGLE_NAME"))
            .setDesc(t("GALLERY_IMG_BORDER_TOGGLE_DESC"))
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.galleryImgBorderActive)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.galleryImgBorderActive = value;
            yield this.plugin.saveSettings();
        })));
        const galleryImgBorderActiveColorSetting = new obsidian.Setting(containerEl)
            .setName(t("GALLERY_IMG_BORDER_ACTIVE_COLOR_NAME"))
            .addColorPicker(picker => {
            picker.setValue(this.plugin.settings.galleryImgBorderActiveColor || DEFAULT_SETTINGS.galleryImgBorderActiveColor)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.galleryImgBorderActiveColor = value;
                yield this.plugin.saveSettings();
            }));
        })
            .addExtraButton(button => {
            button.setIcon('rotate-ccw')
                .setTooltip(t('RESET'))
                .onClick(() => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.imgViewBackgroundColor = DEFAULT_SETTINGS.galleryImgBorderActiveColor;
                yield this.plugin.saveSettings();
                this.display();
            }));
        });
        this.switchSettingsDisabled(!this.plugin.settings.galleryNavbarToggle, galleryNavbarDefaultColorSetting, galleryNavbarHoverColorSetting, galleryImgBorderToggleSetting, galleryImgBorderActiveColorSetting);
        //endregion
        new obsidian.Setting(containerEl)
            .setName('台前调度式图片导航')
            .setDesc('文章左侧的悬浮缩略图带，支持上下滚动；点击放大，右键跳转正文。')
            .addDropdown(dropdown => dropdown
                .addOption('always', '始终显示')
                .addOption('hover', '悬停显示')
                .addOption('off', '关闭')
                .setValue(this.plugin.settings.noteImageStageMode ?? 'always')
                .onChange(value => this.plugin.noteImageStage.setMode(value)))
            .addButton(button => button.setButtonText('显示导航').onClick(() => {
                this.app.setting.close();
                void this.plugin.noteImageStage.open();
            }));
        new obsidian.Setting(containerEl)
            .setName('图片导航大小')
            .setDesc('缩略图显示宽度；也可拖动图片导航右缘调节。')
            .addSlider(slider => slider.setLimits(120,320,10)
                .setValue(this.plugin.noteImageStage.getWidth())
                .setDynamicTooltip()
                .onChange(value => this.plugin.noteImageStage.setWidth(value)));
        //region >>> HOTKEYS_SETTINGS
        new obsidian.Setting(containerEl).setName(t("HOTKEY_SETTINGS")).setDesc(t("HOTKEY_SETTINGS_DESC")).setHeading();
        if (this.plugin.settings.moveTheImageHotkey === this.plugin.settings.switchTheImageHotkey) {
            this.plugin.settings.moveTheImageHotkey = MOVE_THE_IMAGE.DEFAULT_HOTKEY;
        }
        const moveTheImageSetting = new obsidian.Setting(containerEl)
            .setName(t("MOVE_THE_IMAGE_NAME"))
            .setDesc(t("MOVE_THE_IMAGE_DESC"))
            .addDropdown((dropdown) => __awaiter(this, void 0, void 0, function* () {
            dropdown.addOptions(this.getDropdownOptions());
            dropdown.setValue(this.plugin.settings.moveTheImageHotkey);
            dropdown.onChange((option) => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.moveTheImageHotkey = option;
                this.checkDropdownOptions(MOVE_THE_IMAGE.CODE, switchTheImageSetting);
                yield this.plugin.saveSettings();
            }));
        })).then((setting) => {
            setting.addExtraButton(button => {
                button.setIcon('plus').setDisabled(true);
            });
            setting.controlEl.appendChild(obsidian.sanitizeHTMLToDom(MOVE_THE_IMAGE.SVG));
        });
        if (this.plugin.settings.switchTheImageHotkey === this.plugin.settings.moveTheImageHotkey) {
            this.plugin.settings.switchTheImageHotkey = SWITCH_THE_IMAGE.DEFAULT_HOTKEY;
        }
        const switchTheImageSetting = new obsidian.Setting(containerEl)
            .setName(t("SWITCH_THE_IMAGE_NAME"))
            .setDesc(t("SWITCH_THE_IMAGE_DESC"))
            .addDropdown((dropdown) => __awaiter(this, void 0, void 0, function* () {
            dropdown.addOptions(this.getDropdownOptions());
            dropdown.setValue(this.plugin.settings.switchTheImageHotkey);
            dropdown.onChange((option) => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.switchTheImageHotkey = option;
                this.checkDropdownOptions(SWITCH_THE_IMAGE.CODE, moveTheImageSetting);
                yield this.plugin.saveSettings();
            }));
        })).then((setting) => {
            setting.addExtraButton(button => {
                button.setIcon('plus').setDisabled(true);
            });
            setting.controlEl.appendChild(obsidian.sanitizeHTMLToDom(SWITCH_THE_IMAGE.SVG));
        });
        if (switchTheImageSetting) {
            this.checkDropdownOptions(MOVE_THE_IMAGE.CODE, switchTheImageSetting);
        }
        if (moveTheImageSetting) {
            this.checkDropdownOptions(SWITCH_THE_IMAGE.CODE, moveTheImageSetting);
        }
        new obsidian.Setting(containerEl)
            .setName(t("DOUBLE_CLICK_TOOLBAR_NAME"))
            .addDropdown((dropdown) => __awaiter(this, void 0, void 0, function* () {
            for (const conf of TOOLBAR_CONF) {
                if (!conf.enableHotKey)
                    continue;
                // @ts-ignore
                dropdown.addOption(conf.class, t(conf.title));
            }
            dropdown.setValue(this.plugin.settings.doubleClickToolbar);
            dropdown.onChange((option) => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.doubleClickToolbar = option;
                yield this.plugin.saveSettings();
            }));
        }));
        new obsidian.Setting(containerEl)
            .setName(t("VIEW_TRIGGER_HOTKEY_NAME"))
            .setDesc(t("VIEW_TRIGGER_HOTKEY_DESC"))
            .addDropdown((dropdown) => __awaiter(this, void 0, void 0, function* () {
            dropdown.addOptions(this.getDropdownOptions());
            dropdown.setValue(this.plugin.settings.viewTriggerHotkey);
            dropdown.onChange((option) => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.viewTriggerHotkey = option;
                yield this.plugin.saveSettings();
            }));
        }));
        //endregion
    }
    displayCommonSettings(containerEl) {
        new obsidian.Setting(containerEl)
            .setName(t("VIEW_MODE_NAME"))
            .addDropdown((dropdown) => __awaiter(this, void 0, void 0, function* () {
            for (const key in ViewMode) {
                // @ts-ignore
                dropdown.addOption(key, t('VIEW_MODE_' + key.toUpperCase()));
            }
            dropdown.setValue(this.plugin.settings.viewMode);
            dropdown.onChange((option) => __awaiter(this, void 0, void 0, function* () {
                yield this.plugin.switchViewMode(option);
            }));
        }));
    }
    displayViewTriggerSettings(containerEl) {
        new obsidian.Setting(containerEl).setName(t("VIEW_TRIGGER_SETTINGS")).setHeading();
        new obsidian.Setting(containerEl)
            .setName(t("VIEW_IMAGE_IN_EDITOR_NAME"))
            .setDesc(t("VIEW_IMAGE_IN_EDITOR_DESC"))
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.viewImageInEditor)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.viewImageInEditor = value;
            this.plugin.refreshViewTrigger();
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName(t("VIEW_IMAGE_IN_CPB_NAME"))
            .setDesc(t("VIEW_IMAGE_IN_CPB_DESC"))
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.viewImageInCPB)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.viewImageInCPB = value;
            this.plugin.refreshViewTrigger();
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName(t("VIEW_IMAGE_WITH_A_LINK_NAME"))
            .setDesc(t("VIEW_IMAGE_WITH_A_LINK_DESC"))
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.viewImageWithLink)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.viewImageWithLink = value;
            this.plugin.refreshViewTrigger();
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName(t("VIEW_IMAGE_OTHER_NAME"))
            .setDesc(t("VIEW_IMAGE_OTHER_DESC"))
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.viewImageOther)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.viewImageOther = value;
            this.plugin.refreshViewTrigger();
            yield this.plugin.saveSettings();
        })));
    }
    displayPinModeSettings(containerEl) {
        //region >>> PIN_MODE_SETTINGS
        let pinMaximumSetting;
        new obsidian.Setting(containerEl).setName(t("PIN_MODE_SETTINGS")).setHeading();
        /*new Setting(containerEl)
          .setName(t("PIN_MODE_NAME"))
          .setDesc(t("PIN_MODE_DESC"))
          .addToggle(toggle => toggle
            .setValue(this.plugin.settings.pinMode)
            .onChange(async (value) => {
              this.plugin.settings.pinMode = value;
              this.switchSettingsDisabled(!value, pinMaximumSetting, pinCoverSetting);
              //this.plugin.togglePinMode(value);
              await this.plugin.saveSettings();
            }));*/
        let pinMaximumScaleText;
        pinMaximumSetting = new obsidian.Setting(containerEl)
            .setName(t("PIN_MAXIMUM_NAME"))
            .addSlider(slider => slider
            .setLimits(1, 5, 1)
            .setValue(this.plugin.settings.pinMaximum)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            pinMaximumScaleText.innerText = " " + value.toString();
            this.plugin.settings.pinMaximum = value;
            // this.plugin.containerView?.setPinMaximum(value);
            this.plugin.saveSettings();
        })));
        pinMaximumSetting.settingEl.createDiv('', (el) => {
            pinMaximumScaleText = el;
            el.style.minWidth = "2.3em";
            el.style.textAlign = "right";
            el.innerText = " " + this.plugin.settings.pinMaximum.toString();
        });
        new obsidian.Setting(containerEl)
            .setName(t("PIN_COVER_NAME"))
            .setDesc(t("PIN_COVER_DESC"))
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.pinCoverMode)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.pinCoverMode = value;
            yield this.plugin.saveSettings();
        })));
        //this.switchSettingsDisabled(!this.plugin.settings.pinMode, pinMaximumSetting, pinCoverSetting);
        //endregion
    }
    switchSettingsDisabled(disabled, ...settings) {
        for (const setting of settings) {
            setting === null || setting === void 0 ? void 0 : setting.setDisabled(disabled);
        }
    }
    getDropdownOptions() {
        let options = {};
        for (const key in MODIFIER_HOTKEYS) {
            //@ts-ignore
            options[key] = t(key);
        }
        return options;
    }
    checkDropdownOptions(code, setting) {
        if (!setting || !setting.controlEl)
            return;
        const optionElList = setting.controlEl.getElementsByClassName('dropdown')[0].getElementsByTagName('option');
        for (let i = 0, size = optionElList.length; i < size; i++) {
            if (code === MOVE_THE_IMAGE.CODE) {
                optionElList[i].disabled = optionElList[i].value === this.plugin.settings.moveTheImageHotkey;
            }
            else if (code === SWITCH_THE_IMAGE.CODE) {
                optionElList[i].disabled = optionElList[i].value === this.plugin.settings.switchTheImageHotkey;
            }
        }
    }
}

/**
 * ts class object: image operating status
 */
class ImgStatusCto {
    constructor() {
        // true: the popup layer of viewing image is displayed
        this.popup = false;
        // whether the image is being dragged
        this.dragging = false;
        // keybord pressing status
        this.arrowUp = false;
        this.arrowDown = false;
        this.arrowLeft = false;
        this.arrowRight = false;
        this.fullScreen = false;
        this.activeImgZIndex = 0; /*--layer-status-bar*/
        this.clickCount = 0;
    }
}
/**
 * ts class object: image information including all html elements
 */
class ImgInfoCto {
    constructor() {
        this.imgList = new Array();
        this.getPopupImgNum = () => {
            let num = 0;
            for (const imgCto of this.imgList) {
                if (imgCto.popup)
                    num++;
            }
            return num;
        };
    }
}
class ImgCto {
    constructor(index, mtime, imgViewEl) {
        this.popup = false;
        this.zIndex = 0;
        this.curWidth = 0; // image's current width
        this.curHeight = 0;
        this.realWidth = 0; // image's real width
        this.realHeight = 0;
        this.left = 0; // margin-left
        this.top = 0; // margin-top
        this.moveX = 0; // 鼠标相对于图片的位置
        this.moveY = 0;
        this.rotate = 0; // rotateDeg
        this.invertColor = false;
        this.scaleX = false; // scaleX(-1)
        this.scaleY = false; // scaleY(-1)
        this.fullScreen = false; // whether the image is being previewed in full-screen mode
        this.defaultImgStyle = {
            transform: 'none',
            filter: 'none',
            mixBlendMode: 'normal',
            borderWidth: '',
            borderStyle: '',
            borderColor: ''
        };
        this.index = index;
        this.mtime = mtime;
        this.imgViewEl = imgViewEl;
    }
}

/**
 * Image utility class
 */
class ImgUtil {
    static copyText(text) {
        navigator.clipboard.writeText(text)
            .then(() => {
            //console.log('copyText:', copyText);
        })
            .catch(err => {
            console.error('copy text error', err);
        });
    }
    static copyImage(imgEle, width, height) {
        let image = new Image();
        image.crossOrigin = 'anonymous';
        image.src = imgEle.src;
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0);
            try {
                canvas.toBlob((blob) => __awaiter(this, void 0, void 0, function* () {
                    yield navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
                        .then(() => {
                        new obsidian.Notice(t("COPY_IMAGE_SUCCESS"));
                    }, () => {
                        new obsidian.Notice(t("COPY_IMAGE_ERROR"));
                    });
                }));
            }
            catch (error) {
                new obsidian.Notice(t("COPY_IMAGE_ERROR"));
                console.error(error);
            }
        };
        image.onerror = () => {
            new obsidian.Notice(t("COPY_IMAGE_ERROR"));
        };
    }
}
ImgUtil.calculateImgZoomSize = (realImg, imgCto, windowWidth, windowHeight) => {
    if (!windowWidth) {
        windowWidth = document.documentElement.clientWidth || document.body.clientWidth;
    }
    if (!windowHeight) {
        windowHeight = (document.documentElement.clientHeight || document.body.clientHeight) - 100;
    }
    const windowZoomWidth = windowWidth * ZOOM_FACTOR;
    const windowZoomHeight = windowHeight * ZOOM_FACTOR;
    let tempWidth = realImg.width, tempHeight = realImg.height;
    if (realImg.height > windowZoomHeight) {
        tempHeight = windowZoomHeight;
        if ((tempWidth = tempHeight / realImg.height * realImg.width) > windowZoomWidth) {
            tempWidth = windowZoomWidth;
        }
    }
    else if (realImg.width > windowZoomWidth) {
        tempWidth = windowZoomWidth;
        tempHeight = tempWidth / realImg.width * realImg.height;
    }
    tempHeight = tempWidth * realImg.height / realImg.width;
    // cache image info: curWidth, curHeight, realWidth, realHeight, left, top
    imgCto.left = (windowWidth - tempWidth) / 2;
    imgCto.top = (windowHeight - tempHeight) / 2;
    imgCto.curWidth = tempWidth;
    imgCto.curHeight = tempHeight;
    imgCto.realWidth = realImg.width;
    imgCto.realHeight = realImg.height;
    /* console.log('calculateImgZoomSize', 'realImg: ' + realImg.width + ',' + realImg.height,
        'tempSize: ' + tempWidth + ',' + tempHeight,
        'windowZoomSize: ' + windowZoomWidth + ',' + windowZoomHeight,
        'windowSize: ' + windowWidth + ',' + windowHeight); */
    return imgCto;
};
/**
 * zoom an image
 * @param ratio
 * @param targetImgInfo
 * @param offsetSize
 * @param actualSize
 * @returns
 */
ImgUtil.zoom = (ratio, targetImgInfo, offsetSize, actualSize) => {
    let zoomRatio;
    if (!actualSize) {
        const zoomInFlag = ratio > 0;
        ratio = zoomInFlag ? 1 + ratio : 1 / (1 - ratio);
        zoomRatio = targetImgInfo.curWidth * ratio / targetImgInfo.realWidth;
    }
    // Snap to 100% zoom when we pass over it
    const curRatio = targetImgInfo.curWidth / targetImgInfo.realWidth;
    if (actualSize || (curRatio < 1 && zoomRatio > 1) || (curRatio > 1 && zoomRatio < 1)) {
        // set zoom ratio to 100%
        zoomRatio = 1;
        // reduce snap offset ratio accordingly
        ratio = 1 / curRatio;
    }
    let newWidth = targetImgInfo.realWidth * zoomRatio;
    let newHeight = targetImgInfo.realHeight * zoomRatio;
    if (IMG_VIEW_MIN >= newWidth || IMG_VIEW_MIN >= newHeight) {
        // set minimum width or height
        if (IMG_VIEW_MIN >= newWidth) {
            newWidth = IMG_VIEW_MIN;
            newHeight = (newWidth * targetImgInfo.realHeight) / targetImgInfo.realWidth;
        }
        else {
            newHeight = IMG_VIEW_MIN;
            newWidth = (newHeight * targetImgInfo.realWidth) / targetImgInfo.realHeight;
        }
        ratio = 1;
    }
    const left = targetImgInfo.left + offsetSize.offsetX * (1 - ratio);
    const top = targetImgInfo.top + offsetSize.offsetY * (1 - ratio);
    // cache image info: curWidth, curHeight, left, top
    targetImgInfo.curWidth = newWidth;
    targetImgInfo.curHeight = newHeight;
    targetImgInfo.left = left;
    targetImgInfo.top = top;
    // return { newWidth, left, top };
    return targetImgInfo;
};
ImgUtil.transform = (targetImgInfo) => {
    let transform = 'rotate(' + targetImgInfo.rotate + 'deg)';
    if (targetImgInfo.scaleX) {
        transform += ' scaleX(-1)';
    }
    if (targetImgInfo.scaleY) {
        transform += ' scaleY(-1)';
    }
    targetImgInfo.imgViewEl.style.setProperty('transform', transform);
};
ImgUtil.rotate = (degree, targetImgInfo) => {
    targetImgInfo.imgViewEl.style.setProperty('transform', 'rotate(' + (targetImgInfo.rotate += degree) + 'deg)');
};
ImgUtil.invertImgColor = (imgEle, open) => {
    if (open) {
        imgEle.style.setProperty('filter', 'invert(1) hue-rotate(180deg)');
        imgEle.style.setProperty('mix-blend-mode', 'screen');
    }
    else {
        imgEle.style.setProperty('filter', 'none');
        imgEle.style.setProperty('mix-blend-mode', 'normal');
    }
    // open ? imgEle.addClass('image-toolkit-img-invert') : imgEle.removeClass('image-toolkit-img-invert');
};

class ContainerView {
    constructor(plugin) {
        this.lastClickedImgDefaultStyle = {
            borderWidth: '',
            borderStyle: '',
            borderColor: ''
        };
        this.imgGlobalStatus = new ImgStatusCto();
        this.imgInfo = new ImgInfoCto();
        this.getViewMode = () => {
            return this.plugin.settings.viewMode;
        };
        this.isPinMode = () => {
            return ViewMode.Pin === this.getViewMode();
        };
        this.isNormalMode = () => {
            return ViewMode.Normal === this.getViewMode();
        };
        this.setMenuView = (menuView) => {
            this.menuView = menuView;
        };
        this.getPlugin = () => {
            return this.plugin;
        };
        this.getLastClickedImgEl = () => {
            return this.lastClickedImgEl;
        };
        this.getActiveImg = () => {
            return this.imgGlobalStatus.activeImg;
        };
        this.getDoc = () => {
            return this.doc;
        };
        /*public setPinMaximum = (val: number) => {
          this.pinMaximum = val;
        }*/
        this.getOitContainerViewEl = () => {
            return this.imgInfo.imgContainerEl;
        };
        this.getParentContainerEl = (targetEl) => {
            if (!targetEl) {
                return this.parentContainerEl;
            }
            if (!this.parentContainerEl) {
                this.parentContainerEl = targetEl.matchParent('body');
                this.doc = this.parentContainerEl.ownerDocument;
            }
            return this.parentContainerEl;
        };
        //region ================== Container View & Init ========================
        /**
         * Render when clicking an image (core step)
         * @param targetEl clicked image's element
         * @returns
         */
        this.renderContainer = (targetEl) => {
            if (!this.checkStatus())
                return;
            const matchedImg = this.initContainerView(targetEl, this.getParentContainerEl(targetEl));
            if (!matchedImg)
                return;
            this.openOitContainerView(matchedImg);
            this.plugin.noteImageStage?.prepareDesktopPreview(this,targetEl);
            this.renderGalleryNavbar();
            this.refreshImg(matchedImg, targetEl.src, targetEl.alt);
            matchedImg.mtime = new Date().getTime();
        };
        /**
         * initContainerDom ->
         * @param targetEl
         * @param parentContainerEl  targetEl's body
         */
        this.initContainerView = (targetEl, parentContainerEl) => {
            const matchedImg = this.initContainerDom(parentContainerEl);
            if (!matchedImg)
                return null;
            matchedImg.targetOriginalImgEl = targetEl;
            this.restoreBorderForLastClickedImg();
            this.initDefaultData(matchedImg, window.getComputedStyle(targetEl));
            this.addBorderForLastClickedImg(targetEl);
            this.addOrRemoveEvents(matchedImg, true); // add events
            return matchedImg;
        };
        this.removeOitContainerView = () => {
            if(this.plugin.noteImageStage?.galleryContext && this.plugin.noteImageStage.galleryContext.origin===this.lastClickedImgEl) this.plugin.noteImageStage.galleryContext=null;
            this.plugin.noteImageStage?.clearDesktopPreview(this,true);
            this.imgGlobalStatus.popup=false;
            this.doc?.removeEventListener('keydown',this.triggerKeydown);
            this.doc?.removeEventListener('keyup',this.triggerKeyup);
            for(const img of this.imgInfo.imgList) {
                if(this.doc && this.imgInfo.oitContainerEl && img.imgViewEl) this.addOrRemoveEvents(img,false);
                if(img.refreshImgInterval){clearInterval(img.refreshImgInterval);img.refreshImgInterval=null;}
            }
            if(this.imgGlobalStatus.clickTimer){clearTimeout(this.imgGlobalStatus.clickTimer);this.imgGlobalStatus.clickTimer=null;}
            this.imgGlobalStatus.clickCount=0;
            if(this.imgInfo.imgTipTimeout){clearTimeout(this.imgInfo.imgTipTimeout);this.imgInfo.imgTipTimeout=null;}
            var _a;
            this.restoreBorderForLastClickedImg();
            this.removeGalleryNavbar();
            (_a = this.imgInfo.oitContainerEl) === null || _a === void 0 ? void 0 : _a.remove();
            this.imgInfo.oitContainerEl = null;
            this.imgInfo.imgContainerEl = null;
            this.imgGlobalStatus.dragging = false;
            this.imgGlobalStatus.popup = false;
            this.imgGlobalStatus.activeImgZIndex = 0;
            this.imgGlobalStatus.fullScreen = false;
            this.imgGlobalStatus.activeImg = null;
            // clear imgList
            this.imgInfo.imgList.length = 0;
        };
        this.checkStatus = () => {
            const viewMode = this.plugin.getViewMode();
            if (!viewMode)
                return false;
            // none of popped-up-images
            if (!this.imgGlobalStatus.popup)
                return true;
            // Pin mode && Cover mode
            if (this.isPinMode() && this.plugin.settings.pinCoverMode)
                return true;
            // configured max images > current pop-up images
            if (this.getConfiguredPinMaximum() > this.imgInfo.getPopupImgNum())
                return true;
            new obsidian.Notice(t("PIN_MAXIMUM_NOTICE"));
            return false;
        };
        this.getConfiguredPinMaximum = () => {
            if (this.isPinMode())
                return this.plugin.settings.pinMaximum;
            return 1;
        };
        this.initDefaultData = (matchedImg, targetImgStyle) => {
            if (targetImgStyle) {
                matchedImg.defaultImgStyle.transform = 'none';
                matchedImg.defaultImgStyle.filter = targetImgStyle.filter;
                matchedImg.defaultImgStyle.mixBlendMode = targetImgStyle.mixBlendMode;
                matchedImg.defaultImgStyle.borderWidth = targetImgStyle.borderWidth;
                matchedImg.defaultImgStyle.borderStyle = targetImgStyle.borderStyle;
                matchedImg.defaultImgStyle.borderColor = targetImgStyle.borderColor;
                this.lastClickedImgDefaultStyle.borderWidth = targetImgStyle.borderWidth;
                this.lastClickedImgDefaultStyle.borderStyle = targetImgStyle.borderStyle;
                this.lastClickedImgDefaultStyle.borderColor = targetImgStyle.borderColor;
            }
            this.imgGlobalStatus.dragging = false;
            this.imgGlobalStatus.arrowUp = false;
            this.imgGlobalStatus.arrowDown = false;
            this.imgGlobalStatus.arrowLeft = false;
            this.imgGlobalStatus.arrowRight = false;
            matchedImg.invertColor = false;
            matchedImg.scaleX = false;
            matchedImg.scaleY = false;
            matchedImg.fullScreen = false;
            if (!this.imgGlobalStatus.popup) {
                this.resetClickTimer();
            }
        };
        /**
         * set 'data-oit-target' and lastClickedImgEl
         * @param targetEl
         */
        this.setLastClickedImg = (targetEl) => {
            if (!targetEl)
                return;
            if(this.plugin.noteImageStage?.galleryContext && this.plugin.noteImageStage.galleryContext.origin!==targetEl) this.plugin.noteImageStage.galleryContext=null;
            // 'data-oit-target' is set for locating current image
            targetEl.setAttribute('data-oit-target', '1');
            this.lastClickedImgEl = targetEl;
        };
        //endregion
        //region ================== (Original) Image Border ========================
        this.addBorderForLastClickedImg = (targetEl) => {
            this.setLastClickedImg(targetEl);
            if (!targetEl || !this.plugin.settings.imageBorderToggle)
                return;
            const lastClickedImgStyle = targetEl === null || targetEl === void 0 ? void 0 : targetEl.style;
            if (!lastClickedImgStyle)
                return;
            lastClickedImgStyle.setProperty('border-width', this.plugin.settings.imageBorderWidth);
            lastClickedImgStyle.setProperty('border-style', this.plugin.settings.imageBorderStyle);
            lastClickedImgStyle.setProperty('border-color', this.plugin.settings.imageBorderColor);
        };
        /**
         * remove 'data-oit-target'
         * restore default border style
         */
        this.restoreBorderForLastClickedImg = () => {
            if (!this.lastClickedImgEl)
                return;
            this.lastClickedImgEl.removeAttribute('data-oit-target');
            const lastClickedImgStyle = this.lastClickedImgEl.style;
            if (lastClickedImgStyle) {
                lastClickedImgStyle.setProperty('border-width', this.lastClickedImgDefaultStyle.borderWidth);
                lastClickedImgStyle.setProperty('border-style', this.lastClickedImgDefaultStyle.borderStyle);
                lastClickedImgStyle.setProperty('border-color', this.lastClickedImgDefaultStyle.borderColor);
            }
        };
        //endregion
        //region ================== Image ========================
        this.updateImgViewElAndList = (imgInfo) => {
            if (!(imgInfo === null || imgInfo === void 0 ? void 0 : imgInfo.imgContainerEl))
                return;
            const pinMaximum = this.getConfiguredPinMaximum();
            const imgNum = this.imgInfo.imgList.length;
            if (pinMaximum < imgNum) {
                // remove all imgViewEl and imgList
                imgInfo.imgContainerEl.innerHTML = '';
                // clear imgList
                imgInfo.imgList.length = 0;
            }
            // let isUpdate: boolean = false;
            const curTime = new Date().getTime();
            for (let i = imgNum; i < pinMaximum; i++) {
                // <div class="oit-img-container"> `<img class='oit-img-view' data-index='0' src='' alt=''>` </div>
                let imgViewEl = createEl('img');
                imgViewEl.addClass(OIT_CLASS.IMG_VIEW);
                imgViewEl.hidden = true; // hide 'oit-img-view' for now
                imgViewEl.dataset.index = i + ''; // set data-index
                this.setImgViewDefaultBackground(imgViewEl);
                imgInfo.imgContainerEl.appendChild(imgViewEl);
                // cache imgList
                imgInfo.imgList.push(new ImgCto(i, curTime, imgViewEl));
                // isUpdate = true;
            }
        };
        this.getMatchedImg = () => {
            let earliestImg;
            for (const img of this.imgInfo.imgList) {
                if (!earliestImg || earliestImg.mtime > img.mtime)
                    earliestImg = img;
                if (img.popup)
                    continue;
                return img;
            }
            if (this.plugin.settings.pinCoverMode) {
                return earliestImg;
            }
            return null;
        };
        /**
         * it may from: renderContainerView(), switch GalleryNavbarView, click toolbar_refresh
         * @param imgCto
         * @param imgSrc
         * @param imgAlt
         * @param imgTitleIndex
         */
        this.refreshImg = (imgCto, imgSrc, imgAlt, imgTitleIndex) => {
            if (!imgSrc)
                imgSrc = imgCto.imgViewEl.src;
            if (!imgAlt)
                imgAlt = imgCto.imgViewEl.alt;
            this.renderImgTitle(imgAlt, imgTitleIndex);
            if (imgSrc) {
                if (imgCto.refreshImgInterval) {
                    clearInterval(imgCto.refreshImgInterval);
                    imgCto.refreshImgInterval = null;
                }
                let realImg = new Image();
                realImg.src = imgSrc;
                imgCto.refreshImgInterval = setInterval((realImg) => {
                    var _a, _b;
                    if (realImg.width > 0 || realImg.height > 0) {
                        clearInterval(imgCto.refreshImgInterval);
                        imgCto.refreshImgInterval = null;
                        this.setImgViewPosition(ImgUtil.calculateImgZoomSize(realImg, imgCto, (_a = this.parentContainerEl) === null || _a === void 0 ? void 0 : _a.clientWidth, (_b = this.parentContainerEl) === null || _b === void 0 ? void 0 : _b.clientHeight), 0);
                        this.renderImgView(imgCto.imgViewEl, imgSrc, imgAlt);
                        this.renderImgTip(imgCto);
                        imgCto.imgViewEl.style.setProperty('transform', imgCto.defaultImgStyle.transform);
                        imgCto.imgViewEl.style.setProperty('filter', imgCto.defaultImgStyle.filter);
                        imgCto.imgViewEl.style.setProperty('mix-blend-mode', imgCto.defaultImgStyle.mixBlendMode);
                        this.plugin.noteImageStage?.revealDesktopPreview(this,imgCto.imgViewEl);
                    }
                }, 40, realImg);
            }
        };
        this.renderImgTitle = (name, index) => {
        };
        this.setImgViewPosition = (imgZoomSize, rotate) => {
            const imgViewEl = imgZoomSize.imgViewEl;
            if (!imgViewEl)
                return;
            if (imgZoomSize) {
                imgViewEl.setAttribute('width', imgZoomSize.curWidth + 'px');
                imgViewEl.style.setProperty('margin-top', imgZoomSize.top + 'px', 'important');
                imgViewEl.style.setProperty('margin-left', imgZoomSize.left + 'px', 'important');
            }
            const rotateDeg = rotate ? rotate : 0;
            imgViewEl.style.transform = 'rotate(' + rotateDeg + 'deg)';
            imgZoomSize.rotate = rotateDeg;
        };
        this.renderImgView = (imgViewEl, src, alt) => {
            if (!imgViewEl)
                return;
            imgViewEl.setAttribute('src', src);
            imgViewEl.setAttribute('alt', alt);
            imgViewEl.hidden = !src && !alt;
            if(!src)this.plugin.noteImageStage?.clearDesktopPreview(this);
        };
        this.renderImgTip = (activeImg) => {
            if (!activeImg)
                activeImg = this.imgGlobalStatus.activeImg;
            if (activeImg && this.imgInfo.imgTipEl && activeImg.realWidth > 0 && activeImg.curWidth > 0) {
                if (this.imgInfo.imgTipTimeout) {
                    clearTimeout(this.imgInfo.imgTipTimeout);
                }
                if (this.plugin.settings.imgTipToggle) {
                    this.imgInfo.imgTipEl.hidden = false; // display 'oit-img-tip'
                    const ratio = activeImg.curWidth * 100 / activeImg.realWidth;
                    const isSingleDigit = 10 > ratio;
                    const width = isSingleDigit ? 20 : 40;
                    const left = activeImg.left + activeImg.curWidth / 2 - width / 2;
                    const top = activeImg.top + activeImg.curHeight / 2 - 10;
                    this.imgInfo.imgTipEl.style.setProperty("width", width + 'px');
                    this.imgInfo.imgTipEl.style.setProperty("font-size", isSingleDigit || 100 >= activeImg.curWidth ? 'xx-small' : 'x-small');
                    this.imgInfo.imgTipEl.style.setProperty("left", left + 'px');
                    this.imgInfo.imgTipEl.style.setProperty("top", top + 'px');
                    this.imgInfo.imgTipEl.style.setProperty("z-index", activeImg.zIndex + '');
                    this.imgInfo.imgTipEl.setText(parseInt(ratio + '') + '%');
                    this.imgInfo.imgTipTimeout = setTimeout(() => {
                        this.imgInfo.imgTipEl.hidden = true;
                    }, 1000);
                }
                else {
                    this.imgInfo.imgTipEl.hidden = true; // hide 'oit-img-tip'
                    this.imgInfo.imgTipTimeout = null;
                }
            }
        };
        this.setImgViewDefaultBackgroundForImgList = () => {
            for (const imgCto of this.imgInfo.imgList) {
                this.setImgViewDefaultBackground(imgCto.imgViewEl);
            }
        };
        this.setImgViewDefaultBackground = (imgViewEl) => {
            if (!imgViewEl)
                return;
            if (this.plugin.settings.imgViewBackgroundColor && IMG_DEFAULT_BACKGROUND_COLOR != this.plugin.settings.imgViewBackgroundColor) {
                imgViewEl.removeClass('img-default-background');
                imgViewEl.style.setProperty('background-color', this.plugin.settings.imgViewBackgroundColor);
            }
            else {
                imgViewEl.addClass('img-default-background');
                imgViewEl.style.removeProperty('background-color');
            }
        };
        this.setActiveImgZIndex = (activeImg) => {
        };
        //endregion
        //region ================== Gallery NavBar ========================
        this.switchImageOnGalleryNavBar = (event, next) => {
        };
        this.renderGalleryNavbar = () => {
        };
        this.removeGalleryNavbar = () => {
        };
        //endregion
        //region ================== full screen ========================
        /**
         * full-screen mode
         */
        this.showPlayerImg = (activeImg) => {
            if (!activeImg && !(activeImg = this.imgGlobalStatus.activeImg))
                return;
            this.imgGlobalStatus.fullScreen = true;
            activeImg.fullScreen = true;
            // activeImg.imgViewEl.style.setProperty('display', 'none', 'important'); // hide imgViewEl
            // this.imgInfoCto.imgFooterEl?.style.setProperty('display', 'none'); // hide 'oit-img-footer'
            // show the img-player
            this.imgInfo.imgPlayerEl.style.setProperty('display', 'block');
            this.imgInfo.imgPlayerEl.style.setProperty('z-index', (this.imgGlobalStatus.activeImgZIndex + 10) + '');
            this.imgInfo.imgPlayerEl.addEventListener('click', this.closePlayerImg);
            const windowWidth = this.doc.documentElement.clientWidth || this.doc.body.clientWidth;
            const windowHeight = this.doc.documentElement.clientHeight || this.doc.body.clientHeight;
            let newWidth, newHeight;
            let top = 0;
            if (IMG_FULL_SCREEN_MODE.STRETCH == this.plugin.settings.imgFullScreenMode) {
                newWidth = windowWidth + 'px';
                newHeight = windowHeight + 'px';
            }
            else if (IMG_FULL_SCREEN_MODE.FILL == this.plugin.settings.imgFullScreenMode) {
                newWidth = '100%';
                newHeight = '100%';
            }
            else {
                // fit
                const widthRatio = windowWidth / activeImg.realWidth;
                const heightRatio = windowHeight / activeImg.realHeight;
                if (widthRatio <= heightRatio) {
                    newWidth = windowWidth;
                    newHeight = widthRatio * activeImg.realHeight;
                }
                else {
                    newHeight = windowHeight;
                    newWidth = heightRatio * activeImg.realWidth;
                }
                top = (windowHeight - newHeight) / 2;
                newWidth = newWidth + 'px';
                newHeight = newHeight + 'px';
            }
            const imgPlayerImgViewEl = this.imgInfo.imgPlayerImgViewEl;
            if (imgPlayerImgViewEl) {
                imgPlayerImgViewEl.setAttribute('src', activeImg.imgViewEl.src);
                imgPlayerImgViewEl.setAttribute('alt', activeImg.imgViewEl.alt);
                imgPlayerImgViewEl.setAttribute('width', newWidth);
                imgPlayerImgViewEl.setAttribute('height', newHeight);
                imgPlayerImgViewEl.style.setProperty('margin-top', top + 'px');
                //this.imgInfo.imgPlayerImgViewEl.style.setProperty('margin-left', left + 'px');
                this.setImgViewDefaultBackground(imgPlayerImgViewEl);
            }
        };
        /**
         * close full screen
         */
        this.closePlayerImg = () => {
            for (const imgCto of this.imgInfo.imgList) {
                if (!imgCto.fullScreen)
                    continue;
                // show the popped up image
                // imgCto.imgViewEl?.style.setProperty('display', 'block', 'important');
                // this.imgInfoCto.imgFooterEl?.style.setProperty('display', 'block');
            }
            // hide full screen
            if (this.imgInfo.imgPlayerEl) {
                this.imgInfo.imgPlayerEl.style.setProperty('display', 'none'); // hide 'img-player'
                this.imgInfo.imgPlayerEl.removeEventListener('click', this.closePlayerImg);
            }
            if (this.imgInfo.imgPlayerImgViewEl) {
                this.imgInfo.imgPlayerImgViewEl.setAttribute('src', '');
                this.imgInfo.imgPlayerImgViewEl.setAttribute('alt', '');
            }
            this.imgGlobalStatus.fullScreen = false;
        };
        //endregion
        //region ================== events ========================
        this.addOrRemoveEvents = (matchedImg, isAdd) => {
            if (isAdd) {
                if (!this.imgGlobalStatus.popup) {
                    this.doc.addEventListener('keydown', this.triggerKeydown);
                    this.doc.addEventListener('keyup', this.triggerKeyup);
                }
                if (this.isNormalMode()) {
                    // click event: hide container view
                    this.imgInfo.oitContainerEl.addEventListener('click', this.closeContainerView);
                }
                matchedImg.imgViewEl.addEventListener('mouseenter', this.mouseenterImgView);
                matchedImg.imgViewEl.addEventListener('mouseleave', this.mouseleaveImgView);
                // drag the image via mouse
                matchedImg.imgViewEl.addEventListener('mousedown', this.mousedownImgView);
                matchedImg.imgViewEl.addEventListener('mouseup', this.mouseupImgView);
                // zoom the image via mouse wheel
                matchedImg.imgViewEl.addEventListener('mousewheel', this.mousewheelViewContainer, { passive: true });
            }
            else {
                if (!this.imgGlobalStatus.popup) {
                    this.doc.removeEventListener('keydown', this.triggerKeydown);
                    this.doc.removeEventListener('keyup', this.triggerKeyup);
                    if (this.imgGlobalStatus.clickTimer) {
                        clearTimeout(this.imgGlobalStatus.clickTimer);
                        this.imgGlobalStatus.clickTimer = null;
                        this.imgGlobalStatus.clickCount = 0;
                    }
                }
                if (!this.isPinMode()) {
                    this.imgInfo.oitContainerEl.removeEventListener('click', this.closeContainerView);
                }
                matchedImg.imgViewEl.removeEventListener('mouseenter', this.mouseenterImgView);
                matchedImg.imgViewEl.removeEventListener('mouseleave', this.mouseleaveImgView);
                matchedImg.imgViewEl.removeEventListener('mousedown', this.mousedownImgView);
                matchedImg.imgViewEl.removeEventListener('mouseup', this.mouseupImgView);
                matchedImg.imgViewEl.removeEventListener('mousewheel', this.mousewheelViewContainer);
                if (matchedImg.refreshImgInterval) {
                    clearInterval(matchedImg.refreshImgInterval);
                    matchedImg.refreshImgInterval = null;
                }
            }
        };
        this.triggerKeyup = (event) => {
            // console.log('keyup', event, event.key);
            const key = event.key;
            if (!key)
                return;
            if (!('Escape' === key)) {
                event.preventDefault();
                event.stopPropagation();
            }
            switch (key) {
                case 'Escape':
                    // close full screen, hide container view
                    this.imgGlobalStatus.fullScreen ? this.closePlayerImg() : this.closeContainerView();
                    break;
                case 'ArrowUp':
                    this.imgGlobalStatus.arrowUp = false;
                    break;
                case 'ArrowDown':
                    this.imgGlobalStatus.arrowDown = false;
                    break;
                case 'ArrowLeft':
                    this.imgGlobalStatus.arrowLeft = false;
                    // switch to the previous image on the gallery navBar
                    this.switchImageOnGalleryNavBar(event, false);
                    break;
                case 'ArrowRight':
                    this.imgGlobalStatus.arrowRight = false;
                    // switch to the next image on the gallery navBar
                    this.switchImageOnGalleryNavBar(event, true);
                    break;
            }
        };
        /**
         * move the image by keyboard
         * @param event
         */
        this.triggerKeydown = (event) => {
            //console.log('keydown', event, event.key, this.imgStatus);
            if (this.isPinMode())
                return;
            event.preventDefault();
            event.stopPropagation();
            if (this.imgGlobalStatus.arrowUp && this.imgGlobalStatus.arrowLeft) {
                this.moveImgViewByHotkey(event, 'UP_LEFT');
                return;
            }
            else if (this.imgGlobalStatus.arrowUp && this.imgGlobalStatus.arrowRight) {
                this.moveImgViewByHotkey(event, 'UP_RIGHT');
                return;
            }
            else if (this.imgGlobalStatus.arrowDown && this.imgGlobalStatus.arrowLeft) {
                this.moveImgViewByHotkey(event, 'DOWN_LEFT');
                return;
            }
            else if (this.imgGlobalStatus.arrowDown && this.imgGlobalStatus.arrowRight) {
                this.moveImgViewByHotkey(event, 'DOWN_RIGHT');
                return;
            }
            switch (event.key) {
                case 'ArrowUp':
                    this.imgGlobalStatus.arrowUp = true;
                    this.moveImgViewByHotkey(event, 'UP');
                    break;
                case 'ArrowDown':
                    this.imgGlobalStatus.arrowDown = true;
                    this.moveImgViewByHotkey(event, 'DOWN');
                    break;
                case 'ArrowLeft':
                    this.imgGlobalStatus.arrowLeft = true;
                    this.moveImgViewByHotkey(event, 'LEFT');
                    break;
                case 'ArrowRight':
                    this.imgGlobalStatus.arrowRight = true;
                    this.moveImgViewByHotkey(event, 'RIGHT');
                    break;
            }
        };
        this.moveImgViewByHotkey = (event, orientation) => {
            if (!orientation || !this.imgGlobalStatus.popup || !this.checkHotkeySettings(event, this.plugin.settings.moveTheImageHotkey))
                return;
            switch (orientation) {
                case 'UP':
                    this.mousemoveImgView(null, { offsetX: 0, offsetY: -this.plugin.settings.imageMoveSpeed });
                    break;
                case 'DOWN':
                    this.mousemoveImgView(null, { offsetX: 0, offsetY: this.plugin.settings.imageMoveSpeed });
                    break;
                case 'LEFT':
                    this.mousemoveImgView(null, { offsetX: -this.plugin.settings.imageMoveSpeed, offsetY: 0 });
                    break;
                case 'RIGHT':
                    this.mousemoveImgView(null, { offsetX: this.plugin.settings.imageMoveSpeed, offsetY: 0 });
                    break;
                case 'UP_LEFT':
                    this.mousemoveImgView(null, {
                        offsetX: -this.plugin.settings.imageMoveSpeed,
                        offsetY: -this.plugin.settings.imageMoveSpeed
                    });
                    break;
                case 'UP_RIGHT':
                    this.mousemoveImgView(null, {
                        offsetX: this.plugin.settings.imageMoveSpeed,
                        offsetY: -this.plugin.settings.imageMoveSpeed
                    });
                    break;
                case 'DOWN_LEFT':
                    this.mousemoveImgView(null, {
                        offsetX: -this.plugin.settings.imageMoveSpeed,
                        offsetY: this.plugin.settings.imageMoveSpeed
                    });
                    break;
                case 'DOWN_RIGHT':
                    this.mousemoveImgView(null, {
                        offsetX: this.plugin.settings.imageMoveSpeed,
                        offsetY: this.plugin.settings.imageMoveSpeed
                    });
                    break;
            }
        };
        this.checkHotkeySettings = (event, hotkey) => {
            // console.log("[oit] checkHotkeySettings: ", event.ctrlKey, event.altKey, event.shiftKey)
            switch (hotkey) {
                case "NONE":
                    return !event.ctrlKey && !event.altKey && !event.shiftKey;
                case "CTRL":
                    return event.ctrlKey && !event.altKey && !event.shiftKey;
                case "ALT":
                    return !event.ctrlKey && event.altKey && !event.shiftKey;
                case "SHIFT":
                    return !event.ctrlKey && !event.altKey && event.shiftKey;
                case "CTRL_ALT":
                    return event.ctrlKey && event.altKey && !event.shiftKey;
                case "CTRL_SHIFT":
                    return event.ctrlKey && !event.altKey && event.shiftKey;
                case "SHIFT_ALT":
                    return !event.ctrlKey && event.altKey && event.shiftKey;
                case "CTRL_SHIFT_ALT":
                    return event.ctrlKey && event.altKey && event.shiftKey;
            }
            return false;
        };
        this.mouseenterImgView = (event) => {
            this.resetClickTimer();
            event.stopPropagation();
            event.preventDefault();
            this.getAndUpdateActiveImg(event);
            // console.log('mouseenterImgView', event, this.imgGlobalStatus.activeImg);
        };
        this.mousedownImgView = (event) => {
            // console.log('mousedownImgView', event, this.imgGlobalStatus.activeImg, event.button);
            event.stopPropagation();
            event.preventDefault();
            const activeImg = this.getAndUpdateActiveImg(event);
            if (!activeImg)
                return;
            if (0 == event.button) { // left click
                this.setClickTimer(activeImg);
                this.setActiveImgZIndex(activeImg);
                this.imgGlobalStatus.dragging = true;
                // 鼠标相对于图片的位置
                activeImg.moveX = activeImg.imgViewEl.offsetLeft - event.clientX;
                activeImg.moveY = activeImg.imgViewEl.offsetTop - event.clientY;
                // 鼠标按下时持续触发/移动事件
                activeImg.imgViewEl.onmousemove = this.mousemoveImgView;
            }
        };
        /**
         * move the image by mouse or keyboard
         * @param event
         * @param offsetSize
         */
        this.mousemoveImgView = (event, offsetSize) => {
            // console.log('mousemoveImgView', event, this.imgGlobalStatus.activeImg);
            const activeImg = this.imgGlobalStatus.activeImg;
            if (!activeImg)
                return;
            if (event) {
                if (!this.imgGlobalStatus.dragging)
                    return;
                // drag via mouse cursor (Both Mode)
                activeImg.left = event.clientX + activeImg.moveX;
                activeImg.top = event.clientY + activeImg.moveY;
            }
            else if (offsetSize) {
                // move by arrow keys (Normal Mode)
                activeImg.left += offsetSize.offsetX;
                activeImg.top += offsetSize.offsetY;
            }
            else {
                return;
            }
            // move the image
            activeImg.imgViewEl.style.setProperty('margin-left', activeImg.left + 'px', 'important');
            activeImg.imgViewEl.style.setProperty('margin-top', activeImg.top + 'px', 'important');
        };
        this.mouseupImgView = (event) => {
            var _a;
            // console.log('mouseupImgView', event, this.imgGlobalStatus.activeImg);
            this.imgGlobalStatus.dragging = false;
            event.preventDefault();
            event.stopPropagation();
            const activeImg = this.imgGlobalStatus.activeImg;
            if (activeImg) {
                activeImg.imgViewEl.onmousemove = null;
                if (2 == event.button) { // right click
                    (_a = this.menuView) === null || _a === void 0 ? void 0 : _a.show(event, activeImg);
                }
            }
        };
        this.mouseleaveImgView = (event) => {
            // console.log('mouseleaveImgView', event, this.imgGlobalStatus.activeImg, '>>> set null');
            this.imgGlobalStatus.dragging = false;
            this.resetClickTimer();
            event.preventDefault();
            event.stopPropagation();
            const activeImg = this.imgGlobalStatus.activeImg;
            if (activeImg) {
                activeImg.imgViewEl.onmousemove = null;
                this.setActiveImgForMouseEvent(null); // for pin mode
            }
        };
        this.setClickTimer = (activeImg) => {
            ++this.imgGlobalStatus.clickCount;
            clearTimeout(this.imgGlobalStatus.clickTimer);
            this.imgGlobalStatus.clickTimer = setTimeout(() => {
                const clickCount = this.imgGlobalStatus.clickCount;
                this.resetClickTimer();
                if (2 === clickCount) { // double click
                    if (!activeImg)
                        activeImg = this.imgGlobalStatus.activeImg;
                    // console.log('mousedownImgView: double click...', activeImg.index);
                    this.clickImgToolbar(null, this.plugin.settings.doubleClickToolbar, activeImg);
                }
            }, 200);
        };
        this.resetClickTimer = () => {
            this.imgGlobalStatus.clickTimer = null;
            this.imgGlobalStatus.clickCount = 0;
        };
        this.getAndUpdateActiveImg = (event) => {
            const targetEl = event.target;
            let index;
            if (!targetEl || !(index = targetEl.dataset.index))
                return;
            const activeImg = this.imgInfo.imgList[parseInt(index)];
            if (activeImg && (!this.imgGlobalStatus.activeImg || activeImg.index !== this.imgGlobalStatus.activeImg.index)) {
                this.setActiveImgForMouseEvent(activeImg); // update activeImg
            }
            // console.log('getAndUpdateActiveImg: ', activeImg)
            return activeImg;
        };
        this.mousewheelViewContainer = (event) => {
            // event.preventDefault();
            event.stopPropagation();
            // @ts-ignore
            this.zoomAndRender(0 < event.wheelDelta ? 0.1 : -0.1, event);
        };
        this.zoomAndRender = (ratio, event, actualSize, activeImg) => {
            if (!activeImg) {
                activeImg = this.imgGlobalStatus.activeImg;
            }
            let activeImgViewEl;
            if (!activeImg || !(activeImgViewEl = activeImg.imgViewEl))
                return;
            let offsetSize = { offsetX: 0, offsetY: 0 };
            if (event) {
                offsetSize.offsetX = event.offsetX;
                offsetSize.offsetY = event.offsetY;
            }
            else {
                offsetSize.offsetX = activeImg.curWidth / 2;
                offsetSize.offsetY = activeImg.curHeight / 2;
            }
            const zoomData = ImgUtil.zoom(ratio, activeImg, offsetSize, actualSize);
            this.renderImgTip(activeImg);
            activeImgViewEl.setAttribute('width', zoomData.curWidth + 'px');
            activeImgViewEl.style.setProperty('margin-top', zoomData.top + 'px', 'important');
            activeImgViewEl.style.setProperty('margin-left', zoomData.left + 'px', 'important');
        };
        this.clickImgToolbar = (event, targetElClass, activeImg) => {
            if (!targetElClass && !activeImg) {
                if (!event)
                    return;
                // comes from clicking toolbar
                targetElClass = event.target.className;
                activeImg = this.imgGlobalStatus.activeImg;
            }
            switch (targetElClass) {
                case 'toolbar_zoom_to_100':
                    this.zoomAndRender(null, null, true, activeImg);
                    break;
                case 'toolbar_zoom_in':
                    this.zoomAndRender(0.1);
                    break;
                case 'toolbar_zoom_out':
                    this.zoomAndRender(-0.1);
                    break;
                case 'toolbar_full_screen':
                    this.showPlayerImg(activeImg);
                    break;
                case 'toolbar_refresh':
                    this.refreshImg(activeImg);
                    break;
                case 'toolbar_rotate_left':
                    activeImg.rotate -= 90;
                    ImgUtil.transform(activeImg);
                    break;
                case 'toolbar_rotate_right':
                    activeImg.rotate += 90;
                    ImgUtil.transform(activeImg);
                    break;
                case 'toolbar_scale_x':
                    activeImg.scaleX = !activeImg.scaleX;
                    ImgUtil.transform(activeImg);
                    break;
                case 'toolbar_scale_y':
                    activeImg.scaleY = !activeImg.scaleY;
                    ImgUtil.transform(activeImg);
                    break;
                case 'toolbar_invert_color':
                    activeImg.invertColor = !activeImg.invertColor;
                    ImgUtil.invertImgColor(activeImg.imgViewEl, activeImg.invertColor);
                    break;
                case 'toolbar_copy':
                    ImgUtil.copyImage(activeImg.imgViewEl, activeImg.curWidth, activeImg.curHeight);
                    break;
                case 'toolbar_close':
                    this.closeContainerView(event, activeImg);
                    break;
            }
        };
        this.plugin = plugin;
    }
}

var Md5 = /** @class */ (function () {
    function Md5() {
    }
    Md5.AddUnsigned = function (lX, lY) {
        var lX4, lY4, lX8, lY8, lResult;
        lX8 = (lX & 0x80000000);
        lY8 = (lY & 0x80000000);
        lX4 = (lX & 0x40000000);
        lY4 = (lY & 0x40000000);
        lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
        if (!!(lX4 & lY4)) {
            return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
        }
        if (!!(lX4 | lY4)) {
            if (!!(lResult & 0x40000000)) {
                return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
            }
            else {
                return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
            }
        }
        else {
            return (lResult ^ lX8 ^ lY8);
        }
    };
    Md5.FF = function (a, b, c, d, x, s, ac) {
        a = this.AddUnsigned(a, this.AddUnsigned(this.AddUnsigned(this.F(b, c, d), x), ac));
        return this.AddUnsigned(this.RotateLeft(a, s), b);
    };
    Md5.GG = function (a, b, c, d, x, s, ac) {
        a = this.AddUnsigned(a, this.AddUnsigned(this.AddUnsigned(this.G(b, c, d), x), ac));
        return this.AddUnsigned(this.RotateLeft(a, s), b);
    };
    Md5.HH = function (a, b, c, d, x, s, ac) {
        a = this.AddUnsigned(a, this.AddUnsigned(this.AddUnsigned(this.H(b, c, d), x), ac));
        return this.AddUnsigned(this.RotateLeft(a, s), b);
    };
    Md5.II = function (a, b, c, d, x, s, ac) {
        a = this.AddUnsigned(a, this.AddUnsigned(this.AddUnsigned(this.I(b, c, d), x), ac));
        return this.AddUnsigned(this.RotateLeft(a, s), b);
    };
    Md5.ConvertToWordArray = function (string) {
        var lWordCount, lMessageLength = string.length, lNumberOfWords_temp1 = lMessageLength + 8, lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64, lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16, lWordArray = Array(lNumberOfWords - 1), lBytePosition = 0, lByteCount = 0;
        while (lByteCount < lMessageLength) {
            lWordCount = (lByteCount - (lByteCount % 4)) / 4;
            lBytePosition = (lByteCount % 4) * 8;
            lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition));
            lByteCount++;
        }
        lWordCount = (lByteCount - (lByteCount % 4)) / 4;
        lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
        lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
        lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
        return lWordArray;
    };
    Md5.WordToHex = function (lValue) {
        var WordToHexValue = "", WordToHexValue_temp = "", lByte, lCount;
        for (lCount = 0; lCount <= 3; lCount++) {
            lByte = (lValue >>> (lCount * 8)) & 255;
            WordToHexValue_temp = "0" + lByte.toString(16);
            WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
        }
        return WordToHexValue;
    };
    Md5.Utf8Encode = function (string) {
        var utftext = "", c;
        string = string.replace(/\r\n/g, "\n");
        for (var n = 0; n < string.length; n++) {
            c = string.charCodeAt(n);
            if (c < 128) {
                utftext += String.fromCharCode(c);
            }
            else if ((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            }
            else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }
        }
        return utftext;
    };
    Md5.init = function (string) {
        var temp;
        if (typeof string !== 'string')
            string = JSON.stringify(string);
        this._string = this.Utf8Encode(string);
        this.x = this.ConvertToWordArray(this._string);
        this.a = 0x67452301;
        this.b = 0xEFCDAB89;
        this.c = 0x98BADCFE;
        this.d = 0x10325476;
        for (this.k = 0; this.k < this.x.length; this.k += 16) {
            this.AA = this.a;
            this.BB = this.b;
            this.CC = this.c;
            this.DD = this.d;
            this.a = this.FF(this.a, this.b, this.c, this.d, this.x[this.k], this.S11, 0xD76AA478);
            this.d = this.FF(this.d, this.a, this.b, this.c, this.x[this.k + 1], this.S12, 0xE8C7B756);
            this.c = this.FF(this.c, this.d, this.a, this.b, this.x[this.k + 2], this.S13, 0x242070DB);
            this.b = this.FF(this.b, this.c, this.d, this.a, this.x[this.k + 3], this.S14, 0xC1BDCEEE);
            this.a = this.FF(this.a, this.b, this.c, this.d, this.x[this.k + 4], this.S11, 0xF57C0FAF);
            this.d = this.FF(this.d, this.a, this.b, this.c, this.x[this.k + 5], this.S12, 0x4787C62A);
            this.c = this.FF(this.c, this.d, this.a, this.b, this.x[this.k + 6], this.S13, 0xA8304613);
            this.b = this.FF(this.b, this.c, this.d, this.a, this.x[this.k + 7], this.S14, 0xFD469501);
            this.a = this.FF(this.a, this.b, this.c, this.d, this.x[this.k + 8], this.S11, 0x698098D8);
            this.d = this.FF(this.d, this.a, this.b, this.c, this.x[this.k + 9], this.S12, 0x8B44F7AF);
            this.c = this.FF(this.c, this.d, this.a, this.b, this.x[this.k + 10], this.S13, 0xFFFF5BB1);
            this.b = this.FF(this.b, this.c, this.d, this.a, this.x[this.k + 11], this.S14, 0x895CD7BE);
            this.a = this.FF(this.a, this.b, this.c, this.d, this.x[this.k + 12], this.S11, 0x6B901122);
            this.d = this.FF(this.d, this.a, this.b, this.c, this.x[this.k + 13], this.S12, 0xFD987193);
            this.c = this.FF(this.c, this.d, this.a, this.b, this.x[this.k + 14], this.S13, 0xA679438E);
            this.b = this.FF(this.b, this.c, this.d, this.a, this.x[this.k + 15], this.S14, 0x49B40821);
            this.a = this.GG(this.a, this.b, this.c, this.d, this.x[this.k + 1], this.S21, 0xF61E2562);
            this.d = this.GG(this.d, this.a, this.b, this.c, this.x[this.k + 6], this.S22, 0xC040B340);
            this.c = this.GG(this.c, this.d, this.a, this.b, this.x[this.k + 11], this.S23, 0x265E5A51);
            this.b = this.GG(this.b, this.c, this.d, this.a, this.x[this.k], this.S24, 0xE9B6C7AA);
            this.a = this.GG(this.a, this.b, this.c, this.d, this.x[this.k + 5], this.S21, 0xD62F105D);
            this.d = this.GG(this.d, this.a, this.b, this.c, this.x[this.k + 10], this.S22, 0x2441453);
            this.c = this.GG(this.c, this.d, this.a, this.b, this.x[this.k + 15], this.S23, 0xD8A1E681);
            this.b = this.GG(this.b, this.c, this.d, this.a, this.x[this.k + 4], this.S24, 0xE7D3FBC8);
            this.a = this.GG(this.a, this.b, this.c, this.d, this.x[this.k + 9], this.S21, 0x21E1CDE6);
            this.d = this.GG(this.d, this.a, this.b, this.c, this.x[this.k + 14], this.S22, 0xC33707D6);
            this.c = this.GG(this.c, this.d, this.a, this.b, this.x[this.k + 3], this.S23, 0xF4D50D87);
            this.b = this.GG(this.b, this.c, this.d, this.a, this.x[this.k + 8], this.S24, 0x455A14ED);
            this.a = this.GG(this.a, this.b, this.c, this.d, this.x[this.k + 13], this.S21, 0xA9E3E905);
            this.d = this.GG(this.d, this.a, this.b, this.c, this.x[this.k + 2], this.S22, 0xFCEFA3F8);
            this.c = this.GG(this.c, this.d, this.a, this.b, this.x[this.k + 7], this.S23, 0x676F02D9);
            this.b = this.GG(this.b, this.c, this.d, this.a, this.x[this.k + 12], this.S24, 0x8D2A4C8A);
            this.a = this.HH(this.a, this.b, this.c, this.d, this.x[this.k + 5], this.S31, 0xFFFA3942);
            this.d = this.HH(this.d, this.a, this.b, this.c, this.x[this.k + 8], this.S32, 0x8771F681);
            this.c = this.HH(this.c, this.d, this.a, this.b, this.x[this.k + 11], this.S33, 0x6D9D6122);
            this.b = this.HH(this.b, this.c, this.d, this.a, this.x[this.k + 14], this.S34, 0xFDE5380C);
            this.a = this.HH(this.a, this.b, this.c, this.d, this.x[this.k + 1], this.S31, 0xA4BEEA44);
            this.d = this.HH(this.d, this.a, this.b, this.c, this.x[this.k + 4], this.S32, 0x4BDECFA9);
            this.c = this.HH(this.c, this.d, this.a, this.b, this.x[this.k + 7], this.S33, 0xF6BB4B60);
            this.b = this.HH(this.b, this.c, this.d, this.a, this.x[this.k + 10], this.S34, 0xBEBFBC70);
            this.a = this.HH(this.a, this.b, this.c, this.d, this.x[this.k + 13], this.S31, 0x289B7EC6);
            this.d = this.HH(this.d, this.a, this.b, this.c, this.x[this.k], this.S32, 0xEAA127FA);
            this.c = this.HH(this.c, this.d, this.a, this.b, this.x[this.k + 3], this.S33, 0xD4EF3085);
            this.b = this.HH(this.b, this.c, this.d, this.a, this.x[this.k + 6], this.S34, 0x4881D05);
            this.a = this.HH(this.a, this.b, this.c, this.d, this.x[this.k + 9], this.S31, 0xD9D4D039);
            this.d = this.HH(this.d, this.a, this.b, this.c, this.x[this.k + 12], this.S32, 0xE6DB99E5);
            this.c = this.HH(this.c, this.d, this.a, this.b, this.x[this.k + 15], this.S33, 0x1FA27CF8);
            this.b = this.HH(this.b, this.c, this.d, this.a, this.x[this.k + 2], this.S34, 0xC4AC5665);
            this.a = this.II(this.a, this.b, this.c, this.d, this.x[this.k], this.S41, 0xF4292244);
            this.d = this.II(this.d, this.a, this.b, this.c, this.x[this.k + 7], this.S42, 0x432AFF97);
            this.c = this.II(this.c, this.d, this.a, this.b, this.x[this.k + 14], this.S43, 0xAB9423A7);
            this.b = this.II(this.b, this.c, this.d, this.a, this.x[this.k + 5], this.S44, 0xFC93A039);
            this.a = this.II(this.a, this.b, this.c, this.d, this.x[this.k + 12], this.S41, 0x655B59C3);
            this.d = this.II(this.d, this.a, this.b, this.c, this.x[this.k + 3], this.S42, 0x8F0CCC92);
            this.c = this.II(this.c, this.d, this.a, this.b, this.x[this.k + 10], this.S43, 0xFFEFF47D);
            this.b = this.II(this.b, this.c, this.d, this.a, this.x[this.k + 1], this.S44, 0x85845DD1);
            this.a = this.II(this.a, this.b, this.c, this.d, this.x[this.k + 8], this.S41, 0x6FA87E4F);
            this.d = this.II(this.d, this.a, this.b, this.c, this.x[this.k + 15], this.S42, 0xFE2CE6E0);
            this.c = this.II(this.c, this.d, this.a, this.b, this.x[this.k + 6], this.S43, 0xA3014314);
            this.b = this.II(this.b, this.c, this.d, this.a, this.x[this.k + 13], this.S44, 0x4E0811A1);
            this.a = this.II(this.a, this.b, this.c, this.d, this.x[this.k + 4], this.S41, 0xF7537E82);
            this.d = this.II(this.d, this.a, this.b, this.c, this.x[this.k + 11], this.S42, 0xBD3AF235);
            this.c = this.II(this.c, this.d, this.a, this.b, this.x[this.k + 2], this.S43, 0x2AD7D2BB);
            this.b = this.II(this.b, this.c, this.d, this.a, this.x[this.k + 9], this.S44, 0xEB86D391);
            this.a = this.AddUnsigned(this.a, this.AA);
            this.b = this.AddUnsigned(this.b, this.BB);
            this.c = this.AddUnsigned(this.c, this.CC);
            this.d = this.AddUnsigned(this.d, this.DD);
        }
        temp = this.WordToHex(this.a) + this.WordToHex(this.b) + this.WordToHex(this.c) + this.WordToHex(this.d);
        return temp.toLowerCase();
    };
    Md5.x = Array();
    Md5.S11 = 7;
    Md5.S12 = 12;
    Md5.S13 = 17;
    Md5.S14 = 22;
    Md5.S21 = 5;
    Md5.S22 = 9;
    Md5.S23 = 14;
    Md5.S24 = 20;
    Md5.S31 = 4;
    Md5.S32 = 11;
    Md5.S33 = 16;
    Md5.S34 = 23;
    Md5.S41 = 6;
    Md5.S42 = 10;
    Md5.S43 = 15;
    Md5.S44 = 21;
    Md5.RotateLeft = function (lValue, iShiftBits) { return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits)); };
    Md5.F = function (x, y, z) { return (x & y) | ((~x) & z); };
    Md5.G = function (x, y, z) { return (x & z) | (y & (~z)); };
    Md5.H = function (x, y, z) { return (x ^ y ^ z); };
    Md5.I = function (x, y, z) { return (y ^ (x | (~z))); };
    return Md5;
}());

class GalleryImgCto {
    constructor(alt, src) {
        this.alt = alt;
        this.src = src;
    }
}
class GalleryImgCacheCto {
    constructor(file, galleryImgList, mtime) {
        this.file = file;
        this.galleryImgList = galleryImgList;
        this.mtime = mtime;
    }
}

class FileCto {
    constructor(path, ctime, mtime) {
        this.path = path;
        this.ctime = ctime;
        this.mtime = mtime;
    }
}

/* // const imgList: Array<GalleryImg> = parseMarkDown(plugin, activeView.sourceMode?.cmEditor, activeView.file.path);
export const parseMarkDown = (plugin: ImageToolkitPlugin, cm: CodeMirror.Editor, filePath: string) => {
    let line, lineText;
    for (let i = 0, lastLine = cm.lastLine(); i <= lastLine; i++) {
        if (!(line = cm.lineInfo(i))) continue;
        if (!(lineText = line.text)) continue;
        console.debug((i + 1) + ' line: ' + lineText);
    }
} */
const parseActiveViewData = (plugin, lines, file) => {
    if (!lines || 0 >= lines.length)
        return null;
    let lineText;
    let isCodeArea = false;
    let textArr;
    const imgList = new Array();
    for (let i = 0, len = lines.length; i < len; i++) {
        if (!(lineText = lines[i]))
            continue;
        // console.log((i + 1) + ' line: ' + lineText);
        if (lineText.startsWith('```')) {
            isCodeArea = !isCodeArea;
            continue;
        }
        if (isCodeArea)
            continue;
        if (textArr = getNonCodeAreaTexts(lineText)) {
            for (const text of textArr) {
                extractImage(text, imgList);
            }
        }
        else {
            extractImage(lineText, imgList);
        }
    }
    const filePath = file.path;
    for (let i = 0, len = imgList.length; i < len; i++) {
        const img = imgList[i];
        if (img.convert) {
            const imageFile = plugin.app.metadataCache.getFirstLinkpathDest(decodeURIComponent(img.src), filePath);
            img.src = imageFile ? plugin.app.vault.getResourcePath(imageFile) : '';
        }
        img.hash = md5Img(img.alt, img.src);
        img.match = null;
        img.name = null;
    }
    return new GalleryImgCacheCto(new FileCto(file.path, file.stat.ctime, file.stat.mtime), imgList, new Date().getTime());
};
const getNonCodeAreaTexts = (lineText) => {
    let textArr = [];
    const idx1 = lineText.indexOf('`');
    if (0 > idx1)
        return null;
    const idx2 = lineText.lastIndexOf('`');
    if (idx1 === idx2)
        return null;
    if (idx1 > 0)
        textArr.push(lineText.substring(0, idx1));
    if (lineText.length - 1 > idx2)
        textArr.push(lineText.substring(idx2 + 1));
    return textArr;
};
const IMAGE_LINK_REGEX1 = /\[\s*?(!\[(.*?)\]\((.*?)\))\s*?\]\(.*?\)/; // 1-link: [ ![alt1|alt2|...|altn|width](src) ](https://...)
// markdown: `![alt1|alt2|...|altn|width](src)` -> 1: alt (alt+width), 2: src
const RE_MARKDOWN_IMAGE = /!\[(.*?)\]\(\s*(.*?\.(jpe?g|png|svg|gif|bmp|webp))\s*\)/i; // 1: ![alt1|alt2|...|altn|width](src)
const IMAGE_LINK_REGEX2 = /\[\s*?(!\[\[(.*?[jpe?g|png|gif|svg|bmp].*?)\]\])\s*?\]\(.*?\)/i; // 2-link: [ ![[src|alt1|alt2|width]] ](https://...)
// RE_WIKILINK_IMAGE wikilink: `![[bird.png|alt1|alt2|2.1|50]]` -> 1: src+alt+width
const RE_WIKILINK_IMAGE = /!\[\[(.*?\.(jpe?g|png|svg|gif|bmp|webp).*?)\]\]/i; // 2: ![[src|alt1|alt2|width]]
const SRC_LINK_REGEX = /[a-z][a-z0-9+\-.]+:\/.*/i; // match link: http://, file://, app:// 
const SRC_IMG_REGREX = /.*?\.jpe?g|png|gif|svg|bmp/i; // match image ext: .jpg/.jpeg/.png/.gif/.svg/.bmp
const IMG_TAG_LINK_SRC_REGEX = /<a.*?(<img.*?src=[\'"](.*?)[\'"].*?\/?>).*?\/a>/i; // 3-a-img-src: <a> <img ... src=''/> </a>
const IMG_TAG_SRC_REGEX = /<img.*?src=[\'"](.*?)[\'"].*?\/?>/i; // 3-img-src: <img ... src='' />
const IMG_TAG_ALT_REGEX = /<img.*?alt=[\'"](.*?)[\'"].*?\/?>/i; // 3-img-alt: <img ... alt='' />
const FULL_PATH_REGEX = /^[a-z]\:.*?[jpe?g|png|gif|svg|bmp]/i;
const BLOCKQUOTE_PREFIX = `#^`;
const IMG_MATCH_MIN_LEN = 7;
const extractImage = (text, imgList) => {
    text = text.replace('\\|', '|');
    let img;
    if (!(img = matchImage1(text))) {
        if (!(img = matchImage2(text))) {
            if (!(img = matchImageTag(text))) {
                return;
            }
        }
    }
    imgList.push(img);
    if (img.match) {
        const idx = img.match.index + img.match[0].length;
        if (idx > text.length - IMG_MATCH_MIN_LEN)
            return;
        extractImage(text.substring(idx), imgList);
    }
};
/**
 * ![alt1|alt2|...|altn|width](src)
 * @param text
 * @returns
 */
const matchImage1 = (text) => {
    var _a;
    let match = text.match(IMAGE_LINK_REGEX1); // 1-link: [ ![alt1|alt2|...|altn|width](src) ](https://...)
    let link = false;
    let alt, src;
    if (match) {
        link = true;
        alt = match[2];
        src = match[3];
    }
    else {
        match = text.match(RE_MARKDOWN_IMAGE); // 1: ![alt1|alt2|...|altn|width](src)
        if (match) {
            if (alt = match[1]) {
                if (0 <= alt.indexOf('[') && 0 <= alt.indexOf(']'))
                    return;
            }
            src = match[2];
            if (src && src.startsWith(BLOCKQUOTE_PREFIX))
                return;
        }
    }
    if (!match)
        return null;
    const img = new GalleryImgCto();
    img.link = link;
    img.match = match;
    img.alt = alt;
    img.src = src;
    let width;
    if (img.src) {
        if (SRC_LINK_REGEX.test(img.src)) { // 1.2: match link: http://, file://, app://local/
            if (img.src.startsWith('file://')) {
                img.src = img.src.replace(/^file:\/+/, 'app://local/');
            }
        }
        else if (SRC_IMG_REGREX.test(img.src)) { // 1.3: match image ext: .jpg/.jpeg/.png/.gif/.svg/.bmp
            const srcArr = img.src.split('/');
            if (srcArr && 0 < srcArr.length) {
                img.name = srcArr[srcArr.length - 1];
            }
            img.convert = true;
        }
    }
    const altArr = (_a = img.alt) === null || _a === void 0 ? void 0 : _a.split('\|'); // match[1] = alt1|alt2|...|altn|width
    if (altArr && 1 < altArr.length) {
        if (/\d+/.test(width = altArr[altArr.length - 1])) {
            img.alt = img.alt.substring(0, img.alt.length - width.length - 1);
        }
    }
    return img;
};
/**
 * ![[src|alt1|alt2|width]]
 * @param text
 * @returns
 */
const matchImage2 = (text) => {
    let match = text.match(IMAGE_LINK_REGEX2); // 2-link: [ ![[src|alt1|alt2|width]] ](https://...)
    let link = false;
    let content;
    if (match) {
        link = true;
        content = match[2];
    }
    else {
        match = text.match(RE_WIKILINK_IMAGE); // 2: ![[src|alt1|alt2|width]]
        content = match ? match[1] : null;
        if (content && content.startsWith(BLOCKQUOTE_PREFIX))
            return;
    }
    if (!match)
        return null;
    const img = new GalleryImgCto();
    img.link = link;
    img.match = match;
    const contentArr = content === null || content === void 0 ? void 0 : content.split('|');
    if (contentArr && 0 < contentArr.length && (img.src = contentArr[0].trim())) {
        const srcArr = img.src.split('/');
        if (srcArr && 0 < srcArr.length) {
            img.name = srcArr[srcArr.length - 1];
        }
        if (1 == contentArr.length) {
            img.alt = img.src;
        }
        else {
            img.alt = '';
            for (let i = 1; i < contentArr.length; i++) {
                if (i == contentArr.length - 1 && /\d+/.test(contentArr[i]))
                    break;
                if (img.alt)
                    img.alt += '|';
                img.alt += contentArr[i];
            }
        }
        img.convert = true;
    }
    return img;
};
const matchImageTag = (text) => {
    let match = text.match(IMG_TAG_LINK_SRC_REGEX); // 3-a-img-src: <a> <img ... src=''/> </a>
    let link = false;
    if (match) {
        link = true;
    }
    else {
        match = text.match(IMG_TAG_SRC_REGEX); // 3-img-src: <img ... src='' />
    }
    if (!match)
        return null;
    const img = new GalleryImgCto();
    img.link = link;
    img.match = match;
    img.src = img.link ? match[2] : match[1];
    if (img.src) {
        if (img.src.startsWith('file://')) {
            img.src = img.src.replace(/^file:\/+/, 'app://local/');
        }
        else if (FULL_PATH_REGEX.test(img.src)) {
            img.src = 'app://local/' + img.src;
        }
    }
    const matchAlt = text.match(IMG_TAG_ALT_REGEX);
    img.alt = matchAlt ? matchAlt[1] : '';
    return img;
};
const md5Img = (alt, src) => {
    return Md5.init((alt ? alt : '') + '_' + src);
};

class GalleryNavbarView {
    constructor(mainContainerView, plugin) {
        // whether to display gallery navbar
        this.state = false;
        this.galleryNavbarEl = null;
        this.galleryListEl = null;
        this.galleryIsMousingDown = false;
        this.galleryMouseDownClientX = 0;
        this.galleryTranslateX = 0;
        this.CACHE_LIMIT = 10;
        this.CLICK_TIME = 150;
        this.renderGalleryImg = (imgFooterEl) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (this.state)
                return;
            // get all of images on the current editor
            const galleryOrigin=this.mainContainerView.getLastClickedImgEl();
            const galleryBridge=this.plugin.noteImageStage?.galleryContext;
            const bridgeView=galleryBridge?.origin===galleryOrigin ? this.plugin.app.workspace.getLeavesOfType('markdown').map(leaf=>leaf.view).find(view=>view instanceof obsidian.MarkdownView && view.file?.path===galleryBridge.sourcePath && view.containerEl.contains(galleryOrigin)) : null;
            const activeView = bridgeView ?? this.plugin.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
            if (!activeView
                || 'markdown' !== activeView.getViewType()
                // modal-container: community plugin, flashcards (Space Repetition)
                || 0 < this.mainContainerView.getDoc().getElementsByClassName('modal-container').length) {
                if (this.galleryNavbarEl)
                    this.galleryNavbarEl.hidden = true;
                if (this.galleryListEl)
                    this.galleryListEl.innerHTML = '';
                return;
            }
            // <div class="gallery-navbar"> <ul class="gallery-list"> <li> <img src='' alt=''> </li> <li...> <ul> </div>
            this.initGalleryNavbar(imgFooterEl);
            const activeFile = activeView.file;
            let galleryImg = this.getGalleryImgCache(activeFile);
            // let hitCache: boolean = true;
            if (!galleryImg) {
                // hitCache = false;
                galleryImg = parseActiveViewData(this.plugin, (_a = activeView.data) === null || _a === void 0 ? void 0 : _a.split('\n'), activeFile);
                this.setGalleryImgCache(galleryImg);
            }
            // console.log('oit-gallery-navbar: ' + (hitCache ? 'hit cache' : 'miss cache') + '!', galleryImg);
            const stageImage=this.mainContainerView.getLastClickedImgEl();
            const bridgeContext=this.plugin.noteImageStage?.galleryContext;
            const layoutContext=bridgeContext?.origin===stageImage && bridgeContext.sourcePath===activeFile.path ? bridgeContext : null;
            const stageImages=stageImage?.hasAttribute('data-nis-index') ? this.plugin.noteImageStage?.galleryImages : null;
            const bridgeImages=layoutContext?.images ?? stageImages;
            const imgList = bridgeImages ? bridgeImages.map(img => ({...img,hash:md5Img(img.alt,img.src)})) : galleryImg.galleryImgList;
            const imgContextHash = this.getTargetImgContextHash(this.mainContainerView.getLastClickedImgEl(), activeView.containerEl, this.plugin.imgSelector);
            let liEl, imgEl, liElActive;
            let imgListEl = new Array();
            let targetImageIdx = -1, targetRealIdx = 0;
            let isAddGalleryActive = false;
            let prevHash, nextHash;
            const viewImageWithLink = this.plugin.settings.viewImageWithLink;
            for (let i = 0, len = imgList.length; i < len; i++) {
                const img = imgList[i];
                if (!viewImageWithLink && img.link)
                    continue;
                // <li> <img class='gallery-img' src='' alt=''> </li>
                this.galleryListEl.append(liEl = createEl('li'));
                liEl.append(imgEl = createEl('img'));
                imgEl.addClass('gallery-img', 'oit-img');
                imgEl.setAttr('alt', img.alt);
                imgEl.setAttr('src', img.src);
                imgListEl.push(imgEl);
                this.mainContainerView.setImgViewDefaultBackground(imgEl);
                // find the target image (which image is just clicked)
                if (!imgContextHash || isAddGalleryActive)
                    continue;
                if (layoutContext ? i === layoutContext.index : imgContextHash[1] == img.hash) {
                    if (0 > targetImageIdx) {
                        targetImageIdx = i;
                        liElActive = liEl;
                        targetRealIdx = imgListEl.length;
                    }
                    if (0 == i) {
                        prevHash = null;
                        nextHash = 1 < len ? imgList[i + 1].hash : null;
                    }
                    else if (len - 1 == i) {
                        prevHash = imgList[i - 1].hash;
                        nextHash = null;
                    }
                    else {
                        prevHash = imgList[i - 1].hash;
                        nextHash = imgList[i + 1].hash;
                    }
                    if (imgContextHash[0] == prevHash && imgContextHash[2] == nextHash) {
                        isAddGalleryActive = true;
                        liElActive = liEl;
                    }
                }
            }
            const realTotalNum = imgListEl.length;
            this.mainContainerView.renderImgTitle(null, '[' + targetRealIdx + '/' + realTotalNum + ']');
            imgListEl.forEach((value, index) => {
                value.dataset.index = '[' + (index + 1) + '/' + realTotalNum + ']';
            });
            if (0 <= targetImageIdx) {
                if (liElActive) {
                    liElActive.addClass('gallery-active');
                    if (this.settings.galleryImgBorderActive) {
                        liElActive.addClass('img-border-active');
                        liElActive.style.setProperty('border-color', this.settings.galleryImgBorderActiveColor);
                    }
                }
                this.galleryTranslateX = (this.mainContainerView.getDoc().documentElement.clientWidth || this.mainContainerView.getDoc().body.clientWidth) / 2.5 - targetImageIdx * 52;
                this.galleryListEl.style.transform = 'translateX(' + this.galleryTranslateX + 'px)';
            }
        });
        this.initDefaultData = () => {
            this.galleryMouseDownClientX = 0;
            this.galleryTranslateX = 0;
            if (this.galleryListEl) {
                this.galleryListEl.style.transform = 'translateX(0px)';
                // remove all childs (li) of gallery-list
                this.galleryListEl.innerHTML = '';
            }
        };
        this.initGalleryNavbar = (imgFooterEl) => {
            // <div class="gallery-navbar">
            if (!this.galleryNavbarEl) {
                // imgInfo.imgFooterEl.append(galleryNavbarEl = createDiv());
                imgFooterEl.append(this.galleryNavbarEl = createDiv());
                this.galleryNavbarEl.addClass('gallery-navbar');
                this.galleryNavbarEl.onmouseover = () => {
                    this.galleryNavbarEl.style.setProperty('background-color', this.settings.galleryNavbarHoverColor);
                };
                this.galleryNavbarEl.onmouseout = () => {
                    this.galleryNavbarEl.style.setProperty('background-color', this.settings.galleryNavbarDefaultColor);
                };
                // add events
                this.galleryNavbarEl.addEventListener('mousedown', this.mouseDownGallery);
                this.galleryNavbarEl.addEventListener('mousemove', this.mouseMoveGallery);
                this.galleryNavbarEl.addEventListener('mouseup', this.mouseUpGallery);
                this.galleryNavbarEl.addEventListener('mouseleave', this.mouseLeaveGallery);
            }
            this.galleryNavbarEl.style.setProperty('background-color', this.settings.galleryNavbarDefaultColor);
            if (!this.galleryListEl) {
                this.galleryNavbarEl.append(this.galleryListEl = createEl('ul')); // <ul class="gallery-list">
                this.galleryListEl.addClass('gallery-list');
            }
            this.initDefaultData();
            this.galleryNavbarEl.hidden = false; // display 'gallery-navbar'
            this.state = true;
        };
        this.closeGalleryNavbar = () => {
            if (!this.state)
                return;
            this.galleryNavbarEl.hidden = true; // hide 'gallery-navbar'
            this.state = false;
            this.initDefaultData();
        };
        this.remove = () => {
            var _a, _b;
            this.state = false;
            (_a = this.galleryNavbarEl) === null || _a === void 0 ? void 0 : _a.remove();
            (_b = this.galleryListEl) === null || _b === void 0 ? void 0 : _b.remove();
            this.galleryNavbarEl = null;
            this.galleryListEl = null;
            this.galleryIsMousingDown = false;
            this.galleryMouseDownClientX = 0;
            this.galleryTranslateX = 0;
            this.mouseDownTime = null;
            GalleryNavbarView.GALLERY_IMG_CACHE = new Map();
            this.initDefaultData();
        };
        this.getTargetImgContextHash = (targetImgEl, containerEl, imageSelector) => {
            const layoutContext=this.plugin.noteImageStage?.galleryContext;
            if(layoutContext?.origin===targetImgEl) {
                const hash=img=>img ? md5Img(img.alt,img.src) : null;
                return [hash(layoutContext.images[layoutContext.index-1]),hash(layoutContext.images[layoutContext.index]),hash(layoutContext.images[layoutContext.index+1])];
            }
            const stageImages=this.plugin.noteImageStage?.galleryImages;
            const stageIndex=Number(targetImgEl?.getAttribute('data-nis-index'));
            if(targetImgEl?.hasAttribute('data-nis-index') && stageImages?.[stageIndex]) {
                const hash=img=>img ? md5Img(img.alt,img.src) : null;
                return [hash(stageImages[stageIndex-1]),hash(stageImages[stageIndex]),hash(stageImages[stageIndex+1])];
            }
            let imgEl;
            let targetImgHash = null;
            let targetIdx = -1;
            const imgs = containerEl.querySelectorAll(imageSelector);
            // console.log('IMAGE_SELECTOR>>', imageSelector, imgs);
            const len = imgs.length;
            for (let i = 0; i < len; i++) {
                if ((imgEl = imgs[i])) {
                    if ('1' == imgEl.getAttribute('data-oit-target')) {
                        targetIdx = i;
                        targetImgHash = md5Img(imgEl.alt, imgEl.src);
                        break;
                    }
                }
            }
            if (0 > targetIdx) {
                targetImgHash = md5Img(targetImgEl.alt, targetImgEl.src);
                return [null, targetImgHash, null];
            }
            let prevHash, nextHash;
            if (0 == targetIdx) {
                prevHash = null;
                nextHash = 1 < len ? md5Img(imgs[1].alt, imgs[1].src) : null;
            }
            else if (len - 1 == targetIdx) {
                prevHash = md5Img(imgs[targetIdx - 1].alt, imgs[targetIdx - 1].src);
                nextHash = null;
            }
            else {
                prevHash = md5Img(imgs[targetIdx - 1].alt, imgs[targetIdx - 1].src);
                nextHash = md5Img(imgs[targetIdx + 1].alt, imgs[targetIdx + 1].src);
            }
            return [prevHash, targetImgHash, nextHash];
        };
        this.activateImage = (liEl, imgEL) => {
            if (!liEl || 'LI' !== liEl.tagName)
                return;
            if (!imgEL) {
                const imgELList = liEl.getElementsByTagName('img');
                if (imgELList && 0 < imgELList.length) {
                    imgEL = imgELList[0];
                }
            }
            if (imgEL) {
                const activeImg = this.mainContainerView.getActiveImg();
                this.mainContainerView.initDefaultData(activeImg, imgEL.style);
                this.mainContainerView.refreshImg(activeImg, imgEL.src, imgEL.alt || '', imgEL.dataset.index);
            }
            liEl.addClass('gallery-active');
            if (this.settings.galleryImgBorderActive) {
                liEl.addClass('img-border-active');
                liEl.style.setProperty('border-color', this.settings.galleryImgBorderActiveColor);
            }
        };
        this.deactivateImage = (liEl) => {
            if (!liEl)
                return;
            liEl.removeClass('gallery-active');
            if (liEl.hasClass('img-border-active')) {
                liEl.removeClass('img-border-active');
                liEl.style.removeProperty('border-color');
            }
        };
        this.clickGalleryImg = (event) => {
            const targetEl = event.target;
            if (!targetEl || 'IMG' !== targetEl.tagName)
                return;
            if (this.galleryListEl) {
                const liElList = this.galleryListEl.getElementsByClassName('gallery-active');
                for (let i = 0, len = liElList.length; i < len; i++) {
                    this.deactivateImage(liElList[i]);
                }
            }
            this.activateImage(targetEl.parentElement, targetEl);
        };
        /**
         * switch the image on the gallery navbar
         * @param next true: switch to the next image; false: switch to the previous image
         */
        this.switchImage = (next) => {
            if (!this.state || !this.galleryListEl)
                return;
            const liElList = this.galleryListEl.getElementsByTagName('li');
            if (!liElList || 0 >= liElList.length)
                return;
            let liEl;
            let toSwitchIdx = -1;
            for (let i = 0, len = liElList.length; i < len; i++) {
                if (!(liEl = liElList[i]))
                    continue;
                if (liEl.hasClass('gallery-active')) {
                    toSwitchIdx = next ? (len <= (i + 1) ? 0 : i + 1) : (0 == i ? len - 1 : i - 1);
                    this.deactivateImage(liEl);
                    break;
                }
            }
            if (0 >= toSwitchIdx) {
                toSwitchIdx = 0;
            }
            this.activateImage(liElList[toSwitchIdx]);
        };
        this.mouseDownGallery = (event) => {
            // console.log('mouse Down Gallery...');
            event.preventDefault();
            event.stopPropagation();
            this.mouseDownTime = new Date().getTime();
            this.galleryIsMousingDown = true;
            this.galleryMouseDownClientX = event.clientX;
        };
        this.mouseMoveGallery = (event) => {
            // console.log('mouse Move Gallery...');
            event.preventDefault();
            event.stopPropagation();
            if (!this.galleryIsMousingDown)
                return;
            let moveDistance = event.clientX - this.galleryMouseDownClientX;
            if (4 > Math.abs(moveDistance))
                return;
            this.galleryMouseDownClientX = event.clientX;
            this.galleryTranslateX += moveDistance;
            const windowWidth = this.mainContainerView.getDoc().documentElement.clientWidth || this.mainContainerView.getDoc().body.clientWidth;
            const imgLiWidth = (this.galleryListEl.childElementCount - 1) * 52;
            // console.log('move...', 'windowWidth=' + windowWidth, 'galleryTranslateX=' + galleryTranslateX, 'li count=' + imgInfo.galleryList.childElementCount);
            if (this.galleryTranslateX + 50 >= windowWidth)
                this.galleryTranslateX = windowWidth - 50;
            if (0 > this.galleryTranslateX + imgLiWidth)
                this.galleryTranslateX = -imgLiWidth;
            this.galleryListEl.style.transform = 'translateX(' + this.galleryTranslateX + 'px)';
        };
        this.mouseUpGallery = (event) => {
            // console.log('mouse Up Gallery>>>', event.target);
            event.preventDefault();
            event.stopPropagation();
            this.galleryIsMousingDown = false;
            if (!this.mouseDownTime || this.CLICK_TIME > new Date().getTime() - this.mouseDownTime) {
                this.clickGalleryImg(event);
            }
            this.mouseDownTime = null;
        };
        this.mouseLeaveGallery = (event) => {
            // console.log('mouse Leave Gallery>>>', event.target);
            event.preventDefault();
            event.stopPropagation();
            this.galleryIsMousingDown = false;
            this.mouseDownTime = null;
        };
        this.getGalleryImgCache = (file) => {
            if (!file)
                return null;
            const md5File = this.md5File(file.path, file.stat.ctime);
            if (!md5File)
                return null;
            const galleryImgCache = GalleryNavbarView.GALLERY_IMG_CACHE.get(md5File);
            if (galleryImgCache && file.stat.mtime !== galleryImgCache.file.mtime) {
                GalleryNavbarView.GALLERY_IMG_CACHE.delete(md5File);
                return null;
            }
            return galleryImgCache;
        };
        this.setGalleryImgCache = (galleryImg) => {
            const md5File = this.md5File(galleryImg.file.path, galleryImg.file.ctime);
            if (!md5File)
                return;
            this.trimGalleryImgCache();
            GalleryNavbarView.GALLERY_IMG_CACHE.set(md5File, galleryImg);
        };
        this.trimGalleryImgCache = () => {
            if (GalleryNavbarView.GALLERY_IMG_CACHE.size < this.CACHE_LIMIT)
                return;
            let earliestMtime, earliestKey;
            GalleryNavbarView.GALLERY_IMG_CACHE.forEach((value, key) => {
                if (!earliestMtime) {
                    earliestMtime = value.mtime;
                    earliestKey = key;
                }
                else {
                    if (earliestMtime > value.mtime) {
                        earliestMtime = value.mtime;
                        earliestKey = key;
                    }
                }
            });
            if (earliestKey) {
                GalleryNavbarView.GALLERY_IMG_CACHE.delete(earliestKey);
            }
        };
        this.md5File = (path, ctime) => {
            if (!path || !ctime)
                return;
            return Md5.init(path + '_' + ctime);
        };
        this.mainContainerView = mainContainerView;
        this.plugin = plugin;
        this.settings = plugin.settings;
    }
}
GalleryNavbarView.GALLERY_IMG_CACHE = new Map();

class NormalContainerView extends ContainerView {
    constructor(plugin) {
        super(plugin);
        //region ================== Container View ========================
        this.initContainerDom = (parentContainerEl) => {
            let imgCto;
            if (!this.imgInfo.oitContainerEl) {
                // init `oit-normal` dom at first time
                // <div class="oit oit-normal"> ... <div>
                (this.imgInfo.oitContainerEl = createDiv()).addClass(OIT_CLASS.CONTAINER_ROOT, OIT_CLASS.CONTAINER_NORMAL);
                parentContainerEl.appendChild(this.imgInfo.oitContainerEl);
                // 1. <div class="oit-img-container">...</div>
                this.imgInfo.oitContainerEl.append(this.imgInfo.imgContainerEl = createDiv(OIT_CLASS.IMG_CONTAINER));
                // 1.1. <div class="oit-img-container"> `<img class="oit-img-view" src="" alt="">` </div>
                this.updateImgViewElAndList(this.imgInfo);
                // 2. <div class="oit-img-tip"></div>
                this.imgInfo.oitContainerEl.appendChild(this.imgInfo.imgTipEl = createDiv(OIT_CLASS.IMG_TTP));
                this.imgInfo.imgTipEl.hidden = true;
                // 3. <div class="oit-img-footer"> ... <div>
                this.imgInfo.oitContainerEl.appendChild(this.imgInfo.imgFooterEl = createDiv(OIT_CLASS.IMG_FOOTER));
                // 3.1. <div class="oit-img-title"></div>
                this.imgInfo.imgFooterEl.appendChild(this.imgInfo.imgTitleEl = createDiv(OIT_CLASS.IMG_TITLE));
                // <span class="oit-img-title-name"></span>
                this.imgInfo.imgTitleEl.appendChild(this.imgInfo.imgTitleNameEl = createSpan(OIT_CLASS.IMG_TITLE_NAME));
                // <span class="oit-img-title-index"></span>
                this.imgInfo.imgTitleEl.appendChild(this.imgInfo.imgTitleIndexEl = createSpan(OIT_CLASS.IMG_TITLE_INDEX));
                // 3.2. <ul class="oit-img-toolbar">
                const imgToolbarUlEL = createEl('ul');
                imgToolbarUlEL.addClass(OIT_CLASS.IMG_TOOLBAR);
                this.imgInfo.imgFooterEl.appendChild(imgToolbarUlEL);
                let toolbarLi;
                for (const toolbar of TOOLBAR_CONF) {
                    if (!toolbar.enableToolbarIcon)
                        continue;
                    imgToolbarUlEL.appendChild(toolbarLi = createEl('li'));
                    toolbarLi.addClass(toolbar.class);
                    toolbarLi.setAttribute('alt', toolbar.title);
                    // @ts-ignore
                    toolbarLi.setAttribute('title', t(toolbar.title));
                }
                // add event: for oit-img-toolbar ul
                imgToolbarUlEL.addEventListener('click', this.clickImgToolbar);
                // <div class="img-player"> <img class='img-fullscreen' src=''> </div>
                this.imgInfo.oitContainerEl.appendChild(this.imgInfo.imgPlayerEl = createDiv(OIT_CLASS.IMG_PLAYER)); // img-player for full screen mode
                this.imgInfo.imgPlayerEl.appendChild(this.imgInfo.imgPlayerImgViewEl = createEl('img'));
                this.imgInfo.imgPlayerImgViewEl.addClass(OIT_CLASS.IMG_FULLSCREEN);
            }
            imgCto = this.imgInfo.imgList[0];
            this.imgGlobalStatus.activeImg = imgCto;
            return imgCto;
        };
        this.openOitContainerView = (matchedImg) => {
            if (!this.imgInfo.oitContainerEl) {
                console.error('obsidian-image-toolkit: oit-*-container-view has not been initialized!');
                return;
            }
            matchedImg.popup = true;
            this.imgGlobalStatus.popup = true;
            // display 'oit-normal'
            this.imgInfo.oitContainerEl.style.setProperty('display', 'block');
        };
        this.closeContainerView = (event, activeImg) => {
            if (event) {
                const target = event.target;
                if (!target || !(target.hasClass(OIT_CLASS.CONTAINER_ROOT) || target.hasClass(OIT_CLASS.IMG_CONTAINER)))
                    return;
            }
            if (!activeImg && !(activeImg = this.imgGlobalStatus.activeImg))
                return;
            if(this.plugin.noteImageStage?.galleryContext && this.plugin.noteImageStage.galleryContext.origin===this.lastClickedImgEl) this.plugin.noteImageStage.galleryContext=null;
            if (this.imgInfo.oitContainerEl) {
                this.imgInfo.oitContainerEl.style.setProperty('display', 'none'); // hide 'oit-normal'
                this.renderImgTitle('', '');
                this.renderImgView(activeImg.imgViewEl, '', '');
                // remove events
                this.imgGlobalStatus.popup = false;
                activeImg.popup = false;
                activeImg.mtime = 0;
                this.addOrRemoveEvents(activeImg, false);
            }
            if (this.plugin.settings.galleryNavbarToggle && this.galleryNavbarView) {
                this.galleryNavbarView.closeGalleryNavbar();
            }
        };
        //endregion
        //region ================== Gallery Navbar ========================
        this.renderGalleryNavbar = () => {
            // <div class="gallery-navbar"> <ul class="gallery-list"> <li> <img src='' alt=''> </li> <li...> <ul> </div>
            if (!this.plugin.settings.galleryNavbarToggle)
                return;
            if (!this.galleryNavbarView) {
                this.galleryNavbarView = new GalleryNavbarView(this, this.plugin);
            }
            this.galleryNavbarView.renderGalleryImg(this.imgInfo.imgFooterEl);
        };
        this.removeGalleryNavbar = () => {
            if (!this.galleryNavbarView)
                return;
            this.galleryNavbarView.remove();
            this.galleryNavbarView = null;
        };
        //endregion
        this.renderImgTitle = (name, index) => {
            var _a, _b;
            if (undefined !== name && null !== name)
                (_a = this.imgInfo.imgTitleNameEl) === null || _a === void 0 ? void 0 : _a.setText(name);
            if (undefined !== index && null !== index)
                (_b = this.imgInfo.imgTitleIndexEl) === null || _b === void 0 ? void 0 : _b.setText(' ' + index);
        };
        this.switchImageOnGalleryNavBar = (event, next) => {
            var _a;
            if (!this.checkHotkeySettings(event, this.plugin.settings.switchTheImageHotkey))
                return;
            (_a = this.galleryNavbarView) === null || _a === void 0 ? void 0 : _a.switchImage(next);
        };
    }
    setActiveImgForMouseEvent(imgCto) {
    }
}

/**
 * Right click menu
 */
class MenuView {
    constructor(pinContainerView) {
        this.init = () => {
            if (this.menu)
                return;
            this.menu = new obsidian.Menu();
            for (const itemConf of TOOLBAR_CONF) {
                if (!itemConf.enableMenu)
                    continue;
                if (SEPARATOR_SYMBOL === itemConf.title) {
                    this.menu.addSeparator();
                    continue;
                }
                this.menu.addItem(item => {
                    if (itemConf.icon)
                        item.setIcon(itemConf.icon);
                    // @ts-ignore
                    item.setTitle(t(itemConf.title))
                        .onClick(() => {
                        this.pinContainerView.clickImgToolbar(null, itemConf.class, MenuView.activeImg);
                    });
                });
            }
        };
        this.show = (event, activeImg) => {
            MenuView.activeImg = activeImg;
            this.init();
            this.menu.showAtPosition({ x: event.clientX, y: event.clientY });
        };
        this.pinContainerView = pinContainerView;
    }
}

/**
 * PinContainerView: Pin an image on the top
 * @Support: move an image by mouse; close an image by Esc
 * @Nonsupport: move an image by keyboard; display gallery navbar
 */
class PinContainerView extends ContainerView {
    constructor(plugin /*, viewMode: ViewMode*/) {
        super(plugin /*, viewMode, plugin.settings.pinMaximum*/);
        //region ================== Container View ========================
        this.initContainerDom = (parentContainerEl) => {
            /*
            <div class="oit-pin-container-view">
              <div class="oit-img-container">
                <img class="oit-img-view" data-index='0' src="" alt="">
                <img class="oit-img-view" data-index='1' src="" alt="">
                ...
              </div>
            </div>
             */
            if (!this.imgInfo.oitContainerEl) { // init at first time
                // create: <div class="oit oit-pin">
                (this.imgInfo.oitContainerEl = createDiv()).addClass(OIT_CLASS.CONTAINER_ROOT, OIT_CLASS.CONTAINER_PIN);
                parentContainerEl.appendChild(this.imgInfo.oitContainerEl);
                // <div class="oit oit-pin"> <div class="oit-img-container"/> </div>
                this.imgInfo.oitContainerEl.append(this.imgInfo.imgContainerEl = createDiv(OIT_CLASS.IMG_CONTAINER));
                // <div class="oit-img-tip"></div>
                this.imgInfo.oitContainerEl.appendChild(this.imgInfo.imgTipEl = createDiv(OIT_CLASS.IMG_TTP)); // oit-img-tip
                this.imgInfo.imgTipEl.hidden = true; // hide 'oit-img-tip'
                // <div class="img-player"> <img class='img-fullscreen' src=''> </div>
                this.imgInfo.oitContainerEl.appendChild(this.imgInfo.imgPlayerEl = createDiv(OIT_CLASS.IMG_PLAYER)); // img-player for full screen mode
                this.imgInfo.imgPlayerEl.appendChild(this.imgInfo.imgPlayerImgViewEl = createEl('img'));
                this.imgInfo.imgPlayerImgViewEl.addClass(OIT_CLASS.IMG_FULLSCREEN);
            }
            // <div class="oit-img-container"> <img class="oit-img-view" src="" alt=""> </div>
            this.updateImgViewElAndList(this.imgInfo);
            return this.getMatchedImg();
        };
        this.openOitContainerView = (matchedImg) => {
            if (!this.imgInfo.oitContainerEl) {
                console.error('obsidian-image-toolkit: oit-*-container-view has not been initialized!');
                return;
            }
            matchedImg.popup = true;
            if (!this.imgGlobalStatus.popup) {
                this.imgGlobalStatus.popup = true;
                this.imgGlobalStatus.activeImgZIndex = 0;
                this.imgInfo.imgList.forEach(value => {
                    value.zIndex = 0;
                });
            }
            else {
                matchedImg.zIndex = (++this.imgGlobalStatus.activeImgZIndex);
            }
            matchedImg.imgViewEl.style.setProperty('z-index', matchedImg.zIndex + '');
            // display 'oit-pin-container-view'
            this.imgInfo.oitContainerEl.style.setProperty('display', 'block');
        };
        /**
         * hide container view
         * @param event not null: click event; null: keyboard event (Esc)
         * @param activeImg
         */
        this.closeContainerView = (event, activeImg) => {
            if (event && !activeImg) {
                // PinContainerView doesn't need click event to hide container for now
                return;
            }
            if (!this.imgInfo.oitContainerEl)
                return;
            if (!activeImg && !(activeImg = this.imgGlobalStatus.activeImg))
                return;
            // console.log('closeContainerView', event, activeImg)
            const bridgeContext=this.plugin.noteImageStage?.galleryContext;
            if(bridgeContext && bridgeContext.origin===activeImg.targetOriginalImgEl) this.plugin.noteImageStage.galleryContext=null;
            this.renderImgView(activeImg.imgViewEl, '', '');
            activeImg.popup = false;
            activeImg.mtime = 0;
            let globalPopupFlag = false;
            for (const imgCto of this.imgInfo.imgList) {
                if (imgCto.popup) {
                    globalPopupFlag = true;
                    break;
                }
            }
            if (!globalPopupFlag) {
                this.imgInfo.oitContainerEl.style.setProperty('display', 'none'); // hide 'oit-pin-container-view'
                this.imgGlobalStatus.activeImgZIndex = 0;
                this.imgInfo.imgList.forEach(value => {
                    value.zIndex = 0;
                });
            }
            this.imgGlobalStatus.popup = globalPopupFlag;
            this.addOrRemoveEvents(activeImg, false);
        };
        //endregion
        this.setActiveImgZIndex = (activeImg) => {
            var _a;
            let isUpdate = false;
            for (const imgCto of this.imgInfo.imgList) {
                if (activeImg.index !== imgCto.index && activeImg.zIndex <= imgCto.zIndex) {
                    isUpdate = true;
                    break;
                }
            }
            if (isUpdate) {
                activeImg.zIndex = (++this.imgGlobalStatus.activeImgZIndex);
                (_a = activeImg.imgViewEl) === null || _a === void 0 ? void 0 : _a.style.setProperty("z-index", activeImg.zIndex + '');
            }
        };
        this.setMenuView(new MenuView(this));
    }
    setActiveImgForMouseEvent(imgCto) {
        this.imgGlobalStatus.activeImg = imgCto;
    }
}

class ContainerFactory {
    constructor() {
        // popout window containers: hash -> ContainerView
        this.popoutContainers = new Map();
        this.setMainContainer = (container) => {
            this.mainContainer = container;
        };
        this.getMainContainer = () => {
            return this.mainContainer;
        };
        this.setPopoutContainer = (key, container) => {
            this.popoutContainers.set(key, container);
        };
        this.getPopoutContainer = (key) => {
            return this.popoutContainers.get(key);
        };
        this.getPopoutContainers = () => {
            return this.popoutContainers;
        };
        this.getContainer = (targetEl) => {
            const bodyEl = targetEl === null || targetEl === void 0 ? void 0 : targetEl.matchParent('body');
            if (!bodyEl)
                return null;
            const oitEventKey = bodyEl.getAttribute('data-oit-event');
            if (oitEventKey) {
                //popout window
                return this.getPopoutContainer(oitEventKey);
            }
            return this.mainContainer;
        };
        this.getAllContainers = () => {
            let allContainerViews = [this.mainContainer];
            for (let value of this.popoutContainers.values()) {
                allContainerViews.push(value);
            }
            return allContainerViews;
        };
        this.clearAll = () => {
            this.mainContainer = null;
            this.popoutContainers.clear();
        };
    }
}

class ImageToolkitPlugin extends obsidian.Plugin {
    constructor() {
        super(...arguments);
        this.containerFactory = new ContainerFactory();
        this.imgSelector = ``;
        this.addIcons = () => __awaiter(this, void 0, void 0, function* () {
            for (const icon of ICONS) {
                obsidian.addIcon(icon.id, icon.svg);
            }
        });
        this.getViewMode = () => {
            return this.settings.viewMode;
        };
        this.setViewMode = (viewMode) => {
            return this.settings.viewMode = viewMode;
        };
        this.checkViewMode = (viewMode) => __awaiter(this, void 0, void 0, function* () {
            for (const key in ViewMode) {
                if (key == viewMode) {
                    return;
                }
            }
            this.setViewMode(DEFAULT_VIEW_MODE);
            console.log('[oit] Reset view mode: %s', DEFAULT_VIEW_MODE);
            yield this.saveSettings();
        });
        this.getAllContainerViews = () => {
            return this.containerFactory.getAllContainers();
        };
        this.initContainer = (viewMode, popoutWindowEventId) => __awaiter(this, void 0, void 0, function* () {
            const container = yield this.initContainerByViewMode(viewMode);
            if (!container) {
                console.error('[oit] Cannot init container');
                return;
            }
            if (popoutWindowEventId) {
                // popoutWindowEventId will be recorded into data-oit-event'of body tag
                this.containerFactory.setPopoutContainer(popoutWindowEventId, container);
            }
            else {
                this.containerFactory.setMainContainer(container);
            }
        });
        this.initContainerByViewMode = (viewMode, fromDefault) => __awaiter(this, void 0, void 0, function* () {
            switch (viewMode) {
                case ViewMode.Normal:
                    return new NormalContainerView(this);
                case ViewMode.Pin:
                    return new PinContainerView(this);
                default:
                    if (fromDefault) {
                        return null;
                    }
                    this.setViewMode(viewMode = DEFAULT_VIEW_MODE);
                    yield this.saveSettings();
                    console.log('[oit] Reset view mode to: %s', viewMode);
                    return this.initContainerByViewMode(viewMode, true);
            }
        });
        this.isImageElement = (imgEl) => {
            return imgEl && 'IMG' === imgEl.tagName;
        };
        this.isClickable = (targetEl, event) => {
            let container;
            if (this.isImageElement(targetEl)
                && (container = this.containerFactory.getContainer(targetEl))
                && container.checkHotkeySettings(event, this.settings.viewTriggerHotkey)) {
                return container;
            }
            return null;
        };
        this.switchViewMode = (viewMode) => __awaiter(this, void 0, void 0, function* () {
            this.settings.viewMode = viewMode;
            yield this.saveSettings();
            this.getAllContainerViews().forEach(container => {
                var _a;
                container.removeOitContainerView();
                this.initContainer(viewMode, (_a = container.getParentContainerEl()) === null || _a === void 0 ? void 0 : _a.getAttribute('data-oit-event'));
            });
        });
        /**
         * refresh events for main container
         */
        this.refreshViewTrigger = (doc) => {
            // .workspace-leaf-content[data-type='markdown'] img,.workspace-leaf-content[data-type='image'] img
            const viewImageInEditor = this.settings.viewImageInEditor;
            // .community-modal-details img
            const viewImageInCPB = this.settings.viewImageInCPB;
            // false: ... img:not(a img)
            const viewImageWithLink = this.settings.viewImageWithLink;
            // #sr-flashcard-view img
            const viewImageOther = this.settings.viewImageOther;
            if (!doc) {
                doc = document;
            }
            if (this.imgSelector) {
                doc.off('click', this.imgSelector, this.clickImage);
                doc.off('mouseover', this.imgSelector, this.mouseoverImg);
                doc.off('mouseout', this.imgSelector, this.mouseoutImg);
            }
            if (!viewImageOther && !viewImageInEditor && !viewImageInCPB && !viewImageWithLink) {
                return;
            }
            let selector = ``;
            if (viewImageInEditor) {
                selector += (viewImageWithLink ? VIEW_IMG_SELECTOR.EDITOR_AREAS : VIEW_IMG_SELECTOR.EDITOR_AREAS_NO_LINK);
            }
            if (viewImageInCPB) {
                selector += (1 < selector.length ? `,` : ``) + (viewImageWithLink ? VIEW_IMG_SELECTOR.CPB : VIEW_IMG_SELECTOR.CPB_NO_LINK);
            }
            if (viewImageOther) {
                selector += (1 < selector.length ? `,` : ``) + (viewImageWithLink ? VIEW_IMG_SELECTOR.OTHER : VIEW_IMG_SELECTOR.OTHER_NO_LINK);
            }
            if (selector) {
                this.imgSelector = selector;
                // doc.onclick = (event: MouseEvent) =>{
                //     console.log(event.target);
                // }
                doc.on('click', this.imgSelector, this.clickImage);
                doc.on('mouseover', this.imgSelector, this.mouseoverImg);
                doc.on('mouseout', this.imgSelector, this.mouseoutImg);
            }
        };
        this.clickImage = (event) => {
            if(obsidian.Platform.isMobile && this.noteImageStage?.openMobileImage(event))return;
            const targetEl = event.target;
            let container = this.isClickable(targetEl, event);
            if (container) {
                container.renderContainer(targetEl);
            }
        };
        this.mouseoverImg = (event) => {
            const targetEl = event.target;
            if (!this.isClickable(targetEl, event)) {
                return;
            }
            if (null == targetEl.getAttribute(ImageToolkitPlugin.IMG_ORIGIN_CURSOR)) {
                targetEl.setAttribute(ImageToolkitPlugin.IMG_ORIGIN_CURSOR, targetEl.style.cursor || '');
            }
            targetEl.style.cursor = 'zoom-in';
        };
        this.mouseoutImg = (event) => {
            const targetEl = event.target;
            if (!this.isClickable(targetEl, event)) {
                return;
            }
            targetEl.style.cursor = targetEl.getAttribute(ImageToolkitPlugin.IMG_ORIGIN_CURSOR);
        };
    }
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('loading %s plugin v%s ...', this.manifest.id, this.manifest.version);
            yield this.loadSettings();
            this.addSettingTab(new ImageToolkitSettingTab(this.app, this));
            // this.registerCommands();
            yield this.initContainer(this.settings.viewMode);
            this.refreshViewTrigger();
            // addEventListener for opened new windows
            this.registerEvent(this.app.workspace.on('layout-change', () => {
                this.app.workspace.iterateAllLeaves((leaf) => {
                    var _a;
                    if (['markdown', 'image'].includes((_a = leaf.getViewState()) === null || _a === void 0 ? void 0 : _a.type)) {
                        const bodyEl = leaf.view.containerEl.matchParent('body');
                        if (bodyEl === null || bodyEl === void 0 ? void 0 : bodyEl.hasClass('is-popout-window')) {
                            if (!bodyEl.hasAttribute(ImageToolkitPlugin.POPOUT_WINDOW_EVENT) || !this.containerFactory.getPopoutContainer(bodyEl.getAttribute(ImageToolkitPlugin.POPOUT_WINDOW_EVENT))) {
                                console.log('popout leaf:', leaf, leaf.getDisplayText());
                                const eventId = bodyEl.getAttribute(ImageToolkitPlugin.POPOUT_WINDOW_EVENT) || crypto.randomUUID();
                                this.initContainer(this.settings.viewMode, eventId);
                                bodyEl.setAttr(ImageToolkitPlugin.POPOUT_WINDOW_EVENT, eventId);
                                this.imageLayoutDocuments?.add(bodyEl.ownerDocument);
                                this.refreshViewTrigger(bodyEl.ownerDocument);
                            }
                        }
                    }
                });
            }));
        });
    }
    onunload() {
        console.log('unloading ' + this.manifest.id + ' plugin...');
        this.getAllContainerViews().forEach(container => {
            container.removeOitContainerView();
        });
        this.containerFactory.clearAll();
        document.off('click', this.imgSelector, this.clickImage);
        document.off('mouseover', this.imgSelector, this.mouseoverImg);
        document.off('mouseout', this.imgSelector, this.mouseoutImg);
    }
    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
            yield this.checkViewMode(this.getViewMode());
            yield this.addIcons();
        });
    }
    saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveData(this.settings);
        });
    }
    registerCommands() {
        return __awaiter(this, void 0, void 0, function* () {
            /* this.addCommand({
                "id": "oit-move-up-image",
                "name": "move up the image",
                hotkeys: [{ modifiers: ["Ctrl"], key: "ArrowUp" }],
                checkCallback: (checking: boolean) => {
                    if (checking) return false;
                    this.containerView.moveImgViewByHotkey('UP');
                },
            }); */
        });
    }
}
ImageToolkitPlugin.IMG_ORIGIN_CURSOR = 'data-oit-origin-cursor';
// data-oit-event: 标识new window是否已addEventListener for click
ImageToolkitPlugin.POPOUT_WINDOW_EVENT = 'data-oit-event';

module.exports = ImageToolkitPlugin;


// Local floating image navigation upgrade; upstream viewer preserved.
(()=>{
const OriginalToolkit=module.exports;
const addonModule={exports:{}};
((module,exports)=>{
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => NoteImageStage
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");

// src/images.ts
var IMAGE_EXTENSION = /\.(?:avif|bmp|gif|heic|heif|ico|jpe?g|png|svg|tiff?|webp)$/i;
var unescapeMarkdown = (value) => value.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, "$1");
var normalizeLabel = (value) => unescapeMarkdown(value).trim().replace(/\s+/g, " ").toLowerCase();
var decodeEntities = (value) => value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, (entity) => {
  const names = { "&amp;": "&", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">" };
  if (entity[1] !== "#") return names[entity.toLowerCase()] ?? entity;
  const code = entity[2].toLowerCase() === "x" ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10);
  return code > 0 && code <= 1114111 ? String.fromCodePoint(code) : entity;
});
function isImage(target) {
  if (/^(?:https?:\/\/|data:image\/)/i.test(target)) return true;
  let path = target.split(/[?#]/, 1)[0];
  try {
    path = decodeURIComponent(path);
  } catch {
  }
  return IMAGE_EXTENSION.test(path);
}
function visibleSource(text) {
  const chars = text.split("");
  const hide = (start, end) => {
    for (let i = start; i < end; i++) if (chars[i] !== "\n" && chars[i] !== "\r") chars[i] = " ";
  };
  const frontmatter = /^(?:\uFEFF)?---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(text);
  if (frontmatter) hide(0, frontmatter[0].length);
  for (const match of text.matchAll(/<!--[\s\S]*?(?:-->|$)/g)) hide(match.index, match.index + match[0].length);
  let fence;
  let offset = 0;
  for (const line of text.split(/(?<=\n)/)) {
    const available = chars.slice(offset, offset + line.length).join("");
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)/.exec(available);
    if (fence) {
      hide(offset, offset + line.length);
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.size && /^\s*$/.test(marker[2])) fence = void 0;
    } else if (marker && !(marker[1][0] === "`" && marker[2].includes("`"))) {
      fence = { char: marker[1][0], size: marker[1].length };
      hide(offset, offset + line.length);
    }
    offset += line.length;
  }
  let source = chars.join("");
  for (let i = 0; i < source.length; i++) {
    if (source[i] !== "`" || escaped(source, i)) continue;
    let end = i;
    while (source[end] === "`") end++;
    const size = end - i;
    let closing = end;
    while ((closing = source.indexOf("`".repeat(size), closing)) >= 0) {
      if (source[closing - 1] !== "`" && source[closing + size] !== "`") break;
      closing += size;
    }
    if (closing >= 0) {
      hide(i, closing + size);
      i = closing + size - 1;
    } else i = end - 1;
  }
  source = chars.join("");
  return source;
}
function escaped(text, index) {
  let slashes = 0;
  while (index > 0 && text[--index] === "\\") slashes++;
  return slashes % 2 === 1;
}
function closingBracket(text, start) {
  let depth = 1;
  for (let i = start; i < text.length; i++) {
    if (escaped(text, i)) continue;
    if (text[i] === "[") depth++;
    if (text[i] === "]" && --depth === 0) return i;
  }
  return -1;
}
function destination(text, start) {
  let i = start;
  while (/\s/.test(text[i] ?? "") && i < text.length) i++;
  const first = i;
  let target;
  if (text[i] === "<") {
    i++;
    const pathStart = i;
    while (i < text.length && (text[i] !== ">" || escaped(text, i)) && text[i] !== "\n") i++;
    if (text[i] !== ">") return;
    target = text.slice(pathStart, i++);
  } else {
    let depth = 0;
    while (i < text.length) {
      if (!escaped(text, i)) {
        if (text[i] === "(") depth++;
        else if (text[i] === ")") {
          if (depth === 0) break;
          depth--;
        } else if (/\s/.test(text[i]) && depth === 0) break;
      }
      i++;
    }
    if (i === first) return;
    target = text.slice(first, i);
  }
  return { target: unescapeMarkdown(target), end: i };
}
function extractImages(text) {
  const source = visibleSource(text);
  const refs = /* @__PURE__ */ new Map();
  for (const match of source.matchAll(/^ {0,3}\[([^\]\n]+)\]:[ \t]*(.*)$/gm)) {
    const parsed = destination(match[2], 0);
    if (parsed && !refs.has(normalizeLabel(match[1]))) refs.set(normalizeLabel(match[1]), parsed.target);
  }
  const results = [];
  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") lineStarts.push(i + 1);
  const add = (offset, end, target, alt, kind) => {
    if (!isImage(target)) return;
    let low = 0, high = lineStarts.length;
    while (low + 1 < high) {
      const mid = low + high >>> 1;
      if (lineStarts[mid] <= offset) low = mid;
      else high = mid;
    }
    results.push({ target, alt, kind, line: low, offset, raw: text.slice(offset, end) });
  };
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "<" && /^<img\b/i.test(source.slice(i))) {
      const tag = /^<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/i.exec(source.slice(i));
      if (!tag) continue;
      const attributes = /* @__PURE__ */ new Map();
      for (const attr of tag[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attributes.set(attr[1].toLowerCase(), decodeEntities(attr[2] ?? attr[3] ?? attr[4]));
      if (attributes.has("src")) add(i, i + tag[0].length, attributes.get("src"), attributes.get("alt") ?? "", "html");
      i += tag[0].length - 1;
      continue;
    }
    if (source[i] !== "!" || source[i + 1] !== "[" || escaped(source, i)) continue;
    if (source[i + 2] === "[") {
      const end2 = source.indexOf("]]", i + 3);
      if (end2 < 0 || /[\r\n]/.test(source.slice(i + 3, end2))) continue;
      const [target, ...aliases] = text.slice(i + 3, end2).split("|");
      add(i, end2 + 2, target.trim(), aliases.join("|"), "wiki");
      i = end2 + 1;
      continue;
    }
    const bracket = closingBracket(source, i + 2);
    if (bracket < 0) continue;
    const alt = unescapeMarkdown(text.slice(i + 2, bracket));
    let end = bracket + 1;
    if (source[end] === "(") {
      const parsed = destination(source, end + 1);
      if (!parsed) continue;
      end = parsed.end;
      while (/\s/.test(source[end] ?? "") && end < source.length) end++;
      if (/['"(]/.test(source[end] ?? "")) {
        const quote = source[end++] === "(" ? ")" : source[end - 1];
        while (end < source.length && (source[end] !== quote || escaped(source, end))) end++;
        if (source[end] !== quote) continue;
        end++;
        while (/\s/.test(source[end] ?? "") && end < source.length) end++;
      }
      if (source[end] !== ")") continue;
      add(i, end + 1, parsed.target, alt, "markdown");
      i = end;
    } else {
      let label = alt;
      if (source[end] === "[") {
        const labelEnd = closingBracket(source, end + 1);
        if (labelEnd < 0) continue;
        label = source.slice(end + 1, labelEnd) || alt;
        end = labelEnd + 1;
      }
      const target = refs.get(normalizeLabel(label));
      if (target) {
        add(i, end, target, alt, "reference");
        i = end - 1;
      }
    }
  }
  return results;
}

// src/viewer.ts
var import_obsidian = require("obsidian");

// src/gestures.ts
var ImageGestures = class {
  scale = 1;
  x = 0;
  y = 0;
  pointers = /* @__PURE__ */ new Map();
  origin = { x: 0, y: 0, scale: 1, cx: 0, cy: 0, distance: 0 };
  down(id, x, y) {
    this.pointers.set(id, { x, y });
    this.rebase();
  }
  move(id, x, y) {
    if (!this.pointers.has(id)) return false;
    this.pointers.set(id, { x, y });
    const { cx, cy, distance } = this.geometry(), base = this.origin;
    const ratio = base.distance > 0 && distance > 0 ? distance / base.distance : 1;
    this.scale = Math.max(0.1, Math.min(20, base.scale * ratio));
    const actual = this.scale / base.scale;
    this.x = cx - (base.cx - base.x) * actual;
    this.y = cy - (base.cy - base.y) * actual;
    return true;
  }
  up(id) {
    this.pointers.delete(id);
    this.rebase();
  }
  reset() {
    this.pointers.clear();
    this.scale = 1;
    this.x = this.y = 0;
    this.rebase();
  }
  zoom(factor) {
    this.scale = Math.max(0.1, Math.min(20, this.scale * factor));
    this.rebase();
  }
  geometry() {
    const [a, b] = [...this.pointers.values()];
    if (!a) return { cx: 0, cy: 0, distance: 0 };
    return b ? { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) } : { cx: a.x, cy: a.y, distance: 0 };
  }
  rebase() {
    this.origin = { x: this.x, y: this.y, scale: this.scale, ...this.geometry() };
  }
};
function attachImageGestures(stage, model, render) {
  const point = (event) => {
    const r = stage.getBoundingClientRect();
    return { x: event.clientX - r.left - r.width / 2, y: event.clientY - r.top - r.height / 2 };
  };
  const down = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const p = point(event);
    model.down(event.pointerId, p.x, p.y);
    try {
      stage.setPointerCapture(event.pointerId);
    } catch {
      model.up(event.pointerId);
    }
  };
  const move = (event) => {
    const p = point(event);
    if (model.move(event.pointerId, p.x, p.y)) {
      event.preventDefault();
      render();
    }
  };
  const end = (event) => {
    model.up(event.pointerId);
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
  };
  stage.addEventListener("pointerdown", down);
  stage.addEventListener("pointermove", move);
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
  stage.addEventListener("lostpointercapture", end);
  return () => {
    stage.removeEventListener("pointerdown", down);
    stage.removeEventListener("pointermove", move);
    stage.removeEventListener("pointerup", end);
    stage.removeEventListener("pointercancel", end);
    stage.removeEventListener("lostpointercapture", end);
    model.reset();
  };
}

// src/mobile-images.ts
function sameImageSource(a, b) {
  try {
    const left = new URL(a), right = new URL(b);
    if (left.href === right.href) return true;
    return /^(app:|capacitor:|file:)$/.test(left.protocol) && left.protocol === right.protocol && left.host === right.host && left.pathname === right.pathname;
  } catch {
    return a === b;
  }
}
function pickMobileImageIndex(images, src, line, ordinal = 0) {
  const matches = images.map((image, index) => ({ image, index })).filter((item) => sameImageSource(item.image.src, src));
  if (!matches.length) return -1;
  if (line !== void 0 && Number.isFinite(line)) {
    const byLine = [...matches].sort((a, b) => Math.abs(a.image.line - line) - Math.abs(b.image.line - line));
    const exactOccurrence = matches[Math.max(0, Math.min(matches.length - 1, ordinal))];
    return Math.abs(exactOccurrence.image.line - line) === Math.abs(byLine[0].image.line - line) ? exactOccurrence.index : byLine[0].index;
  }
  return matches[Math.max(0, Math.min(matches.length - 1, ordinal))].index;
}
function mobileDomImages(root, origin) {
  const images = Array.from(root.querySelectorAll("img")).filter((img) => {
    if (!img.src || img.closest('.nis-stage,.ilg-popover,.nis-viewer,.ilg-viewer,.ilg-thumbnails,.ilg-stage-thumb-figure,[hidden],[aria-hidden="true"]')) return false;
    const rect = img.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  if (!images.includes(origin)) return [origin];
  return images;
}
function rotatedImageBounds(width, height, rotation) {
  return Math.abs(rotation % 180) === 90 ? { width: height, height: width } : { width, height };
}

// src/viewer.ts
var ImageViewer = class extends import_obsidian.Modal {
  constructor(app, images, index) {
    super(app);
    this.images = images;
    this.index = Math.max(0, Math.min(images.length - 1, Number.isFinite(index) ? Math.trunc(index) : 0));
  }
  index;
  rotation = 0;
  gestures = new ImageGestures();
  disposeGestures;
  image;
  stage;
  label;
  error;
  previous;
  next;
  observer;
  onOpen() {
    this.modalEl.addClass("nis-viewer");
    this.titleEl.setText("\u56FE\u7247\u9884\u89C8");
    const toolbar = this.contentEl.createDiv("nis-viewer-toolbar");
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "\u56FE\u7247\u67E5\u770B\u5DE5\u5177");
    const button = (icon, title, action) => {
      const b = toolbar.createEl("button", { attr: { type: "button", "aria-label": title, title } });
      (0, import_obsidian.setIcon)(b, icon);
      b.addEventListener("click", action);
      return b;
    };
    this.previous = button("chevron-left", "\u4E0A\u4E00\u5F20", () => this.change(-1));
    this.next = button("chevron-right", "\u4E0B\u4E00\u5F20", () => this.change(1));
    button("zoom-in", "\u653E\u5927", () => this.zoom(1.25));
    button("zoom-out", "\u7F29\u5C0F", () => this.zoom(0.8));
    button("maximize", "\u9002\u5E94\u7A97\u53E3", () => this.reset());
    button("rotate-cw", "\u65CB\u8F6C", () => {
      this.rotation = (this.rotation + 90) % 360;
      this.transform();
    });
    button("x", "\u5173\u95ED\u56FE\u7247\u9884\u89C8", () => this.close());
    this.label = toolbar.createSpan("nis-viewer-count");
    this.label.setAttribute("aria-live", "polite");
    this.stage = this.contentEl.createDiv("nis-viewer-stage");
    this.image = this.stage.createEl("img", { attr: { draggable: "false", decoding: "async" } });
    this.error = this.stage.createDiv({ cls: "nis-viewer-error", text: "\u56FE\u7247\u52A0\u8F7D\u5931\u8D25\uFF0C\u53EF\u5207\u6362\u5176\u4ED6\u56FE\u7247" });
    this.error.setAttribute("role", "status");
    this.error.hidden = true;
    this.image.addEventListener("error", () => {
      this.image.hidden = true;
      this.error.hidden = false;
    });
    this.image.addEventListener("load", () => {
      this.image.hidden = false;
      this.error.hidden = true;
      this.transform();
    });
    this.stage.setAttribute("aria-label", "\u53CC\u6307\u7F29\u653E\uFF0C\u5355\u6307\u5E73\u79FB\uFF0C\u53CC\u51FB\u6062\u590D");
    this.stage.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (e.deltaY) this.zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });
    this.stage.addEventListener("dblclick", () => this.reset());
    this.disposeGestures = attachImageGestures(this.stage, this.gestures, () => this.transform());
    const Observer = this.stage.ownerDocument.defaultView?.ResizeObserver;
    if (Observer) {
      this.observer = new Observer(() => this.transform());
      this.observer.observe(this.stage);
    }
    this.scope.register([], "ArrowLeft", () => {
      this.change(-1);
      return false;
    });
    this.scope.register([], "ArrowRight", () => {
      this.change(1);
      return false;
    });
    this.scope.register([], "+", () => {
      this.zoom(1.25);
      return false;
    });
    this.scope.register([], "-", () => {
      this.zoom(0.8);
      return false;
    });
    this.show();
  }
  change(delta) {
    if (this.images.length < 2) return;
    this.index = (this.index + delta + this.images.length) % this.images.length;
    this.show();
  }
  show() {
    const item = this.images[this.index];
    this.previous.disabled = this.next.disabled = this.images.length < 2;
    this.label.setText(item ? `${this.index + 1} / ${this.images.length}` : "0 / 0");
    this.error.hidden = true;
    this.image.hidden = !item;
    if (item) {
      this.image.src = item.src;
      this.image.alt = item.alt;
    }
    this.reset();
  }
  zoom(factor) {
    this.gestures.zoom(factor);
    this.transform();
  }
  reset() {
    this.gestures.reset();
    this.rotation = 0;
    this.transform();
  }
  transform() {
    const rect = this.stage.getBoundingClientRect(), bounds = rotatedImageBounds(rect.width, rect.height, this.rotation);
    this.image.style.maxWidth = `${bounds.width}px`;
    this.image.style.maxHeight = `${bounds.height}px`;
    this.image.style.transform = `translate(${this.gestures.x}px,${this.gestures.y}px) rotate(${this.rotation}deg) scale(${this.gestures.scale})`;
  }
  onClose() {
    this.observer?.disconnect();
    this.observer = void 0;
    this.disposeGestures?.();
    this.disposeGestures = void 0;
    this.contentEl.empty();
  }
};

// src/follow.ts
function pickImageAtLine(lines, line) {
  if (lines.length === 0 || Number.isNaN(line)) return -1;
  let low = 0;
  let high = lines.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (lines[middle] <= line) low = middle + 1;
    else high = middle;
  }
  return Math.max(0, low - 1);
}
function pickVisibleImage(candidates, viewport) {
  if (!Number.isFinite(viewport.top) || !Number.isFinite(viewport.bottom) || viewport.bottom <= viewport.top) return -1;
  const anchor = viewport.top + (viewport.bottom - viewport.top) * 0.5;
  let selected = -1;
  let nearestEdge = Infinity;
  let nearestCenter = Infinity;
  for (const candidate of candidates) {
    const { index, top, bottom } = candidate;
    if (!Number.isInteger(index) || index < 0 || !Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) continue;
    const height = bottom - top;
    const visibleHeight = Math.min(bottom, viewport.bottom) - Math.max(top, viewport.top);
    if (visibleHeight <= 0 || visibleHeight < Math.min(24, height * 0.25)) continue;
    const edgeDistance = Math.max(top - anchor, anchor - bottom, 0);
    const centerDistance = Math.abs((top + bottom) / 2 - anchor);
    if (edgeDistance < nearestEdge || edgeDistance === nearestEdge && centerDistance < nearestCenter) {
      selected = index;
      nearestEdge = edgeDistance;
      nearestCenter = centerDistance;
    }
  }
  return selected;
}

// src/mobile-stage.ts
function attachMobileStageDismiss(root, dismiss) {
  const doc = root.ownerDocument;
  let tap = null;
  const active = /* @__PURE__ */ new Set();
  const contains = (target) => Boolean(target && root.contains(target));
  const down = (event) => {
    active.add(event.pointerId);
    if (active.size > 1) {
      tap = null;
      return;
    }
    if (event.button !== 0 || contains(event.target)) {
      tap = null;
      return;
    }
    tap = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const move = (event) => {
    if (tap?.id === event.pointerId && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 10) tap = null;
  };
  const up = (event) => {
    active.delete(event.pointerId);
    if (tap?.id !== event.pointerId) return;
    const accepted = !contains(event.target) && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) <= 10;
    tap = null;
    if (accepted) dismiss();
  };
  const cancel = () => {
    tap = null;
    active.clear();
  };
  doc.addEventListener("pointerdown", down, true);
  doc.addEventListener("pointermove", move, true);
  doc.addEventListener("pointerup", up, true);
  doc.addEventListener("pointercancel", cancel, true);
  return () => {
    cancel();
    doc.removeEventListener("pointerdown", down, true);
    doc.removeEventListener("pointermove", move, true);
    doc.removeEventListener("pointerup", up, true);
    doc.removeEventListener("pointercancel", cancel, true);
  };
}

// src/image-navigation.ts
function imageOccurrenceTarget(root, item, src, path) {
  const images = Array.from(root.querySelectorAll("img")).filter((img) => !img.closest(".nis-stage,.ilg-host,.ilg-popover") && sameImageSource(img.currentSrc || img.src, src));
  const exact = images.find((img) => Number(img.dataset.ilgSourceOffset) === item.offset && (!path || !img.dataset.ilgSourcePath || img.dataset.ilgSourcePath === path));
  if (exact) return exact;
  return null;
}
function centerImageTarget(target, scroller) {
  const box = target.getBoundingClientRect(), viewport = scroller.getBoundingClientRect();
  const top = scroller.scrollTop + (box.top + box.bottom) / 2 - (viewport.top + viewport.bottom) / 2;
  scroller.scrollTo({ top: Math.max(0, top), behavior: "auto" });
}
async function navigatePreviewImage(view, path, source, item, src, bridge, stillCurrent = () => true) {
  const line = bridge?.getSourceImageNavigationLine?.(source, item.offset) ?? item.line;
  view.previewMode.applyScroll(line);
  const root = view.containerEl, win = root.ownerDocument.defaultView;
  const wait = () => new Promise((resolve) => {
    if (win) win.setTimeout(resolve, 40);
    else resolve();
  });
  for (let attempt = 0; attempt < 10; attempt++) {
    if (!stillCurrent()) return false;
    const scroller = root.querySelector(".markdown-preview-view");
    let target = bridge?.revealSourceImage?.(path, item.offset, root) ?? imageOccurrenceTarget(root, item, src, path);
    if (!target) {
      const candidates = Array.from(root.querySelectorAll("img")).filter((img) => !img.closest(".nis-stage,.ilg-host,.ilg-popover") && sameImageSource(img.currentSrc || img.src, src));
      const matching = candidates.filter((img) => {
        try {
          const info = view.previewMode.renderer?.getSectionInfo?.(img);
          return info && info.lineStart <= item.line && info.lineEnd >= item.line;
        } catch {
          return false;
        }
      });
      if (matching.length === 1) target = matching[0];
    }
    if (target?.isConnected && scroller) {
      const box = target.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) {
        centerImageTarget(target, scroller);
        return true;
      }
    }
    if (attempt < 9) await wait();
  }
  return false;
}

// src/pixel-flower.ts
function appendPixelFlower(parent) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = parent.ownerDocument.createElementNS(ns, "svg");
  svg.setAttribute("class", "nis-stage-pixel-flower");
  svg.setAttribute("viewBox", "0 0 24 30");
  svg.setAttribute("width", "72");
  svg.setAttribute("height", "90");
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const layers = [
    { tone: "stem", pixels: [[11, 15, 2, 12], [7, 19, 4, 2], [5, 17, 3, 2], [15, 21, 4, 2], [18, 19, 2, 2]] },
    { tone: "leaf", pixels: [[4, 16, 3, 2], [6, 18, 4, 2], [13, 22, 4, 2], [16, 20, 4, 2]] },
    { tone: "petal", pixels: [[9, 2, 6, 3], [6, 4, 3, 4], [15, 4, 3, 4], [4, 7, 4, 6], [16, 7, 4, 6], [7, 13, 4, 3], [13, 13, 4, 3], [10, 14, 4, 3], [8, 5, 8, 9]] },
    { tone: "shade", pixels: [[4, 11, 3, 2], [6, 13, 3, 2], [9, 15, 6, 2], [16, 11, 4, 2], [15, 13, 3, 2]] },
    { tone: "light", pixels: [[10, 2, 3, 1], [6, 5, 2, 2], [4, 8, 2, 2], [15, 5, 2, 2]] },
    { tone: "gold", pixels: [[9, 8, 6, 5], [10, 7, 4, 1], [10, 13, 4, 1]] },
    { tone: "gold-light", pixels: [[10, 8, 3, 2]] },
    { tone: "gold-shade", pixels: [[13, 10, 2, 3], [11, 12, 2, 1]] },
    { tone: "spark", pixels: [[2, 4, 1, 1], [21, 15, 1, 1], [6, 26, 1, 1]] }
  ];
  for (const { tone, pixels } of layers) for (const [x, y, width, height] of pixels) {
    const rect = parent.ownerDocument.createElementNS(ns, "rect");
    rect.setAttribute("class", `nis-pixel-${tone}`);
    for (const [key, value] of Object.entries({ x, y, width, height })) rect.setAttribute(key, String(value));
    svg.appendChild(rect);
  }
  parent.appendChild(svg);
}

// src/stage-lifecycle.ts
var StageRegistry = class {
  constructor(create) {
    this.create = create;
  }
  stages = /* @__PURE__ */ new Map();
  reconcile(panes) {
    const retained = new Set(panes);
    for (const [pane, stage] of this.stages) if (!retained.has(pane)) {
      stage.close();
      this.stages.delete(pane);
    }
    for (const pane of panes) if (!this.stages.has(pane)) this.stages.set(pane, this.create(pane));
    return new Map(this.stages);
  }
  get(pane) {
    return this.stages.get(pane);
  }
  values() {
    return this.stages.values();
  }
  close() {
    for (const stage of this.stages.values()) stage.close();
    this.stages.clear();
  }
};
function isStageRootMounted(root, container) {
  return Boolean(container.isConnected && root?.isConnected && root.parentElement === container);
}
function canReuseStageRender(root, container, renderedEmpty) {
  return isStageRootMounted(root, container) || Boolean(renderedEmpty && root === null && container.isConnected);
}
function pickStageSource(panes, active, recent, previous) {
  const focused = panes.filter((pane) => pane.containerEl.ownerDocument.hasFocus());
  const candidates = focused.length ? focused : panes;
  return [active, recent, previous].find((pane) => Boolean(pane && candidates.includes(pane))) ?? candidates[0] ?? null;
}
var PaneTimers = class {
  constructor(owner) {
    this.owner = owner;
  }
  timers = /* @__PURE__ */ new Map();
  has(name) {
    return this.timers.has(name);
  }
  schedule(name, callback, delay) {
    this.cancel(name);
    const id = this.owner.setTimeout(() => {
      if (this.timers.get(name) !== id) return;
      this.timers.delete(name);
      callback();
    }, delay);
    this.timers.set(name, id);
  }
  cancel(name) {
    const id = this.timers.get(name);
    if (id !== void 0) this.owner.clearTimeout(id);
    this.timers.delete(name);
  }
  clear() {
    for (const name of [...this.timers.keys()]) this.cancel(name);
  }
};

// src/desktop-preview.ts
var import_obsidian2 = require("obsidian");

// src/crop-geometry.ts
function rotationAxes(rotation) {
  const turn = (Math.round(rotation / 90) % 4 + 4) % 4;
  return { turn, cos: [1, 0, -1, 0][turn], sin: [0, 1, 0, -1][turn] };
}
function screenPointToImage(point, geometry) {
  const { cos, sin } = rotationAxes(geometry.rotation);
  const dx = point.x - geometry.left - geometry.width / 2;
  const dy = point.y - geometry.top - geometry.height / 2;
  return {
    x: ((cos * dx + sin * dy) * (geometry.flipX ? -1 : 1) / geometry.width + 0.5) * geometry.naturalWidth,
    y: ((-sin * dx + cos * dy) * (geometry.flipY ? -1 : 1) / geometry.height + 0.5) * geometry.naturalHeight
  };
}
function cropFromScreen(start, end, geometry) {
  if (start.x === end.x || start.y === end.y || geometry.width <= 0 || geometry.height <= 0 || geometry.naturalWidth <= 0 || geometry.naturalHeight <= 0) return null;
  const a = screenPointToImage(start, geometry), b = screenPointToImage(end, geometry);
  const clamp = (value, max) => Math.max(0, Math.min(max, value));
  const x = clamp(Math.floor(Math.min(a.x, b.x) + 1e-7), geometry.naturalWidth);
  const y = clamp(Math.floor(Math.min(a.y, b.y) + 1e-7), geometry.naturalHeight);
  const right = clamp(Math.ceil(Math.max(a.x, b.x) - 1e-7), geometry.naturalWidth);
  const bottom = clamp(Math.ceil(Math.max(a.y, b.y) - 1e-7), geometry.naturalHeight);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}
function cropOutputSize(region, geometry) {
  return rotationAxes(geometry.rotation).turn % 2 ? { width: region.height, height: region.width } : { width: region.width, height: region.height };
}
function drawImageCrop(image, region, geometry, doc = image.ownerDocument) {
  const canvas = doc.createElement("canvas");
  const size = cropOutputSize(region, geometry);
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("\u65E0\u6CD5\u521B\u5EFA\u56FE\u7247\u88C1\u526A\u753B\u5E03");
  context.imageSmoothingEnabled = false;
  context.translate(canvas.width / 2, canvas.height / 2);
  const { cos, sin } = rotationAxes(geometry.rotation);
  context.transform(cos, sin, -sin, cos, 0, 0);
  context.scale(geometry.flipX ? -1 : 1, geometry.flipY ? -1 : 1);
  context.drawImage(image, region.x, region.y, region.width, region.height, -region.width / 2, -region.height / 2, region.width, region.height);
  return canvas;
}

// src/preview-motion.ts
var PreviewMotion = class {
  states = /* @__PURE__ */ new Map();
  start(origin, root) {
    this.cancel(root);
    const win = root.ownerDocument.defaultView;
    if (!win || win.matchMedia?.("(prefers-reduced-motion: reduce)").matches || typeof root.animate !== "function") return;
    const rect = origin.getBoundingClientRect();
    const visible = origin.isConnected && rect.width > 1 && rect.height > 1 && rect.left < win.innerWidth && rect.top < win.innerHeight && rect.left + rect.width > 0 && rect.top + rect.height > 0;
    const state = { root, source: origin.src, origin: visible ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null, animations: /* @__PURE__ */ new Set(), dispose: [] };
    this.states.set(root, state);
    const interrupt = () => this.cancel(root);
    root.addEventListener("pointerdown", interrupt, true);
    root.addEventListener("wheel", interrupt, { capture: true, passive: true });
    root.ownerDocument.addEventListener("keydown", interrupt, true);
    state.dispose.push(() => {
      root.removeEventListener("pointerdown", interrupt, true);
      root.removeEventListener("wheel", interrupt, true);
      root.ownerDocument.removeEventListener("keydown", interrupt, true);
    });
    this.play(state, root, [{ backgroundColor: "rgba(0, 0, 0, 0)" }, { backgroundColor: win.getComputedStyle(root).backgroundColor }], 220);
    const footer = root.querySelector(".oit-img-footer");
    if (footer) this.play(state, footer, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }], 240);
  }
  /** Call after refreshImg has set its final transform and dimensions. */
  reveal(image) {
    const root = image.closest(".oit-normal");
    const state = root ? this.states.get(root) : void 0;
    if (!state || state.image === image) return;
    if (image.src !== state.source) {
      this.cancel(state.root);
      return;
    }
    state.image = image;
    const show = () => {
      if (this.states.get(state.root) !== state) return;
      if (!state.root.isConnected || !image.isConnected || image.src !== state.source) {
        this.cancel(state.root);
        return;
      }
      const rect = image.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        this.cancel(state.root);
        return;
      }
      const base = image.ownerDocument.defaultView.getComputedStyle(image).transform;
      const transform = base === "none" ? "" : base;
      let from = `scale(.96) ${transform}`.trim();
      if (state.origin) {
        const source = state.origin;
        const dx = source.left + source.width / 2 - rect.left - rect.width / 2;
        const dy = source.top + source.height / 2 - rect.top - rect.height / 2;
        from = `translate(${dx}px, ${dy}px) scale(${source.width / rect.width}, ${source.height / rect.height}) ${transform}`.trim();
      }
      this.play(state, image, [{ opacity: state.origin ? 0.95 : 0, transform: from, transformOrigin: "center center" }, { opacity: 1, transform: transform || "none", transformOrigin: "center center" }], 280, true);
    };
    if (image.complete && image.naturalWidth > 0) {
      show();
      return;
    }
    const visibility = image.style.getPropertyValue("visibility"), priority = image.style.getPropertyPriority("visibility");
    image.style.setProperty("visibility", "hidden");
    const restore = () => {
      if (visibility) image.style.setProperty("visibility", visibility, priority);
      else image.style.removeProperty("visibility");
    };
    const loaded = () => {
      restore();
      image.removeEventListener("load", loaded);
      image.removeEventListener("error", failed);
      show();
    };
    const failed = () => this.cancel(state.root);
    image.addEventListener("load", loaded);
    image.addEventListener("error", failed);
    state.dispose.push(() => {
      image.removeEventListener("load", loaded);
      image.removeEventListener("error", failed);
      restore();
    });
  }
  cancel(root) {
    for (const [element, state] of this.states) {
      if (root && root !== element) continue;
      this.states.delete(element);
      for (const dispose of state.dispose) dispose();
      for (const animation of state.animations) {
        animation.onfinish = null;
        animation.cancel();
      }
      state.animations.clear();
    }
  }
  play(state, element, keyframes, duration, finish = false) {
    const animation = element.animate(keyframes, { duration, easing: "cubic-bezier(.22, .61, .36, 1)" });
    state.animations.add(animation);
    animation.onfinish = () => {
      state.animations.delete(animation);
      if (finish) this.cancel(state.root);
    };
  }
};

// src/desktop-preview.ts
function previewImageGeometry(image) {
  const win = image.ownerDocument.defaultView;
  const style = win.getComputedStyle(image), rect = image.getBoundingClientRect();
  const matrix = new win.DOMMatrixReadOnly(style.transform === "none" ? void 0 : style.transform);
  const width = parseFloat(style.width), height = parseFloat(style.height);
  return {
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    left: rect.left + rect.width / 2 - width / 2,
    top: rect.top + rect.height / 2 - height / 2,
    width,
    height,
    rotation: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI,
    flipY: matrix.a * matrix.d - matrix.b * matrix.c < 0
  };
}
var DesktopPreviewTools = class {
  constructor(root, activeImage, beforeSelection) {
    this.root = root;
    this.activeImage = activeImage;
    this.beforeSelection = beforeSelection;
    const doc = root.ownerDocument;
    this.button = doc.createElement("li");
    this.button.className = "toolbar_crop";
    this.button.setAttribute("role", "button");
    this.button.tabIndex = 0;
    this.button.setAttribute("title", "\u6846\u9009\u590D\u5236\uFF1A\u62D6\u52A8\u9009\u533A\uFF0C\u677E\u5F00\u540E\u6309\u539F\u56FE\u50CF\u7D20\u590D\u5236\uFF1BEsc \u9000\u51FA");
    this.button.setAttribute("aria-label", "\u6846\u9009\u5E76\u590D\u5236\u539F\u50CF\u7D20\u56FE\u7247");
    this.button.setAttribute("aria-pressed", "false");
    (0, import_obsidian2.setIcon)(this.button, "scan");
    const toggle = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (this.overlay) this.cancelSelection();
      else this.beginSelection();
    };
    this.button.addEventListener("click", toggle);
    this.button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        toggle(event);
      }
    });
    root.querySelector(".oit-img-toolbar")?.appendChild(this.button);
    root.addEventListener("click", this.exitForToolbar, true);
    doc.addEventListener("keyup", this.releaseEscape, true);
  }
  motion = new PreviewMotion();
  button;
  overlay = null;
  selection = null;
  label = null;
  start = null;
  end = null;
  geometry = null;
  image = null;
  pointer = null;
  copying = false;
  sequence = 0;
  suppressEscape = false;
  cleanupSelection = null;
  releaseEscape = (event) => {
    if (this.suppressEscape && event.key === "Escape") {
      this.suppressEscape = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  exitForToolbar = (event) => {
    const target = event.target;
    if (this.overlay && target?.closest(".oit-img-footer") && !target.closest(".toolbar_crop")) this.cancelSelection();
  };
  open(origin) {
    this.cancelSelection();
    this.motion.start(origin, this.root);
  }
  reveal(image) {
    this.cancelSelection();
    this.motion.reveal(image);
  }
  close() {
    this.cancelSelection();
    this.motion.cancel(this.root);
  }
  destroy() {
    this.close();
    this.button.remove();
    this.root.removeEventListener("click", this.exitForToolbar, true);
    this.root.ownerDocument.removeEventListener("keyup", this.releaseEscape, true);
  }
  cancelSelection() {
    this.sequence++;
    this.cleanupSelection?.();
    this.cleanupSelection = null;
    this.overlay?.remove();
    this.overlay = this.selection = this.label = null;
    this.start = this.end = this.geometry = this.image = null;
    this.pointer = null;
    this.copying = false;
    this.button.setAttribute("aria-pressed", "false");
    this.root.classList.remove("oit-crop-active");
  }
  beginSelection() {
    const image = this.activeImage();
    if (!image?.complete || !image.naturalWidth) {
      new import_obsidian2.Notice("\u56FE\u7247\u52A0\u8F7D\u5B8C\u6210\u540E\u5373\u53EF\u6846\u9009\u590D\u5236");
      return;
    }
    this.motion.cancel(this.root);
    this.beforeSelection();
    this.image = image;
    this.geometry = previewImageGeometry(image);
    const doc = this.root.ownerDocument, win = doc.defaultView;
    const overlay = this.overlay = doc.createElement("div");
    overlay.className = "oit-crop-overlay";
    overlay.setAttribute("role", "region");
    overlay.setAttribute("aria-label", "\u62D6\u52A8\u6846\u9009\u56FE\u7247\u533A\u57DF\uFF0C\u677E\u5F00\u9F20\u6807\u590D\u5236\uFF0CEsc \u9000\u51FA");
    this.selection = doc.createElement("div");
    this.selection.className = "oit-crop-selection";
    this.selection.hidden = true;
    this.label = doc.createElement("div");
    this.label.className = "oit-crop-label";
    this.label.textContent = "\u62D6\u52A8\u6846\u9009 \xB7 \u677E\u5F00\u590D\u5236\u539F\u56FE\u50CF\u7D20 \xB7 Esc \u9000\u51FA";
    this.label.setAttribute("aria-live", "polite");
    overlay.append(this.selection, this.label);
    this.root.appendChild(overlay);
    this.root.classList.add("oit-crop-active");
    this.button.setAttribute("aria-pressed", "true");
    const stop = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const point = (event) => ({ x: event.clientX, y: event.clientY });
    overlay.addEventListener("click", stop);
    overlay.addEventListener("wheel", stop, { passive: false });
    overlay.addEventListener("contextmenu", stop);
    overlay.addEventListener("pointerdown", (event) => {
      stop(event);
      if (event.button !== 0 || this.copying || this.pointer !== null) return;
      this.geometry = previewImageGeometry(image);
      const p = point(event), local = screenPointToImage(p, this.geometry);
      if (local.x < 0 || local.y < 0 || local.x > image.naturalWidth || local.y > image.naturalHeight) return;
      this.start = this.end = p;
      this.pointer = event.pointerId;
      overlay.setPointerCapture(event.pointerId);
    });
    overlay.addEventListener("pointermove", (event) => {
      stop(event);
      if (this.pointer === event.pointerId && !this.copying) {
        this.end = point(event);
        this.renderSelection();
      }
    });
    overlay.addEventListener("pointerup", (event) => {
      stop(event);
      if (this.pointer !== event.pointerId || this.copying) return;
      this.end = point(event);
      this.renderSelection();
      this.pointer = null;
      if (overlay.hasPointerCapture(event.pointerId)) overlay.releasePointerCapture(event.pointerId);
      if (this.start && Math.abs(this.end.x - this.start.x) >= 2 && Math.abs(this.end.y - this.start.y) >= 2) void this.copySelection();
    });
    overlay.addEventListener("pointercancel", () => this.cancelSelection());
    overlay.addEventListener("lostpointercapture", () => {
      if (this.pointer !== null) this.cancelSelection();
    });
    const key = (event) => {
      stop(event);
      if (event.key === "Escape") {
        this.suppressEscape = true;
        this.cancelSelection();
      }
    };
    const keyup = (event) => stop(event);
    const cancel = () => this.cancelSelection();
    doc.addEventListener("keydown", key, true);
    doc.addEventListener("keyup", keyup, true);
    win.addEventListener("blur", cancel);
    win.addEventListener("resize", cancel);
    this.cleanupSelection = () => {
      doc.removeEventListener("keydown", key, true);
      doc.removeEventListener("keyup", keyup, true);
      win.removeEventListener("blur", cancel);
      win.removeEventListener("resize", cancel);
    };
  }
  renderSelection() {
    if (!this.start || !this.end || !this.geometry || !this.selection || !this.label || !this.image) return;
    const rect = this.image.getBoundingClientRect();
    const x = Math.max(rect.left, Math.min(this.start.x, this.end.x)), y = Math.max(rect.top, Math.min(this.start.y, this.end.y));
    const right = Math.min(rect.right, Math.max(this.start.x, this.end.x)), bottom = Math.min(rect.bottom, Math.max(this.start.y, this.end.y));
    this.selection.hidden = false;
    Object.assign(this.selection.style, { left: `${x}px`, top: `${y}px`, width: `${Math.max(0, right - x)}px`, height: `${Math.max(0, bottom - y)}px` });
    const region = cropFromScreen(this.start, this.end, this.geometry);
    if (region) {
      const size = cropOutputSize(region, this.geometry);
      this.label.textContent = `${size.width} \xD7 ${size.height} px \xB7 \u677E\u5F00\u590D\u5236 \xB7 Esc \u9000\u51FA`;
    }
  }
  async copySelection() {
    if (!this.start || !this.end || !this.geometry || !this.image) return;
    const geometry = this.geometry, region = cropFromScreen(this.start, this.end, geometry);
    if (!region) return;
    const sequence = this.sequence, src = this.image.currentSrc || this.image.src;
    const doc = this.root.ownerDocument, win = doc.defaultView;
    this.copying = true;
    this.overlay?.classList.add("is-copying");
    if (this.label) this.label.textContent = "\u6B63\u5728\u590D\u5236\u539F\u50CF\u7D20\u9009\u533A\u2026";
    let objectUrl;
    try {
      let source = src;
      if (/^https?:\/\//i.test(src)) {
        const response = await (0, import_obsidian2.requestUrl)(src);
        objectUrl = win.URL.createObjectURL(new Blob([response.arrayBuffer], { type: response.headers["content-type"] || "application/octet-stream" }));
        source = objectUrl;
      }
      const original = new win.Image();
      original.src = source;
      await original.decode();
      if (sequence !== this.sequence) return;
      const canvas = drawImageCrop(original, region, geometry, doc);
      const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG \u7F16\u7801\u5931\u8D25")), "image/png"));
      if (sequence !== this.sequence) return;
      await win.navigator.clipboard.write([new win.ClipboardItem({ "image/png": blob })]);
      if (sequence !== this.sequence) return;
      const { width, height } = cropOutputSize(region, geometry);
      this.cancelSelection();
      new import_obsidian2.Notice(`\u5DF2\u590D\u5236\u539F\u50CF\u7D20\u9009\u533A\uFF1A${width} \xD7 ${height} px`);
    } catch (error) {
      if (sequence !== this.sequence) return;
      this.cancelSelection();
      new import_obsidian2.Notice(`\u590D\u5236\u9009\u533A\u65F6\u9047\u5230\u9519\u8BEF\uFF1A${error instanceof Error ? error.message : String(error)}`);
      console.error("Image Toolkit: crop copy", error);
    } finally {
      if (objectUrl) win.URL.revokeObjectURL(objectUrl);
    }
  }
};

// src/main.ts
var NoteImageStage = class extends import_obsidian3.Plugin {
  host;
  source = null;
  galleryImages = [];
  imageLayoutBridgeVersion = 1;
  galleryContext = null;
  mobileViewer = null;
  mobileOpenSequence = 0;
  desktopPreviews = /* @__PURE__ */ new Map();
  prepareDesktopPreview(container, origin) {
    const root = container.imgInfo.oitContainerEl;
    if (!root?.classList.contains("oit-normal")) return;
    let tools = this.desktopPreviews.get(container);
    if (!tools) {
      tools = new DesktopPreviewTools(root, () => container.getActiveImg()?.imgViewEl ?? null, () => {
        const status = container.imgGlobalStatus;
        status.dragging = status.arrowUp = status.arrowDown = status.arrowLeft = status.arrowRight = false;
        const image = container.getActiveImg()?.imgViewEl;
        if (image) image.onmousemove = null;
      });
      this.desktopPreviews.set(container, tools);
    }
    tools.open(origin);
  }
  revealDesktopPreview(container, image) {
    this.desktopPreviews.get(container)?.reveal(image);
  }
  clearDesktopPreview(container, remove = false) {
    const tools = this.desktopPreviews.get(container);
    if (remove) {
      tools?.destroy();
      this.desktopPreviews.delete(container);
    } else tools?.close();
  }
  showMobileViewer(images, index) {
    this.mobileOpenSequence++;
    this.mobileViewer?.close();
    const viewer = this.mobileViewer = new ImageViewer(this.app, images, index);
    const close = viewer.onClose.bind(viewer);
    viewer.onClose = () => {
      close();
      if (this.mobileViewer === viewer) {
        this.mobileViewer = null;
        this.galleryContext = null;
      }
    };
    viewer.open();
  }
  openMobileImage(event) {
    if (!import_obsidian3.Platform.isMobile) return false;
    const img = event.target;
    if (img?.tagName !== "IMG" || img.closest(".nis-viewer,.ilg-viewer,.ilg-image-controls,.ilg-popover")) return false;
    event.preventDefault();
    event.stopPropagation();
    const source = this.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view).find((view) => view instanceof import_obsidian3.MarkdownView && view.containerEl.contains(img));
    const sequence = ++this.mobileOpenSequence;
    void this.openMobileSourceImage(img, source, sequence);
    return true;
  }
  async openMobileSourceImage(img, source, sequence) {
    const fallback = () => {
      const nodes = img.parentElement ? mobileDomImages(source?.containerEl ?? img.parentElement, img) : [img];
      this.showMobileViewer(nodes.map((item) => ({ src: item.src, alt: item.alt })), Math.max(0, nodes.indexOf(img)));
    };
    try {
      const file = source?.file;
      if (!source || !file) {
        fallback();
        return;
      }
      const text = source.getMode() === "source" ? source.editor.getValue() : await this.app.vault.cachedRead(file);
      if (sequence !== this.mobileOpenSequence || !img.isConnected || source.file !== file) return;
      const images = extractImages(text).map((ref) => {
        let target = ref.target, src = "";
        if (/^https?:\/\//i.test(target) || /^data:image\//i.test(target)) src = target;
        else {
          try {
            target = decodeURIComponent(target);
          } catch {
          }
          target = target.replace(/\\([ ()\[\]])/g, "$1");
          const local = this.app.metadataCache.getFirstLinkpathDest(target.split("#")[0], file.path);
          if (local) src = this.app.vault.getResourcePath(local);
        }
        return { src, alt: ref.alt.replace(/\|\d+(?:x\d+)?$/, ""), line: ref.line };
      }).filter((item) => item.src);
      let line;
      if (source.getMode() === "source") {
        const cm = source.editor.cm;
        try {
          if (cm) line = cm.state.doc.lineAt(cm.posAtDOM(img)).number - 1;
        } catch {
        }
      } else {
        const renderer = source.previewMode?.renderer;
        try {
          line = renderer?.getSectionInfo?.(img)?.lineStart;
        } catch {
        }
      }
      const nodes = mobileDomImages(source.containerEl, img);
      const ordinal = nodes.slice(0, nodes.indexOf(img)).filter((item) => sameImageSource(item.src, img.src)).length;
      const index = pickMobileImageIndex(images, img.src, line, ordinal);
      if (index >= 0) this.showMobileViewer(images, index);
      else fallback();
    } catch (error) {
      console.warn("Image Toolkit: mobile source image resolution", error);
      if (sequence === this.mobileOpenSequence && img.isConnected) fallback();
    }
  }
  openGallery(images, index, origin, sourcePath) {
    if (!origin.isConnected || !images.length || !Number.isInteger(index) || index < 0 || index >= images.length) return false;
    const source = this.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view).find((view) => view instanceof import_obsidian3.MarkdownView && view.file?.path === sourcePath && view.containerEl.contains(origin));
    if (!source) return false;
    if (import_obsidian3.Platform.isMobile) {
      const context = { images: images.map(({ src, alt }) => ({ src, alt })), index, origin, sourcePath };
      this.showMobileViewer(context.images, index);
      this.galleryContext = context;
      return true;
    }
    const container = this.host.ensureImageContainer?.(origin) ?? this.host.containerFactory?.getContainer(origin);
    if (typeof container?.renderContainer !== "function" || typeof container.getLastClickedImgEl !== "function" || typeof container.getActiveImg !== "function") return false;
    this.galleryContext = { images: images.map(({ src, alt }) => ({ src, alt })), index, origin, sourcePath };
    try {
      container.renderContainer(origin);
      if (container.getLastClickedImgEl() !== origin || !container.getActiveImg()?.popup) {
        this.galleryContext = null;
        return false;
      }
      container.removeGalleryNavbar?.();
      container.renderGalleryNavbar?.();
      return true;
    } catch (error) {
      this.galleryContext = null;
      throw error;
    }
  }
  stage = null;
  viewActions = /* @__PURE__ */ new Map();
  jumpSequence = 0;
  stages = new StageRegistry((source) => new ImageStage(this, source));
  refresh = (0, import_obsidian3.debounce)(() => this.refreshStages(), 200, true);
  visibleSources() {
    return this.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view).filter((view) => {
      if (!(view instanceof import_obsidian3.MarkdownView) || !view.file || !view.containerEl.isConnected) return false;
      const rect = view.containerEl.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  }
  refreshStages() {
    const sources = this.visibleSources();
    if (import_obsidian3.Platform.isMobile) {
      for (const [view, action] of this.viewActions) if (!sources.includes(view)) {
        action.remove();
        this.viewActions.delete(view);
      }
      for (const view of sources) if (!this.viewActions.has(view)) {
        const action = view.addAction("images", "\u56FE\u7247", () => {
          this.source = view;
          void this.open(view);
        });
        action.addClass("nis-images-action");
        this.viewActions.set(view, action);
      }
    }
    if (this.getMode() === "off") {
      this.stages.close();
      this.stage = null;
      this.galleryImages = [];
      return;
    }
    this.source = this.findSource(sources);
    const stages = this.stages.reconcile(sources);
    this.stage = this.source ? stages.get(this.source) ?? null : null;
    if (!this.source) this.galleryImages = [];
    for (const stage of stages.values()) void stage.refresh().catch((error) => console.warn("Note Image Stage: refresh", error));
  }
  recoverStage(source) {
    if (this.stages.get(source) && this.visibleSources().includes(source)) this.refreshStages();
  }
  async onload() {
    this.addRibbonIcon("images", "\u6587\u7AE0\u56FE\u7247\u53F0\u524D\u5BFC\u822A", () => void this.open());
    this.addCommand({ id: "open", name: "\u6253\u5F00\u6587\u7AE0\u56FE\u7247\u53F0\u524D\u5BFC\u822A", callback: () => void this.open() });
    this.addCommand({ id: "hide-image-stage", name: "\u5173\u95ED\u6587\u7AE0\u56FE\u7247\u53F0\u524D\u5BFC\u822A", callback: () => void this.setMode("off") });
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file, _source, leaf) => {
      if (import_obsidian3.Platform.isMobile && leaf?.view instanceof import_obsidian3.MarkdownView && leaf.view.file === file) menu.addItem((item) => item.setTitle("\u56FE\u7247").setIcon("images").onClick(() => {
        this.source = leaf.view;
        void this.open(this.source);
      }));
    }));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.refreshStages()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.refreshStages()));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.refreshStages()));
    this.registerEvent(this.app.workspace.on("editor-change", (_editor, info) => {
      if (info instanceof import_obsidian3.MarkdownView && this.stages.get(info)) this.refresh();
    }));
    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (this.visibleSources().some((view) => view.file === file)) this.refresh();
    }));
    this.registerEvent(this.app.metadataCache.on("changed", (file) => {
      if (this.visibleSources().some((view) => view.file === file)) this.refresh();
    }));
    this.registerEvent(this.app.vault.on("rename", () => this.refresh()));
    this.registerEvent(this.app.vault.on("delete", () => this.refresh()));
    this.app.workspace.onLayoutReady(() => this.refreshStages());
  }
  onunload() {
    for (const tools of this.desktopPreviews.values()) tools.destroy();
    this.desktopPreviews.clear();
    this.jumpSequence++;
    for (const action of this.viewActions.values()) action.remove();
    this.viewActions.clear();
    this.mobileOpenSequence++;
    this.mobileViewer?.close();
    this.mobileViewer = null;
    this.galleryContext = null;
    this.refresh.cancel();
    this.stages.close();
    this.stage = null;
    this.galleryImages = [];
  }
  findSource(sources = this.visibleSources()) {
    const recent = this.app.workspace.getMostRecentLeaf()?.view;
    return pickStageSource(sources, this.app.workspace.getActiveViewOfType(import_obsidian3.MarkdownView), recent instanceof import_obsidian3.MarkdownView ? recent : null, this.source);
  }
  async setMode(mode) {
    this.host.settings.noteImageStageMode = mode;
    await this.host.saveSettings();
    this.refreshStages();
  }
  async open(originView) {
    if (originView) this.app.workspace.setActiveLeaf(originView.leaf, { focus: false });
    await this.setMode(this.host.settings.noteImageStageMode === "off" ? "always" : this.host.settings.noteImageStageMode ?? "always");
    if (import_obsidian3.Platform.isMobile) {
      const target = originView ?? this.source;
      if (target) this.stages.get(target)?.reveal();
    }
  }
  getWidth() {
    const value = this.host.settings.noteImageStageWidth;
    return typeof value === "number" && Number.isFinite(value) ? Math.max(120, Math.min(320, Math.round(value))) : 180;
  }
  async setWidth(value) {
    this.host.settings.noteImageStageWidth = Math.max(120, Math.min(320, Math.round(value)));
    for (const stage of this.stages.values()) stage.setWidth(this.getWidth());
    await this.host.saveSettings();
  }
  getMode() {
    const mode = this.host.settings.noteImageStageMode ?? "always";
    return import_obsidian3.Platform.isMobile && mode !== "off" ? "hover" : mode;
  }
  async jump(file, item, originView) {
    const sequence = ++this.jumpSequence;
    let view = originView ?? this.source;
    if (!view || view.file !== file) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
      view = leaf.view instanceof import_obsidian3.MarkdownView ? leaf.view : null;
    }
    if (!view) return;
    this.source = view;
    const text = view.getMode() === "source" ? view.editor.getValue() : await this.app.vault.cachedRead(file);
    if (sequence !== this.jumpSequence || view.file !== file) return;
    const refs = extractImages(text);
    const current = refs.find((r) => r.offset === item.offset && r.raw === item.raw) ?? refs.filter((r) => r.raw === item.raw).sort((a, b) => Math.abs(a.line - item.line) - Math.abs(b.line - item.line))[0];
    if (!current) {
      new import_obsidian3.Notice("\u56FE\u7247\u5F15\u7528\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u5237\u65B0\u4FA7\u680F\u540E\u5B9A\u4F4D");
      return;
    }
    this.app.workspace.setActiveLeaf(view.leaf, { focus: !import_obsidian3.Platform.isMobile });
    if (view.getMode() === "source") {
      const pos = { line: current.line, ch: 0 };
      if (!import_obsidian3.Platform.isMobile) view.editor.setCursor(pos);
      view.editor.scrollIntoView({ from: pos, to: pos }, true);
      return;
    }
    const plugins = this.app.plugins;
    let target = current.target, src = "";
    if (/^https?:\/\//i.test(target) || /^data:image\//i.test(target)) src = target;
    else {
      try {
        target = decodeURIComponent(target);
      } catch {
      }
      const local = this.app.metadataCache.getFirstLinkpathDest(target.replace(/\\([ ()\[\]])/g, "$1").split("#")[0], file.path);
      if (local) src = this.app.vault.getResourcePath(local);
    }
    await navigatePreviewImage(view, file.path, text, current, src, plugins?.getPlugin("image-layouts-enhanced"), () => sequence === this.jumpSequence && view.containerEl.isConnected && view.file === file && view.getMode() === "preview");
  }
  preview(items, index, img, originView) {
    if (originView) this.source = originView;
    this.galleryImages = items;
    if (import_obsidian3.Platform.isMobile) {
      this.showMobileViewer(items, index);
      return;
    }
    const plugins = this.app.plugins;
    const toolkit = plugins?.getPlugin("obsidian-image-toolkit");
    if (img && this.source?.file) {
      try {
        if (this.openGallery(items, index, img, this.source.file.path)) return;
      } catch (error) {
        console.warn("Note Image Stage: preview bridge fallback", error);
      }
    }
    if (img && this.source?.file && toolkit?.containerFactory) {
      try {
        this.app.workspace.setActiveLeaf(this.source.leaf, { focus: false });
        const container = this.host.ensureImageContainer?.(img) ?? toolkit.containerFactory.getContainer(img);
        if (typeof container?.renderContainer === "function") {
          container.renderContainer(img);
          return;
        }
      } catch (error) {
        console.warn("Note Image Sidebar: preview adapter fallback", error);
      }
    }
    new ImageViewer(this.app, items, index).open();
  }
};
var ImageStage = class {
  constructor(plugin, source) {
    this.plugin = plugin;
    this.source = source;
  }
  revealRequested = false;
  sequence = 0;
  signature = "";
  root = null;
  renderedEmpty = false;
  available = [];
  cancelResize = null;
  hoverTimers = null;
  disposeInteraction = null;
  reveal() {
    this.revealRequested = true;
    this.root?.addClass("is-revealed");
  }
  close() {
    this.sequence++;
    this.disposeInteraction?.();
    this.disposeInteraction = null;
    this.clearRevealTimer();
    this.hoverTimers = null;
    this.cancelResize?.();
    this.cancelResize = null;
    this.root?.remove();
    this.root = null;
    this.renderedEmpty = false;
    this.available = [];
    if (this.source.containerEl.hasClass("nis-stage-host")) this.source.containerEl.removeClass("nis-stage-host");
    this.signature = "";
  }
  clearRevealTimer() {
    this.hoverTimers?.clear();
  }
  setWidth(width) {
    this.root?.style.setProperty("--nis-stage-width", `${width}px`);
    const handle = this.root?.querySelector(".nis-stage-resize");
    handle?.setAttribute("aria-valuenow", String(width));
  }
  async refresh() {
    const source = this.source;
    const file = source.file;
    if (!file || !source.containerEl.isConnected || this.plugin.app.vault.getAbstractFileByPath(file.path) !== file) {
      this.close();
      return;
    }
    const seq = ++this.sequence;
    const text = source.getMode() === "source" ? source.editor.getValue() : await this.plugin.app.vault.cachedRead(file);
    if (seq !== this.sequence || source.file !== file || !source.containerEl.isConnected) return;
    const sig = file.path + "\n" + text + "\n" + this.plugin.getMode();
    if (sig === this.signature && canReuseStageRender(this.root, source.containerEl, this.renderedEmpty)) {
      if (this.plugin.source === source) this.plugin.galleryImages = this.available;
      return;
    }
    this.signature = sig;
    const items = extractImages(text).map((ref) => {
      let target = ref.target;
      let local = null;
      let src = "";
      if (/^https?:\/\//i.test(target) || /^data:image\//i.test(target)) src = target;
      else {
        try {
          target = decodeURIComponent(target);
        } catch {
        }
        target = target.replace(/\\([ ()\[\]])/g, "$1");
        local = this.plugin.app.metadataCache.getFirstLinkpathDest(target.split("#")[0], file.path);
        if (local) src = this.plugin.app.vault.getResourcePath(local);
      }
      return { ...ref, alt: ref.alt.replace(/\|\d+(?:x\d+)?$/, ""), src, local };
    });
    const available = this.available = items.filter((i) => i.src);
    this.renderedEmpty = !items.length;
    if (this.plugin.source === source) this.plugin.galleryImages = available;
    this.disposeInteraction?.();
    this.disposeInteraction = null;
    this.clearRevealTimer();
    this.cancelResize?.();
    this.cancelResize = null;
    this.root?.remove();
    if (!items.length) {
      this.root = null;
      if (source.containerEl.hasClass("nis-stage-host")) source.containerEl.removeClass("nis-stage-host");
      return;
    }
    source.containerEl.addClass("nis-stage-host");
    const root = this.root = source.containerEl.createDiv({ cls: "nis-stage", attr: { "data-mode": this.plugin.getMode(), "aria-label": "\u6587\u7AE0\u56FE\u7247\u53F0\u524D\u5BFC\u822A" } });
    if (this.revealRequested) root.addClass("is-revealed");
    root.style.setProperty("--nis-stage-width", `${this.plugin.getWidth()}px`);
    const doc = root.ownerDocument, win = doc.defaultView;
    this.hoverTimers = new PaneTimers(win);
    const mobile = import_obsidian3.Platform.isMobile;
    const reveal = () => {
      this.revealRequested = true;
      this.clearRevealTimer();
      root.addClass("is-revealed");
    };
    const dismiss = () => {
      this.revealRequested = false;
      this.clearRevealTimer();
      this.cancelResize?.();
      root.removeClass("is-expanded", "is-revealed", "is-resizing");
      const active = doc.activeElement;
      if (active instanceof win.HTMLElement && root.contains(active)) active.blur();
    };
    const scheduleDismiss = () => {
      if (mobile) return;
      if (this.hoverTimers?.has("dismiss") || root.hasClass("is-resizing") || !root.hasClass("is-revealed")) return;
      this.hoverTimers?.schedule("dismiss", dismiss, 180);
    };
    root.addEventListener("pointerenter", () => {
      if (root.hasClass("is-revealed")) this.clearRevealTimer();
    });
    root.addEventListener("pointerleave", scheduleDismiss);
    root.addEventListener("focusin", (event) => {
      if (event.target.matches(":focus-visible")) reveal();
    });
    root.addEventListener("focusout", (event) => {
      if (!event.relatedTarget || !root.contains(event.relatedTarget)) scheduleDismiss();
    });
    const hotzone = root.createDiv({ cls: "nis-stage-hotzone", attr: { tabindex: "0", role: "button", "aria-label": "\u663E\u793A\u6587\u7AE0\u56FE\u7247\u5BFC\u822A" } });
    hotzone.addEventListener("pointerenter", () => {
      if (mobile) return;
      this.clearRevealTimer();
      this.hoverTimers?.schedule("edge", reveal, 120);
    });
    hotzone.addEventListener("pointerleave", () => this.hoverTimers?.cancel("edge"));
    hotzone.addEventListener("click", reveal);
    hotzone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        reveal();
      }
    });
    const outsideDown = (event) => {
      if (mobile) return;
      const target = event.target;
      const control = target.closest?.(".nis-stage-card,.nis-stage-resize,.nis-stage-hotzone");
      if (!control || !root.contains(control)) dismiss();
    };
    const outsideMove = (event) => {
      if (mobile) return;
      const target = event.target;
      if (target.closest?.(".collapse-indicator,.cm-fold-indicator,.cm-gutterElement,.heading-collapse-indicator")) {
        dismiss();
        return;
      }
      if (!root.hasClass("is-revealed") || root.hasClass("is-resizing")) return;
      const r = root.getBoundingClientRect();
      if (event.clientX < r.left - 10 || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) scheduleDismiss();
    };
    const escape = (event) => {
      if (event.key === "Escape") dismiss();
    };
    const visibility = () => {
      if (!mobile && doc.hidden) dismiss();
    };
    const transientLayout = () => {
      if (!mobile) dismiss();
    };
    const disposeMobileDismiss = mobile ? attachMobileStageDismiss(root, dismiss) : () => {
    };
    doc.addEventListener("pointerdown", outsideDown, true);
    doc.addEventListener("pointermove", outsideMove, true);
    doc.addEventListener("keydown", escape, true);
    doc.addEventListener("visibilitychange", visibility);
    win.addEventListener("blur", transientLayout);
    win.addEventListener("resize", transientLayout);
    let paneRect = source.containerEl.getBoundingClientRect();
    let paneFrame = 0;
    const paneObserver = new win.ResizeObserver(() => {
      const next = source.containerEl.getBoundingClientRect();
      if ((Math.abs(next.width - paneRect.width) > 1 || Math.abs(next.height - paneRect.height) > 1) && !paneFrame) {
        paneFrame = win.requestAnimationFrame(() => {
          paneFrame = 0;
          if (this.root === root && !mobile) dismiss();
        });
      }
      paneRect = next;
    });
    paneObserver.observe(source.containerEl);
    this.disposeInteraction = () => {
      disposeMobileDismiss();
      paneObserver.disconnect();
      if (paneFrame) {
        win.cancelAnimationFrame(paneFrame);
        paneFrame = 0;
      }
      doc.removeEventListener("pointerdown", outsideDown, true);
      doc.removeEventListener("pointermove", outsideMove, true);
      doc.removeEventListener("keydown", escape, true);
      doc.removeEventListener("visibilitychange", visibility);
      win.removeEventListener("blur", transientLayout);
      win.removeEventListener("resize", transientLayout);
    };
    const handle = root.createDiv({ cls: "nis-stage-resize", attr: { role: "slider", tabindex: "0", "aria-label": "\u8C03\u6574\u56FE\u7247\u5BFC\u822A\u5BBD\u5EA6", "aria-valuemin": "120", "aria-valuemax": "320", "aria-valuenow": String(this.plugin.getWidth()), "aria-orientation": "horizontal", title: "\u5DE6\u53F3\u62D6\u52A8\u8C03\u6574\u5927\u5C0F" } });
    let drag = null;
    this.cancelResize = () => {
      if (!drag) return;
      const { id, width } = drag;
      drag = null;
      this.setWidth(width);
      root.removeClass("is-resizing");
      if (handle.hasPointerCapture(id)) handle.releasePointerCapture(id);
    };
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      drag = { id: event.pointerId, x: event.clientX, width: this.plugin.getWidth(), current: this.plugin.getWidth() };
      root.addClass("is-resizing");
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      drag.current = Math.max(120, Math.min(320, Math.round(drag.width + event.clientX - drag.x)));
      this.setWidth(drag.current);
    });
    const finish = (event, cancel) => {
      if (!drag || event.pointerId !== drag.id) return;
      const current = drag.current, initial = drag.width;
      drag = null;
      root.removeClass("is-resizing");
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      if (cancel) this.setWidth(initial);
      else void this.plugin.setWidth(current);
    };
    handle.addEventListener("pointerup", (event) => finish(event, false));
    handle.addEventListener("pointercancel", (event) => finish(event, true));
    handle.addEventListener("lostpointercapture", () => {
      if (drag) {
        this.setWidth(drag.width);
        drag = null;
        root.removeClass("is-resizing");
      }
    });
    handle.addEventListener("keydown", (event) => {
      const delta = event.key === "ArrowRight" ? 10 : event.key === "ArrowLeft" ? -10 : 0;
      if (delta || event.key === "Home" || event.key === "End") {
        event.preventDefault();
        event.stopPropagation();
        void this.plugin.setWidth(event.key === "Home" ? 120 : event.key === "End" ? 320 : this.plugin.getWidth() + delta);
      }
    });
    const header = root.createDiv("nis-stage-header");
    header.createSpan({ text: "\u56FE\u7247" });
    const close = header.createEl("button", { text: "\xD7", attr: { type: "button", "aria-label": "\u6536\u8D77\u56FE\u7247\u5BFC\u822A", title: "\u6536\u8D77\u56FE\u7247\u5BFC\u822A" } });
    close.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    });
    const list = root.createDiv("nis-stage-list");
    const makeBookend = (kind) => {
      const space = list.createDiv({ cls: `nis-stage-bookend nis-stage-bookend-${kind}`, attr: { "aria-hidden": "true" } });
      const design = space.createDiv("nis-stage-bookend-design");
      design.createSpan({ cls: "nis-stage-bookend-mark", text: "\xB7 \xB7 \xB7" });
      design.createSpan({ cls: "nis-stage-bookend-title", text: kind === "start" ? "\u4ECE\u8FD9\u91CC\uFF0C\u8BFB\u89C1\u66F4\u591A" : "\u8BFB\u5230\u8FD9\u91CC\uFF0C\u6E10\u89C1\u5168\u8C8C" });
      appendPixelFlower(design);
      return space;
    };
    const startSpace = makeBookend("start");
    let endSpace = null;
    const updateSpaces = () => {
      const height = `${Math.max(0, list.clientHeight / 2)}px`;
      if (startSpace.style.height !== height) startSpace.style.height = height;
      if (endSpace && endSpace.style.height !== height) endSpace.style.height = height;
    };
    let followTimer = null, manualUntil = 0, resumeTimer = null;
    const follow = () => {
      followTimer = null;
      if (this.root !== root) return;
      updateSpaces();
      const cm = source.editor.cm;
      let line;
      if (source.getMode() === "source" && cm?.state) {
        const scroller = cm.scrollDOM ?? source.containerEl.querySelector(".cm-scroller");
        if (scroller) {
          const r2 = scroller.getBoundingClientRect();
          const pos = cm.posAtCoords?.({ x: r2.left + r2.width * 0.5, y: r2.top + Math.min(r2.height * 0.3, 180) }) ?? cm.viewport?.from;
          if (typeof pos === "number") line = cm.state.doc.lineAt(pos).number - 1;
        }
      } else {
        const preview = source.previewMode;
        const viewport = source.containerEl.querySelector(".markdown-preview-view");
        if (viewport) {
          const r2 = viewport.getBoundingClientRect(), anchor = r2.top + Math.min(r2.height * 0.3, 180);
          const section = preview?.renderer?.sections?.find((s) => {
            if (!s.el.isConnected) return false;
            const box = s.el.getBoundingClientRect();
            return box.height > 0 && box.top <= anchor && box.bottom >= anchor;
          });
          if (section) {
            const box = section.el.getBoundingClientRect();
            line = section.start.line + Math.max(0, Math.min(1, (anchor - box.top) / box.height)) * (section.end.line - section.start.line);
          }
        }
        if (line === void 0) {
          const scroll = preview?.getScroll?.();
          if (typeof scroll === "number") line = scroll;
        }
      }
      const body = source.getMode() === "source" ? cm?.scrollDOM ?? source.containerEl.querySelector(".cm-scroller") : source.containerEl.querySelector(".markdown-preview-view");
      const candidates = [];
      let visibleIndex = -1;
      if (body) {
        const viewport = body.getBoundingClientRect();
        for (const img of Array.from(body.querySelectorAll("img"))) {
          if (root.contains(img)) continue;
          const box = img.getBoundingClientRect();
          if (box.width < 8 || box.height < 1 || box.bottom <= viewport.top || box.top >= viewport.bottom || box.right <= viewport.left || box.left >= viewport.right) continue;
          const matches = items.map((item, index2) => ({ item, index: index2 })).filter(({ item }) => {
            if (!item.src) return false;
            try {
              return new URL(item.src, doc.baseURI).href === img.src;
            } catch {
              return item.src === img.src;
            }
          });
          if (!matches.length) continue;
          let imageLine = line;
          if (source.getMode() === "source" && cm?.posAtDOM && cm.state) {
            try {
              imageLine = cm.state.doc.lineAt(cm.posAtDOM(img, 0)).number - 1;
            } catch {
            }
          } else {
            const renderer = source.previewMode?.renderer;
            try {
              imageLine = renderer?.getSectionInfo?.(img)?.lineStart ?? line;
            } catch {
            }
          }
          const match = matches.sort((a, b) => Math.abs(a.item.line - (imageLine ?? a.item.line)) - Math.abs(b.item.line - (imageLine ?? b.item.line)))[0];
          candidates.push({ index: match.index, top: box.top, bottom: box.bottom });
        }
        visibleIndex = pickVisibleImage(candidates, { top: Math.max(0, viewport.top), bottom: Math.min(win.innerHeight, viewport.bottom) });
      }
      const index = visibleIndex >= 0 ? visibleIndex : line === void 0 ? -1 : pickImageAtLine(items.map((i) => i.line), line);
      if (index < 0) return;
      const cards = list.querySelectorAll(".nis-stage-card");
      const card = cards[index];
      if (!card) return;
      cards.forEach((c2, i) => {
        c2.toggleClass("is-current", i === index);
        if (i === index) c2.setAttribute("aria-current", "true");
        else c2.removeAttribute("aria-current");
      });
      if (Date.now() < manualUntil || root.hasClass("is-resizing")) return;
      const image = card.querySelector("img"), c = (image ?? card).getBoundingClientRect(), r = list.getBoundingClientRect();
      const top = Math.max(0, list.scrollTop + (c.top + c.bottom) / 2 - (r.top + r.bottom) / 2);
      if (Math.abs(top - list.scrollTop) > 2) {
        const reducedMotion = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
        list.scrollTo({ top, behavior: reducedMotion || root.matches(":hover") || win.getComputedStyle(list).visibility === "hidden" ? "auto" : "smooth" });
      }
    };
    const queueFollow = () => {
      if (followTimer !== null) return;
      followTimer = win.setTimeout(follow, 80);
    };
    const pauseFollow = () => {
      manualUntil = Date.now() + 2500;
      if (resumeTimer !== null) win.clearTimeout(resumeTimer);
      resumeTimer = win.setTimeout(queueFollow, 2500);
    };
    root.addEventListener("wheel", pauseFollow, { passive: true });
    root.addEventListener("pointerdown", pauseFollow);
    const contentScroll = (event) => {
      if (event.target instanceof win.Node && root.contains(event.target)) return;
      queueFollow();
    };
    source.containerEl.addEventListener("scroll", contentScroll, true);
    source.containerEl.addEventListener("load", contentScroll, true);
    source.containerEl.addEventListener("keyup", queueFollow);
    const observer = new win.MutationObserver((records) => {
      if (this.root === root && !isStageRootMounted(root, source.containerEl)) {
        this.plugin.recoverStage(source);
        return;
      }
      if (records.some((r) => !root.contains(r.target))) queueFollow();
    });
    observer.observe(source.containerEl, { childList: true, subtree: true });
    const sizeObserver = new win.ResizeObserver(queueFollow);
    sizeObserver.observe(list);
    const disposePrevious = this.disposeInteraction;
    this.disposeInteraction = () => {
      disposePrevious?.();
      observer.disconnect();
      sizeObserver.disconnect();
      source.containerEl.removeEventListener("scroll", contentScroll, true);
      source.containerEl.removeEventListener("load", contentScroll, true);
      source.containerEl.removeEventListener("keyup", queueFollow);
      if (followTimer !== null) win.clearTimeout(followTimer);
      if (resumeTimer !== null) win.clearTimeout(resumeTimer);
    };
    queueFollow();
    items.forEach((item, index) => {
      const card = list.createDiv({ cls: "nis-stage-card", attr: { "data-source-line": String(item.line), "data-source-index": String(index), "data-source-offset": String(item.offset) } });
      const button = card.createEl("button", { cls: "nis-image-button", attr: { "aria-label": `${mobile ? "\u5B9A\u4F4D\u56FE\u7247" : "\u653E\u5927\u56FE\u7247"} ${index + 1}\uFF1A${item.alt || item.target}` } });
      if (item.src) {
        const img = button.createEl("img", { attr: { "data-nis-index": String(available.indexOf(item)), src: item.src, alt: item.alt, loading: "lazy", decoding: "async" } });
        img.addEventListener("load", queueFollow);
        sizeObserver.observe(img);
        img.addEventListener("error", () => {
          img.hidden = true;
          button.createSpan({ cls: "nis-error", text: "\u52A0\u8F7D\u5931\u8D25" });
        });
      } else button.createSpan({ cls: "nis-error", text: "\u8DEF\u5F84\u5F85\u89E3\u6790" });
      const caption = card.createDiv("nis-caption");
      caption.createSpan({ text: `${index + 1}. ${(item.alt || item.local?.basename || "\u56FE\u7247").replace(/\|\d+(?:x\d+)?$/, "")}` });
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        list.querySelectorAll(".is-selected").forEach((c) => c.removeClass("is-selected"));
        card.addClass("is-selected");
        if (mobile) {
          void this.plugin.jump(file, item, source);
          return;
        }
        const selected = available.indexOf(item);
        if (selected >= 0) this.plugin.preview(available, selected, button.querySelector("img") ?? void 0, source);
      });
      if (mobile) {
        const zoom = caption.createEl("button", { text: "\u2197", cls: "nis-stage-zoom", attr: { type: "button", "aria-label": `\u653E\u5927\u56FE\u7247 ${index + 1}`, title: "\u653E\u5927\u56FE\u7247" } });
        zoom.disabled = !item.src;
        zoom.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const selected = available.indexOf(item);
          if (selected >= 0) this.plugin.preview(available, selected, button.querySelector("img") ?? void 0, source);
        });
      }
      card.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const menu = new import_obsidian3.Menu();
        menu.addItem((m) => m.setTitle("\u8DF3\u8F6C\u5230\u56FE\u7247\u4F4D\u7F6E").setIcon("locate").onClick(() => void this.plugin.jump(file, item, source)));
        menu.addItem((m) => m.setTitle("\u653E\u5927\u663E\u793A").setIcon("zoom-in").setDisabled(!item.src).onClick(() => {
          const available2 = items.filter((i) => i.src);
          this.plugin.preview(available2, available2.indexOf(item), button.querySelector("img") ?? void 0, source);
        }));
        menu.showAtMouseEvent(event);
      });
    });
    endSpace = makeBookend("end");
    updateSpaces();
  }
};

})(addonModule,addonModule.exports);
module.exports=class ImageToolkitWithStage extends OriginalToolkit {
imageLayoutDocuments=new Set();
ensureImageContainer(origin){
const existing=this.containerFactory.getContainer(origin);if(existing)return existing;
const body=origin?.ownerDocument?.body;if(!body?.classList.contains('is-popout-window'))return null;
const mode=this.getViewMode();
const container=mode===ViewMode.Normal ? new NormalContainerView(this) : mode===ViewMode.Pin ? new PinContainerView(this) : null;
if(!container)return null;
const eventId=body.getAttribute(ImageToolkitPlugin.POPOUT_WINDOW_EVENT)||crypto.randomUUID();
this.containerFactory.setPopoutContainer(eventId,container);body.setAttribute(ImageToolkitPlugin.POPOUT_WINDOW_EVENT,eventId);
this.imageLayoutDocuments.add(body.ownerDocument);this.refreshViewTrigger(body.ownerDocument);
return container;
}
async onload(){
await super.onload();
this.register(()=>{for(const doc of this.imageLayoutDocuments){doc.off('click',this.imgSelector,this.clickImage);doc.off('mouseover',this.imgSelector,this.mouseoverImg);doc.off('mouseout',this.imgSelector,this.mouseoutImg);}this.imageLayoutDocuments.clear();});
this.noteImageStage=new addonModule.exports.default(this.app,this.manifest);
this.noteImageStage.host=this;
this.addChild(this.noteImageStage);
}
};
})();
