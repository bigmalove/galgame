import { SCRIPT_NAME } from './constants.js';
import { topWindow } from './env.js';
import { GalgameStore } from './store.js';

// ============================================
// 设置管理
// ============================================

// ComfyUI 默认设置
export const DEFAULT_COMFYUI_SETTINGS = {
  apiUrl: 'http://127.0.0.1:8188',
  defaultCharWorkflow: 'default_char',
  defaultBgWorkflow: 'default_bg',
  steps: 20,
  cfgScale: 7,
  width: 512,
  height: 768,
  negativePrompt: 'lowres, bad anatomy, bad hands, text, error, missing fingers',
};

// 默认设置 (全局)
export const DEFAULT_SETTINGS = {
  // 文本显示
  fontSize: 15,
  dialogOpacity: 0.5,
  textEffect: 'none',
  // 自动播放
  autoPlaySpeed: 2,
  // 显示设置
  showSprites: true,
  hideOtherFloors: true,
  fullscreenMode: false,
  bgFillMode: 'cover',
  // 立绘设置
  spriteScale: 100,
  spriteBottomOffset: 20,
  spriteSpacing: 20,
  // 说话者效果
  speakerGlow: true,
  speakerBubble: true,
  // 快捷键
  spaceKeyNext: true,
  enterKeyNext: true,
  // 快进设置
  skipSpeed: 0.05,
  ctrlKeySkip: true,
  // 调试设置
  globalDebug: false,
  // ComfyUI 设置
  comfyui: Object.assign({}, DEFAULT_COMFYUI_SETTINGS),
  // ComfyUI
  defaultCheckpoint: '',
  realTimeBackgroundGen: false,
  // 背景图来源: 'none' | 'comfyui' | 'banana' | 'novelai' | 'wallhaven'
  bgImageSource: 'none',
  // TTS 设置
  ttsEnabled: true,
  ttsAutoPlay: true,
  ttsDefaultSpeaker: '',
  // TTS 引擎选择
  ttsProvider: 'littlewhitebox',
  // GPT-SoVITS 配置
  gptSoVits: {
    apiUrl: 'http://127.0.0.1:9880',
    endpoint: '/tts',
    useCorsProxy: true,
    mediaType: 'wav',
    streamingMode: true,
    textLang: 'auto',
    textSplitMethod: 'cut5',
    speedFactor: 1,
    voices: [],
  },
  // 加强模式设置
  enhancedMode: {
    enabled: false,
    secondGenerate: {
      useProfile: false,
      profileName: '',
      useModel: false,
      modelName: '',
      usePreset: false,
      presetName: '',
      useWorldbooks: false,
      worldbooks: [],
    },
  },
  // 大香蕉生图模块设置
  bananaImageGen: {
    proxyUrl: '',
    proxyApiKey: '',
    model: '',
    cotTemplate: '',
    defaultPromptPrefix: 'masterpiece, best quality, highres, ',
    defaultPromptSuffix: '',
    cgMode: false,
    cgImageSize: '1:1',
    characterAppearances: [],
    autoSaveToLibrary: true,
  },
  // Wallhaven 壁纸设置
  wallhaven: {
    purity: 'sfw',
    cgMode: false,
    category: 'anime',
    customTags: [],
    apiKey: '',
  },
  // NovelAI 生图设置
  novelai: {
    apiKey: '',
    model: 'nai-diffusion-4-5-curated',
    width: 1216,
    height: 832,
    scale: 10,
    sampler: 'k_euler',
    steps: 28,
    cfgRescale: 0.18,
    noiseSchedule: 'karras',
    ucPreset: 3,
    skipCfgAboveSigma: 58,
    negativePrompt: 'nsfw, lowres, artistic error, worst quality, bad quality, jpeg artifacts, very displeasing, text, watermark',
    defaultPromptPrefix: 'masterpiece, best quality, no humans, scenery, background, ',
    defaultPromptSuffix: ', very aesthetic',
    autoSaveToLibrary: true,
  },
};

// 第二次生成使用的系统提示词
export const SYSTEM_PROMPT_FOR_SECOND_GENERATE = `你是Galgame文本格式化工具。你的唯一任务是将原始文本转换为Galgame 格式。

【核心规则 - 必须遵守】
1. 只做格式转换，绝对禁止续写、扩展或添加任何新剧情
2. 原文的每一句话都必须保留，不得删减或改写内容
3. 不添加任何原文没有的对话或旁白
4. 输入多少内容，输出就是多少内容（加上格式标签）

【再次强调】
这是格式化任务，不是创作任务。你收到的文本已经是完整的，不需要也不允许继续写下去。`;

function _safeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function _safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function createDefaultEnhancedModeSettings() {
  return {
    enabled: false,
    secondGenerate: {
      useProfile: false,
      profileName: '',
      useModel: false,
      modelName: '',
      usePreset: false,
      presetName: '',
      useWorldbooks: false,
      worldbooks: [],
    },
  };
}

export function normalizeEnhancedModeSettings(rawEnhancedMode) {
  const enhanced = _safeObject(rawEnhancedMode);
  const secondGenerate = _safeObject(enhanced.secondGenerate);
  const normalizedWorldbooks = Array.from(
    new Set(
      _safeArray(secondGenerate.worldbooks)
        .map(name => String(name || '').trim())
        .filter(Boolean),
    ),
  );

  return {
    enabled: !!enhanced.enabled,
    secondGenerate: {
      useProfile: !!secondGenerate.useProfile,
      profileName: String(secondGenerate.profileName || '').trim(),
      useModel: !!secondGenerate.useModel,
      modelName: String(secondGenerate.modelName || '').trim(),
      usePreset: !!secondGenerate.usePreset,
      presetName: String(secondGenerate.presetName || '').trim(),
      useWorldbooks: !!secondGenerate.useWorldbooks,
      worldbooks: normalizedWorldbooks,
    },
  };
}

