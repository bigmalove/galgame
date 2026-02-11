import { SCRIPT_NAME, THEME, DEFAULT_PACK_ID } from '../core/constants.js';
import { topWindow, $ } from '../core/env.js';
import { sceneBackgrounds } from '../core/store.js';
import { GalgameStore } from '../core/store.js';
import { getIsEnabled } from '../core/state.js';
import { getSettings, saveSettings } from '../core/settings.js';
import { getAllSprites, deleteSprite } from '../db/sprites.js';
import { getAllBackgrounds, deleteBackground, saveBackground } from '../db/backgrounds.js';
import { getCurrentPackId, setCurrentPack, getRenderScope, setRenderScope, getAllImagePacks, createImagePack } from '../db/image-packs.js';
import { getCharacterListFromDatabase } from '../utils/chat.js';
import { getBananaCharacterAppearances, setBananaCharacterAppearances, buildBananaAppearanceMultimodalContent } from '../image-gen/comfyui-helpers.js';
import { parseBananaImageFromResponse } from '../image-gen/banana-image.js';
import { injectCOTToWorldbook } from '../logic/worldbook.js';
import { getModalMountRoot } from './fullscreen.js';
import { showToast } from './toast.js';
import { importAssetsFromJson, AssetIO, showRemoteZipImportDialog, importFromZipFile, showImportError } from './asset-io.js';
import { showCharacterSpritesModal, showPackManagerModal, showTransferDialog, renderBananaAppearanceList } from './asset-manager-parts.js';

// 延迟引用
let _showSpriteUploadDialogRef = null;
let _showBatchUploadDialogRef = null;
let _showBackgroundUploadDialogRef = null;
let _showBatchBackgroundUploadDialogRef = null;
let _showCustomExpressionManagerRef = null;
let _showBananaAppearancePickerRef = null;

export function setAssetManagerModalRefs({ showSpriteUploadDialog, showBatchUploadDialog, showBackgroundUploadDialog, showBatchBackgroundUploadDialog, showCustomExpressionManager, showBananaAppearancePicker }) {
  if (showSpriteUploadDialog) _showSpriteUploadDialogRef = showSpriteUploadDialog;
  if (showBatchUploadDialog) _showBatchUploadDialogRef = showBatchUploadDialog;
  if (showBackgroundUploadDialog) _showBackgroundUploadDialogRef = showBackgroundUploadDialog;
  if (showBatchBackgroundUploadDialog) _showBatchBackgroundUploadDialogRef = showBatchBackgroundUploadDialog;
  if (showCustomExpressionManager) _showCustomExpressionManagerRef = showCustomExpressionManager;
  if (showBananaAppearancePicker) _showBananaAppearancePickerRef = showBananaAppearancePicker;
}

const CUSTOM_LOCATION_HTML_KEY = GalgameStore.STORAGE_KEYS.CUSTOM_LOCATION_HTML;
const CUSTOM_TIME_HTML_KEY = GalgameStore.STORAGE_KEYS.CUSTOM_TIME_HTML;

export async function showAssetManagerModal(activeTab = 'sprites') {
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

  const modalHtml = buildAssetManagerHtml(activeTab, settings, allPacks, currentPackId, currentPackName, currentRenderScope, allSprites, allBackgrounds, charactersData);

  const mountRoot = getModalMountRoot();
  $(mountRoot).append(modalHtml);
  const $modal = $(mountRoot).find('#gal-asset-manager-modal');

  if (activeTab && activeTab !== 'sprites') {
    $modal.find('.gal-tab-btn').removeClass('active');
    $modal.find(`.gal-tab-btn[data-tab="${activeTab}"]`).addClass('active');
    $modal.find('.gal-tab-pane').hide();
    $modal.find(`.gal-tab-pane[data-pane="${activeTab}"]`).show();
  }

  bindAssetManagerEvents($modal, activeTab, settings, allPacks, currentPackId);
}

function buildAssetManagerHtml(activeTab, settings, allPacks, currentPackId, currentPackName, currentRenderScope, allSprites, allBackgrounds, charactersData) {
  return `
  <div class="gal-input-modal" id="gal-asset-manager-modal">
    <div class="gal-input-box" style="width: 100% !important; height: 100% !important; max-width: none !important; max-height: none !important; overflow: hidden; padding: 0; display: flex; flex-direction: column; border-radius: 0 !important;">
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
            <div class="gal-input-title" style="margin: 0; font-size: 1.4rem;">
              <span><i class="fa-solid fa-folder-open"></i> 资源管理器</span>
            </div>
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
        <button class="gal-tab-btn ${activeTab === 'custom' ? 'active' : ''}" data-tab="custom"><i class="fa-solid fa-code"></i> 自定义模块</button>
      </div>
      <div class="gal-tab-content">
        ${buildSpritesTab(activeTab, allSprites, charactersData)}
        ${buildBackgroundsTab(settings, allBackgrounds)}
        ${buildCustomTab(settings)}
      </div>
      <div class="gal-input-actions">
        <button class="gal-action-btn" id="gal-asset-close" style="width: 100%; min-height: 44px;"><span>关闭</span></button>
      </div>
    </div>
  </div>
  ${buildAssetManagerStyles()}
  `;
}

