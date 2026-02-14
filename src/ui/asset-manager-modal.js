import { SCRIPT_NAME, THEME, DEFAULT_PACK_ID } from '../core/constants.js';
import { topWindow, $ } from '../core/env.js';
import { getModalMountRoot } from './fullscreen.js';
import { GalgameStore } from '../core/store.js';
import { getIsEnabled } from '../core/state.js';
import { getSettings, saveSettings } from '../core/settings.js';
import { getAllSprites, deleteSprite } from '../db/sprites.js';
import { getAllBackgrounds, deleteBackground } from '../db/backgrounds.js';
import { getCurrentPackId, setCurrentPack, getRenderScope, setRenderScope, getAllImagePacks, createImagePack } from '../db/image-packs.js';
import { getCharacterListFromDatabase } from '../utils/chat.js';
import { injectCOTToWorldbook } from '../logic/worldbook.js';
import { showToast } from './toast.js';
import { importAssetsFromJson, AssetIO, showRemoteZipImportDialog, importFromZipFile, showImportError, exportCurrentCharacterCardWithConfig } from './asset-io.js';
import { showCharacterSpritesModal, showPackManagerModal, showTransferDialog } from './asset-manager-parts.js';
import { buildImageGenConfigPane, bindImageGenConfigEvents } from './image-gen-config.js';

// 延迟引用
let _showSpriteUploadDialogRef = null;
let _showBatchUploadDialogRef = null;
let _showBackgroundUploadDialogRef = null;
let _showBatchBackgroundUploadDialogRef = null;
let _showCustomExpressionManagerRef = null;
let _showSettingsPanelRef = null;

export function setAssetManagerModalRefs({ showSpriteUploadDialog, showBatchUploadDialog, showBackgroundUploadDialog, showBatchBackgroundUploadDialog, showCustomExpressionManager, showSettingsPanel }) {
  if (showSpriteUploadDialog) _showSpriteUploadDialogRef = showSpriteUploadDialog;
  if (showBatchUploadDialog) _showBatchUploadDialogRef = showBatchUploadDialog;
  if (showBackgroundUploadDialog) _showBackgroundUploadDialogRef = showBackgroundUploadDialog;
  if (showBatchBackgroundUploadDialog) _showBatchBackgroundUploadDialogRef = showBatchBackgroundUploadDialog;
  if (showCustomExpressionManager) _showCustomExpressionManagerRef = showCustomExpressionManager;
  if (showSettingsPanel) _showSettingsPanelRef = showSettingsPanel;
}

