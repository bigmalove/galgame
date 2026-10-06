// Live2D 演示的预置剧本「星见之夜」：四个角色全部是 Live2D（官方示例模型），分别展示插件处理 Live2D 表情的几种方式：
//   小春（Haru, Cubism 3）手动表情映射 / 日和（Hiyori, Cubism 4）无表情文件 → 内置参数表情 /
//   真央（Mao, Cubism 5）手动映射 + 自定义表情「施法」触发魔法动作 / 夏目（Natori）按表情名自动匹配
// 格式约定同 story.js（每个节点就是一条「AI 回复」原文，options 模拟数据库插件选项表）

import { LIVE2D_CAST, lineKey, collectDialogueLines, renderScenarioNode } from './story-utils.js';

export { lineKey, collectDialogueLines };

export const USER_NAME = '学长';
export const CHAR_NAME = '天文部';

export const LIVE2D_CHARACTERS = [LIVE2D_CAST.小春, LIVE2D_CAST.日和, LIVE2D_CAST.真央, LIVE2D_CAST.夏目];

// 自定义表情（等同于在插件「自定义表情」里添加）：AI 可以在台词里写 [施法]，表情映射把它接到真央的魔法动作上
export const CUSTOM_EXPRESSIONS = [{ name: '施法', emotion: null }];

// TTS 配音：同 story.js，由 record-voices.js 在真实酒馆里用小白X 录制
export const VOICE_PREFERENCES = {
  小春: '柔美女友（多情感）',
  日和: '爽快思思（多情感）',
  真央: '樱桃丸子',
  夏目: '儒雅逸辰',
};

const POPUP_PLACE = '<弹窗一><b>天文台</b><br>旧校舍顶层的圆顶观测室，天文部的活动室，部员三人。</弹窗一>';

