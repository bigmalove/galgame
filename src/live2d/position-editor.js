import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow, $ } from '../core/env.js';
import { getLive2DConfig, setLive2DConfig, normalizeLive2DScaleBase } from './render-mode.js';
import { Live2DManager } from './manager.js';
import { Live2DStage } from './stage.js';

// 延迟引用: getModalMountRoot (来自 UI 层)
let _getModalMountRootRef = null;
export function setPositionEditorRefs({ getModalMountRoot }) {
  if (getModalMountRoot) _getModalMountRootRef = getModalMountRoot;
}

// ============================================
// Live2D 位置调整编辑器
// ============================================
export const Live2DPositionEditor = {
  isActive: false,
  characterId: null,
  originalConfig: null,
  $toolbar: null,
  isDragging: false,
  dragStart: { x: 0, y: 0 },
  modelStart: { x: 0, y: 0 },
  lastPinchDistance: 0,

  async enter(characterId) {
    if (this.isActive) {
      this.exit(false);
    }

    const _$ = topWindow.jQuery || $;
    this.characterId = characterId;
    this.isActive = true;

    const config = getLive2DConfig(characterId);
    this.originalConfig = JSON.parse(JSON.stringify(config.transform || {}));

    let model = Live2DManager.models.get(characterId);
    if (!model) {
      model = await Live2DManager.loadModel(characterId);
    }

    if (!model) {
      const _toastr = topWindow.toastr || (typeof toastr !== 'undefined' ? toastr : null);
      if (_toastr) {
        _toastr.error('无法加载 Live2D 模型');
      }
      this.isActive = false;
      return;
    }

    const $gameContent = _$('#gal-global-overlay .gal-game-content');
    if (!$gameContent.length) {
      const _toastr = topWindow.toastr || (typeof toastr !== 'undefined' ? toastr : null);
      if (_toastr) {
        _toastr.error('未找到游戏主界面');
      }
      this.isActive = false;
      return;
    }

    _$('#gal-live2d-position-edit-container').remove();

    let slotWidth = 200;
    let slotHeight = 400;
    const $existingSlot = _$('#gal-global-overlay .gal-char-slot').first();
    if ($existingSlot.length) {
      slotWidth = $existingSlot.width() || 200;
      slotHeight = $existingSlot.height() || 400;
    }

    const fullscreenContainerHtml = `
      <div id="gal-live2d-position-edit-container" class="gal-z-dropdown" style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: ${slotWidth}px;
        height: ${slotHeight}px;
        pointer-events: none;
        border: 2px dashed rgba(0, 210, 255, 0.5);
        border-radius: 8px;
        box-shadow: 0 0 20px rgba(0, 210, 255, 0.3);
        background: rgba(0, 0, 0, 0.1);
      ">
        <div class="gal-live2d-canvas-container" style="width: 100%; height: 100%; position: relative;"></div>
      </div>
    `;
    $gameContent.append(fullscreenContainerHtml);

    const $mainContainer = _$('#gal-live2d-position-edit-container .gal-live2d-canvas-container');
    this._tempContainerCreated = true;

    const containerEl = $mainContainer.get(0);
    if (containerEl) {
      Live2DStage.pushMount(containerEl, { mode: 'single', focusCharacterId: characterId });
      const attached = Live2DStage.attach(characterId, model, 'left', { entering: false });
      if (!attached) {
        Live2DStage.popMount();
        const _toastr = topWindow.toastr || (typeof toastr !== 'undefined' ? toastr : null);
        if (_toastr) {
          _toastr.error('模型渲染失败');
        }
        this.isActive = false;
        _$('#gal-live2d-position-edit-container').remove();
        this._tempContainerCreated = false;
        return;
      }
    }

    await new Promise(r => requestAnimationFrame(r));

    model = Live2DManager.models.get(characterId);
    const container = Live2DManager.containers.get(characterId);

    if (!model || !container) {
      const _toastr = topWindow.toastr || (typeof toastr !== 'undefined' ? toastr : null);
      if (_toastr) {
        _toastr.error('模型渲染失败');
      }
      this.isActive = false;
      if (this._tempContainerCreated) {
        _$('.gal-position-edit-temp').remove();
        this._tempContainerCreated = false;
      }
      return;
    }

    Live2DManager.enableInteraction(characterId);

    this.createToolbar();

    this.bindDragEvents();
    this.bindZoomEvents();

    const transform = Live2DManager.getCurrentTransform(characterId);
    if (transform) {
      this.updateDisplay(transform.offsetX, transform.offsetY, transform.scale);
    }

    console.log(`[Live2DPositionEditor] 进入调整模式: ${characterId}, 容器已就绪`);
  },

  exit(save = false) {
    if (!this.isActive) return;

    const _$ = topWindow.jQuery || $;
    const characterId = this.characterId;

    this.unbindEvents();

    Live2DManager.disableInteraction(characterId);

    if (save) {
      const transform = Live2DManager.getCurrentTransform(characterId);
      if (transform) {
        const config = getLive2DConfig(characterId);
        const currentTransform = config.transform || {};
        config.transform = {
          ...currentTransform,
          offsetX: Math.round(transform.offsetX),
          offsetY: Math.round(transform.offsetY),
          scale: parseFloat(transform.scale.toFixed(2)),
          scaleBase: normalizeLive2DScaleBase(currentTransform.scaleBase),
        };
        setLive2DConfig(characterId, config);

        const _toastr = topWindow.toastr || (typeof toastr !== 'undefined' ? toastr : null);
        if (_toastr) {
          _toastr.success('Live2D 位置设置已保存');
        }
      }
    } else {
      if (this.originalConfig) {
        const config = getLive2DConfig(characterId);
        config.transform = this.originalConfig;
        setLive2DConfig(characterId, config);
        Live2DManager.applyTransformConfig(characterId);
      }
    }

    if (this._tempContainerCreated) {
      Live2DStage.popMount();
      _$('#gal-live2d-position-edit-container').remove();
      _$('.gal-position-edit-temp').remove();
      this._tempContainerCreated = false;
    }

    if (this.$toolbar) {
      this.$toolbar.remove();
      this.$toolbar = null;
    }

    this.isActive = false;
    this.characterId = null;
    this.originalConfig = null;

    console.log(`[Live2DPositionEditor] 退出调整模式: ${characterId}, 保存: ${save}`);
  },

  updateDisplay(offsetX, offsetY, scale) {
    if (!this.$toolbar) return;
    const _$ = topWindow.jQuery || $;
    this.$toolbar.find('.gal-pos-x-val').text(Math.round(offsetX));
    this.$toolbar.find('.gal-pos-y-val').text(Math.round(offsetY));
    this.$toolbar.find('.gal-pos-scale-val').text(scale.toFixed(2) + 'x');
    this.$toolbar.find('#gal-pos-x-slider').val(offsetX);
    this.$toolbar.find('#gal-pos-y-slider').val(offsetY);
    this.$toolbar.find('#gal-pos-scale-slider').val(scale);
  },

  createToolbar() {
    const _$ = topWindow.jQuery || $;

    _$('#gal-live2d-position-toolbar').remove();
    _$('#gal-live2d-position-hint').remove();

    const transform = Live2DManager.getCurrentTransform(this.characterId) || { offsetX: 0, offsetY: 0, scale: 1 };
    const self = this;

    const toolbarHtml = `
      <div id="gal-live2d-position-toolbar" class="gal-z-critical" style="
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, rgba(30, 30, 40, 0.98), rgba(50, 50, 70, 0.98));
        backdrop-filter: blur(10px);
        border-radius: 16px;
        padding: 16px 24px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        border: 1px solid rgba(255, 255, 255, 0.15);
        min-width: 320px;
      ">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="min-width: 70px; font-size: 0.85rem;">X 偏移:</span>
          <input type="range" id="gal-pos-x-slider" min="-300" max="300" step="5" value="${Math.round(transform.offsetX)}"
            style="flex: 1; cursor: pointer; accent-color: #00d2ff;">
          <span class="gal-pos-x-val" style="min-width: 45px; text-align: right; font-weight: 600; font-size: 0.9rem;">${Math.round(transform.offsetX)}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="min-width: 70px; font-size: 0.85rem;">Y 偏移:</span>
          <input type="range" id="gal-pos-y-slider" min="-300" max="300" step="5" value="${Math.round(transform.offsetY)}"
            style="flex: 1; cursor: pointer; accent-color: #00d2ff;">
          <span class="gal-pos-y-val" style="min-width: 45px; text-align: right; font-weight: 600; font-size: 0.9rem;">${Math.round(transform.offsetY)}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="min-width: 70px; font-size: 0.85rem;">缩放:</span>
          <input type="range" id="gal-pos-scale-slider" min="0.3" max="2.5" step="0.05" value="${transform.scale.toFixed(2)}"
            style="flex: 1; cursor: pointer; accent-color: #00d2ff;">
          <span class="gal-pos-scale-val" style="min-width: 45px; text-align: right; font-weight: 600; font-size: 0.9rem;">${transform.scale.toFixed(2)}x</span>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 4px; justify-content: flex-end;">
          <button id="gal-pos-reset" style="
            padding: 8px 16px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            color: #fff;
            cursor: pointer;
            font-size: 0.85rem;
          ">
            <i class="fa-solid fa-undo"></i> 重置
          </button>
          <button id="gal-pos-cancel" style="
            padding: 8px 16px;
            background: rgba(220, 53, 69, 0.8);
            border: none;
            border-radius: 6px;
            color: #fff;
            cursor: pointer;
            font-size: 0.85rem;
          ">
            <i class="fa-solid fa-times"></i> 取消
          </button>
          <button id="gal-pos-save" style="
            padding: 8px 16px;
            background: linear-gradient(135deg, #00d2ff, #3a7bd5);
            border: none;
            border-radius: 6px;
            color: #fff;
            cursor: pointer;
            font-size: 0.85rem;
            font-weight: 600;
          ">
            <i class="fa-solid fa-check"></i> 保存
          </button>
        </div>
      </div>
    `;

    const mountRoot = _getModalMountRootRef ? _getModalMountRootRef() : topWindow.document.body;
    _$(mountRoot).append(toolbarHtml);
    this.$toolbar = _$(mountRoot).find('#gal-live2d-position-toolbar');

    this.$toolbar.find('#gal-pos-x-slider').on('input', function() {
      const val = parseInt(_$(this).val());
      self.$toolbar.find('.gal-pos-x-val').text(val);
      const currentY = parseInt(self.$toolbar.find('#gal-pos-y-slider').val()) || 0;
      Live2DManager.setOffset(self.characterId, val, currentY);
    });

    this.$toolbar.find('#gal-pos-y-slider').on('input', function() {
      const val = parseInt(_$(this).val());
      self.$toolbar.find('.gal-pos-y-val').text(val);
      const currentX = parseInt(self.$toolbar.find('#gal-pos-x-slider').val()) || 0;
      Live2DManager.setOffset(self.characterId, currentX, val);
    });

    this.$toolbar.find('#gal-pos-scale-slider').on('input', function() {
      const val = parseFloat(_$(this).val());
      self.$toolbar.find('.gal-pos-scale-val').text(val.toFixed(2) + 'x');
      Live2DManager.setScale(self.characterId, val);
    });

    this.$toolbar.find('#gal-pos-reset').on('click', function() {
      self.resetToDefault();
    });
    this.$toolbar.find('#gal-pos-cancel').on('click', function() {
      self.exit(false);
    });
    this.$toolbar.find('#gal-pos-save').on('click', function() {
      self.exit(true);
    });
  },

  resetToDefault() {
    const characterId = this.characterId;
    Live2DManager.setOffset(characterId, 0, 0);
    Live2DManager.setScale(characterId, 1.0);
    this.updateDisplay(0, 0, 1.0);
  },

  bindDragEvents() {
    // 已移除拖拽事件，改用滑条
  },

  bindZoomEvents() {
    // 已移除缩放事件，改用滑条
  },

  unbindEvents() {
    const _$ = topWindow.jQuery || $;
    _$('#gal-live2d-position-hint').remove();
  }
};
