// ============================================
// 地图缩放平移控制器（从旧地图弹窗抽取的手势引擎）
// 支持：滚轮缩放、单指/鼠标拖拽、双指捏合、边界钳制、拖动后吞误触点击
// ============================================
import { $, topWindow } from '../core/env.js';

/**
 * 创建缩放平移控制器
 * @param {object} opts
 * @param {jQuery} opts.$modal 弹窗根节点（事件委托挂载处）
 * @param {string} opts.wrapSelector 视口容器选择器（如 '#gal-map-canvas-wrap'）
 * @param {string} opts.canvasSelector 内容画布选择器（被 transform 的元素）
 * @param {number} opts.contentWidth 内容固有宽度（虚拟画布宽）
 * @param {number} opts.contentHeight 内容固有高度
 * @param {string} opts.namespace 事件命名空间（如 'galSceneMap'）
 * @param {function} [opts.onZoomChange] 缩放变化回调（用于更新百分比显示）
 */
export function createPanZoomController(opts) {
  const { $modal, wrapSelector, canvasSelector, contentWidth, contentHeight, namespace } = opts;
  const onZoomChange = typeof opts.onZoomChange === 'function' ? opts.onZoomChange : null;
  const ns = `.${namespace}`;
  const $win = $(topWindow);

  const panzoom = {
    scale: 1,
    minScale: 1,
    maxScale: 6,
    x: 0,
    y: 0,
    fitLeft: 0,
    fitTop: 0,
    fitWidth: 0,
    fitHeight: 0,
  };
  const pointerState = {
    points: new Map(),
    isPinching: false,
    pinchStartDistance: 0,
    pinchStartScale: 1,
    dragPointerId: null,
    dragStartClientX: 0,
    dragStartClientY: 0,
    dragStartX: 0,
    dragStartY: 0,
    moved: false,
  };

  let layoutFrameId = 0;
  let layoutKeepView = true;
  let suppressClick = false;

  const getWrapElement = () => $modal.find(wrapSelector)[0] || null;
  const getCanvasElement = () => $modal.find(canvasSelector)[0] || null;
  const clampValue = (value, min, max) => Math.max(min, Math.min(max, value));

  const requestFrame = callback => {
    if (typeof topWindow?.requestAnimationFrame === 'function') {
      return topWindow.requestAnimationFrame(callback);
    }
    return topWindow.setTimeout(callback, 16);
  };

  const cancelFrame = id => {
    if (!id) return;
    if (typeof topWindow?.cancelAnimationFrame === 'function') {
      topWindow.cancelAnimationFrame(id);
      return;
    }
    topWindow.clearTimeout(id);
  };

  const clampPanOffset = () => {
    const wrap = getWrapElement();
    if (!wrap) return;
    const wrapW = wrap.clientWidth;
    const wrapH = wrap.clientHeight;
    if (wrapW <= 0 || wrapH <= 0 || panzoom.fitWidth <= 0 || panzoom.fitHeight <= 0) {
      panzoom.x = 0;
      panzoom.y = 0;
      return;
    }

    const scaledW = panzoom.fitWidth * panzoom.scale;
    const scaledH = panzoom.fitHeight * panzoom.scale;
    const minX = wrapW - scaledW - panzoom.fitLeft;
    const maxX = -panzoom.fitLeft;
    const minY = wrapH - scaledH - panzoom.fitTop;
    const maxY = -panzoom.fitTop;

    if (scaledW <= wrapW) {
      panzoom.x = (wrapW - scaledW) / 2 - panzoom.fitLeft;
    } else {
      panzoom.x = clampValue(panzoom.x, minX, maxX);
    }
    if (scaledH <= wrapH) {
      panzoom.y = (wrapH - scaledH) / 2 - panzoom.fitTop;
    } else {
      panzoom.y = clampValue(panzoom.y, minY, maxY);
    }
  };

  const applyTransform = () => {
    const canvas = getCanvasElement();
    if (!canvas) return;
    clampPanOffset();
    canvas.style.transform = `translate3d(${panzoom.x.toFixed(3)}px, ${panzoom.y.toFixed(3)}px, 0) scale(${panzoom.scale.toFixed(5)})`;
    if (onZoomChange) onZoomChange(panzoom.scale);
  };

  // 按视口尺寸重新计算内容适配（contain 模式），keepView 保持当前焦点
  const refreshLayout = (keepView = true) => {
    const wrap = getWrapElement();
    const canvas = getCanvasElement();
    if (!wrap || !canvas) return;

    const wrapRect = wrap.getBoundingClientRect();
    const wrapW = wrapRect.width;
    const wrapH = wrapRect.height;
    if (wrapW <= 0 || wrapH <= 0 || contentWidth <= 0 || contentHeight <= 0) return;

    const focusLocalX = wrapW / 2;
    const focusLocalY = wrapH / 2;
    let worldX = (focusLocalX - panzoom.fitLeft - panzoom.x) / panzoom.scale;
    let worldY = (focusLocalY - panzoom.fitTop - panzoom.y) / panzoom.scale;
    if (!Number.isFinite(worldX)) worldX = 0.5;
    if (!Number.isFinite(worldY)) worldY = 0.5;

    const fitScale = Math.min(wrapW / contentWidth, wrapH / contentHeight);
    panzoom.fitWidth = contentWidth * fitScale;
    panzoom.fitHeight = contentHeight * fitScale;
    panzoom.fitLeft = (wrapW - panzoom.fitWidth) / 2;
    panzoom.fitTop = (wrapH - panzoom.fitHeight) / 2;

    canvas.style.width = `${panzoom.fitWidth.toFixed(3)}px`;
    canvas.style.height = `${panzoom.fitHeight.toFixed(3)}px`;
    canvas.style.left = `${panzoom.fitLeft.toFixed(3)}px`;
    canvas.style.top = `${panzoom.fitTop.toFixed(3)}px`;

    if (!keepView || panzoom.scale <= panzoom.minScale + 1e-4) {
      panzoom.scale = panzoom.minScale;
      panzoom.x = 0;
      panzoom.y = 0;
      applyTransform();
      return;
    }

    panzoom.x = focusLocalX - panzoom.fitLeft - worldX * panzoom.scale;
    panzoom.y = focusLocalY - panzoom.fitTop - worldY * panzoom.scale;
    applyTransform();
  };

  const scheduleLayout = (keepView = true) => {
    layoutKeepView = layoutKeepView && keepView;
    if (layoutFrameId) return;
    layoutFrameId = requestFrame(() => {
      const keep = layoutKeepView;
      layoutFrameId = 0;
      layoutKeepView = true;
      refreshLayout(keep);
    });
  };

  const zoomTo = (nextScale, clientX, clientY) => {
    const wrap = getWrapElement();
    if (!wrap) return;
    const targetScale = clampValue(nextScale, panzoom.minScale, panzoom.maxScale);
    if (!Number.isFinite(targetScale) || Math.abs(targetScale - panzoom.scale) < 1e-4) return;

    const wrapRect = wrap.getBoundingClientRect();
    const localX = Number.isFinite(clientX) ? clientX - wrapRect.left : wrapRect.width / 2;
    const localY = Number.isFinite(clientY) ? clientY - wrapRect.top : wrapRect.height / 2;
    const worldX = (localX - panzoom.fitLeft - panzoom.x) / panzoom.scale;
    const worldY = (localY - panzoom.fitTop - panzoom.y) / panzoom.scale;

    panzoom.scale = targetScale;
    panzoom.x = localX - panzoom.fitLeft - worldX * panzoom.scale;
    panzoom.y = localY - panzoom.fitTop - worldY * panzoom.scale;
    applyTransform();
  };

  const zoomByFactor = (factor, clientX, clientY) => {
    const safeFactor = Number(factor);
    if (!Number.isFinite(safeFactor) || safeFactor <= 0) return;
    zoomTo(panzoom.scale * safeFactor, clientX, clientY);
  };

  const resetZoom = () => {
    panzoom.scale = panzoom.minScale;
    panzoom.x = 0;
    panzoom.y = 0;
    applyTransform();
  };

  // ===== 指针事件 =====

  const getEventPointerId = event => {
    const raw = event?.pointerId ?? event?.originalEvent?.pointerId;
    const num = Number(raw);
    return Number.isFinite(num) ? num : -1;
  };

  const getEventClientXY = event => {
    const rawX = event?.clientX ?? event?.originalEvent?.clientX;
    const rawY = event?.clientY ?? event?.originalEvent?.clientY;
    return {
      x: Number.isFinite(Number(rawX)) ? Number(rawX) : 0,
      y: Number.isFinite(Number(rawY)) ? Number(rawY) : 0,
    };
  };

  const initPinch = () => {
    const [first, second] = Array.from(pointerState.points.values());
    if (!first || !second) return false;
    pointerState.isPinching = true;
    pointerState.pinchStartDistance = Math.max(1, Math.hypot(first.x - second.x, first.y - second.y));
    pointerState.pinchStartScale = panzoom.scale;
    return true;
  };

  const endPointer = event => {
    const pointerId = getEventPointerId(event);
    pointerState.points.delete(pointerId);
    const wrap = getWrapElement();
    if (wrap && typeof wrap.releasePointerCapture === 'function') {
      try { wrap.releasePointerCapture(pointerId); } catch { /* 忽略 */ }
    }
    if (pointerState.points.size < 2) {
      pointerState.isPinching = false;
      pointerState.pinchStartDistance = 0;
    }
    if (pointerState.dragPointerId === pointerId) {
      pointerState.dragPointerId = null;
    }
    if (pointerState.points.size === 1 && pointerState.dragPointerId === null) {
      const [remainId, remainPoint] = Array.from(pointerState.points.entries())[0];
      pointerState.dragPointerId = remainId;
      pointerState.dragStartClientX = remainPoint.x;
      pointerState.dragStartClientY = remainPoint.y;
      pointerState.dragStartX = panzoom.x;
      pointerState.dragStartY = panzoom.y;
    }
    if (pointerState.points.size === 0) {
      $(wrap).removeClass('dragging');
      if (pointerState.moved) {
        suppressClick = true;
        topWindow.setTimeout(() => {
          suppressClick = false;
        }, 0);
      }
      pointerState.moved = false;
    }
  };

  // ===== 事件绑定 =====

  $win.on(`resize${ns}`, () => scheduleLayout(true));

  $modal.on(`wheel${ns}`, wrapSelector, function (event) {
    const e = event.originalEvent || event;
    const deltaY = Number(e.deltaY);
    if (!Number.isFinite(deltaY)) return;
    const factor = deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomByFactor(factor, e.clientX, e.clientY);
    event.preventDefault();
  });

  $modal.on(`pointerdown${ns}`, wrapSelector, function (event) {
    // 点在标记或控件上不启动拖拽
    if ($(event.target).closest('.gal-scene-marker, .gal-map-zoom-controls').length) return;
    const pointerId = getEventPointerId(event);
    if (pointerId < 0) return;
    const { x, y } = getEventClientXY(event);
    pointerState.points.set(pointerId, { x, y });

    const wrap = getWrapElement();
    if (wrap && typeof wrap.setPointerCapture === 'function') {
      try { wrap.setPointerCapture(pointerId); } catch { /* 忽略 */ }
    }

    if (pointerState.points.size >= 2) {
      initPinch();
    } else {
      pointerState.dragPointerId = pointerId;
      pointerState.dragStartClientX = x;
      pointerState.dragStartClientY = y;
      pointerState.dragStartX = panzoom.x;
      pointerState.dragStartY = panzoom.y;
    }
  });

  $modal.on(`pointermove${ns}`, wrapSelector, function (event) {
    const pointerId = getEventPointerId(event);
    if (!pointerState.points.has(pointerId)) return;
    const { x, y } = getEventClientXY(event);
    pointerState.points.set(pointerId, { x, y });

    if (pointerState.points.size >= 2) {
      if (!pointerState.isPinching && !initPinch()) return;
      const [first, second] = Array.from(pointerState.points.values());
      const currentDistance = Math.max(1, Math.hypot(first.x - second.x, first.y - second.y));
      const centerX = (first.x + second.x) / 2;
      const centerY = (first.y + second.y) / 2;
      const scaleRatio = currentDistance / Math.max(1, pointerState.pinchStartDistance);
      zoomTo(pointerState.pinchStartScale * scaleRatio, centerX, centerY);
      pointerState.moved = true;
      suppressClick = true;
      event.preventDefault();
      return;
    }

    if (pointerState.dragPointerId !== pointerId) return;
    if (panzoom.scale <= panzoom.minScale + 1e-4) return;

    const dx = x - pointerState.dragStartClientX;
    const dy = y - pointerState.dragStartClientY;
    if (Math.hypot(dx, dy) > 3) {
      pointerState.moved = true;
    }
    panzoom.x = pointerState.dragStartX + dx;
    panzoom.y = pointerState.dragStartY + dy;
    applyTransform();
    $modal.find(wrapSelector).addClass('dragging');
    suppressClick = true;
    event.preventDefault();
  });

  $modal.on(`pointerup${ns} pointercancel${ns} pointerleave${ns}`, wrapSelector, function (event) {
    endPointer(event);
  });

  return {
    refresh: scheduleLayout,
    zoomBy: zoomByFactor,
    reset: resetZoom,
    getScale: () => panzoom.scale,
    // 拖动/捏合刚结束时为 true，用于吞掉误触点击
    isSuppressedClick: () => suppressClick,
    destroy() {
      $win.off(ns);
      $modal.off(ns);
      cancelFrame(layoutFrameId);
      layoutFrameId = 0;
      pointerState.points.clear();
    },
  };
}
