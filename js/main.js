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
    updateMessageWithImage,
    updateMessageWithAudio,
    clearMessagesUI, // 导入清除消息 UI 函数
    addCopyButtonsToCodeBlocks, // 导入添加代码块复制按钮函数
    updateThemeToggleButton, // 导入更新主题切换按钮文本函数
    openSidebar, // 导入打开侧边栏函数
    closeSidebar, // 导入关闭侧边栏函数
    updateVoiceSelectUI, // 导入更新语音选择 UI 的函数
    updateVoiceSelectVisibility // 导入更新语音选择可见性的函数
} from './ui.js';
// 导入 api.js 中的函数
import { fetchModels, callAIApi, callTxt2ImgApi, callTxt2AudioApi } from './api.js';
import { saveChatData, loadChatData, deleteChatData } from './storage.js';
import { generateUniqueId } from './utils.js';

// 全局状态管理
let currentChatId = null;
let chats = {}; // { chatId: { name: '', messages: [], systemPrompt: '', model: '', voice: '', uploadedFiles: [] } }
let availableModels = []; // 存储从API获取的可用模型列表
let currentTheme = 'light'; // 默认主题是白天

// 定义默认系统提示词
const DEFAULT_SYSTEM_PROMPT = "你是一个entp性格的机器人助手，要以entp性格的语气回答问题";
// 定义主题存储键
const THEME_STORAGE_KEY = 'aiChatAppTheme';


