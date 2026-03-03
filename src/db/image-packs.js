import { SCRIPT_NAME, DEFAULT_PACK_ID, STORE_IMAGE_PACKS, STORE_SPRITES, STORE_BACKGROUNDS, STORE_MAP_IMAGES, STORE_SPECIAL_CGS, BG_TRANSITION_MS } from '../core/constants.js';
import { $ } from '../core/env.js';
import { GalgameStore } from '../core/store.js';
import { getDb } from '../core/state.js';
import { initDB } from './init.js';

function buildSpritePackScopedId(characterId, expression, packId) {
  const safeCharacterId = String(characterId || '').trim();
  const safeExpression = String(expression || '').trim();
  const safePackId = String(packId || '').trim() || DEFAULT_PACK_ID;
  return `${safePackId}::${safeCharacterId}::${safeExpression}`;
}

// ============================================
// 图包管理函数
// ============================================

export function getCurrentPackId() {
  const saved = localStorage.getItem(GalgameStore.STORAGE_KEYS.CURRENT_PACK);
  return saved || DEFAULT_PACK_ID;
}

export function setCurrentPack(packId) {
  localStorage.setItem(GalgameStore.STORAGE_KEYS.CURRENT_PACK, packId);
  GalgameStore.imagePack.currentPackId = packId;
}

export function getRenderScope() {
  const saved = localStorage.getItem(GalgameStore.STORAGE_KEYS.RENDER_SCOPE);
  return saved || 'current';
}

export function setRenderScope(scope) {
  localStorage.setItem(GalgameStore.STORAGE_KEYS.RENDER_SCOPE, scope);
  GalgameStore.imagePack.renderScope = scope;
}

export async function getAllImagePacks() {
  if (!getDb()) await initDB();
  const db = getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_IMAGE_PACKS], 'readonly');
    const store = transaction.objectStore(STORE_IMAGE_PACKS);
    const request = store.getAll();
    request.onsuccess = () => {
      const packs = request.result || [];
      GalgameStore.imagePack.packs = packs;
      resolve(packs);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getDefaultPack() {
  const packs = await getAllImagePacks();
  return packs.find(p => p.isDefault) || packs.find(p => p.id === DEFAULT_PACK_ID) || null;
}

export async function createImagePack(name) {
  if (!getDb()) await initDB();
  const db = getDb();
  const newPack = {
    id: `pack_${Date.now()}`,
    name: name,
    createdAt: new Date().toISOString(),
    isDefault: false
  };
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_IMAGE_PACKS], 'readwrite');
    const store = transaction.objectStore(STORE_IMAGE_PACKS);
    const request = store.add(newPack);
    request.onsuccess = () => {
      console.log(`[${SCRIPT_NAME}] 创建图包: ${name}`);
      resolve(newPack);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function renameImagePack(packId, newName) {
  if (!getDb()) await initDB();
  const db = getDb();
  if (packId === DEFAULT_PACK_ID) {
    throw new Error('不能重命名默认图包');
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_IMAGE_PACKS], 'readwrite');
    const store = transaction.objectStore(STORE_IMAGE_PACKS);
    const getRequest = store.get(packId);
    getRequest.onsuccess = () => {
      const pack = getRequest.result;
      if (!pack) {
        reject(new Error('图包不存在'));
        return;
      }
      pack.name = newName;
      const putRequest = store.put(pack);
      putRequest.onsuccess = () => {
        console.log(`[${SCRIPT_NAME}] 重命名图包: ${packId} -> ${newName}`);
        resolve();
      };
      putRequest.onerror = () => reject(putRequest.error);
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function deleteImagePack(packId) {
  if (!getDb()) await initDB();
  const db = getDb();
  if (packId === DEFAULT_PACK_ID) {
    throw new Error('不能删除默认图包');
  }
  await transferAllResourcesToDefaultPack(packId);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_IMAGE_PACKS], 'readwrite');
    const store = transaction.objectStore(STORE_IMAGE_PACKS);
    const request = store.delete(packId);
    request.onsuccess = () => {
      console.log(`[${SCRIPT_NAME}] 删除图包: ${packId}`);
      if (getCurrentPackId() === packId) {
        setCurrentPack(DEFAULT_PACK_ID);
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function transferSpritesToPack(spriteKeys, targetPackId) {
  if (!getDb()) await initDB();
  const db = getDb();
  const safeTargetPackId = String(targetPackId || '').trim() || DEFAULT_PACK_ID;
  let count = 0;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_SPRITES], 'readwrite');
    const store = transaction.objectStore(STORE_SPRITES);
    let processed = 0;
    spriteKeys.forEach(key => {
      const getRequest = store.get(key);
      getRequest.onsuccess = () => {
        const sprite = getRequest.result;
        if (sprite) {
          const oldId = sprite.id;
          const newId = buildSpritePackScopedId(sprite.characterId, sprite.expression, safeTargetPackId);
          sprite.packId = safeTargetPackId;
          sprite.id = newId;
          store.put(sprite);
          if (oldId && oldId !== newId) {
            store.delete(oldId);
          }
          count++;
        }
        processed++;
        if (processed === spriteKeys.length) {
          resolve(count);
        }
      };
      getRequest.onerror = () => {
        processed++;
        if (processed === spriteKeys.length) {
          resolve(count);
        }
      };
    });
    if (spriteKeys.length === 0) resolve(0);
  });
}

