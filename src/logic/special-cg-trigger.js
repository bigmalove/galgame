import { SCRIPT_NAME } from '../core/constants.js';
import { $, topWindow } from '../core/env.js';
import { getSettings } from '../core/settings.js';
import { getIsEnabled } from '../core/state.js';
import { getSpecialCg } from '../db/special-cgs.js';
import { ensureGlobalOverlay } from '../ui/overlay.js';

const runtimeState = {
  inited: false,
  listenerBound: false,
  pendingByChat: new Map(),
  consumedRuleIdsByChat: new Map(),
  latestStatDataByChat: new Map(),
  aliasToCgIdByChat: new Map(),
  recentAliasToCgIdByChat: new Map(),
};

const cotRefreshState = {
  inFlight: false,
  queued: false,
  lastReason: '',
};

const CHAT_KEY_FALLBACK = '__current_chat__';
const MVU_SCOPE_OPTIONS = [
  { type: 'message', message_id: 'latest' },
  { type: 'chat' },
  { type: 'character' },
  { type: 'global' },
  null,
];

let _injectCOTToWorldbookRef = null;

export function setSpecialCgTriggerRefs({ injectCOTToWorldbook } = {}) {
  if (typeof injectCOTToWorldbook === 'function') {
    _injectCOTToWorldbookRef = injectCOTToWorldbook;
  }
}

