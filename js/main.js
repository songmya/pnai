// js/main.js

import {
    initializeUI,
    switchChatUI,
    addMessageToUI,
    updateSettingsUI,
    updateUploadedFilesUI,
    updateChatListUI,
    populateModelSelect
} from './ui.js';
// 导入 api.js 中的函数
import { callAIApi, fetchModels } from './api.js';
import { saveChatData, loadChatData, deleteChatData } from './storage.js';
import { generateUniqueId } from './utils.js';

// 全局状态管理
let currentChatId = null;
let chats = {}; // { chatId: { name: '', messages: [], systemPrompt: '', model: '', uploadedFiles: [] } }
let availableModels = []; // 存储从API获取的可用模型列表

document.addEventListener('DOMContentLoaded', async () => { // 将事件监听器改为 async
    // 0. 获取可用模型列表并填充 UI
    availableModels = await fetchModels();
    // 填充模型选择下拉框
    populateModelSelect(availableModels); // 先填充所有选项

    // 1. 加载保存的聊天数据
    chats = loadChatData();
    if (Object.keys(chats).length === 0) {
        // 如果没有保存的数据，创建一个新的默认聊天
        createNewChat(); // createNewChat 会处理命名和切换
    } else {
        // 尝试加载当前会话，如果不存在则加载第一个
        const savedCurrentChatId = localStorage.getItem('currentChatId');
        if (savedCurrentChatId && chats[savedCurrentChatId]) {
             switchChat(savedCurrentChatId);
        } else {
             const firstChatId = Object.keys(chats)[0];
             switchChat(firstChatId);
        }
         // switchChat 内部会调用 updateChatListUI 和 updateSettingsUI/populateModelSelect
    }

    // 2. 初始化 UI 事件监听
    initializeUI(); // 绑定发送按钮、文件上传等事件

    // 3. 绑定新建聊天按钮事件
    document.getElementById('new-chat-btn').addEventListener('click', createNewChat);
	console.log('Binding new chat button event');

    // 4. 绑定侧边栏聊天列表点击事件 (通过事件委托)
    document.getElementById('chat-list').addEventListener('click', (event) => {
        const target = event.target;
        const listItem = target.closest('li[data-chat-id]');
        if (listItem) {
            const chatId = listItem.dataset.chatId;
            if (target.classList.contains('delete-chat')) {
                 deleteChat(chatId);
            } else if (chatId && chatId !== currentChatId) {
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

    let chatName = prompt("请输入新聊天的名称:");
    if (chatName === null || chatName.trim() === "") {
        chatName = "新聊天";
    }

    chats[newChatId] = {
        name: chatName,
        messages: [],
        systemPrompt: '',
        // 默认模型：优先使用可用列表中的第一个模型，否则使用一个硬编码的默认值
        model: availableModels.length > 0 ? availableModels[0].name : 'openai',
        uploadedFiles: []
    };

    currentChatId = newChatId;
    localStorage.setItem('currentChatId', currentChatId);
    saveChatData(chats);

    switchChat(newChatId);

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

    localStorage.setItem('currentChatId', currentChatId);

    switchChatUI(currentChatId);
    renderMessages(currentChat.messages);
    updateUploadedFilesUI(currentChat.uploadedFiles);

    updateSettingsUI(currentChat.model, currentChat.systemPrompt);
    // 切换会话时，重新填充模型列表并设置当前模型为选中状态
    populateModelSelect(availableModels, currentChat.model);

    updateChatListUI(chats, currentChatId);
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

    if (!confirm(`确定要删除聊天 "${chats[chatId].name || '未命名聊天'}" 吗？`)) {
        return;
    }

    delete chats[chatId];
    saveChatData(chats);

    if (currentChatId === chatId) {
        const chatIds = Object.keys(chats);
        if (chatIds.length > 0) {
            switchChat(chatIds[0]);
        } else {
            createNewChat();
        }
    } else {
        updateChatListUI(chats, currentChatId);
    }
}


/**
 * 发送消息（用户输入）
 */
async function sendMessage() {
    const userInputElement = document.getElementById('user-input');
    const messageContent = userInputElement.value.trim();
    const uploadedFiles = chats[currentChatId]?.uploadedFiles || [];

    if (!messageContent && uploadedFiles.length === 0) {
        return;
    }

    const currentChat = chats[currentChatId];
    if (!currentChat) {
         console.error("No current chat selected.");
         return;
    }

    const modelSelectElement = document.getElementById('model-select');
    const selectedModel = modelSelectElement ? modelSelectElement.value : (currentChat.model || (availableModels.length > 0 ? availableModels[0].name : 'openai'));

    if (!selectedModel) {
         console.error("No valid model selected or available.");
         addMessageToUI({ sender: 'ai', content: '错误：请选择一个有效的模型。' }, true);
         return;
    }

    // 1. 添加用户消息到 UI 和数据
    const userMessage = {
        sender: 'user',
        content: messageContent,
        files: uploadedFiles.map(file => ({ name: file.name, type: file.type }))
    };
    currentChat.messages.push(userMessage);
    addMessageToUI(userMessage, true);

    userInputElement.value = '';
    // 清空 UI 和数据中的已上传文件，这些文件数据会在调用 API 时传递，而不是保存在 chat.uploadedFiles 中
    // 如果您需要保留上传文件列表直到 AI 回复，需要调整这里的逻辑
    currentChat.uploadedFiles = [];
    updateUploadedFilesUI([]);

    // TODO: 显示加载状态 UI
    // 例如：document.getElementById('send-btn').disabled = true;

    // 2. 调用 AI API 获取回复
    // 传递当前会话的完整消息历史
    const apiResponse = await callAIApi(messageContent, currentChat.systemPrompt, selectedModel, uploadedFiles, currentChat.messages);

     // TODO: 隐藏加载状态 UI
    // 例如：document.getElementById('send-btn').disabled = false;


    // 3. 处理 AI 回复
    const aiMessage = {
        sender: 'ai',
        content: apiResponse.text
    };
    currentChat.messages.push(aiMessage);
    addMessageToUI(aiMessage, true);

    // 4. 保存聊天数据
    saveChatData(chats);
}

/**
 * 渲染指定聊天会话的消息列表到 UI
 * ... (保持不变) ...
 */
function renderMessages(messages) {
    const messagesListElement = document.getElementById('messages-list');
    messagesListElement.innerHTML = '';

    messages.forEach(message => {
        addMessageToUI(message, false);
    });

    messagesListElement.scrollTop = messagesListElement.scrollHeight;
}

// 导出核心函数
export { currentChatId, chats, sendMessage, renderMessages };
