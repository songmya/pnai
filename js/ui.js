// js/ui.js

import { sendMessage, currentChatId, chats } from './main.js';
import { generateUniqueId } from './utils.js';

/**
 * 初始化 UI 事件监听器
 */
export function initializeUI() {
    document.getElementById('send-btn').addEventListener('click', sendMessage);

    document.getElementById('user-input').addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    document.getElementById('file-upload').addEventListener('change', handleFileUpload);

    document.getElementById('uploaded-files-list').addEventListener('click', (event) => {
        if (event.target.classList.contains('remove-file')) {
            const listItem = event.target.closest('li');
            if (listItem) {
                const fileId = listItem.dataset.fileId;
                // TODO: 需要 main.js 提供一个函数来移除文件数据并保存
                 removeUploadedFile(fileId); // 暂时保留 ui.js 直接移除
            }
        }
    });
    // 其他 UI 事件，如设置区域的 change 事件在 main.js 中绑定
    // 图片生成按钮的事件监听器在 main.js 中绑定了
}

/**
 * 切换到指定的聊天框 UI
 * ... (保持不变) ...
 */
export function switchChatUI(chatId) {
    document.querySelectorAll('#chat-list li.active').forEach(item => {
        item.classList.remove('active');
    });

    const currentChatItem = document.querySelector(`#chat-list li[data-chat-id="${chatId}"]`);
    if (currentChatItem) {
        currentChatItem.classList.add('active');
    }
}


/**
 * 添加消息到当前聊天框的 UI (非流式或首次添加流式消息)
 * @param {object} message - 消息对象 { sender: 'user'|'ai', content: '...', files: [], type?: 'text' | 'image' | 'audio', url?: string } // 增加了 type 和 url 属性的可能
 * @param {boolean} shouldScroll - 是否滚动到底部
 * @returns {Element} 返回新创建的消息 DOM 元素
 */
export function addMessageToUI(message, shouldScroll) {
    const messagesListElement = document.getElementById('messages-list');
    const messageTemplate = document.getElementById('message-template');
    if (!messageTemplate) {
         console.error("Error: Message template element with ID 'message-template' not found.");
         return null; // 返回 null 表示创建失败
    }
    const messageElement = messageTemplate.content.cloneNode(true).querySelector('.message');

    messageElement.classList.add(message.sender);
    messageElement.querySelector('.sender').textContent = message.sender === 'user' ? '你' : 'AI';

    const contentElement = messageElement.querySelector('.content');
    if (contentElement) {
        // 对于文本消息，渲染 Markdown
        if (message.type === 'text' || message.type === undefined) { // 如果没有 type 或 type 是 text
             if (typeof marked !== 'undefined') {
                 contentElement.innerHTML = marked.parse(message.content || ''); // 确保 content 不为空
             } else {
                 contentElement.textContent = message.content || '';
             }
        }
        // 如果是图片或音频类型，初始这里不设置内容，而是由 updateMessageWithImage/Audio 在后续处理
    }


    // TODO: 处理消息中的文件信息显示 (用户消息中的文件)

    messagesListElement.appendChild(messageElement);

    if (shouldScroll) {
        messagesListElement.scrollTop = messagesListElement.scrollHeight;
    }

    return messageElement; // 返回消息元素以便后续更新 (用于流式或更新为图片/音频)
}

// ** 添加处理流式消息的函数 **
/**
 * 为流式回复添加一个空的 AI 消息元素到 UI
 * @returns {Element} 返回新创建的 AI 消息 DOM 元素
 */
export function addStreamingMessageToUI() {
     const messagesListElement = document.getElementById('messages-list');
     const messageTemplate = document.getElementById('message-template');
     if (!messageTemplate) {
         console.error("Error: Message template element with ID 'message-template' not found.");
         return null;
     }
     const messageElement = messageTemplate.content.cloneNode(true).querySelector('.message');

     messageElement.classList.add('ai'); // 标记为 AI 消息
     messageElement.querySelector('.sender').textContent = 'AI';
     // 初始内容为空或一个占位符
     messageElement.querySelector('.content').innerHTML = ''; // 初始内容为空

     messagesListElement.appendChild(messageElement);
     // 滚动到底部
     messagesListElement.scrollTop = messagesListElement.scrollHeight;

     return messageElement; // 返回元素引用，以便后续更新内容
}

