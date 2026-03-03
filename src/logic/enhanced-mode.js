import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow } from '../core/env.js';
import { ensureEnhancedModeSettings, getSettings, SYSTEM_PROMPT_FOR_SECOND_GENERATE } from '../core/settings.js';
import { getIsEnabled } from '../core/state.js';
import { GalgameStore } from '../core/store.js';
import { generateCOTTemplate } from './cot-template.js';
import {
    checkSillyTavernGenerating,
    getGenerationState,
    getInitializationTime,
    getIsGeneratingResponse,
    getVerificationDelayMs,
    resetGenerationState,
    setIsGeneratingResponse,
    startGenerationTimeout,
    stopGenerationTimeout,
} from './generation-state.js';
import { parseGalgameContent } from './parser.js';
import { getPendingSpecialCg } from './special-cg-trigger.js';

// ============================================
// 加强模式
// ============================================

const WORLDBOOK_NAME = 'galgame界面插件';
const COT_ENTRY_NAME = 'Galgame输出格式规范';

const enhancedModeState = GalgameStore.enhancedMode;
const worldbookInjectionState = GalgameStore.worldbookInjection;

// 延迟引用
let _showToastRef = null;
let _updateGlobalOverlayContentRef = null;
let _updateNextBtnForGeneratingStateRef = null;
let _updateGeneratingStatusRef = null;

export function setEnhancedModeRefs({
  showToast,
  updateGlobalOverlayContent,
  updateNextBtnForGeneratingState,
  updateGeneratingStatus,
}) {
  if (showToast) _showToastRef = showToast;
  if (updateGlobalOverlayContent) _updateGlobalOverlayContentRef = updateGlobalOverlayContent;
  if (updateNextBtnForGeneratingState) _updateNextBtnForGeneratingStateRef = updateNextBtnForGeneratingState;
  if (updateGeneratingStatus) _updateGeneratingStatusRef = updateGeneratingStatus;
}

export { COT_ENTRY_NAME, WORLDBOOK_NAME };

function showToast(msg, duration) {
  if (_showToastRef) _showToastRef(msg, duration);
}

// ============================================
// COT 格式检测
// ============================================
export function isCotFormatted(content) {
  if (!content || typeof content !== 'string') return false;
  const cotIndicators = [/<background\s+scene=/i, /<sprite\s+/i, /<bgm>/i, /<maintext>/i, /<p\s+tts=/i];
  return cotIndicators.some(pattern => pattern.test(content));
}

/**
 * 获取格式化版本内容
 */
export function getFormattedContent(messageId) {
  const messages = getChatMessages(messageId, { include_swipes: true });
  const message = messages[0];
  if (!message || !message.swipes || message.swipes.length < 2) {
    return null;
  }
  const swipes = message.swipes;
  const swipesInfo = message.swipes_info || [];

  // 策略1：优先检查swipe 1
  const swipe1Info = swipesInfo[1] || {};
  const swipe1Content = swipes[1];
  if (swipe1Info.isEnhancedFormat === true) {
    return {
      original: swipes[0],
      formatted: swipe1Content,
      formattedIndex: 1,
      originalIndex: 0,
      currentSwipe: message.swipe_id,
    };
  }
  if (swipe1Info.isEnhancedFormat !== false && isCotFormatted(swipe1Content)) {
    return {
      original: swipes[0],
      formatted: swipe1Content,
      formattedIndex: 1,
      originalIndex: 0,
      currentSwipe: message.swipe_id,
      autoDetected: true,
    };
  }

  // 策略2：遍历其他swipe查找
  for (let i = 2; i < swipes.length; i++) {
    const info = swipesInfo[i] || {};
    if (info.isEnhancedFormat === true) {
      return {
        original: swipes[0],
        formatted: swipes[i],
        formattedIndex: i,
        originalIndex: 0,
        currentSwipe: message.swipe_id,
      };
    }
    if (info.isEnhancedFormat !== false && isCotFormatted(swipes[i])) {
      return {
        original: swipes[0],
        formatted: swipes[i],
        formattedIndex: i,
        originalIndex: 0,
        currentSwipe: message.swipe_id,
        autoDetected: true,
      };
    }
  }
  return null;
}

/**
 * 将格式化版本保存到swipe
 */
