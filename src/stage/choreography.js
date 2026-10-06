import { topWindow } from '../core/env.js';
import { playNameSwap } from '../ui/control-motion.js';
import { syncTtsCue } from '../ui/tts-cue.js';

// ============================================
// 对话编排：名牌入场 / 角色色 / 面板脉冲
// ============================================
// 说话人变化时：名牌重播入场动画（所有皮肤：opacity + 独立 translate，可与皮肤 transform 叠加；
// 默认皮肤额外 clip-path 擦入 + 下划条伸出），按角色名派生一个强调色写入 --gal-speaker-color
// （默认皮肤用于名牌下划条、面板书签角、文末指示），并让对话面板边缘「呼吸」一次。

const BADGE_ENTER_MS = 520;
const PANEL_PULSE_MS = 600;

// 角色色板：亮/暗面板上都能辨识，避开与旁白青色过近的色相
const SPEAKER_PALETTE = [
  '#ff4f7b', '#f0812a', '#8c6cff', '#1fae78', '#3d7bff',
  '#d9468f', '#14a3a3', '#c65bd6', '#e0a100', '#ff6a4d',
];

function hashName(name) {
  let h = 2166136261;
  for (const ch of String(name)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getSpeakerColor(name) {
  const key = String(name || '').trim();
  if (!key) return '';
  return SPEAKER_PALETTE[hashName(key) % SPEAKER_PALETTE.length];
}

function restartClass(el, cls, durationMs) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  // 播完即移除：类名常驻会挡住皮肤自身后续的 animation
  const timerKey = `__galTimer_${cls}`;
  if (el[timerKey]) topWindow.clearTimeout(el[timerKey]);
  el[timerKey] = topWindow.setTimeout(() => {
    el.classList.remove(cls);
    el[timerKey] = null;
  }, durationMs);
}

/**
 * 设置名牌文字并在说话人变化时播放编排。
 * @param {JQuery} $overlay
 * @param {JQuery} $nameBadge
 * @param {string} label 名牌显示文字
 * @param {{ narration?: boolean, speakerKey?: string|null }} options speakerKey 为真实角色名（旁白/CG/情境样式传 null）
 */
export function setSpeakerBadge($overlay, $nameBadge, label, { narration = false, speakerKey = null } = {}) {
  if (!$nameBadge || !$nameBadge.length) return;
  const $label = $nameBadge.find('span').first();
  const text = String(label ?? '');
  const prevText = $label.text();
  const changed = prevText !== text || $nameBadge.hasClass('gal-narrator-label') !== !!narration;
  $label.text(text);
  $nameBadge.toggleClass('gal-narrator-label', !!narration);
  syncTtsCue($overlay);

  const overlayEl = $overlay?.[0];
  if (overlayEl) {
    const color = speakerKey ? getSpeakerColor(speakerKey) : '';
    if (color) overlayEl.style.setProperty('--gal-speaker-color', color);
    else overlayEl.style.removeProperty('--gal-speaker-color');
  }

  if (!changed) return;
  restartClass($nameBadge[0], 'gal-badge-enter', BADGE_ENTER_MS);
  playNameSwap($nameBadge[0], $label[0], prevText);
  restartClass($overlay?.find('.gal-text-panel')[0], 'gal-panel-pulse', PANEL_PULSE_MS);
}
