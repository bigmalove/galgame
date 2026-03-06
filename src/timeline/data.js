import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow } from '../core/env.js';
import { GalgameStore } from '../core/store.js';
import { isSameChatId, resolveCurrentChatId } from '../save-load/manager.js';

function tryGetContext() {
  try {
    const getter = topWindow?.SillyTavern?.getContext;
    if (typeof getter === 'function') {
      return getter.call(topWindow.SillyTavern) || null;
    }
  } catch (error) {}
  return null;
}

function getRequestHeaders() {
  const candidates = [
    topWindow?.getRequestHeaders,
    topWindow?.SillyTavern?.getRequestHeaders,
    window?.getRequestHeaders,
    window?.SillyTavern?.getRequestHeaders,
  ];

  for (const getter of candidates) {
    if (typeof getter !== 'function') continue;
    try {
      const headers = getter();
      if (headers && typeof headers === 'object') {
        return { ...headers, 'Content-Type': 'application/json' };
      }
    } catch (error) {}
  }

  return { 'Content-Type': 'application/json' };
}

function normalizeNewlines(text) {
  return String(text || '').replace(/\r\n/g, '\n');
}

function hashText(text) {
  let hash = 2166136261;
  const value = String(text || '');
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `h${(hash >>> 0).toString(16)}`;
}

function getNodeText(message) {
  return normalizeNewlines(message?.mes ?? message?.message ?? '');
}

function normalizeChatFileName(value) {
  const text = String(value || '').trim().replace(/\\/g, '/');
  if (!text) return '';
  return text.split('/').filter(Boolean).pop() || text;
}

function stripChatFileSuffixes(value) {
  return String(value || '').replace(/(?:\.jsonl?)+$/i, '').trim();
}

function canonicalizeChatFileName(value) {
  return stripChatFileSuffixes(normalizeChatFileName(value)).toLowerCase();
}

