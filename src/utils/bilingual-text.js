const JP_TOKEN_RE = '(?:J|Ｊ)\\s*(?:P|Ｐ)';
const JP_SPLIT_MARKER_PATTERNS = [
  new RegExp(`【\\s*${JP_TOKEN_RE}\\s*】`, 'i'),
  new RegExp(`\\[\\s*${JP_TOKEN_RE}\\s*\\]`, 'i'),
  new RegExp(`（\\s*${JP_TOKEN_RE}\\s*）`, 'i'),
  new RegExp(`\\(\\s*${JP_TOKEN_RE}\\s*\\)`, 'i'),
  new RegExp(`＜\\s*${JP_TOKEN_RE}\\s*＞`, 'i'),
  new RegExp(`<\\s*${JP_TOKEN_RE}\\s*>`, 'i'),
  new RegExp(`「\\s*${JP_TOKEN_RE}\\s*」`, 'i'),
  new RegExp(`『\\s*${JP_TOKEN_RE}\\s*』`, 'i'),
];

function findFirstSplitMarker(raw) {
  let bestMatch = null;
  for (const pattern of JP_SPLIT_MARKER_PATTERNS) {
    const matched = raw.match(pattern);
    if (!matched || matched.index === undefined) continue;
    if (!bestMatch || matched.index < bestMatch.index) {
      bestMatch = {
        index: matched.index,
        length: matched[0].length,
      };
    }
  }
  return bestMatch;
}

/**
 * 双语模式下拆分“显示文本”和“TTS 文本”。
 * 推荐格式：中文文本[JP]日文文本
 * 兼容标记变体：【JP】 / [JP] / （JP） / (JP) / ＜JP＞ / <JP> / 「JP」 / 『JP』
 */
export function splitZhJaForDisplayAndTts(input, enabled) {
  const raw = String(input ?? '');
  const marker = findFirstSplitMarker(raw);
  if (!marker) {
    return {
      displayText: raw,
      ttsText: raw,
      hasJa: false,
    };
  }

  const markerStart = marker.index;
  const markerEnd = markerStart + marker.length;
  const zhPart = raw.slice(0, markerStart).trim();
  const jaPart = raw.slice(markerEnd).trim();
  const fallback = raw.trim();
  const displayText = zhPart || fallback;

  // 双语关闭时仍解析 [JP] 分隔，避免把日文段直接显示在对话框中。
  if (!enabled) {
    return {
      displayText,
      ttsText: displayText,
      hasJa: !!jaPart,
    };
  }

  return {
    displayText,
    ttsText: jaPart || displayText || fallback,
    hasJa: !!jaPart,
  };
}
