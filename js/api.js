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
 * 调用 Pollinations.ai API 进行文本生成 (使用 GET 端点)
 * 使用 URL 结构：https://text.pollinations.ai/{input}?stream=true&private=true&model={model}&system={提示词}
 * @param {string} prompt - 用户输入 (将作为 {input} 部分)
 * @param {string} systemPrompt - 系统提示词 (将作为 {提示词} 参数)
 * @param {string} model - 使用的模型名称 (将作为 {model} 参数)
 * @param {Array<object>} uploadedFiles - 已上传文件数组 (此 GET 端点可能不支持文件上传，该参数在此实现中被忽略)
 * @param {Array<object>} chatMessages - 聊天历史消息数组 (此 GET 端点可能不支持消息历史，该参数在此实现中被忽略)
 * @param {function} onData - 回调函数，当接收到新的数据块时调用 (用于流式)
 * @param {function} onComplete - 回调函数，当流结束时调用
 * @param {function} onError - 回调函数，当发生错误时调用
 */
export async function callAIApi(prompt, systemPrompt, model, uploadedFiles, chatMessages, onData, onComplete, onError) {
     try {
        // 对用户输入、模型和系统提示词进行 URL 编码
        const encodedInput = encodeURIComponent(prompt);
        const encodedModel = encodeURIComponent(model || ''); // 确保有默认值或处理空模型情况
        const encodedSystemPrompt = encodeURIComponent(systemPrompt || ''); // 确保有默认值或处理空系统提示词情况

        // 构建 Pollinations.ai GET API URL
        // 严格按照您提供的 URL 结构
        const url = `${API_BASE_URL_TEXT}/${encodedInput}?stream=true&private=true&model=${encodedModel}&system=${encodedSystemPrompt}`;

        console.log("Calling Pollinations.ai Txt2Txt API with URL:", url); // 调试输出 URL

        const response = await fetch(url, {
            method: 'GET', // GET 请求
            headers: {
                // Pollinations.ai GET 端点可能不需要特定的 Content-Type 或 API Key headers
                // 如果您有 API Key 并需要添加，请查阅其文档
            },
        });

        if (!response.ok) {
             const errorText = await response.text();
             console.error(`Error calling AI API: ${response.status} ${response.statusText}`, errorText);
             if (onError) {
                 try {
                     const errorJson = JSON.parse(errorText);
                     const errorMessage = errorJson.detail || errorJson.error || errorText;
                     onError(`API 请求失败：${response.status} ${response.statusText} - ${errorMessage}`);
                 } catch (e) {
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
                    processStreamChunk(buffer, onData);
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
        console.error('Error calling AI API:', error);
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
                 if (choice.delta && choice.delta.content !== undefined) {
                     // 将新的文本块传递给 UI
                     if (onData) onData(choice.delta.content);
                 }
             } else {
                 // 打印出非预期格式的 JSON，以便调试
                 console.warn("Received unexpected JSON format in stream:", json);
             }

         } catch (e) {
             // 如果不是有效的 JSON，可能是其他控制信息或格式错误
             console.warn("Could not parse JSON from stream chunk:", chunk, e);
             // 可以选择将原始数据也传递给 onData 或忽略
             // if (onData) onData(chunk + '\n'); // 显示原始行
         }
     } else if (chunk.trim().length > 0) {
         // 处理非 data: 开头的非空行，可能是一些头部信息或错误
         console.warn("Received non-data line in stream:", chunk);
         // 可以选择将原始数据也传递给 onData 或忽略
         // if (onData) onData(chunk + '\n'); // 显示原始行
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


// 导出 API 调用函数

