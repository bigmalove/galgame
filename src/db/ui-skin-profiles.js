import {
  CUSTOM_SKIN_PROFILE_ID_PREFIX,
  GLOBAL_CUSTOM_SKIN_PACK_ID,
  SCRIPT_NAME,
  STORE_UI_SKIN_PROFILES,
} from '../core/constants.js';
import { getDb } from '../core/state.js';
import { initDB } from './init.js';
import {
  deleteUiSkinAssetsByPackSkin,
  getUiSkinAssetsByPackSkin,
  saveUiSkinAsset,
} from './ui-skins.js';

const DEFAULT_PROFILE_NAME = '自定义皮肤';

let cachedProfiles = [];
let cachedProfileMap = new Map();

function normalizeProfileDisplayName(rawName, fallback = DEFAULT_PROFILE_NAME) {
  const name = String(rawName || '').trim();
  return name || fallback;
}

function normalizeProfileId(rawId) {
  const id = String(rawId || '').trim();
  if (!id) return '';
  return id.startsWith(CUSTOM_SKIN_PROFILE_ID_PREFIX) ? id : '';
}

function generateProfileId() {
  const seed = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${CUSTOM_SKIN_PROFILE_ID_PREFIX}${seed}`;
}

function compareProfiles(a, b) {
  const sortA = Number(a?.sortOrder || 0);
  const sortB = Number(b?.sortOrder || 0);
  if (sortA !== sortB) return sortA - sortB;
  const updatedA = String(a?.updatedAt || '');
  const updatedB = String(b?.updatedAt || '');
  if (updatedA !== updatedB) return updatedA.localeCompare(updatedB, 'zh-Hans-CN');
  return String(a?.displayName || '').localeCompare(String(b?.displayName || ''), 'zh-Hans-CN');
}

function setProfileCache(list) {
  cachedProfiles = Array.isArray(list) ? [...list].sort(compareProfiles) : [];
  cachedProfileMap = new Map(cachedProfiles.map(profile => [profile.id, profile]));
  return cachedProfiles;
}

async function ensureDbReady() {
  if (!getDb()) await initDB();
  return getDb();
}

async function putProfileRecord(record) {
  const db = await ensureDbReady();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_UI_SKIN_PROFILES], 'readwrite');
    const store = transaction.objectStore(STORE_UI_SKIN_PROFILES);
    const request = store.put(record);
    transaction.oncomplete = () => resolve(record);
    transaction.onabort = () => reject(transaction.error || request.error);
    transaction.onerror = () => reject(transaction.error || request.error);
    request.onerror = () => reject(request.error);
  });
}

async function getProfileRecord(id) {
  const safeId = normalizeProfileId(id);
  if (!safeId) return null;
  const db = await ensureDbReady();
  return new Promise(resolve => {
    const transaction = db.transaction([STORE_UI_SKIN_PROFILES], 'readonly');
    const store = transaction.objectStore(STORE_UI_SKIN_PROFILES);
    const request = store.get(safeId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

async function deleteProfileRecord(id) {
  const safeId = normalizeProfileId(id);
  if (!safeId) return false;
  const db = await ensureDbReady();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_UI_SKIN_PROFILES], 'readwrite');
    const store = transaction.objectStore(STORE_UI_SKIN_PROFILES);
    const request = store.delete(safeId);
    transaction.oncomplete = () => resolve(true);
    transaction.onabort = () => reject(transaction.error || request.error);
    transaction.onerror = () => reject(transaction.error || request.error);
    request.onerror = () => reject(request.error);
  });
}

function buildUniqueDisplayName(rawName, profiles = cachedProfiles) {
  const baseName = normalizeProfileDisplayName(rawName);
  const existing = new Set((Array.isArray(profiles) ? profiles : []).map(item => String(item?.displayName || '').trim()));
  if (!existing.has(baseName)) return baseName;
  let index = 2;
  while (existing.has(`${baseName} (${index})`)) {
    index += 1;
  }
  return `${baseName} (${index})`;
}

export function isCustomSkinProfileId(rawId) {
  return !!normalizeProfileId(rawId);
}

export function hasUiSkinProfileId(rawId) {
  const safeId = normalizeProfileId(rawId);
  return !!safeId && cachedProfileMap.has(safeId);
}

export function getCachedUiSkinProfiles() {
  return cachedProfiles.map(profile => ({ ...profile }));
}

export function getUiSkinProfileLabel(id) {
  const safeId = normalizeProfileId(id);
  if (!safeId) return '';
  return cachedProfileMap.get(safeId)?.displayName || safeId;
}

export function getAvailableUiSkinProfileDisplayName(rawName, profiles = cachedProfiles) {
  return buildUniqueDisplayName(rawName, profiles);
}

export async function refreshUiSkinProfilesCache() {
  const db = await ensureDbReady();
  return new Promise(resolve => {
    const transaction = db.transaction([STORE_UI_SKIN_PROFILES], 'readonly');
    const store = transaction.objectStore(STORE_UI_SKIN_PROFILES);
    const request = store.getAll();
    request.onsuccess = () => resolve(setProfileCache(request.result || []));
    request.onerror = () => resolve(setProfileCache([]));
  });
}

export async function listUiSkinProfiles() {
  const profiles = await refreshUiSkinProfilesCache();
  return profiles.map(profile => ({ ...profile }));
}

export async function getUiSkinProfile(id) {
  const record = await getProfileRecord(id);
  return record ? { ...record } : null;
}

export async function saveUiSkinProfile(profile = {}) {
  const now = new Date().toISOString();
  const existing = normalizeProfileId(profile.id) ? await getProfileRecord(profile.id) : null;
  const id = normalizeProfileId(profile.id) || generateProfileId();
  const record = {
    id,
    displayName: normalizeProfileDisplayName(profile.displayName, existing?.displayName || DEFAULT_PROFILE_NAME),
    createdAt: String(profile.createdAt || existing?.createdAt || now),
    updatedAt: String(profile.updatedAt || now),
    sortOrder: Number.isFinite(Number(profile.sortOrder))
      ? Number(profile.sortOrder)
      : Number(existing?.sortOrder || Date.now()),
  };
  await putProfileRecord(record);
  await refreshUiSkinProfilesCache();
  console.log(`[${SCRIPT_NAME}] 保存自定义皮肤 profile: ${record.id} (${record.displayName})`);
  return { ...record };
}

export async function createUiSkinProfile({ displayName, id } = {}) {
  const currentProfiles = await refreshUiSkinProfilesCache();
  const record = await saveUiSkinProfile({
    id,
    displayName: buildUniqueDisplayName(
      displayName || `${DEFAULT_PROFILE_NAME} ${currentProfiles.length + 1}`,
      currentProfiles,
    ),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sortOrder: Date.now(),
  });
  return record;
}

export async function renameUiSkinProfile(id, displayName) {
  const existing = await getProfileRecord(id);
  if (!existing) {
    throw new Error('要重命名的自定义皮肤不存在');
  }
  const profiles = await refreshUiSkinProfilesCache();
  const otherProfiles = profiles.filter(profile => profile.id !== existing.id);
  return saveUiSkinProfile({
    ...existing,
    displayName: buildUniqueDisplayName(displayName, otherProfiles),
    updatedAt: new Date().toISOString(),
  });
}

export async function duplicateUiSkinProfile(sourceId, { displayName, newId } = {}) {
  const sourceProfile = await getProfileRecord(sourceId);
  if (!sourceProfile) {
    throw new Error('源自定义皮肤不存在');
  }
  const profiles = await refreshUiSkinProfilesCache();
  const duplicatedProfile = await saveUiSkinProfile({
    id: newId || generateProfileId(),
    displayName: buildUniqueDisplayName(displayName || `${sourceProfile.displayName} 副本`, profiles),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sortOrder: Date.now(),
  });

  const assets = await getUiSkinAssetsByPackSkin(GLOBAL_CUSTOM_SKIN_PACK_ID, sourceProfile.id);
  await Promise.all(
    assets.map(asset =>
      saveUiSkinAsset({
        ...asset,
        id: undefined,
        packId: GLOBAL_CUSTOM_SKIN_PACK_ID,
        skinId: duplicatedProfile.id,
      }),
    ),
  );

  console.log(`[${SCRIPT_NAME}] 复制自定义皮肤 profile: ${sourceProfile.id} -> ${duplicatedProfile.id}`);
  return duplicatedProfile;
}

export async function deleteUiSkinProfile(id) {
  const safeId = normalizeProfileId(id);
  if (!safeId) return false;
  await deleteUiSkinAssetsByPackSkin(GLOBAL_CUSTOM_SKIN_PACK_ID, safeId);
  await deleteProfileRecord(safeId);
  await refreshUiSkinProfilesCache();
  console.log(`[${SCRIPT_NAME}] 删除自定义皮肤 profile: ${safeId}`);
  return true;
}
