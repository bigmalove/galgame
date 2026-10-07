import { ANCIENT_FAMILY_SKIN_IDS, DEFAULT_DARK_SKIN_ID, JRPG_FAMILY_SKIN_IDS, PERSONA_FAMILY_SKIN_IDS, SCRIPT_NAME, SHUJIAN_FAMILY_SKIN_IDS, YANYUN_FAMILY_SKIN_IDS } from '../core/constants.js';
import { topWindow, $ } from '../core/env.js';
import { getSettings } from '../core/settings.js';
import { TTSManager } from '../audio/tts-manager.js';
import { getTTSEnabled } from '../audio/tts-config.js';
import { collectBacklogGroups } from './backlog.js';
import { MOTION_CLASS } from './control-motion.js';
import { DEFAULT_THEME_CLASSES } from './default-theme.js';
import { getModalMountRoot } from './fullscreen.js';

function syncHistoryModalSkinClass($modal) {
  if (!$modal?.length) return;
  const $overlay = $('#gal-global-overlay');
  [...SHUJIAN_FAMILY_SKIN_IDS, ...PERSONA_FAMILY_SKIN_IDS, ...ANCIENT_FAMILY_SKIN_IDS, ...JRPG_FAMILY_SKIN_IDS, ...YANYUN_FAMILY_SKIN_IDS, DEFAULT_DARK_SKIN_ID, ...DEFAULT_THEME_CLASSES, MOTION_CLASS].forEach(skinClass => {
    $modal.toggleClass(skinClass, $overlay.hasClass(skinClass));
  });
}

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

let lastHistoryTab = 'backlog';
let voiceStateTimer = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildSummaryHtml(historyData) {
  if (!historyData || historyData.length === 0) {
    return '<div class="gal-history-empty">暂无剧情纪要</div>';
  }
  let listHtml = '<div class="gal-history-list">';
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
  return listHtml;
}

// 对话记录：每个楼层一张卡片（沿用 .gal-history-item / .gal-history-content，皮肤配色自动生效）
// 注意 .gal-history-content 是 pre-wrap，卡片内部的 HTML 拼接不留空白
function buildBacklogHtml(groups, showVoice) {
  if (!groups.length) {
    return '<div class="gal-history-empty">暂无对话记录</div>';
  }
  const cards = groups.map((group, groupIndex) => {
    if (group.kind === 'user') {
      return `<div class="gal-history-item gal-backlog-floor is-user"><div class="gal-history-content gal-backlog-lines">`
        + `<div class="gal-backlog-line is-user"><span class="gal-backlog-voice-slot"><i class="fa-solid fa-reply gal-backlog-user-icon"></i></span>`
        + `<div class="gal-backlog-body"><div class="gal-backlog-speaker">${escapeHtml(group.speaker)}</div><div class="gal-backlog-text">${escapeHtml(group.text)}</div></div></div>`
        + `</div></div>`;
    }
    const lines = group.entries.map((entry, entryIndex) => {
      const isDialogue = entry.segment.type === 'dialogue';
      const voiceBtn = showVoice && isDialogue
        ? `<button type="button" class="gal-backlog-voice" data-state="unknown" data-group="${groupIndex}" data-entry="${entryIndex}" data-seg-id="${escapeHtml(entry.segmentId)}" title="播放语音"><i class="fa-solid fa-volume-low"></i></button>`
        : '';
      const speakerHtml = entry.speaker ? `<div class="gal-backlog-speaker">${escapeHtml(entry.speaker)}</div>` : '';
      return `<div class="gal-backlog-line is-${entry.segment.type}"><span class="gal-backlog-voice-slot">${voiceBtn}</span>`
        + `<div class="gal-backlog-body">${speakerHtml}<div class="gal-backlog-text">${escapeHtml(entry.text)}</div></div></div>`;
    }).join('');
    return `<div class="gal-history-item gal-backlog-floor" data-mes-id="${escapeHtml(group.mesId)}"><div class="gal-history-content gal-backlog-lines">${lines}</div></div>`;
  });
  return `<div class="gal-history-list gal-backlog-list">${cards.join('')}</div>`;
}

