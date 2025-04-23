import { sendMessage, currentChatId, chats } from './main.js';
import { generateUniqueId } from './utils.js';

/**
 * 初始化 UI 事件监听器
 */
export function initializeUI() {
    // 绑定发送按钮点击事件
    document.getElementById('send-btn').addEventListener('click', sendMessage);

    // 绑定输入框回车发送事件 (可选，如果需要)
    document.getElementById('user-input').addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) { // 避免 Shift+Enter 换行也发送
            event.preventDefault(); // 阻止默认的换行行为
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
    const currentChatBox = document.getElementById('current-chat-box');
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
    const messageElement = messageTemplate.content.cloneNode(true).querySelector('.message');

    messageElement.classList.add(message.sender);
    messageElement.querySelector('.sender').textContent = message.sender === 'user' ? '你' : 'AI';

    // 如果使用 Markdown 库，在这里进行渲染
    // if (typeof marked !== 'undefined') {
    //     messageElement.querySelector('.content').innerHTML = marked.parse(message.content);
    // } else {
        // 在 addMessageToUI 函数中找到这部分：
// messageElement.querySelector('.content').textContent = message.content; // 直接显示文本

// 替换为：
	if (typeof marked !== 'undefined') {
		messageElement.querySelector('.content').innerHTML = marked.parse(message.content);
	} else {
		messageElement.querySelector('.content').textContent = message.content; // 如果 marked.js 未加载，则直接显示文本
	}

    // }

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
    if (files.length === 0 || !currentChatId || !chats[currentChatId]) {
        return;
    }

    const currentChat = chats[currentChatId];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileId = generateUniqueId(); // 为每个文件生成唯一 ID

        // 将文件信息添加到当前聊天会话的数据中
        currentChat.uploadedFiles.push({
            id: fileId,
            name: file.name,
            type: file.type,
            size: file.size,
            file: file // 存储 File 对象以便后续读取内容
        });

        // 更新 UI 显示已上传文件列表
        addUploadedFileToUI({ id: fileId, name: file.name });
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
     const fileItemElement = fileItemTemplate.content.cloneNode(true).querySelector('li');

     fileItemElement.dataset.fileId = fileInfo.id;
     fileItemElement.querySelector('span').textContent = fileInfo.name;

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
        modelSelectElement.value = model;
    }
    if (systemPromptElement) {
        systemPromptElement.value = systemPrompt;
    }
}

/**
 * 更新已上传文件列表的 UI
 * @param {Array} files - 已上传文件数组 [{ id: '...', name: '...', type: '...', size: '...', file: File }]
 */
export function updateUploadedFilesUI(files) {
    const uploadedFilesListElement = document.getElementById('uploaded-files-list');
    uploadedFilesListElement.innerHTML = ''; // 清空当前列表

    files.forEach(file => {
        addUploadedFileToUI({ id: file.id, name: file.name });
    });
}

// TODO: 添加更多 UI 操作函数，例如显示加载状态、错误提示等
