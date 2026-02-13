import { SCRIPT_NAME } from '../core/constants.js';
import { $ } from '../core/env.js';
import { GalgameStore } from '../core/store.js';
import { getSettings } from '../core/settings.js';
import { getIsEnabled, getHideOtherFloors, getPendingOptions } from '../core/state.js';
import { decodeHtml, getRawMessageContent, getFormattedSwipeContent } from '../utils/html.js';
import { Live2DPreloadManager } from '../live2d/preload.js';
import { BGMManager } from '../audio/bgm-manager.js';
import { RE_GAL_TAGS } from '../logic/parser.js';
import { parseGalgameContent } from '../logic/parser.js';
import { handleWallhavenBackgroundSearch } from '../image-gen/wallhaven-handler.js';
import { showGlobalOverlay, adjustToolbarForSpace } from './overlay.js';
import { detectAndCaptureCg } from './overlay-content.js';
import { injectGalgameButton } from './menu-button.js';
import { renderBGMWidget } from './bgm-widget.js';
import { hideNonLastFloors } from './galgame-mode.js';

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

export function processNewMessage(mesNode) {
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
    if (!html) return;
    contentToProcess = decodeHtml(html);
  }

  const hasGalTags = RE_GAL_TAGS.test(contentToProcess);
  if (settings.smartDetection && !hasGalTags) return;

  const hasClosedP = RE_CLOSED_P.test(contentToProcess);
  if (!hasClosedP) {
    console.log(`[${SCRIPT_NAME}] 流式输出中，等待完整内容...`);
    const loadingParsed = {
      segments: [{ type: 'narration', speaker: null, text: '生成中...', expression: null }],
      currentBackground: null,
      bgm: null,
      options: [],
    };
    const isLastAi = $mes.nextAll('.mes[is_user!="true"]').length === 0;
    if (isLastAi && _updateGlobalOverlayContentRef) {
      _updateGlobalOverlayContentRef(mesId, loadingParsed);
      showGlobalOverlay();
      const pending = getPendingOptions();
      if (pending && pending.length > 0) {
        $('.gal-game-container .gal-pending-choices-btn').addClass('show');
        adjustToolbarForSpace();
      }
    }
    return;
  }

  let parsed = parseGalgameContent(contentToProcess);

  // 实时背景生成处理 (根据 bgImageSource 单选分派)
  if (parsed.backgroundChanges) {
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
          entry.handler(bgChange.scene, tags);
        }
      }
    }
  }

  // CG 图片：从 DOM 检测 st-chatu8 渲染的图片
  detectAndCaptureCg(mesId, mesNode, parsed);

  console.log(`[${SCRIPT_NAME}] [DEBUG] processNewMessage 解析完成. Segments: ${parsed.segments.length}`);

  if (parsed.segments.length === 0) {
    if (!settings.smartDetection && contentToProcess && contentToProcess.trim().length > 0) {
      parsed = {
        segments: [{ type: 'narration', speaker: null, text: contentToProcess, expression: null }],
        currentBackground: null,
        bgm: null,
        options: [],
      };
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

  Live2DPreloadManager.preloadFromSegments(parsed.segments, state.currentIndex, 'process-message');

  const isLastAi = $mes.nextAll('.mes[is_user!="true"]').length === 0;
  if (isLastAi) {
    if (_updateGlobalOverlayContentRef) {
      _updateGlobalOverlayContentRef(mesId, parsed);
    }
    showGlobalOverlay();

    requestAnimationFrame(() => {
      if (_applySettingsToUIRef) _applySettingsToUIRef();
    });

    if (parsed.bgm && parsed.bgm.keyword) {
      BGMManager.play(parsed.bgm.keyword);
    }
    renderBGMWidget();

    if (getHideOtherFloors()) {
      setTimeout(hideNonLastFloors, 100);
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
