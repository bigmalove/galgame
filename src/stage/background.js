import { BG_TRANSITION_MS, SCRIPT_NAME } from '../core/constants.js';
import { $, topWindow } from '../core/env.js';
import { getSettings } from '../core/settings.js';
import { updateAmbientLightFromImage, forgetAmbientSource } from './ambient-light.js';
import { stageFlash, showStageBanner } from './stage-fx.js';

// ============================================
// 背景层：先解码再转场 + 转场库
// ============================================
// 背景层结构（overlay.js / skin-twilight.js 构建）：
//   .gal-layer-bg > .gal-bg-layer.gal-bg-base + .gal-bg-layer.gal-bg-front
// 图片 URL 统一走 CSS 变量 --gal-bg-url（「避开对话框」模式要喂给伪元素）。
//
// 转场类型（.gal-layer-bg[data-bg-tr]，样式见 数据库界面插件.css「转场库」）：
//   cinematic 叠化 + 聚焦 + 光扫（原有效果，默认）
//   wipe      斜切擦除（@property 驱动 mask 渐变停靠点）
//   iris      光圈展开（clip-path circle）
//   strips    硬切条带（多条斜带交错滑入）
//   dissolve  墨迹溶解（规则图阈值 mask，canvas 合成）
//   black     黑场 + 地点字幕（时间跳跃 / 换章）
//   flash     闪白 + 推远聚焦（CG 揭示）

// 解码等待上限：期间旧画面保持不动；超时则照常开播（慢网大图回退为旧行为）
const DECODE_TIMEOUT_MS = 6000;
const IMAGE_CACHE_LIMIT = 8;
const STRIP_COUNT = 7;

export const BG_TRANSITION_TYPES = ['cinematic', 'wipe', 'iris', 'strips', 'dissolve', 'black', 'flash'];
const RANDOM_POOL = ['cinematic', 'wipe', 'iris', 'strips', 'dissolve'];
const TRANSITION_DURATION = {
  cinematic: BG_TRANSITION_MS,
  wipe: 1050,
  iris: 1100,
  strips: 1000,
  dissolve: 1300,
  flash: 1200,
};

const topDoc = topWindow.document;
const wait = ms => new Promise(resolve => topWindow.setTimeout(resolve, ms));
const nextFrame = () => new Promise(resolve => topWindow.requestAnimationFrame(() => resolve()));

// ---------- 图片预加载 / 解码 ----------
const imageCache = new Map(); // url -> Promise<HTMLImageElement|null>

export function preloadBackgroundImage(url, timeoutMs = DECODE_TIMEOUT_MS) {
  const key = String(url || '');
  if (!key) return Promise.resolve(null);
  if (imageCache.has(key)) {
    const cached = imageCache.get(key);
    imageCache.delete(key);
    imageCache.set(key, cached); // LRU：命中后移到队尾
    return cached;
  }
  const task = new Promise(resolve => {
    const img = new topWindow.Image();
    let settled = false;
    const done = value => {
      if (settled) return;
      settled = true;
      topWindow.clearTimeout(timer);
      resolve(value);
    };
    // 超时不阻塞转场（大图慢网络时照常开播，与旧行为一致）
    const timer = topWindow.setTimeout(() => done(null), timeoutMs);
    img.onload = () => {
      if (typeof img.decode === 'function') img.decode().then(() => done(img), () => done(img));
      else done(img);
    };
    img.onerror = () => done(null);
    img.src = key;
  }).then(img => {
    if (!img) imageCache.delete(key); // 失败/超时不缓存，下次重试
    return img;
  });
  imageCache.set(key, task);
  while (imageCache.size > IMAGE_CACHE_LIMIT) {
    imageCache.delete(imageCache.keys().next().value);
  }
  return task;
}

