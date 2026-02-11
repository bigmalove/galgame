// ============================================
// Galgame 界面插件 - 模块化入口
// ============================================
// 临时入口文件，用于验证 Phase 1-3 模块构建

// === Phase 1: 基础设施层 ===
import { SCRIPT_ID, SCRIPT_NAME, VERSION, THEME } from './core/constants.js';
import { topWindow, $ } from './core/env.js';
import { GalgameStore } from './core/store.js';
import { DEFAULT_SETTINGS, getSettings, setSettings, loadSettings, saveSettings, getCurrentCharId, isCurrentCharEnabled, setCurrentCharEnabled, SYSTEM_PROMPT_FOR_SECOND_GENERATE } from './core/settings.js';
import { getDb, setDb, getIsEnabled, setIsEnabled, getHideOtherFloors, setHideOtherFloors, getIsSkipping, setIsSkipping, getSkipTimer, setSkipTimer, getIsRewinding, setIsRewinding, REWIND_HOLD_DELAY, getLastGalgameOptionHash, setLastGalgameOptionHash, getGalgameChoicesVisible, setGalgameChoicesVisible, getPendingOptions, setPendingOptions } from './core/state.js';
import { decodeHtml, getRawMessageContent, getFormattedSwipeContent } from './utils/html.js';
import { getCharacterListFromDatabase } from './utils/chat.js';
import { getCustomExpressions, saveCustomExpressions, addCustomExpression, removeCustomExpression, updateCustomExpressionEmotion, getAllExpressions, setExpressionsRefs } from './utils/expressions.js';
import { getGlobalLocationAndTime, updateLocationTimeDisplay } from './utils/location-time.js';
import { getCachedChatContainer, getCachedGlobalOverlay, invalidateDOMCache } from './utils/dom-cache.js';

// === Phase 2: 数据层 ===
import { initDB } from './db/init.js';
import { saveLive2DModel, getLive2DModel, hasLive2DModel, deleteLive2DModel, getAllLive2DModels } from './db/live2d-models.js';
import { saveSprite, saveSpritesBatch, getSprite, getCharacterSprites, deleteSprite, getAllSprites, loadAllSpritesToCache } from './db/sprites.js';
import { saveBackground, saveBackgroundsBatch, getBackground, deleteBackground, getAllBackgrounds, loadAllBackgroundsToCache } from './db/backgrounds.js';
import { getCurrentPackId, setCurrentPack, getRenderScope, setRenderScope, getAllImagePacks, getDefaultPack, createImagePack, renameImagePack, deleteImagePack, transferSpritesToPack, transferBackgroundsToPack, getPackResourceCount, ensureBackgroundLayers, clearBackgroundLayers, setBackgroundWithTransition } from './db/image-packs.js';

// === Phase 3: 独立功能模块 ===
import { SpriteAnimationManager } from './animation/sprite-animation.js';
import { getCharacterUseLive2D, setCharacterUseLive2D, getLive2DConfig, setLive2DConfig, updateLive2DConfig, deleteLive2DConfig, calculateLive2DBaseScale, normalizeLive2DScaleBase, getOverlayReferenceHeight, getDefaultLive2DConfig } from './live2d/render-mode.js';
import { Live2DLoader } from './live2d/loader.js';
import { TTS_PROVIDER, getTTSProvider, getGptSoVitsConfig, getTTSVoiceList, getTTSVoiceListAsync, resolveVoiceByName, getTTSEnabled, setTTSEnabled, getCharacterTTSVoice, setCharacterTTSVoice, getAllCharacterTTSVoices } from './audio/tts-config.js';
import { getComfyUISettings, saveComfyUISettings, getComfyWorkflows, saveComfyWorkflows, getCharAppearancePrompt, setCharAppearancePrompt, getBananaCharacterAppearances, setBananaCharacterAppearances, buildBananaAppearancePromptText, getSpriteAsBase64, buildBananaAppearanceMultimodalContent, setComfyUIHelperRefs } from './image-gen/comfyui-helpers.js';
import { WallhavenAPI } from './image-gen/wallhaven-api.js';

