import { DEFAULT_PACK_ID, SCRIPT_NAME, THEME } from '../core/constants.js';
import { $, topWindow } from '../core/env.js';
import { ensureSpecialCgSettings, ensureTitleScreenSettings, getCurrentCharId, getSettings, saveSettings } from '../core/settings.js';
import { getIsEnabled } from '../core/state.js';
import { GalgameStore } from '../core/store.js';
import { deleteBackground, getAllBackgrounds } from '../db/backgrounds.js';
import {
    createImagePack,
    getAllImagePacks,
    getCurrentPackId,
    getRenderScope,
    setCurrentPack,
    setRenderScope,
} from '../db/image-packs.js';
import { GLOBAL_MAP_REGION_KEY, deleteMapImage, getAllMapImages, getUnifiedMapImage } from '../db/map-images.js';
import { deleteSpecialCg, getAllSpecialCgs } from '../db/special-cgs.js';
import { deleteSprite, getAllSprites } from '../db/sprites.js';
import { convertTextToCotFormat } from '../logic/enhanced-mode.js';
import { detectSpecialCgPendingNow, resetSpecialCgRuntimeForChat } from '../logic/special-cg-trigger.js';
import { injectCOTToWorldbook } from '../logic/worldbook.js';
import { showMapModal } from '../map/map-modal.js';
import { getCharacterListFromDatabase } from '../utils/chat.js';
import {
    LOCATION_STATUS_ICON_OPTIONS,
    TIME_STATUS_ICON_OPTIONS,
    normalizeLocationStatusIconClass,
    normalizeTimeStatusIconClass,
} from '../utils/status-popup-icons.js';
import {
    AssetIO,
    exportCurrentCharacterCardWithConfig,
    importAssetsFromJson,
    importFromZipFile,
    showImportError,
    showInAppAlertDialog,
    showInAppConfirmDialog,
    showInAppPromptDialog,
    showRemoteZipImportDialog,
} from './asset-io.js';
import { getUiSkinProfileLabel, hasUiSkinProfileId } from '../db/ui-skin-profiles.js';
import { showCharacterSpritesModal, showPackManagerModal, showTransferDialog } from './asset-manager-parts.js';
import { getModalMountRoot } from './fullscreen.js';
import { bindImageGenConfigEvents, buildImageGenConfigPane } from './image-gen-config.js';
import { showMapUploadDialog } from './map-upload.js';
import { bindCustomSkinEditorEvents, buildCustomSkinEditorTab } from './custom-skin-editor.js';
import { applyCustomSkinRuntime } from './custom-skin-runtime.js';
import { showToast } from './toast.js';

// 延迟引用
let _showSpriteUploadDialogRef = null;
let _showBatchUploadDialogRef = null;
let _showBackgroundUploadDialogRef = null;
let _showBatchBackgroundUploadDialogRef = null;
let _showCustomExpressionManagerRef = null;
let _showSpecialCgUploadDialogRef = null;
let _showBatchSpecialCgUploadDialogRef = null;
let _showSettingsPanelRef = null;

export function setAssetManagerModalRefs({
  showSpriteUploadDialog,
  showBatchUploadDialog,
  showBackgroundUploadDialog,
  showBatchBackgroundUploadDialog,
  showCustomExpressionManager,
  showSpecialCgUploadDialog,
  showBatchSpecialCgUploadDialog,
  showSettingsPanel,
}) {
  if (showSpriteUploadDialog) _showSpriteUploadDialogRef = showSpriteUploadDialog;
  if (showBatchUploadDialog) _showBatchUploadDialogRef = showBatchUploadDialog;
  if (showBackgroundUploadDialog) _showBackgroundUploadDialogRef = showBackgroundUploadDialog;
  if (showBatchBackgroundUploadDialog) _showBatchBackgroundUploadDialogRef = showBatchBackgroundUploadDialog;
  if (showCustomExpressionManager) _showCustomExpressionManagerRef = showCustomExpressionManager;
  if (showSpecialCgUploadDialog) _showSpecialCgUploadDialogRef = showSpecialCgUploadDialog;
  if (showBatchSpecialCgUploadDialog) _showBatchSpecialCgUploadDialogRef = showBatchSpecialCgUploadDialog;
  if (showSettingsPanel) _showSettingsPanelRef = showSettingsPanel;
}

const CUSTOM_LOCATION_HTML_KEY = GalgameStore.STORAGE_KEYS.CUSTOM_LOCATION_HTML;
const CUSTOM_TIME_HTML_KEY = GalgameStore.STORAGE_KEYS.CUSTOM_TIME_HTML;
const CUSTOM_LOCATION_ICON_CLASS_KEY = GalgameStore.STORAGE_KEYS.CUSTOM_LOCATION_ICON_CLASS;
const CUSTOM_TIME_ICON_CLASS_KEY = GalgameStore.STORAGE_KEYS.CUSTOM_TIME_ICON_CLASS;
const ASSET_SUB_TAB_DEFS = [
  { id: 'sprites', icon: 'fa-user', label: '立绘管理' },
  { id: 'backgrounds', icon: 'fa-image', label: '背景管理' },
  { id: 'title-screen', icon: 'fa-house', label: '标题界面' },
  { id: 'special-cgs', icon: 'fa-photo-film', label: 'CG管理' },
  { id: 'special-cg-rules', icon: 'fa-bolt', label: 'MVU触发CG' },
  { id: 'maps', icon: 'fa-map-location-dot', label: '地图管理' },
  { id: 'skin', icon: 'fa-palette', label: '皮肤编辑' },
  { id: 'imagegen', icon: 'fa-wand-magic-sparkles', label: '生图配置' },
  { id: 'opening', icon: 'fa-pen-to-square', label: '开场白转换' },
  { id: 'bgm', icon: 'fa-music', label: '指定BGM' },
  { id: 'custom', icon: 'fa-code', label: '自定义模块' },
];
const ASSET_SUB_TAB_ID_SET = new Set(ASSET_SUB_TAB_DEFS.map(item => item.id));
const UI_ACCESS_UNLOCK_VAR_PATH = ['galgame_ui_plugin', 'uiAccessUnlock', 'assets'];
const uiAccessUnlockSessionCache = new Map();

function isTitleBackgroundSceneName(rawSceneName) {
  const sceneName = String(rawSceneName || '').trim();
  if (!sceneName) return false;
  if (sceneName === '__title__') return true;
  return sceneName.includes('::char::');
}

function normalizeAssetSubTabIds(rawList) {
  const source = Array.isArray(rawList)
    ? rawList
    : (typeof rawList === 'string' ? rawList.split(/[,\r\n]/) : []);
  const normalized = [];
  source.forEach((item) => {
    const tabId = String(item || '').trim();
    if (!tabId || !ASSET_SUB_TAB_ID_SET.has(tabId) || normalized.includes(tabId)) return;
    normalized.push(tabId);
  });
  return normalized;
}

function hashText(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `h${(hash >>> 0).toString(16)}`;
}

function buildUiAccessPolicyHash(hiddenAssetTabs, password, mode = 'plaintext') {
  const tabs = normalizeAssetSubTabIds(hiddenAssetTabs).sort();
  const payload = JSON.stringify({
    mode: String(mode || 'plaintext').trim().toLowerCase(),
    hiddenAssetTabs: tabs,
    password: String(password || ''),
  });
  return hashText(payload);
}

function getNestedValue(source, path) {
  if (!source || typeof source !== 'object') return undefined;
  const keys = Array.isArray(path) ? path : [];
  let cursor = source;
  for (const key of keys) {
    if (!cursor || typeof cursor !== 'object' || !Object.prototype.hasOwnProperty.call(cursor, key)) {
      return undefined;
    }
    cursor = cursor[key];
  }
  return cursor;
}

function setNestedValue(target, path, value) {
  if (!target || typeof target !== 'object') return;
  const keys = Array.isArray(path) ? path.filter(Boolean) : [];
  if (keys.length === 0) return;
  let cursor = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
}

function getSillyTavernContextSafe() {
  try {
    const getContext = topWindow?.SillyTavern?.getContext;
    if (typeof getContext === 'function') {
      return getContext.call(topWindow.SillyTavern) || null;
    }
  } catch (error) {
    console.warn(`[${SCRIPT_NAME}] 获取 SillyTavern 上下文失败`, error);
  }
  return null;
}

function extractGalgamePluginConfigFromCard(card) {
  if (!card || typeof card !== 'object') return null;
  const candidates = [
    card?.data?.extensions?.galgame_ui_plugin,
    card?.extensions?.galgame_ui_plugin,
    card?.json_data?.data?.extensions?.galgame_ui_plugin,
    card?.json_data?.extensions?.galgame_ui_plugin,
  ];
  for (const item of candidates) {
    if (item && typeof item === 'object' && !Array.isArray(item)) return item;
  }
  return null;
}

function collectCurrentCharacterCardCandidates() {
  const candidates = [];
  const append = (item) => {
    if (!item || typeof item !== 'object') return;
    if (!candidates.includes(item)) candidates.push(item);
  };

  const ctx = getSillyTavernContextSafe();
  if (ctx?.characters && ctx?.characterId != null) {
    append(ctx.characters[ctx.characterId]);
  }

  const st = topWindow?.SillyTavern;
  if (st?.characters && st?.characterId != null) {
    append(st.characters[st.characterId]);
  }

  return candidates;
}

async function readCurrentCharacterGalgamePluginConfig() {
  const candidates = collectCurrentCharacterCardCandidates();
  for (const card of candidates) {
    const config = extractGalgamePluginConfigFromCard(card);
    if (config) return config;
  }

  const getCharacter = topWindow?.TavernHelper?.getCharacter;
  if (typeof getCharacter === 'function') {
    try {
      const current = await getCharacter('current');
      const config = extractGalgamePluginConfigFromCard(current);
      if (config) return config;
    } catch (error) {
      console.warn(`[${SCRIPT_NAME}] 读取 current 角色卡扩展失败`, error);
    }
  }

  return null;
}

function normalizeUiAccessPolicy(rawPolicy) {
  const source = rawPolicy && typeof rawPolicy === 'object' && !Array.isArray(rawPolicy)
    ? rawPolicy
    : {};
  const enabled = source.enabled === true;
  const hiddenAssetTabs = normalizeAssetSubTabIds(source.hiddenAssetTabs);
  const unlock = source.unlock && typeof source.unlock === 'object' && !Array.isArray(source.unlock)
    ? source.unlock
    : {};
  const unlockMode = String(unlock.mode || 'plaintext').trim().toLowerCase() || 'plaintext';
  const password = String(unlock.password || '').trim();
  const valid = enabled && hiddenAssetTabs.length > 0 && unlockMode === 'plaintext' && !!password;
  if (!valid) {
    return {
      enabled: false,
      hiddenAssetTabs: [],
      unlockMode: 'plaintext',
      password: '',
      policyHash: '',
    };
  }
  return {
    enabled: true,
    hiddenAssetTabs,
    unlockMode: 'plaintext',
    password,
    policyHash: buildUiAccessPolicyHash(hiddenAssetTabs, password, unlockMode),
  };
}

function resolveCurrentCharacterUnlockCacheKey() {
  const charId = String(getCurrentCharId() || '').trim();
  if (charId) return `char:${charId}`;
  const ctx = getSillyTavernContextSafe();
  const fallbackName = String(
    ctx?.characters?.[ctx?.characterId]?.name
      || topWindow?.SillyTavern?.characters?.[topWindow?.SillyTavern?.characterId]?.name
      || '',
  ).trim();
  return fallbackName ? `char-name:${fallbackName}` : 'char:unknown';
}

function readAssetTabUnlockState(policyHash) {
  const key = resolveCurrentCharacterUnlockCacheKey();
  const currentHash = String(policyHash || '').trim();
  const sessionState = uiAccessUnlockSessionCache.get(key);
  if (
    sessionState
    && sessionState.unlocked === true
    && String(sessionState.policyHash || '').trim() === currentHash
  ) {
    return { unlocked: true, source: 'session', error: null };
  }

  try {
    if (typeof getVariables !== 'function') {
      throw new Error('getVariables 不可用');
    }
    const variables = getVariables({ type: 'character' }) || {};
    const stored = getNestedValue(variables, UI_ACCESS_UNLOCK_VAR_PATH);
    if (
      stored
      && typeof stored === 'object'
      && stored.unlocked === true
      && String(stored.policyHash || '').trim() === currentHash
    ) {
      return { unlocked: true, source: 'character', error: null };
    }
    return { unlocked: false, source: 'character', error: null };
  } catch (error) {
    return { unlocked: false, source: 'unavailable', error };
  }
}

function persistAssetTabUnlockState(policyHash) {
  const safePolicyHash = String(policyHash || '').trim();
  const key = resolveCurrentCharacterUnlockCacheKey();
  const payload = {
    unlocked: true,
    policyHash: safePolicyHash,
    updatedAt: new Date().toISOString(),
  };

  uiAccessUnlockSessionCache.set(key, payload);

  try {
    if (typeof getVariables !== 'function' || typeof replaceVariables !== 'function') {
      throw new Error('变量接口不可用');
    }
    const variables = getVariables({ type: 'character' });
    const nextVariables =
      variables && typeof variables === 'object' && !Array.isArray(variables)
        ? variables
        : {};
    setNestedValue(nextVariables, UI_ACCESS_UNLOCK_VAR_PATH, payload);
    replaceVariables(nextVariables, { type: 'character' });
    return { persisted: true, payload, error: null };
  } catch (error) {
    return { persisted: false, payload, error };
  }
}

async function resolveAssetTabUiAccessState() {
  const config = await readCurrentCharacterGalgamePluginConfig();
  const policy = normalizeUiAccessPolicy(config?.custom?.uiAccess);
  if (!policy.enabled) {
    return {
      enabled: false,
      hiddenAssetTabs: [],
      unlockMode: 'plaintext',
      password: '',
      policyHash: '',
      locked: false,
      unlockStateSource: 'none',
      unlockReadError: null,
    };
  }

  const unlockState = readAssetTabUnlockState(policy.policyHash);
  return {
    ...policy,
    locked: !unlockState.unlocked,
    unlockStateSource: unlockState.source,
    unlockReadError: unlockState.error,
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SPECIAL_CG_VAR_PATH_DATALIST_ID = 'gal-special-cg-variable-path-datalist';
const MAX_MVU_VAR_PATH_COUNT = 1200;
const MAX_MVU_SCAN_DEPTH = 8;
const MVU_SCOPE_OPTIONS = [
  { type: 'message', message_id: 'latest' },
  { type: 'chat' },
  { type: 'character' },
  { type: 'global' },
  null,
];

function isNumericLike(value) {
  if (value === null || value === undefined) return false;
  return Number.isFinite(Number(value));
}

function collectMvuVariablePaths(value, prefix, bucket, visited, depth = 0) {
  if (bucket.length >= MAX_MVU_VAR_PATH_COUNT) return;
  if (depth > MAX_MVU_SCAN_DEPTH) return;

  if (value && typeof value === 'object') {
    if (visited.has(value)) return;
    visited.add(value);
  }

  if (isNumericLike(value)) {
    if (prefix) bucket.push(prefix);
    return;
  }

  if (!value || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const nextPrefix = prefix ? `${prefix}.${index}` : String(index);
      collectMvuVariablePaths(item, nextPrefix, bucket, visited, depth + 1);
    });
    return;
  }

  Object.keys(value).forEach(key => {
    const safeKey = String(key || '').trim();
    if (!safeKey) return;
    const nextPrefix = prefix ? `${prefix}.${safeKey}` : safeKey;
    collectMvuVariablePaths(value[safeKey], nextPrefix, bucket, visited, depth + 1);
  });
}

