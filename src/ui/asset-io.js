import { SCRIPT_ID, SCRIPT_NAME, DEFAULT_PACK_ID } from '../core/constants.js';
import { $, topWindow } from '../core/env.js';
import { getMapSettings, getSettings, updateMapSettings } from '../core/settings.js';
import { GalgameStore } from '../core/store.js';
import { saveSprite, saveSpritesBatch, getAllSprites } from '../db/sprites.js';
import { saveBackground, saveBackgroundsBatch, getAllBackgrounds } from '../db/backgrounds.js';
import { GLOBAL_MAP_REGION_KEY, getAllMapImages, saveUnifiedMapImage } from '../db/map-images.js';
import { getCurrentPackId, getAllImagePacks, createImagePack } from '../db/image-packs.js';
import { getAllUiSkinAssets, saveUiSkinAsset } from '../db/ui-skins.js';
import { getAllLive2DModels } from '../db/live2d-models.js';
import { getTTSEnabled, getAllCharacterTTSVoices } from '../audio/tts-config.js';
import { CHAR_USE_LIVE2D_KEY, LIVE2D_CONFIG_KEY } from '../live2d/render-mode.js';
import { withResolvedLive2DRuntime } from '../live2d/runtime-router.js';
import { getAllExpressions, getCustomExpressions, saveCustomExpressions } from '../utils/expressions.js';
import { embedCardIntoPngBytes, isPngBytes } from '../utils/png-character-card.js';
import { normalizeLocationStatusIconClass, normalizeTimeStatusIconClass } from '../utils/status-popup-icons.js';
import { getModalMountRoot } from './fullscreen.js';
import { WESTERN_SKIN_ID } from './skin-western-runtime.js';
import { showToast } from './toast.js';
import { makeDraggable } from './interaction.js';

// ============================================
// 资源导入导出管理器 (Asset IO)
// ============================================

const CARD_EXPORT_WARN_LIMIT_BYTES = 10 * 1024 * 1024;
const CARD_EXPORT_HARD_LIMIT_BYTES = 20 * 1024 * 1024;
const CARD_EXPORT_PREFS_KEY = `${SCRIPT_ID}_card_export_prefs`;
const CUSTOM_LOCATION_HTML_KEY = GalgameStore.STORAGE_KEYS.CUSTOM_LOCATION_HTML;
const CUSTOM_TIME_HTML_KEY = GalgameStore.STORAGE_KEYS.CUSTOM_TIME_HTML;
const CUSTOM_LOCATION_ICON_CLASS_KEY = GalgameStore.STORAGE_KEYS.CUSTOM_LOCATION_ICON_CLASS;
const CUSTOM_TIME_ICON_CLASS_KEY = GalgameStore.STORAGE_KEYS.CUSTOM_TIME_ICON_CLASS;
const MAP_IMAGE_CARD_PAYLOAD_SCHEMA = 'galgame_map_image_v1';

