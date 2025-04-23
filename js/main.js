// js/main.js

import {
    initializeUI,
    switchChatUI,
    addMessageToUI,
    updateSettingsUI,
    updateUploadedFilesUI,
    updateChatListUI,
    populateModelSelect,
    addStreamingMessageToUI,
    updateStreamingMessageUI,
    updateMessageWithImage, // 导入处理图片显示的函数
    updateMessageWithAudio // 导入处理音频显示的函数
} from './ui.js';
// 导入 api.js 中的函数
import { fetchModels, callAIApi, callTxt2ImgApi, callTxt2AudioApi } from './api.js';
import { saveChatData, loadChatData, deleteChatData } from './storage.js';
import { generateUniqueId } from './utils.js';

// 全局状态管理
let currentChatId = null;
let chats = {}; // { chatId: { name: '', messages: [], systemPrompt: '', model: '', voice: '', uploadedFiles: [] } }
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
    initializeUI(); // 这里面会绑定 Send 按钮和文件上传事件

    // ** 3. 绑定新建聊天按钮事件 (已存在，确认代码) **
    document.getElementById('new-chat-btn').addEventListener('click', createNewChat);
	console.log('Binding new chat button event');

    // ** 4. 绑定侧边栏聊天列表点击事件 (已存在，确认代码) **
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

    // ** 5. 绑定设置区域（模型选择、系统提示词、语音选择）的 change/input 事件 (已存在，确认代码) **
    document.getElementById('model-select').addEventListener('change', (event) => {
        if (currentChatId && chats[currentChatId]) {
            chats[currentChatId].model = event.target.value;
            saveChatData(chats);
             updateVoiceSelectVisibility(event.target.value);
        }
    });

    document.getElementById('system-prompt').addEventListener('input', (event) => {
         if (currentChatId && chats[currentChatId]) {
            chats[currentChatId].systemPrompt = event.target.value;
            saveChatData(chats);
        }
    });

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

     // ** 新增：绑定生成图片按钮事件 **
     const generateImageBtn = document.getElementById('generate-image-btn');
     if (generateImageBtn) {
         generateImageBtn.addEventListener('click', generateImage);
         console.log('Binding generate image button event');
     } else {
         console.error("Generate image button with ID 'generate-image-btn' not found.");
     }

});

// ---- 核心功能函数 ----

/**
 * 创建新的聊天会话
 * ... (保持不变) ...
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
        voice: 'voice1',
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
 * ... (保持不变) ...
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
    updateVoiceSelectUI(currentChat.voice);
    updateVoiceSelectVisibility(currentChat.model);

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
 * ... (保持不变) ...
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
 * ... (保持不变) ...
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
 * 发送消息（用户输入），调用 AI 聊天 API
 */
