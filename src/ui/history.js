import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow, $ } from '../core/env.js';
import { getModalMountRoot } from './fullscreen.js';

// ============================================
// 历史记录功能
// ============================================

export function getHistoryFromDatabase() {
  try {
    const api = topWindow.AutoCardUpdaterAPI;
    if (!api || typeof api.exportTableAsJson !== 'function') {
      console.log(`[${SCRIPT_NAME}] AutoCardUpdaterAPI 不可用`);
      return [];
    }
    const tableData = api.exportTableAsJson();
    if (!tableData) return [];

    let summarySheet = null;
    for (const sheetKey of Object.keys(tableData)) {
      if (!sheetKey.startsWith('sheet_')) continue;
      const sheet = tableData[sheetKey];
      if (sheet.name === '总结表') {
        summarySheet = sheet;
        break;
      }
    }
    if (!summarySheet || !summarySheet.content || summarySheet.content.length < 2) {
      console.log(`[${SCRIPT_NAME}] 未找到总结表或表为空`);
      return [];
    }

    const headers = summarySheet.content[0];
    const content = summarySheet.content;

    let indexCol = -1;
    let timeCol = -1;
    let contentCol = -1;

    const indexKeywords = ['索引', '编码', 'index', 'id', '序号', '编号'];
    const timeKeywords = ['时间', '跨度', '日期', 'time', 'date', 'duration'];
    const contentKeywords = ['纪要', '总结', '内容', '文本', 'summary', 'content', 'text', '剧情', '故事'];

    headers.forEach((header, idx) => {
      if (!header) return;
      const h = String(header).toLowerCase().trim();
      if (indexCol === -1 && indexKeywords.some(k => h === k || h.includes(k))) indexCol = idx;
      if (timeCol === -1 && timeKeywords.some(k => h === k || h.includes(k))) timeCol = idx;
      if (contentCol === -1 && contentKeywords.some(k => h === k || h.includes(k))) contentCol = idx;
    });

    // 智能推断内容列
    if (contentCol === -1) {
      console.log(`[${SCRIPT_NAME}] 未能通过表头识别内容列，尝试分析数据内容...`);
      let maxAvgLength = 0;
      let bestCol = -1;
      for (let colIdx = 0; colIdx < headers.length; colIdx++) {
        if (colIdx === indexCol) continue;
        let totalLen = 0;
        let count = 0;
        for (let rowIdx = 1; rowIdx < Math.min(content.length, 6); rowIdx++) {
          const cell = content[rowIdx][colIdx];
          if (cell && typeof cell === 'string') {
            totalLen += cell.length;
            count++;
          }
        }
        const avgLen = count > 0 ? totalLen / count : 0;
        if (avgLen > maxAvgLength) {
          maxAvgLength = avgLen;
          bestCol = colIdx;
        }
      }
      if (bestCol !== -1) {
        contentCol = bestCol;
        console.log(`[${SCRIPT_NAME}] 自动推断内容列为索引: ${contentCol} (平均长度: ${maxAvgLength})`);
      }
    }

    if (contentCol === -1) {
      if (headers.length >= 2) {
        contentCol = 1;
        if (indexCol === 1) contentCol = 0;
      } else {
        contentCol = 0;
      }
    }

    if (indexCol === -1 && contentCol !== 0) indexCol = 0;

    if (timeCol === -1 && headers.length >= 3 && contentCol >= 1 && contentCol !== indexCol) {
      timeCol = contentCol - 1;
      if (timeCol === indexCol) timeCol = -1;
    }

    const history = [];
    for (let i = 1; i < content.length; i++) {
      const row = content[i];
      if (!row) continue;
      const text = row[contentCol];
      const idx = indexCol !== -1 ? row[indexCol] : '';
      const time = timeCol !== -1 ? row[timeCol] : '';
      if (text) {
        history.push({ index: idx, time: time, content: text });
      }
    }
    return history;
  } catch (e) {
    console.error(`[${SCRIPT_NAME}] 获取历史记录失败:`, e);
    return [];
  }
}

export function showHistoryModal(historyData) {
  $('#gal-history-modal').remove();
  const $modal = $(`<div id="gal-history-modal" class="gal-history-modal"></div>`);

  let listHtml = '';
  if (!historyData || historyData.length === 0) {
    listHtml = '<div class="gal-history-empty">暂无历史记录</div>';
  } else {
    listHtml = '<div class="gal-history-list">';
    historyData.forEach(item => {
      listHtml += `
        <div class="gal-history-item">
          <div class="gal-history-header-row">
            <div class="gal-history-info-group">
              ${item.index ? `<span class="gal-history-index">#${item.index}</span>` : ''}
              ${item.time ? `<span class="gal-history-time"><i class="fa-regular fa-clock"></i> ${item.time}</span>` : ''}
            </div>
          </div>
          <div class="gal-history-content">${item.content}</div>
        </div>
      `;
    });
    listHtml += '</div>';
  }

  const modalHtml = `
    <div class="gal-history-panel">
      <div class="gal-history-header">
        <div class="gal-history-title">
          <i class="fa-solid fa-clock-rotate-left"></i>
          <span>剧情回顾</span>
        </div>
        <button class="gal-history-close">&times;</button>
      </div>
      <div class="gal-history-body">
        ${listHtml}
      </div>
    </div>
  `;

  $modal.html(modalHtml);
  $(getModalMountRoot()).append($modal);

  $modal.find('.gal-history-close').on('click', function () {
    $modal.fadeOut(200, function () { $(this).remove(); });
  });
  $modal.on('click', function (e) {
    if (e.target === this) {
      $modal.fadeOut(200, function () { $(this).remove(); });
    }
  });
  const $body = $modal.find('.gal-history-body');
  $body.scrollTop($body[0].scrollHeight);
}