function buildSpritesTab(activeTab, allSprites, charactersData) {
  return `
  <div class="gal-tab-pane ${activeTab === 'sprites' ? 'active' : ''}" data-pane="sprites" style="${activeTab !== 'sprites' ? 'display: none;' : ''}">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <span style="font-weight: 700; color: ${THEME.dark};">已保存 ${allSprites.length} 个立绘，共 ${charactersData.size} 个角色</span>
      <div style="display: flex; gap: 10px;">
        <button class="gal-action-btn" id="gal-batch-upload-btn" style="padding: 8px 16px; background: #6f42c1; color: #fff; border: none;"><i class="fa-solid fa-cloud-arrow-up"></i> <span>批量上传</span></button>
        <button class="gal-action-btn primary" id="gal-add-sprite-btn" style="padding: 8px 16px;"><i class="fa-solid fa-plus"></i> <span>添加立绘</span></button>
        <button class="gal-action-btn" id="gal-manage-expressions-btn" style="padding: 8px 16px; background: #17a2b8; color: #fff; border: none;"><i class="fa-solid fa-face-smile"></i> <span>表情标签</span></button>
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
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <span style="font-weight: 700; color: ${THEME.dark};">已保存 ${allBackgrounds.length} 个背景</span>
      <div style="display: flex; gap: 10px; align-items: center;">
        <div class="gal-realtime-toggle-wrapper" title="开启后，当AI输出的场景在库中不存在时，将自动调用ComfyUI生成">
          <span class="gal-realtime-label">ComfyUI 文生图实时生成背景</span>
          <label class="gal-realtime-switch"><input type="checkbox" id="gal-realtime-bg-gen" ${settings.realTimeBackgroundGen ? 'checked' : ''}><span class="gal-realtime-slider"></span></label>
        </div>
        <button class="gal-action-btn" id="gal-batch-bg-upload-btn" style="padding: 8px 16px; background: #6f42c1; color: #fff; border: none;"><i class="fa-solid fa-cloud-arrow-up"></i> <span>批量上传</span></button>
        <button class="gal-action-btn primary" id="gal-add-bg-btn" style="padding: 8px 16px;"><i class="fa-solid fa-plus"></i> <span>添加背景</span></button>
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
    ${buildBananaSection(settings)}
    ${buildWallhavenSection(settings)}
  </div>`;
}

