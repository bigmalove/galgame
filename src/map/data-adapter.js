import { topWindow } from '../core/env.js';

const SHEET_UID = {
  GLOBAL: 'sheet_global_data',
  WORLD_MAP: 'sheet_world_map',
  MAP_ELEMENTS: 'sheet_map_elements',
};

const SHEET_NAMES = {
  GLOBAL: ['全局数据表', '全局数据', '全局变量', 'global', 'Global'],
  WORLD_MAP: ['世界地图点', '世界地图点表', '地图点'],
  MAP_ELEMENTS: ['地图元素表', '地图元素', 'map_elements'],
};

const GLOBAL_COL = {
  primaryRegion: ['当前主要地区', '主要地区'],
  secondaryRegion: ['当前次要地区', '次要地区'],
  detailedLocation: ['当前详细地点', '详细地点', '地点', '具体地点'],
};

const WORLD_MAP_COL = {
  detailedLocation: ['详细地点', '地点', '具体地点'],
  secondaryRegion: ['次要地区', '区域', '子区域'],
  locationType: ['地点类型', '类型'],
  envDesc: ['环境描述', '描述'],
  importance: ['重要度', '重要性'],
  exploreState: ['探索状态', '状态'],
  actions: ['交互选项', '交互', '互动', '可交互', '操作选项', '操作', 'acu-card-actions'],
};

const MAP_ELEMENT_COL = {
  elementName: ['元素名称', '名称', '对象名称'],
  elementType: ['元素类型', '类型'],
  location: ['所在地点', '地点', '详细地点'],
  description: ['元素描述', '描述'],
  status: ['状态'],
  actions: ['交互选项', '交互', '互动', '可交互', '操作选项', '操作', 'acu-card-actions'],
};

const WORLD_MAP_ACTION_KEYWORDS = ['地点', '地图', 'location', 'map', '世界', '场所'];
const WORLD_MAP_DEFAULT_ACTIONS = ['前往', '探索', '停留'];

function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function getSheetEntries(tableData) {
  if (!tableData || typeof tableData !== 'object') return [];
  return Object.values(tableData).filter(item => item && typeof item === 'object');
}

function findSheetByUid(tableData, uid) {
  const entries = getSheetEntries(tableData);
  return entries.find(sheet => String(sheet.uid || '').trim() === uid) || null;
}

function findSheetByName(tableData, names = []) {
  const entries = getSheetEntries(tableData);
  const normalized = names.map(name => String(name).trim().toLowerCase());
  return entries.find(sheet => normalized.includes(String(sheet.name || '').trim().toLowerCase())) || null;
}

function resolveSheet(tableData, uid, names) {
  return findSheetByUid(tableData, uid) || findSheetByName(tableData, names);
}

function getHeaderAndRows(sheet) {
  const content = Array.isArray(sheet?.content) ? sheet.content : [];
  const headers = Array.isArray(content[0]) ? content[0] : [];
  const rows = content.slice(1).filter(row => Array.isArray(row));
  return { headers, rows };
}

function findColIndex(headers, aliases = []) {
  const normalizedHeaders = headers.map(h => toText(h));
  for (const alias of aliases) {
    const idx = normalizedHeaders.findIndex(h => h === alias);
    if (idx !== -1) return idx;
  }
  return -1;
}

function getFirstNonEmptyRow(rows) {
  return rows.find(row => row.some(cell => toText(cell) !== '')) || null;
}

function splitActions(raw) {
  const text = toText(raw);
  if (!text) return [];
  return Array.from(
    new Set(
      text
        .split(/[，,、;；]/g)
        .map(v => toText(v))
        .filter(Boolean),
    ),
  );
}

function mergeActions(baseActions = [], extActions = []) {
  const seen = new Set();
  const merged = [];
  [...baseActions, ...extActions].forEach(action => {
    const text = toText(action);
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(text);
  });
  return merged;
}

function getDefaultActionsForWorldMapTable(tableName) {
  const name = toText(tableName).toLowerCase();
  if (!name) return [];
  const matched = WORLD_MAP_ACTION_KEYWORDS.some(keyword => name.includes(String(keyword).toLowerCase()));
  return matched ? [...WORLD_MAP_DEFAULT_ACTIONS] : [];
}

