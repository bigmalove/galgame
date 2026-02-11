import { SCRIPT_ID, SCRIPT_NAME, THEME } from '../core/constants.js';
import { $ } from '../core/env.js';
import { getIsEnabled } from '../core/state.js';

// ============================================
// 菜单按钮和消息按钮注入
// ============================================

// 延迟引用
let _showSettingsPanelRef = null;

export function setMenuButtonRefs({ showSettingsPanel }) {
  if (showSettingsPanel) _showSettingsPanelRef = showSettingsPanel;
}

export function injectGalgameButton(mesNode) {
  const $mes = $(mesNode);
  const mesId = $mes.attr('mesid');

  if ($mes.attr('is_user') === 'true') return;
  if ($mes.find('.gal-open-btn').length) return;

  console.log(`[${SCRIPT_NAME}] 正在给消息 ${mesId} 注入按钮`);

  const btnHtml = `
    <div class="gal-open-btn-container" style="display: flex; justify-content: center; width: 100%; margin-top: 10px; padding: 5px 0;">
      <div class="gal-open-btn" title="进入 Galgame 模式">
        <i class="fa-solid fa-gamepad"></i> 进入 Galgame 模式
      </div>
    </div>
  `;

  const $mesBlock = $mes.find('.mes_block');
  if ($mesBlock.length) {
    $mesBlock.append(btnHtml);
    console.log(`[${SCRIPT_NAME}] 消息 ${mesId} 按钮已注入到 mes_block`);
  } else {
    $mes.append(btnHtml);
    console.log(`[${SCRIPT_NAME}] 消息 ${mesId} 按钮已注入到 mes`);
  }
}

export function addMenuButton() {
  const $existingBtn = $(`#${SCRIPT_ID}-btn`);
  if ($existingBtn.length) $existingBtn.remove();

  const $btn = $(`
    <div id="${SCRIPT_ID}-btn" class="menu_button" title="${SCRIPT_NAME} 设置"
         style="border: 2px solid; box-shadow: 3px 3px 0 rgba(0,0,0,0.2);">
      <i class="fa-solid fa-gamepad"></i>
      <span>Galgame</span>
    </div>
  `);

  $btn.on('click', e => {
    e.stopPropagation();
    if (_showSettingsPanelRef) _showSettingsPanelRef();
  });

  if ($('#extensionsMenu').length) {
    $('#extensionsMenu').append($btn);
    console.log(`[${SCRIPT_NAME}] 按钮已添加到扩展菜单`);
  } else if ($('#top-bar').length) {
    $('#top-bar').append($btn);
    console.log(`[${SCRIPT_NAME}] 按钮已添加到顶部菜单`);
  }

  updateButtonState();
}

export function updateButtonState() {
  const $btn = $(`#${SCRIPT_ID}-btn`);
  if (getIsEnabled()) {
    $btn.css('background', THEME.accent);
    $btn.css('color', THEME.dark);
  } else {
    $btn.css('background', '');
    $btn.css('color', '');
  }
}
