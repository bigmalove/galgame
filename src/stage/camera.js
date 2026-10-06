import { $, topWindow } from '../core/env.js';
import { getSettings } from '../core/settings.js';

// ============================================
// 镜头：背景漂移 / 多层视差 / 说话人推镜 / 阻尼震屏
// ============================================
// 全部通过 CSS 独立变换属性（translate / scale）实现，与皮肤与转场写在 transform 上的效果叠加互不覆盖：
//   .gal-layer-bg          漂移（CSS 动画驱动 scale）+ 视差/推镜（inline translate）
//   .gal-layer-character   视差 + 推镜（inline translate + scale，原点在底部中央）
//   .gal-layer-effect-bg/fg 视差（前景层位移最大，营造纵深）
//   .gal-game-container    震屏（inline translate，结束后清除）
// 直接写各层元素自己的 style，而不是在 overlay 根节点写 CSS 变量——后者每帧会让整棵子树重算样式。
// rAF 只在数值未收敛 / 指针移动 / 震屏期间运行，静止时不占 CPU。仅「填满裁剪」背景模式启用
// （完整显示 / 避开对话框模式下放大与位移会露边或压到对话框）。

const PARALLAX = { bg: 1.1, char: 1.6, fxBack: 1.4, fxFront: 2.8 }; // 满偏时的位移（% 自身尺寸）
const PUSH_X = 1.0; // 推镜横移（%）
const PUSH_ZOOM = 0.02; // 推镜放大
const PARALLAX_LERP = 0.07;
const PUSH_LERP = 0.035;
const SETTLE_EPS = 0.0005;

const state = {
  tx: 0, ty: 0, x: 0, y: 0,
  pushTarget: 0, push: 0,
  zoomTarget: 1, zoom: 1,
  shakeStart: 0, shakeUntil: 0, shakePower: 0,
  raf: 0,
  inputsBound: false,
  gyroBase: null,
  styled: false,
};

