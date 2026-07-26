import { BGMManager } from '../audio/bgm-manager.js';
import { TTS_PROVIDER, getGptSoVitsVoiceList, getTTSEnabled, getTTSProvider, getTTSVoiceListAsync, normalizeGptSoVitsVoicesForStore, pickFirstUsableGptSoVitsVoice, setTTSEnabled } from '../audio/tts-config.js';
import { TTSManager } from '../audio/tts-manager.js';
import { ANCIENT_QINGLV_SKIN_ID, ANCIENT_SKIN_ID, CUSTOM_SKIN_ID, DEFAULT_DARK_SKIN_ID, JRPG_DAWN_SKIN_ID, JRPG_SKIN_ID, PERSONA_SKIN_ID, PERSONA_VELVET_SKIN_ID, SCRIPT_NAME, SHUJIAN_NIGHT_SKIN_ID, SHUJIAN_SKIN_ID, THEME, YANYUN_SKIN_ID, YANYUN_XUEJI_SKIN_ID } from '../core/constants.js';
import { setGlobalDebugEnabled } from '../core/debug.js';
import { $, topWindow } from '../core/env.js';
import { UI_SCALE_PERCENT_MAX, UI_SCALE_PERCENT_MIN, dialogScalePercentToScaleFactorForSkin, ensureEnhancedModeSettings, ensureTitleScreenSettings, getDialogFontScale, getSettings, normalizeBgFillMode, normalizeUiScalePercent, saveSettings, setCurrentCharEnabled, uiScalePercentToScaleFactor } from '../core/settings.js';
import { getIsEnabled, setHideOtherFloors, setIsEnabled } from '../core/state.js';
import { GalgameStore } from '../core/store.js';
import { saveBackground } from '../db/backgrounds.js';
import { getCachedHtmlSkins, hasHtmlSkinId } from '../db/html-skins.js';
import { clearAllPixiEffects, syncPixiEffectsSettings } from '../effects/pixi-effect-manager.js';
import { getAvailableModels, getAvailablePresets, getAvailableProfiles, getAvailableWorldbooks } from '../logic/enhanced-mode.js';
import { disableWorldbookGlobally, injectCOTToWorldbook } from '../logic/worldbook.js';
import { SpriteManager } from '../sprite/sprite-manager.js';
import { getModalMountRoot } from './fullscreen.js';
import { removeBGMWidget, renderBGMWidget } from './bgm-widget.js';
import { applyGalgameMode, hideNonLastFloors, restoreOriginalViews, showAllFloors } from './galgame-mode.js';
import { openGptSoVitsModelManager } from './gpt-sovits-model-manager.js';
import { updateButtonState } from './menu-button.js';
import { repaginateCurrentMessageForFontChange } from './overlay-content.js';
import { adjustToolbarForSpace, ensureGlobalOverlay, updateBgSafeInset } from './overlay.js';
import { applyHtmlSkinRuntime, clearHtmlSkinRuntime } from './html-skin-runtime.js';
import { showSetupWizard } from './setup-wizard.js';
import { TWILIGHT_SKIN_OPTION_ITEMS } from './skin-twilight.js';
import { showToast } from './toast.js';
import { finishActiveTypewriter, isTypewriterActive } from './typewriter.js';

// ============================================
// 统一设置面板 + UI 应用函数
// ============================================

const enhancedModeState = GalgameStore.enhancedMode;

function getLive2DManagerRef() {
  return topWindow?.galgame?.Live2DManager || topWindow?.Live2DManager || null;
}

// 延迟引用
let _buildAssetsPaneRef = null;
let _bindAssetsPaneRef = null;
let _assetStylesRef = null;

// 基础设置 L2 分类:记住上次停留的 tab(面板重建时恢复)
const SETTINGS_L2_TABS = ['general', 'text', 'visual', 'sprite', 'tts', 'cot', 'advanced'];
let lastSettingsL2Tab = 'general';

export function setSettingsPanelRefs({ buildAssetsPane, bindAssetsPane, assetStyles }) {
  if (buildAssetsPane) _buildAssetsPaneRef = buildAssetsPane;
  if (bindAssetsPane) _bindAssetsPaneRef = bindAssetsPane;
  if (assetStyles) _assetStylesRef = assetStyles;
}

function buildAboutPane() {
  return `
    <div class="gal-about-card">
      <h3><i class="fa-solid fa-bullhorn"></i> 插件发布地址</h3>
      <p>
        <a href="https://discord.com/channels/1134557553011998840/1464262276583395359" target="_blank" rel="noopener noreferrer">
          Discord 发布帖（点击打开）
        </a>
      </p>
    </div>

    <div class="gal-about-card">
      <h3><i class="fa-solid fa-copyright"></i> Live2D 版权与使用声明</h3>
      <p>
        Live2D 模型及其相关素材的版权归原作者或权利人所有。除原始授权另有明确许可外，本插件中的模型与资源仅供学习、研究与技术交流使用。
      </p>
      <p class="gal-about-warning">
        禁止将 Live2D 模型或相关素材用于任何商业用途。
      </p>
    </div>

    <div class="gal-about-card">
      <h3><i class="fa-solid fa-scale-balanced"></i> 许可协议（CC BY-NC-SA 4.0）</h3>
      <p>
        本插件相关内容遵循
        <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0</a>
        声明。你可以在署名并以相同方式共享的前提下进行非商业使用与修改。
      </p>
      <p class="gal-about-warning">
        明确禁止商用，包括但不限于售卖、付费分发、商业引流、商业服务集成。
      </p>
    </div>

    <div class="gal-about-card">
      <h3><i class="fa-solid fa-gavel"></i> 法律合规声明</h3>
      <p>
        使用者必须遵守所在地以及资源来源地的法律法规，禁止将本插件用于违法、侵权、规避监管或其他不当用途。因违规使用产生的风险与责任由使用者自行承担。
      </p>
    </div>
  `;
}

// 皮肤列表定义
const BUILTIN_SKIN_LIST = [
  { value: 'none',    label: '默认' },
  { value: DEFAULT_DARK_SKIN_ID, label: '默认 · 深色' },
  { value: ANCIENT_SKIN_ID, label: '墨染千秋（水墨长卷）' },
  { value: ANCIENT_QINGLV_SKIN_ID, label: '墨染千秋 · 青绿设色' },
  { value: PERSONA_SKIN_ID, label: '心之怪盗（女神异闻录）' },
  { value: PERSONA_VELVET_SKIN_ID, label: '心之怪盗 · 天鹅绒房间' },
  { value: JRPG_SKIN_ID,    label: '苍穹之庭（星降之夜）' },
  { value: JRPG_DAWN_SKIN_ID, label: '苍穹之庭 · 昼之庭黎明' },
  { value: YANYUN_SKIN_ID,  label: '燕云十六声（夜雪听风）' },
  { value: YANYUN_XUEJI_SKIN_ID, label: '燕云十六声 · 雪霁' },
  { value: 'skin-classic',  label: '樱色物语（经典Galgame）' },
  { value: SHUJIAN_SKIN_ID, label: '朱笺（宣纸墨印）' },
  { value: SHUJIAN_NIGHT_SKIN_ID, label: '朱笺 · 墨夜' },
  ...TWILIGHT_SKIN_OPTION_ITEMS,
];

function getEffectiveSkinList() {
  const htmlSkinItems = getCachedHtmlSkins().map(skin => ({
    value: skin.id,
    label: `自定义 · ${skin.name}`,
  }));
  return [...BUILTIN_SKIN_LIST, ...htmlSkinItems];
}

export function getSkinOptionHtml(currentSkin) {
  return getEffectiveSkinList()
    .map(item => `<option value="${escapeHtml(item.value)}" ${normalizeSkinValue(currentSkin) === item.value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`)
    .join('');
}

export function refreshSkinSelectElement($root = null) {
  const $scope = $root && typeof $root.find === 'function' ? $root : $(topWindow.document || document);
  const $select = $scope.find('#gal-skin-select');
  if (!$select.length) return;
  $select.html(getSkinOptionHtml(getSettings().skin));
}

function normalizeSkinValue(rawSkin) {
  const skin = String(rawSkin || 'none').trim();
  if (skin === 'skin-western' || skin === CUSTOM_SKIN_ID) return 'none';
  if (BUILTIN_SKIN_LIST.some(item => item.value === skin)) return skin;
  if (hasHtmlSkinId(skin)) return skin;
  return 'none';
}

const DIALOG_FONT_PRESETS = [
  {
    value: 'sans',
    label: '现代黑体（默认）',
    stack: '"Noto Sans SC","PingFang SC","Microsoft YaHei","Helvetica Neue",Arial,sans-serif',
  },
  {
    value: 'serif',
    label: '思源宋体',
    stack: '"Noto Serif SC","Songti SC","SimSun","STSong",serif',
  },
  {
    value: 'wenkai',
    label: '霞鹜文楷',
    stack: '"LXGW WenKai Screen","LXGW WenKai","KaiTi","STKaiti",serif',
  },
  {
    value: 'kaiti',
    label: '经典楷体',
    stack: '"KaiTi","STKaiti","Kaiti SC","DFKai-SB","Noto Serif SC",serif',
  },
  {
    value: 'mono',
    label: '等宽字体',
    stack: '"Sarasa Mono SC","Cascadia Mono","JetBrains Mono","SFMono-Regular","Consolas","Liberation Mono",monospace',
  },
];

function getDialogFontStack(fontKey) {
  const normalizedKey = String(fontKey || '').trim().toLowerCase();
  const matched = DIALOG_FONT_PRESETS.find(item => item.value === normalizedKey);
  return matched ? matched.stack : DIALOG_FONT_PRESETS[0].stack;
}

