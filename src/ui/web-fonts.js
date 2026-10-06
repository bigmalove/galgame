import { SCRIPT_ID, SCRIPT_NAME, CYBERPOP_DARK_SKIN_ID, CYBERPOP_SKIN_ID, DEFAULT_DARK_SKIN_ID, DEFAULT_SOFT_SKIN_ID, ANCIENT_FAMILY_SKIN_IDS, PERSONA_FAMILY_SKIN_IDS, JRPG_FAMILY_SKIN_IDS, YANYUN_FAMILY_SKIN_IDS, SHUJIAN_FAMILY_SKIN_IDS } from '../core/constants.js';
import { topWindow } from '../core/env.js';
import { getSettings } from '../core/settings.js';

// ============================================
// 皮肤 Web 字体按需加载
// ============================================
// 皮肤 CSS 里写的 Barlow / Noto Serif SC / Ma Shan Zheng 等此前从未加载，只能回退系统字体。
// 这里按当前皮肤与对话字体，从 jsDelivr fontsource 拉取 unicode-range 分片字体（国内可达，
// 浏览器只下载页面实际用到的字形分片）。CSS 以 fetch 取回后改写再注入 <style>：
//   1) 相对路径 ./files/... 补全为绝对 URL（注入到 <style> 后相对路径会失效）
//   2) 可变字体包的字族名带 " Variable" 后缀，改写回原名，皮肤 CSS 无需改动

const CDN_HOSTS = ['https://cdn.jsdelivr.net', 'https://gcore.jsdelivr.net'];

// 中文字体按皮肤实际用到的字重加载静态包（可变 CJK 分片约为单字重的 1.85 倍）；
// 拉丁字体优先可变包（体积小、一次覆盖全部字重）
const FONT_SOURCES = {
  'Barlow': { pkg: '@fontsource/barlow@5', files: ['600', '700', '800', '900'] },
  'Noto Sans SC': { pkg: '@fontsource/noto-sans-sc@5', files: ['500', '700'] },
  'Noto Serif SC': { pkg: '@fontsource/noto-serif-sc@5', files: ['500', '700'] },
  'Ma Shan Zheng': { pkg: '@fontsource/ma-shan-zheng@5', files: ['400'] },
  'Anton': { pkg: '@fontsource/anton@5', files: ['400'] },
  'Archivo Black': { pkg: '@fontsource/archivo-black@5', files: ['400'] },
  'Zen Old Mincho': { pkg: '@fontsource/zen-old-mincho@5', files: ['400', '700'] },
  'Zhi Mang Xing': { pkg: '@fontsource/zhi-mang-xing@5', files: ['400'] },
  'Liu Jian Mao Cao': { pkg: '@fontsource/liu-jian-mao-cao@5', files: ['400'] },
  'Shippori Mincho': { pkg: '@fontsource/shippori-mincho@5', files: ['500', '600', '700'] },
  'Zen Kaku Gothic New': { pkg: '@fontsource/zen-kaku-gothic-new@5', files: ['400', '500', '700'] },
  'Italiana': { pkg: '@fontsource/italiana@5', files: ['400'] },
  'Cormorant Garamond': { pkg: '@fontsource-variable/cormorant-garamond@5', files: ['index'], variable: true },
  'Outfit': { pkg: '@fontsource-variable/outfit@5', files: ['index'], variable: true },
  'Barlow Condensed': { pkg: '@fontsource/barlow-condensed@5', files: ['500', '600'] },
  'JetBrains Mono': { pkg: '@fontsource-variable/jetbrains-mono@5', files: ['index'], variable: true },
  'LXGW WenKai Screen': { pkg: 'lxgw-wenkai-screen-webfont@1', files: ['lxgwwenkaiscreen'] },
};

// 皮肤 → 字体（与 styles.js 各皮肤段的 font-family 对应）
const SKIN_FONTS = [
  { skins: ['none'], fonts: ['Outfit', 'Noto Sans SC'] },
  { skins: [DEFAULT_DARK_SKIN_ID], fonts: ['Barlow Condensed', 'Noto Sans SC'] },
  { skins: [DEFAULT_SOFT_SKIN_ID], fonts: ['LXGW WenKai Screen', 'Noto Sans SC'] },
  { skins: [CYBERPOP_SKIN_ID, CYBERPOP_DARK_SKIN_ID], fonts: ['Barlow', 'Noto Sans SC'] },
  { skins: ANCIENT_FAMILY_SKIN_IDS, fonts: ['Noto Serif SC', 'Ma Shan Zheng'] },
  { skins: PERSONA_FAMILY_SKIN_IDS, fonts: ['Anton', 'Archivo Black', 'Noto Sans SC'] },
  { skins: JRPG_FAMILY_SKIN_IDS, fonts: ['Zen Old Mincho', 'Noto Serif SC'] },
  { skins: YANYUN_FAMILY_SKIN_IDS, fonts: ['Noto Serif SC', 'Zhi Mang Xing', 'Liu Jian Mao Cao'] },
  { skins: ['skin-classic'], fonts: ['Shippori Mincho', 'Zen Kaku Gothic New', 'Italiana', 'Cormorant Garamond', 'Noto Serif SC'] },
  { skins: SHUJIAN_FAMILY_SKIN_IDS, fonts: ['Noto Serif SC', 'Cormorant Garamond'] },
];

