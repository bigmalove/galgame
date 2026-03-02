import { SCRIPT_NAME } from '../core/constants.js';
import { GalgameStore } from '../core/store.js';

const CHAR_NAME_KEYWORDS_KEY = GalgameStore.STORAGE_KEYS.CHAR_NAME_KEYWORDS;
const KEYWORD_SPLIT_REGEX = /[,\|，、]+/;
const CHARACTER_NAME_NORMALIZE_REGEX = /[\s\u3000_\-·•.。,:：'"“”‘’`~!@#$%^&*()（）[\]{}<>《》、，!?？]/g;

function normalizeCharacterName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(CHARACTER_NAME_NORMALIZE_REGEX, '');
}

function dedupeKeywordList(rawList) {
  const out = [];
  const seenNormalized = new Set();
  for (const item of Array.isArray(rawList) ? rawList : []) {
    const text = String(item || '').trim();
    if (!text) continue;
    const normalized = normalizeCharacterName(text);
    if (!normalized || seenNormalized.has(normalized)) continue;
    seenNormalized.add(normalized);
    out.push(text);
  }
  return out;
}

function normalizeKeywordMap(rawMap) {
  const source = rawMap && typeof rawMap === 'object' && !Array.isArray(rawMap) ? rawMap : {};
  const out = {};
  for (const [rawCharacterId, rawKeywords] of Object.entries(source)) {
    const characterId = String(rawCharacterId || '').trim();
    if (!characterId) continue;
    const keywords = Array.isArray(rawKeywords)
      ? dedupeKeywordList(rawKeywords)
      : parseCharacterNameKeywords(rawKeywords);
    if (keywords.length > 0) {
      out[characterId] = keywords;
    }
  }
  return out;
}

function readKeywordMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CHAR_NAME_KEYWORDS_KEY) || '{}');
    return normalizeKeywordMap(parsed);
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 读取角色名关键字失败:`, e);
    return {};
  }
}

function writeKeywordMap(map) {
  try {
    localStorage.setItem(CHAR_NAME_KEYWORDS_KEY, JSON.stringify(normalizeKeywordMap(map)));
  } catch (e) {
    console.error(`[${SCRIPT_NAME}] 保存角色名关键字失败:`, e);
  }
}

function normalizeCandidateIds(candidateIds) {
  return Array.from(
    new Set(
      (Array.isArray(candidateIds) ? candidateIds : [])
        .map(id => String(id || '').trim())
        .filter(Boolean),
    ),
  );
}

export function parseCharacterNameKeywords(rawInput) {
  const source = Array.isArray(rawInput)
    ? rawInput
    : String(rawInput || '').split(KEYWORD_SPLIT_REGEX);
  return dedupeKeywordList(source);
}

export function getAllCharacterNameKeywords() {
  return readKeywordMap();
}

export function getCharacterNameKeywords(characterId) {
  const keywordMap = readKeywordMap();
  const rawCharacterId = String(characterId || '').trim();
  if (!rawCharacterId) return [];
  if (Object.prototype.hasOwnProperty.call(keywordMap, rawCharacterId)) {
    return (keywordMap[rawCharacterId] || []).slice();
  }
  const resolvedCharacterId = resolveCharacterIdByKeywords(rawCharacterId, Object.keys(keywordMap));
  if (resolvedCharacterId && Object.prototype.hasOwnProperty.call(keywordMap, resolvedCharacterId)) {
    return (keywordMap[resolvedCharacterId] || []).slice();
  }
  return [];
}

export function setCharacterNameKeywords(characterId, rawInputOrArray) {
  const rawCharacterId = String(characterId || '').trim();
  if (!rawCharacterId) return [];

  const keywordMap = readKeywordMap();
  const nextKeywords = parseCharacterNameKeywords(rawInputOrArray);
  const targetCharacterId = Object.prototype.hasOwnProperty.call(keywordMap, rawCharacterId)
    ? rawCharacterId
    : (resolveCharacterIdByKeywords(rawCharacterId, Object.keys(keywordMap)) || rawCharacterId);

  const normalizedKeywords = new Set(nextKeywords.map(item => normalizeCharacterName(item)).filter(Boolean));
  for (const [otherCharacterId, list] of Object.entries(keywordMap)) {
    if (otherCharacterId === targetCharacterId) continue;
    if (normalizedKeywords.size === 0) continue;
    const filtered = (Array.isArray(list) ? list : []).filter(item => !normalizedKeywords.has(normalizeCharacterName(item)));
    if (filtered.length > 0) {
      keywordMap[otherCharacterId] = filtered;
    } else {
      delete keywordMap[otherCharacterId];
    }
  }

  if (nextKeywords.length > 0) {
    keywordMap[targetCharacterId] = nextKeywords;
  } else {
    delete keywordMap[targetCharacterId];
  }

  writeKeywordMap(keywordMap);
  return nextKeywords.slice();
}

export function resolveCharacterIdByKeywords(inputName, candidateIds) {
  const rawInputName = String(inputName || '').trim();
  if (!rawInputName) return null;

  const keywordMap = readKeywordMap();
  const candidates = normalizeCandidateIds(candidateIds);
  const targetIds = candidates.length > 0 ? candidates : Object.keys(keywordMap);
  if (targetIds.length === 0) return null;

  const exactMatched = targetIds.find(id => id === rawInputName);
  if (exactMatched) return exactMatched;

  const normalizedInputName = normalizeCharacterName(rawInputName);
  if (!normalizedInputName) return null;

  const normalizedMatched = targetIds.find(id => normalizeCharacterName(id) === normalizedInputName);
  if (normalizedMatched) return normalizedMatched;

  for (const characterId of targetIds) {
    const keywords = keywordMap[characterId];
    if (!Array.isArray(keywords) || keywords.length === 0) continue;
    const hit = keywords.find(keyword => normalizeCharacterName(keyword) === normalizedInputName);
    if (hit) return characterId;
  }

  return null;
}
