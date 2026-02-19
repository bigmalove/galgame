import { SCRIPT_ID, SCRIPT_NAME } from '../core/constants.js';
import { topWindow } from '../core/env.js';
import { METAL_TEXTURE, PARCHMENT_TEXTURE, WOOD_TEXTURE } from './dnd-textures.js';

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
   2. 冒险者酒馆 (Western) — 龙与地下城 D&D 风格
   严格按参考图还原: 羊皮纸卷轴 · 华丽金属边框 · 暗铁按钮
   ========================================================= */
#gal-global-overlay.skin-western {
    font-family: "Georgia", "Palatino Linotype", "Times New Roman", serif;
}

/* 游戏容器 — 深木质外框 + 金属角饰效果 */
#gal-global-overlay.skin-western .gal-game-container {
    border: calc(5px * var(--ui-scale, 1)) solid #3A2517 !important;
    border-radius: calc(6px * var(--ui-scale, 1)) !important;
    outline: calc(2px * var(--ui-scale, 1)) solid #5A3D25 !important;
    outline-offset: calc(-7px * var(--ui-scale, 1)) !important;
    box-shadow:
        inset 0 0 calc(40px * var(--ui-scale, 1)) rgba(0,0,0,0.3),
        0 0 calc(30px * var(--ui-scale, 1)) rgba(0,0,0,0.8),
        0 0 calc(80px * var(--ui-scale, 1)) rgba(0,0,0,0.4) !important;
}

/* 背景层 — 深色木纹纹理（无背景图时的兜底） */
#gal-global-overlay.skin-western .gal-layer-bg {
    background-color: #2A1A0E !important;
    background-image: url(${WOOD_TEXTURE}) !important;
    background-size: cover !important;
}

/* ===== 文字面板 — 羊皮纸纹理 + 华丽多层边框 ===== */
#gal-global-overlay.skin-western .gal-text-panel {
    background-color: rgba(216, 200, 168, var(--panel-opacity, 0.96)) !important;
    background-image: url(${PARCHMENT_TEXTURE}) !important;
    background-size: cover !important;
    background-blend-mode: multiply !important;
    /* 主边框 — 暗棕/皮革色 */
    border: calc(4px * var(--ui-scale, 1)) solid #5A3D25 !important;
    border-radius: calc(3px * var(--ui-scale, 1)) !important;
    /* outline 做第二层金色装饰边框 */
    outline: calc(3px * var(--ui-scale, 1)) solid #8B6914 !important;
    outline-offset: calc(-8px * var(--ui-scale, 1)) !important;
    box-shadow:
        /* 最内层：暗色渐晕（模拟羊皮纸边缘发暗） */
        inset 0 0 calc(50px * var(--ui-scale, 1)) rgba(90,61,37,0.3),
        inset 0 0 calc(100px * var(--ui-scale, 1)) rgba(42,26,14,0.15),
        /* 外层金色装饰 */
        0 0 0 calc(6px * var(--ui-scale, 1)) #8B6914,
        0 0 0 calc(8px * var(--ui-scale, 1)) #3A2517,
        0 0 0 calc(10px * var(--ui-scale, 1)) #6B4F0A,
        0 0 0 calc(12px * var(--ui-scale, 1)) #2A1A0E,
        /* 投影 */
        0 calc(8px * var(--ui-scale, 1)) calc(30px * var(--ui-scale, 1)) rgba(0,0,0,0.6) !important;
}

/* 参考图: 对话文字深棕墨色写在羊皮纸上 */
#gal-global-overlay.skin-western .gal-dialog-text {
    color: #2C1A0E !important;
    text-shadow: 0 1px 0 rgba(216,200,168,0.5) !important;
    letter-spacing: 0.5px;
    font-family: "Georgia", "Palatino Linotype", serif !important;
}

