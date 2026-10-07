import { SCRIPT_NAME } from '../core/constants.js';
import { $, topWindow } from '../core/env.js';
import { getSettings } from '../core/settings.js';
import { shakeStage } from '../stage/camera.js';
import { stageFlash } from '../stage/stage-fx.js';
import { getPixiFilters, getPixiInstance, loadPixiFilters, loadPixiLibrary } from './pixi-loader.js';
import { createPixiEffectInstance, getFixedEffectLayer, isSupportedPixiEffect } from './registry.js';

const QUALITY_PROFILES = Object.freeze({
  mobile: { density: 0.62, speed: 0.86, targetFps: 28 },
  balanced: { density: 1, speed: 1, targetFps: 42 },
  high: { density: 1.35, speed: 1.08, targetFps: 60 },
});

const DEFAULT_EFFECT_SETTINGS = Object.freeze({
  effectsEnabled: true,
  effectsQuality: 'balanced',
  effectsAutoClearOnSceneChange: true,
  effectsMaxActive: 2,
});

const EFFECT_LAYER_SELECTORS = Object.freeze({
  bg: '.gal-layer-effect-bg',
  fg: '.gal-layer-effect-fg',
});

const effectState = {
  mounted: false,
  bgHost: null,
  fgHost: null,
  bgApp: null,
  fgApp: null,
  activeEffects: new Map(),
  serial: 0,
  tickerBound: false,
  lastFlashAt: 0,
};

// 暂停原因（holdPixiEffects）：仍有原因未释放时不启动 ticker
const pauseHolds = new Set();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getEffectSettings() {
  const settings = getSettings() || {};
  const quality = QUALITY_PROFILES[settings.effectsQuality] ? settings.effectsQuality : DEFAULT_EFFECT_SETTINGS.effectsQuality;
  const parsedMax = Number.parseInt(settings.effectsMaxActive, 10);
  const effectsMaxActive = Number.isFinite(parsedMax)
    ? clamp(parsedMax, 1, 6)
    : DEFAULT_EFFECT_SETTINGS.effectsMaxActive;

  return {
    effectsEnabled: settings.effectsEnabled !== false,
    effectsQuality: quality,
    effectsAutoClearOnSceneChange: settings.effectsAutoClearOnSceneChange !== false,
    effectsMaxActive,
  };
}

function getQualityProfile(qualityName) {
  return QUALITY_PROFILES[qualityName] || QUALITY_PROFILES.balanced;
}

export async function preloadPixiEffectsRuntime() {
  if (getPixiInstance()) return true;
  const PIXI = await loadPixiLibrary();
  return !!PIXI;
}

function resolveOverlayElement(overlayLike = null) {
  if (overlayLike?.nodeType === 1) {
    return overlayLike;
  }
  if (overlayLike?.jquery && overlayLike.length > 0) {
    return overlayLike[0];
  }
  if (overlayLike?.length > 0 && overlayLike[0]?.nodeType === 1) {
    return overlayLike[0];
  }
  return topWindow.document.getElementById('gal-global-overlay');
}

function ensureEffectHosts(overlayEl) {
  const gameContainer = overlayEl.querySelector('.gal-game-container');
  const gameContent = overlayEl.querySelector('.gal-game-content');
  if (!gameContainer || !gameContent) {
    return { bgHost: null, fgHost: null };
  }

  let bgHost = gameContainer.querySelector(EFFECT_LAYER_SELECTORS.bg);
  if (!bgHost) {
    bgHost = topWindow.document.createElement('div');
    bgHost.className = 'gal-layer-effect-bg';
    gameContainer.insertBefore(bgHost, gameContent);
  }

  let fgHost = gameContent.querySelector(EFFECT_LAYER_SELECTORS.fg);
  if (!fgHost) {
    fgHost = topWindow.document.createElement('div');
    fgHost.className = 'gal-layer-effect-fg';
    const dialogLayer = gameContent.querySelector('.gal-dialog-layer');
    if (dialogLayer) {
      gameContent.insertBefore(fgHost, dialogLayer);
    } else {
      gameContent.appendChild(fgHost);
    }
  }

  return { bgHost, fgHost };
}