export async function transferBackgroundsToPack(sceneNames, targetPackId) {
  if (!getDb()) await initDB();
  const db = getDb();
  let count = 0;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_BACKGROUNDS], 'readwrite');
    const store = transaction.objectStore(STORE_BACKGROUNDS);
    let processed = 0;
    sceneNames.forEach(sceneName => {
      const getRequest = store.get(sceneName);
      getRequest.onsuccess = () => {
        const bg = getRequest.result;
        if (bg) {
          bg.packId = targetPackId;
          store.put(bg);
          count++;
        }
        processed++;
        if (processed === sceneNames.length) {
          resolve(count);
        }
      };
      getRequest.onerror = () => {
        processed++;
        if (processed === sceneNames.length) {
          resolve(count);
        }
      };
    });
    if (sceneNames.length === 0) resolve(0);
  });
}

export async function transferSpecialCgsToPack(cgIds, targetPackId) {
  if (!getDb()) await initDB();
  const db = getDb();
  let count = 0;
  return new Promise(resolve => {
    const transaction = db.transaction([STORE_SPECIAL_CGS], 'readwrite');
    const store = transaction.objectStore(STORE_SPECIAL_CGS);
    let processed = 0;
    cgIds.forEach(cgId => {
      const getRequest = store.get(cgId);
      getRequest.onsuccess = () => {
        const record = getRequest.result;
        if (record) {
          record.packId = targetPackId;
          store.put(record);
          count++;
        }
        processed++;
        if (processed === cgIds.length) {
          resolve(count);
        }
      };
      getRequest.onerror = () => {
        processed++;
        if (processed === cgIds.length) {
          resolve(count);
        }
      };
    });
    if (cgIds.length === 0) resolve(0);
  });
}

async function transferAllResourcesToDefaultPack(packId) {
  if (!getDb()) await initDB();
  const db = getDb();
  let spriteCount = 0;
  let bgCount = 0;
  let mapCount = 0;
  let cgCount = 0;

  await new Promise((resolve) => {
    const transaction = db.transaction([STORE_SPRITES], 'readwrite');
    const store = transaction.objectStore(STORE_SPRITES);
    const request = store.openCursor();
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const sprite = cursor.value;
        if (sprite.packId === packId) {
          const oldId = sprite.id;
          const newId = buildSpritePackScopedId(sprite.characterId, sprite.expression, DEFAULT_PACK_ID);
          sprite.packId = DEFAULT_PACK_ID;
          sprite.id = newId;
          if (oldId && oldId !== newId) {
            store.put(sprite);
            store.delete(oldId);
          } else {
            cursor.update(sprite);
          }
          spriteCount++;
        }
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => resolve();
  });

  await new Promise((resolve) => {
    const transaction = db.transaction([STORE_BACKGROUNDS], 'readwrite');
    const store = transaction.objectStore(STORE_BACKGROUNDS);
    const request = store.openCursor();
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const bg = cursor.value;
        if (bg.packId === packId) {
          bg.packId = DEFAULT_PACK_ID;
          cursor.update(bg);
          bgCount++;
        }
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => resolve();
  });

  await new Promise((resolve) => {
    const transaction = db.transaction([STORE_MAP_IMAGES], 'readwrite');
    const store = transaction.objectStore(STORE_MAP_IMAGES);
    const request = store.openCursor();
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const mapItem = cursor.value;
        if (mapItem.packId === packId) {
          mapItem.packId = DEFAULT_PACK_ID;
          mapItem.regionPackKey = `${mapItem.regionKey || ''}__${DEFAULT_PACK_ID}`;
          cursor.update(mapItem);
          mapCount++;
        }
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => resolve();
  });

  await new Promise((resolve) => {
    const transaction = db.transaction([STORE_SPECIAL_CGS], 'readwrite');
    const store = transaction.objectStore(STORE_SPECIAL_CGS);
    const request = store.openCursor();
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const cgRecord = cursor.value;
        if (cgRecord.packId === packId) {
          cgRecord.packId = DEFAULT_PACK_ID;
          cursor.update(cgRecord);
          cgCount++;
        }
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => resolve();
  });

  console.log(`[${SCRIPT_NAME}] moved ${spriteCount} sprites, ${bgCount} backgrounds, ${mapCount} maps and ${cgCount} cgs from pack ${packId} to default pack`);
  return { sprites: spriteCount, backgrounds: bgCount, maps: mapCount, cgs: cgCount };
}