function buildVariablePathOptionsHtml(paths) {
  const safePaths = Array.from(new Set((Array.isArray(paths) ? paths : [])
    .map(item => String(item || '').trim().replace(/^stat_data\./, ''))
    .filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  return safePaths.map(path => `<option value="${escapeHtml(path)}"></option>`).join('');
}

function extractMvuVariablePathsFromData(variables) {
  const statData = variables?.stat_data;
  if (!statData || typeof statData !== 'object') return [];
  const bucket = [];
  collectMvuVariablePaths(statData, '', bucket, new Set(), 0);
  return Array.from(new Set(bucket)).slice(0, MAX_MVU_VAR_PATH_COUNT);
}

function readMvuDataByOptions(Mvu, optionList) {
  const result = [];
  const safeOptionList = Array.isArray(optionList) ? optionList : [];
  if (!Mvu || typeof Mvu.getMvuData !== 'function') return result;

  safeOptionList.forEach(option => {
    try {
      const data = option ? Mvu.getMvuData(option) : Mvu.getMvuData();
      if (data && typeof data === 'object') {
        result.push(data);
      }
    } catch (error) {
      // 忽略当前作用域读取失败，继续尝试其他作用域
    }
  });

  return result;
}

function getMvuDataListFromScopes(Mvu) {
  return readMvuDataByOptions(Mvu, MVU_SCOPE_OPTIONS);
}

function normalizeMvuVariablePath(path) {
  return String(path || '')
    .trim()
    .replace(/^stat_data\./, '')
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/^\.+/, '')
    .replace(/\.+/g, '.');
}

function findMvuVariableValueInDataList(path, mvuDataList) {
  const normalizedPath = normalizeMvuVariablePath(path);
  if (!normalizedPath) return { found: false, value: undefined };

  const parts = normalizedPath.split('.').map(part => part.trim()).filter(Boolean);
  if (parts.length === 0) return { found: false, value: undefined };

  const safeMvuDataList = Array.isArray(mvuDataList) ? mvuDataList : [];
  for (const mvuData of safeMvuDataList) {
    const statData = mvuData?.stat_data;
    if (!statData || typeof statData !== 'object') continue;

    let cursor = statData;
    let matched = true;
    for (const part of parts) {
      if (!cursor || typeof cursor !== 'object' || !Object.prototype.hasOwnProperty.call(cursor, part)) {
        matched = false;
        break;
      }
      cursor = cursor[part];
    }

    if (matched) {
      return { found: true, value: cursor };
    }
  }

  return { found: false, value: undefined };
}

function stringifyMvuVariableValue(value) {
  if (value === undefined) return '未找到';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

function formatMvuVariableValueForDisplay(value, maxLength = 42) {
  const rawText = stringifyMvuVariableValue(value);
  if (rawText.length <= maxLength) return rawText;
  return `${rawText.slice(0, Math.max(0, maxLength - 3))}...`;
}

function extractMvuVariablePathsFromScopes(Mvu) {
  const mvuDataList = getMvuDataListFromScopes(Mvu);
  if (mvuDataList.length === 0) return [];

  const pathSet = new Set();
  for (const mvuData of mvuDataList) {
    const paths = extractMvuVariablePathsFromData(mvuData);
    for (const path of paths) {
      if (pathSet.size >= MAX_MVU_VAR_PATH_COUNT) {
        return Array.from(pathSet);
      }
      pathSet.add(path);
    }
  }

  return Array.from(pathSet);
}

function getMvuVariablePathsSync() {
  try {
    const Mvu = topWindow.Mvu || globalThis.Mvu;
    if (!Mvu || typeof Mvu.getMvuData !== 'function') return [];
    return extractMvuVariablePathsFromScopes(Mvu);
  } catch (error) {
    return [];
  }
}

async function loadMvuVariablePathsAsync(timeoutMs = 8000) {
  const waitFn = topWindow.waitGlobalInitialized || globalThis.waitGlobalInitialized;
  try {
    if (typeof waitFn === 'function') {
      await Promise.race([
        waitFn('Mvu'),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('MVU 初始化超时')), timeoutMs);
        }),
      ]);
    }
  } catch (error) {
    // 超时后继续尝试读取已存在的全局对象
  }

  const Mvu = topWindow.Mvu || globalThis.Mvu;
  if (!Mvu || typeof Mvu.getMvuData !== 'function') {
    throw new Error('未检测到 MVU 或 getMvuData 接口');
  }

  return extractMvuVariablePathsFromScopes(Mvu);
}

// ============================================
// showAssetManagerModal - 代理到统一面板
// ============================================

export async function showAssetManagerModal(activeTab = 'sprites') {
  if (_showSettingsPanelRef) {
    _showSettingsPanelRef('assets', activeTab);
  }
}

// ============================================
// 构建资源管理内容 (无 modal 壳)
// ============================================

export async function buildAssetManagerContent(activeTab) {
  const settings = getSettings();
  const specialCgSettings = ensureSpecialCgSettings();
  const titleScreen = ensureTitleScreenSettings();
  const currentCharId = getCurrentCharId();
  const allPacks = await getAllImagePacks();
  const currentPackId = getCurrentPackId();
  const currentPack = allPacks.find(p => p.id === currentPackId) || allPacks.find(p => p.id === DEFAULT_PACK_ID);
  const currentPackName = currentPack ? currentPack.name : '未定义';
  const currentRenderScope = getRenderScope();
  const allSprites = await getAllSprites(currentPackId);
  const allBackgroundsRaw = await getAllBackgrounds(currentPackId);
  const allBackgrounds = (Array.isArray(allBackgroundsRaw) ? allBackgroundsRaw : [])
    .filter(bg => !isTitleBackgroundSceneName(bg?.sceneName));
  const hiddenTitleBackgroundCount = Math.max(
    0,
    (Array.isArray(allBackgroundsRaw) ? allBackgroundsRaw.length : 0) - allBackgrounds.length,
  );
  const allSpecialCgs = await getAllSpecialCgs(currentPackId);
  const mvuVariablePaths = getMvuVariablePathsSync();
  const allMapImages = await getAllMapImages(currentPackId);
  const unifiedMapRecord = await getUnifiedMapImage(currentPackId);
  const legacyMapCount = allMapImages.filter(item => String(item?.regionKey || '').trim() !== GLOBAL_MAP_REGION_KEY).length;
  const dbCharacters = getCharacterListFromDatabase();
  const charactersData = new Map();
  allSprites.forEach(sprite => {
    if (!charactersData.has(sprite.characterId)) {
      charactersData.set(sprite.characterId, { sprites: [], type: '自定义', source: '本地' });
    }
    charactersData.get(sprite.characterId).sprites.push(sprite);
  });
  dbCharacters.forEach(char => {
    const charName = char.name;
    if (!charactersData.has(charName)) {
      charactersData.set(charName, { sprites: [], type: char.type, source: char.source });
    } else {
      const info = charactersData.get(charName);
      info.type = char.type;
      info.source = char.source;
    }
  });

  const uiAccessState = await resolveAssetTabUiAccessState();
  let visibleTabIds = ASSET_SUB_TAB_DEFS.map(item => item.id);
  if (uiAccessState.enabled && uiAccessState.locked) {
    visibleTabIds = visibleTabIds.filter(tabId => !uiAccessState.hiddenAssetTabs.includes(tabId));
    if (visibleTabIds.length === 0) {
      visibleTabIds = ASSET_SUB_TAB_DEFS.map(item => item.id);
    }
  }

  activeTab = String(activeTab || 'sprites').trim() || 'sprites';
  if (!visibleTabIds.includes(activeTab)) {
    activeTab = visibleTabIds[0] || 'sprites';
  }

  const tabHeaderHtml = visibleTabIds
    .map(tab => {
      const def = ASSET_SUB_TAB_DEFS.find(item => item.id === tab);
      if (!def) return '';
      return `<button class="gal-tab-btn ${activeTab === tab ? 'active' : ''}" data-tab="${tab}"><i class="fa-solid ${def.icon}"></i> ${def.label}</button>`;
    })
    .join('');
  const tabContentMap = {
    sprites: buildSpritesTab(activeTab, allSprites, charactersData),
    backgrounds: buildBackgroundsTab(settings, allBackgrounds, hiddenTitleBackgroundCount),
    'title-screen': buildTitleScreenTab(activeTab, titleScreen, currentCharId),
    'special-cgs': buildSpecialCgsTab(activeTab, allSpecialCgs),
    'special-cg-rules': buildSpecialCgRulesTab(activeTab, specialCgSettings, allSpecialCgs, mvuVariablePaths),
    maps: buildMapsTab(activeTab, unifiedMapRecord, legacyMapCount),
    skin: buildCustomSkinEditorTab(activeTab, currentPackId),
    imagegen: buildImagegenTab(activeTab, settings),
    opening: buildOpeningTab(activeTab),
    bgm: buildBgmTab(activeTab, settings),
    custom: buildCustomTab(settings),
  };
  const tabContentHtml = visibleTabIds
    .map(tabId => tabContentMap[tabId] || '')
    .filter(Boolean)
    .join('');
  const showUnlockButton = uiAccessState.enabled && uiAccessState.locked && uiAccessState.hiddenAssetTabs.length > 0;
  const unlockButtonHtml = showUnlockButton
    ? `
          <button class="gal-action-btn" id="gal-unlock-restricted-tabs-btn" title="输入口令后显示所有受限标签" style="padding: 6px 12px; font-size: 0.9rem; background: #0ea5e9; color: #fff; border-color: #0ea5e9;">
            <i class="fa-solid fa-lock-open"></i> <span>解锁受限标签</span>
          </button>
        `
    : '';

  const html = `
    <div class="gal-asset-header">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="gal-pack-selector" style="position: relative;">
            <button class="gal-action-btn" id="gal-pack-dropdown-btn" title="切换图包" style="padding: 6px 12px; font-size: 0.9rem; background: #6f42c1; color: #fff; border-color: #6f42c1;">
              <i class="fa-solid fa-layer-group"></i> <span id="gal-current-pack-name">${currentPackName}</span> <i class="fa-solid fa-caret-down" style="margin-left: 4px;"></i>
            </button>
            <div class="gal-pack-menu gal-z-dropdown" id="gal-pack-menu" style="display: none; position: absolute; top: 100%; left: 0; margin-top: 4px; background: #fff; border: 2px solid #333; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 180px; overflow: hidden;">
              ${allPacks
                .map(
                  pack => `
                <div class="gal-pack-item ${pack.id === currentPackId ? 'active' : ''}" data-pack-id="${pack.id}" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 1px solid #eee; transition: background 0.2s; color: #333; ${pack.id === currentPackId ? 'background: #e9ecef; font-weight: 700;' : ''}">
                  <span><i class="fa-solid fa-folder${pack.id === currentPackId ? '-open' : ''}" style="margin-right: 8px; color: ${pack.id === currentPackId ? '#6f42c1' : '#666'};"></i>${pack.name}</span>
                  ${pack.isDefault ? '<span style="font-size: 0.7rem; background: #6f42c1; color: #fff; padding: 2px 6px; border-radius: 3px;">默认</span>' : ''}
                </div>
              `,
                )
                .join('')}
              <div style="border-top: 2px solid #eee;">
                <div class="gal-pack-item" id="gal-add-pack-btn" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background 0.2s; color: #28a745;">
                  <i class="fa-solid fa-plus"></i> <span>新建图包</span>
                </div>
                <div class="gal-pack-item" id="gal-manage-packs-btn" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background 0.2s; color: #17a2b8;">
                  <i class="fa-solid fa-cog"></i> <span>管理图包</span>
                </div>
              </div>
            </div>
          </div>
          <button class="gal-action-btn" id="gal-render-scope-btn" title="${currentRenderScope === 'current' ? '仅当前图包资源' : '搜索所有图包资源'}" style="padding: 6px 10px; font-size: 0.9rem; background: ${currentRenderScope === 'current' ? '#fd7e14' : '#20c997'}; color: #fff; border-color: ${currentRenderScope === 'current' ? '#fd7e14' : '#20c997'};">
            <i class="fa-solid ${currentRenderScope === 'current' ? 'fa-bullseye' : 'fa-globe'}"></i>
          </button>
        </div>
        <div style="display: flex; gap: 8px;">
          ${unlockButtonHtml}
          <div class="gal-export-dropdown" style="position: relative;">
            <button class="gal-action-btn" id="gal-export-dropdown-btn" title="导出资源" style="padding: 6px 12px; font-size: 0.9rem;">
              <i class="fa-solid fa-file-export"></i> <span>导出</span> <i class="fa-solid fa-caret-down" style="margin-left: 4px;"></i>
            </button>
            <div class="gal-export-menu gal-z-dropdown" id="gal-export-menu" style="display: none; position: absolute; top: 100%; right: 0; margin-top: 4px; background: #fff; border: 2px solid #333; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 200px; overflow: hidden;">
              <div class="gal-export-item" data-action="export-local" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #eee; transition: background 0.2s; color: #333;">
                <i class="fa-solid fa-file-zipper" style="width: 20px; color: #333;"></i><span>导出本地压缩包</span>
              </div>
              <div class="gal-export-item" data-action="export-remote" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background 0.2s; color: #333;">
                <i class="fa-solid fa-cloud-upload" style="width: 20px; color: #6f42c1;"></i><span>导出GitHub资源包</span>
              </div>
              <div class="gal-export-item" data-action="export-character-card" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; border-top: 1px solid #eee; transition: background 0.2s; color: #333;">
                <i class="fa-solid fa-id-card" style="width: 20px; color: #0d6efd;"></i><span>导出打包角色卡（完整设置）</span>
              </div>
            </div>
          </div>
          <div class="gal-import-dropdown" style="position: relative;">
            <button class="gal-action-btn" id="gal-import-dropdown-btn" title="导入资源" style="padding: 6px 12px; font-size: 0.9rem; background: #28a745; color: #fff; border-color: #28a745;">
              <i class="fa-solid fa-file-import"></i> <span>导入</span> <i class="fa-solid fa-caret-down" style="margin-left: 4px;"></i>
            </button>
            <div class="gal-import-menu gal-z-dropdown" id="gal-import-menu" style="display: none; position: absolute; top: 100%; right: 0; margin-top: 4px; background: #fff; border: 2px solid #333; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 200px; overflow: hidden;">
              <div class="gal-import-item" data-action="import-local-zip" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #eee; transition: background 0.2s; color: #333;">
                <i class="fa-solid fa-file-zipper" style="width: 20px; color: #f39c12;"></i><span>本地压缩包导入</span>
              </div>
              <div class="gal-import-item" data-action="import-remote-zip" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #eee; transition: background 0.2s; color: #333;">
                <i class="fa-solid fa-cloud-arrow-down" style="width: 20px; color: #3498db;"></i><span>远程压缩包导入</span>
              </div>
              <div class="gal-import-item" data-action="import-json" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #eee; transition: background 0.2s; color: #333;">
                <i class="fa-solid fa-link" style="width: 20px; color: #9b59b6;"></i><span>导入远程链接JSON</span>
              </div>
              <div class="gal-import-item" data-action="import-github" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background 0.2s; color: #333;">
                <i class="fa-brands fa-github" style="width: 20px; color: #333;"></i><span>从GitHub导入</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <input type="file" id="gal-asset-import-zip-input" accept=".zip" style="display: none;">
      <input type="file" id="gal-asset-import-input" multiple webkitdirectory style="display: none;">
      <input type="file" id="gal-asset-import-json-input" accept=".json" style="display: none;">
    </div>
    <div class="gal-tab-header">
      ${tabHeaderHtml}
    </div>
    <div class="gal-tab-content">
      ${tabContentHtml}
    </div>
  `;

  return html;
}

// ============================================
// 绑定资源管理事件
// ============================================

