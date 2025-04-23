import { initializeUI, createNewChatUI, switchChatUI, addMessageToUI, updateSettingsUI, updateUploadedFilesUI } from './ui.js';
import { callAIApi } from './api.js';
import { saveChatData, loadChatData, deleteChatData } from './storage.js';
import { generateUniqueId } from './utils.js';

// 全局状态管理（简化起见，可以使用更高级的状态管理库如 Vuex, React Context/Redux 在更复杂的应用中）
let currentChatId = null;
let chats = {}; // { chatId: { messages: [], systemPrompt: '', model: '', uploadedFiles: [] } }

document.addEventListener('DOMContentLoaded', () => {
    // 1. 加载保存的聊天数据
    chats = loadChatData();
    if (Object.keys(chats).length === 0) {
        // 如果没有保存的数据，创建一个新的默认聊天
        createNewChat();
    } else {
        // 加载第一个聊天会话并显示
        const firstChatId = Object.keys(chats)[0];
        switchChat(firstChatId);
        // 初始化侧边栏列表
        updateChatListUI();
    }

    // 2. 初始化 UI 事件监听
    initializeUI(); // 绑定发送按钮、文件上传等事件

    // 3. 绑定新建聊天按钮事件
    document.getElementById('new-chat-btn').addEventListener('click', createNewChat);
	console.log('Binding new chat button event');

    // 4. 绑定侧边栏聊天列表点击事件 (通过事件委托)
    document.getElementById('chat-list').addEventListener('click', (event) => {
        const target = event.target;
        if (target.tagName === 'LI') {
            const chatId = target.dataset.chatId;
            if (chatId && chatId !== currentChatId) {
                switchChat(chatId);
            }
        } else if (target.classList.contains('delete-chat')) {
             const listItem = target.closest('li');
             if (listItem) {
                 const chatId = listItem.dataset.chatId;
                 if (chatId) {
                     deleteChat(chatId);
                 }
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
    chats[newChatId] = {
        messages: [],
        systemPrompt: '',
        model: 'model-a', // 默认模型
        uploadedFiles: [] // 存储已上传文件的信息
    };
    switchChat(newChatId);
    updateChatListUI();
    saveChatData(chats);
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

    // 更新 UI 显示当前聊天内容和设置
    switchChatUI(currentChatId); // 切换到对应的聊天框UI
    updateSettingsUI(currentChat.model, currentChat.systemPrompt); // 更新设置区域
    renderMessages(currentChat.messages); // 渲染当前聊天会话的消息
    updateUploadedFilesUI(currentChat.uploadedFiles); // 更新文件列表UI

    // 突出显示侧边栏中的当前聊天会话
    updateChatListUI();
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
    if (!confirm(`确定要删除聊天 "${chatId}" 吗？`)) { // 可以在UI.js中实现更友好的确认弹窗
        return;
    }

    delete chats[chatId];
    deleteChatData(chatId); // 从 Local Storage 删除

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
        updateChatListUI();
    }
}


/**
 * 发送消息（用户输入）
 */
async function sendMessage() {
    const userInputElement = document.getElementById('user-input');
    const messageContent = userInputElement.value.trim();
    const uploadedFiles = chats[currentChatId]?.uploadedFiles || []; // 获取当前会话的已上传文件

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

    // 清空输入框和文件列表
    userInputElement.value = '';
    currentChat.uploadedFiles = []; // 清空已上传文件列表
    updateUploadedFilesUI([]);

    // 2. 调用 AI API 获取回复
    // 这里你需要实现将文件内容也发送给API的逻辑，具体取决于你使用的API
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


/**
 * 更新侧边栏聊天列表 UI
 */
function updateChatListUI() {
    const chatListElement = document.getElementById('chat-list');
    chatListElement.innerHTML = ''; // 清空当前列表

    const chatIds = Object.keys(chats);
    chatIds.forEach(chatId => {
        const listItemTemplate = document.getElementById('chat-list-item-template');
        const listItem = listItemTemplate.content.cloneNode(true).querySelector('li');

        listItem.dataset.chatId = chatId;
        // 显示聊天会话的标题，可以根据消息内容或时间生成更友好的标题
        const chatTitle = chats[chatId].messages.length > 0
            ? chats[chatId].messages[0].content.substring(0, 20) + '...'
            : `新聊天 (${chatId.substring(0, 4)})`;

        listItem.querySelector('span').textContent = chatTitle;

        if (chatId === currentChatId) {
            listItem.classList.add('active');
        }

        chatListElement.appendChild(listItem);
    });
}


// 导出核心函数供其他模块使用
export { currentChatId, chats, sendMessage, renderMessages, updateChatListUI };