const CUSTOM_LOCATION_HTML_KEY = GalgameStore.STORAGE_KEYS.CUSTOM_LOCATION_HTML;
const CUSTOM_TIME_HTML_KEY = GalgameStore.STORAGE_KEYS.CUSTOM_TIME_HTML;

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
              ${allPacks.map(pack => `
                <div class="gal-pack-item ${pack.id === currentPackId ? 'active' : ''}" data-pack-id="${pack.id}" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 1px solid #eee; transition: background 0.2s; color: #333; ${pack.id === currentPackId ? 'background: #e9ecef; font-weight: 700;' : ''}">
                  <span><i class="fa-solid fa-folder${pack.id === currentPackId ? '-open' : ''}" style="margin-right: 8px; color: ${pack.id === currentPackId ? '#6f42c1' : '#666'};"></i>${pack.name}</span>
                  ${pack.isDefault ? '<span style="font-size: 0.7rem; background: #6f42c1; color: #fff; padding: 2px 6px; border-radius: 3px;">默认</span>' : ''}
                </div>
              `).join('')}
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
                <i class="fa-solid fa-id-card" style="width: 20px; color: #0d6efd;"></i><span>导出打包角色卡(JSON)</span>
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
      <button class="gal-tab-btn ${activeTab === 'imagegen' ? 'active' : ''}" data-tab="imagegen"><i class="fa-solid fa-wand-magic-sparkles"></i> 生图配置</button>
      <button class="gal-tab-btn ${activeTab === 'custom' ? 'active' : ''}" data-tab="custom"><i class="fa-solid fa-code"></i> 自定义模块</button>
    </div>
    <div class="gal-tab-content">
      ${buildSpritesTab(activeTab, allSprites, charactersData)}
      ${buildBackgroundsTab(settings, allBackgrounds)}
      ${buildImagegenTab(activeTab, settings)}
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
  $modal.find('#gal-save-custom-html').on('click', function() {
    const locHtml = $('#gal-custom-location-html').val();
    const timeHtml = $('#gal-custom-time-html').val();
    localStorage.setItem(CUSTOM_LOCATION_HTML_KEY, locHtml);
    localStorage.setItem(CUSTOM_TIME_HTML_KEY, timeHtml);
    showToast('自定义配置已保存');
  });

  // 生图配置事件
  bindImageGenConfigEvents($modal, settings);

  bindSpriteEvents($modal, activeTab);
  bindBackgroundEvents($modal, activeTab);
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
    ${charactersData.size === 0
      ? `<div style="text-align: center; padding: 40px; color: #999;"><i class="fa-solid fa-images" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i><p>暂无角色数据，请确保已加载数据库脚本或点击上方按钮添加</p></div>`
      : `<div class="gal-character-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 15px;">
          ${Array.from(charactersData.entries()).map(([charId, info]) => {
            const sprites = info.sprites;
            const defaultSprite = sprites.find(s => s.expression === '默认') || sprites[0];
            const avatarUrl = defaultSprite?.imageUrl ? defaultSprite.imageUrl : defaultSprite?.imageBlob ? URL.createObjectURL(defaultSprite.imageBlob) : '';
            const typeLabel = info.type && info.type !== '自定义' ? `<span style="font-size: 0.7rem; background: ${THEME.accent}; color: ${THEME.dark}; padding: 1px 4px; border-radius: 3px; margin-left: 4px;">${info.type}</span>` : '';
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
          }).join('')}
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
    ${allBackgrounds.length === 0
      ? `<div style="text-align: center; padding: 40px; color: #999;"><i class="fa-solid fa-panorama" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i><p>暂无背景，点击上方按钮添加</p><small style="color: #bbb;">背景图将根据 &lt;background scene="场景名" /&gt; 标签自动匹配</small></div>`
      : `<div class="gal-bg-grid">${allBackgrounds.map(bg => `
          <div class="gal-bg-card" data-scene="${bg.sceneName}">
            <div class="gal-bg-preview">${bg.imageUrl ? `<img src="${bg.imageUrl}" alt="${bg.sceneName}">` : bg.imageBlob ? `<img src="${URL.createObjectURL(bg.imageBlob)}" alt="${bg.sceneName}">` : ''}</div>
            <div class="gal-bg-label">${bg.sceneName}</div>
            <div class="gal-bg-actions" style="position: absolute; top: 5px; right: 5px; display: flex; gap: 4px;">
              <button class="gal-bg-transfer" data-scene="${bg.sceneName}" title="转移到其他图包" style="width: 28px; height: 28px; border-radius: 50%; background: rgba(111, 66, 193, 0.9); color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;"><i class="fa-solid fa-arrow-right-arrow-left"></i></button>
              <button class="gal-bg-delete" data-scene="${bg.sceneName}" title="删除" style="width: 28px; height: 28px; border-radius: 50%; background: rgba(220, 53, 69, 0.9); color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>`).join('')}</div>`
    }
  </div>`;
}

function buildImagegenTab(activeTab, settings) {
  return `
  <div class="gal-tab-pane" data-pane="imagegen" style="${activeTab !== 'imagegen' ? 'display: none;' : ''}">
    ${buildImageGenConfigPane(settings)}
  </div>`;
}

