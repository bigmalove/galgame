import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow } from '../core/env.js';

const PIXI_CANDIDATE_URLS = Object.freeze([
  'https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js',
  'https://gcore.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js',
  'https://unpkg.com/pixi.js@6.5.10/dist/browser/pixi.min.js',
]);

let pixiLoadPromise = null;

function hasPixiRuntime() {
  return !!(topWindow?.PIXI?.Application && topWindow?.PIXI?.Graphics);
}

function loadScript(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('PIXI script url is empty'));
      return;
    }

    const doc = topWindow?.document || document;
    const script = doc.createElement('script');
    let finished = false;

    const cleanup = () => {
      script.onload = null;
      script.onerror = null;
    };

    const done = (ok, error = null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      cleanup();
      if (ok) {
        resolve(true);
      } else {
        reject(error || new Error(`PIXI script load failed: ${url}`));
      }
    };

    const timer = topWindow.setTimeout(() => {
      done(false, new Error(`PIXI script load timeout: ${url}`));
    }, timeoutMs);

    script.async = true;
    script.src = url;
    script.crossOrigin = 'anonymous';
    script.onload = () => done(true);
    script.onerror = () => done(false, new Error(`PIXI script load failed: ${url}`));

    doc.head.appendChild(script);
  });
}

export async function loadPixiLibrary() {
  if (hasPixiRuntime()) {
    return topWindow.PIXI;
  }
  if (pixiLoadPromise) {
    return pixiLoadPromise;
  }

  pixiLoadPromise = (async () => {
    let lastError = null;
    for (const url of PIXI_CANDIDATE_URLS) {
      try {
        await loadScript(url);
        if (hasPixiRuntime()) {
          console.log(`[${SCRIPT_NAME}] PIXI loaded from ${url}`);
          return topWindow.PIXI;
        }
      } catch (error) {
        lastError = error;
        console.warn(`[${SCRIPT_NAME}] PIXI load failed from ${url}`, error);
      }
    }
    throw lastError || new Error('PIXI unavailable');
  })()
    .catch((error) => {
      pixiLoadPromise = null;
      console.error(`[${SCRIPT_NAME}] PIXI load failed`, error);
      return null;
    });

  return pixiLoadPromise;
}

export function getPixiInstance() {
  return hasPixiRuntime() ? topWindow.PIXI : null;
}


// ---------- pixi-filters（辉光等高级滤镜，按需加载） ----------
// 4.x 为 Pixi v6 对应版本：浏览器包依赖全局 PIXI，并把滤镜合并进 PIXI.filters
const PIXI_FILTERS_CANDIDATE_URLS = Object.freeze([
  'https://cdn.jsdelivr.net/npm/pixi-filters@4.2.0/dist/pixi-filters.js',
  'https://gcore.jsdelivr.net/npm/pixi-filters@4.2.0/dist/pixi-filters.js',
  'https://unpkg.com/pixi-filters@4.2.0/dist/pixi-filters.js',
]);

let pixiFiltersLoadPromise = null;

function hasPixiFilters() {
  return !!topWindow?.PIXI?.filters?.AdvancedBloomFilter;
}

export async function loadPixiFilters() {
  if (hasPixiFilters()) return topWindow.PIXI.filters;
  if (pixiFiltersLoadPromise) return pixiFiltersLoadPromise;

  pixiFiltersLoadPromise = (async () => {
    const PIXI = await loadPixiLibrary();
    if (!PIXI) throw new Error('PIXI unavailable');
    let lastError = null;
    for (const url of PIXI_FILTERS_CANDIDATE_URLS) {
      try {
        await loadScript(url);
        if (hasPixiFilters()) {
          console.log(`[${SCRIPT_NAME}] pixi-filters loaded from ${url}`);
          return topWindow.PIXI.filters;
        }
      } catch (error) {
        lastError = error;
        console.warn(`[${SCRIPT_NAME}] pixi-filters load failed from ${url}`, error);
      }
    }
    throw lastError || new Error('pixi-filters unavailable');
  })().catch(error => {
    // 失败不缓存，下次挂载特效时再试；辉光缺席不影响粒子本身
    pixiFiltersLoadPromise = null;
    console.warn(`[${SCRIPT_NAME}] pixi-filters unavailable, bloom disabled`, error);
    return null;
  });

  return pixiFiltersLoadPromise;
}

export function getPixiFilters() {
  return hasPixiFilters() ? topWindow.PIXI.filters : null;
}
