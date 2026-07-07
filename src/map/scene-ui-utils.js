// ============================================
// 场景地图 UI 共用工具：HTML 转义、皮肤同步、动作发送、主角名
// ============================================
import {
  ANCIENT_FAMILY_SKIN_IDS,
  DEFAULT_DARK_SKIN_ID,
  HTML_SKIN_ACTIVE_CLASS,
  JRPG_FAMILY_SKIN_IDS,
  PERSONA_FAMILY_SKIN_IDS,
  SCRIPT_NAME,
  SHUJIAN_FAMILY_SKIN_IDS,
  TWILIGHT_FAMILY_SKIN_IDS,
  YANYUN_FAMILY_SKIN_IDS,
} from '../core/constants.js';
import { $, topWindow } from '../core/env.js';
import { SpriteManager } from '../sprite/sprite-manager.js';
import { showToast } from '../ui/toast.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 把主界面 overlay 的皮肤 class 复制到弹窗自身（弹窗挂在 body/全屏根，无法靠后代选择器继承皮肤）
export function syncSceneModalSkinClass($modal) {
  if (!$modal?.length) return;
  const $overlay = $('#gal-global-overlay');
  [
    ...SHUJIAN_FAMILY_SKIN_IDS,
    ...PERSONA_FAMILY_SKIN_IDS,
    ...ANCIENT_FAMILY_SKIN_IDS,
    ...JRPG_FAMILY_SKIN_IDS,
    ...YANYUN_FAMILY_SKIN_IDS,
    ...TWILIGHT_FAMILY_SKIN_IDS,
    DEFAULT_DARK_SKIN_ID,
    HTML_SKIN_ACTIVE_CLASS,
  ].forEach(skinClass => {
    $modal.toggleClass(skinClass, $overlay.hasClass(skinClass));
  });
}

// 主角显示名（表/酒馆取不到时用「你」）
export function getProtagonistDisplayName() {
  try {
    const name = SpriteManager.protagonistName || SpriteManager.getProtagonistName();
    return String(name || '').trim() || '你';
  } catch {
    return '你';
  }
}

/**
 * 把动作文本填入聊天输入框（不自动发送——玩家可继续补充内容后自行发送）
 * @param {string} text 第三人称动作文本（不含 <user> 前缀）
 * @returns {boolean} 是否成功写入输入框
 */
export function fillActionText(text) {
  const actionText = String(text || '').trim();
  if (!actionText) return false;

  const $textarea = $(topWindow.document).find('#send_textarea');
  if (!$textarea.length) {
    showToast('未找到输入框');
    return false;
  }

  const payload = `<user>${actionText}`;
  const currentVal = ($textarea.val() || '').trim();
  if (!currentVal) {
    $textarea.val(payload).trigger('input').trigger('change');
  } else {
    $textarea.val(`${currentVal} ${payload}`).trigger('input').trigger('change');
  }
  $textarea.trigger('focus');
  showToast(`已填入输入框，可补充内容后发送: ${actionText.substring(0, 20)}${actionText.length > 20 ? '...' : ''}`);
  console.log(`[${SCRIPT_NAME}] 场景地图动作已填入输入框: ${actionText}`);
  return true;
}
