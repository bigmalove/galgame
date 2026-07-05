import { topWindow } from '../core/env.js';
import { getSettings } from '../core/settings.js';

const DEFAULT_SPEED = 30;
const MIN_SPEED = 5;
const MAX_SPEED = 60;
const DEFAULT_SOUND_VOLUME = 35;
const SOUND_MIN_INTERVAL_MS = 30;
const TICK_MIN_DELAY_MS = 8;

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

function getRuntimeSettings() {
  const settings = getSettings();
  const speed = clampNumber(settings?.typewriterSpeed, MIN_SPEED, MAX_SPEED, DEFAULT_SPEED);
  const soundVolume = clampNumber(settings?.typewriterSoundVolume, 0, 100, DEFAULT_SOUND_VOLUME);
  return {
    enabled: settings?.typewriterEnabled !== false,
    speed,
    soundEnabled: settings?.typewriterSoundEnabled !== false,
    soundVolume,
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
    renderTextSlice(session.node, session.fullText);
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
  if (!runtime.enabled) {
    completeSession(session, { commitText: true });
    return;
  }

  if (session.index >= session.fullText.length) {
    completeSession(session, { commitText: true });
    return;
  }

  session.index += 1;
  renderTextSlice(session.node, session.fullText.slice(0, session.index));
  playTypeSound();

  if (session.index >= session.fullText.length) {
    completeSession(session, { commitText: true });
    return;
  }

  const delay = Math.max(TICK_MIN_DELAY_MS, Math.round(1000 / runtime.speed));
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

export function finishActiveTypewriter() {
  if (!activeSession) return false;
  completeSession(activeSession, { commitText: true });
  return true;
}

export function renderTypewriterText(target, text, options = {}) {
  const node = toDomNode(target);
  const fullText = String(text || '');
  const runtime = getRuntimeSettings();
  const instant = options.instant === true || !runtime.enabled || fullText.length === 0;

  cancelTypewriter();

  if (!node) return Promise.resolve(fullText);

  if (instant) {
    renderTextSlice(node, fullText);
    return Promise.resolve(fullText);
  }

  const session = {
    id: ++sessionSerial,
    node,
    fullText,
    index: 0,
    timer: null,
    active: true,
    resolve: null,
  };
  session.promise = new Promise(resolve => {
    session.resolve = resolve;
  });

  node.textContent = '';
  activeSession = session;
  scheduleTyping(session);
  return session.promise;
}
