// js/api.js

const API_BASE_URL_TEXT = 'https://pic.941125.eu.org/text';
const API_BASE_URL_IMAGE = 'https://pic.941125.eu.org/image';

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


// js/api.js (修改 callAIApi 函数)

// ... (其他导入和函数保持不变) ...

/**
 * 调用 Pollinations.ai API 进行文本生成 (聊天 - /openai 端点)
 * 支持上下文 (messages 数组) 和流式传输。
 * @param {string} prompt - 当前用户输入文本
 * @param {string} systemPrompt - 系统提示词 (可选，将作为 messages 数组中的 system 角色消息)
 * @param {string} model - 使用的模型名称 (必需)
 * @param {Array<object>} uploadedFiles - 已上传文件数组 [{ id: '...', name: '...', type: '...', size: '...', file: File }] (包含 File 对象)。 Pollinations.ai 的 /openai 端点支持多模态输入，会尝试将图片内容编码后发送。我们将尝试扩展处理文本文件。
 * @param {Array<object>} chatMessages - 聊天历史消息数组 [{ sender: 'user' | 'ai', content: '...', type?: 'text' | 'image' | 'audio', url?: string, files?: Array<{ name: string, type: string }> }]。注意，这里假设 chatMessages 已经排除了 system 消息。**图片和音频类型的历史消息及其关联文件内容将被排除在发送给文本 API 的上下文之外。** 用户文本消息中包含的文件信息元数据会保留，但文件内容不会再次发送。
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

     // 添加聊天历史 (过滤掉非文本消息及其关联的文件内容)
     if (chatMessages && Array.isArray(chatMessages)) {
         // 限制发送的历史记录数量，避免过长
         const historyLength = 20; // 可以适当增加一些历史记录
         const recentMessages = chatMessages.slice(-historyLength);

         for (const msg of recentMessages) { // 使用 for...of 循环以便 await
             // ** 过滤掉非文本类型的消息及其关联的文件内容 **
             if (msg.type === 'image' || msg.type === 'audio') {
                  // 忽略图片和音频消息，不将其添加到发送给文本 API 的上下文
                  console.log(`Skipping historical message type: ${msg.type} for text API context.`);
                  continue; // 跳过当前循环迭代
             }

             // 确保历史消息的 role 是 'user' 或 'assistant'
             const role = msg.sender === 'user' ? 'user' : 'assistant';

             // 对于文本消息，我们需要构建其内容数组，以兼容多模态格式
             let msgContentArray = [];

             // 如果历史消息有文本内容
             if (msg.content && typeof msg.content === 'string' && msg.content.trim()) {
                 msgContentArray.push({ type: 'text', text: msg.content });
             }

             // 理论上历史图片和音频已经被过滤，但如果历史用户消息中包含图片url（例如，用户上传图片后的用户消息），虽然我们之前过滤了，但这里为了更严格模拟OpenAI的多模态格式，我们检查是否有图片的URL（尽管图片内容没有发送）
             // **重要：这里的处理仅是模拟，如果 Pollinations.ai 不支持历史消息中包含图片URL，这部分可以省略或调整**
             if (msg.sender === 'user' && msg.files && Array.isArray(msg.files) && msg.files.length > 0) {
                  // 遍历用户消息关联的文件信息（这里只有元数据，没有文件内容）
                  // 检查是否有图片文件信息，并模拟添加到 content 数组中
                  // 注意：这里只是添加一个标记或简单的描述，因为实际文件内容在构建历史消息时已被过滤
                  const imageFileInfo = msg.files.find(f => f.type && f.type.startsWith('image/'));
                  if (imageFileInfo) {
                       // 我们可以尝试在历史用户消息中包含图片URL，但这是模拟，取决于Pollinations.ai是否接受这种历史格式
                       // 更好的做法是，如果历史消息是图片类型（已经在上面过滤掉了），则不包含。
                       // 如果历史用户消息是纯文本，且之前上传了图片，那图片内容只在发送该消息时处理一次。
                       // 这里的逻辑是：历史消息中只包含文本内容，图片和音频消息类型被完全跳过。
                       // 因此，我们不需要在历史文本消息中模拟 image_url。
                  }

                   // 同样，对于历史用户消息中的非图片文件信息，我们也不在消息内容中包含其内容
                   const nonImageFileInfo = msg.files.filter(f => f.type && !f.type.startsWith('image/'));
                   if (nonImageFileInfo.length > 0) {
                        // 可以在历史用户消息中添加一个文本标记，说明用户上传了文件（不包含内容）
                       const fileNames = nonImageFileInfo.map(f => f.name).join(', ');
                        // This might make the context too long, consider if really needed
                       // msgContentArray.push({ type: 'text', text: `\n\n[用户上传了文件: ${fileNames}]` });
                   }
             }


             // 对于 AI 消息，其 content 通常是字符串（文本）
             if (msg.sender === 'assistant' && msg.content && typeof msg.content === 'string') {
                  msgContentArray.push({ type: 'text', text: msg.content });
             } else if (msg.sender === 'assistant' && msg.type === 'image' && msg.url) {
                  // 虽然我们在过滤历史消息时跳过了图片消息类型，
                  // 但如果 Pollinations.ai 兼容 OpenAI，可能需要以 image_url 格式包含 AI 生成的历史图片。
                  // 这取决于 Pollinations.ai 的具体实现。
                  // 为了更接近 OpenAI 的多模态历史消息格式，如果历史 AI 消息是图片类型，我们可以包含其 URL。
                  // 如果上面过滤掉 image/audio 类型的历史消息逻辑保留，则这里无需处理。
                  // 如果需要包含历史图片，需要移除上面的过滤逻辑，并像下面这样处理：
                  /*
                  msgContentArray.push({ type: 'image_url', image_url: { url: msg.url } });
                   if (msg.content && typeof msg.content === 'string' && msg.content.trim()) {
                       // 图片描述也可以作为文本部分包含
                       msgContentArray.push({ type: 'text', text: msg.content });
                   }
                   */
                  // **为了简单起见和符合您当前的代码逻辑，我们继续过滤掉 image/audio 历史消息，只处理文本历史。**
             }


             // 只有当构建的内容数组不为空时才添加消息
             if (msgContentArray.length > 0) {
                 messages.push({
                     role: role,
                     content: msgContentArray.length === 1 && msgContentArray[0].type === 'text' ? msgContentArray[0].text : msgContentArray // 如果只有一个文本元素，直接发送字符串，否则发送数组
                 });
             }

         }
     }


     // ** 构建当前用户消息的内容 - 支持多模态 (图片和文本文件) **
     let currentUserContent = [];

     // 1. 添加用户输入的文本内容
     if (prompt && prompt.trim()) {
          currentUserContent.push({ type: 'text', text: prompt });
     }

     // 2. 处理文件上传给聊天 API (处理图片和文本文件，并编码)
     if (uploadedFiles && Array.isArray(uploadedFiles) && uploadedFiles.length > 0) {
        for (const fileInfo of uploadedFiles) { // 遍历所有上传的文件
            const file = fileInfo.file;
            if (file) {
                if (file.type.startsWith('image/')) {
                     try {
                        const base64ImageData = await readFileAsBase64(file);
                        // OpenAI 多模态图片格式
                        currentUserContent.push({ type: 'image_url', image_url: { url: base64ImageData } });
                        console.log(`Added uploaded image "${file.name}" (${file.type}) to current user message content.`);
                     } catch (error) {
                        console.error(`Error reading image file "${file.name}" for API call:`, error);
                        // 如果读取文件失败，添加一个文本标记告知 AI
                        currentUserContent.push({ type: 'text', text: `\n\n[注意：无法读取上传的图片文件 "${file.name}"]` });
                        if (onError) onError(`无法读取图片文件 "${file.name}"：` + error.message);
                     }
                } else if (file.type === 'text/plain') { // 检查是否是纯文本文件
                     try {
                         const textContent = await file.text(); // 使用 file.text() 读取文本内容
                         // 尝试将文本文件内容作为文本部分添加到 content 数组中
                         // 模拟一种包含文件内容的结构，希望 Pollinations.ai 能识别
                         // 格式示例：{ type: "text", text: "文件 [文件名]: 文件内容..." }
                         currentUserContent.push({ type: 'text', text: `\n\n**文件内容 [${file.name}]**: \n\n${textContent}\n\n--- 文件内容结束 ---` });
                         console.log(`Added uploaded text file "${file.name}" (${file.type}) content to current user message content.`);
                     } catch (error) {
                         console.error(`Error reading text file "${file.name}" for API call:`, error);
                         // 如果读取文件失败，添加一个文本标记告知 AI
                         currentUserContent.push({ type: 'text', text: `\n\n[注意：无法读取上传的文本文件 "${file.name}"]` });
                         if (onError) onError(`无法读取文本文件 "${file.name}"：` + error.message);
                     }
                } else {
                    // 对于其他不支持直接处理的文件类型，添加一个文本标记告知 AI
                    console.warn(`Uploaded file "${file.name}" (${file.type}) is not an image or plain text, skipping content processing for multi-modal input.`);
                     currentUserContent.push({ type: 'text', text: `\n\n[用户上传了文件: ${file.name} (${file.type})]` });
                }
            }
        }
     }


     // 如果 currentUserContent 是空数组，表示用户没有输入文本也没有上传可处理的文件，此时不应该调用 API
     // 但如果只上传了不可处理的文件，currentUserContent 可能只包含一个文本标记，这时应该调用 API
     if (currentUserContent.length === 0) {
         console.log("User message content is empty (no text and no processable files). Skipping API call.");
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

        // ... (错误处理和流式处理逻辑保持不变) ...

         if (!response.ok) {
              // ... error handling ...
              const errorText = await response.text();
              console.error(`Error calling AI API (/openai): ${response.status} ${response.statusText}`, errorText);
              if (onError) {
                  try {
                      const errorJson = JSON.parse(errorText);
                       // Check for specific error details like OpenAI does
                      const errorMessageDetail = errorJson.detail || (errorJson.error ? errorJson.error.message || JSON.stringify(errorJson.error) : errorText);
                      onError(`API 请求失败：${response.status} ${response.statusText} - ${errorMessageDetail.substring(0, 200)}...`);
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

// ... (fetchModels, readFileAsBase64, processStreamChunk, callTxt2ImgApi, callTxt2AudioApi 函数保持不变) ...



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
    console.log(`Constructing markdown image for prompt: "${prompt}"`);
    // 检查提示词是否为空或只有空白字符
    if (!prompt || prompt.trim().length === 0) {
        console.warn("Txt2Img API called with empty or whitespace prompt. Returning empty string.");
        // 返回一个空字符串或一个提示信息，取决于前端如何处理
        // 这里返回一个简单的提示，表示需要有效的提示词
        return "请提供有效的图片生成提示词。";
    }
    // Pollinations.ai 的 image/prompt/{prompt} 服务 URL 结构
    // 格式：https://pic.941125.eu.org/image/prompt/{encodedPrompt}?nologo=true
    const encodedPrompt = encodeURIComponent(prompt.trim()); // 对提示词进行编码并去除首尾空白
    // 构建完整的图片 URL
    // 注意：这个 URL 是 Pollinations.ai 用于**直接访问**根据提示词生成的图片的 URL
    // 它不像传统的 API 请求需要等待生成过程
    const imageUrl = `${API_BASE_URL_IMAGE}/prompt/${encodedPrompt}?nologo=true`; // 添加enhance=true可能提高质量
    console.log("Constructed image URL:", imageUrl);

        // 额外检查：Pollinations.ai 可能会返回一个表示错误的图片URL
        // 例如包含 "failed" 或特定占位图的 URL。可以根据实际情况添加判断。
        // 目前简单地返回获取到的 URL。

        return imageUrl;

    
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
