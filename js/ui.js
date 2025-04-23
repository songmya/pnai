// js/ui.js

import { sendMessage, currentChatId, chats, clearCurrentChatContext, toggleTheme } from './main.js';
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
                 removeUploadedFile(fileId); // 调用 UI 移除，数据移除和保存由 main.js 处理
            }
        }
    });

    // 绑定清除上下文按钮事件
     const clearContextBtn = document.getElementById('clear-context-btn');
     if (clearContextBtn) {
         clearContextBtn.addEventListener('click', clearCurrentChatContext); // 调用 main.js 中的函数
         console.log('Binding clear context button event');
     } else {
         console.error("Clear context button with ID 'clear-context-btn' not found.");
     }

    // ** 新增：绑定主题切换按钮事件 **
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme); // 调用 main.js 中的函数
        console.log('Binding theme toggle button event');
    } else {
        console.error("Theme toggle button with ID 'theme-toggle-btn' not found.");
    }


     // 其他 UI 事件，如设置区域的 change 事件在 main.js 中绑定
     // 图片生成按钮的事件监听器在 main.js 中绑定了
}

/**
 * 切换到指定的聊天框 UI
 */
export function switchChatUI(chatId) {
    document.querySelectorAll('#chat-list li.active').forEach(item => {
        item.classList.remove('active');
    });

    const currentChatItem = document.querySelector(`#chat-list li[data-chat-id="${chatId}"]`);
    if (currentChatItem) {
        currentChatItem.classList.add('active');
    }
    // 切换聊天时，清空消息列表 UI，由 renderMessages 重新渲染
    const messagesListElement = document.getElementById('messages-list');
     if (messagesListElement) {
        messagesListElement.innerHTML = '';
     }
}


/**
 * 添加消息到当前聊天框的 UI (非流式或首次添加流式消息)
 * @param {object} message - 消息对象 { sender: 'user'|'ai', content: '...', files: [], type?: 'text' | 'image' | 'audio', url?: string }
 * @param {boolean} shouldScroll - 是否滚动到底部
 * @returns {Element} 返回新创建的消息 DOM 元素
 */
export function addMessageToUI(message, shouldScroll) {
    const messagesListElement = document.getElementById('messages-list');
    const messageTemplate = document.getElementById('message-template');
    if (!messageTemplate || !messagesListElement) {
         console.error("Error: Message template or messages list element not found.");
         return null; // 返回 null 表示创建失败
    }
    const messageElement = messageTemplate.content.cloneNode(true).querySelector('.message');

    messageElement.classList.add(message.sender);
    messageElement.querySelector('.sender').textContent = message.sender === 'user' ? '你' : 'AI';

    const contentElement = messageElement.querySelector('.content');
    if (contentElement) {
        // 对于文本消息，渲染 Markdown，并添加代码块复制功能
        if (message.type === 'text' || message.type === undefined) {
             if (typeof marked !== 'undefined') {
                 let renderedHtml = marked.parse(message.content || '');
                 contentElement.innerHTML = renderedHtml;
                 // 添加复制按钮和高亮在 renderMessages 或 stream onComplete 中处理
                 // addCopyButtonsToCodeBlocks(contentElement);
             } else {
                 contentElement.textContent = message.content || '';
             }
        }
        // 如果是图片或音频类型，初始这里不设置内容，而是由 updateMessageWithImage/Audio 在后续处理
    }

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
     if (!messageTemplate || !messagesListElement) {
         console.error("Error: Message template or messages list element not found.");
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

     return messageElement; // 返回元素引用, 以便后续更新内容
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
         // 在流式更新时，只更新文本内容（或简单的HTML），避免复杂的 Markdown 渲染和高亮，
         // 它们应该在流结束后一次性处理。
         if (typeof marked !== 'undefined') {
              contentElement.innerHTML = marked.parse(content);
         } else {
             contentElement.textContent = content;
         }

         // 确保滚动到底部
         const messagesListElement = document.getElementById('messages-list');
         if (messagesListElement) {
             messagesListElement.scrollTop = messagesListElement.scrollHeight;
         }
    }
}
// ** 流式消息函数结束 **


// ** 新增：添加代码块复制按钮和逻辑 **
/**
 * 在 Markdown 渲染后的代码块中添加复制按钮
 * @param {Element} containerElement - 包含 Markdown 内容的 DOM 元素 (.content)
 */
