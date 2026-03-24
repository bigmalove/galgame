import { SCRIPT_NAME, TWILIGHT_FAMILY_SKIN_IDS } from './constants.js';
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

export const DEFAULT_SPRITE_UPLOAD_RATIO = '2:3';
export const SPRITE_UPLOAD_RATIO_OPTIONS = [
  { value: '2:3', label: '2:3（默认竖版）' },
  { value: '3:4', label: '3:4（常用竖版）' },
  { value: '4:5', label: '4:5（偏方竖版）' },
  { value: '1:1', label: '1:1（正方形）' },
  { value: '9:16', label: '9:16（长竖版）' },
];

const SPRITE_UPLOAD_RATIO_VALUE_SET = new Set(SPRITE_UPLOAD_RATIO_OPTIONS.map(item => item.value));

export const DEFAULT_SPECIAL_CG_SETTINGS = {
  enabled: false,
  rules: [],
};

export const DEFAULT_TITLE_SCREEN_SETTINGS = {
  enabled: false,
  titleText: '',
  titleFontFamily: '',
  titleFontSize: '',
  subtitleText: '',
  subtitleFontFamily: '',
  subtitleFontSize: '',
  backgroundSource: 'auto',
  backgroundSceneName: '__title__',
  backgroundUrl: '',
  backgroundFit: 'cover',
  enableBackdropMask: true,
};

export const UI_SCALE_PERCENT_LEGACY_MIN = 70;
export const UI_SCALE_PERCENT_LEGACY_MAX = 130;
export const UI_SCALE_PERCENT_BASELINE_OFFSET = 30;
export const UI_SCALE_PERCENT_MIN = 100;
export const UI_SCALE_PERCENT_MAX = 160;
export const UI_SCALE_PERCENT_DEFAULT = 130;
export const UI_SCALE_PERCENT_VERSION = 2;

export function normalizeUiScalePercent(rawValue) {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) return UI_SCALE_PERCENT_DEFAULT;
  return Math.max(UI_SCALE_PERCENT_MIN, Math.min(parsed, UI_SCALE_PERCENT_MAX));
}

export function convertLegacyUiScalePercent(rawValue) {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) return UI_SCALE_PERCENT_DEFAULT;
  const legacyPercent = Math.max(UI_SCALE_PERCENT_LEGACY_MIN, Math.min(parsed, UI_SCALE_PERCENT_LEGACY_MAX));
  return normalizeUiScalePercent(legacyPercent + UI_SCALE_PERCENT_BASELINE_OFFSET);
}

export function uiScalePercentToScaleFactor(rawValue) {
  const normalizedPercent = normalizeUiScalePercent(rawValue);
  return Math.max(0.01, (normalizedPercent - UI_SCALE_PERCENT_BASELINE_OFFSET) / 100);
}

export function dialogScalePercentToScaleFactorForSkin(rawValue, rawSkin) {
  const normalizedPercent = normalizeUiScalePercent(rawValue);
  const skin = String(rawSkin || '').trim();
  if (TWILIGHT_FAMILY_SKIN_IDS.includes(skin)) {
    return uiScalePercentToScaleFactor(normalizedPercent);
  }
  return Math.max(0.01, normalizedPercent / 100);
}

// 默认设置 (全局)
export const DEFAULT_SETTINGS = {
  // 文本显示
  fontSize: 15,
  dialogOpacity: 0.5,
  textEffect: 'none',
  dialogFontFamily: 'sans',
  typewriterEnabled: true,
  typewriterSpeed: 30,
  typewriterSoundEnabled: true,
  typewriterSoundVolume: 35,
  // 自动播放
  autoPlaySpeed: 2,
  // 显示设置
  showSprites: true,
  hideOtherFloors: true,
  fullscreenMode: false,
  bgFillMode: 'cover',
  skin: 'none',
  effectsEnabled: true,
  effectsQuality: 'balanced',
  effectsAutoClearOnSceneChange: true,
  effectsMaxActive: 2,
  uiScalePercentVersion: UI_SCALE_PERCENT_VERSION,
  dialogScalePercent: UI_SCALE_PERCENT_DEFAULT,
  toolbarScalePercent: UI_SCALE_PERCENT_DEFAULT,
  // 立绘设置
  spriteScale: 100,
  spriteBottomOffset: 20,
  spriteSpacing: 20,
  spriteUploadAspectRatio: DEFAULT_SPRITE_UPLOAD_RATIO,
  showMissingSpritePlaceholder: true,
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
  // 指定可用 BGM 歌单（为空表示不限制）
  bgmWhitelist: [],
  mapSystemEnabled: true,
  mapUseLocationBarClick: true,
  mapMarkerStyle: 'pin',
  mapLayoutSeed: 'default',
  mapCoordsByRegion: {},
  titleScreen: Object.assign({}, DEFAULT_TITLE_SCREEN_SETTINGS),
  titleScreenByChar: {},
  specialCg: Object.assign({}, DEFAULT_SPECIAL_CG_SETTINGS),
  specialCgByChar: {},
  specialCgUnlockedByChar: {},
  // TTS 设置
  ttsEnabled: true,
  ttsAutoPlay: true,
  ttsBilingualZhJaEnabled: false,
  situationalStyleEnabled: true,
  ttsDefaultSpeaker: '',
  ttsDefaultMaleVoices: [],
  ttsDefaultFemaleVoices: [],
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
    strictWeightSwitch: false,
    probeOnAudioError: false,
    modelSwitchMode: 'set_weights',
    setModelEndpoint: '/set_model',
    importPathPrefix: '',
    rootDir: '',
    models: [],
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

function normalizeBgmWhitelist(rawList) {
  const sourceList = Array.isArray(rawList)
    ? rawList
    : (typeof rawList === 'string' ? rawList.split(/\r?\n/) : []);

  return Array.from(
    new Set(
      sourceList
        .map(name => String(name || '').trim())
        .filter(Boolean),
    ),
  );
}

function normalizeTtsVoiceNameList(rawList) {
  return Array.from(
    new Set(
      _safeArray(rawList)
        .map(name => String(name || '').trim())
        .filter(Boolean),
    ),
  );
}

function normalizeDialogFontFamily(rawValue) {
  const allowed = ['sans', 'serif', 'wenkai', 'kaiti', 'mono'];
  const normalized = String(rawValue || '').trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : DEFAULT_SETTINGS.dialogFontFamily;
}

function normalizeTypewriterSpeed(rawValue) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return DEFAULT_SETTINGS.typewriterSpeed;
  return Math.max(5, Math.min(parsed, 60));
}

