// js/main.js

// ... (其他导入和全局变量保持不变) ...

// 定义默认系统提示词
const DEFAULT_SYSTEM_PROMPT = "你是一个entp性格的机器人助手，要以entp性格的语气回答问题";
// 定义主题存储键
const THEME_STORAGE_KEY = 'aiChatAppTheme';

document.addEventListener('DOMContentLoaded', async () => {
    // ... (DOMContentLoaded 中的初始化代码保持不变) ...
});

// ... (handleWindowResize, loadAndApplyTheme, applyTheme, toggleTheme 函数保持不变) ...

// ---- 核心功能函数 ----

// ... (createNewChat, switchChat, deleteChat, clearCurrentChatContext 函数保持不变) ...

// ... (updateVoiceSelectVisibility, updateVoiceSelectUI 函数保持不变) ...


/**
 * 发送消息（用户输入），调用 AI 聊天 API
 * 这个函数由 ui.js 中的发送按钮事件调用。
 */
async function sendMessage() {
    const userInputElement = document.getElementById('user-input');
    const messageContent = userInputElement.value.trim();
    const currentChat = chats[currentChatId];

    // 获取当前聊天会话的已上传文件，仅用于本次发送
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
        type: 'text',
        files: uploadedFilesForSend.map(file => ({ name: file.name, type: file.type }))
    };
    currentChat.messages.push(userMessage);
    addMessageToUI(userMessage, true);

    // 清空输入框和文件列表 UI 和数据 (发送后清空)
    userInputElement.value = '';
    currentChat.uploadedFiles = []; // 清空上传的文件数据
    updateUploadedFilesUI([]); // 更新文件列表 UI
    saveChatData(chats); // 保存清空文件列表后的状态


    // 2. 调用常规聊天 API (/openai)
    const sendButton = document.getElementById('send-btn');
    const generateImageBtn = document.getElementById('generate-image-btn');
    if(sendButton) sendButton.disabled = true;
    if(generateImageBtn) generateImageBtn.disabled = true;

    let aiMessageContent = ''; // 用于存储 AI 回复的文本内容
    const aiMessageElement = addStreamingMessageToUI(); // 添加一个空的 AI 消息元素用于接收流式数据


    try {
         await callAIApi(
             userMessage.content, // 传递用户输入的文本
             currentChat.systemPrompt,
             currentChat.model,
             uploadedFilesForSend, // 将上传文件（包含 File 对象）传递给 API (即使清空了 UI 和数据，发送时使用发送前的瞬间状态)
             // 注意：这里之前传递的是 currentChat.messages.slice(0, -1)
             // 如果希望将用户消息包含在上下文，需要调整slice的逻辑
             // 根据您“不计入聊天上下文”的需求，这里应该传递**没有**刚刚添加的用户消息的历史记录
             // 但是，如果您希望 AI 知道用户刚刚发送了什么（包括文件信息元数据），
             // 并且根据用户消息进行回复，那么 userMessage.content 和 uploadedFilesForSend 需要作为当前输入传递，
             // 而历史记录则排除用户刚刚的消息。当前代码已经这样做了。
             currentChat.messages.slice(0, -1), // 传递消息历史 (排除刚刚添加的用户消息)
             (data) => { // onData 回调
                 aiMessageContent += data;
                 updateStreamingMessageUI(aiMessageElement, aiMessageContent);
             },
             () => { // onComplete 回调
                 console.log("Streaming complete.");
                 // 在流结束时将完整的回复内容保存到聊天数据中
                  const aiMessage = {
                      sender: 'ai',
                      content: aiMessageContent,
                      type: 'text'
                  };
                  // 查找并更新聊天数据中的最新 AI 消息
                  const lastAIMessageIndex = currentChat.messages.findLastIndex(msg => msg.sender === 'ai');
                  if(lastAIMessageIndex !== -1) {
                       currentChat.messages[lastAIMessageIndex].content = aiMessageContent;
                       currentChat.messages[lastAIMessageIndex].type = 'text';
                       delete currentChat.messages[lastAIMessageIndex].url;
                  } else {
                       currentChat.messages.push(aiMessage);
                  }

                  saveChatData(chats);

                  // 在流结束后对完整的 AI 消息进行最终渲染和后处理
                  const contentElement = aiMessageElement.querySelector('.content');
                  if(contentElement) {
                      contentElement.innerHTML = marked.parse(aiMessageContent);
                      addCopyButtonsToCodeBlocks(contentElement);
                       setTimeout(() => {
                            Prism.highlightAllUnder(contentElement);
                       }, 0);
                  }

                  if(sendButton) sendButton.disabled = false;
                  if(generateImageBtn) generateImageBtn.disabled = false;
             },
             (error) => { // onError 回调
                  console.error("Streaming error:", error);
                  const errorMessageText = `\n\n错误：${error.message}`;
                  aiMessageContent += errorMessageText;

                  updateStreamingMessageUI(aiMessageElement, aiMessageContent);

                  const lastAIMessageIndex = currentChat.messages.findLastIndex(msg => msg.sender === 'ai');
                   if(lastAIMessageIndex !== -1) {
                        currentChat.messages[lastAIMessageIndex].content = aiMessageContent;
                        currentChat.messages[lastAIMessageIndex].type = 'text';
                        delete currentChat.messages[lastAIMessageIndex].url;
                   } else {
                        const errorMessage = { sender: 'ai', content: aiMessageContent, type: 'text' };
                        currentChat.messages.push(errorMessage);
                   }
                  saveChatData(chats);

                  const contentElement = aiMessageElement.querySelector('.content');
                  if(contentElement) {
                      contentElement.innerHTML = marked.parse(aiMessageContent);
                      addCopyButtonsToCodeBlocks(contentElement);
                       setTimeout(() => {
                           Prism.highlightAllUnder(contentElement);
                       }, 0);
                  }

                  if(sendButton) sendButton.disabled = false;
                  if(generateImageBtn) generateImageBtn.disabled = false;
             }
         );

    } catch (error) {
        console.error("Error during API call:", error);
        const errorMessageText = `发生网络或未知错误：${error.message}`;
        const errorMessage = {
            sender: 'ai',
            content: errorMessageText,
            type: 'text'
        };
        if (aiMessageElement) {
             updateStreamingMessageUI(aiMessageElement, errorMessage.content);
             const lastAIMessageIndex = currentChat.messages.findLastIndex(msg => msg.sender === 'ai');
             if(lastAIMessageIndex !== -1) {
                  currentChat.messages[lastAIMessageIndex].content = errorMessage.content;
                  currentChat.messages[lastAIMessageIndex].type = 'text';
                  delete currentChat.messages[lastAIMessageIndex].url;
             } else {
                  currentChat.messages.push(errorMessage);
             }
              const contentElement = aiMessageElement.querySelector('.content');
              if(contentElement) {
                   addCopyButtonsToCodeBlocks(contentElement);
                   setTimeout(() => {
                       Prism.highlightAllUnder(contentElement);
                   }, 0);
              }

        } else {
             currentChat.messages.push(errorMessage);
             addMessageToUI(errorMessage, true);
        }

        saveChatData(chats);

    } finally {
         // 确保按钮被启用
         if(sendButton) sendButton.disabled = false;
         if(generateImageBtn) generateImageBtn.disabled = false;
    }
}