export function bindAssetManagerContentEvents($modal, activeTab) {
  const settings = getSettings();

  // Tab 切换
  $modal.find('.gal-tab-btn').on('click', function () {
    const tab = $(this).data('tab');
    $modal.find('.gal-tab-btn').removeClass('active');
    $(this).addClass('active');
    $modal.find('.gal-tab-pane').hide();
    $modal.find(`.gal-tab-pane[data-pane="${tab}"]`).show();
  });

  // 解锁受限标签
  $modal.find('#gal-unlock-restricted-tabs-btn').on('click', async function () {
    const policyState = await resolveAssetTabUiAccessState();
    if (!policyState.enabled || !policyState.locked) {
      showToast('当前没有受限标签需要解锁');
      return;
    }

    const input = await showInAppPromptDialog({
      title: '解锁受限标签',
      message: `当前有 ${policyState.hiddenAssetTabs.length} 个资源子标签被隐藏，请输入解锁口令。`,
      label: '解锁口令',
      placeholder: '请输入口令',
      confirmText: '解锁',
      cancelText: '取消',
      iconClass: 'fa-solid fa-unlock-keyhole',
      accent: '#0ea5e9',
      required: true,
      requiredMessage: '请输入解锁口令',
      trim: false,
      inputType: 'password',
    });
    if (input === null) return;

    if (String(input) !== String(policyState.password)) {
      showToast('口令错误，受限标签仍保持隐藏');
      return;
    }

    const persistResult = persistAssetTabUnlockState(policyState.policyHash);
    if (persistResult.persisted) {
      showToast('口令正确，已解锁受限标签');
    } else {
      console.warn(`[${SCRIPT_NAME}] 写入角色变量失败，已降级为会话态解锁`, persistResult.error);
      showToast('口令正确，已解锁（变量接口不可用，仅本次会话生效）');
    }

    const currentTab = $modal.find('.gal-tab-btn.active').data('tab') || activeTab || 'sprites';
    $modal.remove();
    $(topWindow.document).off('.galMenus').off('.galImportMenu').off('.galPackMenu');
    showAssetManagerModal(currentTab);
  });

  // 自定义HTML保存
  $modal.find('#gal-save-custom-html').on('click', async function () {
    const locHtml = $('#gal-custom-location-html').val();
    const timeHtml = $('#gal-custom-time-html').val();
    const locationIconClass = normalizeLocationStatusIconClass($('#gal-custom-location-icon-class').val());
    const timeIconClass = normalizeTimeStatusIconClass($('#gal-custom-time-icon-class').val());
    localStorage.setItem(CUSTOM_LOCATION_HTML_KEY, locHtml);
    localStorage.setItem(CUSTOM_TIME_HTML_KEY, timeHtml);
    localStorage.setItem(CUSTOM_LOCATION_ICON_CLASS_KEY, locationIconClass);
    localStorage.setItem(CUSTOM_TIME_ICON_CLASS_KEY, timeIconClass);

    const $locationIcon = $('#gal-location-popup-trigger .gal-status-popup-icon');
    const $timeIcon = $('#gal-time-popup-trigger .gal-status-popup-icon');
    if ($locationIcon.length) {
      $locationIcon.attr('class', `gal-status-popup-icon ${locationIconClass}`);
    }
    if ($timeIcon.length) {
      $timeIcon.attr('class', `gal-status-popup-icon ${timeIconClass}`);
    }

    const injected = await injectCOTToWorldbook();
    if (injected) {
      showToast('自定义配置已保存，并已同步到世界书');
    } else {
      showToast('自定义配置已保存，但世界书同步失败', 'warning');
    }
  });

  // 图标可视化选择（地点/时间）
  $modal.find('.gal-custom-icon-option').on('click', function () {
    const $btn = $(this);
    const target = String($btn.attr('data-target') || '').trim();
    const rawValue = String($btn.attr('data-value') || '').trim();
    if (!target || !rawValue) return;

    const normalized =
      target === 'time' ? normalizeTimeStatusIconClass(rawValue) : normalizeLocationStatusIconClass(rawValue);
    const inputId = target === 'time' ? '#gal-custom-time-icon-class' : '#gal-custom-location-icon-class';

    $modal.find(inputId).val(normalized);
    $modal.find(`.gal-custom-icon-option[data-target="${target}"]`).removeClass('active');
    $modal.find(`.gal-custom-icon-option[data-target="${target}"][data-value="${normalized}"]`).addClass('active');
  });

  // 指定 BGM 歌单保存
  $modal.find('#gal-save-bgm-whitelist').on('click', async function () {
    const rawText = String($('#gal-custom-bgm-list').val() || '');
    const whitelist = Array.from(
      new Set(
        rawText
          .split(/\r?\n/)
          .map(name => String(name || '').trim())
          .filter(Boolean),
      ),
    );
    settings.bgmWhitelist = whitelist;
    saveSettings();
    const injected = await injectCOTToWorldbook();
    if (injected) {
      if (whitelist.length > 0) {
        showToast(`指定BGM歌单已保存（${whitelist.length} 首），并已同步到世界书`);
      } else {
        showToast('已清空指定BGM歌单，并已同步到世界书');
      }
    } else {
      showToast('指定BGM歌单已保存，但世界书同步失败', 'warning');
    }
  });

  // 生图配置事件
  bindImageGenConfigEvents($modal, settings);
  bindCustomSkinEditorEvents($modal);
  bindOpeningEvents($modal);

  bindSpriteEvents($modal, activeTab);
  bindBackgroundEvents($modal, activeTab);
  bindSpecialCgEvents($modal, activeTab);
  bindSpecialCgRulesEvents($modal, activeTab);
  bindMapEvents($modal, activeTab);
  bindPackSelectorEvents($modal, activeTab);
  bindExportImportEvents($modal, activeTab);

  // 激活正确的 sub-tab（若目标 tab 被策略隐藏，自动回退到第一个可见 tab）
  const firstVisibleTab = String($modal.find('.gal-tab-btn').first().data('tab') || 'sprites');
  activeTab = String(activeTab || '').trim() || firstVisibleTab;
  if (!$modal.find(`.gal-tab-btn[data-tab="${activeTab}"]`).length) {
    activeTab = firstVisibleTab;
  }
  $modal.find('.gal-tab-btn').removeClass('active');
  $modal.find(`.gal-tab-btn[data-tab="${activeTab}"]`).addClass('active');
  $modal.find('.gal-tab-pane').hide();
  $modal.find(`.gal-tab-pane[data-pane="${activeTab}"]`).show();
}

// ============================================
// Tab 内容构建
// ============================================

function buildSpritesTab(activeTab, allSprites, charactersData) {
  return `
  <div class="gal-tab-pane ${activeTab === 'sprites' ? 'active' : ''}" data-pane="sprites" style="${activeTab !== 'sprites' ? 'display: none;' : ''}">
    <div class="gal-pane-header">
      <span class="gal-pane-stat">已保存 ${allSprites.length} 个立绘，共 ${charactersData.size} 个角色</span>
      <div class="gal-pane-actions">
        <button class="gal-action-btn gal-pane-btn purple" id="gal-batch-upload-btn"><i class="fa-solid fa-cloud-arrow-up"></i> <span>批量上传</span></button>
        <button class="gal-action-btn gal-pane-btn primary" id="gal-add-sprite-btn"><i class="fa-solid fa-plus"></i> <span>添加立绘</span></button>
        <button class="gal-action-btn gal-pane-btn teal" id="gal-manage-expressions-btn"><i class="fa-solid fa-face-smile"></i> <span>表情标签</span></button>
      </div>
    </div>
    ${
      charactersData.size === 0
        ? `<div style="text-align: center; padding: 40px; color: #999;"><i class="fa-solid fa-images" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i><p>暂无角色数据，请确保已加载数据库脚本或点击上方按钮添加</p></div>`
        : `<div class="gal-character-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 15px;">
          ${Array.from(charactersData.entries())
            .map(([charId, info]) => {
              const sprites = info.sprites;
              const defaultSprite = sprites.find(s => s.expression === '默认') || sprites[0];
              const avatarUrl = defaultSprite?.imageUrl
                ? defaultSprite.imageUrl
                : defaultSprite?.imageBlob
                  ? URL.createObjectURL(defaultSprite.imageBlob)
                  : '';
              const typeLabel =
                info.type && info.type !== '自定义'
                  ? `<span style="font-size: 0.7rem; background: ${THEME.accent}; color: ${THEME.dark}; padding: 1px 4px; border-radius: 3px; margin-left: 4px;">${info.type}</span>`
                  : '';
              return `
            <div class="gal-character-card" data-char="${charId}" style="cursor: pointer; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: all 0.2s; position: relative;">
              <div class="gal-character-avatar" style="aspect-ratio: 1 / 1; background: #f0f0f0; overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative;">
                ${avatarUrl ? `<img src="${avatarUrl}" alt="${charId}" style="width: 100%; height: 100%; object-fit: cover; object-position: top center;">` : `<i class="fa-solid fa-user" style="font-size: 3rem; color: #ccc;"></i>`}
                ${sprites.length === 0 ? '<div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.5); color: #fff; font-size: 0.7rem; padding: 2px; text-align: center;">无立绘</div>' : ''}
                <div class="gal-char-actions" style="position: absolute; top: 5px; right: 5px; display: flex; gap: 5px; opacity: 0; transition: opacity 0.2s;">
                  <button class="gal-char-transfer" data-char="${charId}" title="转移到其他图包" style="width: 28px; height: 28px; border-radius: 50%; border: none; background: rgba(111, 66, 193, 0.9); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px;"><i class="fa-solid fa-arrow-right-arrow-left"></i></button>
                  <button class="gal-char-delete" data-char="${charId}" title="删除角色" style="width: 28px; height: 28px; border-radius: 50%; border: none; background: rgba(220, 53, 69, 0.9); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px;"><i class="fa-solid fa-trash"></i></button>
                </div>
              </div>
              <div style="padding: 10px; text-align: center;">
                <div style="font-weight: 700; color: ${THEME.dark}; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; justify-content: center; align-items: center;">${charId}</div>
                <div style="margin-top: 4px; display: flex; justify-content: center; align-items: center; gap: 4px;">${typeLabel}<span style="font-size: 0.75rem; color: #888;">${sprites.length} 个表情</span></div>
              </div>
            </div>`;
            })
            .join('')}
        </div>`
    }
  </div>`;
}

function buildBackgroundsTab(settings, allBackgrounds, hiddenTitleBackgroundCount = 0) {
  return `
  <div class="gal-tab-pane" data-pane="backgrounds" style="display: none;">
    <div class="gal-pane-header">
      <span class="gal-pane-stat">已保存 ${allBackgrounds.length} 个背景${hiddenTitleBackgroundCount > 0 ? `（已隐藏标题背景 ${hiddenTitleBackgroundCount} 项）` : ''}</span>
      <div class="gal-pane-actions">
        <button class="gal-action-btn gal-pane-btn purple" id="gal-batch-bg-upload-btn"><i class="fa-solid fa-cloud-arrow-up"></i> <span>批量上传</span></button>
        <button class="gal-action-btn gal-pane-btn primary" id="gal-add-bg-btn"><i class="fa-solid fa-plus"></i> <span>添加背景</span></button>
      </div>
    </div>
    ${
      allBackgrounds.length === 0
        ? `<div style="text-align: center; padding: 40px; color: #999;"><i class="fa-solid fa-panorama" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i><p>暂无背景，点击上方按钮添加</p><small style="color: #bbb;">背景图将根据 &lt;background scene="场景名" /&gt; 标签自动匹配</small></div>`
        : `<div class="gal-bg-grid">${allBackgrounds
            .map(
              bg => `
          <div class="gal-bg-card" data-scene="${bg.sceneName}">
            <div class="gal-bg-preview">${bg.imageUrl ? `<img src="${bg.imageUrl}" alt="${bg.sceneName}">` : bg.imageBlob ? `<img src="${URL.createObjectURL(bg.imageBlob)}" alt="${bg.sceneName}">` : ''}</div>
            <div class="gal-bg-label">${bg.sceneName}</div>
            <div class="gal-bg-actions" style="position: absolute; top: 5px; right: 5px; display: flex; gap: 4px;">
              <button class="gal-bg-transfer" data-scene="${bg.sceneName}" title="转移到其他图包" style="width: 28px; height: 28px; border-radius: 50%; background: rgba(111, 66, 193, 0.9); color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;"><i class="fa-solid fa-arrow-right-arrow-left"></i></button>
              <button class="gal-bg-delete" data-scene="${bg.sceneName}" title="删除" style="width: 28px; height: 28px; border-radius: 50%; background: rgba(220, 53, 69, 0.9); color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>`,
            )
            .join('')}</div>`
    }
  </div>`;
}

function buildTitleScreenTab(activeTab, titleScreen, currentCharId) {
  const safeTitleScreen = titleScreen && typeof titleScreen === 'object' ? titleScreen : {};
  const safeCharName = String(currentCharId || '').trim() || 'default';
  const selectedBgSource = safeTitleScreen.backgroundSource === 'url'
    ? 'url'
    : (
        safeTitleScreen.backgroundSource === 'upload'
          ? 'upload'
          : (String(safeTitleScreen.backgroundUrl || '').trim() ? 'url' : 'upload')
      );

  return `
  <div class="gal-tab-pane" data-pane="title-screen" style="${activeTab !== 'title-screen' ? 'display: none;' : ''}">
    <div class="gal-settings-section">
      <div class="gal-settings-section-title"><i class="fa-solid fa-house"></i> 标题界面</div>
      <div style="font-size: 0.8rem; color: #666; margin: -6px 0 8px 0;">
        当前角色卡独立配置（角色卡名: ${escapeHtml(safeCharName)}）
      </div>
      <div class="gal-settings-row">
        <span class="gal-settings-label">启用标题界面</span>
        <label class="gal-switch"><input type="checkbox" id="gal-title-enabled" ${safeTitleScreen.enabled ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
      </div>
      <div class="gal-settings-row">
        <span class="gal-settings-label">标题文字</span>
        <input type="text" id="gal-title-text" class="gal-title-settings-input" value="${escapeHtml(safeTitleScreen.titleText || '')}" placeholder="例如：夏日物语">
      </div>
      <div class="gal-settings-row">
        <span class="gal-settings-label">标题字体</span>
        <input type="text" id="gal-title-font-family" class="gal-title-settings-input" value="${escapeHtml(safeTitleScreen.titleFontFamily || '')}" placeholder="例如：'Noto Serif SC', serif">
      </div>
      <div class="gal-settings-row">
        <span class="gal-settings-label">标题字号(px，默认最大 104)</span>
        <input type="number" id="gal-title-font-size" class="gal-title-settings-input" value="${escapeHtml(safeTitleScreen.titleFontSize ?? '')}" min="8" max="240" step="1" placeholder="留空使用默认最大 104px（自适应）">
      </div>
      <div class="gal-settings-row">
        <span class="gal-settings-label">副标题</span>
        <input type="text" id="gal-title-subtitle" class="gal-title-settings-input" value="${escapeHtml(safeTitleScreen.subtitleText || '')}" placeholder="例如：按下开始继续">
      </div>
      <div class="gal-settings-row">
        <span class="gal-settings-label">副标题字体</span>
        <input type="text" id="gal-title-subtitle-font-family" class="gal-title-settings-input" value="${escapeHtml(safeTitleScreen.subtitleFontFamily || '')}" placeholder="例如：'Noto Sans SC', sans-serif">
      </div>
      <div class="gal-settings-row">
        <span class="gal-settings-label">副标题字号(px，默认最大 20.8)</span>
        <input type="number" id="gal-title-subtitle-font-size" class="gal-title-settings-input" value="${escapeHtml(safeTitleScreen.subtitleFontSize ?? '')}" min="8" max="240" step="1" placeholder="留空使用默认最大 20.8px（自适应）">
      </div>
      <div class="gal-settings-row">
        <span class="gal-settings-label">背景来源</span>
        <select id="gal-title-bg-source" class="gal-title-settings-select">
          <option value="upload" ${selectedBgSource === 'upload' ? 'selected' : ''}>上传图片</option>
          <option value="url" ${selectedBgSource === 'url' ? 'selected' : ''}>背景URL</option>
        </select>
      </div>
      <div style="margin: -6px 0 4px 0; color: var(--SmartThemeBodyColor, #475569); opacity: 0.9; font-size: 0.8rem;">
        二选一：通过下拉切换。当前仅显示所选模式的配置项。
      </div>
      <div class="gal-settings-row">
        <span class="gal-settings-label">背景填充模式</span>
        <select id="gal-title-bg-fit" class="gal-title-settings-select">
          <option value="cover" ${safeTitleScreen.backgroundFit === 'cover' ? 'selected' : ''}>Cover（铺满裁剪）</option>
          <option value="contain" ${safeTitleScreen.backgroundFit === 'contain' ? 'selected' : ''}>Contain（完整显示）</option>
        </select>
      </div>
      <div class="gal-settings-row">
        <span class="gal-settings-label">遮罩层</span>
        <label class="gal-switch"><input type="checkbox" id="gal-title-mask-enabled" ${safeTitleScreen.enableBackdropMask !== false ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
      </div>
      <div class="gal-settings-row" id="gal-title-bg-upload-row" style="align-items: flex-start;">
        <span class="gal-settings-label">上传标题背景</span>
        <div class="gal-settings-control" style="flex-direction: column; align-items: stretch; width: min(100%, 460px); gap: 8px;">
          <input type="file" id="gal-title-bg-file" accept="image/*" style="display:none;">
          <button class="gal-action-btn" id="gal-title-bg-upload-btn" style="justify-content:center; min-width: 220px;">
            <i class="fa-solid fa-image"></i> 上传图片（支持 gif/webp）
          </button>
          <small id="gal-title-bg-upload-hint" style="color: var(--SmartThemeBodyColor, #f5f7fa); opacity: 0.82;">上传后将保存到当前角色卡标题背景（scene: ${escapeHtml(safeTitleScreen.backgroundSceneName || '__title__')}）</small>
        </div>
      </div>
      <div class="gal-settings-row" id="gal-title-bg-url-row">
        <span class="gal-settings-label">背景URL</span>
        <input type="url" id="gal-title-bg-url" class="gal-title-settings-input" value="${escapeHtml(safeTitleScreen.backgroundUrl || '')}" placeholder="https://example.com/title.webp">
      </div>
    </div>
  </div>`;
}

function buildSpecialCgsTab(activeTab, allSpecialCgs) {
  return `
  <div class="gal-tab-pane" data-pane="special-cgs" style="${activeTab !== 'special-cgs' ? 'display: none;' : ''}">
    <div class="gal-pane-header">
      <span class="gal-pane-stat">已保存 ${allSpecialCgs.length} 张特殊CG</span>
      <div class="gal-pane-actions">
        <button class="gal-action-btn gal-pane-btn purple" id="gal-batch-special-cg-upload-btn"><i class="fa-solid fa-cloud-arrow-up"></i> <span>批量上传</span></button>
        <button class="gal-action-btn gal-pane-btn primary" id="gal-add-special-cg-btn"><i class="fa-solid fa-plus"></i> <span>添加CG</span></button>
      </div>
    </div>
    ${
      allSpecialCgs.length === 0
        ? `<div style="text-align: center; padding: 40px; color: #999;"><i class="fa-solid fa-photo-film" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i><p>暂无特殊CG资源，点击上方按钮上传</p></div>`
        : `<div class="gal-special-cg-grid">${allSpecialCgs
            .map(item => {
              const cgId = String(item.cgId || item.id || '').trim();
              const name = String(item.name || cgId || '未命名CG').trim();
              const preview = item.imageUrl
                ? item.imageUrl
                : (item.imageBlob ? URL.createObjectURL(item.imageBlob) : '');
              return `
          <div class="gal-special-cg-card" data-cg-id="${escapeHtml(cgId)}">
            <div class="gal-special-cg-preview">${preview ? `<img src="${preview}" alt="${escapeHtml(name)}">` : '<span>无预览</span>'}</div>
            <div class="gal-special-cg-name">${escapeHtml(name)}</div>
            <div class="gal-special-cg-id">${escapeHtml(cgId)}</div>
            <div class="gal-special-cg-actions">
              <button class="gal-special-cg-transfer" data-cg-id="${escapeHtml(cgId)}" title="转移到其他图包"><i class="fa-solid fa-arrow-right-arrow-left"></i></button>
              <button class="gal-special-cg-delete" data-cg-id="${escapeHtml(cgId)}" title="删除"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>`;
            })
            .join('')}</div>`
    }
  </div>`;
}

