import { SCRIPT_NAME, DB_NAME, DB_VERSION, STORE_SDK_CACHE } from '../core/constants.js';

// ============================================
// Live2D SDK 缓存加载器
// ============================================
export const Live2DLoader = {
  PIXI_URL: 'https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js',
  CUBISM4_CORE_URL: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
  CUBISM2_CORE_URL: 'https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js',
  SDK_URL: 'https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/index.min.js',
  SDK_CACHE_KEY: 'live2d_sdk_v3',

  isLoaded: false,
  loadPromise: null,

  async load() {
    if (this.isLoaded) return true;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this._doLoad();
    return this.loadPromise;
  },

  async _doLoad() {
    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;

    try {
      if (_topWindow.PIXI?.live2d?.Live2DModel) {
        console.log(`[${SCRIPT_NAME}] Live2D SDK 已存在`);
        this.isLoaded = true;
        return true;
      }

      if (!_topWindow.PIXI) {
        console.log(`[${SCRIPT_NAME}] 加载 PIXI.js...`);
        const pixiText = await fetch(this.PIXI_URL).then(r => {
          if (!r.ok) throw new Error(`PIXI.js 加载失败: ${r.status}`);
          return r.text();
        });
        await this._executeScript(pixiText, _topWindow);
        console.log(`[${SCRIPT_NAME}] PIXI.js 加载完成`);
      }

      if (!_topWindow.window.PIXI) {
        _topWindow.window.PIXI = _topWindow.PIXI;
      }

      if (!_topWindow.Live2DCubismCore) {
        console.log(`[${SCRIPT_NAME}] 加载 Cubism 4 Core...`);
        try {
          const coreText = await fetch(this.CUBISM4_CORE_URL).then(r => {
            if (!r.ok) throw new Error(`Cubism 4 Core 加载失败: ${r.status}`);
            return r.text();
          });
          await this._executeScript(coreText, _topWindow);
          console.log(`[${SCRIPT_NAME}] Cubism 4 Core 加载完成`);
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] Cubism 4 Core 加载失败，尝试备用源...`, e);
        }
      }

      if (!_topWindow.Live2D) {
        console.log(`[${SCRIPT_NAME}] 加载 Cubism 2.1 Core...`);
        try {
          const core2Text = await fetch(this.CUBISM2_CORE_URL).then(r => {
            if (!r.ok) throw new Error(`Cubism 2.1 Core 加载失败: ${r.status}`);
            return r.text();
          });
          await this._executeScript(core2Text, _topWindow);
          console.log(`[${SCRIPT_NAME}] Cubism 2.1 Core 加载完成`);
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] Cubism 2.1 Core 加载失败（旧模型可能不可用）:`, e);
        }
      }

      const cached = await this._getFromCache();
      if (cached && cached.sdk) {
        console.log(`[${SCRIPT_NAME}] 从缓存加载 pixi-live2d-display`);
        await this._executeScript(cached.sdk, _topWindow);
      } else {
        console.log(`[${SCRIPT_NAME}] 从 CDN 加载 pixi-live2d-display...`);
        const sdkText = await fetch(this.SDK_URL).then(r => {
          if (!r.ok) throw new Error(`pixi-live2d-display 加载失败: ${r.status}`);
          return r.text();
        });
        await this._saveToCache({ sdk: sdkText });
        await this._executeScript(sdkText, _topWindow);
      }

      await new Promise(r => setTimeout(r, 100));

      this.isLoaded = true;
      console.log(`[${SCRIPT_NAME}] Live2D SDK 加载完成`);
      return true;
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] Live2D SDK 加载失败:`, e);
      this.loadPromise = null;
      return false;
    }
  },

  _executeScript(code, targetWindow) {
    return new Promise((resolve, reject) => {
      try {
        const script = targetWindow.document.createElement('script');
        script.textContent = code;
        targetWindow.document.head.appendChild(script);
        setTimeout(resolve, 10);
      } catch (e) {
        reject(e);
      }
    });
  },

  async _getFromCache() {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onsuccess = (e) => {
          const database = e.target.result;
          if (!database.objectStoreNames.contains(STORE_SDK_CACHE)) {
            database.close();
            resolve(null);
            return;
          }
          const tx = database.transaction(STORE_SDK_CACHE, 'readonly');
          const store = tx.objectStore(STORE_SDK_CACHE);
          const get = store.get(this.SDK_CACHE_KEY);
          get.onsuccess = () => {
            database.close();
            resolve(get.result?.data || null);
          };
          get.onerror = () => {
            database.close();
            resolve(null);
          };
        };
        request.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  },

  async _saveToCache(data) {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onsuccess = (e) => {
          const database = e.target.result;
          if (!database.objectStoreNames.contains(STORE_SDK_CACHE)) {
            database.close();
            resolve();
            return;
          }
          const tx = database.transaction(STORE_SDK_CACHE, 'readwrite');
          const store = tx.objectStore(STORE_SDK_CACHE);
          store.put({ id: this.SDK_CACHE_KEY, data, timestamp: Date.now() });
          tx.oncomplete = () => {
            database.close();
            console.log(`[${SCRIPT_NAME}] Live2D SDK 已缓存到 IndexedDB`);
            resolve();
          };
          tx.onerror = () => {
            database.close();
            resolve();
          };
        };
        request.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  },

  async clearCache() {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onsuccess = (e) => {
          const database = e.target.result;
          if (!database.objectStoreNames.contains(STORE_SDK_CACHE)) {
            database.close();
            resolve();
            return;
          }
          const tx = database.transaction(STORE_SDK_CACHE, 'readwrite');
          const store = tx.objectStore(STORE_SDK_CACHE);
          store.delete(this.SDK_CACHE_KEY);
          tx.oncomplete = () => {
            database.close();
            this.isLoaded = false;
            this.loadPromise = null;
            console.log(`[${SCRIPT_NAME}] Live2D SDK 缓存已清除`);
            resolve();
          };
        };
        request.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  }
};