function buildBananaSection(settings) {
  return `
  <div class="gal-banana-imagegen-settings" style="margin-top: 20px; padding: 15px; background: linear-gradient(135deg, #2d1b4e 0%, #1a1a2e 100%); border-radius: 10px; border: 1px solid #6b21a8;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <div style="display: flex; align-items: center; gap: 10px;"><i class="fa-solid fa-wand-magic-sparkles" style="color: #fbbf24; font-size: 1.2rem;"></i><span style="font-weight: 700; color: #fff; font-size: 1.1rem;">大香蕉生图模块</span></div>
      <label class="gal-realtime-switch"><input type="checkbox" id="gal-banana-enabled" ${settings.bananaImageGen?.enabled ? 'checked' : ''}><span class="gal-realtime-slider"></span></label>
    </div>
    <div style="font-size: 0.8rem; color: #a78bfa; margin-bottom: 15px; padding: 10px; background: rgba(139,92,246,0.1); border-radius: 6px;">通过反代 API 生成背景图片，生成后自动保存到背景库。</div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">反代 API 地址</label><input type="text" id="gal-banana-proxy-url" placeholder="http://localhost:8045" value="${settings.bananaImageGen?.proxyUrl || ''}" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #6b21a8; font-family: monospace;"></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">反代 API Key</label><input type="password" id="gal-banana-proxy-key" placeholder="sk-xxx" value="${settings.bananaImageGen?.proxyApiKey || ''}" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #6b21a8; font-family: monospace;"></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">图片生成模型</label><div style="display: flex; gap: 8px;"><select id="gal-banana-model" style="flex: 1; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #6b21a8;">${settings.bananaImageGen?.model ? `<option value="${settings.bananaImageGen.model}" selected>${settings.bananaImageGen.model}</option>` : '<option value="">点击刷新获取模型列表</option>'}</select><button id="gal-banana-refresh-models" style="padding: 8px 12px; border-radius: 6px; background: linear-gradient(135deg, #8b5cf6 0%, #6b21a8 100%); color: #fff; border: none; cursor: pointer;" title="刷新模型列表"><i class="fa-solid fa-sync"></i></button></div></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">生图COT自定义</label><textarea id="gal-banana-cot" placeholder="可填写额外规则" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #6b21a8; min-height: 80px; resize: vertical;">${settings.bananaImageGen?.cotTemplate || ''}</textarea></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">默认提示词前缀</label><input type="text" id="gal-banana-prompt-prefix" placeholder="masterpiece, best quality, highres, " value="${settings.bananaImageGen?.defaultPromptPrefix || 'masterpiece, best quality, highres, '}" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #6b21a8;"></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">默认提示词后缀</label><input type="text" id="gal-banana-prompt-suffix" placeholder=", no humans, scenery, background" value="${settings.bananaImageGen?.defaultPromptSuffix || ''}" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #6b21a8;"></div>
    <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;"><div><label style="color: #ccd6f6; font-size: 0.9rem;">CG模式</label><div style="font-size: 0.75rem; color: #8892b0;">开启：生成包含人物的剧情CG | 关闭：生成纯场景背景</div></div><label class="gal-realtime-switch"><input type="checkbox" id="gal-banana-cgmode" ${settings.bananaImageGen?.cgMode ? 'checked' : ''}><span class="gal-realtime-slider"></span></label></div>
    <div id="gal-banana-size-section" style="margin-bottom: 12px; display: ${settings.bananaImageGen?.cgMode ? 'block' : 'none'};"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">生成图片比例</label><select id="gal-banana-image-size" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #6b21a8; cursor: pointer;"><option value="1:1" ${settings.bananaImageGen?.cgImageSize === '1:1' || !settings.bananaImageGen?.cgImageSize ? 'selected' : ''}>1:1 (正方形)</option><option value="16:9" ${settings.bananaImageGen?.cgImageSize === '16:9' ? 'selected' : ''}>16:9 (横屏)</option><option value="9:16" ${settings.bananaImageGen?.cgImageSize === '9:16' ? 'selected' : ''}>9:16 (竖屏)</option><option value="4:3" ${settings.bananaImageGen?.cgImageSize === '4:3' ? 'selected' : ''}>4:3 (横屏)</option><option value="3:4" ${settings.bananaImageGen?.cgImageSize === '3:4' ? 'selected' : ''}>3:4 (竖屏)</option><option value="21:9" ${settings.bananaImageGen?.cgImageSize === '21:9' ? 'selected' : ''}>21:9 (宽银幕)</option><option value="3:2" ${settings.bananaImageGen?.cgImageSize === '3:2' ? 'selected' : ''}>3:2 (横屏)</option><option value="2:3" ${settings.bananaImageGen?.cgImageSize === '2:3' ? 'selected' : ''}>2:3 (竖屏)</option></select><div style="font-size: 0.75rem; color: #8892b0; margin-top: 4px;">选择生成CG图片的比例</div></div>
    <div id="gal-banana-appearance-section" style="margin-bottom: 12px; display: ${settings.bananaImageGen?.cgMode ? 'block' : 'none'};"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;"><label style="color: #ccd6f6; font-size: 0.9rem;">指定人物外观（最多3个）</label><button id="gal-banana-appearance-add" style="padding: 6px 10px; border-radius: 6px; background: linear-gradient(135deg, #8b5cf6 0%, #6b21a8 100%); color: #fff; border: none; cursor: pointer; font-size: 0.8rem;"><i class="fa-solid fa-plus"></i> 添加角色</button></div><div id="gal-banana-appearance-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px;"></div><div id="gal-banana-appearance-empty" style="font-size: 0.75rem; color: #8892b0;">暂无已指定角色</div></div>
    <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;"><div><label style="color: #ccd6f6; font-size: 0.9rem;">自动保存到背景库</label><div style="font-size: 0.75rem; color: #8892b0;">生成成功后自动添加到背景资源库</div></div><label class="gal-realtime-switch"><input type="checkbox" id="gal-banana-autosave" ${settings.bananaImageGen?.autoSaveToLibrary !== false ? 'checked' : ''}><span class="gal-realtime-slider"></span></label></div>
    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(139,92,246,0.3);"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">手动生成背景</label><div style="display: flex; gap: 8px; margin-bottom: 8px;"><input type="text" id="gal-banana-scene-name" placeholder="场景名称（如：教室、森林）" style="flex: 1; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #6b21a8;"></div><div style="display: flex; gap: 8px; margin-bottom: 8px;"><textarea id="gal-banana-custom-prompt" placeholder="自定义提示词（可选）" style="flex: 1; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #6b21a8; min-height: 60px; resize: vertical;"></textarea></div><button id="gal-banana-generate-btn" style="width: 100%; padding: 10px; border-radius: 6px; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #1a1a2e; border: none; cursor: pointer; font-weight: 700; font-size: 0.95rem;"><i class="fa-solid fa-wand-magic-sparkles"></i> 生成背景图片</button><div id="gal-banana-preview" style="margin-top: 10px; display: none;"><div style="font-size: 0.8rem; color: #a78bfa; margin-bottom: 5px;">生成预览：</div><img id="gal-banana-preview-img" style="max-width: 100%; border-radius: 6px; border: 1px solid #6b21a8;"><button id="gal-banana-save-to-library" style="width: 100%; margin-top: 8px; padding: 8px; border-radius: 6px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; border: none; cursor: pointer; font-weight: 600; font-size: 0.9rem;"><i class="fa-solid fa-save"></i> 保存到背景库</button></div></div>
  </div>`;
}