/* 参考图: 名牌 — 深皮革底 + 金边 + 浅金字 */
#gal-global-overlay.skin-western .gal-name-badge {
    background-color: #2A1A0E !important;
    background-image: none !important;
    color: #D4BC94 !important;
    border: calc(2px * var(--ui-scale, 1)) solid #8B6914 !important;
    border-radius: calc(2px * var(--ui-scale, 1)) !important;
    box-shadow:
        inset 0 1px 0 rgba(139,105,20,0.25),
        inset 0 -1px 0 rgba(0,0,0,0.5),
        0 0 0 calc(1px * var(--ui-scale, 1)) #3A2517,
        0 calc(3px * var(--ui-scale, 1)) calc(10px * var(--ui-scale, 1)) rgba(0,0,0,0.7) !important;
    padding: calc(0.4rem * var(--ui-scale, 1)) calc(1.6rem * var(--ui-scale, 1)) !important;
    left: 15px !important; top: -20px !important;
}
#gal-global-overlay.skin-western .gal-name-badge span {
    font-weight: 700; text-shadow: 0 0 6px rgba(139,105,20,0.3), 0 1px 2px rgba(0,0,0,0.8); letter-spacing: 2px;
    font-family: "Georgia", serif !important;
    color: #D4BC94 !important;
}

/* 参考图: 底部工具栏 — 暗铁底板 + 金属纹理 */
#gal-global-overlay.skin-western .gal-bottom-toolbar {
    background-color: rgba(32, 20, 12, 0.9) !important;
    background-image: url(${METAL_TEXTURE}) !important;
    background-size: cover !important;
    background-blend-mode: overlay !important;
    border-top: calc(2px * var(--ui-scale, 1)) solid #5A3D25 !important;
    box-shadow: inset 0 1px 0 rgba(139,105,20,0.12) !important;
}

/* 参考图: 普通按钮 — 暗铁圆章（深棕色圆形金属徽章） */
#gal-global-overlay.skin-western .gal-footer-btn,
#gal-global-overlay.skin-western .gal-pending-choices-btn {
    background-color: #342820 !important;
    background-image: none !important;
    border: calc(2px * var(--ui-scale, 1)) solid #5A4A38 !important;
    color: #C9B89A !important;
    border-radius: calc(20px * var(--ui-scale, 1)) !important;
    box-shadow:
        inset 0 1px 0 rgba(201,168,108,0.1),
        inset 0 -1px 2px rgba(0,0,0,0.5),
        0 calc(2px * var(--ui-scale, 1)) calc(4px * var(--ui-scale, 1)) rgba(0,0,0,0.7) !important;
    transition: all 0.2s ease-out !important;
    font-weight: 600 !important;
    font-family: "Georgia", serif !important;
    text-shadow: 0 1px 2px rgba(0,0,0,0.8) !important;
}

/* 参考图: NEXT 按钮 — 暗铁矩形 + 琥珀金边 */
#gal-global-overlay.skin-western .gal-footer-btn-next {
    background-color: #2A1E16 !important;
    background-image: none !important;
    border: calc(2px * var(--ui-scale, 1)) solid #8B6914 !important;
    color: #E8D5B5 !important;
    border-radius: calc(4px * var(--ui-scale, 1)) !important;
    box-shadow:
        inset 0 1px 0 rgba(201,168,108,0.15),
        inset 0 -1px 2px rgba(0,0,0,0.5),
        0 0 calc(8px * var(--ui-scale, 1)) rgba(139,105,20,0.15),
        0 calc(3px * var(--ui-scale, 1)) calc(8px * var(--ui-scale, 1)) rgba(0,0,0,0.7) !important;
    font-weight: 900 !important;
    text-shadow: 0 0 6px rgba(232,168,76,0.15), 0 1px 2px rgba(0,0,0,0.8) !important;
    font-family: "Georgia", serif !important;
    transition: all 0.2s ease-out !important;
}

/* 参考图: 交互按钮（重绘/自由对话） — 同暗铁风格 */
#gal-global-overlay.skin-western .gal-action-btn {
    background-color: #342820 !important;
    background-image: none !important;
    border: calc(2px * var(--ui-scale, 1)) solid #5A4A38 !important;
    color: #B8A888 !important;
    border-radius: calc(4px * var(--ui-scale, 1)) !important;
    box-shadow:
        inset 0 1px 0 rgba(201,168,108,0.08),
        0 calc(2px * var(--ui-scale, 1)) calc(4px * var(--ui-scale, 1)) rgba(0,0,0,0.6) !important;
    font-family: "Georgia", serif !important;
    text-shadow: 0 1px 2px rgba(0,0,0,0.8) !important;
    transition: all 0.2s ease-out !important;
}

