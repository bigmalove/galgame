import { SCRIPT_NAME, STORE_MAP_IMAGES } from '../core/constants.js';
import { topWindow } from '../core/env.js';
import { getDb } from '../core/state.js';
import { initDB } from './init.js';
import { getCurrentPackId, getRenderScope } from './image-packs.js';

export const GLOBAL_MAP_REGION_KEY = '__global_world_map__';

function buildRecordId(regionKey, packId) {
  const region = String(regionKey || '').trim() || 'default-region';
  const pack = String(packId || '').trim() || getCurrentPackId();
  return `${region}__${pack}`;
}

function buildRegionPackKey(regionKey, packId) {
  const region = String(regionKey || '').trim() || 'default-region';
  const pack = String(packId || '').trim() || getCurrentPackId();
  return `${region}__${pack}`;
}

function mapRecordToUrl(record) {
  if (!record) return null;
  if (record.imageUrl) return String(record.imageUrl);
  if (record.imageBlob) return (topWindow.URL || URL).createObjectURL(record.imageBlob);
  return null;
}

export async function saveMapImage(regionKey, imageBlob, imageUrl = null, packId = null) {
  if (!getDb()) await initDB();
  const db = getDb();
  const targetPackId = String(packId || getCurrentPackId() || '').trim();
  const normalizedRegionKey = String(regionKey || '').trim() || 'default-region';
  const id = buildRecordId(normalizedRegionKey, targetPackId);
  const regionPackKey = buildRegionPackKey(normalizedRegionKey, targetPackId);

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_MAP_IMAGES], 'readwrite');
    const store = tx.objectStore(STORE_MAP_IMAGES);
    const payload = {
      id,
      regionKey: normalizedRegionKey,
      packId: targetPackId,
      regionPackKey,
      imageBlob: imageBlob || null,
      imageUrl: imageUrl || null,
      lastModified: new Date().toISOString(),
    };
    const request = store.put(payload);
    request.onsuccess = () => {
      const url = mapRecordToUrl(payload);
      console.log(`[${SCRIPT_NAME}] map image saved: ${normalizedRegionKey} (${targetPackId})`);
      resolve(url);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveMapImagesBatch(items, packId = null) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return;
  if (!getDb()) await initDB();
  const db = getDb();
  const targetPackId = String(packId || getCurrentPackId() || '').trim();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_MAP_IMAGES], 'readwrite');
    const store = tx.objectStore(STORE_MAP_IMAGES);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    list.forEach(item => {
      const regionKey = String(item?.regionKey || '').trim() || 'default-region';
      const id = buildRecordId(regionKey, targetPackId);
      const regionPackKey = buildRegionPackKey(regionKey, targetPackId);
      store.put({
        id,
        regionKey,
        packId: targetPackId,
        regionPackKey,
        imageBlob: item?.imageBlob || null,
        imageUrl: item?.imageUrl || null,
        lastModified: new Date().toISOString(),
      });
    });
  });
}

export async function getMapImage(regionKey, packId = null, ignorePackFilter = false) {
  if (!getDb()) await initDB();
  const db = getDb();
  const normalizedRegionKey = String(regionKey || '').trim() || 'default-region';
  const targetPackId = String(packId || getCurrentPackId() || '').trim();

  if (!ignorePackFilter) {
    const id = buildRecordId(normalizedRegionKey, targetPackId);
    return new Promise(resolve => {
      const tx = db.transaction([STORE_MAP_IMAGES], 'readonly');
      const store = tx.objectStore(STORE_MAP_IMAGES);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  const all = await getAllMapImages(targetPackId, true);
  return all.find(item => String(item.regionKey || '') === normalizedRegionKey) || null;
}

export async function getMapImageUrl(regionKey, packId = null, ignorePackFilter = false) {
  const record = await getMapImage(regionKey, packId, ignorePackFilter);
  return mapRecordToUrl(record);
}

export async function deleteMapImage(regionKey, packId = null) {
  if (!getDb()) await initDB();
  const db = getDb();
  const targetPackId = String(packId || getCurrentPackId() || '').trim();
  const normalizedRegionKey = String(regionKey || '').trim() || 'default-region';
  const id = buildRecordId(normalizedRegionKey, targetPackId);

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_MAP_IMAGES], 'readwrite');
    const store = tx.objectStore(STORE_MAP_IMAGES);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllMapImages(packId = null, ignorePackFilter = false) {
  if (!getDb()) await initDB();
  const db = getDb();
  return new Promise(resolve => {
    const tx = db.transaction([STORE_MAP_IMAGES], 'readonly');
    const store = tx.objectStore(STORE_MAP_IMAGES);
    const req = store.getAll();
    req.onsuccess = () => {
      let list = req.result || [];
      if (!ignorePackFilter) {
        const targetPackId = String(packId || getCurrentPackId() || '').trim();
        const scope = getRenderScope();
        if (scope === 'current') {
          list = list.filter(item => String(item.packId || '') === targetPackId);
        } else {
          list.sort((a, b) => {
            const aCur = String(a.packId || '') === targetPackId;
            const bCur = String(b.packId || '') === targetPackId;
            if (aCur && !bCur) return -1;
            if (!aCur && bCur) return 1;
            return 0;
          });
        }
      }
      resolve(list);
    };
    req.onerror = () => resolve([]);
  });
}

export async function getUnifiedMapImage(packId = null, ignorePackFilter = false) {
  const globalRecord = await getMapImage(GLOBAL_MAP_REGION_KEY, packId, ignorePackFilter);
  if (globalRecord) return globalRecord;
  const all = await getAllMapImages(packId, ignorePackFilter);
  if (!Array.isArray(all) || all.length === 0) return null;
  const currentPackId = String(packId || getCurrentPackId() || '').trim();
  const samePackFirst = all.find(item => String(item?.packId || '').trim() === currentPackId);
  return samePackFirst || all[0] || null;
}

export async function saveUnifiedMapImage(imageBlob, imageUrl = null, packId = null) {
  return saveMapImage(GLOBAL_MAP_REGION_KEY, imageBlob, imageUrl, packId);
}

export async function deleteUnifiedMapImage(packId = null) {
  return deleteMapImage(GLOBAL_MAP_REGION_KEY, packId);
}
