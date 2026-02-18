import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow, $ } from '../core/env.js';
import { resizePixiEffects } from '../effects/pixi-effect-manager.js';

// ============================================
// 全屏模式
// ============================================

// 延迟引用
let _showToastRef = null;
let _adjustGameContentScaleRef = null;
let _resetGameContentScaleRef = null;
let _adjustToolbarForSpaceRef = null;

export function setFullscreenRefs({
  showToast,
  adjustGameContentScale,
  resetGameContentScale,
  adjustToolbarForSpace,
}) {
  if (showToast) _showToastRef = showToast;
  if (adjustGameContentScale) _adjustGameContentScaleRef = adjustGameContentScale;
  if (resetGameContentScale) _resetGameContentScaleRef = resetGameContentScale;
  if (adjustToolbarForSpace) _adjustToolbarForSpaceRef = adjustToolbarForSpace;
}

export function getFullscreenElement() {
  return (
    topWindow.document.fullscreenElement ||
    topWindow.document.webkitFullscreenElement ||
    topWindow.document.mozFullScreenElement ||
    topWindow.document.msFullscreenElement ||
    null
  );
}

export function getModalMountRoot() {
  const fullscreenElement = getFullscreenElement();
  return fullscreenElement || topWindow.document.body;
}

export async function toggleFullscreen() {
  const overlay = topWindow.document.getElementById('gal-global-overlay');
  const $btn = $(overlay).find('[data-action="toggle-fullscreen"]');

  const isCurrentlyFullscreen = getFullscreenElement();

  if (isCurrentlyFullscreen) {
    try {
      if (topWindow.document.exitFullscreen) {
        await topWindow.document.exitFullscreen();
      } else if (topWindow.document.webkitExitFullscreen) {
        await topWindow.document.webkitExitFullscreen();
      } else if (topWindow.document.mozCancelFullScreen) {
        await topWindow.document.mozCancelFullScreen();
      } else if (topWindow.document.msExitFullscreen) {
        await topWindow.document.msExitFullscreen();
      }
      $(overlay).removeClass('fullscreen');
      resizePixiEffects();
      $btn.html('<i class="fa-solid fa-expand"></i><span>全屏</span>');
      console.log(`[${SCRIPT_NAME}] 退出全屏模式`);
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 退出全屏失败:`, e);
    }
  } else {
    try {
      if (overlay.requestFullscreen) {
        await overlay.requestFullscreen();
      } else if (overlay.webkitRequestFullscreen) {
        await overlay.webkitRequestFullscreen();
      } else if (overlay.mozRequestFullScreen) {
        await overlay.mozRequestFullScreen();
      } else if (overlay.msRequestFullscreen) {
        await overlay.msRequestFullscreen();
      }
      $(overlay).addClass('fullscreen');
      resizePixiEffects();
      $btn.html('<i class="fa-solid fa-compress"></i><span>退出</span>');
      console.log(`[${SCRIPT_NAME}] 进入全屏模式`);
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 进入全屏失败:`, e);
      if (_showToastRef) _showToastRef('全屏请求失败，请检查浏览器权限');
    }
  }
}

export function setupFullscreenChangeListener() {
  const handleFullscreenChange = () => {
    const overlay = topWindow.document.getElementById('gal-global-overlay');
    if (!overlay) return;
    const $btn = $(overlay).find('[data-action="toggle-fullscreen"]');
    const isFullscreen = getFullscreenElement();
    if (isFullscreen) {
      $(overlay).addClass('fullscreen');
      $btn.html('<i class="fa-solid fa-compress"></i><span>退出</span>');
      if (_resetGameContentScaleRef) _resetGameContentScaleRef();
      resizePixiEffects();
    } else {
      $(overlay).removeClass('fullscreen');
      $btn.html('<i class="fa-solid fa-expand"></i><span>全屏</span>');
      if (_adjustGameContentScaleRef) setTimeout(_adjustGameContentScaleRef, 100);
      setTimeout(() => resizePixiEffects(), 120);
    }
  };
  topWindow.document.addEventListener('fullscreenchange', handleFullscreenChange);
  topWindow.document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  topWindow.document.addEventListener('mozfullscreenchange', handleFullscreenChange);
  topWindow.document.addEventListener('MSFullscreenChange', handleFullscreenChange);
}
