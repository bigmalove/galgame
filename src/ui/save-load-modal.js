import { $, topWindow } from '../core/env.js';
import { deleteSaveSlot, getQuickSaveSlot, getSaveSlots, loadProgressById, quickLoad, quickSave, saveCurrentProgress } from '../save-load/manager.js';
import { getModalMountRoot } from './fullscreen.js';
import { showToast } from './toast.js';

const MODAL_ID = 'gal-save-load-modal';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTime(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function getThumbnailHtml(slot) {
  const src = String(slot?.thumbnailDataUrl || '').trim();
  if (!src) {
    return `
      <div class="gal-save-thumb-placeholder">
        <i class="fa-regular fa-image"></i>
        <span>无缩略图</span>
      </div>
    `;
  }
  return `<img class="gal-save-thumb-image" src="${src.replace(/"/g, '&quot;')}" alt="存档缩略图">`;
}

function buildSlotActions(slot, mode) {
  if (mode === 'quick-load') {
    return `
      <button class="gal-save-slot-btn primary" data-role="quick-load">快速读档</button>
    `;
  }
  if (mode === 'save') {
    return `
      <button class="gal-save-slot-btn primary" data-role="overwrite" data-slot-id="${escapeHtml(slot.id)}">覆盖</button>
      <button class="gal-save-slot-btn danger" data-role="delete" data-slot-id="${escapeHtml(slot.id)}">删除</button>
    `;
  }
  return `
    <button class="gal-save-slot-btn primary" data-role="load" data-slot-id="${escapeHtml(slot.id)}">读档</button>
    <button class="gal-save-slot-btn danger" data-role="delete" data-slot-id="${escapeHtml(slot.id)}">删除</button>
  `;
}

function buildSlotCard(slot, mode, prefix = '') {
  const floorText = Number.isFinite(Number(slot.totalFloorCount)) ? `总楼层 ${Number(slot.totalFloorCount)}` : '总楼层 --';
  const slotType = prefix ? `<span class="gal-save-slot-badge">${escapeHtml(prefix)}</span>` : '';
  const charName = String(slot?.characterCard?.name || '').trim();
  const charId = String(slot?.characterCard?.id || '').trim();
  const charInfo = charName && charId && charName !== charId ? `${charName} (${charId})` : charName || charId;
  return `
    <div class="gal-save-slot-card" data-slot-id="${escapeHtml(slot.id)}">
      <div class="gal-save-thumb-wrap">
        ${getThumbnailHtml(slot)}
      </div>
      <div class="gal-save-slot-info">
        <div class="gal-save-slot-title-row">
          <span class="gal-save-slot-title">${escapeHtml(slot.label || '未命名存档')}</span>
          ${slotType}
        </div>
        <div class="gal-save-slot-meta">
          <span class="gal-save-slot-char">${escapeHtml(charInfo || '角色卡未记录')}</span>
          <span>${floorText}</span>
          <span>${formatTime(slot.timestamp)}</span>
        </div>
      </div>
      <div class="gal-save-slot-actions">
        ${buildSlotActions(slot, mode)}
      </div>
    </div>
  `;
}

function renderSlots($modal, mode) {
  const slots = getSaveSlots();
  const quick = getQuickSaveSlot();
  let html = '';

  if (quick && mode === 'load') {
    html += buildSlotCard(quick, 'quick-load', '快速存档');
  }

  if (!slots.length) {
    html += `
      <div class="gal-save-empty">
        <i class="fa-regular fa-folder-open"></i>
        <span>暂无手动存档</span>
      </div>
    `;
  } else {
    html += slots.map(slot => buildSlotCard(slot, mode)).join('');
  }

  $modal.find('.gal-save-slot-list').html(html);
}

function closeModal($modal) {
  $modal.fadeOut(160, () => $modal.remove());
}

export function showSaveLoadModal(mode = 'load') {
  const safeMode = mode === 'save' ? 'save' : 'load';
  const mountRoot = getModalMountRoot();
  $(mountRoot).find(`#${MODAL_ID}`).remove();

  const isSaveMode = safeMode === 'save';
  const modalHtml = `
    <div id="${MODAL_ID}" class="gal-input-modal gal-save-load-modal">
      <div class="gal-save-load-box">
        <div class="gal-save-load-header">
          <div class="gal-save-load-title">
            <i class="fa-solid ${isSaveMode ? 'fa-floppy-disk' : 'fa-folder-open'}"></i>
            <span>${isSaveMode ? '存档' : '读档'}</span>
          </div>
          <button class="gal-save-load-close" title="关闭"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="gal-save-load-body">
          <div class="gal-save-load-controls">
            ${
              isSaveMode
                ? `
              <input type="text" class="gal-save-label-input" id="gal-save-label-input" maxlength="40" placeholder="输入存档名称（可选）">
              <button class="gal-save-control-btn primary" id="gal-save-create-btn">
                <i class="fa-solid fa-floppy-disk"></i><span>保存当前进度</span>
              </button>
              <button class="gal-save-control-btn" id="gal-save-quick-btn">
                <i class="fa-solid fa-bolt"></i><span>快速存档</span>
              </button>
              `
                : `
              <button class="gal-save-control-btn primary" id="gal-load-quick-btn">
                <i class="fa-solid fa-bolt"></i><span>快速读档</span>
              </button>
              `
            }
          </div>
          <div class="gal-save-slot-list"></div>
        </div>
      </div>
    </div>
  `;

  const $modal = $(modalHtml);
  $(mountRoot).append($modal);
  renderSlots($modal, safeMode);

  $modal.on('click', '.gal-save-load-close', () => closeModal($modal));
  $modal.on('click', function (event) {
    if (event.target === $modal[0]) {
      closeModal($modal);
    }
  });

  if (isSaveMode) {
    const handleSaveCurrent = async overwriteId => {
      const label = String($modal.find('#gal-save-label-input').val() || '').trim();
      const result = await saveCurrentProgress({ label, overwriteId });
      if (result.ok) {
        $modal.find('#gal-save-label-input').val('');
        renderSlots($modal, safeMode);
      }
    };

    $modal.on('click', '#gal-save-create-btn', async function () {
      $(this).prop('disabled', true);
      try {
        await handleSaveCurrent('');
      } finally {
        $(this).prop('disabled', false);
      }
    });

    $modal.on('click', '#gal-save-quick-btn', async function () {
      $(this).prop('disabled', true);
      try {
        await quickSave();
        renderSlots($modal, safeMode);
      } finally {
        $(this).prop('disabled', false);
      }
    });

    $modal.on('keydown', '#gal-save-label-input', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        $modal.find('#gal-save-create-btn').trigger('click');
      }
    });

    $modal.on('click', '[data-role="overwrite"]', async function () {
      const slotId = String($(this).attr('data-slot-id') || '').trim();
      if (!slotId) return;
      if (!topWindow.confirm('确定覆盖该存档吗？')) return;
      await handleSaveCurrent(slotId);
    });
  } else {
    $modal.on('click', '#gal-load-quick-btn', async function () {
      $(this).prop('disabled', true);
      try {
        const result = await quickLoad();
        if (result?.ok) {
          closeModal($modal);
        }
      } finally {
        $(this).prop('disabled', false);
      }
    });

    $modal.on('click', '[data-role="quick-load"]', async function () {
      const $btn = $(this);
      $btn.prop('disabled', true);
      try {
        const result = await quickLoad();
        if (result?.ok) {
          closeModal($modal);
        }
      } finally {
        $btn.prop('disabled', false);
      }
    });

    $modal.on('click', '[data-role="load"]', async function () {
      const slotId = String($(this).attr('data-slot-id') || '').trim();
      if (!slotId) return;
      const $btn = $(this);
      $btn.prop('disabled', true);
      try {
        const result = await loadProgressById(slotId);
        if (result?.ok) {
          closeModal($modal);
        }
      } finally {
        $btn.prop('disabled', false);
      }
    });
  }

  $modal.on('click', '[data-role="delete"]', function () {
    const slotId = String($(this).attr('data-slot-id') || '').trim();
    if (!slotId) return;
    if (!topWindow.confirm('确定删除该存档吗？')) return;
    const result = deleteSaveSlot(slotId);
    if (!result.ok) {
      showToast(result.reason || '删除失败');
      return;
    }
    showToast('存档已删除');
    renderSlots($modal, safeMode);
  });

  return $modal;
}