function prefersReducedMotion() {
  try {
    return !!topWindow.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch (_) {
    return false;
  }
}

function getOverlayEl() {
  return topWindow.document.getElementById('gal-global-overlay');
}

function getCameraConfig() {
  const settings = getSettings() || {};
  const reduced = prefersReducedMotion();
  const coverMode = (settings.bgFillMode || 'cover') === 'cover';
  return {
    drift: !reduced && coverMode && settings.stageCameraDrift !== false,
    parallax: !reduced && coverMode && settings.stageParallax !== false,
    push: !reduced && coverMode && settings.stageSpeakerPush !== false,
    shake: !reduced,
  };
}

function isOverlayActive(overlay) {
  return !!overlay && overlay.classList.contains('active');
}

function getLayers(overlay) {
  return {
    container: overlay.querySelector('.gal-game-container'),
    bg: overlay.querySelector('.gal-layer-bg'),
    char: overlay.querySelector('.gal-layer-character'),
    fxBack: overlay.querySelector('.gal-layer-effect-bg'),
    fxFront: overlay.querySelector('.gal-layer-effect-fg'),
  };
}

function clearInlineCamera(overlay) {
  if (!overlay) return;
  const layers = getLayers(overlay);
  [layers.bg, layers.char, layers.fxBack, layers.fxFront, layers.container].forEach(el => {
    if (!el) return;
    el.style.removeProperty('translate');
    el.style.removeProperty('scale');
  });
  state.styled = false;
}

const pct = v => `${v.toFixed(3)}%`;

function writeLayers(overlay, shakeX, shakeY) {
  const layers = getLayers(overlay);
  const { x, y, push, zoom } = state;
  if (layers.bg) layers.bg.style.translate = `${pct(-x * PARALLAX.bg + push * 0.45)} ${pct(-y * PARALLAX.bg * 0.8)}`;
  if (layers.char) {
    layers.char.style.translate = `${pct(-x * PARALLAX.char + push)} ${pct(-y * PARALLAX.char * 0.5)}`;
    layers.char.style.scale = zoom.toFixed(4);
  }
  if (layers.fxBack) layers.fxBack.style.translate = `${pct(-x * PARALLAX.fxBack)} ${pct(-y * PARALLAX.fxBack * 0.7)}`;
  if (layers.fxFront) layers.fxFront.style.translate = `${pct(-x * PARALLAX.fxFront + push * 1.4)} ${pct(-y * PARALLAX.fxFront * 0.7)}`;
  if (layers.container) {
    if (shakeX || shakeY) layers.container.style.translate = `${shakeX.toFixed(2)}px ${shakeY.toFixed(2)}px`;
    else layers.container.style.removeProperty('translate');
  }
  // 情境样式卡片的 3D 倾斜（styles.js 早已按 --par-x/--par-y 写好 rotateX/Y，此前无 JS 驱动）
  const styledCard = overlay.querySelector('.gal-styled-stage.show .gal-styled-stage-content');
  if (styledCard) {
    styledCard.style.setProperty('--par-x', (x * 6).toFixed(2));
    styledCard.style.setProperty('--par-y', (y * 4).toFixed(2));
  }
  state.styled = true;
}

function frame(now) {
  state.raf = 0;
  const overlay = getOverlayEl();
  if (!isOverlayActive(overlay)) return;
  const cfg = getCameraConfig();
  const camOn = cfg.parallax || cfg.push;

  const tx = cfg.parallax ? state.tx : 0;
  const ty = cfg.parallax ? state.ty : 0;
  state.x += (tx - state.x) * PARALLAX_LERP;
  state.y += (ty - state.y) * PARALLAX_LERP;
  state.push += ((cfg.push ? state.pushTarget : 0) - state.push) * PUSH_LERP;
  state.zoom += ((cfg.push ? state.zoomTarget : 1) - state.zoom) * PUSH_LERP;

  let shakeX = 0;
  let shakeY = 0;
  const shaking = cfg.shake && now < state.shakeUntil;
  if (shaking) {
    const t = (now - state.shakeStart) / 1000;
    const decay = Math.exp(-t * 6.5);
    const container = overlay.querySelector('.gal-game-container');
    const amp = (container?.clientWidth || 800) * 0.012 * state.shakePower * decay;
    shakeX = amp * Math.sin(t * 58);
    shakeY = amp * 0.6 * Math.cos(t * 47);
  }

  if (camOn || shaking) writeLayers(overlay, shakeX, shakeY);
  else if (state.styled) clearInlineCamera(overlay);

  const settled = Math.abs(tx - state.x) < SETTLE_EPS
    && Math.abs(ty - state.y) < SETTLE_EPS
    && Math.abs((cfg.push ? state.pushTarget : 0) - state.push) < SETTLE_EPS
    && Math.abs((cfg.push ? state.zoomTarget : 1) - state.zoom) < SETTLE_EPS / 10
    && !shaking;
  if (!settled) {
    state.raf = topWindow.requestAnimationFrame(frame);
  } else if (!camOn && state.styled) {
    clearInlineCamera(overlay);
  } else if (camOn) {
    // 收敛后写一次精确终值；震屏结束清掉容器位移
    writeLayers(overlay, 0, 0);
  }
}

function kick() {
  if (!state.raf) state.raf = topWindow.requestAnimationFrame(frame);
}

// ---------- 输入：鼠标 / 陀螺仪 ----------
function onPointerMove(event) {
  if (event.pointerType && event.pointerType !== 'mouse') return;
  const overlay = getOverlayEl();
  if (!isOverlayActive(overlay) || !getCameraConfig().parallax) return;
  const container = overlay.querySelector('.gal-game-container');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  if (inside) {
    state.tx = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
    state.ty = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2));
  } else {
    state.tx = 0;
    state.ty = 0;
  }
  kick();
}

function onDeviceOrientation(event) {
  if (event.gamma == null || event.beta == null) return;
  const overlay = getOverlayEl();
  if (!isOverlayActive(overlay) || !getCameraConfig().parallax) return;
  // 以初次读数为中性姿态，并缓慢回正，避免手持角度漂移后视差卡在一侧
  if (!state.gyroBase) state.gyroBase = { gamma: event.gamma, beta: event.beta };
  state.gyroBase.gamma += (event.gamma - state.gyroBase.gamma) * 0.004;
  state.gyroBase.beta += (event.beta - state.gyroBase.beta) * 0.004;
  state.tx = Math.max(-1, Math.min(1, (event.gamma - state.gyroBase.gamma) / 18));
  state.ty = Math.max(-1, Math.min(1, (event.beta - state.gyroBase.beta) / 18));
  kick();
}

