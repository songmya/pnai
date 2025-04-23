// 导入必要的数据
import { currentChatId, chats } from './main.js';

// TODO: 在这里存储或获取你的 AI API Key
// 安全提示：将 API Key 直接写在代码中是非常不安全的。
// 更好的方法是让用户在运行时输入，或者通过环境变量等方式。
const API_KEY = 'YOUR_AI_API_KEY'; // 替换为你的 API Key (不安全)

// AI API 的端点 URL
const API_URL = 'YOUR_AI_API_ENDPOINT'; // 替换为你的 AI API 的 URL

/**
 * 调用 AI API 获取回复
 * @param {string} messageContent - 用户消息内容
 * @param {string} systemPrompt - 系统提示词
 * @param {string} model - 选择的模型
 * @param {Array} uploadedFiles - 已上传文件数组 [{ id: '...', name: '...', type: '...', size: '...', file: File }]
 * @returns {Promise<object>} - 包含 AI 回复文本的 Promise
 */
export async function callAIApi(messageContent, systemPrompt, model, uploadedFiles) {
    if (!API_KEY || API_KEY === 'YOUR_AI_API_KEY') {
        alert('请配置你的 AI API Key！'); // 简单的提示，可以在 UI 中实现更友好的提示
        return { text: '请先配置 API Key。' };
    }

    if (!API_URL || API_URL === 'YOUR_AI_API_ENDPOINT') {
         alert('请配置你的 AI API Endpoint！');
         return { text: '请先配置 API Endpoint。' };
    }

    try {
        // TODO: 根据你使用的 AI API 构建请求体
        // 不同的 AI 模型 API 请求体格式差异很大
        // 可能需要包含：
        // - 用户消息 (messageContent)
        // - 系统提示词 (systemPrompt)
        // - 模型 (model)
        // - 聊天历史 (chats[currentChatId].messages) - 传递历史消息以保持上下文
        // - 文件内容 (uploadedFiles) - 需要读取文件内容或提供文件链接

        const requestBody = {
            messages: [
                 // 可以添加系统提示词作为第一条消息
                 { role: 'system', content: systemPrompt },
                 // 添加历史消息
                 ...chats[currentChatId].messages.map(msg => ({
                     role: msg.sender === 'user' ? 'user' : 'assistant',
                     content: msg.content,
                     // TODO: 如果 API 支持，这里也可以包含文件信息
                 })),
                 // 添加当前用户消息
                 {
                     role: 'user',
                     content: messageContent,
                     // TODO: 将文件内容添加到这里，可能需要读取文件或提供链接
                 }
            ],
            model: model,
            // 其他可能的参数，例如 temperature, max_tokens 等
        };

        // TODO: 处理文件内容，例如读取文件内容并编码为 base64
        // 示例：读取第一个文件的内容 (仅为示例，实际需要处理所有文件)
        // if (uploadedFiles.length > 0) {
        //      const file = uploadedFiles[0].file; // 获取 File 对象
        //      const reader = new FileReader();
        //      reader.onload = (e) => {
        //          const fileContent = e.target.result; // base64 编码的文件内容
        //          // 将文件内容添加到 requestBody 中，具体格式取决于 API
        //          requestBody.messages[requestBody.messages.length - 1].content = [
        //              { type: 'text', text: messageContent },
        //              { type: 'image_url', image_url: { url: fileContent } } // 示例：上传图片作为 base64
        //          ];
        //          // 然后发送请求
        //      };
        //      reader.readAsDataURL(file); // 以 base64 格式读取文件
        // } else {
             // 如果没有文件，直接发送文本请求
             const response = await fetch(API_URL, {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                     'Authorization': `Bearer ${API_KEY}` // 如果 API 使用 Bearer Token 认证
                     // 可能还需要其他头部信息
                 },
                 body: JSON.stringify(requestBody)
             });

             if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorData.error.message}`);
             }

             const data = await response.json();

             // TODO: 根据 API 响应格式提取 AI 的回复文本
             // 示例：OpenAI GPT API 的响应格式
             const aiResponseText = data.choices[0]?.message?.content || '没有收到回复。';

             return { text: aiResponseText }; // 返回包含回复文本的对象
        // }

    } catch (error) {
        console.error('Error calling AI API:', error);
        // 在 UI 中显示错误信息
        return { text: `发生错误：${error.message}` };
    }
}
