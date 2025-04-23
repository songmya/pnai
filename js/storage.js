// Local Storage 中存储聊天数据的 key
const CHAT_STORAGE_KEY = 'aiChatAppData';

/**
 * 从 Local Storage 加载聊天数据
 * @returns {object} - 加载的聊天数据对象
 */
export function loadChatData() {
    try {
        const data = localStorage.getItem(CHAT_STORAGE_KEY);
        return data ? JSON.parse(data) : {};
    } catch (error) {
        console.error('Error loading chat data from Local Storage:', error);
        return {}; // 加载失败时返回空对象
    }
}

/**
 * 保存聊天数据到 Local Storage
 * @param {object} chatData - 要保存的聊天数据对象
 */
export function saveChatData(chatData) {
    try {
        // TODO: 注意：File 对象无法直接序列化为 JSON。
        // 在保存之前，需要将 File 对象移除或转换为可序列化的格式（例如只保存文件名、类型等信息）。
        // 示例：移除 File 对象（这将导致刷新页面后文件需要重新选择）
        const serializableChatData = JSON.parse(JSON.stringify(chatData)); // 深拷贝移除不可序列化的属性
        // 更精确的做法是遍历 chatData，只保留文件信息
        for (const chatId in serializableChatData) {
            if (serializableChatData[chatId].uploadedFiles) {
                 serializableChatData[chatId].uploadedFiles = serializableChatData[chatId].uploadedFiles.map(file => ({
                     id: file.id,
                     name: file.name,
                     type: file.type,
                     size: file.size
                     // 不保存 file 属性
                 }));
            }
        }


        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(serializableChatData));
    } catch (error) {
        console.error('Error saving chat data to Local Storage:', error);
    }
}

/**
 * 从 Local Storage 删除指定的聊天数据
 * @param {string} chatId - 要删除的聊天会话 ID
 */
export function deleteChatData(chatId) {
    try {
        const chatData = loadChatData(); // 先加载所有数据
        if (chatData[chatId]) {
            delete chatData[chatId]; // 删除指定的会话
            saveChatData(chatData); // 重新保存
        }
    } catch (error) {
        console.error('Error deleting chat data from Local Storage:', error);
    }
}
