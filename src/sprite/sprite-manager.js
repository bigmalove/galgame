import { SpriteAnimationManager } from '../animation/sprite-animation.js';
import { SCRIPT_NAME } from '../core/constants.js';
import { $, topWindow } from '../core/env.js';
import { getSettings } from '../core/settings.js';
import { hasLive2DModel } from '../db/live2d-models.js';
import { setLive2DCharacterExpression } from '../live2d/expression-motion.js';
import { Live2DManager } from '../live2d/manager.js';
import { updateCharacterFocus } from '../live2d/preload.js';
import { getCharacterUseLive2D } from '../live2d/render-mode.js';

// 延迟引用: getSprite, getBackground, saveBackground, sceneBackgrounds,
//           messageSegmentState, setBackgroundWithTransition, clearBackgroundLayers,
//           BGMManager, showToast
let _getSpriteRef = null;
let _getBackgroundRef = null;
let _getSceneBackgroundsRef = null;
let _getMessageSegmentStateRef = null;
let _setBackgroundWithTransitionRef = null;
let _clearBackgroundLayersRef = null;
let _BGMManagerRef = null;

export function setSpriteManagerRefs({
  getSprite,
  getBackground,
  getSceneBackgrounds,
  getMessageSegmentState,
  setBackgroundWithTransition,
  clearBackgroundLayers,
  BGMManager,
}) {
  if (getSprite) _getSpriteRef = getSprite;
  if (getBackground) _getBackgroundRef = getBackground;
  if (getSceneBackgrounds) _getSceneBackgroundsRef = getSceneBackgrounds;
  if (getMessageSegmentState) _getMessageSegmentStateRef = getMessageSegmentState;
  if (setBackgroundWithTransition) _setBackgroundWithTransitionRef = setBackgroundWithTransition;
  if (clearBackgroundLayers) _clearBackgroundLayersRef = clearBackgroundLayers;
  if (BGMManager) _BGMManagerRef = BGMManager;
}

