import {
  CLEAR_TWILIGHT_SKIN_ID,
  CYBER_TWILIGHT_SKIN_ID,
  DAWN_TWILIGHT_SKIN_ID,
  DREAM_TWILIGHT_SKIN_ID,
  FOREST_TWILIGHT_SKIN_ID,
  GILDED_TWILIGHT_SKIN_ID,
  NEON_TWILIGHT_SKIN_ID,
  ORCHID_TWILIGHT_SKIN_ID,
  ROSY_TWILIGHT_SKIN_ID,
  TWILIGHT_FAMILY_SKIN_IDS,
  TWILIGHT_SKIN_ID,
} from '../core/constants.js';
import { buildGalMobileMenuButtonsHtml } from '../core/custom-skin-footer-buttons.js';
import { getCurrentCharacterName, getSettings } from '../core/settings.js';

export { TWILIGHT_FAMILY_SKIN_IDS };

const TWILIGHT_MOBILE_MENU_ACTIONS = ['open-settings', 'save', 'load', 'view-original', 'timeline'];
const DEFAULT_TWILIGHT_BRAND = 'TWILIGHT';
export const TWILIGHT_SKIN_OPTION_ITEMS = [
  { value: TWILIGHT_SKIN_ID, label: '薄暮' },
  { value: GILDED_TWILIGHT_SKIN_ID, label: '鎏暮' },
  { value: DAWN_TWILIGHT_SKIN_ID, label: '晓暮' },
  { value: ORCHID_TWILIGHT_SKIN_ID, label: '绯暮' },
  { value: NEON_TWILIGHT_SKIN_ID, label: '霓暮' },
  { value: CLEAR_TWILIGHT_SKIN_ID, label: '澄暮' },
  { value: FOREST_TWILIGHT_SKIN_ID, label: '森暮' },
  { value: CYBER_TWILIGHT_SKIN_ID, label: '电暮' },
  { value: DREAM_TWILIGHT_SKIN_ID, label: '梦暮' },
  { value: ROSY_TWILIGHT_SKIN_ID, label: '霞暮' },
];
export const TWILIGHT_VARIANT_SKIN_IDS = TWILIGHT_FAMILY_SKIN_IDS.filter(skinId => skinId !== TWILIGHT_SKIN_ID);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => (
    {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char] || char
  ));
}

export function isTwilightSkinSelected(rawSkin = getSettings()?.skin) {
  return TWILIGHT_FAMILY_SKIN_IDS.includes(String(rawSkin || '').trim());
}

export function isGildedTwilightSkinSelected(rawSkin = getSettings()?.skin) {
  return String(rawSkin || '').trim() === GILDED_TWILIGHT_SKIN_ID;
}

export function getTwilightOverlayClasses(rawSkin = getSettings()?.skin) {
  const skin = String(rawSkin || '').trim();
  if (!TWILIGHT_FAMILY_SKIN_IDS.includes(skin)) return [];
  return skin === TWILIGHT_SKIN_ID ? [TWILIGHT_SKIN_ID] : [TWILIGHT_SKIN_ID, skin];
}

export function applyTwilightSkinAssets(overlay) {
  void overlay;
}

export function clearTwilightSkinAssets(overlay) {
  void overlay;
}