export function addCopyButtonsToCodeBlocks(containerElement) {
     const codeBlocks = containerElement.querySelectorAll('pre > code'); // 查找 <pre><code> 结构

     codeBlocks.forEach(codeElement => {
         const preElement = codeElement.parentElement; // 获取父级 <pre> 元素

         // 检查是否已经添加过复制按钮，避免重复
         if (preElement.querySelector('.copy-code-button')) {
             return;
         }

         const copyButton = document.createElement('button');
         copyButton.classList.add('copy-code-button');
         copyButton.textContent = 'Copy';

         // 绑定点击事件
         copyButton.addEventListener('click', async () => {
             const codeToCopy = codeElement.textContent; // 获取代码文本

             try {
                 await navigator.clipboard.writeText(codeToCopy); // 使用 Clipboard API 复制
                 copyButton.textContent = 'Copied!';
                 copyButton.classList.add('copied');
                 // 复制成功后，短暂显示“Copied!”然后恢复
                 setTimeout(() => {
                     copyButton.textContent = 'Copy';
                      copyButton.classList.remove('copied');
                 }, 2000); // 显示 2 秒
             } catch (err) {
                 console.error('Failed to copy code: ', err);
                 copyButton.textContent = 'Error!';
                 copyButton.classList.add('copied');
                 setTimeout(() => {
                     copyButton.textContent = 'Copy';
                      copyButton.classList.remove('copied');
                 }, 2000);
             }
         });

         preElement.appendChild(copyButton); // 将按钮添加到 <pre> 元素
     });
}


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
        if (altText) {
             const promptText = document.createElement('p');
             promptText.textContent = `提示词: ${altText}`;
             promptText.style.fontSize = '0.9em';
              promptText.style.color = 'var(--message-sender-ai)'; // 使用 AI sender 颜色变量
             contentElement.appendChild(promptText);
        }


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
         if (description) {
             const descriptionText = document.createElement('p');
             descriptionText.textContent = `文本: ${description}`;
             descriptionText.style.fontSize = '0.9em';
              descriptionText.style.color = 'var(--message-sender-ai)'; // 使用 AI sender 颜色变量
             contentElement.appendChild(descriptionText);
         }

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

    event.target.value = ''; // 清空文件输入框，以便再次选择相同文件能触发 change 事件
     // ** 重要：在这里调用保存函数 **
     if (currentChatId) { // 确保有当前聊天ID
          saveChatData(chats);
     }
}

/**
 * 添加已上传文件到 UI 列表
 * ... (保持不变) ...
 */
function addUploadedFileToUI(fileInfo) {
     const uploadedFilesListElement = document.getElementById('uploaded-files-list');
     const fileItemTemplate = document.getElementById('file-item-template');
    if (!uploadedFilesListElement || !fileItemTemplate) {
         console.error("Error: Uploaded files list or template element not found.");
         return;
    }
     const fileItemElement = fileItemTemplate.content.cloneNode(true).querySelector('li');

     fileItemElement.dataset.fileId = fileInfo.id;
    const spanElement = fileItemElement.querySelector('span');
    if(spanElement) {
        spanElement.textContent = fileInfo.name;
    }

    // 移除按钮事件监听在 initializeUI 中通过事件委托绑定到 #uploaded-files-list
    // 这里只需要添加元素到 DOM
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
 */
 export function populateModelSelect(models, currentModel) {
    const modelSelectElement = document.getElementById('model-select');
    if (!modelSelectElement) {
        console.error("Error: Model select element with ID 'model-select' not found.");
        return;
    }
    modelSelectElement.innerHTML = '';

    if (Array.isArray(models) && models.length > 0) {
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = model.description || model.name;

            if (model.name === currentModel) {
                option.selected = true;
            }

            modelSelectElement.appendChild(option);
        });
         // 如果当前没有选中模型，默认选中第一个
         if (modelSelectElement.value === '') {
             modelSelectElement.value = models[0].name;
         }

    } else {
        console.warn("populateModelSelect received empty or non-array models:", models);
         const option = document.createElement('option');
         option.value = ''; // 设置一个空值或特定值表示无模型
         option.textContent = '加载模型失败或无可用模型';
         modelSelectElement.appendChild(option);
         modelSelectElement.disabled = true; // 没有模型时禁用选择框
    }
}

/**
 * 更新侧边栏的聊天列表 UI
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
                            ? (chat.messages[0].content || '').substring(0, 20) + ((chat.messages[0].content || '').length > 20 ? '...' : '')
                            : `新聊天 (${chatId ? chatId.substring(0, 4) : ''})`); // 检查 chatId 是否存在

         // 如果截断后的标题是空的，则提供一个默认名称
         if (chatTitle.trim() === '' || chatTitle === '...') {
             chatTitle = chat.name || `新聊天 (${chatId ? chatId.substring(0, 4) : ''})`;
         }


        const spanElement = listItem.querySelector('span');
        if(spanElement) {
             spanElement.textContent = chatTitle;
        }

        if (chatId === currentChatId) {
            listItem.classList.add('active');
        }

        // 删除按钮事件监听在 main.js 中通过事件委托绑定到 #chat-list
        // 这里只需要将按钮添加到 DOM
        const deleteButton = listItem.querySelector('.delete-chat');
        if(deleteButton) {
             deleteButton.dataset.chatId = chatId; // 将 chatId 存储到删除按钮上
        }


        chatListElement.appendChild(listItem);
    });
}

/**
 * 更新主题切换按钮的文本和图标
 * @param {string} theme - 当前主题 ('light' or 'dark')
 */
export function updateThemeToggleButton(theme) {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        const icon = themeToggleBtn.querySelector('i');
        if (icon) {
            if (theme === 'dark') {
                icon.classList.remove('fa-sun');
                icon.classList.add('fa-moon');
            } else {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
            }
        }
        // 可以移除文本，只保留图标
        // themeToggleBtn.textContent = `切换模式 (当前: ${theme === 'dark' ? '黑夜' : '白天'})`;
    }
}

