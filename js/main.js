// js/main.js

import {
    initializeUI,
    switchChatUI,
    addMessageToUI,
    updateSettingsUI,
    updateUploadedFilesUI,
    updateChatListUI,
    populateModelSelect,
    addStreamingMessageToUI, // 导入处理流式消息的函数
    updateStreamingMessageUI // 导入更新流式消息的函数
} from './ui.js';
// 导入 api.js 中的函数
import { fetchModels, callAIApi, callTxt2ImgApi, callTxt2AudioApi } from './api.js';
import { saveChatData, loadChatData, deleteChatData } from './storage.js';
import { generateUniqueId } from './utils.js';

// 全局状态管理
let currentChatId = null;
let chats = {}; // { chatId: { name: '', messages: [], systemPrompt: '', model: '', voice: '', uploadedFiles: [] } } // 添加 voice 属性
let availableModels = []; // 存储从API获取的可用模型列表

document.addEventListener('DOMContentLoaded', async () => {
    // 0. 获取可用模型列表并填充 UI
    availableModels = await fetchModels();
    populateModelSelect(availableModels);

    // 1. 加载保存的聊天数据
    chats = loadChatData();
    if (Object.keys(chats).length === 0) {
        createNewChat();
    } else {
        const savedCurrentChatId = localStorage.getItem('currentChatId');
        if (savedCurrentChatId && chats[savedCurrentChatId]) {
             switchChat(savedCurrentChatId);
        } else {
             const firstChatId = Object.keys(chats)[0];
             switchChat(firstChatId);
        }
    }

    // 2. 初始化 UI 事件监听
    initializeUI();

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

    // 5. 绑定设置区域（模型选择、系统提示词、语音选择）的 change/input 事件
    document.getElementById('model-select').addEventListener('change', (event) => {
        if (currentChatId && chats[currentChatId]) {
            chats[currentChatId].model = event.target.value;
            saveChatData(chats);
             // TODO: 根据选择的模型（例如 txt2audio 模型）显示或隐藏语音选择 UI
             updateVoiceSelectVisibility(event.target.value);
        }
    });

    document.getElementById('system-prompt').addEventListener('input', (event) => {
         if (currentChatId && chats[currentChatId]) {
            chats[currentChatId].systemPrompt = event.target.value;
            saveChatData(chats);
        }
    });

     // ** 绑定语音选择下拉框事件 **
    document.getElementById('voice-select').addEventListener('change', (event) => {
        if (currentChatId && chats[currentChatId]) {
            chats[currentChatId].voice = event.target.value;
            saveChatData(chats);
        }
    });

     // 初始加载时根据当前模型判断是否显示语音选择
     if (currentChatId && chats[currentChatId]) {
         updateVoiceSelectVisibility(chats[currentChatId].model);
     }

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
        model: availableModels.length > 0 ? availableModels[0].name : 'openai', // 默认模型
        voice: 'voice1', // ** 添加默认语音选择 **
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

    // 更新设置区域，包括模型、系统提示词、语音选择
    updateSettingsUI(currentChat.model, currentChat.systemPrompt);
    populateModelSelect(availableModels, currentChat.model);
    updateVoiceSelectUI(currentChat.voice); // ** 更新语音选择 UI **
    updateVoiceSelectVisibility(currentChat.model); // ** 根据模型显示/隐藏语音选择 UI **

    updateChatListUI(chats, currentChatId);
}

/**
 * 删除指定的聊天会话
 * ... (保持不变) ...
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
 * 根据选择的模型名称控制语音选择 UI 的可见性
 * Pollinations.ai 的 txt2audio 模型名称是 'openai-audio'
 * @param {string} selectedModel - 当前选择的模型名称
 */
function updateVoiceSelectVisibility(selectedModel) {
    const voiceSelectContainer = document.getElementById('voice-select-container'); // 假设你的 HTML 中有一个容器
    if (voiceSelectContainer) {
        // Pollinations.ai txt2audio 的模型名称是 'openai-audio'
        if (selectedModel === 'openai-audio') {
            voiceSelectContainer.style.display = 'block'; // 或 'flex', 'grid' 等，取决于布局
        } else {
            voiceSelectContainer.style.display = 'none';
        }
    } else {
         console.warn("Voice select container with ID 'voice-select-container' not found.");
    }
}

/**
 * 更新语音选择下拉框的选中值
 * @param {string} selectedVoice - 当前选择的语音值
 */
function updateVoiceSelectUI(selectedVoice) {
    const voiceSelectElement = document.getElementById('voice-select');
    if (voiceSelectElement) {
        voiceSelectElement.value = selectedVoice || 'voice1'; // 默认选中 voice1
    } else {
         console.warn("Voice select element with ID 'voice-select' not found.");
    }
}


/**
 * 发送消息（用户输入），根据输入或模型调用不同的 API
 */
async function sendMessage() {
    const userInputElement = document.getElementById('user-input');
    const messageContent = userInputElement.value.trim();
    const uploadedFiles = chats[currentChatId]?.uploadedFiles || [];
    const currentChat = chats[currentChatId];

    if (!messageContent && uploadedFiles.length === 0) {
        return;
    }

    if (!currentChat) {
         console.error("No current chat selected.");
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

    // 清空输入框和文件列表 UI 和数据
    userInputElement.value = '';
    currentChat.uploadedFiles = [];
    updateUploadedFilesUI([]);

    // TODO: 显示加载状态 UI
    const sendButton = document.getElementById('send-btn');
    if(sendButton) sendButton.disabled = true; // 禁用发送按钮

    // 2. 根据输入前缀或模型选择调用不同的 API
    const lowerCaseMessage = messageContent.toLowerCase();
    const selectedModel = document.getElementById('model-select').value;
    const selectedVoice = document.getElementById('voice-select').value || 'voice1'; // 获取选中的语音

    let aiMessageContent = ''; // 用于存储 AI 回复的文本内容

    try {
        if (lowerCaseMessage.startsWith('/img ')) {
            // 触发 txt2img
            const prompt = messageContent.substring('/img '.length).trim();
             // 添加一个占位符消息到 UI
             const aiMessageElement = addMessageToUI({ sender: 'ai', content: '正在生成图片...' }, true);
             // 调用 txt2img API
            const imageUrl = await callTxt2ImgApi(prompt);
             // 将占位符消息内容更新为图片
             // 我们需要在 ui.js 中实现一个函数来更新消息内容，特别是插入图片
             updateMessageWithImage(aiMessageElement, imageUrl, prompt); // 假设 ui.js 中有这个函数
             aiMessageContent = `[图片生成] ${prompt}`; // 将图片 URL 存储到消息数据中可能不合适，存储描述或特殊标记
             // 更好的做法是 messages 数据结构支持不同类型的内容，例如 { type: 'text', content: '...' } 或 { type: 'image', url: '...' }
             // 为了与现有结构兼容，我们暂时只存储文本描述
             // 实际显示图片是在 UI 层完成的
        } else if (lowerCaseMessage.startsWith('/audio ')) {
            // 触发 txt2audio
             const prompt = messageContent.substring('/audio '.length).trim();
             // 添加一个占位符消息到 UI
             const aiMessageElement = addMessageToUI({ sender: 'ai', content: '正在生成音频...' }, true);
             // 调用 txt2audio API
             const audioUrl = await callTxt2AudioApi(prompt, selectedVoice);
             // 将占位符消息内容更新为音频播放器
             updateMessageWithAudio(aiMessageElement, audioUrl, prompt); // 假设 ui.js 中有这个函数
             aiMessageContent = `[音频生成] ${prompt}`; // 存储描述或特殊标记
        } else {
            // 触发 txt2txt (常规聊天)
            // Pollinations.ai 的 txt2txt GET 端点文档是 text.pollinations.ai/{input}?stream=true&private=true&system=(提示词)
            // 但我们之前使用的 /chat 端点支持 messages 数组和模型选择，并且我们也实现了流式处理
            // 考虑到灵活性和聊天上下文，我们继续使用 /chat 端点，并支持流式

            // 添加一个空的 AI 消息元素到 UI，用于接收流式数据
            const aiMessageElement = addStreamingMessageToUI(); // 假设 ui.js 中有这个函数，返回消息元素

            // 调用 AI API (/chat)，传递回调函数处理流
            await callAIApi(
                messageContent,
                currentChat.systemPrompt,
                selectedModel,
                uploadedFiles,
                currentChat.messages, // 传递消息历史
                (data) => {
                    // onData 回调：接收到新的文本块
                    aiMessageContent += data; // 累加接收到的文本
                    updateStreamingMessageUI(aiMessageElement, aiMessageContent); // 更新 UI
                },
                () => {
                    // onComplete 回调：流结束
                    console.log("Streaming complete.");
                     // 在流结束时将完整的回复内容保存到聊天数据中
                     // 这必须在流结束后进行，否则只保存了部分内容
                     const aiMessage = {
                         sender: 'ai',
                         content: aiMessageContent // 保存累加的完整回复
                     };
                     currentChat.messages.push(aiMessage);
                     saveChatData(chats); // 保存数据
                     if(sendButton) sendButton.disabled = false; // 启用发送按钮
                },
                (error) => {
                    // onError 回调：发生错误
                     console.error("Streaming error:", error);
                     aiMessageContent += `\n\n错误：${error.message}`; // 添加错误信息到回复
                     updateStreamingMessageUI(aiMessageElement, aiMessageContent); // 更新 UI
                     const aiMessage = {
                         sender: 'ai',
                         content: aiMessageContent // 保存包含错误信息的回复
                     };
                     currentChat.messages.push(aiMessage);
                     saveChatData(chats); // 保存数据
                     if(sendButton) sendButton.disabled = false; // 启用发送按钮
                }
            );

            // ** 注意：因为流式回复，消息数据的保存和按钮的启用在 onComplete/onError 回调中进行 **
            return; // 流式处理结束后不再执行后续的统一保存和按钮启用
        }

        // 对于非流式 API 调用 (txt2img, txt2audio)，在调用结束后保存数据和启用按钮
        // 添加 AI 回复消息到数据 (对于 txt2img/audio，内容是描述或标记)
        const aiMessage = {
             sender: 'ai',
             // 对于图片和音频，aiMessageContent 包含了描述，实际内容（URL）在 UI 中处理了
             content: aiMessageContent
         };
        // 如果是 txt2img 或 txt2audio，消息已经通过 updateMessageWith... 更新了 UI
        // 这里将描述或标记添加到消息数据中
        if (!lowerCaseMessage.startsWith('/img ') && !lowerCaseMessage.startsWith('/audio ')) {
             // 如果是常规聊天（非流式情况，虽然我们已经强制流式了），则在这里添加消息到数据
             // 但因为我们已经强制流式，这部分代码理论上不会被执行到
             // 除非 future 考虑非流式 /chat
        } else {
             // 对于 /img 和 /audio，在 AI 消息元素已经创建后，将描述添加到数据中
             currentChat.messages.push(aiMessage);
             saveChatData(chats); // 保存数据
        }


    } catch (error) {
        console.error("Error during API call:", error);
        // 在 UI 中显示错误消息
        const errorMessage = {
            sender: 'ai',
            content: `发生错误：${error.message}`
        };
        currentChat.messages.push(errorMessage);
        addMessageToUI(errorMessage, true);
        saveChatData(chats); // 保存错误消息
    } finally {
         // 在 finally 块中确保在非流式情况下按钮会被启用
         // 对于流式情况，按钮在 onComplete/onError 中启用
         if (!lowerCaseMessage.startsWith('/img ') && !lowerCaseMessage.startsWith('/audio ')) {
              // 流式已经在回调中处理按钮启用
         } else {
               if(sendButton) sendButton.disabled = false; // 在非流式调用完成后启用发送按钮
         }
    }
}


/**
 * 渲染指定聊天会话的消息列表到 UI
 * ... (保持不变) ...
 */
function renderMessages(messages) {
    const messagesListElement = document.getElementById('messages-list');
    messagesListElement.innerHTML = '';

    messages.forEach(message => {
        // 在渲染时，需要根据消息内容判断是文本、图片还是音频
        // 假设对于图片消息，content 以 "[图片生成]" 开头，对于音频消息以 "[音频生成]" 开头
        // 或者更健壮的方式是修改消息数据结构，例如 { type: 'text', content: '...' } 或 { type: 'image', url: '...' }
        // 为了与现有结构兼容，我们暂时使用前缀判断
        if (message.sender === 'ai') {
             if (message.content.startsWith('[图片生成] ')) {
                 // 这是之前保存的图片生成消息，实际图片 URL 可能没有保存
                 // 如果需要重新渲染图片，需要存储 URL 或重新生成？不建议重新生成
                 // 更好的做法是消息数据结构包含图片URL
                 // 临时方案：只显示文本描述，或者在 UI 层根据描述查找/加载图片 (如果可能)
                 // 最佳方案：修改消息数据结构
                 addMessageToUI(message, false); // 暂时作为文本消息渲染
                 // TODO: 实现根据保存的 URL 渲染图片
             } else if (message.content.startsWith('[音频生成] ')) {
                 // 临时方案：只显示文本描述
                 addMessageToUI(message, false); // 暂时作为文本消息渲染
                 // TODO: 实现根据保存的 URL 渲染音频播放器
             } else {
                 // 常规文本消息或流式保存的完整文本
                 addMessageToUI(message, false);
             }
        } else {
             // 用户消息
             addMessageToUI(message, false);
        }
    });

    messagesListElement.scrollTop = messagesListElement.scrollHeight;
}

// 导出核心函数
export { currentChatId, chats, sendMessage, renderMessages };
