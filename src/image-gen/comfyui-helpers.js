import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow, $ } from '../core/env.js';
import { GalgameStore } from '../core/store.js';
import { getSettings, saveSettings, DEFAULT_COMFYUI_SETTINGS } from '../core/settings.js';
import { getCharacterListFromDatabase } from '../utils/chat.js';

// 延迟引用: getSprite (来自 db/sprites.js，避免循环)
let _getSpriteRef = null;
export function setComfyUIHelperRefs({ getSprite }) {
  _getSpriteRef = getSprite;
}

const CHAR_APPEARANCE_PROMPTS_KEY = GalgameStore.STORAGE_KEYS.CHAR_APPEARANCE;
const COMFY_WORKFLOWS_KEY = GalgameStore.STORAGE_KEYS.COMFY_WORKFLOWS;

// ============================================
// ComfyUI 状态与辅助函数
// ============================================

export function getCharAppearancePrompts() {
  try {
    const saved = topWindow.localStorage.getItem(CHAR_APPEARANCE_PROMPTS_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 加载角色外貌提示词失败:`, e);
  }
  return {};
}

export function saveCharAppearancePrompts(prompts) {
  try {
    topWindow.localStorage.setItem(CHAR_APPEARANCE_PROMPTS_KEY, JSON.stringify(prompts));
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 保存角色外貌提示词失败:`, e);
  }
}

export function getCharAppearancePrompt(characterId) {
  if (characterId === 'current_char') {
    const list = getCharacterListFromDatabase();
    const current = list.find(c => c.id === 'current_char');
    if (current) characterId = current.name;
  }
  const prompts = getCharAppearancePrompts();
  return prompts[characterId] || '';
}

export function setCharAppearancePrompt(characterId, promptText) {
  const prompts = getCharAppearancePrompts();
  prompts[characterId] = promptText;
  saveCharAppearancePrompts(prompts);
}

export function getBananaCharacterAppearances() {
  const settings = getSettings();
  const list = settings.bananaImageGen?.characterAppearances;
  return Array.isArray(list) ? list : [];
}

export function setBananaCharacterAppearances(list) {
  const settings = getSettings();
  if (!settings.bananaImageGen) settings.bananaImageGen = {};
  settings.bananaImageGen.characterAppearances = Array.isArray(list) ? list : [];
  saveSettings();
}

export function buildBananaAppearancePromptText() {
  const list = getBananaCharacterAppearances().filter(a => a && (a.characterName || a.characterId));
  if (list.length === 0) return '';
  const lines = list.slice(0, 3).map(a => {
    const name = a.characterName || a.characterId || '角色';
    const expr = a.expression || '默认';
    return `- ${name}（表情：${expr}）`;
  });
  return `\n角色外观参考（必须遵守）：\n${lines.join('\n')}`;
}

export async function getSpriteAsBase64(characterId, expression) {
  console.log(`[${SCRIPT_NAME}] getSpriteAsBase64: 开始获取 ${characterId}_${expression}`);
  try {
    if (!_getSpriteRef) return null;
    const spriteUrl = await _getSpriteRef(characterId, expression);
    console.log(`[${SCRIPT_NAME}] getSpriteAsBase64: getSprite返回 = ${spriteUrl ? spriteUrl.substring(0, 50) + '...' : 'null'}`);
    if (!spriteUrl) {
      console.log(`[${SCRIPT_NAME}] getSpriteAsBase64: 未找到立绘 ${characterId}_${expression}`);
      return null;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise((resolve, reject) => {
      img.onload = () => resolve(true);
      img.onerror = reject;
      img.src = spriteUrl;
    });

    const maxSize = 512;
    let width = img.width;
    let height = img.height;

    if (width > maxSize || height > maxSize) {
      if (width > height) {
        height = Math.round(height * maxSize / width);
        width = maxSize;
      } else {
        width = Math.round(width * maxSize / height);
        height = maxSize;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
    console.log(`[${SCRIPT_NAME}] getSpriteAsBase64: 压缩完成，原尺寸 ${img.width}x${img.height} -> ${width}x${height}，base64长度: ${compressedBase64.length}`);

    return compressedBase64;
  } catch (error) {
    console.error(`[${SCRIPT_NAME}] getSpriteAsBase64 错误:`, error);
    return null;
  }
}

export async function buildBananaAppearanceMultimodalContent(textPrompt) {
  const list = getBananaCharacterAppearances().filter(a => a && (a.characterName || a.characterId));
  console.log(`[${SCRIPT_NAME}] buildBananaAppearanceMultimodalContent: 角色列表 =`, JSON.stringify(list));
  if (list.length === 0) {
    console.log(`[${SCRIPT_NAME}] buildBananaAppearanceMultimodalContent: 无角色配置，返回纯文本`);
    return textPrompt;
  }

  const contentParts = [{ type: 'text', text: textPrompt }];

  for (const appearance of list.slice(0, 3)) {
    const name = appearance.characterName || appearance.characterId;
    const expr = appearance.expression || '默认';
    console.log(`[${SCRIPT_NAME}] buildBananaAppearanceMultimodalContent: 处理角色 ${name}（${expr}）`);

    const imageBase64 = await getSpriteAsBase64(name, expr);

    if (imageBase64) {
      contentParts.push({
        type: 'image_url',
        image_url: { url: imageBase64 }
      });
      console.log(`[${SCRIPT_NAME}] 已添加角色立绘到多模态消息: ${name}（${expr}），base64长度: ${imageBase64.length}`);
    } else {
      console.warn(`[${SCRIPT_NAME}] 无法获取角色立绘: ${name}（${expr}）`);
    }
  }

  console.log(`[${SCRIPT_NAME}] buildBananaAppearanceMultimodalContent: 最终contentParts数量 = ${contentParts.length}`);
  return contentParts.length > 1 ? contentParts : textPrompt;
}

export function renderBananaAppearanceList($modal) {
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

export async function refreshBananaAppearancePreviews($modal) {
  if (!_getSpriteRef) return;
  const $cards = $modal.find('.gal-banana-appearance-card');
  if (!$cards.length) return;
  for (const card of $cards) {
    const $card = $(card);
    const charId = $card.attr('data-char');
    const expr = $card.attr('data-expr') || '默认';
    const url = await _getSpriteRef(charId, expr);
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

export function getComfyUISettings() {
  const settings = getSettings();
  if (!settings.comfyui) {
    settings.comfyui = Object.assign({}, DEFAULT_COMFYUI_SETTINGS);
  }
  return settings.comfyui;
}

export function saveComfyUISettings(newSettings) {
  const settings = getSettings();
  settings.comfyui = newSettings;
  saveSettings();
}

export function getComfyWorkflows() {
  try {
    const saved = topWindow.localStorage.getItem(COMFY_WORKFLOWS_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 加载工作流失败:`, e);
  }
  return {};
}

export function saveComfyWorkflows(workflows) {
  try {
    topWindow.localStorage.setItem(COMFY_WORKFLOWS_KEY, JSON.stringify(workflows));
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 保存工作流失败:`, e);
  }
}
