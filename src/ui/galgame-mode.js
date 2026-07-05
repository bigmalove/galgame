import { SCRIPT_NAME } from '../core/constants.js';
import { $, topWindow } from '../core/env.js';
import { clearAllPixiEffects, preloadPixiEffectsRuntime } from '../effects/pixi-effect-manager.js';
import { hideGlobalOverlay } from './overlay.js';
import { cancelTypewriter } from './typewriter.js';

// ============================================
// 酒馆「自动滚动聊天」联动
// ============================================
// 生成时 ST 的自动滚动会把 overlay 滚出视野；Galgame 模式期间自动关闭该设置，退出时恢复原值。
// 原值存 localStorage，跨刷新也能正确恢复（模式开着刷新页面时不会把「已被我们关掉的 false」当成用户原值）。

const AUTO_SCROLL_SNAPSHOT_KEY = 'gal_auto_scroll_snapshot';

function setTavernAutoScroll(enabled) {
  const $checkbox = $(topWindow.document).find('#auto_scroll_chat_to_bottom');
  if (!$checkbox.length) return false;
  if (!!$checkbox.prop('checked') !== enabled) {
    // trigger('input') 让 ST 自己更新 power_user 并持久化
    $checkbox.prop('checked', enabled).trigger('input');
  }
  return true;
}

export function disableTavernAutoScroll() {
  try {
    const $checkbox = $(topWindow.document).find('#auto_scroll_chat_to_bottom');
    if (!$checkbox.length) return;
    if (topWindow.localStorage.getItem(AUTO_SCROLL_SNAPSHOT_KEY) === null) {
      topWindow.localStorage.setItem(AUTO_SCROLL_SNAPSHOT_KEY, $checkbox.prop('checked') ? '1' : '0');
    }
    if (setTavernAutoScroll(false)) {
      console.log(`[${SCRIPT_NAME}] 已自动关闭酒馆「自动滚动聊天」`);
    }
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 关闭酒馆自动滚动失败`, e);
  }
}

export function restoreTavernAutoScroll() {
  try {
    const snapshot = topWindow.localStorage.getItem(AUTO_SCROLL_SNAPSHOT_KEY);
    if (snapshot === null) return;
    topWindow.localStorage.removeItem(AUTO_SCROLL_SNAPSHOT_KEY);
    if (setTavernAutoScroll(snapshot === '1')) {
      console.log(`[${SCRIPT_NAME}] 已恢复酒馆「自动滚动聊天」为原设置（${snapshot === '1' ? '开' : '关'}）`);
    }
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 恢复酒馆自动滚动失败`, e);
  }
}

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

export async function applyGalgameMode() {
  void preloadPixiEffectsRuntime();
  disableTavernAutoScroll();

  // 等待消息楼层渲染到 DOM 中（SillyTavern 可能尚未完成渲染）
  let $lastAiMes = null;
  const MAX_RETRIES = 5;
  const RETRY_DELAY_MS = 300;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const $allMes = $('#chat > .mes');
    $lastAiMes = null;
    $allMes.each(function () {
      if ($(this).attr('is_user') !== 'true') {
        $lastAiMes = $(this);
      }
    });

    if ($lastAiMes && $lastAiMes.length) {
      break;
    }

    if (attempt < MAX_RETRIES) {
      console.log(`[${SCRIPT_NAME}] applyGalgameMode: 未找到AI消息，等待 ${RETRY_DELAY_MS}ms 后重试 (${attempt + 1}/${MAX_RETRIES})`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  console.log(`[${SCRIPT_NAME}] applyGalgameMode: 找到最后AI消息=${$lastAiMes ? '是' : '否'}`);

  if ($lastAiMes && $lastAiMes.length && _processNewMessageRef) {
    // 等待 processNewMessage 完成（内部包含 async 的 overlay 更新）
    await _processNewMessageRef($lastAiMes[0], { forceRender: true });
  }

  showAllFloors();

  if (_applySettingsToUIRef) {
    _applySettingsToUIRef();
  }

  // 返回是否成功找到并渲染了 AI 消息
  return !!($lastAiMes && $lastAiMes.length);
}

export function restoreOriginalViews() {
  cancelTypewriter();
  clearAllPixiEffects();
  hideGlobalOverlay();
  restoreTavernAutoScroll();

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
