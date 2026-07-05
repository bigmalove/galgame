import { SCRIPT_NAME } from '../core/constants.js';
import { $, topWindow } from '../core/env.js';
import { getAllBackgrounds, saveBackgroundsBatch } from '../db/backgrounds.js';
import { saveSpritesBatch } from '../db/sprites.js';
import { createImagePack, getAllImagePacks, setCurrentPack } from '../db/image-packs.js';
import { showInAppConfirmDialog } from './asset-io.js';
import { getModalMountRoot } from './fullscreen.js';
import { makeDraggable } from './interaction.js';
import { showToast } from './toast.js';

// ============================================
// 内置背景图包（GitHub 远程图包，只存 URL 不占本地存储）
// ============================================

// 双 CDN 源（参照 live2d/loader.js 的 cdn/gcore 回退模式）
const CDN_HOSTS = ['https://cdn.jsdelivr.net', 'https://gcore.jsdelivr.net'];

// TODO: 发布素材仓库后把 owner 改成实际 GitHub 用户名、tag 改成实际 release tag
export const BUILTIN_BG_PACKS = [
  {
    id: 'jp',
    name: '内置图包·日式学园',
    desc: '教室 / 天台 / 放学路等 30 场景 + 10 套立绘模板与路人剪影',
    repo: 'bigmalove/galgame-bg-jp',
    tag: 'v1.3.0',
    sceneCount: 30,
    coverFile: 'thumbs/教室.webp',
  },
  {
    id: 'xianxia',
    name: '内置图包·仙侠',
    desc: '竹林 / 云海 / 仙宫等 30 场景 + 10 套立绘模板与路人剪影',
    repo: 'bigmalove/galgame-bg-xianxia',
    tag: 'v1.3.0',
    sceneCount: 30,
    coverFile: 'thumbs/竹林.webp',
  },
  {
    id: 'guzhuang',
    name: '内置图包·古装',
    desc: '宫殿 / 御花园 / 街市等 30 场景 + 10 套立绘模板与路人剪影',
    repo: 'bigmalove/galgame-bg-guzhuang',
    tag: 'v1.3.0',
    sceneCount: 30,
    coverFile: 'thumbs/宫殿.webp',
  },
  {
    id: 'city',
    name: '内置图包·现代都市',
    desc: '街道 / 咖啡厅 / 雨夜街头等 30 场景 + 10 套立绘模板与路人剪影',
    repo: 'bigmalove/galgame-bg-city',
    tag: 'v1.3.0',
    sceneCount: 30,
    coverFile: 'thumbs/街道.webp',
  },
];

// 本地调试覆盖：localStorage 里设 gal_builtin_bg_base_override_<id> = 'http://127.0.0.1:5500/tmp/bg-packs/galgame-bg-jp/'
function getBaseOverride(packId) {
  try {
    return topWindow.localStorage.getItem(`gal_builtin_bg_base_override_${packId}`) || '';
  } catch {
    return '';
  }
}

function encodePathSegments(relPath) {
  return String(relPath || '')
    .split('/')
    .map(encodeURIComponent)
    .join('/');
}

function buildPackUrl(pack, hostIndex, relPath) {
  const override = getBaseOverride(pack.id);
  if (override) {
    const base = override.endsWith('/') ? override : `${override}/`;
    return base + encodePathSegments(relPath);
  }
  return `${CDN_HOSTS[hostIndex]}/gh/${pack.repo}@${pack.tag}/${encodePathSegments(relPath)}`;
}

// 命中 gcore 镜像时，把 manifest 中的绝对 URL 域名同步替换
function resolveEntryUrl(rawUrl, hostIndex) {
  const url = String(rawUrl || '');
  if (hostIndex === 0) return url;
  return url.replace('://cdn.jsdelivr.net/', '://gcore.jsdelivr.net/');
}

const _manifestCache = new Map();

