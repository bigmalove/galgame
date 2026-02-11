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
} from './tts-config.js';
import { Live2DManager } from '../live2d/manager.js';
import { LipSyncManager } from '../live2d/lip-sync.js';

// 延迟引用: showToast (来自 UI 层)
let _showToastRef = null;
export function setTTSManagerRefs({ showToast }) {
  if (showToast) _showToastRef = showToast;
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

  _refreshProviderState() {
    const provider = getTTSProvider();
    this.provider = provider;

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

  stop() {
    if (!this.isPlaying && !this.isLoading) return;

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

  _getProxiedAudioUrl(originalUrl) {
    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;

    if (typeof _topWindow.getCorsProxyUrl === 'function') {
      try {
        const proxied = _topWindow.getCorsProxyUrl(originalUrl);
        console.log(`[${SCRIPT_NAME}] LipSync: 使用 getCorsProxyUrl 代理音频`);
        return proxied;
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] LipSync: getCorsProxyUrl 失败`, e);
      }
    }

    if (typeof _topWindow.enableCorsProxy === 'function') {
      try {
        const proxied = _topWindow.enableCorsProxy(originalUrl);
        if (typeof proxied === 'string' && proxied) {
          console.log(`[${SCRIPT_NAME}] LipSync: 使用 enableCorsProxy 代理音频`);
          return proxied;
        }
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] LipSync: enableCorsProxy 失败`, e);
      }
    }

    if (_topWindow.corsProxy?.getProxyUrl) {
      try {
        const proxied = _topWindow.corsProxy.getProxyUrl(originalUrl);
        console.log(`[${SCRIPT_NAME}] LipSync: 使用 corsProxy.getProxyUrl 代理音频`);
        return proxied;
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] LipSync: corsProxy.getProxyUrl 失败`, e);
      }
    }

    if (_topWindow.location) {
      const origin = _topWindow.location.origin;
      console.log(`[${SCRIPT_NAME}] LipSync: 使用默认代理端点 /proxy`);
      return `${origin}/proxy?url=${encodeURIComponent(originalUrl)}`;
    }

    return originalUrl;
  },

  _buildGptSoVitsTtsUrl(text, resolvedVoice) {
    const cfg = getGptSoVitsConfig();
    const base = String(cfg.apiUrl || '').replace(/\/$/, '');
    const endpointRaw = String(cfg.endpoint || '/tts');
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

  async _speakWithGptSoVits(segment, segmentId, resolvedVoice) {
    const cfg = getGptSoVitsConfig();
    const vcfg = resolvedVoice?.gptSoVits || {};

    if (!cfg.apiUrl) {
      if (_showToastRef) _showToastRef('GPT-SoVITS: 请先在设置中填写 API 地址');
      return false;
    }
    if (!vcfg.refAudioPath) {
      if (_showToastRef) _showToastRef('GPT-SoVITS: 当前音色缺少 refAudioPath');
      return false;
    }

    const directUrl = this._buildGptSoVitsTtsUrl(segment.text, resolvedVoice);
    if (!directUrl) {
      if (_showToastRef) _showToastRef('GPT-SoVITS: 无法生成请求URL');
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
      if (_showToastRef) _showToastRef('GPT-SoVITS 播放失败（检查地址/代理/CORS）');
      onEnded();
    };

    audio.addEventListener('ended', onEnded, { once: true });
    audio.addEventListener('error', onError, { once: true });

    try {
      await audio.play();
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] GPT-SoVITS: play() 失败`, e);
      if (_showToastRef) _showToastRef('GPT-SoVITS 播放被浏览器拦截（需要用户交互）');
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
          context: context,
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
          context: context,
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
