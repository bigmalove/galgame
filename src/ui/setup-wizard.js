import { BGMManager } from '../audio/bgm-manager.js';
import { SCRIPT_NAME } from '../core/constants.js';
import { $ } from '../core/env.js';
import { getSettings, normalizeBgFillMode, saveSettings } from '../core/settings.js';
import { getIsEnabled } from '../core/state.js';
import { GalgameStore } from '../core/store.js';
import { getTotalResourceCounts, isAllPacksEmpty } from '../db/image-packs.js';
import { clearAllPixiEffects, syncPixiEffectsSettings } from '../effects/pixi-effect-manager.js';
import { injectCOTToWorldbook } from '../logic/worldbook.js';
import { importAssetsFromJson, importFromZipFile, showRemoteZipImportDialog } from './asset-io.js';
import { removeBGMWidget, renderBGMWidget } from './bgm-widget.js';
import { showBuiltinBgPackBrowser } from './builtin-bg-packs.js';
import { getModalMountRoot } from './fullscreen.js';
import { applyGalgameMode, hideNonLastFloors } from './galgame-mode.js';
import { makeDraggable } from './interaction.js';
import { showToast } from './toast.js';

// ============================================
// 配置向导（首次使用引导）
// 手动入口：设置面板 → 通用 → 配置向导
// 自动弹出：全库无任何资源时（见 maybeAutoShowSetupWizard）
// ============================================

const WIZARD_MODAL_ID = 'gal-setup-wizard-modal';

// 延迟引用（index.js 注入，避免与 settings-panel / title-screen 循环依赖：
// settings-panel 正向 import 本模块绑定按钮，title-screen 又 import settings-panel）
const _refs = {
  applySkin: null,
  applySettingsToUI: null,
  applyBgFillMode: null,
  getSkinOptionHtml: null,
  setGalgameMasterEnabled: null,
  applySimpleStorybookMode: null,
  isTitleScreenVisible: null,
};

export function setSetupWizardRefs(refs) {
  Object.assign(_refs, refs || {});
}

// 会话级去重：模块变量随页面加载重置，天然等于"每会话最多自动弹一次"
let _autoShownThisSession = false;

function isWizardOptedOut() {
  try {
    return localStorage.getItem(GalgameStore.STORAGE_KEYS.SETUP_WIZARD_OPTOUT) === '1';
  } catch {
    return false;
  }
}

function setWizardOptOut() {
  try {
    localStorage.setItem(GalgameStore.STORAGE_KEYS.SETUP_WIZARD_OPTOUT, '1');
  } catch {
    // localStorage 不可用时静默忽略
  }
}

// 自动弹出检测（init.js 延迟初始化块末尾调用）
export async function maybeAutoShowSetupWizard() {
  if (_autoShownThisSession) return;
  if (isWizardOptedOut()) return;
  if ($(`#${WIZARD_MODAL_ID}`).length) return;
  if (typeof _refs.isTitleScreenVisible === 'function' && _refs.isTitleScreenVisible()) return;
  if (!(await isAllPacksEmpty())) return;
  _autoShownThisSession = true;
  showSetupWizard({ trigger: 'auto' });
}

// ============================================
// 向导主体
// ============================================

