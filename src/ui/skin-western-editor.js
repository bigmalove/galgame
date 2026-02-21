import { SCRIPT_NAME, DEFAULT_PACK_ID } from '../core/constants.js';
import { $, topWindow } from '../core/env.js';
import { getCurrentPackId } from '../db/image-packs.js';
import { buildUiSkinAssetId, deleteUiSkinAsset, getUiSkinAsset, saveUiSkinAsset } from '../db/ui-skins.js';
import { ImageCropper } from './sprite-upload.js';
import {
  WESTERN_SKIN_ELEMENTS,
  WESTERN_SKIN_ID,
  WESTERN_SKIN_STATES,
  applyWesternSkinRuntime,
  buildDefaultWesternAssetPayload,
  getWesternSkinElementById,
  setWesternSkinRuntimePreviewDevice,
} from './skin-western-runtime.js';
import { showToast } from './toast.js';

function getNumberValue(raw, fallback = null) {
  const num = Number(raw);
  return Number.isFinite(num) ? num : fallback;
}

function toInputValue(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function getElementSupportsStates(elementId) {
  const def = getWesternSkinElementById(elementId);
  if (!def || !Array.isArray(def.supportsStates) || def.supportsStates.length === 0) {
    return ['normal'];
  }
  return def.supportsStates;
}

function getPackId() {
  return getCurrentPackId() || DEFAULT_PACK_ID;
}

function createEmptySlice() {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

function createEmptyPadding() {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

export function buildWesternSkinEditorTab(activeTab, currentPackId) {
  const firstElementId = WESTERN_SKIN_ELEMENTS[0]?.id || 'dialog_panel';
  const elementOptions = WESTERN_SKIN_ELEMENTS
    .map(def => `<option value="${def.id}">${def.label}</option>`)
    .join('');
  const elementList = WESTERN_SKIN_ELEMENTS
    .map((def, idx) => `
      <button
        class="gal-western-element-item ${idx === 0 ? 'active' : ''}"
        data-element-id="${def.id}"
        title="${def.id}"
      >
        <span class="gal-western-element-label">${def.label}</span>
        <small class="gal-western-element-id">${def.id}</small>
      </button>
    `)
    .join('');
  const stateOptions = WESTERN_SKIN_STATES
    .map(state => `<option value="${state}">${state}</option>`)
    .join('');

  return `
  <div class="gal-tab-pane ${activeTab === 'skin' ? 'active' : ''}" data-pane="skin" style="${activeTab !== 'skin' ? 'display: none;' : ''}">
    <div class="gal-pane-header">
      <span class="gal-pane-stat">当前图包：${currentPackId || DEFAULT_PACK_ID} · 皮肤：${WESTERN_SKIN_ID}</span>
      <div class="gal-pane-actions">
        <button class="gal-action-btn gal-pane-btn teal" id="gal-western-reload-runtime"><i class="fa-solid fa-rotate"></i> <span>刷新预览</span></button>
      </div>
    </div>
    <div class="gal-western-device-switch" id="gal-western-device-switch">
      <button type="button" class="gal-western-device-tab active" data-device="desktop">桌面皮肤</button>
      <button type="button" class="gal-western-device-tab" data-device="mobile">移动端皮肤</button>
    </div>

    <div class="gal-western-editor-layout">
      <div class="gal-western-editor-col gal-western-editor-elements">
        <div class="gal-western-editor-title"><i class="fa-solid fa-layer-group"></i> 元素列表</div>
        <div class="gal-western-elements-list">
          ${elementList}
        </div>
      </div>

      <div class="gal-western-editor-col gal-western-editor-preview">
        <div class="gal-western-editor-title"><i class="fa-solid fa-crop"></i> 图片裁剪预览</div>
        <div class="gal-western-editor-hint" id="gal-western-editor-hint">选择元素后可上传图片并裁剪保存。</div>
        <div class="gal-western-crop-wrapper" id="gal-western-crop-wrapper">
          <canvas id="gal-western-skin-canvas" width="560" height="320"></canvas>
        </div>
        <input type="file" id="gal-western-image-input" accept="image/*" style="display:none;">
        <div class="gal-western-preview-actions">
          <button class="gal-action-btn gal-pane-btn primary" id="gal-western-select-image"><i class="fa-solid fa-upload"></i> <span>选择图片</span></button>
          <button class="gal-action-btn gal-pane-btn" id="gal-western-reset-crop"><i class="fa-solid fa-arrows-rotate"></i> <span>重置裁剪</span></button>
        </div>
        <div class="gal-western-zoom-row">
          <span>缩放</span>
          <input type="range" id="gal-western-zoom" min="10" max="500" value="100">
          <span id="gal-western-zoom-value">100%</span>
        </div>
        <label class="gal-western-check-row">
          <input type="checkbox" id="gal-western-save-image">
          <span>保存当前裁剪图像（仅改参数时可取消）</span>
        </label>
      </div>

      <div class="gal-western-editor-col gal-western-editor-form">
        <div class="gal-western-editor-title"><i class="fa-solid fa-sliders"></i> 参数设置</div>

        <div class="gal-western-form-grid">
          <label>
            <span>元素</span>
            <select id="gal-western-element-select">${elementOptions}</select>
          </label>
          <label>
            <span>当前编辑端</span>
            <input type="text" id="gal-western-device-display" value="desktop" readonly>
          </label>
          <select id="gal-western-device-select" style="display:none;">
            <option value="desktop">desktop</option>
            <option value="mobile">mobile</option>
          </select>
          <label>
            <span>状态</span>
            <select id="gal-western-state-select">${stateOptions}</select>
          </label>
          <label>
            <span>缩放模式</span>
            <select id="gal-western-scale-mode">
              <option value="stretch">stretch</option>
              <option value="cover">cover</option>
              <option value="contain">contain</option>
              <option value="nine-slice">nine-slice</option>
            </select>
          </label>
          <label>
            <span>宽度(px)</span>
            <input type="number" id="gal-western-width" step="1" placeholder="留空=自动">
          </label>
          <label>
            <span>高度(px)</span>
            <input type="number" id="gal-western-height" step="1" placeholder="留空=自动">
          </label>
          <label>
            <span>偏移X(px)</span>
            <input type="number" id="gal-western-offset-x" step="1">
          </label>
          <label>
            <span>偏移Y(px)</span>
            <input type="number" id="gal-western-offset-y" step="1">
          </label>
          <label>
            <span>锚点X(px)</span>
            <input type="number" id="gal-western-anchor-x" step="1">
          </label>
          <label>
            <span>锚点Y(px)</span>
            <input type="number" id="gal-western-anchor-y" step="1">
          </label>
          <label class="gal-western-field-wide">
            <span>clipPath（主画框可用）</span>
            <input type="text" id="gal-western-clip-path" placeholder="例如: inset(14% 18% 54% 18%)">
          </label>
        </div>

        <div class="gal-western-subtitle">九宫格切片（slice）</div>
        <div class="gal-western-form-grid gal-western-four-grid">
          <label><span>top</span><input type="number" id="gal-western-slice-top" step="1"></label>
          <label><span>right</span><input type="number" id="gal-western-slice-right" step="1"></label>
          <label><span>bottom</span><input type="number" id="gal-western-slice-bottom" step="1"></label>
          <label><span>left</span><input type="number" id="gal-western-slice-left" step="1"></label>
        </div>

        <div class="gal-western-subtitle">文本内边距（textPadding）</div>
        <div class="gal-western-form-grid gal-western-four-grid">
          <label><span>top</span><input type="number" id="gal-western-pad-top" step="1"></label>
          <label><span>right</span><input type="number" id="gal-western-pad-right" step="1"></label>
          <label><span>bottom</span><input type="number" id="gal-western-pad-bottom" step="1"></label>
          <label><span>left</span><input type="number" id="gal-western-pad-left" step="1"></label>
        </div>

        <div class="gal-western-form-actions">
          <button class="gal-action-btn gal-pane-btn primary" id="gal-western-save-current"><i class="fa-solid fa-floppy-disk"></i> <span>保存当前元素</span></button>
          <button class="gal-action-btn gal-pane-btn purple" id="gal-western-reload-current"><i class="fa-solid fa-rotate-right"></i> <span>重新加载</span></button>
          <button class="gal-action-btn gal-pane-btn" id="gal-western-reset-current"><i class="fa-solid fa-trash"></i> <span>重置当前元素</span></button>
        </div>
      </div>
    </div>
  </div>`;
}

export function bindWesternSkinEditorEvents($modal) {
  const $pane = $modal.find('.gal-tab-pane[data-pane="skin"]');
  if (!$pane.length) return;

  const state = {
    elementId: WESTERN_SKIN_ELEMENTS[0]?.id || 'dialog_panel',
    device: 'desktop',
    uiState: 'normal',
    cropper: null,
    currentAsset: null,
    objectUrls: new Set(),
    loadToken: 0,
  };

  const $elementSelect = $pane.find('#gal-western-element-select');
  const $deviceSelect = $pane.find('#gal-western-device-select');
  const $deviceDisplay = $pane.find('#gal-western-device-display');
  const $stateSelect = $pane.find('#gal-western-state-select');
  const $hint = $pane.find('#gal-western-editor-hint');
  const $zoom = $pane.find('#gal-western-zoom');
  const $zoomValue = $pane.find('#gal-western-zoom-value');
  const $saveImage = $pane.find('#gal-western-save-image');
  const $imageInput = $pane.find('#gal-western-image-input');
  const canvas = $pane.find('#gal-western-skin-canvas').get(0);

  const markHint = (text, type = 'normal') => {
    $hint.text(text || '');
    $hint.removeClass('ok warn err');
    if (type === 'ok') $hint.addClass('ok');
    if (type === 'warn') $hint.addClass('warn');
    if (type === 'err') $hint.addClass('err');
  };

  const clearObjectUrls = () => {
    state.objectUrls.forEach(url => {
      try {
        (topWindow.URL || URL).revokeObjectURL(url);
      } catch (e) {
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
    ctx.fillStyle = '#6b7280';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  };

  const setInput = (selector, value) => {
    $pane.find(selector).val(toInputValue(value));
  };

  const readInputNumber = selector => {
    const raw = String($pane.find(selector).val() || '').trim();
    if (!raw) return null;
    return getNumberValue(raw, null);
  };

  const getCurrentElementDef = () => {
    return getWesternSkinElementById(state.elementId) || WESTERN_SKIN_ELEMENTS[0] || null;
  };

  const markActiveElementItem = () => {
    $pane.find('.gal-western-element-item').removeClass('active');
    $pane.find(`.gal-western-element-item[data-element-id="${state.elementId}"]`).addClass('active');
  };

  const syncDeviceSwitchUI = () => {
    $pane.find('.gal-western-device-tab').removeClass('active');
    $pane.find(`.gal-western-device-tab[data-device="${state.device}"]`).addClass('active');
    $deviceDisplay.val(state.device === 'mobile' ? 'mobile（移动端）' : 'desktop（桌面）');
    $deviceSelect.val(state.device);
  };

  const syncStateOptions = () => {
    const supports = getElementSupportsStates(state.elementId);
    const nextState = supports.includes(state.uiState) ? state.uiState : supports[0];
    state.uiState = nextState;
    $stateSelect.html(supports.map(item => `<option value="${item}">${item}</option>`).join(''));
    $stateSelect.val(nextState);
  };

  const getLayoutFromForm = () => ({
    width: readInputNumber('#gal-western-width'),
    height: readInputNumber('#gal-western-height'),
    offsetX: readInputNumber('#gal-western-offset-x') ?? 0,
    offsetY: readInputNumber('#gal-western-offset-y') ?? 0,
    anchorX: readInputNumber('#gal-western-anchor-x') ?? 0,
    anchorY: readInputNumber('#gal-western-anchor-y') ?? 0,
    clipPath: String($pane.find('#gal-western-clip-path').val() || '').trim(),
  });

  const getSliceFromForm = () => ({
    top: readInputNumber('#gal-western-slice-top') ?? 0,
    right: readInputNumber('#gal-western-slice-right') ?? 0,
    bottom: readInputNumber('#gal-western-slice-bottom') ?? 0,
    left: readInputNumber('#gal-western-slice-left') ?? 0,
  });

  const getPaddingFromForm = () => ({
    top: readInputNumber('#gal-western-pad-top') ?? 0,
    right: readInputNumber('#gal-western-pad-right') ?? 0,
    bottom: readInputNumber('#gal-western-pad-bottom') ?? 0,
    left: readInputNumber('#gal-western-pad-left') ?? 0,
  });

  const applyFormValues = payload => {
    const layout = payload?.layout || {};
    const slice = payload?.slice || createEmptySlice();
    const textPadding = payload?.textPadding || createEmptyPadding();

    setInput('#gal-western-width', layout.width);
    setInput('#gal-western-height', layout.height);
    setInput('#gal-western-offset-x', layout.offsetX ?? 0);
    setInput('#gal-western-offset-y', layout.offsetY ?? 0);
    setInput('#gal-western-anchor-x', layout.anchorX ?? 0);
    setInput('#gal-western-anchor-y', layout.anchorY ?? 0);
    setInput('#gal-western-clip-path', layout.clipPath || '');
    setInput('#gal-western-slice-top', slice.top ?? 0);
    setInput('#gal-western-slice-right', slice.right ?? 0);
    setInput('#gal-western-slice-bottom', slice.bottom ?? 0);
    setInput('#gal-western-slice-left', slice.left ?? 0);
    setInput('#gal-western-pad-top', textPadding.top ?? 0);
    setInput('#gal-western-pad-right', textPadding.right ?? 0);
    setInput('#gal-western-pad-bottom', textPadding.bottom ?? 0);
    setInput('#gal-western-pad-left', textPadding.left ?? 0);
    $pane.find('#gal-western-scale-mode').val(payload?.scaleMode || 'stretch');
  };

  const setCropperAspect = () => {
    const def = getCurrentElementDef();
    if (!state.cropper || !def) return;
    state.cropper.aspectRatio = def.aspectRatio || 16 / 9;
    if (state.cropper.imageLoaded) {
      state.cropper.calculateInitialScale();
      state.cropper.render();
      const percent = Math.round(state.cropper.scale * 100);
      $zoom.val(String(percent));
      $zoomValue.text(`${percent}%`);
    }
  };

  const loadImageToCropper = async (source, shouldSaveImage) => {
    if (!state.cropper) return;
    try {
      await state.cropper.loadImage(source);
      const percent = Math.round(state.cropper.scale * 100);
      $zoom.val(String(percent));
      $zoomValue.text(`${percent}%`);
      $saveImage.prop('checked', !!shouldSaveImage);
      markHint('图片已加载，可调整裁剪区域后保存。', 'ok');
    } catch (error) {
      console.warn(`[${SCRIPT_NAME}] western 编辑器加载图片失败:`, error);
      setCanvasPlaceholder('图片加载失败');
      markHint('图片加载失败，请更换图片。', 'err');
    }
  };

  const loadCurrentAsset = async () => {
    const token = ++state.loadToken;
    const packId = getPackId();
    const def = getCurrentElementDef();
    const defaultPayload = buildDefaultWesternAssetPayload({
      packId,
      elementId: state.elementId,
      device: state.device,
      state: state.uiState,
    });

    applyFormValues(defaultPayload);
    setCropperAspect();
    clearObjectUrls();

    const asset = await getUiSkinAsset(packId, WESTERN_SKIN_ID, state.elementId, state.device, state.uiState);
    if (token !== state.loadToken) return;
    state.currentAsset = asset;

    if (asset) {
      applyFormValues({
        ...defaultPayload,
        ...asset,
        layout: { ...(defaultPayload.layout || {}), ...(asset.layout || {}) },
        slice: { ...(defaultPayload.slice || {}), ...(asset.slice || {}) },
        textPadding: { ...(defaultPayload.textPadding || {}), ...(asset.textPadding || {}) },
      });
      if (asset.imageBlob) {
        const objectUrl = (topWindow.URL || URL).createObjectURL(asset.imageBlob);
        state.objectUrls.add(objectUrl);
        await loadImageToCropper(objectUrl, false);
      } else if (asset.imageUrl) {
        await loadImageToCropper(asset.imageUrl, false);
      } else {
        setCanvasPlaceholder('当前元素未设置图片');
        $saveImage.prop('checked', false);
        markHint('当前元素只有布局参数，没有图片。', 'warn');
      }
    } else {
      setCanvasPlaceholder('当前元素未设置图片');
      $saveImage.prop('checked', false);
      markHint('当前元素暂无配置，可直接上传并保存。');
    }
  };

  const saveCurrent = async () => {
    const def = getCurrentElementDef();
    if (!def) return;
    const packId = getPackId();
    const existing = state.currentAsset || await getUiSkinAsset(packId, WESTERN_SKIN_ID, state.elementId, state.device, state.uiState);
    const base = buildDefaultWesternAssetPayload({
      packId,
      elementId: state.elementId,
      device: state.device,
      state: state.uiState,
    });

    const payload = {
      ...base,
      id: buildUiSkinAssetId(packId, WESTERN_SKIN_ID, state.elementId, state.device, state.uiState),
      skinId: WESTERN_SKIN_ID,
      layout: getLayoutFromForm(),
      slice: getSliceFromForm(),
      textPadding: getPaddingFromForm(),
      scaleMode: String($pane.find('#gal-western-scale-mode').val() || 'stretch').trim() || 'stretch',
      meta: {
        ...(existing?.meta || {}),
        updatedBy: 'western-skin-editor',
      },
    };

    const shouldSaveImage = $saveImage.is(':checked');
    if (shouldSaveImage && state.cropper && state.cropper.imageLoaded) {
      const outWidth = Math.max(64, Math.round(readInputNumber('#gal-western-width') || def.outputWidth || 512));
      const croppedBlob = await state.cropper.getCroppedBlob(outWidth);
      payload.imageBlob = croppedBlob;
      payload.imageUrl = null;
    } else if (shouldSaveImage) {
      showToast('请先上传图片，或取消“保存当前裁剪图像”');
      return;
    } else if (existing?.imageBlob || existing?.imageUrl) {
      payload.imageBlob = existing.imageBlob || null;
      payload.imageUrl = existing.imageUrl || null;
    }

    await saveUiSkinAsset(payload);
    showToast(`已保存：${def.label} [${state.device}/${state.uiState}]`);
    await applyWesternSkinRuntime().catch(err => {
      console.warn(`[${SCRIPT_NAME}] 刷新 western 皮肤运行时失败:`, err);
    });
    await loadCurrentAsset();
  };

  const resetCurrent = async () => {
    const def = getCurrentElementDef();
    const ok = topWindow.confirm(`确定重置「${def?.label || state.elementId}」当前设备/状态配置吗？`);
    if (!ok) return;

    await deleteUiSkinAsset(getPackId(), WESTERN_SKIN_ID, state.elementId, state.device, state.uiState);
    showToast(`已重置：${def?.label || state.elementId}`);
    await applyWesternSkinRuntime().catch(err => {
      console.warn(`[${SCRIPT_NAME}] 刷新 western 皮肤运行时失败:`, err);
    });
    await loadCurrentAsset();
  };

  const bindSelectChanges = () => {
    $elementSelect.on('change', async function () {
      state.elementId = String($(this).val() || '').trim() || state.elementId;
      syncStateOptions();
      markActiveElementItem();
      await loadCurrentAsset();
    });

    $deviceSelect.on('change', async function () {
      state.device = String($(this).val() || 'desktop').trim() || 'desktop';
      syncDeviceSwitchUI();
      setWesternSkinRuntimePreviewDevice(state.device);
      await applyWesternSkinRuntime().catch(err => {
        console.warn(`[${SCRIPT_NAME}] 切换设备后刷新 western 预览失败:`, err);
      });
      await loadCurrentAsset();
    });

    $stateSelect.on('change', async function () {
      state.uiState = String($(this).val() || 'normal').trim() || 'normal';
      await loadCurrentAsset();
    });

    $pane.find('.gal-western-element-item').on('click', function () {
      const elementId = String($(this).attr('data-element-id') || '').trim();
      if (!elementId) return;
      state.elementId = elementId;
      $elementSelect.val(elementId);
      syncStateOptions();
      markActiveElementItem();
      loadCurrentAsset();
    });

    $pane.find('.gal-western-device-tab').on('click', async function () {
      const nextDevice = String($(this).attr('data-device') || '').trim();
      if (nextDevice !== 'desktop' && nextDevice !== 'mobile') return;
      if (state.device === nextDevice) return;
      state.device = nextDevice;
      syncDeviceSwitchUI();
      setWesternSkinRuntimePreviewDevice(state.device);
      await applyWesternSkinRuntime().catch(err => {
        console.warn(`[${SCRIPT_NAME}] 切换设备后刷新 western 预览失败:`, err);
      });
      await loadCurrentAsset();
      markHint(`已切换到 ${nextDevice === 'mobile' ? '移动端' : '桌面端'} 皮肤编辑模式。`, 'ok');
    });
  };

  const bindPreviewActions = () => {
    $pane.find('#gal-western-select-image').on('click', () => {
      $imageInput.trigger('click');
    });

    $imageInput.on('change', async function () {
      const file = this.files?.[0];
      if (!file) return;
      await loadImageToCropper(file, true);
      this.value = '';
    });

    $pane.find('#gal-western-reset-crop').on('click', () => {
      if (!state.cropper || !state.cropper.imageLoaded) return;
      state.cropper.reset();
      const percent = Math.round(state.cropper.scale * 100);
      $zoom.val(String(percent));
      $zoomValue.text(`${percent}%`);
    });

    $zoom.on('input', function () {
      if (!state.cropper) return;
      const value = Math.max(10, Math.min(500, Number($(this).val() || 100)));
      state.cropper.setScale(value / 100);
      $zoomValue.text(`${Math.round(value)}%`);
    });
  };

  const bindFormActions = () => {
    $pane.find('#gal-western-save-current').on('click', () => {
      saveCurrent().catch(err => {
        console.error(`[${SCRIPT_NAME}] 保存 western 元素失败:`, err);
        showToast(`保存失败: ${err.message || err}`);
      });
    });

    $pane.find('#gal-western-reload-current').on('click', () => {
      loadCurrentAsset().catch(err => {
        console.error(`[${SCRIPT_NAME}] 重新加载 western 元素失败:`, err);
      });
    });

    $pane.find('#gal-western-reset-current').on('click', () => {
      resetCurrent().catch(err => {
        console.error(`[${SCRIPT_NAME}] 重置 western 元素失败:`, err);
        showToast(`重置失败: ${err.message || err}`);
      });
    });

    $pane.find('#gal-western-reload-runtime').on('click', () => {
      setWesternSkinRuntimePreviewDevice(state.device);
      applyWesternSkinRuntime()
        .then(() => showToast('已刷新 skin-western 预览'))
        .catch(err => {
          console.error(`[${SCRIPT_NAME}] 刷新 skin-western 预览失败:`, err);
          showToast(`刷新失败: ${err.message || err}`);
        });
    });
  };

  state.cropper = new ImageCropper(getCurrentElementDef()?.aspectRatio || 16 / 9);
  if (canvas) {
    state.cropper.attachToCanvas(canvas);
  }
  setCanvasPlaceholder();
  $elementSelect.val(state.elementId);
  syncDeviceSwitchUI();
  setWesternSkinRuntimePreviewDevice(state.device);
  syncStateOptions();
  markActiveElementItem();
  bindSelectChanges();
  bindPreviewActions();
  bindFormActions();
  applyWesternSkinRuntime().catch(err => {
    console.warn(`[${SCRIPT_NAME}] 初始化 western 预览刷新失败:`, err);
  });
  loadCurrentAsset().catch(err => {
    console.error(`[${SCRIPT_NAME}] 初始化 western 编辑器失败:`, err);
    markHint('初始化失败，请重开面板重试。', 'err');
  });

  $modal.on('remove', () => {
    clearObjectUrls();
    setWesternSkinRuntimePreviewDevice(null);
    applyWesternSkinRuntime().catch(err => {
      console.warn(`[${SCRIPT_NAME}] 退出 western 编辑器后恢复设备自动识别失败:`, err);
    });
  });
}
