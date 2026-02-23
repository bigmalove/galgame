import { DEFAULT_PACK_ID, SCRIPT_NAME, THEME } from '../core/constants.js';
import { $, topWindow } from '../core/env.js';
import { getSettings, saveSettings } from '../core/settings.js';
import { getIsEnabled } from '../core/state.js';
import { GalgameStore } from '../core/store.js';
import { deleteBackground, getAllBackgrounds } from '../db/backgrounds.js';
import { GLOBAL_MAP_REGION_KEY, deleteMapImage, getAllMapImages, getUnifiedMapImage } from '../db/map-images.js';
import {
  createImagePack,
  getAllImagePacks,
  getCurrentPackId,
  getRenderScope,
  setCurrentPack,
  setRenderScope,
} from '../db/image-packs.js';
import { deleteSprite, getAllSprites } from '../db/sprites.js';
import { convertTextToCotFormat } from '../logic/enhanced-mode.js';
import { injectCOTToWorldbook } from '../logic/worldbook.js';
import { getCharacterListFromDatabase } from '../utils/chat.js';
import {
  LOCATION_STATUS_ICON_OPTIONS,
  TIME_STATUS_ICON_OPTIONS,
  normalizeLocationStatusIconClass,
  normalizeTimeStatusIconClass,
} from '../utils/status-popup-icons.js';
import {
  AssetIO,
  exportCurrentCharacterCardWithConfig,
  importAssetsFromJson,
  importFromZipFile,
  showImportError,
  showInAppAlertDialog,
  showInAppConfirmDialog,
  showInAppPromptDialog,
  showRemoteZipImportDialog,
} from './asset-io.js';
import { showCharacterSpritesModal, showPackManagerModal, showTransferDialog } from './asset-manager-parts.js';
import { getModalMountRoot } from './fullscreen.js';
import { bindImageGenConfigEvents, buildImageGenConfigPane } from './image-gen-config.js';
import { showMapModal } from '../map/map-modal.js';
import { showMapUploadDialog } from './map-upload.js';
import { bindWesternSkinEditorEvents, buildWesternSkinEditorTab } from './skin-western-editor.js';
import { applyWesternSkinRuntime } from './skin-western-runtime.js';
import { showToast } from './toast.js';

// 延迟引用
let _showSpriteUploadDialogRef = null;
let _showBatchUploadDialogRef = null;
let _showBackgroundUploadDialogRef = null;
let _showBatchBackgroundUploadDialogRef = null;
let _showCustomExpressionManagerRef = null;
let _showSettingsPanelRef = null;

export function setAssetManagerModalRefs({
  showSpriteUploadDialog,
  showBatchUploadDialog,
  showBackgroundUploadDialog,
  showBatchBackgroundUploadDialog,
  showCustomExpressionManager,
  showSettingsPanel,
}) {
  if (showSpriteUploadDialog) _showSpriteUploadDialogRef = showSpriteUploadDialog;
  if (showBatchUploadDialog) _showBatchUploadDialogRef = showBatchUploadDialog;
  if (showBackgroundUploadDialog) _showBackgroundUploadDialogRef = showBackgroundUploadDialog;
  if (showBatchBackgroundUploadDialog) _showBatchBackgroundUploadDialogRef = showBatchBackgroundUploadDialog;
  if (showCustomExpressionManager) _showCustomExpressionManagerRef = showCustomExpressionManager;
  if (showSettingsPanel) _showSettingsPanelRef = showSettingsPanel;
}

const CUSTOM_LOCATION_HTML_KEY = GalgameStore.STORAGE_KEYS.CUSTOM_LOCATION_HTML;
const CUSTOM_TIME_HTML_KEY = GalgameStore.STORAGE_KEYS.CUSTOM_TIME_HTML;
const CUSTOM_LOCATION_ICON_CLASS_KEY = GalgameStore.STORAGE_KEYS.CUSTOM_LOCATION_ICON_CLASS;
const CUSTOM_TIME_ICON_CLASS_KEY = GalgameStore.STORAGE_KEYS.CUSTOM_TIME_ICON_CLASS;

// ============================================
// showAssetManagerModal - 代理到统一面板
// ============================================

export async function showAssetManagerModal(activeTab = 'sprites') {
  if (_showSettingsPanelRef) {
    _showSettingsPanelRef('assets', activeTab);
  }
}

// ============================================
// 构建资源管理内容 (无 modal 壳)
// ============================================