export function buildMapViewModel() {
  const fallback = {
    hasAutoCardUpdater: false,
    regionKey: 'default-region',
    primaryRegion: '',
    secondaryRegion: '',
    currentDetailedLocation: '',
    points: [],
    pointActionsByLocation: {},
    actionsByLocation: {},
    errors: [],
  };

  try {
    const api = topWindow?.AutoCardUpdaterAPI;
    if (!api || typeof api.exportTableAsJson !== 'function') {
      return fallback;
    }

    const tableData = api.exportTableAsJson();
    if (!tableData || typeof tableData !== 'object') {
      return fallback;
    }

    const globalSheet = resolveSheet(tableData, SHEET_UID.GLOBAL, SHEET_NAMES.GLOBAL);
    const worldMapSheet = resolveSheet(tableData, SHEET_UID.WORLD_MAP, SHEET_NAMES.WORLD_MAP);
    const mapElementsSheet = resolveSheet(tableData, SHEET_UID.MAP_ELEMENTS, SHEET_NAMES.MAP_ELEMENTS);

    const errors = [];

    let primaryRegion = '';
    let secondaryRegion = '';
    let currentDetailedLocation = '';

    if (globalSheet) {
      const { headers, rows } = getHeaderAndRows(globalSheet);
      const row = getFirstNonEmptyRow(rows) || [];
      const idxPrimary = findColIndex(headers, GLOBAL_COL.primaryRegion);
      const idxSecondary = findColIndex(headers, GLOBAL_COL.secondaryRegion);
      const idxDetailed = findColIndex(headers, GLOBAL_COL.detailedLocation);
      if (idxPrimary >= 0) primaryRegion = toText(row[idxPrimary]);
      if (idxSecondary >= 0) secondaryRegion = toText(row[idxSecondary]);
      if (idxDetailed >= 0) currentDetailedLocation = toText(row[idxDetailed]);
    }

    const points = [];
    const pointActionsByLocation = {};
    if (worldMapSheet) {
      const { headers, rows } = getHeaderAndRows(worldMapSheet);
      const idxDetail = findColIndex(headers, WORLD_MAP_COL.detailedLocation);
      const idxSecondary = findColIndex(headers, WORLD_MAP_COL.secondaryRegion);
      const idxType = findColIndex(headers, WORLD_MAP_COL.locationType);
      const idxEnv = findColIndex(headers, WORLD_MAP_COL.envDesc);
      const idxImportance = findColIndex(headers, WORLD_MAP_COL.importance);
      const idxExplore = findColIndex(headers, WORLD_MAP_COL.exploreState);
      const idxActions = findColIndex(headers, WORLD_MAP_COL.actions);
      const defaultPointActions = getDefaultActionsForWorldMapTable(worldMapSheet.name);
      const unique = new Set();

      rows.forEach((row, index) => {
        const detailedLocation = idxDetail >= 0 ? toText(row[idxDetail]) : '';
        if (!detailedLocation || unique.has(detailedLocation)) return;
        unique.add(detailedLocation);
        points.push({
          id: `${detailedLocation}#${index}`,
          detailedLocation,
          secondaryRegion: idxSecondary >= 0 ? toText(row[idxSecondary]) : '',
          locationType: idxType >= 0 ? toText(row[idxType]) : '',
          envDesc: idxEnv >= 0 ? toText(row[idxEnv]) : '',
          importance: idxImportance >= 0 ? toText(row[idxImportance]) : '',
          exploreState: idxExplore >= 0 ? toText(row[idxExplore]) : '',
        });
        pointActionsByLocation[detailedLocation] = mergeActions(
          defaultPointActions,
          idxActions >= 0 ? splitActions(row[idxActions]) : [],
        );
      });
    } else {
      errors.push('sheet_world_map not found');
    }

    const actionsByLocation = {};
    if (mapElementsSheet) {
      const { headers, rows } = getHeaderAndRows(mapElementsSheet);
      const idxName = findColIndex(headers, MAP_ELEMENT_COL.elementName);
      const idxType = findColIndex(headers, MAP_ELEMENT_COL.elementType);
      const idxLocation = findColIndex(headers, MAP_ELEMENT_COL.location);
      const idxDesc = findColIndex(headers, MAP_ELEMENT_COL.description);
      const idxStatus = findColIndex(headers, MAP_ELEMENT_COL.status);
      const idxActions = findColIndex(headers, MAP_ELEMENT_COL.actions);

      rows.forEach(row => {
        const location = idxLocation >= 0 ? toText(row[idxLocation]) : '';
        if (!location) return;
        if (!actionsByLocation[location]) actionsByLocation[location] = [];
        actionsByLocation[location].push({
          elementName: idxName >= 0 ? toText(row[idxName]) : '',
          elementType: idxType >= 0 ? toText(row[idxType]) : '',
          description: idxDesc >= 0 ? toText(row[idxDesc]) : '',
          status: idxStatus >= 0 ? toText(row[idxStatus]) : '',
          actions: idxActions >= 0 ? splitActions(row[idxActions]) : [],
        });
      });
    }

    return {
      hasAutoCardUpdater: true,
      regionKey: primaryRegion || 'default-region',
      primaryRegion,
      secondaryRegion,
      currentDetailedLocation,
      points,
      pointActionsByLocation,
      actionsByLocation,
      errors,
    };
  } catch (error) {
    return {
      ...fallback,
      errors: [error?.message ? String(error.message) : String(error)],
    };
  }
}
