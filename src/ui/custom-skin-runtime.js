import { CUSTOM_SKIN_ID, GLOBAL_CUSTOM_SKIN_PACK_ID, SCRIPT_NAME } from '../core/constants.js';
import { topWindow } from '../core/env.js';
import { getSettings } from '../core/settings.js';
import { hasUiSkinProfileId } from '../db/ui-skin-profiles.js';
import { getUiSkinAssetsByPackSkin } from '../db/ui-skins.js';

const MOBILE_BREAKPOINT = 768;
const INTERACTIVE_MIN_SIZE = 36;
const FULL_RECT_POINTS = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];
const FOOTER_BUTTON_DEFAULTS = {
  desktop: {
    widthRatio: 0.11,
    offsetXRatio: 0,
    offsetYRatio: 0,
    anchorXRatio: 0,
    anchorYRatio: 0,
    hitArea: { type: 'polygon', points: FULL_RECT_POINTS },
  },
  mobile: {
    widthRatio: 0.18,
    offsetXRatio: 0,
    offsetYRatio: 0,
    anchorXRatio: 0,
    anchorYRatio: 0,
    hitArea: { type: 'polygon', points: FULL_RECT_POINTS },
  },
};

export const CUSTOM_SKIN_FOOTER_COMMON_ELEMENT_ID = 'footer_btn_common';
export const CUSTOM_SKIN_FOOTER_BUTTON_TARGET_IDS = [
  'footer_btn_log',
  'footer_btn_close',
  'footer_btn_view',
  'footer_btn_config',
  'footer_btn_save',
  'footer_btn_load',
  'footer_btn_timeline',
  'footer_btn_prev',
  'footer_btn_auto',
  'footer_btn_skip',
];
export const CUSTOM_SKIN_FOOTER_BATCH_TARGET_IDS = [
  ...CUSTOM_SKIN_FOOTER_BUTTON_TARGET_IDS,
  'footer_btn_choices',
  'footer_btn_next',
];

function createFooterButtonElement(id, label) {
  return {
    id,
    label,
    supportsTextToggle: true,
    aspectRatio: 3.3,
    outputWidth: 720,
    supportsStates: ['normal', 'hover', 'active'],
    interactive: true,
    defaultScaleMode: 'stretch',
    defaults: {
      desktop: { ...FOOTER_BUTTON_DEFAULTS.desktop },
      mobile: { ...FOOTER_BUTTON_DEFAULTS.mobile },
    },
  };
}

export const CUSTOM_SKIN_STATES = ['normal', 'hover', 'active'];

export const CUSTOM_SKIN_ELEMENTS = [
  {
    id: 'dialog_panel',
    label: '对话框',
    transparentContentTarget: 'textPadding',
    aspectRatio: 4.25,
    outputWidth: 1440,
    supportsStates: ['normal'],
    interactive: false,
    defaultScaleMode: 'stretch',
    defaults: {
      desktop: {
        widthRatio: 0.76,
        offsetXRatio: 0,
        offsetYRatio: 0,
        anchorXRatio: 0,
        anchorYRatio: 0,
        textPaddingRatio: { top: 0.18, right: 0.055, bottom: 0.14, left: 0.055 },
      },
      mobile: {
        widthRatio: 0.9,
        offsetXRatio: 0,
        offsetYRatio: 0,
        anchorXRatio: 0,
        anchorYRatio: 0,
        textPaddingRatio: { top: 0.18, right: 0.06, bottom: 0.15, left: 0.06 },
      },
    },
  },
  {
    id: 'name_badge',
    label: '姓名牌',
    supportsTextToggle: true,
    aspectRatio: 4.8,
    outputWidth: 720,
    supportsStates: ['normal'],
    interactive: false,
    defaultScaleMode: 'stretch',
    defaults: {
      desktop: { widthRatio: 0.19, offsetXRatio: 0, offsetYRatio: 0, anchorXRatio: 0, anchorYRatio: 0 },
      mobile: { widthRatio: 0.3, offsetXRatio: 0, offsetYRatio: 0, anchorXRatio: 0, anchorYRatio: 0 },
    },
  },
  {
    id: 'btn_reroll',
    label: '重掷按钮',
    supportsTextToggle: true,
    aspectRatio: 2.6,
    outputWidth: 640,
    supportsStates: ['normal', 'hover', 'active'],
    interactive: true,
    defaultScaleMode: 'stretch',
    defaults: {
      desktop: { widthRatio: 0.08, offsetXRatio: 0, offsetYRatio: 0, anchorXRatio: 0, anchorYRatio: 0, hitArea: { type: 'polygon', points: FULL_RECT_POINTS } },
      mobile: { widthRatio: 0.15, offsetXRatio: 0, offsetYRatio: 0, anchorXRatio: 0, anchorYRatio: 0, hitArea: { type: 'polygon', points: FULL_RECT_POINTS } },
    },
  },
  {
    id: 'btn_free_input',
    label: '自由输入按钮',
    supportsTextToggle: true,
    aspectRatio: 3.5,
    outputWidth: 720,
    supportsStates: ['normal', 'hover', 'active'],
    interactive: true,
    defaultScaleMode: 'stretch',
    defaults: {
      desktop: { widthRatio: 0.11, offsetXRatio: 0, offsetYRatio: 0, anchorXRatio: 0, anchorYRatio: 0, hitArea: { type: 'polygon', points: FULL_RECT_POINTS } },
      mobile: { widthRatio: 0.18, offsetXRatio: 0, offsetYRatio: 0, anchorXRatio: 0, anchorYRatio: 0, hitArea: { type: 'polygon', points: FULL_RECT_POINTS } },
    },
  },
  {
    id: 'footer_btn_common',
    label: '底栏通用按钮 / 批量导入',
    supportsTextToggle: true,
    aspectRatio: 3.3,
    outputWidth: 720,
    supportsStates: ['normal', 'hover', 'active'],
    interactive: true,
    defaultScaleMode: 'stretch',
    defaults: {
      desktop: { ...FOOTER_BUTTON_DEFAULTS.desktop },
      mobile: { ...FOOTER_BUTTON_DEFAULTS.mobile },
    },
  },
  createFooterButtonElement('footer_btn_log', '底栏按钮 LOG'),
  createFooterButtonElement('footer_btn_close', '底栏按钮 CLOSE'),
  createFooterButtonElement('footer_btn_view', '底栏按钮 VIEW'),
  createFooterButtonElement('footer_btn_config', '底栏按钮 CONFIG'),
  createFooterButtonElement('footer_btn_save', '底栏按钮 SAVE'),
  createFooterButtonElement('footer_btn_load', '底栏按钮 LOAD'),
  createFooterButtonElement('footer_btn_timeline', '底栏按钮 TL'),
  createFooterButtonElement('footer_btn_prev', '底栏按钮 PREV'),
  createFooterButtonElement('footer_btn_auto', '底栏按钮 AUTO'),
  createFooterButtonElement('footer_btn_skip', '底栏按钮 SKIP'),
  {
    id: 'footer_btn_choices',
    label: '选项按钮',
    supportsTextToggle: true,
    aspectRatio: 3.2,
    outputWidth: 720,
    supportsStates: ['normal', 'hover', 'active'],
    interactive: true,
    defaultScaleMode: 'stretch',
    defaults: {
      desktop: { widthRatio: 0.13, offsetXRatio: 0, offsetYRatio: 0, anchorXRatio: 0, anchorYRatio: 0, hitArea: { type: 'polygon', points: FULL_RECT_POINTS } },
      mobile: { widthRatio: 0.23, offsetXRatio: 0, offsetYRatio: 0, anchorXRatio: 0, anchorYRatio: 0, hitArea: { type: 'polygon', points: FULL_RECT_POINTS } },
    },
  },
  {
    id: 'footer_btn_next',
    label: '下一句按钮',
    supportsTextToggle: true,
    aspectRatio: 3.2,
    outputWidth: 720,
    supportsStates: ['normal', 'hover', 'active'],
    interactive: true,
    defaultScaleMode: 'stretch',
    defaults: {
      desktop: { widthRatio: 0.11, offsetXRatio: 0, offsetYRatio: 0, anchorXRatio: 0, anchorYRatio: 0, hitArea: { type: 'polygon', points: FULL_RECT_POINTS } },
      mobile: { widthRatio: 0.19, offsetXRatio: 0, offsetYRatio: 0, anchorXRatio: 0, anchorYRatio: 0, hitArea: { type: 'polygon', points: FULL_RECT_POINTS } },
    },
  },
  {
    id: 'fullscreen_btn',
    label: '全屏按钮',
    supportsTextToggle: true,
    aspectRatio: 1,
    outputWidth: 320,
    supportsStates: ['normal', 'hover', 'active'],
    interactive: true,
    defaultScaleMode: 'stretch',
    defaults: {
      desktop: { widthRatio: 0.045, offsetXRatio: 0, offsetYRatio: 0, anchorXRatio: 0, anchorYRatio: 0, hitArea: { type: 'polygon', points: FULL_RECT_POINTS } },
      mobile: { widthRatio: 0.085, offsetXRatio: 0, offsetYRatio: 0, anchorXRatio: 0, anchorYRatio: 0, hitArea: { type: 'polygon', points: FULL_RECT_POINTS } },
    },
  },
  {
    id: 'bgm_widget',
    label: 'BGM 组件',
    supportsTextToggle: true,
    aspectRatio: 3.4,
    outputWidth: 720,
    supportsStates: ['normal'],
    interactive: false,
    defaultScaleMode: 'stretch',
    defaults: {
      desktop: { widthRatio: 0.18, offsetXRatio: 0, offsetYRatio: 0, anchorXRatio: 0, anchorYRatio: 0 },
      mobile: { widthRatio: 0.28, offsetXRatio: 0, offsetYRatio: 0, anchorXRatio: 0, anchorYRatio: 0 },
    },
  },
];