function safeJsonParse(text, fallback) {
  try {
    if (text == null || text === '') return fallback;
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function readLocalStorageJson(key, fallback) {
  try {
    return safeJsonParse(localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

function saveLocalStorageJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 写入本地存储失败: ${key}`, e);
  }
}

function normalizeStringList(rawList) {
  const source = Array.isArray(rawList)
    ? rawList
    : (typeof rawList === 'string' ? rawList.split(/\r?\n/) : []);
  return Array.from(
    new Set(
      source
        .map(name => String(name || '').trim())
        .filter(Boolean),
    ),
  );
}

function normalizeMapMarkerStyleValue(value) {
  return String(value || '').trim().toLowerCase() === 'dot' ? 'dot' : 'pin';
}

function normalizeMapCoordsByRegionValue(rawValue) {
  const source = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue) ? rawValue : {};
  const normalized = {};
  Object.entries(source).forEach(([rawRegionKey, rawRegionMap]) => {
    const regionKey = String(rawRegionKey || '').trim();
    if (!regionKey) return;
    const regionMap = rawRegionMap && typeof rawRegionMap === 'object' && !Array.isArray(rawRegionMap)
      ? rawRegionMap
      : {};
    const nextRegion = {};
    Object.entries(regionMap).forEach(([rawLocation, rawCoord]) => {
      const location = String(rawLocation || '').trim();
      if (!location) return;
      const coord = rawCoord && typeof rawCoord === 'object' ? rawCoord : {};
      const x = Number(coord.x);
      const y = Number(coord.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      nextRegion[location] = {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
        anchor: String(coord.anchor || '').trim(),
      };
    });
    normalized[regionKey] = nextRegion;
  });
  return normalized;
}

function mergeMapCoordsByRegion(baseRaw, incomingRaw) {
  const base = normalizeMapCoordsByRegionValue(baseRaw);
  const incoming = normalizeMapCoordsByRegionValue(incomingRaw);
  const merged = { ...base };
  Object.entries(incoming).forEach(([regionKey, regionMap]) => {
    merged[regionKey] = {
      ...(merged[regionKey] || {}),
      ...regionMap,
    };
  });
  return merged;
}

function buildExportableMapSettings() {
  const mapSettings = getMapSettings();
  return {
    mapSystemEnabled: mapSettings.mapSystemEnabled !== false,
    mapUseLocationBarClick: mapSettings.mapUseLocationBarClick !== false,
    mapMarkerStyle: normalizeMapMarkerStyleValue(mapSettings.mapMarkerStyle),
    mapLayoutSeed: String(mapSettings.mapLayoutSeed || 'default').trim() || 'default',
    mapCoordsByRegion: normalizeMapCoordsByRegionValue(mapSettings.mapCoordsByRegion),
  };
}

function applyImportedMapSettings(rawSettings) {
  const hasOwn = Object.prototype.hasOwnProperty;
  const source = rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings)
    ? rawSettings
    : null;
  if (!source) return false;

  const current = buildExportableMapSettings();
  const patch = {};
  let changed = false;

  if (hasOwn.call(source, 'mapSystemEnabled')) {
    patch.mapSystemEnabled = !!source.mapSystemEnabled;
    changed = true;
  }
  if (hasOwn.call(source, 'mapUseLocationBarClick')) {
    patch.mapUseLocationBarClick = !!source.mapUseLocationBarClick;
    changed = true;
  }
  if (hasOwn.call(source, 'mapMarkerStyle')) {
    patch.mapMarkerStyle = normalizeMapMarkerStyleValue(source.mapMarkerStyle);
    changed = true;
  }
  if (hasOwn.call(source, 'mapLayoutSeed')) {
    patch.mapLayoutSeed = String(source.mapLayoutSeed || '').trim() || 'default';
    changed = true;
  }
  if (hasOwn.call(source, 'mapCoordsByRegion')) {
    patch.mapCoordsByRegion = mergeMapCoordsByRegion(current.mapCoordsByRegion, source.mapCoordsByRegion);
    changed = true;
  }

  if (changed) {
    updateMapSettings(patch);
  }
  return changed;
}

function pickPreferredMapRecordFromList(rawList, preferredRegionKey = GLOBAL_MAP_REGION_KEY) {
  const list = Array.isArray(rawList) ? rawList : [];
  if (list.length === 0) return null;
  const preferredKey = String(preferredRegionKey || GLOBAL_MAP_REGION_KEY).trim() || GLOBAL_MAP_REGION_KEY;
  const matched = list.find(item => String(item?.regionKey || '').trim() === preferredKey);
  return matched || list[0] || null;
}

async function buildExportableMapImagePayload(packId = null) {
  const allMaps = await getAllMapImages(packId);
  const preferredMap = pickPreferredMapRecordFromList(allMaps, GLOBAL_MAP_REGION_KEY);
  if (!preferredMap) return null;

  const regionKey = String(preferredMap?.regionKey || GLOBAL_MAP_REGION_KEY).trim() || GLOBAL_MAP_REGION_KEY;
  const imageBlob = preferredMap?.imageBlob;
  if (typeof imageBlob?.arrayBuffer === 'function') {
    const bytes = await imageBlob.arrayBuffer();
    const dataBase64 = arrayBufferToBase64(bytes);
    if (!dataBase64) return null;
    return {
      schema: MAP_IMAGE_CARD_PAYLOAD_SCHEMA,
      source: 'embedded',
      regionKey,
      mimeType: String(imageBlob?.type || 'application/octet-stream').trim() || 'application/octet-stream',
      dataBase64,
    };
  }

  const imageUrl = String(preferredMap?.imageUrl || '').trim();
  if (imageUrl) {
    return {
      schema: MAP_IMAGE_CARD_PAYLOAD_SCHEMA,
      source: 'remote',
      regionKey,
      url: imageUrl,
    };
  }
  return null;
}

function normalizeCardMapImagePayload(rawPayload) {
  if (!rawPayload) return null;
  if (typeof rawPayload === 'string') {
    const remoteUrl = String(rawPayload || '').trim();
    if (!remoteUrl) return null;
    return {
      mode: 'remote',
      regionKey: GLOBAL_MAP_REGION_KEY,
      imageUrl: remoteUrl,
    };
  }
  if (typeof rawPayload !== 'object' || Array.isArray(rawPayload)) return null;

  const source = String(rawPayload.source || '').trim().toLowerCase();
  const regionKey = String(rawPayload.regionKey || GLOBAL_MAP_REGION_KEY).trim() || GLOBAL_MAP_REGION_KEY;
  const remoteUrl = String(rawPayload.url || rawPayload.imageUrl || rawPayload.remoteUrl || '').trim();
  const dataBase64 = String(rawPayload.dataBase64 || rawPayload.base64 || rawPayload.imageBase64 || '').trim();
  const mimeType = String(rawPayload.mimeType || rawPayload.contentType || 'application/octet-stream').trim() || 'application/octet-stream';

  if ((source === 'embedded' || source === 'local') && dataBase64) {
    return {
      mode: 'embedded',
      regionKey,
      mimeType,
      dataBase64,
    };
  }
  if ((source === 'remote' || source === 'url') && remoteUrl) {
    return {
      mode: 'remote',
      regionKey,
      imageUrl: remoteUrl,
    };
  }
  if (dataBase64) {
    return {
      mode: 'embedded',
      regionKey,
      mimeType,
      dataBase64,
    };
  }
  if (remoteUrl) {
    return {
      mode: 'remote',
      regionKey,
      imageUrl: remoteUrl,
    };
  }
  return null;
}

async function applyImportedCardMapImagePayload(rawPayload, targetPackId = null) {
  const normalized = normalizeCardMapImagePayload(rawPayload);
  if (!normalized) return false;

  if (normalized.mode === 'remote') {
    await saveUnifiedMapImage(null, normalized.imageUrl, targetPackId);
    return true;
  }

  const bytes = base64ToUint8Array(normalized.dataBase64);
  if (!bytes || bytes.byteLength <= 0) {
    throw new Error('地图图片 base64 数据无效');
  }
  const blob = new Blob([bytes], { type: normalized.mimeType || 'application/octet-stream' });
  await saveUnifiedMapImage(blob, null, targetPackId);
  return true;
}

function ensureTrailingSlash(url) {
  if (!url) return '';
  return url.endsWith('/') ? url : `${url}/`;
}

function normalizeRemoteInput(input) {
  const raw = String(input || '').trim();
  if (!raw) return { remoteBaseUrl: '', remoteAssetsUrl: '' };
  if (/\.json(\?.*)?$/i.test(raw)) {
    return { remoteBaseUrl: '', remoteAssetsUrl: raw };
  }
  const base = ensureTrailingSlash(raw);
  return { remoteBaseUrl: base, remoteAssetsUrl: `${base}remote_assets.json` };
}

function convertGithubInputToCdn(rawInput) {
  const raw = String(rawInput || '').trim();
  if (!raw) return '';

  if (/^https?:\/\/cdn\.jsdelivr\.net\/gh\//i.test(raw)) {
    return /\.json(\?.*)?$/i.test(raw) ? raw : ensureTrailingSlash(raw);
  }

  const buildCdnUrl = (repo, branch = 'main', path = '') => {
    const safeRepo = String(repo || '').trim().replace(/\.git$/i, '');
    const safeBranch = String(branch || 'main').trim() || 'main';
    const safePath = String(path || '').trim().replace(/^\/+/, '');
    const base = `https://cdn.jsdelivr.net/gh/${safeRepo}@${safeBranch}/`;
    if (!safePath) return base;
    return /\.json(\?.*)?$/i.test(safePath)
      ? `${base}${safePath}`
      : `${base}${safePath.replace(/\/+$/, '')}/`;
  };

  const shortMatch = raw.match(/^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?:@([^/\s]+))?(?:\/(.+))?$/);
  if (shortMatch) {
    return buildCdnUrl(shortMatch[1], shortMatch[2] || 'main', shortMatch[3] || '');
  }

  const githubMatch = raw.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:\/(?:tree|blob)\/([^/\s#?]+)(?:\/([^?#]+))?)?\/?$/i);
  if (githubMatch) {
    const repo = `${githubMatch[1]}/${githubMatch[2]}`;
    const branch = githubMatch[3] || 'main';
    const path = githubMatch[4] || '';
    return buildCdnUrl(repo, branch, path);
  }

  const rawMatch = raw.match(/^https?:\/\/raw\.githubusercontent\.com\/([^/\s]+)\/([^/\s]+)\/([^/\s]+)(?:\/([^?#]+))?\/?$/i);
  if (rawMatch) {
    const repo = `${rawMatch[1]}/${rawMatch[2]}`;
    const branch = rawMatch[3] || 'main';
    const path = rawMatch[4] || '';
    return buildCdnUrl(repo, branch, path);
  }

  return '';
}

function resolveRemoteAddressInput(rawInput, useCdn) {
  const raw = String(rawInput || '').trim();
  if (!raw) {
    return { ok: false, value: '', error: '请输入远程地址' };
  }

  if (useCdn) {
    const converted = convertGithubInputToCdn(raw);
    if (converted) return { ok: true, value: converted, converted: converted !== raw };
  }

  if (!/^https?:\/\//i.test(raw)) {
    return {
      ok: false,
      value: '',
      error: '地址必须是 http:// 或 https://。开启 CDN 套壳后可直接填 user/repo',
    };
  }

  const normalized = /^https?:\/\/cdn\.jsdelivr\.net\/gh\//i.test(raw) && !/\.json(\?.*)?$/i.test(raw)
    ? ensureTrailingSlash(raw)
    : raw;
  return { ok: true, value: normalized, converted: false };
}

function buildLive2dRemoteModelUrl(templateInput, characterId) {
  const raw = String(templateInput || '').trim();
  if (!raw) return '';
  const encodedChar = encodeURIComponent(String(characterId || '').trim());
  if (!encodedChar) return '';
  if (raw.includes('{character}')) {
    return raw.replace(/\{character\}/g, encodedChar);
  }
  if (/\.json(\?.*)?$/i.test(raw)) {
    return raw;
  }
  return `${ensureTrailingSlash(raw)}${encodedChar}/model3.json`;
}

function normalizeRemoteMode(value) {
  return String(value || '').trim().toLowerCase() === 'remote' ? 'remote' : 'local';
}

function normalizeExportOutputFormat(value) {
  return String(value || '').trim().toLowerCase() === 'png' ? 'png' : 'json';
}

function readCardExportPrefs() {
  const raw = readLocalStorageJson(CARD_EXPORT_PREFS_KEY, {});
  return raw && typeof raw === 'object' ? raw : {};
}

function saveCardExportPrefs(prefs) {
  saveLocalStorageJson(CARD_EXPORT_PREFS_KEY, prefs || {});
}

function sanitizeFileName(name) {
  return String(name || 'character').replace(/[\\/:*?"<>|]/g, '_').trim() || 'character';
}

function normalizeUiSkinMetaRecord(raw = {}) {
  const skinId = String(raw.skinId || WESTERN_SKIN_ID).trim() || WESTERN_SKIN_ID;
  const elementId = String(raw.elementId || '').trim();
  const device = String(raw.device || 'desktop').trim() || 'desktop';
  const state = String(raw.state || 'normal').trim() || 'normal';
  if (!elementId) return null;
  return {
    skinId,
    elementId,
    device,
    state,
    scaleMode: String(raw.scaleMode || 'stretch').trim() || 'stretch',
    layout: raw.layout && typeof raw.layout === 'object' ? raw.layout : {},
    slice: raw.slice && typeof raw.slice === 'object' ? raw.slice : {},
    textPadding: raw.textPadding && typeof raw.textPadding === 'object' ? raw.textPadding : {},
    meta: raw.meta && typeof raw.meta === 'object' ? raw.meta : {},
  };
}

function buildUiSkinZipFilename(record, ext = 'png') {
  const safeSkin = sanitizeFileName(record.skinId || WESTERN_SKIN_ID);
  const safeElement = sanitizeFileName(record.elementId || 'element');
  const safeDevice = sanitizeFileName(record.device || 'desktop');
  const safeState = sanitizeFileName(record.state || 'normal');
  const safeExt = sanitizeFileName(ext || 'png');
  return `${safeSkin}__${safeElement}__${safeDevice}__${safeState}.${safeExt}`;
}

function parseUiSkinMetaFromFilename(fileName) {
  const baseName = String(fileName || '').replace(/\.[^.]+$/, '');
  const parts = baseName.split('__');
  if (parts.length < 4) return null;
  return normalizeUiSkinMetaRecord({
    skinId: parts[0],
    elementId: parts[1],
    device: parts[2],
    state: parts.slice(3).join('__') || 'normal',
  });
}

function escapeHtml(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDialogText(input) {
  return escapeHtml(input).replace(/\r?\n/g, '<br>');
}

let inAppDialogCounter = 0;
function nextInAppDialogId(prefix = 'gal-inline-dialog') {
  inAppDialogCounter += 1;
  return `${prefix}-${Date.now()}-${inAppDialogCounter}`;
}

export function showInAppPromptDialog(options = {}) {
  const {
    title = '请输入',
    message = '',
    hint = '',
    label = '',
    placeholder = '',
    defaultValue = '',
    confirmText = '确认',
    cancelText = '取消',
    iconClass = 'fa-solid fa-pen-to-square',
    accent = '#0d6efd',
    required = false,
    requiredMessage = '请输入内容',
    trim = true,
    inputType = 'text',
    multiline = false,
    width = '520px',
  } = options;

  const dialogId = nextInAppDialogId('gal-inline-prompt');
  const closeId = `${dialogId}-close`;
  const cancelId = `${dialogId}-cancel`;
  const confirmId = `${dialogId}-confirm`;
  const inputId = `${dialogId}-input`;

  const messageHtml = message
    ? `<div style="margin-bottom: 12px; color: #555; font-size: 0.92rem; line-height: 1.6;">${formatDialogText(message)}</div>`
    : '';
  const hintHtml = hint
    ? `<div style="margin-top: 8px; color: #7a7a7a; font-size: 0.82rem; line-height: 1.5;">${formatDialogText(hint)}</div>`
    : '';
  const labelHtml = label
    ? `<label for="${inputId}" style="display: block; margin-bottom: 8px; color: #444; font-size: 0.9rem; font-weight: 600;">${escapeHtml(label)}</label>`
    : '';
  const inputHtml = multiline
    ? `<textarea id="${inputId}" placeholder="${escapeHtml(placeholder)}" style="width: 100%; min-height: 110px; padding: 10px 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 0.95rem; box-sizing: border-box; resize: vertical;">${escapeHtml(defaultValue)}</textarea>`
    : `<input id="${inputId}" type="${escapeHtml(inputType)}" value="${escapeHtml(defaultValue)}" placeholder="${escapeHtml(placeholder)}" style="width: 100%; padding: 10px 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 0.95rem; box-sizing: border-box;" />`;

  const html = `
    <div class="gal-input-modal gal-z-critical" id="${dialogId}">
      <div class="gal-input-box" style="max-width: ${escapeHtml(width)}; width: 92%; padding: 24px;">
        <div class="gal-input-title" style="margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
          <span><i class="${escapeHtml(iconClass)}" style="color: ${escapeHtml(accent)};"></i> ${escapeHtml(title)}</span>
          <button id="${closeId}" title="关闭" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px; line-height: 1; transition: color 0.2s;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        ${messageHtml}
        <div style="margin-bottom: 14px;">
          ${labelHtml}
          ${inputHtml}
          ${hintHtml}
        </div>
        <div class="gal-input-actions" style="display: flex; gap: 10px;">
          <button class="gal-action-btn" id="${cancelId}" style="flex: 1; min-height: 42px; justify-content: center; background: #6c757d; color: #fff; border-color: #6c757d;">
            <i class="fa-solid fa-xmark"></i> <span>${escapeHtml(cancelText)}</span>
          </button>
          <button class="gal-action-btn" id="${confirmId}" style="flex: 1; min-height: 42px; justify-content: center; background: ${escapeHtml(accent)}; color: #fff; border-color: ${escapeHtml(accent)};">
            <i class="fa-solid fa-check"></i> <span>${escapeHtml(confirmText)}</span>
          </button>
        </div>
      </div>
    </div>
  `;

  return new Promise((resolve) => {
    const mountRoot = getModalMountRoot();
    $(mountRoot).append(html);
    const $dialog = $(mountRoot).find(`#${dialogId}`);
    const $box = $dialog.find('.gal-input-box');
    const $input = $dialog.find(`#${inputId}`);
    makeDraggable($box, $dialog.find('.gal-input-title'));

    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      $dialog.remove();
      resolve(value);
    };

    const submit = () => {
      const raw = String($input.val() ?? '');
      const value = trim ? raw.trim() : raw;
      if (required && !value) {
        showToast(requiredMessage);
        $input.trigger('focus');
        return;
      }
      done(value);
    };

    $dialog.find(`#${confirmId}`).on('click', submit);
    $dialog.find(`#${cancelId}`).on('click', () => done(null));
    $dialog.find(`#${closeId}`).on('click', () => done(null));

    $dialog.on('click', function (e) {
      if (e.target === this) done(null);
    });
    $dialog.on('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        done(null);
      }
    });
    $input.on('keydown', function (e) {
      const shouldSubmit = multiline
        ? e.key === 'Enter' && (e.ctrlKey || e.metaKey)
        : e.key === 'Enter';
      if (shouldSubmit) {
        e.preventDefault();
        submit();
      }
    });

    setTimeout(() => {
      $input.trigger('focus');
      const el = $input.get(0);
      if (el && !multiline && typeof el.setSelectionRange === 'function') {
        const len = String($input.val() || '').length;
        el.setSelectionRange(len, len);
      }
    }, 0);
  });
}

export function showInAppConfirmDialog(options = {}) {
  const {
    title = '请确认',
    message = '',
    hint = '',
    confirmText = '确认',
    cancelText = '取消',
    iconClass = 'fa-solid fa-circle-question',
    accent = '#0d6efd',
    width = '500px',
    danger = false,
  } = options;

  const dialogId = nextInAppDialogId('gal-inline-confirm');
  const closeId = `${dialogId}-close`;
  const cancelId = `${dialogId}-cancel`;
  const confirmId = `${dialogId}-confirm`;

  const messageHtml = message
    ? `<div style="margin-bottom: 10px; color: #555; font-size: 0.92rem; line-height: 1.6; white-space: normal;">${formatDialogText(message)}</div>`
    : '';
  const hintHtml = hint
    ? `<div style="margin-bottom: 4px; color: #7a7a7a; font-size: 0.82rem; line-height: 1.5;">${formatDialogText(hint)}</div>`
    : '';
  const confirmColor = danger ? '#dc3545' : accent;

  const html = `
    <div class="gal-input-modal gal-z-critical" id="${dialogId}">
      <div class="gal-input-box" style="max-width: ${escapeHtml(width)}; width: 90%; padding: 24px;">
        <div class="gal-input-title" style="margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
          <span><i class="${escapeHtml(iconClass)}" style="color: ${escapeHtml(confirmColor)};"></i> ${escapeHtml(title)}</span>
          <button id="${closeId}" title="关闭" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px; line-height: 1;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div style="margin-bottom: 16px; padding: 12px 14px; background: #f8f9fa; border-radius: 8px; border-left: 3px solid ${escapeHtml(confirmColor)};">
          ${messageHtml}
          ${hintHtml}
        </div>
        <div class="gal-input-actions" style="display: flex; gap: 10px;">
          <button class="gal-action-btn" id="${cancelId}" style="flex: 1; min-height: 42px; justify-content: center; background: #6c757d; color: #fff; border-color: #6c757d;">
            <i class="fa-solid fa-xmark"></i> <span>${escapeHtml(cancelText)}</span>
          </button>
          <button class="gal-action-btn" id="${confirmId}" style="flex: 1; min-height: 42px; justify-content: center; background: ${escapeHtml(confirmColor)}; color: #fff; border-color: ${escapeHtml(confirmColor)};">
            <i class="fa-solid fa-check"></i> <span>${escapeHtml(confirmText)}</span>
          </button>
        </div>
      </div>
    </div>
  `;

  return new Promise((resolve) => {
    const mountRoot = getModalMountRoot();
    $(mountRoot).append(html);
    const $dialog = $(mountRoot).find(`#${dialogId}`);
    makeDraggable($dialog.find('.gal-input-box'), $dialog.find('.gal-input-title'));

    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      $dialog.remove();
      resolve(value);
    };

    $dialog.find(`#${confirmId}`).on('click', () => done(true));
    $dialog.find(`#${cancelId}`).on('click', () => done(false));
    $dialog.find(`#${closeId}`).on('click', () => done(false));
    $dialog.on('click', function (e) {
      if (e.target === this) done(false);
    });
    $dialog.on('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        done(false);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        done(true);
      }
    });

    setTimeout(() => {
      $dialog.find(`#${confirmId}`).trigger('focus');
    }, 0);
  });
}

export function showInAppAlertDialog(options = {}) {
  const {
    title = '提示',
    message = '',
    details = '',
    buttonText = '我知道了',
    iconClass = 'fa-solid fa-circle-info',
    accent = '#0d6efd',
    width = '560px',
  } = options;

  const detailLines = Array.isArray(details)
    ? details.map(v => String(v || '').trim()).filter(Boolean)
    : String(details || '').trim()
      ? [String(details || '').trim()]
      : [];
  const detailHtml = detailLines.length > 0
    ? `
      <div style="margin-top: 10px; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 10px 12px; max-height: 220px; overflow-y: auto;">
        ${detailLines.map(line => `<div style="font-size: 0.88rem; line-height: 1.55; color: #555; white-space: pre-wrap; margin-bottom: 4px;">${formatDialogText(line)}</div>`).join('')}
      </div>
    `
    : '';

  const dialogId = nextInAppDialogId('gal-inline-alert');
  const closeId = `${dialogId}-close`;
  const okId = `${dialogId}-ok`;

  const html = `
    <div class="gal-input-modal gal-z-critical" id="${dialogId}">
      <div class="gal-input-box" style="max-width: ${escapeHtml(width)}; width: 92%; padding: 24px;">
        <div class="gal-input-title" style="margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
          <span><i class="${escapeHtml(iconClass)}" style="color: ${escapeHtml(accent)};"></i> ${escapeHtml(title)}</span>
          <button id="${closeId}" title="关闭" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px; line-height: 1;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div style="margin-bottom: 16px; color: #555; font-size: 0.93rem; line-height: 1.65; white-space: normal;">
          ${formatDialogText(message)}
          ${detailHtml}
        </div>
        <div class="gal-input-actions" style="display: flex; justify-content: flex-end;">
          <button class="gal-action-btn" id="${okId}" style="min-width: 130px; min-height: 42px; justify-content: center; background: ${escapeHtml(accent)}; color: #fff; border-color: ${escapeHtml(accent)};">
            <i class="fa-solid fa-check"></i> <span>${escapeHtml(buttonText)}</span>
          </button>
        </div>
      </div>
    </div>
  `;

  return new Promise((resolve) => {
    const mountRoot = getModalMountRoot();
    $(mountRoot).append(html);
    const $dialog = $(mountRoot).find(`#${dialogId}`);
    makeDraggable($dialog.find('.gal-input-box'), $dialog.find('.gal-input-title'));

    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      $dialog.remove();
      resolve();
    };

    $dialog.find(`#${okId}`).on('click', done);
    $dialog.find(`#${closeId}`).on('click', done);
    $dialog.on('click', function (e) {
      if (e.target === this) done();
    });
    $dialog.on('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        done();
      }
    });

    setTimeout(() => {
      $dialog.find(`#${okId}`).trigger('focus');
    }, 0);
  });
}

function downloadTextFile(filename, text, mimeType = 'application/json') {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadBlob(filename, blob) {
  if (!(blob instanceof Blob)) {
    throw new Error('无效的下载数据');
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function collectAvatarFieldsFromCharacterObject(target, add) {
  if (!target || typeof target !== 'object') return;
  add(target.avatar);
  add(target.avatar_url);
  add(target.image);
  add(target.image_url);
  add(target.portrait);
  add(target.thumbnail);
  add(target.img);
  add(target.icon);
  const data = target.data;
  if (data && typeof data === 'object') {
    add(data.avatar);
    add(data.avatar_url);
    add(data.image);
    add(data.image_url);
    add(data.portrait);
    add(data.thumbnail);
    add(data.img);
    add(data.icon);
  }
}

function collectCurrentCharacterAvatarCandidates(options = {}) {
  const {
    resolvedCard = null,
    fallbackCharacter = null,
    resolvedName = '',
  } = options;
  const candidates = [];
  const seen = new Set();
  const add = (value) => {
    const text = String(value || '').trim();
    if (!text) return;
    if (seen.has(text)) return;
    seen.add(text);
    candidates.push(text);
  };

  collectAvatarFieldsFromCharacterObject(resolvedCard, add);
  collectAvatarFieldsFromCharacterObject(fallbackCharacter, add);

  const ctx = getSillyTavernContextSafe();
  if (ctx?.characters && ctx?.characterId != null) {
    collectAvatarFieldsFromCharacterObject(ctx.characters[ctx.characterId], add);
  }

  const st = topWindow?.SillyTavern;
  if (st?.characters && st?.characterId != null) {
    collectAvatarFieldsFromCharacterObject(st.characters[st.characterId], add);
  }

  const safeName = String(resolvedName || '').trim();
  if (safeName) {
    add(`/thumbnail?type=avatar&file=${encodeURIComponent(safeName)}`);
    add(`/thumbnail?type=avatar&file=${encodeURIComponent(`${safeName}.png`)}`);
  }
  return candidates;
}

function expandAvatarCandidateUrls(rawCandidate) {
  const raw = String(rawCandidate || '').trim();
  if (!raw) return [];
  if (/^data:image\//i.test(raw)) return [raw];
  if (/^blob:/i.test(raw)) return [raw];
  if (/^https?:\/\//i.test(raw)) return [raw];

  const out = [];
  const seen = new Set();
  const add = (url) => {
    const text = String(url || '').trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    out.push(text);
  };

  add(raw);
  if (!raw.startsWith('/')) {
    add(`/${raw}`);
    add(`./${raw}`);
  }

  const normalizedPath = raw.replace(/^\/+/, '');
  if (normalizedPath) {
    add(`/thumbnail?type=avatar&file=${encodeURIComponent(normalizedPath)}`);
    const fileName = normalizedPath.split('/').pop();
    if (fileName && fileName !== normalizedPath) {
      add(`/thumbnail?type=avatar&file=${encodeURIComponent(fileName)}`);
    }
  }

  return out;
}

async function fetchImageBlobByUrl(url) {
  const targetUrl = String(url || '').trim();
  if (!targetUrl) return null;
  try {
    const response = await fetch(targetUrl, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!(blob instanceof Blob)) return null;
    const type = String(blob.type || '').toLowerCase();
    if (!type.startsWith('image/')) return null;
    return blob;
  } catch {
    return null;
  }
}

function loadImageElementFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error('加载头像图片失败'));
    };
    image.src = imageUrl;
  });
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('图片转换 PNG 失败'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

async function convertImageBlobToPngBytes(blob) {
  const type = String(blob?.type || '').toLowerCase();
  if (type === 'image/png') {
    return new Uint8Array(await blob.arrayBuffer());
  }

  const image = await loadImageElementFromBlob(blob);
  const width = Math.max(1, Number(image.naturalWidth || image.width || 0));
  const height = Math.max(1, Number(image.naturalHeight || image.height || 0));
  const doc = topWindow?.document || document;
  const canvas = doc.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('创建图片画布失败');
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  const pngBlob = await canvasToPngBlob(canvas);
  return new Uint8Array(await pngBlob.arrayBuffer());
}

async function tryResolveCurrentCharacterAvatarPngBytes(options = {}) {
  const candidates = collectCurrentCharacterAvatarCandidates(options);
  if (candidates.length === 0) {
    return { ok: false, error: '未检测到当前角色头像字段' };
  }

  for (const candidate of candidates) {
    const urls = expandAvatarCandidateUrls(candidate);
    for (const url of urls) {
      const blob = await fetchImageBlobByUrl(url);
      if (!blob) continue;
      try {
        const pngBytes = await convertImageBlobToPngBytes(blob);
        if (isPngBytes(pngBytes)) {
          return { ok: true, value: pngBytes, source: url };
        }
      } catch {
        // try next source
      }
    }
  }

  return { ok: false, error: '自动获取头像失败，未找到可用图片资源' };
}

function showPngBaseFallbackSelectorDialog(options = {}) {
  const reason = String(options.reason || '').trim();
  const dialogId = nextInAppDialogId('gal-png-base-fallback');
  const closeId = `${dialogId}-close`;
  const cancelId = `${dialogId}-cancel`;
  const confirmId = `${dialogId}-confirm`;
  const pickFileId = `${dialogId}-pick-file`;
  const fileInputId = `${dialogId}-file`;
  const fileNameId = `${dialogId}-file-name`;
  const reasonHtml = reason
    ? `<div style="margin-bottom: 10px; font-size: 0.84rem; color: #b45309; line-height: 1.5;">自动头像失败：${escapeHtml(reason)}</div>`
    : '';

  const dialogHtml = `
    <div class="gal-input-modal gal-z-critical" id="${dialogId}">
      <div class="gal-input-box" style="max-width: 520px; width: 92%; padding: 22px;">
        <div class="gal-input-title" style="margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
          <span><i class="fa-solid fa-image" style="color: #0d6efd;"></i> 选择 PNG 底图</span>
          <button id="${closeId}" title="关闭" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px; line-height: 1;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div style="margin-bottom: 12px; color: #555; font-size: 0.9rem; line-height: 1.6;">
          自动获取当前角色头像失败，请手动选择 PNG 文件继续导出。
        </div>
        ${reasonHtml}
        <div style="margin-bottom: 14px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <input id="${fileInputId}" type="file" accept=".png,image/png"
                 style="position: absolute; left: -10000px; width: 1px; height: 1px; opacity: 0; pointer-events: none;" />
          <button class="gal-action-btn" id="${pickFileId}" style="min-height: 40px; justify-content: center; background: #f8f9fa; color: #333; border: 1px solid #d1d5db;">
            <i class="fa-solid fa-folder-open"></i> <span>选择 PNG 文件</span>
          </button>
          <span id="${fileNameId}" style="font-size: 0.86rem; color: #666; word-break: break-all;">未选择文件</span>
        </div>
        <div class="gal-input-actions" style="display: flex; gap: 10px;">
          <button class="gal-action-btn" id="${cancelId}" style="flex: 1; min-height: 42px; justify-content: center; background: #6c757d; color: #fff; border-color: #6c757d;">
            <i class="fa-solid fa-xmark"></i> <span>取消</span>
          </button>
          <button class="gal-action-btn" id="${confirmId}" style="flex: 1; min-height: 42px; justify-content: center; background: #0d6efd; color: #fff; border-color: #0d6efd;">
            <i class="fa-solid fa-check"></i> <span>继续导出</span>
          </button>
        </div>
      </div>
    </div>
  `;

  return new Promise((resolve) => {
    const mountRoot = getModalMountRoot();
    $(mountRoot).append(dialogHtml);
    const $dialog = $(mountRoot).find(`#${dialogId}`);
    makeDraggable($dialog.find('.gal-input-box'), $dialog.find('.gal-input-title'));

    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      $dialog.remove();
      resolve(value);
    };

    const $fileInput = $dialog.find(`#${fileInputId}`);
    const fileInputEl = $fileInput.get(0);
    const $fileName = $dialog.find(`#${fileNameId}`);
    let pendingSubmitAfterPick = false;

    const openFilePicker = () => {
      if (fileInputEl && typeof fileInputEl.click === 'function') {
        fileInputEl.click();
      }
    };

    const updatePickedFileName = (file) => {
      if (!file) {
        $fileName.text('未选择文件');
        return;
      }
      $fileName.text(String(file.name || '未命名文件'));
    };

    const validatePngFile = (file) => {
      if (!file) return { ok: false, message: '请选择 PNG 底图文件' };
      const fileName = String(file.name || '').toLowerCase();
      const mimeType = String(file.type || '').toLowerCase();
      if (!fileName.endsWith('.png') && mimeType !== 'image/png') {
        return { ok: false, message: '底图文件必须是 PNG 格式' };
      }
      return { ok: true };
    };

    $dialog.find(`#${pickFileId}`).on('click', () => {
      pendingSubmitAfterPick = false;
      openFilePicker();
    });

    $fileInput.on('change', () => {
      const picked = fileInputEl?.files?.[0] || null;
      const check = validatePngFile(picked);
      if (!check.ok) {
        if (picked) {
          showToast(check.message);
          if (fileInputEl) fileInputEl.value = '';
        }
        updatePickedFileName(null);
        return;
      }
      updatePickedFileName(picked);
      if (pendingSubmitAfterPick && picked) {
        pendingSubmitAfterPick = false;
        done(picked);
      }
    });

    const submit = () => {
      const file = fileInputEl?.files?.[0] || null;
      const check = validatePngFile(file);
      if (!check.ok) {
        pendingSubmitAfterPick = true;
        showToast(check.message);
        openFilePicker();
        return;
      }
      pendingSubmitAfterPick = false;
      done(file);
    };

    $dialog.find(`#${confirmId}`).on('click', submit);
    $dialog.find(`#${cancelId}`).on('click', () => done(null));
    $dialog.find(`#${closeId}`).on('click', () => done(null));
    $dialog.on('click', function (e) {
      if (e.target === this) done(null);
    });
    setTimeout(() => {
      $dialog.find(`#${pickFileId}`).trigger('focus');
    }, 0);
  });
}

function toArrayBuffer(input) {
  if (!input) return null;
  if (input instanceof ArrayBuffer) return input;
  if (ArrayBuffer.isView(input)) {
    return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  }
  return null;
}

function safeByteLength(input) {
  const buf = toArrayBuffer(input);
  if (buf) return buf.byteLength;
  if (typeof Blob !== 'undefined' && input instanceof Blob) return input.size || 0;
  if (typeof input?.size === 'number') return input.size;
  return 0;
}

function formatSizeMb(bytes) {
  const n = Number(bytes) || 0;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function arrayBufferToBase64(buffer) {
  const safeBuffer = toArrayBuffer(buffer);
  if (!safeBuffer) return '';
  const bytes = new Uint8Array(safeBuffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToUint8Array(base64) {
  const raw = String(base64 || '').replace(/\s+/g, '');
  if (!raw) return null;
  try {
    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function encodeBlobToInlineAsset(blobLike, fallbackMimeType = 'application/octet-stream') {
  const blob = blobLike && typeof blobLike.arrayBuffer === 'function'
    ? blobLike
    : null;
  if (!blob) return null;
  const bytes = await blob.arrayBuffer();
  const dataBase64 = arrayBufferToBase64(bytes);
  if (!dataBase64) return null;
  const mimeType = String(blob?.type || fallbackMimeType || 'application/octet-stream').trim() || 'application/octet-stream';
  return {
    dataBase64,
    sizeBytes: bytes.byteLength,
    mimeType,
  };
}

function estimateLive2DModelSizeBytes(modelData) {
  if (!modelData || typeof modelData !== 'object') return 0;
  if (Number.isFinite(modelData.fileSize) && modelData.fileSize > 0) {
    return Number(modelData.fileSize);
  }

  let total = 0;
  total += safeByteLength(modelData.moc3);
  total += safeByteLength(modelData.moc);
  total += safeByteLength(modelData.physics);
  total += safeByteLength(modelData.pose);

  if (Array.isArray(modelData.textures)) {
    for (const tex of modelData.textures) total += safeByteLength(tex?.data);
  }

  if (modelData.motions && typeof modelData.motions === 'object') {
    for (const list of Object.values(modelData.motions)) {
      if (!Array.isArray(list)) continue;
      for (const item of list) total += safeByteLength(item?.data);
    }
  }

  if (Array.isArray(modelData.expressions)) {
    for (const expr of modelData.expressions) total += safeByteLength(expr?.data);
  }

  return total;
}

function ensureCardExtensions(card) {
  if (!card || typeof card !== 'object') {
    throw new Error('当前角色卡数据无效');
  }
  const data = card.data && typeof card.data === 'object' ? card.data : card;
  if (!data.extensions || typeof data.extensions !== 'object') {
    data.extensions = {};
  }
  return data.extensions;
}

function toCardString(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function toCardStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => String(item ?? '').trim())
    .filter(Boolean);
}

function toCardNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeCardTags(card, data) {
  if (Array.isArray(data?.tags)) return toCardStringArray(data.tags);
  if (Array.isArray(card?.tags)) return toCardStringArray(card.tags);
  return [];
}

function ensureCharacterCardImportCompatibility(card) {
  if (!card || typeof card !== 'object') {
    throw new Error('角色卡数据无效');
  }

  const data = card.data && typeof card.data === 'object'
    ? card.data
    : (card.data = {});
  const dataExt = data.extensions && typeof data.extensions === 'object'
    ? data.extensions
    : (data.extensions = {});

  const name = toCardString(data.name || card.name, 'character');
  const description = toCardString(data.description || card.description, '');
  const personality = toCardString(data.personality || card.personality, '');
  const scenario = toCardString(data.scenario || card.scenario, '');
  const firstMes = toCardString(data.first_mes || card.first_mes, '');
  const mesExample = toCardString(data.mes_example || card.mes_example, '');
  const creatorNotes = toCardString(data.creator_notes || card.creatorcomment, '');
  const creator = toCardString(data.creator || card.creator, '');
  const systemPrompt = toCardString(data.system_prompt, '');
  const postHistoryInstructions = toCardString(data.post_history_instructions, '');
  const characterVersion = toCardString(data.character_version, '');
  const tags = normalizeCardTags(card, data);
  const alternateGreetings = toCardStringArray(data.alternate_greetings);

  data.name = name;
  data.description = description;
  data.personality = personality;
  data.scenario = scenario;
  data.first_mes = firstMes;
  data.mes_example = mesExample;
  data.creator_notes = creatorNotes;
  data.creator = creator;
  data.system_prompt = systemPrompt;
  data.post_history_instructions = postHistoryInstructions;
  data.character_version = characterVersion;
  data.tags = tags;
  data.alternate_greetings = alternateGreetings;
  if (!data.character_book || typeof data.character_book !== 'object') {
    data.character_book = { name: '', entries: [] };
  }
  if (!Array.isArray(data.character_book.entries)) {
    data.character_book.entries = [];
  }

  dataExt.talkativeness = toCardNumber(
    dataExt.talkativeness ?? card.talkativeness,
    0.5,
  );
  dataExt.fav = !!(dataExt.fav ?? card.fav);

  card.spec = toCardString(card.spec, 'chara_card_v2');
  card.spec_version = toCardString(card.spec_version, '2.0');
  card.name = name;
  card.description = description;
  card.personality = personality;
  card.scenario = scenario;
  card.first_mes = firstMes;
  card.mes_example = mesExample;
  card.creatorcomment = creatorNotes;
  card.creator = creator;
  card.tags = tags;
  card.talkativeness = dataExt.talkativeness;
  card.fav = dataExt.fav;
  card.avatar = toCardString(card.avatar, 'none');
  card.chat = toCardString(card.chat, `${name} - ${new Date().toISOString()}`);
  card.create_date = toCardString(card.create_date, new Date().toISOString());

  delete card.json_data;
  delete card.shallow;
  delete card.chat_size;
  delete card.date_added;
  delete card.date_last_chat;
  delete card.data_size;

  return card;
}

async function buildGalgameCardConfig(options = {}) {
  const {
    remoteInput = '',
    includeAllPacks = true,
    selectedPackId = '',
    spriteResourceMode = '',
    spriteRemoteInput = '',
    backgroundResourceMode = '',
    backgroundRemoteInput = '',
    live2dResourceMode = '',
    live2dRemoteInput = '',
    includeLocalLive2dPlaceholder = true,
    includeCustomModuleSettings = true,
    includeBgmSettings = true,
    onProgress = null,
  } = options;
  const reportProgress = typeof onProgress === 'function'
    ? (percent, text) => onProgress(Math.max(0, Math.min(100, Number(percent) || 0)), text)
    : () => {};

  reportProgress(8, 'Loading packs and base export config...');
  const currentPackId = getCurrentPackId() || DEFAULT_PACK_ID;
  let packs = await getAllImagePacks();
  if (!Array.isArray(packs) || packs.length === 0) {
    packs = [{ id: DEFAULT_PACK_ID, name: '未定义', isDefault: true }];
  }

  const activePackId = includeAllPacks
    ? String(currentPackId)
    : String(selectedPackId || currentPackId || DEFAULT_PACK_ID);

  const normalizedSpriteMode = normalizeRemoteMode(
    spriteResourceMode || ((String(spriteRemoteInput || remoteInput || '').trim()) ? 'remote' : 'local'),
  );
  const normalizedBackgroundMode = normalizeRemoteMode(
    backgroundResourceMode || ((String(backgroundRemoteInput || remoteInput || '').trim()) ? 'remote' : 'local'),
  );
  const normalizedSpriteRemote = normalizedSpriteMode === 'remote'
    ? normalizeRemoteInput(spriteRemoteInput || remoteInput || '')
    : { remoteBaseUrl: '', remoteAssetsUrl: '' };
  const normalizedBackgroundRemote = normalizedBackgroundMode === 'remote'
    ? normalizeRemoteInput(backgroundRemoteInput || remoteInput || '')
    : { remoteBaseUrl: '', remoteAssetsUrl: '' };
  const normalizedLive2dMode = normalizeRemoteMode(
    live2dResourceMode || ((String(live2dRemoteInput || '').trim()) ? 'remote' : 'local'),
  );
  const resolvedLive2dRemoteInput = String(live2dRemoteInput || '').trim();
  const normalizedLive2dRemote = normalizedLive2dMode === 'remote' && resolvedLive2dRemoteInput
    ? normalizeRemoteInput(resolvedLive2dRemoteInput)
    : { remoteBaseUrl: '', remoteAssetsUrl: '' };

  const isUnifiedPackRemote =
    normalizedSpriteMode === 'remote'
    && normalizedBackgroundMode === 'remote'
    && String(normalizedSpriteRemote.remoteAssetsUrl || '')
    && normalizedSpriteRemote.remoteAssetsUrl === normalizedBackgroundRemote.remoteAssetsUrl
    && normalizedSpriteRemote.remoteBaseUrl === normalizedBackgroundRemote.remoteBaseUrl;

  const packList = includeAllPacks
    ? packs
    : packs.filter(p => p && String(p.id) === String(activePackId));

  const exportedPacks = packList.map(p => {
    const packId = String(p.id || DEFAULT_PACK_ID);
    const name = String(p.name || '未定义');
    const out = { packId, name };
    if (packId === activePackId && isUnifiedPackRemote) {
      if (normalizedSpriteRemote.remoteBaseUrl) out.remoteBaseUrl = normalizedSpriteRemote.remoteBaseUrl;
      if (normalizedSpriteRemote.remoteAssetsUrl) out.remoteAssetsUrl = normalizedSpriteRemote.remoteAssetsUrl;
    }
    return out;
  });

  reportProgress(18, 'Loading TTS and Live2D settings...');
  const ttsEnabled = !!getTTSEnabled();
  const characterVoice = getAllCharacterTTSVoices() || {};
  const settings = getSettings();

  const live2dEnabledMap = readLocalStorageJson(CHAR_USE_LIVE2D_KEY, {});
  const live2dConfigMap = readLocalStorageJson(LIVE2D_CONFIG_KEY, {});
  const live2dModels = await getAllLive2DModels();
  const live2dList = Array.isArray(live2dModels) ? live2dModels : [];
  const live2dOutModels = {};
  const warnings = [];
  const embeddedAssets = {
    sprites: [],
    backgrounds: [],
  };
  const embeddedAssetStats = {
    spriteBytes: 0,
    backgroundBytes: 0,
  };

  if ((normalizedSpriteMode === 'remote' || normalizedBackgroundMode === 'remote') && !isUnifiedPackRemote) {
    warnings.push(
      '[Assets] 立绘/背景采用了分离资源模式。旧版仅识别 packs.remote*，请使用支持 assets.resourceModes 的版本导入。',
    );
  }

  const packIds = Array.from(
    new Set(
      packList
        .map(p => String(p?.id || '').trim())
        .filter(Boolean),
    ),
  );

  if (normalizedSpriteMode === 'local') {
    reportProgress(22, 'Embedding local sprite assets into card config...');
    let skippedNoDataCount = 0;
    for (const packId of packIds) {
      const sprites = await getAllSprites(packId);
      for (const rawSprite of Array.isArray(sprites) ? sprites : []) {
        const characterId = String(rawSprite?.characterId || '').trim();
        const expression = String(rawSprite?.expression || '').trim();
        if (!characterId || !expression) continue;
        const record = {
          packId: String(rawSprite?.packId || packId || DEFAULT_PACK_ID).trim() || DEFAULT_PACK_ID,
          characterId,
          expression,
        };
        const encoded = await encodeBlobToInlineAsset(rawSprite?.imageBlob, 'image/png');
        if (encoded) {
          record.source = 'embedded';
          record.mimeType = encoded.mimeType;
          record.dataBase64 = encoded.dataBase64;
          record.sizeBytes = encoded.sizeBytes;
          embeddedAssetStats.spriteBytes += encoded.sizeBytes;
          embeddedAssets.sprites.push(record);
          continue;
        }
        const fallbackUrl = String(rawSprite?.imageUrl || '').trim();
        if (fallbackUrl) {
          record.source = 'remote';
          record.url = fallbackUrl;
          embeddedAssets.sprites.push(record);
          continue;
        }
        skippedNoDataCount += 1;
      }
    }
    if (skippedNoDataCount > 0) {
      warnings.push(`[Assets] 有 ${skippedNoDataCount} 条立绘缺失可导出的本地数据，已跳过。`);
    }
  }

  if (normalizedBackgroundMode === 'local') {
    reportProgress(26, 'Embedding local background assets into card config...');
    let skippedNoDataCount = 0;
    for (const packId of packIds) {
      const backgrounds = await getAllBackgrounds(packId);
      for (const rawBackground of Array.isArray(backgrounds) ? backgrounds : []) {
        const sceneName = String(rawBackground?.sceneName || '').trim();
        if (!sceneName) continue;
        const record = {
          packId: String(rawBackground?.packId || packId || DEFAULT_PACK_ID).trim() || DEFAULT_PACK_ID,
          sceneName,
        };
        const encoded = await encodeBlobToInlineAsset(rawBackground?.imageBlob, 'image/png');
        if (encoded) {
          record.source = 'embedded';
          record.mimeType = encoded.mimeType;
          record.dataBase64 = encoded.dataBase64;
          record.sizeBytes = encoded.sizeBytes;
          embeddedAssetStats.backgroundBytes += encoded.sizeBytes;
          embeddedAssets.backgrounds.push(record);
          continue;
        }
        const fallbackUrl = String(rawBackground?.imageUrl || '').trim();
        if (fallbackUrl) {
          record.source = 'remote';
          record.url = fallbackUrl;
          embeddedAssets.backgrounds.push(record);
          continue;
        }
        skippedNoDataCount += 1;
      }
    }
    if (skippedNoDataCount > 0) {
      warnings.push(`[Assets] 有 ${skippedNoDataCount} 条背景缺失可导出的本地数据，已跳过。`);
    }
  }

  const embeddedAssetTotalBytes = embeddedAssetStats.spriteBytes + embeddedAssetStats.backgroundBytes;
  if (embeddedAssetTotalBytes > 0) {
    warnings.push(
      `[Assets] 本地模式已内嵌资源：立绘 ${formatSizeMb(embeddedAssetStats.spriteBytes)}，背景 ${formatSizeMb(embeddedAssetStats.backgroundBytes)}。`,
    );
  }

  if (live2dList.length === 0) {
    reportProgress(68, 'No Live2D models detected, skipping local placeholder stage');
  }

  for (let i = 0; i < live2dList.length; i++) {
    const model = withResolvedLive2DRuntime(live2dList[i]);
    const stepPercent = 24 + Math.round((i / Math.max(1, live2dList.length)) * 40);
    reportProgress(stepPercent, `Processing Live2D model ${i + 1}/${live2dList.length}...`);
    const characterId = String(model?.modelId || '').trim();
    if (!characterId) {
      reportProgress(24 + Math.round(((i + 1) / Math.max(1, live2dList.length)) * 40), `Processed Live2D model ${i + 1}/${live2dList.length}`);
      continue;
    }
    const charCfg = live2dConfigMap && typeof live2dConfigMap === 'object' ? live2dConfigMap[characterId] : null;

    if (normalizedLive2dMode === 'remote') {
      if (model?.source === 'remote' && typeof model?.modelUrl === 'string' && model.modelUrl.trim()) {
        live2dOutModels[characterId] = {
          source: 'remote',
          modelUrl: model.modelUrl.trim(),
          runtimeType: model.runtimeType || 'legacy',
          cubismVersion: Number(model?.cubismVersion || 0) || null,
          ...(charCfg ? { config: charCfg } : {}),
        };
      } else {
        const mappedUrl = buildLive2dRemoteModelUrl(resolvedLive2dRemoteInput, characterId);
        if (!mappedUrl) {
          warnings.push(`[Live2D] ${characterId} 未生成远程 URL（请检查远程地址配置）`);
        } else {
          live2dOutModels[characterId] = {
            source: 'remote',
            modelUrl: mappedUrl,
            runtimeType: model.runtimeType || 'legacy',
            cubismVersion: Number(model?.cubismVersion || 0) || null,
            ...(charCfg ? { config: charCfg } : {}),
          };
        }
      }
      reportProgress(24 + Math.round(((i + 1) / Math.max(1, live2dList.length)) * 40), `Processed Live2D model ${i + 1}/${live2dList.length}`);
      continue;
    }

    if (model?.source === 'remote' && typeof model?.modelUrl === 'string' && model.modelUrl.trim()) {
      live2dOutModels[characterId] = {
        source: 'remote',
        modelUrl: model.modelUrl.trim(),
        runtimeType: model.runtimeType || 'legacy',
        cubismVersion: Number(model?.cubismVersion || 0) || null,
        ...(charCfg ? { config: charCfg } : {}),
      };
      reportProgress(24 + Math.round(((i + 1) / Math.max(1, live2dList.length)) * 40), `Processed Live2D model ${i + 1}/${live2dList.length}`);
      continue;
    }

    const modelSizeBytes = estimateLive2DModelSizeBytes(model);
    if (includeLocalLive2dPlaceholder) {
      live2dOutModels[characterId] = {
        source: 'idb',
        modelId: characterId,
        runtimeType: model.runtimeType || 'legacy',
        cubismVersion: Number(model?.cubismVersion || 0) || null,
        sizeBytes: modelSizeBytes,
        note:
          'Local Live2D model is stored in IndexedDB; binary payload is not exported. Upload to remote and use source=remote if you want portability.',
        ...(charCfg ? { config: charCfg } : {}),
      };
    }
    reportProgress(24 + Math.round(((i + 1) / Math.max(1, live2dList.length)) * 40), `Processed Live2D model ${i + 1}/${live2dList.length}`);
  }

  let customMapImagePayload = null;
  if (includeCustomModuleSettings) {
    reportProgress(70, 'Collecting map payload for character card...');
    customMapImagePayload = await buildExportableMapImagePayload(activePackId);
  }

  reportProgress(72, 'Finalizing character-card extension config...');
  const out = {
    schema: 'galgame_ui_plugin_config_v2',
      meta: {
        exportedAt: new Date().toISOString(),
        exporter: 'galgame-ui-plugin.asset-io',
        live2dExportMode: normalizedLive2dMode === 'remote'
          ? 'remote-url'
          : (includeLocalLive2dPlaceholder ? 'idb-placeholder' : 'skip-local'),
        exportWarnLimitBytes: CARD_EXPORT_WARN_LIMIT_BYTES,
        exportHardLimitBytes: CARD_EXPORT_HARD_LIMIT_BYTES,
        // 兼容旧字段名，语义改为当前导出硬限制
        discordUploadLimitBytes: CARD_EXPORT_HARD_LIMIT_BYTES,
        ...(embeddedAssetTotalBytes > 0 ? {
          embeddedAssets: {
            spriteCount: embeddedAssets.sprites.length,
            backgroundCount: embeddedAssets.backgrounds.length,
            spriteBytes: embeddedAssetStats.spriteBytes,
            backgroundBytes: embeddedAssetStats.backgroundBytes,
            totalBytes: embeddedAssetTotalBytes,
          },
        } : {}),
        ...(warnings.length > 0 ? { warnings } : {}),
      },
    assets: {
      activePackId,
      packs: exportedPacks,
      resourceModes: {
        sprites: {
          mode: normalizedSpriteMode,
          ...(normalizedSpriteMode === 'remote' ? normalizedSpriteRemote : {}),
        },
        backgrounds: {
          mode: normalizedBackgroundMode,
          ...(normalizedBackgroundMode === 'remote' ? normalizedBackgroundRemote : {}),
        },
        live2d: {
          mode: normalizedLive2dMode === 'remote'
            ? 'remote'
            : (includeLocalLive2dPlaceholder ? 'idb-placeholder' : 'skip-local'),
          includeLocalPlaceholder: !!includeLocalLive2dPlaceholder,
          ...(normalizedLive2dMode === 'remote' ? {
            remoteInput: resolvedLive2dRemoteInput,
            ...(normalizedLive2dRemote.remoteBaseUrl ? { remoteBaseUrl: normalizedLive2dRemote.remoteBaseUrl } : {}),
            ...(normalizedLive2dRemote.remoteAssetsUrl ? { remoteAssetsUrl: normalizedLive2dRemote.remoteAssetsUrl } : {}),
          } : {}),
        },
      },
      ...(embeddedAssets.sprites.length > 0 || embeddedAssets.backgrounds.length > 0
        ? {
            embedded: {
              ...(embeddedAssets.sprites.length > 0 ? { sprites: embeddedAssets.sprites } : {}),
              ...(embeddedAssets.backgrounds.length > 0 ? { backgrounds: embeddedAssets.backgrounds } : {}),
            },
          }
        : {}),
    },
    live2d: {
      enabledMap: live2dEnabledMap || {},
      models: live2dOutModels,
    },
    tts: {
      enabled: ttsEnabled,
      characterVoice: characterVoice || {},
    },
  };

  if (includeCustomModuleSettings) {
    out.custom = {
      locationStatusHtml: String(localStorage.getItem(CUSTOM_LOCATION_HTML_KEY) || ''),
      timeStatusHtml: String(localStorage.getItem(CUSTOM_TIME_HTML_KEY) || ''),
      locationStatusIconClass: normalizeLocationStatusIconClass(localStorage.getItem(CUSTOM_LOCATION_ICON_CLASS_KEY) || ''),
      timeStatusIconClass: normalizeTimeStatusIconClass(localStorage.getItem(CUSTOM_TIME_ICON_CLASS_KEY) || ''),
      map: buildExportableMapSettings(),
      ...(customMapImagePayload ? { mapImage: customMapImagePayload } : {}),
    };
  }

  if (includeBgmSettings) {
    out.bgm = {
      whitelist: normalizeStringList(settings?.bgmWhitelist),
    };
  }

  return out;
}

function checkCharacterCardExportSizePolicy(bytes, appendExportNotice) {
  const safeBytes = Number(bytes) || 0;

  if (safeBytes > CARD_EXPORT_HARD_LIMIT_BYTES) {
    const message =
      `角色卡体积 ${formatSizeMb(safeBytes)} 超过导出上限 ${formatSizeMb(CARD_EXPORT_HARD_LIMIT_BYTES)}（20 MB），已阻止导出。请改用远程资源或减少本地内嵌资源。`;
    if (typeof appendExportNotice === 'function') {
      appendExportNotice(message);
    }
    throw new Error(message);
  }

  if (safeBytes > CARD_EXPORT_WARN_LIMIT_BYTES) {
    const message =
      `角色卡体积 ${formatSizeMb(safeBytes)} 超过预警阈值 ${formatSizeMb(CARD_EXPORT_WARN_LIMIT_BYTES)}（10 MB），建议改用远程资源导出。`;
    if (typeof appendExportNotice === 'function') {
      appendExportNotice(message);
    }
    showToast('角色卡体积超过 10 MB，建议改用远程资源导出（已继续导出）');
  }
}

function getSillyTavernContextSafe() {
  try {
    const getContext = topWindow?.SillyTavern?.getContext;
    if (typeof getContext === 'function') {
      return getContext.call(topWindow.SillyTavern) || null;
    }
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 获取 SillyTavern 上下文失败`, e);
  }
  return null;
}

function collectCurrentCharacterNameCandidates() {
  const result = [];
  const append = (value) => {
    const name = String(value || '').trim();
    if (!name) return;
    if (!result.includes(name)) result.push(name);
  };

  const ctx = getSillyTavernContextSafe();
  if (ctx?.characters && ctx?.characterId != null) {
    const current = ctx.characters[ctx.characterId];
    append(current?.name);
    append(current?.data?.name);
  }
  append(ctx?.name2);

  const st = topWindow?.SillyTavern;
  if (st?.characters && st?.characterId != null) {
    const current = st.characters[st.characterId];
    append(current?.name);
    append(current?.data?.name);
  }
  append(st?.name2);

  return result;
}

function pickBestSuggestedCharacterName(allNames, preferredName = '', contextCandidates = []) {
  const names = Array.isArray(allNames)
    ? allNames.map(v => String(v || '').trim()).filter(Boolean)
    : [];
  if (names.length === 0) return '';

  const index = new Map(names.map(name => [name.toLowerCase(), name]));
  const preferred = String(preferredName || '').trim().toLowerCase();
  if (preferred && index.has(preferred)) {
    return index.get(preferred);
  }

  for (const candidate of Array.isArray(contextCandidates) ? contextCandidates : []) {
    const key = String(candidate || '').trim().toLowerCase();
    if (!key) continue;
    if (index.has(key)) return index.get(key);
  }

  return names[0];
}

function listAllCharacterNamesSafe() {
  try {
    const getCharacterNames = topWindow?.TavernHelper?.getCharacterNames;
    if (typeof getCharacterNames !== 'function') return [];
    const names = getCharacterNames();
    if (!Array.isArray(names)) return [];
    return names
      .map(name => String(name || '').trim())
      .filter(Boolean);
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 获取角色卡列表失败`, e);
    return [];
  }
}

async function showCharacterExportSelector(characterNames, suggestedName = '') {
  const names = Array.isArray(characterNames)
    ? characterNames.map(v => String(v || '').trim()).filter(Boolean)
    : [];
  if (names.length === 0) return null;

  const suggested = String(suggestedName || '').trim();
  const hasSuggested = suggested && names.some(n => n.toLowerCase() === suggested.toLowerCase());
  const defaultName = hasSuggested ? names.find(n => n.toLowerCase() === suggested.toLowerCase()) : names[0];

  return new Promise((resolve) => {
    const optionsHtml = names
      .map((name) => `<option value="${escapeHtml(name)}"${name === defaultName ? ' selected' : ''}>${escapeHtml(name)}</option>`)
      .join('');

    const dialogHtml = `
      <div class="gal-input-modal gal-z-critical" id="gal-export-char-selector">
        <div class="gal-input-box" style="max-width: 460px; width: 90%; padding: 25px;">
          <div class="gal-input-title" style="margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between;">
            <span><i class="fa-solid fa-id-card"></i> 选择导出角色卡</span>
            <button id="gal-export-char-close-x" title="关闭" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px; line-height: 1; transition: color 0.2s; transform: none;">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div style="margin-bottom: 14px; color: #666; font-size: 0.9rem;">
            当前会话不是可导出的角色卡上下文，请选择一个角色卡继续导出。
          </div>
          <div style="margin-bottom: 16px;">
            <select id="gal-export-char-name"
                    style="width: 100%; padding: 10px 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 1rem; box-sizing: border-box;">
              ${optionsHtml}
            </select>
          </div>
          <div class="gal-input-actions" style="display: flex; gap: 12px;">
            <button class="gal-action-btn" id="gal-export-char-confirm" style="flex: 1; min-height: 44px; justify-content: center; background: #28a745; color: #fff; border-color: #28a745;">
              <i class="fa-solid fa-check"></i> <span>确认导出</span>
            </button>
          </div>
        </div>
      </div>
    `;

    const mountRoot = getModalMountRoot();
    $(mountRoot).append(dialogHtml);
    const $dialog = $(mountRoot).find('#gal-export-char-selector');
    makeDraggable($dialog.find('.gal-input-box'), $dialog.find('.gal-input-title'));

    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      $dialog.remove();
      resolve(value);
    };

    $dialog.find('#gal-export-char-confirm').on('click', () => {
      const selected = String($dialog.find('#gal-export-char-name').val() || '').trim();
      if (!selected) {
        showToast('请选择一个角色卡');
        return;
      }
      done(selected);
    });

    $dialog.find('#gal-export-char-close-x').on('click', () => done(null));
    $dialog.on('click', function (e) {
      if (e.target === this) done(null);
    });
  });
}

export async function showCharacterCardExportConfigDialog(options = {}) {
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(options, key);
  const prefs = readCardExportPrefs();
  const contextCandidates = collectCurrentCharacterNameCandidates();
  const characterNames = listAllCharacterNamesSafe();
  const preferredCharacterName = hasOwn('characterName')
    ? String(options.characterName || '').trim()
    : String(prefs.characterName || '').trim();
  const suggestedCharacterName = pickBestSuggestedCharacterName(
    characterNames,
    preferredCharacterName,
    contextCandidates,
  );

  const sharedRemoteInputDefault = hasOwn('remoteInput')
    ? String(options.remoteInput || '').trim()
    : String(prefs.remoteInput || '').trim();
  const spriteRemoteInputDefault = hasOwn('spriteRemoteInput')
    ? String(options.spriteRemoteInput || '').trim()
    : String(prefs.spriteRemoteInput || sharedRemoteInputDefault).trim();
  const backgroundRemoteInputDefault = hasOwn('backgroundRemoteInput')
    ? String(options.backgroundRemoteInput || '').trim()
    : String(prefs.backgroundRemoteInput || sharedRemoteInputDefault).trim();
  const spriteResourceModeDefault = hasOwn('spriteResourceMode')
    ? normalizeRemoteMode(options.spriteResourceMode)
    : normalizeRemoteMode(prefs.spriteResourceMode || (spriteRemoteInputDefault ? 'remote' : 'local'));
  const backgroundResourceModeDefault = hasOwn('backgroundResourceMode')
    ? normalizeRemoteMode(options.backgroundResourceMode)
    : normalizeRemoteMode(prefs.backgroundResourceMode || (backgroundRemoteInputDefault ? 'remote' : 'local'));
  const live2dRemoteInputDefault = hasOwn('live2dRemoteInput')
    ? String(options.live2dRemoteInput || '').trim()
    : String(prefs.live2dRemoteInput || '').trim();
  const live2dResourceModeDefault = hasOwn('live2dResourceMode')
    ? normalizeRemoteMode(options.live2dResourceMode)
    : normalizeRemoteMode(prefs.live2dResourceMode || (live2dRemoteInputDefault ? 'remote' : 'local'));
  const remoteUseCdnDefault = hasOwn('remoteUseCdn')
    ? !!options.remoteUseCdn
    : (prefs.remoteUseCdn !== undefined ? !!prefs.remoteUseCdn : true);

  const includeLocalLive2dPlaceholderDefault = hasOwn('includeLocalLive2dPlaceholder')
    ? !!options.includeLocalLive2dPlaceholder
    : true;
  const includeCustomModuleSettingsDefault = hasOwn('includeCustomModuleSettings')
    ? !!options.includeCustomModuleSettings
    : (prefs.includeCustomModuleSettings !== undefined ? !!prefs.includeCustomModuleSettings : true);
  const includeBgmSettingsDefault = hasOwn('includeBgmSettings')
    ? !!options.includeBgmSettings
    : (prefs.includeBgmSettings !== undefined ? !!prefs.includeBgmSettings : true);
  const outputFormatDefault = hasOwn('outputFormat')
    ? normalizeExportOutputFormat(options.outputFormat)
    : normalizeExportOutputFormat(prefs.outputFormat || 'json');

  const currentPackId = getCurrentPackId() || DEFAULT_PACK_ID;
  let currentPackName = '未定义';
  let allPacks = [];
  try {
    const packs = await getAllImagePacks();
    allPacks = Array.isArray(packs) ? packs : [];
    const hit = allPacks.find(pack => String(pack.id || '') === String(currentPackId));
    if (hit?.name) currentPackName = String(hit.name);
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 获取图包信息失败`, e);
  }
  if (allPacks.length === 0) {
    allPacks = [{ id: DEFAULT_PACK_ID, name: currentPackName || '未定义' }];
  }
  const includeAllPacksDefault = hasOwn('includeAllPacks')
    ? !!options.includeAllPacks
    : (prefs.includeAllPacks !== undefined ? !!prefs.includeAllPacks : true);
  const selectedPackIdRaw = hasOwn('selectedPackId')
    ? String(options.selectedPackId || '').trim()
    : String(prefs.selectedPackId || '').trim();
  const selectedPackExists = allPacks.some(pack => String(pack.id || '') === selectedPackIdRaw);
  const selectedPackIdDefault = selectedPackExists ? selectedPackIdRaw : String(currentPackId || DEFAULT_PACK_ID);

  const dialogId = nextInAppDialogId('gal-charcard-export-config');
  const closeId = `${dialogId}-close`;
  const cancelId = `${dialogId}-cancel`;
  const confirmId = `${dialogId}-confirm`;
  const packScopeName = `${dialogId}-pack-scope`;
  const remoteUseCdnId = `${dialogId}-remote-use-cdn`;
  const spriteModeName = `${dialogId}-sprite-mode`;
  const backgroundModeName = `${dialogId}-background-mode`;
  const live2dModeName = `${dialogId}-live2d-mode`;
  const characterSelectId = `${dialogId}-character-select`;
  const characterInputId = `${dialogId}-character-input`;
  const packSelectId = `${dialogId}-pack-select`;
  const spriteRemoteInputId = `${dialogId}-sprite-remote-input`;
  const spriteRemoteWrapId = `${dialogId}-sprite-remote-wrap`;
  const backgroundRemoteInputId = `${dialogId}-background-remote-input`;
  const backgroundRemoteWrapId = `${dialogId}-background-remote-wrap`;
  const live2dRemoteInputId = `${dialogId}-live2d-remote-input`;
  const live2dRemoteWrapId = `${dialogId}-live2d-remote-wrap`;
  const outputFormatName = `${dialogId}-output-format`;
  const pngBaseInputId = `${dialogId}-png-base-input`;
  const pngBaseWrapId = `${dialogId}-png-base-wrap`;
  const pngBasePickBtnId = `${dialogId}-png-base-pick-btn`;
  const pngBaseFileNameId = `${dialogId}-png-base-file-name`;
  const includeCustomId = `${dialogId}-include-custom`;
  const includeBgmId = `${dialogId}-include-bgm`;

  const characterFieldHtml = characterNames.length > 0
    ? `
      <select id="${characterSelectId}" style="width: 100%; padding: 10px 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 0.95rem; box-sizing: border-box;">
        <option value="">自动选择（当前会话）</option>
        ${characterNames.map((name) => `<option value="${escapeHtml(name)}"${name === suggestedCharacterName ? ' selected' : ''}>${escapeHtml(name)}</option>`).join('')}
      </select>
      <div style="margin-top: 6px; font-size: 0.82rem; color: #7a7a7a;">
        未手动选择时，会优先尝试 current 与当前会话角色。
      </div>
    `
    : `
      <input id="${characterInputId}" type="text" value="${escapeHtml(preferredCharacterName)}" placeholder="留空则自动选择 current"
             style="width: 100%; padding: 10px 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 0.95rem; box-sizing: border-box;" />
      <div style="margin-top: 6px; font-size: 0.82rem; color: #7a7a7a;">
        未能读取角色列表时可手动输入角色卡名称。
      </div>
    `;
  const packOptionsHtml = allPacks
    .map((pack) => {
      const packId = String(pack.id || '');
      const packName = String(pack.name || packId || '未命名图包');
      const suffix = packId === String(currentPackId) ? '（当前）' : '';
      return `<option value="${escapeHtml(packId)}">${escapeHtml(packName)}${escapeHtml(suffix)}</option>`;
    })
    .join('');

  const dialogHtml = `
    <div class="gal-input-modal gal-z-critical" id="${dialogId}">
      <div class="gal-input-box" style="max-width: 860px; width: 96%; max-height: 88vh; overflow-y: auto; padding: 22px;">
        <div class="gal-input-title" style="margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
          <span><i class="fa-solid fa-id-card" style="color: #0d6efd;"></i> 导出角色卡（完整设置）</span>
          <button id="${closeId}" title="关闭" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px; line-height: 1;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div style="margin-bottom: 14px; padding: 10px 12px; background: #f8f9fa; border-radius: 8px; border-left: 3px solid #0d6efd; color: #555; font-size: 0.9rem; line-height: 1.6;">
          当前图包：<strong>${escapeHtml(currentPackName)}</strong>（${escapeHtml(String(currentPackId))}）<br>
          一次设置完成后直接导出，可自由切换本地/远程导出。
        </div>

        <div style="display: grid; grid-template-columns: 1fr; gap: 14px;">
          <section style="padding: 12px; border: 1px solid #e9ecef; border-radius: 8px;">
            <div style="font-weight: 700; color: #333; margin-bottom: 8px;">1) 导出目标角色卡</div>
            ${characterFieldHtml}
          </section>

          <section style="padding: 12px; border: 1px solid #e9ecef; border-radius: 8px;">
            <div style="font-weight: 700; color: #333; margin-bottom: 8px;">2) 图包范围</div>
            <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 8px;">
              <label style="display: inline-flex; align-items: center; gap: 6px; color: #333; cursor: pointer;">
                <input type="radio" name="${packScopeName}" value="all" ${includeAllPacksDefault ? 'checked' : ''}>
                <span>导出全部图包</span>
              </label>
              <label style="display: inline-flex; align-items: center; gap: 6px; color: #333; cursor: pointer;">
                <input type="radio" name="${packScopeName}" value="selected" ${includeAllPacksDefault ? '' : 'checked'}>
                <span>仅导出所选图包</span>
              </label>
            </div>
            <select id="${packSelectId}" style="width: 100%; padding: 10px 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 0.95rem; box-sizing: border-box;">
              ${packOptionsHtml}
            </select>
          </section>

          <section style="padding: 12px; border: 1px solid #e9ecef; border-radius: 8px;">
            <div style="font-weight: 700; color: #333; margin-bottom: 8px;">3) 资源模式（细分）</div>
            <div style="font-size: 0.84rem; color: #6b7280; margin-bottom: 10px;">
              可分别为立绘和背景设置本地/远程地址，互不影响。
            </div>
            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px; color: #333; cursor: pointer;">
              <input type="checkbox" id="${remoteUseCdnId}" ${remoteUseCdnDefault ? 'checked' : ''}>
              <span>远程资源启用 jsDelivr CDN 套壳（默认开启）</span>
            </label>
            <div style="font-size: 0.82rem; color: #6b7280; margin-bottom: 10px; line-height: 1.5;">
              GitHub 填写说明：可填 <code>user/repo</code>、<code>user/repo@branch/path</code>、<code>https://github.com/user/repo/tree/main/path</code>。
            </div>

            <div style="padding: 10px; border: 1px dashed #d1d5db; border-radius: 6px; margin-bottom: 10px;">
              <div style="font-weight: 600; color: #374151; margin-bottom: 6px;">立绘资源模式</div>
              <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 8px;">
                <label style="display: inline-flex; align-items: center; gap: 6px; color: #333; cursor: pointer;">
                  <input type="radio" name="${spriteModeName}" value="local" ${spriteResourceModeDefault === 'local' ? 'checked' : ''}>
                  <span>本地</span>
                </label>
                <label style="display: inline-flex; align-items: center; gap: 6px; color: #333; cursor: pointer;">
                  <input type="radio" name="${spriteModeName}" value="remote" ${spriteResourceModeDefault === 'remote' ? 'checked' : ''}>
                  <span>远程</span>
                </label>
              </div>
              <div id="${spriteRemoteWrapId}">
                <input id="${spriteRemoteInputId}" type="text" value="${escapeHtml(spriteRemoteInputDefault)}"
                       placeholder="例如 user/repo@main/sprites/ 或 https://.../remote_assets.json"
                       style="width: 100%; padding: 9px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.92rem; box-sizing: border-box;" />
              </div>
            </div>

            <div style="padding: 10px; border: 1px dashed #d1d5db; border-radius: 6px;">
              <div style="font-weight: 600; color: #374151; margin-bottom: 6px;">背景图包模式</div>
              <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 8px;">
                <label style="display: inline-flex; align-items: center; gap: 6px; color: #333; cursor: pointer;">
                  <input type="radio" name="${backgroundModeName}" value="local" ${backgroundResourceModeDefault === 'local' ? 'checked' : ''}>
                  <span>本地</span>
                </label>
                <label style="display: inline-flex; align-items: center; gap: 6px; color: #333; cursor: pointer;">
                  <input type="radio" name="${backgroundModeName}" value="remote" ${backgroundResourceModeDefault === 'remote' ? 'checked' : ''}>
                  <span>远程</span>
                </label>
              </div>
              <div id="${backgroundRemoteWrapId}">
                <input id="${backgroundRemoteInputId}" type="text" value="${escapeHtml(backgroundRemoteInputDefault)}"
                       placeholder="例如 user/repo@main/backgrounds/ 或 https://.../remote_assets.json"
                       style="width: 100%; padding: 9px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.92rem; box-sizing: border-box;" />
              </div>
            </div>
          </section>

          <section style="padding: 12px; border: 1px solid #e9ecef; border-radius: 8px;">
            <div style="font-weight: 700; color: #333; margin-bottom: 8px;">4) Live2D 导出模式</div>
            <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 8px;">
              <label style="display: inline-flex; align-items: center; gap: 6px; color: #333; cursor: pointer;">
                <input type="radio" name="${live2dModeName}" value="local" ${live2dResourceModeDefault === 'local' ? 'checked' : ''}>
                <span>只导出占位记录</span>
              </label>
              <label style="display: inline-flex; align-items: center; gap: 6px; color: #333; cursor: pointer;">
                <input type="radio" name="${live2dModeName}" value="remote" ${live2dResourceModeDefault === 'remote' ? 'checked' : ''}>
                <span>远程地址</span>
              </label>
            </div>
            <div id="${live2dRemoteWrapId}" style="margin-bottom: 10px;">
              <input id="${live2dRemoteInputId}" type="text" value="${escapeHtml(live2dRemoteInputDefault)}"
                     placeholder="例如 user/repo@main/live2d/ 或 https://cdn.../{character}/model3.json"
                     style="width: 100%; padding: 9px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.92rem; box-sizing: border-box;" />
              <div style="margin-top: 6px; font-size: 0.82rem; color: #6b7280; line-height: 1.5;">
                远程地址支持 <code>{character}</code> 占位符；不含占位符时默认拼接为 <code>{base}/{character}/model3.json</code>。
              </div>
            </div>
            <div style="font-size: 0.84rem; color: #6b7280; line-height: 1.5;">
               导出IndexedDB 占位记录。需配合远程地址使用，或由第三方工具读取占位记录后自行处理模型数据。占位记录不包含模型二进制数据，仅供兼容性和后续处理使用。
            </div>
          </section>

          <section style="padding: 12px; border: 1px solid #e9ecef; border-radius: 8px;">
            <div style="font-weight: 700; color: #333; margin-bottom: 8px;">5) 导出文件格式</div>
            <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 8px;">
              <label style="display: inline-flex; align-items: center; gap: 6px; color: #333; cursor: pointer;">
                <input type="radio" name="${outputFormatName}" value="json" ${outputFormatDefault === 'json' ? 'checked' : ''}>
                <span>JSON</span>
              </label>
              <label style="display: inline-flex; align-items: center; gap: 6px; color: #333; cursor: pointer;">
                <input type="radio" name="${outputFormatName}" value="png" ${outputFormatDefault === 'png' ? 'checked' : ''}>
                <span>PNG（角色卡元数据）</span>
              </label>
            </div>
            <div id="${pngBaseWrapId}" style="padding: 10px; border: 1px dashed #d1d5db; border-radius: 6px;">
              <label for="${pngBaseInputId}" style="display: block; font-size: 0.9rem; color: #444; margin-bottom: 6px;">
                PNG 底图文件
              </label>
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 6px;">
                <button type="button" class="gal-action-btn" id="${pngBasePickBtnId}"
                        style="min-height: 36px; padding: 0 12px; border: 1px solid #0d6efd; background: #fff; color: #0d6efd;">
                  <i class="fa-solid fa-image"></i> <span>选择 PNG 底图</span>
                </button>
                <span id="${pngBaseFileNameId}" style="font-size: 0.84rem; color: #6b7280;">未选择文件</span>
              </div>
              <input id="${pngBaseInputId}" type="file" accept=".png,image/png"
                     style="position: absolute; left: -10000px; top: auto; width: 1px; height: 1px; opacity: 0; overflow: hidden; pointer-events: none;" />
              <div style="margin-top: 6px; font-size: 0.82rem; color: #6b7280; line-height: 1.5;">
                说明：会把角色卡 JSON 写入 PNG 元数据（keyword: <code>chara</code>），用于兼容 PNG 角色卡格式。请手动选择一张 PNG 作为底图。
              </div>
            </div>
          </section>

          <section style="padding: 12px; border: 1px solid #e9ecef; border-radius: 8px;">
            <div style="font-weight: 700; color: #333; margin-bottom: 8px;">6) 角色卡扩展导出内容</div>
            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #333; cursor: pointer;">
              <input type="checkbox" id="${includeCustomId}" ${includeCustomModuleSettingsDefault ? 'checked' : ''}>
              <span>导出自定义模块设置（地点/时间弹窗内容 HTML + 图标 + 地图设置/图片）</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; color: #333; cursor: pointer;">
              <input type="checkbox" id="${includeBgmId}" ${includeBgmSettingsDefault ? 'checked' : ''}>
              <span>导出 BGM 白名单设置</span>
            </label>
          </section>
        </div>

        <div class="gal-input-actions" style="display: flex; gap: 10px; margin-top: 16px;">
          <button class="gal-action-btn" id="${cancelId}" style="flex: 1; min-height: 42px; justify-content: center; background: #6c757d; color: #fff; border-color: #6c757d;">
            <i class="fa-solid fa-xmark"></i> <span>取消</span>
          </button>
          <button class="gal-action-btn" id="${confirmId}" style="flex: 1; min-height: 42px; justify-content: center; background: #0d6efd; color: #fff; border-color: #0d6efd;">
            <i class="fa-solid fa-file-export"></i> <span>开始导出</span>
          </button>
        </div>
      </div>
    </div>
  `;

  return new Promise((resolve) => {
    const mountRoot = getModalMountRoot();
    $(mountRoot).append(dialogHtml);
    const $dialog = $(mountRoot).find(`#${dialogId}`);
    const $box = $dialog.find('.gal-input-box');
    const $packSelect = $dialog.find(`#${packSelectId}`);
    const $remoteUseCdn = $dialog.find(`#${remoteUseCdnId}`);
    const $spriteRemoteWrap = $dialog.find(`#${spriteRemoteWrapId}`);
    const $spriteRemoteInput = $dialog.find(`#${spriteRemoteInputId}`);
    const $backgroundRemoteWrap = $dialog.find(`#${backgroundRemoteWrapId}`);
    const $backgroundRemoteInput = $dialog.find(`#${backgroundRemoteInputId}`);
    const $live2dRemoteWrap = $dialog.find(`#${live2dRemoteWrapId}`);
    const $live2dRemoteInput = $dialog.find(`#${live2dRemoteInputId}`);
    const $pngBaseWrap = $dialog.find(`#${pngBaseWrapId}`);
    const $pngBaseInput = $dialog.find(`#${pngBaseInputId}`);
    const $pngBasePickBtn = $dialog.find(`#${pngBasePickBtnId}`);
    const $pngBaseFileName = $dialog.find(`#${pngBaseFileNameId}`);
    const $characterSelect = $dialog.find(`#${characterSelectId}`);
    const $characterInput = $dialog.find(`#${characterInputId}`);
    makeDraggable($box, $dialog.find('.gal-input-title'));
    if ($packSelect.length > 0) {
      $packSelect.val(selectedPackIdDefault);
    }

    const syncState = () => {
      const packScope = String($dialog.find(`input[name="${packScopeName}"]:checked`).val() || 'all');
      const useAllPacks = packScope === 'all';
      $packSelect.prop('disabled', useAllPacks);
      $packSelect.css('opacity', useAllPacks ? 0.6 : 1);

      const outputFormat = normalizeExportOutputFormat(
        $dialog.find(`input[name="${outputFormatName}"]:checked`).val() || 'json',
      );
      const isPngOutput = outputFormat === 'png';
      $pngBaseInput.prop('disabled', !isPngOutput);
      $pngBasePickBtn.prop('disabled', !isPngOutput);
      $pngBasePickBtn.css('opacity', isPngOutput ? 1 : 0.6);
      $pngBasePickBtn.css('cursor', isPngOutput ? 'pointer' : 'not-allowed');
      $pngBaseWrap.css('opacity', isPngOutput ? 1 : 0.6);
      $pngBaseWrap.css('pointer-events', isPngOutput ? 'auto' : 'none');

      const spriteMode = String($dialog.find(`input[name="${spriteModeName}"]:checked`).val() || 'local');
      const spriteIsRemote = spriteMode === 'remote';
      $spriteRemoteInput.prop('disabled', !spriteIsRemote);
      $spriteRemoteWrap.css('opacity', spriteIsRemote ? 1 : 0.6);
      $spriteRemoteWrap.css('pointer-events', spriteIsRemote ? 'auto' : 'none');

      const backgroundMode = String($dialog.find(`input[name="${backgroundModeName}"]:checked`).val() || 'local');
      const backgroundIsRemote = backgroundMode === 'remote';
      $backgroundRemoteInput.prop('disabled', !backgroundIsRemote);
      $backgroundRemoteWrap.css('opacity', backgroundIsRemote ? 1 : 0.6);
      $backgroundRemoteWrap.css('pointer-events', backgroundIsRemote ? 'auto' : 'none');

      const live2dMode = String($dialog.find(`input[name="${live2dModeName}"]:checked`).val() || 'local');
      const live2dIsRemote = live2dMode === 'remote';
      $live2dRemoteInput.prop('disabled', !live2dIsRemote);
      $live2dRemoteWrap.css('opacity', live2dIsRemote ? 1 : 0.6);
      $live2dRemoteWrap.css('pointer-events', live2dIsRemote ? 'auto' : 'none');
    };

    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      $dialog.remove();
      resolve(value);
    };

    const $confirmBtn = $dialog.find(`#${confirmId}`);
    const confirmOriginalHtml = $confirmBtn.length > 0 ? $confirmBtn.html() : '';
    const setSubmitBusy = (busy) => {
      if ($confirmBtn.length === 0) return;
      $confirmBtn.prop('disabled', !!busy);
      $confirmBtn.css('opacity', busy ? 0.72 : 1);
      $confirmBtn.css('cursor', busy ? 'wait' : 'pointer');
      if (busy) {
        $confirmBtn.html('<i class="fa-solid fa-spinner fa-spin"></i> <span>处理中...</span>');
      } else if (confirmOriginalHtml) {
        $confirmBtn.html(confirmOriginalHtml);
      }
    };

    const submit = () => {
      if (settled) return;
      if ($confirmBtn.length > 0 && $confirmBtn.prop('disabled')) return;
      setSubmitBusy(true);
      try {
        let characterName = '';
        if ($characterSelect.length > 0) {
          characterName = String($characterSelect.val() || '').trim();
        } else if ($characterInput.length > 0) {
          characterName = String($characterInput.val() || '').trim();
        }
        if (!characterName && suggestedCharacterName) {
          characterName = String(suggestedCharacterName || '').trim();
        }

        const outputFormat = normalizeExportOutputFormat(
          $dialog.find(`input[name="${outputFormatName}"]:checked`).val() || 'json',
        );
        let pngBaseFile = null;
        if (outputFormat === 'png') {
          const inputEl = $pngBaseInput.get(0);
          const pickedFile = inputEl && inputEl.files && inputEl.files[0] ? inputEl.files[0] : null;
          if (pickedFile) {
            const fileName = String(pickedFile.name || '').toLowerCase();
            const mimeType = String(pickedFile.type || '').toLowerCase();
            if (!fileName.endsWith('.png') && mimeType !== 'image/png') {
              showToast('底图文件必须是 PNG 格式');
              $pngBaseInput.trigger('focus');
              return;
            }
            pngBaseFile = pickedFile;
          }
          if (!pngBaseFile) {
            showToast('请先选择 PNG 底图文件');
            if (inputEl && typeof inputEl.click === 'function') {
              inputEl.click();
            }
            return;
          }
        }

        const packScope = String($dialog.find(`input[name="${packScopeName}"]:checked`).val() || 'all');
        const includeAllPacks = packScope === 'all';
        const selectedPackId = String($packSelect.val() || '').trim();
        if (!includeAllPacks && !selectedPackId) {
          showToast('请选择要导出的图包');
          $packSelect.trigger('focus');
          return;
        }

        const remoteUseCdn = !!$remoteUseCdn.prop('checked');

        const spriteResourceMode = String($dialog.find(`input[name="${spriteModeName}"]:checked`).val() || 'local');
        const spriteRemoteInputRaw = String($spriteRemoteInput.val() || '').trim();
        let spriteRemoteInput = spriteResourceMode === 'remote' ? spriteRemoteInputRaw : '';
        if (spriteResourceMode === 'remote') {
          const resolvedSpriteInput = resolveRemoteAddressInput(spriteRemoteInputRaw, remoteUseCdn);
          if (!resolvedSpriteInput.ok) {
            showToast(`立绘远程地址无效：${resolvedSpriteInput.error}`);
            $spriteRemoteInput.trigger('focus');
            return;
          }
          spriteRemoteInput = resolvedSpriteInput.value;
        }

        const backgroundResourceMode = String($dialog.find(`input[name="${backgroundModeName}"]:checked`).val() || 'local');
        const backgroundRemoteInputRaw = String($backgroundRemoteInput.val() || '').trim();
        let backgroundRemoteInput = backgroundResourceMode === 'remote' ? backgroundRemoteInputRaw : '';
        if (backgroundResourceMode === 'remote') {
          const resolvedBackgroundInput = resolveRemoteAddressInput(backgroundRemoteInputRaw, remoteUseCdn);
          if (!resolvedBackgroundInput.ok) {
            showToast(`背景远程地址无效：${resolvedBackgroundInput.error}`);
            $backgroundRemoteInput.trigger('focus');
            return;
          }
          backgroundRemoteInput = resolvedBackgroundInput.value;
        }

        const live2dResourceMode = String($dialog.find(`input[name="${live2dModeName}"]:checked`).val() || 'local');
        const live2dRemoteInputRaw = String($live2dRemoteInput.val() || '').trim();
        let live2dRemoteInput = live2dResourceMode === 'remote' ? live2dRemoteInputRaw : '';
        if (live2dResourceMode === 'remote') {
          const resolvedLive2dInput = resolveRemoteAddressInput(live2dRemoteInputRaw, remoteUseCdn);
          if (!resolvedLive2dInput.ok) {
            showToast(`Live2D 远程地址无效：${resolvedLive2dInput.error}`);
            $live2dRemoteInput.trigger('focus');
            return;
          }
          live2dRemoteInput = resolvedLive2dInput.value;
        }

        const remoteInput = spriteRemoteInput || backgroundRemoteInput || live2dRemoteInput || '';
        const includeLocalLive2dPlaceholder = live2dResourceMode === 'remote'
          ? true
          : includeLocalLive2dPlaceholderDefault;

        const includeCustomModuleSettings = !!$dialog.find(`#${includeCustomId}`).prop('checked');
        const includeBgmSettings = !!$dialog.find(`#${includeBgmId}`).prop('checked');

        const result = {
          characterName,
          outputFormat,
          pngBaseFile,
          remoteInput,
          includeAllPacks,
          selectedPackId,
          spriteResourceMode,
          spriteRemoteInput,
          backgroundResourceMode,
          backgroundRemoteInput,
          live2dResourceMode,
          live2dRemoteInput,
          remoteUseCdn,
          includeLocalLive2dPlaceholder,
          includeCustomModuleSettings,
          includeBgmSettings,
        };

        saveCardExportPrefs({
          characterName,
          outputFormat,
          remoteInput,
          includeAllPacks,
          selectedPackId,
          spriteResourceMode,
          spriteRemoteInput,
          backgroundResourceMode,
          backgroundRemoteInput,
          live2dResourceMode,
          live2dRemoteInput,
          remoteUseCdn,
          includeLocalLive2dPlaceholder,
          includeCustomModuleSettings,
          includeBgmSettings,
        });

        done(result);
      } catch (e) {
        console.error(`[${SCRIPT_NAME}] 收集导出参数失败`, e);
        showToast(`导出参数异常: ${e?.message || e}`);
      } finally {
        if (!settled) setSubmitBusy(false);
      }
    };

    $dialog.find(`input[name="${packScopeName}"]`).on('change', syncState);
    $dialog.find(`input[name="${outputFormatName}"]`).on('change', syncState);
    $dialog.find(`input[name="${spriteModeName}"]`).on('change', syncState);
    $dialog.find(`input[name="${backgroundModeName}"]`).on('change', syncState);
    $dialog.find(`input[name="${live2dModeName}"]`).on('change', syncState);
    const updatePngFileLabel = () => {
      const inputEl = $pngBaseInput.get(0);
      const pickedFile = inputEl && inputEl.files && inputEl.files[0] ? inputEl.files[0] : null;
      $pngBaseFileName.text(pickedFile ? `已选择：${pickedFile.name}` : '未选择文件');
    };
    $pngBasePickBtn.on('click', (e) => {
      e.preventDefault();
      const inputEl = $pngBaseInput.get(0);
      if (!inputEl || $pngBaseInput.prop('disabled')) return;
      inputEl.click();
    });
    $pngBaseInput.on('change', updatePngFileLabel);
    updatePngFileLabel();
    syncState();

    $confirmBtn.on('click', submit);
    $dialog.find(`#${cancelId}`).on('click', () => done(null));
    $dialog.find(`#${closeId}`).on('click', () => done(null));
    $dialog.on('click', function (e) {
      if (e.target === this) done(null);
    });
    $dialog.on('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        done(null);
      }
    });
    $dialog.find('input').on('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });

    setTimeout(() => {
      if ($characterSelect.length > 0) {
        $characterSelect.trigger('focus');
      } else if ($characterInput.length > 0) {
        $characterInput.trigger('focus');
      } else {
        $dialog.find(`#${confirmId}`).trigger('focus');
      }
    }, 0);
  });
}

