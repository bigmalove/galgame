import { getTTSEnabled } from '../audio/tts-config.js';
import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow } from '../core/env.js';
import { getSettings } from '../core/settings.js';
import { CUSTOM_LOCATION_HTML_KEY, CUSTOM_TIME_HTML_KEY } from '../core/store.js';
import { getAllBackgrounds } from '../db/backgrounds.js';
import { getAllExpressions } from '../utils/expressions.js';

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

  const locationStatusHtml = (topWindow?.localStorage?.getItem(CUSTOM_LOCATION_HTML_KEY) || '').trim();
  const timeStatusHtml = (topWindow?.localStorage?.getItem(CUSTOM_TIME_HTML_KEY) || '').trim();
  const locationStatusTag = locationStatusHtml ? `<弹窗一>${locationStatusHtml}</弹窗一>` : '';
  const timeStatusTag = timeStatusHtml ? `<弹窗二>${timeStatusHtml}</弹窗二>` : '';
  const statusTagInstructions = [];
  if (locationStatusTag) statusTagInstructions.push(`- 弹窗一（必须原样输出）: ${locationStatusTag}`);
  if (timeStatusTag) statusTagInstructions.push(`- 弹窗二（必须原样输出）: ${timeStatusTag}`);
  const statusTagSection =
    statusTagInstructions.length > 0
      ? `
### 状态栏标签（根据用户配置自动注入）
${statusTagInstructions.join('\n')}
- 以上标签请放在 <maintext> 内。消息包含这些标签时，点击对应状态栏会弹窗显示标签内容。
`
      : '';

  // 构建场景列表说明
  let sceneListText = '';
  const bgSrc = settings.bgImageSource || 'none';
  const useBananaImageGen = bgSrc === 'banana';
  const useWallhaven = bgSrc === 'wallhaven';

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
    const localSceneHint =
      sceneNames.length > 0
        ? `\n### 🗂️ 本地背景优先复用（必须遵守）
- 可用本地场景: ${sceneNames.join(', ')}
- 当剧情能匹配以上任一场景时，优先输出：\`<background scene="已有场景名" />\`
- 只有在本地场景都不匹配时，才输出 \`<bnimg>\` 触发大香蕉生图`
        : `\n### 🗂️ 本地背景提示
- 当前暂无本地场景，可按需输出 \`<bnimg>\` 生成新场景`;

    sceneListText = `**🍌 大香蕉 AI 生图模式**: 当场景变化时，使用自然语言描述画面，系统将调用 AI 生成对应背景图片。

${modeHint}
${customCotText}${localSceneHint}
- **复用本地格式**: \`<background scene="已有场景名" />\`
- **新场景生成格式**: \`<background scene="场景中文名"><bnimg>自然语言画面描述</bnimg>\`
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
  } else if (bgSrc === 'novelai') {
    sceneListText =
      sceneNames.length > 0
        ? `**NovelAI 实时场景生成模式**: 当剧情进入新场景时，根据当前情节生成新场景背景。\n- **判断标准**: 如果图库中的场景名称与当前剧情完全匹配，则可复用；否则必须生成新场景。\n- **生成格式**: \`<background scene="新场景名"><bgimg>danbooru tags, scenery, indoors/outdoors, lighting, atmosphere, details...</bgimg>\`\n- **场景名要求**: 使用具体、描述性的中文名称（如"暴雨中的废弃工厂_夜晚"而非"工厂"）\n- **TAG要求**: 英文逗号分隔的 Danbooru 标签，包含风格、光线、氛围、细节等\n可用场景列表: ${sceneNames.join(', ')}`
        : `**NovelAI 实时场景生成模式**: 当剧情进入新场景时，根据当前情节生成新场景背景。\n- **生成格式**: \`<background scene="新场景名"><bgimg>danbooru tags, scenery, indoors/outdoors, lighting, atmosphere, details...</bgimg>\`\n- **场景名要求**: 使用具体、描述性的中文名称\n- **TAG要求**: 英文逗号分隔的 Danbooru 标签，包含风格、光线、氛围、细节等`;
  } else if (bgSrc === 'comfyui') {
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

  const isGenerativeEngine = bgSrc === 'comfyui' || bgSrc === 'banana' || bgSrc === 'novelai';
  const exampleScene = isGenerativeEngine ? '雨夜中的都市街道' : sceneNames.length > 0 ? sceneNames[0] : '场景名';

  const extraRule =
    bgSrc === 'banana'
      ? `5. **场景生成规则**: 优先复用本地场景名；仅在本地无匹配时，使用 \`<background scene="..."><bnimg>自然语言画面描述</bnimg>\` 生成新场景。`
      : isGenerativeEngine
        ? `5. **场景生成规则**: 当场景变化且图库中无匹配场景时，使用 \`<background scene="..."><bgimg>TAGS</bgimg>\` 格式生成新场景。TAGS必须是英文单词，逗号分隔，包含：场景类型、光线条件、氛围、风格、关键细节。`
        : `5. **背景场景必须使用已配置的场景名称**`;

  const pixiEffectNames = ['rain', 'snow', 'heavySnow', 'cherryBlossoms', 'fog', 'fireflies', 'embers', 'screenFlash'];
  const pixiEffectListText = pixiEffectNames.join(', ');
  const pixiEffectTagSection =
    settings.effectsEnabled === false
      ? ''
      : `
### Pixi 特效标签（可选）
- 可用特效: ${pixiEffectListText}
- 叠加特效格式: \`<pixiPerform name="特效名" />\`
- 新消息切换时系统会自动清空特效，无需输出 \`<pixiInit />\`
- 使用规则:
  - 仅在场景氛围明显变化时使用，避免每句都触发。
  - 特效层由系统按特效名自动分配（雾固定背景层，其余固定前景层），不要输出 \`layer\`。
  - 同一场景不要高频重复输出同一个特效。
  - \`screenFlash\` 用于短暂强调（爆炸、雷电、强光），不要连续刷屏。
`;

  const bgmWhitelist = Array.from(
    new Set(
      (Array.isArray(settings.bgmWhitelist) ? settings.bgmWhitelist : [])
        .map(name => String(name || '').trim())
        .filter(Boolean),
    ),
  );
  const bgmWhitelistText = bgmWhitelist.map(name => `  - ${name}`).join('\n');
  const bgmRuleSection =
    bgmWhitelist.length > 0
      ? `### 背景音乐 (BGM)
- **格式**: \`<bgm>歌曲名</bgm>\`
- **使用规则**:
  - **主动监测**: 必须根据剧情的发展、场景的气氛变化（如战斗、日常、悲伤、恐怖），**主动**输出适合的BGM标签。
  - **指定歌单（必须遵守）**: 仅允许从以下歌单中选择歌曲，禁止输出列表外曲名。
${bgmWhitelistText}
  - **时机**: 场景切换时、剧情发生重大转折时、情感基调剧烈变化时。
  - **示例**: \`<bgm>歌曲名</bgm>\``
      : `### 背景音乐 (BGM)
- **格式**: \`<bgm>歌曲名</bgm>\`
- **使用规则**:
  - **主动监测**: 必须根据剧情的发展、场景的气氛变化（如战斗、日常、悲伤、恐怖），**主动**输出适合的BGM标签。
  - **真实曲名**: AI必须根据知识库中真实存在的、适合当前场景的BGM，**直接输入真实存在的bgm歌曲名称**。
  - **时机**: 场景切换时、剧情发生重大转折时、情感基调剧烈变化时。
  - **示例**: \`<bgm>歌曲名</bgm>\``;

  const ttsEnabled = getTTSEnabled();
  const ttsBilingualZhJaEnabled = settings.ttsBilingualZhJaEnabled === true;
  const ttsDialogueFormatLine = ttsBilingualZhJaEnabled
    ? '- **格式**: `<p>角色名[表情,男声/女声]: "中文文本[JP]日文文本"</p>`'
    : '- **格式**: `<p>角色名[表情,男声/女声]: "对话内容"</p>`';
  const ttsBilingualHintSection = ttsBilingualZhJaEnabled
    ? `
### 中日双语输出（必须严格遵守）
- 正文必须使用：\`中文文本[JP]日文文本\`
- 只能使用 \`[JP]\` 作为唯一分隔符，不要使用其他变体
- \`[JP]\` 前必须是中文显示文本
- \`[JP]\` 后必须是日文朗读文本
- 不要输出额外解释、注释或替代格式
`
    : '';
  const ttsExampleLine1 = ttsBilingualZhJaEnabled
    ? '`<p>少女[微笑,女声]: "你好呀～[JP]こんにちは～"</p>`'
    : '`<p>少女[微笑,女声]: "你好呀～"</p>`';
  const ttsExampleLine2 = ttsBilingualZhJaEnabled
    ? '`<p>将军[生气,男声|低沉威严地命令]: "退下！[JP]下がれ！"</p>`'
    : '`<p>将军[生气,男声|低沉威严地命令]: "退下！"</p>`';
  const ttsExampleLine3 = ttsBilingualZhJaEnabled
    ? '`<p>姐姐[害羞,女声|带着娇嗔撒娇]: "来嘛……陪我喝一杯～[JP]ねえ……一緒に飲もう？"</p>`'
    : '`<p>姐姐[害羞,女声|带着娇嗔撒娇]: "来嘛……陪我喝一杯～"</p>`';
  const ttsReminderLine1 = ttsBilingualZhJaEnabled
    ? '1. 推荐格式: `<p>角色名[表情,男声/女声]: "中文[JP]日文"</p>`（已绑定角色可省略为 `<p>角色名[表情]: "中文[JP]日文"</p>`）'
    : '1. 推荐格式: `<p>角色名[表情,男声/女声]: "对话"</p>`（已绑定角色可省略为 `<p>角色名[表情]: "对话"</p>`）';
  const ttsStructureDialogueLine1 = ttsBilingualZhJaEnabled
    ? '  <p>少女[微笑,女声]: "你终于来了～[JP]やっと来たね～"</p>'
    : '  <p>少女[微笑,女声]: "你终于来了～"</p>';
  const ttsStructureDialogueLine2 = ttsBilingualZhJaEnabled
    ? '  <p>少女[惊讶,女声|又急又关心地说]: "下这么大的雨，你怎么不带伞？[JP]こんな大雨なのに、どうして傘を持ってこなかったの？"</p>'
    : '  <p>少女[惊讶,女声|又急又关心地说]: "下这么大的雨，你怎么不带伞？"</p>';
  const ttsStructureDialogueLine3 = ttsBilingualZhJaEnabled
    ? '  <p>少女[难过,女声|带着心疼的语气]: "会感冒的……[JP]風邪ひいちゃうよ……"</p>'
    : '  <p>少女[难过,女声|带着心疼的语气]: "会感冒的……"</p>';

  const situationalStyleEnabled = settings.situationalStyleEnabled !== false;
  const removeStyledSectionFromCot = (template) => {
    if (situationalStyleEnabled || typeof template !== 'string' || !template) return template;
    const styledFormatMarker = '- **格式**: `<styled type="';
    const markerIndex = template.indexOf(styledFormatMarker);
    if (markerIndex < 0) return template;

    const sectionStart = template.lastIndexOf('\n### ', markerIndex);
    const start = sectionStart >= 0 ? sectionStart : markerIndex;

    let end = template.indexOf('\n## 输出结构示例', markerIndex);
    if (end < 0) end = template.indexOf('\n## 重要提醒', markerIndex);
    if (end < 0) end = template.indexOf('\n### ', markerIndex + styledFormatMarker.length);
    if (end < 0 || end <= start) return template;

    return `${template.slice(0, start)}\n${template.slice(end + 1)}`;
  };

  if (ttsEnabled) {
    const cotTemplate = `# Galgame 输出格式规范

本角色卡配合专用前端面板，输出将被解析为Galgame视觉小说界面。

## 输出格式要求
- 每个<p></p>的字数: 25-70字
${statusTagSection}

## 标签系统

### 对话格式（含配音）
${ttsDialogueFormatLine}
- **表情列表**: ${expressionListText}
- **音色标注**: 每个角色标注 \`男声\` 或 \`女声\`，系统会自动随机分配并绑定
- **兼容旧格式**: \`角色名[表情,具体音色名]\` 仍可使用
- **语气指导**（可选）: 在括号内用 \`|\` 分隔，添加语气描述，系统会传给TTS引擎优化语音效果
  - 格式: \`<p>角色名[表情,男声/女声|语气描述]: "对话内容"</p>\`（已绑定角色可写 \`<p>角色名[表情|语气描述]: "对话内容"</p>\`）
  - 需要结合当前语境和角色情感发挥，例如：'用撒娇的语气说'、'用反问的语气质问'、'带着哭腔委屈地说'、'压低声音神秘地说'
  - 不需要每句都加，在情感表达强烈或语气特殊的台词上使用效果最佳
- **示例**:
  - ${ttsExampleLine1}
  - ${ttsExampleLine2}
  - ${ttsExampleLine3}
${ttsBilingualHintSection}

### 旁白格式
- 格式: \`<p>旁白内容</p>\`
- 无需表情和音色

${bgmRuleSection}

### 背景标签 (场景环境强制)
- 格式: \`<background scene="场景名" />\`
- **使用规则**:
  - **强制触发**: 每次场景切换或环境改变时，**必须**立即输出背景标签。
  - **初始环境**: 故事开始的第一段回复中**必须**包含背景标签。
- ${sceneListText}
${pixiEffectTagSection}

### 情境样式标签（可选）
- **用途**: 当剧情中出现特殊道具或载体时（如手机短信、信件、古卷、报纸等），使用 \`<styled>\` 标签让内容以特殊样式呈现
- **格式**: \`<styled type="类型" from="发送者" to="接收者" title="标题" date="日期">内容</styled>\`
- **可用类型**: 手机短信、信纸、羊皮纸、新闻、终端、便签、日记、公告
- **使用原则**:
  - 仅在剧情明确涉及这些载体时使用，不要主动创造使用场景
  - 一条消息中最多使用一个 styled 标签
  - styled 标签放在 \`<maintext>\` 内，与 \`<p>\` 标签并列
- **示例**:
  - 短信: \`<styled type="手机短信" from="小明" to="主角">小明: 你到哪了？\n主角: 马上到</styled>\`
  - 信件: \`<styled type="信纸" from="母亲" to="孩子" date="某年某月">见信如面，近来可好……</styled>\`
  - 古卷: \`<styled type="羊皮纸" title="预言之书">当黑暗降临之时……</styled>\`
  - 新闻: \`<styled type="新闻" title="突发新闻" from="每日快报" date="今日">据报道……</styled>\`
  - 终端: \`<styled type="终端" title="系统日志">root: 访问被拒绝\nsystem: 检测到入侵</styled>\`
  - 便签: \`<styled type="便签" from="留言者">钥匙在门垫下，别忘了锁门</styled>\`
  - 日记: \`<styled type="日记" date="X月X日" title="心情复杂">今天发生了很多事……</styled>\`
  - 公告: \`<styled type="公告" title="紧急通知" from="管理层">即日起全城实施孜禁……</styled>\`

## 输出结构示例
\`\`\`
<maintext>
  <background scene="${exampleScene}" />
  <pixiPerform name="rain" />
  <p>夜色深沉，街灯在雨中摇曳。</p>
${ttsStructureDialogueLine1}
  <bgm>歌曲名</bgm>
  <p>她撑着伞，静静地站在那里。</p>
${ttsStructureDialogueLine2}
${ttsStructureDialogueLine3}

</maintext>
\`\`\`

## 重要提醒
${ttsReminderLine1}
2. 语气指导（可选）: \`<p>角色名[表情,男声/女声|语气描述]: "对话"</p>\`（已绑定角色可写 \`<p>角色名[表情|语气描述]: "对话"</p>\`）
3. 旁白格式: \`<p>旁白内容</p>\`（无需任何标记）
4. 新角色首次出现建议标注男声/女声，系统自动分配并绑定（旧格式具体音色名仍兼容）
5. maintext标签包裹
${extraRule}
`;
    return removeStyledSectionFromCot(cotTemplate);
  } else {
    const cotTemplate = `# Galgame 输出格式规范

本角色卡配合专用前端面板，输出将被解析为Galgame视觉小说界面。

## 输出格式要求
- 每段字数: 不大于70字
${statusTagSection}

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

${bgmRuleSection}

### 背景标签 (场景环境强制)
- 格式: \`<background scene="场景名" />\`
- **使用规则**:
  - **强制触发**: 每次场景切换或环境改变时，**必须**立即输出背景标签。
  - **初始环境**: 故事开始的第一段回复中**必须**包含背景标签。
- ${sceneListText}
${pixiEffectTagSection}

### 情境样式标签（可选）
- **用途**: 当剧情中出现特殊道具或载体时（如手机短信、信件、古卷、报纸等），使用 \`<styled>\` 标签让内容以特殊样式呈现
- **格式**: \`<styled type="类型" from="发送者" to="接收者" title="标题" date="日期">内容</styled>\`
- **可用类型**: 手机短信、信纸、羊皮纸、新闻、终端、便签、日记、公告
- **使用原则**:
  - 仅在剧情明确涉及这些载体时使用，不要主动创造使用场景
  - 一条消息中最多使用一个 styled 标签
  - styled 标签放在 \`<maintext>\` 内，与 \`<p>\` 标签并列
- **示例**:
  - 短信: \`<styled type="手机短信" from="小明" to="主角">小明: 你到哪了？\n主角: 马上到</styled>\`
  - 信件: \`<styled type="信纸" from="母亲" to="孩子" date="某年某月">见信如面，近来可好……</styled>\`
  - 古卷: \`<styled type="羊皮纸" title="预言之书">当黑暗降临之时……</styled>\`
  - 新闻: \`<styled type="新闻" title="突发新闻" from="每日快报" date="今日">据报道……</styled>\`
  - 终端: \`<styled type="终端" title="系统日志">root: 访问被拒绝\nsystem: 检测到入侵</styled>\`
  - 便签: \`<styled type="便签" from="留言者">钥匙在门垫下，别忘了锁门</styled>\`
  - 日记: \`<styled type="日记" date="X月X日" title="心情复杂">今天发生了很多事……</styled>\`
  - 公告: \`<styled type="公告" title="紧急通知" from="管理层">即日起全城实施孜禁……</styled>\`

## 输出结构示例
\`\`\`
<maintext>
  <background scene="${exampleScene}" />
  <pixiPerform name="fog" />
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
    return removeStyledSectionFromCot(cotTemplate);
  }
}
