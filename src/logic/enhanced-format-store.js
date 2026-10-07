import { SCRIPT_NAME } from '../core/constants.js';
import { getTavernContext } from '../core/env.js';

// ============================================
// 加强模式格式化文本存储
// ============================================
// 格式化结果不写入酒馆正文 / swipe，而是挂在消息的 extra 上（酒馆切换 swipe 时会随 swipe_info 同步），
// 关闭 Galgame 前端后聊天界面仍是原文。
//
// 不用楼层变量（data）存放：MVU 等变量框架会把上一楼的变量整体复制到新楼层、并在额外模型解析完成后
// 整体覆盖当前楼层变量，格式化结果会被冲掉；也不经 setChatMessages 写 extra：它会重置该楼层全部 swipe_info。
//
// 记录携带原文指纹：消息被编辑 / 续写，或开新 swipe 时酒馆把上一页的 extra 原样带过来，指纹不匹配即视为失效。

const EXTRA_KEY = 'galgame_enhanced_format';
// v2：指纹忽略 st-chatu8（智绘姬）写入正文的生图块与空白差异；v1 记录仍按旧指纹校验
const RECORD_VERSION = 2;

// st-chatu8 开启「插入原文」时会在出图后改写 mes：删掉全部 image###提示词### 与旧 <image> 块，
// 再在匹配位置插入 "\n\n<image>…</image>"（且不触发 MESSAGE_EDITED）。这些都不算正文变化。
const RE_CHATU8_IMAGE_BLOCK = /<image>[\s\S]*?<\/image>/gi;
const RE_CHATU8_PROMPT_MARKER = /image[ \t]*###[\s\S]*?###/gi;

// 第二次生成流式输出期间的草稿（只存在内存，不落盘）
let streamingDraft = null;

/**
 * 剥离 st-chatu8 写入正文的生图块 / 提示词标记（第二次生成的输入与原文指纹都用剥离后的文本）
 */