async function resolveCharacterCardForExport(options = {}) {
  const {
    interactive = true,
    preferredCharacterName = '',
    onProgress = null,
  } = options;
  const reportProgress = typeof onProgress === 'function' ? onProgress : () => {};
  const getCharacter = topWindow?.TavernHelper?.getCharacter;
  if (typeof getCharacter !== 'function') {
    throw new Error('未检测到 TavernHelper.getCharacter，无法读取角色卡');
  }

  const tried = new Set();
  let lastError = null;

  const tryGetCharacter = async (name, reason) => {
    const safeName = String(name || '').trim();
    if (!safeName) return null;
    const key = safeName.toLowerCase();
    if (tried.has(key)) return null;
    tried.add(key);

    reportProgress(76, `读取角色卡: ${safeName}`);
    try {
      const card = await getCharacter(safeName);
      if (card && typeof card === 'object') {
        return { card, resolvedName: safeName, resolveReason: reason };
      }
    } catch (e) {
      lastError = e;
      console.warn(`[${SCRIPT_NAME}] 读取角色卡失败 (${reason}): ${safeName}`, e);
    }
    return null;
  };

  const preferred = String(preferredCharacterName || '').trim();
  if (preferred) {
    const hit = await tryGetCharacter(preferred, 'preferred');
    if (hit) return hit;
  }

  const fromCurrent = await tryGetCharacter('current', 'current');
  if (fromCurrent) return fromCurrent;

  const contextCandidates = collectCurrentCharacterNameCandidates();
  for (const candidate of contextCandidates) {
    const hit = await tryGetCharacter(candidate, 'context');
    if (hit) return hit;
  }

  const allNames = listAllCharacterNamesSafe();
  if (allNames.length > 0 && contextCandidates.length > 0) {
    const index = new Map(allNames.map(name => [name.toLowerCase(), name]));
    for (const candidate of contextCandidates) {
      const mapped = index.get(String(candidate).toLowerCase());
      if (!mapped) continue;
      const hit = await tryGetCharacter(mapped, 'context-mapped');
      if (hit) return hit;
    }
  }

  if (allNames.length === 1) {
    const hit = await tryGetCharacter(allNames[0], 'single-character');
    if (hit) return hit;
  }

  if (interactive && allNames.length > 0) {
    const suggestedForSelect = pickBestSuggestedCharacterName(allNames, preferred, contextCandidates);
    const selectedByModal = await showCharacterExportSelector(
      allNames,
      suggestedForSelect,
    );
    if (typeof selectedByModal === 'string' && selectedByModal.trim()) {
      const hit = await tryGetCharacter(selectedByModal.trim(), 'manual-select-modal');
      if (hit) return hit;
    }

    const preview = allNames.slice(0, 20).join('、');
    const more = allNames.length > 20 ? ` ... 共 ${allNames.length} 个` : '';
    const answer = await showInAppPromptDialog({
      title: '手动指定角色卡',
      message: '当前会话无法通过 "current" 读取角色卡，请输入要导出的角色卡名称。',
      hint: `可选角色：${preview}${more}`,
      label: '角色卡名称',
      placeholder: '请输入角色卡名称',
      defaultValue: contextCandidates[0] || allNames[0] || '',
      confirmText: '继续导出',
      cancelText: '取消',
      iconClass: 'fa-solid fa-id-card',
      accent: '#0d6efd',
      required: true,
      requiredMessage: '请输入角色卡名称',
    });
    if (typeof answer === 'string' && answer.trim()) {
      const hit = await tryGetCharacter(answer.trim(), 'manual-input');
      if (hit) return hit;
    }
  }

  const parts = [];
  if (contextCandidates.length > 0) {
    parts.push(`上下文候选: ${contextCandidates.join('、')}`);
  }
  if (allNames.length > 0) {
    const preview = allNames.slice(0, 10).join('、');
    parts.push(`角色卡列表: ${preview}${allNames.length > 10 ? ' ...' : ''}`);
  }
  if (lastError?.message) {
    parts.push(`最后错误: ${lastError.message}`);
  }
  throw new Error(`角色卡 'current' 不存在，且无法自动定位导出目标。${parts.join('；')}`);
}

