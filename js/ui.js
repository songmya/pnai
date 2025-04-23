import { sendMessage, currentChatId, chats } from './main.js';
import { generateUniqueId } from './utils.js';
// 注意：ui.js 不应该直接依赖 chats 和 currentChatId
// 这些数据应该通过函数参数传递进来，以保持模块的独立性
// 暂时保留导入以便代码能够运行，但在更复杂的应用中应避免

/**
 * 初始化 UI 事件监听器
 */
export function initializeUI() {
    // ... (保持不变)
    // 绑定发送按钮点击事件
    document.getElementById('send-btn').addEventListener('click', sendMessage);

    // 绑定输入框回车发送事件 (可选，如果需要)
    document.getElementById('user-input').addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) { // 避免 Shift+Enter 换行也发送
            event.preventDefault(); // 阻止默认的换行行为
            // 调用 main.js 中的 sendMessage 函数
            sendMessage();
        }
    });

    // 绑定文件上传 input change 事件
    document.getElementById('file-upload').addEventListener('change', handleFileUpload);

    // 绑定上传文件列表删除按钮事件 (通过事件委托)
    document.getElementById('uploaded-files-list').addEventListener('click', (event) => {
        if (event.target.classList.contains('remove-file')) {
            const listItem = event.target.closest('li');
            if (listItem) {
                const fileId = listItem.dataset.fileId;
                // 调用 main.js 中的 removeUploadedFile 函数 (如果 removeUploadedFile 也在 main.js 的话)
                // 或者在这里直接处理 UI 移除和数据更新 (如果 ui.js 负责这部分的话)
                // 假设 removeUploadedFile 已经在 main.js 中处理数据和 UI 更新了
                // removeUploadedFile(fileId); // <-- 如果 removeUploadedFile 在 main.js 中且被导出
                // 由于您提供的代码中 removeUploadedFile 在 ui.js 中，我们将在这里调用它
                removeUploadedFile(fileId);
            }
        }
    });

     // 可以绑定其他 UI 事件，如设置区域的交互等
}

/**
 * 切换到指定的聊天框 UI
 * @param {string} chatId - 要切换到的聊天会话 ID
 */
export function switchChatUI(chatId) {
    // 移除之前活动聊天的激活样式
    document.querySelectorAll('#chat-list li.active').forEach(item => {
        item.classList.remove('active');
    });

    // 给当前活动聊天添加激活样式
    const currentChatItem = document.querySelector(`#chat-list li[data-chat-id="${chatId}"]`);
    if (currentChatItem) {
        currentChatItem.classList.add('active');
    }

    // TODO: 如果你创建了多个独立的聊天框 DOM 元素，这里需要切换显示/隐藏
    // 示例：目前只有一个 current-chat-box，所以只需要更新其内容
    // 更复杂的实现会创建多个 .chat-box 元素，并根据 currentChatId 来显示/隐藏
    // const currentChatBox = document.getElementById('current-chat-box');
    // 在更复杂的实现中，你可能会根据 chatId 查找并显示对应的聊天框元素
    // 这里我们只更新内容，因为 DOM 结构只有一个聊天框区域
}


/**
 * 添加消息到当前聊天框的 UI
 * @param {object} message - 消息对象 { sender: 'user'|'ai', content: '...', files: [] }
 * @param {boolean} shouldScroll - 是否滚动到底部
 */
export function addMessageToUI(message, shouldScroll) {
    const messagesListElement = document.getElementById('messages-list');
    const messageTemplate = document.getElementById('message-template');
    // 确保 template 存在
    if (!messageTemplate) {
         console.error("Error: Message template element with ID 'message-template' not found.");
         return;
    }
    const messageElement = messageTemplate.content.cloneNode(true).querySelector('.message');

    messageElement.classList.add(message.sender);
    messageElement.querySelector('.sender').textContent = message.sender === 'user' ? '你' : 'AI';

    // 如果使用 Markdown 库，在这里进行渲染
	if (typeof marked !== 'undefined') {
		messageElement.querySelector('.content').innerHTML = marked.parse(message.content);
	} else {
		messageElement.querySelector('.content').textContent = message.content; // 如果 marked.js 未加载，则直接显示文本
	}

    // TODO: 处理消息中的文件信息显示 (如果需要)

    messagesListElement.appendChild(messageElement);

    if (shouldScroll) {
        messagesListElement.scrollTop = messagesListElement.scrollHeight;
    }
}

