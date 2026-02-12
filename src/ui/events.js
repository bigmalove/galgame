import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow, $ } from '../core/env.js';
import { GalgameStore } from '../core/store.js';
import { getSettings, setCurrentCharEnabled } from '../core/settings.js';
import { getIsEnabled, setIsEnabled, getIsRewinding, REWIND_HOLD_DELAY, getPendingOptions } from '../core/state.js';
import { decodeHtml, getRawMessageContent, getFormattedSwipeContent } from '../utils/html.js';
import { TTSManager } from '../audio/tts-manager.js';
import { parseGalgameContent } from '../logic/parser.js';
import { disableWorldbookGlobally, injectCOTToWorldbook, enableWorldbookGlobally } from '../logic/worldbook.js';
import { toggleFullscreen } from './fullscreen.js';
import { getModalMountRoot } from './fullscreen.js';
import { getHistoryFromDatabase, showHistoryModal } from './history.js';
import { showToast } from './toast.js';
import { showCustomPopupPanel } from './modal.js';
import { ensureGlobalOverlay, showGlobalOverlay, scheduleOverlaySegmentDisplay } from './overlay.js';
import { detectAndCaptureCg } from './overlay-content.js';
import { showFreeInputModal, triggerReroll, startSkipping, stopSkipping, startRewinding, stopRewinding, triggerPrevSegment, clearRewindHoldTimer, setRewindHoldTimer } from './interaction.js';
import { renderGalgameChoices } from './choices.js';
import { updateButtonState } from './menu-button.js';
import { restoreOriginalViews, hideNonLastFloors } from './galgame-mode.js';

// ============================================
// 全局事件监听器 (委托模式)
// ============================================

const messageSegmentState = GalgameStore.cache.segments;

const CUSTOM_LOCATION_HTML_KEY = 'gal_custom_location_html';
const CUSTOM_TIME_HTML_KEY = 'gal_custom_time_html';

// 延迟引用
let _showSettingsPanelRef = null;
let _showSpriteUploadDialogRef = null;
let _updateGlobalOverlayContentRef = null;

export function setEventsRefs({ showSettingsPanel, showSpriteUploadDialog, updateGlobalOverlayContent }) {
  if (showSettingsPanel) _showSettingsPanelRef = showSettingsPanel;
  if (showSpriteUploadDialog) _showSpriteUploadDialogRef = showSpriteUploadDialog;
  if (updateGlobalOverlayContent) _updateGlobalOverlayContentRef = updateGlobalOverlayContent;
}