function isLikelyRawCharacterCard(card) {
  if (!card || typeof card !== 'object') return false;
  const hasName = typeof card.name === 'string' && card.name.trim().length > 0;
  const hasData = card.data && typeof card.data === 'object';
  const hasDialogField = typeof card.first_mes === 'string' || typeof card?.data?.first_mes === 'string';
  return hasName && hasData && hasDialogField;
}

function resolveRawCharacterCardForExport(options = {}) {
  const {
    resolvedName = '',
    fallbackCharacter = null,
    onProgress = null,
  } = options;
  const reportProgress = typeof onProgress === 'function' ? onProgress : () => {};
  const tried = new Set();
  const candidateNames = [];
  const appendName = (value) => {
    const name = String(value || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (tried.has(key)) return;
    tried.add(key);
    candidateNames.push(name);
  };

  appendName(resolvedName);
  appendName('current');
  for (const name of collectCurrentCharacterNameCandidates()) appendName(name);

  const getCharData = topWindow?.TavernHelper?.getCharData;
  if (typeof getCharData === 'function') {
    for (const name of candidateNames) {
      reportProgress(79, `读取原始角色卡: ${name}`);
      try {
        const raw = getCharData(name, true);
        if (isLikelyRawCharacterCard(raw)) {
          return {
            card: raw,
            resolvedName: name,
            source: 'tavern-helper.getCharData',
          };
        }
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] getCharData 读取失败: ${name}`, e);
      }
    }
  }

  const ctx = getSillyTavernContextSafe();
  if (ctx?.characters && ctx?.characterId != null) {
    const current = ctx.characters[ctx.characterId];
    if (isLikelyRawCharacterCard(current)) {
      return {
        card: current,
        resolvedName: String(current?.name || resolvedName || 'current'),
        source: 'sillytavern.context',
      };
    }
  }

  const st = topWindow?.SillyTavern;
  if (st?.characters && st?.characterId != null) {
    const current = st.characters[st.characterId];
    if (isLikelyRawCharacterCard(current)) {
      return {
        card: current,
        resolvedName: String(current?.name || resolvedName || 'current'),
        source: 'sillytavern.global',
      };
    }
  }

  if (isLikelyRawCharacterCard(fallbackCharacter)) {
    return {
      card: fallbackCharacter,
      resolvedName: String(fallbackCharacter?.name || resolvedName || 'current'),
      source: 'fallback-getCharacter',
    };
  }

  throw new Error('无法获取可导入的原始角色卡结构（v1/v2），请确认已打开角色卡会话后重试');
}

export async function exportCurrentCharacterCardWithConfig(options = {}) {
  let progressController = null;
  let exportSucceeded = false;
  const interactive = options.interactive !== false;
  let requireErrorConfirm = false;
  const updateProgress = (percent, text) => {
    if (progressController) {
      progressController.update(percent, text);
    }
  };

  try {
    if (!topWindow?.TavernHelper?.getCharacter || typeof topWindow.TavernHelper.getCharacter !== 'function') {
      throw new Error('未检测到 TavernHelper.getCharacter，无法直接导出角色卡');
    }

    let preferredCharacterName = options.characterName || '';
    let outputFormat = normalizeExportOutputFormat(options.outputFormat || 'json');
    let pngBaseFile = options.pngBaseFile || null;
    let pngPrettyJsonIndent = options.pngPrettyJsonIndent;
    let remoteInput = options.remoteInput || '';
    let includeAllPacks = options.includeAllPacks;
    let selectedPackId = options.selectedPackId || '';
    let spriteResourceMode = options.spriteResourceMode;
    let spriteRemoteInput = options.spriteRemoteInput || '';
    let backgroundResourceMode = options.backgroundResourceMode;
    let backgroundRemoteInput = options.backgroundRemoteInput || '';
    let live2dResourceMode = options.live2dResourceMode;
    let live2dRemoteInput = options.live2dRemoteInput || '';
    let remoteUseCdn = options.remoteUseCdn;
    let includeLocalLive2dPlaceholder = options.includeLocalLive2dPlaceholder;
    let includeCustomModuleSettings = options.includeCustomModuleSettings;
    let includeBgmSettings = options.includeBgmSettings;

    if (interactive) {
      const exportParams = await showCharacterCardExportConfigDialog({
        characterName: preferredCharacterName,
        outputFormat,
        remoteInput,
        includeAllPacks,
        selectedPackId,
        spriteResourceMode,
        spriteRemoteInput,
        backgroundResourceMode,
        backgroundRemoteInput,
        live2dResourceMode,
        live2dRemoteInput,
        remoteUseCdn,
        includeLocalLive2dPlaceholder,
        includeCustomModuleSettings,
        includeBgmSettings,
      });
      if (!exportParams) {
        showToast('已取消导出角色卡');
        return false;
      }
      preferredCharacterName = exportParams.characterName || '';
      outputFormat = normalizeExportOutputFormat(exportParams.outputFormat || outputFormat);
      pngBaseFile = exportParams.pngBaseFile || pngBaseFile;
      remoteInput = exportParams.remoteInput || '';
      includeAllPacks = exportParams.includeAllPacks;
      selectedPackId = exportParams.selectedPackId || '';
      spriteResourceMode = exportParams.spriteResourceMode;
      spriteRemoteInput = exportParams.spriteRemoteInput || '';
      backgroundResourceMode = exportParams.backgroundResourceMode;
      backgroundRemoteInput = exportParams.backgroundRemoteInput || '';
      live2dResourceMode = exportParams.live2dResourceMode;
      live2dRemoteInput = exportParams.live2dRemoteInput || '';
      remoteUseCdn = exportParams.remoteUseCdn;
      includeLocalLive2dPlaceholder = exportParams.includeLocalLive2dPlaceholder;
      includeCustomModuleSettings = exportParams.includeCustomModuleSettings;
      includeBgmSettings = exportParams.includeBgmSettings;
    }

    if (includeAllPacks === undefined) includeAllPacks = true;
    if (!selectedPackId) selectedPackId = getCurrentPackId() || DEFAULT_PACK_ID;
    if (!spriteRemoteInput && remoteInput) spriteRemoteInput = remoteInput;
    if (!backgroundRemoteInput && remoteInput) backgroundRemoteInput = remoteInput;
    if (spriteResourceMode === undefined || spriteResourceMode === null || spriteResourceMode === '') {
      spriteResourceMode = spriteRemoteInput ? 'remote' : 'local';
    }
    if (backgroundResourceMode === undefined || backgroundResourceMode === null || backgroundResourceMode === '') {
      backgroundResourceMode = backgroundRemoteInput ? 'remote' : 'local';
    }
    spriteResourceMode = normalizeRemoteMode(spriteResourceMode);
    backgroundResourceMode = normalizeRemoteMode(backgroundResourceMode);
    if (!live2dRemoteInput && remoteInput) live2dRemoteInput = remoteInput;
    if (live2dResourceMode === undefined || live2dResourceMode === null || live2dResourceMode === '') {
      live2dResourceMode = live2dRemoteInput ? 'remote' : 'local';
    }
    live2dResourceMode = normalizeRemoteMode(live2dResourceMode);
    if (remoteUseCdn === undefined) remoteUseCdn = true;
    if (spriteResourceMode === 'remote') {
      const resolvedSpriteInput = resolveRemoteAddressInput(spriteRemoteInput, remoteUseCdn);
      if (!resolvedSpriteInput.ok) {
        throw new Error(`立绘资源模式设置为远程，但远程地址无效：${resolvedSpriteInput.error}`);
      }
      spriteRemoteInput = resolvedSpriteInput.value;
    }
    if (backgroundResourceMode === 'remote') {
      const resolvedBackgroundInput = resolveRemoteAddressInput(backgroundRemoteInput, remoteUseCdn);
      if (!resolvedBackgroundInput.ok) {
        throw new Error(`背景图包模式设置为远程，但远程地址无效：${resolvedBackgroundInput.error}`);
      }
      backgroundRemoteInput = resolvedBackgroundInput.value;
    }
    if (live2dResourceMode === 'remote') {
      const resolvedLive2dInput = resolveRemoteAddressInput(live2dRemoteInput, remoteUseCdn);
      if (!resolvedLive2dInput.ok) {
        throw new Error(`Live2D 资源模式设置为远程，但远程地址无效：${resolvedLive2dInput.error}`);
      }
      live2dRemoteInput = resolvedLive2dInput.value;
    }
    remoteInput = spriteRemoteInput || backgroundRemoteInput || live2dRemoteInput || remoteInput;
    if (includeLocalLive2dPlaceholder === undefined) includeLocalLive2dPlaceholder = true;
    if (includeCustomModuleSettings === undefined) includeCustomModuleSettings = true;
    if (includeBgmSettings === undefined) includeBgmSettings = true;
    outputFormat = normalizeExportOutputFormat(outputFormat);
    if (!Number.isFinite(Number(pngPrettyJsonIndent))) {
      pngPrettyJsonIndent = 2;
    } else {
      pngPrettyJsonIndent = Math.min(8, Math.max(0, Math.floor(Number(pngPrettyJsonIndent))));
    }
    if (outputFormat === 'png') {
      if (!pngBaseFile || typeof pngBaseFile.arrayBuffer !== 'function') {
        throw new Error('PNG 导出模式需要提供有效的 PNG 底图文件');
      }
    }

    showToast('正在定位导出角色卡...');
    const resolvedCharacter = await resolveCharacterCardForExport({
      interactive,
      preferredCharacterName,
    });
    const currentCharacter = resolvedCharacter?.card;
    if (!currentCharacter || typeof currentCharacter !== 'object') {
      throw new Error('无法读取当前角色卡');
    }

    progressController = showImportProgress('准备导出角色卡...', null, {
      title: '正在导出角色卡',
      iconClass: 'fa-solid fa-file-export',
    });
    updateProgress(3, '初始化导出流程...');
    await new Promise(resolve => setTimeout(resolve, 0));

    updateProgress(8, '收集插件配置...');
    const config = await buildGalgameCardConfig({
      remoteInput,
      includeAllPacks,
      selectedPackId,
      spriteResourceMode,
      spriteRemoteInput,
      backgroundResourceMode,
      backgroundRemoteInput,
      live2dResourceMode,
      live2dRemoteInput,
      includeLocalLive2dPlaceholder,
      includeCustomModuleSettings,
      includeBgmSettings,
      onProgress: updateProgress,
    });
    const appendExportNotice = (notice) => {
      const text = String(notice || '').trim();
      if (!text) return;
      if (!config.meta || typeof config.meta !== 'object') {
        config.meta = {};
      }
      if (!Array.isArray(config.meta.warnings)) {
        config.meta.warnings = [];
      }
      if (!config.meta.warnings.includes(text)) {
        config.meta.warnings.push(text);
      }
    };

    updateProgress(76, '读取角色卡数据...');
    updateProgress(80, '读取可导入的原始角色卡结构...');
    const rawResolved = resolveRawCharacterCardForExport({
      resolvedName: resolvedCharacter?.resolvedName || preferredCharacterName,
      fallbackCharacter: currentCharacter,
      onProgress: updateProgress,
    });

    updateProgress(82, '写入角色卡扩展配置...');
    const card = typeof structuredClone === 'function'
      ? structuredClone(rawResolved.card)
      : JSON.parse(JSON.stringify(rawResolved.card));
    const ext = ensureCardExtensions(card);
    ext.galgame_ui_plugin = config;
    ensureCharacterCardImportCompatibility(card);

    if (rawResolved?.resolvedName && rawResolved.resolvedName !== 'current') {
      showToast(`已自动改用角色卡: ${rawResolved.resolvedName}`);
    }

    updateProgress(88, '校验角色卡体积...');
    const cardName = card?.name || card?.data?.name || 'character';
    const date = new Date().toISOString().slice(0, 10);
    let filename = '';

    if (outputFormat === 'png') {
      if (!pngBaseFile || typeof pngBaseFile.arrayBuffer !== 'function') {
        throw new Error('PNG 导出模式需要提供有效的 PNG 底图文件');
      }
      const baseBytes = new Uint8Array(await pngBaseFile.arrayBuffer());
      if (!isPngBytes(baseBytes)) {
        throw new Error('底图不是有效 PNG 文件');
      }
      const pngBytes = embedCardIntoPngBytes(baseBytes, card, pngPrettyJsonIndent);
      const bytes = pngBytes.byteLength;
      checkCharacterCardExportSizePolicy(bytes, appendExportNotice);
      filename = `${sanitizeFileName(cardName)}.galgame-packed.${date}.png`;
      updateProgress(94, '生成 PNG 角色卡...');
      downloadBlob(filename, new Blob([pngBytes], { type: 'image/png' }));
    } else {
      filename = `${sanitizeFileName(cardName)}.galgame-packed.${date}.json`;
      updateProgress(94, '生成导出文件...');
      const outputText = JSON.stringify(card, null, 2);
      const bytes = new TextEncoder().encode(outputText).length;
      checkCharacterCardExportSizePolicy(bytes, appendExportNotice);
      downloadTextFile(filename, outputText, 'application/json');
    }

    updateProgress(100, '导出完成');
    exportSucceeded = true;
    showToast(`角色卡导出成功: ${filename}`);
    if (Array.isArray(config?.meta?.warnings) && config.meta.warnings.length > 0) {
      console.warn(`[${SCRIPT_NAME}] 角色卡导出警告`, config.meta.warnings);
      if (interactive) {
        await showInAppAlertDialog({
          title: '导出完成提醒',
          message: '导出完成，但有以下提醒：',
          details: config.meta.warnings.map((w, i) => `${i + 1}. ${w}`),
          buttonText: '我知道了',
          iconClass: 'fa-solid fa-triangle-exclamation',
          accent: '#f39c12',
        });
      }
    }
    return true;
  } catch (e) {
    console.error(`[${SCRIPT_NAME}] 导出角色卡失败`, e);
    const reasonText = String(e?.message || e || '未知错误');
    const message = `导出角色卡失败: ${reasonText}`;
    if (progressController) {
      progressController.update(100, message);
    }
    const isHardLimitError = reasonText.includes('超过导出上限') && reasonText.includes('20 MB');
    if (interactive && isHardLimitError) {
      requireErrorConfirm = true;
      await showInAppAlertDialog({
        title: '导出失败',
        message: '角色卡体积超出上限，已阻止导出。',
        details: [reasonText],
        buttonText: '确定',
        iconClass: 'fa-solid fa-circle-exclamation',
        accent: '#dc3545',
      });
    } else {
      showToast(message);
    }
    return false;
  } finally {
    if (progressController) {
      const closeDelay = exportSucceeded ? 250 : (requireErrorConfirm ? 0 : 1200);
      setTimeout(() => {
        progressController.close();
      }, closeDelay);
    }
  }
}

export async function importAssetsFromJson(file, targetPackId = null) {
  try {
    const text = await file.text();
    const json = JSON.parse(text);

    if (!targetPackId) {
      const suggestedName = json.packageName || json.name;
      targetPackId = await showImportPackSelector(suggestedName);
      if (!targetPackId) {
        showToast('已取消导入');
        return;
      }
    }

    let count = 0;
    const importedSpriteKeys = new Set();
    const importedBackgroundKeys = new Set();
    const newExpressions = [];
    const allExpressions = getAllExpressions();
    const customs = getCustomExpressions();
    const registerExpression = (exprRaw) => {
      const expr = String(exprRaw || '').trim();
      if (!expr) return;
      if (!allExpressions.includes(expr) && !newExpressions.includes(expr) && !customs.find(e => e.name === expr)) {
        newExpressions.push(expr);
        customs.push({ name: expr, emotion: null });
      }
    };

    const embeddedSprites = Array.isArray(json?.assets?.embedded?.sprites)
      ? json.assets.embedded.sprites
      : [];
    for (const rawSprite of embeddedSprites) {
      const characterId = String(rawSprite?.characterId || '').trim();
      const expression = String(rawSprite?.expression || '').trim();
      if (!characterId || !expression) continue;
      const key = `${characterId}__${expression}`.toLowerCase();
      if (importedSpriteKeys.has(key)) continue;

      let imported = false;
      const source = String(rawSprite?.source || '').trim().toLowerCase();
      const dataBase64 = String(rawSprite?.dataBase64 || '').trim();
      if ((source === 'embedded' || dataBase64) && dataBase64) {
        const bytes = base64ToUint8Array(dataBase64);
        if (bytes && bytes.byteLength > 0) {
          const blob = new Blob([bytes], {
            type: String(rawSprite?.mimeType || 'application/octet-stream').trim() || 'application/octet-stream',
          });
          await saveSprite(characterId, expression, blob, null, targetPackId);
          imported = true;
        } else {
          console.warn(`[${SCRIPT_NAME}] 跳过无效立绘 base64: ${characterId}/${expression}`);
        }
      }
      if (!imported) {
        const remoteUrl = String(rawSprite?.url || rawSprite?.imageUrl || '').trim();
        if (remoteUrl) {
          await saveSprite(characterId, expression, null, remoteUrl, targetPackId);
          imported = true;
        }
      }
      if (imported) {
        importedSpriteKeys.add(key);
        registerExpression(expression);
        count++;
      }
    }

    if (Array.isArray(json?.sprites)) {
      for (const s of json.sprites) {
        const characterId = String(s?.characterId || '').trim();
        const expression = String(s?.expression || '').trim();
        const remoteUrl = String(s?.url || s?.imageUrl || '').trim();
        if (!characterId || !expression || !remoteUrl) continue;
        const key = `${characterId}__${expression}`.toLowerCase();
        if (importedSpriteKeys.has(key)) continue;
        await saveSprite(characterId, expression, null, remoteUrl, targetPackId);
        importedSpriteKeys.add(key);
        registerExpression(expression);
        count++;
      }
    }
    if (newExpressions.length > 0) {
      saveCustomExpressions(customs);
      console.log(`[${SCRIPT_NAME}] 自动注册表情标签: ${newExpressions.join(', ')}`);
    }

    const embeddedBackgrounds = Array.isArray(json?.assets?.embedded?.backgrounds)
      ? json.assets.embedded.backgrounds
      : [];
    for (const rawBackground of embeddedBackgrounds) {
      const sceneName = String(rawBackground?.sceneName || '').trim();
      if (!sceneName) continue;
      const key = sceneName.toLowerCase();
      if (importedBackgroundKeys.has(key)) continue;

      let imported = false;
      const source = String(rawBackground?.source || '').trim().toLowerCase();
      const dataBase64 = String(rawBackground?.dataBase64 || '').trim();
      if ((source === 'embedded' || dataBase64) && dataBase64) {
        const bytes = base64ToUint8Array(dataBase64);
        if (bytes && bytes.byteLength > 0) {
          const blob = new Blob([bytes], {
            type: String(rawBackground?.mimeType || 'application/octet-stream').trim() || 'application/octet-stream',
          });
          await saveBackground(sceneName, blob, null, targetPackId);
          imported = true;
        } else {
          console.warn(`[${SCRIPT_NAME}] 跳过无效背景 base64: ${sceneName}`);
        }
      }
      if (!imported) {
        const remoteUrl = String(rawBackground?.url || rawBackground?.imageUrl || '').trim();
        if (remoteUrl) {
          await saveBackground(sceneName, null, remoteUrl, targetPackId);
          imported = true;
        }
      }
      if (imported) {
        importedBackgroundKeys.add(key);
        count++;
      }
    }

    if (Array.isArray(json?.backgrounds)) {
      for (const bg of json.backgrounds) {
        const sceneName = String(bg?.sceneName || '').trim();
        const remoteUrl = String(bg?.url || bg?.imageUrl || '').trim();
        if (!sceneName || !remoteUrl) continue;
        const key = sceneName.toLowerCase();
        if (importedBackgroundKeys.has(key)) continue;
        await saveBackground(sceneName, null, remoteUrl, targetPackId);
        importedBackgroundKeys.add(key);
        count++;
      }
    }
    let mapImported = false;
    const cardMapPayload = json?.custom?.mapImage || json?.custom?.mapAsset || json?.mapImage || json?.meta?.mapImage || null;
    if (cardMapPayload) {
      try {
        mapImported = await applyImportedCardMapImagePayload(cardMapPayload, targetPackId);
        if (mapImported) count++;
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] 导入角色卡地图图片失败`, e);
      }
    }
    if (!mapImported && Array.isArray(json.maps)) {
      const mapCandidates = json.maps
        .map(rawMap => ({
          regionKey: String(rawMap?.regionKey || '').trim(),
          remoteUrl: String(rawMap?.url || rawMap?.imageUrl || '').trim(),
        }))
        .filter(item => !!item.remoteUrl);
      const preferredMap = pickPreferredMapRecordFromList(mapCandidates, GLOBAL_MAP_REGION_KEY);
      if (preferredMap) {
        await saveUnifiedMapImage(null, preferredMap.remoteUrl, targetPackId);
        count++;
      }
    }
    if (Array.isArray(json.uiSkins)) {
      for (const rawItem of json.uiSkins) {
        const meta = normalizeUiSkinMetaRecord(rawItem);
        if (!meta) continue;
        const remoteUrl = String(rawItem.url || rawItem.imageUrl || '').trim();
        const payload = {
          packId: targetPackId,
          skinId: meta.skinId,
          elementId: meta.elementId,
          device: meta.device,
          state: meta.state,
          layout: meta.layout,
          scaleMode: meta.scaleMode,
          slice: meta.slice,
          textPadding: meta.textPadding,
          meta: meta.meta,
        };
        if (remoteUrl) {
          payload.imageUrl = remoteUrl;
          payload.imageBlob = null;
        }
        await saveUiSkinAsset(payload);
        count++;
      }
    }
    const mapSettingsApplied = applyImportedMapSettings(json.mapSettings || json?.custom?.map || json?.meta?.mapSettings);
    showToast(
      mapSettingsApplied
        ? `成功导入 ${count} 项资源，并同步地图设置`
        : `成功导入 ${count} 项资源`,
    );
  } catch (e) {
    console.error('JSON导入失败', e);
    showToast('JSON导入失败: ' + e.message);
  }
}