export async function buildAssetManagerContent(activeTab) {
  const settings = getSettings();
  const allPacks = await getAllImagePacks();
  const currentPackId = getCurrentPackId();
  const currentPack = allPacks.find(p => p.id === currentPackId) || allPacks.find(p => p.id === DEFAULT_PACK_ID);
  const currentPackName = currentPack ? currentPack.name : '未定义';
  const currentRenderScope = getRenderScope();
  const allSprites = await getAllSprites(currentPackId);
  const allBackgrounds = await getAllBackgrounds(currentPackId);
  const allMapImages = await getAllMapImages(currentPackId);
  const unifiedMapRecord = await getUnifiedMapImage(currentPackId);
  const legacyMapCount = allMapImages.filter(item => String(item?.regionKey || '').trim() !== GLOBAL_MAP_REGION_KEY).length;
  const dbCharacters = getCharacterListFromDatabase();
  const charactersData = new Map();
  allSprites.forEach(sprite => {
    if (!charactersData.has(sprite.characterId)) {
      charactersData.set(sprite.characterId, { sprites: [], type: '自定义', source: '本地' });
    }
    charactersData.get(sprite.characterId).sprites.push(sprite);
  });
  dbCharacters.forEach(char => {
    const charName = char.name;
    if (!charactersData.has(charName)) {
      charactersData.set(charName, { sprites: [], type: char.type, source: char.source });
    } else {
      const info = charactersData.get(charName);
      info.type = char.type;
      info.source = char.source;
    }
  });

  activeTab = activeTab || 'sprites';

  const html = `
    <div class="gal-asset-header">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="gal-pack-selector" style="position: relative;">
            <button class="gal-action-btn" id="gal-pack-dropdown-btn" title="切换图包" style="padding: 6px 12px; font-size: 0.9rem; background: #6f42c1; color: #fff; border-color: #6f42c1;">
              <i class="fa-solid fa-layer-group"></i> <span id="gal-current-pack-name">${currentPackName}</span> <i class="fa-solid fa-caret-down" style="margin-left: 4px;"></i>
            </button>
            <div class="gal-pack-menu gal-z-dropdown" id="gal-pack-menu" style="display: none; position: absolute; top: 100%; left: 0; margin-top: 4px; background: #fff; border: 2px solid #333; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 180px; overflow: hidden;">
              ${allPacks
                .map(
                  pack => `
                <div class="gal-pack-item ${pack.id === currentPackId ? 'active' : ''}" data-pack-id="${pack.id}" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 1px solid #eee; transition: background 0.2s; color: #333; ${pack.id === currentPackId ? 'background: #e9ecef; font-weight: 700;' : ''}">
                  <span><i class="fa-solid fa-folder${pack.id === currentPackId ? '-open' : ''}" style="margin-right: 8px; color: ${pack.id === currentPackId ? '#6f42c1' : '#666'};"></i>${pack.name}</span>
                  ${pack.isDefault ? '<span style="font-size: 0.7rem; background: #6f42c1; color: #fff; padding: 2px 6px; border-radius: 3px;">默认</span>' : ''}
                </div>
              `,
                )
                .join('')}
              <div style="border-top: 2px solid #eee;">
                <div class="gal-pack-item" id="gal-add-pack-btn" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background 0.2s; color: #28a745;">
                  <i class="fa-solid fa-plus"></i> <span>新建图包</span>
                </div>
                <div class="gal-pack-item" id="gal-manage-packs-btn" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background 0.2s; color: #17a2b8;">
                  <i class="fa-solid fa-cog"></i> <span>管理图包</span>
                </div>
              </div>
            </div>
          </div>
          <button class="gal-action-btn" id="gal-render-scope-btn" title="${currentRenderScope === 'current' ? '仅当前图包资源' : '搜索所有图包资源'}" style="padding: 6px 10px; font-size: 0.9rem; background: ${currentRenderScope === 'current' ? '#fd7e14' : '#20c997'}; color: #fff; border-color: ${currentRenderScope === 'current' ? '#fd7e14' : '#20c997'};">
            <i class="fa-solid ${currentRenderScope === 'current' ? 'fa-bullseye' : 'fa-globe'}"></i>
          </button>
        </div>
        <div style="display: flex; gap: 8px;">
          <div class="gal-export-dropdown" style="position: relative;">
            <button class="gal-action-btn" id="gal-export-dropdown-btn" title="导出资源" style="padding: 6px 12px; font-size: 0.9rem;">
              <i class="fa-solid fa-file-export"></i> <span>导出</span> <i class="fa-solid fa-caret-down" style="margin-left: 4px;"></i>
            </button>
            <div class="gal-export-menu gal-z-dropdown" id="gal-export-menu" style="display: none; position: absolute; top: 100%; right: 0; margin-top: 4px; background: #fff; border: 2px solid #333; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 200px; overflow: hidden;">
              <div class="gal-export-item" data-action="export-local" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #eee; transition: background 0.2s; color: #333;">
                <i class="fa-solid fa-file-zipper" style="width: 20px; color: #333;"></i><span>导出本地压缩包</span>
              </div>
              <div class="gal-export-item" data-action="export-remote" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background 0.2s; color: #333;">
                <i class="fa-solid fa-cloud-upload" style="width: 20px; color: #6f42c1;"></i><span>导出GitHub资源包</span>
              </div>
              <div class="gal-export-item" data-action="export-character-card" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; border-top: 1px solid #eee; transition: background 0.2s; color: #333;">
                <i class="fa-solid fa-id-card" style="width: 20px; color: #0d6efd;"></i><span>导出打包角色卡（完整设置）</span>
              </div>
            </div>
          </div>
          <div class="gal-import-dropdown" style="position: relative;">
            <button class="gal-action-btn" id="gal-import-dropdown-btn" title="导入资源" style="padding: 6px 12px; font-size: 0.9rem; background: #28a745; color: #fff; border-color: #28a745;">
              <i class="fa-solid fa-file-import"></i> <span>导入</span> <i class="fa-solid fa-caret-down" style="margin-left: 4px;"></i>
            </button>
            <div class="gal-import-menu gal-z-dropdown" id="gal-import-menu" style="display: none; position: absolute; top: 100%; right: 0; margin-top: 4px; background: #fff; border: 2px solid #333; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 200px; overflow: hidden;">
              <div class="gal-import-item" data-action="import-local-zip" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #eee; transition: background 0.2s; color: #333;">
                <i class="fa-solid fa-file-zipper" style="width: 20px; color: #f39c12;"></i><span>本地压缩包导入</span>
              </div>
              <div class="gal-import-item" data-action="import-remote-zip" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #eee; transition: background 0.2s; color: #333;">
                <i class="fa-solid fa-cloud-arrow-down" style="width: 20px; color: #3498db;"></i><span>远程压缩包导入</span>
              </div>
              <div class="gal-import-item" data-action="import-json" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #eee; transition: background 0.2s; color: #333;">
                <i class="fa-solid fa-link" style="width: 20px; color: #9b59b6;"></i><span>导入远程链接JSON</span>
              </div>
              <div class="gal-import-item" data-action="import-github" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background 0.2s; color: #333;">
                <i class="fa-brands fa-github" style="width: 20px; color: #333;"></i><span>从GitHub导入</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <input type="file" id="gal-asset-import-zip-input" accept=".zip" style="display: none;">
      <input type="file" id="gal-asset-import-input" multiple webkitdirectory style="display: none;">
      <input type="file" id="gal-asset-import-json-input" accept=".json" style="display: none;">
    </div>
    <div class="gal-tab-header">
      <button class="gal-tab-btn ${activeTab === 'sprites' ? 'active' : ''}" data-tab="sprites"><i class="fa-solid fa-user"></i> 立绘管理</button>
      <button class="gal-tab-btn ${activeTab === 'backgrounds' ? 'active' : ''}" data-tab="backgrounds"><i class="fa-solid fa-image"></i> 背景管理</button>
      <button class="gal-tab-btn ${activeTab === 'maps' ? 'active' : ''}" data-tab="maps"><i class="fa-solid fa-map-location-dot"></i> 地图管理</button>
      <button class="gal-tab-btn ${activeTab === 'skin' ? 'active' : ''}" data-tab="skin"><i class="fa-solid fa-palette"></i> 皮肤编辑</button>
      <button class="gal-tab-btn ${activeTab === 'imagegen' ? 'active' : ''}" data-tab="imagegen"><i class="fa-solid fa-wand-magic-sparkles"></i> 生图配置</button>
      <button class="gal-tab-btn ${activeTab === 'opening' ? 'active' : ''}" data-tab="opening"><i class="fa-solid fa-pen-to-square"></i> 开场白转换</button>
      <button class="gal-tab-btn ${activeTab === 'bgm' ? 'active' : ''}" data-tab="bgm"><i class="fa-solid fa-music"></i> 指定BGM</button>
      <button class="gal-tab-btn ${activeTab === 'custom' ? 'active' : ''}" data-tab="custom"><i class="fa-solid fa-code"></i> 自定义模块</button>
    </div>
    <div class="gal-tab-content">
      ${buildSpritesTab(activeTab, allSprites, charactersData)}
      ${buildBackgroundsTab(settings, allBackgrounds)}
      ${buildMapsTab(activeTab, unifiedMapRecord, legacyMapCount)}
      ${buildWesternSkinEditorTab(activeTab, currentPackId)}
      ${buildImagegenTab(activeTab, settings)}
      ${buildOpeningTab(activeTab)}
      ${buildBgmTab(activeTab, settings)}
      ${buildCustomTab(settings)}
    </div>
  `;

  return html;
}

// ============================================
// 绑定资源管理事件
// ============================================

export function bindAssetManagerContentEvents($modal, activeTab) {
  const settings = getSettings();

  // Tab 切换
  $modal.find('.gal-tab-btn').on('click', function () {
    const tab = $(this).data('tab');
    $modal.find('.gal-tab-btn').removeClass('active');
    $(this).addClass('active');
    $modal.find('.gal-tab-pane').hide();
    $modal.find(`.gal-tab-pane[data-pane="${tab}"]`).show();
  });

  // 自定义HTML保存
  $modal.find('#gal-save-custom-html').on('click', async function () {
    const locHtml = $('#gal-custom-location-html').val();
    const timeHtml = $('#gal-custom-time-html').val();
    const locationIconClass = normalizeLocationStatusIconClass($('#gal-custom-location-icon-class').val());
    const timeIconClass = normalizeTimeStatusIconClass($('#gal-custom-time-icon-class').val());
    localStorage.setItem(CUSTOM_LOCATION_HTML_KEY, locHtml);
    localStorage.setItem(CUSTOM_TIME_HTML_KEY, timeHtml);
    localStorage.setItem(CUSTOM_LOCATION_ICON_CLASS_KEY, locationIconClass);
    localStorage.setItem(CUSTOM_TIME_ICON_CLASS_KEY, timeIconClass);

    const $locationIcon = $('#gal-location-popup-trigger .gal-status-popup-icon');
    const $timeIcon = $('#gal-time-popup-trigger .gal-status-popup-icon');
    if ($locationIcon.length) {
      $locationIcon.attr('class', `gal-status-popup-icon ${locationIconClass}`);
    }
    if ($timeIcon.length) {
      $timeIcon.attr('class', `gal-status-popup-icon ${timeIconClass}`);
    }

    const injected = await injectCOTToWorldbook();
    if (injected) {
      showToast('自定义配置已保存，并已同步到世界书');
    } else {
      showToast('自定义配置已保存，但世界书同步失败', 'warning');
    }
  });

  // 图标可视化选择（地点/时间）
  $modal.find('.gal-custom-icon-option').on('click', function () {
    const $btn = $(this);
    const target = String($btn.attr('data-target') || '').trim();
    const rawValue = String($btn.attr('data-value') || '').trim();
    if (!target || !rawValue) return;

    const normalized =
      target === 'time' ? normalizeTimeStatusIconClass(rawValue) : normalizeLocationStatusIconClass(rawValue);
    const inputId = target === 'time' ? '#gal-custom-time-icon-class' : '#gal-custom-location-icon-class';

    $modal.find(inputId).val(normalized);
    $modal.find(`.gal-custom-icon-option[data-target="${target}"]`).removeClass('active');
    $modal.find(`.gal-custom-icon-option[data-target="${target}"][data-value="${normalized}"]`).addClass('active');
  });

  // 指定 BGM 歌单保存
  $modal.find('#gal-save-bgm-whitelist').on('click', async function () {
    const rawText = String($('#gal-custom-bgm-list').val() || '');
    const whitelist = Array.from(
      new Set(
        rawText
          .split(/\r?\n/)
          .map(name => String(name || '').trim())
          .filter(Boolean),
      ),
    );
    settings.bgmWhitelist = whitelist;
    saveSettings();
    const injected = await injectCOTToWorldbook();
    if (injected) {
      if (whitelist.length > 0) {
        showToast(`指定BGM歌单已保存（${whitelist.length} 首），并已同步到世界书`);
      } else {
        showToast('已清空指定BGM歌单，并已同步到世界书');
      }
    } else {
      showToast('指定BGM歌单已保存，但世界书同步失败', 'warning');
    }
  });

  // 生图配置事件
  bindImageGenConfigEvents($modal, settings);
  bindWesternSkinEditorEvents($modal);
  bindOpeningEvents($modal);

  bindSpriteEvents($modal, activeTab);
  bindBackgroundEvents($modal, activeTab);
  bindMapEvents($modal, activeTab);
  bindPackSelectorEvents($modal, activeTab);
  bindExportImportEvents($modal, activeTab);

  // 激活正确的 sub-tab
  activeTab = activeTab || 'sprites';
  if (activeTab !== 'sprites') {
    $modal.find('.gal-tab-btn').removeClass('active');
    $modal.find(`.gal-tab-btn[data-tab="${activeTab}"]`).addClass('active');
    $modal.find('.gal-tab-pane').hide();
    $modal.find(`.gal-tab-pane[data-pane="${activeTab}"]`).show();
  }
}