/**
 * 更新流式 AI 消息元素的内容
 * @param {Element} messageElement - 要更新的消息 DOM 元素
 * @param {string} content - 要更新的文本内容
 */
export function updateStreamingMessageUI(messageElement, content) {
    if (!messageElement) return;
    const contentElement = messageElement.querySelector('.content');
    if (contentElement) {
         // 使用 innerHTML 并渲染 Markdown
         if (typeof marked !== 'undefined') {
             contentElement.innerHTML = marked.parse(content);
         } else {
             contentElement.textContent = content;
         }
         // 确保滚动到底部（可选，取决于是否需要每次更新都滚动）
         const messagesListElement = document.getElementById('messages-list');
         if (messagesListElement) {
             messagesListElement.scrollTop = messagesListElement.scrollHeight;
         }
    }
}
// ** 流式消息函数结束 **


// ** 添加更新消息为图片/音频的函数 **
/**
 * 更新消息元素的内容为图片
 * @param {Element} messageElement - 要更新的消息 DOM 元素
 * @param {string} imageUrl - 图片 URL
 * @param {string} altText - 图片的替代文本 (通常是提示词)
 */
export function updateMessageWithImage(messageElement, imageUrl, altText = '') {
    if (!messageElement) return;
    const contentElement = messageElement.querySelector('.content');
    if (contentElement) {
        // 清空原始内容并插入图片元素
        contentElement.innerHTML = '';
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = altText;
        img.style.maxWidth = '100%'; // 限制图片宽度，避免超出容器
        img.style.height = 'auto';
        img.style.display = 'block'; // 使图片独占一行
        img.style.margin = '10px 0'; // 图片上下留白
        contentElement.appendChild(img);

        // 添加原始提示词作为文本（可选）
        const promptText = document.createElement('p');
        promptText.textContent = `提示词: ${altText}`;
        promptText.style.fontSize = '0.9em';
        promptText.style.color = '#555';
        contentElement.appendChild(promptText);


        // 确保滚动到底部
        const messagesListElement = document.getElementById('messages-list');
        if (messagesListElement) {
            messagesListElement.scrollTop = messagesListElement.scrollHeight;
        }
    }
}

/**
 * 更新消息元素的内容为音频播放器
 * @param {Element} messageElement - 要更新的消息 DOM 元素
 * @param {string} audioUrl - 音频 URL
 * @param {string} description - 音频描述 (通常是文本转音频的输入文本)
 */
export function updateMessageWithAudio(messageElement, audioUrl, description = '') {
     if (!messageElement) return;
     const contentElement = messageElement.querySelector('.content');
     if (contentElement) {
        // 清空原始内容并插入音频播放器
        contentElement.innerHTML = '';

        // 添加音频播放器
        const audio = document.createElement('audio');
        audio.controls = true; // 显示播放器控件
        audio.style.width = '100%'; // 使播放器宽度适应容器
        audio.style.margin = '10px 0'; // 播放器上下留白

        const source = document.createElement('source');
        source.src = audioUrl;
        // 假设音频格式是 mp3，根据实际情况调整 type
        source.type = 'audio/mpeg'; // Pollinations.ai 返回的音频类型需要确认
        audio.appendChild(source);
        // 添加一个回退文本，如果浏览器不支持音频
        audio.innerHTML += '您的浏览器不支持音频播放。';
        contentElement.appendChild(audio);

         // 添加原始文本作为描述（可选）
        const descriptionText = document.createElement('p');
        descriptionText.textContent = `文本: ${description}`;
        descriptionText.style.fontSize = '0.9em';
        descriptionText.style.color = '#555';
        contentElement.appendChild(descriptionText);

         // 确保滚动到底部
         const messagesListElement = document.getElementById('messages-list');
         if (messagesListElement) {
             messagesListElement.scrollTop = messagesListElement.scrollHeight;
         }
     }
}
// ** 更新消息为图片/音频的函数结束 **