// ---------- 工具 ----------
function toCssUrlValue(url) {
  const safe = String(url || '')
    .replace(/[\r\n]/g, '')
    .replace(/[\\"]/g, '\\$&');
  return `url("${safe}")`;
}

function setBgLayerUrl($layer, cssUrlValue) {
  $layer.each(function () {
    if (!this || !this.style) return;
    if (cssUrlValue) this.style.setProperty('--gal-bg-url', cssUrlValue);
    else this.style.removeProperty('--gal-bg-url');
  });
}

function reflow(el) {
  if (el) void el.offsetHeight;
}

// 无过渡地改变状态（提交新图 / 复位前景层时用，避免回弹动画）
function withoutTransition(elements, mutate) {
  const els = elements.filter(Boolean);
  els.forEach(el => el.style.setProperty('transition', 'none', 'important'));
  mutate();
  els.forEach(reflow);
  els.forEach(el => el.style.removeProperty('transition'));
}

function prefersReducedMotion() {
  try {
    return !!topWindow.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch (_) {
    return false;
  }
}

function getOverlayOf($bgLayer) {
  return $bgLayer.closest('#gal-global-overlay');
}

// 条带 / 溶解需要与背景层同样的铺图方式，「避开对话框」模式（伪元素分层）下回退叠化
function supportsLayeredTransition($bgLayer) {
  return !getOverlayOf($bgLayer).hasClass('gal-bg-avoid-dialog');
}

export function resolveBgTransitionType(requested, $bgLayer) {
  let type = String(requested || '').trim().toLowerCase();
  if (!type || type === 'auto' || type === 'default') {
    type = String(getSettings()?.bgTransitionStyle || 'cinematic').toLowerCase();
  }
  if (type === 'random') type = RANDOM_POOL[Math.floor(Math.random() * RANDOM_POOL.length)];
  if (!BG_TRANSITION_TYPES.includes(type)) type = 'cinematic';
  if (prefersReducedMotion()) return 'cinematic';
  if ((type === 'strips' || type === 'dissolve') && !supportsLayeredTransition($bgLayer)) return 'cinematic';
  return type;
}

// ---------- 层管理 ----------
export function ensureBackgroundLayers($bgLayer) {
  if (!$bgLayer || !$bgLayer.length) return { $base: $(), $front: $() };
  let $base = $bgLayer.find('.gal-bg-base');
  let $front = $bgLayer.find('.gal-bg-front');
  if (!$base.length) {
    $bgLayer.prepend('<div class="gal-bg-layer gal-bg-base"></div>');
    $base = $bgLayer.find('.gal-bg-base');
  }
  if (!$front.length) {
    $bgLayer.append('<div class="gal-bg-layer gal-bg-front"></div>');
    $front = $bgLayer.find('.gal-bg-front');
  }
  return { $base, $front };
}

function cleanupTransitionArtifacts($bgLayer) {
  $bgLayer.find('.gal-bg-strips, .gal-bg-dissolve').remove();
  $bgLayer.removeAttr('data-bg-tr');
}

// 把前景层的新图提交到底层，并无回弹地复位两层
function commitToBase($bgLayer, cssUrl) {
  const { $base, $front } = ensureBackgroundLayers($bgLayer);
  withoutTransition([$base[0], $front[0]], () => {
    setBgLayerUrl($base, cssUrl);
    setBgLayerUrl($front.removeClass('is-active'), '');
    $bgLayer.removeClass('bg-transitioning');
    cleanupTransitionArtifacts($bgLayer);
  });
}

export function clearBackgroundLayers($bgLayer) {
  const { $base, $front } = ensureBackgroundLayers($bgLayer);
  $bgLayer.data('bgTransitionToken', `clear_${Date.now()}`);
  $bgLayer.removeData('bgCurrentUrl');
  $bgLayer.removeData('bgPendingCommit');
  withoutTransition([$base[0], $front[0]], () => {
    $bgLayer.removeClass('bg-transitioning');
    cleanupTransitionArtifacts($bgLayer);
    setBgLayerUrl($base, '');
    setBgLayerUrl($front.removeClass('is-active'), '');
  });
  hideCurtain(getOverlayOf($bgLayer), true);
  forgetAmbientSource(getOverlayOf($bgLayer));
}

// ---------- 各类转场 ----------
async function runLayerTransition($bgLayer, type, cssUrl, isAlive) {
  const { $front } = ensureBackgroundLayers($bgLayer);
  const front = $front[0];
  // 起始态（类型属性 + 新图 + 光圈原点）无过渡一次设好，再加 is-active 播放
  withoutTransition([front], () => {
    $bgLayer.removeClass('bg-transitioning');
    $bgLayer.attr('data-bg-tr', type);
    $front.removeClass('is-active');
    setBgLayerUrl($front, cssUrl);
    if (type === 'iris') front.style.setProperty('--gal-iris-x', getIrisOrigin($bgLayer));
  });
  if (type === 'flash') stageFlash(getOverlayOf($bgLayer));
  $bgLayer.addClass('bg-transitioning');
  $front.addClass('is-active');
  await wait(TRANSITION_DURATION[type] || BG_TRANSITION_MS);
  return isAlive();
}

// 光圈从当前说话人一侧展开（无说话人则居中）
function getIrisOrigin($bgLayer) {
  const $speaker = getOverlayOf($bgLayer).find('.gal-char-container.speaking').first();
  const host = $bgLayer[0];
  if (!$speaker.length || !host) return '50%';
  const hostRect = host.getBoundingClientRect();
  const rect = $speaker[0].getBoundingClientRect();
  if (!hostRect.width) return '50%';
  const ratio = ((rect.left + rect.width / 2) - hostRect.left) / hostRect.width;
  return `${Math.round(Math.max(0.15, Math.min(0.85, ratio)) * 100)}%`;
}

async function runStripsTransition($bgLayer, cssUrl, isAlive) {
  const box = topDoc.createElement('div');
  box.className = 'gal-bg-strips';
  const slant = 3.5;
  for (let i = 0; i < STRIP_COUNT; i++) {
    const y0 = i === 0 ? -10 : (i / STRIP_COUNT) * 100;
    const y1 = i === STRIP_COUNT - 1 ? 110 : ((i + 1) / STRIP_COUNT) * 100 + 0.4;
    const strip = topDoc.createElement('div');
    strip.className = 'gal-bg-strip';
    strip.style.setProperty('--gal-bg-url', cssUrl);
    strip.style.setProperty('--gal-strip-from', `${i % 2 ? '' : '-'}115%`);
    strip.style.setProperty('--gal-strip-delay', `${i * 45}ms`);
    strip.style.clipPath = `polygon(-5% ${y0 + slant}%, 105% ${y0 - slant}%, 105% ${y1 - slant}%, -5% ${y1 + slant}%)`;
    box.appendChild(strip);
  }
  $bgLayer.attr('data-bg-tr', 'strips');
  $bgLayer[0].appendChild(box);
  reflow(box);
  box.classList.add('is-active');
  await wait(TRANSITION_DURATION.strips);
  return isAlive();
}

// 规则图：fbm 值噪声 + 横向渐变，墨迹从左向右洇开。低分辨率生成一次，放大时自然柔化
const RULE_W = 192;
const RULE_H = 108;
let ruleCache = null;
function getDissolveRule() {
  if (ruleCache) return ruleCache;
  const hash = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const rule = new Float32Array(RULE_W * RULE_H);
  for (let y = 0; y < RULE_H; y++) {
    for (let x = 0; x < RULE_W; x++) {
      let f = 0, amp = 0.5, freq = 1 / 24;
      for (let o = 0; o < 4; o++) {
        f += amp * noise(x * freq, y * freq);
        amp *= 0.5;
        freq *= 2;
      }
      rule[y * RULE_W + x] = 0.62 * f + 0.38 * (x / RULE_W);
    }
  }
  ruleCache = rule;
  return rule;
}

// 与 CSS background-size(cover/contain) + background-position 一致的绘制矩形
function computeFitRect(img, width, height, $bgLayer) {
  const style = topWindow.getComputedStyle($bgLayer.find('.gal-bg-base')[0] || $bgLayer[0]);
  const fit = String(style.getPropertyValue('--gal-bg-fit') || 'cover').trim();
  const pos = String(style.getPropertyValue('--gal-bg-pos') || 'center').trim();
  const scale = fit === 'contain'
    ? Math.min(width / img.naturalWidth, height / img.naturalHeight)
    : Math.max(width / img.naturalWidth, height / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  const y = pos.includes('top') ? 0 : (height - h) / 2;
  return { x: (width - w) / 2, y, w, h };
}

async function runDissolveTransition($bgLayer, img, cssUrl, isAlive) {
  const host = $bgLayer[0];
  const dpr = Math.min(1.5, topWindow.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(host.clientWidth * dpr));
  const height = Math.max(1, Math.round(host.clientHeight * dpr));
  const canvas = topDoc.createElement('canvas');
  canvas.className = 'gal-bg-dissolve';
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const mask = topDoc.createElement('canvas');
  const edge = topDoc.createElement('canvas');
  mask.width = edge.width = RULE_W;
  mask.height = edge.height = RULE_H;
  const mctx = mask.getContext('2d');
  const ectx = edge.getContext('2d');
  if (!ctx || !mctx || !ectx) return runLayerTransition($bgLayer, 'cinematic', cssUrl, isAlive);
  const maskData = mctx.createImageData(RULE_W, RULE_H);
  const edgeData = ectx.createImageData(RULE_W, RULE_H);
  const rule = getDissolveRule();
  const rect = computeFitRect(img, width, height, $bgLayer);
  const soft = 0.14;
  const duration = TRANSITION_DURATION.dissolve;

  $bgLayer.attr('data-bg-tr', 'dissolve');
  host.appendChild(canvas);
  const startedAt = topWindow.performance.now();
  while (true) {
    if (!isAlive()) return false;
    const p = Math.min(1, (topWindow.performance.now() - startedAt) / duration);
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    for (let i = 0; i < rule.length; i++) {
      const a = Math.max(0, Math.min(1, (e * (1 + soft) - rule[i]) / soft));
      maskData.data[i * 4 + 3] = a * 255;
      const rim = a * (1 - a) * 4;
      edgeData.data[i * 4] = 170;
      edgeData.data[i * 4 + 1] = 240;
      edgeData.data[i * 4 + 2] = 255;
      edgeData.data[i * 4 + 3] = rim * 190;
    }
    mctx.putImageData(maskData, 0, 0);
    ectx.putImageData(edgeData, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(edge, 0, 0, width, height);
    if (p >= 1) break;
    await nextFrame();
  }
  return isAlive();
}

// ---------- 黑场幕布（覆盖对话框，时间跳跃 / 换章） ----------
function ensureCurtain($overlay) {
  const $container = $overlay.find('.gal-game-container').first();
  if (!$container.length) return $();
  let $curtain = $container.children('.gal-stage-curtain');
  if (!$curtain.length) {
    $curtain = $(`
      <div class="gal-stage-curtain" aria-hidden="true">
        <div class="gal-stage-curtain-card">
          <div class="gal-stage-curtain-kicker"></div>
          <div class="gal-stage-curtain-title"></div>
          <div class="gal-stage-curtain-line"></div>
        </div>
      </div>`);
    $container.append($curtain);
  }
  return $curtain;
}

function hideCurtain($overlay, immediate = false) {
  const $curtain = $overlay.find('.gal-stage-curtain');
  if (!$curtain.length) return;
  if (immediate) {
    withoutTransition([$curtain[0]], () => $curtain.removeClass('is-active'));
  } else {
    $curtain.removeClass('is-active');
  }
}

async function runBlackTransition($bgLayer, cssUrl, options, isAlive) {
  const $overlay = getOverlayOf($bgLayer);
  const $curtain = ensureCurtain($overlay);
  if (!$curtain.length) return runLayerTransition($bgLayer, 'cinematic', cssUrl, isAlive);
  const title = String(options.scene || '').trim();
  const timeText = String($overlay.find('#gal-time-text').first().text() || '').trim();
  $curtain.find('.gal-stage-curtain-title').text(title);
  $curtain.find('.gal-stage-curtain-kicker').text(timeText && !/^(未知|--)/.test(timeText) ? timeText : 'SCENE');
  $curtain.toggleClass('has-title', !!title);
  reflow($curtain[0]);
  $curtain.addClass('is-active');
  await wait(650);
  if (!isAlive()) {
    hideCurtain($overlay);
    return false;
  }
  commitToBase($bgLayer, cssUrl);
  await wait(title ? 1100 : 450);
  hideCurtain($overlay);
  return isAlive();
}

// ---------- 入口 ----------
export function setBackgroundWithTransition($bgLayer, bgUrl, options = {}) {
  if (!$bgLayer || !$bgLayer.length) return Promise.resolve(false);
  ensureBackgroundLayers($bgLayer);
  // 流式渲染会反复触发同一背景：URL 未变时跳过，避免过渡动画反复重放导致闪烁
  if ($bgLayer.data('bgCurrentUrl') === bgUrl) return Promise.resolve(false);
  const hadImage = !!$bgLayer.data('bgCurrentUrl');
  $bgLayer.data('bgCurrentUrl', bgUrl);
  $bgLayer.find('.gal-gen-indicator').remove();

  // 上一段转场未完成：先把它的图无动画提交，再开始新的转场
  const pendingCommit = $bgLayer.data('bgPendingCommit');
  if (pendingCommit) {
    commitToBase($bgLayer, pendingCommit);
    hideCurtain(getOverlayOf($bgLayer), true);
  }

  const token = `${Date.now()}_${Math.random()}`;
  $bgLayer.data('bgTransitionToken', token);
  const isAlive = () => $bgLayer.data('bgTransitionToken') === token;
  const cssUrl = toCssUrlValue(bgUrl);

  return preloadBackgroundImage(bgUrl).then(async img => {
    if (!isAlive()) return false;
    if (img) updateAmbientLightFromImage(img, bgUrl, getOverlayOf($bgLayer));

    // 首张背景（从空白进入）没有可承接的旧图，黑场/溶解等无意义，统一叠化
    let type = hadImage ? resolveBgTransitionType(options.transition, $bgLayer) : (options.transition === 'flash' ? 'flash' : 'cinematic');
    if (type === 'dissolve' && !img) type = 'wipe';
    if (type === 'flash' && options.banner) showStageBanner(getOverlayOf($bgLayer), options.banner);

    $bgLayer.data('bgPendingCommit', cssUrl);
    let alive;
    try {
      if (type === 'black') alive = await runBlackTransition($bgLayer, cssUrl, options, isAlive);
      else if (type === 'strips') alive = await runStripsTransition($bgLayer, cssUrl, isAlive);
      else if (type === 'dissolve') alive = await runDissolveTransition($bgLayer, img, cssUrl, isAlive);
      else alive = await runLayerTransition($bgLayer, type, cssUrl, isAlive);
    } catch (error) {
      console.warn(`[${SCRIPT_NAME}] 背景转场异常，直接切换:`, error);
      alive = isAlive();
    }
    if (!alive) return false;
    $bgLayer.removeData('bgPendingCommit');
    commitToBase($bgLayer, cssUrl);
    return true;
  });
}

// 脚本卸载：作废进行中的转场（异步回调不再写 DOM），把未完成的转场无动画落定、收起黑场，
// 让热重载后的新实例接手时背景层处于干净状态（背景层 jQuery data 存在酒馆主页面的 jQuery 上，跨实例共享）
$(window).on('pagehide', () => {
  const $bgLayer = $('#gal-global-overlay .gal-layer-bg');
  if (!$bgLayer.length) return;
  $bgLayer.data('bgTransitionToken', `unload_${Date.now()}`);
  const pendingCommit = $bgLayer.data('bgPendingCommit');
  if (pendingCommit) commitToBase($bgLayer, pendingCommit);
  else cleanupTransitionArtifacts($bgLayer);
  $bgLayer.removeData('bgPendingCommit');
  hideCurtain(getOverlayOf($bgLayer), true);
});