// ============================================
// Tab 内容构建
// ============================================

function buildSpritesTab(activeTab, allSprites, charactersData) {
  return `
  <div class="gal-tab-pane ${activeTab === 'sprites' ? 'active' : ''}" data-pane="sprites" style="${activeTab !== 'sprites' ? 'display: none;' : ''}">
    <div class="gal-pane-header">
      <span class="gal-pane-stat">已保存 ${allSprites.length} 个立绘，共 ${charactersData.size} 个角色</span>
      <div class="gal-pane-actions">
        <button class="gal-action-btn gal-pane-btn purple" id="gal-batch-upload-btn"><i class="fa-solid fa-cloud-arrow-up"></i> <span>批量上传</span></button>
        <button class="gal-action-btn gal-pane-btn primary" id="gal-add-sprite-btn"><i class="fa-solid fa-plus"></i> <span>添加立绘</span></button>
        <button class="gal-action-btn gal-pane-btn teal" id="gal-manage-expressions-btn"><i class="fa-solid fa-face-smile"></i> <span>表情标签</span></button>
      </div>
    </div>
    ${
      charactersData.size === 0
        ? `<div style="text-align: center; padding: 40px; color: #999;"><i class="fa-solid fa-images" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i><p>暂无角色数据，请确保已加载数据库脚本或点击上方按钮添加</p></div>`
        : `<div class="gal-character-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 15px;">
          ${Array.from(charactersData.entries())
            .map(([charId, info]) => {
              const sprites = info.sprites;
              const defaultSprite = sprites.find(s => s.expression === '默认') || sprites[0];
              const avatarUrl = defaultSprite?.imageUrl
                ? defaultSprite.imageUrl
                : defaultSprite?.imageBlob
                  ? URL.createObjectURL(defaultSprite.imageBlob)
                  : '';
              const typeLabel =
                info.type && info.type !== '自定义'
                  ? `<span style="font-size: 0.7rem; background: ${THEME.accent}; color: ${THEME.dark}; padding: 1px 4px; border-radius: 3px; margin-left: 4px;">${info.type}</span>`
                  : '';
              return `
            <div class="gal-character-card" data-char="${charId}" style="cursor: pointer; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: all 0.2s; position: relative;">
              <div class="gal-character-avatar" style="aspect-ratio: 1 / 1; background: #f0f0f0; overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative;">
                ${avatarUrl ? `<img src="${avatarUrl}" alt="${charId}" style="width: 100%; height: 100%; object-fit: cover; object-position: top center;">` : `<i class="fa-solid fa-user" style="font-size: 3rem; color: #ccc;"></i>`}
                ${sprites.length === 0 ? '<div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.5); color: #fff; font-size: 0.7rem; padding: 2px; text-align: center;">无立绘</div>' : ''}
                <div class="gal-char-actions" style="position: absolute; top: 5px; right: 5px; display: flex; gap: 5px; opacity: 0; transition: opacity 0.2s;">
                  <button class="gal-char-transfer" data-char="${charId}" title="转移到其他图包" style="width: 28px; height: 28px; border-radius: 50%; border: none; background: rgba(111, 66, 193, 0.9); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px;"><i class="fa-solid fa-arrow-right-arrow-left"></i></button>
                  <button class="gal-char-delete" data-char="${charId}" title="删除角色" style="width: 28px; height: 28px; border-radius: 50%; border: none; background: rgba(220, 53, 69, 0.9); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px;"><i class="fa-solid fa-trash"></i></button>
                </div>
              </div>
              <div style="padding: 10px; text-align: center;">
                <div style="font-weight: 700; color: ${THEME.dark}; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; justify-content: center; align-items: center;">${charId}</div>
                <div style="margin-top: 4px; display: flex; justify-content: center; align-items: center; gap: 4px;">${typeLabel}<span style="font-size: 0.75rem; color: #888;">${sprites.length} 个表情</span></div>
              </div>
            </div>`;
            })
            .join('')}
        </div>`
    }
  </div>`;
}

function buildBackgroundsTab(settings, allBackgrounds) {
  return `
  <div class="gal-tab-pane" data-pane="backgrounds" style="display: none;">
    <div class="gal-pane-header">
      <span class="gal-pane-stat">已保存 ${allBackgrounds.length} 个背景</span>
      <div class="gal-pane-actions">
        <button class="gal-action-btn gal-pane-btn purple" id="gal-batch-bg-upload-btn"><i class="fa-solid fa-cloud-arrow-up"></i> <span>批量上传</span></button>
        <button class="gal-action-btn gal-pane-btn primary" id="gal-add-bg-btn"><i class="fa-solid fa-plus"></i> <span>添加背景</span></button>
      </div>
    </div>
    ${
      allBackgrounds.length === 0
        ? `<div style="text-align: center; padding: 40px; color: #999;"><i class="fa-solid fa-panorama" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i><p>暂无背景，点击上方按钮添加</p><small style="color: #bbb;">背景图将根据 &lt;background scene="场景名" /&gt; 标签自动匹配</small></div>`
        : `<div class="gal-bg-grid">${allBackgrounds
            .map(
              bg => `
          <div class="gal-bg-card" data-scene="${bg.sceneName}">
            <div class="gal-bg-preview">${bg.imageUrl ? `<img src="${bg.imageUrl}" alt="${bg.sceneName}">` : bg.imageBlob ? `<img src="${URL.createObjectURL(bg.imageBlob)}" alt="${bg.sceneName}">` : ''}</div>
            <div class="gal-bg-label">${bg.sceneName}</div>
            <div class="gal-bg-actions" style="position: absolute; top: 5px; right: 5px; display: flex; gap: 4px;">
              <button class="gal-bg-transfer" data-scene="${bg.sceneName}" title="转移到其他图包" style="width: 28px; height: 28px; border-radius: 50%; background: rgba(111, 66, 193, 0.9); color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;"><i class="fa-solid fa-arrow-right-arrow-left"></i></button>
              <button class="gal-bg-delete" data-scene="${bg.sceneName}" title="删除" style="width: 28px; height: 28px; border-radius: 50%; background: rgba(220, 53, 69, 0.9); color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>`,
            )
            .join('')}</div>`
    }
  </div>`;
}

