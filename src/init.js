import { BGMManager } from './audio/bgm-manager.js';
import { TTSManager } from './audio/tts-manager.js';
import { SCRIPT_NAME, VERSION } from './core/constants.js';
import { setGlobalDebugEnabled } from './core/debug.js';
import { $, topWindow } from './core/env.js';
import { getCurrentCharId, getSettings, isCurrentCharEnabled, loadSettings } from './core/settings.js';
import { getIsEnabled, setHideOtherFloors, setIsEnabled } from './core/state.js';
import { loadAllBackgroundsToCache } from './db/backgrounds.js';
import { initDB } from './db/init.js';
import { loadAllSpritesToCache } from './db/sprites.js';
import { applyPixiEffectOps, clearAllPixiEffects, preloadPixiEffectsRuntime, syncPixiEffectsSettings } from './effects/pixi-effect-manager.js';
import { LipSyncManager } from './live2d/lip-sync.js';
import { Live2DManager } from './live2d/manager.js';
import { Live2DPreloadManager } from './live2d/preload.js';
import { initEnhancedModeListener, initWorldbookInjectionListener } from './logic/enhanced-mode.js';
import { getGenerationState, getVerificationDelayMs, resetGenerationState, verifyGenerationComplete } from './logic/generation-state.js';
import { setupMessageObserver } from './logic/message-observer.js';
import { RE_GAL_TAGS } from './logic/parser.js';
import { disableWorldbookGlobally, injectCOTToWorldbook } from './logic/worldbook.js';
import { SpriteManager } from './sprite/sprite-manager.js';
import { setupOptionsPanelObserver } from './ui/choices.js';
import { setupGlobalEventListeners } from './ui/events.js';
import { setupFullscreenChangeListener } from './ui/fullscreen.js';
import { applyGalgameMode, restoreOriginalViews } from './ui/galgame-mode.js';
import { setupKeyboardShortcuts } from './ui/interaction.js';
import { addMenuButton, injectGalgameButton, updateButtonState } from './ui/menu-button.js';
import { ensureGlobalOverlay, setupGameContentResizeListener, showGlobalOverlay } from './ui/overlay.js';
import { processNewMessage } from './ui/process-message.js';
import { injectStyles } from './ui/styles.js';
import { decodeHtml, getFormattedSwipeContent, getRawMessageContent } from './utils/html.js';
import { updateLocationTimeDisplay } from './utils/location-time.js';

// ============================================
// 初始化
// ============================================

async function init() {
  try {
    loadSettings();
    setIsEnabled(isCurrentCharEnabled());
    const settings = getSettings();
    setGlobalDebugEnabled(!!settings.globalDebug);
    Live2DManager.debug = !!settings.globalDebug;
    console.log(`[${SCRIPT_NAME}] v${VERSION} 开始初始化...`);
    setHideOtherFloors(settings.hideOtherFloors);
    await initDB();
    await loadAllSpritesToCache();
    await loadAllBackgroundsToCache();
    SpriteManager.init();
    Live2DPreloadManager.scheduleSdkPreload('init');
    injectStyles();
    resetGenerationState('页面初始化（事件注册前）');

    setTimeout(async () => {
      resetGenerationState('页面初始化（延迟执行）');

      setIsEnabled(isCurrentCharEnabled());
      console.log(`[${SCRIPT_NAME}] 当前角色ID: ${getCurrentCharId()}, Galgame模式: ${getIsEnabled() ? '开' : '关'}`);
      addMenuButton();
      setupMessageObserver();
      setupGlobalEventListeners();
      setupKeyboardShortcuts();
      setupOptionsPanelObserver();
      setupFullscreenChangeListener();
      setupGameContentResizeListener();
      initEnhancedModeListener();
      initWorldbookInjectionListener();

      $('#chat > .mes').each(function () {
        injectGalgameButton(this);
      });

      if (getIsEnabled()) {
        injectCOTToWorldbook().catch(e => console.warn(`[${SCRIPT_NAME}] 世界书注入失败:`, e));
        console.log(`[${SCRIPT_NAME}] 初始化完成（世界书按需附加模式）`);
        // 等待 applyGalgameMode 完成（包括异步的 overlay 渲染）
        const overlayShown = await applyGalgameMode();

        // 仅当 applyGalgameMode 未能成功显示界面时，才执行后备强制显示
        if (!overlayShown) {
          console.log(`[${SCRIPT_NAME}] applyGalgameMode 未找到AI消息，强制显示界面`);
          showGlobalOverlay();
        } else {
          // 确保 overlay 确实被激活
          const $overlay = $('#gal-global-overlay');
          if (!$overlay.hasClass('active')) {
            console.log(`[${SCRIPT_NAME}] 初始化后 overlay 未 active，强制显示界面`);
            showGlobalOverlay();
          }
        }

        setTimeout(() => updateLocationTimeDisplay(), 500);

      } else {
        disableWorldbookGlobally().catch(e => console.warn(`[${SCRIPT_NAME}] 初始化状态同步：关闭世界书失败`, e));
      }

      if (typeof topWindow.eventOn === 'function' && topWindow.tavern_events) {
        topWindow.eventOn(topWindow.tavern_events.MESSAGE_RECEIVED, messageId => {
          console.log(`[${SCRIPT_NAME}] MESSAGE_RECEIVED 事件触发, messageId: ${messageId}`);

          const generationState = getGenerationState();
          generationState.pendingMessageId = messageId;

          setTimeout(() => {
            verifyGenerationComplete(messageId);
          }, getVerificationDelayMs());

          if (!getIsEnabled()) return;

          setTimeout(() => {
            const mesNode = topWindow.document.querySelector(`.mes[mesid="${messageId}"]`);
            if (mesNode) {
              let content = getFormattedSwipeContent(messageId);
              if (!content) {
                content = getRawMessageContent(messageId);
              }
              if (!content) {
                const $mesText = $(mesNode).find('.mes_text');
                content = decodeHtml($mesText.html() || '');
              }
              const hasGalTags = RE_GAL_TAGS.test(content);
              if (hasGalTags) {
                processNewMessage(mesNode);
              } else if (mesNode.classList.contains('gal-hidden')) {
                mesNode.classList.remove('gal-hidden');
                console.log(`[${SCRIPT_NAME}] 消息 ${messageId} 非Galgame格式，已解除隐藏`);
              }
            }
          }, 200);
        });
        console.log(`[${SCRIPT_NAME}] MESSAGE_RECEIVED 事件监听已注册`);

        topWindow.eventOn(topWindow.tavern_events.CHAT_CHANGED, async () => {
          resetGenerationState('切换聊天');
          const newEnabled = isCurrentCharEnabled();
          const wasEnabled = getIsEnabled();

          if (newEnabled !== wasEnabled) {
            setIsEnabled(newEnabled);
            updateButtonState();
            console.log(`[${SCRIPT_NAME}] 角色卡切换，Galgame模式: ${newEnabled ? '开' : '关'}`);
          }

          if (newEnabled) {
            // 切换聊天时 SillyTavern 会清除 #chat 內容，overlay 会被销毁
            // 必须重新创建 overlay 并渲染最新消息
            console.log(`[${SCRIPT_NAME}] 聊天切换，重新应用 Galgame 模式`);
            await applyGalgameMode();
          } else if (wasEnabled) {
            // 从启用变为禁用
            await disableWorldbookGlobally().catch(e => console.warn(`[${SCRIPT_NAME}] 角色切换：关闭世界书失败`, e));
            restoreOriginalViews();
          }
        });
        console.log(`[${SCRIPT_NAME}] CHAT_CHANGED 事件监听已注册`);
      }
    }, 1500);

    console.log(`[${SCRIPT_NAME}] v${VERSION} 初始化完成`);
  } catch (e) {
    console.error(`[${SCRIPT_NAME}] 初始化失败:`, e);
  }
}