document.addEventListener('DOMContentLoaded', async () => {
    // 0. 加载并应用保存的主题
    loadAndApplyTheme();

     // 监听窗口大小改变事件，以便在切换桌面/移动视图时调整侧边栏状态和按钮显示
     window.addEventListener('resize', handleWindowResize);
     // 在初始加载时也调用一次，根据当前窗口大小设置初始侧边栏状态
     handleWindowResize();


    // 1. 获取可用模型列表并填充 UI
    availableModels = await fetchModels();
    populateModelSelect(availableModels);

    // 2. 加载保存的聊天数据
    chats = loadChatData();

    // 检查是否有保存的聊天，如果没有则创建默认聊天
    if (Object.keys(chats).length === 0) {
        console.log("No saved chats found. Creating a default chat.");
        // 创建一个名为“默认聊天”的新会话，并设置默认系统提示词
        createNewChat("默认聊天", DEFAULT_SYSTEM_PROMPT);
    } else {
        // 尝试加载上次活动的聊天
        const savedCurrentChatId = localStorage.getItem('currentChatId');
        let targetChatId = null;
        if (savedCurrentChatId && chats[savedCurrentChatId]) {
             targetChatId = savedCurrentChatId;
        } else {
             // 如果没有找到上次活动的聊天，或者对应的聊天不存在，则切换到最近的一个聊天
             const chatIds = Object.keys(chats);
             chatIds.sort((a, b) => b.localeCompare(a)); // 假设 ID 是递增的或包含时间戳
             targetChatId = chatIds[0];
        }
         // 切换到目标聊天并确保设置默认系统提示词（如果聊天中没有的话）
         if (targetChatId) {
             // 如果加载的聊天没有 systemPrompt 字段，为其设置默认值
             if (chats[targetChatId].systemPrompt === undefined || chats[targetChatId].systemPrompt === null || chats[targetChatId].systemPrompt.trim() === '') {
                  console.log(`Setting default system prompt for chat ID: ${targetChatId}`);
                  chats[targetChatId].systemPrompt = DEFAULT_SYSTEM_PROMPT;
                  saveChatData(chats); // 保存更新后的数据
             }
              // 确保 uploadedFiles 字段存在且是数组
             if (!chats[targetChatId].uploadedFiles || !Array.isArray(chats[targetChatId].uploadedFiles)) {
                  chats[targetChatId].uploadedFiles = [];
                  saveChatData(chats); // 保存更新后的数据
             }

             switchChat(targetChatId);
         } else {
              // 如果没有任何聊天可加载，创建一个默认聊天
             console.log("No chats to load. Creating a default chat.");
             createNewChat("默认聊天", DEFAULT_SYSTEM_PROMPT);
         }
    }


    // 3. 初始化 UI 事件监听 (在 ui.js 中实现，这里只需调用)
    initializeUI();

    // 4. 绑定新建聊天按钮事件
    const newChatBtn = document.getElementById('new-chat-btn');
    if(newChatBtn) {
         // 修改新建聊天按钮事件，使其创建时使用默认系统提示词
         newChatBtn.addEventListener('click', () => createNewChat(undefined, DEFAULT_SYSTEM_PROMPT));
         console.log('Binding new chat button event');
    } else {
         console.error("New chat button with ID 'new-chat-btn' not found.");
    }


    // 5. 绑定侧边栏聊天列表点击事件 (包含切换和删除)
    // 使用事件委托处理列表项点击和删除按钮点击
    const chatListElement = document.getElementById('chat-list');
    if (chatListElement) {
        chatListElement.addEventListener('click', (event) => {
            const target = event.target;
            const listItem = target.closest('li[data-chat-id]'); // 查找最近的 li 元素
            if (listItem) {
                const chatId = listItem.dataset.chatId;
                // 检查是否点击了删除按钮
                if (target.classList.contains('delete-chat')) {
                     // 从按钮上获取 chatId
                     const deleteChatId = target.dataset.chatId;
                     if (deleteChatId) {
                         deleteChat(deleteChatId);
                     }
                } else if (chatId && chatId !== currentChatId) {
                    // 点击的是列表项本身（非删除按钮），且不是当前聊天
                    switchChat(chatId);
                }
            }
        });
         console.log('Binding chat list click event (switch and delete)');
    } else {
         console.error("Chat list element with ID 'chat-list' not found.");
    }


    // 6. 绑定设置区域（模型选择、系统提示词、语音选择）的 change/input 事件
    const modelSelectElement = document.getElementById('model-select');
    const systemPromptElement = document.getElementById('system-prompt');
    const voiceSelectElement = document.getElementById('voice-select');

    if(modelSelectElement) {
        modelSelectElement.addEventListener('change', (event) => {
            if (currentChatId && chats[currentChatId]) {
                chats[currentChatId].model = event.target.value;
                saveChatData(chats);
                 updateVoiceSelectVisibility(event.target.value); // 根据模型更新语音选择可见性
            }
        });
         console.log('Binding model select change event');
    } else {
         console.error("Model select element with ID 'model-select' not found.");
    }


    if(systemPromptElement) {
        systemPromptElement.addEventListener('input', (event) => {
             if (currentChatId && chats[currentChatId]) {
                chats[currentChatId].systemPrompt = event.target.value;
                saveChatData(chats);
            }
        });
         console.log('Binding system prompt input event');
    } else {
         console.error("System prompt element with ID 'system-prompt' not found.");
    }


     if(voiceSelectElement) {
        voiceSelectElement.addEventListener('change', (event) => {
            if (currentChatId && chats[currentChatId]) {
                chats[currentChatId].voice = event.target.value;
                saveChatData(chats);
            }
        });
         console.log('Binding voice select change event');
    } else {
         console.warn("Voice select element with ID 'voice-select' not found. Voice features may not work.");
    }


     // 初始加载时根据当前模型判断是否显示语音选择
     if (currentChatId && chats[currentChatId]) {
         updateVoiceSelectVisibility(chats[currentChatId].model);
     }

     // 7. 绑定生成图片按钮事件
     const generateImageBtn = document.getElementById('generate-image-btn');
     if (generateImageBtn) {
         generateImageBtn.addEventListener('click', generateImage);
         console.log('Binding generate image button event');
     } else {
         console.error("Generate image button with ID 'generate-image-btn' not found.");
     }

      // 8. 绑定清除上下文按钮事件 (已在 initializeUI 中处理)

     // 9. 主题切换按钮事件 (已在 initializeUI 中处理)

     // 10. 监听文件列表更新的自定义事件，以便在文件添加/移除时保存数据
     document.addEventListener('filesUpdated', (event) => {
         console.log("Received filesUpdated event:", event.detail);
         // 确保事件携带了有效的 chatId 和 files
         if (event.detail && event.detail.chatId && chats[event.detail.chatId]) {
              // event.detail.files 包含了最新的文件列表（包含 File 对象本身）
              chats[event.detail.chatId].uploadedFiles = event.detail.files; // 更新 chats 中的文件列表
              saveChatData(chats); // 保存更新后的 chats 对象
         } else {
             console.warn("filesUpdated event received without valid chat data.");
         }
     });

});

// ---- 响应式处理 ----

