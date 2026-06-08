import { SCRIPT_NAME } from '../core/constants.js';
import { $, topWindow } from '../core/env.js';
import { GalgameStore } from '../core/store.js';
import {
  forceForkAndTrimToMessage,
  forkAndTrimToMessage,
  isSameChatId,
  prepareLoadEnvironment,
  renderOverlayAtMessage,
  resolveCurrentChatId,
  safeGetLastMessageId,
  switchToTargetChat,
  waitFor,
} from '../save-load/manager.js';
import { markTimelineCacheDirty } from './data.js';
import { showInAppPromptDialog } from '../ui/asset-io.js';
import { triggerReroll } from '../ui/interaction.js';
import { setCurrentDisplayMesId } from '../ui/overlay.js';
import { showToast } from '../ui/toast.js';

function buildSwitchTarget(node, session) {
  return {
    id: `timeline_${Date.now()}`,
    chatId: session.chatId,
    messageId: session.messageId,
    totalFloorCount: Math.max(session.totalMessages || 0, session.messageId + 1),
    segmentIndex: 0,
    messageHash: node?.type === 'message' ? String(node.contentHash || '') : '',
    nodeType: node.type,
  };
}

function scrollMessageIntoView(messageId) {
  const $chat = $('#chat');
  const $message = $chat.find(`.mes[mesid="${messageId}"]`);
  if (!$chat.length || !$message.length) return;
  const nextTop = Math.max(0, $chat.scrollTop() + $message.position().top - 24);
  $chat.stop(true, false).animate({ scrollTop: nextTop }, 180);
}

function getChatMessageRecord(messageId, options = {}) {
  try {
    const numericMessageId = Number.parseInt(String(messageId), 10);
    if (!Number.isFinite(numericMessageId) || numericMessageId < 0) return null;
    const messages = getChatMessages(numericMessageId, { include_swipes: !!options.includeSwipes });
    return Array.isArray(messages) ? messages[0] || null : null;
  } catch (error) {
    console.warn(`[${SCRIPT_NAME}] 读取聊天楼层失败:`, error);
    return null;
  }
}

function getChatMessageText(message) {
  if (!message || typeof message !== 'object') return '';
  if (typeof message.message === 'string') return message.message;
  if (typeof message.mes === 'string') return message.mes;
  return '';
}

function getTimelineUserInputText(node) {
  const content = typeof node?.content === 'string' ? node.content : '';
  if (content) return content;
  const preview = typeof node?.preview === 'string' ? node.preview : '';
  if (preview && preview !== '（空消息）') return preview;
  return '';
}

function invalidateTimelineNavigationCaches() {
  markTimelineCacheDirty();
  if (GalgameStore.cache.segments instanceof Map) {
    GalgameStore.cache.segments.clear();
  }
  if (GalgameStore.cache.parse instanceof Map) {
    GalgameStore.cache.parse.clear();
  }
  setCurrentDisplayMesId(null);
}

function canTriggerTimelineReroll() {
  const $regenerate = $(topWindow.document).find('#option_regenerate');
  return $regenerate.length > 0 || typeof topWindow?.SillyTavern?.Generate === 'function';
}

async function overwriteTimelineMessage(messageId, nextText) {
  const numericMessageId = Number.parseInt(String(messageId), 10);
  if (!Number.isFinite(numericMessageId) || numericMessageId < 0) {
    return { ok: false, reason: '目标楼层无效，无法改写消息' };
  }

  const message = getChatMessageRecord(numericMessageId, { includeSwipes: true });
  if (!message) {
    return { ok: false, reason: '未找到要改写的目标楼层' };
  }

  const updateData = {
    message_id: numericMessageId,
    message: String(nextText ?? ''),
  };
  const activeSwipeId = Number.parseInt(String(message?.swipe_id ?? -1), 10);
  if (Array.isArray(message?.swipes) && activeSwipeId >= 0 && activeSwipeId < message.swipes.length) {
    const nextSwipes = [...message.swipes];
    nextSwipes[activeSwipeId] = updateData.message;
    updateData.swipes = nextSwipes;
    updateData.swipe_id = activeSwipeId;
  }

  try {
    await setChatMessages([updateData], { refresh: 'affected' });
    await waitFor(() => getChatMessageText(getChatMessageRecord(numericMessageId, { includeSwipes: true })) === updateData.message, 1500, 50);
    invalidateTimelineNavigationCaches();
    return { ok: true, message: updateData.message };
  } catch (error) {
    console.error(`[${SCRIPT_NAME}] 改写历史 user input 失败:`, error);
    return { ok: false, reason: error?.message || '改写历史 user input 失败' };
  }
}

