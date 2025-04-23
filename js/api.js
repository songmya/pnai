// js/api.js

// 导入必要的数据 (尽管 UI 层不应该直接导入数据层，但为了匹配您现有的结构，暂时保留)
// import { currentChatId, chats } from './main.js'; // api.js 不应直接依赖 main.js 的状态

const API_BASE_URL = 'https://text.pollinations.ai';

/**
 * 调用 Pollinations.ai API 获取模型列表
 * @returns {Promise<Array>} Promise 解析为一个包含模型对象的数组，或者一个空数组
 */
export async function fetchModels() {
    const url = `${API_BASE_URL}/models`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Error fetching models: ${response.status} ${response.statusText}`);
            // 尝试读取错误信息
            try {
                const errorBody = await response.text();
                console.error("Error response body:", errorBody);
            } catch (e) {
                 console.error("Could not read error response body:", e);
            }
            return []; // 返回空数组表示失败
        }
        const models = await response.json();
        return models; // 返回模型数组
    } catch (error) {
        console.error('Error fetching models:', error);
        return []; // 返回空数组表示失败
    }
}

/**
 * 将 File 对象读取为 Base64 数据 URL
 * @param {File} file - 要读取的 File 对象
 * @returns {Promise<string>} Promise 解析为 Base64 数据 URL
 */
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}


/**
 * 调用 Pollinations.ai API 进行文本生成 (聊天)
 * @param {string} prompt - 用户输入
 * @param {string} systemPrompt - 系统提示词 (可选)
 * @param {string} model - 使用的模型名称 (必需，例如 'openai', 'llama')
 * @param {Array<object>} uploadedFiles - 已上传文件数组 [{ id: '...', name: '...', type: '...', size: '...', file: File }] (包含 File 对象)
 * @param {Array<object>} chatMessages - 聊天历史消息数组 (用于提供上下文)
 * @returns {Promise<object>} Promise 解析为 AI 回复对象 { text: '...', ... }
 */
export async function callAIApi(prompt, systemPrompt, model, uploadedFiles, chatMessages) {
     const url = `${API_BASE_URL}/chat`;

     const messages = [];

     // 添加系统提示词 (如果存在且不为空)
     if (systemPrompt && systemPrompt.trim()) {
          messages.push({ role: 'system', content: systemPrompt });
     }

     // 添加历史消息 (只包含 user 和 assistant 角色)
     if (chatMessages && Array.isArray(chatMessages)) {
         chatMessages.forEach(msg => {
             if (msg.sender === 'user' || msg.sender === 'ai') {
                 messages.push({
                     role: msg.sender === 'user' ? 'user' : 'assistant',
                     content: msg.content
                     // Pollinations.ai /chat 端点目前主要接收一个 image 参数，
                     // 将历史消息中的文件也包含进来可能需要更复杂的API交互，
                     // 目前我们只传递文本历史。
                 });
             }
         });
     }


     // 构建用户消息内容，包含文本和文件 (如果存在)
     let userContent = [{ type: 'text', text: prompt }]; // 默认包含文本

     // 处理文件上传，读取文件内容并添加到用户消息中
     if (uploadedFiles && Array.isArray(uploadedFiles) && uploadedFiles.length > 0) {
         // 假设 Pollinations.ai 支持单个图像上传，这里只处理第一个文件作为图像
         const firstFile = uploadedFiles[0].file;
         if (firstFile && firstFile.type.startsWith('image/')) { // 只处理图片文件
              try {
                 const base64ImageData = await readFileAsBase64(firstFile);
                 // Pollinations.ai 的 /chat 接口可能直接接受一个 image 参数而不是在 content 数组中
                 // 根据实际 API 文档调整这里
                 // 假设它直接接受 image 参数
                 // userContent = { type: 'image_url', image_url: { url: base64ImageData } }; // 这适用于 GPT-4V 格式
                 // 假设 Pollinations.ai 接受一个包含文本和图片元素的 content 数组
                 userContent.push({ type: 'image_url', image_url: { url: base64ImageData } });
              } catch (error) {
                 console.error("Error reading file:", error);
                 // 可以在 UI 中给用户一个提示
              }
         } else {
             console.warn("Skipping non-image file or no file object found.");
             // 如果上传了非图片文件，但模型不支持，可以给用户提示
         }
         // TODO: 如果 Pollinations.ai /chat 接口支持多个图像或其他文件类型，需要更复杂的处理
     }

     // 添加当前用户消息到消息列表
      messages.push({
         role: 'user',
         content: userContent // content 可以是字符串或数组，取决于是否包含图片
      });


     const body = {
        messages: messages, // 发送完整的消息历史
        model: model, // 使用传入的模型名称
        // Pollinations.ai /chat 接口的其他可选参数可以加在这里
        // n: 1, // 示例：生成一个回复
        // max_gen_len: 1000, // 示例：最大生成长度
        // temperature: 0.7, // 示例：随机性
        // top_p: 0.9 // 示例：核采样
        // image: base64ImageData // 如果 API 接口是这样设计的，直接在这里添加 image 参数
     };

      // Pollinations.ai /chat 接口的图片参数可能需要单独处理，而不是放在 messages[].content 里
      // 让我们检查一下 API 文档或进行测试
      // 如果 API 接口确实接受一个顶级的 `image` 参数，那么 body 可能看起来像这样:
      // const body = {
      //    prompt: prompt,
      //    system: systemPrompt || undefined,
      //    model: model,
      //    image: uploadedFiles && uploadedFiles.length > 0 && uploadedFiles[0].file && uploadedFiles[0].file.type.startsWith('image/') ? await readFileAsBase64(uploadedFiles[0].file) : undefined
      // };
      // 暂时按照 messages 数组包含文本和图片元素的格式来实现，这是 GPT-4V 的常见格式

     try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                 // Pollinations.ai 的 /chat 端点通常不需要 Authorization 头部
                 // 'Authorization': `Bearer ${API_KEY}` // 如果 API 使用 Bearer Token 认证
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
             // 尝试读取错误信息
             const errorBody = await response.json(); // 假设错误是 JSON 格式
             const errorMessage = errorBody.detail || errorBody.error || JSON.stringify(errorBody); // 根据可能的错误格式提取信息
             console.error(`Error calling AI API: ${response.status} ${response.statusText}`, errorBody);
             return { text: `Error: ${response.status} ${response.statusText} - ${errorMessage}` };
        }

        const apiResponse = await response.json();
        // Pollinations.ai 的 /chat 接口返回的数据格式
        // 假设它返回 { output: '...' }
        const aiResponseText = apiResponse.output || '没有收到回复。';

        return { text: aiResponseText };

     } catch (error) {
        console.error('Error calling AI API:', error);
        // 在 UI 中显示错误信息
        return { text: `发生网络或未知错误：${error.message}` };
     }
}

// 导出 fetchModels 和 callAIApi 函数
// export { fetchModels, callAIApi }; // 已经在函数前使用了 export
