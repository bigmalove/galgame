import { SCRIPT_NAME, THEME } from '../core/constants.js';
import { topWindow, $ } from '../core/env.js';
import { saveSprite } from '../db/sprites.js';
import { getAllSprites } from '../db/sprites.js';
import { getCharacterListFromDatabase } from '../utils/chat.js';
import { getAllExpressions } from '../utils/expressions.js';
import { getCharAppearancePrompt, setCharAppearancePrompt, getComfyUISettings, getComfyWorkflows } from '../image-gen/comfyui-helpers.js';
import { ComfyUIAPI } from '../image-gen/comfyui-api.js';
import { DEFAULT_COMFYUI_SETTINGS, SPRITE_UPLOAD_RATIO_OPTIONS, getSettings, normalizeSpriteUploadAspectRatio, saveSettings } from '../core/settings.js';
import { getTTSVoiceListAsync, getCharacterTTSVoice, setCharacterTTSVoice } from '../audio/tts-config.js';
import { getCustomExpressions, addCustomExpression, removeCustomExpression } from '../utils/expressions.js';
import { EXPRESSION_LIST, getExpressionTag } from '../logic/parser.js';
import { getModalMountRoot } from './fullscreen.js';
import { showToast } from './toast.js';
import { makeDraggable } from './interaction.js';
import { refreshGalgameViews } from './galgame-mode.js';

// ============================================
// 立绘上传相关模块
// ============================================

const DEFAULT_SPRITE_ASPECT_RATIO = 2 / 3;
const DEFAULT_SPRITE_UPLOAD_RATIO_LABEL = '2:3';
const CROPPER_MIN_SCALE = 0.01;

function parseAspectRatioLabel(ratioLabel) {
  const [widthRaw, heightRaw] = String(ratioLabel || '').split(':');
  const width = Number(widthRaw);
  const height = Number(heightRaw);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return DEFAULT_SPRITE_ASPECT_RATIO;
  }
  return width / height;
}

function formatAspectRatioCss(ratioLabel) {
  const [widthRaw, heightRaw] = String(ratioLabel || '').split(':');
  const width = Number(widthRaw);
  const height = Number(heightRaw);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return '2 / 3';
  }
  return `${width} / ${height}`;
}

function resolveSpriteUploadAspectRatio() {
  const settings = getSettings();
  const ratioLabel = normalizeSpriteUploadAspectRatio(
    settings?.spriteUploadAspectRatio || DEFAULT_SPRITE_UPLOAD_RATIO_LABEL,
  );
  return {
    ratioLabel,
    aspectRatio: parseAspectRatioLabel(ratioLabel),
    cssAspectRatio: formatAspectRatioCss(ratioLabel),
  };
}

// ============================================
// ImageCropper 类
// ============================================
export class ImageCropper {
  constructor(aspectRatio = DEFAULT_SPRITE_ASPECT_RATIO) {
    this.aspectRatio = aspectRatio;
    this.image = null;
    this.imageLoaded = false;
    this.canvas = null;
    this.ctx = null;
    this.scale = 1;
    this.minScale = 0.1;
    this.maxScale = 3;
    this.offsetX = 0;
    this.offsetY = 0;
    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.cropWidth = 0;
    this.cropHeight = 0;
  }
  loadImage(source) {
    return new Promise((resolve, reject) => {
      const ImageCtor = topWindow?.Image || Image;
      this.image = new ImageCtor();
      this.image.onload = () => {
        this.imageLoaded = true;
        if (this.canvas) {
          this.calculateInitialScale();
          this.render();
        }
        resolve(this.image);
      };
      this.image.onerror = e => {
        console.error('[Galgame界面插件] 图片加载失败:', e);
        reject(e);
      };

      if (typeof source === 'string') {
        this.image.src = source;
        return;
      }

      // 兼容跨窗口/跨 iframe 的 File/Blob 对象
      const isFileLike = !!source
        && typeof source === 'object'
        && typeof source.size === 'number'
        && typeof source.type === 'string'
        && (typeof source.arrayBuffer === 'function' || typeof source.slice === 'function');

      if (isFileLike) {
        const ReaderCtor = topWindow?.FileReader || FileReader;
        const reader = new ReaderCtor();
        reader.onload = e => {
          this.image.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(source);
        return;
      }

      reject(new Error('不支持的图片来源'));
    });
  }
  calculateInitialScale() {
    if (!this.canvas || !this.image || !this.imageLoaded) return;
    const containerWidth = this.canvas.width > 0 ? this.canvas.width : 500;
    const containerHeight = this.canvas.height > 0 ? this.canvas.height : 320;
    this.cropHeight = containerHeight * 0.8;
    this.cropWidth = this.cropHeight * this.aspectRatio;
    if (this.cropWidth > containerWidth * 0.8) {
      this.cropWidth = containerWidth * 0.8;
      this.cropHeight = this.cropWidth / this.aspectRatio;
    }
    const scaleToFitWidth = this.cropWidth / this.image.width;
    const scaleToFitHeight = this.cropHeight / this.image.height;
    const coverScale = Math.max(scaleToFitWidth, scaleToFitHeight);
    this.minScale = CROPPER_MIN_SCALE;
    this.scale = Math.max(this.minScale, coverScale * 1.2);
    this.maxScale = Math.max(coverScale * 5, 3);
    this.offsetX = 0;
    this.offsetY = 0;
  }
  attachToCanvas(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.setupEventListeners();
    if (this.imageLoaded) {
      this.calculateInitialScale();
      this.render();
    }
  }
  setupEventListeners() {
    const wrapper = this.canvas.parentElement;
    wrapper.addEventListener('mousedown', e => {
      this.isDragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      wrapper.style.cursor = 'grabbing';
    });
    wrapper.addEventListener('mousemove', e => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.offsetX += dx;
      this.offsetY += dy;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.constrainOffset();
      this.render();
    });
    wrapper.addEventListener('mouseup', () => {
      this.isDragging = false;
      wrapper.style.cursor = 'move';
    });
    wrapper.addEventListener('mouseleave', () => {
      this.isDragging = false;
      wrapper.style.cursor = 'move';
    });
    wrapper.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastX = e.touches[0].clientX;
        this.lastY = e.touches[0].clientY;
      }
    });
    wrapper.addEventListener('touchmove', e => {
      if (!this.isDragging || e.touches.length !== 1) return;
      e.preventDefault();
      const dx = e.touches[0].clientX - this.lastX;
      const dy = e.touches[0].clientY - this.lastY;
      this.offsetX += dx;
      this.offsetY += dy;
      this.lastX = e.touches[0].clientX;
      this.lastY = e.touches[0].clientY;
      this.constrainOffset();
      this.render();
    });
    wrapper.addEventListener('touchend', () => {
      this.isDragging = false;
    });
  }
  setScale(newScale) {
    this.scale = Math.max(this.minScale, Math.min(this.maxScale, newScale));
    this.constrainOffset();
    this.render();
  }
  constrainOffset() {
    if (!this.image) return;
    const scaledWidth = this.image.width * this.scale;
    const scaledHeight = this.image.height * this.scale;
    if (scaledWidth <= this.cropWidth) {
      this.offsetX = 0;
    } else {
      const maxOffsetX = (scaledWidth - this.cropWidth) / 2;
      this.offsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, this.offsetX));
    }
    if (scaledHeight <= this.cropHeight) {
      this.offsetY = 0;
    } else {
      const maxOffsetY = (scaledHeight - this.cropHeight) / 2;
      this.offsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, this.offsetY));
    }
  }
  reset() {
    this.calculateInitialScale();
    this.render();
  }
  render() {
    if (!this.ctx || !this.image || !this.imageLoaded) return;
    const containerWidth = this.canvas.width || 500;
    const containerHeight = this.canvas.height || 320;
    if (this.cropWidth === 0 || this.cropHeight === 0) {
      this.calculateInitialScale();
    }
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, containerWidth, containerHeight);
    const scaledWidth = this.image.width * this.scale;
    const scaledHeight = this.image.height * this.scale;
    const drawX = (containerWidth - scaledWidth) / 2 + this.offsetX;
    const drawY = (containerHeight - scaledHeight) / 2 + this.offsetY;
    this.ctx.drawImage(this.image, drawX, drawY, scaledWidth, scaledHeight);
    const cropX = (containerWidth - this.cropWidth) / 2;
    const cropY = (containerHeight - this.cropHeight) / 2;
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this.ctx.fillRect(0, 0, containerWidth, cropY);
    this.ctx.fillRect(0, cropY + this.cropHeight, containerWidth, containerHeight - cropY - this.cropHeight);
    this.ctx.fillRect(0, cropY, cropX, this.cropHeight);
    this.ctx.fillRect(cropX + this.cropWidth, cropY, containerWidth - cropX - this.cropWidth, this.cropHeight);
    this.ctx.strokeStyle = '#00d2ff';
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(cropX, cropY, this.cropWidth, this.cropHeight);
    const cornerSize = 15;
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.moveTo(cropX, cropY + cornerSize);
    this.ctx.lineTo(cropX, cropY);
    this.ctx.lineTo(cropX + cornerSize, cropY);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(cropX + this.cropWidth - cornerSize, cropY);
    this.ctx.lineTo(cropX + this.cropWidth, cropY);
    this.ctx.lineTo(cropX + this.cropWidth, cropY + cornerSize);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(cropX, cropY + this.cropHeight - cornerSize);
    this.ctx.lineTo(cropX, cropY + this.cropHeight);
    this.ctx.lineTo(cropX + cornerSize, cropY + this.cropHeight);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(cropX + this.cropWidth - cornerSize, cropY + this.cropHeight);
    this.ctx.lineTo(cropX + this.cropWidth, cropY + this.cropHeight);
    this.ctx.lineTo(cropX + this.cropWidth, cropY + this.cropHeight - cornerSize);
    this.ctx.stroke();
  }
  getCroppedBlob(outputWidth = 400) {
    return new Promise(resolve => {
      const outputHeight = outputWidth / this.aspectRatio;
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = outputWidth;
      outputCanvas.height = outputHeight;
      const outputCtx = outputCanvas.getContext('2d');
      const containerWidth = this.canvas.width || 500;
      const containerHeight = this.canvas.height || 320;
      const scaledWidth = this.image.width * this.scale;
      const scaledHeight = this.image.height * this.scale;
      const drawX = (containerWidth - scaledWidth) / 2 + this.offsetX;
      const drawY = (containerHeight - scaledHeight) / 2 + this.offsetY;
      const cropX = (containerWidth - this.cropWidth) / 2;
      const cropY = (containerHeight - this.cropHeight) / 2;
      const srcX = (cropX - drawX) / this.scale;
      const srcY = (cropY - drawY) / this.scale;
      const srcWidth = this.cropWidth / this.scale;
      const srcHeight = this.cropHeight / this.scale;
      outputCtx.drawImage(this.image, srcX, srcY, srcWidth, srcHeight, 0, 0, outputWidth, outputHeight);
      outputCanvas.toBlob(blob => resolve(blob), 'image/png', 1);
    });
  }
}

