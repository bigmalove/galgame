import { HTML_SKIN_ACTIVE_CLASS } from '../core/constants.js';
import { topWindow } from '../core/env.js';

// ============================================
// HTML 皮肤：模板解析、CSS 消毒与作用域限定
// ============================================

const SKIN_STYLE_ID = 'gal-skin-style';
const MAX_SKIN_CSS_LENGTH = 512 * 1024; // 512KB
const OVERLAY_SCOPE = '#gal-global-overlay';
const CHOICES_SCOPE = '#gal-layer-choices';
const SCOPE_PREFIX = `${OVERLAY_SCOPE}.${HTML_SKIN_ACTIVE_CLASS}`;

/**
 * 从玩家生成的 HTML 模板文件中提取皮肤 CSS 与元数据。
 * @param {string} htmlText 完整 HTML 文本
 * @returns {{ name: string, author: string, version: string, rawCss: string }}
 */
export function parseHtmlSkinFile(htmlText) {
  const text = String(htmlText || '');
  if (!text.trim()) {
    throw new Error('文件内容为空');
  }
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const styleNode = doc.querySelector(`style#${SKIN_STYLE_ID}`);
  if (!styleNode) {
    throw new Error('未找到 <style id="gal-skin-style"> 皮肤样式块，请确认文件由官方模板生成');
  }
  const rawCss = String(styleNode.textContent || '').trim();
  if (!rawCss) {
    throw new Error('皮肤样式块内容为空');
  }
  if (rawCss.length > MAX_SKIN_CSS_LENGTH) {
    throw new Error('皮肤样式内容过大（超过 512KB），请精简后重试');
  }
  return {
    name: String(styleNode.dataset.skinName || '').trim(),
    author: String(styleNode.dataset.skinAuthor || '').trim(),
    version: String(styleNode.dataset.skinVersion || '').trim(),
    rawCss,
  };
}

/**
 * 剥离危险内容：@import、危险 url()、expression/behavior，
 * 并把 position: fixed 降级为 absolute（防止逃逸游戏容器）。
 */
