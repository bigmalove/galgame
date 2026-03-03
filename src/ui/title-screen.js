import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow } from '../core/env.js';
import { ensureTitleScreenSettings, getCurrentCharId } from '../core/settings.js';
import { getBackground } from '../db/backgrounds.js';
import { ensureGlobalOverlay } from './overlay.js';
import { showSaveLoadModal } from './save-load-modal.js';
import { showSettingsPanel } from './settings-panel.js';

const TITLE_SCREEN_ID = 'gal-title-screen';
const DEFAULT_TITLE_SCENE = '__title__';

let hasShownInCurrentSession = false;
let lastShownCharId = '';

function resolveCurrentCharId() {
  return String(getCurrentCharId() || 'default').trim() || 'default';
}

function getTitleScreenSettings() {
  const titleScreen = ensureTitleScreenSettings();
  if (!titleScreen || typeof titleScreen !== 'object') {
    return null;
  }
  return titleScreen;
}

function ensureTitleScreenElement() {
  const $overlay = ensureGlobalOverlay();
  if (!$overlay.length) return null;

  let root = $overlay[0].querySelector(`#${TITLE_SCREEN_ID}`);
  if (root) return root;

  root = topWindow.document.createElement('div');
  root.id = TITLE_SCREEN_ID;
  root.className = 'gal-title-screen';
  root.innerHTML = `
    <div class="gal-title-screen-bg" aria-hidden="true"></div>
    <div class="gal-title-screen-mask" aria-hidden="true"></div>
    <div class="gal-title-screen-content">
      <div class="gal-title-wrapper">
        <h1 class="gal-title-screen-title" data-text="Galgame"></h1>
        <p class="gal-title-screen-subtitle"></p>
      </div>
      <div class="gal-title-screen-actions">
        <button type="button" class="gal-title-screen-btn primary" data-action="start"></button>
        <button type="button" class="gal-title-screen-btn" data-action="settings">设置</button>
        <button type="button" class="gal-title-screen-btn" data-action="load">读档</button>
      </div>
    </div>
  `;

  root.addEventListener('click', event => {
    event.stopPropagation();
  });

  root.querySelector('[data-action="start"]')?.addEventListener('click', event => {
    event.stopPropagation();
    hideTitleScreen();
  });

  root.querySelector('[data-action="settings"]')?.addEventListener('click', event => {
    event.stopPropagation();
    showSettingsPanel('assets', 'title-screen');
  });

  root.querySelector('[data-action="load"]')?.addEventListener('click', event => {
    event.stopPropagation();
    showSaveLoadModal('load');
  });

  $overlay[0].appendChild(root);
  return root;
}

function applyTitleText(root, config) {
  const titleNode = root.querySelector('.gal-title-screen-title');
  const subtitleNode = root.querySelector('.gal-title-screen-subtitle');
  const startButton = root.querySelector('[data-action="start"]');

  const titleText = String(config?.titleText || '').trim();
  const subtitleText = String(config?.subtitleText || '').trim();
  const startButtonText = String(config?.startButtonText || '').trim() || '开始游戏';

  if (titleNode) {
    titleNode.textContent = titleText || 'Galgame';
    titleNode.setAttribute('data-text', titleText || 'Galgame');
    titleNode.style.display = titleText ? '' : 'none';
  }

  if (subtitleNode) {
    subtitleNode.textContent = subtitleText;
    subtitleNode.style.display = subtitleText ? '' : 'none';
  }

  if (startButton) {
    startButton.textContent = startButtonText;
  }
}

function applyBackgroundStyle(root, config, backgroundUrl) {
  const bgNode = root.querySelector('.gal-title-screen-bg');
  if (!bgNode) return;

  const fitMode = config?.backgroundFit === 'contain' ? 'contain' : 'cover';
  const fallbackGradient = 'linear-gradient(145deg, rgba(10, 14, 22, 0.92) 0%, rgba(20, 30, 48, 0.88) 50%, rgba(8, 12, 18, 0.95) 100%)';
  const safeUrl = String(backgroundUrl || '').trim().replace(/"/g, '%22');

  if (safeUrl) {
    bgNode.style.backgroundImage = `url("${safeUrl}"), ${fallbackGradient}`;
    bgNode.style.backgroundSize = `${fitMode}, cover`;
    bgNode.style.backgroundRepeat = 'no-repeat, no-repeat';
    bgNode.style.backgroundPosition = 'center center, center center';
  } else {
    // No dedicated title bg: clear bg div so the game scene shows through the mask
    bgNode.style.backgroundImage = 'none';
    bgNode.style.backgroundSize = '';
    bgNode.style.backgroundRepeat = '';
    bgNode.style.backgroundPosition = '';
  }

  root.classList.toggle('no-mask', config?.enableBackdropMask === false);
}

async function resolveBackgroundUrl(config) {
  if (!config) return '';

  const source = String(config.backgroundSource || 'auto').trim().toLowerCase();
  const uploadSceneName = String(config.backgroundSceneName || DEFAULT_TITLE_SCENE).trim() || DEFAULT_TITLE_SCENE;
  const customUrl = String(config.backgroundUrl || '').trim();
  const readUpload = async (sceneName) => {
    const safeSceneName = String(sceneName || '').trim();
    if (!safeSceneName) return '';
    try {
      return (await getBackground(safeSceneName)) || '';
    } catch (error) {
      console.warn(`[${SCRIPT_NAME}] 标题背景读取失败:`, error);
      return '';
    }
  };

  if (source === 'upload') {
    return readUpload(uploadSceneName);
  }
  if (source === 'url') {
    return customUrl;
  }

  const uploadedUrl = await readUpload(uploadSceneName);
  return uploadedUrl || customUrl;
}

export function resetTitleScreenSession() {
  hasShownInCurrentSession = false;
  lastShownCharId = '';
}

export function hideTitleScreen() {
  const root = topWindow.document.getElementById(TITLE_SCREEN_ID);
  if (!root) return;
  root.classList.remove('active');
}

export function isTitleScreenVisible() {
  const root = topWindow.document.getElementById(TITLE_SCREEN_ID);
  return !!(root && root.classList.contains('active'));
}

export async function maybeShowTitleScreen({ reason = 'chat-enter', force = false } = {}) {
  const currentCharId = resolveCurrentCharId();
  const config = getTitleScreenSettings();
  if (!config || config.enabled === false) {
    hideTitleScreen();
    return false;
  }
  if (!force && lastShownCharId && lastShownCharId !== currentCharId) {
    hasShownInCurrentSession = false;
  }
  if (!force && hasShownInCurrentSession && lastShownCharId === currentCharId) return false;

  const root = ensureTitleScreenElement();
  if (!root) return false;

  applyTitleText(root, config);
  const backgroundUrl = await resolveBackgroundUrl(config);
  applyBackgroundStyle(root, config, backgroundUrl);
  root.classList.add('active');

  hasShownInCurrentSession = true;
  lastShownCharId = currentCharId;
  return true;
}
