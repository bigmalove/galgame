import { CUSTOM_SKIN_ID, DEFAULT_PACK_ID, SCRIPT_NAME } from '../core/constants.js';
import { $, topWindow } from '../core/env.js';
import { GLOBAL_CUSTOM_SKIN_PACK_ID } from '../core/constants.js';
import { getSettings, saveSettings } from '../core/settings.js';
import { getCurrentPackId } from '../db/image-packs.js';
import { buildUiSkinAssetId, deleteUiSkinAsset, getUiSkinAsset, saveUiSkinAsset } from '../db/ui-skins.js';
import {
  createUiSkinProfile,
  deleteUiSkinProfile,
  duplicateUiSkinProfile,
  getCachedUiSkinProfiles,
  getUiSkinProfileLabel,
  hasUiSkinProfileId,
  refreshUiSkinProfilesCache,
  renameUiSkinProfile,
} from '../db/ui-skin-profiles.js';
import {
  AssetIO,
  importFromZipFile,
  showInAppConfirmDialog,
  showInAppPromptDialog,
} from './asset-io.js';
import { CustomSkinCropper } from './custom-skin-cropper.js';
import {
  CUSTOM_SKIN_ELEMENTS,
  CUSTOM_SKIN_FOOTER_BATCH_TARGET_IDS,
  CUSTOM_SKIN_FOOTER_BUTTON_TARGET_IDS,
  CUSTOM_SKIN_FOOTER_COMMON_ELEMENT_ID,
  CUSTOM_SKIN_STATES,
  applyCustomSkinRuntime,
  buildDefaultCustomSkinAssetPayload,
  customSkinElementUsesRuntimeLayout,
  getCustomSkinElementById,
  getCustomSkinRuntimeElementRects,
  previewCustomSkinTextVisibility,
  setCustomSkinRuntimePreviewDevice,
} from './custom-skin-runtime.js';
import { applySettingsToUI, refreshSkinSelectElement } from './settings-panel.js';
import { showToast } from './toast.js';

const EMPTY_BOX = { top: 0, right: 0, bottom: 0, left: 0 };
const RECT_HIT_AREA = {
  type: 'polygon',
  points: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ],
};
const DEFAULT_CHROMA_KEY_COLOR = '#00FF00';
const DEFAULT_CHROMA_KEY_TOLERANCE = 60;
const DEFAULT_MATTING_BRUSH_SIZE = 28;
const COMPONENT_SELECTION_PADDING_RATIO = 0;
const CHROMA_KEY_PRESETS = ['#00FF00', '#FF00FF', '#FFFFFF', '#000000'];
const FOOTER_BATCH_SLOT_META = [
  { id: 'footer_btn_log', shortLabel: 'LOG' },
  { id: 'footer_btn_close', shortLabel: 'CLOSE' },
  { id: 'footer_btn_view', shortLabel: 'VIEW' },
  { id: 'footer_btn_config', shortLabel: 'CONFIG' },
  { id: 'footer_btn_save', shortLabel: 'SAVE' },
  { id: 'footer_btn_load', shortLabel: 'LOAD' },
  { id: 'footer_btn_timeline', shortLabel: 'TL' },
  { id: 'footer_btn_prev', shortLabel: 'PREV' },
  { id: 'footer_btn_auto', shortLabel: 'AUTO' },
  { id: 'footer_btn_skip', shortLabel: 'SKIP' },
  { id: 'footer_btn_choices', shortLabel: '选项' },
  { id: 'footer_btn_next', shortLabel: 'NEXT' },
];
const FOOTER_BATCH_SLOT_META_MAP = new Map(FOOTER_BATCH_SLOT_META.map(item => [item.id, item]));
const FOOTER_BATCH_FIXED_ORDER_TEXT = FOOTER_BATCH_SLOT_META.map(item => item.shortLabel).join(' -> ');

function getPreviewPackId() {
  return getCurrentPackId() || DEFAULT_PACK_ID;
}

function getAssetPackId() {
  return GLOBAL_CUSTOM_SKIN_PACK_ID;
}

function getNumberValue(raw, fallback = null) {
  const num = Number(raw);
  return Number.isFinite(num) ? num : fallback;
}

function clamp01(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(1, num));
}

function formatInputValue(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Number(value.toFixed(4)));
  }
  return String(value);
}

function normalizeHexColor(value, fallback = DEFAULT_CHROMA_KEY_COLOR) {
  const raw = String(value || '').trim().replace(/^#/, '').toUpperCase();
  const expanded = raw.length === 3
    ? raw.split('').map(char => `${char}${char}`).join('')
    : raw;
  if (/^[0-9A-F]{6}$/.test(expanded)) {
    return `#${expanded}`;
  }
  return fallback;
}

function cloneBox(raw, fallback = EMPTY_BOX) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  return {
    top: clamp01(safe.top, clamp01(fallback.top, 0)),
    right: clamp01(safe.right, clamp01(fallback.right, 0)),
    bottom: clamp01(safe.bottom, clamp01(fallback.bottom, 0)),
    left: clamp01(safe.left, clamp01(fallback.left, 0)),
  };
}

function cloneHitArea(raw, fallback = RECT_HIT_AREA) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  const points = (Array.isArray(safe.points) ? safe.points : fallback.points)
    .map(point => ({
      x: clamp01(point?.x, 0),
      y: clamp01(point?.y, 0),
    }))
    .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
  return {
    type: 'polygon',
    points: points.length >= 3 ? points : fallback.points.map(point => ({ ...point })),
  };
}

function mergePayload(base, asset) {
  const safeAsset = asset && typeof asset === 'object' ? asset : {};
  return {
    ...base,
    ...safeAsset,
    layout: {
      ...(base.layout || {}),
      ...(safeAsset.layout || {}),
    },
    textPadding: cloneBox(safeAsset.textPadding, base.textPadding || EMPTY_BOX),
    slice: safeAsset.slice && typeof safeAsset.slice === 'object'
      ? { ...safeAsset.slice }
      : (base.slice && typeof base.slice === 'object' ? { ...base.slice } : { ...EMPTY_BOX }),
    meta: {
      ...(base.meta || {}),
      ...(safeAsset.meta && typeof safeAsset.meta === 'object' ? safeAsset.meta : {}),
    },
  };
}

function getElementStates(elementId) {
  const def = getCustomSkinElementById(elementId);
  if (!def || !Array.isArray(def.supportsStates) || def.supportsStates.length === 0) {
    return ['normal'];
  }
  return def.supportsStates;
}

function supportsTextToggle(elementId) {
  return getCustomSkinElementById(elementId)?.supportsTextToggle === true;
}

function isFooterBatchEntryElementId(elementId) {
  return String(elementId || '').trim() === CUSTOM_SKIN_FOOTER_COMMON_ELEMENT_ID;
}

function getFooterBatchSlotMeta(elementId) {
  return FOOTER_BATCH_SLOT_META_MAP.get(String(elementId || '').trim()) || null;
}

function getNormalizedBoxArea(box) {
  if (!box || typeof box !== 'object') return 0;
  return Math.max(0, Number(box.width) || 0) * Math.max(0, Number(box.height) || 0);
}

function getDistanceSimilarity(leftX, leftY, rightX, rightY, spread = 0.42) {
  const distance = Math.hypot((Number(leftX) || 0) - (Number(rightX) || 0), (Number(leftY) || 0) - (Number(rightY) || 0));
  if (spread <= 0) return 0;
  return clamp01(1 - (distance / spread), 0);
}

function getRatioSimilarity(currentValue, targetValue, spread = 4) {
  const current = Math.max(0.0001, Number(currentValue) || 0);
  const target = Math.max(0.0001, Number(targetValue) || 0);
  const safeSpread = Math.max(1.01, Number(spread) || 4);
  const delta = Math.abs(Math.log(current / target));
  return clamp01(1 - (delta / Math.log(safeSpread)), 0);
}

function buildComponentCandidateDetectionOptions(templates = []) {
  const areas = templates.map(template => Number(template?.areaRatio) || 0).filter(value => value > 0);
  const widths = templates.map(template => Number(template?.box?.width) || 0).filter(value => value > 0);
  const heights = templates.map(template => Number(template?.box?.height) || 0).filter(value => value > 0);
  const minAreaRatio = areas.length ? Math.max(0.00018, Math.min(...areas) * 0.18) : 0.00035;
  const minWidthRatio = widths.length ? Math.max(0.012, Math.min(...widths) * 0.45) : 0.018;
  const minHeightRatio = heights.length ? Math.max(0.012, Math.min(...heights) * 0.45) : 0.018;
  return {
    minAreaRatio,
    minWidthRatio,
    minHeightRatio,
    maxWidthRatio: 0.98,
    maxHeightRatio: 0.98,
    maxCandidates: Math.max(24, templates.length * 4, 48),
    shouldRender: false,
    selectFirstCandidate: false,
  };
}

function classifyComponentCandidates(candidates = [], templates = []) {
  const safeTemplates = Array.isArray(templates) ? templates : [];
  return (Array.isArray(candidates) ? candidates : []).map(candidate => {
    const candidateArea = getNormalizedBoxArea(candidate?.box);
    let bestTemplate = null;
    let bestScore = 0;
    safeTemplates.forEach(template => {
      const positionScore = getDistanceSimilarity(candidate?.centerX, candidate?.centerY, template?.centerX, template?.centerY);
      const aspectScore = getRatioSimilarity(candidate?.aspectRatio, template?.aspectRatio, 4);
      const areaScore = getRatioSimilarity(candidateArea, template?.areaRatio, 7);
      const score = (positionScore * 0.5) + (aspectScore * 0.3) + (areaScore * 0.2);
      if (score > bestScore) {
        bestScore = score;
        bestTemplate = template;
      }
    });
    return {
      ...candidate,
      suggestedElementId: String(bestTemplate?.elementId || '').trim(),
      suggestedElementLabel: String(bestTemplate?.label || getCustomSkinElementById(bestTemplate?.elementId)?.label || '').trim(),
    };
  });
}

function buildComponentCandidateLabel(candidate, index = 0) {
  const elementLabel = String(candidate?.suggestedElementLabel || getCustomSkinElementById(candidate?.suggestedElementId)?.label || '').trim();
  if (!elementLabel) {
    return `候选 ${index + 1}`;
  }
  return elementLabel;
}

