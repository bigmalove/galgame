export const CUSTOM_SKIN_FOOTER_BUTTON_DISPLAY_MODES = {
  TOOLBAR: 'toolbar',
  MENU: 'menu',
};

export const CUSTOM_SKIN_FOOTER_BUTTONS = [
  {
    elementId: 'footer_btn_log',
    action: 'log',
    shortLabel: 'LOG',
    menuLabel: '历史',
    iconClass: 'fa-solid fa-list-ul',
  },
  {
    elementId: 'footer_btn_close',
    action: 'close-mode',
    shortLabel: 'CLOSE',
    menuLabel: '退出',
    iconClass: 'fa-solid fa-power-off',
  },
  {
    elementId: 'footer_btn_view',
    action: 'view-original',
    shortLabel: 'VIEW',
    menuLabel: '原界面',
    iconClass: 'fa-solid fa-display',
  },
  {
    elementId: 'footer_btn_config',
    action: 'config',
    shortLabel: 'CONFIG',
    menuLabel: '设置',
    iconClass: 'fa-solid fa-gear',
  },
  {
    elementId: 'footer_btn_save',
    action: 'save',
    shortLabel: 'SAVE',
    menuLabel: '存档',
    iconClass: 'fa-solid fa-floppy-disk',
  },
  {
    elementId: 'footer_btn_load',
    action: 'load',
    shortLabel: 'LOAD',
    menuLabel: '读档',
    iconClass: 'fa-solid fa-folder-open',
  },
  {
    elementId: 'footer_btn_timeline',
    action: 'timeline',
    shortLabel: 'TL',
    menuLabel: '时间线',
    iconClass: 'fa-solid fa-diagram-project',
  },
  {
    elementId: 'footer_btn_prev',
    action: 'prev',
    shortLabel: 'PREV',
    menuLabel: '上一段',
    iconClass: 'fa-solid fa-chevron-left',
  },
  {
    elementId: 'footer_btn_auto',
    action: 'auto',
    shortLabel: 'AUTO',
    menuLabel: '自动播放',
    iconClass: 'fa-solid fa-play',
  },
  {
    elementId: 'footer_btn_skip',
    action: 'skip',
    shortLabel: 'SKIP',
    menuLabel: '快进',
    iconClass: 'fa-solid fa-forward',
  },
  {
    elementId: 'footer_btn_choices',
    action: 'show-choices',
    shortLabel: '剧情选项',
    menuLabel: '剧情选项',
    iconClass: 'fa-solid fa-list-check',
  },
  {
    elementId: 'footer_btn_next',
    action: 'next',
    shortLabel: 'NEXT',
    menuLabel: '下一段',
    iconClass: 'fa-solid fa-chevron-right',
  },
];

export const CUSTOM_SKIN_FOOTER_BUTTON_ELEMENT_IDS = CUSTOM_SKIN_FOOTER_BUTTONS.map(item => item.elementId);
export const CUSTOM_SKIN_FOOTER_BUTTON_ACTIONS = CUSTOM_SKIN_FOOTER_BUTTONS.map(item => item.action);
export const DEFAULT_GAL_MOBILE_MENU_ACTIONS = ['open-settings', 'log', 'view-original', 'save', 'load', 'timeline'];
export const CUSTOM_SKIN_FOOTER_FIXED_TOOLBAR_ELEMENT_IDS = ['footer_btn_config', 'footer_btn_choices', 'footer_btn_next'];
export const CUSTOM_SKIN_FOOTER_DISPLAY_SETTING_BUTTONS = CUSTOM_SKIN_FOOTER_BUTTONS.filter(
  item => !['footer_btn_choices', 'footer_btn_next'].includes(item.elementId),
);

