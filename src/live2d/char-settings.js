import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow, $ } from '../core/env.js';
import { getCharacterUseLive2D, setCharacterUseLive2D } from './render-mode.js';
import { hasLive2DModel, getLive2DModel, saveLive2DModel, deleteLive2DModel } from '../db/live2d-models.js';
import { Live2DManager } from './manager.js';
import { Live2DUploader } from './uploader.js';

// 延迟引用: showCustomPopupPanel, getModalMountRoot (来自 UI 层)
let _showCustomPopupPanelRef = null;
let _getModalMountRootRef = null;
export function setCharSettingsRefs({ showCustomPopupPanel, getModalMountRoot }) {
  if (showCustomPopupPanel) _showCustomPopupPanelRef = showCustomPopupPanel;
  if (getModalMountRoot) _getModalMountRootRef = getModalMountRoot;
}

// ============================================
// Live2D 角色设置界面扩展
// ============================================

// 渲染角色 Live2D 设置行
export function renderCharacterLive2DRow(characterId) {
  const useLive2D = getCharacterUseLive2D(characterId);

  return `
    <div class="gal-setting-row gal-live2d-row" data-char-id="${characterId}">
      <div class="gal-setting-label">Live2D</div>
      <div class="gal-setting-controls" style="display: flex; align-items: center; gap: 8px;">
        <label class="gal-toggle" style="display: inline-flex; align-items: center; cursor: pointer;">
          <input type="checkbox"
                 class="gal-live2d-toggle"
                 data-char-id="${characterId}"
                 ${useLive2D ? 'checked' : ''}
                 disabled
                 style="margin-right: 4px;">
          <span class="gal-toggle-text">启用</span>
        </label>
        <button class="gal-btn gal-btn-small gal-live2d-upload"
                data-char-id="${characterId}"
                style="padding: 4px 8px; font-size: 12px;">
          上传模型
        </button>
        <button class="gal-btn gal-btn-small gal-live2d-url"
                data-char-id="${characterId}"
                style="padding: 4px 8px; font-size: 12px;">
          远程URL
        </button>
        <button class="gal-btn gal-btn-small gal-btn-danger gal-live2d-delete"
                data-char-id="${characterId}"
                style="padding: 4px 8px; font-size: 12px; display: none;">
          删除
        </button>
        <span class="gal-live2d-status" style="font-size: 12px; color: #888;"></span>
      </div>
    </div>
  `;
}

// 异步更新 Live2D 行状态
export async function updateLive2DRowState(characterId) {
  const _$ = topWindow.jQuery || $;
  const row = _$(topWindow.document).find(`.gal-live2d-row[data-char-id="${characterId}"]`);
  if (!row.length) return;

  const hasModel = await hasLive2DModel(characterId);
  const toggle = row.find('.gal-live2d-toggle');
  const uploadBtn = row.find('.gal-live2d-upload');
  const deleteBtn = row.find('.gal-live2d-delete');
  const status = row.find('.gal-live2d-status');

  toggle.prop('disabled', !hasModel);
  uploadBtn.text(hasModel ? '更换模型' : '上传模型');
  deleteBtn.css('display', hasModel ? '' : 'none');

  if (hasModel) {
    const modelData = await getLive2DModel(characterId);
    if (modelData) {
      if (modelData.source === 'remote' && typeof modelData.modelUrl === 'string') {
        let host = '';
        try {
          host = new URL(modelData.modelUrl).host || '';
        } catch (e) {}
        status.text(host ? `(URL: ${host})` : `(URL)`);
      } else if (Number.isFinite(modelData.fileSize) && modelData.fileSize > 0) {
        const sizeMB = (modelData.fileSize / 1024 / 1024).toFixed(1);
        status.text(`(${sizeMB} MB)`);
      } else {
        status.text('');
      }
    }
  } else {
    status.text('');
  }
}

