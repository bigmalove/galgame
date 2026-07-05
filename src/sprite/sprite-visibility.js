import { SCRIPT_NAME } from '../core/constants.js';
import { GalgameStore } from '../core/store.js';
import { getAllCharacterNameKeywords, resolveCharacterIdByKeywords } from '../utils/character-name-keywords.js';

// ============================================
// 每角色立绘显示开关
// map 中不存在该角色 = 显示（只存禁用项）
// ============================================
const CHAR_SPRITE_VISIBLE_KEY = GalgameStore.STORAGE_KEYS.CHAR_SPRITE_VISIBLE;

function normalizeCharacterIdKey(characterId) {
  return String(characterId || '').trim().toLowerCase();
}

export function getCharacterSpriteVisible(characterId) {
  try {
    const map = JSON.parse(localStorage.getItem(CHAR_SPRITE_VISIBLE_KEY) || '{}');
    const rawKey = String(characterId ?? '').trim();
    if (!rawKey) return true;
    if (Object.prototype.hasOwnProperty.call(map, rawKey)) {
      return map[rawKey] !== false;
    }

    const resolvedKey = resolveCharacterIdByKeywords(rawKey, Object.keys(map));
    if (resolvedKey && Object.prototype.hasOwnProperty.call(map, resolvedKey)) {
      return map[resolvedKey] !== false;
    }

    const normalizedTarget = normalizeCharacterIdKey(characterId);
    if (!normalizedTarget) return true;

    for (const [key, value] of Object.entries(map)) {
      if (normalizeCharacterIdKey(key) === normalizedTarget) {
        return value !== false;
      }
    }
    return true;
  } catch {
    return true;
  }
}

export function setCharacterSpriteVisible(characterId, visible) {
  try {
    const map = JSON.parse(localStorage.getItem(CHAR_SPRITE_VISIBLE_KEY) || '{}');
    const rawKey = String(characterId ?? '').trim();
    if (!rawKey) return;
    const candidateIds = Array.from(new Set([
      ...Object.keys(map),
      ...Object.keys(getAllCharacterNameKeywords()),
      rawKey,
    ]));
    const resolvedKey = resolveCharacterIdByKeywords(rawKey, candidateIds) || rawKey;
    if (visible) {
      delete map[rawKey];
      if (resolvedKey !== rawKey) {
        delete map[resolvedKey];
      }
      // 清理 lowercase 兜底残留
      const normalizedKey = normalizeCharacterIdKey(resolvedKey);
      if (normalizedKey && normalizedKey !== resolvedKey) {
        delete map[normalizedKey];
      }
    } else {
      map[resolvedKey] = false;
      if (resolvedKey !== rawKey) {
        delete map[rawKey];
      }
    }
    localStorage.setItem(CHAR_SPRITE_VISIBLE_KEY, JSON.stringify(map));
  } catch (e) {
    console.error(`[${SCRIPT_NAME}] 保存角色立绘显示开关失败:`, e);
  }
}
