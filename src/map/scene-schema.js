// ============================================
// 场景地图布局 Schema：类型定义、清洗校验、程序化兜底布局
// ============================================

// 虚拟画布尺寸（4:3，LLM 输出整数坐标）
export const CANVAS_W = 1000;
export const CANVAS_H = 750;

// 元素类型枚举（未知类型归为 landmark）
export const ELEMENT_TYPES = ['area', 'building', 'wall', 'door', 'road', 'water', 'plant', 'furniture', 'landmark'];

// 形状枚举
const SHAPES = ['rect', 'ellipse', 'circle', 'polygon', 'polyline'];

// 各类型缺省形状
const DEFAULT_SHAPE_BY_TYPE = {
  area: 'rect',
  building: 'rect',
  wall: 'polyline',
  door: 'rect',
  road: 'polyline',
  water: 'ellipse',
  plant: 'circle',
  furniture: 'rect',
  landmark: 'circle',
};

// 单张地图元素上限（防止 LLM 输出爆炸）
const MAX_ELEMENTS = 24;
// 锚点数量上限
const MAX_ANCHORS = 10;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toNum(value, fallback = NaN) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

// FNV-1a 哈希（确定性布局/渲染种子共用）
export function fnv1a(str) {
  let h = 0x811c9dc5;
  const text = String(str);
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 2147483647 || 1;
}

/**
 * 清洗单个元素：非法则返回 null（丢弃该元素，不影响整体）
 */
function sanitizeElement(raw) {
  if (!raw || typeof raw !== 'object') return null;

  let type = toText(raw.type).toLowerCase();
  if (!ELEMENT_TYPES.includes(type)) type = 'landmark';

  let shape = toText(raw.shape).toLowerCase();
  if (!SHAPES.includes(shape)) shape = DEFAULT_SHAPE_BY_TYPE[type];

  const el = {
    name: toText(raw.name).slice(0, 20),
    type,
    shape,
  };

  if (shape === 'polyline' || shape === 'polygon') {
    const points = Array.isArray(raw.points) ? raw.points : [];
    const cleaned = points
      .map(p => {
        if (!Array.isArray(p) || p.length < 2) return null;
        const x = toNum(p[0]);
        const y = toNum(p[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return [clamp(Math.round(x), 0, CANVAS_W), clamp(Math.round(y), 0, CANVAS_H)];
      })
      .filter(Boolean);
    if (cleaned.length < 2) return null;
    el.points = cleaned.slice(0, 40);
  } else {
    const x = toNum(raw.x);
    const y = toNum(raw.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    el.x = clamp(Math.round(x), 0, CANVAS_W);
    el.y = clamp(Math.round(y), 0, CANVAS_H);
    el.w = clamp(Math.round(toNum(raw.w, 60)), 10, CANVAS_W);
    el.h = clamp(Math.round(toNum(raw.h, el.w)), 10, CANVAS_H);
  }

  return el;
}

/**
 * 清洗整份布局 JSON。返回 { layout, dropped }；完全不可用时返回 { layout: null }
 */
export function sanitizeLayout(raw, locationName = '') {
  if (!raw || typeof raw !== 'object') return { layout: null, dropped: 0 };
  const sourceElements = Array.isArray(raw.elements) ? raw.elements : [];
  if (!sourceElements.length) return { layout: null, dropped: 0 };

  const elements = [];
  let dropped = 0;
  for (const rawEl of sourceElements) {
    if (elements.length >= MAX_ELEMENTS) {
      dropped++;
      continue;
    }
    const el = sanitizeElement(rawEl);
    if (el) elements.push(el);
    else dropped++;
  }
  if (!elements.length) return { layout: null, dropped };

  const anchors = (Array.isArray(raw.anchors) ? raw.anchors : [])
    .map(a => {
      const x = toNum(a?.x);
      const y = toNum(a?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      if (x < 0 || x > CANVAS_W || y < 0 || y > CANVAS_H) return null;
      return { x: Math.round(x), y: Math.round(y), hint: toText(a?.hint).slice(0, 20) };
    })
    .filter(Boolean)
    .slice(0, MAX_ANCHORS);

  return {
    layout: {
      version: 1,
      location: toText(raw.location) || toText(locationName),
      style: toText(raw.style) || '',
      elements,
      anchors,
    },
    dropped,
  };
}

/**
 * 程序化兜底布局：LLM 生成失败时保证地图仍可打开。
 * 按地点名哈希摆放少量陈设，中央环形锚点。
 */
export function makeFallbackLayout(locationName = '', characterCount = 3) {
  const seedBase = fnv1a(locationName || 'fallback');
  const rand = salt => (fnv1a(`${seedBase}|${salt}`) % 1000) / 1000;

  const elements = [
    // 外墙（南侧留出入口）
    {
      name: '', type: 'wall', shape: 'polyline',
      points: [[430, 690], [70, 690], [70, 70], [930, 70], [930, 690], [570, 690]],
    },
    { name: '入口', type: 'door', shape: 'rect', x: 500, y: 690, w: 140, h: 24 },
  ];

  // 按哈希散布 3 个陈设
  for (let i = 0; i < 3; i++) {
    const x = Math.round(180 + rand(`fx${i}`) * 640);
    const y = Math.round(160 + rand(`fy${i}`) * 360);
    elements.push({
      name: '', type: 'furniture', shape: 'rect',
      x, y,
      w: Math.round(70 + rand(`fw${i}`) * 90),
      h: Math.round(40 + rand(`fh${i}`) * 50),
    });
  }

  // 中央环形锚点
  const anchors = [];
  const count = Math.max(4, Math.min(8, characterCount + 2));
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + rand('rot') * Math.PI;
    anchors.push({
      x: Math.round(CANVAS_W / 2 + Math.cos(angle) * 190),
      y: Math.round(CANVAS_H / 2 + Math.sin(angle) * 140),
      hint: '',
    });
  }

  return {
    version: 1,
    location: locationName,
    style: '',
    elements,
    anchors,
    _fallback: true,
  };
}
