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
    session.node.textContent = session.fullText;
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
  session.node.textContent = session.fullText.slice(0, session.index);
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
    node.textContent = fullText;
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
