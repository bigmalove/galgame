import { $ } from '../core/env.js';
import { getModalMountRoot } from './fullscreen.js';

// ============================================
// Toast 通知
// ============================================

export function showToast(message, duration = 2500) {
  const mountRoot = getModalMountRoot();
  const $existing = $(mountRoot).find('.gal-toast');
  if ($existing.length) $existing.remove();
  const $toast = $(`<div class="gal-toast"><span>${message}</span></div>`);
  $(mountRoot).append($toast);
  setTimeout(() => $toast.fadeOut(300, () => $toast.remove()), duration);
}
