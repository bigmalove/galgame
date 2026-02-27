import { DEFAULT_PACK_ID, SCRIPT_NAME, STORE_SPRITES } from '../core/constants.js';
import { topWindow } from '../core/env.js';
import { characterSprites } from '../core/store.js';
import { getDb } from '../core/state.js';
import { initDB } from './init.js';
import { getCurrentPackId, getRenderScope } from './image-packs.js';

// ============================================
// 立绘存储函数
// ============================================

const SPRITE_ID_SEPARATOR = '::';

function normalizePackId(packId, fallbackPackId = DEFAULT_PACK_ID) {
  const normalized = String(packId ?? '').trim();
  return normalized || fallbackPackId;
}

function getTargetPackId(packId = null) {
  const currentPackId = normalizePackId(getCurrentPackId(), DEFAULT_PACK_ID);
  return normalizePackId(packId, currentPackId);
}

export function buildLegacySpriteId(characterId, expression) {
  return `${String(characterId || '').trim()}_${String(expression || '').trim()}`;
}

export function buildSpriteId(characterId, expression, packId = null) {
  const targetPackId = getTargetPackId(packId);
  const safeCharacterId = String(characterId || '').trim();
  const safeExpression = String(expression || '').trim();
  return `${targetPackId}${SPRITE_ID_SEPARATOR}${safeCharacterId}${SPRITE_ID_SEPARATOR}${safeExpression}`;
}

