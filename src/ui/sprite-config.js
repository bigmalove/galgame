import { THEME } from '../core/constants.js';
import { $ } from '../core/env.js';
import { characterSprites, sceneBackgrounds } from '../core/store.js';
import { getDb } from '../core/state.js';
import { STORE_SPRITES } from '../core/constants.js';
import { initDB } from '../db/init.js';
import { getAllBackgrounds, deleteBackground } from '../db/backgrounds.js';
import { getCharacterListFromDatabase } from '../utils/chat.js';
import { getModalMountRoot } from './fullscreen.js';
import { showToast } from './toast.js';

// ============================================
// 资源管理弹窗 (立绘 + 背景)
// ============================================

// 延迟引用: 上传对话框函数 (尚未提取为独立模块)
let _showBatchUploadDialogRef = null;
let _showSpriteUploadDialogRef = null;
let _showBackgroundUploadDialogRef = null;

export function setSpriteConfigRefs({ showBatchUploadDialog, showSpriteUploadDialog, showBackgroundUploadDialog }) {
  if (showBatchUploadDialog) _showBatchUploadDialogRef = showBatchUploadDialog;
  if (showSpriteUploadDialog) _showSpriteUploadDialogRef = showSpriteUploadDialog;
  if (showBackgroundUploadDialog) _showBackgroundUploadDialogRef = showBackgroundUploadDialog;
}