function normalizeSpecialCgSceneAlias(name, fallback = 'special_cg') {
  const safeName = String(name || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/["']/g, '')
    .trim();
  if (safeName) return safeName;
  const safeFallback = String(fallback || '').replace(/["']/g, '').trim();
  return safeFallback || 'special_cg';
}

export function createSpecialCgSceneAlias(ruleName, ruleId = '') {
  return normalizeSpecialCgSceneAlias(ruleName, ruleId);
}

function normalizeChatId(chatId) {
  return String(chatId || '').trim();
}

function collectCurrentChatCandidates() {
  const candidates = [];
  let context = null;

  try {
    if (typeof getContext === 'function') {
      context = getContext();
    }
  } catch (error) {}

  try {
    if (!context && topWindow?.SillyTavern && typeof topWindow.SillyTavern.getContext === 'function') {
      context = topWindow.SillyTavern.getContext();
    }
  } catch (error) {}

  const metadata = context?.chatMetadata || topWindow?.SillyTavern?.chatMetadata || {};

  try {
    const getter = topWindow?.getCurrentChatId || globalThis.getCurrentChatId;
    if (typeof getter === 'function') {
      candidates.push(getter.call(topWindow));
    }
  } catch (error) {}

  candidates.push(
    context?.chatId,
    context?.chat_id,
    context?.chat?.id,
    context?.chat?.file_name,
    metadata?.chatId,
    metadata?.chat_id,
    metadata?.file_name,
    metadata?.chat_file,
    topWindow?.chatId,
    topWindow?.chat_id,
  );

  if (typeof substitudeMacros === 'function') {
    try {
      candidates.push(substitudeMacros('{{chatId}}'));
      candidates.push(substitudeMacros('{{chat_id}}'));
      candidates.push(substitudeMacros('{{chat}}'));
    } catch (error) {}
  }

  return candidates;
}

function resolveChatKey(chatId = null) {
  const direct = normalizeChatId(chatId);
  if (direct) return direct;

  const candidates = collectCurrentChatCandidates();
  for (const candidate of candidates) {
    const normalized = normalizeChatId(candidate);
    if (normalized) return normalized;
  }
  return CHAT_KEY_FALLBACK;
}

function migrateRuntimeStateFromFallback(chatKey) {
  const safeChatKey = normalizeChatId(chatKey);
  if (!safeChatKey || safeChatKey === CHAT_KEY_FALLBACK) return;
  if (safeChatKey === CHAT_KEY_FALLBACK) return;

  const fallbackPending = runtimeState.pendingByChat.get(CHAT_KEY_FALLBACK) || null;
  if (fallbackPending && !runtimeState.pendingByChat.has(safeChatKey)) {
    runtimeState.pendingByChat.set(safeChatKey, {
      ...fallbackPending,
      chatId: safeChatKey,
    });
  }
  runtimeState.pendingByChat.delete(CHAT_KEY_FALLBACK);

  const fallbackConsumed = runtimeState.consumedRuleIdsByChat.get(CHAT_KEY_FALLBACK);
  if (fallbackConsumed && fallbackConsumed.size > 0) {
    const targetConsumed = runtimeState.consumedRuleIdsByChat.get(safeChatKey) || new Set();
    fallbackConsumed.forEach(ruleId => targetConsumed.add(ruleId));
    runtimeState.consumedRuleIdsByChat.set(safeChatKey, targetConsumed);
  }
  runtimeState.consumedRuleIdsByChat.delete(CHAT_KEY_FALLBACK);

  if (!runtimeState.latestStatDataByChat.has(safeChatKey) && runtimeState.latestStatDataByChat.has(CHAT_KEY_FALLBACK)) {
    runtimeState.latestStatDataByChat.set(safeChatKey, runtimeState.latestStatDataByChat.get(CHAT_KEY_FALLBACK));
  }
  runtimeState.latestStatDataByChat.delete(CHAT_KEY_FALLBACK);

  const fallbackAliasMap = runtimeState.aliasToCgIdByChat.get(CHAT_KEY_FALLBACK);
  if (fallbackAliasMap && fallbackAliasMap.size > 0) {
    const targetAliasMap = runtimeState.aliasToCgIdByChat.get(safeChatKey) || new Map();
    fallbackAliasMap.forEach((cgId, aliasKey) => {
      if (!targetAliasMap.has(aliasKey)) {
        targetAliasMap.set(aliasKey, cgId);
      }
    });
    runtimeState.aliasToCgIdByChat.set(safeChatKey, targetAliasMap);
  }
  runtimeState.aliasToCgIdByChat.delete(CHAT_KEY_FALLBACK);

  const fallbackRecentMap = runtimeState.recentAliasToCgIdByChat.get(CHAT_KEY_FALLBACK);
  if (fallbackRecentMap && fallbackRecentMap.size > 0) {
    const targetRecentMap = runtimeState.recentAliasToCgIdByChat.get(safeChatKey) || new Map();
    fallbackRecentMap.forEach((cgId, aliasKey) => {
      if (targetRecentMap.has(aliasKey)) {
        targetRecentMap.delete(aliasKey);
      }
      targetRecentMap.set(aliasKey, cgId);
    });
    while (targetRecentMap.size > 12) {
      const first = targetRecentMap.keys().next().value;
      targetRecentMap.delete(first);
    }
    runtimeState.recentAliasToCgIdByChat.set(safeChatKey, targetRecentMap);
  }
  runtimeState.recentAliasToCgIdByChat.delete(CHAT_KEY_FALLBACK);
}

function ensureChatRuntimeState(chatId = null) {
  const chatKey = resolveChatKey(chatId);
  migrateRuntimeStateFromFallback(chatKey);
  return chatKey;
}

function getConsumedRuleSet(chatKey, { create = false } = {}) {
  const safeChatKey = ensureChatRuntimeState(chatKey);
  let set = runtimeState.consumedRuleIdsByChat.get(safeChatKey);
  if (!set && create) {
    set = new Set();
    runtimeState.consumedRuleIdsByChat.set(safeChatKey, set);
  }
  return set || null;
}

function resolvePathValue(target, path) {
  const safePath = String(path || '').trim().replace(/^stat_data\./, '');
  if (!safePath) return undefined;

  const parts = [];
  const tokenRegex = /([^[.\]]+)|\[(\d+)\]/g;
  let match;
  while ((match = tokenRegex.exec(safePath)) !== null) {
    const token = match[1] !== undefined ? match[1] : match[2];
    if (token === undefined || token === null) continue;
    parts.push(token.trim());
  }
  if (parts.length === 0) return undefined;

  let cursor = target;
  for (const part of parts) {
    if (Array.isArray(cursor)) {
      const idx = Number(part);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cursor.length) return undefined;
      cursor = cursor[idx];
      continue;
    }
    if (!cursor || typeof cursor !== 'object' || !Object.prototype.hasOwnProperty.call(cursor, part)) {
      return undefined;
    }
    cursor = cursor[part];
  }
  return cursor;
}

function compareByOperator(value, operator, threshold) {
  switch (operator) {
    case 'gt':
      return value > threshold;
    case 'eq':
      return value === threshold;
    case 'lte':
      return value <= threshold;
    case 'lt':
      return value < threshold;
    case 'gte':
    default:
      return value >= threshold;
  }
}

function normalizeSceneName(sceneName) {
  return String(sceneName || '').trim();
}

function normalizeSceneAliasKey(sceneAlias) {
  return normalizeSceneName(sceneAlias).toLowerCase();
}

function setAliasMappingForPending(chatKey, pending) {
  const safeChatKey = ensureChatRuntimeState(chatKey);
  if (!pending || !pending.sceneAlias || !pending.cgId) {
    runtimeState.aliasToCgIdByChat.delete(safeChatKey);
    return;
  }
  const aliasKey = normalizeSceneAliasKey(pending.sceneAlias);
  if (!aliasKey) {
    runtimeState.aliasToCgIdByChat.delete(safeChatKey);
    return;
  }
  const aliasMap = new Map();
  aliasMap.set(aliasKey, String(pending.cgId || '').trim());
  runtimeState.aliasToCgIdByChat.set(safeChatKey, aliasMap);
}

function pushRecentAliasMapping(chatKey, sceneAlias, cgId) {
  const safeChatKey = ensureChatRuntimeState(chatKey);
  const aliasKey = normalizeSceneAliasKey(sceneAlias);
  const safeCgId = String(cgId || '').trim();
  if (!aliasKey || !safeCgId) return;
  let recentMap = runtimeState.recentAliasToCgIdByChat.get(safeChatKey);
  if (!recentMap) {
    recentMap = new Map();
    runtimeState.recentAliasToCgIdByChat.set(safeChatKey, recentMap);
  }
  if (recentMap.has(aliasKey)) {
    recentMap.delete(aliasKey);
  }
  recentMap.set(aliasKey, safeCgId);
  if (recentMap.size > 12) {
    const first = recentMap.keys().next().value;
    recentMap.delete(first);
  }
}

function getOverlayNodes(ensure = false) {
  const $overlay = ensure ? ensureGlobalOverlay() : $(topWindow.document).find('#gal-global-overlay');
  const $specialOverlay = $overlay.find('.gal-special-cg-overlay');
  const $img = $specialOverlay.find('.gal-special-cg-overlay-image');
  return { $overlay, $specialOverlay, $img };
}

function hideSpecialCgOverlayView() {
  const { $overlay, $specialOverlay, $img } = getOverlayNodes(false);
  if (!$overlay.length) return;
  if ($img.length) {
    $img.attr('src', '');
    $img.attr('alt', '特殊CG');
  }
  $specialOverlay.hide().removeClass('active');
}

function getRuleById(ruleId) {
  const safeRuleId = String(ruleId || '').trim();
  if (!safeRuleId) return null;
  const rules = Array.isArray(getSettings()?.specialCg?.rules) ? getSettings().specialCg.rules : [];
  return rules.find(rule => String(rule?.id || '').trim() === safeRuleId) || null;
}

function shouldUseOncePerChat(ruleId, fallbackValue = true) {
  const rule = getRuleById(ruleId);
  if (!rule) return fallbackValue;
  return rule.oncePerChat !== false;
}

function isSamePending(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    String(a.chatId || '') === String(b.chatId || '') &&
    String(a.ruleId || '') === String(b.ruleId || '') &&
    String(a.cgId || '') === String(b.cgId || '') &&
    String(a.sceneAlias || '') === String(b.sceneAlias || '')
  );
}

function notifyPendingChanged(reason = 'unknown') {
  if (typeof _injectCOTToWorldbookRef !== 'function') return;
  if (!getIsEnabled()) return;

  cotRefreshState.lastReason = reason;
  if (cotRefreshState.inFlight) {
    cotRefreshState.queued = true;
    return;
  }

  cotRefreshState.inFlight = true;
  Promise.resolve()
    .then(() => _injectCOTToWorldbookRef())
    .catch(error => {
      console.warn(`[${SCRIPT_NAME}] 特殊CG触发器刷新COT失败:`, error);
    })
    .finally(() => {
      cotRefreshState.inFlight = false;
      if (cotRefreshState.queued) {
        cotRefreshState.queued = false;
        notifyPendingChanged(`queued:${cotRefreshState.lastReason}`);
      }
    });
}

function setPendingForChat(chatKey, pending, reason = 'unknown', options = {}) {
  const notify = options?.notify !== false;
  const safeChatKey = ensureChatRuntimeState(chatKey);
  const previous = runtimeState.pendingByChat.get(safeChatKey) || null;
  if (pending) {
    runtimeState.pendingByChat.set(safeChatKey, pending);
  } else {
    runtimeState.pendingByChat.delete(safeChatKey);
  }
  setAliasMappingForPending(safeChatKey, pending);

  if (!isSamePending(previous, pending)) {
    if (notify) {
      notifyPendingChanged(reason);
    }
    return true;
  }
  return false;
}

function buildPendingEntry(chatKey, selectedRule) {
  const safeChatKey = ensureChatRuntimeState(chatKey);
  const sceneAlias = createSpecialCgSceneAlias(selectedRule.name, selectedRule.ruleId);
  return {
    chatId: safeChatKey,
    ruleId: selectedRule.ruleId,
    ruleName: String(selectedRule.name || selectedRule.ruleId || '').trim(),
    cgId: selectedRule.cgId,
    sceneAlias,
    priority: selectedRule.priority,
    threshold: selectedRule.threshold,
    oncePerChat: selectedRule.oncePerChat !== false,
    updatedAt: new Date().toISOString(),
  };
}

function buildMatchedRules(statData, chatKey) {
  const settings = getSettings();
  const specialCg = settings?.specialCg;
  if (!specialCg || specialCg.enabled !== true) return [];

  const rules = Array.isArray(specialCg.rules) ? specialCg.rules : [];
  const matched = [];
  const consumedSet = getConsumedRuleSet(chatKey) || new Set();

  rules.forEach((rule, index) => {
    const safeRule = rule && typeof rule === 'object' ? rule : null;
    if (!safeRule) return;
    if (safeRule.enabled === false) return;

    const ruleId = String(safeRule.id || '').trim();
    if (!ruleId) return;
    const oncePerChat = safeRule.oncePerChat !== false;
    if (oncePerChat && consumedSet.has(ruleId)) return;

    const variablePath = String(safeRule.variablePath || '').trim().replace(/^stat_data\./, '');
    const cgId = String(safeRule.cgId || '').trim();
    if (!variablePath || !cgId) return;

    const rawValue = resolvePathValue(statData, variablePath);
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) return;

    const threshold = Number.isFinite(Number(safeRule.threshold)) ? Number(safeRule.threshold) : 0;
    const operator = String(safeRule.operator || 'gte').trim().toLowerCase();
    if (!compareByOperator(numericValue, operator, threshold)) return;

    matched.push({
      ruleId,
      name: String(safeRule.name || ruleId).trim() || ruleId,
      cgId,
      priority: Number.isFinite(Number(safeRule.priority)) ? Number(safeRule.priority) : 0,
      threshold,
      oncePerChat,
      index,
    });
  });

  matched.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (b.threshold !== a.threshold) return b.threshold - a.threshold;
    return a.index - b.index;
  });

  return matched;
}

