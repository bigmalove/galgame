import { BGMManager } from '../audio/bgm-manager.js';
import { SCRIPT_NAME } from '../core/constants.js';
import { $ } from '../core/env.js';
import { getSettings } from '../core/settings.js';
import { getHideOtherFloors, getIsEnabled, getPendingOptions } from '../core/state.js';
import { GalgameStore } from '../core/store.js';
import { handleWallhavenBackgroundSearch } from '../image-gen/wallhaven-handler.js';
import { Live2DPreloadManager } from '../live2d/preload.js';
import { parseGalgameContent, RE_GAL_TAGS } from '../logic/parser.js';
import { consumePendingSpecialCgByScene } from '../logic/special-cg-trigger.js';
import { markTimelineCacheDirty } from '../timeline/data.js';
import { decodeHtml, getFormattedSwipeContent, getRawMessageContent } from '../utils/html.js';
import { renderBGMWidget } from './bgm-widget.js';
import { hideNonLastFloors, showAllFloors } from './galgame-mode.js';
import { injectGalgameButton } from './menu-button.js';
import { detectAndCaptureCg } from './overlay-content.js';
import { adjustToolbarForSpace, ensureGlobalOverlay, showGlobalOverlay } from './overlay.js';
import { cancelTypewriter } from './typewriter.js';

// ============================================
// 新消息处理
// ============================================

const messageSegmentState = GalgameStore.cache.segments;

const RE_CLOSED_P = /<\/p>/i;

// 延迟引用
let _updateGlobalOverlayContentRef = null;
let _applySettingsToUIRef = null;
let _handleRealTimeBackgroundGenerationRef = null;
let _handleBananaBackgroundGenerationRef = null;
let _handleNovelAIBackgroundGenerationRef = null;

export function setProcessMessageRefs({ updateGlobalOverlayContent, applySettingsToUI, handleRealTimeBackgroundGeneration, handleBananaBackgroundGeneration, handleNovelAIBackgroundGeneration }) {
  if (updateGlobalOverlayContent) _updateGlobalOverlayContentRef = updateGlobalOverlayContent;
  if (applySettingsToUI) _applySettingsToUIRef = applySettingsToUI;
  if (handleRealTimeBackgroundGeneration) _handleRealTimeBackgroundGenerationRef = handleRealTimeBackgroundGeneration;
  if (handleBananaBackgroundGeneration) _handleBananaBackgroundGenerationRef = handleBananaBackgroundGeneration;
  if (handleNovelAIBackgroundGeneration) _handleNovelAIBackgroundGenerationRef = handleNovelAIBackgroundGeneration;
}

function buildFallbackParsed(text) {
  return {
    segments: [{ type: 'narration', speaker: null, text: text || '（当前消息无可显示内容）', expression: null }],
    currentBackground: null,
    bgm: null,
    options: [],
  };
}

function renderFallbackOverlay(mesId, text) {
  cancelTypewriter();
  const $overlay = ensureGlobalOverlay();
  $overlay.find('.gal-name-badge span').text('旁白');
  $overlay.find('.gal-name-badge').addClass('gal-narrator-label');
  $overlay.find('.gal-dialog-text').text(text || '（当前消息无可显示内容）');
  $overlay.find('.gal-progress-bar').css('width', '100%');
  $overlay.find('.gal-game-container').attr('data-mes-id', String(mesId));
  showGlobalOverlay();
}

function syncFloorVisibilityAfterOverlay(mesId) {
  if (!getHideOtherFloors()) {
    showAllFloors();
    return;
  }

  setTimeout(() => {
    const $overlay = $('#gal-global-overlay');
    const overlayMesId = String($overlay.find('.gal-game-container').attr('data-mes-id') || '');
    const ready = $overlay.length > 0 && $overlay.hasClass('active') && overlayMesId === String(mesId);
    if (ready) {
      hideNonLastFloors();
    } else {
      console.warn(`[${SCRIPT_NAME}] 覆盖层未就绪，取消隐藏消息楼层（mesId=${mesId}, overlayMesId=${overlayMesId || 'none'}）`);
      showAllFloors();
    }
  }, 120);
}