/**
 * 根据窗口大小调整侧边栏的显示状态和按钮可见性
 */
function handleWindowResize() {
     const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
     const sidebarOpenBtn = document.getElementById('sidebar-open-btn');

     if (window.innerWidth < 768) {
         // 小屏幕：默认关闭侧边栏
        if (!document.body.classList.contains('sidebar-open')) {
             // 侧边栏当前是关闭状态
             // 显示打开按钮，隐藏关闭按钮
             if(sidebarOpenBtn) sidebarOpenBtn.style.display = 'flex';
             if(sidebarToggleBtn) sidebarToggleBtn.style.display = 'none';
         } else {
              // 侧边栏当前是打开状态 (用户刚刚手动打开了)
             // 隐藏打开按钮，显示关闭按钮
             if(sidebarOpenBtn) sidebarOpenBtn.style.display = 'none';
             if(sidebarToggleBtn) sidebarToggleBtn.style.display = 'flex';
         }
         // 确保在小屏幕下关闭侧边栏（如果resize时是打开的）
         // closeSidebar(); // 移除这行，避免resize时强制关闭，让用户控制
     } else {
         // 大屏幕：默认打开侧边栏
         document.body.classList.remove('sidebar-open'); // 移除 body 上的 class，让 CSS 控制宽度
         // 隐藏所有侧边栏开关按钮
         if(sidebarOpenBtn) sidebarOpenBtn.style.display = 'none';
         if(sidebarToggleBtn) sidebarToggleBtn.style.display = 'none';
     }
      // 可以选择在这里触发 UI 更新，例如重新渲染聊天列表等，以适应新尺寸下的布局
      // updateChatListUI(chats, currentChatId); // 可能导致不必要的重复渲染
      // 或者只在需要时重新渲染特定的组件
}


// ---- 主题切换功能 ----

/**
 * 加载并应用保存的主题
 */
function loadAndApplyTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    // 默认是白天模式，或者加载保存的主题
    currentTheme = (savedTheme === 'dark') ? 'dark' : 'light';
    applyTheme(currentTheme);
}

/**
 * 应用指定的主题
 * @param {string} theme - 要应用的主题 ('light' or 'dark')
 */
function applyTheme(theme) {
    const body = document.body;
    if (theme === 'dark') {
        body.classList.add('dark-mode');
        body.classList.remove('light-mode'); // 确保移除 light-mode
    } else {
        body.classList.add('light-mode'); // 确保添加 light-mode
        body.classList.remove('dark-mode');
    }
     // 更新 UI 按钮文本/图标
    updateThemeToggleButton(theme); // ui.js 中的函数现在更新图标
    console.log(`Applied theme: ${theme}`);
}

/**
 * 切换主题 (白天 <-> 黑夜)
 * 这个函数由 UI 按钮点击事件触发
 */
function toggleTheme() { // 保持导出，ui.js 调用
    currentTheme = (currentTheme === 'light') ? 'dark' : 'light';
    applyTheme(currentTheme);
    // 保存用户选择的主题到 localStorage
    localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
}


// ---- 核心功能函数 ----

/**
 * 创建新的聊天会话
 * @param {string} [initialName] - 可选，为新聊天指定一个初始名称
 * @param {string} [initialSystemPrompt] - 可选，为新聊天指定一个初始系统提示词
 */
function createNewChat(initialName, initialSystemPrompt) {
    const newChatId = generateUniqueId();

    let chatName = initialName;
    if (chatName === undefined) { // 如果没有指定初始名称，则弹窗询问
        chatName = prompt("请输入新聊天的名称:");
        if (chatName === null || chatName.trim() === "") {
            chatName = "新聊天";
        }
    }

    let systemPrompt = initialSystemPrompt;
    if (systemPrompt === undefined) { // 如果没有指定初始系统提示词，使用默认值
        systemPrompt = DEFAULT_SYSTEM_PROMPT;
    }


    chats[newChatId] = {
        id: newChatId, // 增加 id 字段，便于存储和查找
        name: chatName,
        messages: [],
        systemPrompt: systemPrompt, // 使用传入或默认的系统提示词
        model: availableModels.length > 0 ? availableModels[0].name : 'openai', // 默认模型
        voice: 'voice1', // 默认语音
        uploadedFiles: [] // 新会话的已上传文件列表为空，存储 { id, name, type, size, file } 对象
    };

    currentChatId = newChatId;
    localStorage.setItem('currentChatId', currentChatId);
    saveChatData(chats);

    switchChat(newChatId);

    console.log(`Created new chat with ID: ${newChatId} and name: "${chatName}" with system prompt: "${systemPrompt}"`);
}

