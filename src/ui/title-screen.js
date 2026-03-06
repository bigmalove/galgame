import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow } from '../core/env.js';
import { ensureTitleScreenSettings, getCurrentCharId, getUnlockedSpecialCgIdsForChar } from '../core/settings.js';
import { getBackground } from '../db/backgrounds.js';
import { getSpecialCg, getSpecialCgRecord } from '../db/special-cgs.js';
import { ensureGlobalOverlay } from './overlay.js';
import { showSaveLoadModal } from './save-load-modal.js';
import { showSettingsPanel } from './settings-panel.js';

const TITLE_SCREEN_ID = 'gal-title-screen';
const DEFAULT_TITLE_SCENE = '__title__';

let hasShownInCurrentSession = false;
let lastShownCharId = '';
let cgGalleryLoadToken = 0;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
        <button type="button" class="gal-title-screen-btn" data-action="cg-gallery">CG图鉴</button>
        <button type="button" class="gal-title-screen-btn" data-action="settings">设置</button>
        <button type="button" class="gal-title-screen-btn" data-action="load">读档</button>
      </div>
    </div>
    <div class="gal-title-cg-gallery" aria-hidden="true">
      <div class="gal-title-cg-gallery-panel" role="dialog" aria-modal="true" aria-label="CG图鉴">
        <div class="gal-title-cg-gallery-header">
          <div class="gal-title-cg-gallery-title">CG图鉴</div>
          <button type="button" class="gal-title-cg-gallery-close" aria-label="关闭图鉴">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="gal-title-cg-gallery-subtitle">显示当前角色卡已解锁（已触发过）的 CG</div>
        <div class="gal-title-cg-gallery-body">
          <div class="gal-title-cg-gallery-empty">暂无已解锁 CG</div>
          <div class="gal-title-cg-gallery-grid"></div>
        </div>
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

  root.querySelector('[data-action="cg-gallery"]')?.addEventListener('click', event => {
    event.stopPropagation();
    openTitleCgGallery(root).catch(error => {
      console.warn(`[${SCRIPT_NAME}] 打开CG图鉴失败:`, error);
    });
  });

  root.querySelector('[data-action="settings"]')?.addEventListener('click', event => {
    event.stopPropagation();
    showSettingsPanel('assets', 'title-screen');
  });

  root.querySelector('[data-action="load"]')?.addEventListener('click', event => {
    event.stopPropagation();
    showSaveLoadModal('load');
  });

  const galleryLayer = root.querySelector('.gal-title-cg-gallery');
  galleryLayer?.addEventListener('click', event => {
    event.stopPropagation();
    if (event.target === galleryLayer) {
      closeTitleCgGallery(root);
    }
  });
  root.querySelector('.gal-title-cg-gallery-close')?.addEventListener('click', event => {
    event.stopPropagation();
    closeTitleCgGallery(root);
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
    startButton.textContent = '开始游戏';
  }
}

function closeTitleCgGallery(root) {
  const galleryLayer = root?.querySelector('.gal-title-cg-gallery');
  if (!galleryLayer) return;
  galleryLayer.classList.remove('active');
  galleryLayer.setAttribute('aria-hidden', 'true');
}

async function loadUnlockedCgGalleryItems(charId) {
  const unlockedCgIds = getUnlockedSpecialCgIdsForChar(charId);
  if (!Array.isArray(unlockedCgIds) || unlockedCgIds.length === 0) return [];

  const items = [];
  for (const rawCgId of unlockedCgIds) {
    const cgId = String(rawCgId || '').trim();
    if (!cgId) continue;
    const imageUrl = await getSpecialCg(cgId);
    if (!imageUrl) continue;
    const record = await getSpecialCgRecord(cgId);
    items.push({
      cgId,
      name: String(record?.name || cgId).trim() || cgId,
      description: String(record?.description || '').trim(),
      imageUrl,
    });
  }
  return items;
}

function renderTitleCgGallery(root, items) {
  const galleryLayer = root?.querySelector('.gal-title-cg-gallery');
  if (!galleryLayer) return;
  const emptyNode = galleryLayer.querySelector('.gal-title-cg-gallery-empty');
  const gridNode = galleryLayer.querySelector('.gal-title-cg-gallery-grid');
  if (!emptyNode || !gridNode) return;

  if (!Array.isArray(items) || items.length === 0) {
    gridNode.innerHTML = '';
    emptyNode.textContent = '暂无已解锁 CG';
    emptyNode.style.display = '';
    return;
  }

  gridNode.innerHTML = items
    .map(item => `
      <div class="gal-title-cg-gallery-card" title="${escapeHtml(item.name)}">
        <div class="gal-title-cg-gallery-preview">
          <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}">
        </div>
        <div class="gal-title-cg-gallery-name">${escapeHtml(item.name)}</div>
        ${item.description ? `<div class="gal-title-cg-gallery-desc">${escapeHtml(item.description)}</div>` : ''}
      </div>
    `)
    .join('');
  emptyNode.style.display = 'none';
}

async function openTitleCgGallery(root) {
  if (!root) return;
  const galleryLayer = root.querySelector('.gal-title-cg-gallery');
  if (!galleryLayer) return;
  galleryLayer.classList.add('active');
  galleryLayer.setAttribute('aria-hidden', 'false');

  const emptyNode = galleryLayer.querySelector('.gal-title-cg-gallery-empty');
  const gridNode = galleryLayer.querySelector('.gal-title-cg-gallery-grid');
  if (!emptyNode || !gridNode) return;

  gridNode.innerHTML = '';
  emptyNode.textContent = '正在加载已解锁 CG...';
  emptyNode.style.display = '';

  const token = ++cgGalleryLoadToken;
  const currentCharId = resolveCurrentCharId();
  const items = await loadUnlockedCgGalleryItems(currentCharId);
  if (token !== cgGalleryLoadToken) return;
  renderTitleCgGallery(root, items);
}

function applyBackgroundStyle(root, config, backgroundUrl) {
  const bgNode = root.querySelector('.gal-title-screen-bg');
  if (!bgNode) return;

  const fitMode = config?.backgroundFit === 'contain' ? 'contain' : 'cover';
  const fallbackGradient = 'linear-gradient(145deg, rgb(10, 14, 22) 0%, rgb(20, 30, 48) 50%, rgb(8, 12, 18) 100%)';
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
    if (customUrl) return customUrl;
    // URL 模式但尚未填写时，回退到已上传标题背景，避免页面空白
    return readUpload(uploadSceneName);
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
  closeTitleCgGallery(root);
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
  closeTitleCgGallery(root);
  root.classList.add('active');

  hasShownInCurrentSession = true;
  lastShownCharId = currentCharId;
  return true;
}
