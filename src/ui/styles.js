import { SCRIPT_ID, SCRIPT_NAME } from '../core/constants.js';
import { topWindow } from '../core/env.js';

// ============================================
// 样式注入
// ============================================
const STYLES_INJECTED_FLAG = `${SCRIPT_ID}_styles_injected`;

// 主界面基础样式（构建时由 esbuild 将 数据库界面插件.css 压缩后注入占位符）
const BASE_INTERFACE_CSS = `__CSS_PLACEHOLDER__`;

// 供 HTML 皮肤模板嵌入，保证模板预览与真实界面基线一致（所见即所得）
export function getBaseInterfaceCss() {
  return BASE_INTERFACE_CSS;
}

export function injectStyles() {
  const targetDoc = topWindow.document;
  // 强制移除旧样式，确保热重载生效
  const oldStyle = targetDoc.getElementById(`${SCRIPT_ID}-styles`);
  if (oldStyle) oldStyle.remove();

  topWindow[STYLES_INJECTED_FLAG] = true;
  const css = BASE_INTERFACE_CSS;

  // Galgame UI 皮肤库（基于 UI/UX Pro Max 设计系统重构）
const skinCss = `
/* === 全局皮肤重置 === */
#gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark):not(.skin-twilight) .gal-name-badge,
#gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark):not(.skin-twilight) .gal-name-badge span,
#gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-action-btn,
#gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-action-btn span,
#gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-action-btn i,
#gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn,
#gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn span,
#gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn i,
#gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-pending-choices-btn,
#gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-pending-choices-btn span,
#gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-pending-choices-btn i,
#gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn-next,
#gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn-next span,
#gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn-next i {
    transform: none !important;
}
/* 所有皮肤按钮通用修正：确保完整显示 + 缩放适配 */
#gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn-next,
#gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn,
#gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-action-btn,
#gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-pending-choices-btn {
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
#gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn-next {
    font-size: calc(1.3rem * var(--ui-scale, 1)) !important;
    padding: 0 calc(2.5rem * var(--ui-scale, 1)) !important;
    height: calc(3.438rem * var(--ui-scale, 1)) !important;
    min-width: calc(8.75rem * var(--ui-scale, 1)) !important;
}
/* 所有皮肤名牌+文字缩放适配 */
#gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark):not(.skin-twilight) .gal-name-badge {
    transform: scale(var(--ui-scale, 1)) !important;
    transform-origin: left top !important;
}
#gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-dialog-text {
    font-size: calc(1.25rem * var(--ui-scale, 1) * var(--font-scale, 1)) !important;
}

/* =========================================================
   0. 薄暮 (Twilight) — Stitch 还原版
   视觉真源:
   Desktop VN - Inline Choice Indicator v5
   Mobile VN - Refined Controls v13
   ========================================================= */
#gal-global-overlay.skin-twilight {
    --twilight-glass-border: rgba(255, 255, 255, 0.16);
    --twilight-glass-fill: rgba(16, 18, 28, 0.42);
    --twilight-glass-strong: rgba(12, 14, 22, 0.76);
    --twilight-text-main: rgba(245, 240, 232, 0.96);
    --twilight-text-muted: rgba(236, 228, 216, 0.68);
    --twilight-accent: #d7b189;
    --twilight-accent-soft: rgba(215, 177, 137, 0.24);
    --twilight-shadow: 0 18px 52px rgba(0, 0, 0, 0.28);
    --twilight-header-height: 52px;
    --twilight-footer-height: 46px;
    --twilight-headline: "Manrope", "PingFang SC", "Microsoft YaHei", sans-serif;
    --twilight-body: "Be Vietnam Pro", "PingFang SC", "Microsoft YaHei", sans-serif;
    --twilight-label: "Inter", "PingFang SC", "Microsoft YaHei", sans-serif;
    --twilight-name-badge-height-scale: 0.7;
    font-family: var(--twilight-body) !important;
    color: var(--twilight-text-main) !important;
}

#gal-global-overlay.skin-twilight .gal-game-container {
    position: relative !important;
    overflow: hidden !important;
    border-radius: 20px !important;
    background: transparent !important;
}

#gal-global-overlay.skin-twilight .gal-layer-bg {
    position: absolute !important;
    inset: 0;
    overflow: hidden !important;
}

#gal-global-overlay.skin-twilight .gal-bg-base,
#gal-global-overlay.skin-twilight .gal-bg-front {
    position: absolute !important;
    inset: 0;
}

#gal-global-overlay.skin-twilight .gal-layer-character,
#gal-global-overlay.skin-twilight .gal-layer-effect-bg,
#gal-global-overlay.skin-twilight .gal-layer-effect-fg,
#gal-global-overlay.skin-twilight .gal-char-slot:empty {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
}

#gal-global-overlay.skin-twilight .gal-game-container.gal-twilight-shell {
    position: relative !important;
    overflow: hidden !important;
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    background: transparent !important;
}

#gal-global-overlay.skin-twilight .gal-game-container.gal-twilight-shell::before {
    content: none !important;
    display: none !important;
}

#gal-global-overlay.skin-twilight .gal-fullscreen-btn {
    display: none !important;
}

#gal-global-overlay.skin-twilight .gal-mobile-menu {
    display: none;
    position: absolute;
    min-width: 10rem;
    padding: 0.5rem;
    gap: 0.4rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 1rem;
    background: rgba(12, 14, 22, 0.88);
    box-shadow: 0 18px 36px rgba(0, 0, 0, 0.24);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    z-index: 30;
    pointer-events: auto;
}

#gal-global-overlay.skin-twilight .gal-mobile-menu.active {
    display: flex;
}

#gal-global-overlay.skin-twilight .gal-mobile-menu .gal-menu-btn {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-height: 2.1rem;
    padding: 0.55rem 0.8rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.85rem;
    background: rgba(255, 255, 255, 0.03);
    color: rgba(245, 239, 232, 0.9);
    font-family: var(--twilight-label) !important;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    box-shadow: none;
}

#gal-global-overlay.skin-twilight .gal-mobile-menu .gal-menu-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 247, 238, 0.98);
    transform: none;
    box-shadow: none;
}

#gal-global-overlay.skin-twilight .gal-mobile-menu .gal-menu-btn i {
    width: 1rem;
    color: rgba(255, 244, 232, 0.82);
    text-align: center;
}

#gal-global-overlay.skin-twilight .gal-game-content {
    position: relative;
    z-index: 3;
}

#gal-global-overlay.skin-twilight .gal-dialog-layer {
    position: relative;
    z-index: 6;
}

#gal-global-overlay.skin-twilight .gal-status-bar-container {
    position: relative;
    z-index: 8;
}

#gal-global-overlay.skin-twilight .gal-twilight-content {
    position: relative;
    min-height: 100%;
}

#gal-global-overlay.skin-twilight .gal-twilight-scrim {
    position: absolute;
    inset: 0;
    background:
        radial-gradient(72% 48% at 50% 18%, rgba(255, 211, 169, 0.16) 0%, rgba(255, 211, 169, 0) 55%),
        linear-gradient(180deg, rgba(8, 10, 16, 0.2) 0%, rgba(8, 10, 16, 0.04) 24%, rgba(8, 10, 16, 0.08) 56%, rgba(6, 8, 14, 0.38) 100%);
    pointer-events: none;
}

#gal-global-overlay.skin-twilight .gal-twilight-header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    min-height: var(--twilight-header-height);
    padding: 10px 26px 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    background: linear-gradient(180deg, rgba(10, 12, 18, 0.6) 0%, rgba(10, 12, 18, 0.22) 100%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    box-shadow: 0 10px 26px rgba(0, 0, 0, 0.16);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
}

#gal-global-overlay.skin-twilight .gal-status-bar-container.gal-twilight-header {
    top: 0 !important;
    right: 0 !important;
    left: 0 !important;
    width: 100% !important;
    min-width: 100% !important;
    max-width: none !important;
    box-sizing: border-box !important;
    z-index: 8 !important;
    pointer-events: auto !important;
    transform: none !important;
    transform-origin: left top !important;
}

#gal-global-overlay.skin-twilight .gal-twilight-brandline {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
    flex: 1 1 auto;
}

#gal-global-overlay.skin-twilight .gal-twilight-brand {
    font-family: var(--twilight-headline) !important;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.16em;
    color: rgba(255, 244, 232, 0.92);
    white-space: nowrap;
}

#gal-global-overlay.skin-twilight .gal-twilight-divider {
    width: 1px;
    height: 14px;
    background: rgba(255, 255, 255, 0.12);
    flex: 0 0 auto;
}

#gal-global-overlay.skin-twilight .gal-twilight-meta-group {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
}

#gal-global-overlay.skin-twilight .gal-twilight-meta-btn,
#gal-global-overlay.skin-twilight .gal-status-popup-trigger,
#gal-global-overlay.skin-twilight .gal-sprite-toggle,
#gal-global-overlay.skin-twilight .gal-twilight-header-actions .gal-fullscreen-btn.gal-twilight-fullscreen-toggle {
    position: static !important;
    inset: auto !important;
    top: auto !important;
    right: auto !important;
    bottom: auto !important;
    left: auto !important;
}

#gal-global-overlay.skin-twilight .gal-twilight-meta-btn {
    display: inline-flex !important;
    align-items: center;
    gap: 8px;
    padding: 0 !important;
    height: auto !important;
    min-height: 0 !important;
    border: none !important;
    background: transparent !important;
    box-shadow: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    font-family: var(--twilight-headline) !important;
    font-size: 0.68rem !important;
    font-weight: 700 !important;
    letter-spacing: 0.05em;
    text-transform: uppercase;
}

#gal-global-overlay.skin-twilight .gal-twilight-meta-btn i {
    display: none !important;
}

#gal-global-overlay.skin-twilight .gal-location-bar {
    color: rgba(255, 244, 232, 0.92) !important;
}

#gal-global-overlay.skin-twilight .gal-time-bar {
    color: rgba(255, 244, 232, 0.58) !important;
}

#gal-global-overlay.skin-twilight .gal-location-text,
#gal-global-overlay.skin-twilight .gal-time-text {
    white-space: nowrap;
}

#gal-global-overlay.skin-twilight .gal-twilight-header-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    flex: 0 0 auto;
}

#gal-global-overlay.skin-twilight .gal-bgm-widget {
    display: flex !important;
    top: calc(var(--twilight-header-height) + 16px) !important;
    left: 18px !important;
    right: auto !important;
    z-index: 12 !important;
    min-height: 30px !important;
    height: 30px !important;
    padding: 0 9px !important;
    gap: 0.4rem !important;
    border-radius: 999px !important;
    max-width: 30px !important;
    background:
        linear-gradient(180deg, rgba(20, 22, 32, 0.74) 0%, rgba(10, 12, 18, 0.84) 100%) !important;
    border: 1px solid var(--twilight-glass-border) !important;
    box-shadow: 0 12px 26px rgba(0, 0, 0, 0.14) !important;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    color: rgba(245, 240, 232, 0.88) !important;
}

#gal-global-overlay.skin-twilight .gal-bgm-widget:hover {
    max-width: 30px !important;
    background:
        linear-gradient(180deg, rgba(26, 29, 41, 0.78) 0%, rgba(12, 14, 22, 0.88) 100%) !important;
}

#gal-global-overlay.skin-twilight .gal-bgm-widget.active,
#gal-global-overlay.skin-twilight .gal-bgm-widget.active:hover {
    max-width: min(12.5rem, calc(100vw - 2rem)) !important;
    background:
        linear-gradient(180deg, rgba(22, 24, 36, 0.88) 0%, rgba(10, 12, 18, 0.94) 100%) !important;
    box-shadow:
        0 16px 30px rgba(0, 0, 0, 0.16),
        inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
}

#gal-global-overlay.skin-twilight .gal-bgm-icon {
    min-width: 0.9rem;
    font-size: 0.92rem !important;
    color: var(--twilight-accent) !important;
}

#gal-global-overlay.skin-twilight .gal-bgm-info {
    gap: 2px;
    margin-right: 0 !important;
}

#gal-global-overlay.skin-twilight .gal-bgm-title {
    color: var(--twilight-accent) !important;
    font-family: var(--twilight-label) !important;
    font-size: 0.68rem !important;
    letter-spacing: 0.04em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

#gal-global-overlay.skin-twilight .gal-bgm-ctrl {
    gap: 0.4rem;
}

#gal-global-overlay.skin-twilight .gal-bgm-btn {
    width: 0.85rem;
    font-size: 0.72rem;
    color: rgba(245, 240, 232, 0.82) !important;
}

#gal-global-overlay.skin-twilight .gal-bgm-btn:hover {
    color: var(--twilight-accent) !important;
}

#gal-global-overlay.skin-twilight .gal-bgm-slider {
    width: 2.9rem;
    height: 0.2rem;
    background: rgba(255, 255, 255, 0.22);
}

#gal-global-overlay.skin-twilight .gal-bgm-slider::-webkit-slider-thumb {
    width: 0.5rem;
    height: 0.5rem;
    background: var(--twilight-accent);
}

#gal-global-overlay.skin-twilight .gal-twilight-header-actions .gal-status-popup-trigger,
#gal-global-overlay.skin-twilight .gal-twilight-header-actions .gal-sprite-toggle,
#gal-global-overlay.skin-twilight .gal-twilight-header-actions .gal-fullscreen-btn.gal-twilight-fullscreen-toggle {
    display: inline-flex !important;
    width: 28px !important;
    height: 28px !important;
    min-width: 28px !important;
    min-height: 28px !important;
    padding: 0 !important;
    border: none !important;
    border-radius: 999px !important;
    background: transparent !important;
    box-shadow: none !important;
    color: rgba(245, 239, 232, 0.84) !important;
    cursor: pointer !important;
    transform: none !important;
    transition:
        background-color 140ms ease,
        box-shadow 140ms ease,
        color 140ms ease,
        opacity 140ms ease !important;
}

#gal-global-overlay.skin-twilight .gal-twilight-header-actions .gal-status-popup-icon,
#gal-global-overlay.skin-twilight .gal-eye-icon,
#gal-global-overlay.skin-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle i {
    color: rgba(249, 241, 230, 0.88) !important;
    opacity: 0.92 !important;
    text-shadow: none !important;
}

#gal-global-overlay.skin-twilight .gal-twilight-header-actions .gal-status-popup-trigger:hover,
#gal-global-overlay.skin-twilight .gal-twilight-header-actions .gal-sprite-toggle:hover,
#gal-global-overlay.skin-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle:hover,
#gal-global-overlay.skin-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle:focus-visible {
    background: rgba(255, 255, 255, 0.12) !important;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08) !important;
    color: rgba(255, 244, 232, 0.98) !important;
}

#gal-global-overlay.skin-twilight .gal-twilight-header-actions .gal-status-popup-trigger:hover .gal-status-popup-icon,
#gal-global-overlay.skin-twilight .gal-twilight-header-actions .gal-sprite-toggle:hover .gal-eye-icon,
#gal-global-overlay.skin-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle:hover i,
#gal-global-overlay.skin-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle:focus-visible i {
    color: rgba(255, 250, 242, 1) !important;
    opacity: 1 !important;
}

#gal-global-overlay.skin-twilight .gal-twilight-header-actions .gal-status-popup-icon,
#gal-global-overlay.skin-twilight .gal-eye-icon,
#gal-global-overlay.skin-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle i {
    font-size: 0.82rem !important;
    line-height: 1 !important;
}

#gal-global-overlay.skin-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle span {
    display: none !important;
}

#gal-global-overlay.skin-twilight .gal-twilight-dialog-layer {
    position: absolute !important;
    left: 64px;
    right: 64px;
    bottom: calc(var(--twilight-footer-height) + 22px);
    width: auto !important;
    max-width: none !important;
    margin: 0 !important;
    transform: none !important;
}

#gal-global-overlay.skin-twilight .gal-twilight-dialog-topline {
    position: absolute;
    top: -32px;
    left: 28px;
    right: 28px;
    z-index: 4;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    min-height: 46px;
    min-width: 0;
}

#gal-global-overlay.skin-twilight .gal-twilight-mobile-controls {
    display: inline-flex !important;
    position: static !important;
    inset: auto !important;
    top: auto !important;
    right: auto !important;
    bottom: auto !important;
    left: auto !important;
    margin-left: auto !important;
    transform: none !important;
    align-items: flex-end;
    justify-content: flex-end;
    gap: 12px !important;
    border: none !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    overflow: visible !important;
}

#gal-global-overlay.skin-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action {
    height: 32px !important;
    min-height: 32px !important;
    padding: 0 14px !important;
    margin-bottom: 0 !important;
    border-top: 1px solid rgba(255, 255, 255, 0.18) !important;
    border-left: 1px solid rgba(255, 255, 255, 0.18) !important;
    border-right: 1px solid rgba(255, 255, 255, 0.18) !important;
    border-bottom: none !important;
    border-radius: 11px 11px 0 0 !important;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.03) 100%),
        rgba(58, 64, 78, 0.24) !important;
    box-shadow:
        0 -2px 8px rgba(0, 0, 0, 0.06),
        inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
    color: rgba(248, 242, 234, 0.96) !important;
    font-size: 0.64rem !important;
    font-weight: 700 !important;
    letter-spacing: 0.06em !important;
    text-transform: uppercase !important;
    gap: 5px !important;
    transition:
        background-color 140ms ease,
        color 140ms ease,
        box-shadow 140ms ease !important;
}

#gal-global-overlay.skin-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action + .gal-twilight-mobile-action {
    border-left-width: 1px !important;
}

#gal-global-overlay.skin-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action i {
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    color: currentColor !important;
    font-size: 0.72rem !important;
}

#gal-global-overlay.skin-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action .gal-btn-text,
#gal-global-overlay.skin-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action span:last-child {
    display: inline !important;
}

#gal-global-overlay.skin-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action:hover {
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.05) 100%),
        rgba(66, 72, 88, 0.34) !important;
    color: rgba(255, 250, 244, 1) !important;
}

#gal-global-overlay.skin-twilight .gal-name-badge {
    position: absolute !important;
    inset: auto !important;
    left: 4px !important;
    top: 16px !important;
    align-self: flex-start;
    min-width: 78px;
    max-width: min(22vw, 132px);
    min-height: 36px;
    margin: 0 !important;
    padding: 0 !important;
    border: 1px solid rgba(186, 155, 112, 0.34) !important;
    border-radius: 14px !important;
    background:
        linear-gradient(180deg, rgba(255, 251, 245, 0.98) 0%, rgba(244, 236, 223, 0.96) 100%) !important;
    box-shadow:
        0 14px 30px rgba(41, 29, 17, 0.14),
        inset 0 1px 0 rgba(255, 255, 255, 0.82) !important;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    transform: translate(0, -2px) skew(-10deg) scaleY(var(--twilight-name-badge-height-scale, 0.7)) !important;
    transform-origin: center center !important;
    overflow: visible !important;
    z-index: 5;
}

#gal-global-overlay.skin-twilight .gal-name-badge span {
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    min-height: 36px;
    padding: 0 18px 0 16px !important;
    border-radius: inherit !important;
    background: transparent !important;
    color: #7b5d33 !important;
    font-family: var(--twilight-headline) !important;
    font-size: 0.82rem !important;
    font-weight: 800 !important;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    box-shadow: none !important;
    transform: scaleY(calc(1 / var(--twilight-name-badge-height-scale, 0.7))) skew(12deg) !important;
    transform-origin: center center !important;
    text-shadow: none !important;
    white-space: nowrap;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
}

#gal-global-overlay.skin-twilight .gal-text-panel {
    position: relative !important;
    min-height: 146px;
    width: 100% !important;
    overflow: hidden !important;
    padding: 54px 40px 30px !important;
    border-radius: 18px !important;
    border: 1px solid rgba(255, 255, 255, 0.05) !important;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.025) 0%, rgba(255, 255, 255, 0.008) 100%),
        rgba(18, 19, 26, var(--panel-opacity, 0.7)) !important;
    box-shadow:
        0 18px 36px rgba(0, 0, 0, 0.18),
        inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    cursor: pointer !important;
}

#gal-global-overlay.skin-twilight .gal-text-panel::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
        linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0) 34%),
        radial-gradient(circle at top left, rgba(255, 255, 255, 0.035) 0%, rgba(255, 255, 255, 0) 38%);
    opacity: 0.12;
    pointer-events: none;
}

#gal-global-overlay.skin-twilight .gal-text-panel:hover {
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.032) 0%, rgba(255, 255, 255, 0.01) 100%),
        rgba(20, 21, 29, var(--panel-opacity, 0.7)) !important;
    border-color: rgba(255, 255, 255, 0.08) !important;
}

#gal-global-overlay.skin-twilight .gal-dialog-text {
    display: block !important;
    overflow: hidden !important;
    color: var(--twilight-text-main) !important;
    font-family: var(--twilight-body) !important;
    font-size: calc(1.04rem * var(--font-scale, 1)) !important;
    font-weight: 400 !important;
    line-height: 1.84 !important;
    letter-spacing: 0.01em;
    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.18) !important;
    position: relative;
    z-index: 1;
}

#gal-global-overlay.skin-twilight .gal-twilight-dialog-next-indicator {
    position: absolute;
    right: 22px;
    bottom: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    color: rgba(255, 245, 236, 0.78);
    opacity: 0.88;
    pointer-events: none;
    z-index: 2;
    animation: galTwilightNextPulse 1.6s ease-in-out infinite;
}

#gal-global-overlay.skin-twilight .gal-twilight-dialog-next-indicator[data-state="end"] {
    color: rgba(238, 224, 201, 0.82);
    animation: none;
}

#gal-global-overlay.skin-twilight .gal-twilight-dialog-next-indicator i {
    font-size: 0.72rem !important;
    line-height: 1 !important;
    color: inherit !important;
}

@keyframes galTwilightNextPulse {
    0%, 100% {
        transform: translateY(0);
        opacity: 0.62;
    }
    50% {
        transform: translateY(2px);
        opacity: 1;
    }
}

#gal-global-overlay.skin-twilight .gal-generating-indicator {
    display: none !important;
    margin-top: 14px !important;
    padding: 10px 14px !important;
    border-radius: 999px !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    background: rgba(255, 255, 255, 0.04) !important;
    position: relative;
    z-index: 1;
    width: fit-content;
    max-width: 100%;
    align-items: center;
    gap: 10px;
    color: rgba(245, 239, 232, 0.82) !important;
}

#gal-global-overlay.skin-twilight .gal-generating-indicator.active {
    display: inline-flex !important;
}

#gal-global-overlay.skin-twilight .gal-progress-container {
    display: block !important;
    position: absolute !important;
    bottom: 0 !important;
    left: 0 !important;
    width: 100% !important;
    background: rgba(0, 0, 0, 0.3) !important;
    height: 4px !important;
    opacity: 1 !important;
    z-index: 100 !important;
}

#gal-global-overlay.skin-twilight .gal-bottom-toolbar {
    position: absolute !important;
    left: 0;
    right: 0;
    bottom: 0;
    min-height: var(--twilight-footer-height);
    display: flex !important;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 6px 24px 8px !important;
    background: linear-gradient(180deg, rgba(10, 12, 18, 0.12) 0%, rgba(10, 12, 18, 0.74) 100%) !important;
    border-top: 1px solid rgba(255, 255, 255, 0.05) !important;
    box-shadow: 0 -10px 24px rgba(0, 0, 0, 0.18) !important;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
}

#gal-global-overlay.skin-twilight .gal-footer-btn,
#gal-global-overlay.skin-twilight .gal-pending-choices-btn,
#gal-global-overlay.skin-twilight .gal-action-btn {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    height: 26px !important;
    min-height: 26px !important;
    min-width: 0 !important;
    padding: 0 8px !important;
    border-radius: 999px !important;
    border: 1px solid transparent !important;
    background: transparent !important;
    color: rgba(245, 239, 232, 0.68) !important;
    font-family: var(--twilight-headline) !important;
    font-size: 0.58rem !important;
    font-weight: 700 !important;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    box-shadow: none !important;
}

#gal-global-overlay.skin-twilight .gal-footer-btn i,
#gal-global-overlay.skin-twilight .gal-pending-choices-btn i,
#gal-global-overlay.skin-twilight .gal-action-btn i {
    color: currentColor !important;
}

#gal-global-overlay.skin-twilight .gal-footer-btn:hover,
#gal-global-overlay.skin-twilight .gal-pending-choices-btn:hover,
#gal-global-overlay.skin-twilight .gal-action-btn:hover {
    background: rgba(255, 255, 255, 0.06) !important;
    color: rgba(255, 244, 232, 0.92) !important;
}

#gal-global-overlay.skin-twilight .gal-pending-choices-btn.show {
    background: rgba(215, 177, 137, 0.12) !important;
    border-color: rgba(215, 177, 137, 0.22) !important;
    color: #f3e5d4 !important;
}

#gal-global-overlay.skin-twilight .gal-bottom-toolbar .gal-footer-btn,
#gal-global-overlay.skin-twilight .gal-bottom-toolbar .gal-pending-choices-btn {
    width: auto !important;
}

#gal-global-overlay.skin-twilight .gal-bottom-toolbar .gal-btn-text {
    display: inline !important;
}

#gal-global-overlay.skin-twilight .gal-bottom-toolbar i {
    display: none !important;
}

#gal-global-overlay.skin-twilight .gal-bottom-toolbar [data-action="show-choices"] {
    padding: 0 14px !important;
    background: rgba(255, 255, 255, 0.1) !important;
    border-color: rgba(255, 255, 255, 0.1) !important;
    color: rgba(255, 241, 232, 0.96) !important;
}

#gal-global-overlay.skin-twilight .gal-footer-btn-next.gal-twilight-mobile-next {
    display: none !important;
}

#gal-global-overlay.skin-twilight .gal-progress-bar {
    background: linear-gradient(90deg, rgba(232, 192, 145, 0.96) 0%, rgba(255, 224, 188, 0.92) 100%) !important;
    box-shadow: 0 0 20px rgba(231, 190, 143, 0.35) !important;
}

#gal-layer-choices.skin-twilight {
    background:
      radial-gradient(120% 120% at 50% 0%, rgba(248, 208, 168, 0.22) 0%, rgba(248, 208, 168, 0) 34%),
      linear-gradient(180deg, rgba(8, 10, 17, 0.72) 0%, rgba(4, 6, 12, 0.9) 100%) !important;
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
}

#gal-layer-choices.skin-twilight .gal-choices-title {
    color: rgba(246, 239, 231, 0.94) !important;
    font-family: "Cormorant Garamond", "Times New Roman", "Noto Serif SC", serif !important;
    letter-spacing: 0.18em;
}

#gal-layer-choices.skin-twilight .gal-choices-hint {
    color: rgba(236, 228, 216, 0.58) !important;
    letter-spacing: 0.08em;
}

#gal-layer-choices.skin-twilight .gal-choice-card {
    border: 1px solid rgba(255,255,255,0.14) !important;
    border-radius: 22px !important;
    background:
      linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%),
      linear-gradient(180deg, rgba(18, 19, 30, 0.7) 0%, rgba(12, 14, 22, 0.84) 100%) !important;
    color: rgba(247, 240, 232, 0.94) !important;
    box-shadow: 0 22px 44px rgba(0, 0, 0, 0.18) !important;
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
}

#gal-layer-choices.skin-twilight .gal-choice-card:hover {
    border-color: rgba(215, 177, 137, 0.42) !important;
    background:
      linear-gradient(180deg, rgba(241, 212, 179, 0.18) 0%, rgba(255,255,255,0.06) 100%),
      linear-gradient(180deg, rgba(21, 22, 34, 0.76) 0%, rgba(12, 14, 22, 0.88) 100%) !important;
}

/* =========================================================
   0.1 鎏暮 (Gilded Twilight) — 薄暮的鎏金羊皮纸变体
   参考: Desktop VN - Inline Choice Indicator v5
   只替换配色 / 字体 / 细节质感，结构与薄暮一致
   ========================================================= */
#gal-global-overlay.skin-gilded-twilight {
    --gilded-ivory: rgba(249, 248, 244, 0.96);
    --gilded-ivory-soft: rgba(253, 250, 240, 0.78);
    --gilded-ink: #2f2822;
    --gilded-ink-soft: rgba(47, 40, 34, 0.62);
    --gilded-gold: #b08d57;
    --gilded-gold-soft: rgba(176, 141, 87, 0.2);
    --gilded-oxblood: #6a2d32;
    --gilded-shadow: 0 22px 56px rgba(76, 56, 28, 0.16);
    --twilight-headline: "Cinzel", "Noto Serif SC", "Source Han Serif SC", serif;
    --twilight-body: "Cormorant Garamond", "Noto Serif SC", "Source Han Serif SC", serif;
    --twilight-label: "Montserrat", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
    color: var(--gilded-ink) !important;
}

#gal-global-overlay.skin-gilded-twilight .gal-twilight-scrim {
    background:
        radial-gradient(72% 48% at 50% 18%, rgba(239, 221, 190, 0.18) 0%, rgba(239, 221, 190, 0) 58%),
        linear-gradient(180deg, rgba(255, 249, 238, 0.08) 0%, rgba(255, 249, 238, 0.02) 28%, rgba(245, 235, 220, 0.03) 58%, rgba(194, 171, 136, 0.16) 100%);
}

#gal-global-overlay.skin-gilded-twilight .gal-twilight-header {
    background: linear-gradient(180deg, rgba(249, 248, 244, 0.94) 0%, rgba(249, 248, 244, 0.8) 100%) !important;
    border-bottom: 1px solid rgba(176, 141, 87, 0.22) !important;
    box-shadow: 0 10px 28px rgba(80, 58, 34, 0.08) !important;
}

#gal-global-overlay.skin-gilded-twilight .gal-twilight-brand {
    color: var(--gilded-gold) !important;
    letter-spacing: 0.24em !important;
}

#gal-global-overlay.skin-gilded-twilight .gal-twilight-divider {
    background: rgba(176, 141, 87, 0.3) !important;
}

#gal-global-overlay.skin-gilded-twilight .gal-location-bar {
    color: var(--gilded-ink) !important;
}

#gal-global-overlay.skin-gilded-twilight .gal-time-bar {
    color: var(--gilded-ink-soft) !important;
}

#gal-global-overlay.skin-gilded-twilight .gal-twilight-meta-btn {
    font-family: var(--twilight-label) !important;
    letter-spacing: 0.22em !important;
}

#gal-global-overlay.skin-gilded-twilight .gal-twilight-header-actions .gal-status-popup-trigger,
#gal-global-overlay.skin-gilded-twilight .gal-twilight-header-actions .gal-sprite-toggle,
#gal-global-overlay.skin-gilded-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle {
    color: rgba(176, 141, 87, 0.9) !important;
}

#gal-global-overlay.skin-gilded-twilight .gal-twilight-header-actions .gal-status-popup-icon,
#gal-global-overlay.skin-gilded-twilight .gal-eye-icon,
#gal-global-overlay.skin-gilded-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle i {
    color: rgba(176, 141, 87, 0.96) !important;
}

#gal-global-overlay.skin-gilded-twilight .gal-twilight-header-actions .gal-status-popup-trigger:hover,
#gal-global-overlay.skin-gilded-twilight .gal-twilight-header-actions .gal-sprite-toggle:hover,
#gal-global-overlay.skin-gilded-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle:hover,
#gal-global-overlay.skin-gilded-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle:focus-visible {
    background: rgba(176, 141, 87, 0.1) !important;
    box-shadow: inset 0 0 0 1px rgba(176, 141, 87, 0.18) !important;
}

#gal-global-overlay.skin-gilded-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action {
    border-color: rgba(176, 141, 87, 0.22) !important;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.08) 100%),
        rgba(251, 248, 240, 0.52) !important;
    color: var(--gilded-gold) !important;
    font-family: var(--twilight-label) !important;
    box-shadow:
        0 -2px 8px rgba(119, 91, 50, 0.04),
        inset 0 1px 0 rgba(255, 255, 255, 0.35) !important;
}

#gal-global-overlay.skin-gilded-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action:hover {
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.14) 100%),
        rgba(255, 251, 245, 0.72) !important;
    color: #8c6a3c !important;
}

#gal-global-overlay.skin-gilded-twilight .gal-name-badge {
    background: linear-gradient(180deg, rgba(253, 250, 240, 0.96) 0%, rgba(243, 233, 214, 0.98) 100%) !important;
    border: 1px solid rgba(176, 141, 87, 0.24) !important;
    box-shadow: 0 10px 24px rgba(111, 84, 46, 0.08) !important;
}

#gal-global-overlay.skin-gilded-twilight .gal-name-badge span {
    position: relative !important;
    background: transparent !important;
    color: var(--gilded-gold) !important;
    padding: 0 18px 0 16px !important;
}

#gal-global-overlay.skin-gilded-twilight .gal-text-panel {
    border: 1px solid rgba(176, 141, 87, 0.2) !important;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.18) 100%),
        rgba(249, 248, 244, calc(var(--panel-opacity, 0.7) * 0.88)) !important;
    box-shadow:
        0 20px 50px rgba(77, 58, 32, 0.12),
        inset 0 1px 0 rgba(255, 255, 255, 0.42) !important;
    backdrop-filter: blur(16px) saturate(108%);
    -webkit-backdrop-filter: blur(16px) saturate(108%);
}

#gal-global-overlay.skin-gilded-twilight .gal-text-panel::before {
    opacity: 0.32 !important;
    background:
        linear-gradient(135deg, rgba(176, 141, 87, 0.08) 0%, rgba(176, 141, 87, 0) 36%),
        radial-gradient(circle at top left, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 42%) !important;
}

#gal-global-overlay.skin-gilded-twilight .gal-text-panel:hover {
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.24) 100%),
        rgba(249, 248, 244, calc(var(--panel-opacity, 0.7) * 0.94)) !important;
    border-color: rgba(176, 141, 87, 0.3) !important;
    box-shadow:
        0 24px 56px rgba(77, 58, 32, 0.14),
        inset 0 1px 0 rgba(255, 255, 255, 0.48) !important;
}

#gal-global-overlay.skin-gilded-twilight .gal-dialog-text {
    color: rgba(47, 40, 34, 0.94) !important;
    font-family: var(--twilight-body) !important;
    letter-spacing: 0.03em !important;
    text-shadow: 0.5px 0.5px 1px rgba(0, 0, 0, 0.06) !important;
}

#gal-global-overlay.skin-gilded-twilight .gal-twilight-dialog-next-indicator,
#gal-global-overlay.skin-gilded-twilight .gal-twilight-dialog-next-indicator[data-state="end"] {
    color: var(--gilded-gold) !important;
}

#gal-global-overlay.skin-gilded-twilight .gal-twilight-dialog-next-indicator i {
    color: var(--gilded-gold) !important;
    text-shadow: 0 4px 16px rgba(176, 141, 87, 0.2) !important;
}

#gal-global-overlay.skin-gilded-twilight .gal-generating-indicator {
    border-color: rgba(176, 141, 87, 0.18) !important;
    background: rgba(252, 247, 238, 0.86) !important;
    color: rgba(47, 40, 34, 0.84) !important;
    box-shadow: 0 12px 30px rgba(77, 58, 32, 0.08) !important;
}

#gal-global-overlay.skin-gilded-twilight .gal-bottom-toolbar {
    background: linear-gradient(180deg, rgba(249, 248, 244, 0.68) 0%, rgba(249, 248, 244, 0.92) 100%) !important;
    border-top: 1px solid rgba(176, 141, 87, 0.16) !important;
    box-shadow: 0 -12px 30px rgba(80, 58, 34, 0.08) !important;
}

#gal-global-overlay.skin-gilded-twilight .gal-footer-btn,
#gal-global-overlay.skin-gilded-twilight .gal-pending-choices-btn,
#gal-global-overlay.skin-gilded-twilight .gal-action-btn {
    color: rgba(47, 40, 34, 0.56) !important;
    font-family: var(--twilight-label) !important;
    letter-spacing: 0.2em !important;
}

#gal-global-overlay.skin-gilded-twilight .gal-footer-btn:hover,
#gal-global-overlay.skin-gilded-twilight .gal-pending-choices-btn:hover,
#gal-global-overlay.skin-gilded-twilight .gal-action-btn:hover {
    background: rgba(176, 141, 87, 0.08) !important;
    color: var(--gilded-gold) !important;
}

#gal-global-overlay.skin-gilded-twilight .gal-pending-choices-btn.show {
    background: rgba(176, 141, 87, 0.14) !important;
    border-color: rgba(176, 141, 87, 0.24) !important;
    color: var(--gilded-gold) !important;
}

#gal-global-overlay.skin-gilded-twilight .gal-bottom-toolbar [data-action="show-choices"] {
    background: linear-gradient(180deg, rgba(176, 141, 87, 0.9) 0%, rgba(153, 118, 70, 0.92) 100%) !important;
    border-color: rgba(153, 118, 70, 0.96) !important;
    color: rgba(255, 250, 244, 0.96) !important;
}

#gal-layer-choices.skin-gilded-twilight {
    background:
      radial-gradient(120% 120% at 50% 0%, rgba(251, 242, 224, 0.5) 0%, rgba(251, 242, 224, 0.18) 36%, rgba(238, 227, 204, 0.1) 52%, rgba(238, 227, 204, 0.3) 100%),
      rgba(249, 248, 244, 0.72) !important;
    backdrop-filter: blur(18px) saturate(105%);
    -webkit-backdrop-filter: blur(18px) saturate(105%);
}

#gal-layer-choices.skin-gilded-twilight .gal-choices-title {
    color: var(--gilded-gold) !important;
    font-family: var(--twilight-headline) !important;
    letter-spacing: 0.24em !important;
}

#gal-layer-choices.skin-gilded-twilight .gal-choices-hint {
    color: rgba(47, 40, 34, 0.54) !important;
    font-family: var(--twilight-label) !important;
}

#gal-layer-choices.skin-gilded-twilight .gal-choice-card {
    border: 1px solid rgba(176, 141, 87, 0.22) !important;
    border-radius: 14px !important;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.22) 100%),
      rgba(249, 248, 244, 0.88) !important;
    color: rgba(47, 40, 34, 0.92) !important;
    font-family: var(--twilight-body) !important;
    box-shadow: 0 18px 42px rgba(77, 58, 32, 0.08) !important;
}

#gal-layer-choices.skin-gilded-twilight .gal-choice-card:hover {
    border-color: rgba(176, 141, 87, 0.4) !important;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.62) 0%, rgba(255, 255, 255, 0.28) 100%),
      rgba(253, 250, 240, 0.94) !important;
    color: #8f6d3f !important;
}

/* =========================================================
   0.2 晓暮 (Dawn Twilight) — 晨雾青蓝版
   参考: Desktop VN - Inline Choice Indicator v5
   只替换配色 / 字体 / 细节质感，结构与薄暮一致
   ========================================================= */
#gal-global-overlay.skin-dawn-twilight {
    --dawn-teal: #1a3a3a;
    --dawn-sky: #78a1bb;
    --dawn-silver: #b8c1c8;
    --dawn-deep: #0f172a;
    --dawn-surface: #1e293b;
    --dawn-outline: #334155;
    --dawn-text: #e2e8f0;
    --twilight-headline: "Montserrat", "PingFang SC", "Microsoft YaHei", sans-serif;
    --twilight-body: "Lato", "PingFang SC", "Microsoft YaHei", sans-serif;
    --twilight-label: "Montserrat", "PingFang SC", "Microsoft YaHei", sans-serif;
    color: rgba(226, 232, 240, 0.96) !important;
}

#gal-global-overlay.skin-dawn-twilight .gal-twilight-scrim {
    background:
        radial-gradient(72% 48% at 50% 18%, rgba(120, 161, 187, 0.14) 0%, rgba(120, 161, 187, 0) 58%),
        linear-gradient(180deg, rgba(2, 6, 23, 0.1) 0%, rgba(2, 6, 23, 0.02) 28%, rgba(15, 23, 42, 0.04) 58%, rgba(2, 6, 23, 0.22) 100%);
}

#gal-global-overlay.skin-dawn-twilight .gal-twilight-header {
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(15, 23, 42, 0.62) 100%) !important;
    border-bottom: 1px solid rgba(120, 161, 187, 0.16) !important;
    box-shadow: 0 12px 30px rgba(2, 6, 23, 0.22) !important;
}

#gal-global-overlay.skin-dawn-twilight .gal-twilight-brand {
    color: rgba(184, 193, 200, 0.98) !important;
    letter-spacing: 0.18em !important;
}

#gal-global-overlay.skin-dawn-twilight .gal-twilight-divider {
    background: rgba(120, 161, 187, 0.26) !important;
}

#gal-global-overlay.skin-dawn-twilight .gal-location-bar {
    color: rgba(120, 161, 187, 0.94) !important;
}

#gal-global-overlay.skin-dawn-twilight .gal-time-bar {
    color: rgba(184, 193, 200, 0.74) !important;
}

#gal-global-overlay.skin-dawn-twilight .gal-twilight-meta-btn {
    font-family: var(--twilight-label) !important;
    letter-spacing: 0.18em !important;
}

#gal-global-overlay.skin-dawn-twilight .gal-twilight-header-actions .gal-status-popup-trigger,
#gal-global-overlay.skin-dawn-twilight .gal-twilight-header-actions .gal-sprite-toggle,
#gal-global-overlay.skin-dawn-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle {
    color: rgba(184, 193, 200, 0.88) !important;
}

#gal-global-overlay.skin-dawn-twilight .gal-twilight-header-actions .gal-status-popup-icon,
#gal-global-overlay.skin-dawn-twilight .gal-eye-icon,
#gal-global-overlay.skin-dawn-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle i {
    color: rgba(184, 193, 200, 0.9) !important;
}

#gal-global-overlay.skin-dawn-twilight .gal-twilight-header-actions .gal-status-popup-trigger:hover,
#gal-global-overlay.skin-dawn-twilight .gal-twilight-header-actions .gal-sprite-toggle:hover,
#gal-global-overlay.skin-dawn-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle:hover,
#gal-global-overlay.skin-dawn-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle:focus-visible {
    background: rgba(120, 161, 187, 0.12) !important;
    box-shadow: inset 0 0 0 1px rgba(120, 161, 187, 0.2) !important;
}

#gal-global-overlay.skin-dawn-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action {
    border-color: rgba(120, 161, 187, 0.22) !important;
    background:
        linear-gradient(180deg, rgba(120, 161, 187, 0.1) 0%, rgba(120, 161, 187, 0.03) 100%),
        rgba(15, 23, 42, 0.66) !important;
    color: rgba(184, 193, 200, 0.9) !important;
    font-family: var(--twilight-label) !important;
    box-shadow:
        0 -2px 8px rgba(4, 10, 24, 0.14),
        inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
}

#gal-global-overlay.skin-dawn-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action:hover {
    background:
        linear-gradient(180deg, rgba(120, 161, 187, 0.16) 0%, rgba(120, 161, 187, 0.06) 100%),
        rgba(15, 23, 42, 0.78) !important;
    color: rgba(226, 232, 240, 0.98) !important;
}

#gal-global-overlay.skin-dawn-twilight .gal-name-badge {
    background: linear-gradient(135deg, rgba(26, 58, 58, 0.96) 0%, rgba(15, 23, 42, 0.96) 100%) !important;
    border: 1px solid rgba(120, 161, 187, 0.26) !important;
    box-shadow: 0 10px 24px rgba(2, 6, 23, 0.18) !important;
}

#gal-global-overlay.skin-dawn-twilight .gal-name-badge span {
    background: transparent !important;
    color: rgba(184, 193, 200, 0.98) !important;
    padding: 0 18px 0 16px !important;
}

#gal-global-overlay.skin-dawn-twilight .gal-text-panel {
    border: 1px solid rgba(120, 161, 187, 0.18) !important;
    background:
        linear-gradient(180deg, rgba(15, 23, 42, 0.52) 0%, rgba(2, 6, 23, 0.14) 100%),
        rgba(30, 41, 59, calc(var(--panel-opacity, 0.7) * 0.86)) !important;
    box-shadow:
        0 22px 56px rgba(2, 6, 23, 0.28),
        inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
    backdrop-filter: blur(16px) saturate(112%);
    -webkit-backdrop-filter: blur(16px) saturate(112%);
}

#gal-global-overlay.skin-dawn-twilight .gal-text-panel::before {
    opacity: 0.28 !important;
    background:
        linear-gradient(135deg, rgba(120, 161, 187, 0.08) 0%, rgba(120, 161, 187, 0) 36%),
        radial-gradient(circle at top left, rgba(184, 193, 200, 0.08) 0%, rgba(184, 193, 200, 0) 42%) !important;
}

#gal-global-overlay.skin-dawn-twilight .gal-text-panel:hover {
    background:
        linear-gradient(180deg, rgba(15, 23, 42, 0.62) 0%, rgba(2, 6, 23, 0.2) 100%),
        rgba(30, 41, 59, calc(var(--panel-opacity, 0.7) * 0.92)) !important;
    border-color: rgba(120, 161, 187, 0.28) !important;
    box-shadow:
        0 26px 62px rgba(2, 6, 23, 0.32),
        inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
}

#gal-global-overlay.skin-dawn-twilight .gal-dialog-text {
    color: rgba(226, 232, 240, 0.96) !important;
    font-family: var(--twilight-body) !important;
    letter-spacing: 0.03em !important;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.38) !important;
}

#gal-global-overlay.skin-dawn-twilight .gal-twilight-dialog-next-indicator,
#gal-global-overlay.skin-dawn-twilight .gal-twilight-dialog-next-indicator[data-state="end"] {
    color: rgba(120, 161, 187, 0.96) !important;
}

#gal-global-overlay.skin-dawn-twilight .gal-twilight-dialog-next-indicator i {
    color: rgba(120, 161, 187, 0.98) !important;
    text-shadow: 0 4px 16px rgba(120, 161, 187, 0.18) !important;
}

#gal-global-overlay.skin-dawn-twilight .gal-generating-indicator {
    border-color: rgba(120, 161, 187, 0.18) !important;
    background: rgba(15, 23, 42, 0.86) !important;
    color: rgba(226, 232, 240, 0.84) !important;
    box-shadow: 0 12px 30px rgba(2, 6, 23, 0.2) !important;
}

#gal-global-overlay.skin-dawn-twilight .gal-bottom-toolbar {
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.62) 0%, rgba(2, 6, 23, 0.92) 100%) !important;
    border-top: 1px solid rgba(120, 161, 187, 0.14) !important;
    box-shadow: 0 -12px 30px rgba(2, 6, 23, 0.2) !important;
}

#gal-global-overlay.skin-dawn-twilight .gal-footer-btn,
#gal-global-overlay.skin-dawn-twilight .gal-pending-choices-btn,
#gal-global-overlay.skin-dawn-twilight .gal-action-btn {
    color: rgba(184, 193, 200, 0.58) !important;
    font-family: var(--twilight-label) !important;
    letter-spacing: 0.18em !important;
}

#gal-global-overlay.skin-dawn-twilight .gal-footer-btn:hover,
#gal-global-overlay.skin-dawn-twilight .gal-pending-choices-btn:hover,
#gal-global-overlay.skin-dawn-twilight .gal-action-btn:hover {
    background: rgba(120, 161, 187, 0.12) !important;
    color: rgba(226, 232, 240, 0.98) !important;
}

#gal-global-overlay.skin-dawn-twilight .gal-pending-choices-btn.show {
    background: rgba(120, 161, 187, 0.16) !important;
    border-color: rgba(120, 161, 187, 0.24) !important;
    color: rgba(226, 232, 240, 0.98) !important;
}

#gal-global-overlay.skin-dawn-twilight .gal-bottom-toolbar [data-action="show-choices"] {
    background: linear-gradient(135deg, rgba(26, 58, 58, 0.88) 0%, rgba(120, 161, 187, 0.94) 100%) !important;
    border-color: rgba(120, 161, 187, 0.32) !important;
    color: rgba(255, 255, 255, 0.98) !important;
}

#gal-layer-choices.skin-dawn-twilight {
    background:
      radial-gradient(120% 120% at 50% 0%, rgba(120, 161, 187, 0.16) 0%, rgba(120, 161, 187, 0.05) 34%, rgba(15, 23, 42, 0.04) 52%, rgba(2, 6, 23, 0.24) 100%),
      rgba(2, 6, 23, 0.76) !important;
    backdrop-filter: blur(18px) saturate(112%);
    -webkit-backdrop-filter: blur(18px) saturate(112%);
}

#gal-layer-choices.skin-dawn-twilight .gal-choices-title {
    color: rgba(184, 193, 200, 0.98) !important;
    font-family: var(--twilight-headline) !important;
    letter-spacing: 0.18em !important;
}

#gal-layer-choices.skin-dawn-twilight .gal-choices-hint {
    color: rgba(184, 193, 200, 0.56) !important;
    font-family: var(--twilight-label) !important;
}

#gal-layer-choices.skin-dawn-twilight .gal-choice-card {
    border: 1px solid rgba(120, 161, 187, 0.18) !important;
    border-radius: 14px !important;
    background:
      linear-gradient(180deg, rgba(120, 161, 187, 0.08) 0%, rgba(120, 161, 187, 0.02) 100%),
      rgba(15, 23, 42, 0.88) !important;
    color: rgba(226, 232, 240, 0.94) !important;
    font-family: var(--twilight-body) !important;
    box-shadow: 0 18px 42px rgba(2, 6, 23, 0.18) !important;
}

#gal-layer-choices.skin-dawn-twilight .gal-choice-card:hover {
    border-color: rgba(120, 161, 187, 0.34) !important;
    background:
      linear-gradient(180deg, rgba(120, 161, 187, 0.14) 0%, rgba(120, 161, 187, 0.05) 100%),
      rgba(15, 23, 42, 0.94) !important;
    color: rgba(226, 232, 240, 1) !important;
}

/* =========================================================
   0.3 绯暮 (Orchid Twilight) — 紫暮琥珀版
   参考: Desktop VN - Inline Choice Indicator v5
   只替换配色 / 字体 / 细节质感，结构与薄暮一致
   ========================================================= */
#gal-global-overlay.skin-orchid-twilight {
    --orchid-plum: #2d1b2d;
    --orchid-amber: #ffbf69;
    --orchid-violet: #b79ced;
    --orchid-night: #1a1625;
    --orchid-blush: #e0b1cb;
    --orchid-cream: #f7e1d7;
    --twilight-headline: "Manrope", "PingFang SC", "Microsoft YaHei", sans-serif;
    --twilight-body: "Be Vietnam Pro", "PingFang SC", "Microsoft YaHei", sans-serif;
    --twilight-label: "Inter", "PingFang SC", "Microsoft YaHei", sans-serif;
    color: rgba(247, 225, 215, 0.96) !important;
}

#gal-global-overlay.skin-orchid-twilight .gal-twilight-scrim {
    background:
        radial-gradient(72% 48% at 50% 18%, rgba(224, 177, 203, 0.14) 0%, rgba(224, 177, 203, 0) 58%),
        linear-gradient(180deg, rgba(26, 22, 37, 0.08) 0%, rgba(26, 22, 37, 0.02) 28%, rgba(45, 27, 45, 0.04) 58%, rgba(26, 22, 37, 0.22) 100%);
}

#gal-global-overlay.skin-orchid-twilight .gal-twilight-header {
    background: linear-gradient(180deg, rgba(45, 27, 45, 0.9) 0%, rgba(26, 22, 37, 0.72) 100%) !important;
    border-bottom: 1px solid rgba(183, 156, 237, 0.18) !important;
    box-shadow: 0 12px 30px rgba(26, 22, 37, 0.24) !important;
}

#gal-global-overlay.skin-orchid-twilight .gal-twilight-brand {
    color: rgba(255, 191, 105, 0.96) !important;
    letter-spacing: 0.2em !important;
}

#gal-global-overlay.skin-orchid-twilight .gal-twilight-divider {
    background: rgba(183, 156, 237, 0.28) !important;
}

#gal-global-overlay.skin-orchid-twilight .gal-location-bar {
    color: rgba(224, 177, 203, 0.96) !important;
}

#gal-global-overlay.skin-orchid-twilight .gal-time-bar {
    color: rgba(247, 225, 215, 0.72) !important;
}

#gal-global-overlay.skin-orchid-twilight .gal-twilight-meta-btn {
    font-family: var(--twilight-label) !important;
    letter-spacing: 0.18em !important;
}

#gal-global-overlay.skin-orchid-twilight .gal-twilight-header-actions .gal-status-popup-trigger,
#gal-global-overlay.skin-orchid-twilight .gal-twilight-header-actions .gal-sprite-toggle,
#gal-global-overlay.skin-orchid-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle {
    color: rgba(247, 225, 215, 0.88) !important;
}

#gal-global-overlay.skin-orchid-twilight .gal-twilight-header-actions .gal-status-popup-icon,
#gal-global-overlay.skin-orchid-twilight .gal-eye-icon,
#gal-global-overlay.skin-orchid-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle i {
    color: rgba(255, 191, 105, 0.96) !important;
}

#gal-global-overlay.skin-orchid-twilight .gal-twilight-header-actions .gal-status-popup-trigger:hover,
#gal-global-overlay.skin-orchid-twilight .gal-twilight-header-actions .gal-sprite-toggle:hover,
#gal-global-overlay.skin-orchid-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle:hover,
#gal-global-overlay.skin-orchid-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle:focus-visible {
    background: rgba(183, 156, 237, 0.14) !important;
    box-shadow: inset 0 0 0 1px rgba(255, 191, 105, 0.16) !important;
}

#gal-global-overlay.skin-orchid-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action {
    border-color: rgba(183, 156, 237, 0.2) !important;
    background:
        linear-gradient(180deg, rgba(224, 177, 203, 0.12) 0%, rgba(224, 177, 203, 0.03) 100%),
        rgba(45, 27, 45, 0.7) !important;
    color: rgba(247, 225, 215, 0.94) !important;
    font-family: var(--twilight-label) !important;
    box-shadow:
        0 -2px 8px rgba(26, 22, 37, 0.14),
        inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
}

#gal-global-overlay.skin-orchid-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action:hover {
    background:
        linear-gradient(180deg, rgba(255, 191, 105, 0.16) 0%, rgba(183, 156, 237, 0.06) 100%),
        rgba(45, 27, 45, 0.82) !important;
    color: rgba(255, 243, 236, 0.98) !important;
}

#gal-global-overlay.skin-orchid-twilight .gal-name-badge {
    background: linear-gradient(135deg, rgba(45, 27, 45, 0.96) 0%, rgba(26, 22, 37, 0.96) 100%) !important;
    border: 1px solid rgba(255, 191, 105, 0.26) !important;
    box-shadow: 0 10px 24px rgba(26, 22, 37, 0.2) !important;
}

#gal-global-overlay.skin-orchid-twilight .gal-name-badge span {
    background: transparent !important;
    color: rgba(255, 191, 105, 0.98) !important;
    padding: 0 18px 0 16px !important;
}

#gal-global-overlay.skin-orchid-twilight .gal-text-panel {
    border: 1px solid rgba(183, 156, 237, 0.18) !important;
    background:
        linear-gradient(180deg, rgba(45, 27, 45, 0.56) 0%, rgba(26, 22, 37, 0.2) 100%),
        rgba(26, 22, 37, calc(var(--panel-opacity, 0.7) * 0.9)) !important;
    box-shadow:
        0 22px 56px rgba(26, 22, 37, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
    backdrop-filter: blur(16px) saturate(116%);
    -webkit-backdrop-filter: blur(16px) saturate(116%);
}

#gal-global-overlay.skin-orchid-twilight .gal-text-panel::before {
    opacity: 0.3 !important;
    background:
        linear-gradient(135deg, rgba(255, 191, 105, 0.1) 0%, rgba(255, 191, 105, 0) 36%),
        radial-gradient(circle at top left, rgba(183, 156, 237, 0.12) 0%, rgba(183, 156, 237, 0) 42%) !important;
}

#gal-global-overlay.skin-orchid-twilight .gal-text-panel:hover {
    background:
        linear-gradient(180deg, rgba(45, 27, 45, 0.66) 0%, rgba(26, 22, 37, 0.24) 100%),
        rgba(26, 22, 37, calc(var(--panel-opacity, 0.7) * 0.96)) !important;
    border-color: rgba(255, 191, 105, 0.24) !important;
    box-shadow:
        0 26px 62px rgba(26, 22, 37, 0.34),
        inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
}

#gal-global-overlay.skin-orchid-twilight .gal-dialog-text {
    color: rgba(247, 225, 215, 0.96) !important;
    font-family: var(--twilight-body) !important;
    letter-spacing: 0.03em !important;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4) !important;
}

#gal-global-overlay.skin-orchid-twilight .gal-twilight-dialog-next-indicator,
#gal-global-overlay.skin-orchid-twilight .gal-twilight-dialog-next-indicator[data-state="end"] {
    color: rgba(255, 191, 105, 0.96) !important;
}

#gal-global-overlay.skin-orchid-twilight .gal-twilight-dialog-next-indicator i {
    color: rgba(255, 191, 105, 0.98) !important;
    text-shadow: 0 4px 16px rgba(255, 191, 105, 0.2) !important;
}

#gal-global-overlay.skin-orchid-twilight .gal-generating-indicator {
    border-color: rgba(183, 156, 237, 0.2) !important;
    background: rgba(26, 22, 37, 0.88) !important;
    color: rgba(247, 225, 215, 0.84) !important;
    box-shadow: 0 12px 30px rgba(26, 22, 37, 0.2) !important;
}

#gal-global-overlay.skin-orchid-twilight .gal-bottom-toolbar {
    background: linear-gradient(180deg, rgba(45, 27, 45, 0.64) 0%, rgba(26, 22, 37, 0.94) 100%) !important;
    border-top: 1px solid rgba(183, 156, 237, 0.16) !important;
    box-shadow: 0 -12px 30px rgba(26, 22, 37, 0.2) !important;
}

#gal-global-overlay.skin-orchid-twilight .gal-footer-btn,
#gal-global-overlay.skin-orchid-twilight .gal-pending-choices-btn,
#gal-global-overlay.skin-orchid-twilight .gal-action-btn {
    color: rgba(247, 225, 215, 0.6) !important;
    font-family: var(--twilight-label) !important;
    letter-spacing: 0.16em !important;
}

#gal-global-overlay.skin-orchid-twilight .gal-footer-btn:hover,
#gal-global-overlay.skin-orchid-twilight .gal-pending-choices-btn:hover,
#gal-global-overlay.skin-orchid-twilight .gal-action-btn:hover {
    background: rgba(183, 156, 237, 0.12) !important;
    color: rgba(255, 191, 105, 0.98) !important;
}

#gal-global-overlay.skin-orchid-twilight .gal-pending-choices-btn.show {
    background: rgba(255, 191, 105, 0.16) !important;
    border-color: rgba(255, 191, 105, 0.24) !important;
    color: rgba(255, 243, 236, 0.98) !important;
}

#gal-global-overlay.skin-orchid-twilight .gal-bottom-toolbar [data-action="show-choices"] {
    background: linear-gradient(135deg, rgba(255, 191, 105, 0.94) 0%, rgba(183, 156, 237, 0.92) 100%) !important;
    border-color: rgba(255, 191, 105, 0.34) !important;
    color: rgba(26, 22, 37, 0.96) !important;
}

#gal-layer-choices.skin-orchid-twilight {
    background:
      radial-gradient(120% 120% at 50% 0%, rgba(224, 177, 203, 0.18) 0%, rgba(224, 177, 203, 0.05) 34%, rgba(45, 27, 45, 0.06) 52%, rgba(26, 22, 37, 0.28) 100%),
      rgba(26, 22, 37, 0.78) !important;
    backdrop-filter: blur(18px) saturate(116%);
    -webkit-backdrop-filter: blur(18px) saturate(116%);
}

#gal-layer-choices.skin-orchid-twilight .gal-choices-title {
    color: rgba(255, 191, 105, 0.98) !important;
    font-family: var(--twilight-headline) !important;
    letter-spacing: 0.2em !important;
}

#gal-layer-choices.skin-orchid-twilight .gal-choices-hint {
    color: rgba(247, 225, 215, 0.58) !important;
    font-family: var(--twilight-label) !important;
}

#gal-layer-choices.skin-orchid-twilight .gal-choice-card {
    border: 1px solid rgba(183, 156, 237, 0.18) !important;
    border-radius: 14px !important;
    background:
      linear-gradient(180deg, rgba(224, 177, 203, 0.08) 0%, rgba(224, 177, 203, 0.02) 100%),
      rgba(45, 27, 45, 0.86) !important;
    color: rgba(247, 225, 215, 0.94) !important;
    font-family: var(--twilight-body) !important;
    box-shadow: 0 18px 42px rgba(26, 22, 37, 0.18) !important;
}

#gal-layer-choices.skin-orchid-twilight .gal-choice-card:hover {
    border-color: rgba(255, 191, 105, 0.34) !important;
    background:
      linear-gradient(180deg, rgba(255, 191, 105, 0.14) 0%, rgba(183, 156, 237, 0.06) 100%),
      rgba(45, 27, 45, 0.92) !important;
    color: rgba(255, 243, 236, 0.98) !important;
}

/* =========================================================
   0.4 霓暮 (Neon Twilight) — 赛博霓虹版
   参考: Desktop VN - Inline Choice Indicator v5
   只替换配色 / 字体 / 细节质感，结构与薄暮一致
   ========================================================= */
#gal-global-overlay.skin-neon-twilight {
    --neon-cyan: #00f2ff;
    --neon-violet: #7000ff;
    --neon-pink: #ff00e5;
    --neon-green: #00ff8c;
    --neon-surface: #0a0a0f;
    --neon-surface-soft: #131320;
    --neon-ink: #f0f0ff;
    --twilight-headline: "Oswald", "PingFang SC", "Microsoft YaHei", sans-serif;
    --twilight-body: "Poppins", "PingFang SC", "Microsoft YaHei", sans-serif;
    --twilight-label: "Oswald", "PingFang SC", "Microsoft YaHei", sans-serif;
    color: rgba(240, 240, 255, 0.98) !important;
}

#gal-global-overlay.skin-neon-twilight .gal-twilight-scrim {
    background:
        radial-gradient(72% 48% at 50% 18%, rgba(0, 242, 255, 0.12) 0%, rgba(0, 242, 255, 0) 58%),
        linear-gradient(180deg, rgba(10, 10, 15, 0.08) 0%, rgba(10, 10, 15, 0.02) 28%, rgba(112, 0, 255, 0.04) 58%, rgba(10, 10, 15, 0.26) 100%);
}

#gal-global-overlay.skin-neon-twilight .gal-twilight-header {
    background: linear-gradient(180deg, rgba(10, 10, 15, 0.92) 0%, rgba(19, 19, 32, 0.76) 100%) !important;
    border-bottom: 1px solid rgba(0, 242, 255, 0.18) !important;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.36), 0 0 26px rgba(0, 242, 255, 0.08) !important;
}

#gal-global-overlay.skin-neon-twilight .gal-twilight-brand {
    color: rgba(0, 242, 255, 0.98) !important;
    letter-spacing: 0.24em !important;
    text-shadow: 0 0 18px rgba(0, 242, 255, 0.24) !important;
}

#gal-global-overlay.skin-neon-twilight .gal-twilight-divider {
    background: linear-gradient(90deg, rgba(0, 242, 255, 0.34), rgba(255, 0, 229, 0.34)) !important;
}

#gal-global-overlay.skin-neon-twilight .gal-location-bar {
    color: rgba(0, 242, 255, 0.96) !important;
}

#gal-global-overlay.skin-neon-twilight .gal-time-bar {
    color: rgba(240, 240, 255, 0.7) !important;
}

#gal-global-overlay.skin-neon-twilight .gal-twilight-meta-btn {
    font-family: var(--twilight-label) !important;
    letter-spacing: 0.2em !important;
}

#gal-global-overlay.skin-neon-twilight .gal-twilight-header-actions .gal-status-popup-trigger,
#gal-global-overlay.skin-neon-twilight .gal-twilight-header-actions .gal-sprite-toggle,
#gal-global-overlay.skin-neon-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle {
    color: rgba(240, 240, 255, 0.88) !important;
}

#gal-global-overlay.skin-neon-twilight .gal-twilight-header-actions .gal-status-popup-icon,
#gal-global-overlay.skin-neon-twilight .gal-eye-icon,
#gal-global-overlay.skin-neon-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle i {
    color: rgba(0, 242, 255, 0.98) !important;
}

#gal-global-overlay.skin-neon-twilight .gal-twilight-header-actions .gal-status-popup-trigger:hover,
#gal-global-overlay.skin-neon-twilight .gal-twilight-header-actions .gal-sprite-toggle:hover,
#gal-global-overlay.skin-neon-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle:hover,
#gal-global-overlay.skin-neon-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle:focus-visible {
    background: rgba(0, 242, 255, 0.12) !important;
    box-shadow: inset 0 0 0 1px rgba(255, 0, 229, 0.18), 0 0 18px rgba(0, 242, 255, 0.08) !important;
}

#gal-global-overlay.skin-neon-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action {
    border-color: rgba(0, 242, 255, 0.22) !important;
    background:
        linear-gradient(180deg, rgba(0, 242, 255, 0.08) 0%, rgba(112, 0, 255, 0.06) 100%),
        rgba(10, 10, 15, 0.72) !important;
    color: rgba(240, 240, 255, 0.96) !important;
    font-family: var(--twilight-label) !important;
    box-shadow:
        0 -2px 8px rgba(0, 0, 0, 0.16),
        inset 0 1px 0 rgba(255, 255, 255, 0.06),
        0 0 18px rgba(0, 242, 255, 0.06) !important;
}

#gal-global-overlay.skin-neon-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action:hover {
    background:
        linear-gradient(180deg, rgba(0, 242, 255, 0.16) 0%, rgba(255, 0, 229, 0.08) 100%),
        rgba(10, 10, 15, 0.82) !important;
    color: rgba(255, 255, 255, 0.98) !important;
}

#gal-global-overlay.skin-neon-twilight .gal-name-badge {
    background: linear-gradient(90deg, rgba(112, 0, 255, 0.94) 0%, rgba(0, 242, 255, 0.96) 100%) !important;
    border: 1px solid rgba(0, 242, 255, 0.24) !important;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24), 0 0 18px rgba(112, 0, 255, 0.14) !important;
}

#gal-global-overlay.skin-neon-twilight .gal-name-badge span {
    background: transparent !important;
    color: rgba(10, 10, 15, 0.98) !important;
    padding: 0 18px 0 16px !important;
    text-transform: uppercase;
}

#gal-global-overlay.skin-neon-twilight .gal-text-panel {
    border: 1px solid transparent !important;
    background:
        linear-gradient(180deg, rgba(0, 0, 0, 0.62) 0%, rgba(10, 10, 15, 0.82) 100%) padding-box,
        linear-gradient(90deg, rgba(112, 0, 255, 0.78) 0%, rgba(0, 242, 255, 0.82) 100%) border-box !important;
    box-shadow:
        0 22px 56px rgba(0, 0, 0, 0.46),
        inset 0 1px 0 rgba(255, 255, 255, 0.04),
        0 0 22px rgba(0, 242, 255, 0.06),
        0 0 16px rgba(112, 0, 255, 0.08) !important;
    backdrop-filter: blur(16px) saturate(120%);
    -webkit-backdrop-filter: blur(16px) saturate(120%);
}

#gal-global-overlay.skin-neon-twilight .gal-text-panel::before {
    opacity: 0.2 !important;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0) 38%),
        radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.06) 1px, transparent 0) !important;
    background-size: auto, 20px 20px !important;
}

#gal-global-overlay.skin-neon-twilight .gal-text-panel:hover {
    background:
        linear-gradient(180deg, rgba(0, 0, 0, 0.7) 0%, rgba(10, 10, 15, 0.88) 100%) padding-box,
        linear-gradient(90deg, rgba(112, 0, 255, 0.88) 0%, rgba(0, 242, 255, 0.92) 100%) border-box !important;
    border-color: transparent !important;
    box-shadow:
        0 26px 62px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.05),
        0 0 24px rgba(0, 242, 255, 0.08),
        0 0 18px rgba(112, 0, 255, 0.1) !important;
}

#gal-global-overlay.skin-neon-twilight .gal-dialog-text {
    color: rgba(240, 240, 255, 0.98) !important;
    font-family: var(--twilight-body) !important;
    letter-spacing: 0.04em !important;
    text-shadow: 0 0 12px rgba(112, 0, 255, 0.18) !important;
}

#gal-global-overlay.skin-neon-twilight .gal-twilight-dialog-next-indicator,
#gal-global-overlay.skin-neon-twilight .gal-twilight-dialog-next-indicator[data-state="end"] {
    color: rgba(0, 242, 255, 0.98) !important;
}

#gal-global-overlay.skin-neon-twilight .gal-twilight-dialog-next-indicator i {
    color: rgba(255, 0, 229, 0.98) !important;
    text-shadow: 0 0 18px rgba(255, 0, 229, 0.22) !important;
}

#gal-global-overlay.skin-neon-twilight .gal-generating-indicator {
    border-color: rgba(0, 242, 255, 0.22) !important;
    background: rgba(10, 10, 15, 0.9) !important;
    color: rgba(240, 240, 255, 0.88) !important;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.24), 0 0 22px rgba(0, 242, 255, 0.08) !important;
}

#gal-global-overlay.skin-neon-twilight .gal-bottom-toolbar {
    background: linear-gradient(180deg, rgba(19, 19, 32, 0.74) 0%, rgba(10, 10, 15, 0.96) 100%) !important;
    border-top: 1px solid rgba(0, 242, 255, 0.14) !important;
    box-shadow: 0 -12px 30px rgba(0, 0, 0, 0.26), 0 0 24px rgba(0, 242, 255, 0.06) !important;
}

#gal-global-overlay.skin-neon-twilight .gal-footer-btn,
#gal-global-overlay.skin-neon-twilight .gal-pending-choices-btn,
#gal-global-overlay.skin-neon-twilight .gal-action-btn {
    color: rgba(240, 240, 255, 0.62) !important;
    font-family: var(--twilight-label) !important;
    letter-spacing: 0.18em !important;
}

#gal-global-overlay.skin-neon-twilight .gal-footer-btn:hover,
#gal-global-overlay.skin-neon-twilight .gal-pending-choices-btn:hover,
#gal-global-overlay.skin-neon-twilight .gal-action-btn:hover {
    background: rgba(0, 242, 255, 0.1) !important;
    color: rgba(0, 242, 255, 0.98) !important;
}

#gal-global-overlay.skin-neon-twilight .gal-pending-choices-btn.show {
    background: rgba(255, 0, 229, 0.16) !important;
    border-color: rgba(255, 0, 229, 0.26) !important;
    color: rgba(255, 255, 255, 0.98) !important;
}

#gal-global-overlay.skin-neon-twilight .gal-bottom-toolbar [data-action="show-choices"] {
    background: linear-gradient(135deg, rgba(0, 242, 255, 0.96) 0%, rgba(112, 0, 255, 0.94) 52%, rgba(255, 0, 229, 0.92) 100%) !important;
    border-color: rgba(0, 242, 255, 0.38) !important;
    color: rgba(10, 10, 15, 0.98) !important;
}

#gal-layer-choices.skin-neon-twilight {
    background:
      radial-gradient(120% 120% at 50% 0%, rgba(0, 242, 255, 0.14) 0%, rgba(0, 242, 255, 0.04) 34%, rgba(112, 0, 255, 0.06) 52%, rgba(10, 10, 15, 0.36) 100%),
      rgba(10, 10, 15, 0.82) !important;
    backdrop-filter: blur(18px) saturate(122%);
    -webkit-backdrop-filter: blur(18px) saturate(122%);
}

#gal-layer-choices.skin-neon-twilight .gal-choices-title {
    color: rgba(0, 242, 255, 0.98) !important;
    font-family: var(--twilight-headline) !important;
    letter-spacing: 0.24em !important;
    text-shadow: 0 0 18px rgba(0, 242, 255, 0.16) !important;
}

#gal-layer-choices.skin-neon-twilight .gal-choices-hint {
    color: rgba(240, 240, 255, 0.58) !important;
    font-family: var(--twilight-label) !important;
}

#gal-layer-choices.skin-neon-twilight .gal-choice-card {
    border: 1px solid rgba(0, 242, 255, 0.18) !important;
    border-radius: 14px !important;
    background:
      linear-gradient(180deg, rgba(0, 242, 255, 0.08) 0%, rgba(255, 0, 229, 0.03) 100%),
      rgba(19, 19, 32, 0.9) !important;
    color: rgba(240, 240, 255, 0.96) !important;
    font-family: var(--twilight-body) !important;
    box-shadow: 0 18px 42px rgba(0, 0, 0, 0.24), 0 0 24px rgba(0, 242, 255, 0.06) !important;
}

#gal-layer-choices.skin-neon-twilight .gal-choice-card:hover {
    border-color: rgba(255, 0, 229, 0.34) !important;
    background:
      linear-gradient(180deg, rgba(0, 242, 255, 0.14) 0%, rgba(255, 0, 229, 0.08) 100%),
      rgba(19, 19, 32, 0.96) !important;
    color: rgba(255, 255, 255, 0.98) !important;
}

/* =========================================================
   0.5 澄暮 (Clear Twilight) — 白雾玻璃版
   参考: Desktop VN - Inline Choice Indicator v5
   只替换配色 / 字体 / 细节质感，结构与薄暮一致
   ========================================================= */
#gal-global-overlay.skin-clear-twilight {
    --clear-white: rgba(255, 255, 255, 0.74);
    --clear-white-soft: rgba(255, 255, 255, 0.58);
    --clear-charcoal: #1a1a1c;
    --clear-charcoal-soft: rgba(26, 26, 28, 0.62);
    --clear-sky: #0ea5e9;
    --clear-sky-soft: #e0f2fe;
    --clear-panel-border: rgba(0, 0, 0, 0.08);
    --clear-on-sky: #0369a1;
    --twilight-headline: "Inter", "PingFang SC", "Microsoft YaHei", sans-serif;
    --twilight-body: "Inter", "PingFang SC", "Microsoft YaHei", sans-serif;
    --twilight-label: "Inter", "PingFang SC", "Microsoft YaHei", sans-serif;
    color: rgba(26, 26, 28, 0.96) !important;
}

#gal-global-overlay.skin-clear-twilight .gal-twilight-scrim {
    background:
        radial-gradient(72% 48% at 50% 18%, rgba(224, 242, 254, 0.24) 0%, rgba(224, 242, 254, 0) 58%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.03) 28%, rgba(224, 242, 254, 0.04) 58%, rgba(255, 255, 255, 0.18) 100%);
}

#gal-global-overlay.skin-clear-twilight .gal-twilight-header {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.74) 0%, rgba(255, 255, 255, 0.58) 100%) !important;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08) !important;
    box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08) !important;
}

#gal-global-overlay.skin-clear-twilight .gal-twilight-brand {
    color: rgba(26, 26, 28, 0.94) !important;
    letter-spacing: 0.16em !important;
}

#gal-global-overlay.skin-clear-twilight .gal-twilight-divider {
    background: rgba(14, 165, 233, 0.22) !important;
}

#gal-global-overlay.skin-clear-twilight .gal-location-bar {
    color: rgba(14, 165, 233, 0.92) !important;
}

#gal-global-overlay.skin-clear-twilight .gal-time-bar {
    color: rgba(26, 26, 28, 0.54) !important;
}

#gal-global-overlay.skin-clear-twilight .gal-twilight-meta-btn {
    font-family: var(--twilight-label) !important;
    letter-spacing: 0.14em !important;
}

#gal-global-overlay.skin-clear-twilight .gal-twilight-header-actions .gal-status-popup-trigger,
#gal-global-overlay.skin-clear-twilight .gal-twilight-header-actions .gal-sprite-toggle,
#gal-global-overlay.skin-clear-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle {
    color: rgba(26, 26, 28, 0.76) !important;
}

#gal-global-overlay.skin-clear-twilight .gal-twilight-header-actions .gal-status-popup-icon,
#gal-global-overlay.skin-clear-twilight .gal-eye-icon,
#gal-global-overlay.skin-clear-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle i {
    color: rgba(26, 26, 28, 0.82) !important;
}

#gal-global-overlay.skin-clear-twilight .gal-twilight-header-actions .gal-status-popup-trigger:hover,
#gal-global-overlay.skin-clear-twilight .gal-twilight-header-actions .gal-sprite-toggle:hover,
#gal-global-overlay.skin-clear-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle:hover,
#gal-global-overlay.skin-clear-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle:focus-visible {
    background: rgba(0, 0, 0, 0.05) !important;
    box-shadow: inset 0 0 0 1px rgba(14, 165, 233, 0.14) !important;
}

#gal-global-overlay.skin-clear-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action {
    border-color: rgba(0, 0, 0, 0.08) !important;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.82) 0%, rgba(255, 255, 255, 0.62) 100%),
        rgba(255, 255, 255, 0.72) !important;
    color: rgba(26, 26, 28, 0.82) !important;
    font-family: var(--twilight-label) !important;
    box-shadow: 0 -2px 8px rgba(148, 163, 184, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.52) !important;
}

#gal-global-overlay.skin-clear-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action:hover {
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.9) 0%, rgba(224, 242, 254, 0.72) 100%),
        rgba(255, 255, 255, 0.84) !important;
    color: rgba(14, 165, 233, 0.92) !important;
}

#gal-global-overlay.skin-clear-twilight .gal-name-badge {
    background: linear-gradient(180deg, rgba(224, 242, 254, 0.98) 0%, rgba(248, 250, 252, 0.96) 100%) !important;
    border: 1px solid rgba(14, 165, 233, 0.14) !important;
    box-shadow: 0 10px 24px rgba(148, 163, 184, 0.08) !important;
}

#gal-global-overlay.skin-clear-twilight .gal-name-badge span {
    background: transparent !important;
    color: rgba(3, 105, 161, 0.94) !important;
    padding: 0 22px !important;
}

#gal-global-overlay.skin-clear-twilight .gal-text-panel {
    border: 1px solid rgba(0, 0, 0, 0.06) !important;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.78) 0%, rgba(255, 255, 255, 0.54) 100%),
        rgba(255, 255, 255, calc(var(--panel-opacity, 0.7) * 0.9)) !important;
    box-shadow:
        0 22px 52px rgba(148, 163, 184, 0.12),
        inset 0 1px 0 rgba(255, 255, 255, 0.52) !important;
    backdrop-filter: blur(16px) saturate(106%);
    -webkit-backdrop-filter: blur(16px) saturate(106%);
}

#gal-global-overlay.skin-clear-twilight .gal-text-panel::before {
    opacity: 0.26 !important;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0) 36%),
        radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.03) 1px, transparent 0) !important;
    background-size: auto, 18px 18px !important;
}

#gal-global-overlay.skin-clear-twilight .gal-text-panel:hover {
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.88) 0%, rgba(255, 255, 255, 0.64) 100%),
        rgba(255, 255, 255, calc(var(--panel-opacity, 0.7) * 0.96)) !important;
    border-color: rgba(14, 165, 233, 0.12) !important;
    box-shadow:
        0 24px 56px rgba(148, 163, 184, 0.14),
        inset 0 1px 0 rgba(255, 255, 255, 0.6) !important;
}

#gal-global-overlay.skin-clear-twilight .gal-dialog-text {
    color: rgba(26, 26, 28, 0.94) !important;
    font-family: var(--twilight-body) !important;
    letter-spacing: 0.02em !important;
    text-shadow: none !important;
}

#gal-global-overlay.skin-clear-twilight .gal-twilight-dialog-next-indicator,
#gal-global-overlay.skin-clear-twilight .gal-twilight-dialog-next-indicator[data-state="end"] {
    color: rgba(14, 165, 233, 0.92) !important;
}

#gal-global-overlay.skin-clear-twilight .gal-twilight-dialog-next-indicator i {
    color: rgba(14, 165, 233, 0.94) !important;
    text-shadow: 0 4px 16px rgba(14, 165, 233, 0.12) !important;
}

#gal-global-overlay.skin-clear-twilight .gal-generating-indicator {
    border-color: rgba(0, 0, 0, 0.06) !important;
    background: rgba(255, 255, 255, 0.9) !important;
    color: rgba(26, 26, 28, 0.78) !important;
    box-shadow: 0 12px 28px rgba(148, 163, 184, 0.1) !important;
}

#gal-global-overlay.skin-clear-twilight .gal-bottom-toolbar {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.62) 0%, rgba(255, 255, 255, 0.84) 100%) !important;
    border-top: 1px solid rgba(0, 0, 0, 0.05) !important;
    box-shadow: 0 -10px 26px rgba(148, 163, 184, 0.08) !important;
}

#gal-global-overlay.skin-clear-twilight .gal-footer-btn,
#gal-global-overlay.skin-clear-twilight .gal-pending-choices-btn,
#gal-global-overlay.skin-clear-twilight .gal-action-btn {
    color: rgba(26, 26, 28, 0.56) !important;
    font-family: var(--twilight-label) !important;
    letter-spacing: 0.14em !important;
}

#gal-global-overlay.skin-clear-twilight .gal-footer-btn:hover,
#gal-global-overlay.skin-clear-twilight .gal-pending-choices-btn:hover,
#gal-global-overlay.skin-clear-twilight .gal-action-btn:hover {
    background: rgba(0, 0, 0, 0.05) !important;
    color: rgba(26, 26, 28, 0.9) !important;
}

#gal-global-overlay.skin-clear-twilight .gal-pending-choices-btn.show {
    background: rgba(224, 242, 254, 0.86) !important;
    border-color: rgba(14, 165, 233, 0.14) !important;
    color: rgba(3, 105, 161, 0.94) !important;
}

#gal-global-overlay.skin-clear-twilight .gal-bottom-toolbar [data-action="show-choices"] {
    background: linear-gradient(180deg, rgba(14, 165, 233, 0.92) 0%, rgba(2, 132, 199, 0.94) 100%) !important;
    border-color: rgba(14, 165, 233, 0.3) !important;
    color: rgba(255, 255, 255, 0.98) !important;
}

#gal-layer-choices.skin-clear-twilight {
    background:
      radial-gradient(120% 120% at 50% 0%, rgba(224, 242, 254, 0.28) 0%, rgba(224, 242, 254, 0.1) 36%, rgba(255, 255, 255, 0.08) 52%, rgba(255, 255, 255, 0.32) 100%),
      rgba(255, 255, 255, 0.58) !important;
    backdrop-filter: blur(18px) saturate(104%);
    -webkit-backdrop-filter: blur(18px) saturate(104%);
}

#gal-layer-choices.skin-clear-twilight .gal-choices-title {
    color: rgba(14, 165, 233, 0.94) !important;
    font-family: var(--twilight-headline) !important;
    letter-spacing: 0.16em !important;
}

#gal-layer-choices.skin-clear-twilight .gal-choices-hint {
    color: rgba(26, 26, 28, 0.48) !important;
    font-family: var(--twilight-label) !important;
}

#gal-layer-choices.skin-clear-twilight .gal-choice-card {
    border: 1px solid rgba(0, 0, 0, 0.06) !important;
    border-radius: 16px !important;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.82) 0%, rgba(255, 255, 255, 0.62) 100%),
      rgba(255, 255, 255, 0.84) !important;
    color: rgba(26, 26, 28, 0.92) !important;
    font-family: var(--twilight-body) !important;
    box-shadow: 0 18px 40px rgba(148, 163, 184, 0.1) !important;
}

#gal-layer-choices.skin-clear-twilight .gal-choice-card:hover {
    border-color: rgba(14, 165, 233, 0.16) !important;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(224, 242, 254, 0.74) 100%),
      rgba(255, 255, 255, 0.9) !important;
    color: rgba(3, 105, 161, 0.96) !important;
}

/* =========================================================
   0.6 森暮 (Forest Twilight) — 深林魔契版
   参考: Desktop VN - Inline Choice Indicator v5
   只替换配色 / 字体 / 细节质感，结构与薄暮一致
   ========================================================= */
#gal-global-overlay.skin-forest-twilight {
    --forest-deep: #0a1f16;
    --forest-moss: #1e3a2a;
    --forest-earth: #3d2b1f;
    --forest-gold: #d4af37;
    --forest-ether: #a5f3fc;
    --forest-outline: #4a454e;
    --twilight-headline: "Cinzel Decorative", "Noto Serif SC", "Source Han Serif SC", serif;
    --twilight-body: "Lora", "Noto Serif SC", "Source Han Serif SC", serif;
    --twilight-label: "Lora", "Noto Serif SC", "Source Han Serif SC", serif;
    color: rgba(243, 244, 246, 0.96) !important;
}

#gal-global-overlay.skin-forest-twilight .gal-twilight-scrim {
    background:
        radial-gradient(72% 48% at 50% 18%, rgba(165, 243, 252, 0.12) 0%, rgba(165, 243, 252, 0) 58%),
        linear-gradient(180deg, rgba(5, 15, 11, 0.08) 0%, rgba(5, 15, 11, 0.02) 28%, rgba(61, 43, 31, 0.05) 58%, rgba(5, 15, 11, 0.28) 100%);
}

#gal-global-overlay.skin-forest-twilight .gal-twilight-header {
    background: linear-gradient(180deg, rgba(10, 31, 22, 0.9) 0%, rgba(10, 31, 22, 0.72) 100%) !important;
    border-bottom: 1px solid rgba(212, 175, 55, 0.16) !important;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28) !important;
}

#gal-global-overlay.skin-forest-twilight .gal-twilight-brand {
    color: rgba(212, 175, 55, 0.98) !important;
    letter-spacing: 0.22em !important;
    text-shadow: 0 0 18px rgba(212, 175, 55, 0.14) !important;
}

#gal-global-overlay.skin-forest-twilight .gal-twilight-divider {
    background: rgba(212, 175, 55, 0.22) !important;
}

#gal-global-overlay.skin-forest-twilight .gal-location-bar {
    color: rgba(165, 243, 252, 0.88) !important;
}

#gal-global-overlay.skin-forest-twilight .gal-time-bar {
    color: rgba(212, 175, 55, 0.62) !important;
}

#gal-global-overlay.skin-forest-twilight .gal-twilight-meta-btn {
    font-family: var(--twilight-label) !important;
    letter-spacing: 0.14em !important;
}

#gal-global-overlay.skin-forest-twilight .gal-twilight-header-actions .gal-status-popup-trigger,
#gal-global-overlay.skin-forest-twilight .gal-twilight-header-actions .gal-sprite-toggle,
#gal-global-overlay.skin-forest-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle {
    color: rgba(165, 243, 252, 0.78) !important;
}

#gal-global-overlay.skin-forest-twilight .gal-twilight-header-actions .gal-status-popup-icon,
#gal-global-overlay.skin-forest-twilight .gal-eye-icon,
#gal-global-overlay.skin-forest-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle i {
    color: rgba(165, 243, 252, 0.86) !important;
}

#gal-global-overlay.skin-forest-twilight .gal-twilight-header-actions .gal-status-popup-trigger:hover,
#gal-global-overlay.skin-forest-twilight .gal-twilight-header-actions .gal-sprite-toggle:hover,
#gal-global-overlay.skin-forest-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle:hover,
#gal-global-overlay.skin-forest-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle:focus-visible {
    background: rgba(212, 175, 55, 0.08) !important;
    box-shadow: inset 0 0 0 1px rgba(212, 175, 55, 0.12) !important;
}

#gal-global-overlay.skin-forest-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action {
    border-color: rgba(212, 175, 55, 0.16) !important;
    background:
        linear-gradient(180deg, rgba(61, 43, 31, 0.52) 0%, rgba(30, 58, 42, 0.6) 100%),
        rgba(10, 31, 22, 0.76) !important;
    color: rgba(212, 175, 55, 0.94) !important;
    font-family: var(--twilight-label) !important;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
}

#gal-global-overlay.skin-forest-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action:hover {
    background:
        linear-gradient(180deg, rgba(61, 43, 31, 0.66) 0%, rgba(30, 58, 42, 0.72) 100%),
        rgba(10, 31, 22, 0.82) !important;
    color: rgba(243, 244, 246, 0.98) !important;
}

#gal-global-overlay.skin-forest-twilight .gal-name-badge {
    background: linear-gradient(90deg, rgba(61, 43, 31, 0.96) 0%, rgba(30, 58, 42, 0.96) 100%) !important;
    border: 1px solid rgba(212, 175, 55, 0.22) !important;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22) !important;
}

#gal-global-overlay.skin-forest-twilight .gal-name-badge span {
    background: transparent !important;
    color: rgba(212, 175, 55, 0.98) !important;
    padding: 0 22px !important;
}

#gal-global-overlay.skin-forest-twilight .gal-text-panel {
    border: 1px solid rgba(212, 175, 55, 0.16) !important;
    background:
        linear-gradient(180deg, rgba(10, 31, 22, 0.86) 0%, rgba(5, 15, 11, 0.74) 100%),
        rgba(10, 31, 22, calc(var(--panel-opacity, 0.7) * 0.92)) !important;
    box-shadow:
        0 22px 52px rgba(0, 0, 0, 0.32),
        inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
    backdrop-filter: blur(16px) saturate(112%);
    -webkit-backdrop-filter: blur(16px) saturate(112%);
}

#gal-global-overlay.skin-forest-twilight .gal-text-panel::before {
    opacity: 0.28 !important;
    background:
        linear-gradient(135deg, rgba(212, 175, 55, 0.08) 0%, rgba(212, 175, 55, 0) 36%),
        radial-gradient(circle at 1px 1px, rgba(165, 243, 252, 0.05) 1px, transparent 0) !important;
    background-size: auto, 18px 18px !important;
}

#gal-global-overlay.skin-forest-twilight .gal-text-panel:hover {
    background:
        linear-gradient(180deg, rgba(10, 31, 22, 0.92) 0%, rgba(5, 15, 11, 0.8) 100%),
        rgba(10, 31, 22, calc(var(--panel-opacity, 0.7) * 0.98)) !important;
    border-color: rgba(212, 175, 55, 0.24) !important;
    box-shadow:
        0 24px 56px rgba(0, 0, 0, 0.36),
        inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
}

#gal-global-overlay.skin-forest-twilight .gal-dialog-text {
    color: rgba(243, 244, 246, 0.96) !important;
    font-family: var(--twilight-body) !important;
    font-style: italic !important;
    letter-spacing: 0.03em !important;
    text-shadow: 0 0 12px rgba(165, 243, 252, 0.08) !important;
}

#gal-global-overlay.skin-forest-twilight .gal-twilight-dialog-next-indicator,
#gal-global-overlay.skin-forest-twilight .gal-twilight-dialog-next-indicator[data-state="end"] {
    color: rgba(212, 175, 55, 0.96) !important;
}

#gal-global-overlay.skin-forest-twilight .gal-twilight-dialog-next-indicator i {
    color: rgba(212, 175, 55, 0.98) !important;
    text-shadow: 0 0 16px rgba(212, 175, 55, 0.16) !important;
}

#gal-global-overlay.skin-forest-twilight .gal-generating-indicator {
    border-color: rgba(212, 175, 55, 0.18) !important;
    background: rgba(10, 31, 22, 0.9) !important;
    color: rgba(243, 244, 246, 0.82) !important;
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22) !important;
}

#gal-global-overlay.skin-forest-twilight .gal-bottom-toolbar {
    background: linear-gradient(180deg, rgba(10, 31, 22, 0.76) 0%, rgba(5, 15, 11, 0.94) 100%) !important;
    border-top: 1px solid rgba(212, 175, 55, 0.12) !important;
    box-shadow: 0 -10px 28px rgba(0, 0, 0, 0.24) !important;
}

#gal-global-overlay.skin-forest-twilight .gal-footer-btn,
#gal-global-overlay.skin-forest-twilight .gal-pending-choices-btn,
#gal-global-overlay.skin-forest-twilight .gal-action-btn {
    color: rgba(212, 175, 55, 0.56) !important;
    font-family: var(--twilight-label) !important;
    letter-spacing: 0.16em !important;
}

#gal-global-overlay.skin-forest-twilight .gal-footer-btn:hover,
#gal-global-overlay.skin-forest-twilight .gal-pending-choices-btn:hover,
#gal-global-overlay.skin-forest-twilight .gal-action-btn:hover {
    background: rgba(212, 175, 55, 0.08) !important;
    color: rgba(212, 175, 55, 0.98) !important;
}

#gal-global-overlay.skin-forest-twilight .gal-pending-choices-btn.show {
    background: rgba(165, 243, 252, 0.12) !important;
    border-color: rgba(165, 243, 252, 0.18) !important;
    color: rgba(165, 243, 252, 0.9) !important;
}

#gal-global-overlay.skin-forest-twilight .gal-bottom-toolbar [data-action="show-choices"] {
    background: linear-gradient(180deg, rgba(165, 243, 252, 0.16) 0%, rgba(165, 243, 252, 0.2) 100%) !important;
    border-color: rgba(165, 243, 252, 0.22) !important;
    color: rgba(165, 243, 252, 0.94) !important;
}

#gal-layer-choices.skin-forest-twilight {
    background:
      radial-gradient(120% 120% at 50% 0%, rgba(165, 243, 252, 0.12) 0%, rgba(165, 243, 252, 0.04) 34%, rgba(61, 43, 31, 0.08) 52%, rgba(5, 15, 11, 0.42) 100%),
      rgba(10, 31, 22, 0.84) !important;
    backdrop-filter: blur(18px) saturate(112%);
    -webkit-backdrop-filter: blur(18px) saturate(112%);
}

#gal-layer-choices.skin-forest-twilight .gal-choices-title {
    color: rgba(212, 175, 55, 0.98) !important;
    font-family: var(--twilight-headline) !important;
    letter-spacing: 0.22em !important;
}

#gal-layer-choices.skin-forest-twilight .gal-choices-hint {
    color: rgba(165, 243, 252, 0.56) !important;
    font-family: var(--twilight-label) !important;
}

#gal-layer-choices.skin-forest-twilight .gal-choice-card {
    border: 1px solid rgba(212, 175, 55, 0.18) !important;
    border-radius: 16px !important;
    background:
      linear-gradient(180deg, rgba(61, 43, 31, 0.34) 0%, rgba(30, 58, 42, 0.28) 100%),
      rgba(10, 31, 22, 0.92) !important;
    color: rgba(243, 244, 246, 0.94) !important;
    font-family: var(--twilight-body) !important;
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.26) !important;
}

#gal-layer-choices.skin-forest-twilight .gal-choice-card:hover {
    border-color: rgba(212, 175, 55, 0.28) !important;
    background:
      linear-gradient(180deg, rgba(61, 43, 31, 0.46) 0%, rgba(30, 58, 42, 0.38) 100%),
      rgba(10, 31, 22, 0.96) !important;
    color: rgba(212, 175, 55, 0.98) !important;
}

/* =========================================================
   0.7 电暮 (Cyber Twilight) — 紫青终端版
   参考: Desktop VN - Inline Choice Indicator v5
   只替换配色 / 字体 / 细节质感，结构与薄暮一致
   ========================================================= */
#gal-global-overlay.skin-cyber-twilight {
    --cyber-purple: #2d004d;
    --cyber-blue: #00d2ff;
    --cyber-neon: #39ff14;
    --cyber-cyan: #00f3ff;
    --cyber-surface: #1a0b2e;
    --cyber-outline: #4d2b7a;
    --cyber-text: #e0f2fe;
    --twilight-headline: "Orbitron", "PingFang SC", "Microsoft YaHei", sans-serif;
    --twilight-body: "Roboto Mono", "Microsoft YaHei UI", monospace;
    --twilight-label: "Orbitron", "PingFang SC", "Microsoft YaHei", sans-serif;
    color: rgba(224, 242, 254, 0.98) !important;
}

#gal-global-overlay.skin-cyber-twilight .gal-twilight-scrim {
    background:
        radial-gradient(72% 48% at 50% 18%, rgba(0, 243, 255, 0.12) 0%, rgba(0, 243, 255, 0) 58%),
        linear-gradient(180deg, rgba(45, 0, 77, 0.08) 0%, rgba(45, 0, 77, 0.02) 28%, rgba(26, 11, 46, 0.05) 58%, rgba(26, 11, 46, 0.32) 100%);
}

#gal-global-overlay.skin-cyber-twilight .gal-twilight-header {
    background: linear-gradient(180deg, rgba(45, 0, 77, 0.42) 0%, rgba(26, 11, 46, 0.74) 100%) !important;
    border-bottom: 1px solid rgba(0, 243, 255, 0.18) !important;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.36), 0 0 20px rgba(0, 243, 255, 0.08) !important;
}

#gal-global-overlay.skin-cyber-twilight .gal-twilight-brand {
    color: rgba(0, 243, 255, 0.98) !important;
    letter-spacing: 0.24em !important;
    text-shadow: 0 0 18px rgba(0, 243, 255, 0.18) !important;
}

#gal-global-overlay.skin-cyber-twilight .gal-twilight-divider {
    background: rgba(0, 243, 255, 0.26) !important;
}

#gal-global-overlay.skin-cyber-twilight .gal-location-bar {
    color: rgba(0, 210, 255, 0.94) !important;
}

#gal-global-overlay.skin-cyber-twilight .gal-time-bar {
    color: rgba(57, 255, 20, 0.78) !important;
}

#gal-global-overlay.skin-cyber-twilight .gal-twilight-meta-btn {
    font-family: var(--twilight-label) !important;
    letter-spacing: 0.18em !important;
}

#gal-global-overlay.skin-cyber-twilight .gal-twilight-header-actions .gal-status-popup-trigger,
#gal-global-overlay.skin-cyber-twilight .gal-twilight-header-actions .gal-sprite-toggle,
#gal-global-overlay.skin-cyber-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle {
    color: rgba(0, 243, 255, 0.88) !important;
    border-radius: 6px !important;
}

#gal-global-overlay.skin-cyber-twilight .gal-twilight-header-actions .gal-status-popup-icon,
#gal-global-overlay.skin-cyber-twilight .gal-eye-icon,
#gal-global-overlay.skin-cyber-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle i {
    color: rgba(0, 243, 255, 0.96) !important;
}

#gal-global-overlay.skin-cyber-twilight .gal-twilight-header-actions .gal-status-popup-trigger:hover,
#gal-global-overlay.skin-cyber-twilight .gal-twilight-header-actions .gal-sprite-toggle:hover,
#gal-global-overlay.skin-cyber-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle:hover,
#gal-global-overlay.skin-cyber-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle:focus-visible {
    background: rgba(0, 243, 255, 0.08) !important;
    box-shadow: inset 0 0 0 1px rgba(0, 243, 255, 0.18) !important;
}

#gal-global-overlay.skin-cyber-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action {
    border-color: rgba(0, 243, 255, 0.22) !important;
    background:
        linear-gradient(180deg, rgba(45, 0, 77, 0.3) 0%, rgba(26, 11, 46, 0.7) 100%),
        rgba(26, 11, 46, 0.84) !important;
    color: rgba(0, 243, 255, 0.96) !important;
    font-family: var(--twilight-label) !important;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.18), 0 0 18px rgba(0, 243, 255, 0.06) !important;
}

#gal-global-overlay.skin-cyber-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action:hover {
    background:
        linear-gradient(180deg, rgba(45, 0, 77, 0.44) 0%, rgba(26, 11, 46, 0.78) 100%),
        rgba(26, 11, 46, 0.9) !important;
    color: rgba(57, 255, 20, 0.96) !important;
}

#gal-global-overlay.skin-cyber-twilight .gal-name-badge {
    background: rgba(0, 243, 255, 0.96) !important;
    border: 1px solid rgba(0, 243, 255, 0.2) !important;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2), 0 0 18px rgba(0, 243, 255, 0.2) !important;
}

#gal-global-overlay.skin-cyber-twilight .gal-name-badge span {
    background: transparent !important;
    color: rgba(45, 0, 77, 0.98) !important;
    padding: 0 20px !important;
    text-transform: uppercase;
}

#gal-global-overlay.skin-cyber-twilight .gal-text-panel {
    border: 1px solid rgba(0, 243, 255, 0.24) !important;
    background:
        linear-gradient(180deg, rgba(26, 11, 46, 0.84) 0%, rgba(14, 6, 26, 0.88) 100%),
        rgba(26, 11, 46, calc(var(--panel-opacity, 0.7) * 0.96)) !important;
    box-shadow:
        0 22px 54px rgba(0, 0, 0, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.04),
        0 0 20px rgba(0, 243, 255, 0.08) !important;
    backdrop-filter: blur(16px) saturate(116%);
    -webkit-backdrop-filter: blur(16px) saturate(116%);
}

#gal-global-overlay.skin-cyber-twilight .gal-text-panel::before {
    opacity: 0.18 !important;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0) 38%),
        radial-gradient(circle at 1px 1px, rgba(0, 243, 255, 0.08) 1px, transparent 0) !important;
    background-size: auto, 18px 18px !important;
}

#gal-global-overlay.skin-cyber-twilight .gal-text-panel:hover {
    background:
        linear-gradient(180deg, rgba(26, 11, 46, 0.9) 0%, rgba(14, 6, 26, 0.94) 100%),
        rgba(26, 11, 46, calc(var(--panel-opacity, 0.7) * 1)) !important;
    border-color: rgba(57, 255, 20, 0.24) !important;
    box-shadow:
        0 24px 58px rgba(0, 0, 0, 0.44),
        inset 0 1px 0 rgba(255, 255, 255, 0.05),
        0 0 22px rgba(0, 243, 255, 0.1) !important;
}

#gal-global-overlay.skin-cyber-twilight .gal-dialog-text {
    color: rgba(224, 242, 254, 0.94) !important;
    font-family: var(--twilight-body) !important;
    letter-spacing: 0.02em !important;
    text-shadow: 0 0 14px rgba(0, 243, 255, 0.1) !important;
}

#gal-global-overlay.skin-cyber-twilight .gal-twilight-dialog-next-indicator,
#gal-global-overlay.skin-cyber-twilight .gal-twilight-dialog-next-indicator[data-state="end"] {
    color: rgba(57, 255, 20, 0.96) !important;
}

#gal-global-overlay.skin-cyber-twilight .gal-twilight-dialog-next-indicator i {
    color: rgba(57, 255, 20, 0.98) !important;
    text-shadow: 0 0 18px rgba(57, 255, 20, 0.16) !important;
}

#gal-global-overlay.skin-cyber-twilight .gal-generating-indicator {
    border-color: rgba(0, 243, 255, 0.22) !important;
    background: rgba(26, 11, 46, 0.92) !important;
    color: rgba(224, 242, 254, 0.86) !important;
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.24), 0 0 18px rgba(0, 243, 255, 0.08) !important;
}

#gal-global-overlay.skin-cyber-twilight .gal-bottom-toolbar {
    background: linear-gradient(180deg, rgba(45, 0, 77, 0.64) 0%, rgba(26, 11, 46, 0.94) 100%) !important;
    border-top: 1px solid rgba(0, 243, 255, 0.16) !important;
    box-shadow: 0 -10px 28px rgba(0, 0, 0, 0.28) !important;
}

#gal-global-overlay.skin-cyber-twilight .gal-footer-btn,
#gal-global-overlay.skin-cyber-twilight .gal-pending-choices-btn,
#gal-global-overlay.skin-cyber-twilight .gal-action-btn {
    color: rgba(0, 210, 255, 0.72) !important;
    font-family: var(--twilight-label) !important;
    letter-spacing: 0.18em !important;
}

#gal-global-overlay.skin-cyber-twilight .gal-footer-btn:hover,
#gal-global-overlay.skin-cyber-twilight .gal-pending-choices-btn:hover,
#gal-global-overlay.skin-cyber-twilight .gal-action-btn:hover {
    background: rgba(0, 243, 255, 0.08) !important;
    color: rgba(224, 242, 254, 0.98) !important;
}

#gal-global-overlay.skin-cyber-twilight .gal-pending-choices-btn.show {
    background: rgba(57, 255, 20, 0.12) !important;
    border-color: rgba(57, 255, 20, 0.24) !important;
    color: rgba(57, 255, 20, 0.94) !important;
}

#gal-global-overlay.skin-cyber-twilight .gal-bottom-toolbar [data-action="show-choices"] {
    background: linear-gradient(180deg, rgba(57, 255, 20, 0.92) 0%, rgba(0, 243, 255, 0.9) 100%) !important;
    border-color: rgba(57, 255, 20, 0.26) !important;
    color: rgba(45, 0, 77, 0.96) !important;
}

#gal-layer-choices.skin-cyber-twilight {
    background:
      radial-gradient(120% 120% at 50% 0%, rgba(0, 243, 255, 0.12) 0%, rgba(0, 243, 255, 0.04) 34%, rgba(45, 0, 77, 0.08) 52%, rgba(26, 11, 46, 0.44) 100%),
      rgba(26, 11, 46, 0.86) !important;
    backdrop-filter: blur(18px) saturate(118%);
    -webkit-backdrop-filter: blur(18px) saturate(118%);
}

#gal-layer-choices.skin-cyber-twilight .gal-choices-title {
    color: rgba(0, 243, 255, 0.98) !important;
    font-family: var(--twilight-headline) !important;
    letter-spacing: 0.24em !important;
    text-shadow: 0 0 18px rgba(0, 243, 255, 0.16) !important;
}

#gal-layer-choices.skin-cyber-twilight .gal-choices-hint {
    color: rgba(224, 242, 254, 0.56) !important;
    font-family: var(--twilight-label) !important;
}

#gal-layer-choices.skin-cyber-twilight .gal-choice-card {
    border: 1px solid rgba(0, 243, 255, 0.22) !important;
    border-radius: 10px !important;
    background:
      linear-gradient(180deg, rgba(45, 0, 77, 0.26) 0%, rgba(26, 11, 46, 0.2) 100%),
      rgba(26, 11, 46, 0.92) !important;
    color: rgba(224, 242, 254, 0.96) !important;
    font-family: var(--twilight-body) !important;
    box-shadow: 0 18px 42px rgba(0, 0, 0, 0.28), 0 0 18px rgba(0, 243, 255, 0.04) !important;
}

#gal-layer-choices.skin-cyber-twilight .gal-choice-card:hover {
    border-color: rgba(57, 255, 20, 0.3) !important;
    background:
      linear-gradient(180deg, rgba(45, 0, 77, 0.34) 0%, rgba(26, 11, 46, 0.28) 100%),
      rgba(26, 11, 46, 0.96) !important;
    color: rgba(57, 255, 20, 0.96) !important;
}

/* =========================================================
   0.8 梦暮 (Dream Twilight) — 粉雾薰衣草版
   参考: Desktop VN - Inline Choice Indicator v5
   只替换配色 / 字体 / 细节质感，结构与薄暮一致
   ========================================================= */
#gal-global-overlay.skin-dream-twilight {
    --dream-lavender: #f3f0ff;
    --dream-mint: #f0fff4;
    --dream-plum: #4a3b4e;
    --dream-charcoal: #3f3f46;
    --dream-purple: #e9d5ff;
    --dream-peach: #ffedd5;
    --dream-blue: #e0f2fe;
    --dream-pink: #fbcfe8;
    --twilight-headline: "Manrope", "PingFang SC", "Microsoft YaHei", sans-serif;
    --twilight-body: "Be Vietnam Pro", "PingFang SC", "Microsoft YaHei", sans-serif;
    --twilight-label: "Inter", "PingFang SC", "Microsoft YaHei", sans-serif;
    color: rgba(63, 63, 70, 0.96) !important;
}

#gal-global-overlay.skin-dream-twilight .gal-twilight-scrim {
    background:
        radial-gradient(72% 48% at 50% 18%, rgba(233, 213, 255, 0.26) 0%, rgba(233, 213, 255, 0) 58%),
        linear-gradient(180deg, rgba(250, 250, 251, 0.14) 0%, rgba(250, 250, 251, 0.04) 28%, rgba(255, 237, 213, 0.04) 58%, rgba(243, 240, 255, 0.2) 100%);
}

#gal-global-overlay.skin-dream-twilight .gal-twilight-header {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.68) 0%, rgba(243, 240, 255, 0.56) 100%) !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.6) !important;
    box-shadow: 0 10px 28px rgba(243, 240, 255, 0.16) !important;
}

#gal-global-overlay.skin-dream-twilight .gal-twilight-brand {
    color: rgba(74, 59, 78, 0.94) !important;
    letter-spacing: 0.14em !important;
}

#gal-global-overlay.skin-dream-twilight .gal-twilight-divider {
    background: rgba(74, 59, 78, 0.18) !important;
}

#gal-global-overlay.skin-dream-twilight .gal-location-bar {
    color: rgba(74, 59, 78, 0.82) !important;
}

#gal-global-overlay.skin-dream-twilight .gal-time-bar {
    color: rgba(74, 59, 78, 0.58) !important;
}

#gal-global-overlay.skin-dream-twilight .gal-twilight-meta-btn {
    font-family: var(--twilight-label) !important;
    letter-spacing: 0.14em !important;
}

#gal-global-overlay.skin-dream-twilight .gal-twilight-header-actions .gal-status-popup-trigger,
#gal-global-overlay.skin-dream-twilight .gal-twilight-header-actions .gal-sprite-toggle,
#gal-global-overlay.skin-dream-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle {
    color: rgba(74, 59, 78, 0.78) !important;
}

#gal-global-overlay.skin-dream-twilight .gal-twilight-header-actions .gal-status-popup-icon,
#gal-global-overlay.skin-dream-twilight .gal-eye-icon,
#gal-global-overlay.skin-dream-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle i {
    color: rgba(74, 59, 78, 0.84) !important;
}

#gal-global-overlay.skin-dream-twilight .gal-twilight-header-actions .gal-status-popup-trigger:hover,
#gal-global-overlay.skin-dream-twilight .gal-twilight-header-actions .gal-sprite-toggle:hover,
#gal-global-overlay.skin-dream-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle:hover,
#gal-global-overlay.skin-dream-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle:focus-visible {
    background: rgba(255, 255, 255, 0.34) !important;
    box-shadow: inset 0 0 0 1px rgba(233, 213, 255, 0.46) !important;
}

#gal-global-overlay.skin-dream-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action {
    border-color: rgba(255, 255, 255, 0.72) !important;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.8) 0%, rgba(243, 240, 255, 0.66) 100%),
        rgba(255, 255, 255, 0.76) !important;
    color: rgba(74, 59, 78, 0.88) !important;
    font-family: var(--twilight-label) !important;
    box-shadow: 0 -2px 8px rgba(243, 240, 255, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5) !important;
}

#gal-global-overlay.skin-dream-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action:hover {
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.9) 0%, rgba(233, 213, 255, 0.74) 100%),
        rgba(255, 255, 255, 0.84) !important;
    color: rgba(74, 59, 78, 0.96) !important;
}

#gal-global-overlay.skin-dream-twilight .gal-name-badge {
    background: linear-gradient(180deg, rgba(255, 237, 213, 0.96) 0%, rgba(255, 255, 255, 0.96) 100%) !important;
    border: 1px solid rgba(255, 255, 255, 0.72) !important;
    box-shadow: 0 10px 22px rgba(243, 240, 255, 0.16) !important;
}

#gal-global-overlay.skin-dream-twilight .gal-name-badge span {
    background: transparent !important;
    color: rgba(74, 59, 78, 0.94) !important;
    padding: 0 24px !important;
}

#gal-global-overlay.skin-dream-twilight .gal-text-panel {
    border: 1px solid rgba(255, 255, 255, 0.72) !important;
    background:
        linear-gradient(180deg, rgba(243, 240, 255, 0.82) 0%, rgba(243, 240, 255, 0.62) 100%),
        rgba(243, 240, 255, calc(var(--panel-opacity, 0.7) * 0.92)) !important;
    box-shadow:
        0 22px 52px rgba(243, 240, 255, 0.24),
        inset 0 1px 0 rgba(255, 255, 255, 0.58) !important;
    backdrop-filter: blur(16px) saturate(104%);
    -webkit-backdrop-filter: blur(16px) saturate(104%);
}

#gal-global-overlay.skin-dream-twilight .gal-text-panel::before {
    opacity: 0.26 !important;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0) 38%),
        radial-gradient(circle at 1px 1px, rgba(74, 59, 78, 0.03) 1px, transparent 0) !important;
    background-size: auto, 18px 18px !important;
}

#gal-global-overlay.skin-dream-twilight .gal-text-panel:hover {
    background:
        linear-gradient(180deg, rgba(243, 240, 255, 0.9) 0%, rgba(243, 240, 255, 0.72) 100%),
        rgba(243, 240, 255, calc(var(--panel-opacity, 0.7) * 0.98)) !important;
    border-color: rgba(233, 213, 255, 0.88) !important;
    box-shadow:
        0 24px 56px rgba(243, 240, 255, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.62) !important;
}

#gal-global-overlay.skin-dream-twilight .gal-dialog-text {
    color: rgba(63, 63, 70, 0.92) !important;
    font-family: var(--twilight-body) !important;
    letter-spacing: 0.03em !important;
    text-shadow: 0 0 12px rgba(255, 255, 255, 0.18) !important;
}

#gal-global-overlay.skin-dream-twilight .gal-twilight-dialog-next-indicator,
#gal-global-overlay.skin-dream-twilight .gal-twilight-dialog-next-indicator[data-state="end"] {
    color: rgba(74, 59, 78, 0.42) !important;
}

#gal-global-overlay.skin-dream-twilight .gal-twilight-dialog-next-indicator i {
    color: rgba(74, 59, 78, 0.42) !important;
}

#gal-global-overlay.skin-dream-twilight .gal-generating-indicator {
    border-color: rgba(255, 255, 255, 0.72) !important;
    background: rgba(255, 255, 255, 0.88) !important;
    color: rgba(74, 59, 78, 0.8) !important;
    box-shadow: 0 12px 28px rgba(243, 240, 255, 0.18) !important;
}

#gal-global-overlay.skin-dream-twilight .gal-bottom-toolbar {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.54) 0%, rgba(255, 255, 255, 0.72) 100%) !important;
    border-top: 1px solid rgba(255, 255, 255, 0.68) !important;
    box-shadow: 0 -10px 28px rgba(243, 240, 255, 0.16) !important;
}

#gal-global-overlay.skin-dream-twilight .gal-footer-btn,
#gal-global-overlay.skin-dream-twilight .gal-pending-choices-btn,
#gal-global-overlay.skin-dream-twilight .gal-action-btn {
    color: rgba(74, 59, 78, 0.58) !important;
    font-family: var(--twilight-label) !important;
    letter-spacing: 0.14em !important;
}

#gal-global-overlay.skin-dream-twilight .gal-footer-btn:hover,
#gal-global-overlay.skin-dream-twilight .gal-pending-choices-btn:hover,
#gal-global-overlay.skin-dream-twilight .gal-action-btn:hover {
    background: rgba(255, 255, 255, 0.34) !important;
    color: rgba(74, 59, 78, 0.94) !important;
}

#gal-global-overlay.skin-dream-twilight .gal-pending-choices-btn.show {
    background: rgba(233, 213, 255, 0.7) !important;
    border-color: rgba(255, 255, 255, 0.76) !important;
    color: rgba(74, 59, 78, 0.9) !important;
}

#gal-global-overlay.skin-dream-twilight .gal-bottom-toolbar [data-action="show-choices"] {
    background: linear-gradient(180deg, rgba(233, 213, 255, 0.92) 0%, rgba(251, 207, 232, 0.88) 100%) !important;
    border-color: rgba(255, 255, 255, 0.82) !important;
    color: rgba(74, 59, 78, 0.94) !important;
}

#gal-layer-choices.skin-dream-twilight {
    background:
      radial-gradient(120% 120% at 50% 0%, rgba(233, 213, 255, 0.24) 0%, rgba(233, 213, 255, 0.08) 36%, rgba(255, 237, 213, 0.08) 52%, rgba(255, 255, 255, 0.34) 100%),
      rgba(255, 255, 255, 0.6) !important;
    backdrop-filter: blur(18px) saturate(102%);
    -webkit-backdrop-filter: blur(18px) saturate(102%);
}

#gal-layer-choices.skin-dream-twilight .gal-choices-title {
    color: rgba(74, 59, 78, 0.92) !important;
    font-family: var(--twilight-headline) !important;
    letter-spacing: 0.14em !important;
}

#gal-layer-choices.skin-dream-twilight .gal-choices-hint {
    color: rgba(74, 59, 78, 0.5) !important;
    font-family: var(--twilight-label) !important;
}

#gal-layer-choices.skin-dream-twilight .gal-choice-card {
    border: 1px solid rgba(255, 255, 255, 0.78) !important;
    border-radius: 16px !important;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.82) 0%, rgba(243, 240, 255, 0.74) 100%),
      rgba(243, 240, 255, 0.88) !important;
    color: rgba(63, 63, 70, 0.92) !important;
    font-family: var(--twilight-body) !important;
    box-shadow: 0 18px 40px rgba(243, 240, 255, 0.18) !important;
}

#gal-layer-choices.skin-dream-twilight .gal-choice-card:hover {
    border-color: rgba(233, 213, 255, 0.94) !important;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(255, 237, 213, 0.76) 100%),
      rgba(243, 240, 255, 0.94) !important;
    color: rgba(74, 59, 78, 0.96) !important;
}

/* =========================================================
   0.9 霞暮 (Rosy Twilight) — 落日粉雾版
   参考: Desktop VN - Dynamic Background Edition v14
   只替换配色 / 字体 / 细节质感，结构与薄暮一致
   ========================================================= */
#gal-global-overlay.skin-rosy-twilight {
    --rosy-blush-base: #fff0f3;
    --rosy-blush-panel: rgba(255, 240, 243, 0.78);
    --rosy-primary: #ff80ab;
    --rosy-accent: #ff007f;
    --rosy-soft: #fce4ec;
    --rosy-warm-grey: #3d3b3c;
    --rosy-ink: #131316;
    --twilight-headline: "Manrope", "PingFang SC", "Microsoft YaHei", sans-serif;
    --twilight-body: "Noto Serif SC", "Songti SC", "STSong", "SimSun", serif;
    --twilight-label: "Inter", "PingFang SC", "Microsoft YaHei", sans-serif;
    color: rgba(61, 59, 60, 0.96) !important;
}

#gal-global-overlay.skin-rosy-twilight .gal-twilight-scrim {
    background:
        radial-gradient(72% 50% at 50% 16%, rgba(255, 128, 171, 0.22) 0%, rgba(255, 128, 171, 0) 58%),
        linear-gradient(180deg, rgba(255, 240, 243, 0.16) 0%, rgba(255, 240, 243, 0.06) 28%, rgba(252, 228, 236, 0.1) 58%, rgba(19, 19, 22, 0.16) 100%);
}

#gal-global-overlay.skin-rosy-twilight .gal-twilight-header {
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 128, 171, 0.08) 100%),
        rgba(255, 128, 171, 0.2) !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.28) !important;
    box-shadow: 0 12px 30px rgba(255, 128, 171, 0.12) !important;
}

#gal-global-overlay.skin-rosy-twilight .gal-twilight-brand {
    color: rgba(61, 59, 60, 0.94) !important;
    letter-spacing: 0.14em !important;
}

#gal-global-overlay.skin-rosy-twilight .gal-twilight-divider {
    background: rgba(61, 59, 60, 0.18) !important;
}

#gal-global-overlay.skin-rosy-twilight .gal-location-bar {
    color: rgba(61, 59, 60, 0.84) !important;
}

#gal-global-overlay.skin-rosy-twilight .gal-time-bar {
    color: rgba(61, 59, 60, 0.58) !important;
}

#gal-global-overlay.skin-rosy-twilight .gal-twilight-meta-btn {
    font-family: var(--twilight-label) !important;
    letter-spacing: 0.14em !important;
}

#gal-global-overlay.skin-rosy-twilight .gal-twilight-header-actions .gal-status-popup-trigger,
#gal-global-overlay.skin-rosy-twilight .gal-twilight-header-actions .gal-sprite-toggle,
#gal-global-overlay.skin-rosy-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle {
    color: rgba(61, 59, 60, 0.78) !important;
}

#gal-global-overlay.skin-rosy-twilight .gal-twilight-header-actions .gal-status-popup-icon,
#gal-global-overlay.skin-rosy-twilight .gal-eye-icon,
#gal-global-overlay.skin-rosy-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle i {
    color: rgba(61, 59, 60, 0.84) !important;
}

#gal-global-overlay.skin-rosy-twilight .gal-twilight-header-actions .gal-status-popup-trigger:hover,
#gal-global-overlay.skin-rosy-twilight .gal-twilight-header-actions .gal-sprite-toggle:hover,
#gal-global-overlay.skin-rosy-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle:hover,
#gal-global-overlay.skin-rosy-twilight .gal-twilight-header-actions .gal-twilight-fullscreen-toggle:focus-visible {
    background: rgba(255, 255, 255, 0.42) !important;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.26) !important;
}

#gal-global-overlay.skin-rosy-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action {
    border-color: rgba(255, 255, 255, 0.64) !important;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.84) 0%, rgba(255, 240, 243, 0.72) 100%),
        rgba(255, 255, 255, 0.8) !important;
    color: rgba(61, 59, 60, 0.88) !important;
    font-family: var(--twilight-label) !important;
    box-shadow: 0 -2px 8px rgba(255, 128, 171, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5) !important;
}

#gal-global-overlay.skin-rosy-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action:hover {
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(252, 228, 236, 0.76) 100%),
        rgba(255, 255, 255, 0.86) !important;
    color: rgba(61, 59, 60, 0.96) !important;
}

#gal-global-overlay.skin-rosy-twilight .gal-name-badge {
    background: linear-gradient(180deg, rgba(252, 228, 236, 0.96) 0%, rgba(255, 240, 243, 0.96) 100%) !important;
    border: 1px solid rgba(255, 255, 255, 0.7) !important;
    box-shadow: 0 12px 28px rgba(255, 128, 171, 0.16) !important;
}

#gal-global-overlay.skin-rosy-twilight .gal-name-badge span {
    background: transparent !important;
    color: rgba(255, 0, 127, 0.94) !important;
    padding: 0 24px !important;
}

#gal-global-overlay.skin-rosy-twilight .gal-text-panel {
    border: 1px solid rgba(255, 255, 255, 0.72) !important;
    background:
        linear-gradient(180deg, rgba(252, 228, 236, 0.82) 0%, rgba(255, 240, 243, 0.64) 100%),
        rgba(255, 240, 243, calc(var(--panel-opacity, 0.7) * 0.92)) !important;
    box-shadow:
        0 22px 52px rgba(255, 128, 171, 0.14),
        inset 0 1px 0 rgba(255, 255, 255, 0.58) !important;
    backdrop-filter: blur(16px) saturate(104%);
    -webkit-backdrop-filter: blur(16px) saturate(104%);
}

#gal-global-overlay.skin-rosy-twilight .gal-text-panel::before {
    opacity: 0.46 !important;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 38%),
        url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M25,10 c-5,0 -10,5 -10,10 c0,5 5,10 10,10 c5,0 10,-5 10,-10 c0,-5 -5,-10 -10,-10 z M60,40 c-3,0 -6,3 -6,6 c0,3 3,6 6,6 c3,0 6,-3 6,-6 c0,-3 -3,-6 -6,-6 z M85,15 c-4,0 -8,4 -8,8 c0,4 4,8 8,8 c4,0 8,-4 8,-8 c0,-4 -4,-8 -8,-8 z M15,75 c-6,0 -12,6 -12,12 c0,6 6,12 12,12 c6,0 12,-6 12,-12 c0,-6 -6,-12 -12,-12 z M70,80 c-5,0 -10,5 -10,10 c0,5 5,10 10,10 c5,0 10,-5 10,-10 c0,-5 -5,-10 -10,-10 z' fill='%23ff80ab' fill-opacity='0.4'/%3E%3Cpath d='M30,20 q-5,10 5,20 q10,-5 0,-20 z' fill='%23ff80ab' fill-opacity='0.2' transform='rotate(45 30 20)'/%3E%3Cpath d='M75,60 q-3,6 3,12 q6,-3 0,-12 z' fill='%23ff80ab' fill-opacity='0.3' transform='rotate(-20 75 60)'/%3E%3C/svg%3E") !important;
    background-size: auto, 120px 120px !important;
}

#gal-global-overlay.skin-rosy-twilight .gal-text-panel:hover {
    background:
        linear-gradient(180deg, rgba(252, 228, 236, 0.9) 0%, rgba(255, 240, 243, 0.74) 100%),
        rgba(255, 240, 243, calc(var(--panel-opacity, 0.7) * 0.98)) !important;
    border-color: rgba(255, 255, 255, 0.82) !important;
    box-shadow:
        0 24px 56px rgba(255, 128, 171, 0.18),
        inset 0 1px 0 rgba(255, 255, 255, 0.64) !important;
}

#gal-global-overlay.skin-rosy-twilight .gal-dialog-text {
    color: rgba(61, 59, 60, 0.92) !important;
    font-family: var(--twilight-body) !important;
    letter-spacing: 0.04em !important;
    text-shadow: 0 1px 2px rgba(255, 255, 255, 0.72) !important;
}

#gal-global-overlay.skin-rosy-twilight .gal-twilight-dialog-next-indicator,
#gal-global-overlay.skin-rosy-twilight .gal-twilight-dialog-next-indicator[data-state="end"] {
    color: rgba(255, 0, 127, 0.64) !important;
}

#gal-global-overlay.skin-rosy-twilight .gal-twilight-dialog-next-indicator i {
    color: rgba(255, 0, 127, 0.68) !important;
}

#gal-global-overlay.skin-rosy-twilight .gal-generating-indicator {
    border-color: rgba(255, 255, 255, 0.72) !important;
    background: rgba(255, 255, 255, 0.88) !important;
    color: rgba(61, 59, 60, 0.8) !important;
    box-shadow: 0 12px 28px rgba(255, 128, 171, 0.14) !important;
}

#gal-global-overlay.skin-rosy-twilight .gal-bottom-toolbar {
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 128, 171, 0.14) 100%),
        rgba(255, 128, 171, 0.2) !important;
    border-top: 1px solid rgba(255, 255, 255, 0.38) !important;
    box-shadow: 0 -10px 28px rgba(255, 128, 171, 0.12) !important;
}

#gal-global-overlay.skin-rosy-twilight .gal-footer-btn,
#gal-global-overlay.skin-rosy-twilight .gal-pending-choices-btn,
#gal-global-overlay.skin-rosy-twilight .gal-action-btn {
    color: rgba(61, 59, 60, 0.62) !important;
    font-family: var(--twilight-label) !important;
    letter-spacing: 0.14em !important;
}

#gal-global-overlay.skin-rosy-twilight .gal-footer-btn:hover,
#gal-global-overlay.skin-rosy-twilight .gal-pending-choices-btn:hover,
#gal-global-overlay.skin-rosy-twilight .gal-action-btn:hover {
    background: rgba(255, 255, 255, 0.28) !important;
    color: rgba(61, 59, 60, 0.96) !important;
}

#gal-global-overlay.skin-rosy-twilight .gal-pending-choices-btn.show {
    background: rgba(255, 240, 243, 0.78) !important;
    border-color: rgba(255, 255, 255, 0.78) !important;
    color: rgba(255, 0, 127, 0.88) !important;
}

#gal-global-overlay.skin-rosy-twilight .gal-bottom-toolbar [data-action="show-choices"] {
    background: linear-gradient(180deg, rgba(255, 128, 171, 0.96) 0%, rgba(255, 0, 127, 0.9) 100%) !important;
    border-color: rgba(255, 255, 255, 0.72) !important;
    color: rgba(255, 255, 255, 0.96) !important;
    box-shadow: 0 14px 26px rgba(255, 0, 127, 0.16) !important;
}

#gal-layer-choices.skin-rosy-twilight {
    background:
      radial-gradient(120% 120% at 50% 0%, rgba(255, 128, 171, 0.24) 0%, rgba(255, 128, 171, 0.08) 36%, rgba(252, 228, 236, 0.1) 52%, rgba(255, 255, 255, 0.38) 100%),
      rgba(255, 255, 255, 0.58) !important;
    backdrop-filter: blur(18px) saturate(102%);
    -webkit-backdrop-filter: blur(18px) saturate(102%);
}

#gal-layer-choices.skin-rosy-twilight .gal-choices-title {
    color: rgba(61, 59, 60, 0.92) !important;
    font-family: var(--twilight-headline) !important;
    letter-spacing: 0.14em !important;
}

#gal-layer-choices.skin-rosy-twilight .gal-choices-hint {
    color: rgba(61, 59, 60, 0.54) !important;
    font-family: var(--twilight-label) !important;
}

#gal-layer-choices.skin-rosy-twilight .gal-choice-card {
    border: 1px solid rgba(255, 255, 255, 0.74) !important;
    border-radius: 16px !important;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.84) 0%, rgba(255, 240, 243, 0.74) 100%),
      rgba(255, 240, 243, 0.9) !important;
    color: rgba(61, 59, 60, 0.92) !important;
    font-family: var(--twilight-body) !important;
    box-shadow: 0 18px 40px rgba(255, 128, 171, 0.14) !important;
}

#gal-layer-choices.skin-rosy-twilight .gal-choice-card:hover {
    border-color: rgba(255, 128, 171, 0.84) !important;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(252, 228, 236, 0.78) 100%),
      rgba(255, 240, 243, 0.94) !important;
    color: rgba(61, 59, 60, 0.96) !important;
}

@media screen and (max-width: 768px) {
    #gal-global-overlay.skin-twilight {
        --twilight-header-height: 76px;
        --twilight-footer-height: 54px;
    }

    #gal-global-overlay.skin-twilight .gal-game-container.gal-twilight-shell {
        background: transparent !important;
    }

    #gal-global-overlay.skin-twilight .gal-game-container.gal-twilight-shell::before {
        content: none !important;
        display: none !important;
    }

    #gal-global-overlay.skin-twilight .gal-twilight-scrim {
        background:
            linear-gradient(180deg, rgba(7, 10, 16, 0.14) 0%, rgba(7, 10, 16, 0.05) 24%, rgba(7, 10, 16, 0.02) 62%, rgba(7, 10, 16, 0.18) 100%);
    }

    #gal-global-overlay.skin-twilight .gal-twilight-header {
        min-height: var(--twilight-header-height) !important;
        padding: 8px 6px 0 !important;
        gap: 6px;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        justify-content: space-between;
        align-items: center;
        background: none !important;
        border: none !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
    }

    #gal-global-overlay.skin-twilight .gal-twilight-brandline {
        width: auto;
        gap: 4px;
        flex-wrap: nowrap !important;
        align-items: center;
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
    }

    #gal-global-overlay.skin-twilight .gal-twilight-brand {
        font-size: 0.48rem;
        letter-spacing: 0.24em;
        opacity: 0.82;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex-shrink: 1;
    }

    #gal-global-overlay.skin-twilight .gal-twilight-divider {
        display: none;
    }

    #gal-global-overlay.skin-twilight .gal-twilight-meta-group {
        gap: 4px;
        width: auto;
        flex-wrap: nowrap !important;
        flex-shrink: 0;
    }

    #gal-global-overlay.skin-twilight .gal-twilight-meta-btn {
        font-size: 0.48rem !important;
        white-space: nowrap;
    }

    #gal-global-overlay.skin-twilight .gal-twilight-meta-btn i {
        display: inline-flex !important;
        font-size: 0.6rem !important;
        color: var(--gal-immersive-accent) !important;
    }

    #gal-global-overlay.skin-twilight .gal-twilight-header-actions {
        gap: 4px;
        margin-left: auto;
        padding-right: 2px;
        flex-wrap: nowrap !important;
        flex-shrink: 0;
    }

    #gal-global-overlay.skin-twilight .gal-twilight-header-actions .gal-status-popup-trigger,
    #gal-global-overlay.skin-twilight .gal-twilight-header-actions .gal-sprite-toggle,
    #gal-global-overlay.skin-twilight .gal-twilight-header-actions .gal-fullscreen-btn.gal-twilight-fullscreen-toggle {
        width: 26px !important;
        height: 26px !important;
        min-width: 26px !important;
        min-height: 26px !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        background: rgba(12, 14, 22, 0.18) !important;
    }

    #gal-global-overlay.skin-twilight .gal-bgm-widget {
        top: calc(var(--twilight-header-height) + 12px) !important;
        left: 12px !important;
        min-height: 26px !important;
        height: 26px !important;
        max-width: 26px !important;
        padding: 0 7px !important;
        gap: 0.32rem !important;
    }

    #gal-global-overlay.skin-twilight .gal-bgm-widget:hover {
        max-width: 26px !important;
    }

    #gal-global-overlay.skin-twilight .gal-bgm-widget.active,
    #gal-global-overlay.skin-twilight .gal-bgm-widget.active:hover {
        max-width: min(11rem, calc(100vw - 1.5rem)) !important;
    }

    #gal-global-overlay.skin-twilight .gal-bgm-icon {
        font-size: 0.82rem !important;
    }

    #gal-global-overlay.skin-twilight .gal-bgm-title {
        font-size: 0.62rem !important;
    }

    #gal-global-overlay.skin-twilight .gal-bgm-slider {
        width: 2.35rem;
    }

    #gal-global-overlay.skin-twilight[class*="skin-"] .gal-twilight-dialog-layer {
        --ui-scale: 1 !important;
        left: 12px !important;
        right: 12px !important;
        bottom: calc(var(--twilight-footer-height) + env(safe-area-inset-bottom, 0px) + 12px) !important;
        width: auto !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        transform: none !important;
    }

    #gal-global-overlay.skin-twilight .gal-twilight-dialog-topline {
        position: static;
        margin-bottom: 0;
        align-items: flex-start;
        gap: 8px;
    }

    #gal-global-overlay.skin-twilight .gal-twilight-mobile-controls {
        display: inline-flex !important;
        align-items: center;
        gap: 6px;
        border: none !important;
        border-radius: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
        overflow: visible !important;
    }

    #gal-global-overlay.skin-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action {
        height: 26px !important;
        min-height: 26px !important;
        padding: 0 11px !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        border-radius: 999px !important;
        background: rgba(11, 13, 21, 0.7) !important;
        color: rgba(245, 239, 232, 0.86) !important;
        letter-spacing: 0.12em !important;
        font-size: 0.56rem !important;
        text-transform: uppercase !important;
        box-shadow: 0 8px 18px rgba(0, 0, 0, 0.16) !important;
    }

    #gal-global-overlay.skin-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action + .gal-twilight-mobile-action {
        border-left: 1px solid rgba(255, 255, 255, 0.1) !important;
    }

    #gal-global-overlay.skin-twilight .gal-twilight-mobile-controls .gal-twilight-mobile-action i {
        font-size: 0.56rem !important;
    }

    #gal-global-overlay.skin-twilight[class*="skin-"] .gal-name-badge {
        transform: scaleY(var(--twilight-name-badge-height-scale, 0.7)) !important;
        transform-origin: center center !important;
        min-width: 88px;
        max-width: min(44vw, 180px);
        min-height: 40px;
        margin: 0 0 -18px 0 !important;
        border: 1px solid rgba(186, 155, 112, 0.3) !important;
        border-radius: 999px !important;
        background:
            linear-gradient(180deg, rgba(255, 251, 245, 0.97) 0%, rgba(244, 236, 223, 0.94) 100%) !important;
        box-shadow:
            0 12px 24px rgba(41, 29, 17, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.8) !important;
    }

    #gal-global-overlay.skin-twilight[class*="skin-"] .gal-name-badge span {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        min-height: 40px;
        padding: 0 18px !important;
        border: none !important;
        background: transparent !important;
        color: #7b5d33 !important;
        font-size: 0.68rem !important;
        transform: scaleY(calc(1 / var(--twilight-name-badge-height-scale, 0.7))) !important;
        transform-origin: center center !important;
        font-weight: 800 !important;
        letter-spacing: 0.12em;
        box-shadow: none !important;
        transform: none !important;
        text-shadow: none !important;
    }

    #gal-global-overlay.skin-twilight .gal-text-panel {
        min-height: 128px;
        padding: 34px 16px 42px !important;
        border-radius: 18px !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%),
            rgba(10, 12, 18, var(--panel-opacity, 0.74)) !important;
        box-shadow:
            0 20px 40px rgba(0, 0, 0, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
    }

    #gal-global-overlay.skin-twilight .gal-twilight-dialog-next-indicator {
        right: 22px;
        bottom: 18px;
        width: 18px;
        height: 18px;
        border: none;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
    }

    #gal-global-overlay.skin-twilight .gal-twilight-dialog-next-indicator::after {
        content: none;
    }

    #gal-global-overlay.skin-twilight[class*="skin-"] .gal-dialog-text {
        font-size: calc(0.84rem * var(--font-scale, 1)) !important;
        line-height: 1.76 !important;
    }

    #gal-global-overlay.skin-twilight .gal-twilight-dialog-next-indicator[data-state="end"] {
        border: none;
        background: transparent;
    }

    #gal-global-overlay.skin-twilight .gal-twilight-dialog-next-indicator[data-state="end"]::after {
        content: none;
    }

    #gal-global-overlay.skin-twilight .gal-generating-indicator {
        margin-top: 8px !important;
        padding: 8px 10px !important;
    }

    #gal-global-overlay.skin-twilight .gal-footer-btn-next.gal-twilight-mobile-next {
        display: none !important;
    }

    #gal-global-overlay.skin-twilight[class*="skin-"] .gal-bottom-toolbar {
        --ui-scale: 1 !important;
        left: 12px !important;
        right: 12px !important;
        bottom: calc(env(safe-area-inset-bottom, 0px) + 10px) !important;
        width: auto !important;
        min-height: 42px !important;
        padding: 5px 8px !important;
        background: rgba(10, 12, 18, 0.76) !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        box-shadow: 0 16px 30px rgba(0, 0, 0, 0.22) !important;
        backdrop-filter: blur(16px) !important;
        -webkit-backdrop-filter: blur(16px) !important;
        display: grid !important;
        grid-template-columns: repeat(8, minmax(0, 1fr)) !important;
        gap: 2px !important;
        border-radius: 18px !important;
        align-items: center !important;
    }

    #gal-global-overlay.skin-twilight .gal-twilight-desktop-only {
        display: none !important;
    }

    #gal-global-overlay.skin-twilight[class*="skin-"] .gal-bottom-toolbar .gal-footer-btn,
    #gal-global-overlay.skin-twilight[class*="skin-"] .gal-bottom-toolbar .gal-pending-choices-btn {
        width: 100% !important;
        flex: 0 0 auto !important;
        min-width: 0 !important;
        height: 30px !important;
        min-height: 30px !important;
        padding: 0 !important;
        margin: 0 !important;
        border-radius: 10px !important;
        border-color: transparent !important;
        background: transparent !important;
        justify-content: center !important;
        box-shadow: none !important;
        color: rgba(245, 239, 232, 0.74) !important;
    }

    #gal-global-overlay.skin-twilight[class*="skin-"] .gal-bottom-toolbar .gal-btn-text {
        display: none !important;
    }

    #gal-global-overlay.skin-twilight[class*="skin-"] .gal-bottom-toolbar i {
        display: block !important;
        margin: 0 !important;
        font-size: 0.82rem !important;
    }

    #gal-global-overlay.skin-twilight[class*="skin-"] .gal-bottom-toolbar .gal-footer-btn:hover,
    #gal-global-overlay.skin-twilight[class*="skin-"] .gal-bottom-toolbar .gal-pending-choices-btn:hover {
        background: rgba(255, 255, 255, 0.05) !important;
    }

    #gal-layer-choices.skin-twilight .gal-choice-card {
        border-radius: 18px !important;
    }

    #gal-global-overlay.skin-gilded-twilight .gal-twilight-header {
        background: linear-gradient(180deg, rgba(249, 248, 244, 0.86) 0%, rgba(249, 248, 244, 0.54) 100%) !important;
        border-bottom: 1px solid rgba(176, 141, 87, 0.16) !important;
    }

    #gal-global-overlay.skin-gilded-twilight .gal-twilight-brand {
        color: rgba(176, 141, 87, 0.92) !important;
        opacity: 0.92 !important;
    }

    #gal-global-overlay.skin-gilded-twilight .gal-twilight-meta-btn {
        color: rgba(47, 40, 34, 0.72) !important;
    }

    #gal-global-overlay.skin-gilded-twilight .gal-twilight-header-actions .gal-status-popup-trigger,
    #gal-global-overlay.skin-gilded-twilight .gal-twilight-header-actions .gal-sprite-toggle,
    #gal-global-overlay.skin-gilded-twilight .gal-twilight-header-actions .gal-fullscreen-btn.gal-twilight-fullscreen-toggle {
        border-color: rgba(176, 141, 87, 0.14) !important;
        background: rgba(249, 248, 244, 0.52) !important;
    }

    #gal-global-overlay.skin-gilded-twilight[class*="skin-"] .gal-name-badge {
        background: rgba(249, 248, 244, 0.92) !important;
        border: 1px solid rgba(176, 141, 87, 0.28) !important;
        box-shadow: 0 8px 16px rgba(111, 84, 46, 0.06) !important;
    }

    #gal-global-overlay.skin-gilded-twilight .gal-name-badge span {
        background: transparent !important;
        color: var(--gilded-gold) !important;
        padding: 0 18px !important;
    }

    #gal-global-overlay.skin-gilded-twilight .gal-twilight-dialog-topline {
        margin-bottom: 0 !important;
        align-items: flex-end !important;
    }

    #gal-global-overlay.skin-gilded-twilight .gal-text-panel {
        background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.42) 0%, rgba(255, 255, 255, 0.18) 100%),
            rgba(249, 248, 244, calc(var(--panel-opacity, 0.74) * 0.88)) !important;
        border-color: rgba(176, 141, 87, 0.18) !important;
        box-shadow:
            0 20px 40px rgba(77, 58, 32, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.44) !important;
    }

    #gal-global-overlay.skin-gilded-twilight .gal-dialog-text {
        font-size: calc(0.88rem * var(--font-scale, 1)) !important;
        color: rgba(47, 40, 34, 0.94) !important;
    }

    #gal-global-overlay.skin-gilded-twilight[class*="skin-"] .gal-bottom-toolbar {
        background: rgba(249, 248, 244, 0.82) !important;
        border-color: rgba(176, 141, 87, 0.16) !important;
        box-shadow: 0 16px 30px rgba(80, 58, 34, 0.08) !important;
    }

    #gal-global-overlay.skin-gilded-twilight[class*="skin-"] .gal-bottom-toolbar .gal-footer-btn,
    #gal-global-overlay.skin-gilded-twilight[class*="skin-"] .gal-bottom-toolbar .gal-pending-choices-btn {
        color: rgba(47, 40, 34, 0.6) !important;
    }

    #gal-global-overlay.skin-gilded-twilight[class*="skin-"] .gal-bottom-toolbar .gal-footer-btn:hover,
    #gal-global-overlay.skin-gilded-twilight[class*="skin-"] .gal-bottom-toolbar .gal-pending-choices-btn:hover {
        background: rgba(176, 141, 87, 0.1) !important;
        color: var(--gilded-gold) !important;
    }

    #gal-global-overlay.skin-dawn-twilight .gal-twilight-header {
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.78) 0%, rgba(15, 23, 42, 0.5) 100%) !important;
        border-bottom: 1px solid rgba(120, 161, 187, 0.14) !important;
    }

    #gal-global-overlay.skin-dawn-twilight .gal-twilight-brand {
        color: rgba(184, 193, 200, 0.94) !important;
        opacity: 0.94 !important;
    }

    #gal-global-overlay.skin-dawn-twilight .gal-twilight-meta-btn {
        color: rgba(184, 193, 200, 0.76) !important;
    }

    #gal-global-overlay.skin-dawn-twilight .gal-twilight-header-actions .gal-status-popup-trigger,
    #gal-global-overlay.skin-dawn-twilight .gal-twilight-header-actions .gal-sprite-toggle,
    #gal-global-overlay.skin-dawn-twilight .gal-twilight-header-actions .gal-fullscreen-btn.gal-twilight-fullscreen-toggle {
        border-color: rgba(120, 161, 187, 0.14) !important;
        background: rgba(15, 23, 42, 0.5) !important;
    }

    #gal-global-overlay.skin-dawn-twilight[class*="skin-"] .gal-name-badge {
        background: rgba(15, 23, 42, 0.92) !important;
        border: 1px solid rgba(120, 161, 187, 0.24) !important;
        box-shadow: 0 8px 16px rgba(2, 6, 23, 0.12) !important;
    }

    #gal-global-overlay.skin-dawn-twilight .gal-name-badge span {
        background: transparent !important;
        color: rgba(184, 193, 200, 0.98) !important;
        padding: 0 18px !important;
    }

    #gal-global-overlay.skin-dawn-twilight .gal-twilight-dialog-topline {
        margin-bottom: 0 !important;
        align-items: flex-end !important;
    }

    #gal-global-overlay.skin-dawn-twilight .gal-text-panel {
        background:
            linear-gradient(180deg, rgba(15, 23, 42, 0.56) 0%, rgba(2, 6, 23, 0.18) 100%),
            rgba(30, 41, 59, calc(var(--panel-opacity, 0.74) * 0.9)) !important;
        border-color: rgba(120, 161, 187, 0.18) !important;
        box-shadow:
            0 20px 40px rgba(2, 6, 23, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
    }

    #gal-global-overlay.skin-dawn-twilight .gal-dialog-text {
        font-size: calc(0.88rem * var(--font-scale, 1)) !important;
        color: rgba(226, 232, 240, 0.96) !important;
    }

    #gal-global-overlay.skin-dawn-twilight[class*="skin-"] .gal-bottom-toolbar {
        background: rgba(15, 23, 42, 0.82) !important;
        border-color: rgba(120, 161, 187, 0.16) !important;
        box-shadow: 0 16px 30px rgba(2, 6, 23, 0.14) !important;
    }

    #gal-global-overlay.skin-dawn-twilight[class*="skin-"] .gal-bottom-toolbar .gal-footer-btn,
    #gal-global-overlay.skin-dawn-twilight[class*="skin-"] .gal-bottom-toolbar .gal-pending-choices-btn {
        color: rgba(184, 193, 200, 0.66) !important;
    }

    #gal-global-overlay.skin-dawn-twilight[class*="skin-"] .gal-bottom-toolbar .gal-footer-btn:hover,
    #gal-global-overlay.skin-dawn-twilight[class*="skin-"] .gal-bottom-toolbar .gal-pending-choices-btn:hover {
        background: rgba(120, 161, 187, 0.12) !important;
        color: rgba(226, 232, 240, 0.98) !important;
    }

    #gal-global-overlay.skin-orchid-twilight .gal-twilight-header {
        background: linear-gradient(180deg, rgba(45, 27, 45, 0.82) 0%, rgba(26, 22, 37, 0.56) 100%) !important;
        border-bottom: 1px solid rgba(183, 156, 237, 0.14) !important;
    }

    #gal-global-overlay.skin-orchid-twilight .gal-twilight-brand {
        color: rgba(255, 191, 105, 0.94) !important;
        opacity: 0.94 !important;
    }

    #gal-global-overlay.skin-orchid-twilight .gal-twilight-meta-btn {
        color: rgba(247, 225, 215, 0.74) !important;
    }

    #gal-global-overlay.skin-orchid-twilight .gal-twilight-header-actions .gal-status-popup-trigger,
    #gal-global-overlay.skin-orchid-twilight .gal-twilight-header-actions .gal-sprite-toggle,
    #gal-global-overlay.skin-orchid-twilight .gal-twilight-header-actions .gal-fullscreen-btn.gal-twilight-fullscreen-toggle {
        border-color: rgba(255, 191, 105, 0.14) !important;
        background: rgba(45, 27, 45, 0.54) !important;
    }

    #gal-global-overlay.skin-orchid-twilight[class*="skin-"] .gal-name-badge {
        background: rgba(45, 27, 45, 0.94) !important;
        border: 1px solid rgba(255, 191, 105, 0.26) !important;
        box-shadow: 0 8px 16px rgba(26, 22, 37, 0.1) !important;
    }

    #gal-global-overlay.skin-orchid-twilight .gal-name-badge span {
        background: transparent !important;
        color: rgba(255, 191, 105, 0.98) !important;
        padding: 0 18px !important;
    }

    #gal-global-overlay.skin-orchid-twilight .gal-twilight-dialog-topline {
        margin-bottom: 0 !important;
        align-items: flex-end !important;
    }

    #gal-global-overlay.skin-orchid-twilight .gal-text-panel {
        background:
            linear-gradient(180deg, rgba(45, 27, 45, 0.56) 0%, rgba(26, 22, 37, 0.2) 100%),
            rgba(26, 22, 37, calc(var(--panel-opacity, 0.74) * 0.92)) !important;
        border-color: rgba(183, 156, 237, 0.2) !important;
        box-shadow:
            0 20px 40px rgba(26, 22, 37, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
    }

    #gal-global-overlay.skin-orchid-twilight .gal-dialog-text {
        font-size: calc(0.88rem * var(--font-scale, 1)) !important;
        color: rgba(247, 225, 215, 0.96) !important;
    }

    #gal-global-overlay.skin-orchid-twilight[class*="skin-"] .gal-bottom-toolbar {
        background: rgba(45, 27, 45, 0.84) !important;
        border-color: rgba(183, 156, 237, 0.16) !important;
        box-shadow: 0 16px 30px rgba(26, 22, 37, 0.12) !important;
    }

    #gal-global-overlay.skin-orchid-twilight[class*="skin-"] .gal-bottom-toolbar .gal-footer-btn,
    #gal-global-overlay.skin-orchid-twilight[class*="skin-"] .gal-bottom-toolbar .gal-pending-choices-btn {
        color: rgba(247, 225, 215, 0.66) !important;
    }

    #gal-global-overlay.skin-orchid-twilight[class*="skin-"] .gal-bottom-toolbar .gal-footer-btn:hover,
    #gal-global-overlay.skin-orchid-twilight[class*="skin-"] .gal-bottom-toolbar .gal-pending-choices-btn:hover {
        background: rgba(255, 191, 105, 0.12) !important;
        color: rgba(255, 191, 105, 0.98) !important;
    }

    #gal-global-overlay.skin-neon-twilight .gal-twilight-header {
        background: linear-gradient(180deg, rgba(10, 10, 15, 0.88) 0%, rgba(19, 19, 32, 0.62) 100%) !important;
        border-bottom: 1px solid rgba(0, 242, 255, 0.16) !important;
    }

    #gal-global-overlay.skin-neon-twilight .gal-twilight-brand {
        color: rgba(0, 242, 255, 0.96) !important;
        opacity: 0.96 !important;
    }

    #gal-global-overlay.skin-neon-twilight .gal-twilight-meta-btn {
        color: rgba(240, 240, 255, 0.76) !important;
    }

    #gal-global-overlay.skin-neon-twilight .gal-twilight-header-actions .gal-status-popup-trigger,
    #gal-global-overlay.skin-neon-twilight .gal-twilight-header-actions .gal-sprite-toggle,
    #gal-global-overlay.skin-neon-twilight .gal-twilight-header-actions .gal-fullscreen-btn.gal-twilight-fullscreen-toggle {
        border-color: rgba(0, 242, 255, 0.16) !important;
        background: rgba(10, 10, 15, 0.58) !important;
        box-shadow: 0 0 16px rgba(0, 242, 255, 0.06) !important;
    }

    #gal-global-overlay.skin-neon-twilight[class*="skin-"] .gal-name-badge {
        background: linear-gradient(90deg, rgba(112, 0, 255, 0.94) 0%, rgba(0, 242, 255, 0.96) 100%) !important;
        border: 1px solid rgba(0, 242, 255, 0.24) !important;
        box-shadow: 0 8px 18px rgba(0, 0, 0, 0.14), 0 0 16px rgba(112, 0, 255, 0.12) !important;
    }

    #gal-global-overlay.skin-neon-twilight .gal-name-badge span {
        background: transparent !important;
        color: rgba(10, 10, 15, 0.98) !important;
        padding: 0 18px !important;
    }

    #gal-global-overlay.skin-neon-twilight .gal-twilight-dialog-topline {
        margin-bottom: 0 !important;
        align-items: flex-end !important;
    }

    #gal-global-overlay.skin-neon-twilight .gal-text-panel {
        background:
            linear-gradient(180deg, rgba(0, 0, 0, 0.66) 0%, rgba(10, 10, 15, 0.86) 100%) padding-box,
            linear-gradient(90deg, rgba(112, 0, 255, 0.78) 0%, rgba(0, 242, 255, 0.82) 100%) border-box !important;
        border-color: transparent !important;
        box-shadow:
            0 20px 40px rgba(0, 0, 0, 0.22),
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            0 0 18px rgba(0, 242, 255, 0.06) !important;
    }

    #gal-global-overlay.skin-neon-twilight .gal-dialog-text {
        font-size: calc(0.88rem * var(--font-scale, 1)) !important;
        color: rgba(240, 240, 255, 0.98) !important;
    }

    #gal-global-overlay.skin-neon-twilight[class*="skin-"] .gal-bottom-toolbar {
        background: rgba(10, 10, 15, 0.88) !important;
        border-color: rgba(0, 242, 255, 0.18) !important;
        box-shadow: 0 16px 30px rgba(0, 0, 0, 0.16), 0 0 18px rgba(0, 242, 255, 0.06) !important;
    }

    #gal-global-overlay.skin-neon-twilight[class*="skin-"] .gal-bottom-toolbar .gal-footer-btn,
    #gal-global-overlay.skin-neon-twilight[class*="skin-"] .gal-bottom-toolbar .gal-pending-choices-btn {
        color: rgba(240, 240, 255, 0.68) !important;
    }

    #gal-global-overlay.skin-neon-twilight[class*="skin-"] .gal-bottom-toolbar .gal-footer-btn:hover,
    #gal-global-overlay.skin-neon-twilight[class*="skin-"] .gal-bottom-toolbar .gal-pending-choices-btn:hover {
        background: rgba(0, 242, 255, 0.12) !important;
        color: rgba(0, 242, 255, 0.98) !important;
    }

    #gal-global-overlay.skin-clear-twilight .gal-twilight-header {
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.78) 0%, rgba(255, 255, 255, 0.62) 100%) !important;
        border-bottom: 1px solid rgba(0, 0, 0, 0.06) !important;
    }

    #gal-global-overlay.skin-clear-twilight .gal-twilight-brand {
        color: rgba(26, 26, 28, 0.92) !important;
        opacity: 0.94 !important;
    }

    #gal-global-overlay.skin-clear-twilight .gal-twilight-meta-btn {
        color: rgba(26, 26, 28, 0.66) !important;
    }

    #gal-global-overlay.skin-clear-twilight .gal-twilight-header-actions .gal-status-popup-trigger,
    #gal-global-overlay.skin-clear-twilight .gal-twilight-header-actions .gal-sprite-toggle,
    #gal-global-overlay.skin-clear-twilight .gal-twilight-header-actions .gal-fullscreen-btn.gal-twilight-fullscreen-toggle {
        border-color: rgba(0, 0, 0, 0.06) !important;
        background: rgba(255, 255, 255, 0.56) !important;
    }

    #gal-global-overlay.skin-clear-twilight[class*="skin-"] .gal-name-badge {
        background: rgba(224, 242, 254, 0.98) !important;
        border: 1px solid rgba(14, 165, 233, 0.14) !important;
        box-shadow: 0 8px 16px rgba(148, 163, 184, 0.06) !important;
    }

    #gal-global-overlay.skin-clear-twilight .gal-name-badge span {
        background: transparent !important;
        color: rgba(3, 105, 161, 0.94) !important;
        padding: 0 18px !important;
    }

    #gal-global-overlay.skin-clear-twilight .gal-twilight-dialog-topline {
        margin-bottom: 0 !important;
        align-items: flex-end !important;
    }

    #gal-global-overlay.skin-clear-twilight .gal-text-panel {
        background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.86) 0%, rgba(255, 255, 255, 0.68) 100%),
            rgba(255, 255, 255, calc(var(--panel-opacity, 0.74) * 0.94)) !important;
        border-color: rgba(0, 0, 0, 0.05) !important;
        box-shadow: 0 20px 40px rgba(148, 163, 184, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.54) !important;
    }

    #gal-global-overlay.skin-clear-twilight .gal-dialog-text {
        font-size: calc(0.88rem * var(--font-scale, 1)) !important;
        color: rgba(26, 26, 28, 0.92) !important;
    }

    #gal-global-overlay.skin-clear-twilight[class*="skin-"] .gal-bottom-toolbar {
        background: rgba(255, 255, 255, 0.84) !important;
        border-color: rgba(0, 0, 0, 0.06) !important;
        box-shadow: 0 16px 30px rgba(148, 163, 184, 0.08) !important;
    }

    #gal-global-overlay.skin-clear-twilight[class*="skin-"] .gal-bottom-toolbar .gal-footer-btn,
    #gal-global-overlay.skin-clear-twilight[class*="skin-"] .gal-bottom-toolbar .gal-pending-choices-btn {
        color: rgba(26, 26, 28, 0.64) !important;
    }

    #gal-global-overlay.skin-clear-twilight[class*="skin-"] .gal-bottom-toolbar .gal-footer-btn:hover,
    #gal-global-overlay.skin-clear-twilight[class*="skin-"] .gal-bottom-toolbar .gal-pending-choices-btn:hover {
        background: rgba(0, 0, 0, 0.05) !important;
        color: rgba(14, 165, 233, 0.92) !important;
    }

    #gal-global-overlay.skin-forest-twilight .gal-twilight-header {
        background: linear-gradient(180deg, rgba(10, 31, 22, 0.84) 0%, rgba(10, 31, 22, 0.58) 100%) !important;
        border-bottom: 1px solid rgba(212, 175, 55, 0.14) !important;
    }

    #gal-global-overlay.skin-forest-twilight .gal-twilight-brand {
        color: rgba(212, 175, 55, 0.94) !important;
        opacity: 0.96 !important;
    }

    #gal-global-overlay.skin-forest-twilight .gal-twilight-meta-btn {
        color: rgba(165, 243, 252, 0.72) !important;
    }

    #gal-global-overlay.skin-forest-twilight .gal-twilight-header-actions .gal-status-popup-trigger,
    #gal-global-overlay.skin-forest-twilight .gal-twilight-header-actions .gal-sprite-toggle,
    #gal-global-overlay.skin-forest-twilight .gal-fullscreen-btn.gal-twilight-fullscreen-toggle {
        border-color: rgba(212, 175, 55, 0.12) !important;
        background: rgba(10, 31, 22, 0.54) !important;
    }

    #gal-global-overlay.skin-forest-twilight[class*="skin-"] .gal-name-badge {
        background: linear-gradient(90deg, rgba(61, 43, 31, 0.96) 0%, rgba(30, 58, 42, 0.96) 100%) !important;
        border: 1px solid rgba(212, 175, 55, 0.22) !important;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12) !important;
    }

    #gal-global-overlay.skin-forest-twilight .gal-name-badge span {
        background: transparent !important;
        color: rgba(212, 175, 55, 0.98) !important;
        padding: 0 18px !important;
    }

    #gal-global-overlay.skin-forest-twilight .gal-twilight-dialog-topline {
        margin-bottom: 0 !important;
        align-items: flex-end !important;
    }

    #gal-global-overlay.skin-forest-twilight .gal-text-panel {
        background:
            linear-gradient(180deg, rgba(10, 31, 22, 0.9) 0%, rgba(5, 15, 11, 0.82) 100%),
            rgba(10, 31, 22, calc(var(--panel-opacity, 0.74) * 0.96)) !important;
        border-color: rgba(212, 175, 55, 0.16) !important;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
    }

    #gal-global-overlay.skin-forest-twilight .gal-dialog-text {
        font-size: calc(0.88rem * var(--font-scale, 1)) !important;
        color: rgba(243, 244, 246, 0.96) !important;
    }

    #gal-global-overlay.skin-forest-twilight[class*="skin-"] .gal-bottom-toolbar {
        background: rgba(10, 31, 22, 0.86) !important;
        border-color: rgba(212, 175, 55, 0.14) !important;
        box-shadow: 0 16px 30px rgba(0, 0, 0, 0.14) !important;
    }

    #gal-global-overlay.skin-forest-twilight[class*="skin-"] .gal-bottom-toolbar .gal-footer-btn,
    #gal-global-overlay.skin-forest-twilight[class*="skin-"] .gal-bottom-toolbar .gal-pending-choices-btn {
        color: rgba(212, 175, 55, 0.62) !important;
    }

    #gal-global-overlay.skin-forest-twilight[class*="skin-"] .gal-bottom-toolbar .gal-footer-btn:hover,
    #gal-global-overlay.skin-forest-twilight[class*="skin-"] .gal-bottom-toolbar .gal-pending-choices-btn:hover {
        background: rgba(212, 175, 55, 0.08) !important;
        color: rgba(212, 175, 55, 0.98) !important;
    }

    #gal-global-overlay.skin-cyber-twilight .gal-twilight-header {
        background: linear-gradient(180deg, rgba(45, 0, 77, 0.46) 0%, rgba(26, 11, 46, 0.72) 100%) !important;
        border-bottom: 1px solid rgba(0, 243, 255, 0.16) !important;
    }

    #gal-global-overlay.skin-cyber-twilight .gal-twilight-brand {
        color: rgba(0, 243, 255, 0.96) !important;
        opacity: 0.96 !important;
    }

    #gal-global-overlay.skin-cyber-twilight .gal-twilight-meta-btn {
        color: rgba(0, 210, 255, 0.76) !important;
    }

    #gal-global-overlay.skin-cyber-twilight .gal-twilight-header-actions .gal-status-popup-trigger,
    #gal-global-overlay.skin-cyber-twilight .gal-twilight-header-actions .gal-sprite-toggle,
    #gal-global-overlay.skin-cyber-twilight .gal-fullscreen-btn.gal-twilight-fullscreen-toggle {
        border-color: rgba(0, 243, 255, 0.16) !important;
        background: rgba(26, 11, 46, 0.62) !important;
    }

    #gal-global-overlay.skin-cyber-twilight[class*="skin-"] .gal-name-badge {
        background: rgba(0, 243, 255, 0.96) !important;
        border: 1px solid rgba(0, 243, 255, 0.24) !important;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.14), 0 0 16px rgba(0, 243, 255, 0.14) !important;
    }

    #gal-global-overlay.skin-cyber-twilight .gal-name-badge span {
        background: transparent !important;
        color: rgba(45, 0, 77, 0.98) !important;
        padding: 0 18px !important;
    }

    #gal-global-overlay.skin-cyber-twilight .gal-twilight-dialog-topline {
        margin-bottom: 0 !important;
        align-items: flex-end !important;
    }

    #gal-global-overlay.skin-cyber-twilight .gal-text-panel {
        background:
            linear-gradient(180deg, rgba(26, 11, 46, 0.9) 0%, rgba(14, 6, 26, 0.88) 100%),
            rgba(26, 11, 46, calc(var(--panel-opacity, 0.74) * 0.98)) !important;
        border-color: rgba(0, 243, 255, 0.22) !important;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 0 16px rgba(0, 243, 255, 0.08) !important;
    }

    #gal-global-overlay.skin-cyber-twilight .gal-dialog-text {
        font-size: calc(0.88rem * var(--font-scale, 1)) !important;
        color: rgba(224, 242, 254, 0.96) !important;
    }

    #gal-global-overlay.skin-cyber-twilight[class*="skin-"] .gal-bottom-toolbar {
        background: rgba(26, 11, 46, 0.9) !important;
        border-color: rgba(0, 243, 255, 0.18) !important;
        box-shadow: 0 16px 30px rgba(0, 0, 0, 0.16) !important;
    }

    #gal-global-overlay.skin-cyber-twilight[class*="skin-"] .gal-bottom-toolbar .gal-footer-btn,
    #gal-global-overlay.skin-cyber-twilight[class*="skin-"] .gal-bottom-toolbar .gal-pending-choices-btn {
        color: rgba(0, 210, 255, 0.72) !important;
    }

    #gal-global-overlay.skin-cyber-twilight[class*="skin-"] .gal-bottom-toolbar .gal-footer-btn:hover,
    #gal-global-overlay.skin-cyber-twilight[class*="skin-"] .gal-bottom-toolbar .gal-pending-choices-btn:hover {
        background: rgba(0, 243, 255, 0.08) !important;
        color: rgba(57, 255, 20, 0.96) !important;
    }

    #gal-global-overlay.skin-dream-twilight .gal-twilight-header {
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.74) 0%, rgba(243, 240, 255, 0.58) 100%) !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.72) !important;
    }

    #gal-global-overlay.skin-dream-twilight .gal-twilight-brand {
        color: rgba(74, 59, 78, 0.92) !important;
        opacity: 0.94 !important;
    }

    #gal-global-overlay.skin-dream-twilight .gal-twilight-meta-btn {
        color: rgba(74, 59, 78, 0.68) !important;
    }

    #gal-global-overlay.skin-dream-twilight .gal-twilight-header-actions .gal-status-popup-trigger,
    #gal-global-overlay.skin-dream-twilight .gal-twilight-header-actions .gal-sprite-toggle,
    #gal-global-overlay.skin-dream-twilight .gal-fullscreen-btn.gal-twilight-fullscreen-toggle {
        border-color: rgba(255, 255, 255, 0.72) !important;
        background: rgba(255, 255, 255, 0.56) !important;
    }

    #gal-global-overlay.skin-dream-twilight[class*="skin-"] .gal-name-badge {
        background: rgba(255, 237, 213, 0.96) !important;
        border: 1px solid rgba(255, 255, 255, 0.72) !important;
        box-shadow: 0 8px 16px rgba(243, 240, 255, 0.08) !important;
    }

    #gal-global-overlay.skin-dream-twilight .gal-name-badge span {
        background: transparent !important;
        color: rgba(74, 59, 78, 0.94) !important;
        padding: 0 18px !important;
    }

    #gal-global-overlay.skin-dream-twilight .gal-twilight-dialog-topline {
        margin-bottom: 0 !important;
        align-items: flex-end !important;
    }

    #gal-global-overlay.skin-dream-twilight .gal-text-panel {
        background:
            linear-gradient(180deg, rgba(243, 240, 255, 0.88) 0%, rgba(243, 240, 255, 0.7) 100%),
            rgba(243, 240, 255, calc(var(--panel-opacity, 0.74) * 0.96)) !important;
        border-color: rgba(255, 255, 255, 0.78) !important;
        box-shadow: 0 20px 40px rgba(243, 240, 255, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.62) !important;
    }

    #gal-global-overlay.skin-dream-twilight .gal-dialog-text {
        font-size: calc(0.88rem * var(--font-scale, 1)) !important;
        color: rgba(63, 63, 70, 0.92) !important;
    }

    #gal-global-overlay.skin-dream-twilight[class*="skin-"] .gal-bottom-toolbar {
        background: rgba(255, 255, 255, 0.8) !important;
        border-color: rgba(255, 255, 255, 0.72) !important;
        box-shadow: 0 16px 30px rgba(243, 240, 255, 0.12) !important;
    }

    #gal-global-overlay.skin-dream-twilight[class*="skin-"] .gal-bottom-toolbar .gal-footer-btn,
    #gal-global-overlay.skin-dream-twilight[class*="skin-"] .gal-bottom-toolbar .gal-pending-choices-btn {
        color: rgba(74, 59, 78, 0.64) !important;
    }

    #gal-global-overlay.skin-dream-twilight[class*="skin-"] .gal-bottom-toolbar .gal-footer-btn:hover,
    #gal-global-overlay.skin-dream-twilight[class*="skin-"] .gal-bottom-toolbar .gal-pending-choices-btn:hover {
        background: rgba(255, 255, 255, 0.32) !important;
        color: rgba(74, 59, 78, 0.94) !important;
    }

    #gal-global-overlay.skin-rosy-twilight .gal-twilight-header {
        background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.26) 0%, rgba(255, 128, 171, 0.1) 100%),
            rgba(255, 128, 171, 0.22) !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.44) !important;
    }

    #gal-global-overlay.skin-rosy-twilight .gal-twilight-brand {
        color: rgba(61, 59, 60, 0.92) !important;
        opacity: 0.94 !important;
    }

    #gal-global-overlay.skin-rosy-twilight .gal-twilight-meta-btn {
        color: rgba(61, 59, 60, 0.7) !important;
    }

    #gal-global-overlay.skin-rosy-twilight .gal-twilight-header-actions .gal-status-popup-trigger,
    #gal-global-overlay.skin-rosy-twilight .gal-twilight-header-actions .gal-sprite-toggle,
    #gal-global-overlay.skin-rosy-twilight .gal-fullscreen-btn.gal-twilight-fullscreen-toggle {
        border-color: rgba(255, 255, 255, 0.68) !important;
        background: rgba(255, 255, 255, 0.56) !important;
    }

    #gal-global-overlay.skin-rosy-twilight[class*="skin-"] .gal-name-badge {
        background: rgba(252, 228, 236, 0.96) !important;
        border: 1px solid rgba(255, 255, 255, 0.74) !important;
        box-shadow: 0 8px 16px rgba(255, 128, 171, 0.1) !important;
    }

    #gal-global-overlay.skin-rosy-twilight .gal-name-badge span {
        background: transparent !important;
        color: rgba(255, 0, 127, 0.92) !important;
        padding: 0 18px !important;
    }

    #gal-global-overlay.skin-rosy-twilight .gal-twilight-dialog-topline {
        margin-bottom: 0 !important;
        align-items: flex-end !important;
    }

    #gal-global-overlay.skin-rosy-twilight .gal-text-panel {
        background:
            linear-gradient(180deg, rgba(252, 228, 236, 0.88) 0%, rgba(255, 240, 243, 0.72) 100%),
            rgba(255, 240, 243, calc(var(--panel-opacity, 0.74) * 0.96)) !important;
        border-color: rgba(255, 255, 255, 0.78) !important;
        box-shadow: 0 20px 40px rgba(255, 128, 171, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.62) !important;
    }

    #gal-global-overlay.skin-rosy-twilight .gal-dialog-text {
        font-size: calc(0.88rem * var(--font-scale, 1)) !important;
        color: rgba(61, 59, 60, 0.92) !important;
    }

    #gal-global-overlay.skin-rosy-twilight[class*="skin-"] .gal-bottom-toolbar {
        background: rgba(255, 255, 255, 0.76) !important;
        border-color: rgba(255, 255, 255, 0.7) !important;
        box-shadow: 0 16px 30px rgba(255, 128, 171, 0.12) !important;
    }

    #gal-global-overlay.skin-rosy-twilight[class*="skin-"] .gal-bottom-toolbar .gal-footer-btn,
    #gal-global-overlay.skin-rosy-twilight[class*="skin-"] .gal-bottom-toolbar .gal-pending-choices-btn {
        color: rgba(61, 59, 60, 0.66) !important;
    }

    #gal-global-overlay.skin-rosy-twilight[class*="skin-"] .gal-bottom-toolbar .gal-footer-btn:hover,
    #gal-global-overlay.skin-rosy-twilight[class*="skin-"] .gal-bottom-toolbar .gal-pending-choices-btn:hover {
        background: rgba(255, 255, 255, 0.32) !important;
        color: rgba(61, 59, 60, 0.94) !important;
    }
}

/* =========================================================
   1. 墨染千秋 (Ancient / Ink Wash Scroll) — 水墨长卷
   设计语言: 水墨长卷 × 大写意留白 × 漆木轴手卷 × 墨晕交互
   舞台是一幅留白的水墨山水, 对话框是展开的手卷,
   名牌是一笔浓墨落纸带小朱印, 悬停反馈统一为「墨晕洇开」
   配色: 绢本 #ece5d3, 焦墨 #1c1a17, 印泥朱 #9e2b1f, 泥金 #a8863c
   变体: skin-ancient-qinglv（青绿设色）仅覆写 CSS 变量
   ========================================================= */
#gal-global-overlay[class*="skin-ancient"],
#gal-layer-choices[class*="skin-ancient"],
.gal-history-modal[class*="skin-ancient"] {
    --ink-silk: #ece5d3;
    --ink-silk-rgb: 236, 229, 211;
    --ink-paper: #f4eee0;
    --ink-paper-warm: #eae2cd;
    --ink-black: #1c1a17;
    --ink-black-rgb: 28, 26, 23;
    --ink-deep: #35302a;
    --ink-mid: #6e675c;
    --ink-faint: #a89f8e;
    --ink-seal: #9e2b1f;
    --ink-gold: #a8863c;
    --ink-gold-lt: #c9a659;
    --ink-gold-dk: #7a5f26;
    --ink-lacquer: #241610;
    --ink-lacquer-lt: #3a281c;
    --ink-mountain-far: #6e675c;
    --ink-mountain-mid: #4a443a;
    --ink-on-ink: #f0ead9;
    --ink-font-kai: "KaiTi", "STKaiti", "楷体", "Noto Serif SC", "Source Han Serif SC", serif;
    --ink-font-brush: "Ma Shan Zheng", "KaiTi", "STKaiti", "楷体", cursive;
    --gal-quote-color: var(--ink-seal);
}
#gal-global-overlay.skin-ancient-qinglv,
#gal-layer-choices.skin-ancient-qinglv,
.gal-history-modal.skin-ancient-qinglv {
    --ink-silk: #e8e6d5;
    --ink-silk-rgb: 232, 230, 213;
    --ink-paper: #f0efe0;
    --ink-paper-warm: #e2e0cb;
    --ink-black: #14231f;
    --ink-black-rgb: 20, 35, 31;
    --ink-deep: #1f4a41;
    --ink-mid: #4e7a6b;
    --ink-faint: #8aa898;
    --ink-lacquer: #12251f;
    --ink-lacquer-lt: #1f3a30;
    --ink-mountain-far: #4e7a6b;
    --ink-mountain-mid: #2b5c72;
    --gal-quote-color: #2b5c72;
}
#gal-global-overlay[class*="skin-ancient"] { font-family: var(--ink-font-kai); }

/* —— 无背景图时的舞台：留白水墨山水（远山三叠 + 雾带 + 水面）—— */
#gal-global-overlay[class*="skin-ancient"] .gal-layer-bg:not(.has-bg):not(.generating-bg) {
    background:
        radial-gradient(120% 95% at 50% 30%, rgba(255, 252, 242, 0.55) 0%, rgba(var(--ink-silk-rgb), 0) 55%),
        radial-gradient(140% 120% at 50% 110%, rgba(var(--ink-black-rgb), 0.2) 0%, rgba(var(--ink-black-rgb), 0) 46%),
        linear-gradient(175deg, var(--ink-paper) 0%, var(--ink-silk) 46%, var(--ink-paper-warm) 100%) !important;
}
/* 远山两叠（::before 淡墨远山，::after 浓墨近山 + 雾带用渐变叠出） */
#gal-global-overlay[class*="skin-ancient"] .gal-layer-bg:not(.has-bg):not(.generating-bg)::before {
    background:
        radial-gradient(58% 26% at 24% 62%, var(--ink-mountain-far) 0 60%, transparent 61%),
        radial-gradient(42% 22% at 55% 61%, var(--ink-mountain-far) 0 58%, transparent 59%),
        radial-gradient(50% 18% at 86% 60%, var(--ink-mountain-far) 0 55%, transparent 56%),
        radial-gradient(44% 30% at 12% 70%, var(--ink-mountain-mid) 0 58%, transparent 59%),
        radial-gradient(52% 33% at 46% 71%, var(--ink-mountain-mid) 0 62%, transparent 63%),
        radial-gradient(38% 25% at 82% 69%, var(--ink-mountain-mid) 0 54%, transparent 55%) !important;
    background-size: auto !important;
    opacity: 0.34 !important;
    filter: blur(1.5px);
}
#gal-global-overlay[class*="skin-ancient"] .gal-layer-bg:not(.has-bg):not(.generating-bg)::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
        /* 雾带：拦腰截断山体 */
        linear-gradient(180deg, transparent 56%, rgba(var(--ink-silk-rgb), 0.9) 63%, rgba(var(--ink-silk-rgb), 0.94) 68%, transparent 76%),
        /* 浓墨近山 */
        radial-gradient(36% 28% at 8% 84%, var(--ink-deep) 0 56%, transparent 57%),
        radial-gradient(30% 20% at 34% 83%, var(--ink-deep) 0 52%, transparent 53%),
        radial-gradient(46% 25% at 72% 84%, var(--ink-deep) 0 58%, transparent 59%),
        radial-gradient(28% 17% at 97% 83%, var(--ink-deep) 0 50%, transparent 51%),
        /* 水面淡墨 */
        linear-gradient(180deg, transparent 82%, rgba(var(--ink-black-rgb), 0.1) 88%, rgba(var(--ink-black-rgb), 0.02) 100%);
    opacity: 0.62;
    animation: galAncientMistDrift 28s ease-in-out infinite alternate;
}
@keyframes galAncientMistDrift {
    from { transform: translateX(-1.6%); }
    to { transform: translateX(1.6%); }
}

/* —— 背景生成中：墨池 + 一道淡墨扫过 —— */
#gal-global-overlay[class*="skin-ancient"] .gal-layer-bg.generating-bg {
    background: linear-gradient(168deg, #232019 0%, #191712 56%, #282419 100%) !important;
}
#gal-global-overlay[class*="skin-ancient"] .gal-layer-bg.generating-bg::before {
    background-image: none !important;
    opacity: 0 !important;
}
#gal-global-overlay[class*="skin-ancient"] .gal-layer-bg.generating-bg::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(180deg,
        transparent 0%,
        rgba(236, 229, 211, 0.03) 42%,
        rgba(236, 229, 211, 0.14) 50%,
        rgba(236, 229, 211, 0.03) 58%,
        transparent 100%);
    background-size: 100% 300%;
    background-repeat: no-repeat;
    animation: galAncientInkScan 3.4s ease-in-out infinite;
}
@keyframes galAncientInkScan {
    0% { background-position: 0 -120%; }
    100% { background-position: 0 220%; }
}

/* —— 对话正文：手卷（上下漆木轴 + 绢面 + 两端渐隐由 box-shadow/渐变模拟）—— */
#gal-global-overlay[class*="skin-ancient"] .gal-text-panel {
    background:
        linear-gradient(90deg, rgba(216, 205, 178, 0.55) 0%, transparent 5%, transparent 95%, rgba(216, 205, 178, 0.55) 100%),
        linear-gradient(178deg, rgba(244, 238, 224, var(--panel-opacity, 0.96)) 0%, rgba(234, 226, 205, var(--panel-opacity, 0.96)) 100%) !important;
    border: none !important;
    border-top: 5px solid var(--ink-lacquer) !important;
    border-bottom: 5px solid var(--ink-lacquer) !important;
    border-radius: 3px !important;
    box-shadow:
        0 -7px 0 -1px var(--ink-lacquer-lt),
        0 7px 0 -1px var(--ink-lacquer-lt),
        0 1.6rem 2.8rem -1.1rem rgba(20, 14, 6, 0.55) !important;
}
#gal-global-overlay[class*="skin-ancient"] .gal-dialog-text {
    color: var(--ink-black) !important;
    font-weight: 500 !important;
    letter-spacing: 0.08em;
    line-height: 2.1 !important;
    text-shadow: none !important;
    font-family: var(--ink-font-kai) !important;
}

/* —— 姓名牌：一笔浓墨落纸（笔触 clip-path）+ 右下小朱印 —— */
#gal-global-overlay[class*="skin-ancient"]:not(.skin-default):not(.skin-default-dark):not(.skin-twilight) .gal-name-badge {
    background: radial-gradient(140% 190% at 8% 30%, var(--ink-deep) 0%, var(--ink-black) 55%, rgba(var(--ink-black-rgb), 0.94) 100%) !important;
    color: var(--ink-on-ink) !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    font-family: var(--ink-font-brush) !important;
    font-size: 1.35rem !important;
    padding: 0.45rem 1.7rem 0.45rem 1.3rem !important;
    left: 20px !important;
    top: -24px !important;
    clip-path: polygon(0% 42%, 3% 12%, 10% 0%, 88% 4%, 100% 32%, 97% 78%, 90% 100%, 12% 96%, 2% 74%);
    transform: rotate(-1.2deg) scale(var(--ui-scale)) !important;
    transform-origin: bottom left;
    filter: drop-shadow(0 6px 12px rgba(20, 14, 6, 0.4));
    z-index: 36;
}
#gal-global-overlay[class*="skin-ancient"] .gal-name-badge span {
    transform: none !important;
    font-weight: 400;
    letter-spacing: 0.14em;
    text-shadow: none !important;
    font-family: var(--ink-font-brush) !important;
}
#gal-global-overlay[class*="skin-ancient"] .gal-name-badge::after {
    content: "";
    position: absolute;
    right: -6px;
    bottom: -6px;
    width: 12px;
    height: 12px;
    background: var(--ink-seal);
    border-radius: 2px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}
#gal-global-overlay[class*="skin-ancient"] .gal-name-badge.gal-narrator-label {
    background: radial-gradient(140% 190% at 8% 30%, #8a8375 0%, var(--ink-mid) 60%, rgba(110, 103, 92, 0.92) 100%) !important;
    color: #f6f1e4 !important;
}
#gal-global-overlay[class*="skin-ancient"] .gal-name-badge.gal-narrator-label::after { background: var(--ink-mid); }

/* —— 对话框右上悬浮操作：绢底墨字小签，悬停墨色涨满 —— */
#gal-global-overlay[class*="skin-ancient"] .gal-action-btn {
    background: rgba(244, 238, 224, 0.96) !important;
    border: 1px solid rgba(var(--ink-black-rgb), 0.35) !important;
    color: var(--ink-deep) !important;
    font-weight: 600 !important;
    border-radius: 2px !important;
    letter-spacing: 0.18em !important;
    box-shadow: 0 4px 10px -4px rgba(20, 14, 6, 0.4) !important;
    transition: all 0.28s ease !important;
    font-family: var(--ink-font-kai) !important;
}
#gal-global-overlay[class*="skin-ancient"] .gal-action-btn:hover {
    background: var(--ink-black) !important;
    color: var(--ink-on-ink) !important;
    border-color: var(--ink-black) !important;
}
#gal-global-overlay[class*="skin-ancient"] .gal-action-btn.btn-free:hover {
    background: var(--ink-seal) !important;
    border-color: var(--ink-seal) !important;
    color: #f5e9d4 !important;
}

/* —— 底部工具栏：一行淡墨小字，悬停洇出墨晕圆 —— */
#gal-global-overlay[class*="skin-ancient"] .gal-footer-btn {
    background: transparent !important;
    border: none !important;
    color: var(--ink-mid) !important;
    font-weight: 600 !important;
    border-radius: 50% !important;
    letter-spacing: 0.12em !important;
    box-shadow: none !important;
    position: relative !important;
    isolation: isolate;
    transition: color 0.26s ease !important;
    font-family: var(--ink-font-kai) !important;
}
#gal-global-overlay[class*="skin-ancient"] .gal-footer-btn::before {
    content: "";
    position: absolute;
    inset: 2px;
    z-index: -1;
    background: radial-gradient(circle, rgba(var(--ink-black-rgb), 0.88) 0%, rgba(var(--ink-black-rgb), 0.62) 60%, transparent 72%);
    border-radius: 50%;
    transform: scale(0.3);
    opacity: 0;
    transition: transform 0.3s ease, opacity 0.28s ease;
}
#gal-global-overlay[class*="skin-ancient"] .gal-footer-btn:hover {
    background: transparent !important;
    color: var(--ink-on-ink) !important;
    border-color: transparent !important;
    box-shadow: none !important;
}
#gal-global-overlay[class*="skin-ancient"] .gal-footer-btn:hover::before {
    transform: scale(1);
    opacity: 1;
}

/* —— NEXT：「展卷」——小手卷，悬停字距拉开、两端泥金轴头外扩 —— */
#gal-global-overlay[class*="skin-ancient"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn-next {
    background: linear-gradient(180deg, var(--ink-deep) 0%, var(--ink-black) 100%) !important;
    color: var(--ink-on-ink) !important;
    border: none !important;
    border-radius: 3px !important;
    box-shadow: 0 6px 14px -6px rgba(0, 0, 0, 0.5) !important;
    font-family: var(--ink-font-kai) !important;
    font-weight: 700 !important;
    letter-spacing: 0.3em !important;
    text-indent: 0.3em;
    position: relative !important;
    overflow: visible !important;
    transition: letter-spacing 0.3s ease, box-shadow 0.3s ease !important;
}
#gal-global-overlay[class*="skin-ancient"] .gal-footer-btn-next::before,
#gal-global-overlay[class*="skin-ancient"] .gal-footer-btn-next::after {
    content: "";
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 6px;
    background: linear-gradient(180deg, var(--ink-gold-lt), var(--ink-gold-dk));
    border-radius: 3px;
    transition: transform 0.3s ease;
}
#gal-global-overlay[class*="skin-ancient"] .gal-footer-btn-next::before { left: -9px; }
#gal-global-overlay[class*="skin-ancient"] .gal-footer-btn-next::after { right: -9px; }
#gal-global-overlay[class*="skin-ancient"] .gal-footer-btn-next:hover {
    background: linear-gradient(180deg, var(--ink-deep) 0%, var(--ink-black) 100%) !important;
    letter-spacing: 0.44em !important;
    box-shadow: 0 8px 20px -6px rgba(0, 0, 0, 0.6) !important;
}
#gal-global-overlay[class*="skin-ancient"] .gal-footer-btn-next:hover::before { transform: translateX(-4px); }
#gal-global-overlay[class*="skin-ancient"] .gal-footer-btn-next:hover::after { transform: translateX(4px); }

#gal-global-overlay[class*="skin-ancient"] .gal-footer-btn:active,
#gal-global-overlay[class*="skin-ancient"] .gal-action-btn:active,
#gal-global-overlay[class*="skin-ancient"] .gal-footer-btn-next:active {
    transform: translateY(1px) !important;
}

/* —— 待选项按钮：朱印呼吸 —— */
#gal-global-overlay[class*="skin-ancient"]:not(.skin-default):not(.skin-default-dark) .gal-pending-choices-btn {
    background: var(--ink-seal) !important;
    color: #f5e9d4 !important;
    border: none !important;
    border-radius: 2px !important;
    font-family: var(--ink-font-kai) !important;
    font-weight: 700 !important;
    letter-spacing: 0.16em !important;
}
#gal-global-overlay[class*="skin-ancient"] .gal-pending-choices-btn.show,
#gal-global-overlay[class*="skin-ancient"] .gal-pending-choices-btn.gal-new-option-highlight {
    animation: galAncientSealBreathe 2.4s ease-out infinite !important;
}
#gal-global-overlay[class*="skin-ancient"] .gal-pending-choices-btn:hover {
    background: #b53a2a !important;
    color: #f5e9d4 !important;
    border-color: transparent !important;
    box-shadow: 0 0.4rem 1rem -0.3rem rgba(158, 43, 31, 0.55) !important;
}
@keyframes galAncientSealBreathe {
    0% { box-shadow: 0 0 0 0 rgba(158, 43, 31, 0.4); }
    70% { box-shadow: 0 0 0 0.7rem rgba(158, 43, 31, 0); }
    100% { box-shadow: 0 0 0 0 rgba(158, 43, 31, 0); }
}

/* —— 进度条：一笔由浓转淡的墨迹 —— */
#gal-global-overlay[class*="skin-ancient"] .gal-dialog-layer .gal-progress-container {
    background: rgba(var(--ink-black-rgb), 0.14) !important;
    height: 0.22rem !important;
    border-radius: 3px;
}
#gal-global-overlay[class*="skin-ancient"] .gal-progress-bar {
    background: linear-gradient(90deg, var(--ink-black) 0%, var(--ink-deep) 55%, var(--ink-faint) 100%) !important;
    box-shadow: none !important;
    border-radius: 3px;
}

/* —— 顶部地点/时间：题跋式绢底小签 —— */
#gal-global-overlay[class*="skin-ancient"] .gal-location-bar,
#gal-global-overlay[class*="skin-ancient"] .gal-time-bar {
    background: rgba(var(--ink-silk-rgb), 0.72) !important;
    border: 1px solid rgba(var(--ink-black-rgb), 0.25) !important;
    border-radius: 2px !important;
    color: var(--ink-deep) !important;
    font-family: var(--ink-font-kai) !important;
    letter-spacing: 0.22em !important;
    text-shadow: none;
    backdrop-filter: blur(2px);
}
#gal-global-overlay[class*="skin-ancient"] .gal-location-bar i { color: var(--ink-seal) !important; }
#gal-global-overlay[class*="skin-ancient"] .gal-time-bar i { color: var(--ink-gold) !important; }
#gal-global-overlay[class*="skin-ancient"] .gal-fullscreen-btn {
    background: rgba(var(--ink-silk-rgb), 0.5) !important;
    border: 1px solid rgba(var(--ink-black-rgb), 0.3) !important;
    border-radius: 999px !important;
    color: var(--ink-mid) !important;
    backdrop-filter: blur(2px);
    transition: all 0.3s ease;
}
#gal-global-overlay[class*="skin-ancient"] .gal-fullscreen-btn:hover {
    background: var(--ink-deep) !important;
    border-color: var(--ink-deep) !important;
    color: var(--ink-on-ink) !important;
}

/* —— 立绘显隐 / 状态弹窗小按钮：绢底圆钮 —— */
#gal-global-overlay[class*="skin-ancient"] .gal-sprite-toggle,
#gal-global-overlay[class*="skin-ancient"] .gal-status-popup-trigger {
    background: var(--ink-paper) !important;
    border: 1px solid rgba(var(--ink-black-rgb), 0.32) !important;
    border-radius: 999px !important;
    box-shadow: 0 0.3rem 0.7rem -0.3rem rgba(20, 14, 6, 0.4) !important;
}
#gal-global-overlay[class*="skin-ancient"] .gal-sprite-toggle .gal-eye-icon,
#gal-global-overlay[class*="skin-ancient"] .gal-status-popup-trigger .gal-status-popup-icon {
    color: var(--ink-seal) !important;
}
#gal-global-overlay[class*="skin-ancient"] .gal-sprite-toggle:hover,
#gal-global-overlay[class*="skin-ancient"] .gal-status-popup-trigger:hover {
    background: var(--ink-black) !important;
    border-color: var(--ink-black) !important;
}
#gal-global-overlay[class*="skin-ancient"] .gal-sprite-toggle:hover .gal-eye-icon,
#gal-global-overlay[class*="skin-ancient"] .gal-status-popup-trigger:hover .gal-status-popup-icon {
    color: var(--ink-on-ink) !important;
}

/* —— 生成中指示器：「运笔之中」——墨滴入水双圈涟漪 —— */
#gal-global-overlay[class*="skin-ancient"] .gal-generating-indicator {
    background: linear-gradient(178deg, var(--ink-paper) 0%, var(--ink-paper-warm) 100%) !important;
    border: none !important;
    border-top: 4px solid var(--ink-lacquer) !important;
    border-bottom: 4px solid var(--ink-lacquer) !important;
    border-radius: 2px !important;
    box-shadow: 0 1.8rem 3.5rem -1.4rem rgba(5, 3, 1, 0.7) !important;
}
#gal-global-overlay[class*="skin-ancient"] .gal-generating-indicator .gal-gen-icon {
    color: var(--ink-deep) !important;
    animation: galAncientInkCore 1.8s ease-in-out infinite !important;
}
@keyframes galAncientInkCore {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(0.82); opacity: 0.7; }
}
#gal-global-overlay[class*="skin-ancient"] .gal-generating-indicator .gal-gen-text {
    color: var(--ink-black) !important;
    font-family: var(--ink-font-kai) !important;
    letter-spacing: 0.5em !important;
    text-indent: 0.5em;
    font-weight: 700 !important;
}
#gal-global-overlay[class*="skin-ancient"] .gal-generating-indicator .gal-gen-status {
    color: var(--ink-mid) !important;
    font-family: var(--ink-font-kai) !important;
    letter-spacing: 0.24em;
}
#gal-global-overlay[class*="skin-ancient"] .gal-generating-indicator .gal-gen-dot { background: var(--ink-deep) !important; }

/* —— 选项浮层：挂轴自上垂落，悬停朱批圈点（class 由 choices.js 同步）—— */
#gal-layer-choices[class*="skin-ancient"] {
    background: rgba(24, 20, 14, 0.52) !important;
    backdrop-filter: blur(3px) saturate(0.88);
}
#gal-layer-choices[class*="skin-ancient"] .gal-choices-title {
    transform: none;
    font-family: var(--ink-font-kai);
    font-weight: 700;
    color: var(--ink-silk);
    letter-spacing: 0.6em;
    text-indent: 0.6em;
    text-transform: none;
}
#gal-layer-choices[class*="skin-ancient"] .gal-choices-title span { transform: none; }
#gal-layer-choices[class*="skin-ancient"] .gal-choices-title::after {
    content: "";
    display: block;
    width: 1px;
    height: 1.4rem;
    margin: 0.65rem auto 0;
    background: linear-gradient(var(--ink-seal), transparent);
}
#gal-layer-choices[class*="skin-ancient"] .gal-choices-container { counter-reset: ancient-choice; }
#gal-layer-choices[class*="skin-ancient"] .gal-choice-card {
    counter-increment: ancient-choice;
    transform: none;
    display: flex;
    align-items: center;
    gap: 1rem;
    text-align: left;
    background: linear-gradient(178deg, var(--ink-paper) 0%, var(--ink-paper-warm) 100%);
    color: var(--ink-black);
    border: none;
    border-radius: 1px;
    box-shadow:
        0 -5px 0 -1px var(--ink-lacquer),
        0 -8px 0 -2px var(--ink-lacquer-lt),
        0 0.9rem 1.8rem -0.8rem rgba(10, 7, 3, 0.65);
    font-family: var(--ink-font-kai);
    padding: 0.85rem 1.4rem;
    transition: transform 0.24s ease, box-shadow 0.24s ease;
}
#gal-layer-choices[class*="skin-ancient"] .gal-choice-card::before {
    content: counter(ancient-choice, cjk-ideographic);
    display: grid;
    place-items: center;
    flex: none;
    width: 2rem;
    height: 2rem;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--ink-deep);
    border: 1.5px solid rgba(var(--ink-black-rgb), 0.5);
    border-radius: 50%;
    transition: all 0.24s ease;
}
#gal-layer-choices[class*="skin-ancient"] .gal-choice-card span { transform: none; }
#gal-layer-choices[class*="skin-ancient"] .gal-choice-card:hover {
    background: linear-gradient(178deg, var(--ink-paper) 0%, var(--ink-paper-warm) 100%);
    color: var(--ink-black);
    border-color: transparent;
    transform: translateY(-2px);
    box-shadow:
        0 -5px 0 -1px var(--ink-lacquer),
        0 -8px 0 -2px var(--ink-lacquer-lt),
        0 1.3rem 2.2rem -0.8rem rgba(10, 7, 3, 0.75);
}
#gal-layer-choices[class*="skin-ancient"] .gal-choice-card:hover::before {
    color: #f5e9d4;
    background: var(--ink-seal);
    border-color: var(--ink-seal);
    transform: rotate(-8deg);
}
#gal-layer-choices[class*="skin-ancient"] .gal-choices-hint {
    color: rgba(var(--ink-silk-rgb), 0.5);
    letter-spacing: 0.34em;
}

/* —— 剧情回顾：「千秋卷」册页（class 由 history.js 同步）—— */
.gal-history-modal[class*="skin-ancient"] { background: rgba(24, 20, 14, 0.58) !important; }
.gal-history-modal[class*="skin-ancient"] .gal-history-panel {
    background: linear-gradient(178deg, var(--ink-paper) 0%, var(--ink-paper-warm) 100%);
    border: none;
    border-radius: 2px;
    box-shadow:
        0 -6px 0 -1px var(--ink-lacquer),
        0 6px 0 -1px var(--ink-lacquer),
        0 2.5rem 4.5rem -1.6rem rgba(5, 3, 1, 0.85);
}
.gal-history-modal[class*="skin-ancient"] .gal-history-header {
    background: transparent;
    color: var(--ink-black);
    border-bottom: 1px solid rgba(var(--ink-black-rgb), 0.22);
}
.gal-history-modal[class*="skin-ancient"] .gal-history-title {
    font-family: var(--ink-font-kai);
    font-weight: 700;
    letter-spacing: 0.42em;
}
.gal-history-modal[class*="skin-ancient"] .gal-history-title i { color: var(--ink-seal); }
.gal-history-modal[class*="skin-ancient"] .gal-history-close { color: var(--ink-mid); }
.gal-history-modal[class*="skin-ancient"] .gal-history-close:hover { color: var(--ink-seal); }
.gal-history-modal[class*="skin-ancient"] .gal-history-body { background: transparent; }
.gal-history-modal[class*="skin-ancient"] .gal-history-item {
    background: transparent;
    border: none;
    border-bottom: 1px dashed rgba(var(--ink-black-rgb), 0.22);
    border-radius: 0;
    box-shadow: none;
}
.gal-history-modal[class*="skin-ancient"] .gal-history-item:hover {
    transform: none;
    box-shadow: none;
    border-color: transparent;
    border-bottom-color: var(--ink-seal);
}
.gal-history-modal[class*="skin-ancient"] .gal-history-header-row {
    background: transparent;
    border-bottom: none;
}
.gal-history-modal[class*="skin-ancient"] .gal-history-index {
    color: var(--ink-on-ink);
    background: var(--ink-black);
    border-left: none;
    padding: 0.05rem 0.7rem 0.1rem 0.55rem;
    font-family: var(--ink-font-brush);
    font-weight: 400;
    display: inline-block;
    clip-path: polygon(0% 40%, 4% 8%, 12% 0%, 90% 5%, 100% 36%, 96% 82%, 88% 100%, 8% 94%);
}
.gal-history-modal[class*="skin-ancient"] .gal-history-time { color: var(--ink-mid); }
.gal-history-modal[class*="skin-ancient"] .gal-history-content {
    color: var(--ink-black);
    line-height: 2;
    font-family: var(--ink-font-kai);
}
.gal-history-modal[class*="skin-ancient"] .gal-history-empty { color: var(--ink-mid); }

/* =========================================================
   2. HTML 模板皮肤 (HTML Skin)
   说明: 皮肤 CSS 由 html-skin-runtime 注入独立 <style> 标签，
   此处仅保留激活标识 class 的空钩子。
   ========================================================= */
#gal-global-overlay.html-skin {
}

/* =========================================================
   3. 心之怪盗 (Persona / Phantom Collage) — 剪纸拼贴
   设计语言: 剪纸拼贴 × 放射漩涡 × 网点纸 ×「没有一个元素是摆正的」
   对话框是剪出来的歪纸片, 名牌是甩上去的墨迹标签, 底栏是赎金信字条
   配色: 怪盗红 #e60023, 墨黑 #0d0c0e, 纸白 #f4f1ea
   变体: skin-persona-velvet（天鹅绒房间）仅覆写 CSS 变量
   ========================================================= */
#gal-global-overlay[class*="skin-persona"],
#gal-layer-choices[class*="skin-persona"],
.gal-history-modal[class*="skin-persona"] {
    --p5-red: #e60023;
    --p5-red-dk: #a80016;
    --p5-black: #0d0c0e;
    --p5-white: #f4f1ea;
    --p5-white-rgb: 244, 241, 234;
    --p5-gray: #97928a;
    --p5-font-impact: "Anton", "Archivo Black", "Impact", "Arial Black", "Noto Sans SC", sans-serif;
    --p5-font-cn: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
    --gal-quote-color: var(--p5-red);
}
#gal-global-overlay.skin-persona-velvet,
#gal-layer-choices.skin-persona-velvet,
.gal-history-modal.skin-persona-velvet {
    --p5-red: #2f47d0;
    --p5-red-dk: #1d2f96;
    --p5-black: #0a0c18;
    --p5-white: #eef0f8;
    --p5-white-rgb: 238, 240, 248;
    --p5-gray: #8b93b4;
    --gal-quote-color: #6b82f0;
}
#gal-global-overlay[class*="skin-persona"] { font-family: var(--p5-font-cn); }

/* —— 无背景图时的舞台：红黑放射漩涡 + 半调网点（有背景图/生成中时让位）—— */
#gal-global-overlay[class*="skin-persona"] .gal-layer-bg:not(.has-bg):not(.generating-bg) {
    background: var(--p5-black) !important;
    isolation: isolate;
}
#gal-global-overlay[class*="skin-persona"] .gal-layer-bg:not(.has-bg):not(.generating-bg)::after {
    content: "";
    position: absolute;
    inset: -42%;
    pointer-events: none;
    background: repeating-conic-gradient(from 0deg at 50% 58%,
        var(--p5-red) 0deg 9deg,
        var(--p5-red-dk) 9deg 11deg,
        var(--p5-red) 11deg 20deg,
        var(--p5-red-dk) 20deg 22deg);
    -webkit-mask: radial-gradient(70% 76% at 50% 58%, transparent 0%, rgba(0, 0, 0, 0.12) 40%, rgba(0, 0, 0, 0.65) 70%, #000 100%);
            mask: radial-gradient(70% 76% at 50% 58%, transparent 0%, rgba(0, 0, 0, 0.12) 40%, rgba(0, 0, 0, 0.65) 70%, #000 100%);
    animation: galPersonaVortexSpin 90s linear infinite;
}
@keyframes galPersonaVortexSpin { to { transform: rotate(360deg); } }
#gal-global-overlay[class*="skin-persona"] .gal-layer-bg:not(.has-bg):not(.generating-bg)::before {
    background-image: radial-gradient(rgba(var(--p5-white-rgb), 0.14) 1px, transparent 1.4px) !important;
    background-size: 9px 9px !important;
    opacity: 0.4 !important;
    -webkit-mask: linear-gradient(115deg, transparent 34%, #000 78%);
            mask: linear-gradient(115deg, transparent 34%, #000 78%);
    z-index: 1;
}

/* —— 背景生成中：黑幕 + 一道怪盗红扫描 —— */
#gal-global-overlay[class*="skin-persona"] .gal-layer-bg.generating-bg {
    background: linear-gradient(160deg, #16141a 0%, #0d0c0e 55%, #1a0d10 100%) !important;
}
#gal-global-overlay[class*="skin-persona"] .gal-layer-bg.generating-bg::after {
    background: linear-gradient(180deg,
        transparent 0%,
        rgba(230, 0, 35, 0.04) 42%,
        rgba(230, 0, 35, 0.28) 50%,
        rgba(230, 0, 35, 0.04) 58%,
        transparent 100%) !important;
    background-size: 100% 300% !important;
    background-repeat: no-repeat !important;
    opacity: 1 !important;
    animation: galPersonaScan 2.6s ease-in-out infinite;
}
@keyframes galPersonaScan {
    0% { background-position: 0 -120%; }
    100% { background-position: 0 220%; }
}

/* —— 对话正文：一张剪出来的白纸片（不规则 clip-path + 红黑双层硬影）—— */
#gal-global-overlay[class*="skin-persona"] .gal-text-panel {
    background: rgba(var(--p5-white-rgb), var(--panel-opacity, 0.96)) !important;
    background-image: none !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    clip-path: polygon(
        0.6% 3%, 0% 14%, 0.4% 96%, 2% 100%, 40% 99%, 43.5% 100%, 97% 99.2%,
        99.6% 90%, 99.2% 10%, 97% 0.6%, 55% 1.6%, 51% 0%, 4% 1.4%);
    transform: rotate(-0.45deg);
    filter:
        drop-shadow(6px 6px 0 var(--p5-red))
        drop-shadow(2px 2px 0 rgba(0, 0, 0, 0.9))
        drop-shadow(0 18px 26px rgba(0, 0, 0, 0.45)) !important;
}
/* 纸面右上角网点：印刷余味 */
#gal-global-overlay[class*="skin-persona"] .gal-text-panel::before {
    content: "";
    position: absolute;
    right: 0; top: 0;
    width: 36%; height: 100%;
    pointer-events: none;
    opacity: 0.3;
    background-image: radial-gradient(rgba(13, 12, 14, 0.22) 1px, transparent 1.4px);
    background-size: 7px 7px;
    -webkit-mask: linear-gradient(115deg, transparent 45%, #000 92%);
            mask: linear-gradient(115deg, transparent 45%, #000 92%);
}
#gal-global-overlay[class*="skin-persona"] .gal-dialog-text {
    color: var(--p5-black) !important;
    font-weight: 700 !important;
    letter-spacing: 0.05em !important;
    line-height: 1.95 !important;
    text-shadow: none !important;
}

/* —— 姓名牌：甩上去的墨迹标签 + 星形飞溅 ——
   双 :not() 抬特异性到 1id+4，压过顶部「全局皮肤重置」的 scale 规则 —— */
#gal-global-overlay[class*="skin-persona"]:not(.skin-default):not(.skin-default-dark):not(.skin-twilight) .gal-name-badge {
    background: var(--p5-black) !important;
    color: var(--p5-white) !important;
    border: none !important;
    border-radius: 0 !important;
    font-family: var(--p5-font-impact) !important;
    transform: rotate(-3.4deg) scale(var(--ui-scale)) !important;
    transform-origin: bottom left;
    left: 15px !important; top: -26px !important;
    padding: 0.5rem 1.6rem 0.5rem 1.3rem !important;
    clip-path: polygon(0% 22%, 5% 0%, 100% 8%, 96% 88%, 91% 100%, 3% 92%);
    box-shadow: none !important;
    filter: drop-shadow(4px 4px 0 var(--p5-red));
    z-index: 36;
}
#gal-global-overlay[class*="skin-persona"] .gal-name-badge span {
    transform: none !important;
    font-style: normal;
    letter-spacing: 0.18em;
    font-size: 1.25rem !important;
    text-shadow: none !important;
}
#gal-global-overlay[class*="skin-persona"] .gal-name-badge::before {
    content: "";
    position: absolute;
    right: -13px; top: -6px;
    width: 11px; height: 11px;
    background: var(--p5-red);
    clip-path: polygon(50% 0, 68% 34%, 100% 40%, 74% 62%, 84% 100%, 50% 76%, 16% 96%, 28% 60%, 0 38%, 34% 32%);
}
#gal-global-overlay[class*="skin-persona"] .gal-name-badge::after {
    content: "";
    position: absolute;
    left: -9px; bottom: -7px;
    width: 8px; height: 8px;
    background: var(--p5-white);
    clip-path: polygon(50% 0, 68% 34%, 100% 40%, 74% 62%, 84% 100%, 50% 76%, 16% 96%, 28% 60%, 0 38%, 34% 32%);
}
#gal-global-overlay[class*="skin-persona"] .gal-name-badge.gal-narrator-label {
    background: var(--p5-white) !important;
    color: var(--p5-black) !important;
    filter: drop-shadow(4px 4px 0 rgba(0, 0, 0, 0.85));
}
#gal-global-overlay[class*="skin-persona"] .gal-name-badge.gal-narrator-label::before { background: var(--p5-black); }

/* —— 对话框右上悬浮操作：剪贴字条按钮（角度互不相同，悬停回正）—— */
#gal-global-overlay[class*="skin-persona"] .gal-interaction-bar { right: 10px !important; }
#gal-global-overlay[class*="skin-persona"]:not(.skin-default):not(.skin-default-dark) .gal-action-btn {
    background: var(--p5-black) !important;
    color: var(--p5-white) !important;
    border: 2px solid var(--p5-white) !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    font-family: var(--p5-font-cn) !important;
    font-weight: 900 !important;
    letter-spacing: 0.14em !important;
    clip-path: polygon(4% 12%, 100% 0%, 97% 90%, 0% 100%) !important;
    transition: all 0.16s ease !important;
}
#gal-global-overlay[class*="skin-persona"] .gal-action-btn.btn-reroll { transform: skewX(-15deg) rotate(1.4deg) !important; }
#gal-global-overlay[class*="skin-persona"] .gal-action-btn.btn-free { transform: skewX(-15deg) rotate(-1.8deg) !important; }
#gal-global-overlay[class*="skin-persona"] .gal-action-btn:hover {
    background: var(--p5-red) !important;
    border-color: var(--p5-red) !important;
    color: #fff !important;
    transform: skewX(-15deg) rotate(0deg) scale(1.05) !important;
    box-shadow: none !important;
}

/* —— 底部工具栏：赎金信——每张字条角度都不同，悬停回正放大 —— */
#gal-global-overlay[class*="skin-persona"] .gal-footer-btn {
    background: rgba(13, 12, 14, 0.78) !important;
    color: var(--p5-white) !important;
    border: 1.5px solid rgba(var(--p5-white-rgb), 0.75) !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    font-family: var(--p5-font-cn) !important;
    font-weight: 900 !important;
    letter-spacing: 0.1em !important;
}
#gal-global-overlay[class*="skin-persona"] .gal-footer-btn i,
#gal-global-overlay[class*="skin-persona"] .gal-footer-btn span {
    transform: none !important;
}
#gal-global-overlay[class*="skin-persona"] .gal-footer-btn:nth-child(6n+1) { transform: rotate(-2.2deg) !important; }
#gal-global-overlay[class*="skin-persona"] .gal-footer-btn:nth-child(6n+2) { transform: rotate(1.6deg) translateY(1px) !important; }
#gal-global-overlay[class*="skin-persona"] .gal-footer-btn:nth-child(6n+3) { transform: rotate(-0.8deg) !important; }
#gal-global-overlay[class*="skin-persona"] .gal-footer-btn:nth-child(6n+4) { transform: rotate(2.4deg) translateY(-1px) !important; }
#gal-global-overlay[class*="skin-persona"] .gal-footer-btn:nth-child(6n+5) { transform: rotate(-1.4deg) !important; }
#gal-global-overlay[class*="skin-persona"] .gal-footer-btn:nth-child(6n+6) { transform: rotate(0.9deg) translateY(1px) !important; }
#gal-global-overlay[class*="skin-persona"] .gal-footer-btn:hover {
    background: var(--p5-white) !important;
    color: var(--p5-black) !important;
    border-color: var(--p5-black) !important;
    transform: rotate(0deg) scale(1.08) !important;
    box-shadow: none !important;
    z-index: 2;
}

/* —— NEXT：红色箭头纸片，悬停黑纸斜角盖上 —— */
#gal-global-overlay[class*="skin-persona"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn-next {
    background: var(--p5-red) !important;
    color: #fff !important;
    border: none !important;
    border-radius: 0 !important;
    font-family: var(--p5-font-impact) !important;
    font-weight: 400 !important;
    letter-spacing: 0.22em !important;
    clip-path: polygon(0% 18%, 3% 0%, 92% 4%, 100% 50%, 92% 96%, 2% 100%) !important;
    transform: rotate(-1deg) !important;
    box-shadow: none !important;
    position: relative !important;
    overflow: hidden !important;
    isolation: isolate;
    transition: transform 0.18s ease !important;
}
#gal-global-overlay[class*="skin-persona"] .gal-footer-btn-next::before {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--p5-black);
    transform: translateX(-104%) skewX(-14deg);
    transition: transform 0.26s cubic-bezier(0.7, 0, 0.2, 1);
    z-index: -1;
}
#gal-global-overlay[class*="skin-persona"] .gal-footer-btn-next:hover {
    background: var(--p5-red) !important;
    color: #fff !important;
    transform: rotate(0.6deg) scale(1.04) !important;
}
#gal-global-overlay[class*="skin-persona"] .gal-footer-btn-next:hover::before { transform: translateX(0) skewX(0); }

#gal-global-overlay[class*="skin-persona"] .gal-footer-btn:active,
#gal-global-overlay[class*="skin-persona"] .gal-action-btn:active,
#gal-global-overlay[class*="skin-persona"] .gal-footer-btn-next:active {
    transform: translate(2px, 2px) !important;
}

/* —— 待选项按钮：怪盗预告函（周期性抖动）—— */
#gal-global-overlay[class*="skin-persona"]:not(.skin-default):not(.skin-default-dark) .gal-pending-choices-btn {
    background: var(--p5-red) !important;
    color: #fff !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    font-family: var(--p5-font-cn) !important;
    font-weight: 900 !important;
    letter-spacing: 0.14em !important;
    clip-path: polygon(3% 16%, 0% 0%, 98% 5%, 100% 82%, 95% 100%, 5% 94%) !important;
    transform: rotate(-1.6deg) !important;
}
#gal-global-overlay[class*="skin-persona"] .gal-pending-choices-btn.show,
#gal-global-overlay[class*="skin-persona"] .gal-pending-choices-btn.gal-new-option-highlight {
    animation: galPersonaCardShake 2.6s ease-in-out infinite !important;
}
#gal-global-overlay[class*="skin-persona"] .gal-pending-choices-btn:hover {
    filter: brightness(1.15) !important;
    box-shadow: none !important;
}
@keyframes galPersonaCardShake {
    0%, 84%, 100% { transform: rotate(-1.6deg); }
    88% { transform: rotate(1.2deg); }
    92% { transform: rotate(-2.4deg); }
    96% { transform: rotate(0.8deg); }
}

/* —— 进度条：斜切红黑条纹 —— */
#gal-global-overlay[class*="skin-persona"] .gal-dialog-layer .gal-progress-container {
    background: rgba(var(--p5-white-rgb), 0.14) !important;
    transform: skewX(-30deg);
    height: 0.28rem !important;
}
#gal-global-overlay[class*="skin-persona"] .gal-progress-bar {
    background: repeating-linear-gradient(90deg, var(--p5-red) 0 14px, var(--p5-red-dk) 14px 18px) !important;
    box-shadow: none !important;
}

/* —— 顶部地点/时间：赎金信字条（黑纸条 + 白纸条）—— */
#gal-global-overlay[class*="skin-persona"] .gal-location-bar {
    background: var(--p5-black) !important;
    border: none !important;
    border-radius: 0 !important;
    color: var(--p5-white) !important;
    font-family: var(--p5-font-cn) !important;
    font-weight: 900 !important;
    letter-spacing: 0.26em !important;
    transform: rotate(-1.6deg);
    box-shadow: 3px 3px 0 var(--p5-red) !important;
    clip-path: polygon(0% 8%, 4% 0%, 97% 2%, 100% 86%, 96% 100%, 2% 97%);
    text-shadow: none;
}
#gal-global-overlay[class*="skin-persona"] .gal-time-bar {
    background: var(--p5-white) !important;
    border: none !important;
    border-radius: 0 !important;
    color: var(--p5-black) !important;
    font-family: var(--p5-font-impact) !important;
    letter-spacing: 0.28em !important;
    transform: rotate(1.1deg);
    box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.85) !important;
    clip-path: polygon(2% 0%, 100% 6%, 98% 94%, 0% 100%);
    text-shadow: none;
}
#gal-global-overlay[class*="skin-persona"] .gal-location-bar i { color: var(--p5-red) !important; }
#gal-global-overlay[class*="skin-persona"] .gal-time-bar i { color: var(--p5-red) !important; }
#gal-global-overlay[class*="skin-persona"] .gal-fullscreen-btn {
    background: rgba(13, 12, 14, 0.6) !important;
    border: 2px solid var(--p5-white) !important;
    border-radius: 0 !important;
    color: var(--p5-white) !important;
    font-weight: 900 !important;
    transform: rotate(3deg);
    clip-path: polygon(8% 2%, 98% 0%, 94% 92%, 2% 98%);
    transition: all 0.18s ease;
}
#gal-global-overlay[class*="skin-persona"] .gal-fullscreen-btn:hover {
    background: var(--p5-red) !important;
    border-color: var(--p5-red) !important;
    transform: rotate(-2deg) scale(1.06);
}

/* —— 立绘显隐 / 状态弹窗小按钮：黑色小方钮 —— */
#gal-global-overlay[class*="skin-persona"] .gal-sprite-toggle,
#gal-global-overlay[class*="skin-persona"] .gal-status-popup-trigger {
    background: var(--p5-black) !important;
    border: 1.5px solid rgba(var(--p5-white-rgb), 0.6) !important;
    border-radius: 0 !important;
    box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.5) !important;
}
#gal-global-overlay[class*="skin-persona"] .gal-sprite-toggle .gal-eye-icon,
#gal-global-overlay[class*="skin-persona"] .gal-status-popup-trigger .gal-status-popup-icon {
    color: var(--p5-red) !important;
}
#gal-global-overlay[class*="skin-persona"] .gal-sprite-toggle:hover,
#gal-global-overlay[class*="skin-persona"] .gal-status-popup-trigger:hover {
    background: var(--p5-red) !important;
    border-color: var(--p5-red) !important;
}
#gal-global-overlay[class*="skin-persona"] .gal-sprite-toggle:hover .gal-eye-icon,
#gal-global-overlay[class*="skin-persona"] .gal-status-popup-trigger:hover .gal-status-popup-icon {
    color: #fff !important;
}

/* —— 生成中指示器：「潜入中」黑卡 —— */
#gal-global-overlay[class*="skin-persona"] .gal-generating-indicator {
    background: var(--p5-black) !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: 8px 8px 0 var(--p5-red) !important;
    clip-path: polygon(1.5% 8%, 98% 1%, 99.5% 90%, 0.5% 97%);
    transform: translate(-50%, -50%) rotate(-1deg) !important;
}
#gal-global-overlay[class*="skin-persona"] .gal-generating-indicator .gal-gen-icon { color: var(--p5-red) !important; }
#gal-global-overlay[class*="skin-persona"] .gal-generating-indicator .gal-gen-text {
    color: var(--p5-white) !important;
    font-family: var(--p5-font-cn) !important;
    font-weight: 900 !important;
    letter-spacing: 0.5em !important;
    text-indent: 0.5em;
}
#gal-global-overlay[class*="skin-persona"] .gal-generating-indicator .gal-gen-status {
    color: var(--p5-gray) !important;
    font-family: var(--p5-font-impact) !important;
    letter-spacing: 0.2em;
}
#gal-global-overlay[class*="skin-persona"] .gal-generating-indicator .gal-gen-dot { background: var(--p5-red) !important; }

/* —— 选项浮层：预告函名刺拍在放射漩涡上（class 由 choices.js 同步）—— */
#gal-layer-choices[class*="skin-persona"] {
    background: radial-gradient(80% 80% at 50% 50%, rgba(13, 12, 14, 0.62) 0%, rgba(13, 12, 14, 0.94) 100%) !important;
    overflow: hidden;
}
#gal-layer-choices[class*="skin-persona"]::before {
    content: "";
    position: absolute;
    inset: -30%;
    pointer-events: none;
    background: repeating-conic-gradient(from 8deg at 50% 50%,
        rgba(230, 0, 35, 0.16) 0deg 5deg, transparent 5deg 12deg);
    animation: galPersonaVortexSpin 50s linear infinite reverse;
}
#gal-layer-choices.skin-persona-velvet::before {
    background: repeating-conic-gradient(from 8deg at 50% 50%,
        rgba(47, 71, 208, 0.18) 0deg 5deg, transparent 5deg 12deg);
}
#gal-layer-choices[class*="skin-persona"] .gal-choices-title {
    position: relative;
    transform: rotate(-2deg);
    font-family: var(--p5-font-impact);
    font-weight: 400;
    color: #fff;
    background: var(--p5-red);
    letter-spacing: 0.4em;
    text-indent: 0.4em;
    padding: 0.4rem 1.4rem;
    clip-path: polygon(2% 20%, 0% 0%, 100% 6%, 97% 88%, 99% 100%, 3% 95%);
}
#gal-layer-choices[class*="skin-persona"] .gal-choices-title span { transform: none; }
#gal-layer-choices[class*="skin-persona"] .gal-choices-container { counter-reset: persona-choice; }
#gal-layer-choices[class*="skin-persona"] .gal-choice-card {
    counter-increment: persona-choice;
    position: relative;
    display: flex;
    align-items: center;
    gap: 1rem;
    text-align: left;
    background: var(--p5-white);
    color: var(--p5-black);
    border: none;
    box-shadow: none;
    border-radius: 0;
    font-family: var(--p5-font-cn);
    font-weight: 900;
    padding: 0.9rem 1.4rem;
    clip-path: polygon(1% 18%, 2.5% 2%, 98% 0%, 99.5% 80%, 97% 100%, 2% 96%);
    filter: drop-shadow(5px 5px 0 var(--p5-red)) drop-shadow(0 12px 16px rgba(0, 0, 0, 0.5));
    transition: transform 0.18s ease, filter 0.18s ease;
}
#gal-layer-choices[class*="skin-persona"] .gal-choice-card:nth-child(odd) { transform: rotate(-1.1deg); }
#gal-layer-choices[class*="skin-persona"] .gal-choice-card:nth-child(even) { transform: rotate(0.9deg); }
#gal-layer-choices[class*="skin-persona"] .gal-choice-card::before {
    content: counter(persona-choice);
    display: grid;
    place-items: center;
    flex: none;
    width: 2.1rem;
    height: 2.1rem;
    font-family: var(--p5-font-impact);
    font-size: 1rem;
    color: #fff;
    background: var(--p5-black);
    clip-path: polygon(50% 0, 100% 25%, 88% 100%, 8% 92%, 0 30%);
    transform: rotate(-4deg);
    transition: all 0.18s ease;
}
#gal-layer-choices[class*="skin-persona"] .gal-choice-card span { transform: none; display: inline; }
#gal-layer-choices[class*="skin-persona"] .gal-choice-card:hover {
    background: var(--p5-white);
    color: var(--p5-black);
    border-color: transparent;
    transform: rotate(0deg) scale(1.03);
    box-shadow: none;
    filter: drop-shadow(7px 7px 0 var(--p5-black)) drop-shadow(0 16px 20px rgba(0, 0, 0, 0.6));
}
#gal-layer-choices[class*="skin-persona"] .gal-choice-card:hover::before {
    background: var(--p5-red);
    transform: rotate(4deg);
}
#gal-layer-choices[class*="skin-persona"] .gal-choices-hint {
    position: relative;
    color: rgba(var(--p5-white-rgb), 0.55);
    letter-spacing: 0.32em;
}

/* —— 剧情回顾：「怪盗通信」档案（class 由 history.js 同步）—— */
.gal-history-modal[class*="skin-persona"] { background: rgba(8, 7, 10, 0.74) !important; }
.gal-history-modal[class*="skin-persona"] .gal-history-panel {
    background: var(--p5-black);
    border: none;
    border-radius: 0;
    clip-path: polygon(0.6% 3%, 99% 0.5%, 99.6% 97%, 1.2% 99.4%);
    box-shadow: 10px 10px 0 var(--p5-red);
    transform: rotate(-0.4deg);
}
.gal-history-modal[class*="skin-persona"] .gal-history-header {
    background: transparent;
    color: var(--p5-white);
    border-bottom: 2px solid var(--p5-red);
}
.gal-history-modal[class*="skin-persona"] .gal-history-title {
    font-family: var(--p5-font-cn);
    font-weight: 900;
    letter-spacing: 0.36em;
}
.gal-history-modal[class*="skin-persona"] .gal-history-title i { color: var(--p5-red); }
.gal-history-modal[class*="skin-persona"] .gal-history-close { color: var(--p5-gray); }
.gal-history-modal[class*="skin-persona"] .gal-history-close:hover { color: var(--p5-red); }
.gal-history-modal[class*="skin-persona"] .gal-history-body { background: transparent; }
.gal-history-modal[class*="skin-persona"] .gal-history-item {
    background: transparent;
    border: none;
    border-bottom: 1px dashed rgba(var(--p5-white-rgb), 0.22);
    border-radius: 0;
    box-shadow: none;
}
.gal-history-modal[class*="skin-persona"] .gal-history-item:hover {
    transform: none;
    box-shadow: none;
    border-color: transparent;
    border-bottom-color: var(--p5-red);
}
.gal-history-modal[class*="skin-persona"] .gal-history-header-row {
    background: transparent;
    border-bottom: none;
}
.gal-history-modal[class*="skin-persona"] .gal-history-index {
    color: #fff;
    background: var(--p5-red);
    border-left: none;
    padding: 0.1rem 0.6rem;
    font-family: var(--p5-font-cn);
    font-weight: 900;
    transform: rotate(-1.4deg);
    display: inline-block;
    clip-path: polygon(0% 14%, 3% 0%, 100% 6%, 97% 90%, 100% 100%, 2% 94%);
}
.gal-history-modal[class*="skin-persona"] .gal-history-time { color: var(--p5-gray); }
.gal-history-modal[class*="skin-persona"] .gal-history-content {
    color: rgba(var(--p5-white-rgb), 0.9);
    line-height: 1.9;
    font-family: var(--p5-font-cn);
}
.gal-history-modal[class*="skin-persona"] .gal-history-empty { color: var(--p5-gray); }

/* =========================================================
   4. 苍穹之庭 (JRPG) — 星降之夜 Celestial Court Ⅱ
   demo 1:1 移植（doc/皮肤翻新提案-苍穹之庭.html）
   装饰 DOM 由 skin-jrpg-runtime.js 注入（cts-* 节点），
   本段 CSS 与 demo 同源，仅重命名类前缀与挂载选择器。
   变体: skin-jrpg-dawn（昼之庭·黎明）仅覆写 CSS 变量
   ========================================================= */
@property --gal-cts-spin { syntax: '<angle>'; inherits: false; initial-value: 0deg; }

#gal-global-overlay[class*="skin-jrpg"],
#gal-layer-choices[class*="skin-jrpg"],
.gal-history-modal[class*="skin-jrpg"] {
    --cts-void:    #030512;
    --cts-night:   #070C24;
    --cts-zenith:  #14235f;
    --cts-crystal: #6FD4FF;
    --cts-ice:     #B8EDFF;
    --cts-gold:    #D9B45C;
    --cts-gold2:   #F6E3A6;
    --cts-white:   #F5F9FF;
    --cts-text:    #F5F9FF;
    --cts-dim:     rgba(216, 228, 250, 0.6);
    --cts-star-op: 1;
    --cts-neb-a:   rgba(64, 110, 220, 0.30);
    --cts-neb-b:   rgba(122, 79, 208, 0.20);
    --cts-ray:     rgba(140, 200, 255, 0.10);
    --cts-pt:      rgba(184, 237, 255, 0.85);
    --cts-fall:    rgba(150, 215, 255, 0.5);
    --cts-island:  #0b1738;
    --cts-cloud:   rgba(90, 130, 215, 0.16);
    --cts-moon-ink: #E9F2FF;
    --cts-moon-glow: rgba(200, 225, 255, 0.4);
    --cts-tick:    rgba(217, 180, 92, 0.6);
    --cts-font:    'Zen Old Mincho', 'Noto Serif SC', 'Source Han Serif SC', '思源宋体', serif;
    --cts-sky:
        radial-gradient(120% 90% at 74% -18%, #22398c 0%, rgba(34, 57, 140, 0) 50%),
        radial-gradient(80% 55% at 14% 106%, rgba(24, 90, 120, 0.5) 0%, rgba(24, 90, 120, 0) 60%),
        linear-gradient(172deg, #04061a 0%, #0a1134 42%, #122252 76%, #0e2a54 100%);
    --cts-aur-a: repeating-linear-gradient(90deg,
        rgba(64, 225, 190, 0) 0px, rgba(64, 225, 190, 0.20) 14px,
        rgba(80, 190, 255, 0.10) 32px, rgba(64, 225, 190, 0) 54px);
    --cts-aur-b: repeating-linear-gradient(90deg,
        rgba(110, 190, 255, 0) 0px, rgba(110, 190, 255, 0.16) 17px,
        rgba(64, 225, 190, 0.09) 36px, rgba(110, 190, 255, 0) 60px);
    --cts-aur-op-a: 0.75;
    --cts-aur-op-b: 0.45;
    --cts-rock: linear-gradient(180deg, #16295e 0%, var(--cts-island) 40%, #050a1e 100%);
    --cts-crystal-shard: linear-gradient(180deg, rgba(184, 237, 255, 0.9), rgba(111, 212, 255, 0.25));
    --cts-shard-glow: rgba(111, 212, 255, 0.7);
    --cts-frame: linear-gradient(120deg,
        #f6e3a6 0%, #d9b45c 12%, rgba(111, 212, 255, 0.65) 34%,
        rgba(111, 212, 255, 0.25) 52%, rgba(111, 212, 255, 0.6) 68%,
        #d9b45c 88%, #f6e3a6 100%);
    --cts-face:
        radial-gradient(140% 120% at 82% -20%, rgba(111, 212, 255, 0.14) 0%, transparent 46%),
        radial-gradient(120% 100% at 8% 120%, rgba(64, 110, 220, 0.18) 0%, transparent 44%),
        linear-gradient(165deg, rgba(14, 24, 62, calc(0.82 + var(--panel-opacity, 0.5) * 0.16)) 0%, rgba(5, 9, 26, calc(0.86 + var(--panel-opacity, 0.5) * 0.14)) 100%);
    --cts-cardface:
        radial-gradient(130% 110% at 50% -10%, rgba(111, 212, 255, 0.12) 0%, transparent 52%),
        linear-gradient(165deg, rgba(15, 26, 66, 0.94) 0%, rgba(5, 9, 26, 0.96) 100%);
    --cts-plate:
        radial-gradient(120% 160% at 8% 0%, rgba(111, 212, 255, 0.2) 0%, transparent 48%),
        linear-gradient(120deg, #17285f 0%, #0a1436 55%, #060d26 100%);
    --cts-badge-text: #F5F9FF;
    --cts-badge-shadow: 0 0 14px rgba(143, 227, 255, 0.55);
    --cts-btn-face: rgba(7, 14, 42, 0.92);
    --cts-next-face:
        radial-gradient(130% 130% at 50% -20%, rgba(111, 212, 255, 0.35) 0%, transparent 52%),
        linear-gradient(165deg, #1b2f6e 0%, #0a1436 60%, #071028 100%);
    --cts-next-text: #F5F9FF;
    --cts-dark-on-crystal: #071028;
    --cts-cut-panel: polygon(0 26px, 26px 0, calc(100% - 64px) 0, calc(100% - 50px) 14px,
        calc(100% - 14px) 14px, 100% 28px, 100% calc(100% - 26px),
        calc(100% - 26px) 100%, 64px 100%, 50px calc(100% - 14px),
        14px calc(100% - 14px), 0 calc(100% - 28px));
    --cts-cut-para: polygon(16px 0, 100% 0, calc(100% - 16px) 100%, 0 100%);
    --cts-cut-hex: polygon(14px 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 14px 100%, 0 50%);
    --cts-cut-card: polygon(22px 0, 100% 0, calc(100% - 22px) 100%, 0 100%);
}

/* —— 变体：昼之庭 · 黎明（仅覆写变量）—— */
#gal-global-overlay.skin-jrpg-dawn,
#gal-layer-choices.skin-jrpg-dawn,
.gal-history-modal.skin-jrpg-dawn {
    --cts-crystal: #2E7EC7;
    --cts-ice:     #5FA8DC;
    --cts-gold:    #B9862E;
    --cts-gold2:   #D9A94A;
    --cts-white:   #223252;
    --cts-text:    #26334f;
    --cts-dim:     rgba(52, 68, 102, 0.62);
    --cts-star-op: 0.14;
    --cts-neb-a:   rgba(255, 216, 150, 0.4);
    --cts-neb-b:   rgba(150, 196, 240, 0.35);
    --cts-ray:     rgba(255, 236, 190, 0.35);
    --cts-pt:      rgba(255, 224, 160, 0.9);
    --cts-fall:    rgba(255, 224, 160, 0.65);
    --cts-island:  #7590b4;
    --cts-cloud:   rgba(255, 244, 222, 0.55);
    --cts-moon-ink: #FFF8E6;
    --cts-moon-glow: rgba(255, 224, 150, 0.7);
    --cts-tick:    rgba(217, 169, 74, 0.75);
    --cts-sky:
        radial-gradient(110% 80% at 50% -12%, #3579bd 0%, rgba(53, 121, 189, 0) 60%),
        radial-gradient(160% 110% at 50% 122%, #ffce8c 0%, rgba(255, 206, 140, 0) 48%),
        linear-gradient(178deg, #5d9ad2 0%, #a7cbe9 52%, #f7dfae 100%);
    --cts-aur-a: repeating-linear-gradient(90deg,
        rgba(255, 214, 140, 0) 0px, rgba(255, 214, 140, 0.28) 14px,
        rgba(255, 236, 190, 0.14) 32px, rgba(255, 214, 140, 0) 54px);
    --cts-aur-b: repeating-linear-gradient(90deg,
        rgba(95, 168, 220, 0) 0px, rgba(95, 168, 220, 0.16) 17px,
        rgba(255, 224, 160, 0.12) 36px, rgba(95, 168, 220, 0) 60px);
    --cts-aur-op-a: 0.4;
    --cts-aur-op-b: 0.3;
    --cts-rock: linear-gradient(180deg, #9db4d2 0%, var(--cts-island) 40%, #5a7096 100%);
    --cts-crystal-shard: linear-gradient(180deg, rgba(255, 240, 205, 0.95), rgba(255, 214, 140, 0.4));
    --cts-shard-glow: rgba(255, 214, 140, 0.8);
    --cts-frame: linear-gradient(120deg,
        #d9a94a 0%, #b9862e 14%, rgba(95, 168, 220, 0.7) 36%,
        rgba(95, 168, 220, 0.3) 52%, rgba(95, 168, 220, 0.6) 68%,
        #b9862e 86%, #d9a94a 100%);
    --cts-face:
        radial-gradient(140% 120% at 82% -20%, rgba(95, 168, 220, 0.14) 0%, transparent 46%),
        linear-gradient(165deg, rgba(250, 252, 255, calc(0.84 + var(--panel-opacity, 0.5) * 0.14)) 0%, rgba(228, 240, 250, calc(0.86 + var(--panel-opacity, 0.5) * 0.12)) 100%);
    --cts-cardface:
        radial-gradient(130% 110% at 50% -10%, rgba(95, 168, 220, 0.14) 0%, transparent 52%),
        linear-gradient(165deg, rgba(250, 252, 255, 0.97) 0%, rgba(226, 238, 250, 0.97) 100%);
    --cts-plate:
        radial-gradient(120% 160% at 8% 0%, rgba(95, 168, 220, 0.2) 0%, transparent 48%),
        linear-gradient(120deg, #fbfdff 0%, #e2eefa 60%, #d4e4f4 100%);
    --cts-badge-text: #223252;
    --cts-badge-shadow: none;
    --cts-btn-face: rgba(250, 252, 255, 0.94);
    --cts-next-face:
        radial-gradient(130% 130% at 50% -20%, rgba(255, 244, 215, 0.7) 0%, transparent 55%),
        linear-gradient(165deg, #f2f8ff 0%, #dcebf8 100%);
    --cts-next-text: #223252;
}

#gal-global-overlay[class*="skin-jrpg"] { font-family: var(--cts-font); }

/* ============================================================
   夜穹场景（cts-scene，注入到 .gal-layer-bg 内；
   有背景图 / 生成中时整层隐藏，宿主点阵伪元素同时禁用）
   ============================================================ */
#gal-global-overlay[class*="skin-jrpg"] .gal-layer-bg::before { display: none !important; }
#gal-global-overlay[class*="skin-jrpg"] .gal-layer-bg.has-bg .cts-scene,
#gal-global-overlay[class*="skin-jrpg"] .gal-layer-bg.generating-bg .cts-scene { display: none; }
#gal-global-overlay[class*="skin-jrpg"] .cts-scene {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    z-index: 0;
}
#gal-global-overlay[class*="skin-jrpg"] .cts-sky {
    position: absolute;
    inset: 0;
    background: var(--cts-sky);
}
#gal-global-overlay[class*="skin-jrpg"] .cts-sky::after {
    content: "";
    position: absolute;
    left: -5%; right: -5%; bottom: 13%;
    height: 26%;
    background: radial-gradient(56% 92% at 50% 100%, rgba(64, 190, 230, 0.17), transparent 70%);
    filter: blur(12px);
}
.skin-jrpg-dawn .cts-sky::after {
    background: radial-gradient(56% 92% at 50% 100%, rgba(255, 224, 160, 0.3), transparent 70%);
}
#gal-global-overlay[class*="skin-jrpg"] .cts-nebula {
    position: absolute;
    border-radius: 50%;
    filter: blur(46px);
    mix-blend-mode: screen;
    animation: galCtsNebBreathe 18s ease-in-out infinite alternate;
}
.skin-jrpg-dawn .cts-nebula { mix-blend-mode: normal; opacity: 0.4; }
#gal-global-overlay[class*="skin-jrpg"] .cts-neb-a {
    left: 6%; top: 4%; width: 44%; height: 52%;
    background: radial-gradient(circle at 40% 40%, var(--cts-neb-a), transparent 66%);
}
#gal-global-overlay[class*="skin-jrpg"] .cts-neb-b {
    right: 2%; top: 18%; width: 38%; height: 56%;
    background: radial-gradient(circle at 55% 45%, var(--cts-neb-b), transparent 64%);
    animation-delay: -8s;
}
@keyframes galCtsNebBreathe {
    from { opacity: 0.7; transform: scale(1); }
    to   { opacity: 1; transform: scale(1.06); }
}
#gal-global-overlay[class*="skin-jrpg"] .cts-milkyway {
    position: absolute;
    left: -24%; top: -8%;
    width: 150%; height: 56%;
    transform: rotate(-14deg);
    opacity: calc(0.38 * var(--cts-star-op));
    background:
        radial-gradient(60% 30% at 50% 50%, rgba(184, 237, 255, 0.14), transparent 70%),
        radial-gradient(80% 20% at 42% 52%, rgba(245, 249, 255, 0.10), transparent 70%),
        radial-gradient(50% 16% at 62% 46%, rgba(122, 79, 208, 0.12), transparent 70%);
    filter: blur(10px);
}
#gal-global-overlay[class*="skin-jrpg"] .cts-aurora {
    position: absolute;
    mix-blend-mode: screen;
    filter: blur(7px);
    -webkit-mask: linear-gradient(180deg, transparent 0%, #000 16%, #000 52%, transparent 94%);
            mask: linear-gradient(180deg, transparent 0%, #000 16%, #000 52%, transparent 94%);
    animation: galCtsCurtain 18s linear infinite alternate;
}
.skin-jrpg-dawn .cts-aurora { mix-blend-mode: normal; }
#gal-global-overlay[class*="skin-jrpg"] .cts-aurora-a {
    left: 2%; top: -6%;
    width: 58%; height: 60%;
    transform: skewX(-17deg) rotate(-7deg);
    opacity: var(--cts-aur-op-a);
    background: var(--cts-aur-a);
}
#gal-global-overlay[class*="skin-jrpg"] .cts-aurora-b {
    right: 4%; top: -9%;
    width: 40%; height: 46%;
    transform: skewX(15deg) rotate(6deg);
    opacity: var(--cts-aur-op-b);
    animation-duration: 24s;
    animation-delay: -9s;
    background: var(--cts-aur-b);
}
@keyframes galCtsCurtain {
    from { background-position: 0 0; }
    to   { background-position: 120px 0; }
}
#gal-global-overlay[class*="skin-jrpg"] .cts-stars {
    position: absolute;
    inset: -5%;
    opacity: var(--cts-star-op);
}
#gal-global-overlay[class*="skin-jrpg"] .cts-stars-far {
    background-image:
        radial-gradient(1px 1px at 11% 16%, rgba(245, 249, 255, 0.9), transparent 100%),
        radial-gradient(1px 1px at 27% 7%, rgba(184, 237, 255, 0.75), transparent 100%),
        radial-gradient(1px 1px at 41% 21%, rgba(245, 249, 255, 0.6), transparent 100%),
        radial-gradient(1px 1px at 55% 12%, rgba(245, 249, 255, 0.8), transparent 100%),
        radial-gradient(1px 1px at 67% 26%, rgba(184, 237, 255, 0.6), transparent 100%),
        radial-gradient(1px 1px at 78% 9%, rgba(245, 249, 255, 0.85), transparent 100%),
        radial-gradient(1px 1px at 90% 22%, rgba(184, 237, 255, 0.7), transparent 100%),
        radial-gradient(1px 1px at 17% 38%, rgba(245, 249, 255, 0.55), transparent 100%),
        radial-gradient(1px 1px at 48% 41%, rgba(245, 249, 255, 0.6), transparent 100%),
        radial-gradient(1px 1px at 84% 44%, rgba(184, 237, 255, 0.55), transparent 100%);
    animation: galCtsTwinkle 6s ease-in-out infinite alternate;
}
#gal-global-overlay[class*="skin-jrpg"] .cts-stars-near {
    background-image:
        radial-gradient(1.7px 1.7px at 15% 24%, rgba(245, 249, 255, 1), transparent 100%),
        radial-gradient(1.7px 1.7px at 33% 11%, rgba(246, 227, 166, 0.95), transparent 100%),
        radial-gradient(1.8px 1.8px at 52% 6%, rgba(245, 249, 255, 0.95), transparent 100%),
        radial-gradient(1.9px 1.9px at 72% 18%, rgba(184, 237, 255, 0.95), transparent 100%),
        radial-gradient(1.7px 1.7px at 88% 34%, rgba(246, 227, 166, 0.85), transparent 100%),
        radial-gradient(1.7px 1.7px at 7% 47%, rgba(245, 249, 255, 0.8), transparent 100%),
        radial-gradient(1.7px 1.7px at 44% 33%, rgba(184, 237, 255, 0.8), transparent 100%);
    animation: galCtsTwinkle 4.2s ease-in-out infinite alternate-reverse;
}
@keyframes galCtsTwinkle {
    from { opacity: calc(0.5 * var(--cts-star-op)); }
    to   { opacity: var(--cts-star-op); }
}
#gal-global-overlay[class*="skin-jrpg"] .cts-flare {
    position: absolute;
    width: 4px; height: 4px;
    border-radius: 50%;
    background: #EAF6FF;
    box-shadow: 0 0 6px 1px rgba(214, 238, 255, 0.9), 0 0 20px 4px rgba(140, 200, 255, 0.35);
    opacity: var(--cts-star-op);
    animation: galCtsFlare 5s ease-in-out infinite alternate;
}
#gal-global-overlay[class*="skin-jrpg"] .cts-flare::before,
#gal-global-overlay[class*="skin-jrpg"] .cts-flare::after {
    content: "";
    position: absolute;
    left: 50%; top: 50%;
    transform: translate(-50%, -50%);
    width: 56px; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(214, 238, 255, 0.85), transparent);
}
#gal-global-overlay[class*="skin-jrpg"] .cts-flare::after {
    width: 1px; height: 34px;
    background: linear-gradient(180deg, transparent, rgba(214, 238, 255, 0.7), transparent);
}
#gal-global-overlay[class*="skin-jrpg"] .cts-f1 { left: 20%; top: 19%; }
#gal-global-overlay[class*="skin-jrpg"] .cts-f2 { right: 30%; top: 30%; scale: 0.6; animation-delay: -2s; }
#gal-global-overlay[class*="skin-jrpg"] .cts-f3 { left: 38%; top: 9%; scale: 0.45; animation-delay: -3.5s; }
@keyframes galCtsFlare {
    from { opacity: calc(0.45 * var(--cts-star-op)); }
    to   { opacity: var(--cts-star-op); }
}
#gal-global-overlay[class*="skin-jrpg"] .cts-shooting-star {
    position: absolute;
    width: 150px; height: 1.5px;
    background: linear-gradient(90deg, rgba(245, 249, 255, 0), rgba(245, 249, 255, 0.9) 82%, #fff);
    border-radius: 2px;
    opacity: 0;
    filter: drop-shadow(0 0 4px rgba(184, 237, 255, 0.9));
    transform: rotate(-28deg);
}
#gal-global-overlay[class*="skin-jrpg"] .cts-ss1 { left: 14%; top: 16%; animation: galCtsShoot 9s ease-in 2.4s infinite; }
#gal-global-overlay[class*="skin-jrpg"] .cts-ss2 { left: 56%; top: 7%; width: 110px; animation: galCtsShoot 13s ease-in 7s infinite; }
@keyframes galCtsShoot {
    0%   { opacity: 0; transform: rotate(-28deg) translateX(0); }
    1.5% { opacity: var(--cts-star-op); }
    7%   { opacity: 0; transform: rotate(-28deg) translateX(46vw); }
    100% { opacity: 0; transform: rotate(-28deg) translateX(46vw); }
}
#gal-global-overlay[class*="skin-jrpg"] .cts-gate {
    position: absolute;
    right: 9%; top: 11%;
    width: 140px; height: 140px;
}
#gal-global-overlay[class*="skin-jrpg"] .cts-ring-ticks {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: repeating-conic-gradient(from 0deg, var(--cts-tick) 0deg 0.6deg, transparent 0.6deg 9deg);
    -webkit-mask: radial-gradient(circle, transparent 68%, #000 69%, #000 71.5%, transparent 72.5%);
            mask: radial-gradient(circle, transparent 68%, #000 69%, #000 71.5%, transparent 72.5%);
    opacity: 0.55;
    animation: galCtsSpin 90s linear infinite;
}
@keyframes galCtsSpin { to { transform: rotate(360deg); } }
#gal-global-overlay[class*="skin-jrpg"] .cts-ring-line {
    position: absolute;
    inset: 12px;
    border-radius: 50%;
    border: 1px solid rgba(246, 227, 166, 0.28);
}
#gal-global-overlay[class*="skin-jrpg"] .cts-ring-line::before {
    content: "";
    position: absolute;
    inset: 16px;
    border-radius: 50%;
    border: 1px dashed rgba(184, 237, 255, 0.18);
}
#gal-global-overlay[class*="skin-jrpg"] .cts-moon {
    position: absolute;
    inset: 36px;
    border-radius: 50%;
    background: transparent;
    box-shadow: inset 11px -7px 0 0 var(--cts-moon-ink);
    transform: rotate(-16deg);
    filter: drop-shadow(0 0 10px var(--cts-moon-glow));
}
#gal-global-overlay[class*="skin-jrpg"] .cts-orbit {
    position: absolute;
    inset: -4px;
    animation: galCtsSpin 16s linear infinite;
}
#gal-global-overlay[class*="skin-jrpg"] .cts-orbit i {
    position: absolute;
    left: 50%; top: -2.5px;
    width: 6px; height: 6px;
    transform: translateX(-50%) rotate(45deg);
    background: linear-gradient(135deg, var(--cts-ice), var(--cts-crystal));
    box-shadow: 0 0 8px rgba(111, 212, 255, 0.9);
}
#gal-global-overlay[class*="skin-jrpg"] .cts-godray {
    position: absolute;
    top: -12%;
    height: 110%;
    mix-blend-mode: screen;
    filter: blur(10px);
    background: linear-gradient(180deg, var(--cts-ray) 0%, transparent 66%);
    animation: galCtsRay 12s ease-in-out infinite alternate;
}
.skin-jrpg-dawn .cts-godray { mix-blend-mode: normal; }
#gal-global-overlay[class*="skin-jrpg"] .cts-ray-1 { left: 16%; width: 6%; transform: skewX(-14deg); }
#gal-global-overlay[class*="skin-jrpg"] .cts-ray-2 { left: 24%; width: 3%; transform: skewX(-14deg); animation-delay: -5s; }
@keyframes galCtsRay {
    from { opacity: 0.15; }
    to   { opacity: 0.5; }
}
#gal-global-overlay[class*="skin-jrpg"] .cts-isle {
    position: absolute;
    animation: galCtsBob 13s ease-in-out infinite alternate;
}
#gal-global-overlay[class*="skin-jrpg"] .cts-rock {
    width: 100%; height: 100%;
    background: var(--cts-rock);
    clip-path: polygon(0% 28%, 9% 20%, 21% 24%, 34% 12%, 47% 19%, 61% 8%, 75% 17%, 89% 13%, 100% 26%,
        91% 36%, 83% 58%, 71% 74%, 57% 95%, 49% 100%, 43% 86%, 33% 70%, 21% 54%, 9% 42%);
}
#gal-global-overlay[class*="skin-jrpg"] .cts-crystals {
    position: absolute;
    left: 30%; bottom: 26%;
    width: 40%; height: 30%;
}
#gal-global-overlay[class*="skin-jrpg"] .cts-crystals i {
    position: absolute;
    bottom: 0;
    width: 22%; height: 80%;
    background: var(--cts-crystal-shard);
    clip-path: polygon(50% 0, 100% 78%, 78% 100%, 22% 100%, 0 78%);
    filter: drop-shadow(0 0 8px var(--cts-shard-glow));
    animation: galCtsCrystalGlow 4s ease-in-out infinite alternate;
}
#gal-global-overlay[class*="skin-jrpg"] .cts-crystals i:nth-child(1) { left: 0; height: 58%; transform: rotate(-14deg); animation-delay: -1s; }
#gal-global-overlay[class*="skin-jrpg"] .cts-crystals i:nth-child(2) { left: 34%; }
#gal-global-overlay[class*="skin-jrpg"] .cts-crystals i:nth-child(3) { left: 70%; height: 52%; transform: rotate(12deg); animation-delay: -2.4s; }
@keyframes galCtsCrystalGlow {
    from { opacity: 0.55; }
    to   { opacity: 1; }
}
#gal-global-overlay[class*="skin-jrpg"] .cts-lightfall {
    position: absolute;
    left: 46%; top: 92%;
    width: 2px; height: 90%;
    background: linear-gradient(180deg, var(--cts-fall), transparent 86%);
    filter: blur(1px);
    animation: galCtsFallShimmer 5s ease-in-out infinite alternate;
}
#gal-global-overlay[class*="skin-jrpg"] .cts-lightfall.cts-lf2 { left: 58%; top: 88%; height: 66%; animation-delay: -2s; opacity: 0.7; }
@keyframes galCtsFallShimmer {
    from { opacity: 0.35; }
    to   { opacity: 0.95; }
}
#gal-global-overlay[class*="skin-jrpg"] .cts-isle-l { left: 2.5%; bottom: 17%; width: 26%; height: 30%; }
#gal-global-overlay[class*="skin-jrpg"] .cts-isle-r { right: 5%; bottom: 24%; width: 14%; height: 17%; animation-delay: -6s; opacity: 0.85; }
#gal-global-overlay[class*="skin-jrpg"] .cts-isle-far { left: 47%; bottom: 33%; width: 7%; height: 8%; animation-delay: -9s; opacity: 0.4; filter: blur(1.2px); }
@keyframes galCtsBob {
    from { transform: translateY(0); }
    to   { transform: translateY(-1.8%); }
}
#gal-global-overlay[class*="skin-jrpg"] .cts-cloudsea {
    position: absolute;
    left: -12%; right: -12%;
    filter: blur(16px);
    background: linear-gradient(180deg, transparent 0%, var(--cts-cloud) 40%, var(--cts-cloud) 66%, transparent 100%);
    animation: galCtsCloudDrift 38s ease-in-out infinite alternate;
}
#gal-global-overlay[class*="skin-jrpg"] .cts-cloud-a { bottom: 9%; height: 24%; }
#gal-global-overlay[class*="skin-jrpg"] .cts-cloud-b { bottom: -2%; height: 20%; animation-duration: 50s; animation-delay: -20s; opacity: 0.85; }
@keyframes galCtsCloudDrift {
    from { transform: translateX(-2.5%); }
    to   { transform: translateX(2.5%); }
}
#gal-global-overlay[class*="skin-jrpg"] .cts-particles { position: absolute; inset: 0; }
#gal-global-overlay[class*="skin-jrpg"] .cts-particles i {
    position: absolute;
    bottom: 6%;
    width: 3px; height: 3px;
    border-radius: 50%;
    background: var(--cts-pt);
    filter: blur(0.4px);
    opacity: 0;
    animation: galCtsRise 11s linear infinite;
}
#gal-global-overlay[class*="skin-jrpg"] .cts-particles i:nth-child(1) { left: 8%; animation-delay: 0s; scale: 0.8; }
#gal-global-overlay[class*="skin-jrpg"] .cts-particles i:nth-child(2) { left: 19%; animation-delay: -3.2s; scale: 0.55; }
#gal-global-overlay[class*="skin-jrpg"] .cts-particles i:nth-child(3) { left: 31%; animation-delay: -7s; scale: 1; }
#gal-global-overlay[class*="skin-jrpg"] .cts-particles i:nth-child(4) { left: 43%; animation-delay: -1.6s; scale: 0.6; }
#gal-global-overlay[class*="skin-jrpg"] .cts-particles i:nth-child(5) { left: 56%; animation-delay: -8.6s; scale: 0.85; }
#gal-global-overlay[class*="skin-jrpg"] .cts-particles i:nth-child(6) { left: 66%; animation-delay: -5s; scale: 0.5; }
#gal-global-overlay[class*="skin-jrpg"] .cts-particles i:nth-child(7) { left: 77%; animation-delay: -9.8s; scale: 0.95; }
#gal-global-overlay[class*="skin-jrpg"] .cts-particles i:nth-child(8) { left: 88%; animation-delay: -2.4s; scale: 0.65; }
#gal-global-overlay[class*="skin-jrpg"] .cts-particles i:nth-child(9) { left: 95%; animation-delay: -6.2s; scale: 0.8; }
@keyframes galCtsRise {
    0%   { transform: translateY(0); opacity: 0; }
    8%   { opacity: calc(0.9 * var(--cts-star-op)); }
    85%  { opacity: calc(0.25 * var(--cts-star-op)); }
    100% { transform: translateY(-58vh); opacity: 0; }
}
#gal-global-overlay[class*="skin-jrpg"] .gal-layer-bg.generating-bg {
    background: linear-gradient(172deg, #04061a 0%, #0a1134 55%, #0e2a54 100%) !important;
}
#gal-global-overlay[class*="skin-jrpg"] .gal-layer-bg.generating-bg::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg,
        transparent 0%,
        rgba(111, 212, 255, 0.04) 42%,
        rgba(111, 212, 255, 0.24) 50%,
        rgba(111, 212, 255, 0.04) 58%,
        transparent 100%) !important;
    background-size: 100% 300% !important;
    background-repeat: no-repeat !important;
    animation: galCtsScan 2.6s ease-in-out infinite;
}
@keyframes galCtsScan {
    0%   { background-position: 0 -120%; }
    100% { background-position: 0 220%; }
}

/* ============================================================
   顶部状态栏 & 全屏按钮
   ============================================================ */
#gal-global-overlay[class*="skin-jrpg"] .gal-location-bar,
#gal-global-overlay[class*="skin-jrpg"] .gal-time-bar {
    background: rgba(7, 12, 36, 0.55) !important;
    border: 1px solid rgba(184, 237, 255, 0.28) !important;
    border-radius: 0 !important;
    clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
    color: var(--cts-white) !important;
    font-family: var(--cts-font) !important;
    letter-spacing: 0.14em;
    backdrop-filter: blur(3px);
}
.skin-jrpg-dawn .gal-location-bar,
.skin-jrpg-dawn .gal-time-bar {
    background: rgba(250, 252, 255, 0.6) !important;
    border-color: rgba(46, 126, 199, 0.3) !important;
}
#gal-global-overlay[class*="skin-jrpg"] .gal-location-bar i,
#gal-global-overlay[class*="skin-jrpg"] .gal-time-bar i { color: var(--cts-gold2) !important; }
#gal-global-overlay[class*="skin-jrpg"] .gal-fullscreen-btn {
    background: rgba(7, 12, 36, 0.55) !important;
    color: var(--cts-dim) !important;
    border: 1px solid rgba(184, 237, 255, 0.28) !important;
    border-radius: 0 !important;
}
#gal-global-overlay[class*="skin-jrpg"] .gal-fullscreen-btn:hover {
    background: var(--cts-gold2) !important;
    color: #071028 !important;
    border-color: var(--cts-gold2) !important;
}
.skin-jrpg-dawn .gal-fullscreen-btn { background: rgba(250, 252, 255, 0.6) !important; }

/* ============================================================
   对话框：demo 双层结构 1:1 —— 面板本体透明，
   .cts-panel-shape（金晶框 + 玻璃面）承担全部视觉
   ============================================================ */
#gal-global-overlay[class*="skin-jrpg"] .gal-dialog-layer { bottom: 2rem !important; }
#gal-global-overlay[class*="skin-jrpg"] .cts-watermark {
    position: absolute;
    right: -110px; bottom: -130px;
    width: 380px; height: 380px;
    pointer-events: none;
    opacity: 0.13;
    z-index: 0;
}
.skin-jrpg-dawn .cts-watermark { opacity: 0.2; }
#gal-global-overlay[class*="skin-jrpg"] .cts-w1 {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 1px solid var(--cts-ice);
    background: repeating-conic-gradient(from 0deg, rgba(184, 237, 255, 0.9) 0deg 1deg, transparent 1deg 8deg);
    -webkit-mask: radial-gradient(circle, transparent 74%, #000 75%, #000 82%, transparent 83%);
            mask: radial-gradient(circle, transparent 74%, #000 75%, #000 82%, transparent 83%);
    animation: galCtsSpin 60s linear infinite;
}
#gal-global-overlay[class*="skin-jrpg"] .cts-w2 {
    position: absolute;
    inset: 44px;
    border-radius: 50%;
    border: 1px dashed var(--cts-gold2);
    animation: galCtsSpinReverse 40s linear infinite;
}
@keyframes galCtsSpinReverse { to { transform: rotate(-360deg); } }

#gal-global-overlay[class*="skin-jrpg"] .gal-text-panel {
    background: transparent !important;
    background-image: none !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    overflow: visible !important;
    position: relative;
    filter: drop-shadow(0 20px 38px rgba(1, 3, 10, 0.7));
}
#gal-global-overlay[class*="skin-jrpg"] .cts-panel-shape {
    position: absolute;
    inset: 0;
    z-index: 0;
    clip-path: var(--cts-cut-panel);
    background: var(--cts-frame);
}
#gal-global-overlay[class*="skin-jrpg"] .cts-panel-shape::before {
    content: "";
    position: absolute;
    inset: 1.5px;
    clip-path: var(--cts-cut-panel);
    background: var(--cts-face);
    backdrop-filter: blur(16px) saturate(160%);
    -webkit-backdrop-filter: blur(16px) saturate(160%);
}
#gal-global-overlay[class*="skin-jrpg"] .cts-panel-shape::after {
    content: "";
    position: absolute;
    left: 10%; right: 22%; top: 1.5px;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--cts-gold2) 40%, rgba(184, 237, 255, 0.9) 70%, transparent);
    box-shadow: 0 0 12px rgba(246, 227, 166, 0.85);
}
#gal-global-overlay[class*="skin-jrpg"] .cts-panel-line {
    position: absolute;
    inset: 7px;
    z-index: 0;
    pointer-events: none;
    clip-path: var(--cts-cut-panel);
    background: linear-gradient(120deg, rgba(246, 227, 166, 0.4), rgba(111, 212, 255, 0.28) 50%, rgba(246, 227, 166, 0.35));
}
#gal-global-overlay[class*="skin-jrpg"] .cts-panel-line > i {
    position: absolute;
    inset: 1px;
    clip-path: var(--cts-cut-panel);
    background: var(--cts-face);
}
#gal-global-overlay[class*="skin-jrpg"] .cts-flourish {
    position: absolute;
    z-index: 2;
    pointer-events: none;
    width: 58px; height: 58px;
    filter: drop-shadow(0 0 5px rgba(217, 180, 92, 0.55));
}
#gal-global-overlay[class*="skin-jrpg"] .cts-flourish.cts-tl { left: -3px; top: -3px; }
#gal-global-overlay[class*="skin-jrpg"] .cts-flourish.cts-br { right: -3px; bottom: -3px; transform: rotate(180deg); }
#gal-global-overlay[class*="skin-jrpg"] .cts-flourish::before {
    content: "";
    position: absolute;
    left: 0; top: 0;
    width: 100%; height: 100%;
    border-left: 2.5px solid var(--cts-gold);
    border-top: 2.5px solid var(--cts-gold);
    clip-path: polygon(0 0, 100% 0, 100% 6px, 26px 6px, 6px 26px, 6px 100%, 0 100%);
}
#gal-global-overlay[class*="skin-jrpg"] .cts-flourish::after {
    content: "";
    position: absolute;
    left: 8px; top: 8px;
    width: 70%; height: 70%;
    border-left: 1px solid rgba(246, 227, 166, 0.7);
    border-top: 1px solid rgba(246, 227, 166, 0.7);
    clip-path: polygon(0 0, 100% 0, 100% 3px, 18px 3px, 3px 18px, 3px 100%, 0 100%);
}
#gal-global-overlay[class*="skin-jrpg"] .cts-flourish i {
    position: absolute;
    left: 11px; top: 11px;
    width: 7px; height: 7px;
    transform: rotate(45deg);
    background: var(--cts-gold);
    box-shadow: 0 0 8px rgba(217, 180, 92, 0.9);
}
#gal-global-overlay[class*="skin-jrpg"] .cts-rivet {
    position: absolute;
    z-index: 2;
    width: 8px; height: 8px;
    transform: rotate(45deg);
    background: linear-gradient(135deg, var(--cts-ice), var(--cts-crystal));
    animation: galCtsGem 3s ease-in-out infinite;
}
#gal-global-overlay[class*="skin-jrpg"] .cts-rivet.cts-r1 { right: 52px; top: 9px; }
#gal-global-overlay[class*="skin-jrpg"] .cts-rivet.cts-r2 { left: 52px; bottom: 9px; animation-delay: -1.5s; }
@keyframes galCtsGem {
    0%, 100% { box-shadow: 0 0 9px rgba(111, 212, 255, 0.95); }
    50% { box-shadow: 0 0 3px rgba(111, 212, 255, 0.4); }
}
#gal-global-overlay[class*="skin-jrpg"] .gal-text-panel > .gal-dialog-text {
    position: relative;
    z-index: 3;
}
/* 工具栏保持宿主的 absolute bottom 定位，但抬离削角线、收进削角内 */
#gal-global-overlay[class*="skin-jrpg"] .gal-text-panel > .gal-bottom-toolbar {
    z-index: 3;
    bottom: 14px !important;
    padding-left: 3.2rem !important;
    padding-right: 3.2rem !important;
}
/* 进度条（面板外兄弟元素）：收进削角范围、与面板底边留出呼吸 */
#gal-global-overlay[class*="skin-jrpg"] .gal-dialog-layer > .gal-progress-container {
    margin: 8px 30px 0 !important;
    width: auto !important;
}
#gal-global-overlay[class*="skin-jrpg"] .gal-dialog-text {
    color: var(--cts-text) !important;
    text-shadow: 0 0 18px rgba(111, 212, 255, 0.25), 0 1px 3px rgba(0, 0, 0, 0.6) !important;
    line-height: 2 !important;
    letter-spacing: 0.06em;
    font-weight: 500 !important;
    font-family: var(--cts-font) !important;
}
.skin-jrpg-dawn .gal-dialog-text { text-shadow: 0 1px 2px rgba(255, 255, 255, 0.65) !important; }

/* ============================================================
   姓名牌：斜切纹章板 + 呼吸星晶
   ============================================================ */
#gal-global-overlay[class*="skin-jrpg"]:not(.skin-default):not(.skin-default-dark):not(.skin-twilight) .gal-name-badge {
    background: linear-gradient(120deg, var(--cts-gold2) 0%, var(--cts-gold) 40%, rgba(111, 212, 255, 0.85) 100%) !important;
    border: none !important;
    border-radius: 0 !important;
    clip-path: var(--cts-cut-para) !important;
    padding: 0.55rem 2rem 0.55rem 2.2rem !important;
    left: 15px !important;
    top: -2.4rem !important;
    box-shadow: none !important;
    isolation: isolate;
    filter: drop-shadow(0 8px 18px rgba(1, 3, 10, 0.7)) drop-shadow(0 0 16px rgba(111, 212, 255, 0.22));
}
#gal-global-overlay[class*="skin-jrpg"] .gal-name-badge::before {
    content: "";
    position: absolute;
    inset: 1.5px;
    z-index: -1;
    clip-path: var(--cts-cut-para);
    background: var(--cts-plate);
}
#gal-global-overlay[class*="skin-jrpg"] .gal-name-badge::after {
    content: "";
    position: absolute;
    left: 0.95rem; top: 50%;
    width: 9px; height: 9px;
    transform: translateY(-50%) rotate(45deg);
    background: linear-gradient(135deg, var(--cts-ice), var(--cts-crystal));
    animation: galCtsGem 2.8s ease-in-out infinite;
}
#gal-global-overlay[class*="skin-jrpg"] .gal-name-badge span {
    color: var(--cts-badge-text) !important;
    text-shadow: var(--cts-badge-shadow) !important;
    font-weight: 700;
    letter-spacing: 0.2em;
    font-family: var(--cts-font) !important;
}
#gal-global-overlay[class*="skin-jrpg"] .gal-name-badge.gal-narrator-label {
    background: linear-gradient(120deg, rgba(174, 185, 214, 0.7), rgba(110, 124, 158, 0.65)) !important;
}
#gal-global-overlay[class*="skin-jrpg"] .gal-name-badge.gal-narrator-label::before {
    background: linear-gradient(120deg, #2a3452 0%, #1c2440 100%);
}
.skin-jrpg-dawn .gal-name-badge.gal-narrator-label::before {
    background: linear-gradient(120deg, #dde6f2 0%, #c8d6e8 100%) !important;
}
#gal-global-overlay[class*="skin-jrpg"] .gal-name-badge.gal-narrator-label::after {
    background: #8b97b6;
    animation: none;
    box-shadow: none;
}

/* ============================================================
   悬浮操作按钮：星晶小签 + 星光扫掠
   ============================================================ */
#gal-global-overlay[class*="skin-jrpg"] .gal-interaction-bar { right: 10px !important; }
#gal-global-overlay[class*="skin-jrpg"]:not(.skin-default):not(.skin-default-dark) .gal-action-btn {
    background: var(--cts-btn-face) !important;
    color: var(--cts-ice) !important;
    border: none !important;
    border-radius: 0 !important;
    clip-path: var(--cts-cut-para) !important;
    box-shadow: inset 0 0 0 1px rgba(184, 237, 255, 0.3) !important;
    font-family: var(--cts-font) !important;
    font-weight: 600 !important;
    letter-spacing: 0.14em !important;
    position: relative !important;
    isolation: isolate;
    transition: color 0.25s ease, box-shadow 0.25s ease !important;
}
#gal-global-overlay[class*="skin-jrpg"] .gal-action-btn::before {
    content: "";
    position: absolute;
    top: 0; bottom: 0; left: -70%;
    width: 44%;
    z-index: -1;
    background: linear-gradient(105deg, transparent 0%, rgba(246, 227, 166, 0.45) 46%, rgba(184, 237, 255, 0.4) 56%, transparent 100%);
    transform: skewX(-18deg);
    transition: left 0.45s ease;
}
#gal-global-overlay[class*="skin-jrpg"] .gal-action-btn:hover::before { left: 135%; }
#gal-global-overlay[class*="skin-jrpg"] .gal-action-btn:hover {
    color: var(--cts-gold2) !important;
    background: var(--cts-btn-face) !important;
    box-shadow: inset 0 0 0 1px rgba(246, 227, 166, 0.8), 0 0 16px rgba(217, 180, 92, 0.35) !important;
}

/* ============================================================
   底栏功能键 / 待选项 / NEXT / 进度条
   ============================================================ */
#gal-global-overlay[class*="skin-jrpg"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn {
    background: none !important;
    color: var(--cts-dim) !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    font-family: var(--cts-font) !important;
    font-weight: 600 !important;
    letter-spacing: 0.1em !important;
    position: relative !important;
    transition: color 0.25s ease, text-shadow 0.25s ease !important;
}
#gal-global-overlay[class*="skin-jrpg"] .gal-footer-btn::after {
    content: "";
    position: absolute;
    left: 50%; bottom: 2px;
    height: 1px; width: 0;
    transform: translateX(-50%);
    background: linear-gradient(90deg, transparent, var(--cts-gold2), transparent);
    box-shadow: 0 0 7px rgba(246, 227, 166, 0.85);
    transition: width 0.28s ease;
}
#gal-global-overlay[class*="skin-jrpg"] .gal-footer-btn:hover {
    background: none !important;
    color: var(--cts-white) !important;
    text-shadow: 0 0 11px rgba(111, 212, 255, 0.8) !important;
}
.skin-jrpg-dawn .gal-footer-btn:hover { text-shadow: 0 0 10px rgba(255, 255, 255, 1) !important; }
#gal-global-overlay[class*="skin-jrpg"] .gal-footer-btn:hover::after { width: 82%; }

#gal-global-overlay[class*="skin-jrpg"]:not(.skin-default):not(.skin-default-dark) .gal-pending-choices-btn {
    background: linear-gradient(120deg, var(--cts-ice), var(--cts-crystal) 70%) !important;
    color: var(--cts-dark-on-crystal) !important;
    border: none !important;
    border-radius: 0 !important;
    clip-path: var(--cts-cut-para) !important;
    box-shadow: none !important;
    font-family: var(--cts-font) !important;
    font-weight: 700 !important;
    letter-spacing: 0.14em !important;
    animation: galCtsBreathe 2.4s ease-out infinite;
}
.skin-jrpg-dawn .gal-pending-choices-btn { color: #fff !important; }
@keyframes galCtsBreathe {
    0%   { filter: drop-shadow(0 0 0 rgba(111, 212, 255, 0.6)); }
    70%  { filter: drop-shadow(0 0 12px rgba(111, 212, 255, 0.05)); }
    100% { filter: drop-shadow(0 0 0 rgba(111, 212, 255, 0)); }
}

#gal-global-overlay[class*="skin-jrpg"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn-next {
    background:
        conic-gradient(from var(--gal-cts-spin),
            rgba(111, 212, 255, 0) 0deg, rgba(184, 237, 255, 0.9) 40deg, rgba(111, 212, 255, 0) 90deg,
            rgba(246, 227, 166, 0) 170deg, var(--cts-gold2) 215deg, rgba(246, 227, 166, 0) 265deg, rgba(111, 212, 255, 0) 360deg),
        linear-gradient(120deg, rgba(217, 180, 92, 0.75), rgba(111, 212, 255, 0.55)) !important;
    color: var(--cts-next-text) !important;
    border: none !important;
    border-radius: 0 !important;
    clip-path: var(--cts-cut-hex) !important;
    box-shadow: none !important;
    font-family: var(--cts-font) !important;
    font-weight: 700 !important;
    letter-spacing: 0.3em !important;
    text-shadow: 0 0 12px rgba(111, 212, 255, 0.7);
    position: relative !important;
    isolation: isolate;
    animation: galCtsNextSpin 3.2s linear infinite;
    filter: drop-shadow(0 6px 18px rgba(111, 212, 255, 0.4));
    transition: filter 0.3s ease !important;
}
.skin-jrpg-dawn .gal-footer-btn-next { text-shadow: none !important; }
@keyframes galCtsNextSpin { to { --gal-cts-spin: 360deg; } }
#gal-global-overlay[class*="skin-jrpg"] .gal-footer-btn-next::before {
    content: "";
    position: absolute;
    inset: 2px;
    z-index: -1;
    clip-path: var(--cts-cut-hex);
    background: var(--cts-next-face);
}
#gal-global-overlay[class*="skin-jrpg"] .gal-footer-btn-next:hover {
    filter: drop-shadow(0 6px 26px rgba(111, 212, 255, 0.75)) brightness(1.12) !important;
}
#gal-global-overlay[class*="skin-jrpg"] .gal-footer-btn:active,
#gal-global-overlay[class*="skin-jrpg"] .gal-action-btn:active,
#gal-global-overlay[class*="skin-jrpg"] .gal-pending-choices-btn:active,
#gal-global-overlay[class*="skin-jrpg"] .gal-footer-btn-next:active {
    transform: translateY(1px) !important;
}

#gal-global-overlay[class*="skin-jrpg"] .gal-progress-container {
    background:
        repeating-linear-gradient(90deg, rgba(184, 237, 255, 0.22) 0 1px, transparent 1px 10%),
        rgba(184, 237, 255, 0.09) !important;
    overflow: visible !important;
}
#gal-global-overlay[class*="skin-jrpg"] .gal-progress-bar {
    background: linear-gradient(90deg, rgba(111, 212, 255, 0.25) 0%, var(--cts-crystal) 55%, var(--cts-gold2) 100%) !important;
    box-shadow: 0 0 10px rgba(111, 212, 255, 0.65) !important;
    position: relative;
}
#gal-global-overlay[class*="skin-jrpg"] .gal-progress-bar::after {
    content: "";
    position: absolute;
    right: -3px; top: 50%;
    width: 8px; height: 8px;
    transform: translateY(-50%) rotate(45deg);
    background: var(--cts-gold2);
    box-shadow: 0 0 12px rgba(246, 227, 166, 1), 0 0 26px rgba(246, 227, 166, 0.5);
}

/* ============================================================
   对话框右侧竖排按钮
   ============================================================ */
#gal-global-overlay[class*="skin-jrpg"] .gal-sprite-toggle,
#gal-global-overlay[class*="skin-jrpg"] .gal-status-popup-trigger {
    background: rgba(7, 14, 42, 0.92) !important;
    border: none !important;
    border-radius: 0 !important;
    clip-path: polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%);
    box-shadow: inset 0 0 0 1px rgba(184, 237, 255, 0.3) !important;
    color: var(--cts-ice) !important;
    transition: box-shadow 0.25s ease, color 0.25s ease !important;
}
.skin-jrpg-dawn .gal-sprite-toggle,
.skin-jrpg-dawn .gal-status-popup-trigger {
    background: rgba(250, 252, 255, 0.94) !important;
    color: #2E7EC7 !important;
}
#gal-global-overlay[class*="skin-jrpg"] .gal-sprite-toggle:hover,
#gal-global-overlay[class*="skin-jrpg"] .gal-status-popup-trigger:hover {
    background: rgba(7, 14, 42, 0.92) !important;
    box-shadow: inset 0 0 0 1px rgba(246, 227, 166, 0.8), 0 0 14px rgba(217, 180, 92, 0.35) !important;
    color: var(--cts-gold2) !important;
}
#gal-global-overlay[class*="skin-jrpg"] .gal-sprite-toggle i,
#gal-global-overlay[class*="skin-jrpg"] .gal-sprite-toggle .gal-eye-icon,
#gal-global-overlay[class*="skin-jrpg"] .gal-status-popup-trigger i { color: inherit !important; }

/* ============================================================
   选项浮层：命运星盘
   ============================================================ */
#gal-layer-choices[class*="skin-jrpg"] {
    background: rgba(2, 4, 14, 0.7) !important;
    backdrop-filter: blur(5px) saturate(0.9) !important;
    isolation: isolate;
}
#gal-layer-choices.skin-jrpg-dawn { background: rgba(160, 190, 225, 0.55) !important; }
#gal-layer-choices[class*="skin-jrpg"]::before {
    content: "";
    position: absolute;
    left: 50%; top: 50%;
    width: min(88vh, 620px);
    aspect-ratio: 1;
    margin-left: calc(min(88vh, 620px) / -2);
    margin-top: calc(min(88vh, 620px) / -2);
    border-radius: 50%;
    border: 1px solid rgba(246, 227, 166, 0.55);
    background: repeating-conic-gradient(from 0deg, rgba(246, 227, 166, 0.85) 0deg 1deg, transparent 1deg 7.5deg);
    -webkit-mask: radial-gradient(circle, transparent 88%, #000 88.6%, #000 92%, transparent 92.6%);
            mask: radial-gradient(circle, transparent 88%, #000 88.6%, #000 92%, transparent 92.6%);
    opacity: 0.85;
    pointer-events: none;
    animation: galCtsSpin 70s linear infinite;
    z-index: -1;
}
#gal-layer-choices[class*="skin-jrpg"]::after {
    content: "";
    position: absolute;
    left: 50%; top: 50%;
    width: min(66vh, 470px);
    aspect-ratio: 1;
    margin-left: calc(min(66vh, 470px) / -2);
    margin-top: calc(min(66vh, 470px) / -2);
    border-radius: 50%;
    border: 1px dashed rgba(184, 237, 255, 0.42);
    background: radial-gradient(circle, rgba(111, 212, 255, 0.14) 0%, rgba(111, 212, 255, 0.04) 44%, transparent 68%);
    pointer-events: none;
    animation: galCtsSpinReverse 46s linear infinite;
    z-index: -1;
}
#gal-layer-choices[class*="skin-jrpg"] .gal-choices-title span {
    color: var(--cts-white) !important;
    font-family: var(--cts-font) !important;
    font-weight: 700 !important;
    letter-spacing: 0.62em !important;
    text-indent: 0.62em;
    text-shadow: 0 0 20px rgba(111, 212, 255, 0.7) !important;
}
#gal-layer-choices[class*="skin-jrpg"] .gal-choices-hint {
    color: rgba(216, 228, 250, 0.42) !important;
    letter-spacing: 0.34em !important;
}
#gal-layer-choices.skin-jrpg-dawn .gal-choices-hint { color: rgba(34, 50, 82, 0.55) !important; }
#gal-layer-choices[class*="skin-jrpg"] .gal-choice-card {
    background: linear-gradient(120deg, rgba(246, 227, 166, 0.85), rgba(111, 212, 255, 0.35) 45%, rgba(184, 237, 255, 0.6)) !important;
    border: none !important;
    border-radius: 0 !important;
    clip-path: var(--cts-cut-card);
    box-shadow: none !important;
    isolation: isolate;
    position: relative;
    filter: drop-shadow(0 16px 26px rgba(1, 3, 10, 0.7));
    transition: transform 0.22s ease, filter 0.22s ease !important;
}
#gal-layer-choices[class*="skin-jrpg"] .gal-choice-card::before {
    content: "";
    position: absolute;
    inset: 1.5px;
    z-index: -1;
    clip-path: var(--cts-cut-card);
    background: var(--cts-cardface);
}
#gal-layer-choices[class*="skin-jrpg"] .gal-choice-card span {
    color: var(--cts-text) !important;
    font-family: var(--cts-font) !important;
    font-weight: 600 !important;
    letter-spacing: 0.06em !important;
}
#gal-layer-choices[class*="skin-jrpg"] .gal-choice-card:hover {
    transform: translateY(-3px) scale(1.012) !important;
    filter: drop-shadow(0 20px 34px rgba(1, 3, 10, 0.85)) drop-shadow(0 0 22px rgba(111, 212, 255, 0.4));
}

/* ============================================================
   历史记录：星之回廊
   ============================================================ */
.gal-history-modal[class*="skin-jrpg"] {
    background: rgba(2, 4, 14, 0.72) !important;
    backdrop-filter: blur(5px) !important;
}
.gal-history-modal.skin-jrpg-dawn { background: rgba(160, 190, 225, 0.6) !important; }
.gal-history-modal[class*="skin-jrpg"] .gal-history-panel {
    background: linear-gradient(120deg, rgba(246, 227, 166, 0.9), rgba(111, 212, 255, 0.5) 44%, rgba(246, 227, 166, 0.75)) !important;
    border: none !important;
    border-radius: 0 !important;
    clip-path: var(--cts-cut-panel);
    isolation: isolate;
    position: relative;
    filter: drop-shadow(0 44px 80px rgba(0, 0, 0, 0.9));
}
.gal-history-modal[class*="skin-jrpg"] .gal-history-panel::before {
    content: "";
    position: absolute;
    inset: 1.5px;
    z-index: -1;
    clip-path: var(--cts-cut-panel);
    background:
        radial-gradient(140% 90% at 50% 0%, rgba(111, 212, 255, 0.1) 0%, transparent 52%),
        linear-gradient(178deg, #0d1840 0%, #060c26 100%);
}
.gal-history-modal.skin-jrpg-dawn .gal-history-panel::before {
    background:
        radial-gradient(140% 90% at 50% 0%, rgba(95, 168, 220, 0.12) 0%, transparent 52%),
        linear-gradient(178deg, #f4f9ff 0%, #e2eefa 100%);
}
.gal-history-modal[class*="skin-jrpg"] .gal-history-header {
    border-bottom: 1px solid rgba(217, 180, 92, 0.35) !important;
}
.gal-history-modal[class*="skin-jrpg"] .gal-history-title {
    color: var(--cts-white) !important;
    font-family: var(--cts-font) !important;
    letter-spacing: 0.44em !important;
    text-shadow: 0 0 16px rgba(111, 212, 255, 0.55);
}
.skin-jrpg-dawn .gal-history-title { text-shadow: none; }
.gal-history-modal[class*="skin-jrpg"] .gal-history-close {
    background: none !important;
    border: 1px solid rgba(184, 237, 255, 0.4) !important;
    border-radius: 0 !important;
    color: var(--cts-ice) !important;
}
.gal-history-modal[class*="skin-jrpg"] .gal-history-close:hover {
    background: var(--cts-gold2) !important;
    border-color: var(--cts-gold2) !important;
    color: #071028 !important;
}
.gal-history-modal[class*="skin-jrpg"] .gal-history-item {
    border-bottom: 1px dashed rgba(184, 237, 255, 0.16) !important;
}
.gal-history-modal[class*="skin-jrpg"] .gal-history-name {
    color: var(--cts-ice) !important;
    font-family: var(--cts-font) !important;
    font-weight: 700 !important;
    letter-spacing: 0.18em !important;
}
.gal-history-modal[class*="skin-jrpg"] .gal-history-content {
    color: var(--cts-text) !important;
    font-family: var(--cts-font) !important;
    line-height: 2 !important;
}
.gal-history-modal[class*="skin-jrpg"] .gal-history-empty { color: var(--cts-dim); }

/* ============================================================
   生成中指示器：星辰演算
   ============================================================ */
#gal-global-overlay[class*="skin-jrpg"] .gal-generating-indicator {
    background:
        radial-gradient(140% 100% at 50% 0%, rgba(111, 212, 255, 0.12) 0%, transparent 55%),
        linear-gradient(178deg, rgba(13, 24, 64, 0.97), rgba(5, 9, 26, 0.97)) !important;
    border: none !important;
    border-radius: 0 !important;
    clip-path: polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px);
    box-shadow: inset 0 0 0 1px rgba(217, 180, 92, 0.45) !important;
}
.skin-jrpg-dawn .gal-generating-indicator {
    background:
        radial-gradient(140% 100% at 50% 0%, rgba(95, 168, 220, 0.14) 0%, transparent 55%),
        linear-gradient(178deg, rgba(250, 252, 255, 0.97), rgba(228, 240, 250, 0.97)) !important;
}
#gal-global-overlay[class*="skin-jrpg"] .gal-gen-icon {
    color: var(--cts-ice) !important;
    text-shadow: 0 0 14px rgba(184, 237, 255, 1);
    animation: galCtsGenPulse 1.8s ease-in-out infinite;
}
@keyframes galCtsGenPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.35; transform: scale(0.82); }
}
#gal-global-overlay[class*="skin-jrpg"] .gal-gen-text {
    color: var(--cts-white) !important;
    font-family: var(--cts-font) !important;
    letter-spacing: 0.4em !important;
    text-shadow: 0 0 16px rgba(111, 212, 255, 0.55);
}
.skin-jrpg-dawn .gal-gen-text { text-shadow: none; }
#gal-global-overlay[class*="skin-jrpg"] .gal-gen-status { color: var(--cts-dim) !important; }
#gal-global-overlay[class*="skin-jrpg"] .gal-gen-dot {
    background: var(--cts-gold2) !important;
    border-radius: 0 !important;
    transform: rotate(45deg);
    box-shadow: 0 0 8px rgba(246, 227, 166, 0.8);
}

/* ============================================================
   移动端上拉菜单 + 窄屏适配
   ============================================================ */
#gal-global-overlay[class*="skin-jrpg"] .gal-mobile-menu {
    background:
        radial-gradient(140% 100% at 50% 0%, rgba(111, 212, 255, 0.08) 0%, transparent 55%),
        linear-gradient(170deg, rgba(16, 28, 70, 0.97), rgba(6, 11, 30, 0.97)) !important;
    border: 1px solid rgba(217, 180, 92, 0.4) !important;
    border-radius: 0 !important;
    clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.7) !important;
    backdrop-filter: blur(8px) !important;
}
.skin-jrpg-dawn .gal-mobile-menu {
    background: linear-gradient(170deg, rgba(250, 252, 255, 0.97), rgba(228, 240, 250, 0.97)) !important;
}
#gal-global-overlay[class*="skin-jrpg"] .gal-mobile-menu .gal-menu-btn {
    background: rgba(184, 237, 255, 0.05) !important;
    color: var(--cts-ice) !important;
    border: none !important;
    border-radius: 0 !important;
    clip-path: polygon(7px 0, 100% 0, calc(100% - 7px) 100%, 0 100%);
    box-shadow: none !important;
    font-family: var(--cts-font) !important;
    font-weight: 600 !important;
    letter-spacing: 0.14em !important;
}
.skin-jrpg-dawn .gal-mobile-menu .gal-menu-btn {
    background: rgba(46, 126, 199, 0.08) !important;
    color: #2E7EC7 !important;
}
#gal-global-overlay[class*="skin-jrpg"] .gal-mobile-menu .gal-menu-btn:hover {
    background: linear-gradient(120deg, rgba(246, 227, 166, 0.9), rgba(217, 180, 92, 0.9)) !important;
    color: #071028 !important;
    transform: none !important;
}

/* 窄屏：削角收窄、装饰同步缩小（对应 demo mobile 覆写） */
@media screen and (max-width: 48rem) {
    #gal-global-overlay[class*="skin-jrpg"],
    #gal-layer-choices[class*="skin-jrpg"],
    .gal-history-modal[class*="skin-jrpg"] {
        --cts-cut-panel: polygon(0 18px, 18px 0, calc(100% - 44px) 0, calc(100% - 34px) 10px,
            calc(100% - 10px) 10px, 100% 20px, 100% calc(100% - 18px),
            calc(100% - 18px) 100%, 44px 100%, 34px calc(100% - 10px),
            10px calc(100% - 10px), 0 calc(100% - 20px));
    }
    #gal-global-overlay[class*="skin-jrpg"] .cts-flourish { width: 44px; height: 44px; }
    #gal-global-overlay[class*="skin-jrpg"] .cts-rivet.cts-r1 { right: 36px; top: 6px; }
    #gal-global-overlay[class*="skin-jrpg"] .cts-rivet.cts-r2 { left: 36px; bottom: 6px; }
    #gal-global-overlay[class*="skin-jrpg"] .cts-watermark {
        right: -90px; bottom: -100px;
        width: 270px; height: 270px;
    }
    #gal-global-overlay[class*="skin-jrpg"] .cts-gate {
        right: 7%; top: 6%;
        width: 92px; height: 92px;
    }
    #gal-global-overlay[class*="skin-jrpg"] .cts-ring-line { inset: 8px; }
    #gal-global-overlay[class*="skin-jrpg"] .cts-moon { inset: 24px; box-shadow: inset 8px -5px 0 0 var(--cts-moon-ink); }
    #gal-global-overlay[class*="skin-jrpg"] .cts-isle-l { left: -8%; bottom: 27%; width: 56%; height: 15%; }
    #gal-global-overlay[class*="skin-jrpg"] .cts-isle-r { right: -6%; bottom: 33%; width: 34%; height: 9%; }
    #gal-global-overlay[class*="skin-jrpg"] .cts-isle-far { left: 56%; bottom: 40%; width: 17%; height: 4.5%; }
    #gal-global-overlay[class*="skin-jrpg"] .cts-cloud-a { bottom: 24%; height: 12%; }
    #gal-global-overlay[class*="skin-jrpg"] .cts-cloud-b { bottom: 16%; height: 10%; }
    #gal-global-overlay[class*="skin-jrpg"] .cts-milkyway { left: -40%; width: 220%; height: 36%; transform: rotate(-24deg); }
}

/* =========================================================
   4.5 燕云十六声 (Yanyun) — 夜雪听风
   demo 1:1 移植（doc/皮肤翻新提案-燕云十六声.html）
   装饰 DOM 由 skin-yanyun-runtime.js 注入（yx-* 节点）。
   变体: skin-yanyun-xueji（雪霁·晨光）仅覆写 CSS 变量
   ========================================================= */
#gal-global-overlay[class*="skin-yanyun"],
#gal-layer-choices[class*="skin-yanyun"],
.gal-history-modal[class*="skin-yanyun"] {
    --yx-ink-0:   #07090d;
    --yx-ink-1:   #0d1117;
    --yx-mist:    #2a3646;
    --yx-snow:    #dbe3ec;
    --yx-snow-dim: rgba(219, 227, 236, 0.55);
    --yx-bronze:  #a67c3d;
    --yx-bronze-2: #d9b06a;
    --yx-cinnabar: #b03a2e;
    --yx-blade:   rgba(199, 222, 244, 0.85);
    --yx-text:    #e8edf4;
    --yx-dim:     rgba(210, 220, 232, 0.55);
    --yx-font:    'Noto Serif SC', 'Source Han Serif SC', '思源宋体', serif;
    --yx-font-brush: 'Zhi Mang Xing', 'Liu Jian Mao Cao', 'KaiTi', 'STKaiti', '楷体', cursive;
    --yx-sky:
        radial-gradient(130% 80% at 72% -10%, #1c2735 0%, rgba(28, 39, 53, 0) 55%),
        radial-gradient(90% 50% at 22% 108%, rgba(42, 54, 70, 0.65) 0%, rgba(42, 54, 70, 0) 60%),
        linear-gradient(176deg, #05070b 0%, #0b0f16 40%, #131a24 78%, #1a2330 100%);
    --yx-moon-core: rgba(226, 233, 241, 0.92);
    --yx-moon-halo: rgba(196, 209, 224, 0.2);
    --yx-mist-ink: rgba(13, 17, 23, 0.32);
    --yx-mtn-far:  #232e3d;
    --yx-mtn-mid:  #182131;
    --yx-mtn-near: #0d1220;
    --yx-snowcap:  rgba(219, 227, 236, 0.34);
    --yx-lamp:     #e8a24a;
    --yx-flake:    rgba(224, 231, 240, 0.9);
    --yx-wind:     rgba(205, 216, 230, 0.14);
    /* 玻璃填充高底线（同 skin-jrpg 的教训：透明感靠 backdrop-filter） */
    --yx-panel:    rgba(10, 13, 18, calc(0.86 + var(--panel-opacity, 0.5) * 0.12));
    --yx-panel-hi: rgba(199, 222, 244, 0.05);
    --yx-plate:    linear-gradient(170deg, #131922 0%, #0a0e14 100%);
    --yx-choice:   linear-gradient(172deg, rgba(19, 25, 34, 0.96), rgba(9, 12, 17, 0.97));
    --yx-btnface:  rgba(13, 17, 23, 0.92);
    --yx-seal-text: #f0e6d6;
    --yx-verse-ink: rgba(199, 222, 244, 0.05);
    --yx-overlay-veil: rgba(4, 6, 9, 0.72);
    --yx-title-shadow: 0 2px 10px rgba(0, 0, 0, 0.7);
    --yx-cut: polygon(0 0, calc(100% - 34px) 0, 100% 34px, 100% 100%, 34px 100%, 0 calc(100% - 34px));
    --yx-cut-s: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px));
    --yx-cut-tab: polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%);
    --yx-cut-card: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px));
}

/* —— 变体：雪霁（晨光），仅覆写变量 —— */
#gal-global-overlay.skin-yanyun-xueji,
#gal-layer-choices.skin-yanyun-xueji,
.gal-history-modal.skin-yanyun-xueji {
    --yx-ink-0:   #b9c6d4;
    --yx-ink-1:   #cdd8e4;
    --yx-mist:    #eef3f8;
    --yx-snow:    #ffffff;
    --yx-snow-dim: rgba(70, 88, 108, 0.55);
    --yx-bronze:  #9a6f2f;
    --yx-bronze-2: #c99a4b;
    --yx-cinnabar: #a33327;
    --yx-blade:   rgba(120, 150, 185, 0.6);
    --yx-text:    #2a3646;
    --yx-dim:     rgba(52, 68, 88, 0.6);
    --yx-sky:
        radial-gradient(120% 70% at 74% -8%, #f6e7c8 0%, rgba(246, 231, 200, 0) 52%),
        radial-gradient(90% 55% at 20% 110%, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0) 60%),
        linear-gradient(176deg, #adc2d8 0%, #cfdce9 45%, #eef3f8 100%);
    --yx-moon-core: rgba(255, 244, 220, 0.95);
    --yx-moon-halo: rgba(246, 231, 200, 0.45);
    --yx-mist-ink: rgba(205, 216, 228, 0.4);
    --yx-mtn-far:  #b3c2d2;
    --yx-mtn-mid:  #93a7bc;
    --yx-mtn-near: #6d8298;
    --yx-snowcap:  rgba(255, 255, 255, 0.75);
    --yx-lamp:     #d98f35;
    --yx-flake:    rgba(255, 255, 255, 0.95);
    --yx-wind:     rgba(255, 255, 255, 0.35);
    --yx-panel:    rgba(248, 250, 253, calc(0.88 + var(--panel-opacity, 0.5) * 0.1));
    --yx-panel-hi: rgba(154, 111, 47, 0.05);
    --yx-plate:    linear-gradient(170deg, #ffffff 0%, #e9eff5 100%);
    --yx-choice:   linear-gradient(172deg, rgba(255, 255, 255, 0.97), rgba(235, 241, 247, 0.97));
    --yx-btnface:  rgba(255, 255, 255, 0.94);
    --yx-seal-text: #fff8ec;
    --yx-verse-ink: rgba(52, 68, 88, 0.08);
    --yx-overlay-veil: rgba(190, 205, 220, 0.55);
    --yx-title-shadow: 0 2px 10px rgba(255, 255, 255, 0.7);
}

#gal-global-overlay[class*="skin-yanyun"] { font-family: var(--yx-font); }

/* ============================================================
   风雪夜戏场景（yx-scene，注入 .gal-layer-bg；
   有背景图 / 生成中时隐藏，宿主点阵伪元素禁用）
   ============================================================ */
#gal-global-overlay[class*="skin-yanyun"] .gal-layer-bg::before { display: none !important; }
#gal-global-overlay[class*="skin-yanyun"] .gal-layer-bg.has-bg .yx-scene,
#gal-global-overlay[class*="skin-yanyun"] .gal-layer-bg.generating-bg .yx-scene { display: none; }
#gal-global-overlay[class*="skin-yanyun"] .yx-scene {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    z-index: 0;
}
#gal-global-overlay[class*="skin-yanyun"] .yx-sky {
    position: absolute;
    inset: 0;
    background: var(--yx-sky);
}
/* 孤月 + 薄云斜过月面下缘 */
#gal-global-overlay[class*="skin-yanyun"] .yx-moon {
    position: absolute;
    right: 14%; top: 13%;
    width: 72px; height: 72px;
    border-radius: 50%;
    background: radial-gradient(circle at 42% 38%, #f2f6fa 0%, var(--yx-moon-core) 55%, rgba(226, 233, 241, 0.75) 100%);
    box-shadow:
        0 0 34px 10px var(--yx-moon-halo),
        0 0 110px 44px rgba(196, 209, 224, 0.1);
}
#gal-global-overlay[class*="skin-yanyun"] .yx-moon::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background:
        radial-gradient(13px 10px at 32% 36%, rgba(158, 172, 188, 0.16), transparent 72%),
        radial-gradient(8px 7px at 60% 60%, rgba(158, 172, 188, 0.12), transparent 72%);
}
#gal-global-overlay[class*="skin-yanyun"] .yx-moon::after {
    content: "";
    position: absolute;
    left: -30%; top: 58%;
    width: 130%; height: 26%;
    border-radius: 50%;
    background: radial-gradient(60% 100% at 50% 50%, var(--yx-mist-ink), transparent 78%);
    filter: blur(4px);
    transform: rotate(-6deg);
    animation: galYxMist 24s ease-in-out infinite alternate;
}
@keyframes galYxMist {
    from { transform: rotate(-6deg) translateX(-14%); opacity: 0.85; }
    to   { transform: rotate(-6deg) translateX(16%); opacity: 0.4; }
}
/* 雁阵 */
#gal-global-overlay[class*="skin-yanyun"] .yx-geese {
    position: absolute;
    left: 8%; top: 20%;
    display: flex;
    gap: 14px;
    opacity: 0.5;
    animation: galYxGeese 70s linear infinite;
}
#gal-global-overlay[class*="skin-yanyun"] .yx-geese i {
    width: 13px; height: 5px;
    position: relative;
}
#gal-global-overlay[class*="skin-yanyun"] .yx-geese i::before,
#gal-global-overlay[class*="skin-yanyun"] .yx-geese i::after {
    content: "";
    position: absolute;
    top: 0;
    width: 8px; height: 1.6px;
    background: var(--yx-snow-dim);
    border-radius: 2px;
}
#gal-global-overlay[class*="skin-yanyun"] .yx-geese i::before { left: 0; transform: rotate(-24deg); transform-origin: right center; }
#gal-global-overlay[class*="skin-yanyun"] .yx-geese i::after { right: 0; transform: rotate(24deg); transform-origin: left center; }
#gal-global-overlay[class*="skin-yanyun"] .yx-geese i:nth-child(2) { margin-top: 9px; }
#gal-global-overlay[class*="skin-yanyun"] .yx-geese i:nth-child(3) { margin-top: 18px; }
#gal-global-overlay[class*="skin-yanyun"] .yx-geese i:nth-child(4) { margin-top: 9px; }
@keyframes galYxGeese {
    from { transform: translateX(0); }
    to   { transform: translateX(76vw); }
}
/* 暮雪苍山三叠 */
#gal-global-overlay[class*="skin-yanyun"] .yx-mtn {
    position: absolute;
    left: -4%; right: -4%;
    pointer-events: none;
}
#gal-global-overlay[class*="skin-yanyun"] .yx-mtn i {
    position: absolute;
    bottom: 0;
    width: 100%; height: 100%;
}
#gal-global-overlay[class*="skin-yanyun"] .yx-mtn-far { bottom: 24%; height: 34%; }
#gal-global-overlay[class*="skin-yanyun"] .yx-mtn-far i {
    background:
        linear-gradient(180deg, var(--yx-snowcap) 0%, transparent 14%),
        var(--yx-mtn-far);
    clip-path: polygon(0 62%, 7% 44%, 15% 56%, 24% 30%, 33% 52%, 44% 18%, 55% 48%, 66% 26%, 77% 50%, 88% 34%, 100% 55%, 100% 100%, 0 100%);
    opacity: 0.95;
    filter: blur(0.6px);
}
#gal-global-overlay[class*="skin-yanyun"] .yx-mtn-mid { bottom: 15%; height: 37%; }
#gal-global-overlay[class*="skin-yanyun"] .yx-mtn-mid i {
    background:
        linear-gradient(180deg, var(--yx-snowcap) 0%, transparent 11%),
        var(--yx-mtn-mid);
    clip-path: polygon(0 70%, 9% 40%, 19% 58%, 30% 22%, 40% 50%, 52% 34%, 63% 12%, 74% 44%, 86% 28%, 100% 48%, 100% 100%, 0 100%);
}
#gal-global-overlay[class*="skin-yanyun"] .yx-mtn-near { bottom: 0; height: 36%; }
#gal-global-overlay[class*="skin-yanyun"] .yx-mtn-near i {
    background:
        linear-gradient(180deg, var(--yx-snowcap) 0%, transparent 8%),
        var(--yx-mtn-near);
    clip-path: polygon(0 55%, 10% 78%, 22% 40%, 36% 66%, 48% 30%, 60% 62%, 73% 46%, 85% 72%, 100% 42%, 100% 100%, 0 100%);
}
/* 客栈灯火 */
#gal-global-overlay[class*="skin-yanyun"] .yx-lamp {
    position: absolute;
    width: 4px; height: 5px;
    background: var(--yx-lamp);
    box-shadow: 0 0 8px 2px rgba(232, 162, 74, 0.75), 0 0 26px 8px rgba(232, 162, 74, 0.22);
    animation: galYxLamp 4.2s ease-in-out infinite alternate;
}
#gal-global-overlay[class*="skin-yanyun"] .yx-lamp-a { left: 23.5%; bottom: 26%; }
#gal-global-overlay[class*="skin-yanyun"] .yx-lamp-b { left: 25.2%; bottom: 24.6%; animation-delay: -2s; scale: 0.7; }
@keyframes galYxLamp {
    from { opacity: 0.65; }
    to   { opacity: 1; }
}
/* 谷间雾带 */
#gal-global-overlay[class*="skin-yanyun"] .yx-fog {
    position: absolute;
    left: -10%; right: -10%;
    pointer-events: none;
    background: linear-gradient(180deg, transparent 0%, var(--yx-mist) 45%, transparent 100%);
    opacity: 0.34;
    filter: blur(18px);
    animation: galYxFog 40s ease-in-out infinite alternate;
}
#gal-global-overlay[class*="skin-yanyun"] .yx-fog-a { bottom: 18%; height: 16%; }
#gal-global-overlay[class*="skin-yanyun"] .yx-fog-b { bottom: 6%; height: 13%; animation-duration: 52s; animation-delay: -20s; opacity: 0.26; }
@keyframes galYxFog {
    from { transform: translateX(-3%); }
    to   { transform: translateX(3%); }
}
/* 风雪两层斜掠 */
#gal-global-overlay[class*="skin-yanyun"] .yx-snowfall {
    position: absolute;
    inset: -10%;
    pointer-events: none;
    background-image:
        radial-gradient(1.6px 1.6px at 12% 8%, var(--yx-flake), transparent 100%),
        radial-gradient(1.3px 1.3px at 34% 28%, var(--yx-flake), transparent 100%),
        radial-gradient(1.8px 1.8px at 56% 12%, var(--yx-flake), transparent 100%),
        radial-gradient(1.2px 1.2px at 78% 32%, var(--yx-flake), transparent 100%),
        radial-gradient(1.5px 1.5px at 90% 6%, var(--yx-flake), transparent 100%),
        radial-gradient(1.2px 1.2px at 22% 52%, var(--yx-flake), transparent 100%),
        radial-gradient(1.6px 1.6px at 66% 58%, var(--yx-flake), transparent 100%),
        radial-gradient(1.2px 1.2px at 44% 76%, var(--yx-flake), transparent 100%);
    background-size: 480px 480px;
    animation: galYxSnow 11s linear infinite;
    opacity: 0.8;
}
#gal-global-overlay[class*="skin-yanyun"] .yx-snowfall.yx-sf2 {
    background-size: 300px 300px;
    animation-duration: 7s;
    opacity: 0.5;
    filter: blur(1px);
}
@keyframes galYxSnow {
    from { background-position: 0 -480px; }
    to   { background-position: -170px 480px; }
}
/* 风痕 */
#gal-global-overlay[class*="skin-yanyun"] .yx-wind {
    position: absolute;
    height: 5px;
    pointer-events: none;
    background: linear-gradient(90deg, transparent, var(--yx-wind) 45%, var(--yx-wind) 55%, transparent);
    border-radius: 50%;
    filter: blur(3px);
    transform: rotate(-7deg);
    opacity: 0;
    animation: galYxWind 9s ease-in-out infinite;
}
#gal-global-overlay[class*="skin-yanyun"] .yx-wind-a { left: 8%; top: 38%; width: 17%; }
#gal-global-overlay[class*="skin-yanyun"] .yx-wind-b { left: 56%; top: 56%; width: 14%; animation-delay: -4.5s; }
@keyframes galYxWind {
    0%, 100% { opacity: 0; transform: rotate(-7deg) translateX(0); }
    14% { opacity: 0.55; }
    44% { opacity: 0; transform: rotate(-7deg) translateX(13vw); }
}
/* —— 背景生成中：墨夜 + 一道剑光扫描 —— */
#gal-global-overlay[class*="skin-yanyun"] .gal-layer-bg.generating-bg {
    background: linear-gradient(176deg, #05070b 0%, #0b0f16 55%, #131a24 100%) !important;
}
#gal-global-overlay[class*="skin-yanyun"] .gal-layer-bg.generating-bg::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg,
        transparent 0%,
        rgba(199, 222, 244, 0.03) 42%,
        rgba(199, 222, 244, 0.18) 50%,
        rgba(199, 222, 244, 0.03) 58%,
        transparent 100%) !important;
    background-size: 100% 300% !important;
    background-repeat: no-repeat !important;
    animation: galYxScan 2.6s ease-in-out infinite;
}
@keyframes galYxScan {
    0%   { background-position: 0 -120%; }
    100% { background-position: 0 220%; }
}

/* ============================================================
   顶部状态栏 & 全屏按钮
   ============================================================ */
#gal-global-overlay[class*="skin-yanyun"] .gal-location-bar,
#gal-global-overlay[class*="skin-yanyun"] .gal-time-bar {
    background: var(--yx-btnface) !important;
    border: 1px solid rgba(166, 124, 61, 0.35) !important;
    border-radius: 0 !important;
    clip-path: var(--yx-cut-s);
    color: var(--yx-text) !important;
    font-family: var(--yx-font) !important;
    letter-spacing: 0.14em;
    backdrop-filter: blur(3px);
}
#gal-global-overlay[class*="skin-yanyun"] .gal-location-bar i,
#gal-global-overlay[class*="skin-yanyun"] .gal-time-bar i { color: var(--yx-bronze-2) !important; }
#gal-global-overlay[class*="skin-yanyun"] .gal-fullscreen-btn {
    background: var(--yx-btnface) !important;
    color: var(--yx-dim) !important;
    border: 1px solid rgba(166, 124, 61, 0.35) !important;
    border-radius: 0 !important;
    clip-path: var(--yx-cut-s);
}
#gal-global-overlay[class*="skin-yanyun"] .gal-fullscreen-btn:hover {
    background: var(--yx-bronze-2) !important;
    color: #0d1117 !important;
    border-color: var(--yx-bronze-2) !important;
}

/* ============================================================
   对话框「墨甲」：面板本体透明，yx-panel-body/line/wedge 承担视觉
   ============================================================ */
#gal-global-overlay[class*="skin-yanyun"] .gal-dialog-layer { bottom: 2rem !important; }
/* 题诗水印 */
#gal-global-overlay[class*="skin-yanyun"] .yx-verse {
    position: absolute;
    right: -34px; bottom: -10px;
    z-index: 0;
    writing-mode: vertical-rl;
    font-family: var(--yx-font-brush);
    font-size: 64px;
    line-height: 1.06;
    color: var(--yx-verse-ink);
    pointer-events: none;
    user-select: none;
    letter-spacing: 0.06em;
}
#gal-global-overlay[class*="skin-yanyun"] .gal-text-panel {
    background: transparent !important;
    background-image: none !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    overflow: visible !important;
    position: relative;
    filter: drop-shadow(0 22px 42px rgba(0, 0, 0, 0.8));
}
/* 墨甲本体 */
#gal-global-overlay[class*="skin-yanyun"] .yx-panel-body {
    position: absolute;
    inset: 0;
    z-index: 0;
    clip-path: var(--yx-cut);
    background:
        radial-gradient(140% 110% at 80% -14%, var(--yx-panel-hi) 0%, transparent 50%),
        var(--yx-panel);
    backdrop-filter: blur(14px) saturate(130%);
    -webkit-backdrop-filter: blur(14px) saturate(130%);
}
/* 鎏铜双线（空心描边） */
#gal-global-overlay[class*="skin-yanyun"] .yx-panel-line {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    clip-path: var(--yx-cut);
    background: linear-gradient(135deg, var(--yx-bronze-2), var(--yx-bronze) 30%, rgba(166, 124, 61, 0.4) 60%, var(--yx-bronze-2));
    -webkit-mask:
        linear-gradient(#000, #000) content-box,
        linear-gradient(#000, #000);
    -webkit-mask-composite: xor;
            mask:
        linear-gradient(#000, #000) content-box,
        linear-gradient(#000, #000);
            mask-composite: exclude;
    padding: 1.5px;
}
#gal-global-overlay[class*="skin-yanyun"] .yx-panel-line2 {
    position: absolute;
    inset: 6px;
    z-index: 1;
    pointer-events: none;
    clip-path: var(--yx-cut);
    background: rgba(166, 124, 61, 0.28);
    -webkit-mask:
        linear-gradient(#000, #000) content-box,
        linear-gradient(#000, #000);
    -webkit-mask-composite: xor;
            mask:
        linear-gradient(#000, #000) content-box,
        linear-gradient(#000, #000);
            mask-composite: exclude;
    padding: 1px;
}
/* 铜楔 */
#gal-global-overlay[class*="skin-yanyun"] .yx-wedge {
    position: absolute;
    z-index: 2;
    pointer-events: none;
    width: 34px; height: 34px;
}
#gal-global-overlay[class*="skin-yanyun"] .yx-wedge::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, var(--yx-bronze-2), var(--yx-bronze));
    opacity: 0.9;
}
#gal-global-overlay[class*="skin-yanyun"] .yx-wedge-tr { right: -1px; top: -1px; }
#gal-global-overlay[class*="skin-yanyun"] .yx-wedge-tr::before { clip-path: polygon(100% 0, 0 0, 100% 100%); }
#gal-global-overlay[class*="skin-yanyun"] .yx-wedge-tr::after {
    content: "";
    position: absolute;
    right: 7px; top: 7px;
    width: 7px; height: 7px;
    transform: rotate(45deg);
    background: var(--yx-ink-0);
}
#gal-global-overlay[class*="skin-yanyun"] .yx-wedge-bl { left: -1px; bottom: -1px; }
#gal-global-overlay[class*="skin-yanyun"] .yx-wedge-bl::before { clip-path: polygon(0 100%, 0 0, 100% 100%); }
#gal-global-overlay[class*="skin-yanyun"] .yx-wedge-bl::after {
    content: "";
    position: absolute;
    left: 7px; bottom: 7px;
    width: 7px; height: 7px;
    transform: rotate(45deg);
    background: var(--yx-ink-0);
}
/* 顶缘剑光 */
#gal-global-overlay[class*="skin-yanyun"] .yx-blade-line {
    position: absolute;
    left: 8%; right: 8%; top: 0;
    height: 1px;
    z-index: 2;
    overflow: hidden;
    pointer-events: none;
}
#gal-global-overlay[class*="skin-yanyun"] .yx-blade-line::after {
    content: "";
    position: absolute;
    top: 0;
    width: 34%; height: 100%;
    background: linear-gradient(90deg, transparent, var(--yx-blade), transparent);
    animation: galYxBladeLine 7s ease-in-out infinite alternate;
}
@keyframes galYxBladeLine {
    from { left: -34%; }
    to   { left: 100%; }
}
/* 面板内容层级 */
#gal-global-overlay[class*="skin-yanyun"] .gal-text-panel > .gal-dialog-text {
    position: relative;
    z-index: 3;
}
#gal-global-overlay[class*="skin-yanyun"] .gal-text-panel > .gal-bottom-toolbar {
    z-index: 3;
    bottom: 14px !important;
    padding-left: 3rem !important;
    padding-right: 3rem !important;
}
#gal-global-overlay[class*="skin-yanyun"] .gal-dialog-layer > .gal-progress-container {
    margin: 8px 30px 0 !important;
    width: auto !important;
}
#gal-global-overlay[class*="skin-yanyun"] .gal-dialog-text {
    color: var(--yx-text) !important;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5) !important;
    line-height: 2 !important;
    letter-spacing: 0.05em;
    font-weight: 500 !important;
    font-family: var(--yx-font) !important;
}
.skin-yanyun-xueji .gal-dialog-text { text-shadow: 0 1px 3px rgba(255, 255, 255, 0.5) !important; }

/* ============================================================
   姓名牌：铜印拓（铜缘深墨牌 + 左侧朱砂小印）
   ============================================================ */
#gal-global-overlay[class*="skin-yanyun"]:not(.skin-default):not(.skin-default-dark):not(.skin-twilight) .gal-name-badge {
    background: linear-gradient(135deg, var(--yx-bronze-2) 0%, var(--yx-bronze) 55%, rgba(166, 124, 61, 0.75) 100%) !important;
    border: none !important;
    border-radius: 0 !important;
    clip-path: var(--yx-cut-tab) !important;
    padding: 0.6rem 2rem 0.6rem 2.6rem !important;
    left: 15px !important;
    top: -2.6rem !important;
    box-shadow: none !important;
    isolation: isolate;
    filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.75));
}
#gal-global-overlay[class*="skin-yanyun"] .gal-name-badge::before {
    content: "";
    position: absolute;
    inset: 1.5px;
    z-index: -1;
    clip-path: var(--yx-cut-tab);
    background: var(--yx-plate);
}
/* 左侧朱砂印（方块，无字版——真实名牌无法注入印字节点） */
#gal-global-overlay[class*="skin-yanyun"] .gal-name-badge::after {
    content: "";
    position: absolute;
    left: 0.85rem; top: 50%;
    width: 15px; height: 15px;
    transform: translateY(-50%);
    background: var(--yx-cinnabar);
    box-shadow: inset 0 0 0 1px rgba(240, 230, 214, 0.25), 0 1px 4px rgba(0, 0, 0, 0.4);
}
#gal-global-overlay[class*="skin-yanyun"] .gal-name-badge span {
    color: var(--yx-text) !important;
    text-shadow: none !important;
    font-weight: 700;
    letter-spacing: 0.24em;
    font-family: var(--yx-font) !important;
}
#gal-global-overlay[class*="skin-yanyun"] .gal-name-badge.gal-narrator-label {
    background: linear-gradient(135deg, rgba(141, 154, 171, 0.6), rgba(93, 107, 126, 0.6)) !important;
}
#gal-global-overlay[class*="skin-yanyun"] .gal-name-badge.gal-narrator-label::after {
    background: #5d6b7e;
    box-shadow: none;
}

/* ============================================================
   悬浮操作按钮：墨签 + 剑光扫过
   ============================================================ */
#gal-global-overlay[class*="skin-yanyun"] .gal-interaction-bar { right: 10px !important; }
#gal-global-overlay[class*="skin-yanyun"]:not(.skin-default):not(.skin-default-dark) .gal-action-btn {
    background: var(--yx-btnface) !important;
    color: var(--yx-snow-dim) !important;
    border: none !important;
    border-radius: 0 !important;
    clip-path: var(--yx-cut-tab) !important;
    box-shadow: inset 0 0 0 1px rgba(166, 124, 61, 0.3) !important;
    font-family: var(--yx-font) !important;
    font-weight: 600 !important;
    letter-spacing: 0.14em !important;
    position: relative !important;
    isolation: isolate;
    transition: color 0.25s ease, box-shadow 0.25s ease !important;
}
#gal-global-overlay[class*="skin-yanyun"] .gal-action-btn::before {
    content: "";
    position: absolute;
    top: 0; bottom: 0; left: -60%;
    width: 36%;
    z-index: -1;
    background: linear-gradient(105deg, transparent, var(--yx-blade), transparent);
    transform: skewX(-20deg);
    transition: left 0.4s ease;
}
#gal-global-overlay[class*="skin-yanyun"] .gal-action-btn:hover::before { left: 130%; }
#gal-global-overlay[class*="skin-yanyun"] .gal-action-btn:hover {
    color: var(--yx-bronze-2) !important;
    background: var(--yx-btnface) !important;
    box-shadow: inset 0 0 0 1px rgba(217, 176, 106, 0.7) !important;
}

/* ============================================================
   底栏功能键 / 剧情选项 / NEXT / 进度条
   ============================================================ */
#gal-global-overlay[class*="skin-yanyun"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn {
    background: none !important;
    color: var(--yx-dim) !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    font-family: var(--yx-font) !important;
    font-weight: 600 !important;
    letter-spacing: 0.1em !important;
    position: relative !important;
    transition: color 0.22s ease !important;
}
#gal-global-overlay[class*="skin-yanyun"] .gal-footer-btn::after {
    content: "";
    position: absolute;
    left: 50%; bottom: 2px;
    height: 2px; width: 0;
    transform: translateX(-50%);
    background: var(--yx-cinnabar);
    transition: width 0.24s ease;
}
#gal-global-overlay[class*="skin-yanyun"] .gal-footer-btn:hover {
    background: none !important;
    color: var(--yx-text) !important;
}
#gal-global-overlay[class*="skin-yanyun"] .gal-footer-btn:hover::after { width: 70%; }

/* 剧情选项：朱砂令牌 */
#gal-global-overlay[class*="skin-yanyun"]:not(.skin-default):not(.skin-default-dark) .gal-pending-choices-btn {
    background: linear-gradient(160deg, #c14a3c, var(--yx-cinnabar) 60%) !important;
    color: var(--yx-seal-text) !important;
    border: none !important;
    border-radius: 0 !important;
    clip-path: var(--yx-cut-tab) !important;
    box-shadow: none !important;
    font-family: var(--yx-font) !important;
    font-weight: 700 !important;
    letter-spacing: 0.14em !important;
    animation: galYxSealBreathe 2.6s ease-out infinite;
}
@keyframes galYxSealBreathe {
    0%   { box-shadow: 0 0 0 0 rgba(176, 58, 46, 0.5); }
    70%  { box-shadow: 0 0 0 11px rgba(176, 58, 46, 0); }
    100% { box-shadow: 0 0 0 0 rgba(176, 58, 46, 0); }
}

/* NEXT「出鞘」：墨鞘铜缘箭形，常驻缓慢剑光 */
#gal-global-overlay[class*="skin-yanyun"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn-next {
    background: linear-gradient(135deg, var(--yx-bronze-2), var(--yx-bronze) 45%, rgba(166, 124, 61, 0.8)) !important;
    color: var(--yx-text) !important;
    border: none !important;
    border-radius: 0 !important;
    clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%) !important;
    box-shadow: none !important;
    font-family: var(--yx-font) !important;
    font-weight: 700 !important;
    letter-spacing: 0.3em !important;
    position: relative !important;
    isolation: isolate;
    overflow: hidden !important;
    filter: drop-shadow(0 6px 16px rgba(0, 0, 0, 0.6));
    transition: filter 0.3s ease !important;
}
#gal-global-overlay[class*="skin-yanyun"] .gal-footer-btn-next::before {
    content: "";
    position: absolute;
    inset: 1.5px;
    z-index: -2;
    clip-path: polygon(0 0, calc(100% - 15px) 0, 100% 50%, calc(100% - 15px) 100%, 0 100%);
    background: var(--yx-plate);
}
#gal-global-overlay[class*="skin-yanyun"] .gal-footer-btn-next::after {
    content: "";
    position: absolute;
    top: 0; bottom: 0; left: -46%;
    width: 30%;
    z-index: -1;
    background: linear-gradient(105deg, transparent, var(--yx-blade), transparent);
    transform: skewX(-18deg);
    animation: galYxNextBlade 3.6s ease-in-out infinite;
}
@keyframes galYxNextBlade {
    0%, 55% { left: -46%; }
    100% { left: 130%; }
}
#gal-global-overlay[class*="skin-yanyun"] .gal-footer-btn-next:hover {
    filter: drop-shadow(0 6px 22px rgba(217, 176, 106, 0.4)) brightness(1.1) !important;
}
#gal-global-overlay[class*="skin-yanyun"] .gal-footer-btn:active,
#gal-global-overlay[class*="skin-yanyun"] .gal-action-btn:active,
#gal-global-overlay[class*="skin-yanyun"] .gal-pending-choices-btn:active,
#gal-global-overlay[class*="skin-yanyun"] .gal-footer-btn-next:active {
    transform: translateY(1px) !important;
}

/* 进度条：一痕墨迹，朱砂行至处 */
#gal-global-overlay[class*="skin-yanyun"] .gal-progress-container {
    background: rgba(199, 222, 244, 0.1) !important;
    overflow: visible !important;
}
.skin-yanyun-xueji .gal-progress-container { background: rgba(52, 68, 88, 0.15) !important; }
#gal-global-overlay[class*="skin-yanyun"] .gal-progress-bar {
    background: linear-gradient(90deg, rgba(166, 124, 61, 0.4) 0%, var(--yx-bronze-2) 78%, var(--yx-cinnabar) 100%) !important;
    box-shadow: none !important;
    position: relative;
}
#gal-global-overlay[class*="skin-yanyun"] .gal-progress-bar::after {
    content: "";
    position: absolute;
    right: -2.5px; top: 50%;
    width: 7px; height: 7px;
    transform: translateY(-50%) rotate(45deg);
    background: var(--yx-cinnabar);
    box-shadow: 0 0 8px rgba(176, 58, 46, 0.8);
}

/* ============================================================
   对话框右侧竖排按钮
   ============================================================ */
#gal-global-overlay[class*="skin-yanyun"] .gal-sprite-toggle,
#gal-global-overlay[class*="skin-yanyun"] .gal-status-popup-trigger {
    background: var(--yx-btnface) !important;
    border: none !important;
    border-radius: 0 !important;
    clip-path: var(--yx-cut-s);
    box-shadow: inset 0 0 0 1px rgba(166, 124, 61, 0.3) !important;
    color: var(--yx-snow-dim) !important;
    transition: box-shadow 0.25s ease, color 0.25s ease !important;
}
#gal-global-overlay[class*="skin-yanyun"] .gal-sprite-toggle:hover,
#gal-global-overlay[class*="skin-yanyun"] .gal-status-popup-trigger:hover {
    background: var(--yx-btnface) !important;
    box-shadow: inset 0 0 0 1px rgba(217, 176, 106, 0.7) !important;
    color: var(--yx-bronze-2) !important;
}
#gal-global-overlay[class*="skin-yanyun"] .gal-sprite-toggle i,
#gal-global-overlay[class*="skin-yanyun"] .gal-sprite-toggle .gal-eye-icon,
#gal-global-overlay[class*="skin-yanyun"] .gal-status-popup-trigger i { color: inherit !important; }

/* ============================================================
   选项浮层：抉择（"武"字水印 + 朱印令牌）
   ============================================================ */
#gal-layer-choices[class*="skin-yanyun"] {
    background: var(--yx-overlay-veil) !important;
    backdrop-filter: blur(5px) saturate(0.9) !important;
    isolation: isolate;
}
#gal-layer-choices[class*="skin-yanyun"]::before {
    content: "武";
    position: absolute;
    left: 50%; top: 50%;
    transform: translate(-50%, -52%);
    font-family: var(--yx-font-brush);
    font-size: min(56vh, 430px);
    line-height: 1;
    color: var(--yx-verse-ink);
    pointer-events: none;
    user-select: none;
    z-index: -1;
}
#gal-layer-choices[class*="skin-yanyun"] .gal-choices-title span {
    color: var(--yx-text) !important;
    font-family: var(--yx-font) !important;
    font-weight: 700 !important;
    letter-spacing: 0.6em !important;
    text-indent: 0.6em;
    text-shadow: var(--yx-title-shadow) !important;
}
#gal-layer-choices[class*="skin-yanyun"] .gal-choices-hint {
    color: var(--yx-dim) !important;
    letter-spacing: 0.34em !important;
}
#gal-layer-choices[class*="skin-yanyun"] .gal-choice-card {
    background: linear-gradient(135deg, rgba(217, 176, 106, 0.8), rgba(166, 124, 61, 0.5) 40%, rgba(166, 124, 61, 0.75)) !important;
    border: none !important;
    border-radius: 0 !important;
    clip-path: var(--yx-cut-card);
    box-shadow: none !important;
    isolation: isolate;
    position: relative;
    filter: drop-shadow(0 14px 26px rgba(0, 0, 0, 0.7));
    transition: transform 0.22s ease, filter 0.22s ease !important;
}
#gal-layer-choices[class*="skin-yanyun"] .gal-choice-card::before {
    content: "";
    position: absolute;
    inset: 1.5px;
    z-index: -1;
    clip-path: var(--yx-cut-card);
    background: var(--yx-choice);
}
#gal-layer-choices[class*="skin-yanyun"] .gal-choice-card span {
    color: var(--yx-text) !important;
    font-family: var(--yx-font) !important;
    font-weight: 600 !important;
    letter-spacing: 0.05em !important;
}
#gal-layer-choices[class*="skin-yanyun"] .gal-choice-card:hover {
    transform: translateY(-2px) !important;
    filter: drop-shadow(0 18px 32px rgba(0, 0, 0, 0.85)) drop-shadow(0 0 14px rgba(176, 58, 46, 0.25));
}

/* ============================================================
   历史记录：江湖录
   ============================================================ */
.gal-history-modal[class*="skin-yanyun"] {
    background: var(--yx-overlay-veil) !important;
    backdrop-filter: blur(5px) !important;
}
.gal-history-modal[class*="skin-yanyun"] .gal-history-panel {
    background: linear-gradient(135deg, rgba(217, 176, 106, 0.85), rgba(166, 124, 61, 0.5) 45%, rgba(166, 124, 61, 0.8)) !important;
    border: none !important;
    border-radius: 0 !important;
    clip-path: var(--yx-cut);
    isolation: isolate;
    position: relative;
    filter: drop-shadow(0 44px 80px rgba(0, 0, 0, 0.9));
}
.gal-history-modal[class*="skin-yanyun"] .gal-history-panel::before {
    content: "";
    position: absolute;
    inset: 1.5px;
    z-index: -1;
    clip-path: var(--yx-cut);
    background:
        radial-gradient(140% 90% at 50% 0%, rgba(199, 222, 244, 0.05) 0%, transparent 52%),
        var(--yx-choice);
}
.gal-history-modal[class*="skin-yanyun"] .gal-history-header {
    border-bottom: 1px solid rgba(166, 124, 61, 0.35) !important;
}
.gal-history-modal[class*="skin-yanyun"] .gal-history-title {
    color: var(--yx-text) !important;
    font-family: var(--yx-font) !important;
    letter-spacing: 0.44em !important;
}
.gal-history-modal[class*="skin-yanyun"] .gal-history-close {
    background: none !important;
    border: 1px solid rgba(166, 124, 61, 0.45) !important;
    border-radius: 0 !important;
    color: var(--yx-bronze) !important;
    clip-path: var(--yx-cut-s);
}
.gal-history-modal[class*="skin-yanyun"] .gal-history-close:hover {
    background: var(--yx-bronze-2) !important;
    border-color: var(--yx-bronze-2) !important;
    color: #0d1117 !important;
}
.gal-history-modal[class*="skin-yanyun"] .gal-history-item {
    border-bottom: 1px dashed rgba(166, 124, 61, 0.22) !important;
}
.gal-history-modal[class*="skin-yanyun"] .gal-history-name {
    color: var(--yx-bronze-2) !important;
    font-family: var(--yx-font) !important;
    font-weight: 700 !important;
    letter-spacing: 0.2em !important;
}
.gal-history-modal[class*="skin-yanyun"] .gal-history-content {
    color: var(--yx-text) !important;
    font-family: var(--yx-font) !important;
    line-height: 2.05 !important;
}
.gal-history-modal[class*="skin-yanyun"] .gal-history-empty { color: var(--yx-dim); }

/* ============================================================
   生成中指示器：听风（悬剑微颤，剑尖坠朱砂）
   ============================================================ */
#gal-global-overlay[class*="skin-yanyun"] .gal-generating-indicator {
    background:
        radial-gradient(140% 100% at 50% 0%, rgba(199, 222, 244, 0.06) 0%, transparent 55%),
        var(--yx-choice) !important;
    border: none !important;
    border-radius: 0 !important;
    clip-path: polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 22px 100%, 0 calc(100% - 22px));
    box-shadow: inset 0 0 0 1px rgba(166, 124, 61, 0.4) !important;
}
/* 魔杖图标改造为悬剑 */
#gal-global-overlay[class*="skin-yanyun"] .gal-gen-icon {
    color: var(--yx-blade) !important;
    text-shadow: 0 0 10px rgba(199, 222, 244, 0.6);
    animation: galYxSwordSway 2.2s ease-in-out infinite alternate;
}
@keyframes galYxSwordSway {
    from { transform: rotate(-4deg); }
    to   { transform: rotate(4deg); }
}
#gal-global-overlay[class*="skin-yanyun"] .gal-gen-text {
    color: var(--yx-text) !important;
    font-family: var(--yx-font) !important;
    letter-spacing: 0.4em !important;
}
#gal-global-overlay[class*="skin-yanyun"] .gal-gen-status { color: var(--yx-dim) !important; }
#gal-global-overlay[class*="skin-yanyun"] .gal-gen-dot {
    background: var(--yx-cinnabar) !important;
    border-radius: 50% 50% 50% 4% !important;
    transform: rotate(45deg);
    box-shadow: none;
}

/* ============================================================
   移动端上拉菜单 + 窄屏适配
   ============================================================ */
#gal-global-overlay[class*="skin-yanyun"] .gal-mobile-menu {
    background:
        radial-gradient(140% 100% at 50% 0%, rgba(199, 222, 244, 0.04) 0%, transparent 55%),
        var(--yx-choice) !important;
    border: 1px solid rgba(166, 124, 61, 0.4) !important;
    border-radius: 0 !important;
    clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.7) !important;
    backdrop-filter: blur(8px) !important;
}
#gal-global-overlay[class*="skin-yanyun"] .gal-mobile-menu .gal-menu-btn {
    background: rgba(166, 124, 61, 0.08) !important;
    color: var(--yx-snow-dim) !important;
    border: none !important;
    border-radius: 0 !important;
    clip-path: var(--yx-cut-tab);
    box-shadow: none !important;
    font-family: var(--yx-font) !important;
    font-weight: 600 !important;
    letter-spacing: 0.14em !important;
}
#gal-global-overlay[class*="skin-yanyun"] .gal-mobile-menu .gal-menu-btn:hover {
    background: linear-gradient(120deg, var(--yx-bronze-2), var(--yx-bronze)) !important;
    color: #0d1117 !important;
    transform: none !important;
}

/* 窄屏：削角收窄、场景重排（对应 demo mobile 覆写） */
@media screen and (max-width: 48rem) {
    #gal-global-overlay[class*="skin-yanyun"],
    #gal-layer-choices[class*="skin-yanyun"],
    .gal-history-modal[class*="skin-yanyun"] {
        --yx-cut: polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 22px 100%, 0 calc(100% - 22px));
    }
    #gal-global-overlay[class*="skin-yanyun"] .yx-wedge { width: 24px; height: 24px; }
    #gal-global-overlay[class*="skin-yanyun"] .yx-wedge-tr::after { right: 5px; top: 5px; width: 5px; height: 5px; }
    #gal-global-overlay[class*="skin-yanyun"] .yx-wedge-bl::after { left: 5px; bottom: 5px; width: 5px; height: 5px; }
    #gal-global-overlay[class*="skin-yanyun"] .yx-verse { font-size: 44px; right: -20px; }
    #gal-global-overlay[class*="skin-yanyun"] .yx-moon { right: 10%; top: 8%; width: 54px; height: 54px; }
    #gal-global-overlay[class*="skin-yanyun"] .yx-geese { left: 5%; top: 16%; scale: 0.8; }
    #gal-global-overlay[class*="skin-yanyun"] .yx-mtn-far { bottom: 34%; height: 20%; }
    #gal-global-overlay[class*="skin-yanyun"] .yx-mtn-mid { bottom: 26%; height: 22%; }
    #gal-global-overlay[class*="skin-yanyun"] .yx-mtn-near { bottom: 14%; height: 22%; }
    #gal-global-overlay[class*="skin-yanyun"] .yx-lamp-a { left: 20%; bottom: 33%; }
    #gal-global-overlay[class*="skin-yanyun"] .yx-lamp-b { left: 23%; bottom: 31.6%; }
    #gal-global-overlay[class*="skin-yanyun"] .yx-fog-a { bottom: 28%; }
    #gal-global-overlay[class*="skin-yanyun"] .yx-fog-b { bottom: 18%; }
}

/* =========================================================
   5. 樱色物语 (Classic) — 「花霞 HANAGASUMI」
   概念: 春晓的霞。晨光穿过花雾，落在温白的玻璃上。
   语言: 暖白磨砂玻璃 · 樱渐变点睛 · 明朝体名牌 · 柔光景深
   配色: 霞白 #FFFAF8, 樱 #F2739B, 绯 #DE5585,
         梅黑 #46293A, 雾紫 #C3AEDC
   ========================================================= */
#gal-global-overlay.skin-classic,
#gal-layer-choices.skin-classic {
    --sk-white:     #FFFAF8;
    --sk-sakura:    #F2739B;
    --sk-deep:      #DE5585;
    --sk-plum:      #46293A;
    --sk-plum-soft: #8A6478;
    --sk-lav:       #C3AEDC;
    --sk-glass:     rgba(255, 250, 248, var(--panel-opacity, 0.85));
    --sk-glass-line:rgba(255, 255, 255, 0.95);
    --sk-shadow:    rgba(222, 85, 133, 0.16);
    --sk-serif:     'Shippori Mincho', 'Hiragino Mincho ProN', 'Noto Serif SC', 'Source Han Serif SC', serif;
    --sk-sans:      'Zen Kaku Gothic New', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    --sk-latin:     'Italiana', 'Cormorant Garamond', 'Times New Roman', serif;
    --sk-grad:      linear-gradient(120deg, #F58FAF 0%, #EE6E99 55%, #E05C8C 100%);
}
/* —— 无背景图时的舞台：春晓花霞（晨光 + 雾紫远山 + 垂樱枝） —— */
#gal-global-overlay.skin-classic .gal-layer-bg:not(.has-bg):not(.generating-bg) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 640' preserveAspectRatio='xMidYMid slice'%3E%3Cdefs%3E%3ClinearGradient id='sky' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%23FFF3EA'/%3E%3Cstop offset='0.42' stop-color='%23FFE4EA'/%3E%3Cstop offset='0.76' stop-color='%23F3DEEE'/%3E%3Cstop offset='1' stop-color='%23E7DCF2'/%3E%3C/linearGradient%3E%3CradialGradient id='sun' cx='0.24' cy='0.2' r='0.34'%3E%3Cstop offset='0' stop-color='%23FFFBEB' stop-opacity='0.95'/%3E%3Cstop offset='0.5' stop-color='%23FFE9CD' stop-opacity='0.5'/%3E%3Cstop offset='1' stop-color='%23FFE9CD' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='1200' height='640' fill='url(%23sky)'/%3E%3Crect width='1200' height='640' fill='url(%23sun)'/%3E%3Cpath d='M0,430 Q160,340 340,400 T700,392 Q900,350 1040,404 T1200,398 L1200,640 L0,640 Z' fill='%23D9C4E0' opacity='0.55'/%3E%3Cpath d='M0,480 Q220,404 460,458 T900,450 Q1060,420 1200,462 L1200,640 L0,640 Z' fill='%23E4BBD0' opacity='0.6'/%3E%3Cpath d='M0,556 Q300,512 640,542 T1200,534 L1200,640 L0,640 Z' fill='%23F2D7E3' opacity='0.9'/%3E%3Cg fill='none' stroke='%237C4A62' stroke-linecap='round' opacity='0.9'%3E%3Cpath d='M1230,30 Q1040,80 930,180 T780,330' stroke-width='12'/%3E%3Cpath d='M1030,110 Q950,145 910,225' stroke-width='6'/%3E%3Cpath d='M910,205 Q830,245 812,326' stroke-width='5'/%3E%3Cpath d='M1120,64 Q1060,134 1068,214' stroke-width='6'/%3E%3C/g%3E%3Cg%3E%3Ccircle cx='924' cy='188' r='34' fill='%23F9C6D6' opacity='0.9'/%3E%3Ccircle cx='880' cy='238' r='26' fill='%23F6B2C9' opacity='0.85'/%3E%3Ccircle cx='962' cy='150' r='24' fill='%23FBD5E1' opacity='0.9'/%3E%3Ccircle cx='822' cy='300' r='28' fill='%23F6B2C9' opacity='0.8'/%3E%3Ccircle cx='792' cy='336' r='18' fill='%23F19CBB' opacity='0.75'/%3E%3Ccircle cx='1062' cy='196' r='26' fill='%23F9C6D6' opacity='0.85'/%3E%3Ccircle cx='1092' cy='150' r='20' fill='%23FBD5E1' opacity='0.85'/%3E%3Ccircle cx='1148' cy='84' r='30' fill='%23F9C6D6' opacity='0.9'/%3E%3Ccircle cx='1006' cy='120' r='18' fill='%23F6B2C9' opacity='0.7'/%3E%3C/g%3E%3Cg fill='%23E87FA5'%3E%3Ccircle cx='936' cy='196' r='5' opacity='0.9'/%3E%3Ccircle cx='884' cy='248' r='4' opacity='0.8'/%3E%3Ccircle cx='826' cy='308' r='4.5' opacity='0.8'/%3E%3Ccircle cx='1066' cy='204' r='4' opacity='0.8'/%3E%3Ccircle cx='1146' cy='92' r='5' opacity='0.85'/%3E%3C/g%3E%3Cg fill='%23F4A9C1'%3E%3Cpath d='M300,140 q8,-4 10,4 q-2,9 -11,7 q-4,-8 1,-11' opacity='0.5'/%3E%3Cpath d='M480,300 q7,-3 9,3 q-2,8 -10,6 q-3,-7 1,-9' opacity='0.4'/%3E%3Cpath d='M180,380 q8,-4 10,4 q-2,9 -11,7 q-4,-8 1,-11' opacity='0.45'/%3E%3Cpath d='M640,180 q6,-3 8,3 q-2,7 -9,5 q-3,-6 1,-8' opacity='0.35'/%3E%3Cpath d='M560,440 q8,-4 10,4 q-2,9 -11,7 q-4,-8 1,-11' opacity='0.4'/%3E%3C/g%3E%3C/svg%3E") !important;
    background-size: cover !important;
    background-position: center !important;
}
/* 覆盖宿主点阵，改为缓慢漂移的花雾横带 */
#gal-global-overlay.skin-classic .gal-layer-bg:not(.has-bg):not(.generating-bg)::before {
    background-image: linear-gradient(180deg,
        transparent 42%,
        rgba(255, 250, 250, 0.65) 52%,
        transparent 62%,
        transparent 66%,
        rgba(255, 250, 250, 0.45) 74%,
        transparent 82%) !important;
    background-size: auto !important;
    opacity: 0.9 !important;
    filter: blur(5px);
    animation: skClassicMistDrift 26s ease-in-out infinite alternate;
}
@keyframes skClassicMistDrift {
    from { transform: translateX(-2%); }
    to   { transform: translateX(2%); }
}
/* 背景生成中：樱暮色 + 一道柔光扫过 */
#gal-global-overlay.skin-classic .gal-layer-bg.generating-bg {
    background: linear-gradient(168deg, #3A2530 0%, #2B1B26 56%, #40263A 100%) !important;
}
#gal-global-overlay.skin-classic .gal-layer-bg.generating-bg::before {
    background-image: linear-gradient(180deg,
        transparent 0%,
        rgba(242, 115, 155, 0.04) 42%,
        rgba(242, 115, 155, 0.16) 50%,
        rgba(242, 115, 155, 0.04) 58%,
        transparent 100%) !important;
    background-size: auto !important;
    opacity: 1 !important;
    animation: skClassicGenSweep 2.6s ease-in-out infinite;
}
@keyframes skClassicGenSweep {
    0%   { transform: translateY(-40%); }
    100% { transform: translateY(40%); }
}
/* 对话主面板：暖白磨砂玻璃 */
#gal-global-overlay.skin-classic .gal-text-panel {
    background: var(--sk-glass) !important;
    background-image: none !important;
    border: 1px solid var(--sk-glass-line) !important;
    border-radius: calc(22px * var(--ui-scale, 1)) !important;
    box-shadow:
        0 calc(24px * var(--ui-scale, 1)) calc(64px * var(--ui-scale, 1)) var(--sk-shadow),
        0 calc(2px * var(--ui-scale, 1)) calc(8px * var(--ui-scale, 1)) rgba(70, 41, 58, 0.05),
        inset 0 1px 0 rgba(255, 255, 255, 0.9) !important;
    backdrop-filter: blur(22px) saturate(1.35) !important;
    -webkit-backdrop-filter: blur(22px) saturate(1.35) !important;
    overflow: visible !important;
}
/* 顶缘一线樱霞渐变 —— 面板唯一的彩色装饰 */
#gal-global-overlay.skin-classic .gal-text-panel::after {
    content: '';
    position: absolute;
    top: 0;
    left: calc(22px * var(--ui-scale, 1));
    right: calc(22px * var(--ui-scale, 1));
    height: 2px;
    border-radius: 2px;
    background: linear-gradient(90deg, transparent, #F58FAF 18%, #E05C8C 50%, #C3AEDC 86%, transparent);
    opacity: 0.85;
    pointer-events: none;
}
#gal-global-overlay.skin-classic .gal-dialog-text {
    color: var(--sk-plum) !important;
    font-family: var(--sk-serif) !important;
    font-weight: 500 !important;
    line-height: 2.05 !important;
    letter-spacing: 0.035em !important;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7) !important;
}
/* 名字：樱渐变浮签 + 白花瓣印 + 明朝体 */
#gal-global-overlay.skin-classic .gal-name-badge {
    top: calc(-1.35rem * var(--ui-scale, 1)) !important;
    left: calc(1.6rem * var(--ui-scale, 1)) !important;
    padding: calc(0.42rem * var(--ui-scale, 1)) calc(1.55rem * var(--ui-scale, 1)) !important;
    background: var(--sk-grad) !important;
    color: #fff !important;
    border: none !important;
    border-radius: 999px !important;
    box-shadow:
        0 calc(8px * var(--ui-scale, 1)) calc(22px * var(--ui-scale, 1)) rgba(222, 85, 133, 0.38),
        inset 0 1px 0 rgba(255, 255, 255, 0.45) !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 0.55rem;
    font-family: var(--sk-serif) !important;
    font-weight: 700 !important;
}
#gal-global-overlay.skin-classic .gal-name-badge::before {
    content: '';
    width: calc(0.72rem * var(--ui-scale, 1));
    height: calc(0.66rem * var(--ui-scale, 1));
    background: rgba(255, 255, 255, 0.92);
    border-radius: 100% 4% 100% 100%;
    transform: rotate(-32deg);
    flex-shrink: 0;
}
#gal-global-overlay.skin-classic .gal-name-badge span {
    letter-spacing: 0.22em;
    text-shadow: 0 1px 6px rgba(158, 44, 88, 0.35);
}
/* 交互按钮（重绘/自由对话）：白玻璃药丸 */
#gal-global-overlay.skin-classic .gal-action-btn {
    background: rgba(255, 250, 248, 0.78) !important;
    color: var(--sk-plum-soft) !important;
    border: 1px solid rgba(255, 255, 255, 0.95) !important;
    border-radius: 999px !important;
    box-shadow: 0 calc(6px * var(--ui-scale, 1)) calc(18px * var(--ui-scale, 1)) rgba(222, 85, 133, 0.12) !important;
    font-family: var(--sk-sans) !important;
    font-weight: 700 !important;
    letter-spacing: 0.14em !important;
    backdrop-filter: blur(12px) saturate(1.3);
    -webkit-backdrop-filter: blur(12px) saturate(1.3);
    transition: color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease, background 0.25s ease !important;
}
#gal-global-overlay.skin-classic .gal-action-btn i { color: var(--sk-sakura); opacity: 0.85; }
#gal-global-overlay.skin-classic .gal-action-btn:hover {
    background: #fff !important;
    color: var(--sk-deep) !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 calc(10px * var(--ui-scale, 1)) calc(26px * var(--ui-scale, 1)) rgba(222, 85, 133, 0.22) !important;
}
#gal-global-overlay.skin-classic .gal-action-btn.btn-free {
    color: var(--sk-deep) !important;
    border-color: rgba(242, 115, 155, 0.4) !important;
}
/* 底部工具栏：幽灵文字按钮 · 悬停晕开樱色 */
#gal-global-overlay.skin-classic .gal-bottom-toolbar {
    border-top: 1px solid rgba(222, 85, 133, 0.10);
}
#gal-global-overlay.skin-classic .gal-footer-btn {
    background: transparent !important;
    color: var(--sk-plum-soft) !important;
    border: none !important;
    border-radius: 999px !important;
    box-shadow: none !important;
    font-family: var(--sk-sans) !important;
    font-weight: 700 !important;
    letter-spacing: 0.1em !important;
    transition: color 0.22s ease, background 0.22s ease !important;
}
#gal-global-overlay.skin-classic .gal-footer-btn i {
    font-size: calc(0.72rem * var(--ui-scale, 1)) !important;
    opacity: 0.55;
}
#gal-global-overlay.skin-classic .gal-footer-btn:hover {
    background: rgba(242, 115, 155, 0.10) !important;
    color: var(--sk-deep) !important;
    box-shadow: none !important;
}
#gal-global-overlay.skin-classic .gal-nav-btn.active {
    background: rgba(242, 115, 155, 0.14) !important;
    color: var(--sk-deep) !important;
    box-shadow: none !important;
}
/* 剧情选项：樱线框药丸 · 柔和呼吸 */
#gal-global-overlay.skin-classic .gal-pending-choices-btn {
    background: rgba(255, 255, 255, 0.6) !important;
    color: var(--sk-deep) !important;
    border: 1px solid rgba(242, 115, 155, 0.55) !important;
    border-radius: 999px !important;
    box-shadow: none !important;
    font-family: var(--sk-sans) !important;
    font-weight: 700 !important;
    letter-spacing: 0.12em !important;
    animation: none !important;
    transition: all 0.28s ease !important;
}
#gal-global-overlay.skin-classic .gal-pending-choices-btn.show {
    animation: skClassicBloom 2.8s ease-in-out infinite !important;
}
@keyframes skClassicBloom {
    0%, 100% { box-shadow: 0 0 0 0 rgba(242, 115, 155, 0.0); }
    50%      { box-shadow: 0 0 0 6px rgba(242, 115, 155, 0.14); }
}
#gal-global-overlay.skin-classic .gal-pending-choices-btn:hover {
    background: var(--sk-grad) !important;
    color: #fff !important;
    border-color: transparent !important;
    transform: translateY(-1px) !important;
    filter: none !important;
    box-shadow: 0 8px 22px rgba(222, 85, 133, 0.35) !important;
}
/* NEXT：樱渐变主按钮 · 箭头前探 */
#gal-global-overlay.skin-classic .gal-footer-btn-next {
    clip-path: none !important;
    border-radius: 999px !important;
    background: var(--sk-grad) !important;
    color: #fff !important;
    border: none !important;
    box-shadow:
        0 calc(10px * var(--ui-scale, 1)) calc(26px * var(--ui-scale, 1)) rgba(222, 85, 133, 0.38),
        inset 0 1px 0 rgba(255, 255, 255, 0.45) !important;
    font-family: var(--sk-latin) !important;
    font-weight: 400 !important;
    letter-spacing: 0.3em !important;
    text-indent: 0.3em;
    transition: box-shadow 0.28s ease, transform 0.28s ease, filter 0.28s ease !important;
}
#gal-global-overlay.skin-classic .gal-footer-btn-next i {
    font-size: calc(0.78rem * var(--ui-scale, 1)) !important;
    transition: transform 0.28s ease;
}
#gal-global-overlay.skin-classic .gal-footer-btn-next:hover {
    background: var(--sk-grad) !important;
    transform: translateY(-2px) !important;
    filter: brightness(1.06);
    box-shadow:
        0 calc(14px * var(--ui-scale, 1)) calc(34px * var(--ui-scale, 1)) rgba(222, 85, 133, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.5) !important;
}
#gal-global-overlay.skin-classic .gal-footer-btn-next:hover i {
    transform: translateX(4px);
}
/* 按压：轻沉 */
#gal-global-overlay.skin-classic .gal-action-btn:active,
#gal-global-overlay.skin-classic .gal-footer-btn:active,
#gal-global-overlay.skin-classic .gal-pending-choices-btn:active,
#gal-global-overlay.skin-classic .gal-footer-btn-next:active {
    transform: translateY(1px) !important;
    filter: brightness(0.94) !important;
}
/* 进度：晨光丝带 */
#gal-global-overlay.skin-classic .gal-progress-container {
    background: rgba(222, 85, 133, 0.10) !important;
    height: calc(3px * var(--ui-scale, 1)) !important;
    border-radius: 999px !important;
}
#gal-global-overlay.skin-classic .gal-progress-bar {
    background: linear-gradient(90deg, #F5A6BE, #EE6E99, #C3AEDC) !important;
    border-radius: 999px !important;
    box-shadow: 0 0 10px rgba(242, 115, 155, 0.55) !important;
}
/* 顶部状态：白玻璃小签 */
#gal-global-overlay.skin-classic .gal-fullscreen-btn,
#gal-global-overlay.skin-classic .gal-location-bar,
#gal-global-overlay.skin-classic .gal-time-bar {
    background: rgba(255, 250, 248, 0.66) !important;
    color: var(--sk-plum-soft) !important;
    border: 1px solid rgba(255, 255, 255, 0.9) !important;
    border-radius: 999px !important;
    box-shadow: 0 4px 14px rgba(222, 85, 133, 0.10) !important;
    font-family: var(--sk-sans) !important;
    font-weight: 500 !important;
    letter-spacing: 0.08em !important;
    backdrop-filter: blur(10px) saturate(1.3);
    -webkit-backdrop-filter: blur(10px) saturate(1.3);
    transition: color 0.25s ease, box-shadow 0.25s ease !important;
}
#gal-global-overlay.skin-classic .gal-fullscreen-btn:hover {
    background: #fff !important;
    color: var(--sk-deep) !important;
    box-shadow: 0 8px 20px rgba(222, 85, 133, 0.2) !important;
}
#gal-global-overlay.skin-classic .gal-location-bar i,
#gal-global-overlay.skin-classic .gal-time-bar i {
    color: var(--sk-sakura) !important;
    font-size: 0.72rem !important;
}
#gal-global-overlay.skin-classic .gal-bgm-widget {
    background: rgba(255, 250, 248, 0.7) !important;
    color: var(--sk-plum-soft) !important;
    border: 1px solid rgba(255, 255, 255, 0.9) !important;
    border-radius: 999px !important;
    box-shadow: 0 4px 14px rgba(222, 85, 133, 0.10) !important;
    font-family: var(--sk-sans) !important;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
}
#gal-global-overlay.skin-classic .gal-bgm-icon  { color: var(--sk-sakura) !important; }
#gal-global-overlay.skin-classic .gal-bgm-title { color: var(--sk-plum) !important; font-weight: 700; letter-spacing: 0.06em; }
#gal-global-overlay.skin-classic .gal-bgm-btn:hover { color: var(--sk-deep) !important; }
/* 侧边小按钮：白玻璃圆钮 */
#gal-global-overlay.skin-classic .gal-sprite-toggle,
#gal-global-overlay.skin-classic .gal-status-popup-trigger {
    background: rgba(255, 250, 248, 0.72) !important;
    border: 1px solid rgba(255, 255, 255, 0.95) !important;
    border-radius: 50% !important;
    box-shadow: 0 4px 14px rgba(222, 85, 133, 0.12) !important;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    transition: box-shadow 0.25s ease, transform 0.25s ease !important;
}
#gal-global-overlay.skin-classic .gal-eye-icon { color: var(--sk-plum-soft) !important; }
#gal-global-overlay.skin-classic .gal-status-popup-icon { color: var(--sk-plum-soft) !important; }
#gal-global-overlay.skin-classic .gal-sprite-toggle:hover,
#gal-global-overlay.skin-classic .gal-status-popup-trigger:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 8px 20px rgba(222, 85, 133, 0.22) !important;
}
#gal-global-overlay.skin-classic .gal-sprite-toggle:hover .gal-eye-icon,
#gal-global-overlay.skin-classic .gal-status-popup-trigger:hover .gal-status-popup-icon {
    color: var(--sk-deep) !important;
}
/* 选项层：花雾玻璃 · 白卡浮升 */
#gal-layer-choices.skin-classic {
    background: linear-gradient(160deg, rgba(255, 236, 241, 0.82), rgba(238, 228, 248, 0.82)) !important;
    backdrop-filter: blur(20px) saturate(1.3) !important;
    -webkit-backdrop-filter: blur(20px) saturate(1.3) !important;
}
#gal-layer-choices.skin-classic .gal-choices-title {
    font-family: var(--sk-latin);
    font-weight: 400;
    color: var(--sk-deep);
    letter-spacing: 0.5em;
    text-indent: 0.5em;
}
#gal-layer-choices.skin-classic .gal-choice-card {
    background: rgba(255, 252, 251, 0.9) !important;
    color: var(--sk-plum) !important;
    border: 1px solid rgba(255, 255, 255, 1) !important;
    border-radius: 18px !important;
    box-shadow: 0 10px 30px rgba(222, 85, 133, 0.12) !important;
    font-family: var(--sk-serif);
    font-weight: 600 !important;
    letter-spacing: 0.06em;
    position: relative;
    overflow: hidden;
    transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s ease, color 0.3s ease, background 0.3s ease !important;
}
#gal-layer-choices.skin-classic .gal-choice-card::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 4px;
    background: var(--sk-grad);
    transform: scaleY(0);
    transform-origin: top;
    transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
#gal-layer-choices.skin-classic .gal-choice-card:hover {
    background: #fff !important;
    color: var(--sk-deep) !important;
    transform: translateY(-4px) !important;
    box-shadow: 0 18px 44px rgba(222, 85, 133, 0.24) !important;
}
#gal-layer-choices.skin-classic .gal-choice-card:hover::before { transform: scaleY(1); }
#gal-layer-choices.skin-classic .gal-choices-hint {
    color: var(--sk-plum-soft);
    font-family: var(--sk-sans);
    letter-spacing: 0.24em;
}
/* 生成中指示器 */
#gal-global-overlay.skin-classic .gal-generating-indicator {
    background: rgba(255, 250, 248, 0.9) !important;
    border: 1px solid rgba(255, 255, 255, 0.95) !important;
    border-radius: 18px !important;
    box-shadow: 0 20px 50px rgba(222, 85, 133, 0.2) !important;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
}
#gal-global-overlay.skin-classic .gal-generating-indicator .gal-gen-icon   { color: var(--sk-sakura) !important; }
#gal-global-overlay.skin-classic .gal-generating-indicator .gal-gen-text   { color: var(--sk-plum) !important; font-family: var(--sk-serif); letter-spacing: 0.18em; }
#gal-global-overlay.skin-classic .gal-generating-indicator .gal-gen-status { color: var(--sk-plum-soft) !important; }
#gal-global-overlay.skin-classic .gal-generating-indicator .gal-gen-dot    { background: var(--sk-sakura) !important; }

/* =========================================================
   6. 朱笺 (Shujian / Vermilion Letter) — 宣纸 × 墨 × 朱砂印章
   设计语言: 纸/墨/朱砂三色 + 竖排印章名牌 + 一行安静的衬线文字按钮
   配色: 宣纸 #f6f1e6, 墨 #26221c, 朱砂 #c8452c, 泥金 #b08d4f
   变体: skin-shujian-night（墨夜）仅覆写 CSS 变量
   ========================================================= */
#gal-global-overlay[class*="skin-shujian"],
#gal-layer-choices[class*="skin-shujian"],
.gal-history-modal[class*="skin-shujian"] {
    --shu-paper: #f6f1e6;
    --shu-paper-rgb: 246, 241, 230;
    --shu-paper-warm: #efe7d6;
    --shu-paper-warm-rgb: 239, 231, 214;
    --shu-ink: #26221c;
    --shu-ink-soft: #5d564a;
    --shu-vermilion: #c8452c;
    --shu-vermilion-dk: #a5341f;
    --shu-gold: #b08d4f;
    --shu-hairline: rgba(38, 34, 28, 0.28);
    --shu-hairline-soft: rgba(38, 34, 28, 0.14);
    --shu-narrator: #4a443a;
    --shu-glow: rgba(200, 69, 44, 0.45);
    --shu-stage-line: rgba(200, 69, 44, 0.09);
    --shu-on-seal: #fdf6ea;
    --shu-font-serif: "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", "SimSun", serif;
    --shu-font-latin: "Cormorant Garamond", "Georgia", "Times New Roman", "Noto Serif SC", serif;
    --gal-quote-color: var(--shu-vermilion-dk);
}
#gal-global-overlay.skin-shujian-night,
#gal-layer-choices.skin-shujian-night,
.gal-history-modal.skin-shujian-night {
    --shu-paper: #211f24;
    --shu-paper-rgb: 33, 31, 36;
    --shu-paper-warm: #1a181d;
    --shu-paper-warm-rgb: 26, 24, 29;
    --shu-ink: #ece5d8;
    --shu-ink-soft: #9a917f;
    --shu-vermilion: #e0603f;
    --shu-vermilion-dk: #b8482c;
    --shu-hairline: rgba(236, 229, 216, 0.22);
    --shu-hairline-soft: rgba(236, 229, 216, 0.12);
    --shu-narrator: #3f3b44;
    --shu-glow: rgba(224, 96, 63, 0.5);
    --shu-stage-line: rgba(224, 96, 63, 0.07);
    --gal-quote-color: #e0a35f;
}
#gal-global-overlay[class*="skin-shujian"] { font-family: var(--shu-font-serif); }

/* —— 无背景图时的舞台：整张宣纸（替换默认灰底点阵）——
   注意 :not(.generating-bg)：背景生成中要让位给下方的「研墨」动画 —— */
#gal-global-overlay[class*="skin-shujian"] .gal-layer-bg:not(.generating-bg) {
    background:
        radial-gradient(115% 90% at 50% 8%, rgba(var(--shu-paper-rgb), 1) 0%, rgba(var(--shu-paper-warm-rgb), 1) 68%, rgba(var(--shu-paper-warm-rgb), 1) 100%) !important;
}
#gal-global-overlay[class*="skin-shujian"] .gal-layer-bg:not(.generating-bg)::before {
    background-image:
        repeating-linear-gradient(90deg,
            var(--shu-stage-line) 0, var(--shu-stage-line) 1px,
            transparent 1px, transparent 2.6rem) !important;
    background-size: auto !important;
    opacity: 1 !important;
}
#gal-global-overlay[class*="skin-shujian"] .gal-layer-bg:not(.generating-bg)::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
        radial-gradient(140% 100% at 50% 108%, rgba(15, 10, 5, 0.16) 0%, rgba(15, 10, 5, 0) 46%),
        radial-gradient(120% 70% at 50% -12%, rgba(15, 10, 5, 0.08) 0%, rgba(15, 10, 5, 0) 42%);
}
#gal-global-overlay[class*="skin-shujian"] .gal-layer-bg.has-bg::after { content: none; }

/* —— 背景生成中：「研墨」——墨池底 + 一道朱砂墨线缓缓扫过（替换默认深蓝科技风）—— */
#gal-global-overlay[class*="skin-shujian"] .gal-layer-bg.generating-bg {
    background: linear-gradient(168deg, #211d17 0%, #17140f 56%, #26221c 100%) !important;
}
#gal-global-overlay[class*="skin-shujian"] .gal-layer-bg.generating-bg::before {
    background-image:
        repeating-linear-gradient(90deg,
            rgba(246, 241, 230, 0.045) 0, rgba(246, 241, 230, 0.045) 1px,
            transparent 1px, transparent 2.6rem) !important;
    background-size: auto !important;
    opacity: 1 !important;
}
#gal-global-overlay[class*="skin-shujian"] .gal-layer-bg.generating-bg::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(180deg,
        transparent 0%,
        rgba(200, 69, 44, 0.05) 42%,
        rgba(200, 69, 44, 0.22) 50%,
        rgba(200, 69, 44, 0.05) 58%,
        transparent 100%);
    background-size: 100% 300%;
    background-repeat: no-repeat;
    animation: galShujianInkScan 3.2s ease-in-out infinite;
}
@keyframes galShujianInkScan {
    0% { background-position: 0 -120%; }
    100% { background-position: 0 220%; }
}

/* —— 对话正文纸面：宣纸渐变 + 发丝外框 + 内圈细线（outline 不随内容滚动）—— */
#gal-global-overlay[class*="skin-shujian"] .gal-text-panel {
    background: linear-gradient(175deg,
        rgba(var(--shu-paper-rgb), var(--panel-opacity, 0.96)) 0%,
        rgba(var(--shu-paper-warm-rgb), var(--panel-opacity, 0.96)) 100%) !important;
    border: 1px solid var(--shu-hairline) !important;
    border-radius: 4px !important;
    box-shadow: 0 1.5rem 3rem -1.2rem rgba(15, 10, 5, 0.5) !important;
    outline: 1px solid var(--shu-hairline-soft);
    outline-offset: -7px;
}
#gal-global-overlay[class*="skin-shujian"] .gal-dialog-text {
    color: var(--shu-ink) !important;
    font-weight: 500 !important;
    line-height: 2.05 !important;
    letter-spacing: 0.045em;
    text-shadow: none !important;
}

/* —— 姓名牌：竖排朱砂印章（旁白转墨灰印）—— */
#gal-global-overlay[class*="skin-shujian"] .gal-name-badge {
    background: linear-gradient(160deg, var(--shu-vermilion) 0%, var(--shu-vermilion-dk) 100%) !important;
    color: var(--shu-on-seal) !important;
    writing-mode: vertical-rl !important;
    text-orientation: upright !important;
    left: -0.45rem !important;
    top: -1.6rem !important;
    padding: 0.85rem 0.5rem !important;
    font-size: 1.05rem !important;
    font-weight: 700 !important;
    font-family: var(--shu-font-serif) !important;
    letter-spacing: 0.22em !important;
    line-height: 1 !important;
    border-radius: 3px !important;
    box-shadow: 0 0.5rem 1.2rem -0.35rem var(--shu-glow), inset 0 0 0 1px rgba(253, 246, 234, 0.35) !important;
    z-index: 36;
}
#gal-global-overlay[class*="skin-shujian"] .gal-name-badge::after {
    content: "";
    position: absolute;
    inset: -3px;
    border: 1px solid var(--shu-glow);
    border-radius: 5px;
    pointer-events: none;
}
#gal-global-overlay[class*="skin-shujian"] .gal-name-badge span {
    letter-spacing: inherit;
    text-shadow: none !important;
}
#gal-global-overlay[class*="skin-shujian"] .gal-name-badge.gal-narrator-label {
    background: var(--shu-narrator) !important;
    box-shadow: 0 0.5rem 1.2rem -0.35rem rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(253, 246, 234, 0.25) !important;
}
#gal-global-overlay[class*="skin-shujian"] .gal-name-badge.gal-narrator-label::after {
    border-color: rgba(74, 68, 58, 0.4);
}

/* —— 对话框右上悬浮操作：纸底细线胶囊 —— */
#gal-global-overlay[class*="skin-shujian"] .gal-action-btn,
#gal-global-overlay[class*="skin-shujian"] .gal-action-btn.btn-reroll,
#gal-global-overlay[class*="skin-shujian"] .gal-action-btn.btn-free {
    background: var(--shu-paper) !important;
    color: var(--shu-ink-soft) !important;
    border: 1px solid var(--shu-hairline) !important;
    border-radius: 999px !important;
    box-shadow: 0 0.4rem 0.9rem -0.4rem rgba(15, 10, 5, 0.45) !important;
    font-family: var(--shu-font-serif) !important;
    font-weight: 600 !important;
    letter-spacing: 0.14em !important;
    transition: all 0.22s ease !important;
}
#gal-global-overlay[class*="skin-shujian"] .gal-action-btn:hover {
    background: var(--shu-ink) !important;
    color: var(--shu-on-seal) !important;
    border-color: var(--shu-ink) !important;
    box-shadow: 0 0.5rem 1rem -0.4rem rgba(15, 10, 5, 0.55) !important;
}
#gal-global-overlay[class*="skin-shujian"] .gal-action-btn.btn-free:hover {
    background: var(--shu-vermilion) !important;
    border-color: var(--shu-vermilion) !important;
    color: var(--shu-on-seal) !important;
    box-shadow: 0 0.5rem 1rem -0.4rem var(--shu-glow) !important;
}

/* —— 底部工具栏：安静的衬线文字按钮，悬停划出一条朱线 —— */
#gal-global-overlay[class*="skin-shujian"] .gal-footer-btn {
    background: transparent !important;
    color: var(--shu-ink-soft) !important;
    border: none !important;
    box-shadow: none !important;
    border-radius: 2px !important;
    font-family: var(--shu-font-serif) !important;
    font-weight: 600 !important;
    letter-spacing: 0.1em !important;
    position: relative !important;
}
#gal-global-overlay[class*="skin-shujian"] .gal-footer-btn::after {
    content: "";
    position: absolute;
    left: 0.55rem;
    right: 0.55rem;
    bottom: 0.18rem;
    height: 1px;
    background: var(--shu-vermilion);
    transform: scaleX(0);
    transform-origin: left center;
    transition: transform 0.25s ease;
}
#gal-global-overlay[class*="skin-shujian"] .gal-footer-btn:hover {
    background: transparent !important;
    color: var(--shu-vermilion) !important;
    box-shadow: none !important;
}
#gal-global-overlay[class*="skin-shujian"] .gal-footer-btn:hover::after { transform: scaleX(1); }

/* —— NEXT：朱砂描边胶囊，悬停灌墨 —— */
#gal-global-overlay[class*="skin-shujian"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn-next {
    background: transparent !important;
    color: var(--shu-vermilion) !important;
    border: 1px solid var(--shu-vermilion) !important;
    border-radius: 999px !important;
    clip-path: none !important;
    box-shadow: none !important;
    font-family: var(--shu-font-latin) !important;
    font-style: italic !important;
    font-weight: 600 !important;
    letter-spacing: 0.22em !important;
    font-size: calc(1.05rem * var(--ui-scale, 1)) !important;
    height: calc(2.9rem * var(--ui-scale, 1)) !important;
    min-width: calc(7.5rem * var(--ui-scale, 1)) !important;
    padding: 0 calc(1.9rem * var(--ui-scale, 1)) !important;
    transition: background 0.25s ease, color 0.25s ease !important;
}
#gal-global-overlay[class*="skin-shujian"] .gal-footer-btn-next:hover {
    background: var(--shu-vermilion) !important;
    color: var(--shu-on-seal) !important;
}

/* —— 待选项按钮：朱砂印章脉冲 —— */
#gal-global-overlay[class*="skin-shujian"]:not(.skin-default):not(.skin-default-dark) .gal-pending-choices-btn {
    background: linear-gradient(135deg, var(--shu-vermilion) 0%, var(--shu-vermilion-dk) 100%) !important;
    color: var(--shu-on-seal) !important;
    border: none !important;
    border-radius: 999px !important;
    font-family: var(--shu-font-serif) !important;
    font-weight: 700 !important;
    letter-spacing: 0.12em !important;
}
#gal-global-overlay[class*="skin-shujian"] .gal-pending-choices-btn.show,
#gal-global-overlay[class*="skin-shujian"] .gal-pending-choices-btn.gal-new-option-highlight {
    animation: galShujianSealPulse 2.2s ease-out infinite !important;
}
#gal-global-overlay[class*="skin-shujian"] .gal-pending-choices-btn:hover {
    filter: brightness(1.08) !important;
    box-shadow: 0 0.4rem 1rem -0.3rem var(--shu-glow) !important;
}
@keyframes galShujianSealPulse {
    0% { box-shadow: 0 0 0 0 var(--shu-glow); }
    70% { box-shadow: 0 0 0 0.8rem transparent; }
    100% { box-shadow: 0 0 0 0 transparent; }
}

/* —— 进度条：一根泥金→朱砂的墨线 —— */
#gal-global-overlay[class*="skin-shujian"] .gal-dialog-layer .gal-progress-container {
    background: var(--shu-hairline-soft) !important;
    height: 0.25rem !important;
}
#gal-global-overlay[class*="skin-shujian"] .gal-progress-bar {
    background: linear-gradient(90deg, var(--shu-gold) 0%, var(--shu-vermilion) 100%) !important;
    box-shadow: none !important;
}

/* —— 顶部地点/时间与全屏按钮：半透明幽灵胶囊，几乎不遮画面 —— */
#gal-global-overlay[class*="skin-shujian"] .gal-location-bar,
#gal-global-overlay[class*="skin-shujian"] .gal-time-bar {
    background: rgba(20, 16, 14, 0.28) !important;
    border: 1px solid rgba(244, 236, 220, 0.22) !important;
    border-radius: 999px !important;
    color: #f4ecdc !important;
    font-family: var(--shu-font-serif) !important;
    letter-spacing: 0.16em !important;
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(3px);
}
#gal-global-overlay[class*="skin-shujian"] .gal-location-bar i { color: #e0603f !important; }
#gal-global-overlay[class*="skin-shujian"] .gal-time-bar i { color: #d9b06a !important; }
#gal-global-overlay[class*="skin-shujian"] .gal-fullscreen-btn {
    background: rgba(20, 16, 14, 0.28) !important;
    border: 1px solid rgba(244, 236, 220, 0.35) !important;
    border-radius: 999px !important;
    color: rgba(244, 236, 220, 0.85) !important;
    backdrop-filter: blur(3px);
}
#gal-global-overlay[class*="skin-shujian"] .gal-fullscreen-btn:hover {
    background: var(--shu-vermilion) !important;
    border-color: var(--shu-vermilion) !important;
    color: var(--shu-on-seal) !important;
}

/* —— 立绘显隐 / 状态弹窗小按钮：纸底圆钮 —— */
#gal-global-overlay[class*="skin-shujian"] .gal-sprite-toggle,
#gal-global-overlay[class*="skin-shujian"] .gal-status-popup-trigger {
    background: var(--shu-paper) !important;
    border: 1px solid var(--shu-hairline) !important;
    border-radius: 999px !important;
    box-shadow: 0 0.3rem 0.7rem -0.3rem rgba(15, 10, 5, 0.4) !important;
}
#gal-global-overlay[class*="skin-shujian"] .gal-sprite-toggle .gal-eye-icon,
#gal-global-overlay[class*="skin-shujian"] .gal-status-popup-trigger .gal-status-popup-icon {
    color: var(--shu-vermilion) !important;
}
#gal-global-overlay[class*="skin-shujian"] .gal-sprite-toggle:hover,
#gal-global-overlay[class*="skin-shujian"] .gal-status-popup-trigger:hover {
    background: var(--shu-vermilion) !important;
    border-color: var(--shu-vermilion) !important;
}
#gal-global-overlay[class*="skin-shujian"] .gal-sprite-toggle:hover .gal-eye-icon,
#gal-global-overlay[class*="skin-shujian"] .gal-status-popup-trigger:hover .gal-status-popup-icon {
    color: var(--shu-on-seal) !important;
}

/* —— 生成中指示器：「研墨之中」纸卡 —— */
#gal-global-overlay[class*="skin-shujian"] .gal-generating-indicator {
    background: linear-gradient(178deg, var(--shu-paper) 0%, var(--shu-paper-warm) 100%) !important;
    border: 1px solid var(--shu-hairline) !important;
    border-radius: 4px !important;
    box-shadow: 0 1.8rem 3.5rem -1.4rem rgba(5, 3, 1, 0.7) !important;
}
#gal-global-overlay[class*="skin-shujian"] .gal-generating-indicator .gal-gen-icon { color: var(--shu-vermilion) !important; }
#gal-global-overlay[class*="skin-shujian"] .gal-generating-indicator .gal-gen-text {
    color: var(--shu-ink) !important;
    font-family: var(--shu-font-serif) !important;
    letter-spacing: 0.4em !important;
}
#gal-global-overlay[class*="skin-shujian"] .gal-generating-indicator .gal-gen-status {
    color: var(--shu-ink-soft) !important;
    font-family: var(--shu-font-latin) !important;
    font-style: italic;
    letter-spacing: 0.14em;
}
#gal-global-overlay[class*="skin-shujian"] .gal-generating-indicator .gal-gen-dot { background: var(--shu-vermilion) !important; }

/* —— 选项浮层：纸签 + 汉字序号，悬停朱批（class 由 choices.js 同步）—— */
#gal-layer-choices[class*="skin-shujian"] {
    background: rgba(18, 14, 12, 0.55) !important;
    backdrop-filter: blur(4px) saturate(0.92);
}
#gal-layer-choices[class*="skin-shujian"] .gal-choices-title {
    transform: none;
    font-family: var(--shu-font-serif);
    font-weight: 600;
    color: #f0e9da;
    letter-spacing: 0.5em;
    text-indent: 0.5em;
    text-transform: none;
}
#gal-layer-choices[class*="skin-shujian"] .gal-choices-title span { transform: none; }
#gal-layer-choices[class*="skin-shujian"] .gal-choices-title::after {
    content: "";
    display: block;
    width: 1px;
    height: 1.4rem;
    margin: 0.7rem auto 0;
    background: linear-gradient(var(--shu-vermilion), transparent);
}
#gal-layer-choices[class*="skin-shujian"] .gal-choices-container { counter-reset: shujian-choice; }
#gal-layer-choices[class*="skin-shujian"] .gal-choice-card {
    counter-increment: shujian-choice;
    transform: none;
    display: flex;
    align-items: center;
    gap: 0.9rem;
    text-align: left;
    background: linear-gradient(175deg, var(--shu-paper) 0%, var(--shu-paper-warm) 100%);
    color: var(--shu-ink);
    border: 1px solid var(--shu-hairline);
    border-radius: 3px;
    box-shadow: 0 0.9rem 1.8rem -0.9rem rgba(10, 6, 3, 0.6);
    font-family: var(--shu-font-serif);
    padding: 0.8rem 1.3rem;
}
#gal-layer-choices[class*="skin-shujian"] .gal-choice-card::before {
    content: counter(shujian-choice, cjk-ideographic);
    display: grid;
    place-items: center;
    flex: none;
    width: 1.9rem;
    height: 1.9rem;
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--shu-vermilion);
    border: 1px solid var(--shu-vermilion);
    border-radius: 50%;
    transition: all 0.22s ease;
}
#gal-layer-choices[class*="skin-shujian"] .gal-choice-card span { transform: none; }
#gal-layer-choices[class*="skin-shujian"] .gal-choice-card:hover {
    background: linear-gradient(175deg, var(--shu-paper) 0%, var(--shu-paper-warm) 100%);
    color: var(--shu-ink);
    border-color: var(--shu-vermilion);
    transform: translateY(-2px);
    box-shadow: 0 1.2rem 2.2rem -0.9rem rgba(10, 6, 3, 0.7);
}
#gal-layer-choices[class*="skin-shujian"] .gal-choice-card:hover::before {
    background: var(--shu-vermilion);
    color: var(--shu-on-seal);
}
#gal-layer-choices[class*="skin-shujian"] .gal-choices-hint {
    color: rgba(240, 233, 218, 0.6);
    letter-spacing: 0.3em;
}

/* —— 剧情回顾：册页样式（class 由 history.js 同步）—— */
.gal-history-modal[class*="skin-shujian"] { background: rgba(18, 14, 12, 0.62) !important; }
.gal-history-modal[class*="skin-shujian"] .gal-history-panel {
    background: linear-gradient(178deg, var(--shu-paper) 0%, var(--shu-paper-warm) 100%);
    border: 1px solid var(--shu-hairline);
    border-radius: 4px;
    box-shadow: 0 2.5rem 5rem -1.8rem rgba(5, 3, 1, 0.8);
}
.gal-history-modal[class*="skin-shujian"] .gal-history-header {
    background: transparent;
    color: var(--shu-ink);
    border-bottom: 1px solid var(--shu-hairline);
}
.gal-history-modal[class*="skin-shujian"] .gal-history-title {
    font-family: var(--shu-font-serif);
    letter-spacing: 0.3em;
}
.gal-history-modal[class*="skin-shujian"] .gal-history-title i { color: var(--shu-vermilion); }
.gal-history-modal[class*="skin-shujian"] .gal-history-close { color: var(--shu-ink-soft); }
.gal-history-modal[class*="skin-shujian"] .gal-history-close:hover { color: var(--shu-vermilion); }
.gal-history-modal[class*="skin-shujian"] .gal-history-body { background: transparent; }
.gal-history-modal[class*="skin-shujian"] .gal-history-item {
    background: transparent;
    border: none;
    border-bottom: 1px dashed var(--shu-hairline);
    border-radius: 0;
    box-shadow: none;
}
.gal-history-modal[class*="skin-shujian"] .gal-history-item:hover {
    transform: none;
    box-shadow: none;
    border-color: transparent;
    border-bottom-color: var(--shu-vermilion);
}
.gal-history-modal[class*="skin-shujian"] .gal-history-header-row {
    background: transparent;
    border-bottom: none;
}
.gal-history-modal[class*="skin-shujian"] .gal-history-index {
    color: var(--shu-vermilion);
    border-left: 2px solid var(--shu-vermilion);
    padding-left: 0.5rem;
    font-family: var(--shu-font-serif);
    font-weight: 700;
}
.gal-history-modal[class*="skin-shujian"] .gal-history-time { color: var(--shu-ink-soft); }
.gal-history-modal[class*="skin-shujian"] .gal-history-content {
    color: var(--shu-ink);
    line-height: 1.95;
    font-family: var(--shu-font-serif);
}
.gal-history-modal[class*="skin-shujian"] .gal-history-empty { color: var(--shu-ink-soft); }

/* === 非默认皮肤移动端：设置/LOG 合体菜单适配 === */
@media screen and (max-width: 48rem), screen and (max-height: 46rem) {
    #gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn .gal-btn-text,
    #gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-pending-choices-btn .gal-btn-text,
    #gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn-next .gal-btn-text {
        display: none !important;
    }

    #gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn[data-action='log'],
    #gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn[data-action='view-original'],
    #gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn[data-action='save'],
    #gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn[data-action='load'] {
        display: none !important;
    }

    #gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn[data-action='close-mode'] {
        order: -1 !important;
    }

    #gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-bottom-toolbar {
        justify-content: flex-start !important;
        gap: 0.3rem !important;
        padding: 0 0.875rem 0.5rem 0.5rem !important;
        overflow: visible !important;
    }

    #gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn,
    #gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-pending-choices-btn {
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

    #gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn i,
    #gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-pending-choices-btn i {
        margin: 0 !important;
        font-size: 1.15rem !important;
    }

    #gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn-next {
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

    #gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark) .gal-footer-btn-next i {
        margin: 0 !important;
        font-size: 1.6rem !important;
    }
}

/* === 非默认/非薄暮皮肤移动端：字号与名牌对齐默认皮肤 ===
   顶部全局兜底（1.25rem * --ui-scale * --font-scale）在窄屏因 --ui-scale 塌缩到 ~0.43，
   默认皮肤与薄暮系均有移动端固定 rem 覆盖，此处为其余皮肤补齐同等处理。
   必须位于各皮肤规则之后：墨染/心之怪盗的名牌 transform 与本块同特异性，靠源码顺序取胜。 */
@media screen and (max-width: 48rem) {
    #gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark):not(.skin-twilight) .gal-dialog-text {
        font-size: calc(0.88rem * var(--font-scale, 1)) !important;
    }
    #gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark):not(.skin-twilight) .gal-name-badge {
        transform: scale(0.9) !important;
    }
    /* 墨染/心之怪盗：保留各自名牌旋转角度，仅替换缩放系数 */
    #gal-global-overlay[class*="skin-ancient"]:not(.skin-default):not(.skin-default-dark):not(.skin-twilight) .gal-name-badge {
        transform: rotate(-1.2deg) scale(0.9) !important;
    }
    #gal-global-overlay[class*="skin-persona"]:not(.skin-default):not(.skin-default-dark):not(.skin-twilight) .gal-name-badge {
        transform: rotate(-3.4deg) scale(0.9) !important;
    }
    #gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-default-dark):not(.skin-twilight) .gal-action-btn {
        font-size: 0.95rem !important;
        min-height: 2rem !important;
        padding: 0.5rem 1rem !important;
    }
}

/* === 对话字体最终兜底：始终由设置项控制 === */
@media screen and (max-width: 48rem), screen and (max-height: 46rem) {
    #gal-global-overlay.skin-twilight .gal-footer-btn[data-action='log'],
    #gal-global-overlay.skin-twilight .gal-footer-btn[data-action='view-original'],
    #gal-global-overlay.skin-twilight .gal-footer-btn[data-action='save'],
    #gal-global-overlay.skin-twilight .gal-footer-btn[data-action='load'] {
        display: inline-flex !important;
    }

    #gal-global-overlay.skin-twilight .gal-bottom-toolbar {
        justify-content: stretch !important;
        gap: 2px !important;
        padding: 5px 8px !important;
        overflow: visible !important;
    }

    #gal-global-overlay.skin-twilight .gal-bottom-toolbar .gal-footer-btn,
    #gal-global-overlay.skin-twilight .gal-bottom-toolbar .gal-pending-choices-btn {
        flex: 0 0 auto !important;
    }

    #gal-global-overlay.skin-twilight .gal-footer-btn-next.gal-twilight-mobile-next {
        width: auto !important;
        min-width: 76px !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        z-index: 4 !important;
        display: none !important;
    }

    #gal-global-overlay.skin-twilight .gal-footer-btn-next.gal-twilight-mobile-next .gal-btn-text {
        display: inline !important;
    }

    #gal-global-overlay.skin-twilight .gal-footer-btn-next.gal-twilight-mobile-next i {
        font-size: 0.9rem !important;
    }
}

@media screen and (max-width: 48rem) {
    #gal-global-overlay.skin-twilight[class*="skin-"] .gal-twilight-dialog-layer {
        --ui-scale: 1 !important;
        left: 12px !important;
        right: 12px !important;
        bottom: calc(var(--twilight-footer-height) + env(safe-area-inset-bottom, 0px) + 12px) !important;
        width: auto !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        transform: none !important;
        padding-bottom: 0 !important;
    }

    #gal-global-overlay.skin-twilight .gal-text-panel {
        min-height: 128px !important;
        height: auto !important;
        max-height: none !important;
        padding: 18px 16px 42px !important;
    }

    #gal-global-overlay.skin-twilight[class*="skin-"] .gal-bottom-toolbar {
        left: 12px !important;
        right: 12px !important;
        bottom: calc(env(safe-area-inset-bottom, 0px) + 10px) !important;
        width: auto !important;
        display: grid !important;
        grid-template-columns: repeat(8, minmax(0, 1fr)) !important;
        justify-content: stretch !important;
        gap: 2px !important;
        padding: 5px 8px !important;
        overflow: visible !important;
    }

    #gal-global-overlay.skin-twilight[class*="skin-"] .gal-bottom-toolbar .gal-footer-btn,
    #gal-global-overlay.skin-twilight[class*="skin-"] .gal-bottom-toolbar .gal-pending-choices-btn {
        width: 100% !important;
        min-width: 0 !important;
        height: 30px !important;
        min-height: 30px !important;
        margin: 0 !important;
        padding: 0 !important;
        flex: 0 0 auto !important;
        border-radius: 10px !important;
        background: transparent !important;
        border: 1px solid transparent !important;
        justify-content: center !important;
        box-shadow: none !important;
    }

    #gal-global-overlay.skin-twilight[class*="skin-"] .gal-bottom-toolbar .gal-btn-text {
        display: none !important;
    }

    #gal-global-overlay.skin-twilight[class*="skin-"] .gal-bottom-toolbar i {
        display: block !important;
        margin: 0 !important;
        font-size: 0.82rem !important;
    }
}

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

/* === 对话文本段落排版（所有皮肤通用，用户可在设置中调节） === */
/* color/font 强制继承：防止酒馆主题的全局 span 着色规则污染段落颜色 */
#gal-global-overlay .gal-dialog-text .gal-para {
    display: block;
    color: inherit !important;
    font-family: inherit !important;
    font-size: inherit !important;
    font-weight: inherit !important;
}
#gal-global-overlay .gal-dialog-text .gal-para + .gal-para {
    margin-top: var(--gal-paragraph-gap, 0.6em);
}
/* 引号内对话着色（仅绘本模式，旁白中夹杂的人物台词），可用 --gal-quote-color 覆盖 */
#gal-global-overlay .gal-dialog-text .gal-quote {
    color: var(--gal-quote-color, #e8b04b) !important;
}
/* 用户自定义行距（--gal-dialog-line-height 未设置时回退到皮肤自身 line-height） */
#gal-global-overlay.gal-custom-line-height .gal-dialog-text {
    line-height: var(--gal-dialog-line-height, 1.84) !important;
}
/* 用户自定义头/尾间距（未开启时不写规则，保持皮肤自身 padding） */
#gal-global-overlay.gal-custom-pad-top .gal-dialog-text {
    padding-top: var(--gal-text-pad-top, 0em) !important;
}
#gal-global-overlay.gal-custom-pad-bottom .gal-dialog-text {
    padding-bottom: var(--gal-text-pad-bottom, 0em) !important;
}
`;


  // ============================================
  // Styled 情境内容样式
  // ============================================
  const styledCss = `

/* ═══════════════════════════════════════════════════════════════════
   ▼▼▼ styledCss 电影级重设计本体 ▼▼▼
   概念: 九件真实的「物」，各自携带一场戏。
         入场是揭幕，离场是谢幕，粒子与光是舞台机械。
   ═══════════════════════════════════════════════════════════════════ */

/* === Styled 舞台布局 === */
.gal-styled-stage {
    position: absolute;
    inset: 0;
    z-index: 50;
    display: none;
    align-items: center;
    justify-content: center;
    padding: clamp(16px, 4vw, 44px);
    background: radial-gradient(120% 90% at 50% 8%,
        rgba(6, 8, 14, 0.34) 0%,
        rgba(5, 7, 12, 0.62) 55%,
        rgba(2, 3, 6, 0.84) 100%);
    backdrop-filter: blur(14px) saturate(1.12);
    -webkit-backdrop-filter: blur(14px) saturate(1.12);
    opacity: 0;
    transition: opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1);
    perspective: 1400px;
}
.gal-styled-stage.show { display: flex; opacity: 1; }
.gal-styled-stage.hiding { opacity: 0; pointer-events: none; }

/* 粒子画布（three.js 挂载点，缺席也不影响布局） */
.gal-styled-stage .fx-particles {
    position: absolute; inset: 0;
    pointer-events: none;
}

/* 神光：卡片背后缓转的光轮 */
.gal-styled-stage .fx-rays {
    position: absolute; left: 50%; top: 50%;
    width: 160vmin; height: 160vmin;
    margin: -80vmin 0 0 -80vmin;
    pointer-events: none;
    background: repeating-conic-gradient(from 0deg,
        transparent 0deg 14deg,
        color-mix(in srgb, var(--fx-accent, #4D9FFF) 7%, transparent) 17deg 21deg,
        transparent 24deg 36deg);
    -webkit-mask-image: radial-gradient(circle, #000 0%, transparent 62%);
    mask-image: radial-gradient(circle, #000 0%, transparent 62%);
    animation: fxRaysSpin 60s linear infinite;
    opacity: 0.75;
    transition: opacity 1s ease;
    mix-blend-mode: screen;
}
@keyframes fxRaysSpin { to { transform: rotate(360deg); } }

/* 白闪（报纸落版 / 印章砸落等冲击帧） */
.gal-styled-stage .fx-flash {
    position: absolute; inset: 0; pointer-events: none;
    background: #FFF;
    opacity: 0; z-index: 60;
}
.gal-styled-stage .fx-flash.go { animation: fxFlash 0.5s ease-out both; }
@keyframes fxFlash {
    0% { opacity: 0; } 8% { opacity: 0.85; } 100% { opacity: 0; }
}

/* 内容容器：承载鼠标视差 */
.gal-styled-stage-content {
    width: 100%;
    max-width: 640px;
    max-height: 86vh;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    z-index: 51;
    perspective: 1200px;
    overflow: visible;
    transform: rotateY(calc(var(--par-x, 0) * 1deg)) rotateX(calc(var(--par-y, 0) * -1deg));
    transform-style: preserve-3d;
    transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

/* === Styled 通用基础 === */
.gal-dialog-text .gal-styled,
.gal-styled-stage-content .gal-styled {
    width: 100%;
    box-sizing: border-box;
    font-size: 1rem;
    line-height: 1.7;
    transform-origin: 50% 62%;
    will-change: transform, opacity, filter;
}
/* 绘本模式内联回退：仍走通用浮起 */
.gal-dialog-text .gal-styled { animation: gal-styled-pop 0.9s cubic-bezier(0.19, 1.25, 0.27, 1) both; }
@keyframes gal-styled-pop {
    from { opacity: 0; transform: translateY(60px) scale(0.9); filter: blur(10px); }
    to   { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}
@keyframes gal-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
    .gal-styled-stage *, .gal-styled-stage-content .gal-styled,
    .gal-styled-stage .fx-rays { animation: none !important; transition: none !important; }
}
/* 细滚动条 */
.gal-styled *::-webkit-scrollbar, .gal-styled::-webkit-scrollbar { width: 5px; height: 5px; }
.gal-styled *::-webkit-scrollbar-thumb, .gal-styled::-webkit-scrollbar-thumb { background: rgba(125,125,135,0.35); border-radius: 99px; }
.gal-styled *::-webkit-scrollbar-track, .gal-styled::-webkit-scrollbar-track { background: transparent; }

/* =========================================================
   1. 手机短信 (SMS) — Frosted OS Dark
   ========================================================= */
.gal-styled-stage-content .gal-styled-sms {
    background: rgba(22, 24, 31, 0.86) !important;
    backdrop-filter: blur(28px) saturate(1.5);
    -webkit-backdrop-filter: blur(28px) saturate(1.5);
    border: 1px solid rgba(255, 255, 255, 0.11);
    border-radius: 28px;
    padding: 0;
    overflow: hidden;
    max-height: 76vh;
    display: flex;
    flex-direction: column;
    box-shadow:
        0 34px 68px -18px rgba(0, 0, 0, 0.65),
        0 2px 6px rgba(0, 0, 0, 0.35),
        0 0 44px -8px rgba(61, 139, 255, 0.35),
        inset 0 1px 0 rgba(255, 255, 255, 0.12);
    width: 100%; max-width: 390px;
    font-family: "Noto Sans SC", -apple-system, "PingFang SC", sans-serif;
    position: relative;
}
.gal-sms-header {
    background: linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02));
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    color: #F4F5F7;
    padding: 16px 20px 13px;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 1rem; flex-shrink: 0; position: relative;
}
.gal-sms-header::before {
    content: ''; position: absolute; top: 7px; left: 50%; transform: translateX(-50%);
    width: 52px; height: 4px; border-radius: 99px;
    background: rgba(255, 255, 255, 0.16);
}
.gal-sms-contact {
    font-weight: 700; letter-spacing: 0.03em; padding-top: 5px;
    display: flex; align-items: center; gap: 8px;
}
.gal-sms-contact::before {
    content: ''; width: 8px; height: 8px; border-radius: 50%;
    background: #34D399; box-shadow: 0 0 8px rgba(52, 211, 153, 0.8);
    flex-shrink: 0;
    animation: gal-blink 2.4s ease infinite;
}
.gal-sms-time {
    font-size: 0.74rem; color: rgba(235, 235, 245, 0.45);
    font-weight: 500; letter-spacing: 0.04em; padding-top: 5px;
    font-variant-numeric: tabular-nums;
}
.gal-sms-body {
    padding: 20px 16px 22px;
    display: flex; flex-direction: column; gap: 10px;
    overflow-y: auto; flex: 1; background: transparent;
    min-height: 180px;
}
.gal-sms-row { display: flex; flex-direction: column; max-width: 82%; }
.gal-sms-row-other { align-self: flex-start; align-items: flex-start; }
.gal-sms-row-self { align-self: flex-end; align-items: flex-end; }
.gal-sms-name {
    font-size: 0.7rem; color: rgba(235, 235, 245, 0.42);
    margin: 2px 0 5px; padding-left: 14px; letter-spacing: 0.05em;
}
.gal-sms-bubble-other, .gal-sms-bubble-self {
    padding: 10px 15px; border-radius: 19px; font-size: 0.94rem;
    line-height: 1.5; word-break: break-word;
}
.gal-sms-bubble-other {
    background: rgba(255, 255, 255, 0.10);
    border: 1px solid rgba(255, 255, 255, 0.07);
    color: #F0F1F4;
    border-bottom-left-radius: 6px;
}
.gal-sms-bubble-self {
    background: linear-gradient(135deg, #3D8BFF 0%, #2E6BFF 100%);
    color: #fff;
    border-bottom-right-radius: 6px;
    box-shadow: 0 4px 14px -4px rgba(46, 107, 255, 0.55);
}
/* JS 编排：行初始隐藏，逐条揭示 */
.gal-styled-sms .gal-sms-row.hide { opacity: 0; }
.gal-styled-sms .gal-sms-row.pop [class*="gal-sms-bubble"] {
    animation: gal-sms-bubble-in 0.4s cubic-bezier(0.22, 1.4, 0.36, 1) both;
}
@keyframes gal-sms-bubble-in {
    from { opacity: 0; transform: translateY(16px) scale(0.7); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
}
/* 正在输入…指示气泡（demo/接入均由 JS 插入） */
.gal-sms-typing {
    align-self: flex-start;
    background: rgba(255, 255, 255, 0.10);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 19px; border-bottom-left-radius: 6px;
    padding: 12px 16px; display: inline-flex; gap: 5px;
    animation: gal-sms-bubble-in 0.25s ease both;
}
.gal-sms-typing i {
    width: 7px; height: 7px; border-radius: 50%;
    background: rgba(235, 235, 245, 0.65);
    animation: galTypingDot 1s ease-in-out infinite;
}
.gal-sms-typing i:nth-child(2) { animation-delay: 0.16s; }
.gal-sms-typing i:nth-child(3) { animation-delay: 0.32s; }
@keyframes galTypingDot {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
    30% { transform: translateY(-5px); opacity: 1; }
}

/* =========================================================
   2. 信纸 (Letter) — Warm Stationery
   ========================================================= */
.gal-styled-stage-content .gal-styled-letter {
    --letter-line: 30px;
    background:
        linear-gradient(90deg, transparent 46px, rgba(214, 126, 126, 0.5) 46px, rgba(214, 126, 126, 0.5) 47.5px, transparent 47.5px),
        radial-gradient(140% 100% at 20% 0%, #FFFDF7 0%, #FBF4E4 70%, #F6EBD5 100%);
    border-radius: 3px 3px 5px 5px;
    padding: 54px 44px 40px 66px !important;
    position: relative;
    box-shadow:
        0 1px 2px rgba(70, 50, 20, 0.12),
        0 12px 28px -8px rgba(60, 40, 15, 0.30),
        0 36px 70px -24px rgba(0, 0, 0, 0.45);
    max-height: 80vh; overflow-y: auto;
    width: 100%; max-width: 560px;
}
.gal-styled-stage-content .gal-styled-letter::after {
    content: '✦';
    position: absolute; top: 16px; right: 22px;
    width: 44px; height: 52px;
    display: flex; align-items: center; justify-content: center;
    color: rgba(178, 108, 108, 0.85); font-size: 1rem;
    background: linear-gradient(160deg, rgba(214, 126, 126, 0.13), rgba(214, 126, 126, 0.05));
    border: 1px dashed rgba(178, 108, 108, 0.5);
    border-radius: 2px;
    transform: rotate(4deg);
    pointer-events: none;
}
.gal-letter-header {
    display: flex; justify-content: space-between; align-items: baseline;
    gap: 16px; margin-bottom: 26px; padding-right: 52px;
    position: relative; z-index: 1;
}
.gal-letter-to {
    font-weight: 700; color: #4A3B2E; font-size: 1.25rem;
    font-family: "LXGW WenKai Screen", "KaiTi", "STKaiti", cursive;
    letter-spacing: 0.06em;
}
.gal-letter-date {
    font-size: 0.85rem; color: #A08B72; font-style: italic;
    letter-spacing: 0.05em; white-space: nowrap;
}
.gal-letter-body { position: relative; z-index: 1; }
.gal-letter-line {
    margin: 0;
    min-height: var(--letter-line);
    line-height: var(--letter-line);
    text-indent: 2em; color: #4E4234;
    font-family: "LXGW WenKai Screen", "KaiTi", "STKaiti", cursive;
    font-size: 1.06rem; letter-spacing: 0.045em;
    background-image: repeating-linear-gradient(180deg,
        transparent 0, transparent calc(var(--letter-line) - 1px),
        rgba(96, 116, 160, 0.18) calc(var(--letter-line) - 1px), rgba(96, 116, 160, 0.18) var(--letter-line));
}
.gal-letter-signature {
    display: flex; align-items: center; justify-content: flex-end; gap: 12px;
    margin-top: 30px; color: #4A3B2E;
    font-weight: 700;
    font-family: "LXGW WenKai Screen", "KaiTi", "STKaiti", cursive;
    font-size: 1.2rem; letter-spacing: 0.08em;
    position: relative; z-index: 1;
}
.gal-letter-signature::after {
    content: '緘';
    width: 40px; height: 40px; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: 50%;
    color: rgba(255, 244, 235, 0.92); font-size: 0.9rem; font-weight: 700;
    background: radial-gradient(circle at 32% 28%, #C86060 0%, #A63838 55%, #7E2424 100%);
    box-shadow:
        inset 0 2px 3px rgba(255, 255, 255, 0.3),
        inset 0 -3px 5px rgba(60, 10, 10, 0.55),
        0 3px 7px rgba(126, 36, 36, 0.4);
    transform: rotate(-6deg);
}

/* =========================================================
   3. 羊皮纸 (Parchment) — Aged Vellum
   ========================================================= */
.gal-styled-stage-content .gal-styled-parchment {
    background:
        radial-gradient(120% 90% at 50% 0%, rgba(120, 86, 40, 0) 55%, rgba(96, 62, 24, 0.32) 100%),
        radial-gradient(circle at 12% 18%, rgba(126, 94, 46, 0.16) 0%, transparent 34%),
        radial-gradient(circle at 86% 78%, rgba(126, 94, 46, 0.20) 0%, transparent 42%),
        radial-gradient(circle at 62% 30%, rgba(255, 240, 200, 0.32) 0%, transparent 46%),
        linear-gradient(140deg, #E9D3A4 0%, #DFC28C 48%, #D2B075 100%);
    border-radius: 10px 16px 8px 18px / 14px 8px 16px 10px;
    padding: 44px 52px 40px !important;
    position: relative;
    box-shadow:
        0 26px 52px -14px rgba(20, 12, 4, 0.6),
        0 3px 9px rgba(20, 12, 4, 0.3),
        0 0 46px -8px rgba(255, 179, 71, 0.3),
        inset 0 0 72px rgba(110, 72, 28, 0.35),
        inset 0 0 14px rgba(80, 46, 14, 0.4);
    max-height: 80vh; overflow-y: auto;
    width: 100%; max-width: 580px;
}
.gal-styled-stage-content .gal-styled-parchment::before {
    content: ''; position: absolute;
    top: 14px; left: 14px; right: 14px; bottom: 14px;
    border: 1px solid rgba(110, 72, 28, 0.55);
    outline: 1px solid rgba(110, 72, 28, 0.22);
    outline-offset: 3px;
    border-radius: 6px 10px 5px 12px;
    pointer-events: none;
}
.gal-parchment-title {
    text-align: center; font-family: "Noto Serif SC", "KaiTi", "STKaiti", serif;
    font-size: 1.7rem; font-weight: 900; color: #433012;
    margin-bottom: 24px; padding-bottom: 16px;
    letter-spacing: 0.28em; text-indent: 0.28em;
    text-shadow: 0 1px 0 rgba(255, 246, 220, 0.55);
    position: relative; z-index: 1;
}
.gal-parchment-title::after {
    content: '';
    position: absolute; left: 50%; bottom: 0; transform: translateX(-50%);
    width: 168px; height: 7px;
    background:
        radial-gradient(circle at 50% 50%, rgba(122, 42, 42, 0.9) 0 2.6px, transparent 3px),
        linear-gradient(90deg, transparent, rgba(96, 62, 24, 0.75) 18%, rgba(96, 62, 24, 0.75) 82%, transparent) 50% 50% / 100% 1px no-repeat;
}
.gal-parchment-body { position: relative; z-index: 1; }
.gal-parchment-line {
    margin: 0 0 11px; text-indent: 2em; color: #3E2C10;
    font-family: "Noto Serif SC", "KaiTi", "STKaiti", serif;
    font-size: 1.08rem; line-height: 1.95;
    text-shadow: 0 1px 0 rgba(255, 246, 220, 0.3);
    font-weight: 600;
}
.gal-parchment-line:first-of-type::first-letter {
    font-size: 2.3em; line-height: 1; font-weight: 900;
    color: #7A2A2A; padding-right: 2px;
}
.gal-parchment-seal {
    display: flex; align-items: center; justify-content: center; gap: 14px;
    text-align: center; margin-top: 28px;
    color: #7A2A2A; font-family: "Noto Serif SC", "KaiTi", "STKaiti", serif;
    font-weight: 900; font-size: 1.3rem; letter-spacing: 0.42em; text-indent: 0.42em;
    position: relative; z-index: 1; opacity: 0.92;
}
.gal-parchment-seal::before, .gal-parchment-seal::after {
    content: ''; width: 44px; height: 1px; flex-shrink: 0;
    background: linear-gradient(90deg, transparent, rgba(122, 42, 42, 0.6));
}
.gal-parchment-seal::after { background: linear-gradient(270deg, transparent, rgba(122, 42, 42, 0.6)); }

/* 卷轴木轴（demo 由 JS 注入 .fx-roller 于舞台层） */
.fx-roller {
    position: absolute; left: 50%; transform: translateX(-50%);
    width: min(640px, 92%); height: 26px;
    border-radius: 13px;
    background: linear-gradient(180deg, #8A5A2B 0%, #5C3714 45%, #3E230B 100%);
    box-shadow:
        0 4px 12px rgba(0,0,0,0.6),
        inset 0 2px 2px rgba(255, 220, 160, 0.35);
    z-index: 55; pointer-events: none;
}
.fx-roller::before, .fx-roller::after {
    content: ''; position: absolute; top: 50%; transform: translateY(-50%);
    width: 30px; height: 34px; border-radius: 8px;
    background: radial-gradient(circle at 40% 35%, #C9A06A, #6B4520 70%);
    box-shadow: 0 3px 8px rgba(0,0,0,0.5);
}
.fx-roller::before { left: -18px; }
.fx-roller::after { right: -18px; }


/* =========================================================
   4. 新闻 (Newspaper) — Broadsheet Ink
   ========================================================= */
.gal-styled-stage-content .gal-styled-newspaper {
    background:
        radial-gradient(100% 70% at 50% 0%, rgba(255, 255, 250, 0.65) 0%, transparent 60%),
        #F1EBDB;
    border-radius: 2px;
    padding: 22px 28px 26px !important;
    position: relative;
    box-shadow:
        0 2px 4px rgba(24, 20, 12, 0.18),
        0 22px 48px -16px rgba(0, 0, 0, 0.55);
    max-height: 82vh; overflow-y: auto;
    color: #1C1B17;
    width: 100%; max-width: 660px;
    --gal-styled-rot: -0.5deg;
    transform: rotate(var(--gal-styled-rot));
}
.gal-styled-stage-content .gal-styled-newspaper::before {
    content: 'DAILY · EXTRA EDITION · 号外';
    display: block; text-align: center;
    font-family: "JetBrains Mono", "Noto Serif SC", monospace;
    font-size: 0.62rem; letter-spacing: 0.42em; text-indent: 0.42em;
    color: #524E42;
    padding-bottom: 8px; margin-bottom: 12px;
    border-bottom: 1px solid #1C1B17;
}
/* 半调网点质感 */
.gal-styled-stage-content .gal-styled-newspaper::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background-image: radial-gradient(rgba(28, 27, 23, 0.14) 1px, transparent 1.4px);
    background-size: 5px 5px;
    mix-blend-mode: multiply; opacity: 0.35;
}
.gal-newspaper-headline {
    font-family: "Noto Serif SC", "Georgia", "Times New Roman", serif;
    font-size: 2.1rem; font-weight: 900; color: #14130F; text-align: center;
    margin: 0 0 14px; line-height: 1.25; letter-spacing: 0.06em;
    padding-bottom: 14px;
    border-bottom: 4px double #14130F;
}
.gal-newspaper-meta {
    display: flex; justify-content: space-between; align-items: center;
    padding: 7px 2px; border-bottom: 1px solid #14130F;
    border-top: 1px solid rgba(20, 19, 15, 0.35);
    margin-bottom: 16px; font-size: 0.78rem; color: #3C3A32;
    font-family: "Noto Serif SC", serif; letter-spacing: 0.1em;
}
.gal-newspaper-source { font-weight: 900; }
.gal-newspaper-date { font-weight: 500; font-variant-numeric: tabular-nums; }
.gal-newspaper-body {
    columns: 2; column-gap: 26px;
    column-rule: 1px solid rgba(20, 19, 15, 0.25);
    text-align: justify; hyphens: auto;
}
.gal-newspaper-paragraph {
    margin: 0 0 12px; text-indent: 2em; color: #26241E;
    font-family: "Noto Serif SC", "Georgia", "Times New Roman", serif;
    font-size: 0.93rem; line-height: 1.75;
}
.gal-newspaper-paragraph:first-of-type::first-letter {
    font-size: 3.1rem; line-height: 0.85; float: left; margin: 4px 8px 0 0;
    font-weight: 900; color: #14130F; font-family: "Noto Serif SC", "Georgia", serif;
}
@media (max-width: 560px) {
    .gal-newspaper-body { columns: 1; }
    .gal-newspaper-headline { font-size: 1.6rem; }
}

/* =========================================================
   5. 终端 (Terminal) — Phosphor CRT
   ========================================================= */
.gal-styled-stage-content .gal-styled-terminal {
    background:
        linear-gradient(180deg, rgba(16, 22, 18, 0.5), rgba(6, 10, 8, 0.5)),
        rgba(7, 11, 9, 0.94) !important;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(84, 214, 126, 0.18);
    border-radius: 12px;
    overflow: hidden;
    max-height: 72vh;
    display: flex; flex-direction: column;
    box-shadow:
        0 30px 60px -14px rgba(0, 0, 0, 0.75),
        0 0 42px -10px rgba(64, 210, 120, 0.35),
        inset 0 1px 0 rgba(255, 255, 255, 0.07);
    font-family: "JetBrains Mono", "Cascadia Code", "Fira Code", "Consolas", monospace;
    width: 100%; max-width: 620px;
    position: relative;
}
.gal-styled-stage-content .gal-styled-terminal::after {
    content: ''; position: absolute; inset: 0;
    background: repeating-linear-gradient(180deg,
        rgba(0, 0, 0, 0) 0px, rgba(0, 0, 0, 0) 2px,
        rgba(0, 0, 0, 0.14) 2px, rgba(0, 0, 0, 0.14) 3px);
    pointer-events: none; z-index: 2;
    mix-blend-mode: multiply;
}
.gal-terminal-titlebar {
    background: rgba(255, 255, 255, 0.035);
    border-bottom: 1px solid rgba(84, 214, 126, 0.14);
    padding: 11px 15px;
    display: flex; align-items: center; gap: 10px;
    position: relative; z-index: 3;
}
.gal-terminal-dots { display: flex; gap: 7px; }
.gal-terminal-dots i { width: 11px; height: 11px; border-radius: 50%; }
.gal-terminal-dots i:nth-child(1) { background: #FF5F57; box-shadow: 0 0 6px rgba(255, 95, 87, 0.6); }
.gal-terminal-dots i:nth-child(2) { background: #FEBC2E; box-shadow: 0 0 6px rgba(254, 188, 46, 0.6); }
.gal-terminal-dots i:nth-child(3) { background: #28C840; box-shadow: 0 0 6px rgba(40, 200, 64, 0.6); }
.gal-terminal-title {
    color: rgba(160, 230, 180, 0.55); font-size: 0.78rem;
    text-align: center; flex: 1; margin-right: 47px;
    letter-spacing: 0.12em;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.gal-terminal-body {
    padding: 20px 22px 22px; overflow-y: auto; flex: 1;
    position: relative; z-index: 1;
    min-height: 190px;
    background: radial-gradient(110% 90% at 50% 0%, rgba(64, 210, 120, 0.05) 0%, transparent 62%);
}
.gal-terminal-line {
    color: #7BE39A; font-size: 0.88rem; line-height: 1.72; margin-bottom: 5px;
    text-shadow: 0 0 6px rgba(90, 220, 140, 0.45);
    word-break: break-word;
}
.gal-terminal-line.fx-glitch {
    animation: galTermGlitch 0.14s steps(2) both;
}
@keyframes galTermGlitch {
    0% { transform: translateX(-3px) skewX(-6deg); text-shadow: -3px 0 #FF3B6B, 3px 0 #37D5FF; }
    50% { transform: translateX(3px) skewX(4deg); text-shadow: 3px 0 #FF3B6B, -3px 0 #37D5FF; }
    100% { transform: none; }
}
.gal-terminal-prompt {
    color: #59B8FF; font-weight: 700;
    text-shadow: 0 0 6px rgba(89, 184, 255, 0.5);
}
.gal-terminal-cursor {
    display: inline-block;
    width: 0.62em; height: 1.05em;
    background: #7BE39A;
    box-shadow: 0 0 8px rgba(90, 220, 140, 0.8);
    color: transparent;
    vertical-align: text-bottom;
    animation: gal-blink 1.06s step-end infinite;
}

/* =========================================================
   6. 便签 (Sticky Note) — Paper & Tape
   ========================================================= */
.gal-styled-stage-content .gal-styled-note {
    --note-line: 34px;
    background: linear-gradient(148deg, #FFF4B8 0%, #FFEC9C 58%, #F7DD80 100%);
    border-radius: 2px 3px 26px 3px / 2px 3px 22px 3px;
    padding: 46px 28px 24px !important;
    position: relative;
    box-shadow:
        0 1px 2px rgba(90, 70, 20, 0.16),
        0 14px 30px -10px rgba(60, 45, 10, 0.42),
        inset 0 -18px 24px -18px rgba(146, 118, 60, 0.35);
    --gal-styled-rot: -2.2deg;
    transform: rotate(var(--gal-styled-rot));
    transform-origin: 50% 0;
    overflow: visible;
    width: 100%; max-width: 340px;
}
.gal-styled-note .gal-note-body { max-height: 48vh; overflow-y: auto; }
.gal-styled-stage-content .gal-styled-note::before {
    content: ''; position: absolute;
    top: -13px; left: 50%;
    width: 112px; height: 30px;
    background:
        repeating-linear-gradient(45deg,
            rgba(255, 255, 255, 0) 0 7px,
            rgba(255, 255, 255, 0.35) 7px 14px),
        rgba(214, 182, 186, 0.62);
    box-shadow: 0 2px 5px rgba(60, 45, 10, 0.18);
    z-index: 2;
    transform: translateX(-50%) rotate(2.6deg);
    -webkit-mask: linear-gradient(90deg, transparent 0, #000 5%, #000 95%, transparent 100%);
    mask: linear-gradient(90deg, transparent 0, #000 5%, #000 95%, transparent 100%);
}
.gal-styled-stage-content .gal-styled-note::after {
    content: ''; position: absolute;
    right: 0; bottom: 0;
    width: 34px; height: 34px;
    background: linear-gradient(315deg, transparent 48%, rgba(200, 168, 90, 0.55) 50%, #FFF2AC 54%, #FFF8CE 100%);
    border-radius: 0 0 24px 0;
    box-shadow: -3px -3px 6px -2px rgba(90, 70, 20, 0.22);
    pointer-events: none;
}
.gal-note-line {
    margin: 0; min-height: var(--note-line); line-height: var(--note-line);
    color: #4B3A20;
    font-family: "LXGW WenKai Screen", "Comic Sans MS", cursive;
    font-size: 1.12rem; font-weight: 600;
    letter-spacing: 0.03em;
    background-image: repeating-linear-gradient(180deg,
        transparent 0, transparent calc(var(--note-line) - 1px),
        rgba(146, 118, 60, 0.22) calc(var(--note-line) - 1px), rgba(146, 118, 60, 0.22) var(--note-line));
}
.gal-note-sign {
    text-align: right; margin-top: 18px; padding-right: 20px; color: #6B532C;
    font-family: "LXGW WenKai Screen", cursive;
    font-style: italic; font-size: 1rem; font-weight: 700;
}

/* =========================================================
   7. 日记 (Diary) — Linen Journal
   ========================================================= */
.gal-styled-stage-content .gal-styled-diary {
    --diary-line: 32px;
    background: linear-gradient(120deg, #FCF9F2 0%, #F7F1E4 100%);
    border: 1px solid rgba(150, 132, 108, 0.4);
    border-left: 22px solid #4E5D4A;
    border-radius: 5px 14px 14px 5px;
    padding: 26px 34px 28px 28px !important;
    position: relative;
    box-shadow:
        0 24px 48px -14px rgba(30, 24, 14, 0.5),
        0 3px 8px rgba(30, 24, 14, 0.2),
        inset 6px 0 12px -6px rgba(30, 24, 14, 0.28);
    overflow: visible;
    width: 100%; max-width: 500px;
    transform-origin: 0 50%;
}
.gal-styled-diary .gal-diary-body { max-height: 54vh; overflow-y: auto; }
.gal-styled-stage-content .gal-styled-diary::before {
    content: ''; position: absolute;
    top: 12px; bottom: 12px; left: -14px;
    width: 2px;
    background: repeating-linear-gradient(180deg,
        rgba(252, 249, 242, 0.85) 0 7px,
        transparent 7px 15px);
    pointer-events: none; z-index: 2;
    border-radius: 2px;
}
.gal-styled-stage-content .gal-styled-diary::after {
    content: ''; position: absolute;
    top: -6px; right: 34px;
    width: 22px; height: 72px;
    background: linear-gradient(180deg, #B4543E 0%, #9E4230 100%);
    clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 84%, 0 100%);
    box-shadow: 0 4px 8px -2px rgba(120, 40, 20, 0.5);
    z-index: 2;
    transform-origin: 50% 0;
    animation: galRibbonSway 5s ease-in-out infinite;
}
@keyframes galRibbonSway {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(2.5deg); }
}
.gal-diary-header {
    display: flex; justify-content: space-between; align-items: flex-end;
    gap: 14px; margin-bottom: 22px; padding: 0 0 12px;
    border-bottom: 2px solid rgba(78, 93, 74, 0.75);
    position: relative; z-index: 1;
}
.gal-diary-date {
    font-family: "LXGW WenKai Screen", "KaiTi", cursive;
    font-weight: 700; color: #35402F; font-size: 1.22rem;
    letter-spacing: 0.05em;
    display: flex; align-items: center; gap: 9px;
}
.gal-diary-date::before {
    content: ''; width: 9px; height: 9px; border-radius: 50% 46% 52% 48%;
    background: #B4543E; flex-shrink: 0;
    transform: rotate(12deg);
}
.gal-diary-mood {
    font-size: 0.95rem; color: #7A7260; font-style: italic; font-weight: 600;
    padding-right: 52px;
}
.gal-diary-body { position: relative; z-index: 1; }
.gal-diary-line {
    margin: 0; min-height: var(--diary-line); line-height: var(--diary-line);
    text-indent: 1.5em; color: #3B3226;
    font-family: "LXGW WenKai Screen", "KaiTi", cursive;
    font-size: 1.06rem; letter-spacing: 0.02em;
    background-image: repeating-linear-gradient(180deg,
        transparent 0, transparent calc(var(--diary-line) - 1px),
        rgba(150, 132, 108, 0.22) calc(var(--diary-line) - 1px), rgba(150, 132, 108, 0.22) var(--diary-line));
}
/* 手写显现：入场时逐行从左到右揭开 */
.gal-styled-diary.entering .gal-diary-line { animation: galInkReveal 0.9s ease-out both; }
.gal-styled-diary.entering .gal-diary-line:nth-child(1) { animation-delay: 0.9s; }
.gal-styled-diary.entering .gal-diary-line:nth-child(2) { animation-delay: 1.25s; }
.gal-styled-diary.entering .gal-diary-line:nth-child(3) { animation-delay: 1.6s; }
.gal-styled-diary.entering .gal-diary-line:nth-child(4) { animation-delay: 1.95s; }
.gal-styled-diary.entering .gal-diary-line:nth-child(n+5) { animation-delay: 2.3s; }
@keyframes galInkReveal {
    from { clip-path: inset(0 100% 0 0); }
    to   { clip-path: inset(0 0 0 0); }
}

/* =========================================================
   8. 公告 (Bulletin) — Civic Notice
   ========================================================= */
.gal-styled-stage-content .gal-styled-bulletin {
    background: linear-gradient(180deg, #FFFFFF 0%, #FBF9F4 100%);
    border: 1px solid rgba(60, 50, 40, 0.14);
    border-top: none;
    border-radius: 8px;
    padding: 0 !important;
    overflow: hidden;
    max-height: 80vh;
    display: flex; flex-direction: column;
    box-shadow:
        0 26px 52px -16px rgba(10, 8, 6, 0.5),
        0 2px 6px rgba(10, 8, 6, 0.18);
    width: 100%; max-width: 560px;
    position: relative;
    transform-origin: 50% 0;
}
.gal-styled-stage-content .gal-styled-bulletin::before {
    content: ''; display: block; flex-shrink: 0;
    height: 10px;
    background: linear-gradient(90deg, #B3271E 0%, #D03A2B 50%, #B3271E 100%);
    box-shadow: inset 0 -2px 3px rgba(90, 12, 8, 0.4);
}
.gal-bulletin-header {
    background: transparent;
    color: #B3271E;
    padding: 24px 24px 14px;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 8px;
    position: relative;
    flex-shrink: 0;
}
.gal-bulletin-header::after {
    content: ''; position: absolute;
    left: 24px; right: 24px; bottom: 0;
    height: 5px;
    border-top: 3px solid #B3271E;
    border-bottom: 1px solid #B3271E;
}
.gal-bulletin-icon {
    font-size: 1.5rem;
    filter: grayscale(0.15) drop-shadow(0 2px 3px rgba(179, 39, 30, 0.25));
}
.gal-bulletin-title {
    font-weight: 900; font-size: 1.55rem;
    letter-spacing: 0.34em; text-indent: 0.34em;
    font-family: "Noto Serif SC", "SimSun", serif;
    text-align: center; line-height: 1.35;
}
.gal-bulletin-meta {
    display: flex; justify-content: space-between; gap: 12px;
    padding: 12px 26px;
    font-size: 0.85rem; color: #6E655A; font-weight: 600;
    border-bottom: 1px dashed rgba(110, 101, 90, 0.35);
    font-family: "Noto Serif SC", serif;
    letter-spacing: 0.06em;
    flex-shrink: 0;
}
.gal-bulletin-body {
    padding: 24px 30px 26px; overflow-y: auto;
    position: relative;
}
.gal-bulletin-body::after {
    content: '公 示';
    margin: 18px 6px 0 auto; width: 84px; height: 84px;
    display: flex; align-items: center; justify-content: center;
    border: 3px solid rgba(179, 39, 30, 0.5);
    border-radius: 50%;
    color: rgba(179, 39, 30, 0.58);
    font-family: "Noto Serif SC", "SimSun", serif;
    font-weight: 900; font-size: 1.15rem; letter-spacing: 0.3em; text-indent: 0.3em;
    transform: rotate(-14deg);
    pointer-events: none;
}
/* 印章砸落 */
.gal-styled-bulletin.entering .gal-bulletin-body::after {
    animation: galSealSlam 0.55s cubic-bezier(0.34, 1.2, 0.64, 1) 1s both;
}
@keyframes galSealSlam {
    0%  { opacity: 0; transform: rotate(-30deg) scale(5); filter: blur(4px); }
    62% { opacity: 1; transform: rotate(-14deg) scale(0.94); filter: blur(0); }
    80% { transform: rotate(-14deg) scale(1.05); }
    100%{ opacity: 1; transform: rotate(-14deg) scale(1); }
}
.gal-bulletin-line {
    margin: 0 0 14px; text-indent: 2em; color: #2E2A24;
    font-size: 1.04rem; line-height: 1.9; font-weight: 500;
    font-family: "Noto Serif SC", "SimSun", serif;
}

/* =========================================================
   9. 回退 (Fallback) — Hologram
   ========================================================= */
.gal-styled-stage-content .gal-styled-fallback {
    background:
        linear-gradient(115deg,
            rgba(109, 240, 255, 0.10) 0%,
            rgba(24, 26, 33, 0.9) 28%,
            rgba(24, 26, 33, 0.9) 72%,
            rgba(190, 120, 255, 0.10) 100%),
        rgba(20, 22, 30, 0.85);
    backdrop-filter: blur(20px) saturate(1.4);
    -webkit-backdrop-filter: blur(20px) saturate(1.4);
    border: 1px solid rgba(109, 240, 255, 0.35);
    border-radius: 18px; padding: 26px 30px !important;
    color: #EDF6F8;
    box-shadow:
        0 30px 60px -18px rgba(0, 0, 0, 0.65),
        0 0 46px -8px rgba(109, 240, 255, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.14);
    position: relative;
    overflow: hidden;
}
/* 全息扫光 */
.gal-styled-stage-content .gal-styled-fallback::after {
    content: ''; position: absolute; inset: -60% -20%;
    background: linear-gradient(105deg,
        transparent 42%, rgba(160, 250, 255, 0.16) 49%,
        rgba(255, 255, 255, 0.26) 50%,
        rgba(160, 250, 255, 0.16) 51%, transparent 58%);
    animation: galHoloSheen 3.6s ease-in-out infinite;
    pointer-events: none;
}
@keyframes galHoloSheen {
    0%, 100% { transform: translateX(-38%); }
    50% { transform: translateX(38%); }
}
.gal-styled-fallback-title {
    font-weight: 800; margin-bottom: 16px; font-size: 1.25rem;
    letter-spacing: 0.1em;
    color: #A9F4FF;
    text-shadow: 0 0 12px rgba(109, 240, 255, 0.6);
    border-bottom: 1px solid rgba(109, 240, 255, 0.25); padding-bottom: 12px;
}
.gal-styled-fallback p {
    margin: 0 0 10px; line-height: 1.75; font-size: 0.98rem;
    color: rgba(237, 246, 248, 0.88);
}

/* === Styled 皮肤适配 === */
#gal-global-overlay[class*="skin-ancient"] .gal-styled-letter .gal-letter-line,
#gal-global-overlay[class*="skin-ancient"] .gal-styled-parchment .gal-parchment-line {
    font-family: "KaiTi", "STKaiti", "楷体", serif !important;
}


/* ═══════════════════════════════════════════════════════════════════
   九场入场 / 九场谢幕 — 每种载体独一无二的编舞
   JS 在挂载时加 .entering，卸载前加 .leaving
   ═══════════════════════════════════════════════════════════════════ */

/* ── 1. SMS：手机自景深处 3D 翻转到位 ── */
.gal-styled-sms.entering {
    animation: galInSms 1s cubic-bezier(0.2, 1.2, 0.32, 1) both;
}
@keyframes galInSms {
    0%   { opacity: 0; transform: perspective(1200px) rotateY(48deg) translateZ(-420px) translateX(120px); filter: blur(10px); }
    60%  { opacity: 1; filter: blur(0); }
    82%  { transform: perspective(1200px) rotateY(-5deg) translateZ(12px); }
    100% { opacity: 1; transform: none; filter: blur(0); }
}
.gal-styled-sms.leaving {
    animation: galOutSms 0.6s cubic-bezier(0.6, -0.2, 0.8, 0.4) both;
}
@keyframes galOutSms {
    0%   { opacity: 1; transform: none; }
    100% { opacity: 0; transform: perspective(1200px) rotateY(-46deg) translateZ(-380px) translateX(-140px); filter: blur(10px); }
}

/* ── 2. 信纸：对折的信展开 ── */
.gal-styled-letter.entering {
    animation: galInLetter 1.5s cubic-bezier(0.25, 1, 0.4, 1) both;
}
@keyframes galInLetter {
    0%   { opacity: 0; transform: perspective(1000px) rotateX(-88deg) translateY(60px) scale(0.92); transform-origin: 50% 100%; filter: brightness(0.55); }
    30%  { opacity: 1; }
    62%  { transform: perspective(1000px) rotateX(8deg) translateY(-6px) scale(1); transform-origin: 50% 100%; filter: brightness(1.06); }
    82%  { transform: perspective(1000px) rotateX(-3deg); transform-origin: 50% 100%; }
    100% { opacity: 1; transform: none; filter: brightness(1); }
}
/* 火漆印在信纸展开后落下 */
.gal-styled-letter.entering .gal-letter-signature::after {
    animation: galSealSlam 0.5s cubic-bezier(0.34, 1.2, 0.64, 1) 1.35s both;
}
.gal-styled-letter.leaving {
    animation: galOutLetter 0.65s cubic-bezier(0.55, 0, 0.8, 0.4) both;
    transform-origin: 50% 100%;
}
@keyframes galOutLetter {
    0%   { opacity: 1; transform: none; }
    100% { opacity: 0; transform: perspective(1000px) rotateX(-80deg) translateY(70px) scale(0.9); filter: brightness(0.5); }
}

/* ── 3. 羊皮纸：卷轴自中线向上下展开 ── */
.gal-styled-parchment.entering {
    animation: galInParchment 1.4s cubic-bezier(0.3, 1, 0.4, 1) both;
}
@keyframes galInParchment {
    0%   { opacity: 0; clip-path: inset(49.5% 2% 49.5% 2% round 10px); transform: scale(1.02); }
    18%  { opacity: 1; clip-path: inset(48% 0 48% 0 round 10px); }
    100% { opacity: 1; clip-path: inset(0 0 0 0 round 10px); transform: scale(1); }
}
.gal-styled-parchment.leaving {
    animation: galOutParchment 0.7s cubic-bezier(0.6, 0, 0.75, 0.35) both;
}
@keyframes galOutParchment {
    0%   { opacity: 1; clip-path: inset(0 0 0 0 round 10px); }
    72%  { opacity: 1; clip-path: inset(48.5% 0 48.5% 0 round 10px); transform: translateY(0); }
    100% { opacity: 0; clip-path: inset(49.5% 3% 49.5% 3% round 10px); transform: translateY(60px); }
}

/* ── 4. 报纸：新闻片旋转飞入 ── */
.gal-styled-newspaper.entering {
    animation: galInNews 1.1s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes galInNews {
    0%   { opacity: 0; transform: rotate(-900deg) scale(0.02); filter: blur(8px); }
    55%  { opacity: 1; filter: blur(2px); }
    78%  { transform: rotate(6deg) scale(1.04); filter: blur(0); }
    100% { opacity: 1; transform: rotate(-0.5deg) scale(1); filter: blur(0); }
}
.gal-styled-newspaper.leaving {
    animation: galOutNews 0.6s cubic-bezier(0.6, -0.1, 0.9, 0.4) both;
}
@keyframes galOutNews {
    0%   { opacity: 1; transform: rotate(-0.5deg) scale(1); }
    100% { opacity: 0; transform: rotate(720deg) scale(0.02); filter: blur(8px); }
}

/* ── 5. 终端：CRT 开机 / 关机 ── */
.gal-styled-terminal.entering {
    animation: galInCrt 0.9s cubic-bezier(0.2, 0.9, 0.3, 1) both;
}
@keyframes galInCrt {
    0%   { opacity: 0; transform: scaleX(0) scaleY(0.006); filter: brightness(6); }
    28%  { opacity: 1; transform: scaleX(1) scaleY(0.006); filter: brightness(5); }
    36%  { transform: scaleX(1) scaleY(0.006); }
    72%  { transform: scaleX(1) scaleY(1.04); filter: brightness(1.8); }
    100% { opacity: 1; transform: scale(1); filter: brightness(1); }
}
.gal-styled-terminal.leaving {
    animation: galOutCrt 0.55s cubic-bezier(0.7, 0, 0.85, 0.4) both;
}
@keyframes galOutCrt {
    0%   { opacity: 1; transform: scale(1); filter: brightness(1); }
    45%  { opacity: 1; transform: scaleX(1) scaleY(0.006); filter: brightness(6); }
    80%  { opacity: 1; transform: scaleX(0.12) scaleY(0.006); filter: brightness(8); }
    100% { opacity: 0; transform: scaleX(0.001) scaleY(0.004); filter: brightness(10); }
}

/* ── 6. 便签：从天而降，以胶带为轴摆动衰减 ── */
.gal-styled-note.entering {
    animation: galInNote 1.7s cubic-bezier(0.32, 0.9, 0.4, 1) both;
}
@keyframes galInNote {
    0%   { opacity: 0; transform: translateY(-120vh) rotate(14deg); }
    32%  { opacity: 1; transform: translateY(0) rotate(-16deg); }
    48%  { transform: rotate(9deg); }
    62%  { transform: rotate(-9deg); }
    74%  { transform: rotate(3.5deg); }
    85%  { transform: rotate(-5.5deg); }
    94%  { transform: rotate(-0.8deg); }
    100% { opacity: 1; transform: rotate(-2.2deg); }
}
.gal-styled-note.leaving {
    animation: galOutNote 0.8s cubic-bezier(0.5, 0, 0.8, 0.5) both;
}
@keyframes galOutNote {
    0%   { opacity: 1; transform: rotate(-2.2deg); }
    25%  { transform: rotate(6deg) translateY(6px); }
    100% { opacity: 0; transform: rotate(38deg) translate(90px, 110vh); }
}

/* ── 7. 日记：以布脊为轴，封面翻开 ── */
.gal-styled-diary.entering {
    animation: galInDiary 1.3s cubic-bezier(0.25, 1, 0.35, 1) both;
}
@keyframes galInDiary {
    0%   { opacity: 0; transform: perspective(1400px) rotateY(-105deg); filter: brightness(0.35); }
    25%  { opacity: 1; }
    72%  { transform: perspective(1400px) rotateY(7deg); filter: brightness(1.08); }
    100% { opacity: 1; transform: none; filter: brightness(1); }
}
.gal-styled-diary.leaving {
    animation: galOutDiary 0.65s cubic-bezier(0.55, 0, 0.8, 0.4) both;
}
@keyframes galOutDiary {
    0%   { opacity: 1; transform: none; filter: brightness(1); }
    100% { opacity: 0; transform: perspective(1400px) rotateY(-100deg); filter: brightness(0.3); }
}

/* ── 8. 公告：告示垂降上墙，印章随后砸落（见 galSealSlam） ── */
.gal-styled-bulletin.entering {
    animation: galInBulletin 1s cubic-bezier(0.22, 1.25, 0.36, 1) both;
}
@keyframes galInBulletin {
    0%   { opacity: 0; transform: translateY(-115%) rotate(1.5deg); }
    62%  { opacity: 1; transform: translateY(10px) rotate(-0.6deg); }
    82%  { transform: translateY(-5px) rotate(0.3deg); }
    100% { opacity: 1; transform: none; }
}
.gal-styled-bulletin.leaving {
    animation: galOutBulletin 0.6s cubic-bezier(0.6, -0.15, 0.85, 0.45) both;
}
@keyframes galOutBulletin {
    0%   { opacity: 1; transform: none; }
    100% { opacity: 0; transform: translateY(115%) rotate(-2deg); }
}

/* ── 9. 回退：全息投影闪烁凝聚 / 解体 ── */
.gal-styled-fallback.entering {
    animation: galInHolo 0.9s steps(1) both;
}
@keyframes galInHolo {
    0%   { opacity: 0; transform: scaleY(0.6) skewX(-10deg); filter: blur(8px) hue-rotate(40deg); }
    12%  { opacity: 0.7; transform: scaleY(1.05) skewX(6deg); }
    22%  { opacity: 0.25; transform: scaleY(0.92) skewX(-4deg); }
    34%  { opacity: 0.9; transform: scaleY(1.02) skewX(2deg); filter: blur(2px); }
    46%  { opacity: 0.5; transform: scaleY(0.98); }
    60%  { opacity: 1; transform: none; filter: blur(0) hue-rotate(0deg); }
    100% { opacity: 1; transform: none; filter: none; }
}
.gal-styled-fallback.leaving {
    animation: galOutHolo 0.55s steps(1) both;
}
@keyframes galOutHolo {
    0%   { opacity: 1; }
    20%  { opacity: 0.4; transform: scaleY(1.04) skewX(5deg); filter: blur(2px); }
    40%  { opacity: 0.8; transform: scaleY(0.9) skewX(-6deg); }
    60%  { opacity: 0.25; transform: scaleY(1.1) skewX(3deg); filter: blur(6px) hue-rotate(60deg); }
    100% { opacity: 0; transform: scaleY(0.05) skewX(0); filter: blur(12px); }
}

/* === 舞台机械补充（插件侧） === */
.gal-styled-stage canvas.fx-particles {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    pointer-events: none;
}
.gal-styled-stage.fx-shake {
    animation: galStageShake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}
@keyframes galStageShake {
    10%, 90% { transform: translate(-2px, 1px); }
    20%, 80% { transform: translate(4px, -2px); }
    30%, 50%, 70% { transform: translate(-7px, 3px); }
    40%, 60% { transform: translate(6px, -3px); }
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

const immersiveBaseCss = `
:root {
    --gal-immersive-bg: var(--SmartThemeBlurTintColor, rgba(20, 24, 32, 0.92));
    --gal-immersive-panel: rgba(15, 20, 30, 0.78);
    --gal-immersive-border: var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
    --gal-immersive-text: var(--SmartThemeBodyColor, #f5f7fa);
    --gal-immersive-text-dim: rgba(245, 247, 250, 0.72);
    --gal-immersive-accent: var(--SmartThemeEmColor, #9ac7ff);
    --gal-immersive-accent-glow: rgba(154, 199, 255, 0.48);
}

#gal-save-load-modal.gal-save-load-modal,
.gal-cg-upload-modal {
    position: fixed;
    inset: 0;
    z-index: 16000;
    display: flex;
    align-items: stretch;
    justify-content: center;
    padding: clamp(14px, 2.6vw, 32px);
    background: rgba(5, 8, 15, 0.84);
    backdrop-filter: blur(14px) saturate(125%);
    -webkit-backdrop-filter: blur(14px) saturate(125%);
}

#gal-save-load-modal.gal-save-load-modal::before,
.gal-cg-upload-modal::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
        radial-gradient(circle at 18% 20%, rgba(154, 199, 255, 0.14), transparent 30%),
        radial-gradient(circle at 82% 18%, rgba(255, 255, 255, 0.08), transparent 26%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 28%, rgba(255, 255, 255, 0.02) 100%);
    pointer-events: none;
}

#gal-save-load-modal .gal-save-label-input,
#gal-save-load-modal input[type='text'],
#gal-save-load-modal input[type='number'],
#gal-save-load-modal textarea,
#gal-save-load-modal select,
.gal-cg-upload-modal input[type='text'],
.gal-cg-upload-modal input[type='number'],
.gal-cg-upload-modal textarea,
.gal-cg-upload-modal select {
    width: 100%;
    min-height: 44px;
    border-radius: 14px;
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
    background: var(--SmartThemeBlurTintColor, rgba(20, 24, 32, 0.92));
    color: var(--SmartThemeBodyColor, #f5f7fa);
    padding: 0 14px;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.24s ease, box-shadow 0.24s ease, background 0.24s ease;
}

#gal-save-load-modal .gal-save-label-input::placeholder,
#gal-save-load-modal input[type='text']::placeholder,
#gal-save-load-modal input[type='number']::placeholder,
#gal-save-load-modal textarea::placeholder,
#gal-save-load-modal select::placeholder,
.gal-cg-upload-modal input[type='text']::placeholder,
.gal-cg-upload-modal input[type='number']::placeholder,
.gal-cg-upload-modal textarea::placeholder,
.gal-cg-upload-modal select::placeholder {
    color: rgba(245, 247, 250, 0.68);
}

#gal-save-load-modal .gal-save-label-input:focus,
#gal-save-load-modal input[type='text']:focus,
#gal-save-load-modal input[type='number']:focus,
#gal-save-load-modal textarea:focus,
#gal-save-load-modal select:focus,
.gal-cg-upload-modal input[type='text']:focus,
.gal-cg-upload-modal input[type='number']:focus,
.gal-cg-upload-modal textarea:focus,
.gal-cg-upload-modal select:focus {
    border-color: rgba(154, 199, 255, 0.86);
    box-shadow: 0 0 0 3px rgba(154, 199, 255, 0.18), 0 0 18px rgba(154, 199, 255, 0.14);
    background: rgba(22, 30, 42, 0.96);
}
`;

const saveLoadImmersiveCss = `
#gal-save-load-modal .gal-save-load-shell {
    position: relative;
    z-index: 1;
    width: min(1480px, 100%);
    min-height: 100%;
    display: flex;
    flex-direction: column;
    border-radius: 28px;
    overflow: hidden;
    background: linear-gradient(180deg, rgba(20, 24, 32, 0.92), rgba(8, 12, 18, 0.94));
    border: 1px solid var(--gal-immersive-border);
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.52), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    color: var(--gal-immersive-text);
}

#gal-save-load-modal .gal-save-load-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 18px;
    padding: clamp(28px, 4vw, 44px) clamp(24px, 4vw, 56px) 20px;
}

#gal-save-load-modal .gal-save-load-heading {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

#gal-save-load-modal .gal-save-load-kicker,
#gal-save-load-modal .gal-save-load-stage-kicker,
#gal-save-load-modal .gal-save-load-panel-label {
    font-size: 0.78rem;
    letter-spacing: 0.34em;
    text-transform: uppercase;
    color: var(--gal-immersive-accent);
    opacity: 0.88;
}

#gal-save-load-modal .gal-save-load-title {
    display: inline-flex;
    align-items: center;
    gap: 14px;
    font-size: clamp(1.8rem, 3vw, 2.8rem);
    font-weight: 300;
    letter-spacing: 0.08em;
    color: #ffffff;
    text-shadow: 0 0 20px var(--gal-immersive-accent-glow);
}

#gal-save-load-modal .gal-save-load-title i {
    color: var(--gal-immersive-accent);
}

#gal-save-load-modal .gal-save-load-close {
    width: auto;
    min-height: 42px;
    padding: 0 18px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.04);
    color: var(--gal-immersive-text-dim);
    cursor: pointer;
    letter-spacing: 0.18em;
    font-family: "Courier New", monospace;
    transition: all 0.28s ease;
}

#gal-save-load-modal .gal-save-load-close:hover {
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.3);
    box-shadow: 0 0 18px rgba(255, 255, 255, 0.12);
    transform: translateY(-1px);
}

#gal-save-load-modal .gal-save-load-body {
    flex: 1;
    min-height: 0;
    padding: 0 clamp(20px, 4vw, 56px) clamp(20px, 4vw, 40px);
    display: grid;
    grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
    gap: 24px;
}

#gal-save-load-modal .gal-save-load-rail {
    display: flex;
    flex-direction: column;
    gap: 18px;
}

#gal-save-load-modal .gal-save-load-panel,
#gal-save-load-modal .gal-save-load-stage {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 22px;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.08);
    background: linear-gradient(180deg, rgba(18, 24, 34, 0.78), rgba(10, 14, 22, 0.92));
}

#gal-save-load-modal .gal-save-load-panel {
    padding: 22px;
}

#gal-save-load-modal .gal-save-load-panel-title {
    margin: 10px 0 12px;
    font-size: 1.34rem;
    font-weight: 700;
    line-height: 1.45;
    color: #ffffff;
}

#gal-save-load-modal .gal-save-load-panel-copy {
    margin: 0;
    line-height: 1.75;
    color: var(--gal-immersive-text-dim);
}

#gal-save-load-modal .gal-save-load-panel-copy.compact {
    margin-bottom: 16px;
}

#gal-save-load-modal .gal-save-load-field {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 14px;
}

#gal-save-load-modal .gal-save-load-field-label {
    font-size: 0.86rem;
    font-weight: 700;
    color: var(--gal-immersive-text);
}

#gal-save-load-modal .gal-save-load-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 16px;
}

#gal-save-load-modal .gal-save-control-btn {
    min-height: 44px;
    padding: 0 18px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.06);
    color: var(--gal-immersive-text);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    cursor: pointer;
    font-weight: 700;
    transition: all 0.28s ease;
}

#gal-save-load-modal .gal-save-control-btn.primary {
    border-color: rgba(154, 199, 255, 0.42);
    background: linear-gradient(135deg, rgba(154, 199, 255, 0.18), rgba(35, 57, 86, 0.48));
    color: #ffffff;
    box-shadow: 0 0 24px rgba(154, 199, 255, 0.1);
}

#gal-save-load-modal .gal-save-control-btn:hover {
    transform: translateY(-1px);
    border-color: rgba(255, 255, 255, 0.28);
}

#gal-save-load-modal .gal-save-control-btn.primary:hover {
    border-color: rgba(154, 199, 255, 0.78);
    box-shadow: 0 0 24px rgba(154, 199, 255, 0.2);
}

#gal-save-load-modal .gal-save-control-btn:disabled {
    opacity: 0.58;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
}

#gal-save-load-modal .gal-save-load-stage {
    padding: 22px;
    display: flex;
    flex-direction: column;
    min-height: 0;
}

#gal-save-load-modal .gal-save-load-stage-head {
    margin-bottom: 18px;
    padding-bottom: 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

#gal-save-load-modal .gal-save-load-stage-title {
    margin-top: 10px;
    font-size: 1.06rem;
    line-height: 1.65;
    color: var(--gal-immersive-text);
}

@media (min-width: 768px) {
    #gal-save-load-modal .gal-save-slot-list::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.5);
    }

    #gal-save-load-modal[data-skin='skin-twilight'] .gal-save-slot-actions {
        top: auto;
        bottom: 0;
        height: auto;
        flex-direction: row;
        padding: 16px 14px;
        background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.8));
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        z-index: 10;
        justify-content: center;
    }

    #gal-save-load-modal[data-skin='skin-twilight'] .gal-save-slot-btn {
        flex: 1 1 0;
        min-width: 0;
        padding: 0 10px;
    }
}
`;

const saveLoadSlotsCss = `
#gal-save-load-modal .gal-save-slot-list {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 22px;
    padding-right: 6px;
    align-content: start;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.18) rgba(0, 0, 0, 0.18);
}

#gal-save-load-modal .gal-save-slot-list::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

#gal-save-load-modal .gal-save-slot-list::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.16);
    border-radius: 999px;
}

#gal-save-load-modal .gal-save-slot-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.16);
    border-radius: 999px;
}

#gal-save-load-modal .gal-save-slot-list::-webkit-scrollbar-thumb:hover {
    background: var(--gal-immersive-accent);
}

#gal-save-load-modal .gal-save-empty {
    min-height: 220px;
    border: 1px dashed rgba(255, 255, 255, 0.18);
    border-radius: 20px;
    color: var(--gal-immersive-text-dim);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02));
}

#gal-save-load-modal .gal-save-empty-copy {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

#gal-save-load-modal .gal-save-empty-copy strong {
    color: #ffffff;
    font-size: 1rem;
}

#gal-save-load-modal .gal-save-slot-card {
    position: relative;
    min-height: 300px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: linear-gradient(180deg, rgba(18, 24, 34, 0.4), rgba(10, 14, 22, 0.92)), rgba(20, 25, 35, 0.6);
    box-shadow: 0 15px 30px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.08);
    transition: transform 0.38s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.28s ease, box-shadow 0.28s ease;
}

#gal-save-load-modal .gal-save-slot-card:hover {
    transform: translateY(-4px) scale(1.015);
    border-color: rgba(255, 255, 255, 0.24);
    box-shadow: 0 20px 36px rgba(0, 0, 0, 0.5), 0 0 28px rgba(154, 199, 255, 0.12);
}

#gal-save-load-modal .gal-save-thumb-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: #05070d;
}

#gal-save-load-modal .gal-save-thumb-wrap::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--gal-immersive-accent), transparent);
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.36s ease;
}

#gal-save-load-modal .gal-save-slot-card:hover .gal-save-thumb-wrap::after {
    transform: scaleX(1);
}

#gal-save-load-modal .gal-save-thumb-image {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    opacity: 0.82;
    transition: opacity 0.5s ease, transform 10s ease, filter 0.5s ease;
}

#gal-save-load-modal .gal-save-slot-card:hover .gal-save-thumb-image {
    opacity: 1;
    transform: scale(1.08);
    filter: contrast(1.08) saturate(1.16);
}

#gal-save-load-modal .gal-save-thumb-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 6px;
    color: rgba(255, 255, 255, 0.24);
    font-family: "Courier New", monospace;
    letter-spacing: 0.2em;
    background: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255, 255, 255, 0.025) 10px, rgba(255, 255, 255, 0.025) 20px);
}

#gal-save-load-modal .gal-save-slot-info {
    position: relative;
    z-index: 2;
    margin-top: -58px;
    padding: 18px 18px 22px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: linear-gradient(180deg, transparent, rgba(2, 5, 10, 0.78) 26%, rgba(2, 5, 10, 0.94) 100%);
}

#gal-save-load-modal .gal-save-slot-meta,
#gal-save-load-modal .gal-save-slot-detail {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
}

#gal-save-load-modal .gal-save-slot-code,
#gal-save-load-modal .gal-save-slot-time {
    font-family: "Courier New", monospace;
    font-size: 0.78rem;
}

#gal-save-load-modal .gal-save-slot-code,
#gal-save-load-modal .gal-save-slot-char {
    color: var(--gal-immersive-accent);
}

#gal-save-load-modal .gal-save-slot-time {
    margin-left: auto;
    color: rgba(255, 255, 255, 0.66);
}

#gal-save-load-modal .gal-save-slot-badge {
    padding: 2px 10px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.78);
    font-size: 0.72rem;
}

#gal-save-load-modal .gal-save-slot-title {
    color: #ffffff;
    font-size: 1.08rem;
    font-weight: 700;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

#gal-save-load-modal .gal-save-slot-detail {
    font-size: 0.86rem;
    color: var(--gal-immersive-text-dim);
}

#gal-save-load-modal .gal-save-slot-char {
    font-weight: 700;
}

#gal-save-load-modal .gal-save-slot-actions {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 12px;
    padding: 24px;
    background: rgba(0, 0, 0, 0.58);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.28s ease;
}

#gal-save-load-modal .gal-save-slot-card:hover .gal-save-slot-actions {
    opacity: 1;
    pointer-events: auto;
}

#gal-save-load-modal .gal-save-slot-btn {
    min-width: 168px;
    min-height: 42px;
    padding: 0 18px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.22);
    background: rgba(0, 0, 0, 0.44);
    color: #ffffff;
    font-size: 0.9rem;
    letter-spacing: 0.12em;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    transition: all 0.28s ease;
}

#gal-save-load-modal .gal-save-slot-btn.primary {
    border-color: rgba(154, 199, 255, 0.58);
    color: var(--gal-immersive-accent);
}

#gal-save-load-modal .gal-save-slot-btn.primary:hover {
    background: var(--gal-immersive-accent);
    color: #03111d;
}

#gal-save-load-modal .gal-save-slot-btn.danger {
    border-color: rgba(255, 107, 107, 0.46);
    color: #ffb1b1;
}

#gal-save-load-modal .gal-save-slot-btn.danger:hover {
    background: rgba(220, 53, 69, 0.88);
    color: #ffffff;
}

#gal-save-load-modal .gal-save-slot-btn:disabled {
    opacity: 0.58;
    cursor: not-allowed;
    transform: none;
}
`;

const cgUploadImmersiveCss = `
.gal-cg-upload-modal .gal-cg-upload-shell {
    position: relative;
    z-index: 1;
    width: min(720px, 100%);
    max-height: min(92vh, 980px);
    display: flex;
    flex-direction: column;
    border-radius: 24px;
    overflow: hidden;
    background: linear-gradient(180deg, rgba(20, 24, 32, 0.92), rgba(8, 12, 18, 0.94));
    border: 1px solid var(--gal-immersive-border);
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.52), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    color: var(--gal-immersive-text);
}

.gal-cg-upload-modal .gal-cg-upload-shell-batch {
    width: min(1180px, 100%);
}

.gal-cg-upload-modal .gal-cg-upload-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 18px 22px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    cursor: move;
}

.gal-cg-upload-modal .gal-cg-upload-title {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    font-size: 1.08rem;
    font-weight: 700;
    color: #ffffff;
}

.gal-cg-upload-modal .gal-cg-upload-title i {
    color: var(--gal-immersive-accent);
}

.gal-cg-upload-modal .gal-cg-upload-close {
    width: 40px;
    height: 40px;
    padding: 0;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.04);
    color: var(--gal-immersive-text-dim);
    cursor: pointer;
    transition: all 0.28s ease;
}

.gal-cg-upload-modal .gal-cg-upload-close:hover {
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.3);
    box-shadow: 0 0 18px rgba(255, 255, 255, 0.12);
    transform: translateY(-1px);
}

.gal-cg-upload-modal .gal-cg-upload-body {
    padding: 22px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.gal-cg-upload-modal .gal-cg-upload-form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
}

.gal-cg-upload-modal .gal-cg-upload-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.gal-cg-upload-modal .gal-cg-upload-label {
    font-size: 0.86rem;
    font-weight: 700;
    color: var(--gal-immersive-text);
}

.gal-cg-upload-modal .gal-cg-upload-dropzone {
    min-height: 220px;
    border-radius: 20px;
    border: 1px dashed rgba(255, 255, 255, 0.22);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02));
    color: var(--gal-immersive-text);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    cursor: pointer;
    transition: all 0.28s ease;
}

.gal-cg-upload-modal .gal-cg-upload-dropzone i {
    font-size: 2.8rem;
    color: var(--gal-immersive-accent);
}

.gal-cg-upload-modal .gal-cg-upload-dropzone small,
.gal-cg-upload-modal .gal-cg-upload-toolbar-hint {
    color: var(--gal-immersive-text-dim);
}

.gal-cg-upload-modal .gal-cg-upload-dropzone:hover {
    border-color: rgba(154, 199, 255, 0.68);
    box-shadow: 0 0 24px rgba(154, 199, 255, 0.12);
    transform: translateY(-1px);
}

.gal-cg-upload-modal .gal-cg-upload-preview {
    border-radius: 18px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.4);
}

.gal-cg-upload-modal .gal-cg-upload-preview-img {
    display: block;
    width: 100%;
    max-height: 360px;
    object-fit: contain;
    background: rgba(6, 10, 18, 0.9);
}

.gal-cg-upload-modal .gal-cg-upload-actions,
.gal-cg-upload-modal .gal-cg-upload-footer {
    display: flex;
    gap: 12px;
    padding: 0 22px 22px;
}

.gal-cg-upload-modal .gal-cg-upload-footer {
    padding-top: 18px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.gal-cg-upload-modal .gal-cg-upload-primary-btn {
    flex: 1;
    min-height: 46px;
    justify-content: center;
}

.gal-cg-upload-modal .gal-action-btn:disabled,
.gal-cg-upload-modal .gal-batch-special-cg-remove:disabled {
    opacity: 0.58;
    cursor: not-allowed;
}
`;

const cgUploadGalleryCss = `
.gal-cg-upload-modal .gal-cg-upload-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 18px 22px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.gal-cg-upload-modal .gal-cg-upload-trigger-btn {
    min-height: 42px;
}

.gal-cg-upload-modal .gal-cg-upload-gallery-grid {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 22px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.18) rgba(0, 0, 0, 0.18);
}

.gal-cg-upload-modal .gal-cg-upload-gallery-grid::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

.gal-cg-upload-modal .gal-cg-upload-gallery-grid::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.16);
    border-radius: 999px;
}

.gal-cg-upload-modal .gal-cg-upload-gallery-grid::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.16);
    border-radius: 999px;
}

.gal-cg-upload-modal .gal-cg-upload-gallery-empty {
    grid-column: 1 / -1;
    min-height: 220px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    border-radius: 18px;
    border: 1px dashed rgba(255, 255, 255, 0.16);
    color: var(--gal-immersive-text-dim);
    background: rgba(255, 255, 255, 0.03);
}

.gal-cg-upload-modal .gal-batch-special-cg-item {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: linear-gradient(180deg, rgba(20, 24, 32, 0.7), rgba(10, 14, 22, 0.94));
    box-shadow: 0 18px 36px rgba(0, 0, 0, 0.28);
}

.gal-cg-upload-modal .gal-batch-special-cg-preview {
    position: relative;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: #05070d;
}

.gal-cg-upload-modal .gal-batch-special-cg-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

.gal-cg-upload-modal .gal-batch-special-cg-remove {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 34px;
    height: 34px;
    border: 0;
    border-radius: 999px;
    background: rgba(220, 53, 69, 0.88);
    color: #ffffff;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.gal-cg-upload-modal .gal-batch-special-cg-fields {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
}

@media (hover: none), (max-width: 760px) {
    #gal-save-load-modal.gal-save-load-modal,
    .gal-cg-upload-modal {
        padding: 10px;
    }

    #gal-save-load-modal .gal-save-load-header {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 20px 16px 14px;
    }

    #gal-save-load-modal .gal-save-load-heading {
        flex: 1 1 0;
        min-width: 0;
        gap: 8px;
    }

    #gal-save-load-modal .gal-save-load-kicker,
    #gal-save-load-modal .gal-save-load-stage-kicker,
    #gal-save-load-modal .gal-save-load-panel-label {
        font-size: 0.68rem;
        letter-spacing: 0.16em;
        opacity: 0.74;
    }

    #gal-save-load-modal .gal-save-load-title {
        gap: 10px;
        font-size: clamp(1.45rem, 6.8vw, 2rem);
        line-height: 1.2;
        letter-spacing: 0.03em;
    }

    #gal-save-load-modal .gal-save-load-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        align-self: flex-start;
        flex: 0 0 auto;
        width: auto;
        min-width: fit-content;
        max-width: 100%;
        min-height: 38px;
        padding: 0 14px;
        margin-left: auto;
        letter-spacing: 0.12em;
        white-space: nowrap;
    }

    #gal-save-load-modal .gal-save-load-close span {
        display: inline-block;
        white-space: nowrap;
    }

    #gal-save-load-modal .gal-save-load-shell,
    .gal-cg-upload-modal .gal-cg-upload-shell {
        border-radius: 18px;
    }

    #gal-save-load-modal .gal-save-load-body {
        grid-template-columns: 1fr;
        padding: 0 14px 14px;
    }

    #gal-save-load-modal .gal-save-load-panel,
    #gal-save-load-modal .gal-save-load-stage {
        border-radius: 18px;
        padding: 18px;
    }

    #gal-save-load-modal .gal-save-slot-list {
        grid-template-columns: 1fr;
        gap: 14px;
    }

    #gal-save-load-modal .gal-save-slot-actions {
        position: static;
        opacity: 1;
        pointer-events: auto;
        padding: 0 18px 18px;
        background: none;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        flex-direction: row;
        flex-wrap: wrap;
    }

    #gal-save-load-modal .gal-save-slot-btn {
        flex: 1 1 10rem;
        min-width: 0;
    }

    #gal-save-load-modal .gal-save-slot-time {
        width: 100%;
        margin-left: 0;
    }

    .gal-cg-upload-modal .gal-cg-upload-shell,
    .gal-cg-upload-modal .gal-cg-upload-shell-batch {
        width: 100%;
        max-height: calc(100vh - 20px);
    }

    .gal-cg-upload-modal .gal-cg-upload-form-grid {
        grid-template-columns: 1fr;
    }

    .gal-cg-upload-modal .gal-cg-upload-body,
    .gal-cg-upload-modal .gal-cg-upload-toolbar,
    .gal-cg-upload-modal .gal-cg-upload-gallery-grid,
    .gal-cg-upload-modal .gal-cg-upload-actions,
    .gal-cg-upload-modal .gal-cg-upload-footer {
        padding-left: 16px;
        padding-right: 16px;
    }

    .gal-cg-upload-modal .gal-cg-upload-gallery-grid {
        grid-template-columns: 1fr;
    }

    #gal-save-load-modal.gal-save-load-modal[data-skin='skin-twilight'] {
        align-items: center;
        justify-content: center;
        width: 100vw;
        height: 100dvh;
        min-height: 100dvh;
        max-height: 100dvh;
        padding: 12px 10px calc(env(safe-area-inset-bottom, 0px) + 12px);
    }

    #gal-save-load-modal[data-skin='skin-twilight'] .gal-save-load-shell {
        width: 100%;
        min-height: 0;
        max-height: calc(100dvh - env(safe-area-inset-bottom, 0px) - 24px);
    }

    #gal-save-load-modal[data-skin='skin-twilight'] .gal-save-load-body {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 0 12px 12px;
    }

    #gal-save-load-modal[data-skin='skin-twilight'] .gal-save-load-panel-intro {
        display: none;
    }

    #gal-save-load-modal[data-skin='skin-twilight'] .gal-save-load-rail {
        gap: 0;
    }

    #gal-save-load-modal[data-skin='skin-twilight'] .gal-save-load-controls-panel {
        padding: 14px;
    }

    #gal-save-load-modal[data-skin='skin-twilight'] .gal-save-load-field {
        margin-top: 10px;
        gap: 8px;
    }

    #gal-save-load-modal[data-skin='skin-twilight'] .gal-save-load-controls {
        margin-top: 12px;
        gap: 10px;
    }

    #gal-save-load-modal[data-skin='skin-twilight'] .gal-save-load-stage {
        flex: 1 1 auto;
        min-height: 0;
        padding: 14px;
    }

    #gal-save-load-modal[data-skin='skin-twilight'] .gal-save-load-stage-head {
        margin-bottom: 10px;
        padding-bottom: 0;
        border-bottom: none;
    }

    #gal-save-load-modal[data-skin='skin-twilight'] .gal-save-load-stage-title {
        display: none;
    }

    #gal-save-load-modal[data-skin='skin-twilight'] .gal-save-slot-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding-right: 2px;
    }

    #gal-save-load-modal[data-skin='skin-twilight'] .gal-save-slot-card {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 0;
        padding: 0;
        min-height: 0;
        height: auto;
    }

    #gal-save-load-modal[data-skin='skin-twilight'] .gal-save-slot-actions {
        position: static;
        opacity: 1;
        pointer-events: auto;
        background: none;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        flex-direction: row;
        flex-wrap: nowrap;
        align-items: stretch;
        gap: 10px;
        padding: 0 14px 14px;
    }

    #gal-save-load-modal[data-skin='skin-twilight'] .gal-save-thumb-wrap {
        width: 100%;
        flex: 0 0 auto;
        height: 132px;
        max-width: none;
        min-height: 132px;
    }

    #gal-save-load-modal[data-skin='skin-twilight'] .gal-save-slot-info {
        width: auto;
        margin-top: 0;
        padding: 14px 14px 12px;
        gap: 8px;
        background: linear-gradient(180deg, rgba(2, 5, 10, 0.2), rgba(2, 5, 10, 0.9) 100%);
    }

    #gal-save-load-modal[data-skin='skin-twilight'] .gal-save-slot-meta,
    #gal-save-load-modal[data-skin='skin-twilight'] .gal-save-slot-detail {
        gap: 8px;
    }

    #gal-save-load-modal[data-skin='skin-twilight'] .gal-save-slot-title {
        font-size: 1rem;
        line-height: 1.4;
    }

    #gal-save-load-modal[data-skin='skin-twilight'] .gal-save-slot-btn {
        flex: 1 1 0;
        width: auto;
        min-width: 0;
        min-height: 38px;
        font-size: 0.84rem;
    }

    #gal-save-load-modal[data-skin='skin-twilight'] .gal-save-slot-time {
        width: auto;
        margin-left: auto;
    }

    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] {
        background: radial-gradient(circle at top, rgba(255, 249, 238, 0.22) 0%, rgba(255, 249, 238, 0.08) 22%, rgba(26, 18, 14, 0.58) 100%) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-load-shell,
    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-load-panel,
    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-load-stage,
    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-slot-card {
        background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.04) 100%),
            rgba(249, 248, 244, 0.88) !important;
        border-color: rgba(176, 141, 87, 0.18) !important;
        box-shadow: 0 20px 48px rgba(80, 58, 34, 0.12) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-load-kicker,
    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-load-stage-kicker,
    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-load-panel-label {
        color: rgba(176, 141, 87, 0.88) !important;
        font-family: "Montserrat", "Noto Sans SC", "PingFang SC", sans-serif !important;
        letter-spacing: 0.22em !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-load-title,
    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-load-panel-title,
    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-slot-title {
        color: rgba(47, 40, 34, 0.94) !important;
        font-family: "Cormorant Garamond", "Noto Serif SC", "Source Han Serif SC", serif !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-load-panel-copy,
    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-slot-detail,
    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-slot-time,
    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-slot-meta {
        color: rgba(47, 40, 34, 0.66) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-load-close,
    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-control-btn,
    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-slot-btn {
        border-color: rgba(176, 141, 87, 0.18) !important;
        font-family: "Montserrat", "Noto Sans SC", "PingFang SC", sans-serif !important;
        letter-spacing: 0.08em !important;
        box-shadow: none !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-control-btn.primary,
    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-slot-btn.primary {
        background: linear-gradient(180deg, rgba(176, 141, 87, 0.94) 0%, rgba(153, 118, 70, 0.96) 100%) !important;
        color: rgba(255, 252, 246, 0.98) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-slot-btn.danger {
        background: linear-gradient(180deg, rgba(106, 45, 50, 0.92) 0%, rgba(82, 29, 35, 0.96) 100%) !important;
        color: rgba(255, 244, 240, 0.96) !important;
        border-color: rgba(106, 45, 50, 0.88) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-load-field input[type='text'],
    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-load-field input[type='number'],
    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-load-field textarea,
    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-load-field select {
        color: rgba(47, 40, 34, 0.94) !important;
        background: rgba(255, 252, 246, 0.94) !important;
        border-color: rgba(176, 141, 87, 0.2) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-load-field input[type='text']::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-load-field input[type='number']::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-load-field textarea::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-load-field select::placeholder {
        color: rgba(47, 40, 34, 0.46) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-load-field input[type='text']:focus,
    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-load-field input[type='number']:focus,
    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-load-field textarea:focus,
    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-load-field select:focus {
        border-color: rgba(176, 141, 87, 0.42) !important;
        box-shadow: 0 0 0 3px rgba(176, 141, 87, 0.12) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-gilded-twilight'] .gal-save-slot-info {
        background: linear-gradient(180deg, rgba(255, 253, 247, 0.32), rgba(255, 253, 247, 0.86) 100%) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] {
        background: radial-gradient(circle at top, rgba(120, 161, 187, 0.16) 0%, rgba(120, 161, 187, 0.06) 22%, rgba(2, 6, 23, 0.64) 100%) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-load-shell,
    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-load-panel,
    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-load-stage,
    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-slot-card {
        background:
            linear-gradient(180deg, rgba(120, 161, 187, 0.08) 0%, rgba(120, 161, 187, 0.02) 100%),
            rgba(15, 23, 42, 0.9) !important;
        border-color: rgba(120, 161, 187, 0.18) !important;
        box-shadow: 0 20px 48px rgba(2, 6, 23, 0.18) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-load-kicker,
    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-load-stage-kicker,
    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-load-panel-label {
        color: rgba(184, 193, 200, 0.9) !important;
        font-family: "Montserrat", "Noto Sans SC", "PingFang SC", sans-serif !important;
        letter-spacing: 0.2em !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-load-title,
    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-load-panel-title,
    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-slot-title {
        color: rgba(226, 232, 240, 0.96) !important;
        font-family: "Montserrat", "PingFang SC", "Microsoft YaHei", sans-serif !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-load-panel-copy,
    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-slot-detail,
    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-slot-time,
    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-slot-meta {
        color: rgba(184, 193, 200, 0.7) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-load-close,
    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-control-btn,
    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-slot-btn {
        border-color: rgba(120, 161, 187, 0.2) !important;
        color: rgba(226, 232, 240, 0.94) !important;
        font-family: "Montserrat", "Noto Sans SC", "PingFang SC", sans-serif !important;
        letter-spacing: 0.08em !important;
        box-shadow: none !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-control-btn.primary,
    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-slot-btn.primary {
        background: linear-gradient(135deg, rgba(26, 58, 58, 0.94) 0%, rgba(120, 161, 187, 0.92) 100%) !important;
        color: rgba(255, 255, 255, 0.98) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-slot-btn.danger {
        background: linear-gradient(180deg, rgba(51, 65, 85, 0.92) 0%, rgba(30, 41, 59, 0.96) 100%) !important;
        color: rgba(226, 232, 240, 0.96) !important;
        border-color: rgba(120, 161, 187, 0.18) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-load-field input[type='text'],
    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-load-field input[type='number'],
    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-load-field textarea,
    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-load-field select {
        color: rgba(226, 232, 240, 0.96) !important;
        background: rgba(15, 23, 42, 0.94) !important;
        border-color: rgba(120, 161, 187, 0.22) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-load-field input[type='text']::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-load-field input[type='number']::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-load-field textarea::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-load-field select::placeholder {
        color: rgba(184, 193, 200, 0.5) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-load-field input[type='text']:focus,
    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-load-field input[type='number']:focus,
    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-load-field textarea:focus,
    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-load-field select:focus {
        border-color: rgba(120, 161, 187, 0.42) !important;
        box-shadow: 0 0 0 3px rgba(120, 161, 187, 0.14) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-dawn-twilight'] .gal-save-slot-info {
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.34), rgba(2, 6, 23, 0.88) 100%) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] {
        background: radial-gradient(circle at top, rgba(224, 177, 203, 0.18) 0%, rgba(224, 177, 203, 0.06) 22%, rgba(26, 22, 37, 0.7) 100%) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-load-shell,
    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-load-panel,
    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-load-stage,
    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-slot-card {
        background:
            linear-gradient(180deg, rgba(224, 177, 203, 0.08) 0%, rgba(255, 191, 105, 0.03) 100%),
            rgba(45, 27, 45, 0.9) !important;
        border-color: rgba(183, 156, 237, 0.18) !important;
        box-shadow: 0 20px 48px rgba(26, 22, 37, 0.2) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-load-kicker,
    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-load-stage-kicker,
    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-load-panel-label {
        color: rgba(255, 191, 105, 0.9) !important;
        font-family: "Inter", "Noto Sans SC", "PingFang SC", sans-serif !important;
        letter-spacing: 0.2em !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-load-title,
    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-load-panel-title,
    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-slot-title {
        color: rgba(247, 225, 215, 0.96) !important;
        font-family: "Be Vietnam Pro", "PingFang SC", "Microsoft YaHei", sans-serif !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-load-panel-copy,
    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-slot-detail,
    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-slot-time,
    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-slot-meta {
        color: rgba(224, 177, 203, 0.72) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-load-close,
    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-control-btn,
    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-slot-btn {
        border-color: rgba(255, 191, 105, 0.18) !important;
        color: rgba(247, 225, 215, 0.94) !important;
        font-family: "Inter", "Noto Sans SC", "PingFang SC", sans-serif !important;
        letter-spacing: 0.08em !important;
        box-shadow: none !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-control-btn.primary,
    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-slot-btn.primary {
        background: linear-gradient(135deg, rgba(255, 191, 105, 0.94) 0%, rgba(183, 156, 237, 0.92) 100%) !important;
        color: rgba(26, 22, 37, 0.98) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-slot-btn.danger {
        background: linear-gradient(180deg, rgba(103, 49, 90, 0.92) 0%, rgba(65, 29, 64, 0.96) 100%) !important;
        color: rgba(247, 225, 215, 0.96) !important;
        border-color: rgba(183, 156, 237, 0.22) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-load-field input[type='text'],
    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-load-field input[type='number'],
    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-load-field textarea,
    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-load-field select {
        color: rgba(247, 225, 215, 0.96) !important;
        background: rgba(26, 22, 37, 0.94) !important;
        border-color: rgba(255, 191, 105, 0.22) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-load-field input[type='text']::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-load-field input[type='number']::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-load-field textarea::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-load-field select::placeholder {
        color: rgba(224, 177, 203, 0.5) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-load-field input[type='text']:focus,
    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-load-field input[type='number']:focus,
    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-load-field textarea:focus,
    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-load-field select:focus {
        border-color: rgba(255, 191, 105, 0.42) !important;
        box-shadow: 0 0 0 3px rgba(255, 191, 105, 0.14) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-orchid-twilight'] .gal-save-slot-info {
        background: linear-gradient(180deg, rgba(45, 27, 45, 0.36), rgba(26, 22, 37, 0.88) 100%) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] {
        background: radial-gradient(circle at top, rgba(0, 242, 255, 0.18) 0%, rgba(0, 242, 255, 0.06) 18%, rgba(10, 10, 15, 0.78) 100%) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-load-shell,
    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-load-panel,
    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-load-stage,
    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-slot-card {
        background:
            linear-gradient(180deg, rgba(0, 242, 255, 0.07) 0%, rgba(255, 0, 229, 0.03) 100%),
            rgba(10, 10, 15, 0.92) !important;
        border-color: rgba(0, 242, 255, 0.2) !important;
        box-shadow: 0 20px 52px rgba(0, 0, 0, 0.24), 0 0 24px rgba(0, 242, 255, 0.08) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-load-kicker,
    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-load-stage-kicker,
    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-load-panel-label {
        color: rgba(0, 242, 255, 0.94) !important;
        font-family: "Oswald", "Noto Sans SC", "PingFang SC", sans-serif !important;
        letter-spacing: 0.24em !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-load-title,
    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-load-panel-title,
    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-slot-title {
        color: rgba(240, 240, 255, 0.98) !important;
        font-family: "Poppins", "PingFang SC", "Microsoft YaHei", sans-serif !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-load-panel-copy,
    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-slot-detail,
    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-slot-time,
    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-slot-meta {
        color: rgba(240, 240, 255, 0.72) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-load-close,
    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-control-btn,
    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-slot-btn {
        border-color: rgba(0, 242, 255, 0.22) !important;
        color: rgba(240, 240, 255, 0.96) !important;
        font-family: "Oswald", "Noto Sans SC", "PingFang SC", sans-serif !important;
        letter-spacing: 0.1em !important;
        box-shadow: none !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-control-btn.primary,
    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-slot-btn.primary {
        background: linear-gradient(135deg, rgba(0, 242, 255, 0.96) 0%, rgba(112, 0, 255, 0.94) 56%, rgba(255, 0, 229, 0.92) 100%) !important;
        color: rgba(10, 10, 15, 0.98) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-slot-btn.danger {
        background: linear-gradient(180deg, rgba(255, 0, 229, 0.82) 0%, rgba(112, 0, 255, 0.9) 100%) !important;
        color: rgba(255, 255, 255, 0.98) !important;
        border-color: rgba(255, 0, 229, 0.26) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-load-field input[type='text'],
    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-load-field input[type='number'],
    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-load-field textarea,
    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-load-field select {
        color: rgba(240, 240, 255, 0.98) !important;
        background: rgba(10, 10, 15, 0.96) !important;
        border-color: rgba(0, 242, 255, 0.24) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-load-field input[type='text']::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-load-field input[type='number']::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-load-field textarea::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-load-field select::placeholder {
        color: rgba(240, 240, 255, 0.52) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-load-field input[type='text']:focus,
    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-load-field input[type='number']:focus,
    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-load-field textarea:focus,
    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-load-field select:focus {
        border-color: rgba(0, 242, 255, 0.42) !important;
        box-shadow: 0 0 0 3px rgba(0, 242, 255, 0.14), 0 0 18px rgba(0, 242, 255, 0.1) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-neon-twilight'] .gal-save-slot-info {
        background: linear-gradient(180deg, rgba(19, 19, 32, 0.4), rgba(10, 10, 15, 0.92) 100%) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] {
        background: radial-gradient(circle at top, rgba(224, 242, 254, 0.28) 0%, rgba(224, 242, 254, 0.1) 22%, rgba(255, 255, 255, 0.56) 100%) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-load-shell,
    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-load-panel,
    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-load-stage,
    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-slot-card {
        background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.08) 100%),
            rgba(255, 255, 255, 0.9) !important;
        border-color: rgba(0, 0, 0, 0.08) !important;
        box-shadow: 0 20px 48px rgba(148, 163, 184, 0.12) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-load-kicker,
    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-load-stage-kicker,
    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-load-panel-label {
        color: rgba(14, 165, 233, 0.9) !important;
        font-family: "Inter", "Noto Sans SC", "PingFang SC", sans-serif !important;
        letter-spacing: 0.18em !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-load-title,
    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-load-panel-title,
    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-slot-title {
        color: rgba(26, 26, 28, 0.94) !important;
        font-family: "Inter", "PingFang SC", "Microsoft YaHei", sans-serif !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-load-panel-copy,
    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-slot-detail,
    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-slot-time,
    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-slot-meta {
        color: rgba(26, 26, 28, 0.66) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-load-close,
    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-control-btn,
    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-slot-btn {
        border-color: rgba(0, 0, 0, 0.08) !important;
        color: rgba(26, 26, 28, 0.9) !important;
        font-family: "Inter", "Noto Sans SC", "PingFang SC", sans-serif !important;
        letter-spacing: 0.08em !important;
        box-shadow: none !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-control-btn.primary,
    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-slot-btn.primary {
        background: linear-gradient(180deg, rgba(14, 165, 233, 0.92) 0%, rgba(2, 132, 199, 0.94) 100%) !important;
        color: rgba(255, 255, 255, 0.98) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-slot-btn.danger {
        background: linear-gradient(180deg, rgba(100, 116, 139, 0.86) 0%, rgba(71, 85, 105, 0.92) 100%) !important;
        color: rgba(255, 255, 255, 0.96) !important;
        border-color: rgba(100, 116, 139, 0.2) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-load-field input[type='text'],
    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-load-field input[type='number'],
    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-load-field textarea,
    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-load-field select {
        color: rgba(26, 26, 28, 0.94) !important;
        background: rgba(255, 255, 255, 0.94) !important;
        border-color: rgba(0, 0, 0, 0.08) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-load-field input[type='text']::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-load-field input[type='number']::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-load-field textarea::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-load-field select::placeholder {
        color: rgba(26, 26, 28, 0.42) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-load-field input[type='text']:focus,
    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-load-field input[type='number']:focus,
    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-load-field textarea:focus,
    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-load-field select:focus {
        border-color: rgba(14, 165, 233, 0.28) !important;
        box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-clear-twilight'] .gal-save-slot-info {
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.38), rgba(255, 255, 255, 0.88) 100%) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] {
        background: radial-gradient(circle at top, rgba(165, 243, 252, 0.16) 0%, rgba(165, 243, 252, 0.05) 22%, rgba(5, 15, 11, 0.74) 100%) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-load-shell,
    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-load-panel,
    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-load-stage,
    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-slot-card {
        background:
            linear-gradient(180deg, rgba(61, 43, 31, 0.12) 0%, rgba(30, 58, 42, 0.08) 100%),
            rgba(10, 31, 22, 0.9) !important;
        border-color: rgba(212, 175, 55, 0.18) !important;
        box-shadow: 0 20px 48px rgba(0, 0, 0, 0.22) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-load-kicker,
    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-load-stage-kicker,
    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-load-panel-label {
        color: rgba(212, 175, 55, 0.92) !important;
        font-family: "Lora", "Noto Serif SC", "Source Han Serif SC", serif !important;
        letter-spacing: 0.18em !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-load-title,
    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-load-panel-title,
    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-slot-title {
        color: rgba(243, 244, 246, 0.96) !important;
        font-family: "Cinzel Decorative", "Noto Serif SC", "Source Han Serif SC", serif !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-load-panel-copy,
    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-slot-detail,
    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-slot-time,
    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-slot-meta {
        color: rgba(165, 243, 252, 0.72) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-load-close,
    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-control-btn,
    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-slot-btn {
        border-color: rgba(212, 175, 55, 0.18) !important;
        color: rgba(212, 175, 55, 0.92) !important;
        font-family: "Lora", "Noto Serif SC", "Source Han Serif SC", serif !important;
        letter-spacing: 0.08em !important;
        box-shadow: none !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-control-btn.primary,
    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-slot-btn.primary {
        background: linear-gradient(180deg, rgba(165, 243, 252, 0.18) 0%, rgba(165, 243, 252, 0.22) 100%) !important;
        color: rgba(165, 243, 252, 0.96) !important;
        border-color: rgba(165, 243, 252, 0.22) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-slot-btn.danger {
        background: linear-gradient(180deg, rgba(61, 43, 31, 0.88) 0%, rgba(37, 24, 18, 0.94) 100%) !important;
        color: rgba(243, 244, 246, 0.96) !important;
        border-color: rgba(212, 175, 55, 0.18) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-load-field input[type='text'],
    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-load-field input[type='number'],
    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-load-field textarea,
    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-load-field select {
        color: rgba(243, 244, 246, 0.96) !important;
        background: rgba(5, 15, 11, 0.9) !important;
        border-color: rgba(212, 175, 55, 0.2) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-load-field input[type='text']::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-load-field input[type='number']::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-load-field textarea::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-load-field select::placeholder {
        color: rgba(165, 243, 252, 0.46) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-load-field input[type='text']:focus,
    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-load-field input[type='number']:focus,
    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-load-field textarea:focus,
    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-load-field select:focus {
        border-color: rgba(212, 175, 55, 0.34) !important;
        box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.12) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-forest-twilight'] .gal-save-slot-info {
        background: linear-gradient(180deg, rgba(61, 43, 31, 0.22), rgba(5, 15, 11, 0.9) 100%) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] {
        background: radial-gradient(circle at top, rgba(0, 243, 255, 0.16) 0%, rgba(0, 243, 255, 0.06) 18%, rgba(26, 11, 46, 0.82) 100%) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-load-shell,
    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-load-panel,
    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-load-stage,
    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-slot-card {
        background:
            linear-gradient(180deg, rgba(45, 0, 77, 0.14) 0%, rgba(26, 11, 46, 0.08) 100%),
            rgba(26, 11, 46, 0.92) !important;
        border-color: rgba(0, 243, 255, 0.2) !important;
        box-shadow: 0 20px 52px rgba(0, 0, 0, 0.28), 0 0 20px rgba(0, 243, 255, 0.08) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-load-kicker,
    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-load-stage-kicker,
    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-load-panel-label {
        color: rgba(0, 243, 255, 0.96) !important;
        font-family: "Orbitron", "Noto Sans SC", "PingFang SC", sans-serif !important;
        letter-spacing: 0.24em !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-load-title,
    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-load-panel-title,
    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-slot-title {
        color: rgba(224, 242, 254, 0.98) !important;
        font-family: "Roboto Mono", "Microsoft YaHei UI", monospace !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-load-panel-copy,
    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-slot-detail,
    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-slot-time,
    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-slot-meta {
        color: rgba(0, 210, 255, 0.78) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-load-close,
    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-control-btn,
    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-slot-btn {
        border-color: rgba(0, 243, 255, 0.22) !important;
        color: rgba(0, 243, 255, 0.96) !important;
        font-family: "Orbitron", "Noto Sans SC", "PingFang SC", sans-serif !important;
        letter-spacing: 0.1em !important;
        box-shadow: none !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-control-btn.primary,
    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-slot-btn.primary {
        background: linear-gradient(180deg, rgba(57, 255, 20, 0.92) 0%, rgba(0, 243, 255, 0.9) 100%) !important;
        color: rgba(45, 0, 77, 0.98) !important;
        border-color: rgba(57, 255, 20, 0.3) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-slot-btn.danger {
        background: linear-gradient(180deg, rgba(45, 0, 77, 0.88) 0%, rgba(26, 11, 46, 0.94) 100%) !important;
        color: rgba(224, 242, 254, 0.98) !important;
        border-color: rgba(0, 243, 255, 0.18) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-load-field input[type='text'],
    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-load-field input[type='number'],
    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-load-field textarea,
    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-load-field select {
        color: rgba(224, 242, 254, 0.98) !important;
        background: rgba(14, 6, 26, 0.96) !important;
        border-color: rgba(0, 243, 255, 0.24) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-load-field input[type='text']::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-load-field input[type='number']::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-load-field textarea::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-load-field select::placeholder {
        color: rgba(0, 210, 255, 0.52) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-load-field input[type='text']:focus,
    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-load-field input[type='number']:focus,
    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-load-field textarea:focus,
    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-load-field select:focus {
        border-color: rgba(57, 255, 20, 0.34) !important;
        box-shadow: 0 0 0 3px rgba(57, 255, 20, 0.12), 0 0 16px rgba(0, 243, 255, 0.1) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-cyber-twilight'] .gal-save-slot-info {
        background: linear-gradient(180deg, rgba(45, 0, 77, 0.24), rgba(14, 6, 26, 0.92) 100%) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] {
        background: radial-gradient(circle at top, rgba(233, 213, 255, 0.24) 0%, rgba(233, 213, 255, 0.08) 22%, rgba(255, 255, 255, 0.62) 100%) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-load-shell,
    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-load-panel,
    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-load-stage,
    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-slot-card {
        background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.08) 100%),
            rgba(243, 240, 255, 0.9) !important;
        border-color: rgba(255, 255, 255, 0.76) !important;
        box-shadow: 0 20px 48px rgba(243, 240, 255, 0.24) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-load-kicker,
    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-load-stage-kicker,
    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-load-panel-label {
        color: rgba(74, 59, 78, 0.82) !important;
        font-family: "Inter", "Noto Sans SC", "PingFang SC", sans-serif !important;
        letter-spacing: 0.18em !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-load-title,
    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-load-panel-title,
    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-slot-title {
        color: rgba(74, 59, 78, 0.94) !important;
        font-family: "Be Vietnam Pro", "PingFang SC", "Microsoft YaHei", sans-serif !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-load-panel-copy,
    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-slot-detail,
    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-slot-time,
    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-slot-meta {
        color: rgba(63, 63, 70, 0.68) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-load-close,
    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-control-btn,
    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-slot-btn {
        border-color: rgba(255, 255, 255, 0.78) !important;
        color: rgba(74, 59, 78, 0.9) !important;
        font-family: "Inter", "Noto Sans SC", "PingFang SC", sans-serif !important;
        letter-spacing: 0.08em !important;
        box-shadow: none !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-control-btn.primary,
    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-slot-btn.primary {
        background: linear-gradient(180deg, rgba(233, 213, 255, 0.92) 0%, rgba(251, 207, 232, 0.88) 100%) !important;
        color: rgba(74, 59, 78, 0.96) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-slot-btn.danger {
        background: linear-gradient(180deg, rgba(255, 237, 213, 0.92) 0%, rgba(248, 250, 252, 0.94) 100%) !important;
        color: rgba(74, 59, 78, 0.94) !important;
        border-color: rgba(255, 255, 255, 0.82) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-load-field input[type='text'],
    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-load-field input[type='number'],
    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-load-field textarea,
    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-load-field select {
        color: rgba(74, 59, 78, 0.94) !important;
        background: rgba(255, 255, 255, 0.94) !important;
        border-color: rgba(255, 255, 255, 0.82) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-load-field input[type='text']::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-load-field input[type='number']::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-load-field textarea::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-load-field select::placeholder {
        color: rgba(74, 59, 78, 0.44) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-load-field input[type='text']:focus,
    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-load-field input[type='number']:focus,
    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-load-field textarea:focus,
    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-load-field select:focus {
        border-color: rgba(233, 213, 255, 0.9) !important;
        box-shadow: 0 0 0 3px rgba(233, 213, 255, 0.16) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-dream-twilight'] .gal-save-slot-info {
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.4), rgba(243, 240, 255, 0.9) 100%) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] {
        background: radial-gradient(circle at top, rgba(255, 128, 171, 0.22) 0%, rgba(255, 128, 171, 0.08) 22%, rgba(255, 240, 243, 0.62) 58%, rgba(255, 255, 255, 0.74) 100%) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-load-shell,
    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-load-panel,
    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-load-stage,
    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-slot-card {
        background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.26) 0%, rgba(255, 255, 255, 0.1) 100%),
            rgba(255, 240, 243, 0.9) !important;
        border-color: rgba(255, 255, 255, 0.78) !important;
        box-shadow: 0 20px 48px rgba(255, 128, 171, 0.18) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-load-kicker,
    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-load-stage-kicker,
    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-load-panel-label {
        color: rgba(61, 59, 60, 0.82) !important;
        font-family: "Inter", "Noto Sans SC", "PingFang SC", sans-serif !important;
        letter-spacing: 0.18em !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-load-title,
    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-load-panel-title,
    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-slot-title {
        color: rgba(61, 59, 60, 0.94) !important;
        font-family: "Manrope", "PingFang SC", "Microsoft YaHei", sans-serif !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-load-panel-copy,
    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-slot-detail,
    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-slot-time,
    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-slot-meta {
        color: rgba(61, 59, 60, 0.68) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-load-close,
    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-control-btn,
    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-slot-btn {
        border-color: rgba(255, 255, 255, 0.8) !important;
        color: rgba(61, 59, 60, 0.9) !important;
        font-family: "Inter", "Noto Sans SC", "PingFang SC", sans-serif !important;
        letter-spacing: 0.08em !important;
        box-shadow: none !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-control-btn.primary,
    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-slot-btn.primary {
        background: linear-gradient(180deg, rgba(255, 128, 171, 0.96) 0%, rgba(255, 0, 127, 0.9) 100%) !important;
        color: rgba(255, 255, 255, 0.96) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-slot-btn.danger {
        background: linear-gradient(180deg, rgba(255, 240, 243, 0.96) 0%, rgba(252, 228, 236, 0.92) 100%) !important;
        color: rgba(255, 0, 127, 0.92) !important;
        border-color: rgba(255, 255, 255, 0.84) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-load-field input[type='text'],
    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-load-field input[type='number'],
    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-load-field textarea,
    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-load-field select {
        color: rgba(61, 59, 60, 0.94) !important;
        background: rgba(255, 255, 255, 0.94) !important;
        border-color: rgba(255, 255, 255, 0.84) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-load-field input[type='text']::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-load-field input[type='number']::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-load-field textarea::placeholder,
    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-load-field select::placeholder {
        color: rgba(61, 59, 60, 0.44) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-load-field input[type='text']:focus,
    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-load-field input[type='number']:focus,
    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-load-field textarea:focus,
    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-load-field select:focus {
        border-color: rgba(255, 128, 171, 0.88) !important;
        box-shadow: 0 0 0 3px rgba(255, 128, 171, 0.16) !important;
    }

    #gal-save-load-modal[data-skin-variant='skin-rosy-twilight'] .gal-save-slot-info {
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.42), rgba(255, 240, 243, 0.92) 100%) !important;
    }
}
`;

const titleGalleryImmersiveCss = `
#gal-global-overlay .gal-title-cg-gallery {
    padding: 24px;
    background: rgba(4, 6, 12, 0.82);
    backdrop-filter: blur(12px) saturate(120%);
    -webkit-backdrop-filter: blur(12px) saturate(120%);
}

#gal-global-overlay .gal-title-cg-gallery-panel {
    width: min(1180px, 94vw);
    max-height: 90vh;
    border-radius: 24px;
    background: linear-gradient(180deg, rgba(17, 22, 30, 0.94), rgba(7, 11, 18, 0.96));
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.52);
}

#gal-global-overlay .gal-title-cg-gallery-title {
    font-size: clamp(1.28rem, 2.2vw, 1.9rem);
    font-weight: 600;
    letter-spacing: 0.16em;
    color: #ffffff;
    text-shadow: 0 0 18px rgba(154, 199, 255, 0.2);
}

#gal-global-overlay .gal-title-cg-gallery-subtitle {
    color: rgba(245, 247, 250, 0.72);
}

#gal-global-overlay .gal-title-cg-gallery-body {
    padding: 0 18px 18px;
}

#gal-global-overlay .gal-title-cg-gallery-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 24px;
}

#gal-global-overlay .gal-title-cg-gallery-card {
    appearance: none;
    border: none;
    text-align: left;
    padding: 0;
    cursor: zoom-in;
    background: transparent;
    border-radius: 0;
    overflow: visible;
    transform: rotate(-1.4deg);
    transition: transform 0.32s ease, filter 0.32s ease;
}

#gal-global-overlay .gal-title-cg-gallery-card:nth-child(even) {
    transform: rotate(1.2deg);
}

#gal-global-overlay .gal-title-cg-gallery-card:nth-child(3n) {
    transform: rotate(-0.6deg);
}

#gal-global-overlay .gal-title-cg-gallery-card:hover {
    transform: scale(1.04) rotate(0deg);
    z-index: 2;
    filter: drop-shadow(0 18px 36px rgba(0, 0, 0, 0.5));
}

#gal-global-overlay .gal-title-cg-gallery-preview {
    border: 10px solid rgba(255, 255, 255, 0.92);
    border-bottom-width: 16px;
    border-radius: 2px;
    background: #05070d;
    box-shadow: 0 14px 28px rgba(0, 0, 0, 0.4);
}

#gal-global-overlay .gal-title-cg-gallery-preview img {
    filter: saturate(1.02) contrast(1.02);
}

#gal-global-overlay .gal-title-cg-gallery-name {
    padding: 12px 8px 4px;
    font-size: 0.96rem;
    color: #ffffff;
}

#gal-global-overlay .gal-title-cg-gallery-desc {
    padding: 0 8px;
    color: rgba(245, 247, 250, 0.72);
}

#gal-global-overlay .gal-title-cg-lightbox {
    position: absolute;
    inset: 0;
    z-index: 190;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 32px;
    background: rgba(0, 0, 0, 0.92);
}

#gal-global-overlay .gal-title-cg-lightbox.active {
    display: flex;
}

#gal-global-overlay .gal-title-cg-lightbox-frame {
    max-width: min(92vw, 1320px);
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    gap: 14px;
}

#gal-global-overlay .gal-title-cg-lightbox-image {
    max-width: 100%;
    max-height: calc(90vh - 96px);
    object-fit: contain;
    border-radius: 12px;
    box-shadow: 0 0 50px rgba(0, 0, 0, 0.72);
}

#gal-global-overlay .gal-title-cg-lightbox-caption {
    text-align: center;
    color: #ffffff;
}

#gal-global-overlay .gal-title-cg-lightbox-title {
    font-size: 1rem;
    font-weight: 700;
}

#gal-global-overlay .gal-title-cg-lightbox-desc {
    margin-top: 6px;
    color: rgba(245, 247, 250, 0.74);
}

#gal-global-overlay .gal-title-cg-lightbox-close {
    position: absolute;
    top: 18px;
    right: 18px;
    width: 42px;
    height: 42px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.22);
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
    cursor: pointer;
}

@media (max-width: 760px) {
    #gal-global-overlay .gal-title-cg-gallery {
        padding: 10px;
    }

    #gal-global-overlay .gal-title-cg-gallery-panel {
        width: 100%;
        max-height: 92vh;
        border-radius: 16px;
    }

    #gal-global-overlay .gal-title-cg-gallery-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
    }

    #gal-global-overlay .gal-title-cg-lightbox {
        padding: 16px;
    }
}

`;

  const styleEl = targetDoc.createElement('style');
  styleEl.id = `${SCRIPT_ID}-styles`;
  styleEl.textContent = css
    + skinCss
    + styledCss
    + saveLoadCss
    + titleScreenCss
    + immersiveBaseCss
    + saveLoadImmersiveCss
    + saveLoadSlotsCss
    + cgUploadImmersiveCss
    + cgUploadGalleryCss
    + titleGalleryImmersiveCss;
  (targetDoc.head || targetDoc.documentElement).appendChild(styleEl);

  // 皮肤 Web 字体（樱色物语等使用；加载失败时回退到 font-family 中的系统字体）
  const fontLinkId = `${SCRIPT_ID}-skin-fonts`;
  if (!targetDoc.getElementById(fontLinkId)) {
    const fontLink = targetDoc.createElement('link');
    fontLink.id = fontLinkId;
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;600;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=Italiana&display=swap';
    (targetDoc.head || targetDoc.documentElement).appendChild(fontLink);
  }
  console.log(`[${SCRIPT_NAME}] 样式已注入`);
}


