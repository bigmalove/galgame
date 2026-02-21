import { SCRIPT_NAME, THEME } from '../core/constants.js';
import { $ } from '../core/env.js';
import { GLOBAL_MAP_REGION_KEY, saveUnifiedMapImage } from '../db/map-images.js';
import { getCurrentPackId } from '../db/image-packs.js';
import { getModalMountRoot } from './fullscreen.js';
import { makeDraggable } from './interaction.js';
import { showToast } from './toast.js';

export function showMapUploadDialog(options = {}) {
  const {
    onSaved = null,
  } = options;

  const modalHtml = `
    <div class="gal-input-modal" id="gal-map-upload-modal" style="z-index: 100130 !important;">
      <div class="gal-input-box" style="max-width: 760px; width: 94%; max-height: 90vh; overflow: hidden; padding: 0; display: flex; flex-direction: column;">
        <div class="gal-input-title" style="padding: 14px 18px; border-bottom: 1px solid #eee; margin: 0; display: flex; align-items: center; justify-content: space-between;">
          <span><i class="fa-solid fa-map"></i> 上传世界地图</span>
          <button id="gal-map-upload-close-x" title="关闭" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div style="padding: 16px; overflow: auto; flex: 1;">
          <div style="margin-bottom: 12px; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f8fafc; color: #334155; font-size: 0.88rem; line-height: 1.65;">
            当前为统一世界地图模式：所有地点共用一张大地图，不再按场景/地区分别上传。
          </div>

          <div class="gal-upload-tabs" style="display:flex; border-bottom: 1px solid #ddd; margin-bottom: 12px;">
            <div class="gal-upload-tab active" data-target="local" style="padding: 8px 14px; cursor: pointer; font-weight: 700; color: ${THEME.dark}; border-bottom: 2px solid ${THEME.accent};">本地上传</div>
            <div class="gal-upload-tab" data-target="remote" style="padding: 8px 14px; cursor: pointer; color: #888;">远程链接</div>
          </div>

          <div id="gal-map-upload-local" class="gal-upload-pane">
            <input type="file" id="gal-map-file-input" accept="image/*" style="display:none;">
            <div id="gal-map-upload-trigger" style="border: 2px dashed #ccc; border-radius: 8px; min-height: 160px; display:flex; align-items:center; justify-content:center; flex-direction:column; cursor:pointer; color:#999;">
              <i class="fa-solid fa-cloud-arrow-up" style="font-size: 2.2rem;"></i>
              <span style="margin-top: 8px;">点击选择地图图片</span>
            </div>
          </div>

          <div id="gal-map-upload-remote" class="gal-upload-pane" style="display:none;">
            <label style="display:block; margin-bottom: 6px; color:#2b2e38;">远程图片链接</label>
            <input id="gal-map-remote-url" type="text" placeholder="https://example.com/map.png"
                   style="width:100%; padding:10px 12px; border:1px solid #ddd; border-radius:6px; box-sizing:border-box;">
          </div>

          <div id="gal-map-preview-wrap" style="display:none; margin-top: 14px; border: 1px solid #eee; border-radius: 8px; padding: 8px; background:#fafafa;">
            <div style="font-size: 0.85rem; color:#666; margin-bottom: 6px;">预览</div>
            <img id="gal-map-preview-img" style="width:100%; max-height: 340px; object-fit: contain; background:#111; border-radius: 6px;">
          </div>
        </div>
        <div class="gal-input-actions" style="padding: 12px 16px; border-top: 1px solid #eee; margin: 0; display: flex; gap: 10px;">
          <button class="gal-action-btn primary" id="gal-map-save-btn" style="flex:1; justify-content:center;">
            <i class="fa-solid fa-save"></i><span>保存地图</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const mountRoot = getModalMountRoot();
  $(mountRoot).find('#gal-map-upload-modal').remove();
  $(mountRoot).append(modalHtml);
  const $modal = $(mountRoot).find('#gal-map-upload-modal');
  makeDraggable($modal.find('.gal-input-box'), $modal.find('.gal-input-title'));

  let localFile = null;
  let previewUrl = '';

  const cleanPreview = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(previewUrl); } catch (e) { /* ignore */ }
    }
    previewUrl = '';
  };

  const setPreview = (url) => {
    cleanPreview();
    previewUrl = String(url || '').trim();
    if (!previewUrl) {
      $modal.find('#gal-map-preview-wrap').hide();
      return;
    }
    $modal.find('#gal-map-preview-img').attr('src', previewUrl);
    $modal.find('#gal-map-preview-wrap').show();
  };

  const close = () => {
    cleanPreview();
    $modal.remove();
  };

  $modal.find('#gal-map-upload-close-x').on('click', close);
  $modal.on('click', function (e) {
    if (e.target === this) close();
  });

  $modal.find('.gal-upload-tab').on('click', function () {
    const target = String($(this).data('target') || 'local');
    $modal.find('.gal-upload-tab').removeClass('active').css({ fontWeight: 'normal', color: '#888', borderBottom: 'none' });
    $(this).addClass('active').css({ fontWeight: '700', color: THEME.dark, borderBottom: `2px solid ${THEME.accent}` });
    $modal.find('.gal-upload-pane').hide();
    $modal.find(`#gal-map-upload-${target}`).show();
    if (target === 'remote') {
      localFile = null;
    }
  });

  $modal.find('#gal-map-upload-trigger').on('click', () => {
    $modal.find('#gal-map-file-input').trigger('click');
  });

  $modal.find('#gal-map-file-input').on('change', function () {
    const file = this.files && this.files[0] ? this.files[0] : null;
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
      showToast('请选择图片文件');
      return;
    }
    localFile = file;
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
  });

  $modal.find('#gal-map-remote-url').on('input', function () {
    const url = String($(this).val() || '').trim();
    if (!url) {
      $modal.find('#gal-map-preview-wrap').hide();
      return;
    }
    setPreview(url);
  });

  $modal.find('#gal-map-save-btn').on('click', async function () {
    const activeTab = String($modal.find('.gal-upload-tab.active').data('target') || 'local');
    const targetPackId = getCurrentPackId();
    try {
      if (activeTab === 'local') {
        if (!localFile) {
          showToast('请先选择本地图片');
          return;
        }
        await saveUnifiedMapImage(localFile, null, targetPackId);
      } else {
        const remoteUrl = String($modal.find('#gal-map-remote-url').val() || '').trim();
        if (!/^https?:\/\//i.test(remoteUrl)) {
          showToast('请输入有效的 http/https 图片链接');
          return;
        }
        await saveUnifiedMapImage(null, remoteUrl, targetPackId);
      }
      showToast('统一世界地图已保存');
      if (typeof onSaved === 'function') onSaved(GLOBAL_MAP_REGION_KEY);
      close();
    } catch (error) {
      console.error(`[${SCRIPT_NAME}] save map failed`, error);
      showToast(`保存地图失败: ${error?.message || error}`);
    }
  });

  return $modal;
}