function buildSpecialCgRuleRowHtml(rule, cgOptionsHtml, index = 0) {
  const safeRule = rule && typeof rule === 'object' ? rule : {};
  const id = String(safeRule.id || '').trim() || `special_cg_rule_${Date.now()}_${index}`;
  const name = String(safeRule.name || '').trim();
  const variablePath = String(safeRule.variablePath || '').trim().replace(/^stat_data\./, '');
  const operator = String(safeRule.operator || 'gte').trim().toLowerCase();
  const threshold = Number.isFinite(Number(safeRule.threshold)) ? Number(safeRule.threshold) : 0;
  const priority = Number.isFinite(Number(safeRule.priority)) ? Number(safeRule.priority) : 0;
  const cgId = String(safeRule.cgId || '').trim();
  const enabled = safeRule.enabled !== false;

  return `
    <div class="gal-special-cg-rule-row" data-rule-id="${escapeHtml(id)}">
      <input type="text" class="gal-special-cg-rule-name" value="${escapeHtml(name)}" placeholder="规则名（必填）" required title="规则名必填">
      <input type="text" class="gal-special-cg-rule-path" list="${SPECIAL_CG_VAR_PATH_DATALIST_ID}" value="${escapeHtml(variablePath)}" placeholder="变量路径，如：角色.艾莉.好感度" autocomplete="off">
      <span class="gal-special-cg-rule-current-value is-empty" title="当前值：未读取">未读取</span>
      <select class="gal-special-cg-rule-operator">
        <option value="gte" ${operator === 'gte' ? 'selected' : ''}>≥</option>
        <option value="gt" ${operator === 'gt' ? 'selected' : ''}>&gt;</option>
        <option value="eq" ${operator === 'eq' ? 'selected' : ''}>=</option>
        <option value="lte" ${operator === 'lte' ? 'selected' : ''}>≤</option>
        <option value="lt" ${operator === 'lt' ? 'selected' : ''}>&lt;</option>
      </select>
      <input type="number" class="gal-special-cg-rule-threshold" value="${threshold}" step="any">
      <select class="gal-special-cg-rule-cg-id">
        ${cgOptionsHtml}
      </select>
      <input type="number" class="gal-special-cg-rule-priority" value="${priority}" step="1">
      <label class="gal-special-cg-rule-enabled-wrap"><input type="checkbox" class="gal-special-cg-rule-enabled" ${enabled ? 'checked' : ''}>启用</label>
      <button class="gal-special-cg-rule-remove" title="删除规则"><i class="fa-solid fa-trash"></i></button>
      <input type="hidden" class="gal-special-cg-rule-id" value="${escapeHtml(id)}">
      <input type="hidden" class="gal-special-cg-rule-once" value="true">
      <input type="hidden" class="gal-special-cg-rule-current-cg-id" value="${escapeHtml(cgId)}">
    </div>
  `;
}

function buildSpecialCgRulesTab(activeTab, specialCgSettings, allSpecialCgs, mvuVariablePaths = []) {
  const safeSpecialCgSettings = specialCgSettings && typeof specialCgSettings === 'object'
    ? specialCgSettings
    : { enabled: false, rules: [] };
  const allRules = Array.isArray(safeSpecialCgSettings.rules) ? safeSpecialCgSettings.rules : [];
  const safeCgs = Array.isArray(allSpecialCgs) ? allSpecialCgs : [];
  const safeVariablePaths = Array.isArray(mvuVariablePaths) ? mvuVariablePaths : [];
  const variablePathOptionsHtml = buildVariablePathOptionsHtml(safeVariablePaths);
  const cgOptions = safeCgs
    .map(item => {
      const cgId = String(item.cgId || item.id || '').trim();
      const cgName = String(item.name || cgId).trim();
      return `<option value="${escapeHtml(cgId)}">${escapeHtml(`${cgName} (${cgId})`)}</option>`;
    })
    .join('');
  const cgOptionsHtml = `<option value="">选择CG资源</option>${cgOptions}`;

  const rowsHtml = allRules.length > 0
    ? allRules.map((rule, index) => buildSpecialCgRuleRowHtml(rule, cgOptionsHtml, index)).join('')
    : '';

  return `
  <div class="gal-tab-pane" data-pane="special-cg-rules" style="${activeTab !== 'special-cg-rules' ? 'display: none;' : ''}">
    <div class="gal-pane-header">
      <span class="gal-pane-stat">MVU 事件触发特殊CG</span>
      <div class="gal-pane-actions">
        <button class="gal-action-btn gal-pane-btn teal" id="gal-special-cg-rule-add-btn"><i class="fa-solid fa-plus"></i> <span>新增规则</span></button>
        <button class="gal-action-btn gal-pane-btn primary" id="gal-special-cg-rule-save-btn"><i class="fa-solid fa-save"></i> <span>保存规则</span></button>
      </div>
    </div>
    <div class="gal-special-cg-rules-panel">
      <label class="gal-special-cg-master-switch">
        <input type="checkbox" id="gal-special-cg-enabled" ${safeSpecialCgSettings.enabled ? 'checked' : ''}>
        <span>启用特殊CG触发系统</span>
      </label>
      <div class="gal-special-cg-path-tools">
        <button class="gal-action-btn gal-pane-btn" id="gal-special-cg-load-mvu-vars-btn">
          <i class="fa-solid fa-arrows-rotate"></i> <span>读取MVU变量</span>
        </button>
        <span class="gal-special-cg-path-count" id="gal-special-cg-var-count" data-count="${safeVariablePaths.length}">
          ${safeVariablePaths.length > 0 ? `已加载 ${safeVariablePaths.length} 项变量路径` : '尚未加载MVU变量路径'}
        </span>
      </div>
      <div class="gal-special-cg-rules-hint">规则名为必填项。建议填写简短事件名，如：生日告白。规则变量路径相对 <code>stat_data</code>，例如：<code>角色.艾莉.好感度</code>。同一聊天仅触发一次。</div>
      <div class="gal-special-cg-rules-header">
        <span>规则名</span>
        <span>变量路径</span>
        <span>当前值</span>
        <span>条件</span>
        <span>阈值</span>
        <span>目标CG</span>
        <span>优先级</span>
        <span>状态</span>
        <span>操作</span>
      </div>
      <div id="gal-special-cg-rules-list">
        ${rowsHtml}
      </div>
      <datalist id="${SPECIAL_CG_VAR_PATH_DATALIST_ID}">${variablePathOptionsHtml}</datalist>
      ${safeCgs.length === 0 ? '<div class="gal-special-cg-empty-hint">请先在“CG管理”中上传CG资源，否则规则无法生效。</div>' : ''}
      <input type="hidden" id="gal-special-cg-options-template" value="${escapeHtml(cgOptionsHtml)}">
    </div>
  </div>`;
}

function buildMapsTab(activeTab, unifiedMapRecord, legacyMapCount = 0) {
  const hasMap = !!unifiedMapRecord;
  const recordRegionKey = hasMap
    ? (String(unifiedMapRecord.regionKey || '').trim() || GLOBAL_MAP_REGION_KEY)
    : GLOBAL_MAP_REGION_KEY;
  const sourceType = hasMap
    ? (unifiedMapRecord.imageBlob ? '本地图片' : (unifiedMapRecord.imageUrl ? '远程链接' : '未知来源'))
    : '未设置';
  const thumbUrl = hasMap
    ? (unifiedMapRecord.imageUrl
      ? unifiedMapRecord.imageUrl
      : (unifiedMapRecord.imageBlob ? URL.createObjectURL(unifiedMapRecord.imageBlob) : ''))
    : '';
  const modifiedText = hasMap && unifiedMapRecord.lastModified
    ? new Date(unifiedMapRecord.lastModified).toLocaleString()
    : '未知';
  const isLegacyFallback = hasMap && recordRegionKey !== GLOBAL_MAP_REGION_KEY;

  return `
  <div class="gal-tab-pane" data-pane="maps" style="${activeTab !== 'maps' ? 'display: none;' : ''}">
    <div class="gal-pane-header">
      <span class="gal-pane-stat">统一世界地图</span>
      <div class="gal-pane-actions">
        <button class="gal-action-btn gal-pane-btn primary" id="gal-add-map-btn"><i class="fa-solid fa-plus"></i> <span>上传地图</span></button>
      </div>
    </div>
    ${
      !hasMap
        ? `<div style="text-align: center; padding: 40px; color: #999;"><i class="fa-solid fa-map-location-dot" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i><p>尚未上传统一世界地图</p><small style="color: #bbb;">地图系统将使用一张统一大地图，不再按场景分别上传</small></div>`
        : `<div class="gal-map-grid">
            <div class="gal-map-card" data-region="${recordRegionKey}" data-pack-id="${unifiedMapRecord.packId || DEFAULT_PACK_ID}">
              <div class="gal-map-card-preview">
                ${thumbUrl ? `<img src="${thumbUrl}" alt="统一世界地图">` : `<i class="fa-solid fa-image"></i>`}
              </div>
              <div class="gal-map-card-body">
                <div class="gal-map-card-title">统一世界地图</div>
                <div class="gal-map-card-meta">
                  <span><i class="fa-solid fa-link"></i> ${sourceType}</span>
                  <span><i class="fa-solid fa-clock"></i> ${modifiedText}</span>
                  ${isLegacyFallback ? `<span style="color:#b45309;"><i class="fa-solid fa-triangle-exclamation"></i> 兼容读取旧记录：${recordRegionKey}</span>` : ''}
                  ${legacyMapCount > 0 ? `<span style="color:#b45309;"><i class="fa-solid fa-layer-group"></i> 检测到 ${legacyMapCount} 条旧分区地图记录</span>` : ''}
                </div>
              </div>
              <div class="gal-map-card-actions">
                <button class="gal-map-open-btn" data-region="${recordRegionKey}" title="打开地图"><i class="fa-solid fa-compass"></i></button>
                <button class="gal-map-delete-btn" data-region="${recordRegionKey}" data-pack-id="${unifiedMapRecord.packId || DEFAULT_PACK_ID}" title="删除地图"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          </div>`
    }
  </div>`;
}

function buildImagegenTab(activeTab, settings) {
  return `
  <div class="gal-tab-pane" data-pane="imagegen" style="${activeTab !== 'imagegen' ? 'display: none;' : ''}">
    ${buildImageGenConfigPane(settings)}
  </div>`;
}

function buildOpeningTab(activeTab) {
  return `
  <div class="gal-tab-pane" data-pane="opening" style="${activeTab !== 'opening' ? 'display: none;' : ''}">
    <div class="gal-opening-layout">
      <div class="gal-opening-column">
        <div class="gal-opening-title">
          <i class="fa-solid fa-file-lines" style="color: ${THEME.accentSub};"></i> 原文输入
        </div>
        <textarea
          id="gal-opening-source"
          class="gal-opening-textarea"
          placeholder="在这里粘贴或输入开场白原文..."
        ></textarea>
      </div>
      <div class="gal-opening-column">
        <div class="gal-opening-title">
          <i class="fa-solid fa-wand-magic-sparkles" style="color: ${THEME.accent};"></i> COT 转换结果
        </div>
        <textarea
          id="gal-opening-result"
          class="gal-opening-textarea"
          placeholder="点击“转换”后将在这里显示 COT 格式结果（可手动微调）..."
        ></textarea>
      </div>
    </div>
    <div class="gal-opening-actions">
      <button class="gal-action-btn gal-pane-btn primary" id="gal-opening-convert-btn">
        <i class="fa-solid fa-arrows-rotate"></i> <span>转换</span>
      </button>
      <button class="gal-action-btn gal-pane-btn teal" id="gal-opening-copy-btn">
        <i class="fa-solid fa-copy"></i> <span>复制结果</span>
      </button>
      <button class="gal-action-btn gal-pane-btn purple" id="gal-opening-write-btn">
        <i class="fa-solid fa-pen-to-square"></i> <span>写入开场白</span>
      </button>
    </div>
    <div class="gal-opening-hint">
      <strong><i class="fa-solid fa-circle-info"></i> 说明：</strong>
      仅做格式转换，不会改写剧情；点击“写入开场白”后会覆盖当前角色卡首条开场白，其余条目保留。
    </div>
  </div>`;
}

function buildBgmTab(activeTab, settings) {
  const bgmWhitelist = Array.from(
    new Set(
      (Array.isArray(settings.bgmWhitelist) ? settings.bgmWhitelist : [])
        .map(name => String(name || '').trim())
        .filter(Boolean),
    ),
  );
  const bgmText = escapeHtml(bgmWhitelist.join('\n'));

  return `
  <div class="gal-tab-pane" data-pane="bgm" style="${activeTab !== 'bgm' ? 'display: none;' : ''}">
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px dashed #ddd; margin-bottom: 20px;">
      <div style="margin-bottom: 15px;">
        <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};">
          <i class="fa-solid fa-music" style="color: ${THEME.accent};"></i> 指定BGM歌单（注入到COT规则）
        </label>
        <textarea
          id="gal-custom-bgm-list"
          placeholder="每行填写一首歌曲名，例如：&#10;夜に駆ける&#10;unravel&#10;打上花火"
          style="width: 100%; height: 220px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 0.9rem; color: #333; resize: vertical;"
        >${bgmText}</textarea>
      </div>
      <div style="text-align: right;">
        <button class="gal-action-btn primary" id="gal-save-bgm-whitelist" style="padding: 8px 20px;">
          <i class="fa-solid fa-save"></i> 保存歌单
        </button>
      </div>
    </div>
    <div style="padding: 15px; color: #666; font-size: 0.9rem; line-height: 1.7;">
      <strong><i class="fa-solid fa-lightbulb"></i> 说明：</strong><br>
      1. 每行一首歌，保存后会更新 COT：模型只能从该歌单中输出 <code>&lt;bgm&gt;</code>。<br>
      2. 留空并保存则取消限制，恢复原有通用 BGM 规则。<br>
      3. 建议填写你确认可搜索到的曲名（尽量完整、标准）。
    </div>
  </div>`;
}

function buildCustomTab(settings) {
  const locationHtml = escapeHtml(localStorage.getItem(CUSTOM_LOCATION_HTML_KEY) || '');
  const timeHtml = escapeHtml(localStorage.getItem(CUSTOM_TIME_HTML_KEY) || '');
  const locationIconClass = normalizeLocationStatusIconClass(
    localStorage.getItem(CUSTOM_LOCATION_ICON_CLASS_KEY) || '',
  );
  const timeIconClass = normalizeTimeStatusIconClass(localStorage.getItem(CUSTOM_TIME_ICON_CLASS_KEY) || '');
  const locationIconOptionsHtml = LOCATION_STATUS_ICON_OPTIONS.map(
    option =>
      `<button type="button" class="gal-custom-icon-option ${option.value === locationIconClass ? 'active' : ''}" data-target="location" data-value="${option.value}" title="${option.label}">
      <i class="${option.value}"></i>
      <span>${option.label}</span>
    </button>`,
  ).join('');
  const timeIconOptionsHtml = TIME_STATUS_ICON_OPTIONS.map(
    option =>
      `<button type="button" class="gal-custom-icon-option ${option.value === timeIconClass ? 'active' : ''}" data-target="time" data-value="${option.value}" title="${option.label}">
      <i class="${option.value}"></i>
      <span>${option.label}</span>
    </button>`,
  ).join('');

  return `
  <div class="gal-tab-pane" data-pane="custom" style="display: none;">
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px dashed #ddd; margin-bottom: 20px;">
      <div style="margin-bottom: 15px;"><label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};"><i class="fa-solid fa-location-dot" style="color: ${THEME.accent};"></i> 自定义弹窗一内容 - 自定义内容格式要求（注入到世界书）</label><textarea id="gal-custom-location-html" placeholder="<div>自定义地点介绍...</div>" style="width: 100%; height: 120px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 0.9rem; color: #333; resize: vertical;">${locationHtml}</textarea></div>
      <div style="margin-bottom: 15px;"><label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};"><i class="fa-solid fa-clock" style="color: ${THEME.accentSub};"></i> 自定义弹窗二内容 - 自定义内容格式要求（注入到世界书）</label><textarea id="gal-custom-time-html" placeholder="<div>自定义时间介绍...</div>" style="width: 100%; height: 120px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 0.9rem; color: #333; resize: vertical;">${timeHtml}</textarea></div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px;">
        <div>
          <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};"><i class="fa-solid fa-location-dot" style="color: ${THEME.accent};"></i> 弹窗一图标</label>
          <input id="gal-custom-location-icon-class" type="hidden" value="${locationIconClass}">
          <div class="gal-custom-icon-grid">
            ${locationIconOptionsHtml}
          </div>
        </div>
        <div>
          <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};"><i class="fa-solid fa-clock" style="color: ${THEME.accentSub};"></i> 弹窗二图标</label>
          <input id="gal-custom-time-icon-class" type="hidden" value="${timeIconClass}">
          <div class="gal-custom-icon-grid">
            ${timeIconOptionsHtml}
          </div>
        </div>
      </div>
      <div style="text-align: right;"><button class="gal-action-btn primary" id="gal-save-custom-html" style="padding: 8px 20px;"><i class="fa-solid fa-save"></i> 保存配置</button></div>
    </div>
    <div style="padding: 15px; color: #666; font-size: 0.9rem; line-height: 1.7;"><strong><i class="fa-solid fa-lightbulb"></i> 说明：</strong><br>1. 保存后，若填写了内容，会自动同步到世界书并注入兼容标签：<br><code>&lt;弹窗一&gt;...&lt;/弹窗一&gt;</code><br><code>&lt;弹窗二&gt;...&lt;/弹窗二&gt;</code><br>2. 右侧图标弹窗只读取当前消息中的标签内容，不再直接显示这里输入的备用内容。<br>3. 支持标准 HTML 和内联样式，建议保持简洁，不要放脚本标签。</div>
  </div>`;
}

