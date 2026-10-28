import { SCRIPT_NAME } from './constants.js';
import { topWindow } from './env.js';

// ============================================
// 页面级注册标记
// ============================================
// 各 setupXxx 用挂在酒馆主页面上的 __galgame_*_bound__ 标记防止重复注册，但标记比注册它的脚本 iframe 活得久。
// 酒馆助手卸载脚本时会销毁它的 iframe（关闭脚本、热重载，角色脚本在切换角色卡时也会），之后加载的新副本
// 看到旧标记便跳过注册；而旧副本经主页面 jQuery 绑定的事件仍会触发，代码却跑在已销毁的 iframe 里，
// 其定时器不再执行，于是「进入Galgame模式」等按钮没有反应、新消息不再渲染，直到刷新页面。
// 每个副本只登记自己设置的标记；卸载（pagehide）时撤销自己的注册并清除标记，下一份副本即可照常注册。
// iframe 自己的定时器、MutationObserver 与原生 addEventListener 监听会随 iframe 一起停止，无需撤销；
// 需要 release 的是主页面持有的注册，例如经 topWindow.jQuery 绑定的事件。
const ownedBindings = [];

export function claimPageBinding(flag, release) {
  topWindow[flag] = true;
  ownedBindings.push({ flag, release });
}

export function releasePageBindings() {
  while (ownedBindings.length) {
    const { flag, release } = ownedBindings.pop();
    try {
      if (release) release();
    } catch (error) {
      console.warn(`[${SCRIPT_NAME}] 卸载时撤销页面级注册失败: ${flag}`, error);
    }
    delete topWindow[flag];
  }
}
