// 在线演示的「酒馆宿主」：模拟 SillyTavern + 酒馆助手 + 数据库插件对插件暴露的最小接口，
// 然后原样加载插件构建产物（galgame-plugin.js，与 dist 同一份源码、同一套 esbuild 配置）。
// 插件自己的初始化 / 消息处理 / 渲染管线全部真实运行；这里只负责：
//   1. 准备素材：把内置日式学园图包写进 IndexedDB（等同于在插件里点「一键导入」+ 套用立绘模板）
//   2. 扮演酒馆：维护 chat 数组与 #chat 楼层 DOM，发出 MESSAGE_RECEIVED / GENERATION_ENDED 等事件
//   3. 扮演 AI：用户发送后，按预置剧本（story.js）"生成"下一条回复
//   4. 扮演数据库插件：通过 AutoCardUpdaterAPI 提供全局数据表、总结表与选项表
import { initDB } from '../../src/db/init.js';
import { saveBackgroundsBatch } from '../../src/db/backgrounds.js';
import { saveSpritesBatch } from '../../src/db/sprites.js';
import { DEFAULT_PACK_ID, SCRIPT_ID } from '../../src/core/constants.js';
import { USER_NAME, CHAR_NAME, SPRITE_TEMPLATES, NODES, resolveNextNode, renderNode } from './story.js';

const $ = window.jQuery;
const JP_PACK = __DEMO_JP_PACK__; // 构建时从 src/ui/builtin-bg-packs.js 读取，保持与插件内置图包同版本
const CDN_HOSTS = ['https://cdn.jsdelivr.net', 'https://gcore.jsdelivr.net'];
const CHAR_SLOT_KEY = `${CHAR_NAME}::slot::0`;
const DEMO_DEFAULTS_KEY = 'galgame-demo_defaults_v1';
const PLUGIN_SRC = `galgame-plugin.js?v=${__DEMO_BUILD_ID__}`;
const GENERATE_DELAY_MS = 1100;
const OPTIONS_DELAY_MS = 700;

const log = (...args) => console.log('[demo-host]', ...args);

// ============================================
// 1. 本地设置：演示用的固定项（TTS/BGM/地图依赖外部服务，演示中关闭）
// ============================================
function prepareLocalSettings() {
  const key = `${SCRIPT_ID}_settings`;
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(key) || '{}') || {};
  } catch (_) {
    saved = {};
  }
  const params = new URLSearchParams(location.search);
  // 首次进入时的演示默认值（之后用户在设置面板里的改动会保留）：
  // 立绘间距默认 20% 时三槽位总宽超出画面，两侧角色会被裁掉一半，演示里收窄到 2%；同屏特效放宽到 3 个
  const firstRun = localStorage.getItem(DEMO_DEFAULTS_KEY) ? {} : { spriteSpacing: 2, effectsMaxActive: 3 };
  localStorage.setItem(DEMO_DEFAULTS_KEY, '1');
  const forced = {
    ttsEnabled: false,
    bgmEnabled: false,
    mapSystemEnabled: false,
    autoSpriteAssignEnabled: false,
    enhancedMode: { enabled: false },
    // 角色卡自带的标题画面配置：插件首次读卡后会以「角色主键」存进本地设置，这里直接给出该状态
    titleScreenByChar: { [CHAR_SLOT_KEY]: getCardTitleScreen() },
  };
  if (params.get('skin')) forced.skin = params.get('skin');
  localStorage.setItem(key, JSON.stringify(Object.assign({}, saved, firstRun, forced)));
  localStorage.setItem(`${SCRIPT_ID}_char_enabled`, JSON.stringify({ [CHAR_SLOT_KEY]: true }));
  localStorage.setItem(`${SCRIPT_ID}_setup_wizard_optout`, '1');
}

// ============================================
// 2. 素材：内置日式学园图包（背景 + 路人剪影）与立绘模板
// ============================================
function packUrl(hostIndex, relPath) {
  return `${CDN_HOSTS[hostIndex]}/gh/${JP_PACK.repo}@${JP_PACK.tag}/${relPath.split('/').map(encodeURIComponent).join('/')}`;
}

