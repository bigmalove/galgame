import { VERSION } from '../core/constants.js';
import { topWindow } from '../core/env.js';
import { getBaseInterfaceCss } from './styles.js';

// ============================================
// 自定义皮肤模板与 AI 技术规格说明
// 所见即所得原理：模板内嵌真实界面的完整基线 CSS（getBaseInterfaceCss，
// 即构建时注入的 数据库界面插件.css），舞台 DOM 结构逐字复刻
// overlay.js buildDefaultOverlayInnerHtml 与 choices.js ensureChoicesLayer。
// 修改那两处结构时必须同步此模板。
// 页面排版参考 doc/皮肤翻新提案-*.html 的提案页样式。
// ============================================

/**
 * 模板/提示词共用的选择器清单（防两处漂移）。
 */
export const HTML_SKIN_ALLOWED_SELECTOR_HINTS = [
  { selector: '#gal-global-overlay', desc: '游戏界面根容器（皮肤激活时带 .html-skin class）' },
  { selector: '.gal-game-container', desc: '游戏画面容器（主舞台）' },
  { selector: '.gal-status-bar-container', desc: '右上角状态栏容器（在全屏按钮左侧）' },
  { selector: '.gal-location-bar / .gal-time-bar', desc: '地点栏 / 时间栏（内含 i 图标与 .gal-location-text/.gal-time-text）' },
  { selector: '.gal-fullscreen-btn', desc: '右上角全屏切换按钮' },
  { selector: '.gal-layer-bg / .gal-bg-layer', desc: '背景图层（无背景图时显示 .gal-layer-bg::before 默认舞台纹理）' },
  { selector: '.gal-layer-character .gal-char-slot', desc: '立绘槽位（slot-left / slot-center / slot-right）' },
  { selector: '.gal-char-container > .gal-char-img', desc: '立绘容器与立绘图片' },
  { selector: '.gal-dialog-layer', desc: '对话框整层（含姓名牌、文本面板、底栏、进度条）' },
  { selector: '.gal-name-badge', desc: '角色姓名牌（内含 span；::after 为底部强调线）' },
  { selector: '.gal-sprite-toggle / .gal-status-popup-trigger', desc: '对话框右上方的立绘开关 / 弹窗小按钮' },
  { selector: '.gal-interaction-bar .gal-action-btn', desc: '重绘/自由对话按钮（.btn-reroll / .btn-free）' },
  { selector: '.gal-text-panel', desc: '对话文本面板' },
  { selector: '.gal-dialog-text', desc: '对话正文文字' },
  { selector: '.gal-bottom-toolbar', desc: '底部功能栏' },
  { selector: '.gal-footer-btn', desc: '底栏功能按钮（data-action=log/close-mode/view-original/config/save/load/timeline）' },
  { selector: '.gal-footer-btn.gal-nav-btn', desc: '导航按钮（data-action=prev/auto/skip）' },
  { selector: '.gal-pending-choices-btn', desc: '"剧情选项"提示按钮' },
  { selector: '.gal-footer-btn-next', desc: 'NEXT 下一段按钮' },
  { selector: '.gal-btn-text', desc: '按钮内文字标签' },
  { selector: '.gal-progress-container / .gal-progress-bar', desc: '生成进度条' },
  { selector: '.gal-generating-indicator', desc: '生成中指示器（.active 时显示）' },
  { selector: '.gal-mobile-menu .gal-menu-btn', desc: '移动端上拉菜单及其按钮' },
  { selector: '#gal-layer-choices', desc: '剧情选项弹层（独立于 overlay 挂载，皮肤激活时带 .html-skin class）' },
  { selector: '.gal-choices-title / .gal-choices-container / .gal-choice-card / .gal-choices-hint', desc: '选项层标题 / 容器 / 选项卡片 / 提示文字' },
];

const SELECTOR_HINTS_TEXT = HTML_SKIN_ALLOWED_SELECTOR_HINTS.map(
  item => `- \`${item.selector}\` —— ${item.desc}`,
).join('\n');

