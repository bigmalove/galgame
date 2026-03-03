import { SCRIPT_NAME, THEME } from '../core/constants.js';
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
    <div class="gal-input-modal" id="gal-special-cg-upload-modal">
      <div class="gal-input-box" style="max-width: 620px; width: 92%; padding: 24px;">
        <div class="gal-input-title" style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
          <span><i class="fa-solid fa-photo-film"></i> 添加特殊CG</span>
          <button id="gal-special-cg-close-x" title="关闭" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
          <div>
            <label style="display: block; font-weight: 700; margin-bottom: 6px; color: ${THEME.dark};">CG ID</label>
            <input type="text" id="gal-special-cg-id" placeholder="例如：cg_elly_confession" style="width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px;">
          </div>
          <div>
            <label style="display: block; font-weight: 700; margin-bottom: 6px; color: ${THEME.dark};">显示名称（可选）</label>
            <input type="text" id="gal-special-cg-name" placeholder="例如：艾莉告白CG" style="width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px;">
          </div>
        </div>

        <input type="file" id="gal-special-cg-file-input" accept="image/*" style="display:none;">
        <div class="gal-upload-card" id="gal-special-cg-upload-trigger" style="margin-bottom: 14px; min-height: 180px; border: 2px dashed #d1d5db; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer;">
          <i class="fa-solid fa-cloud-arrow-up" style="font-size: 2.6rem; color: #c0c7d2;"></i>
          <span style="margin-top: 10px; color: #6b7280;">点击选择CG图片</span>
          <small style="color: #9ca3af; margin-top: 4px;">支持 png/jpg/webp</small>
        </div>

        <div id="gal-special-cg-preview-container" style="display: none; margin-bottom: 14px;">
          <img id="gal-special-cg-preview-img" alt="CG预览" style="width: 100%; max-height: 320px; object-fit: contain; border: 1px solid #d1d5db; border-radius: 8px; background: #f8fafc;">
        </div>

        <div class="gal-input-actions" style="display: flex; gap: 10px;">
          <button class="gal-action-btn primary" id="gal-special-cg-confirm-btn" style="flex: 1; min-height: 42px; justify-content: center;" disabled>
            <i class="fa-solid fa-save"></i>
            <span>保存CG</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const mountRoot = getModalMountRoot();
  $(mountRoot).append(modalHtml);
  const $modal = $(mountRoot).find('#gal-special-cg-upload-modal');
  makeDraggable($modal.find('.gal-input-box'), $modal.find('.gal-input-title'));

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
    <div class="gal-input-modal" id="gal-batch-special-cg-upload-modal">
      <div class="gal-input-box" style="max-width: 1100px; width: 95%; max-height: 90vh; overflow: hidden; padding: 0; display: flex; flex-direction: column;">
        <div class="gal-input-title" style="padding: 14px 20px; border-bottom: 1px solid #e5e7eb; margin: 0; display: flex; justify-content: space-between; align-items: center;">
          <span><i class="fa-solid fa-images"></i> 批量上传特殊CG</span>
          <button id="gal-batch-special-cg-close-x" title="关闭" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div style="padding: 16px 20px; border-bottom: 1px solid #eef2f7;">
          <input type="file" id="gal-batch-special-cg-file-input" accept="image/*" multiple style="display:none;">
          <button class="gal-action-btn" id="gal-batch-special-cg-upload-trigger">
            <i class="fa-solid fa-cloud-arrow-up"></i>
            <span>选择多张CG图片</span>
          </button>
          <span style="margin-left: 10px; color: #6b7280; font-size: 0.82rem;">上传后可逐条编辑 CG ID 与名称</span>
        </div>

        <div id="gal-batch-special-cg-grid" style="flex: 1; overflow-y: auto; padding: 16px 20px; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px;">
          <div style="color: #9ca3af; text-align: center; grid-column: 1 / -1; padding: 20px;">请选择图片开始上传</div>
        </div>

        <div style="padding: 14px 20px; border-top: 1px solid #e5e7eb;">
          <button class="gal-action-btn primary" id="gal-batch-special-cg-save-btn" style="width: 100%; justify-content: center;" disabled>
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
  makeDraggable($modal.find('.gal-input-box'), $modal.find('.gal-input-title'));

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
      $grid.html('<div style="color: #9ca3af; text-align: center; grid-column: 1 / -1; padding: 20px;">请选择图片开始上传</div>');
      updateSaveButton();
      return;
    }
    $grid.html(
      items
        .map((item, index) => `
          <div class="gal-batch-special-cg-item" data-index="${index}" style="border: 1px solid #dbe2ea; border-radius: 8px; overflow: hidden; background: #fff;">
            <div style="position: relative; aspect-ratio: 16 / 9; background: #0f172a;">
              <img src="${item.url}" alt="${item.cgId}" style="width: 100%; height: 100%; object-fit: cover;">
              <button class="gal-batch-special-cg-remove" data-index="${index}" style="position: absolute; top: 6px; right: 6px; width: 28px; height: 28px; border-radius: 50%; border: none; background: rgba(220,53,69,0.95); color: #fff; cursor: pointer;">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
            <div style="padding: 10px;">
              <label style="display:block;font-size:0.78rem;color:#475569;margin-bottom:4px;">CG ID</label>
              <input type="text" class="gal-batch-special-cg-id" data-index="${index}" value="${item.cgId}" style="width:100%;box-sizing:border-box;padding:7px 8px;border:1px solid #cbd5e1;border-radius:6px;margin-bottom:8px;">
              <label style="display:block;font-size:0.78rem;color:#475569;margin-bottom:4px;">名称（可选）</label>
              <input type="text" class="gal-batch-special-cg-name" data-index="${index}" value="${item.name}" style="width:100%;box-sizing:border-box;padding:7px 8px;border:1px solid #cbd5e1;border-radius:6px;">
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
        } catch (error) {}
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
      } catch (error) {}
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
