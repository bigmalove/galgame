import { SCRIPT_NAME } from '../core/constants.js';
import { getTavernContext, topWindow } from '../core/env.js';

// ============================================
// 加强模式自定义 LLM：基于酒馆连接配置（Connection Profile）独立请求
// ============================================
// 通过酒馆提供给扩展的 ConnectionManagerRequestService 按指定连接配置发请求，
// 密钥由酒馆后端按配置绑定的 secret 读取，不会切换酒馆当前的连接配置 / 模型 / 预设。

function getRawProfiles(ctx) {
  const profiles = ctx?.extensionSettings?.connectionManager?.profiles;
  return Array.isArray(profiles) ? profiles : [];
}

function isConnectionManagerDisabled(ctx) {
  const disabled = ctx?.extensionSettings?.disabledExtensions;
  return Array.isArray(disabled) && disabled.includes('connection-manager');
}

/**
 * 列出可用于独立请求的连接配置
 * @returns {{ id: string, name: string, api: string, model: string }[]}
 */
export function listConnectionProfiles() {
  const ctx = getTavernContext();
  if (!ctx || isConnectionManagerDisabled(ctx)) return [];

  let profiles = getRawProfiles(ctx);
  const service = ctx.ConnectionManagerRequestService;
  if (typeof service?.getSupportedProfiles === 'function') {
    try {
      profiles = service.getSupportedProfiles();
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 获取可用连接配置失败:`, e);
    }
  }

  return (Array.isArray(profiles) ? profiles : [])
    .filter(profile => profile && profile.id)
    .map(profile => ({
      id: String(profile.id),
      name: String(profile.name || profile.id),
      api: String(profile.api || ''),
      model: String(profile.model || ''),
    }));
}

/**
 * 按 ID 查找连接配置，找不到时按名称兜底（兼容旧版只保存了配置名称的设置）
 */
export function resolveConnectionProfile({ profileId = '', profileName = '' } = {}) {
  const profiles = getRawProfiles(getTavernContext());
  return (profileId && profiles.find(profile => profile?.id === profileId))
    || (profileName && profiles.find(profile => profile?.name === profileName))
    || null;
}

export function describeLlmConfig(llm) {
  if (!llm) return '酒馆当前 API';
  const profile = resolveConnectionProfile(llm);
  const profileLabel = profile?.name || llm.profileName || llm.profileId || '未知连接配置';
  const model = llm.model || profile?.model || '';
  return model ? `${profileLabel} / ${model}` : profileLabel;
}

// ============================================
// 模型列表
// ============================================
const MODEL_SELECT_ALIASES = {
  makersuite: ['google', 'makersuite'],
};

// 酒馆后端不提供模型列表的源（如 Claude）回退读取酒馆页面里对应源的模型下拉框
function readModelOptionsFromTavernPage(source) {
  const doc = topWindow?.document;
  if (!doc || !source) return [];
  const names = MODEL_SELECT_ALIASES[source] || [source];
  const models = [];
  for (const name of names) {
    doc.querySelectorAll(`#model_${name}_select option`).forEach(option => {
      const value = String(option.value || '').trim();
      if (value) models.push(value);
    });
    if (models.length > 0) break;
  }
  return models;
}

function extractModelIds(json) {
  const list = Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json?.data?.data)
      ? json.data.data
      : Array.isArray(json?.models)
        ? json.models
        : Array.isArray(json)
          ? json
          : [];
  return list
    .map(item => (typeof item === 'string' ? item : item?.id || item?.name || ''))
    .map(id => String(id).trim())
    .filter(Boolean);
}

// 以酒馆页面为基准解析接口地址（脚本运行在 iframe 中）
function resolveTavernApiUrl(path) {
  try {
    return new URL(path, topWindow.location.href).toString();
  } catch (e) {
    return path;
  }
}

async function requestRemoteModelList(ctx, profile, apiMap, secretId) {
  const apiUrl = String(profile['api-url'] || '').trim() || undefined;

  let url;
  let body;
  if (apiMap.selected === 'openai') {
    url = '/api/backends/chat-completions/status';
    // 与 ConnectionManagerRequestService.sendRequest 一致：连接配置的 api-url 按源分别对应不同字段
    body = {
      chat_completion_source: apiMap.source,
      custom_url: apiUrl,
      vertexai_region: apiUrl,
      zai_endpoint: apiUrl,
      siliconflow_endpoint: apiUrl,
      minimax_endpoint: apiUrl,
      pollinations_endpoint: apiUrl,
      secret_id: secretId,
      custom_include_headers: apiMap.source === 'custom' ? ctx.chatCompletionSettings?.custom_include_headers : undefined,
    };
  } else {
    if (!apiUrl) throw new Error('该连接配置未设置 API 地址');
    url = '/api/backends/text-completions/status';
    body = { api_server: apiUrl, api_type: apiMap.type, secret_id: secretId };
  }

  const headers = typeof ctx.getRequestHeaders === 'function'
    ? ctx.getRequestHeaders()
    : { 'Content-Type': 'application/json' };
  const response = await fetch(resolveTavernApiUrl(url), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    cache: 'no-cache',
  });
  if (!response.ok) {
    throw new Error(`酒馆后端返回 HTTP ${response.status}（该 API 类型可能不支持获取模型列表）`);
  }
  const json = await response.json().catch(() => null);
  if (!json || json.error) {
    // 酒馆后端请求上游 /models 失败时只返回 { error: true }，具体原因见酒馆服务端日志
    throw new Error(json?.message || json?.error?.message || '上游 /models 请求失败（密钥无效或 API 地址不可用，详见酒馆服务端日志）');
  }
  return extractModelIds(json);
}

