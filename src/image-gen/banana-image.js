import { SCRIPT_NAME } from '../core/constants.js';
import { $ } from '../core/env.js';
import { getSettings } from '../core/settings.js';
import { GalgameStore } from '../core/store.js';
import { saveBackground, saveBackgroundsBatch, getAllBackgrounds } from '../db/backgrounds.js';
import { clearBackgroundLayers } from '../db/image-packs.js';
import { getComfyWorkflows, getBananaCharacterAppearances, buildBananaAppearanceMultimodalContent } from './comfyui-helpers.js';
import { ComfyUIAPI } from './comfyui-api.js';
import { BGMManager } from '../audio/bgm-manager.js';
import { SpriteManager } from '../sprite/sprite-manager.js';
import { injectCOTToWorldbook } from '../logic/worldbook.js';
import { getIsEnabled } from '../core/state.js';

// ============================================
// 大香蕉 AI 生图 + ComfyUI 实时背景生成
// ============================================

const messageSegmentState = GalgameStore.cache.segments;
const sceneBackgrounds = GalgameStore.cache.backgrounds;

// 延迟引用
let _updateGlobalOverlayContentRef = null;
let _showToastRef = null;

export function setBananaImageRefs({ updateGlobalOverlayContent, showToast }) {
  if (updateGlobalOverlayContent) _updateGlobalOverlayContentRef = updateGlobalOverlayContent;
  if (showToast) _showToastRef = showToast;
}

function showToast(msg) {
  if (_showToastRef) _showToastRef(msg);
}

// ============================================
// ComfyUI 实时背景生成
// ============================================