export const AssetIO = {
  jszip: null,
  async loadJSZip() {
    if (this.jszip) return this.jszip;
    if (window.JSZip) {
      this.jszip = window.JSZip;
      return this.jszip;
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.onload = () => {
        this.jszip = window.JSZip;
        console.log(`[${SCRIPT_NAME}] JSZip 加载成功`);
        resolve(this.jszip);
      };
      script.onerror = () => reject(new Error('JSZip load failed'));
      document.head.appendChild(script);
    });
  },
  async exportAllAssets(remoteBaseUrl = null, packageName = null) {
    try {
      showToast('正在准备导出...');
      const zip = new (await this.loadJSZip())();

      const currentPackId = getCurrentPackId();
      const allPacks = await getAllImagePacks();
      const currentPack = allPacks.find(p => p.id === currentPackId);
      const currentPackName = currentPack ? currentPack.name : '未命名包';

      const remoteConfig = {
        packageName: packageName || currentPackName,
        exportDate: new Date().toISOString(),
        packId: currentPackId,
        sprites: [],
        backgrounds: [],
        maps: [],
        uiSkins: [],
        mapSettings: buildExportableMapSettings(),
      };
      const baseUrl = remoteBaseUrl ? (remoteBaseUrl.endsWith('/') ? remoteBaseUrl : remoteBaseUrl + '/') : '';
      const sprites = await getAllSprites(currentPackId);
      const spritesFolder = zip.folder('sprites');
      for (const s of sprites) {
        if (s.imageBlob) {
          const ext = s.imageBlob.type.split('/')[1] || 'png';
          const safeChar = s.characterId.replace(/[\\/:*?"<>|]/g, '');
          const safeExpr = s.expression.replace(/[\\/:*?"<>|]/g, '');
          const filename = `${safeChar}_${safeExpr}.${ext}`;
          spritesFolder.file(filename, s.imageBlob);
          if (remoteBaseUrl) {
            remoteConfig.sprites.push({
              characterId: s.characterId,
              expression: s.expression,
              url: `${baseUrl}sprites/${filename}`,
              packId: s.packId || DEFAULT_PACK_ID,
            });
          }
        }
      }
      const backgrounds = await getAllBackgrounds(currentPackId);
      const bgFolder = zip.folder('backgrounds');
      for (const bg of backgrounds) {
        if (bg.imageBlob) {
          const ext = bg.imageBlob.type.split('/')[1] || 'png';
          const safeScene = bg.sceneName.replace(/[\\/:*?"<>|]/g, '');
          const filename = `${safeScene}.${ext}`;
          bgFolder.file(filename, bg.imageBlob);
          if (remoteBaseUrl) {
            remoteConfig.backgrounds.push({
              sceneName: bg.sceneName,
              url: `${baseUrl}backgrounds/${filename}`,
              packId: bg.packId || DEFAULT_PACK_ID,
            });
          }
        }
      }

      const allMaps = await getAllMapImages(currentPackId);
      const preferredMap = pickPreferredMapRecordFromList(allMaps, GLOBAL_MAP_REGION_KEY);
      const maps = preferredMap ? [preferredMap] : [];
      const mapManifest = [];
      if (maps.length > 0) {
        const mapFolder = zip.folder('maps');
        const mapFileNameSet = new Set();
        for (const rawMap of maps) {
          const regionKey = GLOBAL_MAP_REGION_KEY;
          const manifestRecord = {
            regionKey,
            packId: String(rawMap?.packId || DEFAULT_PACK_ID).trim() || DEFAULT_PACK_ID,
            lastModified: rawMap?.lastModified ? String(rawMap.lastModified) : '',
          };
          if (rawMap.imageBlob) {
            const ext = rawMap.imageBlob.type.split('/')[1] || 'png';
            const safeBase = 'world_map';
            let fileName = `${safeBase}.${ext}`;
            let seq = 2;
            while (mapFileNameSet.has(fileName)) {
              fileName = `${safeBase}_${seq}.${ext}`;
              seq += 1;
            }
            mapFileNameSet.add(fileName);
            mapFolder.file(fileName, rawMap.imageBlob);
            manifestRecord.file = fileName;
            if (remoteBaseUrl) {
              remoteConfig.maps.push({
                regionKey,
                url: `${baseUrl}maps/${fileName}`,
                packId: manifestRecord.packId,
              });
            }
          } else if (rawMap.imageUrl) {
            const remoteUrl = String(rawMap.imageUrl || '').trim();
            if (!remoteUrl) continue;
            manifestRecord.imageUrl = remoteUrl;
            if (remoteBaseUrl) {
              remoteConfig.maps.push({
                regionKey,
                url: remoteUrl,
                packId: manifestRecord.packId,
              });
            }
          } else {
            continue;
          }
          mapManifest.push(manifestRecord);
        }
      }
      if (mapManifest.length > 0) {
        zip.file('maps/manifest.json', JSON.stringify({ version: '1.0', assets: mapManifest }, null, 2));
      }

      const allUiSkinAssets = await getAllUiSkinAssets();
      const uiSkinAssets = allUiSkinAssets.filter(asset => {
        const assetPackId = String(asset?.packId || DEFAULT_PACK_ID).trim() || DEFAULT_PACK_ID;
        return assetPackId === currentPackId;
      });
      const uiSkinManifest = [];
      if (uiSkinAssets.length > 0) {
        const uiSkinFolder = zip.folder('ui-skins');
        for (const rawAsset of uiSkinAssets) {
          const meta = normalizeUiSkinMetaRecord(rawAsset);
          if (!meta) continue;
          const manifestRecord = {
            skinId: meta.skinId,
            elementId: meta.elementId,
            device: meta.device,
            state: meta.state,
            scaleMode: meta.scaleMode,
            layout: meta.layout,
            slice: meta.slice,
            textPadding: meta.textPadding,
            meta: meta.meta,
          };
          if (rawAsset.imageBlob) {
            const ext = rawAsset.imageBlob.type.split('/')[1] || 'png';
            const fileName = buildUiSkinZipFilename(meta, ext);
            uiSkinFolder.file(fileName, rawAsset.imageBlob);
            manifestRecord.file = fileName;
            if (remoteBaseUrl) {
              remoteConfig.uiSkins.push({
                ...manifestRecord,
                url: `${baseUrl}ui-skins/${fileName}`,
                packId: currentPackId,
              });
            }
          } else if (rawAsset.imageUrl) {
            manifestRecord.imageUrl = rawAsset.imageUrl;
            if (remoteBaseUrl) {
              remoteConfig.uiSkins.push({
                ...manifestRecord,
                url: rawAsset.imageUrl,
                packId: currentPackId,
              });
            }
          }
          uiSkinManifest.push(manifestRecord);
        }
        zip.file('ui-skins/manifest.json', JSON.stringify({ version: '1.0', assets: uiSkinManifest }, null, 2));
      }

      const packageInfo = {
        packageName: packageName || currentPackName,
        exportDate: new Date().toISOString(),
        version: '1.2',
        packId: currentPackId,
        spriteCount: sprites.length,
        backgroundCount: backgrounds.length,
        mapCount: maps.length,
        uiSkinCount: uiSkinAssets.length,
        mapSettings: remoteConfig.mapSettings,
      };
      zip.file('package_info.json', JSON.stringify(packageInfo, null, 2));
      if (remoteBaseUrl) {
        zip.file('remote_assets.json', JSON.stringify(remoteConfig, null, 2));
      }
      showToast('正在压缩打包...');
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      const safePackageName = (packageName || currentPackName).replace(/[\\/:*?"<>|]/g, '_');
      const date = new Date().toISOString().slice(0, 10);
      a.download = `${safePackageName}_${date}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`导出成功！共导出 ${sprites.length} 个立绘，${backgrounds.length} 个背景，${maps.length} 张地图，${uiSkinAssets.length} 个皮肤元素`);
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 导出失败:`, e);
      showToast('导出失败: ' + e.message);
    }
  },
  async importFiles(fileList, targetPackId = null) {
    if (!targetPackId) {
      targetPackId = await showImportPackSelector('文件夹导入');
      if (!targetPackId) {
        showToast('已取消导入');
        return false;
      }
    }

    let successCount = 0;
    let failCount = 0;
    showToast('开始导入...');
    for (const file of fileList) {
      try {
        const path = file.webkitRelativePath || file.name;
        const isSpriteFolder = path.includes('sprites/');
        const isBgFolder = path.includes('backgrounds/');
        const isMapFolder = path.includes('maps/');
        let imported = false;
        if (isSpriteFolder) {
          await this.importAsSprite(file, targetPackId);
          imported = true;
        } else if (isBgFolder) {
          await this.importAsBackground(file, targetPackId);
          imported = true;
        } else if (isMapFolder) {
          await this.importAsMap(file, targetPackId);
          imported = true;
        } else if (file.name.includes('_')) {
          await this.importAsSprite(file, targetPackId);
          imported = true;
        } else {
          await this.importAsBackground(file, targetPackId);
          imported = true;
        }
        if (imported) successCount++;
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] 导入文件 ${file.name} 失败:`, e);
        failCount++;
      }
    }
    showToast(`导入完成: ${successCount} 成功, ${failCount} 失败`);
    return successCount > 0;
  },
  async importAsSprite(file, packId = null) {
    const fileName = file.name.split('/').pop();
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
    const parts = nameWithoutExt.split('_');
    if (parts.length >= 2) {
      const expression = parts.pop();
      const characterId = parts.join('_');
      if (characterId && expression) {
        await saveSprite(characterId, expression, file, null, packId);
        console.log(`[${SCRIPT_NAME}] 导入立绘: ${characterId} - ${expression}`);
        const allExpressions = getAllExpressions();
        if (!allExpressions.includes(expression)) {
          const customs = getCustomExpressions();
          if (!customs.find(e => e.name === expression)) {
            customs.push({ name: expression, emotion: null });
            saveCustomExpressions(customs);
            console.log(`[${SCRIPT_NAME}] 自动注册表情标签: ${expression}`);
          }
        }
        return;
      }
    }
    throw new Error('鏂囦欢鍚嶆牸寮忎笉鍖归厤 Name_Expression.ext');
  },
  async importAsBackground(file, packId = null) {
    const fileName = file.name.split('/').pop();
    const sceneName = fileName.substring(0, fileName.lastIndexOf('.'));
    if (sceneName) {
      await saveBackground(sceneName, file, null, packId);
      console.log(`[${SCRIPT_NAME}] 导入背景: ${sceneName}`);
    }
  },
  async importAsMap(file, packId = null) {
    const fileName = file.name.split('/').pop();
    if (!fileName) return;
    await saveUnifiedMapImage(file, null, packId);
    console.log(`[${SCRIPT_NAME}] 导入统一世界地图: ${fileName}`);
  },
  async importFromGitHub(repoUrl, targetPackId = null) {
    try {
      if (!targetPackId) {
        targetPackId = await showImportPackSelector(`GitHub导入`);
        if (!targetPackId) {
          showToast('已取消导入');
          return false;
        }
      }

      let owner, repo, path = '';
      let branch = 'main';
      if (repoUrl.startsWith('http')) {
        const urlObj = new URL(repoUrl);
        const parts = urlObj.pathname.split('/').filter(p => p);
        if (parts.length >= 2) {
          owner = parts[0];
          repo = parts[1];
          if (parts[2] === 'tree' || parts[2] === 'blob') {
            branch = parts[3];
            path = parts.slice(4).join('/');
          }
        }
      } else {
        const parts = repoUrl.split('/');
        if (parts.length >= 2) {
          owner = parts[0];
          repo = parts[1];
          if (parts.length > 2) path = parts.slice(2).join('/');
        }
      }
      if (!owner || !repo) {
        throw new Error('鏃犳晥鐨?GitHub 浠撳簱鍦板潃');
      }
      showToast(`正在获取文件列表: ${owner}/${repo}...`);
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`GitHub API Error: ${response.statusText}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('路径不是一个目录');
      const imageFiles = data.filter(item => item.type === 'file' && /\.(png|jpg|jpeg|gif|webp)$/i.test(item.name));
      if (imageFiles.length === 0) {
        showToast('该目录下没有找到图片文件');
        return;
      }
      if (!confirm(`找到 ${imageFiles.length} 张图片，是否开始导入？`)) return;
      let count = 0;
      for (const item of imageFiles) {
        showToast(`正在下载 (${count + 1}/${imageFiles.length}): ${item.name}`);
        try {
          const imgRes = await fetch(item.download_url);
          const blob = await imgRes.blob();
          const file = new File([blob], item.name, { type: blob.type });
          const itemPath = String(item.path || item.name || '').toLowerCase();
          if (itemPath.includes('/maps/') || itemPath.startsWith('maps/')) {
            await this.importAsMap(file, targetPackId);
          } else if (item.name.includes('_')) {
            await this.importAsSprite(file, targetPackId);
          } else {
            await this.importAsBackground(file, targetPackId);
          }
          count++;
        } catch (e) {
          console.error(`下载/导入 ${item.name} 失败:`, e);
        }
      }
      showToast(`GitHub 导入完成，共 ${count} 张图片`);
      return true;
    } catch (e) {
      console.error('GitHub Import Error:', e);
      showToast('GitHub 导入失败: ' + e.message);
      return false;
    }
  },
};

export function showRemoteZipImportDialog() {
  const dialogHtml = `
    <div class="gal-input-modal" id="gal-remote-zip-dialog">
      <div class="gal-input-box" style="max-width: 500px; width: 90%; padding: 25px;">
        <div class="gal-input-title" style="margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
          <span><i class="fa-solid fa-cloud-arrow-down"></i> 远程压缩包导入</span>
          <button id="gal-remote-zip-close-x" title="关闭" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px; line-height: 1; transition: color 0.2s; transform: none;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div style="margin-bottom: 15px;">
          <label style="display: block; font-weight: 700; margin-bottom: 8px; color: #2b2e38;">
            <i class="fa-solid fa-link"></i> ZIP 文件链接
          </label>
          <input type="text" id="gal-remote-zip-url"
                 placeholder="https://example.com/assets.zip"
                 style="width: 100%; padding: 12px 15px; border: 2px solid #ddd; font-size: 1rem; box-sizing: border-box; border-radius: 6px;">
          <small style="color: #888; margin-top: 5px; display: block;">
            支持直接下载链接，如 GitHub Release、云盘直链等<br>
            <strong style="color: #e74c3c;">限制：最大 5GB</strong>
          </small>
        </div>
        <div class="gal-input-actions" style="display: flex; gap: 12px;">
          <button class="gal-action-btn primary" id="gal-remote-zip-confirm" style="flex: 1; min-height: 44px; justify-content: center;">
            <i class="fa-solid fa-download"></i>
            <span>下载并导入</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const mountRoot = getModalMountRoot();
  $(mountRoot).append(dialogHtml);
  const $dialog = $(mountRoot).find('#gal-remote-zip-dialog');
  makeDraggable($dialog.find('.gal-input-box'), $dialog.find('.gal-input-title'));

  $dialog.find('#gal-remote-zip-close-x').on('click', () => $dialog.remove());
  $dialog.on('click', function (e) {
    if (e.target === this) $dialog.remove();
  });

  $dialog.find('#gal-remote-zip-confirm').on('click', async function () {
    const url = $dialog.find('#gal-remote-zip-url').val().trim();
    if (!url) {
      showToast('请输入ZIP文件链接');
      return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      showToast('请输入有效的 HTTP/HTTPS 链接');
      return;
    }
    $dialog.remove();
    await importFromRemoteZip(url);
  });
}

export async function importFromZipFile(file) {
  let isCancelled = false;
  const progressController = showImportProgress('正在解压本地文件...', () => {
    isCancelled = true;
    showToast('导入已手动取消');
  });

  try {
    const JSZip = await AssetIO.loadJSZip();
    const zip = await JSZip.loadAsync(file, {
      onprogress: event => {
        if (isCancelled) return;
        const percent = Math.round(event.percent || 0);
        progressController.update(percent, `瑙ｅ帇涓?.. ${percent}%`);
      },
    });

    if (isCancelled) {
      progressController.close();
      return;
    }

    await processZipContents(zip, progressController, () => isCancelled);

    if (!isCancelled) {
      progressController.close();
      showToast('ZIP 导入完成');
    } else {
      progressController.close();
    }
  } catch (e) {
    progressController.close();
    if (isCancelled) return;
    console.error('ZIP导入失败:', e);
    showImportError(['ZIP文件解析失败', e.message || '未知错误', '请确保文件是有效的ZIP格式']);
  }
}

export async function importFromRemoteZip(url) {
  const abortController = new AbortController();
  let isCancelled = false;

  const progressController = showImportProgress('正在下载远程文件...', () => {
    isCancelled = true;
    abortController.abort();
    showToast('下载已取消');
  });

  try {
    const response = await fetch(url, { signal: abortController.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentLength = response.headers.get('Content-Length');
    const MAX_SIZE = 5 * 1024 * 1024 * 1024;

    if (contentLength && parseInt(contentLength) > MAX_SIZE) {
      throw new Error(`鏂囦欢澶у皬 ${(parseInt(contentLength) / 1024 / 1024 / 1024).toFixed(2)} GB 瓒呰繃 5GB 闄愬埗`);
    }

    const reader = response.body.getReader();
    const chunks = [];
    let receivedLength = 0;
    const totalLength = contentLength ? parseInt(contentLength) : 0;
    let lastProgressUpdate = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      receivedLength += value.length;

      if (receivedLength > MAX_SIZE) {
        throw new Error('下载的文件大小超过 5GB 限制');
      }

      const now = Date.now();
      if (totalLength > 0) {
        const percent = Math.round((receivedLength / totalLength) * 100);
        const downloaded = (receivedLength / 1024 / 1024).toFixed(1);
        const total = (totalLength / 1024 / 1024).toFixed(1);
        if (now - lastProgressUpdate > 200 || percent === 100) {
          progressController.update(percent, `下载中 ${downloaded} MB / ${total} MB`);
          lastProgressUpdate = now;
        }
      } else {
        const downloaded = (receivedLength / 1024 / 1024).toFixed(1);
        if (now - lastProgressUpdate > 200) {
          progressController.update(-1, `下载中 ${downloaded} MB`);
          lastProgressUpdate = now;
        }
      }
    }

    if (isCancelled) {
      progressController.close();
      return;
    }

    const blob = new Blob(chunks);
    progressController.update(100, '下载完成，开始解压...');

    const JSZip = await AssetIO.loadJSZip();
    const zip = await JSZip.loadAsync(blob);

    await processZipContents(zip, progressController, () => isCancelled);

    if (!isCancelled) {
      progressController.close();
      showToast('远程 ZIP 导入完成');
    } else {
      progressController.close();
    }
  } catch (e) {
    progressController.close();
    if (e.name === 'AbortError' || isCancelled) return;
    console.error('远程ZIP导入失败:', e);
    showImportError(['远程ZIP下载/导入失败', e.message || '网络错误', '请检查链接是否有效、是否支持跨域']);
  }
}

export async function showImportPackSelector(suggestedName = null) {
  return new Promise((resolve) => {
    getAllImagePacks().then(packs => {
      const currentPackId = getCurrentPackId();
      const currentPack = packs.find(p => p.id === currentPackId);
      const currentPackName = currentPack ? currentPack.name : '当前图包';

      const packOptions = packs.map(p =>
        `<option value="${p.id}">${p.name}${p.id === currentPackId ? ' (当前)' : ''}</option>`
      ).join('');

      const defaultNewName = suggestedName || `导入包_${new Date().toISOString().slice(0, 10)}`;

      const dialogHtml = `
        <div class="gal-input-modal gal-z-critical" id="gal-import-pack-selector">
          <div class="gal-input-box" style="max-width: 450px; width: 90%; padding: 25px;">
            <div class="gal-input-title" style="margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
              <span><i class="fa-solid fa-box-open"></i> 选择导入目标图包</span>
              <button id="gal-import-pack-close-x" title="关闭" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px; line-height: 1; transition: color 0.2s; transform: none;">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div style="margin-bottom: 20px;">
              <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; cursor: pointer; padding: 10px; border: 2px solid #3498db; border-radius: 6px; background: #f8f9fa;">
                <input type="radio" name="import-target" value="current" checked style="width: 18px; height: 18px;">
                <span style="font-weight: 600; color: #2b2e38;">导入到当前图包</span>
                <span style="color: #666; font-size: 0.85rem; margin-left: auto;">${currentPackName}</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; cursor: pointer; padding: 10px; border: 2px solid #ddd; border-radius: 6px;">
                <input type="radio" name="import-target" value="existing" style="width: 18px; height: 18px;">
                <span style="font-weight: 600; color: #2b2e38;">导入到已有图包</span>
              </label>
              <select id="gal-import-existing-pack" disabled style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 4px; margin-bottom: 15px; margin-left: 26px; opacity: 0.6;">
                ${packOptions}
              </select>
              <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; cursor: pointer; padding: 10px; border: 2px solid #ddd; border-radius: 6px;">
                <input type="radio" name="import-target" value="new" style="width: 18px; height: 18px;">
                <span style="font-weight: 600; color: #2b2e38;">创建新图包</span>
              </label>
              <input type="text" id="gal-import-new-pack-name" disabled placeholder="杈撳叆鏂板浘鍖呭悕绉? value="${defaultNewName}"
                     style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 4px; margin-left: 26px; opacity: 0.6; box-sizing: border-box;">
            </div>
            <div class="gal-input-actions" style="display: flex; gap: 12px;">
              <button class="gal-action-btn" id="gal-import-pack-confirm" style="flex: 1; min-height: 44px; justify-content: center; background: #28a745; color: #fff; border-color: #28a745;">
                <i class="fa-solid fa-check"></i> <span>确认导入</span>
              </button>
            </div>
          </div>
        </div>
      `;

      const mountRoot = getModalMountRoot();
      $(mountRoot).append(dialogHtml);
      const $dialog = $(mountRoot).find('#gal-import-pack-selector');

      $dialog.find('input[name="import-target"]').on('change', function() {
        const value = $(this).val();
        const $existingSelect = $dialog.find('#gal-import-existing-pack');
        const $newInput = $dialog.find('#gal-import-new-pack-name');
        $existingSelect.prop('disabled', value !== 'existing').css('opacity', value === 'existing' ? 1 : 0.6);
        $newInput.prop('disabled', value !== 'new').css('opacity', value === 'new' ? 1 : 0.6);
        $dialog.find('label').css('border-color', '#ddd');
        $(this).closest('label').css('border-color', '#3498db');
      });

      $dialog.find('#gal-import-pack-confirm').on('click', () => {
        const targetType = $dialog.find('input[name="import-target"]:checked').val();
        let resultPackId = null;

        if (targetType === 'current') {
          resultPackId = currentPackId;
        } else if (targetType === 'existing') {
          resultPackId = $dialog.find('#gal-import-existing-pack').val();
        } else if (targetType === 'new') {
          const newName = $dialog.find('#gal-import-new-pack-name').val().trim();
          if (!newName) {
            showToast('请输入新图包名称');
            return;
          }
          createImagePack(newName).then(newPack => {
            $dialog.remove();
            resolve(newPack.id);
          }).catch(err => {
            showToast('创建图包失败: ' + err.message);
          });
          return;
        }

        $dialog.remove();
        resolve(resultPackId);
      });

      $dialog.find('#gal-import-pack-close-x').on('click', () => {
        $dialog.remove();
        resolve(null);
      });

      $dialog.on('click', function(e) {
        if (e.target === this) {
          $dialog.remove();
          resolve(null);
        }
      });
    }).catch(err => {
      console.error('获取图包列表失败:', err);
      showToast('获取图包列表失败');
      resolve(null);
    });
  });
}

export async function processZipContents(zip, progressController, isCancelledCheck, targetPackId = null) {
  const zipPaths = Object.keys(zip.files);
  const hasSpritesDir = zipPaths.some(path => path.startsWith('sprites/'));
  const hasBackgroundsDir = zipPaths.some(path => path.startsWith('backgrounds/'));
  const hasMapsDir = zipPaths.some(path => path.startsWith('maps/'));
  const hasUiSkinsDir = zipPaths.some(path => path.startsWith('ui-skins/'));

  let packageInfo = null;
  const infoFile = zip.file('package_info.json');
  if (infoFile) {
    try {
      const infoText = await infoFile.async('text');
      packageInfo = JSON.parse(infoText);
      console.log(`[${SCRIPT_NAME}] 读取到包信息:`, packageInfo);
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 读取 package_info.json 失败:`, e);
    }
  }

  let uiSkinManifestAssets = [];
  const uiSkinManifestFile = zip.file('ui-skins/manifest.json');
  if (uiSkinManifestFile) {
    try {
      const manifestText = await uiSkinManifestFile.async('text');
      const manifestJson = JSON.parse(manifestText);
      if (Array.isArray(manifestJson?.assets)) {
        uiSkinManifestAssets = manifestJson.assets;
      }
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 读取 ui-skins/manifest.json 失败:`, e);
    }
  }

  let mapManifestAssets = [];
  const mapManifestFile = zip.file('maps/manifest.json');
  if (mapManifestFile) {
    try {
      const manifestText = await mapManifestFile.async('text');
      const manifestJson = JSON.parse(manifestText);
      if (Array.isArray(manifestJson?.assets)) {
        mapManifestAssets = manifestJson.assets;
      }
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 读取 maps/manifest.json 失败:`, e);
    }
  }

  const uiSkinManifestByFile = new Map();
  const uiSkinManifestUrlOnly = [];
  uiSkinManifestAssets.forEach(item => {
    const meta = normalizeUiSkinMetaRecord(item);
    if (!meta) return;
    const fileName = String(item.file || '').trim();
    const imageUrl = String(item.imageUrl || item.url || '').trim();
    if (fileName) {
      uiSkinManifestByFile.set(fileName, { ...meta, imageUrl });
      uiSkinManifestByFile.set(`ui-skins/${fileName}`, { ...meta, imageUrl });
      return;
    }
    if (imageUrl) {
      uiSkinManifestUrlOnly.push({ ...meta, imageUrl });
    }
  });

  const mapManifestByFile = new Map();
  const mapManifestUrlOnly = [];
  mapManifestAssets.forEach(item => {
    const regionKey = String(item?.regionKey || '').trim();
    if (!regionKey) return;
    const fileName = String(item?.file || '').trim();
    const imageUrl = String(item?.imageUrl || item?.url || '').trim();
    const lastModified = String(item?.lastModified || '').trim();
    const payload = { regionKey, imageUrl, lastModified };
    if (fileName) {
      mapManifestByFile.set(fileName, payload);
      mapManifestByFile.set(`maps/${fileName}`, payload);
      return;
    }
    if (imageUrl) {
      mapManifestUrlOnly.push(payload);
    }
  });

  if (!hasSpritesDir && !hasBackgroundsDir && !hasMapsDir && !hasUiSkinsDir && uiSkinManifestUrlOnly.length === 0 && mapManifestUrlOnly.length === 0) {
    throw new Error('ZIP 包格式错误：需包含 sprites/、backgrounds/、maps/ 或 ui-skins/ 目录');
  }

  if (!targetPackId) {
    const suggestedName = packageInfo?.packageName || packageInfo?.name;
    targetPackId = await showImportPackSelector(suggestedName);
    if (!targetPackId) {
      showToast('已取消导入');
      return;
    }
  }

  const imageFiles = [];
  zip.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir) return;
    const isSprite = relativePath.startsWith('sprites/');
    const isBackground = relativePath.startsWith('backgrounds/');
    const isMap = relativePath.startsWith('maps/');
    const isUiSkin = relativePath.startsWith('ui-skins/');
    if (!isSprite && !isBackground && !isMap && !isUiSkin) return;
    const ext = relativePath.split('.').pop().toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) return;
    imageFiles.push({
      path: relativePath,
      entry: zipEntry,
      type: isSprite ? 'sprite' : isBackground ? 'background' : isMap ? 'map' : 'ui-skin',
    });
  });

  const totalItems = imageFiles.length + uiSkinManifestUrlOnly.length + mapManifestUrlOnly.length;
  if (totalItems === 0) {
    throw new Error('ZIP 包中未找到有效资源文件');
  }

  progressController.update(0, `准备导入 ${totalItems} 个资源...`);

  const BATCH_SIZE = 50;
  let successCount = 0;
  const failedItems = [];

  for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
    if (isCancelledCheck && isCancelledCheck()) {
      console.log(`[${SCRIPT_NAME}] 导入已取消`);
      return;
    }

    const batch = imageFiles.slice(i, i + BATCH_SIZE);
    const spriteBatch = [];
    const backgroundBatch = [];
    const mapBatch = [];
    const uiSkinBatch = [];

    await Promise.all(
      batch.map(async item => {
        try {
          const blob = await item.entry.async('blob');
          const fileName = item.path.split('/').pop();

          if (item.type === 'sprite') {
            const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
            const parts = nameWithoutExt.split('_');
            if (parts.length >= 2) {
              const expression = parts.pop();
              const characterId = parts.join('_');
              spriteBatch.push({ characterId, expression, imageBlob: blob });
            }
            return;
          }

          if (item.type === 'background') {
            const sceneName = fileName.substring(0, fileName.lastIndexOf('.'));
            backgroundBatch.push({ sceneName, imageBlob: blob });
            return;
          }

          if (item.type === 'map') {
            const manifestMeta = mapManifestByFile.get(item.path) || mapManifestByFile.get(fileName);
            let regionKey = String(manifestMeta?.regionKey || '').trim();
            if (!regionKey) {
              regionKey = fileName.substring(0, fileName.lastIndexOf('.')).trim();
            }
            if (!regionKey) {
              throw new Error('无法解析地图 regionKey，请提供 maps/manifest.json');
            }
            mapBatch.push({
              regionKey: GLOBAL_MAP_REGION_KEY,
              imageBlob: blob,
              imageUrl: null,
            });
            return;
          }

          const manifestMeta = uiSkinManifestByFile.get(item.path) || uiSkinManifestByFile.get(fileName);
          const parsedMeta = manifestMeta ? normalizeUiSkinMetaRecord(manifestMeta) : parseUiSkinMetaFromFilename(fileName);
          if (!parsedMeta) {
            throw new Error('无法解析 UI 皮肤文件名，请提供 manifest');
          }
          uiSkinBatch.push({
            ...parsedMeta,
            imageBlob: blob,
            imageUrl: null,
          });
        } catch (e) {
          console.warn(`解压 ${item.path} 失败:`, e);
          failedItems.push({ path: item.path, error: e.message });
        }
      }),
    );

    if (spriteBatch.length > 0) {
      await saveSpritesBatch(spriteBatch, targetPackId);
      const allExpressions = getAllExpressions();
      const customs = getCustomExpressions();
      const newExpressions = [];
      for (const sprite of spriteBatch) {
        const expr = sprite.expression;
        if (!allExpressions.includes(expr) && !newExpressions.includes(expr) && !customs.find(e => e.name === expr)) {
          newExpressions.push(expr);
          customs.push({ name: expr, emotion: null });
        }
      }
      if (newExpressions.length > 0) {
        saveCustomExpressions(customs);
        console.log(`[${SCRIPT_NAME}] 自动注册表情标签: ${newExpressions.join(', ')}`);
      }
    }

    if (backgroundBatch.length > 0) {
      await saveBackgroundsBatch(backgroundBatch, targetPackId);
    }

    if (mapBatch.length > 0) {
      const preferredMap = mapBatch.find(item => String(item?.regionKey || '').trim() === GLOBAL_MAP_REGION_KEY) || mapBatch[mapBatch.length - 1];
      await saveUnifiedMapImage(preferredMap?.imageBlob || null, preferredMap?.imageUrl || null, targetPackId);
    }

    if (uiSkinBatch.length > 0) {
      await Promise.all(
        uiSkinBatch.map(asset =>
          saveUiSkinAsset({
            packId: targetPackId,
            skinId: asset.skinId,
            elementId: asset.elementId,
            device: asset.device,
            state: asset.state,
            imageBlob: asset.imageBlob || null,
            imageUrl: null,
            layout: asset.layout || {},
            scaleMode: asset.scaleMode || 'stretch',
            slice: asset.slice || {},
            textPadding: asset.textPadding || {},
            meta: asset.meta || {},
          }),
        ),
      );
    }

    successCount += spriteBatch.length + backgroundBatch.length + (mapBatch.length > 0 ? 1 : 0) + uiSkinBatch.length;
    const processed = Math.min(i + BATCH_SIZE, imageFiles.length);
    const percent = Math.round((processed / totalItems) * 100);
    progressController.update(percent, `导入中... ${processed}/${totalItems} (文件资源)`);
  }

  if (!isCancelledCheck || !isCancelledCheck()) {
    for (let i = 0; i < uiSkinManifestUrlOnly.length; i++) {
      if (isCancelledCheck && isCancelledCheck()) {
        console.log(`[${SCRIPT_NAME}] 导入已取消`);
        return;
      }
      const item = uiSkinManifestUrlOnly[i];
      try {
        await saveUiSkinAsset({
          packId: targetPackId,
          skinId: item.skinId,
          elementId: item.elementId,
          device: item.device,
          state: item.state,
          imageBlob: null,
          imageUrl: item.imageUrl,
          layout: item.layout || {},
          scaleMode: item.scaleMode || 'stretch',
          slice: item.slice || {},
          textPadding: item.textPadding || {},
          meta: item.meta || {},
        });
        successCount++;
      } catch (e) {
        failedItems.push({ path: `${item.skinId}/${item.elementId}/${item.device}/${item.state}`, error: e.message });
      }
      const processed = imageFiles.length + i + 1;
      const percent = Math.round((processed / totalItems) * 100);
      progressController.update(percent, `导入中... ${processed}/${totalItems} (皮肤链接)`);
    }
  }

  if (!isCancelledCheck || !isCancelledCheck()) {
    if (isCancelledCheck && isCancelledCheck()) {
      console.log(`[${SCRIPT_NAME}] 导入已取消`);
      return;
    }
    if (mapManifestUrlOnly.length > 0) {
      const preferredMap = mapManifestUrlOnly.find(item => String(item?.regionKey || '').trim() === GLOBAL_MAP_REGION_KEY) || mapManifestUrlOnly[0];
      try {
        await saveUnifiedMapImage(null, preferredMap.imageUrl, targetPackId);
        successCount++;
      } catch (e) {
        failedItems.push({ path: `maps/${preferredMap.regionKey || GLOBAL_MAP_REGION_KEY}`, error: e.message });
      }
      const processed = imageFiles.length + uiSkinManifestUrlOnly.length + mapManifestUrlOnly.length;
      const percent = Math.round((processed / totalItems) * 100);
      progressController.update(percent, `导入中... ${processed}/${totalItems} (地图链接)`);
    }
  }

  const mapSettingsApplied = applyImportedMapSettings(packageInfo?.mapSettings);

  if (failedItems.length > 0) {
    showImportError([
      `成功: ${successCount} 个, 失败: ${failedItems.length} 个`,
      '部分文件导入失败，请检查详情。',
    ]);
  }

  console.log(`[${SCRIPT_NAME}] ZIP导入完成: 成功 ${successCount}, 失败 ${failedItems.length}, 地图设置同步=${mapSettingsApplied}`);
}