async function sendMessage() {
    const userInputElement = document.getElementById('user-input');
    const messageContent = userInputElement.value.trim();
    const uploadedFiles = chats[currentChatId]?.uploadedFiles || []; // 注意：聊天API支持文件上传，但图片生成按钮不支持
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
        files: uploadedFiles.map(file => ({ name: file.name, type: file.type })) // 保存文件信息到消息数据
    };
    currentChat.messages.push(userMessage);
    addMessageToUI(userMessage, true);

    // 清空输入框和文件列表 UI 和数据
    userInputElement.value = '';
    currentChat.uploadedFiles = []; // 清空上传的文件数据
    updateUploadedFilesUI([]); // 更新文件列表 UI

    // 2. 调用常规聊天 API (/openai)
    // TODO: 显示加载状态 UI
    const sendButton = document.getElementById('send-btn');
    const generateImageBtn = document.getElementById('generate-image-btn');
    if(sendButton) sendButton.disabled = true; // 禁用发送按钮
    if(generateImageBtn) generateImageBtn.disabled = true; // 禁用图片生成按钮

    let aiMessageContent = ''; // 用于存储 AI 回复的文本内容

    try {
         // 添加一个空的 AI 消息元素到 UI，用于接收流式数据
         const aiMessageElement = addStreamingMessageToUI(); // 假设 ui.js 中有这个函数，返回消息元素

         // 调用 AI API (/openai)，传递回调函数处理流
         await callAIApi(
             messageContent,
             currentChat.systemPrompt,
             currentChat.model, // 使用当前聊天选定的模型
             uploadedFiles, // 将上传文件传递给聊天 API (如果支持)
             currentChat.messages.slice(0, -1), // 传递消息历史 (排除刚刚添加的用户消息，因为 API 会自动将用户消息加入请求 body)
             (data) => {
                 // onData 回调：接收到新的文本块
                 aiMessageContent += data; // 累加接收到的文本
                 updateStreamingMessageUI(aiMessageElement, aiMessageContent); // 更新 UI
             },
             () => {
                 // onComplete 回调：流结束
                 console.log("Streaming complete.");
                  // 在流结束时将完整的回复内容保存到聊天数据中
                  const aiMessage = {
                      sender: 'ai',
                      content: aiMessageContent // 保存累加的完整回复
                  };
                  // 查找并更新聊天数据中的最新 AI 消息，而不是简单 push，因为 addStreamingMessageToUI 可能已经添加了一个占位符
                  // 更好的做法是在 addStreamingMessageToUI 时保存返回的元素到某个地方，并在 onComplete 时更新对应的数据条目
                  // 临时简单处理：查找最后一个 AI 消息并更新
                  const lastAIMessageIndex = currentChat.messages.map(msg => msg.sender).lastIndexOf('ai');
                  if(lastAIMessageIndex !== -1) {
                       currentChat.messages[lastAIMessageIndex].content = aiMessageContent;
                  } else {
                       currentChat.messages.push(aiMessage); // 如果找不到，就直接添加
                  }

                  saveChatData(chats); // 保存数据
                  if(sendButton) sendButton.disabled = false; // 启用发送按钮
                  if(generateImageBtn) generateImageBtn.disabled = false; // 启用图片生成按钮
             },
             (error) => {
                 // onError 回调：发生错误
                  console.error("Streaming error:", error);
                  aiMessageContent += `\n\n错误：${error.message}`; // 添加错误信息到回复
                  updateStreamingMessageUI(aiMessageElement, aiMessageContent); // 更新 UI
                  // 更新聊天数据中的错误消息
                   const lastAIMessageIndex = currentChat.messages.map(msg => msg.sender).lastIndexOf('ai');
                   if(lastAIMessageIndex !== -1) {
                        currentChat.messages[lastAIMessageIndex].content = aiMessageContent;
                   } else {
                        const errorMessage = { sender: 'ai', content: aiMessageContent };
                        currentChat.messages.push(errorMessage);
                   }
                  saveChatData(chats); // 保存数据
                  if(sendButton) sendButton.disabled = false; // 启用发送按钮
                  if(generateImageBtn) generateImageBtn.disabled = false; // 启用图片生成按钮
             }
         );

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
         // 在 finally 块中确保按钮在非流式情况下会被启用
         // 因为 sendMessage 现在只处理流式聊天，所以这里的 finally 主要用于捕获非 API 调用的错误
         // API 调用成功/失败后的按钮启用在 onComplete/onError 中处理
         if(sendButton && !sendButton.disabled) sendButton.disabled = false; // 如果之前没禁用过，就确保启用
         if(generateImageBtn && !generateImageBtn.disabled) generateImageBtn.disabled = false;
    }
}

/**
 * 生成图片（由按钮触发），调用 txt2img API
 */
