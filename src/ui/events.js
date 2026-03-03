import { TTSManager } from '../audio/tts-manager.js';
import { SCRIPT_NAME } from '../core/constants.js';
import { $, topWindow } from '../core/env.js';
import { getMapSettings, getSettings, setCurrentCharEnabled } from '../core/settings.js';
import { getIsRewinding, getPendingOptions, REWIND_HOLD_DELAY, setIsEnabled } from '../core/state.js';
import { GalgameStore } from '../core/store.js';
import { clearAllPixiEffects } from '../effects/pixi-effect-manager.js';
import { parseGalgameContent } from '../logic/parser.js';
import { clearSpecialCgOverlayAndQueue } from '../logic/special-cg-trigger.js';
import { disableWorldbookGlobally, injectCOTToWorldbook } from '../logic/worldbook.js';
import { decodeHtml, getFormattedSwipeContent, getRawMessageContent } from '../utils/html.js';
import { renderGalgameChoices } from './choices.js';
import { toggleFullscreen } from './fullscreen.js';
import { hideNonLastFloors, restoreOriginalViews } from './galgame-mode.js';
import { getHistoryFromDatabase, showHistoryModal } from './history.js';
import {
  clearRewindHoldTimer,
  setRewindHoldTimer,
  showFreeInputModal,
  startRewinding,
  startSkipping,
  stopRewinding,
  stopSkipping,
  switchToNextAiFloor,
  triggerPrevSegment,
  triggerReroll,
} from './interaction.js';
import { updateButtonState } from './menu-button.js';
import { showCustomPopupPanel } from './modal.js';
import { detectAndCaptureCg } from './overlay-content.js';
import { scheduleOverlaySegmentDisplay, showGlobalOverlay } from './overlay.js';
import { showSaveLoadModal } from './save-load-modal.js';
import { showToast } from './toast.js';
import { maybeShowTitleScreen, resetTitleScreenSession } from './title-screen.js';
import { finishActiveTypewriter, isTypewriterActive } from './typewriter.js';
import { showMapModal } from '../map/map-modal.js';

// ============================================
// 全局事件监听器 (委托模式)
// ============================================