export async function getPackResourceCount(packId) {
  if (!getDb()) await initDB();
  const db = getDb();
  let spriteCount = 0;
  let bgCount = 0;
  let mapCount = 0;
  let cgCount = 0;

  await new Promise((resolve) => {
    const transaction = db.transaction([STORE_SPRITES], 'readonly');
    const store = transaction.objectStore(STORE_SPRITES);
    const index = store.index('packId');
    const request = index.count(IDBKeyRange.only(packId));
    request.onsuccess = () => {
      spriteCount = request.result;
      resolve();
    };
    request.onerror = () => resolve();
  });

  await new Promise((resolve) => {
    const transaction = db.transaction([STORE_BACKGROUNDS], 'readonly');
    const store = transaction.objectStore(STORE_BACKGROUNDS);
    const index = store.index('packId');
    const request = index.count(IDBKeyRange.only(packId));
    request.onsuccess = () => {
      bgCount = request.result;
      resolve();
    };
    request.onerror = () => resolve();
  });

  await new Promise((resolve) => {
    const transaction = db.transaction([STORE_MAP_IMAGES], 'readonly');
    const store = transaction.objectStore(STORE_MAP_IMAGES);
    const index = store.index('packId');
    const request = index.count(IDBKeyRange.only(packId));
    request.onsuccess = () => {
      mapCount = request.result;
      resolve();
    };
    request.onerror = () => resolve();
  });

  await new Promise((resolve) => {
    const transaction = db.transaction([STORE_SPECIAL_CGS], 'readonly');
    const store = transaction.objectStore(STORE_SPECIAL_CGS);
    const index = store.index('packId');
    const request = index.count(IDBKeyRange.only(packId));
    request.onsuccess = () => {
      cgCount = request.result;
      resolve();
    };
    request.onerror = () => resolve();
  });

  return { sprites: spriteCount, backgrounds: bgCount, maps: mapCount, cgs: cgCount };
}

export function ensureBackgroundLayers($bgLayer) {
  if (!$bgLayer || !$bgLayer.length) return { $base: $(), $front: $() };
  let $base = $bgLayer.find('.gal-bg-base');
  let $front = $bgLayer.find('.gal-bg-front');
  if (!$base.length) {
    $bgLayer.prepend('<div class="gal-bg-layer gal-bg-base"></div>');
    $base = $bgLayer.find('.gal-bg-base');
  }
  if (!$front.length) {
    $bgLayer.append('<div class="gal-bg-layer gal-bg-front"></div>');
    $front = $bgLayer.find('.gal-bg-front');
  }
  return { $base, $front };
}

export function clearBackgroundLayers($bgLayer) {
  const { $base, $front } = ensureBackgroundLayers($bgLayer);
  $base.css('background-image', '');
  $front.removeClass('is-active').css('background-image', '');
}

export function setBackgroundWithTransition($bgLayer, bgUrl) {
  const { $base, $front } = ensureBackgroundLayers($bgLayer);
  $bgLayer.find('.gal-gen-indicator').remove();
  $front.removeClass('is-active').css('background-image', `url(${bgUrl})`);
  if ($front[0]) void $front[0].offsetHeight;
  const token = `${Date.now()}_${Math.random()}`;
  $bgLayer.data('bgTransitionToken', token);
  $front.addClass('is-active');
  setTimeout(() => {
    if ($bgLayer.data('bgTransitionToken') !== token) return;
    $base.css('background-image', `url(${bgUrl})`);
    $front.removeClass('is-active').css('background-image', '');
  }, BG_TRANSITION_MS);
}

