import { SCRIPT_ID, SCRIPT_NAME } from '../core/constants.js';
import { topWindow } from '../core/env.js';

// ============================================
// 样式注入
// ============================================
const STYLES_INJECTED_FLAG = `${SCRIPT_ID}_styles_injected`;

export function injectStyles() {
  const targetDoc = topWindow.document;
  // 强制移除旧样式，确保热重载生效
  const oldStyle = targetDoc.getElementById(`${SCRIPT_ID}-styles`);
  if (oldStyle) {
    oldStyle.remove();
  }
  topWindow[STYLES_INJECTED_FLAG] = true;
  // 注入字体
  if (!targetDoc.querySelector('link[href*="Noto+Sans+SC"]')) {
    const fontLink = targetDoc.createElement('link');
    fontLink.href =
      'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&family=Barlow:ital,wght@0,400;0,800;1,600&display=swap';
    fontLink.rel = 'stylesheet';
    (targetDoc.head || targetDoc.documentElement).appendChild(fontLink);
  }
  const css = `__CSS_PLACEHOLDER__`;
  const styleEl = targetDoc.createElement('style');
  styleEl.id = `${SCRIPT_ID}-styles`;
  styleEl.textContent = css;
  (targetDoc.head || targetDoc.documentElement).appendChild(styleEl);
  console.log(`[${SCRIPT_NAME}] 样式已注入`);
}