function normalizeVoiceNameList(rawList) {
  return Array.from(
    new Set(
      (Array.isArray(rawList) ? rawList : [])
        .map(name => String(name || '').trim())
        .filter(Boolean),
    ),
  );
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanupAssetManagerDocumentEvents() {
  $(topWindow.document).off('.galPackMenu').off('.galMenus').off('.galImportMenu');
}

// 主开关副作用统一入口（设置面板 #gal-main-toggle 与配置向导共用，防止逻辑漂移）
export async function setGalgameMasterEnabled(newEnabled) {
  setIsEnabled(newEnabled);
  setCurrentCharEnabled(newEnabled);
  updateButtonState();
  if (newEnabled) {
    await injectCOTToWorldbook();
    applyGalgameMode();
    if (getSettings().hideOtherFloors) setTimeout(hideNonLastFloors, 80);
  } else {
    await disableWorldbookGlobally();
    restoreOriginalViews();
  }
}

// 简化图书绘本模式切换副作用统一入口（#gal-simple-storybook-mode 与配置向导共用）
// COT 注入失败会 reject，由调用方决定提示方式
export async function applySimpleStorybookMode(enabled) {
  const settings = getSettings();
  settings.simpleStorybookMode = !!enabled;
  if (settings.simpleStorybookMode) {
    SpriteManager.reset($('#gal-global-overlay'));
  }
  applySettingsToUI();
  saveSettings();
  if (getIsEnabled()) {
    applyGalgameMode().catch(error => console.warn(`[${SCRIPT_NAME}] 切换简化图书绘本模式后刷新失败`, error));
  }
  await injectCOTToWorldbook();
}

// 应用皮肤到覆盖层
export function applySkin() {
  const settings = getSettings();
  const skin = normalizeSkinValue(settings.skin);
  const $overlay = $('#gal-global-overlay');
  const isHtmlSkin = hasHtmlSkinId(skin);
  // 移除所有皮肤 class
  BUILTIN_SKIN_LIST.forEach(s => { if (s.value !== 'none') $overlay.removeClass(s.value); });
  $overlay.removeClass(CUSTOM_SKIN_ID);
  $overlay.removeClass('skin-western');
  $overlay.removeClass('html-skin');
  // 添加选中的皮肤 class
  if (skin !== 'none') {
    $overlay.addClass(isHtmlSkin ? 'html-skin' : skin);
  }
  if (isHtmlSkin) {
    applyHtmlSkinRuntime(skin);
  } else {
    clearHtmlSkinRuntime();
  }
  if ($overlay.length) {
    ensureGlobalOverlay();
  }
}

// 应用设置到 UI
export function applySettingsToUI() {
  const settings = getSettings();
  const activeSkin = normalizeSkinValue(settings.skin);
  const fontScale = getDialogFontScale(settings);
  const dialogScalePercent = normalizeUiScalePercent(settings.dialogScalePercent);
  const toolbarScalePercent = normalizeUiScalePercent(settings.toolbarScalePercent);
  settings.dialogScalePercent = dialogScalePercent;
  settings.toolbarScalePercent = toolbarScalePercent;
  const dialogFontStack = getDialogFontStack(settings.dialogFontFamily);
  const paragraphGap = Math.max(0, Math.min(30, Number(settings.dialogParagraphGap) || 0));
  const lineHeightTenths = Math.round(Number(settings.dialogLineHeight) || 0);
  const padTopTenths = Math.max(0, Math.min(30, Math.round(Number(settings.dialogPadTop) || 0)));
  const padBottomTenths = Math.max(0, Math.min(30, Math.round(Number(settings.dialogPadBottom) || 0)));
  const $overlayEl = $('#gal-global-overlay');
  $overlayEl.css({
    '--gal-dialog-scale-user': dialogScalePercentToScaleFactorForSkin(dialogScalePercent, activeSkin),
    '--gal-toolbar-scale-user': uiScalePercentToScaleFactor(toolbarScalePercent),
    '--font-scale': fontScale,
    '--gal-dialog-font-family': dialogFontStack,
    '--gal-paragraph-gap': `${paragraphGap / 10}em`,
  });
  // 行距：0 表示跟随皮肤默认；12-30 表示 1.2-3.0
  if (lineHeightTenths >= 10) {
    $overlayEl.addClass('gal-custom-line-height').css('--gal-dialog-line-height', String(lineHeightTenths / 10));
  } else {
    $overlayEl.removeClass('gal-custom-line-height').css('--gal-dialog-line-height', '');
  }
  // 头/尾间距：0 表示跟随皮肤默认，>0 时在文本区追加上/下内边距
  if (padTopTenths > 0) {
    $overlayEl.addClass('gal-custom-pad-top').css('--gal-text-pad-top', `${padTopTenths / 10}em`);
  } else {
    $overlayEl.removeClass('gal-custom-pad-top').css('--gal-text-pad-top', '');
  }
  if (padBottomTenths > 0) {
    $overlayEl.addClass('gal-custom-pad-bottom').css('--gal-text-pad-bottom', `${padBottomTenths / 10}em`);
  } else {
    $overlayEl.removeClass('gal-custom-pad-bottom').css('--gal-text-pad-bottom', '');
  }

  const opacity = settings.dialogOpacity;
  // 统一透明度体系：默认皮肤与所有皮肤一样只写 CSS 变量，
  // 面板背景由 CSS 规则消费（默认面板规则见 数据库界面插件.css .gal-text-panel）
  $('#gal-global-overlay').css('--panel-opacity', opacity);
  $('.gal-text-panel').css({ 'background-color': '', 'background-image': '' });

  if (settings.showSprites && settings.simpleStorybookMode !== true) {
    $('.gal-layer-character').show();
  } else {
    $('.gal-layer-character').hide();
  }
  if (!settings.showMissingSpritePlaceholder) {
    $('#gal-global-overlay .gal-char-placeholder').remove();
  }

  const $charLayer = $('.gal-layer-character');
  $charLayer.css({
    bottom: settings.spriteBottomOffset + '%',
    gap: settings.spriteSpacing + '%',
  });

  const el = $charLayer.get(0);
  if (el) {
    el.style.setProperty('--base-scale', settings.spriteScale / 100);
  }

  if (settings.speakerGlow) {
    $('.gal-layer-character').addClass('glow-enabled');
  } else {
    $('.gal-layer-character').removeClass('glow-enabled');
  }

  if (settings.speakerBubble) {
    $('.gal-layer-character').addClass('bubble-enabled');
  } else {
    $('.gal-layer-character').removeClass('bubble-enabled');
  }

  // 说话者景深聚焦：CSS 降级路径的类开关 + 模糊强度变量（GSAP 路径在 setFocus 内读取设置）
  if (settings.speakerFocus !== false) {
    $charLayer.addClass('dof-enabled');
  } else {
    $charLayer.removeClass('dof-enabled');
  }
  if (el) {
    const dofBlur = Number(settings.speakerFocusBlur);
    el.style.setProperty('--gal-dof-blur', `${Number.isFinite(dofBlur) ? Math.max(0, dofBlur) : 1}px`);
  }
  // GSAP 路径的 filter 是内联样式，改设置后立即同步在场的非说话者，不等下一次切换
  $('.gal-char-container.silent.gsap-animated').each(function () {
    const dofBlur = Number(settings.speakerFocusBlur);
    const blurPx = Number.isFinite(dofBlur) ? Math.max(0, dofBlur) : 1;
    this.style.filter = settings.speakerFocus !== false
      ? `brightness(0.7) saturate(0.85) blur(${blurPx}px)`
      : 'brightness(0.7) saturate(1) blur(0px)';
  });

  applyBgFillMode();
  applySkin();
  applyTextEffect();
  syncPixiEffectsSettings();
  // 对话框/工具栏缩放变化会影响底栏是否放得下，重新实测降级档位
  adjustToolbarForSpace();
  // 上面的皮肤/缩放/底栏变化都会改变对话框高度，
  // 「避开对话框」模式的背景让位高度需在布局稳定后重测
  updateBgSafeInset();
}

export function applyBgFillMode() {
  const settings = getSettings();
  const mode = normalizeBgFillMode(settings.bgFillMode);
  const overlay = $('#gal-global-overlay').get(0);
  if (!overlay) return;

  // 变量写在 overlay 根节点上，由 .gal-bg-layer 继承消费：
  // ensureBackgroundLayers() 会动态新建背景层，写在层上的内联样式会丢失
  overlay.classList.toggle('gal-bg-avoid-dialog', mode === 'avoid-dialog');
  if (mode === 'avoid-dialog') {
    // 尺寸/位置由「避开对话框」的伪元素规则接管，清掉普通模式的变量避免残留
    overlay.style.removeProperty('--gal-bg-fit');
    overlay.style.removeProperty('--gal-bg-pos');
    updateBgSafeInset();
    return;
  }

  overlay.style.setProperty('--gal-bg-fit', mode);
  overlay.style.setProperty('--gal-bg-pos', mode === 'contain' ? 'center top' : 'center');
  overlay.style.removeProperty('--gal-bg-safe-inset');
}

export function applyTextEffect() {
  const settings = getSettings();
  const effect = settings.textEffect || 'none';
  const $textPanel = $('.gal-text-panel');
  const $dialogText = $('.gal-dialog-text');
  const $nameBadge = $('.gal-name-badge');

  const setInlineStyles = ($els, styles, forceImportant = false) => {
    const priority = forceImportant ? 'important' : '';
    $els.each(function () {
      const el = this;
      if (!el || !el.style) return;
      Object.entries(styles).forEach(([prop, value]) => {
        if (value === '' || value === null || value === undefined) {
          el.style.removeProperty(prop);
        } else {
          el.style.setProperty(prop, String(value), priority);
        }
      });
    });
  };

  $textPanel.removeClass('text-effect-glass text-effect-gradient text-effect-text-bg');
  setInlineStyles($dialogText, {
    'text-shadow': '',
    '-webkit-text-stroke': '',
    'background-color': '',
    'padding': '',
    'border-radius': '',
    'color': ''
  });
  setInlineStyles($nameBadge, {
    'text-shadow': '',
    '-webkit-text-stroke': ''
  });

  switch (effect) {
    case 'shadow':
      setInlineStyles($dialogText, {
        'text-shadow': '0 0 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7), 0 2px 4px rgba(0,0,0,0.5)',
        'color': '#fff'
      }, true);
      setInlineStyles($nameBadge, {
        'text-shadow': '0 0 4px rgba(0,0,0,0.8), 0 2px 4px rgba(0,0,0,0.5)'
      }, true);
      break;

    case 'glow':
      setInlineStyles($dialogText, {
        'text-shadow': '0 0 5px rgba(255,255,255,0.8), 0 0 10px rgba(255,255,255,0.6), 0 0 20px rgba(0,210,255,0.4)',
        'color': '#fff'
      }, true);
      setInlineStyles($nameBadge, {
        'text-shadow': '0 0 5px rgba(0,210,255,0.8), 0 0 10px rgba(0,210,255,0.5)'
      }, true);
      break;

    case 'stroke':
      setInlineStyles($dialogText, {
        '-webkit-text-stroke': '1.5px rgba(0,0,0,0.8)',
        'text-shadow': '0 2px 4px rgba(0,0,0,0.3)',
        'color': '#fff'
      }, true);
      setInlineStyles($nameBadge, {
        '-webkit-text-stroke': '1px rgba(0,0,0,0.6)',
        'text-shadow': '0 1px 2px rgba(0,0,0,0.3)'
      }, true);
      break;

    case 'glass':
      $textPanel.addClass('text-effect-glass');
      setInlineStyles($dialogText, { 'color': '#333' }, true);
      break;

    case 'gradient':
      $textPanel.addClass('text-effect-gradient');
      setInlineStyles($dialogText, {
        'text-shadow': '0 1px 2px rgba(0,0,0,0.3)',
        'color': '#fff'
      }, true);
      break;

    case 'text-bg':
      $textPanel.addClass('text-effect-text-bg');
      setInlineStyles($dialogText, {
        'background-color': 'rgba(0,0,0,0.6)',
        'padding': '8px 12px',
        'border-radius': '8px',
        'color': '#fff',
        'text-shadow': '0 1px 2px rgba(0,0,0,0.3)'
      }, true);
      break;

    default:
      break;
  }
}

export async function showSettingsPanel(topTab, subTab) {
  const $existing = $('#gal-unified-panel');
  if ($existing.length) {
    cleanupAssetManagerDocumentEvents();
    if (topTab === undefined) { $existing.remove(); return; } // toggle
    $existing.remove(); // 有参数 = 重建
  }
  topTab = topTab || 'settings';

  const settings = getSettings();
  ensureTitleScreenSettings();
  settings.ttsDefaultMaleVoices = normalizeVoiceNameList(settings.ttsDefaultMaleVoices);
  settings.ttsDefaultFemaleVoices = normalizeVoiceNameList(settings.ttsDefaultFemaleVoices);
  const effectQuality = ['mobile', 'balanced', 'high'].includes(settings.effectsQuality)
    ? settings.effectsQuality
    : 'balanced';
  const effectMaxActiveParsed = parseInt(settings.effectsMaxActive, 10);
  const effectMaxActive = Number.isFinite(effectMaxActiveParsed)
    ? Math.max(1, Math.min(effectMaxActiveParsed, 6))
    : 2;
  settings.effectsQuality = effectQuality;
  settings.effectsMaxActive = effectMaxActive;
  settings.effectsEnabled = settings.effectsEnabled !== false;
  settings.effectsAutoClearOnSceneChange = settings.effectsAutoClearOnSceneChange !== false;
  settings.dialogScalePercent = normalizeUiScalePercent(settings.dialogScalePercent);
  settings.toolbarScalePercent = normalizeUiScalePercent(settings.toolbarScalePercent);
  const typewriterSpeedParsed = parseInt(settings.typewriterSpeed, 10);
  const typewriterSoundVolumeParsed = parseInt(settings.typewriterSoundVolume, 10);
  settings.typewriterEnabled = settings.typewriterEnabled !== false;
  settings.typewriterSpeed = Number.isFinite(typewriterSpeedParsed)
    ? Math.max(5, Math.min(typewriterSpeedParsed, 60))
    : 30;
  settings.typewriterSoundEnabled = settings.typewriterSoundEnabled !== false;
  settings.typewriterSoundVolume = Number.isFinite(typewriterSoundVolumeParsed)
    ? Math.max(0, Math.min(typewriterSoundVolumeParsed, 100))
    : 35;
  const live2dManager = getLive2DManagerRef();
  if (live2dManager) {
    live2dManager.debug = !!settings.globalDebug;
  }
  const isEnabled = getIsEnabled();

  const [presetNames, profileNames, modelNames, worldbookNames] = await Promise.all([
    getAvailablePresets(),
    getAvailableProfiles(),
    getAvailableModels(),
    getAvailableWorldbooks(),
  ]);

  const savedWorldbooks = settings.enhancedMode?.secondGenerate?.worldbooks || [];
  const presetOptions = [
    '<option value="">使用当前预设</option>',
    ...presetNames.map(p => `<option value="${escapeHtml(p)}" ${settings.enhancedMode?.secondGenerate?.presetName === p ? 'selected' : ''}>${escapeHtml(p)}</option>`),
  ].join('');
  const profileOptions = [
    '<option value="">使用当前连接配置</option>',
    ...profileNames.map(p => `<option value="${escapeHtml(p)}" ${settings.enhancedMode?.secondGenerate?.profileName === p ? 'selected' : ''}>${escapeHtml(p)}</option>`),
  ].join('');
  const modelOptions = [
    '<option value="">使用当前模型</option>',
    ...modelNames.map(m => `<option value="${escapeHtml(m)}" ${settings.enhancedMode?.secondGenerate?.modelName === m ? 'selected' : ''}>${escapeHtml(m)}</option>`),
  ].join('');

  const worldbookListHtml = worldbookNames.length === 0
    ? '<div style="font-size: 0.85rem; color: var(--gal-text-2, #333); margin-left: 24px; font-weight: 500;">暂无可用的世界书</div>'
    : `<div style="margin-left: 24px; max-height: 150px; overflow-y: auto; border: 1px solid var(--gal-border, #e3e7eb); border-radius: 6px; padding: 10px; background: var(--gal-panel-bg, #fff); color: var(--gal-text, #333);">
        ${worldbookNames.map(wb => `
          <label class="gal-check" style="padding: 6px 0; font-size: 0.9rem; font-weight: 500;">
            <input type="checkbox" class="gal-enhanced-worldbook-item" value="${escapeHtml(wb)}" ${savedWorldbooks.includes(wb) ? 'checked' : ''}>
            <span style="color: var(--gal-text, #333);">${escapeHtml(wb)}</span>
          </label>
        `).join('')}
      </div>`;
  const dialogFontOptions = DIALOG_FONT_PRESETS
    .map(item => `<option value="${escapeHtml(item.value)}" ${settings.dialogFontFamily === item.value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`)
    .join('');

  // 构建资源管理 pane (async)
  let assetsHtml = '';
  if (_buildAssetsPaneRef) {
    assetsHtml = await _buildAssetsPaneRef(subTab);
  }
  const assetStyles = _assetStylesRef ? _assetStylesRef() : '';

  // 基础设置 L2 分类:恢复上次停留的 tab
  const activeL2 = SETTINGS_L2_TABS.includes(lastSettingsL2Tab) ? lastSettingsL2Tab : 'general';

  const panelHtml = `
    <div class="gal-config-modal" id="gal-unified-panel">
      <div class="gal-config-panel">
        <!-- L1 Tab Header -->
        <div class="gal-l1-tab-header">
          <div class="gal-l1-tab-btn ${topTab === 'settings' ? 'active' : ''}" data-l1-tab="settings"><i class="fa-solid fa-gear"></i> <span>基础设置</span></div>
          <div class="gal-l1-tab-btn ${topTab === 'assets' ? 'active' : ''}" data-l1-tab="assets"><i class="fa-solid fa-folder-open"></i> <span>资源管理</span></div>
          <div class="gal-l1-tab-btn ${topTab === 'about' ? 'active' : ''}" data-l1-tab="about"><i class="fa-solid fa-circle-info"></i> <span>关于</span></div>
          <div style="flex:1;"></div>
          <button class="gal-config-close" id="gal-settings-close"><i class="fa-solid fa-times"></i></button>
        </div>

        <!-- L1 Pane: 基础设置 -->
        <div class="gal-config-body" data-l1-pane="settings" style="${topTab !== 'settings' ? 'display: none;' : ''}">
          <!-- 主开关常驻条（任何 L2 分类下都可见） -->
          <div class="gal-master-bar">
            <button id="gal-main-toggle" class="${isEnabled ? 'gal-toggle-on' : 'gal-toggle-off'}">
              <i class="fa-solid ${isEnabled ? 'fa-toggle-on' : 'fa-toggle-off'}" style="font-size: 1.1rem;"></i>
              <span>${isEnabled ? 'Galgame 模式已开启' : 'Galgame 模式已关闭'}</span>
            </button>
            <span class="gal-master-note">当前角色卡独立设置</span>
          </div>

          <!-- L2 分类导航 -->
          <div class="gal-l2-tab-header">
            <button class="gal-l2-tab-btn ${activeL2 === 'general' ? 'active' : ''}" data-l2-tab="general"><i class="fa-solid fa-sliders"></i> 通用</button>
            <button class="gal-l2-tab-btn ${activeL2 === 'text' ? 'active' : ''}" data-l2-tab="text"><i class="fa-solid fa-font"></i> 文本显示</button>
            <button class="gal-l2-tab-btn ${activeL2 === 'visual' ? 'active' : ''}" data-l2-tab="visual"><i class="fa-solid fa-display"></i> 画面与特效</button>
            <button class="gal-l2-tab-btn ${activeL2 === 'sprite' ? 'active' : ''}" data-l2-tab="sprite"><i class="fa-solid fa-user"></i> 立绘</button>
            <button class="gal-l2-tab-btn ${activeL2 === 'tts' ? 'active' : ''}" data-l2-tab="tts"><i class="fa-solid fa-volume-high"></i> TTS配音</button>
            <button class="gal-l2-tab-btn ${activeL2 === 'cot' ? 'active' : ''}" data-l2-tab="cot"><i class="fa-solid fa-wand-magic-sparkles"></i> 生成/COT</button>
            <button class="gal-l2-tab-btn ${activeL2 === 'advanced' ? 'active' : ''}" data-l2-tab="advanced"><i class="fa-solid fa-flask"></i> 高级</button>
          </div>

          <div class="gal-l2-body">

          <!-- L2 Pane: 文本显示 -->
          <div data-l2-pane="text" style="${activeL2 === 'text' ? '' : 'display: none;'}">
          <!-- 实时预览：迷你对话框模型，消费与真实对话框相同的设置值 -->
          <div class="gal-preview-wrap">
            <div class="gal-preview-stage">
              <div class="gal-preview-panel" id="gal-text-preview-panel">
                <div class="gal-preview-badge" id="gal-text-preview-badge">少女</div>
                <div class="gal-preview-text" id="gal-text-preview-text">
                  <p>晕染着樱色的天空下，风轻轻拂过发梢。</p>
                  <p>——这就是与你相遇的季节。</p>
                </div>
              </div>
            </div>
            <p class="gal-hint" style="margin: 6px 0 0;">实时预览：字体大小 / 对话字体 / 行距 / 段间距 / 头尾间距 / 透明度 / 文字特效 调整立即生效。</p>
          </div>
          <div class="gal-settings-divider"></div>
          <div class="gal-settings-section">
            <div class="gal-settings-section-title"><i class="fa-solid fa-font"></i> 文本显示</div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">字体大小</span>
              <div class="gal-settings-control">
                <input type="range" id="gal-font-size" min="1" max="30" step="1" value="${escapeHtml(settings.fontSize)}">
                <span class="gal-range-value" id="gal-font-size-value">${settings.fontSize}</span>
              </div>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">每页字数</span>
              <div class="gal-settings-control">
                <input type="range" id="gal-seg-length" min="0" max="1000" step="20" value="${escapeHtml(settings.dialogSegLengthOverride || 0)}">
                <span class="gal-range-value" id="gal-seg-length-value">${(Number(settings.dialogSegLengthOverride) || 0) > 0 ? settings.dialogSegLengthOverride : '自动'}</span>
              </div>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">行距</span>
              <div class="gal-settings-control">
                <input type="range" id="gal-line-height" min="0" max="30" step="1" value="${escapeHtml(settings.dialogLineHeight || 0)}">
                <span class="gal-range-value" id="gal-line-height-value">${(Number(settings.dialogLineHeight) || 0) >= 10 ? (Number(settings.dialogLineHeight) / 10).toFixed(1) : '默认'}</span>
              </div>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">段间距</span>
              <div class="gal-settings-control">
                <input type="range" id="gal-paragraph-gap" min="0" max="30" step="1" value="${escapeHtml(settings.dialogParagraphGap ?? 6)}">
                <span class="gal-range-value" id="gal-paragraph-gap-value">${((Number(settings.dialogParagraphGap) || 0) / 10).toFixed(1)}em</span>
              </div>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">头间距</span>
              <div class="gal-settings-control">
                <input type="range" id="gal-pad-top" min="0" max="30" step="1" value="${escapeHtml(settings.dialogPadTop || 0)}">
                <span class="gal-range-value" id="gal-pad-top-value">${(Number(settings.dialogPadTop) || 0) > 0 ? ((Number(settings.dialogPadTop) || 0) / 10).toFixed(1) + 'em' : '默认'}</span>
              </div>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">尾间距</span>
              <div class="gal-settings-control">
                <input type="range" id="gal-pad-bottom" min="0" max="30" step="1" value="${escapeHtml(settings.dialogPadBottom || 0)}">
                <span class="gal-range-value" id="gal-pad-bottom-value">${(Number(settings.dialogPadBottom) || 0) > 0 ? ((Number(settings.dialogPadBottom) || 0) / 10).toFixed(1) + 'em' : '默认'}</span>
              </div>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">对话框缩放</span>
              <div class="gal-settings-control">
                <input type="range" id="gal-dialog-scale-percent" min="${UI_SCALE_PERCENT_MIN}" max="${UI_SCALE_PERCENT_MAX}" step="1" value="${escapeHtml(settings.dialogScalePercent)}">
                <span class="gal-range-value" id="gal-dialog-scale-percent-value">${settings.dialogScalePercent}%</span>
              </div>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">底栏缩放</span>
              <div class="gal-settings-control">
                <input type="range" id="gal-toolbar-scale-percent" min="${UI_SCALE_PERCENT_MIN}" max="${UI_SCALE_PERCENT_MAX}" step="1" value="${escapeHtml(settings.toolbarScalePercent)}">
                <span class="gal-range-value" id="gal-toolbar-scale-percent-value">${settings.toolbarScalePercent}%</span>
              </div>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">对话字体</span>
              <div class="gal-settings-control">
                <select id="gal-dialog-font-family" class="gal-select">
                  ${dialogFontOptions}
                </select>
              </div>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">对话框透明度</span>
              <div class="gal-settings-control">
                <input type="range" id="gal-dialog-opacity" min="0" max="100" step="5" value="${escapeHtml(Math.round((1 - settings.dialogOpacity) * 100))}">
                <span class="gal-range-value" id="gal-dialog-opacity-value">${Math.round((1 - settings.dialogOpacity) * 100)}%</span>
              </div>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">文字特效</span>
              <div class="gal-settings-control">
                <select id="gal-text-effect" class="gal-select">
                  <option value="none" ${settings.textEffect === 'none' ? 'selected' : ''}>无</option>
                  <option value="shadow" ${settings.textEffect === 'shadow' ? 'selected' : ''}>阴影增强</option>
                  <option value="glow" ${settings.textEffect === 'glow' ? 'selected' : ''}>发光效果</option>
                  <option value="stroke" ${settings.textEffect === 'stroke' ? 'selected' : ''}>文字描边</option>
                  <option value="glass" ${settings.textEffect === 'glass' ? 'selected' : ''}>毛玻璃背景</option>
                  <option value="gradient" ${settings.textEffect === 'gradient' ? 'selected' : ''}>底部渐变遮罩</option>
                  <option value="text-bg" ${settings.textEffect === 'text-bg' ? 'selected' : ''}>独立文字背景</option>
                </select>
              </div>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">打字机显示</span>
              <label class="gal-switch"><input type="checkbox" id="gal-typewriter-enabled" ${settings.typewriterEnabled ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">打字速度</span>
              <div class="gal-settings-control">
                <input type="range" id="gal-typewriter-speed" min="5" max="60" step="1" value="${escapeHtml(settings.typewriterSpeed)}">
                <span class="gal-range-value" id="gal-typewriter-speed-value">${settings.typewriterSpeed}字/秒</span>
              </div>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">打字音效</span>
              <label class="gal-switch"><input type="checkbox" id="gal-typewriter-sound-enabled" ${settings.typewriterSoundEnabled ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">音效音量</span>
              <div class="gal-settings-control">
                <input type="range" id="gal-typewriter-sound-volume" min="0" max="100" step="1" value="${escapeHtml(settings.typewriterSoundVolume)}">
                <span class="gal-range-value" id="gal-typewriter-sound-volume-value">${settings.typewriterSoundVolume}%</span>
              </div>
            </div>
          </div>

          </div><!-- /L2 text -->

          <!-- L2 Pane: 通用（播放节奏） -->
          <div data-l2-pane="general" style="${activeL2 === 'general' ? '' : 'display: none;'}">
          <div class="gal-settings-section">
            <div class="gal-settings-section-title"><i class="fa-solid fa-play"></i> 自动播放</div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">播放间隔</span>
              <div class="gal-settings-control">
                <input type="range" id="gal-auto-speed" min="1" max="8" step="0.5" value="${escapeHtml(settings.autoPlaySpeed)}">
                <span class="gal-range-value" id="gal-auto-speed-value">${settings.autoPlaySpeed}秒</span>
              </div>
            </div>
          </div>
          </div><!-- /L2 general -->

          <!-- L2 Pane: 立绘（显示开关） -->
          <div data-l2-pane="sprite" style="${activeL2 === 'sprite' ? '' : 'display: none;'}">
          <div class="gal-settings-section">
            <div class="gal-settings-section-title"><i class="fa-solid fa-user"></i> 立绘显示</div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">显示立绘</span>
              <label class="gal-switch"><input type="checkbox" id="gal-show-sprites" ${settings.showSprites ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
          </div>
          </div><!-- /L2 sprite -->

          <!-- L2 Pane: 通用（显示行为） -->
          <div data-l2-pane="general" style="${activeL2 === 'general' ? '' : 'display: none;'}">
          <div class="gal-settings-divider"></div>
          <div class="gal-settings-section">
            <div class="gal-settings-section-title"><i class="fa-solid fa-eye"></i> 显示行为</div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">沉浸模式</span>
              <label class="gal-switch"><input type="checkbox" id="gal-hide-floors" ${settings.hideOtherFloors ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <p class="gal-hint">隐藏其他楼层，仅保留当前对话。</p>
            <div class="gal-settings-row">
              <span class="gal-settings-label">简化图书绘本模式</span>
              <label class="gal-switch"><input type="checkbox" id="gal-simple-storybook-mode" ${settings.simpleStorybookMode ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <p class="gal-hint">纯文本对话框，不解析角色/旁白/表情，不显示立绘/Live2D；背景（含背景图包）照常切换。</p>
          </div>
          </div><!-- /L2 general -->

          <!-- L2 Pane: 画面与特效 -->
          <div data-l2-pane="visual" style="${activeL2 === 'visual' ? '' : 'display: none;'}">
          <div class="gal-settings-section">
            <div class="gal-settings-section-title"><i class="fa-solid fa-display"></i> 画面</div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">界面皮肤</span>
              <select id="gal-skin-select" class="gal-select">
                ${getSkinOptionHtml(settings.skin)}
              </select>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">背景图填充</span>
              <select id="gal-bg-fill-mode" class="gal-select">
                <option value="cover" ${normalizeBgFillMode(settings.bgFillMode) === 'cover' ? 'selected' : ''}>Cover (填满裁剪)</option>
                <option value="contain" ${normalizeBgFillMode(settings.bgFillMode) === 'contain' ? 'selected' : ''}>Contain (完整显示)</option>
                <option value="avoid-dialog" ${normalizeBgFillMode(settings.bgFillMode) === 'avoid-dialog' ? 'selected' : ''}>完全显示（避开对话框）</option>
              </select>
            </div>
            <p class="gal-hint">「完全显示」下背景图/CG 只占对话框上方区域，绝不被遮挡；下方留白用同图模糊铺底。</p>
            <div class="gal-settings-row">
              <span class="gal-settings-label">CG直接替换背景</span>
              <label class="gal-switch"><input type="checkbox" id="gal-cg-as-background" ${settings.cgAsBackground ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <p class="gal-hint">CG段落全屏铺为背景，对话框不再显示缩略图。</p>
          </div>
          </div><!-- /L2 visual -->

          <!-- L2 Pane: 生成/COT（输出规范） -->
          <div data-l2-pane="cot" style="${activeL2 === 'cot' ? '' : 'display: none;'}">
          <div class="gal-subcard" style="margin-bottom: 16px; font-size: 0.8rem; color: var(--gal-text-2, #5c6470); line-height: 1.6;">
            <i class="fa-solid fa-circle-info" style="color: ${THEME.accent};"></i>
            本页设置影响 AI 输出格式（世界书 COT 注入）与二次生成流程。
          </div>
          <div class="gal-settings-section">
            <div class="gal-settings-section-title"><i class="fa-solid fa-file-pen"></i> 输出规范</div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">情境样式</span>
              <label class="gal-switch"><input type="checkbox" id="gal-situational-style-enabled" ${settings.situationalStyleEnabled !== false ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <p class="gal-hint">控制 COT 是否包含 &lt;styled&gt; 规范。</p>
            <div class="gal-settings-row">
              <span class="gal-settings-label">启用BGM</span>
              <label class="gal-switch"><input type="checkbox" id="gal-bgm-cot-enabled" ${settings.bgmEnabled !== false ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <p class="gal-hint">控制 COT 是否包含 &lt;bgm&gt; 规范。</p>
            <div class="gal-settings-row">
              <span class="gal-settings-label">AI自动套用立绘</span>
              <label class="gal-switch"><input type="checkbox" id="gal-auto-sprite-assign-enabled" ${settings.autoSpriteAssignEnabled !== false ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <p class="gal-hint">新主要角色/重要配角登场时，AI 自动从内置图包挑选气质匹配的立绘模板套用。</p>
          </div>
          </div><!-- /L2 cot -->

          <!-- L2 Pane: 画面与特效（Pixi） -->
          <div data-l2-pane="visual" style="${activeL2 === 'visual' ? '' : 'display: none;'}">
          <div class="gal-settings-divider"></div>
          <div class="gal-settings-section">
            <div class="gal-settings-section-title"><i class="fa-solid fa-wand-magic-sparkles"></i> Pixi特效</div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">启用特效</span>
              <label class="gal-switch"><input type="checkbox" id="gal-effects-enabled" ${settings.effectsEnabled ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">质量档位</span>
              <select id="gal-effects-quality" class="gal-select">
                <option value="mobile" ${effectQuality === 'mobile' ? 'selected' : ''}>Mobile（省电）</option>
                <option value="balanced" ${effectQuality === 'balanced' ? 'selected' : ''}>Balanced（默认）</option>
                <option value="high" ${effectQuality === 'high' ? 'selected' : ''}>High（高画质）</option>
              </select>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">切场景自动清空</span>
              <label class="gal-switch"><input type="checkbox" id="gal-effects-autoclear" ${settings.effectsAutoClearOnSceneChange ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">并发上限</span>
              <div class="gal-settings-control">
                <input type="range" id="gal-effects-max-active" min="1" max="6" step="1" value="${escapeHtml(effectMaxActive)}">
                <span class="gal-range-value" id="gal-effects-max-active-value">${effectMaxActive}</span>
              </div>
            </div>
          </div>
          </div><!-- /L2 visual (Pixi) -->

          <!-- L2 Pane: 立绘（布局与指示器） -->
          <div data-l2-pane="sprite" style="${activeL2 === 'sprite' ? '' : 'display: none;'}">
          <div class="gal-settings-divider"></div>
          <div class="gal-settings-section">
            <div class="gal-settings-section-title"><i class="fa-solid fa-user"></i> 立绘设置</div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">立绘大小</span>
              <div class="gal-settings-control">
                <input type="range" id="gal-sprite-scale" min="50" max="150" step="5" value="${escapeHtml(settings.spriteScale)}">
                <span class="gal-range-value" id="gal-sprite-scale-value">${settings.spriteScale}%</span>
              </div>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">垂直位置 <small style="color: var(--gal-text-3, #999);">(底部偏移)</small></span>
              <div class="gal-settings-control">
                <input type="range" id="gal-sprite-bottom" min="0" max="50" step="1" value="${escapeHtml(settings.spriteBottomOffset)}">
                <span class="gal-range-value" id="gal-sprite-bottom-value">${settings.spriteBottomOffset}%</span>
              </div>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">立绘间距 <small style="color: var(--gal-text-3, #999);">(左右距离)</small></span>
              <div class="gal-settings-control">
                <input type="range" id="gal-sprite-spacing" min="0" max="20" step="1" value="${escapeHtml(settings.spriteSpacing)}">
                <span class="gal-range-value" id="gal-sprite-spacing-value">${settings.spriteSpacing}%</span>
              </div>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">无立绘时显示添加框 <small style="color: var(--gal-text-3, #999);">(关闭后不可点击上传)</small></span>
              <label class="gal-switch"><input type="checkbox" id="gal-show-missing-sprite-placeholder" ${settings.showMissingSpritePlaceholder ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">说话者光晕 <small style="color: var(--gal-text-3, #999);">(轮廓发光)</small></span>
              <label class="gal-switch"><input type="checkbox" id="gal-speaker-glow" ${settings.speakerGlow ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">气泡指示器 <small style="color: var(--gal-text-3, #999);">(漫画风格)</small></span>
              <label class="gal-switch"><input type="checkbox" id="gal-speaker-bubble" ${settings.speakerBubble ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">景深聚焦 <small style="color: var(--gal-text-3, #999);">(非说话者失焦)</small></span>
              <label class="gal-switch"><input type="checkbox" id="gal-speaker-focus" ${settings.speakerFocus !== false ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">失焦模糊强度 <small style="color: var(--gal-text-3, #999);">(非说话者)</small></span>
              <div class="gal-settings-control">
                <input type="range" id="gal-speaker-focus-blur" min="0" max="4" step="0.5" value="${escapeHtml(settings.speakerFocusBlur)}">
                <span class="gal-range-value" id="gal-speaker-focus-blur-value">${settings.speakerFocusBlur}px</span>
              </div>
            </div>
          </div>
          </div><!-- /L2 sprite (layout) -->

          <!-- L2 Pane: TTS配音 -->
          <div data-l2-pane="tts" style="${activeL2 === 'tts' ? '' : 'display: none;'}">
          <div class="gal-settings-section">
            <div class="gal-settings-section-title"><i class="fa-solid fa-volume-high"></i> TTS配音</div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">启用TTS配音</span>
              <label class="gal-switch"><input type="checkbox" id="gal-tts-enabled" ${getTTSEnabled() ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <p class="gal-hint">开启：对话格式含TTS属性，表情在开头；关闭：简单对话格式，表情在结尾。此开关会同步更新 COT 输出格式。</p>
            <div class="gal-settings-row">
              <span class="gal-settings-label">TTS引擎</span>
              <select id="gal-tts-provider" class="gal-select">
                <option value="littlewhitebox" ${settings.ttsProvider === 'littlewhitebox' ? 'selected' : ''}>小白X（豆包火山）</option>
                <option value="gpt_sovits_v2" ${settings.ttsProvider === 'gpt_sovits_v2' ? 'selected' : ''}>GPT-SoVITS v2ProPlus</option>
              </select>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">自动播放 <small style="color: var(--gal-text-3, #999);">(切段自动朗读)</small></span>
              <label class="gal-switch"><input type="checkbox" id="gal-tts-autoplay" ${settings.ttsAutoPlay ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">中日双语模式</span>
              <label class="gal-switch"><input type="checkbox" id="gal-tts-bilingual-zh-ja-enabled" ${settings.ttsBilingualZhJaEnabled ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <p class="gal-hint">显示中文，TTS发送日文。按“中文文本[JP]日文文本”输出（兼容【JP】）；未命中时自动回退原文朗读。</p>
            <div class="gal-settings-row">
              <span class="gal-settings-label">默认音色</span>
              <select id="gal-tts-default-speaker" class="gal-select">
                <option value="">（不指定）</option>
              </select>
            </div>
            <p id="gal-tts-default-speaker-hint" class="gal-hint"></p>
            <div class="gal-settings-row" style="align-items: flex-start;">
              <span class="gal-settings-label">默认男声列表</span>
              <div class="gal-settings-control" style="flex-direction: column; align-items: stretch; width: min(100%, 480px); gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <select id="gal-tts-default-male-candidate" class="gal-voice-pool-select" style="flex: 1;">
                    <option value="">选择后立即加入列表</option>
                  </select>
                </div>
                <small class="gal-hint" style="margin: 0;">上方仅用于挑选候选音色，选中后会立即加入下方列表。</small>
                <div style="font-size: 0.78rem; color: var(--gal-text-2, #666);">已添加音色：</div>
                <div id="gal-tts-default-male-list" class="gal-voice-chip-list"></div>
              </div>
            </div>
            <div class="gal-settings-row" style="align-items: flex-start;">
              <span class="gal-settings-label">默认女声列表</span>
              <div class="gal-settings-control" style="flex-direction: column; align-items: stretch; width: min(100%, 480px); gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <select id="gal-tts-default-female-candidate" class="gal-voice-pool-select" style="flex: 1;">
                    <option value="">选择后立即加入列表</option>
                  </select>
                </div>
                <small class="gal-hint" style="margin: 0;">上方仅用于挑选候选音色，选中后会立即加入下方列表。</small>
                <div style="font-size: 0.78rem; color: var(--gal-text-2, #666);">已添加音色：</div>
                <div id="gal-tts-default-female-list" class="gal-voice-chip-list"></div>
              </div>
            </div>
            <p class="gal-hint">
              当 COT 使用 <code>男声/女声</code> 标签且角色未绑定时，将从对应列表随机分配并自动绑定。
            </p>

            <div id="gal-gpt-sovits-config" class="gal-subcard" style="margin-top: 10px; ${settings.ttsProvider === 'gpt_sovits_v2' ? '' : 'display: none;'}">
              <div style="font-weight: 700; margin-bottom: 10px; color: var(--gal-text, ${THEME.dark}); display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-microchip" style="color:${THEME.accent};"></i>
                <span>GPT-SoVITS（api_v2.py）设置</span>
              </div>
              <div class="gal-settings-row">
                <span class="gal-settings-label">API地址</span>
                <input type="text" id="gal-gpt-sovits-url" class="gal-input" value="${escapeHtml(settings.gptSoVits?.apiUrl || '')}" placeholder="http://127.0.0.1:9880">
              </div>
              <div class="gal-settings-row">
                <span class="gal-settings-label">使用酒馆代理</span>
                <label class="gal-switch"><input type="checkbox" id="gal-gpt-sovits-proxy" ${settings.gptSoVits?.useCorsProxy ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
              </div>
              <div class="gal-settings-row">
                <span class="gal-settings-label">模型切换模式</span>
                <select id="gal-gpt-sovits-switch-mode" class="gal-select">
                  <option value="set_weights" ${(settings.gptSoVits?.modelSwitchMode || 'set_weights') === 'set_weights' ? 'selected' : ''}>set_weights (api_v2.py)</option>
                  <option value="set_model" ${(settings.gptSoVits?.modelSwitchMode || '') === 'set_model' ? 'selected' : ''}>set_model (api.py)</option>
                  <option value="none" ${(settings.gptSoVits?.modelSwitchMode || '') === 'none' ? 'selected' : ''}>none（不自动切换）</option>
                </select>
              </div>
              <div class="gal-settings-row">
                <span class="gal-settings-label">set_model 接口</span>
                <input type="text" id="gal-gpt-sovits-set-model-endpoint" class="gal-input" value="${escapeHtml(settings.gptSoVits?.setModelEndpoint || '/set_model')}" placeholder="/set_model">
              </div>
              <div class="gal-settings-row">
                <span class="gal-settings-label">严格切换 <small style="color: var(--gal-text-3, #999);">(失败不回退)</small></span>
                <label class="gal-switch"><input type="checkbox" id="gal-gpt-sovits-strict-switch" ${settings.gptSoVits?.strictWeightSwitch ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
              </div>
              <div class="gal-settings-row">
                <span class="gal-settings-label">模型管理</span>
                <button class="gal-action-btn" id="gal-gpt-sovits-open-model-manager" style="min-width: 180px; padding: 8px 14px;">
                  <i class="fa-solid fa-layer-group"></i> 打开管理面板
                </button>
              </div>
              <div style="margin-top: 10px;">
                <div style="font-size: 0.85rem; font-weight: 700; margin-bottom: 6px; color: var(--gal-text, ${THEME.dark});">音色列表（JSON）</div>
                <textarea id="gal-gpt-sovits-voices-json" class="gal-textarea" rows="6" placeholder='[{"name":"示例音色","refAudioPath":"wavs/xxx.wav","promptText":"示例参考文本","promptLang":"zh"}]'></textarea>
                <div style="display:flex; gap:10px; margin-top: 10px;">
                  <button class="gal-panel-btn secondary" id="gal-gpt-sovits-voices-save" style="flex: 1; padding: 10px;"><i class="fa-solid fa-floppy-disk"></i><span>保存音色列表</span></button>
                  <button class="gal-panel-btn" id="gal-gpt-sovits-test" style="flex: 1; padding: 10px;"><i class="fa-solid fa-play"></i><span>试听</span></button>
                </div>
                <input type="text" id="gal-gpt-sovits-test-text" class="gal-input" value="你好，这是一段 GPT-SoVITS 配音测试。" style="width: 100%; margin-top: 10px;" placeholder="试听文本">
              </div>
            </div>
          </div>
          </div><!-- /L2 tts -->

          <!-- L2 Pane: 通用（快捷键 + 刷新视图） -->
          <div data-l2-pane="general" style="${activeL2 === 'general' ? '' : 'display: none;'}">
          <div class="gal-settings-divider"></div>
          <div class="gal-settings-section">
            <div class="gal-settings-section-title"><i class="fa-solid fa-keyboard"></i> 快捷键</div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">空格键 -> 下一句</span>
              <label class="gal-switch"><input type="checkbox" id="gal-space-next" ${settings.spaceKeyNext ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">回车键 -> 下一句</span>
              <label class="gal-switch"><input type="checkbox" id="gal-enter-next" ${settings.enterKeyNext ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">Ctrl长按 -> 快进</span>
              <label class="gal-switch"><input type="checkbox" id="gal-ctrl-skip" ${settings.ctrlKeySkip ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">快进速度</span>
              <div class="gal-settings-control">
                <input type="range" id="gal-skip-speed" min="0.01" max="0.2" step="0.01" value="${escapeHtml(settings.skipSpeed)}">
                <span class="gal-range-value" id="gal-skip-speed-value">${settings.skipSpeed}s</span>
              </div>
            </div>
          </div>

          <div class="gal-settings-divider"></div>

          <!-- 刷新视图 -->
          <div style="margin-top: 16px;">
            <button class="gal-panel-btn secondary" id="gal-refresh-views" style="width: 100%;"><i class="fa-solid fa-sync"></i><span>刷新视图</span></button>
          </div>
          <!-- 配置向导 -->
          <div style="margin-top: 10px;">
            <button class="gal-panel-btn secondary" id="gal-setup-wizard-btn" style="width: 100%;"><i class="fa-solid fa-wand-magic-sparkles"></i><span>配置向导</span></button>
          </div>
          </div><!-- /L2 general (shortcuts) -->

          <!-- L2 Pane: 高级 -->
          <div data-l2-pane="advanced" style="${activeL2 === 'advanced' ? '' : 'display: none;'}">
          <div class="gal-settings-section">
            <div class="gal-settings-section-title"><i class="fa-solid fa-flask"></i> 高级</div>
            <div class="gal-settings-row">
              <span class="gal-settings-label" title="开启后，只有检测到Galgame标签才会显示界面；关闭则总是显示">智能判断主界面显示</span>
              <label class="gal-switch"><input type="checkbox" id="gal-smart-detection" ${settings.smartDetection ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <p class="gal-hint">开启后，只有检测到 Galgame 标签才会显示界面；关闭则总是显示。</p>
            <div class="gal-settings-row">
              <span class="gal-settings-label">全局Debug日志</span>
              <label class="gal-switch"><input type="checkbox" id="gal-global-debug" ${settings.globalDebug ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
          </div>
          </div><!-- /L2 advanced -->

          <!-- L2 Pane: 生成/COT（加强模式） -->
          <div data-l2-pane="cot" style="${activeL2 === 'cot' ? '' : 'display: none;'}">
          <div class="gal-settings-divider"></div>
          <div class="gal-settings-section">
            <div class="gal-settings-section-title"><i class="fa-solid fa-bolt"></i> 加强模式</div>
            <div class="gal-settings-row" style="margin-bottom: 12px;">
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <span class="gal-settings-label" style="font-weight: 600;">启用加强模式</span>
                <small class="gal-hint" style="margin: 0;">两次生成策略：内容创作 + COT格式化</small>
              </div>
              <label class="gal-switch"><input type="checkbox" id="gal-enhanced-mode" ${settings.enhancedMode?.enabled ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <div id="gal-enhanced-hint" style="${settings.enhancedMode?.enabled ? '' : 'display: none;'} padding: 12px; background: var(--gal-accent-soft, rgba(0,210,255,0.1)); border: 1px solid var(--gal-accent-border, rgba(0,210,255,0.35)); border-radius: 6px; margin-bottom: 16px; font-size: 0.8rem; color: var(--gal-text-2, #666); line-height: 1.5;">
              <i class="fa-solid fa-lightbulb" style="color: var(--gal-accent-strong, #00a8cc);"></i>
              第一次生成专注内容，第二次切换API进行COT格式化。
            </div>
            <div id="gal-enhanced-config" style="${settings.enhancedMode?.enabled ? '' : 'display: none;'} padding-left: 12px; border-left: 2px solid var(--gal-accent-border, rgba(0,210,255,0.35));">
              <div style="font-weight: 600; margin-bottom: 12px; color: var(--gal-accent-strong, #00a8cc); font-size: 0.9rem;">第二次生成配置</div>
              <div style="margin-bottom: 12px;">
                <label class="gal-check" style="margin-bottom: 6px;">
                  <input type="checkbox" id="gal-enhanced-use-profile" ${settings.enhancedMode?.secondGenerate?.useProfile ? 'checked' : ''}>
                  <span style="font-size: 0.9rem; font-weight: 600; color: var(--gal-text, #222);">连接配置</span>
                </label>
                <select id="gal-enhanced-profile-name" class="gal-select" style="width: calc(100% - 24px); margin-left: 24px;">${profileOptions}</select>
              </div>
              <div style="margin-bottom: 12px;">
                <label class="gal-check" style="margin-bottom: 6px;">
                  <input type="checkbox" id="gal-enhanced-use-model" ${settings.enhancedMode?.secondGenerate?.useModel ? 'checked' : ''}>
                  <span style="font-size: 0.9rem; font-weight: 600; color: var(--gal-text, #222);">模型</span>
                </label>
                <select id="gal-enhanced-model-name" class="gal-select" style="width: calc(100% - 24px); margin-left: 24px;">${modelOptions}</select>
              </div>
              <div style="margin-bottom: 12px;">
                <label class="gal-check" style="margin-bottom: 6px;">
                  <input type="checkbox" id="gal-enhanced-use-preset" ${settings.enhancedMode?.secondGenerate?.usePreset ? 'checked' : ''}>
                  <span style="font-size: 0.9rem; font-weight: 600; color: var(--gal-text, #222);">预设</span>
                </label>
                <select id="gal-enhanced-preset-name" class="gal-select" style="width: calc(100% - 24px); margin-left: 24px;">${presetOptions}</select>
              </div>
              <div style="margin-bottom: 10px;">
                <div style="font-size: 0.9rem; font-weight: 600; color: var(--gal-text, #222); margin-bottom: 8px;">世界书设置</div>
                <div style="margin-left: 24px;">
                  <label class="gal-check" style="margin-bottom: 8px; font-size: 0.85rem;">
                    <input type="radio" name="gal-enhanced-worldbook-mode" value="default" ${!settings.enhancedMode?.secondGenerate?.useWorldbooks && (!settings.enhancedMode?.secondGenerate?.worldbooks || settings.enhancedMode?.secondGenerate?.worldbooks.length === 0) ? 'checked' : ''}>
                    <span>不使用自定义世界书(默认选择)</span>
                  </label>
                  <label class="gal-check" style="margin-bottom: 8px; font-size: 0.85rem;">
                    <input type="radio" name="gal-enhanced-worldbook-mode" value="none" ${settings.enhancedMode?.secondGenerate?.useWorldbooks && (!settings.enhancedMode?.secondGenerate?.worldbooks || settings.enhancedMode?.secondGenerate?.worldbooks.length === 0) ? 'checked' : ''}>
                    <span>不使用任何世界书</span>
                  </label>
                  <label class="gal-check" style="margin-bottom: 8px; font-size: 0.85rem;">
                    <input type="radio" name="gal-enhanced-worldbook-mode" value="custom" ${settings.enhancedMode?.secondGenerate?.useWorldbooks && settings.enhancedMode?.secondGenerate?.worldbooks && settings.enhancedMode?.secondGenerate?.worldbooks.length > 0 ? 'checked' : ''}>
                    <span>使用以下世界书：</span>
                  </label>
                  <div id="gal-enhanced-worldbooks-list" style="margin-left: 24px; ${settings.enhancedMode?.secondGenerate?.useWorldbooks && settings.enhancedMode?.secondGenerate?.worldbooks && settings.enhancedMode?.secondGenerate?.worldbooks.length > 0 ? '' : 'display: none;'}">${worldbookListHtml}</div>
                </div>
              </div>
              <div style="margin-top: 16px; padding-top: 12px; border-top: 1px dashed var(--gal-accent-border, rgba(0,210,255,0.35));">
                <button id="gal-enhanced-view-prompts" class="gal-panel-btn secondary" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
                  <i class="fa-solid fa-eye"></i><span>查看提示词</span>
                </button>
              </div>
            </div>
          </div>
          </div><!-- /L2 cot (enhanced) -->

          </div><!-- /.gal-l2-body -->
        </div>

        <!-- L1 Pane: 资源管理 -->
        <div data-l1-pane="assets" style="padding: 24px; overflow-y: auto; flex: 1; ${topTab !== 'assets' ? 'display: none;' : ''}">
          ${assetsHtml}
        </div>

        <!-- L1 Pane: 关于 -->
        <div data-l1-pane="about" class="gal-about-pane" style="padding: 24px; overflow-y: auto; flex: 1; ${topTab !== 'about' ? 'display: none;' : ''}">
          ${buildAboutPane()}
        </div>
      </div>
    </div>

    <style>
      /* ═══ 扁平化组件体系（token 定义见 数据库界面插件.css :root） ═══ */
      .gal-toggle-on { background: var(--gal-accent, ${THEME.accent}); color: #04303a; box-shadow: var(--gal-shadow-sm, 0 1px 3px rgba(20,30,40,0.08)); }
      .gal-toggle-off { background: var(--gal-panel-bg-sub, #f6f8fa); color: var(--gal-text-2, #5c6470); border: 1px solid var(--gal-border, #e3e7eb) !important; }
      .gal-toggle-on:hover { background: var(--gal-accent-strong, #00a8cc); }
      .gal-toggle-off:hover { background: var(--gal-border, #e3e7eb); }
      .gal-settings-divider { border-top: 1px solid var(--gal-border, #e3e7eb); margin: 16px 0; }
      .gal-settings-section { margin-bottom: 8px; }
      .gal-settings-section-title { font-weight: 700; font-size: 0.95rem; color: var(--gal-text, ${THEME.dark}); margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
      .gal-settings-section-title i { color: ${THEME.accent}; }
      .gal-settings-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--gal-panel-bg-sub, #f6f8fa); }
      .gal-settings-row:last-child { border-bottom: none; }
      .gal-settings-label { font-size: 0.9rem; color: var(--gal-text, #2b2e38); }
      .gal-settings-control { display: flex; align-items: center; gap: 10px; }
      .gal-settings-control input[type="range"] { width: 120px; accent-color: ${THEME.accent}; }
      .gal-range-value { min-width: 45px; text-align: right; font-weight: 600; font-size: 0.85rem; color: var(--gal-accent-strong, #00a8cc); }
      .gal-hint { font-size: 0.75rem; color: var(--gal-text-3, #8a929c); margin: 2px 0 8px; line-height: 1.5; }
      .gal-switch { position: relative; display: inline-block; width: 48px; height: 26px; flex-shrink: 0; }
      .gal-switch input { opacity: 0; width: 0; height: 0; }
      .gal-switch-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccd2d9; transition: 0.3s; border-radius: 26px; }
      .gal-switch-slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: white; transition: 0.3s; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
      .gal-switch input:checked + .gal-switch-slider { background: var(--gal-accent, ${THEME.accent}); }
      .gal-switch input:checked + .gal-switch-slider:before { transform: translateX(22px); }
      .gal-panel-btn { padding: 12px 14px; background: var(--gal-accent, ${THEME.accent}); color: #04303a; border: none; border-radius: 6px; cursor: pointer; font-weight: 700; display: flex; flex-direction: column; align-items: center; gap: 6px; transition: background 0.2s; box-shadow: var(--gal-shadow-sm, 0 1px 3px rgba(20,30,40,0.08)); }
      .gal-panel-btn:hover { background: var(--gal-accent-strong, #00a8cc); }
      .gal-panel-btn.secondary { background: var(--gal-panel-bg, #fff); color: var(--gal-text, #2b2e38); border: 1px solid var(--gal-border, #e3e7eb); }
      .gal-panel-btn.secondary:hover { background: var(--gal-panel-bg-sub, #f6f8fa); border-color: var(--gal-accent, ${THEME.accent}); }
      .gal-panel-btn i { font-size: 1.1rem; }
      #gal-unified-panel .gal-select,
      #gal-unified-panel .gal-input,
      #gal-unified-panel .gal-textarea {
        padding: 6px 10px;
        border: 1px solid var(--gal-border, #e3e7eb);
        border-radius: 6px;
        font-size: 0.85rem;
        background: var(--gal-panel-bg, #fff);
        color: var(--gal-text, #2b2e38);
        box-sizing: border-box;
        max-width: 100%;
        min-width: 0;
      }
      #gal-unified-panel .gal-select { width: clamp(160px, 40%, 280px); }
      #gal-unified-panel .gal-input { flex: 1; }
      #gal-unified-panel .gal-textarea { width: 100%; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.8rem; resize: vertical; }
      #gal-unified-panel .gal-select:focus,
      #gal-unified-panel .gal-input:focus,
      #gal-unified-panel .gal-textarea:focus {
        outline: none;
        border-color: var(--gal-accent, ${THEME.accent});
        box-shadow: 0 0 0 3px var(--gal-accent-soft, rgba(0,210,255,0.1));
      }
      .gal-subcard { background: var(--gal-panel-bg-sub, #f6f8fa); border: 1px solid var(--gal-border, #e3e7eb); border-radius: 8px; padding: 12px; }
      .gal-check { display: flex; align-items: center; gap: 8px; cursor: pointer; }
      .gal-check input[type="checkbox"], .gal-check input[type="radio"] { cursor: pointer; width: 16px; height: 16px; accent-color: ${THEME.accent}; }
      .gal-title-settings-input,
      .gal-title-settings-select {
        width: min(100%, 460px);
        min-height: 36px;
        border-radius: 8px;
        border: 1px solid var(--gal-border, #e3e7eb);
        background: var(--gal-panel-bg, #fff);
        color: var(--gal-text, #2b2e38);
        padding: 7px 10px;
        box-sizing: border-box;
        outline: none;
      }
      .gal-title-settings-input::placeholder {
        color: var(--gal-text-3, #8a929c);
      }
      .gal-title-settings-input:focus,
      .gal-title-settings-select:focus {
        border-color: var(--gal-accent, ${THEME.accent});
        box-shadow: 0 0 0 3px var(--gal-accent-soft, rgba(0,210,255,0.1));
      }
      .gal-title-settings-input:disabled,
      .gal-title-settings-select:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .gal-voice-pool-select {
        padding: 8px 10px;
        border: 1px solid var(--gal-border, #e3e7eb);
        border-radius: 6px;
        font-size: 0.85rem;
        color: var(--gal-text, #2b2e38);
        background: var(--gal-panel-bg, #fff);
      }
      .gal-voice-pool-select:focus {
        outline: none;
        border-color: var(--gal-accent, ${THEME.accent});
        box-shadow: 0 0 0 2px var(--gal-accent-soft, rgba(0,210,255,0.1));
      }
      .gal-voice-chip-list { display: flex; flex-wrap: wrap; gap: 8px; min-height: 28px; }
      .gal-voice-chip-empty { font-size: 0.78rem; color: var(--gal-text-3, #8a929c); }
      .gal-voice-chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid var(--gal-border, #e3e7eb);
        background: var(--gal-panel-bg-sub, #f6f8fa);
        color: var(--gal-text, #2b2e38);
        font-size: 0.8rem;
        max-width: 100%;
      }
      .gal-voice-chip-name { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .gal-voice-chip-remove {
        border: none;
        border-radius: 999px;
        width: 18px;
        height: 18px;
        line-height: 18px;
        padding: 0;
        cursor: pointer;
        background: rgba(217, 58, 74, 0.12);
        color: var(--gal-danger, #d93a4a);
        font-weight: 700;
      }
      .gal-voice-chip-remove:focus {
        outline: none;
        box-shadow: 0 0 0 2px var(--gal-accent-soft, rgba(0,210,255,0.1));
      }

      /* L1 Tab Header */
      .gal-l1-tab-header { display:flex; align-items:center; background:var(--SmartThemeBotMesBlurTintColor, #1a1a2e); padding:0; border-bottom:2px solid ${THEME.accent}; }
      .gal-l1-tab-btn { padding:14px 28px; border:none; background:transparent; color:rgba(255,255,255,0.5); font-size:1rem; font-weight:700; cursor:pointer; border-bottom:3px solid transparent; display:flex; align-items:center; gap:8px; transition:all 0.2s; user-select:none; }
      .gal-l1-tab-btn:hover { color:rgba(255,255,255,0.85); }
      .gal-l1-tab-btn.active { color:${THEME.accent}; border-bottom-color:${THEME.accent}; }

      /* 基础设置 L1 pane：flex 纵向骨架（master-bar + L2 tab + 滚动主体） */
      #gal-unified-panel .gal-config-body[data-l1-pane="settings"] { display: flex; flex-direction: column; overflow: hidden; padding: 0; }

      /* 主开关常驻条 */
      .gal-master-bar { display: flex; align-items: center; gap: 12px; padding: 12px 24px; border-bottom: 1px solid var(--gal-border, #e3e7eb); background: var(--gal-panel-bg, #fff); flex-shrink: 0; }
      .gal-master-bar #gal-main-toggle { padding: 8px 22px; font-size: 0.95rem; font-weight: 700; border: none; border-radius: 999px; cursor: pointer; transition: background 0.2s; display: inline-flex; align-items: center; gap: 8px; }
      .gal-master-bar .gal-master-note { font-size: 0.75rem; color: var(--gal-text-3, #8a929c); }

      /* 文本显示实时预览（迷你对话框模型） */
      .gal-preview-wrap { margin-bottom: 4px; }
      .gal-preview-stage {
        position: relative;
        border-radius: 10px;
        padding: 34px 14px 14px;
        background:
          radial-gradient(ellipse at 70% 20%, rgba(255, 183, 213, 0.55) 0%, transparent 55%),
          linear-gradient(180deg, #a7c8ef 0%, #dcc8e8 55%, #f4d9e2 100%);
        overflow: hidden;
      }
      .gal-preview-panel {
        position: relative;
        border-radius: 8px;
        padding: 14px 16px 12px;
        background-color: rgba(255, 255, 255, calc(0.6 + var(--gal-preview-opacity, 0.5) * 0.38));
        box-shadow: 0 2px 10px rgba(20, 30, 40, 0.18);
      }
      .gal-preview-badge {
        position: absolute;
        top: -12px;
        left: 10px;
        background: var(--gal-dark, #2b2e38);
        color: #fff;
        padding: 3px 14px;
        font-size: calc(0.8rem * var(--gal-preview-font-scale, 1));
        font-weight: 800;
        transform: skewX(-12deg);
        box-shadow: 2px 2px 0 rgba(0, 210, 255, 0.5);
        font-family: var(--gal-preview-font-family, inherit);
      }
      .gal-preview-text {
        font-size: calc(0.95rem * var(--gal-preview-font-scale, 1));
        font-family: var(--gal-preview-font-family, inherit);
        line-height: var(--gal-preview-line-height, 1.7);
        color: #2b2e38;
        margin-top: 4px;
        padding-top: var(--gal-preview-pad-top, 0em);
        padding-bottom: var(--gal-preview-pad-bottom, 0em);
        transition: font-size 0.1s linear;
      }
      .gal-preview-text p { margin: 0; }
      .gal-preview-text p + p { margin-top: var(--gal-preview-paragraph-gap, 0.6em); }
      /* 文字特效映射（与 applyTextEffect 同款视觉） */
      .gal-preview-panel.pv-shadow .gal-preview-text { color: #fff; text-shadow: 0 0 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7), 0 2px 4px rgba(0,0,0,0.5); }
      .gal-preview-panel.pv-glow .gal-preview-text { color: #fff; text-shadow: 0 0 5px rgba(255,255,255,0.8), 0 0 10px rgba(255,255,255,0.6), 0 0 20px rgba(0,210,255,0.4); }
      .gal-preview-panel.pv-stroke .gal-preview-text { color: #fff; -webkit-text-stroke: 1.5px rgba(0,0,0,0.8); text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
      .gal-preview-panel.pv-glass { background-color: rgba(255, 255, 255, 0.35); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
      .gal-preview-panel.pv-glass .gal-preview-text { color: #333; }
      .gal-preview-panel.pv-gradient { background-color: transparent; background-image: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.72) 100%); box-shadow: none; }
      .gal-preview-panel.pv-gradient .gal-preview-text { color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.3); }
      .gal-preview-panel.pv-text-bg { background-color: transparent; box-shadow: none; }
      .gal-preview-panel.pv-text-bg .gal-preview-text { background-color: rgba(0,0,0,0.6); padding: 8px 12px; border-radius: 8px; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.3); display: inline-block; }

      /* L2 Tab（类名刻意区别于资源管理的 .gal-tab-btn，避免事件串扰） */
      .gal-l2-tab-header { display: flex; align-items: center; gap: 2px; padding: 0 24px; border-bottom: 1px solid var(--gal-border, #e3e7eb); background: var(--gal-panel-bg, #fff); overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; scrollbar-width: none; flex-shrink: 0; }
      .gal-l2-tab-header::-webkit-scrollbar { display: none; width: 0; height: 0; }
      .gal-l2-tab-btn { padding: 11px 16px; border: none; background: transparent; font-size: 0.9rem; font-weight: 600; color: var(--gal-text-2, #5c6470); cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -1px; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; user-select: none; flex-shrink: 0; }
      .gal-l2-tab-btn:hover { color: var(--gal-accent-strong, #00a8cc); }
      .gal-l2-tab-btn.active { color: var(--gal-accent-strong, #00a8cc); border-bottom-color: var(--gal-accent, ${THEME.accent}); }
      .gal-l2-body { flex: 1; overflow-y: auto; padding: 16px 24px 24px; }

      .gal-about-pane { display: flex; flex-direction: column; gap: 14px; }
      .gal-about-card { background: var(--gal-panel-bg-sub, #f6f8fa); border: 1px solid var(--gal-border, #e3e7eb); border-radius: 10px; padding: 16px; color: var(--gal-text, #2f3a4a); line-height: 1.7; }
      .gal-about-card h3 { margin: 0 0 8px 0; color: var(--gal-text, ${THEME.dark}); font-size: 1rem; display: flex; align-items: center; gap: 8px; }
      .gal-about-card h3 i { color: ${THEME.accent}; }
      .gal-about-card p { margin: 0 0 8px 0; }
      .gal-about-card p:last-child { margin-bottom: 0; }
      .gal-about-card a { color: #2563eb; text-decoration: underline; word-break: break-all; }
      .gal-about-warning { color: #b42318; font-weight: 700; }

      ${assetStyles}
    </style>
  `;

  $(getModalMountRoot()).append(panelHtml);
  const $panel = $('#gal-unified-panel');

  const renderVoicePoolChips = (containerSelector, poolKey) => {
    const $container = $(containerSelector);
    if (!$container.length) return;
    const normalizedList = normalizeVoiceNameList(settings[poolKey]);
    settings[poolKey] = normalizedList;
    if (normalizedList.length === 0) {
      $container.html('<span class="gal-voice-chip-empty">当前为空（从上方选择音色即可加入）。</span>');
      return;
    }

    const html = normalizedList
      .map(voiceName => `
        <span class="gal-voice-chip">
          <span class="gal-voice-chip-name" title="${escapeHtml(voiceName)}">${escapeHtml(voiceName)}</span>
          <button type="button" class="gal-voice-chip-remove" data-pool="${poolKey}" data-voice="${escapeHtml(voiceName)}">×</button>
        </span>
      `)
      .join('');
    $container.html(html);
  };

  const refreshTtsVoicePoolCandidates = voiceList => {
    const optionHtml = ['<option value="">选择后立即加入列表</option>']
      .concat(
        voiceList.map(v => {
          const name = String(v?.name || '').trim();
          if (!name) return '';
          const desc = String(v?.desc || '').trim();
          const label = desc ? `${name} (${desc})` : name;
          return `<option value="${escapeHtml(name)}">${escapeHtml(label)}</option>`;
        }).filter(Boolean),
      )
      .join('');

    const $maleCandidate = $('#gal-tts-default-male-candidate');
    const $femaleCandidate = $('#gal-tts-default-female-candidate');
    if ($maleCandidate.length) {
      $maleCandidate.html(optionHtml);
      $maleCandidate.val('');
    }
    if ($femaleCandidate.length) {
      $femaleCandidate.html(optionHtml);
      $femaleCandidate.val('');
    }

    renderVoicePoolChips('#gal-tts-default-male-list', 'ttsDefaultMaleVoices');
    renderVoicePoolChips('#gal-tts-default-female-list', 'ttsDefaultFemaleVoices');
  };

  // TTS 音色列表异步填充
  const refreshTtsVoiceOptions = async () => {
    const $sel = $('#gal-tts-default-speaker');
    const $hint = $('#gal-tts-default-speaker-hint');
    if (!$sel.length) return;
    let voiceList = [];
    try { voiceList = await getTTSVoiceListAsync(); } catch (e) { console.warn(`[${SCRIPT_NAME}] 获取TTS音色列表失败:`, e); }
    const current = settings.ttsDefaultSpeaker || '';
    $sel.empty().append('<option value="">（不指定）</option>');
    voiceList.forEach(v => {
      const name = String(v?.name || '').trim();
      if (!name) return;
      const desc = String(v?.desc || '').trim();
      const label = desc ? `${name} (${desc})` : name;
      $sel.append(`<option value="${escapeHtml(name)}">${escapeHtml(label)}</option>`);
    });
    $sel.val(current);
    refreshTtsVoicePoolCandidates(voiceList);

    const provider = getTTSProvider();
    const providerHint = provider === TTS_PROVIDER.GPT_SOVITS_V2
      ? 'GPT-SoVITS：建议把音色 name 设为角色名。'
      : 'LittleWhiteBox：未指定/未绑定时使用此默认音色。';
    if ($hint.length) $hint.text(providerHint + (voiceList.length === 0 ? '（当前音色列表为空）' : ''));
  };

  if ($('#gal-gpt-sovits-voices-json').length) {
    try { $('#gal-gpt-sovits-voices-json').val(JSON.stringify(settings.gptSoVits?.voices || [], null, 2)); } catch (e) { $('#gal-gpt-sovits-voices-json').val('[]'); }
  }
  refreshTtsVoiceOptions();

  // L1 tab 切换
  $panel.find('.gal-l1-tab-btn').on('click', function () {
    const tab = $(this).data('l1-tab');
    $panel.find('.gal-l1-tab-btn').removeClass('active');
    $(this).addClass('active');
    $panel.find('[data-l1-pane]').hide();
    $panel.find(`[data-l1-pane="${tab}"]`).show();
  });

  // L2 tab 切换（基础设置分类；同一分类可能拆分为多个 pane 块，全部一起显隐）
  $panel.find('.gal-l2-tab-btn').on('click', function () {
    const tab = String($(this).data('l2-tab') || 'general');
    lastSettingsL2Tab = tab;
    $panel.find('.gal-l2-tab-btn').removeClass('active');
    $(this).addClass('active');
    $panel.find('[data-l2-pane]').hide();
    $panel.find(`[data-l2-pane="${tab}"]`).show();
  });

  // 文本显示实时预览：把当前设置映射到预览框的 CSS 变量（与真实对话框同一套取值逻辑）
  const syncTextPreview = () => {
    const pvEl = $panel.find('#gal-text-preview-panel').get(0);
    if (!pvEl) return;
    const lineHeightTenths = Math.round(Number(settings.dialogLineHeight) || 0);
    const paragraphGap = Math.max(0, Math.min(30, Number(settings.dialogParagraphGap) || 0));
    pvEl.style.setProperty('--gal-preview-font-scale', String(getDialogFontScale(settings)));
    pvEl.style.setProperty('--gal-preview-font-family', getDialogFontStack(settings.dialogFontFamily));
    pvEl.style.setProperty('--gal-preview-line-height', lineHeightTenths >= 10 ? String(lineHeightTenths / 10) : '1.7');
    pvEl.style.setProperty('--gal-preview-paragraph-gap', `${paragraphGap / 10}em`);
    const pvPadTop = Math.max(0, Math.min(30, Math.round(Number(settings.dialogPadTop) || 0)));
    const pvPadBottom = Math.max(0, Math.min(30, Math.round(Number(settings.dialogPadBottom) || 0)));
    pvEl.style.setProperty('--gal-preview-pad-top', pvPadTop > 0 ? `${pvPadTop / 10}em` : '0em');
    pvEl.style.setProperty('--gal-preview-pad-bottom', pvPadBottom > 0 ? `${pvPadBottom / 10}em` : '0em');
    pvEl.style.setProperty('--gal-preview-opacity', String(settings.dialogOpacity));
    pvEl.className = pvEl.className.replace(/\bpv-[a-z-]+\b/g, '').trim();
    const effect = settings.textEffect || 'none';
    if (effect !== 'none') pvEl.classList.add(`pv-${effect}`);
  };
  syncTextPreview();

  // 关闭
  $('#gal-settings-close').on('click', () => {
    cleanupAssetManagerDocumentEvents();
    $panel.remove();
  });
  $panel.on('click', function (e) {
    if (e.target === this) {
      cleanupAssetManagerDocumentEvents();
      $panel.remove();
    }
  });

  // 主开关
  $('#gal-main-toggle').on('click', async function () {
    const newEnabled = !getIsEnabled();
    if (newEnabled) {
      $(this).removeClass('gal-toggle-off').addClass('gal-toggle-on').html('<i class="fa-solid fa-toggle-on" style="font-size: 1.3rem;"></i><span>Galgame 模式已开启</span>');
      await setGalgameMasterEnabled(true);
      showToast('Galgame 模式已开启');
    } else {
      $(this).removeClass('gal-toggle-on').addClass('gal-toggle-off').html('<i class="fa-solid fa-toggle-off" style="font-size: 1.3rem;"></i><span>Galgame 模式已关闭</span>');
      await setGalgameMasterEnabled(false);
      setTimeout(() => { const $lastMes = $('#chat > .mes').last(); if ($lastMes.length) $lastMes[0].scrollIntoView({ behavior: 'smooth', block: 'end' }); }, 150);
      showToast('Galgame 模式已关闭');
    }
  });

  // 滑块设置
  // 排版类滑块共用：先即时预览样式，停止拖动 300ms 后重新分页当前消息
  let fontRepaginateTimer = null;
  const scheduleRepaginate = () => {
    clearTimeout(fontRepaginateTimer);
    fontRepaginateTimer = setTimeout(() => {
      repaginateCurrentMessageForFontChange().catch(e => console.warn(`[${SCRIPT_NAME}] 排版重分页失败`, e));
    }, 300);
  };
  $('#gal-font-size').on('input', function () {
    settings.fontSize = parseInt($(this).val());
    $('#gal-font-size-value').text(settings.fontSize);
    applySettingsToUI();
    saveSettings();
    scheduleRepaginate();
  });
  $('#gal-seg-length').on('input', function () {
    settings.dialogSegLengthOverride = parseInt($(this).val()) || 0;
    $('#gal-seg-length-value').text(settings.dialogSegLengthOverride > 0 ? settings.dialogSegLengthOverride : '自动');
    saveSettings();
    scheduleRepaginate();
  });
  $('#gal-line-height').on('input', function () {
    settings.dialogLineHeight = parseInt($(this).val()) || 0;
    $('#gal-line-height-value').text(settings.dialogLineHeight >= 10 ? (settings.dialogLineHeight / 10).toFixed(1) : '默认');
    applySettingsToUI();
    saveSettings();
    scheduleRepaginate();
  });
  $('#gal-paragraph-gap').on('input', function () {
    settings.dialogParagraphGap = parseInt($(this).val()) || 0;
    $('#gal-paragraph-gap-value').text(`${(settings.dialogParagraphGap / 10).toFixed(1)}em`);
    applySettingsToUI();
    saveSettings();
    scheduleRepaginate();
  });
  $('#gal-pad-top').on('input', function () {
    settings.dialogPadTop = parseInt($(this).val()) || 0;
    $('#gal-pad-top-value').text(settings.dialogPadTop > 0 ? `${(settings.dialogPadTop / 10).toFixed(1)}em` : '默认');
    applySettingsToUI();
    saveSettings();
    scheduleRepaginate();
  });
  $('#gal-pad-bottom').on('input', function () {
    settings.dialogPadBottom = parseInt($(this).val()) || 0;
    $('#gal-pad-bottom-value').text(settings.dialogPadBottom > 0 ? `${(settings.dialogPadBottom / 10).toFixed(1)}em` : '默认');
    applySettingsToUI();
    saveSettings();
    scheduleRepaginate();
  });
  $('#gal-dialog-scale-percent').on('input', function () {
    settings.dialogScalePercent = normalizeUiScalePercent($(this).val());
    $('#gal-dialog-scale-percent-value').text(`${settings.dialogScalePercent}%`);
    applySettingsToUI();
    saveSettings();
  });
  $('#gal-toolbar-scale-percent').on('input', function () {
    settings.toolbarScalePercent = normalizeUiScalePercent($(this).val());
    $('#gal-toolbar-scale-percent-value').text(`${settings.toolbarScalePercent}%`);
    applySettingsToUI();
    saveSettings();
  });
  $('#gal-dialog-font-family').on('change', function () { settings.dialogFontFamily = $(this).val(); applySettingsToUI(); saveSettings(); });
  $('#gal-dialog-opacity').on('input', function () { const t = parseInt($(this).val()); settings.dialogOpacity = 1 - (t / 100); $('#gal-dialog-opacity-value').text(t + '%'); applySettingsToUI(); saveSettings(); });
  $('#gal-text-effect').on('change', function () { settings.textEffect = $(this).val(); applySettingsToUI(); saveSettings(); });
  $('#gal-typewriter-enabled').on('change', function () {
    settings.typewriterEnabled = $(this).is(':checked');
    if (!settings.typewriterEnabled && isTypewriterActive()) {
      finishActiveTypewriter();
    }
    saveSettings();
  });
  $('#gal-typewriter-speed').on('input', function () {
    const parsed = parseInt($(this).val(), 10);
    settings.typewriterSpeed = Number.isFinite(parsed) ? Math.max(5, Math.min(parsed, 60)) : 30;
    $('#gal-typewriter-speed-value').text(settings.typewriterSpeed + '字/秒');
    saveSettings();
  });
  $('#gal-typewriter-sound-enabled').on('change', function () {
    settings.typewriterSoundEnabled = $(this).is(':checked');
    saveSettings();
  });
  $('#gal-typewriter-sound-volume').on('input', function () {
    const parsed = parseInt($(this).val(), 10);
    settings.typewriterSoundVolume = Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 100)) : 35;
    $('#gal-typewriter-sound-volume-value').text(settings.typewriterSoundVolume + '%');
    saveSettings();
  });
  $('#gal-auto-speed').on('input', function () { settings.autoPlaySpeed = parseFloat($(this).val()); $('#gal-auto-speed-value').text(settings.autoPlaySpeed + '秒'); saveSettings(); });

  // 开关设置
  $('#gal-show-sprites').on('change', function () { settings.showSprites = $(this).is(':checked'); applySettingsToUI(); saveSettings(); });
  $('#gal-cg-as-background').on('change', function () {
    settings.cgAsBackground = $(this).is(':checked');
    saveSettings();
    showToast(settings.cgAsBackground ? 'CG将直接替换背景显示' : 'CG恢复为对话框缩略图显示');
  });
  $('#gal-simple-storybook-mode').on('change', function () {
    const enabled = $(this).is(':checked');
    applySimpleStorybookMode(enabled)
      .then(() => showToast(enabled ? '简化图书绘本模式已开启，COT已更新' : '简化图书绘本模式已关闭，COT已更新'))
      .catch(() => showToast(enabled ? '简化图书绘本模式已开启' : '简化图书绘本模式已关闭'));
  });
  $('#gal-hide-floors').on('change', function () {
    settings.hideOtherFloors = $(this).is(':checked');
    setHideOtherFloors(settings.hideOtherFloors);
    if (getIsEnabled()) { if (settings.hideOtherFloors) hideNonLastFloors(); else showAllFloors(); }
    saveSettings();
  });
  $('#gal-bg-fill-mode').on('change', function () { settings.bgFillMode = normalizeBgFillMode($(this).val()); applyBgFillMode(); saveSettings(); });
  $('#gal-skin-select').on('change', function () { settings.skin = normalizeSkinValue($(this).val()); applySkin(); applySettingsToUI(); saveSettings(); });
  const getTitleSettingsState = () => {
    const normalized = ensureTitleScreenSettings();
    settings.titleScreen = normalized;
    return normalized;
  };
  const normalizeTitleSourceChoice = (ts) => {
    const source = String(ts?.backgroundSource || '').trim().toLowerCase();
    if (source === 'url' || source === 'upload') return source;
    return String(ts?.backgroundUrl || '').trim() ? 'url' : 'upload';
  };
  const getTitleSceneName = () => {
    const ts = getTitleSettingsState();
    return String(ts.backgroundSceneName || '__title__').trim() || '__title__';
  };
  const syncTitleSourceInputs = () => {
    const ts = getTitleSettingsState();
    const source = normalizeTitleSourceChoice(ts);
    if (String(ts.backgroundSource || '').trim().toLowerCase() !== source) {
      ts.backgroundSource = source;
      saveSettings();
    }
    $('#gal-title-bg-source').val(source);
    const useUrl = source === 'url';
    const useUpload = source === 'upload';
    $('#gal-title-bg-upload-row').css('display', useUpload ? 'flex' : 'none');
    $('#gal-title-bg-url-row').css('display', useUrl ? 'flex' : 'none');
    $('#gal-title-bg-url').prop('disabled', !useUrl);
    $('#gal-title-bg-upload-btn')
      .prop('disabled', !useUpload)
      .css('opacity', useUpload ? 1 : 0.6)
      .css('pointer-events', useUpload ? 'auto' : 'none');
    $('#gal-title-bg-file').prop('disabled', !useUpload);
  };
  $('#gal-title-enabled').on('change', function () {
    const ts = getTitleSettingsState();
    const enabled = $(this).is(':checked');
    ts.enabled = enabled;
    if (enabled) {
      setIsEnabled(true);
      setCurrentCharEnabled(true);
      updateButtonState();
    }
    saveSettings();
  });
  $('#gal-title-text').on('input change', function () {
    const ts = getTitleSettingsState();
    ts.titleText = String($(this).val() || '').trim();
    saveSettings();
  });
  $('#gal-title-font-family').on('input change', function () {
    const ts = getTitleSettingsState();
    ts.titleFontFamily = String($(this).val() || '').trim();
    saveSettings();
  });
  $('#gal-title-font-size').on('input change', function () {
    const ts = getTitleSettingsState();
    const nextValue = Number.parseInt($(this).val(), 10);
    ts.titleFontSize = Number.isFinite(nextValue) ? nextValue : '';
    saveSettings();
  });
  $('#gal-title-subtitle').on('input change', function () {
    const ts = getTitleSettingsState();
    ts.subtitleText = String($(this).val() || '').trim();
    saveSettings();
  });
  $('#gal-title-subtitle-font-family').on('input change', function () {
    const ts = getTitleSettingsState();
    ts.subtitleFontFamily = String($(this).val() || '').trim();
    saveSettings();
  });
  $('#gal-title-subtitle-font-size').on('input change', function () {
    const ts = getTitleSettingsState();
    const nextValue = Number.parseInt($(this).val(), 10);
    ts.subtitleFontSize = Number.isFinite(nextValue) ? nextValue : '';
    saveSettings();
  });
  $('#gal-title-bg-source').on('change', function () {
    const ts = getTitleSettingsState();
    const nextSource = String($(this).val() || 'upload').trim().toLowerCase() === 'url' ? 'url' : 'upload';
    ts.backgroundSource = nextSource;
    saveSettings();
    syncTitleSourceInputs();
  });
  $('#gal-title-bg-fit').on('change', function () {
    const ts = getTitleSettingsState();
    ts.backgroundFit = String($(this).val() || 'cover').trim();
    saveSettings();
  });
  $('#gal-title-mask-enabled').on('change', function () {
    const ts = getTitleSettingsState();
    ts.enableBackdropMask = $(this).is(':checked');
    saveSettings();
  });
  $('#gal-title-bg-url').on('input change', function () {
    const ts = getTitleSettingsState();
    const nextUrl = String($(this).val() || '').trim();
    ts.backgroundUrl = nextUrl;
    saveSettings();
  });
  $('#gal-title-bg-upload-btn').on('click', function () {
    if ($(this).prop('disabled')) return;
    $('#gal-title-bg-file').trigger('click');
  });
  $('#gal-title-bg-file').on('change', async function () {
    const file = this.files && this.files[0] ? this.files[0] : null;
    if (!file) return;
    const sceneName = getTitleSceneName();
    const $hint = $('#gal-title-bg-upload-hint');
    try {
      await saveBackground(sceneName, file);
      const ts = getTitleSettingsState();
      ts.backgroundSource = 'upload';
      $hint.text(`已保存：${sceneName}（${file.name}）`);
      showToast('标题背景上传成功');
      saveSettings();
      syncTitleSourceInputs();
    } catch (error) {
      console.error(`[${SCRIPT_NAME}] 标题背景上传失败:`, error);
      showToast('标题背景上传失败');
    } finally {
      this.value = '';
    }
  });
  syncTitleSourceInputs();
  $('#gal-effects-enabled').on('change', function () {
    settings.effectsEnabled = $(this).is(':checked');
    if (!settings.effectsEnabled) {
      clearAllPixiEffects();
    }
    syncPixiEffectsSettings();
    saveSettings();
    injectCOTToWorldbook().catch(() => {});
  });
  $('#gal-effects-quality').on('change', function () {
    const nextQuality = String($(this).val() || '').trim();
    settings.effectsQuality = ['mobile', 'balanced', 'high'].includes(nextQuality) ? nextQuality : 'balanced';
    syncPixiEffectsSettings();
    saveSettings();
  });
  $('#gal-effects-autoclear').on('change', function () {
    settings.effectsAutoClearOnSceneChange = $(this).is(':checked');
    saveSettings();
  });
  $('#gal-effects-max-active').on('input change', function () {
    const parsed = parseInt($(this).val(), 10);
    settings.effectsMaxActive = Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 6)) : 2;
    $('#gal-effects-max-active-value').text(settings.effectsMaxActive);
    syncPixiEffectsSettings();
    saveSettings();
  });
  $('#gal-space-next').on('change', function () { settings.spaceKeyNext = $(this).is(':checked'); saveSettings(); });
  $('#gal-enter-next').on('change', function () { settings.enterKeyNext = $(this).is(':checked'); saveSettings(); });
  $('#gal-ctrl-skip').on('change', function () { settings.ctrlKeySkip = $(this).is(':checked'); saveSettings(); });

  // 加强模式
  $('#gal-enhanced-mode').on('change', function () {
    const enabled = $(this).is(':checked');
    const enhancedConfig = ensureEnhancedModeSettings();
    enhancedConfig.enabled = enabled;
    saveSettings();
    $('#gal-enhanced-hint, #gal-enhanced-config').toggle(enabled);
    showToast(enabled ? '已启用加强模式' : '已禁用加强模式');
  });
  $('#gal-enhanced-use-profile').on('change', function () { const enhancedConfig = ensureEnhancedModeSettings(); enhancedConfig.secondGenerate.useProfile = $(this).is(':checked'); saveSettings(); });
  $('#gal-enhanced-profile-name').on('change', function () { const enhancedConfig = ensureEnhancedModeSettings(); enhancedConfig.secondGenerate.profileName = String($(this).val() || '').trim(); saveSettings(); });
  $('#gal-enhanced-use-model').on('change', function () { const enhancedConfig = ensureEnhancedModeSettings(); enhancedConfig.secondGenerate.useModel = $(this).is(':checked'); saveSettings(); });
  $('#gal-enhanced-model-name').on('change', function () { const enhancedConfig = ensureEnhancedModeSettings(); enhancedConfig.secondGenerate.modelName = String($(this).val() || '').trim(); saveSettings(); });
  $('#gal-enhanced-use-preset').on('change', function () { const enhancedConfig = ensureEnhancedModeSettings(); enhancedConfig.secondGenerate.usePreset = $(this).is(':checked'); saveSettings(); });
  $('#gal-enhanced-preset-name').on('change', function () { const enhancedConfig = ensureEnhancedModeSettings(); enhancedConfig.secondGenerate.presetName = String($(this).val() || '').trim(); saveSettings(); });

  $('input[name="gal-enhanced-worldbook-mode"]').on('change', function () {
    const mode = $(this).val();
    const enhancedConfig = ensureEnhancedModeSettings();
    if (mode === 'default') { enhancedConfig.secondGenerate.useWorldbooks = false; enhancedConfig.secondGenerate.worldbooks = []; $('#gal-enhanced-worldbooks-list').hide(); $('.gal-enhanced-worldbook-item').prop('checked', false); }
    else if (mode === 'none') { enhancedConfig.secondGenerate.useWorldbooks = true; enhancedConfig.secondGenerate.worldbooks = []; $('#gal-enhanced-worldbooks-list').hide(); $('.gal-enhanced-worldbook-item').prop('checked', false); }
    else if (mode === 'custom') { enhancedConfig.secondGenerate.useWorldbooks = true; $('#gal-enhanced-worldbooks-list').show(); }
    saveSettings();
  });

  $(document).on('change', '.gal-enhanced-worldbook-item', function () {
    const selected = [];
    $('.gal-enhanced-worldbook-item:checked').each(function () { selected.push($(this).val()); });
    const enhancedConfig = ensureEnhancedModeSettings();
    enhancedConfig.secondGenerate.worldbooks = Array.from(new Set(selected.map(name => String(name || '').trim()).filter(Boolean)));
    if (selected.length === 0) { $('input[name="gal-enhanced-worldbook-mode"][value="none"]').prop('checked', true); $('#gal-enhanced-worldbooks-list').hide(); }
    saveSettings();
  });

  // 查看提示词
  $('#gal-enhanced-view-prompts').on('click', function () {
    const prompts = enhancedModeState.lastPrompts;
    if (!prompts) { showToast('暂无提示词记录'); return; }
    const esc = str => (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const html = `<div id="gal-prompts-modal" class="gal-z-modal" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;">
      <div style="background:var(--gal-panel-bg,#fff);border-radius:12px;max-width:800px;width:100%;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
        <div style="padding:16px 20px;border-bottom:2px solid var(--gal-accent,#00d2ff);display:flex;justify-content:space-between;align-items:center;background:var(--gal-dark,#2b2e38);color:#fff;border-radius:12px 12px 0 0;">
          <div style="font-weight:700;font-size:1.1rem;"><i class="fa-solid fa-eye" style="color:var(--gal-accent,#00d2ff);"></i> 加强模式提示词</div>
          <button id="gal-prompts-modal-close" style="background:rgba(255,255,255,0.15);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:1rem;"><i class="fa-solid fa-times"></i></button>
        </div>
        <div style="padding:20px;overflow-y:auto;flex:1;">
          <div style="margin-bottom:8px;color:var(--gal-text-3,#888);font-size:0.85rem;"><i class="fa-solid fa-clock"></i> ${prompts.timestamp}</div>
          <div style="margin-bottom:20px;"><div style="font-weight:600;margin-bottom:8px;color:var(--gal-accent-strong,#00a8cc);">System Prompt</div><pre style="background:var(--gal-panel-bg-sub,#f6f8fa);border:1px solid var(--gal-border,#e3e7eb);border-left:3px solid var(--gal-accent,#00d2ff);border-radius:6px;padding:12px;font-size:0.85rem;white-space:pre-wrap;word-break:break-word;max-height:150px;overflow-y:auto;margin:0;color:var(--gal-text,#333);">${esc(prompts.systemPrompt)}</pre></div>
          <div style="margin-bottom:20px;"><div style="font-weight:600;margin-bottom:8px;color:var(--gal-accent-strong,#00a8cc);">First Result</div><pre style="background:var(--gal-panel-bg-sub,#f6f8fa);border:1px solid var(--gal-border,#e3e7eb);border-left:3px solid var(--gal-accent,#00d2ff);border-radius:6px;padding:12px;font-size:0.85rem;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow-y:auto;margin:0;color:var(--gal-text,#333);">${esc(prompts.firstResult)}</pre></div>
          <div><div style="font-weight:600;margin-bottom:8px;color:var(--gal-accent-strong,#00a8cc);">User Prompt</div><pre style="background:var(--gal-panel-bg-sub,#f6f8fa);border:1px solid var(--gal-border,#e3e7eb);border-left:3px solid var(--gal-accent,#00d2ff);border-radius:6px;padding:12px;font-size:0.85rem;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow-y:auto;margin:0;color:var(--gal-text,#333);">${esc(prompts.userPrompt)}</pre></div>
        </div>
        <div style="padding:12px 20px;border-top:1px solid var(--gal-border,#e3e7eb);text-align:right;">
          <button id="gal-prompts-modal-copy" style="background:var(--gal-panel-bg,#fff);color:var(--gal-text,#2b2e38);border:1px solid var(--gal-border,#e3e7eb);padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;margin-right:8px;"><i class="fa-solid fa-copy"></i> 复制全部</button>
          <button id="gal-prompts-modal-ok" style="background:var(--gal-accent,#00d2ff);color:#04303a;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;font-weight:700;"><i class="fa-solid fa-check"></i> 确定</button>
        </div>
      </div>
    </div>`;
    const mountRoot = getModalMountRoot();
    $(mountRoot).append(html);
    const $m = $(mountRoot).find('#gal-prompts-modal');
    $m.find('#gal-prompts-modal-close, #gal-prompts-modal-ok').on('click', () => $m.remove());
    $m.on('click', e => { if (e.target === $m[0]) $m.remove(); });
    $m.find('#gal-prompts-modal-copy').on('click', () => {
      navigator.clipboard.writeText(`=== 加强模式提示词 (${prompts.timestamp}) ===\n\n【System Prompt】\n${prompts.systemPrompt}\n\n【第一次生成结果】\n${prompts.firstResult}\n\n【User Prompt】\n${prompts.userPrompt}`)
        .then(() => showToast('已复制到剪贴板')).catch(() => showToast('复制失败'));
    });
  });

  // 其他设置
  $('#gal-skip-speed').on('input', function () { settings.skipSpeed = parseFloat($(this).val()); $('#gal-skip-speed-value').text(settings.skipSpeed + 's'); saveSettings(); });
  $('#gal-smart-detection').on('change', function () { settings.smartDetection = $(this).is(':checked'); saveSettings(); if (getIsEnabled()) applyGalgameMode(); });
  $('#gal-global-debug').on('change', function () {
    settings.globalDebug = $(this).is(':checked');
    setGlobalDebugEnabled(settings.globalDebug);
    const manager = getLive2DManagerRef();
    if (manager) {
      manager.debug = !!settings.globalDebug;
    }
    saveSettings();
    showToast(settings.globalDebug ? '全局 Debug 日志已开启' : '全局 Debug 日志已关闭，仅显示错误日志');
  });

  // 立绘设置
  $('#gal-sprite-scale').on('input', function () { settings.spriteScale = parseInt($(this).val()); $('#gal-sprite-scale-value').text(settings.spriteScale + '%'); applySettingsToUI(); saveSettings(); });
  $('#gal-sprite-bottom').on('input', function () { settings.spriteBottomOffset = parseInt($(this).val()); $('#gal-sprite-bottom-value').text(settings.spriteBottomOffset + '%'); applySettingsToUI(); saveSettings(); });
  $('#gal-sprite-spacing').on('input', function () { settings.spriteSpacing = parseInt($(this).val()); $('#gal-sprite-spacing-value').text(settings.spriteSpacing + '%'); applySettingsToUI(); saveSettings(); });
  $('#gal-show-missing-sprite-placeholder').on('change', function () { settings.showMissingSpritePlaceholder = $(this).is(':checked'); applySettingsToUI(); saveSettings(); });
  $('#gal-speaker-glow').on('change', function () { settings.speakerGlow = $(this).is(':checked'); applySettingsToUI(); saveSettings(); });
  $('#gal-speaker-focus').on('change', function () { settings.speakerFocus = $(this).is(':checked'); applySettingsToUI(); saveSettings(); });
  $('#gal-speaker-focus-blur').on('input', function () { settings.speakerFocusBlur = parseFloat($(this).val()); $('#gal-speaker-focus-blur-value').text(settings.speakerFocusBlur + 'px'); applySettingsToUI(); saveSettings(); });
  $('#gal-speaker-bubble').on('change', function () { settings.speakerBubble = $(this).is(':checked'); applySettingsToUI(); saveSettings(); });

  // TTS
  $('#gal-tts-enabled').on('change', function () {
    const enabled = $(this).is(':checked');
    setTTSEnabled(enabled);
    const $charLayer = $('.gal-layer-character');
    if (enabled) $charLayer.addClass('tts-mode-enabled'); else $charLayer.removeClass('tts-mode-enabled');
    injectCOTToWorldbook().then(() => showToast(enabled ? 'TTS已启用，COT已更新' : 'TTS已关闭，COT已更新'));
  });
  $('#gal-tts-provider').on('change', async function () {
    settings.ttsProvider = $(this).val();
    saveSettings();
    $('#gal-gpt-sovits-config').toggle(settings.ttsProvider === TTS_PROVIDER.GPT_SOVITS_V2);
    try { TTSManager._refreshProviderState(); } catch (e) {}
    await refreshTtsVoiceOptions();
    injectCOTToWorldbook().then(() => showToast('TTS引擎已切换，COT已更新')).catch(() => showToast('TTS引擎已切换'));
  });
  $('#gal-tts-autoplay').on('change', function () { settings.ttsAutoPlay = $(this).is(':checked'); saveSettings(); });
  $('#gal-tts-bilingual-zh-ja-enabled').on('change', function () {
    settings.ttsBilingualZhJaEnabled = $(this).is(':checked');
    saveSettings();
    injectCOTToWorldbook()
      .then(() => showToast(settings.ttsBilingualZhJaEnabled ? '中日双语模式已开启，COT已更新' : '中日双语模式已关闭，COT已更新'))
      .catch(() => showToast(settings.ttsBilingualZhJaEnabled ? '中日双语模式已开启' : '中日双语模式已关闭'));
  });
  $('#gal-situational-style-enabled').on('change', function () {
    settings.situationalStyleEnabled = $(this).is(':checked');
    saveSettings();
    injectCOTToWorldbook()
      .then(() => showToast(settings.situationalStyleEnabled ? '情境样式已开启，COT已更新' : '情境样式已关闭，COT已更新'))
      .catch(() => showToast(settings.situationalStyleEnabled ? '情境样式已开启' : '情境样式已关闭'));
  });
  $('#gal-bgm-cot-enabled').on('change', function () {
    settings.bgmEnabled = $(this).is(':checked');
    saveSettings();
    if (settings.bgmEnabled) {
      renderBGMWidget();
    } else {
      BGMManager.stopForDisabled();
      removeBGMWidget();
    }
    injectCOTToWorldbook()
      .then(() => showToast(settings.bgmEnabled ? 'BGM已启用，COT已更新' : 'BGM已关闭，COT已更新'))
      .catch(() => showToast(settings.bgmEnabled ? 'BGM已启用' : 'BGM已关闭'));
  });
  $('#gal-auto-sprite-assign-enabled').on('change', function () {
    settings.autoSpriteAssignEnabled = $(this).is(':checked');
    saveSettings();
    injectCOTToWorldbook()
      .then(() => showToast(settings.autoSpriteAssignEnabled ? 'AI自动套用立绘已开启，COT已更新' : 'AI自动套用立绘已关闭，COT已更新'))
      .catch(() => showToast(settings.autoSpriteAssignEnabled ? 'AI自动套用立绘已开启' : 'AI自动套用立绘已关闭'));
  });
  $('#gal-tts-default-speaker').on('change', function () { settings.ttsDefaultSpeaker = $(this).val(); saveSettings(); });

  const addVoiceToGenderPool = (poolKey, candidateSelector) => {
    const $candidate = $(candidateSelector);
    if (!$candidate.length) return;
    const selectedVoice = String($candidate.val() || '').trim();
    if (!selectedVoice) return;
    const nextList = normalizeVoiceNameList([...(settings[poolKey] || []), selectedVoice]);
    if (nextList.length === (settings[poolKey] || []).length) {
      showToast('该音色已在列表中');
      return;
    }
    settings[poolKey] = nextList;
    saveSettings();
    renderVoicePoolChips(poolKey === 'ttsDefaultMaleVoices' ? '#gal-tts-default-male-list' : '#gal-tts-default-female-list', poolKey);
    $candidate.val('');
  };

  $('#gal-tts-default-male-candidate').on('change', () => addVoiceToGenderPool('ttsDefaultMaleVoices', '#gal-tts-default-male-candidate'));
  $('#gal-tts-default-female-candidate').on('change', () => addVoiceToGenderPool('ttsDefaultFemaleVoices', '#gal-tts-default-female-candidate'));

  $panel.on('click', '.gal-voice-chip-remove', function () {
    const poolKey = String($(this).data('pool') || '').trim();
    const voiceName = String($(this).data('voice') || '').trim();
    if (!poolKey || !voiceName || !Array.isArray(settings[poolKey])) return;
    settings[poolKey] = normalizeVoiceNameList(settings[poolKey].filter(item => String(item || '').trim() !== voiceName));
    saveSettings();
    renderVoicePoolChips(poolKey === 'ttsDefaultMaleVoices' ? '#gal-tts-default-male-list' : '#gal-tts-default-female-list', poolKey);
  });

  // GPT-SoVITS
  $('#gal-gpt-sovits-url').on('change', function () { settings.gptSoVits = settings.gptSoVits || {}; settings.gptSoVits.apiUrl = $(this).val().trim(); saveSettings(); });
  $('#gal-gpt-sovits-proxy').on('change', function () { settings.gptSoVits = settings.gptSoVits || {}; settings.gptSoVits.useCorsProxy = $(this).is(':checked'); saveSettings(); });
  $('#gal-gpt-sovits-switch-mode').on('change', function () { settings.gptSoVits = settings.gptSoVits || {}; settings.gptSoVits.modelSwitchMode = $(this).val(); saveSettings(); });
  $('#gal-gpt-sovits-set-model-endpoint').on('change', function () {
    settings.gptSoVits = settings.gptSoVits || {};
    const endpoint = String($(this).val() || '').trim();
    settings.gptSoVits.setModelEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint || 'set_model'}`;
    saveSettings();
  });
  $('#gal-gpt-sovits-strict-switch').on('change', function () { settings.gptSoVits = settings.gptSoVits || {}; settings.gptSoVits.strictWeightSwitch = $(this).is(':checked'); saveSettings(); });
  $('#gal-gpt-sovits-open-model-manager').on('click', function () {
    openGptSoVitsModelManager({
      onChanged: async () => {
        await refreshTtsVoiceOptions();
        if ($('#gal-gpt-sovits-voices-json').length) {
          try { $('#gal-gpt-sovits-voices-json').val(JSON.stringify(getSettings().gptSoVits?.voices || [], null, 2)); } catch (e) {}
        }
        injectCOTToWorldbook().catch(() => {});
      },
    });
  });
  $('#gal-gpt-sovits-voices-save').on('click', async function () {
    settings.gptSoVits = settings.gptSoVits || {};
    let parsed = null;
    try { parsed = JSON.parse($('#gal-gpt-sovits-voices-json').val() || '[]'); } catch (e) { showToast('音色列表 JSON 解析失败'); return; }
    if (!Array.isArray(parsed)) { showToast('音色列表必须是数组'); return; }

    const normalized = normalizeGptSoVitsVoicesForStore(parsed);
    settings.gptSoVits.voices = normalized.voices;

    const firstUsable = pickFirstUsableGptSoVitsVoice(getGptSoVitsVoiceList());
    if (!settings.ttsDefaultSpeaker && firstUsable?.name) {
      settings.ttsDefaultSpeaker = firstUsable.name;
    }
    saveSettings();
    await refreshTtsVoiceOptions();

    let msg = `GPT-SoVITS 音色列表已保存：${normalized.voices.length} 条`;
    if (normalized.ignoredCount > 0) msg += `（忽略无效条目 ${normalized.ignoredCount} 条）`;
    if (normalized.missingRefCount > 0) msg += `（${normalized.missingRefCount} 条缺 refAudioPath）`;
    injectCOTToWorldbook().then(() => showToast(`${msg}，COT已更新`)).catch(() => showToast(msg));
  });
  $('#gal-gpt-sovits-test').on('click', () => {
    if (getTTSProvider() !== TTS_PROVIDER.GPT_SOVITS_V2) { showToast('请先切换为 GPT-SoVITS'); return; }
    const text = ($('#gal-gpt-sovits-test-text').val() || '').trim() || '你好，这是一段 GPT-SoVITS 配音测试。';
    const selectedVoiceName = String($('#gal-tts-default-speaker').val() || '').trim();
    const gptVoices = getGptSoVitsVoiceList();
    const selectedVoice = gptVoices.find(v => v.name === selectedVoiceName) || null;
    const selectedUsable = !!String(selectedVoice?.gptSoVits?.refAudioPath || '').trim();
    const fallbackVoice = pickFirstUsableGptSoVitsVoice(gptVoices);
    const targetVoice = selectedUsable ? selectedVoice : fallbackVoice;
    const voiceName = targetVoice?.name || '';
    if (!voiceName) { showToast('请先配置至少一个可用音色（refAudioPath 不能为空）'); return; }

    if (selectedVoiceName !== voiceName) {
      settings.ttsDefaultSpeaker = voiceName;
      saveSettings();
      $('#gal-tts-default-speaker').val(voiceName);
      showToast(`已自动切换试听音色：${voiceName}`);
    }

    TTSManager.stop();
    TTSManager.speak({ type: 'dialogue', speaker: '', text, tts: { speaker: voiceName } }, `gpt_sovits_test_${Date.now()}`);
  });

  // 刷新视图
  $('#gal-refresh-views').on('click', () => { if (getIsEnabled()) { applyGalgameMode(); if (settings.hideOtherFloors) setTimeout(hideNonLastFloors, 80); showToast('视图已刷新'); } else { showToast('请先开启 Galgame 模式'); } });

  // 配置向导（关闭设置面板后打开，避免两层弹窗叠加）
  $('#gal-setup-wizard-btn').on('click', () => {
    cleanupAssetManagerDocumentEvents();
    $panel.remove();
    showSetupWizard({ trigger: 'manual' });
  });

  // 文本显示实时预览联动（放在所有设置 handler 之后绑定，保证读到的是更新后的值）
  $panel.find('#gal-font-size, #gal-line-height, #gal-paragraph-gap, #gal-pad-top, #gal-pad-bottom, #gal-dialog-opacity').on('input', syncTextPreview);
  $panel.find('#gal-dialog-font-family, #gal-text-effect').on('change', syncTextPreview);

  // 绑定资源管理事件
  if (_bindAssetsPaneRef) {
    _bindAssetsPaneRef($panel, subTab);
  }
}