function truncatePreview(text, maxLength = 120) {
  const normalized = normalizeNewlines(text).replace(/\s+/g, ' ').trim();
  if (!normalized) return '（空消息）';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function makeSearchFragments(query) {
  return String(query || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function messageRole(message) {
  if (message?.is_system) return 'system';
  if (message?.is_user) return 'user';
  return 'assistant';
}

function getCharacterDescriptor() {
  const context = tryGetContext();
  if (!context) {
    return { ok: false, reason: '无法读取 SillyTavern 上下文' };
  }

  if (context.groupId || context.group_id || context.chatMetadata?.is_group) {
    return { ok: false, reason: '首版时间线暂不支持群聊' };
  }

  const characterId = context.characterId;
  const character = characterId != null ? context.characters?.[characterId] : null;
  const avatar = String(character?.avatar || character?.data?.avatar || '').trim();
  const name = String(character?.name || character?.data?.name || '').trim();
  const key = `${avatar || 'no-avatar'}::${name || 'no-name'}::${characterId ?? 'unknown'}`;

  if (!avatar || !name) {
    return { ok: false, reason: '当前角色缺少头像或名称，无法拉取聊天列表' };
  }

  return {
    ok: true,
    avatar,
    name,
    characterId,
    key,
  };
}

function normalizeChatList(data) {
  const items = Array.isArray(data) ? data : Object.values(data || {});
  const unique = new Map();

  items
    .map(item => {
      if (typeof item === 'string') {
        return { file_name: item };
      }
      return item && typeof item === 'object' ? item : null;
    })
    .filter(Boolean)
    .forEach(item => {
      const fileName = normalizeChatFileName(item.file_name || item.chat_file || item.id || item.name || '');
      const canonical = canonicalizeChatFileName(fileName);
      if (!fileName || !canonical) return;

      const existing = unique.get(canonical);
      if (!existing) {
        unique.set(canonical, { file_name: fileName, raw: item, canonical });
        return;
      }

      const currentScore = fileName.length + ((fileName.match(/\.jsonl/gi) || []).length * 100);
      const existingScore = existing.file_name.length + ((existing.file_name.match(/\.jsonl/gi) || []).length * 100);
      if (currentScore < existingScore) {
        unique.set(canonical, { file_name: fileName, raw: item, canonical });
      }
    });

  return Array.from(unique.values())
    .sort((a, b) => b.file_name.localeCompare(a.file_name, 'zh-CN'));
}

async function fetchChatList(character) {
  const response = await fetch('/api/characters/chats', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({ avatar_url: character.avatar }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`获取聊天列表失败 (${response.status}): ${text || 'unknown error'}`);
  }
  const data = await response.json();
  return normalizeChatList(data);
}

function normalizeFetchedMessages(messages) {
  const source = Array.isArray(messages)
    ? messages
    : Array.isArray(messages?.chat)
      ? messages.chat
      : Array.isArray(messages?.messages)
        ? messages.messages
        : [];

  const list = Array.isArray(source) ? [...source] : [];
  while (list.length > 0) {
    const first = list[0];
    if (first && typeof first === 'object' && (Object.prototype.hasOwnProperty.call(first, 'mes') || Object.prototype.hasOwnProperty.call(first, 'message'))) {
      break;
    }
    list.shift();
  }

  return list.filter(item => item && typeof item === 'object' && (Object.prototype.hasOwnProperty.call(item, 'mes') || Object.prototype.hasOwnProperty.call(item, 'message')));
}

async function fetchChatMessages(character, fileName) {
  const response = await fetch('/api/chats/get', {
    method: 'POST',
    headers: getRequestHeaders(),
    cache: 'no-cache',
    body: JSON.stringify({
      ch_name: character.name,
      file_name: stripChatFileSuffixes(normalizeChatFileName(fileName)),
      avatar_url: character.avatar,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`获取聊天内容失败 (${response.status}): ${text || fileName}`);
  }
  const data = await response.json();
  return normalizeFetchedMessages(data);
}

function extractCheckpointInfo(message) {
  const names = new Set();
  const direct = String(message?.extra?.bookmark_link || '').trim();
  if (direct) names.add(direct);

  const text = String(message?.mes || '');
  const fileNameMatch = text.match(/file_name=\"(.*?)\"/i);
  if (fileNameMatch?.[1]) {
    names.add(fileNameMatch[1]);
  }

  if (names.size === 0) return null;
  return { names: [...names] };
}

function ensureNode(map, nodeId, factory) {
  if (!map.has(nodeId)) {
    map.set(nodeId, factory());
  }
  return map.get(nodeId);
}

function sortSessions(sessions, currentChatId) {
  return [...sessions].sort((a, b) => {
    const aCurrent = currentChatId && isSameChatId(a.chatId, currentChatId) ? 1 : 0;
    const bCurrent = currentChatId && isSameChatId(b.chatId, currentChatId) ? 1 : 0;
    if (aCurrent !== bCurrent) return bCurrent - aCurrent;
    const aDate = String(a.sendDate || '');
    const bDate = String(b.sendDate || '');
    if (aDate !== bDate) return bDate.localeCompare(aDate, 'zh-CN');
    return b.chatId.localeCompare(a.chatId, 'zh-CN');
  });
}

function buildTimelineGraph(character, chats, currentChatId) {
  const nodesById = new Map();
  const edgesById = new Map();
  const previousByChat = new Map();
  const currentPath = [];
  const rootId = 'timeline_root';

  nodesById.set(rootId, {
    nodeId: rootId,
    type: 'root',
    depth: -1,
    role: 'root',
    chatFile: '',
    messageId: -1,
    swipeId: null,
    contentHash: 'root',
    content: '',
    preview: character.name,
    label: character.name,
    sessions: [],
    checkpointInfo: null,
  });

  for (const chat of chats) {
    previousByChat.set(chat.chatId, rootId);
  }

  const maxDepth = chats.reduce((maxValue, chat) => Math.max(maxValue, chat.messages.length), 0);

  for (let depth = 0; depth < maxDepth; depth += 1) {
    const groups = new Map();

    for (const chat of chats) {
      const message = chat.messages[depth];
      if (!message) continue;
      const role = messageRole(message);
      const text = getNodeText(message);
      const key = `${depth}::${role}::${hashText(text)}`;
      if (!groups.has(key)) {
        groups.set(key, { depth, role, text, items: [] });
      }
      groups.get(key).items.push({ chat, message, depth, text });
    }

    for (const group of groups.values()) {
      const nodeId = `msg_${group.depth}_${group.role}_${hashText(group.text)}`;
      const first = group.items[0];
      const node = ensureNode(nodesById, nodeId, () => ({
        nodeId,
        type: 'message',
        depth: group.depth,
        role: group.role,
        chatFile: first.chat.chatId,
        messageId: group.depth,
        swipeId: null,
        contentHash: hashText(group.text),
        content: group.text,
        preview: truncatePreview(group.text),
        label: truncatePreview(group.text, 36),
        sessions: [],
        checkpointInfo: null,
      }));

      for (const item of group.items) {
        const session = {
          chatId: item.chat.chatId,
          chatFile: item.chat.fileName,
          messageId: item.depth,
          swipeId: null,
          sendDate: String(item.message?.send_date || ''),
          isLast: item.depth >= item.chat.messages.length - 1,
          totalMessages: item.chat.messages.length,
        };
        node.sessions.push(session);
        const checkpointInfo = extractCheckpointInfo(item.message);
        if (checkpointInfo?.names?.length) {
          const merged = new Set(node.checkpointInfo?.names || []);
          checkpointInfo.names.forEach(name => merged.add(name));
          node.checkpointInfo = { names: [...merged] };
        }

        const previousNodeId = previousByChat.get(item.chat.chatId) || rootId;
        const edgeId = `edge_${previousNodeId}_${nodeId}_${hashText(item.chat.chatId)}`;
        if (!edgesById.has(edgeId)) {
          edgesById.set(edgeId, {
            edgeId,
            source: previousNodeId,
            target: nodeId,
            kind: 'sequence',
            chatId: item.chat.chatId,
          });
        }
        previousByChat.set(item.chat.chatId, nodeId);
        if (currentChatId && isSameChatId(item.chat.chatId, currentChatId)) {
          currentPath.push(nodeId);
        }

        const swipes = Array.isArray(item.message?.swipes) ? item.message.swipes : [];
        for (let swipeIndex = 0; swipeIndex < swipes.length; swipeIndex += 1) {
          const swipeText = normalizeNewlines(swipes[swipeIndex] || '');
          if (!swipeText) continue;
          if (swipeText === group.text) continue;

          const swipeNodeId = `swipe_${nodeId}_${hashText(swipeText)}`;
          const swipeNode = ensureNode(nodesById, swipeNodeId, () => ({
            nodeId: swipeNodeId,
            type: 'swipe',
            depth: group.depth,
            role: 'swipe',
            chatFile: item.chat.chatId,
            messageId: item.depth,
            swipeId: swipeIndex,
            contentHash: hashText(swipeText),
            content: swipeText,
            preview: truncatePreview(swipeText),
            label: `Swipe ${swipeIndex + 1}`,
            sessions: [],
            checkpointInfo: null,
            parentNodeId: nodeId,
          }));

          swipeNode.sessions.push({
            chatId: item.chat.chatId,
            chatFile: item.chat.fileName,
            messageId: item.depth,
            swipeId: swipeIndex,
            sendDate: String(item.message?.send_date || ''),
            isLast: item.depth >= item.chat.messages.length - 1,
            totalMessages: item.chat.messages.length,
          });

          const swipeEdgeId = `edge_swipe_${nodeId}_${swipeNodeId}`;
          if (!edgesById.has(swipeEdgeId)) {
            edgesById.set(swipeEdgeId, {
              edgeId: swipeEdgeId,
              source: nodeId,
              target: swipeNodeId,
              kind: 'swipe',
              chatId: item.chat.chatId,
            });
          }
        }
      }
    }
  }

  const nodes = [...nodesById.values()].map(node => ({
    ...node,
    sessions: sortSessions(node.sessions, currentChatId),
  }));
  const edges = [...edgesById.values()];
  const currentPathNodeIds = Array.from(new Set(currentPath));
  const currentLastNodeId = currentPathNodeIds.length > 0 ? currentPathNodeIds[currentPathNodeIds.length - 1] : null;

  return {
    key: character.key,
    character,
    generatedAt: Date.now(),
    nodes,
    edges,
    rootId,
    current: {
      chatId: currentChatId || '',
      pathNodeIds: currentPathNodeIds,
      lastNodeId: currentLastNodeId,
    },
  };
}

function findRuntimeNodeId(graphData, currentChatId, messageId, message) {
  if (!graphData || !Array.isArray(graphData.nodes) || !currentChatId) return '';

  const messageText = getNodeText(message);
  const messageHash = hashText(messageText);
  const activeSwipeId = Number.parseInt(String(message?.swipe_id ?? -1), 10);
  const candidates = graphData.nodes.filter(node => Array.isArray(node.sessions) && node.sessions.some(session => isSameChatId(session.chatId, currentChatId) && Number.parseInt(String(session.messageId), 10) === messageId));
  if (candidates.length === 0) return '';

  const exactMessage = candidates.find(node => node.type === 'message' && node.contentHash === messageHash);
  if (exactMessage) return exactMessage.nodeId;

  if (Number.isFinite(activeSwipeId) && activeSwipeId >= 0) {
    const exactSwipe = candidates.find(node => node.type === 'swipe' && node.sessions.some(session => isSameChatId(session.chatId, currentChatId) && Number.parseInt(String(session.messageId), 10) === messageId && Number.parseInt(String(session.swipeId), 10) === activeSwipeId));
    if (exactSwipe) return exactSwipe.nodeId;
  }

  const fallbackMessage = candidates.find(node => node.type === 'message');
  return fallbackMessage?.nodeId || candidates[0]?.nodeId || '';
}

function getRuntimeCurrentPathNodeIds(graphData, currentChatId) {
  if (!currentChatId) return [];
  const context = tryGetContext();
  const runtimeMessages = normalizeFetchedMessages(context?.chat || []);
  if (!Array.isArray(runtimeMessages) || runtimeMessages.length === 0) return [];

  const path = [];
  runtimeMessages.forEach((message, index) => {
    const nodeId = findRuntimeNodeId(graphData, currentChatId, index, message);
    if (nodeId) {
      path.push(nodeId);
    }
  });

  return Array.from(new Set(path));
}

async function hydrateCurrentRuntime(graphData) {
  const currentChatId = await resolveCurrentChatId();
  const runtimePathNodeIds = getRuntimeCurrentPathNodeIds(graphData, currentChatId);
  const currentPathNodeIds = runtimePathNodeIds.length > 0
    ? runtimePathNodeIds
    : graphData.nodes
      .filter(node => node.type === 'message' && node.sessions.some(session => isSameChatId(session.chatId, currentChatId)))
      .sort((a, b) => a.depth - b.depth)
      .map(node => node.nodeId);

  graphData.current = {
    chatId: currentChatId || '',
    pathNodeIds: currentPathNodeIds,
    lastNodeId: currentPathNodeIds.length > 0 ? currentPathNodeIds[currentPathNodeIds.length - 1] : null,
  };

  graphData.nodes = graphData.nodes.map(node => ({
    ...node,
    sessions: sortSessions(node.sessions, currentChatId),
  }));

  return graphData;
}

export function getTimelinePrefs() {
  return GalgameStore.storage.get(GalgameStore.STORAGE_KEYS.TIMELINE_PREFS, {
    lastQuery: '',
  });
}

export function saveTimelinePrefs(nextPrefs) {
  const merged = {
    ...getTimelinePrefs(),
    ...(nextPrefs && typeof nextPrefs === 'object' ? nextPrefs : {}),
  };
  GalgameStore.storage.set(GalgameStore.STORAGE_KEYS.TIMELINE_PREFS, merged);
  return merged;
}

export function markTimelineCacheDirty(characterKey = '') {
  const cache = GalgameStore.cache.timeline;
  if (!(cache instanceof Map)) return;
  if (characterKey) {
    const entry = cache.get(characterKey);
    if (entry) entry.dirty = true;
    return;
  }
  cache.forEach(entry => {
    if (entry && typeof entry === 'object') entry.dirty = true;
  });
}

export function clearTimelineCache(characterKey = '') {
  const cache = GalgameStore.cache.timeline;
  if (!(cache instanceof Map)) return;
  if (characterKey) {
    cache.delete(characterKey);
    return;
  }
  cache.clear();
}

export function getPreferredSession(node, graphData) {
  if (!node || !Array.isArray(node.sessions) || node.sessions.length === 0) return null;
  const currentChatId = graphData?.current?.chatId || '';
  return node.sessions.find(session => currentChatId && isSameChatId(session.chatId, currentChatId)) || node.sessions[0] || null;
}

export function nodeMatchesQuery(node, query) {
  const fragments = makeSearchFragments(query);
  if (fragments.length === 0) return true;
  const haystack = [node.preview, node.content, node.chatFile, node.label]
    .map(value => String(value || '').toLowerCase())
    .join('\n');
  return fragments.every(fragment => haystack.includes(fragment));
}

export async function getTimelineGraph(options = {}) {
  const descriptor = getCharacterDescriptor();
  if (!descriptor.ok) {
    return { ok: false, reason: descriptor.reason || '无法初始化时间线' };
  }

  const forceRefresh = !!options.forceRefresh;
  const cache = GalgameStore.cache.timeline;
  const cached = cache instanceof Map ? cache.get(descriptor.key) : null;
  if (cached?.data && !cached.dirty && !forceRefresh) {
    const hydrated = await hydrateCurrentRuntime(cached.data);
    return { ok: true, data: hydrated, fromCache: true };
  }

  try {
    const chatList = await fetchChatList(descriptor);
    const chats = [];
    for (const item of chatList) {
      try {
        const messages = await fetchChatMessages(descriptor, item.file_name);
        chats.push({
          chatId: item.file_name,
          fileName: item.file_name,
          messages,
        });
      } catch (error) {
        console.warn(`[${SCRIPT_NAME}] 跳过聊天 ${item.file_name}:`, error);
      }
    }

    const currentChatId = await resolveCurrentChatId();
    const data = buildTimelineGraph(descriptor, chats, currentChatId);
    const hydrated = await hydrateCurrentRuntime(data);
    if (cache instanceof Map) {
      cache.set(descriptor.key, {
        data: hydrated,
        dirty: false,
        updatedAt: Date.now(),
      });
    }
    return { ok: true, data: hydrated, fromCache: false };
  } catch (error) {
    console.error(`[${SCRIPT_NAME}] 时间线构建失败:`, error);
    return { ok: false, reason: error?.message || '时间线构建失败' };
  }
}
