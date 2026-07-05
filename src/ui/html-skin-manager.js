import { SCRIPT_NAME } from '../core/constants.js';
import { $, topWindow } from '../core/env.js';
import { getSettings, saveSettings } from '../core/settings.js';
import { deleteHtmlSkin, getCachedHtmlSkin, getCachedHtmlSkins, renameHtmlSkin, saveHtmlSkin } from '../db/html-skins.js';
import { showInAppConfirmDialog, showInAppPromptDialog } from './asset-io.js';
import { buildScopedSkinCss, parseHtmlSkinFile } from './html-skin-css.js';
import {
  HTML_SKIN_PROMPT,
  buildHtmlSkinExportFile,
  downloadHtmlFile,
  downloadHtmlSkinTemplate,
} from './html-skin-template.js';
import { showToast } from './toast.js';

// ============================================
// 自定义皮肤（HTML 模板）管理 tab（资产管理器"自定义皮肤"标签页）
// ============================================

// 延迟引用（避免与 settings-panel 循环依赖）
let _applySettingsToUIRef = null;
let _refreshSkinSelectElementRef = null;

export function setHtmlSkinManagerRefs({ applySettingsToUI, refreshSkinSelectElement }) {
  if (applySettingsToUI) _applySettingsToUIRef = applySettingsToUI;
  if (refreshSkinSelectElement) _refreshSkinSelectElementRef = refreshSkinSelectElement;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatSkinTime(isoText) {
  const date = new Date(String(isoText || ''));
  if (Number.isNaN(date.getTime())) return '--';
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function copyTextToClipboard(text) {
  try {
    await topWindow.navigator.clipboard.writeText(text);
    return true;
  } catch (_error) {
    // 回退方案：textarea + execCommand
    try {
      const doc = topWindow.document;
      const textarea = doc.createElement('textarea');
      textarea.value = text;
      textarea.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
      doc.body.appendChild(textarea);
      textarea.select();
      const ok = doc.execCommand('copy');
      textarea.remove();
      return ok;
    } catch (_fallbackError) {
      return false;
    }
  }
}

function buildSkinListHtml() {
  const skins = getCachedHtmlSkins();
  const currentSkin = String(getSettings()?.skin || '').trim();
  if (!skins.length) {
    return '<div class="gal-html-skin-empty">还没有导入任何自定义皮肤。下载模板并让 AI 设计一套吧！</div>';
  }
  return skins
    .map(skin => {
      const isActive = skin.id === currentSkin;
      const metaParts = [
        skin.author ? `作者：${escapeHtml(skin.author)}` : '',
        skin.version ? `v${escapeHtml(skin.version)}` : '',
        formatSkinTime(skin.updatedAt),
      ].filter(Boolean);
      return `
        <div class="gal-html-skin-item ${isActive ? 'active' : ''}" data-skin-id="${escapeHtml(skin.id)}">
          <div class="gal-html-skin-item-info">
            <div class="gal-html-skin-item-name">
              <i class="fa-solid fa-palette"></i> ${escapeHtml(skin.name)}
              ${isActive ? '<span class="gal-html-skin-active-badge">使用中</span>' : ''}
            </div>
            <div class="gal-html-skin-item-meta">${metaParts.join(' · ')}</div>
          </div>
          <div class="gal-html-skin-item-actions">
            <button class="gal-action-btn gal-html-skin-apply-btn" title="${isActive ? '取消使用该皮肤' : '启用该皮肤'}">
              <i class="fa-solid ${isActive ? 'fa-power-off' : 'fa-check'}"></i> <span>${isActive ? '停用' : '启用'}</span>
            </button>
            <button class="gal-action-btn gal-html-skin-rename-btn" title="重命名"><i class="fa-solid fa-pen"></i></button>
            <button class="gal-action-btn gal-html-skin-export-btn" title="导出为 HTML 文件"><i class="fa-solid fa-file-export"></i></button>
            <button class="gal-action-btn gal-html-skin-delete-btn" title="删除"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      `;
    })
    .join('');
}

export function buildHtmlSkinTab(activeTab) {
  return `
  <div class="gal-tab-pane ${activeTab === 'skin' ? 'active' : ''}" data-pane="skin" style="${activeTab !== 'skin' ? 'display: none;' : ''}">
    <div class="gal-html-skin-section">
      <div class="gal-html-skin-section-title"><i class="fa-solid fa-wand-magic-sparkles"></i> 制作皮肤</div>
      <div class="gal-html-skin-section-desc">
        1. 下载皮肤模板（HTML 文件，内嵌与游戏完全一致的界面样式，浏览器打开即所见即所得预览）；<br>
        2. 复制 AI 提示词，连同模板文件一起发给任意 AI（Claude / GPT / Gemini 等），描述你想要的风格；<br>
        3. 把 AI 返回的皮肤样式块替换进模板预览效果，或直接把它保存为 .html 文件，回到本页面导入即可。
      </div>
      <div class="gal-html-skin-actions-row">
        <button class="gal-action-btn gal-pane-btn purple" id="gal-html-skin-download-template-btn">
          <i class="fa-solid fa-download"></i> <span>下载 HTML 模板</span>
        </button>
        <button class="gal-action-btn gal-pane-btn" id="gal-html-skin-copy-prompt-btn">
          <i class="fa-solid fa-copy"></i> <span>复制 AI 提示词</span>
        </button>
      </div>
    </div>

    <div class="gal-html-skin-section">
      <div class="gal-html-skin-section-title"><i class="fa-solid fa-file-import"></i> 导入皮肤</div>
      <div class="gal-html-skin-section-desc">
        选择 AI 生成的 HTML 文件。插件会自动提取皮肤样式并做安全处理（限定作用域、剥离危险内容）。
      </div>
      <div class="gal-html-skin-actions-row">
        <button class="gal-action-btn gal-pane-btn green" id="gal-html-skin-import-btn">
          <i class="fa-solid fa-file-arrow-up"></i> <span>导入皮肤文件</span>
        </button>
        <input type="file" id="gal-html-skin-import-input" accept=".html,.htm" style="display: none;">
      </div>
    </div>

    <div class="gal-html-skin-section">
      <div class="gal-html-skin-section-title"><i class="fa-solid fa-layer-group"></i> 已装皮肤</div>
      <div class="gal-html-skin-list" id="gal-html-skin-list">
        ${buildSkinListHtml()}
      </div>
    </div>
  </div>
  `;
}

function refreshHtmlSkinListElement($modal) {
  const $list = $modal.find('#gal-html-skin-list');
  if ($list.length) $list.html(buildSkinListHtml());
}

function refreshSkinUiAfterChange($modal) {
  refreshHtmlSkinListElement($modal);
  if (typeof _refreshSkinSelectElementRef === 'function') {
    try { _refreshSkinSelectElementRef(); } catch (_e) { /* 面板可能未打开 */ }
  }
}

function applySkinSelection($modal, skinId) {
  const settings = getSettings();
  settings.skin = skinId;
  saveSettings();
  if (typeof _applySettingsToUIRef === 'function') {
    _applySettingsToUIRef();
  }
  refreshSkinUiAfterChange($modal);
}

async function importHtmlSkinFile($modal, file) {
  let htmlText = '';
  try {
    htmlText = await file.text();
  } catch (error) {
    showToast('读取文件失败：' + (error?.message || error), 4000);
    return;
  }

  let parsed = null;
  let scopedCss = '';
  try {
    parsed = parseHtmlSkinFile(htmlText);
    scopedCss = buildScopedSkinCss(parsed.rawCss);
    if (!scopedCss.trim()) {
      throw new Error('皮肤样式经安全处理后为空，请检查 CSS 是否有效');
    }
  } catch (error) {
    showToast('导入失败：' + (error?.message || error), 4000);
    return;
  }

  const fallbackName = String(file.name || '').replace(/\.html?$/i, '').trim();
  const skinName = parsed.name || fallbackName || '自定义皮肤';

  // 同名皮肤确认覆盖
  const sameNameSkin = getCachedHtmlSkins().find(skin => skin.name === skinName);
  let overwriteId = '';
  if (sameNameSkin) {
    const overwrite = await showInAppConfirmDialog({
      title: '存在同名皮肤',
      message: `已存在名为「${skinName}」的皮肤，是否覆盖？\n选择"取消"会作为新皮肤单独保存。`,
      confirmText: '覆盖',
      cancelText: '另存为新皮肤',
    });
    if (overwrite) overwriteId = sameNameSkin.id;
  }

  let record = null;
  try {
    record = await saveHtmlSkin({
      id: overwriteId || undefined,
      name: skinName,
      author: parsed.author,
      version: parsed.version,
      rawCss: parsed.rawCss,
      scopedCss,
    });
  } catch (error) {
    console.error(`[${SCRIPT_NAME}] 保存 HTML 皮肤失败:`, error);
    showToast('保存皮肤失败：' + (error?.message || error), 4000);
    return;
  }

  refreshSkinUiAfterChange($modal);
  showToast(`皮肤「${record.name}」导入成功`);

  const applyNow = await showInAppConfirmDialog({
    title: '立即启用？',
    message: `是否立即启用皮肤「${record.name}」？`,
    confirmText: '立即启用',
    cancelText: '稍后再说',
  });
  if (applyNow) {
    applySkinSelection($modal, record.id);
    showToast(`已启用皮肤「${record.name}」`);
  }
}

export function bindHtmlSkinTabEvents($modal) {
  // 下载模板
  $modal.find('#gal-html-skin-download-template-btn').on('click', () => {
    downloadHtmlSkinTemplate();
    showToast('皮肤模板已开始下载');
  });

  // 复制提示词
  $modal.find('#gal-html-skin-copy-prompt-btn').on('click', async () => {
    const ok = await copyTextToClipboard(HTML_SKIN_PROMPT);
    showToast(ok ? 'AI 提示词已复制到剪贴板' : '复制失败，请手动复制');
  });

  // 导入
  $modal.find('#gal-html-skin-import-btn').on('click', () => {
    $modal.find('#gal-html-skin-import-input').trigger('click');
  });
  $modal.find('#gal-html-skin-import-input').on('change', async function () {
    const file = this.files && this.files[0];
    this.value = '';
    if (!file) return;
    await importHtmlSkinFile($modal, file);
  });

  // 皮肤列表操作（事件委托，列表会被刷新重建）
  const $list = $modal.find('#gal-html-skin-list');

  $list.on('click', '.gal-html-skin-apply-btn', function () {
    const skinId = String($(this).closest('.gal-html-skin-item').data('skin-id') || '');
    const skin = getCachedHtmlSkin(skinId);
    if (!skin) return;
    const isActive = String(getSettings()?.skin || '') === skinId;
    applySkinSelection($modal, isActive ? 'none' : skinId);
    showToast(isActive ? `已停用皮肤「${skin.name}」` : `已启用皮肤「${skin.name}」`);
  });

  $list.on('click', '.gal-html-skin-rename-btn', async function () {
    const skinId = String($(this).closest('.gal-html-skin-item').data('skin-id') || '');
    const skin = getCachedHtmlSkin(skinId);
    if (!skin) return;
    const newName = await showInAppPromptDialog({
      title: '重命名皮肤',
      label: '皮肤名称',
      defaultValue: skin.name,
      required: true,
      requiredMessage: '皮肤名称不能为空',
    });
    if (newName === null || newName === undefined) return;
    const trimmed = String(newName).trim();
    if (!trimmed || trimmed === skin.name) return;
    try {
      await renameHtmlSkin(skinId, trimmed);
      refreshSkinUiAfterChange($modal);
      showToast('皮肤已重命名');
    } catch (error) {
      showToast('重命名失败：' + (error?.message || error), 4000);
    }
  });

  $list.on('click', '.gal-html-skin-export-btn', function () {
    const skinId = String($(this).closest('.gal-html-skin-item').data('skin-id') || '');
    const skin = getCachedHtmlSkin(skinId);
    if (!skin) return;
    const html = buildHtmlSkinExportFile(skin);
    downloadHtmlFile(html, `galgame皮肤-${skin.name}.html`);
    showToast(`皮肤「${skin.name}」已开始下载`);
  });

  $list.on('click', '.gal-html-skin-delete-btn', async function () {
    const skinId = String($(this).closest('.gal-html-skin-item').data('skin-id') || '');
    const skin = getCachedHtmlSkin(skinId);
    if (!skin) return;
    const confirmed = await showInAppConfirmDialog({
      title: '删除皮肤',
      message: `确定删除皮肤「${skin.name}」吗？此操作不可撤销。\n建议删除前先导出备份。`,
      confirmText: '删除',
      cancelText: '取消',
    });
    if (!confirmed) return;
    try {
      await deleteHtmlSkin(skinId);
      // 若删除的是当前皮肤，回落默认
      if (String(getSettings()?.skin || '') === skinId) {
        applySkinSelection($modal, 'none');
      } else {
        refreshSkinUiAfterChange($modal);
      }
      showToast(`皮肤「${skin.name}」已删除`);
    } catch (error) {
      showToast('删除失败：' + (error?.message || error), 4000);
    }
  });
}

export function buildHtmlSkinTabStyles() {
  return `
    .gal-html-skin-section { margin-bottom: 18px; padding: 14px 16px; background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 8px; }
    .gal-html-skin-section-title { font-weight: 700; font-size: 1rem; color: #333; margin-bottom: 8px; }
    .gal-html-skin-section-title i { color: #6f42c1; margin-right: 6px; }
    .gal-html-skin-section-desc { color: #666; font-size: 0.86rem; line-height: 1.7; margin-bottom: 12px; }
    .gal-html-skin-actions-row { display: flex; gap: 10px; flex-wrap: wrap; }
    .gal-html-skin-list { display: flex; flex-direction: column; gap: 8px; }
    .gal-html-skin-empty { color: #888; font-size: 0.88rem; padding: 14px 4px; text-align: center; }
    .gal-html-skin-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; background: #fff; border: 1px solid #e0e0e0; border-radius: 6px; }
    .gal-html-skin-item.active { border-color: #6f42c1; box-shadow: 0 0 0 1px #6f42c1 inset; }
    .gal-html-skin-item-info { min-width: 0; flex: 1; }
    .gal-html-skin-item-name { font-weight: 600; color: #333; font-size: 0.92rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .gal-html-skin-item-name i { color: #6f42c1; margin-right: 4px; }
    .gal-html-skin-active-badge { margin-left: 6px; font-size: 0.7rem; background: #6f42c1; color: #fff; padding: 2px 6px; border-radius: 3px; vertical-align: middle; }
    .gal-html-skin-item-meta { color: #999; font-size: 0.76rem; margin-top: 2px; }
    .gal-html-skin-item-actions { display: flex; gap: 6px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
    .gal-html-skin-item-actions .gal-action-btn { padding: 5px 10px; font-size: 0.8rem; }
    @media (max-width: 600px) {
      .gal-html-skin-item { flex-direction: column; align-items: stretch; }
      .gal-html-skin-item-actions { justify-content: flex-start; }
    }
  `;
}