function buildMapsTab(activeTab, unifiedMapRecord, legacyMapCount = 0) {
  const hasMap = !!unifiedMapRecord;
  const recordRegionKey = hasMap
    ? (String(unifiedMapRecord.regionKey || '').trim() || GLOBAL_MAP_REGION_KEY)
    : GLOBAL_MAP_REGION_KEY;
  const sourceType = hasMap
    ? (unifiedMapRecord.imageBlob ? '本地图片' : (unifiedMapRecord.imageUrl ? '远程链接' : '未知来源'))
    : '未设置';
  const thumbUrl = hasMap
    ? (unifiedMapRecord.imageUrl
      ? unifiedMapRecord.imageUrl
      : (unifiedMapRecord.imageBlob ? URL.createObjectURL(unifiedMapRecord.imageBlob) : ''))
    : '';
  const modifiedText = hasMap && unifiedMapRecord.lastModified
    ? new Date(unifiedMapRecord.lastModified).toLocaleString()
    : '未知';
  const isLegacyFallback = hasMap && recordRegionKey !== GLOBAL_MAP_REGION_KEY;

  return `
  <div class="gal-tab-pane" data-pane="maps" style="${activeTab !== 'maps' ? 'display: none;' : ''}">
    <div class="gal-pane-header">
      <span class="gal-pane-stat">统一世界地图</span>
      <div class="gal-pane-actions">
        <button class="gal-action-btn gal-pane-btn primary" id="gal-add-map-btn"><i class="fa-solid fa-plus"></i> <span>上传地图</span></button>
      </div>
    </div>
    ${
      !hasMap
        ? `<div style="text-align: center; padding: 40px; color: #999;"><i class="fa-solid fa-map-location-dot" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i><p>尚未上传统一世界地图</p><small style="color: #bbb;">地图系统将使用一张统一大地图，不再按场景分别上传</small></div>`
        : `<div class="gal-map-grid">
            <div class="gal-map-card" data-region="${recordRegionKey}" data-pack-id="${unifiedMapRecord.packId || DEFAULT_PACK_ID}">
              <div class="gal-map-card-preview">
                ${thumbUrl ? `<img src="${thumbUrl}" alt="统一世界地图">` : `<i class="fa-solid fa-image"></i>`}
              </div>
              <div class="gal-map-card-body">
                <div class="gal-map-card-title">统一世界地图</div>
                <div class="gal-map-card-meta">
                  <span><i class="fa-solid fa-link"></i> ${sourceType}</span>
                  <span><i class="fa-solid fa-clock"></i> ${modifiedText}</span>
                  ${isLegacyFallback ? `<span style="color:#b45309;"><i class="fa-solid fa-triangle-exclamation"></i> 兼容读取旧记录：${recordRegionKey}</span>` : ''}
                  ${legacyMapCount > 0 ? `<span style="color:#b45309;"><i class="fa-solid fa-layer-group"></i> 检测到 ${legacyMapCount} 条旧分区地图记录</span>` : ''}
                </div>
              </div>
              <div class="gal-map-card-actions">
                <button class="gal-map-open-btn" data-region="${recordRegionKey}" title="打开地图"><i class="fa-solid fa-compass"></i></button>
                <button class="gal-map-delete-btn" data-region="${recordRegionKey}" data-pack-id="${unifiedMapRecord.packId || DEFAULT_PACK_ID}" title="删除地图"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          </div>`
    }
  </div>`;
}

function buildImagegenTab(activeTab, settings) {
  return `
  <div class="gal-tab-pane" data-pane="imagegen" style="${activeTab !== 'imagegen' ? 'display: none;' : ''}">
    ${buildImageGenConfigPane(settings)}
  </div>`;
}

function buildOpeningTab(activeTab) {
  return `
  <div class="gal-tab-pane" data-pane="opening" style="${activeTab !== 'opening' ? 'display: none;' : ''}">
    <div class="gal-opening-layout">
      <div class="gal-opening-column">
        <div class="gal-opening-title">
          <i class="fa-solid fa-file-lines" style="color: ${THEME.accentSub};"></i> 原文输入
        </div>
        <textarea
          id="gal-opening-source"
          class="gal-opening-textarea"
          placeholder="在这里粘贴或输入开场白原文..."
        ></textarea>
      </div>
      <div class="gal-opening-column">
        <div class="gal-opening-title">
          <i class="fa-solid fa-wand-magic-sparkles" style="color: ${THEME.accent};"></i> COT 转换结果
        </div>
        <textarea
          id="gal-opening-result"
          class="gal-opening-textarea"
          placeholder="点击“转换”后将在这里显示 COT 格式结果（可手动微调）..."
        ></textarea>
      </div>
    </div>
    <div class="gal-opening-actions">
      <button class="gal-action-btn gal-pane-btn primary" id="gal-opening-convert-btn">
        <i class="fa-solid fa-arrows-rotate"></i> <span>转换</span>
      </button>
      <button class="gal-action-btn gal-pane-btn teal" id="gal-opening-copy-btn">
        <i class="fa-solid fa-copy"></i> <span>复制结果</span>
      </button>
      <button class="gal-action-btn gal-pane-btn purple" id="gal-opening-write-btn">
        <i class="fa-solid fa-pen-to-square"></i> <span>写入开场白</span>
      </button>
    </div>
    <div class="gal-opening-hint">
      <strong><i class="fa-solid fa-circle-info"></i> 说明：</strong>
      仅做格式转换，不会改写剧情；点击“写入开场白”后会覆盖当前角色卡首条开场白，其余条目保留。
    </div>
  </div>`;
}

function buildBgmTab(activeTab, settings) {
  const bgmWhitelist = Array.from(
    new Set(
      (Array.isArray(settings.bgmWhitelist) ? settings.bgmWhitelist : [])
        .map(name => String(name || '').trim())
        .filter(Boolean),
    ),
  );
  const bgmText = bgmWhitelist.join('\n');

  return `
  <div class="gal-tab-pane" data-pane="bgm" style="${activeTab !== 'bgm' ? 'display: none;' : ''}">
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px dashed #ddd; margin-bottom: 20px;">
      <div style="margin-bottom: 15px;">
        <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};">
          <i class="fa-solid fa-music" style="color: ${THEME.accent};"></i> 指定BGM歌单（注入到COT规则）
        </label>
        <textarea
          id="gal-custom-bgm-list"
          placeholder="每行填写一首歌曲名，例如：&#10;夜に駆ける&#10;unravel&#10;打上花火"
          style="width: 100%; height: 220px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 0.9rem; color: #333; resize: vertical;"
        >${bgmText}</textarea>
      </div>
      <div style="text-align: right;">
        <button class="gal-action-btn primary" id="gal-save-bgm-whitelist" style="padding: 8px 20px;">
          <i class="fa-solid fa-save"></i> 保存歌单
        </button>
      </div>
    </div>
    <div style="padding: 15px; color: #666; font-size: 0.9rem; line-height: 1.7;">
      <strong><i class="fa-solid fa-lightbulb"></i> 说明：</strong><br>
      1. 每行一首歌，保存后会更新 COT：模型只能从该歌单中输出 <code>&lt;bgm&gt;</code>。<br>
      2. 留空并保存则取消限制，恢复原有通用 BGM 规则。<br>
      3. 建议填写你确认可搜索到的曲名（尽量完整、标准）。
    </div>
  </div>`;
}

function buildCustomTab(settings) {
  const locationIconClass = normalizeLocationStatusIconClass(
    localStorage.getItem(CUSTOM_LOCATION_ICON_CLASS_KEY) || '',
  );
  const timeIconClass = normalizeTimeStatusIconClass(localStorage.getItem(CUSTOM_TIME_ICON_CLASS_KEY) || '');
  const locationIconOptionsHtml = LOCATION_STATUS_ICON_OPTIONS.map(
    option =>
      `<button type="button" class="gal-custom-icon-option ${option.value === locationIconClass ? 'active' : ''}" data-target="location" data-value="${option.value}" title="${option.label}">
      <i class="${option.value}"></i>
      <span>${option.label}</span>
    </button>`,
  ).join('');
  const timeIconOptionsHtml = TIME_STATUS_ICON_OPTIONS.map(
    option =>
      `<button type="button" class="gal-custom-icon-option ${option.value === timeIconClass ? 'active' : ''}" data-target="time" data-value="${option.value}" title="${option.label}">
      <i class="${option.value}"></i>
      <span>${option.label}</span>
    </button>`,
  ).join('');

  return `
  <div class="gal-tab-pane" data-pane="custom" style="display: none;">
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px dashed #ddd; margin-bottom: 20px;">
      <div style="margin-bottom: 15px;"><label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};"><i class="fa-solid fa-location-dot" style="color: ${THEME.accent};"></i> 自定义弹窗一内容 - 自定义内容格式要求（注入到世界书）</label><textarea id="gal-custom-location-html" placeholder="<div>自定义地点介绍...</div>" style="width: 100%; height: 120px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 0.9rem; color: #333; resize: vertical;">${localStorage.getItem(CUSTOM_LOCATION_HTML_KEY) || ''}</textarea></div>
      <div style="margin-bottom: 15px;"><label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};"><i class="fa-solid fa-clock" style="color: ${THEME.accentSub};"></i> 自定义弹窗二内容 - 自定义内容格式要求（注入到世界书）</label><textarea id="gal-custom-time-html" placeholder="<div>自定义时间介绍...</div>" style="width: 100%; height: 120px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 0.9rem; color: #333; resize: vertical;">${localStorage.getItem(CUSTOM_TIME_HTML_KEY) || ''}</textarea></div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px;">
        <div>
          <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};"><i class="fa-solid fa-location-dot" style="color: ${THEME.accent};"></i> 弹窗一图标</label>
          <input id="gal-custom-location-icon-class" type="hidden" value="${locationIconClass}">
          <div class="gal-custom-icon-grid">
            ${locationIconOptionsHtml}
          </div>
        </div>
        <div>
          <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};"><i class="fa-solid fa-clock" style="color: ${THEME.accentSub};"></i> 弹窗二图标</label>
          <input id="gal-custom-time-icon-class" type="hidden" value="${timeIconClass}">
          <div class="gal-custom-icon-grid">
            ${timeIconOptionsHtml}
          </div>
        </div>
      </div>
      <div style="text-align: right;"><button class="gal-action-btn primary" id="gal-save-custom-html" style="padding: 8px 20px;"><i class="fa-solid fa-save"></i> 保存配置</button></div>
    </div>
    <div style="padding: 15px; color: #666; font-size: 0.9rem; line-height: 1.7;"><strong><i class="fa-solid fa-lightbulb"></i> 说明：</strong><br>1. 保存后，若填写了内容，会自动同步到世界书并注入兼容标签：<br><code>&lt;弹窗一&gt;...&lt;/弹窗一&gt;</code><br><code>&lt;弹窗二&gt;...&lt;/弹窗二&gt;</code><br>2. 右侧图标弹窗只读取当前消息中的标签内容，不再直接显示这里输入的备用内容。<br>3. 支持标准 HTML 和内联样式，建议保持简洁，不要放脚本标签。</div>
  </div>`;
}

