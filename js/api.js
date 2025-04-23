// js/api.js

const API_BASE_URL_TEXT = 'https://text.pollinations.ai';
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
 * @param {string} prompt - 当前用户输入
 * @param {string} systemPrompt - 系统提示词 (可选，将作为 messages 数组中的 system 角色消息)
 * @param {string} model - 使用的模型名称 (必需)
 * @param {Array<object>} uploadedFiles - 已上传文件数组 [{ id: '...', name: '...', type: '...', size: '...', file: File }] (包含 File 对象)。注意 Pollinations.ai 的 /openai 端点可能需要特定格式处理文件，这里暂时只处理图片并放入 content。
 * @param {Array<object>} chatMessages - 聊天历史消息数组 [{ sender: 'user' | 'ai', content: '...' }]。注意，这里假设 chatMessages 已经排除了 system 消息。
 * @param {function} onData - 回调函数，当接收到新的数据块时调用 (用于流式)
 * @param {function} onComplete - 回调函数，当流结束时调用
 * @param {function} onError - 回调函数，当发生错误时调用
 */
export async function callAIApi(prompt, systemPrompt, model, uploadedFiles, chatMessages, onData, onComplete, onError) {
     const url = `${API_BASE_URL_TEXT}/openai`; // 使用新的 /openai 端点

     // ** 构建 messages 数组 **
     const messages = [];

     // 添加系统提示词
     if (systemPrompt && systemPrompt.trim()) {
          messages.push({ role: 'system', content: systemPrompt });
     }

     // 添加聊天历史 (假设 chatMessages 已经排除了 system 消息)
     if (chatMessages && Array.isArray(chatMessages)) {
         // 限制发送的历史记录数量，避免过长
         const historyLength = 20; // 根据需要调整，例如发送最近 20 条消息
         const recentMessages = chatMessages.slice(-historyLength);

         recentMessages.forEach(msg => {
             // 确保历史消息的 role 是 'user' 或 'assistant'
             const role = msg.sender === 'user' ? 'user' : 'assistant';
             // Pollinations.ai 的 /openai 端点通常期望 content 是字符串或多模态数组
             // 这里假设历史消息的 content 是字符串
             messages.push({
                 role: role,
                 content: msg.content // 历史消息的 content
             });
         });
     }

     // 构建当前用户消息的内容
     let userContent = [{ type: 'text', text: prompt }];

     // 处理文件上传（只处理第一个图片文件并编码为 Base64）
     // Pollinations.ai /openai 端点对图片的处理可能遵循 OpenAI 的格式
     let base64ImageData = null;
     if (uploadedFiles && Array.isArray(uploadedFiles) && uploadedFiles.length > 0) {
         const firstFile = uploadedFiles[0].file;
         if (firstFile && firstFile.type.startsWith('image/')) {
              try {
                 base64ImageData = await readFileAsBase64(firstFile);
                 // 将图片信息添加到用户消息内容中（遵循 OpenAI GPT-4V 格式）
                 userContent.push({ type: 'image_url', image_url: { url: base64ImageData } });
              } catch (error) {
                 console.error("Error reading image file:", error);
                 if (onError) onError("无法读取图片文件：" + error.message);
                 return; // 读取文件失败，停止后续操作
              }
         } else {
             console.warn("Uploaded file is not an image or no file provided, skipping image processing.");
             // 可以在 UI 中提示用户只支持图片上传
         }
     }

     // 添加当前用户消息
      messages.push({
         role: 'user',
         content: userContent.length > 1 ? userContent : userContent[0].text // 如果有图片则是数组，否则是纯文本
      });


     // ** 构建 POST 请求的 body **
     const body = {
        model: model, // 使用传入的模型名称
        private: "true", // 根据 curl 示例添加 private 参数
        system: systemPrompt, // 根据 curl 示例，system 参数也可以单独放在 body 里，不过也包含在 messages 中了，以 messages 中的为准是更标准的做法
        messages: messages, // 发送构建好的 messages 数组
        stream: true // **启用流式传输**
        // 其他可选参数如 max_tokens, temperature 等可以根据需要添加
     };

     console.log("Calling Pollinations.ai /openai API with body:", body); // 调试输出 body

     try {
        const response = await fetch(url, {
            method: 'POST', // POST 请求
            headers: {
                'Content-Type': 'application/json' // POST 请求通常需要指定 Content-Type
                // 如果 Pollinations.ai 需要 API Key，您需要在这里添加 Authorization 头部
                // 例如: 'Authorization': `Bearer YOUR_API_KEY`
            },
            body: JSON.stringify(body) // 将 body 对象转换为 JSON 字符串发送
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
             return;
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
                    // 这里的 streamChunkProcessor 函数需要能处理不完整的行，或者确保只处理完整的行
                    // SSE 解析通常是按行处理的，确保 buffer 在 done 前被处理
                     const lines = buffer.split('\n');
                     for (const line of lines) {
                         processStreamChunk(line, onData);
                     }
                }
                if (onComplete) onComplete(); // 流结束
                break;
            }

            // 将 Uint8Array 转换为字符串并添加到缓冲区
            buffer += decoder.decode(value, { stream: true });

            // 按换行符分割缓冲区
            const lines = buffer.split('\n');
            buffer = lines.pop(); // 将最后一个（可能不完整）行放回缓冲区

            // 处理完整的行
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
 * @param {function} onData - 回调函数，用于处理提取的文本
 */
function processStreamChunk(chunk, onData) {
     // Pollinations.ai 的 SSE 格式是 `data: {"...}\n\n` 或 `data: [DONE]`
     // 我们关注以 `data: ` 开头的行
     if (chunk.startsWith('data: ')) {
         const data = chunk.substring(6).trim(); // 移除 "data: " 前缀并去除首尾空格

         if (data === '[DONE]') {
             // 流结束标志，由 while (true) 中的 done 已经处理了 onComplete
             return;
         }

         try {
             const json = JSON.parse(data);

             // 提取文本内容
             // 检查 json 结构是否符合预期 (有 choices 数组，数组元素有 delta 对象，delta 有 content)
             if (json.choices && Array.isArray(json.choices) && json.choices.length > 0) {
                 const choice = json.choices[0]; // 通常只有一个候选项
                 // 检查 delta 中是否有 content
                 if (choice.delta && choice.delta.content !== undefined) {
                     // 将新的文本块传递给 UI
                     if (onData) onData(choice.delta.content);
                 }
                 // 注意：第一个 delta 块可能只有 role 信息，没有 content。
                 // 最后一个 delta 块（在 finish_reason "stop" 之前）可能也没有 content，但有 finish_reason。
                 // 我们只处理有 content 的 delta。
             } else {
                 // 打印出非预期格式的 JSON，以便调试
                 console.warn("Received unexpected JSON format in stream:", json);
             }

         } catch (e) {
             // 如果不是有效的 JSON，可能是其他控制信息或格式错误
             console.warn("Could not parse JSON from stream chunk:", chunk, e);
         }
     } else if (chunk.trim().length > 0) {
         // 处理非 data: 开头的非空行，可能是一些头部信息或错误
         // console.warn("Received non-data line in stream:", chunk); // 通常可以忽略这些行
     }
     // 忽略空行
}


/**
 * 调用 Pollinations.ai API 生成图片 (txt2img)
 * @param {string} prompt - 用户输入 (生成图片的提示词)
 * @returns {Promise<string>} Promise 解析为图片 URL
 */
export async function callTxt2ImgApi(prompt) {
    // URL 编码提示词
    const encodedPrompt = encodeURIComponent(prompt);
    const url = `${API_BASE_URL_IMAGE}/prompt/${encodedPrompt}`; // 使用 image 端点

    try {
        const response = await fetch(url, {
             method: 'GET'
        });

        if (!response.ok) {
             const errorText = await response.text();
             console.error(`Error calling Txt2Img API: ${response.status} ${response.statusText}`, errorText);
             throw new Error(`生成图片失败：${response.status} ${response.statusText} - ${errorText.substring(0, 100)}...`);
        }

        const imageUrl = response.url;

        return imageUrl; // 返回图片 URL

    } catch (error) {
        console.error('Error calling Txt2Img API:', error);
        throw new Error(`发生网络或未知错误：${error.message}`);
    }
}

/**
 * 调用 Pollinations.ai API 生成音频 (txt2audio)
 * @param {string} prompt - 用户输入 (要转为音频的文本)
 * @param {string} voice - 语音选择 ('voice1' 或 'voice2')
 * @returns {Promise<string>} Promise 解析为音频 URL
 */
export async function callTxt2AudioApi(prompt, voice) {
    // URL 编码提示词
    const encodedPrompt = encodeURIComponent(prompt);
     // 确保语音参数是有效值，默认为 voice1
    const selectedVoice = voice === 'voice2' ? 'voice2' : 'voice1';

    // 按照文档构建 URL
    const url = `${API_BASE_URL_TEXT}/${encodedPrompt}?model=openai-audio&voice=${selectedVoice}`; // 使用 text 端点带特定模型和语音参数

    try {
        const response = await fetch(url, {
             method: 'GET'
        });

        if (!response.ok) {
             const errorText = await response.text();
             console.error(`Error calling Txt2Audio API: ${response.status} ${response.statusText}`, errorText);
             throw new Error(`生成音频失败：${response.status} ${response.statusText} - ${errorText.substring(0, 100)}...`);
        }

        const audioUrl = response.url;

        return audioUrl; // 返回音频 URL

    } catch (error) {
        console.error('Error calling Txt2Audio API:', error);
        throw new Error(`发生网络或未知错误：${error.message}`);
    }
}


