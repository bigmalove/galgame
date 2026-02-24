import { SCRIPT_NAME, DB_NAME, DB_VERSION, STORE_SDK_CACHE } from '../core/constants.js';

// ============================================
// Live2D SDK 缂撳瓨鍔犺浇鍣?
// ============================================
export const Live2DLoader = {
  PIXI_URL: 'https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js',
  CUBISM4_CORE_URL: 'https://cdn.jsdelivr.net/npm/live2dcubismcore@1.0.2/live2dcubismcore.min.js',
  CUBISM4_CORE_FALLBACK_URLS: Object.freeze([
    'https://gcore.jsdelivr.net/npm/live2dcubismcore@1.0.2/live2dcubismcore.min.js',
    'https://unpkg.com/live2dcubismcore@1.0.2/live2dcubismcore.min.js',
    'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
  ]),
  CUBISM5_CORE_URL: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
  CUBISM5_CORE_FALLBACK_URLS: Object.freeze([
    'https://cdn.jsdelivr.net/gh/bigmalove/galgame@main/dist/live2dcubismcore.min.js',
    'https://gcore.jsdelivr.net/gh/bigmalove/galgame@main/dist/live2dcubismcore.min.js',
  ]),
  CUBISM2_CORE_URL: 'https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js',
  SDK_URL: 'https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/index.min.js', // TODO: 如上游再出现兼容回归，可考虑锁定到已验证版本
  CUBISM5_RUNTIME_URL: 'https://cdn.jsdelivr.net/gh/bigmalove/galgame@main/dist/cubism5.runtime.min.js',
  CUBISM5_RUNTIME_FALLBACK_URLS: Object.freeze([
    'https://gcore.jsdelivr.net/gh/bigmalove/galgame@main/dist/cubism5.runtime.min.js',
    'https://cdn.jsdelivr.net/gh/bigmalove/galgame@main/dist/cubism5.js',
    'https://gcore.jsdelivr.net/gh/bigmalove/galgame@main/dist/cubism5.js',
  ]),
  SDK_CACHE_KEY: 'live2d_sdk_v3',

  isLoaded: false,
  loadPromise: null,
  legacyCoreLoaded: false,
  legacyCorePromise: null,
  legacyCoreSource: null,
  cubism5CoreLoaded: false,
  cubism5CorePromise: null,
  cubism5CoreSource: null,
  cubism5RuntimeLoaded: false,
  cubism5RuntimePromise: null,
  cubism5RuntimeSource: null,
  legacyLive2DNamespace: null,
  cubism5Live2DNamespace: null,
  patchedResolveUrlPrototypes: new WeakSet(),
  patchedXhrLoaderNamespaces: new WeakSet(),
  pixiUrlResolvePatched: false,
  pixiUrlResolveOriginal: null,
  legacyCoreObject: null,
  cubism5CoreObject: null,
  activeCoreType: null,
  loadedScriptUrls: new Set(),

  _getUrlBase(url) {
    try {
      const resolved = new URL(url, window.location.href);
      resolved.hash = '';
      resolved.search = '';
      const text = resolved.toString();
      const slashIndex = text.lastIndexOf('/');
      return slashIndex >= 0 ? text.slice(0, slashIndex + 1) : text;
    } catch (e) {
      const value = this._normalizeRuntimeUrl(url);
      const slashIndex = value.lastIndexOf('/');
      return slashIndex >= 0 ? value.slice(0, slashIndex + 1) : value;
    }
  },

  _ensureCubismCoreLocateFile(_topWindow, coreUrl) {
    if (!_topWindow) return;
    const baseUrl = this._getUrlBase(coreUrl);
    if (!baseUrl) return;

    const existing = _topWindow.Live2DCubismCore;
    if (existing && typeof existing === 'object') {
      if (typeof existing.locateFile !== 'function') {
        existing.locateFile = (path) => `${baseUrl}${path}`;
      }
      return;
    }

    _topWindow.Live2DCubismCore = {
      locateFile: (path) => `${baseUrl}${path}`,
    };
  },

  _loadScriptSrc(url, timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
      if (!url) {
        reject(new Error('Script URL is empty'));
        return;
      }

      if (this.loadedScriptUrls.has(url)) {
        resolve(true);
        return;
      }

      const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
      const doc = _topWindow?.document || document;
      const script = doc.createElement('script');
      let done = false;

      const finish = (ok, err) => {
        if (done) return;
        done = true;
        if (ok) {
          this.loadedScriptUrls.add(url);
          resolve(true);
        } else {
          reject(err || new Error(`Script load failed: ${url}`));
        }
      };

      const timer = setTimeout(() => {
        finish(false, new Error(`Script load timeout: ${url}`));
      }, timeoutMs);

      script.async = true;
      script.src = url;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        clearTimeout(timer);
        finish(true);
      };
      script.onerror = () => {
        clearTimeout(timer);
        finish(false, new Error(`Script load failed: ${url}`));
      };
      doc.head.appendChild(script);
    });
  },

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

  _isLegacyMocVersion(latestMocVersion) {
    const value = Number(latestMocVersion || 0) || 0;
    return value > 0 && value <= 4;
  },

  _isCubism5MocVersion(latestMocVersion, requiredVersion = 5) {
    const value = Number(latestMocVersion || 0) || 0;
    const required = Math.max(5, Number(requiredVersion || 0) || 0);
    return value >= required;
  },

  _setGlobalCubismCore(_topWindow, coreObject) {
    if (!_topWindow) return;
    if (coreObject) {
      _topWindow.Live2DCubismCore = coreObject;
      return;
    }
    try {
      delete _topWindow.Live2DCubismCore;
    } catch (e) {
      _topWindow.Live2DCubismCore = undefined;
    }
  },

  async ensureLegacyCore() {
    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
    const latestVersion = this._getLatestMocVersion(_topWindow);
    if (this._isLegacyMocVersion(latestVersion)) {
      this.legacyCoreLoaded = true;
      this.cubism5CoreLoaded = false;
      this.activeCoreType = 'legacy';
      this.legacyCoreObject = _topWindow.Live2DCubismCore || this.legacyCoreObject;
      if (!this.legacyCoreSource) {
        this.legacyCoreSource = 'window.Live2DCubismCore(existing)';
      }
      return true;
    }

    if (this._isLegacyMocVersion(this._getLatestMocVersion({ Live2DCubismCore: this.legacyCoreObject }))) {
      this._setGlobalCubismCore(_topWindow, this.legacyCoreObject);
      if (this._isLegacyMocVersion(this._getLatestMocVersion(_topWindow))) {
        this.legacyCoreLoaded = true;
        this.cubism5CoreLoaded = false;
        this.activeCoreType = 'legacy';
        if (!this.legacyCoreSource) {
          this.legacyCoreSource = 'window.Live2DCubismCore(snapshot)';
        }
        return true;
      }
    }

    if (this.legacyCorePromise) return this.legacyCorePromise;

    this.legacyCorePromise = (async () => {
      const previousCore = _topWindow.Live2DCubismCore;
      const coreUrls = this._getCubism4CoreUrls();
      if (!coreUrls.length) {
        console.error(`[${SCRIPT_NAME}] Cubism 4 Core load failed: no core URL candidates`);
        this.legacyCorePromise = null;
        return false;
      }

      let lastError = null;
      try {
        for (const coreUrl of coreUrls) {
          try {
            const coreText = await fetch(coreUrl).then(r => {
              if (!r.ok) throw new Error(`Cubism 4 Core load failed: ${r.status}`);
              return r.text();
            });
            this._setGlobalCubismCore(_topWindow, null);
            await this._executeScript(coreText, _topWindow);

            const startedAt = Date.now();
            let loadedVersion = this._getLatestMocVersion(_topWindow);
            while (Date.now() - startedAt < 5000 && !this._isLegacyMocVersion(loadedVersion)) {
              await new Promise(r => setTimeout(r, 80));
              loadedVersion = this._getLatestMocVersion(_topWindow);
            }

            if (!this._isLegacyMocVersion(loadedVersion)) {
              throw new Error(`latest moc version check failed: ${loadedVersion}`);
            }

            this.legacyCoreLoaded = true;
            this.legacyCoreObject = _topWindow.Live2DCubismCore || this.legacyCoreObject;
            this.legacyCoreSource = coreUrl;
            this.cubism5CoreLoaded = false;
            this.activeCoreType = 'legacy';
            console.log(`[${SCRIPT_NAME}] Cubism 4 Core loaded from ${coreUrl}`);
            return true;
          } catch (candidateError) {
            this._setGlobalCubismCore(_topWindow, previousCore);
            lastError = candidateError;
            console.warn(`[${SCRIPT_NAME}] Cubism 4 Core candidate failed: ${coreUrl}`, candidateError);
          }
        }

        this._setGlobalCubismCore(_topWindow, previousCore);
        if (this._isLegacyMocVersion(this._getLatestMocVersion(_topWindow))) {
          this.legacyCoreLoaded = true;
          this.cubism5CoreLoaded = false;
          this.activeCoreType = 'legacy';
          this.legacyCoreObject = _topWindow.Live2DCubismCore || this.legacyCoreObject;
          if (!this.legacyCoreSource) {
            this.legacyCoreSource = 'window.Live2DCubismCore(existing)';
          }
          console.warn(`[${SCRIPT_NAME}] Cubism 4 Core candidates failed; fallback to existing core`);
          return true;
        }

        console.warn(`[${SCRIPT_NAME}] Cubism 4 Core load failed: all candidates failed`, {
          candidates: coreUrls,
          lastError: String(lastError?.message || lastError || ''),
        });
        if (lastError) {
          this._setGlobalCubismCore(_topWindow, previousCore);
          throw lastError;
        }
        return false;
      } catch (e) {
        this._setGlobalCubismCore(_topWindow, previousCore);
        console.error(`[${SCRIPT_NAME}] Cubism 4 Core load failed:`, e);
        return false;
      } finally {
        this.legacyCorePromise = null;
      }
    })();

    return this.legacyCorePromise;
  },

  async ensureCubism5Core(requiredLatestVersion = 5) {
    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;

    const requiredVersion = Math.max(5, Number(requiredLatestVersion || 0) || 0);
    const latestVersion = this._getLatestMocVersion(_topWindow);
    const existingIsCubism5 = latestVersion >= requiredVersion;
    const hasPinnedCubism5Source =
      typeof this.cubism5CoreSource === 'string' &&
      /^https?:/i.test(this.cubism5CoreSource);
    if (existingIsCubism5 && hasPinnedCubism5Source) {
      this.cubism5CoreLoaded = true;
      this.legacyCoreLoaded = false;
      this.activeCoreType = 'cubism5';
      this.cubism5CoreObject = _topWindow.Live2DCubismCore || this.cubism5CoreObject;
      return true;
    }

    if (existingIsCubism5 && !hasPinnedCubism5Source) {
      this.cubism5CoreObject = _topWindow.Live2DCubismCore || this.cubism5CoreObject;
      console.warn(
        `[${SCRIPT_NAME}] Existing Cubism Core detected without pinned source, will try configured Cubism 5 core URL candidates`,
      );
    }

    if (this._isCubism5MocVersion(this._getLatestMocVersion({ Live2DCubismCore: this.cubism5CoreObject }), requiredVersion)) {
      this._setGlobalCubismCore(_topWindow, this.cubism5CoreObject);
      if (this._isCubism5MocVersion(this._getLatestMocVersion(_topWindow), requiredVersion)) {
        this.cubism5CoreLoaded = true;
        this.legacyCoreLoaded = false;
        this.activeCoreType = 'cubism5';
        if (!this.cubism5CoreSource) {
          this.cubism5CoreSource = 'window.Live2DCubismCore(snapshot)';
        }
        return true;
      }
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
      const previousCore = _topWindow.Live2DCubismCore;
      try {
        for (const coreUrl of coreUrls) {
          try {
            this._setGlobalCubismCore(_topWindow, null);
            this._ensureCubismCoreLocateFile(_topWindow, coreUrl);
            await this._loadScriptSrc(coreUrl);

            const loadedVersion = await this._waitForLatestMocVersion(_topWindow, requiredVersion, 8000, 80);
            if (loadedVersion >= requiredVersion) {
              this.cubism5CoreLoaded = true;
              this.legacyCoreLoaded = false;
              this.activeCoreType = 'cubism5';
              this.cubism5CoreObject = _topWindow.Live2DCubismCore || this.cubism5CoreObject;
              this.cubism5CoreSource = coreUrl;
              console.log(`[${SCRIPT_NAME}] Cubism 5 Core loaded from ${coreUrl}`);
              return true;
            }

            throw new Error(`latest moc version check failed: ${loadedVersion} (required >= ${requiredVersion})`);
          } catch (candidateError) {
            this._setGlobalCubismCore(_topWindow, previousCore);
            lastError = candidateError;
            console.warn(`[${SCRIPT_NAME}] Cubism 5 Core candidate failed: ${coreUrl}`, candidateError);
          }
        }

        this._setGlobalCubismCore(_topWindow, previousCore);
        if (this._isCubism5MocVersion(this._getLatestMocVersion(_topWindow), requiredVersion)) {
          this.cubism5CoreLoaded = true;
          this.legacyCoreLoaded = false;
          this.activeCoreType = 'cubism5';
          this.cubism5CoreObject = _topWindow.Live2DCubismCore || this.cubism5CoreObject;
          if (!this.cubism5CoreSource) {
            this.cubism5CoreSource = 'window.Live2DCubismCore(existing)';
          }
          console.warn(`[${SCRIPT_NAME}] Cubism 5 Core candidates failed; fallback to existing core`);
          return true;
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

  _isDirectResourceUrl(url) {
    const value = this._normalizeRuntimeUrl(url);
    if (!value) return false;
    if (value.startsWith('//')) return true;
    return /^(?:blob|data|https?|file|stscript|chrome-extension|moz-extension|capacitor|app):/i.test(value);
  },

  _patchPixiUrlResolve(_topWindow) {
    if (this.pixiUrlResolvePatched) return true;
    const utils = _topWindow?.PIXI?.utils;
    const urlApi = utils?.url;
    const originalResolve = urlApi?.resolve;
    if (typeof originalResolve !== 'function') return false;

    const loaderRef = this;
    this.pixiUrlResolveOriginal = originalResolve;
    urlApi.resolve = function patchedPixiUrlResolve(baseUrl, resourcePath) {
      if (loaderRef._isDirectResourceUrl(resourcePath)) {
        return loaderRef._normalizeRuntimeUrl(resourcePath);
      }
      return originalResolve.call(this, baseUrl, resourcePath);
    };

    this.pixiUrlResolvePatched = true;
    console.log(`[${SCRIPT_NAME}] Patched PIXI.utils.url.resolve`);
    return true;
  },

  _patchModelSettingsResolveURL(runtimeNamespace, runtimeLabel = 'unknown') {
    if (!runtimeNamespace || typeof runtimeNamespace !== 'object') return 0;

    const candidates = [
      'ModelSettings',
      'Cubism2ModelSettings',
      'Cubism4ModelSettings',
      'Cubism5ModelSettings',
    ];
    let patchedCount = 0;

    for (const ctorName of candidates) {
      const proto = runtimeNamespace?.[ctorName]?.prototype;
      if (!proto || typeof proto.resolveURL !== 'function') continue;
      if (this.patchedResolveUrlPrototypes.has(proto) || proto.__galgameResolveUrlPatched) continue;

      const originalResolveURL = proto.resolveURL;
      const loaderRef = this;
      proto.resolveURL = function patchedResolveURL(resourcePath) {
        if (loaderRef._isDirectResourceUrl(resourcePath)) {
          return loaderRef._normalizeRuntimeUrl(resourcePath);
        }
        return originalResolveURL.call(this, resourcePath);
      };

      try {
        proto.__galgameResolveUrlPatched = true;
      } catch (e) {}
      this.patchedResolveUrlPrototypes.add(proto);
      patchedCount++;
      console.log(`[${SCRIPT_NAME}] Patched ModelSettings.resolveURL (${runtimeLabel}:${ctorName})`);
    }

    return patchedCount;
  },

  _patchXhrLoader(runtimeNamespace, runtimeLabel = 'unknown') {
    if (!runtimeNamespace || typeof runtimeNamespace !== 'object') return false;
    if (this.patchedXhrLoaderNamespaces.has(runtimeNamespace)) return true;

    const XHRLoader = runtimeNamespace.XHRLoader;
    const originalLoader = XHRLoader?.loader;
    if (typeof originalLoader !== 'function') {
      console.warn(`[${SCRIPT_NAME}] XHRLoader.loader missing (${runtimeLabel})`, {
        hasNamespace: !!runtimeNamespace,
        hasXHRLoader: !!XHRLoader,
        loaderType: typeof originalLoader,
      });
      return false;
    }

    const loaderRef = this;
    XHRLoader.loader = (context) => {
      const rawUrl = context?.settings ? context.settings.resolveURL(context.url) : context?.url;
      const requestUrl = loaderRef._normalizeRuntimeUrl(rawUrl);
      if (!loaderRef._isDirectResourceUrl(requestUrl)) {
        return originalLoader(context);
      }

      const requestType = String(context?.type || '').toLowerCase();
      return fetch(requestUrl)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Fetch failed (${response.status}) for ${requestUrl}`);
          }
          if (requestType === 'json') return response.json();
          if (requestType === 'text') return response.text();
          return response.arrayBuffer();
        })
        .then((payload) => {
          if (requestType !== 'json' && requestType !== 'text' && payload instanceof ArrayBuffer) {
            const header = new Uint8Array(payload, 0, Math.min(4, payload.byteLength));
            const signature = String.fromCharCode(...header);
            console.log(`[${SCRIPT_NAME}] XHRLoader patched fetch arraybuffer`, {
              url: requestUrl.slice(0, 128),
              byteLength: payload.byteLength,
              signature,
            });
          }
          context.result = payload;
        });
    };

    this.patchedXhrLoaderNamespaces.add(runtimeNamespace);
    console.log(`[${SCRIPT_NAME}] Patched XHRLoader.loader (${runtimeLabel})`);
    return true;
  },

  _getCubism5RuntimeUrls() {
    const urls = [];
    const seen = new Set();
    const pushUrl = (value) => {
      const normalized = this._normalizeRuntimeUrl(value);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      urls.push(normalized);
    };

    pushUrl(this.CUBISM5_RUNTIME_URL);
    for (const fallbackUrl of this.CUBISM5_RUNTIME_FALLBACK_URLS) {
      pushUrl(fallbackUrl);
    }

    return urls;
  },

  _getCubism5CoreUrls() {
    const urls = [];
    const seen = new Set();
    const pushUrl = (value) => {
      const normalized = this._normalizeRuntimeUrl(value);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      urls.push(normalized);
    };

    pushUrl(this.CUBISM5_CORE_URL);
    for (const fallbackUrl of this.CUBISM5_CORE_FALLBACK_URLS) {
      pushUrl(fallbackUrl);
    }

    return urls;
  },

  _getCubism4CoreUrls() {
    const urls = [];
    const seen = new Set();
    const pushUrl = (value) => {
      const normalized = this._normalizeRuntimeUrl(value);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      urls.push(normalized);
    };

    pushUrl(this.CUBISM4_CORE_URL);
    for (const fallbackUrl of this.CUBISM4_CORE_FALLBACK_URLS) {
      pushUrl(fallbackUrl);
    }
    return urls;
  },

  async ensureCubism5Runtime() {
    if (this.cubism5RuntimeLoaded && this.cubism5Live2DNamespace?.Live2DModel) {
      if (!this.cubism5RuntimeSource) {
        this.cubism5RuntimeSource = 'window.PIXI.live2d(existing)';
      }
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
        const runtimeUrls = this._getCubism5RuntimeUrls();
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

            this._patchModelSettingsResolveURL(runtimeNamespace, 'cubism5');
            this._patchXhrLoader(runtimeNamespace, 'cubism5');

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
        this._patchPixiUrlResolve(_topWindow);
        this.legacyLive2DNamespace = _topWindow.PIXI.live2d;
        this._patchModelSettingsResolveURL(this.legacyLive2DNamespace, 'legacy-existing');
        this._patchXhrLoader(this.legacyLive2DNamespace, 'legacy-existing');
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

      this._patchPixiUrlResolve(_topWindow);

      if (!_topWindow.Live2DCubismCore) {
        console.log(`[${SCRIPT_NAME}] 鍔犺浇 Cubism 4 Core...`);
        try {
          const coreText = await fetch(this.CUBISM4_CORE_URL).then(r => {
            if (!r.ok) throw new Error(`Cubism 4 Core 鍔犺浇澶辫触: ${r.status}`);
            return r.text();
          });
          await this._executeScript(coreText, _topWindow);
          this.legacyCoreLoaded = true;
          this.legacyCoreSource = this.CUBISM4_CORE_URL;
          this.legacyCoreObject = _topWindow.Live2DCubismCore || this.legacyCoreObject;
          this.activeCoreType = 'legacy';
          console.log(`[${SCRIPT_NAME}] Cubism 4 Core 鍔犺浇瀹屾垚`);
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] Cubism 4 Core 鍔犺浇澶辫触锛屽皾璇曞鐢ㄦ簮...`, e);
        }
      } else {
        const latestMocVersion = this._getLatestMocVersion(_topWindow);
        if (latestMocVersion >= 5) {
          this.cubism5CoreLoaded = true;
          this.cubism5CoreSource = this.cubism5CoreSource || 'window.Live2DCubismCore(existing)';
          this.cubism5CoreObject = _topWindow.Live2DCubismCore || this.cubism5CoreObject;
          this.activeCoreType = 'cubism5';
        } else if (this._isLegacyMocVersion(latestMocVersion)) {
          this.legacyCoreLoaded = true;
          this.legacyCoreSource = this.legacyCoreSource || 'window.Live2DCubismCore(existing)';
          this.legacyCoreObject = _topWindow.Live2DCubismCore || this.legacyCoreObject;
          this.activeCoreType = 'legacy';
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
      this._patchPixiUrlResolve(_topWindow);

      if (_topWindow.PIXI?.live2d?.Live2DModel) {
        this.legacyLive2DNamespace = _topWindow.PIXI.live2d;
        this._patchModelSettingsResolveURL(this.legacyLive2DNamespace, 'legacy');
        this._patchXhrLoader(this.legacyLive2DNamespace, 'legacy');
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
            this.legacyCoreLoaded = false;
            this.legacyCorePromise = null;
            this.legacyCoreSource = null;
            this.cubism5CoreLoaded = false;
            this.cubism5CorePromise = null;
            this.cubism5CoreSource = null;
            this.cubism5RuntimeLoaded = false;
            this.cubism5RuntimePromise = null;
            this.cubism5RuntimeSource = null;
            this.legacyLive2DNamespace = null;
            this.cubism5Live2DNamespace = null;
            this.patchedResolveUrlPrototypes = new WeakSet();
            this.patchedXhrLoaderNamespaces = new WeakSet();
            this.pixiUrlResolvePatched = false;
            this.pixiUrlResolveOriginal = null;
            this.legacyCoreObject = null;
            this.cubism5CoreObject = null;
            this.activeCoreType = null;
            this.loadedScriptUrls = new Set();
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
