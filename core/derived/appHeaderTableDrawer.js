import {DERIVED, EDITOR, SYSTEM, USER} from "../manager.js";
import {getTableView} from "./tableDataView.js";
import {getEditView} from "./tableEditView.js";

let tableDrawer = null;
let tableDrawerIcon = null;
let tableDrawerContent = null;
let appHeaderTableContainer = null;
let databaseButton = null;
let editorButton = null;
let settingButton = null;
let inlineDrawerHeaderContent = null;
let tableDrawerContentHeader = null;

let tableViewDom = null;
let tableEditDom = null;
let settingContainer = null;
const timeOut = 200; // 稍微增加 timeOut 以适应高度动画，可以根据效果调整

let isEventListenersBound = false; // 添加一个标志来跟踪事件监听器是否已绑定

/**
 * 初始化应用头部表格抽屉 (只调用一次)
 */
export async function initAppHeaderTableDrawer() {
    if (isEventListenersBound) {
        return; // 如果事件监听器已绑定，则直接返回，避免重复绑定
    }

    tableDrawer = $('#table_database_settings_drawer');
    tableDrawerIcon = $('#table_drawer_icon');
    tableDrawerContent = $('#table_drawer_content');
    appHeaderTableContainer = $('#app_header_table_container');
    databaseButton = $('#database_button');
    editorButton = $('#editor_button');
    settingButton = $('#setting_button');
    inlineDrawerHeaderContent = $('#inline_drawer_header_content');     // 获取插件设置中展开项的标题
    tableDrawerContentHeader = $('#table_drawer_content_header');       // 获取抽屉内容的标题

    // 替换logo_block中存在class为fa-panorama的子项，替换fa-panorama为fa-table
    $('.fa-panorama').removeClass('fa-panorama').addClass('fa-image');
    $('.fa-user-cog').removeClass('fa-user-cog').addClass('fa-user');

    // 获取表格视图、编辑视图和设置容器的内容
    if (tableViewDom === null) {
        tableViewDom = await getTableView(-1);
    }
    if (tableEditDom === null) {
        // 使用 jQuery 将 HTML 字符串转换为 jQuery 对象 (代表 DOM 元素)
        tableEditDom = $(`<div style=""></div>`);
        tableEditDom.append(await getEditView(-1));
    }
    if (settingContainer === null) {
        const header = $(`<div></div>`).append($(`<div style="margin: 10px 0;"></div>`).append(inlineDrawerHeaderContent));
        settingContainer = header.append($('.memory_enhancement_container').find('#memory_enhancement_settings_inline_drawer_content'));
    }

    // 创建容器 div 并将内容包裹起来，并赋予唯一的 ID，添加 overflow: hidden
    const databaseContentDiv = $(`<div id="database-content" style="width: 100%; height: 100%; overflow: hidden;"></div>`).append(tableViewDom);
    const editorContentDiv = $(`<div id="editor-content" style="width: 100%; height: 100%; display: none; overflow: hidden;"></div>`).append(tableEditDom); // 初始隐藏
    const settingContentDiv = $(`<div id="setting-content" style="width: 100%; height: 100%; display: none; overflow: hidden;"></div>`).append(settingContainer); // 初始隐藏

    // 将所有内容容器添加到 appHeaderTableContainer 中
    appHeaderTableContainer.append(databaseContentDiv);
    appHeaderTableContainer.append(editorContentDiv);
    appHeaderTableContainer.append(settingContentDiv);

    // 初始时显示数据库内容，隐藏编辑器和设置内容
    $('#database-content').show();
    $('#editor-content').hide();
    $('#setting-content').hide();


    // tableDrawerContentHeader.empty(); // 清空抽屉内容的标题
    // tableDrawerContentHeader.before(inlineDrawerHeaderContent);

    // 添加按钮点击事件监听器 (只绑定一次)
    databaseButton.on('click', function() {
        loadDatabaseContent();
    });

    editorButton.on('click', function() {
        loadEditorContent();
    });

    settingButton.on('click', function() {
        loadSettingContent();
    });

    isEventListenersBound = true; // 设置标志为已绑定
}


export async function openAppHeaderTableDrawer() {
    // 确保初始化函数已经被调用过 (虽然通常应该在应用启动时就调用)
    if (!isEventListenersBound) {
        await initAppHeaderTableDrawer();
    }

    if (tableDrawerIcon.hasClass('closedIcon')) {
        // 当前是关闭状态，需要打开抽屉，关闭其他已打开的抽屉
        $('.openDrawer').not('#table_drawer_content').not('.pinnedOpen').addClass('resizing').each((_, el) => {
            EDITOR.slideToggle(el, {
                ...EDITOR.getSlideToggleOptions(),
                onAnimationEnd: function (el) {
                    el.closest('.drawer-content').classList.remove('resizing');
                },
            });
        });
        $('.openIcon').not('#table_drawer_icon').not('.drawerPinnedOpen').toggleClass('closedIcon openIcon');
        $('.openDrawer').not('#table_drawer_content').not('.pinnedOpen').toggleClass('closedDrawer openDrawer');


        // 打开当前的抽屉
        tableDrawerIcon.toggleClass('closedIcon openIcon');
        tableDrawerContent.toggleClass('closedDrawer openDrawer');

        tableDrawerContent.addClass('resizing').each((_, el) => { // 添加 resizing 类，防止动画冲突
            EDITOR.slideToggle(el, {
                ...EDITOR.getSlideToggleOptions(),
                onAnimationEnd: function (el) {
                    el.closest('.drawer-content').classList.remove('resizing'); // 动画结束后移除 resizing 类
                },
            });
        });


    } else {
        // 当前是打开状态，需要关闭抽屉
        tableDrawerIcon.toggleClass('openIcon closedIcon');
        tableDrawerContent.toggleClass('openDrawer closedDrawer');

        tableDrawerContent.addClass('resizing').each((_, el) => {
            EDITOR.slideToggle(el, {
                ...EDITOR.getSlideToggleOptions(),
                onAnimationEnd: function (el) {
                    el.closest('.drawer-content').classList.remove('resizing');
                },
            });
        });
    }
}


// 定义加载不同内容的函数 (修改为同时执行展开和折叠)
async function loadDatabaseContent() {
    const currentContent = appHeaderTableContainer.children(':visible'); // 获取当前可见的内容
    const targetContent = $('#database-content');

    if (currentContent.length > 0) {
        currentContent.slideUp(timeOut).delay(timeOut).hide(0); // slideUp 当前内容并延迟隐藏
        targetContent.slideDown(timeOut); // 同时 slideDown 目标内容
    } else {
        targetContent.slideDown(timeOut); // 如果没有内容，直接 slideDown 目标内容
    }
}

async function loadEditorContent() {
    const currentContent = appHeaderTableContainer.children(':visible');
    const targetContent = $('#editor-content');

    if (currentContent.length > 0) {
        currentContent.slideUp(timeOut).delay(timeOut).hide(0); // slideUp 当前内容并延迟隐藏
        targetContent.slideDown(timeOut); // 同时 slideDown 目标内容
    } else {
        targetContent.slideDown(timeOut);
    }
}

async function loadSettingContent() {
    const currentContent = appHeaderTableContainer.children(':visible');
    const targetContent = $('#setting-content');

    if (currentContent.length > 0) {
        currentContent.slideUp(timeOut).delay(timeOut).hide(0); // slideUp 当前内容并延迟隐藏
        targetContent.slideDown(timeOut); // 同时 slideDown 目标内容
    } else {
        targetContent.slideDown(timeOut);
    }
}
