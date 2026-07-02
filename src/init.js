import { BGMManager } from './audio/bgm-manager.js';
import { TTSManager } from './audio/tts-manager.js';
import { CUSTOM_SKIN_ID, SCRIPT_NAME, TWILIGHT_FAMILY_SKIN_IDS, VERSION } from './core/constants.js';
import { setGlobalDebugEnabled } from './core/debug.js';
import { $, topWindow } from './core/env.js';
import { ensureTitleScreenSettings, getCurrentCharId, getSettings, isCurrentCharEnabled, loadSettings, saveSettings, setCurrentCharEnabled } from './core/settings.js';
import { getIsEnabled, getIsLoadingSave, setHideOtherFloors, setIsEnabled } from './core/state.js';
import { loadAllBackgroundsToCache } from './db/backgrounds.js';
import { initDB } from './db/init.js';
import { hasUiSkinProfileId, refreshUiSkinProfilesCache } from './db/ui-skin-profiles.js';
import { loadAllSpritesToCache } from './db/sprites.js';
import { applyPixiEffectOps, clearAllPixiEffects, preloadPixiEffectsRuntime, syncPixiEffectsSettings } from './effects/pixi-effect-manager.js';
import { LipSyncManager } from './live2d/lip-sync.js';
import { Live2DManager } from './live2d/manager.js';
import { Live2DPreloadManager } from './live2d/preload.js';
import { initEnhancedModeListener, initWorldbookInjectionListener } from './logic/enhanced-mode.js';
import { getGenerationState, getVerificationDelayMs, resetGenerationState, verifyGenerationComplete } from './logic/generation-state.js';
import { setupMessageObserver } from './logic/message-observer.js';
import { RE_GAL_TAGS } from './logic/parser.js';
import { detectSpecialCgPendingNow, initSpecialCgTrigger, resetSpecialCgTriggerForChat, setSpecialCgTriggerRefs } from './logic/special-cg-trigger.js';
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
import { isTitleScreenVisible, maybeShowTitleScreen, resetTitleScreenSession } from './ui/title-screen.js';
import { decodeHtml, getFormattedSwipeContent, getRawMessageContent } from './utils/html.js';
import { updateLocationTimeDisplay } from './utils/location-time.js';

// ============================================
// 初始化
// ============================================
const INIT_LOCK_FLAG = '__galgame_init_lock__';
const MESSAGE_RECEIVED_BOUND_FLAG = '__galgame_message_received_bound__';
const CHAT_CHANGED_BOUND_FLAG = '__galgame_chat_changed_bound__';
const CHAR_POLLING_BOUND_FLAG = '__galgame_char_polling_bound__';
let initStarted = false;

function sanitizeLoadedSkinSetting(settings) {
  const rawSkin = String(settings?.skin || 'none').trim();
  const builtinSkinSet = new Set(['none', 'skin-ancient', 'skin-persona', 'skin-jrpg', 'skin-classic', ...TWILIGHT_FAMILY_SKIN_IDS]);
  if (builtinSkinSet.has(rawSkin)) return false;
  if (hasUiSkinProfileId(rawSkin)) return false;
  if (rawSkin === 'skin-western' || rawSkin === CUSTOM_SKIN_ID || rawSkin) {
    settings.skin = 'none';
    return true;
  }
  return false;
}