async function fetchPackManifest(pack) {
  if (_manifestCache.has(pack.id)) return _manifestCache.get(pack.id);

  const hostCount = getBaseOverride(pack.id) ? 1 : CDN_HOSTS.length;
  let lastError = null;
  for (let hostIndex = 0; hostIndex < hostCount; hostIndex++) {
    try {
      const url = buildPackUrl(pack, hostIndex, 'remote_assets.json');
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const manifest = await res.json();
      if (!Array.isArray(manifest?.backgrounds) || manifest.backgrounds.length === 0) {
        throw new Error('manifest 中没有 backgrounds');
      }
      const result = { manifest, hostIndex };
      _manifestCache.set(pack.id, result);
      return result;
    } catch (error) {
      lastError = error;
      console.warn(`[${SCRIPT_NAME}] 内置图包 manifest 获取失败（源 ${hostIndex}）:`, error?.message || error);
    }
  }
  throw new Error(`无法获取图包清单: ${lastError?.message || lastError}`);
}

// 幂等导入：同名图包复用，背景按 sceneName 覆盖（backgrounds 表主键即 sceneName）
// autoSwitch: true 时导入后直接切换为当前图包，不再弹「是否切换」确认（图包切换列表点击内置包时用）
export async function importBuiltinBgPack(pack, { autoSwitch = false } = {}) {
  const { manifest, hostIndex } = await fetchPackManifest(pack);
  const entries = manifest.backgrounds
    .map(bg => ({
      sceneName: String(bg?.sceneName || '').trim(),
      imageUrl: resolveEntryUrl(bg?.url || bg?.imageUrl, hostIndex),
    }))
    .filter(e => e.sceneName && e.imageUrl);
  if (!entries.length) throw new Error('图包清单为空');

  // 覆盖预警：sceneName 是全局主键，会把用户已有同名背景改挂到本包
  const existing = await getAllBackgrounds(null, true);
  const existingNames = new Set(existing.map(bg => bg.sceneName));
  const conflicts = entries.filter(e => existingNames.has(e.sceneName)).map(e => e.sceneName);
  if (conflicts.length > 0) {
    const confirmed = await showInAppConfirmDialog({
      title: '存在同名场景',
      message: `以下 ${conflicts.length} 个场景已存在，导入将覆盖它们（并移入本图包）：\n${conflicts.join('、')}`,
      confirmText: '覆盖导入',
      cancelText: '取消',
      iconClass: 'fa-solid fa-triangle-exclamation',
      accent: '#f39c12',
    });
    if (!confirmed) return null;
  }

  // 同名图包复用（重复导入不产生重复包）
  const allPacks = await getAllImagePacks();
  let targetPack = allPacks.find(p => p.name === pack.name);
  if (!targetPack) {
    targetPack = await createImagePack(pack.name);
  }

  await saveBackgroundsBatch(
    entries.map(e => ({ sceneName: e.sceneName, imageBlob: null, imageUrl: e.imageUrl })),
    targetPack.id,
  );

  // 立绘：template 条目是「立绘模板」不自动入库（用户建角色时在立绘上传弹窗「内置模板」tab 套用）；
  // 非 template（路人剪影）为功能性回退素材，直接入库（sprite-manager 按固定名自动查找）
  const allSprites = (Array.isArray(manifest.sprites) ? manifest.sprites : [])
    .map(sp => ({
      characterId: String(sp?.characterId || '').trim(),
      expression: String(sp?.expression || '').trim(),
      imageBlob: null,
      imageUrl: resolveEntryUrl(sp?.url || sp?.imageUrl, hostIndex),
      template: sp?.template === true,
    }))
    .filter(e => e.characterId && e.expression && e.imageUrl);
  const npcSprites = allSprites.filter(e => !e.template);
  const templateCount = new Set(allSprites.filter(e => e.template).map(e => e.characterId)).size;
  if (npcSprites.length) {
    await saveSpritesBatch(
      npcSprites.map(e => ({ characterId: e.characterId, expression: e.expression, imageBlob: null, imageUrl: e.imageUrl })),
      targetPack.id,
    );
  }

  const spriteNote = npcSprites.length ? `、${npcSprites.length} 张路人剪影` : '';
  const templateNote = templateCount ? `\n包内含 ${templateCount} 套立绘模板：给角色配立绘时，在「上传立绘 → 内置模板」中选用。` : '';
  if (autoSwitch) {
    setCurrentPack(targetPack.id);
  } else {
    const switchToPack = await showInAppConfirmDialog({
      title: '导入完成',
      message: `已导入 ${entries.length} 个背景${spriteNote}到「${pack.name}」。${templateNote}\n是否切换为当前图包？`,
      confirmText: '切换',
      cancelText: '暂不',
      iconClass: 'fa-solid fa-images',
      accent: '#28a745',
    });
    if (switchToPack) setCurrentPack(targetPack.id);
  }

  showToast(`「${pack.name}」导入完成（${entries.length} 个背景${spriteNote}）`);
  return { packId: targetPack.id, count: entries.length + npcSprites.length };
}