// 绑定 Live2D 设置事件
export function bindLive2DSettingsEvents() {
  const _$ = topWindow.jQuery || $;
  const _toastr = topWindow.toastr || (typeof toastr !== 'undefined' ? toastr : null);

  // 上传按钮点击
  _$(topWindow.document).off('click.live2dupload').on('click.live2dupload', '.gal-live2d-upload', async function() {
    const characterId = _$(this).data('char-id');

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const row = _$(topWindow.document).find(`.gal-live2d-row[data-char-id="${characterId}"]`);
      const status = row.find('.gal-live2d-status');

      try {
        status.text('上传中...');

        await Live2DUploader.uploadZip(file, characterId);

        if (_toastr) _toastr.success(`Live2D 模型上传成功: ${characterId}`);
        await updateLive2DRowState(characterId);

        if (Live2DManager.models.has(characterId)) {
          Live2DManager.cleanup(characterId);
        }
      } catch (err) {
        console.error(`[${SCRIPT_NAME}] Live2D 上传失败:`, err);
        if (_toastr) _toastr.error(`上传失败: ${err.message}`);
        status.text('上传失败');
      }
    };

    input.click();
  });

  // 远程URL按钮点击
  _$(topWindow.document).off('click.live2durl').on('click.live2durl', '.gal-live2d-url', async function() {
    const characterId = _$(this).data('char-id');
    const exampleUrl = 'https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model/Live2D/Senko_Normals/senko.model3.json';

    let currentUrl = '';
    try {
      const existing = await getLive2DModel(characterId);
      if (existing?.source === 'remote' && typeof existing.modelUrl === 'string') {
        currentUrl = existing.modelUrl;
      }
    } catch (e) {}

    const modalHtml = `
      <div class="gal-live2d-remote-url-panel">
        <div style="font-size: 13px; color: #333; margin-bottom: 8px;">
          输入 Live2D 的 <code>model3.json</code> / <code>model.json</code> URL：
        </div>
        <input id="gal-live2d-remote-url-input"
               class="gal-live2d-remote-url-input"
               type="text"
               placeholder="https://.../xxx.model3.json">
        <div style="margin-top: 10px; display: flex; justify-content: flex-end; gap: 8px;">
          <button id="gal-live2d-remote-url-cancel" class="gal-btn gal-btn-small">取消</button>
          <button id="gal-live2d-remote-url-save" class="gal-btn gal-btn-small">保存</button>
        </div>
        <div style="margin-top: 8px; font-size: 12px; color: #888; word-break: break-all;">
          示例：${exampleUrl}
        </div>
      </div>
    `;

    if (_showCustomPopupPanelRef) {
      _showCustomPopupPanelRef(`Live2D 远程URL - ${characterId}`, modalHtml);
    }

    const mountRoot = _getModalMountRootRef ? _getModalMountRootRef() : topWindow.document.body;
    const $popup = _$(mountRoot).find('#gal-custom-popup');
    $popup.find('#gal-live2d-remote-url-input').val(currentUrl || '');

    const closePopup = () => {
      try {
        $popup.remove();
      } catch (e) {}
    };

    $popup.find('#gal-live2d-remote-url-cancel').on('click', closePopup);
    $popup.find('#gal-live2d-remote-url-save').on('click', async () => {
      const inputVal = $popup.find('#gal-live2d-remote-url-input').val();
      const url = String(inputVal || '').trim();
      const lowerUrl = url.toLowerCase();

      if (!url) {
        if (_toastr) _toastr.error('URL 不能为空');
        return;
      }
      if (!(lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://'))) {
        if (_toastr) _toastr.error('URL 必须以 http:// 或 https:// 开头');
        return;
      }
      if (!/\.json(\?|#|$)/i.test(url)) {
        if (_toastr) _toastr.warning('URL 看起来不是 .json 结尾（仍会尝试加载）');
      }

      try {
        await saveLive2DModel({
          modelId: characterId,
          source: 'remote',
          modelUrl: url,
          uploadTime: Date.now(),
          fileSize: 0,
        });

        if (_toastr) _toastr.success(`Live2D 远程URL已保存: ${characterId}`);
        await updateLive2DRowState(characterId);

        if (Live2DManager.models.has(characterId)) {
          Live2DManager.cleanup(characterId);
        }

        closePopup();
      } catch (err) {
        console.error(`[${SCRIPT_NAME}] Live2D 远程URL保存失败:`, err);
        if (_toastr) _toastr.error(`保存失败: ${err.message}`);
      }
    });
  });

  // 删除按钮点击
  _$(topWindow.document).off('click.live2ddelete').on('click.live2ddelete', '.gal-live2d-delete', async function() {
    const characterId = _$(this).data('char-id');

    if (!confirm(`确定删除角色 "${characterId}" 的 Live2D 模型吗？`)) return;

    try {
      await deleteLive2DModel(characterId);
      setCharacterUseLive2D(characterId, false);
      Live2DManager.cleanup(characterId);

      if (_toastr) _toastr.success('Live2D 模型已删除');
      await updateLive2DRowState(characterId);
    } catch (err) {
      console.error(`[${SCRIPT_NAME}] Live2D 删除失败:`, err);
      if (_toastr) _toastr.error(`删除失败: ${err.message}`);
    }
  });

  // 开关切换
  _$(topWindow.document).off('change.live2dtoggle').on('change.live2dtoggle', '.gal-live2d-toggle', function() {
    const characterId = _$(this).data('char-id');
    const useLive2D = this.checked;
    setCharacterUseLive2D(characterId, useLive2D);

    console.log(`[${SCRIPT_NAME}] 角色 ${characterId} Live2D 模式: ${useLive2D ? '启用' : '禁用'}`);
  });

  console.log(`[${SCRIPT_NAME}] Live2D 设置事件已绑定`);
}

// 初始化所有角色的 Live2D 行状态
export async function initAllLive2DRowStates(characterIds) {
  for (const characterId of characterIds) {
    await updateLive2DRowState(characterId);
  }
}