export function buildAssetManagerStyles() {
  return `
    .gal-tab-btn { padding: 12px 20px; border: none; background: transparent; font-size: 1rem; font-weight: 600; color: #666; cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -2px; transition: all 0.2s; }
    .gal-tab-btn:hover { color: ${THEME.accent}; }
    .gal-tab-btn.active { color: ${THEME.accent}; border-bottom-color: ${THEME.accent}; }
    .gal-character-card:hover { transform: translateY(-3px); box-shadow: 0 6px 16px rgba(0,0,0,0.15); }
    .gal-character-card:hover .gal-char-actions { opacity: 1 !important; }
    @media (max-width: 768px), (pointer: coarse) { .gal-char-actions { opacity: 1 !important; } }
    .gal-sprite-group { margin-bottom: 20px; background: #f8f9fa; border-radius: 8px; padding: 15px; }
    .gal-sprite-group-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .gal-char-name { font-weight: 700; font-size: 1.1rem; color: ${THEME.dark}; }
    .gal-sprite-count { font-size: 0.85rem; color: #888; }
    .gal-sprite-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 12px; }
    .gal-sprite-card { position: relative; background: #fff; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.1); transition: transform 0.2s; }
    .gal-sprite-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .gal-sprite-preview { aspect-ratio: 2 / 3; background: #eee; overflow: hidden; }
    .gal-sprite-preview img { width: 100%; height: 100%; object-fit: cover; }
    .gal-sprite-label { padding: 6px; text-align: center; font-size: 0.75rem; font-weight: 600; color: ${THEME.dark}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .gal-sprite-delete { position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; border: none; border-radius: 50%; background: rgba(255,0,85,0.9); color: #fff; font-size: 0.7rem; cursor: pointer; opacity: 0; transition: opacity 0.2s; }
    .gal-sprite-card:hover .gal-sprite-delete { opacity: 1; }
    .gal-bg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 15px; }
    .gal-bg-card { position: relative; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s; cursor: pointer; }
    .gal-bg-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
    .gal-bg-preview { aspect-ratio: 16 / 9; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); overflow: hidden; }
    .gal-bg-preview img { width: 100%; height: 100%; object-fit: cover; }
    .gal-bg-label { padding: 10px; text-align: center; font-size: 0.9rem; font-weight: 600; color: ${THEME.dark}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .gal-bg-actions { opacity: 0; transition: opacity 0.2s; }
    .gal-bg-card:hover .gal-bg-actions { opacity: 1; }
    .gal-special-cg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 14px; }
    .gal-special-cg-card { position: relative; border: 1px solid #dbe2ea; border-radius: 10px; overflow: hidden; background: #fff; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08); transition: all 0.2s; cursor: pointer; }
    .gal-special-cg-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(15, 23, 42, 0.15); }
    .gal-special-cg-preview { aspect-ratio: 16 / 9; background: linear-gradient(135deg, #0f172a, #1e293b); display: flex; align-items: center; justify-content: center; color: #94a3b8; overflow: hidden; }
    .gal-special-cg-preview img { width: 100%; height: 100%; object-fit: cover; }
    .gal-special-cg-name { padding: 8px 10px 0; font-size: 0.88rem; font-weight: 700; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .gal-special-cg-id { padding: 2px 10px 10px; font-size: 0.76rem; color: #64748b; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .gal-special-cg-actions { position: absolute; top: 6px; right: 6px; display: flex; gap: 6px; opacity: 0; transition: opacity 0.2s; }
    .gal-special-cg-card:hover .gal-special-cg-actions { opacity: 1; }
    .gal-special-cg-transfer, .gal-special-cg-delete { width: 30px; height: 30px; border: none; border-radius: 50%; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: #fff; }
    .gal-special-cg-transfer { background: rgba(111, 66, 193, 0.95); }
    .gal-special-cg-delete { background: rgba(220, 53, 69, 0.95); }
    .gal-special-cg-rules-panel { border: 1px solid #dbe2ea; border-radius: 10px; background: #fff; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
    .gal-special-cg-master-switch { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; color: #0f172a; }
    .gal-special-cg-path-tools { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .gal-special-cg-path-tools #gal-special-cg-load-mvu-vars-btn { padding: 6px 12px !important; min-height: 34px; font-size: 0.82rem !important; }
    .gal-special-cg-path-count { font-size: 0.8rem; color: #64748b; }
    .gal-special-cg-rules-hint { color: #475569; font-size: 0.82rem; }
    .gal-special-cg-rules-header { display: grid; grid-template-columns: 1fr 1.7fr 1.2fr 70px 90px 1.2fr 80px 80px 48px; gap: 8px; font-size: 0.75rem; font-weight: 700; color: #334155; padding: 0 4px; }
    #gal-special-cg-rules-list { display: flex; flex-direction: column; gap: 8px; }
    .gal-special-cg-rule-row { display: grid; grid-template-columns: 1fr 1.7fr 1.2fr 70px 90px 1.2fr 80px 80px 48px; gap: 8px; align-items: center; }
    .gal-special-cg-rule-row input[type='text'],
    .gal-special-cg-rule-row input[type='number'],
    .gal-special-cg-rule-row select { width: 100%; min-height: 34px; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px; background: #fff; color: #0f172a; }
    .gal-special-cg-rule-name.is-invalid { border-color: #dc2626 !important; box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.2); background: #fff7f7; }
    .gal-special-cg-rule-current-value { min-height: 34px; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px; background: #f8fafc; color: #0f172a; display: inline-flex; align-items: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.82rem; }
    .gal-special-cg-rule-current-value.is-empty { color: #64748b; }
    .gal-special-cg-rule-enabled-wrap { display: inline-flex; align-items: center; gap: 6px; color: #334155; font-size: 0.82rem; }
    .gal-special-cg-rule-remove { width: 34px; height: 34px; border: none; border-radius: 6px; cursor: pointer; background: rgba(220, 53, 69, 0.95); color: #fff; }
    .gal-special-cg-empty-hint { font-size: 0.82rem; color: #92400e; padding: 8px 10px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; }
    .gal-map-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
    .gal-map-card { position: relative; border: 1px solid #dbe2ea; border-radius: 10px; overflow: hidden; background: #fff; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08); transition: all 0.2s; cursor: pointer; }
    .gal-map-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(15, 23, 42, 0.15); }
    .gal-map-card-preview { aspect-ratio: 16 / 9; background: linear-gradient(135deg, #0f172a, #1e293b); display: flex; align-items: center; justify-content: center; overflow: hidden; color: #94a3b8; font-size: 1.8rem; }
    .gal-map-card-preview img { width: 100%; height: 100%; object-fit: cover; }
    .gal-map-card-body { padding: 10px; }
    .gal-map-card-title { font-size: 0.92rem; font-weight: 700; color: #0f172a; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .gal-map-card-meta { display: flex; flex-direction: column; gap: 4px; font-size: 0.76rem; color: #64748b; }
    .gal-map-card-meta span { display: inline-flex; align-items: center; gap: 6px; }
    .gal-map-card-actions { position: absolute; top: 6px; right: 6px; display: flex; gap: 6px; opacity: 0; transition: opacity 0.2s; }
    .gal-map-card:hover .gal-map-card-actions { opacity: 1; }
    .gal-map-open-btn, .gal-map-delete-btn { width: 30px; height: 30px; border: none; border-radius: 50%; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: #fff; }
    .gal-map-open-btn { background: rgba(14, 165, 233, 0.95); }
    .gal-map-delete-btn { background: rgba(220, 53, 69, 0.95); }
    .gal-import-dropdown { position: relative; display: inline-block; }
    .gal-import-menu { animation: galDropdownFadeIn 0.15s ease; }
    @keyframes galDropdownFadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
    .gal-import-item:hover { background: #f0f7ff !important; }
    .gal-import-item:active { background: #e0efff !important; }
    .gal-import-progress-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; }
    .gal-import-progress-box { background: #2b2e38; padding: 30px 50px; border-radius: 12px; text-align: center; min-width: 300px; }
    .gal-import-progress-title { font-size: 1.2rem; font-weight: 700; margin-bottom: 15px; color: #00d2ff; }
    .gal-import-progress-bar-container { width: 100%; height: 8px; background: #444; border-radius: 4px; overflow: hidden; margin-bottom: 10px; }
    .gal-import-progress-bar { height: 100%; background: linear-gradient(90deg, #00d2ff, #00a8cc); width: 0%; transition: width 0.3s ease; }
    .gal-import-progress-text { font-size: 0.9rem; color: #aaa; }
    .gal-import-progress-details { font-size: 0.8rem; color: #888; margin-top: 8px; max-height: 60px; overflow-y: auto; }
    .gal-pane-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
    .gal-pane-stat { font-weight: 700; color: ${THEME.dark}; }
    .gal-pane-actions { display: flex; gap: 10px; align-items: center; }
    .gal-pane-btn { padding: 8px 16px !important; transform: none !important; box-shadow: none !important; border-radius: 6px !important; font-size: 0.85rem !important; border: none !important; }
    .gal-pane-btn * { transform: none !important; }
    .gal-pane-btn.purple { background: #6f42c1; color: #fff; }
    .gal-pane-btn.purple:hover { background: #5a32a3; color: #fff; }
    .gal-pane-btn.teal { background: #17a2b8; color: #fff; }
    .gal-pane-btn.teal:hover { background: #138496; color: #fff; }
    .gal-pane-btn.primary { background: ${THEME.accent}; color: ${THEME.dark}; }
    .gal-pane-btn.primary:hover { background: #00a8cc; color: #fff; }
    #gal-unified-panel .gal-opening-layout { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
    #gal-unified-panel .gal-opening-column { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px; min-height: 360px; }
    #gal-unified-panel .gal-opening-title { font-size: 0.92rem; font-weight: 700; color: ${THEME.dark}; display: flex; align-items: center; gap: 6px; }
    #gal-unified-panel .gal-opening-textarea { width: 100%; min-height: 300px; resize: vertical; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; font-family: monospace; font-size: 0.86rem; line-height: 1.55; color: #1f2937; background: #ffffff; caret-color: #1f2937; }
    #gal-unified-panel .gal-opening-textarea::placeholder { color: #9ca3af; opacity: 1; }
    #gal-unified-panel .gal-opening-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; margin-bottom: 10px; }
    #gal-unified-panel .gal-opening-actions .gal-pane-btn { min-width: 140px; justify-content: center; }
    #gal-unified-panel .gal-opening-hint { padding: 10px 12px; border-radius: 8px; border: 1px solid #e5e7eb; background: #f8fafc; color: #475569; font-size: 0.82rem; line-height: 1.6; }
    #gal-unified-panel .gal-opening-hint i { color: #0ea5e9; }
    .gal-imagegen-pills { display:flex; gap:8px; padding:12px 0; flex-wrap:wrap; }
    .gal-pill { padding:8px 18px; border:2px solid rgba(0,0,0,0.15); background:rgba(0,0,0,0.05); border-radius:20px; cursor:pointer; font-size:0.85rem; font-weight:600; color:rgba(0,0,0,0.6); transition:all 0.2s; display:flex; align-items:center; gap:6px; }
    .gal-pill:hover { border-color:${THEME.accent}; color:${THEME.accent}; }
    .gal-pill.active { background:linear-gradient(135deg,${THEME.accent},#00a8cc); color:#fff; border-color:transparent; }
    .gal-custom-skin-profile-bar { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
    .gal-custom-skin-profile-select-wrap { display: flex; flex-direction: column; gap: 4px; min-width: min(100%, 320px); font-size: 0.82rem; color: var(--SmartThemeBodyColor, #f5f7fa); }
    .gal-custom-skin-profile-select-wrap span { font-weight: 700; color: var(--SmartThemeBodyColor, #f5f7fa); }
    .gal-custom-skin-profile-select-wrap select {
      min-height: 38px;
      border-radius: 8px;
      border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
      background: var(--SmartThemeBlurTintColor, rgba(20, 24, 32, 0.92));
      color: var(--SmartThemeBodyColor, #f5f7fa);
      padding: 7px 10px;
      outline: none;
    }
    .gal-custom-skin-profile-select-wrap select::placeholder { color: rgba(245, 247, 250, 0.74); }
    .gal-custom-skin-profile-select-wrap select:focus {
      border-color: var(--SmartThemeEmColor, #9ac7ff);
      box-shadow: 0 0 0 3px rgba(154, 199, 255, 0.22);
    }
    .gal-custom-skin-profile-select-wrap select:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .gal-custom-skin-profile-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .gal-custom-skin-profile-actions .gal-pane-btn:disabled { opacity: 0.56; cursor: not-allowed; }
    .gal-custom-skin-footer-display-panel {
      --gal-custom-skin-footer-panel-text: var(--SmartThemeBodyColor, #f5f7fa);
      --gal-custom-skin-footer-panel-text-muted: rgba(245, 247, 250, 0.82);
      --gal-custom-skin-footer-panel-border: var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
      --gal-custom-skin-footer-panel-surface: var(--SmartThemeBlurTintColor, rgba(20, 24, 32, 0.92));
      --gal-custom-skin-footer-panel-surface-soft: rgba(255, 255, 255, 0.06);
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 10px;
      padding: 12px;
      border-radius: 10px;
      border: 1px solid var(--gal-custom-skin-footer-panel-border);
      background: var(--gal-custom-skin-footer-panel-surface);
      color: var(--gal-custom-skin-footer-panel-text);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
    }
    .gal-custom-skin-footer-display-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .gal-custom-skin-footer-display-status {
      font-size: 0.78rem;
      color: var(--SmartThemeEmColor, #9ac7ff);
      font-weight: 700;
    }
    .gal-custom-skin-footer-display-panel .gal-custom-skin-editor-note {
      color: var(--gal-custom-skin-footer-panel-text-muted);
      background: var(--gal-custom-skin-footer-panel-surface-soft);
      border-color: var(--gal-custom-skin-footer-panel-border);
    }
    .gal-custom-skin-footer-display-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 8px;
    }
    .gal-custom-skin-footer-display-list.is-disabled {
      opacity: 0.65;
    }
    .gal-custom-skin-footer-display-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px;
      border-radius: 8px;
      border: 1px solid var(--gal-custom-skin-footer-panel-border);
      background: var(--gal-custom-skin-footer-panel-surface-soft);
      color: var(--gal-custom-skin-footer-panel-text);
    }
    .gal-custom-skin-footer-display-row.is-fixed {
      background: rgba(154, 199, 255, 0.08);
    }
    .gal-custom-skin-footer-display-meta {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .gal-custom-skin-footer-display-meta strong {
      color: var(--gal-custom-skin-footer-panel-text);
      font-size: 0.82rem;
    }
    .gal-custom-skin-footer-display-meta small {
      color: var(--gal-custom-skin-footer-panel-text-muted);
      font-size: 0.76rem;
    }
    .gal-custom-skin-footer-display-fixed {
      font-size: 0.76rem;
      font-weight: 700;
      color: var(--SmartThemeEmColor, #9ac7ff);
      white-space: nowrap;
    }
    .gal-custom-skin-footer-display-options {
      display: inline-flex;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .gal-custom-skin-footer-display-option {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 34px;
      padding: 0 10px;
      border-radius: 999px;
      border: 1px solid var(--gal-custom-skin-footer-panel-border);
      background: rgba(15, 23, 42, 0.72);
      color: var(--gal-custom-skin-footer-panel-text);
      cursor: pointer;
      font-size: 0.78rem;
      font-weight: 600;
    }
    .gal-custom-skin-footer-display-option span {
      color: var(--gal-custom-skin-footer-panel-text);
    }
    .gal-custom-skin-footer-display-option input {
      margin: 0;
      accent-color: var(--SmartThemeEmColor, #9ac7ff);
    }
    .gal-custom-skin-footer-display-option:has(input:checked) {
      border-color: var(--SmartThemeEmColor, #9ac7ff);
      background: rgba(154, 199, 255, 0.18);
      box-shadow: 0 0 0 2px rgba(154, 199, 255, 0.14);
      color: var(--gal-custom-skin-footer-panel-text);
    }
    .gal-custom-skin-footer-display-option:has(input:focus-visible) {
      box-shadow: 0 0 0 3px rgba(154, 199, 255, 0.22);
    }
    .gal-custom-skin-footer-display-option:has(input:disabled) {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .gal-custom-skin-editor-layout {
      display: grid;
      grid-template-columns: 210px minmax(0, 1fr);
      gap: 12px;
      min-height: 560px;
      height: clamp(620px, calc(100vh - 230px), 940px);
      align-items: stretch;
    }
    .gal-custom-skin-device-switch {
      display: inline-flex;
      align-items: center;
      gap: 0;
      border: 1px solid rgba(148, 163, 184, 0.38);
      border-radius: 999px;
      overflow: hidden;
      margin-bottom: 10px;
      background: rgba(255, 255, 255, 0.96);
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
    }
    .gal-custom-skin-device-tab {
      border: none;
      background: transparent;
      color: #334155;
      font-size: 0.85rem;
      font-weight: 700;
      padding: 6px 14px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .gal-custom-skin-device-tab + .gal-custom-skin-device-tab { border-left: 1px solid rgba(148, 163, 184, 0.28); }
    .gal-custom-skin-device-tab.active {
      background: linear-gradient(135deg, #38bdf8, #0ea5e9);
      color: #ffffff;
      box-shadow: inset 0 0 0 1px rgba(14, 165, 233, 0.18);
    }
    .gal-custom-skin-device-tab:hover {
      background: rgba(226, 232, 240, 0.92);
      color: #0f172a;
    }
    .gal-custom-skin-device-tab.active:hover {
      background: linear-gradient(135deg, #22c3ee, #0284c7);
      color: #ffffff;
    }
    .gal-custom-skin-device-tab:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px rgba(14, 165, 233, 0.25);
    }
    .gal-custom-skin-editor-col {
      --gal-custom-skin-text: var(--SmartThemeBodyColor, #f5f7fa);
      --gal-custom-skin-text-muted: rgba(245, 247, 250, 0.78);
      --gal-custom-skin-border: var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
      --gal-custom-skin-surface: var(--SmartThemeBlurTintColor, rgba(20, 24, 32, 0.92));
      --gal-custom-skin-surface-soft: rgba(255, 255, 255, 0.06);
      --gal-custom-skin-surface-soft-strong: rgba(255, 255, 255, 0.1);
      --gal-custom-skin-input-bg: rgba(12, 18, 28, 0.88);
      --gal-custom-skin-input-text: var(--SmartThemeBodyColor, #f5f7fa);
      --gal-custom-skin-input-placeholder: rgba(245, 247, 250, 0.72);
      --gal-custom-skin-input-focus: var(--SmartThemeEmColor, #9ac7ff);
      background: var(--gal-custom-skin-surface);
      border: 1px solid var(--gal-custom-skin-border);
      border-radius: 10px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      color: var(--gal-custom-skin-text);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
      min-height: 0;
      min-width: 0;
    }
    .gal-custom-skin-editor-title { font-weight: 700; color: var(--SmartThemeEmColor, #9ac7ff); font-size: 0.95rem; display: flex; align-items: center; gap: 8px; }
    .gal-custom-skin-editor-hint { font-size: 0.82rem; color: var(--gal-custom-skin-text-muted); min-height: 1.2rem; }
    .gal-custom-skin-editor-hint.ok { color: #047857; }
    .gal-custom-skin-editor-hint.warn { color: #b45309; }
    .gal-custom-skin-editor-hint.err { color: #b91c1c; }
    .gal-custom-skin-editor-main { overflow: hidden; position: relative; }
    .gal-custom-skin-workbench {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
      gap: 12px;
      flex: 1;
      min-height: 0;
      position: relative;
      z-index: 1;
    }
    .gal-custom-skin-canvas-panel {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 0;
      min-height: 0;
    }
    .gal-custom-skin-canvas-toolbar {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      min-height: 36px;
    }
    .gal-custom-skin-preview-toggle-btn {
      margin-left: auto;
      min-width: 132px;
    }
    .gal-custom-skin-side-tools {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 0;
      overflow: auto;
      padding-right: 4px;
      padding-bottom: 2px;
    }
    .gal-custom-skin-side-panel {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 10px;
      border-radius: 8px;
      border: 1px solid var(--gal-custom-skin-border);
      background: var(--gal-custom-skin-surface-soft);
    }
    .gal-custom-skin-footer-batch-panel { display: none; }
    .gal-custom-skin-footer-batch-targets {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .gal-custom-skin-footer-batch-slot {
      border: 1px solid var(--gal-custom-skin-border);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.04);
      color: var(--gal-custom-skin-text);
      padding: 8px 10px;
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 3px;
      cursor: pointer;
      transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
    }
    .gal-custom-skin-footer-batch-slot strong {
      font-size: 0.86rem;
      font-weight: 800;
      color: var(--SmartThemeEmColor, #9ac7ff);
    }
    .gal-custom-skin-footer-batch-slot span {
      font-size: 0.75rem;
      color: var(--gal-custom-skin-text);
      line-height: 1.45;
    }
    .gal-custom-skin-footer-batch-slot small {
      font-size: 0.72rem;
      color: var(--gal-custom-skin-text-muted);
    }
    .gal-custom-skin-footer-batch-slot:hover {
      border-color: var(--SmartThemeEmColor, #9ac7ff);
      transform: translateY(-1px);
    }
    .gal-custom-skin-footer-batch-slot.assigned {
      background: rgba(34, 197, 94, 0.12);
      border-color: rgba(34, 197, 94, 0.42);
    }
    .gal-custom-skin-footer-batch-slot.active {
      background: rgba(14, 165, 233, 0.16);
      border-color: var(--SmartThemeEmColor, #9ac7ff);
      box-shadow: 0 0 0 2px rgba(154, 199, 255, 0.14);
    }
    .gal-custom-skin-elements-list { display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0; overflow: auto; padding-right: 2px; }
    .gal-custom-skin-element-item { border: 1px solid var(--gal-custom-skin-border); border-radius: 8px; background: var(--gal-custom-skin-surface-soft); padding: 8px 10px; cursor: pointer; text-align: left; display: flex; flex-direction: column; gap: 2px; color: var(--gal-custom-skin-text); }
    .gal-custom-skin-element-item.active { border-color: var(--SmartThemeEmColor, #9ac7ff); box-shadow: 0 0 0 2px rgba(154, 199, 255, 0.18); background: rgba(154, 199, 255, 0.14); }
    .gal-custom-skin-element-label { font-weight: 700; color: var(--gal-custom-skin-text); font-size: 0.88rem; }
    .gal-custom-skin-element-id { color: var(--gal-custom-skin-text-muted); font-family: monospace; font-size: 0.72rem; }
    .gal-custom-skin-crop-wrapper {
      width: 100%;
      aspect-ratio: 16 / 9;
      min-height: clamp(320px, 48vh, 680px);
      flex: 1 0 auto;
      background: #111827;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #1f2937;
      cursor: default;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .gal-custom-skin-crop-wrapper canvas { width: 100%; height: 100%; display: block; }
    #gal-unified-panel .gal-custom-skin-desktop-preview-fab {
      display: none;
      position: fixed;
      top: 16px;
      right: 16px;
      min-width: 148px;
      z-index: 4;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.32);
      pointer-events: auto;
    }
    #gal-unified-panel.gal-custom-skin-desktop-preview {
      background: transparent !important;
      backdrop-filter: none !important;
    }
    #gal-unified-panel.gal-custom-skin-desktop-preview .gal-config-panel {
      background: transparent !important;
      box-shadow: none !important;
    }
    #gal-unified-panel.gal-custom-skin-desktop-preview .gal-config-panel > :not(.gal-custom-skin-desktop-preview-fab) {
      display: none !important;
    }
    #gal-unified-panel.gal-custom-skin-desktop-preview .gal-custom-skin-desktop-preview-fab {
      display: inline-flex !important;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .gal-custom-skin-preview-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .gal-custom-skin-side-tools .gal-custom-skin-preview-actions .gal-pane-btn { flex: 1 1 calc(50% - 4px); min-width: 136px; }
    .gal-custom-skin-preview-actions-secondary { flex-wrap: wrap; }
    .gal-custom-skin-mode-btn.active { background: linear-gradient(135deg, #0ea5e9, #0284c7); color: #fff; border-color: #0284c7; }
    .gal-custom-skin-preview-actions .gal-pane-btn:disabled { opacity: 0.56; cursor: not-allowed; }
    .gal-custom-skin-mode-help { font-size: 0.78rem; color: var(--gal-custom-skin-text-muted); line-height: 1.6; padding: 8px 10px; border-radius: 8px; background: var(--gal-custom-skin-surface-soft); border: 1px solid var(--gal-custom-skin-border); }
    .gal-custom-skin-zoom-row { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--gal-custom-skin-text); }
    .gal-custom-skin-zoom-row-metric { justify-content: space-between; }
    .gal-custom-skin-zoom-row input[type="range"] { flex: 1; accent-color: var(--SmartThemeEmColor, #9ac7ff); }
    .gal-custom-skin-check-row { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; color: var(--gal-custom-skin-text); }
    .gal-custom-skin-check-row-strong span { font-weight: 700; color: var(--gal-custom-skin-text); }
    .gal-custom-skin-editor-note { font-size: 0.76rem; color: var(--gal-custom-skin-text-muted); line-height: 1.55; padding: 7px 9px; border-radius: 8px; background: var(--gal-custom-skin-surface-soft); border: 1px solid var(--gal-custom-skin-border); }
    .gal-custom-skin-editor-note-inline { margin-top: 2px; }
    .gal-custom-skin-editor-form-scroll { display: flex; flex-direction: column; gap: 10px; }
    .gal-custom-skin-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .gal-custom-skin-form-grid-core { align-items: end; }
    .gal-custom-skin-form-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; color: var(--gal-custom-skin-text); }
    .gal-custom-skin-form-grid label span { font-weight: 600; }
    .gal-custom-skin-form-grid input,
    .gal-custom-skin-form-grid select,
    .gal-custom-skin-color-row input[type="text"],
    .gal-custom-skin-color-row input[type="color"] {
      padding: 6px 8px;
      border: 1px solid var(--gal-custom-skin-border);
      border-radius: 6px;
      font-size: 0.85rem;
      color: var(--gal-custom-skin-input-text);
      background: var(--gal-custom-skin-input-bg);
      caret-color: var(--gal-custom-skin-input-text);
    }
    .gal-custom-skin-form-grid input::placeholder,
    .gal-custom-skin-form-grid select::placeholder,
    .gal-custom-skin-color-row input[type="text"]::placeholder,
    .gal-custom-skin-color-row input[type="color"]::placeholder { color: var(--gal-custom-skin-input-placeholder); opacity: 1; }
    .gal-custom-skin-form-grid input:focus,
    .gal-custom-skin-form-grid select:focus,
    .gal-custom-skin-color-row input[type="text"]:focus,
    .gal-custom-skin-color-row input[type="color"]:focus { outline: none; border-color: var(--gal-custom-skin-input-focus); box-shadow: 0 0 0 3px rgba(154, 199, 255, 0.22); }
    .gal-custom-skin-form-grid input:disabled,
    .gal-custom-skin-form-grid select:disabled,
    .gal-custom-skin-color-row input[type="text"]:disabled,
    .gal-custom-skin-color-row input[type="color"]:disabled { background: rgba(148, 163, 184, 0.2); color: rgba(245, 247, 250, 0.56); border-color: var(--gal-custom-skin-border); }
    .gal-custom-skin-field-wide { grid-column: 1 / -1; }
    .gal-custom-skin-subtitle { margin-top: 4px; font-size: 0.82rem; font-weight: 700; color: var(--SmartThemeEmColor, #9ac7ff); }
    .gal-custom-skin-editor-section { border: 1px solid var(--gal-custom-skin-border); border-radius: 8px; background: var(--gal-custom-skin-surface-soft); overflow: hidden; }
    .gal-custom-skin-editor-section summary {
      list-style: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 12px;
      cursor: pointer;
      font-size: 0.84rem;
      font-weight: 700;
      color: var(--gal-custom-skin-text);
    }
    .gal-custom-skin-editor-section summary i { color: var(--SmartThemeEmColor, #9ac7ff); }
    .gal-custom-skin-editor-section summary::-webkit-details-marker { display: none; }
    .gal-custom-skin-editor-section summary::after { content: '展开'; font-size: 0.74rem; color: var(--gal-custom-skin-text-muted); }
    .gal-custom-skin-editor-section[open] summary::after { content: '收起'; }
    .gal-custom-skin-editor-section > :not(summary) { padding: 0 12px 12px; }
    .gal-custom-skin-editor-section .gal-custom-skin-form-grid { margin-top: 8px; }
    .gal-custom-skin-parameters-panel { flex: 0 0 auto; margin-top: 2px; }
    .gal-custom-skin-parameters-body { max-height: min(34vh, 320px); overflow: auto; padding-right: 4px; }
    .gal-custom-skin-four-grid { grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); }
    .gal-custom-skin-matting-panel { display: flex; flex-direction: column; gap: 8px; padding: 10px; border-radius: 8px; border: 1px solid var(--gal-custom-skin-border); background: var(--gal-custom-skin-surface-soft); }
    .gal-custom-skin-matting-grid { grid-template-columns: 1fr; }
    .gal-custom-skin-color-row { display: grid; grid-template-columns: 54px minmax(0, 1fr) auto; gap: 8px; align-items: center; }
    .gal-custom-skin-color-row input[type="color"] { padding: 4px; min-height: 38px; min-width: 54px; }
    .gal-custom-skin-color-row input[type="text"] { text-transform: uppercase; }
    .gal-custom-skin-color-presets { display: flex; gap: 8px; flex-wrap: wrap; }
    .gal-custom-skin-color-chip {
      min-height: 34px;
      border-radius: 999px;
      border: 1px solid var(--gal-custom-skin-border);
      background: rgba(255, 255, 255, 0.04);
      color: var(--gal-custom-skin-text);
      padding: 0 12px 0 30px;
      position: relative;
      cursor: pointer;
      font-size: 0.78rem;
      font-weight: 700;
    }
    .gal-custom-skin-color-chip::before {
      content: '';
      position: absolute;
      left: 10px;
      top: 50%;
      width: 12px;
      height: 12px;
      border-radius: 999px;
      transform: translateY(-50%);
      background: var(--gal-custom-skin-chip-color, #00FF00);
      border: 1px solid rgba(255, 255, 255, 0.6);
    }
    .gal-custom-skin-color-chip:hover { border-color: var(--SmartThemeEmColor, #9ac7ff); }
    .gal-custom-skin-matting-tool-btn.active,
    #gal-custom-skin-pick-matting-color.active { background: rgba(154, 199, 255, 0.22); color: var(--gal-custom-skin-text); border-color: var(--SmartThemeEmColor, #9ac7ff); }
    .gal-custom-skin-form-actions {
      display: flex;
      flex: 0 0 auto;
      gap: 8px;
      flex-wrap: wrap;
      padding-top: 10px;
      border-top: 1px solid var(--gal-custom-skin-border);
      background: linear-gradient(180deg, rgba(20, 24, 32, 0) 0%, var(--gal-custom-skin-surface) 24%);
      position: relative;
      z-index: 3;
      isolation: isolate;
      pointer-events: auto;
    }
    .gal-custom-skin-form-actions .gal-pane-btn { flex: 1; min-width: 120px; }
    @media (max-width: 1480px) {
      .gal-custom-skin-editor-layout {
        grid-template-columns: 190px minmax(0, 1fr);
        height: clamp(600px, calc(100vh - 225px), 900px);
      }
      .gal-custom-skin-workbench {
        grid-template-columns: minmax(0, 1fr) minmax(280px, 320px);
      }
    }
    @media (max-width: 1320px) {
      .gal-custom-skin-workbench {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 1180px) {
      .gal-custom-skin-editor-layout { grid-template-columns: 1fr; height: auto; }
      .gal-custom-skin-editor-col { min-height: auto; overflow: visible; }
      .gal-custom-skin-editor-main,
      .gal-custom-skin-side-tools,
      .gal-custom-skin-parameters-body { overflow: visible; padding-right: 0; }
      .gal-custom-skin-workbench { grid-template-columns: 1fr; }
      .gal-custom-skin-crop-wrapper { min-height: clamp(260px, 42vh, 520px); }
      .gal-custom-skin-footer-batch-targets { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    @media (max-width: 768px) {
      #gal-unified-panel .gal-custom-skin-desktop-preview-fab {
        top: 12px;
        right: 12px;
        min-width: 132px;
      }
    }
    #gal-unified-panel #gal-custom-bgm-list,
    #gal-unified-panel #gal-custom-location-html,
    #gal-unified-panel #gal-custom-time-html {
      background: #ffffff !important;
      color: #1f2937 !important;
      border: 1px solid #cbd5e1 !important;
      caret-color: #1f2937 !important;
      line-height: 1.5 !important;
    }
    #gal-unified-panel #gal-custom-bgm-list::placeholder,
    #gal-unified-panel #gal-custom-location-html::placeholder,
    #gal-unified-panel #gal-custom-time-html::placeholder {
      color: #9ca3af !important;
      opacity: 1 !important;
    }
    #gal-unified-panel .gal-custom-icon-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 8px;
      max-height: 260px;
      overflow-y: auto;
      padding: 8px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
    }
    #gal-unified-panel .gal-custom-icon-option {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 36px;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid #d1d5db;
      background: #f8fafc;
      color: #374151;
      cursor: pointer;
      font-size: 0.82rem;
      text-align: left;
      transition: all 0.15s ease;
    }
    #gal-unified-panel .gal-custom-icon-option i {
      width: 18px;
      text-align: center;
      color: #111827;
      flex-shrink: 0;
    }
    #gal-unified-panel .gal-custom-icon-option span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #gal-unified-panel .gal-custom-icon-option:hover {
      border-color: #93c5fd;
      background: #eff6ff;
      color: #1e3a8a;
    }
    #gal-unified-panel .gal-custom-icon-option.active {
      border-color: ${THEME.accent};
      background: linear-gradient(135deg, #ecfeff, #e0f2fe);
      color: #0f172a;
      box-shadow: 0 0 0 2px rgba(0, 210, 255, 0.2);
    }
    @media (max-width: 768px) {
      #gal-unified-panel .gal-tab-header {
        overflow-x: auto !important;
        overflow-y: hidden !important;
        flex-wrap: nowrap !important;
        justify-content: flex-start !important;
        gap: 6px !important;
        -webkit-overflow-scrolling: touch;
      }
      #gal-unified-panel .gal-tab-btn {
        flex: 0 0 auto !important;
        min-width: 102px !important;
      }
      #gal-unified-panel .gal-opening-layout { grid-template-columns: 1fr; }
      #gal-unified-panel .gal-opening-column { min-height: 220px; }
      #gal-unified-panel .gal-opening-textarea { min-height: 180px; }
      #gal-unified-panel .gal-opening-actions .gal-pane-btn { flex: 1 1 100%; min-width: 0; }
      .gal-special-cg-rules-header { display: none; }
      .gal-special-cg-rule-row { grid-template-columns: 1fr; padding: 8px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
      .gal-special-cg-rule-remove { width: 100%; }
      #gal-unified-panel .gal-custom-icon-grid {
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
        max-height: 220px;
      }
    }
  `;
}

