import { SCRIPT_NAME } from '../core/constants.js';
import { getTavernContext, topWindow } from '../core/env.js';
import { ensureEnhancedModeSettings, getSettings, SYSTEM_PROMPT_FOR_SECOND_GENERATE } from '../core/settings.js';
import { getIsEnabled } from '../core/state.js';
import { GalgameStore } from '../core/store.js';
import { generateCOTTemplate } from './cot-template.js';
import {
    clearStreamingDraft,
    getEnhancedFormatRecord,
    getEnhancedFormattedText,
    getMessageSourceSnapshot,
    hasStaleEnhancedFormatRecord,
    saveEnhancedFormatRecord,
    setStreamingDraft,
} from './enhanced-format-store.js';
import { describeLlmConfig, requestWithConnectionProfile } from './enhanced-llm.js';
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
import { getPendingSpecialCg } from './special-cg-trigger.js';

// ============================================
// 加强模式
// ============================================
// 第一次生成：AI 专注创作，正文保持原样写入酒馆；
// 第二次生成：把正文转换为 Galgame 格式，结果只存到楼层 extra（见 enhanced-format-store.js），
// 仅在 Galgame 界面中显示，不修改酒馆正文和 swipe。

const WORLDBOOK_NAME = 'galgame界面插件';
const COT_ENTRY_NAME = 'Galgame输出格式规范';

const enhancedModeState = GalgameStore.enhancedMode;
const worldbookInjectionState = GalgameStore.worldbookInjection;

// 延迟引用
let _showToastRef = null;
let _updateNextBtnForGeneratingStateRef = null;
let _showGeneratingIndicatorRef = null;
let _processNewMessageRef = null;

export function setEnhancedModeRefs({
  showToast,
  updateNextBtnForGeneratingState,
  showGeneratingIndicator,
  processNewMessage,
}) {
  if (showToast) _showToastRef = showToast;
  if (updateNextBtnForGeneratingState) _updateNextBtnForGeneratingStateRef = updateNextBtnForGeneratingState;
  if (showGeneratingIndicator) _showGeneratingIndicatorRef = showGeneratingIndicator;
  if (processNewMessage) _processNewMessageRef = processNewMessage;
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
  const cotIndicators = [/<background\b[^>]*\bscene=/i, /<sprite\s+/i, /<bgm>/i, /<maintext>/i, /<p\s+tts=/i];
  return cotIndicators.some(pattern => pattern.test(content));
}

/**
 * 获取格式化版本内容：优先读取加强模式保存在楼层 extra 上的记录（含第二次生成的流式草稿），
 * 其次兼容旧版写入 swipe 的格式化版本
 */
export function getFormattedContent(messageId) {
  const enhancedText = getEnhancedFormattedText(messageId);
  if (enhancedText) {
    return { formatted: enhancedText, source: 'extra' };
  }
  return getLegacyFormattedSwipe(messageId);
}

function getLegacyFormattedSwipe(messageId) {
  const messages = getChatMessages(messageId, { include_swipes: true });
  const message = messages[0];
  if (!message || !message.swipes || message.swipes.length < 2) {
    return null;
  }
  const swipes = message.swipes;
  const swipesInfo = message.swipes_info || [];

  for (let i = 1; i < swipes.length; i++) {
    const info = swipesInfo[i] || {};
    if (info.isEnhancedFormat === true || (info.isEnhancedFormat !== false && isCotFormatted(swipes[i]))) {
      return {
        formatted: swipes[i],
        formattedIndex: i,
        source: 'swipe',
      };
    }
  }
  return null;
}

/**
 * 显示生成进度
 */
