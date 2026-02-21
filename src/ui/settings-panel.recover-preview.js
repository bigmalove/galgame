import {
  TTS_PROVIDER,
  buildGptSoVitsModelId,
  buildRuntimeVoiceFromGptSoVitsModel,
  getGptSoVitsConfig,
  getTTSEnabled,
  getTTSProvider,
  getTTSVoiceListAsync,
  inferGptSoVitsModelsFromFolderFiles,
  inferGptSoVitsModelsFromRootDir,
  mergeAutoImportedGptSoVitsModels,
  normalizeGptSoVitsModelForStore,
  normalizeGptSoVitsModelsForStore,
  normalizeGptSoVitsSwitchMode,
  normalizeSetModelEndpoint,
  setTTSEnabled,
} from '../audio/tts-config.js';
import { TTSManager } from '../audio/tts-manager.js';
import { SCRIPT_NAME, THEME } from '../core/constants.js';
import { setGlobalDebugEnabled } from '../core/debug.js';
import { $, topWindow } from '../core/env.js';
import { ensureEnhancedModeSettings, getSettings, saveSettings, setCurrentCharEnabled } from '../core/settings.js';
import { getIsEnabled, setHideOtherFloors, setIsEnabled } from '../core/state.js';
import { GalgameStore } from '../core/store.js';
import { clearAllPixiEffects, syncPixiEffectsSettings } from '../effects/pixi-effect-manager.js';
import { getAvailableModels, getAvailablePresets, getAvailableProfiles, getAvailableWorldbooks } from '../logic/enhanced-mode.js';
import { disableWorldbookGlobally, injectCOTToWorldbook } from '../logic/worldbook.js';
import { getAllExpressions } from '../utils/expressions.js';
import { getModalMountRoot } from './fullscreen.js';
import { applyGalgameMode, hideNonLastFloors, restoreOriginalViews, showAllFloors } from './galgame-mode.js';
import { updateButtonState } from './menu-button.js';
import { applyWesternSkinRuntime, clearWesternSkinRuntime } from './skin-western-runtime.js';
import { openGptSoVitsModelManager } from './gpt-sovits-model-manager.js';
import { showToast } from './toast.js';

// ============================================
// ͳһ������� + UI Ӧ�ú���
// ============================================

const enhancedModeState = GalgameStore.enhancedMode;

function getLive2DManagerRef() {
  return topWindow?.galgame?.Live2DManager || topWindow?.Live2DManager || null;
}

// �ӳ�����
let _buildAssetsPaneRef = null;
let _bindAssetsPaneRef = null;
let _assetStylesRef = null;
let _gptSoVitsRootAutoImportFsWarned = false;

export function setSettingsPanelRefs({ buildAssetsPane, bindAssetsPane, assetStyles }) {
  if (buildAssetsPane) _buildAssetsPaneRef = buildAssetsPane;
  if (bindAssetsPane) _bindAssetsPaneRef = bindAssetsPane;
  if (assetStyles) _assetStylesRef = assetStyles;
}

function _safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function _safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function _toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function _normalizePathSepLocal(path) {
  return String(path || '').replace(/\\+/g, '/').trim();
}