/**
 * 处理文件上传 input change 事件
 * ... (保持不变) ...
 */
function handleFileUpload(event) {
    const files = event.target.files;
    if (files.length === 0 || !currentChatId || !chats[currentChatId]) {
        return;
    }

    const currentChat = chats[currentChatId];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileId = generateUniqueId();

        // 将文件信息添加到当前聊天会话的数据中
         currentChat.uploadedFiles.push({
            id: fileId,
            name: file.name,
            type: file.type,
            size: file.size,
            file: file // 存储 File 对象
        });

        addUploadedFileToUI({ id: fileId, name: file.name });
        // TODO: 需要在 main.js 中保存 chats 对象到 localStorage (当文件添加/移除时) - 现在在 main.js 的 sendMessage/generateImage 中统一保存
    }

    event.target.value = '';
}

/**
 * 添加已上传文件到 UI 列表
 * ... (保持不变) ...
 */
function addUploadedFileToUI(fileInfo) {
     const uploadedFilesListElement = document.getElementById('uploaded-files-list');
     const fileItemTemplate = document.getElementById('file-item-template');
    if (!fileItemTemplate) {
         console.error("Error: File item template element with ID 'file-item-template' not found.");
         return;
    }
     const fileItemElement = fileItemTemplate.content.cloneNode(true).querySelector('li');

     fileItemElement.dataset.fileId = fileInfo.id;
    const spanElement = fileItemElement.querySelector('span');
    if(spanElement) {
        spanElement.textContent = fileInfo.name;
    }

    // 添加移除按钮事件 (直接在 ui.js 中处理移除 UI，数据移除由 main.js 处理)
    const removeButton = fileItemElement.querySelector('.remove-file');
    if (removeButton) {
        removeButton.addEventListener('click', () => {
             removeUploadedFile(fileInfo.id); // 调用 UI 移除函数
             // 通知 main.js 移除数据并保存
             // 更好的做法是这里触发一个自定义事件，让 main.js 监听并处理数据
             // 临时简单处理：直接在 main.js 的 sendMessage/generateImage 中获取上传列表
             // 或者将 removeUploadedFile 逻辑移到 main.js 中，让 ui.js 调用 main.js 的函数
             // 当前实现是 ui.js 移除 UI，main.js 在发送时重新获取上传列表并保存
             // 还是将移除逻辑统一到 main.js 更好
             // 暂时将 removeUploadedFile 标记为 TODO 在 main.js 中实现
             // 或者，修改此处的逻辑，直接在 ui.js 中触发事件并让 main.js 监听
             // 为了简化，我们暂时让 removeUploadedFile 在 ui.js 中仅移除 UI，数据处理依赖 main.js 在发送消息时获取最新列表
        });
    }


     uploadedFilesListElement.appendChild(fileItemElement);
}


/**
 * 从 UI 和数据中移除已上传文件
 * TODO: 这个函数最好移动到 main.js 中，因为它需要修改聊天数据并保存
 * @param {string} fileId - 要移除的文件的 ID
 */
function removeUploadedFile(fileId) {
    if (!currentChatId || !chats[currentChatId]) {
         return;
    }

    const currentChat = chats[currentChatId];

    // 从数据中移除文件
    currentChat.uploadedFiles = currentChat.uploadedFiles.filter(file => file.id !== fileId);
    // TODO: 在这里立即保存 chats 数据到 localStorage
    // saveChatData(chats); // 应该在这里调用保存

    // 从 UI 中移除文件列表项
    const fileItemElement = document.querySelector(`#uploaded-files-list li[data-file-id="${fileId}"]`);
    if (fileItemElement) {
        fileItemElement.remove();
    }

     console.log(`Removed file with ID: ${fileId}. Updated uploaded files:`, currentChat.uploadedFiles);
     // ** 重要：在这里调用保存函数 **
     if (currentChatId) { // 确保有当前聊天ID
          saveChatData(chats);
     }
}


/**
 * 更新设置区域（模型选择和系统提示词）的 UI
 * ... (保持不变) ...
 */
