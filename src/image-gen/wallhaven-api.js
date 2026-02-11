import { SCRIPT_NAME } from '../core/constants.js';
import { getSettings } from '../core/settings.js';

// ============================================
// Wallhaven API (壁纸搜索)
// ============================================
export const WallhavenAPI = {
  baseUrl: 'https://wallhaven.cc/api/v1',
  cache: new Map(),
  lastRequestTime: 0,
  minRequestInterval: 1400,

  getSettings() {
    const settings = getSettings();
    return settings.wallhaven || {};
  },

  buildSearchQuery(tags, options = {}) {
    const ws = this.getSettings();
    let queryParts = [];

    if (ws.customTags && ws.customTags.length > 0) {
      ws.customTags.slice(0, 3).forEach(tag => queryParts.push(`+${tag}`));
    }

    if (tags && tags.length > 0) {
      let filteredTags = tags
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0 && t.length < 15)
        .slice(0, 4);

      const similarTags = {
        'study': ['library', 'book', 'bookshelf'],
        'library': ['study', 'book'],
        'bedroom': ['room', 'bed'],
        'room': ['interior', 'indoors'],
        'interior': ['room', 'indoors'],
      };

      filteredTags = filteredTags.filter((tag, index) => {
        for (let i = 0; i < index; i++) {
          const prevTag = filteredTags[i];
          if (tag === prevTag) return false;
          if (similarTags[prevTag]?.includes(tag)) return false;
          if (similarTags[tag]?.includes(prevTag)) return false;
        }
        return true;
      });

      if (filteredTags.length > 0) {
        queryParts.push(`+${filteredTags[0]}`);
        if (filteredTags.length > 1) {
          queryParts.push(`+${filteredTags[1]}`);
        }
        if (filteredTags.length > 2) {
          queryParts.push(...filteredTags.slice(2));
        }
      }
    }

    if (!ws.cgMode) {
      queryParts.push('-girl', '-people', '-person');
    }

    const categoryMap = {
      anime: '010',
      general: '100',
      people: '001',
      all: '111',
    };

    const purityMap = {
      sfw: '100',
      sketchy: '110',
    };

    const params = {
      q: queryParts.join(' '),
      categories: categoryMap[ws.category] || '010',
      purity: purityMap[ws.purity] || '100',
      sorting: options.sorting || 'favorites',
      order: 'desc',
      apikey: ws.apiKey || undefined,
    };

    if (params.sorting === 'toplist') {
      params.topRange = options.topRange || '1M';
    }

    return params;
  },

  async throttle() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minRequestInterval) {
      await new Promise(r => setTimeout(r, this.minRequestInterval - elapsed));
    }
    this.lastRequestTime = Date.now();
  },

  async search(tags) {
    const ws = this.getSettings();
    if (!ws.enabled) return null;

    const cleanTags = tags
      .map(t => t.trim())
      .filter(t => t && t.length > 0 && t.length < 30);

    if (cleanTags.length === 0) {
      console.warn(`[${SCRIPT_NAME}] Wallhaven: 没有有效的搜索标签`);
      return null;
    }

    const userSorting = ws.sorting || 'favorites';
    const topRange = ws.topRange || '1M';

    let result = await this._doSearch(cleanTags, { sorting: userSorting, topRange });
    if (result) return result;

    if (cleanTags.length > 3) {
      console.log(`[${SCRIPT_NAME}] Wallhaven: 简化标签重试...`);
      result = await this._doSearch(cleanTags.slice(0, 3), { sorting: 'random' });
      if (result) return result;
    }

    if (cleanTags.length > 0) {
      console.log(`[${SCRIPT_NAME}] Wallhaven: 使用最简标签重试...`);
      const minimalTags = [cleanTags[0], 'scenery'];
      result = await this._doSearch(minimalTags, { sorting: 'random' });
      if (result) return result;
    }

    if (cleanTags.length > 0) {
      console.log(`[${SCRIPT_NAME}] Wallhaven: 使用单标签重试...`);
      result = await this._doSearch([cleanTags[0]], { sorting: 'random' });
      if (result) return result;
    }

    console.warn(`[${SCRIPT_NAME}] Wallhaven: 所有搜索尝试均未找到匹配图片`);
    return null;
  },

  async _doSearch(tags, options = {}) {
    const params = this.buildSearchQuery(tags, options);
    const cacheKey = JSON.stringify(params);

    if (this.cache.has(cacheKey)) {
      console.log(`[${SCRIPT_NAME}] Wallhaven: 使用缓存结果`);
      return this.selectImage(this.cache.get(cacheKey));
    }

    await this.throttle();

    try {
      const queryString = Object.entries(params)
        .filter(([k, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
        .join('&');

      const apiUrl = `${this.baseUrl}/search?${queryString}`;
      console.log(`[${SCRIPT_NAME}] Wallhaven: 搜索 ${apiUrl}`);

      let response = null;

      try {
        response = await fetch(apiUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.data && data.data.length > 0) {
            if (this.cache.size >= 20) this.cache.delete(this.cache.keys().next().value);
            this.cache.set(cacheKey, data.data);
            return this.selectImage(data.data);
          }
        }
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] Wallhaven: 直接请求失败，尝试备用方案`);
      }

      if (typeof SillyTavern !== 'undefined' && SillyTavern.get) {
        try {
          const proxyData = await SillyTavern.get(apiUrl);
          if (proxyData && proxyData.data && proxyData.data.length > 0) {
            if (this.cache.size >= 20) this.cache.delete(this.cache.keys().next().value);
            this.cache.set(cacheKey, proxyData.data);
            return this.selectImage(proxyData.data);
          }
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] Wallhaven: 代理请求失败`, e);
        }
      }

      const corsProxies = [
        `https://api.allorigins.win/get?url=${encodeURIComponent(apiUrl)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(apiUrl)}`,
        `https://thingproxy.freeboard.io/fetch/${apiUrl}`,
      ];

      for (const proxyUrl of corsProxies) {
        try {
          console.log(`[${SCRIPT_NAME}] Wallhaven: 尝试代理 ${proxyUrl.substring(0, 50)}...`);
          response = await fetch(proxyUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
          });
          if (response.ok) {
            const data = await response.json();
            if (data.data && data.data.length > 0) {
              if (this.cache.size >= 20) this.cache.delete(this.cache.keys().next().value);
              this.cache.set(cacheKey, data.data);
              return this.selectImage(data.data);
            }
          }
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] Wallhaven: 代理失败`, e.message);
          continue;
        }
      }

      console.error(`[${SCRIPT_NAME}] Wallhaven 搜索失败: 所有请求方式均失败`);
      return null;
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] Wallhaven 搜索失败:`, e);
      return null;
    }
  },

  selectImage(results) {
    if (!results || results.length === 0) return null;
    const top = results.slice(0, Math.min(10, results.length));
    const selected = top[Math.floor(Math.random() * top.length)];
    console.log(`[${SCRIPT_NAME}] Wallhaven: 选中图片 ${selected.id}, 收藏: ${selected.favorites}`);
    return selected.path;
  },

  clearCache() {
    this.cache.clear();
  },
};
