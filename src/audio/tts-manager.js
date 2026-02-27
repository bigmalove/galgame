import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow, $ } from '../core/env.js';
import { getSettings } from '../core/settings.js';
import {
  TTS_PROVIDER,
  getTTSProvider,
  getGptSoVitsConfig,
  getCharacterTTSVoice,
  resolveVoiceByName,
  inferResourceId,
  normalizeGptSoVitsSwitchMode,
} from './tts-config.js';
import { Live2DManager } from '../live2d/manager.js';
import { LipSyncManager } from '../live2d/lip-sync.js';
import { hasLive2DModel } from '../db/live2d-models.js';
import { synthesizeToBlob } from './edge-tts-direct.js';

// 延迟引用: showToast (来自 UI 层)
let _showToastRef = null;
export function setTTSManagerRefs({ showToast }) {
  if (showToast) _showToastRef = showToast;
}

function showToast(msg) {
  if (_showToastRef) _showToastRef(msg);
}

function clipText(text, max = 160) {
  const value = String(text || '');
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

function getSegmentSpeakText(segment) {
  if (!segment || typeof segment !== 'object') return '';
  const ttsText = String(segment.ttsText ?? '').trim();
  if (ttsText) return ttsText;
  return String(segment.text ?? '').trim();
}

function isProxyNotFound(status, bodyText = '') {
  if (status !== 404) return false;
  const body = String(bodyText || '').toLowerCase();
  return body.includes('not found') || body.includes('/proxy') || body.includes('cannot get');
}

function safeUrl(input) {
  try {
    return new URL(String(input || ''));
  } catch (e) {
    return null;
  }
}

function _safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function _safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function _toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function _normalizePathSep(path) {
  return String(path || '').replace(/\\+/g, '/').trim();
}

function _normalizeExpressionLookupKey(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function _looksLikeAbsoluteFsPath(path) {
  const p = String(path || '');
  return /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('/');
}

function _dedupePayloadVariants(list) {
  const out = [];
  const seen = new Set();
  for (const item of _safeArray(list)) {
    try {
      const key = JSON.stringify(item);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    } catch (e) {
      out.push(item);
    }
  }
  return out;
}

// ============================================
// TTS 管理器 (LittleWhiteBox / GPT-SoVITS)
// ============================================
export const TTSManager = {
  enabled: true,
  provider: TTS_PROVIDER.LITTLEWHITEBOX,
  autoPlay: true,
  isPlaying: false,
  isLoading: false,
  currentAudio: null,
  currentSegmentId: null,
  littleWhiteBox: null,
  xiaobaixTts: null,
  _activePlaybackSessionId: 0,
  _gptSoVitsResolvedProxyRoute: '',
  _gptSoVitsActiveWeights: { gpt: '', sovits: '' },
  _gptSoVitsWeightSwitchUnavailable: false,
  _gptSoVitsWeightSwitchWarned: false,
  _gptSoVitsProxyWarned: false,
  _gptSoVitsStreamingWarned: false,
  _gptSoVitsSwitchTask: Promise.resolve(),
  _gptSoVitsFetchController: null,
  _gptSoVitsAbortController: null,
  _gptSoVitsAbortSessionId: 0,
  _gptSoVitsCurrentObjectUrl: '',
  _edgeDirectFetchController: null,
  _edgeDirectSocket: null,
  _edgeDirectObjectUrl: '',

  _refreshProviderState() {
    const provider = getTTSProvider();
    this.provider = provider;
    this.autoPlay = getSettings()?.ttsAutoPlay !== false;

    if (provider === TTS_PROVIDER.LITTLEWHITEBOX) {
      if (topWindow.xiaobaixTts) {
        this.xiaobaixTts = topWindow.xiaobaixTts;
        console.log(`[${SCRIPT_NAME}] TTSManager: 已连接到 xiaobaixTts`);
      } else if (topWindow.LittleWhiteBox) {
        this.littleWhiteBox = topWindow.LittleWhiteBox;
        console.log(`[${SCRIPT_NAME}] TTSManager: 已连接到 LittleWhiteBox`);
      }

      if (!this.xiaobaixTts && !this.littleWhiteBox) {
        console.warn(`[${SCRIPT_NAME}] TTSManager: 未找到 xiaobaixTts/LittleWhiteBox，将禁用TTS`);
        this.enabled = false;
        return false;
      }

      this.enabled = true;
      return true;
    }

    if (provider === TTS_PROVIDER.GPT_SOVITS_V2) {
      this.enabled = true;
      return true;
    }

    if (provider === TTS_PROVIDER.EDGE_TTS_DIRECT) {
      this.enabled = true;
      return true;
    }

    this.enabled = true;
    return true;
  },

  _onPlaybackEnded(reason = 'unknown') {
    this._cleanupEdgeDirectResources();
    console.log(`[${SCRIPT_NAME}] TTS: 播放结束 - reason=${reason}`);
    this.isPlaying = false;
    this.isLoading = false;
    this.currentAudio = null;
    this.currentSegmentId = null;
    this.hideLoadingIndicator();
    this._revokeGptSoVitsObjectUrl();
    LipSyncManager.stopSync();
  },

  init() {
    this._refreshProviderState();

    $(topWindow).on('tts_complete tts_end', () => {
      this._onPlaybackEnded('littlewhitebox_event');
    });
  },

  showLoadingIndicator() {
    $('.gal-char-container.speaking').addClass('tts-active');
  },

  hideLoadingIndicator() {
    $('.gal-char-container').removeClass('tts-active');
  },

  _isPlaybackSessionActive(sessionId) {
    return Number(sessionId) > 0 && Number(sessionId) === Number(this._activePlaybackSessionId || 0);
  },

  _abortGptSoVitsFetch(reason = 'manual') {
    if (this._gptSoVitsFetchController) {
      try {
        this._gptSoVitsFetchController.abort(reason);
      } catch (e) {}
      this._gptSoVitsFetchController = null;
    }
    if (this._gptSoVitsAbortController) {
      try {
        this._gptSoVitsAbortController.abort(reason);
      } catch (e) {}
      this._gptSoVitsAbortController = null;
      this._gptSoVitsAbortSessionId = 0;
    }
  },

  _cleanupEdgeDirectResources() {
    if (this._edgeDirectFetchController) {
      try {
        this._edgeDirectFetchController.abort('cleanup');
      } catch (e) {}
      this._edgeDirectFetchController = null;
    }

    if (this._edgeDirectSocket) {
      try {
        this._edgeDirectSocket.close(1000, 'cleanup');
      } catch (e) {}
      this._edgeDirectSocket = null;
    }

    if (this._edgeDirectObjectUrl) {
      try {
        URL.revokeObjectURL(this._edgeDirectObjectUrl);
      } catch (e) {}
      this._edgeDirectObjectUrl = '';
    }
  },

  _getOrCreateGptSoVitsAbortController(playbackSessionId) {
    const sid = Number(playbackSessionId || 0);
    if (!this._isPlaybackSessionActive(sid)) return null;
    if (this._gptSoVitsAbortController && Number(this._gptSoVitsAbortSessionId || 0) === sid) {
      return this._gptSoVitsAbortController;
    }
    this._gptSoVitsAbortSessionId = sid;
    this._gptSoVitsAbortController = new AbortController();
    return this._gptSoVitsAbortController;
  },

  _getGptSoVitsAbortSignal(playbackSessionId) {
    const controller = this._getOrCreateGptSoVitsAbortController(playbackSessionId);
    return controller ? controller.signal : null;
  },

  _revokeGptSoVitsObjectUrl() {
    const url = String(this._gptSoVitsCurrentObjectUrl || '').trim();
    if (!url) return;
    try {
      URL.revokeObjectURL(url);
    } catch (e) {}
    this._gptSoVitsCurrentObjectUrl = '';
  },

  stop() {
    if (
      !this.isPlaying &&
      !this.isLoading &&
      !this._edgeDirectSocket &&
      !this._edgeDirectFetchController &&
      !this._edgeDirectObjectUrl
    ) {
      return;
    }

    this._activePlaybackSessionId = Number(this._activePlaybackSessionId || 0) + 1;
    this._abortGptSoVitsFetch('stop');
    this._cleanupEdgeDirectResources();
    console.log(`[${SCRIPT_NAME}] TTS: 中止当前播放`);

    try {
      if (this.currentAudio && typeof this.currentAudio.pause === 'function') {
        try { this.currentAudio.pause(); } catch (e) {}
        try {
          this.currentAudio.src = '';
          if (typeof this.currentAudio.load === 'function') this.currentAudio.load();
        } catch (e) {}
      }

      if (this.xiaobaixTts && this.xiaobaixTts.player) {
        const player = this.xiaobaixTts.player;
        if (typeof player._stopCurrent === 'function') {
          player._stopCurrent();
        }
        if (typeof player.clear === 'function') {
          player.clear();
          console.log(`[${SCRIPT_NAME}] TTS: 已清空播放队列`);
        }
      } else if (this.xiaobaixTts && typeof this.xiaobaixTts.stop === 'function') {
        this.xiaobaixTts.stop();
      } else if (this.littleWhiteBox && typeof this.littleWhiteBox.stop === 'function') {
        this.littleWhiteBox.stop();
      }
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] TTS: 停止播放失败`, e);
    }

    this.isPlaying = false;
    this.isLoading = false;
    this.currentAudio = null;
    this.currentSegmentId = null;
    this.hideLoadingIndicator();
    this._revokeGptSoVitsObjectUrl();
    LipSyncManager.stopSync();
  },

  _getCurrentAudioElement() {
    if (this.currentAudio) return this.currentAudio;

    if (this.xiaobaixTts?.player?.currentAudio) {
      return this.xiaobaixTts.player.currentAudio;
    }
    if (this.xiaobaixTts?.player?.audio) {
      return this.xiaobaixTts.player.audio;
    }
    if (this.xiaobaixTts?.player?.audioElements?.length > 0) {
      return this.xiaobaixTts.player.audioElements[0];
    }
    if (this.xiaobaixTts?.audio) {
      return this.xiaobaixTts.audio;
    }

    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
    const allAudio = _topWindow.document.querySelectorAll('audio');
    for (const audio of allAudio) {
      if (audio.src && !audio.paused) {
        return audio;
      }
    }
    const anyAudio = _topWindow.document.querySelector('audio[src]');
    if (anyAudio) return anyAudio;
    return null;
  },

  _getPreferredAudioElement() {
    if (this.currentAudio) return this.currentAudio;
    if (this.xiaobaixTts?.player?.currentAudio) {
      return this.xiaobaixTts.player.currentAudio;
    }
    if (this.xiaobaixTts?.player?.audio) {
      return this.xiaobaixTts.player.audio;
    }
    if (this.xiaobaixTts?.player?.audioElements?.length > 0) {
      return this.xiaobaixTts.player.audioElements[0];
    }
    if (this.xiaobaixTts?.audio) {
      return this.xiaobaixTts.audio;
    }
    return null;
  },

  _resolveGptSoVitsServerPath(pathStr, cfg = null) {
    const raw = _normalizePathSep(pathStr);
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (_looksLikeAbsoluteFsPath(raw)) return raw;
    return raw;
  },

  _buildGptSoVitsRefAudioPathCandidates(pathStr, options = null) {
    const opts = _safeObject(options);
    const modelCfg = _safeObject(opts.modelCfg);
    const voiceCfg = _safeObject(opts.voiceCfg);
    const rawSeed = _normalizePathSep(pathStr);
    const rawFromVoice = _normalizePathSep(opts.rawRefPath || voiceCfg.refAudioPath || '');

    const out = [];
    const seen = new Set();
    const addOne = value => {
      const v = _normalizePathSep(value);
      if (!v || seen.has(v)) return;
      seen.add(v);
      out.push(v);
    };
    const addPath = value => {
      const v = _normalizePathSep(value);
      if (!v) return;
      addOne(v);
      try { addOne(v.normalize('NFC')); } catch (e) {}
      try { addOne(v.normalize('NFD')); } catch (e) {}
      try { addOne(v.normalize('NFKC')); } catch (e) {}
      try { addOne(v.normalize('NFKD')); } catch (e) {}
      addOne(v.replace(/\//g, '\\'));
      addOne(v.replace(/\\/g, '/'));
    };
    const dirname = p => {
      const s = _normalizePathSep(p);
      if (!s) return '';
      const idx = s.lastIndexOf('/');
      if (idx <= 0) return '';
      return s.slice(0, idx);
    };
    const basename = p => {
      const s = _normalizePathSep(p);
      if (!s) return '';
      const idx = s.lastIndexOf('/');
      return idx < 0 ? s : s.slice(idx + 1);
    };
    const extractDrive = p => {
      const m = String(p || '').match(/^([a-zA-Z]):[\\/]/);
      return m ? m[1].toUpperCase() : '';
    };

    const seedSources = [];
    const pushSeed = value => {
      const v = _normalizePathSep(value);
      if (!v) return;
      if (seedSources.includes(v)) return;
      seedSources.push(v);
    };

    pushSeed(rawSeed);
    pushSeed(rawFromVoice);
    pushSeed(modelCfg?.paths?.defaultRefAudioPath);
    for (const ref of _safeArray(modelCfg?.refAudios)) {
      pushSeed(ref?.path);
    }

    for (const seed of seedSources) addPath(seed);

    const mainSeed = seedSources[0] || '';
    const fileName = basename(mainSeed);
    const segs = _normalizePathSep(mainSeed).split('/').filter(Boolean);
    const tail2 = segs.length >= 2 ? `${segs[segs.length - 2]}/${segs[segs.length - 1]}` : '';
    const tail3 = segs.length >= 3 ? `${segs[segs.length - 3]}/${segs[segs.length - 2]}/${segs[segs.length - 1]}` : '';

    const weightPaths = []
      .concat([
        voiceCfg.gptWeightsPath,
        voiceCfg.sovitsWeightsPath,
        modelCfg?.paths?.gptWeightsPath,
        modelCfg?.paths?.sovitsWeightsPath,
      ])
      .map(v => _normalizePathSep(v))
      .filter(Boolean);
    const weightDirs = [];
    for (const p of weightPaths) {
      const d = dirname(p);
      if (d && !weightDirs.includes(d)) weightDirs.push(d);
    }
    for (const d of weightDirs) {
      if (fileName) addPath(`${d}/${fileName}`);
      if (tail2) addPath(`${d}/${tail2}`);
      if (tail3) addPath(`${d}/${tail3}`);
    }

    const seedDrive = extractDrive(mainSeed);
    const altDrives = [];
    for (const p of weightPaths) {
      const d = extractDrive(p);
      if (d && d !== seedDrive && !altDrives.includes(d)) altDrives.push(d);
    }
    if (seedDrive) {
      const snapshot = out.slice();
      for (const item of snapshot) {
        if (!new RegExp(`^${seedDrive}:`, 'i').test(item)) continue;
        for (const d of altDrives) {
          addPath(item.replace(new RegExp(`^${seedDrive}:`, 'i'), `${d}:`));
        }
      }
    }

    const wavePairs = [
      ['\u301C', '\uFF5E'],
      ['\u301C', '~'],
      ['\uFF5E', '\u301C'],
      ['\uFF5E', '~'],
      ['~', '\u301C'],
      ['~', '\uFF5E'],
    ];
    for (const [from, to] of wavePairs) {
      const snapshot = out.slice();
      for (const item of snapshot) {
        if (!item.includes(from)) continue;
        addPath(item.split(from).join(to));
      }
    }

    return out.slice(0, 64);
  },

  _isProxyUrl(url) {
    const parsed = safeUrl(url);
    if (!parsed) return false;
    return /^\/proxy(\/|\?|$)/i.test(parsed.pathname);
  },

  _getGptSoVitsProxyUrlFromHelpers(directUrl) {
    const url = String(directUrl || '').trim();
    if (!url) return '';

    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
    const helperFns = [
      _topWindow.getCorsProxyUrl,
      _topWindow.enableCorsProxy,
      _topWindow.corsProxy?.getProxyUrl,
      window.getCorsProxyUrl,
      window.enableCorsProxy,
      window.corsProxy?.getProxyUrl,
    ].filter(fn => typeof fn === 'function');

    for (const fn of helperFns) {
      try {
        const proxied = fn.call(_topWindow, url);
        if (typeof proxied === 'string' && proxied.trim()) return proxied.trim();
      } catch (e) {}
    }

    return '';
  },

  _buildGptSoVitsProxyUrl(route, directUrl) {
    const targetUrl = String(directUrl || '').trim();
    if (!targetUrl) return '';

    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
    const origin = String(_topWindow.location?.origin || window.location?.origin || '').replace(/\/+$/, '');
    const encoded = encodeURIComponent(targetUrl);

    const buildProxyPathRawTarget = url => {
      const raw = String(url || '').trim();
      if (!raw) return '';
      const noHash = raw.split('#')[0] || raw;
      const qIdx = noHash.indexOf('?');
      if (qIdx < 0) return noHash;
      const base = noHash.slice(0, qIdx);
      const query = noHash.slice(qIdx + 1);
      return `${base}%3F${query.replace(/&/g, '%26').replace(/=/g, '%3D')}`;
    };

    const rawTarget = buildProxyPathRawTarget(targetUrl);

    switch (route) {
      case 'helper':
        return this._getGptSoVitsProxyUrlFromHelpers(targetUrl);
      case 'proxy_path_raw_relative':
        return rawTarget ? `/proxy/${rawTarget}` : '';
      case 'proxy_path_raw_origin':
        return origin && rawTarget ? `${origin}/proxy/${rawTarget}` : '';
      case 'proxy_path_relative':
        return `/proxy/${encoded}`;
      case 'proxy_path_origin':
        return origin ? `${origin}/proxy/${encoded}` : '';
      case 'proxy_query_relative':
        return `/proxy?url=${encoded}`;
      case 'proxy_query_origin':
        return origin ? `${origin}/proxy?url=${encoded}` : '';
      case 'direct':
        return targetUrl;
      default:
        return '';
    }
  },

  _rememberProxyRoute(route, url) {
    const nextRoute = String(route || '').trim() || 'direct';
    if (this._gptSoVitsResolvedProxyRoute === nextRoute) return;
    this._gptSoVitsResolvedProxyRoute = nextRoute;
    if (nextRoute === 'direct') return;
    const shortUrl = String(url || '').slice(0, 180);
    console.log(`[${SCRIPT_NAME}] GPT-SoVITS proxy route locked: ${nextRoute} -> ${shortUrl}`);
    return;
    if (!route) return;
    if (this._gptSoVitsResolvedProxyRoute !== route) {
      this._gptSoVitsResolvedProxyRoute = route;
      console.log(`[${SCRIPT_NAME}] GPT-SoVITS 代理路由已锁定: ${route} -> ${clipText(url, 96)}`);
    }
  },

  _buildGptSoVitsApiCandidates(directUrl, useCorsProxy = true) {
    const candidates = [];
    const seen = new Set();

    const addCandidate = route => {
      const built = this._buildGptSoVitsProxyUrl(route, directUrl);
      const url = String(built || '').trim();
      if (!url || seen.has(url)) return;
      seen.add(url);
      candidates.push({ route, url });
    };

    if (!useCorsProxy) {
      addCandidate('direct');
      return candidates;
    }

    const preferred = String(this._gptSoVitsResolvedProxyRoute || '').trim();
    if (preferred) addCandidate(preferred);

    addCandidate('helper');
    addCandidate('proxy_path_raw_relative');
    addCandidate('proxy_path_raw_origin');
    addCandidate('proxy_path_relative');
    addCandidate('proxy_path_origin');
    addCandidate('proxy_query_relative');
    addCandidate('proxy_query_origin');
    addCandidate('direct');

    return candidates;
  },

  _shouldAttachStProxyHeaders(route, url) {
    if (route === 'direct') return false;
    const raw = String(url || '').trim();
    if (!raw) return false;
    if (raw.startsWith('/proxy/')) return true;
    if (raw.startsWith('/proxy?')) return true;

    const parsed = safeUrl(raw);
    const origin = String(window.location?.origin || '').trim();
    if (!parsed || !origin) return false;
    return parsed.origin === origin && /^\/proxy(\/|\?|$)/i.test(parsed.pathname);
  },

  _getSillyTavernRequestHeaders() {
    const candidates = [
      window.getRequestHeaders,
      topWindow?.getRequestHeaders,
      topWindow?.SillyTavern?.getRequestHeaders,
      window?.SillyTavern?.getRequestHeaders,
    ];

    for (const getter of candidates) {
      if (typeof getter !== 'function') continue;
      try {
        const headers = getter();
        if (headers && typeof headers === 'object') {
          return { ...headers };
        }
      } catch (e) {}
    }

    return {};
  },

  _isGptSoVitsProxyNotFound(status, text) {
    if (Number(status) !== 404) return false;
    const body = String(text || '');
    return /not found|cannot\s+(get|post)\s+\/proxy|<title>\s*not found\s*<\/title>/i.test(body);
  },

  _summarizeGptSoVitsApiText(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('<')) {
      const pre = trimmed.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
      if (pre?.[1]) {
        return String(pre[1]).replace(/\[\d{1,3}m/g, '').replace(/\s+/g, ' ').trim();
      }
      const title = trimmed.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (title?.[1]) {
        return String(title[1]).replace(/\s+/g, ' ').trim();
      }
      return 'html response';
    }

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const data = JSON.parse(trimmed);
        if (Array.isArray(data)) return trimmed;

        let detailMsg = '';
        const detail = data?.detail;
        if (Array.isArray(detail)) {
          detailMsg = detail
            .slice(0, 3)
            .map(item => {
              if (typeof item === 'string') return item;
              if (!item || typeof item !== 'object') return String(item);
              const loc = Array.isArray(item.loc) ? item.loc.filter(Boolean).join('.') : '';
              const msg = String(item.msg || item.message || item.type || '').trim();
              return loc ? `${loc}: ${msg || 'invalid value'}` : (msg || 'invalid value');
            })
            .join(' | ');
        } else if (detail && typeof detail === 'object') {
          detailMsg = String(detail.message || detail.msg || detail.error || '').trim();
        } else if (detail !== undefined && detail !== null) {
          detailMsg = String(detail).trim();
        }

        const msg = String(data?.message || data?.error || '').trim();
        const ex = String(data?.Exception || data?.exception || data?.traceback || data?.trace || '').trim();
        if (msg && ex && ex !== msg) return `${msg}: ${ex}`;
        return msg || detailMsg || ex || trimmed;
      } catch (e) {}
    }

    return trimmed;
  },

  _getProxiedAudioUrl(originalUrl) {
    const directUrl = String(originalUrl || '').trim();
    if (!directUrl) return directUrl;
    if (this._isProxyUrl(directUrl)) return directUrl;

    const helperUrl = this._getGptSoVitsProxyUrlFromHelpers(directUrl);
    if (helperUrl) return helperUrl;

    const rememberedRoute = String(this._gptSoVitsResolvedProxyRoute || '').trim();
    if (rememberedRoute && rememberedRoute !== 'direct') {
      const rememberedUrl = this._buildGptSoVitsProxyUrl(rememberedRoute, directUrl);
      if (rememberedUrl) return rememberedUrl;
    }

    if (!this._gptSoVitsProxyWarned) {
      this._gptSoVitsProxyWarned = true;
      console.warn(`[${SCRIPT_NAME}] GPT-SoVITS proxy helper missing, fallback to /proxy route`);
    }

    return this._buildGptSoVitsProxyUrl('proxy_path_raw_relative', directUrl)
      || this._buildGptSoVitsProxyUrl('proxy_path_relative', directUrl)
      || this._buildGptSoVitsProxyUrl('proxy_query_relative', directUrl)
      || directUrl;
  },

  _buildGptSoVitsTtsUrl(text, resolvedVoice) {
    const cfg = getGptSoVitsConfig();
    const base = String(cfg.apiUrl || '').replace(/\/$/, '');
    const endpointRaw = String(cfg.endpoint || '/tts').trim();
    const endpoint = endpointRaw.startsWith('/') ? endpointRaw : `/${endpointRaw}`;
    if (!base) return '';

    try {
      const url = new URL(base + endpoint);
      const vcfg = resolvedVoice?.gptSoVits || {};

      const textLang = String(vcfg.textLang || cfg.textLang || 'auto').trim() || 'auto';
      const promptLang = String(vcfg.promptLang || 'zh').trim() || 'zh';
      const refAudioPath = String(vcfg.refAudioPath || '').trim();
      const promptText = String(vcfg.promptText || '').trim();

      url.searchParams.set('text', text);
      url.searchParams.set('text_lang', textLang);
      url.searchParams.set('ref_audio_path', refAudioPath);
      url.searchParams.set('prompt_lang', promptLang);
      url.searchParams.set('prompt_text', promptText);

      if (cfg.textSplitMethod) url.searchParams.set('text_split_method', String(cfg.textSplitMethod));
      if (cfg.mediaType) url.searchParams.set('media_type', String(cfg.mediaType));
      url.searchParams.set('streaming_mode', cfg.streamingMode ? 'true' : 'false');
      if (cfg.speedFactor) url.searchParams.set('speed_factor', String(cfg.speedFactor));

      return url.toString();
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] GPT-SoVITS: 生成URL失败`, e);
      return '';
    }
  },

  _buildGptSoVitsApiUrl(pathname, queryParams = {}) {
    const cfg = getGptSoVitsConfig();
    const base = String(cfg.apiUrl || '').replace(/\/$/, '');
    if (!base) return '';

    const p = String(pathname || '').trim() || '/';
    const endpoint = p.startsWith('/') ? p : `/${p}`;

    try {
      const url = new URL(base + endpoint);
      for (const [k, v] of Object.entries(queryParams || {})) {
        if (v === undefined || v === null) continue;
        url.searchParams.set(k, String(v));
      }
      return url.toString();
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] GPT-SoVITS build API URL failed`, e);
      return '';
    }
  },

  async _requestGptSoVitsApi(method, pathname, queryParams = {}, jsonBody = undefined, playbackSessionId = null) {
    const cfg2 = getGptSoVitsConfig();
    const httpMethod = String(method || 'GET').trim().toUpperCase() || 'GET';
    const apiDirectUrl = this._buildGptSoVitsApiUrl(pathname, httpMethod === 'GET' ? queryParams : {});
    if (!apiDirectUrl) throw new Error('invalid apiUrl');

    const candidates = this._buildGptSoVitsApiCandidates(apiDirectUrl, !!cfg2.useCorsProxy);
    let lastError = null;
    const routeErrors = [];

    const requestText = async (url, route) => {
      const options = { method: httpMethod };
      const stProxyHeaders = this._shouldAttachStProxyHeaders(route, url) ? this._getSillyTavernRequestHeaders() : {};

      if (httpMethod !== 'GET' && jsonBody !== undefined) {
        options.headers = { ...stProxyHeaders, 'Content-Type': 'application/json' };
        options.body = JSON.stringify(jsonBody || {});
      } else if (Object.keys(stProxyHeaders).length > 0) {
        options.headers = stProxyHeaders;
      }

      const signal = Number(playbackSessionId) > 0 ? this._getGptSoVitsAbortSignal(playbackSessionId) : null;
      if (signal) options.signal = signal;

      const response = await fetch(url, options);
      const text = await response.text().catch(() => '');
      return { ok: response.ok, status: response.status, text, url };
    };

    for (const candidate of candidates) {
      const route = candidate.route;
      const isDirect = route === 'direct';

      try {
        const result = await requestText(candidate.url, route);
        if (result.ok) {
          this._rememberProxyRoute(route, result.url);
          return result.text;
        }

        if (!isDirect && this._isGptSoVitsProxyNotFound(result.status, result.text)) {
          routeErrors.push(`${route}:HTTP404(proxy-not-found)`);
          continue;
        }

        const detail = this._summarizeGptSoVitsApiText(result.text);
        lastError = new Error(detail || `HTTP ${result.status}`);
        routeErrors.push(`${route}:${detail || `HTTP${result.status}`}`);
      } catch (e) {
        if (e?.name === 'AbortError') throw e;
        const message = e?.message || String(e || 'unknown error');
        lastError = new Error(message);
        routeErrors.push(`${route}:${message}`);
      }
    }

    if (lastError) {
      const compactRoutes = routeErrors.slice(0, 4).join(' | ');
      const detail = compactRoutes ? `${lastError.message} [routes: ${compactRoutes}]` : lastError.message;
      throw new Error(detail);
    }

    throw new Error(`request failed: ${httpMethod} ${pathname || ''}`);
    const cfg = getGptSoVitsConfig();
    const base = String(cfg.apiUrl || '').replace(/\/$/, '');
    const pathRaw = String(pathname || '').trim() || '/';
    const path = pathRaw.startsWith('/') ? pathRaw : `/${pathRaw}`;
    if (!base) throw new Error('GPT-SoVITS API 地址为空');

    const directUrlObj = new URL(base + path);
    Object.entries(queryParams || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        directUrlObj.searchParams.set(String(key), String(value));
      }
    });
    const directUrl = directUrlObj.toString();

    const attemptTargets = [];
    if (!cfg.useCorsProxy) {
      attemptTargets.push({ route: 'direct', url: directUrl });
    } else {
      const preferred = String(this._gptSoVitsResolvedProxyRoute || '').trim();
      const seen = new Set();
      const addTarget = (route, url) => {
        if (!url || seen.has(url)) return;
        seen.add(url);
        attemptTargets.push({ route, url });
      };

      if (preferred) addTarget(preferred, this._buildGptSoVitsProxyUrl(preferred, directUrl));
      addTarget('proxy_path_relative', this._buildGptSoVitsProxyUrl('proxy_path_relative', directUrl));
      addTarget('proxy_path_origin', this._buildGptSoVitsProxyUrl('proxy_path_origin', directUrl));
      addTarget('proxy_query_relative', this._buildGptSoVitsProxyUrl('proxy_query_relative', directUrl));
      addTarget('proxy_query_origin', this._buildGptSoVitsProxyUrl('proxy_query_origin', directUrl));
      addTarget('direct', directUrl);
    }

    const errors = [];
    for (const target of attemptTargets) {
      const controller = new AbortController();
      this._gptSoVitsFetchController = controller;

      try {
        const options = {
          method,
          mode: 'cors',
          credentials: 'omit',
          signal: controller.signal,
          headers: {},
        };

        if (jsonBody !== undefined) {
          options.headers['Content-Type'] = 'application/json';
          options.body = JSON.stringify(jsonBody);
        }

        const response = await fetch(target.url, options);
        const text = await response.text();

        if (response.ok) {
          if (target.route !== 'direct') {
            this._rememberProxyRoute(target.route, target.url);
          }
          return { text, status: response.status, url: target.url, route: target.route };
        }

        if (target.route !== 'direct' && isProxyNotFound(response.status, text)) {
          errors.push(`${target.route}:HTTP${response.status}(proxy-not-found)`);
          continue;
        }

        errors.push(`${target.route}:HTTP${response.status}:${clipText(text, 120)}`);
      } catch (e) {
        const msg = e?.message || String(e);
        errors.push(`${target.route}:${msg}`);
      } finally {
        if (this._gptSoVitsFetchController === controller) {
          this._gptSoVitsFetchController = null;
        }
      }
    }

    throw new Error(`${method} ${path} 失败 -> ${errors.join(' | ')}`);
  },

  async _fetchGptSoVitsApi(pathname, queryParams = {}, playbackSessionId = null) {
    return this._requestGptSoVitsApi('GET', pathname, queryParams, undefined, playbackSessionId);
  },

  async _postGptSoVitsApi(pathname, jsonBody = {}, playbackSessionId = null) {
    return this._requestGptSoVitsApi('POST', pathname, {}, jsonBody, playbackSessionId);
  },

  _looksLikeAudioArrayBuffer(arrayBuffer) {
    if (!arrayBuffer || arrayBuffer.byteLength < 4) return false;
    const bytes = new Uint8Array(arrayBuffer.slice(0, 16));

    const c0 = bytes[0] || 0;
    const c1 = bytes[1] || 0;
    const c2 = bytes[2] || 0;
    const c3 = bytes[3] || 0;
    const sig4 = String.fromCharCode(c0, c1, c2, c3);

    if (sig4 === 'RIFF' || sig4 === 'OggS' || sig4 === 'fLaC') return true;
    if (c0 === 0x49 && c1 === 0x44 && c2 === 0x33) return true;
    if (c0 === 0xff && (c1 & 0xe0) === 0xe0) return true;

    return false;
  },

  _extractGptSoVitsAudioRefFromText(text) {
    const raw = String(text || '').trim();
    if (!raw) return '';

    const pickAudioLikeString = value => {
      const v = String(value || '').trim();
      if (!v) return '';
      if (/^data:audio\//i.test(v)) return v;
      if (/^https?:\/\//i.test(v)) return v;
      if (/^[a-zA-Z]:[\\/].+\.(wav|mp3|ogg|flac)(\?.*)?$/i.test(v)) return v;
      if (/^\/.+\.(wav|mp3|ogg|flac)(\?.*)?$/i.test(v)) return v;
      if (/\.(wav|mp3|ogg|flac)(\?.*)?$/i.test(v)) return v;
      return '';
    };

    const deepFind = value => {
      if (!value) return '';
      if (typeof value === 'string') return pickAudioLikeString(value);
      if (Array.isArray(value)) {
        for (const item of value) {
          const found = deepFind(item);
          if (found) return found;
        }
        return '';
      }
      if (typeof value === 'object') {
        const directKeys = ['audio', 'audio_url', 'audioPath', 'audio_path', 'wav', 'wav_path', 'url', 'path'];
        for (const key of directKeys) {
          if (key in value) {
            const found = deepFind(value[key]);
            if (found) return found;
          }
        }
        for (const nested of Object.values(value)) {
          const found = deepFind(nested);
          if (found) return found;
        }
      }
      return '';
    };

    if (raw.startsWith('{') || raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw);
        const found = deepFind(parsed);
        if (found) return found;
      } catch (e) {}
    }

    const httpMatch = raw.match(/https?:\/\/[^\s\"'<>]+\.(wav|mp3|ogg|flac)(\?[^\s\"'<>]*)?/i);
    if (httpMatch?.[0]) return httpMatch[0];
    const localMatch = raw.match(/[a-zA-Z]:[\\/][^\s\"'<>]+\.(wav|mp3|ogg|flac)(\?[^\s\"'<>]*)?/i);
    if (localMatch?.[0]) return localMatch[0];
    return '';
  },

  _isGptSoVitsRefAudioDurationError(message) {
    const msg = String(message || '').toLowerCase();
    return /3\s*[-~]\s*10|between\s*3\s*and\s*10|duration|ref_audio|参考音频|时长/.test(msg);
  },

  _isLikelyGptSoVitsTtsPayloadError(message) {
    if (this._isGptSoVitsRefAudioDurationError(message)) return false;
    const msg = String(message || '').toLowerCase();
    return /400|422|validation|text_lang|prompt_lang|ref_audio_path|refer_audio_path|prompt_text|media_type|streaming_mode|text_split_method/.test(msg);
  },

  _buildGptSoVitsTtsPayloadVariants(payload) {
    const base = _safeObject(payload);
    const variants = [];

    const addVariant = obj => {
      const next = { ...obj };
      Object.keys(next).forEach(key => {
        if (next[key] === undefined || next[key] === null || next[key] === '') delete next[key];
      });
      variants.push(next);
    };

    addVariant(base);
    addVariant({ ...base, text_lang: 'auto' });

    const minimal = { ...base };
    delete minimal.media_type;
    delete minimal.streaming_mode;
    delete minimal.text_split_method;
    delete minimal.speed_factor;
    addVariant(minimal);

    if (minimal.ref_audio_path) {
      const alias = { ...minimal, refer_audio_path: minimal.ref_audio_path };
      delete alias.ref_audio_path;
      addVariant(alias);
    }

    const refPath = String(minimal.ref_audio_path || base.ref_audio_path || '').trim();
    if (refPath && refPath.includes('/')) {
      const winRef = refPath.replace(/\//g, '\\');
      addVariant({ ...minimal, ref_audio_path: winRef });
      addVariant({ ...minimal, ref_audio_path: winRef, text_lang: 'auto' });
    }

    return _dedupePayloadVariants(variants);
  },

  async _fetchGptSoVitsAudioBlobFromRef(audioRef, playbackSessionId = null) {
    const ref = String(audioRef || '').trim();
    if (!ref) return null;

    if (/^data:audio\//i.test(ref)) {
      const comma = ref.indexOf(',');
      if (comma > 0) {
        try {
          const meta = ref.slice(0, comma);
          const payload = ref.slice(comma + 1);
          if (/;base64/i.test(meta)) {
            const binary = atob(payload);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            return new Blob([bytes]);
          }
          return new Blob([decodeURIComponent(payload)]);
        } catch (e) {
          return null;
        }
      }
    }

    const cfg = getGptSoVitsConfig();
    const bases = [];

    if (/^https?:\/\//i.test(ref)) {
      bases.push(ref);
    } else {
      const apiUrl = String(cfg.apiUrl || '').trim();
      const apiOrigin = (() => {
        try { return new URL(apiUrl).origin; } catch (e) { return ''; }
      })();

      if (ref.startsWith('/') && apiOrigin) {
        bases.push(`${apiOrigin}${ref}`);
      }
      if (apiUrl) {
        const base = apiUrl.replace(/\/$/, '');
        bases.push(`${base}/${ref.replace(/^\/+/, '')}`);
      }
      bases.push(ref);
    }

    const seen = new Set();
    for (const baseUrl of bases) {
      const normalizedBase = String(baseUrl || '').trim();
      if (!normalizedBase || seen.has(normalizedBase)) continue;
      seen.add(normalizedBase);

      const candidates = this._buildGptSoVitsApiCandidates(normalizedBase, !!cfg.useCorsProxy);
      for (const candidate of candidates) {
        if (Number(playbackSessionId) > 0 && !this._isPlaybackSessionActive(playbackSessionId)) return null;
        try {
          const headers = this._shouldAttachStProxyHeaders(candidate.route, candidate.url)
            ? this._getSillyTavernRequestHeaders()
            : {};
          const signal = Number(playbackSessionId) > 0 ? this._getGptSoVitsAbortSignal(playbackSessionId) : null;
          const response = await fetch(candidate.url, { method: 'GET', headers, signal });
          if (!response.ok) continue;

          const blob = await response.blob().catch(() => null);
          if (!blob || blob.size === 0) continue;

          const contentType = String(response.headers?.get('content-type') || '').toLowerCase();
          if (contentType.startsWith('audio/') || contentType.includes('octet-stream')) {
            this._rememberProxyRoute(candidate.route, candidate.url);
            return blob;
          }

          try {
            const ab = await blob.arrayBuffer();
            if (this._looksLikeAudioArrayBuffer(ab)) {
              this._rememberProxyRoute(candidate.route, candidate.url);
              return blob;
            }
          } catch (e) {}
        } catch (e) {
          if (e?.name === 'AbortError') throw e;
        }
      }
    }

    return null;
  },

  async _postGptSoVitsTtsBlob(payload, playbackSessionId = null) {
    const cfg = getGptSoVitsConfig();
    const endpointRaw = String(cfg.endpoint || '/tts').trim();
    const endpoint = endpointRaw.startsWith('/') ? endpointRaw : `/${endpointRaw}`;
    const directUrl = this._buildGptSoVitsApiUrl(endpoint, {});
    if (!directUrl) throw new Error('invalid apiUrl');

    const candidates = this._buildGptSoVitsApiCandidates(directUrl, !!cfg.useCorsProxy);
    let lastError = null;
    const routeErrors = [];

    const requestBlob = async (url, route) => {
      const headers = {
        ...(this._shouldAttachStProxyHeaders(route, url) ? this._getSillyTavernRequestHeaders() : {}),
        'Content-Type': 'application/json',
        Accept: 'audio/wav, audio/*;q=0.9, application/octet-stream;q=0.8, */*;q=0.5',
      };
      const options = { method: 'POST', headers, body: JSON.stringify(payload || {}) };
      const signal = Number(playbackSessionId) > 0 ? this._getGptSoVitsAbortSignal(playbackSessionId) : null;
      if (signal) options.signal = signal;

      const response = await fetch(url, options);
      const contentType = String(response.headers?.get('content-type') || '').toLowerCase();
      const blob = await response.blob().catch(() => null);

      if (!response.ok) {
        const text = blob ? await blob.text().catch(() => '') : '';
        return { ok: false, status: response.status, text, contentType };
      }
      if (!blob || blob.size === 0) {
        return { ok: false, status: response.status, text: 'empty response body', contentType };
      }

      const isAudioByHeader = contentType.startsWith('audio/') || contentType.includes('octet-stream');
      if (isAudioByHeader) {
        return { ok: true, status: response.status, blob, contentType };
      }

      try {
        const ab = await blob.arrayBuffer();
        if (this._looksLikeAudioArrayBuffer(ab)) {
          return { ok: true, status: response.status, blob, contentType: contentType || 'audio/unknown' };
        }
      } catch (e) {}

      const text = await blob.text().catch(() => '');
      const audioRef = this._extractGptSoVitsAudioRefFromText(text);
      if (audioRef) {
        const fetchedBlob = await this._fetchGptSoVitsAudioBlobFromRef(audioRef, playbackSessionId);
        if (fetchedBlob && fetchedBlob.size > 0) {
          return { ok: true, status: response.status, blob: fetchedBlob, contentType: 'audio/derived' };
        }
      }

      return { ok: false, status: response.status, text: text || `unexpected content-type: ${contentType}`, contentType };
    };

    for (const candidate of candidates) {
      const route = candidate.route;
      const isDirect = route === 'direct';
      if (Number(playbackSessionId) > 0 && !this._isPlaybackSessionActive(playbackSessionId)) return null;

      try {
        const result = await requestBlob(candidate.url, route);
        if (result.ok) {
          this._rememberProxyRoute(route, candidate.url);
          return result.blob;
        }

        if (!isDirect && this._isGptSoVitsProxyNotFound(result.status, result.text)) {
          routeErrors.push(`${route}:HTTP404(proxy-not-found)`);
          continue;
        }

        const detail = this._summarizeGptSoVitsApiText(result.text);
        lastError = new Error(detail || `HTTP ${result.status}`);
        routeErrors.push(`${route}:${detail || `HTTP${result.status}`}`);
      } catch (e) {
        if (e?.name === 'AbortError') throw e;
        const message = e?.message || String(e || 'unknown error');
        lastError = new Error(message);
        routeErrors.push(`${route}:${message}`);
      }
    }

    if (lastError) {
      const compactRoutes = routeErrors.slice(0, 4).join(' | ');
      const detail = compactRoutes ? `${lastError.message} [routes: ${compactRoutes}]` : lastError.message;
      throw new Error(detail);
    }
    throw new Error('tts request failed');
  },

  async _getGptSoVitsTtsBlob(payload, playbackSessionId = null) {
    const cfg = getGptSoVitsConfig();
    const endpointRaw = String(cfg.endpoint || '/tts').trim();
    const endpoint = endpointRaw.startsWith('/') ? endpointRaw : `/${endpointRaw}`;
    const directUrl = this._buildGptSoVitsApiUrl(endpoint, payload || {});
    if (!directUrl) throw new Error('invalid apiUrl');

    const candidates = this._buildGptSoVitsApiCandidates(directUrl, !!cfg.useCorsProxy);
    let lastError = null;
    const routeErrors = [];

    const requestBlob = async (url, route) => {
      const headers = {
        ...(this._shouldAttachStProxyHeaders(route, url) ? this._getSillyTavernRequestHeaders() : {}),
        Accept: 'audio/wav, audio/*;q=0.9, application/octet-stream;q=0.8, */*;q=0.5',
      };
      const options = { method: 'GET', headers };
      const signal = Number(playbackSessionId) > 0 ? this._getGptSoVitsAbortSignal(playbackSessionId) : null;
      if (signal) options.signal = signal;

      const response = await fetch(url, options);
      const contentType = String(response.headers?.get('content-type') || '').toLowerCase();
      const blob = await response.blob().catch(() => null);

      if (!response.ok) {
        const text = blob ? await blob.text().catch(() => '') : '';
        return { ok: false, status: response.status, text, contentType };
      }
      if (!blob || blob.size === 0) {
        return { ok: false, status: response.status, text: 'empty response body', contentType };
      }

      const isAudioByHeader = contentType.startsWith('audio/') || contentType.includes('octet-stream');
      if (isAudioByHeader) {
        return { ok: true, status: response.status, blob, contentType };
      }

      try {
        const ab = await blob.arrayBuffer();
        if (this._looksLikeAudioArrayBuffer(ab)) {
          return { ok: true, status: response.status, blob, contentType: contentType || 'audio/unknown' };
        }
      } catch (e) {}

      const text = await blob.text().catch(() => '');
      const audioRef = this._extractGptSoVitsAudioRefFromText(text);
      if (audioRef) {
        const fetchedBlob = await this._fetchGptSoVitsAudioBlobFromRef(audioRef, playbackSessionId);
        if (fetchedBlob && fetchedBlob.size > 0) {
          return { ok: true, status: response.status, blob: fetchedBlob, contentType: 'audio/derived' };
        }
      }

      return { ok: false, status: response.status, text: text || `unexpected content-type: ${contentType}`, contentType };
    };

    for (const candidate of candidates) {
      const route = candidate.route;
      const isDirect = route === 'direct';
      if (Number(playbackSessionId) > 0 && !this._isPlaybackSessionActive(playbackSessionId)) return null;

      try {
        const result = await requestBlob(candidate.url, route);
        if (result.ok) {
          this._rememberProxyRoute(route, candidate.url);
          return result.blob;
        }

        if (!isDirect && this._isGptSoVitsProxyNotFound(result.status, result.text)) {
          routeErrors.push(`${route}:HTTP404(proxy-not-found)`);
          continue;
        }

        const detail = this._summarizeGptSoVitsApiText(result.text);
        lastError = new Error(detail || `HTTP ${result.status}`);
        routeErrors.push(`${route}:${detail || `HTTP${result.status}`}`);
      } catch (e) {
        if (e?.name === 'AbortError') throw e;
        const message = e?.message || String(e || 'unknown error');
        lastError = new Error(message);
        routeErrors.push(`${route}:${message}`);
      }
    }

    if (lastError) {
      const compactRoutes = routeErrors.slice(0, 4).join(' | ');
      const detail = compactRoutes ? `${lastError.message} [routes: ${compactRoutes}]` : lastError.message;
      throw new Error(detail);
    }
    throw new Error('tts request failed');
  },

  async _requestGptSoVitsTtsBlobWithCompat(payload, playbackSessionId = null) {
    const variants = this._buildGptSoVitsTtsPayloadVariants(payload);
    let lastPostError = null;
    let shouldTryGetFallback = false;

    for (let i = 0; i < variants.length; i++) {
      const body = variants[i];
      try {
        return await this._postGptSoVitsTtsBlob(body, playbackSessionId);
      } catch (e) {
        if (e?.name === 'AbortError') throw e;
        lastPostError = e;
        const msg = String(e?.message || e || '').replace(/\s+/g, ' ').trim();
        if (this._isGptSoVitsRefAudioDurationError(msg)) break;
        if (this._isLikelyGptSoVitsTtsPayloadError(msg) || /405|method not allowed|cannot\s+post|not support post/i.test(msg)) {
          shouldTryGetFallback = true;
        }
        const canRetry = i < variants.length - 1 && this._isLikelyGptSoVitsTtsPayloadError(msg);
        if (!canRetry) break;
      }
    }

    if (shouldTryGetFallback) {
      let lastGetError = null;
      for (let i = 0; i < variants.length; i++) {
        const query = variants[i];
        try {
          return await this._getGptSoVitsTtsBlob(query, playbackSessionId);
        } catch (e) {
          if (e?.name === 'AbortError') throw e;
          lastGetError = e;
          const msg = String(e?.message || e || '').replace(/\s+/g, ' ').trim();
          if (this._isGptSoVitsRefAudioDurationError(msg)) break;
        }
      }
      throw lastGetError || lastPostError || new Error('tts request failed');
    }

    throw lastPostError || new Error('tts request failed');
  },

  _enqueueGptSoVitsSwitch(taskFn, playbackSessionId = null) {
    const run = () => {
      if (Number(playbackSessionId) > 0 && !this._isPlaybackSessionActive(playbackSessionId)) {
        return false;
      }
      return Promise.resolve().then(taskFn);
    };
    this._gptSoVitsSwitchTask = (this._gptSoVitsSwitchTask || Promise.resolve()).then(run, run);
    return this._gptSoVitsSwitchTask;
  },

  async _setGptSoVitsWeights(kind, weightsPath, playbackSessionId = null) {
    const normalizedKind = kind === 'gpt' ? 'gpt' : 'sovits';
    const path = String(weightsPath || '').trim();
    if (!path) return true;
    const endpoint = `/set_${normalizedKind}_weights`;
    const text = await this._fetchGptSoVitsApi(endpoint, { weights_path: path }, playbackSessionId);

    try {
      const data = JSON.parse(text);
      if (data?.message && data.message !== 'success') {
        throw new Error(data.message);
      }
    } catch (e) {
      const trimmed = String(text || '').trim().toLowerCase();
      if (trimmed && trimmed !== 'success') {
        console.warn(`[${SCRIPT_NAME}] GPT-SoVITS set_weights non-standard response`, text);
      }
    }
    return true;
  },

  async _setGptSoVitsModelPair(gptWeightsPath, sovitsWeightsPath, playbackSessionId = null, endpointOverride = '') {
    const cfg = getGptSoVitsConfig();
    const endpointRaw = String(endpointOverride || cfg.setModelEndpoint || '/set_model').trim() || '/set_model';
    const endpoint = endpointRaw.startsWith('/') ? endpointRaw : `/${endpointRaw}`;
    const endpointCandidates = endpoint.endsWith('/') ? [endpoint] : [endpoint, `${endpoint}/`];
    const payload = {
      gpt_model_path: String(gptWeightsPath || ''),
      sovits_model_path: String(sovitsWeightsPath || ''),
    };

    const validateResponse = text => {
      try {
        const data = JSON.parse(text);
        if (data?.message && data.message !== 'success') {
          throw new Error(data.message);
        }
      } catch (e) {
        const trimmed = String(text || '').trim().toLowerCase();
        if (trimmed && trimmed !== 'success') {
          console.warn(`[${SCRIPT_NAME}] GPT-SoVITS set_model non-standard response`, text);
        }
      }
    };

    let postError = null;
    for (const ep of endpointCandidates) {
      try {
        const text = await this._postGptSoVitsApi(ep, payload, playbackSessionId);
        validateResponse(text);
        return true;
      } catch (e) {
        if (e?.name === 'AbortError') throw e;
        postError = e;
      }
    }

    let getError = null;
    for (const ep of endpointCandidates) {
      try {
        const text = await this._fetchGptSoVitsApi(ep, payload, playbackSessionId);
        validateResponse(text);
        return true;
      } catch (e) {
        if (e?.name === 'AbortError') throw e;
        getError = e;
      }
    }

    const postMsg = postError?.message || String(postError || 'post failed');
    const getMsg = getError?.message || String(getError || 'get failed');
    throw new Error(`set_model failed: POST(${postMsg}); GET fallback(${getMsg})`);
  },

  async _ensureGptSoVitsWeights(resolvedVoice, playbackSessionId = null) {
    const cfg2 = getGptSoVitsConfig();
    const modelCfg = resolvedVoice?.gptSoVitsModel || null;
    const modelParams = _safeObject(modelCfg?.params);
    const modelPaths = _safeObject(modelCfg?.paths);
    const vcfg2 = resolvedVoice?.gptSoVits || {};

    const strictWeightSwitch = !!(vcfg2.strictWeightSwitch ?? modelParams.strictWeightSwitch ?? cfg2.strictWeightSwitch);
    const switchMode2 = normalizeGptSoVitsSwitchMode(vcfg2.modelSwitchMode || modelParams.modelSwitchMode || cfg2.modelSwitchMode);
    const setModelEndpoint2 = String(vcfg2.setModelEndpoint || modelParams.setModelEndpoint || cfg2.setModelEndpoint || '/set_model').trim() || '/set_model';
    const desiredGpt2 = this._resolveGptSoVitsServerPath(String(vcfg2.gptWeightsPath || modelPaths.gptWeightsPath || '').trim(), cfg2);
    const desiredSovits2 = this._resolveGptSoVitsServerPath(String(vcfg2.sovitsWeightsPath || modelPaths.sovitsWeightsPath || '').trim(), cfg2);

    if (Number(playbackSessionId) > 0 && !this._isPlaybackSessionActive(playbackSessionId)) return false;
    if (switchMode2 === 'none') return true;
    if (!desiredGpt2 && !desiredSovits2) return true;

    if (this._gptSoVitsWeightSwitchUnavailable) {
      if (!this._gptSoVitsWeightSwitchWarned) {
        this._gptSoVitsWeightSwitchWarned = true;
        showToast('GPT-SoVITS weight switch skipped: /set_* unavailable in current environment');
      }
      return false;
    }

    return this._enqueueGptSoVitsSwitch(async () => {
      if (Number(playbackSessionId) > 0 && !this._isPlaybackSessionActive(playbackSessionId)) return false;
      const failures = [];

      const trySetModelFallback = async triggerMsg => {
        const canFallback = switchMode2 === 'set_weights' && !!desiredGpt2 && !!desiredSovits2 && !strictWeightSwitch;
        if (!canFallback) return false;
        const msg = String(triggerMsg || '');
        const endpointMismatch = /404|405|not found|cannot\s+(get|post)|method not allowed/i.test(msg);
        if (!endpointMismatch) return false;
        try {
          await this._setGptSoVitsModelPair(desiredGpt2, desiredSovits2, playbackSessionId, setModelEndpoint2);
          this._gptSoVitsActiveWeights.gpt = desiredGpt2;
          this._gptSoVitsActiveWeights.sovits = desiredSovits2;
          return true;
        } catch (fallbackErr) {
          console.warn(`[${SCRIPT_NAME}] GPT-SoVITS fallback set_model failed`, fallbackErr);
          return false;
        }
      };

      if (switchMode2 === 'set_model' && desiredGpt2 && desiredSovits2) {
        const needSwitch = desiredGpt2 !== this._gptSoVitsActiveWeights.gpt || desiredSovits2 !== this._gptSoVitsActiveWeights.sovits;
        if (!needSwitch) return true;

        let setModelError = '';
        try {
          await this._setGptSoVitsModelPair(desiredGpt2, desiredSovits2, playbackSessionId, setModelEndpoint2);
          this._gptSoVitsActiveWeights.gpt = desiredGpt2;
          this._gptSoVitsActiveWeights.sovits = desiredSovits2;
          return true;
        } catch (e) {
          if (e?.name === 'AbortError') return false;
          setModelError = e?.message || String(e || 'unknown error');
        }

        if (setModelError && !strictWeightSwitch) {
          try {
            if (desiredGpt2 && desiredGpt2 !== this._gptSoVitsActiveWeights.gpt) {
              await this._setGptSoVitsWeights('gpt', desiredGpt2, playbackSessionId);
              this._gptSoVitsActiveWeights.gpt = desiredGpt2;
            }
            if (desiredSovits2 && desiredSovits2 !== this._gptSoVitsActiveWeights.sovits) {
              await this._setGptSoVitsWeights('sovits', desiredSovits2, playbackSessionId);
              this._gptSoVitsActiveWeights.sovits = desiredSovits2;
            }
            setModelError = '';
          } catch (fallbackErr) {
            if (fallbackErr?.name === 'AbortError') return false;
            setModelError = `${setModelError} | fallback_set_weights: ${fallbackErr?.message || String(fallbackErr || 'unknown')}`;
          }
        }

        if (setModelError) failures.push(`set_model: ${setModelError}`);
      } else {
        if (desiredGpt2 && desiredGpt2 !== this._gptSoVitsActiveWeights.gpt) {
          try {
            await this._setGptSoVitsWeights('gpt', desiredGpt2, playbackSessionId);
            this._gptSoVitsActiveWeights.gpt = desiredGpt2;
          } catch (e) {
            if (e?.name === 'AbortError') return false;
            const msg = e?.message || String(e || 'unknown error');
            if (!(await trySetModelFallback(msg))) failures.push(`gpt: ${msg}`);
          }
        }

        if (desiredSovits2 && desiredSovits2 !== this._gptSoVitsActiveWeights.sovits) {
          try {
            await this._setGptSoVitsWeights('sovits', desiredSovits2, playbackSessionId);
            this._gptSoVitsActiveWeights.sovits = desiredSovits2;
          } catch (e) {
            if (e?.name === 'AbortError') return false;
            const msg = e?.message || String(e || 'unknown error');
            if (!(await trySetModelFallback(msg))) failures.push(`sovits: ${msg}`);
          }
        }
      }

      if (failures.length > 0) {
        const joined = failures.join(' | ');
        if (strictWeightSwitch) throw new Error(`weight switch failed: ${joined}`);
        showToast(`GPT-SoVITS weight switch failed, continue with current model: ${clipText(failures[0], 96)}`);
      }
      return true;
    }, playbackSessionId);
    const cfg = getGptSoVitsConfig();
    const vcfg = resolvedVoice?.gptSoVits || {};

    const desiredGpt = String(vcfg.gptWeightsPath || '').trim();
    const desiredSovits = String(vcfg.sovitsWeightsPath || '').trim();

    let switchMode = normalizeGptSoVitsSwitchMode(vcfg.modelSwitchMode || cfg.modelSwitchMode);
    const setModelEndpoint = String(vcfg.setModelEndpoint || cfg.setModelEndpoint || '/set_model').trim() || '/set_model';

    if (switchMode === 'none') return true;
    if (!desiredGpt && !desiredSovits) return true;
    if (this._gptSoVitsWeightSwitchUnavailable) return false;

    if (switchMode === 'set_model') {
      if (desiredGpt && desiredSovits) {
        try {
          await this._setGptSoVitsModelPair(desiredGpt, desiredSovits, setModelEndpoint);
          this._gptSoVitsActiveWeights.gpt = desiredGpt;
          this._gptSoVitsActiveWeights.sovits = desiredSovits;
          return true;
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] GPT-SoVITS: set_model 失败，回退 set_weights`, e);
          switchMode = 'set_weights';
        }
      } else {
        switchMode = 'set_weights';
      }
    }

    if (switchMode === 'set_weights') {
      try {
        if (desiredGpt && desiredGpt !== this._gptSoVitsActiveWeights.gpt) {
          await this._setGptSoVitsWeights('gpt', desiredGpt);
          this._gptSoVitsActiveWeights.gpt = desiredGpt;
        }
        if (desiredSovits && desiredSovits !== this._gptSoVitsActiveWeights.sovits) {
          await this._setGptSoVitsWeights('sovits', desiredSovits);
          this._gptSoVitsActiveWeights.sovits = desiredSovits;
        }
        return true;
      } catch (e) {
        if (!this._gptSoVitsWeightSwitchWarned) {
          this._gptSoVitsWeightSwitchWarned = true;
          showToast('GPT-SoVITS 切换权重失败，请检查 /proxy 与 set_* 接口');
        }
        console.warn(`[${SCRIPT_NAME}] GPT-SoVITS: set_weights 失败`, e);
        return false;
      }
    }

    return true;
  },

  async _speakWithGptSoVits(segment, segmentId, resolvedVoice, playbackSessionId = null) {
    const cfg = getGptSoVitsConfig();
    const vcfg = resolvedVoice?.gptSoVits || {};
    const modelCfg = resolvedVoice?.gptSoVitsModel || null;

    if (Number(playbackSessionId) > 0 && !this._isPlaybackSessionActive(playbackSessionId)) return false;
    if (!cfg.apiUrl) {
      showToast('GPT-SoVITS: 请先在设置中填写 API 地址');
      return false;
    }

    const refs = _safeArray(modelCfg?.refAudios);
    const defaultRefPath = String(modelCfg?.paths?.defaultRefAudioPath || '').trim();
    const defaultRef =
      refs.find(item => item.path === defaultRefPath) ||
      refs.find(item => item.id === modelCfg?.defaultRefId) ||
      refs[0] ||
      null;
    const refAudioRaw = String(defaultRef?.path || defaultRefPath || vcfg.refAudioPath || '').trim();
    const refAudioPath = this._resolveGptSoVitsServerPath(refAudioRaw, cfg);
    if (!refAudioPath) {
      showToast('GPT-SoVITS: 当前音色缺少 refAudioPath');
      return false;
    }

    await this._ensureGptSoVitsWeights(resolvedVoice, playbackSessionId);
    if (Number(playbackSessionId) > 0 && !this._isPlaybackSessionActive(playbackSessionId)) return false;

    const requestText = getSegmentSpeakText(segment);
    const refAudioPathCandidates = this._buildGptSoVitsRefAudioPathCandidates(refAudioPath, {
      cfg,
      modelCfg,
      voiceCfg: vcfg,
      rawRefPath: refAudioRaw,
    }).map(p => this._resolveGptSoVitsServerPath(p, cfg));
    if (refAudioPathCandidates.length === 0) refAudioPathCandidates.push(refAudioPath);

    const directUrlCandidates = [];
    const seenDirectUrl = new Set();
    for (const candidateRefPath of refAudioPathCandidates) {
      const voiceForRequest = {
        ...resolvedVoice,
        gptSoVits: {
          ...vcfg,
          refAudioPath: candidateRefPath,
        },
      };
      const directUrl = this._buildGptSoVitsTtsUrl(requestText, voiceForRequest);
      if (!directUrl || seenDirectUrl.has(directUrl)) continue;
      seenDirectUrl.add(directUrl);
      directUrlCandidates.push(directUrl);
    }

    if (directUrlCandidates.length === 0) {
      showToast('GPT-SoVITS: 无法生成请求 URL');
      return false;
    }

    const audioUrlCandidates = directUrlCandidates.map(url => (cfg.useCorsProxy ? this._getProxiedAudioUrl(url) : url));

    const audio = new Audio();
    audio.crossOrigin = 'anonymous';

    this.currentAudio = audio;
    this.currentSegmentId = segmentId;

    const onEnded = () => {
      if (this.currentAudio === audio) {
        this._onPlaybackEnded('gpt_sovits_audio_ended');
      }
    };
    const onError = e => {
      console.warn(`[${SCRIPT_NAME}] GPT-SoVITS: audio error`, e);
      if (!this._gptSoVitsProxyWarned && cfg.useCorsProxy) {
        this._gptSoVitsProxyWarned = true;
        showToast('GPT-SoVITS 代理失败，请检查 /proxy 路由和 CORS 设置');
      } else {
        showToast('GPT-SoVITS 播放失败（检查地址/代理/CORS）');
      }
      onEnded();
    };

    let playError = null;
    let started = false;
    for (let i = 0; i < audioUrlCandidates.length; i++) {
      const nextUrl = audioUrlCandidates[i];
      if (!nextUrl) continue;
      audio.src = nextUrl;
      try {
        if (Number(playbackSessionId) > 0 && !this._isPlaybackSessionActive(playbackSessionId)) return false;
        await audio.play();
        started = true;
        if (i > 0) {
          console.warn(`[${SCRIPT_NAME}] GPT-SoVITS refAudioPath fallback hit`, {
            candidateIndex: i,
            totalCandidates: audioUrlCandidates.length,
          });
        }
        break;
      } catch (e) {
        playError = e;
      }
    }

    if (!started) {
      const msg = String(playError?.message || '').toLowerCase();
      const blockedByAutoplay = /autoplay|notallowederror|user.*interact|play\(\) failed/i.test(msg);
      console.warn(`[${SCRIPT_NAME}] GPT-SoVITS: play() 失败`, playError);
      showToast(blockedByAutoplay
        ? 'GPT-SoVITS 播放被浏览器拦截（需要用户交互）'
        : 'GPT-SoVITS 播放失败（请检查 refAudioPath 路径）');
      onEnded();
      return false;
    }

    audio.addEventListener('ended', onEnded, { once: true });
    audio.addEventListener('error', onError, { once: true });

    if (Number(playbackSessionId) > 0 && !this._isPlaybackSessionActive(playbackSessionId)) {
      try { audio.pause(); } catch (e) {}
      try {
        audio.src = '';
        if (typeof audio.load === 'function') audio.load();
      } catch (e) {}
      return false;
    }

    this.isPlaying = true;
    if (segment.speaker) {
      const hasLive2D = Live2DManager.models.has(segment.speaker);
      if (hasLive2D) this._startLipSyncOnPlay(segment.speaker);
      else this._startLipSyncWhenModelReady(segment.speaker);
    }
    return true;
  },

  async _speakWithEdgeDirect(segment, segmentId, resolvedVoice, playbackSessionId = null) {
    const voiceName = String(resolvedVoice.value || resolvedVoice.name || '').trim();
    if (!voiceName) {
      showToast('EdgeTTS 直连：无可用音色');
      return false;
    }

    this._cleanupEdgeDirectResources();
    if (Number(playbackSessionId) > 0 && !this._isPlaybackSessionActive(playbackSessionId)) {
      return false;
    }

    const controller = new AbortController();
    this._edgeDirectFetchController = controller;

    let blob = null;
    try {
      const requestText = getSegmentSpeakText(segment);
      blob = await synthesizeToBlob(requestText, resolvedVoice, {
        signal: controller.signal,
        onSocket: socket => {
          this._edgeDirectSocket = socket;
        },
      });
    } catch (e) {
      const isAbort = e?.name === 'AbortError';
      if (!isAbort) {
        const reason = clipText(e?.message || String(e), 180);
        const blockedHint = /likely-cause=ua-not-edg/i.test(reason)
          ? '（当前浏览器不是 Edge，微软接口通常会拒绝握手；请改用 Edge 浏览器重试）'
          : /1006|403|websocket/i.test(reason)
            ? '（可能是浏览器 CSP/网络策略拦截了 wss 连接；也可切换 Edge 浏览器复测）'
            : '';
        console.warn(`[${SCRIPT_NAME}] EdgeTTS 直连合成失败:`, e);
        showToast(`EdgeTTS 直连失败：${reason}${blockedHint}`);
      }
      return false;
    } finally {
      if (this._edgeDirectFetchController === controller) {
        this._edgeDirectFetchController = null;
      }
      this._edgeDirectSocket = null;
    }

    if (Number(playbackSessionId) > 0 && !this._isPlaybackSessionActive(playbackSessionId)) {
      return false;
    }
    if (!blob || blob.size <= 0) {
      showToast('EdgeTTS 直连未返回音频数据');
      return false;
    }

    const objectUrl = URL.createObjectURL(blob);
    this._edgeDirectObjectUrl = objectUrl;

    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.src = objectUrl;

    this.currentAudio = audio;
    this.currentSegmentId = segmentId;

    const onEnded = () => {
      if (this.currentAudio === audio) {
        this._onPlaybackEnded('edge_direct_audio_ended');
      }
    };
    const onError = err => {
      console.warn(`[${SCRIPT_NAME}] EdgeTTS 直连播放失败:`, err);
      showToast('EdgeTTS 直连播放失败，可切换 Edge 浏览器复测');
      onEnded();
    };

    audio.addEventListener('ended', onEnded, { once: true });
    audio.addEventListener('error', onError, { once: true });

    try {
      if (Number(playbackSessionId) > 0 && !this._isPlaybackSessionActive(playbackSessionId)) return false;
      await audio.play();
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] EdgeTTS 直连 play() 失败:`, e);
      showToast('EdgeTTS 播放被浏览器拦截，请先进行一次页面交互');
      onEnded();
      return false;
    }

    if (Number(playbackSessionId) > 0 && !this._isPlaybackSessionActive(playbackSessionId)) {
      try { audio.pause(); } catch (e) {}
      try {
        audio.src = '';
        if (typeof audio.load === 'function') audio.load();
      } catch (e) {}
      return false;
    }

    this.isPlaying = true;

    if (segment.speaker) {
      const hasLive2D = Live2DManager.models.has(segment.speaker);
      if (hasLive2D) this._startLipSyncOnPlay(segment.speaker);
      else this._startLipSyncWhenModelReady(segment.speaker);
    }
    return true;
  },

  async _hasAvailableLive2DModel(characterId) {
    const safeCharacterId = String(characterId || '').trim();
    if (!safeCharacterId) return false;
    if (Live2DManager.models.has(safeCharacterId)) return true;
    try {
      return await hasLive2DModel(safeCharacterId);
    } catch (e) {
      return false;
    }
  },

  _startLipSyncWhenModelReady(characterId, maxWait = 5000) {
    const safeCharacterId = String(characterId || '').trim();
    if (!safeCharacterId) return;
    const startTime = Date.now();
    let hasCheckedModelExists = false;
    const tryLoad = async () => {
      if (Live2DManager.models.has(safeCharacterId)) {
        this._startLipSyncOnPlay(safeCharacterId, maxWait);
        return;
      }

      if (!hasCheckedModelExists) {
        hasCheckedModelExists = true;
        const modelExists = await this._hasAvailableLive2DModel(safeCharacterId);
        if (!modelExists) {
          return;
        }
      }

      try {
        await Live2DManager.loadModel(safeCharacterId);
      } catch (e) {}
      if (Live2DManager.models.has(safeCharacterId)) {
        this._startLipSyncOnPlay(safeCharacterId, maxWait);
        return;
      }
      if (Date.now() - startTime < maxWait) {
        setTimeout(() => {
          void tryLoad();
        }, 120);
      } else {
        console.warn(`[${SCRIPT_NAME}] LipSync: 模型加载超时，放弃口型同步 - characterId=${safeCharacterId}`);
      }
    };
    void tryLoad();
  },

  async _waitForModelReadyBeforeTTS(characterId, maxWait = 5000) {
    const safeCharacterId = String(characterId || '').trim();
    if (!safeCharacterId) return false;
    if (Live2DManager.models.has(safeCharacterId)) return true;

    const modelExists = await this._hasAvailableLive2DModel(safeCharacterId);
    if (!modelExists) return false;

    const startTime = Date.now();
    while (Date.now() - startTime < maxWait) {
      try {
        await Live2DManager.loadModel(safeCharacterId);
      } catch (e) {}
      if (Live2DManager.models.has(safeCharacterId)) {
        return true;
      }
      await new Promise(r => setTimeout(r, 120));
    }
    console.warn(`[${SCRIPT_NAME}] TTS: 等待模型就绪超时，仍继续请求TTS - characterId=${safeCharacterId}`);
    return false;
  },

  _startLipSyncOnPlay(characterId, maxWait = 5000) {
    console.log(`[${SCRIPT_NAME}] LipSync: _startLipSyncOnPlay 被调用 - characterId=${characterId}`);
    const startTime = Date.now();
    let hasStarted = false;

    const tryBind = () => {
      const preferredAudio = this._getPreferredAudioElement();
      const audioElement = preferredAudio || this._getCurrentAudioElement();
      console.log(`[${SCRIPT_NAME}] LipSync: 获取音频元素 -`, audioElement ? `src=${audioElement.src?.substring(0, 50)}... paused=${audioElement.paused} currentTime=${audioElement.currentTime}` : 'null');

      if (!audioElement) {
        if (Date.now() - startTime < maxWait && !hasStarted) {
          setTimeout(tryBind, 100);
        } else if (!hasStarted) {
          console.warn(`[${SCRIPT_NAME}] LipSync: 超时未找到音频元素`);
        }
        return;
      }

      if (!audioElement.paused) {
        console.log(`[${SCRIPT_NAME}] LipSync: 音频已在播放，立即启动口型同步`);
        hasStarted = true;
        this._bindLipSyncToAudio(audioElement, characterId);
        return;
      }

      if (!preferredAudio) {
        if (Date.now() - startTime < maxWait && !hasStarted) {
          setTimeout(tryBind, 100);
        } else if (!hasStarted) {
          console.warn(`[${SCRIPT_NAME}] LipSync: 等待播放超时，尝试强制启动`);
          if (audioElement.src) {
            this._bindLipSyncToAudio(audioElement, characterId);
          }
        }
        return;
      }

      console.log(`[${SCRIPT_NAME}] LipSync: 等待音频播放...`);

      const onPlaying = () => {
        if (hasStarted) return;
        hasStarted = true;
        console.log(`[${SCRIPT_NAME}] LipSync: 音频开始播放，启动口型同步`);
        this._bindLipSyncToAudio(audioElement, characterId);
      };

      audioElement.addEventListener('playing', onPlaying, { once: true });
      audioElement.addEventListener('play', onPlaying, { once: true });

      const onTimeUpdate = () => {
        if (hasStarted) return;
        if (audioElement.currentTime > 0 && !audioElement.paused) {
          console.log(`[${SCRIPT_NAME}] LipSync: timeupdate 触发，启动口型同步`);
          onPlaying();
        }
      };
      audioElement.addEventListener('timeupdate', onTimeUpdate);

      setTimeout(() => {
        audioElement.removeEventListener('playing', onPlaying);
        audioElement.removeEventListener('play', onPlaying);
        audioElement.removeEventListener('timeupdate', onTimeUpdate);
        if (!hasStarted) {
          console.warn(`[${SCRIPT_NAME}] LipSync: 等待播放超时，尝试强制启动`);
          if (audioElement.src) {
            this._bindLipSyncToAudio(audioElement, characterId);
          }
        }
      }, maxWait);
    };

    tryBind();
  },

  _bindLipSyncToAudio(audioElement, characterId) {
    if (LipSyncManager.connectAudio(audioElement)) {
      LipSyncManager.startSync(characterId);
    }

    const onEnd = () => {
      console.log(`[${SCRIPT_NAME}] LipSync: 音频结束/暂停，停止口型同步`);
      LipSyncManager.stopSync();
      audioElement.removeEventListener('ended', onEnd);
      audioElement.removeEventListener('pause', onEnd);
    };

    audioElement.addEventListener('ended', onEnd, { once: true });
    audioElement.addEventListener('pause', onEnd, { once: true });
  },

  async speak(segment, segmentId) {
    if (!segment || segment.type !== 'dialogue') {
      if (segment && segment.type === 'narration') {
        console.log(`[${SCRIPT_NAME}] TTS: 跳过旁白 - ${segment.text.substring(0, 30)}...`);
      }
      return;
    }
    const speakText = getSegmentSpeakText(segment);
    if (!speakText) return;

    const normalizedSegmentId = String(segmentId || '');
    if ((this.isLoading || this.isPlaying) && normalizedSegmentId && this.currentSegmentId === normalizedSegmentId) {
      return;
    }

    const playbackSessionId = Number(this._activePlaybackSessionId || 0) + 1;
    this._activePlaybackSessionId = playbackSessionId;
    this._abortGptSoVitsFetch('new-speak');
    this._cleanupEdgeDirectResources();

    const provider = getTTSProvider();
    if (provider !== this.provider || !this.enabled) {
      this._refreshProviderState();
    }
    if (!this.enabled) return;

    const settings = getSettings();
    const ttsConfig = segment.tts || {};
    const boundVoice = getCharacterTTSVoice(segment.speaker);
    let voiceName = ttsConfig.speaker || boundVoice || settings.ttsDefaultSpeaker;
    if (!voiceName) {
      voiceName = provider === TTS_PROVIDER.GPT_SOVITS_V2 ? (segment.speaker || '') : '桃夭';
    }
    if (!voiceName) voiceName = '桃夭';
    const context = ttsConfig.context || '';

    const resolvedVoice = await resolveVoiceByName(voiceName);
    if (!resolvedVoice) {
      console.error(`[${SCRIPT_NAME}] TTS播放失败: 无法解析音色 "${voiceName}" (provider=${provider})`);
      if (provider === TTS_PROVIDER.GPT_SOVITS_V2) {
        if (_showToastRef) _showToastRef('GPT-SoVITS: 请先在设置中配置音色列表');
      }
      return;
    }

    console.log(
      `[${SCRIPT_NAME}] TTS播放: provider=${provider}, voiceName=${voiceName}, context=${context || '无'}, text=${speakText.substring(0, 30)}...`,
    );

    this.isLoading = true;
    if (normalizedSegmentId) this.currentSegmentId = normalizedSegmentId;
    this.showLoadingIndicator();

    try {
      await this._waitForModelReadyBeforeTTS(segment.speaker);

      if (provider === TTS_PROVIDER.GPT_SOVITS_V2) {
        await this._speakWithGptSoVits(segment, segmentId, resolvedVoice, playbackSessionId);
        return;
      }
      if (provider === TTS_PROVIDER.EDGE_TTS_DIRECT) {
        await this._speakWithEdgeDirect(segment, segmentId, resolvedVoice, playbackSessionId);
        return;
      }

      const speakerValue = resolvedVoice.value;
      const resourceId = inferResourceId(speakerValue);
      const hasLive2D = Live2DManager.models.has(segment.speaker);

      if (this.xiaobaixTts && typeof this.xiaobaixTts.speak === 'function') {
        await this.xiaobaixTts.speak(speakText, {
          speaker: speakerValue,
          resourceId: resourceId,
          contextTexts: context ? [context] : [],
        });
        this.isPlaying = true;
        this.currentSegmentId = segmentId;
        console.log(`[${SCRIPT_NAME}] TTS: 检查口型同步 - hasLive2D=${hasLive2D}, speaker=${segment.speaker}`);
        if (hasLive2D) {
          this._startLipSyncOnPlay(segment.speaker);
        } else {
          this._startLipSyncWhenModelReady(segment.speaker);
        }
        return;
      }

      if (this.littleWhiteBox && typeof this.littleWhiteBox.callGenerate === 'function') {
        await this.littleWhiteBox.callGenerate({
          message: speakText,
          speaker: speakerValue,
          resourceId: resourceId,
          contextTexts: context ? [context] : [],
        });
        this.isPlaying = true;
        this.currentSegmentId = segmentId;
        console.log(`[${SCRIPT_NAME}] TTS: 检查口型同步 - hasLive2D=${hasLive2D}, speaker=${segment.speaker}`);
        if (hasLive2D) {
          this._startLipSyncOnPlay(segment.speaker);
        } else {
          this._startLipSyncWhenModelReady(segment.speaker);
        }
        return;
      }

      console.warn(`[${SCRIPT_NAME}] TTS: 未找到可用的 TTS 接口，请确保 LittleWhiteBox 插件已安装并启用`);
    } catch (err) {
      console.error(`[${SCRIPT_NAME}] TTS播放失败:`, err);
    } finally {
      this.isLoading = false;
      this.hideLoadingIndicator();
    }
  },

  speakCurrent(state) {
    this.autoPlay = getSettings()?.ttsAutoPlay !== false;
    if (!state || !this.autoPlay) return;

    const provider = getTTSProvider();
    if (provider !== this.provider || !this.enabled) {
      this._refreshProviderState();
    }
    if (!this.enabled) return;

    const segment = state.segments[state.currentIndex];
    if (!segment || segment.type !== 'dialogue') return;

    const segmentId = `${state.mesId || 'unknown'}_${state.currentIndex}`;
    this.speak(segment, segmentId);
  },
};
