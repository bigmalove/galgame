import { SCRIPT_NAME } from '../core/constants.js';
import { $ } from '../core/env.js';
import { GalgameStore } from '../core/store.js';
import { getSettings } from '../core/settings.js';
import { getIsEnabled, getPendingOptions, getGalgameChoicesVisible } from '../core/state.js';
import { decodeHtml, getRawMessageContent, getFormattedSwipeContent } from '../utils/html.js';
import { updateLocationTimeDisplay } from '../utils/location-time.js';
import { Live2DPreloadManager } from '../live2d/preload.js';
import { SpriteManager } from '../sprite/sprite-manager.js';
import { TTSManager } from '../audio/tts-manager.js';
import { getIsGeneratingResponse } from '../logic/generation-state.js';
import { checkSillyTavernGenerating, resetGenerationState } from '../logic/generation-state.js';
import { parseGalgameContent } from '../logic/parser.js';
import { getCurrentDisplayMesId, setCurrentDisplayMesId, ensureGlobalOverlay, nextOverlayRenderToken, scheduleOverlaySegmentDisplay, showGlobalOverlay } from './overlay.js';
import { updateNextBtnForGeneratingState, stopNextBtnAnimation } from './next-btn.js';

// ============================================
// 覆盖层内容更新
// ============================================

const messageSegmentState = GalgameStore.cache.segments;

export async function updateGlobalOverlayContent(mesId, parsedContent) {
  console.log(`[${SCRIPT_NAME}] [DEBUG] updateGlobalOverlayContent CALLED for mesId=${mesId}`);
  const $overlay = ensureGlobalOverlay();
  const segments = parsedContent.segments;
  const settings = getSettings();

  let state = messageSegmentState.get(String(mesId));
  if (!state) {
    state = { currentIndex: 0, segments: segments, parsedContent: parsedContent, renderToken: 0 };
    messageSegmentState.set(String(mesId), state);
    console.log(`[${SCRIPT_NAME}] [DEBUG] 新建状态，段落数: ${segments.length}`);
  } else {
    const segmentCountDiff = Math.abs(state.segments.length - segments.length);
    if (segmentCountDiff > 5) {
      console.log(`[${SCRIPT_NAME}] [DEBUG] 段落数变化较大 (${state.segments.length} -> ${segments.length})，重置到第一段`);
      state.currentIndex = 0;
    }
    state.segments = segments;
    state.parsedContent = parsedContent;
    if (!Number.isFinite(state.renderToken)) {
      state.renderToken = 0;
    }
    console.log(`[${SCRIPT_NAME}] [DEBUG] 更新状态，当前索引: ${state.currentIndex}, 段落数: ${segments.length}`);
  }

  const isNewMessage = getCurrentDisplayMesId() !== mesId;
  if (isNewMessage) {
    SpriteManager.reset($overlay);
  }
  setCurrentDisplayMesId(mesId);

  const renderToken = nextOverlayRenderToken(state);
  $overlay.attr('data-render-token', String(renderToken));

  const currentIndex = Math.min(state.currentIndex, segments.length - 1);
  Live2DPreloadManager.preloadFromSegments(segments, currentIndex, 'overlay-content');

  const displaySegment = segments[currentIndex] || { type: 'narration', text: '' };
  const displayText = displaySegment.text || '';
  const speaker = displaySegment.speaker;
  const isNarration = displaySegment.type === 'narration';

  const $nameBadge = $overlay.find('.gal-name-badge');
  $nameBadge.find('span').text(speaker || '旁白');
  if (isNarration) {
    $nameBadge.addClass('gal-narrator-label');
  } else {
    $nameBadge.removeClass('gal-narrator-label');
  }

  $overlay.find('.gal-dialog-text').text(displayText);

  const total = segments.length;
  const progressPercent = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;
  $overlay.find('.gal-progress-bar').css('width', `${progressPercent}%`);

  const expression = displaySegment.expression || '默认';
  await SpriteManager.updateSprite($overlay, speaker, expression, renderToken);

  const sceneToApply = displaySegment.backgroundScene || parsedContent.currentBackground?.scene;
  if (sceneToApply) {
    await SpriteManager.applySceneTint($overlay, sceneToApply);
    console.log(`[${SCRIPT_NAME}] [DEBUG] 应用背景场景: "${sceneToApply}" (段落 ${currentIndex + 1}/${segments.length})`);
  }

  const $nextBtn = $overlay.find('[data-action="next"]');
  const hasNextSegment = !!segments[currentIndex + 1];
  console.log(`[${SCRIPT_NAME}] updateGlobalOverlayContent - hasNextSegment=${hasNextSegment}, isGeneratingResponse=${getIsGeneratingResponse()}`);

  if (!hasNextSegment) {
    if (getIsGeneratingResponse()) {
      console.log(`[${SCRIPT_NAME}] updateGlobalOverlayContent - 启动动画`);
      updateNextBtnForGeneratingState();
    } else {
      console.log(`[${SCRIPT_NAME}] updateGlobalOverlayContent - 显示END`);
      stopNextBtnAnimation();
      $nextBtn.html('END <i class="fa-solid fa-check"></i>');
    }
  } else {
    console.log(`[${SCRIPT_NAME}] updateGlobalOverlayContent - 显示NEXT`);
    stopNextBtnAnimation();
    $nextBtn.html('NEXT <i class="fa-solid fa-chevron-right"></i>');
  }

  $overlay.find('.gal-game-container').attr('data-mes-id', mesId);
  updateLocationTimeDisplay();

  if (isNewMessage && settings.ttsEnabled && settings.ttsAutoPlay && !isNarration) {
    const segmentId = `${mesId}_${currentIndex}`;
    TTSManager.stop();
    TTSManager.speak(displaySegment, segmentId);
  }
}

