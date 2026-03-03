import { SCRIPT_NAME, STORE_SPECIAL_CGS, DEFAULT_PACK_ID } from '../core/constants.js';
import { topWindow } from '../core/env.js';
import { GalgameStore } from '../core/store.js';
import { getDb } from '../core/state.js';
import { initDB } from './init.js';
import { getCurrentPackId, getRenderScope } from './image-packs.js';

function getSpecialCgCache() {
  if (!GalgameStore.cache.specialCgs) {
    GalgameStore.cache.specialCgs = new Map();
  }
  return GalgameStore.cache.specialCgs;
}

function normalizePackId(packId, fallbackPackId = DEFAULT_PACK_ID) {
  const text = String(packId ?? '').trim();
  return text || fallbackPackId;
}

function getTargetPackId(packId = null) {
  const currentPackId = normalizePackId(getCurrentPackId(), DEFAULT_PACK_ID);
  return normalizePackId(packId, currentPackId);
}

function buildSpecialCgRecord(cgId, imageBlob, imageUrl = null, packId = null, meta = {}) {
  const safeCgId = String(cgId || '').trim();
  const safeMeta = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
  return {
    id: safeCgId,
    cgId: safeCgId,
    name: String(safeMeta.name || safeCgId).trim() || safeCgId,
    description: String(safeMeta.description || '').trim(),
    tags: Array.isArray(safeMeta.tags) ? safeMeta.tags.map(item => String(item || '').trim()).filter(Boolean) : [],
    imageBlob: imageBlob || null,
    imageUrl: imageUrl || null,
    packId: getTargetPackId(packId),
    lastModified: new Date().toISOString(),
  };
}

function buildSpecialCgUrl(record) {
  if (!record) return null;
  if (record.imageUrl) return record.imageUrl;
  if (record.imageBlob) return (topWindow.URL || URL).createObjectURL(record.imageBlob);
  return null;
}

function revokeCachedSpecialCg(cgId) {
  const cache = getSpecialCgCache();
  const key = String(cgId || '').trim();
  if (!key || !cache.has(key)) return;
  const current = cache.get(key);
  if (typeof current === 'string' && current.startsWith('blob:')) {
    try {
      (topWindow.URL || URL).revokeObjectURL(current);
    } catch (error) {
      console.warn(`[${SCRIPT_NAME}] 撤销特殊CG缓存失败:`, error);
    }
  }
  cache.delete(key);
}

export async function saveSpecialCg(cgId, imageBlob, imageUrl = null, meta = {}, packId = null) {
  const safeCgId = String(cgId || '').trim();
  if (!safeCgId) throw new Error('cgId 不能为空');
  if (!getDb()) await initDB();
  const db = getDb();
  const record = buildSpecialCgRecord(safeCgId, imageBlob, imageUrl, packId, meta);

  return new Promise((resolve, reject) => {
    revokeCachedSpecialCg(safeCgId);
    const transaction = db.transaction([STORE_SPECIAL_CGS], 'readwrite');
    const store = transaction.objectStore(STORE_SPECIAL_CGS);
    const request = store.put(record);
    request.onsuccess = () => {
      const url = buildSpecialCgUrl(record);
      if (url) getSpecialCgCache().set(safeCgId, url);
      console.log(`[${SCRIPT_NAME}] 特殊CG已保存: ${safeCgId} (图包: ${record.packId})`);
      resolve(url);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveSpecialCgsBatch(cgList, packId = null) {
  if (!Array.isArray(cgList) || cgList.length === 0) return;
  if (!getDb()) await initDB();
  const db = getDb();
  const targetPackId = getTargetPackId(packId);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_SPECIAL_CGS], 'readwrite');
    const store = transaction.objectStore(STORE_SPECIAL_CGS);

    transaction.oncomplete = () => {
      console.log(`[${SCRIPT_NAME}] 批量保存特殊CG完成: ${cgList.length} 个 (图包: ${targetPackId})`);
      resolve();
    };
    transaction.onerror = event => reject(event.target.error);

    cgList.forEach(item => {
      const safeCgId = String(item?.cgId || item?.id || '').trim();
      if (!safeCgId) return;
      revokeCachedSpecialCg(safeCgId);
      const record = buildSpecialCgRecord(
        safeCgId,
        item?.imageBlob || null,
        item?.imageUrl || null,
        targetPackId,
        item?.meta || item || {},
      );
      store.put(record);
      const url = buildSpecialCgUrl(record);
      if (url) getSpecialCgCache().set(safeCgId, url);
    });
  });
}

