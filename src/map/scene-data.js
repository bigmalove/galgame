// ============================================
// 场景地图数据适配层：从 AutoCardUpdaterAPI 读取各数据库表
// （全局数据表 / 重要角色表 / 主角信息表 / 主角技能表 / 背包物品表 / 任务与事件表）
// ============================================
import { topWindow } from '../core/env.js';

// 表名别名（按名称容错匹配，UID 优先）
const SHEET_UID = {
  GLOBAL: 'sheet_global_data',
};

const SHEET_NAMES = {
  GLOBAL: ['全局数据表', '全局数据', '全局变量', 'global', 'Global'],
  NPC: ['重要角色表', '重要人物表', '重要人物', 'NPC', 'npc', '角色列表', '人物列表'],
  PROTAGONIST: ['主角信息', '主角信息表', '主角', '玩家信息', 'User', 'user', '用户'],
  SKILLS: ['主角技能表', '技能表', '主角技能', '技能列表'],
  INVENTORY: ['背包物品表', '背包', '物品表', '物品栏', '背包表'],
  EQUIPMENT: ['装备表', '装备', '装备栏'],
  QUESTS: ['任务与事件表', '任务表', '任务列表', '事件表', '任务与事件'],
  WORKBENCH: ['地图生成表'],
};

const GLOBAL_COL = {
  primaryRegion: ['当前主要地区', '主要地区', '主地区'],
  secondaryRegion: ['当前次要地区', '次要地区', '副地区'],
  detailedLocation: ['当前详细地点', '详细地点', '地点', '具体地点', '主角当前所在地点', '当前所在地点', '所在地点', '当前位置', '当前地点'],
  currentTime: ['当前时间', '时间', '游戏时间'],
  envDesc: ['环境描述', '当前环境', '天气', '场景描述'],
};

const NPC_COL = {
  name: ['姓名', '人物名称', '角色名', '名字', 'name', 'Name'],
  gender: ['性别', '性别/年龄'],
  age: ['年龄'],
  briefIntro: ['一句话介绍', '简介', '介绍'],
  appearance: ['外貌特征', '外貌', '长相'],
  outfit: ['穿着打扮', '穿着', '服装'],
  identity: ['身份', '职业', '头衔'],
  baseAttributes: ['基础属性', '普通属性'],
  specialAttributes: ['特有属性', '特殊属性', '特殊能力'],
  items: ['持有的重要物品', '持有物品', '重要物品', '随身物品', '持有道具'],
  location: ['所在地点', '当前地点', '地点', '位置'],
  presence: ['在场状态', '是否离场', '在场', '状态'],
  relation: ['人际关系', '关系'],
  pastExperience: ['过往经历', '经历', '背景'],
  actions: ['交互选项', '交互', '互动', '可交互', '操作选项', '操作'],
};

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
  return (uid ? findSheetByUid(tableData, uid) : null) || findSheetByName(tableData, names);
}

export function getHeaderAndRows(sheet) {
  const content = Array.isArray(sheet?.content) ? sheet.content : [];
  const headers = Array.isArray(content[0]) ? content[0] : [];
  const rows = content.slice(1).filter(row => Array.isArray(row));
  return { headers, rows };
}

