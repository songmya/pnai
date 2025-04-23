// js/ui.js

import {
    // 导入 ui.js 需要调用的所有 main.js 函数或变量
    sendMessage,
    currentChatId,
    chats,
    clearCurrentChatContext,
    toggleTheme,
    updateVoiceSelectUI, // 导入在 main.js 中实现的语音选择 UI 更新函数
    updateVoiceSelectVisibility // 导入在 main.js 中实现的语音选择可见性函数
} from './main.js';

// 导入 utils.js 中的函数
import { generateUniqueId } from './utils.js';

// import { saveChatData } from './storage.js'; // 不再直接在 ui.js 中保存数据，而是通过事件通知 main.js


/**
 * 初始化 UI 事件监听器
 */
function initializeUI() {
    // 事件监听器调用从 main.js 导入的函数
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
                 removeUploadedFile(fileId); // UI 移除由 removeUploadedFile 处理，数据移除和保存由 main.js 处理
            }
        }
    });

    // 绑定清除上下文按钮事件 (调用从 main.js 导入的函数)
     const clearContextBtn = document.getElementById('clear-context-btn');
     if (clearContextBtn) {
         clearContextBtn.addEventListener('click', clearCurrentChatContext);
         console.log('Binding clear context button event');
     } else {
         console.error("Clear context button with ID 'clear-context-btn' not found.");
     }

    // 绑定主题切换按钮事件 (调用从 main.js 导入的函数)
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
        console.log('Binding theme toggle button event');
    } else {
        console.error("Theme toggle button with ID 'theme-toggle-btn' not found.");
    }

    // 绑定侧边栏开关按钮事件 (调用 ui.js 中导出的函数)
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn'); // 侧边栏内的关闭按钮
    const sidebarOpenBtn = document.getElementById('sidebar-open-btn'); // 主内容区内的打开按钮

    if (sidebarToggleBtn) {
         sidebarToggleBtn.addEventListener('click', closeSidebar);
         console.log('Binding sidebar toggle button event (close)');
    } else {
         console.error("Sidebar toggle button with ID 'sidebar-toggle-btn' not found.");
    }

    if (sidebarOpenBtn) {
         sidebarOpenBtn.addEventListener('click', openSidebar);
          console.log('Binding sidebar open button event');
    } else {
         console.error("Sidebar open button with ID 'sidebar-open-btn' not found.");
    }

    // 其他 UI 事件，如设置区域的 change 事件在 main.js 中绑定
    // 图片生成按钮的事件监听器在 main.js 中绑定了
}

/**
 * 打开侧边栏 (在小屏幕上)
 * 这个函数只在 ui.js 中实现和调用，由侧边栏按钮事件触发。
 */
function openSidebar() {
    document.body.classList.add('sidebar-open');
     // 在侧边栏打开时显示关闭按钮，隐藏打开按钮
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebarOpenBtn = document.getElementById('sidebar-open-btn');
    if(sidebarToggleBtn) sidebarToggleBtn.style.display = 'flex';
    if(sidebarOpenBtn) sidebarOpenBtn.style.display = 'none';
}

/**
 * 关闭侧边栏 (在小屏幕上)
 * 这个函数只在 ui.js 中实现和调用，由侧边栏按钮事件触发。
 */
function closeSidebar() {
     // 只在屏幕宽度小于 768px 时执行关闭操作
    if (window.innerWidth < 768) {
        document.body.classList.remove('sidebar-open');
         // 在侧边栏关闭时隐藏关闭按钮，显示打开按钮
        const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
        const sidebarOpenBtn = document.getElementById('sidebar-open-btn');
         if(sidebarToggleBtn) sidebarToggleBtn.style.display = 'none';
         if(sidebarOpenBtn) sidebarOpenBtn.style.display = 'flex';
    }
}

/**
 * 切换到指定的聊天框 UI
 * 这个函数在 ui.js 中实现，由 main.js 中的 switchChat 调用。
 */
function switchChatUI(chatId) {
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

     // 在小屏幕上切换聊天时，自动关闭侧边栏
    if (window.innerWidth < 768) {
         closeSidebar();
    }
}


/**
 * 添加消息到当前聊天框的 UI (非流式或首次添加流式消息)
 * 支持渲染不同类型的消息 (text, image, audio)。
 * 这个函数在 ui.js 中实现，由 main.js 调用。
 * @param {object} message - 消息对象 { sender: 'user'|'ai', content: '...', type?: 'text' | 'image' | 'audio', url?: string, files?: Array<{ name: string, type: string }> }
 * @param {boolean} shouldScroll - 是否滚动到底部
 * @returns {Element} 返回新创建的消息 DOM 元素
 */
