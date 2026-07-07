// ============================================
// 场景布局统一存取层：数据库双表 + localStorage 双写兜底
//
// 数据库层（SP·数据库 V / AutoCardUpdaterAPI）双表设计：
//   - 「地图数据表」（存储表）：布局永久存放处，updateFrequency=0 不参与 AI 填表、不进世界书，
//     数据随聊天消息保存/导出/分支，换设备也不丢
//   - 「地图生成表」（工作台）：参与每轮 AI 填表，note 内写布局生成规范——填表 AI 发现新地点时
//     顺便 INSERT 一行布局 JSON；填表完成后脚本把布局「收割」进存储表，工作台行只留
//     「（已存档）」占位，因此填表提示词的开销恒定极小
//   - 两张表都须注册进「聊天指导表」（importTemplateFromData scope:'chat'），否则被插件合并过滤丢弃
// localStorage 层（layout-cache.js）：
//   - 插件版本过旧（无写入 API）或写入失败时的兜底，保证功能始终可用
// ============================================
import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow } from '../core/env.js';
import { clearCachedLayout, getCachedLayout, setCachedLayout } from './layout-cache.js';
import { sanitizeLayout } from './scene-schema.js';

// 地图数据表（存储表）的固定 uid 与表名
const MAP_SHEET_UID = 'sheet_gal_map_layouts';
const MAP_SHEET_NAME = '地图数据表';
const COL_HEADERS = ['row_id', '地点', '布局JSON', '更新时间'];
const COL_LOCATION = 1;
const COL_JSON = 2;
const COL_TIME = 3;

// 地图生成表（填表 AI 工作台）的固定 uid 与表名
const WB_SHEET_UID = 'sheet_gal_map_workbench';
const WB_SHEET_NAME = '地图生成表';
const WB_COL_HEADERS = ['row_id', '地点', '布局JSON'];
const WB_COL_LOCATION = 1;
const WB_COL_JSON = 2;
// 收割后写入工作台的占位文本
const WB_ARCHIVED_MARK = '（已存档）';
const WB_INVALID_MARK = '（无效，已丢弃）';

function getApi() {
  const api = topWindow?.AutoCardUpdaterAPI;
  if (!api || typeof api.exportTableAsJson !== 'function') return null;
  return api;
}

// 数据库写入能力检测（旧版插件没有这些 API 时退回纯 localStorage）
function hasDbWriteSupport(api) {
  return (
    !!api &&
    typeof api.importTableAsJson === 'function' &&
    typeof api.importTemplateFromData === 'function' &&
    typeof api.getTableTemplate === 'function'
  );
}

function findSheetByUidOrName(tableData, uid, name) {
  if (!tableData || typeof tableData !== 'object') return null;
  // uid 优先，名称兜底
  if (tableData[uid]) return tableData[uid];
  return (
    Object.values(tableData).find(
      sheet => sheet && typeof sheet === 'object' && String(sheet.name || '').trim() === name,
    ) || null
  );
}

function findMapSheet(tableData) {
  return findSheetByUidOrName(tableData, MAP_SHEET_UID, MAP_SHEET_NAME);
}

function findWorkbenchSheet(tableData) {
  return findSheetByUidOrName(tableData, WB_SHEET_UID, WB_SHEET_NAME);
}

// 地图数据表骨架（note 里声明禁改，作为手动全量填表时的最后防线）
function buildMapSheetSkeleton() {
  return {
    uid: MAP_SHEET_UID,
    name: MAP_SHEET_NAME,
    sourceData: {
      note: '本表由 galgame 界面插件自动维护，存储各地点的场景地图布局数据。禁止 AI 对本表做任何增删改操作。',
      initNode: '禁止。本表由前端脚本维护。',
      insertNode: '禁止。',
      updateNode: '禁止。',
      deleteNode: '禁止。',
      ddl: 'CREATE TABLE gal_map_layouts ( -- 地图数据表\n  row_id INTEGER PRIMARY KEY, -- 行号\n  location TEXT, -- 地点\n  layout_json TEXT, -- 布局JSON\n  updated_at TEXT -- 更新时间\n);',
    },
    content: [COL_HEADERS.slice()],
    updateConfig: {
      uiSentinel: -1,
      contextDepth: -1,
      // 0 = 不参与 AI 自动填表（不进「当前表格数据」提示词）
      updateFrequency: 0,
      batchSize: -1,
      skipFloors: -1,
    },
    exportConfig: {
      enabled: false, // 不进世界书
      splitByRow: false,
      entryName: MAP_SHEET_NAME,
      entryType: 'constant',
      keywords: '',
      preventRecursion: true,
      injectIntoWorldbook: false,
    },
    orderNo: 99,
  };
}

