import { SCRIPT_NAME, STORE_SPRITES } from '../core/constants.js';
import { topWindow } from '../core/env.js';
import { characterSprites } from '../core/store.js';
import { getDb } from '../core/state.js';
import { initDB } from './init.js';
import { getCurrentPackId, getRenderScope } from './image-packs.js';

// ============================================
// 立绘存储函数
// ============================================

export async function saveSprite(characterId, expression, imageBlob, imageUrl = null, packId = null) {
  if (!getDb()) await initDB();
  const db = getDb();
  const targetPackId = packId || getCurrentPackId();
  return new Promise((resolve, reject) => {
    const id = `${characterId}_${expression}`;

    // 撤销旧的 blob URL
    const oldBlobUrl = characterSprites.get(id);
    if (oldBlobUrl && oldBlobUrl.startsWith('blob:')) {
      try {
        (topWindow.URL || URL).revokeObjectURL(oldBlobUrl);
        console.log(`[${SCRIPT_NAME}] 已撤销旧的 blob URL: ${id}`);
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] 撤销旧 blob URL 失败:`, e);
      }
    }
    characterSprites.delete(id);

    const transaction = db.transaction([STORE_SPRITES], 'readwrite');
    const store = transaction.objectStore(STORE_SPRITES);
    const data = {
      id,
      characterId,
      expression,
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
        characterSprites.set(id, blobUrl);
      }
      console.log(`[${SCRIPT_NAME}] 立绘已保存: ${id} (图包: ${targetPackId})`);
      resolve(blobUrl);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveSpritesBatch(spritesList, packId = null) {
  if (!spritesList || spritesList.length === 0) return;
  if (!getDb()) await initDB();
  const db = getDb();
  const targetPackId = packId || getCurrentPackId();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_SPRITES], 'readwrite');
    const store = transaction.objectStore(STORE_SPRITES);

    transaction.oncomplete = () => {
      console.log(`[${SCRIPT_NAME}] 批量保存立绘完成: ${spritesList.length} 个 (图包: ${targetPackId})`);
      resolve();
    };

    transaction.onerror = event => {
      console.error(`[${SCRIPT_NAME}] 批量保存立绘失败:`, event.target.error);
      reject(event.target.error);
    };

    spritesList.forEach(item => {
      const id = `${item.characterId}_${item.expression}`;

      const oldBlobUrl = characterSprites.get(id);
      if (oldBlobUrl && oldBlobUrl.startsWith('blob:')) {
        try {
          (topWindow.URL || URL).revokeObjectURL(oldBlobUrl);
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] 撤销旧 blob URL 失败:`, e);
        }
      }
      characterSprites.delete(id);

      const data = {
        id,
        characterId: item.characterId,
        expression: item.expression,
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
        characterSprites.set(id, blobUrl);
      }
    });
  });
}