function _escapeHtmlLite(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _modelToLegacyVoice(model) {
  if (!model) return null;
  const refs = _safeArray(model.refAudios);
  const defRef =
    refs.find(item => item.id === model.defaultRefId) ||
    refs.find(item => item.path === model?.paths?.defaultRefAudioPath) ||
    refs[0] ||
    null;
  const params = _safeObject(model.params);
  return {
    name: String(model.name || '').trim(),
    desc: String(model.desc || '').trim(),
    refAudioPath: String(defRef?.path || model?.paths?.defaultRefAudioPath || '').trim(),
    promptText: String(defRef?.promptText || params.promptText || '').trim(),
    promptLang: String(defRef?.promptLang || params.promptLang || 'zh').trim() || 'zh',
    textLang: String(defRef?.textLang || params.textLang || 'auto').trim() || 'auto',
    gptWeightsPath: String(model?.paths?.gptWeightsPath || '').trim(),
    sovitsWeightsPath: String(model?.paths?.sovitsWeightsPath || '').trim(),
  };
}

function _saveGptSoVitsModelsToSettings(models) {
  const settings = getSettings();
  settings.gptSoVits = settings.gptSoVits || {};
  const cfg = getGptSoVitsConfig();
  const normalized = normalizeGptSoVitsModelsForStore(models, cfg);
  settings.gptSoVits.models = normalized;
  settings.gptSoVits.voices = normalized.map(_modelToLegacyVoice).filter(Boolean);
  saveSettings();
  return normalized;
}

function _getGptSoVitsModelsForManager() {
  const cfg = getGptSoVitsConfig();
  return normalizeGptSoVitsModelsForStore(cfg.models, cfg);
}

function _buildDefaultGptSoVitsModel() {
  const cfg = getGptSoVitsConfig();
  const model = normalizeGptSoVitsModelForStore(
    {
      id: buildGptSoVitsModelId('model'),
      name: '��ģ��',
      enabled: true,
      desc: '',
      paths: {
        gptWeightsPath: '',
        sovitsWeightsPath: '',
        defaultRefAudioPath: '',
      },
      params: {
        promptText: '',
        promptLang: 'zh',
        textLang: cfg.textLang || 'auto',
        textSplitMethod: cfg.textSplitMethod || 'cut5',
        speedFactor: _toFiniteNumber(cfg.speedFactor, 1),
        mediaType: cfg.mediaType || 'wav',
        streamingMode: !!cfg.streamingMode,
        modelSwitchMode: normalizeGptSoVitsSwitchMode(cfg.modelSwitchMode || 'set_weights'),
        setModelEndpoint: normalizeSetModelEndpoint(cfg.setModelEndpoint || '/set_model'),
        strictWeightSwitch: !!cfg.strictWeightSwitch,
      },
      refAudios: [],
      defaultRefId: '',
      expressionRefMap: {},
    },
    cfg,
  );
  return model || {
    id: buildGptSoVitsModelId('model'),
    name: '��ģ��',
    enabled: true,
    desc: '',
    paths: { gptWeightsPath: '', sovitsWeightsPath: '', defaultRefAudioPath: '' },
    params: {
      promptText: '',
      promptLang: 'zh',
      textLang: 'auto',
      textSplitMethod: 'cut5',
      speedFactor: 1,
      mediaType: 'wav',
      streamingMode: false,
      modelSwitchMode: 'set_weights',
      setModelEndpoint: '/set_model',
      strictWeightSwitch: false,
    },
    refAudios: [],
    defaultRefId: '',
    expressionRefMap: {},
  };
}

function buildAboutPane() {
  return `
    <div class="gal-about-card">
      <h3><i class="fa-solid fa-bullhorn"></i> ���������ַ</h3>
      <p>
        <a href="https://discord.com/channels/1134557553011998840/1464262276583395359" target="_blank" rel="noopener noreferrer">
          Discord ������������򿪄1�7?        </a>
      </p>
    </div>

    <div class="gal-about-card">
      <h3><i class="fa-solid fa-copyright"></i> Live2D ��Ȩ��ʹ�����1�7?/h3>
      <p>
        Live2D ģ�ͼ�������زĵİ�Ȩ��ԭ���߻�Ȩ�������С���ԭʼ��Ȩ������ȷ����⣬������е�ģ������Դ����ѧϰ���о��뼼������ʹ�Ä1�7?      </p>
      <p class="gal-about-warning">
        ��ֹ�1�7?Live2D ģ�ͻ�����ز������κ���ҵ��;�1�7?      </p>
    </div>

    <div class="gal-about-card">
      <h3><i class="fa-solid fa-scale-balanced"></i> ���Э�飨CC BY-NC-SA 4.0�1�7?/h3>
      <p>
        ��������������1�7?        <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0</a>
        �����������������������ͬ��ʽ�����ǰ���½��з���ҵʹ�����޸Ą1�7?      </p>
      <p class="gal-about-warning">
        ��ȷ��ֹ���ã���������������������ѷַ�����ҵ��������ҵ���񼯳Ʉ1�7?      </p>
    </div>

    <div class="gal-about-card">
      <h3><i class="fa-solid fa-gavel"></i> ���ɺϹ�����</h3>
      <p>
        ʹ���߱����������ڵ��Լ���Դ��Դ�صķ��ɷ��棬��ֹ�����������Υ������Ȩ����ܼ�ܻ�����������;����Υ��ʹ�ò����ķ�����������ʹ�������ге��1�7?      </p>
    </div>
  `;
}

// Ƥ���б����
const SKIN_LIST = [
  { value: 'none',    label: 'Ĭ��' },
  { value: 'skin-ancient', label: 'īȾǧ��й��ŷ磩' },
  { value: 'skin-western', label: 'ð���߾ƹݣ�������ã�' },
  { value: 'skin-persona', label: '��֮�ֵ���Ů������¼��' },
  { value: 'skin-jrpg',    label: '���֮ͥ����ʽ��ã�' },
  { value: 'skin-classic',  label: 'ӣɫ�������Galgame��' },
];

// Ӧ��Ƥ������ǲ�
export function applySkin() {
  const settings = getSettings();
  const skin = settings.skin || 'none';
  const $overlay = $('#gal-global-overlay');
  // �Ƴ�����Ƥ�1�7?class
  SKIN_LIST.forEach(s => { if (s.value !== 'none') $overlay.removeClass(s.value); });
  // ���ѡ�е�Ƥ�1�7?class
  if (skin !== 'none') $overlay.addClass(skin);

  if (skin === 'skin-western') {
    applyWesternSkinRuntime().catch(err => {
      console.warn(`[${SCRIPT_NAME}] Ӧ�� western Ԫ��Ƥ��ʧ��:`, err);
    });
  } else {
    clearWesternSkinRuntime();
  }
}

// Ӧ�����Ä1�7?UI
export function applySettingsToUI() {
  const settings = getSettings();
  const fontScale = 0.5 + (settings.fontSize / 30) * 1.0;
  $('#gal-global-overlay').css('--font-scale', fontScale);

  const opacity = settings.dialogOpacity;
  // ֻ�ڷ�Ƥ��ģʽ��Ӧ��Ĭ�������ʽ
  if (!settings.skin || settings.skin === 'none') {
    $('.gal-text-panel').css({
      'background-color': `rgba(255, 255, 255, ${opacity})`,
      'background-image': `linear-gradient(135deg, transparent 0%, transparent 95%, rgba(0, 210, 255, ${0.1 * opacity}) 95%, rgba(0, 210, 255, ${0.1 * opacity}) 100%)`
    });
  } else {
    // Ƥ��ģʽ����͸���ȴ�1�7?CSS ������Ƥ�1�7?CSS ����
    $('#gal-global-overlay').css('--panel-opacity', opacity);
    // ��������1�7?background ��ʽ����Ƥ�� CSS �ӹ�
    $('.gal-text-panel').css({ 'background-color': '', 'background-image': '' });
  }

  if (settings.showSprites) {
    $('.gal-layer-character').show();
  } else {
    $('.gal-layer-character').hide();
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

  applyBgFillMode();
  applySkin();
  applyTextEffect();
  syncPixiEffectsSettings();
}

export function applyBgFillMode() {
  const settings = getSettings();
  const fillMode = settings.bgFillMode || 'cover';
  const $bgLayers = $('.gal-bg-layer');
  $bgLayers.css('background-size', fillMode);
  if (fillMode === 'contain') {
    $bgLayers.css('background-position', 'center top');
  } else {
    $bgLayers.css('background-position', 'center');
  }
}

export function applyTextEffect() {
  const settings = getSettings();
  const effect = settings.textEffect || 'none';
  const $textPanel = $('.gal-text-panel');
  const $dialogText = $('.gal-dialog-text');
  const $nameBadge = $('.gal-name-badge');

  $textPanel.removeClass('text-effect-glass text-effect-gradient text-effect-text-bg');
  $dialogText.css({
    'text-shadow': '',
    '-webkit-text-stroke': '',
    'background-color': '',
    'padding': '',
    'border-radius': '',
    'color': ''
  });
  $nameBadge.css({
    'text-shadow': '',
    '-webkit-text-stroke': ''
  });

  switch (effect) {
    case 'shadow':
      $dialogText.css({
        'text-shadow': '0 0 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7), 0 2px 4px rgba(0,0,0,0.5)',
        'color': '#fff'
      });
      $nameBadge.css({
        'text-shadow': '0 0 4px rgba(0,0,0,0.8), 0 2px 4px rgba(0,0,0,0.5)'
      });
      break;

    case 'glow':
      $dialogText.css({
        'text-shadow': '0 0 5px rgba(255,255,255,0.8), 0 0 10px rgba(255,255,255,0.6), 0 0 20px rgba(0,210,255,0.4)',
        'color': '#fff'
      });
      $nameBadge.css({
        'text-shadow': '0 0 5px rgba(0,210,255,0.8), 0 0 10px rgba(0,210,255,0.5)'
      });
      break;

    case 'stroke':
      $dialogText.css({
        '-webkit-text-stroke': '1.5px rgba(0,0,0,0.8)',
        'text-shadow': '0 2px 4px rgba(0,0,0,0.3)',
        'color': '#fff'
      });
      $nameBadge.css({
        '-webkit-text-stroke': '1px rgba(0,0,0,0.6)',
        'text-shadow': '0 1px 2px rgba(0,0,0,0.3)'
      });
      break;

    case 'glass':
      $textPanel.addClass('text-effect-glass');
      $dialogText.css('color', '#333');
      break;

    case 'gradient':
      $textPanel.addClass('text-effect-gradient');
      $dialogText.css({
        'text-shadow': '0 1px 2px rgba(0,0,0,0.3)',
        'color': '#fff'
      });
      break;

    case 'text-bg':
      $textPanel.addClass('text-effect-text-bg');
      $dialogText.css({
        'background-color': 'rgba(0,0,0,0.6)',
        'padding': '8px 12px',
        'border-radius': '8px',
        'color': '#fff',
        'text-shadow': '0 1px 2px rgba(0,0,0,0.3)'
      });
      break;

    default:
      $dialogText.css('color', '#333');
      break;
  }
}

export async function showSettingsPanel(topTab, subTab) {
  const $existing = $('#gal-unified-panel');
  if ($existing.length) {
    if (topTab === undefined) { $existing.remove(); return; } // toggle
    $existing.remove(); // �в΄1�7?= �ؽ�
  }
  topTab = topTab || 'settings';

  const settings = getSettings();
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
    '<option value="">ʹ�õ�ǰԤ��</option>',
    ...presetNames.map(p => `<option value="${p}" ${settings.enhancedMode?.secondGenerate?.presetName === p ? 'selected' : ''}>${p}</option>`),
  ].join('');
  const profileOptions = [
    '<option value="">ʹ�õ�ǰ��������</option>',
    ...profileNames.map(p => `<option value="${p}" ${settings.enhancedMode?.secondGenerate?.profileName === p ? 'selected' : ''}>${p}</option>`),
  ].join('');
  const modelOptions = [
    '<option value="">ʹ�õ�ǰģ��</option>',
    ...modelNames.map(m => `<option value="${m}" ${settings.enhancedMode?.secondGenerate?.modelName === m ? 'selected' : ''}>${m}</option>`),
  ].join('');

  const worldbookListHtml = worldbookNames.length === 0
    ? '<div style="font-size: 0.85rem; color: #333; margin-left: 24px; font-weight: 500;">���޿��õ�������</div>'
    : `<div style="margin-left: 24px; max-height: 150px; overflow-y: auto; border: 1px solid #ccc; border-radius: 4px; padding: 10px; background: var(--SmartThemeFormBg, #fff); color: var(--SmartThemeBodyColor, #333);">
        ${worldbookNames.map(wb => `
          <label style="display: flex; align-items: center; gap: 8px; padding: 6px 0; cursor: pointer; font-size: 0.9rem; color: #222; font-weight: 500;">
            <input type="checkbox" class="gal-enhanced-worldbook-item" value="${wb}" ${savedWorldbooks.includes(wb) ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;">
            <span style="color: #333;">${wb}</span>
          </label>
        `).join('')}
      </div>`;

  // ������Դ���� pane (async)
  let assetsHtml = '';
  if (_buildAssetsPaneRef) {
    assetsHtml = await _buildAssetsPaneRef(subTab);
  }
  const assetStyles = _assetStylesRef ? _assetStylesRef() : '';

  const panelHtml = `
    <div class="gal-config-modal" id="gal-unified-panel">
      <div class="gal-config-panel">
        <!-- L1 Tab Header -->
        <div class="gal-l1-tab-header">
          <div class="gal-l1-tab-btn ${topTab === 'settings' ? 'active' : ''}" data-l1-tab="settings"><i class="fa-solid fa-gear"></i> <span>��������</span></div>
          <div class="gal-l1-tab-btn ${topTab === 'assets' ? 'active' : ''}" data-l1-tab="assets"><i class="fa-solid fa-folder-open"></i> <span>��Դ����</span></div>
          <div class="gal-l1-tab-btn ${topTab === 'about' ? 'active' : ''}" data-l1-tab="about"><i class="fa-solid fa-circle-info"></i> <span>����</span></div>
          <div style="flex:1;"></div>
          <button class="gal-config-close" id="gal-settings-close"><i class="fa-solid fa-times"></i></button>
        </div>

        <!-- L1 Pane: �������� -->
        <div class="gal-config-body" data-l1-pane="settings" style="padding: 24px; overflow-y: auto; flex: 1; ${topTab !== 'settings' ? 'display: none;' : ''}">
          <!-- �����1�7?-->
          <div style="text-align: center; margin-bottom: 24px;">
            <button id="gal-main-toggle" class="${isEnabled ? 'gal-toggle-on' : 'gal-toggle-off'}"
                    style="padding: 14px 40px; font-size: 1.1rem; font-weight: 800; border: none; border-radius: 8px; cursor: pointer; transition: all 0.3s; display: inline-flex; align-items: center; gap: 10px;">
              <i class="fa-solid ${isEnabled ? 'fa-toggle-on' : 'fa-toggle-off'}" style="font-size: 1.3rem;"></i>
              <span>${isEnabled ? 'Galgame ģʽ�ѿ���' : 'Galgame ģʽ�ѹر�'}</span>
            </button>
            <p style="margin-top: 8px; font-size: 0.8rem; color: #999;">��ǰ��ɫ��������1�7?/p>
          </div>

          <div class="gal-settings-divider"></div>

          <!-- �ı���ʾ -->
          <div class="gal-settings-section">
            <div class="gal-settings-section-title"><i class="fa-solid fa-font"></i> �ı���ʾ</div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">�����С</span>
              <div class="gal-settings-control">
                <input type="range" id="gal-font-size" min="1" max="30" step="1" value="${settings.fontSize}">
                <span class="gal-range-value" id="gal-font-size-value">${settings.fontSize}</span>
              </div>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">�Ի���͸���1�7?/span>
              <div class="gal-settings-control">
                <input type="range" id="gal-dialog-opacity" min="0" max="100" step="5" value="${Math.round((1 - settings.dialogOpacity) * 100)}">
                <span class="gal-range-value" id="gal-dialog-opacity-value">${Math.round((1 - settings.dialogOpacity) * 100)}%</span>
              </div>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">������Ч</span>
              <div class="gal-settings-control">
                <select id="gal-text-effect" class="gal-select">
                  <option value="none" ${settings.textEffect === 'none' ? 'selected' : ''}>�1�7?/option>
                  <option value="shadow" ${settings.textEffect === 'shadow' ? 'selected' : ''}>��Ӱ��ǿ</option>
                  <option value="glow" ${settings.textEffect === 'glow' ? 'selected' : ''}>����Ч��</option>
                  <option value="stroke" ${settings.textEffect === 'stroke' ? 'selected' : ''}>�������</option>
                  <option value="glass" ${settings.textEffect === 'glass' ? 'selected' : ''}>ë�������1�7?/option>
                  <option value="gradient" ${settings.textEffect === 'gradient' ? 'selected' : ''}>�ײ���������</option>
                  <option value="text-bg" ${settings.textEffect === 'text-bg' ? 'selected' : ''}>�������ֱ���</option>
                </select>
              </div>
            </div>
          </div>

          <div class="gal-settings-divider"></div>

          <!-- �Զ����� -->
          <div class="gal-settings-section">
            <div class="gal-settings-section-title"><i class="fa-solid fa-play"></i> �Զ�����</div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">���ż��</span>
              <div class="gal-settings-control">
                <input type="range" id="gal-auto-speed" min="1" max="8" step="0.5" value="${settings.autoPlaySpeed}">
                <span class="gal-range-value" id="gal-auto-speed-value">${settings.autoPlaySpeed}�1�7?/span>
              </div>
            </div>
          </div>

          <div class="gal-settings-divider"></div>

          <!-- ��ʾ���� -->
          <div class="gal-settings-section">
            <div class="gal-settings-section-title"><i class="fa-solid fa-display"></i> ��ʾ����</div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">��ʾ����</span>
              <label class="gal-switch"><input type="checkbox" id="gal-show-sprites" ${settings.showSprites ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">����ģʽ <small style="color:#999;">(��������¥��)</small></span>
              <label class="gal-switch"><input type="checkbox" id="gal-hide-floors" ${settings.hideOtherFloors ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">����ͼ��1�7?<small style="color:#999;">(cover����/contain����)</small></span>
              <select id="gal-bg-fill-mode" style="padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85rem;">
                <option value="cover" ${settings.bgFillMode === 'cover' ? 'selected' : ''}>Cover (�����ü�)</option>
                <option value="contain" ${settings.bgFillMode === 'contain' ? 'selected' : ''}>Contain (������ʾ)</option>
              </select>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">����Ƥ��</span>
              <select id="gal-skin-select" style="padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85rem; min-width: 200px;">
                ${SKIN_LIST.map(s => `<option value="${s.value}" ${settings.skin === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="gal-settings-divider"></div>

          <!-- Pixi ��Ч -->
          <div class="gal-settings-section">
            <div class="gal-settings-section-title"><i class="fa-solid fa-wand-magic-sparkles"></i> Pixi��Ч</div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">������Ч</span>
              <label class="gal-switch"><input type="checkbox" id="gal-effects-enabled" ${settings.effectsEnabled ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">������λ</span>
              <select id="gal-effects-quality" style="padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85rem;">
                <option value="mobile" ${effectQuality === 'mobile' ? 'selected' : ''}>Mobile��ʡ�磩</option>
                <option value="balanced" ${effectQuality === 'balanced' ? 'selected' : ''}>Balanced��Ĭ�ϣ�</option>
                <option value="high" ${effectQuality === 'high' ? 'selected' : ''}>High���߻��ʄ1�7?/option>
              </select>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">�г����Զ���1�7?/span>
              <label class="gal-switch"><input type="checkbox" id="gal-effects-autoclear" ${settings.effectsAutoClearOnSceneChange ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">��������</span>
              <div class="gal-settings-control">
                <input type="range" id="gal-effects-max-active" min="1" max="6" step="1" value="${effectMaxActive}">
                <span class="gal-range-value" id="gal-effects-max-active-value">${effectMaxActive}</span>
              </div>
            </div>
          </div>

          <div class="gal-settings-divider"></div>

          <!-- �������� -->
          <div class="gal-settings-section">
            <div class="gal-settings-section-title"><i class="fa-solid fa-user"></i> ��������</div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">�����С</span>
              <div class="gal-settings-control">
                <input type="range" id="gal-sprite-scale" min="50" max="150" step="5" value="${settings.spriteScale}">
                <span class="gal-range-value" id="gal-sprite-scale-value">${settings.spriteScale}%</span>
              </div>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">��ֱλ�� <small style="color:#999;">(�ײ�ƫ��)</small></span>
              <div class="gal-settings-control">
                <input type="range" id="gal-sprite-bottom" min="0" max="50" step="1" value="${settings.spriteBottomOffset}">
                <span class="gal-range-value" id="gal-sprite-bottom-value">${settings.spriteBottomOffset}%</span>
              </div>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">������ <small style="color:#999;">(���Ҿ���)</small></span>
              <div class="gal-settings-control">
                <input type="range" id="gal-sprite-spacing" min="0" max="20" step="1" value="${settings.spriteSpacing}">
                <span class="gal-range-value" id="gal-sprite-spacing-value">${settings.spriteSpacing}%</span>
              </div>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">˵���߹�1�7?<small style="color:#999;">(��������)</small></span>
              <label class="gal-switch"><input type="checkbox" id="gal-speaker-glow" ${settings.speakerGlow ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">����ָʾ�1�7?<small style="color:#999;">(�������)</small></span>
              <label class="gal-switch"><input type="checkbox" id="gal-speaker-bubble" ${settings.speakerBubble ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
          </div>

          <div class="gal-settings-divider"></div>

          <!-- TTS���� -->
          <div class="gal-settings-section">
            <div class="gal-settings-section-title"><i class="fa-solid fa-volume-high"></i> TTS����</div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">����TTS����</span>
              <label class="gal-switch"><input type="checkbox" id="gal-tts-enabled" ${getTTSEnabled() ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <p style="font-size: 0.75rem; color: #888; margin: 8px 0 0 0;">������Ի���ʽ��TTS���ԣ������ڿ��1�7?br>�رգ��򵥶Ի���ʽ�������ڽ�1�7?/p>
            <div class="gal-settings-row">
              <span class="gal-settings-label">TTS����</span>
              <select id="gal-tts-provider" style="padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85rem; min-width: 220px;">
                <option value="littlewhitebox" ${settings.ttsProvider === 'littlewhitebox' ? 'selected' : ''}>С��X��������ɽ��</option>
                <option value="gpt_sovits_v2" ${settings.ttsProvider === 'gpt_sovits_v2' ? 'selected' : ''}>GPT-SoVITS v2ProPlus</option>
                <option value="edge_tts_direct" ${settings.ttsProvider === 'edge_tts_direct' ? 'selected' : ''}>EdgeTTS ֱ��</option>
              </select>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">�Զ����� <small style="color:#999;">(�ж��Զ��ʶ�)</small></span>
              <label class="gal-switch"><input type="checkbox" id="gal-tts-autoplay" ${settings.ttsAutoPlay ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">Ĭ����ɫ</span>
              <select id="gal-tts-default-speaker" style="padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85rem; min-width: 220px;">
                <option value="">����ָ���1�7?/option>
              </select>
            </div>
            <p id="gal-tts-default-speaker-hint" style="font-size: 0.75rem; color: #888; margin: 8px 0 0 0;"></p>

            <div id="gal-gpt-sovits-config" style="margin-top: 10px; padding: 12px; border: 1px dashed #ddd; border-radius: 8px; background: #fafafa; ${settings.ttsProvider === 'gpt_sovits_v2' ? '' : 'display: none;'}">
              <div style="font-weight: 700; margin-bottom: 10px; color: ${THEME.dark}; display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-microchip" style="color:${THEME.accent};"></i>
                <span>GPT-SoVITS��api.py / api_v2.py����1�7?/span>
              </div>
              <div class="gal-settings-row">
                <span class="gal-settings-label">API��ַ</span>
                <input type="text" id="gal-gpt-sovits-url" value="${settings.gptSoVits?.apiUrl || ''}" placeholder="http://127.0.0.1:9880" style="flex: 1; margin-left: 10px; padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.85rem;">
              </div>
              <div class="gal-settings-row">
                <span class="gal-settings-label">ģ���л�ģʽ</span>
                <select id="gal-gpt-sovits-switch-mode" style="padding: 4px 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.85rem; min-width: 210px;">
                  <option value="set_weights" ${(settings.gptSoVits?.modelSwitchMode || 'set_weights') === 'set_weights' ? 'selected' : ''}>set_weights (api_v2.py)</option>
                  <option value="set_model" ${(settings.gptSoVits?.modelSwitchMode || '') === 'set_model' ? 'selected' : ''}>set_model (api.py)</option>
                  <option value="none" ${(settings.gptSoVits?.modelSwitchMode || '') === 'none' ? 'selected' : ''}>none (���Զ��Є1�7?</option>
                </select>
              </div>
              <div class="gal-settings-row">
                <span class="gal-settings-label">set_model�ӿ�</span>
                <input type="text" id="gal-gpt-sovits-set-model-endpoint" value="${settings.gptSoVits?.setModelEndpoint || '/set_model'}" placeholder="/set_model" style="flex: 1; margin-left: 10px; padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.85rem;">
              </div>
              <div class="gal-settings-row">
                <span class="gal-settings-label">�ϸ��л� <small style="color:#999;">(ʧ�ܲ�����)</small></span>
                <label class="gal-switch"><input type="checkbox" id="gal-gpt-sovits-strict-switch" ${settings.gptSoVits?.strictWeightSwitch ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
              </div>
              <div class="gal-settings-row">
                <span class="gal-settings-label">GPT-SoVITS��Ŀ�1�7?/span>
                <input type="text" id="gal-gpt-sovits-root-dir" value="${settings.gptSoVits?.rootDir || settings.gptSoVits?.importPathPrefix || ''}" placeholder="D:/GPT-SoVITS" style="flex: 1; margin-left: 10px; padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.85rem;">
              </div>
              <div class="gal-settings-row">
                <span class="gal-settings-label">ģ����Ŀ�1�7?/span>
                <input type="text" id="gal-gpt-sovits-import-prefix" value="${settings.gptSoVits?.importPathPrefix || settings.gptSoVits?.rootDir || ''}" placeholder="D:/ģ����Ŀ�1�7? style="flex: 1; margin-left: 10px; padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.85rem;">
              </div>
              <div class="gal-settings-row">
                <span class="gal-settings-label">ʹ�þƹݴ���</span>
                <label class="gal-switch"><input type="checkbox" id="gal-gpt-sovits-proxy" ${settings.gptSoVits?.useCorsProxy ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; margin-bottom:10px;">
                <button class="gal-panel-btn" id="gal-gpt-sovits-open-model-manager" style="padding: 10px 12px; flex: 1; min-width: 200px;">
                  <i class="fa-solid fa-layer-group"></i>
                  <span>��ģ�͹������</span>
                </button>
              </div>
            </div>
          </div>

          <div class="gal-settings-divider"></div>

          <!-- ��݄1�7?-->
          <div class="gal-settings-section">
            <div class="gal-settings-section-title"><i class="fa-solid fa-keyboard"></i> ��݄1�7?/div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">�ո�1�7?-> ��һ�1�7?/span>
              <label class="gal-switch"><input type="checkbox" id="gal-space-next" ${settings.spaceKeyNext ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">�س��1�7?-> ��һ�1�7?/span>
              <label class="gal-switch"><input type="checkbox" id="gal-enter-next" ${settings.enterKeyNext ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">Ctrl���� -> ���</span>
              <label class="gal-switch"><input type="checkbox" id="gal-ctrl-skip" ${settings.ctrlKeySkip ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
          </div>

          <div class="gal-settings-divider"></div>

          <!-- ������� -->
          <div class="gal-settings-section">
            <div class="gal-settings-section-title"><i class="fa-solid fa-forward"></i> �������</div>
            <div class="gal-settings-row">
              <span class="gal-settings-label" title="�����ֻ�м�⵽Galgame��ǩ�Ż���ʾ���棻�ر���������ʾ">�����ж��������Ԅ1�7?/span>
              <label class="gal-switch"><input type="checkbox" id="gal-smart-detection" ${settings.smartDetection ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">ȫ��Debug��־</span>
              <label class="gal-switch"><input type="checkbox" id="gal-global-debug" ${settings.globalDebug ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <div class="gal-settings-row">
              <span class="gal-settings-label">����ٶ�</span>
              <div class="gal-settings-control">
                <input type="range" id="gal-skip-speed" min="0.01" max="0.2" step="0.01" value="${settings.skipSpeed}">
                <span class="gal-range-value" id="gal-skip-speed-value">${settings.skipSpeed}s</span>
              </div>
            </div>
          </div>

          <div class="gal-settings-divider"></div>

          <!-- ��ǿģʽ -->
          <div class="gal-settings-section">
            <div class="gal-settings-section-title"><i class="fa-solid fa-bolt" style="color: #ff9800;"></i> ��ǿģʽ</div>
            <div class="gal-settings-row" style="margin-bottom: 12px;">
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <span class="gal-settings-label" style="font-weight: 600;">���ü�ǿģʽ</span>
                <small style="color: #888; font-size: 0.75rem;">�������ɲ��ԣ����ݴ��1�7?+ COT��ʽ�1�7?/small>
              </div>
              <label class="gal-switch"><input type="checkbox" id="gal-enhanced-mode" ${settings.enhancedMode?.enabled ? 'checked' : ''}><span class="gal-switch-slider"></span></label>
            </div>
            <div id="gal-enhanced-hint" style="${settings.enhancedMode?.enabled ? '' : 'display: none;'} padding: 12px; background: #fff8e1; border-radius: 6px; margin-bottom: 16px; font-size: 0.8rem; color: #666; line-height: 1.5;">
              <i class="fa-solid fa-lightbulb" style="color: #ff9800;"></i>
              ��һ������רע���ݣ��ڶ����л�API����COT��ʽ���1�7?            </div>
            <div id="gal-enhanced-config" style="${settings.enhancedMode?.enabled ? '' : 'display: none;'} padding-left: 12px; border-left: 2px solid #ffe0b2;">
              <div style="font-weight: 600; margin-bottom: 12px; color: #e65100; font-size: 0.9rem;">�ڶ���������1�7?/div>
              <div style="margin-bottom: 12px;">
                <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; cursor: pointer;">
                  <input type="checkbox" id="gal-enhanced-use-profile" ${settings.enhancedMode?.secondGenerate?.useProfile ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;">
                  <span style="font-size: 0.9rem; font-weight: 600; color: #222;">��������</span>
                </label>
                <select id="gal-enhanced-profile-name" style="width: calc(100% - 24px); padding: 8px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.9rem; margin-left: 24px; background: var(--SmartThemeFormBg, #fff); color: #333;">${profileOptions}</select>
              </div>
              <div style="margin-bottom: 12px;">
                <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; cursor: pointer;">
                  <input type="checkbox" id="gal-enhanced-use-model" ${settings.enhancedMode?.secondGenerate?.useModel ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;">
                  <span style="font-size: 0.9rem; font-weight: 600; color: #222;">ģ��</span>
                </label>
                <select id="gal-enhanced-model-name" style="width: calc(100% - 24px); padding: 8px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.9rem; margin-left: 24px; background: var(--SmartThemeFormBg, #fff); color: #333;">${modelOptions}</select>
              </div>
              <div style="margin-bottom: 12px;">
                <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; cursor: pointer;">
                  <input type="checkbox" id="gal-enhanced-use-preset" ${settings.enhancedMode?.secondGenerate?.usePreset ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;">
                  <span style="font-size: 0.9rem; font-weight: 600; color: #222;">Ԥ��</span>
                </label>
                <select id="gal-enhanced-preset-name" style="width: calc(100% - 24px); padding: 8px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.9rem; margin-left: 24px; background: var(--SmartThemeFormBg, #fff); color: #333;">${presetOptions}</select>
              </div>
              <div style="margin-bottom: 10px;">
                <div style="font-size: 0.9rem; font-weight: 600; color: #222; margin-bottom: 8px;">��������1�7?/div>
                <div style="margin-left: 24px;">
                  <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer; font-size: 0.85rem;">
                    <input type="radio" name="gal-enhanced-worldbook-mode" value="default" ${!settings.enhancedMode?.secondGenerate?.useWorldbooks && (!settings.enhancedMode?.secondGenerate?.worldbooks || settings.enhancedMode?.secondGenerate?.worldbooks.length === 0) ? 'checked' : ''} style="cursor: pointer;">
                    <span>��ʹ���Զ�������1�7?Ĭ��ѡ��)</span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer; font-size: 0.85rem;">
                    <input type="radio" name="gal-enhanced-worldbook-mode" value="none" ${settings.enhancedMode?.secondGenerate?.useWorldbooks && (!settings.enhancedMode?.secondGenerate?.worldbooks || settings.enhancedMode?.secondGenerate?.worldbooks.length === 0) ? 'checked' : ''} style="cursor: pointer;">
                    <span>��ʹ���κ�������</span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer; font-size: 0.85rem;">
                    <input type="radio" name="gal-enhanced-worldbook-mode" value="custom" ${settings.enhancedMode?.secondGenerate?.useWorldbooks && settings.enhancedMode?.secondGenerate?.worldbooks && settings.enhancedMode?.secondGenerate?.worldbooks.length > 0 ? 'checked' : ''} style="cursor: pointer;">
                    <span>ʹ�����������飺</span>
                  </label>
                  <div id="gal-enhanced-worldbooks-list" style="margin-left: 24px; ${settings.enhancedMode?.secondGenerate?.useWorldbooks && settings.enhancedMode?.secondGenerate?.worldbooks && settings.enhancedMode?.secondGenerate?.worldbooks.length > 0 ? '' : 'display: none;'}">${worldbookListHtml}</div>
                </div>
              </div>
              <div style="margin-top: 16px; padding-top: 12px; border-top: 1px dashed #ffe0b2;">
                <button id="gal-enhanced-view-prompts" class="gal-panel-btn secondary" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
                  <i class="fa-solid fa-eye"></i><span>�鿴��ʾ�1�7?/span>
                </button>
              </div>
            </div>
          </div>

          <div class="gal-settings-divider"></div>

          <!-- ˢ����ͼ -->
          <div style="margin-top: 16px;">
            <button class="gal-panel-btn secondary" id="gal-refresh-views" style="width: 100%;"><i class="fa-solid fa-sync"></i><span>ˢ����ͼ</span></button>
          </div>
        </div>

        <!-- L1 Pane: ��Դ���� -->
        <div data-l1-pane="assets" style="padding: 24px; overflow-y: auto; flex: 1; ${topTab !== 'assets' ? 'display: none;' : ''}">
          ${assetsHtml}
        </div>

        <!-- L1 Pane: ���� -->
        <div data-l1-pane="about" class="gal-about-pane" style="padding: 24px; overflow-y: auto; flex: 1; ${topTab !== 'about' ? 'display: none;' : ''}">
          ${buildAboutPane()}
        </div>
      </div>
    </div>

    <style>
      .gal-toggle-on { background: linear-gradient(135deg, ${THEME.accent} 0%, #00a8cc 100%); color: #fff; box-shadow: 0 4px 15px rgba(0, 210, 255, 0.4); }
      .gal-toggle-off { background: #e0e0e0; color: #666; }
      .gal-toggle-on:hover, .gal-toggle-off:hover { transform: scale(1.02); }
      .gal-settings-divider { border-top: 1px solid #e0e0e0; margin: 16px 0; }
      .gal-settings-section { margin-bottom: 8px; }
      .gal-settings-section-title { font-weight: 700; font-size: 0.95rem; color: ${THEME.dark}; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
      .gal-settings-section-title i { color: ${THEME.accent}; }
      .gal-settings-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
      .gal-settings-row:last-child { border-bottom: none; }
      .gal-settings-label { font-size: 0.9rem; color: #444; }
      .gal-settings-control { display: flex; align-items: center; gap: 10px; }
      .gal-settings-control input[type="range"] { width: 120px; accent-color: ${THEME.accent}; }
      .gal-range-value { min-width: 45px; text-align: right; font-weight: 600; font-size: 0.85rem; color: ${THEME.accent}; }
      .gal-switch { position: relative; display: inline-block; width: 48px; height: 26px; }
      .gal-switch input { opacity: 0; width: 0; height: 0; }
      .gal-switch-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: 0.3s; border-radius: 26px; }
      .gal-switch-slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: white; transition: 0.3s; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
      .gal-switch input:checked + .gal-switch-slider { background: linear-gradient(135deg, ${THEME.accent} 0%, #00a8cc 100%); }
      .gal-switch input:checked + .gal-switch-slider:before { transform: translateX(22px); }
      .gal-panel-btn { padding: 14px; background: linear-gradient(135deg, ${THEME.accent} 0%, #00a8cc 100%); color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; display: flex; flex-direction: column; align-items: center; gap: 6px; transition: all 0.2s; }
      .gal-panel-btn.secondary { background: linear-gradient(135deg, #666 0%, #444 100%); }
      .gal-panel-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
      .gal-panel-btn i { font-size: 1.3rem; }

      /* L1 Tab Header */
      .gal-l1-tab-header { display:flex; align-items:center; background:var(--SmartThemeBotMesBlurTintColor, #1a1a2e); padding:0; border-bottom:2px solid ${THEME.accent}; }
      .gal-l1-tab-btn { padding:14px 28px; border:none; background:transparent; color:rgba(255,255,255,0.5); font-size:1rem; font-weight:700; cursor:pointer; border-bottom:3px solid transparent; display:flex; align-items:center; gap:8px; transition:all 0.2s; user-select:none; }
      .gal-l1-tab-btn:hover { color:rgba(255,255,255,0.85); }
      .gal-l1-tab-btn.active { color:${THEME.accent}; border-bottom-color:${THEME.accent}; }
      .gal-about-pane { display: flex; flex-direction: column; gap: 14px; }
      .gal-about-card { background: #f8fbff; border: 1px solid #dce9ff; border-radius: 10px; padding: 16px; color: #2f3a4a; line-height: 1.7; }
      .gal-about-card h3 { margin: 0 0 8px 0; color: ${THEME.dark}; font-size: 1rem; display: flex; align-items: center; gap: 8px; }
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

  // TTS ��ɫ�б��첽���
  const refreshTtsVoiceOptions = async () => {
    const $sel = $('#gal-tts-default-speaker');
    const $hint = $('#gal-tts-default-speaker-hint');
    if (!$sel.length) return;
    let voiceList = [];
    try { voiceList = await getTTSVoiceListAsync(); } catch (e) { console.warn(`[${SCRIPT_NAME}] ��ȡTTS��ɫ�б�ʧ��:`, e); }
    const current = settings.ttsDefaultSpeaker || '';
    $sel.empty().append('<option value="">����ָ���1�7?/option>');
    voiceList.forEach(v => {
      const desc = v.desc ? ` (${v.desc})` : '';
      $sel.append(`<option value="${v.name}">${v.name}${desc}</option>`);
    });
    $sel.val(current);
    const provider = getTTSProvider();
    const providerHint = provider === TTS_PROVIDER.GPT_SOVITS_V2
      ? 'GPT-SoVITS�����齫��ɫ name ����Ϊ��ɫ����'
      : provider === TTS_PROVIDER.EDGE_TTS_DIRECT
        ? 'EdgeTTS ֱ��������ʾ���ĺ�������ɫ��'
        : 'LittleWhiteBox��δָ��/δ��ʱʹ�ô�Ĭ����ɫ��';
    if ($hint.length) $hint.text(providerHint + (voiceList.length === 0 ? '����ǰ��ɫ�б�Ϊ�գ�' : ''));
  };

  refreshTtsVoiceOptions();

  // L1 tab �л�
  $panel.find('.gal-l1-tab-btn').on('click', function () {
    const tab = $(this).data('l1-tab');
    $panel.find('.gal-l1-tab-btn').removeClass('active');
    $(this).addClass('active');
    $panel.find('[data-l1-pane]').hide();
    $panel.find(`[data-l1-pane="${tab}"]`).show();
  });

  // �ر�
  $('#gal-settings-close').on('click', () => $panel.remove());
  $panel.on('click', function (e) { if (e.target === this) $panel.remove(); });

  // ������
  $('#gal-main-toggle').on('click', async function () {
    const newEnabled = !getIsEnabled();
    setIsEnabled(newEnabled);
    setCurrentCharEnabled(newEnabled);
    updateButtonState();
    if (newEnabled) {
      $(this).removeClass('gal-toggle-off').addClass('gal-toggle-on').html('<i class="fa-solid fa-toggle-on" style="font-size: 1.3rem;"></i><span>Galgame ģʽ�ѿ���</span>');
      await injectCOTToWorldbook();
      applyGalgameMode();
      if (settings.hideOtherFloors) hideNonLastFloors();
      showToast('Galgame ģʽ�ѿ���');
    } else {
      $(this).removeClass('gal-toggle-on').addClass('gal-toggle-off').html('<i class="fa-solid fa-toggle-off" style="font-size: 1.3rem;"></i><span>Galgame ģʽ�ѹر�</span>');
      await disableWorldbookGlobally();
      restoreOriginalViews();
      setTimeout(() => { const $lastMes = $('#chat > .mes').last(); if ($lastMes.length) $lastMes[0].scrollIntoView({ behavior: 'smooth', block: 'end' }); }, 150);
      showToast('Galgame ģʽ�ѹر�');
    }
  });

  // ��������
  $('#gal-font-size').on('input', function () { settings.fontSize = parseInt($(this).val()); $('#gal-font-size-value').text(settings.fontSize); applySettingsToUI(); saveSettings(); });
  $('#gal-dialog-opacity').on('input', function () { const t = parseInt($(this).val()); settings.dialogOpacity = 1 - (t / 100); $('#gal-dialog-opacity-value').text(t + '%'); applySettingsToUI(); saveSettings(); });
  $('#gal-text-effect').on('change', function () { settings.textEffect = $(this).val(); applySettingsToUI(); saveSettings(); });
  $('#gal-auto-speed').on('input', function () { settings.autoPlaySpeed = parseFloat($(this).val()); $('#gal-auto-speed-value').text(settings.autoPlaySpeed + '?'); saveSettings(); });

  // ������1�7?  $('#gal-show-sprites').on('change', function () { settings.showSprites = $(this).is(':checked'); applySettingsToUI(); saveSettings(); });
  $('#gal-hide-floors').on('change', function () {
    settings.hideOtherFloors = $(this).is(':checked');
    setHideOtherFloors(settings.hideOtherFloors);
    if (getIsEnabled()) { if (settings.hideOtherFloors) hideNonLastFloors(); else showAllFloors(); }
    saveSettings();
  });
  $('#gal-bg-fill-mode').on('change', function () { settings.bgFillMode = $(this).val(); applyBgFillMode(); saveSettings(); });
  $('#gal-skin-select').on('change', function () { settings.skin = $(this).val(); applySkin(); applySettingsToUI(); saveSettings(); });
  $('#gal-effects-enabled').on('change', function () {
    settings.effectsEnabled = $(this).is(':checked');
    if (!settings.effectsEnabled) {
      clearAllPixiEffects();
    }
    syncPixiEffectsSettings();
    saveSettings();
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

  // ��ǿģʽ
  $('#gal-enhanced-mode').on('change', function () {
    const enabled = $(this).is(':checked');
    const enhancedConfig = ensureEnhancedModeSettings();
    enhancedConfig.enabled = enabled;
    saveSettings();
    $('#gal-enhanced-hint, #gal-enhanced-config').toggle(enabled);
    showToast(enabled ? '�����ü�ǿģʽ' : '�ѽ��ü�ǿģʽ');
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

  // �鿴��ʾ��
  $('#gal-enhanced-view-prompts').on('click', function () {
    const prompts = enhancedModeState.lastPrompts;
    if (!prompts) { showToast('������ʾ�ʼ�¼'); return; }
    const esc = str => (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const html = `<div id="gal-prompts-modal" class="gal-z-modal" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;">
      <div style="background:var(--SmartThemeFormBg,#fff);border-radius:12px;max-width:800px;width:100%;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
        <div style="padding:16px 20px;border-bottom:1px solid #e0e0e0;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#ff9800,#ff5722);color:#fff;border-radius:12px 12px 0 0;">
          <div style="font-weight:700;font-size:1.1rem;"><i class="fa-solid fa-eye"></i> ��ǿģʽ��ʾ�1�7?/div>
          <button id="gal-prompts-modal-close" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:1rem;"><i class="fa-solid fa-times"></i></button>
        </div>
        <div style="padding:20px;overflow-y:auto;flex:1;">
          <div style="margin-bottom:8px;color:#888;font-size:0.85rem;"><i class="fa-solid fa-clock"></i> ${prompts.timestamp}</div>
          <div style="margin-bottom:20px;"><div style="font-weight:600;margin-bottom:8px;color:#e65100;">System Prompt</div><pre style="background:#f5f5f5;border:1px solid #ddd;border-radius:6px;padding:12px;font-size:0.85rem;white-space:pre-wrap;word-break:break-word;max-height:150px;overflow-y:auto;margin:0;color:#333;">${esc(prompts.systemPrompt)}</pre></div>
          <div style="margin-bottom:20px;"><div style="font-weight:600;margin-bottom:8px;color:#1976d2;">First Result</div><pre style="background:#e3f2fd;border:1px solid #bbdefb;border-radius:6px;padding:12px;font-size:0.85rem;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow-y:auto;margin:0;color:#333;">${esc(prompts.firstResult)}</pre></div>
          <div><div style="font-weight:600;margin-bottom:8px;color:#388e3c;">User Prompt</div><pre style="background:#e8f5e9;border:1px solid #c8e6c9;border-radius:6px;padding:12px;font-size:0.85rem;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow-y:auto;margin:0;color:#333;">${esc(prompts.userPrompt)}</pre></div>
        </div>
        <div style="padding:12px 20px;border-top:1px solid #e0e0e0;text-align:right;">
          <button id="gal-prompts-modal-copy" style="background:#2196f3;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;margin-right:8px;"><i class="fa-solid fa-copy"></i> ����ȫ��</button>
          <button id="gal-prompts-modal-ok" style="background:#4caf50;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:0.9rem;"><i class="fa-solid fa-check"></i> ȷ��</button>
        </div>
      </div>
    </div>`;
    const mountRoot = getModalMountRoot();
    $(mountRoot).append(html);
    const $m = $(mountRoot).find('#gal-prompts-modal');
    $m.find('#gal-prompts-modal-close, #gal-prompts-modal-ok').on('click', () => $m.remove());
    $m.on('click', e => { if (e.target === $m[0]) $m.remove(); });
    $m.find('#gal-prompts-modal-copy').on('click', () => {
      navigator.clipboard.writeText(`=== ��ǿģʽ��ʾ�1�7?(${prompts.timestamp}) ===\n\n��System Prompt��\n${prompts.systemPrompt}\n\n����һ�����ɽ����\n${prompts.firstResult}\n\n��User Prompt��\n${prompts.userPrompt}`)
        .then(() => showToast('�Ѹ��Ƶ�������')).catch(() => showToast('����ʧ��'));
    });
  });

  // ��������
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
    showToast(settings.globalDebug ? 'ȫ�� Debug ��־�ѿ���' : 'ȫ�� Debug ��־�ѹرգ�����ʾ������־');
  });

  // ��������
  $('#gal-sprite-scale').on('input', function () { settings.spriteScale = parseInt($(this).val()); $('#gal-sprite-scale-value').text(settings.spriteScale + '%'); applySettingsToUI(); saveSettings(); });
  $('#gal-sprite-bottom').on('input', function () { settings.spriteBottomOffset = parseInt($(this).val()); $('#gal-sprite-bottom-value').text(settings.spriteBottomOffset + '%'); applySettingsToUI(); saveSettings(); });
  $('#gal-sprite-spacing').on('input', function () { settings.spriteSpacing = parseInt($(this).val()); $('#gal-sprite-spacing-value').text(settings.spriteSpacing + '%'); applySettingsToUI(); saveSettings(); });
  $('#gal-speaker-glow').on('change', function () { settings.speakerGlow = $(this).is(':checked'); applySettingsToUI(); saveSettings(); });
  $('#gal-speaker-bubble').on('change', function () { settings.speakerBubble = $(this).is(':checked'); applySettingsToUI(); saveSettings(); });

  // TTS
  $('#gal-tts-enabled').on('change', function () {
    const enabled = $(this).is(':checked');
    setTTSEnabled(enabled);
    const $charLayer = $('.gal-layer-character');
    if (enabled) $charLayer.addClass('tts-mode-enabled'); else $charLayer.removeClass('tts-mode-enabled');
    injectCOTToWorldbook().then(() => showToast(enabled ? 'TTS�����ã�COT�Ѹ���' : 'TTS�ѹرգ�COT�Ѹ���'));
  });
  $('#gal-tts-provider').on('change', async function () {
    settings.ttsProvider = $(this).val();
    saveSettings();
    $('#gal-gpt-sovits-config').toggle(settings.ttsProvider === TTS_PROVIDER.GPT_SOVITS_V2);
    try { TTSManager._refreshProviderState(); } catch (e) {}
    await refreshTtsVoiceOptions();
    injectCOTToWorldbook().then(() => showToast('TTS�������л���COT�Ѹ���')).catch(() => showToast('TTS�������л�'));
  });
  $('#gal-tts-autoplay').on('change', function () { settings.ttsAutoPlay = $(this).is(':checked'); saveSettings(); });
  $('#gal-tts-default-speaker').on('change', function () { settings.ttsDefaultSpeaker = $(this).val(); saveSettings(); });

  // GPT-SoVITS
  $('#gal-gpt-sovits-url').on('change', function () { settings.gptSoVits = settings.gptSoVits || {}; settings.gptSoVits.apiUrl = $(this).val().trim(); saveSettings(); });
  $('#gal-gpt-sovits-switch-mode').on('change', function () { settings.gptSoVits = settings.gptSoVits || {}; settings.gptSoVits.modelSwitchMode = $(this).val(); saveSettings(); });
  $('#gal-gpt-sovits-set-model-endpoint').on('change', function () {
    settings.gptSoVits = settings.gptSoVits || {};
    const endpoint = String($(this).val() || '').trim();
    settings.gptSoVits.setModelEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint || 'set_model'}`;
    saveSettings();
  });
  $('#gal-gpt-sovits-strict-switch').on('change', function () { settings.gptSoVits = settings.gptSoVits || {}; settings.gptSoVits.strictWeightSwitch = $(this).is(':checked'); saveSettings(); });
  $('#gal-gpt-sovits-root-dir').on('change', function () {
    settings.gptSoVits = settings.gptSoVits || {};
    const nextRoot = String($(this).val() || '').trim();
    settings.gptSoVits.rootDir = nextRoot;
    if (!String(settings.gptSoVits.importPathPrefix || '').trim()) settings.gptSoVits.importPathPrefix = nextRoot;
    saveSettings();
  });
  $('#gal-gpt-sovits-import-prefix').on('change', function () {
    settings.gptSoVits = settings.gptSoVits || {};
    const nextPrefix = String($(this).val() || '').trim();
    settings.gptSoVits.importPathPrefix = nextPrefix;
    if (!String(settings.gptSoVits.rootDir || '').trim()) settings.gptSoVits.rootDir = nextPrefix;
    saveSettings();
  });
  $('#gal-gpt-sovits-open-model-manager').on('click', function () {
    openGptSoVitsModelManager({
      onChanged: async () => {
        await refreshTtsVoiceOptions();
        injectCOTToWorldbook().catch(() => {});
      },
    });
  });
  $('#gal-gpt-sovits-proxy').on('change', function () { settings.gptSoVits = settings.gptSoVits || {}; settings.gptSoVits.useCorsProxy = $(this).is(':checked'); saveSettings(); });

  // ˢ����ͼ
  $('#gal-refresh-views').on('click', () => { if (getIsEnabled()) { applyGalgameMode(); if (settings.hideOtherFloors) hideNonLastFloors(); showToast('��ͼ��ˢ��'); } else { showToast('���ȿ��� Galgame ģʽ'); } });

  // ����Դ�����¼�
  if (_bindAssetsPaneRef) {
    _bindAssetsPaneRef($panel, subTab);
  }
}