export async function saveFormatToSwipe(messageId, originalContent, formattedContent) {
  const numericMessageId = Number(messageId);
  console.log(`[${SCRIPT_NAME}] saveFormatToSwipe: 开始, messageId=${numericMessageId}`);

  const msgs = getChatMessages(numericMessageId, { include_swipes: true });
  if (!msgs || msgs.length === 0) {
    throw new Error('未找到目标楼层');
  }
  const msg = msgs[0];
  console.log(`[${SCRIPT_NAME}] saveFormatToSwipe: 当前 swipes=${msg.swipes?.length}, swipe_id=${msg.swipe_id}`);

  const newSwipes = [...msg.swipes, ''];
  const newSwipeId = newSwipes.length - 1;
  await setChatMessages(
    [{ message_id: numericMessageId, swipes: newSwipes, swipe_id: newSwipeId }],
    { refresh: 'affected' },
  );
  console.log(`[${SCRIPT_NAME}] saveFormatToSwipe: 已添加空 swipe, swipe_id=${newSwipeId}`);

  const updatedMsgs = getChatMessages(numericMessageId, { include_swipes: true });
  if (updatedMsgs && updatedMsgs.length > 0) {
    const updatedSwipes = [...updatedMsgs[0].swipes];
    updatedSwipes[newSwipeId] = formattedContent;
    await setChatMessages(
      [{ message_id: numericMessageId, swipes: updatedSwipes, swipe_id: newSwipeId }],
      { refresh: 'affected' },
    );
  }

  console.log(`[${SCRIPT_NAME}] 格式化版本已保存到 swipe ${newSwipeId}`);
}

/**
 * 显示生成进度
 */
function showEnhancedProgress(stage) {
  const messages = {
    first_generating: { icon: 'fa-pen', text: '第一次生成（内容创作）', sub: '正在生成...' },
    first_done: { icon: 'fa-check', text: '第一次完成', sub: '准备格式化...' },
    second_generating: { icon: 'fa-wand-magic-sparkles', text: '第二次生成（COT格式化）', sub: '切换API中...' },
    second_done: { icon: 'fa-check-double', text: '加强模式完成', sub: '已保存2个版本' },
  };
  const msg = messages[stage];
  if (!msg) return;
  showToast(
    `<i class="fa-solid ${msg.icon}" style="color: #ff9800;"></i> <b>${msg.text}</b><br><small>${msg.sub}</small>`,
    3000,
  );
}

/**
 * 重置加强模式状态
 */
export function resetEnhancedModeState() {
  enhancedModeState.isActive = false;
  enhancedModeState.stage = 'idle';
  enhancedModeState.firstResult = null;
  enhancedModeState.formattedResult = null;
  enhancedModeState.targetMessageId = null;
  enhancedModeState.originalProfile = undefined;
  enhancedModeState.originalModel = undefined;
  enhancedModeState.originalPreset = undefined;
  enhancedModeState.originalWorldbooks = null;
  enhancedModeState.worldbooksModified = false;
  enhancedModeState.originalConfigSaved = false;
  enhancedModeState.isSecondGeneration = false;
}

// ============================================
// 配置列表获取
// ============================================
export function getAvailablePresets() {
  try {
    if (typeof getPresetNames === 'function') {
      return Promise.resolve(getPresetNames());
    }
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 获取预设列表失败:`, e);
  }
  return Promise.resolve([]);
}

export async function getAvailableProfiles() {
  try {
    if (typeof triggerSlash === 'function') {
      const result = await triggerSlash('/profile-list');
      if (result) {
        try {
          const parsed = JSON.parse(result);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) {
          if (typeof result === 'string') {
            return result.split(',').map(p => p.trim()).filter(p => p.length > 0);
          }
        }
      }
    }
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 获取连接配置列表失败:`, e);
  }
  return [];
}

export function getAvailableModels() {
  try {
    if (typeof getModelOptions === 'function') {
      const models = getModelOptions();
      if (Array.isArray(models)) {
        return Promise.resolve(models.map(m => (typeof m === 'string' ? m : m.name || m.id || String(m))));
      }
    }
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 获取模型列表失败:`, e);
  }
  return Promise.resolve([]);
}

export function getAvailableWorldbooks() {
  try {
    if (typeof getWorldbookNames === 'function') {
      const worldbooks = getWorldbookNames();
      if (Array.isArray(worldbooks)) {
        return Promise.resolve(worldbooks);
      }
    }
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 获取世界书列表失败:`, e);
  }
  return Promise.resolve([]);
}

