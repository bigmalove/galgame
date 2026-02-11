import { SCRIPT_NAME, STORE_BACKGROUNDS } from '../core/constants.js';
import { topWindow } from '../core/env.js';
import { sceneBackgrounds } from '../core/store.js';
import { getDb } from '../core/state.js';
import { initDB } from './init.js';
import { getCurrentPackId, getRenderScope } from './image-packs.js';

// ============================================
// 背景图片存储
// ============================================

export async function saveBackground(sceneName, imageBlob, imageUrl = null, packId = null) {
  if (!getDb()) await initDB();
  const db = getDb();
  const targetPackId = packId || getCurrentPackId();
  return new Promise((resolve, reject) => {
    const id = sceneName;
    const transaction = db.transaction([STORE_BACKGROUNDS], 'readwrite');
    const store = transaction.objectStore(STORE_BACKGROUNDS);
    const data = {
      id,
      sceneName,
      imageBlob,
      imageUrl,
      packId: targetPackId,
      lastModified: new Date().toISOString(),
    };
    const request = store.put(data);
    request.onsuccess = () => {
      let blobUrl;
      if (imageUrl) {
        blobUrl = imageUrl;
      } else if (imageBlob) {
        blobUrl = (topWindow.URL || URL).createObjectURL(imageBlob);
      }
      if (blobUrl) {
        sceneBackgrounds.set(id, blobUrl);
      }
      console.log(`[${SCRIPT_NAME}] 背景已保存: ${id} (图包: ${targetPackId})`);
      resolve(blobUrl);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveBackgroundsBatch(backgroundsList, packId = null) {
  if (!backgroundsList || backgroundsList.length === 0) return;
  if (!getDb()) await initDB();
  const db = getDb();
  const targetPackId = packId || getCurrentPackId();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_BACKGROUNDS], 'readwrite');
    const store = transaction.objectStore(STORE_BACKGROUNDS);

    transaction.oncomplete = () => {
      console.log(`[${SCRIPT_NAME}] 批量保存背景完成: ${backgroundsList.length} 个 (图包: ${targetPackId})`);
      resolve();
    };

    transaction.onerror = event => {
      console.error(`[${SCRIPT_NAME}] 批量保存背景失败:`, event.target.error);
      reject(event.target.error);
    };

    backgroundsList.forEach(item => {
      const id = item.sceneName;
      const data = {
        id,
        sceneName: item.sceneName,
        imageBlob: item.imageBlob,
        imageUrl: item.imageUrl || null,
        packId: targetPackId,
        lastModified: new Date().toISOString(),
      };
      store.put(data);

      let blobUrl;
      if (item.imageUrl) {
        blobUrl = item.imageUrl;
      } else if (item.imageBlob) {
        blobUrl = (topWindow.URL || URL).createObjectURL(item.imageBlob);
      }
      if (blobUrl) {
        sceneBackgrounds.set(id, blobUrl);
        console.log(
          `[${SCRIPT_NAME}] [DEBUG] saveBackgroundsBatch 更新缓存: "${id}" URL: ${blobUrl.substring(0, 50)}... keys=${sceneBackgrounds.size}`,
        );
      }
    });
  });
}

export async function getBackground(sceneName) {
  if (!sceneName) return null;
  console.log(
    `[${SCRIPT_NAME}] [DEBUG] getBackground 查缓存: "${sceneName}" (len=${sceneName.length}). CacheSize: ${sceneBackgrounds.size}`,
  );

  if (sceneBackgrounds.has(sceneName)) {
    console.log(`[${SCRIPT_NAME}] [DEBUG] getBackground 命中缓存: "${sceneName}"`);
    return sceneBackgrounds.get(sceneName);
  }
  if (!getDb()) await initDB();
  const db = getDb();
  return new Promise(resolve => {
    const transaction = db.transaction([STORE_BACKGROUNDS], 'readonly');
    const store = transaction.objectStore(STORE_BACKGROUNDS);
    const request = store.get(sceneName);
    request.onsuccess = () => {
      if (request.result) {
        let blobUrl;
        if (request.result.imageUrl) {
          blobUrl = request.result.imageUrl;
        } else if (request.result.imageBlob) {
          blobUrl = (topWindow.URL || URL).createObjectURL(request.result.imageBlob);
        }
        if (blobUrl) {
          sceneBackgrounds.set(sceneName, blobUrl);
          console.log(`[${SCRIPT_NAME}] [DEBUG] 背景 URL 获取成功: ${sceneName}`);
          resolve(blobUrl);
          return;
        }
      }
      resolve(null);
    };
    request.onerror = () => resolve(null);
  });
}

export async function deleteBackground(sceneName) {
  if (!getDb()) await initDB();
  const db = getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_BACKGROUNDS], 'readwrite');
    const store = transaction.objectStore(STORE_BACKGROUNDS);
    const request = store.delete(sceneName);
    request.onsuccess = () => {
      if (sceneBackgrounds.has(sceneName)) {
        (topWindow.URL || URL).revokeObjectURL(sceneBackgrounds.get(sceneName));
        sceneBackgrounds.delete(sceneName);
      }
      console.log(`[${SCRIPT_NAME}] 背景已删除: ${sceneName}`);
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getAllBackgrounds(packId = null, ignorePackFilter = false) {
  if (!getDb()) await initDB();
  const db = getDb();
  return new Promise(resolve => {
    const transaction = db.transaction([STORE_BACKGROUNDS], 'readonly');
    const store = transaction.objectStore(STORE_BACKGROUNDS);
    const request = store.getAll();
    request.onsuccess = () => {
      let backgrounds = request.result || [];
      if (!ignorePackFilter) {
        const targetPackId = packId || getCurrentPackId();
        const scope = getRenderScope();
        if (scope === 'current') {
          backgrounds = backgrounds.filter(bg => bg.packId === targetPackId);
        } else {
          backgrounds.sort((a, b) => {
            if (a.packId === targetPackId && b.packId !== targetPackId) return -1;
            if (a.packId !== targetPackId && b.packId === targetPackId) return 1;
            return 0;
          });
        }
      }
      resolve(backgrounds);
    };
    request.onerror = () => resolve([]);
  });
}

export async function loadAllBackgroundsToCache() {
  if (!getDb()) await initDB();
  const db = getDb();
  return new Promise(resolve => {
    const transaction = db.transaction([STORE_BACKGROUNDS], 'readonly');
    const store = transaction.objectStore(STORE_BACKGROUNDS);
    const request = store.getAll();
    request.onsuccess = () => {
      const backgrounds = request.result || [];
      backgrounds.forEach(bg => {
        if (bg.imageUrl) {
          sceneBackgrounds.set(bg.id, bg.imageUrl);
        } else if (bg.imageBlob) {
          const blobUrl = (topWindow.URL || URL).createObjectURL(bg.imageBlob);
          sceneBackgrounds.set(bg.id, blobUrl);
        }
      });
      console.log(`[${SCRIPT_NAME}] 已加载 ${backgrounds.length} 个背景到缓存`);
      resolve();
    };
    request.onerror = () => resolve();
  });
}