// 地图生成表（工作台）骨架：note 是填表 AI 的布局生成规范，随每轮填表进入提示词
function buildWorkbenchSkeleton() {
  return {
    uid: WB_SHEET_UID,
    name: WB_SHEET_NAME,
    sourceData: {
      note: `本表是场景地图生成工作台：当主角到达一个从未生成过地图的地点时，为该地点生成俯视平面图布局。

【列定义】
- 列1: 地点 location（详细地点名，必须与全局数据表"当前详细地点"的写法完全一致，不带地区前缀）
- 列2: 布局JSON layout_json（俯视平面图布局数据）

【生成时机（严格判断）】
仅当同时满足以下全部条件时，才向本表插入一行：
1. 本轮更新后，全局数据表的"当前详细地点"在本表中找不到对应的行（无论该行的布局JSON是什么内容）
2. 正文场景确实位于该地点
其余情况严禁对本表做任何操作。布局JSON为"${WB_ARCHIVED_MARK}"的行表示该地点地图已生成完毕，严禁修改或删除任何已存在的行。

【布局JSON格式】
虚拟画布 1000x750（x向右，y向下），全部整数坐标；矩形/椭圆/圆的 x,y 为元素中心点，w,h 为全宽全高；折线/多边形用 points 二维数组。
元素 type 只能取以下值：
- wall 墙体/围栏/建筑外轮廓（shape=polyline）
- building 房屋/亭台等建筑体块（rect 或 polygon）
- door 门/出入口（rect，贴在墙上的小块）
- road 道路/小径/走廊（polyline）
- water 水体（ellipse 或 polygon）
- plant 植被（circle）
- area 功能分区（rect 或 polygon）
- furniture 家具/陈设（rect）
- landmark 特殊地标（circle）

【布局要求】
1. 6~12 个元素；重要元素填 name（不超过8个字），次要装饰 name 留空字符串。
2. 室内场景先用 wall 画房间外轮廓（出入口留缺口）再放 furniture；室外合理使用 area/road/plant/water。
3. 必须至少有 1 个 door 或 road 作为出入口；building 之间不重叠，分布疏密有致。
4. anchors 输出 4~6 个人物站位点，必须落在空地上（不与 building/water/wall 重叠）。
5. JSON 必须压缩为单行（无换行无多余空格）；所有字符串值内严禁出现单引号。`,
      initNode: '故事初始化时，为开局地点插入一行布局。',
      insertNode: `仅在"当前详细地点"在本表中没有对应行时插入。\nSQL示例: INSERT INTO gal_map_workbench (row_id, location, layout_json) VALUES ((SELECT COALESCE(MAX(row_id), 0) + 1 FROM gal_map_workbench), '御苑', '{"location":"御苑","style":"outdoor","elements":[{"name":"苑墙","type":"wall","shape":"polyline","points":[[430,690],[70,690],[70,70],[930,70],[930,690],[570,690]]},{"name":"园门","type":"door","shape":"rect","x":500,"y":690,"w":140,"h":26},{"name":"凉亭","type":"building","shape":"rect","x":260,"y":270,"w":180,"h":160},{"name":"锦鲤池","type":"water","shape":"ellipse","x":620,"y":540,"w":300,"h":180},{"name":"樱树林","type":"plant","shape":"circle","x":500,"y":165,"w":120,"h":120},{"name":"","type":"road","shape":"polyline","points":[[500,690],[500,470],[300,360]]}],"anchors":[{"x":500,"y":585,"hint":"石径旁"},{"x":262,"y":300,"hint":"凉亭中"},{"x":760,"y":415,"hint":"池边"}]}');`,
      updateNode: '禁止。已有行（含布局JSON为占位文本的行）一律不得修改。',
      deleteNode: '禁止。',
      ddl: 'CREATE TABLE gal_map_workbench ( -- 地图生成表\n  row_id INTEGER PRIMARY KEY, -- 行号\n  location TEXT, -- 地点\n  layout_json TEXT -- 布局JSON\n);',
    },
    content: [WB_COL_HEADERS.slice()],
    updateConfig: {
      uiSentinel: -1,
      contextDepth: -1,
      // -1 = 沿用全局频率（参与每轮自动填表）
      updateFrequency: -1,
      batchSize: -1,
      skipFloors: -1,
    },
    exportConfig: {
      enabled: false, // 不进世界书
      splitByRow: false,
      entryName: WB_SHEET_NAME,
      entryType: 'constant',
      keywords: '',
      preventRecursion: true,
      injectIntoWorldbook: false,
    },
    orderNo: 98,
  };
}