function revokeCachedSprite(cacheKey) {
  if (!cacheKey || !characterSprites.has(cacheKey)) return;
  const cacheUrl = characterSprites.get(cacheKey);
  if (typeof cacheUrl === 'string' && cacheUrl.startsWith('blob:')) {
    try {
      (topWindow.URL || URL).revokeObjectURL(cacheUrl);
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 撤销旧 blob URL 失败:`, e);
    }
  }
  characterSprites.delete(cacheKey);
}

function getSpriteUrlFromRecord(spriteRecord) {
  if (!spriteRecord) return null;
  if (spriteRecord.imageUrl) return spriteRecord.imageUrl;
  if (spriteRecord.imageBlob) return (topWindow.URL || URL).createObjectURL(spriteRecord.imageBlob);
  return null;
}

function querySpriteRecord(store, characterId, expression, targetPackId, scope) {
  return new Promise(resolve => {
    const characterIndex = store.index('characterId');
    const request = characterIndex.getAll(characterId);
    request.onsuccess = () => {
      const allRecords = request.result || [];
      const recordsByExpression = allRecords.filter(
        record => String(record?.expression || '').trim() === expression,
      );
      if (recordsByExpression.length === 0) {
        resolve(null);
        return;
      }

      const normalizedRecords = recordsByExpression
        .map(record => ({
          ...record,
          packId: normalizePackId(record?.packId, DEFAULT_PACK_ID),
        }))
        .sort((a, b) => {
          const timeA = Date.parse(a?.lastModified || '') || 0;
          const timeB = Date.parse(b?.lastModified || '') || 0;
          return timeB - timeA;
        });

      const currentPackRecord = normalizedRecords.find(record => record.packId === targetPackId) || null;
      if (scope === 'current') {
        resolve(currentPackRecord);
        return;
      }
      resolve(currentPackRecord || normalizedRecords[0] || null);
    };
    request.onerror = () => resolve(null);
  });
}

export async function saveSprite(characterId, expression, imageBlob, imageUrl = null, packId = null) {
  if (!getDb()) await initDB();
  const db = getDb();
  const targetPackId = getTargetPackId(packId);
  const id = buildSpriteId(characterId, expression, targetPackId);
  const legacyId = buildLegacySpriteId(characterId, expression);

  return new Promise((resolve, reject) => {
    revokeCachedSprite(id);
    if (legacyId !== id) revokeCachedSprite(legacyId);

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
    if (legacyId !== id) {
      store.delete(legacyId);
    }
    const request = store.put(data);
    request.onsuccess = () => {
      const blobUrl = getSpriteUrlFromRecord(data);
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
  const targetPackId = getTargetPackId(packId);

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
      const id = buildSpriteId(item.characterId, item.expression, targetPackId);
      const legacyId = buildLegacySpriteId(item.characterId, item.expression);

      revokeCachedSprite(id);
      if (legacyId !== id) {
        revokeCachedSprite(legacyId);
        store.delete(legacyId);
      }

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

      const blobUrl = getSpriteUrlFromRecord(data);
      if (blobUrl) {
        characterSprites.set(id, blobUrl);
      }
    });
  });
}

export async function getSprite(characterId, expression, packId = null) {
  const safeCharacterId = String(characterId || '').trim();
  const safeExpression = String(expression || '默认').trim() || '默认';
  if (!safeCharacterId) {
    console.log(`[${SCRIPT_NAME}] getSprite: 角色名为空`);
    return null;
  }
  const targetPackId = getTargetPackId(packId);
  const scope = getRenderScope() === 'all' ? 'all' : 'current';
  const scopedSpriteId = buildSpriteId(safeCharacterId, safeExpression, targetPackId);
  console.log(`[${SCRIPT_NAME}] getSprite 查询: ${scopedSpriteId} (scope: ${scope})`);

  if (characterSprites.has(scopedSpriteId)) {
    console.log(`[${SCRIPT_NAME}] getSprite 缓存命中: ${scopedSpriteId}`);
    return characterSprites.get(scopedSpriteId);
  }
  const legacySpriteId = buildLegacySpriteId(safeCharacterId, safeExpression);
  if (scope === 'all' && characterSprites.has(legacySpriteId)) {
    console.log(`[${SCRIPT_NAME}] getSprite 旧缓存命中: ${legacySpriteId}`);
    return characterSprites.get(legacySpriteId);
  }
  if (!getDb()) await initDB();
  const db = getDb();

  const result = await new Promise(resolve => {
    const transaction = db.transaction([STORE_SPRITES], 'readonly');
    const store = transaction.objectStore(STORE_SPRITES);
    querySpriteRecord(store, safeCharacterId, safeExpression, targetPackId, scope).then(resolve);
  });
  if (result) {
    const resolvedPackId = normalizePackId(result.packId, DEFAULT_PACK_ID);
    const cacheId = buildSpriteId(safeCharacterId, safeExpression, resolvedPackId);
    const blobUrl = getSpriteUrlFromRecord(result);
    if (blobUrl) {
      characterSprites.set(cacheId, blobUrl);
      if (result.id && result.id !== cacheId) {
        characterSprites.set(result.id, blobUrl);
      }
      console.log(`[${SCRIPT_NAME}] getSprite 找到: ${cacheId}`);
      return blobUrl;
    }
  }

  // 回退到默认表情
  if (safeExpression !== '默认') {
    console.log(`[${SCRIPT_NAME}] getSprite 尝试回退: ${safeCharacterId}_默认 (scope: ${scope})`);
    return getSprite(safeCharacterId, '默认', targetPackId);
  }

  console.log(`[${SCRIPT_NAME}] getSprite 未找到: ${scopedSpriteId}`);
  return null;
}

export async function getCharacterSprites(characterId, packId = null, ignorePackFilter = false) {
  if (!getDb()) await initDB();
  const db = getDb();
  const targetPackId = getTargetPackId(packId);
  const scope = getRenderScope() === 'all' ? 'all' : 'current';
  return new Promise(resolve => {
    const transaction = db.transaction([STORE_SPRITES], 'readonly');
    const store = transaction.objectStore(STORE_SPRITES);
    const index = store.index('characterId');
    const request = index.getAll(characterId);
    request.onsuccess = () => {
      let sprites = request.result || [];
      sprites = sprites.map(sprite => ({
        ...sprite,
        packId: normalizePackId(sprite?.packId, DEFAULT_PACK_ID),
      }));
      if (!ignorePackFilter) {
        if (scope === 'current') {
          sprites = sprites.filter(sprite => sprite.packId === targetPackId);
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

export async function deleteSprite(characterId, expression, packId = null, spriteId = null) {
  if (!getDb()) await initDB();
  const db = getDb();

  const idsToDelete = new Set();
  if (spriteId) idsToDelete.add(String(spriteId));
  if (characterId && expression) {
    idsToDelete.add(buildLegacySpriteId(characterId, expression));
    idsToDelete.add(buildSpriteId(characterId, expression, getTargetPackId(packId)));
  }
  if (idsToDelete.size === 0) return;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_SPRITES], 'readwrite');
    const store = transaction.objectStore(STORE_SPRITES);
    let finished = 0;
    const done = () => {
      finished++;
      if (finished === idsToDelete.size) {
        idsToDelete.forEach(id => revokeCachedSprite(id));
        resolve();
      }
    };
    idsToDelete.forEach(id => {
      const request = store.delete(id);
      request.onsuccess = done;
      request.onerror = () => done();
    });
    transaction.onerror = () => reject(transaction.error || new Error('删除立绘失败'));
  });
}

export async function getAllSprites(packId = null, ignorePackFilter = false) {
  if (!getDb()) await initDB();
  const db = getDb();
  const targetPackId = getTargetPackId(packId);
  const scope = getRenderScope() === 'all' ? 'all' : 'current';
  return new Promise(resolve => {
    const transaction = db.transaction([STORE_SPRITES], 'readonly');
    const store = transaction.objectStore(STORE_SPRITES);
    const request = store.getAll();
    request.onsuccess = () => {
      let sprites = (request.result || []).map(sprite => ({
        ...sprite,
        packId: normalizePackId(sprite?.packId, DEFAULT_PACK_ID),
      }));
      if (!ignorePackFilter) {
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
        const cacheId = buildSpriteId(
          sprite.characterId,
          sprite.expression,
          normalizePackId(sprite?.packId, DEFAULT_PACK_ID),
        );
        const blobUrl = getSpriteUrlFromRecord(sprite);
        if (!blobUrl) return;
        characterSprites.set(cacheId, blobUrl);
        if (sprite.id && sprite.id !== cacheId) {
          characterSprites.set(sprite.id, blobUrl);
        }
      });
      console.log(`[${SCRIPT_NAME}] 已加载 ${sprites.length} 个立绘到缓存`);
      resolve();
    };
    request.onerror = () => resolve();
  });
}
