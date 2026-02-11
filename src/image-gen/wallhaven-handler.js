import { SCRIPT_NAME } from '../core/constants.js';
import { getSettings } from '../core/settings.js';
import { WallhavenAPI } from './wallhaven-api.js';
import { BGMManager } from '../audio/bgm-manager.js';

// 延迟引用: saveBackground, sceneBackgrounds, messageSegmentState, SpriteManager, updateGlobalOverlayContent, showToast
let _saveBackgroundRef = null;
let _getSceneBackgroundsRef = null;
let _getMessageSegmentStateRef = null;
let _getSpriteManagerRef = null;
let _updateGlobalOverlayContentRef = null;
let _showToastRef = null;

export function setWallhavenHandlerRefs({
  saveBackground,
  getSceneBackgrounds,
  getMessageSegmentState,
  getSpriteManager,
  updateGlobalOverlayContent,
  showToast,
}) {
  if (saveBackground) _saveBackgroundRef = saveBackground;
  if (getSceneBackgrounds) _getSceneBackgroundsRef = getSceneBackgrounds;
  if (getMessageSegmentState) _getMessageSegmentStateRef = getMessageSegmentState;
  if (getSpriteManager) _getSpriteManagerRef = getSpriteManager;
  if (updateGlobalOverlayContent) _updateGlobalOverlayContentRef = updateGlobalOverlayContent;
  if (showToast) _showToastRef = showToast;
}

// ============================================
// Wallhaven 标签优化 & 背景搜索
// ============================================

const WALLHAVEN_TAG_MAPPING = {
  'study': 'library',
  'chinese': 'asian',
  'japanese': 'asian',
  'room': 'interior',
  'house': 'building',
  'ancient': '',
  'traditional': '',
  'historical': '',
  'background': '',
  'scenery': '',
  'atmosphere': '',
  'detailed': '',
  'calligraphy': '',
  'brushes': '',
};

export function optimizeWallhavenTags(rawTags) {
  const tagList = rawTags.split(',').map(t => t.trim().toLowerCase()).filter(t => t);

  let optimized = tagList.map(tag => WALLHAVEN_TAG_MAPPING[tag] || tag).filter(t => t);

  optimized = [...new Set(optimized)];

  optimized = optimized.filter(t => t.length >= 3 && t.length <= 15);

  optimized = optimized.slice(0, 4);

  if (optimized.length < 2) {
    optimized.push('interior');
  }

  console.log(`[${SCRIPT_NAME}] Wallhaven: 标签优化 ${tagList.join(', ')} → ${optimized.join(', ')}`);
  return optimized;
}

export function handleWallhavenBackgroundSearch(sceneName, tags) {
  const settings = getSettings();
  if (!settings.wallhaven?.enabled) return;
  if (BGMManager.generatingScenes.has(sceneName)) return;

  const sceneBackgrounds = _getSceneBackgroundsRef ? _getSceneBackgroundsRef() : null;
  if (sceneBackgrounds && sceneBackgrounds.has(sceneName)) {
    console.log(`[${SCRIPT_NAME}] Wallhaven: 场景「${sceneName}」已存在缓存，跳过搜索`);
    return;
  }

  BGMManager.generatingScenes.add(sceneName);

  (async () => {
    try {
      console.log(`[${SCRIPT_NAME}] Wallhaven: 开始搜索场景「${sceneName}」原始标签: ${tags}`);

      const tagList = optimizeWallhavenTags(tags);

      const imageUrl = await WallhavenAPI.search(tagList);

      if (imageUrl) {
        let cachedUrl = imageUrl;
        try {
          if (_saveBackgroundRef) {
            const savedUrl = await _saveBackgroundRef(sceneName, null, imageUrl);
            if (savedUrl) cachedUrl = savedUrl;
          }
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] Wallhaven: 保存背景失败，使用临时缓存`, e);
          if (sceneBackgrounds) {
            sceneBackgrounds.set(sceneName, imageUrl);
          }
        }
        console.log(`[${SCRIPT_NAME}] Wallhaven: 场景「${sceneName}」背景已缓存: ${cachedUrl.substring(0, 50)}...`);

        // 如果当前正处于该场景，刷新背景显示
        const _$ = (typeof window.parent !== 'undefined' ? window.parent : window).jQuery;
        if (_$) {
          const $lastMes = _$('#chat > .mes').last();
          if ($lastMes.length) {
            const mesId = $lastMes.attr('mesid');
            const messageSegmentState = _getMessageSegmentStateRef ? _getMessageSegmentStateRef() : null;
            const state = messageSegmentState ? messageSegmentState.get(String(mesId)) : null;
            if (
              state &&
              state.parsedContent &&
              state.parsedContent.currentBackground &&
              state.parsedContent.currentBackground.scene === sceneName
            ) {
              const SpriteManager = _getSpriteManagerRef ? _getSpriteManagerRef() : null;
              if (SpriteManager) {
                SpriteManager.currentScene = null;
              }
              console.log(`[${SCRIPT_NAME}] Wallhaven: 强制刷新UI: ${sceneName}`);
              if (_updateGlobalOverlayContentRef) {
                _updateGlobalOverlayContentRef(mesId, state.parsedContent);
              }
            }
          }
        }

        if (_showToastRef) _showToastRef(`场景「${sceneName}」Wallhaven 背景已应用`);
      } else {
        console.warn(`[${SCRIPT_NAME}] Wallhaven: 未找到匹配图片: ${tags}`);
      }
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] Wallhaven 背景搜索失败:`, e);
    } finally {
      BGMManager.generatingScenes.delete(sceneName);
    }
  })();
}
