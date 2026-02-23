import { SCRIPT_NAME } from '../core/constants.js';
import { $, topWindow } from '../core/env.js';
import { clearMapCoordsByRegion, getMapCoords, getMapSettings, setMapCoord } from '../core/settings.js';
import { GLOBAL_MAP_REGION_KEY, getUnifiedMapImage } from '../db/map-images.js';
import { generateAutoLayout } from './layout.js';
import { buildMapViewModel } from './data-adapter.js';
import { getModalMountRoot } from '../ui/fullscreen.js';
import { showMapUploadDialog } from '../ui/map-upload.js';
import { showToast } from '../ui/toast.js';

const MAP_MODAL_ID = 'gal-map-system-modal';
const MAP_MODAL_STYLE_ID = 'gal-map-system-modal-style';

function ensureMapModalStyle() {
  const mountRoot = getModalMountRoot();
  const doc = mountRoot.ownerDocument || topWindow.document;
  if (doc.getElementById(MAP_MODAL_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = MAP_MODAL_STYLE_ID;
  style.textContent = `
    #${MAP_MODAL_ID} {
      position: fixed;
      inset: 0;
      z-index: 100020;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      box-sizing: border-box;
      pointer-events: auto;
    }
    #${MAP_MODAL_ID} .gal-map-panel {
      width: min(1240px, 100%);
      height: min(92vh, 920px);
      background: #fff;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
      display: grid;
      grid-template-rows: auto 1fr minmax(260px, 34vh);
    }
    #${MAP_MODAL_ID} .gal-map-topbar {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      padding: 10px 14px;
      border-bottom: 1px solid #e5e7eb;
      background: #f8fafc;
    }
    #${MAP_MODAL_ID} .gal-map-edit-btn {
      border: 1px solid #cbd5e1;
      background: #fff;
      color: #0f172a;
      border-radius: 999px;
      padding: 6px 14px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      min-width: 96px;
    }
    #${MAP_MODAL_ID} .gal-map-edit-btn.active {
      background: #0ea5e9;
      border-color: #0ea5e9;
      color: #fff;
    }
    #${MAP_MODAL_ID} .gal-map-map-area {
      min-height: 0;
      background: #0b1220;
    }
    #${MAP_MODAL_ID} .gal-map-btn {
      border: 1px solid #cbd5e1;
      background: #fff;
      color: #334155;
      border-radius: 8px;
      padding: 6px 10px;
      cursor: pointer;
      font-size: 0.85rem;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    #${MAP_MODAL_ID} .gal-map-btn.primary {
      background: #0ea5e9;
      border-color: #0ea5e9;
      color: #fff;
    }
    #${MAP_MODAL_ID} .gal-map-btn.success {
      background: #16a34a;
      border-color: #16a34a;
      color: #fff;
    }
    #${MAP_MODAL_ID} .gal-map-btn.warn {
      background: #f59e0b;
      border-color: #f59e0b;
      color: #fff;
    }
    #${MAP_MODAL_ID} .gal-map-btn.danger {
      background: #ef4444;
      border-color: #ef4444;
      color: #fff;
    }
    #${MAP_MODAL_ID} .gal-map-canvas-wrap {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #0b1220;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #${MAP_MODAL_ID} .gal-map-canvas {
      position: relative;
      width: 100%;
      height: 100%;
    }
    #${MAP_MODAL_ID} .gal-map-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
      user-select: none;
      pointer-events: none;
      background: #111827;
    }
    #${MAP_MODAL_ID} .gal-map-markers {
      position: absolute;
      inset: 0;
      pointer-events: none;
      contain: layout paint;
    }
    #${MAP_MODAL_ID} .gal-map-marker {
      position: absolute;
      transform: translate(-50%, -100%);
      border: none;
      pointer-events: auto;
      cursor: pointer;
      background: transparent;
      color: #f8fafc;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      max-width: 140px;
      text-align: center;
      padding: 0;
      will-change: left, top;
    }
    #${MAP_MODAL_ID} .gal-map-marker i {
      font-size: 1.2rem;
      color: #f43f5e;
      text-shadow: 0 1px 6px rgba(0, 0, 0, 0.8);
    }
    #${MAP_MODAL_ID} .gal-map-marker .name {
      font-size: 0.72rem;
      background: rgba(15, 23, 42, 0.8);
      border-radius: 4px;
      padding: 2px 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
      box-sizing: border-box;
    }
    #${MAP_MODAL_ID} .gal-map-marker.active i {
      color: #22c55e;
    }
    #${MAP_MODAL_ID} .gal-map-marker.editable {
      cursor: pointer;
    }
    #${MAP_MODAL_ID} .gal-map-marker.placing i {
      animation: gal-map-marker-blink 0.8s ease-in-out infinite;
      color: #f59e0b;
    }
    @keyframes gal-map-marker-blink {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.35; transform: scale(1.15); }
    }
    #${MAP_MODAL_ID} .gal-map-empty {
      text-align: center;
      padding: 24px;
      line-height: 1.8;
      font-size: 0.92rem;
      color: #64748b;
    }
    #${MAP_MODAL_ID} .gal-map-map-area .gal-map-empty {
      color: #cbd5e1;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #0b1220;
    }
    #${MAP_MODAL_ID} .gal-map-inline-btn {
      margin-top: 8px;
    }
    #${MAP_MODAL_ID} .gal-map-interaction {
      min-height: 0;
      border-top: 1px solid #e5e7eb;
      background: #f8fafc;
      display: grid;
      grid-template-rows: auto 1fr;
    }
    #${MAP_MODAL_ID} .gal-map-interaction-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 14px;
      border-bottom: 1px solid #e2e8f0;
      background: #f1f5f9;
    }
    #${MAP_MODAL_ID} .gal-map-info {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      color: #475569;
      font-size: 0.86rem;
      font-weight: 600;
    }
    #${MAP_MODAL_ID} .gal-map-toolbar {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      flex-wrap: wrap;
    }
    #${MAP_MODAL_ID} .gal-map-interaction-body {
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(240px, 320px) 1fr;
      overflow: hidden;
    }
    #${MAP_MODAL_ID} .gal-map-point-list {
      padding: 10px;
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: #f8fafc;
      border-right: 1px solid #e2e8f0;
      min-height: 0;
    }
    #${MAP_MODAL_ID} .gal-map-point-item {
      border: 1px solid #cbd5e1;
      background: #fff;
      color: #1e293b;
      border-radius: 8px;
      text-align: left;
      padding: 8px 10px;
      cursor: pointer;
      font-size: 0.84rem;
    }
    #${MAP_MODAL_ID} .gal-map-empty-list {
      font-size: 0.84rem;
      color: #64748b;
      padding: 8px 4px;
    }
    #${MAP_MODAL_ID} .gal-map-point-item.active {
      border-color: #0ea5e9;
      box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.2);
      background: #eff6ff;
    }
    #${MAP_MODAL_ID} .gal-map-detail {
      min-width: 0;
      min-height: 0;
      overflow: auto;
      padding: 14px;
      background: #f8fafc;
      box-sizing: border-box;
    }
    #${MAP_MODAL_ID} .gal-map-detail-title {
      font-size: 1rem;
      font-weight: 800;
      color: #1f2937;
      margin-bottom: 8px;
    }
    #${MAP_MODAL_ID} .gal-map-kv {
      display: grid;
      grid-template-columns: 88px 1fr;
      gap: 8px;
      font-size: 0.86rem;
      margin-bottom: 6px;
      color: #334155;
    }
    #${MAP_MODAL_ID} .gal-map-kv .key {
      color: #64748b;
      font-weight: 700;
    }
    #${MAP_MODAL_ID} .gal-map-section {
      margin-top: 12px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 10px;
    }
    #${MAP_MODAL_ID} .gal-map-section-title {
      font-size: 0.9rem;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 8px;
    }
    #${MAP_MODAL_ID} .gal-map-element-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px;
      margin-bottom: 8px;
    }
    #${MAP_MODAL_ID} .gal-map-element-name {
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 4px;
      font-size: 0.85rem;
    }
    #${MAP_MODAL_ID} .gal-map-actions-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
    }
    #${MAP_MODAL_ID} .gal-map-op-btn {
      border: 1px solid #93c5fd;
      background: #eff6ff;
      color: #1d4ed8;
      border-radius: 999px;
      padding: 2px 10px;
      font-size: 0.78rem;
      cursor: pointer;
    }
    @media (max-width: 900px) {
      #${MAP_MODAL_ID} .gal-map-panel {
        height: min(96vh, 980px);
      }
      #${MAP_MODAL_ID} .gal-map-panel {
        grid-template-rows: auto minmax(280px, 1fr) minmax(300px, 46vh);
      }
      #${MAP_MODAL_ID} .gal-map-interaction-header {
        align-items: flex-start;
        flex-direction: column;
      }
      #${MAP_MODAL_ID} .gal-map-toolbar {
        width: 100%;
        justify-content: flex-start;
      }
      #${MAP_MODAL_ID} .gal-map-interaction-body {
        grid-template-columns: 1fr;
        grid-template-rows: auto 1fr;
      }
      #${MAP_MODAL_ID} .gal-map-point-list {
        border-right: none;
        border-bottom: 1px solid #e2e8f0;
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(160px, 1fr);
        overflow-x: auto;
        overflow-y: hidden;
      }
    }
  `;
  (doc.head || doc.documentElement).appendChild(style);
}

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function buildMarkerIconClass(markerStyle) {
  return markerStyle === 'dot' ? 'fa-solid fa-circle' : 'fa-solid fa-location-dot';
}

export async function showMapModal(options = {}) {
  ensureMapModalStyle();
  const mountRoot = getModalMountRoot();
  $(mountRoot).find(`#${MAP_MODAL_ID}`).remove();

  const viewModel = buildMapViewModel();
  if (!viewModel.hasAutoCardUpdater) {
    showToast('未检测到骰子系统数据接口，无法打开地图');
    return null;
  }

  const currentRegionKey = String(options.regionKey || viewModel.regionKey || 'default-region').trim() || 'default-region';
  const coordScopeKey = GLOBAL_MAP_REGION_KEY;
  const settings = getMapSettings();
  const markerIconClass = buildMarkerIconClass(settings.mapMarkerStyle);
  const points = Array.isArray(viewModel.points) ? viewModel.points : [];
  const manualCoords = Object.assign({}, getMapCoords(coordScopeKey));
  const autoCoords = generateAutoLayout(points, coordScopeKey, settings.mapLayoutSeed);
  const draftCoords = Object.assign({}, manualCoords);

  const mapRecord = await getUnifiedMapImage();
  let mapImageUrl = '';
  let tempBlobUrl = '';
  if (mapRecord?.imageUrl) {
    mapImageUrl = String(mapRecord.imageUrl);
  } else if (mapRecord?.imageBlob) {
    tempBlobUrl = (topWindow.URL || URL).createObjectURL(mapRecord.imageBlob);
    mapImageUrl = tempBlobUrl;
  }

  let selectedLocation = String(viewModel.currentDetailedLocation || points[0]?.detailedLocation || '').trim();
  let editMode = false;
  let dirty = false;
  let placingLocation = '';
  let layerSyncFrameId = 0;

  const getPointByLocation = (location) => {
    const key = String(location || '').trim();
    return points.find(p => String(p.detailedLocation || '').trim() === key) || null;
  };

  const getCoord = (location) => {
    const key = String(location || '').trim();
    if (!key) return { x: 0.5, y: 0.5 };
    const manual = draftCoords[key];
    if (manual && Number.isFinite(Number(manual.x)) && Number.isFinite(Number(manual.y))) {
      return { x: clamp01(manual.x), y: clamp01(manual.y) };
    }
    const auto = autoCoords[key];
    if (auto && Number.isFinite(Number(auto.x)) && Number.isFinite(Number(auto.y))) {
      return { x: clamp01(auto.x), y: clamp01(auto.y) };
    }
    return { x: 0.5, y: 0.5 };
  };

  const buildPointListHtml = () => {
    const listHtml = points.map(point => {
      const location = String(point.detailedLocation || '').trim();
      const active = location && location === selectedLocation ? 'active' : '';
      return `<button class="gal-map-point-item ${active}" data-location="${location}">${location}</button>`;
    }).join('');
    return listHtml || '<div class="gal-map-empty-list">暂无地点数据</div>';
  };

  const buildMarkersHtml = () => {
    return points.map(point => {
      const location = String(point.detailedLocation || '').trim();
      if (!location) return '';
      const coord = getCoord(location);
      const active = location === selectedLocation ? 'active' : '';
      const editable = editMode ? 'editable' : '';
      return `
        <button class="gal-map-marker ${active} ${editable}" data-location="${location}" style="left:${(coord.x * 100).toFixed(4)}%; top:${(coord.y * 100).toFixed(4)}%;">
          <i class="${markerIconClass}"></i>
          <span class="name">${location}</span>
        </button>
      `;
    }).join('');
  };

  const buildDetailHtml = () => {
    const point = getPointByLocation(selectedLocation);
    if (!point) {
      return `<div class="gal-map-empty">暂无可显示地点</div>`;
    }
    const pointActions = Array.isArray(viewModel.pointActionsByLocation?.[selectedLocation]) ? viewModel.pointActionsByLocation[selectedLocation] : [];
    const elementActions = Array.isArray(viewModel.actionsByLocation?.[selectedLocation]) ? viewModel.actionsByLocation[selectedLocation] : [];
    const envText = String(point.envDesc || '').trim() || '（无）';
    const locationType = String(point.locationType || '').trim() || '未标注';
    const secRegion = String(point.secondaryRegion || '').trim() || '未标注';
    const importance = String(point.importance || '').trim() || '未标注';
    const explore = String(point.exploreState || '').trim() || '未标注';
    const pointActionButtons = pointActions.map(action => {
      const safeAction = String(action || '').trim();
      if (!safeAction) return '';
      return `<button class="gal-map-op-btn" data-location="${selectedLocation}" data-action="${safeAction}" data-element="">${safeAction}</button>`;
    }).join('');
    const pointActionSection = pointActionButtons
      ? `<div class="gal-map-actions-row acu-card-actions">${pointActionButtons}</div>`
      : `<div style="font-size:0.84rem; color:#64748b;">该地点暂无可用操作。</div>`;

    const elementActionSection = elementActions.length > 0
      ? elementActions.map((item, idx) => {
        const elementName = String(item.elementName || '').trim() || `元素${idx + 1}`;
        const elementType = String(item.elementType || '').trim();
        const status = String(item.status || '').trim();
        const desc = String(item.description || '').trim();
        const actionButtons = (Array.isArray(item.actions) ? item.actions : []).map(action => {
          const safeAction = String(action || '').trim();
          if (!safeAction) return '';
          return `<button class="gal-map-op-btn" data-location="${selectedLocation}" data-action="${safeAction}" data-element="${elementName}">${safeAction}</button>`;
        }).join('');
        return `
          <div class="gal-map-element-card">
            <div class="gal-map-element-name">${elementName}${elementType ? ` · ${elementType}` : ''}</div>
            ${status ? `<div class="gal-map-kv"><span class="key">状态</span><span>${status}</span></div>` : ''}
            ${desc ? `<div style="font-size:0.82rem; color:#475569;">${desc}</div>` : ''}
            ${actionButtons ? `<div class="gal-map-actions-row acu-card-actions">${actionButtons}</div>` : ''}
          </div>
        `;
      }).join('')
      : `<div style="font-size:0.84rem; color:#64748b;">该地点暂无可交互元素。</div>`;

    return `
      <div class="gal-map-detail-title">${selectedLocation}</div>
      <div class="gal-map-kv"><span class="key">次要地区</span><span>${secRegion}</span></div>
      <div class="gal-map-kv"><span class="key">地点类型</span><span>${locationType}</span></div>
      <div class="gal-map-kv"><span class="key">重要度</span><span>${importance}</span></div>
      <div class="gal-map-kv"><span class="key">探索状态</span><span>${explore}</span></div>
      <div class="gal-map-kv"><span class="key">环境描述</span><span>${envText}</span></div>
      <div class="gal-map-section">
        <div class="gal-map-section-title">地点操作</div>
        ${pointActionSection}
      </div>
      <div class="gal-map-section">
        <div class="gal-map-section-title">可操作元素</div>
        ${elementActionSection}
      </div>
    `;
  };

  const html = `
    <div id="${MAP_MODAL_ID}">
      <div class="gal-map-panel">
        <div class="gal-map-topbar">
          <button class="gal-map-edit-btn" id="gal-map-toggle-edit">[ edit ]</button>
        </div>
        <div class="gal-map-map-area">
          <div class="gal-map-canvas-wrap">
            ${mapImageUrl
      ? `
                <div class="gal-map-canvas" id="gal-map-canvas">
                  <img class="gal-map-image" src="${mapImageUrl}" alt="world-map">
                  <div class="gal-map-markers" id="gal-map-markers">${buildMarkersHtml()}</div>
                </div>
              `
      : `
                <div class="gal-map-empty">
                  <div>尚未上传统一世界地图</div>
                  <div>点击下方“上传/替换地图”或直接使用此按钮</div>
                  <button class="gal-map-btn primary gal-map-inline-btn gal-map-open-upload-inline">
                    <i class="fa-solid fa-cloud-arrow-up"></i>上传/替换地图
                  </button>
                </div>
              `}
          </div>
        </div>
        <div class="gal-map-interaction">
          <div class="gal-map-interaction-header">
            <div class="gal-map-info">
              <span><i class="fa-solid fa-map-location-dot"></i> 统一世界地图</span>
              <span>当前区域：${currentRegionKey}</span>
              <span>${points.length} 个地点</span>
            </div>
            <div class="gal-map-toolbar">
              <button class="gal-map-btn primary" id="gal-map-open-upload"><i class="fa-solid fa-cloud-arrow-up"></i>上传/替换地图</button>
              <button class="gal-map-btn warn" id="gal-map-reset-layout"><i class="fa-solid fa-arrows-rotate"></i>重置自动布局</button>
              <button class="gal-map-btn success" id="gal-map-save-coords" style="display:none;"><i class="fa-solid fa-floppy-disk"></i>保存坐标</button>
              <button class="gal-map-btn danger" id="gal-map-close-btn"><i class="fa-solid fa-xmark"></i>关闭</button>
            </div>
          </div>
          <div class="gal-map-interaction-body">
            <div class="gal-map-point-list" id="gal-map-point-list">${buildPointListHtml()}</div>
            <div class="gal-map-detail" id="gal-map-detail-panel">${buildDetailHtml()}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  $(mountRoot).append(html);
  const $modal = $(mountRoot).find(`#${MAP_MODAL_ID}`);
  const $win = $(topWindow);

  const getMapCanvasElement = () => $modal.find('#gal-map-canvas')[0] || null;
  const getMapImageElement = () => $modal.find('.gal-map-image')[0] || null;

  const getDisplayedImageRect = () => {
    const canvas = getMapCanvasElement();
    const image = getMapImageElement();
    if (!canvas || !image) return null;
    const canvasRect = canvas.getBoundingClientRect();
    if (canvasRect.width <= 0 || canvasRect.height <= 0) return null;
    const naturalWidth = Number(image.naturalWidth) || canvasRect.width;
    const naturalHeight = Number(image.naturalHeight) || canvasRect.height;
    if (naturalWidth <= 0 || naturalHeight <= 0) return null;
    const scale = Math.min(canvasRect.width / naturalWidth, canvasRect.height / naturalHeight);
    const width = naturalWidth * scale;
    const height = naturalHeight * scale;
    const left = canvasRect.left + (canvasRect.width - width) / 2;
    const top = canvasRect.top + (canvasRect.height - height) / 2;
    return { left, top, width, height };
  };

  const syncMarkerLayerBounds = () => {
    if (!mapImageUrl) return;
    const canvas = getMapCanvasElement();
    const imageRect = getDisplayedImageRect();
    const layer = $modal.find('#gal-map-markers')[0];
    if (!canvas || !layer || !imageRect) return;
    const canvasRect = canvas.getBoundingClientRect();
    layer.style.left = `${(imageRect.left - canvasRect.left).toFixed(3)}px`;
    layer.style.top = `${(imageRect.top - canvasRect.top).toFixed(3)}px`;
    layer.style.width = `${imageRect.width.toFixed(3)}px`;
    layer.style.height = `${imageRect.height.toFixed(3)}px`;
  };

  const updateListActiveState = () => {
    $modal.find('.gal-map-point-item').removeClass('active');
    $modal.find(`.gal-map-point-item[data-location="${selectedLocation}"]`).addClass('active');
  };

  const rerenderMarkers = () => {
    if (!mapImageUrl) return;
    $modal.find('#gal-map-markers').html(buildMarkersHtml());
    syncMarkerLayerBounds();
    syncPlacingUi();
  };

  const rerenderDetail = () => {
    $modal.find('#gal-map-detail-panel').html(buildDetailHtml());
    updateListActiveState();
  };

  const syncPlacingUi = () => {
    $modal.find('.gal-map-marker').removeClass('placing');
    if (!editMode || !placingLocation) return;
    $modal.find(`.gal-map-marker[data-location="${placingLocation}"]`).addClass('placing');
  };

  const syncEditUi = () => {
    const showUploadBtn = editMode;
    $modal.find('#gal-map-toggle-edit')
      .toggleClass('active', editMode)
      .text(editMode ? '[ editing ]' : '[ edit ]');
    $modal.find('#gal-map-open-upload').toggle(showUploadBtn);
    $modal.find('#gal-map-save-coords').toggle(editMode || dirty);
    $modal.find('#gal-map-reset-layout').toggle(editMode || dirty);
    $modal.find('.gal-map-marker').toggleClass('editable', editMode);
    syncPlacingUi();
  };

  const requestFrame = (callback) => {
    if (typeof topWindow?.requestAnimationFrame === 'function') {
      return topWindow.requestAnimationFrame(callback);
    }
    return topWindow.setTimeout(callback, 16);
  };

  const cancelFrame = (id) => {
    if (!id) return;
    if (typeof topWindow?.cancelAnimationFrame === 'function') {
      topWindow.cancelAnimationFrame(id);
      return;
    }
    topWindow.clearTimeout(id);
  };

  const scheduleLayerSync = () => {
    if (layerSyncFrameId) return;
    layerSyncFrameId = requestFrame(() => {
      layerSyncFrameId = 0;
      syncMarkerLayerBounds();
    });
  };

  const placeSelectedMarkerAt = (clientX, clientY) => {
    if (!editMode || !placingLocation) return false;
    const rect = getDisplayedImageRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;
    const x = clamp01((clientX - rect.left) / rect.width);
    const y = clamp01((clientY - rect.top) / rect.height);
    const targetLocation = placingLocation;
    draftCoords[targetLocation] = { x, y, anchor: '' };
    dirty = true;
    placingLocation = '';
    rerenderMarkers();
    syncEditUi();
    showToast(`已放置「${targetLocation}」`);
    return true;
  };

  const setEditMode = (nextEditMode) => {
    editMode = !!nextEditMode;
    if (!editMode) {
      placingLocation = '';
    }
    syncEditUi();
    showToast(editMode ? '已进入点位编辑模式：先点击地点，再点击地图放置' : '已退出点位编辑模式');
  };

  const closeModal = () => {
    $win.off('.galMapMap');
    cancelFrame(layerSyncFrameId);
    layerSyncFrameId = 0;
    $modal.find('.gal-map-image').off('.galMapMap');
    if (tempBlobUrl) {
      try { (topWindow.URL || URL).revokeObjectURL(tempBlobUrl); } catch (e) { /* ignore */ }
    }
    $modal.remove();
  };

  syncEditUi();
  if (mapImageUrl) {
    const $mapImage = $modal.find('.gal-map-image');
    $mapImage.on('load.galMapMap', scheduleLayerSync);
    if ($mapImage[0]?.complete) {
      scheduleLayerSync();
    }
    $win.on('resize.galMapMap', scheduleLayerSync);
  }

  $modal.on('click', function (e) {
    if (e.target === this) closeModal();
  });

  $modal.on('click', '#gal-map-close-btn', function (e) {
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  });

  $modal.on('click', '#gal-map-open-upload, .gal-map-open-upload-inline', function (e) {
    e.preventDefault();
    e.stopPropagation();
    showMapUploadDialog({
      onSaved: () => {
        closeModal();
        showMapModal({ regionKey: currentRegionKey });
      },
    });
  });

  $modal.on('click', '#gal-map-toggle-edit', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (!mapImageUrl) {
      showToast('当前无地图图片，先上传地图');
      showMapUploadDialog({
        onSaved: () => {
          closeModal();
          showMapModal({ regionKey: currentRegionKey });
        },
      });
      return;
    }
    setEditMode(!editMode);
  });

  $modal.on('click', '#gal-map-reset-layout', function (e) {
    e.preventDefault();
    e.stopPropagation();
    clearMapCoordsByRegion(coordScopeKey);
    Object.keys(draftCoords).forEach(key => delete draftCoords[key]);
    dirty = false;
    placingLocation = '';
    rerenderMarkers();
    rerenderDetail();
    syncEditUi();
    showToast('已清除手动坐标，恢复自动布局');
  });

  $modal.on('click', '#gal-map-save-coords', function (e) {
    e.preventDefault();
    e.stopPropagation();
    let changed = 0;
    Object.entries(draftCoords).forEach(([location, coord]) => {
      if (setMapCoord(coordScopeKey, location, coord)) {
        changed++;
      }
    });
    dirty = false;
    placingLocation = '';
    syncEditUi();
    showToast(changed > 0 ? `已保存 ${changed} 个地点坐标` : '没有可保存的坐标变更');
  });

  $modal.on('click', '.gal-map-point-item', function () {
    const location = String($(this).data('location') || '').trim();
    if (!location) return;
    selectedLocation = location;
    if (editMode) {
      placingLocation = location;
    }
    rerenderMarkers();
    rerenderDetail();
    if (editMode) {
      showToast(`已选中「${location}」，请点击地图放置`);
    }
  });

  $modal.on('click', '.gal-map-marker', function (e) {
    const location = String($(this).data('location') || '').trim();
    if (!location) return;
    const shouldNotify = editMode && placingLocation !== location;
    selectedLocation = location;
    if (editMode) {
      placingLocation = location;
    }
    rerenderMarkers();
    rerenderDetail();
    if (editMode) {
      if (shouldNotify) {
        showToast(`已选中「${location}」，请点击地图放置`);
      }
      e.preventDefault();
      e.stopPropagation();
    }
  });

  $modal.on('click', '#gal-map-canvas', function (e) {
    if (!editMode || !placingLocation) return;
    if ($(e.target).closest('.gal-map-marker').length) return;
    const placed = placeSelectedMarkerAt(e.clientX, e.clientY);
    if (!placed) return;
    e.preventDefault();
    e.stopPropagation();
  });

  $modal.on('click', '.gal-map-op-btn', function () {
    const location = String($(this).data('location') || '').trim();
    const action = String($(this).data('action') || '').trim();
    const element = String($(this).data('element') || '').trim();
    if (!location || !action) return;
    const text = element ? `【${location}】对「${element}」执行：${action}` : `【${location}】${action}`;
    const $sendTextarea = $(topWindow.document).find('#send_textarea');
    const $sendButton = $(topWindow.document).find('#send_but');
    if (!$sendTextarea.length || !$sendButton.length) {
      showToast('未找到发送输入框或发送按钮');
      return;
    }
    const currentVal = String($sendTextarea.val() || '').trim();
    const nextVal = currentVal ? `${currentVal} ${text}` : text;
    $sendTextarea.val(nextVal).trigger('input').trigger('change');
    $sendButton.trigger('click');
    showToast('已发送操作');
  });

  return $modal;
}
