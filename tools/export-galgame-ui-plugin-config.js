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

  const STORAGE_KEYS = {
    CURRENT_PACK: `${SCRIPT_ID}_current_pack`,
    CHAR_TTS_VOICE: `${SCRIPT_ID}_char_tts_voice`,
    TTS_ENABLED: `${SCRIPT_ID}_tts_enabled`,
    CHAR_USE_LIVE2D: `${SCRIPT_ID}_char_use_live2d`,
    LIVE2D_CONFIG: `${SCRIPT_ID}_live2d_config`,
  };

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
      includeLocalLive2d = false,
    } = options;

    const currentPackId =
      (typeof targetPackId === 'string' && targetPackId.trim()) ||
      String(localStorage.getItem(STORAGE_KEYS.CURRENT_PACK) || '').trim() ||
      DEFAULT_PACK_ID;

    const { remoteBaseUrl, remoteAssetsUrl } = normalizeRemoteInput(remoteInput);

    // LocalStorage
    const ttsEnabled = readLocalStorageBool(STORAGE_KEYS.TTS_ENABLED, true);
    const characterVoice = readLocalStorageJson(STORAGE_KEYS.CHAR_TTS_VOICE, {});
    const live2dEnabledMap = readLocalStorageJson(STORAGE_KEYS.CHAR_USE_LIVE2D, {});
    const live2dConfigMap = readLocalStorageJson(STORAGE_KEYS.LIVE2D_CONFIG, {});

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

    const packList = includeAllPacks
      ? packs
      : packs.filter(p => p && String(p.id) === String(currentPackId));

    const exportedPacks = packList.map(p => {
      const packId = String(p.id || DEFAULT_PACK_ID);
      const name = String(p.name || DEFAULT_PACK_NAME);
      const out = { packId, name };
      if (packId === currentPackId && (remoteBaseUrl || remoteAssetsUrl)) {
        if (remoteBaseUrl) out.remoteBaseUrl = remoteBaseUrl;
        if (remoteAssetsUrl) out.remoteAssetsUrl = remoteAssetsUrl;
      }
      return out;
    });

    const live2dOutModels = {};
    for (const m of Array.isArray(live2dModels) ? live2dModels : []) {
      const characterId = String(m?.modelId || '').trim();
      if (!characterId) continue;

      const charCfg = live2dConfigMap && typeof live2dConfigMap === 'object' ? live2dConfigMap[characterId] : null;

      if (m?.source === 'remote' && typeof m?.modelUrl === 'string' && m.modelUrl.trim()) {
        live2dOutModels[characterId] = {
          source: 'remote',
          modelUrl: m.modelUrl.trim(),
          ...(charCfg ? { config: charCfg } : {}),
        };
        continue;
      }

      if (includeLocalLive2d) {
        live2dOutModels[characterId] = {
          source: 'idb',
          modelId: characterId,
          note:
            'Local Live2D model is stored in IndexedDB; binary payload is not exported. Upload to remote and use source=remote if you want portability.',
          ...(charCfg ? { config: charCfg } : {}),
        };
      }
    }

    const cfg = {
      schema: 'galgame_ui_plugin_config_v1',
      meta: {
        exportedAt: new Date().toISOString(),
        exporter: 'export-galgame-ui-plugin-config.js',
      },
      assets: {
        activePackId: currentPackId,
        packs: exportedPacks,
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

    return cfg;
  }

  async function runInteractive() {
    const remoteInput = prompt(
      '请输入远程资源配置:\n- 可填 baseUrl (例如 https://cdn.jsdelivr.net/gh/user/repo@main/ )\n- 或直接填 remote_assets.json 完整 URL\n\n留空则只导出 Live2D/TTS 等配置（图包远程指针不填）',
      '',
    );

    const includeAllPacks = confirm('是否导出所有图包记录？\n是=保留 packs 列表（推荐）\n否=只导出当前图包');
    const includeLocalLive2d = confirm('是否在导出中包含本地 Live2D（IndexedDB）占位记录？\n注意：不会导出二进制模型数据，只会留一条提示。');

    const cfg = await exportConfig({ remoteInput, includeAllPacks, includeLocalLive2d });

    const date = new Date().toISOString().slice(0, 10);
    const filename = `galgame-ui-plugin.config.${date}.json`;
    const text = downloadJson(cfg, filename);

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        console.log('[GalgameUiPluginConfigExporter] 已复制到剪贴板');
      }
    } catch {
      // ignore
    }

    console.log('[GalgameUiPluginConfigExporter] 导出完成:', cfg);
    return cfg;
  }

  window.GalgameUiPluginConfigExporter = {
    exportConfig,
    runInteractive,
    downloadJson,
  };

  console.log('[GalgameUiPluginConfigExporter] Ready. Run: GalgameUiPluginConfigExporter.runInteractive()');
})();