// ============================================
// 配置保存/恢复
// ============================================
async function saveOriginalConfig() {
  if (typeof triggerSlash !== 'function') return;

  try {
    if (typeof getGlobalWorldbookNames === 'function') {
      enhancedModeState.originalWorldbooks = getGlobalWorldbookNames();
      console.log(`[${SCRIPT_NAME}] 当前世界书:`, enhancedModeState.originalWorldbooks);
    }
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 获取当前世界书失败:`, e);
  }
  try {
    enhancedModeState.originalProfile = (await triggerSlash('/profile quiet=true')) || '';
    console.log(`[${SCRIPT_NAME}] 当前连接配置: ${enhancedModeState.originalProfile}`);
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 获取当前连接配置失败:`, e);
  }
  try {
    enhancedModeState.originalModel = (await triggerSlash('/model quiet=true')) || '';
    console.log(`[${SCRIPT_NAME}] 当前模型: ${enhancedModeState.originalModel}`);
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 获取当前模型失败:`, e);
  }
  try {
    enhancedModeState.originalPreset = (await triggerSlash('/preset quiet=true')) || '';
    console.log(`[${SCRIPT_NAME}] 当前预设: ${enhancedModeState.originalPreset}`);
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 获取当前预设失败:`, e);
  }
}

async function restoreOriginalConfig() {
  if (typeof triggerSlash !== 'function') return;

  if (enhancedModeState.originalPreset !== undefined && enhancedModeState.originalPreset !== '') {
    try {
      await triggerSlash(`/preset quiet=true ${enhancedModeState.originalPreset}`);
      console.log(`[${SCRIPT_NAME}] 已恢复预设: ${enhancedModeState.originalPreset}`);
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 恢复预设失败:`, e);
    }
  }
  if (enhancedModeState.originalModel !== undefined && enhancedModeState.originalModel !== '') {
    try {
      await triggerSlash(`/model quiet=true ${enhancedModeState.originalModel}`);
      console.log(`[${SCRIPT_NAME}] 已恢复模型: ${enhancedModeState.originalModel}`);
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 恢复模型失败:`, e);
    }
  }
  if (enhancedModeState.originalProfile !== undefined && enhancedModeState.originalProfile !== '') {
    try {
      await triggerSlash(`/profile quiet=true ${enhancedModeState.originalProfile}`);
      console.log(`[${SCRIPT_NAME}] 已恢复连接配置: ${enhancedModeState.originalProfile}`);
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 恢复连接配置失败:`, e);
    }
  }
  if (
    enhancedModeState.worldbooksModified &&
    enhancedModeState.originalWorldbooks !== null &&
    typeof rebindGlobalWorldbooks === 'function'
  ) {
    try {
      await rebindGlobalWorldbooks(enhancedModeState.originalWorldbooks);
      console.log(`[${SCRIPT_NAME}] 已恢复世界书:`, enhancedModeState.originalWorldbooks);
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 恢复世界书失败:`, e);
    }
  }
}

