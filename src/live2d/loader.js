import { SCRIPT_NAME, DB_NAME, DB_VERSION, STORE_SDK_CACHE } from '../core/constants.js';

// ============================================
// Live2D SDK 缂撳瓨鍔犺浇鍣?
// ============================================
export const Live2DLoader = {
  PIXI_URL: 'https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js',
  CUBISM4_CORE_URL: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
  CUBISM5_CORE_URL: '',
  CUBISM5_CORE_FILES: Object.freeze(['cubism5.min.js', 'live2dcubismcore.min.js']),
  CUBISM2_CORE_URL: 'https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js',
  SDK_URL: 'https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/index.min.js',
  CUBISM5_RUNTIME_URL: '',
  CUBISM5_RUNTIME_FILES: Object.freeze(['cubism5.runtime.min.js', 'cubism5.js']),
  SDK_CACHE_KEY: 'live2d_sdk_v3',

  isLoaded: false,
  loadPromise: null,
  cubism5CoreLoaded: false,
  cubism5CorePromise: null,
  cubism5CoreSource: null,
  cubism5RuntimeLoaded: false,
  cubism5RuntimePromise: null,
  cubism5RuntimeSource: null,
  legacyLive2DNamespace: null,
  cubism5Live2DNamespace: null,

  async load() {
    if (this.isLoaded) return true;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this._doLoad();
    return this.loadPromise;
  },

  _getLatestMocVersion(_topWindow) {
    try {
      return Number(_topWindow?.Live2DCubismCore?.Version?.csmGetLatestMocVersion?.() || 0) || 0;
    } catch (e) {
      return 0;
    }
  },

  async _waitForLatestMocVersion(_topWindow, expectedMajor = 5, timeoutMs = 4000, intervalMs = 50) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const latestVersion = this._getLatestMocVersion(_topWindow);
      if (latestVersion >= expectedMajor) return latestVersion;
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return this._getLatestMocVersion(_topWindow);
  },

  async ensureCubism5Core() {
    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;

    const latestVersion = this._getLatestMocVersion(_topWindow);
    if (latestVersion >= 5) {
      this.cubism5CoreLoaded = true;
      return true;
    }
    if (this.cubism5CorePromise) return this.cubism5CorePromise;

    this.cubism5CorePromise = (async () => {
      const coreUrls = this._getCubism5CoreUrls(_topWindow);
      if (!coreUrls.length) {
        console.error(`[${SCRIPT_NAME}] Cubism 5 Core load failed: no core URL candidates`);
        this.cubism5CorePromise = null;
        return false;
      }

      let lastError = null;
      try {
        for (const coreUrl of coreUrls) {
          try {
            const coreText = await fetch(coreUrl).then(r => {
              if (!r.ok) throw new Error(`Cubism 5 Core load failed: ${r.status}`);
              return r.text();
            });
            await this._executeScript(coreText, _topWindow);

            const loadedVersion = await this._waitForLatestMocVersion(_topWindow, 5, 5000, 80);
            if (loadedVersion >= 5) {
              this.cubism5CoreLoaded = true;
              this.cubism5CoreSource = coreUrl;
              console.log(`[${SCRIPT_NAME}] Cubism 5 Core loaded from ${coreUrl}`);
              return true;
            }

            throw new Error(`latest moc version check failed: ${loadedVersion}`);
          } catch (candidateError) {
            lastError = candidateError;
            console.warn(`[${SCRIPT_NAME}] Cubism 5 Core candidate failed: ${coreUrl}`, candidateError);
          }
        }

        this.cubism5CoreLoaded = false;
        this.cubism5CoreSource = null;
        console.error(`[${SCRIPT_NAME}] Cubism 5 Core load failed: all candidates failed`, {
          candidates: coreUrls,
          lastError: String(lastError?.message || lastError || ''),
        });
        return false;
      } finally {
        this.cubism5CorePromise = null;
      }
    })();

    return this.cubism5CorePromise;
  },

  _normalizeRuntimeUrl(url) {
    if (typeof url !== 'string') return '';
    return url.trim();
  },

  _resolvePluginScriptBaseUrls(_topWindow) {
    const doc = _topWindow?.document;
    if (!doc) return [];

    const baseUrls = [];
    const seen = new Set();
    const scripts = Array.from(doc.querySelectorAll('script[src]'));

    const isPluginScript = (src) => {
      if (!src) return false;
      let decoded = src;
      try {
        decoded = decodeURIComponent(src);
      } catch (e) {}
      return /数据库界面插件\.dist\.js|galgame.*\.dist\.js|galgame-ui-plugin/i.test(decoded);
    };

    for (const script of scripts) {
      const src = this._normalizeRuntimeUrl(script?.src || script?.getAttribute?.('src'));
      if (!src || !isPluginScript(src)) continue;

      try {
        const absoluteUrl = new URL(src, _topWindow.location?.href || window.location.href).toString();
        const baseUrl = new URL('.', absoluteUrl).toString();
        if (seen.has(baseUrl)) continue;
        seen.add(baseUrl);
        baseUrls.push(baseUrl);
      } catch (e) {}
    }

    return baseUrls;
  },

  _getCubism5RuntimeUrls(_topWindow) {
    const urls = [];
    const seen = new Set();
    const pushUrl = (value) => {
      const normalized = this._normalizeRuntimeUrl(value);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      urls.push(normalized);
    };

    pushUrl(this.CUBISM5_RUNTIME_URL);

    const baseUrls = this._resolvePluginScriptBaseUrls(_topWindow);
    for (const baseUrl of baseUrls) {
      for (const fileName of this.CUBISM5_RUNTIME_FILES) {
        try {
          pushUrl(new URL(fileName, baseUrl).toString());
        } catch (e) {}
      }
    }

    return urls;
  },

  _getCubism5CoreUrls(_topWindow) {
    const urls = [];
    const seen = new Set();
    const pushUrl = (value) => {
      const normalized = this._normalizeRuntimeUrl(value);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      urls.push(normalized);
    };

    pushUrl(this.CUBISM5_CORE_URL);

    const baseUrls = this._resolvePluginScriptBaseUrls(_topWindow);
    for (const baseUrl of baseUrls) {
      for (const fileName of this.CUBISM5_CORE_FILES) {
        try {
          pushUrl(new URL(fileName, baseUrl).toString());
        } catch (e) {}
      }
    }

    return urls;
  },

  async ensureCubism5Runtime() {
    if (this.cubism5RuntimeLoaded && this.cubism5Live2DNamespace?.Live2DModel) {
      return true;
    }
    if (this.cubism5RuntimePromise) return this.cubism5RuntimePromise;

    this.cubism5RuntimePromise = (async () => {
      const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;

      if (!this.isLoaded) {
        const loaded = await this.load();
        if (!loaded) return false;
      }

      const coreReady = await this.ensureCubism5Core();
      if (!coreReady) {
        console.error(`[${SCRIPT_NAME}] Cubism 5 runtime load aborted: core unavailable`);
        return false;
      }

      try {
        const runtimeUrls = this._getCubism5RuntimeUrls(_topWindow);
        if (!runtimeUrls.length) {
          console.error(`[${SCRIPT_NAME}] Cubism 5 runtime load failed: no runtime URL candidates`);
          return false;
        }

        let lastError = null;
        for (const runtimeUrl of runtimeUrls) {
          try {
            const runtimeText = await fetch(runtimeUrl).then(r => {
              if (!r.ok) throw new Error(`Cubism 5 runtime load failed: ${r.status}`);
              return r.text();
            });
            await this._executeScript(runtimeText, _topWindow);
            await new Promise(r => setTimeout(r, 100));

            const runtimeNamespace = _topWindow?.PIXI?.live2d;
            if (!runtimeNamespace?.Live2DModel) {
              throw new Error('Live2DModel is unavailable after Cubism 5 runtime script execution');
            }

            this.cubism5Live2DNamespace = runtimeNamespace;
            this.cubism5RuntimeLoaded = true;
            this.cubism5RuntimeSource = runtimeUrl;

            if (this.legacyLive2DNamespace?.Live2DModel) {
              _topWindow.PIXI.live2d = this.legacyLive2DNamespace;
            }
            console.log(`[${SCRIPT_NAME}] Cubism 5 runtime loaded from ${runtimeUrl}`);
            return true;
          } catch (candidateError) {
            lastError = candidateError;
            console.warn(`[${SCRIPT_NAME}] Cubism 5 runtime candidate failed: ${runtimeUrl}`, candidateError);
          }
        }

        console.error(`[${SCRIPT_NAME}] Cubism 5 runtime load failed: all candidates failed`, {
          candidates: runtimeUrls,
          lastError: String(lastError?.message || lastError || ''),
        });
        return false;
      } catch (e) {
        console.error(`[${SCRIPT_NAME}] Cubism 5 runtime load failed:`, e);
        return false;
      } finally {
        this.cubism5RuntimePromise = null;
      }
    })();

    return this.cubism5RuntimePromise;
  },

  getRuntimeNamespace(runtimeType = 'legacy') {
    if (runtimeType === 'cubism5' && this.cubism5Live2DNamespace?.Live2DModel) {
      return this.cubism5Live2DNamespace;
    }
    if (this.legacyLive2DNamespace?.Live2DModel) return this.legacyLive2DNamespace;

    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
    return _topWindow?.PIXI?.live2d || null;
  },

  activateRuntime(runtimeType = 'legacy') {
    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
    if (!_topWindow?.PIXI) return false;

    const target = this.getRuntimeNamespace(runtimeType);
    if (!target?.Live2DModel) return false;

    _topWindow.PIXI.live2d = target;
    return true;
  },

  async _doLoad() {
    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;

    try {
      if (_topWindow.PIXI?.live2d?.Live2DModel) {
        console.log(`[${SCRIPT_NAME}] Live2D SDK already available`);
        this.legacyLive2DNamespace = _topWindow.PIXI.live2d;
        this.isLoaded = true;
        return true;
      }

      if (!_topWindow.PIXI) {
        console.log(`[${SCRIPT_NAME}] 鍔犺浇 PIXI.js...`);
        const pixiText = await fetch(this.PIXI_URL).then(r => {
          if (!r.ok) throw new Error(`PIXI.js 鍔犺浇澶辫触: ${r.status}`);
          return r.text();
        });
        await this._executeScript(pixiText, _topWindow);
        console.log(`[${SCRIPT_NAME}] PIXI.js 鍔犺浇瀹屾垚`);
      }

      if (!_topWindow.window.PIXI) {
        _topWindow.window.PIXI = _topWindow.PIXI;
      }

      if (!_topWindow.Live2DCubismCore) {
        console.log(`[${SCRIPT_NAME}] 鍔犺浇 Cubism 4 Core...`);
        try {
          const coreText = await fetch(this.CUBISM4_CORE_URL).then(r => {
            if (!r.ok) throw new Error(`Cubism 4 Core 鍔犺浇澶辫触: ${r.status}`);
            return r.text();
          });
          await this._executeScript(coreText, _topWindow);
          console.log(`[${SCRIPT_NAME}] Cubism 4 Core 鍔犺浇瀹屾垚`);
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] Cubism 4 Core 鍔犺浇澶辫触锛屽皾璇曞鐢ㄦ簮...`, e);
        }
      }

      if (!_topWindow.Live2D) {
        console.log(`[${SCRIPT_NAME}] 鍔犺浇 Cubism 2.1 Core...`);
        try {
          const core2Text = await fetch(this.CUBISM2_CORE_URL).then(r => {
            if (!r.ok) throw new Error(`Cubism 2.1 Core 鍔犺浇澶辫触: ${r.status}`);
            return r.text();
          });
          await this._executeScript(core2Text, _topWindow);
          console.log(`[${SCRIPT_NAME}] Cubism 2.1 Core 鍔犺浇瀹屾垚`);
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] Cubism 2.1 Core 鍔犺浇澶辫触锛堟棫妯″瀷鍙兘涓嶅彲鐢級:`, e);
        }
      }

      const cached = await this._getFromCache();
      if (cached && cached.sdk) {
        console.log(`[${SCRIPT_NAME}] 浠庣紦瀛樺姞杞?pixi-live2d-display`);
        await this._executeScript(cached.sdk, _topWindow);
      } else {
        console.log(`[${SCRIPT_NAME}] 浠?CDN 鍔犺浇 pixi-live2d-display...`);
        const sdkText = await fetch(this.SDK_URL).then(r => {
          if (!r.ok) throw new Error(`pixi-live2d-display 鍔犺浇澶辫触: ${r.status}`);
          return r.text();
        });
        await this._saveToCache({ sdk: sdkText });
        await this._executeScript(sdkText, _topWindow);
      }

      await new Promise(r => setTimeout(r, 100));

      if (_topWindow.PIXI?.live2d?.Live2DModel) {
        this.legacyLive2DNamespace = _topWindow.PIXI.live2d;
      }

      this.isLoaded = true;
      console.log(`[${SCRIPT_NAME}] Live2D SDK 鍔犺浇瀹屾垚`);
      return true;
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] Live2D SDK 鍔犺浇澶辫触:`, e);
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
            console.log(`[${SCRIPT_NAME}] Live2D SDK 宸茬紦瀛樺埌 IndexedDB`);
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
            this.cubism5CoreLoaded = false;
            this.cubism5CorePromise = null;
            this.cubism5CoreSource = null;
            this.cubism5RuntimeLoaded = false;
            this.cubism5RuntimePromise = null;
            this.cubism5RuntimeSource = null;
            this.legacyLive2DNamespace = null;
            this.cubism5Live2DNamespace = null;
            console.log(`[${SCRIPT_NAME}] Live2D SDK cache cleared`);
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


