import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow } from '../core/env.js';

// ============================================
// 生成状态追踪
// ============================================

let isGeneratingResponse = false;
let nextBtnAnimationTimer = null;
const NEXT_BTN_ANIMATION_INTERVAL = 500;

// 页面初始化时间（用于防护刷新时的事件误触发）
const initializationTime = Date.now();

// 生成状态追踪 - 多维度验证
const generationState = {
  isGenerating: false,
  startTime: 0,
  lastMessageId: null,
  pendingMessageId: null,
  verificationTimer: null,
};
const GENERATION_TIMEOUT_MS = 120000;
const VERIFICATION_DELAY_MS = 2000;

// 延迟引用: stopNextBtnAnimation, refreshNextBtnDisplay, updateNextBtnForGeneratingState, updateGeneratingStatus (UI 层)
let _stopNextBtnAnimationRef = null;
let _refreshNextBtnDisplayRef = null;
let _updateNextBtnForGeneratingStateRef = null;
let _updateGeneratingStatusRef = null;

export function setGenerationStateRefs({
  stopNextBtnAnimation,
  refreshNextBtnDisplay,
  updateNextBtnForGeneratingState,
  updateGeneratingStatus,
}) {
  if (stopNextBtnAnimation) _stopNextBtnAnimationRef = stopNextBtnAnimation;
  if (refreshNextBtnDisplay) _refreshNextBtnDisplayRef = refreshNextBtnDisplay;
  if (updateNextBtnForGeneratingState) _updateNextBtnForGeneratingStateRef = updateNextBtnForGeneratingState;
  if (updateGeneratingStatus) _updateGeneratingStatusRef = updateGeneratingStatus;
}

export function getIsGeneratingResponse() {
  return isGeneratingResponse;
}

export function setIsGeneratingResponse(val) {
  isGeneratingResponse = val;
}

export function getInitializationTime() {
  return initializationTime;
}

export function getGenerationState() {
  return generationState;
}

export function getGenerationTimeoutMs() {
  return GENERATION_TIMEOUT_MS;
}

export function getVerificationDelayMs() {
  return VERIFICATION_DELAY_MS;
}

/**
 * 重置生成状态
 */
export function resetGenerationState(reason = 'unknown') {
  console.log(`[${SCRIPT_NAME}] 重置生成状态，原因: ${reason}`);
  isGeneratingResponse = false;
  generationState.isGenerating = false;
  generationState.pendingMessageId = null;
  if (_stopNextBtnAnimationRef) _stopNextBtnAnimationRef();
  if (_refreshNextBtnDisplayRef) _refreshNextBtnDisplayRef();
}

/**
 * 检查 SillyTavern 原生生成状态
 */
export function checkSillyTavernGenerating() {
  try {
    if (typeof window !== 'undefined' && window.SillyTavern?.generating) {
      return true;
    }
    if (topWindow?.SillyTavern?.generating) {
      return true;
    }
    if (typeof window !== 'undefined' && window.isGenerating) {
      return true;
    }
  } catch (e) {
    // ignore
  }
  return false;
}

/**
 * 验证生成是否真正完成
 */
export function verifyGenerationComplete(messageId) {
  console.log(`[${SCRIPT_NAME}] 验证生成完成 - messageId: ${messageId}, pendingId: ${generationState.pendingMessageId}`);

  if (!generationState.isGenerating && !isGeneratingResponse) {
    console.log(`[${SCRIPT_NAME}] 无正在进行的生成，跳过验证`);
    return;
  }

  if (checkSillyTavernGenerating()) {
    console.log(`[${SCRIPT_NAME}] SillyTavern 仍在生成中，延迟验证`);
    setTimeout(() => verifyGenerationComplete(messageId), 1000);
    return;
  }

  resetGenerationState(`消息 ${messageId} 验证完成`);
}

/**
 * 启动生成超时保护
 */
export function startGenerationTimeout() {
  if (generationState.verificationTimer) {
    clearTimeout(generationState.verificationTimer);
  }

  generationState.startTime = Date.now();
  generationState.isGenerating = true;

  console.log(`[${SCRIPT_NAME}] 启动生成超时保护 (${GENERATION_TIMEOUT_MS}ms)`);

  generationState.verificationTimer = setTimeout(() => {
    const elapsed = Date.now() - generationState.startTime;
    console.log(`[${SCRIPT_NAME}] 生成超时保护触发 - 已等待 ${elapsed}ms`);

    if (checkSillyTavernGenerating()) {
      console.log(`[${SCRIPT_NAME}] SillyTavern 仍在生成中，延长超时`);
      generationState.verificationTimer = setTimeout(() => {
        resetGenerationState('超时保护强制重置');
      }, GENERATION_TIMEOUT_MS);
      return;
    }

    resetGenerationState('超时保护触发');
  }, GENERATION_TIMEOUT_MS);
}

/**
 * 停止生成超时保护
 */
export function stopGenerationTimeout() {
  if (generationState.verificationTimer) {
    clearTimeout(generationState.verificationTimer);
    generationState.verificationTimer = null;
  }
  generationState.isGenerating = false;
}