// ============================================
// 流式更新 swipe
// ============================================
async function updateStreamingSwipe(messageId, swipeId, text) {
  try {
    const msgs = getChatMessages(messageId, { include_swipes: true });
    if (!msgs || !msgs[0]) return;

    const msg = msgs[0];
    const newSwipes = [...msg.swipes];
    newSwipes[swipeId] = text;

    const updateData = { ...msg };
    updateData.swipes = newSwipes;
    updateData.swipe_id = swipeId;

    await setChatMessages([updateData], { refresh: 'affected' });
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 流式更新失败:`, e);
  }
}

/**
 * 将原始文本转换为 COT 格式（不修改聊天楼层/swipe）
 *
 * @param {string} sourceText 待转换的原始文本
 * @param {object} options
 * @param {function} [options.onStream] 流式回调
 * @param {boolean} [options.independent=false]
 *   - true:  完全独立模式（开场白转换）。使用 generateRaw，仅发送 system + user_input，
 *            不包含角色描述、世界书、预设、聊天历史等任何上下文。
 *   - false: 预设模式（加强模式第二次生成）。使用 generate，保留当前预设、世界书等设置，
 *            但强制排除聊天历史和深度注入条目，确保转换仅基于原文输入。
 */
export async function convertTextToCotFormat(sourceText, options = {}) {
  const normalizedSource = String(sourceText || '').trim();
  if (!normalizedSource) {
    throw new Error('待转换文本为空');
  }

  const independent = !!options.independent;
  const onStream = typeof options.onStream === 'function' ? options.onStream : null;
  const streamState = { latestText: '' };
  let stopStreamListener = null;
  const previousSecondGenerationState = enhancedModeState.isSecondGeneration;

  try {
    enhancedModeState.isSecondGeneration = true;

    if (onStream && typeof eventOn === 'function' && typeof iframe_events !== 'undefined') {
      const handle = eventOn(iframe_events.STREAM_TOKEN_RECEIVED_FULLY, text => {
        const safeText = typeof text === 'string' ? text : '';
        streamState.latestText = safeText;
        onStream(safeText);
      });
      if (handle && typeof handle.stop === 'function') {
        stopStreamListener = () => handle.stop();
      }
    }

    const pendingSpecialCg = await getPendingSpecialCg();
    const cotTemplate = await generateCOTTemplate({ pendingSpecialCg });
    const systemPrompt = `${SYSTEM_PROMPT_FOR_SECOND_GENERATE}\n\n${cotTemplate}`;
    const userPrompt = `请将以下内容转换为标准Galgame格式：\n\n${normalizedSource}`;

    enhancedModeState.lastPrompts = {
      systemPrompt,
      userPrompt,
      firstResult: normalizedSource,
      timestamp: new Date().toLocaleString('zh-CN'),
    };
    console.log(`[${SCRIPT_NAME}] COT转换: 模式=${independent ? '独立(开场白)' : '预设(加强模式)'}`);

    let formattedText;

    if (independent) {
      // 独立模式：仅发送 system prompt + user input，完全不受预设/世界书/聊天历史影响
      formattedText = await generateRaw({
        user_input: userPrompt,
        should_silence: true,
        should_stream: true,
        ordered_prompts: [
          { role: 'system', content: systemPrompt },
          'user_input',
        ],
      });
    } else {
      // 预设模式：使用当前预设和世界书，但排除聊天历史
      formattedText = await generate({
        user_input: userPrompt,
        injects: [{ role: 'system', content: systemPrompt }],
        should_silence: true,
        should_stream: true,
        max_chat_history: 0,
        overrides: {
          chat_history: {
            prompts: [],
            with_depth_entries: false,
          },
          dialogue_examples: '',
        },
      });
    }

    const safeFormattedText = typeof formattedText === 'string' ? formattedText : String(formattedText || '');
    if (onStream && safeFormattedText && streamState.latestText !== safeFormattedText) {
      onStream(safeFormattedText);
    }

    return {
      formattedText: safeFormattedText,
      systemPrompt,
      userPrompt,
    };
  } finally {
    if (stopStreamListener) {
      try {
        stopStreamListener();
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] 移除流式监听失败:`, e);
      }
    }
    enhancedModeState.isSecondGeneration = previousSecondGenerationState;
  }
}

