import { $, topWindow } from '../core/env.js';

// 酒馆助手脚本运行在隐藏 iframe 中：DOM 创建 / rAF / matchMedia 必须走顶层窗口，
// 否则 requestAnimationFrame 会被挂起（粒子、木轴动画全部冻结）
const topDoc = topWindow.document;
const raf = (fn) => topWindow.requestAnimationFrame(fn);
const caf = (id) => topWindow.cancelAnimationFrame(id);

// ============================================
// Styled 情境演出：入离场编排 + Canvas 2D 粒子舞台
// （对应 styles.js 的 styledCss 区块；demo 参考
//   情境样式重设计demo.html）
// ============================================

// 每种载体：主题色（神光/粒子）、粒子行为
const THEMES = {
  sms:       { accent: '#4D9FFF', particles: { c1: [77, 159, 255], c2: [154, 208, 255], dir: 1, speed: 5, sway: 0.6, size: 2.0 } },
  letter:    { accent: '#FFB7C9', particles: { c1: [255, 183, 201], c2: [255, 227, 236], dir: -1, speed: 2.4, sway: 2.6, size: 3.2 } },
  parchment: { accent: '#FFB347', particles: { c1: [255, 179, 71], c2: [255, 122, 60], dir: 1, speed: 3.2, sway: 1.2, size: 2.4 } },
  newspaper: { accent: '#D8D2C0', particles: { c1: [216, 210, 192], c2: [143, 138, 122], dir: -1, speed: 1.6, sway: 1.8, size: 2.2 } },
  terminal:  { accent: '#4DFF88', particles: { c1: [77, 255, 136], c2: [26, 122, 63], dir: -1, speed: 14, sway: 0.15, size: 1.7 } },
  note:      { accent: '#FFE066', particles: { c1: [255, 224, 102], c2: [255, 246, 200], dir: 1, speed: 1.4, sway: 2.2, size: 2.6 } },
  diary:     { accent: '#A8C686', particles: { c1: [168, 198, 134], c2: [228, 240, 200], dir: 1, speed: 1.8, sway: 1.6, size: 2.4 } },
  bulletin:  { accent: '#FF5A4D', particles: { c1: [255, 90, 77], c2: [255, 160, 148], dir: 1, speed: 8, sway: 0.5, size: 1.8 } },
  fallback:  { accent: '#6DF0FF', particles: { c1: [109, 240, 255], c2: [190, 120, 255], dir: 1, speed: 2.6, sway: 1.0, size: 2.1 } },
};

const TYPE_ALIAS = {
  '手机短信': 'sms', 'sms': 'sms', '微信': 'sms', 'wechat': 'sms',
  '信纸': 'letter', 'letter': 'letter',
  '羊皮纸': 'parchment', 'parchment': 'parchment', '古卷': 'parchment',
  '新闻': 'newspaper', '报纸': 'newspaper', 'newspaper': 'newspaper', 'news': 'newspaper',
  '电脑屏幕': 'terminal', '终端': 'terminal', 'terminal': 'terminal', 'computer': 'terminal',
  '便签': 'note', '纸条': 'note', 'note': 'note', 'sticky': 'note',
  '日记': 'diary', 'diary': 'diary', 'journal': 'diary',
  '公告': 'bulletin', '通知': 'bulletin', 'bulletin': 'bulletin', 'notice': 'bulletin',
};

function normalizeStyleType(type) {
  return TYPE_ALIAS[String(type || '').toLowerCase()] || TYPE_ALIAS[type] || 'fallback';
}

const REDUCED_MOTION = typeof topWindow.matchMedia === 'function' && topWindow.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── 演出令牌：新演出开始即作废旧编排 ───
let token = 0;
let subTimers = [];
function later(fn, ms, myToken) {
  subTimers.push(setTimeout(() => { if (myToken === token) fn(); }, ms));
}
function clearSubTimers() {
  subTimers.forEach(clearTimeout);
  subTimers = [];
}

