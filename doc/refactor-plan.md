# Galgame 界面插件 - 模块化拆分方案 (v2)

## 0. 概述

**当前状态**: 单文件 `数据库界面插件.js`（23350行）+ `数据库界面插件.css`（3563行）
**目标**: 拆分为多模块 ES Module 源码，通过 esbuild 打包为单个 IIFE JS 文件
**核心约束**: 运行时行为不变、保持 topWindow/jQuery 传递、保持 window.galgame 导出

> **v2 变更**: 修复 executor 审查中指出的所有问题——行号错误、遗漏代码段、getChatMessages 误标、export let live binding、__awaiter 处理、循环依赖等。

---

## 1. 目标目录结构

```
galgame/
├── src/
│   ├── index.js                          # 入口：启动逻辑、循环依赖连接、全局导出
│   │
│   ├── core/
│   │   ├── constants.js                  # SCRIPT_ID, THEME, DB 常量, 表情列表, 正则等
│   │   ├── env.js                        # topWindow, $, jQuery 获取（单例导出）
│   │   ├── store.js                      # GalgameStore 完整定义 + 兼容代理层
│   │   ├── settings.js                   # DEFAULT_SETTINGS, loadSettings, saveSettings, charEnabled
│   │   └── state.js                      # 全局可变状态（isEnabled, hideOtherFloors, isSkipping 等）
│   │
│   ├── db/
│   │   ├── init.js                       # initDB, DB 升级迁移
│   │   ├── sprites.js                    # saveSprite, getSprite, deleteSprite, loadAllSpritesToCache
│   │   ├── backgrounds.js               # saveBackground(s), getAllBackgrounds, loadAllBackgroundsToCache
│   │   ├── live2d-models.js             # saveLive2DModel, getLive2DModel, hasLive2DModel, deleteLive2DModel
│   │   └── image-packs.js              # 图包管理: getCurrentPackId, setCurrentPack, getAllImagePacks, createImagePack, deleteImagePack 等
│   │
│   ├── live2d/
│   │   ├── loader.js                     # Live2DLoader（SDK 缓存加载器）
│   │   ├── manager.js                    # Live2DManager（核心渲染管理器）
│   │   ├── stage.js                      # Live2DStage（舞台渲染器）
│   │   ├── lip-sync.js                   # LipSyncManager（口型同步）
│   │   ├── position-editor.js            # Live2DPositionEditor（位置调整编辑器）
│   │   ├── uploader.js                   # Live2DUploader（模型上传器）
│   │   ├── render-mode.js               # 渲染模式切换（getCharacterUseLive2D, getLive2DConfig 等）
│   │   ├── preload.js                    # Live2DPreloadManager + 统一渲染入口
│   │   ├── expression-motion.js          # EXPRESSION_LIVE2D_MAP, getLive2DExpressionList 等
│   │   ├── char-settings.js              # renderCharacterLive2DRow, bindLive2DSettingsEvents
│   │   └── performance.js               # Live2DLazyLoader, LOD, Live2DPerformanceMonitor
│   │
│   ├── animation/
│   │   └── sprite-animation.js           # SpriteAnimationManager（GSAP 立绘动画）
│   │
│   ├── audio/
│   │   ├── tts-config.js                 # TTS_PROVIDER, 音色列表, getTTSProvider, getTTSEnabled
│   │   ├── tts-manager.js               # TTSManager
│   │   └── bgm-manager.js               # BGMManager
│   │
│   ├── image-gen/
│   │   ├── comfyui-api.js               # ComfyUIAPI（核心 API）
│   │   ├── comfyui-helpers.js            # ComfyUI 设置/工作流辅助函数
│   │   ├── wallhaven-api.js              # WallhavenAPI
│   │   └── wallhaven-handler.js          # Wallhaven 背景搜索处理逻辑
│   │
│   ├── sprite/
│   │   └── sprite-manager.js             # SpriteManager（立绘管理器）
│   │
│   ├── logic/
│   │   ├── parser.js                     # 简化格式预处理 + parseGalgameContent（消息解析）
│   │   ├── enhanced-mode.js              # 加强模式功能函数 + 加强模式监听器 + 二次生成逻辑
│   │   ├── worldbook.js                  # 世界书注入监听器 + COT注入逻辑
│   │   ├── generation-state.js           # 生成状态追踪（不含NEXT按钮动画）
│   │   ├── message-observer.js           # 消息监听、流式输出检测
│   │   └── cot-template.js              # generateCOTTemplate（COT 模板动态生成）
│   │
│   ├── ui/
│   │   ├── styles.js                     # injectStyles（CSS 注入，含 __CSS_PLACEHOLDER__）
│   │   ├── overlay.js                    # 全局覆盖层：ensureGlobalOverlay, 覆盖层更新队列
│   │   ├── overlay-content.js            # updateGlobalOverlayContent, 段落显示逻辑, updateSegmentDisplay
│   │   ├── overlay-show-hide.js          # showGlobalOverlay, hideGlobalOverlay, 生成指示器
│   │   ├── next-btn.js                   # NEXT按钮动画、toggleGlobalOverlay、toggleFullscreen
│   │   ├── dialog.js                     # 快进/快退/触发段落切换
│   │   ├── fullscreen.js                 # 全屏切换、缩放调整、resize 监听
│   │   ├── toast.js                      # showToast
│   │   ├── modal.js                      # getModalMountRoot, showCustomPopupPanel, makeDraggable
│   │   ├── history.js                    # getHistoryFromDatabase, showHistoryModal
│   │   ├── sprite-upload.js              # 立绘上传裁剪对话框 (ImageCropper + 表情管理)
│   │   ├── sprite-config.js              # showSpriteConfigModal（立绘配置面板）
│   │   ├── bg-upload.js                  # 背景上传对话框
│   │   ├── asset-io.js                   # Asset IO Manager (资源导入/导出)
│   │   ├── live2d-settings-modal.js      # showLive2DSettingsModal
│   │   ├── image-pack-modal.js           # showPackManagerModal（图包管理弹窗）
│   │   ├── main-interface.js             # renderMainInterface
│   │   ├── settings-panel.js             # showSettingsPanel（设置面板）
│   │   ├── settings-apply.js             # applySettingsToUI, applyBgFillMode, applyTextEffect
│   │   ├── bgm-widget.js                # renderBGMWidget + BGM UI
│   │   ├── choices.js                    # 选项面板（ensureChoicesLayer, renderGalgameChoices, hideGalgameChoices, checkAndRenderOptions）
│   │   ├── keyboard.js                   # setupKeyboardShortcuts
│   │   ├── events.js                     # setupGlobalEventListeners
│   │   ├── galgame-mode.js              # applyGalgameMode, restoreOriginalViews, hideNonLastFloors, showAllFloors
│   │   ├── menu-button.js               # addMenuButton, updateButtonState, injectGalgameButton
│   │   ├── banana-image-gen.js           # 大香蕉生图相关UI + handleRealTimeBackgroundGeneration
│   │   ├── process-message.js            # processNewMessage（核心消息处理粘合函数）
│   │   └── global-expose.js              # galUI 命名空间暴露
│   │
│   └── utils/
│       ├── html.js                       # decodeHtml, getRawMessageContent, getFormattedSwipeContent
│       ├── chat.js                       # getCharacterListFromDatabase（数据库集成）
│       ├── expressions.js                # 自定义表情管理: getCustomExpressions, saveCustomExpressions, addCustomExpression, deleteCustomExpression, getAllExpressions
│       ├── location-time.js              # getGlobalLocationAndTime, updateLocationTimeDisplay
│       └── dom-cache.js                  # getCachedChatContainer, getCachedGlobalOverlay, invalidateDOMCache
│
├── 数据库界面插件.css                      # 保持原样
├── build.js                               # 改为调用 esbuild
├── esbuild.config.js                      # esbuild 配置文件
├── package.json                           # 新增（含 esbuild 依赖）
└── dist/
    └── 数据库界面插件.dist.js              # 最终产物
```

