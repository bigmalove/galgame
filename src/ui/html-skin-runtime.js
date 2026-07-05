import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow } from '../core/env.js';
import { getCachedHtmlSkin } from '../db/html-skins.js';

// ============================================
// HTML 皮肤运行时：向顶层文档注入/清除皮肤样式
// ============================================

const HTML_SKIN_STYLE_ID = 'galgame-html-skin-style';

/**
 * 注入指定 HTML 皮肤的作用域 CSS（同步，数据来自内存缓存）。
 * @param {string} skinId 形如 'html-skin::xxx'
 * @returns {boolean} 是否成功注入
 */
export function applyHtmlSkinRuntime(skinId) {
  const doc = topWindow.document;
  const record = getCachedHtmlSkin(skinId);
  const oldStyle = doc.getElementById(HTML_SKIN_STYLE_ID);

  if (!record?.scopedCss) {
    if (oldStyle) oldStyle.remove();
    if (record) {
      console.warn(`[${SCRIPT_NAME}] HTML 皮肤 ${record.id} 的样式内容为空，请重新导入该皮肤`);
    }
    return false;
  }

  // 已经是当前皮肤则跳过重复注入
  if (oldStyle?.getAttribute('data-skin-id') === record.id) return true;

  if (oldStyle) oldStyle.remove();
  const style = doc.createElement('style');
  style.id = HTML_SKIN_STYLE_ID;
  style.setAttribute('data-skin-id', record.id);
  style.textContent = record.scopedCss;
  doc.head.appendChild(style);
  console.log(`[${SCRIPT_NAME}] 已应用 HTML 皮肤: ${record.name} (${record.id})`);
  return true;
}

/**
 * 移除已注入的 HTML 皮肤样式。
 */
export function clearHtmlSkinRuntime() {
  const style = topWindow.document.getElementById(HTML_SKIN_STYLE_ID);
  if (style) style.remove();
}
