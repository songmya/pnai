/**
 * 生成一个简单的唯一 ID
 * @returns {string} - 唯一 ID 字符串
 */
export function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// TODO: 可以添加其他通用工具函数，例如格式化文件大小、时间等
// export function formatBytes(bytes, decimals = 2) { ... }