async function fetchManifest() {
  let lastError = null;
  for (let i = 0; i < CDN_HOSTS.length; i++) {
    try {
      const res = await fetch(packUrl(i, 'remote_assets.json'));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const manifest = await res.json();
      const fix = url => (i === 0 ? url : String(url || '').replace('://cdn.jsdelivr.net/', '://gcore.jsdelivr.net/'));
      return { manifest, fix };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`图包清单获取失败：${lastError?.message || lastError}`);
}

async function prepareAssets() {
  await initDB();
  const { manifest, fix } = await fetchManifest();
  const backgrounds = manifest.backgrounds
    .map(bg => ({ sceneName: String(bg.sceneName || '').trim(), imageBlob: null, imageUrl: fix(bg.url || bg.imageUrl) }))
    .filter(bg => bg.sceneName && bg.imageUrl);
  await saveBackgroundsBatch(backgrounds, DEFAULT_PACK_ID);
  getCardTitleScreen().backgroundUrl = backgrounds.find(bg => bg.sceneName === '樱花道')?.imageUrl || '';

  const sprites = Array.isArray(manifest.sprites) ? manifest.sprites : [];
  const records = [];
  for (const sp of sprites) {
    const record = { expression: String(sp.expression || '').trim(), imageBlob: null, imageUrl: fix(sp.url || sp.imageUrl) };
    if (!record.expression || !record.imageUrl) continue;
    if (sp.template !== true) {
      records.push({ ...record, characterId: sp.characterId });
      continue;
    }
    for (const { character, template } of SPRITE_TEMPLATES) {
      if (sp.characterId === template) records.push({ ...record, characterId: character });
    }
  }
  await saveSpritesBatch(records, DEFAULT_PACK_ID);
  log(`素材就绪：${backgrounds.length} 个背景，${records.length} 张立绘`);
}

// ============================================
// 3. 酒馆：chat 数组、楼层 DOM、事件总线
// ============================================
const listeners = new Map();
const tavern_events = {
  MESSAGE_SENT: 'message_sent',
  MESSAGE_RECEIVED: 'message_received',
  MESSAGE_EDITED: 'message_edited',
  MESSAGE_DELETED: 'message_deleted',
  CHARACTER_MESSAGE_RENDERED: 'character_message_rendered',
  USER_MESSAGE_RENDERED: 'user_message_rendered',
  GENERATION_STARTED: 'generation_started',
  GENERATION_ENDED: 'generation_ended',
  GENERATION_STOPPED: 'generation_stopped',
  CHAT_CHANGED: 'chat_id_changed',
};

function eventOn(name, fn) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(fn);
  return { stop: () => listeners.get(name)?.delete(fn) };
}

function eventOnce(name, fn) {
  const sub = eventOn(name, (...args) => {
    sub.stop();
    fn(...args);
  });
  return sub;
}

async function eventEmit(name, ...args) {
  for (const fn of [...(listeners.get(name) || [])]) {
    try {
      await fn(...args);
    } catch (error) {
      console.error('[demo-host] 事件回调出错', name, error);
    }
  }
}

const characterCard = {
  name: CHAR_NAME,
  avatar: 'yuzu.png',
  description: '放学路上总会追上来的学妹。',
  data: {
    name: CHAR_NAME,
    // 角色卡内置的插件配置：标题画面（卡作者在卡里携带的真实用法）
    extensions: {
      galgame_ui_plugin: {
        titleScreen: {
          enabled: true,
          titleText: '樱落之时',
          subtitleText: 'Galgame 界面插件 · 在线演示',
          backgroundSource: 'url',
          backgroundUrl: '',
          backgroundFit: 'cover',
          enableBackdropMask: true,
        },
      },
    },
  },
};

function getCardTitleScreen() {
  return characterCard.data.extensions.galgame_ui_plugin.titleScreen;
}

const chat = [];
const characterVariables = {};

