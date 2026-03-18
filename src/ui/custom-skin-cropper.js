import { topWindow } from '../core/env.js';

const DEFAULT_ASPECT_RATIO = 16 / 9;
const MIN_SCALE = 0.01;
const POINT_RADIUS = 9;
const TOUCH_RADIUS = 18;
const CONTENT_ALPHA_THRESHOLD = 24;
const MIN_CONTENT_AREA_RATIO = 0.015;
const MIN_OPAQUE_AREA_RATIO = 0.008;
const DEFAULT_HIT_AREA_POINT_COUNT = 16;
const CROP_HANDLE_RADIUS = 8;
const CROP_HANDLE_TOUCH_RADIUS = 18;
const CROP_BORDER_HIT_SIZE = 10;
const CROP_BORDER_TOUCH_SIZE = 18;
const MIN_CROP_SIZE = 32;
const DEFAULT_CHROMA_KEY_COLOR = '#00FF00';
const DEFAULT_CHROMA_KEY_TOLERANCE = 60;
const DEFAULT_MATTING_BRUSH_SIZE = 28;
const MIN_MATTING_BRUSH_SIZE = 4;
const MAX_MATTING_BRUSH_SIZE = 160;
const COMPONENT_CANDIDATE_HIT_PADDING = 10;
const COMPONENT_SELECTION_PADDING_RATIO = 0;
const TRANSPARENCY_GRID_SIZE = 12;
const TRANSPARENCY_GRID_LIGHT = '#f8fafc';
const TRANSPARENCY_GRID_DARK = '#cbd5e1';
const DEFAULT_POINTS = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

export class CustomSkinCropper {
  constructor(aspectRatio = DEFAULT_ASPECT_RATIO) {
    this.aspectRatio = aspectRatio;
    this.baseAspectRatio = aspectRatio;
    this.image = null;
    this.imageLoaded = false;
    this.sourceCanvas = null;
    this.sourceCtx = null;
    this.sourceImageData = null;
    this.mattingCanvas = null;
    this.mattingCtx = null;
    this.mattingImageData = null;
    this.canvas = null;
    this.ctx = null;
    this.scale = 1;
    this.stretchX = 1;
    this.stretchY = 1;
    this.minScale = 0.1;
    this.maxScale = 3;
    this.offsetX = 0;
    this.offsetY = 0;
    this.isDragging = false;
    this.dragMode = '';
    this.lastX = 0;
    this.lastY = 0;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragStartCropFrame = null;
    this.cropX = 0;
    this.cropY = 0;
    this.cropWidth = 0;
    this.cropHeight = 0;
    this.interactionMode = 'crop';
    this.cropFrameEditable = true;
    this.activeCropHandle = '';
    this.hoverCropHandle = '';
    this.hoverCropBorder = false;
    this.hitAreaPoints = DEFAULT_POINTS.map(point => ({ ...point }));
    this.activeHitPointIndex = -1;
    this.hoverHitPointIndex = -1;
    this.hoverMattingPoint = null;
    this.hoverComponentCandidateId = '';
    this.detectedContentBox = null;
    this.detectedComponentCandidates = [];
    this.componentCandidateLabels = {};
    this.selectedComponentCandidateId = '';
    this.componentCandidateOverlayEnabled = false;
    this.mattingEnabled = false;
    this.mattingApplied = false;
    this.mattingKeyColor = DEFAULT_CHROMA_KEY_COLOR;
    this.mattingKeyRgb = { r: 0, g: 255, b: 0 };
    this.mattingTolerance = DEFAULT_CHROMA_KEY_TOLERANCE;
    this.mattingBrushSize = DEFAULT_MATTING_BRUSH_SIZE;
    this.mattingBrushMode = 'erase';
    this.transparencyPattern = null;
    this.transparencyPatternContext = null;
    this.listenersBound = false;
    this.changeListener = null;
  }