export function buildTwilightOverlayHtml({
  locationIconClass = '',
  timeIconClass = '',
  speakerGlow = false,
  speakerBubble = false,
  ttsEnabled = false,
} = {}) {
  const twilightBrand = getCurrentCharacterName() || DEFAULT_TWILIGHT_BRAND;
  return `
      <div class="gal-status-bar-container gal-twilight-header">
        <div class="gal-twilight-brandline">
          <div class="gal-twilight-brand">${escapeHtml(twilightBrand)}</div>
          <div class="gal-twilight-divider" aria-hidden="true"></div>
          <div class="gal-twilight-meta-group">
            <button class="gal-location-bar gal-twilight-meta-btn" id="gal-location-bar" title="当前地点">
              <i class="fa-solid fa-location-dot"></i>
              <span class="gal-location-text" id="gal-location-text">LONDON, 1888</span>
            </button>
            <button class="gal-time-bar gal-twilight-meta-btn gal-twilight-time-inline" id="gal-time-bar" title="当前时间">
              <i class="fa-regular fa-clock"></i>
              <span class="gal-time-text" id="gal-time-text">22:15</span>
            </button>
          </div>
        </div>
        <div class="gal-twilight-header-actions">
          <button class="gal-sprite-toggle" title="显示/隐藏立绘">
            <i class="fa-solid fa-eye gal-eye-icon"></i>
          </button>
          <button class="gal-status-popup-trigger gal-location-popup-trigger" id="gal-location-popup-trigger" title="地点详情">
            <i class="gal-status-popup-icon ${locationIconClass || 'fa-solid fa-map'}"></i>
          </button>
          <button class="gal-status-popup-trigger gal-time-popup-trigger" id="gal-time-popup-trigger" title="时间详情">
            <i class="gal-status-popup-icon ${timeIconClass || 'fa-regular fa-clock'}"></i>
          </button>
          <button
            class="gal-fullscreen-btn gal-twilight-header-action gal-twilight-fullscreen-toggle"
            data-action="toggle-fullscreen"
            title="切换全屏"
            aria-label="切换全屏"
          >
            <i class="fa-solid fa-expand"></i>
            <span>全屏</span>
          </button>
        </div>
      </div>

      <div class="gal-game-container gal-twilight-shell" data-skin-shell="twilight">
        <div class="gal-layer-bg gal-twilight-runtime-layer">
          <div class="gal-bg-layer gal-bg-base"></div>
          <div class="gal-bg-layer gal-bg-front"></div>
        </div>

        <div class="gal-layer-effect-bg gal-twilight-runtime-layer"></div>

        <div class="gal-game-content gal-twilight-content">
          <div class="gal-layer-character${speakerGlow ? ' glow-enabled' : ''}${speakerBubble ? ' bubble-enabled' : ''}${ttsEnabled ? ' tts-mode-enabled' : ''} gal-twilight-runtime-layer">
            <div class="gal-char-slot slot-left"></div>
            <div class="gal-char-slot slot-center"></div>
            <div class="gal-char-slot slot-right"></div>
          </div>

          <div class="gal-layer-effect-fg gal-twilight-runtime-layer"></div>
          <div class="gal-twilight-scrim"></div>

          <div class="gal-dialog-layer gal-twilight-dialog-layer">
            <div class="gal-twilight-dialog-topline">
              <div class="gal-name-badge">
                <span>旁白</span>
              </div>

              <div class="gal-interaction-bar gal-twilight-mobile-actions gal-twilight-mobile-controls">
                <button class="gal-action-btn gal-twilight-mobile-action btn-reroll" data-action="reroll" title="重绘当前">
                  <i class="fa-solid fa-rotate-right"></i>
                  <span>重绘当前</span>
                </button>
                <button class="gal-action-btn gal-twilight-mobile-action btn-free" data-action="free-input" title="自由对话">
                  <i class="fa-regular fa-keyboard"></i>
                  <span>自由对话</span>
                </button>
              </div>
            </div>

            <div class="gal-text-panel" title="点击继续">
              <p class="gal-dialog-text"></p>

              <div class="gal-twilight-dialog-next-indicator" data-state="next" aria-hidden="true">
                <i class="fa-solid fa-chevron-down"></i>
              </div>

              <div class="gal-generating-indicator" id="gal-generating-indicator">
                <i class="fa-solid fa-wand-magic-sparkles gal-gen-icon"></i>
                <span class="gal-gen-text">生成中</span>
                <span class="gal-gen-status" id="gal-gen-status">正在初始化...</span>
                <div class="gal-gen-dots">
                  <span class="gal-gen-dot"></span>
                  <span class="gal-gen-dot"></span>
                  <span class="gal-gen-dot"></span>
                </div>
              </div>
              
              <div class="gal-progress-container">
                <div class="gal-progress-bar"></div>
              </div>

            </div>

            <button class="gal-footer-btn-next gal-twilight-mobile-next" data-action="next" title="下一段">
              <span class="gal-btn-text">NEXT</span>
              <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>

          <div class="gal-bottom-toolbar">
            <button class="gal-footer-btn" data-action="log" title="查看历史">
              <i class="fa-solid fa-clock-rotate-left"></i>
              <span class="gal-btn-text">LOG</span>
            </button>
            <button class="gal-footer-btn gal-twilight-desktop-only" data-action="close-mode" title="退出 Galgame 模式">
              <i class="fa-solid fa-power-off"></i>
              <span class="gal-btn-text">CLOSE</span>
            </button>
            <button class="gal-footer-btn gal-twilight-desktop-only" data-action="view-original" title="查看消息内嵌界面">
              <i class="fa-solid fa-display"></i>
              <span class="gal-btn-text">VIEW</span>
            </button>
            <button class="gal-footer-btn" data-action="config" title="设置">
              <i class="fa-solid fa-gear"></i>
              <span class="gal-btn-text">CONFIG</span>
            </button>
            <button class="gal-pending-choices-btn" data-action="show-choices" title="查看待选项">
              <i class="fa-solid fa-list-check"></i>
              <span class="gal-btn-text">剧情选项</span>
            </button>
            <button class="gal-footer-btn" data-action="save" title="存档">
              <i class="fa-solid fa-floppy-disk"></i>
              <span class="gal-btn-text">SAVE</span>
            </button>
            <button class="gal-footer-btn" data-action="load" title="读档">
              <i class="fa-solid fa-file-arrow-up"></i>
              <span class="gal-btn-text">LOAD</span>
            </button>
            <button class="gal-footer-btn gal-twilight-desktop-only" data-action="timeline" title="时间线图谱">
              <i class="fa-solid fa-diagram-project"></i>
              <span class="gal-btn-text">TL</span>
            </button>
            <button class="gal-footer-btn gal-nav-btn" data-action="prev" title="上一段">
              <i class="fa-solid fa-arrow-left"></i>
              <span class="gal-btn-text">PREV</span>
            </button>
            <button class="gal-footer-btn gal-nav-btn" data-action="auto" title="自动播放">
              <i class="fa-solid fa-play"></i>
              <span class="gal-btn-text">AUTO</span>
            </button>
            <button class="gal-footer-btn gal-nav-btn" data-action="skip" title="按住快进 (Ctrl)">
              <i class="fa-solid fa-forward"></i>
              <span class="gal-btn-text">SKIP</span>
            </button>
          </div>
          </div>
        </div>
      </div>

      <div class="gal-special-cg-overlay" style="display:none;">
        <img class="gal-special-cg-overlay-image" alt="特殊CG" />
        <button class="gal-special-cg-overlay-close" title="关闭">
          <i class="fa-solid fa-times"></i>
        </button>
      </div>

      <div class="gal-cg-viewer" style="display:none;">
        <img class="gal-cg-viewer-img" style="display:none;" />
        <button class="gal-cg-viewer-close" title="关闭">
          <i class="fa-solid fa-times"></i>
        </button>
        <div class="gal-cg-viewer-loading">图片生成中...</div>
      </div>

      <div class="gal-mobile-menu" id="gal-mobile-menu">
        ${buildGalMobileMenuButtonsHtml(TWILIGHT_MOBILE_MENU_ACTIONS)}
      </div>
  `;
}
