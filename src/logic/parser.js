import { SCRIPT_NAME } from '../core/constants.js';
import { GalgameStore } from '../core/store.js';
import { getSettings } from '../core/settings.js';
import { getIsEnabled } from '../core/state.js';
import { getAllExpressions } from '../utils/expressions.js';
import { getCharacterTTSVoice } from '../audio/tts-config.js';

// ============================================
// 预编译正则表达式
// ============================================
export const RE_GAL_TAGS = /<(p|sprite|maintext|background|pixiPerform|pixiInit|地点状态栏|时间状态栏)[^>]*>/i;
const RE_CLOSED_P = /<\/p>/i;
const RE_THINK_CLOSED = /<(think|thinking)>[\s\S]*?<\/\1>/gi;
const RE_THINK_UNCLOSED = /<(think|thinking)>[\s\S]*$/gi;
const RE_PRE_TAG = /<pre[^>]*>/gi;
const RE_PRE_CLOSE = /<\/pre>/gi;
const RE_CODE_TAG = /<code[^>]*>/gi;
const RE_CODE_CLOSE = /<\/code>/gi;
const RE_TAG_WHITESPACE = />\s+</g;
const RE_MAINTEXT_CLOSED = /<maintext>([\s\S]*?)<\/maintext>/i;
const RE_MAINTEXT_UNCLOSED = /<maintext>([\s\S]*)$/i;
const RE_BACKGROUND = /<background\s+scene="([^"]+)"\s*[\/]?>/i;
const RE_BGIMG = /<bgimg>(.*?)<\/bgimg>/i;
const RE_WHIMG = /<whimg>(.*?)<\/whimg>/i;
const RE_BNIMG = /<bnimg>([\s\S]*?)<\/bnimg>/i;
const RE_BGM = /<bgm>(?:当前bgm[:：])?(.+?)<\/bgm>/i;
const RE_OPTION = /<option\s+id="([^"]+)"[^>]*>([^<]+)<\/option>/gi;
const RE_P_TAG = /<p(?:\s[^>]*)?>[\s\S]*?<\/p>/gi;
const RE_LOCATION_STATUS_BAR = /<地点状态栏>([\s\S]*?)<\/地点状态栏>/gi;
const RE_TIME_STATUS_BAR = /<时间状态栏>([\s\S]*?)<\/时间状态栏>/gi;
const RE_FIRST_GAL_TAG = /<(background|p|pixiPerform|pixiInit)[\s/>]/i;
const RE_PIXI_TAGS = /<pixiPerform\b([^>]*)\/?>|<pixiInit\s*\/?>/gi;

const RE_ILLEGAL_TAGS = [
  /<vn_scene[^>]*>[\s\S]*?<\/vn_scene>/gi,
  /<system_ui_display[^>]*>[\s\S]*?<\/system_ui_display>/gi,
  /<ui_panel[^>]*>[\s\S]*?<\/ui_panel>/gi,
  /<status[^>]*>[\s\S]*?<\/status>/gi,
  /<deep_breath[^>]*>[\s\S]*?<\/deep_breath>/gi,
  /<div[^>]*>[\s\S]*?<\/div>/gi,
  /<span[^>]*style[^>]*>[\s\S]*?<\/span>/gi,
  /<!--[\s\S]*?-->/gi,
  /<b>[\s\S]*?<\/b>/gi,
  /<br\s*\/?>/gi,
];

// 表情映射
const EXPRESSION_LIST = ['默认', '微笑', '生气', '难过', '惊讶', '嘲讽', '害羞', '思考', '大笑', '搞怪'];

const EXPRESSION_TAG_MAP = {
  默认: 'neutral expression, looking at viewer',
  微笑: 'smile, happy, gentle expression',
  生气: 'angry, furrowed brows, intense eyes',
  难过: 'sad, tears, sorrowful expression',
  惊讶: 'surprised, wide eyes, open mouth',
  嘲讽: 'smirk, condescending, mocking expression',
  害羞: 'blush, shy, embarrassed, looking away',
  思考: 'thinking, hand on chin, contemplative',
  大笑: 'laughing, open mouth, closed eyes, very happy',
  搞怪: 'playful, wink, tongue out, silly face',
};


const PARSE_CACHE_MAX_SIZE = 30;