function buildWallhavenSection(settings) {
  return `
  <div class="gal-wallhaven-settings" style="margin-top: 20px; padding: 15px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 10px; border: 1px solid #0f3460;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <div style="display: flex; align-items: center; gap: 10px;"><i class="fa-solid fa-images" style="color: #00d9ff; font-size: 1.2rem;"></i><span style="font-weight: 700; color: #fff; font-size: 1.1rem;">Wallhaven 壁纸搜索</span></div>
      <label class="gal-realtime-switch"><input type="checkbox" id="gal-wallhaven-enabled" ${settings.wallhaven?.enabled ? 'checked' : ''}><span class="gal-realtime-slider"></span></label>
    </div>
    <div style="font-size: 0.8rem; color: #8892b0; margin-bottom: 15px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 6px;">仅供学习研究使用。所有图片版权归原作者及 Wallhaven 所有。</div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">图片分类</label><select id="gal-wallhaven-category" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #0f3460;"><option value="anime" ${settings.wallhaven?.category === 'anime' ? 'selected' : ''}>动漫漫画</option><option value="all" ${settings.wallhaven?.category === 'all' ? 'selected' : ''}>全部类型</option><option value="people" ${settings.wallhaven?.category === 'people' ? 'selected' : ''}>人物写真</option><option value="general" ${settings.wallhaven?.category === 'general' ? 'selected' : ''}>综合壁纸</option></select></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">安全级别</label><select id="gal-wallhaven-purity" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #0f3460;"><option value="sfw" ${settings.wallhaven?.purity === 'sfw' ? 'selected' : ''}>SFW (安全)</option><option value="sketchy" ${settings.wallhaven?.purity === 'sketchy' ? 'selected' : ''}>Sketchy (略敏感)</option></select></div>
    <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;"><div><label style="color: #ccd6f6; font-size: 0.9rem;">CG模式</label><div style="font-size: 0.75rem; color: #8892b0;">开启：允许人物关键词 | 关闭：只搜环境背景</div></div><label class="gal-realtime-switch"><input type="checkbox" id="gal-wallhaven-cgmode" ${settings.wallhaven?.cgMode ? 'checked' : ''}><span class="gal-realtime-slider"></span></label></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">自定义标签</label><input type="text" id="gal-wallhaven-customtags" placeholder="例如: cosplay, landscape, 4k" value="${(settings.wallhaven?.customTags || []).join(', ')}" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #0f3460;"><div style="font-size: 0.75rem; color: #8892b0; margin-top: 4px;">多个标签用逗号分隔</div></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">排序方式</label><select id="gal-wallhaven-sorting" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #0f3460;"><option value="favorites" ${settings.wallhaven?.sorting === 'favorites' || !settings.wallhaven?.sorting ? 'selected' : ''}>收藏量</option><option value="relevance" ${settings.wallhaven?.sorting === 'relevance' ? 'selected' : ''}>相关度</option><option value="views" ${settings.wallhaven?.sorting === 'views' ? 'selected' : ''}>浏览量</option><option value="date_added" ${settings.wallhaven?.sorting === 'date_added' ? 'selected' : ''}>最新上传</option><option value="toplist" ${settings.wallhaven?.sorting === 'toplist' ? 'selected' : ''}>排行榜</option><option value="random" ${settings.wallhaven?.sorting === 'random' ? 'selected' : ''}>随机</option></select></div>
    <div style="margin-bottom: 12px; ${settings.wallhaven?.sorting === 'toplist' ? '' : 'display: none;'}" id="gal-wallhaven-toprange-container"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">排行榜时间范围</label><select id="gal-wallhaven-toprange" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #0f3460;"><option value="1d" ${settings.wallhaven?.topRange === '1d' ? 'selected' : ''}>1天</option><option value="3d" ${settings.wallhaven?.topRange === '3d' ? 'selected' : ''}>3天</option><option value="1w" ${settings.wallhaven?.topRange === '1w' ? 'selected' : ''}>1周</option><option value="1M" ${settings.wallhaven?.topRange === '1M' || !settings.wallhaven?.topRange ? 'selected' : ''}>1个月</option><option value="3M" ${settings.wallhaven?.topRange === '3M' ? 'selected' : ''}>3个月</option><option value="6M" ${settings.wallhaven?.topRange === '6M' ? 'selected' : ''}>6个月</option><option value="1y" ${settings.wallhaven?.topRange === '1y' ? 'selected' : ''}>1年</option></select></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">API Key（可选）</label><input type="password" id="gal-wallhaven-apikey" placeholder="留空使用公开 API" value="${settings.wallhaven?.apiKey || ''}" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #0f3460;"></div>
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

function buildAssetManagerStyles() {
  return `<style>
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
    .gal-bg-card { position: relative; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s; }
    .gal-bg-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
    .gal-bg-preview { aspect-ratio: 16 / 9; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); overflow: hidden; }
    .gal-bg-preview img { width: 100%; height: 100%; object-fit: cover; }
    .gal-bg-label { padding: 10px; text-align: center; font-size: 0.9rem; font-weight: 600; color: ${THEME.dark}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .gal-bg-delete { position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border: none; border-radius: 50%; background: rgba(255,0,85,0.9); color: #fff; font-size: 0.8rem; cursor: pointer; opacity: 0; transition: opacity 0.2s; }
    .gal-bg-card:hover .gal-bg-delete { opacity: 1; }
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
  </style>`;
}

function bindAssetManagerEvents($modal, activeTab, settings, allPacks, currentPackId) {
  // Tab 切换
  $modal.find('.gal-tab-btn').on('click', function () {
    const tab = $(this).data('tab');
    $modal.find('.gal-tab-btn').removeClass('active');
    $(this).addClass('active');
    $modal.find('.gal-tab-pane').hide();
    $modal.find(`.gal-tab-pane[data-pane="${tab}"]`).show();
  });

  // 关闭
  $('#gal-asset-close').on('click', () => $modal.remove());
  $modal.on('click', function (e) { if (e.target === this) $modal.remove(); });

  // 自定义HTML保存
  $('#gal-save-custom-html').on('click', function() {
    const locHtml = $('#gal-custom-location-html').val();
    const timeHtml = $('#gal-custom-time-html').val();
    localStorage.setItem(CUSTOM_LOCATION_HTML_KEY, locHtml);
    localStorage.setItem(CUSTOM_TIME_HTML_KEY, timeHtml);
    showToast('自定义配置已保存');
  });

  // 实时生成开关
  $modal.find('#gal-realtime-bg-gen').on('change', async function () {
    settings.realTimeBackgroundGen = $(this).is(':checked');
    saveSettings();
    if (getIsEnabled()) await injectCOTToWorldbook();
    showToast(settings.realTimeBackgroundGen ? '已开启实时背景生成（实验性）' : '已关闭实时背景生成');
  });

  bindWallhavenEvents($modal, settings);
  bindBananaEvents($modal, settings);
  bindSpriteEvents($modal, activeTab, currentPackId);
  bindBackgroundEvents($modal, activeTab, currentPackId);
  bindPackSelectorEvents($modal, activeTab, allPacks, currentPackId);
  bindExportImportEvents($modal, activeTab);
}

function bindWallhavenEvents($modal, settings) {
  $modal.find('#gal-wallhaven-enabled').on('change', async function () {
    if (!settings.wallhaven) settings.wallhaven = {};
    settings.wallhaven.enabled = $(this).is(':checked');
    saveSettings();
    if (getIsEnabled()) await injectCOTToWorldbook();
    showToast(settings.wallhaven.enabled ? '已开启 Wallhaven 壁纸搜索' : '已关闭 Wallhaven 壁纸搜索');
  });
  $modal.find('#gal-wallhaven-category').on('change', async function () {
    if (!settings.wallhaven) settings.wallhaven = {};
    settings.wallhaven.category = $(this).val();
    saveSettings();
    if (getIsEnabled()) await injectCOTToWorldbook();
  });
  $modal.find('#gal-wallhaven-purity').on('change', function () {
    if (!settings.wallhaven) settings.wallhaven = {};
    settings.wallhaven.purity = $(this).val();
    saveSettings();
  });
  $modal.find('#gal-wallhaven-cgmode').on('change', async function () {
    if (!settings.wallhaven) settings.wallhaven = {};
    settings.wallhaven.cgMode = $(this).is(':checked');
    saveSettings();
    if (getIsEnabled()) await injectCOTToWorldbook();
  });
  $modal.find('#gal-wallhaven-customtags').on('change', function () {
    if (!settings.wallhaven) settings.wallhaven = {};
    const tags = $(this).val();
    settings.wallhaven.customTags = tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [];
    saveSettings();
  });
  $modal.find('#gal-wallhaven-apikey').on('change', function () {
    if (!settings.wallhaven) settings.wallhaven = {};
    settings.wallhaven.apiKey = $(this).val();
    saveSettings();
  });
  $modal.find('#gal-wallhaven-sorting').on('change', function () {
    if (!settings.wallhaven) settings.wallhaven = {};
    settings.wallhaven.sorting = $(this).val();
    saveSettings();
    if (settings.wallhaven.sorting === 'toplist') { $('#gal-wallhaven-toprange-container').show(); }
    else { $('#gal-wallhaven-toprange-container').hide(); }
    showToast(`排序方式已设置为: ${$(this).find('option:selected').text()}`);
  });
  $modal.find('#gal-wallhaven-toprange').on('change', function () {
    if (!settings.wallhaven) settings.wallhaven = {};
    settings.wallhaven.topRange = $(this).val();
    saveSettings();
    showToast(`排行榜时间范围已设置为: ${$(this).find('option:selected').text()}`);
  });
}

function bindBananaEvents($modal, settings) {
  $modal.find('#gal-banana-enabled').on('change', async function () {
    if (!settings.bananaImageGen) settings.bananaImageGen = {};
    settings.bananaImageGen.enabled = $(this).is(':checked');
    saveSettings();
    if (getIsEnabled()) await injectCOTToWorldbook();
    showToast(settings.bananaImageGen.enabled ? '已开启大香蕉生图模块' : '已关闭大香蕉生图模块');
  });
  $modal.find('#gal-banana-proxy-url').on('change', function () {
    if (!settings.bananaImageGen) settings.bananaImageGen = {};
    settings.bananaImageGen.proxyUrl = $(this).val().trim();
    saveSettings();
  });
  $modal.find('#gal-banana-proxy-key').on('change', function () {
    if (!settings.bananaImageGen) settings.bananaImageGen = {};
    settings.bananaImageGen.proxyApiKey = $(this).val().trim();
    saveSettings();
  });
  $modal.find('#gal-banana-model').on('change', function () {
    if (!settings.bananaImageGen) settings.bananaImageGen = {};
    settings.bananaImageGen.model = $(this).val();
    saveSettings();
  });
  $modal.find('#gal-banana-cot').on('change', async function () {
    if (!settings.bananaImageGen) settings.bananaImageGen = {};
    settings.bananaImageGen.cotTemplate = $(this).val();
    saveSettings();
    if (getIsEnabled()) await injectCOTToWorldbook();
  });
  $modal.find('#gal-banana-prompt-prefix').on('change', function () {
    if (!settings.bananaImageGen) settings.bananaImageGen = {};
    settings.bananaImageGen.defaultPromptPrefix = $(this).val();
    saveSettings();
  });
  $modal.find('#gal-banana-prompt-suffix').on('change', function () {
    if (!settings.bananaImageGen) settings.bananaImageGen = {};
    settings.bananaImageGen.defaultPromptSuffix = $(this).val();
    saveSettings();
  });
  $modal.find('#gal-banana-cgmode').on('change', async function () {
    if (!settings.bananaImageGen) settings.bananaImageGen = {};
    settings.bananaImageGen.cgMode = $(this).is(':checked');
    saveSettings();
    $modal.find('#gal-banana-appearance-section').toggle(settings.bananaImageGen.cgMode === true);
    $modal.find('#gal-banana-size-section').toggle(settings.bananaImageGen.cgMode === true);
    if (getIsEnabled()) await injectCOTToWorldbook();
  });
  $modal.find('#gal-banana-image-size').on('change', function () {
    if (!settings.bananaImageGen) settings.bananaImageGen = {};
    settings.bananaImageGen.cgImageSize = $(this).val();
    saveSettings();
  });
  $modal.find('#gal-banana-autosave').on('change', function () {
    if (!settings.bananaImageGen) settings.bananaImageGen = {};
    settings.bananaImageGen.autoSaveToLibrary = $(this).is(':checked');
    saveSettings();
  });

  // CG 角色外观
  renderBananaAppearanceList($modal);
  $modal.find('#gal-banana-appearance-add').on('click', function () {
    if (_showBananaAppearancePickerRef) _showBananaAppearancePickerRef(async selection => {
      const list = getBananaCharacterAppearances();
      const name = selection.characterName || selection.characterId;
      const expr = selection.expression || '默认';
      const appearanceData = { characterId: name, characterName: name, expression: expr };
      const existingIndex = list.findIndex(a => (a.characterName || a.characterId) === name);
      if (existingIndex >= 0) { list[existingIndex] = appearanceData; }
      else if (list.length >= 3) { showToast('最多只能指定3个角色'); return; }
      else { list.push(appearanceData); }
      setBananaCharacterAppearances(list);
      renderBananaAppearanceList($modal);
      if (getIsEnabled()) await injectCOTToWorldbook();
    });
  });
  $modal.on('click', '.gal-banana-appearance-remove', async function () {
    const charId = $(this).attr('data-char');
    const list = getBananaCharacterAppearances().filter(a => (a.characterName || a.characterId) !== charId);
    setBananaCharacterAppearances(list);
    renderBananaAppearanceList($modal);
    if (getIsEnabled()) await injectCOTToWorldbook();
  });

  // 刷新模型列表
  $modal.find('#gal-banana-refresh-models').on('click', async function () {
    const $btn = $(this);
    const $select = $modal.find('#gal-banana-model');
    const proxyUrl = $modal.find('#gal-banana-proxy-url').val().trim();
    const proxyKey = $modal.find('#gal-banana-proxy-key').val().trim();
    if (!proxyUrl) { showToast('请先填写反代 API 地址'); return; }
    $btn.prop('disabled', true).find('i').addClass('fa-spin');
    try {
      let baseUrl = proxyUrl.replace(/\/+$/, '');
      if (!baseUrl.endsWith('/v1')) baseUrl = baseUrl + '/v1';
      const response = await fetch(`${baseUrl}/models`, { method: 'GET', headers: { 'Authorization': `Bearer ${proxyKey}`, 'Content-Type': 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const models = data.data || [];
      $select.html(models.map(m => `<option value="${m.id}">${m.id}</option>`).join(''));
      if (models.length > 0) showToast(`获取到 ${models.length} 个模型`);
      else { $select.html('<option value="">未找到可用模型</option>'); showToast('未找到可用模型'); }
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 获取大香蕉模型列表失败:`, e);
      showToast(`获取模型列表失败: ${e.message}`);
    } finally { $btn.prop('disabled', false).find('i').removeClass('fa-spin'); }
  });

  // 生成背景图片
  $modal.find('#gal-banana-generate-btn').on('click', async function () {
    const $btn = $(this);
    const sceneName = $modal.find('#gal-banana-scene-name').val().trim();
    const customPrompt = $modal.find('#gal-banana-custom-prompt').val().trim();
    const proxyUrl = $modal.find('#gal-banana-proxy-url').val().trim();
    const proxyKey = $modal.find('#gal-banana-proxy-key').val().trim();
    const model = $modal.find('#gal-banana-model').val();
    const promptPrefix = $modal.find('#gal-banana-prompt-prefix').val();
    const promptSuffix = $modal.find('#gal-banana-prompt-suffix').val();
    const cgMode = $modal.find('#gal-banana-cgmode').is(':checked');
    const defaultSceneSuffix = ', no humans, scenery, background';
    if (!sceneName) { showToast('请输入场景名称'); return; }
    if (!proxyUrl) { showToast('请先配置反代 API 地址'); return; }
    if (!model) { showToast('请先选择图片生成模型'); return; }
    let finalPrompt = customPrompt || sceneName;
    if (promptPrefix) finalPrompt = promptPrefix + finalPrompt;
    if (!cgMode) { const suffixToUse = promptSuffix || defaultSceneSuffix; if (suffixToUse) finalPrompt = finalPrompt + suffixToUse; }
    if (cgMode) finalPrompt = finalPrompt + '\n请生成包含人物的剧情CG画面。';
    $btn.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 生成中...');
    try {
      let baseUrl = proxyUrl.replace(/\/+$/, '');
      if (!baseUrl.endsWith('/v1')) baseUrl = baseUrl + '/v1';
      let messageContent = finalPrompt;
      if (cgMode) {
        const appearances = getBananaCharacterAppearances();
        if (appearances.length > 0) {
          messageContent = await buildBananaAppearanceMultimodalContent(finalPrompt);
        }
      }
      const requestBody = { model: model, messages: [{ role: 'user', content: messageContent }], stream: false };
      if (cgMode) {
        const imageSizeRatio = settings.bananaImageGen?.cgImageSize || '1:1';
        const [ratioW, ratioH] = imageSizeRatio.split(':').map(Number);
        let width, height;
        if (ratioW >= ratioH) { width = 1024; height = Math.round(1024 * ratioH / ratioW); }
        else { height = 1024; width = Math.round(1024 * ratioW / ratioH); }
        requestBody.size = `${width}x${height}`;
        requestBody.width = width;
        requestBody.height = height;
      }
      const response = await fetch(`${baseUrl}/chat/completions`, { method: 'POST', headers: { 'Authorization': `Bearer ${proxyKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
      if (!response.ok) { const errorText = await response.text(); throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`); }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      if (!content) throw new Error('未返回内容');
      const imageUrl = parseBananaImageFromResponse(content, proxyUrl);
      if (!imageUrl) throw new Error('未能从响应中解析到图片');
      $modal.find('#gal-banana-preview').show();
      $modal.find('#gal-banana-preview-img').attr('src', imageUrl);
      $modal.find('#gal-banana-save-to-library').data('imageUrl', imageUrl).data('sceneName', sceneName);
      showToast('背景图片生成成功');
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 大香蕉生图失败:`, e);
      showToast(`生成失败: ${e.message}`);
    } finally { $btn.prop('disabled', false).html('<i class="fa-solid fa-wand-magic-sparkles"></i> 生成背景图片'); }
  });

  // 保存到背景库
  $modal.find('#gal-banana-save-to-library').on('click', async function () {
    const $btn = $(this);
    const imageUrl = $btn.data('imageUrl');
    const sceneName = $btn.data('sceneName');
    if (!imageUrl || !sceneName) { showToast('请先生成图片'); return; }
    $btn.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 保存中...');
    try {
      let imageBlob = null;
      if (imageUrl.startsWith('data:')) {
        const base64Data = imageUrl.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
        imageBlob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });
      }
      await saveBackground(sceneName, imageBlob, imageUrl);
      sceneBackgrounds.set(sceneName, imageUrl);
      if (getIsEnabled()) injectCOTToWorldbook().catch(e => console.warn(`[${SCRIPT_NAME}] 更新世界书失败:`, e));
      showToast(`场景「${sceneName}」已保存到背景库`);
      $btn.html('<i class="fa-solid fa-check"></i> 已保存');
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 保存到背景库失败`, e);
      showToast(`保存失败: ${e.message}`);
      $btn.prop('disabled', false).html('<i class="fa-solid fa-save"></i> 保存到背景库');
    }
  });
}