---

## 2. 精确行号映射表

> **重要**: 以下行号均为精确值，通过逐行扫描源码 section separators 确认。

### 2.0 顶层结构
| 区域 | 行号范围 | 说明 |
|------|---------|------|
| __awaiter polyfill | L1-40 | TypeScript 风格 async polyfill |
| IIFE 开始 | L41 | `(function () { 'use strict';` |
| IIFE 结束 | L23350 | `})();` |

### 2.1 核心层 (core/)

| 文件 | 原始行号 | 行数 | 导出内容 | 依赖 |
|------|---------|------|---------|------|
| `constants.js` | L43-68 + L4959-5078 | ~145 | SCRIPT_ID, SCRIPT_NAME, VERSION, DB_NAME, DB_VERSION, STORE_*, DEFAULT_PACK_*, THEME, BG_TRANSITION_MS, WORLDBOOK_NAME, COT_ENTRY_NAME, EXPRESSION_LIST, EXPRESSION_TAG_MAP, EXPRESSION_EMOTION_MAP, TTS_EMOTION_LIST, RE_* 正则, PARSE_CACHE_MAX_SIZE, CUSTOM_EXPRESSIONS_STORAGE_KEY, CHAR_TTS_VOICE_KEY | 无 |
| `env.js` | L5803-5807 | ~5 | topWindow, $ (jQuery) | 无 |
| `store.js` | L4781-4957 | ~177 | GalgameStore, characterSprites, sceneBackgrounds, messageSegmentState, sessionVoiceCache, parseCache, enhancedModeState, worldbookInjectionState, SETTINGS_STORAGE_KEY... | constants |
| `settings.js` | L5945-6057 + L6840-6930 | ~205 | DEFAULT_COMFYUI_SETTINGS, DEFAULT_SETTINGS, SYSTEM_PROMPT_FOR_SECOND_GENERATE, getSettings/setSettings (getter/setter), charEnabledMap, loadSettings, saveSettings, saveCharEnabled, getCurrentCharId, isCurrentCharEnabled, setCurrentCharEnabled | env, store, constants |
| `state.js` | L5810-5817 + L8017-8027 | ~20 | 全局状态 getter/setter: getDb/setDb, getIsEnabled/setIsEnabled, getHideOtherFloors/setHideOtherFloors, getIsSkipping/setIsSkipping, getSkipTimer/setSkipTimer, getIsRewinding/setIsRewinding, REWIND_HOLD_DELAY, getLastGalgameOptionHash/setLastGalgameOptionHash, getGalgameChoicesVisible/setGalgameChoicesVisible, getPendingOptions/setPendingOptions | 无 |

### 2.2 数据库层 (db/)

| 文件 | 原始行号 | 行数 | 导出内容 | 依赖 |
|------|---------|------|---------|------|
| `init.js` | L8323-8440 | ~118 | initDB, getDb | constants, state |
| `sprites.js` | L8549-8810 | ~262 | saveSprite, batchSaveSprites, getSprite, getAllSpritesForCharacter, deleteSprite, loadAllSpritesToCache | db/init, store, constants |
| `backgrounds.js` | L8811-9026 | ~216 | saveBackground, saveBackgroundsBatch, getBackground, deleteBackground, getAllBackgrounds, loadAllBackgroundsToCache | db/init, store, constants |
| `live2d-models.js` | L8443-8548 | ~106 | saveLive2DModel, getLive2DModel, hasLive2DModel, deleteLive2DModel, getAllLive2DModels | db/init, constants |
| `image-packs.js` | L9027-9406 | ~380 | getCurrentPackId, setCurrentPack, getRenderScope, setRenderScope, getAllImagePacks, createImagePack, deleteImagePack, clearBackgroundLayers, getPackResourceCount, switchBgTransition | db/init, db/backgrounds, store, constants, settings |

### 2.3 动画层 (animation/)

| 文件 | 原始行号 | 行数 | 导出内容 | 依赖 |
|------|---------|------|---------|------|
| `sprite-animation.js` | L70-261 | ~192 | SpriteAnimationManager | 无 (window.gsap) |

### 2.4 Live2D 层 (live2d/)

| 文件 | 原始行号 | 行数 | 导出内容 | 依赖 |
|------|---------|------|---------|------|
| `loader.js` | L264-479 | ~216 | Live2DLoader | constants, env |
| `manager.js` | L482-2101 | ~1620 | Live2DManager | constants, env, loader, db/live2d-models |
| `stage.js` | L2102-2626 | ~525 | Live2DStage | constants, env, manager |
| `lip-sync.js` | L2627-2929 | ~303 | LipSyncManager | constants, env (TTSManager 通过延迟引用注入) |
| `position-editor.js` | L2930-3310 | ~381 | Live2DPositionEditor | constants, env, manager, stage, render-mode |
| `uploader.js` | L3311-3783 | ~473 | Live2DUploader | constants, env, db/live2d-models, manager |
| `render-mode.js` | L3784-3933 | ~150 | CHAR_USE_LIVE2D_KEY, LIVE2D_CONFIG_KEY, getCharacterUseLive2D, getLive2DConfig, saveLive2DConfig, calculateLive2DBaseScale, normalizeLive2DScaleBase | constants, env |
| `preload.js` | L3934-4095 | ~162 | Live2DPreloadManager, renderCharacterVisual, updateCharacterFocus, cleanupCharacterVisuals, cleanupAllVisuals | manager, loader, render-mode, db/live2d-models |
| `expression-motion.js` | L4096-4335 | ~240 | EXPRESSION_LIVE2D_MAP, getLive2DExpressionList, getLive2DMotionGroups, applyLive2DExpression | manager |
| `char-settings.js` | L4336-4579 | ~244 | renderCharacterLive2DRow, updateLive2DRowState, bindLive2DSettingsEvents | env, render-mode, db/live2d-models, manager, uploader |
| `performance.js` | L4580-4780 | ~201 | Live2DLazyLoader, LOD_CONFIG, applyLOD, updateAllLOD, Live2DPerformanceMonitor | manager, render-mode, db/live2d-models |

### 2.5 音频层 (audio/)

| 文件 | 原始行号 | 行数 | 导出内容 | 依赖 |
|------|---------|------|---------|------|
| `tts-config.js` | L5098-5475 | ~378 | TTS_PROVIDER, getTTSProvider, getGptSoVitsConfig, normalizeGptSoVitsVoice, LWB TTS cache, getTTSVoiceList, getTTSVoiceListAsync, TTS_VOICE_LIST (compat), getTTSEnabled, setTTSEnabled, getCharacterTTSVoice, setCharacterTTSVoice, getAllCharacterTTSVoices | constants, env, store, settings |
| `tts-manager.js` | L6196-6839 | ~644 | TTSManager | env, tts-config, settings, constants (lip-sync 通过延迟引用) |
| `bgm-manager.js` | L6058-6194 | ~137 | BGMManager | constants, env (showToast 通过延迟引用) |

### 2.6 图片生成层 (image-gen/)

| 文件 | 原始行号 | 行数 | 导出内容 | 依赖 |
|------|---------|------|---------|------|
| `comfyui-helpers.js` | L6932-7170 | ~239 | getComfyUISettings, saveComfyUISettings, getComfyWorkflows, saveComfyWorkflows, getCharAppearancePrompt/s, bananaGetCharacterAppearance 等 | env, settings, constants |
| `comfyui-api.js` | L7171-7615 | ~445 | ComfyUIAPI (gmFetch, smartFetch, generate) | comfyui-helpers, settings |
| `wallhaven-api.js` | L7616-7894 | ~279 | WallhavenAPI | settings, constants |
| `wallhaven-handler.js` | L19035-19150 | ~116 | WALLHAVEN_TAG_MAPPING, handleWallhavenBackground | wallhaven-api, settings, store |

### 2.7 立绘管理器 (sprite/)