// === Phase 4: 核心管理器 (Live2D) ===
import { Live2DManager, setLive2DManagerRefs } from './live2d/manager.js';
import { Live2DStage, setLive2DStageRefs } from './live2d/stage.js';
import { LipSyncManager, setLipSyncRefs } from './live2d/lip-sync.js';
import { Live2DPositionEditor, setPositionEditorRefs } from './live2d/position-editor.js';
import { Live2DUploader } from './live2d/uploader.js';
import { Live2DPreloadManager, renderCharacterVisual, updateCharacterFocus, cleanupCharacterVisual, cleanupAllVisuals } from './live2d/preload.js';
import { EXPRESSION_LIVE2D_MAP, matchLive2DExpression, matchLive2DMotion, setLive2DCharacterExpression, getLive2DExpressionList, getLive2DMotionGroups } from './live2d/expression-motion.js';
import { renderCharacterLive2DRow, updateLive2DRowState, bindLive2DSettingsEvents, initAllLive2DRowStates, setCharSettingsRefs } from './live2d/char-settings.js';
import { Live2DLazyLoader, LOD_CONFIG, applyLOD, updateAllLOD, Live2DPerformanceMonitor, autoAdjustPerformance, DEFAULT_BIG_BANANA_CONFIG } from './live2d/performance.js';

// === Phase 5: 音频和图片生成 ===
import { TTSManager, setTTSManagerRefs } from './audio/tts-manager.js';
import { BGMManager, setBGMManagerRefs } from './audio/bgm-manager.js';
import { ComfyUIAPI } from './image-gen/comfyui-api.js';
import { optimizeWallhavenTags, handleWallhavenBackgroundSearch, setWallhavenHandlerRefs } from './image-gen/wallhaven-handler.js';
import { handleRealTimeBackgroundGeneration, parseBananaImageFromResponse, handleBananaBackgroundGeneration, setBananaImageRefs } from './image-gen/banana-image.js';

// === Phase 6: 立绘管理器 ===
import { SpriteManager, setSpriteManagerRefs } from './sprite/sprite-manager.js';

// === Phase 7: 逻辑层 ===
import { generateCOTTemplate } from './logic/cot-template.js';
import { getIsGeneratingResponse, setIsGeneratingResponse, getInitializationTime, getGenerationState, getGenerationTimeoutMs, getVerificationDelayMs, resetGenerationState, checkSillyTavernGenerating, verifyGenerationComplete, startGenerationTimeout, stopGenerationTimeout, setGenerationStateRefs } from './logic/generation-state.js';
import { parseGalgameContent, EXPRESSION_LIST, EXPRESSION_TAG_MAP, EXPRESSION_EMOTION_MAP, TTS_EMOTION_LIST, getExpressionEmotion, getExpressionTag, setParserRefs } from './logic/parser.js';
import { WORLDBOOK_NAME, COT_ENTRY_NAME, isCotFormatted, getFormattedContent, saveFormatToSwipe, resetEnhancedModeState, getAvailablePresets, getAvailableProfiles, getAvailableModels, getAvailableWorldbooks, initWorldbookInjectionListener, initEnhancedModeListener, registerTestFunctions, setEnhancedModeRefs } from './logic/enhanced-mode.js';
import { checkWorldbookExists, injectCOTToWorldbook, enableWorldbookGlobally, disableWorldbookGlobally, setWorldbookRefs } from './logic/worldbook.js';
import { setupMessageObserver, setMessageObserverRefs } from './logic/message-observer.js';

// === 延迟引用连接 ===

// Phase 3 延迟引用
setComfyUIHelperRefs({ getSprite });

// Phase 4 延迟引用: Live2DManager <-> Live2DStage (循环依赖)
setLive2DManagerRefs({ Live2DStage });
// Phase 4 延迟引用: LipSync -> TTSManager._getProxiedAudioUrl
setLipSyncRefs({ getProxiedAudioUrl: (url) => TTSManager._getProxiedAudioUrl(url) });

// Phase 7 延迟引用: parser -> enhanced-mode (getFormattedContent)
setParserRefs({ getFormattedContent });

