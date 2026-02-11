import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow, $ } from '../core/env.js';
import { GalgameStore } from '../core/store.js';
import { getSettings } from '../core/settings.js';
import { getIsSkipping, setIsSkipping, getSkipTimer, setSkipTimer, getIsRewinding, setIsRewinding, getIsEnabled, getLastGalgameOptionHash, setLastGalgameOptionHash } from '../core/state.js';
import { TTSManager } from '../audio/tts-manager.js';
import { scheduleOverlaySegmentDisplay, setCurrentDisplayMesId } from './overlay.js';
import { showToast } from './toast.js';
import { getModalMountRoot } from './fullscreen.js';

// ============================================
// 交互功能
// ============================================

const messageSegmentState = GalgameStore.cache.segments;

let rewindHoldTimer = null;
let rewindTimer = null;

// 延迟引用
let _showSpriteUploadDialogRef = null;
let _hideGalgameChoicesRef = null;
let _refreshGalgameViewsRef = null;

export function setInteractionRefs({ showSpriteUploadDialog, hideGalgameChoices, refreshGalgameViews }) {
  if (showSpriteUploadDialog) _showSpriteUploadDialogRef = showSpriteUploadDialog;
  if (hideGalgameChoices) _hideGalgameChoicesRef = hideGalgameChoices;
  if (refreshGalgameViews) _refreshGalgameViewsRef = refreshGalgameViews;
}

