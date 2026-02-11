import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow, $ } from '../core/env.js';
import { GalgameStore } from '../core/store.js';
import { getIsEnabled, getPendingOptions, setPendingOptions, getGalgameChoicesVisible, setGalgameChoicesVisible, getLastGalgameOptionHash, setLastGalgameOptionHash } from '../core/state.js';
import { getModalMountRoot } from './fullscreen.js';
import { ensureGlobalOverlay } from './overlay.js';
import { showToast } from './toast.js';

// ============================================
// 选项面板
// ============================================

const messageSegmentState = GalgameStore.cache.segments;

// 延迟引用
let _isRerollingRef = null;

export function setChoicesRefs({ getIsRerolling }) {
  if (getIsRerolling) _isRerollingRef = getIsRerolling;
}

function ensureChoicesLayer() {
  const mountRoot = getModalMountRoot();
  let $layer = $(mountRoot).find('#gal-layer-choices');
  if (!$layer.length) {
    const layerHtml = `
      <div id="gal-layer-choices">
        <div class="gal-choices-title"><span>请选择行动</span></div>
        <div class="gal-choices-container"></div>
        <div class="gal-choices-hint">点击空白处关闭</div>
      </div>
    `;
    $(mountRoot).append(layerHtml);
    $layer = $(mountRoot).find('#gal-layer-choices');
    $layer.on('click', function (e) {
      if (e.target === this) {
        hideGalgameChoices(true);
      }
    });
  }
  return $layer;
}

export function renderGalgameChoices(options) {
  if (!options || options.length === 0) {
    hideGalgameChoices(false);
    return;
  }

  setPendingOptions(options);
  $('.gal-game-container .gal-pending-choices-btn').addClass('show');

  const $layer = ensureChoicesLayer();
  const $container = $layer.find('.gal-choices-container');
  $container.empty();

  options.forEach((opt, idx) => {
    const $card = $(`
      <div class="gal-choice-card" data-option-index="${idx}" data-option-value="${encodeURIComponent(opt.value)}">
        <span>${opt.text}</span>
      </div>
    `);
    $card.on('click', function (e) {
      e.stopPropagation();
      const value = decodeURIComponent($(this).data('option-value'));
      handleChoiceSelection(value);
    });
    $container.append($card);
  });

  $layer.addClass('active');
  setGalgameChoicesVisible(true);
}

export function showPendingChoicesButton() {
  const pendingOptions = getPendingOptions();
  if (!pendingOptions || pendingOptions.length === 0) return;
  $('#gal-global-overlay .gal-pending-choices-btn').addClass('show');
  console.log(`[${SCRIPT_NAME}] 显示待选择提示按钮`);
}

export function hidePendingChoicesButton() {
  $('#gal-global-overlay .gal-pending-choices-btn').removeClass('show');
  setPendingOptions(null);
  console.log(`[${SCRIPT_NAME}] 隐藏待选择提示按钮`);
}

export function hideGalgameChoices(userDismissed = false) {
  const mountRoot = getModalMountRoot();
  $(mountRoot).find('#gal-layer-choices').removeClass('active');
  setGalgameChoicesVisible(false);

  const pendingOptions = getPendingOptions();
  if (pendingOptions && pendingOptions.length > 0) {
    showPendingChoicesButton();
  }
}

function handleChoiceSelection(optionValue) {
  console.log(`[${SCRIPT_NAME}] 用户选择了选项: ${optionValue}`);

  const mountRoot = getModalMountRoot();
  $(mountRoot).find('#gal-layer-choices').removeClass('active');
  setGalgameChoicesVisible(false);

  const $textarea = $(topWindow.document).find('#send_textarea');
  const $sendButton = $(topWindow.document).find('#send_but');
  if ($textarea.length) {
    const playerChoice = `<user>${optionValue}。`;
    const currentVal = ($textarea.val() || '').trim();
    if (!currentVal) {
      $textarea.val(playerChoice).trigger('input').trigger('change');
    } else {
      $textarea.val(currentVal + ' ' + playerChoice).trigger('input').trigger('change');
    }
    showToast(`已选择: ${optionValue.substring(0, 20)}${optionValue.length > 20 ? '...' : ''}`);
    if ($sendButton.length) {
      setTimeout(() => {
        $sendButton.click();
        console.log(`[${SCRIPT_NAME}] 已自动触发发送`);
      }, 100);
    }
  }
}

export function setupOptionsPanelObserver() {
  setInterval(() => {
    if (!getIsEnabled()) return;
    checkAndRenderOptions();
  }, 1000);
  setTimeout(checkAndRenderOptions, 500);
  console.log(`[${SCRIPT_NAME}] 选项表监控已启动 (轮询模式)`);
}

