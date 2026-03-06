import { getTTSEnabled } from '../audio/tts-config.js';
import { SCRIPT_NAME } from '../core/constants.js';
import { $, topWindow } from '../core/env.js';
import { getSettings } from '../core/settings.js';
import { GalgameStore } from '../core/store.js';
import { pausePixiEffects, resizePixiEffects, resumePixiEffects } from '../effects/pixi-effect-manager.js';
import { normalizeLocationStatusIconClass, normalizeTimeStatusIconClass } from '../utils/status-popup-icons.js';

// ============================================
// 全局覆盖层架构
// ============================================

let currentDisplayMesId = null;
let overlayUpdateQueue = Promise.resolve();
let chatScrollLockSnapshot = null;
let overlayHeightLockState = {
  lastViewportHeight: 0,
  lastOverlayHeight: 0,
};
const OVERLAY_HEIGHT_RECALC_THRESHOLD = 24;

export function getCurrentDisplayMesId() {
  return currentDisplayMesId;
}

export function setCurrentDisplayMesId(mesId) {
  currentDisplayMesId = mesId === null || mesId === undefined ? null : String(mesId);
}

export function queueOverlayUpdate(source, updateTask) {
  const run = async () => {
    try {
      return await updateTask();
    } catch (error) {
      console.error(`[${SCRIPT_NAME}] 覆盖层更新失败(${source}):`, error);
      return false;
    }
  };

  overlayUpdateQueue = overlayUpdateQueue.then(run, run);
  return overlayUpdateQueue;
}

export function nextOverlayRenderToken(state) {
  if (!state) return 0;
  state.renderToken = (Number(state.renderToken) || 0) + 1;
  return state.renderToken;
}

export function scheduleOverlaySegmentDisplay(state, source = 'unknown') {
  if (!state) return Promise.resolve(false);
  const token = nextOverlayRenderToken(state);
  return queueOverlayUpdate(source, () =>
    _updateOverlaySegmentDisplayRef ? _updateOverlaySegmentDisplayRef(state, token, source) : Promise.resolve(false),
  );
}

// 延迟引用
let _updateOverlaySegmentDisplayRef = null;

export function setOverlayRefs({ updateOverlaySegmentDisplay }) {
  if (updateOverlaySegmentDisplay) _updateOverlaySegmentDisplayRef = updateOverlaySegmentDisplay;
}

/**
 * 创建或获取全局Galgame覆盖层
 */