| 文件 | 原始行号 | 行数 | 导出内容 | 依赖 |
|------|---------|------|---------|------|
| `sprite-manager.js` | L9410-10003 | **~594** | SpriteManager | env, constants, animation/sprite-animation, db/sprites, db/backgrounds, live2d/manager, live2d/stage, live2d/render-mode, live2d/expression-motion, live2d/performance, settings |

> **注意**: SpriteManager 在 L10003 结束，**不是** 原计划的 L11313。L10004+ 是简化格式预处理器。

### 2.8 逻辑层 (logic/)

| 文件 | 原始行号 | 行数 | 导出内容 | 依赖 |
|------|---------|------|---------|------|
| `parser.js` | L10004-10483 | ~480 | RE_ILLEGAL_TAGS, cleanIllegalTags, preprocessSimplifiedFormat, getCharTTSVoice, parseGalgameContent | constants, store, settings, state, audio/tts-config, utils/expressions |
| `enhanced-mode.js` | L10484-10810 + L10933-11310 | ~705 | isCotFormatted, getFormattedContent, saveFormatToSwipe, runEnhancedModeGeneration, initEnhancedModeListener, runSecondGeneration + testAddSwipeNoRefresh | env, store, settings, constants, state |
| `worldbook.js` | L10811-10927 + L19593-19796 | ~340 | initWorldbookInjectionListener, checkWorldbookExists, injectCOTToWorldbook, disableAllWorldbookEntries | env, store, settings, constants |
| `generation-state.js` | L5822-5943 | ~122 | generationState, isGeneratingResponse (getter), resetGenerationState, verifyGenerationComplete, startGenerationTimeout 等 | constants, env |
| `message-observer.js` | L18762-18848 | ~87 | setupMessageObserver, setupMessageContentObserver | env, state |
| `cot-template.js` | L5477-5801 | **~325** | generateCOTTemplate | env, constants, db/backgrounds, settings |

> **关键**: `generateCOTTemplate` 是一个 ~325 行的大函数，使用 `__awaiter` 模式，需要访问 db/backgrounds 来获取场景名称列表。原计划将其遗漏。

### 2.9 UI 层 (ui/)

