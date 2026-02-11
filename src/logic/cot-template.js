import { SCRIPT_NAME } from '../core/constants.js';
import { getSettings } from '../core/settings.js';
import { getAllBackgrounds } from '../db/backgrounds.js';
import { getAllExpressions } from '../utils/expressions.js';
import { getTTSVoiceListAsync, getAllCharacterTTSVoices, getTTSEnabled } from '../audio/tts-config.js';

// ============================================
// COT (Chain of Thought) 模板生成
// ============================================

export async function generateCOTTemplate() {
  const settings = getSettings();

  // 获取所有已上传的背景场景名称
  let sceneNames = [];
  try {
    const backgrounds = await getAllBackgrounds();
    sceneNames = backgrounds.map(bg => bg.sceneName);
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 获取场景列表失败:`, e);
  }

  // 获取完整表情列表（预设 + 自定义）
  const allExpressions = getAllExpressions();
  const expressionListText = allExpressions.join(', ');

  // 构建TTS音色列表（异步获取）
  const ttsVoiceList = await getTTSVoiceListAsync();
  const ttsVoiceListText = ttsVoiceList.map(v => `${v.name}(${v.desc})`).join(', ');

  // 获取角色音色绑定
  const charVoiceMap = getAllCharacterTTSVoices();
  let charVoiceBindingText = '';
  if (Object.keys(charVoiceMap).length > 0) {
    charVoiceBindingText =
      '\n### 角色音色绑定（必须遵守）\n' +
      Object.entries(charVoiceMap)
        .map(([char, voice]) => `- **${char}**: 必须使用音色 "${voice}"`)
        .join('\n') +
      '\n**重要**: 以上角色必须使用绑定的指定音色，不可更改！\n';
  }

  // 构建场景列表说明
  let sceneListText = '';
  const useBananaImageGen = settings.bananaImageGen?.enabled;
  const useWallhaven = settings.wallhaven?.enabled;

  if (useBananaImageGen) {
    const bs = settings.bananaImageGen;

    let modeHint = '';
    if (bs.cgMode) {
      modeHint = `📌 **CG模式已开启**：请生成符合剧情的CG画面，必须包含人物（不是单纯背景）。
- 必须包含：场景环境 + 人物外观/位置/姿态/表情/互动
- 避免：只有背景、缺少人物`;
    } else {
      modeHint = `⚠️ **纯场景模式已开启**：请描述环境、风景、建筑等背景元素，不要描述人物。
- 重点描述：场景类型、光线氛围、时间天气、建筑风格、环境细节
- 避免描述：人物、角色、动作等`;
    }

    const customCot = (bs.cotTemplate || '').trim();
    const customCotText = customCot ? `\n### 🍌 自定义COT（必须遵守）\n${customCot}\n` : '';

    sceneListText = `**🍌 大香蕉 AI 生图模式**: 当场景变化时，使用自然语言描述画面，系统将调用 AI 生成对应背景图片。

${modeHint}
${customCotText}- **生成格式**: \`<background scene="场景中文名"><bnimg>自然语言画面描述</bnimg>\`
- **描述语言**: 中文或英文均可，建议使用详细的自然语言描述

### 🍌 大香蕉描述规范（必须遵守）
使用**自然语言**描述你想要的画面，就像在向画师描述一幅画。

**✅ 正确示例（自然语言描述）**:
\`<background scene="月光森林"><bnimg>月光洒落的神秘森林，高大的古树林立，银白色的月光透过树叶缝隙照射下来，地面上铺满落叶，远处有淡淡的雾气弥漫，整体氛围宁静而神秘</bnimg>\`

\`<background scene="现代都市夜景"><bnimg>繁华的现代都市夜晚，高楼大厦灯火通明，霓虹灯在雨后的街道上反射出五彩斑斓的光芒，天空中有淡淡的云层，远处是璀璨的城市天际线</bnimg>\`

\`<background scene="日式庭院"><bnimg>精致的日式传统庭院，有枯山水、石灯笼和红色枫叶，一角有木质走廊，阳光温暖柔和，整体风格宁静雅致</bnimg>\`

**描述要素建议**:
1. **场景主体**: 是什么地方（森林、城市、房间、海边等）
2. **光线时间**: 白天/夜晚、晴天/阴天、光线从哪来
3. **氛围情绪**: 温馨/神秘/紧张/浪漫/压抑等
4. **细节元素**: 具体的物品、植物、建筑特征等
5. **风格画风**: 动漫风格/写实风格/奇幻风格等（可选）

**场景描述示例**:
- 古典书房 → "昏暗的古典书房，烛光摇曳，木质书架上摆满古籍，桌上散落着羽毛笔和羊皮纸，窗外是深邃的夜空"
- 樱花小径 → "春日午后的樱花小径，粉色花瓣随风飘落，两旁是盛开的樱花树，阳光透过花枝洒下斑驳光影"
- 废弃工厂 → "荒废多年的工业厂房，锈迹斑斑的机器静默矗立，破碎的玻璃窗透进灰暗的光线，地上杂草丛生"`;
  } else if (useWallhaven) {
    const ws = settings.wallhaven;

    let categoryHint = '';
    switch (ws.category) {
      case 'anime':
        categoryHint = '使用动漫风格关键词，如: anime style, illustration, digital art';
        break;
      case 'people':
        categoryHint = '使用人物相关关键词，如: portrait, cosplay, model';
        break;
      case 'general':
        categoryHint = '使用通用壁纸关键词，如: landscape, nature, architecture';
        break;
      case 'all':
        categoryHint = '可使用任意风格关键词';
        break;
    }

    let modeHint = '';
    let appearanceHint = '';
    if (ws.cgMode) {
      modeHint = `📌 **CG模式已开启**：可以包含人物相关关键词，特别是动漫类角色`;
    } else {
      modeHint = `⚠️ **纯场景模式已开启**：请侧重描述环境/风景/建筑，避免人物相关词汇
- 推荐: scenery, landscape, background, environment, architecture, nature
- 避免: girl, boy, character, person, people`;
    }

    let customTagHint = '';
    if (ws.customTags && ws.customTags.length > 0) {
      customTagHint = `\n- **用户自定义标签(优先级最高)**: ${ws.customTags.join(', ')}`;
    }

    sceneListText = `**Wallhaven 壁纸搜索模式**: 当场景变化时，输出英文关键词供搜索匹配壁纸。

${modeHint}
${appearanceHint}- **生成格式**: \`<background scene="场景中文名"><whimg>tag1, tag2, tag3, tag4</whimg>\`
- **分类建议**: ${categoryHint}

### ⚠️ Wallhaven 标签填写规范（必须遵守）
Wallhaven 是英文标签系统，标签必须是**简短、通用的英文单词**，而非描述性句子。

**❌ 错误示例（描述性长句+过多标签）**:
\`<whimg>ancient chinese study, candlelight, interior, old paper, wooden furniture, dim lighting, historical atmosphere</whimg>\`
- 问题: 过长、描述性、包含多个概念的短语、标签过多(8个)

**✅ 正确示例（2-3个核心词）**:
\`<whimg>study, candle, wooden</whimg>\`
- 优点: 简短、独立标签、数量适中(3个)

**标签规则**:
1. **单词数量**: **3-4个**核心词，前2个用+前缀（必须同时满足），后1-2个用OR逻辑
2. **单词长度**: 每个词不超过15个字符
3. **格式**: 英文小写单词，逗号+空格分隔
4. **禁止**: 形容词短语、介词短语、复合描述、过长单词
5. **避免相似**: 不要同时用意思相近的词，如 library 和 study 只选其一
6. **排序策略**: 按 relevance（相关度）排序，优先匹配最相关的图片

**推荐标签库**（从中选择2-3个适合的）:
- **室内**: library, bedroom, kitchen, office, interior
- **建筑**: castle, temple, architecture, city, building
- **自然**: forest, mountain, lake, beach, ocean, sky, nature, tree
- **时间/天气**: day, night, morning, sunset, rain, snow, moon
- **氛围**: dark, bright, mist, fog, cozy, mysterious, fantasy
- **风格**: anime, illustration, digital art, 3D, realistic
- **特定元素**: candle, window, door, fireplace, bridge, road

**标签选择策略**:
1. **优先具体场景词**: library > room, bedroom > interior
2. **避免笼统词**: 不要用 room, house, background, scenery
3. **避免生僻词**: 不要用 chinese, japanese, calligraphy, ancient
4. **组合公式**: [具体场景] + [时间/氛围] + [特定元素]

**场景到标签映射示例**（2-3个词）:
- 古典书房 → \`<whimg>library, candle, wooden</whimg>\` (不用 study/ancient)
- 月光森林 → \`<whimg>forest, night, fantasy</whimg>\`
- 霓虹街道 → \`<whimg>city, night, cyberpunk</whimg>\`
- 温馨卧室 → \`<whimg>bedroom, morning, cozy</whimg>\`
- 日式庭院 → \`<whimg>garden, temple, asian</whimg>\` (不用 japanese)
- 现代办公室 → \`<whimg>office, modern, city</whimg>\`${customTagHint}`;
  } else if (settings.realTimeBackgroundGen) {
    sceneListText =
      sceneNames.length > 0
        ? `**实时场景生成模式**: 当剧情进入新场景时，根据当前具体情节生成新场景。\n- **判断标准**: 如果图库中的场景名称与当前剧情时间、地点、氛围完全匹配，则可复用；否则必须生成新场景。\n- **生成格式**: \`<background scene="新场景名"><bgimg>visual tags, scenery, indoors/outdoors, lighting, atmosphere, details...</bgimg>\`\n- **场景名要求**: 使用具体、描述性的名称（如"暴雨中的废弃工厂_夜晚"而非"工厂"）\n- **TAG要求**: 英文逗号分隔，包含风格、光线、氛围、细节等\n可用场景列表: ${sceneNames.join(', ')}`
        : `**实时场景生成模式**: 当剧情进入新场景时，根据当前具体情节生成新场景。\n- **生成格式**: \`<background scene="新场景名"><bgimg>visual tags, scenery, indoors/outdoors, lighting, atmosphere, details...</bgimg>\`\n- **场景名要求**: 使用具体、描述性的名称，反映当前时刻的独特氛围\n- **TAG要求**: 英文逗号分隔，包含风格、光线、氛围、细节等`;
  } else {
    sceneListText =
      sceneNames.length > 0
        ? `可用场景列表: ${sceneNames.join(', ')}\n- **严重警告**: 必须严格从上述列表中选择场景，严禁使用列表之外的名称，严禁自创地点。`
        : `（暂无可用场景，请在插件设置中上传背景图片后使用）`;
  }

  const exampleScene = settings.realTimeBackgroundGen
    ? '雨夜中的都市街道'
    : sceneNames.length > 0
      ? sceneNames[0]
      : '场景名';

  const extraRule = settings.realTimeBackgroundGen
    ? `5. **场景生成规则**: 当场景变化且图库中无匹配场景时，使用 \`<background scene="..."><bgimg>TAGS</bgimg>\` 格式生成新场景。TAGS必须是英文单词，逗号分隔，包含：场景类型、光线条件、氛围、风格、关键细节。`
    : `5. **背景场景必须使用已配置的场景名称**`;

  const ttsEnabled = getTTSEnabled();

  if (ttsEnabled) {
    return `# Galgame 输出格式规范

本角色卡配合专用前端面板，输出将被解析为Galgame视觉小说界面。

## 输出格式要求
- 每个<p></p>的字数: 25-70字

## 标签系统

### 对话格式（含配音）
- **格式**: \`<p>角色名[表情]: "对话内容"</p>\`
- **表情列表**: ${expressionListText}
- **可用音色**: ${ttsVoiceListText}
- **音色规则**:
  - **已绑定音色的角色**: 直接写 \`角色名[表情]\`，系统自动使用绑定音色
  - **新角色首次出现**: 写 \`角色名[表情,音色]\` 指定合适的音色
  - **同一角色后续对话**: 可省略音色，系统自动沿用
${charVoiceBindingText}
- **示例**:
  - \`<p>少女[微笑]: "你好呀～"</p>\` （已绑定音色或后续对话）
  - \`<p>将军[生气,夜枭]: "退下！"</p>\` （新角色首次出现，指定音色）
  - \`<p>姐姐[害羞]: "来嘛……陪我喝一杯～"</p>\`

### 旁白格式
- 格式: \`<p>旁白内容</p>\`
- 无需表情和音色

### 背景音乐 (BGM)
- **格式**: \`<bgm>歌曲名</bgm>\`
- **使用规则**:
  - **主动监测**: 必须根据剧情的发展、场景的气氛变化（如战斗、日常、悲伤、恐怖），**主动**输出适合的BGM标签。
  - **真实曲名**: AI必须根据知识库中真实存在的、适合当前场景的BGM，**直接输入真实存在的bgm歌曲名称**。
  - **时机**: 场景切换时、剧情发生重大转折时、情感基调剧烈变化时。
  - **示例**: \`<bgm>歌曲名</bgm>\`

### 背景标签 (场景环境强制)
- 格式: \`<background scene="场景名" />\`
- **使用规则**:
  - **强制触发**: 每次场景切换或环境改变时，**必须**立即输出背景标签。
  - **初始环境**: 故事开始的第一段回复中**必须**包含背景标签。
- ${sceneListText}

## 输出结构示例
\`\`\`
<maintext>
  <background scene="${exampleScene}" />
  <p>夜色深沉，街灯在雨中摇曳。</p>
  <p>少女[微笑,桃夭]: "你终于来了～"</p>
  <bgm>歌曲名</bgm>
  <p>她撑着伞，静静地站在那里。</p>
  <p>少女[惊讶]: "下这么大的雨，你怎么不带伞？"</p>
  <p>少女[难过]: "会感冒的……"</p>

</maintext>
\`\`\`

## 重要提醒
1. 对话格式: \`<p>角色名[表情]: "对话"</p>\` 或 \`<p>角色名[表情,音色]: "对话"</p>\`
2. 旁白格式: \`<p>旁白内容</p>\`（无需任何标记）
3. 新角色首次出现时指定音色，后续自动沿用
4. maintext标签包裹
${extraRule}
`;
  } else {
    return `# Galgame 输出格式规范

本角色卡配合专用前端面板，输出将被解析为Galgame视觉小说界面。

## 输出格式要求
- 每段字数: 不大于70字

## 标签系统

### 对话格式（含表情）
- 格式: \`<p>角色名: "对话内容"<表情名></p>\`
- 表情标签紧跟在对话内容后面（引号之后）
- 表情列表: ${expressionListText}
- **示例**:
  - \`<p>少女: "你好呀～"<微笑></p>\`
  - \`<p>将军: "退下！"<生气></p>\`
  - \`<p>女孩: "太好啦！"<大笑></p>\`

### 旁白格式
- 格式: \`<p>旁白内容</p>\`
- 无需表情标签

### 背景音乐 (BGM)
- **格式**: \`<bgm>歌曲名</bgm>\`
- **使用规则**:
  - **主动监测**: 必须根据剧情的发展、场景的气氛变化（如战斗、日常、悲伤、恐怖），**主动**输出适合的BGM标签。
  - **真实曲名**: AI必须根据知识库中真实存在的、适合当前场景的BGM，**直接输入真实存在的bgm歌曲名称**。
  - **时机**: 场景切换时、剧情发生重大转折时、情感基调剧烈变化时。
  - **示例**: \`<bgm>歌曲名</bgm>\`

### 背景标签 (场景环境强制)
- 格式: \`<background scene="场景名" />\`
- **使用规则**:
  - **强制触发**: 每次场景切换或环境改变时，**必须**立即输出背景标签。
  - **初始环境**: 故事开始的第一段回复中**必须**包含背景标签。
- ${sceneListText}

## 输出结构示例
\`\`\`
<maintext>
  <background scene="${exampleScene}" />
  <p>第一句旁白描述。</p>
  <p>角色名: "这是角色的对话内容。"<微笑></p>
  <bgm>歌曲名</bgm>
  <p>继续旁白描述。</p>
  <p>角色名: "表情变化了！"<惊讶></p>
  <p>角色名: "又说了一句。"<思考></p>

</maintext>
\`\`\`

## 重要提醒
1. 角色说话时必须使用格式: \`角色名: "对话内容"<表情名>\`
2. 表情标签直接跟在对话引号后面，无空格
3. 旁白不需要表情标签
4. maintext标签包裹
${extraRule}
`;
  }
}