const WIZARD_STYLES = `
  #${WIZARD_MODAL_ID} .gal-wizard-box { max-width: 580px; width: 92%; max-height: 88vh; padding: 0; overflow: hidden; display: flex; flex-direction: column; }
  #${WIZARD_MODAL_ID} .gal-wizard-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 18px; border-bottom: 1px solid #eee; margin: 0; cursor: move; }
  #${WIZARD_MODAL_ID} .gal-wizard-header .gal-wizard-title { font-weight: 700; }
  #${WIZARD_MODAL_ID} .gal-wizard-dots { display: flex; gap: 6px; align-items: center; }
  #${WIZARD_MODAL_ID} .gal-wizard-dot { width: 8px; height: 8px; border-radius: 50%; background: #d5dbe2; transition: background 0.2s, transform 0.2s; }
  #${WIZARD_MODAL_ID} .gal-wizard-dot.active { background: #0d6efd; transform: scale(1.25); }
  #${WIZARD_MODAL_ID} .gal-wizard-dot.done { background: #8ab6f5; }
  #${WIZARD_MODAL_ID} .gal-wizard-close-btn { background: none; border: none; cursor: pointer; font-size: 1.15rem; color: #999; padding: 4px 8px; line-height: 1; }
  #${WIZARD_MODAL_ID} .gal-wizard-body { padding: 18px 20px; overflow-y: auto; flex: 1; min-height: 220px; font-size: 0.92rem; color: #333; line-height: 1.7; }
  #${WIZARD_MODAL_ID} .gal-wizard-step-title { font-size: 1.02rem; font-weight: 700; color: #1f2937; margin-bottom: 10px; }
  #${WIZARD_MODAL_ID} .gal-wizard-hint { font-size: 0.82rem; color: #7a828c; line-height: 1.6; }
  #${WIZARD_MODAL_ID} .gal-wizard-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 18px; border-top: 1px solid #eee; }
  #${WIZARD_MODAL_ID} .gal-wizard-nav { display: flex; gap: 10px; margin-left: auto; }
  #${WIZARD_MODAL_ID} .gal-wizard-nav .gal-action-btn { min-width: 92px; min-height: 38px; justify-content: center; }
  #${WIZARD_MODAL_ID} .gal-wizard-nav .gal-action-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  #${WIZARD_MODAL_ID} .gal-wizard-optout { display: none; align-items: center; gap: 6px; font-size: 0.82rem; color: #7a828c; cursor: pointer; user-select: none; }
  #${WIZARD_MODAL_ID} .gal-wizard-mode-cards { display: flex; gap: 12px; margin: 12px 0; }
  #${WIZARD_MODAL_ID} .gal-wizard-mode-card { flex: 1; border: 2px solid #e3e7eb; border-radius: 10px; padding: 14px; cursor: pointer; transition: border-color 0.15s, background 0.15s; background: #fff; }
  #${WIZARD_MODAL_ID} .gal-wizard-mode-card:hover { border-color: #9ec3f5; }
  #${WIZARD_MODAL_ID} .gal-wizard-mode-card.selected { border-color: #0d6efd; background: #f0f6ff; }
  #${WIZARD_MODAL_ID} .gal-wizard-mode-card .gal-wizard-mode-name { font-weight: 700; color: #1f2937; margin-bottom: 6px; }
  #${WIZARD_MODAL_ID} .gal-wizard-mode-card .gal-wizard-mode-desc { font-size: 0.82rem; color: #6b7280; line-height: 1.55; }
  #${WIZARD_MODAL_ID} .gal-wizard-import-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 12px 0; }
  #${WIZARD_MODAL_ID} .gal-wizard-import-btns .gal-action-btn { min-height: 44px; justify-content: center; }
  #${WIZARD_MODAL_ID} .gal-wizard-status { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #f8f9fa; border-radius: 8px; font-size: 0.85rem; color: #475569; margin-bottom: 4px; }
  #${WIZARD_MODAL_ID} .gal-wizard-status .gal-wizard-status-refresh { background: none; border: none; cursor: pointer; color: #0d6efd; padding: 2px 6px; }
  #${WIZARD_MODAL_ID} .gal-wizard-summary { padding: 12px 14px; background: #f8f9fa; border-radius: 8px; border-left: 3px solid #0d6efd; margin: 10px 0; }
  #${WIZARD_MODAL_ID} .gal-wizard-summary p { margin: 4px 0; }
  /* 设置行/开关/下拉（设置面板的同款样式是面板内联的，向导独立打开时不可用，这里自带一份） */
  #${WIZARD_MODAL_ID} .gal-wizard-setting-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f0f2f5; }
  #${WIZARD_MODAL_ID} .gal-wizard-setting-row:last-child { border-bottom: none; }
  #${WIZARD_MODAL_ID} .gal-wizard-setting-label { font-size: 0.9rem; color: #2b2e38; }
  #${WIZARD_MODAL_ID} .gal-wizard-setting-hint { font-size: 0.75rem; color: #8a929c; margin: -6px 0 6px; line-height: 1.5; }
  #${WIZARD_MODAL_ID} .gal-switch { position: relative; display: inline-block; width: 48px; height: 26px; flex-shrink: 0; }
  #${WIZARD_MODAL_ID} .gal-switch input { opacity: 0; width: 0; height: 0; }
  #${WIZARD_MODAL_ID} .gal-switch-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccd2d9; transition: 0.3s; border-radius: 26px; }
  #${WIZARD_MODAL_ID} .gal-switch-slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: white; transition: 0.3s; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
  #${WIZARD_MODAL_ID} .gal-switch input:checked + .gal-switch-slider { background: #0d6efd; }
  #${WIZARD_MODAL_ID} .gal-switch input:checked + .gal-switch-slider:before { transform: translateX(22px); }
  #${WIZARD_MODAL_ID} .gal-select { padding: 6px 10px; border: 1px solid #e3e7eb; border-radius: 6px; font-size: 0.85rem; background: #fff; color: #2b2e38; box-sizing: border-box; max-width: 100%; min-width: 0; }
  #${WIZARD_MODAL_ID} .gal-wizard-setting-row .gal-select { width: clamp(160px, 45%, 260px); }
  /* 生图来源选择列表 */
  #${WIZARD_MODAL_ID} .gal-wizard-source-list { display: flex; flex-direction: column; gap: 8px; margin: 12px 0; }
  #${WIZARD_MODAL_ID} .gal-wizard-source-opt { border: 2px solid #e3e7eb; border-radius: 8px; padding: 10px 12px; cursor: pointer; transition: border-color 0.15s, background 0.15s; background: #fff; }
  #${WIZARD_MODAL_ID} .gal-wizard-source-opt:hover { border-color: #9ec3f5; }
  #${WIZARD_MODAL_ID} .gal-wizard-source-opt.selected { border-color: #0d6efd; background: #f0f6ff; }
  #${WIZARD_MODAL_ID} .gal-wizard-source-name { font-weight: 700; color: #1f2937; margin-bottom: 2px; }
  #${WIZARD_MODAL_ID} .gal-wizard-badge { display: inline-block; background: #0d6efd; color: #fff; font-size: 0.7rem; font-weight: 700; padding: 1px 8px; border-radius: 999px; vertical-align: 2px; margin-left: 4px; }
  #${WIZARD_MODAL_ID} .gal-wizard-source-desc { font-size: 0.78rem; color: #6b7280; line-height: 1.5; }
  @media screen and (max-width: 768px) {
    #${WIZARD_MODAL_ID} .gal-wizard-box { width: 96%; max-height: 92vh; }
    #${WIZARD_MODAL_ID} .gal-wizard-body { padding: 14px; }
    #${WIZARD_MODAL_ID} .gal-wizard-mode-cards { flex-direction: column; }
    #${WIZARD_MODAL_ID} .gal-wizard-import-btns { grid-template-columns: 1fr; }
  }
`;

