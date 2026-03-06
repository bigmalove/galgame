import { SCRIPT_ID, SCRIPT_NAME } from '../core/constants.js';
import { topWindow } from '../core/env.js';

// ============================================
// 样式注入
// ============================================
const STYLES_INJECTED_FLAG = `${SCRIPT_ID}_styles_injected`;

export function injectStyles() {
  const targetDoc = topWindow.document;
  // 强制移除旧样式，确保热重载生效
  const oldStyle = targetDoc.getElementById(`${SCRIPT_ID}-styles`);
  if (oldStyle) oldStyle.remove();

  topWindow[STYLES_INJECTED_FLAG] = true;
  // 注入字体（免翻墙 CDN）
  const webFontUrls = [
    'https://gcore.jsdelivr.net/npm/@fontsource/barlow/index.css',
    'https://gcore.jsdelivr.net/npm/@fontsource/noto-sans-sc/index.css',
    'https://gcore.jsdelivr.net/npm/@fontsource/noto-serif-sc/index.css',
    'https://gcore.jsdelivr.net/npm/lxgw-wenkai-screen-webfont/style.css',
  ];
  webFontUrls.forEach(href => {
    if (targetDoc.querySelector(`link[href="${href}"]`)) return;
    const fontLink = targetDoc.createElement('link');
    fontLink.href = href;
    fontLink.rel = 'stylesheet';
    (targetDoc.head || targetDoc.documentElement).appendChild(fontLink);
  });
  const css = `__CSS_PLACEHOLDER__`;

  // Galgame UI 皮肤库（基于 UI/UX Pro Max 设计系统重构）
  const skinCss = `
/* === 全局皮肤重置 === */
#gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-name-badge,
#gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-name-badge span,
#gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-action-btn,
#gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-action-btn span,
#gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-action-btn i,
#gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-footer-btn,
#gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-footer-btn span,
#gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-footer-btn i,
#gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-pending-choices-btn,
#gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-pending-choices-btn span,
#gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-pending-choices-btn i,
#gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-footer-btn-next,
#gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-footer-btn-next span,
#gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-footer-btn-next i {
    transform: none !important;
}
/* 所有皮肤按钮通用修正：确保完整显示 + 缩放适配 */
#gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-footer-btn-next,
#gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-footer-btn,
#gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-action-btn,
#gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-pending-choices-btn {
    clip-path: none !important;
    overflow: visible !important;
    min-height: calc(2.25rem * var(--ui-scale, 1)) !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 0 calc(0.75rem * var(--ui-scale, 1)) !important;
    font-size: calc(0.85rem * var(--ui-scale, 1)) !important;
    cursor: pointer !important;
    white-space: nowrap !important;
}
/* 所有皮肤 NEXT 按钮缩放适配 */
#gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-footer-btn-next {
    font-size: calc(1.3rem * var(--ui-scale, 1)) !important;
    padding: 0 calc(2.5rem * var(--ui-scale, 1)) !important;
    height: calc(3.438rem * var(--ui-scale, 1)) !important;
    min-width: calc(8.75rem * var(--ui-scale, 1)) !important;
}
/* 所有皮肤名牌+文字缩放适配 */
#gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-name-badge {
    transform: scale(var(--ui-scale, 1)) !important;
    transform-origin: left top !important;
}
#gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-dialog-text {
    font-size: calc(1.25rem * var(--ui-scale, 1) * var(--font-scale, 1)) !important;
}

/* =========================================================
   1. 墨染千秋 (Ancient) — E-Ink / Paper 风格
   配色: Off-White #FDFBF7, Ink Black #1A1A1A, 朱砂 #8B2626
   ========================================================= */
#gal-global-overlay.skin-ancient { font-family: "KaiTi", "STKaiti", "楷体", "Noto Serif SC", serif; }
#gal-global-overlay.skin-ancient .gal-text-panel {
    background-color: rgba(253, 251, 247, var(--panel-opacity, 0.94)) !important;
    background-image: none !important;
    border: none !important;
    border-top: 3px solid #1A1A1A !important;
    border-bottom: 1px solid #c9b99a !important;
    border-radius: 2px !important;
    box-shadow: inset 0 0 40px rgba(139, 112, 66, 0.08), 0 8px 24px rgba(0,0,0,0.25) !important;
}
#gal-global-overlay.skin-ancient .gal-dialog-text {
    color: #1A1A1A !important;
    font-weight: 500 !important;
    letter-spacing: 0.08em;
    line-height: 2.1 !important;
    text-shadow: none !important;
    font-family: "KaiTi", "STKaiti", "楷体", "Noto Serif SC", serif !important;
}
#gal-global-overlay.skin-ancient .gal-name-badge {
    background: #8B2626 !important;
    color: #F5F1E8 !important;
    border: 1px solid #5a1a1a !important;
    border-radius: 2px !important;
    box-shadow: 2px 2px 0 rgba(0,0,0,0.2), inset 0 0 0 1px rgba(245,241,232,0.3) !important;
    padding: 0.4rem 1.4rem !important;
    left: 15px !important;
    top: -18px !important;
}
#gal-global-overlay.skin-ancient .gal-name-badge span {
    font-weight: 700; letter-spacing: 3px; text-shadow: none !important;
    font-family: "KaiTi", "STKaiti", "楷体", serif !important;
}
#gal-global-overlay.skin-ancient .gal-action-btn,
#gal-global-overlay.skin-ancient .gal-footer-btn,
#gal-global-overlay.skin-ancient .gal-pending-choices-btn {
    background: transparent !important;
    border: 1px solid #8b7042 !important;
    color: #4A4A4A !important;
    font-weight: 600 !important;
    border-radius: 2px !important;
    transition: all 0.2s ease-out !important;
    font-family: "KaiTi", "STKaiti", "楷体", serif !important;
}
#gal-global-overlay.skin-ancient .gal-footer-btn-next {
    background: #8B2626 !important;
    color: #F5F1E8 !important;
    border: 1px solid #5a1a1a !important;
    border-radius: 2px !important;
    box-shadow: 2px 2px 0 rgba(0,0,0,0.15) !important;
    font-family: "KaiTi", "STKaiti", "楷体", serif !important;
    font-weight: 700 !important;
    transition: all 0.2s ease-out !important;
}
#gal-global-overlay.skin-ancient .gal-footer-btn:hover,
#gal-global-overlay.skin-ancient .gal-action-btn:hover,
#gal-global-overlay.skin-ancient .gal-pending-choices-btn:hover {
    background: #8B2626 !important; color: #F5F1E8 !important; border-color: #8B2626 !important;
}
#gal-global-overlay.skin-ancient .gal-footer-btn-next:hover {
    background: #a63030 !important; box-shadow: 0 4px 12px rgba(139,38,38,0.35) !important;
}
#gal-global-overlay.skin-ancient .gal-footer-btn:active,
#gal-global-overlay.skin-ancient .gal-action-btn:active,
#gal-global-overlay.skin-ancient .gal-pending-choices-btn:active,
#gal-global-overlay.skin-ancient .gal-footer-btn-next:active {
    transform: translateY(1px) !important; box-shadow: none !important;
}
#gal-global-overlay.skin-ancient .gal-progress-bar { background: linear-gradient(90deg, #5a1e1e, #8B2626) !important; box-shadow: none !important; }

/* =========================================================
   2. 冒险者酒馆 (Western) — 元素级图片皮肤
   说明: 由 skin-western-runtime 注入 CSS 变量
   ========================================================= */
#gal-global-overlay.skin-western {
    --western-scene-clip: inset(14% 18% 54% 18%);
    --western-control-top: clamp(5.5rem, 10vh, 7.5rem);
    font-family: "Georgia", "Palatino Linotype", "Times New Roman", serif;
}

@media screen and (max-width: 48rem) {
    #gal-global-overlay.skin-western {
        --western-scene-clip: inset(17% 15% 55% 15%);
        --western-control-top: clamp(4.7rem, 10vh, 6rem);
    }
}

#gal-global-overlay.skin-western .gal-game-container {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    background: #1f130b !important;
    position: relative !important;
    isolation: isolate;
}

#gal-global-overlay.skin-western.skin-western-image-mode .gal-game-container::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    background-image: var(--western-main_frame_scene-normal-image);
    background-repeat: no-repeat;
    background-size: var(--western-main_frame_scene-bg-size, 100% 100%);
    transform: translate(
      calc(var(--western-main_frame_scene-offset-x, 0px) + var(--western-main_frame_scene-anchor-x, 0px)),
      calc(var(--western-main_frame_scene-offset-y, 0px) + var(--western-main_frame_scene-anchor-y, 0px))
    );
}

#gal-global-overlay.skin-western.skin-western-image-mode .gal-layer-bg {
    clip-path: var(--western-scene-clip) !important;
    -webkit-clip-path: var(--western-scene-clip) !important;
}

#gal-global-overlay.skin-western .gal-layer-bg::before,
#gal-global-overlay.skin-western .gal-layer-bg.generating-bg::after {
    display: none !important;
    content: none !important;
}

#gal-global-overlay.skin-western .gal-layer-bg.generating-bg .gal-bg-layer {
    opacity: 1 !important;
}

#gal-global-overlay.skin-western .gal-game-content {
    z-index: 4 !important;
}

#gal-global-overlay.skin-western .gal-dialog-layer,
#gal-global-overlay.skin-western .gal-text-panel,
#gal-global-overlay.skin-western .gal-name-badge,
#gal-global-overlay.skin-western .gal-action-btn,
#gal-global-overlay.skin-western .gal-footer-btn,
#gal-global-overlay.skin-western .gal-footer-btn-next,
#gal-global-overlay.skin-western .gal-pending-choices-btn,
#gal-global-overlay.skin-western .gal-location-bar,
#gal-global-overlay.skin-western .gal-time-bar,
#gal-global-overlay.skin-western .gal-fullscreen-btn,
#gal-global-overlay.skin-western .gal-bgm-widget {
    border: none !important;
    box-shadow: none !important;
}

#gal-global-overlay.skin-western .gal-text-panel,
#gal-global-overlay.skin-western .gal-name-badge,
#gal-global-overlay.skin-western .gal-action-btn,
#gal-global-overlay.skin-western .gal-footer-btn,
#gal-global-overlay.skin-western .gal-footer-btn-next,
#gal-global-overlay.skin-western .gal-pending-choices-btn,
#gal-global-overlay.skin-western .gal-location-bar,
#gal-global-overlay.skin-western .gal-time-bar,
#gal-global-overlay.skin-western .gal-fullscreen-btn,
#gal-global-overlay.skin-western .gal-bgm-widget {
    background-color: transparent !important;
    background-repeat: no-repeat !important;
    background-size: 100% 100% !important;
}

#gal-global-overlay.skin-western .gal-text-panel {
    background-color: rgba(225, 205, 168, var(--panel-opacity, 0.92)) !important;
    background-image: var(--western-dialog_panel-normal-image) !important;
    background-size: var(--western-dialog_panel-bg-size, 100% 100%) !important;
    color: #2f1d10 !important;
    transform: translate(
      calc(var(--western-dialog_panel-offset-x, 0px) + var(--western-dialog_panel-anchor-x, 0px)),
      calc(var(--western-dialog_panel-offset-y, 0px) + var(--western-dialog_panel-anchor-y, 0px))
    ) !important;
    width: var(--western-dialog_panel-width, auto) !important;
    height: var(--western-dialog_panel-height, auto) !important;
    padding-top: var(--western-dialog-panel-padding-top, 0.9rem) !important;
    padding-right: var(--western-dialog-panel-padding-right, 0.95rem) !important;
    padding-bottom: var(--western-dialog-panel-padding-bottom, 0.55rem) !important;
    padding-left: var(--western-dialog-panel-padding-left, 0.95rem) !important;
}

#gal-global-overlay.skin-western .gal-dialog-text {
    color: #2f1d10 !important;
    text-shadow: 0 1px 0 rgba(243, 224, 185, 0.35) !important;
}

#gal-global-overlay.skin-western .gal-name-badge {
    background-color: rgba(61, 40, 24, 0.86) !important;
    background-image: var(--western-name_badge-normal-image) !important;
    background-size: var(--western-name_badge-bg-size, 100% 100%) !important;
    transform: translate(
      calc(var(--western-name_badge-offset-x, 0px) + var(--western-name_badge-anchor-x, 0px)),
      calc(var(--western-name_badge-offset-y, 0px) + var(--western-name_badge-anchor-y, 0px))
    ) !important;
    width: var(--western-name_badge-width, auto) !important;
    height: var(--western-name_badge-height, auto) !important;
}

#gal-global-overlay.skin-western .gal-name-badge span {
    color: #2b1b0f !important;
    text-shadow: 0 1px 2px rgba(255, 246, 220, 0.5) !important;
}

#gal-global-overlay.skin-western .gal-bottom-toolbar {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
}

#gal-global-overlay.skin-western .gal-action-btn,
#gal-global-overlay.skin-western .gal-footer-btn,
#gal-global-overlay.skin-western .gal-footer-btn-next,
#gal-global-overlay.skin-western .gal-pending-choices-btn,
#gal-global-overlay.skin-western .gal-fullscreen-btn {
    background-color: rgba(55, 36, 23, 0.86) !important;
    position: relative !important;
    overflow: visible !important;
    color: #f4e6ca !important;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65) !important;
}

#gal-global-overlay.skin-western .gal-action-btn::before,
#gal-global-overlay.skin-western .gal-footer-btn::before,
#gal-global-overlay.skin-western .gal-footer-btn-next::before,
#gal-global-overlay.skin-western .gal-pending-choices-btn::before,
#gal-global-overlay.skin-western .gal-fullscreen-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background-repeat: no-repeat;
    background-size: 100% 100%;
    transition: filter 0.14s ease, transform 0.14s ease;
}

#gal-global-overlay.skin-western .gal-action-btn.btn-reroll {
    width: var(--western-btn_reroll-width, auto) !important;
    height: var(--western-btn_reroll-height, auto) !important;
    transform: translate(
      calc(var(--western-btn_reroll-offset-x, 0px) + var(--western-btn_reroll-anchor-x, 0px)),
      calc(var(--western-btn_reroll-offset-y, 0px) + var(--western-btn_reroll-anchor-y, 0px))
    ) !important;
}

#gal-global-overlay.skin-western .gal-action-btn.btn-reroll::before {
    background-image: var(--western-btn_reroll-normal-image);
    background-size: var(--western-btn_reroll-bg-size, 100% 100%);
}

#gal-global-overlay.skin-western .gal-action-btn.btn-reroll:hover::before {
    background-image: var(--western-btn_reroll-hover-image, var(--western-btn_reroll-normal-image));
    filter: brightness(1.08);
}

#gal-global-overlay.skin-western .gal-action-btn.btn-reroll:active::before {
    background-image: var(--western-btn_reroll-active-image, var(--western-btn_reroll-hover-image, var(--western-btn_reroll-normal-image)));
    filter: brightness(0.94);
    transform: translateY(1px);
}

#gal-global-overlay.skin-western .gal-action-btn.btn-free {
    width: var(--western-btn_free_input-width, auto) !important;
    height: var(--western-btn_free_input-height, auto) !important;
    transform: translate(
      calc(var(--western-btn_free_input-offset-x, 0px) + var(--western-btn_free_input-anchor-x, 0px)),
      calc(var(--western-btn_free_input-offset-y, 0px) + var(--western-btn_free_input-anchor-y, 0px))
    ) !important;
}

#gal-global-overlay.skin-western .gal-action-btn.btn-free::before {
    background-image: var(--western-btn_free_input-normal-image);
    background-size: var(--western-btn_free_input-bg-size, 100% 100%);
}

#gal-global-overlay.skin-western .gal-action-btn.btn-free:hover::before {
    background-image: var(--western-btn_free_input-hover-image, var(--western-btn_free_input-normal-image));
    filter: brightness(1.08);
}

#gal-global-overlay.skin-western .gal-action-btn.btn-free:active::before {
    background-image: var(--western-btn_free_input-active-image, var(--western-btn_free_input-hover-image, var(--western-btn_free_input-normal-image)));
    filter: brightness(0.94);
    transform: translateY(1px);
}

#gal-global-overlay.skin-western .gal-footer-btn {
    width: var(--western-footer_btn_common-width, auto) !important;
    height: var(--western-footer_btn_common-height, auto) !important;
    transform: translate(
      calc(var(--western-footer_btn_common-offset-x, 0px) + var(--western-footer_btn_common-anchor-x, 0px)),
      calc(var(--western-footer_btn_common-offset-y, 0px) + var(--western-footer_btn_common-anchor-y, 0px))
    ) !important;
}

#gal-global-overlay.skin-western .gal-footer-btn::before {
    background-image: var(--western-footer_btn_common-normal-image);
    background-size: var(--western-footer_btn_common-bg-size, 100% 100%);
}

#gal-global-overlay.skin-western .gal-footer-btn:hover::before {
    background-image: var(--western-footer_btn_common-hover-image, var(--western-footer_btn_common-normal-image));
    filter: brightness(1.08);
}

#gal-global-overlay.skin-western .gal-footer-btn:active::before {
    background-image: var(--western-footer_btn_common-active-image, var(--western-footer_btn_common-hover-image, var(--western-footer_btn_common-normal-image)));
    filter: brightness(0.94);
    transform: translateY(1px);
}

#gal-global-overlay.skin-western .gal-pending-choices-btn {
    width: var(--western-footer_btn_choices-width, auto) !important;
    height: var(--western-footer_btn_choices-height, auto) !important;
    transform: translate(
      calc(var(--western-footer_btn_choices-offset-x, 0px) + var(--western-footer_btn_choices-anchor-x, 0px)),
      calc(var(--western-footer_btn_choices-offset-y, 0px) + var(--western-footer_btn_choices-anchor-y, 0px))
    ) !important;
}

#gal-global-overlay.skin-western .gal-pending-choices-btn::before {
    background-image: var(--western-footer_btn_choices-normal-image);
    background-size: var(--western-footer_btn_choices-bg-size, 100% 100%);
}

#gal-global-overlay.skin-western .gal-pending-choices-btn:hover::before {
    background-image: var(--western-footer_btn_choices-hover-image, var(--western-footer_btn_choices-normal-image));
    filter: brightness(1.08);
}

#gal-global-overlay.skin-western .gal-pending-choices-btn:active::before {
    background-image: var(--western-footer_btn_choices-active-image, var(--western-footer_btn_choices-hover-image, var(--western-footer_btn_choices-normal-image)));
    filter: brightness(0.94);
    transform: translateY(1px);
}

#gal-global-overlay.skin-western .gal-footer-btn-next {
    width: var(--western-footer_btn_next-width, auto) !important;
    height: var(--western-footer_btn_next-height, auto) !important;
    transform: translate(
      calc(var(--western-footer_btn_next-offset-x, 0px) + var(--western-footer_btn_next-anchor-x, 0px)),
      calc(var(--western-footer_btn_next-offset-y, 0px) + var(--western-footer_btn_next-anchor-y, 0px))
    ) !important;
}

#gal-global-overlay.skin-western .gal-footer-btn-next::before {
    background-image: var(--western-footer_btn_next-normal-image);
    background-size: var(--western-footer_btn_next-bg-size, 100% 100%);
}

#gal-global-overlay.skin-western .gal-footer-btn-next:hover::before {
    background-image: var(--western-footer_btn_next-hover-image, var(--western-footer_btn_next-normal-image));
    filter: brightness(1.08);
}

#gal-global-overlay.skin-western .gal-footer-btn-next:active::before {
    background-image: var(--western-footer_btn_next-active-image, var(--western-footer_btn_next-hover-image, var(--western-footer_btn_next-normal-image)));
    filter: brightness(0.94);
    transform: translateY(1px);
}

#gal-global-overlay.skin-western .gal-location-bar,
#gal-global-overlay.skin-western .gal-time-bar {
    background-color: rgba(44, 28, 18, 0.9) !important;
    background-image: var(--western-status_bar_container-normal-image) !important;
    background-size: var(--western-status_bar_container-bg-size, 100% 100%) !important;
    color: #ead7b3 !important;
}

#gal-global-overlay.skin-western .gal-status-bar-container,
#gal-global-overlay.skin-western .gal-fullscreen-btn,
#gal-global-overlay.skin-western .gal-bgm-widget {
    top: var(--western-control-top, clamp(5.5rem, 10vh, 7.5rem)) !important;
}

#gal-global-overlay.skin-western .gal-fullscreen-btn {
    width: var(--western-fullscreen_btn-width, auto) !important;
    height: var(--western-fullscreen_btn-height, auto) !important;
    transform: translate(
      calc(var(--western-fullscreen_btn-offset-x, 0px) + var(--western-fullscreen_btn-anchor-x, 0px)),
      calc(var(--western-fullscreen_btn-offset-y, 0px) + var(--western-fullscreen_btn-anchor-y, 0px))
    ) !important;
}

#gal-global-overlay.skin-western .gal-fullscreen-btn::before {
    background-image: var(--western-fullscreen_btn-normal-image);
    background-size: var(--western-fullscreen_btn-bg-size, 100% 100%);
}

#gal-global-overlay.skin-western .gal-fullscreen-btn:hover::before {
    background-image: var(--western-fullscreen_btn-hover-image, var(--western-fullscreen_btn-normal-image));
    filter: brightness(1.08);
}

#gal-global-overlay.skin-western .gal-fullscreen-btn:active::before {
    background-image: var(--western-fullscreen_btn-active-image, var(--western-fullscreen_btn-hover-image, var(--western-fullscreen_btn-normal-image)));
    filter: brightness(0.94);
    transform: translateY(1px);
}

#gal-global-overlay.skin-western .gal-bgm-widget {
    background-color: rgba(44, 28, 18, 0.88) !important;
    background-image: var(--western-bgm_widget-normal-image) !important;
    background-size: var(--western-bgm_widget-bg-size, 100% 100%) !important;
    width: var(--western-bgm_widget-width, auto) !important;
    height: var(--western-bgm_widget-height, auto) !important;
    transform: translate(
      calc(var(--western-bgm_widget-offset-x, 0px) + var(--western-bgm_widget-anchor-x, 0px)),
      calc(var(--western-bgm_widget-offset-y, 0px) + var(--western-bgm_widget-anchor-y, 0px))
    ) !important;
    color: #f5e7c8 !important;
}

#gal-global-overlay.skin-western .gal-progress-bar {
    background: linear-gradient(90deg, #6b4f0a, #c9a84c, #8b6914) !important;
    box-shadow: 0 0 8px rgba(232, 168, 76, 0.25) !important;
}

/* =========================================================
   3. 心之怪盗 (Persona) — Neubrutalism
   基于: Style #38/#54 Neubrutalism
   配色: P5 Red #E60012, Black #000, White #FFF
   规则: 粗边框 3px, 硬阴影 4px 4px 0, 0px 圆角
   ========================================================= */
#gal-global-overlay.skin-persona { font-family: "Impact", "Arial Black", "Noto Sans SC", sans-serif; }
#gal-global-overlay.skin-persona .gal-text-panel {
    background: rgba(0, 0, 0, var(--panel-opacity, 0.95)) !important;
    background-image: none !important;
    border: 3px solid #fff !important;
    border-radius: 0 !important;
    box-shadow: 6px 6px 0 #E60012 !important;
    filter: none !important;
}
#gal-global-overlay.skin-persona .gal-dialog-text {
    color: #fff !important;
    font-weight: 900 !important;
    letter-spacing: 1px !important;
    text-shadow: 2px 2px 0 #E60012 !important;
    line-height: 2 !important;
}
#gal-global-overlay.skin-persona .gal-name-badge {
    background: #E60012 !important;
    color: #fff !important;
    transform: skew(-8deg) scale(var(--ui-scale)) !important;
    box-shadow: 4px 4px 0 #000 !important;
    border: 3px solid #fff !important;
    border-radius: 0 !important;
    left: 15px !important; top: -22px !important;
    padding: 0.4rem 2rem !important;
}
#gal-global-overlay.skin-persona .gal-name-badge span {
    font-style: italic; letter-spacing: 3px; font-size: 1.3rem !important; text-shadow: none !important;
}
#gal-global-overlay.skin-persona .gal-action-btn,
#gal-global-overlay.skin-persona .gal-footer-btn,
#gal-global-overlay.skin-persona .gal-pending-choices-btn {
    background: #000 !important;
    color: #fff !important;
    border: 3px solid #fff !important;
    transform: skew(-8deg) !important;
    box-shadow: 4px 4px 0 #E60012 !important;
    border-radius: 0 !important;
    font-weight: 900 !important;
    text-transform: uppercase;
    transition: all 0.15s ease !important;
}
#gal-global-overlay.skin-persona .gal-footer-btn-next {
    background: #E60012 !important;
    color: #fff !important;
    border: 3px solid #fff !important;
    transform: skew(-8deg) !important;
    box-shadow: 4px 4px 0 #000 !important;
    border-radius: 0 !important;
    font-weight: 900 !important;
    font-size: 1.1rem !important;
    text-transform: uppercase;
    transition: all 0.15s ease !important;
}
#gal-global-overlay.skin-persona .gal-footer-btn:hover,
#gal-global-overlay.skin-persona .gal-action-btn:hover,
#gal-global-overlay.skin-persona .gal-pending-choices-btn:hover {
    background: #fff !important; color: #E60012 !important; border-color: #000 !important;
    box-shadow: 4px 4px 0 #000 !important;
}
#gal-global-overlay.skin-persona .gal-footer-btn-next:hover {
    background: #fff !important; color: #E60012 !important; border-color: #E60012 !important;
    box-shadow: 4px 4px 0 #E60012 !important;
}
#gal-global-overlay.skin-persona .gal-footer-btn:active,
#gal-global-overlay.skin-persona .gal-action-btn:active,
#gal-global-overlay.skin-persona .gal-pending-choices-btn:active,
#gal-global-overlay.skin-persona .gal-footer-btn-next:active {
    transform: skew(-8deg) translate(4px, 4px) !important; box-shadow: 0 0 0 transparent !important;
}
#gal-global-overlay.skin-persona .gal-progress-bar { background: #E60012 !important; box-shadow: none !important; }
#gal-global-overlay.skin-persona .gal-interaction-bar { right: 10px !important; }

/* =========================================================
   4. 苍穹之庭 (JRPG) — Glassmorphism
   基于: Style #3 Glassmorphism + Style #10 Aurora UI
   配色: Translucent white, Crystal Blue #57C7FF, Gold #D4AF37
   规则: blur(10-20px), 1px 白边, 透明叠层
   ========================================================= */
#gal-global-overlay.skin-jrpg .gal-dialog-layer { bottom: 2rem !important; }
#gal-global-overlay.skin-jrpg .gal-text-panel {
    background: rgba(10, 14, 39, calc(var(--panel-opacity, 0.55) - 0.2)) !important;
    background-image: none !important;
    backdrop-filter: blur(16px) saturate(180%) !important;
    -webkit-backdrop-filter: blur(16px) saturate(180%) !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    border-top: 2px solid #D4AF37 !important;
    border-radius: 12px !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
}
#gal-global-overlay.skin-jrpg .gal-dialog-text {
    color: #FDFDFD !important;
    text-shadow: 0 1px 4px rgba(0,0,0,0.7) !important;
    line-height: 1.9 !important;
    letter-spacing: 0.5px;
    font-weight: 400 !important;
}
#gal-global-overlay.skin-jrpg .gal-name-badge {
    background: linear-gradient(135deg, rgba(87,199,255,0.9), rgba(212,175,55,0.9)) !important;
    color: #0A0E27 !important;
    border-radius: 16px !important;
    box-shadow: 0 4px 12px rgba(87,199,255,0.35) !important;
    border: 1px solid rgba(255,255,255,0.6) !important;
    padding: 0.4rem 2rem !important;
    left: 15px !important; top: -18px !important;
}
#gal-global-overlay.skin-jrpg .gal-name-badge span {
    text-shadow: none !important; font-weight: 800; letter-spacing: 1.5px;
}
#gal-global-overlay.skin-jrpg .gal-action-btn,
#gal-global-overlay.skin-jrpg .gal-footer-btn,
#gal-global-overlay.skin-jrpg .gal-pending-choices-btn {
    border-radius: 20px !important;
    background: rgba(255,255,255,0.1) !important;
    color: #57C7FF !important;
    border: 1px solid rgba(87,199,255,0.4) !important;
    box-shadow: none !important;
    backdrop-filter: blur(8px) !important;
    transition: all 0.25s ease-out !important;
    font-weight: 600 !important;
}
#gal-global-overlay.skin-jrpg .gal-footer-btn-next {
    border-radius: 20px !important;
    background: linear-gradient(135deg, #57C7FF, #2563EB) !important;
    border: 1px solid rgba(255,255,255,0.5) !important;
    box-shadow: 0 4px 16px rgba(87,199,255,0.4) !important;
    color: #fff !important;
    font-weight: 800 !important;
    transition: all 0.25s ease-out !important;
}
#gal-global-overlay.skin-jrpg .gal-footer-btn:hover,
#gal-global-overlay.skin-jrpg .gal-action-btn:hover,
#gal-global-overlay.skin-jrpg .gal-pending-choices-btn:hover {
    background: rgba(87,199,255,0.2) !important; color: #fff !important; border-color: rgba(255,255,255,0.5) !important;
    transform: translateY(-2px) !important;
}
#gal-global-overlay.skin-jrpg .gal-footer-btn-next:hover {
    box-shadow: 0 6px 20px rgba(87,199,255,0.6) !important;
    transform: translateY(-2px) !important;
}
#gal-global-overlay.skin-jrpg .gal-footer-btn:active,
#gal-global-overlay.skin-jrpg .gal-action-btn:active,
#gal-global-overlay.skin-jrpg .gal-pending-choices-btn:active,
#gal-global-overlay.skin-jrpg .gal-footer-btn-next:active {
    transform: translateY(1px) !important; box-shadow: none !important;
}
#gal-global-overlay.skin-jrpg .gal-progress-bar { background: linear-gradient(90deg, #D4AF37, #FFD700) !important; box-shadow: 0 0 6px rgba(212,175,55,0.4) !important; }
#gal-global-overlay.skin-jrpg .gal-interaction-bar { right: 10px !important; }

/* =========================================================
   5. 樱色物语 (Classic) — 樱花清新风格
   灵感: 樱花飘落 · 春日朝雾 · 和风清雅
   配色: 雪见樱 #F8C8D4, 花信 #E8A2B6, 朝雾 #FFF8F5,
         深梅 #6B3A5E, 花叶 #7A9E7E, 暮藤 #9C7AAD
   ========================================================= */
#gal-global-overlay.skin-classic .gal-text-panel {
    background: rgba(255, 248, 245, var(--panel-opacity, 0.92)) !important;
    background-image: none !important;
    border: calc(2px * var(--ui-scale, 1)) solid rgba(232, 162, 182, 0.5) !important;
    border-radius: calc(14px * var(--ui-scale, 1)) !important;
    box-shadow:
        inset 0 0 calc(30px * var(--ui-scale, 1)) rgba(248, 200, 212, 0.15),
        0 calc(4px * var(--ui-scale, 1)) calc(16px * var(--ui-scale, 1)) rgba(107, 58, 94, 0.08),
        0 calc(8px * var(--ui-scale, 1)) calc(32px * var(--ui-scale, 1)) rgba(248, 200, 212, 0.12) !important;
}
#gal-global-overlay.skin-classic .gal-dialog-text {
    color: #4A2D3E !important;
    font-weight: 500 !important;
    line-height: 1.9 !important;
    text-shadow: 0 1px 0 rgba(255,255,255,0.6) !important;
    letter-spacing: 0.3px;
}
#gal-global-overlay.skin-classic .gal-name-badge {
    background: linear-gradient(135deg, #E8A2B6, #D4849E) !important;
    color: #fff !important;
    border-radius: calc(20px * var(--ui-scale, 1)) !important;
    border: calc(2px * var(--ui-scale, 1)) solid rgba(255,255,255,0.7) !important;
    box-shadow:
        0 calc(3px * var(--ui-scale, 1)) calc(10px * var(--ui-scale, 1)) rgba(232,162,182,0.25),
        inset 0 1px 0 rgba(255,255,255,0.4) !important;
    left: 25px !important; top: -20px !important;
    padding: calc(0.4rem * var(--ui-scale, 1)) calc(2rem * var(--ui-scale, 1)) !important;
}
#gal-global-overlay.skin-classic .gal-name-badge span {
    text-shadow: 0 1px 3px rgba(107,58,94,0.3); font-weight: 700; letter-spacing: 1.5px;
}
#gal-global-overlay.skin-classic .gal-action-btn,
#gal-global-overlay.skin-classic .gal-footer-btn,
#gal-global-overlay.skin-classic .gal-pending-choices-btn {
    border-radius: calc(10px * var(--ui-scale, 1)) !important;
    background: rgba(255, 248, 245, 0.9) !important;
    color: #7A5A6E !important;
    border: calc(2px * var(--ui-scale, 1)) solid rgba(232, 162, 182, 0.45) !important;
    box-shadow:
        0 calc(2px * var(--ui-scale, 1)) calc(6px * var(--ui-scale, 1)) rgba(248,200,212,0.2),
        inset 0 1px 0 rgba(255,255,255,0.6) !important;
    transition: all 0.2s ease-out !important;
    font-weight: 600 !important;
}
#gal-global-overlay.skin-classic .gal-footer-btn-next {
    border-radius: calc(10px * var(--ui-scale, 1)) !important;
    background: linear-gradient(135deg, #E8A2B6, #D4849E) !important;
    color: #fff !important;
    border: calc(2px * var(--ui-scale, 1)) solid rgba(255,255,255,0.5) !important;
    box-shadow:
        0 calc(3px * var(--ui-scale, 1)) calc(10px * var(--ui-scale, 1)) rgba(232,162,182,0.3),
        inset 0 1px 0 rgba(255,255,255,0.3) !important;
    font-weight: 700 !important;
    transition: all 0.2s ease-out !important;
}
#gal-global-overlay.skin-classic .gal-footer-btn:hover,
#gal-global-overlay.skin-classic .gal-action-btn:hover,
#gal-global-overlay.skin-classic .gal-pending-choices-btn:hover {
    background: rgba(248, 200, 212, 0.25) !important;
    border-color: #D4849E !important;
    color: #6B3A5E !important;
}
#gal-global-overlay.skin-classic .gal-footer-btn-next:hover {
    background: linear-gradient(135deg, #D4849E, #C07090) !important;
    box-shadow:
        0 calc(4px * var(--ui-scale, 1)) calc(14px * var(--ui-scale, 1)) rgba(212,132,158,0.4),
        inset 0 1px 0 rgba(255,255,255,0.4) !important;
}
#gal-global-overlay.skin-classic .gal-action-btn:active,
#gal-global-overlay.skin-classic .gal-footer-btn:active,
#gal-global-overlay.skin-classic .gal-pending-choices-btn:active,
#gal-global-overlay.skin-classic .gal-footer-btn-next:active {
    transform: translateY(2px) !important; box-shadow: inset 0 2px 4px rgba(107,58,94,0.15) !important;
}
#gal-global-overlay.skin-classic .gal-progress-bar { background: linear-gradient(90deg, #E8A2B6, #D4849E) !important; box-shadow: none !important; }

/* === 非默认皮肤移动端：设置/LOG 合体菜单适配 === */
@media screen and (max-width: 48rem), screen and (max-height: 46rem) {
    #gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-footer-btn .gal-btn-text,
    #gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-pending-choices-btn .gal-btn-text,
    #gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-footer-btn-next .gal-btn-text {
        display: none !important;
    }

    #gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-footer-btn[data-action='log'],
    #gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-footer-btn[data-action='view-original'],
    #gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-footer-btn[data-action='save'],
    #gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-footer-btn[data-action='load'] {
        display: none !important;
    }

    #gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-footer-btn[data-action='close-mode'] {
        order: -1 !important;
    }

    #gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-bottom-toolbar {
        justify-content: flex-start !important;
        gap: 0.3rem !important;
        padding: 0 0.875rem 0.5rem 0.5rem !important;
        overflow: visible !important;
    }

    #gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-footer-btn,
    #gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-pending-choices-btn {
        flex: 1 !important;
        width: auto !important;
        min-width: 0 !important;
        height: 2.5rem !important;
        min-height: 2.5rem !important;
        margin-left: 0 !important;
        padding: 0 !important;
        justify-content: center !important;
        transform: none !important;
    }

    #gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-footer-btn i,
    #gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-pending-choices-btn i {
        margin: 0 !important;
        font-size: 1.15rem !important;
    }

    #gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-footer-btn-next {
        flex: 0 0 auto !important;
        width: 5rem !important;
        min-width: 5rem !important;
        height: 2.5rem !important;
        min-height: 2.5rem !important;
        margin-left: 0.35rem !important;
        margin-right: 0 !important;
        padding: 0 !important;
        justify-content: center !important;
        transform: none !important;
        z-index: 100 !important;
    }

    #gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-footer-btn-next i {
        margin: 0 !important;
        font-size: 1.6rem !important;
    }
}

/* === 对话字体最终兜底：始终由设置项控制 === */
#gal-global-overlay .gal-dialog-text,
#gal-global-overlay[class*="skin-"] .gal-dialog-text {
    font-family: var(--gal-dialog-font-family, "Noto Sans SC","PingFang SC","Microsoft YaHei","Helvetica Neue",Arial,sans-serif) !important;
}

/* === 减少运动偏好支持 === */
@media (prefers-reduced-motion: reduce) {
    #gal-global-overlay[class*="skin-"] *,
    #gal-global-overlay[class*="skin-"] *::before,
    #gal-global-overlay[class*="skin-"] *::after {
        animation: none !important;
        transition-duration: 0.01ms !important;
    }
}
`;


  // ============================================
  // Styled 情境内容样式
  // ============================================
  const styledCss = `

/* === Styled 舞台布局 === */
.gal-styled-stage {
    position: absolute;
    inset: 0;
    z-index: 50; /* Above dolls and bg, below system UI */
    display: none;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    opacity: 0;
    transition: opacity 0.4s ease;
    padding: 20px;
}
.gal-styled-stage.show {
    display: flex;
    opacity: 1;
}
.gal-styled-stage-content {
    width: 100%;
    max-width: 600px;
    max-height: 85vh;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    z-index: 51;
    perspective: 1000px;
    overflow: visible;
}

/* === Styled 通用基础 === */
.gal-dialog-text .gal-styled,
.gal-styled-stage-content .gal-styled {
    width: 100%;
    box-sizing: border-box;
    font-size: 1rem;
    line-height: 1.6;
    animation: gal-styled-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    transform-origin: center;
}
@keyframes gal-styled-pop {
    from { opacity: 0; transform: translateY(20px) scale(0.95) rotateX(10deg); }
    to { opacity: 1; transform: translateY(0) scale(1) rotateX(0); }
}

/* =========================================================
   1. 手机短信 / 微信 (SMS / WeChat) - Modern Glassmorphism
   ========================================================= */
.gal-styled-stage-content .gal-styled-sms {
    background: rgba(245, 245, 247, 0.95) !important;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 20px;
    padding: 0;
    overflow: hidden;
    max-height: 75vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.05);
    width: 100%; max-width: 400px; /* Limit width for phones */
}
.gal-sms-header {
    background: rgba(255, 255, 255, 0.85);
    border-bottom: 1px solid rgba(0,0,0,0.08);
    color: #1a1a1b;
    padding: 14px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 1rem;
    flex-shrink: 0;
}
.gal-sms-contact { font-weight: 700; letter-spacing: 0.2px; }
.gal-sms-time { font-size: 0.8rem; color: #8e8e93; font-weight: 500; }
.gal-sms-body {
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
    flex: 1;
    background: #f0f0f5;
}
.gal-sms-row { display: flex; flex-direction: column; max-width: 85%; }
.gal-sms-row-other { align-self: flex-start; align-items: flex-start; }
.gal-sms-row-self { align-self: flex-end; align-items: flex-end; }
.gal-sms-name { font-size: 0.75rem; color: #8e8e93; margin-bottom: 4px; padding-left: 12px; }
.gal-sms-bubble-other, .gal-sms-bubble-self {
    padding: 10px 16px; border-radius: 18px; font-size: 0.95rem;
    line-height: 1.4; word-break: break-word;
    box-shadow: 0 2px 5px rgba(0,0,0,0.04);
}
.gal-sms-bubble-other { 
    background: #ffffff; 
    color: #000000; 
    border-bottom-left-radius: 4px; 
}
.gal-sms-bubble-self { 
    background: #007aff; 
    color: #ffffff; 
    border-bottom-right-radius: 4px; 
}

/* =========================================================
   2. 信纸 / 信件 (Letter) - Elegant Craft Paper
   ========================================================= */
.gal-styled-stage-content .gal-styled-letter {
    background: #fffdf5;
    background-image: 
        linear-gradient(90deg, transparent 40px, #e8a0a0 40px, #e8a0a0 42px, transparent 42px),
        linear-gradient(#e1e6f0 1px, transparent 1px);
    background-size: 100% 28px;
    background-position: 0 40px;
    border-radius: 6px;
    padding: 60px 40px 40px 60px !important;
    position: relative;
    box-shadow: 0 15px 35px rgba(0,0,0,0.15), 0 5px 15px rgba(0,0,0,0.05);
    max-height: 80vh; overflow-y: auto;
    width: 100%;
}
.gal-letter-header {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 28px; position: relative; z-index: 1;
}
.gal-letter-to {
    font-weight: 700; color: #2c3e50; font-size: 1.2rem;
    font-family: "LXGW WenKai Screen", "KaiTi", "STKaiti", cursive;
}
.gal-letter-date { font-size: 0.9rem; color: #7f8c8d; font-style: italic; }
.gal-letter-body { position: relative; z-index: 1; }
.gal-letter-line {
    margin: 0; 
    height: 28px; /* Must match background-size Y */
    line-height: 28px;
    text-indent: 2em; color: #34495e;
    font-family: "LXGW WenKai Screen", "KaiTi", "STKaiti", cursive;
    font-size: 1.05rem; letter-spacing: 0.5px;
}
.gal-letter-signature {
    text-align: right; margin-top: 28px; color: #2c3e50;
    font-weight: 700;
    font-family: "LXGW WenKai Screen", "KaiTi", "STKaiti", cursive;
    font-size: 1.2rem; position: relative; z-index: 1;
}

/* =========================================================
   3. 羊皮纸 / 古卷 (Parchment) - Fantasy RPG
   ========================================================= */
.gal-styled-stage-content .gal-styled-parchment {
    background: #e8d1a7;
    background-image: 
        radial-gradient(circle at 20% 30%, rgba(139,119,80,0.08) 0%, transparent 40%),
        radial-gradient(circle at 80% 80%, rgba(139,119,80,0.1) 0%, transparent 50%);
    border: 1px solid rgba(139,119,80,0.5);
    border-radius: 8px 12px 6px 15px;
    padding: 40px 50px !important;
    position: relative;
    box-shadow: 
        0 20px 40px rgba(0,0,0,0.3), 
        inset 0 0 60px rgba(139,119,80,0.3),
        inset 0 0 10px rgba(100,60,20,0.5);
    max-height: 80vh; overflow-y: auto;
    filter: drop-shadow(0 0 10px rgba(0,0,0,0.5));
}
.gal-styled-stage-content .gal-styled-parchment::before {
    content: ''; position: absolute;
    top: 10px; left: 10px; right: 10px; bottom: 10px;
    border: 1px solid rgba(139,119,80,0.4); 
    border-radius: 4px; pointer-events: none;
}
.gal-parchment-title {
    text-align: center; font-family: "Noto Serif SC", "KaiTi", "STKaiti", serif;
    font-size: 1.8rem; font-weight: 900; color: #4a331a;
    margin-bottom: 20px; padding-bottom: 15px;
    border-bottom: 2px solid rgba(74, 51, 26, 0.4);
    letter-spacing: 4px; text-shadow: 1px 1px 0 rgba(255,255,255,0.4);
    position: relative; z-index: 1;
}
.gal-parchment-body { position: relative; z-index: 1; }
.gal-parchment-line {
    margin: 0 0 10px; text-indent: 2em; color: #3c2a14;
    font-family: "Noto Serif SC", "KaiTi", "STKaiti", serif;
    font-size: 1.1rem; line-height: 1.9;
    text-shadow: 0 1px 0 rgba(255,255,255,0.2);
    font-weight: 500;
}
.gal-parchment-seal {
    text-align: center; margin-top: 30px; padding-top: 15px;
    color: #a52a2a; font-family: "Noto Serif SC", "KaiTi", "STKaiti", serif;
    font-weight: 900; font-size: 1.4rem; letter-spacing: 6px;
    text-shadow: 0 1px 1px rgba(0,0,0,0.2); position: relative; z-index: 1;
    opacity: 0.85; border-top: 1px solid rgba(74, 51, 26, 0.2);
}

/* =========================================================
   4. 新闻 / 报纸 (Newspaper) - Vintage Print
   ========================================================= */
.gal-styled-stage-content .gal-styled-newspaper {
    background: #f4efdf;
    border: 8px solid #f4efdf;
    border-radius: 2px;
    padding: 20px 25px !important; 
    position: relative;
    box-shadow: 0 15px 40px rgba(0,0,0,0.2);
    max-height: none;
    overflow-y: visible;
    color: #1a1a1a;
    outline: 1px solid #2b2b2b;
    outline-offset: -8px;
    width: 100%; max-width: 650px;
}
.gal-newspaper-headline {
    font-family: "Noto Serif SC", "Georgia", "Times New Roman", serif;
    font-size: 2.2rem; font-weight: 900; color: #1a1a1a; text-align: center;
    margin: 0 0 15px; line-height: 1.2; letter-spacing: 1px;
    padding-bottom: 15px; border-bottom: 3px double #1a1a1a;
}
.gal-newspaper-meta {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0 0 10px; border-bottom: 1px solid #1a1a1a;
    margin-bottom: 15px; font-size: 0.85rem; color: #333;
    font-family: "Noto Serif SC", serif; text-transform: uppercase;
}
.gal-newspaper-source { font-weight: 900; }
.gal-newspaper-date { font-weight: 500; }
.gal-newspaper-body { 
    columns: 2; column-gap: 25px; column-rule: 1px solid rgba(0,0,0,0.2); 
    text-align: justify; hyphens: auto;
}
.gal-newspaper-paragraph {
    margin: 0 0 12px; text-indent: 2em; color: #2a2a2a;
    font-family: "Noto Serif SC", "Georgia", "Times New Roman", serif;
    font-size: 0.95rem; line-height: 1.7; break-inside: avoid;
}
.gal-newspaper-paragraph:first-of-type::first-letter {
    font-size: 3rem; line-height: 1; float: left; margin: 0 8px 0 0;
    font-weight: 900; color: #1a1a1a; font-family: "Georgia", serif;
}

/* =========================================================
   5. 电脑终端 (Terminal) - Tech Noir
   ========================================================= */
.gal-styled-stage-content .gal-styled-terminal {
    background: rgba(13, 17, 23, 0.95) !important;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(48, 54, 61, 1);
    border-radius: 10px;
    overflow: hidden;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 15px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05);
    font-family: "Cascadia Code", "Fira Code", "Consolas", monospace;
    width: 100%; max-width: 600px;
}
.gal-terminal-titlebar {
    background: #161b22;
    border-bottom: 1px solid #30363d;
    padding: 10px 15px;
    display: flex;
    align-items: center;
    gap: 10px;
}
.gal-terminal-dots { display: flex; gap: 6px; }
.gal-terminal-dots i { width: 12px; height: 12px; border-radius: 50%; }
.gal-terminal-dots i:nth-child(1) { background: #ff5f56; }
.gal-terminal-dots i:nth-child(2) { background: #ffbd2e; }
.gal-terminal-dots i:nth-child(3) { background: #27c93f; }
.gal-terminal-title {
    color: #8b949e; font-size: 0.85rem; font-weight: 600; text-align: center; flex: 1; margin-right: 48px;
}
.gal-terminal-body {
    padding: 20px; overflow-y: auto; flex: 1;
    box-shadow: inset 0 0 50px rgba(0,255,0,0.02);
}
.gal-terminal-line {
    color: #56d364; font-size: 0.9rem; line-height: 1.6; margin-bottom: 4px;
    text-shadow: 0 0 3px rgba(86, 211, 100, 0.4);
}
.gal-terminal-prompt { color: #58a6ff; font-weight: 700; }
.gal-terminal-cursor {
    color: #56d364; font-weight: bold; animation: gal-blink 1s step-end infinite;
}

/* =========================================================
   6. 便签 / 纸条 (Sticky Note) - Realistic 3D Post-it
   ========================================================= */
.gal-styled-stage-content .gal-styled-note {
    background: #fff68f;
    background-image: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%, rgba(0,0,0,0.02) 100%);
    border-radius: 2px 2px 15px 4px;
    padding: 30px 25px 20px !important;
    position: relative;
    box-shadow: 
        5px 8px 15px rgba(0,0,0,0.15), 
        inset -5px -5px 15px rgba(0,0,0,0.04);
    transform: rotate(-2deg);
    max-height: 60vh; overflow-y: auto;
    width: 100%; max-width: 350px;
}
.gal-styled-stage-content .gal-styled-note::before {
    content: ''; position: absolute;
    top: -10px; left: 50%; transform: translateX(-50%);
    width: 100px; height: 25px;
    background: rgba(255,255,255,0.4);
    border: 1px solid rgba(0,0,0,0.05);
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    backdrop-filter: blur(2px);
    z-index: 2;
    transform-origin: center;
    transform: translateX(-50%) rotate(1deg);
}
.gal-note-line {
    margin: 0 0 6px; color: #2c3e50;
    font-family: "LXGW WenKai Screen", "Comic Sans MS", cursive;
    font-size: 1.1rem; line-height: 1.6; font-weight: 500;
}
.gal-note-sign {
    text-align: right; margin-top: 20px; color: #34495e;
    font-family: "LXGW WenKai Screen", cursive;
    font-style: italic; font-size: 1rem; font-weight: 700;
}

/* =========================================================
   7. 日记 (Diary / Journal) - Rich Leather Bound
   ========================================================= */
.gal-styled-stage-content .gal-styled-diary {
    background: #fdfbf7;
    border: 1px solid #d4c5b0;
    border-left: 20px solid #5d4037; /* Leather spine */
    border-radius: 4px 12px 12px 4px;
    padding: 25px 35px 25px 25px !important;
    position: relative;
    box-shadow: 
        10px 10px 30px rgba(0,0,0,0.2), 
        inset 5px 0 10px rgba(0,0,0,0.05);
    max-height: 75vh; overflow-y: auto;
    width: 100%; max-width: 480px;
}
.gal-styled-stage-content .gal-styled-diary::before {
    content: ''; position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: repeating-linear-gradient(
        transparent 0px, transparent 29px,
        rgba(160,140,120,0.2) 29px, rgba(160,140,120,0.2) 30px
    );
    pointer-events: none; z-index: 0;
}
.gal-diary-header {
    display: flex; justify-content: space-between; align-items: flex-end;
    margin-bottom: 25px; padding-bottom: 10px;
    border-bottom: 2px solid #5d4037;
    position: relative; z-index: 1;
}
.gal-diary-date {
    font-family: "LXGW WenKai Screen", "KaiTi", cursive;
    font-weight: 700; color: #3e2723; font-size: 1.2rem;
}
.gal-diary-mood {
    font-size: 1rem; color: #795548; font-style: italic; font-weight: 600;
}
.gal-diary-body { position: relative; z-index: 1; }
.gal-diary-line {
    margin: 0; height: 30px; line-height: 30px; /* Aligns with background lines */
    text-indent: 1.5em; color: #3e2723;
    font-family: "LXGW WenKai Screen", "KaiTi", cursive;
    font-size: 1.05rem;
}

/* =========================================================
   8. 公告 / 通知 (Bulletin / Notice) - Official Document
   ========================================================= */
.gal-styled-stage-content .gal-styled-bulletin {
    background: #ffffff;
    border: 1px solid #e0e0e0;
    border-top: 8px solid #c0392b;
    border-radius: 6px;
    padding: 0 !important;
    overflow: hidden;
    max-height: 80vh;
    box-shadow: 0 10px 30px rgba(0,0,0,0.15);
    width: 100%; max-width: 550px;
}
.gal-bulletin-header {
    background: #fdfdfd;
    color: #c0392b;
    padding: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
    border-bottom: 2px solid #c0392b;
}
.gal-bulletin-icon { font-size: 1.8rem; }
.gal-bulletin-title {
    font-weight: 900; font-size: 1.6rem; letter-spacing: 2px;
}
.gal-bulletin-meta {
    display: flex; justify-content: space-between;
    padding: 10px 20px;
    font-size: 0.9rem; color: #7f8c8d; font-weight: 600;
    border-bottom: 1px solid #ecf0f1; background: #fafafa;
}
.gal-bulletin-body {
    padding: 25px 30px; overflow-y: auto; background: #fff;
}
.gal-bulletin-line {
    margin: 0 0 15px; text-indent: 2.5em; color: #2c3e50;
    font-size: 1.05rem; line-height: 1.8; font-weight: 500;
}

/* === Styled 回退样式 === */
.gal-styled-stage-content .gal-styled-fallback {
    background: rgba(255,255,255,0.9); border: 1px solid rgba(0,0,0,0.1);
    border-radius: 12px; padding: 25px 30px !important;
    color: #333; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
}
.gal-styled-fallback-title { font-weight: 800; margin-bottom: 15px; font-size: 1.3rem; border-bottom: 1px solid #eee; padding-bottom: 10px;}
.gal-styled-fallback p { margin: 0 0 10px; line-height: 1.7; font-size: 1rem; }

/* === Styled 皮肤适配 === */
#gal-global-overlay.skin-ancient .gal-styled-letter .gal-letter-line,
#gal-global-overlay.skin-ancient .gal-styled-parchment .gal-parchment-line {
    font-family: "KaiTi", "STKaiti", "楷体", serif !important;
}
`;

const saveLoadCss = `

#gal-save-load-modal.gal-save-load-modal {
    z-index: 16000;
}
#gal-save-load-modal .gal-save-load-box {
    width: min(92vw, 980px);
    max-height: min(88vh, 860px);
    display: flex;
    flex-direction: column;
    background: var(--SmartThemeBlurTintColor, rgba(20, 24, 32, 0.92));
    color: var(--SmartThemeBodyColor, #f5f7fa);
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
    border-radius: 14px;
    box-shadow: 0 16px 44px rgba(0, 0, 0, 0.42);
    overflow: hidden;
}
#gal-save-load-modal .gal-save-load-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
}
#gal-save-load-modal .gal-save-load-title {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 1.02rem;
    font-weight: 700;
    color: var(--SmartThemeEmColor, #9ac7ff);
}
#gal-save-load-modal .gal-save-load-close {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
    background: rgba(255, 255, 255, 0.06);
    color: var(--SmartThemeBodyColor, #f5f7fa);
    cursor: pointer;
}
#gal-save-load-modal .gal-save-load-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 16px 16px;
    min-height: 320px;
}
#gal-save-load-modal .gal-save-load-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
}
#gal-save-load-modal .gal-save-control-btn {
    height: 38px;
    border-radius: 10px;
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
    background: rgba(255, 255, 255, 0.07);
    color: var(--SmartThemeBodyColor, #f5f7fa);
    padding: 0 12px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-weight: 600;
}
#gal-save-load-modal .gal-save-control-btn.primary {
    background: rgba(103, 181, 255, 0.26);
    border-color: rgba(154, 199, 255, 0.78);
}
#gal-save-load-modal .gal-save-control-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
#gal-save-load-modal .gal-save-slot-list {
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-right: 4px;
}
#gal-save-load-modal .gal-save-empty {
    min-height: 140px;
    border: 1px dashed var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
    border-radius: 10px;
    color: var(--SmartThemeBodyColor, #f5f7fa);
    opacity: 0.85;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}
#gal-save-load-modal .gal-save-slot-card {
    display: grid;
    grid-template-columns: 148px 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 10px;
    border-radius: 10px;
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
    background: rgba(255, 255, 255, 0.05);
}
#gal-save-load-modal .gal-save-thumb-wrap {
    width: 148px;
    aspect-ratio: 16 / 9;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
    background: rgba(15, 23, 42, 0.72);
}
#gal-save-load-modal .gal-save-thumb-image {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
}
#gal-save-load-modal .gal-save-thumb-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: var(--SmartThemeBodyColor, #f5f7fa);
    opacity: 0.82;
    font-size: 0.84rem;
}
#gal-save-load-modal .gal-save-slot-info {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 7px;
}
#gal-save-load-modal .gal-save-slot-title-row {
    display: inline-flex;
    gap: 8px;
    align-items: center;
}
#gal-save-load-modal .gal-save-slot-title {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.97rem;
    font-weight: 700;
    color: var(--SmartThemeBodyColor, #f5f7fa);
}
#gal-save-load-modal .gal-save-slot-badge {
    font-size: 0.74rem;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid rgba(154, 199, 255, 0.78);
    color: var(--SmartThemeEmColor, #9ac7ff);
}
#gal-save-load-modal .gal-save-slot-meta {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 10px;
    color: var(--SmartThemeBodyColor, #f5f7fa);
    opacity: 0.88;
    font-size: 0.83rem;
}
#gal-save-load-modal .gal-save-slot-char {
    color: var(--SmartThemeEmColor, #9ac7ff);
    font-weight: 600;
}
#gal-save-load-modal .gal-save-slot-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
#gal-save-load-modal .gal-save-slot-btn {
    min-width: 88px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
    background: rgba(255, 255, 255, 0.07);
    color: var(--SmartThemeBodyColor, #f5f7fa);
    cursor: pointer;
}
#gal-save-load-modal .gal-save-slot-btn.primary {
    background: rgba(103, 181, 255, 0.26);
    border-color: rgba(154, 199, 255, 0.78);
}
#gal-save-load-modal .gal-save-slot-btn.danger {
    background: rgba(239, 68, 68, 0.22);
    border-color: rgba(248, 113, 113, 0.72);
}

/* 输入控件三态：默认/placeholder/focus（主题变量 + 回退值） */
#gal-save-load-modal .gal-save-label-input,
#gal-save-load-modal input[type='text'],
#gal-save-load-modal textarea,
#gal-save-load-modal select {
    min-width: 260px;
    height: 38px;
    border-radius: 10px;
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
    background: var(--SmartThemeBlurTintColor, rgba(20, 24, 32, 0.92));
    color: var(--SmartThemeBodyColor, #f5f7fa);
    padding: 0 12px;
    outline: none;
    box-sizing: border-box;
}
#gal-save-load-modal .gal-save-label-input::placeholder,
#gal-save-load-modal input[type='text']::placeholder,
#gal-save-load-modal textarea::placeholder,
#gal-save-load-modal select::placeholder {
    color: rgba(245, 247, 250, 0.72);
}
#gal-save-load-modal .gal-save-label-input:focus,
#gal-save-load-modal input[type='text']:focus,
#gal-save-load-modal textarea:focus,
#gal-save-load-modal select:focus {
    border-color: rgba(154, 199, 255, 0.86);
    box-shadow: 0 0 0 3px rgba(154, 199, 255, 0.22);
}

@media (max-width: 760px) {
    #gal-save-load-modal .gal-save-load-box {
        width: min(96vw, 720px);
        max-height: 92vh;
    }
    #gal-save-load-modal .gal-save-slot-card {
        grid-template-columns: 1fr;
        gap: 10px;
    }
    #gal-save-load-modal .gal-save-thumb-wrap {
        width: 100%;
        max-width: 360px;
    }
    #gal-save-load-modal .gal-save-slot-actions {
        flex-direction: row;
        flex-wrap: wrap;
    }
    #gal-save-load-modal .gal-save-slot-btn {
        flex: 1;
        min-width: 80px;
    }
    #gal-save-load-modal .gal-save-label-input,
    #gal-save-load-modal input[type='text'],
    #gal-save-load-modal textarea,
    #gal-save-load-modal select {
        min-width: 180px;
        width: 100%;
    }
}
`;

  const titleScreenCss = `

#gal-global-overlay .gal-title-screen {
    position: absolute;
    inset: 0;
    z-index: 140;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 10%;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
    overflow: hidden;
    font-family: var(--SmartThemeFontFamily, "Noto Serif SC", serif);
    isolation: isolate;
    /* 标题页底层强制不透明，避免透明 WebP 露出游玩界面 */
    background: #060a12;
}
#gal-global-overlay .gal-title-screen.active {
    opacity: 1;
    pointer-events: auto;
}

/* Background & Mask */
#gal-global-overlay .gal-title-screen-bg,
#gal-global-overlay .gal-title-screen-mask {
    position: absolute;
    inset: -2%; /* Slight bleed to hide scale edges */
    pointer-events: none;
}
#gal-global-overlay .gal-title-screen-bg {
    background-color: #060a12;
    background-size: cover;
    background-position: center center;
    background-repeat: no-repeat;
    transform: scale(1.08); /* Start slightly zoomed in */
    transition: transform 30s ease-out; /* Slow Ken Burns effect */
    z-index: 1;
}
#gal-global-overlay .gal-title-screen.active .gal-title-screen-bg {
    transform: scale(1);
}
#gal-global-overlay .gal-title-screen-mask {
    background: radial-gradient(circle at 15% 50%, rgba(5, 8, 12, 0.85) 0%, rgba(10, 15, 25, 0.5) 45%, rgba(0, 0, 0, 0) 80%);
    box-shadow: inset 0 0 150px rgba(0,0,0,0.6);
    z-index: 2;
}
#gal-global-overlay .gal-title-screen.no-mask .gal-title-screen-mask {
    display: none;
}

/* Add atmospheric floating light particles using pure CSS */
#gal-global-overlay .gal-title-screen::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: 
        radial-gradient(2px 2px at 20px 30px, #ffffff, rgba(0,0,0,0)),
        radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.8), rgba(0,0,0,0)),
        radial-gradient(2px 2px at 50px 160px, rgba(255,255,255,0.6), rgba(0,0,0,0)),
        radial-gradient(2px 2px at 90px 40px, #ffffff, rgba(0,0,0,0)),
        radial-gradient(2px 2px at 130px 80px, rgba(255,255,255,0.8), rgba(0,0,0,0));
    background-repeat: repeat;
    background-size: 200px 200px;
    opacity: 0;
    z-index: 3;
    animation: galGalacticDrift 60s linear infinite;
    mask-image: linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 60%);
    -webkit-mask-image: linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 60%);
}
#gal-global-overlay .gal-title-screen.active::before {
    opacity: 0.3;
}
@keyframes galGalacticDrift {
    0% { transform: translateY(0) translateX(0); }
    100% { transform: translateY(-200px) translateX(-50px); }
}

/* Content Container */
#gal-global-overlay .gal-title-screen-content {
    position: relative;
    z-index: 10;
    display: flex;
    flex-direction: column;
    height: 100%;
    margin-top: 15vh;
}

/* Title Section */
.gal-title-wrapper {
    position: relative;
    display: inline-block;
    align-self: flex-start;
    transform: translateY(-20px);
    opacity: 0;
    transition: all 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) 0.2s;
}
#gal-global-overlay .gal-title-screen.active .gal-title-wrapper {
    transform: translateY(0);
    opacity: 1;
}
#gal-global-overlay .gal-title-screen-title {\n    margin: 0;\n    font-size: clamp(4rem, 7vw, 6.5rem);\n    font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;\n    font-weight: 900;\n    letter-spacing: 0.05em;\n    color: #ffffff;\n    text-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);\n    line-height: 1.2;\n    position: relative;\n    display: inline-block;\n}\n\n#gal-global-overlay .gal-title-screen-subtitle {\n    margin: 0;\n    padding-left: 0.2em;\n    font-size: clamp(1rem, 2vw, 1.3rem);\n    font-family: inherit;\n    font-weight: 500;\n    letter-spacing: 0.3em;\n    text-transform: uppercase;\n    color: rgba(255, 255, 255, 0.85);\n    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);\n    transform: translateY(0);\n}\n/* Delicate line under title */
#gal-global-overlay .gal-title-screen-subtitle::before {
    content: '';
    display: block;
    width: 60%;
    min-width: 150px;
    height: 1px;
    background: linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,0));
    margin-bottom: 2vh;
    box-shadow: 0 1px 3px rgba(0,0,0,0.8);
}

/* Action Menu Section */
#gal-global-overlay .gal-title-screen-actions {
    margin-top: 8vh;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1.8rem;
}

#gal-global-overlay .gal-title-screen-btn {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.65);
    font-family: inherit;
    font-size: clamp(1.4rem, 2.8vw, 2rem);
    font-weight: 500;
    letter-spacing: 0.3em;
    cursor: pointer;
    padding: 0.5rem 1rem 0.5rem 2.5rem; /* Room for indicator */
    position: relative;
    transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
    text-shadow: 0 4px 8px rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    transform: translateX(-30px);
    opacity: 0;
}
/* Stagger entry animations for buttons */
#gal-global-overlay .gal-title-screen.active .gal-title-screen-btn {
    transform: translateX(0);
    opacity: 1;
}
#gal-global-overlay .gal-title-screen.active .gal-title-screen-btn:nth-child(1) { transition-delay: 0.6s; }
#gal-global-overlay .gal-title-screen.active .gal-title-screen-btn:nth-child(2) { transition-delay: 0.7s; }
#gal-global-overlay .gal-title-screen.active .gal-title-screen-btn:nth-child(3) { transition-delay: 0.8s; }
#gal-global-overlay .gal-title-screen.active .gal-title-screen-btn:nth-child(4) { transition-delay: 0.9s; }

/* Diamond Indicator */
#gal-global-overlay .gal-title-screen-btn::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    margin-top: -6px;
    width: 12px;
    height: 12px;
    background: #fff;
    transform: rotate(45deg) scale(0);
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    box-shadow: 0 0 10px rgba(255,255,255,0.8);
}
/* Hover Glow Trail */
#gal-global-overlay .gal-title-screen-btn::after {
    content: '';
    position: absolute;
    inset: 0;
    left: -100px; /* start outside */
    z-index: 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1) 20%, rgba(255,255,255,0) 80%);
    opacity: 0;
    transform: scaleX(0);
    transform-origin: left;
    transition: all 0.5s ease;
    border-radius: 4px;
}

#gal-global-overlay .gal-title-screen-btn:hover {
    color: #ffffff;
    text-shadow: 0 0 15px rgba(255, 255, 255, 0.5), 0 4px 10px rgba(0,0,0,0.9);
    padding-left: 3.5rem; /* Slide right visually */
}
#gal-global-overlay .gal-title-screen-btn:hover::before {
    transform: rotate(45deg) scale(1);
    opacity: 1;
    left: 1rem;
}
#gal-global-overlay .gal-title-screen-btn:hover::after {
    opacity: 1;
    transform: scaleX(1);
}

#gal-global-overlay .gal-title-screen-btn:active {
    transform: scale(0.96) translateX(5px);
    transition: all 0.1s;
}

/* CG Gallery Layer */
#gal-global-overlay .gal-title-cg-gallery {
    position: absolute;
    inset: 0;
    z-index: 180;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(6, 10, 18, 0.72);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
}
#gal-global-overlay .gal-title-cg-gallery.active {
    display: flex;
}
#gal-global-overlay .gal-title-cg-gallery-panel {
    width: min(1040px, 92vw);
    max-height: 88vh;
    border-radius: 16px;
    background: var(--SmartThemeBlurTintColor, rgba(20, 24, 32, 0.92));
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
    box-shadow: 0 24px 56px rgba(0, 0, 0, 0.45);
    display: flex;
    flex-direction: column;
    color: var(--SmartThemeBodyColor, #f5f7fa);
}
#gal-global-overlay .gal-title-cg-gallery-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 18px 10px;
}
#gal-global-overlay .gal-title-cg-gallery-title {
    font-size: 1.18rem;
    font-weight: 700;
    color: var(--SmartThemeBodyColor, #f5f7fa);
}
#gal-global-overlay .gal-title-cg-gallery-close {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
    background: rgba(255, 255, 255, 0.06);
    color: var(--SmartThemeBodyColor, #f5f7fa);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
#gal-global-overlay .gal-title-cg-gallery-close:hover {
    background: rgba(255, 255, 255, 0.16);
    color: var(--SmartThemeEmColor, #9ac7ff);
}
#gal-global-overlay .gal-title-cg-gallery-subtitle {
    margin: 0;
    padding: 0 18px 14px;
    color: var(--SmartThemeBodyColor, #f5f7fa);
    opacity: 0.84;
    font-size: 0.9rem;
}
#gal-global-overlay .gal-title-cg-gallery-body {
    padding: 0 18px 18px;
    overflow: auto;
}
#gal-global-overlay .gal-title-cg-gallery-empty {
    padding: 24px 8px;
    text-align: center;
    color: var(--SmartThemeBodyColor, #f5f7fa);
    opacity: 0.86;
}
#gal-global-overlay .gal-title-cg-gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 14px;
}
#gal-global-overlay .gal-title-cg-gallery-card {
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
    background: rgba(255, 255, 255, 0.04);
}
#gal-global-overlay .gal-title-cg-gallery-preview {
    width: 100%;
    aspect-ratio: 16 / 9;
    background: rgba(255, 255, 255, 0.06);
}
#gal-global-overlay .gal-title-cg-gallery-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}
#gal-global-overlay .gal-title-cg-gallery-name {
    padding: 9px 10px 2px;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--SmartThemeBodyColor, #f5f7fa);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
#gal-global-overlay .gal-title-cg-gallery-desc {
    padding: 0 10px 10px;
    font-size: 0.8rem;
    line-height: 1.45;
    color: var(--SmartThemeBodyColor, #f5f7fa);
    opacity: 0.82;
    word-break: break-word;
}

/* Mobile Adjustments */
@media (max-width: 760px) {
    #gal-global-overlay .gal-title-screen {
        padding: 5% 6%;
        align-items: center;
        text-align: center;
    }
    #gal-global-overlay .gal-title-screen-mask {
        background: radial-gradient(ellipse at 50% 60%, rgba(5,8,12,0.6) 0%, rgba(5,8,12,0.9) 100%);
    }
    #gal-global-overlay .gal-title-screen-content {
        align-items: center;
        margin-top: 10vh;
    }
    .gal-title-wrapper {
        align-self: center;
        display: flex;
        flex-direction: column;
        align-items: center;
    }
    #gal-global-overlay .gal-title-screen-subtitle {
        padding-left: 0;
    }
    #gal-global-overlay .gal-title-screen-subtitle::before {
        margin: 0 auto 2vh auto;
    }
    #gal-global-overlay .gal-title-screen-actions {
        align-items: center;
        margin-top: 6vh;
    }
    #gal-global-overlay .gal-title-screen-btn {
        padding: 0.5rem 1rem;
        transform: translateY(20px); /* slide up on mobile */
    }
    #gal-global-overlay .gal-title-screen.active .gal-title-screen-btn {
        transform: translateY(0);
    }
    #gal-global-overlay .gal-title-screen-btn::before {
        display: none; /* Hide diamond on mobile for center alignment */
    }
    #gal-global-overlay .gal-title-screen-btn::after {
        background: radial-gradient(ellipse at center, rgba(255,255,255,0.1) 0%, transparent 70%);
        left: -50%; width: 200%; /* wide center glow */
        transform-origin: center;
    }
    #gal-global-overlay .gal-title-screen-btn:hover {
        padding-left: 1rem; /* don't slide right on hover */
        transform: scale(1.05);
    }
    #gal-global-overlay .gal-title-cg-gallery {
        padding: 10px;
    }
    #gal-global-overlay .gal-title-cg-gallery-panel {
        width: 100%;
        max-height: 92vh;
        border-radius: 12px;
    }
    #gal-global-overlay .gal-title-cg-gallery-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
    }
}
`;

  const styleEl = targetDoc.createElement('style');
  styleEl.id = `${SCRIPT_ID}-styles`;
  styleEl.textContent = css + skinCss + styledCss + saveLoadCss + titleScreenCss;
  (targetDoc.head || targetDoc.documentElement).appendChild(styleEl);
  console.log(`[${SCRIPT_NAME}] 样式已注入`);
}