export function stripChatu8ImageMarkup(text) {
  return String(text ?? '')
    .replace(RE_CHATU8_IMAGE_BLOCK, '')
    .replace(RE_CHATU8_PROMPT_MARKER, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function fnv1a(source) {
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${source.length}_${(hash >>> 0).toString(36)}`;
}

export function hashSourceText(text) {
  // 空白统一折叠：st-chatu8 插图 / 删标记会增减换行，不应使格式化结果失效
  return fnv1a(stripChatu8ImageMarkup(text).replace(/\s+/g, ' '));
}

// v1 记录的指纹算法（仅统一换行 + trim），用于兼容升级前保存的格式化结果
function hashSourceTextV1(text) {
  return fnv1a(String(text ?? '').replace(/\r\n?/g, '\n').trim());
}

function matchesSourceText(record, text) {
  if (record.sourceHash === hashSourceText(text)) return true;
  return !(record.version >= 2) && record.sourceHash === hashSourceTextV1(text);
}

function getRawChatMessage(ctx, mesId) {
  const index = Number.parseInt(String(mesId), 10);
  const chat = ctx?.chat;
  if (!Array.isArray(chat) || !Number.isInteger(index) || index < 0) return null;
  return chat[index] || null;
}

function getCurrentSwipeId(message) {
  return Number.isInteger(message?.swipe_id) ? message.swipe_id : 0;
}

function getSwipeText(message, swipeId) {
  if (!message) return '';
  if (swipeId === getCurrentSwipeId(message)) return String(message.mes ?? '');
  return String(message.swipes?.[swipeId] ?? '');
}

function isValidRecord(record, sourceText) {
  return !!record
    && typeof record === 'object'
    && typeof record.formatted === 'string'
    && record.formatted.length > 0
    && matchesSourceText(record, sourceText);
}

function collectRecordCandidates(message, swipeId) {
  const candidates = [];
  if (swipeId === getCurrentSwipeId(message)) {
    candidates.push(message.extra?.[EXTRA_KEY]);
    // 酒馆助手 setChatMessages 切换 swipe 时会把整个 swipe_info 项塞进 extra，记录随之下沉一层
    candidates.push(message.extra?.extra?.[EXTRA_KEY]);
  }
  candidates.push(message.swipe_info?.[swipeId]?.extra?.[EXTRA_KEY]);
  return candidates;
}

/**
 * 读取某楼层当前 swipe 的原文快照（加强模式第二次生成的输入，已剥离智绘姬生图标记）
 * @returns {{ mesId: number, swipeId: number, chatId: string, text: string, sourceHash: string, role: 'user' | 'system' | 'assistant' } | null}
 */
export function getMessageSourceSnapshot(mesId) {
  const ctx = getTavernContext();
  const message = getRawChatMessage(ctx, mesId);
  if (!message) return null;
  const swipeId = getCurrentSwipeId(message);
  const text = stripChatu8ImageMarkup(getSwipeText(message, swipeId));
  return {
    mesId: Number.parseInt(String(mesId), 10),
    swipeId,
    chatId: typeof ctx?.getCurrentChatId === 'function' ? String(ctx.getCurrentChatId() || '') : '',
    text,
    sourceHash: hashSourceText(text),
    role: message.is_user ? 'user' : message.extra?.type === 'narrator' ? 'system' : 'assistant',
  };
}

/**
 * 获取当前 swipe 仍然有效的格式化记录
 */
export function getEnhancedFormatRecord(mesId) {
  const message = getRawChatMessage(getTavernContext(), mesId);
  if (!message || message.is_user) return null;
  const swipeId = getCurrentSwipeId(message);
  const sourceText = getSwipeText(message, swipeId);
  return collectRecordCandidates(message, swipeId).find(record => isValidRecord(record, sourceText)) || null;
}

/**
 * 当前 swipe 是否有过格式化记录但原文已变（被编辑 / 续写）
 */
export function hasStaleEnhancedFormatRecord(mesId) {
  const message = getRawChatMessage(getTavernContext(), mesId);
  if (!message || message.is_user) return false;
  const swipeId = getCurrentSwipeId(message);
  const sourceText = getSwipeText(message, swipeId);
  const candidates = collectRecordCandidates(message, swipeId).filter(record => record && typeof record === 'object');
  return candidates.length > 0 && !candidates.some(record => isValidRecord(record, sourceText));
}

/**
 * 获取 Galgame 前端应显示的格式化文本：流式草稿优先，其次为已保存的有效记录
 */
export function getEnhancedFormattedText(mesId) {
  const draftText = getStreamingDraftText(mesId);
  if (draftText) return draftText;
  return getEnhancedFormatRecord(mesId)?.formatted || null;
}

/**
 * 保存格式化结果到消息 extra（仅当原文未变化、聊天未切换时）
 * @param {ReturnType<typeof getMessageSourceSnapshot>} snapshot 第二次生成开始时的原文快照
 * @param {string} formatted 格式化文本
 * @param {object} [meta] 附加信息（如使用的连接配置 / 模型）
 * @returns {Promise<boolean>} 是否已保存
 */
export async function saveEnhancedFormatRecord(snapshot, formatted, meta = {}) {
  const ctx = getTavernContext();
  if (!ctx || !snapshot) return false;

  const currentChatId = typeof ctx.getCurrentChatId === 'function' ? String(ctx.getCurrentChatId() || '') : '';
  if (snapshot.chatId && currentChatId !== snapshot.chatId) {
    console.warn(`[${SCRIPT_NAME}] 加强模式: 聊天已切换，丢弃楼层 ${snapshot.mesId} 的格式化结果`);
    return false;
  }

  const message = getRawChatMessage(ctx, snapshot.mesId);
  if (!message) return false;
  if (hashSourceText(getSwipeText(message, snapshot.swipeId)) !== snapshot.sourceHash) {
    console.warn(`[${SCRIPT_NAME}] 加强模式: 楼层 ${snapshot.mesId} swipe[${snapshot.swipeId}] 原文已变化，丢弃格式化结果`);
    return false;
  }

  const record = {
    version: RECORD_VERSION,
    sourceHash: snapshot.sourceHash,
    formatted: String(formatted || ''),
    generatedAt: Date.now(),
    ...meta,
  };

  if (snapshot.swipeId === getCurrentSwipeId(message)) {
    if (!message.extra || typeof message.extra !== 'object') message.extra = {};
    message.extra[EXTRA_KEY] = record;
  }
  // 同步写入 swipe_info，切走再切回该 swipe 时酒馆会从这里恢复 extra
  const swipeInfo = Array.isArray(message.swipe_info) ? message.swipe_info[snapshot.swipeId] : null;
  if (swipeInfo && typeof swipeInfo === 'object') {
    if (!swipeInfo.extra || typeof swipeInfo.extra !== 'object') swipeInfo.extra = {};
    swipeInfo.extra[EXTRA_KEY] = { ...record };
  }

  if (typeof ctx.saveChat === 'function') {
    await ctx.saveChat();
  }
  return true;
}

// ============================================
// 流式草稿
// ============================================
export function setStreamingDraft(snapshot, text) {
  if (!snapshot) return;
  streamingDraft = {
    chatId: snapshot.chatId,
    mesId: String(snapshot.mesId),
    swipeId: snapshot.swipeId,
    text: String(text || ''),
  };
}

export function clearStreamingDraft(mesId) {
  if (!streamingDraft) return;
  if (mesId === undefined || streamingDraft.mesId === String(mesId)) {
    streamingDraft = null;
  }
}

function getStreamingDraftText(mesId) {
  if (!streamingDraft || streamingDraft.mesId !== String(mesId) || !streamingDraft.text) return null;
  const ctx = getTavernContext();
  if (streamingDraft.chatId && typeof ctx?.getCurrentChatId === 'function' && String(ctx.getCurrentChatId() || '') !== streamingDraft.chatId) {
    return null;
  }
  const message = getRawChatMessage(ctx, mesId);
  if (!message || getCurrentSwipeId(message) !== streamingDraft.swipeId) return null;
  return streamingDraft.text;
}