export async function getSprite(characterId, expression) {
  if (!characterId) {
    console.log(`[${SCRIPT_NAME}] getSprite: 角色名为空`);
    return null;
  }
  const id = `${characterId}_${expression}`;
  console.log(`[${SCRIPT_NAME}] getSprite 查询: ${id}`);

  if (characterSprites.has(id)) {
    console.log(`[${SCRIPT_NAME}] getSprite 缓存命中: ${id}`);
    return characterSprites.get(id);
  }
  if (!getDb()) await initDB();
  const db = getDb();

  const result = await new Promise(resolve => {
    const transaction = db.transaction([STORE_SPRITES], 'readonly');
    const store = transaction.objectStore(STORE_SPRITES);
    const request = store.get(id);
    request.onsuccess = () => {
      if (request.result) {
        let blobUrl;
        if (request.result.imageUrl) {
          blobUrl = request.result.imageUrl;
        } else if (request.result.imageBlob) {
          blobUrl = (topWindow.URL || URL).createObjectURL(request.result.imageBlob);
        }
        if (blobUrl) {
          characterSprites.set(id, blobUrl);
          console.log(`[${SCRIPT_NAME}] getSprite 找到: ${id}`);
          resolve(blobUrl);
          return;
        }
      }
      console.log(`[${SCRIPT_NAME}] getSprite 未找到: ${id}`);
      resolve(null);
    };
    request.onerror = () => {
      console.log(`[${SCRIPT_NAME}] getSprite 查询错误: ${id}`);
      resolve(null);
    };
  });
  if (result) return result;

  // 回退到默认表情
  if (expression !== '默认') {
    const fallbackId = `${characterId}_默认`;
    console.log(`[${SCRIPT_NAME}] getSprite 尝试回退: ${fallbackId}`);
    if (characterSprites.has(fallbackId)) {
      console.log(`[${SCRIPT_NAME}] getSprite 回退缓存命中: ${fallbackId}`);
      return characterSprites.get(fallbackId);
    }
    return new Promise(resolve => {
      const transaction = db.transaction([STORE_SPRITES], 'readonly');
      const store = transaction.objectStore(STORE_SPRITES);
      const request = store.get(fallbackId);
      request.onsuccess = () => {
        if (request.result) {
          let blobUrl;
          if (request.result.imageUrl) {
            blobUrl = request.result.imageUrl;
          } else if (request.result.imageBlob) {
            blobUrl = (topWindow.URL || URL).createObjectURL(request.result.imageBlob);
          }
          if (blobUrl) {
            characterSprites.set(fallbackId, blobUrl);
            console.log(`[${SCRIPT_NAME}] getSprite 回退找到: ${fallbackId}`);
            resolve(blobUrl);
            return;
          }
        }
        console.log(`[${SCRIPT_NAME}] getSprite 回退也未找到: ${fallbackId}`);
        resolve(null);
      };
      request.onerror = () => resolve(null);
    });
  }
  return null;
}

export async function getCharacterSprites(characterId) {
  if (!getDb()) await initDB();
  const db = getDb();
  return new Promise(resolve => {
    const transaction = db.transaction([STORE_SPRITES], 'readonly');
    const store = transaction.objectStore(STORE_SPRITES);
    const index = store.index('characterId');
    const request = index.getAll(characterId);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

export async function deleteSprite(characterId, expression) {
  if (!getDb()) await initDB();
  const db = getDb();
  const id = `${characterId}_${expression}`;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_SPRITES], 'readwrite');
    const store = transaction.objectStore(STORE_SPRITES);
    const request = store.delete(id);
    request.onsuccess = () => {
      if (characterSprites.has(id)) {
        (topWindow.URL || URL).revokeObjectURL(characterSprites.get(id));
        characterSprites.delete(id);
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getAllSprites(packId = null, ignorePackFilter = false) {
  if (!getDb()) await initDB();
  const db = getDb();
  return new Promise(resolve => {
    const transaction = db.transaction([STORE_SPRITES], 'readonly');
    const store = transaction.objectStore(STORE_SPRITES);
    const request = store.getAll();
    request.onsuccess = () => {
      let sprites = request.result || [];
      if (!ignorePackFilter) {
        const targetPackId = packId || getCurrentPackId();
        const scope = getRenderScope();
        if (scope === 'current') {
          sprites = sprites.filter(s => s.packId === targetPackId);
        } else {
          sprites.sort((a, b) => {
            if (a.packId === targetPackId && b.packId !== targetPackId) return -1;
            if (a.packId !== targetPackId && b.packId === targetPackId) return 1;
            return 0;
          });
        }
      }
      resolve(sprites);
    };
    request.onerror = () => resolve([]);
  });
}

export async function loadAllSpritesToCache() {
  if (!getDb()) await initDB();
  const db = getDb();
  return new Promise(resolve => {
    const transaction = db.transaction([STORE_SPRITES], 'readonly');
    const store = transaction.objectStore(STORE_SPRITES);
    const request = store.getAll();
    request.onsuccess = () => {
      const sprites = request.result || [];
      sprites.forEach(sprite => {
        if (sprite.imageUrl) {
          characterSprites.set(sprite.id, sprite.imageUrl);
        } else if (sprite.imageBlob) {
          const blobUrl = (topWindow.URL || URL).createObjectURL(sprite.imageBlob);
          characterSprites.set(sprite.id, blobUrl);
        }
      });
      console.log(`[${SCRIPT_NAME}] 已加载 ${sprites.length} 个立绘到缓存`);
      resolve();
    };
    request.onerror = () => resolve();
  });
}
