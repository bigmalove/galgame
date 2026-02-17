import { SCRIPT_NAME, DEFAULT_PACK_ID } from '../core/constants.js';
import { $, topWindow } from '../core/env.js';
import { saveSprite, saveSpritesBatch, getAllSprites } from '../db/sprites.js';
import { saveBackground, saveBackgroundsBatch, getAllBackgrounds } from '../db/backgrounds.js';
import { getCurrentPackId, getAllImagePacks, createImagePack } from '../db/image-packs.js';
import { getAllLive2DModels } from '../db/live2d-models.js';
import { getTTSEnabled, getAllCharacterTTSVoices } from '../audio/tts-config.js';
import { CHAR_USE_LIVE2D_KEY, LIVE2D_CONFIG_KEY } from '../live2d/render-mode.js';
import { withResolvedLive2DRuntime } from '../live2d/runtime-router.js';
import { getAllExpressions, getCustomExpressions, saveCustomExpressions } from '../utils/expressions.js';
import { getModalMountRoot } from './fullscreen.js';
import { showToast } from './toast.js';
import { makeDraggable } from './interaction.js';

// ============================================
// 璧勬簮瀵煎叆瀵煎嚭绠＄悊鍣?(Asset IO)
// ============================================

const DISCORD_UPLOAD_LIMIT_BYTES = 25 * 1024 * 1024;
const DEFAULT_LIVE2D_EMBED_LIMIT_BYTES = DISCORD_UPLOAD_LIMIT_BYTES;

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

function sanitizeFileName(name) {
  return String(name || 'character').replace(/[\\/:*?"<>|]/g, '_').trim() || 'character';
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

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const idx = result.indexOf(',');
        resolve(idx >= 0 ? result.slice(idx + 1) : result);
      };
      reader.onerror = () => reject(reader.error || new Error('Blob read failed'));
      reader.readAsDataURL(blob);
    } catch (e) {
      reject(e);
    }
  });
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

async function serializeLive2DModelData(modelData) {
  const normalizedModel = withResolvedLive2DRuntime(modelData);
  const out = {
    modelId: String(normalizedModel?.modelId || ''),
    runtimeType: String(normalizedModel?.runtimeType || 'legacy'),
    cubismVersion: Number(normalizedModel?.cubismVersion || 0) || null,
    uploadTime: Number(normalizedModel?.uploadTime || 0) || null,
    fileSize: Number(normalizedModel?.fileSize || 0) || null,
    modelJson: normalizedModel?.modelJson || null,
    moc3Base64: null,
    mocBase64: null,
    physicsBase64: null,
    poseBase64: null,
    textures: [],
    motions: {},
    expressions: [],
  };

  const moc3 = toArrayBuffer(normalizedModel?.moc3);
  const moc = toArrayBuffer(normalizedModel?.moc);
  const physics = toArrayBuffer(normalizedModel?.physics);
  const pose = toArrayBuffer(normalizedModel?.pose);
  if (moc3) out.moc3Base64 = arrayBufferToBase64(moc3);
  if (moc) out.mocBase64 = arrayBufferToBase64(moc);
  if (physics) out.physicsBase64 = arrayBufferToBase64(physics);
  if (pose) out.poseBase64 = arrayBufferToBase64(pose);

  if (Array.isArray(normalizedModel?.textures)) {
    for (const tex of normalizedModel.textures) {
      if (!tex?.data) continue;
      let dataBase64 = '';
      let mimeType = 'application/octet-stream';

      if (typeof Blob !== 'undefined' && tex.data instanceof Blob) {
        mimeType = tex.data.type || mimeType;
        dataBase64 = await blobToBase64(tex.data);
      } else {
        const texBuffer = toArrayBuffer(tex.data);
        if (!texBuffer) continue;
        dataBase64 = arrayBufferToBase64(texBuffer);
      }

      out.textures.push({
        name: String(tex?.name || ''),
        mimeType,
        dataBase64,
      });
    }
  }

  if (normalizedModel?.motions && typeof normalizedModel.motions === 'object') {
    for (const [groupName, list] of Object.entries(normalizedModel.motions)) {
      if (!Array.isArray(list)) continue;
      const exportedList = [];
      for (const motion of list) {
        const dataBuffer = toArrayBuffer(motion?.data);
        if (!dataBuffer) continue;
        exportedList.push({
          name: String(motion?.name || ''),
          dataBase64: arrayBufferToBase64(dataBuffer),
        });
      }
      if (exportedList.length > 0) out.motions[groupName] = exportedList;
    }
  }

  if (Array.isArray(normalizedModel?.expressions)) {
    for (const expr of normalizedModel.expressions) {
      const dataBuffer = toArrayBuffer(expr?.data);
      if (!dataBuffer) continue;
      out.expressions.push({
        name: String(expr?.name || ''),
        file: String(expr?.file || ''),
        dataBase64: arrayBufferToBase64(dataBuffer),
      });
    }
  }

  return out;
}