async function generateImage() {
     const userInputElement = document.getElementById('user-input');
     const prompt = userInputElement.value.trim();
     const currentChat = chats[currentChatId];

     if (!prompt) {
         alert("请输入图片描述（Prompt）!");
         return;
     }

     if (!currentChat) {
          console.error("No current chat selected.");
          return;
     }

     // 1. 添加用户发送的图片生成提示词到 UI 和数据
     const userMessage = {
         sender: 'user',
         content: `[生成图片] ${prompt}` // 在消息内容中标记这是图片生成请求
     };
     currentChat.messages.push(userMessage);
     addMessageToUI(userMessage, true);

     // 清空输入框
     userInputElement.value = '';

     // TODO: 显示加载状态 UI
     const sendButton = document.getElementById('send-btn');
     const generateImageBtn = document.getElementById('generate-image-btn');
     if(sendButton) sendButton.disabled = true; // 禁用发送按钮
     if(generateImageBtn) generateImageBtn.disabled = true; // 禁用图片生成按钮

     try {
         // 2. 添加一个占位符消息到 UI，用于显示图片
         const aiMessageElement = addMessageToUI({ sender: 'ai', content: '正在生成图片...' }, true);

         // 3. 调用 txt2img API
         const imageUrl = await callTxt2ImgApi(prompt);

         // 4. 将占位符消息内容更新为图片和提示词文本
         updateMessageWithImage(aiMessageElement, imageUrl, prompt);

         // 5. 将生成的图片信息保存到聊天数据中
         // 最好修改 messages 数据结构来支持存储图片 URL
         // 临时方案：添加一个包含图片 URL 的消息对象
         const aiImageMessage = {
             sender: 'ai',
             type: 'image', // 新增类型字段
             content: prompt, // 可以保存原始提示词
             url: imageUrl // 保存图片 URL
         };
         // 找到之前添加的占位符消息并用实际图片消息替换它
         const placeholderIndex = currentChat.messages.length -1; // 假设占位符是最后一个AI消息
          // 或者更精确地查找刚刚添加的“正在生成图片...”消息
         const placeholderMsg = currentChat.messages.findLast(msg => msg.sender === 'ai' && msg.content === '正在生成图片...');
         if(placeholderMsg) {
             placeholderMsg.type = 'image';
             placeholderMsg.content = prompt;
             placeholderMsg.url = imageUrl;
         } else {
             // 如果找不到占位符，就直接添加新的图片消息
             currentChat.messages.push(aiImageMessage);
         }

         saveChatData(chats); // 保存数据

     } catch (error) {
         console.error("Error generating image:", error);
         // 在 UI 中找到之前的 AI 消息元素并更新为错误信息
         const aiMessageElement = document.querySelector('#messages-list .message.ai:last-child');
         if (aiMessageElement) {
             const contentElement = aiMessageElement.querySelector('.content');
             if (contentElement) {
                 contentElement.textContent = `图片生成失败：${error.message}`;
                 // 更新聊天数据中的错误消息
                 const lastAIMessageIndex = currentChat.messages.map(msg => msg.sender).lastIndexOf('ai');
                  if(lastAIMessageIndex !== -1) {
                        currentChat.messages[lastAIMessageIndex].content = `图片生成失败：${error.message}`;
                        currentChat.messages[lastAIMessageIndex].type = 'text'; // 标记为文本类型
                        delete currentChat.messages[lastAIMessageIndex].url; // 移除 url
                   } else {
                       // 这不太可能发生，但作为后备
                        const errorMessage = { sender: 'ai', content: `图片生成失败：${error.message}`, type: 'text' };
                        currentChat.messages.push(errorMessage);
                   }
                 saveChatData(chats);
             }
         } else {
             // 如果连 AI 消息元素都没找到，直接添加一个新消息
             const errorMessage = { sender: 'ai', content: `图片生成失败：${error.message}` };
             currentChat.messages.push(errorMessage);
             addMessageToUI(errorMessage, true);
             saveChatData(chats);
         }

     } finally {
         // 在 finally 块中确保按钮被启用
         if(sendButton) sendButton.disabled = false; // 启用发送按钮
         if(generateImageBtn) generateImageBtn.disabled = false; // 启用图片生成按钮
     }
}


/**
 * 渲染指定聊天会话的消息列表到 UI
 * @param {Array<object>} messages - 要渲染的消息数组
 */
function renderMessages(messages) {
    const messagesListElement = document.getElementById('messages-list');
    if (!messagesListElement) {
        console.error("Error: messages list element not found.");
        return;
    }
    messagesListElement.innerHTML = ''; // 清空现有消息

    if (!Array.isArray(messages)) {
        console.error("renderMessages expects an array, but received:", messages);
        return;
    }

    messages.forEach(message => {
        // 根据消息的 type 或 sender/content 结构来判断如何渲染
        const messageElement = addMessageToUI(message, false); // 先添加基础消息元素

        if (message.sender === 'ai') {
            if (message.type === 'image' && message.url) {
                // 如果消息是图片类型，并且有 URL
                updateMessageWithImage(messageElement, message.url, message.content || ''); // 使用 content 作为 altText
            } else if (message.type === 'audio' && message.url) {
                // 如果消息是音频类型，并且有 URL
                 updateMessageWithAudio(messageElement, message.url, message.content || ''); // 使用 content 作为描述
            } else {
                 // 默认作为文本消息渲染 (已经在 addMessageToUI 中处理了)
                 // 对于从流中保存的完整文本，没有 type 字段，也会在这里渲染
            }
        }
        // 用户消息已经在 addMessageToUI 中渲染了
    });

    // 滚动到底部
    messagesListElement.scrollTop = messagesListElement.scrollHeight;
}

// 导出核心函数
export { currentChatId, chats, sendMessage, renderMessages, generateImage }; // 导出 generateImage 函数
