// ============================================
// 场景布局 LLM 生成器：拼装提示词 → generateRaw → JSON 容错解析 → 重试 → 程序化兜底
// ============================================
/* global generateRaw, getChatMessages, getLastMessageId */
import { SCRIPT_NAME } from '../core/constants.js';
import { CANVAS_H, CANVAS_W, makeFallbackLayout, sanitizeLayout } from './scene-schema.js';

// 系统提示词：约束 LLM 只输出布局 JSON
const SYSTEM_PROMPT = `你是场景地图绘制助手。你的任务是把文字描述的场景转换为「俯视平面图」的布局JSON。

## 画布
- 画布尺寸 ${CANVAS_W} x ${CANVAS_H}（宽x高），x 轴向右，y 轴向下，所有坐标为整数。
- 矩形/椭圆/圆的 x,y 表示元素中心点；w,h 为全宽全高。
- 折线/多边形用 points 二维数组表示顶点。

## 元素类型（type 字段只能取以下值）
| type | 用途 | shape 可选值 |
|---|---|---|
| wall | 墙体/围栏/建筑外轮廓 | polyline |
| building | 房屋/亭台等建筑体块 | rect / polygon |
| door | 门/出入口（贴在墙上的小块） | rect |
| road | 道路/小径/走廊 | polyline |
| water | 水体（池塘/河流/喷泉） | ellipse / polygon |
| plant | 植被（树/花丛/草地团） | circle |
| area | 功能分区（草坪/广场等大面积区域） | rect / polygon |
| furniture | 家具/陈设（桌椅/柜台/床/摊位） | rect |
| landmark | 特殊地标/无法归类的物件 | circle |

## 布局要求
1. 输出 6~18 个元素，重要陈设都命名（name 字段，不超过 8 个字；次要装饰可留空字符串）。
2. 室内场景：先用 wall 画出房间外轮廓（可在出入口处留缺口），再放 furniture；室外场景：合理使用 area/road/plant/water。
3. 必须至少有 1 个 door 或 road 表示出入口。
4. building 之间不要重叠；元素分布要疏密有致，不要都挤在中间。
5. anchors 字段输出 4~8 个「人物站位点」，必须落在空地上（不与 building/water/wall 重叠），hint 为该位置的简短说明。

## 输出格式（严格遵守）
只输出一个 \`\`\`json 代码块，不要任何解释文字、注释、尾逗号。结构如下：
\`\`\`json
{
  "location": "地点名",
  "style": "indoor 或 outdoor",
  "elements": [
    { "name": "吧台", "type": "furniture", "shape": "rect", "x": 300, "y": 150, "w": 320, "h": 70 },
    { "name": "外墙", "type": "wall", "shape": "polyline", "points": [[60,60],[940,60],[940,690],[60,690],[60,60]] }
  ],
  "anchors": [
    { "x": 320, "y": 300, "hint": "吧台前" }
  ]
}
\`\`\``;

function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

// 取最近楼层正文作为环境线索兜底（截断 600 字）
function getRecentStoryText() {
  try {
    if (typeof getLastMessageId !== 'function' || typeof getChatMessages !== 'function') return '';
    const lastId = getLastMessageId();
    if (typeof lastId !== 'number' || lastId < 0) return '';
    const parts = [];
    for (let id = Math.max(0, lastId - 1); id <= lastId; id++) {
      const msgs = getChatMessages(id);
      const msg = Array.isArray(msgs) ? msgs[0] : null;
      const text = toText(msg?.message);
      if (text) parts.push(text);
    }
    const joined = parts.join('\n');
    // 去掉自定义标签，保留纯文本线索
    const plain = joined.replace(/<[^>]{1,40}>/g, ' ').replace(/\s+/g, ' ').trim();
    return plain.slice(-600);
  } catch {
    return '';
  }
}

/**
 * 拼装用户提示词
 * @param {object} sceneInfo getGlobalSceneInfo 的结果
 * @param {object[]} presentNpcs 在场 NPC 列表
 */