export function sanitizeSkinCss(rawCss) {
  let css = String(rawCss || '');
  // 剥离 @import（含未加分号的容错）
  css = css.replace(/@import\b[^;]*;?/gi, '');
  // 剥离 IE 时代危险声明
  css = css.replace(/expression\s*\(/gi, 'void(');
  css = css.replace(/-moz-binding\s*:[^;}]*(;|(?=\}))/gi, '');
  css = css.replace(/\bbehavior\s*:[^;}]*(;|(?=\}))/gi, '');
  // url() 白名单：仅允许 https: 与 data:image/
  css = css.replace(/url\s*\(\s*(['"]?)([^)'"]*)\1\s*\)/gi, (match, _quote, target) => {
    const value = String(target || '').trim();
    if (!value) return 'none';
    if (/^(https:\/\/|data:image\/|#)/i.test(value)) return match;
    return 'none';
  });
  // position: fixed 降级为 absolute
  css = css.replace(/(position\s*:\s*)fixed\b/gi, '$1absolute');
  return css;
}

function splitSelectorList(selectorText) {
  const selectors = [];
  let depth = 0;
  let current = '';
  for (const char of String(selectorText || '')) {
    if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      selectors.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) selectors.push(current.trim());
  return selectors.filter(Boolean);
}

function scopeSelector(selector) {
  const text = String(selector || '').trim();
  if (!text) return '';
  // 已经限定在界面作用域内的选择器直接放行
  if (text.startsWith(OVERLAY_SCOPE) || text.startsWith(CHOICES_SCOPE)) return text;
  // 根级选择器改写到 overlay 上（变量定义等）
  if (/^(:root|html|body)\b/i.test(text)) {
    const rest = text.replace(/^(:root|html|body)\b/i, '').trim();
    return rest ? `${SCOPE_PREFIX} ${rest}` : SCOPE_PREFIX;
  }
  return `${SCOPE_PREFIX} ${text}`;
}

function collectKeyframesNames(rules, names = new Set()) {
  for (const rule of rules) {
    if (rule.constructor?.name === 'CSSKeyframesRule') {
      if (rule.name) names.add(rule.name);
    } else if (rule.cssRules) {
      collectKeyframesNames(Array.from(rule.cssRules), names);
    }
  }
  return names;
}

function scopeRules(rules, keyframesRenameMap) {
  const output = [];
  for (const rule of rules) {
    const typeName = rule.constructor?.name || '';
    if (typeName === 'CSSStyleRule') {
      const scoped = splitSelectorList(rule.selectorText).map(scopeSelector).filter(Boolean);
      if (!scoped.length) continue;
      const body = rule.cssText.slice(rule.cssText.indexOf('{'));
      output.push(`${scoped.join(', ')} ${body}`);
    } else if (typeName === 'CSSMediaRule') {
      const inner = scopeRules(Array.from(rule.cssRules), keyframesRenameMap);
      if (inner) output.push(`@media ${rule.media.mediaText} {\n${inner}\n}`);
    } else if (typeName === 'CSSSupportsRule') {
      const inner = scopeRules(Array.from(rule.cssRules), keyframesRenameMap);
      if (inner) output.push(`@supports ${rule.conditionText} {\n${inner}\n}`);
    } else if (typeName === 'CSSKeyframesRule') {
      const nextName = keyframesRenameMap.get(rule.name) || rule.name;
      const body = rule.cssText.slice(rule.cssText.indexOf('{'));
      output.push(`@keyframes ${nextName} ${body}`);
    } else if (typeName === 'CSSFontFaceRule') {
      output.push(rule.cssText);
    }
    // 其余规则类型（@page 等）丢弃
  }
  return output.join('\n');
}

function renameAnimationReferences(cssText, keyframesRenameMap) {
  let result = cssText;
  for (const [oldName, newName] of keyframesRenameMap) {
    const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\b${escaped}\\b`, 'g'), newName);
  }
  return result;
}

function buildSkinHash(cssText) {
  let hash = 5381;
  const text = String(cssText || '');
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

/**
 * 用 CSSOM 把皮肤 CSS 限定在游戏界面作用域下：
 * - 普通规则选择器加 `#gal-global-overlay.html-skin ` 前缀（已限定的放行）
 * - @media/@supports 递归处理内部规则
 * - @keyframes 重命名加皮肤散列后缀，防全局撞名
 * 顺带借浏览器 parser 剔除非法语法。
 */
function parseCssRules(cssText) {
  // 优先用离屏文档解析
  const doc = topWindow.document.implementation.createHTMLDocument('');
  const style = doc.createElement('style');
  style.textContent = String(cssText || '');
  doc.head.appendChild(style);
  if (style.sheet) {
    return { rules: Array.from(style.sheet.cssRules), cleanup: null };
  }
  // 兜底：部分环境离屏文档不解析样式表，注入真实文档但用 media="not all" 避免生效
  const liveStyle = topWindow.document.createElement('style');
  liveStyle.setAttribute('media', 'not all');
  liveStyle.textContent = String(cssText || '');
  topWindow.document.head.appendChild(liveStyle);
  if (!liveStyle.sheet) {
    liveStyle.remove();
    return { rules: [], cleanup: null };
  }
  return { rules: Array.from(liveStyle.sheet.cssRules), cleanup: () => liveStyle.remove() };
}

export function scopeSkinCss(cssText) {
  const { rules, cleanup } = parseCssRules(cssText);
  try {
    if (!rules.length) return '';
    const skinHash = buildSkinHash(cssText);
    const keyframesRenameMap = new Map(
      Array.from(collectKeyframesNames(rules)).map(name => [name, `${name}__${skinHash}`]),
    );
    const scoped = scopeRules(rules, keyframesRenameMap);
    return keyframesRenameMap.size ? renameAnimationReferences(scoped, keyframesRenameMap) : scoped;
  } finally {
    if (cleanup) cleanup();
  }
}

/**
 * 消毒 + 作用域限定（导入时调用一次，结果存库）。
 */
export function buildScopedSkinCss(rawCss) {
  return scopeSkinCss(sanitizeSkinCss(rawCss));
}