// === Phase 8: UI 层 ===
import { injectStyles } from './ui/styles.js';
import { getFullscreenElement, getModalMountRoot, toggleFullscreen, setupFullscreenChangeListener, setFullscreenRefs } from './ui/fullscreen.js';
import { showToast } from './ui/toast.js';
import { showCustomPopupPanel } from './ui/modal.js';
import { getHistoryFromDatabase, showHistoryModal } from './ui/history.js';
import { getCurrentDisplayMesId, setCurrentDisplayMesId, queueOverlayUpdate, nextOverlayRenderToken, scheduleOverlaySegmentDisplay, ensureGlobalOverlay, renderMainInterface, setChatScrollLock, syncOverlayHeightToChatViewport, adjustGameContentScale, resetGameContentScale, adjustToolbarForSpace, showGlobalOverlay, hideGlobalOverlay, toggleGlobalOverlay, showGeneratingIndicator, hideGeneratingIndicator, updateGeneratingStatus, setupGameContentResizeListener, setOverlayRefs } from './ui/overlay.js';
import { updateNextBtnForGeneratingState, stopNextBtnAnimation, refreshNextBtnDisplay } from './ui/next-btn.js';
import { updateGlobalOverlayContent, updateOverlaySegmentDisplay, refreshOverlayFromLastAiMessage, renderGalgameMessage, setOverlayContentRefs } from './ui/overlay-content.js';
import { showFreeInputModal, sendUserMessage, triggerReroll, getIsRerolling, startSkipping, stopSkipping, startRewinding, stopRewinding, triggerPrevSegment, triggerNextSegment, setupKeyboardShortcuts, makeDraggable, setInteractionRefs } from './ui/interaction.js';
import { renderGalgameChoices, hideGalgameChoices, showPendingChoicesButton, hidePendingChoicesButton, setupOptionsPanelObserver, setChoicesRefs } from './ui/choices.js';
import { renderBGMWidget } from './ui/bgm-widget.js';
import { applyGalgameMode, restoreOriginalViews, hideNonLastFloors, showAllFloors, refreshGalgameViews, setGalgameModeRefs } from './ui/galgame-mode.js';
import { injectGalgameButton, addMenuButton, updateButtonState, setMenuButtonRefs } from './ui/menu-button.js';
import { processNewMessage, showGeneratingStatus, setProcessMessageRefs } from './ui/process-message.js';
import { setupGlobalEventListeners, setEventsRefs } from './ui/events.js';
import { showSettingsPanel, applySettingsToUI, applyBgFillMode, applyTextEffect, setSettingsPanelRefs } from './ui/settings-panel.js';
import { showLive2DSettingsModal } from './ui/live2d-settings-modal.js';
import { showSpriteConfigModal, setSpriteConfigRefs } from './ui/sprite-config.js';
import { showBatchBackgroundUploadDialog, showBackgroundUploadDialog } from './ui/bg-upload.js';
import { ImageCropper, showCharAppearancePromptEditor, showBananaAppearancePicker, showSpriteUploadDialog, showBatchUploadDialog, showCustomExpressionManager } from './ui/sprite-upload.js';
import { importAssetsFromJson, AssetIO, showRemoteZipImportDialog, importFromZipFile, importFromRemoteZip, showImportPackSelector, processZipContents, showImportProgress, showImportError } from './ui/asset-io.js';
import { showCharacterSpritesModal, showPackManagerModal, showTransferDialog, setAssetManagerRefs, setAssetManagerModalRef, renderBananaAppearanceList, refreshBananaAppearancePreviews } from './ui/asset-manager-parts.js';
import { showAssetManagerModal, setAssetManagerModalRefs } from './ui/asset-manager-modal.js';

// Phase 1 延迟引用: expressions -> toast + state + worldbook
setExpressionsRefs({ showToast, getIsEnabled, injectCOTToWorldbook });

// Phase 4 延迟引用: Live2DStage -> toast
setLive2DStageRefs({ showToast });
// Phase 4 延迟引用: PositionEditor -> fullscreen
setPositionEditorRefs({ getModalMountRoot });

// Phase 5 延迟引用: wallhaven-handler -> backgrounds + store + sprite-manager + overlay + toast
setWallhavenHandlerRefs({
  saveBackground,
  getSceneBackgrounds: () => GalgameStore.cache.sceneBackgrounds,
  getMessageSegmentState: () => GalgameStore.cache.segments,
  getSpriteManager: () => SpriteManager,
  updateGlobalOverlayContent,
  showToast,
});