export function ensureGlobalOverlay() {
  const settings = getSettings();
  const targetDoc = topWindow.document;
  let $overlay = $(targetDoc).find('#gal-global-overlay');

  if (!$overlay.length) {
    const locationIconClass = normalizeLocationStatusIconClass(
      topWindow.localStorage.getItem(GalgameStore.STORAGE_KEYS.CUSTOM_LOCATION_ICON_CLASS) || '',
    );
    const timeIconClass = normalizeTimeStatusIconClass(
      topWindow.localStorage.getItem(GalgameStore.STORAGE_KEYS.CUSTOM_TIME_ICON_CLASS) || '',
    );
    const overlayHtml = `
      <div id="gal-global-overlay">
        <!-- 地点弹窗二（仅展示，不作为弹窗入口） -->
        <div class="gal-status-bar-container">
          <div class="gal-location-bar" id="gal-location-bar" title="当前地点">
            <i class="fa-solid fa-location-dot"></i>
            <span class="gal-location-text" id="gal-location-text">--</span>
          </div>
          <div class="gal-time-bar" id="gal-time-bar" title="当前时间">
            <i class="fa-regular fa-clock"></i>
            <span class="gal-time-text" id="gal-time-text">--</span>
          </div>
        </div>

        <!-- 全屏切换按钮 -->
        <button class="gal-fullscreen-btn" data-action="toggle-fullscreen" title="切换全屏">
          <i class="fa-solid fa-expand"></i>
          <span>全屏</span>
        </button>

        <div class="gal-game-container">
          <!-- 背景层 -->
          <div class="gal-layer-bg">
            <div class="gal-bg-layer gal-bg-base"></div>
            <div class="gal-bg-layer gal-bg-front"></div>
          </div>

          <div class="gal-layer-effect-bg"></div>

          <!-- 游戏内容层 -->
          <div class="gal-game-content">
            <!-- 立绘层 -->
            <div class="gal-layer-character${settings.speakerGlow ? ' glow-enabled' : ''}${settings.speakerBubble ? ' bubble-enabled' : ''}${getTTSEnabled() ? ' tts-mode-enabled' : ''}">
              <div class="gal-char-slot slot-left"></div>
              <div class="gal-char-slot slot-center"></div>
              <div class="gal-char-slot slot-right"></div>
            </div>

            <div class="gal-layer-effect-fg"></div>

            <!-- 对话框层 -->
            <div class="gal-dialog-layer">
              <button class="gal-sprite-toggle" title="显示/隐藏立绘">
                <span class="gal-eye-icon">\u{1F441}</span>
              </button>
              <button class="gal-status-popup-trigger gal-location-popup-trigger" id="gal-location-popup-trigger" title="弹窗一">
                <i class="gal-status-popup-icon ${locationIconClass}"></i>
              </button>
              <button class="gal-status-popup-trigger gal-time-popup-trigger" id="gal-time-popup-trigger" title="弹窗二">
                <i class="gal-status-popup-icon ${timeIconClass}"></i>
              </button>
              <div class="gal-name-badge">
                <span>旁白</span>
              </div>

              <div class="gal-interaction-bar">
                <button class="gal-action-btn btn-reroll" data-action="reroll" title="重新生成">
                  <i class="fa-solid fa-rotate-right"></i>
                  <span>重绘当前</span>
                </button>
                <button class="gal-action-btn btn-free" data-action="free-input" title="自由输入">
                  <i class="fa-regular fa-keyboard"></i>
                  <span>自由对话</span>
                </button>
              </div>

              <div class="gal-text-panel">
                <p class="gal-dialog-text"></p>

                <!-- 生成中特效指示器 -->
                <div class="gal-generating-indicator" id="gal-generating-indicator">
                  <i class="fa-solid fa-wand-magic-sparkles gal-gen-icon"></i>
                  <span class="gal-gen-text">生成中</span>
                  <span class="gal-gen-status" id="gal-gen-status">正在初始化...</span>
                  <div class="gal-gen-dots">
                    <span class="gal-gen-dot"></span>
                    <span class="gal-gen-dot"></span>
                    <span class="gal-gen-dot"></span>
                  </div>
                </div>

                <div class="gal-bottom-toolbar">
                  <button class="gal-footer-btn" data-action="log" title="查看历史">
                    <i class="fa-solid fa-list-ul"></i> <span class="gal-btn-text">LOG</span>
                  </button>
                  <button class="gal-footer-btn" data-action="close-mode" title="退出 Galgame 模式">
                    <i class="fa-solid fa-power-off"></i> <span class="gal-btn-text">CLOSE</span>
                  </button>
                  <button class="gal-footer-btn" data-action="view-original" title="查看消息内嵌界面">
                    <i class="fa-solid fa-display"></i> <span class="gal-btn-text">VIEW</span>
                  </button>
                  <button class="gal-footer-btn" data-action="config" title="设置">
                    <i class="fa-solid fa-gear"></i> <span class="gal-btn-text">CONFIG</span>
                  </button>
                  <button class="gal-footer-btn" data-action="save" title="存档">
                    <i class="fa-solid fa-floppy-disk"></i> <span class="gal-btn-text">SAVE</span>
                  </button>
                  <button class="gal-footer-btn" data-action="load" title="读档">
                    <i class="fa-solid fa-folder-open"></i> <span class="gal-btn-text">LOAD</span>
                  </button>
                  <button class="gal-footer-btn" data-action="timeline" title="时间线图谱">
                    <i class="fa-solid fa-diagram-project"></i> <span class="gal-btn-text">TL</span>
                  </button>
                  <button class="gal-footer-btn gal-nav-btn" data-action="prev" title="上一段">
                    <i class="fa-solid fa-chevron-left"></i> <span class="gal-btn-text">PREV</span>
                  </button>
                  <button class="gal-footer-btn gal-nav-btn" data-action="auto" title="自动播放">
                    <i class="fa-solid fa-play"></i> <span class="gal-btn-text">AUTO</span>
                  </button>
                  <button class="gal-footer-btn gal-nav-btn" data-action="skip" title="按住快进 (Ctrl)">
                    <i class="fa-solid fa-forward"></i> <span class="gal-btn-text">SKIP</span>
                  </button>
                  <button class="gal-pending-choices-btn" data-action="show-choices" title="有待选择的选项">
                    <i class="fa-solid fa-list-check" style="font-size:1.1rem"></i> <span class="gal-btn-text">选项</span>
                  </button>
                  <button class="gal-footer-btn-next" data-action="next" title="下一段">
                    <span class="gal-btn-text">NEXT</span> <i class="fa-solid fa-chevron-right"></i>
                  </button>
                </div>
              </div>

              <!-- 进度条 -->
              <div class="gal-progress-container">
                <div class="gal-progress-bar"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 特殊 CG 叠层 -->
        <div class="gal-special-cg-overlay" style="display:none;">
          <img class="gal-special-cg-overlay-image" alt="特殊CG" />
          <button class="gal-special-cg-overlay-close" title="关闭">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>

        <!-- CG 全屏查看器 -->
        <div class="gal-cg-viewer" style="display:none;">
          <img class="gal-cg-viewer-img" style="display:none;" />
          <button class="gal-cg-viewer-close" title="关闭">
            <i class="fa-solid fa-times"></i>
          </button>
          <div class="gal-cg-viewer-loading">图片生成中...</div>
        </div>

        <!-- 移动端上拉菜单（置于 overlay 顶层，避免被 overflow:hidden 裁剪） -->
        <div class="gal-mobile-menu" id="gal-mobile-menu">
          <button class="gal-menu-btn" data-action="open-settings">
              <i class="fa-solid fa-gear"></i> 设置
          </button>
          <button class="gal-menu-btn" data-action="log">
              <i class="fa-solid fa-list-ul"></i> 历史
          </button>
          <button class="gal-menu-btn" data-action="view-original">
              <i class="fa-solid fa-display"></i> 原界面
          </button>
          <button class="gal-menu-btn" data-action="save">
              <i class="fa-solid fa-floppy-disk"></i> 存档
          </button>
          <button class="gal-menu-btn" data-action="load">
              <i class="fa-solid fa-folder-open"></i> 读档
          </button>
          <button class="gal-menu-btn" data-action="timeline">
              <i class="fa-solid fa-diagram-project"></i> 时间线
          </button>
        </div>
      </div>
    `;

    const $chat = $(targetDoc).find('#chat');
    if ($chat.length) {
      $chat.append(overlayHtml);
    } else {
      $(targetDoc.body).append(overlayHtml);
    }
    $overlay = $(targetDoc).find('#gal-global-overlay');
  }
  return $overlay;
}