// 当前设置 (getter/setter 模式 - esbuild IIFE 中 export let 不可靠)
let _settings = Object.assign({}, DEFAULT_SETTINGS);
export function ensureEnhancedModeSettings() {
  _settings.enhancedMode = normalizeEnhancedModeSettings(_settings.enhancedMode);
  return _settings.enhancedMode;
}
ensureEnhancedModeSettings();

export function getSettings() { return _settings; }
export function setSettings(v) { _settings = v; }

// 每个角色卡的开关状态
let _charEnabledMap = {};

// 获取当前角色卡ID
export function getCurrentCharId() {
  var _a, _b;
  try {
    const ctx =
      (_b = (_a = topWindow.SillyTavern) === null || _a === void 0 ? void 0 : _a.getContext) === null || _b === void 0
        ? void 0
        : _b.call(_a);
    if ((ctx === null || ctx === void 0 ? void 0 : ctx.characterId) !== undefined) {
      return String(ctx.characterId);
    }
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 获取当前角色ID失败:`, e);
  }
  return 'default';
}

// 加载全局设置
export function loadSettings() {
  const SETTINGS_STORAGE_KEY = GalgameStore.STORAGE_KEYS.SETTINGS;
  const CHAR_ENABLED_STORAGE_KEY = GalgameStore.STORAGE_KEYS.CHAR_ENABLED;
  try {
    const saved = topWindow.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!Object.prototype.hasOwnProperty.call(parsed, 'globalDebug') && Object.prototype.hasOwnProperty.call(parsed, 'live2dDebug')) {
        parsed.globalDebug = !!parsed.live2dDebug;
      }
      delete parsed.live2dDebug;
      if (parsed.enhancedMode && parsed.enhancedMode.promptConfig) {
        delete parsed.enhancedMode.promptConfig;
        console.log(`[${SCRIPT_NAME}] 已清除缓存中的自定义 systemPrompt`);
      }
      _settings = Object.assign(Object.assign({}, DEFAULT_SETTINGS), parsed);
      _settings.enhancedMode = normalizeEnhancedModeSettings(_settings.enhancedMode);
      // 兼容旧版 sceneMode -> cgMode
      if (_settings.bananaImageGen) {
        if (_settings.bananaImageGen.cgMode === undefined && _settings.bananaImageGen.sceneMode !== undefined) {
          _settings.bananaImageGen.cgMode = !_settings.bananaImageGen.sceneMode;
        }
        if (!Array.isArray(_settings.bananaImageGen.characterAppearances)) {
          _settings.bananaImageGen.characterAppearances = [];
        }
        if (typeof _settings.bananaImageGen.cotTemplate !== 'string') {
          _settings.bananaImageGen.cotTemplate = '';
        }
        delete _settings.bananaImageGen.sceneMode;
      }
      if (_settings.wallhaven) {
        if (_settings.wallhaven.cgMode === undefined && _settings.wallhaven.sceneMode !== undefined) {
          _settings.wallhaven.cgMode = !_settings.wallhaven.sceneMode;
        }
        delete _settings.wallhaven.sceneMode;
      }
      // 迁移旧版独立开关到统一 bgImageSource（一次性，迁移后清除旧标志）
      if (!_settings.bgImageSource || _settings.bgImageSource === 'none') {
        let migrated = false;
        if (_settings.bananaImageGen?.enabled) { _settings.bgImageSource = 'banana'; migrated = true; }
        else if (_settings.novelai?.enabled) { _settings.bgImageSource = 'novelai'; migrated = true; }
        else if (_settings.wallhaven?.enabled) { _settings.bgImageSource = 'wallhaven'; migrated = true; }
        else if (_settings.realTimeBackgroundGen) { _settings.bgImageSource = 'comfyui'; migrated = true; }
        if (migrated) {
          if (_settings.bananaImageGen) delete _settings.bananaImageGen.enabled;
          if (_settings.novelai) delete _settings.novelai.enabled;
          if (_settings.wallhaven) delete _settings.wallhaven.enabled;
          delete _settings.realTimeBackgroundGen;
        }
      }
    }
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 加载设置失败:`, e);
  }
  // 加载角色卡开关状态
  try {
    const savedChar = topWindow.localStorage.getItem(CHAR_ENABLED_STORAGE_KEY);
    if (savedChar) {
      _charEnabledMap = JSON.parse(savedChar);
    }
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 加载角色开关状态失败:`, e);
  }
}

// 保存全局设置
export function saveSettings() {
  const SETTINGS_STORAGE_KEY = GalgameStore.STORAGE_KEYS.SETTINGS;
  try {
    _settings.enhancedMode = normalizeEnhancedModeSettings(_settings.enhancedMode);
    topWindow.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(_settings));
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 保存设置失败:`, e);
  }
}

// 保存角色卡开关状态
export function saveCharEnabled() {
  const CHAR_ENABLED_STORAGE_KEY = GalgameStore.STORAGE_KEYS.CHAR_ENABLED;
  try {
    topWindow.localStorage.setItem(CHAR_ENABLED_STORAGE_KEY, JSON.stringify(_charEnabledMap));
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 保存角色开关状态失败:`, e);
  }
}

// 获取当前角色卡的开关状态
export function isCurrentCharEnabled() {
  const charId = getCurrentCharId();
  return _charEnabledMap[charId] === true;
}

// 设置当前角色卡的开关状态
export function setCurrentCharEnabled(enabled) {
  const charId = getCurrentCharId();
  _charEnabledMap[charId] = enabled;
  saveCharEnabled();
}