// 步骤定义：{ id, render(ctx), bind?(ctx), onEnter?(ctx), onNext?(ctx) }
// onNext 返回 false 表示不前进；抛错由调用处 catch 并提示
const STEPS = [
  {
    id: 'welcome',
    render() {
      return `
        <div class="gal-wizard-step-title"><i class="fa-solid fa-hand-sparkles"></i> 欢迎使用 Galgame 通用生成器</div>
        <p>本向导将引导你完成五项基础配置：</p>
        <p style="margin: 8px 0 8px 6px;">
          1️⃣ 选择显示模式（标准 Galgame / 简化绘本）<br>
          2️⃣ 挑选界面皮肤<br>
          3️⃣ 常用设置（特效、情境样式、BGM、背景填充）<br>
          4️⃣ AI 生图配置（推荐智绘姬）<br>
          5️⃣ 导入图包资源（立绘、背景等）
        </p>
        <p class="gal-wizard-hint">全程约 1 分钟，所有配置之后都可以在设置面板中修改；本向导也可随时从「设置 → 通用 → 配置向导」重新打开。</p>
      `;
    },
  },
  {
    id: 'mode',
    render(ctx) {
      const enableHint = getIsEnabled()
        ? ''
        : '<p class="gal-wizard-hint"><i class="fa-solid fa-circle-info"></i> 当前角色尚未开启 Galgame 模式，进入下一步时将自动开启。</p>';
      return `
        <div class="gal-wizard-step-title"><i class="fa-solid fa-layer-group"></i> 选择显示模式</div>
        <div class="gal-wizard-mode-cards">
          <div class="gal-wizard-mode-card ${ctx.state.mode === 'standard' ? 'selected' : ''}" data-mode="standard">
            <div class="gal-wizard-mode-name"><i class="fa-solid fa-user"></i> 标准 Galgame 模式</div>
            <div class="gal-wizard-mode-desc">完整视觉小说体验：角色立绘、表情切换、说话者高亮、背景切换。需要导入立绘图包才能发挥全部效果。</div>
          </div>
          <div class="gal-wizard-mode-card ${ctx.state.mode === 'storybook' ? 'selected' : ''}" data-mode="storybook">
            <div class="gal-wizard-mode-name"><i class="fa-solid fa-book-open"></i> 简化图书绘本模式</div>
            <div class="gal-wizard-mode-desc">纯文本对话框，不解析角色/旁白/表情，不显示立绘和 Live2D；背景（含背景图包）照常切换。适合轻量阅读。</div>
          </div>
        </div>
        ${enableHint}
      `;
    },
    bind(ctx) {
      ctx.$body.find('.gal-wizard-mode-card').on('click', function () {
        ctx.state.mode = String($(this).data('mode') || 'standard');
        ctx.$body.find('.gal-wizard-mode-card').removeClass('selected');
        $(this).addClass('selected');
      });
    },
    async onNext(ctx) {
      const wantStorybook = ctx.state.mode === 'storybook';
      try {
        if (!getIsEnabled() && typeof _refs.setGalgameMasterEnabled === 'function') {
          await _refs.setGalgameMasterEnabled(true);
        }
        if (getSettings().simpleStorybookMode !== wantStorybook && typeof _refs.applySimpleStorybookMode === 'function') {
          await _refs.applySimpleStorybookMode(wantStorybook);
        }
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] 向导应用模式失败:`, e);
        showToast('模式已保存，但世界书更新失败，可稍后在设置面板重试');
      }
      return true;
    },
  },
  {
    id: 'skin',
    render() {
      const optionsHtml = typeof _refs.getSkinOptionHtml === 'function' ? _refs.getSkinOptionHtml(getSettings().skin) : '';
      return `
        <div class="gal-wizard-step-title"><i class="fa-solid fa-palette"></i> 挑选界面皮肤</div>
        <p>皮肤决定对话框、工具栏等界面元素的整体风格，切换后立即生效，可实时预览。</p>
        <div style="margin: 12px 0;">
          <select id="gal-wizard-skin-select" class="gal-select" style="width: 100%;">${optionsHtml}</select>
        </div>
        <p class="gal-wizard-hint">之后可以在「设置 → 画面与特效」中随时更换，还可以导入自定义 HTML 皮肤。</p>
      `;
    },
    bind(ctx) {
      ctx.$body.find('#gal-wizard-skin-select').on('change', function () {
        // 选项值全部来自皮肤列表本身，applySkin 内部还会 normalize 兜底
        getSettings().skin = String($(this).val() || 'none');
        if (typeof _refs.applySkin === 'function') _refs.applySkin();
        if (typeof _refs.applySettingsToUI === 'function') _refs.applySettingsToUI();
        saveSettings();
      });
    },
  },
  {
    id: 'prefs',
    render(ctx) {
      // 每次进入本步都从当前设置初始化，避免「上一步再回来」时状态漂移
      const settings = getSettings();
      ctx.state.prefs = {
        effectsEnabled: settings.effectsEnabled !== false,
        situationalStyleEnabled: settings.situationalStyleEnabled !== false,
        bgmEnabled: settings.bgmEnabled !== false,
        autoSpriteAssignEnabled: settings.autoSpriteAssignEnabled !== false,
        bgFillMode: normalizeBgFillMode(settings.bgFillMode),
      };
      const prefs = ctx.state.prefs;
      return `
        <div class="gal-wizard-step-title"><i class="fa-solid fa-sliders"></i> 常用设置</div>
        <div class="gal-wizard-setting-row">
          <span class="gal-wizard-setting-label">Pixi 特效</span>
          <label class="gal-switch"><input type="checkbox" id="gal-wizard-effects-enabled" ${prefs.effectsEnabled ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
        </div>
        <p class="gal-wizard-setting-hint">雨、雪、樱花等画面粒子特效，低端设备可关闭省电。</p>
        <div class="gal-wizard-setting-row">
          <span class="gal-wizard-setting-label">情境样式</span>
          <label class="gal-switch"><input type="checkbox" id="gal-wizard-situational-style" ${prefs.situationalStyleEnabled ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
        </div>
        <p class="gal-wizard-setting-hint">允许 AI 输出 &lt;styled&gt; 特殊排版文本（如手机短信、书信样式）。</p>
        <div class="gal-wizard-setting-row">
          <span class="gal-wizard-setting-label">启用 BGM</span>
          <label class="gal-switch"><input type="checkbox" id="gal-wizard-bgm-enabled" ${prefs.bgmEnabled ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
        </div>
        <p class="gal-wizard-setting-hint">允许 AI 输出 &lt;bgm&gt; 标签自动切换背景音乐。</p>
        <div class="gal-wizard-setting-row">
          <span class="gal-wizard-setting-label">AI 自动套用立绘</span>
          <label class="gal-switch"><input type="checkbox" id="gal-wizard-auto-sprite-assign" ${prefs.autoSpriteAssignEnabled ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
        </div>
        <p class="gal-wizard-setting-hint">剧情出现新主要角色/重要配角时，AI 自动从内置图包挑选气质匹配的立绘模板套用。</p>
        <div class="gal-wizard-setting-row">
          <span class="gal-wizard-setting-label">背景图填充</span>
          <select id="gal-wizard-bg-fill-mode" class="gal-select">
            <option value="cover" ${prefs.bgFillMode === 'cover' ? 'selected' : ''}>Cover (填满裁剪)</option>
            <option value="contain" ${prefs.bgFillMode === 'contain' ? 'selected' : ''}>Contain (完整显示)</option>
            <option value="avoid-dialog" ${prefs.bgFillMode === 'avoid-dialog' ? 'selected' : ''}>完全显示（避开对话框）</option>
          </select>
        </div>
        <p class="gal-wizard-setting-hint">背景图与屏幕比例不一致时，填满裁剪或完整显示留边；「完全显示」则让图片避开对话框，下方留白用同图模糊铺底。</p>
        <p class="gal-wizard-hint">进入下一步时统一应用；之后可在「设置 → 画面与特效 / 生成COT」中随时调整。</p>
      `;
    },
    bind(ctx) {
      const prefs = ctx.state.prefs;
      ctx.$body.find('#gal-wizard-effects-enabled').on('change', function () { prefs.effectsEnabled = $(this).is(':checked'); });
      ctx.$body.find('#gal-wizard-situational-style').on('change', function () { prefs.situationalStyleEnabled = $(this).is(':checked'); });
      ctx.$body.find('#gal-wizard-bgm-enabled').on('change', function () { prefs.bgmEnabled = $(this).is(':checked'); });
      ctx.$body.find('#gal-wizard-auto-sprite-assign').on('change', function () { prefs.autoSpriteAssignEnabled = $(this).is(':checked'); });
      ctx.$body.find('#gal-wizard-bg-fill-mode').on('change', function () { prefs.bgFillMode = normalizeBgFillMode($(this).val()); });
    },
    async onNext(ctx) {
      // 与设置面板对应开关的副作用保持一致，差异仅在于合并为一次 COT 注入
      const settings = getSettings();
      const prefs = ctx.state.prefs;
      let cotDirty = false;

      if (settings.effectsEnabled !== prefs.effectsEnabled) {
        settings.effectsEnabled = prefs.effectsEnabled;
        if (!prefs.effectsEnabled) clearAllPixiEffects();
        syncPixiEffectsSettings();
        cotDirty = true;
      }
      if ((settings.situationalStyleEnabled !== false) !== prefs.situationalStyleEnabled) {
        settings.situationalStyleEnabled = prefs.situationalStyleEnabled;
        cotDirty = true;
      }
      if ((settings.bgmEnabled !== false) !== prefs.bgmEnabled) {
        settings.bgmEnabled = prefs.bgmEnabled;
        if (prefs.bgmEnabled) {
          renderBGMWidget();
        } else {
          BGMManager.stopForDisabled();
          removeBGMWidget();
        }
        cotDirty = true;
      }
      if ((settings.autoSpriteAssignEnabled !== false) !== prefs.autoSpriteAssignEnabled) {
        settings.autoSpriteAssignEnabled = prefs.autoSpriteAssignEnabled;
        cotDirty = true;
      }
      if (normalizeBgFillMode(settings.bgFillMode) !== prefs.bgFillMode) {
        settings.bgFillMode = prefs.bgFillMode;
        if (typeof _refs.applyBgFillMode === 'function') _refs.applyBgFillMode();
      }

      saveSettings();
      if (cotDirty) {
        try {
          await injectCOTToWorldbook();
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] 向导应用常用设置后 COT 更新失败:`, e);
          showToast('设置已保存，但世界书更新失败，可稍后在设置面板重试');
        }
      }
      return true;
    },
  },
  {
    id: 'imagegen',
    render(ctx) {
      // 每次进入本步都从当前设置初始化，避免「上一步再回来」时状态漂移
      const settings = getSettings();
      ctx.state.imageGen = {
        source: settings.bgImageSource || 'none',
        cgMode: settings.imageGenCgMode === true,
      };
      const ig = ctx.state.imageGen;
      const opt = (value, name, desc, badge = '') => `
        <div class="gal-wizard-source-opt ${ig.source === value ? 'selected' : ''}" data-source="${value}">
          <div class="gal-wizard-source-name">${name}${badge ? `<span class="gal-wizard-badge">${badge}</span>` : ''}</div>
          <div class="gal-wizard-source-desc">${desc}</div>
        </div>`;
      return `
        <div class="gal-wizard-step-title"><i class="fa-solid fa-image"></i> AI 生图配置</div>
        <p>选择背景图来源，剧情推进时可自动生成/匹配背景图片。</p>
        <div class="gal-wizard-source-list">
          ${opt('chatu8', '智绘姬', '配合 st-chatu8 插件使用，自动识别其在消息中生成的图片（支持人物剧情CG），无需在本插件内配置 API，开箱即用。', '推荐')}
          ${opt('none', '关闭', '不使用 AI 生图，仅使用图包中的本地背景。')}
          ${opt('comfyui', 'ComfyUI', '本地部署的 ComfyUI 文生图，需配置 API 地址与工作流。')}
          ${opt('banana', '大香蕉', '通过反代 API 生成图片，需配置反代地址与 Key，支持人物剧情CG。')}
          ${opt('novelai', 'NovelAI', 'NovelAI 官方 API 生图，需有效订阅与 API Key。')}
          ${opt('wallhaven', 'Wallhaven', '按关键词搜索匹配现成壁纸（非 AI 生成），无需配置。')}
        </div>
        <div id="gal-wizard-cgmode-wrap" style="display: ${ig.source === 'chatu8' ? 'none' : 'block'};">
          <div class="gal-wizard-setting-row">
            <span class="gal-wizard-setting-label">生成剧情CG</span>
            <label class="gal-switch"><input type="checkbox" id="gal-wizard-imagegen-cgmode" ${ig.cgMode ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
          </div>
          <p class="gal-wizard-setting-hint">开启：生成包含人物的剧情CG | 关闭：生成纯场景背景。对 ComfyUI / 大香蕉 / NovelAI / Wallhaven 通用；智绘姬由其插件自行控制。</p>
        </div>
        <p class="gal-wizard-hint">ComfyUI / 大香蕉 / NovelAI 的 API 地址等详细参数，稍后到「设置 → 资源管理 → 生图配置」中填写。</p>
      `;
    },
    bind(ctx) {
      const ig = ctx.state.imageGen;
      ctx.$body.find('.gal-wizard-source-opt').on('click', function () {
        ig.source = String($(this).data('source') || 'none');
        ctx.$body.find('.gal-wizard-source-opt').removeClass('selected');
        $(this).addClass('selected');
        // 通用「生成剧情CG」开关对智绘姬无效
        ctx.$body.find('#gal-wizard-cgmode-wrap').toggle(ig.source !== 'chatu8');
      });
      ctx.$body.find('#gal-wizard-imagegen-cgmode').on('change', function () {
        ig.cgMode = $(this).is(':checked');
      });
    },
    async onNext(ctx) {
      const settings = getSettings();
      const ig = ctx.state.imageGen;
      let cotDirty = false;
      if ((settings.bgImageSource || 'none') !== ig.source) {
        settings.bgImageSource = ig.source;
        // 同步旧字段以兼容（与生图配置面板的来源切换逻辑一致）
        settings.realTimeBackgroundGen = ig.source === 'comfyui';
        if (settings.bananaImageGen) settings.bananaImageGen.enabled = ig.source === 'banana';
        if (settings.novelai) settings.novelai.enabled = ig.source === 'novelai';
        if (settings.wallhaven) settings.wallhaven.enabled = ig.source === 'wallhaven';
        cotDirty = true;
      }
      if ((settings.imageGenCgMode === true) !== ig.cgMode) {
        settings.imageGenCgMode = ig.cgMode;
        cotDirty = true;
      }
      saveSettings();
      if (cotDirty && getIsEnabled()) {
        try {
          await injectCOTToWorldbook();
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] 向导应用生图配置后 COT 更新失败:`, e);
          showToast('生图配置已保存，但世界书更新失败，可稍后在设置面板重试');
        }
      }
      return true;
    },
  },
  {
    id: 'import',
    render() {
      return `
        <div class="gal-wizard-step-title"><i class="fa-solid fa-images"></i> 导入图包资源</div>
        <div class="gal-wizard-status">
          <span id="gal-wizard-import-status"><i class="fa-solid fa-spinner fa-spin"></i> 正在统计资源…</span>
          <button class="gal-wizard-status-refresh" id="gal-wizard-status-refresh" title="刷新统计"><i class="fa-solid fa-rotate"></i></button>
        </div>
        <div class="gal-wizard-import-btns">
          <button class="gal-action-btn" id="gal-wizard-import-builtin"><i class="fa-solid fa-gift"></i> <span>内置图包（推荐）</span></button>
          <button class="gal-action-btn" id="gal-wizard-import-zip"><i class="fa-solid fa-file-zipper"></i> <span>本地压缩包</span></button>
          <button class="gal-action-btn" id="gal-wizard-import-remote"><i class="fa-solid fa-cloud-arrow-down"></i> <span>远程压缩包</span></button>
          <button class="gal-action-btn" id="gal-wizard-import-json"><i class="fa-solid fa-file-code"></i> <span>远程链接 JSON</span></button>
        </div>
        <input type="file" id="gal-wizard-zip-input" accept=".zip" style="display: none;">
        <input type="file" id="gal-wizard-json-input" accept=".json,application/json" style="display: none;">
        <p class="gal-wizard-hint">也可以先跳过这一步，稍后到「设置 → 资源管理」中导入或逐张上传。</p>
      `;
    },
    bind(ctx) {
      const refresh = () => refreshImportStatus(ctx);

      ctx.$body.find('#gal-wizard-status-refresh').on('click', refresh);

      ctx.$body.find('#gal-wizard-import-builtin').on('click', () => {
        showBuiltinBgPackBrowser({ onImported: refresh });
      });

      ctx.$body.find('#gal-wizard-import-zip').on('click', () => {
        ctx.$body.find('#gal-wizard-zip-input').trigger('click');
      });
      ctx.$body.find('#gal-wizard-zip-input').on('change', async function () {
        const file = this.files && this.files[0];
        $(this).val('');
        if (!file) return;
        try {
          await importFromZipFile(file);
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] 向导本地压缩包导入失败:`, e);
        }
        refresh();
      });

      ctx.$body.find('#gal-wizard-import-remote').on('click', () => {
        // 远程导入对话框没有完成回调，导入后可点状态栏的刷新按钮更新统计
        showRemoteZipImportDialog();
      });

      ctx.$body.find('#gal-wizard-import-json').on('click', () => {
        ctx.$body.find('#gal-wizard-json-input').trigger('click');
      });
      ctx.$body.find('#gal-wizard-json-input').on('change', async function () {
        const file = this.files && this.files[0];
        $(this).val('');
        if (!file) return;
        try {
          await importAssetsFromJson(file);
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] 向导 JSON 导入失败:`, e);
        }
        refresh();
      });
    },
    onEnter(ctx) {
      refreshImportStatus(ctx);
    },
  },
  {
    id: 'finish',
    render(ctx) {
      const settings = getSettings();
      const modeName = settings.simpleStorybookMode ? '简化图书绘本模式' : '标准 Galgame 模式';
      const sourceNames = { none: '关闭', chatu8: '智绘姬', comfyui: 'ComfyUI', banana: '大香蕉', novelai: 'NovelAI', wallhaven: 'Wallhaven' };
      const bgSourceName = sourceNames[settings.bgImageSource || 'none'] || settings.bgImageSource;
      return `
        <div class="gal-wizard-step-title"><i class="fa-solid fa-circle-check" style="color: #16a34a;"></i> 配置完成</div>
        <div class="gal-wizard-summary">
          <p><i class="fa-solid fa-layer-group"></i> 显示模式：${modeName}</p>
          <p><i class="fa-solid fa-image"></i> 生图来源：${bgSourceName}</p>
          <p id="gal-wizard-finish-counts"><i class="fa-solid fa-spinner fa-spin"></i> 正在统计资源…</p>
        </div>
        <p>点击「完成」将刷新视图并应用全部配置。</p>
        <p class="gal-wizard-hint">后续调整入口：「设置 → 基础设置」调整文本/画面/立绘等细节；「设置 → 资源管理」管理图包资源；「设置 → 通用 → 配置向导」重新打开本向导。</p>
      `;
    },
    onEnter(ctx) {
      getTotalResourceCounts()
        .then(counts => {
          ctx.$body
            .find('#gal-wizard-finish-counts')
            .html(`<i class="fa-solid fa-images"></i> 资源统计：立绘 ${counts.sprites} · 背景 ${counts.backgrounds} · 地图 ${counts.maps} · CG ${counts.cgs}`);
        })
        .catch(() => {
          ctx.$body.find('#gal-wizard-finish-counts').html('<i class="fa-solid fa-images"></i> 资源统计失败');
        });
    },
    async onNext() {
      if (getIsEnabled()) {
        applyGalgameMode();
        if (getSettings().hideOtherFloors) setTimeout(hideNonLastFloors, 80);
      }
      showToast('配置完成，视图已刷新');
      return true;
    },
  },
];

async function refreshImportStatus(ctx) {
  const $status = ctx.$body.find('#gal-wizard-import-status');
  if (!$status.length) return;
  try {
    const counts = await getTotalResourceCounts();
    $status.text(`当前资源：立绘 ${counts.sprites} · 背景 ${counts.backgrounds} · 地图 ${counts.maps} · CG ${counts.cgs}`);
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 向导资源统计失败:`, e);
    $status.text('资源统计失败');
  }
}