// ============================================
// 立绘管理器 - 多角色、动画、特效
// ============================================
export const SpriteManager = {
  activeCharacters: new Map(),
  slotOwners: new Map(),
  currentSpeaker: null,
  protagonistName: null,
  speakTick: 0,
  characterQueue: [],
  npcReplaceCursor: 0,
  currentScene: null,
  live2dRenderSeq: new Map(),

  emotionMap: {
    '默认': null,
    '微笑': 'happy',
    '生气': 'angry',
    '难过': 'sad',
    '惊讶': 'surprised',
    '嘲讽': 'mock',
    '害羞': 'shy',
    '思考': 'think',
    '大笑': 'laugh',
    '搞怪': 'happy',
  },

  init() {
    this.protagonistName = this.getProtagonistName();
    SpriteAnimationManager.init();
    console.log(`[${SCRIPT_NAME}] SpriteManager 初始化, 主角: ${this.protagonistName || '未识别'}`);
  },

  getProtagonistName() {
    try {
      const stContext = topWindow.SillyTavern?.getContext?.();
      if (stContext?.name1) {
        console.log(`[${SCRIPT_NAME}] 主角名称来自SillyTavern: ${stContext.name1}`);
        return stContext.name1;
      }

      const api = topWindow.AutoCardUpdaterAPI;
      if (!api || typeof api.exportTableAsJson !== 'function') {
        console.log(`[${SCRIPT_NAME}] AutoCardUpdaterAPI 不可用，无法从数据库读取主角`);
        return null;
      }
      const tableData = api.exportTableAsJson();
      if (!tableData) return null;
      const protagonistSheets = ['主角信息', '主角', '玩家信息', 'User', 'user', '用户'];
      const nameCols = ['人物名称', '姓名', '名字', '角色名', 'name', 'Name'];
      for (const sheetKey of Object.keys(tableData)) {
        if (!sheetKey.startsWith('sheet_')) continue;
        const sheet = tableData[sheetKey];
        const sheetName = sheet?.name || '';
        const content = sheet?.content || [];
        if (!protagonistSheets.includes(sheetName) || content.length < 2) continue;
        const headers = content[0] || [];
        for (const col of nameCols) {
          const idx = headers.indexOf(col);
          if (idx !== -1 && content[1]?.[idx]) {
            const name = content[1][idx].trim();
            console.log(`[${SCRIPT_NAME}] 主角名称来自数据库(${sheetName}): ${name}`);
            return name;
          }
        }
      }
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 获取主角名称失败:`, e);
    }
    console.log(`[${SCRIPT_NAME}] 未能识别主角名称`);
    return null;
  },

  normalizeCharacterId(characterId) {
    return String(characterId || '').trim().toLowerCase();
  },

  normalizeCharacterKey(characterId) {
    return this.normalizeCharacterId(characterId).replace(/[\s\u3000_\-·•.。,:：'"“”‘’`~!@#$%^&*()（）[\]{}<>《》、，!?？]/g, '');
  },

  resolveCharacterId(characterId) {
    const normalized = this.normalizeCharacterId(characterId);
    if (!normalized) return null;
    const normalizedKey = this.normalizeCharacterKey(characterId);
    const ids = Array.from(this.activeCharacters.keys());

    let matched = ids.find(id => this.normalizeCharacterId(id) === normalized);
    if (matched) return matched;

    if (normalizedKey) {
      matched = ids.find(id => this.normalizeCharacterKey(id) === normalizedKey);
      if (matched) return matched;
    }

    return null;
  },

  findCharacterElements(characterId) {
    const normalized = this.normalizeCharacterId(characterId);
    if (!normalized) return $();
    const normalizedKey = this.normalizeCharacterKey(characterId);
    return $('#gal-global-overlay .gal-char-container').filter((_, el) => {
      const raw = String($(el).attr('data-character') || '').trim();
      if (!raw) return false;
      if (this.normalizeCharacterId(raw) === normalized) return true;
      if (normalizedKey && this.normalizeCharacterKey(raw) === normalizedKey) return true;
      return false;
    });
  },

  cleanupCharacterDom(characterId) {
    const $elements = this.findCharacterElements(characterId);
    if ($elements.length) {
      $elements.remove();
    }
    return $elements.length;
  },

  _nextLive2DRenderSeq(characterId) {
    const next = (this.live2dRenderSeq.get(characterId) || 0) + 1;
    this.live2dRenderSeq.set(characterId, next);
    return next;
  },

  _isLatestLive2DTask(characterId, seq) {
    return this.live2dRenderSeq.get(characterId) === seq;
  },

  _clearLive2DRenderSeq(characterId) {
    this.live2dRenderSeq.delete(characterId);
  },

  isProtagonist(characterId) {
    if (!this.protagonistName || !characterId) return false;
    return this.normalizeCharacterId(characterId) === this.normalizeCharacterId(this.protagonistName);
  },

  syncSlotOwners() {
    this.slotOwners.clear();
    this.activeCharacters.forEach((info, charId) => {
      if (info?.slot) {
        this.slotOwners.set(info.slot, charId);
      }
    });
  },

  ensureSlots($overlay) {
    const $charLayer = $overlay?.find('.gal-layer-character');
    if (!$charLayer?.length) return $();
    if (!$charLayer.find('.gal-char-slot.slot-left').length) {
      $charLayer.append('<div class="gal-char-slot slot-left"></div>');
    }
    if (!$charLayer.find('.gal-char-slot.slot-center').length) {
      $charLayer.append('<div class="gal-char-slot slot-center"></div>');
    }
    if (!$charLayer.find('.gal-char-slot.slot-right').length) {
      $charLayer.append('<div class="gal-char-slot slot-right"></div>');
    }
    return $charLayer;
  },

  isCharacterElementValid(info, $overlay) {
    return !!(
      info?.element &&
      info.element.length &&
      info.element[0] &&
      info.element[0].isConnected &&
      (!$overlay?.length || $overlay[0].contains(info.element[0]))
    );
  },

  async rehydrateDisconnectedCharacters($overlay, preferredCharacterId = null, renderToken = null) {
    const entries = Array.from(this.activeCharacters.entries());
    if (preferredCharacterId) {
      entries.sort(([a], [b]) => {
        if (a === preferredCharacterId) return -1;
        if (b === preferredCharacterId) return 1;
        return 0;
      });
    }
    for (const [charId, info] of entries) {
      if (!info?.slot) continue;
      if (this.isCharacterElementValid(info, $overlay)) continue;
      const $relinked = $(
        `#gal-global-overlay .gal-char-slot.slot-${info.slot} .gal-char-container[data-character="${charId}"]`,
      );
      if ($relinked.length) {
        info.element = $relinked;
        continue;
      }
      this.slotOwners.set(info.slot, charId);
      const spriteUrl = _getSpriteRef ? await _getSpriteRef(charId, info.expression || '默认') : null;
      await this.updateCharacterSprite($overlay, charId, info.expression || '默认', spriteUrl, info.slot, false, renderToken);
    }
  },

  getNextNpcReplacementSlot() {
    const slots = ['left', 'right'];
    const slot = slots[this.npcReplaceCursor % slots.length];
    this.npcReplaceCursor = (this.npcReplaceCursor + 1) % slots.length;
    return slot;
  },

  nextSpeakTick() {
    const currentTick = Number.isFinite(this.speakTick) ? this.speakTick : 0;
    this.speakTick = currentTick + 1;
    return this.speakTick;
  },

  getSlotReplacementCandidate(slot, characterId) {
    const ownerId = this.slotOwners.get(slot);
    if (!ownerId || ownerId === characterId) return null;
    const info = this.activeCharacters.get(ownerId);
    return {
      slot,
      ownerId,
      lastSpokenTick: Number.isFinite(info?.lastSpokenTick) ? info.lastSpokenTick : 0,
      joinedTick: Number.isFinite(info?.joinedTick) ? info.joinedTick : 0,
      isProtagonist: this.isProtagonist(ownerId),
      isCurrentSpeaker: ownerId === this.currentSpeaker,
    };
  },

  pickLeastRecentlySpokenSlot(characterId) {
    const allCandidates = ['left', 'center', 'right']
      .map(slot => this.getSlotReplacementCandidate(slot, characterId))
      .filter(Boolean);

    if (allCandidates.length === 0) {
      return 'right';
    }

    // 只固定主角，不参与满槽位替换。
    let candidates = allCandidates.filter(item => !item.isProtagonist);
    if (candidates.length === 0) {
      candidates = allCandidates;
    }

    // 优先不替换当前说话者，避免镜头跳变。
    const nonCurrentSpeaker = candidates.filter(item => !item.isCurrentSpeaker);
    if (nonCurrentSpeaker.length > 0) {
      candidates = nonCurrentSpeaker;
    }

    candidates.sort((a, b) => {
      if (a.lastSpokenTick !== b.lastSpokenTick) return a.lastSpokenTick - b.lastSpokenTick;
      if (a.joinedTick !== b.joinedTick) return a.joinedTick - b.joinedTick;
      return a.slot.localeCompare(b.slot);
    });

    return candidates[0].slot;
  },

  /**
   * 将角色从一个槽位迁移到另一个槽位（DOM + 内部状态）
   */
  relocateCharacterSlot($overlay, characterId, fromSlot, toSlot) {
    const $charLayer = this.ensureSlots($overlay);
    const $fromSlot = $charLayer.find(`.gal-char-slot.slot-${fromSlot}`);
    const $toSlot = $charLayer.find(`.gal-char-slot.slot-${toSlot}`);
    if (!$fromSlot.length || !$toSlot.length) return;

    const $container = $fromSlot.find(`.gal-char-container[data-character="${characterId}"]`);
    if (!$container.length) return;

    // 移动 DOM 元素
    $toSlot.empty().append($container);

    // 更新内部状态
    const info = this.activeCharacters.get(characterId);
    if (info) {
      info.slot = toSlot;
    }
    if (this.slotOwners.get(fromSlot) === characterId) {
      this.slotOwners.delete(fromSlot);
    }
    this.slotOwners.set(toSlot, characterId);

    // Live2D 使用独立舞台，DOM 迁移后需主动刷新槽位绑定
    if ($container.attr('data-live2d') === 'true') {
      const mountEl = $container.find('.gal-live2d-canvas-container')[0];
      if (mountEl && mountEl.isConnected) {
        Promise.resolve(Live2DManager.renderTo(characterId, mountEl)).catch((e) => {
          console.warn(`[${SCRIPT_NAME}] Live2D 槽位迁移同步失败: ${characterId} ${fromSlot} -> ${toSlot}`, e);
        });
      }
    }

    console.log(`[${SCRIPT_NAME}] 槽位迁移: ${characterId} ${fromSlot} -> ${toSlot}`);
  },

  /**
   * 槽位分配策略:
   *   立绘=1 → center
   *   立绘=2 → 中间的迁移到 left，新角色放 right
   *   立绘=3 → left / center / right
   *   超过3人 → 替换最久未发言的非主角角色
   */
  assignSlot(characterId, $overlay) {
    const usedSlots = new Set(this.slotOwners.keys());

    // 主角始终绑定 left
    if (this.isProtagonist(characterId)) {
      // 若当前只有 1 个 NPC 且占据 center，主角入场时将 NPC 挪到 right，形成左右分列
      if (usedSlots.size === 1 && usedSlots.has('center')) {
        const centerCharId = this.slotOwners.get('center');
        if (centerCharId && $overlay) {
          this.relocateCharacterSlot($overlay, centerCharId, 'center', 'right');
        }
      }
      return 'left';
    }

    // 没有任何槽位被占用 → center
    if (usedSlots.size === 0) return 'center';

    // 只有 left 被占用（主角在 left）→ NPC 放 right
    if (usedSlots.size === 1 && usedSlots.has('left')) {
      return 'right';
    }

    // 只有 center 被占用（NPC独占中间）→ 把 center 角色迁移到 left，新角色放 right
    if (usedSlots.size === 1 && usedSlots.has('center')) {
      const centerCharId = this.slotOwners.get('center');
      if (centerCharId && $overlay) {
        this.relocateCharacterSlot($overlay, centerCharId, 'center', 'left');
      }
      return 'right';
    }

    // 有空闲槽位就用
    if (!usedSlots.has('center')) return 'center';
    if (!usedSlots.has('right')) return 'right';
    if (!usedSlots.has('left')) return 'left';

    // 全满时按“最久未发言”替换，主角固定不替换
    return this.pickLeastRecentlySpokenSlot(characterId);
  },

  async removeCharacter(characterId, { animate = true } = {}) {
    const resolvedCharacterId = this.resolveCharacterId(characterId) || characterId;
    const info = this.activeCharacters.get(resolvedCharacterId);
    if (!info) {
      const removedCount = this.cleanupCharacterDom(characterId);
      if (resolvedCharacterId !== characterId) {
        this.cleanupCharacterDom(resolvedCharacterId);
      }
      Live2DManager.releaseCharacter(resolvedCharacterId);
      this._clearLive2DRenderSeq(resolvedCharacterId);
      if (resolvedCharacterId !== characterId) {
        Live2DManager.releaseCharacter(characterId);
        this._clearLive2DRenderSeq(characterId);
      }
      return removedCount > 0;
    }

    let $element = info.element;
    if (!($element?.length && $element[0]?.isConnected) && info.slot) {
      $element = $(`#gal-global-overlay .gal-char-slot.slot-${info.slot} .gal-char-container[data-character="${resolvedCharacterId}"]`);
    }

    const exitClass = info.slot === 'left'
      ? 'exiting-left'
      : info.slot === 'center'
        ? 'exiting-center'
        : 'exiting-right';
    if ($element?.length) {
      if (animate) {
        $element
          .removeClass('speaking silent entering-left entering-center entering-right')
          .addClass(exitClass);
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      $element.remove();
    }
    this.cleanupCharacterDom(resolvedCharacterId);

    Live2DManager.releaseCharacter(resolvedCharacterId);
    SpriteAnimationManager.cleanup(resolvedCharacterId);
    this._clearLive2DRenderSeq(resolvedCharacterId);
    this.activeCharacters.delete(resolvedCharacterId);
    if (this.slotOwners.get(info.slot) === resolvedCharacterId) {
      this.slotOwners.delete(info.slot);
    }
    this.characterQueue = this.characterQueue.filter(id => id !== resolvedCharacterId);
    if (this.currentSpeaker === resolvedCharacterId) {
      this.currentSpeaker = null;
    }

    // 只剩1个角色且不在 center → 迁回 center（主角除外，主角留在 left）
    if (this.activeCharacters.size === 1) {
      const [remainId, remainInfo] = Array.from(this.activeCharacters.entries())[0];
      if (remainInfo?.slot && remainInfo.slot !== 'center' && !this.isProtagonist(remainId)) {
        const $ov = $('#gal-global-overlay');
        if ($ov.length) {
          this.relocateCharacterSlot($ov, remainId, remainInfo.slot, 'center');
        }
      }
    }
    return true;
  },

  async applySpriteCommands($overlay, commands, renderToken = null) {
    if (!Array.isArray(commands) || commands.length === 0) return;
    for (const command of commands) {
      const action = String(command?.action || '').trim().toLowerCase();
      if (action !== 'exit') continue;

      const rawCharacter = String(command?.character || '').trim();
      if (!rawCharacter) continue;

      const targetCharacter = this.resolveCharacterId(rawCharacter) || rawCharacter;
      const removed = await this.removeCharacter(targetCharacter, { animate: true });
      if (!removed && targetCharacter !== rawCharacter) {
        await this.removeCharacter(rawCharacter, { animate: false });
      }
    }
  },

  async updateSprite($overlay, characterId, expression, renderToken = null) {
    this.ensureSlots($overlay);
    this.syncSlotOwners();
    if (!characterId) {
      this.setSpeaker(null);
      return;
    }

    const normalizedId = this.normalizeCharacterId(characterId);
    const existingSameCharacter = Array.from(this.activeCharacters.keys()).find(
      id => this.normalizeCharacterId(id) === normalizedId,
    );
    if (existingSameCharacter) {
      characterId = existingSameCharacter;
    }
    await this.rehydrateDisconnectedCharacters($overlay, characterId, renderToken);
    const spriteUrl = _getSpriteRef ? await _getSpriteRef(characterId, expression) : null;
    const useLive2DForCurrent = getCharacterUseLive2D(characterId);
    const hasLive2DForCurrent = useLive2DForCurrent ? await hasLive2DModel(characterId) : false;
    const canRenderVisualForCurrent = !!(hasLive2DForCurrent || spriteUrl);
    const shouldShowMissingPlaceholder = !!getSettings().showMissingSpritePlaceholder;
    if (!canRenderVisualForCurrent && !shouldShowMissingPlaceholder) {
      if (this.activeCharacters.has(characterId)) {
        await this.removeCharacter(characterId, { animate: false });
      }
      this.setSpeaker(null);
      return;
    }
    let slot = null;
    let isNewCharacter = false;

    if (this.activeCharacters.has(characterId)) {
      const info = this.activeCharacters.get(characterId);
      if (!Number.isFinite(info.joinedTick)) {
        info.joinedTick = Number.isFinite(this.speakTick) ? this.speakTick : 0;
      }
      if (!Number.isFinite(info.lastSpokenTick)) {
        info.lastSpokenTick = 0;
      }
      const prevSlot = info.slot;
      slot = prevSlot;
      if (this.isProtagonist(characterId) && slot !== 'left') {
        this.slotOwners.delete(prevSlot);
        slot = 'left';
        info.slot = slot;
      }
      this.slotOwners.set(slot, characterId);
      const isElementValid = this.isCharacterElementValid(info, $overlay);
      const useLive2D = getCharacterUseLive2D(characterId);
      const hasLive2D = useLive2D ? await hasLive2DModel(characterId) : false;
      const hasRenderedLive2D = Live2DManager.containers.has(characterId);
      const isExistingLive2D = isElementValid && info?.element?.attr('data-live2d') === 'true';
      const renderModeChanged = hasLive2D !== (isExistingLive2D || hasRenderedLive2D);

      if (!isElementValid) {
        info.expression = expression;
        await this.updateCharacterSprite($overlay, characterId, expression, spriteUrl, slot, false, renderToken);
      } else if (info.expression !== expression || renderModeChanged) {
        info.expression = expression;
        await this.updateCharacterSprite($overlay, characterId, expression, spriteUrl, slot, false, renderToken);
      }
    } else {
      isNewCharacter = true;
      slot = this.assignSlot(characterId, $overlay);
      const joinedTick = this.nextSpeakTick();
      this.characterQueue.push(characterId);
      this.activeCharacters.set(characterId, {
        slot,
        expression,
        element: null,
        joinedTick,
        lastSpokenTick: 0,
      });
      this.slotOwners.set(slot, characterId);
      await this.updateCharacterSprite($overlay, characterId, expression, spriteUrl, slot, true, renderToken);
    }

    this.setSpeaker(characterId);
    this.applyEmotionEffect(characterId, expression);
  },

  async updateCharacterSprite($overlay, characterId, expression, spriteUrl, slot, isEntering, renderToken = null) {
    const $charLayer = this.ensureSlots($overlay);
    let $slot = $charLayer.find(`.gal-char-slot.slot-${slot}`);
    if (!$slot.length) {
      $slot = $(`<div class="gal-char-slot slot-${slot}"></div>`);
      $charLayer.append($slot);
    }

    const oldCharIdInSlot = this.slotOwners.get(slot);
    if (oldCharIdInSlot && oldCharIdInSlot !== characterId) {
      const oldInfo = this.activeCharacters.get(oldCharIdInSlot);
      if (oldInfo?.slot === slot) {
        if (oldInfo?.element) {
          oldInfo.element.remove();
        }
        Live2DManager.releaseCharacter(oldCharIdInSlot);
        SpriteAnimationManager.cleanup(oldCharIdInSlot);
        this._clearLive2DRenderSeq(oldCharIdInSlot);
        this.activeCharacters.delete(oldCharIdInSlot);
        this.characterQueue = this.characterQueue.filter(id => id !== oldCharIdInSlot);
      } else {
        $slot.find('.gal-char-container').remove();
        this.slotOwners.delete(slot);
      }
    }
    this.slotOwners.set(slot, characterId);

    const useGSAP = SpriteAnimationManager.gsap !== null;
    const enterClass = (!useGSAP && isEntering) ? `entering-${slot}` : '';
    const emotion = this.emotionMap[expression] || '';
    const emotionAttr = emotion ? `data-emotion="${emotion}"` : '';

    const useLive2D = getCharacterUseLive2D(characterId);
    const hasLive2D = useLive2D ? await hasLive2DModel(characterId) : false;
    if (!hasLive2D) {
      this._clearLive2DRenderSeq(characterId);
    }

    const $existingContainer = $slot.find('.gal-char-container[data-character="' + characterId + '"]');
    const hasRenderedLive2D = Live2DManager.containers.has(characterId);
    if (!hasLive2D && hasRenderedLive2D) {
      Live2DManager.releaseCharacter(characterId);
    }
    const isExistingLive2D = hasLive2D && $existingContainer.length > 0 && $existingContainer.attr('data-live2d') === 'true';

    if (isExistingLive2D && hasRenderedLive2D && !isEntering) {
      $existingContainer.attr('data-expression', expression);
      if (emotionAttr) {
        $existingContainer.attr('data-emotion', emotion);
      }
      setLive2DCharacterExpression(characterId, expression, true);
      console.log(`[${SCRIPT_NAME}] Live2D 表情更新: ${characterId} -> ${expression}`);

      const info = this.activeCharacters.get(characterId);
      if (info) {
        info.element = $existingContainer;
      }
      return;
    }

    let spriteHtml;
    if (hasLive2D) {
      spriteHtml = `
      <div class="gal-char-container ${enterClass}" data-character="${characterId}" data-expression="${expression}" ${emotionAttr} data-live2d="true" style="width: 100%; height: 100%; max-height: none;">
        <div class="gal-live2d-canvas-container" style="width: 100%; height: 100%; position: relative;"></div>
      </div>
    `;
    } else if (spriteUrl) {
      spriteHtml = `
      <div class="gal-char-container ${enterClass}" data-character="${characterId}" data-expression="${expression}" ${emotionAttr}>
        <img class="gal-char-img" src="${spriteUrl}" alt="${characterId}">
      </div>
    `;
    } else if (getSettings().showMissingSpritePlaceholder) {
      spriteHtml = `
      <div class="gal-char-container ${enterClass}" data-character="${characterId}" data-expression="${expression}" ${emotionAttr}>
        <div class="gal-char-placeholder" title="点击上传立绘">
          <i class="fa-solid fa-user-plus"></i>
          <span>添加立绘</span>
        </div>
      </div>
    `;
    } else {
      spriteHtml = `
      <div class="gal-char-container ${enterClass}" data-character="${characterId}" data-expression="${expression}" ${emotionAttr}></div>
    `;
    }
    $slot.html(spriteHtml);

    if (hasLive2D) {
      const $container = $slot.find('.gal-live2d-canvas-container');
      const taskSeq = this._nextLive2DRenderSeq(characterId);
      const messageSegmentState = _getMessageSegmentStateRef ? _getMessageSegmentStateRef() : null;
      const isTaskStale = () => {
        if (!this._isLatestLive2DTask(characterId, taskSeq)) return true;
        if (renderToken === null) return false;
        const mesId = $('#gal-global-overlay .gal-game-container').attr('data-mes-id');
        if (mesId === undefined || mesId === null || mesId === '') return false;
        const latestState = messageSegmentState ? messageSegmentState.get(String(mesId)) : null;
        if (!latestState) return false;
        return renderToken !== (Number(latestState?.renderToken) || 0);
      };
      if ($container.length) {
        (async () => {
          try {
            if (isTaskStale()) return;
            if (this.slotOwners.get(slot) !== characterId) return;
            if (!$container[0]?.isConnected) return;
            const model = await Live2DManager.loadModel(characterId);
            if (isTaskStale()) return;
            if (this.slotOwners.get(slot) !== characterId) return;
            if (!$container[0]?.isConnected) return;
            if (model && $container.length) {
              const rendered = await Live2DManager.renderTo(characterId, $container[0]);
              if (!rendered || isTaskStale()) return;
              if (this.slotOwners.get(slot) !== characterId) return;
              if (!$container[0]?.isConnected) return;
              setLive2DCharacterExpression(characterId, expression, true);
              Live2DManager.setFocus(characterId, this.currentSpeaker === characterId);
              console.log(`[${SCRIPT_NAME}] Live2D 渲染成功: ${characterId}`);
            }
          } catch (e) {
            console.error(`[${SCRIPT_NAME}] Live2D 渲染失败:`, e);
            if (!$container[0]?.isConnected || isTaskStale()) return;
            $container.html(`
              <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999;">
                <i class="fa-solid fa-cube" style="font-size: 2rem;"></i>
              </div>
            `);
          }
        })();
      }
    }

    const info = this.activeCharacters.get(characterId);
    if (info) {
      info.element = $slot.find('.gal-char-container');
    }

    if (useGSAP && info && info.element) {
      info.element.addClass('gsap-animated');
      if (isEntering) {
        SpriteAnimationManager.playEnterAnimation(info.element, slot, characterId);
      } else {
        SpriteAnimationManager.playExpressionTransition(info.element, () => {
          SpriteAnimationManager.startBreathing(info.element, characterId);
        });
      }
    } else if (!useGSAP && isEntering) {
      setTimeout(() => {
        $slot.find('.gal-char-container').removeClass(enterClass);
      }, 500);
    }
  },

  setSpeaker(speakerId) {
    let resolvedSpeakerId = speakerId;
    if (speakerId !== null) {
      resolvedSpeakerId = this.resolveCharacterId(speakerId) || speakerId;
      const speakerInfo = this.activeCharacters.get(resolvedSpeakerId);
      if (speakerInfo) {
        const tick = this.nextSpeakTick();
        speakerInfo.lastSpokenTick = tick;
        if (!Number.isFinite(speakerInfo.joinedTick)) {
          speakerInfo.joinedTick = tick;
        }
      }
    }

    this.currentSpeaker = resolvedSpeakerId;
    this.activeCharacters.forEach((info, charId) => {
      let $element = info.element;
      const isConnected = !!($element && $element.length && $element[0] && $element[0].isConnected);
      if (!isConnected && info?.slot) {
        const $relinked = $(
          `#gal-global-overlay .gal-char-slot.slot-${info.slot} .gal-char-container[data-character="${charId}"]`,
        );
        if ($relinked.length) {
          info.element = $relinked;
          $element = $relinked;
        }
      }
      if ($element && $element.length) {
        $element
          .removeClass('exiting-left exiting-center exiting-right')
          .css({ display: '', visibility: 'visible' });
        const isSpeaking = resolvedSpeakerId !== null && charId === resolvedSpeakerId;
        SpriteAnimationManager.setFocus($element, isSpeaking, charId);
        updateCharacterFocus(charId, isSpeaking);
        if (resolvedSpeakerId === null) {
          $element.removeClass('speaking').addClass('silent');
        } else if (charId === resolvedSpeakerId) {
          $element.removeClass('silent').addClass('speaking');
        } else {
          $element.removeClass('speaking').addClass('silent');
        }
      }
    });
  },

  applyEmotionEffect(characterId, expression) {
    const info = this.activeCharacters.get(characterId);
    if (!info || !info.element) return;
    const emotion = this.emotionMap[expression] || '';
    info.element.removeAttr('data-emotion');
    if (emotion) {
      info.element.attr('data-emotion', emotion);
      SpriteAnimationManager.playEmotionAnimation(info.element, emotion, characterId);
    }
  },

  findBestMatchScene(sceneName) {
    const sceneBackgrounds = _getSceneBackgroundsRef ? _getSceneBackgroundsRef() : null;
    if (!sceneName) return null;
    if (sceneBackgrounds && sceneBackgrounds.has(sceneName)) return sceneName;

    let bestMatch = null;
    let maxLength = 0;
    const scenes = sceneBackgrounds ? Array.from(sceneBackgrounds.keys()) : [];
    const cleanName = sceneName.replace(/\s*[\(（].*?[\)）]/g, '').trim();
    for (const knownScene of scenes) {
      const cleanKnown = knownScene.replace(/\s*[\(（].*?[\)）]/g, '').trim();
      if (cleanName && cleanKnown && cleanName === cleanKnown) {
        return knownScene;
      }
      if (knownScene.includes(sceneName) || sceneName.includes(knownScene)) {
        const len = Math.min(knownScene.length, sceneName.length);
        if (len > maxLength) {
          maxLength = len;
          bestMatch = knownScene;
        }
      }
    }
    return bestMatch || sceneName;
  },

  async applySceneTint($overlay, scene) {
    const originalScene = scene;
    if (scene) {
      scene = this.findBestMatchScene(scene);
      if (originalScene !== scene) {
        console.log(`[${SCRIPT_NAME}] [自动修正] 场景幻觉修正: "${originalScene}" -> "${scene}"`);
      }
    }
    if (this.currentScene === scene) return;
    this.currentScene = scene;
    const $charLayer = $overlay.find('.gal-layer-character');
    const $bgLayer = $overlay.find('.gal-layer-bg');
    $charLayer.removeClass('scene-night scene-indoor scene-outdoor');

    if (!scene) {
      $bgLayer.removeClass('has-bg generating-bg');
      $bgLayer.find('.gal-gen-indicator').remove();
      if (_clearBackgroundLayersRef) _clearBackgroundLayersRef($bgLayer);
      return;
    }

    console.log(`[${SCRIPT_NAME}] [DEBUG] applySceneTint 被调用，场景: "${scene}" (len=${scene.length})`);
    const bgUrl = _getBackgroundRef ? await _getBackgroundRef(scene) : null;
    console.log(`[${SCRIPT_NAME}] [DEBUG] getBackground 返回: ${bgUrl ? '有图片URL' : 'null/undefined'}`);

    if (bgUrl) {
      $bgLayer.addClass('has-bg').removeClass('generating-bg');
      if (_setBackgroundWithTransitionRef) _setBackgroundWithTransitionRef($bgLayer, bgUrl);
      console.log(`[${SCRIPT_NAME}] 应用背景成功: ${scene}, URL: ${bgUrl.substring(0, 50)}...`);
    } else {
      const BGMManagerLocal = _BGMManagerRef;
      if (BGMManagerLocal && BGMManagerLocal.generatingScenes.has(scene)) {
        $bgLayer.removeClass('has-bg').addClass('generating-bg');
        if (_clearBackgroundLayersRef) _clearBackgroundLayersRef($bgLayer);
      } else {
        $bgLayer.removeClass('has-bg generating-bg');
        $bgLayer.find('.gal-gen-indicator').remove();
        if (_clearBackgroundLayersRef) _clearBackgroundLayersRef($bgLayer);
      }
    }

    const sceneLower = scene.toLowerCase();
    if (sceneLower.includes('夜') || sceneLower.includes('night') || sceneLower.includes('晚')) {
      $charLayer.addClass('scene-night');
    } else if (
      sceneLower.includes('室内') ||
      sceneLower.includes('indoor') ||
      sceneLower.includes('房间') ||
      sceneLower.includes('屋')
    ) {
      $charLayer.addClass('scene-indoor');
    }
  },

  clearAll($overlay) {
    for (const charId of this.activeCharacters.keys()) {
      Live2DManager.cleanup(charId);
      SpriteAnimationManager.cleanup(charId);
      this._clearLive2DRenderSeq(charId);
    }
    this.activeCharacters.clear();
    this.live2dRenderSeq.clear();
    this.slotOwners.clear();
    this.characterQueue = [];
    this.npcReplaceCursor = 0;
    this.speakTick = 0;
    this.currentSpeaker = null;
    this.currentScene = null;
    if ($overlay) {
      $overlay
        .find('.gal-layer-character')
        .html('<div class="gal-char-slot slot-left"></div><div class="gal-char-slot slot-center"></div><div class="gal-char-slot slot-right"></div>');
    }
  },

  reset($overlay) {
    this.clearAll($overlay);
  },
};
