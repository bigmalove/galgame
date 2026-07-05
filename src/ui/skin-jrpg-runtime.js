import { JRPG_FAMILY_SKIN_IDS } from '../core/constants.js';

// ============================================
// 苍穹之庭（星降之夜）皮肤 —— 装饰 DOM 注入
// demo（doc/皮肤翻新提案-苍穹之庭.html）的视觉依赖大量装饰节点
// （夜穹场景 / 面板双层材质 / 角饰铆钉 / 水印符文环），
// 纯伪元素装不下，照薄暮皮肤的 applyTwilightSkinAssets 模式
// 在皮肤激活时注入、切走时清理。
// 所有节点带 data-cts-asset 标记，注入幂等、清理彻底。
// ============================================

const ASSET_ATTR = 'data-cts-asset';

export function isJrpgSkinSelected(rawSkin) {
  return JRPG_FAMILY_SKIN_IDS.includes(String(rawSkin || '').trim());
}

/* 夜穹场景（结构与 demo .gal-layer-bg 内部一一对应） */
const SCENE_HTML = `
  <div class="cts-scene" ${ASSET_ATTR}="scene" aria-hidden="true">
    <div class="cts-sky"></div>
    <div class="cts-nebula cts-neb-a"></div>
    <div class="cts-nebula cts-neb-b"></div>
    <div class="cts-milkyway"></div>
    <div class="cts-aurora cts-aurora-a"></div>
    <div class="cts-aurora cts-aurora-b"></div>
    <div class="cts-stars cts-stars-far"></div>
    <div class="cts-stars cts-stars-near"></div>
    <i class="cts-flare cts-f1"></i><i class="cts-flare cts-f2"></i><i class="cts-flare cts-f3"></i>
    <div class="cts-shooting-star cts-ss1"></div>
    <div class="cts-shooting-star cts-ss2"></div>
    <div class="cts-gate">
      <div class="cts-ring-ticks"></div>
      <div class="cts-ring-line"></div>
      <div class="cts-moon"></div>
      <div class="cts-orbit"><i></i></div>
    </div>
    <div class="cts-godray cts-ray-1"></div>
    <div class="cts-godray cts-ray-2"></div>
    <div class="cts-isle cts-isle-far"><div class="cts-rock"></div></div>
    <div class="cts-cloudsea cts-cloud-a"></div>
    <div class="cts-isle cts-isle-l">
      <div class="cts-rock"></div>
      <div class="cts-crystals"><i></i><i></i><i></i></div>
      <div class="cts-lightfall"></div><div class="cts-lightfall cts-lf2"></div>
    </div>
    <div class="cts-isle cts-isle-r">
      <div class="cts-rock"></div>
      <div class="cts-crystals"><i></i><i></i><i></i></div>
      <div class="cts-lightfall"></div>
    </div>
    <div class="cts-cloudsea cts-cloud-b"></div>
    <div class="cts-particles"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
  </div>
`;

/* 面板装饰（与 demo .gal-text-panel 内部装饰一一对应） */
const PANEL_DECOR_HTML = `
  <div class="cts-panel-shape" ${ASSET_ATTR}="panel" aria-hidden="true"></div>
  <div class="cts-panel-line" ${ASSET_ATTR}="panel" aria-hidden="true"><i></i></div>
  <span class="cts-flourish cts-tl" ${ASSET_ATTR}="panel" aria-hidden="true"><i></i></span>
  <span class="cts-flourish cts-br" ${ASSET_ATTR}="panel" aria-hidden="true"><i></i></span>
  <i class="cts-rivet cts-r1" ${ASSET_ATTR}="panel" aria-hidden="true"></i>
  <i class="cts-rivet cts-r2" ${ASSET_ATTR}="panel" aria-hidden="true"></i>
`;

/* 对话层水印符文环（demo .gal-dialog-layer .watermark） */
const WATERMARK_HTML = `
  <div class="cts-watermark" ${ASSET_ATTR}="watermark" aria-hidden="true">
    <div class="cts-w1"></div><div class="cts-w2"></div>
  </div>
`;

export function applyJrpgSkinAssets(overlay) {
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
  if (dialogLayer && !dialogLayer.querySelector(`[${ASSET_ATTR}="watermark"]`)) {
    dialogLayer.insertAdjacentHTML('afterbegin', WATERMARK_HTML);
  }
}

export function clearJrpgSkinAssets(overlay) {
  if (!overlay) return;
  overlay.querySelectorAll(`[${ASSET_ATTR}]`).forEach(node => node.remove());
}