function bindInputs() {
  if (state.inputsBound) return;
  state.inputsBound = true;
  topWindow.document.addEventListener('pointermove', onPointerMove, { passive: true });
  let coarse = false;
  try {
    coarse = !!topWindow.matchMedia?.('(pointer: coarse)').matches;
  } catch (_) {}
  if (coarse) topWindow.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });
}

function unbindInputs() {
  if (!state.inputsBound) return;
  state.inputsBound = false;
  topWindow.document.removeEventListener('pointermove', onPointerMove);
  topWindow.removeEventListener('deviceorientation', onDeviceOrientation);
}

// 脚本卸载（关闭脚本 / 实时修改热重载）：监听器挂在酒馆主页面上，不移除会随重载累积，
// 且旧闭包仍指向已销毁的脚本 iframe；同时停掉 rAF、复位各层 inline 变换
function destroyCamera() {
  unbindInputs();
  if (state.raf) topWindow.cancelAnimationFrame(state.raf);
  state.raf = 0;
  state.shakeUntil = 0;
  const overlay = getOverlayEl();
  clearInlineCamera(overlay);
  overlay?.classList.remove('gal-cam-on', 'gal-cam-drift');
}

$(window).on('pagehide', destroyCamera);

// ---------- 对外 ----------

// 设置项变化 / overlay 重建后调用：同步 class（漂移动画、will-change）与 inline 状态
export function applyCameraSettings() {
  const overlay = getOverlayEl();
  if (!overlay) return;
  const cfg = getCameraConfig();
  const camOn = cfg.drift || cfg.parallax || cfg.push;
  overlay.classList.toggle('gal-cam-on', camOn);
  overlay.classList.toggle('gal-cam-drift', cfg.drift);
  bindInputs();
  if (!cfg.parallax) {
    state.tx = 0;
    state.ty = 0;
  }
  if (!camOn) {
    state.x = state.y = state.push = 0;
    state.zoom = 1;
    clearInlineCamera(overlay);
    return;
  }
  requestCameraFocus();
  kick();
}

// 说话人变化后调用：镜头轻推向说话人一侧并微微放大；旁白/无人时回正
export function requestCameraFocus() {
  topWindow.requestAnimationFrame(() => {
    const overlay = getOverlayEl();
    if (!isOverlayActive(overlay) || !getCameraConfig().push) {
      state.pushTarget = 0;
      state.zoomTarget = 1;
      kick();
      return;
    }
    const container = overlay.querySelector('.gal-game-container');
    const speaker = overlay.querySelector('.gal-layer-character .gal-char-container.speaking');
    if (!container || !speaker) {
      state.pushTarget = 0;
      state.zoomTarget = 1;
    } else {
      const cRect = container.getBoundingClientRect();
      const sRect = speaker.getBoundingClientRect();
      const ratio = cRect.width ? ((sRect.left + sRect.width / 2) - cRect.left) / cRect.width : 0.5;
      state.pushTarget = Math.max(-PUSH_X, Math.min(PUSH_X, (0.5 - ratio) * 2 * PUSH_X));
      state.zoomTarget = 1 + PUSH_ZOOM;
    }
    kick();
  });
}

// 阻尼震屏：power 1 为标准强度（约 1.2% 画面宽度的初始振幅）
export function shakeStage({ power = 1, duration = 650 } = {}) {
  if (!getCameraConfig().shake) return;
  const now = topWindow.performance.now();
  state.shakeStart = now;
  state.shakeUntil = now + duration;
  state.shakePower = Math.max(0.1, Math.min(2.5, Number(power) || 1));
  kick();
}

export function resetCamera() {
  state.tx = state.ty = state.x = state.y = 0;
  state.pushTarget = state.push = 0;
  state.zoomTarget = state.zoom = 1;
  state.shakeUntil = 0;
  clearInlineCamera(getOverlayEl());
}
