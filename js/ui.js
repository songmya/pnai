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
 * @param {object} message - 消息对象 { sender: 'user'|'ai', content: '...', files: [] }
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

    // 对于非流式消息或用户消息，直接设置内容
	if (typeof marked !== 'undefined') {
		messageElement.querySelector('.content').innerHTML = marked.parse(message.content);
	} else {
		messageElement.querySelector('.content').textContent = message.content;
	}

    // TODO: 处理消息中的文件信息显示

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
        contentElement.appendChild(img);

        // 添加原始提示词作为文本（可选）
        const promptText = document.createElement('p');
        promptText.textContent = `提示词: ${altText}`;
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
        const source = document.createElement('source');
        source.src = audioUrl;
        // 假设音频格式是 mp3，根据实际情况调整 type
        source.type = 'audio/mpeg';
        audio.appendChild(source);
        // 添加一个回退文本，如果浏览器不支持音频
        audio.innerHTML += '您的浏览器不支持音频播放。';
        contentElement.appendChild(audio);

         // 添加原始文本作为描述（可选）
        const descriptionText = document.createElement('p');
        descriptionText.textContent = `文本: ${description}`;
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
 * @param {Event} event - change 事件对象
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
        // TODO: 需要在 main.js 中保存 chats 对象到 localStorage (当文件添加/移除时)
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

     uploadedFilesListElement.appendChild(fileItemElement);
}


/**
 * 从 UI 和数据中移除已上传文件
 * @param {string} fileId - 要移除的文件的 ID
 */
function removeUploadedFile(fileId) {
    if (!currentChatId || !chats[currentChatId]) {
         return;
    }

    const currentChat = chats[currentChatId];

    // 从数据中移除文件
    currentChat.uploadedFiles = currentChat.uploadedFiles.filter(file => file.id !== fileId);
    // TODO: 需要在 main.js 中保存 chats 对象到 localStorage (当文件添加/移除时)

    // 从 UI 中移除文件列表项
    const fileItemElement = document.querySelector(`#uploaded-files-list li[data-file-id="${fileId}"]`);
    if (fileItemElement) {
        fileItemElement.remove();
    }
}


/**
 * 更新设置区域（模型选择和系统提示词）的 UI
 * @param {string} model - 当前模型
 * @param {string} systemPrompt - 当前系统提示词
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
    chatIds.forEach(chatId => {
        const chat = allChats[chatId];
        const listItem = listItemTemplate.content.cloneNode(true).querySelector('li');

        listItem.dataset.chatId = chatId;

        const chatTitle = chat.name ||
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