const RUNTIME_ELEMENT_MAP = new Map(CUSTOM_SKIN_ELEMENTS.map(item => [item.id, item]));
const RUNTIME_STYLE_SUFFIXES = [
  'width',
  'height',
  'offset-x',
  'offset-y',
  'anchor-x',
  'anchor-y',
  'bg-size',
];
const ACTIVE_RUNTIME_CLASS = 'custom-skin-element-active';
const TEXT_HIDDEN_RUNTIME_CLASS = 'custom-skin-hide-text';
const STATE_IMAGE_CLASS_MAP = {
  normal: 'custom-skin-has-normal-image',
  hover: 'custom-skin-has-hover-image',
  active: 'custom-skin-has-active-image',
};
const TOOLBAR_RELATED_ELEMENT_IDS = new Set([
  'btn_reroll',
  'btn_free_input',
  ...CUSTOM_SKIN_FOOTER_BUTTON_TARGET_IDS,
  'footer_btn_choices',
  'footer_btn_next',
]);
const RUNTIME_ELEMENT_SELECTOR_MAP = {
  dialog_panel: ['.gal-text-panel'],
  name_badge: ['.gal-name-badge'],
  btn_reroll: ['.gal-action-btn.btn-reroll'],
  btn_free_input: ['.gal-action-btn.btn-free'],
  footer_btn_log: ['.gal-footer-btn[data-action="log"]'],
  footer_btn_close: ['.gal-footer-btn[data-action="close-mode"]'],
  footer_btn_view: ['.gal-footer-btn[data-action="view-original"]'],
  footer_btn_config: ['.gal-footer-btn[data-action="config"]'],
  footer_btn_save: ['.gal-footer-btn[data-action="save"]'],
  footer_btn_load: ['.gal-footer-btn[data-action="load"]'],
  footer_btn_timeline: ['.gal-footer-btn[data-action="timeline"]'],
  footer_btn_prev: ['.gal-footer-btn[data-action="prev"]'],
  footer_btn_auto: ['.gal-footer-btn[data-action="auto"]'],
  footer_btn_skip: ['.gal-footer-btn[data-action="skip"]'],
  footer_btn_choices: ['.gal-pending-choices-btn'],
  footer_btn_next: ['.gal-footer-btn-next'],
  fullscreen_btn: ['.gal-fullscreen-btn'],
  bgm_widget: ['.gal-bgm-widget'],
  __toolbar_controls__: ['.gal-bottom-toolbar'],
};
const COMPONENT_DETECTION_SELECTOR_MAP = {
  ...RUNTIME_ELEMENT_SELECTOR_MAP,
};
const FOOTER_NODE_STYLE_PREFIX = '--custom-skin-footer_btn_common-';
const FOOTER_FALLBACK_ELEMENT_ID_SET = new Set(CUSTOM_SKIN_FOOTER_BUTTON_TARGET_IDS);
const LIVE_RUNTIME_LAYOUT_ELEMENT_IDS = new Set([
  'dialog_panel',
]);

