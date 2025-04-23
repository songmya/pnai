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
 * 调用 Pollinations.ai API 进行文本生成 (聊天 - /chat 端点)
 * @param {string} prompt - 用户输入
 * @param {string} systemPrompt - 系统提示词 (可选)
 * @param {string} model - 使用的模型名称 (必需)
 * @param {Array<object>} uploadedFiles - 已上传文件数组 [{ id: '...', name: '...', type: '...', size: '...', file: File }] (包含 File 对象)
 * @param {Array<object>} chatMessages - 聊天历史消息数组 (用于提供上下文)
 * @param {function} onData - 回调函数，当接收到新的数据块时调用 (用于流式)
 * @param {function} onComplete - 回调函数，当流结束时调用
 * @param {function} onError - 回调函数，当发生错误时调用
 */
export async function callAIApi(prompt, systemPrompt, model, uploadedFiles, chatMessages, onData, onComplete, onError) {
     const url = `${API_BASE_URL_TEXT}/chat`;

     const messages = [];

     if (systemPrompt && systemPrompt.trim()) {
          messages.push({ role: 'system', content: systemPrompt });
     }

     if (chatMessages && Array.isArray(chatMessages)) {
         // Pollinations.ai 的 /chat 端点支持 messages 数组，但文件可能需要单独处理
         // 为了简单起见，我们只将文本历史包含进来
         chatMessages.forEach(msg => {
             if (msg.sender === 'user' || msg.sender === 'ai') {
                 messages.push({
                     role: msg.sender === 'user' ? 'user' : 'assistant',
                     content: msg.content
                 });
             }
         });
     }

     // 构建用户消息内容
     let userContent = [{ type: 'text', text: prompt }];

     // 处理文件上传（只处理第一个图片文件并编码为 Base64）
     let base64ImageData = null;
     if (uploadedFiles && Array.isArray(uploadedFiles) && uploadedFiles.length > 0) {
         const firstFile = uploadedFiles[0].file;
         if (firstFile && firstFile.type.startsWith('image/')) {
              try {
                 base64ImageData = await readFileAsBase64(firstFile);
                 // 将图片信息添加到用户消息内容中（GPT-4V 格式）
                 userContent.push({ type: 'image_url', image_url: { url: base64ImageData } });
              } catch (error) {
                 console.error("Error reading image file:", error);
                 if (onError) onError("无法读取图片文件：" + error.message);
                 return; // 读取文件失败，停止后续操作
              }
         } else {
             console.warn("Uploaded file is not an image, skipping.");
             // 可以在 UI 中提示用户只支持图片上传
         }
     }

     messages.push({
         role: 'user',
         content: userContent
      });

     const body = {
        messages: messages, // 发送完整的消息历史和当前用户消息（含图片）
        model: model, // 使用传入的模型名称
        stream: true // **启用流式传输**
        // private: true // Pollinations.ai 文档中提到 private=true for stream GET，POST 可能不同，先不加
        // 其他可选参数
     };

     try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
             const errorBody = await response.json();
             const errorMessage = errorBody.detail || errorBody.error || JSON.stringify(errorBody);
             console.error(`Error calling AI API (/chat): ${response.status} ${response.statusText}`, errorBody);
             if (onError) onError(`API 请求失败：${response.status} ${response.statusText} - ${errorMessage}`);
             return;
        }

        // **处理流式回复**
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                if (onComplete) onComplete(); // 流结束
                break;
            }

            // 将 Uint8Array 转换为字符串
            buffer += decoder.decode(value, { stream: true });

            // Pollinations.ai 的流式回复可能每块都是完整的文本，也可能是分块的
            // 如果是分块的，需要解析事件流 (Server-Sent Events - SSE)
            // 常见的 SSE 格式是 `data: ...\n\ndata: ...\n\n`
            // 简单的处理方式是假设每块数据都是要显示的文本
            // 但更稳健的方式是解析 SSE
            // Pollinations.ai 的 /chat 接口 POST 带 stream=true 可能返回 JSON 对象流，而不是 SSE
            // 例如： {"text":"..."} {"text":"..."}
            // 简单的处理方式：按换行符分割，尝试解析 JSON
            const lines = buffer.split('\n');
            buffer = lines.pop(); // 最后一个不完整的行留在 buffer 中

            for (const line of lines) {
                if (line.trim() === '') continue; // 跳过空行
                // 尝试解析 JSON
                try {
                    const json = JSON.parse(line);
                     // 假设返回格式是 { text: '...' }
                    if (json && json.text !== undefined) {
                         if (onData) onData(json.text); // 将新的文本块传递给 UI
                    } else {
                        console.warn("Received unexpected JSON format:", json);
                         // 如果格式不对，可以显示原始行或跳过
                         // if (onData) onData(line + '\n'); // 显示原始行
                    }
                } catch (e) {
                    console.warn("Could not parse JSON from stream line:", line, e);
                    // 如果不是 JSON，可能是其他格式的流数据，或者错误信息
                    // 可以在 UI 中显示原始行或忽略
                     // if (onData) onData(line + '\n'); // 显示原始行
                }
            }
        }

     } catch (error) {
        console.error('Error calling AI API (/chat):', error);
        if (onError) onError(`发生网络或未知错误：${error.message}`);
     }
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
        // txt2img 端点直接返回图片文件或重定向到图片 URL
        // 我们直接使用 GET 请求，浏览器会自动处理重定向并加载图片
        // 所以我们直接返回 URL 即可
        // 如果需要先获取图片数据（例如为了预览或处理），可以使用 fetch responseType 'blob' 或 'arrayBuffer'
        // 但这里直接返回 URL 就可以让 UI 显示图片
        const response = await fetch(url, {
             method: 'GET'
             // Pollinations.ai 的 txt2img 端点通常不需要额外头部或认证
        });

        if (!response.ok) {
             // Pollinations.ai 图片生成失败可能返回 HTML 错误页面或 JSON
             const errorText = await response.text();
             console.error(`Error calling Txt2Img API: ${response.status} ${response.statusText}`, errorText);
             // 返回一个表示错误的特殊值或抛出错误
             throw new Error(`生成图片失败：${response.status} ${response.statusText} - ${errorText.substring(0, 100)}...`);
        }

        // 如果请求成功，URL 就是图片 URL
        // 注意：这个 GET 请求可能是一个重定向。fetch API 会跟随重定向。
        // response.url 会是最终的图片 URL。
        const imageUrl = response.url;

        // 您也可以检查 response.headers.get('Content-Type') 是否是图片类型

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

    // 注意：Pollinations.ai 文档中写的是 GET https://text.pollinations.ai/{input}?model=openai-audio&voice={select}
    // 这个 URL 看起来不太符合标准的文本转音频 API 设计，更像是一个文本聊天接口带了音频参数
    // 让我们按照文档来构建 URL，但要注意实际返回可能不是纯音频文件
    // 如果实际返回的是一个指向音频文件的 URL，那么直接返回 URL 即可
    // 如果返回的是一个包含音频数据的流或文件，需要处理 responseType 和 blob/arrayBuffer
    // 假设它直接返回一个指向音频文件的 URL
    const url = `${API_BASE_URL_TEXT}/${encodedPrompt}?model=openai-audio&voice=${selectedVoice}`; // 使用 text 端点带特定模型和语音参数

    try {
        const response = await fetch(url, {
             method: 'GET'
             // 可能需要其他头部，例如 Accept: 'audio/mpeg' 等，但先尝试不加
        });

        if (!response.ok) {
             const errorText = await response.text();
             console.error(`Error calling Txt2Audio API: ${response.status} ${response.statusText}`, errorText);
             throw new Error(`生成音频失败：${response.status} ${response.statusText} - ${errorText.substring(0, 100)}...`);
        }

        // 假设响应 URL 就是音频文件的 URL
        const audioUrl = response.url;

        // 您也可以检查 response.headers.get('Content-Type') 是否是音频类型
        // 例如：'audio/mpeg' 或 'audio/wav'

        return audioUrl; // 返回音频 URL

    } catch (error) {
        console.error('Error calling Txt2Audio API:', error);
        throw new Error(`发生网络或未知错误：${error.message}`);
    }
}


// 辅助函数：将 File 对象读取为 Base64 数据 URL (已在上面定义)
// function readFileAsBase64(file) { ... }

// 导出新的 API 调用函数
export { fetchModels, callAIApi, callTxt2ImgApi, callTxt2AudioApi };
