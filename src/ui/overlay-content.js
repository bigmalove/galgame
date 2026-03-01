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
import { RE_GAL_TAGS, parseGalgameContent } from '../logic/parser.js';
import { applyPixiEffectOps, clearAllPixiEffects, mountPixiEffects, syncPixiEffectsSettings } from '../effects/pixi-effect-manager.js';
import { getCurrentDisplayMesId, setCurrentDisplayMesId, ensureGlobalOverlay, nextOverlayRenderToken, scheduleOverlaySegmentDisplay, showGlobalOverlay } from './overlay.js';
import { updateNextBtnForGeneratingState, stopNextBtnAnimation } from './next-btn.js';

// ============================================
// 覆盖层内容更新
// ============================================

const messageSegmentState = GalgameStore.cache.segments;

async function syncEffectsForSegmentDisplay($overlay, state, currentIndex, { isNewMessage = false } = {}) {
  if (!state) return;
  const settings = getSettings();
  if (!settings.effectsEnabled) {
    clearAllPixiEffects();
    state.lastAppliedEffectIndex = currentIndex;
    return;
  }

  const mounted = await mountPixiEffects($overlay[0]);
  if (!mounted) return;
  syncPixiEffectsSettings();

  const lastApplied = Number.isFinite(state.lastAppliedEffectIndex) ? state.lastAppliedEffectIndex : -1;
  const shouldClearOnSceneChange = !!settings.effectsAutoClearOnSceneChange;
  const shouldAutoClearOnMessageSwitch = isNewMessage;
  const shouldReplay = shouldAutoClearOnMessageSwitch || currentIndex <= lastApplied || lastApplied < 0;

  const clearIfSceneChangedAt = (segmentIndex) => {
    if (!shouldClearOnSceneChange || segmentIndex <= 0) return;
    const prevScene = state.segments[segmentIndex - 1]?.backgroundScene || null;
    const currentScene = state.segments[segmentIndex]?.backgroundScene || null;
    if (currentScene && currentScene !== prevScene) {
      clearAllPixiEffects();
    }
  };

  if (shouldReplay) {
    if (shouldAutoClearOnMessageSwitch || currentIndex <= lastApplied) {
      clearAllPixiEffects();
    }
    for (let i = 0; i <= currentIndex; i++) {
      clearIfSceneChangedAt(i);
      const ops = Array.isArray(state.segments[i]?.effectOps) ? state.segments[i].effectOps : [];
      if (ops.length > 0) {
        await applyPixiEffectOps(ops, $overlay[0]);
      }
    }
  } else {
    for (let i = lastApplied + 1; i <= currentIndex; i++) {
      clearIfSceneChangedAt(i);
      const ops = Array.isArray(state.segments[i]?.effectOps) ? state.segments[i].effectOps : [];
      if (ops.length > 0) {
        await applyPixiEffectOps(ops, $overlay[0]);
      }
    }
  }

  state.lastAppliedEffectIndex = currentIndex;
}

function queueEffectsSyncForSegmentDisplay($overlay, state, currentIndex, options = {}) {
  if (!state) return;

  state.effectSyncTicket = (Number.isFinite(state.effectSyncTicket) ? state.effectSyncTicket : 0) + 1;
  const ticket = state.effectSyncTicket;

  const run = async () => {
    if (ticket !== state.effectSyncTicket) return;
    try {
      await syncEffectsForSegmentDisplay($overlay, state, currentIndex, options);
    } catch (error) {
      console.warn(`[${SCRIPT_NAME}] 特效同步失败`, error);
    }
  };

  const basePromise =
    state.effectSyncPromise && typeof state.effectSyncPromise.then === 'function'
      ? state.effectSyncPromise
      : Promise.resolve();
  state.effectSyncPromise = basePromise.then(run, run);
}

function clearSpritesOnBackgroundCommand($overlay, segment) {
  if (!segment || !Array.isArray(segment.backgroundCommands) || segment.backgroundCommands.length === 0) {
    return false;
  }
  SpriteManager.reset($overlay);
  return true;
}