/**
 * 处理文件上传 input change 事件
 * @param {Event} event - change 事件对象
 */
function handleFileUpload(event) {
    const files = event.target.files;
    // 注意：currentChatId 和 chats 从 main.js 导入，可能会有延迟或同步问题
    // 更好的做法是在 main.js 中处理文件上传的数据逻辑，并在 ui.js 中只处理 UI 更新
    // 暂时保留以匹配您现有结构
    if (files.length === 0 || !currentChatId || !chats[currentChatId]) {
        return;
    }

    const currentChat = chats[currentChatId];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileId = generateUniqueId(); // 为每个文件生成唯一 ID

        // 将文件信息添加到当前聊天会话的数据中 (这部分应该在 main.js 中处理)
        // currentChat.uploadedFiles.push({
        //     id: fileId,
        //     name: file.name,
        //     type: file.type,
        //     size: file.size,
        //     file: file // 存储 File 对象以便后续读取内容
        // });

        // 更新 UI 显示已上传文件列表
        addUploadedFileToUI({ id: fileId, name: file.name });
         // 将文件数据传递给 main.js 进行存储
         // 这需要 main.js 暴露一个函数来处理添加文件
         // 例如：main.addFileToCurrentChat({ id: fileId, name: file.name, ... file });
         // 暂时假设 ui.js 直接修改了 chats 对象
          chats[currentChatId].uploadedFiles.push({
            id: fileId,
            name: file.name,
            type: file.type,
            size: file.size,
            file: file // 存储 File 对象以便后续读取内容
        });
         // TODO: 需要在 main.js 中保存 chats 对象到 localStorage
    }

    // 清空文件 input 的值，以便再次选择相同文件时也能触发 change 事件
    event.target.value = '';
}

/**
 * 添加已上传文件到 UI 列表
 * @param {object} fileInfo - 文件信息 { id: '...', name: '...' }
 */
function addUploadedFileToUI(fileInfo) {
     const uploadedFilesListElement = document.getElementById('uploaded-files-list');
     const fileItemTemplate = document.getElementById('file-item-template');
      // 确保 template 存在
    if (!fileItemTemplate) {
         console.error("Error: File item template element with ID 'file-item-template' not found.");
         return;
    }
     const fileItemElement = fileItemTemplate.content.cloneNode(true).querySelector('li');

     fileItemElement.dataset.fileId = fileInfo.id;
     // 确保 span 元素存在
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
    // 注意：currentChatId 和 chats 从 main.js 导入，可能会有延迟或同步问题
    // 更好的做法是在 main.js 中处理文件删除的数据逻辑，并在 ui.js 中只处理 UI 移除
    // 暂时保留以匹配您现有结构
    if (!currentChatId || !chats[currentChatId]) {
         return;
    }

    const currentChat = chats[currentChatId];

    // 从数据中移除文件 (这部分应该在 main.js 中处理)
    currentChat.uploadedFiles = currentChat.uploadedFiles.filter(file => file.id !== fileId);
    // TODO: 需要在 main.js 中保存 chats 对象到 localStorage

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
        modelSelectElement.value = model || ''; // 提供默认值
    }
    if (systemPromptElement) {
        systemPromptElement.value = systemPrompt || ''; // 提供默认值
    }
}

/**
 * 更新已上传文件列表的 UI
 * @param {Array} files - 已上传文件数组 [{ id: '...', name: '...', type: '...', size: '...', file: File }]
 */
