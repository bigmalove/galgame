import { topWindow, $ } from '../core/env.js';
import { SCRIPT_NAME } from '../core/constants.js';
import { getModalMountRoot } from './fullscreen.js';

// ============================================
// 通用弹窗组件
// ============================================

export function showCustomPopupPanel(title, htmlContent) {
  const mountRoot = getModalMountRoot();
  // 移除已存在的弹窗
  $(mountRoot).find('#gal-custom-popup-modal').remove();

  const $modal = $(`
    <div id="gal-custom-popup-modal" class="gal-popup-modal">
      <div class="gal-popup-panel">
        <div class="gal-popup-header">
          <span class="gal-popup-title">${title}</span>
          <button class="gal-popup-close">&times;</button>
        </div>
        <div class="gal-popup-body">
          ${htmlContent}
        </div>
      </div>
    </div>
  `);

  $(mountRoot).append($modal);

  // 关闭事件
  $modal.find('.gal-popup-close').on('click', function () {
    $modal.fadeOut(200, function () {
      $(this).remove();
    });
  });

  // 点击遮罩层关闭
  $modal.on('click', function (e) {
    if (e.target === this) {
      $modal.fadeOut(200, function () {
        $(this).remove();
      });
    }
  });

  return $modal;
}