function normalizeTypewriterSoundVolume(rawValue) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return DEFAULT_SETTINGS.typewriterSoundVolume;
  return Math.max(0, Math.min(parsed, 100));
}

function normalizeTypewriterSettings(target) {
  if (!target || typeof target !== 'object') return;
  target.typewriterEnabled = target.typewriterEnabled !== false;
  target.typewriterSpeed = normalizeTypewriterSpeed(target.typewriterSpeed);
  target.typewriterSoundEnabled = target.typewriterSoundEnabled !== false;
  target.typewriterSoundVolume = normalizeTypewriterSoundVolume(target.typewriterSoundVolume);
}

function normalizeSpecialCgOperator(rawOperator) {
  const operator = String(rawOperator || '').trim().toLowerCase();
  const allowed = new Set(['gte', 'gt', 'eq', 'lte', 'lt']);
  return allowed.has(operator) ? operator : 'gte';
}

function normalizeSpecialCgRule(rule, index = 0) {
  const safeRule = _safeObject(rule);
  const parsedThreshold = Number(safeRule.threshold);
  const parsedPriority = Number(safeRule.priority);
  const baseId = String(safeRule.id || '').trim() || `special_cg_rule_${Date.now()}_${index}`;
  const variablePath = String(safeRule.variablePath || '')
    .trim()
    .replace(/^stat_data\./, '');

  return {
    id: baseId,
    name: String(safeRule.name || baseId).trim() || baseId,
    enabled: safeRule.enabled !== false,
    variablePath,
    operator: normalizeSpecialCgOperator(safeRule.operator),
    threshold: Number.isFinite(parsedThreshold) ? parsedThreshold : 0,
    cgId: String(safeRule.cgId || '').trim(),
    priority: Number.isFinite(parsedPriority) ? parsedPriority : 0,
    oncePerChat: true,
  };
}

export function createDefaultSpecialCgSettings() {
  return {
    enabled: false,
    rules: [],
  };
}

export function normalizeSpecialCgSettings(rawSpecialCg) {
  const safeConfig = _safeObject(rawSpecialCg);
  const seenIds = new Set();
  const normalizedRules = [];

  _safeArray(safeConfig.rules).forEach((item, index) => {
    const normalized = normalizeSpecialCgRule(item, index);
    if (!normalized.id || seenIds.has(normalized.id)) {
      normalized.id = `special_cg_rule_${Date.now()}_${index}`;
    }
    seenIds.add(normalized.id);
    normalizedRules.push(normalized);
  });

  return {
    enabled: safeConfig.enabled === true,
    rules: normalizedRules,
  };
}

export function normalizeSpriteUploadAspectRatio(rawValue) {
  const normalized = String(rawValue || '').trim();
  return SPRITE_UPLOAD_RATIO_VALUE_SET.has(normalized) ? normalized : DEFAULT_SPRITE_UPLOAD_RATIO;
}

function normalizeTitleScreenBackgroundSource(rawValue) {
  const source = String(rawValue || '').trim().toLowerCase();
  const allowed = new Set(['auto', 'upload', 'url']);
  return allowed.has(source) ? source : DEFAULT_TITLE_SCREEN_SETTINGS.backgroundSource;
}

function normalizeTitleScreenBackgroundFit(rawValue) {
  const fit = String(rawValue || '').trim().toLowerCase();
  return fit === 'contain' ? 'contain' : DEFAULT_TITLE_SCREEN_SETTINGS.backgroundFit;
}

function normalizeTitleScreenFontFamily(rawValue) {
  return String(rawValue || '').trim();
}

function normalizeTitleScreenFontSize(rawValue) {
  if (rawValue === '' || rawValue === null || rawValue === undefined) return '';
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) return '';
  return Math.max(8, Math.min(parsed, 240));
}

export function normalizeTitleScreenSettings(rawTitleScreen) {
  const safe = _safeObject(rawTitleScreen);
  const backgroundSceneName = String(safe.backgroundSceneName || '').trim() || DEFAULT_TITLE_SCREEN_SETTINGS.backgroundSceneName;

  return {
    enabled: safe.enabled === true,
    titleText: String(safe.titleText || '').trim(),
    titleFontFamily: normalizeTitleScreenFontFamily(safe.titleFontFamily),
    titleFontSize: normalizeTitleScreenFontSize(safe.titleFontSize),
    subtitleText: String(safe.subtitleText || '').trim(),
    subtitleFontFamily: normalizeTitleScreenFontFamily(safe.subtitleFontFamily),
    subtitleFontSize: normalizeTitleScreenFontSize(safe.subtitleFontSize),
    backgroundSource: normalizeTitleScreenBackgroundSource(safe.backgroundSource),
    backgroundSceneName,
    backgroundUrl: String(safe.backgroundUrl || '').trim(),
    backgroundFit: normalizeTitleScreenBackgroundFit(safe.backgroundFit),
    enableBackdropMask: safe.enableBackdropMask !== false,
  };
}

const TITLE_SCENE_CHAR_MARKER = '::char::';
const CHARACTER_SLOT_KEY_MARKER = '::slot::';
const TITLE_SCREEN_FALLBACK_CHAR_IDS = new Set(['default', 'assistant']);
const _titleScreenCardConfigSignatureByChar = {};
const _titleScreenLastCardObjectByChar = {};
const _titleScreenPendingCardSyncByChar = {};
let _lastActiveTitleScreenCharId = '';

function isFallbackTitleScreenCharId(rawCharId) {
  const normalized = String(rawCharId || '').trim().toLowerCase();
  return TITLE_SCREEN_FALLBACK_CHAR_IDS.has(normalized);
}

function stringifyTitleScreenConfigForSignature(rawConfig) {
  try {
    return JSON.stringify(rawConfig);
  } catch (error) {
    return '';
  }
}

