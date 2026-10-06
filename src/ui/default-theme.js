import { CYBERPOP_DARK_SKIN_ID, CYBERPOP_SKIN_ID, DEFAULT_DARK_SKIN_ID, DEFAULT_SOFT_SKIN_ID, DEFAULT_THEME_CLASS } from '../core/constants.js';

// ============================================
// 默认皮肤家族（晴空 / 夜航 / 柔光）与经典 Cyber Pop 的挂类
// ============================================
// 默认家族外观在 数据库界面插件.css「默认皮肤家族」段，作用域 .gal-theme-default + 款式类；
// 经典 Cyber Pop 就是基线样式本身（不挂任何主题类时的样子），深色版复用基线里 .skin-default-dark 的 token 与覆写。
// 这些皮肤的值大多不直接作为类名挂到 overlay：类名含 "skin-" 会命中 styles.js 的「非默认皮肤」通用重置。
// 控件动效对所有皮肤通用，见 control-motion.js。

export const CYBERPOP_CLASS = 'gal-theme-cyberpop';

export const DEFAULT_THEME_VARIANTS = {
  none: 'gal-theme-sky',
  [DEFAULT_DARK_SKIN_ID]: 'gal-theme-night',
  [DEFAULT_SOFT_SKIN_ID]: 'gal-theme-soft',
};

// 皮肤值 → overlay 上应挂的类（夜航的 skin-default-dark 由皮肤值本身挂上，这里不重复）
const THEME_SKIN_CLASSES = {
  none: [DEFAULT_THEME_CLASS, DEFAULT_THEME_VARIANTS.none],
  [DEFAULT_DARK_SKIN_ID]: [DEFAULT_THEME_CLASS, DEFAULT_THEME_VARIANTS[DEFAULT_DARK_SKIN_ID]],
  [DEFAULT_SOFT_SKIN_ID]: [DEFAULT_THEME_CLASS, DEFAULT_THEME_VARIANTS[DEFAULT_SOFT_SKIN_ID]],
  [CYBERPOP_SKIN_ID]: [CYBERPOP_CLASS],
  [CYBERPOP_DARK_SKIN_ID]: [CYBERPOP_CLASS, DEFAULT_DARK_SKIN_ID],
};

// 皮肤值不作为类名挂到 overlay 的皮肤
const CLASSLESS_SKINS = new Set(['none', DEFAULT_SOFT_SKIN_ID, CYBERPOP_SKIN_ID, CYBERPOP_DARK_SKIN_ID]);

// 由本模块管理、需同步到选项层 / 历史弹窗的类（skin-default-dark 已在各处的皮肤类列表里）
export const DEFAULT_THEME_CLASSES = [DEFAULT_THEME_CLASS, ...Object.values(DEFAULT_THEME_VARIANTS), CYBERPOP_CLASS];

export function isThemeManagedSkin(skin) {
  return Object.prototype.hasOwnProperty.call(THEME_SKIN_CLASSES, String(skin || 'none').trim() || 'none');
}

export function isClasslessSkin(skin) {
  return CLASSLESS_SKINS.has(String(skin || 'none').trim() || 'none');
}

/**
 * 皮肤值 → 应挂的主题类（不由本模块管理的皮肤返回空数组）。
 * @param {string} skin 已归一化的皮肤值；HTML 皮肤、其他内置皮肤传入时返回 []
 */
export function getDefaultThemeClasses(skin) {
  return (THEME_SKIN_CLASSES[String(skin || 'none').trim() || 'none'] || []).slice();
}

// 调用前各处已移除全部皮肤类（含 skin-default-dark），这里切换主题类并补挂列表里的其余类
export function syncDefaultThemeClasses($el, classes) {
  if (!$el?.length) return;
  DEFAULT_THEME_CLASSES.forEach(cls => $el.toggleClass(cls, classes.includes(cls)));
  classes.filter(cls => !DEFAULT_THEME_CLASSES.includes(cls)).forEach(cls => $el.addClass(cls));
}
