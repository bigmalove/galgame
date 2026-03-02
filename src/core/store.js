import { SCRIPT_ID, SCRIPT_NAME } from './constants.js';

// ============================================
// GalgameStore - 全局状态容器
// ============================================
export const GalgameStore = {
  // ===== 核心状态 =====
  core: {
    db: null,
    isEnabled: false,
    currentDisplayMesId: null,
  },

  // ===== 缓存层 =====
  cache: {
    sprites: new Map(),      // packId::characterId::expression -> blobUrl
    backgrounds: new Map(),  // sceneName -> blobUrl
    segments: new Map(),     // mesId -> { currentIndex, segments }
    voices: new Map(),       // 角色名 -> 音色名 (会话级)
    parse: new Map(),        // 解析结果缓存
    dom: {
      $chatContainer: null,
      $globalOverlay: null,
    },
  },

  // ===== UI 状态 =====
  ui: {
    choices: {
      lastHash: null,
      isVisible: false,
      pending: null,
    },
    playback: {
      isSkipping: false,
      skipTimer: null,
      isRewinding: false,
      rewindTimer: null,
      rewindHoldTimer: null,
      isAutoPlaying: false,
    },
  },

  // ===== 加强模式 =====
  enhancedMode: {
    isActive: false,
    stage: 'idle',
    firstResult: null,
    formattedResult: null,
    targetMessageId: null,
    originalProfile: undefined,
    originalModel: undefined,
    originalPreset: undefined,
    originalWorldbooks: null,
    worldbooksModified: false,
    originalConfigSaved: false,
    isSecondGeneration: false,
    lastPrompts: null,
  },

  // ===== 世界书注入 =====
  worldbookInjection: {
    isInjected: false,
    originalWorldbooks: null,
  },

  // ===== 图包状态 =====
  imagePack: {
    currentPackId: null,
    renderScope: 'current',
    packs: [],
  },

  // ===== 存储 Keys 统一定义 =====
  STORAGE_KEYS: {
    SETTINGS: `${SCRIPT_ID}_settings`,
    CHAR_ENABLED: `${SCRIPT_ID}_char_enabled`,
    CHAR_TTS_VOICE: `${SCRIPT_ID}_char_tts_voice`,
    CHAR_NAME_KEYWORDS: `${SCRIPT_ID}_char_name_keywords`,
    TTS_ENABLED: `${SCRIPT_ID}_tts_enabled`,
    CUSTOM_EXPRESSIONS: `${SCRIPT_ID}_custom_expressions`,
    CUSTOM_LOCATION_HTML: `${SCRIPT_ID}_custom_location_html`,
    CUSTOM_TIME_HTML: `${SCRIPT_ID}_custom_time_html`,
    CUSTOM_LOCATION_ICON_CLASS: `${SCRIPT_ID}_custom_location_icon_class`,
    CUSTOM_TIME_ICON_CLASS: `${SCRIPT_ID}_custom_time_icon_class`,
    COMFYUI_SETTINGS: `${SCRIPT_ID}_comfyui_settings`,
    COMFY_WORKFLOWS: `${SCRIPT_ID}_comfy_workflows`,
    CHAR_APPEARANCE: `${SCRIPT_ID}_char_appearance_prompts`,
    BGM_VOLUME: `${SCRIPT_ID}_bgm_volume`,
    BGM_PAUSED: `${SCRIPT_ID}_bgm_user_paused`,
    CURRENT_PACK: `${SCRIPT_ID}_current_pack`,
    RENDER_SCOPE: `${SCRIPT_ID}_render_scope`,
    MAP_SETTINGS: `${SCRIPT_ID}_map_settings`,
  },

  // ===== 方法 =====

  resetEnhancedMode() {
    this.enhancedMode = {
      isActive: false,
      stage: 'idle',
      firstResult: null,
      formattedResult: null,
      targetMessageId: null,
      originalProfile: undefined,
      originalModel: undefined,
      originalPreset: undefined,
      originalWorldbooks: null,
      worldbooksModified: false,
      originalConfigSaved: false,
      isSecondGeneration: false,
      lastPrompts: null,
    };
  },

  clearAllCaches() {
    Object.values(this.cache).forEach(cache => {
      if (cache instanceof Map) cache.clear();
    });
    this.cache.dom.$chatContainer = null;
    this.cache.dom.$globalOverlay = null;
  },

  getCachedDOM(key) {
    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
    const _$ = _topWindow.jQuery || window.jQuery;
    const $el = this.cache.dom[key];
    if ($el && $el.length && _$.contains(_topWindow.document, $el[0])) {
      return $el;
    }
    const selectors = {
      $chatContainer: '#chat',
      $globalOverlay: '#gal-global-overlay',
    };
    this.cache.dom[key] = _$(_topWindow.document).find(selectors[key]);
    return this.cache.dom[key];
  },

  storage: {
    get(key, defaultValue) {
      try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : defaultValue;
      } catch { return defaultValue; }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.error(`[${SCRIPT_NAME}] 存储失败:`, e);
      }
    },
  },
};

// ============================================
// 兼容代理层 - 将旧变量名代理到 Store
// ============================================
export const characterSprites = GalgameStore.cache.sprites;
export const sceneBackgrounds = GalgameStore.cache.backgrounds;
export const messageSegmentState = GalgameStore.cache.segments;
export const sessionVoiceCache = GalgameStore.cache.voices;
export const parseCache = GalgameStore.cache.parse;

export const enhancedModeState = GalgameStore.enhancedMode;
export const worldbookInjectionState = GalgameStore.worldbookInjection;

// Storage Keys 代理
export const SETTINGS_STORAGE_KEY = GalgameStore.STORAGE_KEYS.SETTINGS;
export const CHAR_ENABLED_STORAGE_KEY = GalgameStore.STORAGE_KEYS.CHAR_ENABLED;
export const CHAR_TTS_VOICE_KEY = GalgameStore.STORAGE_KEYS.CHAR_TTS_VOICE;
export const CHAR_NAME_KEYWORDS_KEY = GalgameStore.STORAGE_KEYS.CHAR_NAME_KEYWORDS;
export const TTS_ENABLED_KEY = GalgameStore.STORAGE_KEYS.TTS_ENABLED;
export const CUSTOM_EXPRESSIONS_STORAGE_KEY = GalgameStore.STORAGE_KEYS.CUSTOM_EXPRESSIONS;
export const CUSTOM_LOCATION_HTML_KEY = GalgameStore.STORAGE_KEYS.CUSTOM_LOCATION_HTML;
export const CUSTOM_TIME_HTML_KEY = GalgameStore.STORAGE_KEYS.CUSTOM_TIME_HTML;
export const CUSTOM_LOCATION_ICON_CLASS_KEY = GalgameStore.STORAGE_KEYS.CUSTOM_LOCATION_ICON_CLASS;
export const CUSTOM_TIME_ICON_CLASS_KEY = GalgameStore.STORAGE_KEYS.CUSTOM_TIME_ICON_CLASS;
export const COMFYUI_SETTINGS_KEY = GalgameStore.STORAGE_KEYS.COMFYUI_SETTINGS;
export const COMFY_WORKFLOWS_KEY = GalgameStore.STORAGE_KEYS.COMFY_WORKFLOWS;
export const CHAR_APPEARANCE_PROMPTS_KEY = GalgameStore.STORAGE_KEYS.CHAR_APPEARANCE;
