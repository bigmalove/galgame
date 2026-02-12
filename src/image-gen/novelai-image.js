import { SCRIPT_NAME } from '../core/constants.js';
import { $ } from '../core/env.js';
import { getSettings } from '../core/settings.js';
import { GalgameStore } from '../core/store.js';
import { saveBackground } from '../db/backgrounds.js';
import { clearBackgroundLayers } from '../db/image-packs.js';
import { BGMManager } from '../audio/bgm-manager.js';
import { injectCOTToWorldbook } from '../logic/worldbook.js';
import { getIsEnabled } from '../core/state.js';
import { showBgGenToast, refreshUIForScene } from './bg-gen-shared.js';

// ============================================
// NovelAI 背景图生成
// ============================================

const sceneBackgrounds = GalgameStore.cache.backgrounds;

// ============================================
// ZIP 解析 (NovelAI 返回 ZIP 包含 PNG)
// ============================================

async function extractImageFromZip(arrayBuffer) {
  const view = new DataView(arrayBuffer);

  // 检查 PK 签名 (0x04034b50)
  if (view.getUint32(0, true) !== 0x04034b50) {
    throw new Error('响应不是有效的 ZIP 文件');
  }

  const compressionMethod = view.getUint16(8, true);
  let compressedSize = view.getUint32(18, true);
  const fileNameLength = view.getUint16(26, true);
  const extraFieldLength = view.getUint16(28, true);
  const dataOffset = 30 + fileNameLength + extraFieldLength;

  // 如果 compressedSize 为 0（data descriptor flag），从中央目录读取真实大小
  if (compressedSize === 0) {
    for (let i = dataOffset; i < arrayBuffer.byteLength - 4; i++) {
      if (view.getUint32(i, true) === 0x02014b50) {
        compressedSize = view.getUint32(i + 20, true);
        break;
      }
    }
    // fallback: 查找 data descriptor 签名 (0x08074b50)
    if (compressedSize === 0) {
      for (let i = dataOffset; i < arrayBuffer.byteLength - 4; i++) {
        if (view.getUint32(i, true) === 0x08074b50) {
          compressedSize = i - dataOffset;
          break;
        }
      }
    }
    // 最后兜底
    if (compressedSize === 0) {
      console.warn(`[${SCRIPT_NAME}] NovelAI ZIP: 无法精确确定文件大小，使用剩余字节作为兜底`);
      compressedSize = arrayBuffer.byteLength - dataOffset;
    }
  }

  const fileData = new Uint8Array(arrayBuffer, dataOffset, compressedSize);

  if (compressionMethod === 0) {
    return new Blob([fileData], { type: 'image/png' });
  } else if (compressionMethod === 8) {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(fileData);
    writer.close();
    return await new Response(ds.readable).blob();
  }

  throw new Error(`不支持的压缩方式: ${compressionMethod}`);
}

// ============================================
// 请求体构建
// ============================================

function buildRequestBody(tags, settings) {
  const ns = settings.novelai;
  const negativePrompt = ns.negativePrompt ||
    'nsfw, lowres, artistic error, worst quality, bad quality, jpeg artifacts, very displeasing, text, watermark';

  let finalPrompt = tags;
  if (ns.defaultPromptPrefix) {
    finalPrompt = ns.defaultPromptPrefix + finalPrompt;
  }
  if (ns.defaultPromptSuffix) {
    finalPrompt = finalPrompt + ns.defaultPromptSuffix;
  }

  const seed = Math.floor(Math.random() * 4294967295);

  return {
    input: finalPrompt,
    model: ns.model || 'nai-diffusion-4-5-curated',
    action: 'generate',
    parameters: {
      params_version: 3,
      width: ns.width || 1216,
      height: ns.height || 832,
      scale: ns.scale ?? 10,
      sampler: ns.sampler || 'k_euler',
      steps: ns.steps || 28,
      n_samples: 1,
      ucPreset: ns.ucPreset ?? 3,
      qualityToggle: true,
      dynamic_thresholding: false,
      cfg_rescale: ns.cfgRescale ?? 0.18,
      noise_schedule: ns.noiseSchedule || 'karras',
      skip_cfg_above_sigma: ns.skipCfgAboveSigma ?? 58,
      seed: seed,
      negative_prompt: negativePrompt,
      characterPrompts: [],
      v4_prompt: {
        caption: { base_caption: finalPrompt, char_captions: [] },
        use_coords: false,
        use_order: true,
      },
      v4_negative_prompt: {
        caption: { base_caption: negativePrompt, char_captions: [] },
        legacy_uc: false,
      },
      autoSmea: false,
      normalize_reference_strength_multiple: false,
      legacy: false,
      legacy_uc: false,
      legacy_v3_extend: false,
      add_original_image: true,
      controlnet_strength: 1,
      use_coords: false,
    },
  };
}

