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
 * @param {Array<object>} uploadedFiles - 已上传文件数组 [{ id: '...', name: '...', type: '...', size: '...', file: File }] (包含 File 对象)。Pollinations.ai 的 /openai 端点可能需要特定格式处理文件，这里暂时只处理图片并放入 content。
 * @param {Array<object>} chatMessages - 聊天历史消息数组 [{ sender: 'user' | 'ai', content: '...', type?: 'text' | 'image' | 'audio', url?: string }]。注意，这里假设 chatMessages 已经排除了 system 消息。**图片和音频类型的消息将被排除在发送给 API 的上下文之外。**
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

     // 添加聊天历史 (过滤掉图片和音频消息)
     if (chatMessages && Array.isArray(chatMessages)) {
         // 限制发送的历史记录数量，避免过长
         const historyLength = 10; // 根据需要调整
         const recentMessages = chatMessages.slice(-historyLength);

         recentMessages.forEach(msg => {
             // ** 过滤掉非文本类型的消息 **
             if (msg.type === 'image' || msg.type === 'audio') {
                  // 忽略图片和音频消息，不将其添加到发送给文本 API 的上下文
                  console.log(`Skipping historical message type: ${msg.type} for text API context.`);
                  return; // 跳过当前循环迭代
             }

             // 确保历史消息的 role 是 'user' 或 'assistant'
             const role = msg.sender === 'user' ? 'user' : 'assistant';
             // 对于文本消息，直接使用 content
             const msgContent = msg.content;

             messages.push({
                 role: role,
                 content: msgContent
             });
         });
     }

     // 构建当前用户消息的内容
     // 当前用户输入（prompt）是文本
     let userContent = prompt;

     // 处理文件上传给聊天 API (只处理图片并编码为 Base64，添加到当前用户消息)
     // Pollinations.ai /openai 端点对图片的处理可能遵循 OpenAI 的格式
     let base64ImageData = null;
     if (uploadedFiles && Array.isArray(uploadedFiles) && uploadedFiles.length > 0) {
         const firstFile = uploadedFiles[0].file;
         if (firstFile && firstFile.type.startsWith('image/')) {
              try {
                 base64ImageData = await readFileAsBase64(firstFile);
                 // Pollinations.ai 的 /openai 端点如果支持多模态，可能需要一个数组
                 // { role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: base64ImageData } }] }
                 // 如果 Pollinations.ai /openai 支持这种格式，将 userContent 变成数组
                 userContent = [
                     { type: 'text', text: prompt },
                     { type: 'image_url', image_url: { url: base64ImageData } }
                 ];
                 console.log("Added uploaded image to current user message content.");
              } catch (error) {
                 console.error("Error reading image file for API call:", error);
                 if (onError) onError("无法读取图片文件：" + error.message);
                 // 读取文件失败，但不中断整个 API 调用，只记录错误并继续发送文本
                 // 如果您希望文件读取失败就终止，可以将 return; 放在这里
              }
         } else {
             console.warn("Uploaded file is not an image or no file provided for chat API, skipping image processing.");
         }
     }


     // 添加当前用户消息
      messages.push({
         role: 'user',
         content: userContent // userContent 可能是字符串或数组
      });


     // ** 构建 POST 请求的 body **
     const body = {
        model: model, // 使用传入的模型名称
        private: "true", // 根据 curl 示例添加 private 参数
        // system: systemPrompt, // 注释掉避免重复，messages 中已经包含了
        messages: messages, // 发送构建好的 messages 数组 (已过滤历史图片/音频)
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
 * @param {function} onData - 回调函数，用于处理提取的文本
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
    const url = `${API_BASE_URL_IMAGE}/prompt/${encodedPrompt}?nologo&nologo=true&enhance=true`;

    try {
        const response = await fetch(url, {
             method: 'GET'
        });

        if (!response.ok) {
             const errorText = await response.text();
             console.error(`Error calling Txt2Img API: ${response.status} ${response.statusText}`, errorText);
             try {
                 const errorJson = JSON.parse(errorText);
                 const errorMessage = errorJson.detail || errorJson.error || errorText;
                 throw new Error(`生成图片失败：${response.status} ${response.statusText} - ${errorMessage}`);
             } catch (e) {
                 throw new Error(`生成图片失败：${response.status} ${response.statusText} - ${errorText.substring(0, 100)}...`);
             }
        }

        const imageUrl = response.url;
        console.log("Generated image URL:", imageUrl);

        return imageUrl;

    } catch (error) {
        console.error('Error calling Txt2Img API:', error);
        throw error;
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

    const url = `${API_BASE_URL_TEXT}/${encodedPrompt}?model=openai-audio&voice=${selectedVoice}`;
     console.warn("Calling Pollinations.ai Txt2Audio API with URL:", url, "using GET method. Confirm this is the correct endpoint from documentation.");


    try {
        const response = await fetch(url, {
             method: 'GET'
        });

        if (!response.ok) {
             const errorText = await response.text();
             console.error(`Error calling Txt2Audio API: ${response.status} ${response.statusText}`, errorText);
             try {
                 const errorJson = JSON.parse(errorText);
                 const errorMessage = errorJson.detail || errorJson.error || errorText;
                 throw new Error(`生成音频失败：${response.status} ${response.statusText} - ${errorMessage}`);
             } catch (e) {
                  throw new Error(`生成音频失败：${response.status} ${response.statusText} - ${errorText.substring(0, 100)}...`);
             }
        }

        const audioUrl = response.url;
        console.log("Generated audio URL:", audioUrl);

        return audioUrl;

    } catch (error) {
        console.error('Error calling Txt2Audio API:', error);
        throw error;
    }
}