const context = {
  chat,
  characters: [characterCard],
  characterId: '0',
  name1: USER_NAME,
  name2: CHAR_NAME,
  chatMetadata: {},
  groupId: null,
  getCurrentChatId: () => 'demo-chat',
  getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
  saveChat: async () => {},
  saveMetadata: async () => {},
  eventSource: { on: eventOn, once: eventOnce, emit: eventEmit },
  event_types: tavern_events,
};
context.getContext = () => context;

function toChatMessage(index, includeSwipes) {
  const msg = chat[index];
  if (!msg) return null;
  const base = {
    message_id: index,
    name: msg.name,
    role: msg.is_user ? 'user' : 'assistant',
    is_hidden: false,
    data: {},
    extra: msg.extra,
  };
  if (includeSwipes) return { ...base, swipe_id: 0, swipes: [msg.mes], swipes_data: [{}], swipes_info: [{}] };
  return { ...base, message: msg.mes };
}

function resolveMessageRange(range) {
  const last = chat.length - 1;
  if (typeof range === 'number') {
    const id = range < 0 ? last + 1 + range : Math.min(range, last);
    return id >= 0 ? [id, id] : [];
  }
  const m = String(range ?? '').match(/^(-?\d+)(?:-(-?\d+))?$/);
  if (!m) return [];
  const norm = v => (v < 0 ? last + 1 + v : Math.min(v, last));
  return [norm(Number(m[1])), norm(Number(m[2] ?? m[1]))];
}

