import { $, topWindow } from '../core/env.js';
import { getSettings } from '../core/settings.js';
import { MOTION_CHAR_FADE_MS, isMotionNode, notifyDialogAdvance } from './control-motion.js';

const DEFAULT_SPEED = 30;
const MIN_SPEED = 5;
const MAX_SPEED = 60;
const DEFAULT_SOUND_VOLUME = 35;
const SOUND_MIN_INTERVAL_MS = 30;
const TICK_MIN_DELAY_MS = 8;
// 逐字淡入的过渡时长（与 数据库界面插件.css .gal-tw-ch 一致），自然打完后等它播完再收尾
const CHAR_FADE_MS = 200;

// 标点停顿（毫秒，以 30 字/秒为基准，随打字速度缩放）：句末长停、句中短停，模拟说话节奏
const PUNCTUATION_PAUSE_MS = {
  '。': 260, '！': 260, '？': 260, '!': 220, '?': 220, '.': 160,
  '…': 120, '⋯': 120,
  '，': 110, '、': 90, ',': 80, '；': 140, ';': 120, '：': 110, ':': 90,
  '—': 45, '～': 60, '~': 50,
  '」': 70, '』': 70, '”': 70, '）': 50, ')': 40,
};

let activeSession = null;
let sessionSerial = 0;
let audioContext = null;
let lastSoundAt = 0;

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