// ============================================
// 第二次生成
// ============================================
async function runSecondGeneration(messageId, firstResult) {
  const config = ensureEnhancedModeSettings();
  const secondGenerateConfig = config.secondGenerate;
  const numericMessageId = Number(messageId);

  let streamBuffer = '';
  let lastStreamUpdate = 0;
  const STREAM_INTERVAL = 100;

  try {
    if (!Number.isInteger(numericMessageId) || numericMessageId < 0) {
      throw new Error('无效的消息ID，无法执行第二次生成');
    }
    console.log(`[${SCRIPT_NAME}] 加强模式: 开始第二次生成（COT格式化-流式）`);
    enhancedModeState.stage = 'second_generating';
    showEnhancedProgress('second_generating');

    if (!enhancedModeState.originalConfigSaved) {
      await saveOriginalConfig();
      enhancedModeState.originalConfigSaved = true;
    }

    try {
      const originalGlobalWbs = getGlobalWorldbookNames();
      enhancedModeState.originalWorldbooks = [...originalGlobalWbs];
      enhancedModeState.worldbooksModified = true;

      let targetWorldbooks = [...originalGlobalWbs];
      if (!secondGenerateConfig.useWorldbooks) {
        targetWorldbooks = [...originalGlobalWbs];
        console.log(`[${SCRIPT_NAME}] 第二次生成使用当前全局世界书:`, targetWorldbooks);
      } else if (secondGenerateConfig.worldbooks && secondGenerateConfig.worldbooks.length > 0) {
        targetWorldbooks = [...secondGenerateConfig.worldbooks];
        console.log(`[${SCRIPT_NAME}] 第二次生成使用用户指定世界书:`, secondGenerateConfig.worldbooks);
      } else {
        targetWorldbooks = [];
        console.log(`[${SCRIPT_NAME}] 第二次生成清空用户世界书`);
      }

      if (!targetWorldbooks.includes(WORLDBOOK_NAME)) {
        targetWorldbooks.push(WORLDBOOK_NAME);
      }

      await rebindGlobalWorldbooks(targetWorldbooks);
      console.log(`[${SCRIPT_NAME}] 加强模式第二次生成: 已临时附加脚本世界书`, targetWorldbooks);

      if (secondGenerateConfig.useProfile && secondGenerateConfig.profileName) {
        await triggerSlash(`/profile quiet=true ${secondGenerateConfig.profileName}`);
        console.log(`[${SCRIPT_NAME}] 已切换到连接配置: ${secondGenerateConfig.profileName}`);
        await new Promise(r => setTimeout(r, 300));
      }

      if (secondGenerateConfig.useModel && secondGenerateConfig.modelName) {
        await triggerSlash(`/model quiet=true ${secondGenerateConfig.modelName}`);
        console.log(`[${SCRIPT_NAME}] 已切换到模型: ${secondGenerateConfig.modelName}`);
        await new Promise(r => setTimeout(r, 300));
      }

      if (secondGenerateConfig.usePreset && secondGenerateConfig.presetName) {
        await triggerSlash(`/preset quiet=true ${secondGenerateConfig.presetName}`);
        console.log(`[${SCRIPT_NAME}] 已切换到预设: ${secondGenerateConfig.presetName}`);
        await new Promise(r => setTimeout(r, 300));
      }

      enhancedModeState.isSecondGeneration = true;

      if (_updateGeneratingStatusRef) _updateGeneratingStatusRef('正在进行格式化转换...');

      const msgs = getChatMessages(numericMessageId, { include_swipes: true });
      if (!msgs || !msgs[0]) {
        throw new Error('无法获取目标消息');
      }
      const msg = msgs[0];
      const originalSwipeId = typeof msg.swipe_id === 'number' ? msg.swipe_id : 0;
      const currentSwipes = msg.swipes || [msg.message];
      const newSwipes = [...currentSwipes, ''];
      const newSwipeId = newSwipes.length - 1;

      const updateData = { ...msg };
      updateData.swipes = newSwipes;
      updateData.swipe_id = newSwipeId;
      await setChatMessages([updateData], { refresh: 'affected' });
      console.log(`[${SCRIPT_NAME}] 加强模式: 已添加并切换到 swipe[${newSwipeId}]`);

      const streamHandler = text => {
        streamBuffer = text || '';
        const now = Date.now();
        if (now - lastStreamUpdate >= STREAM_INTERVAL) {
          updateStreamingSwipe(numericMessageId, newSwipeId, streamBuffer);
          lastStreamUpdate = now;
        }
      };

      const { formattedText: formattedResult } = await convertTextToCotFormat(firstResult, {
        onStream: streamHandler,
      });

      if (streamBuffer) {
        await updateStreamingSwipe(numericMessageId, newSwipeId, streamBuffer);
      }

      console.log(`[${SCRIPT_NAME}] 加强模式: 第二次生成完成, 长度=${formattedResult?.length || 0}`);
      enhancedModeState.formattedResult = formattedResult;

      if (formattedResult) {
        const updatedMsgs = getChatMessages(numericMessageId, { include_swipes: true });
        if (updatedMsgs && updatedMsgs[0]) {
          const updatedSwipes = [...updatedMsgs[0].swipes];
          updatedSwipes[newSwipeId] = formattedResult;
          const updatedSwipesInfo = [...(updatedMsgs[0].swipes_info || [])];
          updatedSwipesInfo[newSwipeId] = {
            ...(updatedSwipesInfo[newSwipeId] || {}),
            isEnhancedFormat: true,
            enhancedModeGeneratedAt: Date.now(),
          };

          const finalUpdateData = { ...updatedMsgs[0] };
          finalUpdateData.swipes = updatedSwipes;
          finalUpdateData.swipes_info = updatedSwipesInfo;
          finalUpdateData.swipe_id = newSwipeId;

          await setChatMessages([finalUpdateData], { refresh: 'affected' });
          console.log(`[${SCRIPT_NAME}] 加强模式: 已最终更新 swipe[${newSwipeId}]`);
        }
      }

      if (originalSwipeId !== newSwipeId) {
        const currentMsgs = getChatMessages(numericMessageId, { include_swipes: true });
        if (currentMsgs && currentMsgs[0]) {
          const switchData = { ...currentMsgs[0] };
          switchData.swipe_id = originalSwipeId;
          await setChatMessages([switchData], { refresh: 'affected' });
          console.log(`[${SCRIPT_NAME}] 加强模式: 已切回原始 swipe[${originalSwipeId}]`);
        }
      }

      if (formattedResult && _updateGlobalOverlayContentRef) {
        const parsedFormatted = parseGalgameContent(formattedResult);
        if (parsedFormatted.segments.length > 0) {
          await _updateGlobalOverlayContentRef(numericMessageId, parsedFormatted);
          console.log(`[${SCRIPT_NAME}] 加强模式: 已显示格式化内容给用户`);
        }
      }

      enhancedModeState.stage = 'second_done';
      showEnhancedProgress('second_done');
    } finally {
      await restoreOriginalConfig();
      console.log(`[${SCRIPT_NAME}] 加强模式: 第二次生成完成，已恢复原始配置`);
    }
  } catch (e) {
    console.error(`[${SCRIPT_NAME}] 加强模式第二次生成失败:`, e);
    showToast('格式化处理失败: ' + e.message);
    await restoreOriginalConfig();
  } finally {
    resetEnhancedModeState();
  }
}

