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

        // Pollinations.ai 的文本生成 GET 端点通常使用 GET 方法
        const response = await fetch(url, {
            method: 'GET', // GET 请求
            headers: {
                // Pollinations.ai GET 端点可能不需要特定的 Content-Type 或 API Key headers
                // 如果您有 API Key 并需要添加，请查阅其文档
            },
             // GET 请求没有 body
        });

        if (!response.ok) {
             // 检查非 2xx 状态码
             const errorText = await response.text();
             console.error(`Error calling AI API: ${response.status} ${response.statusText}`, errorText);
             if (onError) {
                 // 尝试解析错误响应是否是 JSON，如果不是，显示原始文本
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

        // **处理流式文本回复**
        // Pollinations.ai 的 GET 端点通常直接返回文本流，而不是 SSE 或 JSON 对象流
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

            // 对于简单的文本流，每次读取到数据就传递给 onData 回调
            // Pollinations.ai 的这个 GET 端点可能就是简单的文本流
            if (buffer.length > 0) {
                if (onData) onData(buffer);
                buffer = ''; // 处理后清空缓冲区
            }
        }

     } catch (error) {
        console.error('Error calling AI API:', error);
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