// ============================================
// 事件绑定 (内部)
// ============================================

function bindOpeningEvents($modal) {
  const $source = $modal.find('#gal-opening-source');
  const $result = $modal.find('#gal-opening-result');
  const $convertBtn = $modal.find('#gal-opening-convert-btn');
  const $copyBtn = $modal.find('#gal-opening-copy-btn');
  const $writeBtn = $modal.find('#gal-opening-write-btn');
  if (!$source.length || !$result.length) return;

  let converting = false;

  const updateConvertButton = (busy) => {
    $convertBtn.prop('disabled', busy);
    if (busy) {
      $convertBtn.html('<i class="fa-solid fa-spinner fa-spin"></i> <span>转换中...</span>');
    } else {
      $convertBtn.html('<i class="fa-solid fa-arrows-rotate"></i> <span>转换</span>');
    }
  };

  const fallbackCopyText = (text) => {
    const doc = topWindow.document;
    const textarea = doc.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    doc.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = doc.execCommand('copy');
    doc.body.removeChild(textarea);
    return copied;
  };

  $convertBtn.on('click', async function () {
    if (converting) return;
    const sourceText = String($source.val() || '').trim();
    if (!sourceText) {
      showToast('请输入要转换的开场白原文');
      return;
    }

    converting = true;
    updateConvertButton(true);
    const previousResult = String($result.val() || '');
    try {
      const { formattedText } = await convertTextToCotFormat(sourceText, {
        independent: true,
        onStream: text => {
          $result.val(text || '');
        },
      });
      $result.val(formattedText || '');
      showToast('开场白转换完成');
    } catch (e) {
      $result.val(previousResult);
      showToast(`转换失败: ${e?.message || e}`);
    } finally {
      converting = false;
      updateConvertButton(false);
    }
  });

  $copyBtn.on('click', async function () {
    const resultText = String($result.val() || '').trim();
    if (!resultText) {
      showToast('暂无可复制的转换结果');
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(resultText);
      } else {
        const copied = fallbackCopyText(resultText);
        if (!copied) throw new Error('复制失败');
      }
      showToast('已复制转换结果');
    } catch (e) {
      showToast(`复制失败: ${e?.message || e}`);
    }
  });

  $writeBtn.on('click', async function () {
    const resultText = String($result.val() || '').trim();
    if (!resultText) {
      showToast('请先完成转换并确认结果');
      return;
    }
    if (typeof updateCharacterWith !== 'function') {
      showToast('当前环境不支持写入角色卡开场白');
      return;
    }

    const confirmed = await showInAppConfirmDialog({
      title: '确认写入开场白',
      message: '将把当前转换结果写入当前角色卡首条开场白。',
      hint: '仅覆盖第一条开场白，其余开场白保留不变。',
      iconClass: 'fa-solid fa-pen-to-square',
      accent: '#0d6efd',
      confirmText: '确认写入',
      cancelText: '取消',
    });
    if (!confirmed) return;

    try {
      await updateCharacterWith('current', character => {
        const next = character && typeof character === 'object' ? character : {};
        const firstMessages = Array.isArray(next.first_messages) ? [...next.first_messages] : [];
        if (firstMessages.length === 0) {
          firstMessages.push(resultText);
        } else {
          firstMessages[0] = resultText;
        }
        next.first_messages = firstMessages;
        return next;
      });
      showToast('已写入当前角色卡首条开场白');
    } catch (e) {
      showToast(`写入失败: ${e?.message || e}`);
    }
  });
}