function toDomNode(target) {
  if (!target) return null;
  if (target.jquery && target.length) return target[0];
  if (target.nodeType === 1) return target;
  return null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 引号配对：开引号 → 闭引号（直引号 " 开闭同形）
const QUOTE_PAIRS = { '“': '”', '"': '"', '「': '」', '『': '』' };

// 单行渲染：引号（含引号本身）内的对话用 .gal-quote 变色；未闭合的引号染色到行尾。
// 引号着色仅绘本模式启用（标准模式对话本身就是独立 segment，无需行内区分）
function renderLineHtml(line, colorQuotes) {
  if (!colorQuotes) return escapeHtml(line);
  let html = '';
  let i = 0;
  while (i < line.length) {
    const close = QUOTE_PAIRS[line[i]];
    if (close) {
      let end = line.indexOf(close, i + 1);
      if (end === -1) end = line.length - 1;
      html += `<span class="gal-quote">${escapeHtml(line.slice(i, end + 1))}</span>`;
      i = end + 1;
    } else {
      let next = i;
      while (next < line.length && !QUOTE_PAIRS[line[next]]) next++;
      html += escapeHtml(line.slice(i, next));
      i = next;
    }
  }
  return html;
}

// 文本按 \n 分段渲染为块级 span，段间距由 CSS 变量 --gal-paragraph-gap 控制
function renderTextSlice(node, text) {
  const raw = String(text ?? '');
  const colorQuotes = getSettings()?.simpleStorybookMode === true;
  const lines = raw.split('\n');
  if (lines.length === 1) {
    node.innerHTML = renderLineHtml(raw, colorQuotes);
    return;
  }
  node.innerHTML = lines
    .map(line => `<span class="gal-para">${renderLineHtml(line, colorQuotes)}</span>`)
    .join('');
}

// 打字用结构：与 renderTextSlice 同构（段落 / 引号着色），每个字符包一层 .gal-tw-ch，
// 一次性写入 DOM，之后只逐个加 .is-on（O(n)，且排版预先占位，换行不会在打字途中跳动）
function wrapChars(text) {
  let html = '';
  for (const ch of String(text ?? '')) {
    html += `<span class="gal-tw-ch">${escapeHtml(ch)}</span>`;
  }
  return html;
}

function renderLineTypingHtml(line, colorQuotes) {
  if (!colorQuotes) return wrapChars(line);
  let html = '';
  let i = 0;
  while (i < line.length) {
    const close = QUOTE_PAIRS[line[i]];
    if (close) {
      let end = line.indexOf(close, i + 1);
      if (end === -1) end = line.length - 1;
      html += `<span class="gal-quote">${wrapChars(line.slice(i, end + 1))}</span>`;
      i = end + 1;
    } else {
      let next = i;
      while (next < line.length && !QUOTE_PAIRS[line[next]]) next++;
      html += wrapChars(line.slice(i, next));
      i = next;
    }
  }
  return html;
}

function renderTypingMarkup(node, text) {
  const raw = String(text ?? '');
  const colorQuotes = getSettings()?.simpleStorybookMode === true;
  const lines = raw.split('\n');
  if (lines.length === 1) {
    node.innerHTML = renderLineTypingHtml(raw, colorQuotes);
  } else {
    node.innerHTML = lines
      .map(line => `<span class="gal-para">${renderLineTypingHtml(line, colorQuotes)}</span>`)
      .join('');
  }
  return Array.from(node.querySelectorAll('.gal-tw-ch'));
}

// 文末「可继续」指示（样式由皮肤决定，默认皮肤显示闪烁的强调色箭头）
function appendEndMarker(node) {
  if (!node || !String(node.textContent || '').trim()) return;
  const host = node.lastElementChild && node.lastElementChild.classList.contains('gal-para')
    ? node.lastElementChild
    : node;
  const marker = node.ownerDocument.createElement('span');
  marker.className = 'gal-tw-end';
  marker.setAttribute('aria-hidden', 'true');
  host.appendChild(marker);
}

function commitFinalText(node, text) {
  renderTextSlice(node, text);
  appendEndMarker(node);
}

// 文字区溢出时（分页估算偏差的兜底），打字过程中滚动跟随正在显示的字
function keepCharVisible(node, charEl) {
  if (node.scrollHeight <= node.clientHeight + 1) return;
  const box = node.getBoundingClientRect();
  const rect = charEl.getBoundingClientRect();
  if (rect.bottom > box.bottom - 2) node.scrollTop += rect.bottom - box.bottom + 4;
}

function getPunctuationPause(ch, speed) {
  const base = PUNCTUATION_PAUSE_MS[ch];
  if (!base) return 0;
  // 慢速时停顿略长、快速时收短（30 字/秒为 1 倍）
  const factor = Math.max(0.45, Math.min(1.5, 30 / speed));
  return Math.round(base * factor);
}

function getRuntimeSettings() {
  const settings = getSettings();
  const speed = clampNumber(settings?.typewriterSpeed, MIN_SPEED, MAX_SPEED, DEFAULT_SPEED);
  const soundVolume = clampNumber(settings?.typewriterSoundVolume, 0, 100, DEFAULT_SOUND_VOLUME);
  return {
    enabled: settings?.typewriterEnabled !== false,
    speed,
    soundEnabled: settings?.typewriterSoundEnabled !== false,
    soundVolume,
    punctuationPause: settings?.typewriterPunctuationPause !== false,
  };
}

function completeSession(session, { commitText }) {
  if (!session || !session.active) return;
  session.active = false;
  if (session.timer) {
    topWindow.clearTimeout(session.timer);
    session.timer = null;
  }
  if (commitText && session.node) {
    if (session.naturalEnd) {
      // 自然打完：等最后几个字淡入结束再换成干净结构（期间若已切到下一段则跳过）
      const node = session.node;
      const serial = String(session.id);
      node.dataset.galTwSerial = serial;
      const expectedText = session.fullText.replace(/\n/g, '');
      topWindow.setTimeout(() => {
        // 期间被其他逻辑改写过内容（情境样式清空、CG 提示等）则放弃，避免把旧文本写回
        if (!node.isConnected || node.dataset.galTwSerial !== serial) return;
        if (node.textContent !== expectedText) return;
        commitFinalText(node, session.fullText);
      }, (isMotionNode(node) ? MOTION_CHAR_FADE_MS : CHAR_FADE_MS) + 40);
    } else {
      commitFinalText(session.node, session.fullText);
    }
  }
  if (activeSession && activeSession.id === session.id) {
    activeSession = null;
  }
  if (typeof session.resolve === 'function') {
    session.resolve(session.fullText);
  }
}

function ensureAudioContext() {
  if (audioContext) {
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
    return audioContext;
  }

  const AudioContextClass =
    topWindow?.AudioContext
    || topWindow?.webkitAudioContext
    || globalThis?.AudioContext
    || globalThis?.webkitAudioContext;
  if (!AudioContextClass) return null;

  try {
    audioContext = new AudioContextClass();
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
  } catch (error) {
    audioContext = null;
  }
  return audioContext;
}

function playTypeSound() {
  const now = Date.now();
  if (now - lastSoundAt < SOUND_MIN_INTERVAL_MS) return;
  lastSoundAt = now;

  const runtime = getRuntimeSettings();
  if (!runtime.soundEnabled || runtime.soundVolume <= 0) return;

  const ctx = ensureAudioContext();
  if (!ctx) return;

  try {
    const gainNode = ctx.createGain();
    const osc = ctx.createOscillator();
    const startAt = ctx.currentTime;
    const duration = 0.018;
    const volume = Math.max(0, Math.min(1, runtime.soundVolume / 100)) * 0.06;

    osc.type = 'triangle';
    osc.frequency.value = 920 + Math.random() * 140;

    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.linearRampToValueAtTime(volume, startAt + 0.002);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(startAt);
    osc.stop(startAt + duration);
  } catch (error) {
    // Ignore browser audio errors (autoplay restrictions, unsupported context states, etc.)
  }
}

function scheduleTyping(session) {
  if (!session || !session.active) return;
  if (!session.node || !session.node.isConnected) {
    completeSession(session, { commitText: false });
    return;
  }

  const runtime = getRuntimeSettings();
  if (!runtime.enabled || session.index >= session.chars.length) {
    completeSession(session, { commitText: true });
    return;
  }

  const charEl = session.chars[session.index];
  session.index += 1;
  charEl.classList.add('is-on');
  keepCharVisible(session.node, charEl);
  const ch = charEl.textContent || '';
  if (ch.trim()) playTypeSound();

  if (session.index >= session.chars.length) {
    session.naturalEnd = true;
    completeSession(session, { commitText: true });
    return;
  }

  const pause = runtime.punctuationPause ? getPunctuationPause(ch, runtime.speed) : 0;
  const delay = Math.max(TICK_MIN_DELAY_MS, Math.round(1000 / runtime.speed)) + pause;
  session.timer = topWindow.setTimeout(() => scheduleTyping(session), delay);
}

export function isTypewriterActive() {
  return !!(activeSession && activeSession.active);
}

export function cancelTypewriter() {
  if (!activeSession) return false;
  completeSession(activeSession, { commitText: false });
  return true;
}

// 当前在该节点上打字的进度（已显示的字数）；节点上没有进行中的打字时返回 null
export function getActiveTypewriterProgress(target) {
  const node = toDomNode(target);
  if (!activeSession || !activeSession.active || !node || activeSession.node !== node) return null;
  return activeSession.index;
}

export function finishActiveTypewriter() {
  if (!activeSession) return false;
  completeSession(activeSession, { commitText: true });
  return true;
}

// options.startAt：同一页在末尾追加了文字（流式输出），前 startAt 个字直接显示，从这里接着打
export function renderTypewriterText(target, text, options = {}) {
  const node = toDomNode(target);
  const fullText = String(text || '');
  const runtime = getRuntimeSettings();
  const instant = options.instant === true || !runtime.enabled || fullText.length === 0;
  const startAt = Math.max(0, Math.floor(Number(options.startAt) || 0));

  cancelTypewriter();

  if (!node) return Promise.resolve(fullText);

  delete node.dataset.galTwSerial;
  if (!startAt) {
    if (fullText.length) notifyDialogAdvance(node);
    // 新的一页总是从顶部开始（文字区自身可滚动，上一页的滚动位置会残留）
    node.scrollTop = 0;
  }
  if (instant) {
    if (fullText.length) commitFinalText(node, fullText);
    else renderTextSlice(node, fullText);
    return Promise.resolve(fullText);
  }

  const session = {
    id: ++sessionSerial,
    node,
    fullText,
    chars: renderTypingMarkup(node, fullText),
    index: 0,
    timer: null,
    active: true,
    naturalEnd: false,
    resolve: null,
  };
  session.promise = new Promise(resolve => {
    session.resolve = resolve;
  });

  // 接着打：已显示的字在首帧样式计算前就加上 is-on，不会重放淡入
  session.index = Math.min(startAt, session.chars.length);
  for (let i = 0; i < session.index; i++) session.chars[i].classList.add('is-on');

  activeSession = session;
  scheduleTyping(session);
  return session.promise;
}

// 脚本卸载：打字定时器挂在酒馆主页面的 window 上，需显式停掉（直接落定全文，避免停在半句）
$(window).on('pagehide', () => {
  finishActiveTypewriter();
});