async function selectHighestAvailableRule(matchedRules) {
  if (!Array.isArray(matchedRules) || matchedRules.length === 0) return null;

  for (const item of matchedRules) {
    const url = await getSpecialCg(item.cgId);
    if (url) {
      return item;
    }
    console.warn(
      `[${SCRIPT_NAME}] 特殊CG资源缺失，尝试降级到次高优先级规则: rule=${item.ruleId}, cg=${item.cgId}`,
    );
  }

  return null;
}

function buildMatchedRulesFromStatCandidates(statDataList, chatKey) {
  const uniqueByRule = new Map();
  const candidates = Array.isArray(statDataList) ? statDataList : [];

  candidates.forEach((statData, sourceIndex) => {
    if (!statData || typeof statData !== 'object') return;
    const matched = buildMatchedRules(statData, chatKey);
    matched.forEach(rule => {
      const ruleId = String(rule.ruleId || '').trim();
      if (!ruleId || uniqueByRule.has(ruleId)) return;
      uniqueByRule.set(ruleId, {
        ...rule,
        sourceIndex,
      });
    });
  });

  const merged = Array.from(uniqueByRule.values());
  merged.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (b.threshold !== a.threshold) return b.threshold - a.threshold;
    if (a.sourceIndex !== b.sourceIndex) return a.sourceIndex - b.sourceIndex;
    return a.index - b.index;
  });
  return merged;
}

