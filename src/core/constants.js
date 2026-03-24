// ============================================
// 常量定义
// ============================================
export const SCRIPT_ID = 'galgame-ui-plugin';
export const SCRIPT_NAME = 'Galgame界面插件';
export const VERSION = '2.2.1';
export const DB_NAME = 'GalgameUIPluginDB';
export const DB_VERSION = 9;
export const STORE_SPRITES = 'sprites';
export const STORE_BACKGROUNDS = 'backgrounds';
export const STORE_MAP_IMAGES = 'mapImages';
export const STORE_IMAGE_PACKS = 'imagePacks';
export const STORE_LIVE2D_MODELS = 'live2dModels';
export const STORE_SDK_CACHE = 'sdkCache';
export const STORE_UI_SKINS = 'uiSkins';
export const STORE_UI_SKIN_PROFILES = 'uiSkinProfiles';
export const STORE_SPECIAL_CGS = 'specialCgs';
export const DEFAULT_PACK_ID = 'pack_default';
export const DEFAULT_PACK_NAME = '未定义';
export const CUSTOM_SKIN_ID = 'custom-skin';
export const TWILIGHT_SKIN_ID = 'skin-twilight';
export const GILDED_TWILIGHT_SKIN_ID = 'skin-gilded-twilight';
export const DAWN_TWILIGHT_SKIN_ID = 'skin-dawn-twilight';
export const ORCHID_TWILIGHT_SKIN_ID = 'skin-orchid-twilight';
export const NEON_TWILIGHT_SKIN_ID = 'skin-neon-twilight';
export const CLEAR_TWILIGHT_SKIN_ID = 'skin-clear-twilight';
export const FOREST_TWILIGHT_SKIN_ID = 'skin-forest-twilight';
export const CYBER_TWILIGHT_SKIN_ID = 'skin-cyber-twilight';
export const DREAM_TWILIGHT_SKIN_ID = 'skin-dream-twilight';
export const ROSY_TWILIGHT_SKIN_ID = 'skin-rosy-twilight';
export const TWILIGHT_VARIANT_SKIN_IDS = [
  GILDED_TWILIGHT_SKIN_ID,
  DAWN_TWILIGHT_SKIN_ID,
  ORCHID_TWILIGHT_SKIN_ID,
  NEON_TWILIGHT_SKIN_ID,
  CLEAR_TWILIGHT_SKIN_ID,
  FOREST_TWILIGHT_SKIN_ID,
  CYBER_TWILIGHT_SKIN_ID,
  DREAM_TWILIGHT_SKIN_ID,
  ROSY_TWILIGHT_SKIN_ID,
];
export const TWILIGHT_FAMILY_SKIN_IDS = [TWILIGHT_SKIN_ID, ...TWILIGHT_VARIANT_SKIN_IDS];
export const GLOBAL_CUSTOM_SKIN_PACK_ID = '__global_custom_skin__';
export const CUSTOM_SKIN_PROFILE_ID_PREFIX = 'custom-profile::';

// 样式主题常量 (Cyber Pop)
export const THEME = {
  white: '#ffffff',
  dark: '#2b2e38',
  accent: '#00d2ff',
  accentSub: '#ff0055',
  bgOverlay: 'rgba(255, 255, 255, 0.95)',
  fontMain: "'Noto Sans SC', sans-serif",
  fontEng: "'Barlow', sans-serif",
};

export const BG_TRANSITION_MS = 450;

// 世界书配置
export const WORLDBOOK_NAME = 'galgame界面插件';
export const COT_ENTRY_NAME = 'Galgame输出格式规范';

// 预设表情列表
export const EXPRESSION_LIST = ['默认', '微笑', '生气', '难过', '惊讶', '嘲讽', '害羞', '思考', '大笑', '搞怪'];

// 表情到英文文生图tag的映射
export const EXPRESSION_TAG_MAP = {
  默认: 'neutral expression, looking at viewer',
  微笑: 'smile, happy, gentle expression',
  生气: 'angry, furrowed brows, intense eyes',
  难过: 'sad, tears, sorrowful expression',
  惊讶: 'surprised, wide eyes, open mouth',
  嘲讽: 'smirk, condescending, mocking expression',
  害羞: 'blush, shy, embarrassed, looking away',
  思考: 'thinking, hand on chin, contemplative',
  大笑: 'laughing, open mouth, closed eyes, very happy',
  搞怪: 'playful, wink, tongue out, silly face',
};

// ============================================
// 预编译正则表达式
// ============================================
export const RE_GAL_TAGS = /<(p|sprite|maintext|background|pixiPerform|pixiInit|弹窗一|弹窗二)[^>]*>/i;
export const RE_CLOSED_P = /<\/p>/i;
export const RE_THINK_CLOSED = /<(think|thinking)>[\s\S]*?<\/\1>/gi;
export const RE_THINK_UNCLOSED = /<(think|thinking)>[\s\S]*$/gi;
export const RE_PRE_TAG = /<pre[^>]*>/gi;
export const RE_PRE_CLOSE = /<\/pre>/gi;
export const RE_CODE_TAG = /<code[^>]*>/gi;
export const RE_CODE_CLOSE = /<\/code>/gi;
export const RE_TAG_WHITESPACE = />\s+</g;
export const RE_MAINTEXT_CLOSED = /<maintext>([\s\S]*?)<\/maintext>/i;
export const RE_MAINTEXT_UNCLOSED = /<maintext>([\s\S]*)$/i;
export const RE_BACKGROUND = /<background\s+scene="([^"]+)"\s*[\/]?>/i;
export const RE_BGIMG = /<bgimg>(.*?)<\/bgimg>/i;
export const RE_WHIMG = /<whimg>(.*?)<\/whimg>/i;
export const RE_BNIMG = /<bnimg>([\s\S]*?)<\/bnimg>/i;
export const RE_BGM = /<bgm>(?:当前bgm[:：])?(.+?)<\/bgm>/i;
export const RE_OPTION = /<option\s+id="([^"]+)"[^>]*>([^<]+)<\/option>/gi;
export const RE_P_TAG = /<p(?:\s[^>]*)?>[\s\S]*?<\/p>/gi;

export const PARSE_CACHE_MAX_SIZE = 30;