// Phase 6 延迟引用: sprite-manager -> sprites + backgrounds + store + image-packs + bgm
setSpriteManagerRefs({
  getSprite,
  getBackground,
  getSceneBackgrounds: () => GalgameStore.cache.sceneBackgrounds,
  getMessageSegmentState: () => GalgameStore.cache.segments,
  setBackgroundWithTransition,
  clearBackgroundLayers,
  BGMManager,
});

// Phase 8 延迟引用: 各模块 -> showToast
setTTSManagerRefs({ showToast });
setBGMManagerRefs({ showToast });
setWorldbookRefs({ showToast });
setEnhancedModeRefs({ showToast });
setCharSettingsRefs({ showCustomPopupPanel, getModalMountRoot });

// Phase 8 延迟引用: fullscreen -> overlay
setFullscreenRefs({ adjustGameContentScale, resetGameContentScale, adjustToolbarForSpace, showToast });

// Phase 8 延迟引用: generation-state -> next-btn
setGenerationStateRefs({ stopNextBtnAnimation, refreshNextBtnDisplay, updateNextBtnForGeneratingState, updateGeneratingStatus });

// Phase 8 延迟引用: overlay -> overlay-content
setOverlayRefs({ updateOverlaySegmentDisplay });

// Phase 8 延迟引用: overlay-content -> choices
setOverlayContentRefs({ renderGalgameChoices });

// Phase 8 延迟引用: choices -> interaction
setChoicesRefs({ getIsRerolling });

// Phase 8 延迟引用: interaction -> sprite-upload + choices + galgame-mode
setInteractionRefs({ showSpriteUploadDialog, hideGalgameChoices, refreshGalgameViews });

// Phase 8 延迟引用: galgame-mode -> process-message + settings-panel
setGalgameModeRefs({ processNewMessage, applySettingsToUI });

// Phase 8 延迟引用: process-message -> overlay-content + banana-image + settings-panel
setProcessMessageRefs({ updateGlobalOverlayContent, applySettingsToUI, handleRealTimeBackgroundGeneration, handleBananaBackgroundGeneration });

// Phase 5 延迟引用: banana-image -> overlay-content + toast
setBananaImageRefs({ updateGlobalOverlayContent, showToast });

// Phase 8 延迟引用: message-observer -> process-message + menu-button
setMessageObserverRefs({ processNewMessage, injectGalgameButton });

// Phase 8 延迟引用: events -> settings/sprite-upload/overlay-content
setEventsRefs({ showSettingsPanel, showSpriteUploadDialog, updateGlobalOverlayContent });

// Phase 8 延迟引用: menu-button -> settings-panel
setMenuButtonRefs({ showSettingsPanel });

// Phase 8 延迟引用: enhanced-mode -> overlay-content
setEnhancedModeRefs({ showToast, updateGlobalOverlayContent, updateNextBtnForGeneratingState, updateGeneratingStatus });

// Phase 8 延迟引用: settings-panel -> asset-manager-modal
setSettingsPanelRefs({ showAssetManagerModal });

// Phase 8 延迟引用: sprite-config -> sprite-upload + bg-upload
setSpriteConfigRefs({ showBatchUploadDialog, showSpriteUploadDialog, showBackgroundUploadDialog });

// Phase 8 延迟引用: asset-manager-parts -> sprite-upload + bg-upload + banana
setAssetManagerRefs({ showSpriteUploadDialog, showBatchUploadDialog, showBackgroundUploadDialog, showBatchBackgroundUploadDialog, showCustomExpressionManager, showBananaAppearancePicker });

// Phase 8 延迟引用: asset-manager-modal -> sprite-upload + bg-upload + banana + asset-manager-parts (循环依赖)
setAssetManagerModalRefs({ showSpriteUploadDialog, showBatchUploadDialog, showBackgroundUploadDialog, showBatchBackgroundUploadDialog, showCustomExpressionManager, showBananaAppearancePicker });
setAssetManagerModalRef(showAssetManagerModal);

// === Phase 9: 初始化和启动 ===
import './init.js';

// Phase 1-9 验证
console.log(`[${SCRIPT_NAME}] Phase 1-9 模块加载成功, 版本: ${VERSION}`);
