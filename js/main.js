import { initializeUI, switchChatUI, addMessageToUI, updateSettingsUI, updateUploadedFilesUI } from './ui.js';
import { callAIApi } from './api.js';
import { saveChatData, loadChatData, deleteChatData } from './storage.js';
import { generateUniqueId } from './utils.js';
// 导入 updateChatListUI 函数
import { updateChatListUI } from './ui.js'; // 导入 ui.js 中的 updateChatListUI

// 全局状态管理（简化起见，可以使用更高级的状态管理库如 Vuex, React Context/Redux 在更复杂的应用中）
let currentChatId = null;
let chats = {}; // { chatId: { name: '', messages: [], systemPrompt: '', model: '', uploadedFiles: [] } } // 添加 name 属性

document.addEventListener('DOMContentLoaded', () => {
    // 1. 加载保存的聊天数据
    chats = loadChatData();
    if (Object.keys(chats).length === 0) {
        // 如果没有保存的数据，创建一个新的默认聊天
        createNewChat(); // createNewChat 会处理命名和切换
    } else {
        // 加载第一个聊天会话并显示
        // 尝试加载当前会话，如果不存在则加载第一个
        const savedCurrentChatId = localStorage.getItem('currentChatId');
        if (savedCurrentChatId && chats[savedCurrentChatId]) {
             switchChat(savedCurrentChatId);
        } else {
             const firstChatId = Object.keys(chats)[0];
             switchChat(firstChatId);
        }
        // 初始化侧边栏列表
        updateChatListUI(chats, currentChatId); // 初始化时调用 updateChatListUI
    }

    // 2. 初始化 UI 事件监听
    initializeUI(); // 绑定发送按钮、文件上传等事件

    // 3. 绑定新建聊天按钮事件
    document.getElementById('new-chat-btn').addEventListener('click', createNewChat);
	console.log('Binding new chat button event');

    // 4. 绑定侧边栏聊天列表点击事件 (通过事件委托)
    document.getElementById('chat-list').addEventListener('click', (event) => {
        const target = event.target;
        // 查找最近的包含 data-chat-id 属性的 li 元素
        const listItem = target.closest('li[data-chat-id]');
        if (listItem) {
            const chatId = listItem.dataset.chatId;
            // 检查点击是否在删除按钮上
            if (target.classList.contains('delete-chat')) {
                 deleteChat(chatId);
            } else if (chatId && chatId !== currentChatId) {
                // 如果不是删除按钮且点击的是有效的列表项，则切换聊天
                switchChat(chatId);
            }
        }
    });

    // 5. 绑定设置区域（模型选择和系统提示词）的 change 事件
    document.getElementById('model-select').addEventListener('change', (event) => {
        if (currentChatId && chats[currentChatId]) {
            chats[currentChatId].model = event.target.value;
            saveChatData(chats);
        }
    });

    document.getElementById('system-prompt').addEventListener('input', (event) => {
         if (currentChatId && chats[currentChatId]) {
            chats[currentChatId].systemPrompt = event.target.value;
            saveChatData(chats);
        }
    });

});

// ---- 核心功能函数 ----

/**
 * 创建新的聊天会话
 */
function createNewChat() {
    const newChatId = generateUniqueId();

    // ** 添加获取用户输入名称的逻辑 **
    let chatName = prompt("请输入新聊天的名称:");
    // 如果用户取消输入或输入空名称，可以使用一个默认名称
    if (chatName === null || chatName.trim() === "") { // prompt取消返回null
        chatName = "新聊天"; // 默认名称
    }
    // ** 获取名称逻辑结束 **

    // 2. 创建新的聊天数据结构并添加到 chats 对象中
    chats[newChatId] = {
        name: chatName, // ** 将名称存储到聊天数据中 **
        messages: [],
        systemPrompt: '', // 默认系统提示词为空
        model: 'model-a', // 默认模型
        uploadedFiles: [] // 存储已上传文件的信息
    };

    // 3. 更新 currentChatId 并保存到 localStorage
    currentChatId = newChatId;
    localStorage.setItem('currentChatId', currentChatId);
    saveChatData(chats); // 保存到 localStorage

    // 4. 切换到新创建的会话
    switchChat(newChatId);

    // 5. 更新侧边栏列表 UI
    // switchChat 内部会调用 updateChatListUI，这里可以省略一次，
    // 但为了确保逻辑清晰，也可以再次调用。
    // updateChatListUI(chats, currentChatId); // 可以选择在这里或 switchChat 中调用

    console.log(`Created new chat with ID: ${newChatId} and name: "${chatName}"`);
}

/**
 * 切换到指定的聊天会话
 * @param {string} chatId - 要切换到的聊天会话 ID
 */
function switchChat(chatId) {
    if (!chats[chatId]) {
        console.error("Chat ID not found:", chatId);
        return;
    }
    currentChatId = chatId;
    const currentChat = chats[currentChatId];

    // 保存当前的 currentChatId 到 localStorage
    localStorage.setItem('currentChatId', currentChatId);


    // 更新 UI 显示当前聊天内容和设置
    switchChatUI(currentChatId); // 切换到对应的聊天框UI（如果UI有区分不同聊天框的话）
    updateSettingsUI(currentChat.model || 'model-a', currentChat.systemPrompt || ''); // 更新设置区域，提供默认值
    renderMessages(currentChat.messages); // 渲染当前聊天会话的消息
    updateUploadedFilesUI(currentChat.uploadedFiles); // 更新文件列表UI

    // 突出显示侧边栏中的当前聊天会话
    updateChatListUI(chats, currentChatId); // 每次切换后更新侧边栏列表，确保高亮状态正确
}

