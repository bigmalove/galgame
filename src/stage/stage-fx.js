import { $ } from '../core/env.js';

// ============================================
// 舞台级一次性效果：全屏闪白 / 闪色
// ============================================
// 元素挂在 .gal-game-container 内、对话框之上（z-index 见 数据库界面插件.css「舞台闪光」），
// 背景 flash 转场（CG 揭示）、雷电等共用

function ensureFlashLayer($overlay) {
  const $container = $overlay.find('.gal-game-container').first();
  if (!$container.length) return $();
  let $flash = $container.children('.gal-stage-flash');
  if (!$flash.length) {
    $flash = $('<div class="gal-stage-flash" aria-hidden="true"></div>');
    $container.append($flash);
  }
  return $flash;
}

export function stageFlash($overlay, { color = '#ffffff', variant = '' } = {}) {
  const $flash = ensureFlashLayer($overlay);
  const el = $flash[0];
  if (!el) return;
  el.style.setProperty('--gal-flash-color', color);
  el.classList.remove('is-active', 'is-bolt', 'is-thunder');
  void el.offsetWidth;
  // bolt：强闪（近距离雷击）；thunder：远雷，峰值低、带回闪，用于雷电特效的周期落雷
  if (variant === 'bolt' || variant === 'thunder') el.classList.add(`is-${variant}`);
  el.classList.add('is-active');
}

// ---------- 揭示横幅（NEW CG 等），同一 id 每次会话只弹一次 ----------
const shownBannerIds = new Set();

export function showStageBanner($overlay, { id = '', kicker = '', title = '', sub = '' } = {}) {
  if (id) {
    if (shownBannerIds.has(id)) return;
    shownBannerIds.add(id);
  }
  const $container = $overlay.find('.gal-game-container').first();
  if (!$container.length || !title) return;
  $container.children('.gal-stage-banner').remove();
  const $banner = $(`
    <div class="gal-stage-banner" aria-hidden="true">
      <div class="gal-stage-banner-tag"></div>
      <div class="gal-stage-banner-body">
        <div class="gal-stage-banner-sub"></div>
        <div class="gal-stage-banner-title"></div>
      </div>
    </div>`);
  $banner.find('.gal-stage-banner-tag').text(kicker || 'NEW');
  $banner.find('.gal-stage-banner-sub').text(sub || 'GALLERY UNLOCKED');
  $banner.find('.gal-stage-banner-title').text(title);
  $container.append($banner);
  void $banner[0].offsetWidth;
  $banner.addClass('is-active');
  setTimeout(() => {
    $banner.addClass('is-leaving');
    setTimeout(() => $banner.remove(), 600);
  }, 4200);
}

// 脚本卸载：移除仍在显示的横幅（其自动退场定时器随脚本 iframe 一起失效）
$(window).on('pagehide', () => {
  $('#gal-global-overlay .gal-stage-banner').remove();
});
