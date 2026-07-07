// ============================================
// GSAP 立绘动画管理器
// ============================================
import { getSettings } from '../core/settings.js';

export const SpriteAnimationManager = {
  animations: new Map(),
  gsap: null,
  isLoading: false,
  loadPromise: null,

  loadGSAP() {
    if (this.gsap) return Promise.resolve(this.gsap);
    if (this.loadPromise) return this.loadPromise;

    this.isLoading = true;
    this.loadPromise = new Promise((resolve) => {
      if (window.gsap) {
        this.gsap = window.gsap;
        this.isLoading = false;
        console.log('[SpriteAnimationManager] 检测到GSAP:', this.gsap.version);
        resolve(this.gsap);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';
      script.onload = () => {
        this.gsap = window.gsap;
        this.isLoading = false;
        console.log('[SpriteAnimationManager] GSAP动态加载成功:', this.gsap.version);
        resolve(this.gsap);
      };
      script.onerror = () => {
        console.warn('[SpriteAnimationManager] GSAP CDN加载失败，使用CSS降级');
        this.isLoading = false;
        this.loadPromise = null;
        resolve(null);
      };
      document.head.appendChild(script);
    });
    return this.loadPromise;
  },

  init() {
    this.gsap = window.gsap || (typeof gsap !== 'undefined' ? gsap : null);
    if (!this.gsap) {
      console.log('[SpriteAnimationManager] GSAP未预装，正在从CDN加载...');
      this.loadGSAP();
      return false;
    }
    console.log('[SpriteAnimationManager] GSAP动画管理器已初始化:', this.gsap.version);
    return true;
  },

  startBreathing(element, characterId) {
    if (!this.gsap || !element) return;
    this.stopBreathing(characterId);
    const el = element instanceof jQuery ? element[0] : element;
    const randomDelay = Math.random() * 0.5;
    const tl = this.gsap.timeline({ repeat: -1, yoyo: true });
    tl.to(el, {
      y: -3, scaleY: 1.008, scaleX: 0.998, rotation: 0.3,
      duration: 2 + Math.random() * 0.5, ease: "sine.inOut", delay: randomDelay
    }).to(el, {
      y: 0, scaleY: 1, scaleX: 1, rotation: -0.2,
      duration: 2 + Math.random() * 0.5, ease: "sine.inOut"
    });
    this.animations.set(characterId, { ...(this.animations.get(characterId) || {}), breathing: tl });
  },

  stopBreathing(characterId) {
    const anims = this.animations.get(characterId);
    if (anims?.breathing) { anims.breathing.kill(); anims.breathing = null; }
  },

  playExpressionTransition(element, callback) {
    if (!this.gsap || !element) { callback?.(); return; }
    const el = element instanceof jQuery ? element[0] : element;
    const tl = this.gsap.timeline({ onComplete: callback });
    tl.to(el, { scale: 1.02, filter: "brightness(1.15)", duration: 0.1, ease: "power2.out" })
      .to(el, { scale: 1, filter: "brightness(1)", duration: 0.25, ease: "elastic.out(1, 0.5)" });
  },

  playEmotionAnimation(element, emotion, characterId) {
    if (!this.gsap || !element) return;
    const el = element instanceof jQuery ? element[0] : element;
    const anims = this.animations.get(characterId);
    if (anims?.emotion) { anims.emotion.kill(); }
    let emotionTl;
    switch(emotion) {
      case 'happy':
        emotionTl = this.gsap.timeline();
        emotionTl.to(el, { y: -15, duration: 0.15, ease: "power2.out" })
          .to(el, { y: 0, duration: 0.3, ease: "bounce.out" })
          .to(el, { scale: 1.03, duration: 0.1 }, 0)
          .to(el, { scale: 1, duration: 0.2 }, 0.25);
        break;
      case 'angry':
        emotionTl = this.gsap.timeline();
        emotionTl.to(el, { x: -5, duration: 0.05 }).to(el, { x: 5, duration: 0.05 })
          .to(el, { x: -4, duration: 0.05 }).to(el, { x: 4, duration: 0.05 })
          .to(el, { x: -2, duration: 0.05 }).to(el, { x: 0, duration: 0.05 })
          .to(el, { filter: "saturate(1.2) brightness(1.05)", duration: 0.1 }, 0)
          .to(el, { filter: "saturate(1) brightness(1)", duration: 0.3 }, 0.3);
        break;
      case 'sad':
        emotionTl = this.gsap.timeline();
        emotionTl.to(el, { y: 8, scale: 0.98, duration: 0.4, ease: "power2.out" })
          .to(el, { rotation: -1, duration: 0.8, ease: "sine.inOut" })
          .to(el, { rotation: 1, duration: 0.8, ease: "sine.inOut" })
          .to(el, { y: 0, scale: 1, rotation: 0, duration: 0.5, ease: "power2.out" });
        break;
      case 'surprised':
        emotionTl = this.gsap.timeline();
        emotionTl.to(el, { y: -10, scale: 1.08, duration: 0.12, ease: "power3.out" })
          .to(el, { y: 0, scale: 1, duration: 0.4, ease: "elastic.out(1, 0.4)" });
        break;
      case 'shy':
        emotionTl = this.gsap.timeline();
        emotionTl.to(el, { scale: 0.96, rotation: -3, duration: 0.2, ease: "power2.out" })
          .to(el, { rotation: 2, duration: 0.3, ease: "sine.inOut" })
          .to(el, { rotation: -1, duration: 0.25, ease: "sine.inOut" })
          .to(el, { scale: 1, rotation: 0, duration: 0.3, ease: "power2.out" });
        break;
      case 'think':
        emotionTl = this.gsap.timeline();
        emotionTl.to(el, { rotation: 5, y: -5, duration: 0.4, ease: "power2.out" })
          .to(el, { y: -3, duration: 0.6, ease: "sine.inOut", yoyo: true, repeat: 1 })
          .to(el, { rotation: 0, y: 0, duration: 0.3, ease: "power2.out" });
        break;
      case 'laugh':
        emotionTl = this.gsap.timeline();
        emotionTl.to(el, { scale: 1.05, duration: 0.1 })
          .to(el, { y: -3, duration: 0.08, yoyo: true, repeat: 5, ease: "none" })
          .to(el, { scale: 1, y: 0, duration: 0.2, ease: "power2.out" });
        break;
      case 'mock':
        emotionTl = this.gsap.timeline();
        emotionTl.to(el, { scaleX: 1.03, rotation: -2, duration: 0.15 })
          .to(el, { rotation: 2, duration: 0.2, ease: "sine.inOut" })
          .to(el, { rotation: -1, duration: 0.15, ease: "sine.inOut" })
          .to(el, { scaleX: 1, rotation: 0, duration: 0.2, ease: "power2.out" });
        break;
      default: return;
    }
    this.animations.set(characterId, { ...(this.animations.get(characterId) || {}), emotion: emotionTl });
  },

  playEnterAnimation(element, direction, characterId, callback) {
    if (!this.gsap || !element) { callback?.(); return; }
    const el = element instanceof jQuery ? element[0] : element;
    const startX = direction === 'left' ? -150 : direction === 'right' ? 150 : 0;
    const startY = direction === 'center' ? 50 : 0;
    this.gsap.set(el, { x: startX, y: startY, opacity: 0, scale: 0.9 });
    const tl = this.gsap.timeline({
      onComplete: () => { this.startBreathing(el, characterId); callback?.(); }
    });
    tl.to(el, { x: 0, y: 0, opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.2)" })
      .to(el, { y: 3, duration: 0.08, ease: "power2.in" })
      .to(el, { y: 0, duration: 0.15, ease: "power2.out" });
  },

  playExitAnimation(element, direction, characterId, callback) {
    if (!this.gsap || !element) { callback?.(); return; }
    const el = element instanceof jQuery ? element[0] : element;
    this.stopBreathing(characterId);
    const endX = direction === 'left' ? -150 : 150;
    this.gsap.to(el, { x: endX, opacity: 0, scale: 0.85, duration: 0.4, ease: "power2.in", onComplete: callback });
  },

  setFocus(element, isSpeaking, characterId) {
    if (!this.gsap || !element) return;
    const el = element instanceof jQuery ? element[0] : element;
    // 景深聚焦（可在设置中开关/调节模糊强度）：关闭时退回单纯压暗
    let focusEnabled = true;
    let focusBlur = 1;
    try {
      const s = getSettings();
      focusEnabled = s.speakerFocus !== false;
      const parsed = Number(s.speakerFocusBlur);
      focusBlur = Number.isFinite(parsed) ? Math.max(0, parsed) : 1;
    } catch (e) { /* 设置不可用时用默认值 */ }
    if (isSpeaking) {
      this.gsap.to(el, { filter: "brightness(1.05) saturate(1) blur(0px)", scale: 1.02, opacity: 1, duration: 0.35, ease: "power2.out" });
    } else if (focusEnabled) {
      this.gsap.to(el, { filter: `brightness(0.7) saturate(0.85) blur(${focusBlur}px)`, scale: 0.98, opacity: 0.9, duration: 0.35, ease: "power2.out" });
    } else {
      this.gsap.to(el, { filter: "brightness(0.7) saturate(1) blur(0px)", scale: 0.98, opacity: 0.9, duration: 0.35, ease: "power2.out" });
    }
  },

  cleanup(characterId) {
    const anims = this.animations.get(characterId);
    if (anims) {
      anims.breathing?.kill(); anims.emotion?.kill(); anims.transition?.kill();
      this.animations.delete(characterId);
    }
  },

  cleanupAll() { this.animations.forEach((_, id) => this.cleanup(id)); this.animations.clear(); }
};
