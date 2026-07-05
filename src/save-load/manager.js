import { BGMManager } from '../audio/bgm-manager.js';
import { TTSManager } from '../audio/tts-manager.js';
import { SCRIPT_NAME } from '../core/constants.js';
import { $, topWindow } from '../core/env.js';
import { getIsLoadingSave, getPendingOptions, setIsLoadingSave } from '../core/state.js';
import { GalgameStore } from '../core/store.js';
import { clearAllPixiEffects } from '../effects/pixi-effect-manager.js';
import { resetEnhancedModeState } from '../logic/enhanced-mode.js';
import { parseGalgameContent, stripImagePlaceholders } from '../logic/parser.js';
import { clearSpecialCgOverlayAndQueue } from '../logic/special-cg-trigger.js';
import { SpriteManager } from '../sprite/sprite-manager.js';
import { detectAndCaptureCg, updateGlobalOverlayContent } from '../ui/overlay-content.js';
import { setCurrentDisplayMesId, showGlobalOverlay } from '../ui/overlay.js';
import { showToast } from '../ui/toast.js';
import { decodeHtml, getFormattedSwipeContent, getRawMessageContent } from '../utils/html.js';
import { captureSaveThumbnail } from './thumbnail.js';

const SAVE_SLOTS_KEY = 'gal_save_slots_v1';
const QUICK_SAVE_KEY = 'gal_quick_save_v1';
const CHAT_LAST_SAVE_KEY = 'gal_last_save_id_v1';
const CURRENT_CHAT_SENTINEL = '__current_chat__';

const MAX_SAVE_SLOTS = 20;
const MAX_SAVE_PAYLOAD_BYTES = 1200 * 1024;

const BRANCH_STRATEGY_BRANCH_CREATE = 'branch-create';
const BRANCH_STRATEGY_CHECKPOINT = 'checkpoint';
const BRANCH_STRATEGY_CHAT_FORK = 'chat-fork';

let chatForkCapability = null; // null=未知 true=支持 false=不支持
let chatForkStrategy = ''; // 已探测到可用的分支命令策略

function logSaveLoad(step, payload = null) {
  const prefix = `[${SCRIPT_NAME}][SaveLoad] ${step}`;
  try {
    if (payload === null || payload === undefined) {
      console.log(prefix);
      return;
    }
    console.log(prefix, payload);
  } catch (error) {
    console.log(prefix);
  }
}

function getSillyTavernApiCandidates() {
  const roots = [topWindow, window, globalThis];
  const seen = new Set();
  const apis = [];
  for (const root of roots) {
    const api = root?.SillyTavern;
    if (!api || typeof api !== 'object') continue;
    if (seen.has(api)) continue;
    seen.add(api);
    apis.push(api);
  }
  return apis;
}

function resolveOpenCharacterChatFunction() {
  const apis = getSillyTavernApiCandidates();
  for (const api of apis) {
    if (typeof api?.openCharacterChat === 'function') {
      return { fn: api.openCharacterChat.bind(api), source: 'SillyTavern.openCharacterChat' };
    }
    try {
      const ctx = typeof api?.getContext === 'function' ? api.getContext.call(api) : null;
      if (ctx && typeof ctx.openCharacterChat === 'function') {
        return { fn: ctx.openCharacterChat.bind(ctx), source: 'SillyTavern.getContext().openCharacterChat' };
      }
    } catch (error) {}
  }

  const roots = [topWindow, window, globalThis];
  for (const root of roots) {
    if (typeof root?.openCharacterChat === 'function') {
      return { fn: root.openCharacterChat.bind(root), source: 'global.openCharacterChat' };
    }
  }

  return { fn: null, source: '' };
}

function safeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatTimestamp(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function buildDefaultLabel(messageId) {
  const floor = Math.max(1, safeNumber(messageId, 0) + 1);
  return `${formatTimestamp(Date.now())} 楼层${floor}`;
}

export function normalizeChatId(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const lower = text.toLowerCase();
  if (lower === 'null' || lower === 'undefined' || lower === '[object object]') return '';
  if (text.includes('{{') || text.includes('}}')) return '';
  return text;
}

function stripChatFileSuffixes(value) {
  return String(value || '').replace(/(?:\.jsonl?)+$/i, '').trim();
}

function extractChatBasename(value) {
  const normalized = normalizeChatId(value);
  if (!normalized) return '';

  let text = normalized.replace(/^['"]+|['"]+$/g, '');
  try {
    text = decodeURIComponent(text);
  } catch (error) {}
  text = text.replace(/\\/g, '/');
  return text.split('/').filter(Boolean).pop() || text;
}

function canonicalizeChatId(value) {
  const basename = extractChatBasename(value);
  if (!basename) return '';
  return stripChatFileSuffixes(basename).toLowerCase();
}

export function isSameChatId(a, b) {
  const normalizedA = normalizeChatId(a);
  const normalizedB = normalizeChatId(b);
  if (!normalizedA || !normalizedB) return false;
  if (normalizedA === normalizedB) return true;
  const canonicalA = canonicalizeChatId(normalizedA);
  const canonicalB = canonicalizeChatId(normalizedB);
  return !!canonicalA && !!canonicalB && canonicalA === canonicalB;
}

function buildChatIdCandidates(chatId) {
  const raw = normalizeChatId(chatId);
  if (!raw) return [];

  const basename = extractChatBasename(raw);
  const rawWithoutExt = stripChatFileSuffixes(raw);
  const basenameWithoutExt = stripChatFileSuffixes(basename);

  return Array.from(new Set([basenameWithoutExt, rawWithoutExt, raw, basename]))
    .map(value => stripChatFileSuffixes(normalizeChatId(value)))
    .filter(Boolean);
}

function tryGetContext() {
  const apis = getSillyTavernApiCandidates();
  for (const api of apis) {
    try {
      const getter = api?.getContext;
      if (typeof getter !== 'function') continue;
      const context = getter.call(api);
      if (context && typeof context === 'object') return context;
    } catch (error) {}
  }
  return null;
}

export function getCurrentChatId() {
  try {
    const context = tryGetContext();
    const apis = getSillyTavernApiCandidates();
    const candidates = [];
    for (const api of apis) {
      const metadata = api?.chatMetadata || {};
      candidates.push(api?.getCurrentChatId?.());
      candidates.push(api?.chatId);
      candidates.push(metadata?.chatId);
      candidates.push(metadata?.chat_id);
      candidates.push(metadata?.file_name);
      candidates.push(metadata?.chat_file);
    }
    candidates.push(context?.chatId);
    candidates.push(context?.chat_id);
    candidates.push(topWindow?.chatId);
    candidates.push(topWindow?.chat_id);

    if (typeof substitudeMacros === 'function') {
      candidates.push(substitudeMacros('{{chatId}}'));
      candidates.push(substitudeMacros('{{chat_id}}'));
      candidates.push(substitudeMacros('{{chat}}'));
    }

    for (const candidate of candidates) {
      const normalized = normalizeChatId(candidate);
      if (normalized) return normalized;
    }
    return '';
  } catch (error) {
    return '';
  }
}

function normalizeCharacterCardInfo(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id ?? raw.characterId ?? '').trim();
  const name = String(raw.name ?? raw.characterName ?? '').trim();
  if (!id && !name) return null;
  return { id, name };
}

function resolveCurrentCharacterCardInfo() {
  const ids = [];
  const names = [];
  const appendUnique = (list, value) => {
    const text = String(value ?? '').trim();
    if (!text) return;
    if (!list.includes(text)) list.push(text);
  };

  const ctx = tryGetContext();
  appendUnique(ids, ctx?.characterId);
  if (ctx?.characters && ctx?.characterId != null) {
    const current = ctx.characters[ctx.characterId];
    appendUnique(names, current?.name);
    appendUnique(names, current?.data?.name);
  }
  appendUnique(names, ctx?.name2);

  const st = topWindow?.SillyTavern;
  appendUnique(ids, st?.characterId);
  if (st?.characters && st?.characterId != null) {
    const current = st.characters[st.characterId];
    appendUnique(names, current?.name);
    appendUnique(names, current?.data?.name);
  }
  appendUnique(names, st?.name2);

  return normalizeCharacterCardInfo({
    id: ids[0] || '',
    name: names[0] || '',
  });
}

function getOverlayMessageId() {
  const raw = $('#gal-global-overlay .gal-game-container').attr('data-mes-id');
  if (raw === undefined || raw === null || raw === '') return null;
  const numeric = Number.parseInt(String(raw), 10);
  return Number.isFinite(numeric) ? numeric : null;
}

export function safeGetLastMessageId() {
  try {
    const messageId = getLastMessageId();
    return Number.isFinite(messageId) ? messageId : -1;
  } catch (error) {
    return -1;
  }
}

function buildMessageText(messageId) {
  let content = getFormattedSwipeContent(messageId);
  if (!content) {
    content = getRawMessageContent(messageId);
  }
  if (!content) {
    try {
      const messages = getChatMessages(messageId);
      const message = Array.isArray(messages) ? messages[0] : null;
      if (message && typeof message.message === 'string') {
        content = message.message;
      }
    } catch (error) {}
  }
  if (!content) {
    const mesNode = topWindow.document.querySelector(`.mes[mesid="${messageId}"] .mes_text`);
    if (mesNode) {
      content = decodeHtml(mesNode.innerHTML || '');
    }
  }
  return String(content || '');
}

function hashText(text) {
  let hash = 2166136261;
  const value = String(text || '');
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `h${(hash >>> 0).toString(16)}`;
}

function isTargetSlotLikelyInCurrentChat(slot) {
  if (!slot || typeof slot !== 'object') return false;
  const targetMessageId = Math.max(0, Math.floor(safeNumber(slot.messageId, 0)));
  const latestMessageId = safeGetLastMessageId();
  if (latestMessageId < targetMessageId) return false;

  const expectedHash = String(slot.messageHash || '').trim();
  if (expectedHash) {
    const currentHash = hashText(buildMessageText(targetMessageId));
    return !!currentHash && currentHash === expectedHash;
  }

  const expectedFloorCount = Math.max(1, Math.floor(safeNumber(slot.totalFloorCount, targetMessageId + 1)));
  return latestMessageId + 1 >= expectedFloorCount;
}

function normalizeSaveSlot(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim();
  const chatId = String(raw.chatId || '').trim();
  if (!id || !chatId) return null;

  const messageId = safeNumber(raw.messageId, 0);
  const segmentIndex = safeNumber(raw.segmentIndex, 0);
  return {
    id,
    label: String(raw.label || '').trim() || buildDefaultLabel(messageId),
    timestamp: safeNumber(raw.timestamp, Date.now()),
    chatId,
    messageId: Math.max(0, Math.floor(messageId)),
    segmentIndex: Math.max(0, Math.floor(segmentIndex)),
    messageHash: String(raw.messageHash || '').trim(),
    totalFloorCount: Math.max(1, Math.floor(safeNumber(raw.totalFloorCount, messageId + 1))),
    thumbnailDataUrl: typeof raw.thumbnailDataUrl === 'string' ? raw.thumbnailDataUrl : null,
    characterCard: normalizeCharacterCardInfo(
      raw.characterCard || {
        characterId: raw.characterId,
        characterName: raw.characterName,
      },
    ),
    gameState: {
      pendingOptions: Array.isArray(raw?.gameState?.pendingOptions) ? raw.gameState.pendingOptions : [],
      currentBGM: raw?.gameState?.currentBGM || null,
      currentBackground: raw?.gameState?.currentBackground || null,
    },
  };
}

function estimateBytes(value) {
  try {
    return new Blob([value]).size;
  } catch (error) {
    return String(value || '').length * 2;
  }
}

function normalizeAndSortSlots(input) {
  const list = Array.isArray(input) ? input : [];
  return list
    .map(normalizeSaveSlot)
    .filter(Boolean)
    .sort((a, b) => b.timestamp - a.timestamp);
}

function readScriptSaveData() {
  let variables = {};
  try {
    const loaded = getVariables({ type: 'script' });
    if (loaded && typeof loaded === 'object') {
      variables = loaded;
    }
  } catch (error) {
    console.warn(`[${SCRIPT_NAME}] 读取脚本变量失败:`, error);
  }

  const slots = normalizeAndSortSlots(variables[SAVE_SLOTS_KEY]);
  const quickSave = normalizeSaveSlot(variables[QUICK_SAVE_KEY]);
  return { variables, slots, quickSave };
}

function applyStorageLimits(slots, quickSave) {
  let nextSlots = normalizeAndSortSlots(slots).slice(0, MAX_SAVE_SLOTS);
  let nextQuick = quickSave ? normalizeSaveSlot(quickSave) : null;

  const calcBytes = () =>
    estimateBytes(
      JSON.stringify({
        [SAVE_SLOTS_KEY]: nextSlots,
        [QUICK_SAVE_KEY]: nextQuick,
      }),
    );

  let payloadBytes = calcBytes();
  if (payloadBytes <= MAX_SAVE_PAYLOAD_BYTES) {
    return { slots: nextSlots, quickSave: nextQuick };
  }

  for (let i = nextSlots.length - 1; i >= 0 && payloadBytes > MAX_SAVE_PAYLOAD_BYTES; i -= 1) {
    if (!nextSlots[i].thumbnailDataUrl) continue;
    nextSlots[i] = { ...nextSlots[i], thumbnailDataUrl: null };
    payloadBytes = calcBytes();
  }

  if (nextQuick?.thumbnailDataUrl && payloadBytes > MAX_SAVE_PAYLOAD_BYTES) {
    nextQuick = { ...nextQuick, thumbnailDataUrl: null };
    payloadBytes = calcBytes();
  }

  while (nextSlots.length > 1 && payloadBytes > MAX_SAVE_PAYLOAD_BYTES) {
    nextSlots = nextSlots.slice(0, nextSlots.length - 1);
    payloadBytes = calcBytes();
  }

  return { slots: nextSlots, quickSave: nextQuick };
}

function writeScriptSaveData(slots, quickSave) {
  const { variables } = readScriptSaveData();
  const nextVariables = { ...variables };
  const limited = applyStorageLimits(slots, quickSave);
  nextVariables[SAVE_SLOTS_KEY] = limited.slots;
  nextVariables[QUICK_SAVE_KEY] = limited.quickSave || null;
  replaceVariables(nextVariables, { type: 'script' });
  return limited;
}

function writeLastSaveIdToChat(saveId) {
  try {
    const chatVariables = getVariables({ type: 'chat' }) || {};
    chatVariables[CHAT_LAST_SAVE_KEY] = String(saveId || '');
    replaceVariables(chatVariables, { type: 'chat' });
  } catch (error) {
    console.warn(`[${SCRIPT_NAME}] 写入聊天变量失败:`, error);
  }
}

function collectCurrentBackground(messageId) {
  const state = GalgameStore.cache.segments.get(String(messageId));
  return state?.parsedContent?.currentBackground?.scene || null;
}

function generateSaveId() {
  return `save_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function buildSaveSlot({ label = '', quick = false } = {}) {
  const lastMessageId = safeGetLastMessageId();
  if (lastMessageId < 0) {
    return { ok: false, reason: '当前聊天暂无可存档内容' };
  }

  const overlayMessageId = getOverlayMessageId();
  if (overlayMessageId !== null && overlayMessageId !== lastMessageId) {
    return { ok: false, reason: '请切到最新楼层后再存档' };
  }

  const chatId = (await resolveCurrentChatId()) || CURRENT_CHAT_SENTINEL;
  if (chatId === CURRENT_CHAT_SENTINEL) {
    console.warn(`[${SCRIPT_NAME}] 未解析到聊天 ID，存档将绑定当前聊天上下文`);
  }

  const state = GalgameStore.cache.segments.get(String(lastMessageId));
  const segmentIndex = Math.max(0, Math.floor(safeNumber(state?.currentIndex, 0)));
  const messageText = buildMessageText(lastMessageId);
  const thumbnailDataUrl = await captureSaveThumbnail();
  const normalizedLabel = String(label || '').trim();

  const slot = {
    id: generateSaveId(),
    label: normalizedLabel || buildDefaultLabel(lastMessageId),
    timestamp: Date.now(),
    chatId,
    messageId: lastMessageId,
    segmentIndex,
    messageHash: hashText(messageText),
    totalFloorCount: lastMessageId + 1,
    thumbnailDataUrl: thumbnailDataUrl || null,
    characterCard: resolveCurrentCharacterCardInfo(),
    gameState: {
      pendingOptions: Array.isArray(getPendingOptions()) ? getPendingOptions() : [],
      currentBGM: BGMManager.currentKeyword || null,
      currentBackground: collectCurrentBackground(lastMessageId),
    },
  };

  if (quick) {
    slot.label = normalizedLabel || `快速存档 ${formatTimestamp(slot.timestamp)}`;
  }

  return { ok: true, slot };
}

function stopBgmImmediately() {
  try {
    BGMManager.audio?.pause?.();
    if (BGMManager.audio) {
      BGMManager.audio.currentTime = 0;
    }
    BGMManager.isPlaying = false;
    BGMManager.pendingKeyword = null;
    BGMManager.currentTrack = null;
    if (typeof BGMManager.updateUI === 'function') {
      BGMManager.updateUI();
    }
  } catch (error) {
    console.warn(`[${SCRIPT_NAME}] 停止BGM失败:`, error);
  }
}

export async function waitFor(predicate, timeoutMs = 5000, intervalMs = 90) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (predicate()) return true;
    } catch (error) {}
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return false;
}

function buildRange(startInclusive, endExclusive) {
  const start = Math.floor(startInclusive);
  const end = Math.floor(endExclusive);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];

  const result = [];
  for (let i = start; i < end; i += 1) {
    result.push(i);
  }
  return result;
}

function isUnknownSlashText(text) {
  const normalized = String(text || '').toLowerCase();
  return (
    normalized.includes('unknown command') ||
    normalized.includes('command not found') ||
    normalized.includes('未知命令') ||
    normalized.includes('未找到命令')
  );
}

async function runSlashSafe(command) {
  try {
    const result = await triggerSlash(command);
    const resultText = String(result || '');
    if (isUnknownSlashText(resultText)) {
      return { ok: false, unknown: true, detail: resultText };
    }
    return { ok: true, detail: resultText };
  } catch (error) {
    const detail = String(error?.message || error || '');
    return { ok: false, unknown: isUnknownSlashText(detail), detail, error };
  }
}

export async function resolveCurrentChatId() {
  const direct = normalizeChatId(getCurrentChatId());
  if (direct) {
    logSaveLoad('resolveCurrentChatId.direct', { direct });
    return direct;
  }
  const viaSlash = await runSlashSafe('/getchatname');
  if (!viaSlash.ok) {
    logSaveLoad('resolveCurrentChatId.slash_failed', { detail: viaSlash.detail, unknown: !!viaSlash.unknown });
    return '';
  }
  const resolved = normalizeChatId(viaSlash.detail);
  logSaveLoad('resolveCurrentChatId.slash', { detail: viaSlash.detail, resolved });
  return resolved;
}

async function waitForTargetChatSwitched(targetChatId, targetSlot, timeoutMs = 8000) {
  return await waitFor(() => {
    const resolvedChatId = normalizeChatId(getCurrentChatId());
    if (resolvedChatId) {
      return isSameChatId(resolvedChatId, targetChatId);
    }
    return isTargetSlotLikelyInCurrentChat(targetSlot);
  }, timeoutMs, 120);
}

export async function switchToTargetChat(targetChatId, targetSlot) {
  const normalizedTarget = normalizeChatId(targetChatId);
  if (!normalizedTarget) return false;

  const candidates = buildChatIdCandidates(normalizedTarget);
  const openCharacterChatResolved = resolveOpenCharacterChatFunction();
  const openCharacterChat = openCharacterChatResolved.fn;
  logSaveLoad('switch.start', {
    targetChatId,
    normalizedTarget,
    candidates,
    openCharacterChatSource: openCharacterChatResolved.source || '(none)',
    slotId: targetSlot?.id || '',
    slotMessageId: targetSlot?.messageId,
  });
  if (typeof openCharacterChat !== 'function') {
    logSaveLoad('switch.openCharacterChat_unavailable');
    return false;
  }

  for (const candidate of candidates) {
    logSaveLoad('switch.try_openCharacterChat', { candidate });
    try {
      await openCharacterChat(candidate);
    } catch (error) {
      logSaveLoad('switch.openCharacterChat_throw', { candidate, message: String(error?.message || error || '') });
      console.warn(`[${SCRIPT_NAME}] openCharacterChat 切换失败(${candidate}):`, error);
    }
    const matched = await waitForTargetChatSwitched(normalizedTarget, targetSlot, 6000);
    const resolvedNow = normalizeChatId(getCurrentChatId());
    logSaveLoad('switch.openCharacterChat_result', { candidate, matched, resolvedNow });
    if (matched) {
      return true;
    }
  }
  logSaveLoad('switch.failed', { normalizedTarget, candidates });
  return false;
}

async function executeBranchStrategy(strategy, targetMessageId) {
  const messageId = Math.max(0, Math.floor(safeNumber(targetMessageId, 0)));
  if (strategy === BRANCH_STRATEGY_BRANCH_CREATE) {
    return await runSlashSafe(`/branch-create ${messageId}`);
  }
  if (strategy === BRANCH_STRATEGY_CHECKPOINT) {
    const checkpointName = `gal_save_${Date.now()}`;
    const created = await runSlashSafe(`/checkpoint-create mesId=${messageId} ${checkpointName}`);
    if (!created.ok) return created;
    return await runSlashSafe(`/checkpoint-go ${messageId}`);
  }
  if (strategy === BRANCH_STRATEGY_CHAT_FORK) {
    return await runSlashSafe('/chat-fork');
  }
  return { ok: false, unknown: false, detail: `Unknown strategy: ${strategy}` };
}

async function executeChatFork(targetMessageId) {
  if (chatForkCapability === false) return false;

  const strategyQueue = [];
  if (chatForkStrategy) {
    strategyQueue.push(chatForkStrategy);
  }
  strategyQueue.push(BRANCH_STRATEGY_BRANCH_CREATE, BRANCH_STRATEGY_CHECKPOINT, BRANCH_STRATEGY_CHAT_FORK);

  const tried = new Set();
  logSaveLoad('fork.strategy_queue', { targetMessageId, strategyQueue });
  for (const strategy of strategyQueue) {
    if (tried.has(strategy)) continue;
    tried.add(strategy);

    const result = await executeBranchStrategy(strategy, targetMessageId);
    logSaveLoad('fork.strategy_result', {
      strategy,
      ok: !!result.ok,
      unknown: !!result.unknown,
      detail: result.detail,
    });
    if (result.ok) {
      chatForkCapability = true;
      chatForkStrategy = strategy;
      logSaveLoad('fork.strategy_selected', { strategy });
      return true;
    }

    if (!result.unknown) {
      console.warn(`[${SCRIPT_NAME}] 分支命令策略 ${strategy} 执行失败:`, result.error || result.detail);
    }
  }

  chatForkCapability = false;
  chatForkStrategy = '';
  logSaveLoad('fork.no_available_strategy');
  return false;
}

function createFallbackParsed(text) {
  const cleanText = stripImagePlaceholders(String(text || '')).trim();
  return {
    segments: [{ type: 'narration', speaker: null, text: cleanText || '（当前消息无可显示内容）', expression: null }],
    currentBackground: null,
    bgm: null,
    options: [],
    backgroundChanges: [],
    effectEvents: [],
    hasEffects: false,
    locationStatusBarHtml: null,
    timeStatusBarHtml: null,
  };
}

function parseMessageForOverlay(messageId) {
  const mesId = String(messageId);
  const mesNode = topWindow.document.querySelector(`.mes[mesid="${mesId}"]`);
  let content = buildMessageText(mesId);
  let parsed = null;
  if (content) {
    try {
      parsed = parseGalgameContent(content, mesId);
      if (mesNode) {
        detectAndCaptureCg(mesId, mesNode, parsed);
      }
    } catch (error) {
      console.warn(`[${SCRIPT_NAME}] 读档解析失败，回退文本显示:`, error);
    }
  }

  if (!parsed || !Array.isArray(parsed.segments) || parsed.segments.length === 0) {
    const fallbackText = content || String(mesNode?.querySelector('.mes_text')?.textContent || '').trim();
    parsed = createFallbackParsed(fallbackText || '（当前消息无可显示内容）');
  }
  return { mesNode, parsed };
}

async function renderSaveSlot(slot) {
  const messageId = clamp(safeNumber(slot.messageId, 0), 0, Math.max(0, safeGetLastMessageId()));
  const segmentIndex = Math.max(0, Math.floor(safeNumber(slot.segmentIndex, 0)));
  const { parsed } = parseMessageForOverlay(messageId);

  const mesId = String(messageId);
  const state = GalgameStore.cache.segments.get(mesId) || {
    currentIndex: 0,
    segments: parsed.segments,
    parsedContent: parsed,
    renderToken: 0,
    lastAppliedEffectIndex: -1,
    effectSyncTicket: 0,
    effectSyncPromise: Promise.resolve(),
  };
  state.segments = parsed.segments;
  state.parsedContent = parsed;
  state.currentIndex = clamp(segmentIndex, 0, Math.max(0, parsed.segments.length - 1));
  GalgameStore.cache.segments.set(mesId, state);

  await updateGlobalOverlayContent(mesId, parsed, { suppressTTS: true });
  showGlobalOverlay();
}

export async function prepareLoadEnvironment() {
  resetEnhancedModeState();
  TTSManager.stop();
  stopBgmImmediately();
  clearAllPixiEffects();
  clearSpecialCgOverlayAndQueue();
  const $overlay = $('#gal-global-overlay');
  SpriteManager.reset($overlay.length ? $overlay : null);
}

function clearTimelineRelatedCaches() {
  if (GalgameStore.cache.timeline instanceof Map) {
    GalgameStore.cache.timeline.clear();
  }
  if (GalgameStore.cache.segments instanceof Map) {
    GalgameStore.cache.segments.clear();
  }
  if (GalgameStore.cache.parse instanceof Map) {
    GalgameStore.cache.parse.clear();
  }
  setCurrentDisplayMesId(null);
}

async function trimChatTailAfterMessage(targetMessageId, knownLastMessageId = NaN) {
  const numericTargetMessageId = Math.max(0, Math.floor(safeNumber(targetMessageId, 0)));
  const lastMessageId = Number.isFinite(knownLastMessageId)
    ? Math.max(-1, Math.floor(knownLastMessageId))
    : safeGetLastMessageId();

  if (lastMessageId <= numericTargetMessageId) {
    return { ok: true, trimmed: false, finalLastMessageId: lastMessageId };
  }

  const idsToDelete = buildRange(numericTargetMessageId + 1, lastMessageId + 1);
  if (idsToDelete.length > 0) {
    logSaveLoad('trimTail.delete_tail_messages', {
      idsCount: idsToDelete.length,
      from: idsToDelete[0],
      to: idsToDelete[idsToDelete.length - 1],
    });
    await deleteChatMessages(idsToDelete, { refresh: 'all' });
  }

  await waitFor(() => safeGetLastMessageId() <= numericTargetMessageId, 6000, 120);
  return {
    ok: true,
    trimmed: true,
    deletedCount: idsToDelete.length,
    finalLastMessageId: safeGetLastMessageId(),
  };
}

export async function forceForkAndTrimToMessage(targetMessageId, options = {}) {
  const numericTargetMessageId = Math.max(0, Math.floor(safeNumber(targetMessageId, 0)));
  const trimTail = options.trimTail !== false;
  const lastMessageId = safeGetLastMessageId();
  logSaveLoad('forceFork.start', { targetMessageId: numericTargetMessageId, lastMessageId, trimTail });

  if (lastMessageId < 0) {
    return { ok: false, reason: '当前聊天暂无可分支楼层' };
  }
  if (numericTargetMessageId > lastMessageId) {
    return { ok: false, reason: '目标楼层超出当前聊天范围' };
  }

  const forked = await executeChatFork(numericTargetMessageId);
  if (!forked) {
    return { ok: false, reason: '当前环境不支持回溯分支命令（/branch-create 或 /checkpoint-go）' };
  }

  await waitFor(() => safeGetLastMessageId() >= numericTargetMessageId, 6000, 120);
  const afterForkLast = safeGetLastMessageId();
  logSaveLoad('forceFork.afterFork', { afterForkLast, targetMessageId: numericTargetMessageId });

  const trimResult = trimTail
    ? await trimChatTailAfterMessage(numericTargetMessageId, afterForkLast)
    : { ok: true, trimmed: false, finalLastMessageId: afterForkLast };
  if (!trimResult.ok) {
    return trimResult;
  }

  clearTimelineRelatedCaches();
  logSaveLoad('forceFork.done', {
    targetMessageId: numericTargetMessageId,
    finalLastMessageId: trimResult.finalLastMessageId,
    trimmed: !!trimResult.trimmed,
  });

  return {
    ok: true,
    branchCreated: true,
    trimmed: !!trimResult.trimmed,
    finalLastMessageId: trimResult.finalLastMessageId,
  };
}

export async function forkAndTrimToMessage(targetMessageId) {
  const lastMessageId = safeGetLastMessageId();
  logSaveLoad('forkAndTrim.start', { targetMessageId, lastMessageId });
  if (targetMessageId >= lastMessageId) {
    logSaveLoad('forkAndTrim.skip', { reason: 'target>=last' });
    return { ok: true };
  }

  const result = await forceForkAndTrimToMessage(targetMessageId, { trimTail: true });
  if (!result.ok) {
    return result;
  }

  logSaveLoad('forkAndTrim.done', { finalLastMessageId: result.finalLastMessageId });
  return { ok: true };
}

export async function renderOverlayAtMessage(messageId, options = {}) {
  const numericMessageId = clamp(safeNumber(messageId, 0), 0, Math.max(0, safeGetLastMessageId()));
  const segmentIndex = Math.max(0, Math.floor(safeNumber(options.segmentIndex, 0)));
  const contentOverride = typeof options.contentOverride === 'string' ? options.contentOverride : '';
  const mesId = String(numericMessageId);
  const mesNode = topWindow.document.querySelector(`.mes[mesid="${mesId}"]`);

  let content = contentOverride || buildMessageText(mesId);
  let parsed = null;
  if (content) {
    try {
      parsed = parseGalgameContent(content, mesId);
      if (mesNode) {
        detectAndCaptureCg(mesId, mesNode, parsed);
      }
    } catch (error) {
      console.warn(`[${SCRIPT_NAME}] 时间线渲染解析失败，回退文本显示:`, error);
    }
  }

  if (!parsed || !Array.isArray(parsed.segments) || parsed.segments.length === 0) {
    const fallbackText = content || String(mesNode?.querySelector('.mes_text')?.textContent || '').trim();
    parsed = createFallbackParsed(fallbackText || '（当前消息无可显示内容）');
  }

  const state = GalgameStore.cache.segments.get(mesId) || {
    currentIndex: 0,
    segments: parsed.segments,
    parsedContent: parsed,
    renderToken: 0,
    lastAppliedEffectIndex: -1,
    effectSyncTicket: 0,
    effectSyncPromise: Promise.resolve(),
  };
  state.segments = parsed.segments;
  state.parsedContent = parsed;
  state.currentIndex = clamp(segmentIndex, 0, Math.max(0, parsed.segments.length - 1));
  GalgameStore.cache.segments.set(mesId, state);

  await updateGlobalOverlayContent(mesId, parsed, { suppressTTS: !!options.suppressTTS });
  showGlobalOverlay();
  return { ok: true, messageId: numericMessageId, parsed };
}

export function getSaveSlots() {
  const { slots } = readScriptSaveData();
  return slots;
}

export function getQuickSaveSlot() {
  const { quickSave } = readScriptSaveData();
  return quickSave;
}

export async function saveCurrentProgress(options = {}) {
  const quick = !!options.quick;
  const overwriteId = String(options.overwriteId || '').trim();
  const label = String(options.label || '').trim();

  const built = await buildSaveSlot({ label, quick });
  if (!built.ok) {
    showToast(built.reason || '存档失败');
    return built;
  }

  const { slots, quickSave } = readScriptSaveData();
  let nextSlots = [...slots];
  let nextQuickSave = quickSave;

  if (quick) {
    nextQuickSave = built.slot;
  } else if (overwriteId) {
    let replaced = false;
    nextSlots = nextSlots.map(slot => {
      if (slot.id !== overwriteId) return slot;
      replaced = true;
      return { ...built.slot, id: overwriteId };
    });
    if (!replaced) {
      nextSlots.unshift(built.slot);
    }
  } else {
    nextSlots.unshift(built.slot);
  }

  const stored = writeScriptSaveData(nextSlots, nextQuickSave);
  writeLastSaveIdToChat(built.slot.id);
  const finalSlot = quick
    ? normalizeSaveSlot(stored.quickSave)
    : normalizeAndSortSlots(stored.slots).find(slot => slot.id === built.slot.id) || built.slot;

  showToast(quick ? '快速存档成功' : '存档成功');
  return { ok: true, slot: finalSlot };
}

export function deleteSaveSlot(slotId) {
  const targetId = String(slotId || '').trim();
  if (!targetId) return { ok: false, reason: '存档 ID 无效' };

  const { slots, quickSave } = readScriptSaveData();
  const nextSlots = slots.filter(slot => slot.id !== targetId);
  if (nextSlots.length === slots.length) {
    return { ok: false, reason: '未找到指定存档' };
  }

  writeScriptSaveData(nextSlots, quickSave);
  return { ok: true };
}

export async function loadProgressById(slotId) {
  const targetId = String(slotId || '').trim();
  if (!targetId) {
    showToast('存档不存在');
    return { ok: false, reason: '存档不存在' };
  }

  const slot = getSaveSlots().find(item => item.id === targetId);
  if (!slot) {
    showToast('存档不存在');
    return { ok: false, reason: '存档不存在' };
  }

  return await loadSaveSlot(slot);
}

export async function quickSave() {
  return await saveCurrentProgress({ quick: true });
}

export async function quickLoad() {
  const slot = getQuickSaveSlot();
  if (!slot) {
    showToast('暂无快速存档');
    return { ok: false, reason: '暂无快速存档' };
  }
  return await loadSaveSlot(slot);
}

export async function loadSaveSlot(slot) {
  const targetSlot = normalizeSaveSlot(slot);
  if (!targetSlot) {
    showToast('存档数据损坏');
    return { ok: false, reason: '存档数据损坏' };
  }
  if (getIsLoadingSave()) {
    showToast('正在读档，请稍候');
    return { ok: false, reason: '读档进行中' };
  }

  setIsLoadingSave(true);
  try {
    logSaveLoad('load.start', {
      slotId: targetSlot.id,
      slotChatId: targetSlot.chatId,
      slotMessageId: targetSlot.messageId,
      slotTotalFloorCount: targetSlot.totalFloorCount,
      slotMessageHash: targetSlot.messageHash,
    });
    await prepareLoadEnvironment();

    const currentChatId = await resolveCurrentChatId();
    logSaveLoad('load.current_chat', { currentChatId });
    if (!targetSlot.chatId) {
      showToast('该存档缺少聊天信息');
      return { ok: false, reason: '该存档缺少聊天信息' };
    }

    const normalizedTargetChatId = normalizeChatId(targetSlot.chatId);
    const shouldSwitchChat =
      targetSlot.chatId !== CURRENT_CHAT_SENTINEL && !!normalizedTargetChatId && !isSameChatId(currentChatId, normalizedTargetChatId);
    logSaveLoad('load.switch_decision', {
      currentChatId,
      normalizedTargetChatId,
      shouldSwitchChat,
      isSentinel: targetSlot.chatId === CURRENT_CHAT_SENTINEL,
    });

    if (shouldSwitchChat) {
      const switched = await switchToTargetChat(normalizedTargetChatId, targetSlot);
      if (!switched) {
        logSaveLoad('load.switch_failed', { normalizedTargetChatId });
        showToast('切换聊天失败，无法读档');
        return { ok: false, reason: '切换聊天失败' };
      }

      const resolvedAfterSwitch = await resolveCurrentChatId();
      logSaveLoad('load.after_switch', { resolvedAfterSwitch, normalizedTargetChatId });
      if (
        resolvedAfterSwitch &&
        !isSameChatId(resolvedAfterSwitch, normalizedTargetChatId) &&
        !isTargetSlotLikelyInCurrentChat(targetSlot)
      ) {
        logSaveLoad('load.switch_verify_failed', {
          resolvedAfterSwitch,
          normalizedTargetChatId,
          targetLikelyInCurrentChat: isTargetSlotLikelyInCurrentChat(targetSlot),
        });
        showToast('切换聊天失败，无法读档');
        return { ok: false, reason: '切换聊天失败' };
      }
    }

    const latestMessageId = safeGetLastMessageId();
    logSaveLoad('load.latest_message', { latestMessageId });
    if (latestMessageId < 0) {
      showToast('目标聊天暂无楼层，无法读档');
      return { ok: false, reason: '目标聊天暂无楼层' };
    }

    if (targetSlot.messageId > latestMessageId) {
      showToast('目标聊天楼层不足，无法定位该存档');
      return { ok: false, reason: '目标聊天楼层不足' };
    }

    const targetMessageId = Math.max(0, Math.floor(targetSlot.messageId));
    logSaveLoad('load.target_message', { targetMessageId, latestMessageId });
    const branchResult = await forkAndTrimToMessage(targetMessageId);
    if (!branchResult.ok) {
      logSaveLoad('load.branch_failed', branchResult);
      showToast(branchResult.reason || '回溯分支失败');
      return branchResult;
    }

    await waitFor(() => safeGetLastMessageId() >= targetMessageId, 5000, 100);
    await waitFor(() => !!topWindow.document.querySelector(`.mes[mesid="${targetMessageId}"]`), 5000, 100);

    const currentHash = hashText(buildMessageText(targetMessageId));
    if (targetSlot.messageHash && currentHash && currentHash !== targetSlot.messageHash) {
      logSaveLoad('load.hash_mismatch', { expected: targetSlot.messageHash, currentHash, targetMessageId });
      showToast('存档楼层内容已变化，按当前内容恢复');
    }

    await renderSaveSlot(targetSlot);
    writeLastSaveIdToChat(targetSlot.id);
    logSaveLoad('load.done', { slotId: targetSlot.id, targetMessageId });
    showToast('读档完成');
    return { ok: true };
  } catch (error) {
    logSaveLoad('load.exception', { message: String(error?.message || error || ''), slotId: targetSlot?.id || '' });
    console.error(`[${SCRIPT_NAME}] 读档失败:`, error);
    showToast('读档失败，请稍后重试');
    return { ok: false, reason: error?.message || '读档失败' };
  } finally {
    setIsLoadingSave(false);
  }
}