export async function showSpriteConfigModal() {
  // 获取所有立绘
  if (!getDb()) await initDB();
  // 从数据库获取角色列表
  const dbCharacters = getCharacterListFromDatabase();
  const db = getDb();
  const transaction = db.transaction([STORE_SPRITES], 'readonly');
  const store = transaction.objectStore(STORE_SPRITES);
  const request = store.getAll();
  request.onsuccess = async () => {
    const sprites = request.result || [];
    // 构建角色列表HTML
    let charactersHtml = '';
    if (dbCharacters.length > 0) {
      charactersHtml = `
          <div style="margin-bottom: 20px;">
            <h4 style="color: ${THEME.accent}; margin-bottom: 15px; font-family: ${THEME.fontEng};">
              <i class="fa-solid fa-users"></i> 从数据库加载的角色 (${dbCharacters.length})
            </h4>
            <div class="gal-sprite-grid">
              ${dbCharacters
                .map(char => {
                  // 查找该角色是否有立绘（优先检查默认表情）
                  const spriteKey = `${char.name}_默认`;
                  const hasSprite = characterSprites.has(spriteKey);
                  const blobUrl = characterSprites.get(spriteKey) || '';
                  return `
                  <div class="gal-sprite-card ${hasSprite ? '' : 'no-sprite'}"
                       data-character="${char.name}"
                       data-type="${char.type}"
                       style="border-color: ${hasSprite ? THEME.accent : '#ccc'};">
                    ${
                      hasSprite
                        ? `<img class="gal-sprite-preview" src="${blobUrl}" alt="${char.name}">`
                        : `<div class="gal-sprite-preview" style="display: flex; align-items: center; justify-content: center; color: #aaa;">
                           <i class="fa-solid fa-user-plus" style="font-size: 2rem;"></i>
                         </div>`
                    }
                    <div class="gal-sprite-label">
                      ${char.name}<br>
                      <small style="color: ${char.type === '主角' ? THEME.accentSub : THEME.accent};">${char.type}</small>
                    </div>
                  </div>
                `;
                })
                .join('')}
            </div>
          </div>
          <div style="border-top: 2px solid #eee; margin: 20px 0;"></div>
        `;
    } else {
      charactersHtml = `
          <div style="padding: 30px; text-align: center; color: #888; background: #f5f5f5; margin-bottom: 20px; border-radius: 8px;">
            <i class="fa-solid fa-database" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
            <p style="margin: 0;">未检测到数据库角色数据</p>
            <small>请确保 神·数据库 脚本已加载并包含角色信息</small>
          </div>
        `;
    }
    // 获取所有背景
    const backgrounds = await getAllBackgrounds();
    const backgroundsHtml =
      backgrounds.length > 0
        ? backgrounds
            .map(bg => {
              const blobUrl = sceneBackgrounds.get(bg.id) || '';
              return `
          <div class="gal-bg-card" data-scene="${bg.sceneName}">
            <img class="gal-bg-preview" src="${blobUrl}" alt="${bg.sceneName}">
            <div class="gal-bg-label">${bg.sceneName}</div>
            <button class="gal-bg-delete" data-scene="${bg.sceneName}" title="删除">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        `;
            })
            .join('')
        : `
        <div style="grid-column: 1/-1; padding: 40px; text-align: center; color: #888;">
          <i class="fa-solid fa-image" style="font-size: 2.5rem; margin-bottom: 10px; display: block;"></i>
          <p>暂无背景图片</p>
          <small>点击上方按钮添加背景</small>
        </div>
      `;
    const modalHtml = `
        <div class="gal-config-modal" id="gal-config-modal">
          <div class="gal-config-panel" style="width: 100% !important; height: 100% !important; max-width: none !important; max-height: none !important; overflow-y: auto; border-radius: 0 !important;">
            <div class="gal-config-header">
              <div class="gal-config-title"><i class="fa-solid fa-images"></i> 资源管理</div>
              <button class="gal-config-close" id="gal-config-close">
                <i class="fa-solid fa-times"></i>
              </button>
            </div>

            <!-- Tab 切换 -->
            <div class="gal-tab-header">
              <button class="gal-tab-btn active" data-tab="sprites">
                <i class="fa-solid fa-user"></i> 立绘管理
              </button>
              <button class="gal-tab-btn" data-tab="backgrounds">
                <i class="fa-solid fa-panorama"></i> 背景管理
              </button>
            </div>

            <div class="gal-config-body">
              <!-- 立绘管理 Tab -->
              <div class="gal-tab-content active" data-tab="sprites">
                ${charactersHtml}

                <div style="display: flex; gap: 10px; margin-top: 15px;">
                  <button class="gal-action-btn" id="gal-add-sprite" style="flex: 1; padding: 12px;">
                    <i class="fa-solid fa-plus"></i>
                    <span>添加单个立绘</span>
                  </button>
                  <button class="gal-action-btn primary" id="gal-batch-add-sprite" style="flex: 1; padding: 12px;">
                    <i class="fa-solid fa-images"></i>
                    <span>批量添加（全表情）</span>
                  </button>
                </div>
              </div>

              <!-- 背景管理 Tab -->
              <div class="gal-tab-content" data-tab="backgrounds">
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                  <button class="gal-action-btn primary" id="gal-add-background" style="flex: 1; padding: 12px;">
                    <i class="fa-solid fa-plus"></i>
                    <span>添加背景图片</span>
                  </button>
                </div>
                <div class="gal-bg-grid">
                  ${backgroundsHtml}
                </div>
              </div>
            </div>
          </div>
        </div>

        <style>
          .gal-tab-header {
            display: flex;
            background: #f5f5f5;
            border-bottom: 2px solid #eee;
          }
          .gal-tab-btn {
            flex: 1;
            padding: 14px 20px;
            border: none;
            background: transparent;
            font-weight: 700;
            font-size: 0.95rem;
            color: #888;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }
          .gal-tab-btn:hover {
            color: ${THEME.dark};
            background: rgba(0, 210, 255, 0.1);
          }
          .gal-tab-btn.active {
            color: ${THEME.dark};
            background: #fff;
            border-bottom: 3px solid ${THEME.accent};
          }
          .gal-tab-content {
            display: none;
          }
          .gal-tab-content.active {
            display: block;
          }
          .gal-bg-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
          }
          .gal-bg-card {
            position: relative;
            border: 2px solid #eee;
            border-radius: 8px;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.2s;
          }
          .gal-bg-card:hover {
            border-color: ${THEME.accent};
            box-shadow: 0 4px 12px rgba(0, 210, 255, 0.15);
          }
          .gal-bg-preview {
            width: 100%;
            aspect-ratio: 16 / 9;
            object-fit: cover;
            display: block;
          }
          .gal-bg-label {
            padding: 10px;
            font-weight: 600;
            font-size: 0.85rem;
            color: ${THEME.dark};
            text-align: center;
            background: #fafafa;
          }
          .gal-bg-delete {
            position: absolute;
            top: 8px;
            right: 8px;
            width: 28px;
            height: 28px;
            border: none;
            border-radius: 50%;
            background: rgba(255, 0, 85, 0.9);
            color: #fff;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .gal-bg-card:hover .gal-bg-delete {
            opacity: 1;
          }
          .gal-bg-delete:hover {
            background: ${THEME.accentSub};
            transform: scale(1.1);
          }
        </style>
      `;
    $(getModalMountRoot()).append(modalHtml);
    const $modal = $('#gal-config-modal');
    $('#gal-config-close').on('click', () => $modal.remove());
    $modal.on('click', function (e) {
      if (e.target === this) $modal.remove();
    });
    // 点击数据库角色卡片上传立绘
    $modal.find('.gal-sprite-card[data-character]').on('click', function () {
      const charName = $(this).data('character');
      $modal.remove();
      if (_showBatchUploadDialogRef) _showBatchUploadDialogRef(charName, () => showSpriteConfigModal());
    });
    // 手动添加立绘（单个）
    $('#gal-add-sprite').on('click', async () => {
      $modal.remove();
      if (_showSpriteUploadDialogRef) await _showSpriteUploadDialogRef('default', '默认', () => showSpriteConfigModal());
    });
    // 批量添加立绘按钮
    $('#gal-batch-add-sprite').on('click', () => {
      $modal.remove();
      if (_showBatchUploadDialogRef) _showBatchUploadDialogRef('', () => showSpriteConfigModal());
    });
    // Tab 切换事件
    $modal.find('.gal-tab-btn').on('click', function () {
      const tab = $(this).data('tab');
      $modal.find('.gal-tab-btn').removeClass('active');
      $(this).addClass('active');
      $modal.find('.gal-tab-content').removeClass('active');
      $modal.find(`.gal-tab-content[data-tab="${tab}"]`).addClass('active');
    });
    // 添加背景按钮
    $('#gal-add-background').on('click', () => {
      $modal.remove();
      if (_showBackgroundUploadDialogRef) _showBackgroundUploadDialogRef(() => showSpriteConfigModal());
    });
    // 删除背景按钮
    $modal.find('.gal-bg-delete').on('click', async function (e) {
      e.stopPropagation();
      const sceneName = $(this).data('scene');
      if (confirm(`确定删除背景「${sceneName}」吗？`)) {
        await deleteBackground(sceneName);
        showToast(`已删除背景: ${sceneName}`);
        $modal.remove();
        showSpriteConfigModal();
      }
    });
  };
}
