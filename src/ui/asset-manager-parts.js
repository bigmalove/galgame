import { SCRIPT_NAME, THEME, DEFAULT_PACK_ID } from '../core/constants.js';
import { topWindow, $ } from '../core/env.js';
import { sceneBackgrounds } from '../core/store.js';
import { getIsEnabled } from '../core/state.js';
import { getSettings, saveSettings } from '../core/settings.js';
import { GalgameStore } from '../core/store.js';
import { getAllSprites, deleteSprite } from '../db/sprites.js';
import { getAllBackgrounds, deleteBackground } from '../db/backgrounds.js';
import { getCurrentPackId, setCurrentPack, getRenderScope, setRenderScope, getAllImagePacks, getDefaultPack, createImagePack, renameImagePack, deleteImagePack, getPackResourceCount, transferSpritesToPack, transferBackgroundsToPack } from '../db/image-packs.js';
import { getSprite } from '../db/sprites.js';
import { getCharacterListFromDatabase } from '../utils/chat.js';
import { getAllExpressions, getCustomExpressions, saveCustomExpressions } from '../utils/expressions.js';
import { getBananaCharacterAppearances, setBananaCharacterAppearances, buildBananaAppearanceMultimodalContent } from '../image-gen/comfyui-helpers.js';
import { getTTSVoiceListAsync, getCharacterTTSVoice, setCharacterTTSVoice } from '../audio/tts-config.js';
import { saveLive2DModel, hasLive2DModel, getLive2DModel, deleteLive2DModel } from '../db/live2d-models.js';
import { getCharacterUseLive2D, setCharacterUseLive2D } from '../live2d/render-mode.js';
import { Live2DManager } from '../live2d/manager.js';
import { Live2DStage } from '../live2d/stage.js';
import { Live2DUploader } from '../live2d/uploader.js';
import { LIVE2D_RUNTIME_TYPES } from '../live2d/runtime-router.js';
import { getLive2DExpressionList, getLive2DMotionGroups } from '../live2d/expression-motion.js';
import {
  fetchLive2DDirectory,
  buildLibraryModelUrl,
  clearLive2DDirectoryCache,
  looksLikeLive2DModelUrl,
  normalizeUserModelUrl,
  RateLimitError
} from '../live2d/online-model-browser.js';
import { injectCOTToWorldbook } from '../logic/worldbook.js';
import { parseBananaImageFromResponse } from '../image-gen/banana-image.js';
import { getModalMountRoot } from './fullscreen.js';
import { showToast } from './toast.js';
import { makeDraggable } from './interaction.js';
import { showLive2DSettingsModal } from './live2d-settings-modal.js';
import { importAssetsFromJson, AssetIO, showRemoteZipImportDialog, importFromZipFile, showImportError } from './asset-io.js';
import { refreshGalgameViews } from './galgame-mode.js';

// 寤惰繜寮曠敤
let _showSpriteUploadDialogRef = null;
let _showBatchUploadDialogRef = null;
let _showBackgroundUploadDialogRef = null;
let _showBatchBackgroundUploadDialogRef = null;
let _showCustomExpressionManagerRef = null;
let _showBananaAppearancePickerRef = null;

export function setAssetManagerRefs({ showSpriteUploadDialog, showBatchUploadDialog, showBackgroundUploadDialog, showBatchBackgroundUploadDialog, showCustomExpressionManager, showBananaAppearancePicker }) {
  if (showSpriteUploadDialog) _showSpriteUploadDialogRef = showSpriteUploadDialog;
  if (showBatchUploadDialog) _showBatchUploadDialogRef = showBatchUploadDialog;
  if (showBackgroundUploadDialog) _showBackgroundUploadDialogRef = showBackgroundUploadDialog;
  if (showBatchBackgroundUploadDialog) _showBatchBackgroundUploadDialogRef = showBatchBackgroundUploadDialog;
  if (showCustomExpressionManager) _showCustomExpressionManagerRef = showCustomExpressionManager;
  if (showBananaAppearancePicker) _showBananaAppearancePickerRef = showBananaAppearancePicker;
}

const CUSTOM_LOCATION_HTML_KEY = GalgameStore.STORAGE_KEYS.CUSTOM_LOCATION_HTML;
const CUSTOM_TIME_HTML_KEY = GalgameStore.STORAGE_KEYS.CUSTOM_TIME_HTML;

// ============================================
// 澶ч钑夊瑙傚垪琛ㄦ覆鏌?
// ============================================

function renderBananaAppearanceList($modal) {
  const list = getBananaCharacterAppearances();
  const $list = $modal.find('#gal-banana-appearance-list');
  const $empty = $modal.find('#gal-banana-appearance-empty');
  if (!$list.length) return;
  if (list.length === 0) {
    $list.html('');
    $empty.show();
    return;
  }
  $empty.hide();
  $list.html(
    list
      .map(a => {
        const name = a.characterName || a.characterId || '角色';
        const expr = a.expression || '默认';
        const key = `${name}_${expr}`;
        return `
          <div class="gal-banana-appearance-card" data-char="${name}" data-expr="${expr}" style="background: #111827; border: 1px solid #374151; border-radius: 8px; padding: 8px; color: #e5e7eb;">
            <div style="aspect-ratio: 2 / 3; background: #0f172a; border-radius: 6px; overflow: hidden; margin-bottom: 6px; display: flex; align-items: center; justify-content: center;">
              <img class="gal-banana-appearance-img" data-key="${key}" style="width: 100%; height: 100%; object-fit: cover; display: none;">
              <div class="gal-banana-appearance-placeholder" style="font-size: 0.75rem; color: #64748b;">无立绘</div>
            </div>
            <div style="font-size: 0.8rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</div>
            <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 6px;">表情：${expr}</div>
            <button class="gal-banana-appearance-remove" data-char="${name}" style="width: 100%; padding: 4px 0; border-radius: 6px; background: #ef4444; color: #fff; border: none; cursor: pointer; font-size: 0.75rem;">移除</button>
          </div>
        `;
      })
      .join(''),
  );
  refreshBananaAppearancePreviews($modal);
}

