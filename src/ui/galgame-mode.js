import { SCRIPT_NAME } from '../core/constants.js';
import { $ } from '../core/env.js';
import { clearAllPixiEffects, preloadPixiEffectsRuntime } from '../effects/pixi-effect-manager.js';
import { hideGlobalOverlay } from './overlay.js';

// ============================================
// Galgame 模式切换
// ============================================

// 延迟引用
let _processNewMessageRef = null;
let _applySettingsToUIRef = null;

export function setGalgameModeRefs({ processNewMessage, applySettingsToUI }) {
  if (processNewMessage) _processNewMessageRef = processNewMessage;
  if (applySettingsToUI) _applySettingsToUIRef = applySettingsToUI;
}

export function applyGalgameMode() {
  void preloadPixiEffectsRuntime();

  const $allMes = $('#chat > .mes');
  let $lastAiMes = null;
  $allMes.each(function () {
    if ($(this).attr('is_user') !== 'true') {
      $lastAiMes = $(this);
    }
  });

  console.log(`[${SCRIPT_NAME}] applyGalgameMode: 找到最后AI消息=${$lastAiMes ? '是' : '否'}`);

  if ($lastAiMes && $lastAiMes.length && _processNewMessageRef) {
    _processNewMessageRef($lastAiMes[0], { forceRender: true });
  }

  showAllFloors();

  if (_applySettingsToUIRef) {
    _applySettingsToUIRef();
  }
}

export function restoreOriginalViews() {
  clearAllPixiEffects();
  hideGlobalOverlay();

  $('.gal-game-container')
    .not('#gal-global-overlay .gal-game-container')
    .each(function () {
      const mesId = $(this).attr('data-mes-id') || $(this).data('mes-id');
      if (mesId) {
        const $mes = $(`.mes[mesid="${mesId}"]`);
        const $mesText = $mes.find('.mes_text');
        $mesText.show();
        $mes.removeClass('gal-hidden');
      }
      $(this).remove();
    });

  $('.mes_text').show();
  showAllFloors();
}

export function hideNonLastFloors() {
  const $overlay = $('#gal-global-overlay');
  const isOverlayActive = $overlay.length > 0 && $overlay.hasClass('active');
  if (!isOverlayActive) {
    console.warn(`[${SCRIPT_NAME}] 覆盖层未激活，跳过隐藏消息楼层`);
    showAllFloors();
    return false;
  }

  const $allMes = $('#chat > .mes');
  $allMes.each(function () {
    $(this).addClass('gal-hidden');
  });
  console.log(`[${SCRIPT_NAME}] 已隐藏 ${$allMes.length} 个消息楼层`);
  return true;
}

export function showAllFloors() {
  const $allMes = $('#chat > .mes');
  $allMes.each(function () {
    $(this).removeClass('gal-hidden');
    $(this).css('display', '');
  });
  console.log(`[${SCRIPT_NAME}] 已显示所有消息楼层，共 ${$allMes.length} 个`);
}

export function refreshGalgameViews() {
  if (_processNewMessageRef) {
    const $allMes = $('#chat > .mes');
    let $lastAiMes = null;
    $allMes.each(function () {
      if ($(this).attr('is_user') !== 'true') {
        $lastAiMes = $(this);
      }
    });
    if ($lastAiMes && $lastAiMes.length) {
      _processNewMessageRef($lastAiMes[0]);
    }
  }
}
