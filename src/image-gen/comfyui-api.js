import { SCRIPT_NAME } from '../core/constants.js';
import { getComfyUISettings } from './comfyui-helpers.js';

// ============================================
// ComfyUI API (ST 代理模式)
// ============================================
export const ComfyUIAPI = {
  getHeaders() {
    if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getRequestHeaders === 'function') {
      return { ...SillyTavern.getRequestHeaders(), 'Content-Type': 'application/json' };
    }
    return { 'Content-Type': 'application/json' };
  },

  async stFetch(endpoint, body) {
    console.log(`[${SCRIPT_NAME}] Proxy Request: ${endpoint}`, body);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`SillyTavern Proxy Error (${response.status}): ${errText}`);
    }
    return response;
  },

  async checkConnection() {
    const s = getComfyUISettings();
    const baseUrl = s.apiUrl.replace(/\/$/, '');
    try {
      await this.stFetch('/api/sd/comfy/samplers', { url: baseUrl });
      return true;
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] ComfyUI连接失败 (Proxy):`, e);
      return false;
    }
  },

  buildDefaultWorkflow(positive, negative, width, height, steps, cfg) {
    return {
      3: {
        inputs: {
          seed: '%seed%',
          steps: steps,
          cfg: cfg,
          sampler_name: 'euler_ancestral',
          scheduler: 'normal',
          denoise: 1,
          model: ['4', 0],
          positive: ['6', 0],
          negative: ['7', 0],
          latent_image: ['5', 0],
        },
        class_type: 'KSampler',
      },
      4: {
        inputs: { ckpt_name: 'your_model_here.safetensors' },
        class_type: 'CheckpointLoaderSimple',
      },
      5: {
        inputs: { width: width, height: height, batch_size: 1 },
        class_type: 'EmptyLatentImage',
      },
      6: {
        inputs: { text: '%prompt%', clip: ['4', 1] },
        class_type: 'CLIPTextEncode',
      },
      7: {
        inputs: { text: '%negative%', clip: ['4', 1] },
        class_type: 'CLIPTextEncode',
      },
      8: {
        inputs: { samples: ['3', 0], vae: ['4', 2] },
        class_type: 'VAEDecode',
      },
      9: {
        inputs: { filename_prefix: 'GalgameGen', images: ['8', 0] },
        class_type: 'SaveImage',
      },
    };
  },

  isTextNode(node) {
    if (!node) return false;
    const type = node.class_type;
    return (
      type === 'CLIPTextEncode' ||
      type === 'CLIPTextEncodeSDXL' ||
      type === 'ShowText' ||
      type === 'PrimitiveNode' ||
      (type && type.includes('TextEncode'))
    );
  },

  findSamplerNodes(workflow) {
    const samplers = [];
    for (const id in workflow) {
      const node = workflow[id];
      if (
        node.class_type &&
        (node.class_type.includes('Sampler') ||
          node.class_type === 'KModel' ||
          node.class_type === 'Samplers')
      ) {
        samplers.push({ id, node });
      }
    }
    return samplers;
  },

  traceBackInput(workflow, nodeId, inputName) {
    const node = workflow[nodeId];
    if (!node || !node.inputs || !node.inputs[inputName]) return null;

    const link = node.inputs[inputName];
    if (!Array.isArray(link) || link.length < 1) return null;

    const sourceId = link[0];
    const sourceNode = workflow[sourceId];
    if (!sourceNode) return null;

    return { id: sourceId, node: sourceNode };
  },

  injectPromptsToWorkflow(workflow, positive, negative, seed) {
    // Stage 1: 变量替换模式
    let workflowStr = JSON.stringify(workflow);
    let hasVariables = false;

    const replacements = {
      '%prompt%': positive,
      '%negative%': negative,
      '%seed%': seed,
    };

    for (const key in replacements) {
      if (workflowStr.includes(key)) {
        hasVariables = true;
        break;
      }
    }

    if (hasVariables) {
      console.log(`[${SCRIPT_NAME}] 使用变量替换模式注提示词 (%params%)`);

      if (workflowStr.includes('"%seed%"')) {
        workflowStr = workflowStr.split('"%seed%"').join(seed);
      }

      for (const [key, value] of Object.entries(replacements)) {
        if (key === '%seed%') continue;
        const safeValue = typeof value === 'string' ? value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') : value;
        workflowStr = workflowStr.split(key).join(safeValue);
      }

      try {
        const newWorkflow = JSON.parse(workflowStr);
        for (const k in workflow) delete workflow[k];
        Object.assign(workflow, newWorkflow);
        return { workflow, posNodeFound: true, negNodeFound: true };
      } catch (e) {
        console.error(`[${SCRIPT_NAME}] 变量替换后 JSON 解析失败:`, e);
      }
    }

    // Stage 2: 智能拓扑追踪
    console.log(`[${SCRIPT_NAME}] 尝试智能拓扑追踪注入...`);
    let posNodeFound = false;
    let negNodeFound = false;

    const samplers = this.findSamplerNodes(workflow);
    if (samplers.length > 0) {
      console.log(`[${SCRIPT_NAME}] 找到 ${samplers.length} 个采样器节点`);

      const findTextSource = (nodeId, depth = 0) => {
        if (depth > 10) return null;
        const node = workflow[nodeId];
        if (!node) return null;

        if (this.isTextNode(node)) return nodeId;

        const inputsToCheck = ['conditioning', 'conditioning_1', 'conditioning_2', 'clip', 'samples'];
        for (const inputName of inputsToCheck) {
          const source = this.traceBackInput(workflow, nodeId, inputName);
          if (source) {
            const res = findTextSource(source.id, depth + 1);
            if (res) return res;
          }
        }
        return null;
      };

      for (const { id: samplerId, node: samplerNode } of samplers) {
        if (samplerNode.inputs) {
          if (samplerNode.inputs.seed !== undefined) samplerNode.inputs.seed = seed;
          if (samplerNode.inputs.noise_seed !== undefined) samplerNode.inputs.noise_seed = seed;
        }

        const posSource = this.traceBackInput(workflow, samplerId, 'positive');
        if (posSource) {
          const targetId = findTextSource(posSource.id);
          if (targetId && workflow[targetId].inputs) {
            workflow[targetId].inputs.text = positive;
            console.log(`[${SCRIPT_NAME}] 自动追踪并注入 Positive -> Node ${targetId}`);
            posNodeFound = true;
          }
        }

        const negSource = this.traceBackInput(workflow, samplerId, 'negative');
        if (negSource) {
          const targetId = findTextSource(negSource.id);
          if (targetId && workflow[targetId].inputs) {
            workflow[targetId].inputs.text = negative;
            console.log(`[${SCRIPT_NAME}] 自动追踪并注入 Negative -> Node ${targetId}`);
            negNodeFound = true;
          }
        }
      }
    }

    if (posNodeFound || negNodeFound) {
      return { workflow, posNodeFound, negNodeFound };
    }

    // Stage 3: 旧版启发式兜底
    console.log(`[${SCRIPT_NAME}] 拓扑追踪失败，使用列表顺序兜底...`);

    const textNodes = [];
    for (const id in workflow) {
      if (this.isTextNode(workflow[id])) {
        textNodes.push(workflow[id]);
      }
      if (
        workflow[id].inputs &&
        (workflow[id].inputs.seed !== undefined || workflow[id].inputs.noise_seed !== undefined)
      ) {
        if (typeof workflow[id].inputs.seed === 'number') workflow[id].inputs.seed = seed;
      }
    }

    if (textNodes.length >= 1) {
      textNodes[0].inputs.text = positive;
      posNodeFound = true;
    }
    if (textNodes.length >= 2) {
      textNodes[1].inputs.text = negative;
      negNodeFound = true;
    }

    return { workflow, posNodeFound, negNodeFound };
  },

  async getModels(baseUrl) {
    try {
      console.log(`[${SCRIPT_NAME}] 正在获取模型列表 (Proxy)...`);
      const response = await this.stFetch('/api/sd/comfy/models', { url: baseUrl });
      const rawData = await response.json();

      const models = rawData.map(m => {
        if (typeof m === 'string') return m;
        if (m && typeof m === 'object') return m.value || m.title || m.filename || m.name || JSON.stringify(m);
        return String(m);
      });

      console.log(`[${SCRIPT_NAME}] 获取到 ${models.length} 个模型`);
      return models;
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 获取模型列表异常 (Proxy):`, e);
      return [];
    }
  },

  async generate(workflowJson, promptText, negativeText, extraSettings = {}) {
    const s = getComfyUISettings();
    const baseUrl = s.apiUrl.replace(/\/$/, '');
    const seed = Math.floor(Math.random() * 10000000000000);
    const { checkpointOverride } = extraSettings;

    if (workflowJson.nodes && Array.isArray(workflowJson.nodes) && workflowJson.version !== undefined) {
      console.error(`[${SCRIPT_NAME}] 错误: 检测到 UI 格式 Workflow`);
      throw new Error(
        "格式错误: 检测到您使用的是 'Save' 保存的 UI 格式 JSON。请在 ComfyUI 设置中开启 'Enable Dev mode Options'，然后使用 'Save (API Format)' 按钮保存 Workflow。",
      );
    }
    if (typeof workflowJson !== 'object' || Array.isArray(workflowJson)) {
      throw new Error('格式错误: Workflow 必须是 API 格式的 JSON 对象 (Key 为节点ID)。');
    }

    let finalWorkflow = JSON.parse(JSON.stringify(workflowJson));

    let checkpointNode = null;
    for (const id in finalWorkflow) {
      const node = finalWorkflow[id];
      if ((node.class_type === 'CheckpointLoaderSimple' || node.class_type === 'CheckpointLoader') && node.inputs) {
        checkpointNode = node;
        break;
      }
    }

    if (checkpointOverride && checkpointNode) {
      console.log(`[${SCRIPT_NAME}] 使用指定模型覆盖: ${checkpointOverride}`);
      checkpointNode.inputs.ckpt_name = checkpointOverride;
    } else if (checkpointNode && checkpointNode.inputs.ckpt_name === 'your_model_here.safetensors') {
      console.log(`[${SCRIPT_NAME}] 检测到占位符模型，尝试自动替换...`);
      try {
        const models = await this.getModels(baseUrl);
        if (models && models.length > 0) {
          const sdxl = models.find(m => typeof m === 'string' && m.toLowerCase().includes('sdxl'));
          checkpointNode.inputs.ckpt_name = sdxl || models[0];
          console.log(`[${SCRIPT_NAME}] 自动替换模型为: ${checkpointNode.inputs.ckpt_name}`);
        } else {
          throw new Error('模型列表为空');
        }
      } catch (e) {
        console.error(`[${SCRIPT_NAME}] 自动替换失败:`, e);
      }
    }

    this.injectPromptsToWorkflow(finalWorkflow, promptText, negativeText, seed);

    const clientId = 'galgame_client_' + Date.now();
    console.log(`[${SCRIPT_NAME}] 发送生成请求到 Proxy /api/sd/comfy/generate...`);

    const comfyPrompt = {
      client_id: clientId,
      prompt: finalWorkflow,
    };

    const response = await this.stFetch('/api/sd/comfy/generate', {
      url: baseUrl,
      prompt: JSON.stringify(comfyPrompt),
    });

    const result = await response.json();

    if (result.data) {
      const base64Data = result.data.split(',').pop();
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: 'image/png' });
    } else {
      throw new Error('SillyTavern代理返回了空数据');
    }
  },
};
