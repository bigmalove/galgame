import { SCRIPT_NAME } from '../core/constants.js';
import { getSettings } from '../core/settings.js';
import { GalgameStore } from '../core/store.js';
import { saveBackground } from '../db/backgrounds.js';
import { WallhavenAPI } from './wallhaven-api.js';
import { BGMManager } from '../audio/bgm-manager.js';
import { showBgGenToast, refreshUIForScene } from './bg-gen-shared.js';

// ============================================
// Wallhaven 标签优化 & 背景搜索
// ============================================

const sceneBackgrounds = GalgameStore.cache.backgrounds;

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
  if (settings.bgImageSource !== 'wallhaven') return;
  if (BGMManager.generatingScenes.has(sceneName)) return;

  if (sceneBackgrounds.has(sceneName)) {
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
          const savedUrl = await saveBackground(sceneName, null, imageUrl);
          if (savedUrl) cachedUrl = savedUrl;
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] Wallhaven: 保存背景失败，使用临时缓存`, e);
          sceneBackgrounds.set(sceneName, imageUrl);
        }
        console.log(`[${SCRIPT_NAME}] Wallhaven: 场景「${sceneName}」背景已缓存: ${cachedUrl.substring(0, 50)}...`);

        refreshUIForScene(sceneName);
        showBgGenToast(`场景「${sceneName}」Wallhaven 背景已应用`);
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