let runtimePreviewDevice = null;
let runtimeBlobUrls = [];
let runtimeResizeObserver = null;
let runtimeObservedHost = null;
let runtimeResizeWindow = null;
let runtimeResizeRaf = 0;
let runtimeApplyToken = 0;

function getWindowObject() {
  return topWindow || window;
}

function getOverlayElement() {
  return getWindowObject().document?.querySelector?.('#gal-global-overlay') || null;
}

function getHostElement(overlay = getOverlayElement()) {
  if (!overlay) return null;
  return overlay.querySelector('.gal-game-container') || overlay;
}

function getRuntimeNodesForElement(overlay, elementId, { forDetection = false } = {}) {
  if (!overlay) return [];
  const selectorMap = forDetection ? COMPONENT_DETECTION_SELECTOR_MAP : RUNTIME_ELEMENT_SELECTOR_MAP;
  const selectors = selectorMap[elementId];
  if (!Array.isArray(selectors) || selectors.length === 0) return [];
  const nodes = [];
  const seen = new Set();
  selectors.forEach(selector => {
    overlay.querySelectorAll(selector).forEach(node => {
      if (seen.has(node)) return;
      seen.add(node);
      nodes.push(node);
    });
  });
  return nodes;
}

export function customSkinElementUsesRuntimeLayout(elementId) {
  return LIVE_RUNTIME_LAYOUT_ELEMENT_IDS.has(String(elementId || '').trim());
}

function getRuntimeTextNodes(node) {
  if (!node?.querySelectorAll) return [];
  if (node.matches?.('.gal-name-badge')) {
    return Array.from(node.querySelectorAll('span'));
  }
  if (node.matches?.('.gal-action-btn, .gal-fullscreen-btn')) {
    return [
      ...node.querySelectorAll(':scope > span'),
      ...node.querySelectorAll(':scope > i'),
    ];
  }
  if (node.matches?.('.gal-footer-btn, .gal-footer-btn-next, .gal-pending-choices-btn')) {
    return [
      ...node.querySelectorAll('.gal-btn-text'),
      ...node.querySelectorAll('i'),
    ];
  }
  if (node.matches?.('.gal-bgm-widget')) {
    return Array.from(node.querySelectorAll('.gal-bgm-title'));
  }
  return [
    ...node.querySelectorAll(':scope > i'),
    ...node.querySelectorAll('.gal-btn-text'),
    ...node.querySelectorAll('.gal-bgm-title'),
  ];
}

export function previewCustomSkinTextVisibility(elementIds, showText = true) {
  const overlay = getOverlayElement();
  if (!overlay) return;
  const ids = Array.isArray(elementIds) ? elementIds : [elementIds];
  const shouldShowText = showText !== false;
  const seenNodes = new Set();
  ids.forEach(elementId => {
    getRuntimeNodesForElement(overlay, elementId).forEach(node => {
      if (!node || seenNodes.has(node)) return;
      seenNodes.add(node);
      node.classList.toggle(TEXT_HIDDEN_RUNTIME_CLASS, !shouldShowText);
      getRuntimeTextNodes(node).forEach(textNode => {
        if (!textNode?.style) return;
        if (shouldShowText) {
          textNode.style.removeProperty('display');
        } else {
          textNode.style.setProperty('display', 'none', 'important');
        }
      });
    });
  });
}

function normalizeRuntimeRect(rect, hostRect) {
  if (!rect || !hostRect || hostRect.width <= 0 || hostRect.height <= 0) return null;
  const left = Math.max(hostRect.left, rect.left);
  const top = Math.max(hostRect.top, rect.top);
  const right = Math.min(hostRect.right, rect.right);
  const bottom = Math.min(hostRect.bottom, rect.bottom);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  if (width <= 0 || height <= 0) return null;
  const x = clamp01((left - hostRect.left) / hostRect.width, 0);
  const y = clamp01((top - hostRect.top) / hostRect.height, 0);
  const normalizedWidth = Math.max(0, Math.min(1 - x, width / hostRect.width));
  const normalizedHeight = Math.max(0, Math.min(1 - y, height / hostRect.height));
  if (normalizedWidth <= 0 || normalizedHeight <= 0) return null;
  return {
    x,
    y,
    width: normalizedWidth,
    height: normalizedHeight,
    centerX: x + (normalizedWidth / 2),
    centerY: y + (normalizedHeight / 2),
    areaRatio: normalizedWidth * normalizedHeight,
    aspectRatio: normalizedWidth / Math.max(normalizedHeight, 0.0001),
  };
}

function getRuntimeElementLayoutSnapshot(
  elementId,
  overlay = getOverlayElement(),
  host = getHostElement(overlay),
  hostRect = host?.getBoundingClientRect?.() || null,
) {
  const safeElementId = String(elementId || '').trim();
  if (!safeElementId || !overlay || !hostRect || hostRect.width <= 0 || hostRect.height <= 0) return null;
  const mergedRect = mergeRuntimeNodeRects(getRuntimeNodesForElement(overlay, safeElementId));
  const box = normalizeRuntimeRect(mergedRect, hostRect);
  if (!mergedRect || !box) return null;
  return {
    elementId: safeElementId,
    rect: mergedRect,
    box,
    hostRect,
  };
}

function mergeRuntimeNodeRects(nodes = []) {
  const rects = nodes
    .map(node => node?.getBoundingClientRect?.())
    .filter(rect => rect && rect.width > 0 && rect.height > 0);
  if (!rects.length) return null;
  const merged = rects.reduce((acc, rect) => ({
    left: Math.min(acc.left, rect.left),
    top: Math.min(acc.top, rect.top),
    right: Math.max(acc.right, rect.right),
    bottom: Math.max(acc.bottom, rect.bottom),
  }), {
    left: rects[0].left,
    top: rects[0].top,
    right: rects[0].right,
    bottom: rects[0].bottom,
  });
  return {
    left: merged.left,
    top: merged.top,
    right: merged.right,
    bottom: merged.bottom,
    width: Math.max(0, merged.right - merged.left),
    height: Math.max(0, merged.bottom - merged.top),
  };
}

function setStyleEntriesOnTarget(target, entries) {
  if (!target || !target.style || !(entries instanceof Map)) return;
  entries.forEach((value, key) => {
    target.style.setProperty(key, value);
  });
}

function clearFooterButtonRuntimeNodeStyles(overlay) {
  if (!overlay) return;
  overlay.querySelectorAll('.gal-footer-btn').forEach(node => {
    RUNTIME_STYLE_SUFFIXES.forEach(suffix => {
      node.style.removeProperty(`${FOOTER_NODE_STYLE_PREFIX}${suffix}`);
    });
    CUSTOM_SKIN_STATES.forEach(state => {
      node.style.removeProperty(`${FOOTER_NODE_STYLE_PREFIX}${state}-image`);
      node.style.removeProperty(`${FOOTER_NODE_STYLE_PREFIX}${state}-hit-clip`);
    });
  });
}

