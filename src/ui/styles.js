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
  // 注入字体
  if (!targetDoc.querySelector('link[href*="Noto+Sans+SC"]')) {
    const fontLink = targetDoc.createElement('link');
    fontLink.href =
      'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&family=Barlow:ital,wght@0,400;0,800;1,600&display=swap';
    fontLink.rel = 'stylesheet';
    (targetDoc.head || targetDoc.documentElement).appendChild(fontLink);
  }
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

  const styleEl = targetDoc.createElement('style');
  styleEl.id = `${SCRIPT_ID}-styles`;
  styleEl.textContent = css + skinCss;
  (targetDoc.head || targetDoc.documentElement).appendChild(styleEl);
  console.log(`[${SCRIPT_NAME}] 样式已注入`);
}
