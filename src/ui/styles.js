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
  const css = `__CSS_PLACEHOLDER__`;

  // Galgame UI 皮肤库（基于 UI/UX Pro Max 设计系统重构）
const skinCss = `
/* === 全局皮肤重置 === */
#gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-twilight) .gal-name-badge,
#gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-twilight) .gal-name-badge span,
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
#gal-global-overlay[class*="skin-"]:not(.skin-default):not(.skin-twilight) .gal-name-badge {
    transform: scale(var(--ui-scale, 1)) !important;
    transform-origin: left top !important;
}
#gal-global-overlay[class*="skin-"]:not(.skin-default) .gal-dialog-text {
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
    font-size: 1.04rem !important;
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
        font-size: 0.84rem !important;
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
        font-size: 0.88rem !important;
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
        font-size: 0.88rem !important;
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
        font-size: 0.88rem !important;
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
        font-size: 0.88rem !important;
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
        font-size: 0.88rem !important;
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
        font-size: 0.88rem !important;
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
        font-size: 0.88rem !important;
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
        font-size: 0.88rem !important;
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
        font-size: 0.88rem !important;
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
   2. 自定义皮肤 (Custom Skin) — 元素级图片皮肤
   说明: 由 custom-skin-runtime 注入 CSS 变量
   ========================================================= */
#gal-global-overlay.custom-skin {
    --custom-skin-control-top: clamp(5.2rem, 10vh, 7.2rem);
    --custom-skin-footer-auto-scale: 1;
    --custom-skin-footer-final-scale: calc(var(--ui-scale, 1) * var(--custom-skin-footer-auto-scale, 1));
    font-family: "Noto Serif SC", "Source Han Serif SC", "Georgia", serif;
}

@media screen and (max-width: 48rem) {
    #gal-global-overlay.custom-skin {
        --custom-skin-control-top: clamp(4.7rem, 10vh, 6rem);
    }
}

#gal-global-overlay.custom-skin .gal-game-container {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    background: linear-gradient(180deg, #101722 0%, #1a2433 48%, #0f1723 100%) !important;
    position: relative !important;
    isolation: isolate;
}

#gal-global-overlay.custom-skin .gal-game-content {
    z-index: 4 !important;
}

#gal-global-overlay.custom-skin .custom-skin-element-active {
    border: none !important;
    box-shadow: none !important;
}

#gal-global-overlay.custom-skin .custom-skin-element-active {
    background-color: transparent !important;
    background-repeat: no-repeat !important;
    background-size: 100% 100% !important;
}

#gal-global-overlay.custom-skin .gal-text-panel.custom-skin-element-active {
    background-color: rgba(240, 236, 231, var(--panel-opacity, 0.92)) !important;
    background-image: var(--custom-skin-dialog_panel-normal-image) !important;
    background-size: var(--custom-skin-dialog_panel-bg-size, 100% 100%) !important;
    color: #18212c !important;
    transform: translate(
      calc(var(--custom-skin-dialog_panel-offset-x, 0px) - var(--custom-skin-dialog_panel-anchor-x, 0px)),
      calc(var(--custom-skin-dialog_panel-offset-y, 0px) - var(--custom-skin-dialog_panel-anchor-y, 0px))
    ) !important;
    width: var(--custom-skin-dialog_panel-width, auto) !important;
    height: var(--custom-skin-dialog_panel-height, auto) !important;
    padding-top: var(--custom-skin-dialog-panel-padding-top, 0.9rem) !important;
    padding-right: var(--custom-skin-dialog-panel-padding-right, 1rem) !important;
    padding-bottom: var(--custom-skin-dialog-panel-padding-bottom, 0.6rem) !important;
    padding-left: var(--custom-skin-dialog-panel-padding-left, 1rem) !important;
}

#gal-global-overlay.custom-skin .gal-text-panel.custom-skin-element-active .gal-dialog-text {
    color: #18212c !important;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.32) !important;
}

#gal-global-overlay.custom-skin .gal-name-badge.custom-skin-element-active {
    background-color: rgba(27, 39, 52, 0.88) !important;
    background-image: var(--custom-skin-name_badge-normal-image) !important;
    background-size: var(--custom-skin-name_badge-bg-size, 100% 100%) !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    box-sizing: border-box !important;
    padding: 0 !important;
    overflow: hidden !important;
    transform-origin: left top !important;
    transform: translate(
      calc(var(--custom-skin-name_badge-offset-x, 0px) - var(--custom-skin-name_badge-anchor-x, 0px)),
      calc(var(--custom-skin-name_badge-offset-y, 0px) - var(--custom-skin-name_badge-anchor-y, 0px))
    ) !important;
    width: var(--custom-skin-name_badge-width, auto) !important;
    height: var(--custom-skin-name_badge-height, auto) !important;
}

#gal-global-overlay.custom-skin .gal-name-badge.custom-skin-element-active span {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    padding: 0 clamp(10px, 8%, 22px) !important;
    box-sizing: border-box !important;
    line-height: 1.1 !important;
    white-space: nowrap !important;
    color: #f8fafc !important;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35) !important;
}

#gal-global-overlay.custom-skin .gal-name-badge.custom-skin-element-active.custom-skin-hide-text span,
#gal-global-overlay.custom-skin .gal-action-btn.custom-skin-element-active.custom-skin-hide-text > span,
#gal-global-overlay.custom-skin .gal-action-btn.custom-skin-element-active.custom-skin-hide-text > i,
#gal-global-overlay.custom-skin .gal-footer-btn.custom-skin-element-active.custom-skin-hide-text .gal-btn-text,
#gal-global-overlay.custom-skin .gal-footer-btn.custom-skin-element-active.custom-skin-hide-text i,
#gal-global-overlay.custom-skin .gal-footer-btn-next.custom-skin-element-active.custom-skin-hide-text .gal-btn-text,
#gal-global-overlay.custom-skin .gal-footer-btn-next.custom-skin-element-active.custom-skin-hide-text i,
#gal-global-overlay.custom-skin .gal-pending-choices-btn.custom-skin-element-active.custom-skin-hide-text .gal-btn-text,
#gal-global-overlay.custom-skin .gal-pending-choices-btn.custom-skin-element-active.custom-skin-hide-text i,
#gal-global-overlay.custom-skin .gal-fullscreen-btn.custom-skin-element-active.custom-skin-hide-text > span,
#gal-global-overlay.custom-skin .gal-fullscreen-btn.custom-skin-element-active.custom-skin-hide-text > i,
#gal-global-overlay.custom-skin .gal-bgm-widget.custom-skin-element-active.custom-skin-hide-text .gal-bgm-title {
    display: none !important;
}

#gal-global-overlay.custom-skin .gal-bottom-toolbar.custom-skin-element-active {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    gap: calc(0.5rem * var(--custom-skin-footer-final-scale, 1)) !important;
}

#gal-global-overlay.custom-skin .gal-action-btn.custom-skin-element-active,
#gal-global-overlay.custom-skin .gal-footer-btn.custom-skin-element-active,
#gal-global-overlay.custom-skin .gal-footer-btn-next.custom-skin-element-active,
#gal-global-overlay.custom-skin .gal-pending-choices-btn.custom-skin-element-active,
#gal-global-overlay.custom-skin .gal-fullscreen-btn.custom-skin-element-active {
    background-color: rgba(30, 41, 59, 0.88) !important;
    position: relative !important;
    overflow: visible !important;
    box-sizing: border-box !important;
    min-width: 0 !important;
    min-height: 0 !important;
    padding: 0 !important;
    flex: 0 0 auto !important;
    color: var(--SmartThemeBodyColor, #f8fafc) !important;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55) !important;
}

#gal-global-overlay.custom-skin .gal-action-btn.custom-skin-element-active::before,
#gal-global-overlay.custom-skin .gal-footer-btn.custom-skin-element-active::before,
#gal-global-overlay.custom-skin .gal-footer-btn-next.custom-skin-element-active::before,
#gal-global-overlay.custom-skin .gal-pending-choices-btn.custom-skin-element-active::before,
#gal-global-overlay.custom-skin .gal-fullscreen-btn.custom-skin-element-active::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background-repeat: no-repeat;
    background-size: 100% 100%;
    transition: filter 0.14s ease, transform 0.14s ease;
}

#gal-global-overlay.custom-skin .gal-action-btn.custom-skin-element-active:focus-visible,
#gal-global-overlay.custom-skin .gal-footer-btn.custom-skin-element-active:focus-visible,
#gal-global-overlay.custom-skin .gal-footer-btn-next.custom-skin-element-active:focus-visible,
#gal-global-overlay.custom-skin .gal-pending-choices-btn.custom-skin-element-active:focus-visible,
#gal-global-overlay.custom-skin .gal-fullscreen-btn.custom-skin-element-active:focus-visible {
    outline: none !important;
    box-shadow: 0 0 0 3px rgba(154, 199, 255, 0.42) !important;
}

#gal-global-overlay.custom-skin .gal-action-btn.btn-reroll.custom-skin-element-active {
    width: var(--custom-skin-btn_reroll-width, auto) !important;
    height: var(--custom-skin-btn_reroll-height, auto) !important;
    transform: translate(
      calc(var(--custom-skin-btn_reroll-offset-x, 0px) - var(--custom-skin-btn_reroll-anchor-x, 0px)),
      calc(var(--custom-skin-btn_reroll-offset-y, 0px) - var(--custom-skin-btn_reroll-anchor-y, 0px))
    ) !important;
    clip-path: var(--custom-skin-btn_reroll-normal-hit-clip, none);
    -webkit-clip-path: var(--custom-skin-btn_reroll-normal-hit-clip, none);
}

#gal-global-overlay.custom-skin .gal-action-btn.btn-reroll.custom-skin-element-active::before {
    background-image: var(--custom-skin-btn_reroll-normal-image);
    background-size: var(--custom-skin-btn_reroll-bg-size, 100% 100%);
}

#gal-global-overlay.custom-skin .gal-action-btn.btn-reroll.custom-skin-element-active:hover {
    clip-path: var(--custom-skin-btn_reroll-hover-hit-clip, var(--custom-skin-btn_reroll-normal-hit-clip, none));
    -webkit-clip-path: var(--custom-skin-btn_reroll-hover-hit-clip, var(--custom-skin-btn_reroll-normal-hit-clip, none));
}

#gal-global-overlay.custom-skin .gal-action-btn.btn-reroll.custom-skin-element-active:hover::before {
    background-image: var(--custom-skin-btn_reroll-hover-image, var(--custom-skin-btn_reroll-normal-image));
    filter: brightness(1.08);
}

#gal-global-overlay.custom-skin .gal-action-btn.btn-reroll.custom-skin-element-active:active {
    clip-path: var(--custom-skin-btn_reroll-active-hit-clip, var(--custom-skin-btn_reroll-hover-hit-clip, var(--custom-skin-btn_reroll-normal-hit-clip, none)));
    -webkit-clip-path: var(--custom-skin-btn_reroll-active-hit-clip, var(--custom-skin-btn_reroll-hover-hit-clip, var(--custom-skin-btn_reroll-normal-hit-clip, none)));
}

#gal-global-overlay.custom-skin .gal-action-btn.btn-reroll.custom-skin-element-active:active::before {
    background-image: var(--custom-skin-btn_reroll-active-image, var(--custom-skin-btn_reroll-hover-image, var(--custom-skin-btn_reroll-normal-image)));
    filter: brightness(0.94);
    transform: translateY(1px);
}

#gal-global-overlay.custom-skin .gal-action-btn.btn-free.custom-skin-element-active {
    width: var(--custom-skin-btn_free_input-width, auto) !important;
    height: var(--custom-skin-btn_free_input-height, auto) !important;
    transform: translate(
      calc(var(--custom-skin-btn_free_input-offset-x, 0px) - var(--custom-skin-btn_free_input-anchor-x, 0px)),
      calc(var(--custom-skin-btn_free_input-offset-y, 0px) - var(--custom-skin-btn_free_input-anchor-y, 0px))
    ) !important;
    clip-path: var(--custom-skin-btn_free_input-normal-hit-clip, none);
    -webkit-clip-path: var(--custom-skin-btn_free_input-normal-hit-clip, none);
}

#gal-global-overlay.custom-skin .gal-action-btn.btn-free.custom-skin-element-active::before {
    background-image: var(--custom-skin-btn_free_input-normal-image);
    background-size: var(--custom-skin-btn_free_input-bg-size, 100% 100%);
}

#gal-global-overlay.custom-skin .gal-action-btn.btn-free.custom-skin-element-active:hover {
    clip-path: var(--custom-skin-btn_free_input-hover-hit-clip, var(--custom-skin-btn_free_input-normal-hit-clip, none));
    -webkit-clip-path: var(--custom-skin-btn_free_input-hover-hit-clip, var(--custom-skin-btn_free_input-normal-hit-clip, none));
}

#gal-global-overlay.custom-skin .gal-action-btn.btn-free.custom-skin-element-active:hover::before {
    background-image: var(--custom-skin-btn_free_input-hover-image, var(--custom-skin-btn_free_input-normal-image));
    filter: brightness(1.08);
}

#gal-global-overlay.custom-skin .gal-action-btn.btn-free.custom-skin-element-active:active {
    clip-path: var(--custom-skin-btn_free_input-active-hit-clip, var(--custom-skin-btn_free_input-hover-hit-clip, var(--custom-skin-btn_free_input-normal-hit-clip, none)));
    -webkit-clip-path: var(--custom-skin-btn_free_input-active-hit-clip, var(--custom-skin-btn_free_input-hover-hit-clip, var(--custom-skin-btn_free_input-normal-hit-clip, none)));
}

#gal-global-overlay.custom-skin .gal-action-btn.btn-free.custom-skin-element-active:active::before {
    background-image: var(--custom-skin-btn_free_input-active-image, var(--custom-skin-btn_free_input-hover-image, var(--custom-skin-btn_free_input-normal-image)));
    filter: brightness(0.94);
    transform: translateY(1px);
}

#gal-global-overlay.custom-skin .gal-footer-btn.custom-skin-element-active {
    width: calc(var(--custom-skin-footer_btn_common-width, 0px) * var(--custom-skin-footer-final-scale, 1)) !important;
    height: calc(var(--custom-skin-footer_btn_common-height, 0px) * var(--custom-skin-footer-final-scale, 1)) !important;
    transform: translate(
      calc((var(--custom-skin-footer_btn_common-offset-x, 0px) - var(--custom-skin-footer_btn_common-anchor-x, 0px)) * var(--custom-skin-footer-final-scale, 1)),
      calc((var(--custom-skin-footer_btn_common-offset-y, 0px) - var(--custom-skin-footer_btn_common-anchor-y, 0px)) * var(--custom-skin-footer-final-scale, 1))
    ) !important;
    clip-path: var(--custom-skin-footer_btn_common-normal-hit-clip, none);
    -webkit-clip-path: var(--custom-skin-footer_btn_common-normal-hit-clip, none);
}

#gal-global-overlay.custom-skin .gal-footer-btn.custom-skin-element-active::before {
    background-image: var(--custom-skin-footer_btn_common-normal-image);
    background-size: var(--custom-skin-footer_btn_common-bg-size, 100% 100%);
}

#gal-global-overlay.custom-skin .gal-footer-btn.custom-skin-element-active:hover {
    clip-path: var(--custom-skin-footer_btn_common-hover-hit-clip, var(--custom-skin-footer_btn_common-normal-hit-clip, none));
    -webkit-clip-path: var(--custom-skin-footer_btn_common-hover-hit-clip, var(--custom-skin-footer_btn_common-normal-hit-clip, none));
}

#gal-global-overlay.custom-skin .gal-footer-btn.custom-skin-element-active:hover::before {
    background-image: var(--custom-skin-footer_btn_common-hover-image, var(--custom-skin-footer_btn_common-normal-image));
    filter: brightness(1.08);
}

#gal-global-overlay.custom-skin .gal-footer-btn.custom-skin-element-active:active {
    clip-path: var(--custom-skin-footer_btn_common-active-hit-clip, var(--custom-skin-footer_btn_common-hover-hit-clip, var(--custom-skin-footer_btn_common-normal-hit-clip, none)));
    -webkit-clip-path: var(--custom-skin-footer_btn_common-active-hit-clip, var(--custom-skin-footer_btn_common-hover-hit-clip, var(--custom-skin-footer_btn_common-normal-hit-clip, none)));
}

#gal-global-overlay.custom-skin .gal-footer-btn.custom-skin-element-active:active::before {
    background-image: var(--custom-skin-footer_btn_common-active-image, var(--custom-skin-footer_btn_common-hover-image, var(--custom-skin-footer_btn_common-normal-image)));
    filter: brightness(0.94);
    transform: translateY(1px);
}

#gal-global-overlay.custom-skin .gal-pending-choices-btn.custom-skin-element-active {
    width: calc(var(--custom-skin-footer_btn_choices-width, 0px) * var(--custom-skin-footer-final-scale, 1)) !important;
    height: calc(var(--custom-skin-footer_btn_choices-height, 0px) * var(--custom-skin-footer-final-scale, 1)) !important;
    transform: translate(
      calc((var(--custom-skin-footer_btn_choices-offset-x, 0px) - var(--custom-skin-footer_btn_choices-anchor-x, 0px)) * var(--custom-skin-footer-final-scale, 1)),
      calc((var(--custom-skin-footer_btn_choices-offset-y, 0px) - var(--custom-skin-footer_btn_choices-anchor-y, 0px)) * var(--custom-skin-footer-final-scale, 1))
    ) !important;
    clip-path: var(--custom-skin-footer_btn_choices-normal-hit-clip, none);
    -webkit-clip-path: var(--custom-skin-footer_btn_choices-normal-hit-clip, none);
}

#gal-global-overlay.custom-skin .gal-pending-choices-btn.custom-skin-element-active::before {
    background-image: var(--custom-skin-footer_btn_choices-normal-image);
    background-size: var(--custom-skin-footer_btn_choices-bg-size, 100% 100%);
}

#gal-global-overlay.custom-skin .gal-pending-choices-btn.custom-skin-element-active:hover {
    clip-path: var(--custom-skin-footer_btn_choices-hover-hit-clip, var(--custom-skin-footer_btn_choices-normal-hit-clip, none));
    -webkit-clip-path: var(--custom-skin-footer_btn_choices-hover-hit-clip, var(--custom-skin-footer_btn_choices-normal-hit-clip, none));
}

#gal-global-overlay.custom-skin .gal-pending-choices-btn.custom-skin-element-active:hover::before {
    background-image: var(--custom-skin-footer_btn_choices-hover-image, var(--custom-skin-footer_btn_choices-normal-image));
    filter: brightness(1.08);
}

#gal-global-overlay.custom-skin .gal-pending-choices-btn.custom-skin-element-active:active {
    clip-path: var(--custom-skin-footer_btn_choices-active-hit-clip, var(--custom-skin-footer_btn_choices-hover-hit-clip, var(--custom-skin-footer_btn_choices-normal-hit-clip, none)));
    -webkit-clip-path: var(--custom-skin-footer_btn_choices-active-hit-clip, var(--custom-skin-footer_btn_choices-hover-hit-clip, var(--custom-skin-footer_btn_choices-normal-hit-clip, none)));
}

#gal-global-overlay.custom-skin .gal-pending-choices-btn.custom-skin-element-active:active::before {
    background-image: var(--custom-skin-footer_btn_choices-active-image, var(--custom-skin-footer_btn_choices-hover-image, var(--custom-skin-footer_btn_choices-normal-image)));
    filter: brightness(0.94);
    transform: translateY(1px);
}

#gal-global-overlay.custom-skin .gal-footer-btn-next.custom-skin-element-active {
    width: calc(var(--custom-skin-footer_btn_next-width, 0px) * var(--custom-skin-footer-final-scale, 1)) !important;
    height: calc(var(--custom-skin-footer_btn_next-height, 0px) * var(--custom-skin-footer-final-scale, 1)) !important;
    transform: translate(
      calc((var(--custom-skin-footer_btn_next-offset-x, 0px) - var(--custom-skin-footer_btn_next-anchor-x, 0px)) * var(--custom-skin-footer-final-scale, 1)),
      calc((var(--custom-skin-footer_btn_next-offset-y, 0px) - var(--custom-skin-footer_btn_next-anchor-y, 0px)) * var(--custom-skin-footer-final-scale, 1))
    ) !important;
    clip-path: var(--custom-skin-footer_btn_next-normal-hit-clip, none);
    -webkit-clip-path: var(--custom-skin-footer_btn_next-normal-hit-clip, none);
}

#gal-global-overlay.custom-skin .gal-footer-btn.custom-skin-element-active .gal-btn-text,
#gal-global-overlay.custom-skin .gal-footer-btn.custom-skin-element-active i,
#gal-global-overlay.custom-skin .gal-pending-choices-btn.custom-skin-element-active .gal-btn-text,
#gal-global-overlay.custom-skin .gal-pending-choices-btn.custom-skin-element-active i,
#gal-global-overlay.custom-skin .gal-footer-btn-next.custom-skin-element-active .gal-btn-text,
#gal-global-overlay.custom-skin .gal-footer-btn-next.custom-skin-element-active i {
    font-size: calc(1em * var(--custom-skin-footer-auto-scale, 1)) !important;
}

#gal-global-overlay.custom-skin .gal-footer-btn-next.custom-skin-element-active::before {
    background-image: var(--custom-skin-footer_btn_next-normal-image);
    background-size: var(--custom-skin-footer_btn_next-bg-size, 100% 100%);
}

#gal-global-overlay.custom-skin .gal-footer-btn-next.custom-skin-element-active:hover {
    clip-path: var(--custom-skin-footer_btn_next-hover-hit-clip, var(--custom-skin-footer_btn_next-normal-hit-clip, none));
    -webkit-clip-path: var(--custom-skin-footer_btn_next-hover-hit-clip, var(--custom-skin-footer_btn_next-normal-hit-clip, none));
}

#gal-global-overlay.custom-skin .gal-footer-btn-next.custom-skin-element-active:hover::before {
    background-image: var(--custom-skin-footer_btn_next-hover-image, var(--custom-skin-footer_btn_next-normal-image));
    filter: brightness(1.08);
}

#gal-global-overlay.custom-skin .gal-footer-btn-next.custom-skin-element-active:active {
    clip-path: var(--custom-skin-footer_btn_next-active-hit-clip, var(--custom-skin-footer_btn_next-hover-hit-clip, var(--custom-skin-footer_btn_next-normal-hit-clip, none)));
    -webkit-clip-path: var(--custom-skin-footer_btn_next-active-hit-clip, var(--custom-skin-footer_btn_next-hover-hit-clip, var(--custom-skin-footer_btn_next-normal-hit-clip, none)));
}

#gal-global-overlay.custom-skin .gal-footer-btn-next.custom-skin-element-active:active::before {
    background-image: var(--custom-skin-footer_btn_next-active-image, var(--custom-skin-footer_btn_next-hover-image, var(--custom-skin-footer_btn_next-normal-image)));
    filter: brightness(0.94);
    transform: translateY(1px);
}

#gal-global-overlay.custom-skin .gal-fullscreen-btn.custom-skin-element-active,
#gal-global-overlay.custom-skin .gal-bgm-widget.custom-skin-element-active {
    top: var(--custom-skin-control-top, clamp(5.2rem, 10vh, 7.2rem)) !important;
}

#gal-global-overlay.custom-skin .gal-fullscreen-btn.custom-skin-element-active {
    width: var(--custom-skin-fullscreen_btn-width, auto) !important;
    height: var(--custom-skin-fullscreen_btn-height, auto) !important;
    transform: translate(
      calc(var(--custom-skin-fullscreen_btn-offset-x, 0px) - var(--custom-skin-fullscreen_btn-anchor-x, 0px)),
      calc(var(--custom-skin-fullscreen_btn-offset-y, 0px) - var(--custom-skin-fullscreen_btn-anchor-y, 0px))
    ) !important;
    clip-path: var(--custom-skin-fullscreen_btn-normal-hit-clip, none);
    -webkit-clip-path: var(--custom-skin-fullscreen_btn-normal-hit-clip, none);
}

#gal-global-overlay.custom-skin .gal-fullscreen-btn.custom-skin-element-active::before {
    background-image: var(--custom-skin-fullscreen_btn-normal-image);
    background-size: var(--custom-skin-fullscreen_btn-bg-size, 100% 100%);
}

#gal-global-overlay.custom-skin .gal-fullscreen-btn.custom-skin-element-active:hover {
    clip-path: var(--custom-skin-fullscreen_btn-hover-hit-clip, var(--custom-skin-fullscreen_btn-normal-hit-clip, none));
    -webkit-clip-path: var(--custom-skin-fullscreen_btn-hover-hit-clip, var(--custom-skin-fullscreen_btn-normal-hit-clip, none));
}

#gal-global-overlay.custom-skin .gal-fullscreen-btn.custom-skin-element-active:hover::before {
    background-image: var(--custom-skin-fullscreen_btn-hover-image, var(--custom-skin-fullscreen_btn-normal-image));
    filter: brightness(1.08);
}

#gal-global-overlay.custom-skin .gal-fullscreen-btn.custom-skin-element-active:active {
    clip-path: var(--custom-skin-fullscreen_btn-active-hit-clip, var(--custom-skin-fullscreen_btn-hover-hit-clip, var(--custom-skin-fullscreen_btn-normal-hit-clip, none)));
    -webkit-clip-path: var(--custom-skin-fullscreen_btn-active-hit-clip, var(--custom-skin-fullscreen_btn-hover-hit-clip, var(--custom-skin-fullscreen_btn-normal-hit-clip, none)));
}

#gal-global-overlay.custom-skin .gal-fullscreen-btn.custom-skin-element-active:active::before {
    background-image: var(--custom-skin-fullscreen_btn-active-image, var(--custom-skin-fullscreen_btn-hover-image, var(--custom-skin-fullscreen_btn-normal-image)));
    filter: brightness(0.94);
    transform: translateY(1px);
}

#gal-global-overlay.custom-skin .gal-bgm-widget.custom-skin-element-active {
    background-color: rgba(22, 31, 44, 0.88) !important;
    background-image: var(--custom-skin-bgm_widget-normal-image) !important;
    background-size: var(--custom-skin-bgm_widget-bg-size, 100% 100%) !important;
    width: var(--custom-skin-bgm_widget-width, auto) !important;
    height: var(--custom-skin-bgm_widget-height, auto) !important;
    transform: translate(
      calc(var(--custom-skin-bgm_widget-offset-x, 0px) - var(--custom-skin-bgm_widget-anchor-x, 0px)),
      calc(var(--custom-skin-bgm_widget-offset-y, 0px) - var(--custom-skin-bgm_widget-anchor-y, 0px))
    ) !important;
    color: var(--SmartThemeBodyColor, #f8fafc) !important;
}

#gal-global-overlay.custom-skin .custom-skin-element-active.custom-skin-has-normal-image,
#gal-global-overlay.custom-skin .custom-skin-element-active.custom-skin-has-hover-image:hover,
#gal-global-overlay.custom-skin .custom-skin-element-active.custom-skin-has-active-image:active {
    background-color: transparent !important;
}

#gal-global-overlay.custom-skin .gal-progress-bar {
    background: linear-gradient(90deg, #6aa3d4, #b9d6f2, #7db4de) !important;
    box-shadow: 0 0 8px rgba(125, 180, 222, 0.28) !important;
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
  console.log(`[${SCRIPT_NAME}] 样式已注入`);
}