function buildCharacterSlotKey(rawName, rawSlotId) {
  const safeName = normalizeCurrentCharToken(rawName);
  const safeSlotId = normalizeCurrentCharToken(rawSlotId);
  if (!safeName || !safeSlotId) return '';
  return `${safeName}${CHARACTER_SLOT_KEY_MARKER}${safeSlotId}`;
}

function normalizeTitleScreenByCharMap(rawMap) {
  const source = _safeObject(rawMap);
  const result = {};
  Object.entries(source).forEach(([rawCharId, rawConfig]) => {
    const charId = String(rawCharId || '').trim();
    if (!charId) return;
    result[charId] = normalizeTitleScreenSettings(rawConfig);
  });
  return result;
}

function normalizeSpecialCgByCharMap(rawMap) {
  const source = _safeObject(rawMap);
  const result = {};
  Object.entries(source).forEach(([rawCharId, rawConfig]) => {
    const charId = String(rawCharId || '').trim();
    if (!charId) return;
    result[charId] = normalizeSpecialCgSettings(rawConfig);
  });
  return result;
}

function resolveFallbackTitleScreenSettings(currentCharId, preservedSettings) {
  const currentMap = _safeObject(_settings?.titleScreenByChar);
  const explicitFallbackSettings =
    currentMap[currentCharId]
    || currentMap.default
    || currentMap.assistant
    || null;

  if (explicitFallbackSettings) {
    return normalizeTitleScreenSettings(explicitFallbackSettings);
  }

  const hasPerCharacterOverrides = Object.keys(currentMap).some(key => !isFallbackTitleScreenCharId(key));
  if (hasPerCharacterOverrides) {
    return normalizeTitleScreenSettings(DEFAULT_TITLE_SCREEN_SETTINGS);
  }

  return normalizeTitleScreenSettings(preservedSettings);
}

function normalizeSpecialCgUnlockedByCharMap(rawMap) {
  const source = _safeObject(rawMap);
  const result = {};
  Object.entries(source).forEach(([rawCharId, rawList]) => {
    const charId = String(rawCharId || '').trim();
    if (!charId) return;
    const normalizedList = Array.from(
      new Set(
        _safeArray(rawList)
          .map(item => String(item || '').trim())
          .filter(Boolean),
      ),
    );
    result[charId] = normalizedList;
  });
  return result;
}

function encodeTitleSceneCharId(rawCharId) {
  const charId = String(rawCharId || '').trim() || 'default';
  return encodeURIComponent(charId);
}

export function buildTitleSceneNameForChar(charId, rawSceneName = DEFAULT_TITLE_SCREEN_SETTINGS.backgroundSceneName) {
  const sceneName = String(rawSceneName || '').trim() || DEFAULT_TITLE_SCREEN_SETTINGS.backgroundSceneName;
  const markerIndex = sceneName.lastIndexOf(TITLE_SCENE_CHAR_MARKER);
  const baseName = markerIndex >= 0 ? sceneName.slice(0, markerIndex) : sceneName;
  const safeBaseName = baseName || DEFAULT_TITLE_SCREEN_SETTINGS.backgroundSceneName;
  return `${safeBaseName}${TITLE_SCENE_CHAR_MARKER}${encodeTitleSceneCharId(charId)}`;
}

function normalizeMapMarkerStyle(rawStyle) {
  const style = String(rawStyle || '').trim().toLowerCase();
  return style === 'dot' ? 'dot' : 'pin';
}

