import { SCRIPT_NAME, RE_THINK_CLOSED, RE_THINK_UNCLOSED } from '../core/constants.js';
import { topWindow } from '../core/env.js';

// ============================================
// HTML 工具函数
// ============================================

// HTML 解码
export function decodeHtml(html) {
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
}

/**
 * 从 SillyTavern 的聊天数组中获取原始消息内容
 * @param {string|number} mesId 消息 ID
 * @returns {string|null} 原始消息内容
 */
export function getRawMessageContent(mesId) {
  var _a, _b;
  try {
    const ctx =
      (_b = (_a = topWindow.SillyTavern) === null || _a === void 0 ? void 0 : _a.getContext) === null || _b === void 0
        ? void 0
        : _b.call(_a);
    if (ctx && ctx.chat && Array.isArray(ctx.chat)) {
      const messageIndex = parseInt(mesId, 10);
      if (!isNaN(messageIndex) && ctx.chat[messageIndex]) {
        const rawContent = ctx.chat[messageIndex].mes;
        if (rawContent) {
          return rawContent;
        }
      }
    }
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 获取原始消息失败:`, e);
  }
  return null;
}

/**
 * 获取消息的格式化版本内容（加强模式生成的 swipe）
 * @param {string|number} mesId 消息 ID
 * @returns {string|null} 格式化后的消息内容
 */
export function getFormattedSwipeContent(mesId) {
  try {
    // getChatMessages 是 SillyTavern 宿主函数，在 IIFE 闭包中可直接访问
    const messages = getChatMessages(parseInt(mesId, 10), { include_swipes: true });
    if (!messages || !messages[0]) return null;

    const msg = messages[0];
    const swipes = msg.swipes || [msg.message];

    for (let i = 0; i < swipes.length; i++) {
      let swipeContent = swipes[i];
      if (swipeContent && /<(p|sprite|maintext|background)[^>]*>/i.test(swipeContent)) {
        console.log(`[${SCRIPT_NAME}] 找到格式化 swipe[${i}] 用于消息 ${mesId}`);
        swipeContent = swipeContent.replace(RE_THINK_CLOSED, '');
        swipeContent = swipeContent.replace(RE_THINK_UNCLOSED, '');
        return swipeContent;
      }
    }
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 获取格式化 swipe 失败:`, e);
  }
  return null;
}