function createPixiApp(PIXI, host, targetFps) {
  const rect = host.getBoundingClientRect();
  const width = Math.max(2, Math.round(rect.width || host.clientWidth || 2));
  const height = Math.max(2, Math.round(rect.height || host.clientHeight || 2));
  const resolution = Math.min(2, topWindow.devicePixelRatio || 1);

  const app = new PIXI.Application({
    width,
    height,
    antialias: false,
    transparent: true,
    autoDensity: true,
    resolution,
    powerPreference: 'high-performance',
  });

  app.ticker.maxFPS = targetFps;
  app.renderer.backgroundAlpha = 0;
  app.stage.sortableChildren = true;
  app.view.classList.add('gal-pixi-effect-canvas');

  host.innerHTML = '';
  host.appendChild(app.view);

  return app;
}

function getAppByLayer(layer) {
  return layer === 'bg' ? effectState.bgApp : effectState.fgApp;
}

function removeEffectByKey(key) {
  const record = effectState.activeEffects.get(key);
  if (!record) return;

  try {
    const displayObject = record.instance?.displayObject;
    if (displayObject?.parent) {
      displayObject.parent.removeChild(displayObject);
    }
  } catch (error) {
    console.warn(`[${SCRIPT_NAME}] remove effect display object failed`, error);
  }

  try {
    record.instance?.destroy?.();
  } catch (error) {
    console.warn(`[${SCRIPT_NAME}] effect destroy failed`, error);
  }

  effectState.activeEffects.delete(key);
}

function prunePersistentEffects(maxActive) {
  const persistent = Array.from(effectState.activeEffects.values())
    .filter(record => record.instance?.persistent !== false)
    .sort((a, b) => a.order - b.order);

  while (persistent.length > maxActive) {
    const stale = persistent.shift();
    if (stale) {
      removeEffectByKey(stale.key);
    }
  }
}

// 布局尺寸用 CSS 像素（renderer.screen）。renderer.width/height 是乘过 devicePixelRatio 的画布像素，
// 开启 autoDensity 后舞台坐标仍是 CSS 像素，用它布局会让高分屏上粒子铺满 2 倍区域、大半落在画外
function getLayerSize(app) {
  const screen = app?.renderer?.screen;
  return {
    width: Math.max(2, Number(screen?.width) || 2),
    height: Math.max(2, Number(screen?.height) || 2),
  };
}

// ---------- 辉光（pixi-filters AdvancedBloomFilter） ----------
// 只给声明了 glow 参数的发光类特效（萤火虫 / 余烬 / 光斑 / 浮尘 / 雷电）挂滤镜；Mobile 档不启用。
// 滤镜分辨率固定为 1：模糊本就不需要高分屏全分辨率，开销约为 2x 分辨率的四分之一
function isBloomEnabled(settings = getSettings() || {}) {
  return settings.effectsBloom !== false && settings.effectsQuality !== 'mobile';
}

function applyBloom(record) {
  const instance = record?.instance;
  const displayObject = instance?.displayObject;
  if (!displayObject || !instance.glow) return;
  const filters = getPixiFilters();
  const app = getAppByLayer(record.layer);
  if (!isBloomEnabled() || !filters?.AdvancedBloomFilter) {
    if (displayObject.filters) displayObject.filters = null;
    displayObject.filterArea = null;
    return;
  }
  const balanced = (getSettings() || {}).effectsQuality !== 'high';
  const bloomKey = balanced ? 'balanced' : 'high';
  // 已按当前画质档挂好则跳过；画质档变化时按新参数重建
  if (displayObject.filters?.length && displayObject.__galBloomKey === bloomKey) return;
  const { threshold = 0.35, bloomScale = 1, blur = 6 } = instance.glow;
  try {
    const bloom = new filters.AdvancedBloomFilter({
      threshold,
      bloomScale,
      brightness: 1,
      blur: balanced ? blur * 0.8 : blur,
      quality: balanced ? 3 : 4,
      kernels: null,
      pixelSize: 1,
      resolution: 1,
    });
    displayObject.filters = [bloom];
    displayObject.__galBloomKey = bloomKey;
    // 全屏容器固定滤镜区域，省去每帧计算子节点包围盒
    if (app?.screen) displayObject.filterArea = app.screen;
  } catch (error) {
    console.warn(`[${SCRIPT_NAME}] bloom filter failed: ${record.name}`, error);
  }
}

function refreshBloomForActiveEffects() {
  for (const record of effectState.activeEffects.values()) applyBloom(record);
}

function ensureBloomRuntime() {
  if (!isBloomEnabled() || getPixiFilters()) return;
  loadPixiFilters().then(filters => {
    if (filters) refreshBloomForActiveEffects();
  });
}

