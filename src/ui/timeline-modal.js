import cytoscape from 'cytoscape';
import cytoscapeDagre from 'cytoscape-dagre';
import { SCRIPT_NAME } from '../core/constants.js';
import { $ } from '../core/env.js';
import { isSameChatId } from '../save-load/manager.js';
import { getPreferredSession, getTimelineGraph, getTimelinePrefs, nodeMatchesQuery, saveTimelinePrefs } from '../timeline/data.js';
import { navigateToTimelineNode } from '../timeline/navigation.js';
import { getModalMountRoot } from './fullscreen.js';
import { showToast } from './toast.js';

const MODAL_ID = 'gal-timeline-modal';
const AUTO_FIT_MAX_ZOOM = 1.02;
const AUTO_FIT_SINGLE_NODE_ZOOM = 0.72;
const TIMELINE_MIN_ZOOM = 0.2;
const TIMELINE_MAX_ZOOM = 2.4;
const TIMELINE_WHEEL_SENSITIVITY = 0.42;

let dagreRegistered = false;
let modalState = {
  $modal: null,
  cy: null,
  data: null,
  nodeMap: new Map(),
  selectedNodeId: '',
  selectedSessionIndex: 0,
  requestId: 0,
};

function ensureDagreRegistered() {
  if (dagreRegistered) return;
  cytoscapeDagre(cytoscape);
  dagreRegistered = true;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function closeTimelineModal() {
  if (modalState.cy) {
    modalState.cy.destroy();
  }
  modalState = {
    $modal: null,
    cy: null,
    data: null,
    nodeMap: new Map(),
    selectedNodeId: '',
    selectedSessionIndex: 0,
    requestId: 0,
  };
  $(getModalMountRoot()).find(`#${MODAL_ID}`).remove();
}

function buildModalHtml() {
  return `
    <div id="${MODAL_ID}" class="gal-input-modal gal-timeline-modal">
      <div class="gal-timeline-shell">
        <div class="gal-timeline-header">
          <div class="gal-timeline-title">
            <i class="fa-solid fa-diagram-project"></i>
            <span>时间线图谱</span>
          </div>
          <div class="gal-timeline-header-actions">
            <button class="gal-timeline-header-btn" data-action="timeline-refresh" title="刷新图谱">
              <i class="fa-solid fa-rotate-right"></i><span>刷新</span>
            </button>
            <button class="gal-timeline-header-btn" data-action="timeline-focus-current" title="定位当前聊天路径">
              <i class="fa-solid fa-crosshairs"></i><span>当前</span>
            </button>
            <button class="gal-timeline-close" title="关闭">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
        <div class="gal-timeline-toolbar">
          <div class="gal-timeline-search-wrap">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" id="gal-timeline-search-input" class="gal-timeline-search-input" placeholder="搜索消息内容、文件名、节点标签...">
          </div>
          <div class="gal-timeline-zoom-wrap">
            <button class="gal-timeline-zoom-btn" type="button" data-action="timeline-zoom-out" title="缩小">
              <i class="fa-solid fa-minus"></i>
            </button>
            <input type="range" id="gal-timeline-zoom-range" class="gal-timeline-zoom-range" min="20" max="240" step="1" value="100" aria-label="时间线缩放比例">
            <button class="gal-timeline-zoom-btn" type="button" data-action="timeline-zoom-in" title="放大">
              <i class="fa-solid fa-plus"></i>
            </button>
            <button class="gal-timeline-zoom-value" type="button" data-action="timeline-zoom-reset" title="重置缩放">100%</button>
          </div>
          <div class="gal-timeline-status" id="gal-timeline-status">准备加载时间线...</div>
        </div>
        <div class="gal-timeline-body">
          <div class="gal-timeline-graph-panel">
            <div class="gal-timeline-graph" id="gal-timeline-graph"></div>
            <div class="gal-timeline-empty" id="gal-timeline-empty" style="display:none;"></div>
          </div>
          <aside class="gal-timeline-drawer" id="gal-timeline-drawer">
            <div class="gal-timeline-drawer-empty">
              <i class="fa-solid fa-circle-nodes"></i>
              <span>点击节点查看详情</span>
            </div>
          </aside>
        </div>
      </div>
    </div>
  `;
}

function ensureModal() {
  const mountRoot = getModalMountRoot();
  $(mountRoot).find(`#${MODAL_ID}`).remove();
  const $modal = $(buildModalHtml());
  $(mountRoot).append($modal);
  modalState.$modal = $modal;
  bindModalEvents($modal);
  return $modal;
}

function setStatus(text) {
  modalState.$modal?.find('#gal-timeline-status').text(String(text || ''));
}

function clampZoom(level) {
  const numericLevel = Number(level);
  if (!Number.isFinite(numericLevel)) return 1;
  return Math.min(TIMELINE_MAX_ZOOM, Math.max(TIMELINE_MIN_ZOOM, numericLevel));
}

function syncZoomControls() {
  if (!modalState.$modal || !modalState.cy) return;
  const zoom = clampZoom(modalState.cy.zoom());
  const percent = Math.round(zoom * 100);
  modalState.$modal.find('#gal-timeline-zoom-range').val(String(percent));
  modalState.$modal.find('.gal-timeline-zoom-value').text(percent + '%');
}

function setTimelineZoom(level) {
  if (!modalState.cy) return;
  modalState.cy.zoom(clampZoom(level));
  syncZoomControls();
}

function stepTimelineZoom(direction) {
  if (!modalState.cy) return;
  const nextZoom = clampZoom(modalState.cy.zoom() + (direction * 0.12));
  setTimelineZoom(nextZoom);
}

function showEmptyState(text) {
  const safeText = escapeHtml(text || '暂无时间线数据');
  modalState.$modal?.find('#gal-timeline-empty').html(`<div class="gal-timeline-empty-inner"><i class="fa-regular fa-folder-open"></i><span>${safeText}</span></div>`).show();
  modalState.$modal?.find('#gal-timeline-graph').hide();
}

function hideEmptyState() {
  modalState.$modal?.find('#gal-timeline-empty').hide();
  modalState.$modal?.find('#gal-timeline-graph').show();
}

function getNodeById(nodeId) {
  return modalState.nodeMap.get(String(nodeId || '')) || null;
}

function getSelectedNode() {
  return getNodeById(modalState.selectedNodeId);
}

function buildTimelineNodeDisplayLabel(node) {
  if (!node || typeof node !== 'object') return '';
  if (node.type === 'root') {
    return String(node.label || node.preview || '时间线');
  }

  const floor = Math.max(1, Number.parseInt(String(node.depth ?? 0), 10) + 1);
  if (node.type === 'swipe') {
    const swipeIndex = Math.max(1, Number.parseInt(String(node.swipeId ?? 0), 10) + 1);
    return 'SW' + swipeIndex + '-' + floor;
  }

  const rolePrefixMap = {
    assistant: 'AI',
    user: 'U',
    system: 'SYS',
  };
  const prefix = rolePrefixMap[String(node.role || '').toLowerCase()] || 'MSG';
  return prefix + '-' + floor;
}

function getSelectedSession(node) {
  const targetNode = node || getSelectedNode();
  if (!targetNode || !Array.isArray(targetNode.sessions) || targetNode.sessions.length === 0) return null;
  const index = Math.max(0, Math.min(modalState.selectedSessionIndex, targetNode.sessions.length - 1));
  return targetNode.sessions[index] || null;
}

function setSelectedNode(nodeId, sessionIndex = -1) {
  const node = getNodeById(nodeId);
  if (!node) return;
  modalState.selectedNodeId = node.nodeId;
  if (sessionIndex >= 0) {
    modalState.selectedSessionIndex = sessionIndex;
  } else {
    const preferred = getPreferredSession(node, modalState.data);
    const preferredIndex = preferred ? node.sessions.findIndex(session => isSameChatId(session.chatId, preferred.chatId) && session.messageId === preferred.messageId && session.swipeId === preferred.swipeId) : 0;
    modalState.selectedSessionIndex = preferredIndex >= 0 ? preferredIndex : 0;
  }
  renderNodeDetails(node);
  highlightSelectedNode(node.nodeId);
}

function highlightSelectedNode(nodeId) {
  if (!modalState.cy) return;
  modalState.cy.nodes().removeClass('timeline-selected-node');
  if (!nodeId) return;
  const target = modalState.cy.getElementById(nodeId);
  if (target?.length) {
    target.addClass('timeline-selected-node');
  }
}

function renderNodeDetails(node) {
  const targetNode = node || getSelectedNode();
  if (!targetNode) return;
  const selectedSession = getSelectedSession(targetNode);
  const checkpointBadges = targetNode.checkpointInfo?.names?.length
    ? `<div class="gal-timeline-checkpoints">${targetNode.checkpointInfo.names.map(name => `<span class="gal-timeline-chip checkpoint">${escapeHtml(name)}</span>`).join('')}</div>`
    : '';
  const sessionButtons = Array.isArray(targetNode.sessions)
    ? targetNode.sessions.map((session, index) => {
        const active = selectedSession && isSameChatId(session.chatId, selectedSession.chatId) && session.messageId === selectedSession.messageId && session.swipeId === selectedSession.swipeId;
        const current = modalState.data?.current?.chatId && isSameChatId(session.chatId, modalState.data.current.chatId);
        const badgeText = session.swipeId != null ? `Swipe ${session.swipeId + 1}` : `楼层 ${session.messageId + 1}`;
        return `
          <button class="gal-timeline-session-btn ${active ? 'active' : ''} ${current ? 'is-current' : ''}" data-role="timeline-select-session" data-session-index="${index}">
            <span class="gal-timeline-session-file">${escapeHtml(session.chatFile || session.chatId)}</span>
            <span class="gal-timeline-session-meta">${escapeHtml(badgeText)}</span>
          </button>
        `;
      }).join('')
    : '';
  const drawerHtml = `
    <div class="gal-timeline-drawer-header">
      <div class="gal-timeline-drawer-title-row">
        <span class="gal-timeline-node-type ${escapeHtml(targetNode.type)}">${escapeHtml(targetNode.type === 'swipe' ? 'Swipe' : (targetNode.role || targetNode.type))}</span>
        <span class="gal-timeline-node-depth">深度 ${targetNode.depth + 1}</span>
      </div>
      <div class="gal-timeline-node-label">${escapeHtml(targetNode.label || targetNode.preview)}</div>
      ${checkpointBadges}
    </div>
    <div class="gal-timeline-drawer-body">
      <div class="gal-timeline-preview-label">消息预览</div>
      <div class="gal-timeline-preview">${escapeHtml(targetNode.preview || '（空消息）')}</div>
      <div class="gal-timeline-preview-label">所属聊天</div>
      <div class="gal-timeline-session-list">${sessionButtons || '<div class="gal-timeline-drawer-hint">没有可用的聊天会话</div>'}</div>
      <div class="gal-timeline-preview-label">操作</div>
      <div class="gal-timeline-drawer-actions">
        <button class="gal-timeline-action-btn primary" data-role="timeline-open-node">
          <i class="fa-solid fa-arrow-right"></i><span>打开节点</span>
        </button>
        <button class="gal-timeline-action-btn" data-role="timeline-open-branch">
          <i class="fa-solid fa-code-branch"></i><span>分支打开</span>
        </button>
      </div>
    </div>
  `;
  modalState.$modal?.find('#gal-timeline-drawer').html(drawerHtml);
}

function buildCyElements(data) {
  const elements = [];
  data.nodes.forEach(node => {
    elements.push({
      group: 'nodes',
      data: {
        id: node.nodeId,
        label: buildTimelineNodeDisplayLabel(node),
        type: node.type,
        role: node.role,
        preview: node.preview,
        hasCheckpoint: node.checkpointInfo?.names?.length > 0 ? 'true' : 'false',
      },
    });
  });
  data.edges.forEach(edge => {
    elements.push({
      group: 'edges',
      data: {
        id: edge.edgeId,
        source: edge.source,
        target: edge.target,
        kind: edge.kind,
      },
    });
  });
  return elements;
}

function getNodeCollectionByIds(ids) {
  if (!modalState.cy || !Array.isArray(ids) || ids.length === 0) {
    return modalState.cy ? modalState.cy.collection() : null;
  }
  return ids.reduce((collection, id) => collection.union(modalState.cy.getElementById(id)), modalState.cy.collection());
}

function applyCurrentPathHighlight() {
  if (!modalState.cy || !modalState.data) return;
  modalState.cy.elements().removeClass('timeline-current-path timeline-current-node');
  const pathIds = modalState.data.current?.pathNodeIds || [];
  const collection = getNodeCollectionByIds(pathIds);
  collection?.addClass('timeline-current-path');
  const lastNodeId = modalState.data.current?.lastNodeId || '';
  if (lastNodeId) {
    modalState.cy.getElementById(lastNodeId).addClass('timeline-current-node');
  }
}

function focusGraphCollection(collection, options = {}) {
  if (!modalState.cy || !collection || collection.length === 0) return;

  const nodeCount = typeof collection.nodes === 'function' ? collection.nodes().length : collection.length;
  if (nodeCount <= 2) {
    modalState.cy.center(collection);
    modalState.cy.zoom(options.singleNodeZoom ?? AUTO_FIT_SINGLE_NODE_ZOOM);
    syncZoomControls();
    return;
  }

  modalState.cy.fit(collection, options.padding ?? 60);
  if (modalState.cy.zoom() > AUTO_FIT_MAX_ZOOM) {
    modalState.cy.zoom(AUTO_FIT_MAX_ZOOM);
    modalState.cy.center(collection);
  }
  syncZoomControls();
}

function focusCurrentPath() {
  if (!modalState.cy || !modalState.data) return;
  applyCurrentPathHighlight();
  const collection = getNodeCollectionByIds(modalState.data.current?.pathNodeIds || []);
  if (!collection || collection.length === 0) {
    showToast('当前聊天路径不在图谱内');
    return;
  }
  focusGraphCollection(collection, { padding: 60 });
}

function applySearch(query) {
  if (!modalState.cy || !modalState.data) return;
  const text = String(query || '').trim();
  saveTimelinePrefs({ lastQuery: text });

  modalState.cy.elements().removeClass('timeline-search-match timeline-search-faded');
  if (!text) {
    setStatus(`已加载 ${modalState.data.nodes.length - 1} 个节点 / ${modalState.data.edges.length} 条边`);
    applyCurrentPathHighlight();
    highlightSelectedNode(modalState.selectedNodeId);
    return;
  }

  const matchedNodes = modalState.data.nodes.filter(node => nodeMatchesQuery(node, text));
  const matchedIds = new Set(matchedNodes.map(node => node.nodeId));

  modalState.cy.nodes().forEach(node => {
    if (matchedIds.has(node.id())) {
      node.addClass('timeline-search-match');
    } else {
      node.addClass('timeline-search-faded');
    }
  });
  modalState.cy.edges().forEach(edge => {
    const match = matchedIds.has(edge.source().id()) || matchedIds.has(edge.target().id());
    if (match) {
      edge.addClass('timeline-search-match');
    } else {
      edge.addClass('timeline-search-faded');
    }
  });

  setStatus(matchedNodes.length > 0 ? `匹配 ${matchedNodes.length} 个节点` : '没有匹配的节点');
  const collection = getNodeCollectionByIds([...matchedIds]);
  if (collection && collection.length > 0) {
    focusGraphCollection(collection, { padding: 80, singleNodeZoom: 0.78 });
  }
  highlightSelectedNode(modalState.selectedNodeId);
}

function renderGraph(data) {
  ensureDagreRegistered();
  const container = modalState.$modal?.find('#gal-timeline-graph')[0];
  if (!container) return;
  if (modalState.cy) {
    modalState.cy.destroy();
  }

  modalState.nodeMap = new Map(data.nodes.map(node => [node.nodeId, node]));
  modalState.cy = cytoscape({
    container,
    elements: buildCyElements(data),
    layout: {
      name: 'dagre',
      rankDir: 'LR',
      nodeSep: 42,
      edgeSep: 18,
      rankSep: 78,
      padding: 42,
      animate: false,
    },
    minZoom: TIMELINE_MIN_ZOOM,
    maxZoom: TIMELINE_MAX_ZOOM,
    wheelSensitivity: TIMELINE_WHEEL_SENSITIVITY,
    style: [
      {
        selector: 'node',
        style: {
          'background-color': '#2d8cff',
          'border-width': 2,
          'border-color': '#d7e7ff',
          'label': 'data(label)',
          'color': '#eff6ff',
          'font-size': 10,
          'text-wrap': 'ellipsis',
          'text-max-width': 84,
          'text-valign': 'center',
          'text-halign': 'center',
          'width': 58,
          'height': 42,
          'overlay-opacity': 0,
        },
      },
      { selector: 'node[type = "root"]', style: { 'background-color': '#546072', 'border-color': '#f3f6fb', 'shape': 'round-rectangle', 'width': 88, 'height': 32, 'font-size': 10, 'text-max-width': 120 } },
      { selector: 'node[role = "assistant"]', style: { 'background-color': '#00b3a4', 'border-color': '#dffcf7' } },
      { selector: 'node[role = "user"]', style: { 'background-color': '#7a5cff', 'border-color': '#ece6ff' } },
      { selector: 'node[role = "system"]', style: { 'background-color': '#7f8b9c', 'border-color': '#e3e9f2' } },
      { selector: 'node[type = "swipe"]', style: { 'background-color': '#f59e0b', 'border-color': '#fff0c2', 'shape': 'diamond', 'width': 48, 'height': 48, 'font-size': 8, 'text-max-width': 72 } },
      { selector: 'node[hasCheckpoint = "true"]', style: { 'border-color': '#ffd166', 'border-width': 4 } },
      { selector: 'node.timeline-current-path', style: { 'border-color': '#8cd8ff', 'border-width': 4 } },
      { selector: 'node.timeline-current-node', style: { 'background-color': '#ff5d9e', 'border-color': '#ffe3f0', 'width': 66, 'height': 48, 'font-size': 11, 'text-max-width': 96 } },
      { selector: 'node.timeline-selected-node', style: { 'border-color': '#ffffff', 'border-width': 5 } },
      { selector: 'node.timeline-search-match', style: { 'background-color': '#22c55e', 'border-color': '#e8fff0', 'width': 66, 'height': 48, 'font-size': 11, 'text-max-width': 96 } },
      { selector: 'node.timeline-search-faded', style: { 'opacity': 0.18 } },
      {
        selector: 'edge',
        style: {
          'line-color': '#9bb3d0',
          'target-arrow-color': '#9bb3d0',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'width': 2,
          'opacity': 0.7,
        },
      },
      { selector: 'edge[kind = "swipe"]', style: { 'line-style': 'dashed', 'line-color': '#ffc561', 'target-arrow-color': '#ffc561' } },
      { selector: 'edge.timeline-search-match', style: { 'opacity': 0.9, 'width': 3 } },
      { selector: 'edge.timeline-search-faded', style: { 'opacity': 0.1 } },
    ],
  });

  modalState.cy.on('tap', 'node', event => {
    setSelectedNode(event.target.id());
  });

  modalState.cy.on('tap', 'edge', event => {
    const targetId = event.target?.data('target');
    if (targetId) {
      setSelectedNode(targetId);
    }
  });

  modalState.cy.on('zoom', () => {
    syncZoomControls();
  });

  const prefs = getTimelinePrefs();
  modalState.$modal?.find('#gal-timeline-search-input').val(prefs.lastQuery || '');
  applyCurrentPathHighlight();
  if (prefs.lastQuery) {
    applySearch(prefs.lastQuery);
  } else {
    setStatus(`已加载 ${data.nodes.length - 1} 个节点 / ${data.edges.length} 条边`);
  }

  if (data.current?.lastNodeId) {
    setSelectedNode(data.current.lastNodeId);
    focusCurrentPath();
  } else {
    syncZoomControls();
  }
}

async function navigateSelectedNode(branch = false) {
  const node = getSelectedNode();
  const session = getSelectedSession(node);
  if (!node || !session) {
    showToast('请先选择一个可导航的节点');
    return;
  }

  const result = await navigateToTimelineNode(node, { session, branch });
  if (!result.ok) {
    if (result.cancelled) {
      return;
    }
    showToast(result.reason || '时间线导航失败');
    return;
  }

  closeTimelineModal();
}

function bindModalEvents($modal) {
  $modal.on('click', '.gal-timeline-close', () => closeTimelineModal());
  $modal.on('click', function (event) {
    if (event.target === $modal[0]) {
      closeTimelineModal();
    }
  });
  $modal.on('input', '#gal-timeline-search-input', function () {
    applySearch($(this).val());
  });
  $modal.on('click', '[data-action="timeline-refresh"]', async function () {
    $(this).prop('disabled', true);
    try {
      await loadTimelineData(true);
    } finally {
      $(this).prop('disabled', false);
    }
  });
  $modal.on('click', '[data-action="timeline-focus-current"]', function () {
    focusCurrentPath();
  });
  $modal.on('input change', '#gal-timeline-zoom-range', function () {
    const percent = Number.parseInt(String($(this).val() || '100'), 10);
    setTimelineZoom(percent / 100);
  });
  $modal.on('click', '[data-action="timeline-zoom-in"]', function () {
    stepTimelineZoom(1);
  });
  $modal.on('click', '[data-action="timeline-zoom-out"]', function () {
    stepTimelineZoom(-1);
  });
  $modal.on('click', '[data-action="timeline-zoom-reset"]', function () {
    setTimelineZoom(1);
  });
  $modal.on('click', '[data-role="timeline-select-session"]', function () {
    const index = Number.parseInt(String($(this).attr('data-session-index') || '0'), 10);
    setSelectedNode(modalState.selectedNodeId, index);
  });
  $modal.on('click', '[data-role="timeline-open-node"]', async function () {
    $(this).prop('disabled', true);
    try {
      await navigateSelectedNode(false);
    } finally {
      $(this).prop('disabled', false);
    }
  });
  $modal.on('click', '[data-role="timeline-open-branch"]', async function () {
    $(this).prop('disabled', true);
    try {
      await navigateSelectedNode(true);
    } finally {
      $(this).prop('disabled', false);
    }
  });
}

async function loadTimelineData(forceRefresh = false) {
  if (!modalState.$modal) return;
  const requestId = ++modalState.requestId;
  hideEmptyState();
  modalState.$modal.find('#gal-timeline-drawer').html('<div class="gal-timeline-drawer-empty"><i class="fa-solid fa-spinner fa-spin"></i><span>正在加载详情...</span></div>');
  setStatus(forceRefresh ? '正在刷新图谱...' : '正在构建图谱...');

  const result = await getTimelineGraph({ forceRefresh });
  if (!modalState.$modal || requestId !== modalState.requestId) return;
  if (!result.ok) {
    showEmptyState(result.reason || '时间线加载失败');
    setStatus('时间线不可用');
    modalState.data = null;
    modalState.nodeMap = new Map();
    return;
  }

  modalState.data = result.data;
  hideEmptyState();
  renderGraph(result.data);
}

export async function showTimelineModal(options = {}) {
  ensureModal();
  await loadTimelineData(!!options.forceRefresh);
}