function buildCustomTab(settings) {
  return `
  <div class="gal-tab-pane" data-pane="custom" style="display: none;">
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px dashed #ddd; margin-bottom: 20px;">
      <div style="margin-bottom: 15px;"><label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};"><i class="fa-solid fa-location-dot" style="color: ${THEME.accent};"></i> 地点状态栏 - 自定义内容 HTML</label><textarea id="gal-custom-location-html" placeholder="<div>自定义地点介绍...</div>" style="width: 100%; height: 120px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 0.9rem; color: #333; resize: vertical;">${localStorage.getItem(CUSTOM_LOCATION_HTML_KEY) || ''}</textarea></div>
      <div style="margin-bottom: 15px;"><label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};"><i class="fa-solid fa-clock" style="color: ${THEME.accentSub};"></i> 时间状态栏 - 自定义内容 HTML</label><textarea id="gal-custom-time-html" placeholder="<div>自定义时间介绍...</div>" style="width: 100%; height: 120px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 0.9rem; color: #333; resize: vertical;">${localStorage.getItem(CUSTOM_TIME_HTML_KEY) || ''}</textarea></div>
      <div style="text-align: right;"><button class="gal-action-btn primary" id="gal-save-custom-html" style="padding: 8px 20px;"><i class="fa-solid fa-save"></i> 保存配置</button></div>
    </div>
    <div style="padding: 15px; color: #666; font-size: 0.9rem; line-height: 1.6;"><strong><i class="fa-solid fa-lightbulb"></i> 说明：</strong><br>此处配置的 HTML 内容将在点击主界面的地点/时间状态栏时弹窗显示。<br>支持标准 HTML 标签和内联样式。</div>
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
    .gal-imagegen-pills { display:flex; gap:8px; padding:12px 0; flex-wrap:wrap; }
    .gal-pill { padding:8px 18px; border:2px solid rgba(0,0,0,0.15); background:rgba(0,0,0,0.05); border-radius:20px; cursor:pointer; font-size:0.85rem; font-weight:600; color:rgba(0,0,0,0.6); transition:all 0.2s; display:flex; align-items:center; gap:6px; }
    .gal-pill:hover { border-color:${THEME.accent}; color:${THEME.accent}; }
    .gal-pill.active { background:linear-gradient(135deg,${THEME.accent},#00a8cc); color:#fff; border-color:transparent; }
  `;
}

