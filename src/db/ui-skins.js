import { SCRIPT_NAME, DEFAULT_PACK_ID, STORE_UI_SKINS, CUSTOM_SKIN_ID } from '../core/constants.js';
import { getDb } from '../core/state.js';
import { initDB } from './init.js';
import { getCurrentPackId } from './image-packs.js';

const DEFAULT_DEVICE = 'desktop';
const DEFAULT_STATE = 'normal';

function normalizeKeyPart(value, fallback = '') {
  const trimmed = String(value || '').trim();
  return trimmed || fallback;
}

function buildPackSkinKey(packId, skinId) {
  return `${packId}::${skinId}`;
}

function buildPackSkinDeviceKey(packId, skinId, device) {
  return `${packId}::${skinId}::${device}`;
}

function buildLookupKey(packId, skinId, elementId, device, state) {
  return `${packId}::${skinId}::${elementId}::${device}::${state}`;
}

export function buildUiSkinAssetId(packId, skinId, elementId, device = DEFAULT_DEVICE, state = DEFAULT_STATE) {
  const safePackId = normalizeKeyPart(packId, DEFAULT_PACK_ID);
  const safeSkinId = normalizeKeyPart(skinId, CUSTOM_SKIN_ID);
  const safeElementId = normalizeKeyPart(elementId, 'unknown-element');
  const safeDevice = normalizeKeyPart(device, DEFAULT_DEVICE);
  const safeState = normalizeKeyPart(state, DEFAULT_STATE);
  return `${safePackId}:${safeSkinId}:${safeElementId}:${safeDevice}:${safeState}`;
}

function normalizeUiSkinAsset(payload = {}) {
  const resolvedPackId = normalizeKeyPart(payload.packId, getCurrentPackId() || DEFAULT_PACK_ID);
  const resolvedSkinId = normalizeKeyPart(payload.skinId, CUSTOM_SKIN_ID);
  const resolvedElementId = normalizeKeyPart(payload.elementId, 'unknown-element');
  const resolvedDevice = normalizeKeyPart(payload.device, DEFAULT_DEVICE);
  const resolvedState = normalizeKeyPart(payload.state, DEFAULT_STATE);
  const id = normalizeKeyPart(
    payload.id,
    buildUiSkinAssetId(resolvedPackId, resolvedSkinId, resolvedElementId, resolvedDevice, resolvedState),
  );

  return {
    id,
    packId: resolvedPackId,
    skinId: resolvedSkinId,
    elementId: resolvedElementId,
    device: resolvedDevice,
    state: resolvedState,
    packSkinKey: buildPackSkinKey(resolvedPackId, resolvedSkinId),
    packSkinDeviceKey: buildPackSkinDeviceKey(resolvedPackId, resolvedSkinId, resolvedDevice),
    lookupKey: buildLookupKey(resolvedPackId, resolvedSkinId, resolvedElementId, resolvedDevice, resolvedState),
    imageBlob: payload.imageBlob || null,
    imageUrl: payload.imageUrl || null,
    layout: payload.layout || null,
    scaleMode: normalizeKeyPart(payload.scaleMode, 'stretch'),
    slice: payload.slice || null,
    textPadding: payload.textPadding || null,
    meta: payload.meta || null,
    updatedAt: new Date().toISOString(),
  };
}

async function ensureDbReady() {
  if (!getDb()) await initDB();
  return getDb();
}

export async function saveUiSkinAsset(payload = {}) {
  const db = await ensureDbReady();
  const data = normalizeUiSkinAsset(payload);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_UI_SKINS], 'readwrite');
    const store = transaction.objectStore(STORE_UI_SKINS);
    const request = store.put(data);
    transaction.oncomplete = () => {
      console.log(`[${SCRIPT_NAME}] UI 皮肤元素已保存: ${data.id}`);
      resolve(data);
    };
    transaction.onabort = () => reject(transaction.error || request.error);
    transaction.onerror = () => reject(transaction.error || request.error);
    request.onerror = () => reject(request.error);
  });
}