async function refreshBananaAppearancePreviews($modal) {
  const $cards = $modal.find('.gal-banana-appearance-card');
  if (!$cards.length) return;
  for (const card of $cards) {
    const $card = $(card);
    const charId = $card.attr('data-char');
    const expr = $card.attr('data-expr') || '默认';
    const url = await getSprite(charId, expr);
    const $img = $card.find('.gal-banana-appearance-img');
    const $placeholder = $card.find('.gal-banana-appearance-placeholder');
    if (url) {
      $img.attr('src', url).show();
      $placeholder.hide();
    } else {
      $img.hide();
      $placeholder.show();
    }
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getParentPath(path = '') {
  const normalized = String(path || '').trim().replace(/^\/+|\/+$/g, '');
  if (!normalized) return '';
  const index = normalized.lastIndexOf('/');
  return index <= 0 ? '' : normalized.slice(0, index);
}

function formatLive2DModelStatus(modelData) {
  if (!modelData) return '';
  if (modelData.source === 'remote') {
    try {
      const host = new URL(modelData.modelUrl).host;
      return `(远程: ${host})`;
    } catch (e) {
      return '(远程模型)';
    }
  }
  const fileSize = Number(modelData.fileSize || 0);
  if (fileSize > 0) {
    return `(${(fileSize / 1024 / 1024).toFixed(1)} MB)`;
  }
  return '(本地模型)';
}

function createRemoteLive2DModelData(characterId, modelUrl) {
  return {
    modelId: characterId,
    source: 'remote',
    modelUrl: modelUrl,
    cubismVersion: null,
    runtimeType: LIVE2D_RUNTIME_TYPES.LEGACY,
    modelJson: null,
    moc3: null,
    moc: null,
    textures: [],
    motions: {},
    expressions: [],
    physics: null,
    pose: null,
    uploadTime: Date.now(),
    fileSize: 0,
  };
}

function refreshLive2DDisplayForCurrentScene() {
  try {
    refreshGalgameViews();
  } catch (error) {
    console.warn(`[${SCRIPT_NAME}] 刷新 Galgame 视图失败:`, error);
  }
}

async function applyRemoteLive2DModel(characterId, inputUrl) {
  const normalizedUrl = normalizeUserModelUrl(String(inputUrl || '').trim());
  if (!normalizedUrl) {
    throw new Error('请输入远程模型 URL');
  }
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    throw new Error('远程模型 URL 必须以 http:// 或 https:// 开头');
  }
  if (!looksLikeLive2DModelUrl(normalizedUrl)) {
    throw new Error('URL 不是有效的 Live2D 模型 JSON 文件');
  }

  const previousModel = await getLive2DModel(characterId);
  const remoteModelData = createRemoteLive2DModelData(characterId, normalizedUrl);

  const rollback = async () => {
    if (previousModel) {
      await saveLive2DModel(previousModel);
    } else {
      await deleteLive2DModel(characterId);
    }
    if (Live2DManager.models.has(characterId)) {
      Live2DManager.cleanup(characterId);
    }
  };

  await saveLive2DModel(remoteModelData);

  if (Live2DManager.models.has(characterId)) {
    Live2DManager.cleanup(characterId);
  }

  try {
    const loadedModel = await Live2DManager.loadModel(characterId, true);
    if (!loadedModel) {
      throw new Error('远程模型校验失败');
    }
  } catch (error) {
    try {
      await rollback();
    } catch (rollbackError) {
      console.error(`[${SCRIPT_NAME}] Live2D 远程模型回滚失败:`, rollbackError);
    }
    throw new Error(`远程模型加载失败: ${error?.message || error}`);
  }

  // 成功保存后默认启用 Live2D，避免主界面仍走立绘链路。
  setCharacterUseLive2D(characterId, true);
  refreshLive2DDisplayForCurrentScene();
  return remoteModelData;
}

function showLive2DModelSourceDialog(characterId, onSaved) {
  const mountRoot = getModalMountRoot();
  const dialogHtml = `
    <div class="gal-input-modal" id="gal-live2d-source-modal">
      <div class="gal-input-box" style="max-width: 920px; width: 96%; max-height: 90vh; overflow: hidden; padding: 0; display: flex; flex-direction: column;">
        <div class="gal-input-title" style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #eee; margin: 0;">
          <span><i class="fa-solid fa-cube"></i> 选择 Live2D 模型来源</span>
          <button id="gal-live2d-source-close" style="border: none; background: transparent; color: #666; cursor: pointer; font-size: 1.1rem;">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        <div style="padding: 12px 20px; border-bottom: 1px solid #eee; display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="gal-action-btn primary" id="gal-live2d-tab-local" style="padding: 6px 12px;">本地 ZIP</button>
          <button class="gal-action-btn" id="gal-live2d-tab-remote" style="padding: 6px 12px;">远程 URL / 在线库</button>
        </div>
        <div id="gal-live2d-pane-local" style="padding: 18px 20px; overflow-y: auto;">
          <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 16px;">
            <div style="font-size: 0.95rem; color: #334155; margin-bottom: 10px;">
              上传 .zip 格式 Live2D 模型包（支持 Cubism 2.1 / 3.x / 4.x）
            </div>
            <input type="file" id="gal-live2d-local-file" accept=".zip" style="display: none;">
            <button class="gal-action-btn" id="gal-live2d-local-upload" style="padding: 8px 14px;">
              <i class="fa-solid fa-upload"></i> 选择 ZIP 并上传
            </button>
          </div>
        </div>
        <div id="gal-live2d-pane-remote" style="display: none; padding: 18px 20px; overflow-y: auto;">
          <div style="margin-bottom: 12px;">
            <label style="display: block; font-weight: 700; margin-bottom: 6px; color: #111827;">远程模型 URL</label>
            <input type="text" id="gal-live2d-remote-url" placeholder="https://.../model3.json"
                   style="width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-family: monospace; font-size: 0.9rem;">
          </div>
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px;">
            <label style="display: inline-flex; align-items: center; gap: 6px; color: #334155; font-size: 0.85rem;">
              <input type="checkbox" id="gal-live2d-use-cdn" checked>
              在线模型库默认使用 jsDelivr CDN
            </label>
            <button class="gal-action-btn primary" id="gal-live2d-save-remote" style="padding: 8px 14px;">
              <i class="fa-solid fa-check"></i> 验证并保存远程模型
            </button>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #f8fafc;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 8px;">
              <strong style="color: #0f172a;">在线模型库（Eikanya/Live2d-model）</strong>
              <div style="display: flex; gap: 8px;">
                <button class="gal-action-btn" id="gal-live2d-lib-up" style="padding: 4px 10px; font-size: 0.8rem;">
                  <i class="fa-solid fa-arrow-up"></i> 上一级
                </button>
                <button class="gal-action-btn" id="gal-live2d-lib-refresh" style="padding: 4px 10px; font-size: 0.8rem;">
                  <i class="fa-solid fa-rotate"></i> 刷新
                </button>
              </div>
            </div>
            <div style="display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
              <input type="text" id="gal-live2d-lib-filter" placeholder="筛选当前目录..."
                     style="flex: 1; min-width: 200px; box-sizing: border-box; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.85rem;">
            </div>
            <div id="gal-live2d-lib-path" style="font-family: monospace; font-size: 0.8rem; color: #64748b; margin-bottom: 6px;">/</div>
            <div id="gal-live2d-lib-list" style="max-height: 280px; overflow-y: auto; background: #fff; border: 1px solid #dbe2ea; border-radius: 6px;">
              <div style="padding: 16px; color: #64748b; text-align: center;">
                <i class="fa-solid fa-spinner fa-spin"></i> 正在加载目录...
              </div>
            </div>
          </div>
        </div>
        <div style="padding: 12px 20px; border-top: 1px solid #eee; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <span id="gal-live2d-source-status" style="font-size: 0.85rem; color: #64748b;"></span>
          <button class="gal-action-btn" id="gal-live2d-source-cancel" style="padding: 8px 14px;">
            关闭
          </button>
        </div>
      </div>
    </div>
  `;

  $(mountRoot).append(dialogHtml);
  const $dialog = $(mountRoot).find('#gal-live2d-source-modal');
  makeDraggable($dialog.find('.gal-input-box'), $dialog.find('.gal-input-title'));

  const $status = $dialog.find('#gal-live2d-source-status');
  const $localPane = $dialog.find('#gal-live2d-pane-local');
  const $remotePane = $dialog.find('#gal-live2d-pane-remote');
  const $tabLocal = $dialog.find('#gal-live2d-tab-local');
  const $tabRemote = $dialog.find('#gal-live2d-tab-remote');
  const $localUploadBtn = $dialog.find('#gal-live2d-local-upload');
  const $localFileInput = $dialog.find('#gal-live2d-local-file');
  const $remoteInput = $dialog.find('#gal-live2d-remote-url');
  const $useCdn = $dialog.find('#gal-live2d-use-cdn');
  const $saveRemoteBtn = $dialog.find('#gal-live2d-save-remote');
  const $libPath = $dialog.find('#gal-live2d-lib-path');
  const $libList = $dialog.find('#gal-live2d-lib-list');
  const $libFilter = $dialog.find('#gal-live2d-lib-filter');

  const state = {
    currentPath: '',
    entries: [],
    visibleEntries: [],
    selectedEntryPath: '',
    requestSeq: 0,
  };

  const setStatus = (text, isError = false) => {
    $status.text(text || '');
    $status.css('color', isError ? '#dc2626' : '#64748b');
  };

  const closeDialog = () => {
    $dialog.remove();
  };

  const switchTab = (tab) => {
    const isLocal = tab === 'local';
    $localPane.toggle(isLocal);
    $remotePane.toggle(!isLocal);
    $tabLocal.toggleClass('primary', isLocal);
    $tabRemote.toggleClass('primary', !isLocal);
  };

  const renderLibraryEntries = () => {
    const keyword = String($libFilter.val() || '').trim().toLowerCase();
    const list = keyword
      ? state.entries.filter(entry => String(entry.name || '').toLowerCase().includes(keyword))
      : state.entries.slice();
    state.visibleEntries = list;

    if (!list.length) {
      $libList.html(`
        <div style="padding: 14px; color: #64748b; text-align: center;">
          当前目录没有可用条目
        </div>
      `);
      return;
    }

    const html = list
      .map((entry, index) => {
        const isDir = entry.type === 'dir';
        const selected = !isDir && state.selectedEntryPath === entry.path;
        const icon = isDir ? 'fa-folder' : 'fa-file-code';
        const color = isDir ? '#2563eb' : '#1f2937';
        const bg = selected ? '#eff6ff' : '#fff';
        return `
          <button type="button"
                  class="gal-live2d-lib-entry"
                  data-entry-index="${index}"
                  style="width: 100%; text-align: left; border: none; border-bottom: 1px solid #f1f5f9; background: ${bg}; color: #111827; padding: 9px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
            <span style="display: inline-flex; align-items: center; gap: 8px; min-width: 0;">
              <i class="fa-solid ${icon}" style="color: ${color};"></i>
              <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(entry.name)}</span>
            </span>
            <span style="font-size: 0.75rem; color: #94a3b8;">${isDir ? '目录' : '模型'}</span>
          </button>
        `;
      })
      .join('');

    $libList.html(html);
  };

  const loadDirectory = async (path, forceRefresh = false) => {
    const normalizedPath = String(path || '').trim().replace(/^\/+|\/+$/g, '');
    const reqId = ++state.requestSeq;

    state.currentPath = normalizedPath;
    state.entries = [];
    state.visibleEntries = [];
    state.selectedEntryPath = '';

    $libPath.text(`/${normalizedPath}`);
    $libList.html(`
      <div style="padding: 16px; color: #64748b; text-align: center;">
        <i class="fa-solid fa-spinner fa-spin"></i> 正在加载目录...
      </div>
    `);

    if (forceRefresh) {
      clearLive2DDirectoryCache();
    }

    try {
      const entries = await fetchLive2DDirectory(normalizedPath);
      if (!$dialog.closest('body').length || reqId !== state.requestSeq) return;

      state.entries = entries;
      renderLibraryEntries();
      setStatus(`目录 /${normalizedPath || ''} 已加载，共 ${entries.length} 项`);
    } catch (error) {
      if (!$dialog.closest('body').length || reqId !== state.requestSeq) return;

      const msg = error instanceof RateLimitError
        ? error.message
        : `目录加载失败: ${error?.message || error}`;
      setStatus(msg, true);
      $libList.html(`
        <div style="padding: 16px; color: #dc2626; text-align: center;">
          ${escapeHtml(msg)}
        </div>
      `);
    }
  };

  $dialog.find('#gal-live2d-source-close, #gal-live2d-source-cancel').on('click', closeDialog);
  $dialog.on('click', function (e) {
    if (e.target === this) closeDialog();
  });

  $tabLocal.on('click', () => switchTab('local'));
  $tabRemote.on('click', () => switchTab('remote'));

  $localUploadBtn.on('click', () => $localFileInput.trigger('click'));
  $localFileInput.on('change', async function () {
    const file = this.files && this.files[0];
    this.value = '';
    if (!file) return;

    $localUploadBtn.prop('disabled', true);
    setStatus(`正在上传: ${file.name}`);
    try {
      await Live2DUploader.uploadZip(file, characterId);
      setCharacterUseLive2D(characterId, true);
      refreshLive2DDisplayForCurrentScene();
      if (Live2DManager.models.has(characterId)) {
        Live2DManager.cleanup(characterId);
      }
      showToast(`Live2D 模型上传成功: ${characterId}`);
      closeDialog();
      if (typeof onSaved === 'function') await onSaved();
    } catch (error) {
      console.error(`[${SCRIPT_NAME}] Live2D 本地上传失败:`, error);
      setStatus(`上传失败: ${error?.message || error}`, true);
      showToast(`Live2D 上传失败: ${error?.message || error}`, 'error');
    } finally {
      $localUploadBtn.prop('disabled', false);
    }
  });

  $saveRemoteBtn.on('click', async () => {
    const inputValue = String($remoteInput.val() || '').trim();
    if (!inputValue) {
      setStatus('请先输入或选择远程模型 URL', true);
      return;
    }

    $saveRemoteBtn.prop('disabled', true);
    setStatus('正在验证并保存远程模型...');
    try {
      const normalizedUrl = normalizeUserModelUrl(inputValue);
      await applyRemoteLive2DModel(characterId, normalizedUrl);
      showToast(`远程 Live2D 模型已保存: ${characterId}`);
      closeDialog();
      if (typeof onSaved === 'function') await onSaved();
    } catch (error) {
      console.error(`[${SCRIPT_NAME}] 远程 Live2D 保存失败:`, error);
      setStatus(error?.message || String(error), true);
      showToast(`远程模型保存失败: ${error?.message || error}`, 'error');
    } finally {
      $saveRemoteBtn.prop('disabled', false);
    }
  });

  $dialog.find('#gal-live2d-lib-up').on('click', () => {
    const parent = getParentPath(state.currentPath);
    if (parent === state.currentPath) return;
    loadDirectory(parent);
  });

  $dialog.find('#gal-live2d-lib-refresh').on('click', () => {
    loadDirectory(state.currentPath, true);
  });

  $libFilter.on('input', () => {
    renderLibraryEntries();
  });

  $libList.on('click', '.gal-live2d-lib-entry', function () {
    const idx = Number.parseInt($(this).attr('data-entry-index') || '-1', 10);
    const entry = state.visibleEntries[idx];
    if (!entry) return;

    if (entry.type === 'dir') {
      loadDirectory(entry.path);
      return;
    }

    state.selectedEntryPath = entry.path;
    renderLibraryEntries();
    const selectedUrl = buildLibraryModelUrl(entry, $useCdn.prop('checked'));
    if (selectedUrl) {
      $remoteInput.val(selectedUrl);
      setStatus(`已选择模型: ${entry.path}`);
    } else {
      setStatus('该文件无法生成下载地址', true);
    }
  });

  $useCdn.on('change', () => {
    if (!state.selectedEntryPath) return;
    const selectedEntry = state.entries.find(entry => entry.path === state.selectedEntryPath);
    if (!selectedEntry) return;
    const selectedUrl = buildLibraryModelUrl(selectedEntry, $useCdn.prop('checked'));
    if (selectedUrl) {
      $remoteInput.val(selectedUrl);
    }
  });

  switchTab('local');
  setStatus('可上传本地 ZIP，或切换到远程 URL / 在线模型库');
  loadDirectory('');
}

// ============================================
// 瑙掕壊绔嬬粯绠＄悊寮圭獥
// ============================================

export async function showCharacterSpritesModal(characterId, onCloseCallback) {
  const allSpritesData = await getAllSprites();
  const characterSpritesData = allSpritesData.filter(s => s.characterId === characterId);

  const ttsVoiceList = await getTTSVoiceListAsync();
  const boundVoice = getCharacterTTSVoice(characterId);
  const ttsVoiceOptions = ttsVoiceList
    .map(v => `<option value="${v.name}" ${boundVoice === v.name ? 'selected' : ''}>${v.name} (${v.desc})</option>`)
    .join('');

  const modalHtml = `
  <div class="gal-input-modal" id="gal-character-sprites-modal">
    <div class="gal-input-box" style="max-width: 800px; width: 95%; max-height: 90vh; overflow: hidden; padding: 0; display: flex; flex-direction: column;">
      <div style="padding: 20px 25px 15px; border-bottom: 1px solid #e0e0e0; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between;">
        <div class="gal-input-title" style="margin: 0; font-size: 1.4rem;">
          <span><i class="fa-solid fa-user"></i> ${characterId} 的立绘管理</span>
        </div>
        <button id="gal-char-sprites-close" title="关闭" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px; line-height: 1; transition: color 0.2s; transform: none;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0 25px; margin-top: 15px; padding: 15px; border-radius: 8px; color: #fff;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
          <i class="fa-solid fa-microphone-lines" style="font-size: 1.2rem;"></i>
          <span style="font-weight: 600;">TTS 配音音色绑定</span>
        </div>
        <div style="display: flex; gap: 10px;">
          <select id="gal-char-tts-voice-select" style="flex: 1; padding: 8px 12px; border: none; border-radius: 4px; font-size: 0.95rem; cursor: pointer;">
            <option value="">-- 不绑定音色 --</option>
            ${ttsVoiceOptions}
          </select>
          <button class="gal-action-btn" id="gal-char-tts-save-btn" style="padding: 8px 16px; font-size: 0.9rem; background: rgba(255,255,255,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.3); white-space: nowrap;">
            <i class="fa-solid fa-check"></i> 保存
          </button>
        </div>
        <small style="opacity: 0.9; margin-top: 8px; display: block; font-size: 0.8rem;">
          <i class="fa-solid fa-circle-info"></i> 绑定后 AI 会自动为该角色使用此音色配音
        </small>
      </div>
      <div id="gal-char-live2d-section" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #fff; padding: 15px 20px; border-radius: 10px; margin: 0 25px 15px 25px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
          <i class="fa-solid fa-cube" style="font-size: 1.2rem;"></i>
          <span style="font-weight: 600;">Live2D 模型</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <label style="display: flex; align-items: center; cursor: pointer;">
            <input type="checkbox" id="gal-char-live2d-toggle" data-char-id="${characterId}" style="margin-right: 6px; width: 16px; height: 16px;" disabled>
            <span>启用 Live2D</span>
          </label>
          <button class="gal-action-btn" id="gal-char-live2d-upload" data-char-id="${characterId}" style="padding: 6px 12px; font-size: 0.85rem; background: rgba(255,255,255,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.3);">
            <i class="fa-solid fa-upload"></i> 上传模型
          </button>
          <button class="gal-action-btn" id="gal-char-live2d-delete" data-char-id="${characterId}" style="padding: 6px 12px; font-size: 0.85rem; background: rgba(220,53,69,0.8); color: #fff; border: none; display: none;">
            <i class="fa-solid fa-trash"></i> 删除
          </button>
          <button class="gal-action-btn" id="gal-char-live2d-preview" data-char-id="${characterId}" style="padding: 6px 12px; font-size: 0.85rem; background: rgba(255,255,255,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.3); display: none;">
            <i class="fa-solid fa-eye"></i> 预览
          </button>
          <button class="gal-action-btn" id="gal-char-live2d-settings" data-char-id="${characterId}" style="padding: 6px 12px; font-size: 0.85rem; background: rgba(0,210,255,0.3); color: #fff; border: 1px solid rgba(0,210,255,0.5); display: none;">
            <i class="fa-solid fa-cog"></i> 设置
          </button>
          <span id="gal-char-live2d-status" style="font-size: 0.8rem; opacity: 0.9;"></span>
        </div>
        <div id="gal-char-live2d-preview-container" style="display: none; margin-top: 12px; background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden; position: relative;">
          <div id="gal-char-live2d-preview-canvas" style="width: 100%; height: 400px; position: relative;"></div>
          <div style="position: absolute; top: 8px; right: 8px; display: flex; gap: 6px; flex-wrap: wrap;">
            <select id="gal-char-live2d-expr-select" style="padding: 4px 8px; font-size: 0.8rem; background: rgba(0,0,0,0.6); color: #fff; border: 1px solid rgba(255,255,255,0.3); border-radius: 4px;">
              <option value="">选择表情</option>
            </select>
            <select id="gal-char-live2d-motion-select" style="padding: 4px 8px; font-size: 0.8rem; background: rgba(0,0,0,0.6); color: #fff; border: 1px solid rgba(255,255,255,0.3); border-radius: 4px;">
              <option value="">选择动作</option>
            </select>
            <button id="gal-char-live2d-preview-close" style="padding: 4px 10px; font-size: 0.8rem; background: rgba(0,0,0,0.6); color: #fff; border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; cursor: pointer;">
              <i class="fa-solid fa-times"></i> 关闭
            </button>
          </div>
          <div style="position: absolute; bottom: 8px; left: 8px; display: flex; gap: 6px; align-items: center;">
            <span style="color: #fff; font-size: 0.75rem;">缩放:</span>
            <input type="range" id="gal-char-live2d-zoom" min="0.3" max="2" step="0.1" value="1" style="width: 100px;">
            <span id="gal-char-live2d-zoom-value" style="color: #fff; font-size: 0.75rem; min-width: 35px;">100%</span>
          </div>
        </div>
        <small style="opacity: 0.9; margin-top: 8px; display: block; font-size: 0.8rem;">
          <i class="fa-solid fa-circle-info"></i> 上传 .zip 格式 Live2D 模型包（支持 Cubism 2.1/3.x/4.x）
        </small>
      </div>
      <div style="flex: 1; overflow-y: auto; padding: 20px 25px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <span style="font-weight: 700; color: ${THEME.dark};">
            共 ${characterSpritesData.length} 个表情
          </span>
          <button class="gal-action-btn primary" id="gal-char-add-sprite-btn" style="padding: 8px 16px;">
            <i class="fa-solid fa-plus"></i> <span>添加表情</span>
          </button>
        </div>
        ${
          characterSpritesData.length === 0
            ? `<div style="text-align: center; padding: 40px; color: #999;">
                <i class="fa-solid fa-images" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                <p>该角色暂无立绘，点击上方按钮添加</p>
              </div>`
            : `<div class="gal-sprite-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px;">
                ${characterSpritesData.map(s => `
                  <div class="gal-sprite-card" data-char="${s.characterId}" data-expr="${s.expression}" style="position: relative; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.1); transition: transform 0.2s; cursor: pointer;">
                    <div class="gal-sprite-preview" style="aspect-ratio: 2 / 3; background: #eee; overflow: hidden;">
                      ${s.imageUrl
                        ? `<img src="${s.imageUrl}" alt="${s.expression}" style="width: 100%; height: 100%; object-fit: cover;">`
                        : s.imageBlob
                          ? `<img src="${URL.createObjectURL(s.imageBlob)}" alt="${s.expression}" style="width: 100%; height: 100%; object-fit: cover;">`
                          : ''}
                    </div>
                    <div class="gal-sprite-label" style="padding: 8px; text-align: center; font-size: 0.8rem; font-weight: 600; color: ${THEME.dark}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${s.expression}</div>
                    <div class="gal-sprite-actions" style="position: absolute; top: 4px; right: 4px; display: flex; gap: 3px;">
                      <button class="gal-sprite-delete" data-char="${s.characterId}" data-expr="${s.expression}" title="删除" style="width: 24px; height: 24px; border: none; border-radius: 50%; background: rgba(255,0,85,0.9); color: #fff; font-size: 0.7rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <i class="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>`
        }
      </div>
      <!-- 底部按钮栏已移除，关闭按钮在右上角 -->
    </div>
  </div>
  <style>
    #gal-character-sprites-modal .gal-sprite-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    #gal-character-sprites-modal .gal-sprite-delete {
      opacity: 0;
      transition: opacity 0.2s;
    }
    #gal-character-sprites-modal .gal-sprite-card:hover .gal-sprite-delete {
      opacity: 1;
    }
  </style>
  `;

  const mountRoot = getModalMountRoot();
  $(mountRoot).append(modalHtml);
  const $modal = $(mountRoot).find('#gal-character-sprites-modal');

  const cleanupLive2DStageMount = () => {
    try {
      const modalEl = $modal[0];
      const stageMountEl = Live2DStage?.mountEl;
      const mountedInsideModal = !!(modalEl && stageMountEl && modalEl.contains(stageMountEl));
      if ($modal.find('#gal-char-live2d-preview-container').is(':visible') || mountedInsideModal) {
        Live2DStage.popMount();
      }
    } catch (e) {}
  };

  const removeModal = () => {
    cleanupLive2DStageMount();
    $modal.remove();
  };

  const handleClose = () => {
    removeModal();
    if (typeof onCloseCallback === 'function') {
      try { onCloseCallback(); } catch (e) {
        console.warn(`[${SCRIPT_NAME}] 回调执行失败:`, e);
      }
    }
  };

  $modal.find('#gal-char-sprites-close').on('click', handleClose);
  $modal.on('click', function (e) {
    if (e.target === this) handleClose();
  });

  $('#gal-char-add-sprite-btn').on('click', async () => {
    removeModal();
    if (_showSpriteUploadDialogRef) await _showSpriteUploadDialogRef(characterId, '默认', () => showCharacterSpritesModal(characterId));
  });

  $('#gal-char-tts-save-btn').on('click', () => {
    const voiceName = $('#gal-char-tts-voice-select').val();
    setCharacterTTSVoice(characterId, voiceName);
    if (voiceName) {
      showToast(`已绑定音色: ${characterId} -> ${voiceName}`);
    } else {
      showToast(`已清除音色绑定: ${characterId}`);
    }
    removeModal();
    showCharacterSpritesModal(characterId);
  });

  // Live2D control initialization
  (async () => {
    const hasModel = await hasLive2DModel(characterId);
    const useLive2D = getCharacterUseLive2D(characterId);
    const $toggle = $('#gal-char-live2d-toggle');
    const $uploadBtn = $('#gal-char-live2d-upload');
    const $deleteBtn = $('#gal-char-live2d-delete');
    const $previewBtn = $('#gal-char-live2d-preview');
    const $settingsBtn = $('#gal-char-live2d-settings');
    const $status = $('#gal-char-live2d-status');

    $toggle.prop('disabled', !hasModel);
    $toggle.prop('checked', useLive2D && hasModel);
    $uploadBtn.html(hasModel ? '<i class="fa-solid fa-sync"></i> 更换模型' : '<i class="fa-solid fa-upload"></i> 上传模型');
    $deleteBtn.css('display', hasModel ? '' : 'none');
    $previewBtn.css('display', hasModel ? '' : 'none');
    $settingsBtn.css('display', hasModel ? '' : 'none');

    if (hasModel) {
      const modelData = await getLive2DModel(characterId);
      if (modelData) {
        $status.text(formatLive2DModelStatus(modelData));
        if (modelData.source === 'remote' && modelData.modelUrl) {
          $status.attr('title', modelData.modelUrl);
        } else {
          $status.removeAttr('title');
        }
      }
    }
  })();

  $('#gal-char-live2d-toggle').on('change', function() {
    const useLive2D = this.checked;
    setCharacterUseLive2D(characterId, useLive2D);
    refreshLive2DDisplayForCurrentScene();
    showToast(useLive2D ? `已为 ${characterId} 启用 Live2D` : `已为 ${characterId} 关闭 Live2D`);
  });

    $('#gal-char-live2d-upload').on('click', function() {
    showLive2DModelSourceDialog(characterId, async () => {
      removeModal();
      showCharacterSpritesModal(characterId);
    });
  });

  $('#gal-char-live2d-delete').on('click', async function() {
    if (!confirm(`确定删除角色 "${characterId}" 的 Live2D 模型吗？`)) return;
    try {
      await deleteLive2DModel(characterId);
      setCharacterUseLive2D(characterId, false);
      refreshLive2DDisplayForCurrentScene();
      if (Live2DManager.models.has(characterId)) {
        Live2DManager.cleanup(characterId);
      }
      showToast('Live2D 模型已删除');
      removeModal();
      showCharacterSpritesModal(characterId);
    } catch (err) {
      console.error(`[${SCRIPT_NAME}] Live2D 删除失败:`, err);
      showToast(`删除失败: ${err.message}`, 'error');
    }
  });

  $('#gal-char-live2d-preview').on('click', async function() {
    const $previewContainer = $('#gal-char-live2d-preview-container');
    const $previewCanvas = $('#gal-char-live2d-preview-canvas');
    const $exprSelect = $('#gal-char-live2d-expr-select');
    const $motionSelect = $('#gal-char-live2d-motion-select');
    const $zoomSlider = $('#gal-char-live2d-zoom');
    const $zoomValue = $('#gal-char-live2d-zoom-value');
    const EMPTY_MOTION_GROUP_VALUE = '__gal_empty_motion_group__';

    if ($previewContainer.is(':visible')) {
      Live2DStage.popMount();
      $previewContainer.hide();
      return;
    }

    $previewContainer.show();
    $previewCanvas.html('<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #fff;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem;"></i></div>');
    $zoomSlider.val(1);
    $zoomValue.text('100%');

    try {
      const model = await Live2DManager.loadModel(characterId);
      if (!model) {
        $previewCanvas.html('<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #ff6b6b;">模型加载失败</div>');
        return;
      }
      $previewCanvas.empty();
      Live2DStage.pushMount($previewCanvas[0], { mode: 'single', focusCharacterId: characterId });
      if (!Live2DStage.attach(characterId, model, 'left', { entering: false })) {
        Live2DStage.popMount();
        $previewCanvas.html('<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #ff6b6b;">预览失败：无法挂载舞台</div>');
        return;
      }

      const refreshPreviewSelectors = () => {
        const selectedExpr = $exprSelect.val();
        const selectedMotion = $motionSelect.val();

        const expressions = getLive2DExpressionList(characterId);
        $exprSelect.empty().append('<option value="">选择表情</option>');
        if (expressions.length > 0) {
          expressions.forEach(expr => {
            const $option = $('<option></option>');
            $option.val(expr).text(expr);
            $exprSelect.append($option);
          });
        } else {
          $exprSelect.append('<option value="" disabled>无可用表情</option>');
        }
        if (selectedExpr) {
          $exprSelect.val(selectedExpr);
        }

        const motionGroups = getLive2DMotionGroups(characterId);
        $motionSelect.empty().append('<option value="">选择动作</option>');
        if (motionGroups.length > 0) {
          motionGroups.forEach(group => {
            const rawGroup = String(group ?? '');
            const optionValue = rawGroup === '' ? EMPTY_MOTION_GROUP_VALUE : rawGroup;
            const optionLabel = rawGroup === '' ? '(空动作组)' : rawGroup;
            const $option = $('<option></option>');
            $option.val(optionValue).text(optionLabel);
            $motionSelect.append($option);
          });
        } else {
          $motionSelect.append('<option value="" disabled>无可用动作</option>');
        }
        if (selectedMotion) {
          $motionSelect.val(selectedMotion);
        }

        return { expressionsCount: expressions.length, motionGroupCount: motionGroups.length };
      };

      let retryCount = 0;
      const maxRetries = 8;
      const retryDelayMs = 220;
      const retryRefresh = () => {
        if (!Live2DManager.models.has(characterId)) return;
        if (!$previewContainer.is(':visible')) return;
        if (!Live2DStage.canvas?.isConnected) {
          const remounted = Live2DStage.ensureMounted($previewCanvas[0], { mode: 'single' });
          if (!remounted || !Live2DStage.attach(characterId, model, 'left', { entering: false })) {
            console.warn(`[${SCRIPT_NAME}] Live2D 预览重挂载失败: ${characterId}`);
            return;
          }
        }

        const { expressionsCount, motionGroupCount } = refreshPreviewSelectors();
        if (expressionsCount > 0 && motionGroupCount > 0) {
          console.log(`[${SCRIPT_NAME}] Live2D 预览已启动: ${characterId}, 表情=${expressionsCount}, 动作组=${motionGroupCount}`);
          return;
        }
        if (retryCount >= maxRetries) {
          console.log(`[${SCRIPT_NAME}] Live2D 预览已启动: ${characterId}, 表情=${expressionsCount}, 动作组=${motionGroupCount} (重试结束)`);
          return;
        }

        retryCount++;
        setTimeout(retryRefresh, retryDelayMs);
      };

      retryRefresh();
    } catch (err) {
      console.error(`[${SCRIPT_NAME}] Live2D 预览失败:`, err);
      $previewCanvas.html(`<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #ff6b6b;">预览失败: ${err.message}</div>`);
    }
  });

  $('#gal-char-live2d-preview-close').on('click', function() {
    Live2DStage.popMount();
    $('#gal-char-live2d-preview-container').hide();
  });

  $('#gal-char-live2d-zoom').on('input', function() {
    const zoomFactor = parseFloat($(this).val());
    $('#gal-char-live2d-zoom-value').text(Math.round(zoomFactor * 100) + '%');
    Live2DManager.setZoom(characterId, zoomFactor);
  });

  $('#gal-char-live2d-expr-select').on('change', function() {
    const value = $(this).val();
    if (!value) return;
    const model = Live2DManager.models.get(characterId);
    if (!model) return;
    try { model.expression(value); console.log(`[${SCRIPT_NAME}] 设置表情: ${value}`); }
    catch (e) { console.warn(`[${SCRIPT_NAME}] 设置表情失败:`, e); }
  });

  $('#gal-char-live2d-motion-select').on('change', function() {
    const rawValue = $(this).val();
    if (rawValue === null || rawValue === undefined || rawValue === '') return;
    const value = rawValue === '__gal_empty_motion_group__' ? '' : rawValue;
    const model = Live2DManager.models.get(characterId);
    if (!model) return;
    try { model.motion(value, 0, 'FORCE'); console.log(`[${SCRIPT_NAME}] 播放动作: ${value}`); }
    catch (e) { console.warn(`[${SCRIPT_NAME}] 播放动作失败:`, e); }
  });

  $('#gal-char-live2d-settings').on('click', async function() {
    await showLive2DSettingsModal(characterId);
  });

  $modal.find('.gal-sprite-card').on('click', async function (e) {
    if ($(e.target).closest('.gal-sprite-delete').length) return;
    const charId = $(this).data('char');
    const expr = $(this).data('expr');
    removeModal();
    if (_showSpriteUploadDialogRef) await _showSpriteUploadDialogRef(charId, expr, () => showCharacterSpritesModal(charId));
  });

  $modal.find('.gal-sprite-delete').on('click', async function (e) {
    e.stopPropagation();
    const $btn = $(this);
    const charId = $btn.attr('data-char');
    const expr = $btn.attr('data-expr');
    if (confirm(`确定删除 ${charId} 的表情「${expr}」吗？`)) {
      await deleteSprite(charId, expr);
      showToast(`已删除：${charId} - ${expr}`);
      removeModal();
      showCharacterSpritesModal(charId);
    }
  });
}

