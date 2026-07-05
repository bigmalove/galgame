import { TTSManager } from '../audio/tts-manager.js';
import { SCRIPT_NAME } from '../core/constants.js';
import { $ } from '../core/env.js';
import { getCurrentCharacterName, getSettings } from '../core/settings.js';
import { getGalgameChoicesVisible, getIsEnabled, getPendingOptions } from '../core/state.js';
import { GalgameStore } from '../core/store.js';
import { setBackgroundWithTransition } from '../db/image-packs.js';
import { applyPixiEffectOps, clearAllPixiEffects, mountPixiEffects, syncPixiEffectsSettings } from '../effects/pixi-effect-manager.js';
import { Live2DPreloadManager } from '../live2d/preload.js';
import { checkSillyTavernGenerating, getIsGeneratingResponse, resetGenerationState } from '../logic/generation-state.js';
import { RE_GAL_TAGS, getMeasuredSegLength, parseGalgameContent, setMeasuredSegLength } from '../logic/parser.js';
import { SpriteManager } from '../sprite/sprite-manager.js';
import { resolveCharacterIdByKeywords } from '../utils/character-name-keywords.js';
import { getFormattedSwipeContent, getMesTextContentForGalgame, getRawMessageContent } from '../utils/html.js';
import { updateLocationTimeDisplay } from '../utils/location-time.js';
import { stopNextBtnAnimation, updateNextBtnForGeneratingState } from './next-btn.js';
import { ensureGlobalOverlay, getCurrentDisplayMesId, hideGeneratingIndicator, nextOverlayRenderToken, setCurrentDisplayMesId, showGlobalOverlay } from './overlay.js';
import { hideStyledStage, showStyledStage } from './styled-fx.js';
import { showToast } from './toast.js';
import { cancelTypewriter, renderTypewriterText } from './typewriter.js';

// ============================================
// 覆盖层内容更新
// ============================================

const messageSegmentState = GalgameStore.cache.segments;
const TYPEWRITER_INSTANT_SOURCES = new Set(['skip', 'rewind', 'auto-play']);
const DEFAULT_TWILIGHT_BRAND = 'TWILIGHT';

function shouldUseTypewriterForSegment(segment) {
  return segment?.type === 'dialogue' || segment?.type === 'narration';
}

function isCgAsBackgroundEnabled() {
  return getSettings().cgAsBackground === true;
}

// CG 直接铺到背景层（cgAsBackground 开启时）
function applyCgToBackground($overlay, cgSrc) {
  const $bgLayer = $overlay.find('.gal-layer-bg');
  $bgLayer.addClass('has-bg').removeClass('generating-bg');
  setBackgroundWithTransition($bgLayer, cgSrc);
  // 背景层被 CG 覆写，清掉场景缓存，离开 CG 段后场景背景才能重新应用
  SpriteManager.currentScene = null;
}

