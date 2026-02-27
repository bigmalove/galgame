import { SCRIPT_NAME } from '../core/constants.js';
import { Live2DLoader } from './loader.js';
import { getLive2DModel } from '../db/live2d-models.js';
import { getLive2DConfig, updateLive2DConfig, normalizeLive2DScaleBase, calculateLive2DBaseScale, getOverlayReferenceHeight } from './render-mode.js';
import { LIVE2D_RUNTIME_TYPES, resolveLive2DRuntime } from './runtime-router.js';
import { getBuiltinExpressionByKey, getBuiltinMotionByKey } from './builtin-expression-motion.js';

const LIVE2D_TICKER_GUARD_KEY = '__galgameLive2dTickerRef__';

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
  modelRuntimeInfo: new Map(), // characterId -> { runtimeType, cubismVersion }
  modelSourceData: new Map(), // characterId -> stored model payload from DB
  lipSyncStates: new Map(), // characterId -> lip sync runtime state
  builtinMotionPlayers: new Map(), // characterId -> { rafId, stopped }
  builtinMotionFrameStates: new Map(), // characterId -> { params, weight }
  storedModelParamIds: new Map(), // characterId -> string[]
  cachedDetachedAt: new Map(), // characterId -> timestamp (宸查€€鍦虹紦瀛?
  coreParamIndexCache: new WeakMap(), // coreModel -> Map<normalizedParamId, index>
  maxDetachedCache: 3,
  xhrBlobUrlSupport: null, // null=unknown, boolean=supported
  xhrBlobUrlSupportPromise: null,
  hasLoggedBlobUrlDisabled: false,
  registeredTickerClasses: new WeakSet(),
  isReady: false,
  debug: false,
  preferCubism5Runtime: true,

  _debugLog(...args) {
    if (!this.debug) return;
    console.log(...args);
  },

  _getLipSyncState(characterId) {
    const key = String(characterId || '').trim();
    if (!key) return null;
    let state = this.lipSyncStates.get(key);
    if (!state) {
      state = {
        mouthParamCore: null,
        mouthParamIds: [],
        mouthParamIndexes: [],
        mouthParamRangeMins: [],
        mouthParamRangeMaxs: [],
        mouthParamWarned: false,
        mouthCurrentValue: 0,
        lipSyncActive: false,
        inModelUpdate: false,
        writeMaskCore: null,
        writeMaskRestore: null,
        updateHookModel: null,
        updateHookRestore: null,
      };
      this.lipSyncStates.set(key, state);
    }
    return state;
  },

  _destroyLipSyncState(characterId) {
    const key = String(characterId || '').trim();
    if (!key) return;
    const state = this.lipSyncStates.get(key);
    if (!state) return;

    state.lipSyncActive = false;
    state.inModelUpdate = false;

    if (state.writeMaskRestore) {
      try {
        state.writeMaskRestore();
      } catch (e) {}
    }
    if (state.updateHookRestore) {
      try {
        state.updateHookRestore();
      } catch (e) {}
    }
    this.lipSyncStates.delete(key);
  },

  _markModelActive(characterId) {
    this.cachedDetachedAt.delete(characterId);
  },

  _registerTickerForLive2DModelClass(Live2DModelClass) {
    if (!Live2DModelClass || typeof Live2DModelClass.registerTicker !== 'function') return false;

    try {
      if (this.registeredTickerClasses.has(Live2DModelClass)) return true;
      const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
      Live2DModelClass.registerTicker(_topWindow.PIXI.Ticker);
      this.registeredTickerClasses.add(Live2DModelClass);
      _topWindow[LIVE2D_TICKER_GUARD_KEY] = _topWindow.PIXI.Ticker;
      return true;
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] Live2DManager: registerTicker failed`, e);
      return false;
    }
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

  _setModelRuntimeInfo(characterId, runtimeInfo = null) {
    const resolved = resolveLive2DRuntime(runtimeInfo);
    const merged = {
      ...(runtimeInfo && typeof runtimeInfo === 'object' ? runtimeInfo : null),
      ...resolved,
    };
    this.modelRuntimeInfo.set(characterId, merged);
    return merged;
  },

  _resolveCharacterRuntime(characterId, modelData = null) {
    const previous = this.modelRuntimeInfo.get(characterId) || {};
    const input = modelData && typeof modelData === 'object'
      ? { ...previous, ...modelData }
      : previous;
    return this._setModelRuntimeInfo(characterId, input);
  },

  _getCharacterRuntime(characterId) {
    return this.modelRuntimeInfo.get(characterId) || {
      runtimeType: LIVE2D_RUNTIME_TYPES.LEGACY,
      cubismVersion: null,
    };
  },

  getCharacterRuntime(characterId) {
    return this._getCharacterRuntime(characterId);
  },

  async _ensureRuntimeDependencies(characterId, runtimeInfo = null) {
    const runtimeInput = runtimeInfo || this._getCharacterRuntime(characterId);
    let resolvedRuntime = this._setModelRuntimeInfo(characterId, runtimeInput);
    const requiredMocVersion = Number(resolvedRuntime?.moc3Version || 0) || 0;
    const requiredLatestVersion = requiredMocVersion >= 5 ? requiredMocVersion : 5;

    if (resolvedRuntime.runtimeType === LIVE2D_RUNTIME_TYPES.CUBISM5) {
      const coreLoaded = await Live2DLoader.ensureCubism5Core(requiredLatestVersion);
      if (!coreLoaded) {
        throw new Error(`Cubism 5 Core load failed for ${characterId}`);
      }

      const runtimeLoaded = await Live2DLoader.ensureCubism5Runtime();
      if (!runtimeLoaded) {
        throw new Error(`Cubism 5 runtime load failed for ${characterId}`);
      }
      Live2DLoader.activateRuntime(LIVE2D_RUNTIME_TYPES.CUBISM5);
      return this._setModelRuntimeInfo(characterId, resolvedRuntime);
    }

    if (requiredMocVersion >= 5) {
      const coreLoaded = await Live2DLoader.ensureCubism5Core(requiredLatestVersion);
      if (!coreLoaded) {
        throw new Error(`Cubism 5 Core load failed for legacy runtime (${characterId})`);
      }
      Live2DLoader.activateRuntime(LIVE2D_RUNTIME_TYPES.LEGACY);
      this._debugLog(
        `[${SCRIPT_NAME}] Live2DManager: legacy runtime with Cubism5 core (${characterId}, moc3=${requiredMocVersion})`,
      );
      return this._setModelRuntimeInfo(characterId, {
        ...resolvedRuntime,
        runtimeType: LIVE2D_RUNTIME_TYPES.LEGACY,
        cubismVersion: resolvedRuntime.cubismVersion ?? 5,
      });
    }

    const legacyCoreLoaded = await Live2DLoader.ensureLegacyCore();
    if (!legacyCoreLoaded) {
      const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
      const latestMocVersion = Number(_topWindow?.Live2DCubismCore?.Version?.csmGetLatestMocVersion?.() || 0) || 0;
      if (latestMocVersion >= 5) {
        const forcedRuntime = this._setModelRuntimeInfo(characterId, {
          ...resolvedRuntime,
          runtimeType: LIVE2D_RUNTIME_TYPES.CUBISM5,
          cubismVersion: 5,
        });
        console.warn(`[${SCRIPT_NAME}] Live2DManager: legacy core unavailable, fallback to Cubism5 runtime (${characterId})`, {
          latestMocVersion,
          legacyCoreSource: Live2DLoader.legacyCoreSource || null,
          cubism5CoreSource: Live2DLoader.cubism5CoreSource || null,
        });
        const coreLoaded = await Live2DLoader.ensureCubism5Core(requiredLatestVersion);
        if (!coreLoaded) {
          throw new Error(`Cubism 5 Core fallback load failed for ${characterId}`);
        }
        const runtimeLoaded = await Live2DLoader.ensureCubism5Runtime();
        if (!runtimeLoaded) {
          throw new Error(`Cubism 5 runtime fallback load failed for ${characterId}`);
        }
        Live2DLoader.activateRuntime(LIVE2D_RUNTIME_TYPES.CUBISM5);
        return forcedRuntime;
      }
      throw new Error(`Cubism legacy core load failed for ${characterId}`);
    }
    Live2DLoader.activateRuntime(LIVE2D_RUNTIME_TYPES.LEGACY);
    return this._setModelRuntimeInfo(characterId, resolvedRuntime);
  },

  _toArrayBuffer(input) {
    if (!input) return null;
    if (input instanceof ArrayBuffer) return input;
    if (ArrayBuffer.isView(input)) {
      return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
    }
    return null;
  },

  _normalizeMocVersion(rawMocVersion) {
    const value = Number(rawMocVersion || 0);
    if (!Number.isFinite(value)) return null;
    if (value >= 5) return 5;
    if (value >= 1 && value <= 4) return 4;
    return null;
  },

  _readMoc3HeaderVersion(moc3Data) {
    const moc3Buffer = this._toArrayBuffer(moc3Data);
    if (!moc3Buffer || moc3Buffer.byteLength < 8) return null;

    try {
      const header = new Uint8Array(moc3Buffer, 0, 4);
      const signature = String.fromCharCode(...header);
      if (signature !== 'MOC3') return null;
      const view = new DataView(moc3Buffer);
      const versionLE = Number(view.getUint32(4, true) || 0) || null;
      return versionLE;
    } catch (e) {
      return null;
    }
  },

  _detectCubismVersionFromMoc3Buffer(moc3Data) {
    const moc3Buffer = this._toArrayBuffer(moc3Data);
    if (!moc3Buffer) return null;

    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
    const core = _topWindow?.Live2DCubismCore;
    const Moc = core?.Moc;
    const Version = core?.Version;
    if (typeof Moc?.fromArrayBuffer !== 'function' || typeof Version?.csmGetMocVersion !== 'function') {
      return null;
    }

    let mocRef = null;
    try {
      mocRef = Moc.fromArrayBuffer(moc3Buffer);
      if (!mocRef) return null;

      const rawMocVersion = Number(Version.csmGetMocVersion(mocRef, moc3Buffer) || 0) || 0;
      const latestMocVersion = Number(Version?.csmGetLatestMocVersion?.() || 0) || 0;
      const normalized = this._normalizeMocVersion(rawMocVersion);
      console.log(
        `[${SCRIPT_NAME}] Live2DManager: moc3 version probe raw=${rawMocVersion}, latest=${latestMocVersion}, normalized=${normalized}`,
      );
      if (latestMocVersion > 0 && rawMocVersion > latestMocVersion) {
        return null;
      }
      return normalized;
    } catch (e) {
      return null;
    } finally {
      try {
        if (mocRef && typeof mocRef._release === 'function') mocRef._release();
        else if (mocRef && typeof mocRef.release === 'function') mocRef.release();
      } catch (e) {}
    }
  },

  async _detectRuntimeFromMoc3(characterId, moc3Data, runtimeInfo = null) {
    const resolvedRuntime = resolveLive2DRuntime(runtimeInfo || this._getCharacterRuntime(characterId));
    if (this.preferCubism5Runtime && (resolvedRuntime.runtimeType === LIVE2D_RUNTIME_TYPES.CUBISM5 || Number(resolvedRuntime.cubismVersion || 0) >= 5)) {
      this.modelRuntimeInfo.set(characterId, resolvedRuntime);
      return resolvedRuntime;
    }

    const moc3Buffer = this._toArrayBuffer(moc3Data);
    if (!moc3Buffer) {
      this.modelRuntimeInfo.set(characterId, resolvedRuntime);
      return resolvedRuntime;
    }

    const headerVersionRaw = this._readMoc3HeaderVersion(moc3Buffer);
    const headerVersion = this._normalizeMocVersion(headerVersionRaw);
    const runtimeWithHeader = {
      ...resolvedRuntime,
      moc3Version: headerVersionRaw ?? resolvedRuntime.moc3Version ?? null,
    };

    try {
      const requiredLatestVersion = headerVersionRaw >= 5 ? headerVersionRaw : 5;
      await Live2DLoader.ensureCubism5Core(requiredLatestVersion);
    } catch (e) {}

    const mocVersion = this._detectCubismVersionFromMoc3Buffer(moc3Buffer);
    const resolvedVersion = mocVersion ?? headerVersion ?? null;
    if (resolvedVersion >= 5) {
      if (this.preferCubism5Runtime) {
        this._debugLog(`[${SCRIPT_NAME}] Live2DManager: moc3 探测为 Cubism 5 (${characterId})`);
        return this._setModelRuntimeInfo(characterId, {
          ...runtimeWithHeader,
          cubismVersion: 5,
          runtimeType: LIVE2D_RUNTIME_TYPES.CUBISM5,
        });
      }
      this._debugLog(`[${SCRIPT_NAME}] Live2DManager: moc3>=5, prefer legacy runtime (${characterId})`);
      return this._setModelRuntimeInfo(characterId, {
        ...runtimeWithHeader,
        cubismVersion: 5,
        runtimeType: LIVE2D_RUNTIME_TYPES.LEGACY,
      });
    }

    return this._setModelRuntimeInfo(characterId, {
      ...runtimeWithHeader,
      cubismVersion: resolvedRuntime.cubismVersion ?? resolvedVersion ?? null,
    });
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

  _patchModelRenderViewportGuard(model, characterId) {
    if (!model || model.__galgameViewportGuardPatched) return false;
    if (typeof model.render !== 'function') return false;

    const originalRender = model.render;
    const ensureModelUpdated = (modelRef) => {
      if (!modelRef?.internalModel) return;
      try {
        const delta = Number(modelRef.deltaTime);
        if (!Number.isFinite(delta) || delta <= 0) {
          if (typeof modelRef.internalModel.update === 'function') {
            const nextNow = Math.max(Number(modelRef.elapsedTime) || 0, 0) + 16.7;
            modelRef.internalModel.update(16.7, nextNow);
          } else if (typeof modelRef.update === 'function') {
            modelRef.update(16.7);
          } else {
            modelRef.deltaTime = 16.7;
            modelRef.elapsedTime = Math.max(Number(modelRef.elapsedTime) || 0, 16.7);
          }
        }
      } catch (e) {}
    };

    const patchInternalDraw = (modelRef) => {
      const internalModel = modelRef?.internalModel;
      if (!internalModel || internalModel.__galgameDrawViewportGuardPatched) return false;
      if (typeof internalModel.draw !== 'function') return false;

      const originalDraw = internalModel.draw;
      internalModel.draw = function patchedInternalDraw(gl) {
        const viewport = this?.viewport;
        const invalidViewport =
          !Array.isArray(viewport) ||
          viewport.length < 4 ||
          viewport.some((v) => !Number.isFinite(Number(v)));

        if (invalidViewport) {
          let glViewport = null;
          try {
            glViewport = gl?.getParameter?.(gl?.VIEWPORT);
          } catch (e) {}
          if (glViewport && glViewport.length >= 4) {
            this.viewport = [
              Number(glViewport[0]) || 0,
              Number(glViewport[1]) || 0,
              Math.max(1, Math.floor(Number(glViewport[2]) || 1)),
              Math.max(1, Math.floor(Number(glViewport[3]) || 1)),
            ];
          } else {
            const width = Math.max(1, Math.floor(Number(gl?.drawingBufferWidth) || 1));
            const height = Math.max(1, Math.floor(Number(gl?.drawingBufferHeight) || 1));
            this.viewport = [0, 0, width, height];
          }
        }

        return originalDraw.call(this, gl);
      };
      internalModel.__galgameDrawViewportGuardPatched = true;
      return true;
    };

    const ensureViewport = (renderer, modelRef) => {
      const internalModel = modelRef?.internalModel;
      if (!internalModel) return;

      const viewport = internalModel.viewport;
      const invalidViewport =
        !Array.isArray(viewport) ||
        viewport.length < 4 ||
        viewport.some((v) => !Number.isFinite(Number(v)));
      if (!invalidViewport) return;

      const fromTarget = renderer?.renderTarget?.viewport;
      const width = Math.max(
        1,
        Math.floor(
          Number(fromTarget?.width) ||
            Number(renderer?.width) ||
            Number(renderer?.screen?.width) ||
            Number(renderer?.view?.width) ||
            Number(renderer?.canvas?.width) ||
            1,
        ),
      );
      const height = Math.max(
        1,
        Math.floor(
          Number(fromTarget?.height) ||
            Number(renderer?.height) ||
            Number(renderer?.screen?.height) ||
            Number(renderer?.view?.height) ||
            Number(renderer?.canvas?.height) ||
            1,
        ),
      );
      internalModel.viewport = [0, 0, width, height];
    };

    patchInternalDraw(model);
    model.render = function patchedRender(renderer) {
      patchInternalDraw(this);
      ensureModelUpdated(this);
      ensureViewport(renderer, this);
      try {
        return originalRender.call(this, renderer);
      } catch (e) {
        const message = String(e?.message || e || '');
        const looksLikeViewportCrash =
          message.includes("reading '0'") ||
          message.includes('reading "0"');
        if (!looksLikeViewportCrash) {
          throw e;
        }
        ensureModelUpdated(this);
        ensureViewport(renderer, this);
        try {
          const gl = renderer?.gl;
          const internalModel = this?.internalModel;
          if (gl && internalModel?.renderer?.setRenderState) {
            const fallbackViewport = Array.isArray(internalModel.viewport) && internalModel.viewport.length >= 4
              ? internalModel.viewport
              : [0, 0, Math.max(1, Number(gl?.drawingBufferWidth) || 1), Math.max(1, Number(gl?.drawingBufferHeight) || 1)];
            internalModel.renderer.setRenderState(gl.getParameter(gl.FRAMEBUFFER_BINDING), fallbackViewport);
          }
        } catch (e2) {}
        return originalRender.call(this, renderer);
      }
    };
    model.__galgameViewportGuardPatched = true;
    this._debugLog(`[${SCRIPT_NAME}] Live2DManager: render viewport guard patched (${characterId})`);
    return true;
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
      this.stopBuiltinMotion(characterId);
      this.builtinMotionFrameStates.delete(characterId);
      this._destroyLipSyncState(characterId);
      this.cachedDetachedAt.delete(characterId);
      this.containers.delete(characterId);
      this.modelRuntimeInfo.delete(characterId);
      this.modelSourceData.delete(characterId);
      this.storedModelParamIds.delete(characterId);
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
    this.modelRuntimeInfo.delete(characterId);
    this.stopBuiltinMotion(characterId);
    this.builtinMotionFrameStates.delete(characterId);
    this.modelSourceData.delete(characterId);
    this.storedModelParamIds.delete(characterId);
    this._revokeModelBlobUrls(characterId);
    this._destroyLipSyncState(characterId);
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
    this.stopBuiltinMotion(characterId);
    this.builtinMotionFrameStates.delete(characterId);
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
      this._registerTickerForLive2DModelClass(Live2DModel);

      this.isReady = true;
      this._debugLog(`[${SCRIPT_NAME}] Live2DManager 初始化完成`);
      return true;
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] Live2DManager 初始化失败`, e);
      return false;
    }
  },

  async loadModel(characterId, forceReload = false) {
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
    this.modelSourceData.set(characterId, modelData);
    this.storedModelParamIds.delete(characterId);
    let modelRuntime = this._resolveCharacterRuntime(characterId, modelData);
    if (modelData?.moc3) {
      modelRuntime = await this._detectRuntimeFromMoc3(characterId, modelData.moc3, modelRuntime);
    }

    if (!this.isReady) {
      const ready = await this.init();
      if (!ready) return null;
    }

    const isRemote = this._isRemoteModelData(modelData);
    const remoteModelUrl = isRemote ? this._normalizeRemoteUrl(modelData.modelUrl.trim()) : '';

    const loadTask = (async () => {
      let resolvedRuntime = modelRuntime;
      this._revokeModelBlobUrls(characterId);
      const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;

      const loadFromUrl = async (modelUrl) => {
        Live2DLoader._patchPixiUrlResolve?.(_topWindow);
        const activeRuntimeNamespace = _topWindow?.PIXI?.live2d || Live2DLoader.getRuntimeNamespace?.(resolvedRuntime.runtimeType);
        Live2DLoader._patchModelSettingsResolveURL?.(activeRuntimeNamespace, `runtime-active:${resolvedRuntime.runtimeType}`);
        const patchedXhrLoader = Live2DLoader._patchXhrLoader?.(activeRuntimeNamespace, `runtime-active:${resolvedRuntime.runtimeType}`);
        console.log(`[${SCRIPT_NAME}] Live2DManager: runtime patch state ${characterId}`, {
          runtimeType: resolvedRuntime.runtimeType,
          pixiUrlResolvePatched: !!Live2DLoader.pixiUrlResolvePatched,
          patchedModelSettings: !!activeRuntimeNamespace?.ModelSettings?.prototype?.__galgameResolveUrlPatched,
          patchedXhrLoader: !!patchedXhrLoader,
        });

        if (modelData?.moc3) {
          const mocBuffer = this._toArrayBuffer(modelData.moc3);
          if (mocBuffer) {
            const header = new Uint8Array(mocBuffer, 0, Math.min(4, mocBuffer.byteLength));
            const signature = String.fromCharCode(...header);
            let versionLE = null;
            let versionBE = null;
            if (mocBuffer.byteLength >= 8) {
              const view = new DataView(mocBuffer);
              versionLE = view.getUint32(4, true);
              versionBE = view.getUint32(4, false);
            }
            console.log(`[${SCRIPT_NAME}] Live2DManager: moc3 signature preflight (${characterId})`, {
              signature,
              byteLength: mocBuffer.byteLength,
              versionLE,
              versionBE,
            });

            try {
              const core = _topWindow?.Live2DCubismCore;
              const Moc = core?.Moc;
              if (typeof Moc?.fromArrayBuffer === 'function') {
                const mocRef = Moc.fromArrayBuffer(mocBuffer);
                let mocVersion = null;
                if (mocRef && typeof core?.Version?.csmGetMocVersion === 'function') {
                  mocVersion = Number(core.Version.csmGetMocVersion(mocRef, mocBuffer) || 0) || null;
                }
                console.log(`[${SCRIPT_NAME}] Live2DManager: moc3 core preflight (${characterId})`, {
                  success: !!mocRef,
                  mocVersion,
                  coreLatest: Number(core?.Version?.csmGetLatestMocVersion?.() || 0) || 0,
                });
                try {
                  if (mocRef && typeof mocRef._release === 'function') mocRef._release();
                  else if (mocRef && typeof mocRef.release === 'function') mocRef.release();
                } catch (e) {}
              } else {
                console.warn(`[${SCRIPT_NAME}] Live2DManager: moc3 core preflight skipped (${characterId})`, {
                  hasCore: !!core,
                  hasMoc: !!Moc,
                });
              }
            } catch (e) {
              console.warn(`[${SCRIPT_NAME}] Live2DManager: moc3 core preflight failed (${characterId})`, e);
            }
          }
        }

        const Live2DModelClass = _topWindow?.PIXI?.live2d?.Live2DModel;
        if (!Live2DModelClass) {
          throw new Error('PIXI.live2d.Live2DModel is unavailable for current runtime');
        }
        this._registerTickerForLive2DModelClass(Live2DModelClass);

        const model = await Live2DModelClass.from(modelUrl, {
          // 避免在模型尚未挂载到带 WebGL renderer 的舞台前就触发 update，
          // 远程 Cubism2 模型在该阶段容易抛 createProgram undefined。
          autoUpdate: false,
          autoInteract: false,
        });
        this._patchModelRenderViewportGuard(model, characterId);

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

            const modelTextures = Array.isArray(model?.textures) ? model.textures : [];
            const internalTextures = Array.isArray(internalModel?.textures)
              ? internalModel.textures
              : (Array.isArray(internalModel?._textures) ? internalModel._textures : []);
            const textures = modelTextures.length > 0 ? modelTextures : internalTextures;
            const expectedTextureCount = (() => {
              const settingsTextures =
                internalModel?.settings?.textures ||
                internalModel?.modelSettings?.textures ||
                model?.modelSettings?.textures;
              if (Array.isArray(settingsTextures) && settingsTextures.length > 0) {
                return settingsTextures.length;
              }
              return textures.length;
            })();

            if (expectedTextureCount === 0) {
              this._debugLog(`[${SCRIPT_NAME}] Live2DManager: 模型无外部纹理，跳过等待`);
              resolve(true);
              return;
            }

            if (!textures.length) {
              if (retryCount % 5 === 0) {
                this._debugLog(`[${SCRIPT_NAME}] Live2DManager: 等待纹理对象创建... (0/${expectedTextureCount})`);
              }
              setTimeout(checkTextures, 100);
              return;
            }

            const isTextureReady = (tex) => {
              if (!tex) return false;
              if (tex.baseTexture) {
                return !!tex.baseTexture.valid;
              }
              if (typeof tex.valid === 'boolean') {
                return tex.valid;
              }
              return true;
            };
            const readyCount = textures.filter(isTextureReady).length;
            const allLoaded = readyCount >= expectedTextureCount;

            if (allLoaded) {
              this._debugLog(`[${SCRIPT_NAME}] Live2DManager: 纹理全部加载完成 (${readyCount}/${expectedTextureCount})`);
              resolve(true);
            } else {
              if (retryCount % 5 === 0) {
                this._debugLog(`[${SCRIPT_NAME}] Live2DManager: 等待纹理加载... (${readyCount}/${expectedTextureCount})`);
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
        const modelUrl = await this._buildRemoteModelDataUrl(characterId, remoteModelUrl);
        resolvedRuntime = this._getCharacterRuntime(characterId);
        return modelUrl;
      };

      let usedBlobForLocal = false;
      try {
        const modelUrl = isRemote
          ? await buildRemoteModelUrl()
          : await buildLocalModelUrl(true);
        if (!isRemote) {
          resolvedRuntime = this._getCharacterRuntime(characterId);
        }
        resolvedRuntime = await this._ensureRuntimeDependencies(characterId, resolvedRuntime);
        const latestMocVersion = Number(_topWindow?.Live2DCubismCore?.Version?.csmGetLatestMocVersion?.() || 0) || 0;
        const activeCoreSource =
          resolvedRuntime.runtimeType === LIVE2D_RUNTIME_TYPES.CUBISM5
            ? (Live2DLoader.cubism5CoreSource || null)
            : (Live2DLoader.legacyCoreSource || null);
        console.log(`[${SCRIPT_NAME}] Live2DManager: runtime route ${characterId}`, {
          runtimeType: resolvedRuntime.runtimeType,
          cubismVersion: resolvedRuntime.cubismVersion,
          coreSource: activeCoreSource,
          latestMocVersion,
          legacyCoreSource: Live2DLoader.legacyCoreSource || null,
          cubism5CoreSource: Live2DLoader.cubism5CoreSource || null,
          runtimeSource:
            resolvedRuntime.runtimeType === LIVE2D_RUNTIME_TYPES.CUBISM5
              ? (Live2DLoader.cubism5RuntimeSource || null)
              : null,
        });
        usedBlobForLocal = !isRemote && String(modelUrl || '').startsWith('blob:');

        const model = await loadFromUrl(modelUrl);
        this.models.set(characterId, model);
        this._markModelActive(characterId);
        if (resolvedRuntime.runtimeType === LIVE2D_RUNTIME_TYPES.LEGACY) {
          try {
            const coreModel = model?.internalModel?.coreModel;
            const apiProbe = {
              getParamIndex: typeof coreModel?.getParamIndex === 'function',
              getParamCount: typeof coreModel?.getParamCount === 'function',
              getParamId: typeof coreModel?.getParamId === 'function',
              getParamFloat: typeof coreModel?.getParamFloat === 'function',
              setParamFloat: typeof coreModel?.setParamFloat === 'function',
              addParamFloat: typeof coreModel?.addParamFloat === 'function',
              getParameterIndex: typeof coreModel?.getParameterIndex === 'function',
              getParameterCount: typeof coreModel?.getParameterCount === 'function',
              getParameterId: typeof coreModel?.getParameterId === 'function',
              setParameterValueByIndex: typeof coreModel?.setParameterValueByIndex === 'function',
              setParameterValueById: typeof coreModel?.setParameterValueById === 'function',
            };
            const paramIds = this.getCoreParamIds(characterId);
            const storedParamIds = this._getStoredModelParamIds(characterId);
            console.log(`[${SCRIPT_NAME}] Live2DManager: legacy core API probe ${characterId}`, {
              ...apiProbe,
              paramCount: paramIds.length,
              sampleParams: paramIds.slice(0, 20),
              storedParamCount: storedParamIds.length,
              storedSampleParams: storedParamIds.slice(0, 20),
            });
          } catch (e) {}
        }
        this._debugLog(`[${SCRIPT_NAME}] Live2DManager: 模型 ${characterId} 加载成功 (runtime=${resolvedRuntime.runtimeType})`);
        return model;
      } catch (e) {
        const errorMessage = String(e?.message || e || '');
        const errorStack = String(e?.stack || '');
        const looksLikeCoreParseError =
          /unknown error/i.test(errorMessage) ||
          /createcoremodel/i.test(errorStack) ||
          /be\.create/i.test(errorStack);
        if (looksLikeCoreParseError) {
          const latestMocVersion = Number(_topWindow?.Live2DCubismCore?.Version?.csmGetLatestMocVersion?.() || 0) || 0;
          console.warn(`[${SCRIPT_NAME}] Live2DManager: core parse failure context (${characterId})`, {
            runtimeType: resolvedRuntime.runtimeType,
            cubismVersion: resolvedRuntime.cubismVersion,
            latestMocVersion,
            legacyCoreSource: Live2DLoader.legacyCoreSource || null,
            cubism5CoreSource: Live2DLoader.cubism5CoreSource || null,
            cubism5RuntimeSource: Live2DLoader.cubism5RuntimeSource || null,
          });
        }

        const currentLatestMocVersion = Number(_topWindow?.Live2DCubismCore?.Version?.csmGetLatestMocVersion?.() || 0) || 0;
        const canRetryAsCubism5 =
          this.preferCubism5Runtime &&
          resolvedRuntime.runtimeType !== LIVE2D_RUNTIME_TYPES.CUBISM5 &&
          (
            Number(resolvedRuntime.cubismVersion || 0) >= 5 ||
            (
              currentLatestMocVersion >= 5 &&
              (!!modelData?.moc3 || (isRemote && resolvedRuntime.cubismVersion !== 2))
            )
          );

        const tryLegacyCoreSwapRetry = async (preferBlobForLocal) => {
          if (resolvedRuntime.runtimeType !== LIVE2D_RUNTIME_TYPES.LEGACY) return null;
          const previousCore = _topWindow?.Live2DCubismCore;
          const previousLegacySource = Live2DLoader.legacyCoreSource;
          try {
            const coreReady = await Live2DLoader.ensureCubism5Core();
            if (!coreReady) return null;
            Live2DLoader.activateRuntime(LIVE2D_RUNTIME_TYPES.LEGACY);
            console.warn(`[${SCRIPT_NAME}] Live2DManager: legacy core swap retry (${characterId})`, {
              legacyCoreSource: Live2DLoader.legacyCoreSource || null,
              cubism5CoreSource: Live2DLoader.cubism5CoreSource || null,
            });

            if (!isRemote) {
              this._revokeModelBlobUrls(characterId);
            }
            const retryUrl = isRemote
              ? await buildRemoteModelUrl()
              : await buildLocalModelUrl(preferBlobForLocal);
            const retryModel = await loadFromUrl(retryUrl);
            this.models.set(characterId, retryModel);
            this._markModelActive(characterId);
            this._debugLog(`[${SCRIPT_NAME}] Live2DManager: legacy core swap retry success (${characterId})`);
            return retryModel;
          } catch (swapError) {
            console.warn(`[${SCRIPT_NAME}] Live2DManager: legacy core swap retry failed (${characterId})`, swapError);
            return null;
          } finally {
            if (previousCore && _topWindow?.Live2DCubismCore !== previousCore) {
              Live2DLoader._setGlobalCubismCore?.(_topWindow, previousCore);
              Live2DLoader.legacyCoreSource = previousLegacySource || Live2DLoader.legacyCoreSource;
              Live2DLoader.activateRuntime(LIVE2D_RUNTIME_TYPES.LEGACY);
            }
          }
        };

        if (looksLikeCoreParseError && resolvedRuntime.runtimeType === LIVE2D_RUNTIME_TYPES.LEGACY) {
          const retryModel = await tryLegacyCoreSwapRetry(usedBlobForLocal);
          if (retryModel) return retryModel;
        }

        const tryForceCubism5Retry = async (preferBlobForLocal) => {
          try {
            let forcedRuntime = this._setModelRuntimeInfo(characterId, {
              ...resolvedRuntime,
              runtimeType: LIVE2D_RUNTIME_TYPES.CUBISM5,
              cubismVersion: 5,
            });
            forcedRuntime = await this._ensureRuntimeDependencies(characterId, forcedRuntime);
            const forcedLatestMocVersion = Number(_topWindow?.Live2DCubismCore?.Version?.csmGetLatestMocVersion?.() || 0) || 0;
            console.log(`[${SCRIPT_NAME}] Live2DManager: force Cubism5 retry route ${characterId}`, {
              runtimeType: forcedRuntime.runtimeType,
              cubismVersion: forcedRuntime.cubismVersion,
              latestMocVersion: forcedLatestMocVersion,
              legacyCoreSource: Live2DLoader.legacyCoreSource || null,
              coreSource: Live2DLoader.cubism5CoreSource || null,
              runtimeSource: Live2DLoader.cubism5RuntimeSource || null,
            });

            if (!isRemote) {
              this._revokeModelBlobUrls(characterId);
            }

            const retryUrl = isRemote
              ? await buildRemoteModelUrl()
              : await buildLocalModelUrl(preferBlobForLocal);
            const retryModel = await loadFromUrl(retryUrl);
            this.models.set(characterId, retryModel);
            this._markModelActive(characterId);
            this._debugLog(`[${SCRIPT_NAME}] Live2DManager: Cubism5 runtime 重试加载成功 (${characterId})`);
            return retryModel;
          } catch (retryError) {
            console.warn(`[${SCRIPT_NAME}] Live2DManager: Cubism5 runtime 重试失败 (${characterId})`, retryError);
            return null;
          }
        };

        if (looksLikeCoreParseError && canRetryAsCubism5) {
          const retryModel = await tryForceCubism5Retry(usedBlobForLocal);
          if (retryModel) return retryModel;
        }

        if (!isRemote && usedBlobForLocal) {
          console.warn(`[${SCRIPT_NAME}] Live2DManager: Blob URL 加载失败，回退 Data URL (${characterId})`, e);
          this._disableXhrBlobUrls('load-failed');
          this._revokeModelBlobUrls(characterId);
          const dataUrl = await buildLocalModelUrl(false);
          try {
            const model = await loadFromUrl(dataUrl);
            this.models.set(characterId, model);
            this._markModelActive(characterId);
            this._debugLog(`[${SCRIPT_NAME}] Live2DManager: 模型 ${characterId} DataURL 回退加载成功`);
            return model;
          } catch (fallbackError) {
            const fallbackErrorMessage = String(fallbackError?.message || fallbackError || '');
            const fallbackErrorStack = String(fallbackError?.stack || '');
            const fallbackLooksLikeCoreParseError =
              /unknown error/i.test(fallbackErrorMessage) ||
              /createcoremodel/i.test(fallbackErrorStack) ||
              /be\.create/i.test(fallbackErrorStack);

            if (fallbackLooksLikeCoreParseError && canRetryAsCubism5) {
              const retryModel = await tryForceCubism5Retry(false);
              if (retryModel) return retryModel;
            }
            throw fallbackError;
          }
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

    const blobToDataUrl = (blob) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    };

    const binaryToDataUrl = async (data, mimeType = 'application/octet-stream') => {
      if (!data) return null;
      const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType || 'application/octet-stream' });
      return await blobToDataUrl(blob);
    };

    const normalizePath = (p) => (typeof p === 'string' ? p.replace(/\\/g, '/') : p);
    const isModel3 = !!modifiedModelJson?.FileReferences;

    if (isModel3) {
      // Cubism 3/4: model3.json
      if (modelData.moc3 && modifiedModelJson.FileReferences) {
        const mocDataUrl = await binaryToDataUrl(modelData.moc3, 'application/octet-stream');
        modifiedModelJson.FileReferences.Moc = mocDataUrl;
        const mocBase64 = typeof mocDataUrl === 'string' ? mocDataUrl.split('base64,')[1] || '' : '';
        if (mocBase64 && !mocBase64.startsWith('TU9DMw')) {
          console.warn(`[${SCRIPT_NAME}] Live2DManager: moc3 data URL signature unexpected (${characterId})`, {
            prefix: mocBase64.slice(0, 12),
            byteLength: modelData.moc3?.byteLength || 0,
          });
        }
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
        modifiedModelJson.FileReferences.Physics = await binaryToDataUrl(modelData.physics, 'application/json');
      }

      if (modelData.pose && modifiedModelJson.FileReferences?.Pose) {
        modifiedModelJson.FileReferences.Pose = await binaryToDataUrl(modelData.pose, 'application/json');
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
            const motionDataUrl = await binaryToDataUrl(motion.data, 'application/json');
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
          const exprDataUrl = await binaryToDataUrl(expr.data, 'application/json');
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
        const mocDataUrl = await binaryToDataUrl(modelData.moc, 'application/octet-stream');
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
        const physicsDataUrl = await binaryToDataUrl(modelData.physics, 'application/json');
        modifiedModelJson.physics = physicsDataUrl;
        if (typeof modifiedModelJson.Physics === 'string') {
          modifiedModelJson.Physics = physicsDataUrl;
        }
      }

      if (modelData.pose) {
        const poseDataUrl = await binaryToDataUrl(modelData.pose, 'application/json');
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
              const dataUrl = await binaryToDataUrl(data, guessMime(filePath));
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
            const dataUrl = await binaryToDataUrl(data, 'application/json');

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
    return await blobToDataUrl(modelBlob);
  },

  async _buildRemoteModelDataUrl(characterId, modelUrl, forceProxyResources = false) {
    const url = this._normalizeRemoteUrl(String(modelUrl || '').trim());
    if (!url) {
      throw new Error('远程 Live2D modelUrl 为空');
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

      const remoteMocUrl = String(modifiedModelJson?.FileReferences?.Moc || '').trim();
      if (remoteMocUrl) {
        try {
          const mocResponse = await fetch(remoteMocUrl);
          if (mocResponse.ok) {
            const mocBuffer = await mocResponse.arrayBuffer();
            await this._detectRuntimeFromMoc3(characterId, mocBuffer, this._getCharacterRuntime(characterId));
          } else {
            this._debugLog(`[${SCRIPT_NAME}] Live2DManager: 远程 moc3 探测跳过（HTTP ${mocResponse.status}）`);
          }
        } catch (e) {
          this._debugLog(`[${SCRIPT_NAME}] Live2DManager: 远程 moc3 探测失败`, e);
        }
      }
    } else {
      rewriteCubism2();
    }

    const runtimeHint = this._getCharacterRuntime(characterId);
    this._setModelRuntimeInfo(characterId, {
      modelJson: modifiedModelJson,
      cubismVersion: runtimeHint.cubismVersion,
      runtimeType:
        runtimeHint.runtimeType === LIVE2D_RUNTIME_TYPES.CUBISM5
          ? LIVE2D_RUNTIME_TYPES.CUBISM5
          : '',
    });

    const modelBlob = new Blob([JSON.stringify(modifiedModelJson)], { type: 'application/json' });
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(modelBlob);
    });
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
            : slotEl.classList.contains('slot-center')
              ? 'center'
            : slotEl.classList.contains('slot-left')
              ? 'left'
              : 'left';

          _Live2DStageRef.focusCharacterId = null;
          if (!_Live2DStageRef.ensureMounted(gameContentEl, { mode: 'story' })) return false;
          if (forceReload) {
            _Live2DStageRef.detach(characterId);
          }
          const attached = _Live2DStageRef.attach(characterId, model, slot, { entering: false });
          if (!attached) {
            try {
              _Live2DStageRef._resetAfterFatalRenderError?.(`attach-failed:${characterId}`);
            } catch (e) {}
            this._destroyModel(characterId, 'stage-attach-failed');
            return false;
          }
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
          const attached = _Live2DStageRef.attach(characterId, model, 'left', { entering: false });
          if (!attached) {
            try {
              _Live2DStageRef._resetAfterFatalRenderError?.(`attach-failed:${characterId}`);
            } catch (e) {}
            this._destroyModel(characterId, 'stage-attach-failed');
            return false;
          }
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

      try {
        const internalModel = model?.internalModel;
        const viewport = internalModel?.viewport;
        const invalidViewport =
          !Array.isArray(viewport) ||
          viewport.length < 4 ||
          viewport.some((v) => !Number.isFinite(Number(v)));
        if (internalModel && invalidViewport) {
          const vw = Math.max(
            1,
            Math.floor(
              Number(app?.renderer?.width) ||
                Number(canvas?.width) ||
                Number(containerElement?.clientWidth) ||
                1,
            ),
          );
          const vh = Math.max(
            1,
            Math.floor(
              Number(app?.renderer?.height) ||
                Number(canvas?.height) ||
                Number(containerElement?.clientHeight) ||
                1,
            ),
          );
          internalModel.viewport = [0, 0, vw, vh];
        }
      } catch (e) {}

      try {
        if (typeof model.onTickerUpdate === 'function') {
          model.onTickerUpdate();
        } else if (typeof model.deltaTime === 'number' && model.deltaTime <= 0) {
          model.deltaTime = 16.7;
          if (typeof model.elapsedTime === 'number') {
            model.elapsedTime = Math.max(model.elapsedTime || 0, 16.7);
          }
        }
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] Live2DManager: model ticker prime failed (${characterId})`, e);
      }

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

  _getCoreModelForCharacter(characterId) {
    const model = this.models.get(characterId);
    if (!model?.internalModel?.coreModel) return null;
    return model.internalModel.coreModel;
  },

  _normalizeCoreParamKey(input) {
    return String(input || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  },

  _buildCoreParamIndexCache(coreModel) {
    if (!coreModel || this.coreParamIndexCache.has(coreModel)) {
      return this.coreParamIndexCache.get(coreModel) || null;
    }

    const cache = new Map();
    try {
      if (typeof coreModel.getParameterCount === 'function' && typeof coreModel.getParameterId === 'function') {
        const count = Number(coreModel.getParameterCount()) || 0;
        for (let i = 0; i < count; i++) {
          const rawId = String(coreModel.getParameterId(i) || '').trim();
          const normalized = this._normalizeCoreParamKey(rawId);
          if (!normalized || cache.has(normalized)) continue;
          cache.set(normalized, i);
        }
      }
    } catch (e) {}
    try {
      if (typeof coreModel.getParamCount === 'function' && typeof coreModel.getParamId === 'function') {
        const count = Number(coreModel.getParamCount()) || 0;
        for (let i = 0; i < count; i++) {
          const rawId = String(coreModel.getParamId(i) || '').trim();
          const normalized = this._normalizeCoreParamKey(rawId);
          if (!normalized || cache.has(normalized)) continue;
          cache.set(normalized, i);
        }
      }
    } catch (e) {}

    this.coreParamIndexCache.set(coreModel, cache);
    return cache;
  },

  _getCoreParameterIndex(coreModel, paramId) {
    const pid = String(paramId || '').trim();
    if (!pid || !coreModel) return -1;

    try {
      if (typeof coreModel.getParameterIndex === 'function') {
        const idx = Number(coreModel.getParameterIndex(pid));
        if (Number.isFinite(idx)) return idx;
      }
    } catch (e) {}
    try {
      if (typeof coreModel.getParamIndex === 'function') {
        const idx = Number(coreModel.getParamIndex(pid));
        if (Number.isFinite(idx)) return idx;
      }
    } catch (e) {}

    return -1;
  },

  _getCoreParameterIndexWithAlias(coreModel, paramId) {
    const directIndex = this._getCoreParameterIndex(coreModel, paramId);
    if (directIndex >= 0) return directIndex;

    const normalized = this._normalizeCoreParamKey(paramId);
    if (!normalized) return -1;
    const cache = this._buildCoreParamIndexCache(coreModel);
    if (!cache || !cache.size) return -1;
    const fromCache = Number(cache.get(normalized));
    return Number.isFinite(fromCache) ? fromCache : -1;
  },

  _getBuiltinParamFallbackRange(paramId) {
    const key = this._normalizeCoreParamKey(paramId);
    if (!key) return null;

    if (key.includes('bodyanglex') || key.includes('bodyangley') || key.includes('bodyanglez')) {
      return { min: -10, max: 10 };
    }
    if (key.includes('anglex') || key.includes('angley') || key.includes('anglez')) {
      return { min: -30, max: 30 };
    }
    if (key.includes('eyeballx') || key.includes('eyebally')) {
      return { min: -1, max: 1 };
    }
    if (key.includes('eyeopen') || key.includes('eyesmile') || key.includes('mouthopen') || key.includes('cheek') || key === 'parama') {
      return { min: 0, max: 1 };
    }
    if (key.includes('mouthform') || key.includes('brow')) {
      return { min: -1, max: 1 };
    }

    return null;
  },

  _getCoreParameterRange(coreModel, paramId, paramIndex = -1) {
    let min = Number.NaN;
    let max = Number.NaN;
    const pid = String(paramId || '').trim();
    const idx = Number.isFinite(paramIndex) ? paramIndex : -1;
    const asNumber = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    };

    if (idx >= 0) {
      try {
        if (typeof coreModel.getParameterMinimumValue === 'function') {
          min = asNumber(coreModel.getParameterMinimumValue(idx));
        }
      } catch (e) {}
      try {
        if (typeof coreModel.getParameterMaximumValue === 'function') {
          max = asNumber(coreModel.getParameterMaximumValue(idx));
        }
      } catch (e) {}
    }

    if (!Number.isFinite(min)) {
      try {
        if (typeof coreModel.getParamMin === 'function') {
          min = asNumber(coreModel.getParamMin(pid));
        }
      } catch (e) {}
      try {
        if (!Number.isFinite(min) && Number.isFinite(idx) && idx >= 0 && typeof coreModel.getParamMin === 'function') {
          min = asNumber(coreModel.getParamMin(idx));
        }
      } catch (e) {}
    }
    if (!Number.isFinite(max)) {
      try {
        if (typeof coreModel.getParamMax === 'function') {
          max = asNumber(coreModel.getParamMax(pid));
        }
      } catch (e) {}
      try {
        if (!Number.isFinite(max) && Number.isFinite(idx) && idx >= 0 && typeof coreModel.getParamMax === 'function') {
          max = asNumber(coreModel.getParamMax(idx));
        }
      } catch (e) {}
    }

    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
      const fallbackRange = this._getBuiltinParamFallbackRange(pid);
      if (fallbackRange) {
        if (!Number.isFinite(min)) min = fallbackRange.min;
        if (!Number.isFinite(max) || max <= min) max = fallbackRange.max;
      }
    }

    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max) || max <= min) max = min + 1;
    return { min, max };
  },

  _readCoreParameterByIndex(coreModel, paramIndex) {
    if (!coreModel || !Number.isFinite(paramIndex) || paramIndex < 0) return Number.NaN;
    const readNumber = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : Number.NaN;
    };
    try {
      if (typeof coreModel.getParameterValueByIndex === 'function') {
        const value = readNumber(coreModel.getParameterValueByIndex(paramIndex));
        if (Number.isFinite(value)) return value;
      }
    } catch (e) {}
    try {
      if (typeof coreModel.getParameterValue === 'function') {
        const value = readNumber(coreModel.getParameterValue(paramIndex));
        if (Number.isFinite(value)) return value;
      }
    } catch (e) {}
    try {
      if (typeof coreModel.getParamFloat === 'function') {
        const value = readNumber(coreModel.getParamFloat(paramIndex));
        if (Number.isFinite(value)) return value;
      }
    } catch (e) {}
    return Number.NaN;
  },

  _readCoreParameterById(coreModel, paramId) {
    const pid = String(paramId || '').trim();
    if (!coreModel || !pid) return Number.NaN;
    const readNumber = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : Number.NaN;
    };
    try {
      if (typeof coreModel.getParameterValueById === 'function') {
        const value = readNumber(coreModel.getParameterValueById(pid));
        if (Number.isFinite(value)) return value;
      }
    } catch (e) {}
    try {
      if (typeof coreModel.getParamFloat === 'function') {
        const value = readNumber(coreModel.getParamFloat(pid));
        if (Number.isFinite(value)) return value;
      }
    } catch (e) {}
    return Number.NaN;
  },

  _readCoreParameterValue(coreModel, paramIndex, paramId) {
    const byIndex = this._readCoreParameterByIndex(coreModel, paramIndex);
    if (Number.isFinite(byIndex)) return byIndex;
    return this._readCoreParameterById(coreModel, paramId);
  },

  _writeCoreParameterById(coreModel, paramId, value, weight = 1) {
    const pid = String(paramId || '').trim();
    if (!pid || !coreModel) return false;
    const safeWeight = Number.isFinite(weight) ? Math.max(0, Math.min(1, Number(weight))) : 1;
    const targetValue = Number(value);
    if (!Number.isFinite(targetValue)) return false;

    const paramIndex = this._getCoreParameterIndexWithAlias(coreModel, pid);
    const beforeValue = this._readCoreParameterValue(coreModel, paramIndex, pid);
    const isWriteEffective = () => {
      const afterValue = this._readCoreParameterValue(coreModel, paramIndex, pid);
      if (!Number.isFinite(afterValue)) return false;
      if (Math.abs(afterValue - targetValue) <= 1e-4) return true;
      if (Number.isFinite(beforeValue) && Math.abs(afterValue - beforeValue) <= 1e-6) return false;
      return true;
    };

    // 索引优先：Cubism 2.1 / legacy 下按 index 写入更稳定
    if (paramIndex >= 0) {
      try {
        if (typeof coreModel.setParameterValueByIndex === 'function') {
          coreModel.setParameterValueByIndex(paramIndex, targetValue, safeWeight);
          if (isWriteEffective()) return true;
        }
      } catch (e) {}
      try {
        if (typeof coreModel.addParameterValueByIndex === 'function') {
          coreModel.addParameterValueByIndex(paramIndex, targetValue, safeWeight);
          if (isWriteEffective()) return true;
        }
      } catch (e) {}
      try {
        if (typeof coreModel.setParameterValue === 'function') {
          coreModel.setParameterValue(paramIndex, targetValue, safeWeight);
          if (isWriteEffective()) return true;
        }
      } catch (e) {}
      try {
        if (typeof coreModel.addParameterValue === 'function') {
          coreModel.addParameterValue(paramIndex, targetValue, safeWeight);
          if (isWriteEffective()) return true;
        }
      } catch (e) {}
      try {
        if (typeof coreModel.setParamFloat === 'function') {
          coreModel.setParamFloat(paramIndex, targetValue, safeWeight);
          if (isWriteEffective()) return true;
        }
      } catch (e) {}
      try {
        if (typeof coreModel.addParamFloat === 'function') {
          coreModel.addParamFloat(paramIndex, targetValue, safeWeight);
          if (isWriteEffective()) return true;
        }
      } catch (e) {}
    }

    try {
      if (typeof coreModel.setParameterValueById === 'function') {
        coreModel.setParameterValueById(pid, targetValue, safeWeight);
        if (isWriteEffective()) return true;
      }
    } catch (e) {}
    try {
      if (typeof coreModel.addParameterValueById === 'function') {
        coreModel.addParameterValueById(pid, targetValue, safeWeight);
        if (isWriteEffective()) return true;
      }
    } catch (e) {}
    try {
      if (typeof coreModel.setParamFloat === 'function') {
        coreModel.setParamFloat(pid, targetValue, safeWeight);
        if (isWriteEffective()) return true;
      }
    } catch (e) {}
    try {
      if (typeof coreModel.addParamFloat === 'function') {
        coreModel.addParamFloat(pid, targetValue, safeWeight);
        if (isWriteEffective()) return true;
      }
    } catch (e) {}

    return false;
  },

  _mapBuiltinNormalizedValue(normalizedValue, min, max) {
    const normalized = Number(normalizedValue);
    if (!Number.isFinite(normalized)) return null;

    if (min < 0 && max > 0) {
      const clamped = Math.max(-1, Math.min(1, normalized));
      return clamped >= 0 ? clamped * max : clamped * Math.abs(min);
    }

    const clampedUnit = Math.max(0, Math.min(1, normalized));
    return min + (max - min) * clampedUnit;
  },

  _applyBuiltinNormalizedParam(coreModel, paramId, normalizedValue, weight = 1) {
    const pid = String(paramId || '').trim();
    if (!pid || !coreModel) return false;
    const paramIndex = this._getCoreParameterIndexWithAlias(coreModel, pid);
    const range = this._getCoreParameterRange(coreModel, pid, paramIndex);
    const mappedValue = this._mapBuiltinNormalizedValue(normalizedValue, range.min, range.max);
    if (!Number.isFinite(mappedValue)) return false;
    return this._writeCoreParameterById(coreModel, pid, mappedValue, weight);
  },

  _getBuiltinParameterAliases(paramId) {
    const pid = String(paramId || '').trim();
    if (!pid) return [];

    const aliasMap = {
      ParamAngleX: ['ParamAngleX', 'PARAM_ANGLE_X', 'PARAM_HEAD_X'],
      ParamAngleY: ['ParamAngleY', 'PARAM_ANGLE_Y', 'PARAM_HEAD_Y'],
      ParamAngleZ: ['ParamAngleZ', 'PARAM_ANGLE_Z', 'PARAM_HEAD_Z'],
      ParamEyeLOpen: ['ParamEyeLOpen', 'PARAM_EYE_L_OPEN', 'PARAM_EYE_OPEN', 'ParamEyeOpen'],
      ParamEyeROpen: ['ParamEyeROpen', 'PARAM_EYE_R_OPEN', 'PARAM_EYE_OPEN', 'ParamEyeOpen'],
      ParamEyeLSmile: ['ParamEyeLSmile', 'PARAM_EYE_L_SMILE', 'PARAM_EYE_SMILE'],
      ParamEyeRSmile: ['ParamEyeRSmile', 'PARAM_EYE_R_SMILE', 'PARAM_EYE_SMILE'],
      ParamEyeBallX: ['ParamEyeBallX', 'PARAM_EYE_BALL_X'],
      ParamEyeBallY: ['ParamEyeBallY', 'PARAM_EYE_BALL_Y'],
      ParamBrowLY: ['ParamBrowLY', 'PARAM_BROW_L_Y', 'PARAM_BROW_Y'],
      ParamBrowRY: ['ParamBrowRY', 'PARAM_BROW_R_Y', 'PARAM_BROW_Y'],
      ParamBrowLX: ['ParamBrowLX', 'PARAM_BROW_L_X', 'PARAM_BROW_X'],
      ParamBrowRX: ['ParamBrowRX', 'PARAM_BROW_R_X', 'PARAM_BROW_X'],
      ParamBrowLAngle: ['ParamBrowLAngle', 'PARAM_BROW_L_ANGLE', 'PARAM_BROW_ANGLE'],
      ParamBrowRAngle: ['ParamBrowRAngle', 'PARAM_BROW_R_ANGLE', 'PARAM_BROW_ANGLE'],
      ParamBrowLForm: ['ParamBrowLForm', 'PARAM_BROW_L_FORM', 'PARAM_BROW_FORM'],
      ParamBrowRForm: ['ParamBrowRForm', 'PARAM_BROW_R_FORM', 'PARAM_BROW_FORM'],
      ParamMouthForm: ['ParamMouthForm', 'PARAM_MOUTH_FORM', 'PARAM_MOUTH_SHAPE'],
      ParamMouthOpenY: ['ParamMouthOpenY', 'PARAM_MOUTH_OPEN_Y', 'ParamMouthOpen', 'PARAM_MOUTH_OPEN'],
      ParamCheek: ['ParamCheek', 'PARAM_CHEEK', 'PARAM_BLUSH'],
      ParamBodyAngleX: ['ParamBodyAngleX', 'PARAM_BODY_ANGLE_X'],
      ParamBodyAngleY: ['ParamBodyAngleY', 'PARAM_BODY_ANGLE_Y'],
      ParamBodyAngleZ: ['ParamBodyAngleZ', 'PARAM_BODY_ANGLE_Z'],
    };

    const mapped = aliasMap[pid] || [pid];
    const deduped = [];
    const seen = new Set();
    for (const candidate of mapped) {
      const value = String(candidate || '').trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      deduped.push(value);
    }
    return deduped;
  },

  _applyBuiltinParamWithAliases(coreModel, paramId, normalizedValue, weight = 1, characterId = null) {
    const key = String(characterId || '').trim();
    const baseAliases = this._getBuiltinParameterAliases(paramId);
    const dynamicAliases = key ? this._getStoredModelAliasCandidates(key, paramId) : [];
    const runtimeInfo = key ? this._getCharacterRuntime(key) : null;
    const isCubism2Legacy = String(runtimeInfo?.runtimeType || '') === 'legacy'
      && Number(runtimeInfo?.cubismVersion || 0) > 0
      && Number(runtimeInfo?.cubismVersion || 0) <= 2;

    const seen = new Set();
    const pushAlias = (list, value) => {
      const text = String(value || '').trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      list.push(text);
    };

    const firstPassAliases = [];
    const secondPassAliases = [];

    if (isCubism2Legacy) {
      // Cubism 2.1：先用模型真实参数名，避免被泛化别名误导。
      for (const alias of dynamicAliases) pushAlias(firstPassAliases, alias);
      for (const alias of baseAliases) pushAlias(secondPassAliases, alias);
    } else {
      // 3/4/5：先走标准参数，动态参数只做兜底。
      for (const alias of baseAliases) pushAlias(firstPassAliases, alias);
      for (const alias of dynamicAliases) pushAlias(secondPassAliases, alias);
    }

    for (const alias of firstPassAliases) {
      if (this._applyBuiltinNormalizedParam(coreModel, alias, normalizedValue, weight)) {
        return true;
      }
    }

    for (const alias of secondPassAliases) {
      if (this._applyBuiltinNormalizedParam(coreModel, alias, normalizedValue, weight)) {
        return true;
      }
    }
    return false;
  },

  _ensureBuiltinUpdateHook(characterId) {
    const key = String(characterId || '').trim();
    if (!key) return;
    const model = this.models.get(key);
    if (!model) return;
    this._getLipSyncState(key);
    this._ensureLipSyncHooks(key, model);
  },

  _setBuiltinMotionFrameState(characterId, params, weight = 1) {
    const key = String(characterId || '').trim();
    if (!key) return;
    const nextParams = params && typeof params === 'object' ? { ...params } : null;
    if (!nextParams || !Object.keys(nextParams).length) {
      this.builtinMotionFrameStates.delete(key);
      return;
    }
    this.builtinMotionFrameStates.set(key, {
      params: nextParams,
      weight: Number.isFinite(weight) ? Number(weight) : 1,
    });
  },

  _applyBuiltinPostUpdate(characterId, model) {
    const key = String(characterId || '').trim();
    if (!key || !model?.internalModel?.coreModel) return false;
    const coreModel = model.internalModel.coreModel;
    let applied = false;

    const motionState = this.builtinMotionFrameStates.get(key);
    if (motionState) {
      const params = motionState.params && typeof motionState.params === 'object'
        ? motionState.params
        : {};
      const weight = Number.isFinite(motionState.weight) ? motionState.weight : 1;
      for (const [paramId, normalizedValue] of Object.entries(params)) {
        if (this._applyBuiltinParamWithAliases(coreModel, paramId, normalizedValue, weight, key)) {
          applied = true;
        }
      }
    }

    return applied;
  },

  applyBuiltinExpression(characterId, builtinExpressionKey, options = {}) {
    const expressionDef = getBuiltinExpressionByKey(builtinExpressionKey);
    if (!expressionDef) return false;
    const coreModel = this._getCoreModelForCharacter(characterId);
    if (!coreModel) return false;

    const params = expressionDef.parameters && typeof expressionDef.parameters === 'object'
      ? expressionDef.parameters
      : {};
    const weight = Number.isFinite(options.weight) ? Number(options.weight) : 1;
    let appliedCount = 0;

    for (const [paramId, normalizedValue] of Object.entries(params)) {
      if (this._applyBuiltinParamWithAliases(coreModel, paramId, normalizedValue, weight, characterId)) {
        appliedCount += 1;
      }
    }
    if (appliedCount <= 0) {
      try {
        console.warn(`[${SCRIPT_NAME}] BuiltinExpression 未命中参数`, {
          characterId,
          builtinExpressionKey,
          expectedParams: Object.keys(params || {}),
          modelParams: this.getCoreParamIds(characterId),
          storedParams: this._getStoredModelParamIds(characterId),
        });
      } catch (e) {}
    }

    return appliedCount > 0;
  },

  stopBuiltinMotion(characterId) {
    const key = String(characterId || '').trim();
    if (!key) return false;
    const state = this.builtinMotionPlayers.get(key);
    if (!state) {
      this._setBuiltinMotionFrameState(key, null);
      return false;
    }

    state.stopped = true;
    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
    try {
      if (Number.isFinite(state.rafId)) {
        (_topWindow.cancelAnimationFrame || window.cancelAnimationFrame)?.call(_topWindow, state.rafId);
      }
    } catch (e) {}

    // 动作结束后回到首帧（通常是中性姿态），避免残留在最后一帧。
    try {
      const coreModel = this._getCoreModelForCharacter(key);
      const resetParams = state.resetParams && typeof state.resetParams === 'object' ? state.resetParams : null;
      const resetWeight = Number.isFinite(state.weight) ? Number(state.weight) : 1;
      if (coreModel && resetParams) {
        for (const [paramId, normalizedValue] of Object.entries(resetParams)) {
          this._applyBuiltinParamWithAliases(coreModel, paramId, normalizedValue, resetWeight, key);
        }
      }
    } catch (e) {}

    this._setBuiltinMotionFrameState(key, null);
    this.builtinMotionPlayers.delete(key);
    return true;
  },

  playBuiltinMotion(characterId, builtinMotionKey, options = {}) {
    const motionDef = getBuiltinMotionByKey(builtinMotionKey);
    if (!motionDef) return false;
    const model = this.models.get(characterId);
    const coreModel = this._getCoreModelForCharacter(characterId);
    if (!model || !coreModel) return false;

    const key = String(characterId || '').trim();
    if (!key) return false;

    const keyframes = Array.isArray(motionDef.keyframes)
      ? motionDef.keyframes
          .map(frame => ({
            t: Number(frame?.t),
            params: frame?.params && typeof frame.params === 'object' ? frame.params : {},
          }))
          .filter(frame => Number.isFinite(frame.t) && frame.t >= 0 && frame.t <= 1)
          .sort((a, b) => a.t - b.t)
      : [];
    if (keyframes.length === 0) return false;

    this.stopBuiltinMotion(key);
    this._ensureBuiltinUpdateHook(key);

    const durationMs = Math.max(120, Number(motionDef.durationMs) || 600);
    const loop = motionDef.loop === true;
    const easing = String(options.easing || motionDef.easing || 'linear').trim().toLowerCase();
    const weight = Number.isFinite(options.weight) ? Number(options.weight) : 1;
    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
    const requestFrame = _topWindow.requestAnimationFrame || window.requestAnimationFrame;
    if (typeof requestFrame !== 'function') return false;
    const perfNow = () => (_topWindow.performance?.now?.() ?? Date.now());

    const applyEasing = (value) => {
      const t = Math.max(0, Math.min(1, Number(value) || 0));
      if (easing === 'easeout') return 1 - Math.pow(1 - t, 2);
      if (easing === 'easeinout') {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      }
      return t;
    };

    const resetParams = keyframes[0]?.params && typeof keyframes[0].params === 'object'
      ? { ...keyframes[0].params }
      : null;
    const state = { rafId: 0, stopped: false, startedAt: perfNow(), resetParams, weight };
    this.builtinMotionPlayers.set(key, state);

    const step = () => {
      const currentState = this.builtinMotionPlayers.get(key);
      if (!currentState || currentState !== state || state.stopped) return;
      if (!this.models.has(key) || this.models.get(key) !== model) {
        this.stopBuiltinMotion(key);
        return;
      }

      const elapsed = perfNow() - state.startedAt;
      let progress = elapsed / durationMs;
      if (loop) {
        progress = progress % 1;
      } else {
        progress = Math.max(0, Math.min(1, progress));
      }
      const easedProgress = applyEasing(progress);

      let prevFrame = keyframes[0];
      let nextFrame = keyframes[keyframes.length - 1];
      for (let i = 0; i < keyframes.length; i++) {
        const frame = keyframes[i];
        if (frame.t <= easedProgress) prevFrame = frame;
        if (frame.t >= easedProgress) {
          nextFrame = frame;
          break;
        }
      }

      const frameSpan = Math.max(1e-6, (nextFrame.t - prevFrame.t) || 0);
      const localAlpha = nextFrame.t === prevFrame.t
        ? 0
        : Math.max(0, Math.min(1, (easedProgress - prevFrame.t) / frameSpan));
      const paramNames = new Set([
        ...Object.keys(prevFrame.params || {}),
        ...Object.keys(nextFrame.params || {}),
      ]);

      for (const paramId of paramNames) {
        const prevValue = Number(prevFrame.params?.[paramId]);
        const nextValue = Number(nextFrame.params?.[paramId]);
        const a = Number.isFinite(prevValue) ? prevValue : (Number.isFinite(nextValue) ? nextValue : 0);
        const b = Number.isFinite(nextValue) ? nextValue : a;
        const blended = a + (b - a) * localAlpha;
        this._applyBuiltinParamWithAliases(coreModel, paramId, blended, weight, key);
        state.currentParams = state.currentParams && typeof state.currentParams === 'object' ? state.currentParams : {};
        state.currentParams[paramId] = blended;
      }
      this._setBuiltinMotionFrameState(key, state.currentParams || null, weight);

      if (!loop && elapsed >= durationMs) {
        this.stopBuiltinMotion(key);
        return;
      }

      state.rafId = requestFrame.call(_topWindow, step);
    };

    state.rafId = requestFrame.call(_topWindow, step);
    return true;
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

  _isMouthParam(characterId, paramIdOrIndex, coreModel) {
    const preset = [
      'parammouthopeny',
      'param_mouth_open_y',
      'parammouthopen',
      'parama',
      'param58',
      'param61',
      'param_mouth_open',
      'mouth_open',
    ];

    const state = this._getLipSyncState(characterId);

    if (typeof paramIdOrIndex === 'number') {
      if (state?.mouthParamIndexes?.includes(paramIdOrIndex)) return true;
      try {
        if (typeof coreModel?.getParameterId === 'function') {
          const pid = String(coreModel.getParameterId(paramIdOrIndex) || '').trim();
          if (pid) return this._isMouthParam(characterId, pid, coreModel);
        }
      } catch (e) {}
      return false;
    }

    const id = String(paramIdOrIndex || '').trim().toLowerCase();
    if (!id) return false;
    if (preset.includes(id)) return true;
    return !!state?.mouthParamIds?.some(pid => String(pid || '').trim().toLowerCase() === id);
  },

  _installCoreWriteMask(characterId, coreModel) {
    const state = this._getLipSyncState(characterId);
    if (!state || !coreModel) return;
    if (state.writeMaskCore === coreModel) return;

    if (state.writeMaskRestore) {
      try {
        state.writeMaskRestore();
      } catch (e) {}
      state.writeMaskCore = null;
      state.writeMaskRestore = null;
    }

    const restoreEntries = [];
    const methods = [
      'setParameterValueById',
      'addParameterValueById',
      'setParamFloat',
      'addParamFloat',
      'setParameterValueByIndex',
      'addParameterValueByIndex',
      'setParameterValue',
      'addParameterValue',
    ];

    const getParamRef = (method, args) => {
      if (!Array.isArray(args) || args.length === 0) return null;
      const first = args[0];
      if (method.includes('ById') || method === 'setParamFloat' || method === 'addParamFloat') {
        return typeof first === 'string' ? first : null;
      }
      if (method.includes('ByIndex')) {
        return typeof first === 'number' ? first : null;
      }
      if (method === 'setParameterValue' || method === 'addParameterValue') {
        if (typeof first === 'number' || typeof first === 'string') return first;
      }
      return null;
    };

    for (const method of methods) {
      const raw = coreModel?.[method];
      if (typeof raw !== 'function') continue;
      restoreEntries.push({ method, raw });
      coreModel[method] = (...args) => {
        const paramRef = getParamRef(method, args);
        if (
          paramRef !== null &&
          state.lipSyncActive &&
          state.inModelUpdate &&
          this._isMouthParam(characterId, paramRef, coreModel)
        ) {
          return undefined;
        }
        return raw.apply(coreModel, args);
      };
    }

    state.writeMaskCore = coreModel;
    state.writeMaskRestore = () => {
      for (const entry of restoreEntries) {
        try {
          coreModel[entry.method] = entry.raw;
        } catch (e) {}
      }
    };
  },

  _ensureLipSyncHooks(characterId, model) {
    const state = this._getLipSyncState(characterId);
    if (!state || !model) return;
    if (state.updateHookModel === model) return;

    if (state.updateHookRestore) {
      try {
        state.updateHookRestore();
      } catch (e) {}
      state.updateHookRestore = null;
      state.updateHookModel = null;
    }

    const internal = model?.internalModel;
    const updater = internal?.update;
    if (typeof updater !== 'function') return;

    const rawUpdate = updater.bind(internal);
    const self = this;
    internal.update = function (...args) {
      state.inModelUpdate = true;
      let ret;
      try {
        ret = rawUpdate(...args);
      } finally {
        state.inModelUpdate = false;
        if (state.lipSyncActive) {
          try {
            self._applyMouthValueToModel(characterId, model);
          } catch (e) {}
        }
        try {
          self._applyBuiltinPostUpdate(characterId, model);
        } catch (e) {}
      }
      return ret;
    };

    state.updateHookModel = model;
    state.updateHookRestore = () => {
      try {
        internal.update = updater;
      } catch (e) {}
    };
  },

  _applyMouthValueToModel(characterId, model) {
    const state = this._getLipSyncState(characterId);
    if (!state || !model?.internalModel?.coreModel) return false;
    const targetValue = Math.max(0, Math.min(1, state.mouthCurrentValue || 0));
    const oldValue = state.mouthCurrentValue;
    state.mouthCurrentValue = targetValue;
    const applied = this.setMouthOpen(characterId, targetValue);
    state.mouthCurrentValue = oldValue;
    return applied;
  },

  _setLipSyncActive(characterId, active) {
    const key = String(characterId || '').trim();
    if (!key) return;

    let state = this.lipSyncStates.get(key);
    if (!state && active) {
      state = this._getLipSyncState(key);
    }
    if (!state) return;

    const next = !!active;
    if (state.lipSyncActive === next) return;
    state.lipSyncActive = next;

    if (next) {
      const model = this.models.get(key);
      const coreModel = model?.internalModel?.coreModel;
      if (model) this._ensureLipSyncHooks(key, model);
      if (coreModel) this._installCoreWriteMask(key, coreModel);
    }

    this._debugLog(`[${SCRIPT_NAME}] LipSync active=${next} (${key})`);
  },

  setMouthOpen(characterId, value) {
    const key = String(characterId || '').trim();
    if (!key) return false;
    const model = this.models.get(key);
    if (!model?.internalModel?.coreModel) return false;

    const state = this._getLipSyncState(key);
    if (!state) return false;

    const coreModel = model.internalModel.coreModel;
    const clampedValue = Math.max(0, Math.min(1, Number(value) || 0));
    state.mouthCurrentValue = clampedValue;
    this._ensureLipSyncHooks(key, model);
    this._installCoreWriteMask(key, coreModel);

    const getParamRange = (paramId, paramIndex) => {
      let min = Number.NaN;
      let max = Number.NaN;

      const readNumber = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : Number.NaN;
      };

      if (Number.isFinite(paramIndex) && paramIndex >= 0) {
        try {
          if (typeof coreModel.getParameterMinimumValue === 'function') {
            min = readNumber(coreModel.getParameterMinimumValue(paramIndex));
          }
        } catch (e) {}
        try {
          if (typeof coreModel.getParameterMaximumValue === 'function') {
            max = readNumber(coreModel.getParameterMaximumValue(paramIndex));
          }
        } catch (e) {}
      }

      if (!Number.isFinite(min)) {
        try {
          if (typeof coreModel.getParamMin === 'function') {
            min = readNumber(coreModel.getParamMin(paramId));
          }
        } catch (e) {}
      }
      if (!Number.isFinite(max)) {
        try {
          if (typeof coreModel.getParamMax === 'function') {
            max = readNumber(coreModel.getParamMax(paramId));
          }
        } catch (e) {}
      }

      if (!Number.isFinite(min)) min = 0;
      if (!Number.isFinite(max) || max <= min) max = 1;
      return { min, max };
    };

    const mapToParamValue = (paramId, paramIndex) => {
      const { min, max } = getParamRange(paramId, paramIndex);
      if (min < 0 && max > 0) {
        return clampedValue * max;
      }
      return min + (max - min) * clampedValue;
    };

    const getIndexById = (paramId) => {
      try {
        if (typeof coreModel.getParameterIndex === 'function') {
          return coreModel.getParameterIndex(paramId);
        }
      } catch (e) {}
      try {
        if (typeof coreModel.getParamIndex === 'function') {
          return coreModel.getParamIndex(paramId);
        }
      } catch (e) {}
      return -1;
    };

    const applyById = (paramId) => {
      const paramIndex = getIndexById(paramId);
      const mappedValue = mapToParamValue(paramId, paramIndex);
      try {
        if (typeof coreModel.setParameterValueById === 'function') {
          coreModel.setParameterValueById(paramId, mappedValue, 1);
          return true;
        }
      } catch (e) {}
      try {
        if (typeof coreModel.addParameterValueById === 'function') {
          coreModel.addParameterValueById(paramId, mappedValue, 1);
          return true;
        }
      } catch (e) {}
      try {
        if (typeof coreModel.setParamFloat === 'function') {
          coreModel.setParamFloat(paramId, mappedValue, 1);
          return true;
        }
      } catch (e) {}
      try {
        if (typeof coreModel.addParamFloat === 'function') {
          coreModel.addParamFloat(paramId, mappedValue, 1);
          return true;
        }
      } catch (e) {}
      return false;
    };

    const applyByIndex = (paramIndex) => {
      if (!Number.isFinite(paramIndex) || paramIndex < 0) return false;
      const paramId = (() => {
        try {
          if (typeof coreModel.getParameterId === 'function') {
            return String(coreModel.getParameterId(paramIndex) || '');
          }
        } catch (e) {}
        return '';
      })();
      const mappedValue = mapToParamValue(paramId || `__idx_${paramIndex}`, paramIndex);
      try {
        if (typeof coreModel.setParameterValueByIndex === 'function') {
          coreModel.setParameterValueByIndex(paramIndex, mappedValue, 1);
          return true;
        }
      } catch (e) {}
      try {
        if (typeof coreModel.addParameterValueByIndex === 'function') {
          coreModel.addParameterValueByIndex(paramIndex, mappedValue, 1);
          return true;
        }
      } catch (e) {}
      try {
        if (typeof coreModel.setParameterValue === 'function') {
          coreModel.setParameterValue(paramIndex, mappedValue, 1);
          return true;
        }
      } catch (e) {}
      try {
        if (typeof coreModel.addParameterValue === 'function') {
          coreModel.addParameterValue(paramIndex, mappedValue, 1);
          return true;
        }
      } catch (e) {}
      return false;
    };

    const paramNames = [
      'ParamMouthOpenY',
      'PARAM_MOUTH_OPEN_Y',
      'ParamMouthOpen',
      'ParamA',
      'Param58',
      'Param61',
      'Param_Mouth_Open',
      'mouth_open',
    ];

    let appliedAny = false;
    const visited = new Set();
    for (const paramName of paramNames) {
      if (visited.has(paramName)) continue;
      visited.add(paramName);
      const paramIndex = getIndexById(paramName);
      if (paramIndex >= 0) {
        const appliedById = applyById(paramName);
        const appliedByIndex = !appliedById && applyByIndex(paramIndex);
        if (appliedById || appliedByIndex) appliedAny = true;
      }
    }
    if (appliedAny) return true;

    if (state.mouthParamCore !== coreModel) {
      state.mouthParamCore = coreModel;
      state.mouthParamIds = [];
      state.mouthParamIndexes = [];
      state.mouthParamRangeMins = [];
      state.mouthParamRangeMaxs = [];
      state.mouthParamWarned = false;
      try {
        if (typeof coreModel.getParameterCount === 'function' && typeof coreModel.getParameterId === 'function') {
          const count = Number(coreModel.getParameterCount()) || 0;
          const numericFallback = [];
          for (let i = 0; i < count; i++) {
            const pid = String(coreModel.getParameterId(i) || '');
            const low = pid.toLowerCase();
            const range = getParamRange(pid, i);
            if (
              low.includes('mouth') ||
              low.includes('lip') ||
              pid === 'ParamA' ||
              /^Param(?:58|61)$/i.test(pid)
            ) {
              state.mouthParamIds.push(pid);
              state.mouthParamIndexes.push(i);
              state.mouthParamRangeMins.push(range.min);
              state.mouthParamRangeMaxs.push(range.max);
              continue;
            }

            if (/^param\d+$/i.test(pid) && range.max >= 8 && range.min >= -1) {
              numericFallback.push({ id: pid, idx: i, min: range.min, max: range.max });
            }
          }

          if (state.mouthParamIds.length === 0 && numericFallback.length > 0) {
            numericFallback.sort((a, b) => b.max - a.max);
            const picked = numericFallback.slice(0, 3);
            for (const item of picked) {
              state.mouthParamIds.push(item.id);
              state.mouthParamIndexes.push(item.idx);
              state.mouthParamRangeMins.push(item.min);
              state.mouthParamRangeMaxs.push(item.max);
            }
            this._debugLog(`[${SCRIPT_NAME}] Live2DManager: 使用数字参数回退`, {
              characterId: key,
              picked,
            });
          }
        }
      } catch (e) {}
    }

    for (let i = 0; i < state.mouthParamIds.length; i++) {
      const pid = state.mouthParamIds[i];
      const pidx = state.mouthParamIndexes[i] ?? -1;
      const appliedById = applyById(pid);
      const appliedByIndex = !appliedById && applyByIndex(pidx);
      if (appliedById || appliedByIndex) appliedAny = true;
    }
    if (appliedAny) return true;

    if (!state.mouthParamWarned) {
      state.mouthParamWarned = true;
      console.warn(`[${SCRIPT_NAME}] Live2DManager: 未找到可用口型参数`, {
        characterId: key,
        presetCandidates: paramNames,
        scannedIds: state.mouthParamIds,
      });
    }

    return false;
  },

  getLipSyncDebugInfo(characterId) {
    const key = String(characterId || '').trim();
    const state = key ? this.lipSyncStates.get(key) : null;
    return {
      lipSyncOverride: state?.lipSyncActive ? 'active' : 'inactive',
      mouthParamsSource: 'auto',
      mouthParamsCount: state?.mouthParamIds?.length || 0,
    };
  },

  getMouthParams(characterId) {
    const key = String(characterId || '').trim();
    const model = this.models.get(key);
    if (!model?.internalModel?.coreModel) return [];

    const coreModel = model.internalModel.coreModel;
    const state = this._getLipSyncState(key);
    const params = [];
    const seen = new Set();
    const push = (id) => {
      const value = String(id || '').trim();
      if (!value || seen.has(value)) return;
      seen.add(value);
      params.push(value);
    };

    try {
      const count = coreModel.getParameterCount();
      for (let i = 0; i < count; i++) {
        const id = String(coreModel.getParameterId(i) || '');
        const lower = id.toLowerCase();
        if (
          lower.includes('mouth') ||
          lower.includes('lip') ||
          id === 'ParamA' ||
          /^Param(?:58|61)$/i.test(id)
        ) {
          push(id);
        }
      }
    } catch (e) {}

    for (const id of state?.mouthParamIds || []) {
      push(id);
    }
    return params;
  },

  getCoreParamIds(characterId) {
    const key = String(characterId || '').trim();
    const model = this.models.get(key);
    if (!model?.internalModel?.coreModel) return [];

    const coreModel = model.internalModel.coreModel;
    const ids = [];
    const seen = new Set();
    const push = (id) => {
      const value = String(id || '').trim();
      if (!value || seen.has(value)) return;
      seen.add(value);
      ids.push(value);
    };

    try {
      if (typeof coreModel.getParameterCount === 'function' && typeof coreModel.getParameterId === 'function') {
        const count = Number(coreModel.getParameterCount()) || 0;
        for (let i = 0; i < count; i++) {
          push(coreModel.getParameterId(i));
        }
      }
    } catch (e) {}
    try {
      if (typeof coreModel.getParamCount === 'function' && typeof coreModel.getParamId === 'function') {
        const count = Number(coreModel.getParamCount()) || 0;
        for (let i = 0; i < count; i++) {
          push(coreModel.getParamId(i));
        }
      }
    } catch (e) {}

    return ids;
  },

  _decodeStoredBinaryToText(raw) {
    if (typeof raw === 'string') return raw;
    let buffer = null;
    if (raw instanceof ArrayBuffer) {
      buffer = raw;
    } else if (ArrayBuffer.isView(raw)) {
      buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
    }
    if (!buffer) return '';
    try {
      return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    } catch (e) {}
    try {
      return String.fromCharCode(...new Uint8Array(buffer));
    } catch (e) {}
    return '';
  },

  _collectParamIdsFromPayload(raw) {
    const result = new Set();
    const push = (value) => {
      const id = String(value || '').trim();
      if (!id) return;
      if (!/[A-Za-z]/.test(id)) return;
      result.add(id);
    };

    const text = this._decodeStoredBinaryToText(raw);
    if (!text) return [];

    try {
      const parsed = JSON.parse(text);
      const visit = (node) => {
        if (node == null) return;
        if (Array.isArray(node)) {
          for (const item of node) visit(item);
          return;
        }
        if (typeof node !== 'object') return;
        for (const [key, value] of Object.entries(node)) {
          const lower = String(key || '').toLowerCase();
          if (lower === 'id' || lower === 'paramid' || lower === 'parameterid') {
            push(value);
          }
          visit(value);
        }
      };
      visit(parsed);
    } catch (e) {}

    const regex = /\b(?:PARAM_[A-Z0-9_]+|Param[A-Za-z0-9_]+)\b/g;
    let match = null;
    while ((match = regex.exec(text)) !== null) {
      push(match[0]);
    }

    return Array.from(result);
  },

  _getStoredModelParamIds(characterId) {
    const key = String(characterId || '').trim();
    if (!key) return [];
    if (this.storedModelParamIds.has(key)) {
      return this.storedModelParamIds.get(key) || [];
    }

    const modelData = this.modelSourceData.get(key);
    const ids = [];
    const seen = new Set();
    const add = (id) => {
      const value = String(id || '').trim();
      if (!value || seen.has(value)) return;
      seen.add(value);
      ids.push(value);
    };

    const exprList = Array.isArray(modelData?.expressions) ? modelData.expressions : [];
    for (const expr of exprList) {
      const parsedIds = this._collectParamIdsFromPayload(expr?.data);
      for (const pid of parsedIds) add(pid);
    }

    const motionGroups = modelData?.motions && typeof modelData.motions === 'object'
      ? modelData.motions
      : {};
    for (const motionList of Object.values(motionGroups)) {
      if (!Array.isArray(motionList)) continue;
      for (const motion of motionList) {
        const parsedIds = this._collectParamIdsFromPayload(motion?.data);
        for (const pid of parsedIds) add(pid);
      }
    }

    // 兼容：某些模型将参数名放在 model.json 相关字段中
    for (const source of [modelData?.modelJson, modelData?.model3Json, modelData?.modelRawJson]) {
      const parsedIds = this._collectParamIdsFromPayload(source);
      for (const pid of parsedIds) add(pid);
    }

    this.storedModelParamIds.set(key, ids);
    return ids;
  },

  _getBuiltinParamMatchPatterns(paramId) {
    const pid = String(paramId || '').trim();
    const map = {
      ParamAngleX: [/angle[_-]*x/i],
      ParamAngleY: [/angle[_-]*y/i],
      ParamAngleZ: [/angle[_-]*z/i],
      ParamEyeLOpen: [/eye[_-]*l[_-]*open/i, /left[_-]*eye[_-]*open/i],
      ParamEyeROpen: [/eye[_-]*r[_-]*open/i, /right[_-]*eye[_-]*open/i],
      ParamEyeLSmile: [/eye[_-]*l[_-]*smile/i, /left[_-]*eye[_-]*smile/i],
      ParamEyeRSmile: [/eye[_-]*r[_-]*smile/i, /right[_-]*eye[_-]*smile/i],
      ParamEyeBallX: [/eye[_-]*ball[_-]*x/i, /pupil[_-]*x/i],
      ParamEyeBallY: [/eye[_-]*ball[_-]*y/i, /pupil[_-]*y/i],
      ParamBrowLY: [/brow[_-]*l[_-]*y/i, /left[_-]*brow[_-]*y/i],
      ParamBrowRY: [/brow[_-]*r[_-]*y/i, /right[_-]*brow[_-]*y/i],
      ParamBrowLX: [/brow[_-]*l[_-]*x/i, /left[_-]*brow[_-]*x/i],
      ParamBrowRX: [/brow[_-]*r[_-]*x/i, /right[_-]*brow[_-]*x/i],
      ParamBrowLAngle: [/brow[_-]*l.*angle/i, /left[_-]*brow.*angle/i],
      ParamBrowRAngle: [/brow[_-]*r.*angle/i, /right[_-]*brow.*angle/i],
      ParamBrowLForm: [/brow[_-]*l.*form/i, /left[_-]*brow.*form/i],
      ParamBrowRForm: [/brow[_-]*r.*form/i, /right[_-]*brow.*form/i],
      ParamMouthForm: [/mouth.*form/i],
      ParamMouthOpenY: [/mouth.*open/i, /^parama$/i],
      ParamCheek: [/cheek/i, /blush/i],
      ParamBodyAngleX: [/body.*angle[_-]*x/i],
      ParamBodyAngleY: [/body.*angle[_-]*y/i],
      ParamBodyAngleZ: [/body.*angle[_-]*z/i],
    };
    return map[pid] || [];
  },

  _getStoredModelAliasCandidates(characterId, paramId) {
    const patterns = this._getBuiltinParamMatchPatterns(paramId);
    if (!patterns.length) return [];
    const ids = this._getStoredModelParamIds(characterId);
    if (!ids.length) return [];

    const matched = [];
    const seen = new Set();
    for (const id of ids) {
      const raw = String(id || '').trim();
      if (!raw || seen.has(raw)) continue;
      if (!patterns.some((pattern) => pattern.test(raw))) continue;
      seen.add(raw);
      matched.push(raw);
    }
    return matched;
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
