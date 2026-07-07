// ============================================
// 场景线稿地图弹窗（重做版）
// 流程：读数据库表 → 布局缓存/LLM 生成 → rough.js 渲染 SVG 线稿 → 角色标记 → 交互弹窗
// 对外唯一契约：showMapModal(options?) 无参可调用
// ============================================
import { SCRIPT_NAME } from '../core/constants.js';
import { $, topWindow } from '../core/env.js';
import { getMapSettings, updateMapSettings } from '../core/settings.js';
import { SpriteManager } from '../sprite/sprite-manager.js';
import { showInAppConfirmDialog } from '../ui/asset-io.js';
import { getModalMountRoot } from '../ui/fullscreen.js';
import { showToast } from '../ui/toast.js';
import { loadLayout, removeLayout, saveLayout } from './layout-store.js';
import { showNpcInteractionModal } from './npc-modal.js';
import { createPanZoomController } from './panzoom.js';
import { showProtagonistStatusModal } from './protagonist-modal.js';
import { getGlobalSceneInfo, getNpcList, getTableData } from './scene-data.js';
import { generateSceneLayout } from './scene-generator.js';
import { renderMarkerLayer } from './scene-markers.js';
import { getPaperCss, renderSceneSvg, resolveSceneStyle, SCENE_STYLE_OPTIONS } from './scene-renderer.js';
import { CANVAS_H, CANVAS_W } from './scene-schema.js';
import { escapeHtml, syncSceneModalSkinClass } from './scene-ui-utils.js';

const MAP_MODAL_ID = 'gal-scene-map-modal';
const MAP_MODAL_STYLE_ID = 'gal-scene-map-modal-style';
const PANZOOM_NS = 'galSceneMap';