// ---------- 落雷：舞台层闪光 + 近雷轻震（雷电特效经 onStrike 回调） ----------
function handleLightningStrike({ intensity = 0.8 } = {}) {
  const overlay = effectState.bgHost?.closest?.('#gal-global-overlay');
  if (!overlay) return;
  stageFlash($(overlay), { color: '#dfe8ff', variant: 'thunder' });
  if (intensity > 0.85) shakeStage({ power: 0.3, duration: 500 });
}

function bindTicker(layer, app) {
  app.ticker.add((delta) => {
    const size = getLayerSize(app);
    const garbage = [];

    for (const [key, record] of effectState.activeEffects.entries()) {
      if (record.layer !== layer) continue;
      try {
        record.instance?.update?.(delta, size);
      } catch (error) {
        console.warn(`[${SCRIPT_NAME}] effect update failed: ${record.name}`, error);
        garbage.push(key);
        continue;
      }

      if (record.instance?.done) {
        garbage.push(key);
      }
    }

    for (const key of garbage) {
      removeEffectByKey(key);
    }
  });
}

function attachTickersIfNeeded() {
  if (effectState.tickerBound) return;
  if (!effectState.bgApp || !effectState.fgApp) return;
  bindTicker('bg', effectState.bgApp);
  bindTicker('fg', effectState.fgApp);
  effectState.tickerBound = true;
}

function applySingleOp(op, settings, quality) {
  const action = String(op?.action || '').trim();
  if (!action) return;

  if (action === 'init') {
    clearAllPixiEffects();
    return;
  }
  if (action !== 'perform') return;

  const name = String(op?.name || '').trim();
  // screenShake 是镜头效果（stage/camera.js），由 overlay-content 在段落推进时直接触发
  if (name === 'screenShake') return;
  if (!isSupportedPixiEffect(name)) {
    console.warn(`[${SCRIPT_NAME}] unknown pixi effect "${name}"`);
    return;
  }

  const layer = getFixedEffectLayer(name);
  const app = getAppByLayer(layer);
  const PIXI = getPixiInstance();
  if (!app || !PIXI) return;

  if (name === 'screenFlash') {
    const now = Date.now();
    if (now - effectState.lastFlashAt < 120) return;
    effectState.lastFlashAt = now;
  }

  const key = name === 'screenFlash'
    ? `flash:${Date.now()}:${effectState.serial + 1}`
    : `${layer}:${name}`;

  if (name !== 'screenFlash' && effectState.activeEffects.has(key)) {
    return;
  }

  if (name !== 'screenFlash') {
    prunePersistentEffects(settings.effectsMaxActive - 1);
  }

  const { width, height } = getLayerSize(app);
  const instance = createPixiEffectInstance(name, { PIXI, width, height, quality, onStrike: handleLightningStrike });
  if (!instance?.displayObject) return;

  instance.displayObject.zIndex = name === 'screenFlash' ? 999 : 10;
  app.stage.addChild(instance.displayObject);

  effectState.serial += 1;
  const record = {
    key,
    layer,
    name,
    order: effectState.serial,
    instance,
  };
  effectState.activeEffects.set(key, record);
  applyBloom(record);
}

export async function mountPixiEffects(overlayLike = null) {
  const overlayEl = resolveOverlayElement(overlayLike);
  if (!overlayEl) return false;

  const { bgHost, fgHost } = ensureEffectHosts(overlayEl);
  if (!bgHost || !fgHost) return false;

  const settings = getEffectSettings();
  const quality = getQualityProfile(settings.effectsQuality);

  if (effectState.mounted && effectState.bgHost === bgHost && effectState.fgHost === fgHost) {
    return true;
  }

  const PIXI = getPixiInstance() || await loadPixiLibrary();
  if (!PIXI) return false;

  destroyPixiEffects();

  try {
    effectState.bgApp = createPixiApp(PIXI, bgHost, quality.targetFps);
    effectState.fgApp = createPixiApp(PIXI, fgHost, quality.targetFps);
    effectState.bgHost = bgHost;
    effectState.fgHost = fgHost;
    effectState.mounted = true;
    effectState.tickerBound = false;
    attachTickersIfNeeded();
    resizePixiEffects();
    syncPixiEffectsSettings();
    // Application 创建即自动启动 ticker
    if (pauseHolds.size) pausePixiEffects();
    ensureBloomRuntime();
    return true;
  } catch (error) {
    console.error(`[${SCRIPT_NAME}] mount pixi effects failed`, error);
    destroyPixiEffects();
    return false;
  }
}