// ============================================
// 立绘模板：供立绘上传弹窗「内置模板」tab 调用
// ============================================

// 列出所有内置包的模板（返回 [{packId, packName, characterId, expressions:[{expression,url,thumb}]}]）
export async function listBuiltinSpriteTemplates() {
  const templates = [];
  for (const pack of BUILTIN_BG_PACKS) {
    try {
      const { manifest, hostIndex } = await fetchPackManifest(pack);
      const sprites = (Array.isArray(manifest.sprites) ? manifest.sprites : []).filter(sp => sp?.template === true);
      const byChar = new Map();
      for (const sp of sprites) {
        const characterId = String(sp?.characterId || '').trim();
        const expression = String(sp?.expression || '').trim();
        const url = resolveEntryUrl(sp?.url || sp?.imageUrl, hostIndex);
        if (!characterId || !expression || !url) continue;
        if (!byChar.has(characterId)) byChar.set(characterId, []);
        byChar.get(characterId).push({ expression, url, thumb: resolveEntryUrl(sp?.thumb, hostIndex) || url });
      }
      for (const [characterId, expressions] of byChar) {
        templates.push({ packId: pack.id, packName: pack.name, characterId, expressions });
      }
    } catch (error) {
      console.warn(`[${SCRIPT_NAME}] 模板清单获取失败（${pack.id}）:`, error?.message || error);
    }
  }
  return templates;
}

// 把模板整套表情以 URL 引用套用到用户角色名下（存入当前图包）
export async function applySpriteTemplateToCharacter(template, targetCharacterId) {
  const characterId = String(targetCharacterId || '').trim();
  if (!characterId) throw new Error('角色名不能为空');
  await saveSpritesBatch(
    template.expressions.map(e => ({
      characterId,
      expression: e.expression,
      imageBlob: null,
      imageUrl: e.url,
    })),
  );
  showToast(`已将模板「${template.characterId}」套用到角色「${characterId}」（${template.expressions.length} 个表情）`);
  return template.expressions.length;
}