export function showFreeInputModal() {
  const modalHtml = `
    <div class="gal-input-modal gal-z-critical" id="gal-free-input-modal">
      <div class="gal-input-box">
        <div class="gal-input-title"><span>自由输入</span></div>
        <textarea class="gal-input-field" id="gal-free-input-text" placeholder="输入你想说的话..."></textarea>
        <div class="gal-input-actions">
          <button class="gal-action-btn" id="gal-input-cancel">
            <span>取消</span>
          </button>
          <button class="gal-action-btn primary" id="gal-input-send">
            <i class="fa-solid fa-paper-plane"></i>
            <span>发送</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const mountRoot = getModalMountRoot();
  $(mountRoot).append(modalHtml);
  const $modal = $(mountRoot).find('#gal-free-input-modal');
  const $input = $(mountRoot).find('#gal-free-input-text');
  makeDraggable($modal.find('.gal-input-box'), $modal.find('.gal-input-title'));
  $input.focus();

  $modal.find('#gal-input-cancel').on('click', () => $modal.remove());
  $modal.on('click', function (e) {
    if (e.target === this) $modal.remove();
  });
  $modal.find('#gal-input-send').on('click', () => {
    const text = $input.val().trim();
    if (text) {
      sendUserMessage(text);
      $modal.remove();
    }
  });
  $input.on('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $modal.find('#gal-input-send').click();
    }
  });
}

export function sendUserMessage(text) {
  const $sendTextarea = $('#send_textarea');
  const $sendButton = $('#send_but');
  if ($sendTextarea.length && $sendButton.length) {
    $sendTextarea.val(text);
    $sendButton.click();
    showToast('消息已发送');
  } else {
    console.error(`[${SCRIPT_NAME}] 未找到发送按钮`);
  }
}

let isRerolling = false;

export function getIsRerolling() { return isRerolling; }

export function triggerReroll() {
  isRerolling = true;
  if (_hideGalgameChoicesRef) _hideGalgameChoicesRef();
  setLastGalgameOptionHash(null);
  setCurrentDisplayMesId(null);

  const $lastMes = $('.mes.last_mes');
  if ($lastMes.length) {
    const mesId = $lastMes.attr('mesid');
    if (mesId) {
      messageSegmentState.delete(String(mesId));
      console.log(`[${SCRIPT_NAME}] 已清除消息 ${mesId} 的段落状态，准备重新生成`);
    }
  }

  const $regenerate = $(topWindow.document).find('#option_regenerate');
  if ($regenerate.length) {
    $regenerate.click();
    showToast('正在重新生成...');
  } else {
    try {
      if (topWindow.SillyTavern && topWindow.SillyTavern.Generate) {
        topWindow.SillyTavern.Generate();
        showToast('正在重新生成...');
      } else {
        console.warn(`[${SCRIPT_NAME}] 未找到 #option_regenerate`);
        showToast('未找到重新生成按钮');
      }
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 重新生成失败:`, e);
      showToast('重新生成失败');
      isRerolling = false;
    }
  }

  setTimeout(() => {
    isRerolling = false;
    console.log(`[${SCRIPT_NAME}] 重绘锁定已解除`);
  }, 3000);
}

export function startSkipping() {
  if (getIsSkipping()) return;
  setIsSkipping(true);
  const settings = getSettings();

  const $btn = $('#gal-global-overlay [data-action="skip"]');
  $btn.addClass('active');
  TTSManager.stop();

  const doSkip = async () => {
    if (!getIsSkipping()) return;
    const mesId = $('#gal-global-overlay .gal-game-container').attr('data-mes-id');
    const state = messageSegmentState.get(String(mesId));
    if (!state) {
      console.warn(`[${SCRIPT_NAME}] [DEBUG] 快进停止: 找不到状态`);
      stopSkipping();
      return;
    }
    const hasNext = !!state.segments[state.currentIndex + 1];
    if (hasNext) {
      TTSManager.stop();
      state.currentIndex++;
      await scheduleOverlaySegmentDisplay(state, 'skip');
      setSkipTimer(setTimeout(doSkip, settings.skipSpeed * 1000));
    } else {
      stopSkipping();
      showToast('已快进到最后');
    }
  };
  void doSkip();
}

export function stopSkipping() {
  setIsSkipping(false);
  const timer = getSkipTimer();
  if (timer) {
    clearTimeout(timer);
    setSkipTimer(null);
  }
  $('#gal-global-overlay [data-action="skip"]').removeClass('active');
}

export function startRewinding() {
  if (getIsRewinding()) return;
  setIsRewinding(true);
  const settings = getSettings();
  showToast('快速回退中...');

  const $btn = $('#gal-global-overlay [data-action="prev"]');
  $btn.addClass('active');

  const doRewind = async () => {
    if (!getIsRewinding()) return;
    const mesId = $('#gal-global-overlay .gal-game-container').attr('data-mes-id');
    const state = messageSegmentState.get(String(mesId));
    if (!state) {
      stopRewinding();
      return;
    }
    if (state.currentIndex > 0) {
      TTSManager.stop();
      state.currentIndex--;
      await scheduleOverlaySegmentDisplay(state, 'rewind');
      rewindTimer = setTimeout(doRewind, settings.skipSpeed * 1000);
    } else {
      stopRewinding();
      showToast('已回退到开头');
    }
  };
  void doRewind();
}

export function stopRewinding() {
  setIsRewinding(false);
  if (rewindTimer) {
    clearTimeout(rewindTimer);
    rewindTimer = null;
  }
  $('#gal-global-overlay [data-action="prev"]').removeClass('active');
}

export function triggerPrevSegment() {
  const mesId = $('#gal-global-overlay .gal-game-container').attr('data-mes-id');
  const state = messageSegmentState.get(String(mesId));
  if (!state) return;

  if (state.currentIndex > 0) {
    TTSManager.stop();
    state.currentIndex--;
    scheduleOverlaySegmentDisplay(state, 'trigger-prev');
  } else {
    showToast('已是第一段');
  }
}

export function triggerNextSegment() {
  const $lastContainer = $('.gal-game-container:visible').last();
  if (!$lastContainer.length) return;
  const $nextBtn = $lastContainer.find('[data-action="next"]');
  if ($nextBtn.length) {
    $nextBtn.trigger('click');
  }
}

export function getRewindHoldTimer() { return rewindHoldTimer; }
export function setRewindHoldTimer(timer) { rewindHoldTimer = timer; }
export function clearRewindHoldTimer() {
  if (rewindHoldTimer) {
    clearTimeout(rewindHoldTimer);
    rewindHoldTimer = null;
  }
}

// ============================================
// 键盘快捷键
// ============================================

export function setupKeyboardShortcuts() {
  const settings = getSettings();

  $(topWindow.document).on('keydown', function (e) {
    if (!getIsEnabled()) return;
    const activeEl = topWindow.document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
      return;
    }
    if (e.key === 'Control' && settings.ctrlKeySkip) {
      startSkipping();
    }
    if (e.code === 'Space' && settings.spaceKeyNext) {
      e.preventDefault();
      triggerNextSegment();
    }
    if (e.code === 'Enter' && settings.enterKeyNext) {
      e.preventDefault();
      triggerNextSegment();
    }
  });

  $(topWindow.document).on('keyup', function (e) {
    if (e.key === 'Control' && settings.ctrlKeySkip) {
      stopSkipping();
    }
  });

  console.log(`[${SCRIPT_NAME}] 快捷键监听已启动`);
}

// ============================================
// 通用拖拽功能
// ============================================

export function makeDraggable($element, $handle) {
  $handle.addClass('gal-draggable-handle');
  let isDragging = false;
  let startX, startY, initialLeft, initialTop;

  $handle.on('mousedown touchstart', function (e) {
    if ($(e.target).closest('button, input, a, .gal-config-close, .close').length) return;
    e.preventDefault();
    isDragging = true;
    const evt = e.type === 'touchstart' ? e.touches[0] : e;
    startX = evt.clientX;
    startY = evt.clientY;
    const offset = $element.offset();
    initialLeft = offset.left;
    initialTop = offset.top;
    $element.css({
      position: 'fixed',
      margin: 0,
      left: initialLeft - $(topWindow).scrollLeft(),
      top: initialTop - $(topWindow).scrollTop(),
      transform: 'none',
    });
  });

  $(topWindow).on('mousemove touchmove', function (e) {
    if (!isDragging) return;
    e.preventDefault();
    const evt = e.type === 'touchmove' ? e.touches[0] : e;
    const dx = evt.clientX - startX;
    const dy = evt.clientY - startY;
    $element.css({
      left: initialLeft - $(topWindow).scrollLeft() + dx,
      top: initialTop - $(topWindow).scrollTop() + dy,
    });
  });

  $(topWindow).on('mouseup touchend', function () {
    isDragging = false;
  });
}