export async function applyPixiEffectOps(ops = [], overlayLike = null) {
  const list = Array.isArray(ops) ? ops : [];
  if (list.length === 0) return true;

  const settings = getEffectSettings();
  if (!settings.effectsEnabled) {
    clearAllPixiEffects();
    return false;
  }

  const mounted = await mountPixiEffects(overlayLike);
  if (!mounted) return false;

  const quality = getQualityProfile(settings.effectsQuality);
  for (const op of list) {
    applySingleOp(op, settings, quality);
  }

  prunePersistentEffects(settings.effectsMaxActive);
  return true;
}

export function resizePixiEffects() {
  if (!effectState.mounted) return;

  const entries = [
    { app: effectState.bgApp, host: effectState.bgHost, layer: 'bg' },
    { app: effectState.fgApp, host: effectState.fgHost, layer: 'fg' },
  ];

  for (const entry of entries) {
    const { app, host, layer } = entry;
    if (!app || !host) continue;

    const rect = host.getBoundingClientRect();
    const width = Math.max(2, Math.round(rect.width || host.clientWidth || 2));
    const height = Math.max(2, Math.round(rect.height || host.clientHeight || 2));

    // 与 CSS 像素尺寸比较（renderer.width 含 devicePixelRatio，高分屏上永远不等）
    if (app.renderer.screen.width !== width || app.renderer.screen.height !== height) {
      app.renderer.resize(width, height);
    }

    for (const record of effectState.activeEffects.values()) {
      if (record.layer !== layer) continue;
      try {
        record.instance?.onResize?.(width, height);
      } catch (error) {
        console.warn(`[${SCRIPT_NAME}] effect resize failed: ${record.name}`, error);
      }
    }
  }
}

export function clearAllPixiEffects() {
  const keys = Array.from(effectState.activeEffects.keys());
  for (const key of keys) {
    removeEffectByKey(key);
  }
}

export function pausePixiEffects() {
  if (!effectState.mounted) return;
  effectState.bgApp?.ticker?.stop();
  effectState.fgApp?.ticker?.stop();
}

// 按原因暂停粒子动画（如选项浮层打开期间）
export function holdPixiEffects(reason, held) {
  if (held) {
    pauseHolds.add(reason);
    pausePixiEffects();
    return;
  }
  if (!pauseHolds.delete(reason) || pauseHolds.size) return;
  // overlay 已隐藏时保持暂停，等 showGlobalOverlay 再恢复
  if (topWindow.document.getElementById('gal-global-overlay')?.classList.contains('active')) resumePixiEffects();
}

export function resumePixiEffects() {
  if (!effectState.mounted || pauseHolds.size) return;
  const settings = getEffectSettings();
  if (!settings.effectsEnabled) return;
  effectState.bgApp?.ticker?.start();
  effectState.fgApp?.ticker?.start();
}

export function syncPixiEffectsSettings() {
  if (!effectState.mounted) return;

  const settings = getEffectSettings();
  const quality = getQualityProfile(settings.effectsQuality);

  if (effectState.bgApp?.ticker) {
    effectState.bgApp.ticker.maxFPS = quality.targetFps;
  }
  if (effectState.fgApp?.ticker) {
    effectState.fgApp.ticker.maxFPS = quality.targetFps;
  }

  prunePersistentEffects(settings.effectsMaxActive);
  ensureBloomRuntime();
  refreshBloomForActiveEffects();

  if (!settings.effectsEnabled) {
    clearAllPixiEffects();
    pausePixiEffects();
    return;
  }

  resumePixiEffects();
}

export function destroyPixiEffects() {
  clearAllPixiEffects();

  const apps = [effectState.bgApp, effectState.fgApp];
  for (const app of apps) {
    if (!app) continue;
    try {
      app.destroy(true, { children: true, texture: false, baseTexture: false });
    } catch (error) {
      console.warn(`[${SCRIPT_NAME}] destroy pixi app failed`, error);
    }
  }

  if (effectState.bgHost) {
    effectState.bgHost.innerHTML = '';
  }
  if (effectState.fgHost) {
    effectState.fgHost.innerHTML = '';
  }

  effectState.mounted = false;
  effectState.bgHost = null;
  effectState.fgHost = null;
  effectState.bgApp = null;
  effectState.fgApp = null;
  effectState.serial = 0;
  effectState.tickerBound = false;
  effectState.lastFlashAt = 0;
}
