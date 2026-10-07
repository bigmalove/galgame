import { BGMManager } from '../audio/bgm-manager.js';
import { SCRIPT_NAME } from '../core/constants.js';
import { $, topWindow } from '../core/env.js';
import { getSettings } from '../core/settings.js';
import { getHideOtherFloors, getIsEnabled, getPendingOptions } from '../core/state.js';
import { GalgameStore } from '../core/store.js';
import { handleWallhavenBackgroundSearch } from '../image-gen/wallhaven-handler.js';
import { Live2DPreloadManager } from '../live2d/preload.js';
import { parseGalgameContent, RE_GAL_TAGS, stripImagePlaceholders } from '../logic/parser.js';
import { consumePendingSpecialCgByScene } from '../logic/special-cg-trigger.js';
import { handleSpriteAssignments } from '../logic/sprite-auto-assign.js';
import { markTimelineCacheDirty } from '../timeline/data.js';
import { getFormattedSwipeContent, getMesTextContentForGalgame, getRawMessageContent } from '../utils/html.js';
import { renderBGMWidget } from './bgm-widget.js';
import { hideNonLastFloors, showAllFloors } from './galgame-mode.js';
import { injectGalgameButton } from './menu-button.js';
import { detectAndCaptureCg, invalidatePresentedSegment } from './overlay-content.js';
import { adjustToolbarForSpace, ensureGlobalOverlay, showGeneratingIndicator, showGlobalOverlay } from './overlay.js';
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

// 流式输出时末尾还没写完的 <p> / <styled>：解析器会把半截也当成一段，每次刷新这段文字都在变，
// 读者停在这里时打字机会反复重打（半截的简化对白还会被当成旁白显示）。流式刷新时先截掉，写完再显示
const RE_CLOSING_BLOCK_TAG = /<\/(?:p|styled)\s*>/gi;
const RE_OPENING_BLOCK_TAG = /<p(?:\s[^>]*)?>|<styled\b/i;

function trimUnclosedStreamingTail(content) {
  const text = String(content || '');
  let cut = -1;
  for (const match of text.matchAll(RE_CLOSING_BLOCK_TAG)) cut = match.index + match[0].length;
  if (cut < 0) return text;
  return RE_OPENING_BLOCK_TAG.test(text.slice(cut)) ? text.slice(0, cut) : text;
}

// 段落身份：CG 按编号，其它按类型 + 说话人 + 正文
function getSegmentIdentity(segment) {
  if (!segment) return '';
  if (segment.type === 'cg') return `cg:${segment.cgIndex}`;
  return JSON.stringify([segment.type, segment.speaker || null, segment.text || '']);
}

// 在新段落列表里找回读者原来所在的段（同一身份出现多次时取离原下标最近的一处）；找不到返回 -1
function findSegmentByIdentity(segments, anchor, nearIndex) {
  const identity = getSegmentIdentity(anchor);
  if (!identity) return -1;
  let best = -1;
  segments.forEach((segment, index) => {
    if (getSegmentIdentity(segment) !== identity) return;
    if (best < 0 || Math.abs(index - nearIndex) < Math.abs(best - nearIndex)) best = index;
  });
  return best;
}

function buildFallbackParsed(text) {
  const cleanText = stripImagePlaceholders(String(text || '')).trim();
  return {
    segments: [{ type: 'narration', speaker: null, text: cleanText || '（当前消息无可显示内容）', expression: null }],
    currentBackground: null,
    bgm: null,
    options: [],
  };
}

