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
import { hasLive2DModel, getLive2DModel, deleteLive2DModel } from '../db/live2d-models.js';
import { getCharacterUseLive2D, setCharacterUseLive2D } from '../live2d/render-mode.js';
import { Live2DManager } from '../live2d/manager.js';
import { Live2DStage } from '../live2d/stage.js';
import { Live2DUploader } from '../live2d/uploader.js';
import { getLive2DExpressionList, getLive2DMotionGroups } from '../live2d/expression-motion.js';
import { injectCOTToWorldbook } from '../logic/worldbook.js';
import { parseBananaImageFromResponse } from '../image-gen/banana-image.js';
import { getModalMountRoot } from './fullscreen.js';
import { showToast } from './toast.js';
import { makeDraggable } from './interaction.js';
import { showLive2DSettingsModal } from './live2d-settings-modal.js';
import { importAssetsFromJson, AssetIO, showRemoteZipImportDialog, importFromZipFile, showImportError } from './asset-io.js';

// 延迟引用
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
// 大香蕉外观列表渲染
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

// ============================================
// 角色立绘管理弹窗
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
      <div style="padding: 20px 25px 15px; border-bottom: 1px solid #e0e0e0; flex-shrink: 0;">
        <div class="gal-input-title" style="margin: 0; font-size: 1.4rem;">
          <span><i class="fa-solid fa-user"></i> ${characterId} 的立绘管理</span>
        </div>
      </div>
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0 25px; margin-top: 15px; padding: 15px; border-radius: 8px; color: #fff;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
          <i class="fa-solid fa-microphone-lines" style="font-size: 1.2rem;"></i>
          <span style="font-weight: 600;">TTS配音音色绑定</span>
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
          <i class="fa-solid fa-circle-info"></i> 绑定后AI会自动为该角色使用此音色配音
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
          <i class="fa-solid fa-circle-info"></i> 上传 .zip 格式的 Live2D 模型包（支持 Cubism 2.1/3.x/4.x）
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
      <div style="padding: 15px 25px; border-top: 1px solid #e0e0e0; flex-shrink: 0; display: flex; gap: 10px;">
        <button class="gal-action-btn" id="gal-char-sprites-back" style="flex: 1; min-height: 44px;">
          <i class="fa-solid fa-arrow-left"></i> <span>返回</span>
        </button>
        <button class="gal-action-btn" id="gal-char-sprites-close" style="flex: 1; min-height: 44px;">
          <span>关闭</span>
        </button>
      </div>
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
      if ($modal.find('#gal-char-live2d-preview-container').is(':visible')) {
        Live2DStage.popMount();
      }
    } catch (e) {}
  };

  const handleClose = () => {
    cleanupLive2DStageMount();
    $modal.remove();
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

  $('#gal-char-sprites-back').on('click', () => {
    cleanupLive2DStageMount();
    $modal.remove();
    showAssetManagerModal();
  });

  $('#gal-char-add-sprite-btn').on('click', async () => {
    $modal.remove();
    if (_showSpriteUploadDialogRef) await _showSpriteUploadDialogRef(characterId, '默认', () => showCharacterSpritesModal(characterId));
  });

  $('#gal-char-tts-save-btn').on('click', () => {
    const voiceName = $('#gal-char-tts-voice-select').val();
    setCharacterTTSVoice(characterId, voiceName);
    if (voiceName) {
      showToast(`已绑定: ${characterId} → ${voiceName}`);
    } else {
      showToast(`已清除 ${characterId} 的音色绑定`);
    }
    $modal.remove();
    showCharacterSpritesModal(characterId);
  });

  // Live2D 控件初始化
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
        const sizeMB = (modelData.fileSize / 1024 / 1024).toFixed(1);
        $status.text(`(${sizeMB} MB)`);
      }
    }
  })();

  $('#gal-char-live2d-toggle').on('change', function() {
    const useLive2D = this.checked;
    setCharacterUseLive2D(characterId, useLive2D);
    showToast(useLive2D ? `已启用 ${characterId} 的 Live2D` : `已禁用 ${characterId} 的 Live2D`);
  });

  $('#gal-char-live2d-upload').on('click', function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const $status = $('#gal-char-live2d-status');
      const $uploadBtn = $('#gal-char-live2d-upload');
      try {
        $status.text('上传中...');
        $uploadBtn.prop('disabled', true);
        await Live2DUploader.uploadZip(file, characterId);
        showToast(`Live2D 模型上传成功: ${characterId}`);
        if (Live2DManager.models.has(characterId)) {
          Live2DManager.cleanup(characterId);
        }
        $modal.remove();
        showCharacterSpritesModal(characterId);
      } catch (err) {
        console.error(`[${SCRIPT_NAME}] Live2D 上传失败:`, err);
        showToast(`上传失败: ${err.message}`, 'error');
        $status.text('上传失败');
        $uploadBtn.prop('disabled', false);
      }
    };
    input.click();
  });

  $('#gal-char-live2d-delete').on('click', async function() {
    if (!confirm(`确定删除角色 "${characterId}" 的 Live2D 模型吗？`)) return;
    try {
      await deleteLive2DModel(characterId);
      setCharacterUseLive2D(characterId, false);
      if (Live2DManager.models.has(characterId)) {
        Live2DManager.cleanup(characterId);
      }
      showToast('Live2D 模型已删除');
      $modal.remove();
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

      const expressions = getLive2DExpressionList(characterId);
      $exprSelect.empty().append('<option value="">选择表情</option>');
      if (expressions.length > 0) {
        expressions.forEach(expr => { $exprSelect.append(`<option value="${expr}">${expr}</option>`); });
      } else {
        $exprSelect.append('<option value="" disabled>无可用表情</option>');
      }

      const motionGroups = getLive2DMotionGroups(characterId);
      $motionSelect.empty().append('<option value="">选择动作</option>');
      if (motionGroups.length > 0) {
        motionGroups.forEach(group => { $motionSelect.append(`<option value="${group}">${group}</option>`); });
      } else {
        $motionSelect.append('<option value="" disabled>无可用动作</option>');
      }

      console.log(`[${SCRIPT_NAME}] Live2D 预览已启动: ${characterId}, 表情: ${expressions.length}, 动作组: ${motionGroups.length}`);
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
    catch (e) { console.warn(`[${SCRIPT_NAME}] 表情设置失败:`, e); }
  });

  $('#gal-char-live2d-motion-select').on('change', function() {
    const value = $(this).val();
    if (!value) return;
    const model = Live2DManager.models.get(characterId);
    if (!model) return;
    try { model.motion(value, 0, 'FORCE'); console.log(`[${SCRIPT_NAME}] 播放动作: ${value}`); }
    catch (e) { console.warn(`[${SCRIPT_NAME}] 动作播放失败:`, e); }
  });

  $('#gal-char-live2d-settings').on('click', async function() {
    await showLive2DSettingsModal(characterId);
  });

  $modal.find('.gal-sprite-card').on('click', async function (e) {
    if ($(e.target).closest('.gal-sprite-delete').length) return;
    const charId = $(this).data('char');
    const expr = $(this).data('expr');
    $modal.remove();
    if (_showSpriteUploadDialogRef) await _showSpriteUploadDialogRef(charId, expr, () => showCharacterSpritesModal(charId));
  });

  $modal.find('.gal-sprite-delete').on('click', async function (e) {
    e.stopPropagation();
    const $btn = $(this);
    const charId = $btn.attr('data-char');
    const expr = $btn.attr('data-expr');
    if (confirm(`确定删除 ${charId} 的「${expr}」表情吗？`)) {
      await deleteSprite(charId, expr);
      showToast(`已删除: ${charId} - ${expr}`);
      $modal.remove();
      showCharacterSpritesModal(charId);
    }
  });
}