// 延迟引用: getFormattedContent (enhanced-mode)
let _getFormattedContentRef = null;

export function setParserRefs({ getFormattedContent }) {
  if (getFormattedContent) _getFormattedContentRef = getFormattedContent;
}

// ============================================
// 导出常量和工具函数
// ============================================

export { EXPRESSION_LIST, EXPRESSION_TAG_MAP };

export function getExpressionTag(expressionName) {
  return EXPRESSION_TAG_MAP[expressionName] || `${expressionName} expression`;
}

// ============================================
// 清理非法标签
// ============================================
function cleanIllegalTags(html) {
  if (!html) return html;
  let result = html;
  for (const regex of RE_ILLEGAL_TAGS) {
    result = result.replace(regex, '');
  }
  return result.replace(/\n{3,}/g, '\n\n');
}

// ============================================
// 预处理简化格式
// ============================================
function preprocessSimplifiedFormat(html) {
  if (!html) return html;

  html = cleanIllegalTags(html);

  const simplifiedPattern = /<p>\s*([^[\]<>:：]{1,20})\[([^\]]+)\]\s*[：:]\s*["\u201c"'「『（(]([\s\S]+?)["\u201d"'」』）)]\s*<\/p>/gi;

  let result = html;
  let match;
  const regex = new RegExp(simplifiedPattern.source, 'gi');
  const sessionVoiceCache = GalgameStore.cache.voices;

  while ((match = regex.exec(html)) !== null) {
    const fullMatch = match[0];
    const speaker = match[1].trim();
    const bracketContent = match[2].trim();
    const dialogue = match[3].trim();

    // 用 | 分隔：[表情,音色|语气指导]
    const pipeParts = bracketContent.split('|');
    const exprVoicePart = pipeParts[0].trim();
    const context = pipeParts[1] ? pipeParts[1].trim() : null;

    const parts = exprVoicePart.split(',').map(s => s.trim());
    const expression = parts[0];
    const specifiedVoice = parts[1] || null;

    let voice = null;
    if (specifiedVoice) {
      voice = specifiedVoice;
      sessionVoiceCache.set(speaker, specifiedVoice);
    } else {
      const boundVoice = getCharacterTTSVoice(speaker);
      if (boundVoice) {
        voice = boundVoice;
      } else if (sessionVoiceCache.has(speaker)) {
        voice = sessionVoiceCache.get(speaker);
      }
    }

    const ttsParts = [];
    if (voice) ttsParts.push(`speaker=${voice}`);
    if (context) ttsParts.push(`context=${context}`);
    const ttsAttr = ttsParts.length > 0 ? ` tts="${ttsParts.join(';')}"` : '';

    const newFormat = `<p${ttsAttr}><${expression}>${speaker}: "${dialogue}"</p>`;
    result = result.replace(fullMatch, newFormat);
  }

  return result;
}