export function buildAssetManagerStyles() {
  return `
    .gal-tab-btn { padding: 12px 20px; border: none; background: transparent; font-size: 1rem; font-weight: 600; color: #666; cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -2px; transition: all 0.2s; }
    .gal-tab-btn:hover { color: ${THEME.accent}; }
    .gal-tab-btn.active { color: ${THEME.accent}; border-bottom-color: ${THEME.accent}; }
    .gal-character-card:hover { transform: translateY(-3px); box-shadow: 0 6px 16px rgba(0,0,0,0.15); }
    .gal-character-card:hover .gal-char-actions { opacity: 1 !important; }
    @media (max-width: 768px), (pointer: coarse) { .gal-char-actions { opacity: 1 !important; } }
    .gal-sprite-group { margin-bottom: 20px; background: #f8f9fa; border-radius: 8px; padding: 15px; }
    .gal-sprite-group-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .gal-char-name { font-weight: 700; font-size: 1.1rem; color: ${THEME.dark}; }
    .gal-sprite-count { font-size: 0.85rem; color: #888; }
    .gal-sprite-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 12px; }
    .gal-sprite-card { position: relative; background: #fff; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.1); transition: transform 0.2s; }
    .gal-sprite-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .gal-sprite-preview { aspect-ratio: 2 / 3; background: #eee; overflow: hidden; }
    .gal-sprite-preview img { width: 100%; height: 100%; object-fit: cover; }
    .gal-sprite-label { padding: 6px; text-align: center; font-size: 0.75rem; font-weight: 600; color: ${THEME.dark}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .gal-sprite-delete { position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; border: none; border-radius: 50%; background: rgba(255,0,85,0.9); color: #fff; font-size: 0.7rem; cursor: pointer; opacity: 0; transition: opacity 0.2s; }
    .gal-sprite-card:hover .gal-sprite-delete { opacity: 1; }
    .gal-bg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 15px; }
    .gal-bg-card { position: relative; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s; cursor: pointer; }
    .gal-bg-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
    .gal-bg-preview { aspect-ratio: 16 / 9; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); overflow: hidden; }
    .gal-bg-preview img { width: 100%; height: 100%; object-fit: cover; }
    .gal-bg-label { padding: 10px; text-align: center; font-size: 0.9rem; font-weight: 600; color: ${THEME.dark}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .gal-bg-actions { opacity: 0; transition: opacity 0.2s; }
    .gal-bg-card:hover .gal-bg-actions { opacity: 1; }
    .gal-map-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
    .gal-map-card { position: relative; border: 1px solid #dbe2ea; border-radius: 10px; overflow: hidden; background: #fff; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08); transition: all 0.2s; cursor: pointer; }
    .gal-map-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(15, 23, 42, 0.15); }
    .gal-map-card-preview { aspect-ratio: 16 / 9; background: linear-gradient(135deg, #0f172a, #1e293b); display: flex; align-items: center; justify-content: center; overflow: hidden; color: #94a3b8; font-size: 1.8rem; }
    .gal-map-card-preview img { width: 100%; height: 100%; object-fit: cover; }
    .gal-map-card-body { padding: 10px; }
    .gal-map-card-title { font-size: 0.92rem; font-weight: 700; color: #0f172a; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .gal-map-card-meta { display: flex; flex-direction: column; gap: 4px; font-size: 0.76rem; color: #64748b; }
    .gal-map-card-meta span { display: inline-flex; align-items: center; gap: 6px; }
    .gal-map-card-actions { position: absolute; top: 6px; right: 6px; display: flex; gap: 6px; opacity: 0; transition: opacity 0.2s; }
    .gal-map-card:hover .gal-map-card-actions { opacity: 1; }
    .gal-map-open-btn, .gal-map-delete-btn { width: 30px; height: 30px; border: none; border-radius: 50%; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: #fff; }
    .gal-map-open-btn { background: rgba(14, 165, 233, 0.95); }
    .gal-map-delete-btn { background: rgba(220, 53, 69, 0.95); }
    .gal-import-dropdown { position: relative; display: inline-block; }
    .gal-import-menu { animation: galDropdownFadeIn 0.15s ease; }
    @keyframes galDropdownFadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
    .gal-import-item:hover { background: #f0f7ff !important; }
    .gal-import-item:active { background: #e0efff !important; }
    .gal-import-progress-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; }
    .gal-import-progress-box { background: #2b2e38; padding: 30px 50px; border-radius: 12px; text-align: center; min-width: 300px; }
    .gal-import-progress-title { font-size: 1.2rem; font-weight: 700; margin-bottom: 15px; color: #00d2ff; }
    .gal-import-progress-bar-container { width: 100%; height: 8px; background: #444; border-radius: 4px; overflow: hidden; margin-bottom: 10px; }
    .gal-import-progress-bar { height: 100%; background: linear-gradient(90deg, #00d2ff, #00a8cc); width: 0%; transition: width 0.3s ease; }
    .gal-import-progress-text { font-size: 0.9rem; color: #aaa; }
    .gal-import-progress-details { font-size: 0.8rem; color: #888; margin-top: 8px; max-height: 60px; overflow-y: auto; }
    .gal-pane-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
    .gal-pane-stat { font-weight: 700; color: ${THEME.dark}; }
    .gal-pane-actions { display: flex; gap: 10px; align-items: center; }
    .gal-pane-btn { padding: 8px 16px !important; transform: none !important; box-shadow: none !important; border-radius: 6px !important; font-size: 0.85rem !important; border: none !important; }
    .gal-pane-btn * { transform: none !important; }
    .gal-pane-btn.purple { background: #6f42c1; color: #fff; }
    .gal-pane-btn.purple:hover { background: #5a32a3; color: #fff; }
    .gal-pane-btn.teal { background: #17a2b8; color: #fff; }
    .gal-pane-btn.teal:hover { background: #138496; color: #fff; }
    .gal-pane-btn.primary { background: ${THEME.accent}; color: ${THEME.dark}; }
    .gal-pane-btn.primary:hover { background: #00a8cc; color: #fff; }
    #gal-unified-panel .gal-opening-layout { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
    #gal-unified-panel .gal-opening-column { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px; min-height: 360px; }
    #gal-unified-panel .gal-opening-title { font-size: 0.92rem; font-weight: 700; color: ${THEME.dark}; display: flex; align-items: center; gap: 6px; }
    #gal-unified-panel .gal-opening-textarea { width: 100%; min-height: 300px; resize: vertical; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; font-family: monospace; font-size: 0.86rem; line-height: 1.55; color: #1f2937; background: #ffffff; caret-color: #1f2937; }
    #gal-unified-panel .gal-opening-textarea::placeholder { color: #9ca3af; opacity: 1; }
    #gal-unified-panel .gal-opening-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; margin-bottom: 10px; }
    #gal-unified-panel .gal-opening-actions .gal-pane-btn { min-width: 140px; justify-content: center; }
    #gal-unified-panel .gal-opening-hint { padding: 10px 12px; border-radius: 8px; border: 1px solid #e5e7eb; background: #f8fafc; color: #475569; font-size: 0.82rem; line-height: 1.6; }
    #gal-unified-panel .gal-opening-hint i { color: #0ea5e9; }
    .gal-imagegen-pills { display:flex; gap:8px; padding:12px 0; flex-wrap:wrap; }
    .gal-pill { padding:8px 18px; border:2px solid rgba(0,0,0,0.15); background:rgba(0,0,0,0.05); border-radius:20px; cursor:pointer; font-size:0.85rem; font-weight:600; color:rgba(0,0,0,0.6); transition:all 0.2s; display:flex; align-items:center; gap:6px; }
    .gal-pill:hover { border-color:${THEME.accent}; color:${THEME.accent}; }
    .gal-pill.active { background:linear-gradient(135deg,${THEME.accent},#00a8cc); color:#fff; border-color:transparent; }
    .gal-western-editor-layout { display: grid; grid-template-columns: 220px minmax(280px, 1fr) minmax(360px, 1.1fr); gap: 12px; min-height: 520px; }
    .gal-western-device-switch { display: inline-flex; align-items: center; gap: 0; border: 1px solid #cbd5e1; border-radius: 999px; overflow: hidden; margin-bottom: 10px; }
    .gal-western-device-tab { border: none; background: #f8fafc; color: #475569; font-size: 0.85rem; font-weight: 700; padding: 6px 14px; cursor: pointer; transition: all 0.15s ease; }
    .gal-western-device-tab + .gal-western-device-tab { border-left: 1px solid #cbd5e1; }
    .gal-western-device-tab.active { background: #0ea5e9; color: #fff; }
    .gal-western-device-tab:hover { filter: brightness(0.96); }
    .gal-western-editor-col { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
    .gal-western-editor-title { font-weight: 700; color: ${THEME.dark}; font-size: 0.95rem; display: flex; align-items: center; gap: 8px; }
    .gal-western-editor-hint { font-size: 0.82rem; color: #6b7280; min-height: 1.2rem; }
    .gal-western-editor-hint.ok { color: #047857; }
    .gal-western-editor-hint.warn { color: #b45309; }
    .gal-western-editor-hint.err { color: #b91c1c; }
    .gal-western-elements-list { display: flex; flex-direction: column; gap: 8px; max-height: 600px; overflow: auto; padding-right: 2px; }
    .gal-western-element-item { border: 1px solid #d1d5db; border-radius: 8px; background: #f8fafc; padding: 8px 10px; cursor: pointer; text-align: left; display: flex; flex-direction: column; gap: 2px; }
    .gal-western-element-item.active { border-color: ${THEME.accent}; box-shadow: 0 0 0 2px rgba(0, 210, 255, 0.15); background: #ecfeff; }
    .gal-western-element-label { font-weight: 700; color: #111827; font-size: 0.88rem; }
    .gal-western-element-id { color: #6b7280; font-family: monospace; font-size: 0.72rem; }
    .gal-western-crop-wrapper { width: 100%; aspect-ratio: 16 / 9; background: #111827; border-radius: 8px; overflow: hidden; border: 1px solid #1f2937; cursor: move; display: flex; align-items: center; justify-content: center; }
    .gal-western-crop-wrapper canvas { width: 100%; height: 100%; display: block; }
    .gal-western-preview-actions { display: flex; gap: 8px; }
    .gal-western-zoom-row { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #374151; }
    .gal-western-zoom-row input[type="range"] { flex: 1; }
    .gal-western-check-row { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; color: #374151; }
    .gal-western-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .gal-western-form-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; color: #374151; }
    .gal-western-form-grid label span { font-weight: 600; }
    .gal-western-form-grid input,
    .gal-western-form-grid select { padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; color: #111827; background: #fff; }
    .gal-western-field-wide { grid-column: 1 / -1; }
    .gal-western-subtitle { margin-top: 4px; font-size: 0.82rem; font-weight: 700; color: #374151; }
    .gal-western-four-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .gal-western-form-actions { margin-top: auto; display: flex; gap: 8px; flex-wrap: wrap; }
    .gal-western-form-actions .gal-pane-btn { flex: 1; min-width: 120px; }
    @media (max-width: 1180px) {
      .gal-western-editor-layout { grid-template-columns: 1fr; }
      .gal-western-editor-col { min-height: auto; }
    }
    #gal-unified-panel #gal-custom-bgm-list,
    #gal-unified-panel #gal-custom-location-html,
    #gal-unified-panel #gal-custom-time-html {
      background: #ffffff !important;
      color: #1f2937 !important;
      border: 1px solid #cbd5e1 !important;
      caret-color: #1f2937 !important;
      line-height: 1.5 !important;
    }
    #gal-unified-panel #gal-custom-bgm-list::placeholder,
    #gal-unified-panel #gal-custom-location-html::placeholder,
    #gal-unified-panel #gal-custom-time-html::placeholder {
      color: #9ca3af !important;
      opacity: 1 !important;
    }
    #gal-unified-panel .gal-custom-icon-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 8px;
      max-height: 260px;
      overflow-y: auto;
      padding: 8px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
    }
    #gal-unified-panel .gal-custom-icon-option {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 36px;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid #d1d5db;
      background: #f8fafc;
      color: #374151;
      cursor: pointer;
      font-size: 0.82rem;
      text-align: left;
      transition: all 0.15s ease;
    }
    #gal-unified-panel .gal-custom-icon-option i {
      width: 18px;
      text-align: center;
      color: #111827;
      flex-shrink: 0;
    }
    #gal-unified-panel .gal-custom-icon-option span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #gal-unified-panel .gal-custom-icon-option:hover {
      border-color: #93c5fd;
      background: #eff6ff;
      color: #1e3a8a;
    }
    #gal-unified-panel .gal-custom-icon-option.active {
      border-color: ${THEME.accent};
      background: linear-gradient(135deg, #ecfeff, #e0f2fe);
      color: #0f172a;
      box-shadow: 0 0 0 2px rgba(0, 210, 255, 0.2);
    }
    @media (max-width: 768px) {
      #gal-unified-panel .gal-tab-header {
        overflow-x: auto !important;
        overflow-y: hidden !important;
        flex-wrap: nowrap !important;
        justify-content: flex-start !important;
        gap: 6px !important;
        -webkit-overflow-scrolling: touch;
      }
      #gal-unified-panel .gal-tab-btn {
        flex: 0 0 auto !important;
        min-width: 102px !important;
      }
      #gal-unified-panel .gal-opening-layout { grid-template-columns: 1fr; }
      #gal-unified-panel .gal-opening-column { min-height: 220px; }
      #gal-unified-panel .gal-opening-textarea { min-height: 180px; }
      #gal-unified-panel .gal-opening-actions .gal-pane-btn { flex: 1 1 100%; min-width: 0; }
      #gal-unified-panel .gal-custom-icon-grid {
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
        max-height: 220px;
      }
    }
  `;
}