function buildUserPrompt(sceneInfo, presentNpcs) {
  const lines = [];
  const regionPath = [sceneInfo.primaryRegion, sceneInfo.secondaryRegion, sceneInfo.detailedLocation]
    .filter(Boolean)
    .join(' - ');
  lines.push(`【地点】${regionPath || sceneInfo.detailedLocation || '未知地点'}`);
  if (sceneInfo.currentTime) lines.push(`【时间】${sceneInfo.currentTime}`);

  const envDesc = sceneInfo.envDesc || getRecentStoryText();
  if (envDesc) lines.push(`【环境线索】${envDesc}`);

  if (presentNpcs.length) {
    const roster = presentNpcs
      .map(npc => (npc.briefIntro ? `${npc.name}（${npc.briefIntro}）` : npc.name))
      .join('、');
    lines.push(`【在场角色】${roster}`);
  }

  lines.push(`请为「${sceneInfo.detailedLocation || '当前场景'}」生成俯视平面图布局JSON。`);
  return lines.join('\n');
}

// 轻量 JSON 修复：去尾逗号、中文引号、单引号键值
function repairJsonText(text) {
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/'([^'\n]*)'\s*:/g, '"$1":')
    .replace(/:\s*'([^'\n]*)'/g, ': "$1"');
}

/**
 * 从 LLM 回复中提取并解析布局 JSON；失败返回 null
 */
export function parseLayoutJson(rawText) {
  let text = toText(rawText);
  if (!text) return null;

  // 剥离思维链
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 优先取 ```json 围栏块；无围栏取首个 { 到最后一个 }
  let jsonText = '';
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) {
    jsonText = fence[1].trim();
  } else {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    jsonText = text.slice(start, end + 1);
  }

  try {
    return JSON.parse(jsonText);
  } catch {
    try {
      return JSON.parse(repairJsonText(jsonText));
    } catch {
      return null;
    }
  }
}

/**
 * 生成场景布局。任何失败路径都返回可渲染的布局（兜底布局带 _fallback:true）。
 * @param {object} sceneInfo getGlobalSceneInfo 结果
 * @param {object[]} presentNpcs 在场 NPC
 * @returns {Promise<object>} layout
 */
export async function generateSceneLayout(sceneInfo, presentNpcs = []) {
  const locationName = toText(sceneInfo?.detailedLocation) || '当前场景';
  const fallback = () => makeFallbackLayout(locationName, presentNpcs.length + 1);

  if (typeof generateRaw !== 'function') {
    console.warn(`[${SCRIPT_NAME}] generateRaw 不可用（酒馆助手版本过旧？），使用兜底布局`);
    return fallback();
  }

  const baseUserPrompt = buildUserPrompt(sceneInfo, presentNpcs);

  // 最多 2 次调用（首次 + 解析失败重试 1 次）
  for (let attempt = 0; attempt < 2; attempt++) {
    const userPrompt =
      attempt === 0
        ? baseUserPrompt
        : `${baseUserPrompt}\n\n注意：上一次输出无法解析为JSON。请严格只输出一个合法的 \`\`\`json 代码块，不要任何多余文字。`;

    let rawText = '';
    try {
      console.log(`[${SCRIPT_NAME}] 场景布局生成中（第 ${attempt + 1} 次）: ${locationName}`);
      rawText = await generateRaw({
        user_input: userPrompt,
        should_silence: true,
        should_stream: false,
        ordered_prompts: [{ role: 'system', content: SYSTEM_PROMPT }, 'user_input'],
      });
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 场景布局生成请求失败:`, e);
      continue;
    }

    const parsed = parseLayoutJson(rawText);
    if (!parsed) {
      console.warn(`[${SCRIPT_NAME}] 场景布局 JSON 解析失败（第 ${attempt + 1} 次）`);
      continue;
    }

    const { layout, dropped } = sanitizeLayout(parsed, locationName);
    if (layout) {
      if (dropped > 0) console.warn(`[${SCRIPT_NAME}] 场景布局清洗丢弃了 ${dropped} 个非法元素`);
      console.log(`[${SCRIPT_NAME}] 场景布局生成成功: ${layout.elements.length} 个元素, ${layout.anchors.length} 个锚点`);
      return layout;
    }
    console.warn(`[${SCRIPT_NAME}] 场景布局清洗后为空（第 ${attempt + 1} 次）`);
  }

  console.warn(`[${SCRIPT_NAME}] 场景布局生成失败，使用程序化兜底布局`);
  return fallback();
}