// ============================================
// 角色外貌提示词编辑弹窗
// ============================================
export function showCharAppearancePromptEditor(characterId, onSave) {
  const currentPrompt = getCharAppearancePrompt(characterId);
  const modalHtml = `
            <div class="gal-input-modal" id="gal-appearance-prompt-modal">
                <div class="gal-input-box" style="max-width: 550px; width: 90%; padding: 25px;">
                    <div class="gal-input-title" style="margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
                        <span><i class="fa-solid fa-palette"></i> ${characterId} 的外貌提示词</span>
                        <button id="gal-appearance-close-x" title="关闭" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px; line-height: 1; transition: color 0.2s; transform: none;">
                          <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};">
                            角色外观描述 (用于AI绘图)
                        </label>
                        <textarea id="gal-appearance-prompt-input"
                                  placeholder="例如: 1girl, long white hair, blue eyes, school uniform, slender figure..."
                                  style="width: 100%; height: 150px; padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 0.95rem; resize: vertical; box-sizing: border-box;">${currentPrompt}</textarea>
                        <small style="color: #888; margin-top: 5px; display: block;">
                            此提示词将作为文生图时的基础外观描述，放在最终提示词的最前面。
                        </small>
                    </div>
                    <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin-bottom: 15px;">
                        <div style="font-weight: 600; margin-bottom: 8px; color: ${THEME.dark};">
                            <i class="fa-solid fa-lightbulb"></i> 提示词建议
                        </div>
                        <div style="font-size: 0.85rem; color: #666; line-height: 1.6;">
                            • 性别/人数: 1girl, 1boy, solo<br>
                            • 发型发色: long hair, short hair, black hair, blonde<br>
                            • 眼睛: blue eyes, red eyes, heterochromia<br>
                            • 服装: school uniform, dress, casual clothes<br>
                            • 体型: slender, petite, tall, muscular
                        </div>
                    </div>
                    <div class="gal-input-actions" style="display: flex; gap: 12px;">
                        <button class="gal-action-btn primary" id="gal-appearance-save" style="flex: 1; min-height: 44px;">
                            <i class="fa-solid fa-save"></i>
                            <span>保存</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
  const mountRoot = getModalMountRoot();
  $(mountRoot).append(modalHtml);
  const $modal = $(mountRoot).find('#gal-appearance-prompt-modal');
  makeDraggable($modal.find('.gal-input-box'), $modal.find('.gal-input-title'));
  $modal.find('#gal-appearance-close-x').on('click', () => $modal.remove());
  $modal.on('click', function (e) {
    if (e.target === this) $modal.remove();
  });
  $modal.find('#gal-appearance-save').on('click', function () {
    const newPrompt = $modal.find('#gal-appearance-prompt-input').val().trim();
    setCharAppearancePrompt(characterId, newPrompt);
    showToast(`已保存 ${characterId} 的外貌提示词`);
    $modal.remove();
    if (typeof onSave === 'function') onSave(newPrompt);
  });
}

// ============================================
// CG模式角色外观选择弹窗
// ============================================
export async function showBananaAppearancePicker(onSelect) {
  $('#gal-banana-appearance-picker').remove();
  const sprites = await getAllSprites();
  if (!sprites || sprites.length === 0) {
    showToast('暂无可用立绘，请先上传立绘');
    return;
  }
  const grouped = new Map();
  sprites.forEach(s => {
    const charId = s.characterId || '未知角色';
    if (!grouped.has(charId)) grouped.set(charId, []);
    grouped.get(charId).push(s);
  });
  const blobUrls = [];
  const groupsHtml = Array.from(grouped.entries())
    .map(([charId, list]) => {
      const itemsHtml = list
        .map(s => {
          const preview = s.imageUrl || (s.imageBlob ? URL.createObjectURL(s.imageBlob) : '');
          if (preview && preview.startsWith('blob:')) blobUrls.push(preview);
          return `
                <div class="gal-banana-appearance-item" data-char="${charId}" data-expr="${s.expression}" style="border: 1px solid #334155; border-radius: 8px; padding: 8px; background: #0f172a; cursor: pointer;">
                  <div style="aspect-ratio: 2 / 3; background: #020617; border-radius: 6px; overflow: hidden; margin-bottom: 6px; display: flex; align-items: center; justify-content: center;">
                    ${
                      preview
                        ? `<img src="${preview}" alt="${s.expression}" style="width: 100%; height: 100%; object-fit: cover;">`
                        : `<div style="font-size: 0.75rem; color: #64748b;">无立绘</div>`
                    }
                  </div>
                  <div style="font-size: 0.8rem; color: #e2e8f0;">${s.expression || '默认'}</div>
                </div>
              `;
        })
        .join('');
      return `
            <div style="margin-bottom: 16px;">
              <div style="font-size: 0.9rem; font-weight: 700; color: #e2e8f0; margin-bottom: 8px;">${charId}</div>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px;">
                ${itemsHtml}
              </div>
            </div>
          `;
    })
    .join('');
  const modalHtml = `
        <div class="gal-input-modal" id="gal-banana-appearance-picker">
          <div class="gal-input-box" style="max-width: 900px; width: 96%; max-height: 85vh; overflow: hidden; padding: 0; display: flex; flex-direction: column;">
            <div class="gal-input-title" style="padding: 16px 20px; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; background: #0f172a; color: #fff;">
              <span><i class="fa-solid fa-user"></i> 选择角色立绘（最多3个）</span>
              <button id="gal-banana-appearance-close" style="background: transparent; color: #fff; border: none; cursor: pointer; font-size: 1.1rem;">
                <i class="fa-solid fa-times"></i>
              </button>
            </div>
            <div style="padding: 16px 20px; overflow-y: auto; background: #0b1220;">
              ${groupsHtml}
            </div>
          </div>
        </div>
      `;
  const mountRoot = getModalMountRoot();
  $(mountRoot).append(modalHtml);
  const $modal = $(mountRoot).find('#gal-banana-appearance-picker');
  makeDraggable($modal.find('.gal-input-box'), $modal.find('.gal-input-title'));
  const cleanup = () => {
    blobUrls.forEach(u => {
      try { URL.revokeObjectURL(u); } catch (e) {}
    });
  };
  $modal.on('click', function (e) {
    if (e.target === this) { cleanup(); $modal.remove(); }
  });
  $modal.find('#gal-banana-appearance-close').on('click', () => { cleanup(); $modal.remove(); });
  $modal.find('.gal-banana-appearance-item').on('click', function () {
    const charId = $(this).attr('data-char');
    const expr = $(this).attr('data-expr') || '默认';
    if (typeof onSelect === 'function') {
      onSelect({ characterId: charId, characterName: charId, expression: expr });
    }
    cleanup();
    $modal.remove();
  });
}

// ============================================
// 立绘上传对话框（带裁剪功能）
// ============================================
export async function showSpriteUploadDialog(characterId, expression, onCloseCallback) {
  const allExpressions = getAllExpressions();
  const expressionOptions = allExpressions
    .map(
      e =>
        `<option value="${e}" ${e === expression || (expression === 'neutral' && e === '默认') ? 'selected' : ''}>${e}</option>`,
    )
    .join('');
  const ttsVoiceList = await getTTSVoiceListAsync();
  const settings = getSettings();
  let { ratioLabel: spriteUploadRatioLabel, aspectRatio: spriteAspectRatio } = resolveSpriteUploadAspectRatio();
  const cropRatioOptions = SPRITE_UPLOAD_RATIO_OPTIONS
    .map(item => `<option value="${item.value}" ${item.value === spriteUploadRatioLabel ? 'selected' : ''}>${item.label}</option>`)
    .join('');
  const ttsVoiceOptions = ttsVoiceList
    .map(v => `<option value="${v.name}" ${getCharacterTTSVoice(characterId) === v.name ? 'selected' : ''}>${v.name} (${v.desc})</option>`)
    .join('');
  const modalHtml = `
      <div class="gal-input-modal" id="gal-sprite-upload-modal">
        <div class="gal-input-box gal-modal-layout-fixed" style="max-width: 700px; width: 90%; max-height: 90vh; overflow: hidden; padding: 0; display: flex; flex-direction: column;">
          <div class="gal-input-title gal-modal-fixed-header" style="padding: 18px 25px 14px 25px; border-bottom: 1px solid #eee; margin: 0; font-size: 1.4rem; display: flex; align-items: center; justify-content: space-between;">
            <span>上传角色立绘</span>
            <button id="gal-sprite-upload-close-x" title="关闭" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px; line-height: 1; transition: color 0.2s; transform: none;">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="gal-modal-scroll-body" style="padding: 15px 25px 10px 25px;">
          <div style="margin-bottom: 15px; display: flex; gap: 15px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark}; font-size: 1rem;">
                <i class="fa-solid fa-user"></i> 角色名称
              </label>
              <input type="text" id="gal-sprite-character" value="${characterId || ''}"
                     placeholder="输入角色名"
                     style="width: 100%; padding: 12px 15px; border: 2px solid #ddd; font-size: 1rem; box-sizing: border-box; border-radius: 4px;">
            </div>
            <div style="flex: 1;">
              <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark}; font-size: 1rem;">
                <i class="fa-solid fa-face-smile"></i> 表情类型
              </label>
              <select id="gal-sprite-expression"
                      style="width: 100%; padding: 12px 15px; border: 2px solid #ddd; font-size: 1rem; cursor: pointer; box-sizing: border-box; border-radius: 4px;">
                ${expressionOptions}
              </select>
            </div>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark}; font-size: 1rem;">
              <i class="fa-solid fa-crop-simple"></i> 立绘裁剪比例
            </label>
            <select id="gal-sprite-upload-ratio"
                    title="立绘裁剪比例"
                    style="width: 100%; padding: 10px 14px; border: 2px solid #ddd; border-radius: 6px; font-size: 1rem; color: #333; background: #fff;">
              ${cropRatioOptions}
            </select>
          </div>
          <!-- TTS音色选择 -->
          <div style="margin-bottom: 15px; background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%); padding: 15px; border-radius: 8px; border: 1px solid #ddd;">
            <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark}; font-size: 1rem;">
              <i class="fa-solid fa-microphone-lines"></i> TTS配音音色
              <small style="font-weight: normal; color: #666; margin-left: 8px;">为该角色绑定专属配音音色</small>
            </label>
            <div style="display: flex; gap: 10px;">
              <select id="gal-tts-voice-select"
                      style="flex: 1; padding: 10px 15px; border: 2px solid #ddd; font-size: 1rem; cursor: pointer; border-radius: 4px; background: #fff; color: #333;">
                <option value="">-- 不绑定音色 --</option>
                ${ttsVoiceOptions}
              </select>
              <button class="gal-action-btn" id="gal-tts-voice-save-btn" style="white-space: nowrap; padding: 10px 20px;">
                <i class="fa-solid fa-check"></i> 绑定
              </button>
            </div>
            <small style="color: #888; margin-top: 6px; display: block;">
              <i class="fa-solid fa-circle-info"></i> 绑定后AI会自动为该角色使用此音色配音
            </small>
          </div>
          <div class="gal-upload-tabs" style="display: flex; border-bottom: 1px solid #ddd; margin-bottom: 15px;">
            <div class="gal-upload-tab active" data-target="local" style="padding: 8px 15px; cursor: pointer; font-weight: bold; color: ${THEME.dark}; border-bottom: 2px solid ${THEME.accent};">本地上传</div>
            <div class="gal-upload-tab" data-target="remote" style="padding: 8px 15px; cursor: pointer; color: #888;">远程链接</div>
            <div class="gal-upload-tab" data-target="comfyui" style="padding: 8px 15px; cursor: pointer; color: #888;">
                <i class="fa-solid fa-wand-magic-sparkles"></i> 本地文生图
            </div>
          </div>
          <div id="gal-upload-local" class="gal-upload-pane">
            <input type="file" id="gal-sprite-file" accept="image/*" style="display: none;">
            <div class="gal-upload-card" id="gal-upload-trigger" style="margin-bottom: 15px; min-height: 200px;">
              <i class="fa-solid fa-cloud-arrow-up" style="font-size: 3.5rem;"></i>
              <span style="font-size: 1.2rem; margin-top: 10px;">点击选择立绘图片</span>
              <small style="color: #999; margin-top: 8px; font-size: 0.9rem;">支持 PNG / JPG / GIF / WebP</small>
              <small style="color: ${THEME.accent}; margin-top: 4px; font-size: 0.9rem;">立绘将自动裁剪为 <span id="gal-sprite-ratio-label">${spriteUploadRatioLabel}</span> 比例</small>
            </div>
          </div>
          <div id="gal-upload-remote" class="gal-upload-pane" style="display: none;">
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px dashed #ccc; text-align: center; min-height: 160px; display: flex; flex-direction: column; justify-content: center;">
              <div style="margin-bottom: 15px;">
                <input type="text" id="gal-sprite-remote-url" placeholder="输入图片 URL (https://...)"
                       style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
              </div>
              <button class="gal-action-btn" id="gal-sprite-fetch-btn" style="width: 100%;">
                <i class="fa-solid fa-download"></i> 获取图片
              </button>
            </div>
          </div>
          <div id="gal-upload-comfyui" class="gal-upload-pane" style="display: none;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 15px; border-radius: 8px; color: #fff; margin-bottom: 15px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                        <i class="fa-solid fa-wand-magic-sparkles" style="font-size: 1.5rem;"></i>
                        <span style="font-weight: 700; font-size: 1.1rem;">ComfyUI 文生图</span>
                    </div>
                    <div style="font-size: 0.85rem; opacity: 0.9;">
                        使用本地ComfyUI自动生成角色立绘
                    </div>
                </div>
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <div style="flex: 1;">
                        <label style="font-weight: 700; display: block; margin-bottom: 5px;">工作流</label>
                        <select id="gal-comfy-wf-select" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></select>
                    </div>
                    <div style="flex: 1;">
                        <label style="font-weight: 700; display: block; margin-bottom: 5px;">Checkpoint 模型</label>
                        <select id="gal-comfy-checkpoint-select" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                             <option value="">(加载中...)</option>
                        </select>
                    </div>
                </div>
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <label style="font-weight: 700; color: ${THEME.dark};">
                            <i class="fa-solid fa-user"></i> 角色外貌基础提示词
                        </label>
                        <button class="gal-action-btn" id="gal-edit-appearance-btn" style="padding: 4px 10px; font-size: 0.8rem;">
                            <i class="fa-solid fa-pen"></i> 编辑
                        </button>
                    </div>
                    <div id="gal-appearance-preview" style="background: #f5f5f5; padding: 10px; border-radius: 6px; font-size: 0.85rem; color: #666; min-height: 40px; border: 1px dashed #ddd;">
                        ${getCharAppearancePrompt(characterId) || '<i style="color: #999;">未设置，点击右侧按钮添加</i>'}
                    </div>
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};">
                        <i class="fa-solid fa-face-smile"></i> 当前表情: <span id="gal-comfyui-expr-label" style="color: ${THEME.accent};">${expression}</span>
                    </label>
                    <div style="background: #e8f4fc; padding: 8px 12px; border-radius: 6px; font-size: 0.85rem; color: #0066cc;">
                        <i class="fa-solid fa-arrow-right"></i>
                        将生成: <code id="gal-comfyui-expr-tag">${getExpressionTag(expression)}</code>
                    </div>
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};">
                        <i class="fa-solid fa-plus"></i> 额外描述 (可选)
                    </label>
                    <textarea id="gal-comfyui-extra-prompt"
                              placeholder="添加额外的场景、姿势、光照描述..."
                              style="width: 100%; height: 60px; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem; resize: vertical; box-sizing: border-box;"></textarea>
                </div>
                <button class="gal-action-btn primary" id="gal-comfyui-generate-btn" style="width: 100%; min-height: 50px; justify-content: center; font-size: 1.1rem;">
                    <i class="fa-solid fa-sparkles"></i>
                    <span>生成立绘</span>
                </button>
                <div id="gal-comfyui-result" style="display: none; margin-top: 15px;">
                    <div style="text-align: center;">
                        <img id="gal-comfyui-preview-img" style="max-width: 100%; max-height: 300px; border-radius: 8px; border: 2px solid ${THEME.accent};">
                    </div>
                </div>
          </div>
          <!-- 选择图片后显示裁剪区 -->
          <div id="gal-crop-area" style="display: none;">
            <div class="gal-crop-container">
              <div class="gal-crop-canvas-wrapper" id="gal-crop-wrapper">
                <canvas id="gal-crop-canvas"></canvas>
              </div>
              <div class="gal-crop-controls">
                <button class="gal-crop-btn reset" id="gal-crop-reset" title="重置位置">
                  <i class="fa-solid fa-undo"></i> 重置
                </button>
                <input type="range" id="gal-crop-zoom" class="gal-crop-zoom-slider" min="10" max="300" value="100" style="width: 180px;">
                <span class="gal-crop-zoom-label" id="gal-zoom-value" style="min-width: 50px; font-size: 0.95rem;">100%</span>
                <button class="gal-crop-btn" id="gal-change-image" style="background: ${THEME.accent}; color: ${THEME.dark};" title="更换图片">
                  <i class="fa-solid fa-image"></i> 换图
                </button>
              </div>
            </div>
            <p style="text-align: center; color: #666; font-size: 0.85rem; margin: 8px 0 12px 0;">
              <i class="fa-solid fa-hand-pointer"></i> 拖动图片调整位置，滑块调整缩放
            </p>
          </div>
          </div>
          <div class="gal-input-actions gal-modal-fixed-actions" style="display: flex; gap: 15px; margin: 0; padding: 15px 25px 20px 25px; border-top: 1px solid #eee;">
            <button class="gal-action-btn" id="gal-batch-upload-btn" style="flex: 1; background: #666; color: #fff; min-height: 48px; padding: 12px 16px; font-size: 1rem;">
              <i class="fa-solid fa-images"></i>
              <span>批量上传</span>
            </button>
            <button class="gal-action-btn primary" id="gal-upload-confirm" style="flex: 1; min-height: 48px; padding: 12px 16px; font-size: 1rem;" disabled>
              <i class="fa-solid fa-check"></i>
              <span>保存立绘</span>
            </button>
          </div>
        </div>
      </div>
    `;
  const mountRoot = getModalMountRoot();
  $(mountRoot).append(modalHtml);
  const $modal = $(mountRoot).find('#gal-sprite-upload-modal');
  makeDraggable($modal.find('.gal-input-box'), $modal.find('.gal-input-title'));
  const $fileInput = $modal.find('#gal-sprite-file');
  const $confirmBtn = $modal.find('#gal-upload-confirm');
  const $uploadTrigger = $modal.find('#gal-upload-trigger');
  const $cropArea = $modal.find('#gal-crop-area');
  const $zoomSlider = $modal.find('#gal-crop-zoom');
  const $zoomValue = $modal.find('#gal-zoom-value');
  let cropper = null;
  $uploadTrigger.on('click', () => $fileInput.click());
  $modal.find('#gal-change-image').on('click', () => $fileInput.click());
  const handleClose = () => {
    $modal.remove();
    if (typeof onCloseCallback === 'function') {
      try { onCloseCallback(); } catch (e) { console.warn(`[${SCRIPT_NAME}] 回调执行失败:`, e); }
    }
  };
  $('#gal-sprite-upload-close-x').on('click', handleClose);
  // TTS音色绑定按钮
  $('#gal-tts-voice-save-btn').on('click', () => {
    const charName = $('#gal-sprite-character').val().trim() || characterId;
    const voiceName = $('#gal-tts-voice-select').val();
    if (!charName) { showToast('请先输入角色名称'); return; }
    setCharacterTTSVoice(charName, voiceName);
    if (voiceName) { showToast(`已绑定: ${charName} → ${voiceName}`); }
    else { showToast(`已清除 ${charName} 的音色绑定`); }
  });
  $('#gal-sprite-character').on('input', function () {
    const newCharName = $(this).val().trim();
    if (newCharName) {
      const boundVoice = getCharacterTTSVoice(newCharName);
      $('#gal-tts-voice-select').val(boundVoice || '');
    }
  });
  const applySpriteCropRatio = (nextRatioLabel, persist = true) => {
    spriteUploadRatioLabel = normalizeSpriteUploadAspectRatio(nextRatioLabel);
    spriteAspectRatio = parseAspectRatioLabel(spriteUploadRatioLabel);
    if (persist) {
      settings.spriteUploadAspectRatio = spriteUploadRatioLabel;
      saveSettings();
    }
    $('#gal-sprite-ratio-label').text(spriteUploadRatioLabel);
    $modal.find('#gal-sprite-upload-ratio, #gal-sprite-crop-ratio').val(spriteUploadRatioLabel);
    if (cropper && typeof cropper.applyAspectRatio === 'function') {
      cropper.applyAspectRatio(spriteAspectRatio);
    }
  };
  applySpriteCropRatio(spriteUploadRatioLabel, false);
  $modal.on('change', '#gal-sprite-upload-ratio, #gal-sprite-crop-ratio', function () {
    applySpriteCropRatio($(this).val(), true);
  });
  // 批量上传按钮
  $('#gal-batch-upload-btn').on('click', () => {
    const charName = $('#gal-sprite-character').val().trim();
    $modal.remove();
    showBatchUploadDialog(charName || characterId, onCloseCallback);
  });
  // Tab 切换
  $modal.find('.gal-upload-tab').on('click', function () {
    const target = $(this).data('target');
    $modal.find('.gal-upload-tab').removeClass('active').css({ fontWeight: 'normal', color: '#888', borderBottom: 'none' });
    $(this).addClass('active').css({ fontWeight: 'bold', color: THEME.dark, borderBottom: `2px solid ${THEME.accent}` });
    $modal.find('.gal-upload-pane').hide();
    $modal.find(`#gal-upload-${target}`).show();
  });
  // 远程图片获取
  $('#gal-sprite-fetch-btn').on('click', async function () {
    const url = $('#gal-sprite-remote-url').val().trim();
    if (!url) return showToast('请输入图片链接');
    $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 获取中...');
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('网络请求失败');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('链接不是有效的图片');
      const file = new File([blob], 'remote_image.png', { type: blob.type });
      handleFileSelect(file);
    } catch (e) {
      showToast('获取失败: ' + e.message);
    } finally {
      $(this).prop('disabled', false).html('<i class="fa-solid fa-download"></i> 获取图片');
    }
  });
  // ComfyUI
  async function initComfyUICheckpointSelect() {
    const $sel = $('#gal-comfy-checkpoint-select');
    const cs = getComfyUISettings();
    try {
      const models = await ComfyUIAPI.getModels(cs.apiUrl);
      $sel.empty();
      $sel.append('<option value="">-- 使用 Workflow默认 --</option>');
      models.forEach(m => { $sel.append(`<option value="${m}">${m}</option>`); });
      if (cs.defaultCheckpoint) { $sel.val(cs.defaultCheckpoint); }
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 加载模型失败:`, e);
      $sel.html('<option value="">(加载失败)</option>');
    }
  }
  initComfyUICheckpointSelect();
  function initComfyUIWorkflowSelect() {
    const $sel = $('#gal-comfy-wf-select');
    const workflows = getComfyWorkflows();
    const cs = getComfyUISettings();
    $sel.empty();
    $sel.append('<option value="default_char">内置 SDXL Turbo</option>');
    Object.keys(workflows).forEach(id => { $sel.append(`<option value="${id}">${workflows[id].name}</option>`); });
    if (cs.defaultCharWorkflow) { $sel.val(cs.defaultCharWorkflow); }
  }
  initComfyUIWorkflowSelect();
  $('#gal-edit-appearance-btn').on('click', () => {
    const charName = $('#gal-sprite-character').val().trim() || characterId;
    showCharAppearancePromptEditor(charName, newPrompt => {
      $('#gal-appearance-preview').html(newPrompt || '<i style="color: #999;">未设置，点击右侧按钮添加</i>');
    });
  });
  $('#gal-sprite-expression').on('change', function () {
    const expr = $(this).val();
    $('#gal-comfyui-expr-label').text(expr);
    $('#gal-comfyui-expr-tag').text(getExpressionTag(expr));
  });
  $('#gal-comfyui-generate-btn').on('click', async function () {
    const charName = $('#gal-sprite-character').val().trim();
    const expr = $('#gal-sprite-expression').val();
    const extraPrompt = $('#gal-comfyui-extra-prompt').val().trim();
    const wfId = $('#gal-comfy-wf-select').val();
    const checkpointOverride = $('#gal-comfy-checkpoint-select').val();
    if (!charName) { showToast('请先输入角色名称'); return; }
    const appearancePrompt = getCharAppearancePrompt(charName);
    if (!appearancePrompt) {
      if (!confirm('尚未设置角色外貌提示词，生成的图片可能不符合角色特征。\n是否继续生成？\n（建议先点击"编辑"按钮设置外貌描述）')) return;
    }
    $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 生成中...');
    $('#gal-comfyui-result').hide();
    const positive = [appearancePrompt, getExpressionTag(expr), extraPrompt, 'masterpiece, best quality, highres'].filter(p => p && p.trim()).join(', ');
    const cs = getComfyUISettings();
    const negative = cs.negativePrompt || DEFAULT_COMFYUI_SETTINGS.negativePrompt;
    let workflow;
    if (wfId === 'default_char' || !wfId) {
      workflow = ComfyUIAPI.buildDefaultWorkflow(positive, negative, 512, 768, 20, 7);
    } else {
      const workflows = getComfyWorkflows();
      const stored = workflows[wfId];
      workflow = stored ? stored.json : ComfyUIAPI.buildDefaultWorkflow(positive, negative, 512, 768, 20, 7);
    }
    try {
      const blob = await ComfyUIAPI.generate(workflow, positive, negative, { checkpointOverride });
      const fileName = `comfyui_gen_${Date.now()}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      handleFileSelect(file);
      showToast('立绘生成成功！请在上方裁剪区域调整后保存');
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] ComfyUI生成失败:`, e);
      showToast('生成失败: ' + e.message);
    } finally {
      $(this).prop('disabled', false).html('<i class="fa-solid fa-sparkles"></i><span>生成立绘</span>');
    }
  });
  $modal.on('click', function (e) {
    if (e.target === this) handleClose();
  });
  // 封装文件处理逻辑
  async function handleFileSelect(file) {
    if (!file) return;
    $modal.find('.gal-upload-tabs, .gal-upload-pane').hide();
    $cropArea.show();
    $confirmBtn.prop('disabled', false);
    const canvas = topWindow.document.getElementById('gal-crop-canvas');
    if (!canvas) { console.error('[Galgame界面插件] 未找到裁剪 canvas'); showToast('裁剪区域初始化失败'); return; }
    const CANVAS_WIDTH = 640;
    const CANVAS_HEIGHT = 380;
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const img = new Image();
    const imageLoadPromise = new Promise((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = e => { console.error('[Galgame界面插件] 图片加载错误:', e); reject(e); };
    });
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target.result; };
    reader.onerror = e => { console.error('[Galgame界面插件] 文件读取错误:', e); showToast('文件读取失败'); };
    reader.readAsDataURL(file);
    try { await imageLoadPromise; } catch (e) { showToast('图片加载失败，请重试'); return; }
    const ctx = canvas.getContext('2d');
    let cropHeight = 0;
    let cropWidth = 0;
    let cropX = 0;
    let cropY = 0;
    let containScale = 1;
    let coverScale = 1;
    let minScale = CROPPER_MIN_SCALE;
    let maxScale = 3;
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;
    const recalcCropRect = () => {
      cropHeight = CANVAS_HEIGHT * 0.85;
      cropWidth = cropHeight * spriteAspectRatio;
      if (cropWidth > CANVAS_WIDTH * 0.85) {
        cropWidth = CANVAS_WIDTH * 0.85;
        cropHeight = cropWidth / spriteAspectRatio;
      }
      cropX = (CANVAS_WIDTH - cropWidth) / 2;
      cropY = (CANVAS_HEIGHT - cropHeight) / 2;
    };
    const recalcScaleBounds = (preserveScale = true) => {
      const scaleToFitWidth = cropWidth / img.width;
      const scaleToFitHeight = cropHeight / img.height;
      coverScale = Math.max(scaleToFitWidth, scaleToFitHeight);
      containScale = Math.min(scaleToFitWidth, scaleToFitHeight);
      minScale = CROPPER_MIN_SCALE;
      maxScale = Math.max(coverScale * 5, 3);
      if (preserveScale) {
        scale = Math.max(minScale, Math.min(maxScale, scale));
      } else {
        scale = Math.max(containScale, coverScale * 1.1);
      }
    };
    const syncZoomSlider = () => {
      $zoomSlider.attr('min', Math.round(minScale * 100));
      $zoomSlider.attr('max', Math.round(maxScale * 100));
      $zoomSlider.val(Math.round(scale * 100));
      $zoomValue.text(Math.round(scale * 100) + '%');
    };
    const clampOffsets = () => {
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      if (scaledWidth <= cropWidth) {
        offsetX = 0;
      } else {
        const maxOffsetX = (scaledWidth - cropWidth) / 2;
        offsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetX));
      }
      if (scaledHeight <= cropHeight) {
        offsetY = 0;
      } else {
        const maxOffsetY = (scaledHeight - cropHeight) / 2;
        offsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY));
      }
    };
    function renderCrop() {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      const drawX = (CANVAS_WIDTH - scaledWidth) / 2 + offsetX;
      const drawY = (CANVAS_HEIGHT - scaledHeight) / 2 + offsetY;
      ctx.drawImage(img, drawX, drawY, scaledWidth, scaledHeight);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, cropY);
      ctx.fillRect(0, cropY + cropHeight, CANVAS_WIDTH, CANVAS_HEIGHT - cropY - cropHeight);
      ctx.fillRect(0, cropY, cropX, cropHeight);
      ctx.fillRect(cropX + cropWidth, cropY, CANVAS_WIDTH - cropX - cropWidth, cropHeight);
      ctx.strokeStyle = '#00d2ff';
      ctx.lineWidth = 3;
      ctx.strokeRect(cropX, cropY, cropWidth, cropHeight);
    }
    recalcCropRect();
    recalcScaleBounds(false);
    clampOffsets();
    renderCrop();
    let isDragging = false;
    let lastX = 0, lastY = 0;
    canvas.onmousedown = e => { isDragging = true; lastX = e.clientX; lastY = e.clientY; canvas.style.cursor = 'grabbing'; };
    canvas.onmousemove = e => {
      if (!isDragging) return;
      const dx = e.clientX - lastX; const dy = e.clientY - lastY;
      offsetX += dx; offsetY += dy; lastX = e.clientX; lastY = e.clientY;
      clampOffsets();
      renderCrop();
    };
    canvas.onmouseup = () => { isDragging = false; canvas.style.cursor = 'move'; };
    canvas.onmouseleave = () => { isDragging = false; canvas.style.cursor = 'move'; };
    syncZoomSlider();
    $zoomSlider.off('input').on('input', function () {
      scale = parseInt($(this).val()) / 100;
      scale = Math.max(minScale, Math.min(maxScale, scale));
      $zoomValue.text(Math.round(scale * 100) + '%');
      clampOffsets();
      renderCrop();
    });
    $('#gal-crop-reset').off('click').on('click', () => {
      scale = Math.max(containScale, coverScale * 1.1);
      offsetX = 0; offsetY = 0;
      $zoomSlider.val(Math.round(scale * 100));
      $zoomValue.text(Math.round(scale * 100) + '%');
      renderCrop();
    });
    cropper = {
      getCroppedBlob: (outputWidth = 400) => {
        return new Promise(resolve => {
          const outputHeight = outputWidth / spriteAspectRatio;
          const outputCanvas = document.createElement('canvas');
          outputCanvas.width = outputWidth; outputCanvas.height = outputHeight;
          const outputCtx = outputCanvas.getContext('2d');
          const scaledWidth = img.width * scale; const scaledHeight = img.height * scale;
          const drawX = (CANVAS_WIDTH - scaledWidth) / 2 + offsetX;
          const drawY = (CANVAS_HEIGHT - scaledHeight) / 2 + offsetY;
          const srcX = (cropX - drawX) / scale; const srcY = (cropY - drawY) / scale;
          const srcWidth = cropWidth / scale; const srcHeight = cropHeight / scale;
          outputCtx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, outputWidth, outputHeight);
          outputCanvas.toBlob(blob => resolve(blob), 'image/png', 1);
        });
      },
      applyAspectRatio: (nextAspectRatio) => {
        if (!Number.isFinite(nextAspectRatio) || nextAspectRatio <= 0) return;
        spriteAspectRatio = nextAspectRatio;
        recalcCropRect();
        recalcScaleBounds(true);
        clampOffsets();
        syncZoomSlider();
        renderCrop();
      },
    };
  }
  $fileInput.on('change', function () {
    const file = this.files[0];
    if (!file) return;
    handleFileSelect(file);
  });
  $zoomSlider.on('input', function () {
    const scale = parseInt($(this).val()) / 100;
    if (cropper && cropper.setScale) {
      cropper.setScale(scale);
      $zoomValue.text(Math.round(cropper.scale * 100) + '%');
    }
  });
  $('#gal-crop-reset').on('click', () => {
    if (cropper && cropper.reset) {
      cropper.reset();
      $zoomSlider.val(Math.round(cropper.scale * 100));
      $zoomValue.text(Math.round(cropper.scale * 100) + '%');
    }
  });
  // 确认保存
  $confirmBtn.on('click', async function () {
    if (!cropper) return;
    const charName = $('#gal-sprite-character').val().trim();
    const expr = $('#gal-sprite-expression').val();
    if (!charName) { showToast('请输入角色名称'); return; }
    try {
      $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 处理中...');
      const croppedBlob = await cropper.getCroppedBlob(400);
      await saveSprite(charName, expr, croppedBlob);
      showToast(`已保存: ${charName} - ${expr}`);
      $modal.remove();
      refreshGalgameViews();
      if (typeof onCloseCallback === 'function') {
        try { onCloseCallback(); } catch (e) { console.warn(`[${SCRIPT_NAME}] 回调执行失败:`, e); }
      }
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 保存立绘失败:`, e);
      showToast('保存失败');
      $(this).prop('disabled', false).html('<i class="fa-solid fa-check"></i><span>保存立绘</span>');
    }
  });
}