async function evaluatePendingFromStatData(chatKey, statData) {
  const matchedRules = buildMatchedRules(statData, chatKey);
  if (matchedRules.length === 0) return null;
  const selected = await selectHighestAvailableRule(matchedRules);
  if (!selected) return null;
  return buildPendingEntry(chatKey, selected);
}

async function applyPendingByStatData(chatKey, statData, reason = 'special-cg-hit', options = {}) {
  const safeChatKey = ensureChatRuntimeState(chatKey);
  const nextPending = await evaluatePendingFromStatData(safeChatKey, statData);
  if (!nextPending) return false;

  const changed = setPendingForChat(safeChatKey, nextPending, reason, options);
  if (changed) {
    console.log(
      `[${SCRIPT_NAME}] 特殊CG待触发更新: chat=${safeChatKey}, rule=${nextPending.ruleId}, scene=${nextPending.sceneAlias}`,
    );
  }
  return changed;
}

function readStatDataFromMvuScopes() {
  const Mvu = topWindow.Mvu || globalThis.Mvu;
  if (!Mvu || typeof Mvu.getMvuData !== 'function') return [];

  const statDataList = [];
  MVU_SCOPE_OPTIONS.forEach(option => {
    try {
      const data = option ? Mvu.getMvuData(option) : Mvu.getMvuData();
      if (data?.stat_data && typeof data.stat_data === 'object') {
        statDataList.push(data.stat_data);
      }
    } catch (error) {}
  });

  return statDataList;
}