/**
 * 获取连接配置对应 API 的模型列表
 * @returns {Promise<string[]>}
 */
export async function fetchProfileModels(profileId) {
  const ctx = getTavernContext();
  if (!ctx) throw new Error('无法访问酒馆上下文');
  const profile = resolveConnectionProfile({ profileId });
  if (!profile) throw new Error('未找到该连接配置');
  const apiMap = ctx.CONNECT_API_MAP?.[profile.api];
  if (!apiMap) throw new Error(`未知的 API 类型: ${profile.api || '（空）'}`);

  const models = new Set();
  let remoteError = null;
  const secretId = profile['secret-id'] || undefined;
  // 先用连接配置绑定的密钥；失败时（如该密钥已被删除）再用酒馆当前启用的密钥重试
  for (const attemptSecretId of secretId ? [secretId, undefined] : [undefined]) {
    try {
      (await requestRemoteModelList(ctx, profile, apiMap, attemptSecretId)).forEach(id => models.add(id));
      remoteError = null;
      break;
    } catch (e) {
      remoteError = e;
      console.warn(`[${SCRIPT_NAME}] 连接配置「${profile.name}」模型列表请求失败${attemptSecretId ? '（使用配置绑定的密钥）' : ''}:`, e);
    }
  }
  if (models.size === 0 && apiMap.selected === 'openai') {
    readModelOptionsFromTavernPage(apiMap.source).forEach(id => models.add(id));
  }
  if (models.size === 0 && remoteError) throw remoteError;

  return Array.from(models).sort((a, b) => a.localeCompare(b));
}

// ============================================
// 独立请求
// ============================================
function resolveMaxTokens(ctx, profile, maxTokens) {
  const explicit = Math.round(Number(maxTokens) || 0);
  if (explicit > 0) return explicit;
  // 不传则沿用连接配置绑定预设里的最大回复长度
  if (profile.preset) return undefined;
  const fallback = Math.round(Number(ctx.chatCompletionSettings?.openai_max_tokens) || 0);
  return fallback > 0 ? fallback : 4096;
}

function unwrapRequestError(error) {
  const cause = error?.cause;
  const detail = cause?.message || (typeof cause === 'string' ? cause : '');
  return new Error(detail ? `${error.message}: ${detail}` : (error?.message || String(error)));
}

/**
 * 使用指定连接配置发送一次独立请求（流式）
 * @param {object} options
 * @param {string} options.profileId
 * @param {string} [options.profileName]
 * @param {string} [options.model] 留空则使用连接配置自带的模型
 * @param {number} [options.maxTokens] 0 表示跟随连接配置预设
 * @param {{ role: string, content: string }[]} options.messages
 * @param {(text: string) => void} [options.onStream]
 * @returns {Promise<string>}
 */
export async function requestWithConnectionProfile({ profileId, profileName, model, maxTokens, messages, onStream }) {
  const ctx = getTavernContext();
  if (!ctx) throw new Error('无法访问酒馆上下文');
  if (isConnectionManagerDisabled(ctx)) throw new Error('酒馆的连接配置管理（Connection Manager）扩展已被禁用');
  const service = ctx.ConnectionManagerRequestService;
  if (typeof service?.sendRequest !== 'function') {
    throw new Error('当前酒馆版本不支持按连接配置独立请求，请更新酒馆或改用「跟随酒馆当前 API」');
  }

  const profile = resolveConnectionProfile({ profileId, profileName });
  if (!profile) throw new Error(`未找到连接配置「${profileName || profileId || '未选择'}」`);

  const overridePayload = model ? { model } : {};
  let result;
  try {
    result = await service.sendRequest(
      profile.id,
      messages,
      resolveMaxTokens(ctx, profile, maxTokens),
      { stream: true, extractData: true, includePreset: true, includeInstruct: true },
      overridePayload,
    );
  } catch (e) {
    throw unwrapRequestError(e);
  }

  if (typeof result === 'function') {
    let text = '';
    for await (const chunk of result()) {
      text = typeof chunk?.text === 'string' ? chunk.text : text;
      if (onStream) onStream(text);
    }
    return text;
  }
  const content = typeof result === 'string' ? result : result?.content;
  return typeof content === 'string' ? content : String(content ?? '');
}
