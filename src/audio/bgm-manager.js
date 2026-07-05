import { SCRIPT_NAME, SCRIPT_ID } from '../core/constants.js';
import { getSettings } from '../core/settings.js';

// 延迟引用: showToast (来自 UI 层)
let _showToastRef = null;
export function setBGMManagerRefs({ showToast }) {
  if (showToast) _showToastRef = showToast;
}

// ============================================
// BGM 管理器 (背景音乐搜索 & 播放)
// ============================================
export const BGMManager = {
  audio: new Audio(),
  currentKeyword: null,
  pendingKeyword: null,
  currentTrack: null,
  cache: new Map(),
  isLoaded: false,
  volume: 0.5,
  isPlaying: false,
  userPaused: false,

  generatingScenes: new Set(),

  async init() {
    const savedVol = localStorage.getItem(`${SCRIPT_ID}_bgm_volume`);
    if (savedVol !== null) {
      this.volume = parseFloat(savedVol);
      this.audio.volume = this.volume;
    }
    const savedPaused = localStorage.getItem(`${SCRIPT_ID}_bgm_user_paused`);
    if (savedPaused !== null) {
      this.userPaused = savedPaused === '1';
    }

    if (!globalThis.Music) {
      await this.loadExternalScript('https://drive.baibai.cv/f/ZKEBuW/Music.js');
    }
    this.isLoaded = true;
    console.log(`[${SCRIPT_NAME}] BGMManager 初始化完成`);

    this.audio.addEventListener('ended', () => {
      this.audio.currentTime = 0;
      this.audio.play().catch(e => console.warn('BGM Replay failed:', e));
    });
    this.audio.addEventListener('error', e => {
      console.error('BGM Error:', e);
      if (_showToastRef) _showToastRef('BGM播放出错');
      this.isPlaying = false;
      this.updateUI();
    });
  },

  loadExternalScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  },

  async play(keyword) {
    if (!this.isLoaded || !keyword) return;
    if (getSettings().bgmEnabled === false) return;

    if (this.userPaused) {
      this.pendingKeyword = keyword;
      console.log(`[${SCRIPT_NAME}] BGM被用户暂停，跳过播放: ${keyword}`);
      return;
    }
    if (this.currentKeyword === keyword && this.isPlaying) return;

    let searchQuery = keyword;
    if (!/ost|bgm|piano|orchestra/i.test(searchQuery)) {
      searchQuery += ' OST';
    }
    console.log(`[${SCRIPT_NAME}] BGM 搜索: ${searchQuery}`);
    this.currentKeyword = keyword;

    let track = this.cache.get(searchQuery);
    if (!track) {
      if (_showToastRef) _showToastRef(`正在搜索BGM: ${keyword}...`);
      try {
        track = await globalThis.Music.SearchMusic(searchQuery);
      } catch (e) {
        console.error('Music.SearchMusic error:', e);
      }
      if (track && track.Url) {
        if (this.cache.size >= 20) this.cache.delete(this.cache.keys().next().value);
        this.cache.set(searchQuery, track);
      } else {
        if (_showToastRef) _showToastRef(`未找到BGM: ${keyword}`);
        return;
      }
    }
    if (track && track.Url) {
      this.currentTrack = track;
      this.audio.src = track.Url;
      this.audio.volume = this.volume;
      try {
        await this.audio.play();
        this.isPlaying = true;
        console.log(`[${SCRIPT_NAME}] Current Track:`, track);
        if (_showToastRef) _showToastRef(`播放BGM: ${track.Name || track.name || keyword}`);
      } catch (e) {
        console.warn('播放失败（可能是需要交互）:', e);
        this.isPlaying = false;
      }
      this.updateUI();
    }
  },

  pause() {
    this.audio.pause();
    this.isPlaying = false;
    this.userPaused = true;
    localStorage.setItem(`${SCRIPT_ID}_bgm_user_paused`, '1');
    this.updateUI();
  },

  // 设置层禁用 BGM 时调用：停止播放并清空待播队列（不写入 userPaused）
  stopForDisabled() {
    this.audio.pause();
    if (this.audio.src) {
      this.audio.currentTime = 0;
    }
    this.isPlaying = false;
    this.pendingKeyword = null;
    this.currentKeyword = null;
    this.updateUI();
  },

  resume() {
    this.userPaused = false;
    localStorage.setItem(`${SCRIPT_ID}_bgm_user_paused`, '0');
    if (this.pendingKeyword) {
      const keyword = this.pendingKeyword;
      this.pendingKeyword = null;
      this.play(keyword);
      return;
    }
    if (this.audio.src) {
      this.audio.play().catch(e => console.error(e));
      this.isPlaying = true;
    }
    this.updateUI();
  },

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    this.audio.volume = this.volume;
    localStorage.setItem(`${SCRIPT_ID}_bgm_volume`, this.volume);
  },

  // UI 更新回调 (将被 overwrite)
  updateUI() {},
};