const FOOTER_BUTTON_BY_ELEMENT_ID = new Map(CUSTOM_SKIN_FOOTER_BUTTONS.map(item => [item.elementId, item]));
const FOOTER_BUTTON_BY_ACTION = new Map(CUSTOM_SKIN_FOOTER_BUTTONS.map(item => [item.action, item]));
const MOBILE_MENU_ACTION_META = new Map([
  [
    'open-settings',
    {
      action: 'open-settings',
      menuLabel: '设置',
      iconClass: 'fa-solid fa-gear',
    },
  ],
  ...CUSTOM_SKIN_FOOTER_BUTTONS.map(item => [
    item.action,
    {
      action: item.action,
      menuLabel: item.menuLabel,
      iconClass: item.iconClass,
    },
  ]),
]);

export const DEFAULT_CUSTOM_SKIN_FOOTER_BUTTON_DISPLAY = Object.freeze(
  CUSTOM_SKIN_FOOTER_BUTTON_ELEMENT_IDS.reduce((result, elementId) => {
    result[elementId] = CUSTOM_SKIN_FOOTER_BUTTON_DISPLAY_MODES.TOOLBAR;
    return result;
  }, {
    footer_btn_config: CUSTOM_SKIN_FOOTER_BUTTON_DISPLAY_MODES.TOOLBAR,
  }),
);

export function getCustomSkinFooterButtonByElementId(elementId) {
  return FOOTER_BUTTON_BY_ELEMENT_ID.get(String(elementId || '').trim()) || null;
}

export function getCustomSkinFooterButtonByAction(action) {
  return FOOTER_BUTTON_BY_ACTION.get(String(action || '').trim()) || null;
}

export function normalizeCustomSkinFooterButtonDisplay(rawValue = null) {
  const safeValue = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)
    ? rawValue
    : {};
  const normalized = {};
  CUSTOM_SKIN_FOOTER_BUTTON_ELEMENT_IDS.forEach(elementId => {
    const rawMode = String(safeValue[elementId] || '').trim().toLowerCase();
    normalized[elementId] = rawMode === CUSTOM_SKIN_FOOTER_BUTTON_DISPLAY_MODES.MENU
      ? CUSTOM_SKIN_FOOTER_BUTTON_DISPLAY_MODES.MENU
      : CUSTOM_SKIN_FOOTER_BUTTON_DISPLAY_MODES.TOOLBAR;
  });
  CUSTOM_SKIN_FOOTER_FIXED_TOOLBAR_ELEMENT_IDS.forEach(elementId => {
    normalized[elementId] = CUSTOM_SKIN_FOOTER_BUTTON_DISPLAY_MODES.TOOLBAR;
  });
  return normalized;
}

export function hasCustomSkinFooterMenuItems(rawValue = null) {
  const normalized = normalizeCustomSkinFooterButtonDisplay(rawValue);
  return CUSTOM_SKIN_FOOTER_BUTTON_ELEMENT_IDS.some(
    elementId => !CUSTOM_SKIN_FOOTER_FIXED_TOOLBAR_ELEMENT_IDS.includes(elementId)
      && normalized[elementId] === CUSTOM_SKIN_FOOTER_BUTTON_DISPLAY_MODES.MENU,
  );
}

export function getCustomSkinFooterMenuActions(rawValue = null) {
  const normalized = normalizeCustomSkinFooterButtonDisplay(rawValue);
  return CUSTOM_SKIN_FOOTER_BUTTONS
    .filter(item => !CUSTOM_SKIN_FOOTER_FIXED_TOOLBAR_ELEMENT_IDS.includes(item.elementId)
      && normalized[item.elementId] === CUSTOM_SKIN_FOOTER_BUTTON_DISPLAY_MODES.MENU)
    .map(item => item.action);
}

export function buildGalMobileMenuButtonsHtml(actions = DEFAULT_GAL_MOBILE_MENU_ACTIONS) {
  const safeActions = Array.from(new Set(
    (Array.isArray(actions) ? actions : [])
      .map(action => String(action || '').trim())
      .filter(action => MOBILE_MENU_ACTION_META.has(action)),
  ));
  return safeActions
    .map(action => {
      const meta = MOBILE_MENU_ACTION_META.get(action);
      return `
          <button class="gal-menu-btn" data-action="${meta.action}">
              <i class="${meta.iconClass}"></i> ${meta.menuLabel}
          </button>
        `;
    })
    .join('');
}