export function findColIndex(headers, aliases = []) {
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

// 交互选项按中英文分隔符拆分并去重
export function splitActions(raw) {
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

// 读取数据库全部表格；不可用时返回 null
export function getTableData() {
  try {
    const api = topWindow?.AutoCardUpdaterAPI;
    if (!api || typeof api.exportTableAsJson !== 'function') return null;
    const tableData = api.exportTableAsJson();
    if (!tableData || typeof tableData !== 'object') return null;
    return tableData;
  } catch {
    return null;
  }
}

/**
 * 「地图生成表」（工作台）最新一行的地点——填表 AI 最近为哪个地点生成过地图。
 * 全局数据表的当前详细地点为空/漏填时的兜底数据源。
 */
export function getLatestGeneratedLocation(tableData) {
  const sheet = resolveSheet(tableData, 'sheet_gal_map_workbench', SHEET_NAMES.WORKBENCH);
  if (!sheet) return '';
  const { headers, rows } = getHeaderAndRows(sheet);
  const idxLoc = findColIndex(headers, ['地点', 'location']);
  if (idxLoc < 0) return '';
  // 工作台行按生成顺序追加（收割后保留占位行），最后一个非空地点即最新
  for (let i = rows.length - 1; i >= 0; i--) {
    const loc = toText(rows[i][idxLoc]);
    if (loc) return loc;
  }
  return '';
}

/**
 * 读全局数据表：当前地点三级 + 时间 + 环境线索。
 * 详细地点为空时回退「地图生成表」最新生成的地点。
 */
export function getGlobalSceneInfo(tableData) {
  const result = {
    primaryRegion: '',
    secondaryRegion: '',
    detailedLocation: '',
    currentTime: '',
    envDesc: '',
  };
  const sheet = resolveSheet(tableData, SHEET_UID.GLOBAL, SHEET_NAMES.GLOBAL);
  if (sheet) {
    const { headers, rows } = getHeaderAndRows(sheet);
    const row = getFirstNonEmptyRow(rows) || [];
    for (const [field, aliases] of Object.entries(GLOBAL_COL)) {
      const idx = findColIndex(headers, aliases);
      if (idx >= 0) result[field] = toText(row[idx]);
    }
    // 地点列模糊兜底：兼容各种模板的列命名（任何包含「地点/位置」的列）
    if (!result.detailedLocation) {
      const fuzzyIdx = headers.findIndex(h => {
        const t = toText(h);
        return (t.includes('地点') || t.includes('位置')) && !t.includes('时间');
      });
      if (fuzzyIdx >= 0) result.detailedLocation = toText(row[fuzzyIdx]);
    }
  }
  if (!result.detailedLocation) {
    result.detailedLocation = getLatestGeneratedLocation(tableData);
  }
  return result;
}

// 在场状态归一化判定（presenceHeader 为实际匹配到的列名）
function isPresent(presenceText, presenceHeader = '') {
  const text = toText(presenceText);
  // 反义列（如「是否离场」）：除非明确表示已离场，否则视为在场（该类列默认值为「否」）
  if (/离场/.test(toText(presenceHeader))) {
    return !/^(是|已离场|离场)$/.test(text);
  }
  if (!text) return false;
  return /在场|是|同行|随行/.test(text);
}

// 地点匹配：先精确相等，再双向 includes 宽松匹配（兼容「学校-教室」类变体）。
// 角色表没有地点列/未填地点、或当前地点未知时，不做地点过滤（视为跟随当前场景）。
function locationMatches(charLocation, currentLocation) {
  const a = toText(charLocation);
  if (!a) return true;
  const b = toText(currentLocation);
  if (!b) return true;
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}

/**
 * 读重要角色表并筛选出「在当前详细地点且在场」的 NPC
 * @returns {{ all: object[], present: object[] }}
 */
export function getNpcList(tableData, currentLocation) {
  const all = [];
  const sheet = resolveSheet(tableData, null, SHEET_NAMES.NPC);
  if (!sheet) return { all, present: [] };

  const { headers, rows } = getHeaderAndRows(sheet);
  const idx = {};
  for (const [field, aliases] of Object.entries(NPC_COL)) {
    idx[field] = findColIndex(headers, aliases);
  }
  if (idx.name < 0) return { all, present: [] };

  const presenceHeader = idx.presence >= 0 ? toText(headers[idx.presence]) : '';

  rows.forEach((row, rowIndex) => {
    const name = toText(row[idx.name]);
    if (!name) return;

    // 「性别/年龄」合并列拆分（如 "男/约55岁"）
    let gender = idx.gender >= 0 ? toText(row[idx.gender]) : '';
    let age = idx.age >= 0 ? toText(row[idx.age]) : '';
    if (gender.includes('/')) {
      const parts = gender.split('/');
      if (!age) age = toText(parts.slice(1).join('/'));
      gender = toText(parts[0]);
    }

    all.push({
      rowIndex,
      name,
      gender,
      age,
      briefIntro: idx.briefIntro >= 0 ? toText(row[idx.briefIntro]) : '',
      appearance: idx.appearance >= 0 ? toText(row[idx.appearance]) : '',
      outfit: idx.outfit >= 0 ? toText(row[idx.outfit]) : '',
      identity: idx.identity >= 0 ? toText(row[idx.identity]) : '',
      baseAttributes: idx.baseAttributes >= 0 ? toText(row[idx.baseAttributes]) : '',
      specialAttributes: idx.specialAttributes >= 0 ? toText(row[idx.specialAttributes]) : '',
      items: idx.items >= 0 ? toText(row[idx.items]) : '',
      location: idx.location >= 0 ? toText(row[idx.location]) : '',
      presence: idx.presence >= 0 ? toText(row[idx.presence]) : '',
      relation: idx.relation >= 0 ? toText(row[idx.relation]) : '',
      pastExperience: idx.pastExperience >= 0 ? toText(row[idx.pastExperience]) : '',
      actions: idx.actions >= 0 ? splitActions(row[idx.actions]) : [],
    });
  });

  const present = all.filter(
    npc => isPresent(npc.presence, presenceHeader) && locationMatches(npc.location, currentLocation),
  );
  return { all, present };
}

/**
 * 通用读表（按别名列表定位），返回 { name, headers, rows } 或 null
 */
function getSheetByNames(tableData, names) {
  const sheet = resolveSheet(tableData, null, names);
  if (!sheet) return null;
  const { headers, rows } = getHeaderAndRows(sheet);
  return { name: toText(sheet.name), headers, rows };
}

// 主角信息表（单行）
export function getProtagonistSheet(tableData) {
  return getSheetByNames(tableData, SHEET_NAMES.PROTAGONIST);
}

// 主角技能表
export function getSkillsSheet(tableData) {
  return getSheetByNames(tableData, SHEET_NAMES.SKILLS);
}

// 背包物品表
export function getInventorySheet(tableData) {
  return getSheetByNames(tableData, SHEET_NAMES.INVENTORY);
}

// 装备表（SQL_v4.3 等模板才有，可能不存在）
export function getEquipmentSheet(tableData) {
  return getSheetByNames(tableData, SHEET_NAMES.EQUIPMENT);
}

// 任务与事件表
export function getQuestsSheet(tableData) {
  return getSheetByNames(tableData, SHEET_NAMES.QUESTS);
}

/**
 * 解析「名称:数值; 名称:数值」格式的属性串（SQL_v4.3 的基础属性/特有属性列）
 */
export function parseAttributePairs(raw) {
  const text = toText(raw);
  if (!text || /^null$/i.test(text)) return [];
  return text
    .split(/[;；]/g)
    .map(part => {
      const seg = toText(part);
      if (!seg) return null;
      const m = seg.match(/^(.+?)[:：]\s*(.+)$/);
      if (m) return { name: toText(m[1]), value: toText(m[2]) };
      return { name: seg, value: '' };
    })
    .filter(Boolean);
}

/**
 * 背包物品结构化列表（送礼面板用）
 */
export function getInventoryItems(tableData) {
  const sheet = getSheetByNames(tableData, SHEET_NAMES.INVENTORY);
  if (!sheet) return [];
  const idxName = findColIndex(sheet.headers, ['物品名称', '名称', '物品']);
  const idxQty = findColIndex(sheet.headers, ['数量']);
  const idxDesc = findColIndex(sheet.headers, ['描述/效果', '描述', '效果']);
  const idxCat = findColIndex(sheet.headers, ['类别', '分类', '类型']);
  const idxQuality = findColIndex(sheet.headers, ['品质', '稀有度']);
  if (idxName < 0) return [];
  return sheet.rows
    .map(row => ({
      name: toText(row[idxName]),
      quantity: idxQty >= 0 ? toText(row[idxQty]) : '',
      description: idxDesc >= 0 ? toText(row[idxDesc]) : '',
      category: [idxCat >= 0 ? toText(row[idxCat]) : '', idxQuality >= 0 ? toText(row[idxQuality]) : '']
        .filter(Boolean)
        .join(' · '),
    }))
    .filter(item => item.name);
}

/**
 * 主角技能结构化列表（技能面板用）。
 * 没有技能表的模板（如 SQL_v4.3）回退解析「主角信息」的「特有属性」列
 * （格式 "爆裂魔法:85; 时间回溯:70"，数值为成功概率）。
 */
export function getSkillItems(tableData) {
  const sheet = getSheetByNames(tableData, SHEET_NAMES.SKILLS);
  if (sheet) {
    const idxName = findColIndex(sheet.headers, ['技能名称', '名称', '技能']);
    const idxType = findColIndex(sheet.headers, ['技能类型', '类型']);
    const idxLevel = findColIndex(sheet.headers, ['等级/阶段', '等级', '阶段']);
    const idxDesc = findColIndex(sheet.headers, ['效果描述', '描述', '效果']);
    if (idxName >= 0) {
      const items = sheet.rows
        .map(row => ({
          name: toText(row[idxName]),
          type: idxType >= 0 ? toText(row[idxType]) : '',
          level: idxLevel >= 0 ? toText(row[idxLevel]) : '',
          description: idxDesc >= 0 ? toText(row[idxDesc]) : '',
        }))
        .filter(item => item.name);
      if (items.length) return items;
    }
  }
  return getFallbackSkillItems(tableData);
}

// 技能表缺失/为空时：从主角信息表的「特有属性」列解析技能
function getFallbackSkillItems(tableData) {
  const protagonist = getSheetByNames(tableData, SHEET_NAMES.PROTAGONIST);
  if (!protagonist) return [];
  const idxSpecial = findColIndex(protagonist.headers, ['特有属性', '特殊属性', '特殊能力']);
  if (idxSpecial < 0) return [];
  const row = protagonist.rows.find(r => r.some(cell => toText(cell) !== ''));
  if (!row) return [];
  return parseAttributePairs(row[idxSpecial]).map(pair => ({
    name: pair.name,
    type: '特有属性',
    level: pair.value ? `成功率 ${pair.value}` : '',
    description: '',
  }));
}