function addMessageToUI(message, shouldScroll) {
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
        // 根据消息类型渲染内容
        if (message.type === 'image' && message.url) {
             // 调用本地 ui.js 中的函数来更新为图片
            updateMessageWithImage(messageElement, message.url, message.content || '图片');

        } else if (message.type === 'audio' && message.url) {
            // 调用本地 ui.js 中的函数来更新为音频
            updateMessageWithAudio(messageElement, message.url, message.content || '');

        } else { // 默认为文本类型 或 type 未定义
            // 对于文本消息，渲染 Markdown
             if (typeof marked !== 'undefined') {
                 let renderedHtml = marked.parse(message.content || '');
                 contentElement.innerHTML = renderedHtml;
                 // 代码高亮和复制按钮在 main.js 的 renderMessages 或 stream onComplete 中处理 (调用 ui.js 中的函数)
                 // 这里在 addMessageToUI 首次渲染时不做，仅在 main.js 的 final 渲染时做，避免重复
             } else {
                 contentElement.textContent = message.content || '';
             }
        }
        // 用户消息中的文件列表渲染在 main.js 的 renderMessages 中处理
    }

    messagesListElement.appendChild(messageElement);

    if (shouldScroll) {
        messagesListElement.scrollTop = messagesListElement.scrollHeight;
    }

    return messageElement; // 返回消息元素以便后续更新 (用于流式或更新为图片/音频)
}

// 添加处理流式消息的函数
/**
 * 为流式回复添加一个空的 AI 消息元素到 UI
 * 这个函数在 ui.js 中实现，由 main.js 调用。
 * @returns {Element} 返回新创建的 AI 消息 DOM 元素
 */
