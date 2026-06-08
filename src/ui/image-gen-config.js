import { SCRIPT_NAME } from '../core/constants.js';
import { $ } from '../core/env.js';
import { saveSettings } from '../core/settings.js';
import { getIsEnabled } from '../core/state.js';
import { sceneBackgrounds } from '../core/store.js';
import { getComfyUISettings, saveComfyUISettings, getComfyWorkflows, saveComfyWorkflows, getBananaCharacterAppearances, setBananaCharacterAppearances, buildBananaAppearanceMultimodalContent } from '../image-gen/comfyui-helpers.js';
import { ComfyUIAPI } from '../image-gen/comfyui-api.js';
import { parseBananaImageFromResponse } from '../image-gen/banana-image.js';
import { saveBackground } from '../db/backgrounds.js';
import { injectCOTToWorldbook } from '../logic/worldbook.js';
import { showToast } from './toast.js';
import { renderBananaAppearanceList } from './asset-manager-parts.js';

// ============================================
// 生图配置 - pill 切换 + 4 引擎配置
// ============================================

let _showBananaAppearancePickerRef = null;
const BG_SOURCE_INACTIVE_COLOR = '#475569';
const BG_SOURCE_COLORS = {
  none: '#dc2626',
  comfyui: '#0369a1',
  banana: '#7e22ce',
  novelai: '#15803d',
  wallhaven: '#a16207',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function setImageGenConfigRefs({ showBananaAppearancePicker }) {
  if (showBananaAppearancePicker) _showBananaAppearancePickerRef = showBananaAppearancePicker;
}

// ============================================
// HTML 构建
// ============================================

export function buildImageGenConfigPane(settings) {
  const src = settings.bgImageSource || 'none';
  const activeEngine = (src !== 'none' && ['comfyui', 'banana', 'novelai', 'wallhaven'].includes(src)) ? src : 'comfyui';
  return `
    <div class="gal-bg-source-selector" style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: rgba(15,23,42,0.08); border: 1px solid rgba(71,85,105,0.35); border-radius: 10px; margin-bottom: 10px; flex-wrap: wrap;">
      <span style="font-weight: 700; color: #1f2937; font-size: 0.9rem; white-space: nowrap;"><i class="fa-solid fa-satellite-dish" style="margin-right: 6px;"></i>背景图来源</span>
      <label class="gal-radio-label" style="cursor:pointer;display:flex;align-items:center;gap:4px;color:${src === 'none' ? BG_SOURCE_COLORS.none : BG_SOURCE_INACTIVE_COLOR};font-size:0.85rem;font-weight:600;"><input type="radio" name="gal-bg-source" value="none" ${src === 'none' ? 'checked' : ''} style="accent-color:${BG_SOURCE_COLORS.none};"> 关闭</label>
      <label class="gal-radio-label" style="cursor:pointer;display:flex;align-items:center;gap:4px;color:${src === 'comfyui' ? BG_SOURCE_COLORS.comfyui : BG_SOURCE_INACTIVE_COLOR};font-size:0.85rem;font-weight:600;"><input type="radio" name="gal-bg-source" value="comfyui" ${src === 'comfyui' ? 'checked' : ''} style="accent-color:${BG_SOURCE_COLORS.comfyui};"> ComfyUI</label>
      <label class="gal-radio-label" style="cursor:pointer;display:flex;align-items:center;gap:4px;color:${src === 'banana' ? BG_SOURCE_COLORS.banana : BG_SOURCE_INACTIVE_COLOR};font-size:0.85rem;font-weight:600;"><input type="radio" name="gal-bg-source" value="banana" ${src === 'banana' ? 'checked' : ''} style="accent-color:${BG_SOURCE_COLORS.banana};"> 大香蕉</label>
      <label class="gal-radio-label" style="cursor:pointer;display:flex;align-items:center;gap:4px;color:${src === 'novelai' ? BG_SOURCE_COLORS.novelai : BG_SOURCE_INACTIVE_COLOR};font-size:0.85rem;font-weight:600;"><input type="radio" name="gal-bg-source" value="novelai" ${src === 'novelai' ? 'checked' : ''} style="accent-color:${BG_SOURCE_COLORS.novelai};"> NovelAI</label>
      <label class="gal-radio-label" style="cursor:pointer;display:flex;align-items:center;gap:4px;color:${src === 'wallhaven' ? BG_SOURCE_COLORS.wallhaven : BG_SOURCE_INACTIVE_COLOR};font-size:0.85rem;font-weight:600;"><input type="radio" name="gal-bg-source" value="wallhaven" ${src === 'wallhaven' ? 'checked' : ''} style="accent-color:${BG_SOURCE_COLORS.wallhaven};"> Wallhaven</label>
    </div>
    <div class="gal-imagegen-pills">
      <button class="gal-pill ${activeEngine === 'comfyui' ? 'active' : ''}" data-engine="comfyui"><i class="fa-solid fa-wand-magic-sparkles"></i> ComfyUI</button>
      <button class="gal-pill ${activeEngine === 'banana' ? 'active' : ''}" data-engine="banana"><i class="fa-solid fa-lemon"></i> 大香蕉</button>
      <button class="gal-pill ${activeEngine === 'novelai' ? 'active' : ''}" data-engine="novelai"><i class="fa-solid fa-palette"></i> NovelAI</button>
      <button class="gal-pill ${activeEngine === 'wallhaven' ? 'active' : ''}" data-engine="wallhaven"><i class="fa-solid fa-images"></i> Wallhaven</button>
    </div>
    <div data-engine-pane="comfyui" ${activeEngine !== 'comfyui' ? 'style="display:none;"' : ''}>${buildComfyUIPane()}</div>
    <div data-engine-pane="banana" ${activeEngine !== 'banana' ? 'style="display:none;"' : ''}>${buildBananaPane(settings)}</div>
    <div data-engine-pane="novelai" ${activeEngine !== 'novelai' ? 'style="display:none;"' : ''}>${buildNovelAIPane(settings)}</div>
    <div data-engine-pane="wallhaven" ${activeEngine !== 'wallhaven' ? 'style="display:none;"' : ''}>${buildWallhavenPane(settings)}</div>
  `;
}

function buildComfyUIPane() {
  return `
  <div style="padding: 15px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 10px; border: 1px solid #0f3460; margin-top: 8px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <div style="display: flex; align-items: center; gap: 10px;"><i class="fa-solid fa-wand-magic-sparkles" style="color: #00d9ff; font-size: 1.2rem;"></i><span style="font-weight: 700; color: #fff; font-size: 1.1rem;">ComfyUI 文生图</span></div>
    </div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">API 地址</label><input type="text" id="gal-comfyui-url" value="${escapeHtml(getComfyUISettings().apiUrl)}" placeholder="http://127.0.0.1:8188" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #0f3460; font-family: monospace;"></div>
    <div style="margin-bottom: 12px;"><button class="gal-action-btn" id="gal-comfyui-test" style="width: 100%; justify-content: center; padding: 10px; background: linear-gradient(135deg, #00d9ff 0%, #0099cc 100%); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 700;"><i class="fa-solid fa-plug"></i> 测试连接</button></div>
    <div style="margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <label style="color: #ccd6f6; font-size: 0.9rem; font-weight: 700;">工作流管理 (.json)</label>
        <input type="file" id="gal-comfy-import-input" accept=".json" style="display: none;">
        <button class="gal-action-btn" id="gal-comfy-import-btn" style="padding: 4px 10px; font-size: 0.8rem; background: #0f3460; color: #ccd6f6; border: 1px solid #0f3460; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-file-import"></i> 导入 JSON</button>
      </div>
      <div id="gal-workflow-list" style="max-height: 120px; overflow-y: auto; background: rgba(0,0,0,0.3); border: 1px solid #0f3460; border-radius: 4px; padding: 8px;">
        <div style="text-align: center; color: #8892b0; font-size: 0.85rem; padding: 10px;">暂无导入的工作流</div>
      </div>
    </div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">默认角色 Workflow</label><select id="gal-comfy-def-char" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #0f3460;"><option value="default_char">内置 SDXL Turbo</option></select></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">默认 Checkpoint 模型</label><select id="gal-comfy-def-checkpoint" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #0f3460;"><option value="">(加载中...)</option></select></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">默认背景 Workflow</label><select id="gal-comfy-def-bg" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #0f3460;"><option value="default_bg">内置 SDXL Turbo</option></select></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">负面提示词</label><textarea id="gal-comfyui-negative" placeholder="lowres, bad anatomy..." style="width: 100%; height: 60px; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #0f3460; font-size: 0.85rem; resize: vertical;">${escapeHtml(getComfyUISettings().negativePrompt)}</textarea></div>
  </div>`;
}

function buildBananaPane(settings) {
  return `
  <div style="padding: 15px; background: linear-gradient(135deg, #2d1b4e 0%, #1a1a2e 100%); border-radius: 10px; border: 1px solid #6b21a8; margin-top: 8px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <div style="display: flex; align-items: center; gap: 10px;"><i class="fa-solid fa-wand-magic-sparkles" style="color: #fbbf24; font-size: 1.2rem;"></i><span style="font-weight: 700; color: #fff; font-size: 1.1rem;">大香蕉生图模块</span></div>
    </div>
    <div style="font-size: 0.8rem; color: #a78bfa; margin-bottom: 15px; padding: 10px; background: rgba(139,92,246,0.1); border-radius: 6px;">通过反代 API 生成背景图片，生成后自动保存到背景库。</div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">反代 API 地址</label><input type="text" id="gal-banana-proxy-url" placeholder="http://localhost:8045" value="${escapeHtml(settings.bananaImageGen?.proxyUrl || '')}" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #6b21a8; font-family: monospace;"></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">反代 API Key</label><div style="display:flex; gap:8px; align-items:center;"><input type="password" id="gal-banana-proxy-key" placeholder="sk-xxx" value="${escapeHtml(settings.bananaImageGen?.proxyApiKey || '')}" style="flex:1; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #6b21a8; font-family: monospace;"><button type="button" class="gal-key-toggle" data-target="gal-banana-proxy-key" style="width:36px; height:36px; border-radius:6px; background:#1a1a2e; border:1px solid #6b21a8; color:#8892b0; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0;" title="显示/隐藏"><i class="fa-solid fa-eye"></i></button></div></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">图片生成模型</label><div style="display: flex; gap: 8px;"><select id="gal-banana-model" style="flex: 1; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #6b21a8;">${settings.bananaImageGen?.model ? `<option value="${escapeHtml(settings.bananaImageGen.model)}" selected>${escapeHtml(settings.bananaImageGen.model)}</option>` : '<option value="">点击刷新获取模型列表</option>'}</select><button id="gal-banana-refresh-models" style="padding: 8px 12px; border-radius: 6px; background: linear-gradient(135deg, #8b5cf6 0%, #6b21a8 100%); color: #fff; border: none; cursor: pointer;" title="刷新模型列表"><i class="fa-solid fa-sync"></i></button></div></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">生图COT自定义</label><textarea id="gal-banana-cot" placeholder="可填写额外规则" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #6b21a8; min-height: 80px; resize: vertical;">${escapeHtml(settings.bananaImageGen?.cotTemplate || '')}</textarea></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">默认提示词前缀</label><input type="text" id="gal-banana-prompt-prefix" placeholder="masterpiece, best quality, highres, " value="${escapeHtml(settings.bananaImageGen?.defaultPromptPrefix || 'masterpiece, best quality, highres, ')}" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #6b21a8;"></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">默认提示词后缀</label><input type="text" id="gal-banana-prompt-suffix" placeholder=", no humans, scenery, background" value="${escapeHtml(settings.bananaImageGen?.defaultPromptSuffix || '')}" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #6b21a8;"></div>
    <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;"><div><label style="color: #ccd6f6; font-size: 0.9rem;">CG模式</label><div style="font-size: 0.75rem; color: #8892b0;">开启：生成包含人物的剧情CG | 关闭：生成纯场景背景</div></div><label class="gal-realtime-switch"><input type="checkbox" id="gal-banana-cgmode" ${settings.bananaImageGen?.cgMode ? 'checked' : ''}><span class="gal-realtime-slider"></span></label></div>
    <div id="gal-banana-size-section" style="margin-bottom: 12px; display: ${settings.bananaImageGen?.cgMode ? 'block' : 'none'};"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">生成图片比例</label><select id="gal-banana-image-size" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #6b21a8; cursor: pointer;"><option value="1:1" ${settings.bananaImageGen?.cgImageSize === '1:1' || !settings.bananaImageGen?.cgImageSize ? 'selected' : ''}>1:1 (正方形)</option><option value="16:9" ${settings.bananaImageGen?.cgImageSize === '16:9' ? 'selected' : ''}>16:9 (横屏)</option><option value="9:16" ${settings.bananaImageGen?.cgImageSize === '9:16' ? 'selected' : ''}>9:16 (竖屏)</option><option value="4:3" ${settings.bananaImageGen?.cgImageSize === '4:3' ? 'selected' : ''}>4:3 (横屏)</option><option value="3:4" ${settings.bananaImageGen?.cgImageSize === '3:4' ? 'selected' : ''}>3:4 (竖屏)</option><option value="21:9" ${settings.bananaImageGen?.cgImageSize === '21:9' ? 'selected' : ''}>21:9 (宽银幕)</option><option value="3:2" ${settings.bananaImageGen?.cgImageSize === '3:2' ? 'selected' : ''}>3:2 (横屏)</option><option value="2:3" ${settings.bananaImageGen?.cgImageSize === '2:3' ? 'selected' : ''}>2:3 (竖屏)</option></select><div style="font-size: 0.75rem; color: #8892b0; margin-top: 4px;">选择生成CG图片的比例</div></div>
    <div id="gal-banana-appearance-section" style="margin-bottom: 12px; display: ${settings.bananaImageGen?.cgMode ? 'block' : 'none'};"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;"><label style="color: #ccd6f6; font-size: 0.9rem;">指定人物外观（最多3个）</label><button id="gal-banana-appearance-add" style="padding: 6px 10px; border-radius: 6px; background: linear-gradient(135deg, #8b5cf6 0%, #6b21a8 100%); color: #fff; border: none; cursor: pointer; font-size: 0.8rem;"><i class="fa-solid fa-plus"></i> 添加角色</button></div><div id="gal-banana-appearance-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px;"></div><div id="gal-banana-appearance-empty" style="font-size: 0.75rem; color: #8892b0;">暂无已指定角色</div></div>
    <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;"><div><label style="color: #ccd6f6; font-size: 0.9rem;">自动保存到背景库</label><div style="font-size: 0.75rem; color: #8892b0;">生成成功后自动添加到背景资源库</div></div><label class="gal-realtime-switch"><input type="checkbox" id="gal-banana-autosave" ${settings.bananaImageGen?.autoSaveToLibrary !== false ? 'checked' : ''}><span class="gal-realtime-slider"></span></label></div>
    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(139,92,246,0.3);"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">手动生成背景</label><div style="display: flex; gap: 8px; margin-bottom: 8px;"><input type="text" id="gal-banana-scene-name" placeholder="场景名称（如：教室、森林）" style="flex: 1; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #6b21a8;"></div><div style="display: flex; gap: 8px; margin-bottom: 8px;"><textarea id="gal-banana-custom-prompt" placeholder="自定义提示词（可选）" style="flex: 1; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #6b21a8; min-height: 60px; resize: vertical;"></textarea></div><button id="gal-banana-generate-btn" style="width: 100%; padding: 10px; border-radius: 6px; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #1a1a2e; border: none; cursor: pointer; font-weight: 700; font-size: 0.95rem;"><i class="fa-solid fa-wand-magic-sparkles"></i> 生成背景图片</button><div id="gal-banana-preview" style="margin-top: 10px; display: none;"><div style="font-size: 0.8rem; color: #a78bfa; margin-bottom: 5px;">生成预览：</div><img id="gal-banana-preview-img" style="max-width: 100%; border-radius: 6px; border: 1px solid #6b21a8;"><button id="gal-banana-save-to-library" style="width: 100%; margin-top: 8px; padding: 8px; border-radius: 6px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; border: none; cursor: pointer; font-weight: 600; font-size: 0.9rem;"><i class="fa-solid fa-save"></i> 保存到背景库</button></div></div>
  </div>`;
}

function buildNovelAIPane(settings) {
  const ns = settings.novelai || {};
  return `
  <div style="padding: 15px; background: linear-gradient(135deg, #1a2e1a 0%, #1a1a2e 100%); border-radius: 10px; border: 1px solid #2d6a4f; margin-top: 8px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <div style="display: flex; align-items: center; gap: 10px;"><i class="fa-solid fa-palette" style="color: #52b788; font-size: 1.2rem;"></i><span style="font-weight: 700; color: #fff; font-size: 1.1rem;">NovelAI 生图</span></div>
    </div>
    <div style="font-size: 0.8rem; color: #95d5b2; margin-bottom: 15px; padding: 10px; background: rgba(82,183,136,0.1); border-radius: 6px;">使用 NovelAI 官方 API 生成背景图片，需要有效的订阅和 API Key。</div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">API Key</label><div style="display:flex; gap:8px; align-items:center;"><input type="password" id="gal-novelai-apikey" placeholder="pst-xxx" value="${escapeHtml(ns.apiKey || '')}" style="flex:1; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #2d6a4f; font-family: monospace;"><button type="button" class="gal-key-toggle" data-target="gal-novelai-apikey" style="width:36px; height:36px; border-radius:6px; background:#1a1a2e; border:1px solid #2d6a4f; color:#8892b0; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0;" title="显示/隐藏"><i class="fa-solid fa-eye"></i></button></div></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">模型</label><select id="gal-novelai-model" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #2d6a4f;"><option value="nai-diffusion-4-5-curated" ${(ns.model || 'nai-diffusion-4-5-curated') === 'nai-diffusion-4-5-curated' ? 'selected' : ''}>NAI Diffusion 4.5 Curated</option><option value="nai-diffusion-4-5-full" ${ns.model === 'nai-diffusion-4-5-full' ? 'selected' : ''}>NAI Diffusion 4.5 Full</option></select></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">图片尺寸</label><select id="gal-novelai-size" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #2d6a4f;"><option value="1216x832" ${(ns.width === 1216 && ns.height === 832) || (!ns.width && !ns.height) ? 'selected' : ''}>1216 x 832 (横屏 3:2)</option><option value="832x1216" ${ns.width === 832 && ns.height === 1216 ? 'selected' : ''}>832 x 1216 (竖屏 2:3)</option><option value="1024x1024" ${ns.width === 1024 && ns.height === 1024 ? 'selected' : ''}>1024 x 1024 (正方形)</option><option value="1472x704" ${ns.width === 1472 && ns.height === 704 ? 'selected' : ''}>1472 x 704 (宽银幕)</option><option value="704x1472" ${ns.width === 704 && ns.height === 1472 ? 'selected' : ''}>704 x 1472 (超竖屏)</option></select></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">Steps: <span id="gal-novelai-steps-value" style="color: #52b788;">${escapeHtml(ns.steps || 28)}</span></label><input type="range" id="gal-novelai-steps" min="10" max="50" step="1" value="${escapeHtml(ns.steps || 28)}" style="width: 100%; accent-color: #52b788;"></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">Guidance Scale: <span id="gal-novelai-scale-value" style="color: #52b788;">${escapeHtml(ns.scale ?? 10)}</span></label><input type="range" id="gal-novelai-scale" min="1" max="30" step="0.5" value="${escapeHtml(ns.scale ?? 10)}" style="width: 100%; accent-color: #52b788;"></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">Sampler</label><select id="gal-novelai-sampler" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #2d6a4f;"><option value="k_euler" ${(ns.sampler || 'k_euler') === 'k_euler' ? 'selected' : ''}>Euler</option><option value="k_euler_ancestral" ${ns.sampler === 'k_euler_ancestral' ? 'selected' : ''}>Euler Ancestral</option><option value="k_dpmpp_2s_ancestral" ${ns.sampler === 'k_dpmpp_2s_ancestral' ? 'selected' : ''}>DPM++ 2S Ancestral</option><option value="k_dpmpp_2m_sde" ${ns.sampler === 'k_dpmpp_2m_sde' ? 'selected' : ''}>DPM++ 2M SDE</option><option value="k_dpmpp_sde" ${ns.sampler === 'k_dpmpp_sde' ? 'selected' : ''}>DPM++ SDE</option></select></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">默认提示词前缀</label><input type="text" id="gal-novelai-prompt-prefix" placeholder="masterpiece, best quality, ..." value="${escapeHtml(ns.defaultPromptPrefix || 'masterpiece, best quality, no humans, scenery, background, ')}" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #2d6a4f;"></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">默认提示词后缀</label><input type="text" id="gal-novelai-prompt-suffix" placeholder=", very aesthetic" value="${escapeHtml(ns.defaultPromptSuffix || ', very aesthetic')}" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #2d6a4f;"></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">负面提示词</label><textarea id="gal-novelai-negative" placeholder="nsfw, lowres, ..." style="width: 100%; height: 60px; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #2d6a4f; font-size: 0.85rem; resize: vertical;">${escapeHtml(ns.negativePrompt || 'nsfw, lowres, artistic error, worst quality, bad quality, jpeg artifacts, very displeasing, text, watermark')}</textarea></div>
    <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;"><div><label style="color: #ccd6f6; font-size: 0.9rem;">自动保存到背景库</label><div style="font-size: 0.75rem; color: #8892b0;">生成成功后自动添加到背景资源库</div></div><label class="gal-realtime-switch"><input type="checkbox" id="gal-novelai-autosave" ${ns.autoSaveToLibrary !== false ? 'checked' : ''}><span class="gal-realtime-slider"></span></label></div>
  </div>`;
}

function buildWallhavenPane(settings) {
  return `
  <div style="padding: 15px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 10px; border: 1px solid #0f3460; margin-top: 8px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <div style="display: flex; align-items: center; gap: 10px;"><i class="fa-solid fa-images" style="color: #00d9ff; font-size: 1.2rem;"></i><span style="font-weight: 700; color: #fff; font-size: 1.1rem;">Wallhaven 壁纸搜索</span></div>
    </div>
    <div style="font-size: 0.8rem; color: #8892b0; margin-bottom: 15px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 6px;">仅供学习研究使用。所有图片版权归原作者及 Wallhaven 所有。</div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">图片分类</label><select id="gal-wallhaven-category" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #0f3460;"><option value="anime" ${settings.wallhaven?.category === 'anime' ? 'selected' : ''}>动漫漫画</option><option value="all" ${settings.wallhaven?.category === 'all' ? 'selected' : ''}>全部类型</option><option value="people" ${settings.wallhaven?.category === 'people' ? 'selected' : ''}>人物写真</option><option value="general" ${settings.wallhaven?.category === 'general' ? 'selected' : ''}>综合壁纸</option></select></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">安全级别</label><select id="gal-wallhaven-purity" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #0f3460;"><option value="sfw" ${settings.wallhaven?.purity === 'sfw' ? 'selected' : ''}>SFW (安全)</option><option value="sketchy" ${settings.wallhaven?.purity === 'sketchy' ? 'selected' : ''}>Sketchy (略敏感)</option></select></div>
    <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;"><div><label style="color: #ccd6f6; font-size: 0.9rem;">CG模式</label><div style="font-size: 0.75rem; color: #8892b0;">开启：允许人物关键词 | 关闭：只搜环境背景</div></div><label class="gal-realtime-switch"><input type="checkbox" id="gal-wallhaven-cgmode" ${settings.wallhaven?.cgMode ? 'checked' : ''}><span class="gal-realtime-slider"></span></label></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">自定义标签</label><input type="text" id="gal-wallhaven-customtags" placeholder="例如: cosplay, landscape, 4k" value="${escapeHtml((settings.wallhaven?.customTags || []).join(', '))}" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #0f3460;"><div style="font-size: 0.75rem; color: #8892b0; margin-top: 4px;">多个标签用逗号分隔</div></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">排序方式</label><select id="gal-wallhaven-sorting" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #0f3460;"><option value="favorites" ${settings.wallhaven?.sorting === 'favorites' || !settings.wallhaven?.sorting ? 'selected' : ''}>收藏量</option><option value="relevance" ${settings.wallhaven?.sorting === 'relevance' ? 'selected' : ''}>相关度</option><option value="views" ${settings.wallhaven?.sorting === 'views' ? 'selected' : ''}>浏览量</option><option value="date_added" ${settings.wallhaven?.sorting === 'date_added' ? 'selected' : ''}>最新上传</option><option value="toplist" ${settings.wallhaven?.sorting === 'toplist' ? 'selected' : ''}>排行榜</option><option value="random" ${settings.wallhaven?.sorting === 'random' ? 'selected' : ''}>随机</option></select></div>
    <div style="margin-bottom: 12px; ${settings.wallhaven?.sorting === 'toplist' ? '' : 'display: none;'}" id="gal-wallhaven-toprange-container"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">排行榜时间范围</label><select id="gal-wallhaven-toprange" style="width: 100%; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #0f3460;"><option value="1d" ${settings.wallhaven?.topRange === '1d' ? 'selected' : ''}>1天</option><option value="3d" ${settings.wallhaven?.topRange === '3d' ? 'selected' : ''}>3天</option><option value="1w" ${settings.wallhaven?.topRange === '1w' ? 'selected' : ''}>1周</option><option value="1M" ${settings.wallhaven?.topRange === '1M' || !settings.wallhaven?.topRange ? 'selected' : ''}>1个月</option><option value="3M" ${settings.wallhaven?.topRange === '3M' ? 'selected' : ''}>3个月</option><option value="6M" ${settings.wallhaven?.topRange === '6M' ? 'selected' : ''}>6个月</option><option value="1y" ${settings.wallhaven?.topRange === '1y' ? 'selected' : ''}>1年</option></select></div>
    <div style="margin-bottom: 12px;"><label style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 6px; display: block;">API Key（可选）</label><div style="display:flex; gap:8px; align-items:center;"><input type="password" id="gal-wallhaven-apikey" placeholder="留空使用公开 API" value="${escapeHtml(settings.wallhaven?.apiKey || '')}" style="flex:1; padding: 8px; border-radius: 6px; background: #1a1a2e; color: #fff; border: 1px solid #0f3460;"><button type="button" class="gal-key-toggle" data-target="gal-wallhaven-apikey" style="width:36px; height:36px; border-radius:6px; background:#1a1a2e; border:1px solid #0f3460; color:#8892b0; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0;" title="显示/隐藏"><i class="fa-solid fa-eye"></i></button></div></div>
  </div>`;
}

// ============================================
// 事件绑定工具
// ============================================

/**
 * 创建一个设置字段更新器。自动确保子设置对象存在，设值后调用 saveSettings。
 * 用法: const update = makeSettingsUpdater(settings, 'novelai');
 *       update('apiKey', value);
 */
function makeSettingsUpdater(settings, subKey) {
  return function update(field, value) {
    if (!settings[subKey]) settings[subKey] = {};
    settings[subKey][field] = value;
    saveSettings();
  };
}

// ============================================
// 事件绑定
// ============================================

export function bindImageGenConfigEvents($container, settings) {
  // Pill 切换（仅切换查看哪个引擎的配置）
  $container.find('.gal-pill').on('click', function () {
    const engine = $(this).data('engine');
    $container.find('.gal-pill').removeClass('active');
    $(this).addClass('active');
    $container.find('[data-engine-pane]').hide();
    $container.find(`[data-engine-pane="${engine}"]`).show();
  });

  // 背景图来源 radio 切换
  $container.find('input[name="gal-bg-source"]').on('change', async function () {
    const value = $(this).val();
    settings.bgImageSource = value;
    // 同步旧字段以兼容
    settings.realTimeBackgroundGen = (value === 'comfyui');
    if (settings.bananaImageGen) settings.bananaImageGen.enabled = (value === 'banana');
    if (settings.novelai) settings.novelai.enabled = (value === 'novelai');
    if (settings.wallhaven) settings.wallhaven.enabled = (value === 'wallhaven');
    saveSettings();
    if (getIsEnabled()) await injectCOTToWorldbook();
    // 高亮选中 radio 的 label
    $container.find('.gal-radio-label').css('color', BG_SOURCE_INACTIVE_COLOR);
    $(this).closest('.gal-radio-label').css('color', '');
    $(this).closest('.gal-radio-label').css('color', BG_SOURCE_COLORS[value] || BG_SOURCE_INACTIVE_COLOR);
    // 自动切到对应 pill（关闭则不切）
    if (value !== 'none') {
      $container.find(`.gal-pill[data-engine="${value}"]`).trigger('click');
    }
    const names = { none: '关闭', comfyui: 'ComfyUI', banana: '大香蕉', novelai: 'NovelAI', wallhaven: 'Wallhaven' };
    showToast(`背景图来源: ${names[value] || value}`);
  });

  // API Key 显示/隐藏 toggle（统一处理所有 .gal-key-toggle 按钮）
  $container.find('.gal-key-toggle').on('click', function () {
    const targetId = $(this).data('target');
    const input = $container.find('#' + targetId)[0];
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    $(this).find('i').toggleClass('fa-eye fa-eye-slash');
  });

  bindComfyUIConfigEvents($container, settings);
  bindBananaConfigEvents($container, settings);
  bindNovelAIConfigEvents($container, settings);
  bindWallhavenConfigEvents($container, settings);
}

// --- ComfyUI ---

function bindComfyUIConfigEvents($container, settings) {
  $container.find('#gal-comfyui-url').on('change', function () {
    const cs = getComfyUISettings();
    cs.apiUrl = $(this).val().trim();
    saveComfyUISettings(cs);
  });

  $container.find('#gal-comfyui-negative').on('change', function () {
    const cs = getComfyUISettings();
    cs.negativePrompt = $(this).val();
    saveComfyUISettings(cs);
  });

  $container.find('#gal-comfyui-test').on('click', async function () {
    $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 测试中...');
    const ok = await ComfyUIAPI.checkConnection();
    $(this).prop('disabled', false).html('<i class="fa-solid fa-plug"></i> 测试连接');
    showToast(ok ? 'ComfyUI 连接成功！' : 'ComfyUI 连接失败');
  });

  // 工作流管理
  function renderWorkflowList() {
    const workflows = getComfyWorkflows();
    const $list = $container.find('#gal-workflow-list');
    const $selChar = $container.find('#gal-comfy-def-char');
    const $selBg = $container.find('#gal-comfy-def-bg');
    const cs = getComfyUISettings();
    $list.empty();
    $selChar.html('<option value="default_char">内置 SDXL Turbo</option>');
    $selBg.html('<option value="default_bg">内置 SDXL Turbo</option>');
    const keys = Object.keys(workflows);
    if (keys.length === 0) {
      $list.html('<div style="text-align:center;color:#8892b0;font-size:0.85rem;padding:10px;">暂无导入的工作流</div>');
    } else {
      keys.forEach(id => {
        const wf = workflows[id];
        const $item = $(`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px;border-bottom:1px solid rgba(255,255,255,0.1);font-size:0.9rem;color:#ccd6f6;"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:250px;" title="${escapeHtml(wf.name)}">${escapeHtml(wf.name)}</span><i class="fa-solid fa-trash" style="color:#ff4d4d;cursor:pointer;padding:4px;" title="删除"></i></div>`);
        $item.find('.fa-trash').on('click', () => {
          if (confirm(`删除工作流 "${wf.name}"?`)) {
            delete workflows[id];
            saveComfyWorkflows(workflows);
            renderWorkflowList();
          }
        });
        $list.append($item);
        $selChar.append(`<option value="${escapeHtml(id)}">${escapeHtml(wf.name)}</option>`);
        $selBg.append(`<option value="${escapeHtml(id)}">${escapeHtml(wf.name)}</option>`);
      });
    }
    $selChar.val(cs.defaultCharWorkflow || 'default_char');
    $selBg.val(cs.defaultBgWorkflow || 'default_bg');
  }
  renderWorkflowList();

  async function loadCheckpointsToSelect() {
    const $sel = $container.find('#gal-comfy-def-checkpoint');
    const cs = getComfyUISettings();
    try {
      const models = await ComfyUIAPI.getModels(cs.apiUrl);
      $sel.empty().append('<option value="">-- 使用 Workflow默认 --</option>');
      models.forEach(m => $sel.append(`<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`));
      if (cs.defaultCheckpoint) $sel.val(cs.defaultCheckpoint);
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 加载模型失败:`, e);
      $sel.html('<option value="">(加载失败)</option>');
    }
  }
  // 仅在 ComfyUI 启用时自动加载模型列表
  if (settings.bgImageSource === 'comfyui') loadCheckpointsToSelect();

  $container.find('#gal-comfy-def-checkpoint').on('change', function () {
    const cs = getComfyUISettings();
    cs.defaultCheckpoint = $(this).val();
    saveComfyUISettings(cs);
  });

  $container.find('#gal-comfy-import-btn').on('click', () => $container.find('#gal-comfy-import-input').click());
  $container.find('#gal-comfy-import-input').on('change', function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const json = JSON.parse(e.target.result);
        const name = file.name.replace('.json', '');
        const id = 'wf_' + Date.now();
        const workflows = getComfyWorkflows();
        workflows[id] = { name, json };
        saveComfyWorkflows(workflows);
        renderWorkflowList();
        showToast(`已导入: ${name}`);
      } catch (err) {
        showToast('无效的 JSON 文件');
      }
      $(this).val('');
    };
    reader.readAsText(file);
  });

  $container.find('#gal-comfy-def-char').on('change', function () {
    const cs = getComfyUISettings();
    cs.defaultCharWorkflow = $(this).val();
    saveComfyUISettings(cs);
  });

  $container.find('#gal-comfy-def-bg').on('change', function () {
    const cs = getComfyUISettings();
    cs.defaultBgWorkflow = $(this).val();
    saveComfyUISettings(cs);
  });
}

// --- 大香蕉 ---

function bindBananaConfigEvents($container, settings) {
  const update = makeSettingsUpdater(settings, 'bananaImageGen');

  $container.find('#gal-banana-proxy-url').on('change', function () {
    update('proxyUrl', $(this).val().trim());
  });
  $container.find('#gal-banana-proxy-key').on('change', function () {
    update('proxyApiKey', $(this).val().trim());
  });
  $container.find('#gal-banana-model').on('change', function () {
    update('model', $(this).val());
  });
  $container.find('#gal-banana-cot').on('change', async function () {
    update('cotTemplate', $(this).val());
    if (getIsEnabled()) await injectCOTToWorldbook();
  });
  $container.find('#gal-banana-prompt-prefix').on('change', function () {
    update('defaultPromptPrefix', $(this).val());
  });
  $container.find('#gal-banana-prompt-suffix').on('change', function () {
    update('defaultPromptSuffix', $(this).val());
  });
  $container.find('#gal-banana-cgmode').on('change', async function () {
    const checked = $(this).is(':checked');
    update('cgMode', checked);
    $container.find('#gal-banana-appearance-section').toggle(checked);
    $container.find('#gal-banana-size-section').toggle(checked);
    if (getIsEnabled()) await injectCOTToWorldbook();
  });
  $container.find('#gal-banana-image-size').on('change', function () {
    update('cgImageSize', $(this).val());
  });
  $container.find('#gal-banana-autosave').on('change', function () {
    update('autoSaveToLibrary', $(this).is(':checked'));
  });

  // CG 角色外观
  renderBananaAppearanceList($container);
  $container.find('#gal-banana-appearance-add').on('click', function () {
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
      renderBananaAppearanceList($container);
      if (getIsEnabled()) await injectCOTToWorldbook();
    });
  });
  $container.on('click', '.gal-banana-appearance-remove', async function () {
    const charId = $(this).attr('data-char');
    const list = getBananaCharacterAppearances().filter(a => (a.characterName || a.characterId) !== charId);
    setBananaCharacterAppearances(list);
    renderBananaAppearanceList($container);
    if (getIsEnabled()) await injectCOTToWorldbook();
  });

  // 刷新模型列表
  $container.find('#gal-banana-refresh-models').on('click', async function () {
    const $btn = $(this);
    const $select = $container.find('#gal-banana-model');
    const proxyUrl = $container.find('#gal-banana-proxy-url').val().trim();
    const proxyKey = $container.find('#gal-banana-proxy-key').val().trim();
    if (!proxyUrl) { showToast('请先填写反代 API 地址'); return; }
    $btn.prop('disabled', true).find('i').addClass('fa-spin');
    try {
      let baseUrl = proxyUrl.replace(/\/+$/, '');
      if (!baseUrl.endsWith('/v1')) baseUrl = baseUrl + '/v1';
      const response = await fetch(`${baseUrl}/models`, { method: 'GET', headers: { 'Authorization': `Bearer ${proxyKey}`, 'Content-Type': 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const models = data.data || [];
      $select.html(models.map(m => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.id)}</option>`).join(''));
      if (models.length > 0) showToast(`获取到 ${models.length} 个模型`);
      else { $select.html('<option value="">未找到可用模型</option>'); showToast('未找到可用模型'); }
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 获取大香蕉模型列表失败:`, e);
      showToast(`获取模型列表失败: ${e.message}`);
    } finally { $btn.prop('disabled', false).find('i').removeClass('fa-spin'); }
  });

  // 生成背景图片
  $container.find('#gal-banana-generate-btn').on('click', async function () {
    const $btn = $(this);
    const sceneName = $container.find('#gal-banana-scene-name').val().trim();
    const customPrompt = $container.find('#gal-banana-custom-prompt').val().trim();
    const proxyUrl = $container.find('#gal-banana-proxy-url').val().trim();
    const proxyKey = $container.find('#gal-banana-proxy-key').val().trim();
    const model = $container.find('#gal-banana-model').val();
    const promptPrefix = $container.find('#gal-banana-prompt-prefix').val();
    const promptSuffix = $container.find('#gal-banana-prompt-suffix').val();
    const cgMode = $container.find('#gal-banana-cgmode').is(':checked');
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
      $container.find('#gal-banana-preview').show();
      $container.find('#gal-banana-preview-img').attr('src', imageUrl);
      $container.find('#gal-banana-save-to-library').data('imageUrl', imageUrl).data('sceneName', sceneName);
      showToast('背景图片生成成功');
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 大香蕉生图失败:`, e);
      showToast(`生成失败: ${e.message}`);
    } finally { $btn.prop('disabled', false).html('<i class="fa-solid fa-wand-magic-sparkles"></i> 生成背景图片'); }
  });

  // 保存到背景库
  $container.find('#gal-banana-save-to-library').on('click', async function () {
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

// --- NovelAI ---

function bindNovelAIConfigEvents($container, settings) {
  const update = makeSettingsUpdater(settings, 'novelai');

  $container.find('#gal-novelai-apikey').on('input change', function () {
    update('apiKey', $(this).val().trim());
  });
  $container.find('#gal-novelai-model').on('change', function () {
    update('model', $(this).val());
  });
  $container.find('#gal-novelai-size').on('change', function () {
    if (!settings.novelai) settings.novelai = {};
    const [w, h] = $(this).val().split('x').map(Number);
    settings.novelai.width = w;
    settings.novelai.height = h;
    saveSettings();
  });
  $container.find('#gal-novelai-steps').on('input', function () {
    const val = parseInt($(this).val());
    update('steps', val);
    $container.find('#gal-novelai-steps-value').text(val);
  });
  $container.find('#gal-novelai-scale').on('input', function () {
    const val = parseFloat($(this).val());
    update('scale', val);
    $container.find('#gal-novelai-scale-value').text(val);
  });
  $container.find('#gal-novelai-sampler').on('change', function () {
    update('sampler', $(this).val());
  });
  $container.find('#gal-novelai-prompt-prefix').on('change', function () {
    update('defaultPromptPrefix', $(this).val());
  });
  $container.find('#gal-novelai-prompt-suffix').on('change', function () {
    update('defaultPromptSuffix', $(this).val());
  });
  $container.find('#gal-novelai-negative').on('change', function () {
    update('negativePrompt', $(this).val());
  });
  $container.find('#gal-novelai-autosave').on('change', function () {
    update('autoSaveToLibrary', $(this).is(':checked'));
  });
}

// --- Wallhaven ---

function bindWallhavenConfigEvents($container, settings) {
  const update = makeSettingsUpdater(settings, 'wallhaven');

  $container.find('#gal-wallhaven-category').on('change', async function () {
    update('category', $(this).val());
    if (getIsEnabled()) await injectCOTToWorldbook();
  });
  $container.find('#gal-wallhaven-purity').on('change', function () {
    update('purity', $(this).val());
  });
  $container.find('#gal-wallhaven-cgmode').on('change', async function () {
    update('cgMode', $(this).is(':checked'));
    if (getIsEnabled()) await injectCOTToWorldbook();
  });
  $container.find('#gal-wallhaven-customtags').on('change', function () {
    const tags = $(this).val();
    update('customTags', tags ? tags.split(',').map(t => t.trim()).filter(t => t) : []);
  });
  $container.find('#gal-wallhaven-apikey').on('change', function () {
    update('apiKey', $(this).val());
  });
  $container.find('#gal-wallhaven-sorting').on('change', function () {
    update('sorting', $(this).val());
    $container.find('#gal-wallhaven-toprange-container').toggle($(this).val() === 'toplist');
    showToast(`排序方式已设置为: ${$(this).find('option:selected').text()}`);
  });
  $container.find('#gal-wallhaven-toprange').on('change', function () {
    update('topRange', $(this).val());
    showToast(`排行榜时间范围已设置为: ${$(this).find('option:selected').text()}`);
  });
}
