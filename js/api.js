// js/api.js

const API_BASE_URL_TEXT = 'https://text.pollinations.ai/openai';
const API_BASE_URL_IMAGE = 'https://image.pollinations.ai';

/**
 * 调用 Pollinations.ai API 获取模型列表
 * @returns {Promise<Array>} Promise 解析为一个包含模型对象的数组，或者一个空数组
 */
export async function fetchModels() {
    const url = `${API_BASE_URL_TEXT}/models`; // 模型列表从 text 端点获取
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Error fetching models: ${response.status} ${response.statusText}`);
            try {
                const errorBody = await response.text();
                console.error("Error response body:", errorBody);
            } catch (e) {
                 console.error("Could not read error response body:", e);
            }
            return [];
        }
        const models = await response.json();
        return models;
    } catch (error) {
        console.error('Error fetching models:', error);
        return [];
    }
}

/**
 * 辅助函数：将 File 对象读取为 Base64 数据 URL
 * @param {File} file - 要读取的文件对象
 * @returns {Promise<string>} Promise 解析为 Base64 数据 URL
 */
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}


/**
 * 调用 Pollinations.ai API 进行文本生成 (聊天 - /openai 端点)
 * 支持上下文 (messages 数组) 和流式传输。
 * @param {string} prompt - 当前用户输入文本
 * @param {string} systemPrompt - 系统提示词 (可选，将作为 messages 数组中的 system 角色消息)
 * @param {string} model - 使用的模型名称 (必需)
 * @param {Array<object>} uploadedFiles - 已上传文件数组 [{ id: '...', name: '...', type: '...', size: '...', file: File }] (包含 File 对象)。 Pollinations.ai 的 /openai 端点支持多模态输入，会将图片内容编码后发送。
 * @param {Array<object>} chatMessages - 聊天历史消息数组 [{ sender: 'user' | 'ai', content: '...', type?: 'text' | 'image' | 'audio', url?: string, files?: Array<{ name: string, type: string }> }]。注意，这里假设 chatMessages 已经排除了 system 消息。**图片和音频类型的历史消息及其关联文件将被排除在发送给文本 API 的上下文之外。** 用户文本消息中包含的文件信息元数据会保留，但文件内容不会再次发送。
 * @param {function} onData - 回调函数，当接收到新的数据块时调用 (用于流式)
 * @param {function} onComplete - 回调函数，当流结束时调用
 * @param {function} onError - 回调函数，当发生错误时调用
 */
export async function callAIApi(prompt, systemPrompt, model, uploadedFiles, chatMessages, onData, onComplete, onError) {
     const url = `${API_BASE_URL_TEXT}`; // 使用新的 /openai 端点

     // ** 构建 messages 数组 **
     const messages = [];

     // 添加系统提示词
     if (systemPrompt && systemPrompt.trim()) {
          messages.push({ role: 'system', content: systemPrompt });
     }

     // 添加聊天历史 (过滤掉非文本消息及其关联的文件内容)
     if (chatMessages && Array.isArray(chatMessages)) {
         // 限制发送的历史记录数量，避免过长
         const historyLength = 10; // 根据需要调整
         const recentMessages = chatMessages.slice(-historyLength);

         recentMessages.forEach(msg => {
             // ** 过滤掉非文本类型的消息及其关联的文件内容 **
             if (msg.type === 'image' || msg.type === 'audio') {
                  // 忽略图片和音频消息，不将其添加到发送给文本 API 的上下文
                  console.log(`Skipping historical message type: ${msg.type} for text API context.`);
                  return; // 跳过当前循环迭代
             }

             // 确保历史消息的 role 是 'user' 或 'assistant'
             const role = msg.sender === 'user' ? 'user' : 'assistant';
             // 对于文本消息，直接使用 content (即使是用户消息带有文件信息，content 也是文本)
             const msgContent = msg.content; // 历史文本消息的 content 是字符串

             // 对于历史消息，即使是用户消息带有文件信息，也不再发送文件内容，只发送文本
             messages.push({
                 role: role,
                 content: msgContent // 对于历史用户消息，即使是带有图片的，只发送其文本内容
             });
         });
     }

     // ** 构建当前用户消息的内容 - 支持多模态 **
     let currentUserContent = [];

     // 1. 添加用户输入的文本内容
     if (prompt && prompt.trim()) {
          currentUserContent.push({ type: 'text', text: prompt });
     }

     // 2. 处理文件上传给聊天 API (只处理图片并编码为 Base64，添加到当前用户消息)
     if (uploadedFiles && Array.isArray(uploadedFiles) && uploadedFiles.length > 0) {
         // Pollinations.ai /openai 端点可能只处理第一张图片作为多模态输入
         // 如果支持多张图片，需要根据 API 文档调整
         const firstFile = uploadedFiles[0].file;
         if (firstFile && firstFile.type.startsWith('image/')) {
              try {
                 const base64ImageData = await readFileAsBase64(firstFile);
                 currentUserContent.push({ type: 'image_url', image_url: { url: base64ImageData } });
                 console.log("Added uploaded image to current user message content.");
              } catch (error) {
                 console.error("Error reading image file for API call:", error);
                 if (onError) onError("无法读取图片文件：" + error.message);
                 // 读取文件失败，但不中断整个 API 调用，只记录错误并继续发送文本
              }
         } else {
             console.warn("Uploaded file is not an image or no file provided for chat API, skipping image processing for multi-modal input.");
         }
     }

     // 如果 currentUserContent 是空数组，表示用户没有输入文本也没有上传图片，此时不应该调用 API
     if (currentUserContent.length === 0) {
         console.log("User message content is empty (no text or image). Skipping API call.");
         if (onComplete) onComplete(); // 模拟完成
         return;
     }


     // 添加当前用户消息 (content 是一个数组，包含 text 和 image_url 元素)
      messages.push({
         role: 'user',
         content: currentUserContent // userContent 现在是数组
      });


     // ** 构建 POST 请求的 body **
     const body = {
        model: model, // 使用传入的模型名称
        private: "true", // 根据 curl 示例添加 private 参数
        messages: messages, // 发送构建好的 messages 数组
        stream: true // **启用流式传输**
        // 其他可选参数如 max_tokens, temperature 等可以根据需要添加
     };

     console.log("Calling Pollinations.ai /openai API with body:", JSON.stringify(body, null, 2)); // 调试输出 body

     try {
        const response = await fetch(url, {
            method: 'POST', // POST 请求
            headers: {
                'Content-Type': 'application/json' // POST 请求通常需要指定 Content-Type
                // 如果 Pollinations.ai 需要 API Key，您需要在这里添加 Authorization 头部
                // 例如: 'Authorization': `Bearer YOUR_API_KEY`
            },
            body: JSON.stringify(body) // 将 body 对象转换为 JSON字符串发送
        });

        if (!response.ok) {
             // 检查非 2xx 状态码
             const errorText = await response.text(); // 尝试读取文本，可能是 JSON 或其他格式
             console.error(`Error calling AI API (/openai): ${response.status} ${response.statusText}`, errorText);
             if (onError) {
                 try {
                     const errorJson = JSON.parse(errorText);
                     const errorMessage = errorJson.detail || errorJson.error || errorText;
                     onError(`API 请求失败：${response.status} ${response.statusText} - ${errorMessage}`);
                 } catch (e) {
                     // 如果不是 JSON，显示原始文本，限制长度
                     onError(`API 请求失败：${response.status} ${response.statusText} - ${errorText.substring(0, 200)}...`);
                 }
             }
             return; // 请求失败，中断流程
        }

        // **处理流式 SSE (Server-Sent Events) 响应**
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = ''; // 用于存储不完整的行

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                // 处理缓冲区中剩余的任何数据
                if (buffer.length > 0) {
                    const lines = buffer.split('\n');
                     for (const line of lines) {
                         processStreamChunk(line, onData);
                     }
                }
                if (onComplete) onComplete(); // 流结束
                break;
            }

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                processStreamChunk(line, onData);
            }
        }

     } catch (error) {
        console.error('Error calling AI API (/openai):', error);
        if (onError) onError(`发生网络或未知错误：${error.message}`);
     }
}

/**
 * 处理 SSE 流的单个数据块
 * @param {string} chunk - 单个数据行
 * @param {function} onData - 回调函数, 用于处理提取的文本
 */
function processStreamChunk(chunk, onData) {
     if (chunk.startsWith('data: ')) {
         const data = chunk.substring(6).trim();

         if (data === '[DONE]') {
             return;
         }

         try {
             const json = JSON.parse(data);

             if (json.choices && Array.isArray(json.choices) && json.choices.length > 0) {
                 const choice = json.choices[0];
                 // 提取 delta 中的文本内容
                 if (choice.delta && choice.delta.content !== undefined) {
                     if (onData) onData(choice.delta.content);
                 }
             } else {
                 console.warn("Received unexpected JSON format in stream:", json);
             }

         } catch (e) {
             console.warn("Could not parse JSON from stream chunk:", chunk, e);
         }
     } else if (chunk.trim().length > 0) {
         // console.warn("Received non-data line in stream:", chunk);
     }
}


/**
 * 调用 Pollinations.ai API 生成图片 (txt2img)
 * @param {string} prompt - 用户输入 (生成图片的提示词)
 * @returns {Promise<string>} Promise 解析为图片 URL
 */
export async function callTxt2ImgApi(prompt) {
    const encodedPrompt = encodeURIComponent(prompt);
    // 根据 Pollinations.ai 文档，txt2img 端点是 /prompt/{prompt}
    // 并可通过查询参数控制属性，例如 nologo=true 移除水印
    const url = `${API_BASE_URL_IMAGE}/prompt/${encodedPrompt}?nologo=true&enhance=true`; // 添加enhance=true可能提高质量

    try {
        const response = await fetch(url, {
             method: 'GET' // txt2img 通常是 GET 请求
        });

        // Pollinations.ai txt2img 成功时直接返回 200 和图片内容，或者 302 重定向到图片 URL
        // 我们需要处理重定向，或者检查最终响应的 URL
        // fetch API 默认会跟随重定向，所以 response.url 将是最终的图片 URL

        if (!response.ok) {
             const errorText = await response.text();
             console.error(`Error calling Txt2Img API: ${response.status} ${response.statusText}`, errorText);
             // 尝试解析错误信息，如果不是 JSON 就使用原始文本
             let errorMessageDetail = errorText;
             try {
                 const errorJson = JSON.parse(errorText);
                 errorMessageDetail = errorJson.detail || errorJson.error || errorText;
             } catch (e) {
                 // ignore
             }
             throw new Error(`生成图片失败：${response.status} ${response.statusText} - ${errorMessageDetail.substring(0, 200)}...`);
        }

        // 成功时，response.url 就是图片的最终 URL
        const imageUrl = response.url;
        console.log("Generated image URL:", imageUrl);

        // 额外检查：Pollinations.ai 可能会返回一个表示错误的图片URL
        // 例如包含 "failed" 或特定占位图的 URL。可以根据实际情况添加判断。
        // 目前简单地返回获取到的 URL。

        return imageUrl;

    } catch (error) {
        console.error('Error calling Txt2Img API:', error);
        throw error; // 抛出错误以便调用者处理
    }
}

/**
 * 调用 Pollinations.ai API 生成音频 (txt2audio)
 * @param {string} prompt - 用户输入 (要转为音频的文本)
 * @param {string} voice - 语音选择 ('voice1' 或 'voice2')
 * @returns {Promise<string>} Promise 解析为音频 URL
 */
export async function callTxt2AudioApi(prompt, voice) {
    const encodedPrompt = encodeURIComponent(prompt);
    const selectedVoice = voice === 'voice2' ? 'voice2' : 'voice1';

    // Pollinations.ai txt2audio 端点根据文档示例似乎是 /text/{prompt}?model=openai-audio&voice={voice}
    const url = `${API_BASE_URL_TEXT}/text/${encodedPrompt}?model=openai-audio&voice=${selectedVoice}`;
     console.log("Calling Pollinations.ai Txt2Audio API with URL:", url);


    try {
        const response = await fetch(url, {
             method: 'GET' // txt2audio 也通常是 GET 请求
        });

        // 类似 txt2img，txt2audio 也可能直接返回音频内容或重定向到音频 URL
        // fetch API 默认跟随重定向，response.url 将是最终的音频 URL

        if (!response.ok) {
             const errorText = await response.text();
             console.error(`Error calling Txt2Audio API: ${response.status} ${response.statusText}`, errorText);
             let errorMessageDetail = errorText;
              try {
                 const errorJson = JSON.parse(errorText);
                 errorMessageDetail = errorJson.detail || errorJson.error || errorText;
             } catch (e) {
                 // ignore
             }
             throw new Error(`生成音频失败：${response.status} ${response.statusText} - ${errorMessageDetail.substring(0, 200)}...`);
        }

        const audioUrl = response.url; // 获取最终的音频 URL
        console.log("Generated audio URL:", audioUrl);

         // 额外检查：Pollinations.ai 可能会返回表示错误的 URL
         // 例如返回 HTML 页面而不是音频文件。可以根据 Content-Type 或 URL 结构进行判断。
         // 目前简单地返回获取到的 URL。

        return audioUrl;

    } catch (error) {
        console.error('Error calling Txt2Audio API:', error);
        throw error;
    }
}
