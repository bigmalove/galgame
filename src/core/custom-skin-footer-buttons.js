// 底栏按钮元数据（供移动端上拉菜单渲染使用）
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

export const DEFAULT_GAL_MOBILE_MENU_ACTIONS = ['open-settings', 'log', 'view-original', 'save', 'load', 'timeline'];

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
