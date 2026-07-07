// ============================================
// 场景布局缓存：localStorage 按「角色卡 ID + 地点名」持久化布局 JSON
// 结构：{ [charId]: { [地点名]: { layout, generatedAt } } }
// ============================================
import { GalgameStore } from '../core/store.js';
import { getCurrentCharId } from '../core/settings.js';

// 单角色卡最多缓存的地点数，超出按 generatedAt 淘汰最旧
const MAX_LOCATIONS_PER_CHAR = 40;

const KEY = () => GalgameStore.STORAGE_KEYS.MAP_SCENE_LAYOUTS;

function readAll() {
  const data = GalgameStore.storage.get(KEY(), {});
  return data && typeof data === 'object' ? data : {};
}

function writeAll(data) {
  GalgameStore.storage.set(KEY(), data);
}

function charKey() {
  try {
    return String(getCurrentCharId() || '__default__');
  } catch {
    return '__default__';
  }
}

/**
 * 读取某地点的缓存布局；无缓存返回 null
 */
export function getCachedLayout(locationName) {
  const loc = String(locationName || '').trim();
  if (!loc) return null;
  const all = readAll();
  const entry = all[charKey()]?.[loc];
  if (!entry || !entry.layout || !Array.isArray(entry.layout.elements)) return null;
  return entry.layout;
}

/**
 * 写入某地点的布局缓存（兜底布局 _fallback 不应传入此函数）
 */
export function setCachedLayout(locationName, layout) {
  const loc = String(locationName || '').trim();
  if (!loc || !layout) return;
  const all = readAll();
  const ck = charKey();
  if (!all[ck] || typeof all[ck] !== 'object') all[ck] = {};
  all[ck][loc] = { layout, generatedAt: Date.now() };

  // LRU 淘汰：超出上限时删除最旧的地点
  const entries = Object.entries(all[ck]);
  if (entries.length > MAX_LOCATIONS_PER_CHAR) {
    entries
      .sort((a, b) => (a[1]?.generatedAt || 0) - (b[1]?.generatedAt || 0))
      .slice(0, entries.length - MAX_LOCATIONS_PER_CHAR)
      .forEach(([name]) => {
        delete all[ck][name];
      });
  }
  writeAll(all);
}

/**
 * 删除某地点的缓存（「重新生成」按钮用）
 */
export function clearCachedLayout(locationName) {
  const loc = String(locationName || '').trim();
  if (!loc) return;
  const all = readAll();
  const ck = charKey();
  if (all[ck] && all[ck][loc]) {
    delete all[ck][loc];
    writeAll(all);
  }
}
