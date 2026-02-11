// ============================================
// 常量定义
// ============================================
export const SCRIPT_ID = 'galgame-ui-plugin';
export const SCRIPT_NAME = 'Galgame界面插件';
export const VERSION = '2.2.1';
export const DB_NAME = 'GalgameUIPluginDB';
export const DB_VERSION = 4;
export const STORE_SPRITES = 'sprites';
export const STORE_BACKGROUNDS = 'backgrounds';
export const STORE_IMAGE_PACKS = 'imagePacks';
export const STORE_LIVE2D_MODELS = 'live2dModels';
export const STORE_SDK_CACHE = 'sdkCache';
export const DEFAULT_PACK_ID = 'pack_default';
export const DEFAULT_PACK_NAME = '未定义';

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
export const RE_GAL_TAGS = /<(p|sprite|maintext|background)[^>]*>/i;
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
