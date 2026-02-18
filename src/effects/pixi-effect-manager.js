import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow } from '../core/env.js';
import { getSettings } from '../core/settings.js';
import { getPixiInstance, loadPixiLibrary } from './pixi-loader.js';
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

function getLayerSize(app) {
  return {
    width: Math.max(2, Number(app?.renderer?.width) || 2),
    height: Math.max(2, Number(app?.renderer?.height) || 2),
  };
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
  const instance = createPixiEffectInstance(name, { PIXI, width, height, quality });
  if (!instance?.displayObject) return;

  instance.displayObject.zIndex = name === 'screenFlash' ? 999 : 10;
  app.stage.addChild(instance.displayObject);

  effectState.serial += 1;
  effectState.activeEffects.set(key, {
    key,
    layer,
    name,
    order: effectState.serial,
    instance,
  });
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

    if (app.renderer.width !== width || app.renderer.height !== height) {
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

export function resumePixiEffects() {
  if (!effectState.mounted) return;
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