function updateRuntimeElementActivationClasses(
  overlay,
  activeElementIds = new Set(),
  imageStateLookup = new Map(),
  textVisibilityLookup = new Map(),
) {
  if (!overlay) return;
  Object.entries(RUNTIME_ELEMENT_SELECTOR_MAP).forEach(([elementId, selectors]) => {
    const isToolbarGroup = elementId === '__toolbar_controls__';
    const shouldActivate = isToolbarGroup
      ? Array.from(TOOLBAR_RELATED_ELEMENT_IDS).some(id => activeElementIds.has(id))
      : activeElementIds.has(elementId);
    const imageStates = !isToolbarGroup && imageStateLookup instanceof Map
      ? (imageStateLookup.get(elementId) || {})
      : {};
    const showText = !isToolbarGroup && textVisibilityLookup instanceof Map
      ? textVisibilityLookup.get(elementId) !== false
      : true;
    const seenNodes = new Set();
    selectors.forEach(selector => {
      overlay.querySelectorAll(selector).forEach(node => {
        if (seenNodes.has(node)) return;
        seenNodes.add(node);
        node.classList.toggle(ACTIVE_RUNTIME_CLASS, shouldActivate);
        node.classList.toggle(TEXT_HIDDEN_RUNTIME_CLASS, shouldActivate && showText === false);
        Object.entries(STATE_IMAGE_CLASS_MAP).forEach(([state, className]) => {
          node.classList.toggle(className, shouldActivate && imageStates[state] === true);
        });
      });
    });
  });
}

function clamp01(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(1, num));
}

function hasNumericDifference(left, right, epsilon = 0.0001) {
  const safeLeft = Number(left);
  const safeRight = Number(right);
  if (!Number.isFinite(safeLeft) && !Number.isFinite(safeRight)) return false;
  if (!Number.isFinite(safeLeft) || !Number.isFinite(safeRight)) return true;
  return Math.abs(safeLeft - safeRight) > epsilon;
}

function clonePoints(points = FULL_RECT_POINTS) {
  return (Array.isArray(points) ? points : FULL_RECT_POINTS)
    .map(point => ({
      x: clamp01(point?.x, 0),
      y: clamp01(point?.y, 0),
    }));
}

function normalizeHitArea(raw, fallback = null) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const points = clonePoints(Array.isArray(source.points) ? source.points : fallback?.points || FULL_RECT_POINTS);
  if (points.length < 3) {
    return {
      type: 'polygon',
      points: clonePoints(fallback?.points || FULL_RECT_POINTS),
    };
  }
  return {
    type: 'polygon',
    points,
  };
}

function normalizeTextPadding(raw, fallback = {}) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  return {
    top: clamp01(safe.top, clamp01(fallback.top, 0)),
    right: clamp01(safe.right, clamp01(fallback.right, 0)),
    bottom: clamp01(safe.bottom, clamp01(fallback.bottom, 0)),
    left: clamp01(safe.left, clamp01(fallback.left, 0)),
  };
}

function normalizeLayout(raw, fallback = {}) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  const safeAspectRatioOverride = Number(safe.aspectRatioOverride);
  const fallbackAspectRatioOverride = Number(fallback.aspectRatioOverride);
  return {
    widthRatio: clamp01(safe.widthRatio, clamp01(fallback.widthRatio, 0)),
    offsetXRatio: Number.isFinite(Number(safe.offsetXRatio)) ? Number(safe.offsetXRatio) : Number(fallback.offsetXRatio || 0),
    offsetYRatio: Number.isFinite(Number(safe.offsetYRatio)) ? Number(safe.offsetYRatio) : Number(fallback.offsetYRatio || 0),
    anchorXRatio: clamp01(safe.anchorXRatio, clamp01(fallback.anchorXRatio, 0)),
    anchorYRatio: clamp01(safe.anchorYRatio, clamp01(fallback.anchorYRatio, 0)),
    aspectRatioOverride: Number.isFinite(safeAspectRatioOverride) && safeAspectRatioOverride > 0
      ? safeAspectRatioOverride
      : (Number.isFinite(fallbackAspectRatioOverride) && fallbackAspectRatioOverride > 0 ? fallbackAspectRatioOverride : undefined),
  };
}

function hasPointSetDifference(pointsA = [], pointsB = []) {
  if (pointsA.length !== pointsB.length) return true;
  return pointsA.some((point, index) =>
    hasNumericDifference(point?.x, pointsB[index]?.x) || hasNumericDifference(point?.y, pointsB[index]?.y));
}

function hasLayoutCustomization(layout, defaults) {
  const safeLayout = normalizeLayout(layout, defaults);
  const safeDefaults = normalizeLayout(defaults, defaults);
  return [
    'widthRatio',
    'offsetXRatio',
    'offsetYRatio',
    'anchorXRatio',
    'anchorYRatio',
    'aspectRatioOverride',
  ].some(field => hasNumericDifference(safeLayout[field], safeDefaults[field]));
}

function hasTextPaddingCustomization(textPadding, defaults) {
  const safeTextPadding = normalizeTextPadding(textPadding, defaults);
  const safeDefaults = normalizeTextPadding(defaults, defaults);
  return ['top', 'right', 'bottom', 'left'].some(field => hasNumericDifference(safeTextPadding[field], safeDefaults[field]));
}

function hasMetaCustomization(def, meta, defaultsMeta, { state = 'normal' } = {}) {
  const safeMeta = meta && typeof meta === 'object' ? meta : {};
  const safeDefaultsMeta = defaultsMeta && typeof defaultsMeta === 'object' ? defaultsMeta : {};
  const baseShowText = def?.supportsTextToggle === true ? safeDefaultsMeta.showText !== false : true;
  const currentShowText = def?.supportsTextToggle === true ? safeMeta.showText !== false : true;
  if (currentShowText !== baseShowText) return true;
  if (def?.interactive !== true) return false;

  const baseHitArea = normalizeHitArea(safeDefaultsMeta.hitArea, { type: 'polygon', points: FULL_RECT_POINTS });
  if (state !== 'normal' && safeMeta.hitAreaOverride !== true) {
    return false;
  }
  const currentHitArea = normalizeHitArea(safeMeta.hitArea, baseHitArea);
  return hasPointSetDifference(currentHitArea.points, baseHitArea.points);
}