// 示例皮肤（樱夜）——仅演示叠加机制，交给 AI 后整块替换
const EXAMPLE_SKIN_CSS = `  /* ============================================================
     在此编写皮肤样式。以下为示例皮肤"樱夜"，仅演示叠加机制，可整块替换。
     注意：基线样式（gal-base-style）中许多规则带 !important，
     想覆盖它们时你的规则也要加 !important。
     ============================================================ */
  #gal-global-overlay .gal-text-panel {
    background: linear-gradient(165deg, rgba(46, 20, 42, 0.93), rgba(24, 12, 30, 0.9)) !important;
    border: 1px solid rgba(255, 145, 185, 0.55) !important;
    border-radius: 14px !important;
    box-shadow: 0 8px 32px rgba(255, 95, 143, 0.18) !important;
  }
  #gal-global-overlay .gal-dialog-text {
    color: #ffe9f2 !important;
    text-shadow: 0 1px 3px rgba(90, 20, 50, 0.6);
  }
  #gal-global-overlay .gal-name-badge {
    background: linear-gradient(135deg, #ff5f8f, #b04bff) !important;
    color: #fff !important;
    border-radius: 10px 10px 0 0 !important;
    box-shadow: 0 4px 14px rgba(255, 95, 143, 0.45) !important;
  }
  #gal-global-overlay .gal-name-badge::after {
    background: #ffd7e5 !important;
  }
  #gal-global-overlay .gal-footer-btn,
  #gal-global-overlay .gal-pending-choices-btn {
    background: rgba(46, 20, 42, 0.88) !important;
    color: #ffd7e5 !important;
    border-color: rgba(255, 145, 185, 0.55) !important;
    border-radius: 8px !important;
    transform: none !important;
  }
  #gal-global-overlay .gal-footer-btn i,
  #gal-global-overlay .gal-footer-btn span,
  #gal-global-overlay .gal-pending-choices-btn i,
  #gal-global-overlay .gal-pending-choices-btn span {
    transform: none !important;
  }
  #gal-global-overlay .gal-footer-btn:hover {
    background: #ff5f8f !important;
    color: #fff !important;
  }
  #gal-global-overlay .gal-footer-btn-next {
    background: linear-gradient(135deg, #ff5f8f, #b04bff) !important;
    color: #fff !important;
    border-color: rgba(255, 215, 229, 0.7) !important;
    clip-path: none !important;
    border-radius: 10px !important;
  }
  #gal-global-overlay .gal-action-btn {
    background: rgba(46, 20, 42, 0.88) !important;
    color: #ffd7e5 !important;
    border-color: rgba(255, 145, 185, 0.55) !important;
    transform: none !important;
    border-radius: 10px !important;
    box-shadow: 0 4px 14px rgba(255, 95, 143, 0.25) !important;
  }
  #gal-global-overlay .gal-action-btn span,
  #gal-global-overlay .gal-action-btn i {
    transform: none !important;
  }
  #gal-global-overlay .gal-action-btn:hover {
    background: #ff5f8f !important;
    color: #fff !important;
  }
  #gal-global-overlay .gal-location-bar,
  #gal-global-overlay .gal-time-bar,
  #gal-global-overlay .gal-fullscreen-btn {
    background: rgba(46, 20, 42, 0.85) !important;
    color: #ffd7e5 !important;
    border: 1px solid rgba(255, 145, 185, 0.5) !important;
    border-radius: 999px !important;
  }
  #gal-global-overlay .gal-progress-bar {
    background: linear-gradient(90deg, #ff5f8f, #b04bff) !important;
    box-shadow: 0 0 0.625rem rgba(255, 95, 143, 0.6) !important;
  }
  #gal-layer-choices .gal-choice-card {
    background: rgba(46, 20, 42, 0.94) !important;
    color: #ffe9f2 !important;
    border: 1px solid rgba(255, 145, 185, 0.55) !important;
    border-radius: 12px !important;
    transform: none !important;
    box-shadow: 0 4px 18px rgba(255, 95, 143, 0.25) !important;
  }
  #gal-layer-choices .gal-choice-card span {
    transform: none !important;
  }
  #gal-layer-choices .gal-choice-card:hover {
    border-color: #ff5f8f !important;
    background: rgba(70, 28, 58, 0.96) !important;
  }`;