function bindSpriteEvents($modal, activeTab) {
  $modal.find('#gal-batch-upload-btn').on('click', () => {
    $modal.remove();
    if (_showBatchUploadDialogRef) _showBatchUploadDialogRef(null, () => showAssetManagerModal('sprites'));
  });
  $modal.find('#gal-manage-expressions-btn').on('click', () => {
    $modal.remove();
    if (_showCustomExpressionManagerRef) _showCustomExpressionManagerRef(() => showAssetManagerModal('sprites'));
  });
  $modal.find('#gal-add-sprite-btn').on('click', async () => {
    $modal.remove();
    if (_showSpriteUploadDialogRef)
      await _showSpriteUploadDialogRef('', '默认', () => showAssetManagerModal('sprites'));
  });
  $modal.find('.gal-character-card').on('click', function (e) {
    if ($(e.target).closest('.gal-char-actions').length) return;
    const charId = $(this).data('char');
    showCharacterSpritesModal(charId);
  });
  $modal
    .find('.gal-character-card')
    .on('mouseenter', function () {
      $(this).find('.gal-char-actions').css('opacity', '1');
    })
    .on('mouseleave', function () {
      $(this).find('.gal-char-actions').css('opacity', '0');
    });
  $modal.find('.gal-char-transfer').on('click', async function (e) {
    e.stopPropagation();
    const charId = $(this).data('char');
    const allSpritesAll = await getAllSprites(null, true);
    const charSprites = allSpritesAll.filter(s => s.characterId === charId);
    if (charSprites.length === 0) {
      showToast('该角色没有立绘可转移', 'warning');
      return;
    }
    const spriteKeys = charSprites.map(s => s.id || `${s.characterId}_${s.expression}`).filter(Boolean);
    showTransferDialog('sprite', spriteKeys, () => {
      $modal.remove();
      showAssetManagerModal('sprites');
    });
  });
  $modal.find('.gal-char-delete').on('click', async function (e) {
    e.stopPropagation();
    const charId = $(this).data('char');
    const allSpritesAll = await getAllSprites(null, true);
    const charSprites = allSpritesAll.filter(s => s.characterId === charId);
    if (charSprites.length === 0) {
      showToast('该角色没有立绘', 'warning');
      return;
    }
    if (confirm(`确定删除角色「${charId}」的所有 ${charSprites.length} 个立绘吗？此操作不可恢复！`)) {
      for (const sprite of charSprites) {
        await deleteSprite(sprite.characterId, sprite.expression, sprite.packId, sprite.id);
      }
      showToast(`已删除角色「${charId}」的 ${charSprites.length} 个立绘`);
      if (getIsEnabled()) injectCOTToWorldbook().catch(e => console.warn(`[${SCRIPT_NAME}] 更新世界书失败:`, e));
      $modal.remove();
      showAssetManagerModal('sprites');
    }
  });
}

function bindBackgroundEvents($modal, activeTab) {
  // 点击背景卡片查看大图（事件委托）
  $modal.on('click', '.gal-bg-card', function (e) {
    if ($(e.target).closest('.gal-bg-actions').length) return;
    const $img = $(this).find('.gal-bg-preview img');
    if (!$img.length) return;
    const src = $img.attr('src');
    const scene = $(this).data('scene');
    // 全屏时 contain:layout 会困住 position:fixed，需用 absolute 替代
    const mountRoot = getModalMountRoot();
    const isFullscreen = mountRoot !== topWindow.document.body;
    const posStyle = isFullscreen
      ? 'position:absolute;top:0;left:0;width:100%;height:100%;'
      : 'position:fixed;top:0;left:0;width:100vw;height:100vh;';
    const $lightbox =
      $(`<div style="${posStyle}background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:100003;cursor:zoom-out;flex-direction:column;gap:12px;">
      <img src="${src}" style="max-width:90vw;max-height:85vh;object-fit:contain;border-radius:8px;box-shadow:0 4px 30px rgba(0,0,0,0.5);">
      <span style="color:#ccc;font-size:0.9rem;">${scene}</span>
    </div>`);
    $lightbox.on('click', function () {
      $(this).remove();
    });
    $(mountRoot).append($lightbox);
  });
  $modal.find('#gal-add-bg-btn').on('click', () => {
    $modal.remove();
    if (_showBackgroundUploadDialogRef) _showBackgroundUploadDialogRef(() => showAssetManagerModal('backgrounds'));
  });
  $modal.find('#gal-batch-bg-upload-btn').on('click', () => {
    $modal.remove();
    if (_showBatchBackgroundUploadDialogRef)
      _showBatchBackgroundUploadDialogRef(() => showAssetManagerModal('backgrounds'));
  });
  $modal.find('.gal-bg-delete').on('click', async function (e) {
    e.stopPropagation();
    const scene = $(e.currentTarget).attr('data-scene');
    if (confirm(`确定删除背景「${scene}」吗？`)) {
      await deleteBackground(scene);
      showToast(`已删除背景: ${scene}`);
      if (getIsEnabled()) injectCOTToWorldbook().catch(e => console.warn(`[${SCRIPT_NAME}] 更新世界书失败:`, e));
      $modal.remove();
      showAssetManagerModal('backgrounds');
    }
  });
  $modal.find('.gal-bg-transfer').on('click', function (e) {
    e.stopPropagation();
    const sceneName = $(this).data('scene');
    showTransferDialog('background', [sceneName], () => {
      $modal.remove();
      $(topWindow.document).off('.galMenus').off('.galImportMenu').off('.galPackMenu');
      showAssetManagerModal('backgrounds');
    });
  });
}

function bindSpecialCgEvents($modal, activeTab) {
  $modal.on('click', '.gal-special-cg-card', function (e) {
    if ($(e.target).closest('.gal-special-cg-actions').length) return;
    const $img = $(this).find('.gal-special-cg-preview img');
    if (!$img.length) return;
    const src = $img.attr('src');
    const title = $(this).find('.gal-special-cg-name').text();
    const mountRoot = getModalMountRoot();
    const isFullscreen = mountRoot !== topWindow.document.body;
    const posStyle = isFullscreen
      ? 'position:absolute;top:0;left:0;width:100%;height:100%;'
      : 'position:fixed;top:0;left:0;width:100vw;height:100vh;';
    const $lightbox =
      $(`<div style="${posStyle}background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:100003;cursor:zoom-out;flex-direction:column;gap:12px;">
      <img src="${src}" style="max-width:90vw;max-height:85vh;object-fit:contain;border-radius:8px;box-shadow:0 4px 30px rgba(0,0,0,0.5);">
      <span style="color:#ccc;font-size:0.9rem;">${escapeHtml(title)}</span>
    </div>`);
    $lightbox.on('click', function () {
      $(this).remove();
    });
    $(mountRoot).append($lightbox);
  });

  $modal.find('#gal-add-special-cg-btn').on('click', () => {
    $modal.remove();
    if (_showSpecialCgUploadDialogRef) {
      _showSpecialCgUploadDialogRef(() => showAssetManagerModal('special-cgs'));
    }
  });

  $modal.find('#gal-batch-special-cg-upload-btn').on('click', () => {
    $modal.remove();
    if (_showBatchSpecialCgUploadDialogRef) {
      _showBatchSpecialCgUploadDialogRef(() => showAssetManagerModal('special-cgs'));
    }
  });

  $modal.find('.gal-special-cg-delete').on('click', async function (e) {
    e.stopPropagation();
    const cgId = String($(this).data('cg-id') || '').trim();
    if (!cgId) return;
    if (!confirm(`确定删除特殊CG「${cgId}」吗？`)) return;
    try {
      await deleteSpecialCg(cgId);
      showToast(`已删除特殊CG: ${cgId}`);
      $modal.remove();
      showAssetManagerModal('special-cgs');
    } catch (error) {
      showToast(`删除失败: ${error?.message || error}`);
    }
  });

  $modal.find('.gal-special-cg-transfer').on('click', function (e) {
    e.stopPropagation();
    const cgId = String($(this).data('cg-id') || '').trim();
    if (!cgId) return;
    showTransferDialog('cg', [cgId], () => {
      $modal.remove();
      $(topWindow.document).off('.galMenus').off('.galImportMenu').off('.galPackMenu');
      showAssetManagerModal('special-cgs');
    });
  });
}

