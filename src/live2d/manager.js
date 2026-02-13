import { SCRIPT_NAME } from '../core/constants.js';
import { Live2DLoader } from './loader.js';
import { getLive2DModel } from '../db/live2d-models.js';
import { getLive2DConfig, updateLive2DConfig, normalizeLive2DScaleBase, calculateLive2DBaseScale, getOverlayReferenceHeight } from './render-mode.js';

// 寤惰繜寮曠敤: Live2DStage (鏉ヨ嚜 ./stage.js锛岄伩鍏嶅惊鐜?, showToast (鏉ヨ嚜 UI 灞?
let _Live2DStageRef = null;
let _showToastRef = null;
export function setLive2DManagerRefs({ Live2DStage, showToast }) {
  if (Live2DStage) _Live2DStageRef = Live2DStage;
  if (showToast) _showToastRef = showToast;
}

// ============================================
// Live2D 鏍稿績娓叉煋绠＄悊鍣?
// ============================================
export const Live2DManager = {
  models: new Map(),        // characterId -> PIXI.Live2DModel
  containers: new Map(),    // characterId -> { app, canvas }
  loadingModels: new Map(), // characterId -> Promise<PIXI.Live2DModel|null>
  renderLocks: new Map(),   // characterId -> Promise<void>
  modelBlobUrls: new Map(), // characterId -> Set<string>
  cachedDetachedAt: new Map(), // characterId -> timestamp (宸查€€鍦虹紦瀛?
  maxDetachedCache: 3,
  xhrBlobUrlSupport: null, // null=unknown, boolean=supported
  xhrBlobUrlSupportPromise: null,
  hasLoggedBlobUrlDisabled: false,
  isReady: false,
  debug: false,

  _debugLog(...args) {
    if (!this.debug) return;
    console.log(...args);
  },

  _markModelActive(characterId) {
    this.cachedDetachedAt.delete(characterId);
  },

  _registerModelBlobUrl(characterId, url) {
    if (!url || typeof url !== 'string') return;
    let urls = this.modelBlobUrls.get(characterId);
    if (!urls) {
      urls = new Set();
      this.modelBlobUrls.set(characterId, urls);
    }
    urls.add(url);
  },

  _revokeModelBlobUrls(characterId) {
    const urls = this.modelBlobUrls.get(characterId);
    if (!urls || !urls.size) {
      this.modelBlobUrls.delete(characterId);
      return;
    }
    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
    const topURL = _topWindow.URL || URL;
    for (const url of urls) {
      try {
        topURL.revokeObjectURL(url);
      } catch (e) {}
    }
    this.modelBlobUrls.delete(characterId);
  },

  async _supportsXhrBlobUrls() {
    if (this.xhrBlobUrlSupport === true || this.xhrBlobUrlSupport === false) {
      return this.xhrBlobUrlSupport;
    }
    if (this.xhrBlobUrlSupportPromise) {
      return await this.xhrBlobUrlSupportPromise;
    }

    this.xhrBlobUrlSupportPromise = (async () => {
      try {
        const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
        const topURL = _topWindow.URL || URL;
        const XHR = _topWindow.XMLHttpRequest;
        if (!topURL?.createObjectURL || !topURL?.revokeObjectURL || typeof XHR !== 'function') return false;

        const payload = new Uint8Array([1, 2, 3, 4]);
        const blob = new Blob([payload], { type: 'application/octet-stream' });
        const blobUrl = topURL.createObjectURL(blob);

        const ok = await new Promise((resolve) => {
          let done = false;
          const finish = (value) => {
            if (done) return;
            done = true;
            resolve(!!value);
          };

          try {
            const xhr = new XHR();
            xhr.open('GET', blobUrl, true);
            xhr.responseType = 'arraybuffer';
            xhr.timeout = 1500;
            xhr.onload = () => {
              const buf = xhr.response;
              finish(buf && buf.byteLength === payload.byteLength);
            };
            xhr.onerror = () => finish(false);
            xhr.onabort = () => finish(false);
            xhr.ontimeout = () => finish(false);
            xhr.send();
          } catch (e) {
            finish(false);
          }
        });

        try {
          topURL.revokeObjectURL(blobUrl);
        } catch (e) {}

        return ok;
      } catch (e) {
        return false;
      }
    })()
      .finally(() => {
        this.xhrBlobUrlSupportPromise = null;
      });

    const supported = await this.xhrBlobUrlSupportPromise;
    this.xhrBlobUrlSupport = supported;
    return supported;
  },

  _disableXhrBlobUrls(reason = 'unknown') {
    this.xhrBlobUrlSupport = false;
    if (!this.hasLoggedBlobUrlDisabled) {
      this.hasLoggedBlobUrlDisabled = true;
      console.warn(`[${SCRIPT_NAME}] Live2DManager: 已禁用 Blob URL（XHR 不兼容或加载失败: ${reason}），将回退使用 Data URL`);
    }
  },

  _isRemoteModelData(modelData) {
    return (
      !!modelData &&
      modelData.source === 'remote' &&
      typeof modelData.modelUrl === 'string' &&
      modelData.modelUrl.trim().length > 0
    );
  },

  _encodePathSegment(segment) {
    if (typeof segment !== 'string' || !segment) return segment;

    let decoded = segment;
    try {
      decoded = decodeURIComponent(segment);
    } catch (e) {
      return segment;
    }

    const safeChar = /[A-Za-z0-9\-._~!$&'()*+,;=:@]/;
    let encoded = '';
    for (const ch of decoded) {
      encoded += safeChar.test(ch) ? ch : encodeURIComponent(ch);
    }
    return encoded;
  },

  _normalizeRemoteUrl(inputUrl) {
    const url = String(inputUrl || '').trim();
    if (!url) return url;

    try {
      const urlObj = new URL(url);
      urlObj.pathname = urlObj.pathname
        .split('/')
        .map(segment => this._encodePathSegment(segment))
        .join('/');
      return urlObj.toString();
    } catch (e) {
      return url;
    }
  },

  _normalizeResourceRef(inputRef) {
    const raw = String(inputRef || '').trim();
    if (!raw) return raw;

    const hashSafe = raw.replace(/#/g, '%23');
    const normalized = hashSafe.replace(/\\/g, '/');

    const qIndex = normalized.indexOf('?');
    const pathPart = qIndex >= 0 ? normalized.slice(0, qIndex) : normalized;
    const queryPart = qIndex >= 0 ? normalized.slice(qIndex) : '';

    const encodedPath = pathPart
      .split('/')
      .map(segment => this._encodePathSegment(segment))
      .join('/');

    return `${encodedPath}${queryPart.replace(/#/g, '%23')}`;
  },

  _stripJsonComments(text) {
    let output = '';
    let inString = false;
    let quoteChar = '"';
    let escaping = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = i + 1 < text.length ? text[i + 1] : '';

      if (inLineComment) {
        if (ch === '\n') {
          inLineComment = false;
          output += ch;
        }
        continue;
      }

      if (inBlockComment) {
        if (ch === '*' && next === '/') {
          inBlockComment = false;
          i++;
        }
        continue;
      }

      if (inString) {
        output += ch;
        if (escaping) {
          escaping = false;
        } else if (ch === '\\') {
          escaping = true;
        } else if (ch === quoteChar) {
          inString = false;
        }
        continue;
      }

      if (ch === '/' && next === '/') {
        inLineComment = true;
        i++;
        continue;
      }

      if (ch === '/' && next === '*') {
        inBlockComment = true;
        i++;
        continue;
      }

      if (ch === '"' || ch === '\'') {
        inString = true;
        quoteChar = ch;
      }

      output += ch;
    }

    return output;
  },

  _tryParseModelJson(text) {
    const raw = String(text ?? '').replace(/^\uFEFF/, '').trim();
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (e) {}

    let cleaned = this._stripJsonComments(raw);
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
    cleaned = cleaned.replace(/}(\s*){/g, '},$1{');
    cleaned = cleaned.replace(/](\s*){/g, '],$1{');
    cleaned = cleaned.replace(/([}\]0-9"'])(\s*)(?="[^"]+"\s*:)/g, '$1,$2');

    try {
      return JSON.parse(cleaned);
    } catch (e) {
      return null;
    }
  },

  _buildModelJsonCandidates(modelUrl) {
    const candidates = [modelUrl];

    const addCandidate = (url) => {
      if (!url) return;
      if (!candidates.includes(url)) {
        candidates.push(url);
      }
    };

    addCandidate(modelUrl.replace(/\/model\.json(?=([?#].*)?$)/i, '/model.model.json'));
    addCandidate(modelUrl.replace(/\/model3\.json(?=([?#].*)?$)/i, '/model.model3.json'));

    return candidates;
  },

  async _fetchWithTimeout(url, init = {}, timeoutMs = 12000) {
    if (typeof AbortController === 'undefined') {
      return await fetch(url, init);
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (e) {
      if (e?.name === 'AbortError') {
        throw new Error(`请求超时 (${timeoutMs}ms): ${url}`);
      }
      throw e;
    } finally {
      window.clearTimeout(timer);
    }
  },

  async _fetchModelJsonCandidate(modelUrl, useProxy) {
    const requestUrl = useProxy ? this._getProxiedUrl(modelUrl) : modelUrl;
    const response = await this._fetchWithTimeout(requestUrl, { method: 'GET', cache: 'no-store' }, 12000);
    if (!response.ok) return null;

    const text = await response.text();
    const parsed = this._tryParseModelJson(text);
    if (!parsed) return null;

    return { modelJson: parsed, sourceUrl: modelUrl, useProxy };
  },

  _normalizeLegacyCubism2Settings(modelJson) {
    if (!modelJson || modelJson.FileReferences) return;

    const textures = modelJson.textures || modelJson.Textures;
    if (Array.isArray(textures)) return;
    if (!textures || typeof textures !== 'object') return;

    const entries = Object.entries(textures)
      .filter((entry) => Array.isArray(entry[1]) && entry[1].length > 0);
    if (!entries.length) return;

    const hintKeys = [
      modelJson.config?.texture,
      modelJson.config?.textureId,
      modelJson.config?.skin,
      modelJson.config?.modelId,
      modelJson.config?.defaultTexture,
      modelJson.config?.defaultSkin,
    ]
      .map(v => (v === undefined || v === null ? '' : String(v).trim()))
      .filter(Boolean);

    let selected = entries[0];
    for (const hint of hintKeys) {
      const matched = entries.find(([key]) => key === hint);
      if (matched) {
        selected = matched;
        break;
      }
    }

    const normalizedTextures = selected[1].map((item) => {
      const raw = String(item || '').trim();
      if (!raw) return raw;
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return raw;
      if (raw.startsWith('/')) return raw;
      if (raw.includes('/')) return raw;
      return `textures/${raw}`;
    });

    modelJson.textures = normalizedTextures;
    modelJson.Textures = normalizedTextures;
    this._debugLog(`[${SCRIPT_NAME}] Live2DManager: 检测到非标准 Cubism2 贴图结构，已自动转换`, {
      key: selected[0],
      textureCount: normalizedTextures.length,
    });
  },

  _getProxiedUrl(originalUrl) {
    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
    const url = String(originalUrl || '').trim();
    if (!url) return url;
    if (url.toLowerCase().includes('/proxy?url=')) return url;

    if (typeof _topWindow.getCorsProxyUrl === 'function') {
      try {
        const proxied = _topWindow.getCorsProxyUrl(url);
        if (typeof proxied === 'string' && proxied) return proxied;
      } catch (e) {}
    }

    if (typeof _topWindow.enableCorsProxy === 'function') {
      try {
        const proxied = _topWindow.enableCorsProxy(url);
        if (typeof proxied === 'string' && proxied) return proxied;
      } catch (e) {}
    }

    if (_topWindow.corsProxy?.getProxyUrl) {
      try {
        const proxied = _topWindow.corsProxy.getProxyUrl(url);
        if (typeof proxied === 'string' && proxied) return proxied;
      } catch (e) {}
    }

    const origin = _topWindow.location?.origin;
    if (origin) {
      return `${origin}/proxy?url=${encodeURIComponent(url)}`;
    }

    return url;
  },

  _destroyModel(characterId, reason = 'cleanup') {
    const model = this.models.get(characterId);
    if (!model) {
      this.cachedDetachedAt.delete(characterId);
      this.containers.delete(characterId);
      this._revokeModelBlobUrls(characterId);
      return false;
    }
    try {
      if (model.parent) {
        model.parent.removeChild(model);
      }
      model.destroy();
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] Live2DManager: 销毁模型失败 (${characterId}, ${reason})`, e);
    }
    this.models.delete(characterId);
    this.containers.delete(characterId);
    this.loadingModels.delete(characterId);
    this.cachedDetachedAt.delete(characterId);
    this._revokeModelBlobUrls(characterId);
    return true;
  },

  _evictDetachedModels() {
    if (this.cachedDetachedAt.size <= this.maxDetachedCache) return;
    const sorted = Array.from(this.cachedDetachedAt.entries()).sort((a, b) => a[1] - b[1]);
    while (this.cachedDetachedAt.size > this.maxDetachedCache && sorted.length > 0) {
      const [characterId] = sorted.shift();
      this._destroyModel(characterId, 'cache-evict');
      this._debugLog(`[${SCRIPT_NAME}] Live2DManager: 缓存淘汰模型 ${characterId}`);
    }
  },

  releaseCharacter(characterId) {
    this._cleanupContainer(characterId);
    if (!this.models.has(characterId)) return false;
    this.cachedDetachedAt.set(characterId, Date.now());
    this._evictDetachedModels();
    return true;
  },

  _normalizeTransform(characterId, transformConfig, containerWidth, containerHeight) {
    const rawScaleBase = transformConfig?.scaleBase;
    const normalizedScaleBase = normalizeLive2DScaleBase(rawScaleBase);
    const safeTransform = {
      offsetX: Number(transformConfig?.offsetX) || 0,
      offsetY: Number(transformConfig?.offsetY) || 0,
      scale: Number(transformConfig?.scale) || 1.0,
      scaleBase: normalizedScaleBase,
    };

    const legacyThresholdX = Math.max(120, containerWidth * 1.2);
    const legacyThresholdY = Math.max(120, containerHeight * 1.2);
    let normalizedX = safeTransform.offsetX;
    let normalizedY = safeTransform.offsetY;
    let changed = false;

    if (Math.abs(normalizedX) > legacyThresholdX) {
      normalizedX = normalizedX / 3;
      changed = true;
    }
    if (Math.abs(normalizedY) > legacyThresholdY) {
      normalizedY = normalizedY / 3;
      changed = true;
    }

    const maxOffsetX = Math.max(40, containerWidth * 0.45);
    const maxOffsetY = Math.max(40, containerHeight * 0.45);
    const clampedX = Math.max(-maxOffsetX, Math.min(maxOffsetX, normalizedX));
    const clampedY = Math.max(-maxOffsetY, Math.min(maxOffsetY, normalizedY));
    if (clampedX !== normalizedX || clampedY !== normalizedY) {
      changed = true;
    }
    if (rawScaleBase !== undefined && rawScaleBase !== normalizedScaleBase) {
      changed = true;
    }

    const normalizedTransform = {
      offsetX: clampedX,
      offsetY: clampedY,
      scale: safeTransform.scale,
      scaleBase: safeTransform.scaleBase,
    };

    if (changed) {
      try {
        updateLive2DConfig(characterId, { transform: normalizedTransform });
        this._debugLog(
          `[${SCRIPT_NAME}] Live2DManager: 坐标兼容修正 ${characterId} (${safeTransform.offsetX}, ${safeTransform.offsetY}) -> (${normalizedTransform.offsetX}, ${normalizedTransform.offsetY})`,
        );
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] Live2DManager: 保存兼容修正失败`, e);
      }
    }

    return normalizedTransform;
  },

  async init() {
    if (this.isReady) return true;

    const sdkLoaded = await Live2DLoader.load();
    if (!sdkLoaded) {
      console.error(`[${SCRIPT_NAME}] Live2DManager: SDK 加载失败`);
      return false;
    }

    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;

    let retries = 30;
    while (!_topWindow.PIXI?.live2d?.Live2DModel && retries > 0) {
      await new Promise(r => setTimeout(r, 100));
      retries--;
    }

    if (!_topWindow.PIXI?.live2d?.Live2DModel) {
      console.error(`[${SCRIPT_NAME}] Live2DManager: PIXI.live2d 未就绪`, {
        PIXI: !!_topWindow.PIXI,
        live2d: !!_topWindow.PIXI?.live2d,
        Live2DModel: !!_topWindow.PIXI?.live2d?.Live2DModel
      });
      return false;
    }

    try {
      const { Live2DModel } = _topWindow.PIXI.live2d;
      Live2DModel.registerTicker(_topWindow.PIXI.Ticker);

      this.isReady = true;
      this._debugLog(`[${SCRIPT_NAME}] Live2DManager 初始化完成`);
      return true;
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] Live2DManager 初始化失败`, e);
      return false;
    }
  },

  async loadModel(characterId, forceReload = false) {
    if (!this.isReady) {
      const ready = await this.init();
      if (!ready) return null;
    }

    if (!forceReload && this.loadingModels.has(characterId)) {
      return await this.loadingModels.get(characterId);
    }

    if (forceReload && this.models.has(characterId)) {
      this._destroyModel(characterId, 'force-reload');
    }

    if (this.models.has(characterId)) {
      this._markModelActive(characterId);
      return this.models.get(characterId);
    }

    const modelData = await getLive2DModel(characterId);
    if (!modelData) {
      console.warn(`[${SCRIPT_NAME}] Live2DManager: 未找到角色 ${characterId} 的 Live2D 模型`);
      return null;
    }

    const isRemote = this._isRemoteModelData(modelData);
    const remoteModelUrl = isRemote ? this._normalizeRemoteUrl(modelData.modelUrl.trim()) : '';

    const loadTask = (async () => {
      this._revokeModelBlobUrls(characterId);
      const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
      const PIXI = _topWindow.PIXI;
      const { Live2DModel } = PIXI.live2d;

      const loadFromUrl = async (modelUrl) => {
        const model = await Live2DModel.from(modelUrl, {
          // 避免在模型尚未挂载到带 WebGL renderer 的舞台前就触发 update，
          // 远程 Cubism2 模型在该阶段容易抛 createProgram undefined。
          autoUpdate: false,
          autoInteract: false,
        });

        await new Promise((resolve) => {
          let retryCount = 0;
          const maxRetries = 30;

          const checkTextures = () => {
            retryCount++;

            if (retryCount > maxRetries) {
              console.warn(`[${SCRIPT_NAME}] Live2DManager: 纹理检查达到最大重试次数，继续渲染`);
              resolve(false);
              return;
            }

            const internalModel = model.internalModel;
            if (!internalModel) {
              setTimeout(checkTextures, 100);
              return;
            }

            const textures = internalModel.textures || internalModel._textures || [];

            if (textures.length === 0) {
              this._debugLog(`[${SCRIPT_NAME}] Live2DManager: 模型无外部纹理，跳过等待`);
              resolve(true);
              return;
            }

            const allLoaded = textures.every(tex => {
              if (!tex) return false;
              if (tex.baseTexture) {
                return tex.baseTexture.valid;
              }
              return true;
            });

            if (allLoaded) {
              this._debugLog(`[${SCRIPT_NAME}] Live2DManager: 纹理全部加载完成 (${textures.length} 张)`);
              resolve(true);
            } else {
              if (retryCount % 5 === 0) {
                this._debugLog(`[${SCRIPT_NAME}] Live2DManager: 等待纹理加载... (${textures.filter(t => t?.baseTexture?.valid).length}/${textures.length})`);
              }
              setTimeout(checkTextures, 100);
            }
          };

          checkTextures();
        });

        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => setTimeout(r, 100));

        // 不在这里主动调用 model.update(0)。
        // 远程 Cubism2 模型在未挂载渲染器前触发 update，可能抛 createProgram undefined，
        // 并导致后续主舞台渲染异常。
        return model;
      };

      const buildLocalModelUrl = async (preferBlob = true) => {
        if (!preferBlob) {
          return await this._buildModelDataUrl(modelData, characterId);
        }
        const supported = await this._supportsXhrBlobUrls();
        if (!supported) {
          this._disableXhrBlobUrls('xhr-test-failed');
          return await this._buildModelDataUrl(modelData, characterId);
        }
        return await this._buildModelBlobUrl(modelData, characterId);
      };

      const buildRemoteModelUrl = async () => {
        if (!remoteModelUrl) {
          throw new Error('远程 Live2D modelUrl 为空');
        }
        return await this._buildRemoteModelDataUrl(characterId, remoteModelUrl);
      };

      let usedBlobForLocal = false;
      try {
        const modelUrl = isRemote
          ? await buildRemoteModelUrl()
          : await buildLocalModelUrl(true);
        usedBlobForLocal = !isRemote && String(modelUrl || '').startsWith('blob:');

        const model = await loadFromUrl(modelUrl);
        this.models.set(characterId, model);
        this._markModelActive(characterId);
        this._debugLog(`[${SCRIPT_NAME}] Live2DManager: 模型 ${characterId} 加载成功`);
        return model;
      } catch (e) {
        if (!isRemote && usedBlobForLocal) {
          console.warn(`[${SCRIPT_NAME}] Live2DManager: Blob URL 加载失败，回退 Data URL (${characterId})`, e);
          this._disableXhrBlobUrls('load-failed');
          this._revokeModelBlobUrls(characterId);
          const dataUrl = await buildLocalModelUrl(false);
          const model = await loadFromUrl(dataUrl);
          this.models.set(characterId, model);
          this._markModelActive(characterId);
          this._debugLog(`[${SCRIPT_NAME}] Live2DManager: 模型 ${characterId} DataURL 回退加载成功`);
          return model;
        }
        throw e;
      }
    })()
      .catch((e) => {
        this._revokeModelBlobUrls(characterId);
        console.error(`[${SCRIPT_NAME}] Live2DManager: 模型 ${characterId} 加载失败:`, e);
        return null;
      })
      .finally(() => {
        this.loadingModels.delete(characterId);
      });

    this.loadingModels.set(characterId, loadTask);
    return await loadTask;
  },

  async _buildModelBlobUrl(modelData, characterId) {
    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;

    const modifiedModelJson = JSON.parse(JSON.stringify(modelData.modelJson));
    const topURL = _topWindow.URL || URL;

    const registerBlob = (blob) => {
      const url = topURL.createObjectURL(blob);
      this._registerModelBlobUrl(characterId, url);
      return url;
    };

    const arrayBufferToBlobUrl = (buffer, mimeType) => {
      const blob = new Blob([buffer], { type: mimeType || 'application/octet-stream' });
      return registerBlob(blob);
    };

    const normalizePath = (p) => (typeof p === 'string' ? p.replace(/\\/g, '/') : p);

    const isModel3 = !!modifiedModelJson?.FileReferences;

    if (isModel3) {
      // Cubism 3/4: model3.json
      if (modelData.moc3 && modifiedModelJson.FileReferences) {
        const mocUrl = arrayBufferToBlobUrl(modelData.moc3, 'application/octet-stream');
        modifiedModelJson.FileReferences.Moc = mocUrl;
      }

      if (modelData.textures && modifiedModelJson.FileReferences?.Textures) {
        for (let i = 0; i < modelData.textures.length; i++) {
          const tex = modelData.textures[i];
          if (!tex?.data) continue;
          modifiedModelJson.FileReferences.Textures[i] = registerBlob(tex.data);
        }
      }

      if (modelData.physics && modifiedModelJson.FileReferences?.Physics) {
        const physicsUrl = arrayBufferToBlobUrl(modelData.physics, 'application/json');
        modifiedModelJson.FileReferences.Physics = physicsUrl;
      }

      if (modelData.pose && modifiedModelJson.FileReferences?.Pose) {
        const poseUrl = arrayBufferToBlobUrl(modelData.pose, 'application/json');
        modifiedModelJson.FileReferences.Pose = poseUrl;
      }

      if (modelData.motions && Object.keys(modelData.motions).length > 0) {
        if (!modifiedModelJson.FileReferences.Motions) {
          modifiedModelJson.FileReferences.Motions = {};
        }

        for (const [groupName, motionList] of Object.entries(modelData.motions)) {
          if (!modifiedModelJson.FileReferences.Motions[groupName]) {
            modifiedModelJson.FileReferences.Motions[groupName] = [];
          }

          for (let i = 0; i < motionList.length; i++) {
            const motion = motionList[i];
            if (motion.data) {
              const motionUrl = arrayBufferToBlobUrl(motion.data, 'application/json');
              if (modifiedModelJson.FileReferences.Motions[groupName][i]) {
                modifiedModelJson.FileReferences.Motions[groupName][i].File = motionUrl;
              } else {
                modifiedModelJson.FileReferences.Motions[groupName].push({ File: motionUrl });
              }
            }
          }
        }
      }

      if (modelData.expressions && modelData.expressions.length > 0) {
        if (!modifiedModelJson.FileReferences.Expressions) {
          modifiedModelJson.FileReferences.Expressions = [];
        }

        for (let i = 0; i < modelData.expressions.length; i++) {
          const expr = modelData.expressions[i];
          if (expr.data) {
            const exprUrl = arrayBufferToBlobUrl(expr.data, 'application/json');
            if (modifiedModelJson.FileReferences.Expressions[i]) {
              modifiedModelJson.FileReferences.Expressions[i].File = exprUrl;
            } else {
              modifiedModelJson.FileReferences.Expressions.push({
                Name: expr.name,
                File: exprUrl
              });
            }
          }
        }
      }
    } else {
      // Cubism 2.1: model.json
      if (modelData.moc) {
        const mocUrl = arrayBufferToBlobUrl(modelData.moc, 'application/octet-stream');
        if (typeof modifiedModelJson.model === 'string') {
          modifiedModelJson.model = mocUrl;
        } else if (typeof modifiedModelJson.Model === 'string') {
          modifiedModelJson.Model = mocUrl;
        } else {
          modifiedModelJson.model = mocUrl;
        }
      }

      const textureList = modifiedModelJson.textures || modifiedModelJson.Textures;
      if (Array.isArray(textureList) && Array.isArray(modelData.textures)) {
        const texMap = new Map();
        for (const tex of modelData.textures) {
          if (!tex?.name || !tex?.data) continue;
          texMap.set(normalizePath(tex.name), tex.data);
        }

        const getByBasename = (target) => {
          const base = String(target || '').split('/').pop();
          if (!base) return null;
          const matches = [];
          for (const [k, v] of texMap.entries()) {
            if (k.split('/').pop() === base) matches.push(v);
          }
          return matches.length === 1 ? matches[0] : null;
        };

        for (let i = 0; i < textureList.length; i++) {
          const texPath = textureList[i];
          const blob = texMap.get(normalizePath(texPath)) || getByBasename(texPath);
          if (blob) {
            textureList[i] = registerBlob(blob);
          }
        }
      }

      if (modelData.physics) {
        const physicsUrl = arrayBufferToBlobUrl(modelData.physics, 'application/json');
        modifiedModelJson.physics = physicsUrl;
        if (typeof modifiedModelJson.Physics === 'string') {
          modifiedModelJson.Physics = physicsUrl;
        }
      }

      if (modelData.pose) {
        const poseUrl = arrayBufferToBlobUrl(modelData.pose, 'application/json');
        modifiedModelJson.pose = poseUrl;
        if (typeof modifiedModelJson.Pose === 'string') {
          modifiedModelJson.Pose = poseUrl;
        }
      }

      const guessMime = (filePath) => {
        const lower = String(filePath || '').toLowerCase();
        return lower.endsWith('.json') ? 'application/json' : 'application/octet-stream';
      };

      if (modelData.motions && Object.keys(modelData.motions).length > 0) {
        const motionMap = new Map();
        for (const motionList of Object.values(modelData.motions)) {
          if (!Array.isArray(motionList)) continue;
          for (const motion of motionList) {
            if (!motion?.name || !motion?.data) continue;
            motionMap.set(normalizePath(motion.name), motion.data);
          }
        }

        const motionsObj = modifiedModelJson.motions || modifiedModelJson.Motions;
        if (motionsObj && typeof motionsObj === 'object') {
          for (const [groupName, motionList] of Object.entries(motionsObj)) {
            if (!Array.isArray(motionList)) continue;
            for (let i = 0; i < motionList.length; i++) {
              const motionDef = motionList[i];
              const filePath = typeof motionDef === 'string' ? motionDef : motionDef?.file || motionDef?.File;
              if (!filePath) continue;
              const data = motionMap.get(normalizePath(filePath));
              if (!data) continue;
              const dataUrl = arrayBufferToBlobUrl(data, guessMime(filePath));
              if (typeof motionDef === 'string') {
                motionList[i] = dataUrl;
              } else if (typeof motionDef?.file === 'string') {
                motionDef.file = dataUrl;
              } else {
                motionDef.File = dataUrl;
              }
            }
          }
        }
      }

      if (Array.isArray(modelData.expressions) && modelData.expressions.length > 0) {
        const exprMap = new Map();
        for (const expr of modelData.expressions) {
          const key = expr?.file || expr?.name;
          if (!key || !expr?.data) continue;
          exprMap.set(normalizePath(key), expr.data);
        }

        const exprList = modifiedModelJson.expressions || modifiedModelJson.Expressions;
        if (Array.isArray(exprList)) {
          for (let i = 0; i < exprList.length; i++) {
            const exprDef = exprList[i];
            const filePath = typeof exprDef === 'string' ? exprDef : exprDef?.file || exprDef?.File;
            if (!filePath) continue;
            const data = exprMap.get(normalizePath(filePath));
            if (!data) continue;
            const dataUrl = arrayBufferToBlobUrl(data, 'application/json');

            if (typeof exprDef === 'string') {
              exprList[i] = dataUrl;
            } else if (typeof exprDef?.file === 'string') {
              exprDef.file = dataUrl;
            } else {
              exprDef.File = dataUrl;
            }
          }
        }
      }
    }

    const modelBlob = new Blob([JSON.stringify(modifiedModelJson)], { type: 'application/json' });
    return registerBlob(modelBlob);
  },

  async _buildModelDataUrl(modelData, characterId) {
    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;

    const modifiedModelJson = JSON.parse(JSON.stringify(modelData.modelJson));

    const arrayBufferToBase64 = (buffer) => {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    };

    const blobToDataUrl = (blob) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    };

    const arrayBufferToDataUrl = (buffer, mimeType) => {
      const base64 = arrayBufferToBase64(buffer);
      return `data:${mimeType};base64,${base64}`;
    };

    const normalizePath = (p) => (typeof p === 'string' ? p.replace(/\\/g, '/') : p);
    const isModel3 = !!modifiedModelJson?.FileReferences;

    if (isModel3) {
      // Cubism 3/4: model3.json
      if (modelData.moc3 && modifiedModelJson.FileReferences) {
        modifiedModelJson.FileReferences.Moc = arrayBufferToDataUrl(modelData.moc3, 'application/octet-stream');
      }

      if (modelData.textures && modifiedModelJson.FileReferences?.Textures) {
        for (let i = 0; i < modelData.textures.length; i++) {
          const tex = modelData.textures[i];
          if (!tex?.data) continue;
          const texDataUrl = await blobToDataUrl(tex.data);
          modifiedModelJson.FileReferences.Textures[i] = texDataUrl;
        }
      }

      if (modelData.physics && modifiedModelJson.FileReferences?.Physics) {
        modifiedModelJson.FileReferences.Physics = arrayBufferToDataUrl(modelData.physics, 'application/json');
      }

      if (modelData.pose && modifiedModelJson.FileReferences?.Pose) {
        modifiedModelJson.FileReferences.Pose = arrayBufferToDataUrl(modelData.pose, 'application/json');
      }

      if (modelData.motions && Object.keys(modelData.motions).length > 0) {
        if (!modifiedModelJson.FileReferences.Motions) {
          modifiedModelJson.FileReferences.Motions = {};
        }

        for (const [groupName, motionList] of Object.entries(modelData.motions)) {
          if (!modifiedModelJson.FileReferences.Motions[groupName]) {
            modifiedModelJson.FileReferences.Motions[groupName] = [];
          }

          for (let i = 0; i < motionList.length; i++) {
            const motion = motionList[i];
            if (!motion?.data) continue;
            const motionDataUrl = arrayBufferToDataUrl(motion.data, 'application/json');
            if (modifiedModelJson.FileReferences.Motions[groupName][i]) {
              modifiedModelJson.FileReferences.Motions[groupName][i].File = motionDataUrl;
            } else {
              modifiedModelJson.FileReferences.Motions[groupName].push({ File: motionDataUrl });
            }
          }
        }
      }

      if (modelData.expressions && modelData.expressions.length > 0) {
        if (!modifiedModelJson.FileReferences.Expressions) {
          modifiedModelJson.FileReferences.Expressions = [];
        }

        for (let i = 0; i < modelData.expressions.length; i++) {
          const expr = modelData.expressions[i];
          if (!expr?.data) continue;
          const exprDataUrl = arrayBufferToDataUrl(expr.data, 'application/json');
          if (modifiedModelJson.FileReferences.Expressions[i]) {
            modifiedModelJson.FileReferences.Expressions[i].File = exprDataUrl;
          } else {
            modifiedModelJson.FileReferences.Expressions.push({
              Name: expr.name,
              File: exprDataUrl
            });
          }
        }
      }
    } else {
      // Cubism 2.1: model.json
      if (modelData.moc) {
        const mocDataUrl = arrayBufferToDataUrl(modelData.moc, 'application/octet-stream');
        if (typeof modifiedModelJson.model === 'string') {
          modifiedModelJson.model = mocDataUrl;
        } else if (typeof modifiedModelJson.Model === 'string') {
          modifiedModelJson.Model = mocDataUrl;
        } else {
          modifiedModelJson.model = mocDataUrl;
        }
      }

      const textureList = modifiedModelJson.textures || modifiedModelJson.Textures;
      if (Array.isArray(textureList) && Array.isArray(modelData.textures)) {
        const texMap = new Map();
        for (const tex of modelData.textures) {
          if (!tex?.name || !tex?.data) continue;
          texMap.set(normalizePath(tex.name), tex.data);
        }

        const getByBasename = (target) => {
          const base = String(target || '').split('/').pop();
          if (!base) return null;
          const matches = [];
          for (const [k, v] of texMap.entries()) {
            if (k.split('/').pop() === base) matches.push(v);
          }
          return matches.length === 1 ? matches[0] : null;
        };

        for (let i = 0; i < textureList.length; i++) {
          const texPath = textureList[i];
          const blob = texMap.get(normalizePath(texPath)) || getByBasename(texPath);
          if (blob) {
            textureList[i] = await blobToDataUrl(blob);
          }
        }
      }

      if (modelData.physics) {
        const physicsDataUrl = arrayBufferToDataUrl(modelData.physics, 'application/json');
        modifiedModelJson.physics = physicsDataUrl;
        if (typeof modifiedModelJson.Physics === 'string') {
          modifiedModelJson.Physics = physicsDataUrl;
        }
      }

      if (modelData.pose) {
        const poseDataUrl = arrayBufferToDataUrl(modelData.pose, 'application/json');
        modifiedModelJson.pose = poseDataUrl;
        if (typeof modifiedModelJson.Pose === 'string') {
          modifiedModelJson.Pose = poseDataUrl;
        }
      }

      const guessMime = (filePath) => {
        const lower = String(filePath || '').toLowerCase();
        return lower.endsWith('.json') ? 'application/json' : 'application/octet-stream';
      };

      if (modelData.motions && Object.keys(modelData.motions).length > 0) {
        const motionMap = new Map();
        for (const motionList of Object.values(modelData.motions)) {
          if (!Array.isArray(motionList)) continue;
          for (const motion of motionList) {
            if (!motion?.name || !motion?.data) continue;
            motionMap.set(normalizePath(motion.name), motion.data);
          }
        }

        const motionsObj = modifiedModelJson.motions || modifiedModelJson.Motions;
        if (motionsObj && typeof motionsObj === 'object') {
          for (const [groupName, motionList] of Object.entries(motionsObj)) {
            if (!Array.isArray(motionList)) continue;
            for (let i = 0; i < motionList.length; i++) {
              const motionDef = motionList[i];
              const filePath = typeof motionDef === 'string' ? motionDef : motionDef?.file || motionDef?.File;
              if (!filePath) continue;
              const data = motionMap.get(normalizePath(filePath));
              if (!data) continue;
              const dataUrl = arrayBufferToDataUrl(data, guessMime(filePath));
              if (typeof motionDef === 'string') {
                motionList[i] = dataUrl;
              } else if (typeof motionDef?.file === 'string') {
                motionDef.file = dataUrl;
              } else {
                motionDef.File = dataUrl;
              }
            }
          }
        }
      }

      if (Array.isArray(modelData.expressions) && modelData.expressions.length > 0) {
        const exprMap = new Map();
        for (const expr of modelData.expressions) {
          const key = expr?.file || expr?.name;
          if (!key || !expr?.data) continue;
          exprMap.set(normalizePath(key), expr.data);
        }

        const exprList = modifiedModelJson.expressions || modifiedModelJson.Expressions;
        if (Array.isArray(exprList)) {
          for (let i = 0; i < exprList.length; i++) {
            const exprDef = exprList[i];
            const filePath = typeof exprDef === 'string' ? exprDef : exprDef?.file || exprDef?.File;
            if (!filePath) continue;
            const data = exprMap.get(normalizePath(filePath));
            if (!data) continue;
            const dataUrl = arrayBufferToDataUrl(data, 'application/json');

            if (typeof exprDef === 'string') {
              exprList[i] = dataUrl;
            } else if (typeof exprDef?.file === 'string') {
              exprDef.file = dataUrl;
            } else {
              exprDef.File = dataUrl;
            }
          }
        }
      }
    }

    const modelJsonStr = JSON.stringify(modifiedModelJson);
    const modelJsonBase64 = btoa(unescape(encodeURIComponent(modelJsonStr)));
    return `data:application/json;base64,${modelJsonBase64}`;
  },

  async _buildRemoteModelDataUrl(characterId, modelUrl, forceProxyResources = false) {
    const url = this._normalizeRemoteUrl(String(modelUrl || '').trim());
    if (!url) {
      throw new Error('杩滅▼ Live2D modelUrl 涓虹┖');
    }

    const candidateUrls = this._buildModelJsonCandidates(url);
    let modelJson = null;
    let sourceModelUrl = url;
    let fetchedViaProxy = false;
    let lastError = null;

    for (const candidateUrl of candidateUrls) {
      try {
        const direct = await this._fetchModelJsonCandidate(candidateUrl, false);
        if (direct) {
          modelJson = direct.modelJson;
          sourceModelUrl = direct.sourceUrl;
          fetchedViaProxy = false;
          break;
        }
      } catch (directError) {
        lastError = directError;
        console.warn(`[${SCRIPT_NAME}] Live2DManager: 直连获取模型 JSON 失败，尝试代理`, {
          characterId,
          modelUrl: candidateUrl,
          error: directError,
        });
      }

      try {
        const proxied = await this._fetchModelJsonCandidate(candidateUrl, true);
        if (proxied) {
          modelJson = proxied.modelJson;
          sourceModelUrl = proxied.sourceUrl;
          fetchedViaProxy = true;
          break;
        }
      } catch (proxyError) {
        lastError = proxyError;
        console.warn(`[${SCRIPT_NAME}] Live2DManager: 代理获取模型 JSON 失败`, {
          characterId,
          modelUrl: candidateUrl,
          error: proxyError,
        });
      }
    }

    if (!modelJson) {
      throw (lastError instanceof Error ? lastError : new Error('远程模型 JSON 解析失败'));
    }

    const modifiedModelJson = JSON.parse(JSON.stringify(modelJson));
    this._normalizeLegacyCubism2Settings(modifiedModelJson);

    const resolveUrl = (p) => {
      if (typeof p !== 'string') return p;
      const raw = p.trim();
      if (!raw) return p;

      const normalized = this._normalizeResourceRef(raw);
      const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(normalized);
      const abs = hasScheme
        ? this._normalizeRemoteUrl(normalized)
        : this._normalizeRemoteUrl(new URL(normalized, sourceModelUrl).toString());
      if ((fetchedViaProxy || forceProxyResources) && (abs.startsWith('http://') || abs.startsWith('https://'))) {
        return this._getProxiedUrl(abs);
      }
      return abs;
    };

    const rewriteCubism3 = (refs) => {
      if (!refs || typeof refs !== 'object') return;

      if (typeof refs.Moc === 'string') refs.Moc = resolveUrl(refs.Moc);
      if (Array.isArray(refs.Textures)) refs.Textures = refs.Textures.map(resolveUrl);
      if (typeof refs.Physics === 'string') refs.Physics = resolveUrl(refs.Physics);
      if (typeof refs.Pose === 'string') refs.Pose = resolveUrl(refs.Pose);
      if (typeof refs.UserData === 'string') refs.UserData = resolveUrl(refs.UserData);

      if (refs.Motions && typeof refs.Motions === 'object') {
        for (const groupName of Object.keys(refs.Motions)) {
          const motionList = refs.Motions[groupName];
          if (!Array.isArray(motionList)) continue;
          for (const motionDef of motionList) {
            if (!motionDef || typeof motionDef !== 'object') continue;
            if (typeof motionDef.File === 'string') motionDef.File = resolveUrl(motionDef.File);
            if (typeof motionDef.Sound === 'string') motionDef.Sound = resolveUrl(motionDef.Sound);
          }
        }
      }

      if (Array.isArray(refs.Expressions)) {
        for (const exprDef of refs.Expressions) {
          if (!exprDef || typeof exprDef !== 'object') continue;
          if (typeof exprDef.File === 'string') exprDef.File = resolveUrl(exprDef.File);
        }
      }
    };

    const rewriteCubism2 = () => {
      if (typeof modifiedModelJson.model === 'string') {
        modifiedModelJson.model = resolveUrl(modifiedModelJson.model);
      } else if (typeof modifiedModelJson.Model === 'string') {
        modifiedModelJson.Model = resolveUrl(modifiedModelJson.Model);
      }

      const textures = modifiedModelJson.textures || modifiedModelJson.Textures;
      if (Array.isArray(textures)) {
        for (let i = 0; i < textures.length; i++) {
          if (typeof textures[i] === 'string') textures[i] = resolveUrl(textures[i]);
        }
      }

      if (typeof modifiedModelJson.physics === 'string') modifiedModelJson.physics = resolveUrl(modifiedModelJson.physics);
      if (typeof modifiedModelJson.Physics === 'string') modifiedModelJson.Physics = resolveUrl(modifiedModelJson.Physics);
      if (typeof modifiedModelJson.pose === 'string') modifiedModelJson.pose = resolveUrl(modifiedModelJson.pose);
      if (typeof modifiedModelJson.Pose === 'string') modifiedModelJson.Pose = resolveUrl(modifiedModelJson.Pose);

      const motions = modifiedModelJson.motions || modifiedModelJson.Motions;
      if (motions && typeof motions === 'object') {
        for (const groupName of Object.keys(motions)) {
          const motionList = motions[groupName];
          if (!Array.isArray(motionList)) continue;
          for (const motionDef of motionList) {
            if (!motionDef || typeof motionDef !== 'object') continue;
            if (typeof motionDef.file === 'string') motionDef.file = resolveUrl(motionDef.file);
            if (typeof motionDef.File === 'string') motionDef.File = resolveUrl(motionDef.File);
            if (typeof motionDef.sound === 'string') motionDef.sound = resolveUrl(motionDef.sound);
            if (typeof motionDef.Sound === 'string') motionDef.Sound = resolveUrl(motionDef.Sound);
          }
        }
      }

      const expressions = modifiedModelJson.expressions || modifiedModelJson.Expressions;
      if (Array.isArray(expressions)) {
        for (const exprDef of expressions) {
          if (!exprDef || typeof exprDef !== 'object') continue;
          if (typeof exprDef.file === 'string') exprDef.file = resolveUrl(exprDef.file);
          if (typeof exprDef.File === 'string') exprDef.File = resolveUrl(exprDef.File);
        }
      }
    };

    if (modifiedModelJson?.FileReferences) {
      rewriteCubism3(modifiedModelJson.FileReferences);
    } else {
      rewriteCubism2();
    }

    const modelJsonStr = JSON.stringify(modifiedModelJson);
    const modelJsonBase64 = btoa(unescape(encodeURIComponent(modelJsonStr)));
    return `data:application/json;base64,${modelJsonBase64}`;
  },

  async renderTo(characterId, containerElement, forceReload = false) {
    const prevRender = this.renderLocks.get(characterId) || Promise.resolve();
    let releaseRender;
    const currentRender = new Promise((resolve) => {
      releaseRender = resolve;
    });
    this.renderLocks.set(characterId, prevRender.then(() => currentRender));
    await prevRender;

    try {
      if (!containerElement || !containerElement.isConnected) {
        console.warn(`[${SCRIPT_NAME}] Live2DManager: renderTo 跳过，容器不可用 (${characterId})`);
        return false;
      }

      if (containerElement && containerElement.isConnected) {
        let model = this.models.get(characterId);
        if (!model) {
          model = await this.loadModel(characterId, false);
          if (!model) return false;
        }

        const targetEl = containerElement;
        const slotEl = targetEl?.closest?.('.gal-char-slot');
        const gameContentEl = targetEl?.closest?.('.gal-game-content');
        const isStory = !!(slotEl && gameContentEl);

        if (isStory) {
          const slot = slotEl.classList.contains('slot-right')
            ? 'right'
            : slotEl.classList.contains('slot-left')
              ? 'left'
              : 'left';

          _Live2DStageRef.focusCharacterId = null;
          if (!_Live2DStageRef.ensureMounted(gameContentEl, { mode: 'story' })) return false;
          if (forceReload) {
            _Live2DStageRef.detach(characterId);
          }
          _Live2DStageRef.attach(characterId, model, slot, { entering: false });
        } else {
          _Live2DStageRef.focusCharacterId = characterId;
          if (!_Live2DStageRef.ensureMounted(targetEl, { mode: 'single' })) return false;

          for (const [id, inst] of _Live2DStageRef.instances) {
            if (!inst?.model) continue;
            inst.model.visible = id === characterId;
          }

          if (forceReload) {
            _Live2DStageRef.detach(characterId);
          }
          _Live2DStageRef.attach(characterId, model, 'left', { entering: false });
        }

        this._markModelActive(characterId);
        return true;
      }

      let model = this.models.get(characterId);
      const existingContainer = this.containers.get(characterId);

      if (!forceReload && model && existingContainer && existingContainer.containerElement === containerElement) {
        this._debugLog(`[${SCRIPT_NAME}] Live2DManager: 复用现有渲染 ${characterId}`);
        return true;
      }

      const needReload = forceReload || (model && existingContainer && existingContainer.containerElement !== containerElement);
      if (needReload) {
        this.cleanup(characterId);
        model = null;
      }

      if (!model) {
        model = await this.loadModel(characterId, false);
        if (!model) return false;
      }

      const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
      const PIXI = _topWindow.PIXI;

      const config = getLive2DConfig(characterId);
      const qualityConfig = config.quality || {};
      let containerWidth = containerElement.clientWidth || containerElement.offsetWidth;
      let containerHeight = containerElement.clientHeight || containerElement.offsetHeight;

      if (containerWidth <= 0 || containerHeight <= 0) {
        console.warn(`[${SCRIPT_NAME}] Live2DManager: 容器尺寸无效 (${containerWidth}x${containerHeight})，使用默认值`);
        containerWidth = 400;
        containerHeight = 600;
      }

      const transformConfig = this._normalizeTransform(characterId, config.transform || {}, containerWidth, containerHeight);

      let dpr;
      if (qualityConfig.devicePixelRatio === 'auto' || !qualityConfig.devicePixelRatio) {
        dpr = _topWindow.devicePixelRatio || 1;
      } else {
        dpr = parseFloat(qualityConfig.devicePixelRatio) || 1;
      }
      dpr *= (qualityConfig.textureResolution || 1.0);

      this._debugLog(`[${SCRIPT_NAME}] Live2DManager: 容器尺寸 ${containerWidth}x${containerHeight}, DPR: ${dpr}`);

      const canvas = _topWindow.document.createElement('canvas');
      const renderWidth = containerWidth;
      const renderHeight = containerHeight;
      canvas.width = Math.max(1, Math.floor(renderWidth * dpr));
      canvas.height = Math.max(1, Math.floor(renderHeight * dpr));

      const glContext =
        canvas.getContext('webgl2', {
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true,
          premultipliedAlpha: true,
        }) ||
        canvas.getContext('webgl', {
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true,
          premultipliedAlpha: true,
        });

      if (!glContext) {
        console.error(`[${SCRIPT_NAME}] Live2DManager: WebGL 不可用，无法渲染 Live2D`);
        try {
          if (_showToastRef) _showToastRef('WebGL 不可用，Live2D 无法渲染（请开启硬件加速）');
        } catch {}
        return false;
      }
      canvas.style.cssText = `width: ${renderWidth}px; height: ${renderHeight}px; position: absolute; top: 0; left: 0; pointer-events: none;`;
      containerElement.style.position = 'relative';
      containerElement.style.overflow = 'hidden';
      containerElement.appendChild(canvas);

      const app = new PIXI.Application({
        view: canvas,
        context: glContext,
        backgroundAlpha: 0,
        autoStart: false,
        width: renderWidth,
        height: renderHeight,
        resolution: dpr,
        autoDensity: true,
        antialias: true,
        preserveDrawingBuffer: true,
      });

      if (!app.renderer?.gl) {
        console.error(`[${SCRIPT_NAME}] Live2DManager: WebGL Renderer 初始化失败`, app.renderer);
        try {
          app.destroy(true);
        } catch {}
        try {
          if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        } catch {}
        try {
          if (_showToastRef) _showToastRef('WebGL Renderer 初始化失败，Live2D 无法渲染');
        } catch {}
        return false;
      }

      model.scale.set(1);
      const modelWidth = model.width || model.internalModel?.width || 500;
      const modelHeight = model.height || model.internalModel?.height || 800;
      const safePadding = Math.min(0.08, Math.max(0.0, Number(config?.safePadding) || 0.03));
      const scaleBaseMode = normalizeLive2DScaleBase(transformConfig.scaleBase);
      const overlayRefHeight = getOverlayReferenceHeight(containerElement, renderHeight);
      const refHeight = scaleBaseMode === 'height' ? overlayRefHeight : renderHeight;
      const baseScale = calculateLive2DBaseScale(
        renderWidth,
        refHeight,
        modelWidth,
        modelHeight,
        safePadding,
        scaleBaseMode,
      );

      const userScale = transformConfig.scale || 1.0;
      const finalScale = baseScale * userScale;

      this._debugLog(`[${SCRIPT_NAME}] Live2DManager: 模型尺寸 ${modelWidth}x${modelHeight}, 基础缩放: ${baseScale}, 用户缩放: ${userScale}, 最终缩放: ${finalScale}`);

      model.scale.set(finalScale);
      model.anchor.set(0.5, 0.5);

      const offsetX = transformConfig.offsetX || 0;
      const offsetY = transformConfig.offsetY || 0;
      model.x = renderWidth / 2 + offsetX;
      model.y = renderHeight / 2 + offsetY;
      model.visible = true;
      model.alpha = 1;

      app.stage.addChild(model);

      app.renderer.render(app.stage);
      if (!app.ticker?.started) {
        app.start();
      }

      this.containers.set(characterId, {
        app,
        canvas,
        baseScale: baseScale,
        containerElement,
        width: containerWidth,
        height: containerHeight,
        renderWidth,
        renderHeight,
      });

      this._debugLog(
        `[${SCRIPT_NAME}] Live2DManager: 渲染 ${characterId} 完成 (offsetX=${offsetX}, offsetY=${offsetY}, scale=${userScale})`,
      );
      return true;
    } finally {
      if (typeof releaseRender === 'function') {
        releaseRender();
      }
    }
  },

  setZoom(characterId, zoomFactor) {
    const model = this.models.get(characterId);
    const container = this.containers.get(characterId);
    if (!model || !container) return;

    const baseScale = container.baseScale || 1;
    model.scale.set(baseScale * zoomFactor);
  },

  applyTransformConfig(characterId) {
    if (!this.models.has(characterId)) return false;
    const ok = _Live2DStageRef.applyTransform(characterId);
    if (ok) {
      this._debugLog(`[${SCRIPT_NAME}] Live2DManager: 应用变换配置 ${characterId}`);
    }
    return ok;
  },

  setOffset(characterId, offsetX, offsetY) {
    const model = this.models.get(characterId);
    const container = this.containers.get(characterId);
    if (!model || !container) return;

    const renderWidth = container.renderWidth || container.width || 400;
    const renderHeight = container.renderHeight || container.height || 600;
    const maxOffsetX = Math.max(40, renderWidth * 0.45);
    const maxOffsetY = Math.max(40, renderHeight * 0.45);
    const safeOffsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, Number(offsetX) || 0));
    const safeOffsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, Number(offsetY) || 0));
    const isStage = !!container?.canvas?.classList?.contains?.('gal-live2d-stage-canvas');
    model.x = renderWidth / 2 + safeOffsetX;
    model.y = (isStage ? renderHeight : renderHeight / 2) + safeOffsetY;

    if (container.app) {
      container.app.renderer.render(container.app.stage);
    }
  },

  setScale(characterId, scale) {
    const model = this.models.get(characterId);
    const container = this.containers.get(characterId);
    if (!model || !container) return;

    const baseScale = container.baseScale || 1;
    model.scale.set(baseScale * scale);

    if (container.app) {
      container.app.renderer.render(container.app.stage);
    }
  },

  setExpression(characterId, expressionName) {
    const model = this.models.get(characterId);
    if (!model) return;

    const mapped = this._matchExpression(model, expressionName);
    if (mapped) {
      try {
        model.expression(mapped);
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] Live2DManager: 设置表情失败:`, e);
      }
    }
  },

  playMotion(characterId, motionGroup, index = 0) {
    const model = this.models.get(characterId);
    if (!model) return;

    try {
      model.motion(motionGroup, index);
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] Live2DManager: 播放动作失败:`, e);
    }
  },

  setFocus(characterId, isSpeaking) {
    const model = this.models.get(characterId);
    const container = this.containers.get(characterId);
    if (!model) return;

    if (container?.canvas?.classList?.contains?.('gal-live2d-stage-canvas')) {
      _Live2DStageRef.setFocus(characterId, isSpeaking);
      _Live2DStageRef.applyTransform(characterId);
      return;
    }

    model.alpha = isSpeaking ? 1 : 0.7;

    if (container?.app) {
      try {
        if (!container.app.ticker?.started) {
          container.app.start();
        }
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] Live2DManager: setFocus 渲染状态切换失败`, e);
      }
    }
  },

  setMouthOpen(characterId, value) {
    const model = this.models.get(characterId);
    if (!model?.internalModel?.coreModel) return false;

    const coreModel = model.internalModel.coreModel;
    const clampedValue = Math.max(0, Math.min(1, value));

    const paramNames = [
      'ParamMouthOpenY',
      'PARAM_MOUTH_OPEN_Y',
      'ParamMouthOpen',
      'ParamA',
      'Param_Mouth_Open',
      'mouth_open',
    ];

    for (const paramName of paramNames) {
      try {
        const paramIndex = coreModel.getParameterIndex(paramName);
        if (paramIndex >= 0) {
          coreModel.setParameterValueById(paramName, clampedValue);
          return true;
        }
      } catch (e) { continue; }
    }
    return false;
  },

  getMouthParams(characterId) {
    const model = this.models.get(characterId);
    if (!model?.internalModel?.coreModel) return [];

    const coreModel = model.internalModel.coreModel;
    const params = [];
    try {
      const count = coreModel.getParameterCount();
      for (let i = 0; i < count; i++) {
        const id = coreModel.getParameterId(i);
        if (id.toLowerCase().includes('mouth') ||
            id.toLowerCase().includes('lip') ||
            id === 'ParamA') {
          params.push(id);
        }
      }
    } catch (e) {}
    return params;
  },

  _matchExpression(model, targetExpression) {
    const expressionMap = {
      '默认': ['normal', 'default', 'neutral', 'idle'],
      '微笑': ['smile', 'happy', 'joy', 'glad'],
      '生气': ['angry', 'anger', 'mad', 'rage'],
      '难过': ['sad', 'sorrow', 'cry', 'upset'],
      '惊讶': ['surprised', 'shock', 'amazed', 'wow'],
      '嘲讽': ['smirk', 'mock', 'sneer', 'tease'],
      '害羞': ['shy', 'blush', 'embarrassed', 'bashful'],
      '思考': ['think', 'ponder', 'confused', 'wonder'],
      '大笑': ['laugh', 'lol', 'haha', 'giggle'],
      '搞怪': ['playful', 'wink', 'silly', 'fun'],
    };

    const candidates = expressionMap[targetExpression] || [targetExpression.toLowerCase()];

    try {
      const expressionManager = model.internalModel?.motionManager?.expressionManager;
      if (!expressionManager?.definitions) return null;

      const definitions = expressionManager.definitions;
      for (const candidate of candidates) {
        for (const def of definitions) {
          const name = (def.Name || def.name || '').toLowerCase();
          if (name.includes(candidate) || candidate.includes(name)) {
            return def.Name || def.name;
          }
        }
      }

      return definitions[0]?.Name || definitions[0]?.name || null;
    } catch (e) {
      return null;
    }
  },

  _cleanupContainer(characterId) {
    const container = this.containers.get(characterId);
    if (container) {
      if (container?.canvas?.classList?.contains?.('gal-live2d-stage-canvas')) {
        _Live2DStageRef.detach(characterId);
        return;
      }
      try {
        container.app.destroy(true);
        if (container.canvas.parentNode) {
          container.canvas.parentNode.removeChild(container.canvas);
        }
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] Live2DManager: 清理容器失败:`, e);
      }
      this.containers.delete(characterId);
    }
  },

  cleanupContainer(characterId) {
    this._cleanupContainer(characterId);
  },

  cleanup(characterId) {
    this._cleanupContainer(characterId);
    this._destroyModel(characterId, 'cleanup');
  },

  cleanupAll() {
    for (const charId of Array.from(this.models.keys())) {
      this.cleanup(charId);
    }
  },

  enableInteraction(characterId) {
    const model = this.models.get(characterId);
    const container = this.containers.get(characterId);
    if (!model || !container) {
      console.warn(`[Live2DManager] enableInteraction 失败: 模型或容器不存在`, { model: !!model, container: !!container });
      return false;
    }

    model.interactive = true;
    model.buttonMode = true;
    model.cursor = 'move';

    if (container.app && container.app.stage) {
      container.app.stage.interactive = true;
      container.app.stage.hitArea = container.app.screen;
    }

    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
    const PIXI = _topWindow.PIXI;
    if (PIXI.filters && PIXI.filters.OutlineFilter) {
      model.filters = [new PIXI.filters.OutlineFilter(2, 0x00d2ff)];
    }

    if (container.canvas) {
      container.canvas.style.pointerEvents = 'auto';
      container.canvas.style.cursor = 'move';
    }

    this._debugLog(`[Live2DManager] enableInteraction 成功: ${characterId}`);
    return true;
  },

  disableInteraction(characterId) {
    const model = this.models.get(characterId);
    const container = this.containers.get(characterId);
    if (!model) return;

    model.interactive = false;
    model.buttonMode = false;
    model.cursor = 'default';
    model.filters = [];

    if (container && container.canvas) {
      container.canvas.style.pointerEvents = 'none';
      container.canvas.style.cursor = 'default';
    }
  },

  getCurrentTransform(characterId) {
    const model = this.models.get(characterId);
    const container = this.containers.get(characterId);
    if (!model || !container) return null;

    const renderWidth = container.renderWidth || container.width || 400;
    const renderHeight = container.renderHeight || container.height || 600;
    const baseScale = container.baseScale || 1;
    const isStage = !!container?.canvas?.classList?.contains?.('gal-live2d-stage-canvas');

    return {
      offsetX: model.x - renderWidth / 2,
      offsetY: model.y - (isStage ? renderHeight : renderHeight / 2),
      scale: model.scale.x / baseScale
    };
  }
};