export async function handleRealTimeBackgroundGeneration(sceneName, tags) {
  const settings = getSettings();
  if (!settings.realTimeBackgroundGen) return;
  if (BGMManager.generatingScenes.has(sceneName)) return;

  try {
    const backgrounds = await getAllBackgrounds();
    if (backgrounds.some(bg => bg.sceneName === sceneName)) {
      return;
    }
  } catch (e) {
    console.error(`[${SCRIPT_NAME}] 检查背景存在失败:`, e);
  }

  console.log(`[${SCRIPT_NAME}] 触发实时背景生成: ${sceneName}, Tags: ${tags}`);
  BGMManager.generatingScenes.add(sceneName);
  showToast(`正在生成新场景: ${sceneName}...`);

  const $bgLayer = $('#gal-global-overlay .gal-layer-bg');
  if ($bgLayer.length) {
    $bgLayer.addClass('generating-bg').removeClass('has-bg');
    clearBackgroundLayers($bgLayer);
  }

  (async () => {
    try {
      const workflowId = settings.comfyui.defaultBgWorkflow;
      const allWorkflows = getComfyWorkflows();
      let targetWorkflow = null;

      if (workflowId && allWorkflows[workflowId]) {
        targetWorkflow = allWorkflows[workflowId];
      } else if (workflowId) {
        targetWorkflow = Object.values(allWorkflows).find(w => w.name === workflowId);
      } else {
        targetWorkflow = Object.values(allWorkflows).find(w => w.name === 'default_bg');
      }

      if (!targetWorkflow || !targetWorkflow.json) {
        throw new Error(`未找到默认背景生成工作流: ${workflowId || 'default_bg'}。请在设置-ComfyUI中配置。`);
      }

      const positive = `${tags}, (high quality, masterpiece, best quality, 4k, 8k:1.2), no humans`;
      const negative = settings.comfyui.negativePrompt || 'nsfw, lowres, bad anatomy, bad hands, text, error';
      const seed = Math.floor(Math.random() * 10000000000);

      const blob = await ComfyUIAPI.generate(targetWorkflow.json, positive, negative, seed);

      if (blob) {
        await saveBackgroundsBatch([{ sceneName: sceneName, imageBlob: blob }]);

        const newUrl = URL.createObjectURL(blob);
        console.log(`[${SCRIPT_NAME}] [DEBUG] 实时生成后手动更新缓存: "${sceneName}" URL: ${newUrl.substring(0, 50)}...`);
        sceneBackgrounds.set(sceneName, newUrl);
        console.log(`[${SCRIPT_NAME}] [DEBUG] Cache check after set: has("${sceneName}") = ${sceneBackgrounds.has(sceneName)}`);

        console.log(`[${SCRIPT_NAME}] 场景生成并保存成功: ${sceneName}`);
        showToast(`场景「${sceneName}」生成完成！`);

        const $bgLayer = $('#gal-global-overlay .gal-layer-bg');
        $bgLayer.find('.gal-gen-indicator').remove();

        if (getIsEnabled()) {
          injectCOTToWorldbook();
        }

        const $lastMes = $('#chat > .mes').last();
        console.log(`[${SCRIPT_NAME}] [DEBUG] 尝试刷新UI. LastMes ID: ${$lastMes.attr('mesid')}`);
        if ($lastMes.length) {
          const mesId = $lastMes.attr('mesid');
          const state = messageSegmentState.get(String(mesId));
          if (
            state &&
            state.parsedContent &&
            state.parsedContent.currentBackground &&
            state.parsedContent.currentBackground.scene === sceneName
          ) {
            SpriteManager.currentScene = null;
            console.log(`[${SCRIPT_NAME}] [DEBUG] 强制刷新UI: ${sceneName}`);
            if (_updateGlobalOverlayContentRef) {
              _updateGlobalOverlayContentRef(mesId, state.parsedContent);
            }
          }
        }
      } else {
        throw new Error('生成的图片数据为空');
      }
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 实时背景生成失败:`, e);
      showToast(`场景「${sceneName}」生成失败`);
    } finally {
      BGMManager.generatingScenes.delete(sceneName);
    }
  })();
}

// ============================================
// 大香蕉 AI 生图
// ============================================

export function parseBananaImageFromResponse(content, proxyUrl) {
  if (!content) return null;

  function fixLocalhostUrl(imageUrl) {
    if (!imageUrl || !proxyUrl) return imageUrl;
    const localhostPattern = /^(https?:\/\/)(127\.0\.0\.1|localhost|0\.0\.0\.0)(:\d+)?/i;
    const match = imageUrl.match(localhostPattern);
    if (!match) return imageUrl;

    try {
      const proxyUrlObj = new URL(proxyUrl);
      const targetHost = proxyUrlObj.hostname;
      const targetPort = proxyUrlObj.port;
      const isProxyLocalhost = /^(127\.0\.0\.1|localhost|0\.0\.0\.0)$/i.test(targetHost);
      if (isProxyLocalhost) return imageUrl;

      const newHostPort = targetPort ? `${targetHost}:${targetPort}` : targetHost;
      const fixedUrl = imageUrl.replace(localhostPattern, `$1${newHostPort}`);
      console.log(`[${SCRIPT_NAME}] 大香蕉生图: 修复本机地址 ${imageUrl} -> ${fixedUrl}`);
      return fixedUrl;
    } catch (e) {
      return imageUrl;
    }
  }

  // 1. Markdown 图片 ![...](url)
  const mdImageMatch = content.match(/!\[[^\]]*\]\(([^)]+)\)/);
  if (mdImageMatch && mdImageMatch[1]) {
    const url = mdImageMatch[1].trim();
    if (url.startsWith('http') || url.startsWith('data:')) {
      console.log(`[${SCRIPT_NAME}] 大香蕉生图: 解析到 Markdown 图片`);
      return fixLocalhostUrl(url);
    }
  }

  // 2. HTML img 标签
  const imgTagMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgTagMatch && imgTagMatch[1]) {
    console.log(`[${SCRIPT_NAME}] 大香蕉生图: 解析到 HTML img 标签`);
    return fixLocalhostUrl(imgTagMatch[1]);
  }

  // 3. 直接图片 URL
  const urlMatch = content.match(/(https?:\/\/[^\s<>"']+\.(?:png|jpg|jpeg|gif|webp|bmp)(?:\?[^\s<>"']*)?)/i);
  if (urlMatch && urlMatch[1]) {
    console.log(`[${SCRIPT_NAME}] 大香蕉生图: 解析到直接 URL`);
    return fixLocalhostUrl(urlMatch[1]);
  }

  // 4. Base64 图片
  const base64Match = content.match(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/i);
  if (base64Match) {
    console.log(`[${SCRIPT_NAME}] 大香蕉生图: 解析到 Base64 图片`);
    return base64Match[0];
  }

  // 5. 宽松匹配
  const looseUrlMatch = content.match(/(https?:\/\/[^\s<>"'\]]+)/i);
  if (looseUrlMatch && looseUrlMatch[1]) {
    const url = looseUrlMatch[1];
    if (url.includes('image') || url.includes('img') || url.includes('pic') ||
        url.includes('photo') || url.includes('upload') || url.includes('file')) {
      console.log(`[${SCRIPT_NAME}] 大香蕉生图: 解析到可能的图片 URL`);
      return fixLocalhostUrl(url);
    }
  }

  console.warn(`[${SCRIPT_NAME}] 大香蕉生图: 未能从响应中解析图片，响应内容: ${content.substring(0, 200)}...`);
  return null;
}

export function handleBananaBackgroundGeneration(sceneName, prompt) {
  const settings = getSettings();
  if (!settings.bananaImageGen?.enabled) return;
  if (BGMManager.generatingScenes.has(sceneName)) return;

  if (sceneBackgrounds.has(sceneName)) {
    console.log(`[${SCRIPT_NAME}] 大香蕉生图: 场景「${sceneName}」已存在缓存，跳过生成`);
    return;
  }

  const bs = settings.bananaImageGen;

  if (!bs.proxyUrl) {
    console.warn(`[${SCRIPT_NAME}] 大香蕉生图: 未配置反代 API 地址`);
    return;
  }

  if (!bs.model) {
    console.warn(`[${SCRIPT_NAME}] 大香蕉生图: 未选择图片生成模型`);
    return;
  }

  BGMManager.generatingScenes.add(sceneName);

  (async () => {
    try {
      console.log(`[${SCRIPT_NAME}] 大香蕉生图: 开始生成场景「${sceneName}」`);
      console.log(`[${SCRIPT_NAME}] 大香蕉生图: 原始描述 = ${prompt.substring(0, 100)}...`);

      let finalPrompt = prompt;
      if (bs.defaultPromptPrefix) {
        finalPrompt = bs.defaultPromptPrefix + finalPrompt;
      }
      if (!bs.cgMode) {
        const defaultSceneSuffix = ', no humans, scenery, background';
        const suffixToUse = bs.defaultPromptSuffix || defaultSceneSuffix;
        if (suffixToUse) {
          finalPrompt = finalPrompt + suffixToUse;
        }
      }
      if (bs.cgMode) {
        finalPrompt = finalPrompt + '\n请生成符合剧情的CG画面，必须包含人物。';

        const appearances = getBananaCharacterAppearances();
        if (appearances.length > 0) {
          const appearanceHint = '\n\n### 角色外观参考（必须遵守）\n' +
            appearances.slice(0, 3).map(a => {
              const name = a.characterName || a.characterId || '角色';
              const expr = a.expression || '默认';
              return `- **${name}**: 默认立绘表情「${expr}」`;
            }).join('\n') +
            '\n**重要**: 生成CG时人物外观需与以上立绘保持一致。\n';
          finalPrompt = finalPrompt + appearanceHint;
        }
      }

      console.log(`[${SCRIPT_NAME}] 大香蕉生图: 最终提示词 = ${finalPrompt.substring(0, 150)}...`);

      let baseUrl = bs.proxyUrl.replace(/\/+$/, '');
      if (!baseUrl.endsWith('/v1')) {
        baseUrl = baseUrl + '/v1';
      }
      const genUrl = `${baseUrl}/chat/completions`;

      let messageContent = finalPrompt;
      console.log(`[${SCRIPT_NAME}] 大香蕉生图: cgMode = ${bs.cgMode}`);
      const appearances = getBananaCharacterAppearances();
      console.log(`[${SCRIPT_NAME}] 大香蕉生图: 角色外观列表 =`, JSON.stringify(appearances));
      if (bs.cgMode && appearances.length > 0) {
        console.log(`[${SCRIPT_NAME}] 大香蕉生图: CG模式，准备添加 ${appearances.length} 个角色立绘到多模态消息`);
        messageContent = await buildBananaAppearanceMultimodalContent(finalPrompt);
        if (Array.isArray(messageContent)) {
          console.log(`[${SCRIPT_NAME}] 大香蕉生图: 已构建多模态消息，包含 ${messageContent.length - 1} 张图片`);
        }
      }

      const response = await fetch(genUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${bs.proxyApiKey || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: bs.model,
          messages: [{ role: 'user', content: messageContent }],
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      if (!content) {
        throw new Error('未返回内容');
      }

      const imageUrl = parseBananaImageFromResponse(content, bs.proxyUrl);

      if (!imageUrl) {
        throw new Error('未能从响应中解析到图片');
      }

      if (bs.autoSaveToLibrary) {
        try {
          let imageBlob = null;
          if (imageUrl.startsWith('data:')) {
            const base64Data = imageUrl.split(',')[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            imageBlob = new Blob([byteArray], { type: 'image/png' });
          }

          const savedUrl = await saveBackground(sceneName, imageBlob, imageUrl);
          const cachedUrl = savedUrl || imageUrl;
          sceneBackgrounds.set(sceneName, cachedUrl);
          console.log(`[${SCRIPT_NAME}] 大香蕉生图: 场景「${sceneName}」已保存到背景库`);
        } catch (saveErr) {
          console.warn(`[${SCRIPT_NAME}] 大香蕉生图: 保存到背景库失败，使用临时缓存`, saveErr);
          sceneBackgrounds.set(sceneName, imageUrl);
        }
      } else {
        sceneBackgrounds.set(sceneName, imageUrl);
      }

      const $lastMes = $('#chat > .mes').last();
      if ($lastMes.length) {
        const mesId = $lastMes.attr('mesid');
        const state = messageSegmentState.get(String(mesId));
        if (
          state &&
          state.parsedContent &&
          state.parsedContent.currentBackground &&
          state.parsedContent.currentBackground.scene === sceneName
        ) {
          SpriteManager.currentScene = null;
          console.log(`[${SCRIPT_NAME}] 大香蕉生图: 强制刷新UI: ${sceneName}`);
          if (_updateGlobalOverlayContentRef) {
            _updateGlobalOverlayContentRef(mesId, state.parsedContent);
          }
        }
      }

      showToast(`场景「${sceneName}」AI 背景已生成`);
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 大香蕉生图失败:`, e);
      showToast(`大香蕉生图失败: ${e.message.substring(0, 50)}`);
    } finally {
      BGMManager.generatingScenes.delete(sceneName);
    }
  })();
}
