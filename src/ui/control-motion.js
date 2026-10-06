import { DEFAULT_THEME_CLASS } from '../core/constants.js';
import { topWindow } from '../core/env.js';
import { getSettings } from '../core/settings.js';

// ============================================
// 控件动效（所有皮肤通用）
// ============================================
// 关键帧与外观在 数据库界面插件.css「控件动效」段，作用域 .gal-motion（设置项 controlMotion 开启且
// 系统未要求减少动态效果时挂到 overlay / 选项层 / 历史弹窗），颜色读 --gal-fx-*（默认取各皮肤的 --gal-color-*）。
// 其他皮肤大量占用面板、NEXT、名牌、选项卡的 ::before / ::after，所以这里不用伪元素：
//   - 面板扫光 / 边框流光 / 光标聚光画在插入面板内的 <i class="gal-fx-panel">；
//   - 涟漪、火花、悬停扫光、浮出标签画在 overlay / 选项层顶部的 .gal-fx-layer 上，按目标控件的矩形裁切；
//   - 选项卡光泽与聚光画在卡片内的 <i class="gal-fx-glint">（choices.js 生成）；
//   - 3D 倾斜 / 磁吸写独立的 rotate / translate 属性，与皮肤自身的 transform 叠加而不覆盖。

export const MOTION_CLASS = 'gal-motion';

// 逐字点亮动画时长（与 CSS gal-fx-ch 一致）：打字机自然打完后等它播完再换成干净结构
export const MOTION_CHAR_FADE_MS = 480;
// 选项选中反馈时长（与 styles.js gal-choice-picked / dropped 动效版一致），播完再提交
export const MOTION_CHOICE_PICK_MS = 640;

const ADVANCE_MS = 1300;
const NAME_GHOST_MS = 260;
const HANDLERS_KEY = '__galgame_control_motion__';

const QUICK_LABELS = [
  ['.gal-sprite-toggle.sprites-hidden', '显示立绘'],
  ['.gal-sprite-toggle', '隐藏立绘'],
  ['.gal-location-popup-trigger', '地点'],
  ['.gal-time-popup-trigger', '时间'],
];

function prefersReducedMotion() {
  try {
    return !!topWindow.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch (_) {
    return false;
  }
}

export function isControlMotionEnabled() {
  return getSettings()?.controlMotion !== false && !prefersReducedMotion();
}

export function isMotionNode(node) {
  return !!node?.closest?.(`.${MOTION_CLASS}`);
}

// 面板特效层：首个子元素，CSS 里 z-index:-1 垫在文字之下
function ensurePanelFx(panel) {
  if (!panel) return null;
  let fx = panel.querySelector(':scope > .gal-fx-panel');
  if (!fx) {
    fx = panel.ownerDocument.createElement('i');
    fx.className = 'gal-fx-panel';
    fx.setAttribute('aria-hidden', 'true');
    panel.prepend(fx);
  }
  return fx;
}

/**
 * 按设置给 overlay 挂 / 摘 .gal-motion，开启时挂上文档级监听并补齐面板特效层。
 * 选项层与历史弹窗由 choices.js / history.js 从 overlay 同步此类。
 */
export function syncControlMotion($overlay) {
  if (!$overlay?.length) return;
  const on = isControlMotionEnabled();
  $overlay.toggleClass(MOTION_CLASS, on);
  if (!on) return;
  initControlMotion();
  $overlay[0].querySelectorAll('.gal-text-panel').forEach(ensurePanelFx);
}

function restartClass(el, cls, durationMs) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  const timerKey = `__galFxTimer_${cls}`;
  if (el[timerKey]) topWindow.clearTimeout(el[timerKey]);
  el[timerKey] = topWindow.setTimeout(() => {
    el.classList.remove(cls);
    el[timerKey] = null;
  }, durationMs);
}