function hasRuntimeCustomization(def, asset, defaults, options = {}) {
  if (!asset || typeof asset !== 'object') return false;
  if (asset.imageBlob || asset.imageUrl) return true;
  const assetScaleMode = String(asset.scaleMode || defaults?.scaleMode || '').trim();
  const defaultScaleMode = String(defaults?.scaleMode || '').trim();
  if (assetScaleMode !== defaultScaleMode) return true;
  if (hasLayoutCustomization(asset.layout, defaults?.layout)) return true;
  if (hasTextPaddingCustomization(asset.textPadding, defaults?.textPadding)) return true;
  return hasMetaCustomization(def, asset.meta, defaults?.meta, options);
}

function resolveScaleMode(scaleMode, fallback = 'stretch') {
  const value = String(scaleMode || fallback || 'stretch').trim().toLowerCase();
  if (value === 'cover') return 'cover';
  if (value === 'contain') return 'contain';
  if (value === 'nine-slice') return '100% 100%';
  return '100% 100%';
}

function toCssUrl(rawUrl) {
  const safeUrl = String(rawUrl || '').trim();
  if (!safeUrl) return 'none';
  return `url("${safeUrl.replace(/"/g, '\\"')}")`;
}

function toCssPolygon(hitArea) {
  const safeHitArea = normalizeHitArea(hitArea);
  return `polygon(${safeHitArea.points.map(point => `${(point.x * 100).toFixed(3)}% ${(point.y * 100).toFixed(3)}%`).join(', ')})`;
}

function revokeRuntimeBlobUrls() {
  runtimeBlobUrls.forEach(url => {
    try {
      (getWindowObject().URL || URL).revokeObjectURL(url);
    } catch (error) {
      // ignore
    }
  });
  runtimeBlobUrls = [];
}

function buildLookupKey(elementId, device, state) {
  return `${elementId}::${device}::${state}`;
}

function createAssetLookup(assets) {
  const lookup = new Map();
  (Array.isArray(assets) ? assets : []).forEach(asset => {
    const elementId = String(asset?.elementId || '').trim();
    const device = String(asset?.device || 'desktop').trim() || 'desktop';
    const state = String(asset?.state || 'normal').trim() || 'normal';
    if (!elementId) return;
    lookup.set(buildLookupKey(elementId, device, state), asset);
  });
  return lookup;
}

function getFallbackDevice(device) {
  return device === 'mobile' ? 'desktop' : 'mobile';
}

function getLookupAsset(lookup, elementId, device, state) {
  return lookup.get(buildLookupKey(elementId, device, state)) || null;
}

function resolveStateAsset(lookup, elementId, device, state) {
  const fallbackDevice = getFallbackDevice(device);
  const candidates = [
    getLookupAsset(lookup, elementId, device, state),
    state !== 'normal' ? getLookupAsset(lookup, elementId, device, 'normal') : null,
    getLookupAsset(lookup, elementId, fallbackDevice, state),
    state !== 'normal' ? getLookupAsset(lookup, elementId, fallbackDevice, 'normal') : null,
  ];
  return candidates.find(Boolean) || null;
}

function resolveNormalAsset(lookup, elementId, device) {
  const fallbackDevice = getFallbackDevice(device);
  return getLookupAsset(lookup, elementId, device, 'normal')
    || getLookupAsset(lookup, elementId, fallbackDevice, 'normal')
    || getLookupAsset(lookup, elementId, device, 'hover')
    || getLookupAsset(lookup, elementId, fallbackDevice, 'hover')
    || null;
}

function resolveStateAssetWithFallback(lookup, elementId, fallbackElementId, device, state) {
  return resolveStateAsset(lookup, elementId, device, state)
    || (fallbackElementId ? resolveStateAsset(lookup, fallbackElementId, device, state) : null);
}

function resolveNormalAssetWithFallback(lookup, elementId, fallbackElementId, device) {
  return resolveNormalAsset(lookup, elementId, device)
    || (fallbackElementId ? resolveNormalAsset(lookup, fallbackElementId, device) : null);
}

function resolveAssetImageUrl(asset, nextBlobUrls) {
  if (!asset) return 'none';
  if (asset.imageBlob) {
    const objectUrl = (getWindowObject().URL || URL).createObjectURL(asset.imageBlob);
    nextBlobUrls.push(objectUrl);
    return toCssUrl(objectUrl);
  }
  if (asset.imageUrl) {
    return toCssUrl(asset.imageUrl);
  }
  return 'none';
}

function getDeviceDefaults(elementId, device) {
  const def = getCustomSkinElementById(elementId);
  if (!def) return null;
  return def.defaults?.[device] || def.defaults?.desktop || null;
}

function getLiveRuntimeLayoutDefaults(elementId) {
  if (!customSkinElementUsesRuntimeLayout(elementId)) return null;
  const snapshot = getRuntimeElementLayoutSnapshot(elementId);
  if (!snapshot?.box) return null;
  return {
    widthRatio: clamp01(snapshot.box.width, 0),
    offsetXRatio: 0,
    offsetYRatio: 0,
    anchorXRatio: 0,
    anchorYRatio: 0,
  };
}

const FOOTER_RUNTIME_LAYOUT_ELEMENT_IDS = new Set([
  ...CUSTOM_SKIN_FOOTER_BUTTON_TARGET_IDS,
  'footer_btn_choices',
  'footer_btn_next',
]);

function getFooterElementIdFromNode(node) {
  if (!node?.matches) return '';
  if (node.matches('.gal-pending-choices-btn')) return 'footer_btn_choices';
  if (node.matches('.gal-footer-btn-next')) return 'footer_btn_next';
  if (!node.matches('.gal-footer-btn')) return '';
  switch (String(node.getAttribute('data-action') || '').trim()) {
    case 'log': return 'footer_btn_log';
    case 'close-mode': return 'footer_btn_close';
    case 'view-original': return 'footer_btn_view';
    case 'config': return 'footer_btn_config';
    case 'save': return 'footer_btn_save';
    case 'load': return 'footer_btn_load';
    case 'timeline': return 'footer_btn_timeline';
    case 'prev': return 'footer_btn_prev';
    case 'auto': return 'footer_btn_auto';
    case 'skip': return 'footer_btn_skip';
    default: return '';
  }
}