function addStreamingMessageToUI() {
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
 * 这个函数在 ui.js 中实现，由 main.js 调用。
 * @param {Element} messageElement - 要更新的消息 DOM 元素
 * @param {string} content - 要更新的文本内容
 */
function updateStreamingMessageUI(messageElement, content) {
    if (!messageElement) return;
    const contentElement = messageElement.querySelector('.content');
    if (contentElement) {
         // 在流式更新时，只更新文本内容（或简单的HTML），避免复杂的 Markdown 渲染和高亮，
         // 它们应该在流结束后一次性处理。
         if (typeof marked !== 'undefined') {
              // 每次更新都重新解析整个内容并设置 innerHTML，性能可能不是最优
              // 但对于小块更新和普通 Markdown 来说通常够用
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
// 流式消息函数结束


// 添加代码块复制按钮和逻辑
/**
 * 在 Markdown 渲染后的代码块中添加复制按钮
 * 这个函数在 ui.js 中实现，由 main.js 调用。
 * @param {Element} containerElement - 包含 Markdown 内容的 DOM 元素 (.content)
 */
function addCopyButtonsToCodeBlocks(containerElement) {
     const codeBlocks = containerElement.querySelectorAll('pre > code'); // 查找 <pre><code> 结构

     codeBlocks.forEach(codeElement => {
         const preElement = codeElement.parentElement; // 获取父级 <pre>元素

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


// 添加更新消息为图片/音频的函数 - 这些函数现在移到 ui.js 中实现并导出
/**
 * 更新消息元素的内容为图片
 * 这个函数在 ui.js 中实现，由 ui.js 中的 addMessageToUI 和 main.js 中的 generateImage 调用。
 * @param {Element} messageElement - 要更新的消息 DOM 元素
 * @param {string} imageUrl - 图片 URL
 * @param {string} altText - 图片的替代文本 (通常是提示词)
 */
function updateMessageWithImage(messageElement, imageUrl, altText = '') {
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
        img.onerror = () => { // 图片加载失败处理
                 console.error("Failed to load image:", imageUrl);
                 contentElement.innerHTML = `<p>图片加载失败: ${imageUrl}</p>`;
             };
        contentElement.appendChild(img);

        // 添加原始提示词作为文本（可选）
        if (altText && altText.trim() !== '') {
             const promptText = document.createElement('p');
             promptText.textContent = `提示词: ${altText}`;
             promptText.style.fontSize = '0.9em';
              // 使用 AI sender 颜色变量 (即使是用户消息中的图片，这个描述也是 AI 消息的一部分)
              // 或者根据 messageElement 的 class 判断是用户还是AI消息
             const senderClass = messageElement.classList.contains('user') ? 'user' : 'ai';
             promptText.style.color = `var(--message-sender-${senderClass})`;
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
 * 这个函数在 ui.js 中实现，由 ui.js 中的 addMessageToUI 调用。
 * @param {Element} messageElement - 要更新的消息 DOM 元素
 * @param {string} audioUrl - 音频 URL
 * @param {string} description - 音频描述 (通常是文本转音频的输入文本)
 */
function updateMessageWithAudio(messageElement, audioUrl, description = '') {
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
         audio.onerror = () => { // 音频加载失败处理
                 console.error("Failed to load audio:", audioUrl);
                 contentElement.innerHTML = `<p>音频加载失败: ${audioUrl}</p>`;
             };
        contentElement.appendChild(audio);

         // 添加原始文本作为描述（可选）
         if (description && description.trim() !== '') {
             const descriptionText = document.createElement('p');
             descriptionText.textContent = `文本: ${description}`;
             descriptionText.style.fontSize = '0.9em';
              // 使用 AI sender 颜色变量 (即使是用户消息中的音频，这个描述也是 AI 消息的一部分)
              const senderClass = messageElement.classList.contains('user') ? 'user' : 'ai';
              descriptionText.style.color = `var(--message-sender-${senderClass})`;
             contentElement.appendChild(descriptionText);
         }

         // 确保滚动到底部
         const messagesListElement = document.getElementById('messages-list');
         if (messagesListElement) {
             messagesListElement.scrollTop = messagesListElement.scrollHeight;
         }
     }
}
// 更新消息为图片/音频的函数结束


/**
 * 处理文件上传 input change 事件
 * 将选择的文件添加到当前聊天的 uploadedFiles 数组中，并更新 UI。
 * 触发 filesUpdated 事件通知 main.js 数据已改变。
 * 这个函数只在 ui.js 中实现和调用。
 */
function handleFileUpload(event) {
    const files = event.target.files;
    // 使用从 main.js 导入的 currentChatId 和 chats
    if (files.length === 0 || !currentChatId || !chats[currentChatId]) {
        return;
    }

    const currentChat = chats[currentChatId];

    // 创建文件信息的临时数组，包含 File 对象
    const newUploadedFiles = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileId = generateUniqueId();

        // 将文件信息添加到临时数组
         newUploadedFiles.push({
            id: fileId,
            name: file.name,
            type: file.type,
            size: file.size,
            file: file // 存储 File Object
        });

        // 添加文件到 UI 列表 (调用 ui.js 中导出的函数)
        addUploadedFileToUI({ id: fileId, name: file.name });
    }

    // 更新当前聊天的 uploadedFiles 数组
    currentChat.uploadedFiles = currentChat.uploadedFiles.concat(newUploadedFiles);
     console.log("Files added. Current uploadedFiles in chats object:", currentChat.uploadedFiles);


    event.target.value = ''; // 清空文件输入框，以便再次选择相同文件能触发 change 事件

      // 触发自定义事件，通知 main.js 文件列表已更新
     if (currentChatId) {
        document.dispatchEvent(new CustomEvent('filesUpdated', { detail: { chatId: currentChatId, files: currentChat.uploadedFiles } }));
     }
}

/**
 * 添加已上传文件到 UI 列表
 * 这个函数在 ui.js 中实现，由 ui.js 中的 handleFileUpload 和 updateUploadedFilesUI 调用。
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
 * 从当前聊天的 uploadedFiles 数组中移除，并更新 UI。
 * 触发 filesUpdated 事件通知 main.js 数据已改变。
 * 这个函数只在 ui.js 中实现和调用。
 * @param {string} fileId - 要移除的文件的 ID
 */
function removeUploadedFile(fileId) {
     // 使用从 main.js 导入的 currentChatId 和 chats
     if (!currentChatId || !chats[currentChatId]) {
         return;
    }

    const currentChat = chats[currentChatId];

    // 从数据中移除文件
    const initialFileCount = currentChat.uploadedFiles.length;
    currentChat.uploadedFiles = currentChat.uploadedFiles.filter(file => file.id !== fileId);
    const fileRemoved = currentChat.uploadedFiles.length < initialFileCount;

    // 从 UI 中移除文件列表项
    const fileItemElement = document.querySelector(`#uploaded-files-list li[data-file-id="${fileId}"]`);
    if (fileItemElement) {
        fileItemElement.remove();
    }

     console.log(`Removed file with ID: ${fileId}. Updated uploadedFiles in chats object:`, currentChat.uploadedFiles);
     // 触发自定义事件，通知 main.js 文件列表已更新
     if (fileRemoved && currentChatId) {
          document.dispatchEvent(new CustomEvent('filesUpdated', { detail: { chatId: currentChatId, files: currentChat.uploadedFiles } }));
     }
}


/**
 * 更新设置区域（模型选择和系统提示词）的 UI
 * 这个函数在 ui.js 中实现，由 main.js 调用。
 */
function updateSettingsUI(model, systemPrompt) {
    const modelSelectElement = document.getElementById('model-select');
    const systemPromptElement = document.getElementById('system-prompt');

    if (modelSelectElement) {
        modelSelectElement.value = model || '';
    }
    if (systemPromptElement) {
        systemPromptElement.value = systemPrompt || '';
    }
    // 注意：语音选择 UI 的更新由 updateVoiceSelectUI 函数处理 (从 main.js 导入)
    // 可见性由 updateVoiceSelectVisibility 处理 (从 main.js 导入)
}

/**
 * 更新已上传文件列表的 UI
 * 这个函数在 ui.js 中实现，由 main.js 中的 switchChat 和 sendMessage 调用。
 */
function updateUploadedFilesUI(files) {
    const uploadedFilesListElement = document.getElementById('uploaded-files-list');
    if (!uploadedFilesListElement) {
        console.error("Error: Uploaded files list element with ID 'uploaded-files-list' not found.");
        return;
    }
    uploadedFilesListElement.innerHTML = '';

    if (Array.isArray(files)) {
        files.forEach(file => {
            // addUploadedFileToUI 需要的是 { id, name }
            addUploadedFileToUI({ id: file.id, name: file.name });
        });
    } else {
        console.error("updateUploadedFilesUI expects an array, but received:", files);
    }
}

/**
 * 根据获取的模型列表填充模型选择下拉框
 * 这个函数在 ui.js 中实现，由 main.js 调用。
 */
 function populateModelSelect(models, currentModel) {
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
             // 显示模型描述（如果存在），否则显示模型名称
            option.textContent = model.description && model.description.trim() !== '' ? model.description : model.name;

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
 * 这个函数在 ui.js 中实现，由 main.js 调用。
 */
function updateChatListUI(allChats, currentChatId) {
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

        // 确定聊天标题：优先使用保存的 name，否则使用第一条用户消息的前缀，否则使用 ID 的一部分
        let chatTitle = chat.name; // 使用保存的 name

         // 如果没有保存的 name，尝试使用第一条用户消息的内容作为标题
         if (!chatTitle || chatTitle.trim() === '') {
              const firstUserMessage = chat.messages ? chat.messages.find(msg => msg.sender === 'user') : null;
              if (firstUserMessage && firstUserMessage.content && typeof firstUserMessage.content === 'string') {
                   chatTitle = firstUserMessage.content.trim().substring(0, 20) + (firstUserMessage.content.trim().length > 20 ? '...' : '');
              }
         }

         // 如果依然没有标题，使用 ID 的一部分
         if (!chatTitle || chatTitle.trim() === '') {
             chatTitle = `新聊天 (${chatId ? chatId.substring(0, 4) : ''})`;
         }


        const spanElement = listItem.querySelector('span');
        if(spanElement) {
             spanElement.textContent = chatTitle;
        }

        if (chatId === currentChatId) {
            listItem.classList.add('active');
        }

        // 删除按钮事件监听在 initializeUI 中通过事件委托绑定到 #chat-list
        // 这里只需要将按钮添加到 DOM
        const deleteButton = listItem.querySelector('.delete-chat');
        if(deleteButton) {
             deleteButton.dataset.chatId = chatId; // 将 chatId 存储到删除按钮上
        }


        chatListElement.appendChild(listItem);
    });
}

/**
 * 清空当前聊天窗口的消息列表 UI
 * 这个函数在 ui.js 中实现，由 main.js 中的 clearCurrentChatContext 调用。
 */
function clearMessagesUI() {
    const messagesListElement = document.getElementById('messages-list');
    if (messagesListElement) {
        messagesListElement.innerHTML = '';
    }
}

/**
 * 更新主题切换按钮的文本和图标
 * 这个函数在 ui.js 中实现，由 main.js 中的 applyTheme 调用。
 * @param {string} theme - 当前主题 ('light' or 'dark')
 */
function updateThemeToggleButton(theme) {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        const icon = themeToggleBtn.querySelector('i');
        if (icon) {
            if (theme === 'dark') {
                icon.classList.remove('fa-sun');
                icon.classList.add('fa-moon');
                 themeToggleBtn.title = "切换至白天模式";
            } else {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
                 themeToggleBtn.title = "切换至黑夜模式";
            }
        }
        // 可以移除文本，只保留图标
        // themeToggleBtn.textContent = `切换模式 (当前: ${theme === 'dark' ? '黑夜' : '白天'})`;
    }
}

// 导出 ui.js 中的所有函数，供 main.js 调用
export {
    initializeUI,
    switchChatUI,
    addMessageToUI,
    updateSettingsUI,
    updateUploadedFilesUI,
    updateChatListUI,
    populateModelSelect,
    addStreamingMessageToUI,
    updateStreamingMessageUI,
    addCopyButtonsToCodeBlocks,
    updateMessageWithImage,
    updateMessageWithAudio,
    clearMessagesUI,
    openSidebar,
    closeSidebar,
    updateThemeToggleButton
};