export async function updateOverlaySegmentDisplay(state, expectedRenderToken = null) {
  if (!state) return false;

  const isRenderTokenStale = () =>
    expectedRenderToken !== null && expectedRenderToken !== (Number(state.renderToken) || 0);
  if (isRenderTokenStale()) return false;

  const $overlay = $('#gal-global-overlay');
  const currentIndex = state.currentIndex;
  const segment = state.segments[currentIndex];
  if (!segment) return false;

  Live2DPreloadManager.preloadFromSegments(state.segments, currentIndex, 'segment-display');

  if (expectedRenderToken !== null) {
    $overlay.attr('data-render-token', String(expectedRenderToken));
  }

  const speaker = segment.speaker;
  const isNarration = segment.type === 'narration';

  const $nameBadge = $overlay.find('.gal-name-badge');
  $nameBadge.find('span').text(speaker || '旁白');
  if (isNarration) {
    $nameBadge.addClass('gal-narrator-label');
  } else {
    $nameBadge.removeClass('gal-narrator-label');
  }

  $overlay.find('.gal-dialog-text').text(segment.text || '');

  const total = state.segments.length;
  const progressPercent = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;
  $overlay.find('.gal-progress-bar').css('width', `${progressPercent}%`);

  const isEnd = currentIndex >= total - 1;
  const $nextBtn = $overlay.find('[data-action="next"]');
  console.log(`[${SCRIPT_NAME}] 更新NEXT按钮 - isEnd=${isEnd}, isGeneratingResponse=${getIsGeneratingResponse()}`);

  if (isEnd) {
    if (getIsGeneratingResponse() && !checkSillyTavernGenerating()) {
      console.log(`[${SCRIPT_NAME}] 状态修正：SillyTavern 未在生成，重置 isGeneratingResponse`);
      resetGenerationState('状态修正 - SillyTavern 未在生成');
    }
    if (getIsGeneratingResponse()) {
      console.log(`[${SCRIPT_NAME}] 启动动画`);
      updateNextBtnForGeneratingState();
    } else {
      console.log(`[${SCRIPT_NAME}] 显示END`);
      stopNextBtnAnimation();
      $nextBtn.html('END <i class="fa-solid fa-check"></i>');
    }
    // 自动弹出选项
    if (_renderGalgameChoicesRef) {
      const pendingOpts = getPendingOptions();
      if (pendingOpts && pendingOpts.length > 0 && !getGalgameChoicesVisible()) {
        console.log(`[${SCRIPT_NAME}] 已翻页到末尾，自动弹出选项面板`);
        _renderGalgameChoicesRef(pendingOpts);
      }
    }
  } else {
    console.log(`[${SCRIPT_NAME}] 显示NEXT`);
    stopNextBtnAnimation();
    $nextBtn.html('NEXT <i class="fa-solid fa-chevron-right"></i>');
  }

  const expression = segment.expression || '默认';
  await SpriteManager.updateSprite($overlay, speaker, expression, expectedRenderToken);
  if (isRenderTokenStale()) return false;

  const sceneToApply = segment.backgroundScene || state.parsedContent?.currentBackground?.scene;
  if (sceneToApply) {
    await SpriteManager.applySceneTint($overlay, sceneToApply);
    if (isRenderTokenStale()) return false;
    console.log(`[${SCRIPT_NAME}] [DEBUG] updateOverlaySegmentDisplay 应用背景: "${sceneToApply}" (段落 ${currentIndex + 1}/${total})`);
  }

  return true;
}

export async function refreshOverlayFromLastAiMessage() {
  if (!getIsEnabled()) return;

  const $allMes = $('#chat > .mes');
  let $lastAiMes = null;
  $allMes.each(function () {
    if ($(this).attr('is_user') !== 'true') {
      $lastAiMes = $(this);
    }
  });

  if (!$lastAiMes || !$lastAiMes.length) {
    console.log(`[${SCRIPT_NAME}] 未找到AI消息`);
    return;
  }

  const mesId = $lastAiMes.attr('mesid');
  let contentToProcess = getFormattedSwipeContent(mesId);
  if (!contentToProcess) {
    contentToProcess = getRawMessageContent(mesId);
  }
  if (!contentToProcess) {
    const $mesText = $lastAiMes.find('.mes_text');
    const html = $mesText.html();
    if (!html) return;
    contentToProcess = decodeHtml(html);
  }

  const hasGalTags = /<(p|sprite|maintext|background)[^>]*>/i.test(contentToProcess);
  if (!hasGalTags) {
    console.log(`[${SCRIPT_NAME}] 最后AI消息不包含Galgame标签`);
    return;
  }

  const parsed = parseGalgameContent(contentToProcess);
  if (parsed.segments.length === 0) return;

  await updateGlobalOverlayContent(mesId, parsed);
  showGlobalOverlay();
  updateLocationTimeDisplay();
}

export async function renderGalgameMessage(mesId, parsedContent) {
  await updateGlobalOverlayContent(mesId, parsedContent);
  showGlobalOverlay();
  updateLocationTimeDisplay();
}

// 延迟引用
let _renderGalgameChoicesRef = null;

export function setOverlayContentRefs({ renderGalgameChoices }) {
  if (renderGalgameChoices) _renderGalgameChoicesRef = renderGalgameChoices;
}