// ============================================
// 启动
// ============================================
if ($ && topWindow.document.readyState === 'complete') {
  init();
} else {
  topWindow.addEventListener('load', init);
}

// ============================================
// 全局导出
// ============================================
topWindow.LipSyncManager = LipSyncManager;
topWindow.Live2DManager = Live2DManager;
topWindow.TTSManager = TTSManager;
topWindow.BGMManager = BGMManager;

topWindow.galgame = topWindow.galgame || {};
topWindow.galgame.LipSyncManager = LipSyncManager;
topWindow.galgame.Live2DManager = Live2DManager;
topWindow.galgame.TTSManager = TTSManager;
topWindow.galgame.BGMManager = BGMManager;
topWindow.galgame.effects = {
  help() {
    console.log('[galgame.effects] commands:');
    console.log('  preload()');
    console.log('  play(name = "rain")');
    console.log('  run([{ action: "perform", name: "snow" }])');
    console.log('  clear()');
    console.log('  enable(true|false)');
    console.log('  quality("mobile"|"balanced"|"high")');
    console.log('  maxActive(1-6)');
    console.log('  state()');
  },
  preload() {
    return preloadPixiEffectsRuntime();
  },
  play(name = 'rain') {
    const $overlay = ensureGlobalOverlay();
    return applyPixiEffectOps([{ action: 'perform', name: String(name || 'rain') }], $overlay[0]);
  },
  run(ops) {
    const $overlay = ensureGlobalOverlay();
    const list = Array.isArray(ops) ? ops : [ops];
    return applyPixiEffectOps(list, $overlay[0]);
  },
  clear() {
    clearAllPixiEffects();
    return true;
  },
  enable(enabled = true) {
    const settings = getSettings();
    settings.effectsEnabled = !!enabled;
    if (!settings.effectsEnabled) {
      clearAllPixiEffects();
    }
    syncPixiEffectsSettings();
    return settings.effectsEnabled;
  },
  quality(level = 'balanced') {
    const nextLevel = ['mobile', 'balanced', 'high'].includes(level) ? level : 'balanced';
    const settings = getSettings();
    settings.effectsQuality = nextLevel;
    syncPixiEffectsSettings();
    return settings.effectsQuality;
  },
  maxActive(value = 2) {
    const parsed = parseInt(value, 10);
    const settings = getSettings();
    settings.effectsMaxActive = Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 6)) : 2;
    syncPixiEffectsSettings();
    return settings.effectsMaxActive;
  },
  state() {
    const settings = getSettings();
    return {
      effectsEnabled: settings.effectsEnabled !== false,
      effectsQuality: settings.effectsQuality,
      effectsAutoClearOnSceneChange: settings.effectsAutoClearOnSceneChange !== false,
      effectsMaxActive: settings.effectsMaxActive,
    };
  },
};

console.log(`[${SCRIPT_NAME}] 全局导出完成: window.galgame.{LipSyncManager, Live2DManager, TTSManager, BGMManager, effects}`);