function checkAndRenderOptions() {
  if (!getIsEnabled()) return;
  if (_isRerollingRef && _isRerollingRef()) {
    console.log(`[${SCRIPT_NAME}] 正在重绘中，跳过选项检查`);
    return;
  }

  const options = getOptionsFromDatabase();

  if (options.length === 0) {
    if (getGalgameChoicesVisible()) {
      hideGalgameChoices(false);
    }
    if (getPendingOptions()) {
      hidePendingChoicesButton();
    }
    setLastGalgameOptionHash(null);
    return;
  }

  const currentOptionHash = options.map(o => o.value).join('|||');
  setPendingOptions(options);

  ensureGlobalOverlay();
  const $btn = $('#gal-global-overlay .gal-pending-choices-btn');
  if ($btn.length) {
    $btn.css('display', 'flex');
    $btn.addClass('show');
  }

  const optionChanged = currentOptionHash !== getLastGalgameOptionHash();
  if (optionChanged) {
    console.log(`[${SCRIPT_NAME}] 检测到新选项，更新缓存并显示提示按钮`);

    $('#gal-global-overlay .gal-pending-choices-btn').addClass('gal-new-option-highlight');
    setTimeout(() => {
      $('#gal-global-overlay .gal-pending-choices-btn').removeClass('gal-new-option-highlight');
    }, 3000);

    let shouldPopup = false;
    if (getGalgameChoicesVisible()) {
      shouldPopup = true;
    } else {
      const $overlay = $('#gal-global-overlay');
      if ($overlay.length && $overlay.hasClass('active')) {
        const mesId = $overlay.find('.gal-game-container').attr('data-mes-id');
        if (mesId) {
          const state = messageSegmentState.get(String(mesId));
          if (state && state.currentIndex >= state.segments.length - 1) {
            shouldPopup = true;
          }
        }
      }
    }

    if (shouldPopup) {
      renderGalgameChoices(options);
    }
  } else {
    const pending = getPendingOptions();
    if (pending && pending.length > 0) {
      ensureGlobalOverlay();
      $('.gal-game-container .gal-pending-choices-btn').addClass('show');
    }
  }

  setLastGalgameOptionHash(currentOptionHash);
}

function getOptionsFromDatabase() {
  const options = [];
  try {
    const api = topWindow.AutoCardUpdaterAPI;
    if (!api || typeof api.exportTableAsJson !== 'function') return [];
    const tableData = api.exportTableAsJson();
    if (!tableData) return [];

    const optionSheetNames = ['选项表', '行动选项'];
    let targetSheet = null;
    for (const sheetKey of Object.keys(tableData)) {
      if (!sheetKey.startsWith('sheet_')) continue;
      const sheet = tableData[sheetKey];
      if (optionSheetNames.includes(sheet.name)) {
        targetSheet = sheet;
        break;
      }
    }

    if (!targetSheet) return [];
    if (!targetSheet.content || targetSheet.content.length < 2) return [];

    const headers = targetSheet.content[0] || [];
    const content = targetSheet.content;

    const findCol = names => {
      for (const name of names) {
        const idx = headers.indexOf(name);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const textCols = ['选项内容', '选项文本', '内容', 'Text', 'text', 'Caption', 'caption'];
    const valueCols = ['选项值', '实际值', 'Value', 'value', 'Command', 'command'];
    const textIdx = findCol(textCols);
    const valueIdx = findCol(valueCols);

    let useVertical = false;
    let useHorizontal = false;

    let optionHeaderCount = 0;
    headers.forEach(h => {
      const s = String(h);
      if (s.includes('选项') || s.includes('Option')) optionHeaderCount++;
    });
    if (targetSheet.name === '行动选项' && textIdx === -1 && valueIdx === -1) {
      optionHeaderCount = headers.filter(h => String(h).toLowerCase() !== 'id').length;
    }

    if (textIdx !== -1) {
      useVertical = true;
    } else if (optionHeaderCount > 0) {
      useHorizontal = true;
    } else if (content.length > 2) {
      useVertical = true;
    }

    if (useVertical) {
      const fallbackTextIdx = 0;
      const fallbackValueIdx = 1;
      const effectiveTextIdx = textIdx !== -1 ? textIdx : fallbackTextIdx;
      let effectiveValueIdx = valueIdx;
      if (effectiveValueIdx === -1) {
        effectiveValueIdx = headers.length > 1 && textIdx === -1 ? fallbackValueIdx : effectiveTextIdx;
      }
      for (let i = 1; i < content.length; i++) {
        const row = content[i];
        if (!row) continue;
        const text = row[effectiveTextIdx];
        if (text && typeof text === 'string' && text.trim()) {
          let value = text;
          if (effectiveValueIdx !== -1 && row[effectiveValueIdx]) {
            value = row[effectiveValueIdx];
          }
          options.push({ text: text.trim(), value: value.toString().trim() });
        }
      }
    } else {
      for (let i = 1; i < content.length; i++) {
        const dataRow = content[i];
        if (!dataRow) continue;
        headers.forEach((header, idx) => {
          if (!header) return;
          const headerStr = String(header);
          let isOptionCol = headerStr.includes('选项') || headerStr.includes('Option');
          if (!isOptionCol && targetSheet.name === '行动选项') {
            if (headerStr.toLowerCase() !== 'id') isOptionCol = true;
          }
          if (isOptionCol && dataRow[idx]) {
            const cellVal = String(dataRow[idx]).trim();
            if (cellVal) {
              options.push({ text: cellVal, value: cellVal });
            }
          }
        });
      }
    }
  } catch (e) {
    console.error(`[${SCRIPT_NAME}] 获取选项失败:`, e);
  }
  return options;
}
