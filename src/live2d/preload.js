import { SCRIPT_NAME } from '../core/constants.js';
import { Live2DManager } from './manager.js';
import { setLive2DCharacterExpression } from './expression-motion.js';
import { getCharacterUseLive2D } from './render-mode.js';
import { hasLive2DModel } from '../db/live2d-models.js';
import { SpriteAnimationManager } from '../animation/sprite-animation.js';
import { getAllCharacterNameKeywords, resolveCharacterIdByKeywords } from '../utils/character-name-keywords.js';

function resolveLive2DCharacterId(characterId) {
  const rawCharacterId = String(characterId || '').trim();
  if (!rawCharacterId) return '';
  const candidateIds = Array.from(new Set([
    ...Object.keys(getAllCharacterNameKeywords()),
    ...Array.from(Live2DManager.models.keys()),
    rawCharacterId,
  ]));
  return resolveCharacterIdByKeywords(rawCharacterId, candidateIds) || rawCharacterId;
}

// ============================================
// Live2D 预加载管理器（SDK + 模型预热）
// ============================================
export const Live2DPreloadManager = {
  sdkPreloadStarted: false,
  sdkPreloadDone: false,
  queue: [],
  queuedSet: new Set(),
  preloadedSet: new Set(),
  failedUntil: new Map(),
  failureCooldownMs: 60 * 1000,
  workerPromise: null,
  lookAheadLimit: 60,

  scheduleSdkPreload(reason = 'unknown') {
    if (this.sdkPreloadStarted || this.sdkPreloadDone) return;
    this.sdkPreloadStarted = true;

    const run = async () => {
      try {
        const ok = await Live2DManager.init();
        this.sdkPreloadDone = !!ok;
        console.log(`[${SCRIPT_NAME}] Live2D 预加载 SDK 完成: ${ok ? '成功' : '失败'} (${reason})`);
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] Live2D 预加载 SDK 失败 (${reason}):`, e);
      }
    };

    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
    if (typeof _topWindow.requestIdleCallback === 'function') {
      _topWindow.requestIdleCallback(() => { run(); }, { timeout: 2000 });
    } else {
      setTimeout(() => { run(); }, 300);
    }
  },

  enqueueCharacter(characterId, reason = 'unknown') {
    const resolvedCharacterId = resolveLive2DCharacterId(characterId);
    if (!resolvedCharacterId) return;
    if (this.preloadedSet.has(resolvedCharacterId)) return;
    if (Live2DManager.models.has(resolvedCharacterId)) {
      this.preloadedSet.add(resolvedCharacterId);
      return;
    }
    const until = this.failedUntil.get(resolvedCharacterId);
    if (until && Date.now() < until) return;
    if (until) this.failedUntil.delete(resolvedCharacterId);
    if (this.queuedSet.has(resolvedCharacterId)) return;
    this.queue.push({ characterId: resolvedCharacterId, reason });
    this.queuedSet.add(resolvedCharacterId);
    this._ensureWorker();
  },

  preloadFromSegments(segments, currentIndex = 0, reason = 'segments') {
    if (!Array.isArray(segments) || segments.length === 0) return;
    const start = Math.max(0, Number(currentIndex) || 0);
    const end = Math.min(segments.length, start + this.lookAheadLimit + 1);
    const seen = new Set();
    for (let i = start; i < end; i++) {
      const speaker = segments[i]?.speaker;
      if (!speaker || seen.has(speaker)) continue;
      seen.add(speaker);
      this.enqueueCharacter(speaker, `${reason}@${i}`);
    }
  },

  _ensureWorker() {
    if (this.workerPromise) return;
    this.workerPromise = (async () => {
      while (this.queue.length > 0) {
        const item = this.queue.shift();
        if (!item?.characterId) continue;
        const { characterId, reason } = item;
        this.queuedSet.delete(characterId);

        try {
          if (this.preloadedSet.has(characterId) || Live2DManager.models.has(characterId)) {
            this.preloadedSet.add(characterId);
            continue;
          }
          if (!getCharacterUseLive2D(characterId)) {
            continue;
          }
          const hasModel = await hasLive2DModel(characterId);
          if (!hasModel) {
            continue;
          }
          const model = await Live2DManager.loadModel(characterId, false);
          if (model) {
            this.failedUntil.delete(characterId);
            this.preloadedSet.add(characterId);
            console.log(`[${SCRIPT_NAME}] Live2D 预加载模型成功: ${characterId} (${reason})`);
          } else {
            this.failedUntil.set(characterId, Date.now() + this.failureCooldownMs);
          }
        } catch (e) {
          this.failedUntil.set(characterId, Date.now() + this.failureCooldownMs);
          console.warn(`[${SCRIPT_NAME}] Live2D 预加载模型失败: ${characterId} (${reason})`, e);
        }
      }
    })().finally(() => {
      this.workerPromise = null;
      if (this.queue.length > 0) {
        this._ensureWorker();
      }
    });
  },
};

// 统一渲染入口：根据设置选择 Live2D 或静态立绘
export async function renderCharacterVisual(characterId, expression, container, options = {}) {
  const resolvedCharacterId = resolveLive2DCharacterId(characterId);
  const useLive2D = getCharacterUseLive2D(resolvedCharacterId);
  const hasModel = await hasLive2DModel(resolvedCharacterId);

  if (useLive2D && hasModel) {
    try {
      const model = await Live2DManager.loadModel(resolvedCharacterId);
      if (model) {
        Live2DManager.renderTo(resolvedCharacterId, container);
        setLive2DCharacterExpression(resolvedCharacterId, expression, true);
        console.log(`[${SCRIPT_NAME}] 使用 Live2D 渲染: ${resolvedCharacterId}`);
        return { mode: 'live2d', success: true };
      }
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] Live2D 渲染失败，降级到静态立绘:`, e);
    }
  }

  return { mode: 'static', success: true };
}

// 更新角色焦点状态
export function updateCharacterFocus(characterId, isSpeaking) {
  const resolvedCharacterId = resolveLive2DCharacterId(characterId);
  const useLive2D = getCharacterUseLive2D(resolvedCharacterId);

  if (useLive2D && Live2DManager.models.has(resolvedCharacterId)) {
    Live2DManager.setFocus(resolvedCharacterId, isSpeaking);
  }
}

// 清理角色视觉资源
export function cleanupCharacterVisual(characterId) {
  const resolvedCharacterId = resolveLive2DCharacterId(characterId);
  if (Live2DManager.models.has(resolvedCharacterId)) {
    Live2DManager.cleanup(resolvedCharacterId);
  }
  SpriteAnimationManager.cleanup(resolvedCharacterId || characterId);
}

// 清理所有视觉资源
export function cleanupAllVisuals() {
  Live2DManager.cleanupAll();
  SpriteAnimationManager.cleanupAll();
}