/**
 * 渲染主界面（确保容器存在）
 */
export function renderMainInterface() {
  const targetDoc = topWindow.document;
  let container = targetDoc.getElementById('galgame-database-container');
  if (!container) {
    container = targetDoc.createElement('div');
    container.id = 'galgame-database-container';
    container.className = 'galgame-database-container';
    targetDoc.body.appendChild(container);
    console.log(`[${SCRIPT_NAME}] 已创建 galgame-database-container 容器`);
  }
  container.style.display = 'block';
  return container;
}

// ============================================
// 缩放和布局
// ============================================

export function setChatScrollLock(locked) {
  const targetDoc = topWindow.document;
  const chatEl = targetDoc.getElementById('chat');
  if (!chatEl) return;

  if (locked) {
    if (!chatScrollLockSnapshot) {
      chatScrollLockSnapshot = {
        overflowX: chatEl.style.overflowX || '',
        overflowY: chatEl.style.overflowY || '',
        overscrollBehavior: chatEl.style.overscrollBehavior || '',
      };
    }
    chatEl.style.overflowX = 'hidden';
    chatEl.style.overflowY = 'hidden';
    chatEl.style.overscrollBehavior = 'contain';
    return;
  }

  if (!chatScrollLockSnapshot) return;
  chatEl.style.overflowX = chatScrollLockSnapshot.overflowX;
  chatEl.style.overflowY = chatScrollLockSnapshot.overflowY;
  chatEl.style.overscrollBehavior = chatScrollLockSnapshot.overscrollBehavior;
  chatScrollLockSnapshot = null;
}