/**
 * 切换到指定的聊天会话
 * @param {string} chatId - 要切换到的聊天 ID
 */
function switchChat(chatId) {
    if (!chats[chatId]) {
        console.error("Chat ID not found:", chatId);
        return;
    }
    currentChatId = chatId;
    const currentChat = chats[currentChatId];

    localStorage.setItem('currentChatId', currentChatId);

    // switchChatUI 现在会处理 UI 切换和在小屏幕下关闭侧边栏
    switchChatUI(currentChatId); // 切换侧边栏激活状态和清空消息 UI

    renderMessages(currentChat.messages); // 重新渲染当前聊天的所有消息
    // 在 switchChat 时，确保根据聊天数据中的文件列表更新 UI
    updateUploadedFilesUI(currentChat.uploadedFiles); // 更新文件上传列表 UI

    // 更新设置区域，包括模型、系统提示词、语音选择
    // 切换聊天时，从聊天数据中读取系统提示词并更新 UI
    updateSettingsUI(currentChat.model, currentChat.systemPrompt);
    // populateModelSelect 在 DOMContentLoaded 已经调用，这里不再需要，除非模型列表会动态变化
    // populateModelSelect(availableModels, currentChat.model); // 更新选中模型
    updateVoiceSelectUI(currentChat.voice); // 更新语音选择下拉框的值
    updateVoiceSelectVisibility(currentChat.model); // 根据模型更新语音选择可见性

    updateChatListUI(chats, currentChatId); // 更新侧边栏聊天列表 UI
}

/**
 * 删除指定的聊天会话
 * @param {string} chatId - 要删除的聊天 ID
 */
function deleteChat(chatId) {
     if (!chats[chatId]) {
        console.error("Chat ID not found:", chatId);
        return;
    }

    if (!confirm(`确定要删除聊天 "${chats[chatId].name || '未命名聊天'}" 吗？`)) {
        return;
    }

    delete chats[chatId]; // 从内存中的 chats 对象中删除
    saveChatData(chats); // 保存到 localStorage

    if (currentChatId === chatId) {
        // 如果删除了当前聊天，切换到其他聊天或新建聊天
        const chatIds = Object.keys(chats);
        if (chatIds.length > 0) {
             chatIds.sort((a, b) => b.localeCompare(a)); // 切换到最近的聊天
            switchChat(chatIds[0]);
        } else {
            // 如果没有其他聊天了，创建一个新的默认聊天
            createNewChat("默认聊天", DEFAULT_SYSTEM_PROMPT);
        }
    } else {
        // 如果删除的不是当前聊天，只需要更新侧边栏列表
        updateChatListUI(chats, currentChatId);
    }
}

/**
 * 清除当前聊天会话的上下文 (删除所有消息，保留设置)
 */
export function clearCurrentChatContext() { // 导出此函数，以便 ui.js 可以调用
     if (!currentChatId || !chats[currentChatId]) {
        console.error("No current chat selected to clear context.");
        return;
    }

    if (!confirm(`确定要清除当前聊天 "${chats[currentChatId].name || '未命名聊天'}" 的所有消息吗？（这将删除所有聊天历史，保留设置）`)) {
        return;
    }

    // 清空当前聊天的消息数组
    chats[currentChatId].messages = [];
    // 清空当前聊天的已上传文件列表（因为它们通常是针对特定消息的）
    chats[currentChatId].uploadedFiles = []; // 清空文件数据

    saveChatData(chats); // 保存修改后的聊天数据

    // 更新 UI
    clearMessagesUI(); // 清空消息列表 UI
    updateUploadedFilesUI([]); // 清空已上传文件列表 UI

    console.log(`Cleared context for chat ID: ${currentChatId}`);
}


/**
 * 根据选择的模型名称控制语音选择 UI 的可见性
 * @param {string} selectedModel - 当前选中的模型名称
 */
