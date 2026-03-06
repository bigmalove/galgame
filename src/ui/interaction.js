import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow, $ } from '../core/env.js';
import { GalgameStore } from '../core/store.js';
import { getSettings } from '../core/settings.js';
import { getIsSkipping, setIsSkipping, getSkipTimer, setSkipTimer, getIsRewinding, setIsRewinding, getIsEnabled, getLastGalgameOptionHash, setLastGalgameOptionHash } from '../core/state.js';
import { TTSManager } from '../audio/tts-manager.js';
import { clearAllPixiEffects } from '../effects/pixi-effect-manager.js';
import { parseGalgameContent } from '../logic/parser.js';
import { decodeHtml, getFormattedSwipeContent, getRawMessageContent } from '../utils/html.js';
import { scheduleOverlaySegmentDisplay, setCurrentDisplayMesId } from './overlay.js';
import { detectAndCaptureCg } from './overlay-content.js';
import { showToast } from './toast.js';
import { getModalMountRoot } from './fullscreen.js';

// ============================================
// 交互功能
// ============================================

const messageSegmentState = GalgameStore.cache.segments;
const KEYBOARD_SHORTCUTS_BOUND_FLAG = '__galgame_keyboard_shortcuts_bound__';

let rewindHoldTimer = null;
let rewindTimer = null;

// 延迟引用
let _showSpriteUploadDialogRef = null;
let _hideGalgameChoicesRef = null;
let _refreshGalgameViewsRef = null;
let _updateGlobalOverlayContentRef = null;

export function setInteractionRefs({ showSpriteUploadDialog, hideGalgameChoices, refreshGalgameViews, updateGlobalOverlayContent }) {
  if (showSpriteUploadDialog) _showSpriteUploadDialogRef = showSpriteUploadDialog;
  if (hideGalgameChoices) _hideGalgameChoicesRef = hideGalgameChoices;
  if (refreshGalgameViews) _refreshGalgameViewsRef = refreshGalgameViews;
  if (updateGlobalOverlayContent) _updateGlobalOverlayContentRef = updateGlobalOverlayContent;
}

function findPreviousAiMessage(currentMesId) {
  const currentMesIdStr = String(currentMesId || '');
  if (!currentMesIdStr) return null;

  const $currentMes = $(`#chat > .mes[mesid="${currentMesIdStr}"]`);
  if ($currentMes.length) {
    const $prev = $currentMes.prevAll('.mes[is_user!="true"]').first();
    if ($prev.length) return $prev;
  }

  const currentMesIdNum = Number.parseInt(currentMesIdStr, 10);
  if (!Number.isFinite(currentMesIdNum)) return null;

  let $best = null;
  let bestMesId = Number.NEGATIVE_INFINITY;
  $('#chat > .mes[is_user!="true"]').each(function () {
    const $mes = $(this);
    const mesId = Number.parseInt($mes.attr('mesid'), 10);
    if (!Number.isFinite(mesId) || mesId >= currentMesIdNum || mesId <= bestMesId) return;
    $best = $mes;
    bestMesId = mesId;
  });
  return $best;
}

function findNextAiMessage(currentMesId) {
  const currentMesIdStr = String(currentMesId || '');
  if (!currentMesIdStr) return null;

  const $currentMes = $(`#chat > .mes[mesid="${currentMesIdStr}"]`);
  if ($currentMes.length) {
    const $next = $currentMes.nextAll('.mes[is_user!="true"]').first();
    if ($next.length) return $next;
  }

  const currentMesIdNum = Number.parseInt(currentMesIdStr, 10);
  if (!Number.isFinite(currentMesIdNum)) return null;

  let $best = null;
  let bestMesId = Number.POSITIVE_INFINITY;
  $('#chat > .mes[is_user!="true"]').each(function () {
    const $mes = $(this);
    const mesId = Number.parseInt($mes.attr('mesid'), 10);
    if (!Number.isFinite(mesId) || mesId <= currentMesIdNum || mesId >= bestMesId) return;
    $best = $mes;
    bestMesId = mesId;
  });
  return $best;
}

