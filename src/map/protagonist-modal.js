// ============================================
// 主角状态弹窗：4 个 Tab 展示 主角信息 / 主角技能表 / 背包物品表 / 任务与事件表
// ============================================
import { $, topWindow } from '../core/env.js';
import { getSprite } from '../db/sprites.js';
import { getModalMountRoot } from '../ui/fullscreen.js';
import { getEquipmentSheet, getInventorySheet, getProtagonistSheet, getQuestsSheet, getSkillItems, getSkillsSheet } from './scene-data.js';
import { escapeHtml, fillActionText, getProtagonistDisplayName, syncSceneModalSkinClass } from './scene-ui-utils.js';

const STATUS_MODAL_ID = 'gal-scene-status-modal';
const STATUS_MODAL_STYLE_ID = 'gal-scene-status-modal-style';

function buildTabs(tableData) {
  const tabs = [
    { key: 'info', label: '主角信息', icon: 'fa-solid fa-id-card' },
    { key: 'skills', label: '技能', icon: 'fa-solid fa-wand-sparkles' },
    { key: 'inventory', label: '背包', icon: 'fa-solid fa-sack-xmark' },
  ];
  // 装备表仅部分模板（如 SQL_v4.3）存在，有才显示
  if (getEquipmentSheet(tableData)) {
    tabs.push({ key: 'equipment', label: '装备', icon: 'fa-solid fa-shirt' });
  }
  tabs.push({ key: 'quests', label: '任务', icon: 'fa-solid fa-scroll' });
  return tabs;
}

