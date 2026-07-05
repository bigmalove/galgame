import { $ } from '../core/env.js';
import { BGMManager } from '../audio/bgm-manager.js';
import { getSettings } from '../core/settings.js';

// ============================================
// BGM UI 组件渲染
// ============================================

export function removeBGMWidget() {
  $('#gal-global-overlay .gal-bgm-widget').remove();
}

export function renderBGMWidget() {
  if (getSettings().bgmEnabled === false) {
    removeBGMWidget();
    return;
  }
  let $widget = $('#gal-global-overlay .gal-bgm-widget');
  if ($widget.length > 0) return;

  const widgetHtml = `
    <div class="gal-bgm-widget" title="点击展开音乐控制">
      <div class="gal-bgm-icon"><i class="fa-solid fa-compact-disc"></i></div>
      <div class="gal-bgm-info" style="display:none;">
        <div class="gal-bgm-title">No Music</div>
      </div>
      <div class="gal-bgm-ctrl" style="display:none;">
        <button class="gal-bgm-btn btn-prev"><i class="fa-solid fa-backward-step"></i></button>
        <button class="gal-bgm-btn btn-play"><i class="fa-solid fa-play"></i></button>
        <button class="gal-bgm-btn btn-next"><i class="fa-solid fa-forward-step"></i></button>
        <input type="range" class="gal-bgm-slider" min="0" max="1" step="0.05" value="${BGMManager.volume}">
      </div>
    </div>
  `;

  $('#gal-global-overlay').append(widgetHtml);
  $widget = $('#gal-global-overlay .gal-bgm-widget');

  $widget.on('click', function (e) {
    if (!$(e.target).closest('.gal-bgm-btn, .gal-bgm-slider').length) {
      const isActive = $(this).toggleClass('active').hasClass('active');
      $(this).find('.gal-bgm-info, .gal-bgm-ctrl').toggle(isActive);
      if (isActive) {
        setTimeout(() => {
          if (!$(this).is(':hover')) {
            $(this).removeClass('active').find('.gal-bgm-info, .gal-bgm-ctrl').hide();
          }
        }, 5000);
      }
    }
  });

  $widget.find('.btn-play').on('click', function (e) {
    e.stopPropagation();
    if (!BGMManager.audio.paused) {
      BGMManager.pause();
    } else {
      BGMManager.resume();
    }
  });

  $widget
    .find('.gal-bgm-slider')
    .on('input', function (e) {
      e.stopPropagation();
      BGMManager.setVolume(parseFloat(this.value));
    })
    .on('click', e => e.stopPropagation());

  BGMManager.updateUI = function () {
    const $w = $('#gal-global-overlay .gal-bgm-widget');
    if (!$w.length) return;
    $w.toggleClass('playing', this.isPlaying);
    $w.find('.btn-play i').attr('class', this.isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play');
    if (this.currentTrack) {
      const trackName =
        this.currentTrack.Name ||
        this.currentTrack.name ||
        this.currentTrack.Song ||
        this.currentTrack.song ||
        this.currentTrack.Title ||
        this.currentTrack.title ||
        this.currentKeyword;
      $w.find('.gal-bgm-title').text(trackName);
      const singer = this.currentTrack.Singer || this.currentTrack.singer || '';
      if (singer) {
        $w.find('.gal-bgm-title').attr('title', `${trackName} - ${singer}`);
      }
    } else if (this.currentKeyword) {
      $w.find('.gal-bgm-title').text('Searching: ' + this.currentKeyword);
    }
  };

  BGMManager.updateUI();
}
