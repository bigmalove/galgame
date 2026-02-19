/**
 * Export Galgame UI Plugin settings from browser storage to a portable JSON config.
 *
 * This script is intended to be run inside SillyTavern page context (F12 console),
 * so it can read `localStorage` and `IndexedDB`.
 *
 * Quick start:
 *   1) Open SillyTavern -> F12 -> Console
 *   2) Paste this whole file
 *   3) Run: GalgameUiPluginConfigExporter.runInteractive()
 */

(function () {
  'use strict';

  const DB_NAME = 'GalgameUIPluginDB';
  const SCRIPT_ID = 'galgame-ui-plugin';

  const DEFAULT_PACK_ID = 'pack_default';
  const DEFAULT_PACK_NAME = '未定义';
  const DISCORD_UPLOAD_LIMIT_BYTES = 25 * 1024 * 1024;
  const DEFAULT_LIVE2D_EMBED_LIMIT_BYTES = DISCORD_UPLOAD_LIMIT_BYTES;

  const STORAGE_KEYS = {
    CURRENT_PACK: `${SCRIPT_ID}_current_pack`,
    SETTINGS: `${SCRIPT_ID}_settings`,
    CHAR_TTS_VOICE: `${SCRIPT_ID}_char_tts_voice`,
    TTS_ENABLED: `${SCRIPT_ID}_tts_enabled`,
    CHAR_USE_LIVE2D: `${SCRIPT_ID}_char_use_live2d`,
    LIVE2D_CONFIG: `${SCRIPT_ID}_live2d_config`,
    CUSTOM_LOCATION_HTML: `${SCRIPT_ID}_custom_location_html`,
    CUSTOM_TIME_HTML: `${SCRIPT_ID}_custom_time_html`,
  };

  function parseMajorVersion(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.floor(value);
    }
    if (typeof value !== 'string') return null;
    const match = value.trim().match(/(\d+)(?:\.\d+)?/);
    if (!match) return null;
    const major = Number.parseInt(match[1], 10);
    return Number.isFinite(major) ? major : null;
  }

  function normalizeCubismVersion(value) {
    const major = parseMajorVersion(value);
    if (major == null) return null;
    if (major >= 5) return 5;
    if (major >= 3) return 4;
    if (major === 2) return 2;
    return null;
  }

  function inferCubismVersionFromModelJson(modelJson, fallback = null) {
    if (!modelJson || typeof modelJson !== 'object') {
      return normalizeCubismVersion(fallback);
    }
    const candidates = [
      modelJson.Version,
      modelJson.version,
      modelJson?.Meta?.Version,
      modelJson?.meta?.version,
    ];
    for (const value of candidates) {
      const parsed = normalizeCubismVersion(value);
      if (parsed != null) return parsed;
    }
    if (modelJson.FileReferences && typeof modelJson.FileReferences === 'object') {
      return normalizeCubismVersion(fallback) ?? 4;
    }
    if (typeof modelJson.model === 'string' || typeof modelJson.Model === 'string') {
      return normalizeCubismVersion(fallback) ?? 2;
    }
    return normalizeCubismVersion(fallback);
  }

  function withResolvedLive2DRuntime(modelData) {
    const input = modelData && typeof modelData === 'object' ? modelData : {};
    const cubismVersion = inferCubismVersionFromModelJson(input.modelJson, input.cubismVersion);
    const explicitRuntimeType = String(input.runtimeType || '').trim().toLowerCase();
    const runtimeType = explicitRuntimeType || (cubismVersion >= 5 ? 'cubism5' : 'legacy');
    return {
      ...input,
      runtimeType,
      cubismVersion: cubismVersion ?? (runtimeType === 'cubism5' ? 5 : null),
    };
  }

  function safeJsonParse(text, fallback) {
    try {
      if (text == null || text === '') return fallback;
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  }

  function readLocalStorageJson(key, fallback) {
    try {
      return safeJsonParse(localStorage.getItem(key), fallback);
    } catch {
      return fallback;
    }
  }

  function readLocalStorageBool(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      if (v == null) return fallback;
      return String(v) === 'true';
    } catch {
      return fallback;
    }
  }

  function normalizeStringList(rawList) {
    const source = Array.isArray(rawList)
      ? rawList
      : (typeof rawList === 'string' ? rawList.split(/\r?\n/) : []);
    return Array.from(
      new Set(
        source
          .map(name => String(name || '').trim())
          .filter(Boolean),
      ),
    );
  }

  function ensureTrailingSlash(url) {
    if (!url) return '';
    return url.endsWith('/') ? url : url + '/';
  }

  function normalizeRemoteInput(input) {
    const raw = String(input || '').trim();
    if (!raw) return { remoteBaseUrl: '', remoteAssetsUrl: '' };

    if (/\.json(\?.*)?$/i.test(raw)) {
      return { remoteBaseUrl: '', remoteAssetsUrl: raw };
    }

    const base = ensureTrailingSlash(raw);
    return { remoteBaseUrl: base, remoteAssetsUrl: base + 'remote_assets.json' };
  }

  function normalizeRemoteMode(value) {
    return String(value || '').trim().toLowerCase() === 'remote' ? 'remote' : 'local';
  }

  function toArrayBuffer(input) {
    if (!input) return null;
    if (input instanceof ArrayBuffer) return input;
    if (ArrayBuffer.isView(input)) {
      return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
    }
    return null;
  }

  function arrayBufferToBase64(buffer) {
    const safeBuffer = toArrayBuffer(buffer);
    if (!safeBuffer) return '';
    const bytes = new Uint8Array(safeBuffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          const idx = result.indexOf(',');
          resolve(idx >= 0 ? result.slice(idx + 1) : result);
        };
        reader.onerror = () => reject(reader.error || new Error('Blob read failed'));
        reader.readAsDataURL(blob);
      } catch (e) {
        reject(e);
      }
    });
  }

  function safeByteLength(input) {
    const buf = toArrayBuffer(input);
    if (buf) return buf.byteLength;
    if (typeof Blob !== 'undefined' && input instanceof Blob) return input.size || 0;
    if (typeof input?.size === 'number') return input.size;
    return 0;
  }

  function estimateLive2DModelSizeBytes(modelData) {
    if (!modelData || typeof modelData !== 'object') return 0;
    if (Number.isFinite(modelData.fileSize) && modelData.fileSize > 0) {
      return Number(modelData.fileSize);
    }

    let total = 0;
    total += safeByteLength(modelData.moc3);
    total += safeByteLength(modelData.moc);
    total += safeByteLength(modelData.physics);
    total += safeByteLength(modelData.pose);

    if (Array.isArray(modelData.textures)) {
      for (const tex of modelData.textures) total += safeByteLength(tex?.data);
    }

    const motions = modelData.motions;
    if (motions && typeof motions === 'object') {
      for (const list of Object.values(motions)) {
        if (!Array.isArray(list)) continue;
        for (const item of list) total += safeByteLength(item?.data);
      }
    }

    if (Array.isArray(modelData.expressions)) {
      for (const expr of modelData.expressions) total += safeByteLength(expr?.data);
    }

    return total;
  }

  function formatSizeMb(bytes) {
    const n = Number(bytes) || 0;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  }

  async function serializeLive2DModelData(modelData) {
    const normalizedModel = withResolvedLive2DRuntime(modelData);
    const out = {
      modelId: String(normalizedModel?.modelId || ''),
      runtimeType: String(normalizedModel?.runtimeType || 'legacy'),
      cubismVersion: Number(normalizedModel?.cubismVersion || 0) || null,
      uploadTime: Number(normalizedModel?.uploadTime || 0) || null,
      fileSize: Number(normalizedModel?.fileSize || 0) || null,
      modelJson: normalizedModel?.modelJson || null,
      moc3Base64: null,
      mocBase64: null,
      physicsBase64: null,
      poseBase64: null,
      textures: [],
      motions: {},
      expressions: [],
    };

    const moc3 = toArrayBuffer(normalizedModel?.moc3);
    const moc = toArrayBuffer(normalizedModel?.moc);
    const physics = toArrayBuffer(normalizedModel?.physics);
    const pose = toArrayBuffer(normalizedModel?.pose);
    if (moc3) out.moc3Base64 = arrayBufferToBase64(moc3);
    if (moc) out.mocBase64 = arrayBufferToBase64(moc);
    if (physics) out.physicsBase64 = arrayBufferToBase64(physics);
    if (pose) out.poseBase64 = arrayBufferToBase64(pose);

    if (Array.isArray(normalizedModel?.textures)) {
      for (const tex of normalizedModel.textures) {
        const name = String(tex?.name || '');
        const data = tex?.data;
        if (!data) continue;

        if (typeof Blob !== 'undefined' && data instanceof Blob) {
          const dataBase64 = await blobToBase64(data);
          out.textures.push({
            name,
            mimeType: data.type || 'application/octet-stream',
            dataBase64,
          });
          continue;
        }

        const texBuffer = toArrayBuffer(data);
        if (!texBuffer) continue;
        out.textures.push({
          name,
          mimeType: 'application/octet-stream',
          dataBase64: arrayBufferToBase64(texBuffer),
        });
      }
    }

    const motions = normalizedModel?.motions;
    if (motions && typeof motions === 'object') {
      for (const [groupName, list] of Object.entries(motions)) {
        if (!Array.isArray(list) || list.length === 0) continue;
        const exportedList = [];
        for (const motion of list) {
          const dataBuffer = toArrayBuffer(motion?.data);
          if (!dataBuffer) continue;
          exportedList.push({
            name: String(motion?.name || ''),
            dataBase64: arrayBufferToBase64(dataBuffer),
          });
        }
        if (exportedList.length > 0) out.motions[groupName] = exportedList;
      }
    }

    if (Array.isArray(normalizedModel?.expressions)) {
      for (const expr of normalizedModel.expressions) {
        const dataBuffer = toArrayBuffer(expr?.data);
        if (!dataBuffer) continue;
        out.expressions.push({
          name: String(expr?.name || ''),
          file: String(expr?.file || ''),
          dataBase64: arrayBufferToBase64(dataBuffer),
        });
      }
    }

    return out;
  }

  function idbOpen(dbName) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
      req.onupgradeneeded = () => {
        // Avoid creating stores here. If DB doesn't exist, it will be created empty.
      };
      req.onsuccess = () => resolve(req.result);
    });
  }

  function idbGetAll(db, storeName) {
    return new Promise((resolve) => {
      try {
        if (!db.objectStoreNames.contains(storeName)) return resolve([]);
        const tx = db.transaction([storeName], 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onerror = () => resolve([]);
        req.onsuccess = () => resolve(req.result || []);
      } catch {
        resolve([]);
      }
    });
  }

  function downloadJson(obj, filename) {
    const text = JSON.stringify(obj, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return text;
  }

  async function exportConfig(options = {}) {
    const {
      remoteInput = '',
      targetPackId = null,
      includeAllPacks = true,
      selectedPackId = '',
      spriteResourceMode = '',
      spriteRemoteInput = '',
      backgroundResourceMode = '',
      backgroundRemoteInput = '',
      includeLocalLive2d = false,
      embedLocalLive2d = includeLocalLive2d,
      maxEmbeddedLive2dBytes = DEFAULT_LIVE2D_EMBED_LIMIT_BYTES,
      includeCustomModuleSettings = true,
      includeBgmSettings = true,
    } = options;

    const currentPackId =
      (typeof targetPackId === 'string' && targetPackId.trim()) ||
      String(localStorage.getItem(STORAGE_KEYS.CURRENT_PACK) || '').trim() ||
      DEFAULT_PACK_ID;

    // LocalStorage
    const ttsEnabled = readLocalStorageBool(STORAGE_KEYS.TTS_ENABLED, true);
    const characterVoice = readLocalStorageJson(STORAGE_KEYS.CHAR_TTS_VOICE, {});
    const live2dEnabledMap = readLocalStorageJson(STORAGE_KEYS.CHAR_USE_LIVE2D, {});
    const live2dConfigMap = readLocalStorageJson(STORAGE_KEYS.LIVE2D_CONFIG, {});
    const settings = readLocalStorageJson(STORAGE_KEYS.SETTINGS, {});

    // IndexedDB
    let packs = [];
    let live2dModels = [];
    try {
      const db = await idbOpen(DB_NAME);
      packs = await idbGetAll(db, 'imagePacks');
      live2dModels = await idbGetAll(db, 'live2dModels');
      try { db.close(); } catch {}
    } catch {
      // ignore
    }

    if (!Array.isArray(packs) || packs.length === 0) {
      packs = [{ id: DEFAULT_PACK_ID, name: DEFAULT_PACK_NAME, isDefault: true }];
    }

    const activePackId = includeAllPacks
      ? String(currentPackId)
      : String(selectedPackId || currentPackId || DEFAULT_PACK_ID);
    const normalizedSpriteMode = normalizeRemoteMode(
      spriteResourceMode || ((String(spriteRemoteInput || remoteInput || '').trim()) ? 'remote' : 'local'),
    );
    const normalizedBackgroundMode = normalizeRemoteMode(
      backgroundResourceMode || ((String(backgroundRemoteInput || remoteInput || '').trim()) ? 'remote' : 'local'),
    );
    const normalizedSpriteRemote = normalizedSpriteMode === 'remote'
      ? normalizeRemoteInput(spriteRemoteInput || remoteInput || '')
      : { remoteBaseUrl: '', remoteAssetsUrl: '' };
    const normalizedBackgroundRemote = normalizedBackgroundMode === 'remote'
      ? normalizeRemoteInput(backgroundRemoteInput || remoteInput || '')
      : { remoteBaseUrl: '', remoteAssetsUrl: '' };
    const isUnifiedPackRemote =
      normalizedSpriteMode === 'remote'
      && normalizedBackgroundMode === 'remote'
      && String(normalizedSpriteRemote.remoteAssetsUrl || '')
      && normalizedSpriteRemote.remoteAssetsUrl === normalizedBackgroundRemote.remoteAssetsUrl
      && normalizedSpriteRemote.remoteBaseUrl === normalizedBackgroundRemote.remoteBaseUrl;

    const packList = includeAllPacks
      ? packs
      : packs.filter(p => p && String(p.id) === String(activePackId));

    const exportedPacks = packList.map(p => {
      const packId = String(p.id || DEFAULT_PACK_ID);
      const name = String(p.name || DEFAULT_PACK_NAME);
      const out = { packId, name };
      if (packId === activePackId && isUnifiedPackRemote) {
        if (normalizedSpriteRemote.remoteBaseUrl) out.remoteBaseUrl = normalizedSpriteRemote.remoteBaseUrl;
        if (normalizedSpriteRemote.remoteAssetsUrl) out.remoteAssetsUrl = normalizedSpriteRemote.remoteAssetsUrl;
      }
      return out;
    });

    const live2dOutModels = {};
    const warnings = [];
    if ((normalizedSpriteMode === 'remote' || normalizedBackgroundMode === 'remote') && !isUnifiedPackRemote) {
      warnings.push(
        '[Assets] 立绘/背景采用了分离资源模式。旧版仅识别 packs.remote*，请使用支持 assets.resourceModes 的版本导入。',
      );
    }
    for (const rawModel of Array.isArray(live2dModels) ? live2dModels : []) {
      const m = withResolvedLive2DRuntime(rawModel);
      const characterId = String(m?.modelId || '').trim();
      if (!characterId) continue;

      const charCfg = live2dConfigMap && typeof live2dConfigMap === 'object' ? live2dConfigMap[characterId] : null;

      if (m?.source === 'remote' && typeof m?.modelUrl === 'string' && m.modelUrl.trim()) {
        live2dOutModels[characterId] = {
          source: 'remote',
          modelUrl: m.modelUrl.trim(),
          runtimeType: m.runtimeType || 'legacy',
          cubismVersion: Number(m?.cubismVersion || 0) || null,
          ...(charCfg ? { config: charCfg } : {}),
        };
        continue;
      }

      const modelSizeBytes = estimateLive2DModelSizeBytes(m);

      if (embedLocalLive2d) {
        const overLimit =
          Number.isFinite(maxEmbeddedLive2dBytes) &&
          maxEmbeddedLive2dBytes > 0 &&
          modelSizeBytes > maxEmbeddedLive2dBytes;

        if (overLimit) {
          const warn =
            `[Live2D] ${characterId} 大小 ${formatSizeMb(modelSizeBytes)} 超过 Discord 限制阈值 ` +
            `${formatSizeMb(maxEmbeddedLive2dBytes)}，已跳过本体导出，建议上传 GitHub 后改用远程 URL。`;
          warnings.push(warn);
          live2dOutModels[characterId] = {
            source: 'idb',
            modelId: characterId,
            runtimeType: m.runtimeType || 'legacy',
            cubismVersion: Number(m?.cubismVersion || 0) || null,
            sizeBytes: modelSizeBytes,
            note: warn,
            ...(charCfg ? { config: charCfg } : {}),
          };
          continue;
        }

        try {
          const payload = await serializeLive2DModelData(m);
          live2dOutModels[characterId] = {
            source: 'embedded',
            format: 'live2d_idb_v1',
            runtimeType: m.runtimeType || 'legacy',
            cubismVersion: Number(m?.cubismVersion || 0) || null,
            sizeBytes: modelSizeBytes,
            payload,
            ...(charCfg ? { config: charCfg } : {}),
          };
        } catch (e) {
          const errMsg = e && e.message ? e.message : String(e);
          const warn = `[Live2D] ${characterId} 本体导出失败，已退回占位记录：${errMsg}`;
          warnings.push(warn);
          live2dOutModels[characterId] = {
            source: 'idb',
            modelId: characterId,
            runtimeType: m.runtimeType || 'legacy',
            cubismVersion: Number(m?.cubismVersion || 0) || null,
            sizeBytes: modelSizeBytes,
            note: warn,
            ...(charCfg ? { config: charCfg } : {}),
          };
        }
        continue;
      }

      if (includeLocalLive2d) {
        live2dOutModels[characterId] = {
          source: 'idb',
          modelId: characterId,
          runtimeType: m.runtimeType || 'legacy',
          cubismVersion: Number(m?.cubismVersion || 0) || null,
          sizeBytes: modelSizeBytes,
          note:
            'Local Live2D model is stored in IndexedDB; binary payload is not exported. Upload to remote and use source=remote if you want portability.',
          ...(charCfg ? { config: charCfg } : {}),
        };
      }
    }

    const cfg = {
      schema: 'galgame_ui_plugin_config_v2',
      meta: {
        exportedAt: new Date().toISOString(),
        exporter: 'export-galgame-ui-plugin-config.js',
        live2dExportMode: embedLocalLive2d ? 'embedded' : (includeLocalLive2d ? 'idb-placeholder' : 'skip-local'),
        maxEmbeddedLive2dBytes: Number(maxEmbeddedLive2dBytes) || DEFAULT_LIVE2D_EMBED_LIMIT_BYTES,
        discordUploadLimitBytes: DISCORD_UPLOAD_LIMIT_BYTES,
        ...(warnings.length > 0 ? { warnings } : {}),
      },
      assets: {
        activePackId,
        packs: exportedPacks,
        resourceModes: {
          sprites: {
            mode: normalizedSpriteMode,
            ...(normalizedSpriteMode === 'remote' ? normalizedSpriteRemote : {}),
          },
          backgrounds: {
            mode: normalizedBackgroundMode,
            ...(normalizedBackgroundMode === 'remote' ? normalizedBackgroundRemote : {}),
          },
          live2d: {
            mode: embedLocalLive2d ? 'embedded' : (includeLocalLive2d ? 'idb-placeholder' : 'skip-local'),
            includeLocalPlaceholder: !embedLocalLive2d && !!includeLocalLive2d,
          },
        },
      },
      live2d: {
        enabledMap: live2dEnabledMap || {},
        models: live2dOutModels,
      },
      tts: {
        enabled: !!ttsEnabled,
        characterVoice: characterVoice || {},
      },
    };

    if (includeCustomModuleSettings) {
      cfg.custom = {
        locationStatusHtml: String(localStorage.getItem(STORAGE_KEYS.CUSTOM_LOCATION_HTML) || ''),
        timeStatusHtml: String(localStorage.getItem(STORAGE_KEYS.CUSTOM_TIME_HTML) || ''),
      };
    }

    if (includeBgmSettings) {
      cfg.bgm = {
        whitelist: normalizeStringList(settings?.bgmWhitelist),
      };
    }

    return cfg;
  }

  async function runInteractive() {
    const remoteInput = prompt(
      '请输入远程资源配置:\n- 可填 baseUrl (例如 https://cdn.jsdelivr.net/gh/user/repo@main/ )\n- 或直接填 remote_assets.json 完整 URL\n\n留空则只导出 Live2D/TTS 等配置（图包远程指针不填）',
      '',
    );

    const includeAllPacks = confirm('是否导出所有图包记录？\n是=保留 packs 列表（推荐）\n否=只导出当前图包');
    const embedLocalLive2d = confirm(
      '本地 Live2D 导出策略：\n是=导出本体（嵌入配置，体积较大）\n否=不导出本体',
    );

    let includeLocalLive2d = false;
    let maxEmbeddedLive2dBytes = DEFAULT_LIVE2D_EMBED_LIMIT_BYTES;

    if (embedLocalLive2d) {
      const limitInput = prompt(
        '请输入本地 Live2D 本体导出阈值（MB）。\n超过阈值将自动跳过本体并建议改用 GitHub 远程导出。\n默认 25',
        '25',
      );
      const parsedMb = Number(limitInput);
      if (Number.isFinite(parsedMb) && parsedMb > 0) {
        maxEmbeddedLive2dBytes = Math.floor(parsedMb * 1024 * 1024);
      }
    } else {
      includeLocalLive2d = confirm(
        '是否保留本地 Live2D 占位记录（不含本体）？\n是=导出 modelId 提示\n否=跳过本地模型导出',
      );
    }

    const cfg = await exportConfig({
      remoteInput,
      includeAllPacks,
      includeLocalLive2d,
      embedLocalLive2d,
      maxEmbeddedLive2dBytes,
    });

    const text = JSON.stringify(cfg, null, 2);
    const bytes = new TextEncoder().encode(text).length;
    if (bytes > DISCORD_UPLOAD_LIMIT_BYTES) {
      throw new Error(
        `导出失败：配置体积 ${formatSizeMb(bytes)} 超过 Discord 限制 ${formatSizeMb(DISCORD_UPLOAD_LIMIT_BYTES)}。请改用远程资源导出。`,
      );
    }

    const date = new Date().toISOString().slice(0, 10);
    const filename = `galgame-ui-plugin.config.${date}.json`;
    downloadJson(cfg, filename);

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        console.log('[GalgameUiPluginConfigExporter] 已复制到剪贴板');
      }
    } catch {
      // ignore
    }

    console.log('[GalgameUiPluginConfigExporter] 导出完成:', cfg);
    if (Array.isArray(cfg?.meta?.warnings) && cfg.meta.warnings.length > 0) {
      console.warn('[GalgameUiPluginConfigExporter] 导出警告:');
      cfg.meta.warnings.forEach((w, idx) => console.warn(`${idx + 1}. ${w}`));
    }
    return cfg;
  }

  window.GalgameUiPluginConfigExporter = {
    exportConfig,
    runInteractive,
    downloadJson,
  };

  console.log('[GalgameUiPluginConfigExporter] Ready. Run: GalgameUiPluginConfigExporter.runInteractive()');
})();