export function syncOverlayHeightToChatViewport(overlay, { force = false } = {}) {
  if (!overlay || overlay.classList.contains('fullscreen')) return;

  const targetDoc = topWindow.document;
  const chatEl = targetDoc.getElementById('chat');
  if (!chatEl) return;

  const viewportHeight = Math.max(
    1,
    Math.floor(Number(topWindow.innerHeight) || Number(targetDoc.documentElement?.clientHeight) || 0),
  );
  const lastViewportHeight = Number(overlayHeightLockState.lastViewportHeight) || 0;
  const viewportChanged = Math.abs(viewportHeight - lastViewportHeight) > OVERLAY_HEIGHT_RECALC_THRESHOLD;
  const lockedHeight = Number(overlayHeightLockState.lastOverlayHeight) || 0;

  if (!force && !viewportChanged && lockedHeight > 0) {
    overlay.style.minHeight = '0px';
    overlay.style.maxHeight = `${lockedHeight}px`;
    overlay.style.height = `${lockedHeight}px`;
    resizePixiEffects();
    return;
  }

  const chatHeight = Number(chatEl.clientHeight) || 0;
  if (!Number.isFinite(chatHeight) || chatHeight <= 0) return;

  let marginTop = 0;
  let marginBottom = 0;
  try {
    const computed = topWindow.getComputedStyle(overlay);
    marginTop = parseFloat(computed.marginTop) || 0;
    marginBottom = parseFloat(computed.marginBottom) || 0;
  } catch (e) {}

  const targetHeight = Math.max(120, Math.floor(chatHeight - marginTop - marginBottom));
  overlay.style.minHeight = '0px';
  overlay.style.maxHeight = `${targetHeight}px`;
  overlay.style.height = `${targetHeight}px`;
  overlayHeightLockState.lastViewportHeight = viewportHeight;
  overlayHeightLockState.lastOverlayHeight = targetHeight;
  resizePixiEffects();
}

export function adjustGameContentScale() {
  const targetDoc = topWindow.document;
  const overlay = targetDoc.getElementById('gal-global-overlay');
  if (!overlay) return;

  if (overlay.classList.contains('fullscreen')) {
    const fullscreenScale = 1;
    const currentFullscreenScale = parseFloat(overlay.style.getPropertyValue('--ui-scale')) || 0;
    const currentFullscreenBase = parseFloat(overlay.style.getPropertyValue('--ui-scale-base')) || 0;
    if (
      Math.abs(currentFullscreenScale - fullscreenScale) >= 0.001 ||
      Math.abs(currentFullscreenBase - fullscreenScale) >= 0.001
    ) {
      overlay.style.setProperty('--ui-auto-scale', '1');
      overlay.style.setProperty('--ui-scale-base', '1');
      overlay.style.setProperty('--ui-scale', String(fullscreenScale));
    }
    resizePixiEffects();
    return;
  }

  syncOverlayHeightToChatViewport(overlay);

  const width = overlay.clientWidth || overlay.getBoundingClientRect().width;
  if (!width || !Number.isFinite(width)) return;

  const baseWidth = 1200;
  const autoScale = Math.max(0.01, Math.min(1, width / baseWidth));
  const newScale = autoScale;

  const currentScale = parseFloat(overlay.style.getPropertyValue('--ui-scale')) || 0;
  const currentAutoScale = parseFloat(overlay.style.getPropertyValue('--ui-auto-scale')) || 0;
  const currentBaseScale = parseFloat(overlay.style.getPropertyValue('--ui-scale-base')) || 0;
  if (
    Math.abs(currentScale - newScale) < 0.001 &&
    Math.abs(currentAutoScale - autoScale) < 0.001 &&
    Math.abs(currentBaseScale - newScale) < 0.001
  ) {
    return;
  }

  overlay.style.setProperty('--ui-auto-scale', String(autoScale));
  overlay.style.setProperty('--ui-scale-base', String(newScale));
  overlay.style.setProperty('--ui-scale', String(newScale));
  resizePixiEffects();
}

export function resetGameContentScale() {
  const targetDoc = topWindow.document;
  const overlay = targetDoc.getElementById('gal-global-overlay');
  if (overlay) {
    overlay.style.setProperty('--ui-auto-scale', '1');
    overlay.style.setProperty('--ui-scale-base', '1');
    overlay.style.setProperty('--ui-scale', '1');
  }

  const $gameContainer = $(targetDoc).find('.gal-game-container');
  if (!$gameContainer.length) return;

  $gameContainer.css({
    transform: '',
    width: '',
    height: '',
    position: '',
    left: '',
    right: '',
    top: '',
    bottom: '',
    margin: '',
  });
  resizePixiEffects();
}