function ensureStatusModalStyle() {
  const mountRoot = getModalMountRoot();
  const doc = mountRoot.ownerDocument || topWindow.document;
  if (doc.getElementById(STATUS_MODAL_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STATUS_MODAL_STYLE_ID;
  style.textContent = `
    #${STATUS_MODAL_ID} {
      position: fixed; inset: 0; z-index: 100030;
      display: flex; align-items: center; justify-content: center;
      background: rgba(15, 18, 26, 0.55); backdrop-filter: blur(2px);
    }
    #${STATUS_MODAL_ID} .gal-status-panel {
      width: min(680px, 94vw); height: min(560px, 88vh);
      display: flex; flex-direction: column; overflow: hidden;
      background: #fdfbf6; color: #33302b;
      border-radius: 14px; box-shadow: 0 18px 50px rgba(0,0,0,.4);
      border: 1px solid rgba(0,0,0,.08);
    }
    #${STATUS_MODAL_ID} .gal-status-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; border-bottom: 1px solid rgba(0,0,0,.08);
      font-weight: 700; letter-spacing: 1px;
    }
    #${STATUS_MODAL_ID} .gal-status-close {
      background: none; border: none; cursor: pointer; color: #8a8577;
      font-size: 1.1rem; padding: 4px 8px; line-height: 1;
    }
    #${STATUS_MODAL_ID} .gal-status-tabs {
      display: flex; gap: 4px; padding: 8px 12px 0; border-bottom: 1px solid rgba(0,0,0,.08);
    }
    #${STATUS_MODAL_ID} .gal-status-tab {
      padding: 9px 16px; border: none; background: none; cursor: pointer;
      font-size: 0.9rem; font-weight: 600; color: #8a8577;
      border-bottom: 2.5px solid transparent; min-height: 40px;
    }
    #${STATUS_MODAL_ID} .gal-status-tab.active { color: #33302b; border-bottom-color: #7c6e58; }
    #${STATUS_MODAL_ID} .gal-status-tab i { margin-right: 5px; }
    #${STATUS_MODAL_ID} .gal-status-body { flex: 1; overflow-y: auto; padding: 14px 16px; }
    #${STATUS_MODAL_ID} .gal-status-profile { display: flex; gap: 14px; }
    #${STATUS_MODAL_ID} .gal-status-portrait {
      flex: 0 0 130px; width: 130px; height: 182px; border-radius: 10px;
      overflow: hidden; background: rgba(0,0,0,.06);
      display: flex; align-items: center; justify-content: center;
    }
    #${STATUS_MODAL_ID} .gal-status-portrait img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
    #${STATUS_MODAL_ID} .gal-status-portrait .initial {
      font-size: 2.6rem; font-weight: 700; color: #fff;
      width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #e8a33d, #c97b2d);
    }
    #${STATUS_MODAL_ID} .gal-status-dl { flex: 1; min-width: 0; font-size: 0.9rem; line-height: 1.7; }
    #${STATUS_MODAL_ID} .gal-status-dl .row { display: flex; gap: 10px; margin-bottom: 4px; }
    #${STATUS_MODAL_ID} .gal-status-dl .key { flex: 0 0 5em; color: #8a8577; }
    #${STATUS_MODAL_ID} .gal-status-dl .val { flex: 1; word-break: break-word; }
    #${STATUS_MODAL_ID} table.gal-status-table {
      width: 100%; border-collapse: collapse; font-size: 0.86rem;
    }
    #${STATUS_MODAL_ID} table.gal-status-table th,
    #${STATUS_MODAL_ID} table.gal-status-table td {
      padding: 8px 10px; text-align: left; border-bottom: 1px solid rgba(0,0,0,.08);
      vertical-align: top; word-break: break-word;
    }
    #${STATUS_MODAL_ID} table.gal-status-table th {
      color: #8a8577; font-weight: 600; white-space: nowrap;
      position: sticky; top: 0; background: #fdfbf6;
    }
    #${STATUS_MODAL_ID} .gal-status-empty { color: #8a8577; font-size: 0.9rem; text-align: center; padding: 40px 0; }
    #${STATUS_MODAL_ID} .gal-status-use-btn {
      padding: 5px 14px; border-radius: 8px; border: 1px solid rgba(0,0,0,.15);
      background: #7c6e58; color: #fff; font-size: 0.8rem; font-weight: 600;
      cursor: pointer; white-space: nowrap; min-height: 30px; transition: all .15s;
    }
    #${STATUS_MODAL_ID} .gal-status-use-btn:hover { filter: brightness(1.12); transform: translateY(-1px); }
    #${STATUS_MODAL_ID}.skin-default-dark .gal-status-use-btn,
    #${STATUS_MODAL_ID}.skin-persona .gal-status-use-btn,
    #${STATUS_MODAL_ID}.skin-twilight .gal-status-use-btn,
    #${STATUS_MODAL_ID}.skin-shujian-night .gal-status-use-btn {
      background: #c9a86a; color: #262430; border-color: rgba(255,255,255,.14);
    }
    /* 深色皮肤 */
    #${STATUS_MODAL_ID}.skin-default-dark .gal-status-panel,
    #${STATUS_MODAL_ID}.skin-persona .gal-status-panel,
    #${STATUS_MODAL_ID}.skin-persona-velvet .gal-status-panel,
    #${STATUS_MODAL_ID}.skin-twilight .gal-status-panel,
    #${STATUS_MODAL_ID}.skin-gilded-twilight .gal-status-panel,
    #${STATUS_MODAL_ID}.skin-dawn-twilight .gal-status-panel,
    #${STATUS_MODAL_ID}.skin-shujian-night .gal-status-panel {
      background: #262430; color: #e2ddd2; border-color: rgba(255,255,255,.1);
    }
    #${STATUS_MODAL_ID}.skin-default-dark .gal-status-tab.active,
    #${STATUS_MODAL_ID}.skin-twilight .gal-status-tab.active,
    #${STATUS_MODAL_ID}.skin-persona .gal-status-tab.active,
    #${STATUS_MODAL_ID}.skin-shujian-night .gal-status-tab.active { color: #e2ddd2; border-bottom-color: #c9a86a; }
    #${STATUS_MODAL_ID}.skin-default-dark table.gal-status-table th,
    #${STATUS_MODAL_ID}.skin-twilight table.gal-status-table th,
    #${STATUS_MODAL_ID}.skin-persona table.gal-status-table th,
    #${STATUS_MODAL_ID}.skin-shujian-night table.gal-status-table th { background: #262430; }
    @media (max-width: 640px) {
      #${STATUS_MODAL_ID} .gal-status-panel { width: 96vw; height: 92vh; }
      #${STATUS_MODAL_ID} .gal-status-tab { padding: 9px 10px; font-size: 0.82rem; }
      #${STATUS_MODAL_ID} .gal-status-profile { flex-direction: column; align-items: center; }
    }
  `;
  doc.head.appendChild(style);
}

// 「row_id」类内部列不展示
function isInternalColumn(header) {
  const h = String(header || '').trim().toLowerCase();
  return h === 'row_id' || h === 'id' || h === '行号';
}

// 主角信息（单行表）→ 「列名: 值」定义列表 + 立绘
function buildInfoTabHtml(sheet, protagonistName) {
  const portrait = `
    <div class="gal-status-portrait" id="gal-status-portrait">
      <div class="initial">${escapeHtml(String(protagonistName || '主').slice(0, 1))}</div>
    </div>
  `;
  if (!sheet || !sheet.rows.length) {
    return `<div class="gal-status-profile">${portrait}<div class="gal-status-empty">暂无主角信息数据</div></div>`;
  }
  const row = sheet.rows.find(r => r.some(cell => String(cell ?? '').trim() !== '')) || sheet.rows[0];
  const rows = sheet.headers
    .map((header, idx) => {
      if (isInternalColumn(header)) return '';
      const value = String(row[idx] ?? '').trim();
      if (!value) return '';
      return `<div class="row"><span class="key">${escapeHtml(header)}</span><span class="val">${escapeHtml(value)}</span></div>`;
    })
    .join('');
  return `
    <div class="gal-status-profile">
      ${portrait}
      <div class="gal-status-dl">${rows || '<div class="gal-status-empty">暂无数据</div>'}</div>
    </div>
  `;
}

// 通用表格渲染（技能/背包/任务）。
// useAction 提供时为每行追加「使用」按钮：{ nameAliases: 名称列别名, kind: 'skill'|'item' }
function buildSheetTableHtml(sheet, emptyText, useAction = null) {
  if (!sheet || !sheet.rows.length) {
    return `<div class="gal-status-empty">${escapeHtml(emptyText)}</div>`;
  }
  const visibleCols = sheet.headers
    .map((header, idx) => ({ header, idx }))
    .filter(col => !isInternalColumn(col.header));
  if (!visibleCols.length) return `<div class="gal-status-empty">${escapeHtml(emptyText)}</div>`;

  // 名称列定位（找不到就不渲染按钮，退化为纯表格）
  let nameIdx = -1;
  if (useAction) {
    const normalized = sheet.headers.map(h => String(h ?? '').trim());
    for (const alias of useAction.nameAliases) {
      nameIdx = normalized.indexOf(alias);
      if (nameIdx !== -1) break;
    }
  }
  const withUseCol = useAction && nameIdx !== -1;

  const thead =
    visibleCols.map(col => `<th>${escapeHtml(col.header)}</th>`).join('') + (withUseCol ? '<th>操作</th>' : '');
  const tbody = sheet.rows
    .filter(row => row.some(cell => String(cell ?? '').trim() !== ''))
    .map(row => {
      const tds = visibleCols.map(col => `<td>${escapeHtml(String(row[col.idx] ?? ''))}</td>`).join('');
      let useTd = '';
      if (withUseCol) {
        const name = String(row[nameIdx] ?? '').trim();
        useTd = name
          ? `<td><button class="gal-status-use-btn" data-use-kind="${escapeHtml(useAction.kind)}" data-use-name="${escapeHtml(name)}">使用</button></td>`
          : '<td></td>';
      }
      return `<tr>${tds}${useTd}</tr>`;
    })
    .join('');
  if (!tbody) return `<div class="gal-status-empty">${escapeHtml(emptyText)}</div>`;
  return `<table class="gal-status-table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
}

/**
 * 打开主角状态弹窗
 * @param {object} tableData exportTableAsJson 的表格数据
 * @param {object} [opts]
 * @param {function} [opts.onActionSent] 使用技能/道具发送后的回调（用于级联关闭地图）
 */
export function showProtagonistStatusModal(tableData, opts = {}) {
  ensureStatusModalStyle();
  const mountRoot = getModalMountRoot();
  $(mountRoot).find(`#${STATUS_MODAL_ID}`).remove();

  const protagonistName = getProtagonistDisplayName();
  const tabButtons = buildTabs(tableData)
    .map(
      (tab, i) =>
        `<button class="gal-status-tab${i === 0 ? ' active' : ''}" data-tab="${tab.key}"><i class="${tab.icon}"></i>${tab.label}</button>`,
    )
    .join('');

  const html = `
    <div id="${STATUS_MODAL_ID}">
      <div class="gal-status-panel">
        <div class="gal-status-header">
          <span><i class="fa-solid fa-user-astronaut"></i> ${escapeHtml(protagonistName)} 的状态</span>
          <button class="gal-status-close" title="关闭"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="gal-status-tabs">${tabButtons}</div>
        <div class="gal-status-body" id="gal-status-body"></div>
      </div>
    </div>
  `;
  $(mountRoot).append(html);
  const $modal = $(mountRoot).find(`#${STATUS_MODAL_ID}`);
  syncSceneModalSkinClass($modal);

  const renderTab = key => {
    const $body = $modal.find('#gal-status-body');
    if (key === 'info') {
      $body.html(buildInfoTabHtml(getProtagonistSheet(tableData), protagonistName));
      // 异步填充主角立绘
      getSprite(protagonistName, '默认')
        .then(url => {
          if (url) $modal.find('#gal-status-portrait').html(`<img src="${escapeHtml(url)}" alt="${escapeHtml(protagonistName)}">`);
        })
        .catch(() => { /* 忽略 */ });
    } else if (key === 'skills') {
      const skillsSheet = getSkillsSheet(tableData);
      const hasSheetData = !!skillsSheet && skillsSheet.rows.some(r => r.some(cell => String(cell ?? '').trim() !== ''));
      if (hasSheetData) {
        $body.html(
          buildSheetTableHtml(skillsSheet, '尚未习得任何技能', {
            kind: 'skill',
            nameAliases: ['技能名称', '名称', '技能'],
          }),
        );
      } else {
        // 无技能表的模板（如 SQL_v4.3）：用「主角信息-特有属性」构造虚拟技能表
        const fallbackItems = getSkillItems(tableData);
        const virtualSheet = {
          name: '技能',
          headers: ['技能名称', '类型', '等级/成功率', '效果描述'],
          rows: fallbackItems.map(item => [item.name, item.type, item.level, item.description]),
        };
        $body.html(
          buildSheetTableHtml(fallbackItems.length ? virtualSheet : null, '尚未习得任何技能', {
            kind: 'skill',
            nameAliases: ['技能名称'],
          }),
        );
      }
    } else if (key === 'inventory') {
      $body.html(
        buildSheetTableHtml(getInventorySheet(tableData), '背包空空如也', {
          kind: 'item',
          nameAliases: ['物品名称', '名称', '物品', '道具名称', '道具'],
        }),
      );
    } else if (key === 'equipment') {
      $body.html(buildSheetTableHtml(getEquipmentSheet(tableData), '没有任何装备'));
    } else if (key === 'quests') {
      $body.html(buildSheetTableHtml(getQuestsSheet(tableData), '暂无进行中的任务'));
    }
  };

  renderTab('info');

  const closeModal = () => $modal.remove();
  $modal.on('click', function (e) {
    if (e.target === this) closeModal();
  });
  $modal.on('click', '.gal-status-close', closeModal);
  $modal.on('click', '.gal-status-tab', function () {
    const key = String($(this).data('tab') || 'info');
    $modal.find('.gal-status-tab').removeClass('active');
    $(this).addClass('active');
    renderTab(key);
  });

  // 使用技能/道具：发送动作文本并级联关闭
  $modal.on('click', '.gal-status-use-btn', function () {
    const name = String($(this).attr('data-use-name') || '').trim();
    const kind = String($(this).attr('data-use-kind') || '');
    if (!name) return;
    const text =
      kind === 'skill'
        ? `${protagonistName}使用了「${name}」。`
        : `${protagonistName}从背包中取出「${name}」，使用了它。`;
    if (!fillActionText(text)) return;
    closeModal();
    if (typeof opts.onActionSent === 'function') opts.onActionSent();
  });

  return $modal;
}