function getChatMessages(range, options = {}) {
  const [start, end] = resolveMessageRange(range);
  if (start === undefined) return [];
  const out = [];
  for (let i = start; i <= end; i++) {
    const msg = toChatMessage(i, !!options.include_swipes);
    if (!msg) continue;
    if (options.role && options.role !== 'all' && msg.role !== options.role) continue;
    out.push(msg);
  }
  return out;
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// 楼层正文：酒馆会把 AI 原文渲染成 HTML；插件优先读 chat 原文，这里给一份去标签的可读文本兜底
function renderMesText(msg) {
  const plain = String(msg.mes || '')
    .replace(/<styled\b[^>]*>([\s\S]*?)<\/styled>/gi, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  return plain
    .split('\n')
    .map(line => `<p>${escapeHtml(line)}</p>`)
    .join('');
}

function renderMesNode(index) {
  const msg = chat[index];
  return $(`
    <div class="mes" mesid="${index}" ch_name="${escapeHtml(msg.name)}" is_user="${msg.is_user ? 'true' : 'false'}" is_system="false">
      <div class="mes_block">
        <div class="ch_name"><span class="name_text">${escapeHtml(msg.name)}</span></div>
        <div class="mes_text">${renderMesText(msg)}</div>
      </div>
    </div>`);
}

function appendMessage(msg) {
  chat.push(msg);
  const index = chat.length - 1;
  $('#chat > .mes').removeClass('last_mes');
  const $node = renderMesNode(index).addClass('last_mes');
  // 插件的覆盖层也挂在 #chat 里，楼层插在它前面，与酒馆中的 DOM 顺序一致
  const $overlay = $('#chat > #gal-global-overlay');
  if ($overlay.length) $node.insertBefore($overlay);
  else $('#chat').append($node);
  return index;
}

function removeLastMessage() {
  const index = chat.length - 1;
  if (index < 0) return null;
  const [msg] = chat.splice(index, 1);
  $(`#chat > .mes[mesid="${index}"]`).remove();
  $('#chat > .mes').last().addClass('last_mes');
  return msg;
}

// ============================================
// 4. 数据库插件：全局数据表（当前地点 / 时间）、总结表（剧情回顾）与选项表
//    前两张表由聊天记录推导：数据库插件同样是在每条 AI 回复后更新表格
// ============================================
let currentOptions = [];

function setOptions(options) {
  currentOptions = Array.isArray(options) ? options : [];
}

function storyNodesInChat() {
  return chat.filter(msg => !msg.is_user && msg.extra?.demoNode).map(msg => NODES[msg.extra.demoNode.id]).filter(Boolean);
}

const AutoCardUpdaterAPI = {
  exportTableAsJson() {
    const nodes = storyNodesInChat();
    const current = [...nodes].reverse().find(node => node.location) || {};
    const tables = {
      sheet_global_data: {
        uid: 'sheet_global_data',
        name: '全局数据表',
        content: [['当前详细地点', '当前时间'], [current.location || '', current.time || '']],
      },
      sheet_demo_summary: {
        name: '总结表',
        content: [['编号', '时间跨度', '纪要'], ...nodes.filter(node => node.summary).map((node, i) => [String(i + 1), node.time || '', node.summary])],
      },
    };
    if (currentOptions.length) {
      tables.sheet_demo_options = {
        name: '选项表',
        content: [['选项内容', '选项值'], ...currentOptions.map(([text]) => [text, text])],
      };
    }
    return tables;
  },
};

// ============================================
// 5. AI：按剧本"生成"回复
// ============================================
let generating = false;
let lastRoute = '';

function buildAiMessage(node) {
  return {
    name: CHAR_NAME,
    is_user: false,
    is_system: false,
    send_date: new Date().toISOString(),
    mes: renderNode(node.id, node.params),
    swipes: null,
    extra: { demoNode: node },
  };
}

function nodeOptions(node) {
  return NODES[node.id]?.options || null;
}

async function deliverAiMessage(node, { optionsOverride } = {}) {
  const msg = buildAiMessage(node);
  msg.swipes = [msg.mes];
  const index = appendMessage(msg);
  await eventEmit(tavern_events.MESSAGE_RECEIVED, index, 'normal');
  await eventEmit(tavern_events.CHARACTER_MESSAGE_RENDERED, index, 'normal');
  generating = false;
  context.generating = false;
  await eventEmit(tavern_events.GENERATION_ENDED, index);
  if (['riverbank', 'festival', 'store'].includes(node.id)) lastRoute = node.id;
  setTimeout(() => setOptions(optionsOverride || nodeOptions(node) || []), OPTIONS_DELAY_MS);
}

function parseUserChoice(text) {
  return String(text || '')
    .replace(/<user>/gi, '')
    .replace(/[。.\s]+$/, '')
    .trim();
}

async function handleSend() {
  const $input = $('#send_textarea');
  const raw = String($input.val() || '').trim();
  if (!raw || generating) return;
  $input.val('');

  const choice = parseUserChoice(raw);
  const picked = currentOptions.find(([text]) => text === choice);
  const previousOptions = currentOptions;
  setOptions([]);

  appendMessage({ name: USER_NAME, is_user: true, is_system: false, send_date: new Date().toISOString(), mes: choice, extra: {} });
  await eventEmit(tavern_events.MESSAGE_SENT, chat.length - 1);
  await eventEmit(tavern_events.USER_MESSAGE_RENDERED, chat.length - 1);

  const next = picked ? resolveNextNode(picked[1], { lastRoute }) : { id: 'freeform', params: { input: choice } };
  if (next?.id === 'restart') {
    setTimeout(restartDemo, 400);
    return;
  }
  generating = true;
  context.generating = true;
  await eventEmit(tavern_events.GENERATION_STARTED, 'normal');
  setTimeout(() => {
    deliverAiMessage(next, { optionsOverride: next.id === 'freeform' ? previousOptions : null });
  }, GENERATE_DELAY_MS);
}

// 重新生成（插件「重绘」按钮会点击酒馆的 #option_regenerate）：删掉最后一条 AI 回复再按同一节点重新"生成"
async function handleRegenerate() {
  if (generating) return;
  const last = chat[chat.length - 1];
  const node = last && !last.is_user ? last.extra?.demoNode : null;
  if (!node) return;
  removeLastMessage();
  setOptions([]);
  generating = true;
  context.generating = true;
  await eventEmit(tavern_events.GENERATION_STARTED, 'regenerate');
  setTimeout(() => deliverAiMessage(node), GENERATE_DELAY_MS);
}

function appendGreeting() {
  const greeting = { id: 'greeting', params: {} };
  const msg = buildAiMessage(greeting);
  msg.swipes = [msg.mes];
  appendMessage(msg);
  setOptions(nodeOptions(greeting));
}

// 重新开始：整页重载（模块状态、阅读进度、标题画面全部回到初始），素材已在 IndexedDB 中，二次加载很快
function restartDemo() {
  location.reload();
}

// ============================================
// 6. 全局接口（酒馆 / 酒馆助手在 iframe 里注入给脚本的那一套，演示只实现插件用到的部分）
// ============================================
// 酒馆后端：演示页没有酒馆服务器，插件探测的酒馆文件 / 接口（如小白X TTS 配置）一律按「不存在」应答
function installTavernServerStub() {
  const nativeFetch = window.fetch.bind(window);
  const isTavernEndpoint = url => {
    try {
      const { origin, pathname } = new URL(url, location.href);
      return origin === location.origin && /^\/(user\/files|api|csrf-token)\b/.test(pathname);
    } catch (_) {
      return false;
    }
  };
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || String(input);
    if (isTavernEndpoint(url)) return Promise.resolve(new Response('Not Found', { status: 404, statusText: 'Not Found' }));
    return nativeFetch(input, init);
  };
}

function installHostGlobals() {
  installTavernServerStub();
  const worldbooks = new Map();
  Object.assign(window, {
    SillyTavern: context,
    this_chid: '0',
    tavern_events,
    eventOn,
    eventOnce,
    eventEmit,
    eventMakeLast: eventOn,
    getChatMessages,
    getLastMessageId: () => chat.length - 1,
    getVariables: () => characterVariables,
    replaceVariables: vars => Object.assign(characterVariables, vars),
    TavernHelper: { getCharacter: () => characterCard },
    AutoCardUpdaterAPI,
    toastr: ['info', 'success', 'warning', 'error'].reduce((acc, level) => {
      acc[level] = msg => log(`toastr.${level}:`, msg);
      return acc;
    }, { clear() {} }),
    // 世界书：插件会把 COT 规则写进专用世界书，演示中只在内存里保存
    getWorldbookNames: () => [...worldbooks.keys()],
    getGlobalWorldbookNames: () => [],
    rebindGlobalWorldbooks: async () => {},
    getCharWorldbookNames: () => ({ primary: null, additional: [] }),
    rebindCharWorldbooks: async () => {},
    getWorldbook: async name => structuredClone(worldbooks.get(name) || []),
    createWorldbook: async name => { if (!worldbooks.has(name)) worldbooks.set(name, []); return true; },
    createOrReplaceWorldbook: async (name, entries = []) => { worldbooks.set(name, structuredClone(entries)); return true; },
    replaceWorldbook: async (name, entries = []) => { worldbooks.set(name, structuredClone(entries)); },
    createWorldbookEntries: async (name, entries = []) => { worldbooks.set(name, [...(worldbooks.get(name) || []), ...structuredClone(entries)]); },
    updateWorldbookWith: async (name, updater) => { worldbooks.set(name, await updater(structuredClone(worldbooks.get(name) || []))); },
    deleteWorldbook: async name => worldbooks.delete(name),
  });
}

// ============================================
// 7. 页面外壳：顶栏的皮肤切换走插件真实设置面板（打开 → 改下拉框 → 关闭）
// ============================================
async function waitFor(check, timeout = 8000, interval = 50) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = check();
    if (value) return value;
    await new Promise(r => setTimeout(r, interval));
  }
  return null;
}

