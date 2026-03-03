import { getCharacterTTSVoice } from '../audio/tts-config.js';
import { SCRIPT_NAME } from '../core/constants.js';
import { getSettings } from '../core/settings.js';
import { getIsEnabled } from '../core/state.js';
import { GalgameStore } from '../core/store.js';
import { splitZhJaForDisplayAndTts } from '../utils/bilingual-text.js';
import { getAllExpressions } from '../utils/expressions.js';

// ============================================
// 预编译正则表达式
// ============================================
export const RE_GAL_TAGS = /<(p|sprite|maintext|background|pixiPerform|pixiInit|styled)[^>]*>/i;
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
const RE_STYLED = /<styled\b([^>]*)>([\s\S]*?)<\/styled>/gi;
const RE_P_TAG = /<p(?:\s[^>]*)?>[\s\S]*?<\/p>/gi;
const RE_SPRITE_TAG = /<sprite\b([^>]*)\/?>/gi;
const RE_POPUP1 = /<弹窗一>([\s\S]*?)<\/弹窗一>/i;
const RE_POPUP2 = /<弹窗二>([\s\S]*?)<\/弹窗二>/i;
const RE_IMAGE_PLACEHOLDER_INLINE = /\[image\s*#\d+\]/gi;
const RE_IMAGE_PLACEHOLDER_LINE = /^\s*[“”"'‘’「」『』【】\[\]（）()<>]*\s*\[image\s*#\d+\]\s*[“”"'‘’「」『』【】\[\]（）()<>]*\s*$/i;

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
const WRAPPER_QUOTES = [
  ['“', '”'],
  ['‘', '’'],
  ['「', '」'],
  ['『', '』'],
  ['"', '"'],
  ["'", "'"],
];

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

function removeImagePlaceholderLines(text) {
  if (!text) return '';
  const lines = String(text).split(/\r?\n/);
  return lines.filter(line => !RE_IMAGE_PLACEHOLDER_LINE.test(line.trim())).join('\n');
}

function stripOuterQuotes(text) {
  let result = String(text || '').trim();
  if (!result) return result;

  let shouldContinue = true;
  while (shouldContinue && result.length > 1) {
    shouldContinue = false;
    for (const [open, close] of WRAPPER_QUOTES) {
      if (result.startsWith(open) && result.endsWith(close)) {
        result = result.slice(open.length, result.length - close.length).trim();
        shouldContinue = true;
        break;
      }
    }
  }

  return result;
}

function normalizeSpeakerName(name) {
  return String(name || '')
    .replace(RE_IMAGE_PLACEHOLDER_INLINE, '')
    .replace(/^[“”"'‘’「」『』\s]+/, '')
    .replace(/[“”"'‘’「」『』\s]+$/, '')
    .trim();
}

// ============================================
// 预处理简化格式
// ============================================
function preprocessSimplifiedFormat(html) {
  if (!html) return html;

  html = cleanIllegalTags(html);

  const simplifiedPattern = /<p>\s*([^[\]<>:：]{1,20})\[([^\]]+)\]\s*[：:]\s*[""\"'「『（(]([\s\S]+?)[""\"'」』）)]\s*<\/p>/gi;

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

    const boundVoice = getCharacterTTSVoice(speaker);
    let voice = null;
    if (boundVoice) {
      voice = boundVoice;
      // 已绑定角色优先使用绑定音色，忽略 AI 在当前句给出的任何标签。
    } else if (specifiedVoice === '男声' || specifiedVoice === '女声') {
      // 新格式：透传标签给 TTS manager，由其随机分配并自动绑定。
      voice = specifiedVoice;
    } else if (specifiedVoice) {
      // 旧格式向前兼容：具体音色名仍可直接使用。
      voice = specifiedVoice;
      sessionVoiceCache.set(speaker, specifiedVoice);
    } else if (sessionVoiceCache.has(speaker)) {
      voice = sessionVoiceCache.get(speaker);
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
  const settings = getSettings();
  const isEnabled = getIsEnabled();
  const parseCache = GalgameStore.cache.parse;

  // 提取弹窗一/弹窗二内容（必须在 preprocessSimplifiedFormat 之前，因为其中的 cleanIllegalTags 会删除 <div> 标签）
  const popup1Match = html.match(RE_POPUP1);
  const popup2Match = html.match(RE_POPUP2);
  // 从 html 中移除弹窗标签，避免干扰后续解析
  if (popup1Match) html = html.replace(RE_POPUP1, '');
  if (popup2Match) html = html.replace(RE_POPUP2, '');

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
    locationStatusBarHtml: popup1Match ? popup1Match[1].trim() : null,
    timeStatusBarHtml: popup2Match ? popup2Match[1].trim() : null,
    bgm: null,
    options: [],
    backgroundChanges: [],
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

  // 找到 <maintext> 内第一个 Galgame 标签
  const firstGalMatch = content.match(/<(background|p|pixiperform|pixiinit|bgm|sprite|option|bgimg|whimg|bnimg)\b/i);
  if (firstGalMatch && firstGalMatch.index > 0) {
    console.log(`[${SCRIPT_NAME}] [DEBUG] 清理 <maintext> 前 ${firstGalMatch.index} 字符的污染内容`);
    content = content.substring(firstGalMatch.index);
  }

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

  function parseTagAttributes(raw) {
    const attrs = {};
    if (!raw) return attrs;
    const attrRegex = /([a-zA-Z_:][\w:.-]*)\s*=\s*["']([^"']*)["']/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(raw)) !== null) {
      attrs[String(attrMatch[1] || '').toLowerCase()] = String(attrMatch[2] || '').trim();
    }
    return attrs;
  }

  const spriteCommands = [];
  let spriteTagMatch;
  while ((spriteTagMatch = RE_SPRITE_TAG.exec(content)) !== null) {
    const attrs = parseTagAttributes(spriteTagMatch[1] || '');
    if (String(attrs.action || '').toLowerCase() !== 'exit') continue;
    const targetCharacter = String(attrs.character || attrs.char || '').trim();
    if (!targetCharacter) continue;
    spriteCommands.push({
      position: spriteTagMatch.index,
      action: 'exit',
      character: targetCharacter,
    });
  }
  RE_SPRITE_TAG.lastIndex = 0;

  const pixiCommands = [];
  const pixiInitRegex = /<pixiInit\b[^>]*\/?>/gi;
  const pixiPerformRegex = /<pixiPerform\b([^>]*)\/?>/gi;

  let pixiInitMatch;
  while ((pixiInitMatch = pixiInitRegex.exec(content)) !== null) {
    pixiCommands.push({
      position: pixiInitMatch.index,
      action: 'init',
    });
  }

  let pixiPerformMatch;
  while ((pixiPerformMatch = pixiPerformRegex.exec(content)) !== null) {
    const attrs = parseTagAttributes(pixiPerformMatch[1] || '');
    const effectName = String(attrs.name || attrs.effect || '').trim();
    if (!effectName) continue;
    pixiCommands.push({
      position: pixiPerformMatch.index,
      action: 'perform',
      name: effectName,
    });
  }

  if (pixiCommands.length > 1) {
    pixiCommands.sort((a, b) => a.position - b.position);
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

  // 解析所有 <styled> 标签
  const styledBlocks = [];
  const styledRegex = /<styled\b([^>]*)>([\s\S]*?)<\/styled>/gi;
  let styledMatch;
  while ((styledMatch = styledRegex.exec(content)) !== null) {
    const styledAttrs = parseTagAttributes(styledMatch[1] || '');
    const styledType = String(styledAttrs.type || '').trim();
    if (!styledType) continue;
    const styledBody = styledMatch[2].trim();
    if (!styledBody) continue;

    // 解析消息行: "发送者: 内容" 或纯文本
    // 支持字面量 "\n" / "\r\n" 作为换行（常见于用户直接输入标签文本）
    const normalizedStyledBody = styledBody
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n');
    const styledLines = normalizedStyledBody.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsedLines = styledLines.map(line => {
      const colonMatch = line.match(/^([^:：]{1,20})[：:]\s*(.+)$/);
      if (colonMatch) {
        return { sender: colonMatch[1].trim(), text: colonMatch[2].trim() };
      }
      return { sender: null, text: line };
    });

    styledBlocks.push({
      position: styledMatch.index,
      styleType: styledType,
      from: styledAttrs.from || null,
      to: styledAttrs.to || null,
      title: styledAttrs.title || null,
      date: styledAttrs.date || null,
      lines: parsedLines,
    });
    console.log(`[${SCRIPT_NAME}] [DEBUG] 解析到 styled 块[${styledMatch.index}]: type="${styledType}", ${parsedLines.length}行`);
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
    text = text.replace(/<pixiInit\b[^>]*\/?>/gi, '');
    text = text.replace(/<pixiPerform\b[^>]*\/?>/gi, '');
    text = text.replace(RE_IMAGE_PLACEHOLDER_INLINE, '');
    text = removeImagePlaceholderLines(text).trim();
    text = stripOuterQuotes(text);
    if (!text) return null;

    let expression = null;
    const expressionTagRegex = new RegExp(`<(${expressionPattern})>`, 'i');
    const exprMatch = text.match(expressionTagRegex);
    if (exprMatch) {
      expression = exprMatch[1];
      text = text.replace(expressionTagRegex, '').trim();
    }

    let dialogueMatch = text.match(/^(?:<[^>]+>)?([^:：]{1,20})[：:]\s*["'“‘「『（(]([\s\S]+)["'”’」』）)]\s*$/);
    if (!dialogueMatch) {
      dialogueMatch = text.match(/^(?:<[^>]+>)?([^:：]{1,20})[：:]\s*([\s\S]+)$/);
    }

    if (dialogueMatch && dialogueMatch[1] && dialogueMatch[2]) {
      const speaker = normalizeSpeakerName(dialogueMatch[1]);
      const dialogue = stripOuterQuotes(dialogueMatch[2]).trim();
      if (!speaker || !dialogue) return null;
      const splitResult = splitZhJaForDisplayAndTts(dialogue, settings.ttsBilingualZhJaEnabled === true);

      if (speaker === '旁白') {
        const narrationSeg = {
          type: 'narration',
          speaker: null,
          text: splitResult.displayText,
          expression: null,
        };
        if (splitResult.ttsText && splitResult.ttsText !== splitResult.displayText) {
          narrationSeg.ttsText = splitResult.ttsText;
        }
        return narrationSeg;
      }

      if (speaker.length <= 20 && speaker.length > 0) {
        const segResult = {
          type: 'dialogue',
          speaker: speaker,
          text: splitResult.displayText,
          expression: expression || '默认',
        };
        if (splitResult.ttsText && splitResult.ttsText !== splitResult.displayText) {
          segResult.ttsText = splitResult.ttsText;
        }
        if (ttsConfigString) {
          segResult.tts = parseTTSConfig(ttsConfigString, speaker);
        }
        return segResult;
      }
    }

    const narrationSplit = splitZhJaForDisplayAndTts(text, settings.ttsBilingualZhJaEnabled === true);
    const narrationResult = {
      type: 'narration',
      speaker: null,
      text: narrationSplit.displayText,
      expression: null,
    };
    if (narrationSplit.ttsText && narrationSplit.ttsText !== narrationSplit.displayText) {
      narrationResult.ttsText = narrationSplit.ttsText;
    }
    return narrationResult;
  }

  // 解析所有已闭合的 <p> 标签和 <styled> 块，统一按位置排序
  const pTagRegex = /<p(?:\s+tts="([^"]*)")?\s*>([\s\S]*?)<\/p>/gi;
  const allContentItems = []; // { position, type, data }

  let match;
  let lastClosedPTagEnd = 0;
  while ((match = pTagRegex.exec(content)) !== null) {
    const ttsConfig = match[1];
    const seg = parseSegmentText(match[2], ttsConfig);
    if (seg) {
      seg._sourcePos = match.index;
      const bgAtThisPos = getBackgroundAtPosition(match.index);
      if (bgAtThisPos) {
        seg.backgroundScene = bgAtThisPos.scene;
      }
      allContentItems.push({ position: match.index, type: 'segment', data: seg });
    }
    lastClosedPTagEnd = pTagRegex.lastIndex;
  }

  // 将 styled blocks 作为独立 segment 加入
  for (const block of styledBlocks) {
    const bgAtThisPos = getBackgroundAtPosition(block.position);
    const styledSeg = {
      type: 'styled',
      speaker: null,
      text: block.lines.map(l => l.text).join(' '),
      expression: null,
      styleType: block.styleType,
      styledFrom: block.from,
      styledTo: block.to,
      styledTitle: block.title,
      styledDate: block.date,
      styledLines: block.lines,
      backgroundScene: bgAtThisPos ? bgAtThisPos.scene : null,
      _sourcePos: block.position,
    };
    allContentItems.push({ position: block.position, type: 'segment', data: styledSeg });
  }

  // 按位置排序后统一加入 segments
  allContentItems.sort((a, b) => a.position - b.position);
  for (const item of allContentItems) {
    if (result.segments.length < 3) {
      console.log(`[${SCRIPT_NAME}] [DEBUG] 段落[${result.segments.length}] 位置:${item.position} 类型:${item.data.type} 背景:${item.data.backgroundScene || 'null'} 文本:${(item.data.text || '').substring(0, 20)}...`);
    }
    result.segments.push(item.data);
  }
  // 尝试匹配末尾未闭合的 <p> 标签 (流式输出)
  const remainingText = content.substring(lastClosedPTagEnd);
  const unclosedPMatch = remainingText.match(/<p(?:\s+tts="([^"]*)")?\s*>([\s\S]*)$/i);
  if (unclosedPMatch) {
    const rawContent = unclosedPMatch[2];
    const ttsConfig = unclosedPMatch[1];
    if (rawContent && rawContent.trim()) {
      const seg = parseSegmentText(rawContent, ttsConfig);
      if (seg) {
        const segPos = lastClosedPTagEnd + unclosedPMatch.index;
        seg._sourcePos = segPos;
        const bgAtThisPos = getBackgroundAtPosition(segPos);
        if (bgAtThisPos) {
          seg.backgroundScene = bgAtThisPos.scene;
        }
        result.segments.push(seg);
      }
    }
  }

  // 如果没有 <p> 标签，尝试直接解析纯文本
  if (result.segments.length === 0) {
    const plainText = content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    const normalizedText = removeImagePlaceholderLines(plainText)
      .replace(RE_IMAGE_PLACEHOLDER_INLINE, '')
      .trim();

    if (normalizedText) {
      const lines = normalizedText
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

      for (const line of lines) {
        const seg = parseSegmentText(line);
        if (!seg) continue;
        seg._sourcePos = content.length;
        if (backgroundChanges.length > 0) {
          seg.backgroundScene = backgroundChanges[backgroundChanges.length - 1].scene;
        }
        result.segments.push(seg);
      }

      if (result.segments.length === 0) {
        const seg = {
          type: 'narration',
          speaker: null,
          text: normalizedText,
          expression: null,
          _sourcePos: content.length,
        };
        if (backgroundChanges.length > 0) {
          seg.backgroundScene = backgroundChanges[backgroundChanges.length - 1].scene;
        }
        result.segments.push(seg);
      }
    }
  }

  if (spriteCommands.length > 0 && result.segments.length > 0) {
    for (const cmd of spriteCommands) {
      let targetSegment = null;
      for (const seg of result.segments) {
        if ((Number(seg._sourcePos) || 0) >= cmd.position) {
          targetSegment = seg;
          break;
        }
      }
      if (!targetSegment) {
        targetSegment = result.segments[result.segments.length - 1];
      }
      if (!targetSegment.spriteCommands) {
        targetSegment.spriteCommands = [];
      }
      targetSegment.spriteCommands.push({
        action: cmd.action,
        character: cmd.character,
      });
    }
  }

  if (backgroundChanges.length > 0 && result.segments.length > 0) {
    for (const bg of backgroundChanges) {
      let targetSegment = null;
      for (const seg of result.segments) {
        if ((Number(seg._sourcePos) || 0) >= bg.position) {
          targetSegment = seg;
          break;
        }
      }
      if (!targetSegment) {
        targetSegment = result.segments[result.segments.length - 1];
      }
      if (!targetSegment.backgroundCommands) {
        targetSegment.backgroundCommands = [];
      }
      targetSegment.backgroundCommands.push({
        scene: bg.scene,
      });
    }
  }

  if (pixiCommands.length > 0 && result.segments.length > 0) {
    for (const cmd of pixiCommands) {
      let targetSegment = null;
      for (const seg of result.segments) {
        if ((Number(seg._sourcePos) || 0) >= cmd.position) {
          targetSegment = seg;
          break;
        }
      }
      if (!targetSegment) {
        targetSegment = result.segments[result.segments.length - 1];
      }
      if (!targetSegment.effectOps) {
        targetSegment.effectOps = [];
      }
      if (cmd.action === 'init') {
        targetSegment.effectOps.push({ action: 'init' });
      } else if (cmd.action === 'perform' && cmd.name) {
        targetSegment.effectOps.push({
          action: 'perform',
          name: cmd.name,
        });
      }
    }
  }

  // 切分过长段落
  const MAX_SEG_LENGTH = 120;
  const finalSegments = [];
  result.segments.forEach(seg => {
    const hasDedicatedTtsText =
      typeof seg.ttsText === 'string' &&
      seg.ttsText.trim().length > 0 &&
      seg.ttsText !== seg.text;
    if (hasDedicatedTtsText || seg.type === 'styled') {
      finalSegments.push(seg);
      return;
    }
    if (!seg.text || seg.text.length <= MAX_SEG_LENGTH) {
      finalSegments.push(seg);
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
      const nextSeg = Object.assign({}, seg, { text: text.substring(0, splitIdx).trim() });
      if (!isFirstChunk) {
        delete nextSeg.spriteCommands;
        delete nextSeg.backgroundCommands;
        delete nextSeg.effectOps;
      }
      finalSegments.push(nextSeg);
      text = text.substring(splitIdx).trim();
      isFirstChunk = false;
    }
    if (text) {
      const nextSeg = Object.assign({}, seg, { text: text });
      if (!isFirstChunk) {
        delete nextSeg.spriteCommands;
        delete nextSeg.backgroundCommands;
        delete nextSeg.effectOps;
      }
      finalSegments.push(nextSeg);
    }
  });
  result.segments = finalSegments;
  result.segments.forEach(seg => {
    delete seg._sourcePos;
  });

  // 缓存解析结果
  if (parseCache.size >= PARSE_CACHE_MAX_SIZE) {
    const firstKey = parseCache.keys().next().value;
    parseCache.delete(firstKey);
  }
  parseCache.set(cacheKey, result);

  return result;
}
