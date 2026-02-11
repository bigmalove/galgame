import { SCRIPT_NAME } from '../core/constants.js';
import { $ } from '../core/env.js';
import { GalgameStore } from '../core/store.js';
import { getIsGeneratingResponse } from '../logic/generation-state.js';
import { getCurrentDisplayMesId } from './overlay.js';

// ============================================
// NEXT 按钮动画控制
// ============================================

let nextBtnAnimationTimer = null;
const NEXT_BTN_ANIMATION_INTERVAL = 500;

export function updateNextBtnForGeneratingState() {
  const $overlay = $('#gal-global-overlay');
  if ($overlay.length === 0) return;

  const $nextBtn = $overlay.find('[data-action="next"]');

  const mesId = getCurrentDisplayMesId();
  if (!mesId) return;

  const messageSegmentState = GalgameStore.cache.segments;
  const state = messageSegmentState.get(String(mesId));
  if (!state) return;

  const total = state.segments.length;
  const currentIndex = state.currentIndex;
  const isEnd = currentIndex >= total - 1;

  console.log(`[${SCRIPT_NAME}] updateNextBtnForGeneratingState - isEnd=${isEnd}, isGeneratingResponse=${getIsGeneratingResponse()}`);

  if (!isEnd || !getIsGeneratingResponse()) return;

  console.log(`[${SCRIPT_NAME}] 启动动画定时器`);

  stopNextBtnAnimation();

  let dotCount = 1;
  nextBtnAnimationTimer = setInterval(() => {
    const dots = '\u3002'.repeat(dotCount);
    $nextBtn.html(`${dots} <i class="fa-solid fa-spinner fa-spin"></i>`);
    dotCount = (dotCount % 3) + 1;
  }, NEXT_BTN_ANIMATION_INTERVAL);
}

export function stopNextBtnAnimation() {
  if (nextBtnAnimationTimer) {
    clearInterval(nextBtnAnimationTimer);
    nextBtnAnimationTimer = null;
  }
}

export function refreshNextBtnDisplay() {
  const $overlay = $('#gal-global-overlay');
  if ($overlay.length === 0) return;

  const $nextBtn = $overlay.find('[data-action="next"]');

  const mesId = getCurrentDisplayMesId();
  if (!mesId) return;

  const messageSegmentState = GalgameStore.cache.segments;
  const state = messageSegmentState.get(String(mesId));
  if (!state) return;

  const total = state.segments.length;
  const currentIndex = state.currentIndex;
  const isEnd = currentIndex >= total - 1;

  console.log(`[${SCRIPT_NAME}] refreshNextBtnDisplay - isEnd=${isEnd}, isGeneratingResponse=${getIsGeneratingResponse()}`);

  if (isEnd) {
    if (getIsGeneratingResponse()) {
      updateNextBtnForGeneratingState();
    } else {
      stopNextBtnAnimation();
      $nextBtn.html('END <i class="fa-solid fa-check"></i>');
    }
  } else {
    stopNextBtnAnimation();
    $nextBtn.html('NEXT <i class="fa-solid fa-chevron-right"></i>');
  }
}