// 推进一句：面板扫光 + 边框流光绕行一周（typewriter 每次渲染新一页时调用）。
// 对话层同时挂 .gal-fx-advance，供皮肤挂自己的推进动效
export function notifyDialogAdvance(textNode) {
  if (!isMotionNode(textNode)) return;
  const panel = textNode.closest('.gal-text-panel');
  const fx = ensurePanelFx(panel);
  if (fx) restartClass(fx, 'gal-fx-advance', ADVANCE_MS);
  const layer = textNode.closest('.gal-dialog-layer');
  if (layer) restartClass(layer, 'gal-fx-advance', ADVANCE_MS);
}

/**
 * 名牌换人：旧名作为幽灵上浮消散，新名拆成逐字 <b> 依次落下回弹（CSS 按 --ci 错峰），
 * 播完还原为纯文本——部分皮肤给名字做渐变描字（background-clip:text），子元素常驻会影响绘制。
 */
export function playNameSwap(badgeEl, labelEl, prevText) {
  if (!badgeEl || !labelEl || !isMotionNode(badgeEl)) return;
  const doc = labelEl.ownerDocument;
  const text = labelEl.textContent || '';
  const chars = Array.from(text);
  if (!chars.length) return;

  const frag = doc.createDocumentFragment();
  chars.forEach((ch, i) => {
    const b = doc.createElement('b');
    b.className = 'gal-fx-ch';
    b.style.setProperty('--ci', String(i));
    b.textContent = ch;
    frag.appendChild(b);
  });
  labelEl.replaceChildren(frag);
  if (labelEl.__galFxNameTimer) topWindow.clearTimeout(labelEl.__galFxNameTimer);
  labelEl.__galFxNameTimer = topWindow.setTimeout(() => {
    labelEl.__galFxNameTimer = null;
    if (labelEl.querySelector('.gal-fx-ch') && labelEl.textContent === text) labelEl.textContent = text;
  }, chars.length * 70 + 700);

  badgeEl.querySelectorAll(':scope > .gal-fx-ghost').forEach(el => el.remove());
  if (!prevText || prevText === text) return;
  const win = doc.defaultView;
  if (win.getComputedStyle(badgeEl).position === 'static') return;
  // 用 <i> 而非 <span>：其他代码以 '.gal-name-badge span' 读写名字，幽灵不能被选中
  const ghost = doc.createElement('i');
  ghost.className = 'gal-fx-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.textContent = prevText;
  const cs = win.getComputedStyle(labelEl);
  Object.assign(ghost.style, {
    left: `${labelEl.offsetLeft}px`,
    top: `${labelEl.offsetTop}px`,
    font: cs.font,
    letterSpacing: cs.letterSpacing,
    color: cs.color,
    writingMode: cs.writingMode,
  });
  badgeEl.appendChild(ghost);
  topWindow.setTimeout(() => ghost.remove(), NAME_GHOST_MS);
}

