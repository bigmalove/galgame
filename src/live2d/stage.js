import { SCRIPT_NAME } from '../core/constants.js';
import { Live2DManager } from './manager.js';
import { getLive2DConfig, normalizeLive2DScaleBase, calculateLive2DBaseScale, getOverlayReferenceHeight } from './render-mode.js';

// 延迟引用: showToast (来自 UI 层)
let _showToastRef = null;
export function setLive2DStageRefs({ showToast }) {
  if (showToast) _showToastRef = showToast;
}

// ============================================
// Live2D 舞台渲染器（方案A：单 Canvas / 单 PIXI.Application）
// ============================================
export const Live2DStage = {
  app: null,
  canvas: null,
  mountEl: null,
  mode: 'story', // 'story' | 'single'
  focusCharacterId: null,
  dpr: 1,
  mountStack: [],
  _resizeObserver: null,
  _observedEl: null,
  _layoutRaf: 0,
  _onWindowResize: null,

  slots: {
    left: { el: null, rect: null, container: null },
    right: { el: null, rect: null, container: null },
  },

  // characterId -> { model, slot, bounds, baseScale, speaking }
  instances: new Map(),

  _getTopWindow() {
    return typeof window.parent !== 'undefined' ? window.parent : window;
  },

  _getPIXI() {
    return this._getTopWindow().PIXI;
  },

  _computeDpr() {
    const _topWindow = this._getTopWindow();
    const raw = _topWindow.devicePixelRatio || 1;
    return Math.max(1, Math.min(2, raw));
  },

  _setCanvasPointerEvents(enabled) {
    if (!this.canvas) return;
    this.canvas.style.pointerEvents = enabled ? 'auto' : 'none';
    this.canvas.style.cursor = enabled ? 'move' : 'default';
  },

  _requestLayout() {
    const _topWindow = this._getTopWindow();
    if (this._layoutRaf) return;
    this._layoutRaf = _topWindow.requestAnimationFrame(() => {
      this._layoutRaf = 0;
      this.updateLayout();
    });
  },

  _ensureSlotContainers() {
    if (!this.app) return false;
    const PIXI = this._getPIXI();
    if (!PIXI) return false;

    if (!this.slots.left.container) {
      const c = new PIXI.Container();
      this.app.stage.addChild(c);
      this.slots.left.container = c;
    }
    if (!this.slots.right.container) {
      const c = new PIXI.Container();
      this.app.stage.addChild(c);
      this.slots.right.container = c;
    }
    return true;
  },

  ensureMounted(mountEl, { mode = null } = {}) {
    const _topWindow = this._getTopWindow();
    const PIXI = this._getPIXI();

    if (!mountEl || !mountEl.isConnected) return false;
    if (!PIXI) {
      console.warn(`[${SCRIPT_NAME}] Live2DStage: PIXI 未就绪，无法挂载`);
      return false;
    }

    if (this.mountEl !== mountEl) {
      this.mountEl = mountEl;
    }

    if (!this.canvas) {
      this.canvas = _topWindow.document.createElement('canvas');
      this.canvas.className = 'gal-live2d-stage-canvas';
      this.canvas.style.cssText =
        'position:absolute; inset:0; width:100%; height:100%; pointer-events:none;';
    }

    try {
      const pos = _topWindow.getComputedStyle(mountEl).position;
      if (pos === 'static') {
        mountEl.style.position = 'relative';
      }
    } catch (e) {}

    if (this.canvas.parentNode !== mountEl) {
      try {
        mountEl.prepend(this.canvas);
      } catch (e) {
        try {
          mountEl.appendChild(this.canvas);
        } catch (e2) {}
      }
    }

    if (!this.app) {
      this.dpr = this._computeDpr();
      const rect = mountEl.getBoundingClientRect();
      const width = Math.max(1, Math.floor(mountEl.clientWidth || rect.width || 1));
      const height = Math.max(1, Math.floor(mountEl.clientHeight || rect.height || 1));

      const glContext =
        this.canvas.getContext('webgl2', {
          alpha: true,
          antialias: false,
          preserveDrawingBuffer: false,
          premultipliedAlpha: true,
        }) ||
        this.canvas.getContext('webgl', {
          alpha: true,
          antialias: false,
          preserveDrawingBuffer: false,
          premultipliedAlpha: true,
        });

      if (!glContext) {
        console.error(`[${SCRIPT_NAME}] Live2DStage: WebGL 不可用，无法渲染 Live2D`);
        try {
          if (_showToastRef) _showToastRef('WebGL 不可用，Live2D 无法渲染（请开启硬件加速）');
        } catch {}
        return false;
      }

      this.app = new PIXI.Application({
        view: this.canvas,
        context: glContext,
        backgroundAlpha: 0,
        autoStart: false,
        width,
        height,
        resolution: this.dpr,
        autoDensity: true,
        antialias: false,
        preserveDrawingBuffer: false,
      });

      if (!this.app.renderer?.gl) {
        console.error(`[${SCRIPT_NAME}] Live2DStage: WebGL Renderer 初始化失败`, this.app.renderer);
        try {
          this.app.destroy(true);
        } catch {}
        this.app = null;
        return false;
      }

      if (this.app.stage) {
        this.app.stage.interactive = false;
      }

      this._ensureSlotContainers();
      this.app.start();
    }

    if (!this._onWindowResize) {
      this._onWindowResize = () => this._requestLayout();
      try {
        _topWindow.addEventListener('resize', this._onWindowResize, { passive: true });
      } catch (e) {}
    }
    if (_topWindow.ResizeObserver && !this._resizeObserver) {
      try {
        this._resizeObserver = new _topWindow.ResizeObserver(() => this._requestLayout());
      } catch (e) {}
    }
    if (this._resizeObserver && this._observedEl !== mountEl) {
      try {
        this._resizeObserver.disconnect();
      } catch (e) {}
      try {
        this._resizeObserver.observe(mountEl);
        this._observedEl = mountEl;
      } catch (e) {}
    }

    if (mode) {
      this.mode = mode;
    }

    this.updateLayout();
    return true;
  },

  pushMount(mountEl, { mode = 'single', focusCharacterId = null } = {}) {
    const snapshot = {
      mountEl: this.mountEl,
      mode: this.mode,
      focusCharacterId: this.focusCharacterId,
      instanceStates: Array.from(this.instances.entries()).map(([id, inst]) => ({
        id,
        visible: inst.model?.visible !== false,
        alpha: inst.model?.alpha,
        slot: inst.slot,
      })),
      pointerEvents: this.canvas ? this.canvas.style.pointerEvents : 'none',
    };
    this.mountStack.push(snapshot);

    this.focusCharacterId = focusCharacterId;
    this.ensureMounted(mountEl, { mode });

    if (focusCharacterId) {
      for (const [id, inst] of this.instances) {
        if (!inst?.model) continue;
        inst.model.visible = id === focusCharacterId;
      }
    }
    return true;
  },

  popMount() {
    const snapshot = this.mountStack.pop();
    if (!snapshot) return false;

    this.focusCharacterId = snapshot.focusCharacterId || null;
    if (snapshot.mountEl && snapshot.mountEl.isConnected) {
      this.ensureMounted(snapshot.mountEl, { mode: snapshot.mode });
    } else {
      this.mode = snapshot.mode || this.mode;
    }

    for (const s of snapshot.instanceStates || []) {
      const inst = this.instances.get(s.id);
      if (!inst?.model) continue;
      inst.slot = s.slot || inst.slot;
      inst.model.visible = s.visible !== false;
      if (typeof s.alpha === 'number') {
        inst.model.alpha = s.alpha;
      }
    }

    if (this.canvas) {
      this.canvas.style.pointerEvents = snapshot.pointerEvents || 'none';
    }

    this.updateLayout();
    return true;
  },

  updateLayout() {
    if (!this.app || !this.canvas || !this.mountEl || !this.mountEl.isConnected) return false;

    const rect = this.mountEl.getBoundingClientRect();
    const width = Math.max(1, Math.floor(this.mountEl.clientWidth || rect.width || 1));
    const height = Math.max(1, Math.floor(this.mountEl.clientHeight || rect.height || 1));

    const nextDpr = this._computeDpr();
    if (nextDpr !== this.dpr) {
      this.dpr = nextDpr;
      try {
        this.app.renderer.resolution = this.dpr;
      } catch (e) {}
    }

    try {
      this.app.renderer.resize(width, height);
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] Live2DStage: renderer.resize 失败`, e);
    }

    this._ensureSlotContainers();

    if (this.mode === 'single') {
      const fullRect = { x: 0, y: 0, width, height };
      this._applySlotRect('left', fullRect);
      if (this.slots.right.container) this.slots.right.container.visible = false;
    } else {
      if (this.slots.right.container) this.slots.right.container.visible = true;

      const leftEl = this.mountEl.querySelector?.('.gal-char-slot.slot-left');
      const rightEl = this.mountEl.querySelector?.('.gal-char-slot.slot-right');

      let leftCenterX = width * 0.32;
      let rightCenterX = width * 0.68;
      let domSlotWidth = width * 0.3;

      const toLocalRect = (el) => {
        if (!el) return null;
        const cw = Number(el.clientWidth) || Number(el.offsetWidth) || 0;
        const ch = Number(el.clientHeight) || Number(el.offsetHeight) || 0;
        if (cw > 0 && ch > 0) {
          return {
            x: Number(el.offsetLeft) || 0,
            y: Number(el.offsetTop) || 0,
            width: cw,
            height: ch,
          };
        }
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return null;
        const base = rect;
        return {
          x: r.left - base.left,
          y: r.top - base.top,
          width: r.width,
          height: r.height,
        };
      };

      const leftDom = toLocalRect(leftEl);
      const rightDom = toLocalRect(rightEl);
      if (leftDom) {
        leftCenterX = leftDom.x + leftDom.width / 2;
        domSlotWidth = leftDom.width;
      }
      if (rightDom) {
        rightCenterX = rightDom.x + rightDom.width / 2;
        domSlotWidth = Math.max(domSlotWidth, rightDom.width);
      }

      let virtualWidth = Math.max(width * 0.45, domSlotWidth * 1.7);
      virtualWidth = Math.max(1, Math.min(width, Math.floor(virtualWidth)));

      const clampX = (x) => Math.max(0, Math.min(width - virtualWidth, Math.floor(x)));
      const leftX = clampX(leftCenterX - virtualWidth / 2);
      const rightX = clampX(rightCenterX - virtualWidth / 2);

      this.slots.left.el = leftEl;
      this.slots.right.el = rightEl;
      this._applySlotRect('left', { x: leftX, y: 0, width: virtualWidth, height });
      this._applySlotRect('right', { x: rightX, y: 0, width: virtualWidth, height });
    }

    for (const id of this.instances.keys()) {
      this.applyTransform(id);
    }

    return true;
  },

  _applySlotRect(slotKey, localRect) {
    const slot = this.slots[slotKey];
    if (!slot?.container || !localRect) return false;

    const w = Math.max(1, Math.floor(localRect.width || 1));
    const h = Math.max(1, Math.floor(localRect.height || 1));
    slot.rect = { x: localRect.x || 0, y: localRect.y || 0, width: w, height: h };
    slot.container.position.set(slot.rect.x, slot.rect.y);
    return true;
  },

  attach(characterId, model, slot, { entering = false } = {}) {
    if (!characterId || !model) return false;
    if (!this.app || !this.mountEl) return false;

    const key = this.mode === 'single' ? 'left' : slot === 'right' ? 'right' : 'left';
    const targetContainer = this.slots[key]?.container;
    if (!targetContainer) return false;

    const inst = this.instances.get(characterId) || { model, slot: key, bounds: null, baseScale: 1, speaking: false };
    inst.model = model;
    inst.slot = key;
    this.instances.set(characterId, inst);

    try {
      if (model.parent && model.parent !== targetContainer) {
        model.parent.removeChild(model);
      }
      if (!model.parent) {
        targetContainer.addChild(model);
      }
    } catch (e) {}

    if (!inst.bounds) {
      const wasVisible = model.visible;
      model.visible = false;
      try {
        if (model.scale?.set) model.scale.set(1);
        if (model.pivot?.set) model.pivot.set(0, 0);
        if (model.position?.set) model.position.set(0, 0);
        if (model.internalModel?.update) model.internalModel.update(0);
        if (typeof model.update === 'function') model.update(0);
        const b = model.getLocalBounds?.();
        if (b && Number.isFinite(b.width) && Number.isFinite(b.height) && b.width > 0 && b.height > 0) {
          inst.bounds = b;
        }
      } catch (e) {}
      if (!inst.bounds) {
        inst.bounds = { x: 0, y: 0, width: model.width || 500, height: model.height || 800 };
      }
      try {
        const pivotX = inst.bounds.x + inst.bounds.width / 2;
        const pivotY = inst.bounds.y + inst.bounds.height;
        if (model.pivot?.set) model.pivot.set(pivotX, pivotY);
      } catch (e) {}
      model.visible = wasVisible;
    }

    this.applyTransform(characterId);

    const slotRect = this.slots[key]?.rect;
    if (slotRect) {
      const containerInfo = Live2DManager.containers.get(characterId) || {};
      Live2DManager.containers.set(characterId, {
        ...containerInfo,
        app: this.app,
        canvas: this.canvas,
        renderWidth: slotRect.width,
        renderHeight: slotRect.height,
        width: slotRect.width,
        height: slotRect.height,
        slot: key,
        baseScale: inst.baseScale || containerInfo.baseScale || 1,
      });
    }

    if (entering) {
      // no-op
    }
    return true;
  },

  detach(characterId) {
    const inst = this.instances.get(characterId);
    if (!inst?.model) {
      this.instances.delete(characterId);
      Live2DManager.containers.delete(characterId);
      return false;
    }

    try {
      if (inst.model.parent) {
        inst.model.parent.removeChild(inst.model);
      }
    } catch (e) {}

    this.instances.delete(characterId);
    Live2DManager.containers.delete(characterId);
    return true;
  },

  setFocus(characterId, isSpeaking) {
    const inst = this.instances.get(characterId);
    if (!inst?.model) return;
    inst.speaking = !!isSpeaking;
    inst.model.alpha = inst.speaking ? 1 : 0.7;
  },

  applyTransform(characterId) {
    const inst = this.instances.get(characterId);
    if (!inst?.model) return false;

    const slotKey = this.mode === 'single' ? 'left' : inst.slot === 'right' ? 'right' : 'left';
    const targetContainer = this.slots[slotKey]?.container;
    if (targetContainer && inst.model.parent !== targetContainer) {
      try {
        if (inst.model.parent) {
          inst.model.parent.removeChild(inst.model);
        }
        targetContainer.addChild(inst.model);
      } catch (e) {}
    }

    const rect = this.slots[slotKey]?.rect;
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;

    const config = getLive2DConfig(characterId);
    const transformConfig = Live2DManager._normalizeTransform(characterId, config.transform || {}, rect.width, rect.height);

    const safePadding = Math.min(0.08, Math.max(0.0, Number(config?.safePadding) || 0.03));
    const bounds = inst.bounds || { x: 0, y: 0, width: inst.model.width || 500, height: inst.model.height || 800 };
    const scaleBaseMode = normalizeLive2DScaleBase(transformConfig.scaleBase);
    const overlayRefHeight = getOverlayReferenceHeight(this.mountEl, rect.height);
    const refHeight = scaleBaseMode === 'height' ? overlayRefHeight : rect.height;
    const baseScale = calculateLive2DBaseScale(
      rect.width,
      refHeight,
      bounds.width,
      bounds.height,
      safePadding,
      scaleBaseMode,
    );
    inst.baseScale = baseScale;

    const userScale = transformConfig.scale || 1.0;
    const finalScale = baseScale * userScale * (inst.speaking ? 1.03 : 1.0);
    if (inst.model.scale?.set) inst.model.scale.set(finalScale);

    const originX = rect.width / 2;
    const originY = scaleBaseMode === 'height' ? overlayRefHeight : rect.height;
    inst.model.x = originX + (transformConfig.offsetX || 0);
    inst.model.y = originY + (transformConfig.offsetY || 0);

    const containerInfo = Live2DManager.containers.get(characterId) || {};
    Live2DManager.containers.set(characterId, {
      ...containerInfo,
      app: this.app,
      canvas: this.canvas,
      renderWidth: rect.width,
      renderHeight: rect.height,
      width: rect.width,
      height: rect.height,
      slot: slotKey,
      baseScale: baseScale,
    });

    return true;
  },
};
