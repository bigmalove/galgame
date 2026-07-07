// ============================================
// NPC 交互弹窗：信息区 + 对话 / 送礼 / 使用技能 三个二级面板
// 所有动作最终生成第三人称文本发送到聊天
// ============================================
import { $, topWindow } from '../core/env.js';
import { getSprite } from '../db/sprites.js';
import { getModalMountRoot } from '../ui/fullscreen.js';
import { getInventoryItems, getSkillItems } from './scene-data.js';
import { escapeHtml, fillActionText, getProtagonistDisplayName, syncSceneModalSkinClass } from './scene-ui-utils.js';

const NPC_MODAL_ID = 'gal-scene-npc-modal';
const NPC_MODAL_STYLE_ID = 'gal-scene-npc-modal-style';

function ensureNpcModalStyle() {
  const mountRoot = getModalMountRoot();
  const doc = mountRoot.ownerDocument || topWindow.document;
  if (doc.getElementById(NPC_MODAL_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = NPC_MODAL_STYLE_ID;
  style.textContent = `
    #${NPC_MODAL_ID} {
      position: fixed; inset: 0; z-index: 100030;
      display: flex; align-items: center; justify-content: center;
      background: rgba(15, 18, 26, 0.55); backdrop-filter: blur(2px);
    }
    #${NPC_MODAL_ID} .gal-npc-panel {
      width: min(560px, 94vw); max-height: 88vh; overflow: hidden;
      display: flex; flex-direction: column;
      background: #fdfbf6; color: #33302b;
      border-radius: 14px; box-shadow: 0 18px 50px rgba(0,0,0,.4);
      border: 1px solid rgba(0,0,0,.08);
    }
    #${NPC_MODAL_ID} .gal-npc-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; border-bottom: 1px solid rgba(0,0,0,.08);
      font-weight: 700; letter-spacing: 1px;
    }
    #${NPC_MODAL_ID} .gal-npc-close {
      background: none; border: none; cursor: pointer; color: #8a8577;
      font-size: 1.1rem; padding: 4px 8px; line-height: 1;
    }
    #${NPC_MODAL_ID} .gal-npc-body { overflow-y: auto; padding: 14px 16px; }
    #${NPC_MODAL_ID} .gal-npc-info { display: flex; gap: 14px; }
    #${NPC_MODAL_ID} .gal-npc-portrait {
      flex: 0 0 120px; width: 120px; height: 168px; border-radius: 10px;
      overflow: hidden; background: rgba(0,0,0,.06);
      display: flex; align-items: center; justify-content: center;
    }
    #${NPC_MODAL_ID} .gal-npc-portrait img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
    #${NPC_MODAL_ID} .gal-npc-portrait .initial {
      font-size: 2.4rem; font-weight: 700; color: #fff;
      width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    }
    #${NPC_MODAL_ID} .gal-npc-fields { flex: 1; min-width: 0; font-size: 0.88rem; line-height: 1.65; }
    #${NPC_MODAL_ID} .gal-npc-kv { display: flex; gap: 8px; margin-bottom: 3px; }
    #${NPC_MODAL_ID} .gal-npc-kv .key { flex: 0 0 4.5em; color: #8a8577; }
    #${NPC_MODAL_ID} .gal-npc-kv .val { flex: 1; word-break: break-word; }
    #${NPC_MODAL_ID} details.gal-npc-past { margin-top: 6px; font-size: 0.85rem; }
    #${NPC_MODAL_ID} details.gal-npc-past summary { cursor: pointer; color: #8a8577; }
    #${NPC_MODAL_ID} .gal-npc-actions {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px;
    }
    #${NPC_MODAL_ID} .gal-npc-action-btn {
      padding: 11px 8px; border-radius: 10px; border: 1px solid rgba(0,0,0,.12);
      background: #fff; cursor: pointer; font-size: 0.92rem; font-weight: 600;
      color: #33302b; transition: all .15s; min-height: 44px;
    }
    #${NPC_MODAL_ID} .gal-npc-action-btn:hover { background: #f0ece1; transform: translateY(-1px); }
    #${NPC_MODAL_ID} .gal-npc-action-btn i { margin-right: 6px; }
    #${NPC_MODAL_ID} .gal-npc-subpanel-title {
      display: flex; align-items: center; gap: 10px; margin-bottom: 12px; font-weight: 700;
    }
    #${NPC_MODAL_ID} .gal-npc-back-btn {
      background: none; border: 1px solid rgba(0,0,0,.15); border-radius: 8px;
      cursor: pointer; padding: 5px 12px; font-size: 0.85rem; color: #6b665a;
    }
    #${NPC_MODAL_ID} .gal-npc-option-list { display: flex; flex-direction: column; gap: 8px; }
    #${NPC_MODAL_ID} .gal-npc-option-btn {
      text-align: left; padding: 11px 14px; border-radius: 10px;
      border: 1px solid rgba(0,0,0,.12); background: #fff; cursor: pointer;
      font-size: 0.9rem; line-height: 1.5; color: #33302b; transition: all .15s; min-height: 44px;
    }
    #${NPC_MODAL_ID} .gal-npc-option-btn:hover { background: #f0ece1; }
    #${NPC_MODAL_ID} .gal-npc-option-btn .sub { display: block; font-size: 0.78rem; color: #8a8577; margin-top: 2px; }
    #${NPC_MODAL_ID} .gal-npc-freeform { display: flex; gap: 8px; margin-top: 12px; }
    #${NPC_MODAL_ID} .gal-npc-freeform input {
      flex: 1; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(0,0,0,.15);
      font-size: 0.9rem; background: #fff; color: #33302b; min-width: 0;
    }
    #${NPC_MODAL_ID} .gal-npc-freeform button {
      padding: 10px 16px; border-radius: 10px; border: none; cursor: pointer;
      background: #7c6e58; color: #fff; font-weight: 600; min-height: 44px;
    }
    #${NPC_MODAL_ID} .gal-npc-empty { color: #8a8577; font-size: 0.88rem; padding: 18px 0; text-align: center; }
    /* 深色皮肤 */
    #${NPC_MODAL_ID}.skin-default-dark .gal-npc-panel,
    #${NPC_MODAL_ID}.skin-persona .gal-npc-panel,
    #${NPC_MODAL_ID}.skin-persona-velvet .gal-npc-panel,
    #${NPC_MODAL_ID}.skin-twilight .gal-npc-panel,
    #${NPC_MODAL_ID}.skin-gilded-twilight .gal-npc-panel,
    #${NPC_MODAL_ID}.skin-dawn-twilight .gal-npc-panel,
    #${NPC_MODAL_ID}.skin-shujian-night .gal-npc-panel {
      background: #262430; color: #e2ddd2; border-color: rgba(255,255,255,.1);
    }
    #${NPC_MODAL_ID}.skin-default-dark .gal-npc-action-btn,
    #${NPC_MODAL_ID}.skin-default-dark .gal-npc-option-btn,
    #${NPC_MODAL_ID}.skin-default-dark .gal-npc-freeform input,
    #${NPC_MODAL_ID}.skin-persona .gal-npc-action-btn,
    #${NPC_MODAL_ID}.skin-persona .gal-npc-option-btn,
    #${NPC_MODAL_ID}.skin-persona .gal-npc-freeform input,
    #${NPC_MODAL_ID}.skin-twilight .gal-npc-action-btn,
    #${NPC_MODAL_ID}.skin-twilight .gal-npc-option-btn,
    #${NPC_MODAL_ID}.skin-twilight .gal-npc-freeform input,
    #${NPC_MODAL_ID}.skin-shujian-night .gal-npc-action-btn,
    #${NPC_MODAL_ID}.skin-shujian-night .gal-npc-option-btn,
    #${NPC_MODAL_ID}.skin-shujian-night .gal-npc-freeform input {
      background: #322f3d; color: #e2ddd2; border-color: rgba(255,255,255,.14);
    }
    #${NPC_MODAL_ID}.skin-default-dark .gal-npc-action-btn:hover,
    #${NPC_MODAL_ID}.skin-default-dark .gal-npc-option-btn:hover { background: #3d3949; }
    @media (max-width: 640px) {
      #${NPC_MODAL_ID} .gal-npc-panel { width: 96vw; max-height: 92vh; }
      #${NPC_MODAL_ID} .gal-npc-actions { grid-template-columns: 1fr; }
      #${NPC_MODAL_ID} .gal-npc-portrait { flex-basis: 96px; width: 96px; height: 134px; }
    }
  `;
  doc.head.appendChild(style);
}

// 按性别选人称代词
function getPronoun(gender) {
  const g = String(gender || '');
  if (/女/.test(g)) return '她';
  if (/男/.test(g)) return '他';
  return 'TA';
}

// 首字头像的确定性底色
function buildInitialAvatarHtml(name) {
  const initial = escapeHtml(String(name || '?').slice(0, 1));
  return `<div class="initial" style="background:linear-gradient(135deg,#9a8b72,#6e6250);">${initial}</div>`;
}

// 信息区 HTML
function buildInfoHtml(npc) {
  const kv = (key, val) =>
    val ? `<div class="gal-npc-kv"><span class="key">${escapeHtml(key)}</span><span class="val">${escapeHtml(val)}</span></div>` : '';
  const past = npc.pastExperience
    ? `<details class="gal-npc-past"><summary>过往经历</summary><div>${escapeHtml(npc.pastExperience)}</div></details>`
    : '';
  return `
    <div class="gal-npc-info">
      <div class="gal-npc-portrait" data-portrait="${escapeHtml(npc.name)}">${buildInitialAvatarHtml(npc.name)}</div>
      <div class="gal-npc-fields">
        ${kv('性别', npc.gender)}
        ${kv('年龄', npc.age)}
        ${kv('介绍', npc.briefIntro)}
        ${kv('身份', npc.identity)}
        ${kv('外貌', npc.appearance)}
        ${kv('穿着', npc.outfit)}
        ${kv('属性', npc.baseAttributes)}
        ${kv('能力', npc.specialAttributes)}
        ${kv('持有', npc.items)}
        ${kv('关系', npc.relation)}
        ${past}
      </div>
    </div>
    <div class="gal-npc-actions">
      <button class="gal-npc-action-btn" data-panel="talk"><i class="fa-solid fa-comments"></i>对话</button>
      <button class="gal-npc-action-btn" data-panel="gift"><i class="fa-solid fa-gift"></i>送礼</button>
      <button class="gal-npc-action-btn" data-panel="skill"><i class="fa-solid fa-wand-sparkles"></i>使用技能</button>
    </div>
  `;
}

// 对话面板：交互选项按钮 + 自由输入兜底
function buildTalkPanelHtml(npc) {
  const optionButtons = (npc.actions || [])
    .map(action => `<button class="gal-npc-option-btn" data-talk-option="${escapeHtml(action)}">${escapeHtml(action)}</button>`)
    .join('');
  const listHtml = optionButtons
    ? `<div class="gal-npc-option-list">${optionButtons}</div>`
    : '<div class="gal-npc-empty">该角色暂无预设交互选项，可直接输入想说的话</div>';
  return `
    <div class="gal-npc-subpanel-title">
      <button class="gal-npc-back-btn" data-back="1"><i class="fa-solid fa-arrow-left"></i> 返回</button>
      <span>与 ${escapeHtml(npc.name)} 对话</span>
    </div>
    ${listHtml}
    <div class="gal-npc-freeform">
      <input type="text" id="gal-npc-talk-input" placeholder="输入想对${escapeHtml(getPronoun(npc.gender))}说的话（留空则上前搭话）" maxlength="200">
      <button id="gal-npc-talk-send"><i class="fa-solid fa-paper-plane"></i></button>
    </div>
  `;
}

// 送礼面板：背包物品列表
function buildGiftPanelHtml(npc, items) {
  const cards = items
    .map(item => {
      const meta = [item.quantity ? `×${item.quantity}` : '', item.category].filter(Boolean).join(' · ');
      const sub = [meta, item.description].filter(Boolean).join(' — ');
      return `<button class="gal-npc-option-btn" data-gift-item="${escapeHtml(item.name)}">
        ${escapeHtml(item.name)}${sub ? `<span class="sub">${escapeHtml(sub)}</span>` : ''}
      </button>`;
    })
    .join('');
  return `
    <div class="gal-npc-subpanel-title">
      <button class="gal-npc-back-btn" data-back="1"><i class="fa-solid fa-arrow-left"></i> 返回</button>
      <span>送给 ${escapeHtml(npc.name)} 的礼物</span>
    </div>
    ${cards ? `<div class="gal-npc-option-list">${cards}</div>` : '<div class="gal-npc-empty">背包空空如也</div>'}
  `;
}

// 技能面板：主角技能列表
function buildSkillPanelHtml(npc, skills) {
  const cards = skills
    .map(skill => {
      const meta = [skill.type, skill.level].filter(Boolean).join(' · ');
      const sub = [meta, skill.description].filter(Boolean).join(' — ');
      return `<button class="gal-npc-option-btn" data-skill-name="${escapeHtml(skill.name)}">
        ${escapeHtml(skill.name)}${sub ? `<span class="sub">${escapeHtml(sub)}</span>` : ''}
      </button>`;
    })
    .join('');
  return `
    <div class="gal-npc-subpanel-title">
      <button class="gal-npc-back-btn" data-back="1"><i class="fa-solid fa-arrow-left"></i> 返回</button>
      <span>对 ${escapeHtml(npc.name)} 使用技能</span>
    </div>
    ${cards ? `<div class="gal-npc-option-list">${cards}</div>` : '<div class="gal-npc-empty">尚未习得任何技能</div>'}
  `;
}

/**
 * 打开 NPC 交互弹窗
 * @param {object} npc scene-data getNpcList 输出的角色对象
 * @param {object} tableData exportTableAsJson 的表格数据（读背包/技能用）
 * @param {object} [opts]
 * @param {function} [opts.onActionSent] 动作发送成功后的回调（用于级联关闭地图）
 */
export function showNpcInteractionModal(npc, tableData, opts = {}) {
  ensureNpcModalStyle();
  const mountRoot = getModalMountRoot();
  $(mountRoot).find(`#${NPC_MODAL_ID}`).remove();

  const html = `
    <div id="${NPC_MODAL_ID}">
      <div class="gal-npc-panel">
        <div class="gal-npc-header">
          <span><i class="fa-solid fa-user"></i> ${escapeHtml(npc.name)}</span>
          <button class="gal-npc-close" title="关闭"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="gal-npc-body" id="gal-npc-body">${buildInfoHtml(npc)}</div>
      </div>
    </div>
  `;
  $(mountRoot).append(html);
  const $modal = $(mountRoot).find(`#${NPC_MODAL_ID}`);
  syncSceneModalSkinClass($modal);

  // 异步填充立绘（含性别路人回退）
  (async () => {
    let url = null;
    try {
      url = await getSprite(npc.name, '默认');
      if (!url) {
        const gender = String(npc.gender || '');
        const fallbackNames = /女/.test(gender)
          ? ['路人女', '路人', '路人男']
          : /男/.test(gender)
            ? ['路人男', '路人', '路人女']
            : ['路人', '路人男', '路人女'];
        for (const fallbackName of fallbackNames) {
          url = await getSprite(fallbackName, '默认');
          if (url) break;
        }
      }
    } catch { /* 忽略 */ }
    if (url) {
      $modal.find('.gal-npc-portrait').html(`<img src="${escapeHtml(url)}" alt="${escapeHtml(npc.name)}">`);
    }
  })();

  const closeModal = () => $modal.remove();
  const protagonist = getProtagonistDisplayName();

  // 填入输入框并级联关闭（让玩家补充内容后自行发送）
  const sendAndClose = text => {
    if (!fillActionText(text)) return;
    closeModal();
    if (typeof opts.onActionSent === 'function') opts.onActionSent();
  };

  const showPanel = panel => {
    const $body = $modal.find('#gal-npc-body');
    if (panel === 'talk') {
      $body.html(buildTalkPanelHtml(npc));
      $body.find('#gal-npc-talk-input').trigger('focus');
    } else if (panel === 'gift') {
      $body.html(buildGiftPanelHtml(npc, getInventoryItems(tableData)));
    } else if (panel === 'skill') {
      $body.html(buildSkillPanelHtml(npc, getSkillItems(tableData)));
    } else {
      $body.html(buildInfoHtml(npc));
    }
  };

  // ===== 事件 =====
  $modal.on('click', function (e) {
    if (e.target === this) closeModal();
  });
  $modal.on('click', '.gal-npc-close', closeModal);
  $modal.on('click', '.gal-npc-action-btn', function () {
    showPanel(String($(this).data('panel') || ''));
  });
  $modal.on('click', '.gal-npc-back-btn', () => showPanel(''));

  // 对话：预设选项
  $modal.on('click', '.gal-npc-option-btn[data-talk-option]', function () {
    const option = String($(this).data('talk-option') || '').trim();
    if (!option) return;
    sendAndClose(`${protagonist}走到${npc.name}身边，${option}。`);
  });

  // 对话：自由输入（回车或按钮发送；留空则泛泛搭话）
  const sendTalkInput = () => {
    const input = String($modal.find('#gal-npc-talk-input').val() || '').trim();
    if (input) {
      sendAndClose(`${protagonist}走到${npc.name}身边，对${getPronoun(npc.gender)}说："${input}"`);
    } else {
      sendAndClose(`${protagonist}走到${npc.name}身边，主动上前搭话。`);
    }
  };
  $modal.on('click', '#gal-npc-talk-send', sendTalkInput);
  $modal.on('keydown', '#gal-npc-talk-input', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendTalkInput();
    }
  });

  // 送礼
  $modal.on('click', '.gal-npc-option-btn[data-gift-item]', function () {
    const item = String($(this).data('gift-item') || '').trim();
    if (!item) return;
    sendAndClose(`${protagonist}从背包中取出「${item}」，将它送给了${npc.name}。`);
  });

  // 使用技能
  $modal.on('click', '.gal-npc-option-btn[data-skill-name]', function () {
    const skill = String($(this).data('skill-name') || '').trim();
    if (!skill) return;
    sendAndClose(`${protagonist}对${npc.name}使用了「${skill}」。`);
  });

  return $modal;
}