function normalizeMapCoordsByRegion(rawValue) {
  const source = _safeObject(rawValue);
  const result = {};
  Object.entries(source).forEach(([rawRegionKey, rawRegionMap]) => {
    const regionKey = String(rawRegionKey || '').trim();
    if (!regionKey) return;
    const regionMap = _safeObject(rawRegionMap);
    const normalizedRegionMap = {};
    Object.entries(regionMap).forEach(([rawLocation, rawCoord]) => {
      const location = String(rawLocation || '').trim();
      if (!location) return;
      const coord = _safeObject(rawCoord);
      const x = Number(coord.x);
      const y = Number(coord.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      normalizedRegionMap[location] = {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
        anchor: String(coord.anchor || '').trim(),
        updatedAt: coord.updatedAt ? String(coord.updatedAt) : undefined,
      };
    });
    result[regionKey] = normalizedRegionMap;
  });
  return result;
}

export function ensureMapSettings() {
  if (!_settings || typeof _settings !== 'object') {
    _settings = Object.assign({}, DEFAULT_SETTINGS);
  }
  if (typeof _settings.mapSystemEnabled !== 'boolean') {
    _settings.mapSystemEnabled = DEFAULT_SETTINGS.mapSystemEnabled;
  }
  if (typeof _settings.mapUseLocationBarClick !== 'boolean') {
    _settings.mapUseLocationBarClick = DEFAULT_SETTINGS.mapUseLocationBarClick;
  }
  _settings.mapMarkerStyle = normalizeMapMarkerStyle(_settings.mapMarkerStyle);
  _settings.mapLayoutSeed = String(_settings.mapLayoutSeed || DEFAULT_SETTINGS.mapLayoutSeed || 'default').trim() || 'default';
  _settings.mapCoordsByRegion = normalizeMapCoordsByRegion(_settings.mapCoordsByRegion);
  return {
    mapSystemEnabled: _settings.mapSystemEnabled,
    mapUseLocationBarClick: _settings.mapUseLocationBarClick,
    mapMarkerStyle: _settings.mapMarkerStyle,
    mapLayoutSeed: _settings.mapLayoutSeed,
    mapCoordsByRegion: _settings.mapCoordsByRegion,
  };
}

export function getMapSettings() {
  return ensureMapSettings();
}

export function updateMapSettings(patch = {}) {
  const safePatch = _safeObject(patch);
  ensureMapSettings();
  if (Object.prototype.hasOwnProperty.call(safePatch, 'mapSystemEnabled')) {
    _settings.mapSystemEnabled = !!safePatch.mapSystemEnabled;
  }
  if (Object.prototype.hasOwnProperty.call(safePatch, 'mapUseLocationBarClick')) {
    _settings.mapUseLocationBarClick = !!safePatch.mapUseLocationBarClick;
  }
  if (Object.prototype.hasOwnProperty.call(safePatch, 'mapMarkerStyle')) {
    _settings.mapMarkerStyle = normalizeMapMarkerStyle(safePatch.mapMarkerStyle);
  }
  if (Object.prototype.hasOwnProperty.call(safePatch, 'mapLayoutSeed')) {
    _settings.mapLayoutSeed = String(safePatch.mapLayoutSeed || '').trim() || 'default';
  }
  if (Object.prototype.hasOwnProperty.call(safePatch, 'mapCoordsByRegion')) {
    _settings.mapCoordsByRegion = normalizeMapCoordsByRegion(safePatch.mapCoordsByRegion);
  }
  saveSettings();
  return getMapSettings();
}

export function getMapCoords(regionKey) {
  const settings = ensureMapSettings();
  const key = String(regionKey || '').trim() || 'default-region';
  return _safeObject(settings.mapCoordsByRegion[key]);
}

export function setMapCoord(regionKey, detailedLocation, coord) {
  const key = String(regionKey || '').trim() || 'default-region';
  const location = String(detailedLocation || '').trim();
  if (!location) return false;
  const c = _safeObject(coord);
  const x = Number(c.x);
  const y = Number(c.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  ensureMapSettings();
  if (!_settings.mapCoordsByRegion[key]) _settings.mapCoordsByRegion[key] = {};
  _settings.mapCoordsByRegion[key][location] = {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    anchor: String(c.anchor || '').trim(),
    updatedAt: new Date().toISOString(),
  };
  saveSettings();
  return true;
}

export function removeMapCoord(regionKey, detailedLocation) {
  const key = String(regionKey || '').trim() || 'default-region';
  const location = String(detailedLocation || '').trim();
  if (!location) return false;
  ensureMapSettings();
  if (!_settings.mapCoordsByRegion[key] || !_settings.mapCoordsByRegion[key][location]) {
    return false;
  }
  delete _settings.mapCoordsByRegion[key][location];
  saveSettings();
  return true;
}

export function clearMapCoordsByRegion(regionKey) {
  const key = String(regionKey || '').trim() || 'default-region';
  ensureMapSettings();
  if (!_settings.mapCoordsByRegion[key]) return false;
  delete _settings.mapCoordsByRegion[key];
  saveSettings();
  return true;
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

export function ensureSpecialCgSettings() {
  if (!_settings || typeof _settings !== 'object') {
    _settings = Object.assign({}, DEFAULT_SETTINGS);
  }

  const charAliases = getCurrentCharKeyAliases();
  const currentCharId = charAliases[0] || 'default';
  _settings.specialCgByChar = normalizeSpecialCgByCharMap(_settings.specialCgByChar);

  const legacyGlobalConfig = normalizeSpecialCgSettings(_settings.specialCg);
  const hasAnyByCharConfig = Object.keys(_settings.specialCgByChar).length > 0;
  const hasLegacyData = legacyGlobalConfig.enabled === true || legacyGlobalConfig.rules.length > 0;
  if (!hasAnyByCharConfig && hasLegacyData) {
    _settings.specialCgByChar[currentCharId] = legacyGlobalConfig;
  }

  let rawCurrentCharConfig = _settings.specialCgByChar[currentCharId] || null;
  if (!rawCurrentCharConfig) {
    for (let i = 1; i < charAliases.length; i += 1) {
      const aliasKey = charAliases[i];
      if (!aliasKey) continue;
      const aliasConfig = _settings.specialCgByChar[aliasKey];
      if (aliasConfig) {
        rawCurrentCharConfig = aliasConfig;
        _settings.specialCgByChar[currentCharId] = aliasConfig;
        break;
      }
    }
  }

  const currentCharConfig = normalizeSpecialCgSettings(
    rawCurrentCharConfig || createDefaultSpecialCgSettings(),
  );
  _settings.specialCgByChar[currentCharId] = currentCharConfig;
  _settings.specialCg = currentCharConfig;
  return _settings.specialCg;
}

export function ensureSpecialCgUnlockedByCharSettings() {
  _settings.specialCgUnlockedByChar = normalizeSpecialCgUnlockedByCharMap(_settings.specialCgUnlockedByChar);
  return _settings.specialCgUnlockedByChar;
}

export function getUnlockedSpecialCgIdsForChar(charId = null) {
  const explicitCharId = String(charId || '').trim();
  const charAliases = explicitCharId ? [explicitCharId] : getCurrentCharKeyAliases();
  const safeCharId = charAliases[0] || 'default';
  const map = ensureSpecialCgUnlockedByCharSettings();
  let list = map[safeCharId];
  if (!Array.isArray(list)) {
    for (let i = 1; i < charAliases.length; i += 1) {
      const aliasKey = charAliases[i];
      if (!aliasKey) continue;
      const aliasList = map[aliasKey];
      if (Array.isArray(aliasList)) {
        list = aliasList;
        map[safeCharId] = aliasList.slice();
        break;
      }
    }
  }
  if (!Array.isArray(list)) return [];
  return list.slice();
}

export function addUnlockedSpecialCgForCurrentChar(cgId, charId = null) {
  const safeCgId = String(cgId || '').trim();
  if (!safeCgId) return false;
  const explicitCharId = String(charId || '').trim();
  const charAliases = explicitCharId ? [explicitCharId] : getCurrentCharKeyAliases();
  const safeCharId = charAliases[0] || 'default';
  const map = ensureSpecialCgUnlockedByCharSettings();
  let currentList = Array.isArray(map[safeCharId]) ? map[safeCharId].slice() : [];
  if (currentList.length === 0) {
    for (let i = 1; i < charAliases.length; i += 1) {
      const aliasKey = charAliases[i];
      if (!aliasKey) continue;
      if (Array.isArray(map[aliasKey]) && map[aliasKey].length > 0) {
        currentList = map[aliasKey].slice();
        break;
      }
    }
  }
  if (currentList.includes(safeCgId)) return false;
  currentList.push(safeCgId);
  map[safeCharId] = currentList;
  saveSettings();
  return true;
}

export function ensureTitleScreenSettings() {
  if (!_settings || typeof _settings !== 'object') {
    _settings = Object.assign({}, DEFAULT_SETTINGS);
  }

  const charAliases = getCurrentCharKeyAliases();
  const currentCharId = charAliases[0] || 'default';
  const shouldSkipFallbackChar = isFallbackTitleScreenCharId(currentCharId);
  _settings.titleScreenByChar = normalizeTitleScreenByCharMap(_settings.titleScreenByChar);
  const beforeMapKeys = Object.keys(_settings.titleScreenByChar || {});
  let matchedAliasKey = '';
  let rawCurrentCharSettings = _settings.titleScreenByChar[currentCharId] || null;
  if (shouldSkipFallbackChar) {
    if (_lastActiveTitleScreenCharId && !isFallbackTitleScreenCharId(_lastActiveTitleScreenCharId)) {
      _titleScreenPendingCardSyncByChar[_lastActiveTitleScreenCharId] = true;
    }
    const preserved = normalizeTitleScreenSettings(_settings.titleScreen || DEFAULT_TITLE_SCREEN_SETTINGS);
    const fallbackSettings = resolveFallbackTitleScreenSettings(currentCharId, preserved);
    logTitleScreenDiag('ensureTitleScreenSettings:skip-fallback-char', {
      charAliases,
      currentCharId,
      beforeMapKeys,
      syncTargetCharId: _lastActiveTitleScreenCharId,
      preservedTitleScreen: summarizeTitleScreenConfigForLog(preserved),
      fallbackTitleScreen: summarizeTitleScreenConfigForLog(fallbackSettings),
    });
    _settings.titleScreen = fallbackSettings;
    return _settings.titleScreen;
  }

  const needsCardSyncFromFallback = _titleScreenPendingCardSyncByChar[currentCharId] === true;
  const cardTitlePayload = readCurrentCharacterTitleScreenConfigFromCard();
  let appliedCardExtension = false;
  let cardSyncReason = '';
  let cardSignatureChanged = false;
  let cardRefChanged = false;
  let cardConfigSummary = null;

  if (cardTitlePayload && cardTitlePayload.hasCardData === true) {
    const previousCardSignature = String(_titleScreenCardConfigSignatureByChar[currentCharId] || '');
    const previousCardObject = _titleScreenLastCardObjectByChar[currentCharId] || null;
    const currentCardObject =
      cardTitlePayload.cardData && typeof cardTitlePayload.cardData === 'object'
        ? cardTitlePayload.cardData
        : null;
    cardRefChanged = !!previousCardObject && !!currentCardObject && previousCardObject !== currentCardObject;
    if (currentCardObject) {
      _titleScreenLastCardObjectByChar[currentCharId] = currentCardObject;
    }

    if (cardTitlePayload.rawTitleScreen) {
      const cardTitleSettings = normalizeTitleScreenSettings(cardTitlePayload.rawTitleScreen);
      cardTitleSettings.backgroundSceneName = buildTitleSceneNameForChar(
        currentCharId,
        cardTitleSettings.backgroundSceneName,
      );
      const cardSignature = stringifyTitleScreenConfigForSignature(cardTitleSettings);
      cardSignatureChanged = !!previousCardSignature && !!cardSignature && cardSignature !== previousCardSignature;
      cardConfigSummary = summarizeTitleScreenConfigForLog(cardTitleSettings);
      const shouldApplyCardSettings =
        needsCardSyncFromFallback
        || cardSignatureChanged
        || cardRefChanged
        || (!rawCurrentCharSettings && !previousCardSignature);

      if (shouldApplyCardSettings) {
        rawCurrentCharSettings = cardTitleSettings;
        _settings.titleScreenByChar[currentCharId] = cardTitleSettings;
        _settings.titleScreen = cardTitleSettings;
        appliedCardExtension = true;
        if (needsCardSyncFromFallback) cardSyncReason = 'fallback-sync';
        else if (cardSignatureChanged) cardSyncReason = 'signature-changed';
        else if (cardRefChanged) cardSyncReason = 'card-ref-changed';
        else cardSyncReason = 'missing-local-config';
      }

      if (cardSignature) {
        _titleScreenCardConfigSignatureByChar[currentCharId] = cardSignature;
      }
    }
  }

  if (needsCardSyncFromFallback && (appliedCardExtension || cardTitlePayload.hasCardData === true)) {
    delete _titleScreenPendingCardSyncByChar[currentCharId];
  }

  if (!rawCurrentCharSettings) {
    for (let i = 1; i < charAliases.length; i += 1) {
      const aliasKey = charAliases[i];
      if (!aliasKey) continue;
      const aliasSettings = _settings.titleScreenByChar[aliasKey];
      if (aliasSettings) {
        rawCurrentCharSettings = aliasSettings;
        matchedAliasKey = aliasKey;
        _settings.titleScreenByChar[currentCharId] = aliasSettings;
        break;
      }
    }
  }
  const fallbackSettings = DEFAULT_TITLE_SCREEN_SETTINGS;
  const currentCharSettings = normalizeTitleScreenSettings(
    rawCurrentCharSettings || fallbackSettings,
  );
  currentCharSettings.backgroundSceneName = buildTitleSceneNameForChar(
    currentCharId,
    currentCharSettings.backgroundSceneName,
  );

  _settings.titleScreenByChar[currentCharId] = currentCharSettings;
  _settings.titleScreen = currentCharSettings;
  _lastActiveTitleScreenCharId = currentCharId;
  logTitleScreenDiag('ensureTitleScreenSettings', {
    charAliases,
    currentCharId,
    matchedAliasKey,
    beforeMapKeys,
    pendingCardSync: needsCardSyncFromFallback,
    appliedCardExtension,
    cardSyncReason,
    cardSignatureChanged,
    cardRefChanged,
    cardConfigSummary,
    afterMapKeys: Object.keys(_settings.titleScreenByChar || {}),
    activeTitleScreen: summarizeTitleScreenConfigForLog(_settings.titleScreen),
  });
  return _settings.titleScreen;
}

// 当前设置 (getter/setter 模式 - esbuild IIFE 中 export let 不可靠)
let _settings = Object.assign({}, DEFAULT_SETTINGS);
export function ensureEnhancedModeSettings() {
  _settings.enhancedMode = normalizeEnhancedModeSettings(_settings.enhancedMode);
  return _settings.enhancedMode;
}
ensureEnhancedModeSettings();
ensureMapSettings();
ensureSpecialCgSettings();
ensureSpecialCgUnlockedByCharSettings();
ensureTitleScreenSettings();

export function getSettings() { return _settings; }
export function setSettings(v) { _settings = v; }

// 每个角色卡的开关状态
let _charEnabledMap = {};
const CHAR_ENABLED_VAR_PATH = ['galgame_ui_plugin', 'runtime', 'enabled'];
let _charEnabledVariableReadWarned = false;
let _charEnabledVariableWriteWarned = false;

function getNestedValueByPath(source, path) {
  if (!source || typeof source !== 'object' || !Array.isArray(path) || path.length === 0) return undefined;
  let current = source;
  for (const segment of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[segment];
  }
  return current;
}

function setNestedValueByPath(target, path, value) {
  if (!target || typeof target !== 'object' || !Array.isArray(path) || path.length === 0) return;
  let current = target;
  for (let i = 0; i < path.length - 1; i += 1) {
    const segment = path[i];
    const next = current[segment];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      current[segment] = {};
    }
    current = current[segment];
  }
  current[path[path.length - 1]] = value;
}

function readCurrentCharEnabledFromCharacterVariables() {
  try {
    if (typeof getVariables !== 'function') return null;
    const variables = getVariables({ type: 'character' });
    const rawEnabled = getNestedValueByPath(variables, CHAR_ENABLED_VAR_PATH);
    if (rawEnabled === true) return true;
    if (rawEnabled === false) return false;
  } catch (e) {
    if (!_charEnabledVariableReadWarned) {
      _charEnabledVariableReadWarned = true;
      console.warn(`[${SCRIPT_NAME}] 读取角色卡开关变量失败:`, e);
    }
  }
  return null;
}

function persistCurrentCharEnabledToCharacterVariables(enabled) {
  try {
    if (typeof getVariables !== 'function' || typeof replaceVariables !== 'function') {
      return false;
    }
    const variables = getVariables({ type: 'character' });
    const nextVariables =
      variables && typeof variables === 'object' && !Array.isArray(variables)
        ? variables
        : {};
    setNestedValueByPath(nextVariables, CHAR_ENABLED_VAR_PATH, enabled === true);
    replaceVariables(nextVariables, { type: 'character' });
    return true;
  } catch (e) {
    if (!_charEnabledVariableWriteWarned) {
      _charEnabledVariableWriteWarned = true;
      console.warn(`[${SCRIPT_NAME}] 写入角色卡开关变量失败:`, e);
    }
    return false;
  }
}

function normalizeCurrentCharToken(rawValue) {
  if (rawValue === undefined || rawValue === null) return '';
  const text = String(rawValue).trim();
  if (!text) return '';
  if (text === '-1') return '';
  const lowerText = text.toLowerCase();
  if (lowerText === 'undefined' || lowerText === 'null') return '';
  return text;
}

function shouldLogTitleScreenDiag() {
  return topWindow?.__GAL_TITLE_DEBUG__ !== false;
}

function summarizeTitleScreenConfigForLog(rawConfig) {
  const config = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
  const backgroundUrl = String(config.backgroundUrl || '').trim();
  return {
    enabled: config.enabled === true,
    titleText: String(config.titleText || ''),
    titleFontFamily: String(config.titleFontFamily || ''),
    titleFontSize: config.titleFontSize === '' || config.titleFontSize == null ? '' : Number(config.titleFontSize),
    subtitleText: String(config.subtitleText || ''),
    subtitleFontFamily: String(config.subtitleFontFamily || ''),
    subtitleFontSize: config.subtitleFontSize === '' || config.subtitleFontSize == null ? '' : Number(config.subtitleFontSize),
    backgroundSource: String(config.backgroundSource || ''),
    backgroundSceneName: String(config.backgroundSceneName || ''),
    backgroundFit: String(config.backgroundFit || ''),
    enableBackdropMask: config.enableBackdropMask !== false,
    hasBackgroundUrl: !!backgroundUrl,
    backgroundUrlLength: backgroundUrl.length,
  };
}

function logTitleScreenDiag(stage, payload = {}) {
  if (!shouldLogTitleScreenDiag()) return;
  try {
    console.log(`[${SCRIPT_NAME}] [TitleScreenDiag] ${stage}`, payload);
  } catch {
    // ignore diagnostic logging errors
  }
}

function readCharacterDataById(characters, rawCharacterId) {
  const characterId = normalizeCurrentCharToken(rawCharacterId);
  if (!characterId || !characters || typeof characters !== 'object') return null;

  let characterData = null;
  if (Array.isArray(characters)) {
    const numericId = Number.parseInt(characterId, 10);
    if (Number.isFinite(numericId) && numericId >= 0 && numericId < characters.length) {
      characterData = characters[numericId];
    }
  } else {
    characterData = characters[characterId] || null;
    if (!characterData && /^\d+$/.test(characterId)) {
      characterData = characters[Number.parseInt(characterId, 10)] || null;
    }
  }
  return characterData || null;
}

function readCurrentCharacterData() {
  const st = topWindow?.SillyTavern || null;
  const ctx = typeof st?.getContext === 'function' ? st.getContext() : null;
  const ctxCharacterId = normalizeCurrentCharToken(ctx?.characterId);
  const stCharacterId = normalizeCurrentCharToken(st?.characterId);
  const thisChid = normalizeCurrentCharToken(topWindow?.this_chid);
  const resolvedId = ctxCharacterId || stCharacterId || thisChid;

  const fromCtx = readCharacterDataById(ctx?.characters, resolvedId);
  if (fromCtx && typeof fromCtx === 'object') return fromCtx;
  const fromSt = readCharacterDataById(st?.characters, resolvedId);
  if (fromSt && typeof fromSt === 'object') return fromSt;
  return null;
}

function extractGalgamePluginConfigFromCardObject(cardLike) {
  if (!cardLike || typeof cardLike !== 'object') return null;
  const candidates = [
    cardLike?.data?.extensions?.galgame_ui_plugin,
    cardLike?.extensions?.galgame_ui_plugin,
    cardLike?.json_data?.data?.extensions?.galgame_ui_plugin,
    cardLike?.json_data?.extensions?.galgame_ui_plugin,
  ];
  for (const item of candidates) {
    if (item && typeof item === 'object' && !Array.isArray(item)) return item;
  }
  return null;
}

function readCurrentCharacterTitleScreenConfigFromCard() {
  const cardData = readCurrentCharacterData();
  if (!cardData || typeof cardData !== 'object') {
    return {
      hasCardData: false,
      cardData: null,
      rawTitleScreen: null,
    };
  }
  const pluginConfig = extractGalgamePluginConfigFromCardObject(cardData);
  if (!pluginConfig || typeof pluginConfig !== 'object') {
    return {
      hasCardData: true,
      cardData,
      rawTitleScreen: null,
    };
  }
  const rawTitleScreen =
    pluginConfig?.titleScreen
    || pluginConfig?.custom?.titleScreen
    || null;
  const validTitleScreen =
    rawTitleScreen && typeof rawTitleScreen === 'object' && !Array.isArray(rawTitleScreen)
      ? rawTitleScreen
      : null;
  return {
    hasCardData: true,
    cardData,
    rawTitleScreen: validTitleScreen,
  };
}

function readCharacterNameById(characters, rawCharacterId) {
  const characterData = readCharacterDataById(characters, rawCharacterId);
  return String(characterData?.name || characterData?.data?.name || '').trim();
}

function readCharacterAvatarById(characters, rawCharacterId) {
  const characterData = readCharacterDataById(characters, rawCharacterId);
  return normalizeCurrentCharToken(characterData?.avatar || characterData?.data?.avatar);
}

function resolveCharacterPrimaryKey(snapshot) {
  const characterName = normalizeCurrentCharToken(snapshot?.characterName);
  if (!characterName) return '';
  const slotKey = buildCharacterSlotKey(characterName, snapshot?.characterSlotId);
  if (slotKey) return slotKey;
  return characterName;
}

function getCurrentCharacterSnapshot() {
  const st = topWindow?.SillyTavern || null;
  const ctx = typeof st?.getContext === 'function' ? st.getContext() : null;

  const ctxCharacterId = normalizeCurrentCharToken(ctx?.characterId);
  const stCharacterId = normalizeCurrentCharToken(st?.characterId);
  const thisChid = normalizeCurrentCharToken(topWindow?.this_chid);
  const resolvedCharacterId = ctxCharacterId || stCharacterId || thisChid;

  const ctxCharacterName = readCharacterNameById(ctx?.characters, resolvedCharacterId);
  const stCharacterName = readCharacterNameById(st?.characters, resolvedCharacterId);
  const ctxCharacterAvatar = readCharacterAvatarById(ctx?.characters, resolvedCharacterId);
  const stCharacterAvatar = readCharacterAvatarById(st?.characters, resolvedCharacterId);
  const ctxFallbackCharacterName = resolvedCharacterId ? normalizeCurrentCharToken(ctx?.name2) : '';
  const stFallbackCharacterName = resolvedCharacterId ? normalizeCurrentCharToken(st?.name2) : '';
  const currentCharacterName =
    ctxCharacterName
    || stCharacterName
    || ctxFallbackCharacterName
    || stFallbackCharacterName
    || '';
  const currentCharacterAvatar = ctxCharacterAvatar || stCharacterAvatar || '';
  const currentCharacterSlotId = resolvedCharacterId;

  return {
    characterName: currentCharacterName,
    characterAvatar: currentCharacterAvatar,
    characterSlotId: currentCharacterSlotId,
  };
}

export function getCurrentCharacterName() {
  try {
    return String(getCurrentCharacterSnapshot()?.characterName || '').trim();
  } catch {
    return '';
  }
}

function getCurrentCharKeyAliases() {
  const snapshot = getCurrentCharacterSnapshot();
  const aliases = [];
  const primaryKey = resolveCharacterPrimaryKey(snapshot);
  if (primaryKey) aliases.push(primaryKey);

  const slotKey = buildCharacterSlotKey(snapshot?.characterName, snapshot?.characterSlotId);
  if (slotKey && !aliases.includes(slotKey)) aliases.push(slotKey);

  const legacyNameKey = normalizeCurrentCharToken(snapshot.characterName);
  if (legacyNameKey && !aliases.includes(legacyNameKey)) aliases.push(legacyNameKey);
  return aliases.length > 0 ? aliases : ['default'];
}

// 获取当前角色卡主键（统一按 槽位ID > 角色名）
export function getCurrentCharId() {
  try {
    const snapshot = getCurrentCharacterSnapshot();
    const primaryKey = resolveCharacterPrimaryKey(snapshot);
    if (primaryKey) {
      logTitleScreenDiag('getCurrentCharId', {
        primaryKey,
        characterName: String(snapshot?.characterName || ''),
        characterAvatar: String(snapshot?.characterAvatar || ''),
        characterSlotId: String(snapshot?.characterSlotId || ''),
      });
      return primaryKey;
    }
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 获取当前角色ID失败:`, e);
  }
  logTitleScreenDiag('getCurrentCharId:fallback-default', {});
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
      const hasLegacyUiScale = Object.prototype.hasOwnProperty.call(parsed, 'uiScalePercent');
      if (hasLegacyUiScale) {
        const legacyScale = convertLegacyUiScalePercent(parsed.uiScalePercent);
        if (!Object.prototype.hasOwnProperty.call(parsed, 'dialogScalePercent')) {
          _settings.dialogScalePercent = legacyScale;
        }
        if (!Object.prototype.hasOwnProperty.call(parsed, 'toolbarScalePercent')) {
          _settings.toolbarScalePercent = legacyScale;
        }
      }
      if (Number(_settings.uiScalePercentVersion) !== UI_SCALE_PERCENT_VERSION) {
        _settings.dialogScalePercent = convertLegacyUiScalePercent(_settings.dialogScalePercent);
        _settings.toolbarScalePercent = convertLegacyUiScalePercent(_settings.toolbarScalePercent);
        _settings.uiScalePercentVersion = UI_SCALE_PERCENT_VERSION;
      }
      delete _settings.uiScalePercent;
      _settings.enhancedMode = normalizeEnhancedModeSettings(_settings.enhancedMode);
      _settings.specialCg = normalizeSpecialCgSettings(_settings.specialCg);
      _settings.specialCgByChar = normalizeSpecialCgByCharMap(_settings.specialCgByChar);
      _settings.specialCgUnlockedByChar = normalizeSpecialCgUnlockedByCharMap(_settings.specialCgUnlockedByChar);
      _settings.titleScreen = normalizeTitleScreenSettings(_settings.titleScreen);
      _settings.titleScreenByChar = normalizeTitleScreenByCharMap(_settings.titleScreenByChar);
      _settings.bgmWhitelist = normalizeBgmWhitelist(_settings.bgmWhitelist);
      _settings.dialogFontFamily = normalizeDialogFontFamily(_settings.dialogFontFamily);
      normalizeTypewriterSettings(_settings);
      _settings.spriteUploadAspectRatio = normalizeSpriteUploadAspectRatio(_settings.spriteUploadAspectRatio);
      if (!_settings.gptSoVits || typeof _settings.gptSoVits !== 'object') {
        _settings.gptSoVits = Object.assign({}, DEFAULT_SETTINGS.gptSoVits);
      }
      if (!Array.isArray(_settings.gptSoVits.voices)) {
        _settings.gptSoVits.voices = [];
      }
      if (!Array.isArray(_settings.gptSoVits.models)) {
        _settings.gptSoVits.models = [];
      }
      if (typeof _settings.gptSoVits.rootDir !== 'string') {
        _settings.gptSoVits.rootDir = '';
      }
      if (typeof _settings.gptSoVits.importPathPrefix !== 'string') {
        _settings.gptSoVits.importPathPrefix = '';
      }
      const allowedEffectQualities = ['mobile', 'balanced', 'high'];
      if (!allowedEffectQualities.includes(_settings.effectsQuality)) {
        _settings.effectsQuality = DEFAULT_SETTINGS.effectsQuality;
      }
      _settings.effectsEnabled = _settings.effectsEnabled !== false;
      _settings.effectsAutoClearOnSceneChange = _settings.effectsAutoClearOnSceneChange !== false;
      const parsedEffectMaxActive = parseInt(_settings.effectsMaxActive, 10);
      if (Number.isFinite(parsedEffectMaxActive)) {
        _settings.effectsMaxActive = Math.max(1, Math.min(parsedEffectMaxActive, 6));
      } else {
        _settings.effectsMaxActive = DEFAULT_SETTINGS.effectsMaxActive;
      }
      _settings.dialogScalePercent = normalizeUiScalePercent(_settings.dialogScalePercent);
      _settings.toolbarScalePercent = normalizeUiScalePercent(_settings.toolbarScalePercent);
      _settings.uiScalePercentVersion = UI_SCALE_PERCENT_VERSION;
      _settings.ttsBilingualZhJaEnabled = _settings.ttsBilingualZhJaEnabled === true;
      _settings.situationalStyleEnabled = _settings.situationalStyleEnabled !== false;
      _settings.ttsDefaultMaleVoices = normalizeTtsVoiceNameList(_settings.ttsDefaultMaleVoices);
      _settings.ttsDefaultFemaleVoices = normalizeTtsVoiceNameList(_settings.ttsDefaultFemaleVoices);
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
      ensureMapSettings();
      ensureSpecialCgSettings();
      ensureTitleScreenSettings();
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
    _settings.specialCg = normalizeSpecialCgSettings(_settings.specialCg);
    _settings.specialCgByChar = normalizeSpecialCgByCharMap(_settings.specialCgByChar);
    ensureSpecialCgSettings();
    _settings.specialCgUnlockedByChar = normalizeSpecialCgUnlockedByCharMap(_settings.specialCgUnlockedByChar);
    _settings.bgmWhitelist = normalizeBgmWhitelist(_settings.bgmWhitelist);
    _settings.dialogFontFamily = normalizeDialogFontFamily(_settings.dialogFontFamily);
    normalizeTypewriterSettings(_settings);
    _settings.titleScreen = normalizeTitleScreenSettings(_settings.titleScreen);
    _settings.titleScreenByChar = normalizeTitleScreenByCharMap(_settings.titleScreenByChar);
    _settings.spriteUploadAspectRatio = normalizeSpriteUploadAspectRatio(_settings.spriteUploadAspectRatio);
    _settings.ttsDefaultMaleVoices = normalizeTtsVoiceNameList(_settings.ttsDefaultMaleVoices);
    _settings.ttsDefaultFemaleVoices = normalizeTtsVoiceNameList(_settings.ttsDefaultFemaleVoices);
    delete _settings.uiScalePercent;
    _settings.dialogScalePercent = normalizeUiScalePercent(_settings.dialogScalePercent);
    _settings.toolbarScalePercent = normalizeUiScalePercent(_settings.toolbarScalePercent);
    _settings.uiScalePercentVersion = UI_SCALE_PERCENT_VERSION;
    ensureMapSettings();
    ensureTitleScreenSettings();
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
  const charAliases = getCurrentCharKeyAliases();
  const charId = charAliases[0] || 'default';
  const variableEnabled = readCurrentCharEnabledFromCharacterVariables();
  if (variableEnabled === true || variableEnabled === false) {
    if (_charEnabledMap[charId] !== variableEnabled) {
      _charEnabledMap[charId] = variableEnabled;
      saveCharEnabled();
    }
    return variableEnabled;
  }

  if (_charEnabledMap[charId] === true || _charEnabledMap[charId] === false) {
    return _charEnabledMap[charId] === true;
  }
  for (let i = 1; i < charAliases.length; i += 1) {
    const aliasKey = charAliases[i];
    if (!aliasKey) continue;
    if (_charEnabledMap[aliasKey] === true || _charEnabledMap[aliasKey] === false) {
      _charEnabledMap[charId] = _charEnabledMap[aliasKey] === true;
      saveCharEnabled();
      return _charEnabledMap[charId];
    }
  }
  return false;
}

// 设置当前角色卡的开关状态
export function setCurrentCharEnabled(enabled) {
  const charAliases = getCurrentCharKeyAliases();
  const charId = charAliases[0] || 'default';
  const safeEnabled = enabled === true;
  _charEnabledMap[charId] = safeEnabled;
  saveCharEnabled();
  persistCurrentCharEnabledToCharacterVariables(safeEnabled);
}