| 文件 | 原始行号 | 行数 | 导出内容 | 依赖 |
|------|---------|------|---------|------|
| `styles.js` | L11312-11338 | ~27 | injectStyles, STYLES_INJECTED_FLAG | env, constants |
| `overlay.js` | L11340-11521 | ~182 | currentDisplayMesId (getter/setter), overlayUpdateQueue, queueOverlayUpdate, ensureGlobalOverlay, scheduleOverlaySegmentDisplay, setChatScrollLock, syncOverlayHeightToChatViewport | env, store, settings, constants |
| `overlay-content.js` | L12180-12830 + L19567-19592 | ~677 | updateGlobalOverlayContent, updateOverlaySegmentDisplay, renderGalgameMessage, updateSegmentDisplay, showGeneratingStatus, refreshGalgameViews | env, store, sprite/sprite-manager, audio/tts-manager, audio/bgm-manager, constants, utils/html, parser |
| `overlay-show-hide.js` | L11665-11742 | ~78 | showGlobalOverlay, hideGlobalOverlay, showGeneratingIndicator, hideGeneratingIndicator, updateGeneratingStatus | env, overlay, fullscreen |
| `next-btn.js` | L11743-11899 | ~157 | updateNextBtnForGeneratingState, stopNextBtnAnimation, refreshNextBtnDisplay, toggleGlobalOverlay, toggleFullscreen | env, store, state, overlay-show-hide, fullscreen |
| `dialog.js` | L23113-23217 | ~105 | startSkipping, stopSkipping, startRewinding, stopRewinding, triggerPrevSegment | env, store, settings, state, audio/tts-manager |
| `fullscreen.js` | L11615-11664 + L11900-11994 | ~145 | adjustGameContentScale, resetGameContentScale, setupFullscreenChangeListener, getFullscreenElement, getModalMountRoot, adjustToolbarForSpace, setupGameContentResizeListener | env, settings |
| `toast.js` | L18754-18761 | ~8 | showToast | env, ui/fullscreen (getModalMountRoot) |
| `modal.js` | L23219-23245 + L23286-23326 | ~68 | showCustomPopupPanel, makeDraggable | env |
| `history.js` | L11995-12176 | **~182** | getHistoryFromDatabase, showHistoryModal | env, constants |
| `sprite-upload.js` | L12937-14932 | **~1996** | ImageCropper, showSpriteUploadDialog (含裁剪+表情管理弹窗) | env, constants, db/sprites, utils/expressions |
| `sprite-config.js` | L20310-20944 | ~635 | showSpriteConfigModal | env, store, constants, db/*, utils/chat |
| `bg-upload.js` | L20946-21254 | ~309 | showBackgroundUploadDialog | env, constants, db/backgrounds, toast |
| `asset-io.js` | L14933-17611 | **~2679** | importAssetsFromJson, showImportPackSelector, showAssetIOManager, 资源导入/导出 | env, constants, db/*, image-packs, store |
| `live2d-settings-modal.js` | L17613-18514 | ~902 | showLive2DSettingsModal | env, live2d/*, settings, db/live2d-models |
| `image-pack-modal.js` | L18515-18753 | ~239 | showPackManagerModal, getAllSpritesFiltered, 资源迁移对话框 | env, db/image-packs, db/sprites, db/backgrounds |
| `main-interface.js` | L11522-11614 | ~93 | renderMainInterface | env, settings, store |
| `settings-panel.js` | L21255-22685 | **~1431** | showSettingsPanel | env, settings, constants, image-gen/comfyui-helpers, audio/tts-config, store |
| `settings-apply.js` | L22686-22836 | ~151 | applySettingsToUI, applyBgFillMode, applyTextEffect | env, settings |
| `bgm-widget.js` | L20192-20273 | ~82 | renderBGMWidget | env, audio/bgm-manager |
| `choices.js` | L19798-20191 | ~394 | ensureChoicesLayer, renderGalgameChoices, hideGalgameChoices, checkAndRenderOptions | env, store, ui/fullscreen |
| `keyboard.js` | L23246-23275 | ~30 | setupKeyboardShortcuts | env, settings, state |
| `events.js` | L12336-12830 | **~495** | setupGlobalEventListeners | env, settings, store, state, 多模块 |
| `galgame-mode.js` | L22837-22909 | ~73 | applyGalgameMode, restoreOriginalViews, hideNonLastFloors, showAllFloors | env, settings, store, overlay-show-hide |
| `menu-button.js` | L22910-22985 | ~76 | injectGalgameButton, addMenuButton, updateButtonState | env, settings |
| `process-message.js` | L19403-19566 | ~164 | processNewMessage (核心消息处理粘合函数) | env, state, settings, store, constants, parser, overlay-content, overlay-show-hide, banana-image-gen, wallhaven-handler, ui/settings-apply, bgm-manager, menu-button, live2d/preload |
| `banana-image-gen.js` | L19151-19401 + L18914-19034 | ~333 | handleBananaBackgroundGeneration, handleBananaImageGeneration, handleRealTimeBackgroundGeneration | env, settings, image-gen/comfyui-*, db/backgrounds, store |
| `global-expose.js` | L20274-20309 | ~36 | exposeGalUI() - galUI 命名空间暴露 | env, state, 多模块引用 |

### 2.10 工具层 (utils/)

| 文件 | 原始行号 | 行数 | 导出内容 | 依赖 |
|------|---------|------|---------|------|
| `html.js` | L18849-18913 | ~65 | decodeHtml, getRawMessageContent, getFormattedSwipeContent | env, constants |
| `chat.js` | L8029-8149 | ~121 | getCharacterListFromDatabase | env, constants |
| `expressions.js` | L7897-8016 | ~120 | getCustomExpressions, saveCustomExpressions, addCustomExpression, deleteCustomExpression, getAllExpressions | constants, env |
| `location-time.js` | L8150-8321 | ~172 | getGlobalLocationAndTime, updateLocationTimeDisplay | env, constants, settings |
| `dom-cache.js` | L5083-5095 | ~13 | getCachedChatContainer, getCachedGlobalOverlay, invalidateDOMCache | store |

---

## 3. 关键设计决策

### 3.1 getChatMessages / setChatMessages

**澄清**: `getChatMessages` 和 `setChatMessages` 是 **SillyTavern 宿主函数**，由 `topWindow` 提供，**不在本文件中定义**。使用方式为 `getChatMessages(mesId, opts)` 直接调用（闭包中可访问宿主全局）。

**处理方式**: 在 `env.js` 中统一暴露宿主 API 引用：

```js
// src/core/env.js
export const topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
export const $ = topWindow.jQuery || window.jQuery;

// SillyTavern 宿主 API（运行时由宿主提供，此处仅做引用转发）
// 注意：这些函数在 IIFE 闭包中本来就可直接访问，但拆分后需要显式引用
export const getChatMessages = topWindow.getChatMessages;
export const setChatMessages = topWindow.setChatMessages;
export const eventOn = topWindow.eventOn || (typeof eventOn !== 'undefined' ? eventOn : null);
export const tavern_events = topWindow.tavern_events || (typeof tavern_events !== 'undefined' ? tavern_events : null);
```

> **执行者注意**: 需要在拆分时确认这些宿主函数的实际访问方式。原始 IIFE 中它们可能作为同作用域的全局变量直接使用（因为 SillyTavern 的 eval/script 注入机制）。如果是这种情况，则不需要通过 topWindow 转发，而是在 esbuild banner 中声明它们。具体方案需要在 Phase 1 时通过运行时测试确认。

### 3.2 export let 活绑定 —— 强制 getter/setter 模式

**问题**: esbuild 在 IIFE 模式下，`export let` 的活绑定（live binding）行为**不可靠**。一个模块中对 `let` 变量的重新赋值，可能不会反映到另一个模块的 import 中。

**强制规则**: 所有跨模块可变状态**必须**使用 getter/setter 函数导出，不允许裸导出 `let` 变量。

```js
// core/state.js - 示例
let _isEnabled = false;
let _hideOtherFloors = false;
let _db = null;
let _isSkipping = false;
let _skipTimer = null;
let _isRewinding = false;
let _rewindTimer = null;
let _rewindHoldTimer = null;
export const REWIND_HOLD_DELAY = 3000;

export function getIsEnabled() { return _isEnabled; }
export function setIsEnabled(v) { _isEnabled = v; }
export function getHideOtherFloors() { return _hideOtherFloors; }
export function setHideOtherFloors(v) { _hideOtherFloors = v; }
export function getDb() { return _db; }
export function setDb(v) { _db = v; }
export function getIsSkipping() { return _isSkipping; }
export function setIsSkipping(v) { _isSkipping = v; }

// choices 相关状态（被 events.js, choices.js, banana-image-gen.js 等跨模块使用）
let _lastGalgameOptionHash = null;
let _galgameChoicesVisible = false;
let _pendingOptions = null;
export function getLastGalgameOptionHash() { return _lastGalgameOptionHash; }
export function setLastGalgameOptionHash(v) { _lastGalgameOptionHash = v; }
export function getGalgameChoicesVisible() { return _galgameChoicesVisible; }
export function setGalgameChoicesVisible(v) { _galgameChoicesVisible = v; }
export function getPendingOptions() { return _pendingOptions; }
export function setPendingOptions(v) { _pendingOptions = v; }
// ... 以此类推
```

**适用范围**:
| 变量 | 所在模块 | 被读取的模块 |
|------|---------|------------|
| `db` | state.js | db/init, db/sprites, db/backgrounds, db/live2d-models, db/image-packs, ui/sprite-config |
| `isEnabled` | state.js | ui/events, ui/galgame-mode, ui/keyboard, ui/overlay, logic/parser, ui/global-expose |
| `hideOtherFloors` | state.js | ui/events, banana-image-gen |
| `settings` | settings.js | 几乎所有模块 |
| `isSkipping` / `isRewinding` | state.js | ui/dialog 内部 + ui/events |
| `currentDisplayMesId` | ui/overlay.js | ui/overlay-content, ui/next-btn |
| `isGeneratingResponse` | logic/generation-state.js | logic, ui |
| `charEnabledMap` | settings.js | settings 内部 |

### 3.3 __awaiter 处理方案

原始代码 L1-40 定义了 `__awaiter` polyfill。代码中大量函数使用 `__awaiter(this, void 0, void 0, function* () { ... yield ... })` 模式。

**策略（二选一，执行时确定）**:

**方案 A（推荐）: 全量转换为 async/await**
- 将所有 `__awaiter(this, void 0, void 0, function* () { ... yield ... })` 转为 `async function() { ... await ... }`
- esbuild `target: ['es2020']` 不降级，直接保留原生 async/await
- 完全移除 `__awaiter` polyfill
- **优点**: 代码更清晰，无需 polyfill
- **缺点**: 转换工作量大，需要逐个确认 `this` 绑定

**方案 B: 保留 __awaiter，注入到 IIFE 内部**
- 在 esbuild 的 `banner.js` 中注入 `__awaiter` 定义（**必须在 IIFE 内部**）
- 原始代码的 `__awaiter` 使用 `this && this.__awaiter` 检查，如果注入在 IIFE 外部，`this` 为 `undefined`（strict mode），会导致错误
- **正确注入方式**: 使用 esbuild `banner: { js: 'const __awaiter = ...' }`

**使用 __awaiter 的函数清单**（需在转换时逐一处理）:
- BGMManager.init, BGMManager.play (L6058+)
- TTSManager 多个方法 (L6196+)
- generateCOTTemplate (L5482)
- updateGlobalOverlayContent (L12181)
- updateSegmentDisplay (L12827)
- showSpriteConfigModal (L20312)
- importAssetsFromJson (L14935)
- showPackManagerModal (L18522)
- showSettingsPanel (L21259)
- injectCOTToWorldbook (L19600+)
- showLive2DSettingsModal (L17619) - 注意这个用了 native async，不是 __awaiter
- 其他 UI 弹窗函数

**this 绑定风险**: `__awaiter(this, ...)` 中的 `this`：
- 在对象方法中（如 `BGMManager.play`），`this` 指向对象本身 → 拆分为模块后如果保持对象字面量模式导出，`this` 仍然正确
- 在普通函数中（如 `generateCOTTemplate`），`this` 指向 IIFE 闭包（严格模式下为 undefined）→ `__awaiter` 内部不依赖 thisArg，所以无影响
- **结论**: `this` 绑定在拆分过程中不会产生问题，因为原始 `__awaiter` 调用的 thisArg 没有被 generator 内部使用

### 3.4 循环依赖处理

已知循环依赖及处理方案：

| 模块 A | 模块 B | 依赖方向 | 解决方案 |
|--------|--------|---------|---------|
| TTSManager | LipSyncManager | 双向：TTS→LipSync.stopSync(), LipSync→TTS._getProxiedAudioUrl() | 延迟引用注入：index.js 中 `setTTSManagerRef()` / `setLipSyncRef()` |
| BGMManager | ui/toast | BGM.init→showToast() | 延迟引用：`setBGMToastRef(showToast)` 在 index.js 注入 |
| generation-state | ui/next-btn | resetGenerationState→stopNextBtnAnimation(), refreshNextBtnDisplay() | **重构**: 将 resetGenerationState 中的 UI 调用改为事件发射（EventBus）或回调注入 |

**resetGenerationState 循环依赖解决方案**:

```js
// logic/generation-state.js
let _onResetCallbacks = [];
export function onGenerationStateReset(cb) { _onResetCallbacks.push(cb); }

export function resetGenerationState(reason) {
  // ... 状态重置逻辑 ...
  // 通知 UI 层
  _onResetCallbacks.forEach(cb => cb(reason));
}

// index.js 中连接
import { onGenerationStateReset } from './logic/generation-state.js';
import { stopNextBtnAnimation, refreshNextBtnDisplay } from './ui/next-btn.js';
onGenerationStateReset(() => {
  stopNextBtnAnimation();
  refreshNextBtnDisplay();
});
```

### 3.5 CSS 处理方案

**保留现有 `__CSS_PLACEHOLDER__` 机制**，与原始 build.js 行为一致。

1. `src/ui/styles.js` 中保留 `const css = \`__CSS_PLACEHOLDER__\`;`
2. CSS 中的 `${THEME.xxx}` 模板变量在 JS 运行时解析（CSS 在模板字符串中）
3. esbuild 打包后，通过 `onEnd` 插件读取 CSS 文件并替换占位符

---

## 4. 依赖关系图

```
constants ← env ← store ← settings ← state
                                         ↑
     ┌───────────────────────────────────┼─────────────────────┐
     │                                   │                     │
   db/init                          utils/*              dom-cache
     │
   ┌─┼──────────────┬──────────────┐
   │ │              │              │
db/sprites  db/backgrounds  db/live2d-models  db/image-packs
   │               │              │                │
   │               └──────────────┤                │
   │                              │                │
   │         live2d/loader        │                │
   │              │               │                │
   │         live2d/manager ──────┘                │
   │           │    │                              │
   │           │  live2d/stage                     │
   │           │    │                              │
   │        live2d/lip-sync ←→ audio/tts-manager   │
   │           │                     │             │
   │        live2d/position-editor   │             │
   │        live2d/uploader          │             │
   │        live2d/render-mode       │             │
   │        live2d/preload           │             │
   │        live2d/expression-motion │             │
   │        live2d/char-settings     │             │
   │        live2d/performance       │             │
   │                                 │             │
   │        audio/tts-config         │             │
   │        audio/bgm-manager        │             │
   │                                 │             │
   │        image-gen/comfyui-helpers              │
   │              │                                │
   │        image-gen/comfyui-api                  │
   │        image-gen/wallhaven-api                │
   │        image-gen/wallhaven-handler            │
   │                                               │
   └── sprite/sprite-manager ←── (animation, live2d, db, settings)
                  │
            logic/parser ← logic/cot-template
            logic/enhanced-mode
            logic/worldbook
            logic/generation-state ──→ (回调注入) ──→ ui/next-btn
            logic/message-observer
                  │
               ui/* ←── (全部上层模块)
                  │
              src/index.js (入口，组装所有模块，注入循环依赖)
```

---

## 5. 拆分顺序（按依赖从少到多）

### Phase 1: 基础设施层（无外部依赖）

| 步骤 | 模块 | 行数 | 依赖 |
|------|------|------|------|
| 1.1 | `core/constants.js` | ~145 | 无 |
| 1.2 | `core/env.js` | ~5 | 无 |
| 1.3 | `core/store.js` | ~177 | constants |
| 1.4 | `core/settings.js` | ~205 | env, store, constants |
| 1.5 | `core/state.js` | ~20 | 无 |
| 1.6 | `utils/html.js` | ~65 | env, constants |
| 1.7 | `utils/chat.js` | ~121 | env, constants |
| 1.8 | `utils/expressions.js` | ~120 | constants, env |
| 1.9 | `utils/location-time.js` | ~172 | env, constants, settings |
| 1.10 | `utils/dom-cache.js` | ~13 | store |

**验证**:
- 确保 getter/setter 模式在 esbuild IIFE 中正确工作（写一个最小测试）
- 确认宿主 API（getChatMessages 等）的实际访问方式

### Phase 2: 数据层

| 步骤 | 模块 | 行数 | 依赖 |
|------|------|------|------|
| 2.1 | `db/init.js` | ~118 | constants, state |
| 2.2 | `db/live2d-models.js` | ~106 | db/init, constants |
| 2.3 | `db/sprites.js` | ~262 | db/init, store, constants |
| 2.4 | `db/backgrounds.js` | ~216 | db/init, store, constants |
| 2.5 | `db/image-packs.js` | ~380 | db/init, db/backgrounds, store, constants, settings |

**验证**: initDB() 正常工作，CRUD 操作正确。

### Phase 3: 独立功能模块

| 步骤 | 模块 | 行数 | 依赖 |
|------|------|------|------|
| 3.1 | `animation/sprite-animation.js` | ~192 | 无 |
| 3.2 | `live2d/render-mode.js` | ~150 | constants, env |
| 3.3 | `live2d/loader.js` | ~216 | constants, env |
| 3.4 | `audio/tts-config.js` | ~378 | constants, env, store, settings |
| 3.5 | `image-gen/comfyui-helpers.js` | ~239 | env, settings, constants |
| 3.6 | `image-gen/wallhaven-api.js` | ~279 | settings, constants |

**验证**: 各模块独立加载和功能测试。

### Phase 4: 核心管理器

| 步骤 | 模块 | 行数 | 依赖 |
|------|------|------|------|
| 4.1 | `live2d/manager.js` | ~1620 | constants, env, loader, db/live2d-models, render-mode |
| 4.2 | `live2d/stage.js` | ~525 | constants, env, manager |
| 4.3 | `live2d/lip-sync.js` | ~303 | constants, env |
| 4.4 | `live2d/position-editor.js` | ~381 | constants, env, manager, stage, render-mode |
| 4.5 | `live2d/uploader.js` | ~473 | constants, env, db/live2d-models, manager |
| 4.6 | `live2d/preload.js` | ~162 | manager, loader, render-mode, db/live2d-models |
| 4.7 | `live2d/expression-motion.js` | ~240 | manager |
| 4.8 | `live2d/char-settings.js` | ~244 | env, render-mode, db/live2d-models, manager, uploader |
| 4.9 | `live2d/performance.js` | ~201 | manager, render-mode, db/live2d-models |

**验证**: Live2D 模型加载、渲染、交互正常。

### Phase 5: 音频和图片生成

| 步骤 | 模块 | 行数 | 依赖 |
|------|------|------|------|
| 5.1 | `audio/tts-manager.js` | ~644 | env, tts-config, settings, constants |
| 5.2 | `audio/bgm-manager.js` | ~137 | constants, env |
| 5.3 | `image-gen/comfyui-api.js` | ~445 | comfyui-helpers, settings |
| 5.4 | `image-gen/wallhaven-handler.js` | ~116 | wallhaven-api, settings, store |

**验证**: TTS 播放、BGM 播放、ComfyUI 生成、Wallhaven 搜索正常。

### Phase 6: 立绘管理器

| 步骤 | 模块 | 行数 | 依赖 |
|------|------|------|------|
| 6.1 | `sprite/sprite-manager.js` | ~594 | env, constants, animation, db, live2d, settings |

**验证**: 立绘切换、动画、Live2D 渲染协调正常。

### Phase 7: 逻辑层

| 步骤 | 模块 | 行数 | 依赖 |
|------|------|------|------|
| 7.1 | `logic/cot-template.js` | ~325 | env, constants, db/backgrounds, settings |
| 7.2 | `logic/parser.js` | ~480 | constants, store, settings, state, tts-config, expressions |
| 7.3 | `logic/generation-state.js` | ~122 | constants, env |
| 7.4 | `logic/enhanced-mode.js` | ~705 | env, store, settings, constants, state |
| 7.5 | `logic/worldbook.js` | ~340 | env, store, settings, constants |
| 7.6 | `logic/message-observer.js` | ~87 | env, state |

**验证**: 消息解析正确，加强模式流程正常，COT模板生成正确。

### Phase 8: UI 层

| 步骤 | 模块 | 行数 | 依赖 |
|------|------|------|------|
| 8.1 | `ui/styles.js` | ~27 | env, constants |
| 8.2 | `ui/toast.js` | ~8 | env, fullscreen |
| 8.3 | `ui/modal.js` | ~108 | env |
| 8.4 | `ui/fullscreen.js` | ~145 | env, settings |
| 8.5 | `ui/overlay.js` | ~275 | env, store, settings, constants |
| 8.6 | `ui/overlay-show-hide.js` | ~78 | env, overlay, fullscreen |
| 8.7 | `ui/overlay-content.js` | ~651 | env, store, sprite-manager, tts, bgm |
| 8.8 | `ui/next-btn.js` | ~157 | env, store, state, overlay-show-hide, fullscreen |
| 8.9 | `ui/history.js` | ~182 | env, constants |
| 8.10 | `ui/dialog.js` | ~105 | env, store, settings, state, tts |
| 8.11 | `ui/bgm-widget.js` | ~82 | env, bgm-manager |
| 8.12 | `ui/choices.js` | ~394 | env, store, fullscreen |
| 8.13 | `ui/keyboard.js` | ~30 | env, settings, state |
| 8.14 | `ui/events.js` | ~495 | env, settings, store, state, 多模块 |
| 8.15 | `ui/galgame-mode.js` | ~73 | env, settings, store, overlay-show-hide |
| 8.16 | `ui/menu-button.js` | ~76 | env, settings |
| 8.17 | `ui/main-interface.js` | ~93 | env, settings, store |
| 8.18 | `ui/settings-apply.js` | ~151 | env, settings |
| 8.19 | `ui/sprite-upload.js` | ~1996 | env, constants, db/sprites, expressions |
| 8.20 | `ui/sprite-config.js` | ~635 | env, store, constants, db/*, chat |
| 8.21 | `ui/bg-upload.js` | ~309 | env, constants, db/backgrounds, toast |
| 8.22 | `ui/asset-io.js` | ~2679 | env, constants, db/*, image-packs, store |
| 8.23 | `ui/live2d-settings-modal.js` | ~902 | env, live2d/*, settings, db |
| 8.24 | `ui/image-pack-modal.js` | ~239 | env, db/image-packs, db/sprites, db/backgrounds |
| 8.25 | `ui/settings-panel.js` | ~1431 | env, settings, constants, comfyui, tts-config, store |
| 8.26 | `ui/banana-image-gen.js` | ~333 | env, settings, image-gen/*, db/backgrounds, store |
| 8.27 | `ui/process-message.js` | ~164 | env, state, settings, store, parser, overlay-*, banana-image-gen, wallhaven-handler, menu-button, live2d/preload |
| 8.28 | `ui/global-expose.js` | ~36 | env, state, 多模块 |

**验证**: 全部 UI 交互、弹窗、事件监听正常。

### Phase 9: 入口和全局导出

| 步骤 | 模块 | 行数 | 依赖 |
|------|------|------|------|
| 9.1 | `src/index.js` | ~150 | 所有模块 |

**验证**: 打包产物与原文件功能一致。

---

## 6. 构建方案

### 6.1 esbuild 配置

```js
// esbuild.config.js
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// CSS 注入插件
const cssPlugin = {
  name: 'css-placeholder',
  setup(build) {
    build.onEnd(result => {
      if (result.errors.length > 0) return;

      const cssFile = path.join(__dirname, '数据库界面插件.css');
      const css = fs.readFileSync(cssFile, 'utf8')
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`');
        // 注意：不转义 $ 符号，保留 ${THEME.xxx} 模板变量（与原始 build.js 一致）

      const outFile = path.join(__dirname, 'dist', '数据库界面插件.dist.js');
      let js = fs.readFileSync(outFile, 'utf8');
      js = js.replace('__CSS_PLACEHOLDER__', css);
      fs.writeFileSync(outFile, js, 'utf8');
    });
  },
};

esbuild.build({
  entryPoints: ['src/index.js'],
  bundle: true,
  outfile: 'dist/数据库界面插件.dist.js',
  format: 'iife',
  target: ['es2020'],
  platform: 'browser',

  // 不压缩，保持可读性
  minify: false,

  // 不做 tree-shaking（所有代码都需要，避免副作用函数被剔除）
  treeShaking: false,

  // esbuild 的 IIFE 模式自动包装

  // 插件
  plugins: [cssPlugin],

  // 如果保留 __awaiter（方案 B），使用 banner 注入到 IIFE 内部：
  // banner: {
  //   js: `var __awaiter = function(thisArg, _arguments, P, generator) { ... };`,
  // },

  // sourcemap（开发阶段使用，发布时关闭）
  sourcemap: false,

}).then(() => {
  console.log('Build complete!');
}).catch(() => process.exit(1));
```

> **注意**: 如果选择方案 A（全量 async/await），则无需 __awaiter polyfill 相关配置。如果选择方案 B，**必须**使用 `banner` 将 polyfill 注入到 IIFE 内部（不是 `onEnd` 外部拼接，否则 strict mode 下 `this` 为 undefined）。

### 6.2 package.json

```json
{
  "name": "galgame-ui-plugin",
  "version": "2.2.5",
  "private": true,
  "scripts": {
    "build": "node esbuild.config.js",
    "dev": "node esbuild.config.js --watch"
  },
  "devDependencies": {
    "esbuild": "^0.24.0"
  }
}
```

### 6.3 入口文件设计 (src/index.js)

```js
// src/index.js
// 所有模块在此汇聚，esbuild 以 IIFE 格式打包

// === Phase 1: 基础设施 ===
import { SCRIPT_ID, SCRIPT_NAME, VERSION } from './core/constants.js';
import { topWindow, $ } from './core/env.js';
import { GalgameStore } from './core/store.js';
import { getSettings, loadSettings, isCurrentCharEnabled, getCurrentCharId, setCurrentCharEnabled } from './core/settings.js';
import { setIsEnabled, setHideOtherFloors, setDb } from './core/state.js';

// === Phase 2: 数据库 ===
import { initDB } from './db/init.js';
import { loadAllSpritesToCache, saveSprite, getSprite, deleteSprite } from './db/sprites.js';
import { loadAllBackgroundsToCache, getAllBackgrounds } from './db/backgrounds.js';

// === Phase 3: 独立功能 ===
import { SpriteAnimationManager } from './animation/sprite-animation.js';

// === Phase 4: Live2D ===
import { Live2DManager } from './live2d/manager.js';
import { Live2DStage } from './live2d/stage.js';
import { LipSyncManager, setTTSManagerRef as setLipSyncTTSRef } from './live2d/lip-sync.js';
import { Live2DPreloadManager } from './live2d/preload.js';

// === Phase 5: 音频 ===
import { TTSManager, setLipSyncRef as setTTSLipSyncRef } from './audio/tts-manager.js';
import { BGMManager, setToastRef as setBGMToastRef } from './audio/bgm-manager.js';

// === Phase 6: 立绘管理器 ===
import { SpriteManager } from './sprite/sprite-manager.js';

// === Phase 7: 逻辑 ===
import { parseGalgameContent } from './logic/parser.js';
import { resetGenerationState, onGenerationStateReset } from './logic/generation-state.js';
import { initEnhancedModeListener } from './logic/enhanced-mode.js';
import { initWorldbookInjectionListener } from './logic/worldbook.js';

// === Phase 8: UI ===
import { injectStyles } from './ui/styles.js';
import { showToast } from './ui/toast.js';
import { stopNextBtnAnimation, refreshNextBtnDisplay } from './ui/next-btn.js';
import { setupGlobalEventListeners } from './ui/events.js';
import { setupKeyboardShortcuts } from './ui/keyboard.js';
import { setupMessageObserver } from './logic/message-observer.js';
import { applyGalgameMode, restoreOriginalViews } from './ui/galgame-mode.js';
import { addMenuButton } from './ui/menu-button.js';
// ... 更多 UI 导入

// === 循环依赖连接 ===
setLipSyncTTSRef(TTSManager);
setTTSLipSyncRef(LipSyncManager);
setBGMToastRef(showToast);
onGenerationStateReset(() => {
  stopNextBtnAnimation();
  refreshNextBtnDisplay();
});

// === 暴露 GalgameStore 到全局 ===
topWindow.GalgameStore = GalgameStore;

// === init 函数 ===
async function init() {
  console.log(`[${SCRIPT_NAME}] v${VERSION} 开始初始化...`);
  try {
    loadSettings();
    const settings = getSettings();
    setIsEnabled(isCurrentCharEnabled());
    setHideOtherFloors(settings.hideOtherFloors);
    await initDB();
    await loadAllSpritesToCache();
    await loadAllBackgroundsToCache();
    SpriteManager.init();
    Live2DPreloadManager.scheduleSdkPreload('init');
    injectStyles();
    resetGenerationState('页面初始化（事件注册前）');

    setTimeout(() => {
      setupGlobalEventListeners();
      setupKeyboardShortcuts();
      setupMessageObserver();
      initWorldbookInjectionListener();
      initEnhancedModeListener();
      addMenuButton();
      // ... 完整的 setTimeout 初始化逻辑（从原始 init L22986-23112 复制）
    }, 1500);

    console.log(`[${SCRIPT_NAME}] v${VERSION} 初始化完成`);
  } catch (e) {
    console.error(`[${SCRIPT_NAME}] 初始化失败:`, e);
  }
}

// === 启动 ===
if ($ && topWindow.document.readyState === 'complete') {
  init();
} else {
  topWindow.addEventListener('load', init);
}

// === 全局导出 ===
topWindow.LipSyncManager = LipSyncManager;
topWindow.Live2DManager = Live2DManager;
topWindow.TTSManager = TTSManager;
topWindow.BGMManager = BGMManager;

topWindow.galgame = topWindow.galgame || {};
topWindow.galgame.LipSyncManager = LipSyncManager;
topWindow.galgame.Live2DManager = Live2DManager;
topWindow.galgame.TTSManager = TTSManager;
topWindow.galgame.BGMManager = BGMManager;

console.log(`[${SCRIPT_NAME}] 全局导出完成`);
```

---

## 7. 验证方案

### 7.1 每步验证

每完成一个 Phase 后：

1. **编译检查**: `node esbuild.config.js` 无错误
2. **产物体积对比**: dist 文件大小应与原文件接近（误差 <5%）
3. **文本对比**: 使用 diff 工具对比关键输出段（全局导出部分、init 函数等）
4. **getter/setter 验证**: 在 Phase 1 完成后，专门测试跨模块状态共享是否正确
5. **功能验证清单**:

| 功能 | 验证方法 |
|------|---------|
| 插件加载 | 安装到 SillyTavern，F12 控制台无报错 |
| Galgame 模式启用 | 点击菜单按钮，覆盖层显示 |
| 立绘显示 | 发送消息，角色立绘正常渲染 |
| Live2D 渲染 | 上传 Live2D 模型，正常显示和交互 |
| TTS 播放 | 启用 TTS，对话自动播放语音 |
| BGM 播放 | BGM 标签触发，音乐正常播放 |
| 背景切换 | background 标签触发，背景正常切换 |
| 全屏模式 | 全屏切换正常 |
| 设置面板 | 所有设置项可读可写 |
| 快捷键 | 空格/回车/Ctrl 快进正常 |
| 全局导出 | `window.galgame.TTSManager` 等可访问 |
| 图包管理 | 图包切换、创建、删除正常 |
| 历史记录 | 历史弹窗显示正常 |
| COT 模板 | 世界书 COT 模板动态生成正确 |

### 7.2 黄金等价验证

```bash
# 1. 保存原始 dist 文件作为基准
cp dist/数据库界面插件.dist.js dist/数据库界面插件.dist.baseline.js

# 2. 拆分完成后重新构建
node esbuild.config.js

# 3. 对比关键行为（非逐字对比，而是行为等价）
# - 全局变量导出
# - 函数签名
# - 事件监听注册
```

### 7.3 回滚策略

- 原始 `数据库界面插件.js` 和 `build.js` 保留不删除
- 可以随时通过 `node build.js` 回退到原始构建流程
- Git 分支: 在 `refactor/modularize` 分支上操作

---

## 8. 风险和注意事项

### 8.1 高风险点

1. **export let 活绑定不可靠**: esbuild IIFE 模式下 `export let` 的 live binding 行为不保证。**必须使用 getter/setter 模式**。这是强制规则，不是建议。

2. **this 指向**: 对象字面量方法（如 `Live2DManager.loadModel`、`SpriteManager.init` 等）中的 `this` 指向取决于调用方式。**保持对象字面量模式导出**，不要拆散为独立函数。

3. **初始化顺序**: 某些模块在定义时就引用了其他模块。esbuild 打包时模块执行顺序由 import 图决定，需确保无循环。

4. **CSS 模板变量**: `数据库界面插件.css` 中使用了 `${THEME.xxx}` 语法，在 `injectStyles()` 的模板字符串中解析。拆分后 THEME 通过 `constants.js` 导入。

5. **resetGenerationState 循环依赖**: 此函数调用 UI 层的 `stopNextBtnAnimation()` 和 `refreshNextBtnDisplay()`，必须通过回调/事件机制解耦。

### 8.2 中风险点

1. **Live2DManager 体量大**（1620行）: 不建议首轮拆分时过度细分。

2. **asset-io.js 体量极大**（2679行）: 资源导入/导出逻辑复杂，但属于独立弹窗逻辑，可后续进一步拆分。

3. **settings-panel.js 体量大**（1431行）: 设置面板 UI 代码量大，可后续拆分为子组件。

4. **sprite-upload.js 体量大**（1996行）: ImageCropper + 表情管理弹窗，逻辑耦合但与外部依赖少。

### 8.3 低风险点

1. 常量提取、工具函数提取（无状态）
2. CSS 文件保持不变
3. dist 输出路径保持不变

---

## 9. 完整行号覆盖检查清单

确保 23350 行全部被分配到某个模块：

| 行号范围 | 分配到模块 | 状态 |
|---------|----------|------|
| L1-40 | __awaiter polyfill → 移除或 esbuild banner | OK |
| L41 | IIFE 开始 → esbuild 自动生成 | OK |
| L43-68 | core/constants.js | OK |
| L70-261 | animation/sprite-animation.js | OK |
| L264-479 | live2d/loader.js | OK |
| L482-2101 | live2d/manager.js | OK |
| L2102-2626 | live2d/stage.js | OK |
| L2627-2929 | live2d/lip-sync.js | OK |
| L2930-3310 | live2d/position-editor.js | OK |
| L3311-3783 | live2d/uploader.js | OK |
| L3784-3933 | live2d/render-mode.js | OK |
| L3934-4095 | live2d/preload.js | OK |
| L4096-4335 | live2d/expression-motion.js | OK |
| L4336-4579 | live2d/char-settings.js | OK |
| L4580-4780 | live2d/performance.js | OK |
| L4781-4957 | core/store.js | OK |
| L4959-5078 | core/constants.js (第二段) | OK |
| L5083-5095 | utils/dom-cache.js | OK |
| L5098-5475 | audio/tts-config.js | OK |
| L5477-5801 | logic/cot-template.js | OK |
| L5803-5807 | core/env.js | OK |
| L5810-5817 | core/state.js (第一段) | OK |
| L5822-5943 | logic/generation-state.js | OK |
| L5945-6057 | core/settings.js (第一段) | OK |
| L6058-6194 | audio/bgm-manager.js | OK |
| L6196-6839 | audio/tts-manager.js | OK |
| L6840-6930 | core/settings.js (第二段) | OK |
| L6932-7170 | image-gen/comfyui-helpers.js | OK |
| L7171-7615 | image-gen/comfyui-api.js | OK |
| L7616-7894 | image-gen/wallhaven-api.js | OK |
| L7897-8016 | utils/expressions.js | OK |
| L8017-8027 | core/state.js (第二段) | OK |
| L8029-8149 | utils/chat.js | OK |
| L8150-8321 | utils/location-time.js | OK |
| L8323-8440 | db/init.js | OK |
| L8443-8548 | db/live2d-models.js | OK |
| L8549-8810 | db/sprites.js | OK |
| L8811-9026 | db/backgrounds.js | OK |
| L9027-9406 | db/image-packs.js | OK |
| L9410-10003 | sprite/sprite-manager.js | OK |
| L10004-10121 | logic/parser.js (简化格式预处理部分) | OK |
| L10123-10483 | logic/parser.js (parseGalgameContent 部分) | OK |
| L10484-10810 | logic/enhanced-mode.js (功能函数部分) | OK |
| L10811-10927 | logic/worldbook.js (监听器部分) | OK |
| L10929-11310 | logic/enhanced-mode.js (监听器 + 测试函数部分) | OK |
| L11312-11338 | ui/styles.js | OK |
| L11340-11521 | ui/overlay.js | OK |
| L11522-11614 | ui/main-interface.js | OK |
| L11615-11664 | ui/fullscreen.js (缩放调整部分) | OK |
| L11665-11742 | ui/overlay-show-hide.js | OK |
| L11743-11899 | ui/next-btn.js | OK |
| L11900-11994 | ui/fullscreen.js (监听器部分) | OK |
| L11995-12176 | ui/history.js | OK |
| L12180-12830 | ui/overlay-content.js | OK |
| L12831-12936 | ui/events.js 附属交互函数 (showFreeInputModal, sendUserMessage, triggerReroll) | OK |
| L12937-14932 | ui/sprite-upload.js | OK |
| L14933-17611 | ui/asset-io.js | OK |
| L17613-18514 | ui/live2d-settings-modal.js | OK |
| L18515-18753 | ui/image-pack-modal.js | OK |
| L18754-18761 | ui/toast.js | OK |
| L18762-18848 | logic/message-observer.js | OK |
| L18849-18913 | utils/html.js | OK |
| L18914-19034 | ui/banana-image-gen.js (handleRealTimeBackgroundGeneration) | OK |
| L19035-19150 | image-gen/wallhaven-handler.js | OK |
| L19151-19401 | ui/banana-image-gen.js (主体部分) | OK |
| L19403-19566 | ui/process-message.js (processNewMessage) | OK |
| L19567-19592 | ui/overlay-content.js 附属 (showGeneratingStatus, refreshGalgameViews) | OK |
| L19593-19796 | logic/worldbook.js (COT 注入部分) | OK |
| L19798-20191 | ui/choices.js | OK |
| L20192-20273 | ui/bgm-widget.js | OK |
| L20274-20309 | ui/global-expose.js | OK |
| L20310-20944 | ui/sprite-config.js | OK |
| L20946-21254 | ui/bg-upload.js | OK |
| L21255-22685 | ui/settings-panel.js | OK |
| L22686-22836 | ui/settings-apply.js | OK |
| L22837-22909 | ui/galgame-mode.js | OK |
| L22910-22985 | ui/menu-button.js | OK |
| L22986-23112 | src/index.js (init 函数) | OK |
| L23113-23217 | ui/dialog.js | OK |
| L23219-23245 | ui/modal.js (showCustomPopupPanel) | OK |
| L23246-23275 | ui/keyboard.js | OK |
| L23277-23285 | ui/dialog.js (triggerNextSegment) | OK |
| L23286-23326 | ui/modal.js (makeDraggable) | OK |
| L23327-23332 | src/index.js (启动触发) | OK |
| L23334-23350 | src/index.js (全局导出) | OK |

> **总计**: ~48 个模块文件，覆盖全部 23350 行代码。

---

## 10. 与原计划的对比变更日志

| 问题编号 | 问题描述 | 修复内容 |
|---------|---------|---------|
| S-1 | SpriteManager 行号错误 (L9410-11313) | 修正为 L9410-10003 (~594行) |
| S-2 | getChatMessages 误标为自定义函数 | 移至 env.js 作为宿主 API 引用转发 |
| S-3 | export let live binding 仅"建议" | 改为**强制规则**，getter/setter 模式 |
| S-4 | tts-config.js 行号倒置 (L5098-5054) | 修正为 L5098-5475 |
| S-5 | events.js 行号倒置 (L12337-12179) | 修正为 L12336-12830 |
| S-6 | chat.js 行号倒置 (L8029-8016) | 修正为 L8029-8149 |
| M-1 | __awaiter this 绑定风险 | 补充详细分析，确认无影响 |
| M-2 | resetGenerationState 循环依赖 | 采用回调注入模式解耦 |
| M-3 | 遗漏: 图包管理 L9027-9406 | 新增 db/image-packs.js |
| M-4 | 遗漏: 历史记录 L11995-12176 | 新增 ui/history.js |
| M-5 | 遗漏: showGlobalOverlay/hideGlobalOverlay L11665-11742 | 新增 ui/overlay-show-hide.js |
| M-6 | 遗漏: NEXT按钮动画 L11743-11899 | 新增 ui/next-btn.js |
| M-7 | 遗漏: 简化格式预处理器 L10004-10121 | 合并到 logic/parser.js |
| M-8 | 遗漏: generateCOTTemplate L5477-5801 | 新增 logic/cot-template.js |
| M-9 | 遗漏: 自定义表情管理 L7897-8016 | 新增 utils/expressions.js |
| M-10 | 遗漏: 全局状态变量 L8017-8027 | 合并到 core/state.js |
| M-11 | 遗漏: location/time L8150-8321 | 新增 utils/location-time.js |
| M-12 | 遗漏: 立绘上传对话框 L12937-14932 | 新增 ui/sprite-upload.js |
| M-13 | 遗漏: asset-io L14933-17611 | 新增 ui/asset-io.js |
| M-14 | 遗漏: 图包管理弹窗 L18515-18753 | 新增 ui/image-pack-modal.js |
| M-15 | 遗漏: 设置面板 L21255-22685 | 新增 ui/settings-panel.js |
| M-16 | 遗漏: 背景上传对话框 L20946-21254 | 新增 ui/bg-upload.js |
| M-17 | 遗漏: 设置应用 L22686-22836 | 新增 ui/settings-apply.js |
| M-18 | 遗漏: 全局函数暴露 L20274-20309 | 新增 ui/global-expose.js |
| M-19 | 遗漏: 生成指示器 L11699-11741 | 合并到 ui/overlay-show-hide.js |
| L-1 | __awaiter polyfill 注入位置 | 明确：必须在 IIFE 内部（使用 banner），或全量转 async/await |
| L-2 | 新增完整行号覆盖检查清单 | 第 9 节 |
| L-3 | 新增 core/state.js | 集中管理全局可变状态 |

### v2.1 修正 (executor 第二轮审查)

| 问题编号 | 问题描述 | 修复内容 |
|---------|---------|---------|
| R2-1 | CSS 占位符中错误转义 $ 符号 | **严重**: 移除 `.replace(/\$/g, '\\$')`，与原始 build.js 保持一致，保留 `${THEME.xxx}` 模板变量 |
| R2-2 | modal.js / keyboard.js 行号重叠 (L23219-23326 与 L23246-23275) | modal.js 修正为 L23219-23245 + L23286-23326，keyboard.js 为 L23246-23275 |
| R2-3 | overlay.js / main-interface.js 行号分界 | overlay.js 修正为 L11340-11521，main-interface.js 为 L11522-11614 |
| R2-4 | state.js 遗漏 choices 相关变量 | 补充 lastGalgameOptionHash, galgameChoicesVisible, pendingOptions 的 getter/setter（被 events.js, choices.js, banana-image-gen.js 等跨模块使用） |
| R2-5 | processNewMessage (L19403-19566) 归属不当 | 从 banana-image-gen.js 中分离出来，新增 ui/process-message.js 作为核心消息处理粘合函数 |
| R2-6 | refreshGalgameViews (L19577-19592) 归属不明 | 明确归入 ui/overlay-content.js（调用 parseGalgameContent + renderGalgameMessage） |