function getFooterToolbarAutoScale(
  overlay,
  footerMetrics = new Map(),
  scalableElementIds = new Set(),
) {
  const toolbar = overlay?.querySelector?.('.gal-bottom-toolbar');
  if (!toolbar || !(footerMetrics instanceof Map) || footerMetrics.size === 0) return 1;
  const win = getWindowObject();
  const toolbarStyle = win.getComputedStyle(toolbar);
  const paddingLeft = Number.parseFloat(toolbarStyle.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(toolbarStyle.paddingRight) || 0;
  const gapValue = toolbarStyle.columnGap && toolbarStyle.columnGap !== 'normal'
    ? toolbarStyle.columnGap
    : toolbarStyle.gap;
  const gap = Number.parseFloat(gapValue) || 0;
  const nodes = Array.from(toolbar.children || []).filter(node => {
    const elementId = getFooterElementIdFromNode(node);
    if (!elementId) return false;
    return win.getComputedStyle(node).display !== 'none';
  });
  if (!nodes.length) return 1;

  const availableWidth = Math.max(0, toolbar.clientWidth - paddingLeft - paddingRight);
  if (availableWidth <= 0) return 1;
  const totalGapWidth = gap * Math.max(0, nodes.length - 1);
  const widthBudget = Math.max(0, availableWidth - totalGapWidth);
  if (widthBudget <= 0) return 1;

  let fixedWidth = 0;
  let scalableWidth = 0;
  nodes.forEach(node => {
    const elementId = getFooterElementIdFromNode(node);
    const metric = footerMetrics.get(elementId);
    const desiredWidth = metric?.width > 0 ? metric.width : (node.getBoundingClientRect?.().width || 0);
    if (desiredWidth <= 0) return;
    if (scalableElementIds.has(elementId)) {
      scalableWidth += desiredWidth;
    } else {
      fixedWidth += desiredWidth;
    }
  });

  if (scalableWidth <= 0) return 1;
  const remainingWidth = widthBudget - fixedWidth;
  if (remainingWidth <= 0) return 0.35;
  return Math.max(0.35, Math.min(1, remainingWidth / scalableWidth));
}

export function getCustomSkinElementById(elementId) {
  return RUNTIME_ELEMENT_MAP.get(String(elementId || '').trim()) || null;
}

export function buildDefaultCustomSkinAssetPayload({ packId, skinId, elementId, device = 'desktop', state = 'normal' } = {}) {
  const def = getCustomSkinElementById(elementId) || CUSTOM_SKIN_ELEMENTS[0] || null;
  const safeDevice = device === 'mobile' ? 'mobile' : 'desktop';
  const safeState = Array.isArray(def?.supportsStates) && def.supportsStates.includes(state) ? state : 'normal';
  const defaults = getDeviceDefaults(def?.id, safeDevice) || {};
  const layoutDefaults = {
    ...defaults,
    ...(getLiveRuntimeLayoutDefaults(def?.id) || {}),
  };
  return {
    packId: String(packId || GLOBAL_CUSTOM_SKIN_PACK_ID).trim() || GLOBAL_CUSTOM_SKIN_PACK_ID,
    skinId: String(skinId || CUSTOM_SKIN_ID).trim() || CUSTOM_SKIN_ID,
    elementId: def?.id || '',
    device: safeDevice,
    state: safeState,
    scaleMode: String(defaults.scaleMode || def?.defaultScaleMode || 'stretch').trim() || 'stretch',
    layout: normalizeLayout(layoutDefaults, layoutDefaults),
    slice: defaults.slice && typeof defaults.slice === 'object' ? { ...defaults.slice } : { top: 0, right: 0, bottom: 0, left: 0 },
    textPadding: normalizeTextPadding(defaults.textPaddingRatio, defaults.textPaddingRatio),
    meta: {
      showText: def?.supportsTextToggle === true ? true : undefined,
      ...(def?.interactive
        ? {
            hitArea: normalizeHitArea(defaults.hitArea, { type: 'polygon', points: FULL_RECT_POINTS }),
          }
        : {}),
    },
  };
}

export function getCustomSkinRuntimeElementRects(device = null) {
  const overlay = getOverlayElement();
  const host = getHostElement(overlay);
  if (!overlay || !host) return [];
  const hostRect = host.getBoundingClientRect();
  if (!hostRect || hostRect.width <= 0 || hostRect.height <= 0) return [];
  const runtimeDevice = device === 'mobile' || device === 'desktop'
    ? device
    : (runtimePreviewDevice || (hostRect.width <= MOBILE_BREAKPOINT ? 'mobile' : 'desktop'));
  return CUSTOM_SKIN_ELEMENTS
    .map(def => {
      const mergedRect = mergeRuntimeNodeRects(getRuntimeNodesForElement(overlay, def.id, { forDetection: true }));
      const box = normalizeRuntimeRect(mergedRect, hostRect);
      if (!box) return null;
      return {
        elementId: def.id,
        label: def.label,
        device: runtimeDevice,
        box,
        centerX: box.centerX,
        centerY: box.centerY,
        areaRatio: box.areaRatio,
        aspectRatio: box.aspectRatio,
      };
    })
    .filter(Boolean);
}

function buildMergedRuntimePayload(def, device, normalAsset = null) {
  const base = buildDefaultCustomSkinAssetPayload({
    elementId: def.id,
    device,
    state: 'normal',
  });
  return {
    scaleMode: String(normalAsset?.scaleMode || base.scaleMode || def.defaultScaleMode || 'stretch').trim() || 'stretch',
    layout: normalizeLayout(normalAsset?.layout, base.layout),
    textPadding: normalizeTextPadding(normalAsset?.textPadding, base.textPadding),
    meta: {
      ...(base.meta || {}),
      ...(normalAsset?.meta && typeof normalAsset.meta === 'object' ? normalAsset.meta : {}),
    },
  };
}

function ensureObserverDisconnected() {
  if (runtimeResizeObserver && runtimeObservedHost) {
    try {
      runtimeResizeObserver.unobserve(runtimeObservedHost);
    } catch (error) {
      // ignore
    }
  }
  if (runtimeResizeObserver) {
    try {
      runtimeResizeObserver.disconnect();
    } catch (error) {
      // ignore
    }
  }
  runtimeResizeObserver = null;
  runtimeObservedHost = null;
  if (runtimeResizeWindow) {
    runtimeResizeWindow.removeEventListener('resize', scheduleCustomSkinRuntimeRefresh);
  }
  runtimeResizeWindow = null;
  if (runtimeResizeRaf) {
    getWindowObject().cancelAnimationFrame(runtimeResizeRaf);
    runtimeResizeRaf = 0;
  }
}

function scheduleCustomSkinRuntimeRefresh() {
  const win = getWindowObject();
  if (runtimeResizeRaf) {
    win.cancelAnimationFrame(runtimeResizeRaf);
  }
  runtimeResizeRaf = win.requestAnimationFrame(() => {
    runtimeResizeRaf = 0;
    applyCustomSkinRuntime().catch(error => {
      console.warn(`[${SCRIPT_NAME}] custom-skin runtime refresh failed:`, error);
    });
  });
}

function ensureRuntimeObserver(host) {
  if (!host) {
    ensureObserverDisconnected();
    return;
  }
  const win = getWindowObject();
  const ResizeObserverCtor = win.ResizeObserver || ResizeObserver;
  if (!ResizeObserverCtor) return;
  if (!runtimeResizeObserver) {
    runtimeResizeObserver = new ResizeObserverCtor(() => {
      scheduleCustomSkinRuntimeRefresh();
    });
  }
  if (runtimeObservedHost !== host) {
    if (runtimeObservedHost) {
      try {
        runtimeResizeObserver.unobserve(runtimeObservedHost);
      } catch (error) {
        // ignore
      }
    }
    runtimeResizeObserver.observe(host);
    runtimeObservedHost = host;
  }
  if (runtimeResizeWindow !== win) {
    if (runtimeResizeWindow) {
      runtimeResizeWindow.removeEventListener('resize', scheduleCustomSkinRuntimeRefresh);
    }
    runtimeResizeWindow = win;
    runtimeResizeWindow.addEventListener('resize', scheduleCustomSkinRuntimeRefresh);
  }
}

function removeRuntimeStyleProperties(overlay) {
  if (!overlay || !overlay.style) return;
  clearFooterButtonRuntimeNodeStyles(overlay);
  overlay.style.removeProperty('--custom-skin-control-top');
  overlay.style.removeProperty('--custom-skin-footer-auto-scale');
  overlay.style.removeProperty('--custom-skin-dialog-panel-padding-top');
  overlay.style.removeProperty('--custom-skin-dialog-panel-padding-right');
  overlay.style.removeProperty('--custom-skin-dialog-panel-padding-bottom');
  overlay.style.removeProperty('--custom-skin-dialog-panel-padding-left');
  CUSTOM_SKIN_ELEMENTS.forEach(def => {
    RUNTIME_STYLE_SUFFIXES.forEach(suffix => {
      overlay.style.removeProperty(`--custom-skin-${def.id}-${suffix}`);
    });
    CUSTOM_SKIN_STATES.forEach(state => {
      overlay.style.removeProperty(`--custom-skin-${def.id}-${state}-image`);
      overlay.style.removeProperty(`--custom-skin-${def.id}-${state}-hit-clip`);
    });
  });
}

export function clearCustomSkinRuntime() {
  const overlay = getOverlayElement();
  if (overlay) {
    removeRuntimeStyleProperties(overlay);
    updateRuntimeElementActivationClasses(overlay, new Set());
    overlay.classList.remove(CUSTOM_SKIN_ID);
    overlay.classList.remove('custom-skin-image-mode');
  }
  revokeRuntimeBlobUrls();
  ensureObserverDisconnected();
}

export function setCustomSkinRuntimePreviewDevice(device) {
  runtimePreviewDevice = device === 'mobile' || device === 'desktop' ? device : null;
}

export async function applyCustomSkinRuntime() {
  const token = ++runtimeApplyToken;
  const overlay = getOverlayElement();
  if (!overlay) {
    ensureObserverDisconnected();
    revokeRuntimeBlobUrls();
    return;
  }

  const settings = getSettings();
  const activeProfileId = hasUiSkinProfileId(String(settings?.skin || '').trim())
    ? String(settings.skin).trim()
    : '';
  if (!activeProfileId) {
    removeRuntimeStyleProperties(overlay);
    updateRuntimeElementActivationClasses(overlay, new Set());
    overlay.classList.remove('custom-skin-image-mode');
    revokeRuntimeBlobUrls();
    ensureObserverDisconnected();
    return;
  }

  const host = getHostElement(overlay);
  if (!host) return;
  ensureRuntimeObserver(host);

  const hostRect = host.getBoundingClientRect();
  const runtimeDevice = runtimePreviewDevice || (hostRect.width <= MOBILE_BREAKPOINT ? 'mobile' : 'desktop');
  const assets = await getUiSkinAssetsByPackSkin(GLOBAL_CUSTOM_SKIN_PACK_ID, activeProfileId);
  if (token !== runtimeApplyToken) return;

  const assetLookup = createAssetLookup(assets);
  removeRuntimeStyleProperties(overlay);
  updateRuntimeElementActivationClasses(overlay, new Set());
  overlay.classList.remove('custom-skin-image-mode');
  const nextBlobUrls = [];
  const nextStyleEntries = new Map();
  const activeElementIds = new Set();
  const imageStateLookup = new Map();
  const textVisibilityLookup = new Map();
  const footerMetrics = new Map();
  const scalableFooterElementIds = new Set();
  let hasVisualImage = false;
  let controlTop = runtimeDevice === 'mobile'
    ? 'clamp(4.7rem, 10vh, 6rem)'
    : 'clamp(5.2rem, 10vh, 7.2rem)';

  CUSTOM_SKIN_ELEMENTS.forEach(def => {
    const usesFooterCommonFallback = FOOTER_FALLBACK_ELEMENT_ID_SET.has(def.id);
    const fallbackSourceId = usesFooterCommonFallback ? CUSTOM_SKIN_FOOTER_COMMON_ELEMENT_ID : '';
    const baseRuntimePayload = buildDefaultCustomSkinAssetPayload({
      elementId: def.id,
      device: runtimeDevice,
      state: 'normal',
    });
    const normalAsset = usesFooterCommonFallback
      ? resolveNormalAssetWithFallback(assetLookup, def.id, fallbackSourceId, runtimeDevice)
      : resolveNormalAsset(assetLookup, def.id, runtimeDevice);
    const merged = buildMergedRuntimePayload(def, runtimeDevice, normalAsset);
    const runtimeStyleId = usesFooterCommonFallback ? CUSTOM_SKIN_FOOTER_COMMON_ELEMENT_ID : def.id;
    const runtimeStyleEntries = new Map();
    const showText = def.supportsTextToggle === true
      ? merged.meta?.showText !== false
      : true;
    let hasElementImage = false;
    let hasElementCustomization = hasRuntimeCustomization(def, normalAsset, baseRuntimePayload, { state: 'normal' });
    const imageStates = {
      normal: false,
      hover: false,
      active: false,
    };
    const liveRuntimeLayout = customSkinElementUsesRuntimeLayout(def.id)
      ? getRuntimeElementLayoutSnapshot(def.id, overlay, host, hostRect)
      : null;
    let actualWidth = 0;
    let actualHeight = 0;
    let actualOffsetX = 0;
    let actualOffsetY = 0;
    let actualAnchorX = 0;
    let actualAnchorY = 0;

    if (liveRuntimeLayout?.rect) {
      actualWidth = liveRuntimeLayout.rect.width;
      actualHeight = liveRuntimeLayout.rect.height;
    } else {
      const widthRatio = Math.max(0.01, Number(merged.layout.widthRatio || 0));
      const effectiveAspectRatio = Math.max(0.01, Number(merged.layout.aspectRatioOverride || def.aspectRatio || 1));
      actualWidth = hostRect.width * widthRatio;
      actualHeight = actualWidth / effectiveAspectRatio;

      if (def.interactive) {
        const minSide = Math.min(actualWidth, actualHeight);
        if (minSide < INTERACTIVE_MIN_SIZE) {
          const scale = INTERACTIVE_MIN_SIZE / Math.max(minSide, 1);
          actualWidth *= scale;
          actualHeight *= scale;
        }
      }

      actualOffsetX = hostRect.width * Number(merged.layout.offsetXRatio || 0);
      actualOffsetY = hostRect.height * Number(merged.layout.offsetYRatio || 0);
      actualAnchorX = actualWidth * clamp01(merged.layout.anchorXRatio, 0);
      actualAnchorY = actualHeight * clamp01(merged.layout.anchorYRatio, 0);
    }

    runtimeStyleEntries.set(`--custom-skin-${runtimeStyleId}-width`, `${actualWidth.toFixed(3)}px`);
    runtimeStyleEntries.set(`--custom-skin-${runtimeStyleId}-height`, `${actualHeight.toFixed(3)}px`);
    runtimeStyleEntries.set(`--custom-skin-${runtimeStyleId}-offset-x`, `${actualOffsetX.toFixed(3)}px`);
    runtimeStyleEntries.set(`--custom-skin-${runtimeStyleId}-offset-y`, `${actualOffsetY.toFixed(3)}px`);
    runtimeStyleEntries.set(`--custom-skin-${runtimeStyleId}-anchor-x`, `${actualAnchorX.toFixed(3)}px`);
    runtimeStyleEntries.set(`--custom-skin-${runtimeStyleId}-anchor-y`, `${actualAnchorY.toFixed(3)}px`);
    runtimeStyleEntries.set(`--custom-skin-${runtimeStyleId}-bg-size`, resolveScaleMode(merged.scaleMode, def.defaultScaleMode));

    if (def.id === 'dialog_panel') {
      nextStyleEntries.set('--custom-skin-dialog-panel-padding-top', `${(actualHeight * clamp01(merged.textPadding.top, 0)).toFixed(3)}px`);
      nextStyleEntries.set('--custom-skin-dialog-panel-padding-right', `${(actualWidth * clamp01(merged.textPadding.right, 0)).toFixed(3)}px`);
      nextStyleEntries.set('--custom-skin-dialog-panel-padding-bottom', `${(actualHeight * clamp01(merged.textPadding.bottom, 0)).toFixed(3)}px`);
      nextStyleEntries.set('--custom-skin-dialog-panel-padding-left', `${(actualWidth * clamp01(merged.textPadding.left, 0)).toFixed(3)}px`);
    }

    const normalHitArea = def.interactive
      ? normalizeHitArea(merged.meta?.hitArea, { type: 'polygon', points: FULL_RECT_POINTS })
      : null;

    CUSTOM_SKIN_STATES.forEach(state => {
      const stateAsset = usesFooterCommonFallback
        ? resolveStateAssetWithFallback(assetLookup, def.id, fallbackSourceId, runtimeDevice, state)
        : resolveStateAsset(assetLookup, def.id, runtimeDevice, state);
      const imageValue = resolveAssetImageUrl(stateAsset, nextBlobUrls);
      if (imageValue !== 'none') {
        hasVisualImage = true;
        hasElementImage = true;
        imageStates[state] = true;
      }
      if (!hasElementCustomization) {
        hasElementCustomization = hasRuntimeCustomization(def, stateAsset, baseRuntimePayload, { state });
      }
      runtimeStyleEntries.set(`--custom-skin-${runtimeStyleId}-${state}-image`, imageValue);

      if (def.interactive) {
        const allowOverride = stateAsset?.meta && typeof stateAsset.meta === 'object' && stateAsset.meta.hitAreaOverride === true;
        const stateHitArea = state === 'normal'
          ? normalHitArea
          : allowOverride
            ? normalizeHitArea(stateAsset?.meta?.hitArea, normalHitArea)
            : normalHitArea;
        runtimeStyleEntries.set(`--custom-skin-${runtimeStyleId}-${state}-hit-clip`, toCssPolygon(stateHitArea));
      }
    });

    if (usesFooterCommonFallback) {
      getRuntimeNodesForElement(overlay, def.id).forEach(node => {
        setStyleEntriesOnTarget(node, runtimeStyleEntries);
      });
    } else {
      runtimeStyleEntries.forEach((value, key) => {
        nextStyleEntries.set(key, value);
      });
    }

    if (hasElementImage || hasElementCustomization) {
      activeElementIds.add(def.id);
    }
    if (FOOTER_RUNTIME_LAYOUT_ELEMENT_IDS.has(def.id)) {
      footerMetrics.set(def.id, {
        width: actualWidth,
        height: actualHeight,
      });
      if (hasElementImage || hasElementCustomization) {
        scalableFooterElementIds.add(def.id);
      }
    }
    imageStateLookup.set(def.id, imageStates);
    textVisibilityLookup.set(def.id, showText);
  });

  nextStyleEntries.set('--custom-skin-footer-auto-scale', String(getFooterToolbarAutoScale(
    overlay,
    footerMetrics,
    scalableFooterElementIds,
  )));
  updateRuntimeElementActivationClasses(overlay, activeElementIds, imageStateLookup, textVisibilityLookup);
  nextStyleEntries.forEach((value, key) => {
    overlay.style.setProperty(key, value);
  });
  overlay.style.setProperty('--custom-skin-control-top', controlTop);
  overlay.classList.toggle('custom-skin-image-mode', hasVisualImage);

  revokeRuntimeBlobUrls();
  runtimeBlobUrls = nextBlobUrls;
}