export async function updateGlobalOverlayContent(mesId, parsedContent, options = {}) {
  console.log(`[${SCRIPT_NAME}] [DEBUG] updateGlobalOverlayContent CALLED for mesId=${mesId}`);
  const $overlay = ensureGlobalOverlay();
  const segments = parsedContent.segments;
  const settings = getSettings();
  const mesIdStr = String(mesId);
  const suppressTTS = !!options.suppressTTS;

  let state = messageSegmentState.get(mesIdStr);
  if (!state) {
    state = {
      currentIndex: 0,
      segments: segments,
      parsedContent: parsedContent,
      renderToken: 0,
      lastAppliedEffectIndex: -1,
      effectSyncTicket: 0,
      effectSyncPromise: Promise.resolve(),
    };
    messageSegmentState.set(mesIdStr, state);
    console.log(`[${SCRIPT_NAME}] [DEBUG] 新建状态，段落数: ${segments.length}`);
  } else {
    const segmentCountDiff = Math.abs(state.segments.length - segments.length);
    if (segmentCountDiff > 5) {
      console.log(`[${SCRIPT_NAME}] [DEBUG] 段落数变化较大 (${state.segments.length} -> ${segments.length})，重置到第一段`);
      state.currentIndex = 0;
      state.lastAppliedEffectIndex = -1;
    }
    state.segments = segments;
    state.parsedContent = parsedContent;
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
    console.log(`[${SCRIPT_NAME}] [DEBUG] 更新状态，当前索引: ${state.currentIndex}, 段落数: ${segments.length}`);
  }

  const isNewMessage = getCurrentDisplayMesId() !== mesIdStr;
  if (isNewMessage) {
    console.log(`[${SCRIPT_NAME}] [DEBUG] 切换消息(${getCurrentDisplayMesId()} -> ${mesIdStr})，保留现有Live2D模型避免重载`);
  }
  setCurrentDisplayMesId(mesIdStr);

  const renderToken = nextOverlayRenderToken(state);
  $overlay.attr('data-render-token', String(renderToken));

  const currentIndex = Math.min(state.currentIndex, segments.length - 1);
  Live2DPreloadManager.preloadFromSegments(segments, currentIndex, 'overlay-content');

  const displaySegment = segments[currentIndex] || { type: 'narration', text: '' };
  const displayText = displaySegment.text || '';
  const speaker = displaySegment.speaker;
  const isNarration = displaySegment.type === 'narration';
  const isCg = displaySegment.type === 'cg';

  const $nameBadge = $overlay.find('.gal-name-badge');

  if (isCg) {
    $nameBadge.find('span').text('CG');
    $nameBadge.removeClass('gal-narrator-label');
    const cgSrc = getCapturedCgImage(mesId, displaySegment.cgIndex);
    if (cgSrc) {
      $overlay.find('.gal-dialog-text').html(
        '<img class="gal-cg-thumbnail" src="' + cgSrc.replace(/"/g, '&quot;') + '" />'
      );
    } else {
      $overlay.find('.gal-dialog-text').text('图片生成中...');
    }
  } else {
    $nameBadge.find('span').text(speaker || '旁白');
    if (isNarration) {
      $nameBadge.addClass('gal-narrator-label');
    } else {
      $nameBadge.removeClass('gal-narrator-label');
    }
    $overlay.find('.gal-dialog-text').text(displayText);
  }

  const total = segments.length;
  const progressPercent = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;
  $overlay.find('.gal-progress-bar').css('width', `${progressPercent}%`);

  await SpriteManager.applySpriteCommands($overlay, displaySegment.spriteCommands, renderToken);
  clearSpritesOnBackgroundCommand($overlay, displaySegment);
  const expression = displaySegment.expression || '默认';
  await SpriteManager.updateSprite($overlay, speaker, expression, renderToken);

  const sceneToApply = displaySegment.backgroundScene || parsedContent.currentBackground?.scene;
  if (sceneToApply) {
    await SpriteManager.applySceneTint($overlay, sceneToApply);
    console.log(`[${SCRIPT_NAME}] [DEBUG] 应用背景场景: "${sceneToApply}" (段落 ${currentIndex + 1}/${segments.length})`);
  }

  queueEffectsSyncForSegmentDisplay($overlay, state, currentIndex, { isNewMessage });

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

  updateLocationTimeDisplay();

  if (isNewMessage && !suppressTTS && settings.ttsEnabled && settings.ttsAutoPlay && !isNarration && !isCg) {
    const segmentId = `${mesIdStr}_${currentIndex}`;
    TTSManager.stop();
    TTSManager.speak(displaySegment, segmentId);
  }

  $overlay.find('.gal-game-container').attr('data-mes-id', mesIdStr);
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
  const isCg = segment.type === 'cg';

  const $nameBadge = $overlay.find('.gal-name-badge');

  if (isCg) {
    $nameBadge.find('span').text('CG');
    $nameBadge.removeClass('gal-narrator-label');
    const mesId = $overlay.find('.gal-game-container').attr('data-mes-id');
    const cgSrc = getCapturedCgImage(mesId, segment.cgIndex);
    if (cgSrc) {
      $overlay.find('.gal-dialog-text').html(
        '<img class="gal-cg-thumbnail" src="' + cgSrc.replace(/"/g, '&quot;') + '" />'
      );
    } else {
      $overlay.find('.gal-dialog-text').text('图片生成中...');
    }
  } else {
    $nameBadge.find('span').text(speaker || '旁白');
    if (isNarration) {
      $nameBadge.addClass('gal-narrator-label');
    } else {
      $nameBadge.removeClass('gal-narrator-label');
    }
    $overlay.find('.gal-dialog-text').text(segment.text || '');
  }

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

  await SpriteManager.applySpriteCommands($overlay, segment.spriteCommands, expectedRenderToken);
  if (isRenderTokenStale()) return false;

  clearSpritesOnBackgroundCommand($overlay, segment);
  const expression = segment.expression || '默认';
  await SpriteManager.updateSprite($overlay, speaker, expression, expectedRenderToken);
  if (isRenderTokenStale()) return false;

  const sceneToApply = segment.backgroundScene || state.parsedContent?.currentBackground?.scene;
  if (sceneToApply) {
    await SpriteManager.applySceneTint($overlay, sceneToApply);
    if (isRenderTokenStale()) return false;
    console.log(`[${SCRIPT_NAME}] [DEBUG] updateOverlaySegmentDisplay 应用背景: "${sceneToApply}" (段落 ${currentIndex + 1}/${total})`);
  }

  queueEffectsSyncForSegmentDisplay($overlay, state, currentIndex);

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

  const hasGalTags = RE_GAL_TAGS.test(contentToProcess);
  if (!hasGalTags) {
    console.log(`[${SCRIPT_NAME}] 最后AI消息不包含Galgame标签`);
    return;
  }

  const parsed = parseGalgameContent(contentToProcess);
  if (parsed.segments.length === 0) return;

  detectAndCaptureCg(mesId, $lastAiMes[0], parsed);

  await updateGlobalOverlayContent(mesId, parsed);
  showGlobalOverlay();
  updateLocationTimeDisplay();
}

export async function renderGalgameMessage(mesId, parsedContent) {
  await updateGlobalOverlayContent(mesId, parsedContent);
  showGlobalOverlay();
  updateLocationTimeDisplay();
}

// ============================================
// CG 图片捕获机制
// ============================================

const capturedCgImages = new Map(); // mesId -> [imgSrc, ...]
const cgObservers = new Map(); // mesId -> MutationObserver

export function getCapturedCgImage(mesId, cgIndex) {
  const images = capturedCgImages.get(String(mesId));
  return images ? images[cgIndex] || null : null;
}

function collectCgImages(mesId, mesTextNode, cgCount) {
  const imgs = mesTextNode.querySelectorAll('.st-chatu8-collapse-content img');
  const sources = Array.from(imgs)
    .map(img => img.src || img.getAttribute('src') || '')
    .filter(src => src && src !== '');

  const existing = capturedCgImages.get(String(mesId)) || [];
  if (sources.length !== existing.length || sources.some((s, i) => s !== existing[i])) {
    capturedCgImages.set(String(mesId), sources);
    refreshCgDisplayIfNeeded(mesId);
  }
}

function refreshCgDisplayIfNeeded(mesId) {
  const $overlay = $('#gal-global-overlay');
  if (!$overlay.length || !$overlay.hasClass('active')) return;

  const currentMesId = $overlay.find('.gal-game-container').attr('data-mes-id');
  if (String(currentMesId) !== String(mesId)) return;

  const state = messageSegmentState.get(String(mesId));
  if (!state) return;

  const currentSegment = state.segments[state.currentIndex];
  if (!currentSegment || currentSegment.type !== 'cg') return;

  const cgSrc = getCapturedCgImage(mesId, currentSegment.cgIndex);
  if (cgSrc) {
    $overlay.find('.gal-dialog-text').html(
      '<img class="gal-cg-thumbnail" src="' + cgSrc.replace(/"/g, '&quot;') + '" />'
    );
  }
}

/**
 * 从 DOM 检测 CG 图片并注入段落
 * 直接扫描 .mes_text 中的 .st-chatu8-collapse-content 容器
 */
export function detectAndCaptureCg(mesId, mesNode, parsed) {
  const mesText = mesNode.querySelector ? mesNode.querySelector('.mes_text') : $(mesNode).find('.mes_text')[0];
  if (!mesText) return 0;

  const containers = mesText.querySelectorAll('.st-chatu8-collapse-content');
  if (containers.length === 0) return 0;

  const mesIdStr = String(mesId);

  // 立即抓取图片 src
  const sources = [];
  containers.forEach((container, i) => {
    const img = container.querySelector('img');
    const src = img ? (img.src || '') : '';
    sources.push(src);
  });
  capturedCgImages.set(mesIdStr, sources.filter(s => s));

  // 确定 CG 在 DOM 中的位置，按 <p> 兄弟顺序插入
  const cgParentPs = new Set();
  containers.forEach(c => {
    const p = c.closest('p');
    if (p) cgParentPs.add(p);
  });

  // 移除旧 CG 段落（避免缓存重复）
  const baseSegments = parsed.segments.filter(s => s.type !== 'cg');

  // 遍历 .mes_text 下的 <p>，按顺序交织普通段落和 CG 段落
  const allPs = mesText.querySelectorAll(':scope > p');
  let regularIdx = 0;
  let cgIdx = 0;
  const merged = [];

  allPs.forEach(p => {
    if (cgParentPs.has(p)) {
      const prevScene = merged.length > 0 ? merged[merged.length - 1].backgroundScene : null;
      merged.push({ type: 'cg', speaker: null, text: '', expression: null, cgIndex: cgIdx++, backgroundScene: prevScene });
    } else {
      if (regularIdx < baseSegments.length) {
        merged.push(baseSegments[regularIdx++]);
      }
    }
  });
  // 追加剩余段落（如长段落切分产生的额外段落）
  while (regularIdx < baseSegments.length) {
    merged.push(baseSegments[regularIdx++]);
  }

  parsed.segments = merged;

  // MutationObserver 监听异步图片加载
  if (cgObservers.has(mesIdStr)) {
    cgObservers.get(mesIdStr).disconnect();
  }
  const observer = new MutationObserver(() => {
    collectCgImages(mesIdStr, mesText, containers.length);
  });
  observer.observe(mesText, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });
  cgObservers.set(mesIdStr, observer);

  return cgIdx;
}

// 延迟引用
let _renderGalgameChoicesRef = null;

export function setOverlayContentRefs({ renderGalgameChoices }) {
  if (renderGalgameChoices) _renderGalgameChoicesRef = renderGalgameChoices;
}
