import { SCRIPT_ID, SCRIPT_NAME } from '../core/constants.js';

// ============================================
// Live2D 娓叉煋妯″紡鍒囨崲鍣?
// ============================================
export const CHAR_USE_LIVE2D_KEY = `${SCRIPT_ID}_char_use_live2d`;
export const LIVE2D_CONFIG_KEY = `${SCRIPT_ID}_live2d_config`;

function normalizeCharacterIdKey(characterId) {
  return String(characterId || '').trim().toLowerCase();
}

export function normalizeLive2DScaleBase(scaleBase) {
  return scaleBase === 'fit' ? 'fit' : 'height';
}

export function calculateLive2DBaseScale(rectWidth, rectHeight, boundsWidth, boundsHeight, safePadding = 0.03, scaleBase = 'fit') {
  const safeRectWidth = Math.max(1, Number(rectWidth) || 0);
  const safeRectHeight = Math.max(1, Number(rectHeight) || 0);
  const safeBoundsWidth = Math.max(1, Number(boundsWidth) || 0);
  const safeBoundsHeight = Math.max(1, Number(boundsHeight) || 0);
  const resolvedScaleBase = normalizeLive2DScaleBase(scaleBase);
  const safePaddingRatio = Math.min(0.2, Math.max(0, Number(safePadding) || 0));

  const widthRatio = safeRectWidth / safeBoundsWidth;
  const heightRatio = safeRectHeight / safeBoundsHeight;
  const fitScale = resolvedScaleBase === 'height'
    ? heightRatio
    : Math.min(widthRatio, heightRatio);
  const baseScale = fitScale * (1 - safePaddingRatio);
  return Number.isFinite(baseScale) && baseScale > 0 ? baseScale : 1;
}

export function getOverlayReferenceHeight(element, fallbackHeight = 0) {
  const safeFallbackHeight = Math.max(1, Number(fallbackHeight) || 1);
  if (!element || typeof element.closest !== 'function') {
    return safeFallbackHeight;
  }
  const overlayEl = element.closest('#gal-global-overlay');
  if (!overlayEl) {
    return safeFallbackHeight;
  }
  const overlayHeight = Math.max(
    1,
    Math.floor(Number(overlayEl.clientHeight) || Number(overlayEl.offsetHeight) || 0),
  );
  return Number.isFinite(overlayHeight) && overlayHeight > 0 ? overlayHeight : safeFallbackHeight;
}

export function getDefaultLive2DConfig() {
  return {
    transform: {
      offsetX: 0,
      offsetY: 0,
      scale: 1.0,
      scaleBase: 'height',
    },
    quality: {
      textureResolution: 1.0,
      devicePixelRatio: 'auto'
    },
    expressionMapping: {},
    motionMapping: {}
  };
}

export function getLive2DConfig(characterId) {
  try {
    const allConfigs = JSON.parse(localStorage.getItem(LIVE2D_CONFIG_KEY) || '{}');
    const charConfig = allConfigs[characterId];
    if (!charConfig) {
      return getDefaultLive2DConfig();
    }
    const defaultConfig = getDefaultLive2DConfig();
    return {
      transform: { ...defaultConfig.transform, ...charConfig.transform },
      quality: { ...defaultConfig.quality, ...charConfig.quality },
      expressionMapping: charConfig.expressionMapping || {},
      motionMapping: charConfig.motionMapping || {}
    };
  } catch (e) {
    console.error(`[${SCRIPT_NAME}] 璇诲彇 Live2D 閰嶇疆澶辫触:`, e);
    return getDefaultLive2DConfig();
  }
}

export function setLive2DConfig(characterId, config) {
  try {
    const allConfigs = JSON.parse(localStorage.getItem(LIVE2D_CONFIG_KEY) || '{}');
    allConfigs[characterId] = config;
    localStorage.setItem(LIVE2D_CONFIG_KEY, JSON.stringify(allConfigs));
    console.log(`[${SCRIPT_NAME}] 宸蹭繚瀛樿鑹?${characterId} 鐨?Live2D 閰嶇疆`);
  } catch (e) {
    console.error(`[${SCRIPT_NAME}] 淇濆瓨 Live2D 閰嶇疆澶辫触:`, e);
  }
}

export function updateLive2DConfig(characterId, partialConfig) {
  const currentConfig = getLive2DConfig(characterId);
  const newConfig = {
    ...currentConfig,
    ...partialConfig,
    transform: { ...currentConfig.transform, ...(partialConfig.transform || {}) },
    quality: { ...currentConfig.quality, ...(partialConfig.quality || {}) },
    expressionMapping: partialConfig.expressionMapping !== undefined
      ? partialConfig.expressionMapping
      : currentConfig.expressionMapping,
    motionMapping: partialConfig.motionMapping !== undefined
      ? partialConfig.motionMapping
      : currentConfig.motionMapping
  };
  setLive2DConfig(characterId, newConfig);
  return newConfig;
}

export function deleteLive2DConfig(characterId) {
  try {
    const allConfigs = JSON.parse(localStorage.getItem(LIVE2D_CONFIG_KEY) || '{}');
    delete allConfigs[characterId];
    localStorage.setItem(LIVE2D_CONFIG_KEY, JSON.stringify(allConfigs));
  } catch (e) {
    console.error(`[${SCRIPT_NAME}] 鍒犻櫎 Live2D 閰嶇疆澶辫触:`, e);
  }
}

export function getCharacterUseLive2D(characterId) {
  try {
    const settings = JSON.parse(localStorage.getItem(CHAR_USE_LIVE2D_KEY) || '{}');
    const rawKey = String(characterId ?? '');
    if (Object.prototype.hasOwnProperty.call(settings, rawKey)) {
      return !!settings[rawKey];
    }

    const normalizedTarget = normalizeCharacterIdKey(characterId);
    if (!normalizedTarget) return false;

    for (const [key, value] of Object.entries(settings)) {
      if (normalizeCharacterIdKey(key) === normalizedTarget) {
        return !!value;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function setCharacterUseLive2D(characterId, useLive2D) {
  try {
    const settings = JSON.parse(localStorage.getItem(CHAR_USE_LIVE2D_KEY) || '{}');
    const rawKey = String(characterId ?? '');
    const normalizedKey = normalizeCharacterIdKey(characterId);
    settings[rawKey] = !!useLive2D;
    if (normalizedKey && normalizedKey !== rawKey) {
      settings[normalizedKey] = !!useLive2D;
    }
    localStorage.setItem(CHAR_USE_LIVE2D_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error(`[${SCRIPT_NAME}] 淇濆瓨 Live2D 璁剧疆澶辫触:`, e);
  }
}
// 鍏煎鍒悕
export const saveLive2DConfig = setLive2DConfig;