// ============================================
// 批量上传立绘对话框 - 智能网格切分模式
// ============================================
export function showBatchUploadDialog(characterId, onCloseCallback) {
  const allExpressions = getAllExpressions();
  const settings = getSettings();
  let {
    ratioLabel: spriteUploadRatioLabel,
    aspectRatio: spriteAspectRatio,
    cssAspectRatio: spriteUploadCssAspectRatio,
  } = resolveSpriteUploadAspectRatio();
  const batchCropRatioOptions = SPRITE_UPLOAD_RATIO_OPTIONS
    .map(item => `<option value="${item.value}" ${item.value === spriteUploadRatioLabel ? 'selected' : ''}>${item.label}</option>`)
    .join('');
  const modalHtml = `
      <div class="gal-input-modal" id="gal-batch-upload-modal">
        <div class="gal-input-box" style="max-width: 1100px; width: 95%; height: 85vh; padding: 0; display: flex; flex-direction: column; overflow: hidden;">
          <div class="gal-input-title" style="padding: 15px 20px; border-bottom: 1px solid #eee; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between;">
            <span><i class="fa-solid fa-grid-2"></i> 智能批量上传立绘</span>
            <button id="gal-batch-upload-close-x" title="关闭" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px; line-height: 1; transition: color 0.2s; transform: none;">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div style="display: flex; flex: 1; overflow: hidden;">
            <div class="gal-batch-sidebar" style="width: 240px; border-right: 1px solid #ddd; background: #f8f9fa; display: flex; flex-direction: column;">
                <div style="padding: 10px; border-bottom: 1px solid #eee;">
                    <button id="gal-batch-add-char" class="gal-action-btn" style="width: 100%; justify-content: center; background: #fff; color: ${THEME.accent}; border: 1px dashed ${THEME.accent};">
                        <i class="fa-solid fa-plus"></i> 新增未获取角色
                    </button>
                </div>
                <div id="gal-batch-char-list" style="flex: 1; overflow-y: auto; padding: 5px;"></div>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                <div style="flex: 1; overflow-y: auto; padding: 20px;">
                    <div style="margin-bottom: 15px;">
                      <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};">
                        <i class="fa-solid fa-user"></i> 当前角色
                      </label>
                      <input type="text" id="gal-batch-character" value="${characterId || ''}"
                             placeholder="请在左侧选择或添加角色" readonly
                             style="width: 100%; padding: 10px 15px; border: 2px solid #eee; background: #f9f9f9; font-size: 1rem; box-sizing: border-box; border-radius: 4px; color: #555;">
                    </div>
                    <div style="margin-bottom: 12px;">
                      <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};">
                        <i class="fa-solid fa-crop-simple"></i> 立绘裁剪比例
                      </label>
                      <div style="display: flex; gap: 8px; align-items: center;">
                        <select id="gal-batch-crop-ratio"
                                style="flex: 0 0 220px; max-width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.9rem; color: #333; background: #fff;">
                          ${batchCropRatioOptions}
                        </select>
                        <small id="gal-batch-ratio-hint" style="color: #666;">当前：${spriteUploadRatioLabel}</small>
                      </div>
                    </div>
                    <div class="gal-upload-tabs" style="display: flex; border-bottom: 1px solid #ddd; margin-bottom: 15px;">
                        <div class="gal-upload-tab active" data-target="local" style="padding: 8px 15px; cursor: pointer; font-weight: bold; color: ${THEME.dark}; border-bottom: 2px solid ${THEME.accent};">本地上传</div>
                        <div class="gal-upload-tab" data-target="remote" style="padding: 8px 15px; cursor: pointer; color: #888;">远程链接</div>
                    </div>
                    <div id="gal-upload-local" class="gal-upload-pane">
                        <input type="file" id="gal-grid-file-input" accept="image/*" style="display: none;">
                        <div id="gal-grid-upload-area" class="gal-upload-card" style="margin-bottom: 15px; min-height: 180px; cursor: pointer;">
                          <i class="fa-solid fa-images" style="font-size: 3rem;"></i>
                          <span style="font-size: 1.1rem; margin-top: 10px;">点击上传表情合集图</span>
                          <small style="color: #888; margin-top: 5px;">支持包含多个表情的大图（如3x3、2x5等排列）</small>
                          <small style="color: ${THEME.accent}; margin-top: 3px;">上传后可调整网格切分</small>
                        </div>
                    </div>
                    <div id="gal-upload-remote" class="gal-upload-pane" style="display: none;">
                        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px dashed #ccc; text-align: center; min-height: 180px; display: flex; flex-direction: column; justify-content: center;">
                          <div style="margin-bottom: 15px;">
                            <input type="text" id="gal-batch-remote-url" placeholder="输入图片 URL (https://...)"
                                   style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
                          </div>
                          <button class="gal-action-btn" id="gal-batch-fetch-btn" style="width: 100%;">
                            <i class="fa-solid fa-download"></i> 获取图片
                          </button>
                        </div>
                    </div>
                    <div id="gal-grid-preview-area" style="display: none;">
                         <div style="background: #1a1a2e; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                              <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 15px; flex-wrap: wrap;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                  <label style="color: #fff; font-weight: 600; font-size: 0.9rem;">行数:</label>
                                  <button class="gal-grid-btn" data-action="row-dec">-</button>
                                  <span id="gal-grid-rows" style="color: ${THEME.accent}; font-weight: 700; min-width: 30px; text-align: center; font-size: 1.1rem;">2</span>
                                  <button class="gal-grid-btn" data-action="row-inc">+</button>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                  <label style="color: #fff; font-weight: 600; font-size: 0.9rem;">列数:</label>
                                  <button class="gal-grid-btn" data-action="col-dec">-</button>
                                  <span id="gal-grid-cols" style="color: ${THEME.accent}; font-weight: 700; min-width: 30px; text-align: center; font-size: 1.1rem;">3</span>
                                  <button class="gal-grid-btn" data-action="col-inc">+</button>
                                </div>
                                <div style="margin-left: auto; display: flex; gap: 8px;">
                                  <button class="gal-crop-btn" id="gal-grid-change-image" style="background: #666; color: #fff;">
                                    <i class="fa-solid fa-image"></i> 换图
                                  </button>
                                  <button class="gal-crop-btn" id="gal-grid-auto-detect" style="background: ${THEME.accent}; color: ${THEME.dark};">
                                    <i class="fa-solid fa-wand-magic-sparkles"></i> 自动检测
                                  </button>
                                </div>
                              </div>
                              <div id="gal-grid-canvas-container" style="position: relative; width: 100%; overflow: hidden; border-radius: 6px; background: #000;">
                                <canvas id="gal-grid-canvas" style="display: block; max-width: 100%; margin: 0 auto;"></canvas>
                              </div>
                          </div>
                          <div style="margin-bottom: 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                              <span style="font-weight: 700; color: ${THEME.dark};">
                                <i class="fa-solid fa-tags"></i> 表情映射
                              </span>
                              <small id="gal-batch-ratio-text" style="color: #888;">点击格子可修改表情名称，留空表示跳过（保存按 ${spriteUploadRatioLabel} 裁剪）</small>
                            </div>
                            <div id="gal-grid-mapping" class="gal-grid-mapping-container"></div>
                          </div>
                    </div>
                </div>
                <div class="gal-input-actions" style="display: flex; gap: 12px; padding: 15px 20px; border-top: 1px solid #eee; background: #fff; flex-shrink: 0;">
                    <button class="gal-action-btn primary" id="gal-batch-confirm" style="flex: 1; min-height: 44px;" disabled>
                      <i class="fa-solid fa-save"></i>
                      <span>保存所有立绘</span>
                    </button>
                </div>
            </div>
          </div>
        </div>
      <style>
        .gal-grid-btn { width: 32px; height: 32px; border: none; border-radius: 4px; background: ${THEME.accent}; color: ${THEME.dark}; font-size: 1.2rem; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .gal-grid-btn:hover { background: #fff; transform: scale(1.1); }
        .gal-grid-mapping-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px; max-height: 200px; overflow-y: auto; padding: 5px; }
        .gal-grid-cell { border: 2px solid #ddd; border-radius: 6px; padding: 8px; text-align: center; background: #fafafa; cursor: pointer; transition: all 0.2s; }
        .gal-grid-cell:hover { border-color: ${THEME.accent}; background: rgba(0, 210, 255, 0.1); }
        .gal-grid-cell.active { border-color: ${THEME.accent}; background: rgba(0, 210, 255, 0.15); }
        .gal-grid-cell.skipped { opacity: 0.5; background: #eee; }
        .gal-grid-cell-preview { width: 100%; aspect-ratio: var(--gal-sprite-crop-ratio, ${spriteUploadCssAspectRatio}); background: #ddd; border-radius: 4px; margin-bottom: 5px; overflow: hidden; }
        .gal-grid-cell-preview img { width: 100%; height: 100%; object-fit: cover; }
        .gal-grid-cell-label { font-size: 0.75rem; font-weight: 600; color: ${THEME.dark}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .gal-grid-cell-select { width: 100%; border: 1px solid #ccc; border-radius: 3px; padding: 3px 5px; font-size: 0.75rem; box-sizing: border-box; }
        .gal-grid-cell-select:focus { outline: none; border-color: ${THEME.accent}; }
        .gal-char-item { padding: 10px; cursor: pointer; border-radius: 4px; margin-bottom: 5px; transition: all 0.2s; display: flex; align-items: center; color: #333; }
        .gal-char-item:hover { background: #e9ecef; }
        .gal-char-item.active { background: ${THEME.accent}; color: #fff; font-weight: bold; }
      </style>
    `;
  const mountRoot = getModalMountRoot();
  $(mountRoot).append(modalHtml);
  const $modal = $(mountRoot).find('#gal-batch-upload-modal');
  makeDraggable($modal.find('.gal-input-box'), $modal.find('.gal-input-title'));
  const $fileInput = $modal.find('#gal-grid-file-input');
  const $uploadArea = $modal.find('#gal-grid-upload-area');
  const $previewArea = $modal.find('#gal-grid-preview-area');
  const $confirmBtn = $modal.find('#gal-batch-confirm');
  const $canvas = $modal.find('#gal-grid-canvas')[0];
  const ctx = $canvas.getContext('2d');
  let loadedImage = null;
  let gridRows = 2;
  let gridCols = 3;
  let cellMappings = [];
  let existingChars = new Set();
  const applyBatchCropRatioUI = () => {
    spriteUploadCssAspectRatio = formatAspectRatioCss(spriteUploadRatioLabel);
    $modal[0]?.style?.setProperty('--gal-sprite-crop-ratio', spriteUploadCssAspectRatio);
    $modal.find('#gal-batch-ratio-hint').text(`当前：${spriteUploadRatioLabel}`);
    $modal.find('#gal-batch-ratio-text').text(`点击格子可修改表情名称，留空表示跳过（保存按 ${spriteUploadRatioLabel} 裁剪）`);
    $modal.find('#gal-batch-crop-ratio').val(spriteUploadRatioLabel);
  };
  $modal.find('#gal-batch-crop-ratio').on('change', function () {
    spriteUploadRatioLabel = normalizeSpriteUploadAspectRatio($(this).val());
    spriteAspectRatio = parseAspectRatioLabel(spriteUploadRatioLabel);
    settings.spriteUploadAspectRatio = spriteUploadRatioLabel;
    saveSettings();
    applyBatchCropRatioUI();
  });
  applyBatchCropRatioUI();
  getAllSprites().then(sprites => {
    existingChars = new Set(sprites.map(s => s.characterId));
    if ($modal.find('#gal-batch-char-list').length > 0) {
      const currentFilter = $modal.find('#gal-batch-search-char').val() || '';
      renderSidebar(currentFilter);
    }
  });
  const renderSidebar = (filter = '') => {
    const $list = $('#gal-batch-char-list');
    $list.empty();
    const allChars = getCharacterListFromDatabase();
    if (characterId && !allChars.find(c => c.name === characterId)) {
      allChars.unshift({ name: characterId, type: '自定义', source: '本次' });
    }
    const filtered = allChars.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()));
    filtered.forEach(char => {
      const isActive = $('#gal-batch-character').val() === char.name;
      const hasSprites = existingChars.has(char.name);
      const $item = $(`
                    <div class="gal-char-item ${isActive ? 'active' : ''}" data-name="${char.name}">
                        <div style="width: 24px; height: 24px; background: #ddd; border-radius: 50%; margin-right: 8px; overflow: hidden;">
                             <i class="fa-solid fa-user" style="line-height: 24px; text-align: center; width: 100%; color: #fff;"></i>
                        </div>
                        <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${char.name}</div>
                        ${hasSprites ? '<i class="fa-solid fa-images" style="color: #28a745; margin-left: 8px; font-size: 0.9em;" title="已有立绘"></i>' : ''}
                    </div>
                `);
      $item.on('click', function () {
        $('#gal-batch-character').val(char.name);
        $list.find('.gal-char-item').removeClass('active');
        $(this).addClass('active');
      });
      $list.append($item);
    });
  };
  renderSidebar();
  $('#gal-batch-search-char').on('input', function () { renderSidebar($(this).val()); });
  $('#gal-batch-add-char').on('click', () => {
    const name = prompt('请输入新角色名称:');
    if (name && name.trim()) {
      const newName = name.trim();
      $('#gal-batch-character').val(newName);
      const $list = $('#gal-batch-char-list');
      $list.find('.gal-char-item').removeClass('active');
      const $item = $(`
                    <div class="gal-char-item active" data-name="${newName}">
                        <div style="width: 24px; height: 24px; background: #ddd; border-radius: 50%; margin-right: 8px; overflow: hidden;">
                                <i class="fa-solid fa-user" style="line-height: 24px; text-align: center; width: 100%; color: #fff;"></i>
                        </div>
                        <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${newName}</div>
                    </div>
                `);
      $item.on('click', function () {
        $('#gal-batch-character').val(newName);
        $list.find('.gal-char-item').removeClass('active');
        $(this).addClass('active');
      });
      $list.prepend($item);
    }
  });
  $modal.find('.gal-upload-tab').on('click', function () {
    const target = $(this).data('target');
    $modal.find('.gal-upload-tab').removeClass('active').css({ fontWeight: 'normal', color: '#888', borderBottom: 'none' });
    $(this).addClass('active').css({ fontWeight: 'bold', color: THEME.dark, borderBottom: `2px solid ${THEME.accent}` });
    $modal.find('.gal-upload-pane').hide();
    $modal.find(`#gal-upload-${target}`).show();
  });
  $uploadArea.on('click', () => $fileInput.click());
  $('#gal-grid-change-image').on('click', () => $fileInput.click());
  function handleFileSelect(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        loadedImage = img;
        autoDetectGrid(img);
        $modal.find('.gal-upload-tabs, .gal-upload-pane').hide();
        $previewArea.show();
        $confirmBtn.prop('disabled', false);
        renderGridPreview();
        updateMappingUI();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
  $('#gal-batch-fetch-btn').on('click', async function () {
    const url = $('#gal-batch-remote-url').val().trim();
    if (!url) return showToast('请输入图片链接');
    $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 获取中...');
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('网络请求失败');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('链接不是有效的图片');
      const file = new File([blob], 'remote_grid.png', { type: blob.type });
      handleFileSelect(file);
    } catch (e) {
      showToast('获取失败: ' + e.message);
    } finally {
      $(this).prop('disabled', false).html('<i class="fa-solid fa-download"></i> 获取图片');
    }
  });
  $fileInput.on('change', function () { const file = this.files[0]; if (!file) return; handleFileSelect(file); });
  function autoDetectGrid(img) {
    const ratio = img.width / img.height;
    if (ratio > 2.5) { gridRows = 1; gridCols = Math.round(ratio * 1.5); }
    else if (ratio > 1.8) { gridRows = 2; gridCols = Math.round(ratio * 2); }
    else if (ratio > 1.2) { gridRows = 2; gridCols = 3; }
    else if (ratio > 0.8) { gridRows = 3; gridCols = 3; }
    else { gridRows = Math.round(3 / ratio); gridCols = 2; }
    gridRows = Math.max(1, Math.min(5, gridRows));
    gridCols = Math.max(1, Math.min(6, gridCols));
    updateGridDisplay();
  }
  function updateGridDisplay() { $('#gal-grid-rows').text(gridRows); $('#gal-grid-cols').text(gridCols); }
  function renderGridPreview() {
    if (!loadedImage) return;
    const container = $('#gal-grid-canvas-container');
    const maxWidth = container.width() || 800;
    const maxHeight = 400;
    const scale = Math.min(maxWidth / loadedImage.width, maxHeight / loadedImage.height, 1);
    const displayWidth = loadedImage.width * scale;
    const displayHeight = loadedImage.height * scale;
    $canvas.width = displayWidth; $canvas.height = displayHeight;
    ctx.drawImage(loadedImage, 0, 0, displayWidth, displayHeight);
    ctx.strokeStyle = THEME.accent; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
    const cellWidth = displayWidth / gridCols; const cellHeight = displayHeight / gridRows;
    for (let i = 1; i < gridCols; i++) { ctx.beginPath(); ctx.moveTo(i * cellWidth, 0); ctx.lineTo(i * cellWidth, displayHeight); ctx.stroke(); }
    for (let i = 1; i < gridRows; i++) { ctx.beginPath(); ctx.moveTo(0, i * cellHeight); ctx.lineTo(displayWidth, i * cellHeight); ctx.stroke(); }
    ctx.setLineDash([]); ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let cellIndex = 0;
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const x = col * cellWidth + cellWidth / 2; const y = row * cellHeight + cellHeight / 2;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillText(String(cellIndex + 1), x, y); cellIndex++;
      }
    }
  }
  function updateMappingUI() {
    const $container = $('#gal-grid-mapping');
    $container.empty();
    const totalCells = gridRows * gridCols;
    cellMappings = [];
    const defaultExpressions = [...EXPRESSION_LIST];
    for (let i = 0; i < totalCells; i++) {
      const row = Math.floor(i / gridCols); const col = i % gridCols;
      const defaultExpr = defaultExpressions[i] || '';
      cellMappings.push({ row, col, expression: defaultExpr, skip: !defaultExpr });
      const $cell = $(`
          <div class="gal-grid-cell ${!defaultExpr ? 'skipped' : ''}" data-index="${i}">
            <div class="gal-grid-cell-preview" id="gal-cell-preview-${i}"></div>
            <select class="gal-grid-cell-select" data-index="${i}">
              <option value="">-- 跳过 --</option>
            </select>
          </div>
        `);
      $container.append($cell);
      setTimeout(() => renderCellPreview(i), 50);
    }
    updateAllSelectOptions();
    $container.find('.gal-grid-cell-select').on('change', function () {
      const index = parseInt($(this).data('index'));
      const newValue = $(this).val();
      cellMappings[index].expression = newValue; cellMappings[index].skip = !newValue;
      const $cell = $(this).closest('.gal-grid-cell');
      if (!newValue) { $cell.addClass('skipped'); } else { $cell.removeClass('skipped'); }
      updateAllSelectOptions();
    });
  }
  function updateAllSelectOptions() {
    const usedExpressions = new Set();
    cellMappings.forEach(m => { if (m.expression) usedExpressions.add(m.expression); });
    $('#gal-grid-mapping .gal-grid-cell-select').each(function () {
      const index = parseInt($(this).data('index'));
      const currentValue = cellMappings[index].expression;
      const $select = $(this);
      const savedValue = currentValue;
      $select.empty();
      $select.append('<option value="">-- 跳过 --</option>');
      allExpressions.forEach(expr => {
        if (!usedExpressions.has(expr) || expr === currentValue) {
          const selected = expr === savedValue ? 'selected' : '';
          $select.append(`<option value="${expr}" ${selected}>${expr}</option>`);
        }
      });
    });
  }
  function renderCellPreview(index) {
    if (!loadedImage) return;
    const mapping = cellMappings[index]; if (!mapping) return;
    const cellWidth = loadedImage.width / gridCols; const cellHeight = loadedImage.height / gridRows;
    const sx = mapping.col * cellWidth; const sy = mapping.row * cellHeight;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cellWidth; tempCanvas.height = cellHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(loadedImage, sx, sy, cellWidth, cellHeight, 0, 0, cellWidth, cellHeight);
    const $preview = $(`#gal-cell-preview-${index}`);
    $preview.html(`<img src="${tempCanvas.toDataURL()}" alt="Cell ${index + 1}">`);
  }
  $modal.find('.gal-grid-btn').on('click', function () {
    const action = $(this).data('action');
    switch (action) {
      case 'row-inc': if (gridRows < 5) gridRows++; break;
      case 'row-dec': if (gridRows > 1) gridRows--; break;
      case 'col-inc': if (gridCols < 6) gridCols++; break;
      case 'col-dec': if (gridCols > 1) gridCols--; break;
    }
    updateGridDisplay(); renderGridPreview(); updateMappingUI();
  });
  $('#gal-grid-auto-detect').on('click', () => {
    if (loadedImage) { autoDetectGrid(loadedImage); renderGridPreview(); updateMappingUI(); showToast('已重新检测网格'); }
  });
  const handleClose = () => {
    $modal.remove();
    if (typeof onCloseCallback === 'function') {
      try { onCloseCallback(); } catch (e) { console.warn(`[${SCRIPT_NAME}] 回调执行失败:`, e); }
    }
  };
  $('#gal-batch-upload-close-x').on('click', handleClose);
  $modal.on('click', function (e) { if (e.target === this) handleClose(); });
  // 保存所有
  $('#gal-batch-confirm').on('click', async function () {
    const charName = $('#gal-batch-character').val().trim();
    if (!charName) { showToast('请输入角色名称'); return; }
    if (!loadedImage) { showToast('请先上传图片'); return; }
    const validMappings = cellMappings.filter(m => !m.skip && m.expression);
    if (validMappings.length === 0) { showToast('请至少设置一个表情名称'); return; }
    $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 处理中...');
    const cellWidth = loadedImage.width / gridCols; const cellHeight = loadedImage.height / gridRows;
    let savedCount = 0; let failedCount = 0;
    for (const mapping of validMappings) {
      try {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = cellWidth; tempCanvas.height = cellHeight;
        const tempCtx = tempCanvas.getContext('2d');
        const sx = mapping.col * cellWidth; const sy = mapping.row * cellHeight;
        tempCtx.drawImage(loadedImage, sx, sy, cellWidth, cellHeight, 0, 0, cellWidth, cellHeight);
        const outputWidth = 400; const outputHeight = Math.max(1, Math.round(outputWidth / spriteAspectRatio));
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = outputWidth; outputCanvas.height = outputHeight;
        const outputCtx = outputCanvas.getContext('2d');
        const srcAspect = cellWidth / cellHeight; const dstAspect = spriteAspectRatio;
        let cropWidth, cropHeight, cropX, cropY;
        if (srcAspect > dstAspect) {
          cropHeight = cellHeight; cropWidth = cellHeight * dstAspect;
          cropX = (cellWidth - cropWidth) / 2; cropY = 0;
        } else {
          cropWidth = cellWidth; cropHeight = cellWidth / dstAspect;
          cropX = 0; cropY = (cellHeight - cropHeight) / 2;
        }
        outputCtx.drawImage(loadedImage, sx + cropX, sy + cropY, cropWidth, cropHeight, 0, 0, outputWidth, outputHeight);
        const blob = await new Promise(resolve => outputCanvas.toBlob(resolve, 'image/png', 1));
        await saveSprite(charName, mapping.expression, blob);
        savedCount++;
        console.log(`[${SCRIPT_NAME}] 已保存: ${charName} - ${mapping.expression}`);
      } catch (e) {
        console.error(`[${SCRIPT_NAME}] 保存 ${mapping.expression} 失败:`, e);
        failedCount++;
      }
    }
    if (failedCount > 0) { showToast(`保存完成: ${savedCount} 成功, ${failedCount} 失败`); }
    else { showToast(`已保存 ${savedCount} 张立绘`); }
    loadedImage = null;
    $previewArea.hide();
    $modal.find('.gal-upload-tabs').show();
    const activeTab = $modal.find('.gal-upload-tab.active').data('target') || 'local';
    $modal.find('.gal-upload-pane').hide();
    $modal.find(`#gal-upload-${activeTab}`).show();
    $fileInput.val('');
    $(this).prop('disabled', true).html('<i class="fa-solid fa-save"></i> <span>保存所有立绘</span>');
    refreshGalgameViews();
  });
}