function bindSpecialCgRulesEvents($modal, activeTab) {
  const getOptionsTemplate = () =>
    $('<textarea/>').html(String($modal.find('#gal-special-cg-options-template').val() || '').trim()).text();
  const getMvuDataListForValueDisplay = () => {
    const Mvu = topWindow.Mvu || globalThis.Mvu;
    if (!Mvu || typeof Mvu.getMvuData !== 'function') return [];
    return getMvuDataListFromScopes(Mvu);
  };
  const updateRuleRowCurrentValue = ($row, mvuDataList = null) => {
    const $valueNode = $row.find('.gal-special-cg-rule-current-value');
    if (!$valueNode.length) return;

    const rawPath = String($row.find('.gal-special-cg-rule-path').val() || '').trim();
    if (!rawPath) {
      $valueNode
        .text('未填写')
        .attr('title', '当前值：请先填写变量路径')
        .addClass('is-empty');
      return;
    }

    const safeMvuDataList = Array.isArray(mvuDataList) ? mvuDataList : getMvuDataListForValueDisplay();
    const result = findMvuVariableValueInDataList(rawPath, safeMvuDataList);
    if (!result.found) {
      const normalizedPath = normalizeMvuVariablePath(rawPath);
      $valueNode
        .text('未找到')
        .attr('title', `当前值：未找到路径 ${normalizedPath || rawPath}`)
        .addClass('is-empty');
      return;
    }

    const valueText = stringifyMvuVariableValue(result.value);
    $valueNode
      .text(formatMvuVariableValueForDisplay(result.value))
      .attr('title', `当前值：${valueText}`)
      .removeClass('is-empty');
  };
  const updateAllRuleRowsCurrentValue = (mvuDataList = null) => {
    const safeMvuDataList = Array.isArray(mvuDataList) ? mvuDataList : getMvuDataListForValueDisplay();
    $modal.find('.gal-special-cg-rule-row').each(function () {
      updateRuleRowCurrentValue($(this), safeMvuDataList);
    });
  };
  const updateVariablePathCandidates = (paths, mvuDataList = null) => {
    const safePaths = Array.from(new Set((Array.isArray(paths) ? paths : [])
      .map(item => String(item || '').trim().replace(/^stat_data\./, ''))
      .filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    const optionsHtml = buildVariablePathOptionsHtml(safePaths);
    $modal.find(`#${SPECIAL_CG_VAR_PATH_DATALIST_ID}`).html(optionsHtml);
    updateAllRuleRowsCurrentValue(mvuDataList);
    const $counter = $modal.find('#gal-special-cg-var-count');
    $counter.attr('data-count', String(safePaths.length));
    $counter.text(safePaths.length > 0 ? `已加载 ${safePaths.length} 项变量路径` : '未提取到可用于数值比较的变量路径');
    return safePaths.length;
  };

  const buildBlankRow = () => {
    const optionsHtml = getOptionsTemplate() || '<option value="">选择CG资源</option>';
    return buildSpecialCgRuleRowHtml(
      {
        id: `special_cg_rule_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        name: '',
        enabled: true,
        variablePath: '',
        operator: 'gte',
        threshold: 0,
        cgId: '',
        priority: 0,
      },
      optionsHtml,
    );
  };
  let loadingMvuVars = false;
  const $loadBtn = $modal.find('#gal-special-cg-load-mvu-vars-btn');
  $loadBtn.on('click', async () => {
    if (loadingMvuVars) return;
    loadingMvuVars = true;
    $loadBtn.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> <span>读取中...</span>');
    try {
      const paths = await loadMvuVariablePathsAsync();
      const mvuDataList = getMvuDataListForValueDisplay();
      const count = updateVariablePathCandidates(paths, mvuDataList);
      if (count > 0) {
        showToast(`已读取 ${count} 项 MVU 变量路径`);
      } else {
        showToast('MVU变量中未找到可用于数值比较的路径');
      }
    } catch (error) {
      showToast(`读取MVU变量失败: ${error?.message || error}`);
    } finally {
      loadingMvuVars = false;
      $loadBtn.prop('disabled', false).html('<i class="fa-solid fa-arrows-rotate"></i> <span>读取MVU变量</span>');
    }
  });

  $modal.find('.gal-special-cg-rule-row').each(function () {
    const $row = $(this);
    const currentCgId = String($row.find('.gal-special-cg-rule-current-cg-id').val() || '').trim();
    if (currentCgId) {
      $row.find('.gal-special-cg-rule-cg-id').val(currentCgId);
    }
  });

  $modal.find('#gal-special-cg-rule-add-btn').on('click', () => {
    const $newRow = $(buildBlankRow());
    $modal.find('#gal-special-cg-rules-list').append($newRow);
    updateRuleRowCurrentValue($newRow);
  });

  $modal.on('click', '.gal-special-cg-rule-remove', function () {
    $(this).closest('.gal-special-cg-rule-row').remove();
  });
  $modal.on('input change', '.gal-special-cg-rule-path', function () {
    const $row = $(this).closest('.gal-special-cg-rule-row');
    updateRuleRowCurrentValue($row);
  });
  $modal.on('input change', '.gal-special-cg-rule-name', function () {
    const $input = $(this);
    if (String($input.val() || '').trim()) {
      $input.removeClass('is-invalid');
    }
  });
  updateAllRuleRowsCurrentValue();

  $modal.find('#gal-special-cg-rule-save-btn').on('click', () => {
    const settings = getSettings();
    const rules = [];
    let skippedCount = 0;
    let missingNameCount = 0;
    let $firstMissingNameInput = null;
    $modal.find('.gal-special-cg-rule-name').removeClass('is-invalid');
    $modal.find('.gal-special-cg-rule-row').each(function (index) {
      const $row = $(this);
      const $nameInput = $row.find('.gal-special-cg-rule-name');
      const id = String($row.find('.gal-special-cg-rule-id').val() || '').trim() || `special_cg_rule_${Date.now()}_${index}`;
      const name = String($nameInput.val() || '').trim();
      const variablePath = String($row.find('.gal-special-cg-rule-path').val() || '').trim().replace(/^stat_data\./, '');
      const operator = String($row.find('.gal-special-cg-rule-operator').val() || 'gte').trim().toLowerCase();
      const thresholdRaw = Number($row.find('.gal-special-cg-rule-threshold').val());
      const cgId = String($row.find('.gal-special-cg-rule-cg-id').val() || '').trim();
      const priorityRaw = Number($row.find('.gal-special-cg-rule-priority').val());
      const enabled = $row.find('.gal-special-cg-rule-enabled').is(':checked');
      if (!name) {
        missingNameCount++;
        $nameInput.addClass('is-invalid');
        if (!$firstMissingNameInput) {
          $firstMissingNameInput = $nameInput;
        }
        return;
      }
      if (!variablePath || !cgId) {
        skippedCount++;
        return;
      }
      rules.push({
        id,
        name,
        enabled,
        variablePath,
        operator: ['gte', 'gt', 'eq', 'lte', 'lt'].includes(operator) ? operator : 'gte',
        threshold: Number.isFinite(thresholdRaw) ? thresholdRaw : 0,
        cgId,
        priority: Number.isFinite(priorityRaw) ? priorityRaw : 0,
        oncePerChat: true,
      });
    });

    if (missingNameCount > 0) {
      showToast(`规则名为必填项，请补全 ${missingNameCount} 条规则后再保存`);
      if ($firstMissingNameInput && $firstMissingNameInput.length > 0) {
        $firstMissingNameInput.trigger('focus');
      }
      return;
    }

    settings.specialCg = {
      enabled: $modal.find('#gal-special-cg-enabled').is(':checked'),
      rules,
    };
    saveSettings();
    if (skippedCount > 0) {
      showToast(`规则已保存，已跳过 ${skippedCount} 条不完整规则`);
    } else {
      showToast('MVU触发CG规则已保存');
    }
    if (getIsEnabled()) {
      resetSpecialCgRuntimeForChat();
      detectSpecialCgPendingNow()
        .then(() => injectCOTToWorldbook())
        .catch(error => console.warn(`[${SCRIPT_NAME}] 保存规则后刷新特殊CG COT失败:`, error));
    }
  });
}

function bindMapEvents($modal, activeTab) {
  $modal.find('#gal-add-map-btn').on('click', () => {
    showMapUploadDialog({
      onSaved: () => {
        $modal.remove();
        showAssetManagerModal('maps');
      },
    });
  });

  $modal.on('click', '.gal-map-card', function (e) {
    if ($(e.target).closest('.gal-map-card-actions').length) return;
    $modal.remove();
    showMapModal();
  });

  $modal.on('click', '.gal-map-open-btn', function (e) {
    e.stopPropagation();
    $modal.remove();
    showMapModal();
  });

  $modal.on('click', '.gal-map-delete-btn', async function (e) {
    e.stopPropagation();
    const regionKey = String($(this).attr('data-region') || '').trim() || GLOBAL_MAP_REGION_KEY;
    const packId = String($(this).attr('data-pack-id') || '').trim() || null;
    if (!confirm('确定删除统一世界地图吗？')) return;
    try {
      await deleteMapImage(regionKey, packId);
      showToast('已删除统一世界地图');
      $modal.remove();
      showAssetManagerModal('maps');
    } catch (error) {
      showToast(`删除地图失败: ${error?.message || error}`);
    }
  });
}

function bindPackSelectorEvents($modal, activeTab) {
  $modal.find('#gal-pack-dropdown-btn').on('click', function (e) {
    e.stopPropagation();
    $('#gal-export-menu, #gal-import-menu').hide();
    $('#gal-pack-menu').toggle();
  });
  $(topWindow.document).on('click.galPackMenu', function (e) {
    if (!$(e.target).closest('.gal-pack-selector').length) $('#gal-pack-menu').hide();
  });
  $modal.find('.gal-pack-item[data-pack-id]').on('click', function () {
    const packId = $(this).data('pack-id');
    $('#gal-pack-menu').hide();
    setCurrentPack(packId);
    applyCustomSkinRuntime().catch(e => console.warn(`[${SCRIPT_NAME}] 切换图包后刷新 custom-skin 失败:`, e));
    $modal.remove();
    $(topWindow.document).off('.galMenus').off('.galImportMenu').off('.galPackMenu');
    showAssetManagerModal();
  });
  $modal.find('#gal-add-pack-btn').on('click', function () {
    $('#gal-pack-menu').hide();
    const name = prompt('请输入新图包名称：');
    if (name && name.trim()) {
      createImagePack(name.trim()).then(() => {
        $modal.remove();
        $(topWindow.document).off('.galMenus').off('.galImportMenu').off('.galPackMenu');
        showAssetManagerModal();
      });
    }
  });
  $modal.find('#gal-manage-packs-btn').on('click', function () {
    $('#gal-pack-menu').hide();
    showPackManagerModal();
  });
  $modal.find('#gal-render-scope-btn').on('click', function () {
    const currentScope = getRenderScope();
    const newScope = currentScope === 'current' ? 'all' : 'current';
    setRenderScope(newScope);
    const $btn = $(this);
    if (newScope === 'current') {
      $btn
        .css({ background: '#fd7e14', borderColor: '#fd7e14' })
        .attr('title', '仅当前图包资源')
        .find('i')
        .removeClass('fa-globe')
        .addClass('fa-bullseye');
    } else {
      $btn
        .css({ background: '#20c997', borderColor: '#20c997' })
        .attr('title', '搜索所有图包资源')
        .find('i')
        .removeClass('fa-bullseye')
        .addClass('fa-globe');
    }
    showToast(newScope === 'current' ? '已切换为：仅当前图包' : '已切换为：搜索所有图包');
    const currentTab = $modal.find('.gal-tab-btn.active').data('tab') || activeTab || 'sprites';
    $modal.remove();
    $(topWindow.document).off('.galMenus').off('.galImportMenu').off('.galPackMenu');
    showAssetManagerModal(currentTab);
  });
}

function bindExportImportEvents($modal, activeTab) {
  $modal.find('#gal-export-dropdown-btn').on('click', function (e) {
    e.stopPropagation();
    $('#gal-import-menu').hide();
    $('#gal-export-menu').toggle();
  });
  $(topWindow.document).on('click.galMenus', function (e) {
    if (!$(e.target).closest('.gal-export-dropdown').length) $('#gal-export-menu').hide();
  });
  const askExportPackageName = async (dialogTitle = '导出资源包') => {
    const cpId = getCurrentPackId();
    const packs = await getAllImagePacks();
    const cp = packs.find(p => p.id === cpId);
    const defaultName = cp ? cp.name : '图包';
    const defaultPackageName = `${defaultName}_${new Date().toISOString().slice(0, 10)}`;
    return showInAppPromptDialog({
      title: dialogTitle,
      message: `将导出当前图包“${defaultName}”的资源，请输入导出包名。`,
      label: '导出包名',
      defaultValue: defaultPackageName,
      placeholder: defaultPackageName,
      confirmText: '开始导出',
      cancelText: '取消',
      iconClass: 'fa-solid fa-file-export',
      accent: '#0d6efd',
      required: true,
      requiredMessage: '请输入导出包名',
    });
  };

  const askAttachCurrentCustomSkinProfileId = async () => {
    const currentSkin = String(settings?.skin || '').trim();
    if (!hasUiSkinProfileId(currentSkin)) return '';
    const profileLabel = getUiSkinProfileLabel(currentSkin) || currentSkin;
    const confirmed = await showInAppConfirmDialog({
      title: '附带当前自定义皮肤',
      message: `当前正在使用自定义皮肤“${profileLabel}”。是否在导出包中附带这套皮肤，并在导入后自动切换到它？`,
      confirmText: '附带导出',
      cancelText: '仅导出图包',
      iconClass: 'fa-solid fa-palette',
      accent: '#0ea5e9',
    });
    return confirmed ? currentSkin : '';
  };

  $modal.find('.gal-export-item').on('click', async function () {
    const action = $(this).data('action');
    $('#gal-export-menu').hide();

    if (action === 'export-local') {
      const packageName = await askExportPackageName('导出本地压缩包');
      if (!packageName) return;
      const attachedCustomSkinProfileId = await askAttachCurrentCustomSkinProfileId();
      AssetIO.exportAllAssets(null, packageName.trim(), { attachedCustomSkinProfileId });
      return;
    }

    if (action === 'export-remote') {
      const packageName = await askExportPackageName('导出 GitHub 资源包');
      if (!packageName) return;

      const input = await showInAppPromptDialog({
        title: 'GitHub 仓库信息',
        message: '请输入用户/仓库名、GitHub 仓库链接，或现成的 jsDelivr CDN 前缀。',
        hint: '示例：user/repo 或 https://github.com/user/repo',
        label: '仓库信息',
        placeholder: 'user/repo',
        confirmText: '下一步',
        cancelText: '取消',
        iconClass: 'fa-brands fa-github',
        accent: '#6f42c1',
        required: true,
        requiredMessage: '请输入 GitHub 仓库信息',
      });
      if (!input) return;

      const rawInput = input.trim();
      let cleanRepo = '';
      let branch = '';
      let baseUrl = '';

      if (rawInput.includes('cdn.jsdelivr.net/gh/')) {
        baseUrl = rawInput.endsWith('/') ? rawInput : `${rawInput}/`;
        const confirmed = await showInAppConfirmDialog({
          title: '确认 CDN 链接前缀',
          message: `确认使用以下 CDN 链接前缀吗？\n${baseUrl}`,
          confirmText: '确认导出',
          cancelText: '返回修改',
          iconClass: 'fa-solid fa-link',
          accent: '#6f42c1',
        });
        if (!confirmed) return;
        const attachedCustomSkinProfileId = await askAttachCurrentCustomSkinProfileId();
        AssetIO.exportAllAssets(baseUrl, packageName.trim(), { attachedCustomSkinProfileId });
        return;
      }

      if (rawInput.startsWith('http')) {
        const rawMatch = rawInput.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\//i);
        if (rawMatch) {
          cleanRepo = `${rawMatch[1]}/${rawMatch[2]}`;
          branch = rawMatch[3];
        } else {
          const githubMatch = rawInput.match(/github\.com\/([^/]+)\/([^/#?]+)(?:\.git)?/i);
          if (githubMatch) cleanRepo = `${githubMatch[1]}/${githubMatch[2].replace(/\.git$/i, '')}`;
        }
      } else if (rawInput.indexOf('/') > 0 && rawInput.split('/').length === 2) {
        cleanRepo = rawInput.replace(/\.git$/i, '');
      }

      if (!cleanRepo) {
        await showInAppAlertDialog({
          title: '仓库信息无效',
          message: '无法识别 GitHub 仓库信息，请输入 user/repo 或标准 GitHub 仓库链接。',
          iconClass: 'fa-solid fa-circle-exclamation',
          accent: '#dc3545',
        });
        return;
      }

      if (!branch) {
        const branchInput = await showInAppPromptDialog({
          title: '填写分支或版本',
          message: '请输入分支名或版本号。',
          label: '分支 / 版本',
          defaultValue: 'main',
          placeholder: 'main',
          confirmText: '确认',
          cancelText: '取消',
          iconClass: 'fa-solid fa-code-branch',
          accent: '#6f42c1',
          required: true,
          requiredMessage: '请输入分支名或版本号',
        });
        if (!branchInput) return;
        branch = branchInput.trim();
      }

      baseUrl = `https://cdn.jsdelivr.net/gh/${cleanRepo}@${branch}/`;
      const confirmed = await showInAppConfirmDialog({
        title: '确认导出配置',
        message: `确认生成并使用以下 CDN 链接前缀吗？\n${baseUrl}`,
        confirmText: '确认导出',
        cancelText: '返回修改',
        iconClass: 'fa-solid fa-link',
        accent: '#6f42c1',
      });
      if (!confirmed) return;
      const attachedCustomSkinProfileId = await askAttachCurrentCustomSkinProfileId();
      AssetIO.exportAllAssets(baseUrl, packageName.trim(), { attachedCustomSkinProfileId });
      return;
    }

    if (action === 'export-character-card') {
      await exportCurrentCharacterCardWithConfig();
    }
  });

  $modal.find('#gal-import-dropdown-btn').on('click', function (e) {
    e.stopPropagation();
    $('#gal-export-menu').hide();
    $('#gal-import-menu').toggle();
  });
  $(topWindow.document).on('click.galImportMenu', function (e) {
    if (!$(e.target).closest('.gal-import-dropdown').length) $('#gal-import-menu').hide();
  });
  $modal.find('.gal-import-item').on('click', function () {
    const action = $(this).data('action');
    $('#gal-import-menu').hide();
    switch (action) {
      case 'import-local-zip':
        $modal.find('#gal-asset-import-zip-input').click();
        break;
      case 'import-remote-zip':
        showRemoteZipImportDialog();
        break;
      case 'import-json':
        $modal.find('#gal-asset-import-json-input').click();
        break;
      case 'import-github':
        handleGitHubImport();
        break;
    }
  });

  $modal.find('#gal-asset-import-zip-input').on('change', async function () {
    const file = this.files[0];
    if (!file) return;
    const MAX_SIZE = 5 * 1024 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      showImportError([
        '文件大小超过限制',
        `当前文件: ${(file.size / 1024 / 1024 / 1024).toFixed(2)} GB`,
        '最大允许: 5 GB',
      ]);
      $(this).val('');
      return;
    }
    await importFromZipFile(file);
    $(this).val('');
    $modal.remove();
    showAssetManagerModal(activeTab);
  });

  async function handleGitHubImport() {
    const url = prompt('请输入 GitHub 仓库地址 (例如: user/repo 或 https://github.com/user/repo/tree/main/path):');
    if (url) {
      const success = await AssetIO.importFromGitHub(url.trim());
      if (success) {
        $modal.remove();
        showAssetManagerModal(activeTab);
      }
    }
  }

  $modal.find('#gal-asset-import-json-input').on('change', async function () {
    if (this.files.length > 0) {
      await importAssetsFromJson(this.files[0]);
      $modal.remove();
      showAssetManagerModal(activeTab);
      $(this).val('');
    }
  });

  $modal.on('remove', function () {
    $(topWindow.document).off('click.galImportMenu');
  });
}

