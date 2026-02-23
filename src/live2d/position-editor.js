import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow, $ } from '../core/env.js';
import { getLive2DConfig, setLive2DConfig, normalizeLive2DScaleBase } from './render-mode.js';
import { Live2DManager } from './manager.js';
import { Live2DStage } from './stage.js';
import { ensureGlobalOverlay, showGlobalOverlay, setChatScrollLock, syncOverlayHeightToChatViewport, adjustGameContentScale } from '../ui/overlay.js';

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
  $guide: null,
  isDragging: false,
  dragStart: { x: 0, y: 0 },
  modelStart: { x: 0, y: 0 },
  lastPinchDistance: 0,
  currentSlot: 'left',
  _stagePushed: false,
  _onResize: null,

  // 进入编辑前，清理其它窗口并确保主界面可见
  prepareEditContext() {
    const _$ = topWindow.jQuery || $;

    // 确保预览挂载不会残留
    try {
      Live2DStage.popMount();
    } catch (e) {}

    // 关闭其它窗口与临时面板
    const dismissSelectors = [
      '#gal-custom-popup',
      '#gal-history-modal',
      '#gal-character-sprites-modal',
      '#gal-unified-panel',
      '#gal-pack-manager-modal',
      '#gal-transfer-modal',
      '#gal-batch-bg-upload-modal',
      '#gal-bg-upload-modal',
      '#gal-live2d-settings-modal',
      '#gal-prompts-modal',
      '#gal-free-input-modal',
      '#gal-import-pack-selector',
      '.gal-input-modal',
      '.gal-config-modal',
      '.gal-z-dropdown',
    ];
    dismissSelectors.forEach(sel => {
      try {
        _$(sel).remove();
      } catch (e) {}
    });

    let $overlay = _$('#gal-global-overlay');
    if (!$overlay.length) {
      $overlay = ensureGlobalOverlay();
    }

    if (!$overlay.length) {
      const _toastr = topWindow.toastr || (typeof toastr !== 'undefined' ? toastr : null);
      if (_toastr) {
        _toastr.error('未找到游戏主界面');
      }
      return false;
    }

    if (!$overlay.hasClass('active')) {
      showGlobalOverlay();
    } else {
      setChatScrollLock(true);
      syncOverlayHeightToChatViewport($overlay[0], { force: true });
      adjustGameContentScale();
    }

    return true;
  },

  _removeGuide() {
    const _$ = topWindow.jQuery || $;
    _$('#gal-live2d-position-guide').remove();
    this.$guide = null;
  },

  _createGuide() {
    const _$ = topWindow.jQuery || $;
    this._removeGuide();

    const $gameContent = _$('#gal-global-overlay .gal-game-content');
    if (!$gameContent.length) return;

    const label = this.currentSlot === 'right'
      ? '右侧角色调整区域'
      : this.currentSlot === 'center'
        ? '中间角色调整区域'
        : '左侧角色调整区域';
    const guideHtml = `
      <div id="gal-live2d-position-guide" class="gal-live2d-position-guide">
        <div class="gal-live2d-position-guide-box">
          <span class="gal-live2d-position-guide-label">${label}</span>
        </div>
      </div>
    `;

    $gameContent.append(guideHtml);
    this.$guide = _$('#gal-live2d-position-guide');
    this._updateGuideRect();
  },

  _updateGuideRect() {
    if (!this.$guide || !this.$guide.length) return;
    const rect = Live2DStage.slots[this.currentSlot]?.rect;
    if (!rect) return;

    const $box = this.$guide.find('.gal-live2d-position-guide-box');
    $box.css({
      left: `${Math.round(rect.x)}px`,
      top: `${Math.round(rect.y)}px`,
      width: `${Math.round(rect.width)}px`,
      height: `${Math.round(rect.height)}px`,
    });
  },

  async enter(characterId) {
    if (this.isActive) {
      this.exit(false);
    }

    const _$ = topWindow.jQuery || $;
    this.characterId = characterId;
    this.isActive = true;
    this._stagePushed = false;
    this.currentSlot = 'left';

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

    if (!this.prepareEditContext()) {
      this.isActive = false;
      return;
    }

    const waitFrame = () => new Promise(resolve => {
      (topWindow.requestAnimationFrame || requestAnimationFrame)(() => resolve());
    });
    await waitFrame();
    await waitFrame();

    // 直接挂载到主界面真实舞台，确保所见即所得
    const $gameContent = _$('#gal-global-overlay .gal-game-content');
    if (!$gameContent.length) {
      const _toastr = topWindow.toastr || (typeof toastr !== 'undefined' ? toastr : null);
      if (_toastr) {
        _toastr.error('未找到游戏主界面');
      }
      this.isActive = false;
      return;
    }

    const existingSlot = Live2DStage.instances.get(characterId)?.slot;
    this.currentSlot = existingSlot === 'right' ? 'right' : existingSlot === 'center' ? 'center' : 'left';

    // 复用同一个舞台：挂载到主界面，使用 story 模式保持真实尺寸与位置
    const containerEl = $gameContent.get(0);
    if (containerEl) {
      Live2DStage.pushMount(containerEl, { mode: 'story', focusCharacterId: characterId });
      this._stagePushed = true;
      const attached = Live2DStage.attach(characterId, model, this.currentSlot, { entering: false });
      if (!attached) {
        if (this._stagePushed) {
          Live2DStage.popMount();
          this._stagePushed = false;
        }
        const _toastr = topWindow.toastr || (typeof toastr !== 'undefined' ? toastr : null);
        if (_toastr) {
          _toastr.error('模型渲染失败');
        }
        this.isActive = false;
        return;
      }
      const attachedSlot = Live2DStage.instances.get(characterId)?.slot;
      this.currentSlot = attachedSlot === 'right' ? 'right' : attachedSlot === 'center' ? 'center' : 'left';
      Live2DStage.updateLayout();
      this._createGuide();
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
      if (this._stagePushed) {
        Live2DStage.popMount();
        this._stagePushed = false;
      }
      this._removeGuide();
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

    console.log(`[Live2DPositionEditor] 进入调整模式: ${characterId}, 槽位=${this.currentSlot}`);
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

    // 恢复舞台挂载（不销毁全局 app/canvas）
    if (this._stagePushed) {
      Live2DStage.popMount();
      this._stagePushed = false;
    }

    if (this.$toolbar) {
      this.$toolbar.remove();
      this.$toolbar = null;
    }
    this._removeGuide();

    this.isActive = false;
    this.characterId = null;
    this.originalConfig = null;
    this.currentSlot = 'left';

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
    this._updateGuideRect();
  },

  createToolbar() {
    const _$ = topWindow.jQuery || $;

    _$('#gal-live2d-position-toolbar').remove();

    const transform = Live2DManager.getCurrentTransform(this.characterId) || { offsetX: 0, offsetY: 0, scale: 1 };
    const self = this;

    const toolbarHtml = `
      <div id="gal-live2d-position-toolbar" class="gal-live2d-position-toolbar gal-z-critical">
        <!-- X 位置滑条 -->
        <div class="gal-live2d-position-row">
          <span class="gal-live2d-position-label">X 偏移:</span>
          <input type="range" id="gal-pos-x-slider" min="-300" max="300" step="5" value="${Math.round(transform.offsetX)}"
            class="gal-live2d-position-slider">
          <span class="gal-live2d-position-value gal-pos-x-val">${Math.round(transform.offsetX)}</span>
        </div>

        <!-- Y 位置滑条 -->
        <div class="gal-live2d-position-row">
          <span class="gal-live2d-position-label">Y 偏移:</span>
          <input type="range" id="gal-pos-y-slider" min="-300" max="300" step="5" value="${Math.round(transform.offsetY)}"
            class="gal-live2d-position-slider">
          <span class="gal-live2d-position-value gal-pos-y-val">${Math.round(transform.offsetY)}</span>
        </div>

        <!-- 缩放滑条 -->
        <div class="gal-live2d-position-row">
          <span class="gal-live2d-position-label">缩放:</span>
          <input type="range" id="gal-pos-scale-slider" min="0.3" max="2.5" step="0.05" value="${transform.scale.toFixed(2)}"
            class="gal-live2d-position-slider">
          <span class="gal-live2d-position-value gal-pos-scale-val">${transform.scale.toFixed(2)}x</span>
        </div>

        <!-- 按钮行 -->
        <div class="gal-live2d-position-actions">
          <button id="gal-pos-reset" class="gal-live2d-position-btn gal-live2d-position-btn-reset">
            <i class="fa-solid fa-undo"></i> 重置
          </button>
          <button id="gal-pos-cancel" class="gal-live2d-position-btn gal-live2d-position-btn-cancel">
            <i class="fa-solid fa-times"></i> 取消
          </button>
          <button id="gal-pos-save" class="gal-live2d-position-btn gal-live2d-position-btn-save">
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
    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
    if (this._onResize) {
      try {
        _topWindow.removeEventListener('resize', this._onResize);
      } catch (e) {}
    }
    this._onResize = () => {
      Live2DStage.updateLayout();
      this._updateGuideRect();
    };
    try {
      _topWindow.addEventListener('resize', this._onResize, { passive: true });
    } catch (e) {}
  },

  bindZoomEvents() {
    // 已移除缩放事件，改用滑条
  },

  unbindEvents() {
    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
    if (this._onResize) {
      try {
        _topWindow.removeEventListener('resize', this._onResize);
      } catch (e) {}
    }
    this._onResize = null;
  }
};