/* Hover — 金色微光 */
#gal-global-overlay.skin-western .gal-footer-btn:hover,
#gal-global-overlay.skin-western .gal-action-btn:hover,
#gal-global-overlay.skin-western .gal-pending-choices-btn:hover {
    background-color: #4A3A2E !important;
    color: #E8D5B5 !important; border-color: #8B6914 !important;
    box-shadow:
        inset 0 1px 0 rgba(232,168,76,0.2),
        0 0 calc(10px * var(--ui-scale, 1)) rgba(139,105,20,0.12) !important;
}
#gal-global-overlay.skin-western .gal-footer-btn-next:hover {
    background-color: #3A2E22 !important;
    border-color: #C9A84C !important;
    box-shadow:
        inset 0 1px 0 rgba(232,168,76,0.25),
        0 0 calc(16px * var(--ui-scale, 1)) rgba(232,168,76,0.2),
        0 0 calc(30px * var(--ui-scale, 1)) rgba(139,105,20,0.08),
        0 calc(3px * var(--ui-scale, 1)) calc(8px * var(--ui-scale, 1)) rgba(0,0,0,0.6) !important;
    color: #FFE8C0 !important;
    text-shadow: 0 0 8px rgba(232,168,76,0.3), 0 1px 2px rgba(0,0,0,0.8) !important;
}

/* Active 状态 */
#gal-global-overlay.skin-western .gal-footer-btn:active,
#gal-global-overlay.skin-western .gal-action-btn:active,
#gal-global-overlay.skin-western .gal-pending-choices-btn:active,
#gal-global-overlay.skin-western .gal-footer-btn-next:active {
    transform: translateY(1px) !important; box-shadow: inset 0 2px 6px rgba(0,0,0,0.7) !important;
}

/* 全屏按钮 — 铁质勋章 */
#gal-global-overlay.skin-western .gal-fullscreen-btn {
    background-color: #2A1E16 !important;
    background-image: none !important;
    border: calc(2px * var(--ui-scale, 1)) solid #5A4A38 !important;
    color: #C9A84C !important;
    border-radius: calc(4px * var(--ui-scale, 1)) !important;
    box-shadow: 0 calc(2px * var(--ui-scale, 1)) calc(8px * var(--ui-scale, 1)) rgba(0,0,0,0.6) !important;
}
#gal-global-overlay.skin-western .gal-fullscreen-btn:hover {
    background-color: #3A2E22 !important;
    border-color: #8B6914 !important;
    color: #E8D5B5 !important;
}

/* 状态栏（地点/时间） — 铁牌 */
#gal-global-overlay.skin-western .gal-location-bar,
#gal-global-overlay.skin-western .gal-time-bar {
    background-color: rgba(42, 30, 22, 0.95) !important;
    background-image: none !important;
    border: calc(1px * var(--ui-scale, 1)) solid #5A4A38 !important;
    border-radius: calc(3px * var(--ui-scale, 1)) !important;
    box-shadow: inset 0 1px 0 rgba(201,168,108,0.08), 0 calc(2px * var(--ui-scale, 1)) calc(6px * var(--ui-scale, 1)) rgba(0,0,0,0.5) !important;
    color: #C9B89A !important;
}
#gal-global-overlay.skin-western .gal-location-bar i,
#gal-global-overlay.skin-western .gal-time-bar i { color: #C9A84C !important; }

/* 交互栏定位 */
#gal-global-overlay.skin-western .gal-interaction-bar { right: 10px !important; }

/* 进度条 — 古铜渐变 */
#gal-global-overlay.skin-western .gal-progress-bar { background: linear-gradient(90deg, #6B4F0A, #C9A84C, #8B6914) !important; box-shadow: 0 0 8px rgba(232,168,76,0.3) !important; }

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