// ============================================
// 鍥惧寘绠＄悊寮圭獥
// ============================================

export async function showPackManagerModal() {
  const allPacks = await getAllImagePacks();
  const currentPackId = getCurrentPackId();

  const packStats = new Map();
  for (const pack of allPacks) {
    const stats = await getPackResourceCount(pack.id);
    packStats.set(pack.id, stats);
  }

  const modalHtml = `
    <div class="gal-input-modal" id="gal-pack-manager-modal">
      <div class="gal-input-box" style="width: 500px; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column;">
        <div class="gal-input-title" style="display: flex; justify-content: space-between; align-items: center;">
          <span><i class="fa-solid fa-layer-group"></i> 图包管理</span>
          <button class="gal-close-btn" id="gal-pack-manager-close" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #666;">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        <div style="flex: 1; overflow-y: auto; padding: 15px;">
          <div style="margin-bottom: 15px;">
            <button class="gal-action-btn primary" id="gal-create-pack-btn" style="padding: 8px 16px;">
              <i class="fa-solid fa-plus"></i> 新建图包
            </button>
          </div>
          <div class="gal-pack-list" style="display: flex; flex-direction: column; gap: 10px;">
            ${allPacks.map(pack => {
              const stats = packStats.get(pack.id) || { sprites: 0, backgrounds: 0 };
              const isDefault = pack.id === DEFAULT_PACK_ID;
              const isCurrent = pack.id === currentPackId;
              return `
                <div class="gal-pack-row" data-pack-id="${pack.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 15px; background: ${isCurrent ? '#e8f4fd' : '#f8f9fa'}; border: 2px solid ${isCurrent ? '#0d6efd' : '#dee2e6'}; border-radius: 8px;">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <i class="fa-solid fa-folder${isCurrent ? '-open' : ''}" style="font-size: 1.5rem; color: ${isCurrent ? '#0d6efd' : '#6c757d'};"></i>
                    <div>
                      <div style="font-weight: 700; color: #333; display: flex; align-items: center; gap: 8px;">
                        <span class="pack-name-display">${pack.name}</span>
                        ${isDefault ? '<span style="font-size: 0.7rem; background: #6f42c1; color: #fff; padding: 2px 6px; border-radius: 3px;">默认</span>' : ''}
                        ${isCurrent ? '<span style="font-size: 0.7rem; background: #0d6efd; color: #fff; padding: 2px 6px; border-radius: 3px;">当前</span>' : ''}
                      </div>
                      <div style="font-size: 0.8rem; color: #666; margin-top: 4px;">
                        <i class="fa-solid fa-user"></i> ${stats.sprites} 个立绘&nbsp;|&nbsp;
                        <i class="fa-solid fa-image"></i> ${stats.backgrounds} 个背景
                      </div>
                    </div>
                  </div>
                  <div style="display: flex; gap: 8px;">
                    ${!isCurrent ? `<button class="gal-pack-select-btn gal-action-btn" data-pack-id="${pack.id}" style="padding: 6px 12px; font-size: 0.8rem; background: #0d6efd; color: #fff; border-color: #0d6efd;" title="切换到此图包"><i class="fa-solid fa-check"></i></button>` : ''}
                    ${!isDefault ? `<button class="gal-pack-rename-btn gal-action-btn" data-pack-id="${pack.id}" style="padding: 6px 12px; font-size: 0.8rem;" title="重命名"><i class="fa-solid fa-pen"></i></button>` : ''}
                    ${!isDefault ? `<button class="gal-pack-delete-btn gal-action-btn" data-pack-id="${pack.id}" style="padding: 6px 12px; font-size: 0.8rem; background: #dc3545; color: #fff; border-color: #dc3545;" title="删除"><i class="fa-solid fa-trash"></i></button>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  const mountRoot = getModalMountRoot();
  $(mountRoot).append(modalHtml);
  const $modal = $(mountRoot).find('#gal-pack-manager-modal');

  $modal.find('#gal-pack-manager-close').on('click', () => $modal.remove());
  $modal.on('click', function (e) { if (e.target === this) $modal.remove(); });

  $modal.find('#gal-create-pack-btn').on('click', () => {
    const name = prompt('请输入新图包名称：');
    if (name && name.trim()) {
      createImagePack(name.trim()).then(() => { $modal.remove(); showPackManagerModal(); });
    }
  });

  $modal.find('.gal-pack-select-btn').on('click', function () {
    const packId = $(this).data('pack-id');
    setCurrentPack(packId);
    $modal.remove();
    showPackManagerModal();
    showToast('已切换图包');
  });

  $modal.find('.gal-pack-rename-btn').on('click', function () {
    const packId = $(this).data('pack-id');
    const $row = $(this).closest('.gal-pack-row');
    const currentName = $row.find('.pack-name-display').text();
    const newName = prompt('请输入新名称：', currentName);
    if (newName && newName.trim() && newName.trim() !== currentName) {
      renameImagePack(packId, newName.trim()).then(() => {
        $modal.remove(); showPackManagerModal(); showToast('已重命名图包');
      }).catch(err => { alert('重命名失败: ' + err.message); });
    }
  });

  $modal.find('.gal-pack-delete-btn').on('click', function () {
    const packId = $(this).data('pack-id');
    const $row = $(this).closest('.gal-pack-row');
    const packName = $row.find('.pack-name-display').text();
    if (confirm(`确定要删除图包 "${packName}" 吗？\n\n该图包内资源将转移到“未分类”图包。`)) {
      deleteImagePack(packId).then(() => {
        $modal.remove(); showPackManagerModal(); showToast('图包已删除，资源已转移');
      }).catch(err => { alert('删除失败: ' + err.message); });
    }
  });
}

// ============================================
// 璧勬簮杞Щ瀵硅瘽妗?
// ============================================

export async function showTransferDialog(resourceType, resourceIds, onComplete) {
  const allPacks = await getAllImagePacks();
  const currentPackId = getCurrentPackId();

  const modalHtml = `
    <div class="gal-input-modal" id="gal-transfer-modal">
      <div class="gal-input-box" style="width: 400px;">
        <div class="gal-input-title" style="display: flex; align-items: center; justify-content: space-between;">
          <span><i class="fa-solid fa-arrow-right-arrow-left"></i> 转移资源</span>
          <button id="gal-transfer-close-x" title="关闭" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px; line-height: 1; transition: color 0.2s; transform: none;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div style="padding: 20px;">
          <p style="margin-bottom: 15px; color: #333;">
            将 <strong>${resourceIds.length}</strong> 个${resourceType === 'sprite' ? '立绘' : '背景'}转移到：
          </p>
          <select id="gal-transfer-target" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 1rem;">
            ${allPacks.filter(p => p.id !== currentPackId).map(pack => `
              <option value="${pack.id}">${pack.name}</option>
            `).join('')}
          </select>
          <div style="display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end;">
            <button class="gal-action-btn primary" id="gal-transfer-confirm" style="padding: 8px 16px;">
              <i class="fa-solid fa-check"></i> 确认转移
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const mountRoot = getModalMountRoot();
  $(mountRoot).append(modalHtml);
  const $modal = $(mountRoot).find('#gal-transfer-modal');

  $modal.find('#gal-transfer-close-x').on('click', () => $modal.remove());
  $modal.on('click', function (e) { if (e.target === this) $modal.remove(); });

  $modal.find('#gal-transfer-confirm').on('click', () => {
    const targetPackId = $modal.find('#gal-transfer-target').val();
    if (!targetPackId) { alert('请选择目标图包'); return; }
    const transferPromise = resourceType === 'sprite'
      ? transferSpritesToPack(resourceIds, targetPackId)
      : transferBackgroundsToPack(resourceIds, targetPackId);
    transferPromise.then(count => {
      $modal.remove();
      showToast(`已转移 ${count} 个${resourceType === 'sprite' ? '立绘' : '背景'}`);
      if (typeof onComplete === 'function') onComplete();
    }).catch(err => { alert('转移失败: ' + err.message); });
  });
}

// ============================================
// showAssetManagerModal 鐨勫墠鍚戝０鏄?(瀹為檯瀹炵幇鍦?asset-manager-modal.js)
// ============================================
let _showAssetManagerModalRef = null;

export function setAssetManagerModalRef(fn) {
  _showAssetManagerModalRef = fn;
}

function showAssetManagerModal(activeTab) {
  if (_showAssetManagerModalRef) _showAssetManagerModalRef(activeTab);
}

export { renderBananaAppearanceList, refreshBananaAppearancePreviews };

