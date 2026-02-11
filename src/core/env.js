// ============================================
// 环境单例 - 顶层窗口引用
// ============================================
export const topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
export const $ = topWindow.jQuery || window.jQuery;
