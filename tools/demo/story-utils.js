// 演示剧本共用：Live2D 角色定义、台词收集与录音查找键（story.js / story-live2d.js / host.js / record-voices.js 共用）

const CUBISM_SAMPLES = 'https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@develop/Samples/Resources';

// Live2D 角色：远程模型 URL 绑定到角色（等同于在「Live2D 模型来源 → 远程 URL」里填写），模型均为 Live2D 官方示例。
// expressionMapping / motionMapping 即 Live2D 设置弹窗里的「表情映射」：剧本表情标签 → 模型自带表情 / 动作；
// 不填则走插件的自动匹配（按表情名匹配，模型没有表情文件时用内置参数表情）
const BUST_UP = { offsetX: 0, offsetY: 170, scale: 1.2, scaleBase: 'height' };

export const LIVE2D_CAST = {
  // Haru（Cubism 3.0）：自带表情 F01–F08 名字无语义，手动映射
  小春: {
    character: '小春',
    modelUrl: `${CUBISM_SAMPLES}/Haru/Haru.model3.json`,
    config: {
      transform: { ...BUST_UP },
      // F01 微笑 / F02 柔和 / F03 严肃 / F04 担心 / F05 眯眼笑 / F06 平静睁眼 / F07 脸红 / F08 鼓气
      expressionMapping: { '默认': 'F02', '微笑': 'F01', '大笑': 'F05', '害羞': 'F07', '思考': 'F04', '难过': 'F04', '惊讶': 'F06', '生气': 'F08', '嘲讽': 'F03' },
      motionMapping: {},
    },
  },
  // Hiyori（Cubism 4.0）：没有表情文件，不做映射，插件自动改用内置参数表情（眯眼、嘴型、脸红等）
  日和: {
    character: '日和',
    modelUrl: `${CUBISM_SAMPLES}/Hiyori/Hiyori.model3.json`,
    config: { transform: { ...BUST_UP }, expressionMapping: {}, motionMapping: {} },
  },
  // Mao（Cubism 5.0，走插件的 Cubism 5 运行时）：表情 exp_01–08 手动映射，自定义表情「施法」接魔法动作
  真央: {
    character: '真央',
    modelUrl: `${CUBISM_SAMPLES}/Mao/Mao.model3.json`,
    config: {
      transform: { ...BUST_UP },
      // exp_01 微笑 / exp_02 眯眼大笑 / exp_03 闭眼 / exp_04 星星眼 / exp_05 脸红 / exp_06 脸红平静 / exp_07 失落 / exp_08 鼓气
      expressionMapping: { '默认': 'exp_01', '微笑': 'exp_01', '大笑': 'exp_02', '思考': 'exp_03', '惊讶': 'exp_04', '搞怪': 'exp_04', '施法': 'exp_04', '害羞': 'exp_05', '难过': 'exp_07', '生气': 'exp_08' },
      // TapBody 3 / 4：法杖画爱心；TapBody 5：眨眼变出兔子和星星
      motionMapping: { '施法': { group: 'TapBody', index: 5 }, '搞怪': { group: 'TapBody', index: 3 }, '大笑': { group: 'TapBody', index: 4 } },
    },
  },
  // Natori（Cubism 3.0）：表情文件名就是 Smile / Angry / Surprised…，不做映射，插件按名字自动匹配
  夏目: {
    character: '夏目',
    modelUrl: `${CUBISM_SAMPLES}/Natori/Natori.model3.json`,
    config: { transform: { ...BUST_UP }, expressionMapping: {}, motionMapping: {} },
  },
};

// 录音查找键：台词只保留文字与数字（忽略标点、引号与空白的差异）；每句台词只属于一个角色，无需带上音色
export function lineKey(text) {
  return String(text || '').replace(/[^\p{L}\p{N}]/gu, '');
}

// 剧本中的角色台词：<p>角色名[表情]: "台词"</p>
export function collectDialogueLines(nodeText) {
  const lines = [];
  const re = /<p>([^<\[\]:：]+)\[[^\]]*\]\s*[:：]\s*"([^"]+)"<\/p>/g;
  let m;
  while ((m = re.exec(String(nodeText || ''))) !== null) lines.push({ speaker: m[1].trim(), text: m[2].trim() });
  return lines;
}

export function renderScenarioNode(scenario, id, params = {}) {
  const node = scenario.NODES[id];
  if (!node) return '';
  return typeof node.text === 'function' ? node.text(params) : node.text;
}