// ============================================
// 自定义表情标签管理器
// ============================================
export function showCustomExpressionManager(onCloseCallback) {
  const customExpressions = getCustomExpressions();
  const modalHtml = `
            <div class="gal-input-modal" id="gal-expression-manager-modal">
                <div class="gal-input-box" style="max-width: 550px; width: 90%; padding: 25px;">
                    <div class="gal-input-title" style="margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
                        <span><i class="fa-solid fa-face-smile"></i> 管理表情标签</span>
                        <button id="gal-expr-manager-close-x" title="关闭" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px; line-height: 1; transition: color 0.2s; transform: none;">
                          <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};">
                            预设表情 (不可编辑)
                        </label>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px;">
                            ${EXPRESSION_LIST.map(e => `<span class="gal-tag gal-preset-tag">${e}</span>`).join('')}
                        </div>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};">
                            自定义表情
                        </label>
                        <div id="gal-custom-expressions-list" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 15px; min-height: 40px; border: 1px dashed #ddd; padding: 10px; border-radius: 6px;">
                            ${
                              customExpressions.length > 0
                                ? customExpressions
                                    .map(
                                      e => `
                                <div class="gal-custom-expr-row" data-expr="${e.name}" style="display: flex; align-items: center; gap: 10px;">
                                    <span class="gal-tag gal-custom-tag" style="flex-shrink: 0;">${e.name}</span>
                                    <i class="fa-solid fa-xmark gal-remove-expr" title="删除" style="cursor: pointer; color: #999; padding: 5px;"></i>
                                </div>
                            `,
                                    )
                                    .join('')
                                : '<span style="color: #999;">暂无自定义表情</span>'
                            }
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <input type="text" id="gal-new-expression-input" placeholder="添加新表情标签"
                                   style="flex: 1; padding: 10px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.95rem; color: #333; background: #fff;">
                            <button class="gal-action-btn primary" id="gal-add-expression-btn" style="padding: 10px 15px;">
                                <i class="fa-solid fa-plus"></i> 添加
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <style>
                .gal-tag { display: inline-flex; align-items: center; padding: 6px 10px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; white-space: nowrap; }
                .gal-preset-tag { background: #e9ecef; color: #495057; cursor: help; }
                .gal-custom-tag { background: ${THEME.accent}; color: ${THEME.dark}; }
                .gal-remove-expr:hover { color: #e74c3c !important; }
                .gal-custom-expr-row { background: #f8f9fa; padding: 8px 12px; border-radius: 6px; }
            </style>
        `;
  const mountRoot = getModalMountRoot();
  $(mountRoot).append(modalHtml);
  const $modal = $(mountRoot).find('#gal-expression-manager-modal');
  makeDraggable($modal.find('.gal-input-box'), $modal.find('.gal-input-title'));
  const renderCustomExpressions = () => {
    const currentCustomExpressions = getCustomExpressions();
    const $list = $modal.find('#gal-custom-expressions-list');
    $list.empty();
    if (currentCustomExpressions.length > 0) {
      $list.html(currentCustomExpressions.map(e => `
                <div class="gal-custom-expr-row" data-expr="${e.name}" style="display: flex; align-items: center; gap: 10px;">
                    <span class="gal-tag gal-custom-tag" style="flex-shrink: 0;">${e.name}</span>
                    <i class="fa-solid fa-xmark gal-remove-expr" title="删除" style="cursor: pointer; color: #999; padding: 5px;"></i>
                </div>
            `).join(''));
    } else {
      $list.html('<span style="color: #999;">暂无自定义表情</span>');
    }
  };
  $('#gal-add-expression-btn').on('click', () => {
    const newExpr = $('#gal-new-expression-input').val().trim();
    if (newExpr) { addCustomExpression(newExpr); $('#gal-new-expression-input').val(''); renderCustomExpressions(); }
  });
  $('#gal-custom-expressions-list').on('click', '.gal-remove-expr', function () {
    const exprToRemove = $(this).closest('.gal-custom-expr-row').attr('data-expr');
    if (confirm(`确定删除自定义表情「${exprToRemove}」吗？\n注意：这不会删除已使用该表情的立绘。`)) {
      removeCustomExpression(exprToRemove).then(success => { if (success) renderCustomExpressions(); });
    }
  });
  const handleClose = () => {
    $modal.remove();
    if (typeof onCloseCallback === 'function') {
      try { onCloseCallback(); } catch (e) { console.warn(`[${SCRIPT_NAME}] 回调执行失败:`, e); }
    }
  };
  $('#gal-expr-manager-close-x').on('click', handleClose);
  $modal.on('click', function (e) { if (e.target === this) handleClose(); });
}