// 设置项「对话字体」→ 字体（kaiti 为系统楷体，无需加载）
const DIALOG_FONTS = {
  sans: ['Noto Sans SC'],
  serif: ['Noto Serif SC'],
  wenkai: ['LXGW WenKai Screen'],
  mono: ['JetBrains Mono'],
};

// 情境样式舞台（九种文书）用到的字体，舞台首次出现时再加载
export const STYLED_STAGE_FONTS = ['LXGW WenKai Screen', 'Noto Serif SC', 'JetBrains Mono'];

// 注入的字体 <style> 以固定 id 挂在酒馆主页面，脚本卸载时不移除：热重载后新实例按 id 直接复用，
// 移除反而会让文字闪回系统字体；它们只是 @font-face 声明，未用到的分片不会下载
const loadedFamilies = new Map(); // family -> Promise<boolean>
// 失败冷却：离线 / 局域网无外网时，applySettingsToUI 频繁调用不应每次都重发请求刷警告
const FAILURE_COOLDOWN_MS = 10 * 60 * 1000;
const failedAt = new Map(); // family -> timestamp

function isWebFontsEnabled() {
  return getSettings()?.webFontsEnabled !== false;
}

function toStyleId(family) {
  return `${SCRIPT_ID}-font-${family.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function rewriteFontCss(css, baseUrl, source) {
  let out = css.replace(/url\(\s*(['"]?)\.\/([^'")]+)\1\s*\)/g, (_m, _q, path) => `url("${baseUrl}${path}")`);
  if (source.variable) {
    out = out.replace(/font-family:\s*(['"])(.+?) Variable\1/g, (_m, q, name) => `font-family: ${q}${name}${q}`);
  }
  return out;
}

async function fetchFontCss(source, file) {
  for (const host of CDN_HOSTS) {
    const baseUrl = `${host}/npm/${source.pkg}/`;
    try {
      const res = await topWindow.fetch(`${baseUrl}${file}.css`, { cache: 'force-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return rewriteFontCss(await res.text(), baseUrl, source);
    } catch (error) {
      console.warn(`[${SCRIPT_NAME}] 字体 CSS 获取失败（${host}）: ${source.pkg}/${file}`, error?.message || error);
    }
  }
  return '';
}

async function loadFamily(family) {
  const source = FONT_SOURCES[family];
  if (!source) return false;
  const doc = topWindow.document;
  const styleId = toStyleId(family);
  if (doc.getElementById(styleId)) return true;

  const parts = await Promise.all(source.files.map(file => fetchFontCss(source, file)));
  const css = parts.filter(Boolean).join('\n');
  if (!css) return false;
  if (doc.getElementById(styleId)) return true;
  const styleEl = doc.createElement('style');
  styleEl.id = styleId;
  styleEl.textContent = css;
  (doc.head || doc.documentElement).appendChild(styleEl);
  return true;
}

export function ensureWebFonts(families) {
  if (!isWebFontsEnabled()) return Promise.resolve(false);
  const list = Array.from(new Set((Array.isArray(families) ? families : [families]).filter(Boolean)));
  const now = Date.now();
  return Promise.all(list.map(family => {
    if (!loadedFamilies.has(family)) {
      if (now - (failedAt.get(family) || 0) < FAILURE_COOLDOWN_MS) return Promise.resolve(false);
      const onFail = () => {
        // 失败不缓存结果，冷却期过后切皮肤/改设置时再重试
        loadedFamilies.delete(family);
        failedAt.set(family, Date.now());
        return false;
      };
      const task = loadFamily(family).then(ok => (ok ? true : onFail())).catch(onFail);
      loadedFamilies.set(family, task);
    }
    return loadedFamilies.get(family);
  })).then(results => results.every(Boolean));
}

export function getFontsForSkin(skin) {
  const normalized = String(skin || 'none').trim() || 'none';
  const matched = SKIN_FONTS.find(entry => entry.skins.includes(normalized));
  return matched ? matched.fonts.slice() : [];
}

// 按当前设置同步：皮肤字体 + 对话字体。已加载的字体不卸载（仅 @font-face 声明，未使用的分片不会下载）
export function syncWebFontsForSettings(settings = getSettings()) {
  if (!settings || settings.webFontsEnabled === false) return Promise.resolve(false);
  const families = [
    ...getFontsForSkin(settings.skin),
    ...(DIALOG_FONTS[String(settings.dialogFontFamily || 'sans').toLowerCase()] || []),
  ];
  return ensureWebFonts(families);
}
