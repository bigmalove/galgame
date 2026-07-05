import { YANYUN_FAMILY_SKIN_IDS } from '../core/constants.js';

// ============================================
// 燕云十六声（夜雪听风）皮肤 —— 装饰 DOM 注入
// demo（doc/皮肤翻新提案-燕云十六声.html）的场景与面板装饰
// 照 skin-jrpg-runtime 的模式注入 / 清理。
// 所有节点带 data-yx-asset 标记，注入幂等、清理彻底。
// ============================================

const ASSET_ATTR = 'data-yx-asset';

export function isYanyunSkinSelected(rawSkin) {
  return YANYUN_FAMILY_SKIN_IDS.includes(String(rawSkin || '').trim());
}

/* 风雪夜戏场景（与 demo .gal-layer-bg 内部一一对应） */
const SCENE_HTML = `
  <div class="yx-scene" ${ASSET_ATTR}="scene" aria-hidden="true">
    <div class="yx-sky"></div>
    <div class="yx-moon"></div>
    <div class="yx-geese"><i></i><i></i><i></i><i></i></div>
    <div class="yx-mtn yx-mtn-far"><i></i></div>
    <div class="yx-fog yx-fog-a"></div>
    <div class="yx-mtn yx-mtn-mid"><i></i></div>
    <div class="yx-lamp yx-lamp-a"></div>
    <div class="yx-lamp yx-lamp-b"></div>
    <div class="yx-fog yx-fog-b"></div>
    <div class="yx-mtn yx-mtn-near"><i></i></div>
    <div class="yx-snowfall"></div>
    <div class="yx-snowfall yx-sf2"></div>
    <div class="yx-wind yx-wind-a"></div>
    <div class="yx-wind yx-wind-b"></div>
  </div>
`;

/* 面板装饰：墨甲本体 + 鎏铜双线 + 铜楔 + 剑光线 */
const PANEL_DECOR_HTML = `
  <div class="yx-panel-body" ${ASSET_ATTR}="panel" aria-hidden="true"></div>
  <div class="yx-panel-line" ${ASSET_ATTR}="panel" aria-hidden="true"></div>
  <div class="yx-panel-line2" ${ASSET_ATTR}="panel" aria-hidden="true"></div>
  <i class="yx-wedge yx-wedge-tr" ${ASSET_ATTR}="panel" aria-hidden="true"></i>
  <i class="yx-wedge yx-wedge-bl" ${ASSET_ATTR}="panel" aria-hidden="true"></i>
  <div class="yx-blade-line" ${ASSET_ATTR}="panel" aria-hidden="true"></div>
`;

/* 对话层题诗水印 */
const VERSE_HTML = `
  <div class="yx-verse" ${ASSET_ATTR}="verse" aria-hidden="true">十六声里论英雄</div>
`;

export function applyYanyunSkinAssets(overlay) {
  if (!overlay) return;

  const layerBg = overlay.querySelector('.gal-layer-bg');
  if (layerBg && !layerBg.querySelector(`[${ASSET_ATTR}="scene"]`)) {
    layerBg.insertAdjacentHTML('afterbegin', SCENE_HTML);
  }

  const textPanel = overlay.querySelector('.gal-text-panel');
  if (textPanel && !textPanel.querySelector(`[${ASSET_ATTR}="panel"]`)) {
    textPanel.insertAdjacentHTML('afterbegin', PANEL_DECOR_HTML);
  }

  const dialogLayer = overlay.querySelector('.gal-dialog-layer');
  if (dialogLayer && !dialogLayer.querySelector(`[${ASSET_ATTR}="verse"]`)) {
    dialogLayer.insertAdjacentHTML('afterbegin', VERSE_HTML);
  }
}

export function clearYanyunSkinAssets(overlay) {
  if (!overlay) return;
  overlay.querySelectorAll(`[${ASSET_ATTR}]`).forEach(node => node.remove());
}