function extractMessageContent($mes, mesId) {
  let contentToProcess = getFormattedSwipeContent(mesId);
  if (!contentToProcess) {
    contentToProcess = getRawMessageContent(mesId);
  }
  if (!contentToProcess) {
    const html = $mes.find('.mes_text').html();
    if (html) {
      contentToProcess = decodeHtml(html);
    }
  }
  if (!contentToProcess) {
    contentToProcess = String($mes.find('.mes_text').text() || '').trim();
  }
  return String(contentToProcess || '');
}

function buildFallbackParsed(fallbackText) {
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
}

function ensureParsedStateForMes($mes, mesId, targetIndex = 'first') {
  if (!$mes?.length) return null;

  const mesIdStr = String(mesId || '');
  if (!mesIdStr) return null;

  const contentToProcess = extractMessageContent($mes, mesIdStr);
  let parsed = contentToProcess ? parseGalgameContent(contentToProcess, mesIdStr) : null;

  if (!parsed || !Array.isArray(parsed.segments) || parsed.segments.length === 0) {
    const fallbackText = String($mes.find('.mes_text').text() || '').trim() || '（当前消息无可显示内容）';
    parsed = buildFallbackParsed(fallbackText);
  }

  try {
    detectAndCaptureCg(mesIdStr, $mes[0], parsed);
  } catch (error) {
    console.warn(`[${SCRIPT_NAME}] 切换上一楼层时 CG 检测失败`, error);
  }

  let state = messageSegmentState.get(mesIdStr);
  if (!state) {
    state = {
      currentIndex: 0,
      segments: parsed.segments,
      parsedContent: parsed,
      renderToken: 0,
      lastAppliedEffectIndex: -1,
      effectSyncTicket: 0,
      effectSyncPromise: Promise.resolve(),
    };
    messageSegmentState.set(mesIdStr, state);
  } else {
    state.segments = parsed.segments;
    state.parsedContent = parsed;
    if (!Number.isFinite(state.renderToken)) {
      state.renderToken = 0;
    }
    if (!Number.isFinite(state.lastAppliedEffectIndex)) {
      state.lastAppliedEffectIndex = -1;
    }
    if (!Number.isFinite(state.effectSyncTicket)) {
      state.effectSyncTicket = 0;
    }
    if (!state.effectSyncPromise || typeof state.effectSyncPromise.then !== 'function') {
      state.effectSyncPromise = Promise.resolve();
    }
  }

  let nextIndex = 0;
  if (targetIndex === 'last') {
    nextIndex = Math.max(0, parsed.segments.length - 1);
  } else if (typeof targetIndex === 'number' && Number.isFinite(targetIndex)) {
    const clampedMax = Math.max(0, parsed.segments.length - 1);
    nextIndex = Math.max(0, Math.min(targetIndex, clampedMax));
  }
  state.currentIndex = nextIndex;

  return { state, parsed, mesId: mesIdStr };
}

async function switchToPreviousAiFloor(options = {}) {
  const { suppressTTS = false } = options;
  const currentMesId = $('#gal-global-overlay .gal-game-container').attr('data-mes-id');
  if (!currentMesId) return { ok: false };

  const $prevAiMes = findPreviousAiMessage(currentMesId);
  if (!$prevAiMes || !$prevAiMes.length) return { ok: false };

  const prevMesId = $prevAiMes.attr('mesid');
  if (!prevMesId) return { ok: false };

  const prepared = ensureParsedStateForMes($prevAiMes, prevMesId, 'last');
  if (!prepared) return { ok: false };

  TTSManager.stop();

  if (_updateGlobalOverlayContentRef) {
    await _updateGlobalOverlayContentRef(prepared.mesId, prepared.parsed, { suppressTTS });
    return { ok: true, state: prepared.state, mesId: prepared.mesId };
  }

  console.warn(`[${SCRIPT_NAME}] updateGlobalOverlayContent 引用未注入，降级到段落渲染`);
  $('#gal-global-overlay .gal-game-container').attr('data-mes-id', prepared.mesId);
  setCurrentDisplayMesId(prepared.mesId);
  const rendered = await scheduleOverlaySegmentDisplay(prepared.state, 'switch-prev-floor-fallback');
  return rendered ? { ok: true, state: prepared.state, mesId: prepared.mesId } : { ok: false };
}