// ============================================
// 世界书注入监听器
// ============================================
let worldbookInjectionListenerRegistered = false;

export function initWorldbookInjectionListener() {
  if (worldbookInjectionListenerRegistered) {
    console.log(`[${SCRIPT_NAME}] 世界书注入监听器已注册，跳过`);
    return;
  }

  if (typeof eventOn === 'function' && typeof tavern_events !== 'undefined') {
    // 生成开始时
    eventOn(tavern_events.GENERATION_STARTED, async () => {
      const currentSettings = getSettings();
      const isEnabled = getIsEnabled();

      if (!isEnabled) {
        console.log(`[${SCRIPT_NAME}] 世界书注入: Galgame模式未开启，跳过`);
        return;
      }

      if (enhancedModeState.isSecondGeneration) {
        console.log(`[${SCRIPT_NAME}] 世界书注入: 第二次生成，跳过`);
        return;
      }

      if (currentSettings.enhancedMode?.enabled) {
        console.log(`[${SCRIPT_NAME}] 世界书注入: 加强模式第一次生成，确保不附加脚本世界书`);
        try {
          const globalWbs = getGlobalWorldbookNames();
          if (globalWbs.includes(WORLDBOOK_NAME)) {
            worldbookInjectionState.originalWorldbooks = [...globalWbs];
            worldbookInjectionState.isInjected = true;
            const newWbs = globalWbs.filter(name => name !== WORLDBOOK_NAME);
            await rebindGlobalWorldbooks(newWbs);
            console.log(`[${SCRIPT_NAME}] 世界书注入: 已临时移除脚本世界书`);
          }
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] 移除世界书失败:`, e);
        }
        return;
      }

      // 普通模式：临时附加脚本世界书
      console.log(`[${SCRIPT_NAME}] 世界书注入: 普通模式，临时附加脚本世界书`);
      try {
        const globalWbs = getGlobalWorldbookNames();
        worldbookInjectionState.originalWorldbooks = [...globalWbs];
        if (!globalWbs.includes(WORLDBOOK_NAME)) {
          await rebindGlobalWorldbooks([...globalWbs, WORLDBOOK_NAME]);
          worldbookInjectionState.isInjected = true;
          console.log(`[${SCRIPT_NAME}] 世界书注入: 已临时附加脚本世界书`);
        } else {
          worldbookInjectionState.isInjected = false;
          console.log(`[${SCRIPT_NAME}] 世界书注入: 脚本世界书已存在，无需附加`);
        }
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] 附加世界书失败:`, e);
      }
    });

    // 生成结束时恢复
    eventOn(tavern_events.GENERATION_ENDED, async () => {
      if (enhancedModeState.isSecondGeneration) {
        return;
      }

      if (worldbookInjectionState.isInjected && worldbookInjectionState.originalWorldbooks !== null) {
        try {
          await rebindGlobalWorldbooks(worldbookInjectionState.originalWorldbooks);
          console.log(`[${SCRIPT_NAME}] 世界书注入: 已恢复原始配置`);
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] 恢复世界书失败:`, e);
        }
        worldbookInjectionState.isInjected = false;
        worldbookInjectionState.originalWorldbooks = null;
      }
    });

    // 生成开始/结束事件监听（用于生成状态跟踪）
    eventOn(tavern_events.GENERATION_STARTED, () => {
      const timeSinceInit = Date.now() - getInitializationTime();
      if (timeSinceInit < 3000) {
        console.log(`[${SCRIPT_NAME}] GENERATION_STARTED 被忽略（页面刚加载 ${timeSinceInit}ms）`);
        return;
      }

      setIsGeneratingResponse(true);
      const generationState = getGenerationState();
      generationState.isGenerating = true;
      generationState.startTime = Date.now();
      console.log(`[${SCRIPT_NAME}] GENERATION_STARTED - isGeneratingResponse = true`);
      startGenerationTimeout();
      if (_updateNextBtnForGeneratingStateRef) _updateNextBtnForGeneratingStateRef();
    });

    eventOn(tavern_events.GENERATION_ENDED, () => {
      console.log(`[${SCRIPT_NAME}] GENERATION_ENDED - 触发验证流程`);
      stopGenerationTimeout();
      setTimeout(() => {
        if (checkSillyTavernGenerating()) {
          console.log(`[${SCRIPT_NAME}] GENERATION_ENDED 后 SillyTavern 仍在生成，继续等待`);
          return;
        }
        if (getIsGeneratingResponse()) {
          console.log(`[${SCRIPT_NAME}] GENERATION_ENDED 后未收到消息验证，主动重置`);
          resetGenerationState('GENERATION_ENDED 后主动验证');
        }
      }, getVerificationDelayMs() * 2);
    });

    worldbookInjectionListenerRegistered = true;
    console.log(`[${SCRIPT_NAME}] 世界书按需附加监听器已注册`);
  } else {
    console.warn(`[${SCRIPT_NAME}] 无法注册世界书注入监听器`);
  }
}

// ============================================
// 加强模式监听器
// ============================================
let enhancedModeListenerRegistered = false;

function resolveGenerationMessageId(eventPayload) {
  const tryParseId = value => {
    const id = Number(value);
    return Number.isInteger(id) && id >= 0 ? id : null;
  };

  let messageId = tryParseId(eventPayload);
  if (messageId !== null) return messageId;

  if (eventPayload && typeof eventPayload === 'object') {
    messageId =
      tryParseId(eventPayload.message_id) ??
      tryParseId(eventPayload.messageId) ??
      tryParseId(eventPayload.id);
    if (messageId !== null) return messageId;
  }

  try {
    const latestAssistant = getChatMessages(-1, { role: 'assistant', include_swipes: true });
    const fallbackMessage = latestAssistant?.[0];
    messageId = tryParseId(fallbackMessage?.message_id);
    if (messageId !== null) {
      console.log(`[${SCRIPT_NAME}] 加强模式: 使用最新助手消息兜底 messageId=${messageId}`);
      return messageId;
    }
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 加强模式: 兜底获取 messageId 失败`, e);
  }

  return null;
}

async function getMessageByIdWithRetry(messageId, maxRetries = 8, retryDelayMs = 120) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const messages = getChatMessages(messageId, { include_swipes: true });
      const message = messages?.[0];
      if (message) {
        return message;
      }
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 加强模式: 第 ${attempt + 1} 次获取消息失败`, e);
    }
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, retryDelayMs));
    }
  }
  return null;
}

export function initEnhancedModeListener() {
  if (enhancedModeListenerRegistered) {
    console.log(`[${SCRIPT_NAME}] 加强模式: 监听器已注册，跳过`);
    return;
  }

  if (typeof eventOn === 'function' && typeof tavern_events !== 'undefined' && tavern_events.GENERATION_ENDED) {
    eventOn(tavern_events.GENERATION_ENDED, async eventPayload => {
      const messageId = resolveGenerationMessageId(eventPayload);
      const isEnabled = getIsEnabled();
      console.log(`[${SCRIPT_NAME}] 加强模式: 收到 GENERATION_ENDED 事件, messageId=${messageId}`, eventPayload);
      if (messageId === null) {
        console.warn(`[${SCRIPT_NAME}] 加强模式: 无法解析 messageId，跳过本次`);
        return;
      }

      const enhancedConfig = ensureEnhancedModeSettings();
      if (!isEnabled || !enhancedConfig.enabled) {
        console.log(`[${SCRIPT_NAME}] 加强模式: 未启用或Galgame模式关闭，跳过`);
        return;
      }

      if (enhancedModeState.isSecondGeneration) {
        console.log(`[${SCRIPT_NAME}] 加强模式: 第二次生成完成，清理状态`);
        enhancedModeState.isSecondGeneration = false;
        return;
      }

      if (enhancedModeState.isActive && enhancedModeState.stage === 'second_generating') {
        console.log(`[${SCRIPT_NAME}] 加强模式: 当前阶段=${enhancedModeState.stage}，跳过`);
        return;
      }

      try {
        const message = await getMessageByIdWithRetry(messageId);
        if (!message) {
          console.warn(`[${SCRIPT_NAME}] 加强模式: 无法获取消息 ${messageId}`);
          return;
        }

        if (message.role && message.role !== 'assistant') {
          console.log(`[${SCRIPT_NAME}] 加强模式: 非 assistant 消息，跳过`);
          return;
        }

        const hasEnhancedFormatSwipe = (message.swipes_info || []).some(info => info?.isEnhancedFormat === true);
        if (hasEnhancedFormatSwipe) {
          console.log(`[${SCRIPT_NAME}] 加强模式: 已存在 isEnhancedFormat swipe，跳过`);
          return;
        }

        const currentSwipeId = typeof message.swipe_id === 'number' ? message.swipe_id : 0;
        const firstResult = message.swipes?.[currentSwipeId] || message.message;
        if (!firstResult || !firstResult.trim()) {
          console.warn(`[${SCRIPT_NAME}] 加强模式: 消息内容为空`);
          return;
        }

        if (isCotFormatted(firstResult)) {
          console.log(`[${SCRIPT_NAME}] 加强模式: 当前内容已是 COT，仍执行第二次生成`);
        }

        console.log(`[${SCRIPT_NAME}] 加强模式: 第一次生成完成，内容长度=${firstResult.length}`);

        enhancedModeState.isActive = true;
        enhancedModeState.stage = 'first_done';
        enhancedModeState.firstResult = firstResult;
        enhancedModeState.targetMessageId = messageId;

        showEnhancedProgress('first_done');

        console.log(`[${SCRIPT_NAME}] 加强模式: 第一次生成完成，准备第二次生成`);

        await new Promise(r => setTimeout(r, 500));

        setTimeout(() => {
          runSecondGeneration(messageId, firstResult);
        }, 0);
      } catch (e) {
        console.error(`[${SCRIPT_NAME}] 加强模式处理失败:`, e);
        showToast('加强模式失败: ' + e.message);
        resetEnhancedModeState();
      }
    });

    enhancedModeListenerRegistered = true;
    console.log(`[${SCRIPT_NAME}] 加强模式: GENERATION_ENDED 事件监听已注册`);
  } else {
    console.warn(
      `[${SCRIPT_NAME}] 加强模式: 无法注册事件监听，eventOn=${typeof eventOn}, tavern_events=${typeof tavern_events}`,
    );
  }
}

// 测试函数
export function registerTestFunctions() {
  topWindow.testAddSwipeNoRefresh = async function () {
    const _$ = topWindow.jQuery || window.jQuery;
    try {
      const $lastMes = _$(topWindow.document).find('#chat > .mes').last();
      const messageId = parseInt($lastMes.attr('mesid'));
      if (isNaN(messageId)) {
        console.log('没有找到消息');
        return;
      }
      console.log('[测试] 目标消息ID:', messageId);

      const messages = getChatMessages(messageId, { include_swipes: true });
      if (!messages || !messages[0]) {
        console.log('[测试] getChatMessages 失败');
        return;
      }

      const msg = messages[0];
      console.log('[测试] 当前 swipes 数量:', msg.swipes?.length || 1);
      console.log('[测试] 当前 swipe_id:', msg.swipe_id);

      const newSwipes = [...(msg.swipes || [msg.message]), '测试内容-' + Date.now()];

      await setChatMessages(
        [{ message_id: messageId, swipes: newSwipes }],
        { refresh: 'none' },
      );

      console.log('[测试] 已添加 swipe，新 swipes 数量:', newSwipes.length);

      const updated = getChatMessages(messageId, { include_swipes: true });
      console.log('[测试] 验证成功，swipes 数量:', updated[0]?.swipes?.length);
      showToast('测试成功！swipes: ' + updated[0]?.swipes?.length);
    } catch (e) {
      console.error('[测试] 失败:', e);
      showToast('测试失败: ' + e.message);
    }
  };
  console.log(`[${SCRIPT_NAME}] 测试函数已注册: window.testAddSwipeNoRefresh()`);
}