// 渲染 CG 段的对话框内容；返回是否已把 CG 应用为背景
function renderCgSegment($overlay, cgSrc) {
  if (!cgSrc) {
    $overlay.find('.gal-dialog-text').text('图片生成中...');
    return false;
  }
  if (isCgAsBackgroundEnabled()) {
    $overlay.find('.gal-dialog-text').text('');
    applyCgToBackground($overlay, cgSrc);
    return true;
  }
  $overlay.find('.gal-dialog-text').html(
    '<img class="gal-cg-thumbnail" src="' + cgSrc.replace(/"/g, '&quot;') + '" />'
  );
  return false;
}

function shouldForceInstantBySource(source) {
  return TYPEWRITER_INSTANT_SOURCES.has(String(source || ''));
}

function syncTwilightBrandText($overlay) {
  if (!$overlay?.length) return;
  const nextBrand = getCurrentCharacterName() || DEFAULT_TWILIGHT_BRAND;
  const $brand = $overlay.find('.gal-twilight-brand');
  if ($brand.length) {
    $brand.text(nextBrand);
  }
}

// ============================================
// Styled 内容 HTML 渲染
// ============================================
function renderStyledContent(segment) {
  const type = segment.styleType || '';
  const lines = segment.styledLines || [];
  const from = segment.styledFrom || '';
  const to = segment.styledTo || '';
  const title = segment.styledTitle || '';
  const date = segment.styledDate || '';

  const escHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  if (type === '手机短信' || type === 'sms' || type === '微信' || type === 'wechat') {
    // 手机短信/微信风格
    const selfName = to || '我';
    let html = '<div class="gal-styled gal-styled-sms">';
    html += '<div class="gal-sms-header">';
    html += `<span class="gal-sms-contact">${escHtml(from || '未知联系人')}</span>`;
    if (date) html += `<span class="gal-sms-time">${escHtml(date)}</span>`;
    html += '</div>';
    html += '<div class="gal-sms-body">';
    for (const line of lines) {
      const sender = line.sender;
      const isSelf = sender === selfName || sender === '我' || sender === to;
      const bubbleClass = isSelf ? 'gal-sms-bubble-self' : 'gal-sms-bubble-other';
      const displayName = sender || from || '';
      html += `<div class="gal-sms-row ${isSelf ? 'gal-sms-row-self' : 'gal-sms-row-other'}">`;
      if (!isSelf && displayName) html += `<span class="gal-sms-name">${escHtml(displayName)}</span>`;
      html += `<div class="${bubbleClass}">${escHtml(line.text)}</div>`;
      html += '</div>';
    }
    html += '</div></div>';
    return html;
  }

  if (type === '信纸' || type === 'letter') {
    let html = '<div class="gal-styled gal-styled-letter">';
    if (to || from) {
      html += '<div class="gal-letter-header">';
      if (to) html += `<span class="gal-letter-to">致 ${escHtml(to)}</span>`;
      if (date) html += `<span class="gal-letter-date">${escHtml(date)}</span>`;
      html += '</div>';
    }
    html += '<div class="gal-letter-body">';
    for (const line of lines) {
      html += `<p class="gal-letter-line">${escHtml(line.text)}</p>`;
    }
    html += '</div>';
    if (from) html += `<div class="gal-letter-signature">—— ${escHtml(from)}</div>`;
    html += '</div>';
    return html;
  }

  if (type === '羊皮纸' || type === 'parchment' || type === '古卷') {
    let html = '<div class="gal-styled gal-styled-parchment">';
    if (title) html += `<div class="gal-parchment-title">${escHtml(title)}</div>`;
    html += '<div class="gal-parchment-body">';
    for (const line of lines) {
      html += `<p class="gal-parchment-line">${escHtml(line.text)}</p>`;
    }
    html += '</div>';
    if (from) html += `<div class="gal-parchment-seal">${escHtml(from)}</div>`;
    html += '</div>';
    return html;
  }

  if (type === '新闻' || type === '报纸' || type === 'newspaper' || type === 'news') {
    let html = '<div class="gal-styled gal-styled-newspaper">';
    if (title) html += `<div class="gal-newspaper-headline">${escHtml(title)}</div>`;
    if (date || from) {
      html += '<div class="gal-newspaper-meta">';
      if (from) html += `<span class="gal-newspaper-source">${escHtml(from)}</span>`;
      if (date) html += `<span class="gal-newspaper-date">${escHtml(date)}</span>`;
      html += '</div>';
    }
    html += '<div class="gal-newspaper-body">';
    for (const line of lines) {
      html += `<p class="gal-newspaper-paragraph">${escHtml(line.text)}</p>`;
    }
    html += '</div>';
    html += '</div>';
    return html;
  }

  if (type === '电脑屏幕' || type === '终端' || type === 'terminal' || type === 'computer') {
    let html = '<div class="gal-styled gal-styled-terminal">';
    html += '<div class="gal-terminal-titlebar">';
    html += '<span class="gal-terminal-dots"><i></i><i></i><i></i></span>';
    html += `<span class="gal-terminal-title">${escHtml(title || 'Terminal')}</span>`;
    html += '</div>';
    html += '<div class="gal-terminal-body">';
    for (const line of lines) {
      const prefix = line.sender ? `<span class="gal-terminal-prompt">${escHtml(line.sender)}$</span> ` : '<span class="gal-terminal-prompt">></span> ';
      html += `<div class="gal-terminal-line">${prefix}${escHtml(line.text)}</div>`;
    }
    html += '<span class="gal-terminal-cursor">_</span>';
    html += '</div></div>';
    return html;
  }

  if (type === '便签' || type === '纸条' || type === 'note' || type === 'sticky') {
    let html = '<div class="gal-styled gal-styled-note">';
    html += '<div class="gal-note-body">';
    for (const line of lines) {
      html += `<p class="gal-note-line">${escHtml(line.text)}</p>`;
    }
    html += '</div>';
    if (from) html += `<div class="gal-note-sign">— ${escHtml(from)}</div>`;
    html += '</div>';
    return html;
  }

  if (type === '日记' || type === 'diary' || type === 'journal') {
    let html = '<div class="gal-styled gal-styled-diary">';
    html += '<div class="gal-diary-header">';
    if (date) html += `<span class="gal-diary-date">${escHtml(date)}</span>`;
    if (title) html += `<span class="gal-diary-mood">${escHtml(title)}</span>`;
    html += '</div>';
    html += '<div class="gal-diary-body">';
    for (const line of lines) {
      html += `<p class="gal-diary-line">${escHtml(line.text)}</p>`;
    }
    html += '</div>';
    html += '</div>';
    return html;
  }

  if (type === '公告' || type === '通知' || type === 'bulletin' || type === 'notice') {
    let html = '<div class="gal-styled gal-styled-bulletin">';
    html += '<div class="gal-bulletin-header">';
    html += `<span class="gal-bulletin-icon">📢</span>`;
    html += `<span class="gal-bulletin-title">${escHtml(title || '公告')}</span>`;
    html += '</div>';
    if (from || date) {
      html += '<div class="gal-bulletin-meta">';
      if (from) html += `<span>${escHtml(from)}</span>`;
      if (date) html += `<span>${escHtml(date)}</span>`;
      html += '</div>';
    }
    html += '<div class="gal-bulletin-body">';
    for (const line of lines) {
      html += `<p class="gal-bulletin-line">${escHtml(line.text)}</p>`;
    }
    html += '</div>';
    html += '</div>';
    return html;
  }

  // 未知类型回退: 简单展示
  let html = `<div class="gal-styled gal-styled-fallback">`;
  if (title) html += `<div class="gal-styled-fallback-title">${escHtml(title)}</div>`;
  for (const line of lines) {
    html += `<p>${escHtml(line.text)}</p>`;
  }
  html += '</div>';
  return html;
}

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

function setStyledPresentationMode($overlay, enabled) {
  if (!$overlay || !$overlay.length) return;
  $overlay.toggleClass('gal-mode-styled', !!enabled);
}

export async function updateGlobalOverlayContent(mesId, parsedContent, options = {}) {
  console.log(`[${SCRIPT_NAME}] [DEBUG] updateGlobalOverlayContent CALLED for mesId=${mesId}`);
  const $overlay = ensureGlobalOverlay();
  const segments = parsedContent.segments;
  const settings = getSettings();
  const simpleStorybookMode = settings.simpleStorybookMode === true;
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
  } else if (options.preserveIndex) {
    // 字号重分页等场景：保留阅读位置（调用方已映射好 currentIndex），只做越界保护
    state.currentIndex = Math.max(0, Math.min(state.currentIndex, segments.length - 1));
    state.lastAppliedEffectIndex = -1;
    state.segments = segments;
    state.parsedContent = parsedContent;
    if (!Number.isFinite(state.renderToken)) {
      state.renderToken = 0;
    }
    if (!Number.isFinite(state.effectSyncTicket)) {
      state.effectSyncTicket = 0;
    }
    if (!state.effectSyncPromise || typeof state.effectSyncPromise.then !== 'function') {
      state.effectSyncPromise = Promise.resolve();
    }
    console.log(`[${SCRIPT_NAME}] [DEBUG] 重分页保留阅读位置，索引: ${state.currentIndex}, 段落数: ${segments.length}`);
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
  if (simpleStorybookMode) {
    SpriteManager.reset($overlay);
  } else {
    Live2DPreloadManager.preloadFromSegments(segments, currentIndex, 'overlay-content');
  }

  const displaySegment = segments[currentIndex] || { type: 'narration', text: '' };
  const displayText = displaySegment.text || '';
  const speaker = displaySegment.speaker;
  const resolvedSpeaker = resolveCharacterIdByKeywords(speaker) || speaker;
  const isNarration = displaySegment.type === 'narration';
  const isCg = displaySegment.type === 'cg';

  const $nameBadge = $overlay.find('.gal-name-badge');
  const isStyled = displaySegment.type === 'styled';
  cancelTypewriter();
  syncTwilightBrandText($overlay);

  let cgAppliedAsBackground = false;
  if (isCg) {
    setStyledPresentationMode($overlay, false);
    hideStyledStage($overlay);
    $nameBadge.find('span').text('CG');
    $nameBadge.removeClass('gal-narrator-label');
    const cgSrc = getCapturedCgImage(mesId, displaySegment.cgIndex);
    cgAppliedAsBackground = renderCgSegment($overlay, cgSrc);
  } else if (isStyled) {
    setStyledPresentationMode($overlay, true);
    const styledLabel = {
      '手机短信': '📱 短信', 'sms': '📱 SMS', '微信': '📱 微信', 'wechat': '📱 WeChat',
      '信纸': '✉️ 信件', 'letter': '✉️ Letter',
      '羊皮纸': '📜 古卷', 'parchment': '📜 Parchment', '古卷': '📜 古卷',
      '新闻': '📰 新闻', '报纸': '📰 报纸', 'newspaper': '📰 News', 'news': '📰 News',
      '电脑屏幕': '💻 终端', '终端': '💻 终端', 'terminal': '💻 Terminal', 'computer': '💻 Computer',
      '便签': '📌 便签', '纸条': '📌 纸条', 'note': '📌 Note', 'sticky': '📌 Sticky',
      '日记': '📖 日记', 'diary': '📖 Diary', 'journal': '📖 Journal',
      '公告': '📢 公告', '通知': '📢 通知', 'bulletin': '📢 Bulletin', 'notice': '📢 Notice',
    }[displaySegment.styleType] || displaySegment.styleType;
    $nameBadge.find('span').text(styledLabel);
    $nameBadge.removeClass('gal-narrator-label');
    const styledHtml = renderStyledContent(displaySegment);
    $overlay.find('.gal-dialog-text').text('');
    showStyledStage($overlay, styledHtml, displaySegment.styleType);
  } else {
    setStyledPresentationMode($overlay, false);
    hideStyledStage($overlay);
    $nameBadge.find('span').text(resolvedSpeaker || '旁白');
    if (isNarration) {
      $nameBadge.addClass('gal-narrator-label');
    } else {
      $nameBadge.removeClass('gal-narrator-label');
    }
    const enableTypewriter = shouldUseTypewriterForSegment(displaySegment);
    renderTypewriterText($overlay.find('.gal-dialog-text'), displayText, {
      instant: !enableTypewriter,
    });
  }

  const total = segments.length;
  const progressPercent = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;
  $overlay.find('.gal-progress-bar').css('width', `${progressPercent}%`);

  if (!simpleStorybookMode) {
    await SpriteManager.applySpriteCommands($overlay, displaySegment.spriteCommands, renderToken);
    clearSpritesOnBackgroundCommand($overlay, displaySegment);
    const expression = displaySegment.expression || '默认';
    const voiceHint = /^(男声|女声)$/.test(displaySegment.tts?.speaker || '') ? displaySegment.tts.speaker : null;
    await SpriteManager.updateSprite($overlay, resolvedSpeaker, expression, renderToken, voiceHint);
  }

  const sceneToApply = displaySegment.backgroundScene || parsedContent.currentBackground?.scene;
  if (sceneToApply && !cgAppliedAsBackground) {
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

  // 内容已上屏，收起「生成中」指示器（重绘/新生成期间由 showGeneratingIndicator 打开）
  hideGeneratingIndicator();

  // 渲染完成后刷新对话框容量实测值；若与本次分页所用字数偏差较大，自动按实测容量重排
  refreshMeasuredDialogCapacity();
  maybeAutoRepaginate(parsedContent);
}

// 实测容量明显大于本次分页字数时自动重排（首次渲染前测不到尺寸，只能渲染后补测重排）。
// 只放大不缩小：面板高度随内容自适应时，内容少→面板矮→实测小，向下重排会形成恶性循环
let _autoRepagInFlight = false;
function maybeAutoRepaginate(parsedContent) {
  if (_autoRepagInFlight) return;
  const measured = getMeasuredSegLength();
  const usedLen = Number(parsedContent?.segLength) || 0;
  if (!measured || !usedLen) return;
  if (measured <= usedLen * 1.3) return;

  _autoRepagInFlight = true;
  setTimeout(() => {
    repaginateCurrentMessageForFontChange()
      .catch(e => console.warn(`[${SCRIPT_NAME}] 自动重分页失败`, e))
      .finally(() => { _autoRepagInFlight = false; });
  }, 0);
}

export async function updateOverlaySegmentDisplay(state, expectedRenderToken = null, source = 'unknown') {
  if (!state) return false;

  const isRenderTokenStale = () =>
    expectedRenderToken !== null && expectedRenderToken !== (Number(state.renderToken) || 0);
  if (isRenderTokenStale()) return false;

  const $overlay = $('#gal-global-overlay');
  const simpleStorybookMode = getSettings().simpleStorybookMode === true;
  const currentIndex = state.currentIndex;
  const segment = state.segments[currentIndex];
  if (!segment) return false;

  if (!simpleStorybookMode) {
    Live2DPreloadManager.preloadFromSegments(state.segments, currentIndex, 'segment-display');
  }

  if (expectedRenderToken !== null) {
    $overlay.attr('data-render-token', String(expectedRenderToken));
  }

  const speaker = segment.speaker;
  const resolvedSpeaker = resolveCharacterIdByKeywords(speaker) || speaker;
  const isNarration = segment.type === 'narration';
  const isCg = segment.type === 'cg';
  const forceInstantRender = shouldForceInstantBySource(source);

  const $nameBadge = $overlay.find('.gal-name-badge');
  cancelTypewriter();
  syncTwilightBrandText($overlay);

  let cgAppliedAsBackground = false;
  if (isCg) {
    setStyledPresentationMode($overlay, false);
    hideStyledStage($overlay);
    $nameBadge.find('span').text('CG');
    $nameBadge.removeClass('gal-narrator-label');
    const mesId = $overlay.find('.gal-game-container').attr('data-mes-id');
    const cgSrc = getCapturedCgImage(mesId, segment.cgIndex);
    cgAppliedAsBackground = renderCgSegment($overlay, cgSrc);
  } else if (segment.type === 'styled') {
    setStyledPresentationMode($overlay, true);
    const styledLabel = {
      '手机短信': '📱 短信', 'sms': '📱 SMS', '微信': '📱 微信', 'wechat': '📱 WeChat',
      '信纸': '✉️ 信件', 'letter': '✉️ Letter',
      '羊皮纸': '📜 古卷', 'parchment': '📜 Parchment', '古卷': '📜 古卷',
      '新闻': '📰 新闻', '报纸': '📰 报纸', 'newspaper': '📰 News', 'news': '📰 News',
      '电脑屏幕': '💻 终端', '终端': '💻 终端', 'terminal': '💻 Terminal', 'computer': '💻 Computer',
      '便签': '📌 便签', '纸条': '📌 纸条', 'note': '📌 Note', 'sticky': '📌 Sticky',
      '日记': '📖 日记', 'diary': '📖 Diary', 'journal': '📖 Journal',
      '公告': '📢 公告', '通知': '📢 通知', 'bulletin': '📢 Bulletin', 'notice': '📢 Notice',
    }[segment.styleType] || segment.styleType;
    $nameBadge.find('span').text(styledLabel);
    $nameBadge.removeClass('gal-narrator-label');
    const styledHtml = renderStyledContent(segment);
    $overlay.find('.gal-dialog-text').text('');
    showStyledStage($overlay, styledHtml, segment.styleType);
  } else {
    setStyledPresentationMode($overlay, false);
    hideStyledStage($overlay);
    $nameBadge.find('span').text(resolvedSpeaker || '旁白');
    if (isNarration) {
      $nameBadge.addClass('gal-narrator-label');
    } else {
      $nameBadge.removeClass('gal-narrator-label');
    }
    renderTypewriterText($overlay.find('.gal-dialog-text'), segment.text || '', {
      instant: forceInstantRender || !shouldUseTypewriterForSegment(segment),
    });
  }

  const total = state.segments.length;
  const progressPercent = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;
  $overlay.find('.gal-progress-bar').css('width', `${progressPercent}%`);

  const isEnd = currentIndex >= total - 1;
  const $nextBtn = $overlay.find('[data-action="next"]');
  const $twilightNextIndicator = $overlay.find('.gal-twilight-dialog-next-indicator');
  console.log(`[${SCRIPT_NAME}] 更新NEXT按钮 - isEnd=${isEnd}, isGeneratingResponse=${getIsGeneratingResponse()}`);

  if ($twilightNextIndicator.length) {
    if (isEnd) {
      $twilightNextIndicator.attr('data-state', 'end');
      $twilightNextIndicator.html('<i class="fa-solid fa-flag-checkered"></i>');
    } else {
      $twilightNextIndicator.attr('data-state', 'next');
      $twilightNextIndicator.html('<i class="fa-solid fa-chevron-down"></i>');
    }
  }

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

  if (!simpleStorybookMode) {
    await SpriteManager.applySpriteCommands($overlay, segment.spriteCommands, expectedRenderToken);
    if (isRenderTokenStale()) return false;

    clearSpritesOnBackgroundCommand($overlay, segment);
    const expression = segment.expression || '默认';
    const voiceHint = /^(男声|女声)$/.test(segment.tts?.speaker || '') ? segment.tts.speaker : null;
    await SpriteManager.updateSprite($overlay, resolvedSpeaker, expression, expectedRenderToken, voiceHint);
    if (isRenderTokenStale()) return false;
  }

  const sceneToApply = segment.backgroundScene || state.parsedContent?.currentBackground?.scene;
  if (sceneToApply && !cgAppliedAsBackground) {
    await SpriteManager.applySceneTint($overlay, sceneToApply);
    if (isRenderTokenStale()) return false;
    console.log(`[${SCRIPT_NAME}] [DEBUG] updateOverlaySegmentDisplay 应用背景: "${sceneToApply}" (段落 ${currentIndex + 1}/${total})`);
  }

  queueEffectsSyncForSegmentDisplay($overlay, state, currentIndex);

  return true;
}

// 实测对话框每页可容纳的字符数（Pretext 式：按真实字体渲染测量行高与每行字数）
function measureDialogCapacityChars() {
  const overlay = $('#gal-global-overlay')[0];
  if (!overlay) return null;
  const panel = overlay.querySelector('.gal-text-panel');
  const textEl = overlay.querySelector('.gal-dialog-text');
  if (!panel || !textEl) return null;

  const win = panel.ownerDocument.defaultView;
  const panelRect = panel.getBoundingClientRect();
  if (panelRect.width < 60 || panelRect.height < 40) return null;

  const cs = win.getComputedStyle(panel);
  const textCs = win.getComputedStyle(textEl);
  const availW = panel.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  // 可用高度还要扣掉文本区自身的上下 padding（皮肤自带 + 用户头/尾间距设置）
  const availH = panel.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0)
    - (parseFloat(textCs.paddingTop) || 0) - (parseFloat(textCs.paddingBottom) || 0);
  if (availW <= 0 || availH <= 0) return null;

  // 探针继承 .gal-dialog-text 的皮肤字体样式，在真实宽度下测量（padding 已在 availH 中扣除，探针清零以免混入行高）
  const probe = textEl.cloneNode(false);
  probe.style.cssText += ';position:absolute !important;visibility:hidden !important;pointer-events:none !important;left:-9999px !important;top:0 !important;'
    + `width:${availW}px !important;height:auto !important;max-height:none !important;min-height:0 !important;overflow:visible !important;margin:0 !important;padding-top:0 !important;padding-bottom:0 !important;`;
  panel.appendChild(probe);
  try {
    probe.textContent = '测';
    const singleRect = probe.getBoundingClientRect();
    const lineH = singleRect.height > 0 ? singleRect.height : (parseFloat(win.getComputedStyle(probe).lineHeight) || 24);
    if (!Number.isFinite(lineH) || lineH <= 0) return null;

    const maxLines = Math.max(1, Math.floor(availH / lineH));

    // 用整行 CJK 字符测每行字数（二分比逐字快）
    const FILLER = '测';
    let lo = 4, hi = 400;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      probe.textContent = FILLER.repeat(mid);
      if (probe.getBoundingClientRect().height <= lineH * 1.5) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    const charsPerLine = Math.max(4, lo);

    // 0.9 安全系数：标点/换行/西文混排会让实际容纳量低于纯 CJK 理论值
    return Math.floor(maxLines * charsPerLine * 0.9);
  } finally {
    probe.remove();
  }
}

// 测量当前对话框容量并同步给 parser（供后续 parseGalgameContent 分页使用）
export function refreshMeasuredDialogCapacity() {
  try {
    setMeasuredSegLength(measureDialogCapacityChars());
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 对话框容量测量失败`, e);
    setMeasuredSegLength(null);
  }
}

function resolveGalgameContentForMes($mes, mesId) {
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
    contentToProcess = domVisibleContent;
  }
  return contentToProcess || null;
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
  const contentToProcess = resolveGalgameContentForMes($lastAiMes, mesId);
  if (!contentToProcess) return;

  const hasGalTags = RE_GAL_TAGS.test(contentToProcess);
  const simpleStorybookMode = getSettings().simpleStorybookMode === true;
  if (!hasGalTags && !simpleStorybookMode) {
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

// 字号变化后按新的每页字数重新分页当前消息，并按比例保留阅读位置
export async function repaginateCurrentMessageForFontChange() {
  if (!getIsEnabled()) return;
  const mesIdStr = getCurrentDisplayMesId();
  if (!mesIdStr) return;

  const $mes = $(`#chat > .mes[mesid="${mesIdStr}"]`);
  if (!$mes.length) return;

  const state = messageSegmentState.get(mesIdStr);
  const oldIndex = state?.currentIndex ?? 0;
  const oldTotal = state?.segments?.length ?? 0;

  const contentToProcess = resolveGalgameContentForMes($mes, mesIdStr);
  if (!contentToProcess) return;

  const hasGalTags = RE_GAL_TAGS.test(contentToProcess);
  if (!hasGalTags && getSettings().simpleStorybookMode !== true) return;

  // 用新字号实测对话框容量后再分页（applySettingsToUI 已先行更新 --font-scale）
  refreshMeasuredDialogCapacity();

  const parsed = parseGalgameContent(contentToProcess);
  const newTotal = parsed.segments.length;
  if (newTotal === 0) return;

  if (state) {
    if (oldTotal > 1 && newTotal > 0) {
      state.currentIndex = Math.min(newTotal - 1, Math.round((oldIndex / (oldTotal - 1)) * (newTotal - 1)));
    } else {
      state.currentIndex = Math.min(oldIndex, newTotal - 1);
    }
  }

  await updateGlobalOverlayContent(mesIdStr, parsed, { preserveIndex: true, suppressTTS: true });
  updateLocationTimeDisplay();
}

// ============================================
// CG 图片捕获机制
// ============================================

const capturedCgImages = new Map(); // mesId -> [imgSrc, ...]
const cgObservers = new Map(); // mesId -> MutationObserver

const CHATU8_CG_CONTAINER_SELECTOR = [
  '.st-chatu8-collapse-wrapper',
  '.st-chatu8-collapse-content',
  '.st-chatu8-image-container',
  '.st-chatu8-image-span',
  '[data-st-chatu8]',
].join(',');

function getChatu8ImageSrc(img) {
  return String(img?.currentSrc || img?.src || img?.getAttribute('src') || img?.getAttribute('data-src') || '').trim();
}

function getDirectMesTextChild(mesTextNode, node) {
  let cursor = node;
  while (cursor && cursor.parentElement && cursor.parentElement !== mesTextNode) {
    cursor = cursor.parentElement;
  }
  return cursor?.parentElement === mesTextNode ? cursor : null;
}

function collectChatu8CgEntries(mesTextNode) {
  if (!mesTextNode) return [];

  const entries = [];
  const seenImages = new Set();
  const containers = Array.from(mesTextNode.querySelectorAll(CHATU8_CG_CONTAINER_SELECTOR));

  for (const container of containers) {
    const images = container.matches?.('img') ? [container] : Array.from(container.querySelectorAll('img'));
    for (const img of images) {
      if (!img || seenImages.has(img)) continue;

      seenImages.add(img);
      entries.push({
        container,
        img,
        directChild: getDirectMesTextChild(mesTextNode, container),
        src: getChatu8ImageSrc(img),
      });
    }
  }

  return entries;
}

export function getCapturedCgImage(mesId, cgIndex) {
  const images = capturedCgImages.get(String(mesId));
  return images ? images[cgIndex] || null : null;
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
    renderCgSegment($overlay, cgSrc);
  }
}

/**
 * 把 .mes_text 中 st-chatu8 渲染出的图片注入 parsed.segments 的 CG 段落。
 * 支持折叠容器与新版图片容器，按它们在 .mes_text 中的实际顺序插入。
 * 幂等：重复调用先剔除旧 cg 段再重建。
 */
function applyCgSegmentsToParsed(mesIdStr, mesText, parsed) {
  const cgEntries = collectChatu8CgEntries(mesText);
  capturedCgImages.set(mesIdStr, cgEntries.map(entry => entry.src));

  if (cgEntries.length === 0) {
    // 图片被删除/重roll 后清理缓存 parsed 中残留的 cg 段
    parsed.segments = parsed.segments.filter(s => s.type !== 'cg');
    return 0;
  }

  // 移除旧 CG 段落（避免重复检测时叠加）
  const baseSegments = parsed.segments.filter(s => s.type !== 'cg');
  const entriesByChild = new Map();
  const fallbackEntries = [];

  cgEntries.forEach(entry => {
    if (entry.directChild) {
      const list = entriesByChild.get(entry.directChild) || [];
      list.push(entry);
      entriesByChild.set(entry.directChild, list);
    } else {
      fallbackEntries.push(entry);
    }
  });

  let regularIdx = 0;
  let cgIdx = 0;
  const merged = [];
  const pushCgSegment = () => {
    const prevScene = merged.length > 0 ? merged[merged.length - 1].backgroundScene : null;
    merged.push({ type: 'cg', speaker: null, text: '', expression: null, cgIndex: cgIdx++, backgroundScene: prevScene });
  };
  const pushRegularSegment = () => {
    if (regularIdx < baseSegments.length) {
      merged.push(baseSegments[regularIdx++]);
    }
  };

  Array.from(mesText.childNodes).forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const entries = entriesByChild.get(node) || [];
      if (entries.length > 0) {
        entries.forEach(pushCgSegment);
        return;
      }
      if (node.matches?.('p')) {
        pushRegularSegment();
      }
      return;
    }

    if (node.nodeType === Node.TEXT_NODE && String(node.textContent || '').trim()) {
      pushRegularSegment();
    }
  });

  fallbackEntries.forEach(pushCgSegment);

  // 追加剩余段落（如长段落切分产生的额外段落）
  while (regularIdx < baseSegments.length) {
    merged.push(baseSegments[regularIdx++]);
  }

  parsed.segments = merged;

  return cgIdx;
}