// 入场：面板从模糊中升起，底栏按钮依次弹出，顶部状态签落下，交互按钮自右滑入。
// 用 Web Animations API 而非 CSS animation：不占用元素的 animation 属性，皮肤自带的动画（如面板脉冲）照常运行
export function playControlIntro(overlayEl) {
  if (!overlayEl?.classList.contains(MOTION_CLASS)) return;
  const play = (el, keyframes, delay, duration, easing) => {
    if (!el || !el.getClientRects().length) return;
    el.animate(keyframes, { duration, delay, easing, fill: 'backwards' });
  };
  const SPRING = 'cubic-bezier(.34,1.6,.64,1)';
  const SMOOTH = 'cubic-bezier(.22,1,.36,1)';
  const POP = [{ opacity: 0, scale: 0.3, translate: '0 12px' }, { opacity: 1, scale: 1, translate: '0 0' }];
  overlayEl.querySelectorAll('.gal-text-panel').forEach(panel => play(panel,
    [{ opacity: 0, translate: '0 46px', filter: 'blur(10px)' }, { opacity: 1, translate: '0 0', filter: 'blur(0)' }], 0, 850, SMOOTH));
  overlayEl.querySelectorAll('.gal-bottom-toolbar').forEach(toolbar => {
    let i = 0;
    toolbar.querySelectorAll(':scope > :is(.gal-footer-btn, .gal-pending-choices-btn)').forEach(btn => {
      if (btn.getClientRects().length) play(btn, POP, 380 + 45 * i++, 550, SPRING);
    });
  });
  overlayEl.querySelectorAll('.gal-footer-btn-next').forEach(btn => play(btn, POP, 800, 600, SPRING));
  overlayEl.querySelectorAll(':scope > :is(.gal-status-bar-container, .gal-fullscreen-btn)').forEach(el => play(el,
    [{ opacity: 0, translate: '0 -24px' }, { opacity: 1, translate: '0 0' }], 150, 600, SMOOTH));
  overlayEl.querySelectorAll('.gal-action-btn').forEach((btn, i) => play(btn,
    [{ opacity: 0, translate: '40px 0' }, { opacity: 1, translate: '0 0' }], 500 + 80 * i, 650, SMOOTH));
  overlayEl.querySelectorAll(':is(.gal-sprite-toggle, .gal-status-popup-trigger)').forEach((btn, i) => play(btn, POP, 600 + 70 * i, 500, SPRING));
}

// ---------- 特效层（涟漪 / 火花 / 扫光 / 浮出标签） ----------

const SCOPE = `.${MOTION_CLASS}`;
const PRESS_SELECTOR = [
  '.gal-footer-btn',
  '.gal-footer-btn-next',
  '.gal-action-btn',
  '.gal-pending-choices-btn',
  '.gal-choice-card',
  '.gal-menu-btn',
  '.gal-fullscreen-btn',
  '.gal-sprite-toggle',
  '.gal-status-popup-trigger',
].map(sel => `${SCOPE} ${sel}`).join(', ');

function getHost(el) {
  return el.closest('#gal-layer-choices') || el.closest('#gal-global-overlay');
}

function getFxLayer(host) {
  let layer = host.querySelector(':scope > .gal-fx-layer');
  if (!layer) {
    layer = host.ownerDocument.createElement('div');
    layer.className = 'gal-fx-layer';
    layer.setAttribute('aria-hidden', 'true');
    host.appendChild(layer);
  }
  return layer;
}

// 特效层坐标：视口坐标换算到层内布局像素（层所在容器可能被缩放）
function toLayer(layer, clientX, clientY) {
  const box = layer.getBoundingClientRect();
  const k = box.width / (layer.offsetWidth || box.width || 1);
  return { x: (clientX - box.left) / k, y: (clientY - box.top) / k, k };
}

// 在特效层上铺一个与目标控件同矩形、同圆角的裁切框，返回该框
function makeClip(el, cls) {
  const host = getHost(el);
  if (!host) return null;
  const layer = getFxLayer(host);
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const p = toLayer(layer, r.left, r.top);
  const clip = el.ownerDocument.createElement('span');
  clip.className = `gal-fx-clip ${cls}`;
  Object.assign(clip.style, {
    left: `${p.x}px`,
    top: `${p.y}px`,
    width: `${r.width / p.k}px`,
    height: `${r.height / p.k}px`,
    borderRadius: el.ownerDocument.defaultView.getComputedStyle(el).borderRadius,
  });
  layer.appendChild(clip);
  return clip;
}

function removeAfter(anim, el) {
  anim.finished.then(() => el.remove(), () => el.remove());
}

function spawnRipple(el, e) {
  const clip = makeClip(el, 'is-ripple');
  if (!clip) return;
  const r = el.getBoundingClientRect();
  const k = r.width / (parseFloat(clip.style.width) || r.width);
  const dot = el.ownerDocument.createElement('span');
  dot.className = 'gal-fx-ripple';
  dot.style.left = `${(e.clientX - r.left) / k}px`;
  dot.style.top = `${(e.clientY - r.top) / k}px`;
  clip.appendChild(dot);
  const size = Math.max(r.width, r.height) / k / 6;
  removeAfter(dot.animate(
    [{ scale: 0, opacity: 1 }, { scale: size, opacity: 0 }],
    { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)' },
  ), clip);
}