// ============================================
// 主入口：处理 NovelAI 背景生成
// ============================================

export function handleNovelAIBackgroundGeneration(sceneName, tags) {
  const settings = getSettings();
  if (settings.bgImageSource !== 'novelai') return;
  if (BGMManager.generatingScenes.has(sceneName)) return;

  if (sceneBackgrounds.has(sceneName)) {
    console.log(`[${SCRIPT_NAME}] NovelAI 生图: 场景「${sceneName}」已存在缓存，跳过生成`);
    return;
  }

  const ns = settings.novelai;
  if (!ns.apiKey) {
    console.warn(`[${SCRIPT_NAME}] NovelAI 生图: 未配置 API Key`);
    return;
  }

  BGMManager.generatingScenes.add(sceneName);
  showBgGenToast(`正在生成场景: ${sceneName}...`);

  const $bgLayer = $('#gal-global-overlay .gal-layer-bg');
  if ($bgLayer.length) {
    $bgLayer.addClass('generating-bg').removeClass('has-bg');
    clearBackgroundLayers($bgLayer);
  }

  (async () => {
    try {
      console.log(`[${SCRIPT_NAME}] NovelAI 生图: 开始生成场景「${sceneName}」`);
      console.log(`[${SCRIPT_NAME}] NovelAI 生图: Tags = ${tags.substring(0, 100)}`);

      const requestBody = buildRequestBody(tags, settings);
      console.log(`[${SCRIPT_NAME}] NovelAI 生图: 模型=${requestBody.model}, 尺寸=${requestBody.parameters.width}x${requestBody.parameters.height}`);

      const response = await fetch('https://image.novelai.net/ai/generate-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ns.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const imageBlob = await extractImageFromZip(arrayBuffer);

      if (!imageBlob || imageBlob.size === 0) {
        throw new Error('提取到的图片数据为空');
      }

      console.log(`[${SCRIPT_NAME}] NovelAI 生图: 图片大小 = ${(imageBlob.size / 1024).toFixed(1)} KB`);

      if (ns.autoSaveToLibrary !== false) {
        try {
          const savedUrl = await saveBackground(sceneName, imageBlob, null);
          sceneBackgrounds.set(sceneName, savedUrl || URL.createObjectURL(imageBlob));
          console.log(`[${SCRIPT_NAME}] NovelAI 生图: 场景「${sceneName}」已保存到背景库`);
        } catch (saveErr) {
          console.warn(`[${SCRIPT_NAME}] NovelAI 生图: 保存失败，使用临时缓存`, saveErr);
          sceneBackgrounds.set(sceneName, URL.createObjectURL(imageBlob));
        }
      } else {
        sceneBackgrounds.set(sceneName, URL.createObjectURL(imageBlob));
      }

      if (getIsEnabled()) {
        injectCOTToWorldbook();
      }

      refreshUIForScene(sceneName);
      showBgGenToast(`场景「${sceneName}」NovelAI 背景已生成`);
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] NovelAI 生图失败:`, e);
      showBgGenToast(`NovelAI 生图失败: ${e.message.substring(0, 50)}`);
    } finally {
      BGMManager.generatingScenes.delete(sceneName);
    }
  })();
}
