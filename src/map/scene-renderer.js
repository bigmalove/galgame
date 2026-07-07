// ============================================
// 场景线稿渲染器：rough.js 手绘 SVG，5 种风格预设
// 布局 JSON → 三层 SVG（地形/结构/标注），固定 seed 保证同布局渲染稳定
// ============================================
import rough from 'roughjs';
import {
  DEFAULT_DARK_SKIN_ID,
  PERSONA_FAMILY_SKIN_IDS,
  SCRIPT_NAME,
  TWILIGHT_FAMILY_SKIN_IDS,
} from '../core/constants.js';
import { $ } from '../core/env.js';
import { CANVAS_H, CANVAS_W, fnv1a } from './scene-schema.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// ============================================
// 5 种风格预设（与 地图线稿风格demo.html 一致）
// ============================================
export const SCENE_STYLES = {
  sumi: {
    id: 'sumi',
    name: '素笺墨线',
    paper: '#f7f2e7', ink: '#3a3630', water: '#4a6f8a', plant: '#5d7a4f', accent: '#a0616a',
    roughness: 1.2, bowing: 1.1,
    font: "'KaiTi','楷体','Segoe Print',cursive",
    paperTexture: 'noise',
  },
  night: {
    id: 'night',
    name: '夜幕墨稿',
    paper: '#211f2a', ink: '#d8d4c8', water: '#7fa8c9', plant: '#8fae7f', accent: '#c9a86a',
    roughness: 1.2, bowing: 1.1,
    font: "'KaiTi','楷体','Segoe Print',cursive",
    paperTexture: 'noise',
  },
  blueprint: {
    id: 'blueprint',
    name: '蓝图制图',
    paper: '#163a63', ink: '#e3eefb', water: '#a8cdf0', plant: '#bfe3c8', accent: '#ffd97a',
    roughness: 0.7, bowing: 0.5,
    font: "'Courier New','SimHei',monospace",
    paperTexture: 'grid',
  },
  parchment: {
    id: 'parchment',
    name: '古卷舆图',
    paper: '#e8d5ae', ink: '#5b4226', water: '#6b7c5e', plant: '#71683a', accent: '#8b2f2f',
    roughness: 1.9, bowing: 1.8,
    font: "'KaiTi','楷体',serif",
    paperTexture: 'vignette',
  },
  minimal: {
    id: 'minimal',
    name: '淡彩极简',
    paper: '#ffffff', ink: '#8a8f99', water: '#c7dcf5', plant: '#d3ecd8', accent: '#e9c46a',
    roughness: 0.6, bowing: 0.4, solidFill: true,
    solidColors: {
      building: '#f6e7c8', area: '#f1f2f4', water: '#d5e6f7', plant: '#ddf0e0',
      furniture: '#ece3d3', landmark: '#f3dede', door: '#e4d9c4',
    },
    font: "'Microsoft YaHei',sans-serif",
    paperTexture: 'none',
  },
};

export const SCENE_STYLE_OPTIONS = [
  { id: 'auto', name: '自动（跟随皮肤）' },
  ...Object.values(SCENE_STYLES).map(s => ({ id: s.id, name: s.name })),
];

// 深色系皮肤 class 列表（auto 模式判定用）
const DARK_SKIN_CLASSES = [DEFAULT_DARK_SKIN_ID, ...TWILIGHT_FAMILY_SKIN_IDS, ...PERSONA_FAMILY_SKIN_IDS, 'skin-shujian-night'];

function isDarkSkinActive() {
  try {
    const $overlay = $('#gal-global-overlay');
    if (!$overlay.length) return false;
    return DARK_SKIN_CLASSES.some(cls => $overlay.hasClass(cls));
  } catch {
    return false;
  }
}

/**
 * 解析风格 ID → 风格对象（'auto' 按皮肤深浅在 sumi/night 间切换）
 */
export function resolveSceneStyle(styleId) {
  const id = String(styleId || 'auto');
  if (id !== 'auto' && SCENE_STYLES[id]) return SCENE_STYLES[id];
  return isDarkSkinActive() ? SCENE_STYLES.night : SCENE_STYLES.sumi;
}