export const NODES = {
  greeting: {
    summary: '流星雨极大期的夜晚，天文部的日和与小春在天文台等学长；自称大魔法师的真央闯进来，用「魔法」变出了星光。',
    location: '天文台',
    time: '流星雨之夜 20:10',
    text: `<maintext>
<background scene="天文台" transition="black" />
<pixiPerform name="bokeh" />
${POPUP_PLACE}
<弹窗二><b>流星雨之夜</b><br>20:10 · 晴 · 狮子座流星雨极大期</弹窗二>
<p>旧校舍顶层的天文台里，圆顶正缓缓打开。今晚是流星雨的极大期，天文部全员到齐——虽然全员只有三个人。</p>
<p>日和[大笑]: "学长终于来啦！望远镜我已经调好了，今晚的天气简直完美！"</p>
<p>小春[微笑]: "日和放学就守在这里了。……学长要喝热可可吗？我带了保温瓶。"</p>
<p>日和[害羞]: "小春学姐！不、不是说好不告诉学长的吗……"</p>
<p>门“砰”地一声被推开。一个戴着尖顶帽的女生抱着法杖，理直气壮地走了进来。</p>
<p>真央[搞怪]: "流星雨这种事情，交给真央大魔法师就对了！"</p>
<pixiPerform name="fireflies" />
<p>真央[施法]: "看好了——星光，降临吧！"</p>
<p>日和[惊讶]: "哇！刚、刚才是不是真的有星星在闪？"</p>
<p>小春[思考]: "……是舞台用的小道具吧。不过，确实很好看。"</p>
<p>真央[生气]: "才不是道具！是货真价实的魔法！"</p>
</maintext>`,
    options: [
      ['请真央再表演一次魔法', 'magic'],
      ['和小春一起整理观测记录', 'haru'],
      ['陪日和用望远镜找流星', 'hiyori'],
    ],
  },

  magic: {
    summary: '真央请学长当助手，又表演了一次「魔法」，送给他一颗锡纸折的星星。',
    location: '天文台',
    time: '流星雨之夜 20:25',
    text: `<maintext>
<p>真央清了清嗓子，把尖顶帽往上推了推，郑重其事地举起法杖。</p>
<p>真央[微笑]: "这次是特别篇。请学长当我的助手——把手伸出来。"</p>
<pixiPerform name="fireflies" />
<p>真央[施法]: "以星辰之名……变！"</p>
<p>法杖尖端炸开一小团光，落在我掌心的，是一颗用锡纸折成的星星。</p>
<p>真央[大笑]: "怎么样？这可是真央的独门魔法，全世界只此一颗！"</p>
<p>真央[害羞]: "……送、送给你了。不准笑！"</p>
<p>日和[微笑]: "真央学姐的魔法，明明就是手工嘛。"</p>
</maintext>`,
    options: [['把锡纸星星收进口袋', 'finale']],
  },

  haru: {
    summary: '学长和小春一起整理观测记录，小春说起这些年一个人做记录的事。',
    location: '天文台',
    time: '流星雨之夜 20:25',
    text: `<maintext>
<p>小春[默认]: "观测记录要写清楚时间、方位和亮度。流星的话，还要记下它划过的星座。"</p>
<p>小春[微笑]: "学长的字很好看呢……啊，我是说，记录写得很工整。"</p>
<p>小春[害羞]: "……热可可，要趁热喝哦。"</p>
<p>她把保温杯递过来，指尖碰到的时候，像被烫到一样缩了回去。</p>
<p>小春[思考]: "这么多年，我一直是一个人做观测记录。今年……好像有点不一样了。"</p>
</maintext>`,
    options: [['接过热可可，在记录本上签下名字', 'finale']],
  },

  hiyori: {
    summary: '日和拉着学长看望远镜，看到了木星和第一颗流星。',
    location: '天文台',
    time: '流星雨之夜 20:25',
    text: `<maintext>
<p>日和把我按在望远镜前，自己扒着目镜边，眼睛亮得像天上的星星。</p>
<p>日和[微笑]: "看到了吗？那颗最亮的是木星，旁边四个小点是它的卫星！"</p>
<p>日和[惊讶]: "啊！流星！学长快许愿！"</p>
<p>日和[害羞]: "我、我许的愿望才不告诉你呢……"</p>
<p>日和[大笑]: "等极大期一到，一个晚上能看到上百颗哦！到时候我们一起数！"</p>
</maintext>`,
    options: [['和日和约好一起数流星', 'finale']],
  },

  finale: {
    summary: '巡夜的夏目老师发现了天文部，真央躲进窗帘却露出了帽子；老师网开一面，流星雨开始了。',
    location: '天文台',
    time: '流星雨之夜 21:00',
    text: ({ from }) => `<maintext>
<p>${{
      magic: '我把锡纸星星收进口袋的时候，走廊里传来了脚步声。',
      haru: '记录本上刚签好名字，走廊里就传来了脚步声。',
      hiyori: '我们正头挨着头数星星，走廊里传来了脚步声。',
    }[from] || '走廊里传来了脚步声。'}手电筒的光从门缝里扫了进来。</p>
<p>真央[惊讶]: "糟了，是巡夜的夏目老师！真央大魔法师——隐身！"</p>
<sprite action="exit" character="真央" />
<p>她一溜烟钻到了窗帘后面，只露出一截尖顶帽。</p>
<p>夏目[生气]: "这么晚了还不回家……天文部？"</p>
<p>夏目[惊讶]: "……今晚是流星雨的极大期吗。"</p>
<p>夏目[微笑]: "下不为例。十点前锁好门。还有，窗帘后面那位同学，帽子露出来了。"</p>
<pixiPerform name="bokeh" />
<pixiPerform name="dust" />
<p>大家同时笑出了声。圆顶外，第一颗流星拖着长长的尾巴划过了夜空。</p>
<p>日和[大笑]: "流星！大家快许愿！"</p>
<p>小春[微笑]: "……今年的观测记录，一定会是最热闹的一本。"</p>
<styled type="便签" from="演示说明">这是 Galgame 界面插件的 Live2D 演示，四个角色都是 Live2D 官方示例模型，由插件真实加载与驱动：\\n小春（Cubism 3）用手动表情映射；日和（Cubism 4）没有表情文件，用插件内置的参数表情；真央（Cubism 5）的自定义表情「施法」接上了模型的魔法动作；夏目老师的表情按名字自动匹配。\\n语音由小白X 录制，口型同步由插件实时分析音量驱动。</styled>
<p>—— 演示结束，感谢游玩 ——</p>
</maintext>`,
    options: [
      ['重新开始，换个选择看看', 'restart'],
      ['去看主演示（立绘 + Live2D 混合）', 'goto-main'],
    ],
  },

  freeform: {
    text: ({ input }) => `<maintext>
<p>（你说：“${input}”）</p>
<p>演示模式下，AI 的回复是预置剧本，自由输入不会改变剧情走向。点击选项继续吧～</p>
</maintext>`,
  },
};

export function resolveNextNode(target, { lastRoute } = {}) {
  if (['magic', 'haru', 'hiyori'].includes(target)) return { id: target, params: {} };
  if (target === 'finale') return { id: 'finale', params: { from: lastRoute || 'magic' } };
  if (target === 'restart') return { id: 'restart', params: {} };
  if (target === 'goto-main') return { id: 'navigate', params: { href: '../' } };
  return null;
}

export const NODE_VARIANTS = [
  { id: 'greeting' },
  { id: 'magic' },
  { id: 'haru' },
  { id: 'hiyori' },
  ...['magic', 'haru', 'hiyori'].map(from => ({ id: 'finale', params: { from } })),
];

export function renderNode(id, params = {}) {
  return renderScenarioNode({ NODES }, id, params);
}

export const SCENARIO = {
  id: 'live2d',
  USER_NAME,
  CHAR_NAME,
  CARD_DESCRIPTION: '旧校舍顶层的天文部，部员三人。',
  TITLE: { text: '星见之夜', subtitle: 'Galgame 界面插件 · Live2D 演示', scene: '天文台' },
  SPRITE_TEMPLATES: [],
  LIVE2D_CHARACTERS,
  VOICE_PREFERENCES,
  CUSTOM_EXPRESSIONS,
  NODES,
  NODE_VARIANTS,
  ROUTE_NODES: ['magic', 'haru', 'hiyori'],
  resolveNextNode,
  renderNode,
};