function toText(value) {
  return String(value ?? '').trim();
}

// 校验从单元格读出的布局是否可渲染
function isRenderableLayout(layout) {
  return !!layout && typeof layout === 'object' && Array.isArray(layout.elements) && layout.elements.length > 0;
}

/**
 * 从数据库「地图数据表」读取某地点的布局（同步）；未命中/解析失败返回 null
 */
function readLayoutFromDb(locationName) {
  try {
    const api = getApi();
    if (!api) return null;
    const sheet = findMapSheet(api.exportTableAsJson());
    if (!sheet || !Array.isArray(sheet.content)) return null;

    const target = toText(locationName);
    if (!target) return null;
    for (let i = 1; i < sheet.content.length; i++) {
      const row = sheet.content[i];
      if (!Array.isArray(row)) continue;
      if (toText(row[COL_LOCATION]) !== target) continue;
      const layout = JSON.parse(String(row[COL_JSON] || ''));
      return isRenderableLayout(layout) ? layout : null;
    }
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 从地图数据表读取布局失败:`, e);
  }
  return null;
}

// 确保「地图数据表」与「地图生成表」都已注册进聊天指导表
// （不在指导表里的表会被插件的合并逻辑丢弃；每个聊天的指导表独立，需按聊天补注册）
export async function ensureSheetsRegistered() {
  const api = getApi();
  if (!hasDbWriteSupport(api)) return false;

  const current = api.exportTableAsJson();
  const hasMap = !!findMapSheet(current);
  const hasWorkbench = !!findWorkbenchSheet(current);
  if (hasMap && hasWorkbench) return true;

  // 模板基底必须包含当前全部生效表，漏表等于从指导表里删表！
  // 依次取：聊天指导表 → 全局模板 → 从当前内存表构造骨架
  let template = null;
  try {
    template = api.getTableTemplate({ scope: 'chat' });
  } catch { /* 忽略 */ }
  if (!template || !Object.keys(template).some(k => k.startsWith('sheet_'))) {
    try {
      template = api.getTableTemplate();
    } catch { /* 忽略 */ }
  }
  if (!template || !Object.keys(template).some(k => k.startsWith('sheet_'))) {
    // 兜底：用当前内存表构造模板骨架（content 只保留表头行）
    template = { mate: { type: 'chatSheets', version: 1 } };
    Object.entries(current || {}).forEach(([key, sheet]) => {
      if (!key.startsWith('sheet_') || !sheet || typeof sheet !== 'object') return;
      const clone = JSON.parse(JSON.stringify(sheet));
      clone.content = Array.isArray(clone.content) && clone.content.length ? [clone.content[0]] : [[]];
      template[key] = clone;
    });
  }

  if (!template.mate || typeof template.mate !== 'object') {
    template.mate = { type: 'chatSheets', version: 1 };
  }
  let changed = false;
  if (!findMapSheet(template)) {
    template[MAP_SHEET_UID] = buildMapSheetSkeleton();
    changed = true;
  }
  if (!findWorkbenchSheet(template)) {
    template[WB_SHEET_UID] = buildWorkbenchSkeleton();
    changed = true;
  }
  if (!changed) return true; // 指导表里已注册，只是数据尚未落盘

  await api.importTemplateFromData(template, { scope: 'chat' });
  console.log(`[${SCRIPT_NAME}] 地图数据表/地图生成表已注册进聊天指导表`);
  return true;
}

// 在表 content 中更新/追加某地点的行（原地修改）
function upsertLayoutRow(sheet, locationName, layoutJson) {
  if (!Array.isArray(sheet.content) || !sheet.content.length) {
    sheet.content = [COL_HEADERS.slice()];
  }
  const target = toText(locationName);
  const timeText = new Date().toLocaleString('zh-CN');
  for (let i = 1; i < sheet.content.length; i++) {
    const row = sheet.content[i];
    if (Array.isArray(row) && toText(row[COL_LOCATION]) === target) {
      row[COL_JSON] = layoutJson;
      row[COL_TIME] = timeText;
      return;
    }
  }
  let maxRowId = 0;
  for (let i = 1; i < sheet.content.length; i++) {
    const id = Number(sheet.content[i]?.[0]);
    if (Number.isFinite(id) && id > maxRowId) maxRowId = id;
  }
  sheet.content.push([String(maxRowId + 1), target, layoutJson, timeText]);
}

// 在工作台表中登记「已存档」占位行——即时生成入库的地点也要让填表 AI 知道已有图，防止重复生成
function upsertWorkbenchMark(data, locationName) {
  let workbench = findWorkbenchSheet(data);
  if (!workbench) {
    data[WB_SHEET_UID] = buildWorkbenchSkeleton();
    workbench = data[WB_SHEET_UID];
  }
  if (!Array.isArray(workbench.content) || !workbench.content.length) {
    workbench.content = [WB_COL_HEADERS.slice()];
  }
  const target = toText(locationName);
  for (let i = 1; i < workbench.content.length; i++) {
    const row = workbench.content[i];
    if (Array.isArray(row) && toText(row[WB_COL_LOCATION]) === target) {
      row[WB_COL_JSON] = WB_ARCHIVED_MARK;
      return;
    }
  }
  let maxRowId = 0;
  for (let i = 1; i < workbench.content.length; i++) {
    const id = Number(workbench.content[i]?.[0]);
    if (Number.isFinite(id) && id > maxRowId) maxRowId = id;
  }
  workbench.content.push([String(maxRowId + 1), target, WB_ARCHIVED_MARK]);
}

/**
 * 把布局写入数据库「地图数据表」（读-改-写全量导入；插件内部有事务锁与版本校验）
 */
async function writeLayoutToDb(locationName, layout) {
  const api = getApi();
  if (!hasDbWriteSupport(api)) return false;

  await ensureSheetsRegistered();

  const current = api.exportTableAsJson() || {};
  const data = JSON.parse(JSON.stringify(current));
  if (!data.mate || typeof data.mate !== 'object') {
    data.mate = { type: 'chatSheets', version: 1 };
  }
  if (!data[MAP_SHEET_UID]) {
    // 已注册但数据尚未落盘：把骨架带上，随本次全量导入建立首个数据楼层
    const existingByName = findMapSheet(data);
    if (!existingByName) data[MAP_SHEET_UID] = buildMapSheetSkeleton();
  }
  const sheet = findMapSheet(data);
  if (!sheet) return false;

  upsertLayoutRow(sheet, locationName, JSON.stringify(layout));
  // 同步在工作台登记占位，防止填表 AI 下轮重复生成该地点
  upsertWorkbenchMark(data, locationName);

  const ok = await api.importTableAsJson(JSON.stringify(data));
  if (ok === false) {
    // 与填表并发时版本校验会拒绝写入；localStorage 已双写，不影响使用
    console.warn(`[${SCRIPT_NAME}] 地图布局写入数据库被拒绝（可能正在填表），已保留本地缓存`);
    return false;
  }
  console.log(`[${SCRIPT_NAME}] 地图布局已写入数据库「${MAP_SHEET_NAME}」: ${toText(locationName)}`);
  return true;
}

/**
 * 从数据库「地图数据表」删除某地点的行
 */
async function removeLayoutFromDb(locationName) {
  const api = getApi();
  if (!hasDbWriteSupport(api)) return false;

  const current = api.exportTableAsJson() || {};
  const sheet = findMapSheet(current);
  if (!sheet || !Array.isArray(sheet.content)) return false;

  const target = toText(locationName);
  const filtered = sheet.content.filter((row, i) => i === 0 || !Array.isArray(row) || toText(row[COL_LOCATION]) !== target);
  if (filtered.length === sheet.content.length) return false; // 无该行

  const data = JSON.parse(JSON.stringify(current));
  findMapSheet(data).content = JSON.parse(JSON.stringify(filtered));
  if (!data.mate || typeof data.mate !== 'object') {
    data.mate = { type: 'chatSheets', version: 1 };
  }
  return (await api.importTableAsJson(JSON.stringify(data))) !== false;
}

// ============================================
// 统一入口（map-modal 使用）
// ============================================

/**
 * 读取某地点的布局：数据库表优先（跟随聊天），localStorage 兜底
 */
export function loadLayout(locationName) {
  const fromDb = readLayoutFromDb(locationName);
  if (fromDb) {
    console.log(`[${SCRIPT_NAME}] 场景布局命中数据库「${MAP_SHEET_NAME}」: ${toText(locationName)}`);
    return fromDb;
  }
  return getCachedLayout(locationName);
}

/**
 * 保存布局：localStorage 同步双写，数据库异步写入（失败不影响使用）
 */
export function saveLayout(locationName, layout) {
  setCachedLayout(locationName, layout);
  writeLayoutToDb(locationName, layout).catch(e => {
    console.warn(`[${SCRIPT_NAME}] 地图布局写入数据库失败（已保留本地缓存）:`, e);
  });
}

/**
 * 收割工作台：把填表 AI 写入「地图生成表」的布局搬进「地图数据表」永久保存，
 * 工作台行改为占位标记（防 AI 重复生成，同时把布局挪出填表提示词）。
 * @returns {Promise<string[]>} 本次成功收割的地点列表
 */
export async function harvestWorkbenchLayouts() {
  const api = getApi();
  if (!hasDbWriteSupport(api)) return [];

  await ensureSheetsRegistered();

  const current = api.exportTableAsJson() || {};
  const workbenchNow = findWorkbenchSheet(current);
  if (!workbenchNow || !Array.isArray(workbenchNow.content) || workbenchNow.content.length < 2) return [];

  // 找出待收割行（布局列是 JSON 而非占位标记）
  const pendingIndexes = [];
  for (let i = 1; i < workbenchNow.content.length; i++) {
    const row = workbenchNow.content[i];
    if (!Array.isArray(row)) continue;
    const raw = toText(row[WB_COL_JSON]);
    if (raw.startsWith('{') && raw.length > 40) pendingIndexes.push(i);
  }
  if (!pendingIndexes.length) return [];

  const data = JSON.parse(JSON.stringify(current));
  if (!data.mate || typeof data.mate !== 'object') {
    data.mate = { type: 'chatSheets', version: 1 };
  }
  const workbench = findWorkbenchSheet(data);
  let mapSheet = findMapSheet(data);
  if (!mapSheet) {
    data[MAP_SHEET_UID] = buildMapSheetSkeleton();
    mapSheet = data[MAP_SHEET_UID];
  }

  const harvested = [];
  for (const i of pendingIndexes) {
    const row = workbench.content[i];
    const location = toText(row[WB_COL_LOCATION]);
    let ok = false;
    try {
      const parsed = JSON.parse(String(row[WB_COL_JSON]));
      const { layout } = sanitizeLayout(parsed, location);
      if (layout && location) {
        layout.location = location; // 以工作台行的地点名为准（与全局数据表一致）
        upsertLayoutRow(mapSheet, location, JSON.stringify(layout));
        setCachedLayout(location, layout); // localStorage 双写
        harvested.push(location);
        ok = true;
      }
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 工作台布局解析失败（地点: ${location}）:`, e);
    }
    // 占位标记：已存档防 AI 重复生成；无效行也保留占位，打开地图时会走即时生成兜底
    row[WB_COL_JSON] = ok ? WB_ARCHIVED_MARK : WB_INVALID_MARK;
  }

  const okImport = await api.importTableAsJson(JSON.stringify(data));
  if (okImport === false) {
    // 与下一轮填表撞车被拒：工作台行未被标记，下次表格更新回调会重新收割（幂等）
    console.warn(`[${SCRIPT_NAME}] 工作台收割写回被拒绝，等待下次回调重试（本地缓存已生效）`);
    return harvested;
  }
  if (harvested.length) {
    console.log(`[${SCRIPT_NAME}] 已从地图生成表收割 ${harvested.length} 个地点的布局: ${harvested.join('、')}`);
  }
  return harvested;
}

/**
 * 删除布局（「重新生成」用）：两层同时删
 */
export function removeLayout(locationName) {
  clearCachedLayout(locationName);
  removeLayoutFromDb(locationName).catch(e => {
    console.warn(`[${SCRIPT_NAME}] 地图布局从数据库删除失败:`, e);
  });
}