  clampRatio(value, fallback = 0) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(0, Math.min(1, num));
  }

  clampStretch(value, fallback = 1) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(0.2, Math.min(3, num));
  }

  clampMattingBrushSize(value, fallback = DEFAULT_MATTING_BRUSH_SIZE) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(MIN_MATTING_BRUSH_SIZE, Math.min(MAX_MATTING_BRUSH_SIZE, Math.round(num)));
  }

  clampMattingTolerance(value, fallback = DEFAULT_CHROMA_KEY_TOLERANCE) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(0, Math.min(255, Math.round(num)));
  }

  normalizeHexColor(value, fallback = DEFAULT_CHROMA_KEY_COLOR) {
    const raw = String(value || '').trim().replace(/^#/, '').toUpperCase();
    const expanded = raw.length === 3
      ? raw.split('').map(char => `${char}${char}`).join('')
      : raw;
    if (/^[0-9A-F]{6}$/.test(expanded)) {
      return `#${expanded}`;
    }
    return fallback;
  }

  hexToRgb(value) {
    const hex = this.normalizeHexColor(value);
    return {
      r: Number.parseInt(hex.slice(1, 3), 16),
      g: Number.parseInt(hex.slice(3, 5), 16),
      b: Number.parseInt(hex.slice(5, 7), 16),
    };
  }

  createInternalCanvas(width, height) {
    const doc = topWindow?.document || document;
    const canvas = doc.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width || 1));
    canvas.height = Math.max(1, Math.round(height || 1));
    return canvas;
  }

  getTransparencyPattern() {
    if (!this.ctx) return null;
    if (this.transparencyPattern && this.transparencyPatternContext === this.ctx) {
      return this.transparencyPattern;
    }
    const patternCanvas = this.createInternalCanvas(TRANSPARENCY_GRID_SIZE * 2, TRANSPARENCY_GRID_SIZE * 2);
    const patternCtx = patternCanvas.getContext('2d');
    if (!patternCtx) return null;
    patternCtx.fillStyle = TRANSPARENCY_GRID_LIGHT;
    patternCtx.fillRect(0, 0, patternCanvas.width, patternCanvas.height);
    patternCtx.fillStyle = TRANSPARENCY_GRID_DARK;
    patternCtx.fillRect(0, 0, TRANSPARENCY_GRID_SIZE, TRANSPARENCY_GRID_SIZE);
    patternCtx.fillRect(
      TRANSPARENCY_GRID_SIZE,
      TRANSPARENCY_GRID_SIZE,
      TRANSPARENCY_GRID_SIZE,
      TRANSPARENCY_GRID_SIZE,
    );
    this.transparencyPattern = this.ctx.createPattern(patternCanvas, 'repeat');
    this.transparencyPatternContext = this.ctx;
    return this.transparencyPattern;
  }

  renderTransparencyBackground(width, height) {
    if (!this.ctx) return;
    const pattern = this.getTransparencyPattern();
    this.ctx.save();
    this.ctx.fillStyle = pattern || TRANSPARENCY_GRID_LIGHT;
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.restore();
  }

  createRectHitArea() {
    return DEFAULT_POINTS.map(point => ({ ...point }));
  }

  sanitizeHitAreaPoints(points) {
    const safePoints = (Array.isArray(points) ? points : [])
      .map(point => ({
        x: this.clampRatio(point?.x, 0),
        y: this.clampRatio(point?.y, 0),
      }))
      .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
    return safePoints.length >= 3 ? safePoints : this.createRectHitArea();
  }

  normalizeContentBox(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const x = this.clampRatio(raw.x, 0);
    const y = this.clampRatio(raw.y, 0);
    const width = Math.max(0, Math.min(1 - x, this.clampRatio(raw.width, 0)));
    const height = Math.max(0, Math.min(1 - y, this.clampRatio(raw.height, 0)));
    if (width <= 0 || height <= 0) return null;
    return { x, y, width, height };
  }

  clearDetectedContentBox(shouldRender = true) {
    this.detectedContentBox = null;
    if (shouldRender) this.render();
  }

  setDetectedContentBox(raw, shouldRender = true) {
    this.detectedContentBox = this.normalizeContentBox(raw);
    if (shouldRender) this.render();
  }

  getDetectedContentBox() {
    return this.detectedContentBox ? { ...this.detectedContentBox } : null;
  }

  clearDetectedComponentCandidates(shouldRender = true) {
    this.detectedComponentCandidates = [];
    this.componentCandidateLabels = {};
    this.selectedComponentCandidateId = '';
    this.hoverComponentCandidateId = '';
    if (shouldRender) this.render();
  }

  getDetectedComponentCandidates() {
    return this.detectedComponentCandidates.map(candidate => ({
      ...candidate,
      bounds: candidate?.bounds ? { ...candidate.bounds } : null,
      box: candidate?.box ? { ...candidate.box } : null,
      hitAreaPoints: Array.isArray(candidate?.hitAreaPoints)
        ? candidate.hitAreaPoints.map(point => ({ ...point }))
        : this.createRectHitArea(),
      label: String(this.componentCandidateLabels?.[candidate.id] || '').trim(),
    }));
  }

  getDetectedComponentCandidateById(candidateId) {
    const safeId = String(candidateId || '').trim();
    if (!safeId) return null;
    return this.getDetectedComponentCandidates().find(candidate => candidate.id === safeId) || null;
  }

  setComponentCandidateOverlayEnabled(enabled, shouldRender = true) {
    this.componentCandidateOverlayEnabled = enabled === true;
    if (!this.componentCandidateOverlayEnabled) {
      this.hoverComponentCandidateId = '';
    }
    if (shouldRender) this.render();
  }

  setComponentCandidateLabels(labels, shouldRender = true) {
    const nextLabels = {};
    if (labels && typeof labels === 'object') {
      Object.entries(labels).forEach(([candidateId, label]) => {
        const safeCandidateId = String(candidateId || '').trim();
        const safeLabel = String(label || '').trim();
        if (!safeCandidateId || !safeLabel) return;
        nextLabels[safeCandidateId] = safeLabel;
      });
    }
    this.componentCandidateLabels = nextLabels;
    if (shouldRender) this.render();
  }

  setSelectedComponentCandidate(candidateId, options = {}) {
    const safeId = String(candidateId || '').trim();
    const exists = !!safeId && this.detectedComponentCandidates.some(candidate => candidate.id === safeId);
    this.selectedComponentCandidateId = exists ? safeId : '';
    if (this.selectedComponentCandidateId && options.syncCropFrame === true) {
      this.applyComponentCandidateToCropFrame(this.selectedComponentCandidateId, {
        paddingRatio: options.paddingRatio,
        shouldRender: false,
      });
    }
    if (options.shouldRender !== false) {
      this.render();
    }
  }

  getSelectedComponentCandidate() {
    return this.getDetectedComponentCandidateById(this.selectedComponentCandidateId);
  }

  setChangeListener(listener) {
    this.changeListener = typeof listener === 'function' ? listener : null;
    this.notifyChange();
  }

  notifyChange(payload = null) {
    if (typeof this.changeListener !== 'function') return;
    this.changeListener(payload);
  }

  getMattingState() {
    return {
      enabled: this.mattingEnabled,
      applied: this.mattingApplied,
      keyColor: this.mattingKeyColor,
      tolerance: this.mattingTolerance,
      brushSize: this.mattingBrushSize,
      brushMode: this.mattingBrushMode,
      colorPicking: this.interactionMode === 'pick',
    };
  }

  getMattingPreset() {
    return {
      color: this.mattingKeyColor,
      tolerance: this.mattingTolerance,
    };
  }

  hasMattingPreview() {
    return !!this.mattingCanvas && !!this.mattingApplied;
  }

  setMattingEnabled(enabled, options = {}) {
    this.mattingEnabled = enabled === true;
    if (!this.mattingEnabled && options.keepPreview !== true) {
      this.resetMattingPreview(false);
    }
    if (options.shouldRender === false) {
      this.notifyChange({ type: 'matting-state', state: this.getMattingState() });
      return;
    }
    this.render({ type: 'matting-state', state: this.getMattingState() });
  }

  setMattingKeyColor(value, options = {}) {
    const nextColor = this.normalizeHexColor(value, this.mattingKeyColor);
    this.mattingKeyColor = nextColor;
    this.mattingKeyRgb = this.hexToRgb(nextColor);
    if (options.shouldRender === false) {
      this.notifyChange({ type: 'matting-settings', state: this.getMattingState() });
      return nextColor;
    }
    this.render({ type: 'matting-settings', state: this.getMattingState() });
    return nextColor;
  }

  setMattingTolerance(value, options = {}) {
    this.mattingTolerance = this.clampMattingTolerance(value, this.mattingTolerance);
    if (options.shouldRender === false) {
      this.notifyChange({ type: 'matting-settings', state: this.getMattingState() });
      return this.mattingTolerance;
    }
    this.render({ type: 'matting-settings', state: this.getMattingState() });
    return this.mattingTolerance;
  }

  setMattingBrushSize(value, options = {}) {
    this.mattingBrushSize = this.clampMattingBrushSize(value, this.mattingBrushSize);
    if (options.shouldRender === false) {
      this.notifyChange({ type: 'matting-settings', state: this.getMattingState() });
      return this.mattingBrushSize;
    }
    this.render({ type: 'matting-settings', state: this.getMattingState() });
    return this.mattingBrushSize;
  }

  setMattingBrushMode(mode, options = {}) {
    this.mattingBrushMode = mode === 'keep' ? 'keep' : 'erase';
    if (options.shouldRender === false) {
      this.notifyChange({ type: 'matting-settings', state: this.getMattingState() });
      return this.mattingBrushMode;
    }
    this.render({ type: 'matting-settings', state: this.getMattingState() });
    return this.mattingBrushMode;
  }

  createSourceBuffer() {
    if (!this.image || !this.imageLoaded) return false;
    const canvas = this.createInternalCanvas(this.image.width, this.image.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.image, 0, 0);
    this.sourceCanvas = canvas;
    this.sourceCtx = ctx;
    this.sourceImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return true;
  }

  getOpaqueSourceBuffer() {
    if (!this.image || !this.imageLoaded) return null;
    if (this.hasMattingPreview() && this.mattingCanvas && this.mattingImageData) {
      return {
        canvas: this.mattingCanvas,
        imageData: this.mattingImageData,
        width: this.mattingImageData.width,
        height: this.mattingImageData.height,
      };
    }
    if (!this.sourceImageData && !this.createSourceBuffer()) return null;
    return {
      canvas: this.sourceCanvas,
      imageData: this.sourceImageData,
      width: this.sourceImageData.width,
      height: this.sourceImageData.height,
    };
  }

  resetMattingPreview(notify = true) {
    this.mattingCanvas = null;
    this.mattingCtx = null;
    this.mattingImageData = null;
    this.mattingApplied = false;
    this.clearDetectedComponentCandidates(false);
    if (notify) {
      this.notifyChange({ type: 'matting-preview-reset', state: this.getMattingState() });
    }
  }

  clearMatting(shouldRender = true) {
    this.resetMattingPreview(false);
    if (this.interactionMode === 'pick' || this.interactionMode === 'matting') {
      this.interactionMode = 'crop';
    }
    if (shouldRender) {
      this.render({ type: 'matting-cleared', state: this.getMattingState() });
    } else {
      this.notifyChange({ type: 'matting-cleared', state: this.getMattingState() });
    }
  }

  ensureMattingBuffer() {
    if (!this.sourceImageData && !this.createSourceBuffer()) return false;
    const width = this.sourceImageData?.width || this.image?.width || 0;
    const height = this.sourceImageData?.height || this.image?.height || 0;
    if (!width || !height) return false;
    if (this.mattingCanvas && this.mattingCtx && this.mattingImageData) return true;

    const canvas = this.createInternalCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;

    this.mattingCanvas = canvas;
    this.mattingCtx = ctx;
    this.mattingImageData = new ImageData(new Uint8ClampedArray(this.sourceImageData.data), width, height);
    this.mattingCtx.putImageData(this.mattingImageData, 0, 0);
    return true;
  }

  getRenderSource() {
    return this.hasMattingPreview() ? this.mattingCanvas : this.image;
  }

  canvasPointToImagePoint(position) {
    const metrics = this.getDrawMetrics();
    if (!metrics || !this.image || !this.imageLoaded) return null;
    const x = Math.floor((position.x - metrics.drawX) / metrics.effectiveScaleX);
    const y = Math.floor((position.y - metrics.drawY) / metrics.effectiveScaleY);
    if (x < 0 || y < 0 || x >= this.image.width || y >= this.image.height) return null;
    return { x, y };
  }

  sampleColorAtCanvasPoint(position) {
    const point = this.canvasPointToImagePoint(position);
    if (!point) return null;
    if (!this.sourceImageData && !this.createSourceBuffer()) return null;
    const index = ((point.y * this.sourceImageData.width) + point.x) * 4;
    const data = this.sourceImageData.data;
    const hex = this.normalizeHexColor(
      `#${data[index].toString(16).padStart(2, '0')}${data[index + 1].toString(16).padStart(2, '0')}${data[index + 2].toString(16).padStart(2, '0')}`,
      DEFAULT_CHROMA_KEY_COLOR,
    );
    this.setMattingKeyColor(hex, { shouldRender: false });
    return {
      x: point.x,
      y: point.y,
      color: hex,
    };
  }

  getBaseAspectRatio() {
    const ratio = Number(this.baseAspectRatio || this.aspectRatio || DEFAULT_ASPECT_RATIO);
    return Number.isFinite(ratio) && ratio > 0 ? ratio : DEFAULT_ASPECT_RATIO;
  }

  getEditorAspectRatio() {
    const ratio = Number(this.aspectRatio || this.getBaseAspectRatio());
    return Number.isFinite(ratio) && ratio > 0 ? ratio : this.getBaseAspectRatio();
  }

  setBaseAspectRatio(nextAspectRatio) {
    const safeAspectRatio = Number(nextAspectRatio);
    if (!Number.isFinite(safeAspectRatio) || safeAspectRatio <= 0) return;
    this.baseAspectRatio = safeAspectRatio;
  }

  getContainerSize() {
    return {
      width: this.canvas?.width || 500,
      height: this.canvas?.height || 320,
    };
  }

  calculateCropSize(aspectRatio = this.getEditorAspectRatio()) {
    const { width: containerWidth, height: containerHeight } = this.getContainerSize();
    let cropHeight = containerHeight * 0.8;
    let cropWidth = cropHeight * aspectRatio;
    if (cropWidth > containerWidth * 0.8) {
      cropWidth = containerWidth * 0.8;
      cropHeight = cropWidth / aspectRatio;
    }
    return {
      containerWidth,
      containerHeight,
      cropWidth,
      cropHeight,
    };
  }

  hasCropFrame() {
    return Number.isFinite(this.cropWidth) && this.cropWidth > 0
      && Number.isFinite(this.cropHeight) && this.cropHeight > 0
      && Number.isFinite(this.cropX) && Number.isFinite(this.cropY);
  }

  getDefaultCropFrame(aspectRatio = this.getEditorAspectRatio()) {
    const { containerWidth, containerHeight, cropWidth, cropHeight } = this.calculateCropSize(aspectRatio);
    return {
      x: (containerWidth - cropWidth) / 2,
      y: (containerHeight - cropHeight) / 2,
      width: cropWidth,
      height: cropHeight,
    };
  }

  ensureCropFrame() {
    if (this.hasCropFrame()) return this.getCropFrame();
    const frame = this.getDefaultCropFrame();
    this.cropX = frame.x;
    this.cropY = frame.y;
    this.cropWidth = frame.width;
    this.cropHeight = frame.height;
    return frame;
  }

  getCropFrame() {
    if (!this.hasCropFrame()) {
      return this.getDefaultCropFrame();
    }
    return {
      x: this.cropX,
      y: this.cropY,
      width: this.cropWidth,
      height: this.cropHeight,
    };
  }

  getCropAspectRatio() {
    const frame = this.getCropFrame();
    return Math.max(0.01, frame.width / Math.max(frame.height, 1));
  }

  normalizeCropFrame(frame) {
    const defaultFrame = this.getDefaultCropFrame();
    const { width: containerWidth, height: containerHeight } = this.getContainerSize();
    const minWidth = Math.min(Math.max(MIN_CROP_SIZE, 1), containerWidth);
    const minHeight = Math.min(Math.max(MIN_CROP_SIZE, 1), containerHeight);
    const safeWidth = Number.isFinite(Number(frame?.width)) ? Number(frame.width) : defaultFrame.width;
    const safeHeight = Number.isFinite(Number(frame?.height)) ? Number(frame.height) : defaultFrame.height;
    const width = Math.max(minWidth, Math.min(containerWidth, safeWidth));
    const height = Math.max(minHeight, Math.min(containerHeight, safeHeight));
    const safeX = Number.isFinite(Number(frame?.x)) ? Number(frame.x) : defaultFrame.x;
    const safeY = Number.isFinite(Number(frame?.y)) ? Number(frame.y) : defaultFrame.y;
    const x = Math.max(0, Math.min(containerWidth - width, safeX));
    const y = Math.max(0, Math.min(containerHeight - height, safeY));
    return { x, y, width, height };
  }

  applyCropFrame(frame, options = {}) {
    const preserveView = options.preserveView === true;
    const shouldRender = options.shouldRender !== false;
    const syncScaleToCover = options.syncScaleToCover === true;
    const shouldConstrainOffset = options.constrainOffset !== false;
    const previousFrame = this.getCropFrame();
    const focusPoint = preserveView ? this.getFrameFocusPoint(previousFrame) : null;
    const nextFrame = this.normalizeCropFrame(frame);

    this.cropX = nextFrame.x;
    this.cropY = nextFrame.y;
    this.cropWidth = nextFrame.width;
    this.cropHeight = nextFrame.height;
    this.clearDetectedContentBox(false);

    if (this.image && this.imageLoaded) {
      const { coverScale, maxScale } = this.getScaleBounds();
      this.minScale = MIN_SCALE;
      this.maxScale = maxScale;
      if (syncScaleToCover) {
        this.scale = Math.max(this.minScale, Math.min(this.maxScale, Math.max(this.scale, coverScale)));
      } else {
        this.scale = Math.max(this.minScale, Math.min(this.maxScale, this.scale));
      }
      if (focusPoint) {
        this.setFocusPointAtFrameCenter(focusPoint, nextFrame);
      }
      if (shouldConstrainOffset) {
        this.constrainOffset();
      }
    }

    if (shouldRender) {
      this.render();
    } else {
      this.notifyChange();
    }
  }

  setCropFrame(frame, options = {}) {
    this.applyCropFrame(frame, options);
  }

  setCropFrameEditable(editable) {
    const nextEditable = editable !== false;
    if (this.cropFrameEditable === nextEditable) return;
    this.cropFrameEditable = nextEditable;
    this.activeCropHandle = '';
    this.hoverCropHandle = '';
    this.hoverCropBorder = false;
    if (!nextEditable && (this.dragMode === 'crop-resize' || this.dragMode === 'crop-move')) {
      this.dragMode = '';
      this.isDragging = false;
    }
    this.updateCursor();
    this.render();
  }

  getEventPosition(event) {
    if (!this.canvas) return { x: 0, y: 0 };
    const rect = this.canvas.getBoundingClientRect();
    const point = event?.touches?.[0] || event?.changedTouches?.[0] || event;
    const scaleX = rect.width > 0 ? this.canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? this.canvas.height / rect.height : 1;
    return {
      x: (point.clientX - rect.left) * scaleX,
      y: (point.clientY - rect.top) * scaleY,
    };
  }

  cropPointToCanvas(point) {
    const frame = this.getCropFrame();
    return {
      x: frame.x + this.clampRatio(point?.x, 0) * frame.width,
      y: frame.y + this.clampRatio(point?.y, 0) * frame.height,
    };
  }

  canvasPointToCrop(point) {
    const frame = this.getCropFrame();
    return {
      x: this.clampRatio((point.x - frame.x) / Math.max(frame.width, 1), 0),
      y: this.clampRatio((point.y - frame.y) / Math.max(frame.height, 1), 0),
    };
  }

  getComponentCandidateCanvasRect(candidate, metrics = this.getDrawMetrics()) {
    if (!candidate || !metrics || !this.image || !this.imageLoaded) return null;
    return {
      x: metrics.drawX + (candidate.box.x * this.image.width * metrics.effectiveScaleX),
      y: metrics.drawY + (candidate.box.y * this.image.height * metrics.effectiveScaleY),
      width: candidate.box.width * this.image.width * metrics.effectiveScaleX,
      height: candidate.box.height * this.image.height * metrics.effectiveScaleY,
    };
  }

  findComponentCandidateAtPosition(position, padding = COMPONENT_CANDIDATE_HIT_PADDING) {
    if (!this.componentCandidateOverlayEnabled || this.detectedComponentCandidates.length === 0) return null;
    const metrics = this.getDrawMetrics();
    if (!metrics) return null;
    for (let index = this.detectedComponentCandidates.length - 1; index >= 0; index -= 1) {
      const candidate = this.detectedComponentCandidates[index];
      const rect = this.getComponentCandidateCanvasRect(candidate, metrics);
      if (!rect) continue;
      const withinX = position.x >= (rect.x - padding) && position.x <= (rect.x + rect.width + padding);
      const withinY = position.y >= (rect.y - padding) && position.y <= (rect.y + rect.height + padding);
      if (withinX && withinY) {
        return candidate;
      }
    }
    return null;
  }

  updateComponentCandidateHover(position) {
    const nextCandidate = this.findComponentCandidateAtPosition(position);
    const nextId = nextCandidate?.id || '';
    if (nextId === this.hoverComponentCandidateId) return false;
    this.hoverComponentCandidateId = nextId;
    return true;
  }

  findHitPointIndex(position, radius = POINT_RADIUS) {
    for (let index = 0; index < this.hitAreaPoints.length; index += 1) {
      const point = this.cropPointToCanvas(this.hitAreaPoints[index]);
      const dx = point.x - position.x;
      const dy = point.y - position.y;
      if (Math.sqrt((dx * dx) + (dy * dy)) <= radius) {
        return index;
      }
    }
    return -1;
  }

  getCropHandleDefinitions(frame = this.getCropFrame()) {
    const centerX = frame.x + (frame.width / 2);
    const centerY = frame.y + (frame.height / 2);
    return [
      { name: 'nw', x: frame.x, y: frame.y, cursor: 'nwse-resize' },
      { name: 'n', x: centerX, y: frame.y, cursor: 'ns-resize' },
      { name: 'ne', x: frame.x + frame.width, y: frame.y, cursor: 'nesw-resize' },
      { name: 'e', x: frame.x + frame.width, y: centerY, cursor: 'ew-resize' },
      { name: 'se', x: frame.x + frame.width, y: frame.y + frame.height, cursor: 'nwse-resize' },
      { name: 's', x: centerX, y: frame.y + frame.height, cursor: 'ns-resize' },
      { name: 'sw', x: frame.x, y: frame.y + frame.height, cursor: 'nesw-resize' },
      { name: 'w', x: frame.x, y: centerY, cursor: 'ew-resize' },
    ];
  }

  findCropHandle(position, radius = CROP_HANDLE_RADIUS) {
    const handles = this.getCropHandleDefinitions();
    let matched = null;
    let closestDistance = Infinity;
    handles.forEach(handle => {
      const dx = handle.x - position.x;
      const dy = handle.y - position.y;
      const distance = Math.sqrt((dx * dx) + (dy * dy));
      if (distance <= radius && distance < closestDistance) {
        matched = handle;
        closestDistance = distance;
      }
    });
    return matched;
  }

  isPointInsideFrame(position, frame = this.getCropFrame()) {
    return position.x >= frame.x
      && position.x <= frame.x + frame.width
      && position.y >= frame.y
      && position.y <= frame.y + frame.height;
  }

  isPointInsideImage(position, metrics = this.getDrawMetrics()) {
    if (!position || !metrics) return false;
    return position.x >= metrics.drawX
      && position.x <= metrics.drawX + metrics.scaledWidth
      && position.y >= metrics.drawY
      && position.y <= metrics.drawY + metrics.scaledHeight;
  }

  isPointOnCropBorder(position, threshold = CROP_BORDER_HIT_SIZE, frame = this.getCropFrame()) {
    const withinOuter = position.x >= frame.x - threshold
      && position.x <= frame.x + frame.width + threshold
      && position.y >= frame.y - threshold
      && position.y <= frame.y + frame.height + threshold;
    if (!withinOuter) return false;
    const withinInner = position.x >= frame.x + threshold
      && position.x <= frame.x + frame.width - threshold
      && position.y >= frame.y + threshold
      && position.y <= frame.y + frame.height - threshold;
    return !withinInner;
  }

  resizeCropFrame(handleName, deltaX, deltaY) {
    const source = this.dragStartCropFrame || this.getCropFrame();
    const { width: containerWidth, height: containerHeight } = this.getContainerSize();
    const minWidth = Math.min(Math.max(MIN_CROP_SIZE, 1), containerWidth);
    const minHeight = Math.min(Math.max(MIN_CROP_SIZE, 1), containerHeight);
    let { x, y, width, height } = source;

    if (handleName.includes('w')) {
      const right = source.x + source.width;
      x = Math.max(0, Math.min(source.x + deltaX, right - minWidth));
      width = right - x;
    } else if (handleName.includes('e')) {
      width = Math.max(minWidth, Math.min(containerWidth - source.x, source.width + deltaX));
    }

    if (handleName.includes('n')) {
      const bottom = source.y + source.height;
      y = Math.max(0, Math.min(source.y + deltaY, bottom - minHeight));
      height = bottom - y;
    } else if (handleName.includes('s')) {
      height = Math.max(minHeight, Math.min(containerHeight - source.y, source.height + deltaY));
    }

    return { x, y, width, height };
  }

  moveCropFrame(deltaX, deltaY) {
    const source = this.dragStartCropFrame || this.getCropFrame();
    const { width: containerWidth, height: containerHeight } = this.getContainerSize();
    return {
      x: Math.max(0, Math.min(containerWidth - source.width, source.x + deltaX)),
      y: Math.max(0, Math.min(containerHeight - source.height, source.y + deltaY)),
      width: source.width,
      height: source.height,
    };
  }

  updateCropHoverState(position, isTouch = false) {
    if (this.interactionMode !== 'crop' || !this.cropFrameEditable) {
      const changed = !!this.hoverCropHandle || this.hoverCropBorder;
      this.hoverCropHandle = '';
      this.hoverCropBorder = false;
      return changed;
    }

    const radius = isTouch ? CROP_HANDLE_TOUCH_RADIUS : CROP_HANDLE_RADIUS;
    const borderSize = isTouch ? CROP_BORDER_TOUCH_SIZE : CROP_BORDER_HIT_SIZE;
    const handle = this.findCropHandle(position, radius);
    const nextHandle = handle?.name || '';
    const nextBorder = !nextHandle && this.isPointOnCropBorder(position, borderSize);
    const changed = this.hoverCropHandle !== nextHandle || this.hoverCropBorder !== nextBorder;
    this.hoverCropHandle = nextHandle;
    this.hoverCropBorder = nextBorder;
    return changed;
  }

  updateCursor() {
    const wrapper = this.canvas?.parentElement;
    if (!wrapper) return;
    if (this.interactionMode === 'pick') {
      wrapper.style.cursor = 'crosshair';
      return;
    }
    if (this.interactionMode === 'matting') {
      wrapper.style.cursor = 'crosshair';
      return;
    }
    if (this.interactionMode === 'hit') {
      if (this.isDragging && this.activeHitPointIndex >= 0) {
        wrapper.style.cursor = 'grabbing';
      } else if (this.hoverHitPointIndex >= 0) {
        wrapper.style.cursor = 'grab';
      } else {
        wrapper.style.cursor = 'crosshair';
      }
      return;
    }
    if (this.dragMode === 'crop-resize' && this.activeCropHandle) {
      const activeHandle = this.getCropHandleDefinitions().find(handle => handle.name === this.activeCropHandle);
      wrapper.style.cursor = activeHandle?.cursor || 'move';
      return;
    }
    if (this.dragMode === 'crop-move') {
      wrapper.style.cursor = 'move';
      return;
    }
    if (this.componentCandidateOverlayEnabled
      && this.hoverComponentCandidateId
      && this.hoverComponentCandidateId !== this.selectedComponentCandidateId) {
      wrapper.style.cursor = 'pointer';
      return;
    }
    if (this.cropFrameEditable && this.hoverCropHandle) {
      const hoverHandle = this.getCropHandleDefinitions().find(handle => handle.name === this.hoverCropHandle);
      wrapper.style.cursor = hoverHandle?.cursor || 'move';
      return;
    }
    if (this.cropFrameEditable && this.hoverCropBorder) {
      wrapper.style.cursor = 'move';
      return;
    }
    wrapper.style.cursor = this.imageLoaded
      ? (this.isDragging ? 'grabbing' : 'grab')
      : 'default';
  }

  loadImage(source) {
    return new Promise((resolve, reject) => {
      const ImageCtor = topWindow?.Image || Image;
      this.clearDetectedContentBox(false);
      this.clearDetectedComponentCandidates(false);
      this.resetMattingPreview(false);
      this.hoverMattingPoint = null;
      this.stretchX = 1;
      this.stretchY = 1;
      this.image = new ImageCtor();
      this.image.onload = () => {
        this.imageLoaded = true;
        this.createSourceBuffer();
        if (this.canvas) {
          this.calculateInitialScale();
          this.render();
        }
        resolve(this.image);
      };
      this.image.onerror = reject;

      if (typeof source === 'string') {
        this.image.src = source;
        return;
      }

      const isFileLike = !!source
        && typeof source === 'object'
        && typeof source.size === 'number'
        && typeof source.type === 'string'
        && (typeof source.arrayBuffer === 'function' || typeof source.slice === 'function');

      if (isFileLike) {
        const ReaderCtor = topWindow?.FileReader || FileReader;
        const reader = new ReaderCtor();
        reader.onload = event => {
          this.image.src = event.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(source);
        return;
      }

      reject(new Error('Unsupported image source'));
    });
  }

  clearImage() {
    this.image = null;
    this.imageLoaded = false;
    this.sourceCanvas = null;
    this.sourceCtx = null;
    this.sourceImageData = null;
    this.scale = 1;
    this.stretchX = 1;
    this.stretchY = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.isDragging = false;
    this.dragMode = '';
    this.activeCropHandle = '';
    this.hoverCropHandle = '';
    this.hoverCropBorder = false;
    this.hoverMattingPoint = null;
    this.hoverComponentCandidateId = '';
    this.dragStartCropFrame = null;
    this.resetMattingPreview(false);
    this.clearDetectedContentBox(false);
    this.clearDetectedComponentCandidates(false);
  }

  getScaleBounds() {
    if (!this.image || !this.imageLoaded) {
      return {
        containScale: 1,
        coverScale: 1,
        maxScale: 3,
      };
    }
    const frame = this.getCropFrame();
    const scaleToFitWidth = frame.width / Math.max(this.image.width * this.stretchX, 1);
    const scaleToFitHeight = frame.height / Math.max(this.image.height * this.stretchY, 1);
    const containScale = Math.min(scaleToFitWidth, scaleToFitHeight);
    const coverScale = Math.max(scaleToFitWidth, scaleToFitHeight);
    return {
      containScale,
      coverScale,
      maxScale: Math.max(coverScale * 5, 3),
    };
  }

  getDrawMetrics(
    scale = this.scale,
    offsetX = this.offsetX,
    offsetY = this.offsetY,
    stretchX = this.stretchX,
    stretchY = this.stretchY,
  ) {
    if (!this.image || !this.imageLoaded) return null;
    const { width: containerWidth, height: containerHeight } = this.getContainerSize();
    const effectiveScaleX = scale * stretchX;
    const effectiveScaleY = scale * stretchY;
    const scaledWidth = this.image.width * effectiveScaleX;
    const scaledHeight = this.image.height * effectiveScaleY;
    return {
      containerWidth,
      containerHeight,
      effectiveScaleX,
      effectiveScaleY,
      scaledWidth,
      scaledHeight,
      drawX: ((containerWidth - scaledWidth) / 2) + offsetX,
      drawY: ((containerHeight - scaledHeight) / 2) + offsetY,
    };
  }

  getFrameFocusPoint(frame = this.getCropFrame()) {
    const metrics = this.getDrawMetrics();
    if (!metrics || !metrics.effectiveScaleX || !metrics.effectiveScaleY) return null;
    return {
      x: Math.max(0, Math.min(this.image.width, ((frame.x + (frame.width / 2)) - metrics.drawX) / metrics.effectiveScaleX)),
      y: Math.max(0, Math.min(this.image.height, ((frame.y + (frame.height / 2)) - metrics.drawY) / metrics.effectiveScaleY)),
    };
  }

  setFocusPointAtFrameCenter(point, frame = this.getCropFrame()) {
    if (!this.image || !this.imageLoaded || !point) return;
    const metrics = this.getDrawMetrics(this.scale, 0, 0, this.stretchX, this.stretchY);
    if (!metrics) return;
    const frameCenterX = frame.x + (frame.width / 2);
    const frameCenterY = frame.y + (frame.height / 2);
    this.offsetX = frameCenterX - (point.x * metrics.effectiveScaleX) - ((metrics.containerWidth - metrics.scaledWidth) / 2);
    this.offsetY = frameCenterY - (point.y * metrics.effectiveScaleY) - ((metrics.containerHeight - metrics.scaledHeight) / 2);
  }

  calculateInitialScale() {
    if (!this.canvas || !this.image || !this.imageLoaded) return;
    this.clearDetectedContentBox(false);
    this.ensureCropFrame();
    const { coverScale, maxScale } = this.getScaleBounds();
    this.minScale = MIN_SCALE;
    this.maxScale = maxScale;
    this.scale = Math.max(this.minScale, Math.min(this.maxScale, coverScale * 1.2));
    this.offsetX = 0;
    this.offsetY = 0;
    this.constrainOffset();
  }

  attachToCanvas(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.setupEventListeners();
    if (this.imageLoaded) {
      this.calculateInitialScale();
      this.render();
    }
  }

  setupEventListeners() {
    if (!this.canvas || this.listenersBound) return;
    const wrapper = this.canvas.parentElement;
    if (!wrapper) return;
    const win = topWindow || window;

    const beginPointer = (event, isTouch = false) => {
      const position = this.getEventPosition(event);
      this.lastX = position.x;
      this.lastY = position.y;
      this.dragStartX = position.x;
      this.dragStartY = position.y;
      this.hoverMattingPoint = position;

      if (this.interactionMode === 'pick') {
        if (!this.imageLoaded) {
          this.render();
          return;
        }
        const sampled = this.sampleColorAtCanvasPoint(position);
        if (sampled) {
          this.interactionMode = 'matting';
          this.updateCursor();
          this.render({ type: 'matting-color-picked', color: sampled.color, state: this.getMattingState() });
        } else {
          this.render();
        }
        if (isTouch && typeof event.preventDefault === 'function') event.preventDefault();
        return;
      }

      if (this.interactionMode === 'matting') {
        if (!this.imageLoaded || !this.hasMattingPreview()) {
          this.isDragging = false;
          this.updateCursor();
          this.render();
          return;
        }
        this.isDragging = true;
        this.dragMode = 'matting-paint';
        this.paintMattingAtCanvasPoint(position, this.mattingBrushMode, false);
        this.updateCursor();
        this.render({ type: 'matting-paint', state: this.getMattingState() });
        if (isTouch && typeof event.preventDefault === 'function') event.preventDefault();
        return;
      }

      if (this.interactionMode === 'hit') {
        const radius = isTouch ? TOUCH_RADIUS : POINT_RADIUS;
        this.activeHitPointIndex = this.findHitPointIndex(position, radius);
        this.hoverHitPointIndex = this.activeHitPointIndex;
        this.isDragging = this.activeHitPointIndex >= 0;
        this.updateCursor();
        this.render();
        return;
      }

      this.dragMode = '';
      this.activeCropHandle = '';
      this.dragStartCropFrame = null;

      if (this.cropFrameEditable) {
        const handle = this.findCropHandle(position, isTouch ? CROP_HANDLE_TOUCH_RADIUS : CROP_HANDLE_RADIUS);
        if (handle) {
          this.isDragging = true;
          this.dragMode = 'crop-resize';
          this.activeCropHandle = handle.name;
          this.hoverCropHandle = handle.name;
          this.hoverCropBorder = false;
          this.dragStartCropFrame = this.getCropFrame();
          this.updateCursor();
          this.render();
          if (isTouch && typeof event.preventDefault === 'function') event.preventDefault();
          return;
        }

        if (this.isPointOnCropBorder(position, isTouch ? CROP_BORDER_TOUCH_SIZE : CROP_BORDER_HIT_SIZE)) {
          this.isDragging = true;
          this.dragMode = 'crop-move';
          this.hoverCropHandle = '';
          this.hoverCropBorder = true;
          this.dragStartCropFrame = this.getCropFrame();
          this.updateCursor();
          this.render();
          if (isTouch && typeof event.preventDefault === 'function') event.preventDefault();
          return;
        }
      }

      const hitCandidate = this.findComponentCandidateAtPosition(position, isTouch ? TOUCH_RADIUS : COMPONENT_CANDIDATE_HIT_PADDING);
      if (hitCandidate) {
        this.hoverComponentCandidateId = hitCandidate.id;
      }
      if (hitCandidate && hitCandidate.id !== this.selectedComponentCandidateId) {
        this.setSelectedComponentCandidate(hitCandidate.id, {
          syncCropFrame: true,
          paddingRatio: COMPONENT_SELECTION_PADDING_RATIO,
          shouldRender: false,
        });
        this.updateCursor();
        this.render({ type: 'component-candidate-selected', candidateId: hitCandidate.id, candidate: this.getSelectedComponentCandidate() });
        if (isTouch && typeof event.preventDefault === 'function') event.preventDefault();
        return;
      }

      const canStartImageMove = this.imageLoaded
        && (this.isPointInsideFrame(position) || this.isPointInsideImage(position));
      if (!canStartImageMove) {
        this.isDragging = false;
        this.updateCropHoverState(position, isTouch);
        this.updateCursor();
        this.render();
        return;
      }

      this.isDragging = true;
      this.dragMode = 'image-move';
      this.updateCursor();
      if (isTouch && typeof event.preventDefault === 'function') event.preventDefault();
    };

    const movePointer = (event, isTouch = false) => {
      const position = this.getEventPosition(event);
      this.hoverMattingPoint = position;
      if (this.interactionMode === 'pick') {
        this.updateCursor();
        this.render();
        return;
      }

      if (this.interactionMode === 'matting') {
        if (this.isDragging && this.dragMode === 'matting-paint') {
          this.paintMattingAtCanvasPoint(position, this.mattingBrushMode, false);
          if (isTouch && typeof event.preventDefault === 'function') event.preventDefault();
          this.render({ type: 'matting-paint', state: this.getMattingState() });
        } else {
          this.updateCursor();
          this.render();
        }
        return;
      }

      if (this.interactionMode === 'hit') {
        this.hoverHitPointIndex = this.findHitPointIndex(position, isTouch ? TOUCH_RADIUS : POINT_RADIUS);
        if (this.isDragging && this.activeHitPointIndex >= 0) {
          this.hitAreaPoints[this.activeHitPointIndex] = this.canvasPointToCrop(position);
          if (isTouch && typeof event.preventDefault === 'function') event.preventDefault();
          this.render();
        } else {
          this.updateCursor();
          this.render();
        }
        return;
      }

      if (!this.isDragging) {
        const candidateHoverChanged = this.updateComponentCandidateHover(position);
        if (this.updateCropHoverState(position, isTouch) || candidateHoverChanged) {
          this.updateCursor();
          this.render();
        } else {
          this.updateCursor();
        }
        return;
      }

      if (this.dragMode === 'crop-resize' && this.activeCropHandle) {
        const nextFrame = this.resizeCropFrame(
          this.activeCropHandle,
          position.x - this.dragStartX,
          position.y - this.dragStartY,
        );
        if (isTouch && typeof event.preventDefault === 'function') event.preventDefault();
        this.applyCropFrame(nextFrame, { preserveView: false, constrainOffset: false });
        return;
      }

      if (this.dragMode === 'crop-move') {
        const nextFrame = this.moveCropFrame(position.x - this.dragStartX, position.y - this.dragStartY);
        if (isTouch && typeof event.preventDefault === 'function') event.preventDefault();
        this.applyCropFrame(nextFrame, { preserveView: false, constrainOffset: false });
        return;
      }

      if (this.dragMode !== 'image-move') {
        return;
      }

      const dx = position.x - this.lastX;
      const dy = position.y - this.lastY;
      if (dx !== 0 || dy !== 0) this.clearDetectedContentBox(false);
      this.offsetX += dx;
      this.offsetY += dy;
      this.lastX = position.x;
      this.lastY = position.y;
      if (isTouch && typeof event.preventDefault === 'function') event.preventDefault();
      this.render();
    };

    const endPointer = event => {
      const hadActiveDrag = this.isDragging
        || this.activeHitPointIndex >= 0
        || this.dragMode === 'matting-paint'
        || this.dragMode === 'crop-resize'
        || this.dragMode === 'crop-move'
        || this.dragMode === 'image-move';
      if (!hadActiveDrag) return;
      this.isDragging = false;
      if (this.interactionMode === 'hit') {
        this.activeHitPointIndex = -1;
      } else if (this.interactionMode === 'matting') {
        this.dragMode = '';
      } else {
        this.dragMode = '';
        this.activeCropHandle = '';
        this.dragStartCropFrame = null;
        if (event) {
          this.updateCropHoverState(this.getEventPosition(event), false);
        }
      }
      this.updateCursor();
      this.render();
    };

    wrapper.addEventListener('mousedown', event => beginPointer(event, false));
    win.addEventListener('mousemove', event => movePointer(event, false));
    win.addEventListener('mouseup', event => endPointer(event));
    wrapper.addEventListener('mouseleave', () => {
      if (this.interactionMode === 'hit') {
        this.hoverHitPointIndex = -1;
      } else if (this.interactionMode === 'matting' || this.interactionMode === 'pick') {
        this.hoverMattingPoint = null;
      } else {
        this.hoverComponentCandidateId = '';
        this.hoverCropHandle = '';
        this.hoverCropBorder = false;
      }
      if (!this.isDragging) {
        this.updateCursor();
        this.render();
      }
    });
    wrapper.addEventListener('touchstart', event => {
      if (event.touches.length !== 1) return;
      beginPointer(event, true);
    }, { passive: false });
    wrapper.addEventListener('touchmove', event => {
      if (event.touches.length !== 1) return;
      movePointer(event, true);
    }, { passive: false });
    wrapper.addEventListener('touchend', event => {
      this.hoverHitPointIndex = -1;
      this.hoverComponentCandidateId = '';
      this.hoverCropHandle = '';
      this.hoverCropBorder = false;
      this.hoverMattingPoint = null;
      endPointer(event);
    });
    wrapper.addEventListener('touchcancel', event => {
      this.hoverHitPointIndex = -1;
      this.hoverComponentCandidateId = '';
      this.hoverCropHandle = '';
      this.hoverCropBorder = false;
      this.hoverMattingPoint = null;
      endPointer(event);
    });

    this.listenersBound = true;
    this.updateCursor();
  }

  setScale(newScale) {
    this.clearDetectedContentBox(false);
    const focusPoint = this.getFrameFocusPoint();
    this.scale = Math.max(this.minScale, Math.min(this.maxScale, newScale));
    if (focusPoint) {
      this.setFocusPointAtFrameCenter(focusPoint);
    }
    this.constrainOffset();
    this.render();
  }

  setStretch(stretchX = this.stretchX, stretchY = this.stretchY) {
    this.clearDetectedContentBox(false);
    const focusPoint = this.getFrameFocusPoint();
    this.stretchX = this.clampStretch(stretchX, this.stretchX);
    this.stretchY = this.clampStretch(stretchY, this.stretchY);

    if (this.image && this.imageLoaded) {
      const { coverScale, maxScale } = this.getScaleBounds();
      this.minScale = MIN_SCALE;
      this.maxScale = maxScale;
      this.scale = Math.max(this.minScale, Math.min(this.maxScale, Math.max(this.scale, coverScale)));
      if (focusPoint) {
        this.setFocusPointAtFrameCenter(focusPoint);
      }
      this.constrainOffset();
    }

    this.render();
  }

  setStretchX(stretchX) {
    this.setStretch(stretchX, this.stretchY);
  }

  setStretchY(stretchY) {
    this.setStretch(this.stretchX, stretchY);
  }

  applyAspectRatio(nextAspectRatio, options = {}) {
    const safeAspectRatio = Number(nextAspectRatio);
    if (!Number.isFinite(safeAspectRatio) || safeAspectRatio <= 0) return;
    const preserveView = options.preserveView !== false;
    const shouldRender = options.shouldRender !== false;

    this.aspectRatio = safeAspectRatio;
    const nextFrame = this.getDefaultCropFrame(safeAspectRatio);
    this.applyCropFrame(nextFrame, { preserveView, shouldRender });
  }

  setInteractionMode(mode) {
    if (mode === 'hit') {
      this.interactionMode = 'hit';
    } else if (mode === 'matting') {
      this.interactionMode = 'matting';
    } else if (mode === 'pick') {
      this.interactionMode = 'pick';
    } else {
      this.interactionMode = 'crop';
    }
    this.isDragging = false;
    this.dragMode = '';
    this.activeHitPointIndex = -1;
    this.hoverHitPointIndex = -1;
    this.activeCropHandle = '';
    this.hoverCropHandle = '';
    this.hoverCropBorder = false;
    this.hoverMattingPoint = null;
    this.dragStartCropFrame = null;
    this.updateCursor();
    this.render();
  }

  setHitAreaPoints(points) {
    this.hitAreaPoints = this.sanitizeHitAreaPoints(points);
    this.activeHitPointIndex = -1;
    this.hoverHitPointIndex = -1;
    this.render();
  }

  getHitAreaPoints() {
    return this.hitAreaPoints.map(point => ({ x: point.x, y: point.y }));
  }

  resetHitAreaPoints() {
    this.setHitAreaPoints(this.createRectHitArea());
  }

  addHitAreaPoint() {
    let insertIndex = this.hitAreaPoints.length;
    if (this.activeHitPointIndex >= 0 && this.activeHitPointIndex < this.hitAreaPoints.length) {
      insertIndex = this.activeHitPointIndex + 1;
    } else {
      let longestIndex = 0;
      let longestDistance = -1;
      for (let index = 0; index < this.hitAreaPoints.length; index += 1) {
        const current = this.hitAreaPoints[index];
        const next = this.hitAreaPoints[(index + 1) % this.hitAreaPoints.length];
        const dx = next.x - current.x;
        const dy = next.y - current.y;
        const distance = (dx * dx) + (dy * dy);
        if (distance > longestDistance) {
          longestDistance = distance;
          longestIndex = index + 1;
        }
      }
      insertIndex = longestIndex;
    }

    const previous = this.hitAreaPoints[(insertIndex - 1 + this.hitAreaPoints.length) % this.hitAreaPoints.length];
    const next = this.hitAreaPoints[insertIndex % this.hitAreaPoints.length];
    this.hitAreaPoints.splice(insertIndex, 0, {
      x: this.clampRatio(((previous?.x ?? 0) + (next?.x ?? 1)) / 2, 0.5),
      y: this.clampRatio(((previous?.y ?? 0) + (next?.y ?? 1)) / 2, 0.5),
    });
    this.activeHitPointIndex = insertIndex;
    this.hoverHitPointIndex = insertIndex;
    this.render();
  }

  removeSelectedHitAreaPoint() {
    if (this.hitAreaPoints.length <= 3) return false;
    const index = this.activeHitPointIndex >= 0 ? this.activeHitPointIndex : this.hoverHitPointIndex;
    if (index < 0 || index >= this.hitAreaPoints.length) return false;
    this.hitAreaPoints.splice(index, 1);
    this.activeHitPointIndex = -1;
    this.hoverHitPointIndex = -1;
    this.render();
    return true;
  }

  constrainOffset() {
    if (!this.image) return;
    const metrics = this.getDrawMetrics();
    if (!metrics) return;
    const frame = this.getCropFrame();
    const baseDrawX = (metrics.containerWidth - metrics.scaledWidth) / 2;
    const baseDrawY = (metrics.containerHeight - metrics.scaledHeight) / 2;
    const minOffsetX = Math.min(
      frame.x + frame.width - metrics.scaledWidth - baseDrawX,
      frame.x - baseDrawX,
    );
    const maxOffsetX = Math.max(
      frame.x + frame.width - metrics.scaledWidth - baseDrawX,
      frame.x - baseDrawX,
    );
    const minOffsetY = Math.min(
      frame.y + frame.height - metrics.scaledHeight - baseDrawY,
      frame.y - baseDrawY,
    );
    const maxOffsetY = Math.max(
      frame.y + frame.height - metrics.scaledHeight - baseDrawY,
      frame.y - baseDrawY,
    );
    this.offsetX = Math.max(minOffsetX, Math.min(maxOffsetX, this.offsetX));
    this.offsetY = Math.max(minOffsetY, Math.min(maxOffsetY, this.offsetY));
  }

  reset() {
    this.clearDetectedContentBox(false);
    this.hoverComponentCandidateId = '';
    this.aspectRatio = this.getBaseAspectRatio();
    this.stretchX = 1;
    this.stretchY = 1;
    const frame = this.getDefaultCropFrame(this.aspectRatio);
    this.cropX = frame.x;
    this.cropY = frame.y;
    this.cropWidth = frame.width;
    this.cropHeight = frame.height;
    this.calculateInitialScale();
    this.render();
  }

  createOutputCanvas(outputWidth = 400) {
    if (!this.image || !this.imageLoaded || !this.canvas) return null;
    const safeWidth = Math.max(64, Math.round(Number(outputWidth) || 400));
    const safeHeight = Math.max(64, Math.round(safeWidth / Math.max(this.getCropAspectRatio(), 0.01)));
    const doc = topWindow?.document || document;
    const canvas = doc.createElement('canvas');
    canvas.width = safeWidth;
    canvas.height = safeHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    return {
      canvas,
      ctx,
      width: safeWidth,
      height: safeHeight,
    };
  }

  drawCurrentCropToContext(ctx, outputWidth, outputHeight) {
    if (!ctx || !this.image || !this.imageLoaded || !this.canvas) return false;
    const metrics = this.getDrawMetrics();
    if (!metrics) return false;
    const frame = this.getCropFrame();
    const source = this.getRenderSource();
    if (!source) return false;
    const srcX = (frame.x - metrics.drawX) / metrics.effectiveScaleX;
    const srcY = (frame.y - metrics.drawY) / metrics.effectiveScaleY;
    const srcWidth = frame.width / metrics.effectiveScaleX;
    const srcHeight = frame.height / metrics.effectiveScaleY;
    ctx.clearRect(0, 0, outputWidth, outputHeight);
    ctx.drawImage(source, srcX, srcY, srcWidth, srcHeight, 0, 0, outputWidth, outputHeight);
    return true;
  }

  getCroppedImageData(outputWidth = 400) {
    const target = this.createOutputCanvas(outputWidth);
    if (!target) return null;
    const drawn = this.drawCurrentCropToContext(target.ctx, target.width, target.height);
    if (!drawn) return null;
    return {
      ...target,
      imageData: target.ctx.getImageData(0, 0, target.width, target.height),
    };
  }

  applyChromaKey(options = {}) {
    if (!this.image || !this.imageLoaded) return null;
    if (options.color) {
      this.setMattingKeyColor(options.color, { shouldRender: false });
    }
    if (options.tolerance !== undefined) {
      this.setMattingTolerance(options.tolerance, { shouldRender: false });
    }
    if (!this.ensureMattingBuffer()) return null;

    const data = this.mattingImageData.data;
    const source = this.sourceImageData.data;
    const { r, g, b } = this.mattingKeyRgb;
    const tolerance = this.mattingTolerance;
    const toleranceSquared = tolerance * tolerance;
    let transparentPixels = 0;

    for (let index = 0; index < data.length; index += 4) {
      const dr = source[index] - r;
      const dg = source[index + 1] - g;
      const db = source[index + 2] - b;
      data[index] = source[index];
      data[index + 1] = source[index + 1];
      data[index + 2] = source[index + 2];
      data[index + 3] = ((dr * dr) + (dg * dg) + (db * db)) <= toleranceSquared ? 0 : source[index + 3];
      if (data[index + 3] === 0) transparentPixels += 1;
    }

    this.clearDetectedComponentCandidates(false);
    this.mattingCtx.putImageData(this.mattingImageData, 0, 0);
    this.mattingApplied = true;
    this.mattingEnabled = true;
    this.render({ type: 'matting-applied', state: this.getMattingState() });
    return {
      transparentPixels,
      width: this.mattingImageData.width,
      height: this.mattingImageData.height,
    };
  }

  paintMattingAtCanvasPoint(position, brushMode = this.mattingBrushMode, shouldRender = true) {
    if (!this.hasMattingPreview() || !this.mattingImageData || !this.sourceImageData) return false;
    const point = this.canvasPointToImagePoint(position);
    if (!point) return false;

    const radius = Math.max(1, Math.round(this.mattingBrushSize / 2));
    const radiusSquared = radius * radius;
    const width = this.mattingImageData.width;
    const height = this.mattingImageData.height;
    const minX = Math.max(0, point.x - radius);
    const maxX = Math.min(width - 1, point.x + radius);
    const minY = Math.max(0, point.y - radius);
    const maxY = Math.min(height - 1, point.y + radius);
    const nextMode = brushMode === 'keep' ? 'keep' : 'erase';
    const data = this.mattingImageData.data;
    const source = this.sourceImageData.data;
    let changed = false;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = x - point.x;
        const dy = y - point.y;
        if ((dx * dx) + (dy * dy) > radiusSquared) continue;
        const alphaIndex = ((y * width) + x) * 4 + 3;
        const nextAlpha = nextMode === 'keep' ? source[alphaIndex] : 0;
        if (data[alphaIndex] === nextAlpha) continue;
        data[alphaIndex] = nextAlpha;
        changed = true;
      }
    }

    if (!changed) return false;
    this.clearDetectedComponentCandidates(false);
    this.mattingCtx.putImageData(
      this.mattingImageData,
      0,
      0,
      minX,
      minY,
      (maxX - minX) + 1,
      (maxY - minY) + 1,
    );
    if (shouldRender) {
      this.render({ type: 'matting-paint', state: this.getMattingState() });
    }
    return true;
  }

  getConnectedComponents(mask, width, height) {
    const total = width * height;
    const visited = new Uint8Array(total);
    const queue = new Int32Array(total);
    const components = [];

    const flood = seedIndex => {
      let head = 0;
      let tail = 0;
      queue[0] = seedIndex;
      visited[seedIndex] = 1;

      const component = {
        area: 0,
        minX: width,
        maxX: 0,
        minY: height,
        maxY: 0,
        indices: [],
      };

      while (head <= tail) {
        const current = queue[head];
        head += 1;
        const x = current % width;
        const y = (current / width) | 0;

        component.indices.push(current);
        component.area += 1;
        component.minX = Math.min(component.minX, x);
        component.maxX = Math.max(component.maxX, x);
        component.minY = Math.min(component.minY, y);
        component.maxY = Math.max(component.maxY, y);

        const tryPush = nextIndex => {
          if (nextIndex < 0 || nextIndex >= total) return;
          if (!mask[nextIndex] || visited[nextIndex]) return;
          visited[nextIndex] = 1;
          tail += 1;
          queue[tail] = nextIndex;
        };

        if (x > 0) tryPush(current - 1);
        if (x < width - 1) tryPush(current + 1);
        if (y > 0) tryPush(current - width);
        if (y < height - 1) tryPush(current + width);
      }

      return component;
    };

    for (let index = 0; index < total; index += 1) {
      if (!mask[index] || visited[index]) continue;
      components.push(flood(index));
    }

    return components.sort((left, right) => right.area - left.area);
  }

  buildComponentMask(indices, total) {
    const componentMask = new Uint8Array(total);
    (Array.isArray(indices) ? indices : []).forEach(index => {
      if (index >= 0 && index < total) {
        componentMask[index] = 1;
      }
    });
    return componentMask;
  }

  getLargestConnectedComponent(mask, width, height) {
    const total = width * height;
    const bestComponent = this.getConnectedComponents(mask, width, height)[0];
    if (!bestComponent) return null;
    return {
      area: bestComponent.area,
      bounds: {
        minX: bestComponent.minX,
        maxX: bestComponent.maxX,
        minY: bestComponent.minY,
        maxY: bestComponent.maxY,
      },
      mask: this.buildComponentMask(bestComponent.indices, total),
    };
  }

  getPolygonArea(points) {
    if (!Array.isArray(points) || points.length < 3) return 0;
    let area = 0;
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      area += (current.x * next.y) - (next.x * current.y);
    }
    return area / 2;
  }

  traceBoundaryLoop(mask, width, height) {
    const edges = [];
    const edgeMap = new Map();

    const addEdge = (sx, sy, ex, ey) => {
      const edgeIndex = edges.push({ sx, sy, ex, ey }) - 1;
      const key = `${sx},${sy}`;
      const list = edgeMap.get(key);
      if (list) {
        list.push(edgeIndex);
      } else {
        edgeMap.set(key, [edgeIndex]);
      }
    };

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width) + x;
        if (!mask[index]) continue;

        if (y === 0 || !mask[index - width]) addEdge(x, y, x + 1, y);
        if (x === width - 1 || !mask[index + 1]) addEdge(x + 1, y, x + 1, y + 1);
        if (y === height - 1 || !mask[index + width]) addEdge(x + 1, y + 1, x, y + 1);
        if (x === 0 || !mask[index - 1]) addEdge(x, y + 1, x, y);
      }
    }

    if (!edges.length) return null;

    const used = new Uint8Array(edges.length);
    const loops = [];

    for (let index = 0; index < edges.length; index += 1) {
      if (used[index]) continue;

      const startEdge = edges[index];
      const startKey = `${startEdge.sx},${startEdge.sy}`;
      const loop = [];
      let currentIndex = index;
      let safety = edges.length + 4;

      while (currentIndex >= 0 && safety > 0) {
        safety -= 1;
        if (used[currentIndex]) break;
        const edge = edges[currentIndex];
        used[currentIndex] = 1;
        loop.push({ x: edge.sx, y: edge.sy });

        const endKey = `${edge.ex},${edge.ey}`;
        if (endKey === startKey) {
          break;
        }

        const nextList = edgeMap.get(endKey) || [];
        const nextIndex = nextList.find(candidateIndex => !used[candidateIndex]);
        if (nextIndex === undefined) {
          loop.push({ x: edge.ex, y: edge.ey });
          break;
        }
        currentIndex = nextIndex;
      }

      if (loop.length >= 3) {
        loops.push(loop);
      }
    }

    if (!loops.length) return null;
    loops.sort((left, right) => Math.abs(this.getPolygonArea(right)) - Math.abs(this.getPolygonArea(left)));
    return loops[0];
  }

  removeDegeneratePolygonPoints(points) {
    if (!Array.isArray(points) || points.length < 3) return [];
    let working = points
      .map(point => ({
        x: Number(point?.x) || 0,
        y: Number(point?.y) || 0,
      }))
      .filter((point, index, list) => {
        if (index === 0) return true;
        const previous = list[index - 1];
        return point.x !== previous.x || point.y !== previous.y;
      });

    if (working.length > 1) {
      const first = working[0];
      const last = working[working.length - 1];
      if (first.x === last.x && first.y === last.y) {
        working = working.slice(0, -1);
      }
    }

    let changed = true;
    while (changed && working.length > 3) {
      changed = false;
      const nextPoints = [];
      for (let index = 0; index < working.length; index += 1) {
        const previous = working[(index - 1 + working.length) % working.length];
        const current = working[index];
        const next = working[(index + 1) % working.length];
        const cross = ((current.x - previous.x) * (next.y - current.y))
          - ((current.y - previous.y) * (next.x - current.x));
        if (Math.abs(cross) <= 0.000001) {
          changed = true;
          continue;
        }
        nextPoints.push(current);
      }
      if (nextPoints.length >= 3) {
        working = nextPoints;
      } else {
        break;
      }
    }

    return working;
  }

  simplifyPolygonPoints(points, maxPoints = DEFAULT_HIT_AREA_POINT_COUNT) {
    let working = this.removeDegeneratePolygonPoints(points);
    const safeMaxPoints = Math.max(4, Math.min(32, Number(maxPoints) || DEFAULT_HIT_AREA_POINT_COUNT));
    let safety = 2048;

    while (working.length > safeMaxPoints && safety > 0) {
      safety -= 1;
      let removeIndex = -1;
      let smallestArea = Infinity;

      for (let index = 0; index < working.length; index += 1) {
        const previous = working[(index - 1 + working.length) % working.length];
        const current = working[index];
        const next = working[(index + 1) % working.length];
        const area = Math.abs(
          ((previous.x * (current.y - next.y))
          + (current.x * (next.y - previous.y))
          + (next.x * (previous.y - current.y))) / 2,
        );
        if (area < smallestArea) {
          smallestArea = area;
          removeIndex = index;
        }
      }

      if (removeIndex < 0) break;
      working.splice(removeIndex, 1);
      working = this.removeDegeneratePolygonPoints(working);
    }

    return working;
  }

  createBoundingHitArea(bounds, width, height) {
    if (!bounds) return this.createRectHitArea();
    return this.sanitizeHitAreaPoints([
      { x: bounds.minX / width, y: bounds.minY / height },
      { x: (bounds.maxX + 1) / width, y: bounds.minY / height },
      { x: (bounds.maxX + 1) / width, y: (bounds.maxY + 1) / height },
      { x: bounds.minX / width, y: (bounds.maxY + 1) / height },
    ]);
  }

  createCandidateHitArea(componentMask, bounds, width, height, maxPoints = DEFAULT_HIT_AREA_POINT_COUNT) {
    if (!componentMask || !bounds) {
      return this.createRectHitArea();
    }
    const candidateWidth = Math.max(1, (bounds.maxX - bounds.minX) + 1);
    const candidateHeight = Math.max(1, (bounds.maxY - bounds.minY) + 1);
    const boundary = this.traceBoundaryLoop(componentMask, width, height);
    const simplified = boundary ? this.simplifyPolygonPoints(boundary, maxPoints) : [];
    if (simplified.length >= 3) {
      return this.sanitizeHitAreaPoints(simplified.map(point => ({
        x: this.clampRatio((point.x - bounds.minX) / candidateWidth, 0),
        y: this.clampRatio((point.y - bounds.minY) / candidateHeight, 0),
      })));
    }
    return this.createRectHitArea();
  }

  normalizeDetectedComponentCandidate(raw, index = 0) {
    const bounds = raw?.bounds && typeof raw.bounds === 'object'
      ? {
          minX: Math.max(0, Math.round(Number(raw.bounds.minX) || 0)),
          minY: Math.max(0, Math.round(Number(raw.bounds.minY) || 0)),
          maxX: Math.max(0, Math.round(Number(raw.bounds.maxX) || 0)),
          maxY: Math.max(0, Math.round(Number(raw.bounds.maxY) || 0)),
        }
      : null;
    const box = this.normalizeContentBox(raw?.box);
    if (!bounds || !box) return null;
    const width = Math.max(1, (bounds.maxX - bounds.minX) + 1);
    const height = Math.max(1, (bounds.maxY - bounds.minY) + 1);
    return {
      id: String(raw?.id || `candidate-${index + 1}`).trim() || `candidate-${index + 1}`,
      area: Math.max(1, Math.round(Number(raw?.area) || (width * height))),
      areaRatio: Math.max(0, Number(raw?.areaRatio) || 0),
      aspectRatio: width / Math.max(height, 1),
      suggestedElementId: String(raw?.suggestedElementId || '').trim(),
      suggestedElementLabel: String(raw?.suggestedElementLabel || '').trim(),
      bounds: {
        ...bounds,
        width,
        height,
      },
      box,
      centerX: box.x + (box.width / 2),
      centerY: box.y + (box.height / 2),
      hitAreaPoints: this.sanitizeHitAreaPoints(raw?.hitAreaPoints),
    };
  }

  applyDetectedComponentCandidates(candidates, options = {}) {
    const normalized = (Array.isArray(candidates) ? candidates : [])
      .map((candidate, index) => this.normalizeDetectedComponentCandidate(candidate, index))
      .filter(Boolean);
    const requestedSelectedId = String(options.selectedCandidateId || '').trim();
    const shouldSelectFirst = options.selectFirstCandidate !== false;
    const hasRequestedSelection = !!requestedSelectedId
      && normalized.some(candidate => candidate.id === requestedSelectedId);
    this.detectedComponentCandidates = normalized;
    this.componentCandidateLabels = {};
    this.hoverComponentCandidateId = '';
    this.selectedComponentCandidateId = hasRequestedSelection
      ? requestedSelectedId
      : (shouldSelectFirst ? (normalized[0]?.id || '') : '');
    if (this.selectedComponentCandidateId && options.syncCropFrame === true) {
      this.applyComponentCandidateToCropFrame(this.selectedComponentCandidateId, {
        paddingRatio: options.paddingRatio,
        shouldRender: false,
        syncAspectRatio: options.syncAspectRatio,
      });
    }
    if (options.shouldRender !== false) {
      this.render();
    }
    return this.getDetectedComponentCandidates();
  }

  detectComponentCandidates(options = {}) {
    const alphaThreshold = Math.max(0, Math.min(255, Number(options.alphaThreshold) || CONTENT_ALPHA_THRESHOLD));
    const minAreaRatio = Math.max(0, Math.min(1, Number(options.minAreaRatio) || 0.001));
    const minAspectRatio = Math.max(0, Number(options.minAspectRatio) || 0);
    const maxAspectRatio = Number.isFinite(Number(options.maxAspectRatio)) && Number(options.maxAspectRatio) > 0
      ? Number(options.maxAspectRatio)
      : Number.POSITIVE_INFINITY;
    const minWidthRatio = Math.max(0, Math.min(1, Number(options.minWidthRatio) || 0));
    const minHeightRatio = Math.max(0, Math.min(1, Number(options.minHeightRatio) || 0));
    const maxWidthRatio = Number.isFinite(Number(options.maxWidthRatio)) && Number(options.maxWidthRatio) > 0
      ? Math.max(0, Math.min(1, Number(options.maxWidthRatio)))
      : 1;
    const maxHeightRatio = Number.isFinite(Number(options.maxHeightRatio)) && Number(options.maxHeightRatio) > 0
      ? Math.max(0, Math.min(1, Number(options.maxHeightRatio)))
      : 1;
    const maxPoints = Math.max(4, Math.min(32, Number(options.maxPoints) || DEFAULT_HIT_AREA_POINT_COUNT));
    const maxCandidates = Math.max(0, Math.round(Number(options.maxCandidates) || 0));
    const source = this.getOpaqueSourceBuffer();
    if (!source) {
      this.clearDetectedComponentCandidates(false);
      return [];
    }

    const { imageData, width, height } = source;
    const total = width * height;
    const opaqueMask = new Uint8Array(total);
    for (let index = 0; index < total; index += 1) {
      opaqueMask[index] = imageData.data[(index * 4) + 3] > alphaThreshold ? 1 : 0;
    }

    let components = this.getConnectedComponents(opaqueMask, width, height)
      .map((component, index) => {
        const bounds = {
          minX: component.minX,
          minY: component.minY,
          maxX: component.maxX,
          maxY: component.maxY,
        };
        const candidateWidth = (bounds.maxX - bounds.minX) + 1;
        const candidateHeight = (bounds.maxY - bounds.minY) + 1;
        const box = {
          x: bounds.minX / width,
          y: bounds.minY / height,
          width: candidateWidth / width,
          height: candidateHeight / height,
        };
        const componentMask = this.buildComponentMask(component.indices, total);
        return this.normalizeDetectedComponentCandidate({
          id: `candidate-${index + 1}`,
          area: component.area,
          areaRatio: component.area / total,
          bounds,
          box,
          hitAreaPoints: this.createCandidateHitArea(componentMask, bounds, width, height, maxPoints),
        });
      })
      .filter(Boolean)
      .filter(candidate => candidate.areaRatio >= minAreaRatio)
      .filter(candidate => candidate.aspectRatio >= minAspectRatio && candidate.aspectRatio <= maxAspectRatio)
      .filter(candidate => candidate.box.width >= minWidthRatio && candidate.box.width <= maxWidthRatio)
      .filter(candidate => candidate.box.height >= minHeightRatio && candidate.box.height <= maxHeightRatio)
      .sort((left, right) => left.centerX - right.centerX || left.centerY - right.centerY);

    if (maxCandidates > 0) {
      components = components.slice(0, maxCandidates);
    }

    return this.applyDetectedComponentCandidates(components, {
      shouldRender: options.shouldRender !== false,
      syncCropFrame: options.syncCropFrame === true,
      paddingRatio: options.paddingRatio,
    });
  }

  applyComponentCandidateToCropFrame(candidateOrId, options = {}) {
    const candidate = typeof candidateOrId === 'string'
      ? this.getDetectedComponentCandidateById(candidateOrId)
      : this.normalizeDetectedComponentCandidate(candidateOrId);
    if (!candidate || !this.imageLoaded) return false;
    const metrics = this.getDrawMetrics();
    if (!metrics) return false;
    const rect = this.getComponentCandidateCanvasRect(candidate, metrics);
    if (!rect) return false;
    if (options.syncAspectRatio !== false) {
      this.aspectRatio = Math.max(0.01, Number(candidate.aspectRatio) || this.getEditorAspectRatio());
    }
    const paddingRatio = Math.max(0, Math.min(0.2, Number(options.paddingRatio) || 0));
    const padX = rect.width * paddingRatio;
    const padY = rect.height * paddingRatio;
    this.applyCropFrame({
      x: rect.x - padX,
      y: rect.y - padY,
      width: rect.width + (padX * 2),
      height: rect.height + (padY * 2),
    }, {
      preserveView: false,
      syncScaleToCover: options.syncScaleToCover !== false,
      shouldRender: options.shouldRender !== false,
    });
    return true;
  }

  exportDetectedComponentCandidateBlob(candidateOrId, outputWidth = 400) {
    const candidate = typeof candidateOrId === 'string'
      ? this.getDetectedComponentCandidateById(candidateOrId)
      : this.normalizeDetectedComponentCandidate(candidateOrId);
    if (!candidate) {
      return Promise.resolve(null);
    }
    const source = this.getOpaqueSourceBuffer();
    if (!source?.canvas) {
      return Promise.resolve(null);
    }
    const safeWidth = Math.max(64, Math.round(Number(outputWidth) || 400));
    const safeHeight = Math.max(64, Math.round(safeWidth / Math.max(candidate.aspectRatio || 1, 0.01)));
    const canvas = this.createInternalCanvas(safeWidth, safeHeight);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return Promise.resolve(null);
    }
    ctx.clearRect(0, 0, safeWidth, safeHeight);
    ctx.drawImage(
      source.canvas,
      candidate.bounds.minX,
      candidate.bounds.minY,
      candidate.bounds.width,
      candidate.bounds.height,
      0,
      0,
      safeWidth,
      safeHeight,
    );
    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), 'image/png', 1);
    });
  }

  detectOpaqueComponent(options = {}) {
    const outputWidth = Math.max(64, Math.round(Number(options.outputWidth) || 512));
    const alphaThreshold = Math.max(0, Math.min(255, Number(options.alphaThreshold) || CONTENT_ALPHA_THRESHOLD));
    const minAreaRatio = Math.max(0, Math.min(1, Number(options.minAreaRatio) || MIN_OPAQUE_AREA_RATIO));
    const cropped = this.getCroppedImageData(outputWidth);
    if (!cropped) return null;

    const { imageData, width, height } = cropped;
    const total = width * height;
    const opaqueMask = new Uint8Array(total);
    for (let index = 0; index < total; index += 1) {
      opaqueMask[index] = imageData.data[(index * 4) + 3] > alphaThreshold ? 1 : 0;
    }

    const component = this.getLargestConnectedComponent(opaqueMask, width, height);
    if (!component || component.area < (total * minAreaRatio)) {
      return null;
    }

    const box = {
      x: component.bounds.minX / width,
      y: component.bounds.minY / height,
      width: (component.bounds.maxX - component.bounds.minX + 1) / width,
      height: (component.bounds.maxY - component.bounds.minY + 1) / height,
    };
    const insets = {
      top: box.y,
      right: Math.max(0, 1 - (box.x + box.width)),
      bottom: Math.max(0, 1 - (box.y + box.height)),
      left: box.x,
    };

    return {
      component,
      cropped,
      box,
      insets,
      areaRatio: component.area / total,
      bounds: {
        ...component.bounds,
        width: component.bounds.maxX - component.bounds.minX + 1,
        height: component.bounds.maxY - component.bounds.minY + 1,
      },
    };
  }

  detectOpaqueContentBox(options = {}) {
    const detection = this.detectOpaqueComponent(options);
    if (!detection) {
      this.clearDetectedContentBox(false);
      return null;
    }

    this.setDetectedContentBox(detection.box, false);
    this.render();
    return detection;
  }

  applyContentBoxToCropFrame(rawBox, options = {}) {
    const box = this.normalizeContentBox(rawBox);
    if (!box) return false;
    const frame = this.getCropFrame();
    const paddingRatio = Math.max(0, Math.min(0.25, Number(options.paddingRatio) || 0));
    const nextX = Math.max(0, box.x - paddingRatio);
    const nextY = Math.max(0, box.y - paddingRatio);
    const nextRight = Math.min(1, box.x + box.width + paddingRatio);
    const nextBottom = Math.min(1, box.y + box.height + paddingRatio);
    const nextFrame = {
      x: frame.x + (nextX * frame.width),
      y: frame.y + (nextY * frame.height),
      width: Math.max(1, (nextRight - nextX) * frame.width),
      height: Math.max(1, (nextBottom - nextY) * frame.height),
    };
    this.applyCropFrame(nextFrame, {
      preserveView: options.preserveView === true,
      shouldRender: options.shouldRender !== false,
    });
    return true;
  }

  detectOpaqueHitArea(options = {}) {
    const maxPoints = Math.max(4, Math.min(32, Number(options.maxPoints) || DEFAULT_HIT_AREA_POINT_COUNT));
    const detection = this.detectOpaqueComponent(options);
    if (!detection) {
      return null;
    }

    const { component, cropped } = detection;
    const { width, height } = cropped;
    const boundary = this.traceBoundaryLoop(component.mask, width, height);
    const simplified = boundary ? this.simplifyPolygonPoints(boundary, maxPoints) : [];
    const hitAreaPoints = simplified.length >= 3
      ? this.sanitizeHitAreaPoints(simplified.map(point => ({
        x: point.x / width,
        y: point.y / height,
      })))
      : this.createBoundingHitArea(component.bounds, width, height);

    this.setHitAreaPoints(hitAreaPoints);
    return {
      points: hitAreaPoints.map(point => ({ ...point })),
      bounds: detection.bounds,
      box: detection.box,
      insets: detection.insets,
      areaRatio: detection.areaRatio,
    };
  }

  renderDetectedContentBox(frame) {
    if (!this.ctx || !this.detectedContentBox) return;
    const box = this.detectedContentBox;
    const x = frame.x + (box.x * frame.width);
    const y = frame.y + (box.y * frame.height);
    const width = box.width * frame.width;
    const height = box.height * frame.height;

    this.ctx.save();
    this.ctx.setLineDash([8, 6]);
    this.ctx.strokeStyle = '#4ade80';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, width, height);
    this.ctx.setLineDash([]);
    this.ctx.restore();
  }

  renderComponentCandidates(metrics) {
    if (!this.ctx || !this.componentCandidateOverlayEnabled || !metrics || this.detectedComponentCandidates.length === 0) return;
    this.detectedComponentCandidates.forEach(candidate => {
      const rect = this.getComponentCandidateCanvasRect(candidate, metrics);
      if (!rect) return;
      const isSelected = candidate.id === this.selectedComponentCandidateId;
      const isHover = candidate.id === this.hoverComponentCandidateId;
      this.ctx.save();
      this.ctx.strokeStyle = isSelected ? '#38bdf8' : (isHover ? '#f59e0b' : 'rgba(125, 211, 252, 0.82)');
      this.ctx.lineWidth = isSelected ? 3 : 2;
      this.ctx.setLineDash(isSelected ? [] : [6, 4]);
      this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
      this.ctx.setLineDash([]);
      this.ctx.restore();
    });
  }

  renderModeLabel(frame) {
    if (!this.ctx) return;
  }

  renderMattingOverlay(frame) {
    if (!this.ctx || !['matting', 'pick'].includes(this.interactionMode)) return;
    this.ctx.save();
    if (this.hoverMattingPoint && (this.interactionMode === 'matting' || this.interactionMode === 'pick')) {
      const metrics = this.getDrawMetrics();
      const scaleHint = metrics ? (Math.abs(metrics.effectiveScaleX) + Math.abs(metrics.effectiveScaleY)) / 2 : 1;
      const radius = this.interactionMode === 'pick'
        ? 10
        : Math.max(6, (this.mattingBrushSize / 2) * Math.max(scaleHint, 0.2));
      this.ctx.beginPath();
      this.ctx.arc(this.hoverMattingPoint.x, this.hoverMattingPoint.y, radius, 0, Math.PI * 2);
      this.ctx.strokeStyle = this.interactionMode === 'pick'
        ? '#facc15'
        : (this.mattingBrushMode === 'keep' ? '#22c55e' : '#ef4444');
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  renderCropFrameOverlay(frame) {
    if (!this.ctx) return;
    const borderActive = this.interactionMode === 'crop' && (this.dragMode === 'crop-move' || this.hoverCropBorder);
    this.ctx.save();
    this.ctx.strokeStyle = borderActive ? '#38bdf8' : '#00d2ff';
    this.ctx.lineWidth = borderActive ? 4 : 3;
    this.ctx.strokeRect(frame.x, frame.y, frame.width, frame.height);

    const cornerSize = 15;
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.moveTo(frame.x, frame.y + cornerSize);
    this.ctx.lineTo(frame.x, frame.y);
    this.ctx.lineTo(frame.x + cornerSize, frame.y);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(frame.x + frame.width - cornerSize, frame.y);
    this.ctx.lineTo(frame.x + frame.width, frame.y);
    this.ctx.lineTo(frame.x + frame.width, frame.y + cornerSize);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(frame.x, frame.y + frame.height - cornerSize);
    this.ctx.lineTo(frame.x, frame.y + frame.height);
    this.ctx.lineTo(frame.x + cornerSize, frame.y + frame.height);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(frame.x + frame.width - cornerSize, frame.y + frame.height);
    this.ctx.lineTo(frame.x + frame.width, frame.y + frame.height);
    this.ctx.lineTo(frame.x + frame.width, frame.y + frame.height - cornerSize);
    this.ctx.stroke();

    if (this.interactionMode === 'crop' && this.cropFrameEditable) {
      this.getCropHandleDefinitions(frame).forEach(handle => {
        const isActive = handle.name === this.activeCropHandle;
        const isHover = handle.name === this.hoverCropHandle;
        this.ctx.beginPath();
        this.ctx.arc(handle.x, handle.y, CROP_HANDLE_RADIUS, 0, Math.PI * 2);
        this.ctx.fillStyle = isActive ? '#f97316' : isHover ? '#fde047' : '#ffffff';
        this.ctx.strokeStyle = '#0f172a';
        this.ctx.lineWidth = 2;
        this.ctx.fill();
        this.ctx.stroke();
      });
    }

    this.ctx.restore();
  }

  detectTransparentContentBox(options = {}) {
    if (!this.image || !this.imageLoaded || !this.canvas) {
      this.clearDetectedContentBox(false);
      return null;
    }

    const alphaThreshold = Math.max(0, Math.min(255, Number(options.alphaThreshold) || CONTENT_ALPHA_THRESHOLD));
    const minAreaRatio = Math.max(0, Math.min(1, Number(options.minAreaRatio) || MIN_CONTENT_AREA_RATIO));
    const cropped = this.getCroppedImageData(options.outputWidth || 512);
    if (!cropped) return null;
    const { imageData, width: outputWidth, height: outputHeight } = cropped;
    const total = outputWidth * outputHeight;
    const transparentMask = new Uint8Array(total);
    for (let index = 0; index < total; index += 1) {
      transparentMask[index] = imageData.data[(index * 4) + 3] <= alphaThreshold ? 1 : 0;
    }

    const outside = new Uint8Array(total);
    const visited = new Uint8Array(total);
    const queue = new Int32Array(total);

    const flood = (seedIndex, marker, component = null) => {
      let head = 0;
      let tail = 0;
      queue[0] = seedIndex;
      marker[seedIndex] = 1;
      if (component) {
        const seedX = seedIndex % outputWidth;
        const seedY = (seedIndex / outputWidth) | 0;
        component.area = 1;
        component.minX = seedX;
        component.maxX = seedX;
        component.minY = seedY;
        component.maxY = seedY;
      }

      while (head <= tail) {
        const current = queue[head];
        head += 1;
        const x = current % outputWidth;
        const y = (current / outputWidth) | 0;

        const tryPush = (nextIndex) => {
          if (nextIndex < 0 || nextIndex >= total) return;
          if (!transparentMask[nextIndex] || marker[nextIndex]) return;
          marker[nextIndex] = 1;
          tail += 1;
          queue[tail] = nextIndex;
          if (!component) return;
          const nextX = nextIndex % outputWidth;
          const nextY = (nextIndex / outputWidth) | 0;
          component.area += 1;
          component.minX = Math.min(component.minX, nextX);
          component.maxX = Math.max(component.maxX, nextX);
          component.minY = Math.min(component.minY, nextY);
          component.maxY = Math.max(component.maxY, nextY);
        };

        if (x > 0) tryPush(current - 1);
        if (x < outputWidth - 1) tryPush(current + 1);
        if (y > 0) tryPush(current - outputWidth);
        if (y < outputHeight - 1) tryPush(current + outputWidth);
      }
    };

    for (let x = 0; x < outputWidth; x += 1) {
      const topIndex = x;
      const bottomIndex = ((outputHeight - 1) * outputWidth) + x;
      if (transparentMask[topIndex] && !outside[topIndex]) flood(topIndex, outside);
      if (transparentMask[bottomIndex] && !outside[bottomIndex]) flood(bottomIndex, outside);
    }
    for (let y = 0; y < outputHeight; y += 1) {
      const leftIndex = y * outputWidth;
      const rightIndex = (y * outputWidth) + (outputWidth - 1);
      if (transparentMask[leftIndex] && !outside[leftIndex]) flood(leftIndex, outside);
      if (transparentMask[rightIndex] && !outside[rightIndex]) flood(rightIndex, outside);
    }

    let bestComponent = null;
    for (let index = 0; index < total; index += 1) {
      if (!transparentMask[index] || outside[index] || visited[index]) continue;
      const component = { area: 0, minX: outputWidth, maxX: 0, minY: outputHeight, maxY: 0 };
      flood(index, visited, component);
      if (!bestComponent || component.area > bestComponent.area) {
        bestComponent = component;
      }
    }

    if (!bestComponent || bestComponent.area < (total * minAreaRatio)) {
      this.clearDetectedContentBox(false);
      return null;
    }

    const box = {
      x: bestComponent.minX / outputWidth,
      y: bestComponent.minY / outputHeight,
      width: (bestComponent.maxX - bestComponent.minX + 1) / outputWidth,
      height: (bestComponent.maxY - bestComponent.minY + 1) / outputHeight,
    };
    const insets = {
      top: box.y,
      right: Math.max(0, 1 - (box.x + box.width)),
      bottom: Math.max(0, 1 - (box.y + box.height)),
      left: box.x,
    };

    this.setDetectedContentBox(box, false);
    this.render();
    return {
      box,
      insets,
      areaRatio: bestComponent.area / total,
      pixelBox: {
        x: bestComponent.minX,
        y: bestComponent.minY,
        width: bestComponent.maxX - bestComponent.minX + 1,
        height: bestComponent.maxY - bestComponent.minY + 1,
      },
    };
  }

  renderHitAreaOverlay(frame) {
    if (!this.ctx || this.interactionMode !== 'hit') return;
    const points = this.hitAreaPoints.map(point => this.cropPointToCanvas(point));
    if (points.length < 3) return;

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      this.ctx.lineTo(points[index].x, points[index].y);
    }
    this.ctx.closePath();
    this.ctx.fillStyle = 'rgba(34, 211, 238, 0.20)';
    this.ctx.strokeStyle = this.interactionMode === 'hit' ? '#22d3ee' : 'rgba(34, 211, 238, 0.7)';
    this.ctx.lineWidth = 2;
    this.ctx.fill();
    this.ctx.stroke();

    points.forEach((point, index) => {
      const isActive = index === this.activeHitPointIndex;
      const isHover = index === this.hoverHitPointIndex;
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, POINT_RADIUS, 0, Math.PI * 2);
      this.ctx.fillStyle = isActive ? '#f97316' : isHover ? '#fde047' : '#ffffff';
      this.ctx.strokeStyle = '#0f172a';
      this.ctx.lineWidth = 2;
      this.ctx.fill();
      this.ctx.stroke();
    });

    this.ctx.restore();
  }

  render(changePayload = null) {
    if (!this.ctx || !this.canvas) return;
    const { width: containerWidth, height: containerHeight } = this.getContainerSize();
    if (!this.hasCropFrame()) {
      if (this.imageLoaded) {
        this.calculateInitialScale();
      } else {
        this.ensureCropFrame();
      }
    }

    this.renderTransparencyBackground(containerWidth, containerHeight);

    if (this.image && this.imageLoaded) {
      const metrics = this.getDrawMetrics();
      const source = this.getRenderSource();
      if (metrics) {
        this.ctx.drawImage(source, metrics.drawX, metrics.drawY, metrics.scaledWidth, metrics.scaledHeight);
        this.renderComponentCandidates(metrics);
      }
    }

    const frame = this.getCropFrame();
    if (!(this.componentCandidateOverlayEnabled && this.detectedComponentCandidates.length > 0)) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      this.ctx.fillRect(0, 0, containerWidth, frame.y);
      this.ctx.fillRect(0, frame.y + frame.height, containerWidth, containerHeight - frame.y - frame.height);
      this.ctx.fillRect(0, frame.y, frame.x, frame.height);
      this.ctx.fillRect(frame.x + frame.width, frame.y, containerWidth - frame.x - frame.width, frame.height);
    }

    this.renderCropFrameOverlay(frame);
    this.renderDetectedContentBox(frame);
    this.renderModeLabel(frame);
    this.renderMattingOverlay(frame);
    this.renderHitAreaOverlay(frame);
    this.notifyChange(changePayload);
  }

  getCroppedBlob(outputWidth = 400) {
    return new Promise(resolve => {
      const target = this.createOutputCanvas(outputWidth);
      if (!target) {
        resolve(null);
        return;
      }
      this.drawCurrentCropToContext(target.ctx, target.width, target.height);
      target.canvas.toBlob(blob => resolve(blob), 'image/png', 1);
    });
  }
}