async function waitForTimelineReply(targetMessageId) {
  const numericTargetMessageId = Number.parseInt(String(targetMessageId), 10);
  const generated = await waitFor(() => {
    const latestMessageId = safeGetLastMessageId();
    if (latestMessageId <= numericTargetMessageId) return false;
    const latestMessage = getChatMessageRecord(latestMessageId, { includeSwipes: true });
    const role = String(latestMessage?.role || '').toLowerCase();
    return role === 'assistant' || role === 'system';
  }, 45000, 180);

  const latestMessageId = safeGetLastMessageId();
  if (!generated || latestMessageId <= numericTargetMessageId) {
    return { ok: false, reason: '等待自动续生超时' };
  }

  await waitFor(() => !!topWindow.document.querySelector(`.mes[mesid="${latestMessageId}"]`), 3000, 80);
  return { ok: true, messageId: latestMessageId };
}

async function ensureTimelineTargetReady(node, targetSession) {
  const targetMessageId = Math.max(0, Number.parseInt(String(targetSession.messageId), 10) || 0);
  const targetChatId = String(targetSession.chatId || targetSession.chatFile || '').trim();
  if (!targetChatId) {
    return { ok: false, reason: '目标节点缺少聊天文件信息' };
  }

  await prepareLoadEnvironment();

  const currentChatId = await resolveCurrentChatId();
  const shouldSwitchChat = !currentChatId || !isSameChatId(currentChatId, targetChatId);
  if (shouldSwitchChat) {
    const switched = await switchToTargetChat(targetChatId, buildSwitchTarget(node, targetSession));
    if (!switched) {
      return { ok: false, reason: '切换聊天失败' };
    }
  }

  const chatReady = await waitFor(() => safeGetLastMessageId() >= 0, shouldSwitchChat ? 1800 : 300, 50);
  const latestMessageId = safeGetLastMessageId();
  if (!chatReady && latestMessageId < 0) {
    return { ok: false, reason: '等待目标聊天加载超时' };
  }
  if (latestMessageId < 0) {
    return { ok: false, reason: '目标聊天暂无可导航消息' };
  }
  if (targetMessageId > latestMessageId) {
    return { ok: false, reason: '目标聊天楼层不足，无法定位该节点' };
  }

  return {
    ok: true,
    targetChatId,
    targetMessageId,
    latestMessageId,
    shouldSwitchChat,
  };
}

async function branchEditUserTimelineNode(node, targetSession) {
  const defaultText = getTimelineUserInputText(node);
  const editedText = await showInAppPromptDialog({
    title: '编辑历史输入',
    message: '将基于这条 user input 创建新分支，并自动续生后续 AI 回复。',
    hint: '取消不会创建分支，也不会改动原聊天。',
    label: 'User Input',
    placeholder: '请输入新的 user input 内容',
    defaultValue: defaultText,
    confirmText: '保存并生成',
    trim: false,
    multiline: true,
    width: '680px',
  });
  if (editedText === null) {
    return { ok: false, cancelled: true };
  }

  const readyState = await ensureTimelineTargetReady(node, targetSession);
  if (!readyState.ok) {
    return readyState;
  }

  const targetMessage = getChatMessageRecord(readyState.targetMessageId, { includeSwipes: true });
  const targetRole = String(targetMessage?.role || node?.role || '').toLowerCase();
  if (!targetMessage) {
    return { ok: false, reason: '目标 user 楼层不存在，无法编辑' };
  }
  if (targetRole !== 'user') {
    return { ok: false, reason: '该节点不是 user 输入楼层，无法编辑' };
  }

  const branchResult = await forceForkAndTrimToMessage(readyState.targetMessageId, {
    trimTail: readyState.latestMessageId > readyState.targetMessageId,
  });
  if (!branchResult.ok) {
    return branchResult;
  }

  await waitFor(() => safeGetLastMessageId() >= readyState.targetMessageId, 1200, 50);
  const overwriteResult = await overwriteTimelineMessage(readyState.targetMessageId, editedText);
  if (!overwriteResult.ok) {
    return overwriteResult;
  }

  scrollMessageIntoView(readyState.targetMessageId);

  if (!canTriggerTimelineReroll()) {
    showToast('已创建分支并修改输入，请手动重新生成');
    return {
      ok: true,
      chatId: (await resolveCurrentChatId()) || readyState.targetChatId,
      messageId: readyState.targetMessageId,
      branchCreated: true,
      manualRegenerate: true,
    };
  }

  triggerReroll();
  const replyResult = await waitForTimelineReply(readyState.targetMessageId);
  if (!replyResult.ok) {
    showToast('已创建分支并修改输入，请手动重新生成');
    return {
      ok: true,
      chatId: (await resolveCurrentChatId()) || readyState.targetChatId,
      messageId: readyState.targetMessageId,
      branchCreated: true,
      manualRegenerate: true,
    };
  }

  invalidateTimelineNavigationCaches();
  await renderOverlayAtMessage(replyResult.messageId, {
    segmentIndex: 0,
    suppressTTS: true,
  });
  scrollMessageIntoView(replyResult.messageId);

  return {
    ok: true,
    chatId: (await resolveCurrentChatId()) || readyState.targetChatId,
    messageId: replyResult.messageId,
    branchCreated: true,
  };
}

