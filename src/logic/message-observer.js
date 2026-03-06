import { BGMManager } from '../audio/bgm-manager.js';
import { TTSManager } from '../audio/tts-manager.js';
import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow } from '../core/env.js';
import { getSettings } from '../core/settings.js';
import { getIsEnabled } from '../core/state.js';

// ============================================
// 消息监听器
// ============================================

const messageContentDebounceTimers = new Map();
const MESSAGE_OBSERVER_BOUND_FLAG = '__galgame_message_observer_bound__';

// 延迟引用: processNewMessage, injectGalgameButton
let _processNewMessageRef = null;
let _injectGalgameButtonRef = null;

export function setMessageObserverRefs({ processNewMessage, injectGalgameButton }) {
  if (processNewMessage) _processNewMessageRef = processNewMessage;
  if (injectGalgameButton) _injectGalgameButtonRef = injectGalgameButton;
}

export function setupMessageObserver() {
  if (topWindow[MESSAGE_OBSERVER_BOUND_FLAG]) {
    console.log(`[${SCRIPT_NAME}] 消息监听器已存在，跳过重复注册`);
    return;
  }
  topWindow[MESSAGE_OBSERVER_BOUND_FLAG] = true;

  BGMManager.init();
  TTSManager.init();

  const chatContainer = topWindow.document.querySelector('#chat');
  if (!chatContainer) {
    console.warn(`[${SCRIPT_NAME}] 未找到 #chat 容器`);
    return;
  }

  // 聊天稳定化检测：当新消息批量加入且 overlay 不存在时，延迟重建
  let chatStabilizeTimer = null;

  const chatObserver = new MutationObserver(mutations => {
    const settings = getSettings();
    const isEnabled = getIsEnabled();
    // 检测 overlay 是否仍存在（切换聊天时 SillyTavern 会清空 #chat，overlay 会被销毁）
    const overlayActive = !!topWindow.document.querySelector('#gal-global-overlay.active');
    let hasNewMessages = false;

    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1 && node.classList?.contains('mes')) {
          hasNewMessages = true;
          // ★ 仅当 overlay 存在且激活时才隐藏新消息，否则会导致空白屏幕
          if (isEnabled && settings.hideOtherFloors && overlayActive) {
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

    // ★ 当检测到新消息但 overlay 不存在时，说明聊天已切换
    // 使用 debounce 等待所有消息加载完毕后，强制渲染最后AI消息重建界面
    if (hasNewMessages && isEnabled && !overlayActive) {
      if (chatStabilizeTimer) clearTimeout(chatStabilizeTimer);
      chatStabilizeTimer = setTimeout(() => {
        chatStabilizeTimer = null;
        // 再次检查 overlay 是否仍然缺失（可能 CHAT_CHANGED 已经处理了）
        if (topWindow.document.querySelector('#gal-global-overlay.active')) return;

        const allMes = chatContainer.querySelectorAll('.mes');
        let lastAiMes = null;
        allMes.forEach(mes => {
          if (mes.getAttribute('is_user') !== 'true') {
            lastAiMes = mes;
          }
        });

        if (lastAiMes && _processNewMessageRef) {
          console.log(`[${SCRIPT_NAME}] 检测到聊天变更且界面缺失，重新渲染最后AI消息`);
          _processNewMessageRef(lastAiMes, { forceRender: true });
        }
      }, 500);
    }
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