// ============================================
// 事件绑定 (内部)
// ============================================

function bindOpeningEvents($modal) {
  const $source = $modal.find('#gal-opening-source');
  const $result = $modal.find('#gal-opening-result');
  const $convertBtn = $modal.find('#gal-opening-convert-btn');
  const $copyBtn = $modal.find('#gal-opening-copy-btn');
  const $writeBtn = $modal.find('#gal-opening-write-btn');
  if (!$source.length || !$result.length) return;

  let converting = false;

  const updateConvertButton = (busy) => {
    $convertBtn.prop('disabled', busy);
    if (busy) {
      $convertBtn.html('<i class="fa-solid fa-spinner fa-spin"></i> <span>转换中...</span>');
    } else {
      $convertBtn.html('<i class="fa-solid fa-arrows-rotate"></i> <span>转换</span>');
    }
  };

  const fallbackCopyText = (text) => {
    const doc = topWindow.document;
    const textarea = doc.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    doc.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = doc.execCommand('copy');
    doc.body.removeChild(textarea);
    return copied;
  };

  $convertBtn.on('click', async function () {
    if (converting) return;
    const sourceText = String($source.val() || '').trim();
    if (!sourceText) {
      showToast('请输入要转换的开场白原文');
      return;
    }

    converting = true;
    updateConvertButton(true);
    const previousResult = String($result.val() || '');
    try {
      const { formattedText } = await convertTextToCotFormat(sourceText, {
        onStream: text => {
          $result.val(text || '');
        },
      });
      $result.val(formattedText || '');
      showToast('开场白转换完成');
    } catch (e) {
      $result.val(previousResult);
      showToast(`转换失败: ${e?.message || e}`);
    } finally {
      converting = false;
      updateConvertButton(false);
    }
  });

  $copyBtn.on('click', async function () {
    const resultText = String($result.val() || '').trim();
    if (!resultText) {
      showToast('暂无可复制的转换结果');
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(resultText);
      } else {
        const copied = fallbackCopyText(resultText);
        if (!copied) throw new Error('复制失败');
      }
      showToast('已复制转换结果');
    } catch (e) {
      showToast(`复制失败: ${e?.message || e}`);
    }
  });

  $writeBtn.on('click', async function () {
    const resultText = String($result.val() || '').trim();
    if (!resultText) {
      showToast('请先完成转换并确认结果');
      return;
    }
    if (typeof updateCharacterWith !== 'function') {
      showToast('当前环境不支持写入角色卡开场白');
      return;
    }

    const confirmed = await showInAppConfirmDialog({
      title: '确认写入开场白',
      message: '将把当前转换结果写入当前角色卡首条开场白。',
      hint: '仅覆盖第一条开场白，其余开场白保留不变。',
      iconClass: 'fa-solid fa-pen-to-square',
      accent: '#0d6efd',
      confirmText: '确认写入',
      cancelText: '取消',
    });
    if (!confirmed) return;

    try {
      await updateCharacterWith('current', character => {
        const next = character && typeof character === 'object' ? character : {};
        const firstMessages = Array.isArray(next.first_messages) ? [...next.first_messages] : [];
        if (firstMessages.length === 0) {
          firstMessages.push(resultText);
        } else {
          firstMessages[0] = resultText;
        }
        next.first_messages = firstMessages;
        return next;
      });
      showToast('已写入当前角色卡首条开场白');
    } catch (e) {
      showToast(`写入失败: ${e?.message || e}`);
    }
  });
}