// ─── Canvas 2D 粒子引擎 ───
const Particles = (() => {
  let canvas = null, ctx = null, rafId = 0, host = null, lastT = 0;
  let ps = [];
  const mk = (a) => ({ c1: a.c1.slice(), c2: a.c2.slice(), dir: a.dir, speed: a.speed, sway: a.sway, size: a.size });
  const cur = mk(THEMES.sms.particles);
  const tgt = mk(THEMES.sms.particles);
  let burstMul = 1;
  const sp1 = topDoc.createElement('canvas');
  const sp2 = topDoc.createElement('canvas');
  sp1.width = sp1.height = sp2.width = sp2.height = 64;

  function tintSprite(cv, rgb) {
    const c = cv.getContext('2d');
    c.clearRect(0, 0, 64, 64);
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},1)`);
    g.addColorStop(0.4, `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},0.45)`);
    g.addColorStop(1, `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},0)`);
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  }

  function resize() {
    if (!canvas || !host) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawn() {
    const w = host.clientWidth || 800, h = host.clientHeight || 500;
    const n = Math.max(60, Math.min(150, Math.round((w * h) / 6500)));
    ps = [];
    for (let i = 0; i < n; i++) {
      ps.push({
        x: Math.random() * w, y: Math.random() * h,
        sp: 0.5 + Math.random(), phase: Math.random() * Math.PI * 2,
        mix: Math.random() < 0.5 ? 0 : 1, r: 0.6 + Math.random() * 0.9,
      });
    }
  }

  function loop(t) {
    rafId = raf(loop);
    if (!host || !host.isConnected || !ctx) { stop(); return; }
    const dt = Math.min((t - lastT) / 1000 || 0.016, 0.05);
    lastT = t;
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;

    for (const k of ['dir', 'speed', 'sway', 'size']) cur[k] += (tgt[k] - cur[k]) * 0.04;
    for (let i = 0; i < 3; i++) {
      cur.c1[i] += (tgt.c1[i] - cur.c1[i]) * 0.045;
      cur.c2[i] += (tgt.c2[i] - cur.c2[i]) * 0.045;
    }
    burstMul += (1 - burstMul) * 0.03;
    tintSprite(sp1, cur.c1);
    tintSprite(sp2, cur.c2);

    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    const sec = t / 1000;
    for (const p of ps) {
      p.y -= cur.dir * cur.speed * p.sp * burstMul * dt * 13;
      p.x += Math.sin(sec * 0.7 + p.phase) * cur.sway * dt * 13;
      if (p.y < -20) p.y = h + 20;
      if (p.y > h + 20) p.y = -20;
      if (p.x < -20) p.x = w + 20;
      if (p.x > w + 20) p.x = -20;
      const tw = 0.5 + 0.5 * Math.sin(sec * (1.2 + p.sp) + p.phase * 3);
      const s = cur.size * p.r * 3.4;
      ctx.globalAlpha = 0.25 + 0.5 * tw;
      ctx.drawImage(p.mix ? sp2 : sp1, p.x - s, p.y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
  }

  function start(stageEl) {
    if (REDUCED_MOTION) return;
    host = stageEl;
    if (!canvas || !canvas.isConnected || canvas.parentElement !== stageEl) {
      if (canvas) canvas.remove();
      canvas = topDoc.createElement('canvas');
      canvas.className = 'fx-particles';
      stageEl.insertBefore(canvas, stageEl.firstChild);
      ctx = canvas.getContext('2d');
      resize();
      spawn();
    }
    if (!rafId) { lastT = 0; rafId = raf(loop); }
  }
  function stop() {
    if (rafId) caf(rafId);
    rafId = 0;
  }
  function setTheme(p) {
    tgt.c1 = p.c1.slice(); tgt.c2 = p.c2.slice();
    tgt.dir = p.dir; tgt.speed = p.speed; tgt.sway = p.sway; tgt.size = p.size;
  }
  function burst(mul) { burstMul = Math.max(burstMul, mul || 2.5); }
  return { start, stop, setTheme, burst, resize };
})();

// ─── 舞台机械（神光 / 白闪 / 木轴 / 震屏） ───
function ensureFxLayers(stageEl) {
  if (!stageEl.querySelector('.fx-rays')) {
    const rays = topDoc.createElement('div');
    rays.className = 'fx-rays';
    stageEl.insertBefore(rays, stageEl.querySelector('.gal-styled-stage-content'));
  }
  if (!stageEl.querySelector('.fx-flash')) {
    const flash = topDoc.createElement('div');
    flash.className = 'fx-flash';
    stageEl.appendChild(flash);
  }
}
function doFlash(stageEl) {
  const flash = stageEl.querySelector('.fx-flash');
  if (!flash) return;
  flash.classList.remove('go');
  void flash.offsetWidth;
  flash.classList.add('go');
}
function doShake(stageEl) {
  stageEl.classList.remove('fx-shake');
  void stageEl.offsetWidth;
  stageEl.classList.add('fx-shake');
}
function removeRollers(stageEl) {
  stageEl.querySelectorAll('.fx-roller').forEach(n => n.remove());
}

// ─── 类型专属子编排 ───

// 短信：气泡逐条揭示，对方消息前先出「正在输入…」
function playSms(card, stageEl, myToken) {
  const body = card.querySelector('.gal-sms-body');
  if (!body) return;
  const rows = [...card.querySelectorAll('.gal-sms-row')];
  rows.forEach(r => r.classList.add('hide'));
  let t = 650;
  for (const row of rows) {
    const isOther = row.classList.contains('gal-sms-row-other');
    if (isOther) {
      later(() => {
        const ty = topDoc.createElement('div');
        ty.className = 'gal-sms-typing';
        ty.innerHTML = '<i></i><i></i><i></i>';
        body.insertBefore(ty, row);
        body.scrollTop = body.scrollHeight;
        row.__typing = ty;
      }, t, myToken);
      t += 620;
    } else {
      t += 260;
    }
    later(() => {
      if (row.__typing) { row.__typing.remove(); row.__typing = null; }
      row.classList.remove('hide');
      row.classList.add('pop');
      body.scrollTop = body.scrollHeight;
    }, t, myToken);
    t += 340;
  }
}

// 终端：CRT 开机后逐字打印，随机 RGB 故障
function playTerminal(card, stageEl, myToken) {
  const body = card.querySelector('.gal-terminal-body');
  if (!body) return;
  const cursor = card.querySelector('.gal-terminal-cursor');
  const lines = [...card.querySelectorAll('.gal-terminal-line')];
  const data = lines.map(ln => {
    const prompt = ln.querySelector('.gal-terminal-prompt');
    const promptHTML = prompt ? prompt.outerHTML : '';
    const text = ln.textContent.replace(prompt ? prompt.textContent : '', '').replace(/^\s+/, '');
    ln.innerHTML = promptHTML + '<span class="tw"></span>';
    ln.style.display = 'none';
    return { el: ln, span: ln.querySelector('.tw'), text: ' ' + text };
  });
  let li = 0;
  function typeLine() {
    if (li >= data.length) {
      later(function tick() {
        if (!data.length) return;
        const pick = data[Math.floor(Math.random() * data.length)].el;
        pick.classList.add('fx-glitch');
        later(() => pick.classList.remove('fx-glitch'), 150, myToken);
        later(tick, 1200 + Math.random() * 2600, myToken);
      }, 900, myToken);
      return;
    }
    const d = data[li++];
    d.el.style.display = '';
    if (cursor) d.el.appendChild(cursor);
    let ci = 0;
    (function typeChar() {
      if (myToken !== token) return;
      if (ci <= d.text.length) {
        d.span.textContent = d.text.slice(0, ci++);
        body.scrollTop = body.scrollHeight;
        subTimers.push(setTimeout(typeChar, 14 + Math.random() * 26));
      } else {
        later(typeLine, 220, myToken);
      }
    })();
  }
  later(() => { if (cursor) body.appendChild(cursor); typeLine(); }, 720, myToken);
}

// 羊皮纸：注入上下木轴，与卷轴展开同步拉开
function playParchment(card, stageEl, myToken) {
  if (REDUCED_MOTION) return;
  const top = topDoc.createElement('div');
  const bot = topDoc.createElement('div');
  top.className = 'fx-roller';
  bot.className = 'fx-roller';
  for (const r of [top, bot]) {
    r.style.top = 'calc(50% - 13px)';
    r.style.transition = 'top 1.1s cubic-bezier(0.3, 1, 0.4, 1) 0.18s, opacity 0.5s ease 1.4s';
    stageEl.appendChild(r);
  }
  raf(() => raf(() => {
    if (myToken !== token) return;
    const h = card.getBoundingClientRect().height / 2;
    top.style.top = `calc(50% - ${h + 26}px)`;
    bot.style.top = `calc(50% + ${h}px)`;
    top.style.opacity = '0';
    bot.style.opacity = '0';
  }));
  later(() => { top.remove(); bot.remove(); }, 2200, myToken);
}

// 报纸：旋转落定瞬间白闪 + 微震
function playNewspaper(card, stageEl, myToken) {
  later(() => { doFlash(stageEl); doShake(stageEl); }, 780, myToken);
}

// 公告：印章砸落时白闪 + 震屏 + 粒子爆发
function playBulletin(card, stageEl, myToken) {
  later(() => { doFlash(stageEl); doShake(stageEl); Particles.burst(3.5); }, 1340, myToken);
}

const SUBPLAY = { sms: playSms, terminal: playTerminal, parchment: playParchment, newspaper: playNewspaper, bulletin: playBulletin };

// ─── 舞台入口 ───
function ensureStyledStage($overlay) {
  const $gameContent = $overlay.find('.gal-game-content');
  if (!$gameContent.length) return $();
  let $stage = $gameContent.find('.gal-styled-stage');
  if ($stage.length) return $stage;
  $stage = $('<div class="gal-styled-stage"><div class="gal-styled-stage-content"></div></div>');
  $gameContent.append($stage);
  return $stage;
}

export function showStyledStage($overlay, styledHtml, styleType) {
  if (!styledHtml) {
    hideStyledStage($overlay);
    return;
  }
  const $stage = ensureStyledStage($overlay);
  if (!$stage.length) return;
  token++;
  const myToken = token;
  clearSubTimers();

  const stageEl = $stage[0];
  ensureFxLayers(stageEl);
  const key = normalizeStyleType(styleType);
  const theme = THEMES[key];
  stageEl.style.setProperty('--fx-accent', theme.accent);
  Particles.setTheme(theme.particles);

  const $content = $stage.find('.gal-styled-stage-content');
  const prevCard = $content.children('.gal-styled')[0];

  const mount = () => {
    if (myToken !== token) return;
    removeRollers(stageEl);
    $content.html(styledHtml);
    $stage.addClass('show').removeClass('hiding');
    Particles.start(stageEl);
    Particles.burst(2);
    const card = $content.children('.gal-styled')[0];
    if (card && !REDUCED_MOTION) {
      card.classList.add('entering');
      if (SUBPLAY[key]) SUBPLAY[key](card, stageEl, myToken);
      later(() => card.classList.remove('entering'), 2600, myToken);
    }
  };

  if (prevCard && $stage.hasClass('show') && !REDUCED_MOTION) {
    // 旧物件谢幕后再登场
    prevCard.classList.remove('entering');
    prevCard.classList.add('leaving');
    setTimeout(() => { if (myToken === token) mount(); }, 450);
  } else {
    mount();
  }
}

export function hideStyledStage($overlay) {
  const $stage = $overlay.find('.gal-styled-stage');
  if (!$stage.length || !$stage.hasClass('show')) return;
  token++;
  const myToken = token;
  clearSubTimers();
  const stageEl = $stage[0];
  const card = $stage.find('.gal-styled-stage-content').children('.gal-styled')[0];
  if (card && !REDUCED_MOTION) {
    card.classList.remove('entering');
    card.classList.add('leaving');
  }
  $stage.addClass('hiding');
  const finish = () => {
    $stage.removeClass('show hiding');
    $stage.find('.gal-styled-stage-content').empty();
    removeRollers(stageEl);
    Particles.stop();
  };
  if (REDUCED_MOTION) { finish(); return; }
  setTimeout(() => { if (myToken === token) finish(); }, 650);
}
