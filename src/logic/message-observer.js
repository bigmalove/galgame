import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow } from '../core/env.js';
import { getIsEnabled } from '../core/state.js';
import { getSettings } from '../core/settings.js';
import { BGMManager } from '../audio/bgm-manager.js';
import { TTSManager } from '../audio/tts-manager.js';

// ============================================
// 消息监听器
// ============================================

const messageContentDebounceTimers = new Map();

// 延迟引用: processNewMessage, injectGalgameButton
let _processNewMessageRef = null;
let _injectGalgameButtonRef = null;

export function setMessageObserverRefs({ processNewMessage, injectGalgameButton }) {
  if (processNewMessage) _processNewMessageRef = processNewMessage;
  if (injectGalgameButton) _injectGalgameButtonRef = injectGalgameButton;
}

export function setupMessageObserver() {
  BGMManager.init();
  TTSManager.init();

  const chatContainer = topWindow.document.querySelector('#chat');
  if (!chatContainer) {
    console.warn(`[${SCRIPT_NAME}] 未找到 #chat 容器`);
    return;
  }

  const chatObserver = new MutationObserver(mutations => {
    const settings = getSettings();
    const isEnabled = getIsEnabled();
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1 && node.classList?.contains('mes')) {
          if (isEnabled && settings.hideOtherFloors) {
            node.classList.add('gal-hidden');
          }
          setTimeout(() => {
            if (_processNewMessageRef) _processNewMessageRef(node);
            if (_injectGalgameButtonRef) _injectGalgameButtonRef(node);
          }, 200);
          setupMessageContentObserver(node);
        }
      });
    });
  });
  chatObserver.observe(chatContainer, { childList: true, subtree: false });

  chatContainer.querySelectorAll('.mes').forEach(mes => {
    setupMessageContentObserver(mes);
    if (_injectGalgameButtonRef) _injectGalgameButtonRef(mes);
  });

  console.log(`[${SCRIPT_NAME}] 消息监听器已启动`);
}

function setupMessageContentObserver(mesNode) {
  const mesText = mesNode.querySelector('.mes_text');
  if (!mesText) return;
  const mesId = mesNode.getAttribute('mesid');
  if (!mesId) return;
  if (mesNode.hasAttribute('data-gal-observer')) return;
  mesNode.setAttribute('data-gal-observer', 'true');

  let rafId = null;
  let debounceTimer = null;

  const contentObserver = new MutationObserver(() => {
    if (rafId) return;

    rafId = requestAnimationFrame(() => {
      rafId = null;

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        messageContentDebounceTimers.delete(mesId);
        if (getIsEnabled() && _processNewMessageRef) {
          _processNewMessageRef(mesNode);
        }
      }, 200);

      messageContentDebounceTimers.set(mesId, debounceTimer);
    });
  });
  contentObserver.observe(mesText, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}