function setVoiceButtonState($btn, state) {
  $btn.attr('data-state', state);
  $btn.attr('title', state === 'cached' ? '播放语音（已缓存）' : '合成并播放语音');
  $btn.find('i').attr('class', state === 'cached' ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-low');
}

async function refreshVoiceButtons($buttons, groups) {
  if (!$buttons.length) return;
  const segments = $buttons.toArray().map(btn => groups[btn.dataset.group]?.entries?.[btn.dataset.entry]?.segment);
  let states = [];
  try {
    states = await TTSManager.getSegmentsCacheState(segments);
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 对话记录：查询语音缓存失败`, e);
  }
  $buttons.each(function (i) {
    const state = states[i];
    if (state === null) {
      $(this).remove();
      return;
    }
    setVoiceButtonState($(this), state ? 'cached' : 'uncached');
  });
}

function stopVoiceStateTimer() {
  if (voiceStateTimer) {
    clearInterval(voiceStateTimer);
    voiceStateTimer = null;
  }
}

// 播放 / 合成状态没有事件可订阅，弹窗打开期间轮询 TTSManager；一段播完后重查缓存，刚合成的会变为「已缓存」
function startVoiceStateTimer($modal, groups) {
  stopVoiceStateTimer();
  voiceStateTimer = setInterval(() => {
    if (!$modal[0]?.isConnected) {
      stopVoiceStateTimer();
      return;
    }
    $modal.find('.gal-backlog-voice').each(function () {
      const $btn = $(this);
      const isCurrent = TTSManager.currentSegmentId === this.dataset.segId;
      const playing = isCurrent && TTSManager.isPlaying;
      const loading = isCurrent && TTSManager.isLoading && !playing;
      const wasActive = $btn.hasClass('is-playing') || $btn.hasClass('is-loading');
      $btn.toggleClass('is-playing', playing).toggleClass('is-loading', loading);
      if (wasActive && !playing && !loading && $btn.attr('data-state') !== 'cached') {
        void refreshVoiceButtons($btn, groups);
      }
    });
  }, 250);
}

function switchHistoryTab($modal, tab) {
  lastHistoryTab = tab;
  $modal.find('.gal-history-tab').each(function () {
    const active = this.dataset.tab === tab;
    $(this).toggleClass('active', active).attr('aria-selected', active ? 'true' : 'false');
  });
  $modal.find('.gal-history-body').each(function () {
    $(this).toggle(this.dataset.pane === tab);
  });
  const $body = $modal.find(`.gal-history-body[data-pane="${tab}"]`);
  if ($body.length) $body.scrollTop($body[0].scrollHeight);
}

export function showHistoryModal(historyData) {
  stopVoiceStateTimer();
  $('#gal-history-modal').remove();
  const $modal = $(`<div id="gal-history-modal" class="gal-history-modal"></div>`);

  let backlogGroups = [];
  try {
    backlogGroups = collectBacklogGroups();
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 收集对话记录失败:`, e);
  }
  const showVoice = getTTSEnabled() && getSettings().ttsEnabled !== false;
  const hasSummary = Array.isArray(historyData) && historyData.length > 0;
  const initialTab = backlogGroups.length === 0 && hasSummary ? 'summary' : lastHistoryTab;

  const modalHtml = `
    <div class="gal-history-panel">
      <div class="gal-history-header">
        <div class="gal-history-title">
          <i class="fa-solid fa-clock-rotate-left"></i>
          <span>剧情回顾</span>
        </div>
        <div class="gal-history-tabs" role="tablist">
          <button type="button" class="gal-history-tab" role="tab" data-tab="backlog">对话记录</button>
          <button type="button" class="gal-history-tab" role="tab" data-tab="summary">剧情纪要</button>
        </div>
        <button class="gal-history-close">&times;</button>
      </div>
      <div class="gal-history-body" data-pane="backlog">
        ${buildBacklogHtml(backlogGroups, showVoice)}
      </div>
      <div class="gal-history-body" data-pane="summary">
        ${buildSummaryHtml(historyData)}
      </div>
    </div>
  `;

  $modal.html(modalHtml);
  syncHistoryModalSkinClass($modal);
  $(getModalMountRoot()).append($modal);

  const closeModal = () => {
    stopVoiceStateTimer();
    $modal.fadeOut(200, function () { $(this).remove(); });
  };
  $modal.find('.gal-history-close').on('click', closeModal);
  $modal.on('click', function (e) {
    if (e.target === this) closeModal();
  });
  $modal.find('.gal-history-tab').on('click', function () {
    switchHistoryTab($modal, this.dataset.tab);
  });
  $modal.on('click', '.gal-backlog-voice', function (e) {
    e.stopPropagation();
    const entry = backlogGroups[this.dataset.group]?.entries?.[this.dataset.entry];
    if (!entry) return;
    void TTSManager.replaySegment(entry.segment, entry.segmentId);
  });

  switchHistoryTab($modal, initialTab);

  if (showVoice) {
    void refreshVoiceButtons($modal.find('.gal-backlog-voice'), backlogGroups);
    startVoiceStateTimer($modal, backlogGroups);
  }
}
