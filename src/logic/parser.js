import { getCharacterTTSVoice } from '../audio/tts-config.js';
import { RE_GAL_TAGS as CORE_RE_GAL_TAGS, SCRIPT_NAME } from '../core/constants.js';
import { getDialogFontScale, getSettings } from '../core/settings.js';
import { getIsEnabled } from '../core/state.js';
import { GalgameStore } from '../core/store.js';
import { splitZhJaForDisplayAndTts } from '../utils/bilingual-text.js';
import { getAllExpressions } from '../utils/expressions.js';

// ============================================
// 预编译正则表达式
// ============================================
export const RE_GAL_TAGS = CORE_RE_GAL_TAGS;
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
// st-chatu8（智绘姬）提示词标记：image###提示词###；[ \t]* 而非 \s* 防止跨行误连 markdown "### 标题"
const RE_CHATU8_PROMPT_CLOSED = /image[ \t]*###[^\n]*?###/gi;
// 行尾缺失闭合 ###（流式中/AI 漏写）：从 image### 删到行尾
const RE_CHATU8_PROMPT_UNCLOSED = /image[ \t]*###[^\n]*$/gim;
// 剥离后仅剩包裹符/标点的残壳行判定
const RE_WRAPPER_ONLY = /^[\s“”"'‘’「」『』【】\[\]（）()<>·，,。.．…~—\-*]*$/;
// 检测用（无 g 标志，规避 lastIndex 陷阱）
const RE_CHATU8_PROMPT_TEST = /image[ \t]*###/i;
const RE_IMAGE_PH_TEST = /\[image\s*#\d+\]/i;

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

function hashCacheSource(source) {
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

// 延迟引用: getFormattedContent (enhanced-mode)
let _getFormattedContentRef = null;

export function setParserRefs({ getFormattedContent }) {
  if (getFormattedContent) _getFormattedContentRef = getFormattedContent;
}

// 由 UI 层实测对话框得出的每页可容纳字符数（随字号/面板尺寸变化）
let _measuredSegLength = null;

export function setMeasuredSegLength(value) {
  const n = Math.round(Number(value));
  _measuredSegLength = Number.isFinite(n) && n > 0 ? Math.max(60, Math.min(1200, n)) : null;
}

export function getMeasuredSegLength() {
  return _measuredSegLength;
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

// 统一剥离生图提示词标记：[image#N] 与 st-chatu8 的 image###提示词###
export function stripImagePlaceholders(text) {
  if (!text) return '';
  const lines = String(text).split(/\r?\n/);
  const kept = [];
  for (const rawLine of lines) {
    const hadMarker = RE_CHATU8_PROMPT_TEST.test(rawLine) || RE_IMAGE_PH_TEST.test(rawLine);
    const line = rawLine
      .replace(RE_CHATU8_PROMPT_CLOSED, '')
      .replace(RE_CHATU8_PROMPT_UNCLOSED, '')
      .replace(RE_IMAGE_PLACEHOLDER_INLINE, '');
    if (hadMarker && RE_WRAPPER_ONLY.test(line)) continue; // 含标记且剥离后仅剩残壳 → 整行删
    kept.push(line);
  }
  return kept.join('\n');
}

function normalizePlainStorybookText(rawText) {
  return stripImagePlaceholders(
    String(rawText || '')
      .replace(/<bgm>[\s\S]*?<\/bgm>/gi, '\n')
      .replace(/<bnimg>[\s\S]*?<\/bnimg>/gi, '\n')
      .replace(/<bgimg>[\s\S]*?<\/bgimg>/gi, '\n')
      .replace(/<whimg>[\s\S]*?<\/whimg>/gi, '\n')
      .replace(/<option\b[^>]*>[\s\S]*?<\/option>/gi, '\n')
      .replace(/<background\b[^>]*\/?>/gi, '\n')
      .replace(/<sprite\b[^>]*\/?>/gi, '\n')
      .replace(/<pixiInit\b[^>]*\/?>/gi, '\n')
      .replace(/<pixiPerform\b[^>]*\/?>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<p(?:\s[^>]*)?>/gi, '')
      .replace(/<\/styled>/gi, '\n')
      .replace(/<styled\b[^>]*>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n'),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitPlainStorybookText(text) {
  return String(text || '')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);
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
  return stripImagePlaceholders(String(name || ''))
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

  const simplifiedPattern =
    /<p>\s*([^[\]<>:：]{1,20})\[([^\]]+)\]\s*[：:]\s*[""\"'「『（(]([\s\S]+?)[""\"'」』）)]\s*<\/p>/gi;

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

    // 性别标签独立透传：绑定音色后 speaker 会被具体音色名覆盖，
    // 路人剪影仍需 男声/女声 信息按性别回退，故单独携带并做会话级缓存
    const genderCache = GalgameStore.cache.voiceGenders;
    let voiceGenderTag = null;
    if (specifiedVoice === '男声' || specifiedVoice === '女声') {
      voiceGenderTag = specifiedVoice;
      genderCache.set(speaker, specifiedVoice);
    } else if (genderCache.has(speaker)) {
      voiceGenderTag = genderCache.get(speaker);
    }

    const ttsParts = [];
    if (voice) ttsParts.push(`speaker=${voice}`);
    if (voiceGenderTag && voiceGenderTag !== voice) ttsParts.push(`voiceTag=${voiceGenderTag}`);
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
  const simpleStorybookMode = settings.simpleStorybookMode === true;
  const parseCache = GalgameStore.cache.parse;
  const originalHtml = String(html || '');
  html = originalHtml;

  // 提取弹窗一/弹窗二内容（必须在 preprocessSimplifiedFormat 之前，因为其中的 cleanIllegalTags 会删除 <div> 标签）
  const popup1Match = html.match(RE_POPUP1);
  const popup2Match = html.match(RE_POPUP2);
  // 从 html 中移除弹窗标签，避免干扰后续解析
  if (popup1Match) html = html.replace(RE_POPUP1, '');
  if (popup2Match) html = html.replace(RE_POPUP2, '');

  // 加强模式：优先使用格式化版本（必须在 preprocessSimplifiedFormat 之前替换，
  // 否则格式化文本里的简化格式行「角色[表情,男声/女声]: "对话"」会漏掉预处理，
  // 标签泄漏进说话人名，路人剪影也拿不到性别信息）
  if (isEnabled && settings.enhancedMode?.enabled && messageId) {
    const formatData = _getFormattedContentRef ? _getFormattedContentRef(messageId) : null;
    if (formatData) {
      console.log(`[${SCRIPT_NAME}] 使用格式化版本 (swipe ${formatData.formattedIndex})`);
      html = formatData.formatted;
      html = html.replace(RE_THINK_CLOSED, '');
      html = html.replace(RE_THINK_UNCLOSED, '');
    }
  }

  // 预处理简化格式
  if (!simpleStorybookMode) {
    html = preprocessSimplifiedFormat(html);
  }

  // 性能优化：检查缓存
  const popup1Html = popup1Match ? popup1Match[1].trim() : '';
  const popup2Html = popup2Match ? popup2Match[1].trim() : '';
  // 每页文字量：用户手动指定 > UI 层实测容量 > 按字号反比估算兜底
  const BASE_SEG_LENGTH = 120;
  const segLengthOverride = Math.round(Number(settings.dialogSegLengthOverride) || 0);
  const MAX_SEG_LENGTH =
    segLengthOverride > 0
      ? Math.max(40, Math.min(2000, segLengthOverride))
      : (_measuredSegLength ?? Math.max(40, Math.min(360, Math.round(BASE_SEG_LENGTH / getDialogFontScale(settings)))));
  const cacheSource = [
    html,
    popup1Html,
    popup2Html,
    simpleStorybookMode ? 'simple-storybook' : 'standard-galgame',
    settings.ttsBilingualZhJaEnabled === true ? 'tts-bilingual-zh-ja' : 'tts-default',
    `seg-len-${MAX_SEG_LENGTH}`,
  ].join('\n---gal-cache-boundary---\n');
  const cacheKey = `${cacheSource.length}_${hashCacheSource(cacheSource)}`;
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
    // 本次分页使用的每页字符数，渲染后与实测容量比对以决定是否需要重排
    segLength: MAX_SEG_LENGTH,
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
  if (!simpleStorybookMode && firstGalMatch && firstGalMatch.index > 0) {
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
    console.log(
      `[${SCRIPT_NAME}] [DEBUG] 消息包含 ${backgroundChanges.length} 个背景切换点，最终背景: "${lastBg.scene}"`,
    );
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
  const spriteAssignments = [];
  let spriteTagMatch;
  while ((spriteTagMatch = RE_SPRITE_TAG.exec(content)) !== null) {
    const attrs = parseTagAttributes(spriteTagMatch[1] || '');
    const action = String(attrs.action || '').toLowerCase();
    const targetCharacter = String(attrs.character || attrs.char || '').trim();
    if (!targetCharacter) continue;
    if (action === 'exit') {
      spriteCommands.push({
        position: spriteTagMatch.index,
        action: 'exit',
        character: targetCharacter,
      });
    } else if (action === 'assign') {
      // AI 自动分配立绘：<sprite action="assign" character="角色名" template="模板名" />
      const templateName = String(attrs.template || attrs.tpl || '').trim();
      if (!templateName) continue;
      spriteAssignments.push({
        position: spriteTagMatch.index,
        character: targetCharacter,
        template: templateName,
      });
    }
  }
  RE_SPRITE_TAG.lastIndex = 0;
  if (spriteAssignments.length > 0) {
    result.spriteAssignments = spriteAssignments;
  }

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

  // 解析所有 <styled> 标签（标准模式与绘本模式共用）
  function collectStyledBlocks(sourceContent) {
    const blocks = [];
    const styledRegex = /<styled\b([^>]*)>([\s\S]*?)<\/styled>/gi;
    let styledMatch;
    while ((styledMatch = styledRegex.exec(sourceContent)) !== null) {
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
      const styledLines = normalizedStyledBody
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);
      const parsedLines = styledLines.map(line => {
        const colonMatch = line.match(/^([^:：]{1,20})[：:]\s*(.+)$/);
        if (colonMatch) {
          return { sender: colonMatch[1].trim(), text: colonMatch[2].trim() };
        }
        return { sender: null, text: line };
      });

      blocks.push({
        position: styledMatch.index,
        endPosition: styledMatch.index + styledMatch[0].length,
        styleType: styledType,
        from: styledAttrs.from || null,
        to: styledAttrs.to || null,
        title: styledAttrs.title || null,
        date: styledAttrs.date || null,
        lines: parsedLines,
      });
      console.log(
        `[${SCRIPT_NAME}] [DEBUG] 解析到 styled 块[${styledMatch.index}]: type="${styledType}", ${parsedLines.length}行`,
      );
    }
    return blocks;
  }

  function buildStyledSegment(block) {
    const bgAtThisPos = getBackgroundAtPosition(block.position);
    return {
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
  }

  if (simpleStorybookMode) {
    const styledBlocks = collectStyledBlocks(content).sort((a, b) => a.position - b.position);
    const allStorybookItems = [];

    const pushPlainStorybookText = (rawText, sourcePos) => {
      const normalizedText = normalizePlainStorybookText(rawText);
      const lines = splitPlainStorybookText(normalizedText);
      for (const line of lines) {
        const seg = {
          type: 'narration',
          speaker: null,
          text: line,
          expression: null,
          _sourcePos: sourcePos,
        };
        const bgAtThisPos = getBackgroundAtPosition(sourcePos);
        if (bgAtThisPos) {
          seg.backgroundScene = bgAtThisPos.scene;
        }
        allStorybookItems.push({ position: sourcePos, data: seg });
      }
    };

    // 按范围处理纯文本（<p> 内外都走 pushPlainStorybookText），位置用真实偏移
    const processPlainRange = (rangeStart, rangeEnd) => {
      if (rangeEnd <= rangeStart) return;
      const chunk = content.slice(rangeStart, rangeEnd);
      const plainPTagRegex = /<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi;
      let plainPMatch;
      let cursor = 0;
      while ((plainPMatch = plainPTagRegex.exec(chunk)) !== null) {
        if (plainPMatch.index > cursor) {
          pushPlainStorybookText(chunk.substring(cursor, plainPMatch.index), rangeStart + cursor);
        }
        pushPlainStorybookText(plainPMatch[1], rangeStart + plainPMatch.index);
        cursor = plainPTagRegex.lastIndex;
      }
      if (cursor < chunk.length) {
        pushPlainStorybookText(chunk.substring(cursor), rangeStart + cursor);
      }
    };

    // 以 styled 块为切点分割正文：即使正文没有 <p> 标签（自然段纯文本），
    // styled 段也会落在它在原文中的真实位置，而不是被排到最后
    let scanPos = 0;
    for (const block of styledBlocks) {
      processPlainRange(scanPos, block.position);
      allStorybookItems.push({ position: block.position, data: buildStyledSegment(block) });
      scanPos = block.endPosition;
    }
    processPlainRange(scanPos, content.length);

    allStorybookItems.sort((a, b) => a.position - b.position);
    for (const item of allStorybookItems) {
      result.segments.push(item.data);
    }
  } else {
    const styledBlocks = collectStyledBlocks(content);

    // 动态获取表情列表
    const expressionNames = getAllExpressions();
    const expressionPattern = expressionNames.map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

    function parseTTSConfig(ttsString, defaultSpeaker) {
      if (!ttsString) return null;

      const config = {
        speaker: defaultSpeaker,
        context: null,
        voiceTag: null,
      };

      const pairs = ttsString.split(';');
      for (const pair of pairs) {
        const [key, value] = pair.trim().split('=');
        if (key && value) {
          const trimmedKey = key.trim();
          const trimmedValue = value.trim();

          if (trimmedKey === 'speaker') config.speaker = trimmedValue;
          else if (trimmedKey === 'context') config.context = trimmedValue;
          else if (trimmedKey === 'voiceTag') config.voiceTag = trimmedValue;
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
      text = stripImagePlaceholders(text).trim();
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
        let speaker = normalizeSpeakerName(dialogueMatch[1]);
        // 兼容漏掉预处理的简化格式行：说话人内联「名字[表情,男声/女声|语气]」标签，
        // 剥离标签还原真实角色名，并回收表情与性别信息
        let inlineVoiceTag = null;
        const inlineTagMatch = speaker.match(/^([^[\]]{1,20})\[([^\]]+)\]$/);
        if (inlineTagMatch) {
          speaker = normalizeSpeakerName(inlineTagMatch[1]);
          if (!speaker) return null;
          const inlineParts = inlineTagMatch[2].split('|')[0].split(',').map(s => s.trim());
          if (!expression && inlineParts[0] && expressionNames.includes(inlineParts[0])) {
            expression = inlineParts[0];
          }
          if (inlineParts[1] === '男声' || inlineParts[1] === '女声') {
            inlineVoiceTag = inlineParts[1];
            GalgameStore.cache.voiceGenders.set(speaker, inlineVoiceTag);
          }
        }
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
          if (inlineVoiceTag) {
            if (!segResult.tts) {
              // 与 preprocessSimplifiedFormat 一致：男声/女声 标签作为 speaker 透传给 TTS 随机分配
              segResult.tts = { speaker: inlineVoiceTag, context: null, voiceTag: inlineVoiceTag };
            } else if (!segResult.tts.voiceTag) {
              segResult.tts.voiceTag = inlineVoiceTag;
            }
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
        console.log(
          `[${SCRIPT_NAME}] [DEBUG] 段落[${result.segments.length}] 位置:${item.position} 类型:${item.data.type} 背景:${item.data.backgroundScene || 'null'} 文本:${(item.data.text || '').substring(0, 20)}...`,
        );
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
      const normalizedText = stripImagePlaceholders(plainText).trim();

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
  }

  if (!simpleStorybookMode && spriteCommands.length > 0 && result.segments.length > 0) {
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

  // 合并相邻短段落：同类型同说话人的连续段落并到一页，直到接近每页容量。
  // 段落间用 \n 分隔，渲染层按段落分行显示。绘本模式同样合并（否则一行一页浪费空间）
  {
    const mergedSegments = [];
    const hasOwnTtsText = s => typeof s.ttsText === 'string' && s.ttsText.trim() && s.ttsText !== s.text;
    for (const seg of result.segments) {
      const prev = mergedSegments[mergedSegments.length - 1];
      const canMerge =
        prev &&
        prev.type === seg.type &&
        (seg.type === 'narration' || seg.type === 'dialogue') &&
        (prev.speaker || null) === (seg.speaker || null) &&
        prev.text &&
        seg.text &&
        !seg.spriteCommands &&
        !seg.backgroundCommands &&
        !seg.effectOps &&
        (prev.backgroundScene || null) === (seg.backgroundScene || null) &&
        !hasOwnTtsText(seg) &&
        !hasOwnTtsText(prev) &&
        (!seg.expression || seg.expression === prev.expression) &&
        prev.text.length + seg.text.length + 1 <= MAX_SEG_LENGTH;
      if (canMerge) {
        prev.text = `${prev.text}\n${seg.text}`;
      } else {
        mergedSegments.push(seg);
      }
    }
    result.segments = mergedSegments;
  }

  // 切分过长段落（MAX_SEG_LENGTH 在函数开头按字号计算）
  const finalSegments = [];
  result.segments.forEach(seg => {
    const hasDedicatedTtsText =
      typeof seg.ttsText === 'string' && seg.ttsText.trim().length > 0 && seg.ttsText !== seg.text;
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