export function buildCustomSkinEditorTab(activeTab, currentPackId) {
  const firstElementId = CUSTOM_SKIN_ELEMENTS[0]?.id || 'dialog_panel';
  const profileOptions = getCachedUiSkinProfiles()
    .map(profile => `<option value="${profile.id}">${profile.displayName}</option>`)
    .join('');
  const elementOptions = CUSTOM_SKIN_ELEMENTS
    .map(def => `<option value="${def.id}">${def.label}</option>`)
    .join('');
  const elementList = CUSTOM_SKIN_ELEMENTS
    .map((def, index) => `
      <button
        type="button"
        class="gal-custom-skin-element-item ${index === 0 ? 'active' : ''}"
        data-element-id="${def.id}"
        title="${def.id}"
      >
        <span class="gal-custom-skin-element-label">${def.label}</span>
        <small class="gal-custom-skin-element-id">${def.id}</small>
      </button>
    `)
    .join('');
  const stateOptions = CUSTOM_SKIN_STATES
    .map(state => `<option value="${state}">${state}</option>`)
    .join('');
  const chromaPresetButtons = CHROMA_KEY_PRESETS
    .map(color => `
      <button
        type="button"
        class="gal-custom-skin-color-chip"
        data-color="${color}"
        title="使用 ${color} 作为背景键色"
        style="--gal-custom-skin-chip-color:${color};"
      >${color}</button>
    `)
    .join('');
  return `
  <div class="gal-tab-pane ${activeTab === 'skin' ? 'active' : ''}" data-pane="skin" style="${activeTab !== 'skin' ? 'display: none;' : ''}">
    <div class="gal-pane-header">
      <span class="gal-pane-stat" id="gal-custom-skin-profile-status">当前预览图包：${currentPackId || getPreviewPackId()} · 全局自定义皮肤库</span>
      <div class="gal-pane-actions">
        <button type="button" class="gal-action-btn gal-pane-btn" id="gal-custom-skin-export-library"><i class="fa-solid fa-file-export"></i> <span>导出皮肤库</span></button>
        <button type="button" class="gal-action-btn gal-pane-btn" id="gal-custom-skin-import-package"><i class="fa-solid fa-file-import"></i> <span>导入皮肤包</span></button>
        <button type="button" class="gal-action-btn gal-pane-btn teal" id="gal-custom-skin-reload-runtime"><i class="fa-solid fa-rotate"></i> <span>刷新预览</span></button>
      </div>
    </div>
    <div class="gal-custom-skin-profile-bar">
      <label class="gal-custom-skin-profile-select-wrap">
        <span>当前皮肤</span>
        <select id="gal-custom-skin-profile-select">
          ${profileOptions}
        </select>
      </label>
      <div class="gal-custom-skin-profile-actions">
        <button type="button" class="gal-action-btn gal-pane-btn primary" id="gal-custom-skin-profile-create"><i class="fa-solid fa-plus"></i> <span>新建</span></button>
        <button type="button" class="gal-action-btn gal-pane-btn" id="gal-custom-skin-profile-rename"><i class="fa-solid fa-pen"></i> <span>重命名</span></button>
        <button type="button" class="gal-action-btn gal-pane-btn" id="gal-custom-skin-profile-duplicate"><i class="fa-solid fa-copy"></i> <span>另存为</span></button>
        <button type="button" class="gal-action-btn gal-pane-btn" id="gal-custom-skin-export-current"><i class="fa-solid fa-file-export"></i> <span>导出当前皮肤</span></button>
        <button type="button" class="gal-action-btn gal-pane-btn" id="gal-custom-skin-profile-delete"><i class="fa-solid fa-trash"></i> <span>删除</span></button>
      </div>
    </div>
    <input type="file" id="gal-custom-skin-import-zip-input" accept=".zip" style="display:none;">
    <div class="gal-custom-skin-device-switch" id="gal-custom-skin-device-switch">
      <button type="button" class="gal-custom-skin-device-tab active" data-device="desktop">桌面端</button>
      <button type="button" class="gal-custom-skin-device-tab" data-device="mobile">移动端</button>
    </div>

    <div class="gal-custom-skin-editor-layout">
      <div class="gal-custom-skin-editor-col gal-custom-skin-editor-elements">
        <div class="gal-custom-skin-editor-title"><i class="fa-solid fa-layer-group"></i> 元素列表</div>
        <div class="gal-custom-skin-elements-list">
          ${elementList}
        </div>
      </div>

      <div class="gal-custom-skin-editor-col gal-custom-skin-editor-main">
        <div class="gal-custom-skin-editor-title"><i class="fa-solid fa-crop"></i> 裁图与命中区</div>
        <div class="gal-custom-skin-editor-hint" id="gal-custom-skin-editor-hint">裁图模式下可拖边/角改变控件框形状，框内拖动画面；命中区模式仅用于按钮类组件。</div>
        <div class="gal-custom-skin-workbench">
          <div class="gal-custom-skin-canvas-panel">
            <div class="gal-custom-skin-canvas-toolbar">
              <button type="button" class="gal-action-btn gal-pane-btn gal-custom-skin-preview-toggle-btn" id="gal-custom-skin-desktop-preview-toggle">
                <i class="fa-solid fa-desktop"></i>
                <span>预览主桌面</span>
              </button>
            </div>
            <div class="gal-custom-skin-crop-wrapper" id="gal-custom-skin-crop-wrapper">
              <canvas id="gal-custom-skin-skin-canvas" width="560" height="320"></canvas>
            </div>
          </div>

          <div class="gal-custom-skin-side-tools">
            <input type="file" id="gal-custom-skin-image-input" accept="image/*" style="display:none;">

            <div class="gal-custom-skin-side-panel">
              <div class="gal-custom-skin-form-grid gal-custom-skin-form-grid-core">
                <label>
                  <span>当前编辑端</span>
                  <input type="text" id="gal-custom-skin-device-display" value="desktop" readonly>
                </label>
                <label>
                  <span>状态</span>
                  <select id="gal-custom-skin-state-select">${stateOptions}</select>
                </label>
                <select id="gal-custom-skin-device-select" style="display:none;">
                  <option value="desktop">desktop</option>
                  <option value="mobile">mobile</option>
                </select>
                <label class="gal-custom-skin-field-wide">
                  <span>缩放模式</span>
                  <select id="gal-custom-skin-scale-mode">
                    <option value="stretch">stretch</option>
                    <option value="cover">cover</option>
                    <option value="contain">contain</option>
                    <option value="nine-slice">nine-slice</option>
                  </select>
                </label>
                <label class="gal-custom-skin-check-row gal-custom-skin-field-wide" id="gal-custom-skin-show-text-row">
                  <input type="checkbox" id="gal-custom-skin-show-text" checked>
                  <span>显示组件文字（图片自带文字时可关闭）</span>
                </label>
              </div>
            </div>

            <div class="gal-custom-skin-preview-actions">
              <button type="button" class="gal-action-btn gal-pane-btn primary" id="gal-custom-skin-select-image"><i class="fa-solid fa-upload"></i> <span>选择图片</span></button>
              <button type="button" class="gal-action-btn gal-pane-btn" id="gal-custom-skin-reset-crop"><i class="fa-solid fa-arrows-rotate"></i> <span>重置裁图</span></button>
              <button type="button" class="gal-action-btn gal-pane-btn" id="gal-custom-skin-auto-detect-content"><i class="fa-solid fa-wand-magic-sparkles"></i> <span>自动识别</span></button>
            </div>

            <div class="gal-custom-skin-side-panel">
              <div class="gal-custom-skin-preview-actions gal-custom-skin-preview-actions-secondary">
                <button type="button" class="gal-action-btn gal-pane-btn gal-custom-skin-mode-btn active" data-mode="crop"><i class="fa-solid fa-crop-simple"></i> <span>裁图模式</span></button>
                <button type="button" class="gal-action-btn gal-pane-btn gal-custom-skin-mode-btn" data-mode="hit"><i class="fa-solid fa-vector-square"></i> <span>命中区模式</span></button>
              </div>
              <div class="gal-custom-skin-mode-help" id="gal-custom-skin-mode-help">裁图模式下可拖边/角改变控件框形状，框内拖动画面；只有异形按钮才需要添加命中点。</div>
              <div class="gal-custom-skin-preview-actions gal-custom-skin-preview-actions-secondary" id="gal-custom-skin-hit-actions">
                <button type="button" class="gal-action-btn gal-pane-btn" id="gal-custom-skin-add-hit-point"><i class="fa-solid fa-plus"></i> <span>添加命中点</span></button>
                <button type="button" class="gal-action-btn gal-pane-btn" id="gal-custom-skin-remove-hit-point"><i class="fa-solid fa-minus"></i> <span>删除命中点</span></button>
                <button type="button" class="gal-action-btn gal-pane-btn" id="gal-custom-skin-reset-hit-point"><i class="fa-solid fa-rotate-left"></i> <span>重置命中区</span></button>
              </div>
            </div>

            <div class="gal-custom-skin-side-panel gal-custom-skin-footer-batch-panel" id="gal-custom-skin-footer-batch-panel">
              <div class="gal-custom-skin-subtitle">底栏固定顺序导入</div>
              <div class="gal-custom-skin-editor-note" id="gal-custom-skin-footer-batch-note">上传整条底栏图后，点击“识别底栏”，再点“按默认顺序保存”。系统会固定按 ${FOOTER_BATCH_FIXED_ORDER_TEXT} 保存 12 个底栏按钮。</div>
              <div class="gal-custom-skin-preview-actions gal-custom-skin-preview-actions-secondary">
                <button type="button" class="gal-action-btn gal-pane-btn primary" id="gal-custom-skin-footer-batch-save"><i class="fa-solid fa-layer-group"></i> <span>按默认顺序保存</span></button>
              </div>
            </div>

            <div class="gal-custom-skin-side-panel">
              <div class="gal-custom-skin-zoom-row">
                <span>原图缩放</span>
                <input type="range" id="gal-custom-skin-zoom" min="1" max="500" value="100">
                <span id="gal-custom-skin-zoom-value">100%</span>
              </div>
              <div class="gal-custom-skin-zoom-row gal-custom-skin-zoom-row-metric">
                <span>控件框比例</span>
                <strong id="gal-custom-skin-crop-ratio-value">-</strong>
              </div>
              <label class="gal-custom-skin-check-row">
                <input type="checkbox" id="gal-custom-skin-save-image">
                <span>保存当前裁图后的图片</span>
              </label>
              <label class="gal-custom-skin-check-row" id="gal-custom-skin-hit-override-row">
                <input type="checkbox" id="gal-custom-skin-hit-override">
                <span>当前状态单独命中区（仅按钮类 hover / active 可用）</span>
              </label>
            </div>

            <div class="gal-custom-skin-matting-panel">
              <label class="gal-custom-skin-check-row gal-custom-skin-check-row-strong">
                <input type="checkbox" id="gal-custom-skin-matting-enabled">
                <span>启用纯色抠图（默认键色 #00FF00）</span>
              </label>
              <div class="gal-custom-skin-form-grid gal-custom-skin-matting-grid">
                <label class="gal-custom-skin-field-wide">
                  <span>背景键色</span>
                  <div class="gal-custom-skin-color-row">
                    <input type="color" id="gal-custom-skin-matting-color" value="${DEFAULT_CHROMA_KEY_COLOR}">
                    <input type="text" id="gal-custom-skin-matting-color-text" value="${DEFAULT_CHROMA_KEY_COLOR}" placeholder="${DEFAULT_CHROMA_KEY_COLOR}" spellcheck="false" autocomplete="off">
                    <button type="button" class="gal-action-btn gal-pane-btn" id="gal-custom-skin-pick-matting-color"><i class="fa-solid fa-eye-dropper"></i> <span>从画面取色</span></button>
                  </div>
                </label>
                <div class="gal-custom-skin-color-presets gal-custom-skin-field-wide">
                  ${chromaPresetButtons}
                </div>
              </div>
              <div class="gal-custom-skin-zoom-row">
                <span>抠图容差</span>
                <input type="range" id="gal-custom-skin-matting-tolerance" min="0" max="255" value="${DEFAULT_CHROMA_KEY_TOLERANCE}">
                <span id="gal-custom-skin-matting-tolerance-value">${DEFAULT_CHROMA_KEY_TOLERANCE}</span>
              </div>
              <div class="gal-custom-skin-preview-actions gal-custom-skin-preview-actions-secondary">
                <button type="button" class="gal-action-btn gal-pane-btn primary" id="gal-custom-skin-apply-matting"><i class="fa-solid fa-scissors"></i> <span>应用抠图</span></button>
                <button type="button" class="gal-action-btn gal-pane-btn" id="gal-custom-skin-clear-matting"><i class="fa-solid fa-rotate-left"></i> <span>清除抠图</span></button>
              </div>
              <div class="gal-custom-skin-zoom-row">
                <span>修补画笔</span>
                <input type="range" id="gal-custom-skin-matting-brush" min="4" max="160" value="${DEFAULT_MATTING_BRUSH_SIZE}">
                <span id="gal-custom-skin-matting-brush-value">${DEFAULT_MATTING_BRUSH_SIZE}px</span>
              </div>
              <div class="gal-custom-skin-preview-actions gal-custom-skin-preview-actions-secondary" id="gal-custom-skin-matting-actions">
                <button type="button" class="gal-action-btn gal-pane-btn gal-custom-skin-matting-tool-btn" data-tool="keep"><i class="fa-solid fa-brush"></i> <span>保留画笔</span></button>
                <button type="button" class="gal-action-btn gal-pane-btn gal-custom-skin-matting-tool-btn active" data-tool="erase"><i class="fa-solid fa-eraser"></i> <span>移除画笔</span></button>
              </div>
            </div>
            <details class="gal-custom-skin-editor-section gal-custom-skin-parameters-panel" id="gal-custom-skin-parameters-panel">
              <summary><i class="fa-solid fa-sliders"></i> 比例参数与元素选择</summary>
              <div class="gal-custom-skin-parameters-body">
                <div class="gal-custom-skin-editor-note">比例参数已收起到右侧底部；只有需要微调布局、锚点和文字区时再展开编辑。</div>

                <div class="gal-custom-skin-editor-form-scroll">
                  <div class="gal-custom-skin-form-grid gal-custom-skin-form-grid-core">
                    <label class="gal-custom-skin-field-wide">
                      <span>元素</span>
                      <select id="gal-custom-skin-element-select">${elementOptions}</select>
                    </label>
                  </div>

                  <details class="gal-custom-skin-editor-section" id="gal-custom-skin-text-padding-section" open>
                    <summary id="gal-custom-skin-text-padding-summary">文本内边距（textPadding）</summary>
                    <div class="gal-custom-skin-editor-note gal-custom-skin-editor-note-inline">对话框会使用这里的比例作为文字区域边距，也可结合透明区自动识别快速填充。</div>
                    <div class="gal-custom-skin-form-grid gal-custom-skin-four-grid">
                      <label><span>top</span><input type="number" id="gal-custom-skin-pad-top" step="0.001" min="0" max="1"></label>
                      <label><span>right</span><input type="number" id="gal-custom-skin-pad-right" step="0.001" min="0" max="1"></label>
                      <label><span>bottom</span><input type="number" id="gal-custom-skin-pad-bottom" step="0.001" min="0" max="1"></label>
                      <label><span>left</span><input type="number" id="gal-custom-skin-pad-left" step="0.001" min="0" max="1"></label>
                    </div>
                  </details>

                  <details class="gal-custom-skin-editor-section" id="gal-custom-skin-advanced-layout-section">
                    <summary>高级比例参数</summary>
                    <div class="gal-custom-skin-editor-note gal-custom-skin-editor-note-inline">只有遇到特殊布局、对齐偏差或跨端微调时，才需要改这些比例；对话框默认会跟随当前主题的真实大小与位置。</div>
                    <div class="gal-custom-skin-form-grid">
                      <label>
                        <span>宽度比例</span>
                        <input type="number" id="gal-custom-skin-width-ratio" step="0.001" min="0" max="1">
                      </label>
                      <label>
                        <span>X 偏移比例</span>
                        <input type="number" id="gal-custom-skin-offset-x-ratio" step="0.001">
                      </label>
                      <label>
                        <span>Y 偏移比例</span>
                        <input type="number" id="gal-custom-skin-offset-y-ratio" step="0.001">
                      </label>
                      <label>
                        <span>X 锚点比例</span>
                        <input type="number" id="gal-custom-skin-anchor-x-ratio" step="0.001" min="0" max="1">
                      </label>
                      <label>
                        <span>Y 锚点比例</span>
                        <input type="number" id="gal-custom-skin-anchor-y-ratio" step="0.001" min="0" max="1">
                      </label>
                    </div>
                  </details>
                </div>
              </div>
            </details>
          </div>
        </div>

        <div class="gal-custom-skin-form-actions">
          <button type="button" class="gal-action-btn gal-pane-btn primary" id="gal-custom-skin-save-current"><i class="fa-solid fa-floppy-disk"></i> <span>保存当前元素</span></button>
          <button type="button" class="gal-action-btn gal-pane-btn purple" id="gal-custom-skin-reload-current"><i class="fa-solid fa-rotate-right"></i> <span>重新加载</span></button>
          <button type="button" class="gal-action-btn gal-pane-btn" id="gal-custom-skin-reset-current"><i class="fa-solid fa-trash"></i> <span>重置当前状态</span></button>
        </div>
      </div>
    </div>
  </div>`;
}