function bindSpriteEvents($modal, activeTab) {
  $modal.find('#gal-batch-upload-btn').on('click', () => {
    $modal.remove();
    if (_showBatchUploadDialogRef) _showBatchUploadDialogRef(null, () => showAssetManagerModal('sprites'));
  });
  $modal.find('#gal-manage-expressions-btn').on('click', () => {
    $modal.remove();
    if (_showCustomExpressionManagerRef) _showCustomExpressionManagerRef(() => showAssetManagerModal('sprites'));
  });
  $modal.find('#gal-add-sprite-btn').on('click', async () => {
    $modal.remove();
    if (_showSpriteUploadDialogRef)
      await _showSpriteUploadDialogRef('', '默认', () => showAssetManagerModal('sprites'));
  });
  $modal.find('.gal-character-card').on('click', function (e) {
    if ($(e.target).closest('.gal-char-actions').length) return;
    const charId = $(this).data('char');
    showCharacterSpritesModal(charId);
  });
  $modal
    .find('.gal-character-card')
    .on('mouseenter', function () {
      $(this).find('.gal-char-actions').css('opacity', '1');
    })
    .on('mouseleave', function () {
      $(this).find('.gal-char-actions').css('opacity', '0');
    });
  $modal.find('.gal-char-transfer').on('click', async function (e) {
    e.stopPropagation();
    const charId = $(this).data('char');
    const allSpritesAll = await getAllSprites(null, true);
    const charSprites = allSpritesAll.filter(s => s.characterId === charId);
    if (charSprites.length === 0) {
      showToast('该角色没有立绘可转移', 'warning');
      return;
    }
    const spriteKeys = charSprites.map(s => `${s.characterId}_${s.expression}`);
    showTransferDialog('sprite', spriteKeys, () => {
      $modal.remove();
      showAssetManagerModal('sprites');
    });
  });
  $modal.find('.gal-char-delete').on('click', async function (e) {
    e.stopPropagation();
    const charId = $(this).data('char');
    const allSpritesAll = await getAllSprites(null, true);
    const charSprites = allSpritesAll.filter(s => s.characterId === charId);
    if (charSprites.length === 0) {
      showToast('该角色没有立绘', 'warning');
      return;
    }
    if (confirm(`确定删除角色「${charId}」的所有 ${charSprites.length} 个立绘吗？此操作不可恢复！`)) {
      for (const sprite of charSprites) await deleteSprite(sprite.characterId, sprite.expression);
      showToast(`已删除角色「${charId}」的 ${charSprites.length} 个立绘`);
      if (getIsEnabled()) injectCOTToWorldbook().catch(e => console.warn(`[${SCRIPT_NAME}] 更新世界书失败:`, e));
      $modal.remove();
      showAssetManagerModal('sprites');
    }
  });
}

function bindBackgroundEvents($modal, activeTab) {
  // 点击背景卡片查看大图（事件委托）
  $modal.on('click', '.gal-bg-card', function (e) {
    if ($(e.target).closest('.gal-bg-actions').length) return;
    const $img = $(this).find('.gal-bg-preview img');
    if (!$img.length) return;
    const src = $img.attr('src');
    const scene = $(this).data('scene');
    // 全屏时 contain:layout 会困住 position:fixed，需用 absolute 替代
    const mountRoot = getModalMountRoot();
    const isFullscreen = mountRoot !== topWindow.document.body;
    const posStyle = isFullscreen
      ? 'position:absolute;top:0;left:0;width:100%;height:100%;'
      : 'position:fixed;top:0;left:0;width:100vw;height:100vh;';
    const $lightbox =
      $(`<div style="${posStyle}background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:100003;cursor:zoom-out;flex-direction:column;gap:12px;">
      <img src="${src}" style="max-width:90vw;max-height:85vh;object-fit:contain;border-radius:8px;box-shadow:0 4px 30px rgba(0,0,0,0.5);">
      <span style="color:#ccc;font-size:0.9rem;">${scene}</span>
    </div>`);
    $lightbox.on('click', function () {
      $(this).remove();
    });
    $(mountRoot).append($lightbox);
  });
  $modal.find('#gal-add-bg-btn').on('click', () => {
    $modal.remove();
    if (_showBackgroundUploadDialogRef) _showBackgroundUploadDialogRef(() => showAssetManagerModal('backgrounds'));
  });
  $modal.find('#gal-batch-bg-upload-btn').on('click', () => {
    $modal.remove();
    if (_showBatchBackgroundUploadDialogRef)
      _showBatchBackgroundUploadDialogRef(() => showAssetManagerModal('backgrounds'));
  });
  $modal.find('.gal-bg-delete').on('click', async function (e) {
    e.stopPropagation();
    const scene = $(e.currentTarget).attr('data-scene');
    if (confirm(`确定删除背景「${scene}」吗？`)) {
      await deleteBackground(scene);
      showToast(`已删除背景: ${scene}`);
      if (getIsEnabled()) injectCOTToWorldbook().catch(e => console.warn(`[${SCRIPT_NAME}] 更新世界书失败:`, e));
      $modal.remove();
      showAssetManagerModal('backgrounds');
    }
  });
  $modal.find('.gal-bg-transfer').on('click', function (e) {
    e.stopPropagation();
    const sceneName = $(this).data('scene');
    showTransferDialog('background', [sceneName], () => {
      $modal.remove();
      $(topWindow.document).off('.galMenus').off('.galImportMenu').off('.galPackMenu');
      showAssetManagerModal('backgrounds');
    });
  });
}

function bindMapEvents($modal, activeTab) {
  $modal.find('#gal-add-map-btn').on('click', () => {
    showMapUploadDialog({
      onSaved: () => {
        $modal.remove();
        showAssetManagerModal('maps');
      },
    });
  });

  $modal.on('click', '.gal-map-card', function (e) {
    if ($(e.target).closest('.gal-map-card-actions').length) return;
    $modal.remove();
    showMapModal();
  });

  $modal.on('click', '.gal-map-open-btn', function (e) {
    e.stopPropagation();
    $modal.remove();
    showMapModal();
  });

  $modal.on('click', '.gal-map-delete-btn', async function (e) {
    e.stopPropagation();
    const regionKey = String($(this).attr('data-region') || '').trim() || GLOBAL_MAP_REGION_KEY;
    const packId = String($(this).attr('data-pack-id') || '').trim() || null;
    if (!confirm('确定删除统一世界地图吗？')) return;
    try {
      await deleteMapImage(regionKey, packId);
      showToast('已删除统一世界地图');
      $modal.remove();
      showAssetManagerModal('maps');
    } catch (error) {
      showToast(`删除地图失败: ${error?.message || error}`);
    }
  });
}