const cgObserverTimers = new Map(); // mesId -> debounce timer

// CG 变化后轻量同步进度条与 NEXT/END 按钮（不整页重渲染，避免打字机重放）
function syncOverlayChromeAfterCgChange($overlay, state) {
  const total = state.segments.length;
  const progressPercent = total > 0 ? ((state.currentIndex + 1) / total) * 100 : 0;
  $overlay.find('.gal-progress-bar').css('width', `${progressPercent}%`);

  const $nextBtn = $overlay.find('[data-action="next"]');
  if (state.segments[state.currentIndex + 1]) {
    stopNextBtnAnimation();
    $nextBtn.html('NEXT <i class="fa-solid fa-chevron-right"></i>');
  } else if (!getIsGeneratingResponse()) {
    stopNextBtnAnimation();
    $nextBtn.html('END <i class="fa-solid fa-check"></i>');
  }
}

// 迟到 CG 追踪：已挪到阅读位置之后、读者尚未看过的图片 src。
// 后续重建会按 DOM 原生顺序把它们放回原位，需要靠这个集合再次前挪，直到读者真正看过。
const pendingLateCgSrcs = new Map(); // mesId -> Set<src>

// st-chatu8 图片异步入 DOM 后：重注入 CG 段落并按需刷新覆盖层。
// 迟到的 CG（就绪时读者已读过其原生位置）挪到当前段落之后，点"下一步"即可看到，无需回退。
function handleCgMutation(mesIdStr, mesText) {
  if (!mesText || !mesText.isConnected) return;

  // 与缓存的 src 列表比对，无变化直接返回（挡 observer 噪声 + 防自触发循环）
  const sources = collectChatu8CgEntries(mesText).map(entry => entry.src);
  const existing = capturedCgImages.get(mesIdStr) || [];
  if (sources.length === existing.length && sources.every((s, i) => s === existing[i])) return;

  const state = messageSegmentState.get(mesIdStr);
  if (!state || !state.parsedContent) {
    // 尚无解析状态：只更新 src 缓存，注入留给后续常规解析流程
    capturedCgImages.set(mesIdStr, sources);
    return;
  }

  // 记录读者当前段落身份与"变化前已就绪"的 src 集合
  const prevSegments = state.segments || [];
  const prevIndex = Math.max(0, Math.min(state.currentIndex, Math.max(0, prevSegments.length - 1)));
  const anchorSegment = prevSegments[prevIndex] || null;
  const anchorWasCg = anchorSegment?.type === 'cg';
  const anchorCgIndex = anchorWasCg ? anchorSegment.cgIndex : -1;
  const prevReadySrcs = new Set(existing.filter(Boolean));

  // 之前前挪过的迟到 CG，读者已经推进到（或越过）它 → 视为已看，取消追踪
  const lateSet = pendingLateCgSrcs.get(mesIdStr) || new Set();
  for (let i = 0; i <= prevIndex && i < prevSegments.length; i++) {
    const seg = prevSegments[i];
    if (seg?.type === 'cg') lateSet.delete(existing[seg.cgIndex] || '');
  }

  applyCgSegmentsToParsed(mesIdStr, mesText, state.parsedContent);
  const segments = state.parsedContent.segments;

  // 按身份恢复阅读位置：普通段落是同一对象引用；cg 段每次重建，按 cgIndex 匹配
  let newIndex = -1;
  if (anchorSegment && !anchorWasCg) {
    newIndex = segments.indexOf(anchorSegment);
  } else if (anchorWasCg) {
    newIndex = segments.findIndex(s => s.type === 'cg' && s.cgIndex === anchorCgIndex);
  }
  if (newIndex < 0) newIndex = Math.max(0, Math.min(prevIndex, segments.length - 1));

  // 原生位置在阅读位置之前的 CG：刚就绪的、或此前前挪过但还没被看的 → 挪到当前段之后（保持相对顺序）
  const lateCgs = [];
  let hasNewLateCg = false;
  for (let i = newIndex - 1; i >= 0; i--) {
    const seg = segments[i];
    if (seg?.type !== 'cg') continue;
    const src = sources[seg.cgIndex] || '';
    if (!src) continue; // 还没生成完的跳过，等它就绪时再处理
    const isNewlyReady = !prevReadySrcs.has(src);
    if (isNewlyReady || lateSet.has(src)) {
      segments.splice(i, 1);
      lateCgs.unshift(seg);
      newIndex--;
      lateSet.add(src);
      if (isNewlyReady) hasNewLateCg = true;
    }
  }
  if (lateCgs.length) {
    segments.splice(newIndex + 1, 0, ...lateCgs);
  }
  if (lateSet.size) {
    pendingLateCgSrcs.set(mesIdStr, lateSet);
  } else {
    pendingLateCgSrcs.delete(mesIdStr);
  }

  state.segments = segments;
  state.currentIndex = Math.max(0, Math.min(newIndex, segments.length - 1));

  const $overlay = $('#gal-global-overlay');
  const viewingThisMes = $overlay.length && $overlay.hasClass('active')
    && String($overlay.find('.gal-game-container').attr('data-mes-id')) === mesIdStr;
  if (!viewingThisMes) return;

  // 读者正停在 CG 段（"图片生成中..."）：原地替换为图片
  if (segments[state.currentIndex]?.type === 'cg') {
    refreshCgDisplayIfNeeded(mesIdStr);
  }
  syncOverlayChromeAfterCgChange($overlay, state);
  if (hasNewLateCg) {
    showToast('🖼️ CG 已生成，点击下一步查看');
  }
}

