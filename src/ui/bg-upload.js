import { SCRIPT_NAME, THEME } from '../core/constants.js';
import { $ } from '../core/env.js';
import { DEFAULT_COMFYUI_SETTINGS } from '../core/settings.js';
import { getIsEnabled } from '../core/state.js';
import { saveBackground } from '../db/backgrounds.js';
import { getComfyUISettings, getComfyWorkflows } from '../image-gen/comfyui-helpers.js';
import { ComfyUIAPI } from '../image-gen/comfyui-api.js';
import { injectCOTToWorldbook } from '../logic/worldbook.js';
import { getModalMountRoot } from './fullscreen.js';
import { showToast } from './toast.js';
import { makeDraggable } from './interaction.js';

// ============================================
// 背景上传对话框
// ============================================

/**
 * 批量背景上传对话框
 */
export function showBatchBackgroundUploadDialog(onCloseCallback) {
  const modalHtml = `
      <div class="gal-input-modal" id="gal-batch-bg-upload-modal">
        <div class="gal-input-box" style="max-width: 1100px; width: 95%; max-height: 90vh; overflow: hidden; padding: 0; display: flex; flex-direction: column;">
          <div class="gal-input-title" style="padding: 15px 25px; border-bottom: 1px solid #eee; flex-shrink: 0; margin: 0;">
            <span><i class="fa-solid fa-images"></i> 批量上传背景</span>
          </div>

          <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
              <!-- 初始上传界面 -->
              <div id="gal-batch-step-1" style="flex: 1; overflow-y: auto; padding: 25px;">
                  <div class="gal-upload-tabs" style="display: flex; border-bottom: 1px solid #ddd; margin-bottom: 15px;">
                      <div class="gal-upload-tab active" data-target="local" style="padding: 8px 15px; cursor: pointer; font-weight: bold; color: ${THEME.dark}; border-bottom: 2px solid ${THEME.accent};">本地上传</div>
                      <div class="gal-upload-tab" data-target="remote" style="padding: 8px 15px; cursor: pointer; color: #888;">远程链接</div>
                  </div>

                  <div id="gal-upload-local" class="gal-upload-pane">
                      <input type="file" id="gal-batch-file-input" multiple accept="image/*" style="display: none;">
                      <div class="gal-upload-card" id="gal-batch-upload-trigger" style="min-height: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px dashed #ccc; border-radius: 8px; cursor: pointer;">
                        <i class="fa-solid fa-cloud-arrow-up" style="font-size: 3rem; color: #ccc;"></i>
                        <span style="font-size: 1.2rem; margin-top: 15px; color: #999;">点击选择多张图片</span>
                        <small style="color: #bbb; margin-top: 5px;">支持按住 Ctrl 或 Shift 多选</small>
                      </div>
                  </div>

                  <div id="gal-upload-remote" class="gal-upload-pane" style="display: none;">
                      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px dashed #ccc;">
                        <label style="display: block; font-weight: 700; margin-bottom: 8px;">输入图片链接（一行一个）</label>
                        <textarea id="gal-batch-remote-urls" placeholder="https://example.com/bg1.jpg&#10;https://example.com/bg2.png"
                                  style="width: 100%; height: 200px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-family: monospace; resize: vertical;"></textarea>
                        <button class="gal-action-btn" id="gal-batch-fetch-remote-btn" style="width: 100%; margin-top: 10px; justify-content: center;">
                          <i class="fa-solid fa-download"></i> 解析并获取图片
                        </button>
                      </div>
                  </div>
              </div>

              <!-- 标记界面 -->
              <div id="gal-batch-step-2" style="flex: 1; display: none; flex-direction: column; overflow: hidden;">
                  <div class="gal-batch-grid-container" style="flex: 1; overflow-y: auto; padding: 20px; background: #f5f5f5;">
                      <div id="gal-batch-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px;">
                          <!-- JS生成网格项 -->
                      </div>
                  </div>

                  <!-- 分页控制 -->
                  <div style="padding: 10px 20px; background: #fff; border-top: 1px solid #eee; display: flex; justify-content: center; align-items: center; gap: 15px; flex-shrink: 0;">
                      <button class="gal-action-btn" id="gal-batch-prev-page" disabled><i class="fa-solid fa-chevron-left"></i> 上一页</button>
                      <span id="gal-batch-page-info" style="font-weight: bold; color: ${THEME.dark};">1 / 1</span>
                      <button class="gal-action-btn" id="gal-batch-next-page" disabled>下一页 <i class="fa-solid fa-chevron-right"></i></button>
                  </div>
              </div>
          </div>

          <!-- 底部按钮 -->
          <div class="gal-input-actions" style="display: flex; gap: 12px; padding: 15px 25px; border-top: 1px solid #eee; background: #fff; flex-shrink: 0;">
              <button class="gal-action-btn" id="gal-batch-cancel-btn" style="flex: 1; min-height: 44px; justify-content: center;">
                <span>取消</span>
              </button>
              <button class="gal-action-btn primary" id="gal-batch-save-btn" style="flex: 2; min-height: 44px; justify-content: center; display: none;">
                <i class="fa-solid fa-save"></i>
                <span id="gal-batch-save-text">保存所有背景 (0)</span>
              </button>
          </div>
        </div>
      </div>
      <style>
          .gal-batch-item {
              background: #fff;
              border-radius: 6px;
              overflow: hidden;
              box-shadow: 0 2px 5px rgba(0,0,0,0.1);
              display: flex;
              flex-direction: column;
          }
          .gal-batch-preview {
              aspect-ratio: 16 / 9;
              background: #eee;
              position: relative;
          }
          .gal-batch-preview img {
              width: 100%;
              height: 100%;
              object-fit: cover;
          }
          .gal-batch-input-area {
              padding: 10px;
          }
          .gal-batch-scene-input {
              width: 100%;
              padding: 8px;
              border: 1px solid #ddd;
              border-radius: 4px;
              box-sizing: border-box;
              font-size: 0.9rem;
          }
          .gal-batch-scene-input:focus {
              border-color: ${THEME.accent};
              outline: none;
          }
          .gal-batch-remove {
              position: absolute;
              top: 5px;
              right: 5px;
              background: rgba(255, 0, 0, 0.8);
              color: white;
              border: none;
              border-radius: 50%;
              width: 24px;
              height: 24px;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
          }
          .gal-batch-status {
              position: absolute;
              bottom: 0;
              left: 0;
              right: 0;
              background: rgba(0,0,0,0.6);
              color: white;
              font-size: 10px;
              padding: 2px 5px;
              text-align: center;
          }
      </style>
    `;
  const mountRoot = getModalMountRoot();
  $(mountRoot).append(modalHtml);
  const $modal = $(mountRoot).find('#gal-batch-bg-upload-modal');
  makeDraggable($modal.find('.gal-input-box'), $modal.find('.gal-input-title'));
  // 状态变量
  let batchItems = [];
  let currentPage = 1;
  const itemsPerPage = 15;
  // UI 引用
  const $step1 = $modal.find('#gal-batch-step-1');
  const $step2 = $modal.find('#gal-batch-step-2');
  const $grid = $modal.find('#gal-batch-grid');
  const $saveBtn = $modal.find('#gal-batch-save-btn');
  const $saveText = $modal.find('#gal-batch-save-text');
  // Tab 切换
  $modal.find('.gal-upload-tab').on('click', function () {
    const target = $(this).data('target');
    $modal
      .find('.gal-upload-tab')
      .removeClass('active')
      .css({ fontWeight: 'normal', color: '#888', borderBottom: 'none' });
    $(this)
      .addClass('active')
      .css({ fontWeight: 'bold', color: THEME.dark, borderBottom: `2px solid ${THEME.accent}` });
    $modal.find('.gal-upload-pane').hide();
    $modal.find(`#gal-upload-${target}`).show();
  });
  // 触发本地文件选择
  $('#gal-batch-upload-trigger').on('click', () => $('#gal-batch-file-input').click());
  // 处理本地文件选择
  $('#gal-batch-file-input').on('change', function () {
    if (this.files.length === 0) return;
    Array.from(this.files).forEach(file => {
      const name = file.name.replace(/\.[^/.]+$/, '');
      batchItems.push({
        file: file,
        name: name,
        status: 'pending',
        url: URL.createObjectURL(file),
      });
    });
    switchToTaggingView();
  });
  // 处理远程链接
  $('#gal-batch-fetch-remote-btn').on('click', async function () {
    const text = $('#gal-batch-remote-urls').val().trim();
    if (!text) return showToast('请输入图片链接');
    const urls = text
      .split('\n')
      .map(u => u.trim())
      .filter(u => u);
    if (urls.length === 0) return showToast('没有有效的链接');
    $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 下载验证中...');
    let successCount = 0;
    const fetchImage = async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('404/Network Error');
        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) throw new Error('Not an image');
        let name = 'remote_bg';
        try {
          const urlObj = new URL(url);
          const pathname = urlObj.pathname;
          const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
          if (filename) name = filename.replace(/\.[^/.]+$/, '');
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] 解析URL文件名失败:`, e);
        }
        batchItems.push({
          file: blob,
          name: name,
          status: 'pending',
          url: URL.createObjectURL(blob),
        });
        successCount++;
      } catch (e) {
        console.warn('Failed to fetch:', url, e);
      }
    };
    await Promise.all(urls.map(url => fetchImage(url)));
    $(this).prop('disabled', false).html('<i class="fa-solid fa-download"></i> 解析并获取图片');
    if (successCount > 0) {
      switchToTaggingView();
    } else {
      showToast('未能获取任何有效图片，请检查链接');
    }
  });
  // 切换到标记界面
  function switchToTaggingView() {
    $step1.hide();
    $step2.css('display', 'flex');
    $saveBtn.show();
    renderGrid();
    updateSaveBtn();
  }
  // 渲染网格
  function renderGrid() {
    $grid.empty();
    const start = (currentPage - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, batchItems.length);
    const pageItems = batchItems.slice(start, end);
    pageItems.forEach((item, index) => {
      const globalIndex = start + index;
      const $card = $(`
                <div class="gal-batch-item">
                    <div class="gal-batch-preview">
                        <img src="${item.url}">
                        <button class="gal-batch-remove" data-index="${globalIndex}"><i class="fa-solid fa-times"></i></button>
                    </div>
                    <div class="gal-batch-input-area">
                        <input type="text" class="gal-batch-scene-input" data-index="${globalIndex}" value="${item.name}" placeholder="场景名称">
                    </div>
                </div>
            `);
      $grid.append($card);
    });
    // 更新分页状态
    $('#gal-batch-page-info').text(`${currentPage} / ${Math.ceil(batchItems.length / itemsPerPage) || 1}`);
    $('#gal-batch-prev-page').prop('disabled', currentPage <= 1);
    $('#gal-batch-next-page').prop('disabled', currentPage >= Math.ceil(batchItems.length / itemsPerPage));
    // 绑定事件
    $grid.find('.gal-batch-scene-input').on('input', function () {
      const idx = $(this).data('index');
      batchItems[idx].name = $(this).val();
    });
    $grid.find('.gal-batch-remove').on('click', function () {
      const idx = $(this).data('index');
      if (confirm('移除这张图片？')) {
        batchItems.splice(idx, 1);
        if (batchItems.length === 0) {
          $step2.hide();
          $saveBtn.hide();
          $step1.show();
        } else {
          const maxPage = Math.ceil(batchItems.length / itemsPerPage);
          if (currentPage > maxPage) currentPage = maxPage;
          renderGrid();
          updateSaveBtn();
        }
      }
    });
  }
  // 翻页
  $('#gal-batch-prev-page').on('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderGrid();
    }
  });
  $('#gal-batch-next-page').on('click', () => {
    const maxPage = Math.ceil(batchItems.length / itemsPerPage);
    if (currentPage < maxPage) {
      currentPage++;
      renderGrid();
    }
  });
  function updateSaveBtn() {
    $saveText.text(`保存所有背景 (${batchItems.length})`);
  }
  // 关闭
  function closeDialog() {
    $modal.remove();
    batchItems.forEach(item => {
      if (item.url) URL.revokeObjectURL(item.url);
    });
    if (typeof onCloseCallback === 'function') onCloseCallback();
  }
  $('#gal-batch-cancel-btn').on('click', closeDialog);
  // 保存逻辑
  $saveBtn.on('click', async function () {
    let emptyNames = 0;
    batchItems.forEach(item => {
      if (!item.name || !item.name.trim()) emptyNames++;
    });
    if (emptyNames > 0) {
      return showToast(`有 ${emptyNames} 张图片未填写场景名称，请补充完整`);
    }
    $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 正在保存...');
    let failCount = 0;
    for (const item of batchItems) {
      try {
        await saveBackground(item.name.trim(), item.file);
      } catch (e) {
        console.error('Batch save failed for:', item.name, e);
        failCount++;
      }
    }
    // 更新世界书
    if (getIsEnabled()) {
      try {
        await injectCOTToWorldbook();
      } catch (e) {
        console.error(`[${SCRIPT_NAME}] 批量保存后更新世界书失败:`, e);
      }
    }
    if (failCount === 0) {
      showToast(`成功批量保存 ${batchItems.length} 张背景！`);
      closeDialog();
    } else {
      showToast(`保存完成，但有 ${failCount} 张失败，详情请看控制台`);
      closeDialog();
    }
  });
}

// ============================================
// 单个背景上传对话框
// ============================================
export function showBackgroundUploadDialog(onCloseCallback) {
  const modalHtml = `
      <div class="gal-input-modal" id="gal-bg-upload-modal">
        <div class="gal-input-box" style="max-width: 600px; width: 90%; padding: 25px;">
          <div class="gal-input-title" style="margin-bottom: 20px; font-size: 1.3rem;">
            <span><i class="fa-solid fa-panorama"></i> 添加背景图片</span>
          </div>

          <div style="margin-bottom: 15px;">
            <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};">
              <i class="fa-solid fa-tag"></i> 场景名称
            </label>
            <input type="text" id="gal-bg-scene-name" placeholder="如：教室、公园、夜晚街道"
                   style="width: 100%; padding: 12px 15px; border: 2px solid #ddd; font-size: 1rem; box-sizing: border-box; border-radius: 6px;">
            <small style="color: #888; margin-top: 5px; display: block;">场景名称需与 AI 输出的 &lt;background scene="xxx" /&gt; 标签中的 xxx 一致</small>
          </div>

          <div class="gal-upload-tabs" style="display: flex; border-bottom: 1px solid #ddd; margin-bottom: 15px;">
            <div class="gal-upload-tab active" data-target="local" style="padding: 8px 15px; cursor: pointer; font-weight: bold; color: ${THEME.dark}; border-bottom: 2px solid ${THEME.accent};">本地上传</div>
            <div class="gal-upload-tab" data-target="remote" style="padding: 8px 15px; cursor: pointer; color: #888;">远程链接</div>
            <div class="gal-upload-tab" data-target="comfyui" style="padding: 8px 15px; cursor: pointer; color: #888;">
                <i class="fa-solid fa-wand-magic-sparkles"></i> ComfyUI 生成
            </div>
          </div>

          <div id="gal-upload-local" class="gal-upload-pane">
            <input type="file" id="gal-bg-file-input" accept="image/*" style="display: none;">
            <div class="gal-upload-card" id="gal-bg-upload-trigger" style="margin-bottom: 15px; min-height: 150px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px dashed #ccc; border-radius: 8px; cursor: pointer;">
              <i class="fa-solid fa-cloud-arrow-up" style="font-size: 2.5rem; color: #ccc;"></i>
              <span style="font-size: 1rem; margin-top: 10px; color: #999;">点击选择背景图片</span>
              <small style="color: #bbb; margin-top: 5px;">推荐比例 16:9</small>
            </div>
          </div>

          <div id="gal-upload-remote" class="gal-upload-pane" style="display: none;">
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px dashed #ccc; text-align: center; min-height: 150px; display: flex; flex-direction: column; justify-content: center;">
              <div style="margin-bottom: 15px;">
                <input type="text" id="gal-bg-remote-url" placeholder="输入图片 URL (https://...)"
                       style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
              </div>
              <button class="gal-action-btn" id="gal-bg-fetch-btn" style="width: 100%; justify-content: center;">
                <i class="fa-solid fa-download"></i> 获取图片
              </button>
            </div>
          </div>

          <div id="gal-upload-comfyui" class="gal-upload-pane" style="display: none;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 15px; border-radius: 8px; color: #fff; margin-bottom: 15px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                        <i class="fa-solid fa-panorama" style="font-size: 1.5rem;"></i>
                        <span style="font-weight: 700; font-size: 1.1rem;">ComfyUI 场景生成</span>
                    </div>
                    <div style="font-size: 0.85rem; opacity: 0.9;">
                        使用本地ComfyUI生成背景图片
                    </div>
                </div>

                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <div style="flex: 1;">
                        <label style="font-weight: 700; display: block; margin-bottom: 5px;">工作流</label>
                        <select id="gal-bg-comfy-wf-select" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></select>
                    </div>
                </div>

                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};">
                        <i class="fa-solid fa-pen-paintbrush"></i> 场景描述
                    </label>
                    <textarea id="gal-bg-comfyui-prompt"
                              placeholder="例如: empty classroom, sunset, windows, desks and chairs, no humans..."
                              style="width: 100%; height: 80px; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem; resize: vertical; box-sizing: border-box;"></textarea>
                </div>

                <button class="gal-action-btn primary" id="gal-bg-comfyui-generate-btn" style="width: 100%; min-height: 50px; justify-content: center; font-size: 1.1rem;">
                    <i class="fa-solid fa-image"></i>
                    <span>生成背景</span>
                </button>
          </div>

          <div id="gal-bg-preview-container" style="display: none; margin-bottom: 15px;">
            <img id="gal-bg-preview-img" style="width: 100%; border-radius: 8px; border: 2px solid ${THEME.accent};">
          </div>

          <div class="gal-input-actions" style="display: flex; gap: 12px;">
            <button class="gal-action-btn" id="gal-bg-cancel" style="flex: 1; min-height: 44px; justify-content: center;">
              <span>取消</span>
            </button>
            <button class="gal-action-btn primary" id="gal-bg-confirm" style="flex: 1; min-height: 44px; justify-content: center;" disabled>
              <i class="fa-solid fa-save"></i>
              <span>保存背景</span>
            </button>
          </div>
        </div>
      </div>
    `;
  const mountRoot = getModalMountRoot();
  $(mountRoot).append(modalHtml);
  const $modal = $(mountRoot).find('#gal-bg-upload-modal');
  makeDraggable($modal.find('.gal-input-box'), $modal.find('.gal-input-title'));
  const $fileInput = $modal.find('#gal-bg-file-input');
  const $uploadArea = $modal.find('#gal-bg-upload-trigger');
  const $previewContainer = $modal.find('#gal-bg-preview-container');
  const $previewImg = $modal.find('#gal-bg-preview-img');
  const $confirmBtn = $modal.find('#gal-bg-confirm');
  const $sceneNameInput = $modal.find('#gal-bg-scene-name');
  let selectedFile = null;
  // Tab 切换
  $modal.find('.gal-upload-tab').on('click', function () {
    const target = $(this).data('target');
    $modal
      .find('.gal-upload-tab')
      .removeClass('active')
      .css({ fontWeight: 'normal', color: '#888', borderBottom: 'none' });
    $(this)
      .addClass('active')
      .css({ fontWeight: 'bold', color: THEME.dark, borderBottom: `2px solid ${THEME.accent}` });
    $modal.find('.gal-upload-pane').hide();
    $modal.find(`#gal-upload-${target}`).show();
  });
  // 远程图片获取
  $('#gal-bg-fetch-btn').on('click', async function () {
    const url = $('#gal-bg-remote-url').val().trim();
    if (!url) return showToast('请输入图片链接');
    $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 获取中...');
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('网络请求失败');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('链接不是有效的图片');
      const file = new File([blob], 'remote_bg.png', { type: blob.type });
      selectedFile = file;
      const reader = new FileReader();
      reader.onload = e => {
        $previewImg.attr('src', e.target.result);
        $modal.find('.gal-upload-tabs, .gal-upload-pane').hide();
        $previewContainer.show();
        updateConfirmState();
      };
      reader.readAsDataURL(file);
    } catch (e) {
      showToast('获取失败: ' + e.message);
    } finally {
      $(this).prop('disabled', false).html('<i class="fa-solid fa-download"></i> 获取图片');
    }
  });

  // ComfyUI 背景生成逻辑
  function initComfyUIBgWorkflowSelect() {
    const $sel = $('#gal-bg-comfy-wf-select');
    const workflows = getComfyWorkflows();
    const cs = getComfyUISettings();
    $sel.empty();
    $sel.append('<option value="default_bg">内置 SDXL Turbo</option>');
    Object.keys(workflows).forEach(id => {
      $sel.append(`<option value="${id}">${workflows[id].name}</option>`);
    });
    if (cs.defaultBgWorkflow) {
      $sel.val(cs.defaultBgWorkflow);
    }
  }
  initComfyUIBgWorkflowSelect();

  $('#gal-bg-comfyui-generate-btn').on('click', async function () {
    const prompt = $('#gal-bg-comfyui-prompt').val().trim();
    const wfId = $('#gal-bg-comfy-wf-select').val();
    if (!prompt) {
      showToast('请输入场景描述');
      return;
    }
    $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 生成中...');
    const positive = [prompt, 'scenery, background, no humans, masterpiece, best quality, highres'].join(', ');
    const cs = getComfyUISettings();
    const negative = cs.negativePrompt || DEFAULT_COMFYUI_SETTINGS.negativePrompt;
    let workflow;
    if (wfId === 'default_bg' || !wfId) {
      workflow = ComfyUIAPI.buildDefaultWorkflow(positive, negative, 1280, 720, 20, 7);
    } else {
      const workflows = getComfyWorkflows();
      const stored = workflows[wfId];
      if (stored) {
        workflow = stored.json;
      } else {
        workflow = ComfyUIAPI.buildDefaultWorkflow(positive, negative, 1280, 720, 20, 7);
      }
    }
    try {
      const blob = await ComfyUIAPI.generate(workflow, positive, negative);
      const file = new File([blob], 'generated_bg.png', { type: blob.type });
      selectedFile = file;
      const reader = new FileReader();
      reader.onload = e => {
        $previewImg.attr('src', e.target.result);
        $modal.find('.gal-upload-tabs, .gal-upload-pane').hide();
        $previewContainer.show();
        updateConfirmState();
        if (!$sceneNameInput.val()) {
          $sceneNameInput.val(prompt.split(',')[0].substring(0, 10));
          updateConfirmState();
        }
      };
      reader.readAsDataURL(file);
      showToast('背景生成成功！');
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] ComfyUI生成失败:`, e);
      showToast('生成失败: ' + e.message);
    } finally {
      $(this).prop('disabled', false).html('<i class="fa-solid fa-image"></i><span>生成背景</span>');
    }
  });

  // 点击上传区域
  $uploadArea.on('click', () => $fileInput.click());
  // 文件选择
  $fileInput.on('change', function () {
    const file = this.files[0];
    if (!file) return;
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = e => {
      $previewImg.attr('src', e.target.result);
      $modal.find('.gal-upload-tabs, .gal-upload-pane').hide();
      $previewContainer.show();
      updateConfirmState();
    };
    reader.readAsDataURL(file);
  });
  // 点击预览图可以重新选择
  $previewContainer.on('click', () => $fileInput.click());
  // 场景名称输入
  $sceneNameInput.on('input', updateConfirmState);
  function updateConfirmState() {
    const hasFile = selectedFile !== null;
    const hasName = $sceneNameInput.val().trim() !== '';
    $confirmBtn.prop('disabled', !(hasFile && hasName));
  }
  // 统一关闭处理
  const handleClose = () => {
    $modal.remove();
    if (typeof onCloseCallback === 'function') {
      try {
        onCloseCallback();
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] 回调执行失败:`, e);
      }
    }
  };
  // 取消
  $('#gal-bg-cancel').on('click', handleClose);
  $modal.on('click', function (e) {
    if (e.target === this) handleClose();
  });
  // 保存
  $('#gal-bg-confirm').on('click', async function () {
    const sceneName = $sceneNameInput.val().trim();
    if (!sceneName || !selectedFile) return;
    $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 保存中...');
    try {
      const blob = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => {
          const arrayBuffer = reader.result;
          resolve(new Blob([arrayBuffer], { type: selectedFile.type }));
        };
        reader.readAsArrayBuffer(selectedFile);
      });
      await saveBackground(sceneName, blob);
      showToast(`背景已保存: ${sceneName}`);
      if (getIsEnabled()) {
        injectCOTToWorldbook().catch(e => console.warn(`[${SCRIPT_NAME}] 更新世界书失败:`, e));
      }
      handleClose();
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 保存背景失败:`, e);
      showToast('保存失败');
      $(this).prop('disabled', false).html('<i class="fa-solid fa-save"></i><span>保存背景</span>');
    }
  });
}