// 冲击环 + 放射状光丝 / 菱形火花，中心为目标控件中心
function burst(el, count, spread) {
  const host = getHost(el);
  if (!host) return;
  const layer = getFxLayer(host);
  const r = el.getBoundingClientRect();
  const { x, y } = toLayer(layer, r.left + r.width / 2, r.top + r.height / 2);
  const doc = el.ownerDocument;

  const ring = doc.createElement('span');
  ring.className = 'gal-fx-ring';
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  layer.appendChild(ring);
  removeAfter(ring.animate(
    [{ scale: 0.4, opacity: 1 }, { scale: spread / 8, opacity: 0 }],
    { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)' },
  ), ring);

  for (let i = 0; i < count; i++) {
    const isDot = i % 3 === 2;
    const spark = doc.createElement('span');
    spark.className = isDot ? 'gal-fx-spark is-dot' : 'gal-fx-spark';
    spark.style.left = `${x}px`;
    spark.style.top = `${y}px`;
    layer.appendChild(spark);
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const dist = spread * (0.75 + Math.random() * 0.6);
    const rotate = isDot ? '45deg' : `${((angle * 180) / Math.PI).toFixed(1)}deg`;
    const at = f => `${(Math.cos(angle) * dist * f).toFixed(1)}px ${(Math.sin(angle) * dist * f).toFixed(1)}px`;
    removeAfter(spark.animate(
      [
        { translate: '0 0', rotate, scale: isDot ? '1' : '0.4 1', opacity: 1 },
        { translate: at(0.55), rotate, scale: isDot ? '1.2' : '1.4 1', opacity: 1, offset: 0.35 },
        { translate: at(1), rotate, scale: isDot ? '0' : '0.2 1', opacity: 0 },
      ],
      { duration: 620 + Math.random() * 280, easing: 'cubic-bezier(.16,1,.3,1)' },
    ), spark);
  }
}

// NEXT 悬停：一道高光掠过
function sweepShine(el) {
  const clip = makeClip(el, 'is-shine');
  if (!clip) return;
  const bar = el.ownerDocument.createElement('span');
  bar.className = 'gal-fx-shine';
  clip.appendChild(bar);
  removeAfter(bar.animate(
    [{ translate: '-120% 0' }, { translate: '320% 0' }],
    { duration: 750, easing: 'cubic-bezier(.4,0,.2,1)' },
  ), clip);
}

// 交互按钮悬停：强调色自左涌入并停留，离开时淡出（默认皮肤家族用自带的实色液态填充，不走这里）
const hoverFills = new WeakMap();
function startFill(el) {
  if (el.closest(`.${DEFAULT_THEME_CLASS}`) || hoverFills.has(el)) return;
  const clip = makeClip(el, 'is-fill');
  if (!clip) return;
  hoverFills.set(el, clip);
  clip.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 480, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' });
}

function endFill(el) {
  const clip = hoverFills.get(el);
  if (!clip) return;
  hoverFills.delete(el);
  removeAfter(clip.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-out', fill: 'forwards' }), clip);
}

// 右侧小钮悬停：左侧浮出文字签（默认皮肤家族的小钮自身展开为胶囊，不走这里）
const quickLabels = new WeakMap();
function showQuickLabel(el) {
  if (el.closest(`.${DEFAULT_THEME_CLASS}`) || quickLabels.has(el)) return;
  const text = QUICK_LABELS.find(([sel]) => el.matches(sel))?.[1];
  const host = getHost(el);
  if (!text || !host) return;
  const layer = getFxLayer(host);
  const r = el.getBoundingClientRect();
  const p = toLayer(layer, r.left, r.top + r.height / 2);
  const label = el.ownerDocument.createElement('span');
  label.className = 'gal-fx-label';
  label.textContent = text;
  label.style.left = `${p.x - 8}px`;
  label.style.top = `${p.y}px`;
  layer.appendChild(label);
  quickLabels.set(el, label);
  label.animate([{ opacity: 0, translate: '-90% -50%' }, { opacity: 1, translate: '-100% -50%' }], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' });
}

function hideQuickLabel(el) {
  const label = quickLabels.get(el);
  if (!label) return;
  quickLabels.delete(el);
  removeAfter(label.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }), label);
}