export async function getUiSkinAssetById(id) {
  const safeId = normalizeKeyPart(id, '');
  if (!safeId) return null;
  const db = await ensureDbReady();
  return new Promise(resolve => {
    const transaction = db.transaction([STORE_UI_SKINS], 'readonly');
    const store = transaction.objectStore(STORE_UI_SKINS);
    const request = store.get(safeId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

export async function getUiSkinAsset(packId, skinId, elementId, device = DEFAULT_DEVICE, state = DEFAULT_STATE) {
  const id = buildUiSkinAssetId(packId, skinId, elementId, device, state);
  return getUiSkinAssetById(id);
}

export async function getUiSkinAssetsByPackSkin(packId, skinId, device = null) {
  const safePackId = normalizeKeyPart(packId, getCurrentPackId() || DEFAULT_PACK_ID);
  const safeSkinId = normalizeKeyPart(skinId, CUSTOM_SKIN_ID);
  const safeDevice = device ? normalizeKeyPart(device, DEFAULT_DEVICE) : null;
  const db = await ensureDbReady();
  return new Promise(resolve => {
    const transaction = db.transaction([STORE_UI_SKINS], 'readonly');
    const store = transaction.objectStore(STORE_UI_SKINS);
    const indexName = safeDevice ? 'packSkinDeviceKey' : 'packSkinKey';
    const key = safeDevice
      ? buildPackSkinDeviceKey(safePackId, safeSkinId, safeDevice)
      : buildPackSkinKey(safePackId, safeSkinId);
    const index = store.index(indexName);
    const request = index.getAll(IDBKeyRange.only(key));
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

export async function getAllUiSkinAssets() {
  const db = await ensureDbReady();
  return new Promise(resolve => {
    const transaction = db.transaction([STORE_UI_SKINS], 'readonly');
    const store = transaction.objectStore(STORE_UI_SKINS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

export async function deleteUiSkinAssetById(id) {
  const safeId = normalizeKeyPart(id, '');
  if (!safeId) return false;
  const db = await ensureDbReady();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_UI_SKINS], 'readwrite');
    const store = transaction.objectStore(STORE_UI_SKINS);
    const request = store.delete(safeId);
    transaction.oncomplete = () => resolve(true);
    transaction.onabort = () => reject(transaction.error || request.error);
    transaction.onerror = () => reject(transaction.error || request.error);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteUiSkinAsset(packId, skinId, elementId, device = DEFAULT_DEVICE, state = DEFAULT_STATE) {
  const id = buildUiSkinAssetId(packId, skinId, elementId, device, state);
  return deleteUiSkinAssetById(id);
}

export async function deleteUiSkinAssetsByPackSkin(packId, skinId) {
  const safePackId = normalizeKeyPart(packId, getCurrentPackId() || DEFAULT_PACK_ID);
  const safeSkinId = normalizeKeyPart(skinId, CUSTOM_SKIN_ID);
  const targetPackSkinKey = buildPackSkinKey(safePackId, safeSkinId);
  const db = await ensureDbReady();

  return new Promise((resolve, reject) => {
    let deletedCount = 0;
    const transaction = db.transaction([STORE_UI_SKINS], 'readwrite');
    const store = transaction.objectStore(STORE_UI_SKINS);
    const index = store.index('packSkinKey');
    const request = index.openCursor(IDBKeyRange.only(targetPackSkinKey));

    transaction.oncomplete = () => resolve(deletedCount);
    transaction.onabort = () => reject(transaction.error || request.error);
    transaction.onerror = () => reject(transaction.error || request.error);

    request.onsuccess = event => {
      const cursor = event.target.result;
      if (cursor) {
        deletedCount += 1;
        cursor.delete();
        cursor.continue();
        return;
      }
    };
    request.onerror = () => reject(request.error);
  });
}