async function setSwipeForMessage(messageId, swipeId) {
  try {
    const numericMessageId = Number.parseInt(String(messageId), 10);
    const numericSwipeId = Number.parseInt(String(swipeId), 10);
    const messages = getChatMessages(numericMessageId, { include_swipes: true });
    const message = Array.isArray(messages) ? messages[0] : null;
    if (!message || !Array.isArray(message.swipes) || !message.swipes[numericSwipeId]) {
      return { ok: false, reason: '目标 swipe 不存在' };
    }

    const nextContent = String(message.swipes[numericSwipeId] || '');
    await setChatMessages(
      [{
        message_id: numericMessageId,
        swipes: [...message.swipes],
        swipe_id: numericSwipeId,
      }],
      { refresh: 'affected' },
    );
    await waitFor(() => {
      const updated = getChatMessages(numericMessageId, { include_swipes: true });
      const updatedMessage = Array.isArray(updated) ? updated[0] : null;
      return Number.parseInt(String(updatedMessage?.swipe_id ?? -1), 10) === numericSwipeId;
    }, 800, 50);
    markTimelineCacheDirty();
    return { ok: true, content: nextContent };
  } catch (error) {
    console.error(`[${SCRIPT_NAME}] 设置 swipe 失败:`, error);
    return { ok: false, reason: error?.message || '设置 swipe 失败' };
  }
}

function normalizeTargetSession(node, options = {}) {
  const explicitSession = options.session && typeof options.session === 'object' ? options.session : null;
  if (explicitSession) return explicitSession;
  if (Array.isArray(node?.sessions) && node.sessions.length > 0) {
    return node.sessions[0];
  }
  return null;
}

export async function navigateToTimelineNode(node, options = {}) {
  const targetSession = normalizeTargetSession(node, options);
  if (!node || !targetSession) {
    return { ok: false, reason: '缺少时间线节点或聊天会话信息' };
  }

  const explicitBranch = !!options.branch;
  const isUserBranchEdit = explicitBranch && node.type === 'message' && String(node.role || '').toLowerCase() === 'user';
  if (isUserBranchEdit) {
    return await branchEditUserTimelineNode(node, targetSession);
  }

  try {
    const readyState = await ensureTimelineTargetReady(node, targetSession);
    if (!readyState.ok) {
      return readyState;
    }

    const requiresSwipeBranch = node.type === 'swipe' && !targetSession.isLast;
    const requiresExplicitBranch = explicitBranch && readyState.targetMessageId < readyState.latestMessageId;
    if (requiresSwipeBranch || requiresExplicitBranch) {
      const branchResult = await forkAndTrimToMessage(readyState.targetMessageId);
      if (!branchResult.ok) {
        return branchResult;
      }
      markTimelineCacheDirty();
      await waitFor(() => safeGetLastMessageId() >= readyState.targetMessageId, 1200, 50);
    }

    const effectiveMessageId = readyState.targetMessageId;
    let contentOverride = typeof node.content === 'string' ? node.content : '';

    if (node.type === 'swipe') {
      const swipeResult = await setSwipeForMessage(effectiveMessageId, node.swipeId);
      if (!swipeResult.ok) {
        return swipeResult;
      }
      contentOverride = swipeResult.content;
    }

    await renderOverlayAtMessage(effectiveMessageId, {
      segmentIndex: 0,
      contentOverride,
      suppressTTS: true,
    });

    scrollMessageIntoView(effectiveMessageId);
    return {
      ok: true,
      chatId: readyState.targetChatId,
      messageId: effectiveMessageId,
      branchCreated: requiresSwipeBranch || requiresExplicitBranch,
    };
  } catch (error) {
    console.error(`[${SCRIPT_NAME}] 时间线导航失败:`, error);
    return { ok: false, reason: error?.message || '时间线导航失败' };
  }
}