export async function getSpecialCg(cgId) {
  const safeCgId = String(cgId || '').trim();
  if (!safeCgId) return null;
  const cache = getSpecialCgCache();
  if (cache.has(safeCgId)) return cache.get(safeCgId);
  if (!getDb()) await initDB();
  const db = getDb();

  return new Promise(resolve => {
    const transaction = db.transaction([STORE_SPECIAL_CGS], 'readonly');
    const store = transaction.objectStore(STORE_SPECIAL_CGS);
    const request = store.get(safeCgId);
    request.onsuccess = () => {
      const record = request.result || null;
      const url = buildSpecialCgUrl(record);
      if (url) cache.set(safeCgId, url);
      resolve(url);
    };
    request.onerror = () => resolve(null);
  });
}

export async function getSpecialCgRecord(cgId) {
  const safeCgId = String(cgId || '').trim();
  if (!safeCgId) return null;
  if (!getDb()) await initDB();
  const db = getDb();
  return new Promise(resolve => {
    const transaction = db.transaction([STORE_SPECIAL_CGS], 'readonly');
    const store = transaction.objectStore(STORE_SPECIAL_CGS);
    const request = store.get(safeCgId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

export async function deleteSpecialCg(cgId) {
  const safeCgId = String(cgId || '').trim();
  if (!safeCgId) return;
  if (!getDb()) await initDB();
  const db = getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_SPECIAL_CGS], 'readwrite');
    const store = transaction.objectStore(STORE_SPECIAL_CGS);
    const request = store.delete(safeCgId);
    request.onsuccess = () => {
      revokeCachedSpecialCg(safeCgId);
      console.log(`[${SCRIPT_NAME}] 特殊CG已删除: ${safeCgId}`);
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getAllSpecialCgs(packId = null, ignorePackFilter = false) {
  if (!getDb()) await initDB();
  const db = getDb();
  const targetPackId = getTargetPackId(packId);
  const scope = getRenderScope() === 'all' ? 'all' : 'current';
  return new Promise(resolve => {
    const transaction = db.transaction([STORE_SPECIAL_CGS], 'readonly');
    const store = transaction.objectStore(STORE_SPECIAL_CGS);
    const request = store.getAll();
    request.onsuccess = () => {
      let list = request.result || [];
      list = list.map(item => ({
        ...item,
        packId: normalizePackId(item?.packId, DEFAULT_PACK_ID),
      }));
      if (!ignorePackFilter) {
        if (scope === 'current') {
          list = list.filter(item => item.packId === targetPackId);
        } else {
          list.sort((a, b) => {
            if (a.packId === targetPackId && b.packId !== targetPackId) return -1;
            if (a.packId !== targetPackId && b.packId === targetPackId) return 1;
            return 0;
          });
        }
      }
      resolve(list);
    };
    request.onerror = () => resolve([]);
  });
}

export async function loadAllSpecialCgsToCache() {
  if (!getDb()) await initDB();
  const db = getDb();
  const cache = getSpecialCgCache();
  return new Promise(resolve => {
    const transaction = db.transaction([STORE_SPECIAL_CGS], 'readonly');
    const store = transaction.objectStore(STORE_SPECIAL_CGS);
    const request = store.getAll();
    request.onsuccess = () => {
      const all = request.result || [];
      all.forEach(record => {
        const safeCgId = String(record?.cgId || record?.id || '').trim();
        if (!safeCgId) return;
        const url = buildSpecialCgUrl(record);
        if (!url) return;
        cache.set(safeCgId, url);
      });
      console.log(`[${SCRIPT_NAME}] 已加载 ${all.length} 个特殊CG到缓存`);
      resolve();
    };
    request.onerror = () => resolve();
  });
}