export function updateSettingsUI(model, systemPrompt) {
    const modelSelectElement = document.getElementById('model-select');
    const systemPromptElement = document.getElementById('system-prompt');

    if (modelSelectElement) {
        modelSelectElement.value = model || '';
    }
    if (systemPromptElement) {
        systemPromptElement.value = systemPrompt || '';
    }
    // 注意：语音选择 UI 的更新由 updateVoiceSelectUI 函数处理
}

/**
 * 更新已上传文件列表的 UI
 * ... (保持不变) ...
 */
export function updateUploadedFilesUI(files) {
    const uploadedFilesListElement = document.getElementById('uploaded-files-list');
    if (!uploadedFilesListElement) {
        console.error("Error: Uploaded files list element with ID 'uploaded-files-list' not found.");
        return;
    }
    uploadedFilesListElement.innerHTML = '';

    if (Array.isArray(files)) {
        files.forEach(file => {
            // 这里的 file 可能是一个简单对象 { id, name }，而不是完整的 File 对象
            // addUploadedFileToUI 需要的是 { id, name }
            addUploadedFileToUI({ id: file.id, name: file.name });
        });
    } else {
        console.error("updateUploadedFilesUI expects an array, but received:", files);
    }
}

/**
 * 根据获取的模型列表填充模型选择下拉框
 * ... (保持不变) ...
 */
 export function populateModelSelect(models, currentModel) {
    const modelSelectElement = document.getElementById('model-select');
    if (!modelSelectElement) {
        console.error("Error: Model select element with ID 'model-select' not found.");
        return;
    }
    modelSelectElement.innerHTML = '';

    if (Array.isArray(models)) {
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = model.description || model.name;

            if (model.name === currentModel) {
                option.selected = true;
            }

            modelSelectElement.appendChild(option);
        });
    } else {
        console.error("populateModelSelect expects an array, but received:", models);
         const option = document.createElement('option');
         option.value = '';
         option.textContent = '加载模型失败或无可用模型';
         modelSelectElement.appendChild(option);
    }

     if (modelSelectElement.value === '' && models.length > 0) {
         modelSelectElement.value = models[0].name;
         // TODO: 需要通知 main.js 更新当前聊天的 model 属性
         // 在 main.js 的 DOMContentLoaded 中加载和切换聊天时，已经设置了 model
         // 这里的逻辑可能不再需要
     }
}

/**
 * 更新侧边栏的聊天列表 UI
 * ... (保持不变) ...
 */
export function updateChatListUI(allChats, currentChatId) {
    const chatListElement = document.getElementById('chat-list');
    const listItemTemplate = document.getElementById('chat-list-item-template');

    if (!chatListElement || !listItemTemplate) {
        console.error("Error: Chat list container or template element not found.");
        return;
    }

    chatListElement.innerHTML = '';

    const chatIds = Object.keys(allChats);
    // 按创建时间倒序排列聊天列表 (假设 ID 是递增的或包含时间戳)
    chatIds.sort((a, b) => b.localeCompare(a));

    chatIds.forEach(chatId => {
        const chat = allChats[chatId];
        const listItem = listItemTemplate.content.cloneNode(true).querySelector('li');

        listItem.dataset.chatId = chatId;

        // 确定聊天标题：优先使用保存的 name，否则使用第一条消息的前缀，否则使用 ID 的一部分
        let chatTitle = chat.name ||
                          (chat.messages && chat.messages.length > 0
                            ? chat.messages[0].content.substring(0, 20) + (chat.messages[0].content.length > 20 ? '...' : '')
                            : `新聊天 (${chatId.substring(0, 4)})`);

        const spanElement = listItem.querySelector('span');
        if(spanElement) {
             spanElement.textContent = chatTitle;
        }

        if (chatId === currentChatId) {
            listItem.classList.add('active');
        }

        chatListElement.appendChild(listItem);
    });
}

// 注意：更新语音选择 UI 的函数放在 main.js 中，因为它与聊天数据和设置相关
// 但 UI 的实际操作可以在 ui.js 中实现，并通过 main.js 调用
// 假设 main.js 中的 updateVoiceSelectUI 函数会调用这里的 DOM 操作

// TODO: 添加更多 UI 操作函数，例如显示加载状态、错误提示等
