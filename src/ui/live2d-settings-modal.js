import { SCRIPT_NAME, THEME } from '../core/constants.js';
import { topWindow, $ } from '../core/env.js';
import { getLive2DConfig, setLive2DConfig, normalizeLive2DScaleBase } from '../live2d/render-mode.js';
import { Live2DManager } from '../live2d/manager.js';
import { Live2DPositionEditor } from '../live2d/position-editor.js';
import { EXPRESSION_LIVE2D_MAP, matchLive2DExpression, matchLive2DMotion, getLive2DExpressionList, getLive2DMotionGroups } from '../live2d/expression-motion.js';
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

  let expressionList = [];
  let motionGroups = [];

  const gameExpressionTags = Object.keys(EXPRESSION_LIVE2D_MAP);

  const buildMappingRows = () => {
    const existingMappings = { ...expressionMapping };
    const existingMotionMappings = { ...motionMapping };
    let rows = '';

    const allTags = [...new Set([...Object.keys(existingMappings), ...gameExpressionTags])];

    const exprOptionsHtml = expressionList.length > 0
      ? expressionList.map(e => `<option value="${e}">${e}</option>`).join('')
      : '';
    const motionOptionsHtml = motionGroups.length > 0
      ? motionGroups.map(g => `<option value="${g}">${g}</option>`).join('')
      : '';

    for (const tag of allTags) {
      const currentExpr = existingMappings[tag] || '';
      const currentMotion = existingMotionMappings[tag] || {};

      rows += `
        <div class="gal-mapping-row" data-tag="${tag}" style="display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.1);">
          <span style="min-width: 60px; font-weight: 600;">${tag}</span>
          <span style="color: #666;">→</span>
          <select class="gal-expr-mapping-select" data-tag="${tag}" data-current="${currentExpr}" style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
            <option value="">(自动匹配)</option>
            ${exprOptionsHtml}
          </select>
          <select class="gal-motion-mapping-select" data-tag="${tag}" data-current="${currentMotion.group || ''}" data-disabled="${currentMotion.enabled === false}" style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
            <option value="">(自动匹配)</option>
            <option value="__disabled__">(禁用动作)</option>
            ${motionOptionsHtml}
          </select>
        </div>
      `;
    }

    return rows;
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

        setTimeout(() => {
          const $mappingContainer = $modal.find('#gal-mapping-rows');
          if ($mappingContainer.length && !$mappingContainer.data('loaded')) {
            const rowsHtml = buildMappingRows();
            $mappingContainer.html(rowsHtml);
            $mappingContainer.data('loaded', true);

            $mappingContainer.find('.gal-expr-mapping-select').each(function() {
              const current = $(this).data('current');
              if (current) $(this).val(current);
            });
            $mappingContainer.find('.gal-motion-mapping-select').each(function() {
              const current = $(this).data('current');
              const disabled = $(this).data('disabled');
              if (disabled) {
                $(this).val('__disabled__');
              } else if (current) {
                $(this).val(current);
              }
            });
          }
        }, 50);
      }
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 加载模型数据失败:`, e);
    }
  };

  const modalHtml = `
    <div id="gal-live2d-settings-modal" class="gal-z-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;">
      <div style="background: #fff; border-radius: 12px; width: 90%; max-width: 600px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
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
            <div style="margin-bottom: 15px;">
              <h4 style="margin: 0 0 8px 0; color: ${THEME.dark};">表情标签映射</h4>
              <p style="margin: 0; color: #666; font-size: 0.85rem;">将游戏表情标签映射到 Live2D 表情和动作。留空则使用自动匹配。</p>
            </div>
            <div id="gal-mapping-rows" style="max-height: 300px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 10px;">
              <div style="text-align: center; padding: 30px; color: #999;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; margin-bottom: 10px; display: block;"></i>
                正在加载模型数据...
              </div>
            </div>
            <div style="margin-top: 15px; display: flex; gap: 10px;">
              <button id="gal-live2d-auto-match" style="padding: 8px 16px; background: ${THEME.accent}; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
                <i class="fa-solid fa-magic"></i> 自动匹配全部
              </button>
              <button id="gal-live2d-clear-mapping" style="padding: 8px 16px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">
                <i class="fa-solid fa-trash"></i> 清空映射
              </button>
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
          <button id="gal-live2d-settings-cancel" style="padding: 10px 20px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 6px; cursor: pointer;">
            取消
          </button>
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

  loadModelDataAsync();

  // 标签页切换
  $modal.find('.gal-settings-tab').on('click', function() {
    const tab = _$(this).data('tab');
    $modal.find('.gal-settings-tab').removeClass('active').css({ color: '#666', borderBottom: '2px solid transparent' });
    _$(this).addClass('active').css({ color: THEME.accent, borderBottom: `2px solid ${THEME.accent}` });
    $modal.find('.gal-settings-panel').hide();
    $modal.find(`.gal-settings-panel[data-panel="${tab}"]`).show();
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

  $modal.find('#gal-live2d-auto-match').on('click', function() {
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
        _$(this).val(matched.group);
      }
    });
  });

  // 清空映射
  $modal.find('#gal-live2d-clear-mapping').on('click', function() {
    $modal.find('.gal-expr-mapping-select').val('');
    $modal.find('.gal-motion-mapping-select').val('');
  });

  // 关闭/取消
  $modal.find('#gal-live2d-settings-close, #gal-live2d-settings-cancel').on('click', function() {
    $modal.remove();
  });

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

    $modal.remove();

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

    const newExpressionMapping = {};
    $modal.find('.gal-expr-mapping-select').each(function() {
      const tag = _$(this).data('tag');
      const val = _$(this).val();
      if (val) {
        newExpressionMapping[tag] = val;
      }
    });

    const newMotionMapping = {};
    $modal.find('.gal-motion-mapping-select').each(function() {
      const tag = _$(this).data('tag');
      const val = _$(this).val();
      if (val === '__disabled__') {
        newMotionMapping[tag] = { enabled: false };
      } else if (val) {
        newMotionMapping[tag] = { group: val, index: 0, enabled: true };
      }
    });

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

    $modal.remove();
  });
}