// ============================================
// 事件绑定 (内部)
// ============================================

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
    if (_showSpriteUploadDialogRef) await _showSpriteUploadDialogRef('', '默认', () => showAssetManagerModal('sprites'));
  });
  $modal.find('.gal-character-card').on('click', function (e) {
    if ($(e.target).closest('.gal-char-actions').length) return;
    const charId = $(this).data('char');
    showCharacterSpritesModal(charId);
  });
  $modal.find('.gal-character-card').on('mouseenter', function () {
    $(this).find('.gal-char-actions').css('opacity', '1');
  }).on('mouseleave', function () {
    $(this).find('.gal-char-actions').css('opacity', '0');
  });
  $modal.find('.gal-char-transfer').on('click', async function (e) {
    e.stopPropagation();
    const charId = $(this).data('char');
    const allSpritesAll = await getAllSprites(null, true);
    const charSprites = allSpritesAll.filter(s => s.characterId === charId);
    if (charSprites.length === 0) { showToast('该角色没有立绘可转移', 'warning'); return; }
    const spriteKeys = charSprites.map(s => `${s.characterId}_${s.expression}`);
    showTransferDialog('sprite', spriteKeys, () => { $modal.remove(); showAssetManagerModal('sprites'); });
  });
  $modal.find('.gal-char-delete').on('click', async function (e) {
    e.stopPropagation();
    const charId = $(this).data('char');
    const allSpritesAll = await getAllSprites(null, true);
    const charSprites = allSpritesAll.filter(s => s.characterId === charId);
    if (charSprites.length === 0) { showToast('该角色没有立绘', 'warning'); return; }
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
    const $lightbox = $(`<div style="${posStyle}background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:100003;cursor:zoom-out;flex-direction:column;gap:12px;">
      <img src="${src}" style="max-width:90vw;max-height:85vh;object-fit:contain;border-radius:8px;box-shadow:0 4px 30px rgba(0,0,0,0.5);">
      <span style="color:#ccc;font-size:0.9rem;">${scene}</span>
    </div>`);
    $lightbox.on('click', function () { $(this).remove(); });
    $(mountRoot).append($lightbox);
  });
  $modal.find('#gal-add-bg-btn').on('click', () => {
    $modal.remove();
    if (_showBackgroundUploadDialogRef) _showBackgroundUploadDialogRef(() => showAssetManagerModal('backgrounds'));
  });
  $modal.find('#gal-batch-bg-upload-btn').on('click', () => {
    $modal.remove();
    if (_showBatchBackgroundUploadDialogRef) _showBatchBackgroundUploadDialogRef(() => showAssetManagerModal('backgrounds'));
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
      $btn.css({ background: '#fd7e14', borderColor: '#fd7e14' }).attr('title', '仅当前图包资源').find('i').removeClass('fa-globe').addClass('fa-bullseye');
    } else {
      $btn.css({ background: '#20c997', borderColor: '#20c997' }).attr('title', '搜索所有图包资源').find('i').removeClass('fa-bullseye').addClass('fa-globe');
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
  $modal.find('.gal-export-item').on('click', function () {
    const action = $(this).data('action');
    $('#gal-export-menu').hide();
    if (action === 'export-local') {
      const cpId = getCurrentPackId();
      getAllImagePacks().then(packs => {
        const cp = packs.find(p => p.id === cpId);
        const defaultName = cp ? cp.name : '图包';
        const packageName = prompt(`将导出当前图包"${defaultName}"的资源\n\n请输入导出包名:`, `${defaultName}_${new Date().toISOString().slice(0, 10)}`);
        if (!packageName) return;
        AssetIO.exportAllAssets(null, packageName);
      });
    } else if (action === 'export-remote') {
      const cpId = getCurrentPackId();
      getAllImagePacks().then(packs => {
        const cp = packs.find(p => p.id === cpId);
        const defaultName = cp ? cp.name : '图包';
        const packageName = prompt(`将导出当前图包"${defaultName}"的资源\n\n请输入导出包名:`, `${defaultName}_${new Date().toISOString().slice(0, 10)}`);
        if (!packageName) return;
        const input = prompt('请输入 GitHub 仓库信息 (格式: 用户名/仓库名 或 GitHub 仓库链接)\n\n将统一生成 jsDelivr CDN 加速链接。');
        if (!input) return;
        const rawInput = input.trim();
        let cleanRepo = '', branch = '', baseUrl = '';
        if (rawInput.includes('cdn.jsdelivr.net/gh/')) {
          baseUrl = rawInput.endsWith('/') ? rawInput : `${rawInput}/`;
          if (!confirm(`确认使用以下 CDN 链接前缀吗？\n${baseUrl}`)) return;
          AssetIO.exportAllAssets(baseUrl, packageName);
          return;
        }
        if (rawInput.startsWith('http')) {
          const rawMatch = rawInput.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\//i);
          if (rawMatch) { cleanRepo = `${rawMatch[1]}/${rawMatch[2]}`; branch = rawMatch[3]; }
          else { const githubMatch = rawInput.match(/github\.com\/([^/]+)\/([^/#?]+)(?:\.git)?/i); if (githubMatch) cleanRepo = `${githubMatch[1]}/${githubMatch[2].replace(/\.git$/i, '')}`; }
        } else if (rawInput.indexOf('/') > 0 && rawInput.split('/').length === 2) { cleanRepo = rawInput.replace('.git', ''); }
        if (!cleanRepo) { alert('无法识别 GitHub 仓库信息'); return; }
        if (!branch) { const branchInput = prompt('请输入分支名或版本号:', 'main'); if (!branchInput) return; branch = branchInput; }
        baseUrl = `https://cdn.jsdelivr.net/gh/${cleanRepo}@${branch}/`;
        if (!confirm(`确认生成以下 CDN 链接前缀的配置吗？\n${baseUrl}`)) return;
        AssetIO.exportAllAssets(baseUrl, packageName);
      });
    } else if (action === 'export-character-card') {
      exportCurrentCharacterCardWithConfig();
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
      case 'import-local-zip': $modal.find('#gal-asset-import-zip-input').click(); break;
      case 'import-remote-zip': showRemoteZipImportDialog(); break;
      case 'import-json': $modal.find('#gal-asset-import-json-input').click(); break;
      case 'import-github': handleGitHubImport(); break;
    }
  });

  $modal.find('#gal-asset-import-zip-input').on('change', async function () {
    const file = this.files[0];
    if (!file) return;
    const MAX_SIZE = 5 * 1024 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      showImportError(['文件大小超过限制', `当前文件: ${(file.size / 1024 / 1024 / 1024).toFixed(2)} GB`, '最大允许: 5 GB']);
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
      if (success) { $modal.remove(); showAssetManagerModal(activeTab); }
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
