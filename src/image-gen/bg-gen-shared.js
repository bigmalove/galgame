import { SCRIPT_NAME } from '../core/constants.js';
import { $ } from '../core/env.js';
import { GalgameStore } from '../core/store.js';
import { SpriteManager } from '../sprite/sprite-manager.js';

// ============================================
// 背景生成模块共享逻辑
// ============================================

const messageSegmentState = GalgameStore.cache.segments;

// 延迟引用 (由 index.js 注入)
let _updateGlobalOverlayContentRef = null;
let _showToastRef = null;

export function setBgGenSharedRefs({ updateGlobalOverlayContent, showToast }) {
  if (updateGlobalOverlayContent) _updateGlobalOverlayContentRef = updateGlobalOverlayContent;
  if (showToast) _showToastRef = showToast;
}

export function showBgGenToast(msg) {
  if (_showToastRef) _showToastRef(msg);
}

/**
 * 背景生成完成后，刷新当前最后一条 AI 消息的 overlay UI。
 * 当最后一条消息正在显示该场景时，强制重新渲染。
 */
export function refreshUIForScene(sceneName) {
  const $lastMes = $('#chat > .mes').last();
  if (!$lastMes.length) return;

  const mesId = $lastMes.attr('mesid');
  const state = messageSegmentState.get(String(mesId));
  if (
    state &&
    state.parsedContent &&
    state.parsedContent.currentBackground &&
    state.parsedContent.currentBackground.scene === sceneName
  ) {
    SpriteManager.currentScene = null;
    console.log(`[${SCRIPT_NAME}] 背景生成: 强制刷新UI: ${sceneName}`);
    if (_updateGlobalOverlayContentRef) {
      _updateGlobalOverlayContentRef(mesId, state.parsedContent);
    }
  }
}