// ============================================
// 图包管理弹窗
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
                        <i class="fa-solid fa-user"></i> ${stats.sprites} 个立绘 &nbsp;|&nbsp;
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
      }).catch(err => { alert('重命名失败：' + err.message); });
    }
  });

  $modal.find('.gal-pack-delete-btn').on('click', function () {
    const packId = $(this).data('pack-id');
    const $row = $(this).closest('.gal-pack-row');
    const packName = $row.find('.pack-name-display').text();
    if (confirm(`确定要删除图包"${packName}"吗？\n\n该图包内的所有资源将被转移到"未定义"图包。`)) {
      deleteImagePack(packId).then(() => {
        $modal.remove(); showPackManagerModal(); showToast('已删除图包，资源已转移');
      }).catch(err => { alert('删除失败：' + err.message); });
    }
  });
}

// ============================================
// 资源转移对话框
// ============================================

export async function showTransferDialog(resourceType, resourceIds, onComplete) {
  const allPacks = await getAllImagePacks();
  const currentPackId = getCurrentPackId();

  const modalHtml = `
    <div class="gal-input-modal" id="gal-transfer-modal">
      <div class="gal-input-box" style="width: 400px;">
        <div class="gal-input-title">
          <span><i class="fa-solid fa-arrow-right-arrow-left"></i> 转移资源</span>
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
            <button class="gal-action-btn" id="gal-transfer-cancel" style="padding: 8px 16px;">取消</button>
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

  $modal.find('#gal-transfer-cancel').on('click', () => $modal.remove());
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
    }).catch(err => { alert('转移失败：' + err.message); });
  });
}

// ============================================
// showAssetManagerModal 的前向声明 (实际实现在 asset-manager-modal.js)
// ============================================
let _showAssetManagerModalRef = null;

export function setAssetManagerModalRef(fn) {
  _showAssetManagerModalRef = fn;
}

function showAssetManagerModal(activeTab) {
  if (_showAssetManagerModalRef) _showAssetManagerModalRef(activeTab);
}

export { renderBananaAppearanceList, refreshBananaAppearancePreviews };