export function setupGlobalEventListeners() {
  console.log(`[${SCRIPT_NAME}] 设置全局事件委托...`);
  const doc = topWindow.document;
  const settings = getSettings();

  // 地点/时间状态栏点击
  $(doc).on('click', '#gal-location-bar', function (e) {
    e.stopPropagation();
    const customHtml = localStorage.getItem(CUSTOM_LOCATION_HTML_KEY);
    if (customHtml) showCustomPopupPanel('地点详情', customHtml);
  });

  $(doc).on('click', '#gal-time-bar', function (e) {
    e.stopPropagation();
    const customHtml = localStorage.getItem(CUSTOM_TIME_HTML_KEY);
    if (customHtml) showCustomPopupPanel('时间详情', customHtml);
  });

  // PREV按钮长按快退
  $(doc).on('mousedown touchstart', '#gal-global-overlay [data-action="prev"]', function (e) {
    e.stopPropagation();
    e.preventDefault();
    setRewindHoldTimer(setTimeout(() => {
      startRewinding();
    }, REWIND_HOLD_DELAY));
  });

  $(doc).on('mouseup touchend', '#gal-global-overlay [data-action="prev"]', function (e) {
    e.stopPropagation();
    e.preventDefault();
    clearRewindHoldTimer();
    if (getIsRewinding()) {
      stopRewinding();
    } else {
      triggerPrevSegment();
    }
  });

  $(doc).on('mouseleave', '#gal-global-overlay [data-action="prev"]', function (e) {
    e.stopPropagation();
    e.preventDefault();
    clearRewindHoldTimer();
    if (getIsRewinding()) {
      stopRewinding();
    }
  });

  // 自由输入
  $(doc).on('click', '#gal-global-overlay [data-action="free-input"]', function (e) {
    e.stopPropagation();
    showFreeInputModal();
  });

  // 重新Roll
  $(doc).on('click', '#gal-global-overlay [data-action="reroll"]', function (e) {
    e.stopPropagation();
    triggerReroll();
  });

  // 退出 Galgame 模式
  $(doc).on('click', '#gal-global-overlay [data-action="close-mode"]', async function (e) {
    e.stopPropagation();
    setIsEnabled(false);
    setCurrentCharEnabled(false);
    updateButtonState();

    $('#gal-global-overlay [data-action="auto"]').each(function () {
      const timer = $(this).data('auto-timer');
      if (timer) clearInterval(timer);
    });

    await disableWorldbookGlobally();
    console.log(`[${SCRIPT_NAME}] Galgame模式关闭（已取消世界书全局启用）`);

    closeEmbeddedViewer();
    restoreOriginalViews();

    setTimeout(() => {
      const $lastMes = $('#chat > .mes').last();
      if ($lastMes.length) {
        $lastMes[0].scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, 150);

    showToast('Galgame 模式已关闭');
  });

  // 进入 Galgame 模式
  $(doc).on('click', '.gal-open-btn', async function (e) {
    console.log(`[${SCRIPT_NAME}] 点击【进入Galgame模式】按钮`);
    e.stopPropagation();
    const $btn = $(this);
    const $mes = $btn.closest('.mes');
    const mesId = $mes.attr('mesid');
    if (!mesId) return;

    setIsEnabled(true);
    setCurrentCharEnabled(true);
    updateButtonState();
    showToast('正在开启 Galgame 模式...');

    try {
      await injectCOTToWorldbook();
      await enableWorldbookGlobally();
      console.log(`[${SCRIPT_NAME}] Galgame模式开启（已全局启用世界书）`);
    } catch (err) {
      console.error('Galgame模式开启出错:', err);
    }

    let contentToProcess = getFormattedSwipeContent(mesId);
    if (!contentToProcess) {
      contentToProcess = getRawMessageContent(mesId);
    }
    if (!contentToProcess) {
      const $mesText = $mes.find('.mes_text');
      contentToProcess = decodeHtml($mesText.html());
    }

    if (contentToProcess) {
      const parsed = parseGalgameContent(contentToProcess);
      detectAndCaptureCg(mesId, $mes[0], parsed);
      if (parsed.segments.length > 0 && _updateGlobalOverlayContentRef) {
        await _updateGlobalOverlayContentRef(mesId, parsed);
        showGlobalOverlay();
        if (settings.hideOtherFloors) hideNonLastFloors();
        showToast('Galgame 模式已开启');
      }
    } else {
      if (settings.hideOtherFloors) hideNonLastFloors();
    }
  });

  // 快进按钮
  $(doc).on('mousedown touchstart', '#gal-global-overlay [data-action="skip"]', function (e) {
    e.stopPropagation();
    e.preventDefault();
    startSkipping();
  });
  $(doc).on('mouseup touchend mouseleave', '#gal-global-overlay [data-action="skip"]', function (e) {
    e.stopPropagation();
    e.preventDefault();
    stopSkipping();
  });

  // 全屏切换
  $(doc).on('click', '#gal-global-overlay [data-action="toggle-fullscreen"]', function (e) {
    e.stopPropagation();
    toggleFullscreen();
  });

  // 立绘显示/隐藏
  $(doc).on('click', '#gal-global-overlay .gal-sprite-toggle', function (e) {
    e.stopPropagation();
    const $btn = $(this);
    const $overlay = $('#gal-global-overlay');
    const $characterLayer = $overlay.find('.gal-layer-character');
    $btn.toggleClass('sprites-hidden');
    $characterLayer.toggleClass('sprites-hidden');
    if ($btn.hasClass('sprites-hidden')) {
      $btn.attr('title', '显示立绘');
      $btn.find('.gal-eye-icon').text('\u{1F648}');
    } else {
      $btn.attr('title', '隐藏立绘');
      $btn.find('.gal-eye-icon').text('\u{1F441}');
    }
  });

  // 移动端菜单辅助
  function closeMobileMenu() {
    $('#gal-mobile-menu').removeClass('active');
  }

  function isMobileMenuMode() {
    const $logBtn = $('#gal-global-overlay .gal-footer-btn[data-action="log"]');
    if ($logBtn.length) return !$logBtn.is(':visible');
    return !!(window.matchMedia && window.matchMedia('(max-width: 48rem)').matches);
  }

  // 设置按钮
  $(doc).on('click', '#gal-global-overlay [data-action="config"]', function (e) {
    e.stopPropagation();
    if (isMobileMenuMode()) {
      const $menu = $('#gal-mobile-menu');
      if (!$menu.hasClass('active')) {
        // 动态计算菜单位置：在 CONFIG 按钮上方显示
        const $overlay = $('#gal-global-overlay');
        const overlayRect = $overlay[0].getBoundingClientRect();
        const btnRect = this.getBoundingClientRect();
        $menu.css({
          bottom: (overlayRect.bottom - btnRect.top + 8) + 'px',
          left: (btnRect.left - overlayRect.left) + 'px'
        });
      }
      $menu.toggleClass('active');
      return;
    }
    closeMobileMenu();
    console.log(`[${SCRIPT_NAME}] 点击设置按钮`);
    showToast('正在打开设置...');
    if (_showSettingsPanelRef) _showSettingsPanelRef();
  });

  $(doc).on('click', '#gal-global-overlay [data-action="open-settings"]', function (e) {
    e.stopPropagation();
    closeMobileMenu();
    showToast('正在打开设置...');
    if (_showSettingsPanelRef) _showSettingsPanelRef();
  });

  $(doc).on('click', '#gal-mobile-menu .gal-menu-btn', function () {
    closeMobileMenu();
  });

  $(doc).on('click', function (e) {
    if (!$(e.target).closest('#gal-mobile-menu, [data-action="config"]').length) {
      closeMobileMenu();
    }
  });

  // 查看消息内嵌界面
  const GAL_TAG_NAMES = new Set(['p', 'background', 'bgm', 'option', 'maintext', 'bgimg', 'whimg', 'bnimg', 'sprite', 'br']);
  let embeddedViewerState = null; // { nodes: [{node, parent, nextSibling}], $viewer }

  function closeEmbeddedViewer() {
    if (!embeddedViewerState) return;
    // 把节点移回原位
    for (const entry of embeddedViewerState.nodes) {
      if (entry.nextSibling && entry.nextSibling.parentNode === entry.parent) {
        entry.parent.insertBefore(entry.node, entry.nextSibling);
      } else {
        entry.parent.appendChild(entry.node);
      }
    }
    embeddedViewerState.$viewer.remove();
    embeddedViewerState = null;
  }

  $(doc).on('click', '#gal-global-overlay [data-action="view-original"]', function (e) {
    e.stopPropagation();
    closeMobileMenu();

    if (embeddedViewerState) {
      closeEmbeddedViewer();
      return;
    }

    const mesId = $('#gal-global-overlay .gal-game-container').attr('data-mes-id');
    if (!mesId) {
      showToast('未找到当前消息');
      return;
    }

    const $mes = $(`.mes[mesid="${mesId}"]`);
    if (!$mes.length) {
      showToast('未找到消息元素');
      return;
    }

    const mesText = $mes.find('.mes_text')[0];
    if (!mesText) {
      showToast('未找到消息内容');
      return;
    }

    // 收集非 galgame 标签的 DOM 节点
    const embeddedNodes = [];
    for (const child of Array.from(mesText.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();
        if (!GAL_TAG_NAMES.has(tag)) {
          embeddedNodes.push(child);
        }
      }
    }

    if (embeddedNodes.length === 0) {
      showToast('当前消息没有嵌入的界面内容');
      return;
    }

    // 读取原始容器尺寸，确保百分比布局的子元素不会塌缩
    // 临时移除 gal-hidden class（因为 !important 无法被内联样式覆盖）
    const wasHidden = $mes.hasClass('gal-hidden');
    if (wasHidden) $mes.removeClass('gal-hidden');
    const origWidth = mesText.offsetWidth;
    const origHeight = mesText.offsetHeight;
    if (wasHidden) $mes.addClass('gal-hidden');

    // 创建弹窗
    const $viewer = $(`
      <div class="gal-embedded-viewer">
        <div class="gal-embedded-viewer-body"></div>
        <button class="gal-embedded-viewer-close"><i class="fa-solid fa-arrow-left"></i> 返回</button>
      </div>
    `);

    const body = $viewer.find('.gal-embedded-viewer-body')[0];
    // 用原始容器尺寸，防止百分比子元素塌缩
    if (origWidth > 0) {
      body.style.width = origWidth + 'px';
    }
    if (origHeight > 0) {
      body.style.height = Math.min(origHeight, topWindow.innerHeight * 0.9) + 'px';
    }

    // 记录原位置，reparent 到弹窗
    const nodeEntries = embeddedNodes.map(node => {
      const entry = { node, parent: node.parentNode, nextSibling: node.nextSibling };
      body.appendChild(node);
      return entry;
    });

    embeddedViewerState = { nodes: nodeEntries, $viewer };

    $(topWindow.document.body).append($viewer);

    // 关闭按钮
    $viewer.find('.gal-embedded-viewer-close').on('click', () => closeEmbeddedViewer());
    // 点击背景关闭
    $viewer.on('click', function (ev) {
      if (ev.target === $viewer[0]) closeEmbeddedViewer();
    });
  });

  // LOG按钮
  $(doc).on('click', '#gal-global-overlay [data-action="log"]', function (e) {
    e.stopPropagation();
    const history = getHistoryFromDatabase();
    showHistoryModal(history);
  });

  // 待选择选项按钮
  $(doc).on('click', '#gal-global-overlay [data-action="show-choices"]', function (e) {
    e.stopPropagation();
    const pending = getPendingOptions();
    if (pending && pending.length > 0) {
      renderGalgameChoices(pending);
    } else {
      showToast('当前没有待选择的选项');
    }
  });

  // NEXT按钮
  $(doc).on('click', '#gal-global-overlay [data-action="next"]', async function (e) {
    e.stopPropagation();
    const $overlay = $('#gal-global-overlay');
    const mesId = $overlay.find('.gal-game-container').attr('data-mes-id');
    const state = messageSegmentState.get(String(mesId));
    if (!state) return;
    const nextSegment = state.segments[state.currentIndex + 1];
    if (nextSegment) {
      TTSManager.stop();
      state.currentIndex++;
      await scheduleOverlaySegmentDisplay(state, 'next-click');
      if (nextSegment.type === 'dialogue' && settings.ttsEnabled) {
        const segmentId = `${mesId}_${state.currentIndex}`;
        TTSManager.speak(nextSegment, segmentId);
      }
    } else {
      showToast('已是最后一段');
    }
  });

  // PREV按钮: click 事件由 mouseup 处理器中的 triggerPrevSegment() 处理
  // 不再单独注册 click，避免 mouseup + click 双重触发导致退两段

  // AUTO按钮
  $(doc).on('click', '#gal-global-overlay [data-action="auto"]', function (e) {
    e.stopPropagation();
    const $btn = $(this);
    const $overlay = $('#gal-global-overlay');
    const mesId = $overlay.find('.gal-game-container').attr('data-mes-id');
    let timer = $btn.data('auto-timer');

    if (timer) {
      clearInterval(timer);
      $btn.data('auto-timer', null);
      $btn.html('<i class="fa-solid fa-play"></i> AUTO');
      $btn.removeClass('gal-auto-playing');
      TTSManager.stop();
    } else {
      $btn.html('<i class="fa-solid fa-pause"></i> STOP');
      $btn.addClass('gal-auto-playing');

      TTSManager.stop();
      const state = messageSegmentState.get(String(mesId));
      if (state && settings.ttsEnabled) {
        const currentSegment = state.segments[state.currentIndex];
        if (currentSegment && currentSegment.type === 'dialogue') {
          const segmentId = `${mesId}_${state.currentIndex}`;
          TTSManager.speak(currentSegment, segmentId);
        }
      }

      let autoTickInFlight = false;
      timer = setInterval(async () => {
        if (autoTickInFlight) return;
        autoTickInFlight = true;
        try {
          const state = messageSegmentState.get(String(mesId));
          if (!state) {
            clearInterval(timer);
            $btn.data('auto-timer', null);
            return;
          }
          const hasNext = !!state.segments[state.currentIndex + 1];
          if (hasNext) {
            TTSManager.stop();
            state.currentIndex++;
            await scheduleOverlaySegmentDisplay(state, 'auto-play');
            if (settings.ttsEnabled) {
              const currentSegment = state.segments[state.currentIndex];
              if (currentSegment && currentSegment.type === 'dialogue') {
                const segmentId = `${mesId}_${state.currentIndex}`;
                TTSManager.speak(currentSegment, segmentId);
              }
            }
          } else {
            clearInterval(timer);
            $btn.data('auto-timer', null);
            $btn.html('<i class="fa-solid fa-play"></i> AUTO');
            $btn.removeClass('gal-auto-playing');
            TTSManager.stop();
          }
        } finally {
          autoTickInFlight = false;
        }
      }, settings.autoPlaySpeed * 1000);
      $btn.data('auto-timer', timer);
    }
  });

  // 立绘占位符上传
  $(doc).on('click', '#gal-global-overlay .gal-char-placeholder', async function (e) {
    e.stopPropagation();
    const $container = $(this).closest('.gal-char-container');
    const character = $container.data('character') || 'default';
    const expression = $container.data('expression') || '默认';
    if (_showSpriteUploadDialogRef) await _showSpriteUploadDialogRef(character, expression);
  });

  // 点击 CG 缩略图查看大图
  $(doc).on('click', '#gal-global-overlay .gal-cg-thumbnail', function (e) {
    e.stopPropagation();
    const src = $(this).attr('src');
    if (!src) return;
    const $viewer = $('#gal-global-overlay .gal-cg-viewer');
    $viewer.find('.gal-cg-viewer-img').attr('src', src).show();
    $viewer.find('.gal-cg-viewer-loading').hide();
    $viewer.show();
  });

  // CG 查看器关闭
  $(doc).on('click', '#gal-global-overlay .gal-cg-viewer', function (e) {
    e.stopPropagation();
    $(this).hide();
  });

  // 双击立绘修改
  $(doc).on('dblclick', '#gal-global-overlay .gal-char-img', async function (e) {
    e.stopPropagation();
    const $container = $(this).closest('.gal-char-container');
    const character = $container.data('character') || 'default';
    const expression = $container.data('expression') || '默认';
    if (_showSpriteUploadDialogRef) await _showSpriteUploadDialogRef(character, expression);
  });
}