function updateVoiceSelectVisibility(selectedModel) {
    const voiceSelectContainer = document.getElementById('voice-select-container'); // 假设你的 HTML 中有一个容器
    if (voiceSelectContainer) {
        // Pollinations.ai txt2audio 的模型名称是 'openai-audio'
        // TODO: 如果有其他语音模型，需要根据实际模型名称判断
        if (selectedModel && selectedModel.toLowerCase().includes('audio')) { // 检查模型名称是否包含 'audio'
            voiceSelectContainer.style.display = 'flex'; // 使用 flex 适应布局
        } else {
            voiceSelectContainer.style.display = 'none';
        }
    } else {
         console.warn("Voice select container with ID 'voice-select-container' not found.");
    }
}

/**
 * 更新语音选择下拉框的选中值
 * @param {string} selectedVoice - 当前选中的语音值
 */
export function updateVoiceSelectUI(selectedVoice) { // 导出此函数，以便 ui.js 可以调用
    const voiceSelectElement = document.getElementById('voice-select');
    if (voiceSelectElement) {
        voiceSelectElement.value = selectedVoice || 'voice1'; // 默认选中 voice1
    } else {
         console.warn("Voice select element with ID 'voice-select' not found.");
    }
}


/**
 * 发送消息（用户输入），调用 AI 聊天 API
 * 支持发送文本和上传的图片。
 */
