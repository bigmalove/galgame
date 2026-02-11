import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow, $ } from '../core/env.js';
import { SpriteAnimationManager } from '../animation/sprite-animation.js';
import { Live2DManager } from '../live2d/manager.js';
import { getCharacterUseLive2D } from '../live2d/render-mode.js';
import { hasLive2DModel } from '../db/live2d-models.js';
import { updateCharacterFocus } from '../live2d/preload.js';

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
  characterQueue: [],
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

  assignSlot(characterId) {
    if (this.isProtagonist(characterId)) {
      return 'left';
    }
    const usedSlots = new Set(this.slotOwners.keys());
    if (!usedSlots.has('right')) return 'right';
    if (!usedSlots.has('left')) return 'left';
    return null;
  },

  removeOldestNonProtagonist() {
    for (let i = 0; i < this.characterQueue.length; i++) {
      const charId = this.characterQueue[i];
      if (!this.isProtagonist(charId) && this.activeCharacters.has(charId)) {
        const info = this.activeCharacters.get(charId);
        const exitClass = info.slot === 'left' ? 'exiting-left' : 'exiting-right';
        if (info.element) {
          info.element
            .removeClass('speaking silent entering-left entering-center entering-right')
            .addClass(exitClass);
          setTimeout(() => {
            info.element.remove();
            Live2DManager.releaseCharacter(charId);
            SpriteAnimationManager.cleanup(charId);
            this._clearLive2DRenderSeq(charId);
          }, 400);
        }
        this.activeCharacters.delete(charId);
        this.slotOwners.delete(info.slot);
        this.characterQueue.splice(i, 1);
        return info.slot;
      }
    }
    return 'center';
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
    let slot = null;
    let isNewCharacter = false;

    if (this.activeCharacters.has(characterId)) {
      const info = this.activeCharacters.get(characterId);
      slot = info.slot;
      this.slotOwners.set(slot, characterId);
      const isElementValid = this.isCharacterElementValid(info, $overlay);

      if (!isElementValid) {
        info.expression = expression;
        await this.updateCharacterSprite($overlay, characterId, expression, spriteUrl, slot, false, renderToken);
      } else if (info.expression !== expression) {
        info.expression = expression;
        await this.updateCharacterSprite($overlay, characterId, expression, spriteUrl, slot, false, renderToken);
      }
    } else {
      isNewCharacter = true;
      slot = this.assignSlot(characterId);
      if (!slot) {
        slot = this.removeOldestNonProtagonist();
      }
      this.characterQueue.push(characterId);
      this.activeCharacters.set(characterId, {
        slot,
        expression,
        element: null,
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
    const isExistingLive2D = hasLive2D && $existingContainer.length > 0 && $existingContainer.attr('data-live2d') === 'true';

    if (isExistingLive2D && !isEntering) {
      $existingContainer.attr('data-expression', expression);
      if (emotionAttr) {
        $existingContainer.attr('data-emotion', emotion);
      }
      Live2DManager.setExpression(characterId, expression);
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
    } else {
      spriteHtml = `
      <div class="gal-char-container ${enterClass}" data-character="${characterId}" data-expression="${expression}" ${emotionAttr}>
        <div class="gal-char-placeholder" title="点击上传立绘">
          <i class="fa-solid fa-user-plus"></i>
          <span>添加立绘</span>
        </div>
      </div>
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
        const latestState = messageSegmentState ? messageSegmentState.get(String(mesId)) : null;
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
              Live2DManager.setExpression(characterId, expression);
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
    this.currentSpeaker = speakerId;
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
          .removeClass('exiting-left exiting-right')
          .css({ display: '', visibility: 'visible' });
        const isSpeaking = speakerId !== null && charId === speakerId;
        SpriteAnimationManager.setFocus($element, isSpeaking, charId);
        updateCharacterFocus(charId, isSpeaking);
        if (speakerId === null) {
          $element.removeClass('speaking').addClass('silent');
        } else if (charId === speakerId) {
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
    this.currentSpeaker = null;
    this.currentScene = null;
    if ($overlay) {
      $overlay
        .find('.gal-layer-character')
        .html('<div class="gal-char-slot slot-left"></div><div class="gal-char-slot slot-right"></div>');
    }
  },

  reset($overlay) {
    this.clearAll($overlay);
  },
};