function readStatDataFromVariableScopes() {
  if (typeof getVariables !== 'function') return [];
  const scopes = ['chat', 'character', 'global', 'script'];
  const statDataList = [];
  scopes.forEach(type => {
    try {
      const data = getVariables({ type });
      if (data?.stat_data && typeof data.stat_data === 'object') {
        statDataList.push(data.stat_data);
      }
    } catch (error) {}
  });
  return statDataList;
}

function collectCurrentStatDataCandidates() {
  const all = [...readStatDataFromMvuScopes(), ...readStatDataFromVariableScopes()];
  const unique = [];
  const seen = new Set();
  all.forEach(item => {
    if (!item || typeof item !== 'object') return;
    if (seen.has(item)) return;
    seen.add(item);
    unique.push(item);
  });
  return unique;
}

async function hydratePendingFromCurrentSnapshot(chatKey) {
  const safeChatKey = ensureChatRuntimeState(chatKey);
  const statCandidates = collectCurrentStatDataCandidates();
  if (!statCandidates.length) return null;

  const matchedRules = buildMatchedRulesFromStatCandidates(statCandidates, safeChatKey);
  if (!matchedRules.length) return null;

  const selected = await selectHighestAvailableRule(matchedRules);
  if (!selected) return null;

  const pending = buildPendingEntry(safeChatKey, selected);
  setPendingForChat(safeChatKey, pending, 'special-cg-lazy-eval', { notify: false });
  runtimeState.latestStatDataByChat.set(safeChatKey, statCandidates[0]);
  return pending;
}