async function withSettingsPanel(fn) {
  const $menuBtn = $(`#${SCRIPT_ID}-btn`);
  if (!$menuBtn.length) return null;
  document.documentElement.classList.add('demo-silent-panel');
  try {
    if (!$('#gal-unified-panel').length) $menuBtn.trigger('click');
    const $select = await waitFor(() => ($('#gal-skin-select').length ? $('#gal-skin-select') : null));
    if (!$select) return null;
    return fn($select);
  } finally {
    if ($('#gal-unified-panel').length) $menuBtn.trigger('click');
    document.documentElement.classList.remove('demo-silent-panel');
  }
}

async function setupSkinPicker() {
  const $picker = $('#demo-skin');
  const items = await withSettingsPanel($select =>
    $select
      .find('option')
      .map((_, opt) => ({ value: opt.value, label: opt.textContent, selected: opt.selected }))
      .get(),
  );
  if (!items?.length) {
    $picker.closest('.demo-field').hide();
    return;
  }
  $picker.html(items.map(it => `<option value="${escapeHtml(it.value)}"${it.selected ? ' selected' : ''}>${escapeHtml(it.label)}</option>`).join(''));
  $picker.on('change', async function () {
    const value = this.value;
    $picker.prop('disabled', true);
    try {
      await withSettingsPanel($select => $select.val(value).trigger('change'));
      const url = new URL(location.href);
      url.searchParams.set('skin', value);
      history.replaceState(null, '', url);
    } finally {
      $picker.prop('disabled', false);
    }
  });
}