const messageSegmentState = GalgameStore.cache.segments;

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

  function normalizeStatusPopupHtml(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    return trimmed ? trimmed : '';
  }

  function getCurrentParsedContent() {
    const mesId = $('#gal-global-overlay .gal-game-container').attr('data-mes-id');
    if (!mesId) return null;
    return messageSegmentState.get(String(mesId))?.parsedContent || null;
  }

  function getLocationPopupHtml() {
    const parsed = getCurrentParsedContent();
    const fromTag = normalizeStatusPopupHtml(parsed?.locationStatusBarHtml);
    return fromTag;
  }

  function getTimePopupHtml() {
    const parsed = getCurrentParsedContent();
    const fromTag = normalizeStatusPopupHtml(parsed?.timeStatusBarHtml);
    return fromTag;
  }

  async function triggerNextSegmentFromOverlay() {
    if (isTypewriterActive()) {
      finishActiveTypewriter();
      return;
    }

    const $overlay = $('#gal-global-overlay');
    const mesId = $overlay.find('.gal-game-container').attr('data-mes-id');
    const state = messageSegmentState.get(String(mesId));
    if (!state) return;

    const nextSegment = state.segments[state.currentIndex + 1];
    if (nextSegment) {
      const nextSpeakText = String(nextSegment.ttsText ?? nextSegment.text ?? '').trim();
      const nextWillSpeak = nextSegment.type === 'dialogue' && settings.ttsEnabled && nextSpeakText.length > 0;

      if (nextWillSpeak) {
        TTSManager.stop();
      }
      state.currentIndex++;
      await scheduleOverlaySegmentDisplay(state, 'next-click');
      if (nextWillSpeak) {
        const segmentId = `${mesId}_${state.currentIndex}`;
        TTSManager.speak(nextSegment, segmentId);
      }
      return;
    }

    const switched = await switchToNextAiFloor();
    if (switched.ok) return;

    showToast('已到最后AI楼层');
  }

  // 弹窗一图标：始终显示地点弹窗内容
  $(doc).on('click', '#gal-location-popup-trigger', function (e) {
    e.stopPropagation();
    const popupHtml = getLocationPopupHtml();
    if (popupHtml) {
      showCustomPopupPanel('', popupHtml);
      return;
    }
    showToast('未找到 <弹窗一> 标签内容');
  });

  // 地点栏：地图系统入口（保留失败回退到弹窗一）
  $(doc).on('click', '#gal-location-bar', async function (e) {
    e.stopPropagation();
    try {
      const mapSettings = getMapSettings();
      if (mapSettings.mapSystemEnabled && mapSettings.mapUseLocationBarClick) {
        await showMapModal();
        return;
      }
    } catch (mapError) {
      console.warn(`[${SCRIPT_NAME}] map modal open failed, fallback to location popup`, mapError);
    }
    const popupHtml = getLocationPopupHtml();
    if (popupHtml) {
      showCustomPopupPanel('', popupHtml);
      return;
    }
    showToast('未找到 <弹窗一> 标签内容');
  });

  $(doc).on('click', '#gal-time-popup-trigger', function (e) {
    e.stopPropagation();
    const popupHtml = getTimePopupHtml();
    if (popupHtml) {
      showCustomPopupPanel('', popupHtml);
      return;
    }
    showToast('未找到 <弹窗二> 标签内容');
  });

  // PREV按钮长按快退
  $(doc).on('mousedown touchstart', '#gal-global-overlay [data-action="prev"]', function (e) {
    e.stopPropagation();
    e.preventDefault();
    setRewindHoldTimer(
      setTimeout(() => {
        startRewinding();
      }, REWIND_HOLD_DELAY),
    );
  });

  $(doc).on('mouseup touchend', '#gal-global-overlay [data-action="prev"]', function (e) {
    e.stopPropagation();
    e.preventDefault();
    clearRewindHoldTimer();
    if (getIsRewinding()) {
      stopRewinding();
    } else {
      void triggerPrevSegment();
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

    clearAllPixiEffects();
    clearSpecialCgOverlayAndQueue();
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
      console.log(`[${SCRIPT_NAME}] Galgame模式开启（世界书按需附加）`);
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

    const buildFallbackParsed = () => {
      const fallbackText = String($mes.find('.mes_text').text() || '').trim() || '（当前消息无可显示内容）';
      return {
        segments: [{ type: 'narration', speaker: null, text: fallbackText, expression: null }],
        currentBackground: null,
        bgm: null,
        options: [],
        backgroundChanges: [],
        effectEvents: [],
        hasEffects: false,
        locationStatusBarHtml: null,
        timeStatusBarHtml: null,
      };
    };

    let parsed = null;
    if (contentToProcess) {
      parsed = parseGalgameContent(contentToProcess);
      detectAndCaptureCg(mesId, $mes[0], parsed);
    }

    if (!parsed || parsed.segments.length === 0) {
      console.warn(`[${SCRIPT_NAME}] 点击进入时未解析到可显示段落，使用纯文本兜底显示`);
      parsed = buildFallbackParsed();
    }

    if (!_updateGlobalOverlayContentRef) {
      console.warn(`[${SCRIPT_NAME}] updateGlobalOverlayContent 引用未注入，无法显示主界面`);
      showToast('主界面初始化失败，请刷新页面后重试');
      return;
    }

    await _updateGlobalOverlayContentRef(mesId, parsed);
    showGlobalOverlay();
    if (getSettings().hideOtherFloors) setTimeout(hideNonLastFloors, 80);
    resetTitleScreenSession();
    await maybeShowTitleScreen({ reason: 'chat-enter' });
    showToast('Galgame 模式已开启');
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
    const isNarrowViewport = !!(
      topWindow &&
      typeof topWindow.matchMedia === 'function' &&
      topWindow.matchMedia('(max-width: 768px)').matches
    );
    const $logBtn = $('#gal-global-overlay .gal-footer-btn[data-action="log"]');
    if (!$logBtn.length) return isNarrowViewport;
    return isNarrowViewport || !$logBtn.is(':visible');
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
          bottom: overlayRect.bottom - btnRect.top + 8 + 'px',
          left: btnRect.left - overlayRect.left + 'px',
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

  $(doc).on('click', '#gal-global-overlay [data-action="save"]', function (e) {
    e.stopPropagation();
    closeMobileMenu();
    showSaveLoadModal('save');
  });

  $(doc).on('click', '#gal-global-overlay [data-action="load"]', function (e) {
    e.stopPropagation();
    closeMobileMenu();
    showSaveLoadModal('load');
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
  const GAL_TAG_NAMES = new Set([
    'p',
    'background',
    'bgm',
    'option',
    'maintext',
    'bgimg',
    'whimg',
    'bnimg',
    'sprite',
    'br',
  ]);
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
    await triggerNextSegmentFromOverlay();
  });

  // Styled 显示时：点击空白区域等于 NEXT
  $(doc).on('click', '#gal-global-overlay', async function (e) {
    const $overlay = $('#gal-global-overlay');
    if (!$overlay.hasClass('gal-mode-styled')) return;

    const $target = $(e.target);
    if (
      $target.closest(
        '.gal-bottom-toolbar, .gal-interaction-bar, .gal-name-badge, .gal-location-bar, .gal-time-bar, .gal-status-bar-container, .gal-bgm-widget, .gal-fullscreen-btn',
      ).length
    ) return;
    if ($target.closest('.gal-styled-stage-content').length) return;
    if ($target.closest('.gal-choice-layer, .gal-popup-modal, .gal-embedded-viewer, .gal-cg-viewer, .gal-special-cg-overlay').length) return;
    if ($target.closest('button, a, input, textarea, select, [data-action], [contenteditable="true"]').length) return;

    e.stopPropagation();
    await triggerNextSegmentFromOverlay();
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
          if (isTypewriterActive()) return;

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
    if (!settings.showMissingSpritePlaceholder) return;
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

  // 特殊 CG 叠层关闭
  $(doc).on('click', '#gal-global-overlay .gal-special-cg-overlay-close', function (e) {
    e.stopPropagation();
    clearSpecialCgOverlayAndQueue();
  });

  $(doc).on('click', '#gal-global-overlay .gal-special-cg-overlay', function (e) {
    if ($(e.target).closest('.gal-special-cg-overlay-image, .gal-special-cg-overlay-close').length) return;
    e.stopPropagation();
    clearSpecialCgOverlayAndQueue();
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
