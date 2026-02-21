import { SCRIPT_NAME, DEFAULT_PACK_ID } from '../core/constants.js';
import { $, topWindow } from '../core/env.js';
import { getSettings } from '../core/settings.js';
import { getCurrentPackId } from '../db/image-packs.js';
import { getUiSkinAssetsByPackSkin } from '../db/ui-skins.js';

export const WESTERN_SKIN_ID = 'skin-western';
export const WESTERN_SKIN_STATES = ['normal', 'hover', 'active'];

export const WESTERN_SKIN_ELEMENTS = [
  {
    id: 'main_frame_scene',
    label: '主画框装饰',
    selector: '.gal-game-container',
    aspectRatio: 16 / 9,
    outputWidth: 1440,
    supportsStates: ['normal'],
  },
  {
    id: 'dialog_panel',
    label: '对话框',
    selector: '.gal-text-panel',
    aspectRatio: 2.5,
    outputWidth: 1280,
    supportsStates: ['normal'],
  },
  {
    id: 'name_badge',
    label: '名牌',
    selector: '.gal-name-badge',
    aspectRatio: 3.2,
    outputWidth: 480,
    supportsStates: ['normal'],
  },
  {
    id: 'btn_reroll',
    label: '重绘按钮',
    selector: '.gal-action-btn.btn-reroll',
    aspectRatio: 2.6,
    outputWidth: 420,
    supportsStates: WESTERN_SKIN_STATES,
  },
  {
    id: 'btn_free_input',
    label: '自由对话按钮',
    selector: '.gal-action-btn.btn-free',
    aspectRatio: 2.6,
    outputWidth: 420,
    supportsStates: WESTERN_SKIN_STATES,
  },
  {
    id: 'footer_btn_common',
    label: '底栏普通按钮',
    selector: '.gal-footer-btn',
    aspectRatio: 1.8,
    outputWidth: 360,
    supportsStates: WESTERN_SKIN_STATES,
  },
  {
    id: 'footer_btn_choices',
    label: '底栏选项按钮',
    selector: '.gal-pending-choices-btn',
    aspectRatio: 1.8,
    outputWidth: 360,
    supportsStates: WESTERN_SKIN_STATES,
  },
  {
    id: 'footer_btn_next',
    label: 'NEXT 按钮',
    selector: '.gal-footer-btn-next',
    aspectRatio: 2.6,
    outputWidth: 520,
    supportsStates: WESTERN_SKIN_STATES,
  },
  {
    id: 'status_bar_container',
    label: '顶部状态栏',
    selector: '.gal-location-bar, .gal-time-bar',
    aspectRatio: 3.8,
    outputWidth: 500,
    supportsStates: ['normal'],
  },
  {
    id: 'fullscreen_btn',
    label: '全屏按钮',
    selector: '.gal-fullscreen-btn',
    aspectRatio: 2.2,
    outputWidth: 320,
    supportsStates: WESTERN_SKIN_STATES,
  },
  {
    id: 'bgm_widget',
    label: 'BGM 小组件',
    selector: '.gal-bgm-widget',
    aspectRatio: 3.8,
    outputWidth: 640,
    supportsStates: ['normal'],
  },
];

const DEFAULT_SCENE_CLIP_DESKTOP = 'inset(14% 18% 54% 18%)';
const DEFAULT_SCENE_CLIP_MOBILE = 'inset(17% 15% 55% 15%)';
const DEFAULT_CONTROL_TOP_DESKTOP = 'clamp(5.5rem, 10vh, 7.5rem)';
const DEFAULT_CONTROL_TOP_MOBILE = 'clamp(4.7rem, 10vh, 6rem)';

let runtimeBlobUrls = [];
let forcedRuntimeDevice = null;

