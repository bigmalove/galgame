import { SCRIPT_NAME } from '../core/constants.js';
import { $, topWindow } from '../core/env.js';
import { getSettings } from '../core/settings.js';

// ============================================
// 环境光：背景图采样 → 立绘染色 / 明暗 / 轮廓光
// ============================================
// 旧逻辑只在场景名含「夜/night/晚」时给角色层加夜间滤镜（sprite-manager applySceneTint），
// 「车站」「天文台」这类夜景匹配不上，白天光照的立绘像贴在夜景上。
// 这里在背景解码后把图缩到 32×18 采样：平均色（色相 → 染色）、平均亮度（→ 明暗/饱和）、
// 最亮 10% 像素的颜色与重心（→ 轮廓光颜色与方向），写入 overlay 的 CSS 变量与
// SVG feColorMatrix（真·乘法染色，保留 alpha，Live2D 画布同样生效）。
// 采样失败（跨域图未开 CORS）时移除 gal-ambient-on，回退旧的关键词滤镜。

const topDoc = topWindow.document;
const FILTER_SVG_ID = 'gal-ambient-filter-defs';
const FILTER_ID = 'gal-ambient-tint';
const TWEEN_MS = 900;
const SAMPLE_W = 32;
const SAMPLE_H = 18;

const NEUTRAL = { r: 1, g: 1, b: 1, bri: 1, sat: 1, rimA: 0, rimR: 255, rimG: 255, rimB: 255, rimX: 0 };
let current = { ...NEUTRAL };
let tweenId = 0;
let sampleSerial = 0;
let lastSource = null; // { img, url }：设置开关切换后重新采样当前背景

function isAmbientEnabled() {
  return getSettings()?.stageAmbientLight !== false;
}

function ensureFilterDefs() {
  let svg = topDoc.getElementById(FILTER_SVG_ID);
  if (svg) return svg.querySelector('feColorMatrix');
  svg = topDoc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('id', FILTER_SVG_ID);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
  svg.innerHTML = `<filter id="${FILTER_ID}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"/></filter>`;
  (topDoc.body || topDoc.documentElement).appendChild(svg);
  return svg.querySelector('feColorMatrix');
}

// ---------- 采样 ----------
function sampleImagePixels(img) {
  const canvas = topDoc.createElement('canvas');
  canvas.width = SAMPLE_W;
  canvas.height = SAMPLE_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, SAMPLE_W, SAMPLE_H);
  const data = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data; // 跨域污染时抛 SecurityError
  const pixels = [];
  let sumR = 0, sumG = 0, sumB = 0, sumL = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    sumR += r; sumG += g; sumB += b; sumL += l;
    const idx = i / 4;
    pixels.push({ r, g, b, l, x: (idx % SAMPLE_W) / (SAMPLE_W - 1), y: Math.floor(idx / SAMPLE_W) / (SAMPLE_H - 1) });
  }
  const n = pixels.length;
  pixels.sort((a, b) => b.l - a.l);
  const top = pixels.slice(0, Math.max(1, Math.floor(n * 0.1)));
  let tr = 0, tg = 0, tb = 0, tl = 0, tx = 0, ty = 0;
  for (const p of top) { tr += p.r; tg += p.g; tb += p.b; tl += p.l; tx += p.x; ty += p.y; }
  const m = top.length;
  return {
    avg: [sumR / n, sumG / n, sumB / n],
    lum: sumL / n,
    hi: [tr / m, tg / m, tb / m],
    hiLum: tl / m,
    hx: tx / m,
    hy: ty / m,
  };
}

// 不支持 CORS 的图源：失败一次后本会话不再重试，避免每次换背景都在控制台刷跨域报错
const noCorsOrigins = new Set();

function getOrigin(url) {
  try {
    return new URL(url, topWindow.location.href).origin;
  } catch (_) {
    return '';
  }
}

function loadCorsImage(url) {
  return new Promise(resolve => {
    const img = new topWindow.Image();
    img.crossOrigin = 'anonymous';
    const timer = topWindow.setTimeout(() => resolve(null), 5000);
    img.onload = () => { topWindow.clearTimeout(timer); resolve(img); };
    img.onerror = () => { topWindow.clearTimeout(timer); resolve(null); };
    img.src = url;
  });
}

async function sampleBackground(img, url) {
  try {
    return sampleImagePixels(img);
  } catch (_) {
    // 跨域且未带 CORS 的加载会污染画布：http(s) 图片再以 CORS 模式取一次（jsDelivr 等 CDN 均支持）
    if (!/^https?:/i.test(String(url || ''))) return null;
    const origin = getOrigin(url);
    if (!origin || noCorsOrigins.has(origin)) return null;
    const corsImg = await loadCorsImage(url);
    if (!corsImg) {
      noCorsOrigins.add(origin);
      return null;
    }
    try {
      return sampleImagePixels(corsImg);
    } catch (_) {
      return null;
    }
  }
}