export function adjustToolbarForSpace() {
  const overlay = topWindow.document.getElementById('gal-global-overlay');
  if (!overlay) return;
  overlay.classList.remove('mobile-mode');
  overlay.classList.remove('icon-only');
  overlay.classList.remove('gal-toolbar-compact');
  overlay.classList.remove('gal-toolbar-tight');
}

// ============================================
// 显示/隐藏覆盖层
// ============================================

export function showGlobalOverlay() {
  const $overlay = ensureGlobalOverlay();
  if ($overlay.length) {
    $overlay.addClass('active');
    resumePixiEffects();
    setChatScrollLock(true);
    overlayHeightLockState.lastViewportHeight = 0;
    overlayHeightLockState.lastOverlayHeight = 0;
    setTimeout(() => {
      syncOverlayHeightToChatViewport($overlay[0], { force: true });
      adjustGameContentScale();
      adjustToolbarForSpace();
      resizePixiEffects();
      // 确保 overlay 在 #chat 的可视区域内（overlay 在 #chat 末尾，可能被滚动裁剪）
      const chatEl = topWindow.document.getElementById('chat');
      if (chatEl) {
        chatEl.scrollTop = $overlay[0].offsetTop;
      }
    }, 0);
  } else {
    console.error(`[${SCRIPT_NAME}] showGlobalOverlay: 无法获取覆盖层元素！`);
  }
}

export function hideGlobalOverlay() {
  const targetDoc = topWindow.document;
  $(targetDoc).find('#gal-global-overlay').removeClass('active');
  pausePixiEffects();
  setChatScrollLock(false);
  overlayHeightLockState.lastViewportHeight = 0;
  overlayHeightLockState.lastOverlayHeight = 0;
  console.log(`[${SCRIPT_NAME}] 隐藏全局Galgame覆盖层`);
}

export function toggleGlobalOverlay() {
  const $overlay = ensureGlobalOverlay();
  if ($overlay.hasClass('active')) {
    hideGlobalOverlay();
  } else {
    showGlobalOverlay();
  }
}

// ============================================
// 生成中指示器
// ============================================

export function showGeneratingIndicator(statusText = '正在生成内容...') {
  const $overlay = $('#gal-global-overlay');
  if ($overlay.length === 0) return;

  const $indicator = $overlay.find('#gal-generating-indicator');
  const $status = $overlay.find('#gal-gen-status');

  if ($indicator.length) {
    $status.text(statusText);
    $indicator.addClass('active');
  }
}

export function hideGeneratingIndicator() {
  const $overlay = $('#gal-global-overlay');
  if ($overlay.length === 0) return;

  const $indicator = $overlay.find('#gal-generating-indicator');
  if ($indicator.length) {
    $indicator.removeClass('active');
  }
}

export function updateGeneratingStatus(statusText) {
  const $overlay = $('#gal-global-overlay');
  if ($overlay.length === 0) return;

  const $status = $overlay.find('#gal-gen-status');
  if ($status.length) {
    $status.text(statusText);
  }
}

// ============================================
// Resize 监听器
// ============================================
const RESIZE_LISTENER_BOUND_FLAG = '__galgame_overlay_resize_listener_bound__';

export function setupGameContentResizeListener() {
  if (topWindow[RESIZE_LISTENER_BOUND_FLAG]) {
    console.log(`[${SCRIPT_NAME}] 窗口 resize 监听已存在，跳过重复注册`);
    return;
  }
  topWindow[RESIZE_LISTENER_BOUND_FLAG] = true;

  let resizeTimer = null;
  let isProcessing = false;

  const handleResize = () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (isProcessing) return;
      isProcessing = true;

      const $overlay = $(topWindow.document).find('#gal-global-overlay');
      if ($overlay.hasClass('active')) {
        if ($overlay.hasClass('fullscreen')) {
          resetGameContentScale();
        } else {
          adjustGameContentScale();
        }
        adjustToolbarForSpace();
        resizePixiEffects();
      }

      requestAnimationFrame(() => {
        isProcessing = false;
      });
    }, 200);
  };

  topWindow.addEventListener('resize', handleResize);

  setTimeout(() => {
    const $overlay = $(topWindow.document).find('#gal-global-overlay');
    if ($overlay.hasClass('fullscreen')) {
      resetGameContentScale();
    } else {
      adjustGameContentScale();
    }
    adjustToolbarForSpace();
    resizePixiEffects();
  }, 800);
}