function ensureMapModalStyle() {
  const mountRoot = getModalMountRoot();
  const doc = mountRoot.ownerDocument || topWindow.document;
  if (doc.getElementById(MAP_MODAL_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = MAP_MODAL_STYLE_ID;
  style.textContent = `
    #${MAP_MODAL_ID} {
      position: fixed; inset: 0; z-index: 100020;
      display: flex; align-items: center; justify-content: center;
      background: rgba(12, 14, 20, 0.6); backdrop-filter: blur(3px);
    }
    #${MAP_MODAL_ID} .gal-scene-panel {
      width: min(1080px, 96vw); height: min(760px, 92vh);
      display: flex; flex-direction: column; overflow: hidden;
      background: #fdfbf6; color: #33302b;
      border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,.45);
      border: 1px solid rgba(0,0,0,.08);
    }
    #${MAP_MODAL_ID} .gal-scene-topbar {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; border-bottom: 1px solid rgba(0,0,0,.08); flex-wrap: wrap;
    }
    #${MAP_MODAL_ID} .gal-scene-title {
      font-weight: 700; font-size: 1.05rem; letter-spacing: 2px;
      display: flex; align-items: center; gap: 8px; min-width: 0;
    }
    #${MAP_MODAL_ID} .gal-scene-time { font-size: 0.82rem; color: #8a8577; }
    #${MAP_MODAL_ID} .gal-scene-topbar-spacer { flex: 1; }
    #${MAP_MODAL_ID} .gal-scene-style-select {
      padding: 7px 10px; border-radius: 8px; border: 1px solid rgba(0,0,0,.15);
      background: #fff; color: #33302b; font-size: 0.85rem; cursor: pointer; min-height: 36px;
    }
    #${MAP_MODAL_ID} .gal-scene-btn {
      padding: 7px 14px; border-radius: 8px; border: 1px solid rgba(0,0,0,.15);
      background: #fff; color: #33302b; font-size: 0.85rem; cursor: pointer;
      font-weight: 600; transition: all .15s; min-height: 36px; white-space: nowrap;
    }
    #${MAP_MODAL_ID} .gal-scene-btn:hover { background: #f0ece1; }
    #${MAP_MODAL_ID} .gal-scene-btn.danger { color: #a1423c; border-color: rgba(161,66,60,.35); }
    #${MAP_MODAL_ID} .gal-scene-btn:disabled { opacity: .5; cursor: not-allowed; }
    #${MAP_MODAL_ID} .gal-scene-btn i { margin-right: 5px; }
    #${MAP_MODAL_ID} .gal-scene-fallback-tip {
      padding: 7px 16px; background: #fff6dc; color: #7a5b12; font-size: 0.82rem;
      border-bottom: 1px solid rgba(0,0,0,.06);
    }
    #${MAP_MODAL_ID} .gal-scene-viewport {
      position: relative; flex: 1; overflow: hidden; touch-action: none;
      background: #e8e4d8;
    }
    #${MAP_MODAL_ID} .gal-scene-viewport.dragging { cursor: grabbing; }
    #${MAP_MODAL_ID} .gal-scene-canvas {
      position: absolute; transform-origin: 0 0; will-change: transform;
      border-radius: 6px; box-shadow: 0 6px 24px rgba(0,0,0,.18);
      overflow: hidden;
    }
    #${MAP_MODAL_ID} .gal-scene-svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    #${MAP_MODAL_ID} .gal-scene-marker-layer { position: absolute; inset: 0; pointer-events: none; }
    #${MAP_MODAL_ID} .gal-scene-marker {
      position: absolute; transform: translate(-50%, -100%);
      display: flex; flex-direction: column; align-items: center; gap: 3px;
      pointer-events: auto; cursor: pointer; user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    #${MAP_MODAL_ID} .gal-scene-avatar {
      width: 46px; height: 46px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden; border: 2.5px solid #fff;
      box-shadow: 0 3px 8px rgba(0,0,0,.35); transition: transform .15s;
    }
    #${MAP_MODAL_ID} .gal-scene-marker:hover .gal-scene-avatar { transform: scale(1.14); }
    #${MAP_MODAL_ID} .gal-scene-avatar-img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
    #${MAP_MODAL_ID} .gal-scene-avatar-initial { font-size: 1.2rem; font-weight: 700; color: #fff; }
    #${MAP_MODAL_ID} .gal-scene-marker.protagonist .gal-scene-avatar {
      border-color: #f5c542;
      box-shadow: 0 0 0 2px rgba(245,197,66,.45), 0 3px 8px rgba(0,0,0,.35);
    }
    #${MAP_MODAL_ID} .gal-scene-marker-name {
      font-size: 11px; padding: 1px 8px; border-radius: 999px;
      background: rgba(20,18,26,.78); color: #fff; white-space: nowrap; letter-spacing: 1px;
    }
    #${MAP_MODAL_ID} .gal-scene-marker.protagonist .gal-scene-marker-name { background: rgba(122,89,10,.88); }
    #${MAP_MODAL_ID} .gal-map-zoom-controls {
      position: absolute; right: 14px; bottom: 14px; display: flex; gap: 6px; z-index: 5;
    }
    #${MAP_MODAL_ID} .gal-scene-zoom-btn {
      min-width: 38px; height: 38px; border-radius: 10px; border: 1px solid rgba(0,0,0,.15);
      background: rgba(255,255,255,.92); color: #33302b; cursor: pointer;
      font-size: 1rem; font-weight: 700; padding: 0 10px;
    }
    #${MAP_MODAL_ID} .gal-scene-loading {
      position: absolute; inset: 0; z-index: 6;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
      background: rgba(253,251,246,.88); color: #6b665a; font-size: 0.95rem; letter-spacing: 2px;
    }
    #${MAP_MODAL_ID} .gal-scene-loading .spinner {
      width: 40px; height: 40px; border-radius: 50%;
      border: 3px solid rgba(0,0,0,.1); border-top-color: #7c6e58;
      animation: gal-scene-spin 0.9s linear infinite;
    }
    @keyframes gal-scene-spin { to { transform: rotate(360deg); } }
    /* 深色皮肤 */
    #${MAP_MODAL_ID}.skin-default-dark .gal-scene-panel,
    #${MAP_MODAL_ID}.skin-persona .gal-scene-panel,
    #${MAP_MODAL_ID}.skin-persona-velvet .gal-scene-panel,
    #${MAP_MODAL_ID}.skin-twilight .gal-scene-panel,
    #${MAP_MODAL_ID}.skin-gilded-twilight .gal-scene-panel,
    #${MAP_MODAL_ID}.skin-dawn-twilight .gal-scene-panel,
    #${MAP_MODAL_ID}.skin-shujian-night .gal-scene-panel {
      background: #262430; color: #e2ddd2; border-color: rgba(255,255,255,.1);
    }
    #${MAP_MODAL_ID}.skin-default-dark .gal-scene-viewport,
    #${MAP_MODAL_ID}.skin-persona .gal-scene-viewport,
    #${MAP_MODAL_ID}.skin-twilight .gal-scene-viewport,
    #${MAP_MODAL_ID}.skin-gilded-twilight .gal-scene-viewport,
    #${MAP_MODAL_ID}.skin-dawn-twilight .gal-scene-viewport,
    #${MAP_MODAL_ID}.skin-persona-velvet .gal-scene-viewport,
    #${MAP_MODAL_ID}.skin-shujian-night .gal-scene-viewport { background: #1b1a22; }
    #${MAP_MODAL_ID}.skin-default-dark .gal-scene-btn,
    #${MAP_MODAL_ID}.skin-default-dark .gal-scene-style-select,
    #${MAP_MODAL_ID}.skin-persona .gal-scene-btn,
    #${MAP_MODAL_ID}.skin-persona .gal-scene-style-select,
    #${MAP_MODAL_ID}.skin-twilight .gal-scene-btn,
    #${MAP_MODAL_ID}.skin-twilight .gal-scene-style-select,
    #${MAP_MODAL_ID}.skin-shujian-night .gal-scene-btn,
    #${MAP_MODAL_ID}.skin-shujian-night .gal-scene-style-select {
      background: #322f3d; color: #e2ddd2; border-color: rgba(255,255,255,.14);
    }
    #${MAP_MODAL_ID}.skin-default-dark .gal-scene-loading,
    #${MAP_MODAL_ID}.skin-twilight .gal-scene-loading { background: rgba(30,28,38,.88); color: #b7b2a6; }
    #${MAP_MODAL_ID}.skin-default-dark .gal-scene-time,
    #${MAP_MODAL_ID}.skin-twilight .gal-scene-time { color: #9a95a8; }
    @media (max-width: 768px) {
      #${MAP_MODAL_ID} .gal-scene-panel { width: 100vw; height: 100vh; border-radius: 0; }
      #${MAP_MODAL_ID} .gal-scene-topbar { padding: 10px 12px; gap: 8px; }
      #${MAP_MODAL_ID} .gal-scene-title { font-size: 0.95rem; letter-spacing: 1px; }
      #${MAP_MODAL_ID} .gal-scene-btn .gal-scene-btn-text { display: none; }
      #${MAP_MODAL_ID} .gal-scene-btn i { margin-right: 0; }
    }
  `;
  doc.head.appendChild(style);
}

// 主角名读取（SpriteManager 可能未初始化，做防御）
function getProtagonistNameSafe() {
  try {
    return SpriteManager.protagonistName || SpriteManager.getProtagonistName() || null;
  } catch {
    return null;
  }
}

/**
 * 打开场景线稿地图（对外唯一入口，保持无参可调用）
 */
export async function showMapModal(options = {}) {
  void options;
  ensureMapModalStyle();
  const mountRoot = getModalMountRoot();
  const doc = mountRoot.ownerDocument || topWindow.document;
  $(mountRoot).find(`#${MAP_MODAL_ID}`).remove();

  // ===== 读数据库 =====
  const tableData = getTableData();
  if (!tableData) {
    showToast('未检测到数据库插件接口，无法打开地图');
    return null;
  }

  const sceneInfo = getGlobalSceneInfo(tableData);
  const locationName = sceneInfo.detailedLocation || '未知地点';
  const { present: presentNpcs } = getNpcList(tableData, sceneInfo.detailedLocation);

  // 角色列表：主角在第 0 位（无条件显示）
  const characters = [
    { name: getProtagonistNameSafe() || '主角', isProtagonist: true, gender: '' },
    ...presentNpcs.map(npc => ({ ...npc, isProtagonist: false })),
  ];

  const mapSettings = getMapSettings();
  let currentStyleId = mapSettings.mapSceneStyle || 'auto';

  // ===== 弹窗骨架 =====
  const styleOptionsHtml = SCENE_STYLE_OPTIONS.map(
    opt => `<option value="${escapeHtml(opt.id)}"${opt.id === currentStyleId ? ' selected' : ''}>${escapeHtml(opt.name)}</option>`,
  ).join('');

  const html = `
    <div id="${MAP_MODAL_ID}">
      <div class="gal-scene-panel">
        <div class="gal-scene-topbar">
          <div class="gal-scene-title">
            <i class="fa-solid fa-map-location-dot"></i>
            <span>${escapeHtml(locationName)}</span>
          </div>
          ${sceneInfo.currentTime ? `<span class="gal-scene-time"><i class="fa-regular fa-clock"></i> ${escapeHtml(sceneInfo.currentTime)}</span>` : ''}
          <div class="gal-scene-topbar-spacer"></div>
          <select class="gal-scene-style-select" id="gal-scene-style-select" title="线稿风格">${styleOptionsHtml}</select>
          <button class="gal-scene-btn" id="gal-scene-regen" title="重新生成布局">
            <i class="fa-solid fa-arrows-rotate"></i><span class="gal-scene-btn-text">重新生成</span>
          </button>
          <button class="gal-scene-btn danger" id="gal-scene-close" title="关闭">
            <i class="fa-solid fa-xmark"></i><span class="gal-scene-btn-text">关闭</span>
          </button>
        </div>
        <div class="gal-scene-fallback-tip" id="gal-scene-fallback-tip" style="display:none;">
          <i class="fa-solid fa-triangle-exclamation"></i> AI 布局生成失败，当前为简易布局。可点击「重新生成」重试。
        </div>
        <div class="gal-scene-viewport" id="gal-scene-viewport">
          <div class="gal-scene-canvas" id="gal-scene-canvas"></div>
          <div class="gal-map-zoom-controls">
            <button class="gal-scene-zoom-btn" id="gal-scene-zoom-out" title="缩小">−</button>
            <button class="gal-scene-zoom-btn" id="gal-scene-zoom-reset" title="重置缩放"><span id="gal-scene-zoom-value">100%</span></button>
            <button class="gal-scene-zoom-btn" id="gal-scene-zoom-in" title="放大">＋</button>
          </div>
          <div class="gal-scene-loading" id="gal-scene-loading" style="display:none;">
            <div class="spinner"></div>
            <div>正在根据剧情绘制「${escapeHtml(locationName)}」的地图…</div>
          </div>
        </div>
      </div>
    </div>
  `;
  $(mountRoot).append(html);
  const $modal = $(mountRoot).find(`#${MAP_MODAL_ID}`);
  syncSceneModalSkinClass($modal);

  // ===== 状态 =====
  let renderToken = 0; // 弹窗关闭/重新生成后丢弃旧的异步结果
  let isGenerating = false;
  let currentLayout = null;

  // ===== 缩放平移 =====
  const panzoom = createPanZoomController({
    $modal,
    wrapSelector: '#gal-scene-viewport',
    canvasSelector: '#gal-scene-canvas',
    contentWidth: CANVAS_W,
    contentHeight: CANVAS_H,
    namespace: PANZOOM_NS,
    onZoomChange: scale => {
      const el = $modal.find('#gal-scene-zoom-value')[0];
      if (el) el.textContent = `${Math.round(scale * 100)}%`;
    },
  });

  const closeModal = () => {
    renderToken++;
    panzoom.destroy();
    $modal.remove();
  };

  const setLoading = visible => {
    $modal.find('#gal-scene-loading').toggle(!!visible);
    $modal.find('#gal-scene-regen').prop('disabled', !!visible);
  };

  // ===== 渲染管线 =====
  const renderLayout = layout => {
    currentLayout = layout;
    const style = resolveSceneStyle(currentStyleId);
    const $canvas = $modal.find('#gal-scene-canvas');
    const canvasEl = $canvas[0];
    if (!canvasEl) return;

    canvasEl.innerHTML = '';
    const paperCss = getPaperCss(style);
    $canvas.css({
      background: paperCss.background,
      'background-image': paperCss.backgroundImage || 'none',
      'background-size': paperCss.backgroundSize || 'auto',
    });

    try {
      const svg = renderSceneSvg(doc, layout, style);
      canvasEl.appendChild(svg);
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 场景 SVG 渲染失败:`, e);
    }

    // 角色标记层
    const markerLayer = doc.createElement('div');
    markerLayer.className = 'gal-scene-marker-layer';
    canvasEl.appendChild(markerLayer);
    renderMarkerLayer($(markerLayer), layout, characters);

    $modal.find('#gal-scene-fallback-tip').toggle(!!layout._fallback);
    panzoom.refresh(false);
  };

  // 获取布局（缓存优先，未命中则 LLM 生成）
  const loadAndRender = async ({ forceRegenerate = false } = {}) => {
    if (isGenerating) return;
    const token = ++renderToken;

    if (!forceRegenerate) {
      const cached = loadLayout(sceneInfo.detailedLocation);
      if (cached) {
        console.log(`[${SCRIPT_NAME}] 场景布局命中缓存: ${locationName}`);
        renderLayout(cached);
        return;
      }
    }

    isGenerating = true;
    setLoading(true);
    try {
      const layout = await generateSceneLayout(sceneInfo, presentNpcs);
      if (token !== renderToken) return; // 弹窗已关闭或已被新一轮取代
      if (!layout._fallback && sceneInfo.detailedLocation) {
        saveLayout(sceneInfo.detailedLocation, layout);
      }
      renderLayout(layout);
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 场景布局加载失败:`, e);
      if (token === renderToken) showToast('地图生成失败');
    } finally {
      isGenerating = false;
      if (token === renderToken) setLoading(false);
      else $modal.find('#gal-scene-loading').hide();
    }
  };

  // ===== 事件 =====
  $modal.on('click', function (e) {
    if (e.target === this) closeModal();
  });
  $modal.on('click', '#gal-scene-close', e => {
    e.preventDefault();
    closeModal();
  });

  $modal.on('click', '#gal-scene-zoom-in', () => panzoom.zoomBy(1.25));
  $modal.on('click', '#gal-scene-zoom-out', () => panzoom.zoomBy(1 / 1.25));
  $modal.on('click', '#gal-scene-zoom-reset', () => panzoom.reset());

  // 风格切换：只重渲染，不重新生成
  $modal.on('change', '#gal-scene-style-select', function () {
    currentStyleId = String($(this).val() || 'auto');
    updateMapSettings({ mapSceneStyle: currentStyleId });
    if (currentLayout) renderLayout(currentLayout);
  });

  // 重新生成（确认后删缓存重跑）
  $modal.on('click', '#gal-scene-regen', async () => {
    if (isGenerating) return;
    const confirmed = await showInAppConfirmDialog({
      title: '重新生成地图',
      message: `将根据当前剧情重新绘制「${locationName}」的地图线稿，原有布局会被覆盖。`,
      confirmText: '重新生成',
      iconClass: 'fa-solid fa-arrows-rotate',
    });
    if (!confirmed) return;
    removeLayout(sceneInfo.detailedLocation);
    await loadAndRender({ forceRegenerate: true });
  });

  // 点击角色标记 → 交互弹窗 / 主角状态窗（拖动后的误触被吞掉）
  $modal.on('click', '.gal-scene-marker', function (e) {
    e.stopPropagation();
    if (panzoom.isSuppressedClick()) return;
    const isProtagonist = String($(this).attr('data-protagonist')) === '1';
    if (isProtagonist) {
      showProtagonistStatusModal(tableData, { onActionSent: closeModal });
      return;
    }
    const name = String($(this).attr('data-character') || '');
    const npc = presentNpcs.find(item => item.name === name);
    if (!npc) return;
    showNpcInteractionModal(npc, tableData, { onActionSent: closeModal });
  });

  // ===== 启动 =====
  panzoom.refresh(false);
  await loadAndRender();
  return $modal;
}
