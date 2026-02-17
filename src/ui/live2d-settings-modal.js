import { SCRIPT_NAME, THEME } from '../core/constants.js';
import { topWindow, $ } from '../core/env.js';
import { getLive2DConfig, setLive2DConfig, normalizeLive2DScaleBase } from '../live2d/render-mode.js';
import { Live2DManager } from '../live2d/manager.js';
import { Live2DStage } from '../live2d/stage.js';
import { Live2DPositionEditor } from '../live2d/position-editor.js';
import { EXPRESSION_LIVE2D_MAP, matchLive2DExpression, matchLive2DMotion, getLive2DExpressionList, getLive2DMotionGroups } from '../live2d/expression-motion.js';
import { getAllExpressions } from '../utils/expressions.js';
import { getModalMountRoot } from './fullscreen.js';

// ============================================
// Live2D 设置弹窗
// ============================================

export async function showLive2DSettingsModal(characterId) {
  const _$ = topWindow.jQuery || $;

  const config = getLive2DConfig(characterId);
  const transformConfig = config.transform || {};
  const transformScaleBase = normalizeLive2DScaleBase(transformConfig.scaleBase);
  const qualityConfig = config.quality || {};
  const expressionMapping = config.expressionMapping || {};
  const motionMapping = config.motionMapping || {};
  const EMPTY_MOTION_GROUP_VALUE = '__gal_empty_motion_group__';
  const EMPTY_TAG_FALLBACK = '(空标签)';

  let expressionList = [];
  let motionGroups = [];
  let draftExpressionMapping = { ...expressionMapping };
  let draftMotionMapping = { ...motionMapping };
  let previewMounted = false;
  let previewMountPromise = null;
  let previewZoomFactor = 1.8;
  let previewPanOffsetX = 0;
  let previewPanOffsetY = 0;
  let previewBasePose = { x: 0, y: 0, scale: 1 };
  let previewIsDragging = false;
  let previewDragStart = { x: 0, y: 0 };
  let previewDragOrigin = { x: 0, y: 0 };
  let previewRequestToken = 0;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case '\'':
        return '&#39;';
      default:
        return char;
    }
  });

  const normalizeTextValue = (value) => String(value ?? '').trim();

  const buildMappingTagList = () => {
    const tags = [];
    const seen = new Set();
    const push = (value) => {
      const normalized = normalizeTextValue(value);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      tags.push(normalized);
    };

    const expressionTags = getAllExpressions();
    if (Array.isArray(expressionTags)) {
      for (const tag of expressionTags) push(tag);
    }
    for (const tag of Object.keys(EXPRESSION_LIVE2D_MAP || {})) push(tag);
    for (const tag of Object.keys(draftExpressionMapping || {})) push(tag);
    for (const tag of Object.keys(draftMotionMapping || {})) push(tag);

    return tags;
  };

  const applyRowSelectValues = ($mappingContainer) => {
    $mappingContainer.find('.gal-expr-mapping-select').each(function() {
      const current = normalizeTextValue(_$(this).data('current'));
      if (current) {
        _$(this).val(current);
      } else {
        _$(this).val('');
      }
    });

    $mappingContainer.find('.gal-motion-mapping-select').each(function() {
      const current = normalizeTextValue(_$(this).data('current'));
      const disabled = _$(this).data('disabled') === true || _$(this).data('disabled') === 'true';
      const hasGroup = _$(this).data('hasGroup') === true || _$(this).data('hasGroup') === 'true';
      if (disabled) {
        _$(this).val('__disabled__');
      } else if (hasGroup && current === '') {
        _$(this).val(EMPTY_MOTION_GROUP_VALUE);
      } else if (current) {
        _$(this).val(current);
      } else {
        _$(this).val('');
      }
    });
  };

  const syncDraftMappingsFromDom = () => {
    const $modal = _$('#gal-live2d-settings-modal');
    if (!$modal.length) return;
    const $mappingContainer = $modal.find('#gal-mapping-rows');
    if (!$mappingContainer.length) return;
    const $rows = $mappingContainer.find('.gal-mapping-row');
    if (!$rows.length) return;

    const nextExpressionMapping = {};
    const nextMotionMapping = {};

    $rows.each(function() {
      const $row = _$(this);
      const tag = normalizeTextValue($row.data('tag'));
      if (!tag) return;

      const exprRaw = $row.find('.gal-expr-mapping-select').val();
      const exprValue = exprRaw === null || exprRaw === undefined ? '' : String(exprRaw);
      if (exprValue) {
        nextExpressionMapping[tag] = exprValue;
      }

      const motionRaw = $row.find('.gal-motion-mapping-select').val();
      const motionValue = motionRaw === null || motionRaw === undefined ? '' : String(motionRaw);
      if (motionValue === '__disabled__') {
        nextMotionMapping[tag] = { enabled: false };
      } else if (motionValue || motionValue === EMPTY_MOTION_GROUP_VALUE) {
        const motionGroup = motionValue === EMPTY_MOTION_GROUP_VALUE ? '' : motionValue;
        nextMotionMapping[tag] = { group: motionGroup, index: 0, enabled: true };
      }
    });

    draftExpressionMapping = nextExpressionMapping;
    draftMotionMapping = nextMotionMapping;
  };

  const buildMappingRows = () => {
    const existingMappings = { ...draftExpressionMapping };
    const existingMotionMappings = { ...draftMotionMapping };
    let rows = '';

    const allTags = buildMappingTagList();

    const exprOptionsHtml = expressionList.length > 0
      ? expressionList.map((name) => {
        const normalized = String(name ?? '');
        return `<option value="${escapeHtml(normalized)}">${escapeHtml(normalized)}</option>`;
      }).join('')
      : '';
    const motionOptionsHtml = motionGroups.length > 0
      ? motionGroups.map(groupName => {
        const rawGroup = String(groupName ?? '');
        const value = rawGroup === '' ? EMPTY_MOTION_GROUP_VALUE : rawGroup;
        const label = rawGroup === '' ? '(空动作组)' : rawGroup;
        return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
      }).join('')
      : '';

    for (const tag of allTags) {
      const currentExpr = existingMappings[tag] || '';
      const currentMotion = existingMotionMappings[tag] || {};
      const hasMotionGroup = Object.prototype.hasOwnProperty.call(currentMotion, 'group');
      const currentMotionGroup = Object.prototype.hasOwnProperty.call(currentMotion, 'group')
        ? String(currentMotion.group ?? '')
        : '';
      const safeTag = escapeHtml(tag || EMPTY_TAG_FALLBACK);
      const safeCurrentExpr = escapeHtml(String(currentExpr ?? ''));
      const safeCurrentMotionGroup = escapeHtml(String(currentMotionGroup ?? ''));
      const safeDisabled = currentMotion.enabled === false ? 'true' : 'false';
      const safeHasGroup = hasMotionGroup ? 'true' : 'false';

      rows += `
        <div class="gal-mapping-row" data-tag="${safeTag}" style="display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.1);">
          <span style="min-width: 60px; font-weight: 600;">${safeTag}</span>
          <span style="color: #666;">→</span>
          <select class="gal-expr-mapping-select" data-tag="${safeTag}" data-current="${safeCurrentExpr}" style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
            <option value="">(自动匹配)</option>
            ${exprOptionsHtml}
          </select>
          <select class="gal-motion-mapping-select" data-tag="${safeTag}" data-current="${safeCurrentMotionGroup}" data-disabled="${safeDisabled}" data-has-group="${safeHasGroup}" style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
            <option value="">(自动匹配)</option>
            <option value="__disabled__">(禁用动作)</option>
            ${motionOptionsHtml}
          </select>
          <button type="button" class="gal-mapping-preview-btn" data-tag="${safeTag}" title="预览该标签" style="width: 32px; height: 32px; border: 1px solid #0ea5e9; border-radius: 6px; background: #e0f2fe; color: #0369a1; cursor: pointer; flex-shrink: 0;">
            <i class="fa-solid fa-play"></i>
          </button>
        </div>
      `;
    }

    return rows;
  };

  const renderMappingRows = async ({ previewAfterRender = false } = {}) => {
    const $modal = _$('#gal-live2d-settings-modal');
    if (!$modal.length) return;
    const $mappingContainer = $modal.find('#gal-mapping-rows');
    if (!$mappingContainer.length) return;

    syncDraftMappingsFromDom();
    const rowsHtml = buildMappingRows();
    $mappingContainer.html(rowsHtml);
    applyRowSelectValues($mappingContainer);
    bindMappingContainerEvents($mappingContainer);
    $mappingContainer.data('loaded', true);

    if (previewAfterRender) {
      await ensureMappingPreviewMounted();
      await previewFirstTagIfExists();
    }
  };

  const loadModelDataAsync = async () => {
    try {
      let model = Live2DManager.models.get(characterId);
      if (!model) {
        model = await Live2DManager.loadModel(characterId);
      }

      expressionList = getLive2DExpressionList(characterId);
      motionGroups = getLive2DMotionGroups(characterId);

      const $modal = _$('#gal-live2d-settings-modal');
      if ($modal.length) {
        $modal.find('.gal-model-info-expr').text(expressionList.length);
        $modal.find('.gal-model-info-motion').text(motionGroups.length);
        const activeTab = $modal.find('.gal-settings-tab.active').data('tab');
        await renderMappingRows({ previewAfterRender: activeTab === 'mapping' });
      }
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 加载模型数据失败:`, e);
    }
  };

  const modalHtml = `
    <div id="gal-live2d-settings-modal" class="gal-z-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;">
      <style>
        #gal-live2d-settings-modal .gal-live2d-mapping-layout {
          display: flex;
          gap: 14px;
          align-items: stretch;
          min-height: 360px;
        }
        #gal-live2d-settings-modal .gal-live2d-mapping-left {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        #gal-live2d-settings-modal .gal-live2d-mapping-right {
          width: 320px;
          flex: 0 0 320px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          background: #f8fafc;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        #gal-live2d-settings-modal .gal-mapping-row.previewing {
          background: rgba(0, 210, 255, 0.08);
        }
        #gal-live2d-settings-modal .gal-live2d-preview-canvas {
          position: relative;
          width: 100%;
          height: 260px;
          border-radius: 8px;
          overflow: hidden;
          background: radial-gradient(circle at 30% 20%, #1e293b, #0f172a 70%);
          cursor: grab;
          user-select: none;
          touch-action: none;
        }
        #gal-live2d-settings-modal .gal-live2d-preview-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 0.8rem;
          color: #475569;
        }
        #gal-live2d-settings-modal .gal-live2d-preview-tools {
          display: flex;
          gap: 8px;
        }
        #gal-live2d-settings-modal .gal-live2d-preview-tools button {
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: #fff;
          color: #334155;
          padding: 6px 10px;
          cursor: pointer;
          font-size: 0.8rem;
        }
        #gal-live2d-settings-modal .gal-live2d-preview-zoom-wrap {
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 1;
          min-width: 0;
        }
        #gal-live2d-settings-modal #gal-live2d-preview-zoom {
          flex: 1;
          min-width: 90px;
        }
        #gal-live2d-settings-modal #gal-live2d-preview-zoom-value {
          min-width: 44px;
          text-align: right;
          font-size: 0.76rem;
          color: #475569;
        }
        #gal-live2d-settings-modal #gal-live2d-preview-status {
          display: block;
          color: #64748b;
          font-size: 0.78rem;
          min-height: 18px;
        }
        @media screen and (max-width: 900px) {
          #gal-live2d-settings-modal .gal-live2d-mapping-layout {
            flex-direction: column;
            min-height: 0;
          }
          #gal-live2d-settings-modal .gal-live2d-mapping-right {
            width: 100%;
            flex: 0 0 auto;
          }
          #gal-live2d-settings-modal #gal-mapping-rows {
            max-height: 260px !important;
          }
        }
      </style>
      <div style="background: #fff; border-radius: 12px; width: 92%; max-width: 1080px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
        <!-- 头部 -->
        <div style="padding: 16px 20px; background: linear-gradient(135deg, ${THEME.accent}, ${THEME.accentSub}); color: #fff; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700; font-size: 1.1rem;">
            <i class="fa-solid fa-cog"></i> Live2D 设置 - ${characterId}
          </span>
          <button id="gal-live2d-settings-close" style="background: none; border: none; color: #fff; font-size: 1.2rem; cursor: pointer;">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>

        <!-- 标签页导航 -->
        <div style="display: flex; border-bottom: 1px solid #e0e0e0; background: #f8f8f8;">
          <button class="gal-settings-tab active" data-tab="transform" style="flex: 1; padding: 12px; border: none; background: none; cursor: pointer; font-weight: 600; color: ${THEME.accent}; border-bottom: 2px solid ${THEME.accent};">
            常规设置
          </button>
          <button class="gal-settings-tab" data-tab="mapping" style="flex: 1; padding: 12px; border: none; background: none; cursor: pointer; font-weight: 600; color: #666; border-bottom: 2px solid transparent;">
            表情映射
          </button>
          <button class="gal-settings-tab" data-tab="quality" style="flex: 1; padding: 12px; border: none; background: none; cursor: pointer; font-weight: 600; color: #666; border-bottom: 2px solid transparent;">
            高级设置
          </button>
        </div>

        <!-- 标签页内容 -->
        <div style="flex: 1; overflow-y: auto; padding: 20px;">
          <!-- 常规设置 -->
          <div class="gal-settings-panel" data-panel="transform">
            <div style="margin-bottom: 20px;">
              <h4 style="margin: 0 0 12px 0; color: ${THEME.dark};">位置与大小</h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                  <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 0.9rem; color: #333;">X 偏移 (像素)</label>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="gal-offset-btn" data-dir="x" data-delta="-10" style="padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">-10</button>
                    <input type="number" id="gal-live2d-offset-x" value="${transformConfig.offsetX || 0}" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; text-align: center;">
                    <button class="gal-offset-btn" data-dir="x" data-delta="10" style="padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">+10</button>
                  </div>
                </div>
                <div>
                  <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 0.9rem; color: #333;">Y 偏移 (像素)</label>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="gal-offset-btn" data-dir="y" data-delta="-10" style="padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">-10</button>
                    <input type="number" id="gal-live2d-offset-y" value="${transformConfig.offsetY || 0}" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; text-align: center;">
                    <button class="gal-offset-btn" data-dir="y" data-delta="10" style="padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">+10</button>
                  </div>
                </div>
              </div>
              <div style="margin-top: 15px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 0.9rem; color: #333;">缩放倍率: <span id="gal-live2d-scale-value">${(transformConfig.scale || 1.0).toFixed(1)}x</span></label>
                <input type="range" id="gal-live2d-scale" min="0.5" max="2.0" step="0.1" value="${transformConfig.scale || 1.0}" style="width: 100%;">
              </div>
              <div style="margin-top: 15px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 0.9rem; color: #333;">缩放基准</label>
                <select id="gal-live2d-scale-base" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                  <option value="height" ${transformScaleBase === 'height' ? 'selected' : ''}>按高度 (height，推荐)</option>
                  <option value="fit" ${transformScaleBase === 'fit' ? 'selected' : ''}>适应容器 (fit)</option>
                </select>
              </div>
              <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                <button id="gal-live2d-reset-transform" style="padding: 8px 16px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">
                  <i class="fa-solid fa-undo"></i> 重置为默认
                </button>
                <button id="gal-live2d-start-position-edit" style="padding: 8px 16px; background: linear-gradient(135deg, #00d2ff, #3a7bd5); color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">
                  <i class="fa-solid fa-arrows-alt"></i> 开始调整位置
                </button>
              </div>
            </div>

          </div>

          <!-- 表情映射 -->
          <div class="gal-settings-panel" data-panel="mapping" style="display: none;">
            <div class="gal-live2d-mapping-layout">
              <div class="gal-live2d-mapping-left">
                <div style="margin-bottom: 12px;">
                  <h4 style="margin: 0 0 8px 0; color: ${THEME.dark};">表情标签映射</h4>
                  <p style="margin: 0; color: #666; font-size: 0.85rem;">将游戏表情标签映射到 Live2D 表情和动作，右侧会实时预览当前选择。</p>
                </div>
                <div id="gal-mapping-rows" style="max-height: 360px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 10px;">
                  <div style="text-align: center; padding: 30px; color: #999;">
                    <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; margin-bottom: 10px; display: block;"></i>
                    正在加载模型数据...
                  </div>
                </div>
                <div style="margin-top: 12px; display: flex; gap: 10px;">
                  <button id="gal-live2d-auto-match" style="padding: 8px 16px; background: ${THEME.accent}; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
                    <i class="fa-solid fa-magic"></i> 自动匹配全部
                  </button>
                  <button id="gal-live2d-clear-mapping" style="padding: 8px 16px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">
                    <i class="fa-solid fa-trash"></i> 清空映射
                  </button>
                </div>
              </div>

              <div class="gal-live2d-mapping-right">
                <div class="gal-live2d-preview-meta">
                  <span><i class="fa-solid fa-eye"></i> 模型预览</span>
                  <span>标签: <strong id="gal-live2d-preview-tag">-</strong></span>
                </div>
                <div id="gal-live2d-preview-canvas" class="gal-live2d-preview-canvas">
                  <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: rgba(255,255,255,0.88); font-size: 0.85rem;">
                    切换到“表情映射”后自动加载预览
                  </div>
                </div>
                <div class="gal-live2d-preview-tools">
                  <div class="gal-live2d-preview-zoom-wrap">
                    <span style="font-size: 0.76rem; color: #475569;">缩放</span>
                    <input type="range" id="gal-live2d-preview-zoom" min="0.5" max="4" step="0.05" value="1.8">
                    <span id="gal-live2d-preview-zoom-value">180%</span>
                  </div>
                  <button id="gal-live2d-preview-reset-view" type="button">
                    <i class="fa-solid fa-up-down-left-right"></i> 重置视图
                  </button>
                  <button id="gal-live2d-preview-replay" type="button">
                    <i class="fa-solid fa-rotate-right"></i> 重播当前标签
                  </button>
                </div>
                <small style="color: #64748b; font-size: 0.72rem;">提示: 拖拽预览区可移动模型，滚轮可缩放。</small>
                <small id="gal-live2d-preview-status">准备中</small>
              </div>
            </div>
          </div>

          <!-- 高级设置 -->
          <div class="gal-settings-panel" data-panel="quality" style="display: none;">
            <div style="margin-bottom: 20px;">
              <h4 style="margin: 0 0 12px 0; color: ${THEME.dark};">纹理精度</h4>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="radio" name="textureResolution" value="0.5" ${qualityConfig.textureResolution === 0.5 ? 'checked' : ''}>
                  <span>低 (0.5x) - 加载更快，节省内存</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="radio" name="textureResolution" value="1.0" ${(!qualityConfig.textureResolution || qualityConfig.textureResolution === 1.0) ? 'checked' : ''}>
                  <span>正常 (1.0x) - 推荐</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="radio" name="textureResolution" value="2.0" ${qualityConfig.textureResolution === 2.0 ? 'checked' : ''}>
                  <span>高 (2.0x) - 画质更好，但加载较慢</span>
                </label>
              </div>
            </div>
            <div style="margin-bottom: 20px;">
              <h4 style="margin: 0 0 12px 0; color: ${THEME.dark};">设备像素比</h4>
              <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="radio" name="devicePixelRatio" value="auto" ${(!qualityConfig.devicePixelRatio || qualityConfig.devicePixelRatio === 'auto') ? 'checked' : ''}>
                  <span>自动</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="radio" name="devicePixelRatio" value="1.0" ${qualityConfig.devicePixelRatio === 1.0 ? 'checked' : ''}>
                  <span>1.0</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="radio" name="devicePixelRatio" value="1.5" ${qualityConfig.devicePixelRatio === 1.5 ? 'checked' : ''}>
                  <span>1.5</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="radio" name="devicePixelRatio" value="2.0" ${qualityConfig.devicePixelRatio === 2.0 ? 'checked' : ''}>
                  <span>2.0</span>
                </label>
              </div>
            </div>
            <div style="padding: 12px; background: #f8f8f8; border-radius: 8px;">
              <h4 style="margin: 0 0 8px 0; color: ${THEME.dark}; font-size: 0.9rem;">模型信息</h4>
              <p style="margin: 0; color: #666; font-size: 0.85rem;">
                表情数: <span class="gal-model-info-expr">-</span> | 动作组: <span class="gal-model-info-motion">-</span>
              </p>
            </div>
          </div>
        </div>

        <!-- 底部按钮 -->
        <div style="padding: 15px 20px; border-top: 1px solid #e0e0e0; display: flex; gap: 10px; justify-content: flex-end;">
          <button id="gal-live2d-settings-save" style="padding: 10px 20px; background: ${THEME.accent}; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
            <i class="fa-solid fa-save"></i> 保存设置
          </button>
        </div>
      </div>
    </div>
  `;

  _$('#gal-live2d-settings-modal').remove();
  const mountRoot = getModalMountRoot();
  _$(mountRoot).append(modalHtml);

  const $modal = _$(mountRoot).find('#gal-live2d-settings-modal');

  const setPreviewStatus = (text, level = 'info') => {
    const $status = $modal.find('#gal-live2d-preview-status');
    if (!$status.length) return;
    $status.text(text || '');
    if (level === 'error') {
      $status.css('color', '#dc2626');
    } else if (level === 'success') {
      $status.css('color', '#16a34a');
    } else {
      $status.css('color', '#64748b');
    }
  };

  const setPreviewTag = (tag) => {
    $modal.find('#gal-live2d-preview-tag').text(tag ? String(tag) : '-');
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const getPreviewDragPoint = (event) => {
    const oe = event?.originalEvent || event;
    if (oe?.touches?.length) return { x: oe.touches[0].clientX, y: oe.touches[0].clientY };
    if (oe?.changedTouches?.length) return { x: oe.changedTouches[0].clientX, y: oe.changedTouches[0].clientY };
    if (Number.isFinite(oe?.clientX) && Number.isFinite(oe?.clientY)) return { x: oe.clientX, y: oe.clientY };
    return null;
  };

  const capturePreviewBasePose = () => {
    const model = Live2DManager.models.get(characterId);
    if (!model) return;
    const baseScale = Number(model.scale?.x);
    previewBasePose = {
      x: Number(model.x) || 0,
      y: Number(model.y) || 0,
      scale: Number.isFinite(baseScale) && baseScale > 0 ? baseScale : 1,
    };
  };

  const applyPreviewViewport = () => {
    if (!previewMounted) return;
    const model = Live2DManager.models.get(characterId);
    if (!model) return;

    const $previewCanvas = $modal.find('#gal-live2d-preview-canvas');
    const canvasWidth = Math.max(1, Number($previewCanvas.innerWidth()) || Number($previewCanvas.width()) || 320);
    const canvasHeight = Math.max(1, Number($previewCanvas.innerHeight()) || Number($previewCanvas.height()) || 260);
    const maxOffsetX = Math.max(60, canvasWidth * 0.45);
    const maxOffsetY = Math.max(60, canvasHeight * 0.45);
    previewPanOffsetX = clamp(previewPanOffsetX, -maxOffsetX, maxOffsetX);
    previewPanOffsetY = clamp(previewPanOffsetY, -maxOffsetY, maxOffsetY);
    previewZoomFactor = clamp(previewZoomFactor, 0.5, 4);

    const finalScale = previewBasePose.scale * previewZoomFactor;
    if (model.scale?.set) {
      model.scale.set(finalScale);
    }
    model.x = previewBasePose.x + previewPanOffsetX;
    model.y = previewBasePose.y + previewPanOffsetY;

    const container = Live2DManager.containers.get(characterId);
    if (container?.app?.renderer && container?.app?.stage) {
      container.app.renderer.render(container.app.stage);
    }

    $modal.find('#gal-live2d-preview-zoom').val(String(previewZoomFactor.toFixed(2)));
    $modal.find('#gal-live2d-preview-zoom-value').text(`${Math.round(previewZoomFactor * 100)}%`);
  };

  const resetPreviewViewport = () => {
    previewZoomFactor = 1.8;
    previewPanOffsetX = 0;
    previewPanOffsetY = 0;
    applyPreviewViewport();
  };

  const bindPreviewViewportEvents = () => {
    const $previewCanvas = $modal.find('#gal-live2d-preview-canvas');
    if (!$previewCanvas.length) return;
    if ($previewCanvas.data('viewportBound')) return;

    $previewCanvas.on('mousedown.galLive2DPreviewPan touchstart.galLive2DPreviewPan', function(event) {
      if (!previewMounted) return;
      const point = getPreviewDragPoint(event);
      if (!point) return;
      previewIsDragging = true;
      previewDragStart = point;
      previewDragOrigin = { x: previewPanOffsetX, y: previewPanOffsetY };
      _$(this).css('cursor', 'grabbing');
      if (typeof event.preventDefault === 'function') event.preventDefault();
    });

    _$(topWindow.document).on('mousemove.galLive2DPreviewPan touchmove.galLive2DPreviewPan', function(event) {
      if (!previewIsDragging) return;
      const point = getPreviewDragPoint(event);
      if (!point) return;
      previewPanOffsetX = previewDragOrigin.x + (point.x - previewDragStart.x);
      previewPanOffsetY = previewDragOrigin.y + (point.y - previewDragStart.y);
      applyPreviewViewport();
      if (typeof event.preventDefault === 'function') event.preventDefault();
    });

    _$(topWindow.document).on('mouseup.galLive2DPreviewPan touchend.galLive2DPreviewPan touchcancel.galLive2DPreviewPan', function() {
      if (!previewIsDragging) return;
      previewIsDragging = false;
      $previewCanvas.css('cursor', 'grab');
    });

    $previewCanvas.on('wheel.galLive2DPreviewPan', function(event) {
      if (!previewMounted) return;
      const oe = event?.originalEvent;
      if (!oe) return;
      const delta = oe.deltaY < 0 ? 0.08 : -0.08;
      previewZoomFactor = clamp(previewZoomFactor + delta, 0.5, 4);
      applyPreviewViewport();
      if (typeof event.preventDefault === 'function') event.preventDefault();
    });

    $previewCanvas.data('viewportBound', true);
  };

  const unbindPreviewViewportEvents = () => {
    previewIsDragging = false;
    const $previewCanvas = $modal.find('#gal-live2d-preview-canvas');
    $previewCanvas.off('.galLive2DPreviewPan');
    _$(topWindow.document).off('.galLive2DPreviewPan');
    $previewCanvas.data('viewportBound', false);
  };

  const cleanupMappingPreview = () => {
    if (!previewMounted) return;
    previewIsDragging = false;
    previewRequestToken++;
    $modal.find('#gal-live2d-preview-canvas').css('cursor', 'grab');
    try {
      Live2DStage.popMount();
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] Live2D 预览卸载失败:`, e);
    }
    previewMounted = false;
  };

  const ensureMappingPreviewMounted = async () => {
    if (previewMounted) return true;
    if (previewMountPromise) return previewMountPromise;

    previewMountPromise = (async () => {
      const $previewCanvas = $modal.find('#gal-live2d-preview-canvas');
      if (!$previewCanvas.length) return false;

      $previewCanvas.html('<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: rgba(255,255,255,0.88);"><i class="fa-solid fa-spinner fa-spin" style="font-size: 1.4rem;"></i></div>');
      setPreviewStatus('正在加载模型...');

      let model = Live2DManager.models.get(characterId);
      if (!model) {
        model = await Live2DManager.loadModel(characterId);
      }
      if (!model) {
        $previewCanvas.html('<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #fca5a5; font-size: 0.85rem;">模型加载失败</div>');
        setPreviewStatus('模型加载失败', 'error');
        return false;
      }

      $previewCanvas.empty();
      Live2DStage.pushMount($previewCanvas[0], { mode: 'single', focusCharacterId: characterId });
      const attached = Live2DStage.attach(characterId, model, 'left', { entering: false });
      if (!attached) {
        try {
          Live2DStage.popMount();
        } catch (e) {}
        $previewCanvas.html('<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #fca5a5; font-size: 0.85rem;">预览挂载失败</div>');
        setPreviewStatus('预览挂载失败', 'error');
        return false;
      }

      previewMounted = true;
      bindPreviewViewportEvents();
      capturePreviewBasePose();
      resetPreviewViewport();
      setPreviewStatus('预览就绪，可拖拽移动/滚轮缩放', 'success');
      return true;
    })();

    try {
      return await previewMountPromise;
    } finally {
      previewMountPromise = null;
    }
  };

  const getTagRow = (tag) => {
    let $target = null;
    $modal.find('.gal-mapping-row').each(function() {
      if (_$(this).data('tag') === tag) {
        $target = _$(this);
        return false;
      }
      return undefined;
    });
    return $target;
  };

  const stopPreviewMotion = (model) => {
    const motionManager = model?.internalModel?.motionManager;
    if (!motionManager) return;

    try {
      if (typeof motionManager.stopAllMotions === 'function') {
        motionManager.stopAllMotions();
        return;
      }
    } catch (e) {}

    try {
      if (typeof motionManager.motionQueueManager?.stopAllMotions === 'function') {
        motionManager.motionQueueManager.stopAllMotions();
        return;
      }
    } catch (e) {}

    try {
      if (typeof motionManager.queueManager?.stopAllMotions === 'function') {
        motionManager.queueManager.stopAllMotions();
      }
    } catch (e) {}
  };

  const normalizePreviewAutoUpdateTicker = (model) => {
    if (!model) return;
    const sharedTicker = topWindow?.PIXI?.Ticker?.shared;
    if (sharedTicker && typeof sharedTicker.remove === 'function' && typeof model.onTickerUpdate === 'function') {
      try {
        sharedTicker.remove(model.onTickerUpdate, model);
      } catch (e) {}
    }
    if ('autoUpdate' in model) {
      try {
        model.autoUpdate = true;
      } catch (e) {}
    }
  };

  const previewMappingForTag = async (tag) => {
    if (!tag) return;
    const requestToken = ++previewRequestToken;
    const mounted = await ensureMappingPreviewMounted();
    if (!mounted || requestToken !== previewRequestToken) return;

    const model = Live2DManager.models.get(characterId);
    if (!model) {
      setPreviewStatus('模型未就绪', 'error');
      return;
    }

    const $row = getTagRow(tag);
    if (!$row || !$row.length) return;

    const exprValue = String($row.find('.gal-expr-mapping-select').val() || '');
    const motionValueRaw = $row.find('.gal-motion-mapping-select').val();
    const motionValue = motionValueRaw === null || motionValueRaw === undefined ? '' : String(motionValueRaw);

    if (requestToken !== previewRequestToken) return;

    normalizePreviewAutoUpdateTicker(model);

    $modal.find('.gal-mapping-row').removeClass('previewing');
    $row.addClass('previewing');
    setPreviewTag(tag);
    applyPreviewViewport();

    let playedExpr = '';
    let playedMotion = '';

    try {
      const exprName = exprValue || matchLive2DExpression(model, tag, null) || '';
      if (exprName) {
        model.expression(exprName);
        playedExpr = exprName;
      }
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 预览表情失败:`, e);
    }

    try {
      stopPreviewMotion(model);
      if (motionValue === '__disabled__') {
        playedMotion = '(动作已禁用)';
      } else {
        let motion = null;
        if (motionValue) {
          motion = { group: motionValue === EMPTY_MOTION_GROUP_VALUE ? '' : motionValue, index: 0 };
        } else {
          motion = matchLive2DMotion(model, tag, null);
        }

        if (motion) {
          model.motion(motion.group, motion.index || 0, 'FORCE');
          playedMotion = motion.group === '' ? '(空动作组)' : String(motion.group || '');
        }
      }
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 预览动作失败:`, e);
    }

    const exprText = playedExpr ? `表情: ${playedExpr}` : '表情: (无匹配)';
    const motionText = playedMotion ? `动作: ${playedMotion}` : '动作: (无匹配)';
    setPreviewStatus(`${tag} | ${exprText} | ${motionText}`);
  };

  const previewFirstTagIfExists = async () => {
    const $first = $modal.find('.gal-mapping-row').first();
    if (!$first.length) return;
    const tag = $first.data('tag');
    if (tag) {
      await previewMappingForTag(String(tag));
    }
  };

  const bindMappingContainerEvents = ($mappingContainer) => {
    if (!$mappingContainer.length) return;

    $mappingContainer.off('.galMappingRows');
    $mappingContainer.on('change.galMappingRows', '.gal-expr-mapping-select, .gal-motion-mapping-select', async function() {
      syncDraftMappingsFromDom();
      const tag = _$(this).data('tag');
      if (tag) {
        await previewMappingForTag(String(tag));
      }
    });

    $mappingContainer.on('click.galMappingRows', '.gal-mapping-preview-btn', async function() {
      const tag = _$(this).data('tag');
      if (tag) {
        await previewMappingForTag(String(tag));
      }
    });
  };

  loadModelDataAsync();

  // 标签页切换
  $modal.find('.gal-settings-tab').on('click', async function() {
    const tab = _$(this).data('tab');
    $modal.find('.gal-settings-tab').removeClass('active').css({ color: '#666', borderBottom: '2px solid transparent' });
    _$(this).addClass('active').css({ color: THEME.accent, borderBottom: `2px solid ${THEME.accent}` });
    $modal.find('.gal-settings-panel').hide();
    $modal.find(`.gal-settings-panel[data-panel="${tab}"]`).show();

    if (tab === 'mapping') {
      await renderMappingRows({ previewAfterRender: true });
    } else {
      syncDraftMappingsFromDom();
      cleanupMappingPreview();
    }
  });

  // 缩放滑块
  $modal.find('#gal-live2d-scale').on('input', function() {
    const val = parseFloat(_$(this).val());
    $modal.find('#gal-live2d-scale-value').text(val.toFixed(1) + 'x');
  });

  // 重置变换
  $modal.find('#gal-live2d-reset-transform').on('click', function() {
    $modal.find('#gal-live2d-offset-x').val(0);
    $modal.find('#gal-live2d-offset-y').val(0);
    $modal.find('#gal-live2d-scale').val(1.0);
    $modal.find('#gal-live2d-scale-value').text('1.0x');
    $modal.find('#gal-live2d-scale-base').val('height');
    Live2DManager.setOffset(characterId, 0, 0);
    Live2DManager.setScale(characterId, 1.0);
  });

  // 偏移按钮
  $modal.find('.gal-offset-btn').on('click', function() {
    const dir = _$(this).data('dir');
    const delta = parseInt(_$(this).data('delta'));
    const $input = $modal.find(`#gal-live2d-offset-${dir}`);
    $input.val(parseInt($input.val() || 0) + delta);
    $input.trigger('change');
  });

  $modal.find('#gal-live2d-auto-match').on('click', async function() {
    const model = Live2DManager.models.get(characterId);
    if (!model) return;
    $modal.find('.gal-expr-mapping-select').each(function() {
      const tag = _$(this).data('tag');
      const matched = matchLive2DExpression(model, tag, null);
      if (matched) {
        _$(this).val(matched);
      }
    });
    $modal.find('.gal-motion-mapping-select').each(function() {
      const tag = _$(this).data('tag');
      const matched = matchLive2DMotion(model, tag, null);
      if (matched) {
        const value = String(matched.group ?? '') === '' ? EMPTY_MOTION_GROUP_VALUE : matched.group;
        _$(this).val(value);
      }
    });

    syncDraftMappingsFromDom();
    await previewFirstTagIfExists();
  });

  // 清空映射
  $modal.find('#gal-live2d-clear-mapping').on('click', async function() {
    $modal.find('.gal-expr-mapping-select').val('');
    $modal.find('.gal-motion-mapping-select').val('');
    syncDraftMappingsFromDom();
    await previewFirstTagIfExists();
  });

  $modal.find('#gal-live2d-preview-replay').on('click', async function() {
    const $active = $modal.find('.gal-mapping-row.previewing').first();
    const activeTag = $active.length ? String($active.data('tag') || '') : '';
    if (activeTag) {
      await previewMappingForTag(activeTag);
      return;
    }
    await previewFirstTagIfExists();
  });

  $modal.find('#gal-live2d-preview-zoom').on('input', function() {
    const nextZoom = parseFloat(_$(this).val());
    if (!Number.isFinite(nextZoom)) return;
    previewZoomFactor = nextZoom;
    applyPreviewViewport();
  });

  $modal.find('#gal-live2d-preview-reset-view').on('click', function() {
    resetPreviewViewport();
    const $active = $modal.find('.gal-mapping-row.previewing').first();
    if ($active.length) {
      setPreviewTag(String($active.data('tag') || ''));
    }
  });

  const closeModal = () => {
    previewRequestToken++;
    cleanupMappingPreview();
    unbindPreviewViewportEvents();
    $modal.remove();
  };

  // 关闭/取消
  $modal.find('#gal-live2d-settings-close').on('click', closeModal);

  // 开始调整位置
  $modal.find('#gal-live2d-start-position-edit').on('click', async function() {
    const currentTransform = {
      offsetX: parseInt($modal.find('#gal-live2d-offset-x').val()) || 0,
      offsetY: parseInt($modal.find('#gal-live2d-offset-y').val()) || 0,
      scale: parseFloat($modal.find('#gal-live2d-scale').val()) || 1.0,
      scaleBase: normalizeLive2DScaleBase($modal.find('#gal-live2d-scale-base').val()),
    };
    const config = getLive2DConfig(characterId);
    config.transform = { ...(config.transform || {}), ...currentTransform };
    setLive2DConfig(characterId, config);

    closeModal();

    await Live2DPositionEditor.enter(characterId);
  });

  // 保存设置
  $modal.find('#gal-live2d-settings-save').on('click', function() {
    const newTransform = {
      offsetX: parseInt($modal.find('#gal-live2d-offset-x').val()) || 0,
      offsetY: parseInt($modal.find('#gal-live2d-offset-y').val()) || 0,
      scale: parseFloat($modal.find('#gal-live2d-scale').val()) || 1.0,
      scaleBase: normalizeLive2DScaleBase($modal.find('#gal-live2d-scale-base').val()),
    };

    const newQuality = {
      textureResolution: parseFloat($modal.find('input[name="textureResolution"]:checked').val()) || 1.0,
      devicePixelRatio: $modal.find('input[name="devicePixelRatio"]:checked').val()
    };
    if (newQuality.devicePixelRatio !== 'auto') {
      newQuality.devicePixelRatio = parseFloat(newQuality.devicePixelRatio);
    }

    syncDraftMappingsFromDom();
    const newExpressionMapping = { ...draftExpressionMapping };
    const newMotionMapping = { ...draftMotionMapping };

    const newConfig = {
      transform: newTransform,
      quality: newQuality,
      expressionMapping: newExpressionMapping,
      motionMapping: newMotionMapping
    };
    setLive2DConfig(characterId, newConfig);

    if (Live2DManager.models.has(characterId)) {
      Live2DManager.applyTransformConfig(characterId);
    }

    const _toastr = topWindow.toastr || (typeof toastr !== 'undefined' ? toastr : null);
    if (_toastr) {
      _toastr.success(`Live2D 设置已保存: ${characterId}`);
    }

    closeModal();
  });
}