export async function init() {
  if (initStarted || topWindow[INIT_LOCK_FLAG]) {
    console.log(`[${SCRIPT_NAME}] 初始化流程已执行/进行中，跳过重复调用`);
    return;
  }
  initStarted = true;
  topWindow[INIT_LOCK_FLAG] = true;

  try {
    loadSettings();
    setIsEnabled(isCurrentCharEnabled());
    const settings = getSettings();
    setGlobalDebugEnabled(!!settings.globalDebug);
    Live2DManager.debug = !!settings.globalDebug;
    console.log(`[${SCRIPT_NAME}] v${VERSION} 开始初始化...`);
    setHideOtherFloors(settings.hideOtherFloors);
    await initDB();
    await refreshUiSkinProfilesCache();
    if (sanitizeLoadedSkinSetting(settings)) {
      saveSettings();
    }
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
      setSpecialCgTriggerRefs({ injectCOTToWorldbook });
      initSpecialCgTrigger().catch(error => {
        console.warn(`[${SCRIPT_NAME}] 特殊CG触发器初始化失败:`, error);
      });

      $('#chat > .mes').each(function () {
        injectGalgameButton(this);
      });

      const titleSettingsOnInit = ensureTitleScreenSettings();
      if (!getIsEnabled() && titleSettingsOnInit?.enabled === true) {
        setIsEnabled(true);
        setCurrentCharEnabled(true);
        updateButtonState();
      }

      if (getIsEnabled()) {
        resetTitleScreenSession();
        try {
          await detectSpecialCgPendingNow();
        } catch (error) {
          console.warn(`[${SCRIPT_NAME}] 启动时特殊CG检测失败:`, error);
        }
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

        await maybeShowTitleScreen({ reason: 'page-load' });
        setTimeout(() => updateLocationTimeDisplay(), 500);

      } else {
        disableWorldbookGlobally().catch(e => console.warn(`[${SCRIPT_NAME}] 初始化状态同步：关闭世界书失败`, e));
      }

      if (typeof topWindow.eventOn === 'function' && topWindow.tavern_events) {
        let chatSwitchPostCheckSeq = 0;
        if (!topWindow[MESSAGE_RECEIVED_BOUND_FLAG]) {
          topWindow[MESSAGE_RECEIVED_BOUND_FLAG] = true;
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
                const simpleStorybookMode = getSettings().simpleStorybookMode === true;
                if (hasGalTags || simpleStorybookMode) {
                  processNewMessage(mesNode);
                } else if (mesNode.classList.contains('gal-hidden')) {
                  mesNode.classList.remove('gal-hidden');
                  console.log(`[${SCRIPT_NAME}] 消息 ${messageId} 非Galgame格式，已解除隐藏`);
                }
              }
            }, 200);
          });
          console.log(`[${SCRIPT_NAME}] MESSAGE_RECEIVED 事件监听已注册`);
        } else {
          console.log(`[${SCRIPT_NAME}] MESSAGE_RECEIVED 事件监听已存在，跳过重复注册`);
        }

        if (!topWindow[CHAT_CHANGED_BOUND_FLAG]) {
          topWindow[CHAT_CHANGED_BOUND_FLAG] = true;
          topWindow.eventOn(topWindow.tavern_events.CHAT_CHANGED, async () => {
            const postCheckSeq = ++chatSwitchPostCheckSeq;
            resetGenerationState('切换聊天');
            if (getIsLoadingSave()) {
              console.log(`[${SCRIPT_NAME}] CHAT_CHANGED 来自读档流程，跳过常规重建`);
              return;
            }
            resetSpecialCgTriggerForChat();
            // 清理上一聊天的立绘状态，避免新聊天首段错误复用旧槽位
            const $overlay = $('#gal-global-overlay');
            SpriteManager.reset($overlay.length ? $overlay : null);
            console.log(`[${SCRIPT_NAME}] 聊天切换：已重置立绘状态`);

            let newEnabled = isCurrentCharEnabled();
            const wasEnabled = getIsEnabled();
            const titleSettingsForCurrentChar = ensureTitleScreenSettings();
            const shouldAutoEnableByTitle = titleSettingsForCurrentChar?.enabled === true;

            if (!newEnabled && shouldAutoEnableByTitle) {
              newEnabled = true;
              setCurrentCharEnabled(true);
            }

            if (newEnabled !== wasEnabled) {
              setIsEnabled(newEnabled);
              updateButtonState();
              console.log(`[${SCRIPT_NAME}] 角色卡切换，Galgame模式: ${newEnabled ? '开' : '关'}`);
            }

            if (newEnabled) {
              // 切换聊天时 SillyTavern 会清除 #chat 內容，overlay 会被销毁
              // 必须重新创建 overlay 并渲染最新消息
              console.log(`[${SCRIPT_NAME}] 聊天切换，重新应用 Galgame 模式`);
              resetTitleScreenSession();
              const overlayShown = await applyGalgameMode();
              if (!overlayShown) {
                console.log(`[${SCRIPT_NAME}] 聊天切换后未找到AI消息，强制显示界面`);
                showGlobalOverlay();
              } else {
                const $overlayAfterRender = $('#gal-global-overlay');
                if (!$overlayAfterRender.hasClass('active')) {
                  console.log(`[${SCRIPT_NAME}] 聊天切换后 overlay 未 active，强制显示界面`);
                  showGlobalOverlay();
                }
              }
              try {
                await detectSpecialCgPendingNow();
              } catch (error) {
                console.warn(`[${SCRIPT_NAME}] 聊天切换后特殊CG检测失败:`, error);
              }
              injectCOTToWorldbook().catch(e => console.warn(`[${SCRIPT_NAME}] 聊天切换后世界书注入失败:`, e));
              await maybeShowTitleScreen({ reason: 'char-switch', force: true });
            } else if (wasEnabled) {
              // 从启用变为禁用
              await disableWorldbookGlobally().catch(e => console.warn(`[${SCRIPT_NAME}] 角色切换：关闭世界书失败`, e));
              restoreOriginalViews();
            }

            // 兜底：角色切换后多次重试，抵抗 ST 切换时序波动
            const runTitleScreenRecovery = async () => {
              if (postCheckSeq !== chatSwitchPostCheckSeq) return;
              if (getIsLoadingSave()) return;
              if (isTitleScreenVisible()) return;

              const latestTitleSettings = ensureTitleScreenSettings();
              if (!latestTitleSettings || latestTitleSettings.enabled !== true) return;

              if (!getIsEnabled()) {
                setIsEnabled(true);
                setCurrentCharEnabled(true);
                updateButtonState();
              }

              let $overlayLater = $('#gal-global-overlay');
              let overlayActive = $overlayLater.length > 0 && $overlayLater.hasClass('active');
              if (!overlayActive) {
                const overlayShownLater = await applyGalgameMode();
                $overlayLater = $('#gal-global-overlay');
                overlayActive = !!overlayShownLater && $overlayLater.length > 0 && $overlayLater.hasClass('active');
                if (!overlayActive) {
                  showGlobalOverlay();
                  $overlayLater = $('#gal-global-overlay');
                  overlayActive = $overlayLater.length > 0 && $overlayLater.hasClass('active');
                }
              }

              if (!isTitleScreenVisible() && overlayActive) {
                resetTitleScreenSession();
                await maybeShowTitleScreen({ reason: 'chat-enter', force: true });
              }
            };

            [120, 360, 800, 1600].forEach(delay => {
              setTimeout(() => {
                runTitleScreenRecovery().catch(error => {
                  console.warn(`[${SCRIPT_NAME}] 角色切换后标题界面兜底失败:`, error);
                });
              }, delay);
            });
          });
          console.log(`[${SCRIPT_NAME}] CHAT_CHANGED 事件监听已注册`);
        } else {
          console.log(`[${SCRIPT_NAME}] CHAT_CHANGED 事件监听已存在，跳过重复注册`);
        }
      }

      // 兜底：当 ST 未按预期触发 CHAT_CHANGED 时，轮询检测角色卡变化
      if (!topWindow[CHAR_POLLING_BOUND_FLAG]) {
        topWindow[CHAR_POLLING_BOUND_FLAG] = true;
        let lastObservedCharKey = String(getCurrentCharId() || 'default').trim() || 'default';
        let charPollingSeq = 0;
        setInterval(() => {
          const currentCharKey = String(getCurrentCharId() || 'default').trim() || 'default';
          if (currentCharKey === lastObservedCharKey) return;
          lastObservedCharKey = currentCharKey;
          const pollSeq = ++charPollingSeq;

          setTimeout(async () => {
            if (pollSeq !== charPollingSeq) return;
            if (getIsLoadingSave()) return;

            try {
              let newEnabled = isCurrentCharEnabled();
              const wasEnabled = getIsEnabled();
              const titleSettings = ensureTitleScreenSettings();
              const shouldAutoEnableByTitle = titleSettings?.enabled === true;

              if (!newEnabled && shouldAutoEnableByTitle) {
                newEnabled = true;
                setCurrentCharEnabled(true);
              }

              if (newEnabled !== wasEnabled) {
                setIsEnabled(newEnabled);
                updateButtonState();
                console.log(`[${SCRIPT_NAME}] 角色轮询检测到切换，Galgame模式: ${newEnabled ? '开' : '关'}`);
              }

              if (!newEnabled) {
                if (wasEnabled) {
                  await disableWorldbookGlobally().catch(e => console.warn(`[${SCRIPT_NAME}] 角色轮询：关闭世界书失败`, e));
                  restoreOriginalViews();
                }
                return;
              }

              if (shouldAutoEnableByTitle) {
                resetTitleScreenSession();
              }
              const overlayShown = await applyGalgameMode();
              const $overlay = $('#gal-global-overlay');
              if (!overlayShown || !$overlay.hasClass('active')) {
                showGlobalOverlay();
              }

              injectCOTToWorldbook().catch(e => console.warn(`[${SCRIPT_NAME}] 角色轮询后世界书注入失败:`, e));
              if (shouldAutoEnableByTitle) {
                await maybeShowTitleScreen({ reason: 'chat-enter', force: true });
              }
            } catch (error) {
              console.warn(`[${SCRIPT_NAME}] 角色轮询兜底触发标题界面失败:`, error);
            }
          }, 120);
        }, 700);
        console.log(`[${SCRIPT_NAME}] 角色切换轮询兜底已启用`);
      } else {
        console.log(`[${SCRIPT_NAME}] 角色切换轮询兜底已存在，跳过重复注册`);
      }
    }, 1500);

    console.log(`[${SCRIPT_NAME}] v${VERSION} 初始化完成`);
  } catch (e) {
    console.error(`[${SCRIPT_NAME}] 初始化失败:`, e);
  } finally {
    topWindow[INIT_LOCK_FLAG] = false;
  }
}

// ============================================
// 全局导出与启动
// ============================================
export function installGalgameGlobals() {
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
}

export function startGalgamePlugin() {
  installGalgameGlobals();
  if ($ && topWindow.document.readyState === 'complete') {
    init();
  } else {
    topWindow.addEventListener('load', init, { once: true });
  }
}