// ============================================
// 内置图包浏览器 UI
// ============================================

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPackCardHtml(pack) {
  const coverUrl = buildPackUrl(pack, 0, pack.coverFile);
  const coverFallback = buildPackUrl(pack, 1, pack.coverFile);
  return `
    <div class="gal-builtin-pack-card" data-pack-id="${escapeHtml(pack.id)}" style="background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); display: flex; flex-direction: column;">
      <div style="aspect-ratio: 16 / 9; background: #f1f5f9; overflow: hidden;">
        <img src="${escapeHtml(coverUrl)}" data-fallback="${escapeHtml(coverFallback)}" alt="${escapeHtml(pack.name)}"
             style="width: 100%; height: 100%; object-fit: cover;" loading="lazy"
             onerror="if(this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback='';}else{this.style.display='none';}">
      </div>
      <div style="padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; flex: 1;">
        <div style="font-weight: 700; color: #111827;">${escapeHtml(pack.name)}</div>
        <div style="font-size: 0.82rem; color: #64748b; line-height: 1.5; flex: 1;">${escapeHtml(pack.desc)}</div>
        <div style="display: flex; gap: 8px; margin-top: 6px;">
          <button class="gal-action-btn gal-builtin-preview" data-pack-id="${escapeHtml(pack.id)}" style="flex: 1; padding: 6px 10px; font-size: 0.85rem; justify-content: center;">
            <i class="fa-solid fa-eye"></i> 预览
          </button>
          <button class="gal-action-btn primary gal-builtin-import" data-pack-id="${escapeHtml(pack.id)}" style="flex: 1; padding: 6px 10px; font-size: 0.85rem; justify-content: center;">
            <i class="fa-solid fa-download"></i> 一键导入
          </button>
        </div>
      </div>
    </div>`;
}