/**
 * 画布容器的纸面背景 CSS（背景色 + 纹理），供 map-modal 应用到 canvas 元素
 */
export function getPaperCss(style) {
  const css = { background: style.paper, backgroundImage: '', backgroundSize: '' };
  if (style.paperTexture === 'noise') {
    css.backgroundImage =
      'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,.06), transparent 60%),' +
      'radial-gradient(ellipse at 75% 80%, rgba(0,0,0,.05), transparent 55%)';
  } else if (style.paperTexture === 'grid') {
    css.backgroundImage =
      'linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px),' +
      'linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px)';
    css.backgroundSize = '28px 28px';
  } else if (style.paperTexture === 'vignette') {
    css.backgroundImage = 'radial-gradient(ellipse at center, transparent 55%, rgba(91,66,38,.28) 100%)';
  }
  return css;
}

// ============================================
// 元素渲染（type → rough.js 图形映射）
// ============================================

// 渲染层级：地形在下、结构在上
const TYPE_ORDER = { area: 0, water: 1, road: 2, wall: 3, building: 4, door: 5, plant: 6, furniture: 7, landmark: 8 };

function drawElement(rc, group, el, idx, style, locationName) {
  const seed = fnv1a(`${locationName}|${el.name}|${idx}`);
  const base = { seed, roughness: style.roughness, bowing: style.bowing, stroke: style.ink };
  const { x: cx, y: cy, w, h } = el;

  // solidFill 风格（minimal）用分类纯色，其他风格用纹理填充
  const fill = (color, fillStyle, extra = {}) =>
    style.solidFill
      ? { fill: style.solidColors[el.type] || '#eee', fillStyle: 'solid', ...extra }
      : { fill: color, fillStyle, ...extra };

  let node = null;
  switch (el.type) {
    case 'wall':
      node = rc.linearPath(el.points, { ...base, strokeWidth: 3 });
      break;
    case 'road':
      node = rc.linearPath(el.points, { ...base, strokeWidth: 2, strokeLineDash: [12, 10] });
      break;
    case 'building':
      if (el.shape === 'polygon' && el.points) {
        node = rc.polygon(el.points, { ...base, strokeWidth: 2.5, ...fill(style.ink, 'cross-hatch', { hachureGap: 11, fillWeight: 0.6 }) });
      } else {
        node = rc.rectangle(cx - w / 2, cy - h / 2, w, h, { ...base, strokeWidth: 2.5, ...fill(style.ink, 'cross-hatch', { hachureGap: 11, fillWeight: 0.6 }) });
      }
      break;
    case 'water':
      if (el.shape === 'polygon' && el.points) {
        node = rc.polygon(el.points, { ...base, stroke: style.water, strokeWidth: 2, ...fill(style.water, 'zigzag', { hachureAngle: 0, hachureGap: 9, fillWeight: 0.8 }) });
      } else {
        node = rc.ellipse(cx, cy, w, h, { ...base, stroke: style.water, strokeWidth: 2, ...fill(style.water, 'zigzag', { hachureAngle: 0, hachureGap: 9, fillWeight: 0.8 }) });
      }
      break;
    case 'plant':
      node = rc.circle(cx, cy, w, { ...base, stroke: style.plant, strokeWidth: 1.5, ...fill(style.plant, 'dots', { hachureGap: 10, fillWeight: 1.2 }) });
      break;
    case 'area':
      if (el.shape === 'polygon' && el.points) {
        node = rc.polygon(el.points, { ...base, strokeWidth: 1, strokeLineDash: [6, 6], ...fill(style.ink, 'hachure', { hachureGap: 15, fillWeight: 0.4 }) });
      } else {
        node = rc.rectangle(cx - w / 2, cy - h / 2, w, h, { ...base, strokeWidth: 1, strokeLineDash: [6, 6], ...fill(style.ink, 'hachure', { hachureGap: 15, fillWeight: 0.4 }) });
      }
      break;
    case 'furniture':
      node = rc.rectangle(cx - w / 2, cy - h / 2, w, h, { ...base, strokeWidth: 1.5, ...fill(style.ink, 'hachure', { hachureGap: 6, fillWeight: 0.5 }) });
      break;
    case 'door':
      node = rc.rectangle(cx - w / 2, cy - h / 2, w, h, { ...base, strokeWidth: 1.5, fill: style.accent, fillStyle: 'solid' });
      break;
    case 'landmark':
    default:
      node = rc.circle(cx, cy, w || 46, { ...base, strokeWidth: 2, ...fill(style.ink, 'cross-hatch', { hachureGap: 6, fillWeight: 0.6 }) });
      break;
  }
  if (node) group.appendChild(node);
}

