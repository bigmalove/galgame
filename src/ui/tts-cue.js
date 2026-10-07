import { topWindow } from '../core/env.js';

// ============================================
// TTS 配音标识：贴在名牌右侧的小胶囊
// ============================================
// 作为名牌的兄弟节点插入（不放进名牌：部分皮肤给名牌加了 clip-path，伸出去的子元素会被裁掉），
// 位置由 JS 按名牌实际外框计算。显隐与播放状态全部交给 CSS：
//   说话者在场 + 开启 TTS + 气泡指示器 → 显示；#gal-global-overlay.gal-tts-playing → 均衡器跳动。
// 点击重播当前这句（播放中点击则停止），事件委托见 events.js 的 data-action="replay-voice"。

const CUE_CLASS = 'gal-tts-cue';
const CUE_HTML = `<div class="${CUE_CLASS}" data-action="replay-voice" role="button" tabindex="-1" title="重播语音" aria-label="重播语音"><i class="fa-solid fa-volume-off"></i><span class="gal-tts-cue-bars"><b></b><b></b><b></b><b></b></span></div>`;
const CUE_GAP = 10;
// 名牌比名字宽出这么多以上，视为整行容器（天空 / 柔和主题），改为贴着名字本身
const WIDE_BADGE_SLACK = 80;

let resizeBound = false;

function translateOf(el) {
  const raw = topWindow.getComputedStyle(el).translate;
  if (!raw || raw === 'none') return [0, 0];
  const [x = 0, y = 0] = raw.split(' ').map(v => parseFloat(v) || 0);
  return [x, y];
}

function positionCue(badge, cue) {
  const host = badge.offsetParent;
  if (!host || !cue.isConnected) return;
  const hostRect = host.getBoundingClientRect();
  const scale = host.offsetWidth ? hostRect.width / host.offsetWidth : 1;

  const label = badge.querySelector('span');
  const badgeRect = badge.getBoundingClientRect();
  const labelRect = label?.getBoundingClientRect();
  const useLabel = labelRect?.width > 0 && badgeRect.width - labelRect.width > WIDE_BADGE_SLACK * scale;
  const anchor = useLabel ? labelRect : badgeRect;
  if (!anchor.width) {
    cue.style.visibility = 'hidden';
    return;
  }
  cue.style.visibility = '';

  // 名牌入场动画用独立 translate 位移，量到的是动画中途的位置，扣掉以免标识跟着晃
  let [tx, ty] = translateOf(badge);
  if (useLabel) {
    const [lx, ly] = translateOf(label);
    tx += lx;
    ty += ly;
  }
  const right = anchor.right - tx * scale - hostRect.left - host.clientLeft * scale;
  const midY = anchor.top + anchor.height / 2 - ty * scale - hostRect.top - host.clientTop * scale;
  cue.style.left = `${right / scale + CUE_GAP}px`;
  cue.style.top = `${midY / scale}px`;
}

function repositionAll() {
  topWindow.document.querySelectorAll(`#gal-global-overlay .${CUE_CLASS}`).forEach(cue => {
    const badge = cue.previousElementSibling;
    if (badge?.classList.contains('gal-name-badge')) positionCue(badge, cue);
  });
}

/**
 * 确保名牌后紧跟着 TTS 标识并完成定位；可重复调用。
 * @param {JQuery|Element} overlay
 */
export function syncTtsCue(overlay) {
  const overlayEl = overlay?.jquery ? overlay[0] : overlay;
  const badge = overlayEl?.querySelector('.gal-name-badge');
  if (!badge) return;

  let cue = badge.nextElementSibling;
  if (!cue?.classList.contains(CUE_CLASS)) {
    overlayEl.querySelectorAll(`.${CUE_CLASS}`).forEach(el => el.remove());
    badge.insertAdjacentHTML('afterend', CUE_HTML);
    cue = badge.nextElementSibling;
  }

  if (!badge.__galTtsCueObserver && topWindow.ResizeObserver) {
    const observer = new topWindow.ResizeObserver(() => positionCue(badge, cue));
    observer.observe(badge);
    const label = badge.querySelector('span');
    if (label) observer.observe(label);
    badge.__galTtsCueObserver = observer;
    badge.addEventListener('animationend', () => positionCue(badge, cue));
  }
  if (!resizeBound) {
    resizeBound = true;
    topWindow.addEventListener('resize', () => topWindow.requestAnimationFrame(repositionAll));
  }

  positionCue(badge, cue);
}