async function resolvePendingAvailability(chatKey, currentPending) {
  if (!currentPending) return null;
  const direct = await getSpecialCg(currentPending.cgId);
  if (direct) return currentPending;

  const safeChatKey = ensureChatRuntimeState(chatKey);
  const latestStat = runtimeState.latestStatDataByChat.get(safeChatKey);
  if (!latestStat || typeof latestStat !== 'object') {
    setPendingForChat(safeChatKey, null, 'special-cg-pending-missing-clear');
    return null;
  }

  const fallback = await evaluatePendingFromStatData(safeChatKey, latestStat);
  if (!fallback) {
    setPendingForChat(safeChatKey, null, 'special-cg-pending-missing-clear');
    return null;
  }

  setPendingForChat(safeChatKey, fallback, 'special-cg-pending-missing-fallback');
  return runtimeState.pendingByChat.get(safeChatKey) || null;
}

async function handleMvuVariableUpdateEnded(variables) {
  try {
    if (!getIsEnabled()) return;

    const statData = variables?.stat_data;
    if (!statData || typeof statData !== 'object') return;

    const chatKey = resolveChatKey();
    runtimeState.latestStatDataByChat.set(chatKey, statData);
    await applyPendingByStatData(chatKey, statData, 'special-cg-hit');
  } catch (error) {
    console.warn(`[${SCRIPT_NAME}] 特殊CG触发处理失败:`, error);
  }
}