export function showImportProgress(initialText, onCancel, options = {}) {
  $('.gal-import-progress-overlay').remove();
  const title = String(options.title || '正在导入资源');
  const iconClass = String(options.iconClass || 'fa-solid fa-spinner fa-spin');
  const cancelText = String(options.cancelText || '取消');
  const initialDetails = String(options.initialDetails || '');

  const html = `
    <div class="gal-import-progress-overlay">
      <div class="gal-import-progress-box">
        <div class="gal-import-progress-title">
          <i class="${iconClass}"></i> ${title}
        </div>
        <div class="gal-import-progress-bar-container">
          <div class="gal-import-progress-bar"></div>
        </div>
        <div class="gal-import-progress-text">${initialText}</div>
        <div class="gal-import-progress-details">${initialDetails}</div>
        <button class="gal-action-btn" id="gal-import-cancel-btn" style="margin-top: 15px; background: #e74c3c; color: #fff; border: none; padding: 6px 15px; font-size: 0.9rem;">
          <i class="fa-solid fa-xmark"></i> ${cancelText}
        </button>
      </div>
    </div>
  `;

  const mountRoot = getModalMountRoot();
  $(mountRoot).append(html);
  const $overlay = $(mountRoot).find('.gal-import-progress-overlay');

  if (onCancel) {
    $overlay.find('#gal-import-cancel-btn').on('click', onCancel);
  } else {
    $overlay.find('#gal-import-cancel-btn').hide();
  }

  return {
    update: (percent, text, details) => {
      if (percent >= 0) {
        $overlay.find('.gal-import-progress-bar').css('width', percent + '%');
      } else {
        $overlay.find('.gal-import-progress-bar').css('width', '30%');
      }
      $overlay.find('.gal-import-progress-text').text(text);
      if (typeof details === 'string') {
        $overlay.find('.gal-import-progress-details').text(details);
      }
    },
    setDetails: (details) => {
      if (typeof details === 'string') {
        $overlay.find('.gal-import-progress-details').text(details);
      }
    },
    close: () => {
      $overlay.fadeOut(300, function () {
        $(this).remove();
      });
    },
  };
}