export function updateUploadedFilesUI(files) {
    const uploadedFilesListElement = document.getElementById('uploaded-files-list');
     // 确保元素存在
    if (!uploadedFilesListElement) {
        console.error("Error: Uploaded files list element with ID 'uploaded-files-list' not found.");
        return;
    }
    uploadedFilesListElement.innerHTML = ''; // 清空当前列表

    // 确保 files 是一个数组
    if (Array.isArray(files)) {
        files.forEach(file => {
            addUploadedFileToUI({ id: file.id, name: file.name });
        });
    } else {
        console.error("updateUploadedFilesUI expects an array, but received:", files);
    }
}

// ** 添加 updateChatListUI 函数到 ui.js **
/**
 * 更新侧边栏的聊天列表 UI
 * @param {object} allChats - 包含所有聊天会话的对象 { chatId: chatData, ... }
 * @param {string} currentChatId - 当前活跃的聊天会话 ID
 */
 export function populateModelSelect(models, currentModel) {
    const modelSelectElement = document.getElementById('model-select');
    if (!modelSelectElement) {
        console.error("Error: Model select element with ID 'model-select' not found.");
        return;
    }
    // 清空现有选项 (除了可能的默认占位符或第一个选项，根据需要调整)
    // Simple clear:
    modelSelectElement.innerHTML = '';
    // 添加新的选项
    if (Array.isArray(models)) {
        models.forEach(model => {
            // 创建 option 元素
            const option = document.createElement('option');
            // option 的 value 通常是模型的 name，用于在后端或 API 中识别
            option.value = model.name;
            // option 的文本显示 description，以便用户理解
            option.textContent = model.description || model.name; // 如果没有 description，显示 name
            // 如果当前模型匹配，则设置为选中状态
            if (model.name === currentModel) {
                option.selected = true;
            }
            // 添加到 select 元素中
            modelSelectElement.appendChild(option);
        });
    } else {
        console.error("populateModelSelect expects an array, but received:", models);
         // 添加一个默认选项或错误提示
         const option = document.createElement('option');
         option.value = '';
         option.textContent = '加载模型失败或无可用模型';
         modelSelectElement.appendChild(option);
    }
     // 如果加载后当前聊天没有设置模型，或者设置的模型不再列表里，
     // 可以默认选中第一个选项（如果存在）
     if (modelSelectElement.value === '' && models.length > 0) {
         modelSelectElement.value = models[0].name;
         // TODO: 需要通知 main.js 更新当前聊天的 model 属性
     }
}
// ** populateModelSelect 函数结束 **

export function updateChatListUI(allChats, currentChatId) {
    const chatListElement = document.getElementById('chat-list');
    const listItemTemplate = document.getElementById('chat-list-item-template');

    // 确保找到了容器和模板
    if (!chatListElement || !listItemTemplate) {
        console.error("Error: Chat list container or template element not found.");
        return;
    }

    chatListElement.innerHTML = ''; // 清空当前列表

    const chatIds = Object.keys(allChats);
    chatIds.forEach(chatId => {
        const chat = allChats[chatId];
        const listItem = listItemTemplate.content.cloneNode(true).querySelector('li'); // 使用模板创建 li

        listItem.dataset.chatId = chatId;

        // 显示聊天会话的标题，优先使用存储的 name 属性
        const chatTitle = chat.name || // 使用存储的 name 属性
                          (chat.messages && chat.messages.length > 0
                            ? chat.messages[0].content.substring(0, 20) + (chat.messages[0].content.length > 20 ? '...' : '')
                            : `新聊天 (${chatId.substring(0, 4)})`); // 如果没有 name 且没有消息，使用默认生成方式

        const spanElement = listItem.querySelector('span');
        if(spanElement) {
             spanElement.textContent = chatTitle;
        }

        if (chatId === currentChatId) {
            listItem.classList.add('active');
        }

        // 注意：删除按钮的事件监听应该在 main.js 中通过事件委托处理

        chatListElement.appendChild(listItem);
    });
}
// ** updateChatListUI 函数结束 **


// TODO: 添加更多 UI 操作函数，例如显示加载状态、错误提示等
