import { SCRIPT_NAME } from '../core/constants.js';
import { getSettings } from '../core/settings.js';

// ============================================
// TTS 语音缓存（IndexedDB）
// ============================================
// 合成好的音频按「引擎 + 音色参数 + 朗读文本」的哈希存下来：同一句话在倒退、读档、reroll 回到原文、
// 对话记录里重播时直接播本地音频，不再请求合成。
// 用独立数据库而不是主库新增表：主库版本号由多个模块共用（live2d/loader.js 也会按 DB_VERSION 打开），
// 缓存与资源完全无关，独立后清空、淘汰都不影响资源数据，也不会混进资源导出。
// 两张表：audio 只存音频；meta 存大小与最近访问时间，淘汰时只扫 meta，不读音频。

const CACHE_DB_NAME = 'GalgameUIPluginTTSCache';
const CACHE_DB_VERSION = 1;
const STORE_AUDIO = 'audio';
const STORE_META = 'meta';
const DEFAULT_LIMIT_MB = 200;
const MIN_LIMIT_MB = 20;
const MAX_LIMIT_MB = 2048;
const PRUNE_DELAY_MS = 1500;

let _dbPromise = null;
let _pruneTimer = null;

function openCacheDb() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB 不可用'));
      return;
    }
    const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_AUDIO)) {
        db.createObjectStore(STORE_AUDIO, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        const metaStore = db.createObjectStore(STORE_META, { keyPath: 'key' });
        metaStore.createIndex('lastAccess', 'lastAccess', { unique: false });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // 其他标签页清空缓存（deleteDatabase）时让出连接，下次访问重新打开
      db.onversionchange = () => {
        db.close();
        _dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  }).catch(error => {
    _dbPromise = null;
    throw error;
  });
  return _dbPromise;
}

// 小白X 等宿主页面接口返回的 Blob 来自另一个 window，instanceof 判断不成立，按形状识别
function isBlobLike(value) {
  return !!value && typeof value.size === 'number' && typeof value.arrayBuffer === 'function';
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
    tx.onerror = () => reject(tx.error);
  });
}

// cyrb53 的两种种子拼成约 106 位哈希：同步、不依赖安全上下文（局域网 http 访问酒馆时没有 crypto.subtle）
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * 由影响合成结果的各项参数生成缓存键；任一项为空也参与拼接，避免字段错位撞键
 * @param {Array<unknown>} parts
 * @returns {string}
 */
export function buildTtsCacheKey(parts) {
  const source = (Array.isArray(parts) ? parts : [parts])
    .map(part => (part == null ? '' : typeof part === 'object' ? JSON.stringify(part) : String(part)))
    .join('␟');
  return `v1_${source.length.toString(36)}_${cyrb53(source)}_${cyrb53(source, 0x9e3779b9)}`;
}

export function isTtsCacheEnabled() {
  return getSettings()?.ttsAudioCacheEnabled !== false;
}

export function normalizeTtsCacheLimitMB(value) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT_MB;
  return Math.max(MIN_LIMIT_MB, Math.min(MAX_LIMIT_MB, parsed));
}

function getLimitBytes() {
  return normalizeTtsCacheLimitMB(getSettings()?.ttsAudioCacheLimitMB) * 1024 * 1024;
}

/**
 * 读取缓存音频；命中时顺带刷新最近访问时间
 * @param {string} key
 * @returns {Promise<Blob|null>}
 */
export async function getCachedTtsAudio(key) {
  if (!key) return null;
  try {
    const db = await openCacheDb();
    const tx = db.transaction([STORE_AUDIO, STORE_META], 'readwrite');
    const record = await requestToPromise(tx.objectStore(STORE_AUDIO).get(key));
    const blob = isBlobLike(record?.blob) && record.blob.size > 0 ? record.blob : null;
    if (blob) {
      const metaStore = tx.objectStore(STORE_META);
      const meta = await requestToPromise(metaStore.get(key));
      metaStore.put({ ...(meta || { key, size: blob.size, createdAt: Date.now() }), lastAccess: Date.now() });
    }
    await transactionDone(tx);
    return blob;
  } catch (error) {
    console.warn(`[${SCRIPT_NAME}] TTS 缓存读取失败`, error);
    return null;
  }
}

