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