function bindSpriteEvents($modal, activeTab, currentPackId) {
  $('#gal-batch-upload-btn').on('click', () => {
    $modal.remove();
    if (_showBatchUploadDialogRef) _showBatchUploadDialogRef(null, () => showAssetManagerModal('sprites'));
  });
  $('#gal-manage-expressions-btn').on('click', () => {
    $modal.remove();
    if (_showCustomExpressionManagerRef) _showCustomExpressionManagerRef(() => showAssetManagerModal('sprites'));
  });
  $('#gal-add-sprite-btn').on('click', async () => {
    $modal.remove();
    if (_showSpriteUploadDialogRef) await _showSpriteUploadDialogRef('', '默认', () => showAssetManagerModal('sprites'));
  });
  $modal.find('.gal-character-card').on('click', function (e) {
    if ($(e.target).closest('.gal-char-actions').length) return;
    const charId = $(this).data('char');
    $modal.remove();
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

function bindBackgroundEvents($modal, activeTab, currentPackId) {
  $('#gal-add-bg-btn').on('click', () => {
    $modal.remove();
    if (_showBackgroundUploadDialogRef) _showBackgroundUploadDialogRef(() => showAssetManagerModal('backgrounds'));
  });
  $('#gal-batch-bg-upload-btn').on('click', () => {
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

function bindPackSelectorEvents($modal, activeTab, allPacks, currentPackId) {
  $('#gal-pack-dropdown-btn').on('click', function (e) {
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
  $('#gal-add-pack-btn').on('click', function () {
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
  $('#gal-manage-packs-btn').on('click', function () {
    $('#gal-pack-menu').hide();
    showPackManagerModal();
  });
  $('#gal-render-scope-btn').on('click', function () {
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
  // 导出
  $('#gal-export-dropdown-btn').on('click', function (e) {
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
    }
  });

  // 导入
  $('#gal-import-dropdown-btn').on('click', function (e) {
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
      case 'import-local-zip': $('#gal-asset-import-zip-input').click(); break;
      case 'import-remote-zip': showRemoteZipImportDialog(); break;
      case 'import-json': $('#gal-asset-import-json-input').click(); break;
      case 'import-github': handleGitHubImport(); break;
    }
  });

  $('#gal-asset-import-zip-input').on('change', async function () {
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

  $('#gal-asset-import-json-input').on('change', async function () {
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