async function sendMessage() {
    const userInputElement = document.getElementById('user-input');
    const messageContent = userInputElement.value.trim();
    const currentChat = chats[currentChatId];

    // 获取当前聊天会话的已上传文件，仅用于本次发送
    // 这里直接从 chats 数据中获取，它应该包含了 { id, name, type, size, file } 对象
    const uploadedFilesForSend = currentChat?.uploadedFiles || [];


    // 如果既没有文本输入也没有上传文件，则不发送消息
    if (!messageContent && uploadedFilesForSend.length === 0) {
        console.log("No text input and no files uploaded. Skipping send.");
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
        type: 'text', // 用户消息类型默认为文本
        // 在用户消息中记录本次发送的文件信息元数据，实际文件对象不保存在 messages 数组中
        // 这个 files 数组用于在 UI 中显示用户发送了哪些文件
        files: uploadedFilesForSend.map(file => ({ name: file.name, type: file.type }))
    };
    currentChat.messages.push(userMessage);
    // addMessageToUI 现在返回创建的元素，但对于非流式用户消息，我们通常不需要其引用
    addMessageToUI(userMessage, true); // 添加用户消息到 UI 并滚动

    // 清空输入框和文件列表 UI 和数据 (发送后清空)
    userInputElement.value = '';
    currentChat.uploadedFiles = []; // 清空上传的文件数据
    updateUploadedFilesUI([]); // 更新文件列表 UI
    saveChatData(chats); // 保存清空文件列表后的状态


    // 2. 调用常规聊天 API (/openai)
    const sendButton = document.getElementById('send-btn');
    const generateImageBtn = document.getElementById('generate-image-btn');
    if(sendButton) sendButton.disabled = true; // 禁用发送按钮
    if(generateImageBtn) generateImageBtn.disabled = true; // 禁用图片生成按钮

    let aiMessageContent = ''; // 用于存储 AI 回复的文本内容
    // 添加一个空的 AI 消息元素到 UI，用于接收流式数据
    const aiMessageElement = addStreamingMessageToUI(); // 假设 ui.js 中有这个函数，返回消息元素


    try {
         // 调用 AI API (/openai)，传递回调函数处理流
         // 传递用户输入的文本和上传的文件数组
         // 传递消息历史 (排除刚刚添加的用户消息，因为 API 会自动将用户消息加入请求 body)
         await callAIApi(
             messageContent, // 用户输入的文本
             currentChat.systemPrompt,
             currentChat.model, // 使用当前聊天选定的模型
             uploadedFilesForSend, // 将上传文件（包含 File 对象）传递给 API
             currentChat.messages.slice(0, -1), // 传递消息历史 (排除刚刚添加的用户消息)
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
                      content: aiMessageContent, // 保存累加的完整回复
                      type: 'text' // 标记为文本类型
                  };
                  // 查找并更新聊天数据中的最新 AI 消息，因为 addStreamingMessageToUI 已经添加了一个占位符
                  // 找到最后一个 AI 消息（理论上是流的占位符）并更新其内容和类型
                  const lastAIMessageIndex = currentChat.messages.findLastIndex(msg => msg.sender === 'ai');
                  if(lastAIMessageIndex !== -1) {
                       currentChat.messages[lastAIMessageIndex].content = aiMessageContent;
                       currentChat.messages[lastAIMessageIndex].type = 'text';
                       // 可选：如果之前有 url 字段（例如错误时添加的），移除它
                       delete currentChat.messages[lastAIMessageIndex].url;
                  } else {
                       // 这种情况不应该发生，但作为后备
                       currentChat.messages.push(aiMessage);
                  }

                  saveChatData(chats); // 保存数据

                  // 在流结束后对完整的 AI 消息进行最终渲染和后处理
                  // 重新渲染最后一个消息元素，以确保 Markdown 高亮和代码块复制按钮被正确添加
                  const contentElement = aiMessageElement.querySelector('.content');
                  if(contentElement) {
                      // Use marked.parse for final render
                      contentElement.innerHTML = marked.parse(aiMessageContent); // 再次渲染 Markdown
                      // Add copy buttons after innerHTML is set
                      addCopyButtonsToCodeBlocks(contentElement); // 添加复制按钮
                       // Highlight code blocks using Prism.js after adding copy buttons
                       // Use setTimeout to ensure DOM updates are processed before highlighting
                       setTimeout(() => {
                            Prism.highlightAllUnder(contentElement); // 代码高亮
                       }, 0); // 延迟 0ms，将其放入事件循环队列末尾
                  }

                  if(sendButton) sendButton.disabled = false; // 启用发送按钮
                  if(generateImageBtn) generateImageBtn.disabled = false; // 启用图片生成按钮
             },
             (error) => {
                 // onError 回调：发生错误
                  console.error("Streaming error:", error);
                  const errorMessageText = `\n\n错误：${error.message}`;
                  aiMessageContent += errorMessageText; // 添加错误信息到回复

                  // 更新 UI
                  updateStreamingMessageUI(aiMessageElement, aiMessageContent); // 显示错误信息到 UI

                  // 更新聊天数据中的错误消息
                  const lastAIMessageIndex = currentChat.messages.findLastIndex(msg => msg.sender === 'ai');
                   if(lastAIMessageIndex !== -1) {
                        currentChat.messages[lastAIMessageIndex].content = aiMessageContent;
                        currentChat.messages[lastAIMessageIndex].type = 'text';
                        delete currentChat.messages[lastAIMessageIndex].url; // 移除可能的 url 字段
                   } else {
                        // 后备方案
                        const errorMessage = { sender: 'ai', content: aiMessageContent, type: 'text' };
                        currentChat.messages.push(errorMessage);
                   }
                  saveChatData(chats); // 保存数据

                  // 在错误时也进行最终渲染和后处理
                   const contentElement = aiMessageElement.querySelector('.content');
                  if(contentElement) {
                      contentElement.innerHTML = marked.parse(aiMessageContent); // 再次渲染 Markdown
                      addCopyButtonsToCodeBlocks(contentElement); // 添加复制按钮
                       setTimeout(() => {
                           Prism.highlightAllUnder(contentElement); // 代码高亮
                       }, 0); // 延迟 0ms
                  }


                  if(sendButton) sendButton.disabled = false; // 启用发送按钮
                  if(generateImageBtn) generateImageBtn.disabled = false; // 启用图片生成按钮
             }
         );

    } catch (error) {
        console.error("Error during API call:", error);
        // 在 UI 中显示错误消息 (非流式错误捕获)
        // 如果在 API 调用前发生错误，或者不是流式 API 的错误，会在这里捕获
        // 如果已经开始流并且发生错误，错误会通过 onError 回调处理
        // 这里主要用于捕获 fetch 调用本身的错误
        const errorMessageText = `发生网络或未知错误：${error.message}`;
        const errorMessage = {
            sender: 'ai',
            content: errorMessageText,
            type: 'text'
        };
         // 如果流已经开始了，并且 aiMessageElement 已经创建，尝试更新它
         // 如果还没开始流，aiMessageElement 可能是 null，则添加一个新消息
        if (aiMessageElement) {
             updateStreamingMessageUI(aiMessageElement, errorMessage.content); // 更新现有元素
             // 更新聊天数据
             const lastAIMessageIndex = currentChat.messages.findLastIndex(msg => msg.sender === 'ai');
             if(lastAIMessageIndex !== -1) {
                  currentChat.messages[lastAIMessageIndex].content = errorMessage.content;
                  currentChat.messages[lastAIMessageIndex].type = 'text';
                  delete currentChat.messages[lastAIMessageIndex].url;
             } else {
                  currentChat.messages.push(errorMessage);
             }
              // 添加复制按钮/高亮到更新后的内容
              const contentElement = aiMessageElement.querySelector('.content');
              if(contentElement) {
                   addCopyButtonsToCodeBlocks(contentElement);
                   setTimeout(() => {
                       Prism.highlightAllUnder(contentElement);
                   }, 0);
              }

        } else {
             currentChat.messages.push(errorMessage);
             addMessageToUI(errorMessage, true); // 添加新消息到 UI
        }

        saveChatData(chats); // 保存错误消息

    } finally {
         // 确保按钮被启用，以防上面的 try/catch/finally 结构没有覆盖所有情况
         // 但流式调用的按钮启用已在 onComplete/onError 中处理
         // 这里主要用于非流式 API 调用或在 API 调用前发生的错误
         if(sendButton && sendButton.disabled) sendButton.disabled = false;
         if(generateImageBtn && generateImageBtn.disabled) generateImageBtn.disabled = false;
    }
}

