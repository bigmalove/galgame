// ============================================
// 场景角色标记层：为主角与在场 NPC 分配站位并渲染「缩小立绘 + 人物名」标记
// 位置策略：LLM anchors 优先按序分配，不足时 FNV-1a 哈希散布（避开建筑/水体、避免重叠）
// ============================================
import { SCRIPT_NAME } from '../core/constants.js';
import { $ } from '../core/env.js';
import { getSprite } from '../db/sprites.js';
import { CANVAS_H, CANVAS_W, fnv1a } from './scene-schema.js';

// 角色标记之间的最小间距（画布单位）
const MIN_MARKER_DISTANCE = 80;
// 哈希散布最大探测次数
const MAX_PROBES = 8;

// 判断点是否落入某个「实心」元素（建筑/水体）的包围盒
function isInsideSolidElement(x, y, layout) {
  for (const el of layout.elements) {
    if (el.type !== 'building' && el.type !== 'water') continue;
    let minX;
    let maxX;
    let minY;
    let maxY;
    if ((el.shape === 'polygon' || el.shape === 'polyline') && el.points) {
      const xs = el.points.map(p => p[0]);
      const ys = el.points.map(p => p[1]);
      minX = Math.min(...xs);
      maxX = Math.max(...xs);
      minY = Math.min(...ys);
      maxY = Math.max(...ys);
    } else if (Number.isFinite(el.x)) {
      minX = el.x - el.w / 2;
      maxX = el.x + el.w / 2;
      minY = el.y - el.h / 2;
      maxY = el.y + el.h / 2;
    } else {
      continue;
    }
    if (x >= minX && x <= maxX && y >= minY && y <= maxY) return true;
  }
  return false;
}

function tooCloseToOccupied(x, y, occupied) {
  return occupied.some(p => Math.hypot(p.x - x, p.y - y) < MIN_MARKER_DISTANCE);
}

// 哈希散布：同名同布局位置确定性稳定
function hashScatter(name, layout, occupied) {
  const locationSalt = String(layout.location || '');
  for (let probe = 0; probe < MAX_PROBES; probe++) {
    const hx = fnv1a(`${locationSalt}|${name}|x|${probe}`);
    const hy = fnv1a(`${locationSalt}|${name}|y|${probe}`);
    const x = Math.round(120 + (hx % 1000) / 1000 * (CANVAS_W - 240));
    const y = Math.round(120 + (hy % 1000) / 1000 * (CANVAS_H - 240));
    if (isInsideSolidElement(x, y, layout)) continue;
    if (tooCloseToOccupied(x, y, occupied)) continue;
    return { x, y };
  }
  // 探测全部失败：放画布中心附近偏移
  const offset = fnv1a(`${locationSalt}|${name}|fb`) % 120 - 60;
  return { x: CANVAS_W / 2 + offset, y: CANVAS_H / 2 + offset };
}

/**
 * 为角色列表分配站位
 * @param {object} layout 布局 JSON
 * @param {object[]} characters [{ name, isProtagonist, ... }]，主角应放在第 0 位
 * @returns {Map<string, {x,y}>} 角色名 → 画布坐标
 */
export function assignCharacterPositions(layout, characters) {
  const positions = new Map();
  const occupied = [];
  const anchors = Array.isArray(layout.anchors) ? layout.anchors : [];
  let anchorCursor = 0;

  for (const ch of characters) {
    let pos = null;
    // 依次取未用的锚点（跳过与已占位过近的锚点）
    while (anchorCursor < anchors.length) {
      const anchor = anchors[anchorCursor++];
      if (!tooCloseToOccupied(anchor.x, anchor.y, occupied)) {
        pos = { x: anchor.x, y: anchor.y };
        break;
      }
    }
    if (!pos) pos = hashScatter(ch.name, layout, occupied);
    positions.set(ch.name, pos);
    occupied.push(pos);
  }
  return positions;
}

// 首字圆形头像的确定性配色（无立绘时的最终兜底）
const AVATAR_HUES = [8, 32, 145, 200, 262, 320];

function buildFallbackAvatarStyle(name) {
  const hue = AVATAR_HUES[fnv1a(name) % AVATAR_HUES.length];
  return `background:linear-gradient(135deg, hsl(${hue},52%,58%), hsl(${hue},48%,42%));`;
}

// 按性别取路人剪影（与 sprite-manager 的回退顺序一致）
async function resolveMarkerSpriteUrl(character) {
  try {
    const direct = await getSprite(character.name, '默认');
    if (direct) return direct;
    if (character.isProtagonist) return null;
    const gender = String(character.gender || '');
    let fallbackNames;
    if (/男/.test(gender)) fallbackNames = ['路人男', '路人', '路人女'];
    else if (/女/.test(gender)) fallbackNames = ['路人女', '路人', '路人男'];
    else fallbackNames = ['路人', '路人男', '路人女'];
    for (const npcName of fallbackNames) {
      const url = await getSprite(npcName, '默认');
      if (url) return url;
    }
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 获取角色标记立绘失败: ${character?.name}`, e);
  }
  return null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 渲染角色标记层（同步渲染首字占位，异步填充立绘缩略图）
 * @param {jQuery} $layer 标记层容器（.gal-scene-marker-layer）
 * @param {object} layout 布局 JSON
 * @param {object[]} characters 角色列表（主角在第 0 位，含 isProtagonist/gender）
 */
export function renderMarkerLayer($layer, layout, characters) {
  if (!$layer || !$layer.length) return;
  const positions = assignCharacterPositions(layout, characters);

  const html = characters
    .map(ch => {
      const pos = positions.get(ch.name);
      if (!pos) return '';
      const leftPct = ((pos.x / CANVAS_W) * 100).toFixed(3);
      const topPct = ((pos.y / CANVAS_H) * 100).toFixed(3);
      const roleClass = ch.isProtagonist ? ' protagonist' : '';
      const star = ch.isProtagonist ? '☆ ' : '';
      const safeName = escapeHtml(ch.name);
      return `
        <div class="gal-scene-marker${roleClass}" data-character="${safeName}" data-protagonist="${ch.isProtagonist ? '1' : '0'}"
             style="left:${leftPct}%; top:${topPct}%;" title="${ch.isProtagonist ? '查看主角状态' : `与 ${safeName} 交互`}">
          <div class="gal-scene-avatar" style="${buildFallbackAvatarStyle(ch.name)}">
            <span class="gal-scene-avatar-initial">${escapeHtml(ch.name.slice(0, 1))}</span>
          </div>
          <div class="gal-scene-marker-name">${star}${safeName}</div>
        </div>
      `;
    })
    .join('');
  $layer.html(html);

  // 异步填充立绘缩略图
  characters.forEach(ch => {
    resolveMarkerSpriteUrl(ch).then(url => {
      if (!url) return;
      const $marker = $layer.find('.gal-scene-marker').filter((_, el) => String($(el).attr('data-character')) === ch.name);
      if (!$marker.length) return;
      const $avatar = $marker.find('.gal-scene-avatar');
      $avatar.find('.gal-scene-avatar-initial').remove();
      $avatar.css('background', 'rgba(0,0,0,.15)');
      $avatar.append(`<img class="gal-scene-avatar-img" src="${escapeHtml(url)}" alt="${escapeHtml(ch.name)}">`);
    });
  });
}