function showEnhancedProgress(stage, detail = '') {
  const messages = {
    first_done: { icon: 'fa-check', text: '第一次生成完成', sub: '准备格式化...' },
    second_generating: { icon: 'fa-wand-magic-sparkles', text: '第二次生成（格式化）', sub: detail || '正在格式化...' },
    second_done: { icon: 'fa-check-double', text: '加强模式完成', sub: '格式化文本仅在 Galgame 界面中显示' },
  };
  const msg = messages[stage];
  if (!msg) return;
  const esc = str => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  showToast(
    `<i class="fa-solid ${msg.icon}" style="color: #ff9800;"></i> <b>${msg.text}</b><br><small>${esc(msg.sub)}</small>`,
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
}

// ============================================
// COT 格式转换
// ============================================
function createGenerationId() {
  return `galgame-cot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// 使用酒馆当前 API 生成（generate / generateRaw）
async function generateWithTavern({ independent, systemPrompt, userPrompt, onStream, sendWorldbook }) {
  const generationId = createGenerationId();
  const previousSecondGenerationState = enhancedModeState.isSecondGeneration;
  let stopStreamListener = null;

  try {
    // 让世界书注入 / 加强模式监听器忽略本次生成触发的酒馆事件
    enhancedModeState.isSecondGeneration = true;

    if (onStream && typeof eventOn === 'function' && typeof iframe_events !== 'undefined') {
      const handle = eventOn(iframe_events.STREAM_TOKEN_RECEIVED_FULLY, (text, id) => {
        // 只接收本次请求的流式输出（旧版酒馆助手不传 generation_id 时不过滤）
        if (id !== undefined && id !== generationId) return;
        onStream(typeof text === 'string' ? text : '');
      });
      if (handle && typeof handle.stop === 'function') {
        stopStreamListener = () => handle.stop();
      }
    }

    if (independent) {
      // 独立模式：仅发送 system prompt + user input，完全不受预设/世界书/聊天历史影响
      return await generateRaw({
        generation_id: generationId,
        user_input: userPrompt,
        should_silence: true,
        should_stream: true,
        ordered_prompts: [
          { role: 'system', content: systemPrompt },
          'user_input',
        ],
      });
    }

    // 预设模式：使用当前预设，排除聊天历史与按深度插入的世界书条目；
    // 不发送世界书时再清空「角色定义之前/之后」位置的世界书
    return await generate({
      generation_id: generationId,
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
        ...(sendWorldbook ? {} : { world_info_before: '', world_info_after: '' }),
      },
    });
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

// 按原文扫描当前激活的世界书（dry run：不触发激活事件、不改变粘性/冷却计时）。
// 只取「角色定义之前/之后」位置的条目，与跟随酒馆模式排除深度条目的行为一致，
// 也避开了脚本世界书中按深度插入的格式规范条目
async function collectWorldbookPrompt(sourceText) {
  const ctx = getTavernContext();
  if (typeof ctx?.getWorldInfoPrompt !== 'function') {
    console.warn(`[${SCRIPT_NAME}] 当前酒馆版本不支持读取世界书，第二次生成不附带世界书`);
    return '';
  }
  try {
    const maxContext = Number(ctx.maxContext) > 0 ? Number(ctx.maxContext) : 8192;
    const result = await ctx.getWorldInfoPrompt([sourceText], maxContext, true);
    return [result?.worldInfoBefore, result?.worldInfoAfter]
      .map(text => String(text || '').trim())
      .filter(Boolean)
      .join('\n\n');
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 读取世界书失败，第二次生成不附带世界书:`, e);
    return '';
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
 * @param {object|null} [options.llm] 使用酒馆连接配置独立请求（加强模式自定义 LLM），
 *   `{ profileId, profileName, model, maxTokens }`；设置后忽略 independent，仅发送 system + user。
 * @param {boolean} [options.sendWorldbook=false] 是否附带世界书内容（独立模式下忽略）
 */
export async function convertTextToCotFormat(sourceText, options = {}) {
  const normalizedSource = String(sourceText || '').trim();
  if (!normalizedSource) {
    throw new Error('待转换文本为空');
  }

  const independent = !!options.independent;
  const llm = options.llm || null;
  const sendWorldbook = !independent && !!options.sendWorldbook;
  const onStream = typeof options.onStream === 'function' ? options.onStream : null;
  let latestStreamText = '';
  const streamHandler = onStream
    ? text => {
      latestStreamText = text;
      onStream(text);
    }
    : null;

  const pendingSpecialCg = await getPendingSpecialCg();
  const cotTemplate = await generateCOTTemplate({ pendingSpecialCg });
  const systemPrompt = `${SYSTEM_PROMPT_FOR_SECOND_GENERATE}\n\n${cotTemplate}`;
  const userPrompt = `请将以下内容转换为标准Galgame格式：\n\n${normalizedSource}`;
  const llmLabel = describeLlmConfig(llm);
  const worldbookPrompt = llm && sendWorldbook ? await collectWorldbookPrompt(normalizedSource) : '';

  enhancedModeState.lastPrompts = {
    systemPrompt,
    userPrompt,
    firstResult: normalizedSource,
    llmLabel,
    sendWorldbook,
    worldbookPrompt,
    timestamp: new Date().toLocaleString('zh-CN'),
  };
  const modeLabel = llm ? '连接配置(加强模式)' : independent ? '独立(开场白)' : '预设(加强模式)';
  console.log(`[${SCRIPT_NAME}] COT转换: 模式=${modeLabel}, LLM=${llmLabel}, 世界书=${sendWorldbook ? '发送' : '不发送'}`);

  const formattedText = llm
    ? await requestWithConnectionProfile({
      ...llm,
      messages: [
        ...(worldbookPrompt
          ? [{ role: 'system', content: `【世界书参考资料】以下设定仅用于识别角色、地点等名称，不要据此添加任何剧情：\n${worldbookPrompt}` }]
          : []),
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      onStream: streamHandler,
    })
    : await generateWithTavern({ independent, systemPrompt, userPrompt, onStream: streamHandler, sendWorldbook });

  const safeFormattedText = typeof formattedText === 'string' ? formattedText : String(formattedText || '');
  if (onStream && safeFormattedText && latestStreamText !== safeFormattedText) {
    onStream(safeFormattedText);
  }

  return {
    formattedText: safeFormattedText,
    systemPrompt,
    userPrompt,
  };
}

// ============================================
// 第二次生成
// ============================================
const STREAM_REFRESH_INTERVAL = 400;

async function refreshMessageInOverlay(messageId, options) {
  if (!getIsEnabled() || !_processNewMessageRef) return;
  const mesNode = topWindow.document.querySelector(`#chat > .mes[mesid="${messageId}"]`);
  if (!mesNode) return;
  try {
    await _processNewMessageRef(mesNode, options);
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 加强模式: 刷新 Galgame 界面失败`, e);
  }
}

function showFormattingIndicator(options) {
  if (!getIsEnabled() || !_showGeneratingIndicatorRef) return;
  if (!topWindow.document.querySelector('#gal-global-overlay.active')) return;
  _showGeneratingIndicatorRef('正在进行格式化转换...', options);
}

// 流式期间节流刷新 Galgame 界面（正文不再随流式写入楼层，不会触发楼层 DOM 监听，需主动刷新）
function createOverlayRefresher(messageId) {
  let timer = null;
  let inFlight = null;
  let pending = false;
  let stopped = false;
  let lastRun = 0;

  const run = async () => {
    timer = null;
    if (stopped) return;
    if (inFlight) {
      pending = true;
      return;
    }
    lastRun = Date.now();
    inFlight = refreshMessageInOverlay(messageId, { keepPresentedSegment: true, streaming: true }).then(() => {
      // 渲染完成会收起「生成中」指示器，格式化仍在进行时重新打开；此时台词已是流式草稿，不再淡化
      if (!stopped) showFormattingIndicator({ live: true });
    });
    await inFlight;
    inFlight = null;
    if (pending && !stopped) {
      pending = false;
      schedule();
    }
  };

  const schedule = () => {
    if (timer || stopped) return;
    timer = setTimeout(run, Math.max(0, STREAM_REFRESH_INTERVAL - (Date.now() - lastRun)));
  };

  const stop = () => {
    stopped = true;
    pending = false;
    if (timer) clearTimeout(timer);
    timer = null;
    return inFlight || Promise.resolve();
  };

  return { schedule, stop };
}

function resolveSecondGenerateLlm(secondGenerate) {
  if (secondGenerate?.llmSource !== 'profile') return null;
  if (!secondGenerate.profileId && !secondGenerate.profileName) {
    throw new Error('已选择「使用酒馆连接配置」，但尚未选择连接配置');
  }
  return {
    profileId: secondGenerate.profileId,
    profileName: secondGenerate.profileName,
    model: secondGenerate.model,
    maxTokens: secondGenerate.maxTokens,
  };
}

async function runSecondGeneration(messageId) {
  const snapshot = getMessageSourceSnapshot(messageId);
  if (!snapshot) return;

  enhancedModeState.isActive = true;
  enhancedModeState.stage = 'second_generating';
  enhancedModeState.targetMessageId = snapshot.mesId;
  enhancedModeState.firstResult = snapshot.text;

  const refresher = createOverlayRefresher(snapshot.mesId);
  try {
    const secondGenerate = ensureEnhancedModeSettings().secondGenerate;
    const llm = resolveSecondGenerateLlm(secondGenerate);
    const llmLabel = describeLlmConfig(llm);
    console.log(`[${SCRIPT_NAME}] 加强模式: 开始第二次生成（楼层 ${snapshot.mesId} swipe[${snapshot.swipeId}]，${llmLabel}）`);
    showEnhancedProgress('second_generating', llmLabel);
    showFormattingIndicator();

    const { formattedText } = await convertTextToCotFormat(snapshot.text, {
      llm,
      sendWorldbook: secondGenerate.sendWorldbook,
      onStream: text => {
        setStreamingDraft(snapshot, text);
        refresher.schedule();
      },
    });
    if (!formattedText.trim()) {
      throw new Error('格式化结果为空');
    }

    console.log(`[${SCRIPT_NAME}] 加强模式: 第二次生成完成, 长度=${formattedText.length}`);
    enhancedModeState.formattedResult = formattedText;
    const saved = await saveEnhancedFormatRecord(snapshot, formattedText, { llm: llmLabel });
    if (saved) {
      enhancedModeState.stage = 'second_done';
      showEnhancedProgress('second_done');
    } else {
      showToast('原文已变化或已切换到其他回复，本次格式化结果未保存');
    }
  } catch (e) {
    console.error(`[${SCRIPT_NAME}] 加强模式第二次生成失败:`, e);
    const reason = String(e?.message || e).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    showToast(`格式化处理失败: ${reason}`);
  } finally {
    await refresher.stop();
    clearStreamingDraft(snapshot.mesId);
    // 成功则显示已保存的格式化文本；失败则回退显示原文，避免停留在半截的流式内容上
    await refreshMessageInOverlay(snapshot.mesId, { forceRender: true, keepPresentedSegment: true });
    resetEnhancedModeState();
  }
}

// ============================================
// 格式化任务队列（同一时间只跑一个第二次生成）
// ============================================
const formatQueue = [];

function getFormatSkipReason(messageId) {
  if (!getIsEnabled()) return 'Galgame模式关闭';
  if (!ensureEnhancedModeSettings().enabled) return '加强模式未启用';
  const snapshot = getMessageSourceSnapshot(messageId);
  if (!snapshot) return '楼层不存在';
  if (snapshot.role !== 'assistant') return '非 assistant 消息';
  if (!snapshot.text.trim()) return '消息内容为空';
  if (getEnhancedFormatRecord(messageId)) return '当前回复已有格式化结果';
  return null;
}

function enqueueFormatJob(messageId) {
  if (enhancedModeState.isActive) {
    if (!formatQueue.includes(messageId)) formatQueue.push(messageId);
    console.log(`[${SCRIPT_NAME}] 加强模式: 楼层 ${messageId} 已排队，等待当前格式化完成`);
    return;
  }

  const skipReason = getFormatSkipReason(messageId);
  if (skipReason) {
    console.log(`[${SCRIPT_NAME}] 加强模式: 跳过楼层 ${messageId}（${skipReason}）`);
    runNextQueuedFormatJob();
    return;
  }

  runSecondGeneration(messageId).finally(runNextQueuedFormatJob);
}

function runNextQueuedFormatJob() {
  const nextMessageId = formatQueue.shift();
  if (nextMessageId !== undefined) enqueueFormatJob(nextMessageId);
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
    // 事件参数: (type, option, dry_run)。dry run（切角色/切预设时的 token 计算）和
    // quiet 后台静默生成（总结/数据库等插件调用）不是真实的对话生成，必须跳过，
    // 否则会误改全局世界书且等不到配对的 GENERATION_ENDED 来恢复
    eventOn(tavern_events.GENERATION_STARTED, async (type, option, dry_run) => {
      if (dry_run) {
        console.log(`[${SCRIPT_NAME}] 世界书注入: dry run，跳过`);
        return;
      }
      if (type === 'quiet' && !option?.quietToLoud) {
        console.log(`[${SCRIPT_NAME}] 世界书注入: 后台静默生成，跳过`);
        return;
      }

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
        if (!globalWbs.includes(WORLDBOOK_NAME)) {
          worldbookInjectionState.originalWorldbooks = [...globalWbs];
          await rebindGlobalWorldbooks([...globalWbs, WORLDBOOK_NAME]);
          worldbookInjectionState.isInjected = true;
          console.log(`[${SCRIPT_NAME}] 世界书注入: 已临时附加脚本世界书`);
        } else if (worldbookInjectionState.isInjected && worldbookInjectionState.originalWorldbooks !== null) {
          // 上次生成中断导致的挂载残留：保留已保存的原始列表，本次生成结束后照常恢复
          console.log(`[${SCRIPT_NAME}] 世界书注入: 检测到中断残留的脚本世界书，本次生成结束后恢复`);
        } else {
          worldbookInjectionState.isInjected = false;
          worldbookInjectionState.originalWorldbooks = null;
          console.log(`[${SCRIPT_NAME}] 世界书注入: 脚本世界书已存在，无需附加`);
        }
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] 附加世界书失败:`, e);
      }
    });

    // 生成结束/中断时恢复（手动停止或生成出错时只会触发 GENERATION_STOPPED，不能只依赖 GENERATION_ENDED）
    const restoreInjectedWorldbooks = async () => {
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
    };
    eventOn(tavern_events.GENERATION_ENDED, restoreInjectedWorldbooks);
    eventOn(tavern_events.GENERATION_STOPPED, restoreInjectedWorldbooks);

    // 生成开始/结束事件监听（用于生成状态跟踪）
    // 同样过滤 dry run 和 quiet 后台生成：它们会触发 GENERATION_STARTED 但没有对应的
    // 对话消息，导致"生成中"图标误显示并挂到 120s 超时才消失
    eventOn(tavern_events.GENERATION_STARTED, (type, option, dry_run) => {
      if (dry_run) {
        console.log(`[${SCRIPT_NAME}] GENERATION_STARTED 被忽略（dry run）`);
        return;
      }
      if (type === 'quiet' && !option?.quietToLoud) {
        console.log(`[${SCRIPT_NAME}] GENERATION_STARTED 被忽略（后台静默生成 type=quiet）`);
        return;
      }

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
      // 覆盖层激活时立即显示生成中占位，不必等第一个闭合段落解析出来
      if (getIsEnabled() && _showGeneratingIndicatorRef && topWindow.document.querySelector('#gal-global-overlay.active')) {
        _showGeneratingIndicatorRef('正在生成内容...');
      }
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
      console.log(`[${SCRIPT_NAME}] 加强模式: 收到 GENERATION_ENDED 事件`, eventPayload);
      if (!getIsEnabled() || !ensureEnhancedModeSettings().enabled) {
        console.log(`[${SCRIPT_NAME}] 加强模式: 未启用或Galgame模式关闭，跳过`);
        return;
      }

      if (enhancedModeState.isSecondGeneration) {
        console.log(`[${SCRIPT_NAME}] 加强模式: 第二次生成自身触发的结束事件，跳过`);
        return;
      }

      const payloadMessageId = resolveGenerationMessageId(eventPayload);
      if (payloadMessageId === null) {
        console.warn(`[${SCRIPT_NAME}] 加强模式: 无法解析 messageId，跳过本次`);
        return;
      }

      try {
        // 酒馆传入的是 chat.length；getChatMessages 会把越界楼层号钳到最后一楼，这里取其真实楼层号
        const message = await getMessageByIdWithRetry(payloadMessageId);
        const messageId = Number.isInteger(message?.message_id) ? message.message_id : null;
        if (messageId === null) {
          console.warn(`[${SCRIPT_NAME}] 加强模式: 无法获取消息 ${payloadMessageId}`);
          return;
        }

        const skipReason = getFormatSkipReason(messageId);
        if (skipReason) {
          console.log(`[${SCRIPT_NAME}] 加强模式: 跳过楼层 ${messageId}（${skipReason}）`);
          return;
        }

        console.log(`[${SCRIPT_NAME}] 加强模式: 第一次生成完成，楼层 ${messageId} 准备第二次生成`);
        showEnhancedProgress('first_done');

        // 留出时间给其他脚本完成对新楼层的后处理；原文快照在任务真正开始时才读取
        await new Promise(r => setTimeout(r, 500));
        enqueueFormatJob(messageId);
      } catch (e) {
        console.error(`[${SCRIPT_NAME}] 加强模式处理失败:`, e);
        showToast('加强模式失败: ' + e.message);
      }
    });

    // 已格式化的回复被编辑后，旧的格式化结果失效，按新正文重新格式化
    if (tavern_events.MESSAGE_EDITED) {
      eventOn(tavern_events.MESSAGE_EDITED, messageId => {
        const id = Number(messageId);
        if (!Number.isInteger(id) || id < 0) return;
        if (!getIsEnabled() || !ensureEnhancedModeSettings().enabled) return;
        // 只处理编辑前已有格式化结果的回复，避免编辑未格式化的旧楼层时触发额外请求
        if (!hasStaleEnhancedFormatRecord(id)) return;
        console.log(`[${SCRIPT_NAME}] 加强模式: 楼层 ${id} 正文已编辑，重新格式化`);
        enqueueFormatJob(id);
      });
    }

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
