import { SCRIPT_NAME, STORE_LIVE2D_MODELS } from '../core/constants.js';
import { getDb } from '../core/state.js';
import { initDB } from './init.js';

// ============================================
// Live2D 模型存储函数
// ============================================

export async function saveLive2DModel(modelData) {
  if (!getDb()) await initDB();
  const db = getDb();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([STORE_LIVE2D_MODELS], 'readwrite');
      const store = transaction.objectStore(STORE_LIVE2D_MODELS);
      store.put(modelData);
      transaction.oncomplete = () => {
        console.log(`[${SCRIPT_NAME}] Live2D 模型已保存: ${modelData.modelId}`);
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    } catch (e) {
      reject(e);
    }
  });
}

export async function getLive2DModel(characterId) {
  if (!getDb()) await initDB();
  const db = getDb();
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(STORE_LIVE2D_MODELS)) {
        resolve(null);
        return;
      }
      const transaction = db.transaction([STORE_LIVE2D_MODELS], 'readonly');
      const store = transaction.objectStore(STORE_LIVE2D_MODELS);
      const request = store.get(characterId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

export async function deleteLive2DModel(characterId) {
  if (!getDb()) await initDB();
  const db = getDb();
  return new Promise((resolve, reject) => {
    try {
      if (!db.objectStoreNames.contains(STORE_LIVE2D_MODELS)) {
        resolve();
        return;
      }
      const transaction = db.transaction([STORE_LIVE2D_MODELS], 'readwrite');
      const store = transaction.objectStore(STORE_LIVE2D_MODELS);
      store.delete(characterId);
      transaction.oncomplete = () => {
        console.log(`[${SCRIPT_NAME}] Live2D 模型已删除: ${characterId}`);
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    } catch (e) {
      reject(e);
    }
  });
}

export async function hasLive2DModel(characterId) {
  const model = await getLive2DModel(characterId);
  if (!model) return false;
  if (model.source === 'remote') {
    return typeof model.modelUrl === 'string' && model.modelUrl.trim().length > 0;
  }
  return !!model.modelJson;
}

export async function getAllLive2DModels() {
  if (!getDb()) await initDB();
  const db = getDb();
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(STORE_LIVE2D_MODELS)) {
        resolve([]);
        return;
      }
      const transaction = db.transaction([STORE_LIVE2D_MODELS], 'readonly');
      const store = transaction.objectStore(STORE_LIVE2D_MODELS);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    } catch (e) {
      resolve([]);
    }
  });
}