/**
 * 删除指定的聊天会话
 * @param {string} chatId - 要删除的聊天会话 ID
 */
function deleteChat(chatId) {
     if (!chats[chatId]) {
        console.error("Chat ID not found:", chatId);
        return;
    }

    // 确认删除
    // 使用原生的 confirm 弹窗，或者在 ui.js 中实现更友好的模态框
    if (!confirm(`确定要删除聊天 "${chats[chatId].name || '未命名聊天'}" 吗？`)) {
        return;
    }

    delete chats[chatId];
    saveChatData(chats); // 从 Local Storage 保存更新后的数据

    // 如果删除了当前聊天，则切换到第一个聊天（如果存在）或创建一个新的
    if (currentChatId === chatId) {
        const chatIds = Object.keys(chats);
        if (chatIds.length > 0) {
            switchChat(chatIds[0]);
        } else {
            createNewChat(); // 没有其他聊天了，创建一个新的
        }
    } else {
        // 如果删除的不是当前聊天，只更新侧边栏列表
        updateChatListUI(chats, currentChatId); // 删除后更新侧边栏列表
    }
}


/**
 * 发送消息（用户输入）
 */
async function sendMessage() {
    const userInputElement = document.getElementById('user-input');
    const messageContent = userInputElement.value.trim();
    // 获取当前会话的已上传文件，注意这里直接操作 chats 对象
    const uploadedFiles = chats[currentChatId]?.uploadedFiles || [];

    if (!messageContent && uploadedFiles.length === 0) {
        return; // 没有内容和文件，不发送
    }

    const currentChat = chats[currentChatId];
    if (!currentChat) {
         console.error("No current chat selected.");
         return;
    }

    // 1. 添加用户消息到 UI 和数据
    const userMessage = {
        sender: 'user',
        content: messageContent,
        files: uploadedFiles.map(file => ({ name: file.name, type: file.type })) // 只保存文件信息
    };
    currentChat.messages.push(userMessage);
    addMessageToUI(userMessage, true); // true 表示滚动到底部

    // 清空输入框和文件列表 UI 和数据
    userInputElement.value = '';
    currentChat.uploadedFiles = []; // 清空当前会话的已上传文件数据
    updateUploadedFilesUI([]); // 更新 UI

    // 2. 调用 AI API 获取回复
    // TODO: 这里你需要实现将文件内容也发送给API的逻辑，具体取决于你使用的API
    // 例如，可能需要先读取文件内容，或者将文件上传到其他地方获取链接
    const apiResponse = await callAIApi(messageContent, currentChat.systemPrompt, currentChat.model, uploadedFiles);

    // 3. 处理 AI 回复
    const aiMessage = {
        sender: 'ai',
        content: apiResponse.text // 假设 API 返回的回复文本在 apiResponse.text 中
        // 可以根据 API 响应添加其他信息，如图片等
    };
    currentChat.messages.push(aiMessage);
    addMessageToUI(aiMessage, true); // true 表示滚动到底部

    // 4. 保存聊天数据到 Local Storage
    saveChatData(chats);
}

/**
 * 渲染指定聊天会话的消息列表到 UI
 * @param {Array} messages - 消息数组
 */
function renderMessages(messages) {
    const messagesListElement = document.getElementById('messages-list');
    messagesListElement.innerHTML = ''; // 清空当前消息列表

    messages.forEach(message => {
        addMessageToUI(message, false); // false 表示不滚动，只在加载时渲染
    });

    // 滚动到最底部
    messagesListElement.scrollTop = messagesListElement.scrollHeight;
}

// 这个函数将被移动到 ui.js 中，并在 main.js 中导入使用
// /**
//  * 更新侧边栏聊天列表 UI
//  */
// function updateChatListUI() {
//     const chatListElement = document.getElementById('chat-list');
//     chatListElement.innerHTML = ''; // 清空当前列表

//     const chatIds = Object.keys(chats);
//     chatIds.forEach(chatId => {
//         const listItemTemplate = document.getElementById('chat-list-item-template');
//         const listItem = listItemTemplate.content.cloneNode(true).querySelector('li');

//         listItem.dataset.chatId = chatId;
//         // 显示聊天会话的标题，可以使用存储的 name 属性
//         const chatTitle = chats[chatId].name || // 使用存储的 name 属性
//                           (chats[chatId].messages.length > 0
//                             ? chats[chatId].messages[0].content.substring(0, 20) + '...'
//                             : `新聊天 (${chatId.substring(0, 4)})`); // 如果没有 name 且没有消息，使用默认生成方式

//         listItem.querySelector('span').textContent = chatTitle;

//         if (chatId === currentChatId) {
//             listItem.classList.add('active');
//         }

//         chatListElement.appendChild(listItem);
//     });
// }


// 导出核心函数供其他模块使用
export { currentChatId, chats, sendMessage, renderMessages };
