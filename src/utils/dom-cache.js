import { GalgameStore } from '../core/store.js';

// ============================================
// DOM 缓存工具
// ============================================

export function getCachedChatContainer() {
  return GalgameStore.getCachedDOM('$chatContainer');
}

export function getCachedGlobalOverlay() {
  return GalgameStore.getCachedDOM('$globalOverlay');
}

// 清除 DOM 缓存（在覆盖层重建时调用）
export function invalidateDOMCache() {
  GalgameStore.cache.dom.$chatContainer = null;
  GalgameStore.cache.dom.$globalOverlay = null;
}
