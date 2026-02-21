function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function hashToUnit(value) {
  const text = String(value || '');
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return ((h >>> 0) % 1000000) / 1000000;
}

function distance(a, b) {
  const dx = Number(a?.x || 0) - Number(b?.x || 0);
  const dy = Number(a?.y || 0) - Number(b?.y || 0);
  return Math.sqrt(dx * dx + dy * dy);
}

function buildGroupGrid(groupCount) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(groupCount)));
  const rows = Math.max(1, Math.ceil(groupCount / cols));
  return { rows, cols };
}

function buildGroupBounds(groupIndex, rows, cols) {
  const row = Math.floor(groupIndex / cols);
  const col = groupIndex % cols;
  const cellW = 1 / cols;
  const cellH = 1 / rows;
  const padX = Math.min(0.04, cellW * 0.18);
  const padY = Math.min(0.04, cellH * 0.18);
  const minX = col * cellW + padX;
  const maxX = (col + 1) * cellW - padX;
  const minY = row * cellH + padY;
  const maxY = (row + 1) * cellH - padY;
  return { minX, maxX, minY, maxY };
}

function samplePointInBounds(seedBase, bounds) {
  const rx = hashToUnit(`${seedBase}:x`);
  const ry = hashToUnit(`${seedBase}:y`);
  const x = bounds.minX + (bounds.maxX - bounds.minX) * rx;
  const y = bounds.minY + (bounds.maxY - bounds.minY) * ry;
  return { x, y };
}

export function generateAutoLayout(points, regionKey = '', seed = 'default') {
  const list = Array.isArray(points) ? points : [];
  const grouped = {};

  list.forEach(point => {
    const groupKey = String(point?.secondaryRegion || '').trim() || '__default_group__';
    if (!grouped[groupKey]) grouped[groupKey] = [];
    grouped[groupKey].push(point);
  });

  const groupKeys = Object.keys(grouped).sort((a, b) => String(a).localeCompare(String(b), 'zh-Hans-CN'));
  const { rows, cols } = buildGroupGrid(groupKeys.length || 1);
  const coords = {};
  const placed = [];
  const minDistance = 0.055;

  groupKeys.forEach((groupKey, groupIndex) => {
    const bounds = buildGroupBounds(groupIndex, rows, cols);
    const groupPoints = (grouped[groupKey] || []).slice().sort((a, b) => {
      return String(a?.detailedLocation || '').localeCompare(String(b?.detailedLocation || ''), 'zh-Hans-CN');
    });

    groupPoints.forEach((point, pointIndex) => {
      const location = String(point?.detailedLocation || '').trim();
      if (!location) return;

      const baseSeed = `${seed}|${regionKey}|${groupKey}|${location}|${pointIndex}`;
      let candidate = samplePointInBounds(baseSeed, bounds);
      let attempt = 0;

      while (attempt < 48) {
        const hasCollision = placed.some(item => distance(item, candidate) < minDistance);
        if (!hasCollision) break;
        attempt += 1;
        const angle = hashToUnit(`${baseSeed}:a:${attempt}`) * Math.PI * 2;
        const radius = Math.min(0.12, 0.012 * attempt);
        candidate = {
          x: clamp01(candidate.x + Math.cos(angle) * radius),
          y: clamp01(candidate.y + Math.sin(angle) * radius),
        };
      }

      placed.push(candidate);
      coords[location] = {
        x: clamp01(candidate.x),
        y: clamp01(candidate.y),
        anchor: '',
      };
    });
  });

  return coords;
}

