import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow } from '../core/env.js';

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 180;
const DEFAULT_QUALITY = 0.55;
const DIALOGUE_MAX_LENGTH = 54;

function extractCssUrl(value) {
  if (!value || value === 'none') return '';
  const match = String(value).match(/url\((['"]?)(.*?)\1\)/i);
  return match?.[2] || '';
}

function getRelativeRect(targetRect, containerRect, width, height) {
  if (!targetRect || !containerRect || containerRect.width <= 0 || containerRect.height <= 0) {
    return null;
  }
  const scaleX = width / containerRect.width;
  const scaleY = height / containerRect.height;
  const x = (targetRect.left - containerRect.left) * scaleX;
  const y = (targetRect.top - containerRect.top) * scaleY;
  const w = targetRect.width * scaleX;
  const h = targetRect.height * scaleY;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return null;
  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    w: Math.max(1, w),
    h: Math.max(1, h),
  };
}

function drawCoverImage(ctx, image, width, height) {
  const imgWidth = Number(image?.naturalWidth || image?.videoWidth || image?.width || 0);
  const imgHeight = Number(image?.naturalHeight || image?.videoHeight || image?.height || 0);
  if (imgWidth <= 0 || imgHeight <= 0) return false;

  const targetRatio = width / height;
  const imageRatio = imgWidth / imgHeight;
  let sx = 0;
  let sy = 0;
  let sw = imgWidth;
  let sh = imgHeight;
  if (imageRatio > targetRatio) {
    sw = imgHeight * targetRatio;
    sx = (imgWidth - sw) * 0.5;
  } else if (imageRatio < targetRatio) {
    sh = imgWidth / targetRatio;
    sy = (imgHeight - sh) * 0.5;
  }

  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
  return true;
}

function drawPlaceholder(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#111827');
  gradient.addColorStop(1, '#334155');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.fillRect(0, height - 58, width, 58);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '600 14px "Noto Sans SC", "Microsoft YaHei", sans-serif';
  ctx.fillText('Galgame 存档', 14, height - 24);
}

function drawDialogueOverlay(ctx, overlay, width, height) {
  const text = String(overlay?.querySelector('.gal-dialog-text')?.textContent || '').replace(/\s+/g, ' ').trim();
  if (!text) return;
  const preview = text.length > DIALOGUE_MAX_LENGTH ? `${text.slice(0, DIALOGUE_MAX_LENGTH)}...` : text;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.54)';
  ctx.fillRect(0, height - 52, width, 52);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '12px "Noto Sans SC", "Microsoft YaHei", sans-serif';
  ctx.fillText(preview, 12, height - 22);
}

async function loadImage(src) {
  if (!src) return null;
  return await new Promise(resolve => {
    const img = new Image();
    const timer = setTimeout(() => resolve(null), 2500);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

async function drawBackgroundLayers(ctx, overlay, width, height) {
  const layers = [
    overlay?.querySelector('.gal-bg-layer.gal-bg-base'),
    overlay?.querySelector('.gal-bg-layer.gal-bg-front'),
  ].filter(Boolean);

  for (const layer of layers) {
    const style = topWindow.getComputedStyle(layer);
    // 「避开对话框」模式下图片由伪元素绘制、元素自身 background-image 为 none，
    // 因此优先读 --gal-bg-url，保证三种填充模式都能截到背景
    const src = extractCssUrl(style.getPropertyValue('--gal-bg-url')) || extractCssUrl(style.backgroundImage);
    if (!src) continue;
    const image = await loadImage(src);
    if (!image) continue;
    drawCoverImage(ctx, image, width, height);
  }
}

function drawSpritesAndCanvases(ctx, overlay, container, width, height) {
  if (!overlay || !container) return;
  const containerRect = container.getBoundingClientRect();
  if (containerRect.width <= 0 || containerRect.height <= 0) return;

  const drawableNodes = [
    ...overlay.querySelectorAll('.gal-char-img'),
    ...overlay.querySelectorAll('.gal-layer-character canvas'),
    ...overlay.querySelectorAll('.gal-layer-effect-bg canvas, .gal-layer-effect-fg canvas'),
  ];

  drawableNodes.forEach(node => {
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const target = getRelativeRect(rect, containerRect, width, height);
    if (!target) return;
    try {
      ctx.drawImage(node, target.x, target.y, target.w, target.h);
    } catch (error) {
      // 忽略单个素材绘制失败，继续输出可用缩略图
    }
  });
}

export async function captureSaveThumbnail(options = {}) {
  const width = Math.max(64, Number(options.width) || DEFAULT_WIDTH);
  const height = Math.max(36, Number(options.height) || DEFAULT_HEIGHT);
  const quality = Math.max(0.2, Math.min(0.92, Number(options.quality) || DEFAULT_QUALITY));

  try {
    const doc = topWindow.document;
    const overlay = doc.getElementById('gal-global-overlay');
    const container = overlay?.querySelector('.gal-game-container');
    if (!overlay || !container) return null;

    const canvas = doc.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    drawPlaceholder(ctx, width, height);

    const cgThumb = overlay.querySelector('.gal-cg-thumbnail');
    if (cgThumb) {
      try {
        drawCoverImage(ctx, cgThumb, width, height);
      } catch (error) {
        // 如果 CG 缩略图不可绘制，继续走通用采集流程
      }
    } else {
      await drawBackgroundLayers(ctx, overlay, width, height);
      drawSpritesAndCanvases(ctx, overlay, container, width, height);
      drawDialogueOverlay(ctx, overlay, width, height);
    }

    return canvas.toDataURL('image/jpeg', quality);
  } catch (error) {
    console.warn(`[${SCRIPT_NAME}] 存档缩略图生成失败:`, error);
    return null;
  }
}