async function waitForMvuReady() {
  const waitFn = topWindow.waitGlobalInitialized || globalThis.waitGlobalInitialized;
  if (typeof waitFn === 'function') {
    await waitFn('Mvu');
    return topWindow.Mvu || globalThis.Mvu || null;
  }

  for (let i = 0; i < 30; i++) {
    const candidate = topWindow.Mvu || globalThis.Mvu || null;
    if (candidate) return candidate;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return null;
}

export async function initSpecialCgTrigger() {
  if (runtimeState.inited) return;
  runtimeState.inited = true;

  try {
    const Mvu = await waitForMvuReady();
    const eventOnFn = topWindow.eventOn || globalThis.eventOn;
    if (!Mvu || !Mvu.events || typeof eventOnFn !== 'function') {
      console.warn(`[${SCRIPT_NAME}] 特殊CG触发器初始化跳过：MVU 或 eventOn 不可用`);
      return;
    }

    if (runtimeState.listenerBound) return;
    eventOnFn(Mvu.events.VARIABLE_UPDATE_ENDED, handleMvuVariableUpdateEnded);
    runtimeState.listenerBound = true;
    console.log(`[${SCRIPT_NAME}] 特殊CG触发器已注册 MVU 监听`);
  } catch (error) {
    runtimeState.inited = false;
    console.warn(`[${SCRIPT_NAME}] 特殊CG触发器初始化失败:`, error);
  }
}

export function onSceneChangedForSpecialCg(sceneName) {
  const nextScene = normalizeSceneName(sceneName);
  if (!nextScene) return;
  const { $specialOverlay } = getOverlayNodes(false);
  if (!$specialOverlay.length || !$specialOverlay.hasClass('active')) return;
  hideSpecialCgOverlayView();
}

export async function getPendingSpecialCg(chatId = null) {
  const chatKey = ensureChatRuntimeState(chatId);
  let currentPending = runtimeState.pendingByChat.get(chatKey) || null;
  if (!currentPending) {
    currentPending = await hydratePendingFromCurrentSnapshot(chatKey);
  }
  if (!currentPending) return null;
  return resolvePendingAvailability(chatKey, currentPending);
}

export async function detectSpecialCgPendingNow(chatId = null) {
  const chatKey = ensureChatRuntimeState(chatId);
  const pending = await getPendingSpecialCg(chatKey);
  if (pending) {
    console.log(
      `[${SCRIPT_NAME}] 特殊CG启动检测命中: chat=${chatKey}, rule=${pending.ruleId}, scene=${pending.sceneAlias}`,
    );
  } else {
    console.log(`[${SCRIPT_NAME}] 特殊CG启动检测未命中: chat=${chatKey}`);
  }
  return pending;
}

export function resolveSpecialCgSceneAlias(sceneName, chatId = null) {
  const safeSceneName = normalizeSceneName(sceneName);
  if (!safeSceneName) return null;

  const aliasKey = normalizeSceneAliasKey(safeSceneName);
  const chatKey = ensureChatRuntimeState(chatId);
  const aliasMap = runtimeState.aliasToCgIdByChat.get(chatKey);
  if (aliasMap && aliasMap.has(aliasKey)) {
    return aliasMap.get(aliasKey) || null;
  }
  const recentMap = runtimeState.recentAliasToCgIdByChat.get(chatKey);
  if (recentMap && recentMap.has(aliasKey)) {
    return recentMap.get(aliasKey) || null;
  }
  return null;
}

export function consumePendingSpecialCgByScene(sceneAlias, chatId = null) {
  const normalizedScene = normalizeSceneName(sceneAlias);
  if (!normalizedScene) return false;

  const chatKey = ensureChatRuntimeState(chatId);
  const pending = runtimeState.pendingByChat.get(chatKey) || null;
  if (!pending) return false;
  const pendingScene = normalizeSceneName(pending.sceneAlias);
  const sameAlias = normalizeSceneAliasKey(pendingScene) === normalizeSceneAliasKey(normalizedScene);
  if (!sameAlias) return false;

  pushRecentAliasMapping(chatKey, normalizedScene, pending.cgId);
  runtimeState.pendingByChat.delete(chatKey);
  runtimeState.aliasToCgIdByChat.delete(chatKey);
  const oncePerChat = shouldUseOncePerChat(pending.ruleId, pending.oncePerChat !== false);
  if (oncePerChat) {
    getConsumedRuleSet(chatKey, { create: true }).add(pending.ruleId);
  }
  notifyPendingChanged('special-cg-consumed');
  console.log(
    `[${SCRIPT_NAME}] 特殊CG待触发已消费: chat=${chatKey}, rule=${pending.ruleId}, scene=${pending.sceneAlias}`,
  );
  return true;
}

export function clearPendingSpecialCg(chatId = null) {
  const chatKey = ensureChatRuntimeState(chatId);
  const hadPending = runtimeState.pendingByChat.has(chatKey);
  if (!hadPending) return false;
  runtimeState.pendingByChat.delete(chatKey);
  runtimeState.aliasToCgIdByChat.delete(chatKey);
  notifyPendingChanged('special-cg-clear');
  return true;
}

export function resetSpecialCgRuntimeForChat(chatId = null) {
  const chatKey = ensureChatRuntimeState(chatId);
  const hadPending = runtimeState.pendingByChat.has(chatKey);
  runtimeState.pendingByChat.delete(chatKey);
  runtimeState.consumedRuleIdsByChat.delete(chatKey);
  runtimeState.aliasToCgIdByChat.delete(chatKey);
  runtimeState.recentAliasToCgIdByChat.delete(chatKey);
  if (hadPending) {
    notifyPendingChanged('special-cg-runtime-reset');
  }
  return true;
}

export function resetSpecialCgTriggerForChat(chatId = null) {
  const chatKey = ensureChatRuntimeState(chatId);
  const hadPending = runtimeState.pendingByChat.has(chatKey);
  runtimeState.pendingByChat.delete(chatKey);
  runtimeState.consumedRuleIdsByChat.delete(chatKey);
  runtimeState.latestStatDataByChat.delete(chatKey);
  runtimeState.aliasToCgIdByChat.delete(chatKey);
  runtimeState.recentAliasToCgIdByChat.delete(chatKey);
  hideSpecialCgOverlayView();
  if (hadPending) {
    notifyPendingChanged('special-cg-chat-reset');
  }
}

export function clearSpecialCgOverlayAndQueue() {
  clearPendingSpecialCg();
  hideSpecialCgOverlayView();
}