/**
 * 生成图片（由按钮触发），调用 txt2img API
 */
async function generateImage() {
     const userInputElement = document.getElementById('user-input');
     const prompt = userInputElement.value.trim();
     const currentChat = chats[currentChatId];

     // 生成图片只需要文本 prompt，忽略已上传文件
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
         content: `[生成图片] ${prompt}`, // 在消息内容中标记这是图片生成请求
         type: 'text' // 用户消息类型仍是文本
         // 生成图片时，忽略 uploadedFiles 列表，即使有文件上传
     };
     currentChat.messages.push(userMessage);
     addMessageToUI(userMessage, true); // 添加用户消息到 UI

     // 清空输入框
     userInputElement.value = '';
      // 清空已上传文件列表 UI 和数据 (生成图片不使用上传文件)
    currentChat.uploadedFiles = [];
    updateUploadedFilesUI([]);
     saveChatData(chats); // 保存清空文件列表后的状态


     const sendButton = document.getElementById('send-btn');
     const generateImageBtn = document.getElementById('generate-image-btn');
     if(sendButton) sendButton.disabled = true; // 禁用发送按钮
     if(generateImageBtn) generateImageBtn.disabled = true; // 禁用图片生成按钮


     try {
         // 2. 添加一个占位符消息到 UI，用于显示图片
         // 占位符消息的数据结构可以简单一点，然后用实际的图片消息替换或更新
         const placeholderMessage = {
              sender: 'ai',
              content: '正在生成图片...',
              type: 'text' // 初始标记为文本，稍后更新为图片类型
         };
         currentChat.messages.push(placeholderMessage); // 添加占位符到数据
         const aiMessageElement = addMessageToUI(placeholderMessage, true); // 添加占位符到 UI

         // 3. 调用 txt2img API
         const imageUrl = await callTxt2ImgApi(prompt);

         // 4. 将占位符消息内容更新为图片和提示词文本
         updateMessageWithImage(aiMessageElement, imageUrl, prompt);

         // 5. 将生成的图片信息保存到聊天数据中
         // 找到之前添加的占位符消息并用实际图片消息的数据替换它
         // 通过查找最后一个AI消息来定位占位符
         const lastAIMessageIndex = currentChat.messages.findLastIndex(msg => msg.sender === 'ai');
         if(lastAIMessageIndex !== -1) {
             // 更新占位符的消息数据
             currentChat.messages[lastAIMessageIndex].type = 'image'; // 更新类型为 image
             currentChat.messages[lastAIMessageIndex].content = prompt; // 保存原始提示词或图片的描述
             currentChat.messages[lastAIMessageIndex].url = imageUrl; // 保存图片 URL
         } else {
             // 如果找不到占位符（不应该发生），作为后备，添加一个新的完整图片消息
             console.warn("Could not find AI placeholder message to update. Adding a new image message.");
             const aiImageMessage = {
                 sender: 'ai',
                 type: 'image',
                 content: prompt, // 保存提示词
                 url: imageUrl
             };
              currentChat.messages.push(aiImageMessage);
              // 这种情况下 UI 已经通过 updateMessageWithImage 更新了，不需要再次 addMessageToUI
         }

         saveChatData(chats); // 保存数据

     } catch (error) {
         console.error("Error generating image:", error);
         const errorMessageText = `图片生成失败：${error.message}`;

         // 在 UI 中找到之前的 AI 消息元素（占位符）并更新为错误信息
         const aiMessageElement = document.querySelector('#messages-list .message.ai:last-child');
         if (aiMessageElement) {
             const contentElement = aiMessageElement.querySelector('.content');
             if (contentElement) {
                 // 清空现有内容并显示错误文本
                 contentElement.innerHTML = '';
                 contentElement.textContent = errorMessageText;

                 // 更新聊天数据中的错误消息
                 const lastAIMessageIndex = currentChat.messages.findLastIndex(msg => msg.sender === 'ai');
                  if(lastAIMessageIndex !== -1) {
                       currentChat.messages[lastAIMessageIndex].content = errorMessageText;
                       currentChat.messages[lastAIMessageIndex].type = 'text'; // 标记为文本类型
                       delete currentChat.messages[lastAIMessageIndex].url; // 移除 url
                   } else {
                      // 如果找不到占位符
                       const errorMessage = { sender: 'ai', content: errorMessageText, type: 'text' };
                       currentChat.messages.push(errorMessage);
                   }
                 saveChatData(chats);
             }
         } else {
             // 如果连 AI 消息元素都没找到，直接添加一个新消息
             const errorMessage = { sender: 'ai', content: errorMessageText, type: 'text' };
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
        // addMessageToUI 现在会根据 message.type 处理不同的渲染方式，并返回创建的元素
        // 对于历史消息，shouldScroll 设置为 false，最后统一滚动一次
        const messageElement = addMessageToUI(message, false);

        // 对于 AI 文本消息，添加复制按钮和高亮
        // addMessageToUI 现在处理了文本消息的 Markdown 渲染
        // 复制按钮和高亮应该在元素添加到 DOM 并渲染内容后应用
         if (message.sender === 'ai' && message.type === 'text' && messageElement) {
              const contentElement = messageElement.querySelector('.content');
              if (contentElement) {
                   // 使用 setTimeout 确保 DOM 更新后再进行高亮和添加按钮
                  setTimeout(() => {
                      Prism.highlightAllUnder(contentElement); // 代码高亮
                      addCopyButtonsToCodeBlocks(contentElement); // 添加复制按钮
                   }, 0);
              }
         }
        // 对于用户消息，如果在数据中有 files 信息，将其渲染出来
         if (message.sender === 'user' && messageElement && message.files && Array.isArray(message.files) && message.files.length > 0) {
              const contentElement = messageElement.querySelector('.content');
              if (contentElement) {
                  const fileList = document.createElement('ul');
                  fileList.classList.add('message-files-list'); // 添加新的 class
                  message.files.forEach(fileInfo => {
                      const fileItem = document.createElement('li');
                      // 可以根据文件类型添加图标
                      let iconClass = 'far fa-file'; // 默认文件图标
                      if (fileInfo.type.startsWith('image/')) {
                          iconClass = 'far fa-image';
                      } else if (fileInfo.type.startsWith('audio/')) {
                          iconClass = 'far fa-file-audio';
                      } else if (fileInfo.type.startsWith('video/')) {
                          iconClass = 'far fa-file-video';
                      } else if (fileInfo.type === 'application/pdf') {
                          iconClass = 'far fa-file-pdf';
                      } // 添加更多文件类型的判断

                      const iconElement = document.createElement('i');
                      iconElement.classList.add(iconClass);
                      iconElement.style.marginRight = '5px';

                      fileItem.appendChild(iconElement);
                      fileItem.appendChild(document.createTextNode(fileInfo.name)); // 使用 textNode 避免文件名中的 HTML 实体被解析

                       fileItem.style.fontSize = '0.8em';
                       fileItem.style.color = 'var(--message-sender-user)'; // 在用户消息中使用用户 sender 颜色变量
                       fileList.appendChild(fileItem);
                  });
                  contentElement.appendChild(fileList);
              }
         }
    });

    // 渲染完成后滚动到底部一次
    messagesListElement.scrollTop = messagesListElement.scrollHeight;
}

// 导出核心函数
// 确保 clearCurrentChatContext 和 toggleTheme 被导出，因为它们由 ui.js 调用
export { currentChatId, chats, sendMessage, renderMessages, generateImage, clearCurrentChatContext, toggleTheme };