// 底栏悬停指示器：插入底栏末尾（不影响皮肤的 :nth-child），z-index:-1 垫在按钮下，
// 在按钮间弹性滑动；圆角与倾斜跟随当前按钮
function moveToolbarIndicator(button) {
  const toolbar = button.parentElement;
  if (!toolbar?.classList.contains('gal-bottom-toolbar')) return;
  let ind = toolbar.querySelector(':scope > .gal-fx-tb-ind');
  if (!ind) {
    ind = toolbar.ownerDocument.createElement('span');
    ind.className = 'gal-fx-tb-ind';
    ind.setAttribute('aria-hidden', 'true');
    toolbar.appendChild(ind);
  }
  const cs = toolbar.ownerDocument.defaultView.getComputedStyle(button);
  const first = !ind.classList.contains('is-on');
  if (first) ind.style.transition = 'none';
  ind.style.translate = `${button.offsetLeft}px ${button.offsetTop}px`;
  ind.style.width = `${button.offsetWidth}px`;
  ind.style.height = `${button.offsetHeight}px`;
  ind.style.borderRadius = cs.borderRadius;
  ind.style.transform = cs.transform === 'none' ? '' : cs.transform;
  if (first) {
    void ind.offsetWidth;
    ind.style.transition = '';
  }
  ind.classList.add('is-on');
}

function hideToolbarIndicator(toolbar) {
  toolbar?.querySelector(':scope > .gal-fx-tb-ind')?.classList.remove('is-on');
}