// ---------- 光照推算 ----------
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [r + m, g + m, b + m];
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export function computeAmbientLighting(stats) {
  // 染色：保留平均色色相并放大饱和度（直接归一化平均色会退化成近白色，乘法无效）
  const [h, s] = rgbToHsl(...stats.avg);
  const dark = stats.lum < 0.32;
  const tint = hslToRgb(h, Math.min(0.6, s * 2.4), dark ? 0.8 : 0.9);
  const k = dark ? 0.95 : 0.7;
  const hiMax = Math.max(...stats.hi, 1);
  const rim = stats.hi.map(v => clamp((v / hiMax) * 255 * 1.05 + 20, 0, 255));
  const rimX = Math.abs(stats.hx - 0.5) < 0.12 ? 0 : (stats.hx < 0.5 ? -1 : 1);
  return {
    r: 1 - k + k * tint[0],
    g: 1 - k + k * tint[1],
    b: 1 - k + k * tint[2],
    bri: clamp(0.5 + stats.lum * 0.95, 0.66, 1.04),
    sat: clamp(0.7 + stats.lum * 0.55, 0.74, 1.02),
    // 轮廓光强度：高光与平均亮度反差越大（夜景灯光、逆光）越明显
    rimA: clamp(0.2 + (stats.hiLum - stats.lum) * 1.1, 0.2, 0.8) * 0.55,
    rimR: rim[0],
    rimG: rim[1],
    rimB: rim[2],
    rimX,
  };
}

// ---------- 应用 ----------
function applyLighting($overlay, state) {
  const el = $overlay?.[0];
  if (!el) return;
  const matrix = ensureFilterDefs();
  if (matrix) {
    matrix.setAttribute('values', `${state.r.toFixed(4)} 0 0 0 0 0 ${state.g.toFixed(4)} 0 0 0 0 0 ${state.b.toFixed(4)} 0 0 0 0 0 1 0`);
  }
  el.style.setProperty('--gal-amb-bri', state.bri.toFixed(4));
  el.style.setProperty('--gal-amb-sat', state.sat.toFixed(4));
  el.style.setProperty('--gal-rim-color', `rgba(${Math.round(state.rimR)}, ${Math.round(state.rimG)}, ${Math.round(state.rimB)}, ${state.rimA.toFixed(3)})`);
  el.style.setProperty('--gal-rim-x', `${(state.rimX * 0.25).toFixed(3)}rem`);
}

function tweenTo($overlay, target, onDone) {
  // Mobile 画质档去掉轮廓光的 drop-shadow（整层滤镜随 Live2D 每帧重绘，低端机开销明显）
  $overlay.toggleClass('gal-ambient-lite', getSettings()?.effectsQuality === 'mobile');
  const id = ++tweenId;
  const from = { ...current };
  const startedAt = topWindow.performance.now();
  const step = now => {
    if (id !== tweenId) return;
    const p = Math.min(1, (now - startedAt) / TWEEN_MS);
    const e = 1 - Math.pow(1 - p, 3);
    const state = {};
    for (const key of Object.keys(NEUTRAL)) state[key] = from[key] + (target[key] - from[key]) * e;
    current = state;
    applyLighting($overlay, state);
    if (p < 1) topWindow.requestAnimationFrame(step);
    else if (onDone) onDone();
  };
  topWindow.requestAnimationFrame(step);
}

// 设置项变更后调用：关闭则复位，开启则对当前背景重新采样
export function refreshAmbientLight($overlay) {
  if (!$overlay || !$overlay.length) return;
  if (!isAmbientEnabled() || !lastSource) {
    resetAmbientLight($overlay, { immediate: true });
    return;
  }
  updateAmbientLightFromImage(lastSource.img, lastSource.url, $overlay);
}

export function forgetAmbientSource($overlay) {
  lastSource = null;
  resetAmbientLight($overlay);
}

export function resetAmbientLight($overlay, { immediate = false } = {}) {
  if (!$overlay || !$overlay.length) return;
  sampleSerial++;
  if (immediate) {
    tweenId++;
    current = { ...NEUTRAL };
    applyLighting($overlay, current);
    $overlay.removeClass('gal-ambient-on');
    return;
  }
  tweenTo($overlay, NEUTRAL, () => $overlay.removeClass('gal-ambient-on'));
}

export async function updateAmbientLightFromImage(img, url, $overlay) {
  if (!$overlay || !$overlay.length) return;
  lastSource = img ? { img, url } : null;
  if (!isAmbientEnabled()) {
    resetAmbientLight($overlay, { immediate: true });
    return;
  }
  const serial = ++sampleSerial;
  let stats = null;
  try {
    stats = await sampleBackground(img, url);
  } catch (error) {
    console.warn(`[${SCRIPT_NAME}] 环境光采样失败:`, error);
  }
  if (serial !== sampleSerial) return;
  if (!stats) {
    // 无法采样：交还给旧的场景名关键词滤镜
    resetAmbientLight($overlay, { immediate: true });
    return;
  }
  $overlay.addClass('gal-ambient-on');
  tweenTo($overlay, computeAmbientLighting(stats));
}

// 脚本卸载：停掉进行中的渐变，移除注入到酒馆主页面的 SVG 滤镜定义与 overlay 上的环境光状态
$(window).on('pagehide', () => {
  tweenId++;
  sampleSerial++;
  lastSource = null;
  topDoc.getElementById(FILTER_SVG_ID)?.remove();
  const overlay = topDoc.getElementById('gal-global-overlay');
  if (overlay) {
    overlay.classList.remove('gal-ambient-on', 'gal-ambient-lite');
    ['--gal-amb-bri', '--gal-amb-sat', '--gal-rim-color', '--gal-rim-x'].forEach(name => overlay.style.removeProperty(name));
  }
});
