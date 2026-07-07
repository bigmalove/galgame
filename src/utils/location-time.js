import { SCRIPT_NAME } from '../core/constants.js';
import { $, topWindow } from '../core/env.js';
import { getLatestGeneratedLocation } from '../map/scene-data.js';

// ============================================
// 从全局数据表获取地点和时间信息
// ============================================
export function getGlobalLocationAndTime() {
  const result = {
    primaryRegion: '',
    secondaryRegion: '',
    detailedLocation: '',
    currentTime: '',
  };

  try {
    const api = topWindow.AutoCardUpdaterAPI;
    if (!api || typeof api.exportTableAsJson !== 'function') {
      console.log(`[${SCRIPT_NAME}] AutoCardUpdaterAPI 未找到或未初始化`);
      return result;
    }

    const tableData = api.exportTableAsJson();
    if (!tableData || typeof tableData !== 'object') {
      console.log(`[${SCRIPT_NAME}] 表格数据为空`);
      return result;
    }

    // 全局数据表名变体
    const globalSheets = ['全局数据表', '全局数据', '全局变量', 'Global', 'global'];

    // 列名映射
    const columnMappings = {
      primaryRegion: ['当前主要地区', '主要地区', '主地区'],
      secondaryRegion: ['当前次要地区', '次要地区', '副地区'],
      detailedLocation: ['当前详细地点', '详细地点', '具体地点', '地点', '主角当前所在地点', '当前所在地点', '所在地点', '当前位置', '当前地点'],
      currentTime: ['当前时间', '时间', '游戏时间'],
    };

    let targetSheet = null;

    // 策略1: 优先通过 UID 查找
    for (const key of Object.keys(tableData)) {
      if (tableData[key]?.uid === 'sheet_global_data') {
        targetSheet = tableData[key];
        break;
      }
    }

    // 策略2: 如果UID未找到，通过名称查找
    if (!targetSheet) {
      for (const key of Object.keys(tableData)) {
        const sheet = tableData[key];
        if (sheet && globalSheets.includes(sheet.name)) {
          targetSheet = sheet;
          break;
        }
      }
    }

    if (targetSheet) {
      const content = targetSheet.content || [];
      if (content.length >= 2) {
        const headers = content[0] || [];
        const dataRow = content[1] || [];

        for (const [field, columnNames] of Object.entries(columnMappings)) {
          for (const colName of columnNames) {
            const colIndex = headers.findIndex(h => h && String(h).trim() === colName);
            if (colIndex !== -1 && dataRow[colIndex]) {
              result[field] = String(dataRow[colIndex]).trim();
              break;
            }
          }
        }

        // 地点列模糊兜底：兼容各种模板的列命名（任何包含「地点/位置」的列）
        if (!result.detailedLocation) {
          const fuzzyIdx = headers.findIndex(h => {
            const t = String(h || '').trim();
            return (t.includes('地点') || t.includes('位置')) && !t.includes('时间');
          });
          if (fuzzyIdx !== -1 && dataRow[fuzzyIdx]) {
            result.detailedLocation = String(dataRow[fuzzyIdx]).trim();
          }
        }
      }
    }

    // 全局数据表地点为空/漏填时，回退「地图生成表」最新生成的地点
    if (!result.detailedLocation) {
      const generated = getLatestGeneratedLocation(tableData);
      if (generated) {
        result.detailedLocation = generated;
        console.log(`[${SCRIPT_NAME}] 全局数据表地点为空，已回退地图生成表: ${generated}`);
      }
    }
  } catch (e) {
    console.error(`[${SCRIPT_NAME}] 获取全局地点时间失败:`, e);
  }

  return result;
}

/**
 * 更新地点和弹窗二显示
 * @param {number} retryCount - 当前重试次数
 */
export function updateLocationTimeDisplay(retryCount = 0) {
  const data = getGlobalLocationAndTime();
  const $locationText = $('#gal-location-text');
  const $timeText = $('#gal-time-text');
  const $locationBar = $('#gal-location-bar');
  const $timeBar = $('#gal-time-bar');

  const isEmpty = !data.primaryRegion && !data.secondaryRegion && !data.detailedLocation && !data.currentTime;

  if (isEmpty && retryCount < 10) {
    setTimeout(() => updateLocationTimeDisplay(retryCount + 1), 1000);
    return;
  }

  // 构建地点显示文本
  const locationParts = [];
  if (data.primaryRegion) locationParts.push(data.primaryRegion);
  if (data.secondaryRegion) locationParts.push(data.secondaryRegion);
  if (data.detailedLocation) locationParts.push(data.detailedLocation);

  const locationText = locationParts.join(' -- ') || '未知地点';
  const timeText = data.currentTime || '--';

  $locationText.text(locationText);
  $timeText.text(timeText);

  $locationBar.attr('title', locationText);
  $timeBar.attr('title', timeText);

  autoShrinkText($locationText, 290);
  autoShrinkText($timeText, 200);
}

/**
 * 自动缩小过长文字
 * @param {jQuery} $element - 文字元素
 * @param {number} maxWidth - 最大宽度
 */
function autoShrinkText($element, maxWidth) {
  if (!$element.length) return;

  $element.removeAttr('style');

  const actualWidth = $element.width();

  if (actualWidth > maxWidth) {
    const scale = maxWidth / actualWidth;
    const finalScale = Math.max(0.5, scale);

    $element.css({
      transform: `scaleX(${finalScale})`,
      'transform-origin': 'left center',
      width: `${actualWidth}px`,
    });
  }
}
