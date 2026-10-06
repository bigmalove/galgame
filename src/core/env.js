/* global SillyTavern */
// ============================================
// 环境单例 - 顶层窗口引用
// ============================================
export const topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
export const $ = topWindow.jQuery || window.jQuery;

// 酒馆提供给扩展的稳定接口（酒馆助手脚本内的 SillyTavern 每次访问都是最新的 getContext()）
export function getTavernContext() {
  if (typeof SillyTavern === 'undefined') return null;
  const ctx = SillyTavern;
  return Array.isArray(ctx?.chat) || typeof ctx?.getContext !== 'function' ? ctx : ctx.getContext();
}
