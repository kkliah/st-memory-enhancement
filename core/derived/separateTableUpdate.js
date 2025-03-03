import { DERIVED, EDITOR, SYSTEM } from '../manager.js';
import {refreshTableActions} from "./absoluteRefresh.js";

let toBeExecuted = [];

/**
 * 初始化两步总结所需的数据
 * @param chat
 * */
function InitChatForTableTwoStepSummary(chat) {
    // 如果currentChat.uid未定义，则初始化为随机字符串
    if (chat.uid === undefined) {
        chat.uid = SYSTEM.generateRandomString();
    }
    // 如果currentChat.uid_that_references_table_step_update未定义，则初始化为{}
    if (chat.two_step_links === undefined) {
        chat.two_step_links = {};
    }
    // 如果currentChat.uid_that_references_table_step_update未定义，则初始化为{}
    if (chat.two_step_waiting === undefined) {
        chat.two_step_waiting = {};
    }
}

/**
 * 获取当前滑动对话的唯一标识符
 * @param chat
 * @returns {string}
 */
function getSwipeUid(chat) {
    // 初始化chat
    InitChatForTableTwoStepSummary(chat);
    // 获取当前swipe的唯一标识符
    const swipeUid = `${chat.uid}_${chat.swipe_id}`;
    // 检查当前swipe是否已经存在必要的数据结构
    if (!(swipeUid in chat.two_step_links)) chat.two_step_links[swipeUid] = [];
    if (!(swipeUid in chat.two_step_waiting)) chat.two_step_waiting[swipeUid] = true;
    return swipeUid;
}

/**
 * 检查当前chat是否已经被父级chat执行过
 * @param chat
 * @param targetSwipeUid
 * @returns {*}
 */
function checkIfChatIsExecuted(chat, targetSwipeUid) {
    const chatSwipeUid = getSwipeUid(chat); // 获取当前chat的唯一标识符
    const chatExecutedSwipes = chat.two_step_links[chatSwipeUid]; // 获取当前chat已经执行过的父级chat
    return chatExecutedSwipes.includes(targetSwipeUid);   // 检查当前chat是否已经被目标chat执行过
}

/**
 * 处理对话中的标识符
 * @param string
 * @returns {string}
 */
function handleMessages(string) {
    let r = string.replace(/<(tableEdit|think|thinking)>[\s\S]*?<\/\1>/g, '');

    return r;
}

function MarkChatAsWaiting(chat, swipeUid) {
    chat.two_step_waiting[swipeUid] = true;
    return false;
}

/**
 * 获取未执行的两步总结
 * @returns {string}
 * @param parentSwipeUid
 */
function GetUnexecutedMarkChats(parentSwipeUid) {
    const chats = EDITOR.getContext().chat;
    let r = '';
    let lastChat = null;
    let cacheChat = null;
    let round = 0;

    for (let i = chats.length - 1; i >= 0; i--) {
        const chat = chats[i];
        if (chat.is_user === true) continue; // 如果节点类型是用户对话，则跳过
        lastChat = cacheChat;
        cacheChat = chat;
        round++;

        // 如果当前对话已经被执行过，则跳过
        const iSwipeUid = getSwipeUid(chat);
        const isExecutedBySelf = checkIfChatIsExecuted(chat, iSwipeUid);
        if (isExecutedBySelf) break;
        const isExecutedByParent = checkIfChatIsExecuted(chat, parentSwipeUid);
        if (isExecutedByParent) break;

        // 如果对话长度未达到阈值，则直接继续往前找
        if (r.length < EDITOR.data.step_by_step_threshold) continue;

        // 如果对话长度达到阈值，则通过标识符判断是否需要继续往前找
        const lastChatSwipeUid = getSwipeUid(lastChat);
        const isWaiting = chat.two_step_waiting[iSwipeUid] === true;
        if (!isWaiting) break;
    }
    return r;
}

/**
 * 执行两步总结
 * */
export async function TableTwoStepSummary() {
    if (EDITOR.data.isExtensionAble === false || EDITOR.data.step_by_step === false) return

    // 获取当前对话
    const chats = EDITOR.getContext().chat;
    const currentChat = chats[chats.length - 1];
    if (currentChat.is_user === true) return;

    const swipeUid = getSwipeUid(currentChat);
    if (currentChat.mes.length < 10) {
        console.log('当前对话长度过短, 跳过执行分步总结: ', currentChat.mes);
        MarkChatAsWaiting(currentChat, swipeUid);
        return;
    }

    // 如果不开启多轮累计
    if (EDITOR.data.sum_multiple_rounds === false) {
        // 如果当前对话长度未达到阈值，则跳过，待出现能够执行的对话时再一起执行
        if (currentChat.mes.length < EDITOR.data.step_by_step_threshold) {
            console.log('当前对话长度未达到阈值, 跳过执行分步总结: ', currentChat.mes);
            MarkChatAsWaiting(currentChat, swipeUid);
            return;
        }
    }

    // 往前找到所有未执行的两步总结，如果没有，则跳过
    toBeExecuted = [];
    GetUnexecutedMarkChats(swipeUid);
    if (toBeExecuted.length === 0) {
        console.log('未找到需要执行的两步总结: ', currentChat.mes);
        MarkChatAsWaiting(currentChat, swipeUid);
        return;
    }

    // 获取需要执行的两步总结
    let todoChats = '';
    toBeExecuted.forEach(chat => {
        todoChats += handleMessages(chat.mes);
    })

    if (todoChats.length < EDITOR.data.step_by_step_threshold) {
        currentChat.two_step_waiting[swipeUid] = true;
        console.log('需要执行两步总结的对话长度未达到阈值: ', `(${todoChats.length}) `, toBeExecuted);
        MarkChatAsWaiting(currentChat, swipeUid);
        return;
    }

    // 执行两步总结
    console.log('执行两步总结: ', `(${todoChats.length}) `, toBeExecuted);
    await refreshTableActions(true, true, todoChats);

    // 标记已执行的两步总结
    toBeExecuted.forEach(chat => {
        const chatSwipeUid = getSwipeUid(chat);
        chat.two_step_links[chatSwipeUid].push(swipeUid);
    })
}