/**
 * 生成图片（由按钮触发），直接构建图片 URL 并以 Markdown 格式返回
 * 这个函数由 ui.js 中的图片生成按钮事件调用。
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

     // 1. 添加用户发送的图片生成提示词到 UI (不添加到 messages 数组)
     // 您提到“不计入聊天上下文”，这意味着它不应该作为常规用户消息参与到后续的AI对话中。
     // 最简单的实现方法是，**不将这个用户消息添加到 currentChat.messages 数组中**。
     // 我们只在 UI 中显示一个视觉提示，表示用户执行了图片生成操作。
     const userActionMessage = {
         sender: 'user',
         // content: `[图片生成请求] ${prompt}`, // 可以使用这个，或者直接渲染一个更简洁的标记
         content: `生成图片: "${prompt}"`, // 显示用户输入的提示词
         type: 'text' // 标记为文本类型
     };
     // 不将 userActionMessage 添加到 currentChat.messages 数组
     addMessageToUI(userActionMessage, true); // 添加用户消息到 UI

     // 清空输入框
     userInputElement.value = '';
      // 清空已上传文件列表 UI 和数据 (生成图片不使用上传文件)
    currentChat.uploadedFiles = []; // 清空上传的文件数据
    updateUploadedFilesUI([]); // 更新文件列表 UI
     // 不需要保存chats，因为messages数组没有改变，uploadedFiles的清空在sendMessage中已经保存了，如果这里也保存，会导致两次保存。
     // 如果用户仅仅是点击了图片生成按钮而没有发送消息，那么uploadedFiles的清空需要在这里保存。
     // 为了简化和避免竞态条件，我们假设用户要么发送消息（含文件），要么点击生成图片（清空文件但不立即保存）。
     // 文件列表的最终保存发生在 sendMessage 函数结束时。
     // 如果您需要在生成图片时立即保存文件列表的清空状态，可以在这里加上 saveChatData(chats);
     // saveChatData(chats); // <-- 如果需要在这里立即保存文件列表清空的状态


     const sendButton = document.getElementById('send-btn');
     const generateImageBtn = document.getElementById('generate-image-btn');
     if(sendButton) sendButton.disabled = true; // 禁用发送按钮
     if(generateImageBtn) generateImageBtn.disabled = true; // 禁用图片生成按钮

     try {
         // 2. 调用 api.js 中的 callTxt2ImgApi 函数获取图片 URL
         // 这个函数内部已经构建了 Pollinations.ai 的特定 URL 格式
         const imageUrl = await callTxt2ImgApi(prompt);

         if (!imageUrl || imageUrl.trim() === "" || imageUrl.includes("failed")) {
             throw new Error("API 返回了无效或错误的图片 URL。");
         }

         // 3. 将生成的图片 URL 以 Markdown 格式添加到 AI 聊天框
         // 这个AI消息也**不应该被添加到 currentChat.messages 数组中**，以符合“不计入聊天上下文”的需求。
         // 我们直接在 UI 中添加一个独立的 AI 消息来显示图片。
         const aiImageMessage = {
             sender: 'ai',
             // content: ``, // Markdown 格式字符串
             // 更好的做法是直接传递 URL 和提示词，让 UI 层去构建 img 标签
             content: prompt, // 保存原始提示词
             type: 'image', // 标记为 image 类型
             url: imageUrl // 保存图片 URL
         };
         // 不将 aiImageMessage 添加到 currentChat.messages 数组

         // 4. 将这个独立的 AI 图片消息添加到 UI (调用 ui.js 中的函数)
         // addMessageToUI 函数已经支持渲染 image 类型消息，并使用 updateMessageWithImage 进行处理
         addMessageToUI(aiImageMessage, true);

         // 因为图片生成不计入上下文，我们也不需要更新消息列表数据并保存 chats
         // 如果需要将图片信息保存到 chats.messages 数组，但又不想它影响后续文本模型的上下文，
         // 可以考虑在保存时标记一个 `context: false` 字段，并在调用 callAIApi 时过滤掉这些消息。
         // 但根据您当前的要求，直接不保存是最直接的方式。

     } catch (error) {
         console.error("Error generating image:", error);
         const errorMessageText = `图片生成失败：${error.message}`;

          // 添加一个 AI 错误消息到 UI (这个错误消息可以选择是否保存和是否计入上下文)
          // 如果是图片生成错误，通常也不计入常规聊天上下文比较合理。
          const aiErrorMessage = {
              sender: 'ai',
              content: errorMessageText,
              type: 'text'
          };
          // 同样，不将 aiErrorMessage 添加到 currentChat.messages 数组
          addMessageToUI(aiErrorMessage, true); // 添加错误消息到 UI

          // 如果需要保存错误消息，但仍不计入上下文，可以在此保存并标记
          // chats[currentChatId].messages.push({...aiErrorMessage, context: false});
          // saveChatData(chats);
     } finally {
         // 在 finally 块中确保按钮被启用
         if(sendButton) sendButton.disabled = false; // 启用发送按钮
         if(generateImageBtn) generateImageBtn.disabled = false; // 启用图片生成按钮
     }
}


/**
 * 渲染指定聊天会话的消息列表到 UI
 * 这个函数在 main.js 中实现和调用。
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
        // addMessageToUI 已经会调用 updateMessageWithImage/Audio 处理对应的类型
        const messageElement = addMessageToUI(message, false);

        // 对于 AI 文本消息，添加复制按钮和高亮 (仅在文本类型消息上进行后处理)
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
        // 这个逻辑保留，因为它渲染的是历史用户消息中包含的文件元数据
         if (message.sender === 'user' && messageElement && message.files && Array.isArray(message.files) && message.files.length > 0) {
              const contentElement = messageElement.querySelector('.content');
              if (contentElement) {
                  const fileList = document.createElement('ul');
                  fileList.classList.add('message-files-list');
                  message.files.forEach(fileInfo => {
                      const fileItem = document.createElement('li');
                       let iconClass = 'far fa-file';
                       if (fileInfo.type.startsWith('image/')) {
                           iconClass = 'far fa-image';
                       } else if (fileInfo.type.startsWith('audio/')) {
                           iconClass = 'far fa-file-audio';
                       } else if (fileInfo.type.startsWith('video/')) {
                           iconClass = 'far fa-file-video';
                       } else if (fileInfo.type === 'application/pdf') {
                           iconClass = 'far fa-file-pdf';
                       }

                       const iconElement = document.createElement('i');
                       iconElement.classList.add(iconClass);
                       iconElement.style.marginRight = '5px';

                       fileItem.appendChild(iconElement);
                       fileItem.appendChild(document.createTextNode(fileInfo.name));

                       fileItem.style.fontSize = '0.8em';
                       fileItem.style.color = 'var(--message-sender-user)';
                       fileList.appendChild(fileItem);
                  });
                  contentElement.appendChild(fileList);
              }
         }
    });

    // 渲染完成后滚动到底部一次
    messagesListElement.scrollTop = messagesListElement.scrollHeight;
}

// 导出 main.js 中的函数，供 ui.js 调用
export {
    currentChatId, // Export for ui.js
    chats, // Export for ui.js
    sendMessage, // Export for ui.js
    // renderMessages, // Not called by ui.js
    generateImage, // Export for ui.js
    toggleTheme, // Export for ui.js
    clearCurrentChatContext, // Export for ui.js
    updateVoiceSelectVisibility, // Export for ui.js
    updateVoiceSelectUI // Export for ui.js
};
