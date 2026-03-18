import { SCRIPT_NAME } from '../core/constants.js';
import { saveSpecialCg } from '../db/special-cgs.js';
import { getModalMountRoot } from './fullscreen.js';
import { makeDraggable } from './interaction.js';
import { showToast } from './toast.js';

function buildCgIdFromFilename(filename, fallbackIndex = 0) {
  const base = String(filename || '')
    .replace(/\.[^/.]+$/, '')
    .trim()
    .replace(/\s+/g, '_');
  return base || `special_cg_${Date.now()}_${fallbackIndex}`;
}

function closeWithCallback($modal, onCloseCallback) {
  $modal.remove();
  if (typeof onCloseCallback === 'function') {
    try {
      onCloseCallback();
    } catch (error) {
      console.warn(`[${SCRIPT_NAME}] 特殊CG上传回调执行失败:`, error);
    }
  }
}

export function showSpecialCgUploadDialog(onCloseCallback) {
  const modalHtml = `
    <div class="gal-input-modal gal-cg-upload-modal" id="gal-special-cg-upload-modal">
      <div class="gal-cg-upload-shell gal-cg-upload-shell-single">
        <div class="gal-cg-upload-header">
          <div class="gal-cg-upload-title"><i class="fa-solid fa-photo-film"></i> 添加特殊CG</div>
          <button id="gal-special-cg-close-x" class="gal-cg-upload-close" title="关闭">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="gal-cg-upload-body">
          <div class="gal-cg-upload-form-grid">
            <label class="gal-cg-upload-field">
              <span class="gal-cg-upload-label">CG ID</span>
              <input type="text" class="gal-cg-upload-input" id="gal-special-cg-id" placeholder="例如：cg_elly_confession">
            </label>
            <label class="gal-cg-upload-field">
              <span class="gal-cg-upload-label">显示名称（可选）</span>
              <input type="text" class="gal-cg-upload-input" id="gal-special-cg-name" placeholder="例如：艾莉告白CG">
            </label>
          </div>

          <input type="file" id="gal-special-cg-file-input" accept="image/*" style="display:none;">
          <div class="gal-cg-upload-dropzone" id="gal-special-cg-upload-trigger">
            <i class="fa-solid fa-cloud-arrow-up"></i>
            <span>点击选择CG图片</span>
            <small>支持 png / jpg / webp</small>
          </div>

          <div class="gal-cg-upload-preview" id="gal-special-cg-preview-container" style="display: none;">
            <img id="gal-special-cg-preview-img" class="gal-cg-upload-preview-img" alt="CG预览">
          </div>

          <div class="gal-cg-upload-actions">
            <button class="gal-action-btn primary gal-cg-upload-primary-btn" id="gal-special-cg-confirm-btn" disabled>
              <i class="fa-solid fa-save"></i>
              <span>保存CG</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const mountRoot = getModalMountRoot();
  $(mountRoot).append(modalHtml);
  const $modal = $(mountRoot).find('#gal-special-cg-upload-modal');
  makeDraggable($modal.find('.gal-cg-upload-shell'), $modal.find('.gal-cg-upload-header'));

  const $fileInput = $modal.find('#gal-special-cg-file-input');
  const $uploadArea = $modal.find('#gal-special-cg-upload-trigger');
  const $previewContainer = $modal.find('#gal-special-cg-preview-container');
  const $previewImg = $modal.find('#gal-special-cg-preview-img');
  const $cgIdInput = $modal.find('#gal-special-cg-id');
  const $cgNameInput = $modal.find('#gal-special-cg-name');
  const $confirmBtn = $modal.find('#gal-special-cg-confirm-btn');
  let selectedFile = null;

  const updateConfirmState = () => {
    const hasFile = !!selectedFile;
    const hasCgId = String($cgIdInput.val() || '').trim().length > 0;
    $confirmBtn.prop('disabled', !(hasFile && hasCgId));
  };

  const renderPreview = file => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      $previewImg.attr('src', e.target?.result || '');
      $previewContainer.show();
      $uploadArea.hide();
      updateConfirmState();
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelected = file => {
    if (!file) return;
    selectedFile = file;
    if (!String($cgIdInput.val() || '').trim()) {
      $cgIdInput.val(buildCgIdFromFilename(file.name));
    }
    if (!String($cgNameInput.val() || '').trim()) {
      $cgNameInput.val(buildCgIdFromFilename(file.name));
    }
    renderPreview(file);
  };

  const close = () => closeWithCallback($modal, onCloseCallback);

  $uploadArea.on('click', () => $fileInput.click());
  $previewContainer.on('click', () => $fileInput.click());
  $fileInput.on('change', function () {
    handleFileSelected(this.files?.[0] || null);
  });
  $cgIdInput.on('input', updateConfirmState);
  $modal.find('#gal-special-cg-close-x').on('click', close);
  $modal.on('click', function (e) {
    if (e.target === this) close();
  });

  $confirmBtn.on('click', async function () {
    const cgId = String($cgIdInput.val() || '').trim();
    const name = String($cgNameInput.val() || '').trim();
    if (!cgId || !selectedFile) return;
    $confirmBtn.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i><span>保存中...</span>');
    try {
      await saveSpecialCg(cgId, selectedFile, null, { name: name || cgId });
      showToast(`特殊CG已保存: ${cgId}`);
      close();
    } catch (error) {
      console.error(`[${SCRIPT_NAME}] 保存特殊CG失败:`, error);
      showToast(`保存失败: ${error?.message || error}`);
      updateConfirmState();
      $confirmBtn.html('<i class="fa-solid fa-save"></i><span>保存CG</span>');
    }
  });
}

export function showBatchSpecialCgUploadDialog(onCloseCallback) {
  const modalHtml = `
    <div class="gal-input-modal gal-cg-upload-modal" id="gal-batch-special-cg-upload-modal">
      <div class="gal-cg-upload-shell gal-cg-upload-shell-batch">
        <div class="gal-cg-upload-header">
          <div class="gal-cg-upload-title"><i class="fa-solid fa-images"></i> 批量上传特殊CG</div>
          <button id="gal-batch-special-cg-close-x" class="gal-cg-upload-close" title="关闭">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="gal-cg-upload-toolbar">
          <input type="file" id="gal-batch-special-cg-file-input" accept="image/*" multiple style="display:none;">
          <button class="gal-action-btn gal-cg-upload-trigger-btn" id="gal-batch-special-cg-upload-trigger">
            <i class="fa-solid fa-cloud-arrow-up"></i>
            <span>选择多张CG图片</span>
          </button>
          <span class="gal-cg-upload-toolbar-hint">上传后可逐条编辑 CG ID 与名称</span>
        </div>

        <div id="gal-batch-special-cg-grid" class="gal-cg-upload-gallery-grid">
          <div class="gal-cg-upload-gallery-empty">请选择图片开始上传</div>
        </div>

        <div class="gal-cg-upload-footer">
          <button class="gal-action-btn primary gal-cg-upload-primary-btn" id="gal-batch-special-cg-save-btn" disabled>
            <i class="fa-solid fa-save"></i>
            <span>保存全部CG</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const mountRoot = getModalMountRoot();
  $(mountRoot).append(modalHtml);
  const $modal = $(mountRoot).find('#gal-batch-special-cg-upload-modal');
  makeDraggable($modal.find('.gal-cg-upload-shell'), $modal.find('.gal-cg-upload-header'));

  const $fileInput = $modal.find('#gal-batch-special-cg-file-input');
  const $grid = $modal.find('#gal-batch-special-cg-grid');
  const $saveBtn = $modal.find('#gal-batch-special-cg-save-btn');
  const items = [];

  const updateSaveButton = () => {
    const validCount = items.filter(item => item.file && String(item.cgId || '').trim()).length;
    $saveBtn.prop('disabled', validCount === 0);
    $saveBtn.find('span').text(`保存全部CG (${validCount})`);
  };

  const renderGrid = () => {
    if (items.length === 0) {
      $grid.html('<div class="gal-cg-upload-gallery-empty">请选择图片开始上传</div>');
      updateSaveButton();
      return;
    }
    $grid.html(
      items
        .map((item, index) => `
          <div class="gal-batch-special-cg-item" data-index="${index}">
            <div class="gal-batch-special-cg-preview">
              <img src="${item.url}" alt="${item.cgId}">
              <button class="gal-batch-special-cg-remove" data-index="${index}" title="移除这一张CG">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
            <div class="gal-batch-special-cg-fields">
              <label class="gal-cg-upload-field">
                <span class="gal-cg-upload-label">CG ID</span>
                <input type="text" class="gal-batch-special-cg-id gal-cg-upload-input" data-index="${index}" value="${item.cgId}">
              </label>
              <label class="gal-cg-upload-field">
                <span class="gal-cg-upload-label">名称（可选）</span>
                <input type="text" class="gal-batch-special-cg-name gal-cg-upload-input" data-index="${index}" value="${item.name}">
              </label>
            </div>
          </div>
        `)
        .join(''),
    );
    updateSaveButton();
  };

  const close = () => {
    items.forEach(item => {
      if (item.url) {
        try {
          URL.revokeObjectURL(item.url);
        } catch (error) {
          console.debug(`[${SCRIPT_NAME}] 释放CG预览URL失败:`, error);
        }
      }
    });
    closeWithCallback($modal, onCloseCallback);
  };

  $modal.find('#gal-batch-special-cg-upload-trigger').on('click', () => $fileInput.click());
  $fileInput.on('change', function () {
    const files = Array.from(this.files || []);
    files.forEach((file, index) => {
      items.push({
        file,
        cgId: buildCgIdFromFilename(file.name, index),
        name: buildCgIdFromFilename(file.name, index),
        url: URL.createObjectURL(file),
      });
    });
    renderGrid();
    this.value = '';
  });

  $grid.on('input', '.gal-batch-special-cg-id', function () {
    const index = Number($(this).attr('data-index'));
    if (!Number.isFinite(index) || !items[index]) return;
    items[index].cgId = String($(this).val() || '').trim();
    updateSaveButton();
  });

  $grid.on('input', '.gal-batch-special-cg-name', function () {
    const index = Number($(this).attr('data-index'));
    if (!Number.isFinite(index) || !items[index]) return;
    items[index].name = String($(this).val() || '').trim();
  });

  $grid.on('click', '.gal-batch-special-cg-remove', function () {
    const index = Number($(this).attr('data-index'));
    if (!Number.isFinite(index) || !items[index]) return;
    const [removed] = items.splice(index, 1);
    if (removed?.url) {
      try {
        URL.revokeObjectURL(removed.url);
      } catch (error) {
        console.debug(`[${SCRIPT_NAME}] 释放已移除CG预览URL失败:`, error);
      }
    }
    renderGrid();
  });

  $modal.find('#gal-batch-special-cg-close-x').on('click', close);
  $modal.on('click', function (e) {
    if (e.target === this) close();
  });

  $saveBtn.on('click', async function () {
    const validItems = items.filter(item => item.file && String(item.cgId || '').trim());
    if (validItems.length === 0) {
      showToast('请至少保留一条有效CG记录');
      return;
    }
    $saveBtn.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i><span>保存中...</span>');
    let successCount = 0;
    let failedCount = 0;
    for (const item of validItems) {
      try {
        await saveSpecialCg(item.cgId, item.file, null, { name: item.name || item.cgId });
        successCount++;
      } catch (error) {
        failedCount++;
        console.error(`[${SCRIPT_NAME}] 批量保存特殊CG失败:`, item.cgId, error);
      }
    }
    if (failedCount > 0) {
      showToast(`批量保存完成：成功 ${successCount}，失败 ${failedCount}`);
    } else {
      showToast(`已批量保存 ${successCount} 张特殊CG`);
    }
    close();
  });
}