function bindPackSelectorEvents($modal, activeTab) {
  $modal.find('#gal-pack-dropdown-btn').on('click', function (e) {
    e.stopPropagation();
    $('#gal-export-menu, #gal-import-menu').hide();
    $('#gal-pack-menu').toggle();
  });
  $(topWindow.document).on('click.galPackMenu', function (e) {
    if (!$(e.target).closest('.gal-pack-selector').length) $('#gal-pack-menu').hide();
  });
  $modal.find('.gal-pack-item[data-pack-id]').on('click', function () {
    const packId = $(this).data('pack-id');
    $('#gal-pack-menu').hide();
    setCurrentPack(packId);
    applyWesternSkinRuntime().catch(e => console.warn(`[${SCRIPT_NAME}] 切换图包后刷新 western 皮肤失败:`, e));
    $modal.remove();
    $(topWindow.document).off('.galMenus').off('.galImportMenu').off('.galPackMenu');
    showAssetManagerModal();
  });
  $modal.find('#gal-add-pack-btn').on('click', function () {
    $('#gal-pack-menu').hide();
    const name = prompt('请输入新图包名称：');
    if (name && name.trim()) {
      createImagePack(name.trim()).then(() => {
        $modal.remove();
        $(topWindow.document).off('.galMenus').off('.galImportMenu').off('.galPackMenu');
        showAssetManagerModal();
      });
    }
  });
  $modal.find('#gal-manage-packs-btn').on('click', function () {
    $('#gal-pack-menu').hide();
    showPackManagerModal();
  });
  $modal.find('#gal-render-scope-btn').on('click', function () {
    const currentScope = getRenderScope();
    const newScope = currentScope === 'current' ? 'all' : 'current';
    setRenderScope(newScope);
    const $btn = $(this);
    if (newScope === 'current') {
      $btn
        .css({ background: '#fd7e14', borderColor: '#fd7e14' })
        .attr('title', '仅当前图包资源')
        .find('i')
        .removeClass('fa-globe')
        .addClass('fa-bullseye');
    } else {
      $btn
        .css({ background: '#20c997', borderColor: '#20c997' })
        .attr('title', '搜索所有图包资源')
        .find('i')
        .removeClass('fa-bullseye')
        .addClass('fa-globe');
    }
    showToast(newScope === 'current' ? '已切换为：仅当前图包' : '已切换为：搜索所有图包');
    const currentTab = $modal.find('.gal-tab-btn.active').data('tab') || activeTab || 'sprites';
    $modal.remove();
    $(topWindow.document).off('.galMenus').off('.galImportMenu').off('.galPackMenu');
    showAssetManagerModal(currentTab);
  });
}

function bindExportImportEvents($modal, activeTab) {
  $modal.find('#gal-export-dropdown-btn').on('click', function (e) {
    e.stopPropagation();
    $('#gal-import-menu').hide();
    $('#gal-export-menu').toggle();
  });
  $(topWindow.document).on('click.galMenus', function (e) {
    if (!$(e.target).closest('.gal-export-dropdown').length) $('#gal-export-menu').hide();
  });
  const askExportPackageName = async (dialogTitle = '导出资源包') => {
    const cpId = getCurrentPackId();
    const packs = await getAllImagePacks();
    const cp = packs.find(p => p.id === cpId);
    const defaultName = cp ? cp.name : '图包';
    const defaultPackageName = `${defaultName}_${new Date().toISOString().slice(0, 10)}`;
    return showInAppPromptDialog({
      title: dialogTitle,
      message: `将导出当前图包“${defaultName}”的资源，请输入导出包名。`,
      label: '导出包名',
      defaultValue: defaultPackageName,
      placeholder: defaultPackageName,
      confirmText: '开始导出',
      cancelText: '取消',
      iconClass: 'fa-solid fa-file-export',
      accent: '#0d6efd',
      required: true,
      requiredMessage: '请输入导出包名',
    });
  };

  $modal.find('.gal-export-item').on('click', async function () {
    const action = $(this).data('action');
    $('#gal-export-menu').hide();

    if (action === 'export-local') {
      const packageName = await askExportPackageName('导出本地压缩包');
      if (!packageName) return;
      AssetIO.exportAllAssets(null, packageName.trim());
      return;
    }

    if (action === 'export-remote') {
      const packageName = await askExportPackageName('导出 GitHub 资源包');
      if (!packageName) return;

      const input = await showInAppPromptDialog({
        title: 'GitHub 仓库信息',
        message: '请输入用户/仓库名、GitHub 仓库链接，或现成的 jsDelivr CDN 前缀。',
        hint: '示例：user/repo 或 https://github.com/user/repo',
        label: '仓库信息',
        placeholder: 'user/repo',
        confirmText: '下一步',
        cancelText: '取消',
        iconClass: 'fa-brands fa-github',
        accent: '#6f42c1',
        required: true,
        requiredMessage: '请输入 GitHub 仓库信息',
      });
      if (!input) return;

      const rawInput = input.trim();
      let cleanRepo = '';
      let branch = '';
      let baseUrl = '';

      if (rawInput.includes('cdn.jsdelivr.net/gh/')) {
        baseUrl = rawInput.endsWith('/') ? rawInput : `${rawInput}/`;
        const confirmed = await showInAppConfirmDialog({
          title: '确认 CDN 链接前缀',
          message: `确认使用以下 CDN 链接前缀吗？\n${baseUrl}`,
          confirmText: '确认导出',
          cancelText: '返回修改',
          iconClass: 'fa-solid fa-link',
          accent: '#6f42c1',
        });
        if (!confirmed) return;
        AssetIO.exportAllAssets(baseUrl, packageName.trim());
        return;
      }

      if (rawInput.startsWith('http')) {
        const rawMatch = rawInput.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\//i);
        if (rawMatch) {
          cleanRepo = `${rawMatch[1]}/${rawMatch[2]}`;
          branch = rawMatch[3];
        } else {
          const githubMatch = rawInput.match(/github\.com\/([^/]+)\/([^/#?]+)(?:\.git)?/i);
          if (githubMatch) cleanRepo = `${githubMatch[1]}/${githubMatch[2].replace(/\.git$/i, '')}`;
        }
      } else if (rawInput.indexOf('/') > 0 && rawInput.split('/').length === 2) {
        cleanRepo = rawInput.replace(/\.git$/i, '');
      }

      if (!cleanRepo) {
        await showInAppAlertDialog({
          title: '仓库信息无效',
          message: '无法识别 GitHub 仓库信息，请输入 user/repo 或标准 GitHub 仓库链接。',
          iconClass: 'fa-solid fa-circle-exclamation',
          accent: '#dc3545',
        });
        return;
      }

      if (!branch) {
        const branchInput = await showInAppPromptDialog({
          title: '填写分支或版本',
          message: '请输入分支名或版本号。',
          label: '分支 / 版本',
          defaultValue: 'main',
          placeholder: 'main',
          confirmText: '确认',
          cancelText: '取消',
          iconClass: 'fa-solid fa-code-branch',
          accent: '#6f42c1',
          required: true,
          requiredMessage: '请输入分支名或版本号',
        });
        if (!branchInput) return;
        branch = branchInput.trim();
      }

      baseUrl = `https://cdn.jsdelivr.net/gh/${cleanRepo}@${branch}/`;
      const confirmed = await showInAppConfirmDialog({
        title: '确认导出配置',
        message: `确认生成并使用以下 CDN 链接前缀吗？\n${baseUrl}`,
        confirmText: '确认导出',
        cancelText: '返回修改',
        iconClass: 'fa-solid fa-link',
        accent: '#6f42c1',
      });
      if (!confirmed) return;
      AssetIO.exportAllAssets(baseUrl, packageName.trim());
      return;
    }

    if (action === 'export-character-card') {
      await exportCurrentCharacterCardWithConfig();
    }
  });

  $modal.find('#gal-import-dropdown-btn').on('click', function (e) {
    e.stopPropagation();
    $('#gal-export-menu').hide();
    $('#gal-import-menu').toggle();
  });
  $(topWindow.document).on('click.galImportMenu', function (e) {
    if (!$(e.target).closest('.gal-import-dropdown').length) $('#gal-import-menu').hide();
  });
  $modal.find('.gal-import-item').on('click', function () {
    const action = $(this).data('action');
    $('#gal-import-menu').hide();
    switch (action) {
      case 'import-local-zip':
        $modal.find('#gal-asset-import-zip-input').click();
        break;
      case 'import-remote-zip':
        showRemoteZipImportDialog();
        break;
      case 'import-json':
        $modal.find('#gal-asset-import-json-input').click();
        break;
      case 'import-github':
        handleGitHubImport();
        break;
    }
  });

  $modal.find('#gal-asset-import-zip-input').on('change', async function () {
    const file = this.files[0];
    if (!file) return;
    const MAX_SIZE = 5 * 1024 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      showImportError([
        '文件大小超过限制',
        `当前文件: ${(file.size / 1024 / 1024 / 1024).toFixed(2)} GB`,
        '最大允许: 5 GB',
      ]);
      $(this).val('');
      return;
    }
    await importFromZipFile(file);
    $(this).val('');
    $modal.remove();
    showAssetManagerModal(activeTab);
  });

  async function handleGitHubImport() {
    const url = prompt('请输入 GitHub 仓库地址 (例如: user/repo 或 https://github.com/user/repo/tree/main/path):');
    if (url) {
      const success = await AssetIO.importFromGitHub(url.trim());
      if (success) {
        $modal.remove();
        showAssetManagerModal(activeTab);
      }
    }
  }

  $modal.find('#gal-asset-import-json-input').on('change', async function () {
    if (this.files.length > 0) {
      await importAssetsFromJson(this.files[0]);
      $modal.remove();
      showAssetManagerModal(activeTab);
      $(this).val('');
    }
  });

  $modal.on('remove', function () {
    $(topWindow.document).off('click.galImportMenu');
  });
}