function setSpot(el, e) {
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return r;
  el.style.setProperty('--gal-fx-px', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
  el.style.setProperty('--gal-fx-py', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
  return r;
}

// ---------- 指针事件 ----------

function asElement(node) {
  return node instanceof topWindow.Element ? node : null;
}

function handlePointerMove(e) {
  if (e.pointerType !== 'mouse') return;
  const target = asElement(e.target);
  if (!target?.closest(SCOPE)) return;

  // NEXT 磁吸：被鼠标轻微吸过去
  const next = target.closest(`${SCOPE} .gal-footer-btn-next`);
  if (next) {
    const r = next.getBoundingClientRect();
    const k = r.width / (next.offsetWidth || r.width);
    const dx = (e.clientX - (r.left + r.width / 2)) / k;
    const dy = (e.clientY - (r.top + r.height / 2)) / k;
    next.style.translate = `${(dx * 0.18).toFixed(1)}px ${(dy * 0.3).toFixed(1)}px`;
  }

  // 选项卡：3D 倾斜（独立 rotate 属性，绕倾斜轴转）+ 聚光
  const card = target.closest(`${SCOPE} .gal-choice-card`);
  if (card && !card.classList.contains('gal-choice-picked')) {
    const glint = card.querySelector(':scope > .gal-fx-glint');
    const r = setSpot(glint || card, e);
    if (r.width && r.height) {
      const ax = -((e.clientY - r.top) / r.height - 0.5);
      const ay = (e.clientX - r.left) / r.width - 0.5;
      const angle = Math.min(1, Math.hypot(ax, ay) * 2) * 7;
      card.style.rotate = `${ax.toFixed(3)} ${ay.toFixed(3)} 0 ${angle.toFixed(2)}deg`;
    }
  }

  const panel = target.closest(`${SCOPE} .gal-text-panel`);
  const panelFx = panel?.querySelector(':scope > .gal-fx-panel');
  if (panelFx) setSpot(panelFx, e);
}

function handlePointerOver(e) {
  if (e.pointerType !== 'mouse') return;
  const target = asElement(e.target);
  if (!target?.closest(SCOPE)) return;
  const from = asElement(e.relatedTarget);

  const btn = target.closest(`${SCOPE} .gal-bottom-toolbar > .gal-footer-btn`);
  if (btn) moveToolbarIndicator(btn);

  const next = target.closest(`${SCOPE} .gal-footer-btn-next`);
  if (next && !next.contains(from)) sweepShine(next);

  const action = target.closest(`${SCOPE} .gal-action-btn`);
  if (action) startFill(action);

  const quick = target.closest(`${SCOPE} :is(.gal-sprite-toggle, .gal-status-popup-trigger)`);
  if (quick) showQuickLabel(quick);
}

function handlePointerOut(e) {
  const from = asElement(e.target);
  if (!from) return;
  const to = asElement(e.relatedTarget);
  const left = el => el && !el.contains(to);

  const next = from.closest('.gal-footer-btn-next');
  if (left(next)) next.style.translate = '';

  const card = from.closest('.gal-choice-card');
  if (left(card)) card.style.rotate = '';

  const btn = from.closest('.gal-bottom-toolbar > .gal-footer-btn');
  if (btn && !to?.closest?.('.gal-bottom-toolbar > .gal-footer-btn')) hideToolbarIndicator(btn.parentElement);

  const action = from.closest('.gal-action-btn');
  if (left(action)) endFill(action);

  const quick = from.closest(':is(.gal-sprite-toggle, .gal-status-popup-trigger)');
  if (left(quick)) hideQuickLabel(quick);
}

function handlePointerDown(e) {
  const target = asElement(e.target);
  const el = target?.closest(PRESS_SELECTOR);
  if (el) spawnRipple(el, e);
}

// 捕获阶段：选项卡自身的 click 处理会 stopPropagation，冒泡阶段收不到
function handleClickCapture(e) {
  const target = asElement(e.target);
  if (!target) return;

  const next = target.closest(`${SCOPE} .gal-footer-btn-next`);
  if (next) {
    burst(next, 18, 90);
    next.animate([{ scale: 1 }, { scale: 0.88 }, { scale: 1.06 }, { scale: 1 }], { duration: 420, easing: 'ease-out' });
    return;
  }

  const card = target.closest(`${SCOPE} .gal-choice-card`);
  if (card && !card.classList.contains('gal-choice-picked')) {
    card.style.rotate = '';
    burst(card, 24, 150);
  }
}

let moveFrame = 0;
let lastMove = null;
const HANDLERS = {
  pointermove: e => {
    lastMove = e;
    if (moveFrame) return;
    moveFrame = topWindow.requestAnimationFrame(() => {
      moveFrame = 0;
      if (lastMove) handlePointerMove(lastMove);
    });
  },
  pointerover: handlePointerOver,
  pointerout: handlePointerOut,
  pointerdown: handlePointerDown,
  click: handleClickCapture,
};

/**
 * 挂载文档级监听（幂等）。脚本热重载时先卸掉上一个实例挂的监听，避免重复涟漪 / 火花。
 * 处理函数内按 .gal-motion 判断作用域，关闭动效后监听留着也不生效。
 */
export function initControlMotion() {
  const doc = topWindow.document;
  const prev = topWindow[HANDLERS_KEY];
  if (prev?.handlers === HANDLERS) return;
  if (prev?.handlers) {
    Object.entries(prev.handlers).forEach(([type, fn]) => doc.removeEventListener(type, fn, true));
  }
  Object.entries(HANDLERS).forEach(([type, fn]) => doc.addEventListener(type, fn, { capture: true, passive: true }));
  topWindow[HANDLERS_KEY] = { handlers: HANDLERS };
}
