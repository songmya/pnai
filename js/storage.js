// js/storage.js

const STORAGE_KEY = 'aiChatApp';

/**
 * 从 localStorage 加载聊天数据
 * @returns {object} 返回保存的聊天数据对象，如果不存在则返回空对象
 */
export function loadChatData() {
    const data = localStorage.getItem(STORAGE_KEY);
    try {
        // 尝试解析 JSON
        const chats = data ? JSON.parse(data) : {};

        // ** 检查并恢复文件对象的结构（仅限元数据），File 对象本身无法存储在 localStorage **
        // 当加载聊天数据时，我们只能恢复文件列表的元数据 ({ id, name, type, size })
        // File 对象本身不会被加载回来。这是正常的。
        // 在发送消息时，我们会使用当前聊天的 uploadedFiles 数组中的 File 对象。
        // 如果用户刷新页面，上传的文件会丢失。这可以通过更高级的服务器端文件上传来解决。
        for (const chatId in chats) {
            if (chats[chatId].uploadedFiles && Array.isArray(chats[chatId].uploadedFiles)) {
                // 遍历 uploadedFiles，确保每个对象只有元数据，没有 File 对象
                // 理论上 JSON.parse 不会恢复 File 对象，但这里可以做一层检查
                chats[chatId].uploadedFiles = chats[chatId].uploadedFiles.map(fileInfo => {
                    const { id, name, type, size } = fileInfo;
                    return { id, name, type, size }; // 只保留元数据
                });
            } else {
                 // 如果 uploadedFiles 不存在或不是数组，初始化为空数组
                 chats[chatId].uploadedFiles = [];
            }

             // 确保消息中如果有 file 信息，它的格式正确
             if (chats[chatId].messages && Array.isArray(chats[chatId].messages)) {
                  chats[chatId].messages.forEach(msg => {
                       if (msg.files && Array.isArray(msg.files)) {
                            // 确保 msg.files 中的每个对象只有 name 和 type
                             msg.files = msg.files.map(fileInfo => {
                                  const { name, type } = fileInfo;
                                  return { name, type };
                             });
                       } else {
                            // 如果 files 字段不存在或不是数组，删除它或初始化为空数组，取决于你的消息结构设计
                            // 为了兼容性，如果 files 不是数组，可以尝试删除或设置为[]
                            if (msg.files !== undefined && !Array.isArray(msg.files)) {
                                delete msg.files; // 或者 msg.files = [];
                            }
                       }
                  });
             }
        }


        console.log("Chat data loaded successfully.");
        return chats;
    } catch (e) {
        console.error("Error loading chat data from localStorage:", e);
        // 如果解析失败，可能是数据损坏，返回空对象
        return {};
    }
}

/**
 * 将聊天数据保存到 localStorage
 * @param {object} chats - 要保存的聊天数据对象
 */
export function saveChatData(chats) {
     // ** 在保存之前，从 uploadedFiles 中移除 File 对象 **
     // File 对象是不能直接 JSON 序列化的
     const chatsToSave = JSON.parse(JSON.stringify(chats)); // 深拷贝对象

     for (const chatId in chatsToSave) {
          if (chatsToSave[chatId].uploadedFiles && Array.isArray(chatsToSave[chatId].uploadedFiles)) {
               chatsToSave[chatId].uploadedFiles = chatsToSave[chatId].uploadedFiles.map(fileInfo => {
                   const { id, name, type, size } = fileInfo;
                    return { id, name, type, size }; // 只保留元数据
               });
          }
     }

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chatsToSave));
        console.log("Chat data saved successfully.");
    } catch (e) {
        console.error("Error saving chat data to localStorage:", e);
        // 如果保存失败，可能是 localStorage 已满
        alert("无法保存聊天数据，LocalStorage 已满。请尝试删除一些聊天记录。");
    }
}

/**
 * 从 localStorage 删除指定聊天数据
 * @param {string} chatId - 要删除的聊天 ID
 */
export function deleteChatData(chatId) {
    // 这个函数在 main.js 中调用 delete chats[chatId] 并 saveChatData 时间接实现，
    // 所以这里不需要单独删除某个 key，只需要 load, delete, save 即可。
    // 或者可以实现直接删除，但目前的逻辑在 main.js 中已经处理了。
    // 为了避免混淆，这里不实现单独删除某个 chatId 的函数，依赖 load + delete + save。
}