export function showImportError(messages) {
  $('#gal-import-error-dialog').remove();

  const errorHtml = `
    <div class="gal-input-modal" id="gal-import-error-dialog">
      <div class="gal-input-box" style="max-width: 500px; width: 90%; padding: 25px; border-color: #e74c3c;">
        <div class="gal-input-title" style="margin-bottom: 20px; color: #e74c3c; display: flex; align-items: center; justify-content: space-between;">
          <span><i class="fa-solid fa-circle-exclamation"></i> 导入出错</span>
          <button id="gal-import-error-close-x" title="关闭" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px; line-height: 1; transition: color 0.2s; transform: none;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div style="background: #fdf2f2; border: 1px solid #f5c6cb; border-radius: 6px; padding: 15px; margin-bottom: 20px; max-height: 300px; overflow-y: auto;">
          ${messages.map(msg => `<div style="margin-bottom: 5px; color: #721c24; font-size: 0.9rem; white-space: pre-wrap;">${msg}</div>`).join('')}
        </div>
      </div>
    </div>
  `;

  const mountRoot = getModalMountRoot();
  $(mountRoot).append(errorHtml);
  const $dialog = $(mountRoot).find('#gal-import-error-dialog');

  $dialog.find('#gal-import-error-close-x').on('click', () => $dialog.remove());
  $dialog.on('click', function (e) {
    if (e.target === this) $dialog.remove();
  });
}
