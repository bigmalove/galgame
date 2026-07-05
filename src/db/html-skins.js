import { HTML_SKIN_ID_PREFIX, SCRIPT_NAME, STORE_HTML_SKINS } from '../core/constants.js';
import { getDb } from '../core/state.js';
import { initDB } from './init.js';

const DEFAULT_SKIN_NAME = '自定义皮肤';

let cachedSkins = [];
let cachedSkinMap = new Map();

function normalizeSkinName(rawName, fallback = DEFAULT_SKIN_NAME) {
  const name = String(rawName || '').trim();
  return name || fallback;
}

function normalizeSkinId(rawId) {
  const id = String(rawId || '').trim();
  if (!id) return '';
  return id.startsWith(HTML_SKIN_ID_PREFIX) ? id : '';
}

function normalizeSkinRecord(rawRecord = {}) {
  const safeRecord = rawRecord && typeof rawRecord === 'object' && !Array.isArray(rawRecord) ? rawRecord : {};
  return {
    id: normalizeSkinId(safeRecord.id),
    name: normalizeSkinName(safeRecord.name),
    author: String(safeRecord.author || '').trim(),
    version: String(safeRecord.version || '').trim(),
    rawCss: String(safeRecord.rawCss || ''),
    scopedCss: String(safeRecord.scopedCss || ''),
    createdAt: String(safeRecord.createdAt || '').trim(),
    updatedAt: String(safeRecord.updatedAt || '').trim(),
  };
}

function generateHtmlSkinId() {
  const seed = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${HTML_SKIN_ID_PREFIX}${seed}`;
}

function compareSkins(a, b) {
  const updatedA = String(a?.updatedAt || '');
  const updatedB = String(b?.updatedAt || '');
  if (updatedA !== updatedB) return updatedB.localeCompare(updatedA);
  return String(a?.name || '').localeCompare(String(b?.name || ''), 'zh-Hans-CN');
}

function setSkinCache(list) {
  cachedSkins = (Array.isArray(list) ? list : [])
    .map(record => normalizeSkinRecord(record))
    .filter(record => !!record.id)
    .sort(compareSkins);
  cachedSkinMap = new Map(cachedSkins.map(record => [record.id, record]));
  return cachedSkins;
}

async function ensureDbReady() {
  if (!getDb()) await initDB();
  return getDb();
}

async function putSkinRecord(record) {
  const db = await ensureDbReady();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_HTML_SKINS], 'readwrite');
    const store = transaction.objectStore(STORE_HTML_SKINS);
    const request = store.put(record);
    transaction.oncomplete = () => resolve(record);
    transaction.onabort = () => reject(transaction.error || request.error);
    transaction.onerror = () => reject(transaction.error || request.error);
    request.onerror = () => reject(request.error);
  });
}

async function deleteSkinRecord(id) {
  const safeId = normalizeSkinId(id);
  if (!safeId) return false;
  const db = await ensureDbReady();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_HTML_SKINS], 'readwrite');
    const store = transaction.objectStore(STORE_HTML_SKINS);
    const request = store.delete(safeId);
    transaction.oncomplete = () => resolve(true);
    transaction.onabort = () => reject(transaction.error || request.error);
    transaction.onerror = () => reject(transaction.error || request.error);
    request.onerror = () => reject(request.error);
  });
}

export function isHtmlSkinId(rawId) {
  return !!normalizeSkinId(rawId);
}

export function hasHtmlSkinId(rawId) {
  const safeId = normalizeSkinId(rawId);
  return !!safeId && cachedSkinMap.has(safeId);
}

export function getCachedHtmlSkins() {
  return cachedSkins.map(record => ({ ...record }));
}

export function getCachedHtmlSkin(id) {
  const safeId = normalizeSkinId(id);
  if (!safeId) return null;
  const record = cachedSkinMap.get(safeId);
  return record ? { ...record } : null;
}

export function getHtmlSkinLabel(id) {
  const safeId = normalizeSkinId(id);
  if (!safeId) return '';
  return cachedSkinMap.get(safeId)?.name || safeId;
}

export async function loadHtmlSkinsToCache() {
  const db = await ensureDbReady();
  return new Promise(resolve => {
    const transaction = db.transaction([STORE_HTML_SKINS], 'readonly');
    const store = transaction.objectStore(STORE_HTML_SKINS);
    const request = store.getAll();
    request.onsuccess = () => resolve(setSkinCache(request.result || []));
    request.onerror = () => resolve(setSkinCache([]));
  });
}

export async function saveHtmlSkin(skin = {}) {
  const now = new Date().toISOString();
  const id = normalizeSkinId(skin.id) || generateHtmlSkinId();
  const existing = cachedSkinMap.get(id) || null;
  const record = normalizeSkinRecord({
    ...existing,
    ...skin,
    id,
    createdAt: skin.createdAt || existing?.createdAt || now,
    updatedAt: now,
  });
  await putSkinRecord(record);
  await loadHtmlSkinsToCache();
  console.log(`[${SCRIPT_NAME}] 保存 HTML 皮肤: ${record.id} (${record.name})`);
  return { ...record };
}

export async function renameHtmlSkin(id, name) {
  const existing = getCachedHtmlSkin(id);
  if (!existing) {
    throw new Error('要重命名的自定义皮肤不存在');
  }
  return saveHtmlSkin({ ...existing, name: normalizeSkinName(name, existing.name) });
}

export async function deleteHtmlSkin(id) {
  const safeId = normalizeSkinId(id);
  if (!safeId) return false;
  await deleteSkinRecord(safeId);
  await loadHtmlSkinsToCache();
  console.log(`[${SCRIPT_NAME}] 删除 HTML 皮肤: ${safeId}`);
  return true;
}
