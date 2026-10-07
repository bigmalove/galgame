import { SCRIPT_NAME } from '../core/constants.js';
import { $, getTavernContext, topWindow } from '../core/env.js';
import { GalgameStore } from '../core/store.js';
import { parseGalgameContent } from '../logic/parser.js';
import { extractMessageContent } from './interaction.js';

// ============================================
// 对话记录（Backlog）数据：按楼层收集已读过的段落
// ============================================
// 范围：聊天里当前显示楼层及之前的楼层（只看酒馆已渲染的楼层），当前楼层只取到正在显示的这一段。
// AI 楼层优先复用已解析的段落状态，没有时现场解析（parseGalgameContent 自带缓存）；用户楼层显示为玩家发言。

const BACKLOG_MAX_GROUPS = 60;
const BACKLOG_SEGMENT_TYPES = new Set(['dialogue', 'narration', 'styled']);

function getUserDisplayName() {
  try {
    const ctx = getTavernContext() || topWindow.SillyTavern?.getContext?.();
    const name = String(ctx?.name1 || '').trim();
    if (name) return name;
  } catch (e) {}
  return '你';
}

function getSegmentBacklogText(segment) {
  if (segment.type === 'styled' && Array.isArray(segment.styledLines) && segment.styledLines.length > 0) {
    const lines = segment.styledLines.map(line => String(line?.text || '').trim()).filter(Boolean);
    const title = String(segment.styledTitle || '').trim();
    return (title ? [title, ...lines] : lines).join('\n');
  }
  return String(segment.text || '').trim();
}

function toBacklogEntries(segments, mesId, lastIndex) {
  const entries = [];
  const end = Math.min(segments.length - 1, lastIndex);
  for (let index = 0; index <= end; index++) {
    const segment = segments[index];
    if (!segment || !BACKLOG_SEGMENT_TYPES.has(segment.type)) continue;
    const text = getSegmentBacklogText(segment);
    if (!text) continue;
    entries.push({
      segment,
      segmentId: `${mesId}_${index}`,
      speaker: segment.type === 'dialogue' ? String(segment.speaker || '').trim() : '',
      text,
    });
  }
  return entries;
}

function getAiFloorSegments($mes, mesId) {
  const state = GalgameStore.cache.segments.get(mesId);
  if (Array.isArray(state?.segments) && state.segments.length > 0) return state.segments;
  try {
    const content = extractMessageContent($mes, mesId);
    const parsed = content ? parseGalgameContent(content, mesId) : null;
    if (parsed?.segments?.length) return parsed.segments;
  } catch (error) {
    console.warn(`[${SCRIPT_NAME}] 对话记录：解析楼层 ${mesId} 失败`, error);
  }
  const fallbackText = String($mes.find('.mes_text').text() || '').trim();
  return fallbackText ? [{ type: 'narration', speaker: null, text: fallbackText, expression: null }] : [];
}

/**
 * @returns {Array<{ kind: 'ai', mesId: string, entries: Array<{ segment: object, segmentId: string, speaker: string, text: string }> }
 *   | { kind: 'user', mesId: string, speaker: string, text: string }>}
 */
export function collectBacklogGroups() {
  const currentMesId = String($('#gal-global-overlay .gal-game-container').attr('data-mes-id') || '');
  if (!currentMesId) return [];

  const $floors = [];
  let reachedCurrent = false;
  $('#chat > .mes[mesid]').each(function () {
    if (reachedCurrent) return false;
    const $mes = $(this);
    if ($mes.attr('is_system') === 'true') return undefined;
    $floors.push($mes);
    if (String($mes.attr('mesid')) === currentMesId) reachedCurrent = true;
    return undefined;
  });
  if (!reachedCurrent) return [];

  const userName = getUserDisplayName();
  const groups = [];
  for (const $mes of $floors.slice(-BACKLOG_MAX_GROUPS)) {
    const mesId = String($mes.attr('mesid'));
    if ($mes.attr('is_user') === 'true') {
      const text = String($mes.find('.mes_text').text() || '').trim();
      if (text) groups.push({ kind: 'user', mesId, speaker: userName, text });
      continue;
    }
    const segments = getAiFloorSegments($mes, mesId);
    const lastIndex = mesId === currentMesId
      ? Number(GalgameStore.cache.segments.get(mesId)?.currentIndex ?? segments.length - 1)
      : segments.length - 1;
    const entries = toBacklogEntries(segments, mesId, lastIndex);
    if (entries.length > 0) groups.push({ kind: 'ai', mesId, entries });
  }
  return groups;
}