// 手动/自动入口。trigger: 'manual' | 'auto'（auto 时页脚显示「不再自动提示」勾选）
export function showSetupWizard({ trigger = 'manual' } = {}) {
  const mountRoot = getModalMountRoot();
  $(mountRoot).find(`#${WIZARD_MODAL_ID}`).remove();

  const dotsHtml = STEPS.map((_, i) => `<span class="gal-wizard-dot" data-step="${i}"></span>`).join('');
  const html = `
    <div class="gal-input-modal gal-z-critical" id="${WIZARD_MODAL_ID}">
      <div class="gal-input-box gal-wizard-box">
        <style>${WIZARD_STYLES}</style>
        <div class="gal-input-title gal-wizard-header">
          <span class="gal-wizard-title"><i class="fa-solid fa-wand-magic-sparkles" style="color: #0d6efd;"></i> 配置向导</span>
          <div class="gal-wizard-dots">${dotsHtml}</div>
          <button class="gal-wizard-close-btn" id="gal-wizard-close" title="关闭"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="gal-wizard-body" id="gal-wizard-body"></div>
        <div class="gal-wizard-footer">
          <label class="gal-wizard-optout" id="gal-wizard-optout-wrap">
            <input type="checkbox" id="gal-wizard-optout"> 不再自动提示
          </label>
          <div class="gal-wizard-nav">
            <button class="gal-action-btn" id="gal-wizard-prev"><i class="fa-solid fa-arrow-left"></i> <span>上一步</span></button>
            <button class="gal-action-btn" id="gal-wizard-next"><span>下一步</span> <i class="fa-solid fa-arrow-right"></i></button>
          </div>
        </div>
      </div>
    </div>
  `;

  $(mountRoot).append(html);
  const $modal = $(mountRoot).find(`#${WIZARD_MODAL_ID}`);
  const $body = $modal.find('#gal-wizard-body');
  makeDraggable($modal.find('.gal-input-box'), $modal.find('.gal-wizard-header'));

  if (trigger === 'auto') {
    $modal.find('#gal-wizard-optout-wrap').css('display', 'flex');
  }

  const ctx = {
    $modal,
    $body,
    trigger,
    state: { mode: getSettings().simpleStorybookMode ? 'storybook' : 'standard' },
  };
  let currentStep = 0;

  const closeWizard = () => {
    if (trigger === 'auto' && $modal.find('#gal-wizard-optout').is(':checked')) {
      setWizardOptOut();
    }
    $modal.remove();
  };

  const updateChrome = () => {
    const isFirst = currentStep === 0;
    const isLast = currentStep === STEPS.length - 1;
    $modal.find('#gal-wizard-prev').prop('disabled', isFirst);
    $modal
      .find('#gal-wizard-next')
      .html(isLast ? '<i class="fa-solid fa-check"></i> <span>完成</span>' : '<span>下一步</span> <i class="fa-solid fa-arrow-right"></i>');
    $modal.find('.gal-wizard-dot').each(function () {
      const i = Number($(this).data('step'));
      $(this).toggleClass('active', i === currentStep).toggleClass('done', i < currentStep);
    });
  };

  const renderStep = () => {
    const step = STEPS[currentStep];
    $body.html(step.render(ctx));
    if (typeof step.bind === 'function') step.bind(ctx);
    if (typeof step.onEnter === 'function') step.onEnter(ctx);
    updateChrome();
  };

  $modal.find('#gal-wizard-close').on('click', closeWizard);
  $modal.on('click', function (e) {
    if (e.target === this) closeWizard();
  });

  $modal.find('#gal-wizard-prev').on('click', () => {
    if (currentStep <= 0) return;
    currentStep -= 1;
    renderStep();
  });

  $modal.find('#gal-wizard-next').on('click', async function () {
    const $btn = $(this);
    if ($btn.prop('disabled')) return;
    const step = STEPS[currentStep];
    $btn.prop('disabled', true);
    try {
      if (typeof step.onNext === 'function') {
        const ok = await step.onNext(ctx);
        if (ok === false) return;
      }
      if (currentStep >= STEPS.length - 1) {
        closeWizard();
        return;
      }
      currentStep += 1;
      renderStep();
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 配置向导步骤执行失败:`, e);
      showToast('操作失败，请重试');
    } finally {
      $btn.prop('disabled', false);
    }
  });

  renderStep();
  return $modal;
}