// 折线/多边形取中点，块状元素取中心上方作为标注位置
function getLabelPosition(el) {
  if ((el.shape === 'polyline' || el.shape === 'polygon') && el.points) {
    const mid = el.points[Math.floor(el.points.length / 2)];
    return { x: mid[0], y: mid[1] - 10 };
  }
  if (el.type === 'building' || el.type === 'area') {
    return { x: el.x, y: el.y + 6 };
  }
  return { x: el.x, y: el.y - (el.h || 40) / 2 - 10 };
}

function drawLabel(doc, group, el, style) {
  if (!el.name) return;
  const pos = getLabelPosition(el);
  const t = doc.createElementNS(SVG_NS, 'text');
  t.setAttribute('x', pos.x);
  t.setAttribute('y', pos.y);
  t.setAttribute('text-anchor', 'middle');
  t.setAttribute('font-size', el.type === 'building' ? 30 : 24);
  t.setAttribute('font-family', style.font);
  t.setAttribute('fill', style.ink);
  t.setAttribute('stroke', style.paper);
  t.setAttribute('stroke-width', 5);
  t.setAttribute('paint-order', 'stroke');
  t.setAttribute('font-weight', '600');
  t.textContent = el.name;
  group.appendChild(t);
}

/**
 * 渲染整份布局为 SVG 元素
 * @param {Document} doc 目标文档（getModalMountRoot().ownerDocument）
 * @param {object} layout sanitize 后的布局 JSON
 * @param {object} style SCENE_STYLES 中的风格对象
 * @returns {SVGElement}
 */
export function renderSceneSvg(doc, layout, style) {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${CANVAS_W} ${CANVAS_H}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('class', 'gal-scene-svg');

  const rc = rough.svg(svg);
  const terrainGroup = doc.createElementNS(SVG_NS, 'g');
  terrainGroup.setAttribute('class', 'gal-scene-terrain');
  const structGroup = doc.createElementNS(SVG_NS, 'g');
  structGroup.setAttribute('class', 'gal-scene-structures');
  const labelGroup = doc.createElementNS(SVG_NS, 'g');
  labelGroup.setAttribute('class', 'gal-scene-labels');
  svg.appendChild(terrainGroup);
  svg.appendChild(structGroup);
  svg.appendChild(labelGroup);

  const locationName = String(layout.location || '');
  const sorted = layout.elements
    .map((el, i) => [el, i])
    .sort((a, b) => (TYPE_ORDER[a[0].type] ?? 9) - (TYPE_ORDER[b[0].type] ?? 9));

  sorted.forEach(([el, i]) => {
    const group = (TYPE_ORDER[el.type] ?? 9) <= 2 ? terrainGroup : structGroup;
    try {
      drawElement(rc, group, el, i, style, locationName);
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 场景元素渲染失败，已跳过:`, el?.name || el?.type, e);
    }
  });
  sorted.forEach(([el]) => {
    try {
      drawLabel(doc, labelGroup, el, style);
    } catch { /* 忽略单个标注失败 */ }
  });

  // 左上角地点标题
  try {
    const title = doc.createElementNS(SVG_NS, 'text');
    title.setAttribute('x', 40);
    title.setAttribute('y', 48);
    title.setAttribute('font-size', 40);
    title.setAttribute('font-family', style.font);
    title.setAttribute('fill', style.ink);
    title.setAttribute('font-weight', 'bold');
    title.setAttribute('letter-spacing', '6');
    title.textContent = `‹ ${locationName} ›`;
    labelGroup.appendChild(title);
  } catch { /* 忽略 */ }

  return svg;
}