export async function processNewMessage(mesNode, options = {}) {
  const { forceRender = false } = options || {};
  injectGalgameButton(mesNode);
  if (!getIsEnabled()) return;

  const $mes = $(mesNode);
  const isUser = $mes.attr('is_user') === 'true';
  if (isUser) return;

  const mesId = $mes.attr('mesid');
  const settings = getSettings();

  let contentToProcess = getFormattedSwipeContent(mesId);
  if (!contentToProcess) {
    contentToProcess = getRawMessageContent(mesId);
  }
  if (!contentToProcess) {
    const $mesText = $mes.find('.mes_text');
    const html = $mesText.html();
    if (!html) {
      if (!forceRender) return;
      contentToProcess = String($mesText.text() || '').trim();
    } else {
      contentToProcess = decodeHtml(html);
    }
  }

  const hasGalTags = RE_GAL_TAGS.test(contentToProcess);
  if (settings.smartDetection && !hasGalTags && !forceRender) return;

  const hasClosedP = RE_CLOSED_P.test(contentToProcess);
  if (!hasClosedP && !forceRender) {
    console.log(`[${SCRIPT_NAME}] 流式输出中，等待完整内容...`);
    const loadingParsed = buildFallbackParsed('生成中...');
    const isLastAi = $mes.nextAll('.mes[is_user!="true"]').length === 0;
    if (isLastAi) {
      if (_updateGlobalOverlayContentRef) {
        try {
          await _updateGlobalOverlayContentRef(mesId, loadingParsed);
          showGlobalOverlay();
          syncFloorVisibilityAfterOverlay(mesId);
        } catch (error) {
          console.error(`[${SCRIPT_NAME}] 流式内容渲染失败，使用兜底覆盖层`, error);
          renderFallbackOverlay(mesId, '生成中...');
          showAllFloors();
        }
      } else {
        renderFallbackOverlay(mesId, '生成中...');
      }
      const pending = getPendingOptions();
      if (pending && pending.length > 0) {
        $('.gal-game-container .gal-pending-choices-btn').addClass('show');
        adjustToolbarForSpace();
      }
    }
    return;
  }

  let parsed = null;
  try {
    parsed = parseGalgameContent(contentToProcess);
  } catch (error) {
    console.error(`[${SCRIPT_NAME}] 解析消息失败，使用纯文本兜底`, error);
    parsed = buildFallbackParsed(String(contentToProcess || '').trim());
  }

  if (parsed && Array.isArray(parsed.backgroundChanges) && parsed.backgroundChanges.length > 0) {
    for (const change of parsed.backgroundChanges) {
      const scene = String(change?.scene || '').trim();
      if (!scene) continue;
      if (consumePendingSpecialCgByScene(scene)) {
        break;
      }
    }
  }

  // 实时背景生成处理 (根据 bgImageSource 单选分派)
  if (parsed && parsed.backgroundChanges) {
    const bgSrc = settings.bgImageSource || 'none';
    const bgDispatch = {
      comfyui:   { tagKey: 'generationTags', handler: _handleRealTimeBackgroundGenerationRef, label: 'ComfyUI 背景生成' },
      banana:    { tagKey: 'bananaPrompt',    handler: _handleBananaBackgroundGenerationRef,  label: '大香蕉背景生成' },
      novelai:   { tagKey: 'generationTags', handler: _handleNovelAIBackgroundGenerationRef, label: 'NovelAI 背景生成' },
      wallhaven: { tagKey: 'wallhavenTags',  handler: handleWallhavenBackgroundSearch,       label: 'Wallhaven 背景搜索' },
    };
    const entry = bgDispatch[bgSrc];
    if (entry && entry.handler) {
      for (const bgChange of parsed.backgroundChanges) {
        const tags = bgChange[entry.tagKey];
        if (tags) {
          console.log(`[${SCRIPT_NAME}] [DEBUG] 触发 ${entry.label}: "${bgChange.scene}"`);
          try {
            entry.handler(bgChange.scene, tags);
          } catch (error) {
            console.warn(`[${SCRIPT_NAME}] 背景处理失败: ${entry.label}`, error);
          }
        }
      }
    }
  }

  // CG 图片：从 DOM 检测 st-chatu8 渲染的图片
  try {
    detectAndCaptureCg(mesId, mesNode, parsed);
  } catch (error) {
    console.warn(`[${SCRIPT_NAME}] CG 检测失败`, error);
  }

  console.log(`[${SCRIPT_NAME}] [DEBUG] processNewMessage 解析完成. Segments: ${parsed?.segments?.length || 0}`);

  if (!parsed || parsed.segments.length === 0) {
    if (!settings.smartDetection || forceRender) {
      const fallbackText = (contentToProcess && contentToProcess.trim().length > 0)
        ? contentToProcess
        : (String($mes.find('.mes_text').text() || '').trim() || '（当前消息无可显示内容）');
      parsed = buildFallbackParsed(fallbackText);
    } else {
      return;
    }
  }

  let state = messageSegmentState.get(String(mesId));
  if (!state) {
    state = { currentIndex: 0, segments: parsed.segments, parsedContent: parsed, renderToken: 0 };
    messageSegmentState.set(String(mesId), state);
    console.log(`[${SCRIPT_NAME}] 消息 ${mesId} 初始化状态`);
  } else {
    state.segments = parsed.segments;
    state.parsedContent = parsed;
    if (!Number.isFinite(state.renderToken)) {
      state.renderToken = 0;
    }
    if (state.currentIndex >= parsed.segments.length) {
      state.currentIndex = parsed.segments.length - 1;
    }
  }

  markTimelineCacheDirty();

  Live2DPreloadManager.preloadFromSegments(parsed.segments, state.currentIndex, 'process-message');

  const isLastAi = $mes.nextAll('.mes[is_user!="true"]').length === 0;
  if (isLastAi) {
    cancelTypewriter();
    const fallbackText = String($mes.find('.mes_text').text() || '').trim() || '（当前消息无可显示内容）';

    if (_updateGlobalOverlayContentRef) {
      try {
        await _updateGlobalOverlayContentRef(mesId, parsed);
        showGlobalOverlay();

        requestAnimationFrame(() => {
          if (_applySettingsToUIRef) _applySettingsToUIRef();
        });

        if (parsed.bgm && parsed.bgm.keyword) {
          BGMManager.play(parsed.bgm.keyword);
        }
        renderBGMWidget();
        syncFloorVisibilityAfterOverlay(mesId);
      } catch (error) {
        console.error(`[${SCRIPT_NAME}] 主界面渲染失败，使用兜底覆盖层`, error);
        renderFallbackOverlay(mesId, fallbackText);
        showAllFloors();
      }
    } else {
      console.warn(`[${SCRIPT_NAME}] updateGlobalOverlayContent 引用未注入，使用兜底覆盖层`);
      renderFallbackOverlay(mesId, fallbackText);
      syncFloorVisibilityAfterOverlay(mesId);
    }

  } else {
    console.log(`[${SCRIPT_NAME}] 消息 ${mesId} 不是最后一条AI消息，跳过全局UI更新`);
  }
}

export function showGeneratingStatus($container, text) {
  let $status = $container.find('.gal-generating-status');
  if (!$status.length) {
    $status = $(`<div class="gal-generating-status"></div>`);
    $container.find('.gal-dialog-layer').prepend($status);
  }
  $status.text(text).addClass('show');
  setTimeout(() => $status.removeClass('show'), 2000);
}
