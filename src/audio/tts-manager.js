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
  _gptSoVitsResolvedProxyRoute: '',
  _gptSoVitsActiveWeights: { gpt: '', sovits: '' },
  _gptSoVitsWeightSwitchUnavailable: false,
  _gptSoVitsWeightSwitchWarned: false,
  _gptSoVitsProxyWarned: false,
  _gptSoVitsFetchController: null,

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

    this.enabled = true;
    return true;
  },

  _onPlaybackEnded(reason = 'unknown') {
    console.log(`[${SCRIPT_NAME}] TTS: 播放结束 - reason=${reason}`);
    this.isPlaying = false;
    this.isLoading = false;
    this.currentAudio = null;
    this.currentSegmentId = null;
    this.hideLoadingIndicator();
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

  _abortGptSoVitsFetch(reason = 'manual') {
    if (this._gptSoVitsFetchController) {
      try {
        this._gptSoVitsFetchController.abort(reason);
      } catch (e) {}
      this._gptSoVitsFetchController = null;
    }
  },

  stop() {
    if (!this.isPlaying && !this.isLoading) return;

    this._abortGptSoVitsFetch('stop');
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

  _isProxyUrl(url) {
    const parsed = safeUrl(url);
    if (!parsed) return false;
    return /^\/proxy(\/|\?|$)/i.test(parsed.pathname);
  },

  _buildGptSoVitsProxyUrl(route, originalUrl) {
    const direct = String(originalUrl || '').trim();
    if (!direct) return '';
    const encoded = encodeURIComponent(direct);
    const origin = window.location?.origin || '';

    switch (route) {
      case 'proxy_path_relative':
        return `/proxy/${encoded}`;
      case 'proxy_path_origin':
        return origin ? `${origin}/proxy/${encoded}` : '';
      case 'proxy_query_relative':
        return `/proxy?url=${encoded}`;
      case 'proxy_query_origin':
        return origin ? `${origin}/proxy?url=${encoded}` : '';
      default:
        return '';
    }
  },

  _rememberProxyRoute(route, url) {
    if (!route) return;
    if (this._gptSoVitsResolvedProxyRoute !== route) {
      this._gptSoVitsResolvedProxyRoute = route;
      console.log(`[${SCRIPT_NAME}] GPT-SoVITS 代理路由已锁定: ${route} -> ${clipText(url, 96)}`);
    }
  },

  _getProxiedAudioUrl(originalUrl) {
    const directUrl = String(originalUrl || '').trim();
    if (!directUrl) return directUrl;
    if (this._isProxyUrl(directUrl)) return directUrl;

    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;

    if (typeof _topWindow.getCorsProxyUrl === 'function') {
      try {
        const proxied = _topWindow.getCorsProxyUrl(directUrl);
        if (typeof proxied === 'string' && proxied) return proxied;
      } catch (e) {}
    }

    if (typeof _topWindow.enableCorsProxy === 'function') {
      try {
        const proxied = _topWindow.enableCorsProxy(directUrl);
        if (typeof proxied === 'string' && proxied) return proxied;
      } catch (e) {}
    }

    if (_topWindow.corsProxy?.getProxyUrl) {
      try {
        const proxied = _topWindow.corsProxy.getProxyUrl(directUrl);
        if (typeof proxied === 'string' && proxied) return proxied;
      } catch (e) {}
    }

    const remembered = String(this._gptSoVitsResolvedProxyRoute || '').trim();
    if (remembered) {
      const rememberedUrl = this._buildGptSoVitsProxyUrl(remembered, directUrl);
      if (rememberedUrl) return rememberedUrl;
    }

    return this._buildGptSoVitsProxyUrl('proxy_path_relative', directUrl)
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

  async _requestGptSoVitsApi(method, pathname, queryParams = {}, jsonBody = undefined) {
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

  async _fetchGptSoVitsApi(pathname, queryParams = {}) {
    const { text } = await this._requestGptSoVitsApi('GET', pathname, queryParams);
    return text;
  },

  async _postGptSoVitsApi(pathname, jsonBody = {}) {
    const { text } = await this._requestGptSoVitsApi('POST', pathname, {}, jsonBody);
    return text;
  },

  async _setGptSoVitsWeights(kind, weightsPath) {
    const normalizedKind = kind === 'gpt' ? 'gpt' : 'sovits';
    const path = String(weightsPath || '').trim();
    if (!path) return;
    const endpoint = `/set_${normalizedKind}_weights`;
    await this._fetchGptSoVitsApi(endpoint, { weights_path: path });
  },

  async _setGptSoVitsModelPair(gptWeightsPath, sovitsWeightsPath, endpointOverride = '') {
    const cfg = getGptSoVitsConfig();
    const endpoint = String(endpointOverride || cfg.setModelEndpoint || '/set_model').trim() || '/set_model';

    try {
      await this._postGptSoVitsApi(endpoint, {
        gpt_model_path: String(gptWeightsPath || '').trim(),
        sovits_model_path: String(sovitsWeightsPath || '').trim(),
      });
      return;
    } catch (postErr) {
      await this._fetchGptSoVitsApi(endpoint, {
        gpt_model_path: String(gptWeightsPath || '').trim(),
        sovits_model_path: String(sovitsWeightsPath || '').trim(),
      });
    }
  },

  async _ensureGptSoVitsWeights(resolvedVoice) {
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

  async _speakWithGptSoVits(segment, segmentId, resolvedVoice) {
    const cfg = getGptSoVitsConfig();
    const vcfg = resolvedVoice?.gptSoVits || {};

    if (!cfg.apiUrl) {
      showToast('GPT-SoVITS: 请先在设置中填写 API 地址');
      return false;
    }
    if (!String(vcfg.refAudioPath || '').trim()) {
      showToast('GPT-SoVITS: 当前音色缺少 refAudioPath');
      return false;
    }

    await this._ensureGptSoVitsWeights(resolvedVoice);

    const directUrl = this._buildGptSoVitsTtsUrl(segment.text, resolvedVoice);
    if (!directUrl) {
      showToast('GPT-SoVITS: 无法生成请求URL');
      return false;
    }

    const audioUrl = cfg.useCorsProxy ? this._getProxiedAudioUrl(directUrl) : directUrl;

    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.src = audioUrl;

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

    audio.addEventListener('ended', onEnded, { once: true });
    audio.addEventListener('error', onError, { once: true });

    try {
      await audio.play();
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] GPT-SoVITS: play() 失败`, e);
      showToast('GPT-SoVITS 播放被浏览器拦截（需要用户交互）');
      onEnded();
      return false;
    }

    this.isPlaying = true;

    if (segment.speaker) {
      const hasLive2D = Live2DManager.models.has(segment.speaker);
      console.log(`[${SCRIPT_NAME}] TTS: 检查口型同步 - hasLive2D=${hasLive2D}, speaker=${segment.speaker}`);
      if (hasLive2D) {
        this._startLipSyncOnPlay(segment.speaker);
      } else {
        this._startLipSyncWhenModelReady(segment.speaker);
      }
    } else {
      console.log(`[${SCRIPT_NAME}] TTS: speaker为空，跳过口型同步`);
    }

    return true;
  },

  _startLipSyncWhenModelReady(characterId, maxWait = 5000) {
    const startTime = Date.now();
    const tryLoad = async () => {
      if (Live2DManager.models.has(characterId)) {
        this._startLipSyncOnPlay(characterId, maxWait);
        return;
      }
      try {
        await Live2DManager.loadModel(characterId);
      } catch (e) {}
      if (Live2DManager.models.has(characterId)) {
        this._startLipSyncOnPlay(characterId, maxWait);
        return;
      }
      if (Date.now() - startTime < maxWait) {
        setTimeout(tryLoad, 120);
      } else {
        console.warn(`[${SCRIPT_NAME}] LipSync: 模型加载超时，放弃口型同步 - characterId=${characterId}`);
      }
    };
    tryLoad();
  },

  async _waitForModelReadyBeforeTTS(characterId, maxWait = 5000) {
    if (!characterId) return false;
    if (Live2DManager.models.has(characterId)) return true;

    const startTime = Date.now();
    while (Date.now() - startTime < maxWait) {
      try {
        await Live2DManager.loadModel(characterId);
      } catch (e) {}
      if (Live2DManager.models.has(characterId)) {
        return true;
      }
      await new Promise(r => setTimeout(r, 120));
    }
    console.warn(`[${SCRIPT_NAME}] TTS: 等待模型就绪超时，仍继续请求TTS - characterId=${characterId}`);
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
    if (!segment.text) return;

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
      `[${SCRIPT_NAME}] TTS播放: provider=${provider}, voiceName=${voiceName}, context=${context || '无'}, text=${segment.text.substring(0, 30)}...`,
    );

    this.isLoading = true;
    this.showLoadingIndicator();

    try {
      await this._waitForModelReadyBeforeTTS(segment.speaker);

      if (provider === TTS_PROVIDER.GPT_SOVITS_V2) {
        await this._speakWithGptSoVits(segment, segmentId, resolvedVoice);
        return;
      }

      const speakerValue = resolvedVoice.value;
      const resourceId = inferResourceId(speakerValue);
      const hasLive2D = Live2DManager.models.has(segment.speaker);

      if (this.xiaobaixTts && typeof this.xiaobaixTts.speak === 'function') {
        await this.xiaobaixTts.speak(segment.text, {
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
          message: segment.text,
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