function normalizeString(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeNumber(value, fallback = null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function toPx(value, fallback = null) {
  const num = normalizeNumber(value, null);
  if (num === null) return fallback;
  return `${num}px`;
}

function getRuntimeDevice() {
  if (forcedRuntimeDevice === 'desktop' || forcedRuntimeDevice === 'mobile') {
    return forcedRuntimeDevice;
  }
  try {
    const isMobile = topWindow.matchMedia && topWindow.matchMedia('(max-width: 48rem)').matches;
    return isMobile ? 'mobile' : 'desktop';
  } catch {
    return 'desktop';
  }
}

export function setWesternSkinRuntimePreviewDevice(device = null) {
  const next = normalizeString(device, '');
  if (next === 'desktop' || next === 'mobile') {
    forcedRuntimeDevice = next;
    return forcedRuntimeDevice;
  }
  forcedRuntimeDevice = null;
  return null;
}

function cssVarKey(elementId, state, suffix = 'image') {
  return `--western-${elementId}-${state}-${suffix}`;
}

function cssLayoutVarKey(elementId, key) {
  return `--western-${elementId}-${key}`;
}

function resolveBackgroundSize(scaleMode) {
  const mode = normalizeString(scaleMode, 'stretch');
  if (mode === 'contain') return 'contain';
  if (mode === 'cover') return 'cover';
  return '100% 100%';
}

function clearWesternCssVars(overlayEl) {
  if (!overlayEl) return;
  for (let i = overlayEl.style.length - 1; i >= 0; i--) {
    const propName = overlayEl.style[i];
    if (propName && propName.startsWith('--western-')) {
      overlayEl.style.removeProperty(propName);
    }
  }
}

function revokeRuntimeBlobUrls() {
  if (!runtimeBlobUrls.length) return;
  runtimeBlobUrls.forEach(url => {
    try {
      (topWindow.URL || URL).revokeObjectURL(url);
    } catch {
      // ignore revoke errors
    }
  });
  runtimeBlobUrls = [];
}

function resolveAssetUrl(asset) {
  if (!asset) return '';
  if (asset.imageUrl) return String(asset.imageUrl);
  if (asset.imageBlob) {
    const blobUrl = (topWindow.URL || URL).createObjectURL(asset.imageBlob);
    runtimeBlobUrls.push(blobUrl);
    return blobUrl;
  }
  return '';
}

function setCssVar(overlayEl, key, value) {
  if (!overlayEl || !key) return;
  if (value === null || value === undefined || value === '') {
    overlayEl.style.removeProperty(key);
    return;
  }
  overlayEl.style.setProperty(key, String(value));
}

function scoreAssetForDevice(asset, targetDevice) {
  const device = normalizeString(asset?.device, 'desktop');
  if (device === targetDevice) return 100;
  if (device === 'desktop' || device === 'mobile') return 10;
  return 1;
}

function pickBestAssetMap(assets, targetDevice) {
  const bestMap = new Map();
  (assets || []).forEach(asset => {
    const elementId = normalizeString(asset.elementId);
    if (!elementId) return;
    const state = normalizeString(asset.state, 'normal');
    const key = `${elementId}::${state}`;
    const nextScore = scoreAssetForDevice(asset, targetDevice);
    const current = bestMap.get(key);
    if (!current || nextScore > current.score) {
      bestMap.set(key, { asset, score: nextScore });
    }
  });
  return bestMap;
}

export function getWesternSkinElementById(elementId) {
  return WESTERN_SKIN_ELEMENTS.find(item => item.id === elementId) || null;
}

export function buildDefaultWesternAssetPayload({
  packId,
  elementId,
  device = 'desktop',
  state = 'normal',
} = {}) {
  const definition = getWesternSkinElementById(elementId);
  const resolvedPackId = normalizeString(packId, getCurrentPackId() || DEFAULT_PACK_ID);
  const resolvedElementId = normalizeString(elementId, definition?.id || WESTERN_SKIN_ELEMENTS[0].id);
  const resolvedDevice = normalizeString(device, 'desktop');
  const resolvedState = normalizeString(state, 'normal');
  const defaultWidth = definition?.outputWidth || 480;
  const defaultHeight = definition?.aspectRatio ? Math.round(defaultWidth / definition.aspectRatio) : null;

  return {
    packId: resolvedPackId,
    skinId: WESTERN_SKIN_ID,
    elementId: resolvedElementId,
    device: resolvedDevice,
    state: resolvedState,
    layout: {
      width: defaultWidth,
      height: defaultHeight,
      offsetX: 0,
      offsetY: 0,
      anchorX: 0,
      anchorY: 0,
      clipPath: '',
    },
    scaleMode: 'stretch',
    slice: { top: 0, right: 0, bottom: 0, left: 0 },
    textPadding: { top: 0, right: 0, bottom: 0, left: 0 },
    meta: {},
  };
}

export function clearWesternSkinRuntime() {
  const overlayEl = $('#gal-global-overlay').get(0);
  if (!overlayEl) return;
  clearWesternCssVars(overlayEl);
  overlayEl.classList.remove('skin-western-image-mode');
  revokeRuntimeBlobUrls();
}

export async function applyWesternSkinRuntime() {
  const settings = getSettings();
  const $overlay = $('#gal-global-overlay');
  const overlayEl = $overlay.get(0);
  if (!overlayEl) return;

  const shouldApply =
    settings &&
    settings.skin === WESTERN_SKIN_ID &&
    $overlay.hasClass(WESTERN_SKIN_ID);

  if (!shouldApply) {
    clearWesternSkinRuntime();
    return;
  }

  const device = getRuntimeDevice();
  const currentPackId = getCurrentPackId() || DEFAULT_PACK_ID;
  let assets = [];
  try {
    assets = await getUiSkinAssetsByPackSkin(currentPackId, WESTERN_SKIN_ID);
  } catch (error) {
    console.warn(`[${SCRIPT_NAME}] 读取 western 皮肤资源失败:`, error);
    assets = [];
  }

  revokeRuntimeBlobUrls();
  clearWesternCssVars(overlayEl);
  overlayEl.classList.add('skin-western-image-mode');

  setCssVar(
    overlayEl,
    '--western-scene-clip',
    device === 'mobile' ? DEFAULT_SCENE_CLIP_MOBILE : DEFAULT_SCENE_CLIP_DESKTOP,
  );
  setCssVar(
    overlayEl,
    '--western-control-top',
    device === 'mobile' ? DEFAULT_CONTROL_TOP_MOBILE : DEFAULT_CONTROL_TOP_DESKTOP,
  );

  const bestMap = pickBestAssetMap(assets, device);
  const getAsset = (elementId, state) => bestMap.get(`${elementId}::${state}`)?.asset || null;

  WESTERN_SKIN_ELEMENTS.forEach(def => {
    const supportedStates = Array.isArray(def.supportsStates) && def.supportsStates.length
      ? def.supportsStates
      : ['normal'];
    const normalAsset = getAsset(def.id, 'normal');
    const layout = normalAsset?.layout || {};
    const slice = normalAsset?.slice || {};
    const textPadding = normalAsset?.textPadding || {};
    const scaleMode = normalizeString(normalAsset?.scaleMode, 'stretch');

    setCssVar(overlayEl, cssLayoutVarKey(def.id, 'width'), toPx(layout.width, null));
    setCssVar(overlayEl, cssLayoutVarKey(def.id, 'height'), toPx(layout.height, null));
    setCssVar(overlayEl, cssLayoutVarKey(def.id, 'offset-x'), toPx(layout.offsetX, '0px'));
    setCssVar(overlayEl, cssLayoutVarKey(def.id, 'offset-y'), toPx(layout.offsetY, '0px'));
    setCssVar(overlayEl, cssLayoutVarKey(def.id, 'anchor-x'), toPx(layout.anchorX, '0px'));
    setCssVar(overlayEl, cssLayoutVarKey(def.id, 'anchor-y'), toPx(layout.anchorY, '0px'));
    setCssVar(overlayEl, cssLayoutVarKey(def.id, 'scale-mode'), scaleMode);
    setCssVar(overlayEl, cssLayoutVarKey(def.id, 'bg-size'), resolveBackgroundSize(scaleMode));
    setCssVar(overlayEl, cssLayoutVarKey(def.id, 'slice-top'), toPx(slice.top, null));
    setCssVar(overlayEl, cssLayoutVarKey(def.id, 'slice-right'), toPx(slice.right, null));
    setCssVar(overlayEl, cssLayoutVarKey(def.id, 'slice-bottom'), toPx(slice.bottom, null));
    setCssVar(overlayEl, cssLayoutVarKey(def.id, 'slice-left'), toPx(slice.left, null));

    if (def.id === 'dialog_panel') {
      setCssVar(overlayEl, '--western-dialog-panel-padding-top', toPx(textPadding.top, null));
      setCssVar(overlayEl, '--western-dialog-panel-padding-right', toPx(textPadding.right, null));
      setCssVar(overlayEl, '--western-dialog-panel-padding-bottom', toPx(textPadding.bottom, null));
      setCssVar(overlayEl, '--western-dialog-panel-padding-left', toPx(textPadding.left, null));
    }

    if (def.id === 'main_frame_scene') {
      const clipPathText = normalizeString(layout.clipPath, '');
      if (clipPathText) {
        setCssVar(overlayEl, '--western-scene-clip', clipPathText);
      }
    }

    WESTERN_SKIN_STATES.forEach(state => {
      if (!supportedStates.includes(state)) {
        setCssVar(overlayEl, cssVarKey(def.id, state), null);
        return;
      }
      const asset = getAsset(def.id, state);
      const url = resolveAssetUrl(asset);
      if (!url) {
        setCssVar(overlayEl, cssVarKey(def.id, state), null);
        return;
      }
      const safeUrl = String(url).replace(/"/g, '%22');
      setCssVar(overlayEl, cssVarKey(def.id, state), `url("${safeUrl}")`);
    });
  });
}