// 安装/复用 .mes_text 的 CG MutationObserver（同节点已挂则跳过；节点重建则重装）
function ensureCgObserver(mesIdStr, mesText) {
  const existing = cgObservers.get(mesIdStr);
  if (existing && existing.mesText === mesText && mesText.isConnected) return;
  if (existing) existing.observer.disconnect();

  // 惰性回收失联节点的旧 observer
  for (const [id, entry] of cgObservers) {
    if (!entry.mesText.isConnected) {
      entry.observer.disconnect();
      cgObservers.delete(id);
    }
  }

  const observer = new MutationObserver(() => {
    const prevTimer = cgObserverTimers.get(mesIdStr);
    if (prevTimer) clearTimeout(prevTimer);
    cgObserverTimers.set(mesIdStr, setTimeout(() => {
      cgObserverTimers.delete(mesIdStr);
      handleCgMutation(mesIdStr, mesText);
    }, 250));
  });
  observer.observe(mesText, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'data-src'],
  });
  cgObservers.set(mesIdStr, { observer, mesText });
}

/**
 * 从 DOM 检测 st-chatu8 渲染出的图片并注入 CG 段落。
 * 智绘姬生图是异步的：即使当前 0 张图也要安装 observer，等图片入 DOM 后自动注入。
 */
export function detectAndCaptureCg(mesId, mesNode, parsed) {
  const mesText = mesNode.querySelector ? mesNode.querySelector('.mes_text') : $(mesNode).find('.mes_text')[0];
  if (!mesText) return 0;

  const mesIdStr = String(mesId);
  const count = applyCgSegmentsToParsed(mesIdStr, mesText, parsed);

  if (count > 0 || getSettings().bgImageSource === 'chatu8') {
    ensureCgObserver(mesIdStr, mesText);
  }

  return count;
}

// 切换聊天时清理：节点全部失效且 mesId 跨聊天撞号
export function cleanupCgObservers() {
  for (const entry of cgObservers.values()) {
    entry.observer.disconnect();
  }
  cgObservers.clear();
  for (const timer of cgObserverTimers.values()) {
    clearTimeout(timer);
  }
  cgObserverTimers.clear();
  capturedCgImages.clear();
  pendingLateCgSrcs.clear();
}

// 延迟引用
let _renderGalgameChoicesRef = null;

export function setOverlayContentRefs({ renderGalgameChoices }) {
  if (renderGalgameChoices) _renderGalgameChoicesRef = renderGalgameChoices;
}