function ensureCardExtensions(card) {
  if (!card || typeof card !== 'object') {
    throw new Error('褰撳墠瑙掕壊鍗℃暟鎹棤鏁?');
  }
  const data = card.data && typeof card.data === 'object' ? card.data : card;
  if (!data.extensions || typeof data.extensions !== 'object') {
    data.extensions = {};
  }
  return data.extensions;
}

async function buildGalgameCardConfig(options = {}) {
  const {
    remoteInput = '',
    includeAllPacks = true,
    embedLocalLive2d = true,
    includeLocalLive2dPlaceholder = true,
    maxEmbeddedLive2dBytes = DEFAULT_LIVE2D_EMBED_LIMIT_BYTES,
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

  const { remoteBaseUrl, remoteAssetsUrl } = normalizeRemoteInput(remoteInput);
  const packList = includeAllPacks
    ? packs
    : packs.filter(p => p && String(p.id) === String(currentPackId));

  const exportedPacks = packList.map(p => {
    const packId = String(p.id || DEFAULT_PACK_ID);
    const name = String(p.name || '鏈畾涔?');
    const out = { packId, name };
    if (packId === currentPackId && (remoteBaseUrl || remoteAssetsUrl)) {
      if (remoteBaseUrl) out.remoteBaseUrl = remoteBaseUrl;
      if (remoteAssetsUrl) out.remoteAssetsUrl = remoteAssetsUrl;
    }
    return out;
  });

  reportProgress(18, 'Loading TTS and Live2D settings...');
  const ttsEnabled = !!getTTSEnabled();
  const characterVoice = getAllCharacterTTSVoices() || {};

  const live2dEnabledMap = readLocalStorageJson(CHAR_USE_LIVE2D_KEY, {});
  const live2dConfigMap = readLocalStorageJson(LIVE2D_CONFIG_KEY, {});
  const live2dModels = await getAllLive2DModels();
  const live2dList = Array.isArray(live2dModels) ? live2dModels : [];
  const live2dOutModels = {};
  const warnings = [];

  if (live2dList.length === 0) {
    reportProgress(68, 'No Live2D models detected, skipping embedded model stage');
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
    if (embedLocalLive2d) {
      const overLimit =
        Number.isFinite(maxEmbeddedLive2dBytes) &&
        maxEmbeddedLive2dBytes > 0 &&
        modelSizeBytes > maxEmbeddedLive2dBytes;

      if (overLimit) {
        const warn =
          `[Live2D] ${characterId} size ${formatSizeMb(modelSizeBytes)} exceeds Discord limit ` +
          `${formatSizeMb(maxEmbeddedLive2dBytes)}; skipped embedded export, upload to GitHub and use remote URL.`;
        warnings.push(warn);
        if (includeLocalLive2dPlaceholder) {
          live2dOutModels[characterId] = {
            source: 'idb',
            modelId: characterId,
            runtimeType: model.runtimeType || 'legacy',
            cubismVersion: Number(model?.cubismVersion || 0) || null,
            sizeBytes: modelSizeBytes,
            note: warn,
            ...(charCfg ? { config: charCfg } : {}),
          };
        }
        reportProgress(24 + Math.round(((i + 1) / Math.max(1, live2dList.length)) * 40), `Processed Live2D model ${i + 1}/${live2dList.length}`);
        continue;
      }

      try {
        const payload = await serializeLive2DModelData(model);
        live2dOutModels[characterId] = {
          source: 'embedded',
          format: 'live2d_idb_v1',
          runtimeType: model.runtimeType || 'legacy',
          cubismVersion: Number(model?.cubismVersion || 0) || null,
          sizeBytes: modelSizeBytes,
          payload,
          ...(charCfg ? { config: charCfg } : {}),
        };
      } catch (e) {
        const errMsg = e && e.message ? e.message : String(e);
        const warn = `[Live2D] ${characterId} 鏈綋瀵煎嚭澶辫触锛屽凡閫€鍥炲崰浣嶈褰曪細${errMsg}`;
        warnings.push(warn);
        if (includeLocalLive2dPlaceholder) {
          live2dOutModels[characterId] = {
            source: 'idb',
            modelId: characterId,
            runtimeType: model.runtimeType || 'legacy',
            cubismVersion: Number(model?.cubismVersion || 0) || null,
            sizeBytes: modelSizeBytes,
            note: warn,
            ...(charCfg ? { config: charCfg } : {}),
          };
        }
      }
      reportProgress(24 + Math.round(((i + 1) / Math.max(1, live2dList.length)) * 40), `Processed Live2D model ${i + 1}/${live2dList.length}`);
      continue;
    }

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

  reportProgress(72, 'Finalizing character-card extension config...');
  return {
    schema: 'galgame_ui_plugin_config_v2',
      meta: {
        exportedAt: new Date().toISOString(),
        exporter: 'galgame-ui-plugin.asset-io',
        live2dExportMode: embedLocalLive2d ? 'embedded' : (includeLocalLive2dPlaceholder ? 'idb-placeholder' : 'skip-local'),
        maxEmbeddedLive2dBytes: Number(maxEmbeddedLive2dBytes) || DEFAULT_LIVE2D_EMBED_LIMIT_BYTES,
        discordUploadLimitBytes: DISCORD_UPLOAD_LIMIT_BYTES,
        ...(warnings.length > 0 ? { warnings } : {}),
      },
    assets: {
      activePackId: currentPackId,
      packs: exportedPacks,
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
}

function estimateCardJsonBytes(cardObj) {
  const text = JSON.stringify(cardObj);
  return new TextEncoder().encode(text).length;
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
  const updateProgress = (percent, text) => {
    if (progressController) {
      progressController.update(percent, text);
    }
  };

  try {
    if (!topWindow?.TavernHelper?.getCharacter || typeof topWindow.TavernHelper.getCharacter !== 'function') {
      throw new Error('未检测到 TavernHelper.getCharacter，无法直接导出角色卡');
    }

    const interactive = options.interactive !== false;
    const preferredCharacterName = options.characterName || '';
    let remoteInput = options.remoteInput || '';
    let includeAllPacks = options.includeAllPacks;
    let embedLocalLive2d = options.embedLocalLive2d;
    let includeLocalLive2dPlaceholder = options.includeLocalLive2dPlaceholder;
    let maxEmbeddedLive2dBytes = options.maxEmbeddedLive2dBytes;

    if (interactive) {
      const remoteAnswer = await showInAppPromptDialog({
        title: '远程资源配置（可选）',
        message: '可填写 baseUrl（例如 https://cdn.jsdelivr.net/gh/user/repo@main/ ）\n也可直接填写 remote_assets.json 完整 URL。\n留空则只导出绑定配置。',
        label: '远程配置',
        placeholder: 'https://cdn.jsdelivr.net/gh/user/repo@main/',
        defaultValue: remoteInput || '',
        confirmText: '确认',
        cancelText: '跳过',
        iconClass: 'fa-solid fa-cloud',
        accent: '#17a2b8',
      });
      if (remoteAnswer === null) {
        showToast('未设置远程资源地址，继续使用当前导出参数');
      } else {
        remoteInput = remoteAnswer.trim();
      }

      includeAllPacks = includeAllPacks === undefined
        ? await showInAppConfirmDialog({
          title: '图包范围',
          message: '是否导出所有图包记录？',
          hint: '确认：保留 packs 列表（推荐）\n取消：只导出当前图包',
          confirmText: '导出所有图包',
          cancelText: '仅当前图包',
          iconClass: 'fa-solid fa-layer-group',
          accent: '#0d6efd',
        })
        : !!includeAllPacks;

      embedLocalLive2d = embedLocalLive2d === undefined
        ? await showInAppConfirmDialog({
          title: 'Live2D 导出策略',
          message: '是否导出本地 Live2D 模型本体？',
          hint: '确认：本地模型导出本体，远程模型导出 URL\n取消：本地模型不导出本体',
          confirmText: '导出本体',
          cancelText: '仅导出引用',
          iconClass: 'fa-solid fa-cube',
          accent: '#6f42c1',
        })
        : !!embedLocalLive2d;

      includeLocalLive2dPlaceholder = includeLocalLive2dPlaceholder === undefined
        ? true
        : !!includeLocalLive2dPlaceholder;

      if (embedLocalLive2d) {
        const limitInput = await showInAppPromptDialog({
          title: 'Live2D 本体导出阈值',
          message: '请输入本地 Live2D 本体导出阈值（MB）。\n超过阈值将自动跳过本体并建议改用 GitHub 远程导出。',
          label: '阈值（MB）',
          placeholder: '25',
          defaultValue: String(Math.round((Number(maxEmbeddedLive2dBytes) || DEFAULT_LIVE2D_EMBED_LIMIT_BYTES) / 1024 / 1024)),
          confirmText: '确认阈值',
          cancelText: '使用默认',
          iconClass: 'fa-solid fa-gauge-high',
          accent: '#f39c12',
          inputType: 'number',
        });
        if (limitInput === null) {
          showToast('未设置 Live2D 本体阈值，使用默认 25MB');
        } else {
          const parsedMb = Number(limitInput);
          maxEmbeddedLive2dBytes = Number.isFinite(parsedMb) && parsedMb > 0
            ? Math.floor(parsedMb * 1024 * 1024)
            : DEFAULT_LIVE2D_EMBED_LIMIT_BYTES;
        }
      }
    }

    if (includeAllPacks === undefined) includeAllPacks = true;
    if (embedLocalLive2d === undefined) embedLocalLive2d = true;
    if (includeLocalLive2dPlaceholder === undefined) includeLocalLive2dPlaceholder = true;
    if (!Number.isFinite(maxEmbeddedLive2dBytes) || maxEmbeddedLive2dBytes <= 0) {
      maxEmbeddedLive2dBytes = DEFAULT_LIVE2D_EMBED_LIMIT_BYTES;
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
      embedLocalLive2d,
      includeLocalLive2dPlaceholder,
      maxEmbeddedLive2dBytes,
      onProgress: updateProgress,
    });

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

    if (rawResolved?.resolvedName && rawResolved.resolvedName !== 'current') {
      showToast(`已自动改用角色卡: ${rawResolved.resolvedName}`);
    }

    updateProgress(88, '校验角色卡体积...');
    const bytes = estimateCardJsonBytes(card);
    if (bytes > DISCORD_UPLOAD_LIMIT_BYTES) {
      const msg =
        `导出失败：角色卡体积 ${formatSizeMb(bytes)} 超过 Discord 限制 ${formatSizeMb(DISCORD_UPLOAD_LIMIT_BYTES)}。\n请改用远程资源导出。`;
      if (interactive) {
        await showInAppAlertDialog({
          title: '导出失败',
          message: msg,
          iconClass: 'fa-solid fa-circle-exclamation',
          accent: '#dc3545',
        });
      }
      throw new Error(msg);
    }

    const cardName = card?.name || card?.data?.name || 'character';
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${sanitizeFileName(cardName)}.galgame-packed.${date}.json`;
    updateProgress(94, '生成导出文件...');
    const outputText = JSON.stringify(card, null, 2);
    downloadTextFile(filename, outputText, 'application/json');

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
    const message = `导出角色卡失败: ${e.message || e}`;
    if (progressController) {
      progressController.update(100, message);
    }
    showToast(message);
    return false;
  } finally {
    if (progressController) {
      const closeDelay = exportSucceeded ? 250 : 1200;
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
        showToast('宸插彇娑堝鍏?');
        return;
      }
    }

    let count = 0;
    const newExpressions = [];
    if (json.sprites) {
      const allExpressions = getAllExpressions();
      const customs = getCustomExpressions();
      for (const s of json.sprites) {
        if (s.characterId && s.expression && s.url) {
          await saveSprite(s.characterId, s.expression, null, s.url, targetPackId);
          count++;
          const expr = s.expression;
          if (!allExpressions.includes(expr) && !newExpressions.includes(expr) && !customs.find(e => e.name === expr)) {
            newExpressions.push(expr);
            customs.push({ name: expr, emotion: null });
          }
        }
      }
      if (newExpressions.length > 0) {
        saveCustomExpressions(customs);
        console.log(`[${SCRIPT_NAME}] 鑷姩娉ㄥ唽琛ㄦ儏鏍囩: ${newExpressions.join(', ')}`);
      }
    }
    if (json.backgrounds) {
      for (const bg of json.backgrounds) {
        if (bg.sceneName && bg.url) {
          await saveBackground(bg.sceneName, null, bg.url, targetPackId);
          count++;
        }
      }
    }
    showToast(`成功导入 ${count} 个远程资源链接`);
  } catch (e) {
    console.error('JSON瀵煎叆澶辫触', e);
    showToast('JSON瀵煎叆澶辫触: ' + e.message);
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
        console.log(`[${SCRIPT_NAME}] JSZip 鍔犺浇鎴愬姛`);
        resolve(this.jszip);
      };
      script.onerror = () => reject(new Error('JSZip load failed'));
      document.head.appendChild(script);
    });
  },
  async exportAllAssets(remoteBaseUrl = null, packageName = null) {
    try {
      showToast('姝ｅ湪鍑嗗瀵煎嚭...');
      const zip = new (await this.loadJSZip())();

      const currentPackId = getCurrentPackId();
      const allPacks = await getAllImagePacks();
      const currentPack = allPacks.find(p => p.id === currentPackId);
      const currentPackName = currentPack ? currentPack.name : '鏈懡鍚嶅寘';

      const remoteConfig = {
        packageName: packageName || currentPackName,
        exportDate: new Date().toISOString(),
        packId: currentPackId,
        sprites: [],
        backgrounds: [],
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
      const packageInfo = {
        packageName: packageName || currentPackName,
        exportDate: new Date().toISOString(),
        version: '1.0',
        packId: currentPackId,
      };
      zip.file('package_info.json', JSON.stringify(packageInfo, null, 2));
      if (remoteBaseUrl) {
        zip.file('remote_assets.json', JSON.stringify(remoteConfig, null, 2));
      }
      showToast('姝ｅ湪鍘嬬缉鎵撳寘...');
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
      showToast(`导出成功！共导出 ${sprites.length} 个立绘，${backgrounds.length} 个背景`);
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 瀵煎嚭澶辫触:`, e);
      showToast('瀵煎嚭澶辫触: ' + e.message);
    }
  },
  async importFiles(fileList, targetPackId = null) {
    if (!targetPackId) {
      targetPackId = await showImportPackSelector('鏂囦欢澶瑰鍏?');
      if (!targetPackId) {
        showToast('宸插彇娑堝鍏?');
        return false;
      }
    }

    let successCount = 0;
    let failCount = 0;
    showToast('寮€濮嬪鍏?..');
    for (const file of fileList) {
      try {
        const path = file.webkitRelativePath || file.name;
        const isSpriteFolder = path.includes('sprites/');
        const isBgFolder = path.includes('backgrounds/');
        let imported = false;
        if (isSpriteFolder) {
          await this.importAsSprite(file, targetPackId);
          imported = true;
        } else if (isBgFolder) {
          await this.importAsBackground(file, targetPackId);
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
        console.warn(`[${SCRIPT_NAME}] 瀵煎叆鏂囦欢 ${file.name} 澶辫触:`, e);
        failCount++;
      }
    }
    showToast(`瀵煎叆瀹屾垚: ${successCount} 鎴愬姛, ${failCount} 澶辫触`);
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
        console.log(`[${SCRIPT_NAME}] 瀵煎叆绔嬬粯: ${characterId} - ${expression}`);
        const allExpressions = getAllExpressions();
        if (!allExpressions.includes(expression)) {
          const customs = getCustomExpressions();
          if (!customs.find(e => e.name === expression)) {
            customs.push({ name: expression, emotion: null });
            saveCustomExpressions(customs);
            console.log(`[${SCRIPT_NAME}] 鑷姩娉ㄥ唽琛ㄦ儏鏍囩: ${expression}`);
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
      console.log(`[${SCRIPT_NAME}] 瀵煎叆鑳屾櫙: ${sceneName}`);
    }
  },
  async importFromGitHub(repoUrl, targetPackId = null) {
    try {
      if (!targetPackId) {
        targetPackId = await showImportPackSelector(`GitHub瀵煎叆`);
        if (!targetPackId) {
          showToast('宸插彇娑堝鍏?');
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
      showToast(`姝ｅ湪鑾峰彇鏂囦欢鍒楄〃: ${owner}/${repo}...`);
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`GitHub API Error: ${response.statusText}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('璺緞涓嶆槸涓€涓洰褰?');
      const imageFiles = data.filter(item => item.type === 'file' && /\.(png|jpg|jpeg|gif|webp)$/i.test(item.name));
      if (imageFiles.length === 0) {
        showToast('璇ョ洰褰曚笅娌℃湁鎵惧埌鍥剧墖鏂囦欢');
        return;
      }
      if (!confirm(`鎵惧埌 ${imageFiles.length} 寮犲浘鐗囷紝鏄惁寮€濮嬪鍏ワ紵`)) return;
      let count = 0;
      for (const item of imageFiles) {
        showToast(`姝ｅ湪涓嬭浇 (${count + 1}/${imageFiles.length}): ${item.name}`);
        try {
          const imgRes = await fetch(item.download_url);
          const blob = await imgRes.blob();
          const file = new File([blob], item.name, { type: blob.type });
          if (item.name.includes('_')) {
            await this.importAsSprite(file, targetPackId);
          } else {
            await this.importAsBackground(file, targetPackId);
          }
          count++;
        } catch (e) {
          console.error(`涓嬭浇/瀵煎叆 ${item.name} 澶辫触:`, e);
        }
      }
      showToast(`GitHub 导入完成，共 ${count} 张图片`);
      return true;
    } catch (e) {
      console.error('GitHub Import Error:', e);
      showToast('GitHub 瀵煎叆澶辫触: ' + e.message);
      return false;
    }
  },
};

export function showRemoteZipImportDialog() {
  const dialogHtml = `
    <div class="gal-input-modal" id="gal-remote-zip-dialog">
      <div class="gal-input-box" style="max-width: 500px; width: 90%; padding: 25px;">
        <div class="gal-input-title" style="margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
          <span><i class="fa-solid fa-cloud-arrow-down"></i> 杩滅▼鍘嬬缉鍖呭鍏?/span>
          <button id="gal-remote-zip-close-x" title="鍏抽棴" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px; line-height: 1; transition: color 0.2s; transform: none;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div style="margin-bottom: 15px;">
          <label style="display: block; font-weight: 700; margin-bottom: 8px; color: #2b2e38;">
            <i class="fa-solid fa-link"></i> ZIP 鏂囦欢閾炬帴
          </label>
          <input type="text" id="gal-remote-zip-url"
                 placeholder="https://example.com/assets.zip"
                 style="width: 100%; padding: 12px 15px; border: 2px solid #ddd; font-size: 1rem; box-sizing: border-box; border-radius: 6px;">
          <small style="color: #888; margin-top: 5px; display: block;">
            鏀寔鐩存帴涓嬭浇閾炬帴锛屽 GitHub Release銆佷簯鐩樼洿閾剧瓑<br>
            <strong style="color: #e74c3c;">闄愬埗锛氭渶澶?5GB</strong>
          </small>
        </div>
        <div class="gal-input-actions" style="display: flex; gap: 12px;">
          <button class="gal-action-btn primary" id="gal-remote-zip-confirm" style="flex: 1; min-height: 44px; justify-content: center;">
            <i class="fa-solid fa-download"></i>
            <span>涓嬭浇骞跺鍏?/span>
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
      showToast('璇疯緭鍏IP鏂囦欢閾炬帴');
      return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      showToast('璇疯緭鍏ユ湁鏁堢殑 HTTP/HTTPS 閾炬帴');
      return;
    }
    $dialog.remove();
    await importFromRemoteZip(url);
  });
}

export async function importFromZipFile(file) {
  let isCancelled = false;
  const progressController = showImportProgress('姝ｅ湪瑙ｅ帇鏈湴鏂囦欢...', () => {
    isCancelled = true;
    showToast('瀵煎叆宸叉墜鍔ㄥ彇娑?');
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
      showToast('ZIP瀵煎叆瀹屾垚锛?');
    } else {
      progressController.close();
    }
  } catch (e) {
    progressController.close();
    if (isCancelled) return;
    console.error('ZIP瀵煎叆澶辫触:', e);
    showImportError(['ZIP鏂囦欢瑙ｆ瀽澶辫触', e.message || '鏈煡閿欒', '璇风‘淇濇枃浠舵槸鏈夋晥鐨刏IP鏍煎紡']);
  }
}

export async function importFromRemoteZip(url) {
  const abortController = new AbortController();
  let isCancelled = false;

  const progressController = showImportProgress('姝ｅ湪涓嬭浇杩滅▼鏂囦欢...', () => {
    isCancelled = true;
    abortController.abort();
    showToast('涓嬭浇宸插彇娑?');
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
        throw new Error('涓嬭浇鐨勬枃浠跺ぇ灏忚秴杩?5GB 闄愬埗');
      }

      const now = Date.now();
      if (totalLength > 0) {
        const percent = Math.round((receivedLength / totalLength) * 100);
        const downloaded = (receivedLength / 1024 / 1024).toFixed(1);
        const total = (totalLength / 1024 / 1024).toFixed(1);
        if (now - lastProgressUpdate > 200 || percent === 100) {
          progressController.update(percent, `涓嬭浇涓? ${downloaded} MB / ${total} MB`);
          lastProgressUpdate = now;
        }
      } else {
        const downloaded = (receivedLength / 1024 / 1024).toFixed(1);
        if (now - lastProgressUpdate > 200) {
          progressController.update(-1, `涓嬭浇涓? ${downloaded} MB`);
          lastProgressUpdate = now;
        }
      }
    }

    if (isCancelled) {
      progressController.close();
      return;
    }

    const blob = new Blob(chunks);
    progressController.update(100, '涓嬭浇瀹屾垚锛屽紑濮嬭В鍘?..');

    const JSZip = await AssetIO.loadJSZip();
    const zip = await JSZip.loadAsync(blob);

    await processZipContents(zip, progressController, () => isCancelled);

    if (!isCancelled) {
      progressController.close();
      showToast('杩滅▼ZIP瀵煎叆瀹屾垚锛?');
    } else {
      progressController.close();
    }
  } catch (e) {
    progressController.close();
    if (e.name === 'AbortError' || isCancelled) return;
    console.error('杩滅▼ZIP瀵煎叆澶辫触:', e);
    showImportError(['远程ZIP下载/导入失败', e.message || '网络错误', '请检查链接是否有效、是否支持跨域']);
  }
}

export async function showImportPackSelector(suggestedName = null) {
  return new Promise((resolve) => {
    getAllImagePacks().then(packs => {
      const currentPackId = getCurrentPackId();
      const currentPack = packs.find(p => p.id === currentPackId);
      const currentPackName = currentPack ? currentPack.name : '褰撳墠鍥惧寘';

      const packOptions = packs.map(p =>
        `<option value="${p.id}">${p.name}${p.id === currentPackId ? ' (褰撳墠)' : ''}</option>`
      ).join('');

      const defaultNewName = suggestedName || `瀵煎叆鍖卂${new Date().toISOString().slice(0, 10)}`;

      const dialogHtml = `
        <div class="gal-input-modal gal-z-critical" id="gal-import-pack-selector">
          <div class="gal-input-box" style="max-width: 450px; width: 90%; padding: 25px;">
            <div class="gal-input-title" style="margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
              <span><i class="fa-solid fa-box-open"></i> 閫夋嫨瀵煎叆鐩爣鍥惧寘</span>
              <button id="gal-import-pack-close-x" title="鍏抽棴" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px; line-height: 1; transition: color 0.2s; transform: none;">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div style="margin-bottom: 20px;">
              <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; cursor: pointer; padding: 10px; border: 2px solid #3498db; border-radius: 6px; background: #f8f9fa;">
                <input type="radio" name="import-target" value="current" checked style="width: 18px; height: 18px;">
                <span style="font-weight: 600; color: #2b2e38;">瀵煎叆鍒板綋鍓嶅浘鍖?/span>
                <span style="color: #666; font-size: 0.85rem; margin-left: auto;">${currentPackName}</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; cursor: pointer; padding: 10px; border: 2px solid #ddd; border-radius: 6px;">
                <input type="radio" name="import-target" value="existing" style="width: 18px; height: 18px;">
                <span style="font-weight: 600; color: #2b2e38;">瀵煎叆鍒板凡鏈夊浘鍖?/span>
              </label>
              <select id="gal-import-existing-pack" disabled style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 4px; margin-bottom: 15px; margin-left: 26px; opacity: 0.6;">
                ${packOptions}
              </select>
              <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; cursor: pointer; padding: 10px; border: 2px solid #ddd; border-radius: 6px;">
                <input type="radio" name="import-target" value="new" style="width: 18px; height: 18px;">
                <span style="font-weight: 600; color: #2b2e38;">鍒涘缓鏂板浘鍖?/span>
              </label>
              <input type="text" id="gal-import-new-pack-name" disabled placeholder="杈撳叆鏂板浘鍖呭悕绉? value="${defaultNewName}"
                     style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 4px; margin-left: 26px; opacity: 0.6; box-sizing: border-box;">
            </div>
            <div class="gal-input-actions" style="display: flex; gap: 12px;">
              <button class="gal-action-btn" id="gal-import-pack-confirm" style="flex: 1; min-height: 44px; justify-content: center; background: #28a745; color: #fff; border-color: #28a745;">
                <i class="fa-solid fa-check"></i> <span>纭瀵煎叆</span>
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
            showToast('璇疯緭鍏ユ柊鍥惧寘鍚嶇О');
            return;
          }
          createImagePack(newName).then(newPack => {
            $dialog.remove();
            resolve(newPack.id);
          }).catch(err => {
            showToast('鍒涘缓鍥惧寘澶辫触: ' + err.message);
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
      console.error('鑾峰彇鍥惧寘鍒楄〃澶辫触:', err);
      showToast('鑾峰彇鍥惧寘鍒楄〃澶辫触');
      resolve(null);
    });
  });
}

export async function processZipContents(zip, progressController, isCancelledCheck, targetPackId = null) {
  const hasSpritesDir = Object.keys(zip.files).some(path => path.startsWith('sprites/'));
  const hasBackgroundsDir = Object.keys(zip.files).some(path => path.startsWith('backgrounds/'));

  if (!hasSpritesDir && !hasBackgroundsDir) {
    throw new Error('ZIP鍖呮牸寮忛敊璇細蹇呴』鍖呭惈 sprites/ 鎴?backgrounds/ 鐩綍');
  }

  let packageInfo = null;
  const infoFile = zip.file('package_info.json');
  if (infoFile) {
    try {
      const infoText = await infoFile.async('text');
      packageInfo = JSON.parse(infoText);
      console.log(`[${SCRIPT_NAME}] 璇诲彇鍒板寘淇℃伅:`, packageInfo);
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 璇诲彇 package_info.json 澶辫触:`, e);
    }
  }

  if (!targetPackId) {
    const suggestedName = packageInfo?.packageName || packageInfo?.name;
    targetPackId = await showImportPackSelector(suggestedName);
    if (!targetPackId) {
      showToast('宸插彇娑堝鍏?');
      return;
    }
  }

  const imageFiles = [];
  zip.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir) return;
    const isSprite = relativePath.startsWith('sprites/');
    const isBackground = relativePath.startsWith('backgrounds/');
    if (!isSprite && !isBackground) return;
    const ext = relativePath.split('.').pop().toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) return;
    imageFiles.push({
      path: relativePath,
      entry: zipEntry,
      type: isSprite ? 'sprite' : 'background',
    });
  });

  if (imageFiles.length === 0) {
    throw new Error('ZIP鍖呬腑鏈壘鍒版湁鏁堢殑鍥剧墖鏂囦欢');
  }

  progressController.update(0, `鍑嗗瀵煎叆 ${imageFiles.length} 涓枃浠?..`);

  const BATCH_SIZE = 50;
  let successCount = 0;
  let failedItems = [];

  for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
    if (isCancelledCheck && isCancelledCheck()) {
      console.log(`[${SCRIPT_NAME}] 导入已取消`);
      return;
    }

    const batch = imageFiles.slice(i, i + BATCH_SIZE);
    const spriteBatch = [];
    const backgroundBatch = [];

    await Promise.all(
      batch.map(async (item) => {
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
          } else if (item.type === 'background') {
            const sceneName = fileName.substring(0, fileName.lastIndexOf('.'));
            backgroundBatch.push({ sceneName, imageBlob: blob });
          }
        } catch (e) {
          console.warn(`瑙ｅ帇 ${item.path} 澶辫触:`, e);
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
        console.log(`[${SCRIPT_NAME}] 鑷姩娉ㄥ唽琛ㄦ儏鏍囩: ${newExpressions.join(', ')}`);
      }
    }
    if (backgroundBatch.length > 0) {
      await saveBackgroundsBatch(backgroundBatch, targetPackId);
    }

    successCount += spriteBatch.length + backgroundBatch.length;

    const processed = Math.min(i + BATCH_SIZE, imageFiles.length);
    const percent = Math.round((processed / imageFiles.length) * 100);
    progressController.update(percent, `瀵煎叆涓? ${processed}/${imageFiles.length} (鎵归噺妯″紡)`);
  }

  if (failedItems.length > 0) {
    showImportError([
      `成功: ${successCount} 个, 失败: ${failedItems.length} 个`,
      '閮ㄥ垎鏂囦欢瀵煎叆澶辫触锛岃妫€鏌ヨ鎯?..',
    ]);
  }

  console.log(`[${SCRIPT_NAME}] ZIP瀵煎叆瀹屾垚: 鎴愬姛 ${successCount}, 澶辫触 ${failedItems.length}`);
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
          <span><i class="fa-solid fa-circle-exclamation"></i> 瀵煎叆鍑洪敊</span>
          <button id="gal-import-error-close-x" title="鍏抽棴" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px; line-height: 1; transition: color 0.2s; transform: none;">
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


