import { topWindow, $ } from '../core/env.js';
import { SCRIPT_NAME } from '../core/constants.js';
import { getModalMountRoot } from './fullscreen.js';

// ============================================
// 通用弹窗组件
// ============================================
function escapeText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizePopupHtml(value) {
  const rawHtml = String(value ?? '');
  if (!rawHtml.trim()) return '';

  try {
    const doc = topWindow.document.implementation.createHTMLDocument('gal-popup-sanitize');
    doc.body.innerHTML = rawHtml;

    doc.body
      .querySelectorAll('script, style, iframe, object, embed, link, meta, base, form')
      .forEach(node => node.remove());

    doc.body.querySelectorAll('*').forEach(element => {
      Array.from(element.attributes).forEach(attr => {
        const attrName = String(attr.name || '').toLowerCase();
        const attrValue = String(attr.value || '').trim();

        if (attrName.startsWith('on')) {
          element.removeAttribute(attr.name);
          return;
        }

        if (
          ['href', 'src', 'xlink:href', 'formaction'].includes(attrName) &&
          /^\s*javascript:/i.test(attrValue)
        ) {
          element.removeAttribute(attr.name);
          return;
        }

        if (
          attrName === 'style' &&
          /(expression\s*\(|url\s*\(\s*['"]?\s*javascript:)/i.test(attrValue)
        ) {
          element.removeAttribute(attr.name);
        }
      });
    });

    return doc.body.innerHTML;
  } catch (error) {
    console.warn(`[${SCRIPT_NAME}] 弹窗内容清洗失败，已回退为纯文本`, error);
    return escapeText(rawHtml).replace(/\r?\n/g, '<br>');
  }
}

export function showCustomPopupPanel(title, htmlContent) {
  const mountRoot = getModalMountRoot();
  const safeTitle = escapeText(title);
  const safeHtmlContent = sanitizePopupHtml(htmlContent);
  // 移除已存在的弹窗
  $(mountRoot).find('#gal-custom-popup-modal').remove();

  const $modal = $(`
    <div id="gal-custom-popup-modal" class="gal-popup-modal">
      <div class="gal-popup-panel">
        <div class="gal-popup-header">
          <span class="gal-popup-title">${safeTitle}</span>
          <button class="gal-popup-close">&times;</button>
        </div>
        <div class="gal-popup-body">
          ${safeHtmlContent}
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
