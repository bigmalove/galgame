// ============================================
// 地图自动生成（由填表 AI 完成）
//
// 生成方：数据库插件的填表 AI —— 「地图生成表」（工作台）参与每轮填表，
//   其 note 内含布局生成规范；填表 AI 发现"当前详细地点"没有地图时，
//   在填表的同一次输出里顺便 INSERT 一行布局 JSON（零额外 LLM 调用）。
// 本模块职责（收割器）：
//   1. 确保「地图数据表」「地图生成表」注册进当前聊天的指导表（每个聊天独立，切聊天后补注册）
//   2. 填表完成回调（registerTableUpdateCallback）→ 收割工作台布局 → 存入「地图数据表」+ 本地缓存
// 兜底：填表 AI 未生成时，打开地图仍会即时生成（map-modal 现有逻辑）。
// ============================================
import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow } from '../core/env.js';
import { getMapSettings } from '../core/settings.js';
import { showToast } from '../ui/toast.js';
import { ensureSheetsRegistered, harvestWorkbenchLayouts } from './layout-store.js';

// 防重复绑定（跨脚本重载）
const PREGEN_BOUND_FLAG = '__galgame_map_pregen_bound__';
// 表格更新回调的防抖窗口（填表结束后插件会连续多次 notify）
const HARVEST_DEBOUNCE_MS = 3000;
// 绑定重试（数据库插件可能比本脚本晚初始化）
const BIND_RETRY_INTERVAL_MS = 5000;
const BIND_MAX_RETRIES = 12;

let harvestTimer = null;
let isHarvesting = false;

function isMapEnabled() {
  try {
    return !!getMapSettings().mapSystemEnabled;
  } catch {
    return true;
  }
}

async function harvestOnce() {
  if (isHarvesting || !isMapEnabled()) return;
  isHarvesting = true;
  try {
    const harvested = await harvestWorkbenchLayouts();
    if (harvested.length) {
      showToast(`已为「${harvested.join('」「')}」绘制地图`);
    }
  } catch (e) {
    console.error(`[${SCRIPT_NAME}] 地图工作台收割失败:`, e);
  } finally {
    isHarvesting = false;
  }
}

function onTableUpdate() {
  if (harvestTimer) topWindow.clearTimeout(harvestTimer);
  harvestTimer = topWindow.setTimeout(() => {
    harvestTimer = null;
    harvestOnce();
  }, HARVEST_DEBOUNCE_MS);
}

function tryBind() {
  const api = topWindow?.AutoCardUpdaterAPI;
  if (!api || typeof api.registerTableUpdateCallback !== 'function') return false;
  api.registerTableUpdateCallback(onTableUpdate);
  console.log(`[${SCRIPT_NAME}] 地图收割器已挂接数据库表格更新回调`);
  // 绑定成功后立即为当前聊天注册双表（让填表 AI 从下一轮起就能生成地图）
  if (isMapEnabled()) {
    ensureSheetsRegistered().catch(e => {
      console.warn(`[${SCRIPT_NAME}] 地图双表注册失败（将在填表回调时重试）:`, e);
    });
  }
  return true;
}

/**
 * 挂接「填表完成 → 收割工作台布局」，并注册地图双表。
 * 数据库插件可能晚于本脚本加载，带重试。
 */
export function setupMapAutoPregen() {
  if (topWindow[PREGEN_BOUND_FLAG]) {
    console.log(`[${SCRIPT_NAME}] 地图收割器已存在，跳过重复注册`);
    return;
  }
  topWindow[PREGEN_BOUND_FLAG] = true;

  if (tryBind()) return;

  let retries = 0;
  const timer = topWindow.setInterval(() => {
    retries++;
    if (tryBind()) {
      topWindow.clearInterval(timer);
      return;
    }
    if (retries >= BIND_MAX_RETRIES) {
      topWindow.clearInterval(timer);
      topWindow[PREGEN_BOUND_FLAG] = false; // 允许下次 init 重试
      console.warn(`[${SCRIPT_NAME}] 数据库插件回调接口未就绪，填表生成地图未启用（打开地图仍会即时生成）`);
    }
  }, BIND_RETRY_INTERVAL_MS);
}