// ============================================
// 消息解析器
// ============================================
export function parseGalgameContent(html, messageId) {
  const rawInputHtml = typeof html === 'string' ? html : '';
  const settings = getSettings();
  const isEnabled = getIsEnabled();
  const parseCache = GalgameStore.cache.parse;

  // 预处理简化格式
  html = preprocessSimplifiedFormat(html);

  // 加强模式：优先使用格式化版本
  if (isEnabled && settings.enhancedMode?.enabled && messageId) {
    const formatData = _getFormattedContentRef ? _getFormattedContentRef(messageId) : null;
    if (formatData) {
      console.log(`[${SCRIPT_NAME}] 使用格式化版本 (swipe ${formatData.formattedIndex})`);
      html = formatData.formatted;
      html = html.replace(RE_THINK_CLOSED, '');
      html = html.replace(RE_THINK_UNCLOSED, '');
    }
  }

  // 性能优化：检查缓存
  const cacheKey = html.length + '_' + html.substring(0, 150) + '_' + html.substring(html.length - 50);
  if (parseCache.has(cacheKey)) {
    return parseCache.get(cacheKey);
  }

  // 移除 <think> 标签块
  html = html.replace(RE_THINK_CLOSED, '');
  html = html.replace(RE_THINK_UNCLOSED, '');

  const result = {
    segments: [],
    currentBackground: null,
    bgm: null,
    options: [],
    backgroundChanges: [],
    effectEvents: [],
    hasEffects: false,
    locationStatusBarHtml: null,
    timeStatusBarHtml: null,
  };

  // 移除 highlight.js 标签
  let cleanedHtml = html
    .replace(RE_PRE_TAG, '')
    .replace(RE_PRE_CLOSE, '')
    .replace(RE_CODE_TAG, '')
    .replace(RE_CODE_CLOSE, '');

  cleanedHtml = cleanedHtml.replace(RE_TAG_WHITESPACE, '><');

  // 提取 <maintext> 内容
  let content = cleanedHtml;
  const maintextMatch = cleanedHtml.match(RE_MAINTEXT_CLOSED);
  if (maintextMatch) {
    content = maintextMatch[1];
  } else {
    const maintextStart = cleanedHtml.match(RE_MAINTEXT_UNCLOSED);
    if (maintextStart) {
      content = maintextStart[1];
    }
  }

  function extractLastStatusTagContent(source, regex) {
    if (!source) return null;
    const pattern = new RegExp(regex.source, regex.flags);
    let match;
    let lastContent = null;
    while ((match = pattern.exec(source)) !== null) {
      const html = typeof match[1] === 'string' ? match[1].trim() : '';
      if (html) {
        lastContent = html;
      }
    }
    return lastContent;
  }

  result.locationStatusBarHtml =
    extractLastStatusTagContent(content, RE_LOCATION_STATUS_BAR) ||
    extractLastStatusTagContent(cleanedHtml, RE_LOCATION_STATUS_BAR) ||
    extractLastStatusTagContent(rawInputHtml, RE_LOCATION_STATUS_BAR) ||
    null;
  result.timeStatusBarHtml =
    extractLastStatusTagContent(content, RE_TIME_STATUS_BAR) ||
    extractLastStatusTagContent(cleanedHtml, RE_TIME_STATUS_BAR) ||
    extractLastStatusTagContent(rawInputHtml, RE_TIME_STATUS_BAR) ||
    null;

  function parseTagAttributes(rawAttrText) {
    const attrs = {};
    if (!rawAttrText) return attrs;
    const attrRegex = /([a-zA-Z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(rawAttrText)) !== null) {
      const key = String(attrMatch[1] || '').trim();
      if (!key) continue;
      attrs[key] = (attrMatch[2] ?? attrMatch[3] ?? '').trim();
    }
    return attrs;
  }

  function getFixedEffectLayer(effectName) {
    return String(effectName || '').trim() === 'fog' ? 'bg' : 'fg';
  }

  // 找到 <maintext> 内第一个 Galgame 标签
  const firstGalMatch = content.match(RE_FIRST_GAL_TAG);
  if (firstGalMatch && firstGalMatch.index > 0) {
    console.log(`[${SCRIPT_NAME}] [DEBUG] 清理 <maintext> 前 ${firstGalMatch.index} 字符的污染内容`);
    content = content.substring(firstGalMatch.index);
  }

  const effectEvents = [];
  let pixiTagMatch;
  while ((pixiTagMatch = RE_PIXI_TAGS.exec(content)) !== null) {
    if (pixiTagMatch[1] !== undefined) {
      const attrs = parseTagAttributes(pixiTagMatch[1]);
      const effectName = String(attrs.name || '').trim();
      if (!effectName) continue;
      effectEvents.push({
        position: pixiTagMatch.index,
        action: 'perform',
        name: effectName,
        layer: getFixedEffectLayer(effectName),
      });
    } else {
      effectEvents.push({
        position: pixiTagMatch.index,
        action: 'init',
      });
    }
  }
  RE_PIXI_TAGS.lastIndex = 0;
  result.effectEvents = effectEvents;
  result.hasEffects = effectEvents.length > 0;

  // 段落级背景跟随：收集所有背景标签及其位置
  const backgroundChanges = [];
  const bgRegex = /<background\s+scene="([^"]+)"\s*[\/]?>/gi;
  const bnimgRegex = /<bnimg>([\s\S]*?)<\/bnimg>/gi;
  const bgimgRegex = /<bgimg>(.*?)<\/bgimg>/gi;
  const whimgRegex = /<whimg>(.*?)<\/whimg>/gi;

  let bgMatch;
  while ((bgMatch = bgRegex.exec(content)) !== null) {
    const bgEndPos = bgMatch.index + bgMatch[0].length;
    const bgInfo = {
      position: bgMatch.index,
      scene: bgMatch[1],
      generationTags: null,
      wallhavenTags: null,
      bananaPrompt: null,
    };

    bnimgRegex.lastIndex = bgEndPos;
    const bnimgMatch = bnimgRegex.exec(content);
    if (bnimgMatch && bnimgMatch.index < bgEndPos + 2000) {
      bgInfo.bananaPrompt = bnimgMatch[1].trim();
    }
    bnimgRegex.lastIndex = 0;

    bgimgRegex.lastIndex = bgEndPos;
    const bgimgMatch = bgimgRegex.exec(content);
    if (bgimgMatch && bgimgMatch.index < bgEndPos + 200) {
      bgInfo.generationTags = bgimgMatch[1].trim();
    }
    bgimgRegex.lastIndex = 0;

    whimgRegex.lastIndex = bgEndPos;
    const whimgMatch = whimgRegex.exec(content);
    if (whimgMatch && whimgMatch.index < bgEndPos + 200) {
      bgInfo.wallhavenTags = whimgMatch[1].trim();
    }
    whimgRegex.lastIndex = 0;

    backgroundChanges.push(bgInfo);
    console.log(`[${SCRIPT_NAME}] [DEBUG] 解析到背景切换点[${bgMatch.index}]: "${bgInfo.scene}"`);
  }

  if (backgroundChanges.length > 0) {
    const lastBg = backgroundChanges[backgroundChanges.length - 1];
    result.currentBackground = {
      scene: lastBg.scene,
      generationTags: lastBg.generationTags,
      wallhavenTags: lastBg.wallhavenTags,
      bananaPrompt: lastBg.bananaPrompt,
    };
    result.backgroundChanges = backgroundChanges;
    console.log(`[${SCRIPT_NAME}] [DEBUG] 消息包含 ${backgroundChanges.length} 个背景切换点，最终背景: "${lastBg.scene}"`);
  }

  function getBackgroundAtPosition(position) {
    let bestBg = null;
    for (const bg of backgroundChanges) {
      if (bg.position <= position) {
        if (!bestBg || bg.position > bestBg.position) {
          bestBg = bg;
        }
      }
    }
    return bestBg;
  }

  let effectEventCursor = 0;
  function consumeEffectOpsUntil(position) {
    const ops = [];
    while (
      effectEventCursor < effectEvents.length &&
      effectEvents[effectEventCursor].position <= position
    ) {
      const evt = effectEvents[effectEventCursor++];
      ops.push({
        action: evt.action,
        name: evt.name,
        layer: evt.layer,
      });
    }
    return ops;
  }

  // 解析 BGM 标签
  const bgmMatch = content.match(RE_BGM);
  if (bgmMatch) {
    result.bgm = {
      keyword: bgmMatch[1].replace(' - ', ' ').trim(),
    };
    console.log(`[${SCRIPT_NAME}] [DEBUG] 解析到 BGM: "${result.bgm.keyword}"`);
  }

  // 解析所有 <option> 标签
  const optionRegex = /<option\s+id="([^"]+)"[^>]*>([^<]+)<\/option>/gi;
  let optionMatch;
  while ((optionMatch = optionRegex.exec(content)) !== null) {
    result.options.push({
      id: optionMatch[1],
      text: optionMatch[2].trim(),
    });
  }

  // 动态获取表情列表
  const expressionNames = getAllExpressions();
  const expressionPattern = expressionNames.map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

  function parseTTSConfig(ttsString, defaultSpeaker) {
    if (!ttsString) return null;

    const config = {
      speaker: defaultSpeaker,
      context: null,
    };

    const pairs = ttsString.split(';');
    for (const pair of pairs) {
      const [key, value] = pair.trim().split('=');
      if (key && value) {
        const trimmedKey = key.trim();
        const trimmedValue = value.trim();

        if (trimmedKey === 'speaker') config.speaker = trimmedValue;
        else if (trimmedKey === 'context') config.context = trimmedValue;
      }
    }

    return config;
  }

  function parseSegmentText(text, ttsConfigString = null) {
    if (!text) return null;
    text = text.trim();
    if (!text) return null;

    text = text.replace(/<span[^>]*>/gi, '').replace(/<\/span>/gi, '');
    text = text.replace(/<q>([^<]*)<\/q>/gi, '$1');
    text = text.replace(/<q[^>]*>([^<]*)<\/q>/gi, '$1');
    text = text.replace(/<q[^>]*>([\s\S]*?)<\/q>/gi, '$1');

    let expression = null;
    const expressionTagRegex = new RegExp(`<(${expressionPattern})>`, 'i');
    const exprMatch = text.match(expressionTagRegex);
    if (exprMatch) {
      expression = exprMatch[1];
      text = text.replace(expressionTagRegex, '').trim();
    }

    // 提取 [表情|语气描述] 方括号语法，例如 [惊讶|用压低的语气说]
    let bracketContext = null;
    const bracketMatch = text.match(/\[([^\]|]+?)(?:\|([^\]]+))?\]/);
    if (bracketMatch) {
      if (!expression) {
        expression = bracketMatch[1].trim();
      }
      if (bracketMatch[2]) {
        bracketContext = bracketMatch[2].trim();
      }
      text = text.replace(bracketMatch[0], '').trim();
    }

    let dialogueMatch = text.match(/^(?:<[^>]+>)?([^:：]{1,20})[：:]\s*[""\"'「『（(]([\s\S]+)[""\"'」』）)]\s*$/);
    if (!dialogueMatch) {
      dialogueMatch = text.match(/^(?:<[^>]+>)?([^:：]{1,20})[：:]\s*([\s\S]+)$/);
    }

    // 验证说话人名称是否合理：真实角色名不含句子标点或数字，且通常不超过10个字符
    const isValidSpeaker = (name) => {
      if (name.length > 10) return false;
      if (/[，,。.、；;！!？?…—–0-9０-９]/.test(name)) return false;
      return true;
    };

    if (dialogueMatch && dialogueMatch[1] && dialogueMatch[2]) {
      let speaker = dialogueMatch[1].trim();
      const dialogue = dialogueMatch[2].trim();

      // 兼容 "角色[表情]" 这种直接写在 speaker 内的格式
      if (!expression) {
        const speakerExprMatch = speaker.match(/^([^[\]<>:：]{1,20})\[([^\]]+)\]$/);
        if (speakerExprMatch) {
          speaker = speakerExprMatch[1].trim();
          const bracketContent = speakerExprMatch[2].trim();
          if (bracketContent) {
            const exprCandidate = bracketContent.split('|')[0].split(',')[0].trim();
            if (exprCandidate) expression = exprCandidate;
          }
        }
      }

      if (speaker === '旁白') {
        return {
          type: 'narration',
          speaker: null,
          text: dialogue,
          expression: null,
        };
      }

      if (isValidSpeaker(speaker)) {
        const segResult = {
          type: 'dialogue',
          speaker: speaker,
          text: dialogue,
          expression: expression || '默认',
        };
        if (ttsConfigString) {
          segResult.tts = parseTTSConfig(ttsConfigString, speaker);
        }
        if (bracketContext) {
          if (!segResult.tts) {
            segResult.tts = { speaker: speaker, context: bracketContext };
          } else if (!segResult.tts.context) {
            segResult.tts.context = bracketContext;
          }
        }
        return segResult;
      }
    }

    return {
      type: 'narration',
      speaker: null,
      text: text,
      expression: null,
    };
  }

  // 解析所有已闭合的 <p> 标签
  const pTagRegex = /<p(?:\s+tts="([^"]*)")?\s*>([\s\S]*?)<\/p>/gi;
  let match;
  let lastIndex = 0;
  while ((match = pTagRegex.exec(content)) !== null) {
    lastIndex = pTagRegex.lastIndex;
    const ttsConfig = match[1];
    const seg = parseSegmentText(match[2], ttsConfig);
    if (seg) {
      seg.effectOps = consumeEffectOpsUntil(match.index);
      const bgAtThisPos = getBackgroundAtPosition(match.index);
      if (bgAtThisPos) {
        seg.backgroundScene = bgAtThisPos.scene;
      }
      if (result.segments.length < 3) {
        console.log(`[${SCRIPT_NAME}] [DEBUG] 段落[${result.segments.length}] 位置:${match.index} 背景:${seg.backgroundScene || 'null'} 文本:${seg.text.substring(0, 20)}...`);
      }
      result.segments.push(seg);
    }
  }

  // 尝试匹配末尾未闭合的 <p> 标签 (流式输出)
  const remainingText = content.substring(lastIndex);
  const unclosedPMatch = remainingText.match(/<p(?:\s+tts="([^"]*)")?\s*>([\s\S]*)$/i);
  if (unclosedPMatch) {
    const rawContent = unclosedPMatch[2];
    const ttsConfig = unclosedPMatch[1];
    const segmentPosition = content.length - remainingText.length + unclosedPMatch.index;
    if (rawContent && rawContent.trim()) {
      const seg = parseSegmentText(rawContent, ttsConfig);
      if (seg) {
        seg.effectOps = consumeEffectOpsUntil(segmentPosition);
        const bgAtThisPos = getBackgroundAtPosition(segmentPosition);
        if (bgAtThisPos) {
          seg.backgroundScene = bgAtThisPos.scene;
        }
        result.segments.push(seg);
      }
    }
  }

  // 如果没有 <p> 标签，尝试直接解析纯文本
  if (result.segments.length === 0) {
    const plainText = content.replace(/<[^>]+>/g, '').trim();
    if (plainText) {
      const seg = {
        type: 'narration',
        speaker: null,
        text: plainText,
        expression: null,
        effectOps: consumeEffectOpsUntil(content.length),
      };
      if (backgroundChanges.length > 0) {
        seg.backgroundScene = backgroundChanges[backgroundChanges.length - 1].scene;
      }
      result.segments.push(seg);
    }
  }

  // 切分过长段落
  const MAX_SEG_LENGTH = 120;
  const finalSegments = [];
  result.segments.forEach(seg => {
    const baseEffectOps = Array.isArray(seg.effectOps) ? seg.effectOps : [];
    if (!seg.text || seg.text.length <= MAX_SEG_LENGTH) {
      finalSegments.push(Object.assign({}, seg, { effectOps: baseEffectOps }));
      return;
    }
    let text = seg.text;
    let isFirstChunk = true;
    while (text.length > MAX_SEG_LENGTH) {
      let splitIdx = -1;
      const punctuations = ['。', '！', '？', '…', '\n', '.', '!', '?'];
      for (let i = MAX_SEG_LENGTH; i >= Math.floor(MAX_SEG_LENGTH * 0.6); i--) {
        if (punctuations.includes(text[i])) {
          splitIdx = i + 1;
          break;
        }
      }
      if (splitIdx === -1) {
        splitIdx = text.lastIndexOf(' ', MAX_SEG_LENGTH);
        if (splitIdx !== -1) splitIdx += 1;
      }
      if (splitIdx === -1 || splitIdx < Math.floor(MAX_SEG_LENGTH * 0.6)) {
        splitIdx = MAX_SEG_LENGTH;
      }
      finalSegments.push(Object.assign({}, seg, {
        text: text.substring(0, splitIdx).trim(),
        effectOps: isFirstChunk ? baseEffectOps : [],
      }));
      isFirstChunk = false;
      text = text.substring(splitIdx).trim();
    }
    if (text) {
      finalSegments.push(Object.assign({}, seg, {
        text: text,
        effectOps: isFirstChunk ? baseEffectOps : [],
      }));
    }
  });
  if (effectEventCursor < effectEvents.length) {
    if (finalSegments.length > 0) {
      const tailSegment = finalSegments[finalSegments.length - 1];
      const tailOps = consumeEffectOpsUntil(Number.POSITIVE_INFINITY);
      tailSegment.effectOps = (Array.isArray(tailSegment.effectOps) ? tailSegment.effectOps : []).concat(tailOps);
    } else {
      finalSegments.push({
        type: 'narration',
        speaker: null,
        text: '',
        expression: null,
        effectOps: consumeEffectOpsUntil(Number.POSITIVE_INFINITY),
      });
    }
  }

  result.segments = finalSegments;

  // 缓存解析结果
  if (parseCache.size >= PARSE_CACHE_MAX_SIZE) {
    const firstKey = parseCache.keys().next().value;
    parseCache.delete(firstKey);
  }
  parseCache.set(cacheKey, result);

  return result;
}