export async function switchToNextAiFloor(options = {}) {
  const { suppressTTS = false } = options;
  const currentMesId = $('#gal-global-overlay .gal-game-container').attr('data-mes-id');
  if (!currentMesId) return { ok: false };

  const $nextAiMes = findNextAiMessage(currentMesId);
  if (!$nextAiMes || !$nextAiMes.length) return { ok: false };

  const nextMesId = $nextAiMes.attr('mesid');
  if (!nextMesId) return { ok: false };

  const prepared = ensureParsedStateForMes($nextAiMes, nextMesId, 'first');
  if (!prepared) return { ok: false };

  TTSManager.stop();

  if (_updateGlobalOverlayContentRef) {
    await _updateGlobalOverlayContentRef(prepared.mesId, prepared.parsed, { suppressTTS });
    return { ok: true, state: prepared.state, mesId: prepared.mesId };
  }

  console.warn(`[${SCRIPT_NAME}] updateGlobalOverlayContent 引用未注入，降级到段落渲染`);
  $('#gal-global-overlay .gal-game-container').attr('data-mes-id', prepared.mesId);
  setCurrentDisplayMesId(prepared.mesId);
  const rendered = await scheduleOverlaySegmentDisplay(prepared.state, 'switch-next-floor-fallback');
  return rendered ? { ok: true, state: prepared.state, mesId: prepared.mesId } : { ok: false };
}

export function showFreeInputModal() {
  const modalHtml = `
    <div class="gal-input-modal gal-z-critical" id="gal-free-input-modal">
      <div class="gal-input-box">
        <div class="gal-input-title" style="display: flex; align-items: center; justify-content: space-between;">
          <span>自由输入</span>
          <button id="gal-free-input-close-x" title="关闭" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px; line-height: 1; transition: color 0.2s; transform: none;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <textarea class="gal-input-field" id="gal-free-input-text" placeholder="输入你想说的话..."></textarea>
        <div class="gal-input-actions">
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

  $modal.find('#gal-free-input-close-x').on('click', () => $modal.remove());
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
  clearAllPixiEffects();
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
      const switched = await switchToPreviousAiFloor({ suppressTTS: true });
      if (switched.ok) {
        rewindTimer = setTimeout(doRewind, settings.skipSpeed * 1000);
      } else {
        stopRewinding();
        showToast('已回退到最早AI楼层');
      }
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

export async function triggerPrevSegment() {
  const mesId = $('#gal-global-overlay .gal-game-container').attr('data-mes-id');
  const state = messageSegmentState.get(String(mesId));
  if (!state) return;

  if (state.currentIndex > 0) {
    TTSManager.stop();
    state.currentIndex--;
    await scheduleOverlaySegmentDisplay(state, 'trigger-prev');
  } else {
    const switched = await switchToPreviousAiFloor({ suppressTTS: true });
    if (!switched.ok) {
      showToast('已是最早AI楼层');
    }
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
  if (topWindow[KEYBOARD_SHORTCUTS_BOUND_FLAG]) {
    console.log(`[${SCRIPT_NAME}] 快捷键监听已存在，跳过重复注册`);
    return;
  }
  topWindow[KEYBOARD_SHORTCUTS_BOUND_FLAG] = true;

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