/**
 * 批量判断是否已缓存（只查 meta，不读音频）
 * @param {string[]} keys
 * @returns {Promise<Set<string>>}
 */
export async function getCachedTtsKeys(keys) {
  const result = new Set();
  const list = Array.from(new Set((keys || []).filter(Boolean)));
  if (list.length === 0) return result;
  try {
    const db = await openCacheDb();
    const tx = db.transaction(STORE_META, 'readonly');
    const store = tx.objectStore(STORE_META);
    await Promise.all(list.map(async key => {
      const count = await requestToPromise(store.count(key));
      if (count > 0) result.add(key);
    }));
  } catch (error) {
    console.warn(`[${SCRIPT_NAME}] TTS 缓存查询失败`, error);
  }
  return result;
}

/**
 * 写入缓存音频；写入后延迟检查容量上限
 * @param {string} key
 * @param {Blob} blob
 * @param {{ provider?: string, text?: string }} [info]
 */
export async function putCachedTtsAudio(key, blob, info = {}) {
  if (!key || !isBlobLike(blob) || blob.size <= 0) return false;
  if (blob.size > getLimitBytes()) return false;
  try {
    const db = await openCacheDb();
    const now = Date.now();
    const tx = db.transaction([STORE_AUDIO, STORE_META], 'readwrite');
    tx.objectStore(STORE_AUDIO).put({ key, blob });
    tx.objectStore(STORE_META).put({
      key,
      size: blob.size,
      provider: String(info.provider || ''),
      text: String(info.text || '').slice(0, 60),
      createdAt: now,
      lastAccess: now,
    });
    await transactionDone(tx);
    schedulePrune();
    return true;
  } catch (error) {
    console.warn(`[${SCRIPT_NAME}] TTS 缓存写入失败`, error);
    return false;
  }
}

function schedulePrune() {
  if (_pruneTimer) clearTimeout(_pruneTimer);
  _pruneTimer = setTimeout(() => {
    _pruneTimer = null;
    void pruneTtsAudioCache();
  }, PRUNE_DELAY_MS);
}

/**
 * 超出容量上限时按最近访问时间从旧到新淘汰
 */
export async function pruneTtsAudioCache() {
  try {
    const db = await openCacheDb();
    const limit = getLimitBytes();
    const metas = await requestToPromise(db.transaction(STORE_META, 'readonly').objectStore(STORE_META).index('lastAccess').getAll());
    let total = metas.reduce((sum, meta) => sum + (Number(meta?.size) || 0), 0);
    if (total <= limit) return 0;

    const victims = [];
    for (const meta of metas) {
      if (total <= limit) break;
      victims.push(meta.key);
      total -= Number(meta.size) || 0;
    }
    const tx = db.transaction([STORE_AUDIO, STORE_META], 'readwrite');
    const audioStore = tx.objectStore(STORE_AUDIO);
    const metaStore = tx.objectStore(STORE_META);
    victims.forEach(key => {
      audioStore.delete(key);
      metaStore.delete(key);
    });
    await transactionDone(tx);
    console.log(`[${SCRIPT_NAME}] TTS 缓存超出上限，已淘汰 ${victims.length} 条`);
    return victims.length;
  } catch (error) {
    console.warn(`[${SCRIPT_NAME}] TTS 缓存淘汰失败`, error);
    return 0;
  }
}

/**
 * @returns {Promise<{ count: number, bytes: number }>}
 */
export async function getTtsAudioCacheStats() {
  try {
    const db = await openCacheDb();
    const metas = await requestToPromise(db.transaction(STORE_META, 'readonly').objectStore(STORE_META).getAll());
    return {
      count: metas.length,
      bytes: metas.reduce((sum, meta) => sum + (Number(meta?.size) || 0), 0),
    };
  } catch (error) {
    return { count: 0, bytes: 0 };
  }
}

export async function clearTtsAudioCache() {
  const db = await openCacheDb();
  const tx = db.transaction([STORE_AUDIO, STORE_META], 'readwrite');
  tx.objectStore(STORE_AUDIO).clear();
  tx.objectStore(STORE_META).clear();
  await transactionDone(tx);
}
