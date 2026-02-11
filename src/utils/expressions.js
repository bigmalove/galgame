import { SCRIPT_NAME, EXPRESSION_LIST } from '../core/constants.js';
import { topWindow } from '../core/env.js';
import { GalgameStore } from '../core/store.js';

// ============================================
// 自定义表情管理
// ============================================

// 延迟引用: showToast, isEnabled, injectCOTToWorldbook
// 这些由 index.js 在启动时通过 setExpressionsRefs 注入
let _showToastRef = null;
let _getIsEnabledRef = null;
let _injectCOTRef = null;

export function setExpressionsRefs({ showToast, getIsEnabled, injectCOTToWorldbook }) {
  _showToastRef = showToast;
  _getIsEnabledRef = getIsEnabled;
  _injectCOTRef = injectCOTToWorldbook;
}

const CUSTOM_EXPRESSIONS_STORAGE_KEY = GalgameStore.STORAGE_KEYS.CUSTOM_EXPRESSIONS;

// 获取自定义表情列表（兼容旧格式，返回对象数组）
export function getCustomExpressions() {
  try {
    const saved = topWindow.localStorage.getItem(CUSTOM_EXPRESSIONS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // 兼容旧格式：字符串数组转对象数组
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
        return parsed.map(name => ({ name, emotion: null }));
      }
      return parsed;
    }
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 加载自定义表情失败:`, e);
  }
  return [];
}

// 保存自定义表情列表
export function saveCustomExpressions(expressions) {
  try {
    topWindow.localStorage.setItem(CUSTOM_EXPRESSIONS_STORAGE_KEY, JSON.stringify(expressions));
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 保存自定义表情失败:`, e);
  }
}

// 添加自定义表情（自动更新COT）
export async function addCustomExpression(name, emotion = null) {
  if (!name || typeof name !== 'string') return false;

  const trimmedName = name.trim();
  if (!trimmedName) return false;

  if (EXPRESSION_LIST.includes(trimmedName)) {
    if (_showToastRef) _showToastRef(`"${trimmedName}" 是预设表情，无需添加`);
    return false;
  }

  const customs = getCustomExpressions();

  if (customs.find(e => e.name === trimmedName)) {
    if (_showToastRef) _showToastRef(`"${trimmedName}" 已存在`);
    return false;
  }

  customs.push({ name: trimmedName, emotion: emotion || null });
  saveCustomExpressions(customs);

  if (_getIsEnabledRef && _getIsEnabledRef() && _injectCOTRef) {
    await _injectCOTRef();
  }

  if (_showToastRef) _showToastRef(`已添加表情: ${trimmedName}`);
  return true;
}

// 更新自定义表情的emotion（自动更新COT）
export async function updateCustomExpressionEmotion(name, emotion) {
  const customs = getCustomExpressions();
  const expr = customs.find(e => e.name === name);

  if (!expr) {
    if (_showToastRef) _showToastRef(`"${name}" 不存在`);
    return false;
  }

  expr.emotion = emotion || null;
  saveCustomExpressions(customs);

  if (_getIsEnabledRef && _getIsEnabledRef() && _injectCOTRef) {
    await _injectCOTRef();
  }

  if (_showToastRef) _showToastRef(`已更新表情「${name}」的TTS情绪`);
  return true;
}

// 删除自定义表情（自动更新COT）
export async function removeCustomExpression(name) {
  const customs = getCustomExpressions();
  const index = customs.findIndex(e => e.name === name);

  if (index === -1) {
    if (_showToastRef) _showToastRef(`"${name}" 不存在`);
    return false;
  }

  customs.splice(index, 1);
  saveCustomExpressions(customs);

  if (_getIsEnabledRef && _getIsEnabledRef() && _injectCOTRef) {
    await _injectCOTRef();
  }

  if (_showToastRef) _showToastRef(`已删除表情: ${name}`);
  return true;
}

// 获取完整表情列表（预设 + 自定义，返回名称数组）
export function getAllExpressions() {
  const customs = getCustomExpressions();
  return [...EXPRESSION_LIST, ...customs.map(e => e.name)];
}