export function bindCustomSkinEditorEvents($modal) {
  const $pane = $modal.find('.gal-tab-pane[data-pane="skin"]');
  if (!$pane.length) return;
  const initialProfiles = getCachedUiSkinProfiles();
  const settings = getSettings();
  const initialProfileId = hasUiSkinProfileId(settings.skin)
    ? String(settings.skin).trim()
    : (initialProfiles[0]?.id || '');

  const state = {
    profileId: initialProfileId,
    profiles: initialProfiles,
    elementId: CUSTOM_SKIN_ELEMENTS[0]?.id || 'dialog_panel',
    device: 'desktop',
    uiState: 'normal',
    editorMode: 'crop',
    overlayMode: '',
    mattingTool: 'erase',
    lastMattingBrushTool: 'erase',
    cropper: null,
    currentAsset: null,
    normalAsset: null,
    componentSessionActive: false,
    componentSessionCandidates: [],
    componentSessionSelectedCandidateId: '',
    preserveUploadedImageOnSwitch: false,
    footerBatchCandidates: [],
    footerBatchAssignments: {},
    footerBatchPendingTargetId: '',
    footerBatchSelectedCandidateId: '',
    desktopPreviewActive: false,
    objectUrls: new Set(),
    loadToken: 0,
    pendingAssetLoad: null,
  };

  const $profileStatus = $pane.find('#gal-custom-skin-profile-status');
  const $profileSelect = $pane.find('#gal-custom-skin-profile-select');
  const $profileImportZipInput = $pane.find('#gal-custom-skin-import-zip-input');
  const $elementSelect = $pane.find('#gal-custom-skin-element-select');
  const $deviceSelect = $pane.find('#gal-custom-skin-device-select');
  const $deviceDisplay = $pane.find('#gal-custom-skin-device-display');
  const $stateSelect = $pane.find('#gal-custom-skin-state-select');
  const $scaleMode = $pane.find('#gal-custom-skin-scale-mode');
  const $showText = $pane.find('#gal-custom-skin-show-text');
  const $showTextRow = $pane.find('#gal-custom-skin-show-text-row');
  const $hint = $pane.find('#gal-custom-skin-editor-hint');
  const $modeHelp = $pane.find('#gal-custom-skin-mode-help');
  const $zoom = $pane.find('#gal-custom-skin-zoom');
  const $zoomValue = $pane.find('#gal-custom-skin-zoom-value');
  const $cropRatioValue = $pane.find('#gal-custom-skin-crop-ratio-value');
  const $desktopPreviewToggle = $pane.find('#gal-custom-skin-desktop-preview-toggle');
  const $saveImage = $pane.find('#gal-custom-skin-save-image');
  const $hitOverride = $pane.find('#gal-custom-skin-hit-override');
  const $hitOverrideRow = $pane.find('#gal-custom-skin-hit-override-row');
  const $imageInput = $pane.find('#gal-custom-skin-image-input');
  const $autoDetectContent = $pane.find('#gal-custom-skin-auto-detect-content');
  const $autoDetectContentLabel = $autoDetectContent.find('span');
  const $mattingEnabled = $pane.find('#gal-custom-skin-matting-enabled');
  const $mattingColor = $pane.find('#gal-custom-skin-matting-color');
  const $mattingColorText = $pane.find('#gal-custom-skin-matting-color-text');
  const $pickMattingColor = $pane.find('#gal-custom-skin-pick-matting-color');
  const $mattingTolerance = $pane.find('#gal-custom-skin-matting-tolerance');
  const $mattingToleranceValue = $pane.find('#gal-custom-skin-matting-tolerance-value');
  const $applyMatting = $pane.find('#gal-custom-skin-apply-matting');
  const $clearMatting = $pane.find('#gal-custom-skin-clear-matting');
  const $mattingBrush = $pane.find('#gal-custom-skin-matting-brush');
  const $mattingBrushValue = $pane.find('#gal-custom-skin-matting-brush-value');
  const $mattingToolButtons = $pane.find('.gal-custom-skin-matting-tool-btn');
  const $cropWrapper = $pane.find('#gal-custom-skin-crop-wrapper');
  const $modeButtons = $pane.find('.gal-custom-skin-mode-btn');
  const $hitModeButton = $pane.find('.gal-custom-skin-mode-btn[data-mode="hit"]');
  const $hitActions = $pane.find('#gal-custom-skin-hit-actions');
  const $footerBatchPanel = $pane.find('#gal-custom-skin-footer-batch-panel');
  const $footerBatchNote = $pane.find('#gal-custom-skin-footer-batch-note');
  const $footerBatchTargets = $pane.find('#gal-custom-skin-footer-batch-targets');
  const $footerBatchClear = $pane.find('#gal-custom-skin-footer-batch-clear');
  const $footerBatchSave = $pane.find('#gal-custom-skin-footer-batch-save');
  const $saveCurrentButton = $pane.find('#gal-custom-skin-save-current');
  const $saveCurrentButtonLabel = $saveCurrentButton.find('span');
  const $textPaddingSection = $pane.find('#gal-custom-skin-text-padding-section');
  const $advancedLayoutSection = $pane.find('#gal-custom-skin-advanced-layout-section');
  const $addHitPoint = $pane.find('#gal-custom-skin-add-hit-point');
  const $removeHitPoint = $pane.find('#gal-custom-skin-remove-hit-point');
  const $resetHitPoint = $pane.find('#gal-custom-skin-reset-hit-point');
  const $configPanel = $modal.find('.gal-config-panel').first();
  const canvas = $pane.find('#gal-custom-skin-skin-canvas').get(0);
  let $desktopPreviewFab = $configPanel.find('.gal-custom-skin-desktop-preview-fab');
  if (!$desktopPreviewFab.length && $configPanel.length) {
    $desktopPreviewFab = $(`
      <button type="button" class="gal-action-btn gal-pane-btn primary gal-custom-skin-desktop-preview-fab" id="gal-custom-skin-desktop-preview-fab">
        <i class="fa-solid fa-arrow-left"></i>
        <span>返回编辑器</span>
      </button>
    `);
    $configPanel.append($desktopPreviewFab);
  }

  const setHint = (text, type = 'normal') => {
    $hint.text(text || '');
    $hint.removeClass('ok warn err');
    if (type === 'ok') $hint.addClass('ok');
    if (type === 'warn') $hint.addClass('warn');
    if (type === 'err') $hint.addClass('err');
  };

  const bindPaneButton = (selector, handler) => {
    $pane.off('click.customSkinButtons', selector).on('click.customSkinButtons', selector, event => {
      event.preventDefault();
      event.stopPropagation();
      if ($(event.currentTarget).prop('disabled')) return;
      handler(event);
    });
  };

  const syncDesktopPreviewUi = () => {
    $modal.toggleClass('gal-custom-skin-desktop-preview', state.desktopPreviewActive === true);
    $desktopPreviewToggle.attr('aria-pressed', state.desktopPreviewActive === true ? 'true' : 'false');
    $desktopPreviewToggle.attr(
      'title',
      state.desktopPreviewActive === true
        ? '当前正在主桌面预览，请点击右上角“返回编辑器”继续修改'
        : '临时隐藏编辑面板，直接查看当前主桌面效果',
    );
    $desktopPreviewFab.attr(
      'title',
      state.desktopPreviewActive === true
        ? '返回当前编辑界面'
        : '返回当前编辑界面',
    );
  };

  const setDesktopPreviewActive = active => {
    const nextActive = active === true;
    if (state.desktopPreviewActive === nextActive) return;
    state.desktopPreviewActive = nextActive;
    syncDesktopPreviewUi();
    if (nextActive) {
      showToast('已切换到主桌面预览，点击右上角“返回编辑器”继续修改');
      return;
    }
    setHint('已返回当前编辑界面，可继续调整裁图和命中区。', 'ok');
  };
  syncDesktopPreviewUi();

  const formatAspectRatioLabel = ratio => {
    const safe = Number(ratio);
    if (!Number.isFinite(safe) || safe <= 0) return '-';
    if (safe >= 1) return `${safe.toFixed(2)} : 1`;
    return `1 : ${(1 / safe).toFixed(2)}`;
  };

  const syncMattingControls = () => {
    const mattingState = state.cropper?.getMattingState?.() || {};
    const keyColor = normalizeHexColor(mattingState.keyColor, DEFAULT_CHROMA_KEY_COLOR);
    const tolerance = Number.isFinite(Number(mattingState.tolerance))
      ? Number(mattingState.tolerance)
      : DEFAULT_CHROMA_KEY_TOLERANCE;
    const brushSize = Number.isFinite(Number(mattingState.brushSize))
      ? Number(mattingState.brushSize)
      : DEFAULT_MATTING_BRUSH_SIZE;
    const hasImage = !!state.cropper?.imageLoaded;
    const mattingEnabled = mattingState.enabled === true;
    const hasPreview = mattingState.applied === true;
    const isPickingColor = mattingState.colorPicking === true;

    $mattingEnabled.prop('checked', mattingEnabled);
    $mattingColor.val(keyColor);
    $mattingColorText.val(keyColor);
    $mattingTolerance.val(String(tolerance));
    $mattingToleranceValue.text(String(tolerance));
    $mattingBrush.val(String(brushSize));
    $mattingBrushValue.text(`${brushSize}px`);

    $mattingToolButtons.removeClass('active');
    $mattingToolButtons
      .filter(`[data-tool="${state.mattingTool === 'keep' ? 'keep' : 'erase'}"]`)
      .addClass('active');

    $pickMattingColor.toggleClass('active', isPickingColor);

    const disabled = !hasImage;
    $mattingEnabled.prop('disabled', disabled);
    $mattingColor.prop('disabled', disabled || !mattingEnabled);
    $mattingColorText.prop('disabled', disabled || !mattingEnabled);
    $pickMattingColor.prop('disabled', disabled || !mattingEnabled);
    $mattingTolerance.prop('disabled', disabled || !mattingEnabled);
    $applyMatting.prop('disabled', disabled || !mattingEnabled);
    $clearMatting.prop('disabled', disabled || (!mattingEnabled && !hasPreview));
    $mattingBrush.prop('disabled', disabled || !hasPreview);
    $mattingToolButtons.prop('disabled', disabled || !hasPreview);
  };

  const syncCropperPreviewControls = () => {
    if (!state.cropper) return;
    const zoomPercent = Math.round((Number(state.cropper.scale) || 1) * 100);
    const zoomMinPercent = Math.max(1, Math.floor((Number(state.cropper.minScale) || 0.01) * 100));
    const zoomMaxPercent = Math.max(zoomMinPercent, Math.ceil((Number(state.cropper.maxScale) || 5) * 100));
    const cropAspectRatio = Number(state.cropper.getCropAspectRatio?.() || state.cropper.aspectRatio || 1);
    $zoom.attr('min', String(zoomMinPercent));
    $zoom.attr('max', String(zoomMaxPercent));
    $zoom.val(String(zoomPercent));
    $zoomValue.text(`${zoomPercent}%`);
    $cropRatioValue.text(formatAspectRatioLabel(cropAspectRatio));
    syncMattingControls();
  };

  const getCurrentProfileLabel = () => getUiSkinProfileLabel(state.profileId) || '未命名皮肤';

  const syncProfileStatus = () => {
    $profileStatus.text(`当前预览图包：${getPreviewPackId()} · 当前皮肤：${getCurrentProfileLabel()}`);
  };

  const syncProfileSelectOptions = () => {
    const optionHtml = state.profiles
      .map(profile => `<option value="${profile.id}">${profile.displayName}</option>`)
      .join('');
    $profileSelect.html(optionHtml);
    $profileSelect.val(state.profileId || '');
    const hasProfiles = state.profiles.length > 0;
    $profileSelect.prop('disabled', !hasProfiles);
    $pane.find('#gal-custom-skin-profile-rename').prop('disabled', !hasProfiles);
    $pane.find('#gal-custom-skin-profile-duplicate').prop('disabled', !hasProfiles);
    $pane.find('#gal-custom-skin-export-current').prop('disabled', !hasProfiles);
    $pane.find('#gal-custom-skin-profile-delete').prop('disabled', !hasProfiles);
    $pane.find('#gal-custom-skin-export-library').prop('disabled', !hasProfiles);
    syncProfileStatus();
  };

  const syncActiveProfileSetting = async () => {
    if (!state.profileId) return;
    settings.skin = state.profileId;
    saveSettings();
    refreshSkinSelectElement();
    applySettingsToUI();
    await applyCustomSkinRuntime().catch(error => {
      console.warn(`[${SCRIPT_NAME}] sync active custom-skin profile failed:`, error);
    });
  };

  const reloadProfiles = async (preferredProfileId = '') => {
    await refreshUiSkinProfilesCache();
    state.profiles = getCachedUiSkinProfiles();
    if (preferredProfileId && state.profiles.some(profile => profile.id === preferredProfileId)) {
      state.profileId = preferredProfileId;
    } else if (!state.profiles.some(profile => profile.id === state.profileId)) {
      state.profileId = state.profiles[0]?.id || '';
    }
    syncProfileSelectOptions();
    refreshSkinSelectElement();
  };

  const ensureActiveProfile = async () => {
    await reloadProfiles(state.profileId);
    if (state.profileId) return;
    const createdProfile = await createUiSkinProfile({ displayName: '自定义皮肤 1' });
    await reloadProfiles(createdProfile.id);
    setHint('已自动创建第一套自定义皮肤，可以直接开始编辑。', 'ok');
  };

  const switchProfile = async profileId => {
    const safeProfileId = String(profileId || '').trim();
    if (!safeProfileId || !state.profiles.some(profile => profile.id === safeProfileId)) return;
    state.profileId = safeProfileId;
    syncProfileSelectOptions();
    await syncActiveProfileSetting();
    await loadCurrentAsset();
  };

  const clearObjectUrls = () => {
    state.objectUrls.forEach(url => {
      try {
        (topWindow.URL || URL).revokeObjectURL(url);
      } catch (error) {
        // ignore
      }
    });
    state.objectUrls.clear();
  };

  const setCanvasPlaceholder = (text = '未加载图片') => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  };

  const setInputValue = (selector, value) => {
    $pane.find(selector).val(formatInputValue(value));
  };

  const readInputNumber = selector => {
    const raw = String($pane.find(selector).val() || '').trim();
    if (!raw) return null;
    return getNumberValue(raw, null);
  };

  const getCurrentElementDef = () => getCustomSkinElementById(state.elementId) || CUSTOM_SKIN_ELEMENTS[0] || null;
  const isCurrentElementInteractive = () => !!getCurrentElementDef()?.interactive;
  const hasFooterBatchSession = () => state.footerBatchCandidates.length > 0;

  const readMattingSettingsFromControls = () => ({
    enabled: $mattingEnabled.is(':checked'),
    keyColor: normalizeHexColor(String($mattingColorText.val() || $mattingColor.val() || DEFAULT_CHROMA_KEY_COLOR), DEFAULT_CHROMA_KEY_COLOR),
    tolerance: Math.max(0, Math.min(255, Math.round(Number($mattingTolerance.val() || DEFAULT_CHROMA_KEY_TOLERANCE)))),
    brushSize: Math.max(4, Math.min(160, Math.round(Number($mattingBrush.val() || DEFAULT_MATTING_BRUSH_SIZE)))),
  });

  const syncCropperMattingSettings = ({ shouldRender = false, keepPreview = true } = {}) => {
    if (!state.cropper) return readMattingSettingsFromControls();
    const settings = readMattingSettingsFromControls();
    state.cropper.setMattingEnabled(settings.enabled, { shouldRender: false, keepPreview });
    state.cropper.setMattingKeyColor(settings.keyColor, { shouldRender: false });
    state.cropper.setMattingTolerance(settings.tolerance, { shouldRender: false });
    state.cropper.setMattingBrushSize(settings.brushSize, { shouldRender: false });
    state.cropper.setMattingBrushMode(state.mattingTool === 'keep' ? 'keep' : 'erase', { shouldRender: false });
    if (shouldRender) {
      state.cropper.render({ type: 'matting-settings', state: state.cropper.getMattingState?.() });
    }
    return settings;
  };

  const applyMattingPresetToControls = preset => {
    const safeColor = normalizeHexColor(preset?.color, DEFAULT_CHROMA_KEY_COLOR);
    const safeTolerance = Math.max(
      0,
      Math.min(255, Math.round(Number(preset?.tolerance ?? DEFAULT_CHROMA_KEY_TOLERANCE))),
    );
    $mattingEnabled.prop('checked', preset?.enabled === true);
    $mattingColor.val(safeColor);
    $mattingColorText.val(safeColor);
    $mattingTolerance.val(String(safeTolerance));
    $mattingToleranceValue.text(String(safeTolerance));
    $mattingBrush.val(String(DEFAULT_MATTING_BRUSH_SIZE));
    $mattingBrushValue.text(`${DEFAULT_MATTING_BRUSH_SIZE}px`);
    state.mattingTool = 'erase';
    state.lastMattingBrushTool = 'erase';
    state.overlayMode = '';
    syncCropperMattingSettings({ shouldRender: false, keepPreview: false });
  };

  const getEffectiveInteractionMode = () => state.overlayMode || state.editorMode;

  const syncCropperInteractionMode = () => {
    if (!state.cropper) return;
    const nextMode = getEffectiveInteractionMode();
    if (state.cropper.interactionMode !== nextMode) {
      state.cropper.setInteractionMode(nextMode);
      return;
    }
    syncMattingControls();
  };

  const activateMattingTool = nextTool => {
    if (nextTool === 'pick') {
      state.overlayMode = 'pick';
      syncCropperInteractionMode();
      syncMattingControls();
      return;
    }

    state.mattingTool = nextTool === 'keep' ? 'keep' : 'erase';
    state.lastMattingBrushTool = state.mattingTool;
    const hasPreview = !!state.cropper?.hasMattingPreview?.();
    const mattingEnabled = $mattingEnabled.is(':checked');
    state.overlayMode = hasPreview && mattingEnabled ? 'matting' : '';
    syncCropperMattingSettings({ shouldRender: false, keepPreview: true });
    syncCropperInteractionMode();
    syncMattingControls();
  };

  const getModeHelpText = () => {
    if (isFooterBatchMode()) {
      return `底栏固定顺序导入：先识别整条底栏，再按 ${FOOTER_BATCH_FIXED_ORDER_TEXT} 的默认顺序一次性保存。`;
    }
    if (state.overlayMode === 'pick') {
      return '取色模式：在画面上点一下，即可把该像素颜色填入抠图键色。';
    }
    if (state.overlayMode === 'matting') {
      return state.mattingTool === 'keep'
        ? '抠图修补：拖动画笔恢复被误删的组件区域；保存后会输出透明 PNG。'
        : '抠图修补：拖动画笔继续擦除背景色残留；建议先应用抠图再局部修边。';
    }
    if (state.uiState !== 'normal') {
      return state.editorMode === 'hit' && isCurrentElementInteractive()
        ? '当前状态可单独调整命中区；控件框形状继承 normal，若要改框形请切回 normal。'
        : '当前状态沿用 normal 的控件框形状，可拖动画面裁切当前状态图片；如需改框形请切回 normal。';
    }
    if (!isCurrentElementInteractive()) {
      return '当前元素可拖边/角改变控件框形状，框内拖动画面。';
    }
    if (state.editorMode === 'hit') {
      return '命中区模式只影响点击范围：拖动白点调整轮廓，“添加命中点”用于贴合异形按钮。';
    }
    return '裁图模式下可拖边/角改变控件框形状，框内拖动画面；规则矩形按钮通常不需要添加命中点。';
  };

  const getCropWrapperTitle = () => {
    if (isFooterBatchMode()) {
      return `底栏固定顺序导入：候选框只用于预览识别结果，保存时会固定按 ${FOOTER_BATCH_FIXED_ORDER_TEXT} 的顺序处理。`;
    }
    if (state.overlayMode === 'pick') {
      return '点击图片吸取背景纯色。';
    }
    if (state.overlayMode === 'matting') {
      return state.mattingTool === 'keep'
        ? '保留画笔：拖动恢复被误删区域。'
        : '移除画笔：拖动继续擦除背景。';
    }
    if (state.editorMode === 'hit' && isCurrentElementInteractive()) {
      return '命中区模式：拖动白点调整按钮点击范围。';
    }
    if (state.uiState !== 'normal') {
      return '当前状态继承 normal 的控件框形状；可拖动画面裁图，若要改框形请切回 normal。';
    }
    return '裁图模式：拖边/角可改框形，拖蓝框边框可移动整个框，框内拖动画面。';
  };

  const markActiveElementItem = () => {
    $pane.find('.gal-custom-skin-element-item').removeClass('active');
    $pane.find(`.gal-custom-skin-element-item[data-element-id="${state.elementId}"]`).addClass('active');
  };

  const syncDeviceSwitchUI = () => {
    $pane.find('.gal-custom-skin-device-tab').removeClass('active');
    $pane.find(`.gal-custom-skin-device-tab[data-device="${state.device}"]`).addClass('active');
    $deviceSelect.val(state.device);
    $deviceDisplay.val(state.device === 'mobile' ? 'mobile（移动端）' : 'desktop（桌面端）');
  };

  const syncStateOptions = () => {
    const states = getElementStates(state.elementId);
    if (!states.includes(state.uiState)) {
      state.uiState = states[0];
    }
    $stateSelect.html(states.map(item => `<option value="${item}">${item}</option>`).join(''));
    $stateSelect.val(state.uiState);
  };

  const setModeButtons = mode => {
    const footerBatchMode = isFooterBatchMode();
    if (footerBatchMode && mode === 'hit') {
      state.editorMode = 'crop';
    } else if (!isCurrentElementInteractive() && mode === 'hit') {
      state.editorMode = 'crop';
    } else {
      state.editorMode = mode === 'hit' ? 'hit' : 'crop';
    }
    state.overlayMode = '';

    const currentMode = state.editorMode;
    syncCropperInteractionMode();

    $modeButtons.removeClass('active');
    $pane.find(`.gal-custom-skin-mode-btn[data-mode="${currentMode}"]`).addClass('active');

    const interactive = isCurrentElementInteractive() && !footerBatchMode;
    const showHitActions = interactive && currentMode === 'hit';
    $hitModeButton.prop('disabled', !interactive);
    $hitModeButton.attr('title', interactive ? '编辑按钮点击区域' : '当前元素不需要命中区');
    $hitActions.css('display', showHitActions ? 'flex' : 'none');
    $addHitPoint.prop('disabled', !showHitActions);
    $removeHitPoint.prop('disabled', !showHitActions);
    $resetHitPoint.prop('disabled', !showHitActions);
    $modeHelp.text(getModeHelpText());
    $cropWrapper.attr('title', getCropWrapperTitle());
    syncMattingControls();
  };

  const setCropperAspect = (aspectRatioOverride = null) => {
    const def = getCurrentElementDef();
    if (!state.cropper || !def) return;
    const baseAspectRatio = Number(def.aspectRatio || 16 / 9);
    const nextAspectRatio = Number(aspectRatioOverride);
    state.cropper.setBaseAspectRatio(baseAspectRatio);
    state.cropper.applyAspectRatio(
      Number.isFinite(nextAspectRatio) && nextAspectRatio > 0 ? nextAspectRatio : baseAspectRatio,
      { preserveView: true },
    );
    syncCropperPreviewControls();
  };

  const getDefaultPayload = (uiState = state.uiState) => buildDefaultCustomSkinAssetPayload({
    packId: getAssetPackId(),
    skinId: state.profileId,
    elementId: state.elementId,
    device: state.device,
    state: uiState,
  });

  const currentElementUsesRuntimeLayout = () => customSkinElementUsesRuntimeLayout(state.elementId);

  const getLiveRuntimeLayoutSnapshot = (elementId = state.elementId) => {
    if (!customSkinElementUsesRuntimeLayout(elementId)) return null;
    const template = getCustomSkinRuntimeElementRects(state.device)
      .find(item => item?.elementId === elementId && item?.box);
    if (!template?.box) return null;
    return {
      widthRatio: clamp01(template.box.width, 0),
      offsetXRatio: 0,
      offsetYRatio: 0,
      anchorXRatio: 0,
      anchorYRatio: 0,
    };
  };

  const getMergedNormalPayload = () => {
    const baseNormal = getDefaultPayload('normal');
    return mergePayload(baseNormal, state.normalAsset);
  };

  const applyFormValues = payload => {
    const layout = {
      ...(payload?.layout || {}),
      ...(getLiveRuntimeLayoutSnapshot() || {}),
    };
    const textPadding = cloneBox(payload?.textPadding, EMPTY_BOX);

    setInputValue('#gal-custom-skin-width-ratio', layout.widthRatio ?? '');
    setInputValue('#gal-custom-skin-offset-x-ratio', layout.offsetXRatio ?? 0);
    setInputValue('#gal-custom-skin-offset-y-ratio', layout.offsetYRatio ?? 0);
    setInputValue('#gal-custom-skin-anchor-x-ratio', layout.anchorXRatio ?? 0);
    setInputValue('#gal-custom-skin-anchor-y-ratio', layout.anchorYRatio ?? 0);
    setInputValue('#gal-custom-skin-pad-top', textPadding.top ?? 0);
    setInputValue('#gal-custom-skin-pad-right', textPadding.right ?? 0);
    setInputValue('#gal-custom-skin-pad-bottom', textPadding.bottom ?? 0);
    setInputValue('#gal-custom-skin-pad-left', textPadding.left ?? 0);
    $scaleMode.val(payload?.scaleMode || 'stretch');
    $showText.prop('checked', payload?.meta?.showText !== false);
  };

  const readLayoutFromForm = normalBase => {
    const liveRuntimeLayout = getLiveRuntimeLayoutSnapshot();
    if (liveRuntimeLayout) {
      return {
        ...(normalBase.layout || {}),
        ...liveRuntimeLayout,
      };
    }
    return {
      widthRatio: clamp01(readInputNumber('#gal-custom-skin-width-ratio'), clamp01(normalBase.layout?.widthRatio, 0.2)),
      offsetXRatio: readInputNumber('#gal-custom-skin-offset-x-ratio') ?? Number(normalBase.layout?.offsetXRatio || 0),
      offsetYRatio: readInputNumber('#gal-custom-skin-offset-y-ratio') ?? Number(normalBase.layout?.offsetYRatio || 0),
      anchorXRatio: clamp01(readInputNumber('#gal-custom-skin-anchor-x-ratio'), clamp01(normalBase.layout?.anchorXRatio, 0)),
      anchorYRatio: clamp01(readInputNumber('#gal-custom-skin-anchor-y-ratio'), clamp01(normalBase.layout?.anchorYRatio, 0)),
    };
  };

  const readTextPaddingFromForm = normalBase => ({
    top: clamp01(readInputNumber('#gal-custom-skin-pad-top'), clamp01(normalBase.textPadding?.top, 0)),
    right: clamp01(readInputNumber('#gal-custom-skin-pad-right'), clamp01(normalBase.textPadding?.right, 0)),
    bottom: clamp01(readInputNumber('#gal-custom-skin-pad-bottom'), clamp01(normalBase.textPadding?.bottom, 0)),
    left: clamp01(readInputNumber('#gal-custom-skin-pad-left'), clamp01(normalBase.textPadding?.left, 0)),
  });

  const getTransparentContentTarget = () => getCurrentElementDef()?.transparentContentTarget || null;
  const currentElementSupportsTextToggle = () => supportsTextToggle(state.elementId);
  const isFooterBatchMode = () => isFooterBatchEntryElementId(state.elementId) && state.uiState === 'normal';
  const getShowTextTargetIds = () => {
    const rawTargetIds = isFooterBatchMode()
      ? CUSTOM_SKIN_FOOTER_BATCH_TARGET_IDS
      : [state.elementId];
    return rawTargetIds
      .map(targetId => String(targetId || '').trim())
      .filter(targetId => targetId && supportsTextToggle(targetId));
  };
  const resolveSavedShowTextValue = async (packId, token = state.loadToken) => {
    if (!state.profileId || state.uiState !== 'normal') return null;
    const targetIds = getShowTextTargetIds();
    if (targetIds.length === 0) return null;
    const assets = await Promise.all(
      targetIds.map(targetId => getUiSkinAsset(packId, state.profileId, targetId, state.device, 'normal')),
    );
    if (token !== state.loadToken) return undefined;
    const savedValues = assets
      .filter(asset => asset?.meta && Object.prototype.hasOwnProperty.call(asset.meta, 'showText'))
      .map(asset => asset.meta.showText !== false);
    if (savedValues.length === 0) return null;
    return savedValues.every(Boolean);
  };
  const persistShowTextToggle = async showText => {
    if (!state.profileId || state.uiState !== 'normal') {
      return { persistedCount: 0, targetCount: 0 };
    }
    const packId = getAssetPackId();
    const targetIds = getShowTextTargetIds();
    if (targetIds.length === 0) {
      return { persistedCount: 0, targetCount: 0 };
    }
    const existingAssets = await Promise.all(
      targetIds.map(targetId => getUiSkinAsset(packId, state.profileId, targetId, state.device, 'normal')),
    );
    const assetsToSave = existingAssets.flatMap((asset, index) => {
      if (!asset) return [];
      const targetId = targetIds[index];
      const payload = mergePayload(
        buildDefaultCustomSkinAssetPayload({
          packId,
          skinId: state.profileId,
          elementId: targetId,
          device: state.device,
          state: 'normal',
        }),
        asset,
      );
      payload.id = buildUiSkinAssetId(packId, state.profileId, targetId, state.device, 'normal');
      payload.packId = packId;
      payload.skinId = state.profileId;
      payload.elementId = targetId;
      payload.device = state.device;
      payload.state = 'normal';
      payload.meta = {
        ...(payload.meta || {}),
        showText,
        updatedBy: 'custom-skin-text-toggle',
      };
      return [payload];
    });
    if (assetsToSave.length === 0) {
      return { persistedCount: 0, targetCount: targetIds.length };
    }
    await Promise.all(assetsToSave.map(payload => saveUiSkinAsset(payload)));
    if (!isFooterBatchMode()) {
      const currentPayload = assetsToSave.find(payload => payload.elementId === state.elementId) || null;
      if (currentPayload) {
        state.normalAsset = currentPayload;
        state.currentAsset = currentPayload;
      }
    }
    return { persistedCount: assetsToSave.length, targetCount: targetIds.length };
  };
  const clearFooterBatchAssignments = () => {
    state.footerBatchAssignments = {};
    state.footerBatchSelectedCandidateId = '';
  };
  const clearComponentSession = ({
    keepSessionActive = false,
    shouldRender = true,
    clearCropperCandidates = true,
  } = {}) => {
    if (!keepSessionActive) {
      state.componentSessionActive = false;
      state.preserveUploadedImageOnSwitch = false;
    }
    state.componentSessionCandidates = [];
    state.componentSessionSelectedCandidateId = '';
    if (clearCropperCandidates && state.footerBatchCandidates.length === 0) {
      state.cropper?.clearDetectedComponentCandidates(false);
    }
    state.cropper?.setComponentCandidateLabels({}, false);
    state.cropper?.setSelectedComponentCandidate('', { shouldRender: false });
    state.cropper?.setComponentCandidateOverlayEnabled(false, false);
    if (shouldRender) {
      state.cropper?.render();
    }
  };
  const buildComponentSessionLabelLookup = () => {
    const labels = {};
    state.componentSessionCandidates.forEach((candidate, index) => {
      if (!candidate?.id) return;
      labels[candidate.id] = buildComponentCandidateLabel(candidate, index);
    });
    return labels;
  };
  const getSelectedComponentSessionCandidate = () => {
    const selectedCandidateId = String(state.componentSessionSelectedCandidateId || '').trim();
    if (!selectedCandidateId) return null;
    return state.componentSessionCandidates.find(candidate => candidate?.id === selectedCandidateId)
      || state.cropper?.getSelectedComponentCandidate?.()
      || null;
  };
  const syncSelectedCandidateHitAreaToCropper = candidate => {
    const def = getCurrentElementDef();
    if (!state.cropper || !def?.interactive || state.uiState !== 'normal') return;
    const nextHitArea = cloneHitArea({ points: candidate?.hitAreaPoints }, RECT_HIT_AREA);
    state.cropper.setHitAreaPoints(nextHitArea.points);
    $hitOverride.prop('checked', false);
  };
  const buildFooterBatchLabelLookup = () => {
    const labels = {};
    state.footerBatchCandidates.forEach((candidate, index) => {
      if (!candidate?.id) return;
      labels[candidate.id] = FOOTER_BATCH_SLOT_META[index]?.shortLabel || `候选 ${index + 1}`;
    });
    return labels;
  };
  const syncDetectedCandidatesOnCropper = ({ shouldRender = true, syncCropFrame = false } = {}) => {
    if (!state.cropper) return;
    if (isFooterBatchMode() && state.footerBatchCandidates.length > 0) {
      state.cropper.applyDetectedComponentCandidates(state.footerBatchCandidates, {
        shouldRender: false,
        syncCropFrame: false,
        selectedCandidateId: state.footerBatchSelectedCandidateId,
      });
      state.cropper.setComponentCandidateLabels(buildFooterBatchLabelLookup(), false);
      state.cropper.setSelectedComponentCandidate(state.footerBatchSelectedCandidateId, {
        syncCropFrame,
        paddingRatio: COMPONENT_SELECTION_PADDING_RATIO,
        shouldRender: false,
      });
      state.cropper.setComponentCandidateOverlayEnabled(true, false);
    } else if (state.componentSessionCandidates.length > 0) {
      state.cropper.applyDetectedComponentCandidates(state.componentSessionCandidates, {
        shouldRender: false,
        syncCropFrame: false,
        selectedCandidateId: state.componentSessionSelectedCandidateId,
        selectFirstCandidate: false,
      });
      state.cropper.setComponentCandidateLabels(buildComponentSessionLabelLookup(), false);
      state.cropper.setSelectedComponentCandidate(state.componentSessionSelectedCandidateId, {
        syncCropFrame,
        paddingRatio: COMPONENT_SELECTION_PADDING_RATIO,
        shouldRender: false,
      });
      state.cropper.setComponentCandidateOverlayEnabled(state.componentSessionActive === true, false);
    } else {
      state.cropper.clearDetectedComponentCandidates(false);
      state.cropper.setComponentCandidateLabels({}, false);
      state.cropper.setSelectedComponentCandidate('', { shouldRender: false });
      state.cropper.setComponentCandidateOverlayEnabled(false, false);
    }
    if (shouldRender) {
      state.cropper.render();
    }
  };
  const clearFooterBatchSession = ({
    keepCandidates = false,
    shouldRender = true,
    clearCropperCandidates = true,
  } = {}) => {
    clearFooterBatchAssignments();
    if (!keepCandidates) {
      state.footerBatchCandidates = [];
    }
    if (!keepCandidates && clearCropperCandidates && state.componentSessionCandidates.length === 0) {
      state.cropper?.clearDetectedComponentCandidates(false);
    }
    syncDetectedCandidatesOnCropper({ shouldRender });
  };
  const syncFooterBatchCandidatesOnCropper = ({ shouldRender = true, syncCropFrame = false } = {}) => {
    syncDetectedCandidatesOnCropper({ shouldRender, syncCropFrame });
  };
  const syncFooterBatchUI = () => {
    const batchMode = isFooterBatchMode();
    $footerBatchPanel.css('display', batchMode ? 'flex' : 'none');
    $saveCurrentButton.css('display', batchMode ? 'none' : '');
    $saveCurrentButtonLabel.text('保存当前元素');
    if (!batchMode) {
      $saveCurrentButton.prop('disabled', false).attr('title', '');
      return;
    }
    const hasImage = !!state.cropper?.imageLoaded;
    const candidateCount = state.footerBatchCandidates.length;
    const requiredCount = CUSTOM_SKIN_FOOTER_BATCH_TARGET_IDS.length;
    let note = `上传整条底栏图后，点击“识别底栏”，系统会固定按 ${FOOTER_BATCH_FIXED_ORDER_TEXT} 的顺序保存 12 个底栏按钮。`;
    if (!hasImage) {
      note = '请先上传整条底栏图；支持直接用抠图后的透明预览做固定顺序识别。';
    } else if (candidateCount > 0) {
      note = candidateCount >= requiredCount
        ? `已识别 ${candidateCount}/${requiredCount} 个底栏候选框；保存时会固定按 ${FOOTER_BATCH_FIXED_ORDER_TEXT} 的顺序落库。`
        : `当前只识别到 ${candidateCount}/${requiredCount} 个底栏候选框；请换更完整的底栏图后再保存。`;
    }
    $footerBatchNote.text(note);
    $saveCurrentButton
      .prop('disabled', true)
      .attr(
        'title',
        '当前是底栏固定顺序导入页；请只使用右侧“按默认顺序保存”。',
      );
    $footerBatchSave.prop('disabled', candidateCount < requiredCount);
    $footerBatchSave.attr(
      'title',
      candidateCount < requiredCount
        ? `需要先识别满 ${requiredCount} 个底栏按钮，固定顺序为 ${FOOTER_BATCH_FIXED_ORDER_TEXT}`
        : `固定按 ${FOOTER_BATCH_FIXED_ORDER_TEXT} 的顺序保存底栏按钮`,
    );
    syncFooterBatchCandidatesOnCropper({ shouldRender: false });
  };
  const buildFooterBatchRowGroups = candidates => {
    const rows = [];
    [...(Array.isArray(candidates) ? candidates : [])]
      .sort((left, right) => left.centerY - right.centerY || left.centerX - right.centerX)
      .forEach(candidate => {
        const tolerance = Math.max(candidate.box.height, 0.03) * 0.9;
        const row = rows.find(item => Math.abs(item.centerY - candidate.centerY) <= Math.max(item.avgHeight, tolerance));
        if (row) {
          row.items.push(candidate);
          row.centerY = row.items.reduce((sum, item) => sum + item.centerY, 0) / row.items.length;
          row.avgHeight = row.items.reduce((sum, item) => sum + item.box.height, 0) / row.items.length;
          return;
        }
        rows.push({
          centerY: candidate.centerY,
          avgHeight: candidate.box.height,
          items: [candidate],
        });
      });
    return rows
      .map(row => ({
        ...row,
        items: row.items.sort((left, right) => left.centerX - right.centerX),
      }))
      .sort((left, right) => right.items.length - left.items.length || right.centerY - left.centerY);
  };
  const runFooterBatchDetection = ({ auto = false } = {}) => {
    if (!state.cropper?.imageLoaded) {
      if (!auto) {
        showToast('请先上传底栏图片后再批量识别。');
      }
      return false;
    }
    const rawCandidates = state.cropper.detectComponentCandidates({
      minAreaRatio: 0.00045,
      minAspectRatio: 0.7,
      maxHeightRatio: 0.4,
      maxCandidates: 24,
      shouldRender: false,
    });
    if (!Array.isArray(rawCandidates) || rawCandidates.length === 0) {
      clearFooterBatchSession({ keepCandidates: false, shouldRender: false });
      syncFooterBatchUI();
      setHint(
        auto
          ? '图片已加载，但还没有识别到底栏按钮候选框。'
          : '没有识别到底栏按钮候选框，请尽量上传只包含底栏区域的 PNG，或先做纯色抠图。',
        'warn',
      );
      return false;
    }
    const bestRow = buildFooterBatchRowGroups(rawCandidates)[0]?.items || [];
    const candidates = bestRow.slice(0, CUSTOM_SKIN_FOOTER_BATCH_TARGET_IDS.length);
    if (candidates.length === 0) {
      clearFooterBatchSession({ keepCandidates: false, shouldRender: false });
      syncFooterBatchUI();
      setHint('识别到了主体，但没有找到成排的底栏按钮，请换一张更聚焦底栏的图片。', 'warn');
      return false;
    }
    state.footerBatchCandidates = candidates;
    state.cropper.applyDetectedComponentCandidates(candidates, {
      shouldRender: false,
      syncCropFrame: true,
      paddingRatio: COMPONENT_SELECTION_PADDING_RATIO,
    });
    state.footerBatchSelectedCandidateId = candidates[0]?.id || '';
    syncFooterBatchUI();
    syncFooterBatchCandidatesOnCropper();
    if (candidates.length < CUSTOM_SKIN_FOOTER_BATCH_TARGET_IDS.length) {
      setHint(`当前只识别到 ${candidates.length}/${CUSTOM_SKIN_FOOTER_BATCH_TARGET_IDS.length} 个底栏候选框，固定顺序保存已锁定但暂时不可执行。`, 'warn');
      return false;
    }
    setHint(`已识别 ${candidates.length} 个底栏候选框，保存时会固定按 ${FOOTER_BATCH_FIXED_ORDER_TEXT} 的顺序落库。`, 'ok');
    return true;
  };
  const runGeneralComponentDetection = ({ auto = false } = {}) => {
    if (!state.cropper?.imageLoaded) {
      if (!auto) {
        showToast('请先上传图片后再识别组件。');
      }
      return false;
    }
    const templates = getCustomSkinRuntimeElementRects(state.device)
      .filter(template => template?.elementId && template.elementId !== CUSTOM_SKIN_FOOTER_COMMON_ELEMENT_ID);
    const rawCandidates = state.cropper.detectComponentCandidates(buildComponentCandidateDetectionOptions(templates));
    const candidates = classifyComponentCandidates(rawCandidates, templates);
    if (!candidates.length) {
      clearComponentSession({ keepSessionActive: true, shouldRender: false });
      setHint(
        auto
          ? '已应用纯色抠图，但还没有识别到可用组件候选框。'
          : '没有识别到可用组件候选框，请继续修边或手动选择元素。',
        'warn',
      );
      return false;
    }
    state.componentSessionActive = true;
    state.preserveUploadedImageOnSwitch = true;
    state.componentSessionCandidates = candidates;
    state.componentSessionSelectedCandidateId = '';
    syncDetectedCandidatesOnCropper({ shouldRender: false });
    syncCropperPreviewControls();
    const currentElementLabel = getCurrentElementDef()?.label || state.elementId;
    setHint(
      `已识别 ${candidates.length} 个候选框，点击高亮框只会切换当前框选；保存时仍保存到“${currentElementLabel}”。`,
      'ok',
    );
    return true;
  };
  const focusCandidateWithinComponentSession = candidate => {
    const safeCandidateId = String(candidate?.id || '').trim();
    if (!safeCandidateId) return false;
    state.componentSessionActive = true;
    state.preserveUploadedImageOnSwitch = true;
    state.componentSessionSelectedCandidateId = safeCandidateId;
    state.editorMode = 'crop';
    state.overlayMode = '';
    syncDetectedCandidatesOnCropper({ shouldRender: false, syncCropFrame: true });
    syncSelectedCandidateHitAreaToCropper(candidate);
    $saveImage.prop('checked', true);
    syncCropperPreviewControls();
    return true;
  };
  const handleGeneralComponentCandidateSelection = async payload => {
    const selectedCandidateId = String(payload?.candidateId || '').trim();
    if (!selectedCandidateId) return;
    const selectedCandidate = state.componentSessionCandidates.find(candidate => candidate.id === selectedCandidateId)
      || payload?.candidate
      || null;
    if (!selectedCandidate) return;
    state.componentSessionSelectedCandidateId = selectedCandidateId;
    const suggestedElementId = String(selectedCandidate?.suggestedElementId || '').trim();
    const suggestedLabel = String(selectedCandidate?.suggestedElementLabel || getCustomSkinElementById(suggestedElementId)?.label || '').trim();
    focusCandidateWithinComponentSession(selectedCandidate);
    const candidateIndex = Math.max(0, state.componentSessionCandidates.findIndex(candidate => candidate.id === selectedCandidateId)) + 1;
    const currentElementLabel = getCurrentElementDef()?.label || state.elementId;
    setHint(
      suggestedElementId
        ? `已切到候选框 ${candidateIndex}；当前仍是“${currentElementLabel}”，不是“${suggestedLabel || suggestedElementId}”。保存会按当前元素落库。`
        : `已切到候选框 ${candidateIndex}；当前仍是“${currentElementLabel}”，保存会按当前元素落库。`,
      'ok',
    );
  };
  const saveFooterBatchResults = async () => {
    if (!state.profileId) {
      showToast('请先创建自定义皮肤。');
      return;
    }
    const requiredCount = CUSTOM_SKIN_FOOTER_BATCH_TARGET_IDS.length;
    const orderedCandidates = state.footerBatchCandidates
      .slice(0, requiredCount);
    if (orderedCandidates.length < requiredCount) {
      showToast(`当前只识别到 ${orderedCandidates.length}/${requiredCount} 个底栏按钮，不能按默认顺序保存。`);
      return;
    }
    const packId = getAssetPackId();
    const mattingSettings = readMattingSettingsFromControls();
    const footerBaseDef = getCustomSkinElementById(CUSTOM_SKIN_FOOTER_COMMON_ELEMENT_ID);
    const footerBasePayload = buildDefaultCustomSkinAssetPayload({
      packId,
      skinId: state.profileId,
      elementId: CUSTOM_SKIN_FOOTER_COMMON_ELEMENT_ID,
      device: state.device,
      state: 'normal',
    });
    const sharedFooterHeightRatio = Math.max(0.01, Number(footerBasePayload.layout?.widthRatio || 0.11))
      / Math.max(0.01, Number(footerBaseDef?.aspectRatio || 3.3));
    const ordinaryDetectedHeightRatios = orderedCandidates
      .slice(0, CUSTOM_SKIN_FOOTER_BUTTON_TARGET_IDS.length)
      .map((candidate, index) => {
        const targetId = CUSTOM_SKIN_FOOTER_BUTTON_TARGET_IDS[index];
        const def = getCustomSkinElementById(targetId);
        const detectedAspectRatio = Math.max(0.01, Number(candidate?.aspectRatio || def?.aspectRatio || 1));
        const detectedWidthRatio = Math.max(0, Number(candidate?.box?.width) || 0);
        if (detectedWidthRatio <= 0) return 0;
        return detectedWidthRatio / detectedAspectRatio;
      })
      .filter(value => value > 0);
    const sortedDetectedHeights = [...ordinaryDetectedHeightRatios].sort((left, right) => left - right);
    const middleIndex = Math.floor(sortedDetectedHeights.length / 2);
    const referenceDetectedHeightRatio = sortedDetectedHeights.length
      ? (sortedDetectedHeights.length % 2 === 0
        ? (sortedDetectedHeights[middleIndex - 1] + sortedDetectedHeights[middleIndex]) / 2
        : sortedDetectedHeights[middleIndex])
      : sharedFooterHeightRatio;
    const heightAlignedFooterScale = referenceDetectedHeightRatio > 0
      ? (sharedFooterHeightRatio / referenceDetectedHeightRatio)
      : 1;
    const totalDetectedWidthRatio = orderedCandidates.reduce(
      (sum, candidate) => sum + Math.max(0, Number(candidate?.box?.width) || 0),
      0,
    );
    const footerWidthBudget = state.device === 'mobile' ? 0.9 : 0.82;
    const widthBudgetScale = totalDetectedWidthRatio > 0
      ? (footerWidthBudget / totalDetectedWidthRatio)
      : 1;
    const sharedFooterScale = Math.min(1, heightAlignedFooterScale, widthBudgetScale);
    const existingAssets = await Promise.all(
      CUSTOM_SKIN_FOOTER_BATCH_TARGET_IDS.map(targetId => getUiSkinAsset(packId, state.profileId, targetId, state.device, 'normal')),
    );
    for (let index = 0; index < CUSTOM_SKIN_FOOTER_BATCH_TARGET_IDS.length; index += 1) {
      const targetId = CUSTOM_SKIN_FOOTER_BATCH_TARGET_IDS[index];
      const candidate = orderedCandidates[index];
      const def = getCustomSkinElementById(targetId);
      if (!candidate || !def) continue;
      const basePayload = buildDefaultCustomSkinAssetPayload({
        packId,
        skinId: state.profileId,
        elementId: targetId,
        device: state.device,
        state: 'normal',
      });
      const payload = mergePayload(basePayload, existingAssets[index]);
      payload.id = buildUiSkinAssetId(packId, state.profileId, targetId, state.device, 'normal');
      payload.packId = packId;
      payload.skinId = state.profileId;
      payload.elementId = targetId;
      payload.device = state.device;
      payload.state = 'normal';
      const detectedAspectRatio = Math.max(0.01, Number(candidate.aspectRatio || def.aspectRatio || 1));
      const detectedWidthRatio = Math.max(0, Number(candidate.box?.width) || 0);
      const fallbackWidthRatio = Math.max(0.01, Number(basePayload.layout?.widthRatio || 0.11));
      payload.layout = {
        ...(payload.layout || {}),
        widthRatio: Math.min(1, Math.max(0.01, detectedWidthRatio > 0 ? detectedWidthRatio * sharedFooterScale : fallbackWidthRatio)),
        aspectRatioOverride: detectedAspectRatio,
      };
      payload.meta = {
        ...(payload.meta || {}),
        updatedBy: 'custom-skin-footer-batch',
        showText: def.supportsTextToggle === true ? $showText.is(':checked') : true,
      };
      if (def.interactive) {
        payload.meta.hitArea = {
          type: 'polygon',
          points: candidate.hitAreaPoints.map(point => ({ ...point })),
        };
        payload.meta.hitAreaOverride = false;
      }
      if (mattingSettings.enabled) {
        payload.meta.chromaKey = {
          enabled: true,
          color: mattingSettings.keyColor,
          tolerance: mattingSettings.tolerance,
        };
      } else {
        delete payload.meta.chromaKey;
      }
      payload.imageBlob = await state.cropper.exportDetectedComponentCandidateBlob(candidate, Math.max(64, Math.round(def.outputWidth || 512)));
      console.log(`[${SCRIPT_NAME}] saveFooterBatch image export: target=${targetId}, candidate=${candidate.id}, blobSize=${payload.imageBlob?.size || 0}, widthRatio=${payload.layout?.widthRatio || 0}, aspect=${detectedAspectRatio}, sharedScale=${sharedFooterScale}, widthBudget=${footerWidthBudget}`);
      payload.imageUrl = null;
      await saveUiSkinAsset(payload);
    }
    showToast(`已按默认顺序保存 ${CUSTOM_SKIN_FOOTER_BATCH_TARGET_IDS.length} 个底栏按钮资源`);
    await applyCustomSkinRuntime().catch(error => {
      console.warn(`[${SCRIPT_NAME}] refresh custom-skin runtime failed:`, error);
    });
    setHint(`已按固定顺序保存底栏按钮：${FOOTER_BATCH_FIXED_ORDER_TEXT}。`, 'ok');
  };
  const getOpaqueBoundsTarget = () => {
    const def = getCurrentElementDef();
    if (!def || def.interactive || def.transparentContentTarget) return null;
    return 'opaqueBounds';
  };
  const getAutoDetectionMode = () => {
    if (isFooterBatchMode()) return 'footerBatch';
    if (isCurrentElementInteractive()) return 'hitArea';
    return getTransparentContentTarget() || getOpaqueBoundsTarget();
  };

  const updateFormSectionState = () => {
    const hasTransparentContentTarget = !!getTransparentContentTarget();
    $textPaddingSection.css('display', hasTransparentContentTarget ? '' : 'none');
    if (hasTransparentContentTarget) {
      $textPaddingSection.prop('open', true);
    } else {
      $textPaddingSection.prop('open', false);
    }

    const lockLayout = state.uiState !== 'normal';
    const followsRuntimeLayout = state.uiState === 'normal' && currentElementUsesRuntimeLayout();
    $advancedLayoutSection.css('display', followsRuntimeLayout ? 'none' : '');
    if (lockLayout || followsRuntimeLayout) {
      $advancedLayoutSection.prop('open', false);
    }

    const supportsToggle = currentElementSupportsTextToggle();
    $showTextRow.css('display', supportsToggle ? 'flex' : 'none');
    $showText.prop('disabled', !supportsToggle || lockLayout);
    $showText.attr(
      'title',
      !supportsToggle
        ? '当前组件没有可隐藏的文字层'
        : (lockLayout ? '仅 normal 状态可修改组件文字显示' : '关闭后将隐藏组件自带的覆盖文字'),
    );
    syncFooterBatchUI();
  };

  const updateAutoDetectState = () => {
    const target = getAutoDetectionMode();
    const hasImage = !!state.cropper?.imageLoaded;
    if (target === 'footerBatch') {
      const enabled = hasImage && state.uiState === 'normal';
      $autoDetectContent.prop('disabled', !enabled);
      $autoDetectContentLabel.text('识别底栏');
      if (!hasImage) {
        $autoDetectContent.attr('title', '请先上传整条底栏图后再识别');
      } else {
        $autoDetectContent.attr('title', `固定识别 12 个底栏按钮，保存时会按 ${FOOTER_BATCH_FIXED_ORDER_TEXT} 的顺序落库`);
      }
      return;
    }
    const isHitAreaDetection = target === 'hitArea';
    const enabled = !!target && hasImage && (isHitAreaDetection || state.uiState === 'normal');
    $autoDetectContent.prop('disabled', !enabled);
    if (isHitAreaDetection) {
      $autoDetectContentLabel.text('自动识别轮廓');
      if (!hasImage) {
        $autoDetectContent.attr('title', '请先选择图片');
        return;
      }
      $autoDetectContent.attr(
        'title',
        state.uiState === 'normal'
          ? '根据 PNG 透明边缘自动生成按钮命中区，命中点只需微调'
          : '根据 PNG 透明边缘自动生成当前状态命中区；若未勾选，将自动开启状态独立命中区',
      );
      return;
    }

    if (target === 'opaqueBounds') {
      $autoDetectContentLabel.text('自动识别主体');
      if (state.uiState !== 'normal') {
        $autoDetectContent.attr('title', '仅 normal 状态支持自动收紧主体框选');
        return;
      }
      if (!hasImage) {
        $autoDetectContent.attr('title', '请先选择图片');
        return;
      }
      $autoDetectContent.attr(
        'title',
        state.cropper?.hasMattingPreview?.()
          ? '根据纯色抠图后的透明轮廓自动收紧当前组件框选范围'
          : '根据 PNG 透明边缘自动收紧当前组件框选范围',
      );
      return;
    }

    $autoDetectContentLabel.text('自动识别透明区');
    if (!target) {
      $autoDetectContent.attr('title', '当前元素不支持自动识别');
      return;
    }
    if (state.uiState !== 'normal') {
      $autoDetectContent.attr('title', '仅 normal 状态支持自动识别透明内容区');
      return;
    }
    if (!hasImage) {
      $autoDetectContent.attr('title', '请先选择图片');
      return;
    }
    $autoDetectContent.attr(
      'title',
      state.cropper?.hasMattingPreview?.()
        ? '当前自动识别只用于对话框内嵌透明文字区；纯色抠图后的透明背景无需再次识别'
        : '自动识别对话框透明文字区并填充 textPadding',
    );
  };

  const applyAutoDetection = ({ silentUnsupported = false, auto = false } = {}) => {
    const target = getAutoDetectionMode();
    if (!target) {
      if (!silentUnsupported) {
        showToast('当前元素不支持自动识别。');
      }
      return false;
    }
    if (!state.cropper?.imageLoaded) {
      if (!silentUnsupported) {
        showToast('请先选择图片后再自动识别。');
      }
      return false;
    }

    if (target === 'footerBatch') {
      return runFooterBatchDetection({ auto });
    }

    if (target === 'hitArea') {
      if (state.uiState !== 'normal' && !$hitOverride.is(':checked')) {
        $hitOverride.prop('checked', true);
      }
      const detection = state.cropper.detectOpaqueHitArea({
        outputWidth: Math.min(768, Math.max(256, Math.round(getCurrentElementDef()?.outputWidth || 512))),
      });
      if (!detection) {
        setHint(
          auto
            ? '图片已加载，但没有识别到有效轮廓，可切到命中区模式手动调整。'
            : '没有识别到有效轮廓，请检查 PNG 是否带透明边并确保主体与背景分离。',
          'warn',
        );
        return false;
      }

      setHint(
        state.uiState === 'normal'
          ? '已根据透明边缘自动生成按钮命中区，可切到“命中区模式”微调。'
          : '已根据透明边缘自动生成当前状态命中区，并自动开启状态独立命中区。',
        'ok',
      );
      return true;
    }

    if (target === 'opaqueBounds') {
      if (state.uiState !== 'normal') {
        if (!silentUnsupported) {
          showToast('主体轮廓自动识别仅支持 normal 状态。');
        }
        return false;
      }
      const detection = state.cropper.detectOpaqueContentBox({
        outputWidth: Math.min(1024, Math.max(256, Math.round(getCurrentElementDef()?.outputWidth || 512))),
      });
      if (!detection) {
        setHint(
          auto
            ? '图片已加载，但没有识别到清晰主体，可继续手动裁图。'
            : '没有识别到清晰主体，请检查 PNG 透明边缘或先执行纯色抠图。',
          'warn',
        );
        return false;
      }
      state.cropper.applyContentBoxToCropFrame(detection.box, { paddingRatio: 0.01 });
      syncCropperPreviewControls();
      setHint('已根据主体透明轮廓自动收紧当前组件框选范围，可继续微调。', 'ok');
      return true;
    }

    if (state.uiState !== 'normal') {
      if (!silentUnsupported) {
        showToast('透明内容区自动识别仅支持 normal 状态。');
      }
      return false;
    }

    const detection = state.cropper.detectTransparentContentBox({
      outputWidth: Math.min(1024, Math.max(256, Math.round(getCurrentElementDef()?.outputWidth || 512))),
    });
    if (!detection) {
      const hasMattingPreview = state.cropper?.hasMattingPreview?.() === true;
      setHint(
        hasMattingPreview
          ? '纯色抠图已生成透明预览；当前“自动识别透明区”仅用于对话框内部文字窗口，不影响透明背景。'
          : auto
            ? '图片已加载，但没有识别到封闭透明区域，可手动调整比例参数。'
            : '没有识别到封闭透明区域，请检查 PNG 是否包含内嵌透明窗口。',
        'warn',
      );
      return false;
    }

    setInputValue('#gal-custom-skin-pad-top', detection.insets.top);
    setInputValue('#gal-custom-skin-pad-right', detection.insets.right);
    setInputValue('#gal-custom-skin-pad-bottom', detection.insets.bottom);
    setInputValue('#gal-custom-skin-pad-left', detection.insets.left);
    setHint('已根据透明 PNG 自动填充对话框文字区内边距。', 'ok');
    return true;
  };

  const updateEditableState = () => {
    const lockLayout = state.uiState !== 'normal';
    const lockRuntimeLayout = state.uiState === 'normal' && currentElementUsesRuntimeLayout();
    const footerBatchMode = isFooterBatchMode();
    const normalStateFields = [
      '#gal-custom-skin-scale-mode',
      '#gal-custom-skin-pad-top',
      '#gal-custom-skin-pad-right',
      '#gal-custom-skin-pad-bottom',
      '#gal-custom-skin-pad-left',
      '#gal-custom-skin-show-text',
    ];
    const advancedLayoutFields = [
      '#gal-custom-skin-width-ratio',
      '#gal-custom-skin-offset-x-ratio',
      '#gal-custom-skin-offset-y-ratio',
      '#gal-custom-skin-anchor-x-ratio',
      '#gal-custom-skin-anchor-y-ratio',
    ];
    normalStateFields.forEach(selector => {
      $pane.find(selector).prop('disabled', lockLayout);
    });
    advancedLayoutFields.forEach(selector => {
      $pane.find(selector)
        .prop('disabled', lockLayout || lockRuntimeLayout)
        .attr('title', lockRuntimeLayout ? '对话框默认跟随当前主题的真实大小与位置，无需手动调整这些比例。' : '');
    });
    const allowHitOverride = isCurrentElementInteractive() && state.uiState !== 'normal';
    $hitOverrideRow.css('display', isCurrentElementInteractive() ? 'flex' : 'none');
    $hitOverride.prop('disabled', !allowHitOverride);
    $hitOverride.attr(
      'title',
      isCurrentElementInteractive()
        ? (allowHitOverride ? '为当前按钮状态单独保存命中区' : '仅 hover / active 状态可单独保存命中区')
        : '当前元素不需要命中区',
    );
    if (!allowHitOverride) {
      $hitOverride.prop('checked', false);
    }
    if (footerBatchMode && state.editorMode === 'hit') {
      state.editorMode = 'crop';
    }
    updateFormSectionState();
    state.cropper?.setCropFrameEditable(!lockLayout);
    setModeButtons(state.editorMode);
    syncDetectedCandidatesOnCropper({ shouldRender: false });
    updateAutoDetectState();
    syncMattingControls();
    syncFooterBatchUI();
  };

  const loadImageIntoCropper = async (source, shouldSaveImage, options = {}) => {
    if (!state.cropper) return;
    try {
      clearComponentSession({ keepSessionActive: false, shouldRender: false });
      clearFooterBatchSession({ keepCandidates: false, shouldRender: false, clearCropperCandidates: false });
      await state.cropper.loadImage(source);
      state.overlayMode = '';
      syncCropperMattingSettings({ shouldRender: false, keepPreview: false });
      syncCropperPreviewControls();
      $saveImage.prop('checked', !!shouldSaveImage);
      updateAutoDetectState();
      const canAutoDetect = !!options.autoDetectAfterLoad
        && !!getAutoDetectionMode()
        && (isCurrentElementInteractive() || state.uiState === 'normal');
      const detected = canAutoDetect
        ? applyAutoDetection({ silentUnsupported: true, auto: true })
        : false;
      if (!detected && !canAutoDetect) {
        setHint(
          isCurrentElementInteractive()
            ? '图片已加载，可以继续调整裁图和命中区。'
            : '图片已加载，可以继续调整裁图和比例参数。',
          'ok',
        );
      }
    } catch (error) {
      console.warn(`[${SCRIPT_NAME}] custom-skin editor image load failed:`, error);
      clearComponentSession({ keepSessionActive: false, shouldRender: false });
      clearFooterBatchSession({ keepCandidates: false, shouldRender: false, clearCropperCandidates: false });
      state.cropper.clearImage();
      syncCropperPreviewControls();
      setCanvasPlaceholder('图片加载失败');
      updateAutoDetectState();
      setHint('图片加载失败，请更换图片。', 'err');
    }
  };

  const resolvePreviewAsset = () => {
    if (state.uiState === 'normal') {
      return state.normalAsset;
    }
    if (state.currentAsset?.imageBlob || state.currentAsset?.imageUrl) {
      return state.currentAsset;
    }
    return state.normalAsset;
  };

  const performLoadCurrentAsset = async (options = {}) => {
    const preserveUploadedImage = options.preserveUploadedImage === true && state.cropper?.imageLoaded === true;
    const preserveComponentSession = preserveUploadedImage
      && options.preserveComponentSession === true
      && state.componentSessionActive === true;
    state.preserveUploadedImageOnSwitch = preserveUploadedImage;
    if (preserveComponentSession) {
      clearFooterBatchSession({ keepCandidates: false, shouldRender: false, clearCropperCandidates: false });
    } else {
      clearComponentSession({ keepSessionActive: false, shouldRender: false });
      clearFooterBatchSession({ keepCandidates: false, shouldRender: false, clearCropperCandidates: false });
    }
    if (!state.profileId) {
      state.normalAsset = null;
      state.currentAsset = null;
      setCanvasPlaceholder('请先创建自定义皮肤');
      setHint('当前还没有可编辑的自定义皮肤，请先新建。', 'warn');
      return;
    }
    const token = ++state.loadToken;
    const packId = getAssetPackId();
    const defaultNormal = getDefaultPayload('normal');
    const defaultCurrent = getDefaultPayload(state.uiState);
    if (!preserveUploadedImage) {
      clearObjectUrls();
    }

    const requests = [
      getUiSkinAsset(packId, state.profileId, state.elementId, state.device, 'normal'),
      state.uiState === 'normal'
        ? Promise.resolve(null)
        : getUiSkinAsset(packId, state.profileId, state.elementId, state.device, state.uiState),
    ];
    const [normalAsset, currentAsset] = await Promise.all(requests);
    if (token !== state.loadToken) return;

    state.normalAsset = normalAsset;
    state.currentAsset = state.uiState === 'normal' ? normalAsset : currentAsset;

    const mergedNormal = mergePayload(defaultNormal, normalAsset);
    const mergedCurrent = state.uiState === 'normal'
      ? mergedNormal
      : mergePayload(defaultCurrent, currentAsset);

    setCropperAspect(mergedNormal.layout?.aspectRatioOverride);
    applyFormValues(mergedNormal);
    const savedShowText = await resolveSavedShowTextValue(packId, token);
    if (token !== state.loadToken) return;
    if (savedShowText !== null && savedShowText !== undefined) {
      $showText.prop('checked', savedShowText);
    }
    updateEditableState();

    const useStateHitArea = state.uiState !== 'normal'
      && mergedCurrent.meta?.hitAreaOverride === true;
    const hitArea = useStateHitArea
      ? cloneHitArea(mergedCurrent.meta?.hitArea, mergedNormal.meta?.hitArea || RECT_HIT_AREA)
      : cloneHitArea(mergedNormal.meta?.hitArea, RECT_HIT_AREA);
    state.cropper.setHitAreaPoints(hitArea.points);
    $hitOverride.prop('checked', useStateHitArea);

    if (preserveUploadedImage) {
      state.overlayMode = '';
      syncCropperInteractionMode();
      syncDetectedCandidatesOnCropper({ shouldRender: false });
      syncCropperPreviewControls();
      updateAutoDetectState();
      return;
    }

    const previewAsset = resolvePreviewAsset();
    const previewMattingPreset = previewAsset?.meta?.chromaKey
      || mergedCurrent.meta?.chromaKey
      || mergedNormal.meta?.chromaKey
      || null;
    applyMattingPresetToControls({
      enabled: previewMattingPreset?.enabled === true,
      color: previewMattingPreset?.color,
      tolerance: previewMattingPreset?.tolerance,
    });
    if (previewAsset?.imageBlob) {
      const objectUrl = (topWindow.URL || URL).createObjectURL(previewAsset.imageBlob);
      state.objectUrls.add(objectUrl);
      await loadImageIntoCropper(objectUrl, false);
    } else if (previewAsset?.imageUrl) {
      await loadImageIntoCropper(previewAsset.imageUrl, false);
    } else {
      state.cropper.clearImage();
      state.overlayMode = '';
      clearComponentSession({ keepSessionActive: false, shouldRender: false, clearCropperCandidates: false });
      clearFooterBatchSession({ keepCandidates: false, shouldRender: false, clearCropperCandidates: false });
      syncCropperPreviewControls();
      setCanvasPlaceholder('当前元素尚未设置图片');
      $saveImage.prop('checked', false);
      updateAutoDetectState();
      setHint('当前元素暂无图片，可仅保存比例参数或上传图片。', 'warn');
    }
  };
  const loadCurrentAsset = async (options = {}) => {
    const pendingLoad = performLoadCurrentAsset(options);
    state.pendingAssetLoad = pendingLoad;
    try {
      await pendingLoad;
    } finally {
      if (state.pendingAssetLoad === pendingLoad) {
        state.pendingAssetLoad = null;
      }
    }
  };

    const saveCurrent = async () => {
      if (!state.profileId) {
        const message = '请先创建自定义皮肤。';
        showToast(message);
        setHint(message, 'warn');
        return;
      }
      if (isFooterBatchMode()) {
        const message = '当前是底栏固定顺序导入页；请使用右侧“按默认顺序保存”。';
        showToast(message);
        setHint(message, 'warn');
        return;
      }
      if (state.pendingAssetLoad) {
        await state.pendingAssetLoad;
      }
      const def = getCurrentElementDef();
      if (!def) return;
    const packId = getAssetPackId();
    const mergedNormal = getMergedNormalPayload();
    const existingCurrent = state.uiState === 'normal'
      ? state.normalAsset
      : (state.currentAsset || await getUiSkinAsset(packId, state.profileId, state.elementId, state.device, state.uiState));

    const payload = {
      id: buildUiSkinAssetId(packId, state.profileId, state.elementId, state.device, state.uiState),
      packId,
      skinId: state.profileId,
      elementId: state.elementId,
      device: state.device,
      state: state.uiState,
      scaleMode: state.uiState === 'normal'
        ? String($scaleMode.val() || mergedNormal.scaleMode || 'stretch').trim() || 'stretch'
        : String(mergedNormal.scaleMode || 'stretch').trim() || 'stretch',
      layout: state.uiState === 'normal'
        ? readLayoutFromForm(mergedNormal)
        : { ...(mergedNormal.layout || {}) },
      slice: existingCurrent?.slice && typeof existingCurrent.slice === 'object'
        ? { ...existingCurrent.slice }
        : (mergedNormal.slice && typeof mergedNormal.slice === 'object' ? { ...mergedNormal.slice } : { ...EMPTY_BOX }),
      textPadding: state.uiState === 'normal'
        ? readTextPaddingFromForm(mergedNormal)
        : cloneBox(mergedNormal.textPadding, EMPTY_BOX),
      meta: {
        ...(existingCurrent?.meta && typeof existingCurrent.meta === 'object' ? existingCurrent.meta : {}),
        showText: currentElementSupportsTextToggle()
          ? (state.uiState === 'normal'
            ? $showText.is(':checked')
            : mergedNormal.meta?.showText !== false)
          : true,
        updatedBy: 'custom-skin-editor',
      },
    };
    const mattingSettings = readMattingSettingsFromControls();
    const selectedComponentCandidate = state.componentSessionActive === true
      ? getSelectedComponentSessionCandidate()
      : null;

    if (def.interactive && state.uiState === 'normal') {
      if (selectedComponentCandidate?.hitAreaPoints?.length >= 3) {
        syncSelectedCandidateHitAreaToCropper(selectedComponentCandidate);
      }
      payload.meta.hitArea = {
        type: 'polygon',
        points: state.cropper.getHitAreaPoints(),
      };
      payload.meta.hitAreaOverride = false;
    } else if (def.interactive && $hitOverride.is(':checked')) {
      payload.meta.hitArea = {
        type: 'polygon',
        points: state.cropper.getHitAreaPoints(),
      };
      payload.meta.hitAreaOverride = true;
    } else {
      delete payload.meta.hitArea;
      payload.meta.hitAreaOverride = false;
    }

    if (mattingSettings.enabled) {
      payload.meta.chromaKey = {
        enabled: true,
        color: mattingSettings.keyColor,
        tolerance: mattingSettings.tolerance,
      };
    } else {
      delete payload.meta.chromaKey;
    }

    const shouldSaveImage = $saveImage.is(':checked');
    console.log(`[${SCRIPT_NAME}] saveCurrent 诊断: shouldSaveImage=${shouldSaveImage}, imageLoaded=${state.cropper.imageLoaded}, componentSessionActive=${state.componentSessionActive}, selectedCandidate=${selectedComponentCandidate?.id || 'none'}, hasMattingPreview=${state.cropper?.hasMattingPreview?.()}, elementId=${state.elementId}`);
    const cropAspectRatio = Number(state.cropper?.getCropAspectRatio?.() || def.aspectRatio || 1);
    if (state.uiState === 'normal' && Number.isFinite(cropAspectRatio) && cropAspectRatio > 0) {
      payload.layout.aspectRatioOverride = cropAspectRatio;
    } else if (Number.isFinite(Number(mergedNormal.layout?.aspectRatioOverride)) && Number(mergedNormal.layout.aspectRatioOverride) > 0) {
      payload.layout.aspectRatioOverride = Number(mergedNormal.layout.aspectRatioOverride);
    } else {
      delete payload.layout.aspectRatioOverride;
    }
    if (shouldSaveImage && state.cropper.imageLoaded) {
      const componentOutputWidth = Math.max(64, Math.round(def.outputWidth || 512));
      // 优先保存当前画布里正在预览的裁剪结果，避免抠图后点选组件时落库内容和预览不一致。
      payload.imageBlob = await state.cropper.getCroppedBlob(componentOutputWidth);
      if (!payload.imageBlob && selectedComponentCandidate?.id) {
        payload.imageBlob = await state.cropper.exportDetectedComponentCandidateBlob(selectedComponentCandidate.id, componentOutputWidth);
      }
      console.log(`[${SCRIPT_NAME}] saveCurrent image export: element=${state.elementId}, candidate=${selectedComponentCandidate?.id || 'none'}, blobSize=${payload.imageBlob?.size || 0}`);
      payload.imageUrl = null;
    } else if (shouldSaveImage) {
      const message = '请先选择图片，或取消“保存当前裁图后的图片”。';
      showToast(message);
      setHint(message, 'warn');
      return;
    } else if (existingCurrent?.imageBlob || existingCurrent?.imageUrl) {
      payload.imageBlob = existingCurrent.imageBlob || null;
      payload.imageUrl = existingCurrent.imageUrl || null;
    } else {
      payload.imageBlob = null;
      payload.imageUrl = null;
    }

    await saveUiSkinAsset(payload);
    const savedRecord = await getUiSkinAsset(packId, state.profileId, state.elementId, state.device, state.uiState);
    console.log(`[${SCRIPT_NAME}] saveCurrent readback: element=${state.elementId}, state=${state.uiState}, blobSize=${savedRecord?.imageBlob?.size || 0}, updatedAt=${savedRecord?.updatedAt || 'none'}`);
    if (state.uiState === 'normal') {
      state.normalAsset = payload;
      state.currentAsset = payload;
    } else {
      state.currentAsset = payload;
    }
    const shouldExitComponentSessionAfterSave = state.componentSessionActive === true;
    if (shouldExitComponentSessionAfterSave) {
      await loadCurrentAsset();
    }
    showToast(`已保存：${def.label} [${state.device}/${state.uiState}]`);
    await applyCustomSkinRuntime().catch(error => {
      console.warn(`[${SCRIPT_NAME}] refresh custom-skin runtime failed:`, error);
    });
    setHint('已保存当前元素；本次会话中的抠图修补会继续保留，切换元素或关闭面板后失效。', 'ok');
  };

  const resetCurrent = async () => {
    if (!state.profileId) return;
    const def = getCurrentElementDef();
    const ok = topWindow.confirm(`确定重置“${def?.label || state.elementId}”当前设备/状态配置吗？`);
    if (!ok) return;
    await deleteUiSkinAsset(getAssetPackId(), state.profileId, state.elementId, state.device, state.uiState);
    clearFooterBatchSession({ keepCandidates: false, shouldRender: false });
    showToast(`已重置：${def?.label || state.elementId}`);
    await applyCustomSkinRuntime().catch(error => {
      console.warn(`[${SCRIPT_NAME}] refresh custom-skin runtime failed:`, error);
    });
    await loadCurrentAsset();
  };

  const bindElementAndStateChanges = () => {
    $elementSelect.on('change', async function () {
      state.elementId = String($(this).val() || '').trim() || state.elementId;
      syncStateOptions();
      markActiveElementItem();
      await loadCurrentAsset();
    });

    $stateSelect.on('change', async function () {
      state.uiState = String($(this).val() || 'normal').trim() || 'normal';
      updateEditableState();
      await loadCurrentAsset();
    });

    $pane.find('.gal-custom-skin-element-item').on('click', function () {
      const nextElementId = String($(this).attr('data-element-id') || '').trim();
      if (!nextElementId) return;
      state.elementId = nextElementId;
      $elementSelect.val(nextElementId);
      syncStateOptions();
      markActiveElementItem();
      loadCurrentAsset();
    });

    const switchDevice = async nextDevice => {
      if (nextDevice !== 'desktop' && nextDevice !== 'mobile') return;
      state.device = nextDevice;
      syncDeviceSwitchUI();
      setCustomSkinRuntimePreviewDevice(nextDevice);
      await applyCustomSkinRuntime().catch(error => {
        console.warn(`[${SCRIPT_NAME}] custom-skin preview device refresh failed:`, error);
      });
      await loadCurrentAsset();
      setHint(`已切换到${nextDevice === 'mobile' ? '移动端' : '桌面端'}资源。`, 'ok');
    };

    $deviceSelect.on('change', function () {
      switchDevice(String($(this).val() || 'desktop').trim() || 'desktop');
    });

    $pane.find('.gal-custom-skin-device-tab').on('click', function () {
      const nextDevice = String($(this).attr('data-device') || '').trim();
      if (nextDevice === state.device) return;
      switchDevice(nextDevice);
    });

    $showText.on('change', function () {
      const showText = $(this).is(':checked');
      const targetIds = getShowTextTargetIds();
      if (targetIds.length === 0) return;
      previewCustomSkinTextVisibility(targetIds, showText);
      persistShowTextToggle(showText)
        .then(async ({ persistedCount }) => {
          if (persistedCount > 0) {
            await applyCustomSkinRuntime().catch(error => {
              console.warn(`[${SCRIPT_NAME}] refresh custom-skin runtime after text toggle failed:`, error);
            });
          }
          setHint(
            persistedCount > 0
              ? `组件文字已立即${showText ? '显示' : '隐藏'}，并已自动记住当前设置。`
              : `组件文字已立即${showText ? '显示' : '隐藏'}，当前无需再点保存。`,
            'ok',
          );
        })
        .catch(error => {
          console.error(`[${SCRIPT_NAME}] toggle custom-skin text visibility failed:`, error);
          setHint(`切换文字显示失败：${error.message || error}`, 'err');
          showToast(`切换文字显示失败: ${error.message || error}`);
        });
    });
  };

  const bindPreviewActions = () => {
    bindPaneButton('#gal-custom-skin-desktop-preview-toggle', () => {
      setDesktopPreviewActive(true);
    });

    $desktopPreviewFab.off('click.customSkinPreview').on('click.customSkinPreview', event => {
      event.preventDefault();
      event.stopPropagation();
      setDesktopPreviewActive(false);
    });

    bindPaneButton('#gal-custom-skin-select-image', () => {
      $imageInput.get(0)?.click();
    });

    $imageInput.on('change', async function () {
      const file = this.files?.[0];
      if (!file) return;
      await loadImageIntoCropper(file, true, { autoDetectAfterLoad: true });
      this.value = '';
    });

    $pane.find('#gal-custom-skin-reset-crop').on('click', () => {
      if (!state.cropper || !state.cropper.imageLoaded) return;
      state.cropper.reset();
      syncCropperPreviewControls();
      const canAutoDetect = !!getAutoDetectionMode() && (isCurrentElementInteractive() || state.uiState === 'normal');
      if (!canAutoDetect || !applyAutoDetection({ silentUnsupported: true, auto: true })) {
        if (canAutoDetect) return;
        setHint(
          isCurrentElementInteractive()
            ? '已重置裁图，可以继续调整图片位置与命中区。'
            : '已重置裁图，可以继续调整图片位置与比例参数。',
          'ok',
        );
      }
    });

    $pane.find('#gal-custom-skin-auto-detect-content').on('click', () => {
      applyAutoDetection();
    });

    $mattingEnabled.on('change', function () {
      const enabled = $(this).is(':checked');
      syncCropperMattingSettings({ shouldRender: false, keepPreview: enabled });
      if (!enabled) {
        state.overlayMode = '';
        clearComponentSession({ keepSessionActive: false, shouldRender: false });
        state.cropper.clearMatting(false);
        clearFooterBatchSession({ keepCandidates: false, shouldRender: false, clearCropperCandidates: false });
        syncCropperInteractionMode();
        syncCropperPreviewControls();
        setHint('已关闭纯色抠图，当前预览恢复为原图。', 'ok');
        return;
      }
      syncCropperInteractionMode();
      syncCropperPreviewControls();
      setHint('已启用纯色抠图，设置键色后点击“应用抠图”。', 'ok');
    });

    const syncMattingColorInputs = rawColor => {
      const color = normalizeHexColor(rawColor, DEFAULT_CHROMA_KEY_COLOR);
      $mattingColor.val(color);
      $mattingColorText.val(color);
      syncCropperMattingSettings({ shouldRender: false, keepPreview: true });
      syncMattingControls();
      return color;
    };

    $mattingColor.on('input change', function () {
      syncMattingColorInputs($(this).val());
    });

    $mattingColorText.on('change blur', function () {
      syncMattingColorInputs($(this).val());
    });

    $pane.find('.gal-custom-skin-color-chip').on('click', function () {
      if ($(this).prop('disabled')) return;
      const color = String($(this).attr('data-color') || DEFAULT_CHROMA_KEY_COLOR).trim();
      syncMattingColorInputs(color);
      setHint(`已切换抠图键色为 ${color}。`, 'ok');
    });

    $pickMattingColor.on('click', () => {
      if ($pickMattingColor.prop('disabled')) return;
      state.overlayMode = state.overlayMode === 'pick' ? '' : 'pick';
      if (state.overlayMode === 'pick') {
        setHint('已进入取色模式，请点击画面中的纯色背景。', 'ok');
      } else {
        setHint('已退出取色模式。', 'ok');
      }
      syncCropperInteractionMode();
      $modeHelp.text(getModeHelpText());
      $cropWrapper.attr('title', getCropWrapperTitle());
      syncMattingControls();
    });

    $mattingTolerance.on('input change', function () {
      const value = Math.max(0, Math.min(255, Math.round(Number($(this).val() || DEFAULT_CHROMA_KEY_TOLERANCE))));
      $mattingToleranceValue.text(String(value));
      syncCropperMattingSettings({ shouldRender: false, keepPreview: true });
    });

    $pane.find('#gal-custom-skin-apply-matting').on('click', () => {
      if ($applyMatting.prop('disabled')) return;
      const settings = syncCropperMattingSettings({ shouldRender: false, keepPreview: true });
      clearComponentSession({ keepSessionActive: false, shouldRender: false });
      clearFooterBatchSession({ keepCandidates: false, shouldRender: false, clearCropperCandidates: false });
      const result = state.cropper.applyChromaKey({
        color: settings.keyColor,
        tolerance: settings.tolerance,
      });
      if (!result) {
        setHint('当前没有可抠图的图片，请先上传图片。', 'warn');
        return;
      }
      state.mattingTool = state.lastMattingBrushTool || 'erase';
      state.overlayMode = '';
      setModeButtons('crop');
      syncCropperMattingSettings({ shouldRender: false, keepPreview: true });
      syncCropperInteractionMode();
      syncCropperPreviewControls();
      const detected = isFooterBatchMode()
        ? runFooterBatchDetection({ auto: true })
        : runGeneralComponentDetection({ auto: true });
      if (!detected) {
        setHint('已应用纯色抠图，并自动切回裁图模式；如需修边，可再点保留/移除画笔。', 'ok');
      }
    });

    $pane.find('#gal-custom-skin-clear-matting').on('click', () => {
      if ($clearMatting.prop('disabled')) return;
      state.overlayMode = '';
      clearComponentSession({ keepSessionActive: false, shouldRender: false });
      state.cropper.clearMatting(false);
      clearFooterBatchSession({ keepCandidates: false, shouldRender: false, clearCropperCandidates: false });
      syncCropperInteractionMode();
      syncCropperPreviewControls();
      setHint('已清除当前会话的抠图预览，恢复为原图。', 'ok');
    });

    $mattingBrush.on('input change', function () {
      const value = Math.max(4, Math.min(160, Math.round(Number($(this).val() || DEFAULT_MATTING_BRUSH_SIZE))));
      $mattingBrushValue.text(`${value}px`);
      syncCropperMattingSettings({ shouldRender: false, keepPreview: true });
    });

    $mattingToolButtons.on('click', function () {
      if ($(this).prop('disabled')) return;
      const tool = String($(this).attr('data-tool') || 'erase').trim();
      activateMattingTool(tool === 'keep' ? 'keep' : 'erase');
      setHint(
        tool === 'keep'
          ? '保留画笔已激活，可恢复被误删的组件区域。'
          : '移除画笔已激活，可继续擦除残留背景。',
        'ok',
      );
      $modeHelp.text(getModeHelpText());
      $cropWrapper.attr('title', getCropWrapperTitle());
    });

    $zoom.on('input', function () {
      if (!state.cropper) return;
      const min = Math.max(1, Math.floor((Number(state.cropper.minScale) || 0.01) * 100));
      const max = Math.max(min, Math.ceil((Number(state.cropper.maxScale) || 5) * 100));
      const value = Math.max(min, Math.min(max, Number($(this).val() || 100)));
      state.cropper.setScale(value / 100);
      syncCropperPreviewControls();
    });

    $modeButtons.on('click', function () {
      if ($(this).prop('disabled')) return;
      const mode = String($(this).attr('data-mode') || 'crop').trim();
      setModeButtons(mode === 'hit' ? 'hit' : 'crop');
    });

    $addHitPoint.on('click', () => {
      if ($addHitPoint.prop('disabled')) return;
      state.cropper.addHitAreaPoint();
    });

    $removeHitPoint.on('click', () => {
      if ($removeHitPoint.prop('disabled')) return;
      if (!state.cropper.removeSelectedHitAreaPoint()) {
        showToast('至少保留 3 个点才能形成有效命中区。');
      }
    });

    $resetHitPoint.on('click', () => {
      if ($resetHitPoint.prop('disabled')) return;
      state.cropper.resetHitAreaPoints();
    });
  };

  const bindFormActions = () => {
    bindPaneButton('#gal-custom-skin-footer-batch-save', () => {
      saveFooterBatchResults().catch(error => {
        console.error(`[${SCRIPT_NAME}] save footer batch assets failed:`, error);
        showToast(`批量保存失败: ${error.message || error}`);
      });
    });

    bindPaneButton('#gal-custom-skin-save-current', () => {
      saveCurrent().catch(error => {
        console.error(`[${SCRIPT_NAME}] save custom-skin asset failed:`, error);
        setHint(`保存失败：${error.message || error}`, 'err');
        showToast(`保存失败: ${error.message || error}`);
      });
    });

    bindPaneButton('#gal-custom-skin-reload-current', async () => {
      try {
        await loadCurrentAsset();
        const def = getCurrentElementDef();
        if (!def) return;
        setHint('已重新加载当前元素配置。', 'ok');
        showToast(`已重新加载：${def.label} [${state.device}/${state.uiState}]`);
      } catch (error) {
        console.error(`[${SCRIPT_NAME}] reload custom-skin asset failed:`, error);
        setHint(`重新加载失败：${error.message || error}`, 'err');
        showToast(`重新加载失败: ${error.message || error}`);
      }
    });

    bindPaneButton('#gal-custom-skin-reset-current', () => {
      resetCurrent().catch(error => {
        console.error(`[${SCRIPT_NAME}] reset custom-skin asset failed:`, error);
        setHint(`重置失败：${error.message || error}`, 'err');
        showToast(`重置失败: ${error.message || error}`);
      });
    });

    bindPaneButton('#gal-custom-skin-reload-runtime', () => {
      setCustomSkinRuntimePreviewDevice(state.device);
      applyCustomSkinRuntime()
        .then(() => {
          setHint('已刷新自定义皮肤预览。', 'ok');
          showToast('已刷新自定义皮肤预览');
        })
        .catch(error => {
          console.error(`[${SCRIPT_NAME}] refresh custom-skin preview failed:`, error);
          setHint(`刷新失败：${error.message || error}`, 'err');
          showToast(`刷新失败: ${error.message || error}`);
        });
    });
  };

  const bindProfileActions = () => {
    $profileSelect.on('change', function () {
      const nextProfileId = String($(this).val() || '').trim();
      switchProfile(nextProfileId).catch(error => {
        console.error(`[${SCRIPT_NAME}] switch custom-skin profile failed:`, error);
        showToast(`切换皮肤失败: ${error.message || error}`);
      });
    });

    $pane.find('#gal-custom-skin-profile-create').on('click', async () => {
      const input = await showInAppPromptDialog({
        title: '新建自定义皮肤',
        message: '请输入新皮肤名称。创建后会自动切换到这套皮肤。',
        label: '皮肤名称',
        defaultValue: `自定义皮肤 ${state.profiles.length + 1}`,
        placeholder: '例如：夜幕蓝调',
        confirmText: '创建',
        cancelText: '取消',
        iconClass: 'fa-solid fa-plus',
        accent: '#0ea5e9',
        required: true,
        requiredMessage: '请输入皮肤名称',
      });
      if (input === null) return;
      const profile = await createUiSkinProfile({ displayName: input });
      await reloadProfiles(profile.id);
      await syncActiveProfileSetting();
      await loadCurrentAsset();
      showToast(`已创建自定义皮肤：${profile.displayName}`);
    });

    $pane.find('#gal-custom-skin-profile-rename').on('click', async () => {
      if (!state.profileId) return;
      const input = await showInAppPromptDialog({
        title: '重命名自定义皮肤',
        message: '请输入新的皮肤名称。',
        label: '皮肤名称',
        defaultValue: getCurrentProfileLabel(),
        placeholder: '例如：夜幕蓝调',
        confirmText: '保存',
        cancelText: '取消',
        iconClass: 'fa-solid fa-pen',
        accent: '#6366f1',
        required: true,
        requiredMessage: '请输入皮肤名称',
      });
      if (input === null) return;
      const profile = await renameUiSkinProfile(state.profileId, input);
      await reloadProfiles(profile.id);
      refreshSkinSelectElement();
      showToast(`已重命名为：${profile.displayName}`);
    });

    $pane.find('#gal-custom-skin-profile-duplicate').on('click', async () => {
      if (!state.profileId) return;
      const input = await showInAppPromptDialog({
        title: '另存为自定义皮肤',
        message: '请输入新副本的名称。系统会复制当前皮肤的全部元素资源。',
        label: '新皮肤名称',
        defaultValue: `${getCurrentProfileLabel()} 副本`,
        placeholder: '例如：夜幕蓝调 副本',
        confirmText: '另存为',
        cancelText: '取消',
        iconClass: 'fa-solid fa-copy',
        accent: '#8b5cf6',
        required: true,
        requiredMessage: '请输入皮肤名称',
      });
      if (input === null) return;
      const profile = await duplicateUiSkinProfile(state.profileId, { displayName: input });
      await reloadProfiles(profile.id);
      await syncActiveProfileSetting();
      await loadCurrentAsset();
      showToast(`已复制为：${profile.displayName}`);
    });

    $pane.find('#gal-custom-skin-export-current').on('click', async () => {
      if (!state.profileId) {
        showToast('请先选择要导出的自定义皮肤');
        return;
      }
      const profileLabel = getCurrentProfileLabel();
      const input = await showInAppPromptDialog({
        title: '导出当前自定义皮肤',
        message: '请输入导出包名，将只导出当前选中的这套自定义皮肤。',
        label: '导出包名',
        defaultValue: profileLabel,
        placeholder: '例如：夜幕蓝调',
        confirmText: '导出',
        cancelText: '取消',
        iconClass: 'fa-solid fa-file-export',
        accent: '#0d6efd',
        required: true,
        requiredMessage: '请输入导出包名',
      });
      if (!input) return;
      await AssetIO.exportCustomSkinProfile(state.profileId, String(input || '').trim());
    });

    $pane.find('#gal-custom-skin-profile-delete').on('click', async () => {
      if (!state.profileId) return;
      const label = getCurrentProfileLabel();
      const confirmed = await showInAppConfirmDialog({
        title: '删除自定义皮肤',
        message: `确定删除“${label}”吗？这会删除该皮肤下的全部元素资源。`,
        confirmText: '删除',
        cancelText: '取消',
        iconClass: 'fa-solid fa-trash',
        accent: '#dc2626',
      });
      if (!confirmed) return;
      const deletingProfileId = state.profileId;
      await deleteUiSkinProfile(deletingProfileId);
      await reloadProfiles();
      if (String(settings.skin || '').trim() === deletingProfileId) {
        settings.skin = state.profileId || 'none';
        saveSettings();
        refreshSkinSelectElement();
        applySettingsToUI();
      }
      await loadCurrentAsset();
      showToast(`已删除自定义皮肤：${label}`);
    });

    $pane.find('#gal-custom-skin-export-library').on('click', async () => {
      const input = await showInAppPromptDialog({
        title: '导出自定义皮肤库',
        message: '请输入导出包名，将导出全部命名自定义皮肤。',
        label: '导出包名',
        defaultValue: `自定义皮肤库_${new Date().toISOString().slice(0, 10)}`,
        placeholder: '自定义皮肤库',
        confirmText: '导出',
        cancelText: '取消',
        iconClass: 'fa-solid fa-file-export',
        accent: '#0d6efd',
        required: true,
        requiredMessage: '请输入导出包名',
      });
      if (!input) return;
      await AssetIO.exportCustomSkinLibrary(String(input || '').trim());
    });

    $pane.find('#gal-custom-skin-import-package').on('click', () => {
      $profileImportZipInput.trigger('click');
    });

    $profileImportZipInput.on('change', async function () {
      const file = this.files?.[0];
      if (!file) return;
      try {
        await importFromZipFile(file);
        await reloadProfiles(hasUiSkinProfileId(settings.skin) ? String(settings.skin).trim() : state.profileId);
        await loadCurrentAsset();
      } finally {
        this.value = '';
      }
    });
  };

  state.cropper = new CustomSkinCropper(getCurrentElementDef()?.aspectRatio || 16 / 9);
  state.cropper.setChangeListener(payload => {
    if (payload?.type === 'matting-color-picked' && payload.color) {
      const pickedColor = normalizeHexColor(payload.color, DEFAULT_CHROMA_KEY_COLOR);
      $mattingColor.val(pickedColor);
      $mattingColorText.val(pickedColor);
      state.overlayMode = state.cropper?.hasMattingPreview?.() ? 'matting' : '';
      if (!state.overlayMode && $mattingEnabled.is(':checked')) {
        state.overlayMode = '';
      }
      setHint(`已吸取背景色 ${pickedColor}，可点击“应用抠图”生成透明预览。`, 'ok');
      syncCropperMattingSettings({ shouldRender: false, keepPreview: true });
      syncCropperInteractionMode();
      $modeHelp.text(getModeHelpText());
      $cropWrapper.attr('title', getCropWrapperTitle());
    }
    if (payload?.type === 'matting-paint' && state.componentSessionCandidates.length > 0) {
      clearComponentSession({ keepSessionActive: true, shouldRender: false, clearCropperCandidates: false });
    }
    if (payload?.type === 'component-candidate-selected' && isFooterBatchMode()) {
      const selectedCandidateId = String(payload.candidateId || '').trim();
      if (selectedCandidateId) {
        state.footerBatchSelectedCandidateId = selectedCandidateId;
        syncFooterBatchUI();
        const candidateIndex = Math.max(0, state.footerBatchCandidates.findIndex(candidate => candidate.id === selectedCandidateId)) + 1;
        const targetMeta = FOOTER_BATCH_SLOT_META[candidateIndex - 1] || null;
        setHint(
          targetMeta
            ? `当前高亮的是第 ${candidateIndex} 个底栏候选框；保存时会固定落到 ${targetMeta.shortLabel}。`
            : `当前高亮的是第 ${candidateIndex} 个底栏候选框；保存时仍按默认顺序处理。`,
          'ok',
        );
      }
    } else if (payload?.type === 'component-candidate-selected' && state.componentSessionActive) {
      handleGeneralComponentCandidateSelection(payload).catch(error => {
        console.error(`[${SCRIPT_NAME}] switch component candidate failed:`, error);
        showToast(`切换候选框失败: ${error.message || error}`);
      });
    }
    updateAutoDetectState();
    syncCropperPreviewControls();
    syncFooterBatchUI();
  });
  if (canvas) {
    state.cropper.attachToCanvas(canvas);
  }
  setCanvasPlaceholder();
  $elementSelect.val(state.elementId);
  syncProfileSelectOptions();
  syncDeviceSwitchUI();
  syncStateOptions();
  markActiveElementItem();
  updateEditableState();
  setCustomSkinRuntimePreviewDevice(state.device);
  setModeButtons('crop');
  bindProfileActions();
  bindElementAndStateChanges();
  bindPreviewActions();
  bindFormActions();

  ensureActiveProfile()
    .then(() => syncActiveProfileSetting())
    .then(() => loadCurrentAsset())
    .catch(error => {
      console.error(`[${SCRIPT_NAME}] initial custom-skin editor load failed:`, error);
      setHint('初始化失败，请关闭面板后重试。', 'err');
    });

  $modal.on('remove', () => {
    state.desktopPreviewActive = false;
    clearObjectUrls();
    setCustomSkinRuntimePreviewDevice(null);
    applyCustomSkinRuntime().catch(error => {
      console.warn(`[${SCRIPT_NAME}] restore automatic custom-skin device detection failed:`, error);
    });
  });
}