function renderFallbackOverlay(mesId, text) {
  cancelTypewriter();
  invalidatePresentedSegment();
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
  // keepPresentedSegment：流式输出 / 生成结束的刷新，读者所在段落没变时保持原样（见 updateGlobalOverlayContent）
  // streaming：流式期间的刷新，解析前截掉末尾未写完的段落
  const { forceRender = false, keepPresentedSegment = false, streaming = false } = options || {};
  injectGalgameButton(mesNode);
  if (!getIsEnabled()) return;

  const $mes = $(mesNode);
  const isUser = $mes.attr('is_user') === 'true';
  if (isUser) return;

  const mesId = $mes.attr('mesid');
  const settings = getSettings();
  const simpleStorybookMode = settings.simpleStorybookMode === true;

  const $mesText = $mes.find('.mes_text');
  const domVisibleContent = getMesTextContentForGalgame($mesText[0]);

  let contentToProcess = getFormattedSwipeContent(mesId);
  if (!contentToProcess) {
    const rawMessageContent = getRawMessageContent(mesId);
    if (rawMessageContent) {
      if (RE_GAL_TAGS.test(rawMessageContent)) {
        contentToProcess = rawMessageContent;
      } else if (/<[a-z][\s\S]*?>/i.test(rawMessageContent) && domVisibleContent) {
        contentToProcess = domVisibleContent;
      } else {
        contentToProcess = rawMessageContent;
      }
    }
  }
  if (!contentToProcess) {
    if (!domVisibleContent) {
      if (!forceRender) return;
      contentToProcess = String($mesText.text() || '').trim();
    } else {
      contentToProcess = domVisibleContent;
    }
  }

  const hasGalTags = RE_GAL_TAGS.test(contentToProcess);
  if (!simpleStorybookMode && settings.smartDetection && !hasGalTags && !forceRender) return;

  const hasClosedP = RE_CLOSED_P.test(contentToProcess);
  if (!simpleStorybookMode && !hasClosedP && !forceRender) {
    console.log(`[${SCRIPT_NAME}] 流式输出中，等待完整内容...`);
    const loadingParsed = buildFallbackParsed('生成中...');
    const isLastAi = $mes.nextAll('.mes[is_user!="true"]').length === 0;
    if (isLastAi) {
      let placeholderOnScreen = true;
      if (_updateGlobalOverlayContentRef) {
        try {
          await _updateGlobalOverlayContentRef(mesId, loadingParsed, { keepPresentedSegment });
          // 流式刷新会并发：等待渲染期间若已有正文上屏，就不要再把「生成中」指示器打开
          placeholderOnScreen = messageSegmentState.get(String(mesId))?.parsedContent === loadingParsed;
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
      if (placeholderOnScreen) showGeneratingIndicator('正在生成内容...');
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
    parsed = parseGalgameContent(streaming ? trimUnclosedStreamingTail(contentToProcess) : contentToProcess);
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

  // AI 自动分配立绘：仅消费最后一条 AI 消息（防历史楼层重渲重复写库），内部幂等
  if (
    !simpleStorybookMode &&
    settings.autoSpriteAssignEnabled !== false &&
    parsed &&
    Array.isArray(parsed.spriteAssignments) &&
    parsed.spriteAssignments.length > 0 &&
    $mes.nextAll('.mes[is_user!="true"]').length === 0
  ) {
    handleSpriteAssignments(parsed.spriteAssignments, { mesId });
  }

  // 实时背景生成处理 (根据 bgImageSource 单选分派)
  if (parsed && parsed.backgroundChanges) {
    const bgSrc = settings.bgImageSource || 'none';
    if (bgSrc !== 'chatu8') {
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
  }

  // CG 图片：从 DOM 检测 st-chatu8 渲染的图片
  try {
    detectAndCaptureCg(mesId, mesNode, parsed);
  } catch (error) {
    console.warn(`[${SCRIPT_NAME}] CG 检测失败`, error);
  }

  console.log(`[${SCRIPT_NAME}] [DEBUG] processNewMessage 解析完成. Segments: ${parsed?.segments?.length || 0}`);

  if (!parsed || parsed.segments.length === 0) {
    if (simpleStorybookMode || !settings.smartDetection || forceRender) {
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
    // 按段落身份保留阅读位置：智绘姬出图时 CG 段会插入 / 被 CG 监听挪到当前段之后，
    // 只保留数字下标会让读者看到的段落来回切换（反复跳段、打字机重打）
    const prevSegments = Array.isArray(state.segments) ? state.segments : [];
    const prevIndex = Math.max(0, Math.min(Number(state.currentIndex) || 0, prevSegments.length - 1));
    const anchorIndex = findSegmentByIdentity(parsed.segments, prevSegments[prevIndex], prevIndex);
    state.segments = parsed.segments;
    state.parsedContent = parsed;
    if (!Number.isFinite(state.renderToken)) {
      state.renderToken = 0;
    }
    if (anchorIndex >= 0) {
      state.currentIndex = anchorIndex;
    } else if (state.currentIndex >= parsed.segments.length) {
      state.currentIndex = parsed.segments.length - 1;
    }
  }

  markTimelineCacheDirty();

  if (!simpleStorybookMode) {
    Live2DPreloadManager.preloadFromSegments(parsed.segments, state.currentIndex, 'process-message');
  }

  const isLastAi = $mes.nextAll('.mes[is_user!="true"]').length === 0;
  if (isLastAi) {
    const fallbackText = stripImagePlaceholders(String($mes.find('.mes_text').text() || '')).trim() || '（当前消息无可显示内容）';

    if (_updateGlobalOverlayContentRef) {
      try {
        await _updateGlobalOverlayContentRef(mesId, parsed, { keepPresentedSegment });
        showGlobalOverlay();

        topWindow.requestAnimationFrame(() => {
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