export function showBuiltinBgPackBrowser({ onImported } = {}) {
  const mountRoot = getModalMountRoot();
  const dialogHtml = `
    <div class="gal-input-modal" id="gal-builtin-bg-modal">
      <div class="gal-input-box" style="max-width: 860px; width: 96%; max-height: 90vh; overflow: hidden; padding: 0; display: flex; flex-direction: column;">
        <div class="gal-input-title" style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #eee; margin: 0;">
          <span id="gal-builtin-bg-title"><i class="fa-solid fa-images" style="color: #e83e8c;"></i> 内置背景图包</span>
          <button id="gal-builtin-bg-close" style="border: none; background: transparent; color: #666; cursor: pointer; font-size: 1.1rem;">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        <div id="gal-builtin-bg-body" style="padding: 16px 20px; overflow-y: auto;">
          <div style="font-size: 0.82rem; color: #64748b; margin-bottom: 12px;">
            背景托管在 GitHub（jsDelivr CDN），导入仅保存链接、不占本地存储；显示时按需加载。
          </div>
          <div id="gal-builtin-bg-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px;">
            ${BUILTIN_BG_PACKS.map(buildPackCardHtml).join('')}
          </div>
          <div id="gal-builtin-bg-preview" style="display: none;">
            <button class="gal-action-btn" id="gal-builtin-bg-back" style="margin-bottom: 12px; padding: 6px 12px;">
              <i class="fa-solid fa-arrow-left"></i> 返回图包列表
            </button>
            <div id="gal-builtin-bg-preview-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px;"></div>
          </div>
        </div>
        <div style="padding: 12px 20px; border-top: 1px solid #eee; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <span id="gal-builtin-bg-status" style="font-size: 0.85rem; color: #64748b;"></span>
          <button class="gal-action-btn" id="gal-builtin-bg-cancel" style="padding: 8px 14px;">关闭</button>
        </div>
      </div>
    </div>
  `;

  $(mountRoot).append(dialogHtml);
  const $dialog = $(mountRoot).find('#gal-builtin-bg-modal');
  makeDraggable($dialog.find('.gal-input-box'), $dialog.find('.gal-input-title'));

  const $status = $dialog.find('#gal-builtin-bg-status');
  const $grid = $dialog.find('#gal-builtin-bg-grid');
  const $preview = $dialog.find('#gal-builtin-bg-preview');
  const $previewGrid = $dialog.find('#gal-builtin-bg-preview-grid');

  const closeDialog = () => $dialog.remove();
  $dialog.find('#gal-builtin-bg-close, #gal-builtin-bg-cancel').on('click', closeDialog);
  $dialog.on('click', function (e) {
    if (e.target === this) closeDialog();
  });

  $dialog.find('#gal-builtin-bg-back').on('click', () => {
    $preview.hide();
    $grid.show();
    $status.text('');
  });

  $dialog.find('.gal-builtin-preview').on('click', async function () {
    const pack = BUILTIN_BG_PACKS.find(p => p.id === $(this).data('pack-id'));
    if (!pack) return;
    $status.html('<i class="fa-solid fa-spinner fa-spin"></i> 正在加载预览...');
    try {
      const { manifest, hostIndex } = await fetchPackManifest(pack);
      const bgCells = manifest.backgrounds
        .map(bg => {
          const thumb = resolveEntryUrl(bg.thumb || bg.url || bg.imageUrl, hostIndex);
          return `
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: #fff;">
              <div style="aspect-ratio: 16 / 9; background: #f1f5f9;">
                <img src="${escapeHtml(thumb)}" alt="${escapeHtml(bg.sceneName)}" loading="lazy"
                     style="width: 100%; height: 100%; object-fit: cover;">
              </div>
              <div style="padding: 6px 8px; font-size: 0.82rem; color: #334155; text-align: center;">${escapeHtml(bg.sceneName)}</div>
            </div>`;
        })
        .join('');

      // 立绘分组（棋盘格底显示透明）
      const sprites = Array.isArray(manifest.sprites) ? manifest.sprites : [];
      const checkerCss =
        'background-image: linear-gradient(45deg, #d1d5db 25%, transparent 25%, transparent 75%, #d1d5db 75%), linear-gradient(45deg, #d1d5db 25%, #f3f4f6 25%, #f3f4f6 75%, #d1d5db 75%); background-size: 16px 16px; background-position: 0 0, 8px 8px;';
      const spriteCells = sprites
        .map(sp => {
          const thumb = resolveEntryUrl(sp.thumb || sp.url || sp.imageUrl, hostIndex);
          return `
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: #fff;">
              <div style="aspect-ratio: 3 / 4; ${checkerCss} display: flex; align-items: center; justify-content: center;">
                <img src="${escapeHtml(thumb)}" alt="${escapeHtml(sp.characterId)}" loading="lazy"
                     style="max-width: 100%; max-height: 100%; object-fit: contain;">
              </div>
              <div style="padding: 4px 6px; font-size: 0.78rem; color: #334155; text-align: center;">${escapeHtml(sp.characterId)}·${escapeHtml(sp.expression)}</div>
            </div>`;
        })
        .join('');
      const spriteSection = sprites.length
        ? `<div style="grid-column: 1 / -1; font-weight: 700; color: #111827; margin-top: 8px;">立绘（${sprites.length} 张）</div>${spriteCells}`
        : '';

      $previewGrid.html(
        `<div style="grid-column: 1 / -1; font-weight: 700; color: #111827;">背景（${manifest.backgrounds.length} 张）</div>${bgCells}${spriteSection}`,
      );
      $grid.hide();
      $preview.show();
      $status.text(`${pack.name} · ${manifest.backgrounds.length} 场景${sprites.length ? ` · ${sprites.length} 立绘` : ''}`);
    } catch (error) {
      $status.text(`预览加载失败: ${error?.message || error}`);
    }
  });

  $dialog.find('.gal-builtin-import').on('click', async function () {
    const pack = BUILTIN_BG_PACKS.find(p => p.id === $(this).data('pack-id'));
    if (!pack) return;
    const $btn = $(this);
    $btn.prop('disabled', true);
    $status.html('<i class="fa-solid fa-spinner fa-spin"></i> 正在导入...');
    try {
      const result = await importBuiltinBgPack(pack);
      if (result) {
        $status.text(`导入完成：${result.count} 个背景`);
        closeDialog();
        if (typeof onImported === 'function') onImported(result.packId);
      } else {
        $status.text('已取消导入');
      }
    } catch (error) {
      console.error(`[${SCRIPT_NAME}] 内置图包导入失败:`, error);
      $status.text(`导入失败: ${error?.message || error}`);
    } finally {
      $btn.prop('disabled', false);
    }
  });
}