// 演示用立绘剪影（内联 SVG，加载进真实的 .gal-char-img 节点）
const DEMO_SPRITE_SVG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 720'><defs><linearGradient id='b' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='%233b3550'/><stop offset='1' stop-color='%23191622'/></linearGradient><linearGradient id='fade' x1='0' y1='0' x2='0' y2='1'><stop offset='0.72' stop-color='white'/><stop offset='1' stop-color='white' stop-opacity='0'/></linearGradient><mask id='m'><rect width='320' height='720' fill='url(%23fade)'/></mask></defs><g mask='url(%23m)'><path fill='url(%23b)' d='M160 30 C104 30 66 76 66 140 C66 180 78 212 96 232 C82 272 76 312 80 344 C52 400 40 500 38 720 L282 720 C280 500 268 400 240 344 C244 312 238 272 224 232 C242 212 254 180 254 140 C254 76 216 30 160 30 Z'/><path d='M214 52 C242 78 254 116 250 158 C247 192 236 216 224 230' stroke='%23ffc08a' stroke-width='7' fill='none' opacity='0.4' stroke-linecap='round'/></g></svg>";

/**
 * 皮肤模板 HTML（独立文件，浏览器可直接打开预览，基线与真实界面一致）。
 */
export function buildHtmlSkinTemplate() {
  // 防御：确保基线 CSS 不含提前闭合 style 标签的序列
  const baseCss = String(getBaseInterfaceCss() || '').replace(/<\/style/gi, '<\\/style');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>自定义皮肤模板 v${VERSION} · 所见即所得</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&family=Barlow:wght@600;700;800;900&display=swap">

<!-- tpl-page-style：模板页面自身的排版（仅预览用，禁止修改，不参与导入） -->
<style id="tpl-page-style">
  :root{ --tpl-bg:#131217; --tpl-fg:#d8d3c8; --tpl-dim:#8f8a7e; --tpl-accent:#e0603f; }
  html, body { margin: 0; padding: 0; }
  body{
    background: var(--tpl-bg);
    font-family: 'Noto Sans SC', sans-serif;
    color: var(--tpl-fg);
    display: flex; flex-direction: column; align-items: center;
    gap: 22px; padding: clamp(14px, 3vw, 36px); box-sizing: border-box;
  }
  .tpl-head{ text-align: center; max-width: 880px; }
  .tpl-head .tpl-latin{
    font-family: 'Barlow', sans-serif; letter-spacing: .35em; font-size: 11px;
    color: var(--tpl-dim); text-transform: uppercase;
  }
  .tpl-head h1{
    font-weight: 900; font-size: clamp(20px, 3vw, 30px); letter-spacing: .16em;
    margin: .4em 0 .5em; color: #f0ece2;
  }
  .tpl-head h1 em{ font-style: normal; color: var(--tpl-accent); }
  .tpl-head p{ font-size: 12.5px; line-height: 1.9; color: var(--tpl-dim); margin: 0; }
  .tpl-head code{
    color: #e8b27d; background: rgba(255,255,255,.06);
    padding: 1px 6px; border-radius: 4px; font-size: 11.5px;
  }
  .tpl-controls{ display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
  .tpl-controls button{
    font-family: 'Noto Sans SC', sans-serif; font-size: 12px; letter-spacing: .18em;
    padding: 8px 18px; cursor: pointer; color: #cfc9bb;
    background: transparent; border: 1px solid rgba(207,201,187,.32); border-radius: 999px;
    transition: all .22s ease;
  }
  .tpl-controls button:hover{ border-color: var(--tpl-accent); color: var(--tpl-accent); }
  .tpl-controls button.on{ background: var(--tpl-accent); border-color: var(--tpl-accent); color: #fff; }
  .tpl-stage{ width: min(1280px, 100%); }
  .tpl-stage .gal-game-container{
    box-shadow: 0 30px 80px -24px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.06);
  }
  .tpl-foot{
    color: #6d6860; font-size: 11px; letter-spacing: .22em;
    text-align: center; padding-bottom: 6px; line-height: 2;
  }
</style>

<!-- gal-base-style：真实界面基线样式（与插件运行时注入的完全一致，禁止修改） -->
<style id="gal-base-style">${baseCss}</style>

<!-- ============================================================
  ★ gal-skin-style：皮肤样式块 —— 唯一允许修改的区域 ★
  可修改本标签的 data-skin-name / data-skin-author / data-skin-version
  与标签内的全部 CSS；其余内容禁止改动。
  所有选择器必须以 #gal-global-overlay 或 #gal-layer-choices 开头。
============================================================ -->
<style id="gal-skin-style" data-skin-name="示例皮肤·樱夜" data-skin-author="官方示例" data-skin-version="1.0">
${EXAMPLE_SKIN_CSS}
</style>
</head>
<body>

<div class="tpl-head">
  <div class="tpl-latin">Custom Skin Template · WYSIWYG</div>
  <h1>自定义皮肤模板 <em>·</em> 所见即所得</h1>
  <p>
    下方舞台加载了与游戏内完全一致的基线样式与 DOM 结构——在这里看到什么，导入游戏后就是什么。
    皮肤写在 <code>gal-skin-style</code> 样式块中，叠加于基线之上；当前内置示例皮肤「樱夜」演示叠加机制，
    可用「对比 · 关闭皮肤层」查看默认基线。把本文件连同插件里的"AI 提示词"一起交给 AI，
    替换样式块后刷新预览，满意后回到插件导入本文件即可。
  </p>
</div>

<div class="tpl-controls">
  <button type="button" id="tpl-btn-skin" class="on">对比 · 关闭皮肤层</button>
  <button type="button" id="tpl-btn-bg" class="on">切换 · 演示背景</button>
  <button type="button" id="tpl-btn-choices">预览 · 剧情选项</button>
  <button type="button" id="tpl-btn-gen">预览 · 生成中</button>
  <button type="button" id="tpl-btn-type">重播 · 打字机</button>
</div>

<!-- ═══════════ 舞台：结构逐字复刻真实界面（禁止改动） ═══════════ -->
<div class="tpl-stage">
  <div id="gal-global-overlay" class="active html-skin">
        <!-- 地点弹窗二（仅展示，不作为弹窗入口） -->
        <div class="gal-status-bar-container">
          <div class="gal-location-bar" id="gal-location-bar" title="当前地点">
            <i class="fa-solid fa-location-dot"></i>
            <span class="gal-location-text" id="gal-location-text">海滨车站前</span>
          </div>
          <div class="gal-time-bar" id="gal-time-bar" title="当前时间">
            <i class="fa-regular fa-clock"></i>
            <span class="gal-time-text" id="gal-time-text">黄昏 17:42</span>
          </div>
        </div>

        <!-- 全屏切换按钮 -->
        <button class="gal-fullscreen-btn" data-action="toggle-fullscreen" title="切换全屏">
          <i class="fa-solid fa-expand"></i>
          <span>全屏</span>
        </button>

        <div class="gal-game-container" data-skin-shell="default">
          <!-- 背景层 -->
          <div class="gal-layer-bg has-bg">
            <div class="gal-bg-layer gal-bg-base"></div>
            <div class="gal-bg-layer gal-bg-front"></div>
          </div>

          <div class="gal-layer-effect-bg"></div>

          <!-- 游戏内容层 -->
          <div class="gal-game-content">
            <!-- 立绘层 -->
            <div class="gal-layer-character">
              <div class="gal-char-slot slot-left"></div>
              <div class="gal-char-slot slot-center">
                <div class="gal-char-container" data-character="示例角色" data-expression="默认">
                  <img class="gal-char-img" src="${DEMO_SPRITE_SVG}" alt="示例立绘剪影">
                </div>
              </div>
              <div class="gal-char-slot slot-right"></div>
            </div>

            <div class="gal-layer-effect-fg"></div>
            <!-- 对话框层 -->
            <div class="gal-dialog-layer">
              <button class="gal-sprite-toggle" title="显示/隐藏立绘">
                <span class="gal-eye-icon">\u{1F441}</span>
              </button>
              <button class="gal-status-popup-trigger gal-location-popup-trigger" id="gal-location-popup-trigger" title="弹窗一">
                <i class="gal-status-popup-icon fa-solid fa-location-dot"></i>
              </button>
              <button class="gal-status-popup-trigger gal-time-popup-trigger" id="gal-time-popup-trigger" title="弹窗二">
                <i class="gal-status-popup-icon fa-regular fa-clock"></i>
              </button>
              <div class="gal-name-badge">
                <span>千夏</span>
              </div>

              <div class="gal-interaction-bar">
                <button class="gal-action-btn btn-reroll" data-action="reroll" title="重新生成">
                  <i class="fa-solid fa-rotate-right"></i>
                  <span>重绘当前</span>
                </button>
                <button class="gal-action-btn btn-free" data-action="free-input" title="自由输入">
                  <i class="fa-regular fa-keyboard"></i>
                  <span>自由对话</span>
                </button>
              </div>

              <div class="gal-text-panel">
                <p class="gal-dialog-text">「今天的夕阳真漂亮呢……要不要一起走到车站？」她微微侧过头，发梢在暮色里泛着柔和的光。</p>

                <!-- 生成中特效指示器（默认隐藏） -->
                <div class="gal-generating-indicator" id="gal-generating-indicator">
                  <i class="fa-solid fa-wand-magic-sparkles gal-gen-icon"></i>
                  <span class="gal-gen-text">生成中</span>
                  <span class="gal-gen-status" id="gal-gen-status">正在初始化...</span>
                  <div class="gal-gen-dots">
                    <span class="gal-gen-dot"></span>
                    <span class="gal-gen-dot"></span>
                    <span class="gal-gen-dot"></span>
                  </div>
                </div>
                <div class="gal-bottom-toolbar">
                  <button class="gal-footer-btn" data-action="log" title="查看历史">
                    <i class="fa-solid fa-list-ul"></i> <span class="gal-btn-text">LOG</span>
                  </button>
                  <button class="gal-footer-btn" data-action="close-mode" title="退出 Galgame 模式">
                    <i class="fa-solid fa-power-off"></i> <span class="gal-btn-text">CLOSE</span>
                  </button>
                  <button class="gal-footer-btn" data-action="view-original" title="查看消息内嵌界面">
                    <i class="fa-solid fa-display"></i> <span class="gal-btn-text">VIEW</span>
                  </button>
                  <button class="gal-footer-btn" data-action="config" title="设置">
                    <i class="fa-solid fa-gear"></i> <span class="gal-btn-text">CONFIG</span>
                  </button>
                  <button class="gal-footer-btn" data-action="save" title="存档">
                    <i class="fa-solid fa-floppy-disk"></i> <span class="gal-btn-text">SAVE</span>
                  </button>
                  <button class="gal-footer-btn" data-action="load" title="读档">
                    <i class="fa-solid fa-folder-open"></i> <span class="gal-btn-text">LOAD</span>
                  </button>
                  <button class="gal-footer-btn" data-action="timeline" title="时间线图谱">
                    <i class="fa-solid fa-diagram-project"></i> <span class="gal-btn-text">TL</span>
                  </button>
                  <button class="gal-footer-btn gal-nav-btn" data-action="prev" title="上一段">
                    <i class="fa-solid fa-chevron-left"></i> <span class="gal-btn-text">PREV</span>
                  </button>
                  <button class="gal-footer-btn gal-nav-btn" data-action="auto" title="自动播放">
                    <i class="fa-solid fa-play"></i> <span class="gal-btn-text">AUTO</span>
                  </button>
                  <button class="gal-footer-btn gal-nav-btn" data-action="skip" title="按住快进 (Ctrl)">
                    <i class="fa-solid fa-forward"></i> <span class="gal-btn-text">SKIP</span>
                  </button>
                  <button class="gal-pending-choices-btn show" data-action="show-choices" title="有待选择的选项">
                    <i class="fa-solid fa-list-check" style="font-size:1.1rem"></i> <span class="gal-btn-text">剧情选项</span>
                  </button>
                  <button class="gal-footer-btn-next" data-action="next" title="下一段">
                    <span class="gal-btn-text">NEXT</span> <i class="fa-solid fa-chevron-right"></i>
                  </button>
                </div>
              </div>

              <!-- 进度条 -->
              <div class="gal-progress-container">
                <div class="gal-progress-bar" style="width: 42%;"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 移动端上拉菜单（默认隐藏） -->
        <div class="gal-mobile-menu" id="gal-mobile-menu">
          <button class="gal-menu-btn" data-action="open-settings"><i class="fa-solid fa-gear"></i> 设置</button>
          <button class="gal-menu-btn" data-action="log"><i class="fa-solid fa-list-ul"></i> 历史</button>
          <button class="gal-menu-btn" data-action="view-original"><i class="fa-solid fa-display"></i> 原界面</button>
          <button class="gal-menu-btn" data-action="save"><i class="fa-solid fa-floppy-disk"></i> 存档</button>
          <button class="gal-menu-btn" data-action="load"><i class="fa-solid fa-folder-open"></i> 读档</button>
          <button class="gal-menu-btn" data-action="timeline"><i class="fa-solid fa-diagram-project"></i> 时间线</button>
        </div>
  </div>
</div>

<!-- 剧情选项弹层（真实界面中挂在 body 下，点击底栏"剧情选项"或上方控制条显示） -->
<div id="gal-layer-choices" class="html-skin">
  <div class="gal-choices-title"><span>请选择行动</span></div>
  <div class="gal-choices-container">
    <div class="gal-choice-card"><span>一起走到车站</span></div>
    <div class="gal-choice-card"><span>再看一会儿夕阳</span></div>
    <div class="gal-choice-card"><span>约她明天再见</span></div>
  </div>
  <div class="gal-choices-hint">点击空白处关闭</div>
</div>

<div class="tpl-foot">
  结构与基线样式禁止修改 · 仅编辑 GAL-SKIN-STYLE 样式块 · 模板 V${VERSION}
</div>

<script>
(function () {
  // 预览交互（仅模板内生效，导入时会被忽略）
  var overlay = document.getElementById('gal-global-overlay');
  var choices = document.getElementById('gal-layer-choices');

  /* 打字机 */
  var LINE = '「今天的夕阳真漂亮呢……要不要一起走到车站？」她微微侧过头，发梢在暮色里泛着柔和的光。';
  var typedEl = overlay.querySelector('.gal-dialog-text');
  var timer = null;
  function typewrite() {
    clearInterval(timer);
    var i = 0;
    typedEl.textContent = '';
    timer = setInterval(function () {
      typedEl.textContent = LINE.slice(0, ++i);
      if (i >= LINE.length) clearInterval(timer);
    }, 45);
  }
  document.getElementById('tpl-btn-type').addEventListener('click', typewrite);
  overlay.querySelector('.gal-footer-btn-next').addEventListener('click', typewrite);

  /* 皮肤层开关：对比基线与皮肤叠加效果 */
  var skinStyle = document.getElementById('gal-skin-style');
  document.getElementById('tpl-btn-skin').addEventListener('click', function () {
    skinStyle.disabled = !skinStyle.disabled;
    this.classList.toggle('on', !skinStyle.disabled);
    this.textContent = skinStyle.disabled ? '对比 · 开启皮肤层' : '对比 · 关闭皮肤层';
  });

  /* 演示背景：模拟玩家游戏中有背景图的状态 */
  var DEMO_BG = 'radial-gradient(circle at 68% 26%, rgba(255,243,214,0.95) 0%, rgba(255,209,145,0.6) 10%, rgba(255,180,110,0) 26%), radial-gradient(42% 8% at 30% 38%, rgba(255,214,160,0.5), transparent 70%), radial-gradient(50% 7% at 74% 48%, rgba(255,190,140,0.4), transparent 70%), linear-gradient(to top, rgba(23,20,26,0.95) 0%, rgba(36,29,36,0.85) 14%, rgba(52,38,48,0) 32%), radial-gradient(130% 100% at 70% 16%, #f4b56a 0%, #d97e4a 30%, #8a4a3f 55%, #3c2f38 80%, #211d26 100%)';
  var bgOn = true;
  var layerBg = overlay.querySelector('.gal-layer-bg');
  var bgBase = overlay.querySelector('.gal-bg-base');
  var btnBg = document.getElementById('tpl-btn-bg');
  function applyBg() {
    layerBg.classList.toggle('has-bg', bgOn);
    bgBase.style.backgroundImage = bgOn ? DEMO_BG : '';
    btnBg.classList.toggle('on', bgOn);
  }
  applyBg();
  btnBg.addEventListener('click', function () { bgOn = !bgOn; applyBg(); });

  /* 剧情选项弹层 */
  var btnChoices = document.getElementById('tpl-btn-choices');
  function syncChoicesBtn() { btnChoices.classList.toggle('on', choices.classList.contains('active')); }
  btnChoices.addEventListener('click', function () { choices.classList.toggle('active'); syncChoicesBtn(); });
  overlay.querySelector('.gal-pending-choices-btn').addEventListener('click', function () {
    choices.classList.add('active'); syncChoicesBtn();
  });
  choices.addEventListener('click', function (e) {
    if (e.target === this || e.target.closest('.gal-choice-card')) {
      choices.classList.remove('active'); syncChoicesBtn();
    }
  });

  /* 生成中指示器 */
  document.getElementById('tpl-btn-gen').addEventListener('click', function () {
    var g = document.getElementById('gal-generating-indicator');
    g.classList.toggle('active');
    this.classList.toggle('on', g.classList.contains('active'));
  });

  typewrite();
})();
</script>
</body>
</html>
`;
}

/**
 * 用指定皮肤数据回填模板（导出已装皮肤时使用，保证导出物可再导入）。
 */
export function buildHtmlSkinExportFile({ name, author, version, rawCss }) {
  const template = buildHtmlSkinTemplate();
  const escapeAttr = value => String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const replacement = `<style id="gal-skin-style" data-skin-name="${escapeAttr(name)}" data-skin-author="${escapeAttr(author)}" data-skin-version="${escapeAttr(version || '1.0')}">\n${String(rawCss || '')}\n</style>`;
  // 用函数形式替换，避免 rawCss 中的 $& 等模式被 String.replace 特殊解释
  return template.replace(/<style id="gal-skin-style"[^>]*>[\s\S]*?<\/style>/, () => replacement);
}

/**
 * AI 皮肤编写技术规格说明（一键复制用）。
 * 定位：纯技术文档——只描述界面框架结构、控件与约束，
 * 不预设任何设计方向；具体需求由使用者自行向 AI 提出。
 */
export const HTML_SKIN_PROMPT = `以下是 Galgame 游戏界面皮肤模板的技术规格。请根据我随后提出的需求，为该界面编写皮肤 CSS。

【模板文件结构】
我提供的 HTML 模板包含：
- \`<style id="tpl-page-style">\`：模板页面自身排版（预览用，禁止修改）
- \`<style id="gal-base-style">\`：游戏界面的基线样式，与游戏内完全一致。在浏览器打开模板看到的效果 = 导入游戏后的效果（所见即所得），禁止修改
- \`<style id="gal-skin-style">\`：皮肤样式块，叠加在基线之上——这是唯一允许修改的区域（连同其 data-skin-name / data-skin-author / data-skin-version 三个属性）
- \`<body>\`：界面 DOM 结构复刻（禁止修改结构与类名）；页面顶部控制条与打字机脚本仅供预览

【界面框架结构】
#gal-global-overlay                          界面根容器（皮肤激活时带 .html-skin）
├─ .gal-status-bar-container                 状态栏（右上角，全屏按钮左侧）
│   ├─ .gal-location-bar > i + .gal-location-text    地点栏
│   └─ .gal-time-bar > i + .gal-time-text            时间栏
├─ .gal-fullscreen-btn                       全屏切换按钮（右上角）
└─ .gal-game-container                       主舞台
    ├─ .gal-layer-bg > .gal-bg-layer ×2      背景层（无背景图时显示 ::before 默认纹理）
    └─ .gal-game-content
        ├─ .gal-layer-character > .gal-char-slot ×3   立绘槽（slot-left/center/right）
        │   └─ .gal-char-container > img.gal-char-img 立绘
        └─ .gal-dialog-layer                 对话框整层
            ├─ .gal-sprite-toggle            立绘显隐开关（小按钮）
            ├─ .gal-status-popup-trigger ×2  弹窗触发小按钮
            ├─ .gal-name-badge > span        角色姓名牌（::after 为底部强调线）
            ├─ .gal-interaction-bar          交互按钮组（对话框右上方）
            │   └─ .gal-action-btn（.btn-reroll 重绘 / .btn-free 自由对话）
            ├─ .gal-text-panel               对话文本面板
            │   ├─ .gal-dialog-text          对话正文
            │   ├─ .gal-generating-indicator 生成中指示器（.active 时显示）
            │   └─ .gal-bottom-toolbar       底部功能栏
            │       ├─ .gal-footer-btn ×7    功能按钮（data-action=log/close-mode/view-original/config/save/load/timeline）
            │       ├─ .gal-footer-btn.gal-nav-btn ×3   导航按钮（data-action=prev/auto/skip）
            │       ├─ .gal-pending-choices-btn         "剧情选项"提示按钮
            │       └─ .gal-footer-btn-next             NEXT 下一段按钮
            │       （各按钮内文字为 .gal-btn-text，图标为 i）
            └─ .gal-progress-container > .gal-progress-bar   生成进度条

#gal-layer-choices                           剧情选项弹层（独立于 overlay 挂载，皮肤激活时带 .html-skin）
├─ .gal-choices-title > span                 标题
├─ .gal-choices-container > .gal-choice-card > span   选项卡片
└─ .gal-choices-hint                         关闭提示

另有 .gal-mobile-menu > .gal-menu-btn（移动端上拉菜单，窄屏时替代部分底栏按钮）。

【硬性约束】
1. 只修改 gal-skin-style 样式块的内容与其 data-* 属性；HTML 结构、类名、其余 style/script 一律不动。
2. 所有 CSS 规则的选择器必须以 \`#gal-global-overlay\` 或 \`#gal-layer-choices\` 开头（导入器会强制作用域，不合规选择器会被自动加前缀）。
3. 禁止 \`position: fixed\`（导入时会被强制降级为 absolute）、\`@import\`、\`expression()\`。
4. \`url()\` 中只允许 \`https://\` 链接或 \`data:image/\` 内联图片，其他协议会被剔除。
5. 功能按钮（.gal-footer-btn、.gal-footer-btn-next、.gal-action-btn、.gal-pending-choices-btn、.gal-fullscreen-btn）不可 display:none / visibility:hidden，否则玩家丢失功能。
6. 不要改动 #gal-global-overlay 与 .gal-game-container 自身的 display / position / width / height 布局属性。

【基线样式的技术特征（覆盖时需要知道）】
- 基线中底栏按钮、NEXT 按钮、剧情选项按钮等大量规则带 !important；要覆盖这些属性，你的规则也必须加 !important。
- 基线对按钮、姓名牌、选项卡片使用了 skewX 斜切变形（元素本体与内部 span/i 反向补偿）；如需去除，须对本体及内部 span/i 同时写 \`transform: none !important\`。
- NEXT 按钮（.gal-footer-btn-next）带 clip-path 斜角裁切，可用 \`clip-path: none !important\` 去除。
- 可用 CSS 变量：--ui-scale（整体缩放，尺寸建议写 calc(Xrem * var(--ui-scale))）、--font-scale（字号）、--panel-opacity（面板透明度，玩家可调）、--gp-*（默认皮肤颜色 token 组，整组覆写可快速全局换色）。
- 允许使用 @media（窄屏适配）与 @keyframes（导入时会自动重命名防撞名）。
- 无背景图时舞台显示 .gal-layer-bg::before 的默认纹理；有背景图时该纹理隐藏（模板控制条的"切换 · 演示背景"可预览两种状态）。

【输出要求】
只输出修改后的完整 \`<style id="gal-skin-style" ...>...</style>\` 代码块（含标签与 data-* 属性），不要复述模板其余部分。我会把它替换回模板文件，在浏览器中预览确认后导入游戏。

我的需求：`;

/**
 * 触发浏览器下载皮肤模板 HTML。
 */
export function downloadHtmlSkinTemplate(filename = `galgame皮肤模板-v${VERSION}.html`) {
  downloadHtmlFile(buildHtmlSkinTemplate(), filename);
}

/**
 * 下载任意 HTML 文本为文件（导出皮肤共用）。
 */
export function downloadHtmlFile(htmlText, filename) {
  const doc = topWindow.document;
  const blob = new Blob([htmlText], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = url;
  link.download = filename;
  doc.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