// 存档 / 读档 / 时间线读写的是酒馆服务器上的聊天文件，演示页没有酒馆后端，点击时给出说明
const BACKEND_ONLY_ACTIONS = '#gal-global-overlay [data-action="save"], #gal-global-overlay [data-action="load"], #gal-global-overlay [data-action="timeline"], .gal-title-screen [data-action="load"]';

function showDemoToast(text) {
  $('.gal-toast').remove();
  const $toast = $('<div class="gal-toast"></div>').append($('<span></span>').text(text)).appendTo(document.body);
  setTimeout(() => $toast.fadeOut(300, () => $toast.remove()), 2600);
}

function bindShell() {
  document.addEventListener(
    'click',
    event => {
      if (!event.target.closest?.(BACKEND_ONLY_ACTIONS)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      showDemoToast('存档 / 读档 / 时间线需要读写酒馆服务器上的聊天文件，在线演示中不可用');
    },
    true,
  );
  $('#send_but').on('click', handleSend);
  $('#option_regenerate').on('click', handleRegenerate);
  $('#demo-restart').on('click', restartDemo);
  $('#demo-settings').on('click', () => $(`#${SCRIPT_ID}-btn`).trigger('click'));
}

function setVeil(text, isError = false) {
  const $veil = $('#demo-veil');
  if (text === null) {
    $veil.addClass('is-done');
    setTimeout(() => $veil.remove(), 700);
    return;
  }
  $veil.toggleClass('is-error', isError).find('.demo-veil-text').text(text);
}

// 酒馆助手以 import '…dist.js' 加载脚本（模块脚本，严格模式），这里同样按模块加载
function loadPlugin() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = PLUGIN_SRC;
    script.onload = resolve;
    script.onerror = () => reject(new Error('插件脚本加载失败'));
    document.body.appendChild(script);
  });
}

async function boot() {
  installHostGlobals();
  bindShell();
  try {
    setVeil('正在导入内置图包（日式学园）…');
    await prepareAssets();

    prepareLocalSettings();
    // 开场白（mesid 0），与酒馆打开角色卡时一致
    appendGreeting();

    setVeil('正在启动插件…');
    // 酒馆助手在页面加载完成后才执行脚本：此时 readyState 已是 complete，插件会立即 init()
    if (document.readyState !== 'complete') await new Promise(r => window.addEventListener('load', r, { once: true }));
    await loadPlugin();
    await waitFor(() => $('#gal-global-overlay.active').length || $('.gal-title-screen.active, #gal-title-screen.active').length, 20000);
    setVeil(null);
    setupSkinPicker();
  } catch (error) {
    console.error('[demo-host] 启动失败', error);
    setVeil(`演示启动失败：${error?.message || error}（请检查网络能否访问 cdn.jsdelivr.net 后刷新）`, true);
  }
}

$(boot);
